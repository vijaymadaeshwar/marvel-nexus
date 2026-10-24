// wasm-bridge.ts — TypeScript bridge for WASM recommendation engine
//
// Loads the compiled WebAssembly module and exposes typed methods for movie
// scoring, clustering, batch filtering, similarity, and KNN. Falls back to
// pure-JS implementations when WASM is unavailable.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Flat representation of a WASM linear-memory buffer */
interface WasmMemory {
  buffer: ArrayBuffer;
}

/** Minimal shape of the imported WASM instance exports */
interface WasmExports {
  memory: WasmMemory;
  alloc(len: number): number;
  dealloc(ptr: number, cap: number): void;
  compute_scores(
    watchedPtr: number,
    watchedLen: number,
    allIdsPtr: number,
    allIdsLen: number,
    scoresPtr: number,
  ): void;
  find_clusters(
    idsPtr: number,
    connectionsPtr: number,
    connectionsLen: number,
    clusterPtr: number,
  ): void;
  priority_batch(
    idsPtr: number,
    prioritiesPtr: number,
    len: number,
    threshold: number,
    resultPtr: number,
  ): number;
  cosine_similarity(aPtr: number, bPtr: number, len: number): number;
  knn_search(
    queryPtr: number,
    datasetPtr: number,
    n: number,
    dim: number,
    k: number,
    resultPtr: number,
  ): void;
}

/** In-flight WASM module status */
type EngineStatus = 'idle' | 'loading' | 'ready' | 'failed';

// ---------------------------------------------------------------------------
// WasmEngine
// ---------------------------------------------------------------------------

