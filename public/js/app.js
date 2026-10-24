// ============================================================
// Marvel Nexus
// Renders every movie as an energy node on a colored timeline
// stream, one per franchise, with merge connectors where
// universes actually cross over (Homecoming, Deadpool &
// Wolverine, ...). Runs through the NexusCore bridge.
// ============================================================

const LANE_HEIGHT = 160;
const TOP_PAD = 46;
const BOTTOM_PAD = 40;
const LEFT_PAD = 70;
const RIGHT_PAD = 90;
const NODE_R = 7.25;
const MILESTONE_R = 11;
const NODE_GAP = 104;
const DESKTOP_MIN_WIDTH = 1024;
const { yearFraction, movieYearValue, routeMatches, formatMoney } = window.MCUUtils;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

// ============================================================
// TMDB Configuration
// ============================================================

// w185 for the small hover thumbnail (it only ever renders at ~170px wide —
// no reason to ship a w500 image for that), w500 for the bigger detail-panel image.
const TMDB_THUMB_BASE = "https://image.tmdb.org/t/p/w185";
const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500";
const JOURNEY_STORAGE_KEY = "marvel-nexus:journey:v1";
const JOURNEY_STATUSES = new Set(["watched", "watching", "planned"]);
const WATCHLIST_STORAGE_KEY = "marvel-nexus:watchlist:v1";
const DOOMSDAY_RELEASE = new Date("2026-12-18T00:00:00");

// Where-to-watch registry. `logoSlug` is a SimpleIcons slug rendered from
// cdn.simpleicons.org; titles without a SimpleIcons glyph fall back to a
// colored monogram chip. `url` builds a platform search link from a
// URL-encoded title so chips always resolve.
const OTT_PLATFORMS = {
  disneyplus: {
    name: "Disney+",
    color: "#113CCF",
    logoSlug: null,
    url: (q) => `https://www.disneyplus.com/search/${q}`
  },
  netflix: {
    name: "Netflix",
    color: "#E50914",
    logoSlug: "netflix",
    url: (q) => `https://www.netflix.com/search?q=${q}`
  },
  primevideo: {
    name: "Prime Video",
    color: "#00A8E1",
    logoSlug: null,
    url: (q) => `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${q}`
  },
  appletv: {
    name: "Apple TV",
    color: "#FFFFFF",
    logoSlug: "appletv",
    url: (q) => `https://tv.apple.com/search?term=${q}`
  },
  youtube: {
    name: "YouTube",
    color: "#FF0000",
    logoSlug: "youtube",
    url: (q) => `https://www.youtube.com/results?search_query=${q}`
  }
};

const state = {
  data: null,
  sortMode: "story", // "story" | "release"
  zoom: window.innerWidth >= DESKTOP_MIN_WIDTH ? .55 : .5,
  hiddenLines: new Set(),
  query: "",
  crossoverOnly: false,
  route: "",
  mobileFitApplied: false,
  modeNoteDismissed: false,
  crossoverPath: null,
  journey: {},
  watchlist: new Set(), // saved-title ids for the watchlist / planner
  selectedUniverse: "",
  network: null, // { name, role, color, ids: [] } — cast/character highlight
  phaseFilter: "",
  eraMode: false,
  collapsedEras: new Set(),
  priorityFilter: "", // "" | "essential" | "recommended"
  typeFilter: "", // "" | "movie" | "series"
  unwatchedOnly: false,
  spoilerSafe: false,
  includeCredits: true,
  planner: { weeklyHours: 8, targetDate: "" },
  detailOpen: null,
  pinnedStar: null, // constellation root pinned via the star menu (survives mouseleave)
  focusedStar: null, // last hovered/focused node id — used by , / . star hopping
  butterflySource: null, // "what if this title never happened" — causal downstream shatters
  teaserScan: null, // post-credit scanner — source whose setup threads are traced forward
  soundEnabled: true, // atlas hums as you travel (pentatonic plucks per star)
  gauntlet: new Set(), // collected Infinity Stone ids (persisted)
  visited: new Set(), // movie ids the user has opened in detail
  variantScan: false, // variant scanner — competing titles flagged across lanes
  snapped: false, // whether the gauntlet snap has been triggered
  playhead: null, // timeline playhead scrubber — frontier story year or null
  dna: null, // shared-DNA finder: { actor, character, ids: [] }
  dossierOpen: null, // open TVA dossier for a title
  stones: [], // Infinity Stones dataset (loaded via loadStonesData)
  achievements: new Set(), // unlocked achievement ids (persisted)
  commute: false, // offline commute reading list
  commuteQuery: "", // commute-mode text filter
  commuteOrder: "story", // commute sort: "story" | "release"
  optimizer: "story", // watch-order optimizer mode: "story" | "release" | "essential"
};

// ============================================================
// Atlas sound toggle — controls the ambient YouTube music player.
// (Procedural WebAudio sound effects were removed in the Doomsday
// pass; the toggle now drives only the ambient music stream.)
// ============================================================

const SOUND_KEY = "nexus.sound";

function toggleSound() {
  state.soundEnabled = !state.soundEnabled;
  try { localStorage.setItem(SOUND_KEY, state.soundEnabled ? "on" : "off"); } catch { /* storage unavailable */ }
  updateSoundButton();
  syncMusicPlayback();
}

function updateSoundButton() {
  if (!els.soundToggle) return;
  els.soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
  els.soundToggle.classList.toggle("is-muted", !state.soundEnabled);
  els.soundToggle.title = state.soundEnabled ? "Mute the atlas" : "Play the atlas";
}

// ------------------------------------------------------------
// Ambient music — hidden YouTube player, looped, tied to the
// atlas sound toggle. Loads lazily on the first user gesture.
// ------------------------------------------------------------
const MUSIC_VIDEO_ID = "CbJ8yl-R56w";

let musicPlayer = null;
let musicApiLoading = false;

function loadYouTubeMusicApi() {
  if (musicApiLoading || musicPlayer || window.YT) return;
  musicApiLoading = true;
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  tag.async = true;
  tag.addEventListener("load", () => { musicApiLoading = false; });
  tag.addEventListener("error", () => { musicApiLoading = false; });
  document.head.appendChild(tag);
}

function syncMusicPlayback() {
  if (!state.soundEnabled) {
    if (musicPlayer) {
      try { musicPlayer.pauseVideo(); } catch (e) { /* player not ready */ }
    }
    return;
  }
  if (musicPlayer) {
    try {
      musicPlayer.unMute();
      musicPlayer.playVideo();
    } catch (e) { /* player not ready */ }
    return;
  }
  loadYouTubeMusicApi();
}

function kickstartMusicOnFirstGesture() {
  window.removeEventListener("pointerdown", kickstartMusicOnFirstGesture);
  window.removeEventListener("keydown", kickstartMusicOnFirstGesture);
  window.removeEventListener("touchend", kickstartMusicOnFirstGesture);
  if (state.soundEnabled) syncMusicPlayback();
}

function bootMusicPlayer() {
  const host = document.getElementById("music-player");
  if (!host || musicPlayer || !window.YT) return;
  musicPlayer = new YT.Player("music-player", {
    videoId: MUSIC_VIDEO_ID,
    width: "1",
    height: "1",
    playerVars: {
      autoplay: 0,
      controls: 0,
      disablekb: 1,
      fs: 0,
      playsinline: 1,
      loop: 1,
      playlist: MUSIC_VIDEO_ID
    },
    events: {
      onReady: () => {
        if (state.soundEnabled) {
          try { musicPlayer.setVolume(24); musicPlayer.playVideo(); } catch (e) { /* noop */ }
        }
      },
      onError: () => { /* music unavailable — ignore silently */ }
    }
  });
}

window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  bootMusicPlayer();
};

// ============================================================
// Infinity Stones — every gem's journey across the timeline.
// Loaded from data/stones.json; used by the Stones pathway
// (threads + glow) and the TVA dossier.
// ============================================================

let stoneByMovie = new Map(); // movieId -> [{id,name,alias,color,note}]
let castEntries = null; // full Cast & Character list (actor/character/movies)
let castByMovieCache = null; // movieId -> [{actor,character,id}]

function stonesFor(movieId) {
  return stoneByMovie.get(movieId) || [];
}

function allCastEntries() {
  if (castEntries) return castEntries;
  try {
    const raw = window.CAST_INLINE;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    castEntries = (data && data.cast) || [];
  } catch {
    castEntries = [];
  }
  return castEntries;
}

function castForMovieCached(movieId) {
  if (!castByMovieCache) {
    castByMovieCache = new Map();
    allCastEntries().forEach((entry) => {
      (entry.movies || []).forEach((id) => {
        if (!castByMovieCache.has(id)) castByMovieCache.set(id, []);
        castByMovieCache.get(id).push(entry);
      });
    });
  }
  return castByMovieCache.get(movieId) || [];
}

function loadStonesData() {
  try {
    const raw = window.STONES_INLINE;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    state.stones = (data && data.stones) || [];
  } catch {
    state.stones = [];
  }
  stoneByMovie = new Map();
  (state.stones || []).forEach((stone) => {
    (stone.appearances || []).forEach((a) => {
      if (!stoneByMovie.has(a.movieId)) stoneByMovie.set(a.movieId, []);
      stoneByMovie.get(a.movieId).push({
        id: stone.id,
        name: stone.name,
        alias: stone.alias,
        color: stone.color,
        note: a.note,
      });
    });
  });
}

const PHASE_NUM = { "Phase One": "1", "Phase Two": "2", "Phase Three": "3", "Phase Four": "4", "Phase Five": "5", "Phase Six": "6" };
const phaseNumber = (phase) => (PHASE_NUM[phase] ? Number(PHASE_NUM[phase]) : phase);

const PHASE_COLORS = {
  "Phase One": "#3ddc84",
  "Phase Two": "#ffb454",
  "Phase Three": "#ffd166",
  "Phase Four": "#22d3ee",
  "Phase Five": "#7dd3a8",
  "Phase Six": "#ff5da2",
};

/* Watch priority tiers — every title is Essential ★, Recommended ✦, or Optional.
   Editorial, tuned for the Avengers: Doomsday payoff. Defaults treat MCU +
   Disney+ titles as Recommended; the sets below promote/demote from there. */
const NEXUS_ESSENTIAL_IDS = new Set([
  "iron-man",
  "thor",
  "captain-america-the-first-avenger",
  "the-avengers",
  "captain-america-the-winter-soldier",
  "guardians-of-the-galaxy",
  "avengers-age-of-ultron",
  "ant-man",
  "captain-america-civil-war",
  "doctor-strange",
  "thor-ragnarok",
  "black-panther",
  "avengers-infinity-war",
  "captain-marvel",
  "ant-man-and-the-wasp",
  "avengers-endgame",
  "spider-man-no-way-home",
  "doctor-strange-in-the-multiverse-of-madness",
  "series-wandavision-season-1",
  "series-loki-season-1",
  "series-loki-season-2",
  "series-what-if-season-1",
  "series-what-if-season-2",
  "deadpool-and-wolverine",
  "the-fantastic-four-first-steps",
  "avengers-doomsday",
  "avengers-secret-wars",
]);

const NEXUS_OPTIONAL_IDS = new Set([
  "the-incredible-hulk",
  "iron-man-3",
  "thor-the-dark-world",
  "guardians-of-the-galaxy-vol-2",
  "spider-man-far-from-home",
  "black-widow",
  "eternals",
  "thor-love-and-thunder",
  "the-marvels",
  "spider-man-brand-new-day",
  "blade-mcu",
  "series-i-am-groot-season-1",
  "series-i-am-groot-season-2",
  "series-moon-knight-season-1",
  "series-ms-marvel-season-1",
  "series-she-hulk-attorney-at-law-season-1",
  "series-secret-invasion-season-1",
  "series-echo-season-1",
  "series-ironheart-season-1",
  "series-marvel-zombies-season-1",
  "series-marvel-zombies-season-2",
  "series-wonder-man-season-1",
  "series-wonder-man-season-2",
]);

function priorityFor(movie) {
  if (NEXUS_ESSENTIAL_IDS.has(movie.id)) return "essential";
  if (NEXUS_OPTIONAL_IDS.has(movie.id)) return "optional";
  if (movie.line === "xmen") return "essential";
  return movie.line === "mcu" || movie.line === "disneyPlus" ? "recommended" : "optional";
}

const PRIORITY_META = {
  essential: { label: "Essential", mark: "★" },
  recommended: { label: "Recommended", mark: "✦" },
  optional: { label: "Optional", mark: "·" },
};

function priorityBadgeHtml(movie) {
  const p = priorityFor(movie);
  if (p === "optional") return "";
  const meta = PRIORITY_META[p];
  return `<span class="priority-badge priority-${p}" title="${meta.label} — pays off in Avengers: Doomsday">${meta.mark} ${meta.label}</span>`;
}

let entrancePlayed = false;

const els = {};
let renderGeneration = 0;
let lastTimelineScale = { minYear: 0, maxYear: 1, pxPerYear: 54 };
let doomsdayCountdownTimer = 0;
let doomsdayDrag = null;
let suppressDoomsdayClick = false;
let gestureStartZoom = 1;
const touchPoints = new Map();
let touchGesture = null;
let suppressTimelineClickUntil = 0;

document.addEventListener("DOMContentLoaded", init);

// --- Lock to landscape on mobile/tablet ---
if (screen.orientation && screen.orientation.lock) {
  const isMobileOrTablet = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  if (isMobileOrTablet) {
    screen.orientation.lock("landscape").catch(() => {});
  }
}

async function init() {
  els.scrollArea = document.getElementById("scroll-area");
  els.timelineWrapper = document.querySelector(".timeline-wrapper");
  els.timelineStage = document.getElementById("timeline-stage");
  els.timelineContent = document.getElementById("timeline-content");
  els.canvas = document.getElementById("canvas");
  els.svg = document.getElementById("connectors");
  els.searchInput = document.getElementById("search-input");
  els.modeNote = document.getElementById("mode-note");
  els.modeNoteClose = document.getElementById("mode-note-close");
  els.overlay = document.getElementById("overlay");
  els.detailPanel = document.getElementById("detail-panel");
  els.detailContent = document.getElementById("detail-content");
  els.detailClose = document.getElementById("detail-close");
  els.posterPreview = document.getElementById("poster-preview");
  els.posterPreviewImg = document.getElementById("poster-preview-img");
  els.posterPreviewTitle = document.getElementById("poster-preview-title");
  els.posterPreviewYear = document.getElementById("poster-preview-year");
  els.posterPreviewRuntime = document.getElementById("poster-preview-runtime");
  els.posterPreviewRating = document.getElementById("poster-preview-rating");
  els.posterPreviewBoxOffice = document.getElementById("poster-preview-box-office");
  els.posterPreviewMetricLabel = document.getElementById("poster-preview-metric-label");
  els.stationTooltip = document.getElementById("station-tooltip");
  els.lastUpdated = document.getElementById("last-updated");
  els.resultCount = document.getElementById("result-count");
  els.crossoverPathBar = document.getElementById("crossover-path-bar");
  els.crossoverPathSummary = document.getElementById("crossover-path-summary");
  els.crossoverPathClear = document.getElementById("crossover-path-clear");
  els.butterflyBar = document.getElementById("butterfly-bar");
  els.butterflySummary = document.getElementById("butterfly-summary");
  els.butterflyClear = document.getElementById("butterfly-clear");
  els.teaserBar = document.getElementById("teaser-bar");
  els.teaserSummary = document.getElementById("teaser-summary");
  els.teaserClear = document.getElementById("teaser-clear");
  els.soundToggle = document.getElementById("sound-toggle");
  els.gauntletBtn = document.getElementById("gauntlet-btn");
  els.gauntletCount = document.getElementById("gauntlet-count");
  els.dnaBar = document.getElementById("dna-bar");
  els.dnaSummary = document.getElementById("dna-summary");
  els.dnaClear = document.getElementById("dna-clear");
  els.tvaDossier = document.getElementById("tva-dossier");
  els.tvaDossierClose = document.getElementById("tva-dossier-close");
  els.tvaDossierContent = document.getElementById("tva-dossier-content");
  els.dnaPicker = document.getElementById("dna-picker");
  els.dnaPickerList = document.getElementById("dna-picker-list");
  els.dnaPickerClose = document.getElementById("dna-picker-close");
  els.routeFilter = document.getElementById("route-filter");
  els.universePicker = document.getElementById("universe-picker");
  els.universePickerTrigger = document.getElementById("universe-picker-trigger");
  els.universePickerValue = document.getElementById("universe-picker-value");
  els.universePickerRing = document.getElementById("universe-picker-ring");
  els.universePickerMenu = document.getElementById("universe-picker-menu");
  els.journeyLaunch = document.getElementById("journey-launch");
  els.journeyLaunchProgress = document.getElementById("journey-launch-progress");
  els.journeyDialog = document.getElementById("journey-dialog");
  els.journeyClose = document.getElementById("journey-close");
  els.journeyDashboard = document.getElementById("journey-dashboard");
  els.journeyShare = document.getElementById("journey-share");
  els.journeyExport = document.getElementById("journey-export");
  els.journeyImport = document.getElementById("journey-import");
  els.journeyImportFile = document.getElementById("journey-import-file");
  els.journeyClear = document.getElementById("journey-clear");
  els.zoomIn = document.getElementById("zoom-in");
  els.zoomOut = document.getElementById("zoom-out");
  els.zoomReset = document.getElementById("zoom-reset");
  els.zoomFit = document.getElementById("zoom-fit");
  els.doomsdayCountdown = document.getElementById("doomsday-countdown");
  els.doomsdayCountdownOpen = document.getElementById("doomsday-countdown-open");
  els.doomsdayCountdownClose = document.getElementById("doomsday-countdown-close");
  els.doomsdayDays = document.getElementById("doomsday-days");
  els.doomsdayHours = document.getElementById("doomsday-hours");
  els.doomsdayMinutes = document.getElementById("doomsday-minutes");
  els.doomsdaySeconds = document.getElementById("doomsday-seconds");
  els.networkPathBar = document.getElementById("network-path-bar");
  els.networkPathGem = document.getElementById("network-path-gem");
  els.networkPathSummary = document.getElementById("network-path-summary");
  els.networkPathClear = document.getElementById("network-path-clear");
  els.castLaunch = document.getElementById("cast-launch");
  els.eraSectionToggle = document.getElementById("era-section-toggle");
  els.phaseChips = document.getElementById("phase-chips");
  els.plannerHours = document.getElementById("planner-hours");
  els.plannerTarget = document.getElementById("planner-target");
  els.plannerCredits = document.getElementById("planner-credits");
  els.plannerSpoilers = document.getElementById("planner-spoilers");
  els.plannerEta = document.getElementById("planner-eta");
  els.plannerStats = document.getElementById("planner-stats");
  els.plannerSchedule = document.getElementById("planner-schedule");
  els.plannerGenerate = document.getElementById("planner-generate");
  els.journeyUpcoming = document.getElementById("journey-upcoming");
  els.unwatchedToggle = document.getElementById("unwatched-toggle");
  els.variantBtn = document.getElementById("variant-btn");
  els.variantBar = document.getElementById("variant-bar");
  els.variantSummary = document.getElementById("variant-summary");
  els.variantClear = document.getElementById("variant-clear");
  els.achievementsBtn = document.getElementById("achievements-btn");
  els.achievementsCount = document.getElementById("achievements-count");
  els.achievementsPanel = document.getElementById("achievements-panel");
  els.achievementsPanelClose = document.getElementById("achievements-panel-close");
  els.achievementsList = document.getElementById("achievements-list");
  els.achievementsProgress = document.getElementById("achievements-progress");
  els.achievementToast = document.getElementById("achievement-toast");
  els.commuteBtn = document.getElementById("commute-btn");
  els.commuteMode = document.getElementById("commute-mode");
  els.commuteModeClose = document.getElementById("commute-mode-close");
  els.commuteModeCount = document.getElementById("commute-mode-count");
  els.commuteList = document.getElementById("commute-list");
  els.commuteSearch = document.getElementById("commute-search");
  els.commuteOrder = document.getElementById("commute-order");
  els.playheadBtn = document.getElementById("playhead-btn");
  els.playheadBar = document.getElementById("playhead-bar");
  els.playheadYear = document.getElementById("playhead-year");
  els.playheadClear = document.getElementById("playhead-clear");
  els.playheadTrack = document.getElementById("playhead-track");
  els.playheadHandle = document.getElementById("playhead-handle");
  els.statsBtn = document.getElementById("stats-btn");
  els.statsPanel = document.getElementById("stats-panel");
  els.statsPanelClose = document.getElementById("stats-panel-close");
  els.statsContent = document.getElementById("stats-content");
  els.optimizerBtn = document.getElementById("optimizer-btn");
  els.optimizerPanel = document.getElementById("optimizer-panel");
  els.optimizerPanelClose = document.getElementById("optimizer-panel-close");
  els.optimizerModes = document.getElementById("optimizer-modes");
  els.optimizerList = document.getElementById("optimizer-list");
  els.optimizerTotal = document.getElementById("optimizer-total");
  els.gauntletPanel = document.getElementById("gauntlet-panel");
  els.gauntletPanelClose = document.getElementById("gauntlet-panel-close");
  els.gauntletTabVisual = document.getElementById("gauntlet-tab-visual");
  els.gauntletTabTimeline = document.getElementById("gauntlet-tab-timeline");
  els.gauntletVisual = document.getElementById("gauntlet-visual");
  els.gauntletTimeline = document.getElementById("gauntlet-timeline");
  els.gauntletStatus = document.getElementById("gauntlet-status");
  els.gauntletReset = document.getElementById("gauntlet-reset");
  els.snapOverlay = document.getElementById("snap-overlay");

  try {
    let raw;
    try {
      const response = await fetch("data/movies.json");
      if (!response.ok) throw new Error(`Movie data returned ${response.status}`);
      raw = await response.text();
      state.data = JSON.parse(raw);
    } catch (fetchError) {
      // Opening index.html directly from disk (file://) blocks fetch(), so we
      // fall back to the bundled copy of the dataset loaded via <script> tag.
      if (typeof window.MOVIES_INLINE === "undefined") throw fetchError;
      state.data = typeof window.MOVIES_INLINE === "string"
        ? JSON.parse(window.MOVIES_INLINE)
        : window.MOVIES_INLINE;
    }

    hydrateStateFromUrl();
    buildPhaseChips();
    syncEraControls();
    loadJourney();
    loadWatchlist();
    buildStarMenu();
    loadStonesData();
    loadGauntlet();
    loadVisited();
    loadAchievements();
    updateWatchlistControls();
    if (els.lastUpdated) els.lastUpdated.textContent = state.data.meta.lastUpdated;
    buildUniversePicker();
    updateJourneySummary();
    bindEvents();
    // The countdown intentionally returns on every page visit. Dismissal and
    // drag position last only until the page is reloaded.
    resetDoomsdayPositionForViewport();
    startDoomsdayCountdown();
    // Let the browser paint the app shell before building the timeline.
    requestAnimationFrame(render);
    window.dispatchEvent(new CustomEvent("nexus-ready"));
  } catch (error) {
    console.error("Unable to initialize Marvel Nexus:", error);
    window.dispatchEvent(new CustomEvent("nexus-ready"));
    els.canvas.innerHTML = `
      <div class="app-state app-state--error" role="alert">
        <strong>The timeline could not be loaded.</strong>
        <span>Check your connection, then refresh the page.</span>
      </div>`;
  }
}

