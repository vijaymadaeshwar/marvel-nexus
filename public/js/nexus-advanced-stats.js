// Marvel Nexus — Advanced statistics dashboard
// Enhances the existing stats panel with year breakdown, phase/saga views,
// streak tracking, and a completion-over-time bar chart.
(function () {
  "use strict";

  function getCore() {
    return window.NexusCore;
  }

  function getAllStats() {
    const core = getCore();
    if (!core || !core.data) return null;
    const movies = core.data().movies;
    const journey = core.state.journey;
    const eligible = movies.filter((m) => m.status === "released");
    const watchedIds = new Set(
      Object.entries(journey).filter(([, s]) => s === "watched").map(([id]) => id)
    );

    // Year breakdown
    const yearMap = {};
    eligible.forEach((m) => {
      const y = m.releaseDate?.slice(0, 4) || "TBA";
      if (!yearMap[y]) yearMap[y] = { total: 0, watched: 0, minutes: 0 };
      yearMap[y].total++;
      if (watchedIds.has(m.id)) {
        yearMap[y].watched++;
        yearMap[y].minutes += m.runtimeMinutes || 0;
      }
    });

    // Phase/saga breakdown
    const sagaMap = {};
    eligible.forEach((m) => {
      const key = m.saga || "Other";
      const phase = m.phase || "Unknown";
      const sKey = `${key} · ${phase}`;
      if (!sagaMap[sKey]) sagaMap[sKey] = { total: 0, watched: 0, minutes: 0, saga: key, phase };
      sagaMap[sKey].total++;
      if (watchedIds.has(m.id)) {
        sagaMap[sKey].watched++;
        sagaMap[sKey].minutes += m.runtimeMinutes || 0;
      }
    });

    // Director breakdown
    const dirMap = {};
    eligible.forEach((m) => {
      if (!m.director) return;
      if (!dirMap[m.director]) dirMap[m.director] = { total: 0, watched: 0 };
      dirMap[m.director].total++;
      if (watchedIds.has(m.id)) dirMap[m.director].watched++;
    });

    // Runtime stats
    const totalMinutes = eligible.reduce((s, m) => s + (m.runtimeMinutes || 0), 0);
    const watchedMinutes = eligible.reduce(
      (s, m) => s + (watchedIds.has(m.id) ? (m.runtimeMinutes || 0) : 0), 0
    );
    const avgRuntime = eligible.length ? Math.round(totalMinutes / eligible.length) : 0;

    // Streak
    let streak = 0;
    try { streak = JSON.parse(localStorage.getItem("nexus-streak") || "{}").count || 0; } catch {}
    let bestStreak = streak;
    try { bestStreak = JSON.parse(localStorage.getItem("nexus-best-streak") || "0") || streak; } catch {}
    if (streak > bestStreak) {
      bestStreak = streak;
      try { localStorage.setItem("nexus-best-streak", String(bestStreak)); } catch {}
    }

    // Top directors
    const topDirs = Object.entries(dirMap)
      .sort((a, b) => b[1].watched - a[1].watched)
      .slice(0, 8);

    return {
      yearMap,
      sagaMap,
      dirMap,
      topDirs,
      totalMinutes,
      watchedMinutes,
      avgRuntime,
      streak,
      bestStreak,
      eligible,
      watchedIds,
    };
  }

  function renderYearChart(yearMap) {
    const years = Object.keys(yearMap).sort();
    const maxTotal = Math.max(...years.map((y) => yearMap[y].total), 1);
    return years.map((y) => {
      const d = yearMap[y];
      const pct = d.total ? Math.round((d.watched / d.total) * 100) : 0;
      const h = d.total ? Math.max(4, (d.total / maxTotal) * 100) : 0;
      return `
        <div class="adv-year-col" title="${y}: ${d.watched}/${d.total} watched">
          <div class="adv-year-bar" style="height:${h}%">
            <div class="adv-year-fill" style="height:${pct}%"></div>
          </div>
          <span class="adv-year-label">${y.slice(2)}</span>
        </div>`;
    }).join("");
  }

  function renderSagaRows(sagaMap) {
    return Object.entries(sagaMap)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, d]) => {
        const pct = d.total ? Math.round((d.watched / d.total) * 100) : 0;
        return `
          <div class="adv-saga-row">
            <div class="adv-saga-info">
              <span class="adv-saga-name">${escapeHtml(name)}</span>
              <span class="adv-saga-count">${d.watched}/${d.total} · ${Math.floor(d.minutes / 60)}h ${d.minutes % 60}m</span>
            </div>
            <div class="adv-saga-bar"><div class="adv-saga-fill" style="width:${pct}%"></div></div>
          </div>`;
      }).join("");
  }

  function renderDirectorRows(topDirs) {
    return topDirs.map(([name, d]) => {
      const pct = d.total ? Math.round((d.watched / d.total) * 100) : 0;
      return `
        <div class="adv-dir-row">
          <span class="adv-dir-name">${escapeHtml(name)}</span>
          <span class="adv-dir-stat">${d.watched}/${d.total}</span>
          <div class="adv-dir-bar"><div class="adv-dir-fill" style="width:${pct}%"></div></div>
        </div>`;
    }).join("");
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function renderAdvancedStats() {
    const core = getCore();
    if (!core) return;
    const data = getAllStats();
    if (!data) return;

    // Check if stats panel is open and has our container
    const panel = document.getElementById("stats-panel");
    if (!panel || panel.hidden) return;

    let container = document.getElementById("adv-stats-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "adv-stats-container";
      container.className = "adv-stats";
      const content = document.getElementById("stats-content");
      if (content) content.parentNode.insertBefore(container, content.nextSibling);
    }

    container.innerHTML = `
      <div class="adv-divider"><span>Advanced Statistics</span></div>

      <div class="adv-card">
        <h3>Completion by Year</h3>
        <div class="adv-year-chart">${renderYearChart(data.yearMap)}</div>
      </div>

      <div class="adv-card">
        <h3>By Saga & Phase</h3>
        <div class="adv-saga-list">${renderSagaRows(data.sagaMap)}</div>
      </div>

      <div class="adv-card">
        <h3>Top Directors</h3>
        <div class="adv-dir-list">${renderDirectorRows(data.topDirs)}</div>
      </div>

      <div class="adv-card adv-card--row">
        <div class="adv-mini-stat">
          <strong>${Math.floor(data.watchedMinutes / 60)}h ${data.watchedMinutes % 60}m</strong>
          <span>Watched</span>
        </div>
        <div class="adv-mini-stat">
          <strong>${Math.floor(data.totalMinutes / 60)}h</strong>
          <span>Total runtime</span>
        </div>
        <div class="adv-mini-stat">
          <strong>${data.avgRuntime}m</strong>
          <span>Avg length</span>
        </div>
        <div class="adv-mini-stat">
          <strong>${data.streak}</strong>
          <span>Day streak</span>
        </div>
        <div class="adv-mini-stat">
          <strong>${data.bestStreak}</strong>
          <span>Best streak</span>
        </div>
      </div>
    `;
  }

  // Hook into existing stats panel
  let origRenderStats = null;
  function hookStats() {
    const core = getCore();
    if (!core || !core.els) return;
    // Wait for stats panel to open, then render advanced
    const observer = new MutationObserver(() => {
      const panel = document.getElementById("stats-panel");
      if (panel && !panel.hidden) {
        setTimeout(renderAdvancedStats, 100);
      }
    });
    const panel = document.getElementById("stats-panel");
    if (panel) {
      observer.observe(panel, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  // Also listen for stats button click
  document.addEventListener("click", (e) => {
    if (e.target.closest("#stats-btn")) {
      setTimeout(renderAdvancedStats, 150);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", hookStats);
  } else {
    hookStats();
  }

  window.NexusAdvancedStats = { render: renderAdvancedStats, getData: getAllStats };
})();
