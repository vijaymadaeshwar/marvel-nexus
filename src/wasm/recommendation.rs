// recommendation.rs — WASM-accelerated recommendation engine for Marvel Nexus
//
// Compiles to WebAssembly for high-performance movie scoring, clustering,
// similarity, and batch filtering. Exports C-ABI functions consumed by the
// TypeScript bridge layer (wasm-bridge.ts).
//
// Build: wasm-pack build --target web --release -- -C target-feature=+simd128
// Or:    rustc --target wasm32-unknown-unknown -O --crate-type cdylib recommendation.rs

// ---------------------------------------------------------------------------
// Memory management helpers
// ---------------------------------------------------------------------------

/// Allocate a contiguous buffer of `len` bytes aligned to 4-byte boundary.
/// Returns a pointer that can be read from JS via the WASM linear memory.
/// The caller (JS side) is responsible for eventually calling `dealloc`.
#[no_mangle]
pub extern "C" fn alloc(len: u32) -> *mut u8 {
    let mut buf = Vec::<u8>::with_capacity(len as usize);
    let ptr = buf.as_mut_ptr();
    std::mem::forget(buf);
    ptr
}

/// Deallocate a buffer previously returned by `alloc`.
/// `cap` must match the original capacity passed to the allocator.
#[no_mangle]
pub extern "C" fn dealloc(ptr: *mut u8, cap: u32) {
    unsafe {
        let _ = Vec::from_raw_parts(ptr, 0, cap as usize);
    }
}

// ---------------------------------------------------------------------------
// Utility helpers (internal)
// ---------------------------------------------------------------------------

/// Read a slice of `u32` IDs from a raw pointer + length.
unsafe fn read_u32_slice(ptr: *const u32, len: u32) -> &'static [u32] {
    std::slice::from_raw_parts(ptr, len as usize)
}

/// Read a slice of `f32` values from a raw pointer + length.
unsafe fn read_f32_slice(ptr: *const f32, len: u32) -> &'static [f32] {
    std::slice::from_raw_parts(ptr, len as usize)
}

/// Write a slice of `f32` values into a pre-allocated output buffer.
unsafe fn write_f32_slice(dst: *mut f32, values: &[f32]) {
    for (i, &v) in values.iter().enumerate() {
        *dst.add(i) = v;
    }
}

/// Write a slice of `u32` values into a pre-allocated output buffer.
unsafe fn write_u32_slice(dst: *mut u32, values: &[u32]) {
    for (i, &v) in values.iter().enumerate() {
        *dst.add(i) = v;
    }
}

/// Build a hash-set from a u32 slice for O(1) membership lookups.
fn build_set(ids: &[u32]) -> std::collections::HashSet<u32> {
    ids.iter().copied().collect()
}

/// Simple deterministic hash for a u32 id — used to derive per-movie
/// pseudo-random genre bits when the caller doesn't provide genre data.
/// Returns a 32-bit value; we use the lower 8 bits as genre flags.
fn pseudo_genre(id: u32) -> u32 {
    let mut x = id;
    x ^= x >> 16;
    x = x.wrapping_mul(0x45d9f3b);
    x ^= x >> 16;
    x
}

/// Derive a pseudo-year from a movie id (0–100 range) for proximity scoring.
fn pseudo_year(id: u32) -> i32 {
    (id % 101) as i32
}

// ---------------------------------------------------------------------------
// Core exported functions
// ---------------------------------------------------------------------------

