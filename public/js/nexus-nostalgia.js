(() => {
  "use strict";

  const core = () => window.NexusCore;
  const STORAGE_KEY = "nexus.nostalgia-year";
  const SERIES_SUFFIX = / — Season \d+$/;
  const MCU_START = 2008;

  const BANDS = [
    { key: "before", label: "Before your time", min: -Infinity, max: -1, color: "#5b6470" },
    { key: "baby", label: "Baby days · 0–3", min: 0, max: 3, color: "#3ddc84" },
    { key: "child", label: "Childhood · 4–11", min: 4, max: 11, color: "#22d3ee" },
    { key: "teen", label: "Teen years · 12–17", min: 12, max: 17, color: "#ffd166" },
    { key: "adult", label: "Since 18 · 18+", min: 18, max: Infinity, color: "#ff5da2" },
  ];

  let panel;
  let closeBtn;
  let launchBtn;
  let yearInput;
  let applyBtn;
  let clearBtn;
  let summary;
  let bands;
  let open = false;
  let birthYear = null;

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

  function bandFor(age) {
    return BANDS.find((b) => age >= b.min && age <= b.max) || BANDS[BANDS.length - 1];
  }

  function movies() {
    return (core() && core().data && core().data().movies) || [];
  }

  function ageInfo(movie) {
    if (!birthYear) return null;
    const releaseYear = movie.releaseDate ? Number(movie.releaseDate.slice(0, 4)) : null;
    const story = storyYearOf(movie);
    const storyAge = story == null ? null : Math.floor(story) - birthYear;
    if (storyAge !== null && storyAge >= 0) {
      return { age: storyAge, yearLabel: String(Math.floor(story)) };
    }
    if (releaseYear !== null) {
      return { age: releaseYear - birthYear, yearLabel: String(releaseYear) };
    }
    return null;
  }

  function ageAt(movie) {
    const info = ageInfo(movie);
    return info ? info.age : null;
  }

  function storyYearOf(movie) {
    if (typeof movie.inUniverseYear === "number") {
      return Number.isInteger(movie.inUniverseYear) ? movie.inUniverseYear + 0.5 : movie.inUniverseYear;
    }
    if (movie.releaseDate) {
      if (window.MCUUtils && typeof window.MCUUtils.yearFraction === "function") {
        return window.MCUUtils.yearFraction(movie.releaseDate);
      }
      return Number(movie.releaseDate.slice(0, 4));
    }
    return null;
  }

  function compute() {
    const dated = movies()
      .map((m) => ({ m, age: ageAt(m) }))
      .filter((x) => x.age !== null);
    const bandsMap = BANDS.map((b) => ({ ...b, items: [] }));
    dated.forEach(({ m, age }) => {
      const band = bandFor(age);
      bandsMap.find((b) => b.key === band.key).items.push({ m, age });
    });
    return bandsMap;
  }

  function statLine() {
    if (!birthYear) return "";
    const dated = movies()
      .map((m) => ({ m, age: ageAt(m) }))
      .filter((x) => x.age !== null)
      .sort((a, b) => String(a.m.releaseDate).localeCompare(String(b.m.releaseDate)));
    const first = dated[0];
    const mcuStart = 2008 - birthYear;
    const inLifetime = dated.filter((x) => x.age >= 0).length;
    return `The saga premiered in ${MCU_START} — you were ${mcuStart}. ${inLifetime} of ${dated.length} titles have come out in your lifetime${first && first.age >= 0 ? `, starting with ${shortTitle(first.m.title)} (${first.age}).` : "."}`;
  }

  function renderBands() {
    const computed = compute();
    const withItems = computed.filter((b) => b.items.length);
    bands.innerHTML = withItems
      .map((band) => {
        const list = band.items
          .sort((a, b) => String(a.m.releaseDate).localeCompare(String(b.m.releaseDate)))
          .map(({ m, age }) => {
            const line = core().lineById ? core().lineById(m.line) : null;
            const color = line ? line.color : "#3ddc84";
            const info = ageInfo(m);
            const yearLabel = info ? info.yearLabel : "—";
            return `<li style="--n-color:${color}">
              <button type="button" data-movie-id="${escapeHtml(m.id)}"><strong>${escapeHtml(shortTitle(m.title))}</strong><em>${yearLabel}</em></button>
              <span class="nostalgia-age" style="--band-color:${band.color}">Age ${age}</span>
            </li>`;
          })
          .join("");
        return `<section class="nostalgia-band" style="--band-color:${band.color}">
          <header><i aria-hidden="true"></i><strong>${escapeHtml(band.label)}</strong><em>${band.items.length}</em></header>
          <ul>${list}</ul>
        </section>`;
      })
      .join("") || '<p class="nostalgia-empty">Pick a birth year to see your timeline.</p>';
  }

  function apply() {
    const raw = yearInput.value.trim();
    const year = Number(raw);
    const now = new Date().getFullYear();
    if (!Number.isInteger(year) || year < 1900 || year > now) {
      summary.innerHTML = `<p class="nostalgia-warn">Enter a year between 1900 and ${now}.</p>`;
      return;
    }
    birthYear = year;
    try { localStorage.setItem(STORAGE_KEY, String(year)); } catch (e) { /* storage unavailable */ }
    summary.innerHTML = `<p>${escapeHtml(statLine())}</p>`;
    renderBands();
    clearBtn.disabled = false;
    yearInput.classList.add("is-set");
  }

  function clear() {
    birthYear = null;
    yearInput.value = "";
    yearInput.classList.remove("is-set");
    clearBtn.disabled = true;
    summary.innerHTML = '<p>Enter your birth year and Marvel will tell you how long you\'ve been in the game.</p>';
    renderBands();
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function openPanel() {
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launchBtn.setAttribute("aria-pressed", "true");
    if (birthYear === null) clear();
    renderBands();
    if (birthYear !== null) summary.innerHTML = `<p>${escapeHtml(statLine())}</p>`;
    window.setTimeout(() => yearInput.focus(), 120);
  }

  function closePanel() {
    open = false;
    panel.classList.remove("is-open");
    launchBtn.setAttribute("aria-pressed", "false");
    window.setTimeout(() => {
      if (!open) panel.hidden = true;
    }, 220);
  }

  function toggle() {
    if (open) closePanel();
    else openPanel();
  }

  function bind() {
    launchBtn.addEventListener("click", toggle);
    closeBtn.addEventListener("click", closePanel);
    applyBtn.addEventListener("click", apply);
    yearInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") apply();
    });
    clearBtn.addEventListener("click", clear);
    panel.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-movie-id]");
      if (!btn) return;
      closePanel();
      const id = btn.dataset.movieId;
      window.setTimeout(() => {
        if (core() && core().revealTitle) core().revealTitle(id);
        if (core() && core().openDetail) core().openDetail(id);
      }, 240);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) closePanel();
    }, true);
  }

  function init() {
    panel = document.getElementById("nostalgia-panel");
    if (!panel) return;
    closeBtn = document.getElementById("nostalgia-panel-close");
    launchBtn = document.getElementById("nostalgia-btn");
    yearInput = document.getElementById("nostalgia-year");
    applyBtn = document.getElementById("nostalgia-apply");
    clearBtn = document.getElementById("nostalgia-clear");
    summary = document.getElementById("nostalgia-summary");
    bands = document.getElementById("nostalgia-bands");
    if (!launchBtn || !yearInput || !applyBtn || !clearBtn) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        birthYear = Number(stored);
        yearInput.value = String(birthYear);
        yearInput.classList.add("is-set");
        clearBtn.disabled = false;
        summary.innerHTML = `<p>${escapeHtml(statLine())}</p>`;
      } else {
        clear();
      }
    } catch (e) {
      clear();
    }
    bind();
    window.Nostalgia = {
      open: openPanel,
      close: closePanel,
      toggle,
      year: () => birthYear,
      ageAt: (m) => ageAt(m),
    };
  }

  function whenReady() {
    if (!window.NexusCore || !window.NexusCore.data || !window.NexusCore.data()) {
      window.addEventListener("nexus-ready", init, { once: true });
      return;
    }
    init();
  }

  whenReady();
})();
