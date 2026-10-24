/* ============================================================
   Nexus Mobile — all-in-one mobile/tablet enhancement module
   Enhancements: bottom nav, swipe gestures, pull-to-refresh,
   enhanced detail, mobile search, touch-optimized panels,
   tablet 2-column, onboarding
   ============================================================ */
(function () {
  "use strict";

  const isMobile = () => window.matchMedia("(max-width: 640px)").matches;
  const isTablet = () => window.matchMedia("(min-width: 641px) and (max-width: 1024px)").matches;
  const isTouch = () => window.matchMedia("(pointer: coarse)").matches;
  const core = () => window.NexusCore;

  const MOBILE_SEARCH_KEY = "nexus.mobile.recent";
  const ONBOARDING_KEY = "nexus.mobile.onboarded";

  /* =====================================================
     1. BOTTOM NAV BAR
     ===================================================== */
  function initBottomNav() {
    const nav = document.getElementById("mobile-nav");
    if (!nav) return;

    const items = nav.querySelectorAll(".mobile-nav__item");
    items.forEach((item) => {
      item.addEventListener("click", () => {
        const target = item.dataset.nav;
        handleNavTap(target, items, item);
      });
    });
  }

  function handleNavTap(target, allItems, activeItem) {
    const c = core();
    if (!c) return;

    // Reset active states
    allItems.forEach((i) => i.classList.remove("is-active"));

    switch (target) {
      case "search":
        openMobileSearch();
        break;
      case "timeline":
        activeItem.classList.add("is-active");
        closeAllMobilePanels();
        // Scroll to top of timeline
        const sa = c.els.scrollArea;
        if (sa) sa.scrollTo({ left: 0, top: 0, behavior: "smooth" });
        break;
      case "journey":
        activeItem.classList.add("is-active");
        const jl = document.getElementById("journey-launch");
        if (jl) jl.click();
        break;
      case "watchlist":
        activeItem.classList.add("is-active");
        const wl = document.getElementById("watchlist-launch");
        if (wl) wl.click();
        break;
      case "more":
        activeItem.classList.add("is-active");
        toggleMoreSheet(true);
        break;
    }
  }

  function closeAllMobilePanels() {
    // Close detail
    const dp = document.getElementById("detail-panel");
    if (dp && !dp.hidden) {
      dp.classList.remove("is-open");
      dp.hidden = true;
      dp.setAttribute("aria-hidden", "true");
    }
    // Close overlay
    const ov = document.getElementById("overlay");
    if (ov) ov.classList.remove("is-visible");
    // Close more sheet
    toggleMoreSheet(false);
    // Close mobile search
    closeMobileSearch();
    // Close star menu
    const sm = document.getElementById("star-menu");
    if (sm) sm.hidden = true;
  }

  /* =====================================================
     2. MORE SHEET (bottom sheet with extra tools)
     ===================================================== */
  function toggleMoreSheet(open) {
    const sheet = document.getElementById("mobile-more-sheet");
    const backdrop = document.getElementById("mobile-more-backdrop");
    if (!sheet) return;

    if (open === undefined) open = sheet.hidden;
    sheet.hidden = !open;

    if (open) {
      requestAnimationFrame(() => sheet.classList.add("is-open"));
      backdrop.addEventListener("click", () => toggleMoreSheet(false), { once: true });
    } else {
      sheet.classList.remove("is-open");
    }
  }

  function initMoreSheet() {
    const grid = document.getElementById("mobile-more-grid");
    if (!grid) return;

    grid.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-more]");
      if (!btn) return;
      const action = btn.dataset.more;
      toggleMoreSheet(false);

      const c = core();
      if (!c) return;

      switch (action) {
        case "villains": window.NexusVillains?.toggle(); break;
        case "credits": window.NexusCredits?.toggle(); break;
        case "eggs": window.Eggs?.toggle(); break;
        case "stats": c.toggleStatsPanel?.(true); break;
        case "achievements": c.toggleAchievementsPanel?.(true); break;
        case "optimizer": c.toggleOptimizer?.(true); break;
        case "commute": c.toggleCommuteMode?.(true); break;
        case "variants": c.toggleVariantScan?.(); break;
        case "quiz": window.Quiz?.toggle(); break;
        case "party": window.WatchParty?.toggle(); break;
        case "share": window.ShareCard?.toggle(); break;
        case "nostalgia": window.Nostalgia?.toggle(); break;
      }
    });
  }

  /* =====================================================
     3. SWIPE GESTURES ON MOVIE NODES
     ===================================================== */
  // Swipe gestures removed — they conflict with timeline pan/scroll.
  // Long-press for star menu is handled in app.js.
  // Swipe-to-dismiss on panels is handled in initTouchPanels below.

  /* =====================================================
     4. PULL-TO-REFRESH
     ===================================================== */
  const PTR_THRESHOLD = 80;
  let ptrStartY = 0, ptrActive = false;

  function initPullToRefresh() {
    const sa = document.getElementById("scroll-area");
    if (!sa) return;

    sa.addEventListener("touchstart", (e) => {
      if (sa.scrollTop <= 0) {
        ptrStartY = e.touches[0].clientY;
        ptrActive = true;
      } else {
        ptrActive = false;
      }
    }, { passive: true });

    sa.addEventListener("touchmove", (e) => {
      if (!ptrActive) return;
      const dy = e.touches[0].clientY - ptrStartY;
      if (dy > 30 && sa.scrollTop <= 0) {
        const indicator = document.getElementById("ptr-indicator");
        if (indicator) indicator.hidden = false;
      }
    }, { passive: true });

    sa.addEventListener("touchend", (e) => {
      if (!ptrActive) return;
      ptrActive = false;
      const indicator = document.getElementById("ptr-indicator");
      const dy = e.changedTouches?.[0]?.clientY - ptrStartY;
      if (dy > PTR_THRESHOLD && indicator) {
        // Trigger refresh
        indicator.hidden = false;
        const c = core();
        if (c) {
          c.render();
          setTimeout(() => { indicator.hidden = true; }, 1000);
        } else {
          setTimeout(() => { indicator.hidden = true; }, 1000);
        }
      } else if (indicator) {
        indicator.hidden = true;
      }
    }, { passive: true });
  }

  /* =====================================================
     5. ENHANCED DETAIL PANEL (tabbed content)
     ===================================================== */
  function initEnhancedDetail() {
    // Setup done on-demand via the centralized panel poll below
  }

  function highlightDetailSection(tab) {
    const content = document.getElementById("detail-content");
    if (!content) return;
    // Remove previous highlights
    content.querySelectorAll(".detail-highlight-scroll").forEach((el) => el.classList.remove("detail-highlight-scroll"));

    let target;
    switch (tab) {
      case "info":
        target = content.querySelector(".detail-meta") || content.querySelector(".detail-synopsis");
        break;
      case "cast":
        target = content.querySelector(".detail-keycast");
        break;
      case "where":
        target = content.querySelector(".detail-ott");
        break;
    }
    if (target) {
      target.classList.add("detail-highlight-scroll");
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* =====================================================
     6. MOBILE SEARCH OVERLAY
     ===================================================== */
  function openMobileSearch() {
    const overlay = document.getElementById("mobile-search");
    if (!overlay) return;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    const input = document.getElementById("mobile-search-input");
    if (input) {
      input.value = "";
      input.focus();
      loadRecentSearches();
    }

    // Close listeners
    document.getElementById("mobile-search-close")?.addEventListener("click", closeMobileSearch, { once: true });
  }

  function closeMobileSearch() {
    const overlay = document.getElementById("mobile-search");
    if (!overlay) return;
    overlay.classList.remove("is-open");
    setTimeout(() => { overlay.hidden = true; }, 250);
  }

  function loadRecentSearches() {
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(MOBILE_SEARCH_KEY) || "[]"); } catch {}
    const list = document.getElementById("mobile-search-recent-list");
    const recentSection = document.getElementById("mobile-search-recent");
    if (!list) return;

    if (recent.length === 0) {
      recentSection.hidden = true;
      return;
    }
    recentSection.hidden = false;
    list.innerHTML = recent.map((q) =>
      `<button class="mobile-search__recent-item" data-query="${escapeHtml(q)}">${escapeHtml(q)}</button>`
    ).join("");

    list.addEventListener("click", (e) => {
      const btn = e.target.closest(".mobile-search__recent-item");
      if (!btn) return;
      const input = document.getElementById("mobile-search-input");
      if (input) { input.value = btn.dataset.query; input.dispatchEvent(new Event("input")); }
    });
  }

  function saveRecentSearch(query) {
    if (!query || query.length < 2) return;
    let recent = [];
    try { recent = JSON.parse(localStorage.getItem(MOBILE_SEARCH_KEY) || "[]"); } catch {}
    recent = recent.filter((q) => q !== query);
    recent.unshift(query);
    if (recent.length > 8) recent = recent.slice(0, 8);
    try { localStorage.setItem(MOBILE_SEARCH_KEY, JSON.stringify(recent)); } catch {}
  }

  function initMobileSearch() {
    const input = document.getElementById("mobile-search-input");
    if (!input) return;

    let searchTimer;
    input.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const q = input.value.trim();
        performMobileSearch(q);
      }, 200);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const q = input.value.trim();
        if (q) {
          saveRecentSearch(q);
          // Sync to main search
          const mainInput = document.getElementById("search-input");
          if (mainInput) { mainInput.value = q; mainInput.dispatchEvent(new Event("input")); }
          closeMobileSearch();
        }
      }
      if (e.key === "Escape") closeMobileSearch();
    });

    // Voice search
    const voiceBtn = document.getElementById("mobile-search-voice");
    if (voiceBtn) {
      voiceBtn.addEventListener("click", () => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
          showToast("Voice search not supported in this browser");
          return;
        }
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        voiceBtn.classList.add("is-listening");
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          input.value = transcript;
          input.dispatchEvent(new Event("input"));
          voiceBtn.classList.remove("is-listening");
        };
        recognition.onerror = () => voiceBtn.classList.remove("is-listening");
        recognition.onend = () => voiceBtn.classList.remove("is-listening");
        recognition.start();
      });
    }
  }

  function performMobileSearch(query) {
    const results = document.getElementById("mobile-search-results");
    const recentSection = document.getElementById("mobile-search-recent");
    if (!results) return;

    if (!query || query.length < 2) {
      results.hidden = true;
      if (recentSection) recentSection.hidden = false;
      return;
    }
    if (recentSection) recentSection.hidden = true;
    results.hidden = false;

    const c = core();
    if (!c) return;
    const movies = c.data()?.movies || [];
    const q = query.toLowerCase();
    const matches = movies.filter((m) => {
      const text = `${m.title} ${m.year || ""} ${m.director || ""} ${m.line || ""}`.toLowerCase();
      return text.includes(q);
    }).slice(0, 20);

    if (matches.length === 0) {
      results.innerHTML = `<div class="mobile-search__empty">No results for "${escapeHtml(query)}"</div>`;
      return;
    }

    results.innerHTML = matches.map((m) => `
      <button class="mobile-search__result" data-id="${m.id}">
        <span class="mobile-search__result-title">${escapeHtml(m.title)}</span>
        <span class="mobile-search__result-meta">${m.year || ""} ${m.director ? "· " + m.director : ""}</span>
      </button>
    `).join("");

    results.addEventListener("click", (e) => {
      const btn = e.target.closest(".mobile-search__result");
      if (!btn) return;
      saveRecentSearch(query);
      closeMobileSearch();
      c.openDetail(btn.dataset.id);
    });
  }

  /* =====================================================
     7. TOUCH-OPTIMIZED PANELS (drag handles, swipe dismiss)
     ===================================================== */
  function initTouchPanels() {
    if (!isMobile()) return;

    // Add drag handles directly — panels exist in DOM from the start
    const panelSelectors = [
      ".detail-panel", ".cast-panel", ".watchlist-panel",
      ".achievements-panel", ".stats-panel", ".optimizer-panel",
      ".gauntlet-panel", ".experience-panel", ".tva-dossier"
    ];

    panelSelectors.forEach((sel) => {
      const panel = document.querySelector(sel);
      if (!panel || panel.querySelector(".panel-drag-handle")) return;
      const handle = document.createElement("div");
      handle.className = "panel-drag-handle";
      panel.prepend(handle);
      initPanelDragDismiss(panel, handle);
    });
    });
  }

  function initPanelDragDismiss(panel, handle) {
    let startY = 0, currentY = 0, dragging = false;

    handle.addEventListener("touchstart", (e) => {
      startY = e.touches[0].clientY;
      dragging = true;
      panel.style.transition = "none";
    }, { passive: true });

    handle.addEventListener("touchmove", (e) => {
      if (!dragging) return;
      currentY = e.touches[0].clientY - startY;
      if (currentY < 0) currentY = 0;
      panel.style.transform = `translateY(${currentY}px)`;
      panel.style.opacity = 1 - currentY / 400;
    }, { passive: true });

    handle.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false;
      panel.style.transition = "";
      if (currentY > 120) {
        // Dismiss panel
        panel.classList.remove("is-open");
        panel.hidden = true;
        panel.style.transform = "";
        panel.style.opacity = "";
        // Also close overlay
        const ov = document.getElementById("overlay");
        if (ov) ov.classList.remove("is-visible");
      } else {
        panel.style.transform = "";
        panel.style.opacity = "";
      }
      currentY = 0;
    }, { passive: true });
  }

  /* =====================================================
     8. TABLET 2-COLUMN LAYOUT
     ===================================================== */
  function initTabletLayout() {
    // The CSS handles the visual layout via media queries.
    // JS handles: when detail opens on tablet, keep timeline visible
    // We add a class to body when tablet + detail open
    // Using a lightweight event listener instead of MutationObserver
    const dp = document.getElementById("detail-panel");
    if (!dp) return;
    dp.addEventListener("transitionend", () => {
      if (isTablet()) {
        document.body.classList.toggle("tablet-detail-open", !dp.hidden);
      }
    });
    // Also check on click (panel open/close triggers)
    dp.addEventListener("click", () => {
      setTimeout(() => {
        if (isTablet()) {
          document.body.classList.toggle("tablet-detail-open", !dp.hidden);
        } else {
          document.body.classList.remove("tablet-detail-open");
        }
      }, 50);
    });
  }

  /* =====================================================
     9. ONBOARDING TUTORIAL
     ===================================================== */
  function initOnboarding() {
    try {
      if (localStorage.getItem(ONBOARDING_KEY)) return;
    } catch {}

    // Only on mobile/touch
    if (!isTouch()) return;

    const overlay = document.getElementById("onboarding");
    const btn = document.getElementById("onboarding-btn");
    const skip = document.getElementById("onboarding-skip");
    if (!overlay || !btn) return;

    let step = 1;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add("is-open"));

    function showStep(n) {
      overlay.querySelectorAll(".onboarding__step").forEach((s) => s.hidden = true);
      overlay.querySelectorAll(".onboarding__dot").forEach((d, i) => d.classList.toggle("is-active", i === n - 1));
      const stepEl = document.getElementById(`onboarding-step-${n}`);
      if (stepEl) stepEl.hidden = false;
      btn.textContent = n === 3 ? "Get started" : "Next";
    }

    btn.addEventListener("click", () => {
      step++;
      if (step > 3) {
        closeOnboarding();
        return;
      }
      showStep(step);
    });

    skip.addEventListener("click", closeOnboarding);

    function closeOnboarding() {
      overlay.classList.remove("is-open");
      setTimeout(() => { overlay.hidden = true; }, 300);
      try { localStorage.setItem(ONBOARDING_KEY, "1"); } catch {}
    }
  }

  /* =====================================================
     UTILITIES
     ===================================================== */
  function showToast(msg) {
    let toast = document.getElementById("nx-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "nx-toast";
      toast.className = "nx-toast";
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("is-visible");
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  /* =====================================================
     INIT
     ===================================================== */
  function init() {
    if (window._nexusMobileInit) return;
    window._nexusMobileInit = true;

    initBottomNav();
    initMoreSheet();
    initPullToRefresh();
    initEnhancedDetail();
    initMobileSearch();
    initTouchPanels();
    initTabletLayout();
    initOnboarding();
  }

  // Wait for NexusCore to be ready
  if (window.NexusCore) {
    init();
  } else {
    window.addEventListener("load", () => {
      setTimeout(init, 100);
    });
  }
})();