function updateDoomsdayCountdown() {
  const remaining = Math.max(0, DOOMSDAY_RELEASE.getTime() - Date.now());
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  els.doomsdayDays.textContent = String(days).padStart(3, "0");
  els.doomsdayHours.textContent = String(hours).padStart(2, "0");
  els.doomsdayMinutes.textContent = String(minutes).padStart(2, "0");
  els.doomsdaySeconds.textContent = String(seconds).padStart(2, "0");

  if (!remaining) {
    els.doomsdayCountdown.classList.add("is-released");
    els.doomsdayCountdownOpen.setAttribute("aria-label", "Avengers: Doomsday is now in theaters. Open details.");
  }
}

function startDoomsdayCountdown() {
  updateDoomsdayCountdown();
  doomsdayCountdownTimer = window.setInterval(updateDoomsdayCountdown, 1000);
}

function clampDoomsdayPosition(left, top) {
  const margin = 8;
  const width = els.doomsdayCountdown.offsetWidth;
  const height = els.doomsdayCountdown.offsetHeight;
  return {
    left: Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin)),
    top: Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin)),
  };
}

function placeDoomsdayCountdown(left, top) {
  const position = clampDoomsdayPosition(left, top);
  els.doomsdayCountdown.style.right = "auto";
  els.doomsdayCountdown.style.left = `${position.left}px`;
  els.doomsdayCountdown.style.top = `${position.top}px`;
  return position;
}

function resetDoomsdayPositionForViewport() {
  if (window.innerWidth < 640) {
    els.doomsdayCountdown.style.removeProperty("left");
    els.doomsdayCountdown.style.removeProperty("right");
    els.doomsdayCountdown.style.removeProperty("top");
  }
}

function handleDoomsdayDragStart(event) {
  if (
    window.innerWidth < 640 ||
    event.pointerType === "touch" ||
    event.button !== 0 ||
    event.target.closest(".doomsday-countdown__close")
  ) return;
  const rect = els.doomsdayCountdown.getBoundingClientRect();
  placeDoomsdayCountdown(rect.left, rect.top);
  els.doomsdayCountdown.classList.add("is-dragging");
  els.doomsdayCountdown.setPointerCapture(event.pointerId);
  doomsdayDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: rect.left,
    top: rect.top,
    moved: false,
  };
}

function handleDoomsdayDragMove(event) {
  if (!doomsdayDrag || event.pointerId !== doomsdayDrag.pointerId) return;
  const deltaX = event.clientX - doomsdayDrag.startX;
  const deltaY = event.clientY - doomsdayDrag.startY;
  if (!doomsdayDrag.moved && Math.hypot(deltaX, deltaY) < 5) return;
  doomsdayDrag.moved = true;
  event.preventDefault();
  placeDoomsdayCountdown(doomsdayDrag.left + deltaX, doomsdayDrag.top + deltaY);
}

function handleDoomsdayDragEnd(event) {
  if (!doomsdayDrag || event.pointerId !== doomsdayDrag.pointerId) return;
  suppressDoomsdayClick = doomsdayDrag.moved;
  if (els.doomsdayCountdown.hasPointerCapture(event.pointerId)) {
    els.doomsdayCountdown.releasePointerCapture(event.pointerId);
  }
  const rect = els.doomsdayCountdown.getBoundingClientRect();
  els.doomsdayCountdown.classList.remove("is-dragging");
  placeDoomsdayCountdown(rect.left, rect.top);
  doomsdayDrag = null;
}

function lineById(id) {
  return state.data.lines.find((l) => l.id === id);
}

function movieById(id) {
  return state.data.movies.find((m) => m.id === id);
}

function laneOrder() {
  return [...state.data.lines]
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
    .map((line) => line.id);
}

function isCrossover(movie) {
  if (movie.joinsFrom?.length) return true;
  return (state.data.crossoverTeases || []).some(
    (tease) => tease.from === movie.id || tease.to === movie.id
  );
}

// Direct neighbours of a title across the cosmic web (one hop).
function constellationNeighbors(movieId) {
  const movie = movieById(movieId);
  const neighbors = new Set();
  const addEdge = (a, b) => {
    if (movieById(a) && movieById(b)) {
      neighbors.add(a);
      neighbors.add(b);
    }
  };
  (state.data.crossoverTeases || []).forEach(({ from, to }) => {
    if (from === movieId) addEdge(to, movieId);
    if (to === movieId) addEdge(from, movieId);
  });
  (state.data.timelineConnections || []).forEach(({ from, to }) => {
    if (from === movieId) addEdge(to, movieId);
    if (to === movieId) addEdge(from, movieId);
  });
  if (movie) {
    (movie.joinsFrom || []).forEach((lineId) => {
      state.data.movies
        .filter((candidate) => candidate.line === lineId)
        .forEach((candidate) => neighbors.add(candidate.id));
    });
  }
  return neighbors;
}

function lightConstellation(sourceNode, movie) {
  const lit = constellationNeighbors(movie.id);
  if (!lit.size) return;
  els.canvas.classList.add("is-constellation-mode");
  lit.forEach((connectedId) => {
    const connectedEl = els.canvas.querySelector(`.movie-node[data-id="${connectedId}"]`);
    if (connectedEl) connectedEl.classList.add("is-constellation-lit");
  });
  lightConstellationRoutes(lit);
}

function lightConstellationRoutes(lit) {
  els.svg.querySelectorAll(".connector-route").forEach((group) => {
    const on = lit.has(group.dataset.from) && lit.has(group.dataset.to);
    group.classList.toggle("is-constellation-lit", on);
  });
}

function dimConstellation() {
  const pinned = pinnedNeighbors();
  els.canvas.classList.remove("is-constellation-mode");
  els.canvas.querySelectorAll(".movie-node.is-constellation-lit").forEach((el) => {
    if (pinned && pinned.has(el.dataset.id)) return;
    el.classList.remove("is-constellation-lit");
  });
  els.svg.querySelectorAll(".connector-route.is-constellation-lit").forEach((group) => {
    const on = pinned && pinned.has(group.dataset.from) && pinned.has(group.dataset.to);
    group.classList.toggle("is-constellation-lit", on);
  });
}

// Pinned constellation — the star menu's "Highlight constellation" keeps a
// one-hop web lit even after the pointer leaves, until Esc or a new pin.
function pinnedNeighbors() {
  if (!state.pinnedStar) return null;
  const lit = constellationNeighbors(state.pinnedStar);
  lit.add(state.pinnedStar);
  return lit;
}

function togglePinnedStar(movieId) {
  state.pinnedStar = state.pinnedStar === movieId ? null : movieId;
  render();
}

function applyConstellationLights(movieId) {
  const lit = constellationNeighbors(movieId);
  const pinned = state.pinnedStar === movieId;
  els.canvas.classList.add("is-constellation-mode");
  els.canvas.querySelectorAll(".movie-node").forEach((el) => {
    const on = lit.has(el.dataset.id) || (pinned && el.dataset.id === movieId);
    el.classList.toggle("is-constellation-lit", on);
  });
  lightConstellationRoutes(lit);
}

// Re-apply the pinned constellation after each render.
function applyConstellationOverlays() {
  els.canvas.querySelectorAll(".movie-node.is-constellation-lit").forEach((el) => {
    el.classList.remove("is-constellation-lit");
  });
  if (state.pinnedStar) applyConstellationLights(state.pinnedStar);
}

// ============================================================
// Star menu — right-click any star for constellation actions
// ============================================================

let nodePositions = {}; // id -> {x,y} for the last render (canvas coords)

const SVG_NS = "http://www.w3.org/2000/svg";

const starMenu = document.createElement("div");
starMenu.id = "star-menu";
starMenu.className = "star-menu";
starMenu.hidden = true;
starMenu.setAttribute("role", "menu");
starMenu.setAttribute("aria-label", "Star actions");
let starMenuMovieId = null;

function buildStarMenu() {
  [
    { action: "pin", label: "Highlight constellation" },
    { action: "butterfly", label: "Butterfly effect" },
    { action: "teaser", label: "Scan post-credits" },
    { action: "dossier", label: "Open TVA dossier" },
    { action: "dna", label: "Shared DNA" },
    { action: "watch", label: "Mark as watched" },
    { action: "watchlist", label: "Add to watchlist" },
    { action: "details", label: "Open details" },
  ].forEach((item) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "star-menu__item";
    button.dataset.action = item.action;
    button.setAttribute("role", "menuitem");
    button.textContent = item.label;
    button.addEventListener("click", () => {
      const id = starMenuMovieId;
      closeStarMenu();
      handleStarMenuAction(item.action, id);
    });
    starMenu.appendChild(button);
  });
  document.body.appendChild(starMenu);
  document.addEventListener("click", (event) => {
    if (!starMenu.hidden && !starMenu.contains(event.target)) closeStarMenu();
  });
  document.addEventListener("scroll", () => closeStarMenu(), true);
  window.addEventListener("blur", () => closeStarMenu());
}

function openStarMenu(movie, x, y) {
  starMenuMovieId = movie.id;
  const pinned = state.pinnedStar === movie.id;
  const saved = state.watchlist.has(movie.id);
  const status = state.journey[movie.id];
  const butterflyActive = state.butterflySource === movie.id;
  const teaserActive = state.teaserScan === movie.id;
  starMenu.querySelector('[data-action="pin"]').textContent = pinned
    ? "Clear constellation highlight"
    : "Highlight constellation";
  starMenu.querySelector('[data-action="butterfly"]').textContent = butterflyActive
    ? "Clear butterfly effect"
    : "Butterfly effect";
  starMenu.querySelector('[data-action="teaser"]').textContent = teaserActive
    ? "Clear post-credit scan"
    : "Scan post-credits";
  starMenu.querySelector('[data-action="dossier"]').textContent = state.dossierOpen === movie.id
    ? "Close TVA dossier"
    : "Open TVA dossier";
  starMenu.querySelector('[data-action="dna"]').textContent = state.dna?.ids.includes(movie.id)
    ? "Clear shared DNA"
    : "Shared DNA";
  starMenu.querySelector('[data-action="watch"]').textContent = status
    ? `Watched: ${status} (unmark)`
    : "Mark as watched";
  starMenu.querySelector('[data-action="watchlist"]').textContent = saved
    ? "Remove from watchlist"
    : "Add to watchlist";
  starMenu.hidden = false;
  const menuWidth = 230;
  const menuHeight = 336;
  starMenu.style.left = `${Math.min(x, window.innerWidth - menuWidth - 12)}px`;
  starMenu.style.top = `${Math.min(y, window.innerHeight - menuHeight - 12)}px`;
  starMenu.querySelector(".star-menu__item")?.focus();
}function closeStarMenu() {
  starMenu.hidden = true;
  starMenuMovieId = null;
}

function handleStarMenuAction(action, movieId) {
  if (!movieId || !movieById(movieId)) return;
  switch (action) {
    case "pin":
      togglePinnedStar(movieId);
      break;
    case "butterfly":
      toggleButterfly(movieId);
      break;
    case "teaser":
      toggleTeaserScan(movieId);
      break;
    case "dossier":
      if (state.dossierOpen === movieId) closeDossier();
      else openDossier(movieId);
      break;
    case "dna":
      if (state.dna?.ids.includes(movieId)) clearDna();
      else openDnaPicker(movieId);
      break;
    case "watch":
      setJourneyStatus(movieId, state.journey[movieId] ? null : "watched");
      break;
    case "watchlist":
      toggleWatchlist(movieId);
      break;
    case "details":
      openDetail(movieId);
      break;
  }
}

function crossoverPathFor(sourceId) {
  const adjacency = new Map();
  const edgeKeys = new Set();
  const addEdge = (from, to) => {
    if (!movieById(from) || !movieById(to)) return;
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    if (!adjacency.has(to)) adjacency.set(to, new Set());
    adjacency.get(from).add(to);
    adjacency.get(to).add(from);
    edgeKeys.add(`${from}|${to}`);
    edgeKeys.add(`${to}|${from}`);
  };

  (state.data.crossoverTeases || []).forEach(({ from, to }) => addEdge(from, to));
  (state.data.timelineConnections || []).forEach(({ from, to }) => addEdge(from, to));
  state.data.movies.forEach((movie) => {
    (movie.joinsFrom || []).forEach((fromLine) => {
      state.data.movies
        .filter((candidate) => candidate.line === fromLine)
        .forEach((candidate) => addEdge(candidate.id, movie.id));
    });
  });

  const ids = new Set([sourceId]);
  const queue = [sourceId];
  while (queue.length) {
    const current = queue.shift();
    (adjacency.get(current) || []).forEach((connectedId) => {
      if (ids.has(connectedId)) return;
      ids.add(connectedId);
      queue.push(connectedId);
    });
  }

  const characterRoutes = ["spider-man", "wolverine", "deadpool", "avengers"];
  const activeRoutes = characterRoutes.filter((route) =>
    [...ids].some((id) => routeMatches(movieById(id), route))
  );
  state.data.movies.forEach((movie) => {
    if (activeRoutes.some((route) => routeMatches(movie, route))) ids.add(movie.id);
  });

  return {
    sourceId,
    ids,
    edgeKeys,
    lines: new Set([...ids].map((id) => movieById(id)?.line).filter(Boolean)),
    routes: activeRoutes,
  };
}

function activateCrossoverPath(movieId) {
  const path = crossoverPathFor(movieId);
  const hadNetwork = state.network !== null;
  state.network = null;
  state.butterflySource = null;
  state.teaserScan = null;
  if (hadNetwork) {
    window.NexusCore?.onNetworkClear?.();
    render();
  }
  if (path.ids.size < 2) {
    openDetail(movieId);
    return;
  }
  if (state.crossoverPath?.sourceId === movieId) {
    openDetail(movieId);
    return;
  }
  state.crossoverPath = { sourceId: movieId };
  hideStationPreview();
  render();
}

function clearCrossoverPath() {
  if (!state.crossoverPath) return;
  state.crossoverPath = null;
  render();
}

// Butterfly effect — the causal blast radius of erasing a title from the
// multiverse. A later title unravels when it either continues the same
// universe lane (franchise continuation) or is bound into the same crossover
// web as the removed title. Earlier titles are untouched — the past stands.
function butterflyDownstreamSet(sourceId) {
  const source = movieById(sourceId);
  const ids = new Set([sourceId]);
  if (!source) return ids;
  const sourceStory = movieYearValue(source, "story");
  if (sourceStory == null) return ids;

  const adjacency = new Map();
  const addEdge = (from, to) => {
    if (!movieById(from) || !movieById(to)) return;
    if (!adjacency.has(from)) adjacency.set(from, []);
    if (!adjacency.has(to)) adjacency.set(to, []);
    adjacency.get(from).push(to);
    adjacency.get(to).push(from);
  };
  (state.data.crossoverTeases || []).forEach(({ from, to }) => addEdge(from, to));
  (state.data.timelineConnections || []).forEach(({ from, to }) => addEdge(from, to));
  state.data.movies.forEach((movie) => {
    (movie.joinsFrom || []).forEach((fromLine) => {
      state.data.movies
        .filter((candidate) => candidate.line === fromLine)
        .forEach((candidate) => addEdge(candidate.id, movie.id));
    });
  });

  const web = new Set([sourceId]);
  const queue = [sourceId];
  while (queue.length) {
    const current = queue.shift();
    (adjacency.get(current) || []).forEach((connectedId) => {
      if (web.has(connectedId)) return;
      web.add(connectedId);
      queue.push(connectedId);
    });
  }

  state.data.movies.forEach((movie) => {
    const story = movieYearValue(movie, "story");
    if (story == null || story <= sourceStory) return;
    if (web.has(movie.id) || movie.line === source.line) ids.add(movie.id);
  });
  return ids;
}

function toggleButterfly(movieId) {
  state.butterflySource = state.butterflySource === movieId ? null : movieId;
  state.crossoverPath = null;
  state.teaserScan = null;
  if (state.butterflySource) unlockAchievement("butterfly");
  render();
}

function clearButterfly() {
  if (!state.butterflySource) return;
  state.butterflySource = null;
  render();
}

// Post-credit scanner — trace the threads a title sets up. Uses the same
// crossover teases / timeline connections the atlas draws, keeping only the
// ones that point to titles that come later in story time.
function teaserTargets(sourceId) {
  const source = movieById(sourceId);
  const targets = [];
  if (!source) return targets;
  const sourceStory = movieYearValue(source, "story");
  const seen = new Set();
  const push = (to, label) => {
    const target = movieById(to);
    if (!target || seen.has(to)) return;
    const story = movieYearValue(target, "story");
    if (story == null || story <= sourceStory) return;
    seen.add(to);
    targets.push({ to, label });
  };
  (state.data.crossoverTeases || []).forEach(({ from, to, label }) => {
    if (from === sourceId) push(to, label);
  });
  (state.data.timelineConnections || []).forEach(({ from, to, label }) => {
    if (from === sourceId) push(to, label);
  });
  return targets;
}

function toggleTeaserScan(movieId) {
  state.teaserScan = state.teaserScan === movieId ? null : movieId;
  state.crossoverPath = null;
  state.butterflySource = null;
  if (state.teaserScan) unlockAchievement("post-credit");
  if (state.network) {
    state.network = null;
    window.NexusCore?.onNetworkClear?.();
  }
  render();
}

function clearTeaserScan() {
  if (!state.teaserScan) return;
  state.teaserScan = null;
  render();
}

// ============================================================
// Infinity Gauntlet — collect the six stones by clicking their
// gems on the timeline. The gauntlet panel shows the collected
// gems and a Timeline tab tracing every stone's journey. All six
// collected triggers the snap.
// ============================================================

const GAUNTLET_KEY = "nexus.gauntlet";
const VISITED_KEY = "nexus.visited";
const ACHIEVEMENTS_KEY = "nexus.achievements";

function saveGauntlet() {
  try { localStorage.setItem(GAUNTLET_KEY, JSON.stringify([...state.gauntlet])); } catch { /* storage unavailable */ }
}

function loadGauntlet() {
  try {
    const raw = localStorage.getItem(GAUNTLET_KEY);
    if (raw) state.gauntlet = new Set(JSON.parse(raw).filter((id) => stoneById(id)));
  } catch { /* storage unavailable */ }
}

function saveVisited() {
  try { localStorage.setItem(VISITED_KEY, JSON.stringify([...state.visited])); } catch { /* storage unavailable */ }
}

function loadVisited() {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    if (raw) state.visited = new Set(JSON.parse(raw).filter((id) => movieById(id)));
  } catch { /* storage unavailable */ }
}

function stoneById(stoneId) {
  return (state.stones || []).find((s) => s.id === stoneId) || null;
}

function collectStone(stoneId) {
  const stone = stoneById(stoneId);
  if (!stone) return;
  if (state.gauntlet.has(stoneId)) {
    state.gauntlet.delete(stoneId);
  } else {
    state.gauntlet.add(stoneId);
    if (state.gauntlet.size === 1) unlockAchievement("first-stone");
    if (state.gauntlet.size === state.stones.length && !state.snapped) {
      runGauntletSnap();
    }
  }
  saveGauntlet();
  updateExperimentChrome();
  render();
}

function toggleGauntletPanel(force) {
  if (!els.gauntletPanel) return;
  const open = typeof force === "boolean" ? force : els.gauntletPanel.hidden;
  els.gauntletPanel.hidden = !open;
  els.gauntletPanel.classList.toggle("is-open", open);
  if (open) {
    renderGauntletVisual();
    renderGauntletTimeline();
    updateGauntletUI();
  }
}

function renderGauntletVisual() {
  if (!els.gauntletVisual) return;
  const stones = state.stones || [];
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 240 300");
  svg.setAttribute("class", "gauntlet-visual__svg");
  // gauntlet silhouette
  const silhouette = document.createElementNS(ns, "path");
  silhouette.setAttribute("d", "M70 292 C58 244 52 206 60 172 L66 122 C70 96 86 82 100 76 L116 70 C104 82 100 94 104 108 L138 60 L170 96 L186 62 L206 108 L226 90 C218 120 208 150 196 178 C188 196 182 218 178 240 C176 258 174 276 172 292 Z");
  silhouette.setAttribute("class", "gauntlet-visual__silhouette");
  svg.appendChild(silhouette);
  // gem slots
  const slots = [
    { x: 92, y: 196 }, { x: 140, y: 232 }, { x: 168, y: 178 },
    { x: 122, y: 150 }, { x: 96, y: 250 }, { x: 150, y: 96 },
  ];
  stones.forEach((stone, i) => {
    const slot = slots[i] || { x: 100 + i * 20, y: 150 };
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "gauntlet-slot" + (state.gauntlet.has(stone.id) ? " is-collected" : ""));
    g.dataset.stone = stone.id;
    const gem = document.createElementNS(ns, "path");
    gem.setAttribute("d", `M${slot.x} ${slot.y - 10} L${slot.x + 10} ${slot.y} L${slot.x} ${slot.y + 10} L${slot.x - 10} ${slot.y} Z`);
    gem.setAttribute("class", "gauntlet-slot__gem");
    gem.style.setProperty("--stone-color", stone.color);
    const ring = document.createElementNS(ns, "circle");
    ring.setAttribute("cx", String(slot.x));
    ring.setAttribute("cy", String(slot.y));
    ring.setAttribute("r", "16");
    ring.setAttribute("class", "gauntlet-slot__ring");
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", String(slot.x));
    label.setAttribute("y", String(slot.y + 32));
    label.setAttribute("class", "gauntlet-slot__label");
    label.textContent = stone.name.replace(" Stone", "");
    g.append(ring, gem, label);
    g.addEventListener("click", () => {
      const first = stone.appearances?.[0];
      if (first && movieById(first.movieId)) {
        revealTitle(first.movieId);
        openDetail(first.movieId);
      }
    });
    svg.appendChild(g);
  });
  els.gauntletVisual.innerHTML = "";
  els.gauntletVisual.appendChild(svg);
}