/// Compute recommendation scores for every movie in `all_ids`.
///
/// For each unwatched movie, the score is the sum of its pairwise
/// contributions with every watched movie:
///
///   score(unwatched) = Σ_over_watched [ genre_overlap * year_proximity * essential_bonus ]
///
/// - `genre_overlap` ∈ [0, 1]: fraction of genre bits shared (8-bit pseudo-genres).
/// - `year_proximity` ∈ (0, 1]: 1 / (1 + |year_a - year_b| / 50).
/// - `essential_bonus` = 1.5 if the unwatched movie has id % 3 == 0 (stand-in
///   for an "essential" flag the JS side can overlay later), else 1.0.
///
/// Writes one f32 score per entry in `all_ids` into `scores_ptr`.
#[no_mangle]
pub extern "C" fn compute_scores(
    watched_ptr: *const u32,
    watched_len: u32,
    all_ids_ptr: *const u32,
    all_ids_len: u32,
    scores_ptr: *mut f32,
) {
    let watched = unsafe { read_u32_slice(watched_ptr, watched_len) };
    let all_ids = unsafe { read_u32_slice(all_ids_ptr, all_ids_len) };
    let watched_set = build_set(watched);

    let watched_genres: Vec<u32> = watched.iter().map(|&id| pseudo_genre(id)).collect();
    let watched_years: Vec<i32> = watched.iter().map(|&id| pseudo_year(id)).collect();

    let mut scores = Vec::with_capacity(all_ids.len() as usize);

    for &id in all_ids {
        if watched_set.contains(&id) {
            scores.push(0.0f32);
            continue;
        }

        let genre = pseudo_genre(id);
        let year = pseudo_year(id);
        let essential_bonus: f32 = if id % 3 == 0 { 1.5 } else { 1.0 };

        let mut total = 0.0f32;

        for i in 0..watched.len() {
            // Genre overlap: count matching bits in lower 8 positions
            let shared_bits = (genre & watched_genres[i]).count_ones() as f32;
            let total_bits = (genre | watched_genres[i]).count_ones() as f32;
            let genre_overlap = if total_bits > 0.0 { shared_bits / total_bits } else { 0.0 };

            // Year proximity: closer years → higher score
            let year_diff = (year - watched_years[i]).abs() as f32;
            let year_proximity = 1.0 / (1.0 + year_diff / 50.0);

            total += genre_overlap * year_proximity * essential_bonus;
        }

        scores.push(total);
    }

    unsafe {
        write_f32_slice(scores_ptr, &scores);
    }
}

/// Find connected-component clusters in a movie graph.
///
/// `ids_ptr` / implicit length via `connections_len` metadata — we derive
/// the number of nodes from the connections themselves. The node IDs are
/// expected to be contiguous indices.
///
/// `connections_ptr` points to a flat array of `[from, to]` pairs of u32.
/// `connections_len` is the number of PAIRS (not the raw element count).
///
/// `cluster_ptr` receives one u32 per node: the root ID of the cluster
/// that node belongs to. Nodes with no connections get their own ID as root.
///
/// Uses union-find (disjoint set) for efficient clustering.
#[no_mangle]
pub extern "C" fn find_clusters(
    ids_ptr: *const u32,
    connections_ptr: *const u32,
    connections_len: u32,
    cluster_ptr: *mut u32,
) {
    let ids = unsafe { read_u32_slice(ids_ptr, connections_len) };
    let connections = unsafe { read_u32_slice(connections_ptr, connections_len * 2) };

    // Build union-find structure
    let mut parent: std::collections::HashMap<u32, u32> = std::collections::HashMap::new();
    let mut rank: std::collections::HashMap<u32, u32> = std::collections::HashMap::new();

    // Initialise every node as its own cluster
    for &id in ids {
        parent.entry(id).or_insert(id);
        rank.entry(id).or_insert(0);
    }

    // Also register nodes that appear only in connections
    for &val in connections {
        parent.entry(val).or_insert(val);
        rank.entry(val).or_insert(0);
    }

    // Find with path compression
    fn find(parent: &mut std::collections::HashMap<u32, u32>, x: u32) -> u32 {
        let p = *parent.get(&x).unwrap_or(&x);
        if p != x {
            let root = find(parent, p);
            parent.insert(x, root);
        }
        *parent.get(&x).unwrap_or(&x)
    }

    // Union by rank
    for pair in connections.chunks(2) {
        if pair.len() < 2 {
            break;
        }
        let a = pair[0];
        let b = pair[1];
        let ra = find(&mut parent, a);
        let rb = find(&mut parent, b);

        if ra != rb {
            let rank_a = *rank.get(&ra).unwrap_or(&0);
            let rank_b = *rank.get(&rb).unwrap_or(&0);

            if rank_a < rank_b {
                parent.insert(ra, rb);
            } else if rank_a > rank_b {
                parent.insert(rb, ra);
            } else {
                parent.insert(rb, ra);
                rank.insert(ra, rank_a + 1);
            }
        }
    }

    // Write cluster roots
    for (i, &id) in ids.iter().enumerate() {
        let root = find(&mut parent, id);
        unsafe {
            *cluster_ptr.add(i) = root;
        }
    }
}