export class WasmEngine {
  private _exports: WasmExports | null = null;
  private _memory: WebAssembly.Memory | null = null;
  private _status: EngineStatus = 'idle';
  private _allocFn: ((len: number) => number) | null = null;
  private _deallocFn: ((ptr: number, cap: number) => void) | null = null;

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  /**
   * Load and instantiate the WASM module.
   *
   * @param wasmUrl  URL of the `.wasm` binary. When omitted the engine
   *                 starts in "JS-only" mode — all methods will use
   *                 the fallback implementations.
   */
  async init(wasmUrl?: string): Promise<void> {
    if (!wasmUrl) {
      console.log('[NX WASM] No URL provided — running in JS-fallback mode');
      this._status = 'failed'; // fallback flag, not a real error
      return;
    }

    if (!this.isWasmSupported()) {
      console.warn('[NX WASM] WebAssembly not supported in this browser');
      this._status = 'failed';
      return;
    }

    this._status = 'loading';
    const t0 = performance.now();

    try {
      const response = await fetch(wasmUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${wasmUrl}`);
      }
      const bytes = await response.arrayBuffer();
      const module = await WebAssembly.instantiate(bytes, {
        env: { abort: () => { throw new Error('WASM abort'); } },
      });

      const instance = module.instance as WebAssembly.Instance;
      const exports = instance.exports as unknown as WasmExports;

      this._exports = exports;
      this._memory = exports.memory as unknown as WebAssembly.Memory;
      this._allocFn = exports.alloc.bind(null) as unknown as (len: number) => number;
      this._deallocFn = exports.dealloc.bind(null) as unknown as (ptr: number, cap: number) => void;

      this._status = 'ready';
      console.log(`[NX WASM] Module loaded in ${(performance.now() - t0).toFixed(1)}ms`);
    } catch (err) {
      console.error('[NX WASM] Failed to load module:', err);
      this._status = 'failed';
    }
  }

  // -----------------------------------------------------------------------
  // Status helpers
  // -----------------------------------------------------------------------

  /** Whether the current browser supports WebAssembly at all. */
  isWasmSupported(): boolean {
    return typeof WebAssembly === 'object'
      && typeof WebAssembly.instantiate === 'function';
  }

  /** Whether the WASM module is loaded and ready for computation. */
  isAvailable(): boolean {
    return this._status === 'ready'
      && this._exports !== null
      && this._memory !== null;
  }

  // -----------------------------------------------------------------------
  // Internal memory helpers
  // -----------------------------------------------------------------------

  private _getExports(): WasmExports {
    if (!this._exports) {
      throw new Error('[NX WASM] Module not loaded — call init() first');
    }
    return this._exports;
  }

  private _getMemory(): WebAssembly.Memory {
    if (!this._memory) {
      throw new Error('[NX WASM] Memory unavailable');
    }
    return this._memory;
  }

  /**
   * Copy a `number[]` (or typed array) into WASM linear memory as u32.
   * Returns [pointer, byteLength].
   */
  private _writeU32Array(values: number[]): [number, number] {
    const exp = this._getExports();
    const mem = this._getMemory();
    const bytes = values.length * 4;
    const ptr = exp.alloc(bytes);

    const view = new Uint32Array(mem.buffer, ptr, values.length);
    for (let i = 0; i < values.length; i++) {
      view[i] = values[i] >>> 0;
    }

    return [ptr, bytes];
  }

  /**
   * Copy a `Float32Array` into WASM linear memory.
   * Returns [pointer, byteLength].
   */
  private _writeF32Array(values: Float32Array): [number, number] {
    const exp = this._getExports();
    const mem = this._getMemory();
    const bytes = values.length * 4;
    const ptr = exp.alloc(bytes);

    const view = new Float32Array(mem.buffer, ptr, values.length);
    view.set(values);

    return [ptr, bytes];
  }

  /**
   * Read `count` u32 values starting at `ptr` from WASM memory.
   */
  private _readU32(ptr: number, count: number): Uint32Array {
    const mem = this._getMemory();
    return new Uint32Array(mem.buffer, ptr, count);
  }

  /**
   * Read `count` f32 values starting at `ptr` from WASM memory.
   */
  private _readF32(ptr: number, count: number): Float32Array {
    const mem = this._getMemory();
    return new Float32Array(mem.buffer, ptr, count);
  }

  private _free(ptr: number, byteLen: number): void {
    const exp = this._getExports();
    const cap = byteLen;
    exp.dealloc(ptr, cap);
  }

  // -----------------------------------------------------------------------
  // Public API — WASM-accelerated
  // -----------------------------------------------------------------------

  /**
   * Compute recommendation scores for all movies based on the watched list.
   *
   * @returns `Float32Array` with one score per entry in `allMovieIds`.
   */
  computeRecommendations(
    watchedIds: number[],
    allMovieIds: number[],
  ): Float32Array {
    if (!this.isAvailable()) {
      return this._fallbackComputeRecommendations(watchedIds, allMovieIds);
    }

    const t0 = performance.now();
    const exp = this._getExports();

    const [wPtr, wBytes] = this._writeU32Array(watchedIds);
    const [aPtr, aBytes] = this._writeU32Array(allMovieIds);

    const scoreBytes = allMovieIds.length * 4;
    const sPtr = exp.alloc(scoreBytes);

    try {
      exp.compute_scores(wPtr, watchedIds.length, aPtr, allMovieIds.length, sPtr);
      const result = new Float32Array(this._readF32(sPtr, allMovieIds.length));
      console.log(`[NX WASM] computeRecommendations: ${(performance.now() - t0).toFixed(2)}ms`);
      return result;
    } finally {
      this._free(wPtr, wBytes);
      this._free(aPtr, aBytes);
      this._free(sPtr, scoreBytes);
    }
  }

  /**
   * Find connected-component clusters in a movie connection graph.
   *
   * @returns `Uint32Array` with one cluster root ID per entry in `movieIds`.
   */
  findClusters(
    movieIds: number[],
    connections: [number, number][],
  ): Uint32Array {
    if (!this.isAvailable()) {
      return this._fallbackFindClusters(movieIds, connections);
    }

    const t0 = performance.now();
    const exp = this._getExports();

    const [idPtr, idBytes] = this._writeU32Array(movieIds);

    // Flatten connections into [from0, to0, from1, to1, ...]
    const flatConn = new Uint32Array(connections.length * 2);
    for (let i = 0; i < connections.length; i++) {
      flatConn[i * 2] = connections[i][0] >>> 0;
      flatConn[i * 2 + 1] = connections[i][1] >>> 0;
    }
    const connBytes = flatConn.length * 4;
    const cPtr = exp.alloc(connBytes);
    new Uint32Array(this._getMemory().buffer, cPtr, flatConn.length).set(flatConn);

    const outBytes = movieIds.length * 4;
    const outPtr = exp.alloc(outBytes);

    try {
      exp.find_clusters(idPtr, cPtr, connections.length, outPtr);
      const result = new Uint32Array(this._readU32(outPtr, movieIds.length));
      console.log(`[NX WASM] findClusters: ${(performance.now() - t0).toFixed(2)}ms`);
      return result;
    } finally {
      this._free(idPtr, idBytes);
      this._free(cPtr, connBytes);
      this._free(outPtr, outBytes);
    }
  }

  /**
   * Batch-filter IDs by minimum priority threshold.
   *
   * @returns Array of IDs whose priority >= threshold.
   */
  priorityBatch(
    ids: number[],
    priorities: number[],
    threshold: number,
  ): number[] {
    if (!this.isAvailable()) {
      return this._fallbackPriorityBatch(ids, priorities, threshold);
    }

    const t0 = performance.now();
    const exp = this._getExports();
    const mem = this._getMemory();

    const [idPtr, idBytes] = this._writeU32Array(ids);

    // Priorities are u8
    const priBytes = ids.length;
    const priPtr = exp.alloc(priBytes);
    const priView = new Uint8Array(mem.buffer, priPtr, ids.length);
    for (let i = 0; i < ids.length; i++) {
      priView[i] = priorities[i] & 0xff;
    }

    const resPtr = exp.alloc(ids.length * 4);

    try {
      const count = exp.priority_batch(idPtr, priPtr, ids.length, threshold & 0xff, resPtr);
      const result = Array.from(this._readU32(resPtr, count));
      console.log(`[NX WASM] priorityBatch: ${(performance.now() - t0).toFixed(2)}ms`);
      return result;
    } finally {
      this._free(idPtr, idBytes);
      this._free(priPtr, priBytes);
      this._free(resPtr, ids.length * 4);
    }
  }

  /**
   * Compute cosine similarity between two vectors.
   */
  cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (!this.isAvailable()) {
      return this._fallbackCosineSimilarity(a, b);
    }

    const t0 = performance.now();
    const exp = this._getExports();

    if (a.length !== b.length) {
      throw new Error('[NX WASM] Vectors must have equal length');
    }

    const len = a.length;
    const [aPtr, aBytes] = this._writeF32Array(a);
    const [bPtr, bBytes] = this._writeF32Array(b);

    try {
      const result = exp.cosine_similarity(aPtr, bPtr, len);
      console.log(`[NX WASM] cosineSimilarity: ${(performance.now() - t0).toFixed(2)}ms`);
      return result;
    } finally {
      this._free(aPtr, aBytes);
      this._free(bPtr, bBytes);
    }
  }

  /**
   * K-nearest-neighbour search over a flat dataset.
   *
   * @returns Array of `k` dataset indices (0-based) ordered by distance.
   */
  knnSearch(
    query: Float32Array,
    dataset: Float32Array,
    n: number,
    dim: number,
    k: number,
  ): number[] {
    if (!this.isAvailable()) {
      return this._fallbackKnnSearch(query, dataset, n, dim, k);
    }

    const t0 = performance.now();
    const exp = this._getExports();

    const [qPtr, qBytes] = this._writeF32Array(query);
    const [dPtr, dBytes] = this._writeF32Array(dataset);

    const resPtr = exp.alloc(k * 4);

    try {
      exp.knn_search(qPtr, dPtr, n, dim, k, resPtr);
      const result = Array.from(this._readU32(resPtr, k));
      console.log(`[NX WASM] knnSearch: ${(performance.now() - t0).toFixed(2)}ms`);
      return result;
    } finally {
      this._free(qPtr, qBytes);
      this._free(dPtr, dBytes);
      this._free(resPtr, k * 4);
    }
  }

  // -----------------------------------------------------------------------
  // Public API — JS fallback (always available)
  // -----------------------------------------------------------------------

  /**
   * Compute recommendations in pure JS when WASM is not available.
   */
  fallbackCompute(
    watchedIds: number[],
    allMovieIds: number[],
    mode: 'recommendations' | 'clusters' | 'priority' | 'similarity' | 'knn',
    options?: {
      connections?: [number, number][];
      priorities?: number[];
      threshold?: number;
      vectors?: Float32Array[];
      dataset?: Float32Array;
      dim?: number;
      k?: number;
    },
  ): number[] | Float32Array | Uint32Array | number {
    switch (mode) {
      case 'recommendations':
        return this._fallbackComputeRecommendations(watchedIds, allMovieIds);
      case 'clusters':
        return this._fallbackFindClusters(watchedIds, options?.connections ?? []);
      case 'priority':
        return this._fallbackPriorityBatch(allMovieIds, options?.priorities ?? [], options?.threshold ?? 0);
      case 'similarity':
        if (!options?.vectors || options.vectors.length < 2) return 0;
        return this._fallbackCosineSimilarity(options.vectors[0], options.vectors[1]);
      case 'knn':
        if (!options?.dataset || !options.dim || !options.k) return [];
        return this._fallbackKnnSearch(
          new Float32Array(allMovieIds.length),
          options.dataset,
          Math.floor(options.dataset.length / options.dim),
          options.dim,
          options.k,
        );
      default:
        return [];
    }
  }

  /** Release any resources held by the WASM instance. */
  dispose(): void {
    this._exports = null;
    this._memory = null;
    this._allocFn = null;
    this._deallocFn = null;
    this._status = 'idle';
    console.log('[NX WASM] Engine disposed');
  }

  // -----------------------------------------------------------------------
  // Private fallback implementations
  // -----------------------------------------------------------------------

  private _pseudoGenre(id: number): number {
    let x = id >>> 0;
    x ^= x >> 16;
    x = (x * 0x45d9f3b) >>> 0;
    x ^= x >> 16;
    return x;
  }

  private _pseudoYear(id: number): number {
    return id % 101;
  }

  private _fallbackComputeRecommendations(
    watchedIds: number[],
    allMovieIds: number[],
  ): Float32Array {
    const t0 = performance.now();
    const watchedSet = new Set(watchedIds);
    const watchedGenres = watchedIds.map((id) => this._pseudoGenre(id));
    const watchedYears = watchedIds.map((id) => this._pseudoYear(id));

    const scores = new Float32Array(allMovieIds.length);

    for (let i = 0; i < allMovieIds.length; i++) {
      const id = allMovieIds[i];
      if (watchedSet.has(id)) {
        scores[i] = 0;
        continue;
      }

      const genre = this._pseudoGenre(id);
      const year = this._pseudoYear(id);
      const essentialBonus = id % 3 === 0 ? 1.5 : 1.0;

      let total = 0;
      for (let j = 0; j < watchedIds.length; j++) {
        const sharedBits = this._popcount(genre & watchedGenres[j]);
        const totalBits = this._popcount(genre | watchedGenres[j]);
        const genreOverlap = totalBits > 0 ? sharedBits / totalBits : 0;

        const yearDiff = Math.abs(year - watchedYears[j]);
        const yearProximity = 1.0 / (1.0 + yearDiff / 50.0);

        total += genreOverlap * yearProximity * essentialBonus;
      }
      scores[i] = total;
    }

    console.log(`[NX JS Fallback] computeRecommendations: ${(performance.now() - t0).toFixed(2)}ms`);
    return scores;
  }

  private _fallbackFindClusters(
    movieIds: number[],
    connections: [number, number][],
  ): Uint32Array {
    const t0 = performance.now();

    // Union-find with path compression
    const parent = new Map<number, number>();
    const rank = new Map<number, number>();

    for (const id of movieIds) {
      parent.set(id, id);
      rank.set(id, 0);
    }
    for (const [a, b] of connections) {
      if (!parent.has(a)) parent.set(a, a);
      if (!parent.has(b)) parent.set(b, b);
      if (!rank.has(a)) rank.set(a, 0);
      if (!rank.has(b)) rank.set(b, 0);
    }

    const find = (x: number): number => {
      const p = parent.get(x) ?? x;
      if (p !== x) {
        const root = find(p);
        parent.set(x, root);
      }
      return parent.get(x) ?? x;
    };

    for (const [a, b] of connections) {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) {
        const rankA = rank.get(ra) ?? 0;
        const rankB = rank.get(rb) ?? 0;
        if (rankA < rankB) {
          parent.set(ra, rb);
        } else if (rankA > rankB) {
          parent.set(rb, ra);
        } else {
          parent.set(rb, ra);
          rank.set(ra, rankA + 1);
        }
      }
    }

    const result = new Uint32Array(movieIds.length);
    for (let i = 0; i < movieIds.length; i++) {
      result[i] = find(movieIds[i]) >>> 0;
    }

    console.log(`[NX JS Fallback] findClusters: ${(performance.now() - t0).toFixed(2)}ms`);
    return result;
  }

  private _fallbackPriorityBatch(
    ids: number[],
    priorities: number[],
    threshold: number,
  ): number[] {
    const t0 = performance.now();
    const result: number[] = [];
    for (let i = 0; i < ids.length; i++) {
      if (priorities[i] >= threshold) {
        result.push(ids[i]);
      }
    }
    console.log(`[NX JS Fallback] priorityBatch: ${(performance.now() - t0).toFixed(2)}ms`);
    return result;
  }

  private _fallbackCosineSimilarity(a: Float32Array, b: Float32Array): number {
    const t0 = performance.now();
    if (a.length !== b.length) {
      throw new Error('[NX JS Fallback] Vectors must have equal length');
    }
    let dot = 0;
    let magA = 0;
    let magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    const denom = Math.sqrt(magA) * Math.sqrt(magB);
    const result = denom === 0 ? 0 : dot / denom;
    console.log(`[NX JS Fallback] cosineSimilarity: ${(performance.now() - t0).toFixed(2)}ms`);
    return result;
  }

  private _fallbackKnnSearch(
    query: Float32Array,
    dataset: Float32Array,
    n: number,
    dim: number,
    k: number,
  ): number[] {
    const t0 = performance.now();
    const dists: [number, number][] = [];

    for (let i = 0; i < n; i++) {
      let dist = 0;
      for (let d = 0; d < dim; d++) {
        const diff = query[d] - dataset[i * dim + d];
        dist += diff * diff;
      }
      dists.push([dist, i]);
    }

    dists.sort((a, b) => a[0] - b[0]);
    const count = Math.min(k, n);
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(dists[i][1]);
    }

    console.log(`[NX JS Fallback] knnSearch: ${(performance.now() - t0).toFixed(2)}ms`);
    return result;
  }

  // -----------------------------------------------------------------------
  // Bit manipulation helper
  // -----------------------------------------------------------------------

  /** Population count (number of set bits) for a 32-bit integer. */
  private _popcount(x: number): number {
    x = x >>> 0;
    x -= (x >>> 1) & 0x55555555;
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    x = (x + (x >>> 4)) & 0x0f0f0f0f;
    x += x >>> 8;
    x += x >>> 16;
    return x & 0x7f;
  }
}

// ---------------------------------------------------------------------------
// Singleton export for convenience
// ---------------------------------------------------------------------------

export const wasmEngine = new WasmEngine();