function renderGauntletTimeline() {
  if (!els.gauntletTimeline) return;
  const stones = state.stones || [];
  const html = stones.map((stone) => {
    const appearances = (stone.appearances || [])
      .map((a) => {
        const m = movieById(a.movieId);
        if (!m) return "";
        return `<button type="button" class="gauntlet-journey" data-gauntlet-journey="${escapeAttr(a.movieId)}"><i style="--stone-color:${stone.color}"></i><span><strong>${escapeHtml(m.title)}</strong><em>${escapeHtml(a.note)}</em></span></button>`;
      })
      .join("");
    return `<section class="gauntlet-stone${state.gauntlet.has(stone.id) ? " is-collected" : ""}">
      <h3 style="--stone-color:${stone.color}"><i aria-hidden="true"></i>${escapeHtml(stone.name)} <small>${escapeHtml(stone.alias)}</small></h3>
      <div class="gauntlet-stone__journey">${appearances || '<p class="gauntlet-empty">No appearances recorded.</p>'}</div>
    </section>`;
  }).join("");
  els.gauntletTimeline.innerHTML = html;
}

function updateGauntletUI() {
  const total = (state.stones || []).length;
  if (els.gauntletCount) els.gauntletCount.textContent = `${state.gauntlet.size}/${total}`;
  if (els.gauntletBtn) {
    els.gauntletBtn.setAttribute("aria-pressed", String(!els.gauntletPanel?.hidden));
  }
  if (els.gauntletStatus) {
    els.gauntletStatus.textContent = state.gauntlet.size === total
      ? "All six stones. The universe trembles."
      : `${state.gauntlet.size} of ${total} stones collected`;
  }
  if (els.gauntletBtn) els.gauntletBtn.title = state.gauntlet.size === total
    ? "Infinity Gauntlet complete — click to view"
    : `Infinity Gauntlet — collect the six stones across the timeline (${state.gauntlet.size}/${total})`;
}

function resetGauntlet() {
  state.gauntlet.clear();
  state.snapped = false;
  saveGauntlet();
  if (els.gauntletPanel && !els.gauntletPanel.hidden) {
    renderGauntletVisual();
    renderGauntletTimeline();
  }
  updateGauntletUI();
  updateExperimentChrome();
  render();
}

function runGauntletSnap() {
  state.snapped = true;
  unlockAchievement("snap");
  const overlay = els.snapOverlay;
  if (!overlay) return;
  overlay.classList.add("is-active");
  document.body.classList.add("is-snapping");
  els.canvas.querySelectorAll(".movie-node").forEach((node, i) => {
    node.classList.add("is-dusting");
    node.style.setProperty("--dust-i", String(i % 40));
  });
  window.setTimeout(() => {
    document.body.classList.remove("is-snapping");
    els.canvas.querySelectorAll(".movie-node.is-dusting").forEach((n) => n.classList.remove("is-dusting"));
    overlay.classList.remove("is-active");
  }, 4600);
}

// ============================================================
// Variant scanner — flag competing variants across lanes
// (multiple Spider-Men, Wolverines, Deadpools and the rest).
// ============================================================

const VARIANT_FRANCHISES = [
  [/spider[- ]?man/i, "Spider-Man"],
  [/wolverine/i, "Wolverine"],
  [/deadpool/i, "Deadpool"],
  [/venom/i, "Venom"],
  [/x[- ]?men|mutant/i, "X-Men"],
  [/fantastic[- ]?four/i, "Fantastic Four"],
  [/ghost[- ]?rider/i, "Ghost Rider"],
  [/daredevil|the defenders/i, "Street level"],
];

function franchiseOf(movie) {
  const title = movie.title || "";
  for (const [pattern, label] of VARIANT_FRANCHISES) {
    if (pattern.test(title)) return label;
  }
  return null;
}

function variantGroups() {
  const groups = [];
  const seen = new Set();
  state.data.movies.forEach((m) => {
    if (seen.has(m.id)) return;
    const key = franchiseOf(m);
    if (!key) return;
    const members = state.data.movies.filter((mm) => mm.id !== m.id && franchiseOf(mm) === key);
    if (!members.length) return;
    const ids = [m.id, ...members.map((mm) => mm.id)].filter((id) => !seen.has(id));
    ids.forEach((id) => seen.add(id));
    groups.push({ key, ids });
  });
  return groups;
}

function variantSetFor() {
  if (!state.variantScan) return null;
  const groups = variantGroups();
  const set = new Set();
  groups.forEach((g) => g.ids.forEach((id) => set.add(id)));
  return set;
}

function toggleVariantScan() {
  state.variantScan = !state.variantScan;
  persistVariantScan();
  syncUrl();
  render();
}

function clearVariantScan() {
  if (!state.variantScan) return;
  state.variantScan = false;
  persistVariantScan();
  syncUrl();
  render();
}

function persistVariantScan() {
  try {
    if (state.variantScan) localStorage.setItem("nexus.variant-scan", "1");
    else localStorage.removeItem("nexus.variant-scan");
  } catch (e) { /* storage unavailable */ }
}

// ============================================================
// Experiment chrome — keep every toggle/readout in sync.
// ============================================================

function updateExperimentChrome() {
  updateGauntletUI();
  if (els.variantBtn) {
    els.variantBtn.classList.toggle("is-active", state.variantScan);
    els.variantBtn.setAttribute("aria-pressed", String(state.variantScan));
  }
  if (els.variantBar) {
    els.variantBar.hidden = !state.variantScan;
    if (state.variantScan && els.variantSummary) {
      const groups = variantGroups();
      const total = groups.reduce((n, g) => n + g.ids.length, 0);
      els.variantSummary.innerHTML = `<strong>Variant scan</strong> · ${groups.length} clusters · <b style="color:#ff7ad9">${total} titles flagged</b>`;
    }
  }
  updateAchievementsChrome();
  if (els.commuteBtn) els.commuteBtn.classList.toggle("is-active", !els.commuteMode?.hidden);
  updatePlayheadChrome();
}

// ============================================================
// TVA dossier — a case file for any title: classifications,
// timeline record, key cast, and the stones it carries.
// ============================================================

function openDossier(movieId) {
  const m = movieById(movieId);
  if (!m || !els.tvaDossier) return;
  state.dossierOpen = movieId;
  const line = lineById(m.line);
  const stones = stonesFor(m.id);
  const cast = castForMovieCached(m.id).slice(0, 8);
  const record = [];
  const recordIds = new Set([m.id]);
  const addRecord = (otherId, label) => {
    const other = movieById(otherId);
    if (!other || recordIds.has(otherId)) return;
    recordIds.add(otherId);
    record.push({ other, label });
  };
  (state.data.crossoverTeases || []).forEach((t) => {
    if (t.from === m.id) addRecord(t.to, "Sets up");
    if (t.to === m.id) addRecord(t.from, "Leads into this");
  });
  (state.data.timelineConnections || []).forEach((c) => {
    if (c.from === m.id) addRecord(c.to, "Connects to");
    if (c.to === m.id) addRecord(c.from, "Connected from");
  });

  const stonesHtml = stones.length
    ? `<div class="dossier-stones">
        ${stones.map((s) => `<span class="dossier-stone" style="--stone-color:${s.color}"><i></i>${escapeHtml(s.name)}</span>`).join("")}
      </div>`
    : '<p class="dossier-empty">No Infinity Stones recorded on this file.</p>';

  const recordHtml = record.length
    ? `<ul class="dossier-record">${record
        .map(
          (r) =>
            `<li><span class="dossier-record__label">${escapeHtml(r.label)}</span><button type="button" class="dossier-record__link" data-dossier-movie="${escapeAttr(r.other.id)}">${escapeHtml(r.other.title)}</button></li>`
        )
        .join("")}</ul>`
    : '<p class="dossier-empty">No cross-timeline connections recorded.</p>';

  const castHtml = cast.length
    ? `<div class="dossier-cast">${cast
        .map(
          (c) =>
            `<button type="button" class="dossier-cast__chip" data-dossier-actor="${escapeAttr(c.actor)}" title="Light up every ${escapeAttr(c.actor)} title">${escapeHtml(c.actor)}<em>${escapeHtml(c.character)}</em></button>`
        )
        .join("")}</div>`
    : '<p class="dossier-empty">No key cast on file.</p>';

  const year = m.releaseDate ? formatDate(m.releaseDate) : "TBA";
  const storyYear = typeof m.inUniverseYear === "number" ? String(m.inUniverseYear) : movieYearValue(m, "story");
  const classification = m.status === "upcoming" ? "PENDING REVIEW" : "ACCEPTED — SACRED TIMELINE";

  els.tvaDossierContent.innerHTML = `
    <div class="dossier-head">
      <div class="dossier-stamp ${m.status === "upcoming" ? "is-pending" : ""}">${classification}</div>
      <span class="dossier-file">FILE ${m.id.toUpperCase().replace(/[^A-Z0-9]/g, "-")}</span>
      <h2>${escapeHtml(m.title)}</h2>
      <p class="dossier-line">${escapeHtml(line.name)} <span>·</span> ${escapeHtml(m.saga || "Multiverse")}</p>
    </div>
    <dl class="dossier-facts">
      <div><dt>Studio</dt><dd>${escapeHtml(line.studio)}</dd></div>
      <div><dt>${m.type === "series" ? "Premiered" : "Release"}</dt><dd>${escapeHtml(year)}</dd></div>
      <div><dt>Story set in</dt><dd>${storyYear ?? "—"}</dd></div>
      <div><dt>${m.type === "series" ? "Showrunner" : "Director"}</dt><dd>${escapeHtml(m.creator || m.director || "TBA")}</dd></div>
      <div><dt>Runtime</dt><dd>${m.runtimeMinutes ? m.runtimeMinutes + " min" : "—"}</dd></div>
      <div><dt>Phase</dt><dd>${escapeHtml(m.phase || "—")}</dd></div>
      <div><dt>Status</dt><dd class="status-pill status-${m.status}">${escapeHtml(m.status)}</dd></div>
    </dl>
    <section class="dossier-section">
      <h3>Relics on record</h3>
      ${stonesHtml}
    </section>
    <section class="dossier-section">
      <h3>Timeline record</h3>
      ${recordHtml}
    </section>
    <section class="dossier-section">
      <h3>Known associates</h3>
      ${castHtml}
    </section>
    <p class="dossier-foot">INSPECTED BY THE TIME VARIANCE AUTHORITY · ALL RIGHTS RESERVED</p>`;
  els.tvaDossier.hidden = false;
  requestAnimationFrame(() => els.tvaDossier.classList.add("is-open"));
  els.tvaDossierClose.focus();
}

function closeDossier() {
  if (!els.tvaDossier) return;
  state.dossierOpen = null;
  els.tvaDossier.classList.remove("is-open");
  els.tvaDossier.hidden = true;
}

// ============================================================
// Shared-DNA finder — pick a cast member from a title and every
// title their DNA threads through lights up at once.
// ============================================================

let dnaPickerMovieId = null;

function openDnaPicker(movieId) {
  if (!els.dnaPicker) return;
  dnaPickerMovieId = movieId;
  const cast = castForMovieCached(movieId);
  els.dnaPickerList.innerHTML = cast.length
    ? cast
        .map(
          (c) =>
            `<button type="button" class="dna-picker__item" data-dna-actor="${escapeAttr(c.actor)}">
              <strong>${escapeHtml(c.actor)}</strong>
              <em>${escapeHtml(c.character)}</em>
              <span>${c.movies ? c.movies.length : 0} titles</span>
            </button>`
        )
        .join("")
    : '<p class="dna-picker__empty">No shared DNA found for this title.</p>';
  els.dnaPicker.hidden = false;
  requestAnimationFrame(() => els.dnaPicker.classList.add("is-open"));
}

function closeDnaPicker() {
  if (!els.dnaPicker) return;
  els.dnaPicker.classList.remove("is-open");
  els.dnaPicker.hidden = true;
  dnaPickerMovieId = null;
}

function applyDna(actorName) {
  const entry = allCastEntries().find((c) => c.actor === actorName);
  if (!entry) return;
  const ids = (entry.movies || []).filter((id) => movieById(id));
  state.dna = { actor: entry.actor, character: entry.character, ids };
  closeDnaPicker();
  unlockAchievement("shared-dna");
  render();
}

function clearDna() {
  if (!state.dna) return;
  state.dna = null;
  render();
}

function toggleDna() {
  if (state.dna) {
    clearDna();
  } else if (dnaPickerMovieId) {
    openDnaPicker(dnaPickerMovieId);
  }
}

// ============================================================
// Mode toasts — tiny transient notices for experiments that
// don't deserve a full bar.
// ============================================================

let modeToastTimer = null;

function showModeToast(message) {
  let toast = document.getElementById("mode-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "mode-toast";
    toast.className = "mode-toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(modeToastTimer);
  modeToastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

// Big-bang cinematic mode was removed in the Doomsday pass.

function clearNetwork() {
  if (!state.network) return;
  state.network = null;
  window.NexusCore?.onNetworkClear?.();
  render();
}

function connectedTimelineLines() {
  const connected = new Set(["mcu"]);
  state.data.movies.forEach((entry) => {
    (entry.joinsFrom || []).forEach((lineId) => connected.add(lineId));
  });
  [...(state.data.crossoverTeases || []), ...(state.data.timelineConnections || [])].forEach((connection) => {
    const from = movieById(connection.from);
    const to = movieById(connection.to);
    if (from) connected.add(from.line);
    if (to) connected.add(to.line);
  });
  return connected;
}

function matchesQuery(movie) {
  if (!state.query) return true;
  const line = lineById(movie.line);
  return [
    movie.title,
    movie.releaseDate?.slice(0, 4),
    movie.director,
    movie.saga,
    movie.phase,
    movie.status,
    movie.type,
    movie.creator,
    line?.name,
    line?.studio,
  ].filter(Boolean).join(" ").toLowerCase().includes(state.query);
}

function isMilestone(m) {
  return !!(m.joinsFrom && m.joinsFrom.length) || /Avengers/.test(m.title) || m.id === "spider-man-no-way-home";
}

function typeOfLabel(movie) {
  return movie.type === "series" ? "series" : "movie";
}

function creditsMinutes(movie) {
  if (!state.includeCredits) return 0;
  return movie.type === "series" ? 0 : 8; // avg post-credit tail for theatrical releases
}

function runtimeFor(movie) {
  return (movie.runtimeMinutes || 0) + creditsMinutes(movie);
}

function releasedMovies(movies = state.data.movies) {
  return movies.filter((movie) => movie.status === "released");
}

function remainingMinutes(movies = releasedMovies()) {
  return movies
    .filter((movie) => state.journey[movie.id] !== "watched")
    .reduce((sum, movie) => sum + runtimeFor(movie), 0);
}

function essentialRemainingMinutes() {
  return releasedMovies()
    .filter((movie) => priorityFor(movie) === "essential" && state.journey[movie.id] !== "watched")
    .reduce((sum, movie) => sum + runtimeFor(movie), 0);
}

function formatHoursMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (!hours) return `${mins} min`;
  return mins ? `${hours} h ${mins} m` : `${hours} h`;
}

function storyIndexMap() {
  const sorted = state.data.movies
    .filter((movie) => movieYearValue(movie, "story") !== null)
    .sort(
      (a, b) =>
        movieYearValue(a, "story") - movieYearValue(b, "story") ||
        a.title.localeCompare(b.title)
    );
  return new Map(sorted.map((movie, index) => [movie.id, index]));
}

function spoilerFrontier() {
  const map = storyIndexMap();
  let frontier = -1;
  map.forEach((index, id) => {
    if (state.journey[id] === "watched" && index > frontier) frontier = index;
  });
  return frontier;
}

function priorityPasses(movie) {
  if (!state.priorityFilter) return true;
  const p = priorityFor(movie);
  return state.priorityFilter === "essential" ? p === "essential" : p === "essential" || p === "recommended";
}

function typePasses(movie) {
  return !state.typeFilter || typeOfLabel(movie) === state.typeFilter;
}

function isSpoilerLocked(movie, frontier) {
  if (!state.spoilerSafe || frontier < 0) return false;
  const map = storyIndexMap();
  return map.has(movie.id) && map.get(movie.id) > frontier;
}

function formatDate(dateStr) {
  if (!dateStr) return "TBA";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

// ------------------------------------------------------------
// Personal journey + universe filter
// ------------------------------------------------------------

function loadJourney() {
  try {
    const stored = JSON.parse(localStorage.getItem(JOURNEY_STORAGE_KEY) || "{}");
    state.journey = Object.fromEntries(
      Object.entries(stored).filter(([id, status]) => movieById(id) && JOURNEY_STATUSES.has(status))
    );
  } catch {
    state.journey = {};
  }
}

function saveJourney() {
  try {
    localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(state.journey));
  } catch {
    console.warn("Marvel Nexus could not save journey progress in this browser.");
  }
}

function loadWatchlist() {
  try {
    const stored = JSON.parse(localStorage.getItem(WATCHLIST_STORAGE_KEY) || "[]");
    state.watchlist = new Set(Array.isArray(stored) ? stored.filter((id) => movieById(id)) : []);
  } catch {
    state.watchlist = new Set();
  }
}

function saveWatchlist() {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([...state.watchlist]));
  } catch {
    console.warn("Marvel Nexus could not save the watchlist in this browser.");
  }
}

function toggleWatchlist(id) {
  if (!movieById(id)) return;
  if (state.watchlist.has(id)) state.watchlist.delete(id);
  else state.watchlist.add(id);
  saveWatchlist();
  updateWatchlistControls();
  window.NexusCore?.onWatchlistChanged?.();
}

function updateWatchlistControls() {
  document.querySelectorAll("[data-watchlist-toggle]").forEach((button) => {
    const movie = movieById(button.dataset.watchlistToggle);
    if (!movie) return;
    const saved = state.watchlist.has(movie.id);
    button.classList.toggle("is-saved", saved);
    button.setAttribute("aria-pressed", String(saved));
    button.querySelector(".watchlist-toggle__label").textContent = saved ? "Remove from watchlist" : "Add to watchlist";
  });
  document.querySelectorAll("[data-watchlist-count]").forEach((el) => {
    el.textContent = String(state.watchlist.size);
  });
}

function watchlistTotalMinutes() {
  let total = 0;
  state.watchlist.forEach((id) => {
    const m = movieById(id);
    if (m && m.runtimeMinutes) total += m.runtimeMinutes;
  });
  return total;
}

function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function journeyEligible(movies = state.data.movies) {
  return movies.filter((movie) => movie.status === "released");
}

function journeyStats(movies = state.data.movies) {
  const eligible = journeyEligible(movies);
  const watched = eligible.filter((movie) => state.journey[movie.id] === "watched").length;
  const watching = movies.filter((movie) => state.journey[movie.id] === "watching").length;
  const planned = movies.filter((movie) => state.journey[movie.id] === "planned").length;
  const percent = eligible.length ? Math.round((watched / eligible.length) * 100) : 0;
  return { total: eligible.length, watched, watching, planned, percent };
}

function selectedUniverseId() {
  const visible = state.data.lines.filter((line) => !state.hiddenLines.has(line.id));
  return visible.length === 1 ? visible[0].id : "";
}

function selectUniverse(lineId) {
  state.selectedUniverse = lineId;
  state.hiddenLines = lineId
    ? new Set(state.data.lines.map((line) => line.id).filter((id) => id !== lineId))
    : new Set();
  closeUniversePicker();
  buildUniversePicker();
  syncUrl();
  render();
}

function ringMarkup(percent, small = false) {
  return `<span class="progress-ring${small ? " progress-ring--small" : ""}" style="--progress:${percent * 3.6}deg" aria-label="${percent}% watched"><span>${small ? "" : `${percent}%`}</span></span>`;
}

function buildUniversePicker() {
  const selectedId = selectedUniverseId();
  state.selectedUniverse = selectedId;
  const allStats = journeyStats();
  els.universePickerValue.textContent = selectedId ? lineById(selectedId).name : "All universes";
  els.universePickerRing.style.setProperty("--progress", `${allStats.percent * 3.6}deg`);
  els.universePickerRing.setAttribute("aria-label", `${allStats.percent}% watched overall`);
  els.universePickerMenu.innerHTML = "";

  const choices = [
    { id: "", name: "All universes", color: "#9b9cae", movies: state.data.movies },
    ...state.data.lines.map((line) => ({
      id: line.id,
      name: line.name,
      color: line.color,
      movies: state.data.movies.filter((movie) => movie.line === line.id),
    })),
  ];

  choices.forEach((choice) => {
    const stats = journeyStats(choice.movies);
    const option = document.createElement("button");
    option.type = "button";
    option.className = "universe-picker__option";
    option.dataset.value = choice.id;
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(choice.id === selectedId));
    option.innerHTML = `
      ${ringMarkup(stats.percent)}
      <span class="universe-picker__option-copy">
        <strong>${choice.name}</strong>
        <small>${stats.watched} of ${stats.total} watched</small>
      </span>
      <i style="background:${choice.color}" aria-hidden="true"></i>
    `;
    option.addEventListener("click", () => selectUniverse(choice.id));
    els.universePickerMenu.appendChild(option);
  });
}

function toggleUniversePicker() {
  const willOpen = els.universePickerMenu.hidden;
  els.universePickerMenu.hidden = !willOpen;
  els.universePickerTrigger.setAttribute("aria-expanded", String(willOpen));
}

function closeUniversePicker() {
  els.universePickerMenu.hidden = true;
  els.universePickerTrigger.setAttribute("aria-expanded", "false");
}

function setJourneyStatus(movieId, status) {
  const previous = state.journey[movieId];
  if (status && JOURNEY_STATUSES.has(status)) state.journey[movieId] = status;
  else delete state.journey[movieId];
  saveJourney();
  updateJourneySummary();
  buildUniversePicker();
  updateJourneyNodeVisuals();
  updateDetailJourneyControls(movieId);
  if (els.journeyDialog.open) {
    renderJourneyDashboard();
    renderPlanner();
    renderUpcoming();
  }
  const released = state.data.movies.filter((m) => m.status !== "upcoming");
  if (released.length && released.every((m) => state.journey[m.id] === "watched")) {
    unlockAchievement("completionist");
  }
  if (status === "watched") trackStreak();
  window.NexusCore?.onJourneyChanged?.();
  window.dispatchEvent(new CustomEvent("nexus-journey", { detail: { movieId, status, previous } }));
}

function updateJourneySummary() {
  const stats = journeyStats();
  els.journeyLaunchProgress.textContent = `${stats.percent}%`;
  els.journeyLaunch.style.setProperty("--journey-progress", `${stats.percent * 3.6}deg`);
  els.journeyLaunch.setAttribute(
    "aria-label",
    `Open My Viewing Orbit. ${stats.watched} of ${stats.total} released titles watched.`
  );
}

