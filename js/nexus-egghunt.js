(() => {
  "use strict";

  const core = () => window.NexusCore;
  const STORAGE_KEY = "nexus.eggs";
  const ACHIEVEMENT_ID = "egg-hunt";

  const EGGS = [
    { id: "dossier", name: "Deep Dive", hint: "Open any title's dossier.", desc: "The timeline keeps its secrets behind every star." },
    { id: "stone", name: "Shiny Thing", hint: "Collect an Infinity Stone.", desc: "They called it a collectible. I call it a mood." },
    { id: "watchlist", name: "Saving For Later", hint: "Add a title to your watchlist.", desc: "Posterity, or just a very long queue." },
    { id: "gauntlet", name: "Fingers Crossed", hint: "Open the Infinity Gauntlet.", desc: "Snap responsibly." },
    { id: "awards", name: "Trophy Shelf", hint: "Open the trophy wall.", desc: "Someone out there is counting your wins." },
    { id: "commute", name: "On The Go", hint: "Open commute mode.", desc: "The saga, available for your daily train ride." },
    { id: "gallery", name: "Gallery Crawl", hint: "Open Nexus Cards.", desc: "Every poster, one gloriously oversized deck." },
    { id: "bigpicture", name: "The Big Picture", hint: "Hit Fit in the zoom controls.", desc: "Zoom all the way out. It's a lot." },
    { id: "oracle", name: "The Oracle", hint: "Type in the title search.", desc: "Ask the atlas anything. It knows." },
  ];

  let panel;
  let closeBtn;
  let launchBtn;
  let list;
  let countEl;
  let toast;
  let open = false;
  let found = new Set();

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...found])); } catch (e) { /* ignore */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) found = new Set(JSON.parse(raw).filter((id) => EGGS.some((e) => e.id === id)));
    } catch (e) { /* ignore */ }
  }

  function showToast(def) {
    if (!toast) return;
    toast.innerHTML = `<strong>Easter egg found · ${escapeHtml(def.name)}</strong><em>${found.size}/${EGGS.length}</em>`;
    toast.classList.remove("is-out");
    toast.classList.add("is-in");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => {
      toast.classList.remove("is-in");
      toast.classList.add("is-out");
      window.setTimeout(() => {
        toast.classList.remove("is-out");
        toast.hidden = true;
      }, 260);
    }, 3200);
  }

  function mark(id) {
    if (!found.has(id)) {
      found.add(id);
      save();
      const def = EGGS.find((e) => e.id === id);
      if (def) showToast(def);
      updateBadge();
      if (found.size === EGGS.length && core() && core().unlockAchievement) {
        core().unlockAchievement(ACHIEVEMENT_ID);
      }
      if (!panel.hidden) render();
    }
  }

  function updateBadge() {
    if (countEl) countEl.textContent = String(found.size);
    if (launchBtn) launchBtn.setAttribute("aria-label", `Easter-egg hunt — ${found.size} of ${EGGS.length} found`);
  }

  function render() {
    list.innerHTML = EGGS.map((egg) => {
      const done = found.has(egg.id);
      return `<li class="egg-row${done ? " is-found" : ""}">
        <span class="egg-row__icon" aria-hidden="true">${done ? "✓" : "?"}</span>
        <div class="egg-row__copy">
          <strong>${escapeHtml(egg.name)}</strong>
          <span>${done ? escapeHtml(egg.desc) : escapeHtml(egg.hint)}</span>
          <em>${done ? "Found" : "Hint"}</em>
        </div>
      </li>`;
    }).join("");
  }

  function openPanel() {
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launchBtn.setAttribute("aria-pressed", "true");
    render();
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

  function ensureToast() {
    if (toast || !document.body) return;
    toast = document.createElement("div");
    toast.className = "egg-toast";
    toast.setAttribute("role", "status");
    toast.hidden = true;
    document.body.appendChild(toast);
  }

  function patchCore() {
    if (!core()) return;
    const wrap = (key, eggId) => {
      const orig = core()[key];
      if (typeof orig !== "function") return;
      core()[key] = function (...args) {
        const result = orig.apply(this, args);
        mark(eggId);
        return result;
      };
    };
    wrap("openDetail", "dossier");
    wrap("collectStone", "stone");
    wrap("toggleWatchlist", "watchlist");
    wrap("toggleGauntletPanel", "gauntlet");
    wrap("toggleAchievementsPanel", "awards");
    wrap("toggleCommuteMode", "commute");
  }

  function bind() {
    launchBtn.addEventListener("click", toggle);
    closeBtn.addEventListener("click", closePanel);
    window.addEventListener("nexus-cards-open", () => mark("gallery"));
    const zoomFit = document.getElementById("zoom-fit");
    if (zoomFit) zoomFit.addEventListener("click", () => mark("bigpicture"));
    const search = document.getElementById("search-input");
    if (search) search.addEventListener("input", () => mark("oracle"));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) closePanel();
    }, true);
  }

  function init() {
    panel = document.getElementById("eggs-panel");
    if (!panel) return;
    closeBtn = document.getElementById("eggs-panel-close");
    launchBtn = document.getElementById("eggs-btn");
    list = document.getElementById("eggs-list");
    countEl = document.getElementById("eggs-count");
    if (!launchBtn || !list || !closeBtn) return;
    load();
    ensureToast();
    patchCore();
    bind();
    updateBadge();
    window.Eggs = { open: openPanel, close: closePanel, toggle, found: () => [...found], count: () => found.size };
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
