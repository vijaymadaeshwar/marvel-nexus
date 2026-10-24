// Marvel Nexus — lightweight analytics & error tracking
// Everything stored locally; no external services required.
(function () {
  "use strict";

  const STORE_KEY = "nexus-analytics";
  const MAX_EVENTS = 500;

  let data = { events: [], errors: [], perf: {} };
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) data = JSON.parse(raw);
    if (!Array.isArray(data.events)) data.events = [];
    if (!Array.isArray(data.errors)) data.errors = [];
  } catch {}

  function save() {
    try {
      if (data.events.length > MAX_EVENTS) data.events = data.events.slice(-MAX_EVENTS);
      if (data.errors.length > 100) data.errors = data.errors.slice(-100);
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch {}
  }

  function track(name, props) {
    data.events.push({ t: Date.now(), n: name, p: props || {} });
    save();
  }

  function trackError(err) {
    data.errors.push({
      t: Date.now(),
      msg: err.message || String(err),
      src: err.filename || "",
      line: err.lineno || 0,
      col: err.colno || 0,
      stack: err.error?.stack?.substring(0, 500) || "",
    });
    save();
  }

  // --- Error tracking ---
  window.addEventListener("error", (e) => {
    trackError({ message: e.message, filename: e.filename, lineno: e.lineno, colno: e.colno, error: e.error });
  });
  window.addEventListener("unhandledrejection", (e) => {
    trackError({ message: "Unhandled Promise: " + (e.reason?.message || String(e.reason)), filename: "", lineno: 0, colno: 0, error: e.reason });
  });

  // --- Performance metrics (collected once after load) ---
  window.addEventListener("load", () => {
    setTimeout(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      if (nav) {
        data.perf = {
          domInteractive: Math.round(nav.domInteractive - nav.startTime),
          domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
          fullLoad: Math.round(nav.loadEventEnd - nav.startTime),
          domNodes: document.querySelectorAll("*").length,
          movieNodes: document.querySelectorAll(".movie-node").length,
        };
        save();
      }
    }, 3000);
  });

  // --- Auto-track panel opens via MutationObserver ---
  const panelObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
      if (m.type === "attributes" && m.attributeName === "class") {
        const el = m.target;
        if (el.classList.contains("is-open")) {
          track("panel-open", { id: el.id || el.className.substring(0, 40) });
        }
      }
    });
  });

  // Observe all panels once DOM is ready
  function observePanels() {
    document.querySelectorAll('[id$="-panel"], .detail-panel, .cast-panel, .watchlist-panel').forEach((p) => {
      panelObserver.observe(p, { attributes: true, attributeFilter: ["class"] });
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", observePanels);
  } else {
    observePanels();
  }

  // --- Public API ---
  window.NexusAnalytics = {
    track,
    trackError,
    getEvents: () => [...data.events],
    getErrors: () => [...data.errors],
    getPerf: () => ({ ...data.perf }),
    clear: () => { data = { events: [], errors: [], perf: {} }; save(); },
  };
})();