function updateJourneyNodeVisuals() {
  document.querySelectorAll(".movie-node").forEach((node) => {
    const status = state.journey[node.dataset.id] || "";
    node.dataset.journey = status;
    node.classList.toggle("is-watched", status === "watched");
    node.classList.toggle("is-watching", status === "watching");
    node.classList.toggle("is-planned", status === "planned");
    const movie = movieById(node.dataset.id);
    if (movie) {
      node.setAttribute(
        "aria-label",
        `${movie.title}, ${movie.type === "series" ? "television series" : "movie"}, ${movie.releaseDate ? movie.releaseDate.slice(0, 4) : "TBA"}${status ? `, marked ${status}` : ""}`
      );
    }
  });
  document.querySelectorAll(".journey-node-badge").forEach((badge) => {
    const status = state.journey[badge.dataset.id];
    badge.hidden = !status;
    badge.className = `journey-node-badge${status ? ` is-${status}` : ""}`;
    badge.textContent = status === "watched" ? "✓" : status === "watching" ? "▶" : status === "planned" ? "+" : "";
  });
}

function updateDetailJourneyControls(movieId) {
  document.querySelectorAll(".journey-status-btn").forEach((button) => {
    const active = state.journey[movieId] === button.dataset.status;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const clearButton = document.getElementById("journey-status-clear");
  if (clearButton) clearButton.disabled = !state.journey[movieId];
}

function groupedJourneyStats(keyFn) {
  const groups = new Map();
  state.data.movies.forEach((movie) => {
    const key = keyFn(movie);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(movie);
  });
  return [...groups].map(([name, movies]) => ({ name, ...journeyStats(movies) }));
}

function renderJourneyDashboard() {
  const overall = journeyStats();
  const universeStats = state.data.lines.map((line) => ({
    name: line.name,
    color: line.color,
    ...journeyStats(state.data.movies.filter((movie) => movie.line === line.id)),
  }));
  const sagaStats = groupedJourneyStats((movie) => movie.saga || "Other stories")
    .sort((a, b) => b.total - a.total);

  const progressRows = (items) => items.map((item) => `
    <div class="journey-progress-row">
      ${ringMarkup(item.percent)}
      <div>
        <strong>${item.name}</strong>
        <span>${item.watched}/${item.total} watched</span>
      </div>
      <div class="journey-progress-track"><i style="width:${item.percent}%;${item.color ? `background:${item.color}` : ""}"></i></div>
    </div>
  `).join("");

  els.journeyDashboard.innerHTML = `
    <section class="journey-overview">
      ${ringMarkup(overall.percent)}
      <div><strong>${overall.percent}% complete</strong><span>${overall.watched} of ${overall.total} released titles watched</span></div>
      <div class="journey-count"><strong>${overall.watching}</strong><span>Watching</span></div>
      <div class="journey-count"><strong>${overall.planned}</strong><span>Planned</span></div>
    </section>
    <section class="journey-overview__extra">
      <div class="journey-count"><strong>${releasedMovies().filter((movie) => state.journey[movie.id] !== "watched").length}</strong><span>Remaining titles</span></div>
      <div class="journey-count"><strong>${formatHoursMinutes(remainingMinutes())}</strong><span>Remaining time</span></div>
      <div class="journey-count"><strong>${releasedMovies().filter((movie) => priorityFor(movie) === "essential" && state.journey[movie.id] !== "watched").length}</strong><span>Essential left</span></div>
      <div class="journey-count"><strong>${formatHoursMinutes(essentialRemainingMinutes())}</strong><span>Essential hours</span></div>
    </section>
    <div class="journey-dashboard-grid">
      <section><h3>Universes</h3>${progressRows(universeStats)}</section>
      <section><h3>Sagas</h3>${progressRows(sagaStats)}</section>
    </div>
  `;
  window.NexusCore?.onJourneyRendered?.();
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function plannerWeeklyHours() {
  return clampNumber(Number(els.plannerHours?.value) || 8, 1, 80);
}

function renderPlanner() {
  if (!els.plannerStats) return;
  const weeklyHours = plannerWeeklyHours();
  const perDayMinutes = (weeklyHours * 60) / 7;
  const remaining = remainingMinutes();
  const essentialLeft = essentialRemainingMinutes();
  const remainingTitles = releasedMovies().filter((movie) => state.journey[movie.id] !== "watched").length;
  const essentialTitles = releasedMovies().filter((movie) => priorityFor(movie) === "essential" && state.journey[movie.id] !== "watched").length;

  let days = 0;
  let etaText = "Nothing left to watch";
  if (remaining > 0 && perDayMinutes > 0) {
    days = Math.ceil(remaining / perDayMinutes);
    const eta = new Date(Date.now() + days * 86400000);
    etaText = `${eta.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · ${days} ${days === 1 ? "day" : "days"}`;
  }
  els.plannerEta.textContent = etaText;

  let targetNote = "";
  const targetRaw = els.plannerTarget?.value;
  if (targetRaw && days > 0) {
    const target = new Date(targetRaw + "T00:00:00");
    const eta = new Date(Date.now() + days * 86400000);
    const diffDays = Math.ceil((eta - target) / 86400000);
    targetNote = diffDays > 0
      ? `<span class="planner-warn">Behind target by ${diffDays} ${diffDays === 1 ? "day" : "days"}</span>`
      : `<span class="planner-ok">On track — ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "day" : "days"} to spare</span>`;
  }

  els.plannerStats.innerHTML = `
    <div><strong>${remainingTitles}</strong><span>Unwatched</span></div>
    <div><strong>${formatHoursMinutes(remaining)}</strong><span>Time left</span></div>
    <div><strong>${essentialTitles}</strong><span>Essential unwatched</span></div>
    <div><strong>${formatHoursMinutes(essentialLeft)}</strong><span>Essential time</span></div>
    ${targetNote}
  `;
}

function renderUpcoming() {
  if (!els.journeyUpcoming) return;
  const now = Date.now();
  const upcoming = state.data.movies
    .filter((movie) => movie.status === "upcoming" && movie.releaseDate)
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
  if (!upcoming.length) {
    els.journeyUpcoming.innerHTML = "";
    return;
  }
  els.journeyUpcoming.innerHTML = `
    <h4>Up next in the multiverse</h4>
    <ul>
      ${upcoming.map((movie) => {
        const days = Math.ceil((new Date(movie.releaseDate + "T00:00:00").getTime() - now) / 86400000);
        return `<li><strong>${escapeHtml(movie.title)}</strong><span>${formatDate(movie.releaseDate)} · ${days >= 0 ? days + " " + (days === 1 ? "day" : "days") : "released"}</span></li>`;
      }).join("")}
    </ul>
  `;
}

function generateSchedule() {
  if (!els.plannerSchedule) return;
  const weeklyHours = plannerWeeklyHours();
  const dailyMinutes = Math.max(30, Math.round((weeklyHours * 60) / 7));
  const queue = releasedMovies()
    .filter((movie) => state.journey[movie.id] !== "watched" && movieYearValue(movie, "story") !== null)
    .sort(
      (a, b) =>
        movieYearValue(a, "story") - movieYearValue(b, "story") ||
        a.title.localeCompare(b.title)
    );
  const days = [];
  let day = { minutes: 0, items: [] };
  queue.forEach((movie) => {
    const mins = runtimeFor(movie);
    if (day.items.length && day.minutes + mins > dailyMinutes) {
      days.push(day);
      day = { minutes: 0, items: [] };
    }
    day.minutes += mins;
    day.items.push(movie);
  });
  if (day.items.length) days.push(day);
  const maxShow = 14;
  const html = days
    .slice(0, maxShow)
    .map(
      (d, index) => `
      <div class="schedule-day">
        <div class="schedule-day__head"><strong>Day ${index + 1}</strong><span>${formatHoursMinutes(d.minutes)}</span></div>
        <div class="schedule-day__items">${d.items.map((movie) => `<span title="${escapeAttr(movie.title)}">${escapeHtml(movie.title)}</span>`).join("")}</div>
      </div>`
    )
    .join("");
  els.plannerSchedule.innerHTML = `
    <h4>Your watch schedule</h4>
    <div class="schedule-list">${html || '<p class="schedule-more">Nothing left to schedule — you are all caught up.</p>'}</div>
    ${days.length > maxShow ? `<p class="schedule-more">…and ${days.length - maxShow} more ${days.length - maxShow === 1 ? "day" : "days"} in story order</p>` : ""}
  `;
  els.plannerSchedule.hidden = false;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportJourney() {
  const backup = {
    app: "Marvel Nexus",
    version: 1,
    exportedAt: new Date().toISOString(),
    journey: state.journey,
  };
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }),
    "marvel-nexus-journey.json"
  );
}

async function importJourney(event) {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const incoming = parsed.journey || parsed;
    state.journey = Object.fromEntries(
      Object.entries(incoming).filter(([id, status]) => movieById(id) && JOURNEY_STATUSES.has(status))
    );
    saveJourney();
    updateJourneySummary();
    buildUniversePicker();
    updateJourneyNodeVisuals();
    renderJourneyDashboard();
  } catch {
    window.alert("That file is not a valid Marvel Nexus journey backup.");
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }
  ctx.fill();
}

function createJourneyCardBlob() {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const ctx = canvas.getContext("2d");
  const overall = journeyStats();
  const topUniverses = state.data.lines
    .map((line) => ({
      name: line.name,
      color: line.color,
      ...journeyStats(state.data.movies.filter((movie) => movie.line === line.id)),
    }))
    .sort((a, b) => b.percent - a.percent || b.watched - a.watched)
    .slice(0, 5);

  const background = ctx.createLinearGradient(0, 0, 1200, 630);
  background.addColorStop(0, "#0b0a16");
  background.addColorStop(.48, "#1b1638");
  background.addColorStop(1, "#0b0a16");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 1200, 630);

  const glow = ctx.createRadialGradient(910, 70, 0, 910, 70, 470);
  glow.addColorStop(0, "rgba(139,124,255,.3)");
  glow.addColorStop(1, "rgba(139,124,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 630);

  ctx.fillStyle = "#3ddc84";
  ctx.fillRect(64, 64, 8, 76);
  ctx.fillStyle = "#f2f1ec";
  ctx.font = "700 54px Inter, Arial, sans-serif";
  ctx.fillText("MY MARVEL JOURNEY", 98, 112);
  ctx.fillStyle = "#a9a5d2";
  ctx.font = "500 21px Inter, Arial, sans-serif";
  ctx.fillText("Marvel Nexus · progress stored privately on my device", 100, 147);

  ctx.strokeStyle = "#3ddc84";
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(250, 345, 122, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * overall.percent / 100);
  ctx.stroke();
  ctx.strokeStyle = "#2a2c3c";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.arc(250, 345, 122, -Math.PI / 2 + Math.PI * 2 * overall.percent / 100, Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = "#f2f1ec";
  ctx.textAlign = "center";
  ctx.font = "700 66px Inter, Arial, sans-serif";
  ctx.fillText(`${overall.percent}%`, 250, 365);
  ctx.fillStyle = "#a9a5d2";
  ctx.font = "500 18px Inter, Arial, sans-serif";
  ctx.fillText(`${overall.watched} / ${overall.total} WATCHED`, 250, 405);
  ctx.textAlign = "left";

  ctx.fillStyle = "rgba(23,21,48,.88)";
  roundedRect(ctx, 440, 195, 690, 342, 26);
  ctx.fillStyle = "#f2f1ec";
  ctx.font = "700 23px Inter, Arial, sans-serif";
  ctx.fillText("UNIVERSE PROGRESS", 480, 242);
  topUniverses.forEach((item, index) => {
    const y = 292 + index * 48;
    ctx.fillStyle = "#f2f1ec";
    ctx.font = "600 17px Inter, Arial, sans-serif";
    ctx.fillText(item.name, 480, y);
    ctx.fillStyle = "#6f6a9c";
    roundedRect(ctx, 760, y - 15, 290, 10, 5);
    ctx.fillStyle = item.color;
    roundedRect(ctx, 760, y - 15, Math.max(4, 290 * item.percent / 100), 10, 5);
    ctx.fillStyle = "#a9a5d2";
    ctx.font = "600 15px Inter, Arial, sans-serif";
    ctx.fillText(`${item.percent}%`, 1070, y);
  });

  ctx.fillStyle = "#6f6a9c";
  ctx.font = "500 17px Inter, Arial, sans-serif";
  ctx.fillText(`${overall.watching} watching  ·  ${overall.planned} planned`, 66, 586);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

async function shareJourneyCard() {
  const originalText = els.journeyShare.textContent;
  els.journeyShare.disabled = true;
  els.journeyShare.textContent = "Creating card…";
  try {
    const blob = await createJourneyCardBlob();
    const file = new File([blob], "my-viewing-orbit.png", { type: "image/png" });
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      await navigator.share({
        title: "My Viewing Orbit",
        text: `I have watched ${journeyStats().percent}% of the Marvel Nexus timeline.`,
        files: [file],
      });
    } else {
      downloadBlob(blob, file.name);
      els.journeyShare.textContent = "Card downloaded";
      window.setTimeout(() => { els.journeyShare.textContent = originalText; }, 1600);
      return;
    }
  } catch (error) {
    if (error?.name !== "AbortError") console.error("Unable to share journey card:", error);
  } finally {
    els.journeyShare.disabled = false;
    if (els.journeyShare.textContent === "Creating card…") els.journeyShare.textContent = originalText;
  }
}

// ------------------------------------------------------------
// Events
// ------------------------------------------------------------

function bindEvents() {
  els.doomsdayCountdown.addEventListener("pointerdown", handleDoomsdayDragStart);
  els.doomsdayCountdown.addEventListener("pointermove", handleDoomsdayDragMove);
  els.doomsdayCountdown.addEventListener("pointerup", handleDoomsdayDragEnd);
  els.doomsdayCountdown.addEventListener("pointercancel", handleDoomsdayDragEnd);
  els.doomsdayCountdownOpen.addEventListener("click", (event) => {
    if (suppressDoomsdayClick) {
      suppressDoomsdayClick = false;
      event.preventDefault();
      return;
    }
    openDetail("avengers-doomsday");
  });
  els.doomsdayCountdownClose.addEventListener("click", () => {
    els.doomsdayCountdown.hidden = true;
    window.clearInterval(doomsdayCountdownTimer);
  });
  document.querySelectorAll(".sort-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sort-btn").forEach((b) => {
        b.classList.remove("is-active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      state.sortMode = btn.dataset.sort;
      els.modeNote.hidden = state.sortMode !== "story" || state.modeNoteDismissed;
      syncUrl();
      render();
    });
  });

  const themeButtons = document.querySelectorAll(".theme-toggle__btn");
  const setTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("nexus.theme", theme); } catch (e) { /* storage unavailable */ }
    themeButtons.forEach((b) => {
      const active = b.dataset.themeOption === theme;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
  };
  themeButtons.forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeOption)));
  setTheme(document.documentElement.dataset.theme || "aperture");

  let debounce;
  els.searchInput.addEventListener("input", (e) => {
    clearTimeout(debounce);
    const val = e.target.value;
    debounce = setTimeout(() => {
      state.query = val.trim().toLowerCase();
      syncUrl();
      render();
    }, 120);
  });

  els.detailClose.addEventListener("click", closeDetail);
  els.crossoverPathClear.addEventListener("click", clearCrossoverPath);
  if (els.butterflyClear) els.butterflyClear.addEventListener("click", clearButterfly);
  if (els.teaserClear) els.teaserClear.addEventListener("click", clearTeaserScan);
  if (els.networkPathClear) els.networkPathClear.addEventListener("click", clearNetwork);
  try { if (localStorage.getItem(SOUND_KEY) === "off") state.soundEnabled = false; } catch { /* storage unavailable */ }
  updateSoundButton();
  window.addEventListener("pointerdown", kickstartMusicOnFirstGesture);
  window.addEventListener("keydown", kickstartMusicOnFirstGesture);
  window.addEventListener("touchend", kickstartMusicOnFirstGesture);
  if (els.soundToggle) els.soundToggle.addEventListener("click", toggleSound);
  if (els.dnaClear) els.dnaClear.addEventListener("click", clearDna);
  if (els.dnaPickerClose) els.dnaPickerClose.addEventListener("click", closeDnaPicker);
  if (els.dnaPickerList) {
    els.dnaPickerList.addEventListener("click", (event) => {
      const item = event.target.closest("[data-dna-actor]");
      if (item) applyDna(item.dataset.dnaActor);
    });
  }
  if (els.tvaDossierClose) els.tvaDossierClose.addEventListener("click", closeDossier);
  if (els.tvaDossierContent) {
    els.tvaDossierContent.addEventListener("click", (event) => {
      const movieLink = event.target.closest("[data-dossier-movie]");
      if (movieLink) {
        closeDossier();
        openDetail(movieLink.dataset.dossierMovie);
        return;
      }
      const actorChip = event.target.closest("[data-dossier-actor]");
      if (actorChip) applyDna(actorChip.dataset.dossierActor);
    });
  }
  els.modeNoteClose.addEventListener("click", dismissModeNote);
  els.overlay.addEventListener("click", () => {
    closeDetail();
    if (state.dossierOpen) closeDossier();
    if (els.statsPanel && !els.statsPanel.hidden) closeStatsPanel();
    if (els.optimizerPanel && !els.optimizerPanel.hidden) toggleOptimizer(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.body.classList.contains("palette-open")) return;
    if (!starMenu.hidden) {
      closeStarMenu();
      return;
    }
    if (state.pinnedStar) {
      state.pinnedStar = null;
      render();
      return;
    }
    if (state.dossierOpen) {
      closeDossier();
      return;
    }
    if (state.dna) {
      clearDna();
      return;
    }
    if (els.gauntletPanel && !els.gauntletPanel.hidden) {
      toggleGauntletPanel(false);
      return;
    }
    if (els.statsPanel && !els.statsPanel.hidden) {
      closeStatsPanel();
      return;
    }
    if (els.optimizerPanel && !els.optimizerPanel.hidden) {
      toggleOptimizer(false);
      return;
    }
    if (els.detailPanel.classList.contains("is-open")) closeDetail();
    else if (state.crossoverPath) clearCrossoverPath();
    else if (state.butterflySource) clearButterfly();
    else if (state.teaserScan) clearTeaserScan();
    else clearNetwork();
  });

  // , / . — hop between stars in timeline order
  document.addEventListener("keydown", (e) => {
    if (e.key !== "," && e.key !== ".") return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const typing =
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) ||
      document.activeElement?.isContentEditable;
    if (typing) return;
    if (document.body.classList.contains("palette-open")) return;
    if (els.detailPanel.classList.contains("is-open")) return;
    if (!starMenu.hidden) {
      closeStarMenu();
      return;
    }
    const nodes = els.canvas.querySelectorAll(".movie-node");
    if (!nodes.length) return;
    let index = -1;
    nodes.forEach((node, i) => {
      if (node.dataset.id === state.focusedStar) index = i;
    });
    if (index === -1) index = e.key === "." ? -1 : 0;
    const delta = e.key === "." ? 1 : -1;
    const next = nodes[(index + delta + nodes.length) % nodes.length];
    if (!next) return;
    const movie = movieById(next.dataset.id);
    if (!movie) return;
    state.focusedStar = movie.id;
    next.focus({ preventScroll: true });
    const pos = nodePositions[movie.id];
    if (pos) {
      els.scrollArea.scrollTo({
        left: Math.max(0, pos.x * state.zoom - els.scrollArea.clientWidth / 2),
        behavior: "smooth",
      });
    }
  });

  let resizeDebounce;
  let wasMobile = window.innerWidth < 640;
  window.addEventListener("resize", () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      const isMobile = window.innerWidth < 640;
      if (isMobile !== wasMobile) state.mobileFitApplied = false;
      wasMobile = isMobile;
      if (isMobile) {
        resetDoomsdayPositionForViewport();
      } else if (!els.doomsdayCountdown.hidden && els.doomsdayCountdown.style.left) {
        placeDoomsdayCountdown(
          Number.parseFloat(els.doomsdayCountdown.style.left),
          Number.parseFloat(els.doomsdayCountdown.style.top)
        );
      }
      render();
    }, 200);
  });
  window.addEventListener("orientationchange", () => {
    state.mobileFitApplied = false;
    window.setTimeout(() => {
      resetDoomsdayPositionForViewport();
      render();
    }, 180);
  });

  els.routeFilter.addEventListener("change", () => {
    state.route = els.routeFilter.value;
    syncUrl();
    render();
  });
  els.universePickerTrigger.addEventListener("click", toggleUniversePicker);
  document.addEventListener("click", (event) => {
    if (!els.universePicker.contains(event.target)) closeUniversePicker();
  });
  els.journeyLaunch.addEventListener("click", () => {
    renderJourneyDashboard();
    renderPlanner();
    renderUpcoming();
    els.journeyDialog.showModal();
  });
  els.journeyClose.addEventListener("click", () => els.journeyDialog.close());
  els.journeyDialog.addEventListener("click", (event) => {
    if (event.target === els.journeyDialog) els.journeyDialog.close();
  });
  els.journeyShare.addEventListener("click", shareJourneyCard);
  els.journeyExport.addEventListener("click", exportJourney);
  els.journeyImport.addEventListener("click", () => els.journeyImportFile.click());
  els.journeyImportFile.addEventListener("change", importJourney);
  els.journeyClear.addEventListener("click", () => {
    if (!window.confirm("Clear every Watched, Watching, and Planned status on this device?")) return;
    state.journey = {};
    saveJourney();
    updateJourneySummary();
    buildUniversePicker();
    updateJourneyNodeVisuals();
    renderJourneyDashboard();
    renderPlanner();
    renderUpcoming();
  });

  document.querySelectorAll(".pathway-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = state.priorityFilter === btn.dataset.priority ? "" : btn.dataset.priority;
      state.priorityFilter = next;
      document.querySelectorAll(".pathway-btn").forEach((b) => {
        const active = b.dataset.priority === state.priorityFilter;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });
  document.querySelectorAll(".chip-filter").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = state.typeFilter === btn.dataset.type ? "" : btn.dataset.type;
      state.typeFilter = next;
      document.querySelectorAll(".chip-filter").forEach((b) => {
        const active = b.dataset.type === state.typeFilter;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      render();
    });
  });
  els.unwatchedToggle.addEventListener("change", () => {
    state.unwatchedOnly = els.unwatchedToggle.checked;
    render();
  });
  els.plannerHours.addEventListener("input", renderPlanner);
  els.plannerTarget.addEventListener("change", renderPlanner);
  els.plannerCredits.addEventListener("change", () => {
    state.includeCredits = els.plannerCredits.checked;
    renderPlanner();
    renderUpcoming();
  });
  els.plannerSpoilers.addEventListener("change", () => {
    state.spoilerSafe = els.plannerSpoilers.checked;
    render();
    if (els.detailPanel.classList.contains("is-open") && state.detailOpen) openDetail(state.detailOpen);
    renderPlanner();
  });
  els.plannerGenerate.addEventListener("click", generateSchedule);

  els.zoomIn.addEventListener("click", () => setZoom(state.zoom < .2 ? state.zoom * 1.5 : state.zoom + .1));
  els.zoomOut.addEventListener("click", () => setZoom(state.zoom <= .2 ? state.zoom / 1.5 : state.zoom - .1));
  els.zoomReset.addEventListener("click", () => setZoom(1));
  els.zoomFit.addEventListener("click", fitTimeline);

  if (els.phaseChips) {
    els.phaseChips.addEventListener("click", (event) => {
      const chip = event.target.closest(".phase-chip");
      if (!chip) return;
      const phase = chip.dataset.phase;
      if (state.phaseFilter === phase) {
        state.phaseFilter = "";
      } else {
        state.phaseFilter = phase;
      }
      syncEraControls();
      syncUrl();
      render();
      if (state.phaseFilter) window.setTimeout(() => scrollEraIntoView(state.phaseFilter), 60);
    });
  }
  if (els.eraSectionToggle) {
    els.eraSectionToggle.addEventListener("click", () => {
      state.eraMode = !state.eraMode;
      if (state.eraMode) {
        state.collapsedEras = new Set(state.data.movies.map((m) => m.phase).filter(Boolean));
      }
      syncEraControls();
      syncUrl();
      render();
    });
  }
  if (els.gauntletBtn) els.gauntletBtn.addEventListener("click", () => toggleGauntletPanel());
  if (els.gauntletPanelClose) els.gauntletPanelClose.addEventListener("click", () => toggleGauntletPanel(false));
  if (els.gauntletTabVisual) {
    els.gauntletTabVisual.addEventListener("click", () => {
      if (els.gauntletVisual) els.gauntletVisual.hidden = false;
      if (els.gauntletTimeline) els.gauntletTimeline.hidden = true;
      els.gauntletTabVisual.classList.add("is-active");
      els.gauntletTabTimeline.classList.remove("is-active");
    });
  }
  if (els.gauntletTabTimeline) {
    els.gauntletTabTimeline.addEventListener("click", () => {
      if (els.gauntletVisual) els.gauntletVisual.hidden = true;
      if (els.gauntletTimeline) els.gauntletTimeline.hidden = false;
      renderGauntletTimeline();
      els.gauntletTabTimeline.classList.add("is-active");
      els.gauntletTabVisual.classList.remove("is-active");
    });
  }
  if (els.gauntletReset) els.gauntletReset.addEventListener("click", resetGauntlet);
  if (els.gauntletTimeline) {
    els.gauntletTimeline.addEventListener("click", (event) => {
      const journey = event.target.closest("[data-gauntlet-journey]");
      if (!journey) return;
      const id = journey.dataset.gauntletJourney;
      const m = movieById(id);
      if (m) openDetail(id);
    });
  }
  if (els.variantBtn) els.variantBtn.addEventListener("click", toggleVariantScan);
  if (els.variantClear) els.variantClear.addEventListener("click", clearVariantScan);
  if (els.achievementsBtn) els.achievementsBtn.addEventListener("click", () => toggleAchievementsPanel());
  if (els.achievementsPanelClose) els.achievementsPanelClose.addEventListener("click", () => toggleAchievementsPanel(false));
  if (els.commuteBtn) els.commuteBtn.addEventListener("click", () => toggleCommuteMode());
  if (els.commuteModeClose) els.commuteModeClose.addEventListener("click", () => toggleCommuteMode(false));
  if (els.commuteSearch) {
    els.commuteSearch.addEventListener("input", () => {
      state.commuteQuery = els.commuteSearch.value;
      renderCommute();
    });
  }
  if (els.commuteOrder) {
    els.commuteOrder.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-commute-order]");
      if (!btn) return;
      state.commuteOrder = btn.dataset.commuteOrder;
      els.commuteOrder.querySelectorAll("[data-commute-order]").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      renderCommute();
    });
  }
  if (els.commuteList) {
    els.commuteList.addEventListener("click", (event) => {
      const card = event.target.closest("[data-commute-id]");
      if (!card) return;
      const id = card.dataset.commuteId;
      toggleCommuteMode(false);
      openDetail(id);
      revealTitle(id);
    });
  }
  if (els.playheadBtn) els.playheadBtn.addEventListener("click", () => togglePlayheadBar());
  if (els.playheadClear) els.playheadClear.addEventListener("click", clearPlayhead);
  bindOptimizerRows();
  if (els.statsBtn) els.statsBtn.addEventListener("click", () => toggleStatsPanel());
  if (els.statsPanelClose) els.statsPanelClose.addEventListener("click", closeStatsPanel);
  if (els.optimizerBtn) els.optimizerBtn.addEventListener("click", () => toggleOptimizer());
  if (els.optimizerPanelClose) els.optimizerPanelClose.addEventListener("click", () => toggleOptimizer(false));
  if (els.optimizerModes) {
    els.optimizerModes.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-optimizer-mode]");
      if (!btn) return;
      state.optimizer = btn.dataset.optimizerMode;
      els.optimizerModes.querySelectorAll("[data-optimizer-mode]").forEach((b) => {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });
      renderOptimizer();
    });
  }
  // New feature dock buttons (Round 6)
  const dockBtns = {
    quiz: document.getElementById("quiz-btn"),
    watchparty: document.getElementById("watchparty-btn"),
  };
  if (dockBtns.quiz) dockBtns.quiz.addEventListener("click", () => window.Quiz?.toggle());
  if (dockBtns.watchparty) dockBtns.watchparty.addEventListener("click", () => window.WatchParty?.toggle());
  if (els.playheadTrack) {
    const scrubFromEvent = (event) => {
      const rect = els.playheadTrack.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const { minYear, maxYear } = lastTimelineScale;
      const year = Math.round(minYear + ratio * (maxYear - minYear));
      setPlayhead(year);
    };
    els.playheadTrack.addEventListener("pointerdown", (event) => {
      scrubFromEvent(event);
      els.playheadTrack.setPointerCapture(event.pointerId);
      els.playheadTrack.addEventListener("pointermove", scrubFromEvent);
    });
    els.playheadTrack.addEventListener("pointerup", () => {
      els.playheadTrack.removeEventListener("pointermove", scrubFromEvent);
    });
    els.playheadTrack.addEventListener("pointercancel", () => {
      els.playheadTrack.removeEventListener("pointermove", scrubFromEvent);
    });
    els.playheadTrack.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
      event.preventDefault();
      const delta = event.key === "ArrowRight" ? 1 : -1;
      const { minYear, maxYear } = lastTimelineScale;
      setPlayhead(Math.max(minYear, Math.min(maxYear, (state.playhead ?? minYear) + delta)));
    });
  }
  els.scrollArea.addEventListener("wheel", handleZoomWheel, { passive: false });
  let scrollPauseRaf = 0;
  let scrollPauseTimer = 0;
  els.scrollArea.addEventListener("scroll", () => {
    if (!scrollPauseRaf) {
      scrollPauseRaf = requestAnimationFrame(() => {
        scrollPauseRaf = 0;
        document.body.classList.add("is-scrolling");
      });
    }
    clearTimeout(scrollPauseTimer);
    scrollPauseTimer = setTimeout(() => {
      document.body.classList.remove("is-scrolling");
    }, 160);
  }, { passive: true });

  if (!window.PointerEvent) {
    els.scrollArea.addEventListener("gesturestart", (event) => {
      event.preventDefault();
      gestureStartZoom = state.zoom;
    }, { passive: false });
    els.scrollArea.addEventListener("gesturechange", (event) => {
      event.preventDefault();
      setZoom(gestureStartZoom * event.scale, event.clientX, event.clientY);
    }, { passive: false });
  }
  els.scrollArea.addEventListener("pointerdown", handleTouchStart);
  els.scrollArea.addEventListener("pointermove", handleTouchMove, { passive: false });
  els.scrollArea.addEventListener("pointermove", (e) => {
    if (previewVisible) movePreview(e.clientX, e.clientY);
  }, { passive: true });
  els.scrollArea.addEventListener("pointerup", handleTouchEnd);
  els.scrollArea.addEventListener("pointercancel", handleTouchEnd);
  els.scrollArea.addEventListener("click", (event) => {
    if (performance.now() >= suppressTimelineClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  // --- Long-press alternative for touch devices ---
  {
    let lpTimer = null;
    let lpTarget = null;
    document.addEventListener("touchstart", (e) => {
      const n = e.target.closest(".movie-node");
      if (!n) return;
      lpTarget = n;
      lpTimer = setTimeout(() => {
        if (lpTarget) {
          const id = lpTarget.dataset.id;
          if (id) {
            const mv = movieById(id);
            if (mv) openStarMenu(mv, lpTarget.getBoundingClientRect().left + 20, lpTarget.getBoundingClientRect().top + 20);
          }
        }
        lpTarget = null;
      }, 500);
    }, { passive: true });
    document.addEventListener("touchend", () => { clearTimeout(lpTimer); lpTarget = null; }, { passive: true });
    document.addEventListener("touchmove", () => { clearTimeout(lpTimer); lpTarget = null; }, { passive: true });
    // Prevent native context menu on long-press
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest(".movie-node")) e.preventDefault();
    }, false);
  }
}

