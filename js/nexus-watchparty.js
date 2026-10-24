(() => {
  "use strict";

  const core = () => window.NexusCore;
  const SERIES_SUFFIX = / — Season \d+$/;
  const STORAGE_PREFIX = "marvel-nexus-party-";
  const PARTY_KEY_CURRENT = "marvel-nexus-party-current";
  const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const SYNC_INTERVAL = 3000;

  const AVATAR_COLORS = [
    "#3ddc84", "#22d3ee", "#ff5da2", "#ffd166",
    "#7dd3a8", "#ff7ad9", "#4ade80", "#f59e0b",
    "#38bdf8", "#2dd4bf",
  ];

  const INLINE_CSS = `
.watchparty-panel .watchparty-panel__body { padding:14px 16px; overflow-y:auto; flex:1; }
.watchparty-panel .watchparty-panel__body h4 { margin:0 0 8px; font:600 11px var(--font-mono); color:var(--text-dim); letter-spacing:.5px; text-transform:uppercase; }
.watchparty-code { text-align:center; padding:20px; margin-bottom:16px; background:rgba(61,220,132,.06); border:1px dashed rgba(61,220,132,.3); border-radius:14px; }
.watchparty-code span { display:block; font:700 28px var(--font-mono); letter-spacing:6px; color:#7dffb0; margin-bottom:6px; }
.watchparty-code small { color:var(--text-dim); font:11px var(--font-body); }
.watchparty-members { display:grid; gap:8px; margin-bottom:16px; }
.watchparty-member { display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--bg-panel); }
.watchparty-member__avatar { width:32px; height:32px; border-radius:50%; display:grid; place-items:center; font:700 12px var(--font-ui); color:#fff; flex-shrink:0; }
.watchparty-member__info { flex:1; min-width:0; }
.watchparty-member__info strong { font:600 12px var(--font-body); display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.watchparty-member__info small { display:block; color:var(--text-dim); font:10px var(--font-body); }
.watchparty-member__badge { font:600 9px var(--font-mono); padding:2px 6px; border-radius:999px; background:rgba(61,220,132,.15); color:#7dffb0; flex-shrink:0; }
.watchparty-sync { display:flex; align-items:center; gap:6px; padding:8px 12px; margin-bottom:14px; border-radius:999px; background:rgba(61,220,132,.08); font:11px var(--font-mono); color:var(--accent-teal); }
.watchparty-sync::before { content:""; width:8px; height:8px; border-radius:50%; background:#3ddc84; animation:watchparty-sync-pulse 1.5s ease-in-out infinite; flex-shrink:0; }
.watchparty-sync.is-offline::before { background:#6b7280; animation:none; }
.watchparty-sync.is-offline { color:var(--text-dim); background:rgba(255,255,255,.04); }
@keyframes watchparty-sync-pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
.watchparty-btn { width:100%; padding:10px; border:1px solid rgba(61,220,132,.4); border-radius:12px; background:rgba(61,220,132,.1); color:#7dffb0; font:600 12px var(--font-body); cursor:pointer; transition:all .15s ease; margin-bottom:8px; text-align:center; }
.watchparty-btn:hover { background:rgba(61,220,132,.2); }
.watchparty-btn--secondary { border-color:var(--border); background:var(--bg-panel); color:var(--text-dim); }
.watchparty-btn--secondary:hover { background:rgba(255,255,255,.06); color:var(--text); }
.watchparty-btn--danger { border-color:rgba(255,90,90,.35); background:rgba(255,90,90,.1); color:#ff7a7a; }
.watchparty-btn--danger:hover { background:rgba(255,90,90,.2); }
.watchparty-join { display:grid; gap:10px; padding:20px 0; text-align:center; }
.watchparty-join input { padding:10px 14px; border:1px solid var(--border); border-radius:12px; background:var(--bg-panel); color:var(--text); font:13px var(--font-body); text-align:center; }
.watchparty-join input:focus { outline:2px solid rgba(61,220,132,.5); outline-offset:1px; }
.watchparty-progress { margin-top:12px; }
.watchparty-progress h4 { font:600 11px var(--font-mono); color:var(--text-dim); letter-spacing:.5px; text-transform:uppercase; margin:0 0 8px; }
.watchparty-progress__bar { height:6px; border-radius:3px; background:rgba(255,255,255,.08); overflow:hidden; margin-bottom:4px; }
.watchparty-progress__fill { height:100%; border-radius:3px; transition:width .3s ease; }
.watchparty-progress__label { font:10px var(--font-mono); color:var(--text-faint); }
.watchparty-empty { text-align:center; padding:24px 0; color:var(--text-dim); }
.watchparty-empty strong { display:block; font:600 13px var(--font-body); color:var(--text); margin-bottom:4px; }
.watchparty-empty small { font:11px var(--font-body); }
.watchparty-note { margin-top:10px; padding:8px 10px; border-radius:8px; background:rgba(34,211,238,.06); border:1px solid rgba(34,211,238,.15); font:10px var(--font-body); color:rgba(34,211,238,.7); line-height:1.5; }
.watchparty-copied { position:fixed; bottom:20px; left:50%; transform:translateX(-50%); padding:8px 16px; border-radius:999px; background:rgba(61,220,132,.9); color:#0a1a10; font:600 12px var(--font-body); z-index:999; pointer-events:none; animation:watchparty-toast .8s ease forwards; }
@keyframes watchparty-toast { 0% { opacity:0; transform:translateX(-50%) translateY(8px); } 15% { opacity:1; transform:translateX(-50%) translateY(0); } 70% { opacity:1; } 100% { opacity:0; } }
.watchparty-progress-compare { margin-top:14px; }
.watchparty-progress-compare h4 { font:600 11px var(--font-mono); color:var(--text-dim); letter-spacing:.5px; text-transform:uppercase; margin:0 0 10px; }
.watchparty-compare-row { display:flex; align-items:center; gap:8px; margin-bottom:8px; }
.watchparty-compare-row__name { width:90px; font:600 11px var(--font-body); color:var(--text); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex-shrink:0; }
.watchparty-compare-row__bar { flex:1; height:6px; border-radius:3px; background:rgba(255,255,255,.08); overflow:hidden; }
.watchparty-compare-row__fill { height:100%; border-radius:3px; transition:width .3s ease; }
.watchparty-compare-row__pct { width:36px; text-align:right; font:10px var(--font-mono); color:var(--text-dim); flex-shrink:0; }
`;

  let panel = null;
  let open = false;
  let party = null;
  let syncTimer = null;

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
  // Party code generation
  // ------------------------------------------------------------

  function generateCode() {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return code;
  }

  // ------------------------------------------------------------
  // Party state persistence
  // ------------------------------------------------------------

  function storageKey(code) {
    return STORAGE_PREFIX + code;
  }

  function saveParty(state) {
    try {
      localStorage.setItem(storageKey(state.code), JSON.stringify(state));
      localStorage.setItem(PARTY_KEY_CURRENT, state.code);
    } catch (e) { /* storage unavailable */ }
  }

  function loadParty(code) {
    try {
      const raw = localStorage.getItem(storageKey(code));
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return null;
  }

  function loadCurrentParty() {
    try {
      const code = localStorage.getItem(PARTY_KEY_CURRENT);
      if (code) return loadParty(code);
    } catch (e) { /* ignore */ }
    return null;
  }

  function clearCurrentParty() {
    try { localStorage.removeItem(PARTY_KEY_CURRENT); } catch (e) { /* ignore */ }
  }

  // ------------------------------------------------------------
  // Simulated sync — read localStorage every 3 seconds.
  // In a connected setup, this syncs via WebSocket in real-time.
  // ------------------------------------------------------------

  function startSync() {
    stopSync();
    syncTimer = window.setInterval(pollSync, SYNC_INTERVAL);
  }

  function stopSync() {
    if (syncTimer) { window.clearInterval(syncTimer); syncTimer = null; }
  }

  function pollSync() {
    if (!party) return;
    const fresh = loadParty(party.code);
    if (!fresh) return;
    if (fresh.syncVersion !== party.syncVersion) {
      party = fresh;
      renderBody();
    }
  }

  function bumpSync() {
    if (!party) return;
    party.syncVersion = (party.syncVersion || 0) + 1;
    saveParty(party);
  }

  // ------------------------------------------------------------
  // Local journey snapshot
  // ------------------------------------------------------------

  function localJourneyIds() {
    const c = core();
    if (!c || !c.state || !c.state.journey) return [];
    return Object.keys(c.state.journey).filter((id) => c.state.journey[id] === "watched");
  }

  function localWatchlistIds() {
    const c = core();
    if (!c || !c.watchlist) return [];
    const wl = c.watchlist();
    return Array.isArray(wl) ? wl : (wl instanceof Set ? [...wl] : []);
  }

  function totalReleasedMovies() {
    const c = core();
    if (!c || !c.data) return 0;
    const data = c.data();
    if (!data || !data.movies) return 0;
    return data.movies.filter((m) => m.status === "released").length;
  }

  // ------------------------------------------------------------
  // Create party
  // ------------------------------------------------------------

  function createParty(hostName) {
    const code = generateCode();
    const name = (hostName || "").trim() || "Host";
    party = {
      code: code,
      host: true,
      created: Date.now(),
      members: [{ name: name, watched: localJourneyIds() }],
      syncVersion: 1,
    };
    saveParty(party);
    startSync();
    renderBody();
    return code;
  }

  // ------------------------------------------------------------
  // Join party
  // ------------------------------------------------------------

  function joinParty(code, memberName) {
    const existing = loadParty(code);
    if (!existing) return false;
    const name = (memberName || "").trim() || "Guest";
    const alreadyMember = existing.members.some((m) => m.name === name);
    if (!alreadyMember) {
      existing.members.push({ name: name, watched: localJourneyIds() });
    }
    existing.syncVersion = (existing.syncVersion || 0) + 1;
    party = existing;
    saveParty(party);
    startSync();
    renderBody();
    return true;
  }

  // ------------------------------------------------------------
  // Leave party
  // ------------------------------------------------------------

  function leaveParty() {
    if (!party) return;
    if (party.host) {
      try { localStorage.removeItem(storageKey(party.code)); } catch (e) { /* ignore */ }
    }
    party = null;
    stopSync();
    clearCurrentParty();
    renderBody();
  }

  // ------------------------------------------------------------
  // Push local progress to party
  // ------------------------------------------------------------

  function syncProgress() {
    if (!party) return;
    const watched = localJourneyIds();
    const memberIndex = party.members.findIndex((m) => {
      return party.host ? party.members.indexOf(m) === 0 : m.name !== "Host";
    });
    if (memberIndex >= 0) {
      party.members[memberIndex].watched = watched;
    }
    bumpSync();
    saveParty(party);
    renderBody();
  }

  // ------------------------------------------------------------
  // Share URL
  // ------------------------------------------------------------

  function shareUrl() {
    if (!party) return "";
    const url = new URL(window.location.href);
    url.searchParams.set("party", party.code);
    return url.toString();
  }

  function copyShareLink() {
    const url = shareUrl();
    if (!url) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(showCopiedToast).catch(() => fallbackCopy(url));
    } else {
      fallbackCopy(url);
    }
  }

  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showCopiedToast(); } catch (e) { /* ignore */ }
    ta.remove();
  }

  function showCopiedToast() {
    const toast = document.createElement("div");
    toast.className = "watchparty-copied";
    toast.textContent = "Link copied";
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 900);
  }

  // ------------------------------------------------------------
  // Avatar helpers
  // ------------------------------------------------------------

  function avatarColor(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    return String(name).trim().substring(0, 2).toUpperCase() || "??";
  }

  // ------------------------------------------------------------
  // Render
  // ------------------------------------------------------------

  function renderBody() {
    if (!panel) return;
    const body = panel.querySelector(".watchparty-panel__body");
    if (!body) return;

    if (!party) {
      renderLanding(body);
      return;
    }

    const total = totalReleasedMovies();
    const memberHtml = party.members.map((m, i) => {
      const color = avatarColor(m.name);
      const ini = initials(m.name);
      const watchedCount = Array.isArray(m.watched) ? m.watched.length : 0;
      const label = i === 0 && party.host ? "Host" : "Member";
      return `<div class="watchparty-member">
        <div class="watchparty-member__avatar" style="background:${color}">${escapeHtml(ini)}</div>
        <div class="watchparty-member__info">
          <strong>${escapeHtml(m.name)}</strong>
          <small>${label} · ${watchedCount} watched</small>
        </div>
        <span class="watchparty-member__badge">${watchedCount}/${total}</span>
      </div>`;
    }).join("");

    const progressHtml = party.members.map((m) => {
      const color = avatarColor(m.name);
      const count = Array.isArray(m.watched) ? m.watched.length : 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      return `<div class="watchparty-compare-row">
        <span class="watchparty-compare-row__name">${escapeHtml(m.name)}</span>
        <div class="watchparty-compare-row__bar"><div class="watchparty-compare-row__fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="watchparty-compare-row__pct">${pct}%</span>
      </div>`;
    }).join("");

    body.innerHTML = `
      <div class="watchparty-code">
        <span>${escapeHtml(party.code)}</span>
        <small>Share this code or link to invite friends</small>
      </div>
      <div class="watchparty-sync">Synced · v${party.syncVersion}</div>
      <h4>Members</h4>
      <div class="watchparty-members">${memberHtml}</div>
      <div class="watchparty-progress-compare">
        <h4>Watch Progress</h4>
        ${progressHtml}
      </div>
      <button type="button" class="watchparty-btn" data-wp-action="sync">Sync My Progress</button>
      <button type="button" class="watchparty-btn watchparty-btn--secondary" data-wp-action="share">Share Invite Link</button>
      <button type="button" class="watchparty-btn watchparty-btn--danger" data-wp-action="leave">Leave Party</button>
      <p class="watchparty-note">Sync is simulated with localStorage for this demo. In a connected setup, this syncs via WebSocket in real-time.</p>
    `;
  }

  function renderLanding(container) {
    const urlParam = new URLSearchParams(window.location.search).get("party");
    const hasJoinCode = !!urlParam;

    if (hasJoinCode) {
      container.innerHTML = `
        <div class="watchparty-empty">
          <strong>Join a Watch Party</strong>
          <small>You've been invited to party <b>${escapeHtml(urlParam)}</b></small>
        </div>
        <div class="watchparty-join">
          <input type="text" id="wp-join-name" placeholder="Your name" maxlength="30" autocomplete="off">
          <button type="button" class="watchparty-btn" data-wp-action="join-url">Join Party</button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="watchparty-empty">
        <strong>No active Watch Party</strong>
        <small>Start one to watch the Marvel timeline with friends, or enter a code to join an existing party.</small>
      </div>
      <div class="watchparty-join">
        <input type="text" id="wp-create-name" placeholder="Your name" maxlength="30" autocomplete="off">
        <button type="button" class="watchparty-btn" data-wp-action="create">Create Party</button>
      </div>
      <div class="watchparty-join" style="padding-top:4px">
        <input type="text" id="wp-join-code" placeholder="Enter party code" maxlength="6" autocomplete="off" style="text-transform:uppercase;letter-spacing:3px">
        <input type="text" id="wp-join-name-alt" placeholder="Your name" maxlength="30" autocomplete="off">
        <button type="button" class="watchparty-btn watchparty-btn--secondary" data-wp-action="join">Join Party</button>
      </div>
    `;
  }

  // ------------------------------------------------------------
  // Event handling
  // ------------------------------------------------------------

  function handleAction(action) {
    if (action === "create") {
      const nameInput = panel && panel.querySelector("#wp-create-name");
      createParty(nameInput ? nameInput.value : "");
      return;
    }
    if (action === "join") {
      const codeInput = panel && panel.querySelector("#wp-join-code");
      const nameInput = panel && panel.querySelector("#wp-join-name-alt");
      const code = codeInput ? codeInput.value.trim().toUpperCase() : "";
      const name = nameInput ? nameInput.value : "";
      if (code.length !== 6) return;
      const ok = joinParty(code, name);
      if (!ok) {
        const empty = panel && panel.querySelector(".watchparty-empty strong");
        if (empty) empty.textContent = "Party not found — check the code and try again.";
      }
      return;
    }
    if (action === "join-url") {
      const nameInput = panel && panel.querySelector("#wp-join-name");
      const urlParam = new URLSearchParams(window.location.search).get("party");
      if (urlParam) joinParty(urlParam, nameInput ? nameInput.value : "");
      return;
    }
    if (action === "sync") {
      syncProgress();
      return;
    }
    if (action === "share") {
      copyShareLink();
      return;
    }
    if (action === "leave") {
      leaveParty();
      return;
    }
  }

  // ------------------------------------------------------------
  // Panel creation
  // ------------------------------------------------------------

  function ensureStyles() {
    if (document.getElementById("watchparty-styles")) return;
    const style = document.createElement("style");
    style.id = "watchparty-styles";
    style.textContent = INLINE_CSS;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    if (panel) return panel;
    ensureStyles();

    panel = document.createElement("aside");
    panel.className = "watchparty-panel experience-panel";
    panel.id = "watchparty-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "watchparty-title");
    panel.hidden = true;

    panel.innerHTML = `
      <button type="button" class="experience-panel__close watchparty-panel__close" id="watchparty-panel-close" aria-label="Close watch party">&times;</button>
      <div class="experience-panel__head">
        <span class="experience-panel__eyebrow">Social</span>
        <h2 id="watchparty-title">Watch Party</h2>
      </div>
      <div class="watchparty-panel__body"></div>
    `;

    document.body.appendChild(panel);

    panel.querySelector(".watchparty-panel__close").addEventListener("click", closePanel);
    panel.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-wp-action]");
      if (btn) handleAction(btn.dataset.wpAction);
    });

    return panel;
  }

  // ------------------------------------------------------------
  // Open / Close / Toggle
  // ------------------------------------------------------------

  function openPanel() {
    ensurePanel();
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    party = loadCurrentParty();
    if (party) startSync();
    renderBody();
  }

  function closePanel() {
    open = false;
    if (panel) panel.classList.remove("is-open");
    window.setTimeout(() => {
      if (!open && panel) panel.hidden = true;
    }, 220);
  }

  function toggle(force) {
    if (typeof force === "boolean") {
      if (force) openPanel();
      else closePanel();
      return;
    }
    if (open) closePanel();
    else openPanel();
  }

  // ------------------------------------------------------------
  // Init — auto-join from ?party= URL param
  // ------------------------------------------------------------

  function init() {
    const urlParam = new URLSearchParams(window.location.search).get("party");
    if (urlParam && urlParam.length === 6) {
      const existing = loadParty(urlParam);
      if (existing) {
        party = existing;
        saveParty(party);
        startSync();
      }
    } else {
      party = loadCurrentParty();
      if (party) startSync();
    }

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) closePanel();
    }, true);
  }

  function whenReady() {
    if (!window.NexusCore || !window.NexusCore.data || !window.NexusCore.data()) {
      window.addEventListener("nexus-ready", init, { once: true });
      return;
    }
    init();
  }

  whenReady();

  window.WatchParty = { toggle, open: openPanel, close: closePanel };
})();
