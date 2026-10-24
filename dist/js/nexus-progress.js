(() => {
  "use strict";

  const core = () => window.NexusCore;
  const STREAK_KEY = "nexus.streak-days";
  const BEST_KEY = "nexus.streak-best";
  const STREAK_ACHIEVEMENT = "streak-7";

  const PHASES = [
    { name: "Phase One", color: "#3ddc84" },
    { name: "Phase Two", color: "#ffb454" },
    { name: "Phase Three", color: "#ffd166" },
    { name: "Phase Four", color: "#22d3ee" },
    { name: "Phase Five", color: "#7dd3a8" },
    { name: "Phase Six", color: "#ff5da2" },
  ];

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function shiftDay(key, days) {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function loadDays() {
    try {
      const raw = JSON.parse(localStorage.getItem(STREAK_KEY) || "[]");
      return new Set(Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []);
    } catch {
      return new Set();
    }
  }

  function saveDays(days) {
    try {
      localStorage.setItem(STREAK_KEY, JSON.stringify([...days].sort()));
    } catch {
      /* storage unavailable */
    }
  }

  function recordWatch() {
    const days = loadDays();
    days.add(todayKey());
    const cutoff = shiftDay(todayKey(), -730);
    [...days].forEach((k) => {
      if (k < cutoff) days.delete(k);
    });
    saveDays(days);
    const streak = currentStreak();
    const best = Number(localStorage.getItem(BEST_KEY) || 0);
    if (streak > best) {
      localStorage.setItem(BEST_KEY, String(streak));
      if (streak >= 7 && core() && core().unlockAchievement) {
        core().unlockAchievement(STREAK_ACHIEVEMENT);
      }
    }
  }

  function currentStreak() {
    const days = loadDays();
    if (!days.size) return 0;
    const today = todayKey();
    let cursor = days.has(today) ? today : shiftDay(today, -1);
    if (!days.has(cursor)) return 0;
    let streak = 0;
    while (days.has(cursor)) {
      streak += 1;
      cursor = shiftDay(cursor, -1);
    }
    return streak;
  }

  function bestStreak() {
    return Number(localStorage.getItem(BEST_KEY) || 0);
  }

  function phaseMarkup() {
    const c = core();
    if (!c) return "";
    const movies = c.data()?.movies || [];
    const journey = c.state?.journey || {};
    const released = movies.filter((m) => m.status === "released");
    return PHASES.map((ph) => {
      const inPhase = released.filter((m) => m.phase === ph.name);
      if (!inPhase.length) return "";
      const seen = inPhase.filter((m) => journey[m.id] === "watched").length;
      const pct = Math.round((seen / inPhase.length) * 100);
      return `
        <div class="stats-bar-row">
          <span class="stats-bar-row__label" style="color:${ph.color}">${ph.name}</span>
          <span class="stats-bar-row__track"><span class="stats-bar-row__fill" style="width:${pct}%;background:${ph.color}"></span></span>
          <span class="stats-bar-row__count">${seen}/${inPhase.length}</span>
        </div>`;
    }).join("");
  }

  function streakMarkup() {
    const cur = currentStreak();
    const best = Math.max(bestStreak(), cur);
    const msg =
      cur === 0
        ? "Mark any title as watched today to start a streak."
        : cur === 1
          ? "Watched today — come back tomorrow to keep it alive."
          : `${cur} day${cur === 1 ? "" : "s"} in a row. Face front, true believer!`;
    return `
      <section class="stats-streak">
        <svg class="stats-streak__flame" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2c1.2 4.6-3.2 6.4-3.6 10a3.6 3.6 0 0 0 7.2 0c0-1.4-.7-2.7-1.6-3.8.2 1-.4 1.9-1.1 2.4.3-2.5-1.1-5.4-.9-8.6zM12 22a4 4 0 0 1-4-4c0-3.2 3-5.4 4-8.4 1 3 4 5.2 4 8.4a4 4 0 0 1-4 4z"/></svg>
        <div class="stats-streak__copy">
          <strong>${cur} day${cur === 1 ? "" : "s"} streak</strong>
          <span>${msg}</span>
        </div>
        <div class="stats-streak__best"><em>Best</em><b>${best}</b></div>
      </section>`;
  }

  function statsMarkup() {
    const phases = phaseMarkup();
    return (
      (phases ? `<h4 class="stats-section-title">Progress by phase</h4><div class="stats-bars">${phases}</div>` : "") +
      streakMarkup()
    );
  }

  function init() {
    window.addEventListener("nexus-journey", (event) => {
      const detail = event.detail || {};
      if (detail.status !== "watched" || detail.previous === "watched") return;
      recordWatch();
      const c = core();
      if (c && c.els && c.els.statsPanel && !c.els.statsPanel.hidden) {
        c.renderStats();
      }
    });
  }

  window.addEventListener("nexus-ready", init, { once: true });

  window.NexusProgress = {
    statsMarkup,
    phaseMarkup,
    currentStreak,
    bestStreak,
    recordWatch,
  };
})();