/// Batch-filter IDs by priority threshold.
///
/// `priorities_ptr` holds a u8 priority value for each ID (0–255).
/// `threshold` is the minimum priority to include.
///
/// Writes qualifying IDs into `result_ptr` and returns the count.
#[no_mangle]
pub extern "C" fn priority_batch(
    ids_ptr: *const u32,
    priorities_ptr: *const u8,
    len: u32,
    threshold: u8,
    result_ptr: *mut u32,
) -> u32 {
    let ids = unsafe { read_u32_slice(ids_ptr, len) };
    let priorities = unsafe { std::slice::from_raw_parts(priorities_ptr, len as usize) };

    let mut count = 0u32;
    for i in 0..ids.len() {
        if priorities[i] >= threshold {
            unsafe {
                *result_ptr.add(count as usize) = ids[i];
            }
            count += 1;
        }
    }
    count
}

/// Compute cosine similarity between two fixed-length f32 vectors.
///
/// Both `a_ptr` and `b_ptr` must point to buffers of at least `len` elements.
/// Returns 0.0 if either vector has zero magnitude.
#[no_mangle]
pub extern "C" fn cosine_similarity(
    a_ptr: *const f32,
    b_ptr: *const f32,
    len: u32,
) -> f32 {
    let a = unsafe { read_f32_slice(a_ptr, len) };
    let b = unsafe { read_f32_slice(b_ptr, len) };

    let mut dot = 0.0f32;
    let mut mag_a = 0.0f32;
    let mut mag_b = 0.0f32;

    for i in 0..a.len() {
        dot += a[i] * b[i];
        mag_a += a[i] * a[i];
        mag_b += b[i] * b[i];
    }

    let denom = mag_a.sqrt() * mag_b.sqrt();
    if denom == 0.0 {
        return 0.0;
    }
    dot / denom
}

/// K-nearest-neighbour search over a flat dataset.
///
/// `query_ptr`    — one query vector of length `dim`.
/// `dataset_ptr`  — flat array of `n` vectors, each of length `dim`.
/// `n`            — number of vectors in the dataset.
/// `dim`          — dimensionality of each vector.
/// `k`            — number of neighbours to return.
/// `result_ptr`   — output buffer of at least `k` u32 indices (0-based).
///
/// Uses brute-force linear scan (adequate for the ~136 Marvel titles).
#[no_mangle]
pub extern "C" fn knn_search(
    query_ptr: *const f32,
    dataset_ptr: *const f32,
    n: u32,
    dim: u32,
    k: u32,
    result_ptr: *mut u32,
) {
    let query = unsafe { read_f32_slice(query_ptr, dim) };

    // Collect (distance, index) pairs
    let mut dists: Vec<(f32, u32)> = Vec::with_capacity(n as usize);

    for i in 0..n {
        let row_start = (i * dim) as usize;
        let row_end = row_start + dim as usize;
        let row = unsafe {
            std::slice::from_raw_parts(dataset_ptr.add(row_start), dim as usize)
        };

        // Squared Euclidean distance (order-preserving vs. cosine for ranking)
        let mut dist = 0.0f32;
        for d in 0..dim as usize {
            let diff = query[d] - row[d];
            dist += diff * diff;
        }
        dists.push((dist, i));
    }

    // Partial sort — we only need the top k
    dists.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    let count = k.min(n);
    for i in 0..count as usize {
        unsafe {
            *result_ptr.add(i) = dists[i].1;
        }
    }
}
