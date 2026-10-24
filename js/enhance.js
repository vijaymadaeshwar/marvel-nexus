(() => {
  "use strict";

  // ============================================================
  // Marvel Nexus — console layer
  // Watchlist & Planner, year film-strip scrubber, command palette,
  // keyboard shortcuts, and PWA/offline registration.
  // Self-initializing on the "nexus-ready" event, mirroring nexus.js.
  // ============================================================

  const core = () => window.NexusCore;
  const W92 = "https://image.tmdb.org/t/p/w92";
  const SERIES_SUFFIX = / — Season \d+$/;

  let palette;
  let paletteInput;
  let paletteList;
  let filmStrip;
  let filmStripTrack;
  let watchlistPanel;
  let watchlistList;
  let watchlistLaunch;
  let watchlistClose;
  let watchlistTotalTime;
  let watchlistClear;

  let paletteOpen = false;
  let paletteItems = [];

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shortTitle(title) {
    return String(title).replace(SERIES_SUFFIX, "");
  }

  // ------------------------------------------------------------
  // Watchlist & Planner panel
  // ------------------------------------------------------------

  function renderWatchlist() {
    if (!watchlistList) return;
    const ids = [...core().watchlist()];
    watchlistClear.disabled = !ids.length;
    if (!ids.length) {
      watchlistList.innerHTML =
        '<div class="watchlist-empty"><strong>Nothing saved yet.</strong><span>Open any title and press "Add to watchlist" to plan it.</span></div>';
      watchlistTotalTime.textContent = "—";
      return;
    }
    const movies = ids.map((id) => core().movieById(id)).filter(Boolean);
    watchlistTotalTime.textContent = core().formatMinutes(core().watchlistTotalMinutes());
    watchlistList.innerHTML = movies
      .map((m) => {
        const line = core().lineById(m.line);
        const color = line ? line.color : "#ffffff";
        const runtime = m.runtimeMinutes ? m.runtimeMinutes + " min" : "—";
        const status = (core().state.journey || {})[m.id];
        return (
          `<li class="watchlist-item">` +
            `<button type="button" class="watchlist-item__open" data-movie-id="${escapeHtml(m.id)}" style="--line-color:${color}">` +
              `<span class="watchlist-item__poster"${m.poster ? ` style="background-image:url('${W92}${m.poster}')"` : ""}>${m.poster ? "" : m.title.charAt(0)}</span>` +
              `<span class="watchlist-item__info">` +
                `<strong>${escapeHtml(shortTitle(m.title))}</strong>` +
                `<em>${m.type === "series" ? "Series" : line ? line.name : ""} · ${escapeHtml(String(m.yearLabel || ""))}${m.releaseDate ? " · " + m.releaseDate.slice(0, 4) : ""}</em>` +
                `<em>${runtime}${status ? " · " + status : ""}</em>` +
              `</span>` +
            `</button>` +
            `<button type="button" class="watchlist-item__remove" data-remove-id="${escapeHtml(m.id)}" aria-label="Remove ${escapeHtml(m.title)} from watchlist">×</button>` +
          `</li>`
        );
      })
      .join("");
  }

  function toggleWatchlistPanel(force) {
    const shouldOpen = force !== undefined ? force : watchlistPanel.hidden;
    if (shouldOpen) {
      watchlistPanel.hidden = false;
      requestAnimationFrame(() => watchlistPanel.classList.add("is-open"));
      watchlistLaunch.setAttribute("aria-expanded", "true");
      renderWatchlist();
    } else {
      watchlistPanel.classList.remove("is-open");
      watchlistLaunch.setAttribute("aria-expanded", "false");
      window.setTimeout(() => {
        if (watchlistPanel.hidden) return;
        if (!watchlistPanel.classList.contains("is-open")) watchlistPanel.hidden = true;
      }, 240);
    }
  }

  function watchlistShareLink() {
    const ids = [...core().watchlist()];
    const url = new URL(location.href);
    if (ids.length) url.searchParams.set("watchlist", ids.join(","));
    else url.searchParams.delete("watchlist");
    return url.href;
  }

  async function copyWatchlistLink() {
    const text = watchlistShareLink();
    try {
      await navigator.clipboard.writeText(text);
      const btn = document.getElementById("watchlist-share");
      const old = btn.textContent;
      btn.textContent = "Copied!";
      window.setTimeout(() => {
        btn.textContent = old;
      }, 1400);
    } catch {
      window.prompt("Copy this watchlist share link:", text);
    }
  }

  function readWatchlistFromUrl() {
    try {
      const params = new URLSearchParams(location.search);
      const list = params.get("watchlist");
      if (!list) return;
      list.split(",").forEach((id) => {
        if (core().movieById(id) && !core().watchlist().has(id)) core().toggleWatchlist(id);
      });
    } catch {
      /* ignore malformed params */
    }
  }

  // ------------------------------------------------------------
  // Film-strip scrubber
  // ------------------------------------------------------------

  function buildFilmStrip() {
    const data = core().data();
    const movies = data.movies.filter((m) => m.releaseDate).slice();
    const min = Math.min(...movies.map((m) => Number(m.releaseDate.slice(0, 4))));
    const max = Math.max(...movies.map((m) => Number(m.releaseDate.slice(0, 4))));
    const pxPerYear = 30;
    const width = (max - min) * pxPerYear + 240;
    const sorted = movies.sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));

    const ticks = [];
    for (let y = min; y <= max; y += 10) {
      ticks.push(`<span class="film-strip__tick" style="left:${120 + (y - min) * pxPerYear}px">${y}</span>`);
    }

    filmStripTrack.innerHTML =
      `<div class="film-strip__scale" style="width:${width}px">${ticks.join("")}</div>` +
      sorted
        .map((m) => {
          const line = core().lineById(m.line);
          const color = line ? line.color : "#ffffff";
          const year = Number(m.releaseDate.slice(0, 4));
          return (
            `<button type="button" class="film-strip__item" data-movie-id="${escapeHtml(m.id)}" style="--strip-color:${color};left:${120 + (year - min) * pxPerYear}px" title="${escapeHtml(m.title)}">` +
              (m.poster
                ? `<span class="film-strip__thumb" style="background-image:url('${W92}${m.poster}')"></span>`
                : `<span class="film-strip__thumb film-strip__thumb--ph">${m.title.charAt(0)}</span>`) +
              `<em>${year}</em>` +
            `</button>`
          );
        })
        .join("");
  }

  function toggleFilmStrip(force) {
    const shouldOpen = force !== undefined ? force : filmStrip.hidden;
    if (shouldOpen) {
      buildFilmStrip();
      filmStrip.hidden = false;
      document.body.classList.add("film-strip-open");
    } else {
      filmStrip.hidden = true;
      document.body.classList.remove("film-strip-open");
    }
  }

  // ------------------------------------------------------------
  // Command palette
  // ------------------------------------------------------------

  function buildCommands() {
    const commands = [];
    const clickLaunch = (id) => () => document.getElementById(id)?.click();
    commands.push({ id: "open-cast", label: "Open Cast & Characters", hint: "c", run: clickLaunch("cast-launch") });
    commands.push({ id: "open-watchlist", label: "Open Watchlist & Planner", hint: "w", run: () => toggleWatchlistPanel(true) });
    commands.push({ id: "open-journey", label: "Open My Viewing Orbit", hint: "j", run: clickLaunch("journey-launch") });
    commands.push({ id: "surprise-me", label: "Surprise me with a random title", hint: "r", run: () => window.Surprise?.go() });
    commands.push({ id: "toggle-sections", label: "Toggle era sections", hint: "e", run: clickLaunch("era-section-toggle") });
    commands.push({ id: "toggle-film-strip", label: "Toggle year film strip", hint: "g", run: () => toggleFilmStrip() });
    commands.push({ id: "toggle-gauntlet", label: "Open the Infinity Gauntlet", hint: "s", run: () => core().toggleGauntletPanel() });
    commands.push({ id: "zoom-in", label: "Zoom in", hint: "+", run: clickLaunch("zoom-in") });
    commands.push({ id: "zoom-out", label: "Zoom out", hint: "−", run: clickLaunch("zoom-out") });
    commands.push({ id: "zoom-fit", label: "Fit timeline to screen", hint: "f", run: clickLaunch("zoom-fit") });
    commands.push({ id: "clear-filters", label: "Clear filters & highlights", hint: "esc", run: () => core().clearNetwork() });
    commands.push({ id: "focus-search", label: "Search titles", hint: "/", run: () => document.getElementById("search-input")?.focus() });
    commands.push({ id: "open-achievements", label: "Open Achievements", hint: "a", run: () => core().toggleAchievementsPanel() });
    commands.push({ id: "toggle-commute", label: "Toggle commute mode", hint: "m", run: () => core().toggleCommuteMode() });
    commands.push({ id: "open-villains", label: "Open the Villains timeline", hint: "v", run: () => window.NexusVillains?.toggle() });
    commands.push({ id: "open-credits", label: "Open the Post-Credit tracker", hint: "t", run: () => window.NexusCredits?.toggle() });
    commands.push({ id: "open-eggs", label: "Open the Easter-Egg hunt", hint: "h", run: () => window.Eggs?.toggle() });
    commands.push({ id: "open-share", label: "Open the journey Share card", hint: "p", run: () => window.ShareCard?.toggle() });
    commands.push({ id: "open-nostalgia", label: "Open Nostalgia mode", hint: "n", run: () => window.Nostalgia?.toggle() });
    commands.push({ id: "toggle-stanlee", label: "Toggle the Stan Lee narrator", hint: "d", run: () => window.StanLee?.toggle() });
    commands.push({ id: "open-quiz", label: "Open the Timeline Quiz", hint: "2", run: () => window.Quiz?.toggle() });
    commands.push({ id: "open-watchparty", label: "Open Watch Party", hint: "4", run: () => window.WatchParty?.toggle() });
    return commands;
  }

  function renderPalette(query) {
    const q = (query || "").trim().toLowerCase();
    const movies = core().data().movies;
    const titleMatches = q
      ? movies
          .filter((m) => m.title.toLowerCase().includes(q) || (m.saga && m.saga.toLowerCase().includes(q)))
          .slice(0, 12)
      : [];
    const commandMatches = buildCommands().filter((c) => c.label.toLowerCase().includes(q)).slice(0, 12);
    const html = commandMatches
      .map((c) => `<li><button type="button" class="palette-command" data-command="${c.id}"><span class="palette-command__label">${escapeHtml(c.label)}</span><kbd>${escapeHtml(c.hint)}</kbd></button></li>`)
      .join("");
    const titles = titleMatches
      .map((m) => {
        const line = core().lineById(m.line);
        const color = line ? line.color : "#ffffff";
        return `<li><button type="button" class="palette-title" data-movie-id="${escapeHtml(m.id)}" style="--strip-color:${color}"><span class="palette-title__dot"></span><span class="palette-title__label">${escapeHtml(shortTitle(m.title))}</span><em>${m.releaseDate ? m.releaseDate.slice(0, 4) : ""}</em></button></li>`;
      })
      .join("");
    paletteList.innerHTML = html + titles || '<li class="palette-empty">No matches.</li>';
    paletteItems = [...paletteList.querySelectorAll("button")];
  }

  function openPalette() {
    paletteOpen = true;
    palette.hidden = false;
    requestAnimationFrame(() => palette.classList.add("is-open"));
    renderPalette("");
    document.body.classList.add("palette-open");
    paletteInput.focus();
  }

  function closePalette() {
    paletteOpen = false;
    palette.classList.remove("is-open");
    document.body.classList.remove("palette-open");
    window.setTimeout(() => {
      if (!paletteOpen) palette.hidden = true;
    }, 180);
  }

  function runPaletteItem(button) {
    if (button.classList.contains("palette-title")) {
      const id = button.dataset.movieId;
      closePalette();
      core().revealTitle(id);
      core().openDetail(id);
    } else {
      const command = buildCommands().find((c) => c.id === button.dataset.command);
      if (command) {
        closePalette();
        command.run();
      }
    }
  }

  // ------------------------------------------------------------
  // Keyboard shortcuts
  // ------------------------------------------------------------

  function handleShortcut(event) {
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing && !(event.ctrlKey || event.metaKey)) return;

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      if (paletteOpen) closePalette();
      else openPalette();
      return;
    }
    if (event.key === "Escape" && paletteOpen) {
      closePalette();
      return;
    }
    if (paletteOpen) return;

    if (event.key === "/") {
      if (!typing) {
        event.preventDefault();
        openPalette();
      }
      return;
    }
    if (event.key.toLowerCase() === "g") {
      toggleFilmStrip();
      return;
    }
    if (event.key.toLowerCase() === "w") {
      toggleWatchlistPanel();
      return;
    }
    if (event.key.toLowerCase() === "c" && !typing) {
      document.getElementById("cast-launch")?.click();
      return;
    }
    if (event.key.toLowerCase() === "j") {
      document.getElementById("journey-launch")?.click();
      return;
    }
  }

  // ------------------------------------------------------------
  // PWA / offline
  // ------------------------------------------------------------

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((err) => {
        console.warn("Marvel Nexus service worker registration failed:", err);
      });
    });
  }

  // ------------------------------------------------------------
  // Events + init
  // ------------------------------------------------------------

  function bindEvents() {
    palette = document.getElementById("command-palette");
    paletteInput = document.getElementById("command-input");
    paletteList = document.getElementById("command-list");
    filmStrip = document.getElementById("film-strip");
    filmStripTrack = document.getElementById("film-strip-track");
    watchlistPanel = document.getElementById("watchlist-panel");
    watchlistList = document.getElementById("watchlist-list");
    watchlistLaunch = document.getElementById("watchlist-launch");
    watchlistClose = document.getElementById("watchlist-panel-close");
    watchlistTotalTime = document.getElementById("watchlist-total-time");
    watchlistClear = document.getElementById("watchlist-clear");

    if (palette) {
      document.addEventListener("keydown", handleShortcut);
      paletteInput.addEventListener("input", () => renderPalette(paletteInput.value));
      paletteInput.addEventListener("keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const items = [...paletteList.querySelectorAll("button")];
          if (!items.length) return;
          const index = items.indexOf(document.activeElement);
          const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
          items[next].focus();
        } else if (event.key === "Enter") {
          event.preventDefault();
          const active = [...paletteList.querySelectorAll("button")].find((b) => document.activeElement === b);
          const first = paletteList.querySelector("button");
          runPaletteItem(active || first);
        }
      });
      paletteList.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (button) runPaletteItem(button);
      });
    }

    if (filmStrip) {
      filmStrip.addEventListener("click", (event) => {
        const item = event.target.closest(".film-strip__item");
        if (!item) return;
        core().revealTitle(item.dataset.movieId);
        core().openDetail(item.dataset.movieId);
      });
      document.getElementById("film-strip-close")?.addEventListener("click", () => toggleFilmStrip(false));
    }

    if (watchlistPanel) {
      watchlistLaunch.addEventListener("click", () => toggleWatchlistPanel());
      watchlistClose.addEventListener("click", () => toggleWatchlistPanel(false));
      watchlistList.addEventListener("click", (event) => {
        if (event.target.closest(".watchlist-item__open")) {
          const id = event.target.closest(".watchlist-item__open").dataset.movieId;
          core().revealTitle(id);
          core().openDetail(id);
        } else if (event.target.closest(".watchlist-item__remove")) {
          core().toggleWatchlist(event.target.closest(".watchlist-item__remove").dataset.removeId);
        }
      });
      document.getElementById("watchlist-share")?.addEventListener("click", copyWatchlistLink);
      document.getElementById("watchlist-clear")?.addEventListener("click", () => {
        core().watchlist().forEach((id) => core().toggleWatchlist(id));
      });
    }

    core().onWatchlistChanged = () => {
      renderWatchlist();
    };

    window.addEventListener("keydown", (event) => {
      if (event.key !== "Escape" || !watchlistPanel || watchlistPanel.hidden) return;
      toggleWatchlistPanel(false);
      event.stopImmediatePropagation();
    }, true);

    registerServiceWorker();
  }

  function init() {
    if (!core() || !core().data()) return;
    bindEvents();
    readWatchlistFromUrl();
    renderWatchlist();
    buildFilmStrip();
  }

  window.addEventListener("nexus-ready", () => {
    init();
  });
})();
