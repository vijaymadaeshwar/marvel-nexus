// Marvel Nexus — Secret Wars ending easter egg
// When all released titles are watched, trigger a credits-roll animation.
(function () {
  "use strict";

  const EGG_KEY = "nexus-secretwars-seen";
  let creditsEl = null;

  function checkAllWatched() {
    try {
      const core = window.NexusCore;
      if (!core || !core.data) return;
      const movies = core.data().movies;
      const eligible = movies.filter((m) => m.status === "released");
      const journey = core.state.journey;
      const allWatched = eligible.length > 0 && eligible.every((m) => journey[m.id] === "watched");
      return allWatched ? eligible : null;
    } catch { return null; }
  }

  function triggerEnding(eligible) {
    if (sessionStorage.getItem(EGG_KEY)) return;
    sessionStorage.setItem(EGG_KEY, "1");

    const totalMinutes = eligible.reduce((s, m) => s + (m.runtimeMinutes || 0), 0);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const stats = window.NexusCore.journeyStats();

    // Build credits data
    const directors = {};
    eligible.forEach((m) => {
      if (m.director) directors[m.director] = (directors[m.director] || 0) + 1;
    });
    const topDirectors = Object.entries(directors).sort((a, b) => b[1] - a[1]).slice(0, 12);

    const phases = {};
    eligible.forEach((m) => {
      const key = m.saga || "Other";
      if (!phases[key]) phases[key] = { count: 0, minutes: 0 };
      phases[key].count++;
      phases[key].minutes += m.runtimeMinutes || 0;
    });

    creditsEl = document.createElement("div");
    creditsEl.className = "secret-wars-overlay";
    creditsEl.setAttribute("role", "dialog");
    creditsEl.setAttribute("aria-modal", "true");
    creditsEl.setAttribute("aria-label", "Journey complete — credits roll");
    creditsEl.innerHTML = `
      <div class="sw-backdrop"></div>
      <div class="sw-credits" id="sw-credits">
        <div class="sw-hero">
          <div class="sw-marvel-logo">MARVEL</div>
          <h1 class="sw-title">SECRET WARS</h1>
          <p class="sw-subtitle">Your Journey Is Complete</p>
        </div>

        <div class="sw-section">
          <h2>Achievement Unlocked</h2>
          <div class="sw-stat-row">
            <span class="sw-stat-big">${eligible.length}</span>
            <span class="sw-stat-label">Titles Watched</span>
          </div>
          <div class="sw-stat-row">
            <span class="sw-stat-big">${hours}h ${mins}m</span>
            <span class="sw-stat-label">Total Runtime</span>
          </div>
          <div class="sw-stat-row">
            <span class="sw-stat-big">${stats.percent}%</span>
            <span class="sw-stat-label">Timeline Complete</span>
          </div>
        </div>

        <div class="sw-section">
          <h2>By Saga</h2>
          ${Object.entries(phases).map(([name, data]) => `
            <div class="sw-saga-row">
              <span class="sw-saga-name">${name}</span>
              <span class="sw-saga-count">${data.count} titles · ${Math.floor(data.minutes / 60)}h ${data.minutes % 60}m</span>
            </div>
          `).join("")}
        </div>

        <div class="sw-section">
          <h2>Most Watched Directors</h2>
          ${topDirectors.map(([name, count]) => `
            <div class="sw-director-row">
              <span>${name}</span>
              <span class="sw-director-count">${count} ${count === 1 ? "film" : "films"}</span>
            </div>
          `).join("")}
        </div>

        <div class="sw-section sw-thanks">
          <p>Thank you for exploring the entire Marvel multiverse with <strong>Marvel Nexus</strong>.</p>
          <p class="sw-small">Every universe charted. Every story told. Every stone collected.</p>
        </div>

        <div class="sw-section">
          <button type="button" class="sw-close-btn" id="sw-close-btn" aria-label="Close credits">Continue Exploring</button>
        </div>
      </div>
    `;

    document.body.appendChild(creditsEl);
    requestAnimationFrame(() => creditsEl.classList.add("is-visible"));

    const closeBtn = document.getElementById("sw-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeEnding);
    }
    creditsEl.addEventListener("click", (e) => {
      if (e.target === creditsEl || e.target.classList.contains("sw-backdrop")) closeEnding();
    });
    document.addEventListener("keydown", function handler(e) {
      if (e.key === "Escape") {
        closeEnding();
        document.removeEventListener("keydown", handler);
      }
    });
  }

  function closeEnding() {
    if (!creditsEl) return;
    creditsEl.classList.remove("is-visible");
    setTimeout(() => { creditsEl?.remove(); creditsEl = null; }, 600);
  }

  // Check after journey loads
  let checked = false;
  function onJourneyReady() {
    if (checked) return;
    checked = true;
    setTimeout(() => {
      const eligible = checkAllWatched();
      if (eligible) triggerEnding(eligible);
    }, 2000);
  }

  // Listen for journey changes
  const origSet = window.NexusCore?.setJourneyStatus;
  if (origSet) {
    window.NexusCore.setJourneyStatus = function (...args) {
      origSet.apply(this, args);
      checked = false;
      setTimeout(onJourneyReady, 500);
    };
  }

  window.addEventListener("load", () => setTimeout(onJourneyReady, 3000));

  window.NexusSecretWars = { check: onJourneyReady };
})();