function clampZoom(value) {
  return Math.max(.02, Math.min(1.6, value));
}

function updateTimelineScale() {
  const width = Number(els.timelineContent.dataset.width) || 0;
  const height = Number(els.timelineContent.dataset.height) || 0;
  els.timelineContent.style.transform = `scale(${state.zoom})`;
  els.timelineStage.style.width = `${width * state.zoom}px`;
  els.timelineStage.style.height = `${height * state.zoom}px`;
  els.zoomReset.textContent = `${Math.round(state.zoom * 100)}%`;
  els.zoomIn.disabled = state.zoom >= 1.6;
  els.zoomOut.disabled = state.zoom <= .02;
}

function setZoom(value, clientX = null, clientY = null) {
  const nextZoom = clampZoom(Math.round(value * 1000) / 1000);
  if (nextZoom === state.zoom) return;

  const rect = els.scrollArea.getBoundingClientRect();
  const anchorX = clientX === null ? rect.width / 2 : clientX - rect.left;
  const anchorY = clientY === null ? rect.height / 2 : clientY - rect.top;
  const contentX = (els.scrollArea.scrollLeft + anchorX) / state.zoom;
  const contentY = (els.scrollArea.scrollTop + anchorY) / state.zoom;
  state.zoom = nextZoom;
  updateTimelineScale();
  els.scrollArea.scrollLeft = Math.max(0, contentX * state.zoom - anchorX);
  els.scrollArea.scrollTop = Math.max(0, contentY * state.zoom - anchorY);
}

function handleZoomWheel(event) {
  if (!event.ctrlKey) return;
  event.preventDefault();
  const sensitivity = event.deltaMode === 0 ? .004 : .04;
  setZoom(state.zoom * Math.exp(-event.deltaY * sensitivity), event.clientX, event.clientY);
}

function touchDistance() {
  const [a, b] = [...touchPoints.values()];
  return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
}

function touchCenter() {
  const points = [...touchPoints.values()];
  if (points.length < 2) return points[0] || { x: 0, y: 0 };
  return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
}

function resetTouchGesture() {
  const center = touchCenter();
  touchGesture = {
    x: center.x,
    y: center.y,
    scrollLeft: els.scrollArea.scrollLeft,
    scrollTop: els.scrollArea.scrollTop,
    distance: touchDistance(),
    zoom: state.zoom,
    moved: false,
    mode: touchPoints.size >= 2 ? "pinch" : "pending"
  };
}

function handleTouchStart(event) {
  if (event.pointerType !== "touch") return;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  resetTouchGesture();
  els.scrollArea.classList.add("is-touching");
}

function handleTouchMove(event) {
  if (event.pointerType !== "touch" || !touchPoints.has(event.pointerId)) return;
  touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (!touchGesture) resetTouchGesture();

  if (touchPoints.size >= 2) {
    event.preventDefault();
    if (!els.scrollArea.hasPointerCapture(event.pointerId)) {
      els.scrollArea.setPointerCapture(event.pointerId);
    }
    touchGesture.moved = true;
    touchGesture.mode = "pinch";
    const center = touchCenter();
    const ratio = touchGesture.distance ? touchDistance() / touchGesture.distance : 1;
    setZoom(touchGesture.zoom * ratio, center.x, center.y);
    return;
  }

  const point = touchCenter();
  const deltaX = point.x - touchGesture.x;
  const deltaY = point.y - touchGesture.y;
  if (touchGesture.mode === "pending" && Math.hypot(deltaX, deltaY) < 7) return;
  event.preventDefault();
  if (!els.scrollArea.hasPointerCapture(event.pointerId)) {
    els.scrollArea.setPointerCapture(event.pointerId);
  }
  touchGesture.mode = "pan";
  touchGesture.moved = true;
  els.scrollArea.scrollLeft = touchGesture.scrollLeft - deltaX;
  els.scrollArea.scrollTop = touchGesture.scrollTop - deltaY;
}

function handleTouchEnd(event) {
  if (event.pointerType !== "touch") return;
  const moved = touchGesture?.moved;
  if (els.scrollArea.hasPointerCapture(event.pointerId)) {
    els.scrollArea.releasePointerCapture(event.pointerId);
  }
  touchPoints.delete(event.pointerId);
  if (moved) suppressTimelineClickUntil = performance.now() + 350;
  if (touchPoints.size) {
    resetTouchGesture();
  } else {
    touchGesture = null;
    els.scrollArea.classList.remove("is-touching");
  }
}

function fitTimeline() {
  if (window.matchMedia("(max-width: 639px)").matches) {
    setZoom(.5);
    els.scrollArea.scrollTo({ left: 0, top: 0, behavior: "smooth" });
    return;
  }

  const width = Number(els.timelineContent.dataset.width) || 1;
  const height = Number(els.timelineContent.dataset.height) || 1;
  const availableWidth = Math.max(1, els.scrollArea.clientWidth - 32);
  const scrollRect = els.scrollArea.getBoundingClientRect();
  const availableHeight = Math.max(220, window.innerHeight - scrollRect.top - 28);
  setZoom(Math.min(1, availableWidth / width, availableHeight / height));
  els.scrollArea.scrollTo({ left: 0, behavior: "smooth" });
}

function dismissModeNote() {
  if (state.modeNoteDismissed || els.modeNote.classList.contains("is-snapping")) return;
  state.modeNoteDismissed = true;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.modeNote.hidden = true;
    document.body.classList.add("mode-note-dismissed");
    return;
  }

  const colors = ["#f5f5f7", "#a7a7b7", "#3ddc84", "#22d3ee"];
  const particleCount = window.innerWidth < 640 ? 32 : 48;
  for (let index = 0; index < particleCount; index += 1) {
    const particle = document.createElement("i");
    particle.className = "mode-note__particle";
    particle.style.setProperty("--particle-x", `${18 + Math.random() * 78}%`);
    particle.style.setProperty("--particle-y", `${8 + Math.random() * 84}%`);
    particle.style.setProperty("--particle-dx", `${30 + Math.random() * 110}px`);
    particle.style.setProperty("--particle-dy", `${-55 + Math.random() * 110}px`);
    particle.style.setProperty("--particle-delay", `${Math.random() * 280}ms`);
    particle.style.setProperty("--particle-size", `${2 + Math.random() * 5}px`);
    particle.style.setProperty("--particle-color", colors[index % colors.length]);
    els.modeNote.appendChild(particle);
  }

  els.modeNote.classList.add("is-snapping");
  window.setTimeout(() => {
    els.modeNote.hidden = true;
    document.body.classList.add("mode-note-dismissed");
    els.modeNote.classList.remove("is-snapping");
    els.modeNote.querySelectorAll(".mode-note__particle").forEach((particle) => particle.remove());
  }, 1250);
}

function hydrateStateFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.get("mode") === "release") state.sortMode = "release";
  state.query = (params.get("query") || "").toLowerCase();
  state.crossoverOnly = params.get("crossovers") === "1";
  state.route = params.get("route") || "";
  const visibleLines = params.get("lines");
  if (visibleLines) {
    const visible = new Set(visibleLines.split(","));
    state.hiddenLines = new Set(state.data.lines.map((line) => line.id).filter((id) => !visible.has(id)));
  }
  const phaseParam = params.get("phase");
  state.phaseFilter = phaseParam && state.data.movies.some((m) => m.phase === phaseParam) ? phaseParam : "";
  state.eraMode = params.get("sections") === "1";
  const collapseParam = params.get("collapse");
  state.collapsedEras = collapseParam
    ? new Set(collapseParam.split(",").filter((phase) => state.data.movies.some((m) => m.phase === phase)))
    : new Set();
  els.searchInput.value = state.query;
  els.routeFilter.value = state.route;
  if (params.get("variant") === "1") state.variantScan = true;
  else {
    try {
      if (localStorage.getItem("nexus.variant-scan") === "1") state.variantScan = true;
    } catch (e) { /* storage unavailable */ }
  }
  const playheadParam = params.get("playhead");
  if (playheadParam) state.playhead = Number(playheadParam);
  else {
    try {
      const stored = Number(localStorage.getItem("nexus.playhead"));
      if (Number.isFinite(stored) && stored > 0) state.playhead = stored;
    } catch (e) { /* storage unavailable */ }
  }
  const gemParam = params.get("gems");
  if (gemParam) {
    const collected = new Set(gemParam.split(",").filter((id) => stoneById(id)));
    if (collected.size) state.gauntlet = collected;
  }
  document.querySelectorAll(".sort-btn").forEach((button) => {
    const active = button.dataset.sort === state.sortMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  els.modeNote.hidden = state.sortMode !== "story" || state.modeNoteDismissed;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.sortMode !== "story") params.set("mode", state.sortMode);
  if (state.query) params.set("query", state.query);
  if (state.crossoverOnly) params.set("crossovers", "1");
  if (state.route) params.set("route", state.route);
  const visible = state.data.lines.map((line) => line.id).filter((id) => !state.hiddenLines.has(id));
  if (visible.length !== state.data.lines.length) params.set("lines", visible.join(","));
  if (state.phaseFilter) params.set("phase", state.phaseFilter);
  if (state.eraMode) {
    params.set("sections", "1");
    if (state.collapsedEras.size) params.set("collapse", [...state.collapsedEras].join(","));
  }
  if (state.variantScan) params.set("variant", "1");
  if (state.playhead != null) params.set("playhead", String(state.playhead));
  if (state.gauntlet.size) params.set("gems", [...state.gauntlet].join(","));
  const next = `${location.pathname}${params.size ? `?${params}` : ""}`;
  history.replaceState(null, "", next);
}

// ------------------------------------------------------------
// Era filter chips + collapsible sections
// ------------------------------------------------------------

function buildPhaseChips() {
  const chips = els.phaseChips;
  if (!chips) return;
  const counts = new Map();
  state.data.movies.forEach((m) => {
    if (m.phase) counts.set(m.phase, (counts.get(m.phase) || 0) + 1);
  });
  chips.innerHTML = "";
  const all = document.createElement("button");
  all.type = "button";
  all.className = "phase-chip is-active";
  all.dataset.phase = "";
  all.setAttribute("aria-pressed", "true");
  all.textContent = "All eras";
  chips.appendChild(all);
  Object.keys(PHASE_NUM).forEach((phase) => {
    if (!counts.has(phase)) return;
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "phase-chip";
    chip.dataset.phase = phase;
    chip.style.setProperty("--phase-color", PHASE_COLORS[phase] || "#3ddc84");
    chip.setAttribute("aria-pressed", "false");
    chip.innerHTML =
      `<span class="phase-chip__dot" aria-hidden="true"></span>` +
      `Phase ${phaseNumber(phase)}` +
      `<span class="phase-chip__count">${counts.get(phase)}</span>`;
    chips.appendChild(chip);
  });
}

