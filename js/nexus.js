(() => {
  "use strict";

  const FALLBACK_COLORS = ["#3ddc84", "#22d3ee", "#2dd4bf", "#ffb454", "#38bdf8", "#ff5da2", "#4ade80", "#f59e0b", "#f1c75b"];
  const SERIES_SUFFIX = / — Season \d+$/;
  const MAX_CHIPS = 6;
  const THUMB = "https://image.tmdb.org/t/p/w185";
  const LINE_SHORT = {
    mcu: "MCU",
    marvelTv: "TV",
    disneyPlus: "D+",
    xmen: "X-Men",
    spiderSony: "S-Movie",
    spiderVerse: "Spider-Verse",
    sonyVillains: "SSU",
    classic: "Classic",
  };

  let cast = [];
  const titleCastIndex = new Map();

  let panel;
  let closeBtn;
  let searchInput;
  let resultCount;
  let list;
  let network;
  let connections;
  let launchBtn;
  let clearAllBtn;
  let selectedCount;
  let tabCharacters;
  let tabNetwork;
  let tabConnections;
  let lineFiltersEl;

  let open = false;
  let query = "";
  let lineFilter = "";
  let activeView = "characters";
  const selections = new Map();
  let currentDetailMovie = null;

  const core = () => window.NexusCore;
  const movieById = (id) => core().movieById(id);
  const lineById = (id) => core().lineById(id);

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function entryId(entry) {
    return entry.id || entry.actor + "\u0000" + entry.character;
  }

  async function loadCast() {
    try {
      const response = await fetch("data/cast.json");
      if (!response.ok) throw new Error("Cast data returned " + response.status);
      cast = (await response.json()).cast;
    } catch (err) {
      if (typeof window.CAST_INLINE === "undefined") throw err;
      const data = typeof window.CAST_INLINE === "string" ? JSON.parse(window.CAST_INLINE) : window.CAST_INLINE;
      cast = data.cast;
    }
  }

  function buildTitleCastIndex() {
    titleCastIndex.clear();
    cast.forEach((entry) => {
      entry.movies.forEach((id) => {
        if (!movieById(id)) return;
        if (!titleCastIndex.has(id)) titleCastIndex.set(id, []);
        titleCastIndex.get(id).push(entry);
      });
    });
  }

  function entryLineIds(entry) {
    const lines = new Set();
    entry.movies.forEach((id) => {
      const movie = movieById(id);
      if (movie) lines.add(movie.line);
    });
    return [...lines];
  }

  function shortLineName(lineId) {
    return LINE_SHORT[lineId] || (lineById(lineId) && lineById(lineId).name) || lineId;
  }

  function dominantLineColor(ids) {
    const counts = new Map();
    ids.forEach((id) => {
      const movie = movieById(id);
      if (movie) counts.set(movie.line, (counts.get(movie.line) || 0) + 1);
    });
    let best = null;
    counts.forEach((count, lineId) => {
      if (!best || count > best.count) best = { lineId, count };
    });
    const line = best && lineById(best.lineId);
    return line ? line.color : FALLBACK_COLORS[ids.length % FALLBACK_COLORS.length];
  }

  function buildNetwork() {
    const entries = [...selections.values()];
    if (!entries.length) return null;
    const ids = [...new Set(entries.flatMap((entry) => entry.movies.filter((id) => movieById(id))))];
    if (entries.length === 1) {
      const entry = entries[0];
      return { name: entry.actor, role: entry.character, ids, color: dominantLineColor(ids) };
    }
    const names = entries.map((entry) => entry.actor);
    return {
      name: entries.length + " characters",
      role: names.slice(0, 3).join(", ") + (names.length > 3 ? "\u2026" : ""),
      ids,
      color: dominantLineColor(ids),
    };
  }

  function journeyFor(entry) {
    const journey = core().state.journey || {};
    let watched = 0;
    let watching = 0;
    let planned = 0;
    entry.movies.forEach((id) => {
      const status = journey[id];
      if (status === "watched") watched++;
      else if (status === "watching") watching++;
      else if (status === "planned") planned++;
    });
    return { watched, watching, planned, total: entry.movies.length };
  }

  function posterFor(entry) {
    if (entry.profilePath) return THUMB + encodeURI(entry.profilePath);
    return null;
  }

  function monogramFor(actor) {
    const parts = String(actor || "?").trim().split(/\s+/);
    if (parts.length >= 2) {
      return escapeHtml(parts[0].charAt(0).toUpperCase() + parts[parts.length - 1].charAt(0).toUpperCase());
    }
    return escapeHtml(parts[0].charAt(0).toUpperCase() + parts[0].charAt(1).toUpperCase());
  }

  function hashColor(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    return `hsl(${hue}, 55%, 35%)`;
  }

  function thumbHtml(entry) {
    const poster = posterFor(entry);
    const initial = monogramFor(entry.actor);
    const bgColor = hashColor(entry.actor);
    if (!poster) return `<span class="cast-thumb is-mono" data-cast-thumb style="background:linear-gradient(135deg,${bgColor},rgba(30,20,60,.9))"><span class="cast-thumb__mono">${initial}</span></span>`;
    return (
      `<span class="cast-thumb" data-cast-thumb>` +
        `<img src="${poster}" alt="${escapeAttr(entry.actor)}" loading="lazy" decoding="async">` +
        `<span class="cast-thumb__mono" hidden>${initial}</span>` +
      `</span>`
    );
  }

  function wireThumbFallbacks(root) {
    root.querySelectorAll("[data-cast-thumb]").forEach((holder) => {
      const img = holder.querySelector("img");
      const mono = holder.querySelector(".cast-thumb__mono");
      if (img) img.addEventListener("error", () => {
        img.remove();
        holder.classList.add("is-mono");
        if (mono) mono.hidden = false;
      });
    });
  }

  function chipHtml(entry) {
    const chips = entry.movies
      .map((id) => {
        const movie = movieById(id);
        if (!movie) return "";
        const line = lineById(movie.line);
        const color = line ? line.color : "#ffffff";
        const short = movie.type === "series" ? movie.title.replace(SERIES_SUFFIX, "") : movie.title;
        return `<span class="cast-chip" style="--chip-color:${color}" title="${escapeHtml(movie.title)}">${escapeHtml(short)}</span>`;
      })
      .filter(Boolean);
    const shown = chips.slice(0, MAX_CHIPS);
    const extra = chips.length - shown.length;
    if (extra > 0) shown.push(`<span class="cast-chip cast-chip--more">+${extra} more</span>`);
    return shown.join("");
  }

  function matches(entry) {
    if (!query) return true;
    const haystack = [
      entry.actor,
      entry.character,
      ...entry.movies.map((id) => {
        const movie = movieById(id);
        return movie ? movie.title : "";
      }),
    ].join(" ").toLowerCase();
    return haystack.includes(query);
  }

  function passesLineFilter(entry) {
    return !lineFilter || entryLineIds(entry).includes(lineFilter);
  }

  // ------------------------------------------------------------
  // Network reconcile
  // ------------------------------------------------------------

  function applyNetwork() {
    const network = buildNetwork();
    if (network) core().setNetworkHighlight(network);
    else core().clearNetwork();
    updateSelectionUI();
    syncHash();
  }

  function handleExternalClear() {
    selections.clear();
    updateSelectionUI();
    syncHash();
  }

  function toggleSelection(entry) {
    const id = entryId(entry);
    if (selections.has(id)) selections.delete(id);
    else selections.set(id, entry);
    applyNetwork();
  }

  // ------------------------------------------------------------
  // Panel rendering
  // ------------------------------------------------------------

  function updateSelectionUI() {
    document.querySelectorAll(".cast-entry[data-cast-index]").forEach((button) => {
      const entry = cast[Number(button.dataset.castIndex)];
      if (!entry) return;
      const active = selections.has(entryId(entry));
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".cast-conn__person[data-cast-index]").forEach((button) => {
      const entry = cast[Number(button.dataset.castIndex)];
      if (!entry) return;
      button.classList.toggle("is-active", selections.has(entryId(entry)));
    });
    if (selectedCount) {
      const n = selections.size;
      selectedCount.textContent = n === 0 ? "0 selected" : n + (n === 1 ? " character" : " characters") + " selected";
    }
    if (clearAllBtn) clearAllBtn.disabled = selections.size === 0;
    if (activeView === "connections") renderConnections();
    else if (activeView === "network") renderNetwork();
    if (currentDetailMovie) injectDetailCast(currentDetailMovie);
  }

  function lineBadgesHtml(entry) {
    const lines = entryLineIds(entry);
    const multi = lines.length > 1;
    return lines
      .map((lineId) => {
        const line = lineById(lineId);
        const color = line ? line.color : "#ffffff";
        const name = line ? line.name : lineId;
        return `<span class="cast-line-badge${multi ? " is-multi" : ""}" style="--line-color:${color}" title="${escapeHtml(name)}">${escapeHtml(shortLineName(lineId))}</span>`;
      })
      .join("");
  }

  function progressHtml(entry) {
    const j = journeyFor(entry);
    if (!j.total || !(j.watched || j.watching || j.planned)) return "";
    const fill = Math.round((j.watched / j.total) * 100);
    return `<span class="cast-entry__progress" title="${j.watched} watched · ${j.watching} watching · ${j.planned} planned of ${j.total} titles"><i class="cast-entry__progress-fill" style="--fill:${fill}%"></i><em>${j.watched}/${j.total}</em></span>`;
  }

  function entryHtml(entry, index) {
    const active = selections.has(entryId(entry));
    const titles = entry.movies.length;
    return (
      `<button type="button" class="cast-entry${active ? " is-active" : ""}" role="option" aria-selected="${active}" data-cast-index="${index}">` +
        `${thumbHtml(entry)}` +
        `<span class="cast-entry__main">` +
          `<span class="cast-entry__names">` +
            `<strong>${escapeHtml(entry.actor)}</strong>` +
            `<span>${escapeHtml(entry.character)}</span>` +
          `</span>` +
          `<span class="cast-entry__meta">` +
            `<span class="cast-entry__top">` +
              `<span class="cast-entry__lines">${lineBadgesHtml(entry)}</span>` +
              `${progressHtml(entry)}` +
            `</span>` +
            `<span class="cast-entry__count">${titles} ${titles === 1 ? "title" : "titles"}</span>` +
            `<span class="cast-entry__chips">${chipHtml(entry)}</span>` +
          `</span>` +
        `</span>` +
      `</button>`
    );
  }

  function renderCharacters() {
    const entries = [];
    cast.forEach((entry, index) => {
      if (matches(entry) && passesLineFilter(entry)) entries.push({ entry, index });
    });
    resultCount.textContent = entries.length + " of " + cast.length + " characters";
    if (!entries.length) {
      list.innerHTML = '<div class="cast-empty"><strong>No matches.</strong><span>Try an actor, character, or title.</span></div>';
      return;
    }
    list.innerHTML = entries.map(({ entry, index }) => entryHtml(entry, index)).join("");
    wireThumbFallbacks(list);
  }

  function renderConnections() {
    const entries = [...selections.values()];
    if (!entries.length) {
      connections.innerHTML =
        '<div class="cast-empty"><strong>Nothing selected yet.</strong><span>Pick one or more characters to explore who they shared a title with.</span></div>';
      return;
    }
    const totalLinks = new Set();
    const sections = entries.map((entry) => {
      const groups = [];
      entry.movies.forEach((id) => {
        const movie = movieById(id);
        const coStars = (titleCastIndex.get(id) || []).filter((other) => other !== entry);
        if (!movie || !coStars.length) return;
        const line = lineById(movie.line);
        const color = line ? line.color : "#ffffff";
        const short = movie.type === "series" ? movie.title.replace(SERIES_SUFFIX, "") : movie.title;
        coStars.forEach((other) => totalLinks.add(entryId(other)));
        groups.push(
          `<div class="cast-conn__group" style="--line-color:${color}">` +
            `<span class="cast-conn__title" title="${escapeHtml(movie.title)}">${escapeHtml(short)}</span>` +
            `<span class="cast-conn__people">` +
              coStars
                .map((other) => {
                  const index = cast.indexOf(other);
                  const active = selections.has(entryId(other));
                  return `<button type="button" class="cast-conn__person${active ? " is-active" : ""}" data-cast-index="${index}" title="${escapeHtml(other.character)}">${escapeHtml(other.actor)}</button>`;
                })
                .join("") +
            `</span>` +
          `</div>`
        );
      });
      return `<section class="cast-conn">` +
        `<header class="cast-conn__head"><strong>${escapeHtml(entry.actor)}</strong><span>${escapeHtml(entry.character)}</span></header>` +
        `<div class="cast-conn__groups">${groups.join("") || '<p class="cast-conn__none">No shared-title collaborators mapped.</p>'}</div>` +
        `</section>`;
    });
    resultCount.textContent = `Shared-title links across ${entries.length} ${entries.length === 1 ? "character" : "characters"}`;
    connections.innerHTML = sections.join("");
  }

  function renderNetwork() {
    const entries = [...selections.values()];
    if (!entries.length) {
      network.innerHTML =
        '<div class="cast-empty"><strong>No network to draw.</strong><span>Select characters in the list to map who connects to whom.</span></div>';
      return;
    }
    const selectedIds = new Set(entries.map((entry) => entryId(entry)));
    const nodes = new Map();
    const edges = [];
    const addChar = (entry) => {
      const id = entryId(entry);
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          kind: "char",
          actor: entry.actor,
          character: entry.character,
          index: cast.indexOf(entry),
          selected: selectedIds.has(id),
        });
      }
      return id;
    };
    const addTitle = (movie) => {
      const id = movie.id;
      if (!nodes.has(id)) {
        const line = lineById(movie.line);
        nodes.set(id, { id, kind: "title", title: movie.title, color: line ? line.color : "#ffffff", selected: false });
      }
      return id;
    };
    entries.forEach((entry) => {
      const charId = addChar(entry);
      entry.movies.forEach((movieId) => {
        const movie = movieById(movieId);
        if (!movie) return;
        const titleId = addTitle(movie);
        edges.push([charId, titleId]);
        (titleCastIndex.get(movieId) || []).forEach((other) => {
          if (other === entry) return;
          const otherId = addChar(other);
          edges.push([titleId, otherId]);
        });
      });
    });

    const chars = [...nodes.values()].filter((n) => n.kind === "char");
    const titles = [...nodes.values()].filter((n) => n.kind === "title");
    const columnWidth = 220;
    const pad = 14;
    const nodeH = 34;
    const titleH = 22;
    const titleMax = 9;
    const charMax = 10;

    const yFor = (arr, i, h) => {
      const total = Math.max(arr.length, 1);
      const span = (total - 1) * h;
      return pad + span / 2 + (i - (total - 1) / 2) * h;
    };

    const pos = new Map();
    chars.forEach((node, i) => pos.set(node.id, { x: pad, y: yFor(chars, i, nodeH) }));
    titles.forEach((node, i) => pos.set(node.id, { x: pad + columnWidth, y: yFor(titles, i, titleH) }));

    const width = pad * 2 + columnWidth + pad;
    const height = Math.max(chars.length * nodeH, titles.length * titleH) + pad * 2;

    const edgeMarkup = edges
      .map(([a, b], i) => {
        const pa = pos.get(a);
        const pb = pos.get(b);
        if (!pa || !pb) return "";
        const mx = (pa.x + pb.x) / 2;
        return `<path d="M ${pa.x + 5} ${pa.y} C ${mx} ${pa.y}, ${mx} ${pb.y}, ${pb.x - 3} ${pb.y}" class="net-edge" data-edge="${i}" fill="none"/>`;
      })
      .join("");

    const nodeMarkup = [...nodes.values()]
      .map((node) => {
        const p = pos.get(node.id);
        if (node.kind === "char") {
          return `<button type="button" class="net-node net-node--char${node.selected ? " is-selected" : ""}" data-cast-index="${node.index}" style="left:${p.x}px;top:${p.y}px;width:${columnWidth - pad}px;height:${nodeH - 8}px;" title="${escapeHtml(node.character)}">
            <strong>${escapeHtml(node.actor)}</strong><em>${escapeHtml(node.character)}</em>
          </button>`;
        }
        return `<button type="button" class="net-node net-node--title" data-movie-id="${escapeAttr(node.id)}" style="left:${p.x}px;top:${p.y}px;--node-color:${node.color}" title="${escapeHtml(node.title)}">${escapeHtml(node.title)}</button>`;
      })
      .join("");

    resultCount.textContent = `${chars.length} characters · ${titles.length} titles · ${edges.length} links`;
    network.innerHTML = `
      <div class="net-scroll" tabindex="-1">
        <svg class="net-svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true">${edgeMarkup}</svg>
        <div class="net-nodes" style="width:${width}px;height:${height}px">${nodeMarkup}</div>
      </div>`;
  }

  function renderLineFilters() {
    const counts = new Map();
    cast.forEach((entry) => {
      entryLineIds(entry).forEach((lineId) => counts.set(lineId, (counts.get(lineId) || 0) + 1));
    });
    const chips = [`<button type="button" class="cast-line-filter${!lineFilter ? " is-active" : ""}" data-line="" aria-pressed="${!lineFilter}">All · ${cast.length}</button>`];
    counts.forEach((count, lineId) => {
      const color = lineById(lineId) ? lineById(lineId).color : "#ffffff";
      chips.push(
        `<button type="button" class="cast-line-filter${lineFilter === lineId ? " is-active" : ""}" data-line="${lineId}" aria-pressed="${lineFilter === lineId}" style="--line-color:${color}">${escapeHtml(shortLineName(lineId))} · ${count}</button>`
      );
    });
    lineFiltersEl.innerHTML = chips.join("");
  }

  function renderPanel() {
    tabCharacters.classList.toggle("is-active", activeView === "characters");
    tabCharacters.setAttribute("aria-selected", String(activeView === "characters"));
    tabNetwork.classList.toggle("is-active", activeView === "network");
    tabNetwork.setAttribute("aria-selected", String(activeView === "network"));
    tabConnections.classList.toggle("is-active", activeView === "connections");
    tabConnections.setAttribute("aria-selected", String(activeView === "connections"));
    list.hidden = activeView !== "characters";
    network.hidden = activeView !== "network";
    connections.hidden = activeView !== "connections";
    lineFiltersEl.hidden = activeView !== "characters";
    renderLineFilters();
    if (activeView === "characters") renderCharacters();
    else if (activeView === "network") renderNetwork();
    else renderConnections();
    updateSelectionUI();
  }

  function closeDetailCast() {
    currentDetailMovie = null;
  }

  // ------------------------------------------------------------
  // Detail panel reverse lookup
  // ------------------------------------------------------------

  function injectDetailCast(movie) {
    const content = document.getElementById("detail-content");
    if (!content) return;
    const existing = content.querySelector(".detail-cast");
    if (existing) existing.remove();
    if (content.querySelector(".detail-spoiler-note")) return; // spoiler-safe: keep cast hidden
    const entries = titleCastIndex.get(movie.id) || [];
    if (!entries.length) return;
    const synopsis = content.querySelector(".detail-synopsis");
    const section = document.createElement("section");
    section.className = "detail-cast";
    section.setAttribute("aria-labelledby", "detail-cast-heading");
    const items = entries
      .map((entry) => {
        const index = cast.indexOf(entry);
        const active = selections.has(entryId(entry));
        return (
          `<li>` +
            `<button type="button" class="detail-cast__item${active ? " is-active" : ""}" data-cast-index="${index}">` +
              `${thumbHtml(entry)}` +
              `<span class="detail-cast__main">` +
                `<span class="detail-cast__names"><strong>${escapeHtml(entry.actor)}</strong><span>${escapeHtml(entry.character)}</span></span>` +
                `<span class="detail-cast__badges">${lineBadgesHtml(entry)}<em>${entry.movies.length} ${entry.movies.length === 1 ? "title" : "titles"}</em></span>` +
              `</span>` +
            `</button>` +
          `</li>`
        );
      })
      .join("");
    section.innerHTML = `<h4 id="detail-cast-heading">Cast &amp; characters in this title</h4><p class="detail-cast__hint">Select a name to trace their titles across the timeline.</p><ul>${items}</ul>`;
    wireThumbFallbacks(section);
    section.querySelectorAll(".detail-cast__item").forEach((button) => {
      button.addEventListener("click", () => {
        const entry = cast[Number(button.dataset.castIndex)];
        if (!entry) return;
        toggleSelection(entry);
        if (selections.has(entryId(entry)) && entry.movies.length && typeof core().revealTitle === "function") {
          core().revealTitle(entry.movies[0]);
        }
      });
    });
    if (synopsis) content.insertBefore(section, synopsis);
    else content.appendChild(section);
  }

  // ------------------------------------------------------------
  // Panel open / close / tabs
  // ------------------------------------------------------------

  function openPanel() {
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launchBtn.setAttribute("aria-expanded", "true");
    // Lazy-render on first open
    if (!panel.dataset.rendered) {
      panel.dataset.rendered = "1";
      renderPanel();
    }
    searchInput.focus();
  }

  function closePanel() {
    open = false;
    panel.classList.remove("is-open");
    launchBtn.setAttribute("aria-expanded", "false");
    window.setTimeout(() => {
      if (!open) panel.hidden = true;
    }, 240);
  }

  function togglePanel() {
    if (open) closePanel();
    else openPanel();
  }

  // ------------------------------------------------------------
  // Deep-link hash
  // ------------------------------------------------------------

  function syncHash() {
    const params = new URLSearchParams();
    if (selections.size) params.set("cast", [...selections.keys()].join(","));
    if (activeView === "connections") params.set("view", "connections");
    else if (activeView === "network") params.set("view", "network");
    if (lineFilter) params.set("line", lineFilter);
    const hash = params.toString() ? "#" + params.toString() : "";
    history.replaceState(null, "", location.pathname + location.search + hash);
  }

  function readHash() {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return;
    const params = new URLSearchParams(raw);
    const castParam = params.get("cast");
    if (castParam) {
      const wanted = new Set(castParam.split(",").filter(Boolean));
      cast.forEach((entry) => {
        if (wanted.has(entryId(entry))) selections.set(entryId(entry), entry);
      });
    }
    if (params.get("view") === "connections") activeView = "connections";
    else if (params.get("view") === "network") activeView = "network";
    const line = params.get("line");
    if (line && cast.some((entry) => entryLineIds(entry).includes(line))) lineFilter = line;
  }

  function bindEvents() {
    launchBtn.addEventListener("click", togglePanel);
    closeBtn.addEventListener("click", closePanel);

    tabCharacters.addEventListener("click", () => {
      activeView = "characters";
      renderPanel();
      syncHash();
    });
    tabNetwork.addEventListener("click", () => {
      activeView = "network";
      renderPanel();
      syncHash();
    });
    tabConnections.addEventListener("click", () => {
      activeView = "connections";
      renderPanel();
      syncHash();
    });

    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      renderCharacters();
      updateSelectionUI();
    });

    lineFiltersEl.addEventListener("click", (event) => {
      const button = event.target.closest(".cast-line-filter");
      if (!button) return;
      lineFilter = button.dataset.line || "";
      renderPanel();
      syncHash();
    });

    list.addEventListener("click", (event) => {
      const button = event.target.closest(".cast-entry");
      if (!button) return;
      const entry = cast[Number(button.dataset.castIndex)];
      if (!entry) return;
      toggleSelection(entry);
    });

    connections.addEventListener("click", (event) => {
      const button = event.target.closest(".cast-conn__person");
      if (!button) return;
      const entry = cast[Number(button.dataset.castIndex)];
      if (!entry) return;
      toggleSelection(entry);
    });

    network.addEventListener("click", (event) => {
      const title = event.target.closest(".net-node--title");
      if (title && typeof core().openDetail === "function") {
        core().openDetail(title.dataset.movieId);
        return;
      }
      const person = event.target.closest(".net-node--char");
      if (!person) return;
      const entry = cast[Number(person.dataset.castIndex)];
      if (!entry) return;
      toggleSelection(entry);
      if (selections.has(entryId(entry)) && typeof core().revealTitle === "function") {
        core().revealTitle(entry.movies[0]);
      }
    });

    clearAllBtn.addEventListener("click", () => {
      selections.clear();
      applyNetwork();
    });

    list.addEventListener("keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const buttons = [...list.querySelectorAll(".cast-entry")];
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(document.activeElement);
      let next;
      if (event.key === "ArrowDown") next = buttons[(index + 1) % buttons.length];
      else if (event.key === "ArrowUp") next = buttons[(index - 1 + buttons.length) % buttons.length];
      else if (event.key === "Home") next = buttons[0];
      else next = buttons[buttons.length - 1];
      next.focus();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !open) return;
      closePanel();
      event.stopImmediatePropagation();
    }, true);

    window.addEventListener("hashchange", () => {
      selections.clear();
      readHash();
      applyNetwork();
      renderPanel();
    });
  }

  async function init() {
    const data = core().data();
    if (!data || !Array.isArray(data.movies)) return;
    await loadCast();
    buildTitleCastIndex();
    panel = document.getElementById("cast-panel");
    closeBtn = document.getElementById("cast-panel-close");
    searchInput = document.getElementById("cast-search-input");
    resultCount = document.getElementById("cast-result-count");
    list = document.getElementById("cast-list");
    network = document.getElementById("cast-network");
    connections = document.getElementById("cast-connections");
    launchBtn = document.getElementById("cast-launch");
    clearAllBtn = document.getElementById("cast-clear-all");
    selectedCount = document.getElementById("cast-selected-count");
    tabCharacters = document.getElementById("cast-tab-characters");
    tabNetwork = document.getElementById("cast-tab-network");
    tabConnections = document.getElementById("cast-tab-connections");
    lineFiltersEl = document.getElementById("cast-line-filters");
    if (!panel || !list || !connections || !launchBtn) return;

    core().castForMovie = (id) => [...(titleCastIndex.get(id) || [])];
    core().castIndex = titleCastIndex;

    core().onNetworkClear = handleExternalClear;
    core().onDetail = (action, movie) => {
      if (action === "open") {
        currentDetailMovie = movie;
        injectDetailCast(movie);
      } else {
        closeDetailCast();
      }
    };
    core().onJourneyChanged = () => {
      if (open) renderPanel();
      if (currentDetailMovie) injectDetailCast(currentDetailMovie);
    };

    readHash();
    if (selections.size) applyNetwork();
    bindEvents();
  }

  window.addEventListener("nexus-ready", () => {
    init().catch((error) => console.error("Unable to initialize Cast & Character network:", error));
  });
})();
