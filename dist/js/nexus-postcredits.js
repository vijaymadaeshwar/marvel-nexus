(() => {
  "use strict";

  const core = () => window.NexusCore;
  const STORAGE_KEY = "nexus.credits";
  const ACHIEVEMENT_ID = "credits-watcher";
  const SERIES_SUFFIX = / — Season \d+$/;
  const THUMB = "https://image.tmdb.org/t/p/w92";

  const CREDITS = {
    "iron-man": { end: "Nick Fury corners Tony: \u201cYou think you're the only superhero in the world?\u201d" },
    "the-incredible-hulk": { end: "Tony Stark meets General Ross in a bar \u2014 \u201cI'm here to talk to you about the Avengers Initiative.\u201d" },
    "iron-man-2": { end: "Coulson reports an impact crater in New Mexico \u2014 Mjolnir has landed." },
    "thor": { end: "Erik Selvig is shown the Tesseract as Fury opens a new chapter." },
    "captain-america-the-first-avenger": { end: "A trailer for The Avengers teases the team-up to come." },
    "the-avengers": { mid: "Thanos turns and smiles: \u201cTo challenge them is to court death.\u201d", end: "The team eats shawarma in silence." },
    "iron-man-3": { mid: "Tony narrates his origin to a dubious Bruce Banner in a hotel room.", end: "Tony keeps the arc reactor \u2014 \u201cI am Iron Man.\u201d" },
    "thor-the-dark-world": { mid: "Sif and Volstagg hand the Aether to the Collector \u2014 \u201cIt wants out.\u201d", end: "Thor and Jane reunite on the Bifrost." },
    "captain-america-the-winter-soldier": { mid: "Baron Strucker shows off Quicksilver and Scarlet Witch.", end: "Bucky visits his own memorial at the Smithsonian." },
    "guardians-of-the-galaxy": { mid: "Baby Groot dances to \u201cI Want You Back\u201d.", end: "The Collector's museum gains Howard the Duck." },
    "avengers-age-of-ultron": { mid: "Thanos dons the Infinity Gauntlet: \u201cFine. I'll do it myself.\u201d" },
    "ant-man": { mid: "Hank reveals he's been building the Wasp suit.", end: "Falcon and Winter Soldier meet \u2014 \u201cI know a guy.\u201d" },
    "captain-america-civil-war": { mid: "Peter receives his upgraded Spider-Suit from Tony.", end: "Bucky chooses to be frozen in Wakanda." },
    "doctor-strange": { mid: "Thor finds Strange: \u201cI need to locate my father.\u201d", end: "Mordo: \u201cThere are too many sorcerers.\u201d" },
    "guardians-of-the-galaxy-vol-2": { mid: "Stakar Ogord reunites his Ravager crew.", end: "Ayesha begins work on Adam." },
    "spider-man-homecoming": { mid: "Mac Gargan asks Toomes about the man in the iron suit.", end: "Captain America's patience PSA." },
    "thor-ragnarok": { mid: "The Grandmaster escapes his ruined ship.", end: "Thanos's fleet looms over the Asgardian refugees." },
    "black-panther": { mid: "T'Challa tells the UN that Wakanda will open its borders.", end: "Shuri helps the sleeping Winter Soldier." },
    "avengers-infinity-war": { end: "Nick Fury pages Carol Danvers just before he dusts." },
    "ant-man-and-the-wasp": { mid: "Scott is stranded in the Quantum Realm as the family dusts.", end: "A rat crawls over the van, freeing Scott." },
    "captain-marvel": { mid: "Carol meets the Avengers \u2014 \u201cWhere's Fury?\u201d", end: "Goose coughs up the Tesseract." },
    "avengers-endgame": { end: "Steve and Peggy dance \u2014 Sam Wilson is handed the shield." },
    "spider-man-far-from-home": { mid: "Mysterio reveals Spider-Man's identity: \u201cHe's Spider-Man.\u201d", end: "Talos and Soren, disguised as Fury and Hill, head back to space." },
    "black-widow": { mid: "Valentina recruits Yelena \u2014 and points her at Clint Barton.", end: "Yelena visits Natasha's grave." },
    "shang-chi-and-the-legend-of-the-ten-rings": { mid: "The rings broadcast into the cosmos \u2014 Wong and Carol take notice.", end: "Xialing takes command of the Ten Rings." },
    "eternals": { mid: "Dane Whitman reaches for the Ebony Blade \u2014 \u201cSure you want that?\u201d", end: "Starfox and Pip greet the returning Eternals." },
    "spider-man-no-way-home": { mid: "Eddie Brock is pulled back to his universe \u2014 leaving a sliver of symbiote." },
    "doctor-strange-in-the-multiverse-of-madness": { mid: "Clea steps through a portal: \u201cAn incursion is coming.\u201d" },
    "thor-love-and-thunder": { mid: "Zeus vows revenge \u2014 and introduces Hercules.", end: "Jane finds peace in Valhalla with Heimdall." },
    "black-panther-wakanda-forever": { mid: "Shuri meets her nephew \u2014 T'Challa's son, Toussaint." },
    "ant-man-and-the-wasp-quantumania": { mid: "The Council of Kangs gathers across timelines.", end: "Loki and Mobius watch a variant of Kang." },
    "guardians-of-the-galaxy-vol-3": { mid: "The new Guardians take flight \u2014 Rocket's crew.", end: "A title card: The Legendary Star-Lord will return." },
    "the-marvels": { mid: "Kamala recruits Kate Bishop for a new team.", end: "Monica meets a mutant \u2014 Dr. Hank McCoy." },
    "deadpool-and-wolverine": { mid: "Deadpool auditions for the Avengers \u2014 and decides he's fine on his own.", end: "Deadpool breaks the fourth wall one last time." },
    "captain-america-brave-new-world": { mid: "Samuel Sterns broods in confinement, warning of what's coming." },
  };

  let panel;
  let closeBtn;
  let launchBtn;
  let searchInput;
  let list;
  let countEl;
  let totalEl;
  let markAllBtn;
  let query = "";
  let open = false;
  let seen = new Set();

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

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen])); } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) seen = new Set(JSON.parse(raw));
    } catch (e) { /* ignore */ }
  }

  function movies() {
    return (core() && core().data && core().data().movies) || [];
  }

  function titleIds() {
    return movies()
      .filter((m) => CREDITS[m.id] && m.status !== "upcoming")
      .map((m) => m.id);
  }

  function updateBadge() {
    const total = titleIds().length;
    if (countEl) countEl.textContent = String(seen.size);
    if (totalEl) totalEl.textContent = `${seen.size} of ${total} stingers marked`;
    if (launchBtn) launchBtn.setAttribute("aria-label", `Post-credit tracker — ${seen.size} of ${total} seen`);
  }

  function tryUnlock() {
    if (!core() || !core().unlockAchievement) return;
    const total = titleIds().length;
    if (total && seen.size === total) core().unlockAchievement(ACHIEVEMENT_ID);
  }

  function toggleSeen(id) {
    if (seen.has(id)) seen.delete(id);
    else seen.add(id);
    save();
    updateBadge();
    tryUnlock();
  }

  function markAllSeen() {
    const all = titleIds();
    const allSeen = all.length > 0 && all.every((id) => seen.has(id));
    all.forEach((id) => {
      if (allSeen) seen.delete(id);
      else seen.add(id);
    });
    save();
    updateBadge();
    tryUnlock();
  }

  function thumbHtml(id) {
    const m = movies().find((x) => x.id === id);
    if (!m) return "";
    const initial = escapeHtml(String(m.title || "?").charAt(0).toUpperCase() || "?");
    if (m.poster) {
      return `<span class="credit-row__poster" data-credit-thumb><img src="${THUMB}${encodeURI(m.poster)}" alt="${escapeAttr(m.title)}" loading="lazy" decoding="async"><span class="credit-row__mono" hidden>${initial}</span></span>`;
    }
    return `<span class="credit-row__poster is-mono"><span class="credit-row__mono">${initial}</span></span>`;
  }

  function wireThumbFallbacks() {
    list.querySelectorAll("[data-credit-thumb]").forEach((holder) => {
      const img = holder.querySelector("img");
      const mono = holder.querySelector(".credit-row__mono");
      if (img) img.addEventListener("error", () => {
        img.remove();
        holder.classList.add("is-mono");
        if (mono) mono.hidden = false;
      });
    });
  }

  function row(id) {
    const scenes = CREDITS[id];
    const m = movies().find((x) => x.id === id);
    if (!m || !scenes) return "";
    const line = core().lineById ? core().lineById(m.line) : null;
    const color = line ? line.color : "#3ddc84";
    const done = seen.has(id);
    const year = m.releaseDate ? m.releaseDate.slice(0, 4) : "";
    const sceneHtml = ["mid", "end"]
      .filter((k) => scenes[k])
      .map((k) => `<p><b>${k === "mid" ? "Mid" : "Post"}</b>${escapeHtml(scenes[k])}</p>`)
      .join("");
    return `<li class="credit-row${done ? " is-seen" : ""}" style="--c-color:${color}">
      ${thumbHtml(id)}
      <button type="button" class="credit-row__mark" data-credit-id="${escapeHtml(id)}" aria-pressed="${done ? "true" : "false"}" title="${done ? "Mark unseen" : "Mark post-credits seen"}"><span aria-hidden="true">${done ? "✓" : "○"}</span></button>
      <div class="credit-row__copy">
        <header><strong>${escapeHtml(shortTitle(m.title))}</strong><em>${year}</em></header>
        ${sceneHtml}
      </div>
    </li>`;
  }

  function matches(id) {
    if (!query) return true;
    const m = movies().find((x) => x.id === id);
    if (!m) return false;
    return String(m.title).toLowerCase().includes(query);
  }

  function render() {
    const ids = titleIds().filter(matches);
    list.innerHTML = ids.map(row).join("") || '<li class="credit-empty"><strong>No matches.</strong><span>Try another title.</span></li>';
    wireThumbFallbacks();
    updateBadge();
  }

  function openPanel() {
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launchBtn.setAttribute("aria-pressed", "true");
    render();
    if (searchInput) window.setTimeout(() => searchInput.focus(), 120);
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
    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      render();
    });
    list.addEventListener("click", (event) => {
      const mark = event.target.closest("[data-credit-id]");
      if (mark) {
        toggleSeen(mark.dataset.creditId);
        render();
        return;
      }
    });
    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => {
        markAllSeen();
        render();
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) closePanel();
    }, true);
  }

  function init() {
    panel = document.getElementById("credits-panel");
    if (!panel) return;
    closeBtn = document.getElementById("credits-panel-close");
    launchBtn = document.getElementById("credits-btn");
    searchInput = document.getElementById("credits-search");
    list = document.getElementById("credits-list");
    countEl = document.getElementById("credits-count");
    totalEl = document.getElementById("credits-total");
    markAllBtn = document.getElementById("credits-markall");
    if (!launchBtn || !list || !closeBtn) return;
    load();
    bind();
    window.NexusCredits = {
      open: openPanel,
      close: closePanel,
      toggle,
      seen: () => [...seen],
      count: () => seen.size,
      toggleSeen,
    };
    render();
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