function syncEraControls() {
  if (els.phaseChips) {
    els.phaseChips.querySelectorAll(".phase-chip").forEach((chip) => {
      const active = chip.dataset.phase === state.phaseFilter;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
  }
  if (els.eraSectionToggle) {
    els.eraSectionToggle.classList.toggle("is-active", state.eraMode);
    els.eraSectionToggle.setAttribute("aria-pressed", String(state.eraMode));
  }
}

function scrollEraIntoView(phase) {
  if (!phase) return;
  const area = els.scrollArea;
  if (!area) return;
  const band = els.canvas.querySelector(`.era-band[data-phase="${phase}"]`);
  if (!band) return;
  const targetX = band.offsetLeft * state.zoom - area.clientWidth / 2;
  area.scrollTo({ left: Math.max(0, targetX), behavior: "smooth" });
}

// ------------------------------------------------------------
// (The cinematic intro splash was removed in the Doomsday pass.)
// ------------------------------------------------------------

function revealTitle(id) {
  const area = els.scrollArea;
  if (!area || !movieById(id)) return;
  const node = area.querySelector(`.movie-node[data-id="${id}"]`);
  if (!node) return;
  const targetX = node.offsetLeft * state.zoom - area.clientWidth / 2;
  area.scrollTo({ left: Math.max(0, targetX), behavior: "smooth" });
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function nextPaint() {
  // Yield a frame so the browser can paint between build steps, but never
  // depend on requestAnimationFrame alone — in headless/background tabs it can
  // stall for a long time, which previously left the timeline half-built.
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    requestAnimationFrame(finish);
    setTimeout(finish, 80);
  });
}

// Renders are serialized so a fast second state change can never abort a render
// that is already mid-flight (which previously left the canvas cleared and the
// timeline empty whenever requestAnimationFrame was delayed, e.g. headless).
let renderRunning = false;
let renderWanted = false;

function render() {
  renderWanted = true;
  if (renderRunning) return;
  renderRunning = true;
  void (async () => {
    try {
      while (renderWanted) {
        renderWanted = false;
        await renderOnce();
      }
    } finally {
      renderRunning = false;
    }
  })();
}

async function renderOnce() {
  const generation = ++renderGeneration;
  const entrance = !entrancePlayed;
  entrancePlayed = true;
  let entranceIndex = 0;
  const mode = state.sortMode;
  const spoilerBoundary = state.spoilerSafe ? spoilerFrontier() : -1;
  const activePath = state.crossoverPath
    ? crossoverPathFor(state.crossoverPath.sourceId)
    : null;
  els.canvas.classList.toggle("is-path-mode", !!activePath);
  els.crossoverPathBar.hidden = !activePath;
  const butterfly = state.butterflySource
    ? { sourceId: state.butterflySource, ids: butterflyDownstreamSet(state.butterflySource) }
    : null;
  els.canvas.classList.toggle("is-butterfly-mode", !!butterfly);
  els.butterflyBar.hidden = !butterfly;
  if (butterfly) {
    const source = movieById(butterfly.sourceId);
    const unraveled = butterfly.ids.size - 1;
    els.butterflySummary.innerHTML = unraveled > 0
      ? `<strong>What if <b style="color:var(--text)">${escapeHtml(source.title)}</b> never happened?</strong> ${unraveled} later ${unraveled === 1 ? "title" : "titles"} lose their causal thread`
      : `<strong>What if <b style="color:var(--text)">${escapeHtml(source.title)}</b> never happened?</strong> no later title shares its thread`;
  }
  const teaser = state.teaserScan
    ? { sourceId: state.teaserScan, targets: teaserTargets(state.teaserScan) }
    : null;
  const teaserIds = teaser ? new Set([teaser.sourceId, ...teaser.targets.map((t) => t.to)]) : null;
  const teaserLanes = teaser
    ? new Set([...teaserIds].map((id) => movieById(id)?.line).filter(Boolean))
    : null;
  els.canvas.classList.toggle("is-teaser-mode", !!teaser);
  els.teaserBar.hidden = !teaser;
  if (teaser) {
    const source = movieById(teaser.sourceId);
    const names = teaser.targets.map((t) => movieById(t.to)?.title).filter(Boolean);
    els.teaserSummary.innerHTML = teaser.targets.length
      ? `<strong>${escapeHtml(source.title)}</strong> sets up ${names.map((n) => `<b style="color:var(--text)">${escapeHtml(n)}</b>`).join(", ")}`
      : `<strong>${escapeHtml(source.title)}</strong> sets up nothing in this dataset`;
  }
  const activeNetwork = state.network ? state.network : null;
  const activeNetworkIds = activeNetwork
    ? new Set(activeNetwork.ids.filter((id) => movieById(id)))
    : null;
  const activePhaseIds = state.phaseFilter
    ? new Set(state.data.movies.filter((m) => m.phase === state.phaseFilter).map((m) => m.id))
    : null;
  const activeNetworkLines = activeNetwork && activeNetworkIds
    ? new Set([...activeNetworkIds].map((id) => movieById(id).line))
    : null;
  const variantSet = state.variantScan ? variantSetFor() : null;
  updateExperimentChrome();
  els.dnaBar.hidden = !state.dna;
  if (state.dna && els.dnaBar) {
    const universes = new Set(state.dna.ids.map((id) => movieById(id)?.line).filter(Boolean));
    els.dnaSummary.innerHTML = `<strong>${escapeHtml(state.dna.actor)}</strong> (${escapeHtml(state.dna.character)}) · ${state.dna.ids.length} titles across ${universes.size} ${universes.size === 1 ? "universe" : "universes"}`;
  }
  els.canvas.classList.toggle("is-network-mode", !!activeNetwork);
  els.castLaunch?.classList.toggle("is-active", !!activeNetwork);
  if (els.networkPathBar) els.networkPathBar.hidden = !activeNetwork;
  if (activeNetwork) {
    els.networkPathBar.style.setProperty("--network-color", activeNetwork.color);
    els.networkPathGem.style.setProperty("--network-color", activeNetwork.color);
    els.networkPathSummary.innerHTML = `<strong>${activeNetwork.name}</strong> · ${activeNetwork.role} · ${activeNetworkIds.size} titles`;
  }
  if (activePath) {
    const source = movieById(activePath.sourceId);
    const routeText = activePath.routes.length
      ? ` · ${activePath.routes.map((route) => route.replace("-", " ")).join(" + ")} route`
      : "";
    els.crossoverPathSummary.innerHTML = `<strong>${source.title}</strong> · ${activePath.ids.size} connected titles${routeText} · click again for details`;
  }
  const mobile = window.innerWidth < 640;
  const order = laneOrder();
  els.timelineWrapper?.setAttribute("aria-busy", "true");

  const timelineMovies = state.data.movies.filter(
    (m) => movieYearValue(m, mode) !== null &&
      (!state.crossoverOnly || isCrossover(m)) &&
      routeMatches(m, state.route)
  );

  if (!timelineMovies.length) {
    els.resultCount.textContent = "0 titles";
    els.canvas.innerHTML = '<div class="app-state"><strong>No titles match these filters.</strong><span>Select a universe or clear the crossover filter.</span></div>';
    els.timelineWrapper?.setAttribute("aria-busy", "false");
    return;
  }

  const visibleCount = timelineMovies.filter((movie) => !state.hiddenLines.has(movie.line)).length;
  els.resultCount.textContent = `${visibleCount} ${visibleCount === 1 ? "title" : "titles"}`;

  const values = timelineMovies.map((m) => movieYearValue(m, mode));
  const minYear = Math.floor(Math.min(...values));
  const maxYear = Math.ceil(Math.max(...values));
  const range = Math.max(1, maxYear - minYear);

  // In-universe order spans many decades, but most MCU releases occupy a much
  // shorter period. A wider scale keeps those dense modern labels readable.
  const pxPerYear = range <= 32 ? 150 : Math.max(54, 6800 / range);

  const xFor = (val) => LEFT_PAD + (val - minYear) * pxPerYear;
  lastTimelineScale = { minYear, maxYear, pxPerYear };
  // group + sort movies per lane
  const byLane = {};
  order.forEach((id) => (byLane[id] = []));
  timelineMovies.forEach((m) => {
    if (!byLane[m.line]) return;
    byLane[m.line].push(m);
  });
  Object.values(byLane).forEach((arr) => arr.sort((a, b) => movieYearValue(a, mode) - movieYearValue(b, mode)));

  const nodeX = {};
  let furthestNodeX = 0;
  const connectedLines = connectedTimelineLines();
  // Butterfly lanes: a universe's whole thread snaps when every later title
  // in it (past the removed star) is doomed — used to dim lane rails too.
  const lanesAllAffected = new Set();
  if (butterfly) {
    order.forEach((laneId) => {
      const laneMovies = byLane[laneId] || [];
      const others = laneMovies.filter((m) => m.id !== butterfly.sourceId);
      if (others.length && others.every((m) => butterfly.ids.has(m.id))) {
        lanesAllAffected.add(laneId);
      }
    });
  }
  const mainlineStartX = byLane.mcu.length
    ? xFor(movieYearValue(byLane.mcu[0], mode))
    : LEFT_PAD;
  const xMenStartX = byLane.xmen.length
    ? xFor(movieYearValue(byLane.xmen[0], mode))
    : mainlineStartX;
  // Connected routes retain their chronological entry point. Independent
  // realities share the MCU's starting axis so the map has a clean left edge.
  Object.entries(byLane).forEach(([lineId, entries]) => {
    if (!entries.length) return;
    const alignsWithXMen = lineId === "spiderSony" || lineId === "sonyVillains";
    const laneStartX = alignsWithXMen
      ? xMenStartX
      : connectedLines.has(lineId)
        ? xFor(movieYearValue(entries[0], mode))
        : mainlineStartX;
    entries.forEach((entry, index) => {
      const spacedX = laneStartX + index * NODE_GAP;
      nodeX[entry.id] = spacedX;
      furthestNodeX = Math.max(furthestNodeX, spacedX);
    });
  });

  const totalWidth = Math.max(xFor(maxYear), furthestNodeX) + RIGHT_PAD;
  const totalHeight = TOP_PAD + order.length * LANE_HEIGHT + BOTTOM_PAD;
  const laneY = (laneId) => TOP_PAD + order.indexOf(laneId) * LANE_HEIGHT + LANE_HEIGHT / 2;

  // -------- canvas sizing --------
  els.canvas.style.width = totalWidth + "px";
  els.canvas.style.height = totalHeight + "px";
  els.svg.setAttribute("width", totalWidth);
  els.svg.setAttribute("height", totalHeight);
  els.svg.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);
  els.timelineContent.dataset.width = String(totalWidth);
  els.timelineContent.dataset.height = String(totalHeight);
  els.timelineContent.style.width = `${totalWidth}px`;
  els.timelineContent.style.height = `${totalHeight}px`;
  updateTimelineScale();

  // clear previous nodes/tracks/labels (keep svg element itself)
  Array.from(els.canvas.children).forEach((child) => {
    if (child !== els.svg) child.remove();
  });
  els.svg.innerHTML = "";

  // -------- year ruler (mono ticks across the top) --------
  const tickStep = range <= 20 ? 5 : 10;
  const firstTick = Math.ceil(minYear / tickStep) * tickStep;
  const ruler = document.createElement("div");
  ruler.className = "timeline-ruler";
  ruler.setAttribute("aria-hidden", "true");
  for (let y = firstTick; y <= maxYear; y += tickStep) {
    const tick = document.createElement("span");
    tick.className = "timeline-ruler__tick";
    tick.style.left = xFor(y) + "px";
    tick.innerHTML = `<i></i><em>${y}</em>`;
    ruler.appendChild(tick);
  }
  els.canvas.appendChild(ruler);

  // -------- phase era zones (subtle columns behind the lanes) --------
  const phaseRanges = new Map();
  const phaseCounts = new Map();
  state.data.movies.forEach((m) => {
    if (!m.phase || state.hiddenLines.has(m.line)) return;
    const x = nodeX[m.id];
    if (x == null) return;
    phaseCounts.set(m.phase, (phaseCounts.get(m.phase) || 0) + 1);
    const range = phaseRanges.get(m.phase) || { min: Infinity, max: -Infinity };
    range.min = Math.min(range.min, x);
    range.max = Math.max(range.max, x);
    phaseRanges.set(m.phase, range);
  });
  [...phaseRanges.entries()]
    .sort((a, b) => phaseNumber(a[0]) - phaseNumber(b[0]))
    .forEach(([phase, range]) => {
      const band = document.createElement("div");
      band.className = "era-band";
      band.dataset.phase = phase;
      band.style.setProperty("--phase-color", PHASE_COLORS[phase] || "#3ddc84");
      band.classList.toggle("is-filtered", state.phaseFilter === phase);
      if (state.eraMode) {
        band.classList.add("is-section");
        const collapsed = state.collapsedEras.has(phase);
        band.classList.toggle("is-collapsed", collapsed);
        const header = document.createElement("button");
        header.type = "button";
        header.className = "era-band__header";
        header.setAttribute("aria-expanded", String(!collapsed));
        header.innerHTML =
          `<span class="era-band__header-title">Phase ${phaseNumber(phase)}</span>` +
          `<span class="era-band__header-count">${phaseCounts.get(phase) || 0} titles</span>` +
          `<span class="era-band__header-chevron" aria-hidden="true"></span>`;
        header.addEventListener("click", () => {
          if (state.collapsedEras.has(phase)) state.collapsedEras.delete(phase);
          else state.collapsedEras.add(phase);
          syncUrl();
          render();
        });
        band.appendChild(header);
      } else {
        const label = document.createElement("span");
        label.className = "era-band__label";
        label.textContent = "Phase " + phaseNumber(phase);
        band.appendChild(label);
      }
      band.style.left = range.min - 26 + "px";
      band.style.width = range.max - range.min + 52 + "px";
      band.style.height = totalHeight + "px";
      els.canvas.appendChild(band);
    });

  nodePositions = {}; // id -> {x,y,lineColor} (shared for trails/overlays)

  // Give sizing and ruler changes a frame to paint before creating nodes.
  await nextPaint();
  if (generation !== renderGeneration) return;

  order.forEach((laneId) => {
    const line = lineById(laneId);
    const movies = byLane[laneId];
    const hidden = state.hiddenLines.has(laneId);
    const y = laneY(laneId);
    const labelSlots = Array(2).fill(-Infinity);

    if (movies.length && !hidden) {
      const x1 = nodeX[movies[0].id];
      const x2 = nodeX[movies[movies.length - 1].id];
      const track = document.createElement("div");
      track.className = "lane-track";
      track.dataset.line = laneId;
      if (activePath) {
        track.classList.toggle("is-path-active", activePath.lines.has(laneId));
        track.classList.toggle("is-path-dimmed", !activePath.lines.has(laneId));
      }
      if (activeNetwork) {
        track.classList.toggle("is-network-active", activeNetworkLines.has(laneId));
        track.classList.toggle("is-network-dimmed", !activeNetworkLines.has(laneId));
        if (activeNetworkLines.has(laneId)) track.style.setProperty("--network-color", activeNetwork.color);
      }
      if (butterfly && lanesAllAffected.has(laneId)) {
        track.classList.add("is-butterfly-dimmed");
      }
      if (teaser) {
        track.classList.toggle("is-teaser-active", teaserLanes.has(laneId));
        track.classList.toggle("is-teaser-dimmed", !teaserLanes.has(laneId));
      }
      if (activePhaseIds && !movies.some((m) => activePhaseIds.has(m.id))) {
        track.classList.add("is-phase-dimmed");
      }
      track.style.left = x1 + "px";
      track.style.top = y - 1.5 + "px";
      track.style.width = Math.max(2, x2 - x1) + "px";
      track.style.color = line.color;
      track.style.setProperty("--line-color", line.color);
      if (laneId === "mcu") track.style.height = "5px";
      els.canvas.appendChild(track);

      // Constellation line-art: trace each universe's stars into a star-chart
      // sketch. Segments link consecutive visible titles with a gentle bend, so
      // every lane reads as its own constellation rather than a straight rule.
      const laneConstellationNS = "http://www.w3.org/2000/svg";
      const laneSeed = order.indexOf(laneId) * 2.6;
      const visibleMovies = movies.filter(
        (m) => !(state.eraMode && m.phase && state.collapsedEras.has(m.phase))
      );
      if (visibleMovies.length >= 2) {
        const pts = visibleMovies
          .map((m, i) => {
            const px = nodeX[m.id];
            if (px == null) return null;
            const bend = i > 0 && i < visibleMovies.length - 1 ? Math.sin(i + laneSeed) * 2.6 : 0;
            return { x: px, y: y + bend };
          })
          .filter(Boolean);
        if (pts.length >= 2) {
          const group = document.createElementNS(laneConstellationNS, "g");
          group.setAttribute("class", "lane-constellation");
          group.dataset.line = laneId;
          group.style.setProperty("--line-color", line.color);
          if (activePath) {
            group.classList.toggle("is-path-active", activePath.lines.has(laneId));
            group.classList.toggle("is-path-dimmed", !activePath.lines.has(laneId));
          }
          if (activeNetwork) {
            group.classList.toggle("is-network-active", activeNetworkLines.has(laneId));
            group.classList.toggle("is-network-dimmed", !activeNetworkLines.has(laneId));
          }
          if (butterfly && lanesAllAffected.has(laneId)) {
            group.classList.add("is-butterfly-dimmed");
          }
          if (teaser) {
            group.classList.toggle("is-teaser-active", teaserLanes.has(laneId));
            group.classList.toggle("is-teaser-dimmed", !teaserLanes.has(laneId));
          }
          if (activePhaseIds && !movies.some((m) => activePhaseIds.has(m.id))) {
            group.classList.add("is-phase-dimmed");
          }
          const path = document.createElementNS(laneConstellationNS, "path");
          path.setAttribute(
            "d",
            pts.map((p, i) => (i ? "L" : "M") + ` ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
          );
          path.setAttribute("class", "lane-constellation__line");
          path.setAttribute("stroke", line.color);
          path.setAttribute("stroke-width", laneId === "mcu" ? "1.7" : "1.1");
          path.setAttribute("fill", "none");
          path.setAttribute("stroke-dasharray", laneId === "mcu" ? "2 5" : "3 8");
          path.setAttribute("stroke-linecap", "round");
          group.appendChild(path);
          pts.forEach((p) => {
            const joint = document.createElementNS(laneConstellationNS, "circle");
            joint.setAttribute("class", "lane-constellation__joint");
            joint.setAttribute("cx", String(p.x));
            joint.setAttribute("cy", String(p.y));
            joint.setAttribute("r", laneId === "mcu" ? "1.5" : "1.1");
            joint.setAttribute("fill", line.color);
            group.appendChild(joint);
          });
          els.svg.appendChild(group);
        }
      }

      const label = document.createElement("div");
      label.className = "lane-label";
      if (activePath) {
        label.classList.toggle("is-path-active", activePath.lines.has(laneId));
        label.classList.toggle("is-path-dimmed", !activePath.lines.has(laneId));
      }
      if (activeNetwork) {
        label.classList.toggle("is-network-active", activeNetworkLines.has(laneId));
        label.classList.toggle("is-network-dimmed", !activeNetworkLines.has(laneId));
        if (activeNetworkLines.has(laneId)) label.style.setProperty("--network-color", activeNetwork.color);
      }
      if (butterfly && lanesAllAffected.has(laneId)) {
        label.classList.add("is-butterfly-dimmed");
      }
      if (teaser) {
        label.classList.toggle("is-teaser-active", teaserLanes.has(laneId));
        label.classList.toggle("is-teaser-dimmed", !teaserLanes.has(laneId));
      }
      if (activePhaseIds && !movies.some((m) => activePhaseIds.has(m.id))) {
        label.classList.add("is-phase-dimmed");
      }
      label.style.left = Math.max(4, x1 - 6) + "px";
      label.style.top = y - LANE_HEIGHT / 2 + 6 + "px";
      label.style.color = line.color;
      label.style.borderColor = line.color + "55";
      label.textContent = line.name;
      els.canvas.appendChild(label);
    }

    movies.forEach((m) => {
      const x = nodeX[m.id];
      nodePositions[m.id] = { x, y, color: line.color };
      if (hidden) return;

      const phaseDimmed = activePhaseIds && !activePhaseIds.has(m.id);
      const collapsedPhase = state.eraMode && !!m.phase && state.collapsedEras.has(m.phase);
      if (collapsedPhase) return;

      const milestone = isMilestone(m);
      const r = milestone ? MILESTONE_R : NODE_R;
      const matched = state.query && matchesQuery(m);
      const dimmed = state.query && !matched;
      const priorityDim = !priorityPasses(m);
      const typeDim = !typePasses(m);
      const unwatchedDim = state.unwatchedOnly && state.journey[m.id] === "watched";
      const spoilerLocked = isSpoilerLocked(m, spoilerBoundary);

      const node = document.createElement("button");
      node.className = "movie-node";
      if (entrance) {
        node.style.setProperty("--i", String(Math.min(entranceIndex++, 64)));
        node.classList.add("is-entering");
      }
      if (milestone) node.classList.add("is-milestone");
      if (m.status === "upcoming") node.classList.add("is-upcoming");
      if (isCrossover(m)) node.classList.add("is-crossover");
      if (/Avengers/.test(m.title)) node.classList.add("is-event");
      if (m.type === "series") node.classList.add("is-series");
      if (dimmed) node.classList.add("is-dimmed");
      if (matched) node.classList.add("is-matched");
      if (phaseDimmed) node.classList.add("is-phase-dimmed");
      if (priorityDim) node.classList.add("is-priority-dimmed");
      if (typeDim) node.classList.add("is-type-dimmed");
      if (unwatchedDim) node.classList.add("is-unwatched-dimmed");
      if (spoilerLocked) node.classList.add("is-spoiler");
      const journeyStatus = state.journey[m.id];
      if (journeyStatus) {
        node.classList.add(`is-${journeyStatus}`);
        node.dataset.journey = journeyStatus;
      }
      if (activePath) {
        node.classList.toggle("is-path-active", activePath.ids.has(m.id));
        node.classList.toggle("is-path-source", activePath.sourceId === m.id);
        node.classList.toggle("is-path-dimmed", !activePath.ids.has(m.id));
      }
      if (activeNetwork) {
        node.classList.toggle("is-network-active", activeNetworkIds.has(m.id));
        node.classList.toggle("is-network-dimmed", !activeNetworkIds.has(m.id));
        if (activeNetworkIds.has(m.id)) node.style.setProperty("--network-color", activeNetwork.color);
      }
      if (butterfly) {
        node.classList.toggle("is-butterfly-source", butterfly.sourceId === m.id);
        node.classList.toggle("is-butterfly-dimmed", butterfly.ids.has(m.id) && butterfly.sourceId !== m.id);
      }
      if (teaser) {
        node.classList.toggle("is-teaser-source", teaser.sourceId === m.id);
        node.classList.toggle("is-teaser-lit", teaserIds.has(m.id) && teaser.sourceId !== m.id);
        node.classList.toggle("is-teaser-dimmed", !teaserIds.has(m.id));
      }
      if (state.variantScan) {
        const isVariant = variantSet.has(m.id);
        node.classList.toggle("is-variant", isVariant);
        node.classList.toggle("is-variant-dimmed", !isVariant);
      }
      if (state.visited.has(m.id)) node.classList.add("is-visited");
      node.classList.toggle(
        "is-beyond-playhead",
        state.playhead != null && (movieYearValue(m, "story") ?? Infinity) > state.playhead
      );
      if (state.dna) {
        node.classList.toggle("is-dna-lit", state.dna.ids.includes(m.id));
        node.classList.toggle("is-dna-dimmed", !state.dna.ids.includes(m.id));
      }
      node.style.left = x + "px";
      node.style.top = y + "px";
      node.style.width = r * 2 + "px";
      node.style.height = r * 2 + "px";
      node.style.background = line.color;
      node.style.setProperty("--node-color", line.color);
      const coreSpan = document.createElement("span");
      coreSpan.className = "movie-node__core";
      node.appendChild(coreSpan);
      const carryStones = stonesFor(m.id);
      if (carryStones.length) {
        node.dataset.stones = carryStones.map((s) => s.id).join(",");
        const badge = document.createElement("span");
        badge.className = "stone-gems";
        badge.setAttribute("role", "group");
        badge.setAttribute("aria-label", "Infinity stones carried by this title");
        carryStones.forEach((s) => {
          const collected = state.gauntlet.has(s.id);
          const gem = document.createElement("span");
          gem.className = "stone-gem" + (collected ? " is-collected" : "");
          gem.style.setProperty("--stone-color", s.color);
          gem.dataset.stone = s.id;
          gem.title = collected ? `${s.name} — collected, click to return` : `Collect the ${s.name}`;
          gem.setAttribute("role", "button");
          gem.setAttribute("tabindex", "0");
          gem.setAttribute("aria-label", `${collected ? "Return" : "Collect"} the ${s.name}`);
          gem.addEventListener("click", (e) => {
            e.stopPropagation();
            collectStone(s.id);
          });
          gem.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              collectStone(s.id);
            }
          });
          badge.appendChild(gem);
        });
        node.appendChild(badge);
      }
      node.dataset.id = m.id;
      node.dataset.line = m.line;
      node.dataset.title = m.title;
      node.setAttribute(
        "aria-label",
        `${m.title}, ${m.type === "series" ? "television series" : "movie"}, ${m.releaseDate ? m.releaseDate.slice(0, 4) : "TBA"}${journeyStatus ? `, marked ${journeyStatus}` : ""}`
      );
      node.addEventListener("mouseenter", (e) => {
        state.focusedStar = m.id;
        lightConstellation(e.currentTarget, m);
        showStationPreview(m, e.currentTarget, e.clientX, e.clientY);
      });
      node.addEventListener("mousemove", (e) => movePreview(e.clientX, e.clientY));
      node.addEventListener("mouseleave", () => {
        dimConstellation();
        hideStationPreview();
      });
      // keyboard users tabbing through nodes get the same preview
      node.addEventListener("focus", (e) => {
        state.focusedStar = m.id;
        lightConstellation(e.currentTarget, m);
        showStationPreview(m, e.currentTarget);
      });
      node.addEventListener("blur", () => {
        dimConstellation();
        hideStationPreview();
      });

      node.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openStarMenu(m, e.clientX, e.clientY);
      });

      node.addEventListener("click", (e) => {
        if (e.shiftKey) return;
        activateCrossoverPath(m.id);
      });
      els.canvas.appendChild(node);

      const journeyBadge = document.createElement("span");
      journeyBadge.className = `journey-node-badge${journeyStatus ? ` is-${journeyStatus}` : ""}`;
      journeyBadge.dataset.id = m.id;
      journeyBadge.style.left = `${x + r + 3}px`;
      journeyBadge.style.top = `${y - r - 9}px`;
      journeyBadge.textContent = journeyStatus === "watched" ? "✓" : journeyStatus === "watching" ? "▶" : journeyStatus === "planned" ? "+" : "";
      journeyBadge.hidden = !journeyStatus;
      els.canvas.appendChild(journeyBadge);

      const lbl = document.createElement("div");
      lbl.className = "node-label";
      lbl.dataset.id = m.id;
      if (activePath) {
        lbl.classList.toggle("is-path-active", activePath.ids.has(m.id));
        lbl.classList.toggle("is-path-dimmed", !activePath.ids.has(m.id));
      }
      if (activeNetwork) {
        lbl.classList.toggle("is-network-active", activeNetworkIds.has(m.id));
        lbl.classList.toggle("is-network-dimmed", !activeNetworkIds.has(m.id));
        if (activeNetworkIds.has(m.id)) lbl.style.setProperty("--network-color", activeNetwork.color);
      }
      if (butterfly) {
        lbl.classList.toggle("is-butterfly-source", butterfly.sourceId === m.id);
        lbl.classList.toggle("is-butterfly-dimmed", butterfly.ids.has(m.id) && butterfly.sourceId !== m.id);
      }
      if (teaser) {
        lbl.classList.toggle("is-teaser-source", teaser.sourceId === m.id);
        lbl.classList.toggle("is-teaser-lit", teaserIds.has(m.id) && teaser.sourceId !== m.id);
        lbl.classList.toggle("is-teaser-dimmed", !teaserIds.has(m.id));
      }
      if (state.variantScan) {
        const isVariant = variantSet.has(m.id);
        lbl.classList.toggle("is-variant", isVariant);
        lbl.classList.toggle("is-variant-dimmed", !isVariant);
      }
      lbl.classList.toggle(
        "is-beyond-playhead",
        state.playhead != null && (movieYearValue(m, "story") ?? Infinity) > state.playhead
      );
      const maxLabelWidth = milestone ? 175 : 148;
      const estimatedWidth = Math.min(maxLabelWidth, Math.max(58, m.title.length * 5.8 + 14));
      const labelLeft = x - estimatedWidth / 2;
      let labelTier = labelSlots.findIndex((rightEdge) => labelLeft > rightEdge + 12);
      if (labelTier < 0) {
        labelTier = labelSlots.indexOf(Math.min(...labelSlots));
      }
      labelSlots[labelTier] = x + estimatedWidth / 2;

      const labelAbove = labelTier % 2 === 0;
      const verticalTier = Math.floor(labelTier / 2);
      const labelOffset = r + 13 + verticalTier * 44;
      lbl.classList.add(labelAbove ? "node-label--above" : "node-label--below");
      lbl.dataset.tier = String(labelTier);
      if (milestone) lbl.classList.add("is-milestone-label");
      if (dimmed) lbl.classList.add("is-dimmed");
      if (phaseDimmed) lbl.classList.add("is-phase-dimmed");
      lbl.style.left = x + "px";
      lbl.style.top = labelAbove ? y - labelOffset + "px" : y + labelOffset + "px";
      lbl.style.setProperty("--label-color", line.color);
      lbl.textContent = m.title;
      els.canvas.appendChild(lbl);
    });
  });

  // -------- merge connectors --------
  // Connectors are decorative and can wait until the nodes are visible.
  await nextPaint();
  if (generation !== renderGeneration) return;
  const svgNS = "http://www.w3.org/2000/svg";
  timelineMovies.forEach((m) => {
    if (!m.joinsFrom || state.hiddenLines.has(m.line)) return;
    const target = nodePositions[m.id];
    if (!target) return;
    m.joinsFrom.forEach((fromLine) => {
      if (state.hiddenLines.has(fromLine)) return;
      const sourceMovies = byLane[fromLine];
      if (!sourceMovies || !sourceMovies.length) return;
      const sourceMovie = sourceMovies[sourceMovies.length - 1];
      const source = nodePositions[sourceMovie.id];
      if (!source) return;
      const sourceLine = lineById(fromLine);
      drawConnector(svgNS, source, target, source.color, false, `${sourceLine.name} merges into ${lineById(m.line).name}`, sourceMovie.id, m.id);
    });
  });

  (state.data.crossoverTeases || []).forEach((tease) => {
    const from = movieById(tease.from);
    const to = movieById(tease.to);
    if (!from || !to || state.hiddenLines.has(from.line) || state.hiddenLines.has(to.line)) return;
    const source = nodePositions[tease.from];
    const target = nodePositions[tease.to];
    if (!source || !target) return;
    const dashed = tease.dashed !== false;
    drawConnector(svgNS, source, target, dashed ? "#ffffff" : lineById(from.line).color, dashed, tease.label, tease.from, tease.to);
  });

  (state.data.timelineConnections || []).forEach((connection) => {
    const from = movieById(connection.from);
    const to = movieById(connection.to);
    if (!from || !to || state.hiddenLines.has(from.line) || state.hiddenLines.has(to.line)) return;
    const source = nodePositions[connection.from];
    const target = nodePositions[connection.to];
    if (!source || !target) return;
    drawConnector(svgNS, source, target, lineById(from.line).color, false, connection.label, connection.from, connection.to);
  });

  function drawConnector(ns, a, b, color, dashed, label, sourceId, targetId) {
    const dx = (b.x - a.x) * 0.5;
    const group = document.createElementNS(ns, "g");
    group.setAttribute("class", "connector-route");
    group.dataset.from = sourceId;
    group.dataset.to = targetId;
    if (activePath) {
      const connected = activePath.edgeKeys.has(`${sourceId}|${targetId}`);
      group.classList.toggle("is-path-active", connected);
      group.classList.toggle("is-path-dimmed", !connected);
    }
    if (activeNetwork) {
      const connected = activeNetworkIds.has(sourceId) && activeNetworkIds.has(targetId);
      group.classList.toggle("is-network-active", connected);
      group.classList.toggle("is-network-dimmed", !connected);
      if (connected) group.style.setProperty("--network-color", activeNetwork.color);
    }
    if (butterfly) {
      const isSource = (id) => id === butterfly.sourceId;
      const doomed = (id) => butterfly.ids.has(id) && !isSource(id);
      const untouched = (id) => !butterfly.ids.has(id);
      const aD = doomed(sourceId), bD = doomed(targetId);
      const dimmed = aD && bD;
      const broken = !dimmed &&
        ((aD && (untouched(targetId) || isSource(targetId))) ||
         (bD && (untouched(sourceId) || isSource(sourceId))));
      group.classList.toggle("is-butterfly-dimmed", dimmed);
      group.classList.toggle("is-butterfly-broken", broken);
    }
    if (teaser) {
      const inA = teaserIds.has(sourceId);
      const inB = teaserIds.has(targetId);
      group.classList.toggle("is-teaser-active", inA && inB);
      group.classList.toggle("is-teaser-dimmed", !(inA && inB));
    }
    if (activePhaseIds) {
      group.classList.toggle("is-phase-dimmed", !(activePhaseIds.has(sourceId) && activePhaseIds.has(targetId)));
    }
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", `${label}. Open destination movie.`);
    const hitArea = document.createElementNS(ns, "path");
    hitArea.setAttribute("d", `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`);
    hitArea.setAttribute("class", "connector-hit-area");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`);
    path.setAttribute("class", "connector-path");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", dashed ? "1.6" : "2.4");
    path.setAttribute("fill", "none");
    path.setAttribute("opacity", dashed ? "0.55" : "0.8");
    if (dashed) path.setAttribute("stroke-dasharray", "4 5");
    const orb = document.createElementNS(ns, "circle");
    orb.setAttribute("class", "connector-orb");
    orb.setAttribute("r", "2.2");
    orb.setAttribute("fill", color);
    orb.style.setProperty("--orb-color", color);
    orb.style.offsetPath = `path("M ${a.x},${a.y} C ${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}")`;
    const text = document.createElementNS(ns, "text");
    text.setAttribute("class", "connector-label");
    text.setAttribute("x", String((a.x + b.x) / 2));
    text.setAttribute("y", String((a.y + b.y) / 2 - 10));
    text.textContent = label;
    group.append(hitArea, path, text, orb);
    group.addEventListener("click", () => openDetail(targetId));
    group.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetail(targetId);
      }
    });
    els.svg.appendChild(group);
  }

  // auto-scroll to first search match
  if (state.query) {
    const match = timelineMovies.find(matchesQuery);
    if (match && nodePositions[match.id] && typeof els.scrollArea.scrollTo === "function") {
      const targetX = nodePositions[match.id].x * state.zoom - els.scrollArea.clientWidth / 2;
      els.scrollArea.scrollTo({ left: Math.max(0, targetX), behavior: "smooth" });
    }
  }
  if (mobile && !state.mobileFitApplied) {
    state.mobileFitApplied = true;
    requestAnimationFrame(fitTimeline);
  }
  drawPlayhead();
  applyConstellationOverlays();
  updateExperimentChrome();
  els.timelineWrapper?.setAttribute("aria-busy", "false");
}


// ============================================================
// Poster Preview — cursor-following
// ============================================================

let previewVisible = false;
let previewRaf = 0;
let previewX = 0;
let previewY = 0;

function applyPreviewPosition() {
  previewRaf = 0;
  els.posterPreview.style.setProperty("--px", `${previewX}px`);
  els.posterPreview.style.setProperty("--py", `${previewY}px`);
  els.stationTooltip.style.setProperty("--px", `${previewX}px`);
  els.stationTooltip.style.setProperty("--py", `${previewY + 18}px`);
}

function movePreview(x, y) {
  previewX = x;
  previewY = y;
  if (previewVisible && !previewRaf) {
    previewRaf = requestAnimationFrame(applyPreviewPosition);
  }
}

function showPoster(movie, x, y) {
  if (!movie || !movie.poster || isSpoilerLocked(movie, state.spoilerSafe ? spoilerFrontier() : -1)) {
    hidePoster();
    return;
  }

  const src = TMDB_THUMB_BASE + movie.poster;
  if (els.posterPreviewImg.src !== src) {
    els.posterPreviewImg.decoding = "async";
    els.posterPreviewImg.src = src;
  }
  els.posterPreviewImg.alt = `${movie.title} poster`;
  els.posterPreviewTitle.textContent = movie.title;
  els.posterPreviewYear.textContent = movie.releaseDate?.slice(0, 4) || "TBA";
  els.posterPreviewRuntime.textContent = movie.runtimeMinutes ? `${movie.runtimeMinutes} min` : "Runtime TBA";
  els.posterPreviewRating.textContent = movie.rating || "Not rated";
  if (movie.type === "series") {
    els.posterPreviewMetricLabel.textContent = "Series";
    els.posterPreviewBoxOffice.textContent = `S${movie.seasonNumber || 1} · ${movie.episodes || "—"} eps`;
  } else {
    els.posterPreviewMetricLabel.textContent = "Worldwide";
    els.posterPreviewBoxOffice.textContent = formatMoney(movie.worldwideBoxOffice);
  }
  previewVisible = true;
  movePreview(x, y);
  els.posterPreview.classList.add("show");
}

function hidePoster() {
  previewVisible = false;
  if (previewRaf) {
    cancelAnimationFrame(previewRaf);
    previewRaf = 0;
  }
  els.posterPreview.classList.remove("show");
}

const stationTooltipCache = new Map();

function showStationPreview(movie, nodeEl, x = null, y = null) {
  if (x === null || y === null) {
    const rect = nodeEl.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }
  if (!stationTooltipCache.has(movie.id)) {
    stationTooltipCache.set(
      movie.id,
      `<strong>${movie.title}</strong><span>${movie.releaseDate?.slice(0, 4) || "TBA"} · ${movie.type === "series" ? "Series" : "Movie"} · ${lineById(movie.line).name}</span>`
    );
  }
  els.stationTooltip.innerHTML = stationTooltipCache.get(movie.id);
  previewVisible = true;
  movePreview(x, y);
  els.stationTooltip.classList.add("show");
  showPoster(movie, x, y);
}

function hideStationPreview() {
  els.stationTooltip.classList.remove("show");
  hidePoster();
}

// ------------------------------------------------------------
// Detail panel
// ------------------------------------------------------------
function openDetail(id) {
  const m = movieById(id);
  if (!m) return;
  const line = lineById(m.line);
  const spoilerLocked = isSpoilerLocked(m, state.spoilerSafe ? spoilerFrontier() : -1);
  state.lastFocusedEl = document.activeElement;
  state.detailOpen = id;
  if (!state.visited.has(id)) {
    state.visited.add(id);
    saveVisited();
    if (state.visited.size === 10) unlockAchievement("explorer");
  }

  const metaRows = [];
  metaRows.push(["Studio", line.studio]);
  metaRows.push([m.type === "series" ? "Premiered" : "Release", formatDate(m.releaseDate)]);
  if (typeof m.inUniverseYear === "number") {
    metaRows.push(["Story set in", m.inUniverseYear + " (in-universe)"]);
  }
  metaRows.push([m.type === "series" ? "Created by" : "Director", m.creator || m.director || "TBA"]);
  metaRows.push([m.type === "series" ? "Episode runtime" : "Runtime", m.runtimeMinutes ? m.runtimeMinutes + " min" : "—"]);
  if (m.type === "series") {
    metaRows.push(["Season", String(m.seasonNumber || 1)]);
    metaRows.push(["Episodes this season", m.episodes ? String(m.episodes) : "—"]);
  }
  metaRows.push(["Rating", m.rating || "—"]);
  if (m.saga) metaRows.push(["Saga", m.saga]);
  if (m.phase) metaRows.push(["Phase", m.phase]);
  metaRows.push(["Status", `<span class="status-pill status-${m.status}">${m.status}</span>`]);
  if (m.joinsFrom && m.joinsFrom.length) {
    const names = m.joinsFrom.map((id) => lineById(id).name).join(", ");
    metaRows.push(["Interchange", `${names} merges into the MCU here`]);
  }

  const posterHtml = spoilerLocked
    ? `<div class="detail-poster detail-poster--locked" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="40" height="40"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
        <span>Spoiler-locked</span>
        <small>Appears after your furthest watched title</small>
      </div>`
    : m.poster
      ? `<img class="detail-poster" id="detail-poster-img" src="${TMDB_POSTER_BASE}${m.poster}" alt="${m.title} poster">`
      : posterPlaceholderHtml(m, line);
  const boxOfficeLabel = formatMoney(m.worldwideBoxOffice);
  const billionClub = m.worldwideBoxOffice >= 1_000_000_000
    ? '<span class="billion-badge">$1B Club</span>'
    : "";
  const trailerWatchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${m.title} ${m.type === "series" ? "series trailer" : "official trailer"}`)}`;

  // Key cast members for this title (from the Cast & Character dataset when ready)
  const castMembers = spoilerLocked
    ? []
    : (window.NexusCore?.castForMovie && window.NexusCore.castForMovie(m.id)) || [];
  const keyCastHtml = castMembers.length
    ? `<section class="detail-keycast" aria-label="Key cast members">
        <h4>Key cast</h4>
        <div class="detail-keycast__chips">
          ${castMembers
            .slice(0, 8)
            .map(
              (entry) =>
                `<span class="keycast-chip" title="${escapeAttr(entry.character)}"><strong>${escapeHtml(entry.actor)}</strong><em>${escapeHtml(entry.character)}</em></span>`
            )
            .join("")}
        </div>
      </section>`
    : "";

  const tmdbLink = m.tmdbId
    ? `<a class="detail-external-link" href="https://www.themoviedb.org/${m.type === "series" ? "tv" : "movie"}/${m.tmdbId}" target="_blank" rel="noopener noreferrer">View on TMDB <span aria-hidden="true">↗</span></a>`
    : "";

  const isWatchlisted = state.watchlist.has(m.id);

  const ottComingSoon = m.ottStatus === "coming-soon";
  const ottHtml = Array.isArray(m.ott) && m.ott.length
    ? `<section class="detail-ott" aria-labelledby="detail-ott-heading">
        <h4 id="detail-ott-heading">${ottComingSoon ? "Coming soon on" : "Watch now on"}</h4>
        <p class="detail-ott__hint">${ottComingSoon ? "In theaters now — streaming here soon." : "Open on your favourite OTT platform"}</p>
        <div class="detail-ott__chips">
          ${m.ott
            .map((slug) => {
              const platform = OTT_PLATFORMS[slug];
              if (!platform) return "";
              const monogram = platform.name.charAt(0).toUpperCase();
              const chipInner = platform.logoSlug
                ? `<img class="ott-chip__logo" data-logo-slug="${platform.logoSlug}" data-monogram="${monogram}" src="https://cdn.simpleicons.org/${platform.logoSlug}" alt="" loading="lazy" decoding="async" width="18" height="18">`
                : `<span class="ott-chip__monogram">${monogram}</span>`;
              const chipBody = `${chipInner}<span class="ott-chip__name">${platform.name}</span>`;
              return ottComingSoon
                ? `<span class="ott-chip ott-chip--soon" style="--ott:${platform.color}" title="Coming soon on ${platform.name}">${chipBody}<span class="ott-chip__soon">Soon</span></span>`
                : `<a class="ott-chip" href="${platform.url(encodeURIComponent(m.title))}" target="_blank" rel="noopener noreferrer" title="Watch ${m.title} on ${platform.name}" style="--ott:${platform.color}">${chipBody}</a>`;
            })
            .join("")}
        </div>
      </section>`
    : `<section class="detail-ott detail-ott--none" aria-label="Where to watch">
        <h4>Not on major OTT platforms</h4>
        <p class="detail-ott__hint">This title isn’t available on the major streaming services yet.</p>
      </section>`;

  // --- Pre-build HTML as string, then use phased rendering ---
  const fullHtml = `
    ${posterHtml}
    <div class="detail-line-badge" style="color:${line.color};background:${line.color}1a;border:1px solid ${line.color}55;">
      <span class="dot" style="width:8px;height:8px;border-radius:50%;background:${line.color};display:inline-block;"></span>
      ${line.name}
    </div>
    <div class="detail-badges">${priorityBadgeHtml(m)}<span class="type-badge">${m.type === "series" ? "Series" : "Film"}</span></div>
    <h2 class="detail-title" id="detail-heading">${m.title}</h2>
    <section class="detail-journey" aria-labelledby="detail-journey-heading">
      <div>
        <span>My Viewing Orbit</span>
        <strong id="detail-journey-heading">Set viewing status</strong>
      </div>
      <div class="journey-status-controls">
        <button class="journey-status-btn" type="button" data-status="watched" aria-pressed="false">✓ Watched</button>
        <button class="journey-status-btn" type="button" data-status="watching" aria-pressed="false">▶ Watching</button>
        <button class="journey-status-btn" type="button" data-status="planned" aria-pressed="false">＋ Planned</button>
        <button class="journey-status-clear" id="journey-status-clear" type="button">Clear</button>
      </div>
      <button class="watchlist-toggle${isWatchlisted ? " is-saved" : ""}" type="button" data-watchlist-toggle="${m.id}" aria-pressed="${isWatchlisted}">
        <span class="watchlist-toggle__icon" aria-hidden="true">${isWatchlisted ? "★" : "☆"}</span>
        <span class="watchlist-toggle__label">${isWatchlisted ? "Remove from watchlist" : "Add to watchlist"}</span>
      </button>
    </section>
    ${m.type === "series" ? "" : `
      <section class="box-office-card" aria-label="Worldwide box office">
        <span>Worldwide box office</span>
        <strong>${boxOfficeLabel}</strong>
        ${billionClub}
      </section>
    `}
    <dl class="detail-meta">
      ${metaRows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}
    </dl>
    ${keyCastHtml}
    ${spoilerLocked
      ? `<div class="detail-spoiler-note"><strong>Spoiler-safe mode is on.</strong><span>You haven't reached this title in story order yet — its synopsis stays hidden until you do.</span></div>`
      : `<p class="detail-synopsis">${m.synopsis}</p>`}
    ${ottHtml}
    <div class="detail-watch-links">
      <a class="detail-external-link" href="${trailerWatchUrl}" target="_blank" rel="noopener noreferrer">Search trailer on YouTube <span aria-hidden="true">↗</span></a>
      ${tmdbLink}
    </div>
    <div class="detail-navigation" aria-label="Browse titles">
      <button type="button" id="detail-previous">← Previous</button>
      <button type="button" id="detail-next">Next →</button>
    </div>
  `;

  const browsable = state.data.movies
    .filter((movie) => movie.releaseDate && !state.hiddenLines.has(movie.line))
    .sort((a, b) => movieYearValue(a, state.sortMode) - movieYearValue(b, state.sortMode));
  const ci = browsable.findIndex((movie) => movie.id === id);
  const prev = browsable[ci - 1];
  const nxt = browsable[ci + 1];

  // --- PHASE 1: Slide panel open instantly (empty content = instant paint) ---
  els.detailContent.innerHTML = "";
  els.overlay.classList.add("is-visible");
  els.detailPanel.classList.add("is-open");
  els.detailPanel.setAttribute("aria-hidden", "false");
  document.body.classList.add("detail-open");

  // --- PHASE 2: Fill content after browser paints the slide ---
  requestAnimationFrame(() => {
    els.detailContent.innerHTML = fullHtml;

    const pb = document.getElementById("detail-previous");
    const nb = document.getElementById("detail-next");
    if (pb) {
      pb.disabled = !prev;
      if (prev) { pb.title = prev.title; pb.onclick = () => openDetail(prev.id); }
    }
    if (nb) {
      nb.disabled = !nxt;
      if (nxt) { nb.title = nxt.title; nb.onclick = () => openDetail(nxt.id); }
    }

    // --- PHASE 3: Bind events after content painted ---
    requestAnimationFrame(() => {
      els.detailContent.querySelectorAll(".journey-status-btn").forEach((button) => {
        button.addEventListener("click", () => {
          const nextStatus = state.journey[m.id] === button.dataset.status ? null : button.dataset.status;
          setJourneyStatus(m.id, nextStatus);
        });
      });
      document.getElementById("journey-status-clear").addEventListener("click", () => setJourneyStatus(m.id, null));
      updateDetailJourneyControls(m.id);

      document.querySelectorAll("[data-watchlist-toggle]").forEach((button) => {
        button.addEventListener("click", () => toggleWatchlist(button.dataset.watchlistToggle));
      });

      els.detailContent.querySelectorAll(".ott-chip__logo").forEach((img) => {
        img.addEventListener("error", () => {
          img.outerHTML = `<span class="ott-chip__monogram">${img.dataset.monogram}</span>`;
        });
      });

      els.detailClose.focus();
      window.NexusCore?.onDetail?.("open", m, line);
    });
  });
}

function posterPlaceholderHtml(m, line) {
  return `<div class="detail-poster detail-poster--placeholder" style="background:linear-gradient(160deg, ${line.color}33, ${line.color}0d);">
    <span style="color:${line.color}">${m.title.charAt(0)}</span>
  </div>`;
}

function closeDetail() {
  els.overlay.classList.remove("is-visible");
  els.detailPanel.classList.remove("is-open");
  els.detailPanel.setAttribute("aria-hidden", "true");
  document.body.classList.remove("detail-open");
  state.detailOpen = null;
  window.NexusCore?.onDetail?.("close");
  if (state.lastFocusedEl && document.body.contains(state.lastFocusedEl)) {
    state.lastFocusedEl.focus();
  }
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Tab" || !els.detailPanel?.classList.contains("is-open")) return;
  const focusable = [...els.detailPanel.querySelectorAll("button:not(:disabled), a[href], input, select, [tabindex]:not([tabindex='-1'])")];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

// ============================================================
// Achievements — a trophy wall for feats across the multiverse.
// Unlocks persist in localStorage; a toast announces each one.
// ============================================================

const ACHIEVEMENT_DEFS = [
  { id: "first-stone", icon: "💎", name: "First Stone", desc: "Collect your first Infinity Stone from the timeline." },
  { id: "snap", icon: "⚡", name: "SNAP!", desc: "Hold all six stones and let half the timeline dust." },
  { id: "butterfly", icon: "🦋", name: "Butterfly Effect", desc: "Ask what-if a title never happened." },
  { id: "post-credit", icon: "🎬", name: "Post-Credit Hunter", desc: "Trace the threads a title sets up." },
  { id: "shared-dna", icon: "🧬", name: "Shared DNA", desc: "Light up an actor's whole thread across the atlas." },
  { id: "completionist", icon: "🏁", name: "Completionist", desc: "Mark every released title as watched." },
  { id: "explorer", icon: "🧭", name: "Explorer", desc: "Open ten titles in detail." },
  { id: "credits-watcher", icon: "🍿", name: "Credits Watcher", desc: "Mark every post-credit stinger across the saga." },
  { id: "egg-hunt", icon: "🥚", name: "Egg Hunter", desc: "Find every easter egg hiding in the atlas." },
  { id: "streak-7", icon: "🔥", name: "On a Roll", desc: "Watch a title seven days in a row." },
];

function loadAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    if (raw) {
      const stored = JSON.parse(raw);
      if (Array.isArray(stored)) {
        state.achievements = new Set(stored.filter((id) => ACHIEVEMENT_DEFS.some((a) => a.id === id)));
      }
    }
  } catch { /* storage unavailable */ }
}

function saveAchievements() {
  try { localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify([...state.achievements])); } catch { /* storage unavailable */ }
}

function hasAchievement(id) {
  return state.achievements.has(id);
}

// --- Daily Streak Tracking ---
function trackStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const streakData = JSON.parse(localStorage.getItem('nexus-streak') || '{"last":"","count":0}');
  if (streakData.last === today) return streakData.count;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (streakData.last === yesterday) {
    streakData.count++;
  } else if (streakData.last !== today) {
    streakData.count = 1;
  }
  streakData.last = today;
  localStorage.setItem('nexus-streak', JSON.stringify(streakData));
  if (streakData.count >= 7) unlockAchievement('streak-7');
  return streakData.count;
}

function unlockAchievement(id) {
  const def = ACHIEVEMENT_DEFS.find((a) => a.id === id);
  if (!def || state.achievements.has(id)) return false;
  state.achievements.add(id);
  saveAchievements();
  showAchievementToast(def);
  updateAchievementsChrome();
  if (els.achievementsPanel && !els.achievementsPanel.hidden) renderAchievements();
  return true;
}

let achievementToastTimer = 0;

function showAchievementToast(def) {
  const toast = els.achievementToast;
  if (!toast) return;
  toast.hidden = false;
  toast.innerHTML = `<span class="achievement-toast__icon" aria-hidden="true">${def.icon}</span>
    <span class="achievement-toast__copy"><strong>Achievement unlocked</strong><span>${escapeHtml(def.name)}</span></span>`;
  toast.classList.remove("is-out");
  toast.classList.add("is-in");
  window.clearTimeout(achievementToastTimer);
  achievementToastTimer = window.setTimeout(() => {
    toast.classList.remove("is-in");
    toast.classList.add("is-out");
    window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove("is-out");
    }, 260);
  }, 3400);
}

function updateAchievementsChrome() {
  if (els.achievementsCount) els.achievementsCount.textContent = String(state.achievements.size);
  if (els.achievementsBtn && els.achievementsPanel) {
    els.achievementsBtn.setAttribute("aria-pressed", String(!els.achievementsPanel.hidden));
  }
}

function toggleAchievementsPanel(force) {
  if (!els.achievementsPanel) return;
  const open = typeof force === "boolean" ? force : els.achievementsPanel.hidden;
  els.achievementsPanel.hidden = !open;
  els.achievementsPanel.classList.toggle("is-open", open);
  if (open) renderAchievements();
  updateAchievementsChrome();
}

function renderAchievements() {
  if (!els.achievementsList) return;
  const unlocked = state.achievements.size;
  const total = ACHIEVEMENT_DEFS.length;
  els.achievementsList.innerHTML = ACHIEVEMENT_DEFS.map((a) => {
    const done = state.achievements.has(a.id);
    return `<div class="achievement-item${done ? "" : " is-locked"}" role="listitem">
      <span class="achievement-item__icon" aria-hidden="true">${a.icon}</span>
      <div class="achievement-item__copy">
        <strong>${escapeHtml(a.name)}</strong>
        <span>${escapeHtml(a.desc)}</span>
        <em>${done ? "Unlocked" : "Locked"}</em>
      </div>
    </div>`;
  }).join("");
  if (els.achievementsProgress) {
    els.achievementsProgress.innerHTML = `<strong>${unlocked}/${total}</strong> honours collected`;
  }
}

// ============================================================
// Commute mode — a full-screen, story-ordered reading list so
// you can scroll a whole rewatch in offline mode.
// ============================================================

function toggleCommuteMode(force) {
  if (!els.commuteMode) return;
  const open = typeof force === "boolean" ? force : els.commuteMode.hidden;
  els.commuteMode.hidden = !open;
  document.body.classList.toggle("is-commute", open);
  if (els.commuteBtn) els.commuteBtn.classList.toggle("is-active", open);
  if (open) renderCommute();
}

function renderCommute() {
  if (!els.commuteList) return;
  const q = state.commuteQuery.trim().toLowerCase();
  const movies = state.data.movies
    .filter((m) => m.status !== "upcoming")
    .filter((m) => !q || String(m.title).toLowerCase().includes(q))
    .sort((a, b) => {
      if (state.commuteOrder === "release") {
        return (movieYearValue(a, "release") ?? Infinity) - (movieYearValue(b, "release") ?? Infinity);
      }
      return (movieYearValue(a, "story") ?? movieYearValue(a, "release") ?? Infinity) -
        (movieYearValue(b, "story") ?? movieYearValue(b, "release") ?? Infinity);
    });
  if (els.commuteModeCount) {
    const orderLabel = state.commuteOrder === "release" ? "release order" : "story order";
    els.commuteModeCount.textContent = `${movies.length} titles · ${orderLabel}`;
  }
  els.commuteList.innerHTML = movies.map((m) => {
    const line = lineById(m.line);
    const status = state.journey[m.id];
    const statusMark = status === "watched" ? '<em class="commute-card__status is-watched" title="Watched">✓ Watched</em>'
      : status === "watching" ? '<em class="commute-card__status is-watching" title="Watching now">▶ Watching</em>'
      : status === "planned" ? '<em class="commute-card__status is-planned" title="Planned">+ Planned</em>'
      : "";
    const ott = (m.ott || []).map((slug) => {
      const platform = OTT_PLATFORMS[slug];
      return platform
        ? `<a href="${escapeAttr(platform.url(encodeURIComponent(m.title)))}" target="_blank" rel="noopener noreferrer" title="Watch on ${escapeAttr(platform.name)}">${escapeHtml(platform.name)}</a>`
        : "";
    }).join("");
    return `<button type="button" class="commute-card" data-commute-id="${escapeAttr(m.id)}">
      <span class="commute-card__row">
        <strong>${escapeHtml(m.title)}</strong>
        <em>${m.releaseDate ? m.releaseDate.slice(0, 4) : "TBA"}</em>
      </span>
      <span class="commute-card__meta">${line ? escapeHtml(line.name) : ""}${m.type === "series" ? " · Series" : ""}${m.runtimeMinutes ? ` · ${m.runtimeMinutes} min` : ""}${statusMark}</span>
      ${m.synopsis ? `<span class="commute-card__synopsis">${escapeHtml(m.synopsis)}</span>` : ""}
      ${ott ? `<span class="commute-card__ott">${ott}</span>` : ""}
    </button>`;
  }).join("");
}

// ============================================================
// Timeline playhead scrubber — a draggable frontier marker across
// the story years. Titles whose story year is beyond the playhead
// are dimmed until you move the frontier forward.
// ============================================================

function togglePlayheadBar() {
  if (els.playheadBar) els.playheadBar.hidden = !els.playheadBar.hidden;
  updatePlayheadChrome();
}

function setPlayhead(year) {
  const { minYear, maxYear } = lastTimelineScale;
  const clamped = Math.max(minYear, Math.min(maxYear, Math.round(year)));
  if (state.playhead === clamped) return;
  state.playhead = clamped;
  persistPlayhead();
  updateExperimentChrome();
  syncUrl();
  render();
}

function clearPlayhead() {
  if (state.playhead == null) return;
  state.playhead = null;
  persistPlayhead();
  updateExperimentChrome();
  render();
}

function persistPlayhead() {
  try {
    if (state.playhead == null) localStorage.removeItem("nexus.playhead");
    else localStorage.setItem("nexus.playhead", String(state.playhead));
  } catch (e) { /* storage unavailable */ }
}

function updatePlayheadChrome() {
  if (els.playheadBtn) {
    const active = !!(els.playheadBar && !els.playheadBar.hidden);
    els.playheadBtn.classList.toggle("is-active", active);
    els.playheadBtn.setAttribute("aria-pressed", String(active));
  }
  const { minYear, maxYear } = lastTimelineScale;
  const ratio = state.playhead == null ? 1 : (state.playhead - minYear) / Math.max(1, maxYear - minYear);
  if (els.playheadHandle) els.playheadHandle.style.left = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
  if (els.playheadYear) els.playheadYear.textContent = state.playhead == null ? "—" : String(state.playhead);
}

function drawPlayhead() {
  els.svg.querySelectorAll(".playhead-layer").forEach((el) => el.remove());
  if (state.playhead == null) return;
  const { minYear, pxPerYear } = lastTimelineScale;
  const x = LEFT_PAD + (state.playhead - minYear) * pxPerYear;
  const height = Number(els.svg.getAttribute("height")) || TOP_PAD + LANE_HEIGHT;
  const g = document.createElementNS(SVG_NS, "g");
  g.setAttribute("class", "playhead-layer");
  const line = document.createElementNS(SVG_NS, "line");
  line.setAttribute("class", "playhead-line");
  line.setAttribute("x1", String(x));
  line.setAttribute("y1", String(TOP_PAD));
  line.setAttribute("x2", String(x));
  line.setAttribute("y2", String(Math.max(TOP_PAD + 20, height - BOTTOM_PAD)));
  g.appendChild(line);
  const tag = document.createElementNS(SVG_NS, "text");
  tag.setAttribute("class", "playhead-year-tag");
  tag.setAttribute("x", String(x));
  tag.setAttribute("y", String(TOP_PAD - 10));
  tag.textContent = String(state.playhead);
  g.appendChild(tag);
  els.svg.appendChild(g);
}

// ============================================================
// Watch-order optimizer — sorts your unwatched titles by the
// best way to catch up before Avengers: Doomsday.
// ============================================================

function toggleOptimizer(force) {
  if (!els.optimizerPanel) return;
  const open = typeof force === "boolean" ? force : els.optimizerPanel.hidden;
  els.optimizerPanel.hidden = !open;
  if (els.optimizerBtn) {
    els.optimizerBtn.classList.toggle("is-active", open);
    els.optimizerBtn.setAttribute("aria-pressed", String(open));
  }
  if (open) {
    els.optimizerModes?.querySelectorAll("[data-optimizer-mode]").forEach((b) => {
      const active = b.dataset.optimizerMode === state.optimizer;
      b.classList.toggle("is-active", active);
      b.setAttribute("aria-pressed", String(active));
    });
    renderOptimizer();
  }
}

function optimizerList() {
  const eligible = state.data.movies
    .filter((m) => state.journey[m.id] !== "watched" && !state.hiddenLines.has(m.line) && m.status !== "upcoming" && m.status !== "shelved");
  const compare = (a, b) => {
    if (state.optimizer === "release") {
      return (movieYearValue(a, "release") ?? Infinity) - (movieYearValue(b, "release") ?? Infinity);
    }
    if (state.optimizer === "essential") {
      const pa = priorityFor(a) === "essential" ? 0 : priorityFor(a) === "recommended" ? 1 : 2;
      const pb = priorityFor(b) === "essential" ? 0 : priorityFor(b) === "recommended" ? 1 : 2;
      if (pa !== pb) return pa - pb;
    }
    return (movieYearValue(a, "story") ?? movieYearValue(a, "release") ?? Infinity) -
      (movieYearValue(b, "story") ?? movieYearValue(b, "release") ?? Infinity);
  };
  return eligible.sort(compare);
}

function renderOptimizer() {
  if (!els.optimizerList) return;
  const list = optimizerList();
  const totalMinutes = list.reduce((sum, m) => sum + (m.runtimeMinutes || 0), 0);
  if (els.optimizerTotal) {
    els.optimizerTotal.innerHTML = `<strong>${list.length}</strong> ${list.length === 1 ? "title" : "titles"} left · ${formatMinutes(totalMinutes)} of runtime`;
  }
  els.optimizerList.innerHTML = list.length
    ? list.map((m, index) => {
        const line = lineById(m.line);
        const year = movieYearValue(m, "story") ?? movieYearValue(m, "release");
        const saved = state.watchlist.has(m.id);
        const watched = state.journey[m.id] === "watched";
        return `
          <div class="optimizer-row" data-optimizer-id="${m.id}">
            <span class="optimizer-row__index">${String(index + 1).padStart(2, "0")}</span>
            <span class="optimizer-row__body">
              <strong>${escapeHtml(m.title)}</strong>
              <em>${line ? escapeHtml(line.name) : ""}${year != null ? ` · ${year}` : ""}${m.runtimeMinutes ? ` · ${m.runtimeMinutes} min` : ""}${m.type === "series" ? " · Series" : ""}</em>
            </span>
            <span class="optimizer-row__actions">
              <button type="button" class="optimizer-row__act is-watch${watched ? " is-active" : ""}" data-optimizer-act="watch" data-optimizer-id="${m.id}" aria-pressed="${watched ? "true" : "false"}" title="${watched ? "Mark unwatched" : "Mark watched"}">✓</button>
              <button type="button" class="optimizer-row__act is-save${saved ? " is-active" : ""}" data-optimizer-act="save" data-optimizer-id="${m.id}" aria-pressed="${saved ? "true" : "false"}" title="${saved ? "Remove from watchlist" : "Add to watchlist"}">${saved ? "★" : "☆"}</button>
            </span>
          </div>`;
      }).join("")
    : '<div class="optimizer-empty"><strong>All caught up.</strong><span>Nothing left before Doomsday.</span></div>';
}

function bindOptimizerRows() {
  if (!els.optimizerList) return;
  els.optimizerList.addEventListener("click", (event) => {
    const act = event.target.closest("[data-optimizer-act]");
    if (act) {
      const id = act.dataset.optimizerId;
      if (act.dataset.optimizerAct === "watch") {
        setJourneyStatus(id, state.journey[id] === "watched" ? null : "watched");
        renderOptimizer();
      } else {
        toggleWatchlist(id);
        renderOptimizer();
      }
      return;
    }
    const row = event.target.closest("[data-optimizer-id]");
    if (!row) return;
    toggleOptimizer(false);
    openDetail(row.dataset.optimizerId);
  });
}

// ============================================================
// Personal stats profile — a computed snapshot of your journey
// across the multiverse.
// ============================================================

function toggleStatsPanel() {
  if (!els.statsPanel) return;
  if (els.statsPanel.hidden) openStatsPanel();
  else closeStatsPanel();
}

function openStatsPanel() {
  if (!els.statsPanel) return;
  renderStats();
  els.statsPanel.hidden = false;
  els.statsPanel.classList.add("is-active");
  if (els.statsBtn) {
    els.statsBtn.classList.add("is-active");
    els.statsBtn.setAttribute("aria-pressed", "true");
  }
  if (els.statsPanelClose) els.statsPanelClose.focus();
}

function closeStatsPanel() {
  if (!els.statsPanel) return;
  els.statsPanel.hidden = true;
  els.statsPanel.classList.remove("is-active");
  if (els.statsBtn) {
    els.statsBtn.classList.remove("is-active");
    els.statsBtn.setAttribute("aria-pressed", "false");
  }
}

function renderStats() {
  if (!els.statsContent) return;
  const stats = journeyStats();
  const allMovies = state.data.movies;
  const movies = allMovies.filter((m) => m.type !== "series");
  const series = allMovies.filter((m) => m.type === "series");
  const watchedIds = new Set(Object.entries(state.journey).filter(([, s]) => s === "watched").map(([id]) => id));
  const watchedMinutes = allMovies.reduce((sum, m) => sum + (watchedIds.has(m.id) ? (m.runtimeMinutes || 0) : 0), 0);
  const perLine = state.data.lines
    .map((line) => {
      const laneMovies = allMovies.filter((m) => m.line === line.id);
      const watched = laneMovies.filter((m) => watchedIds.has(m.id)).length;
      return { line, total: laneMovies.length, watched };
    })
    .filter((entry) => entry.total > 0)
    .sort((a, b) => b.total - a.total);
  const lineBars = perLine
    .map((entry) => {
      const raw = entry.total ? (entry.watched / entry.total) * 100 : 0;
      const pct = Math.round(raw * 10) / 10;
      return `
        <div class="stats-bar-row">
          <span class="stats-bar-row__label" style="color:${entry.line.color}">${escapeHtml(entry.line.name)}</span>
          <span class="stats-bar-row__track"><span class="stats-bar-row__fill" style="width:${pct}%;background:${entry.line.color}"></span></span>
          <span class="stats-bar-row__count">${entry.watched}/${entry.total}</span>
        </div>`;
    })
    .join("");
  els.statsContent.innerHTML = `
    <div class="stats-hero">
      ${ringMarkup(stats.percent)}
      <div>
        <strong>${stats.watched} of ${stats.total} released titles watched</strong>
        <span>${formatMinutes(watchedMinutes)} of runtime seen</span>
      </div>
    </div>
    <div class="stats-grid">
      <div class="stats-card"><strong>${movies.length}</strong><span>Films</span></div>
      <div class="stats-card"><strong>${series.length}</strong><span>Series</span></div>
      <div class="stats-card"><strong>${stats.watching}</strong><span>Watching now</span></div>
      <div class="stats-card"><strong>${stats.planned}</strong><span>Planned</span></div>
      <div class="stats-card"><strong>${state.gauntlet.size}/${(state.stones || []).length}</strong><span>Stones</span></div>
      <div class="stats-card"><strong>${state.achievements.size}</strong><span>Achievements</span></div>
    </div>
    <h4 class="stats-section-title">Progress per universe</h4>
    <div class="stats-bars">${lineBars}</div>
    ${window.NexusProgress ? window.NexusProgress.statsMarkup() : ""}
  `;
}

// Bridge used by js/nexus.js. Deliberately small: keep the extra features
// decoupled from the core timeline so they can grow independently.
window.NexusCore = {
  state,
  els,
  data: () => state.data,
  movieById,
  lineById,
  laneOrder,
  openDetail,
  closeDetail,
  render,
  setJourneyStatus,
  updateJourneySummary,
  buildUniversePicker,
  updateJourneyNodeVisuals,
  journeyStats,
  journeyEligible,
  watchlist: () => state.watchlist,
  toggleWatchlist,
  watchlistTotalMinutes,
  formatMinutes,
  onWatchlistChanged: null,
  setNetworkHighlight(network) {
    state.crossoverPath = null;
    state.butterflySource = null;
    state.teaserScan = null;
    state.network = network;
    render();
  },
  clearNetwork,
  hideStationPreview,
  // experiment suite — used by the harness and future integrations
  stones: () => state.stones || [],
  stonesFor,
  castForMovie: castForMovieCached,
  gauntlet: () => [...state.gauntlet],
  collectStone,
  resetGauntlet,
  toggleGauntletPanel,
  gauntletComplete: () => state.gauntlet.size === (state.stones || []).length,
  toggleVariantScan,
  variantGroups,
  variantSetFor,
  openDossier,
  closeDossier,
  openDnaPicker,
  applyDna,
  clearDna,
  revealTitle,
  // achievements / commute mode
  achievements: () => [...state.achievements],
  hasAchievement,
  unlockAchievement,
  toggleAchievementsPanel,
  renderAchievements,
  toggleCommuteMode,
  renderCommute,
  commute: () => els.commuteMode && !els.commuteMode.hidden,
  // playhead / stats / optimizer
  setPlayhead,
  clearPlayhead,
  playhead: () => state.playhead,
  openStatsPanel,
  renderStats,
  toggleOptimizer,
  renderOptimizer,
  optimizer: () => state.optimizer,
};
window.trackStreak = trackStreak;
