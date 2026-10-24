(() => {
  "use strict";

  const core = () => window.NexusCore;
  const STORAGE_KEY = "nexus.stanlee";

  const QUIPS = [
    "Excelsior, true believer! And welcome to the House of Ideas.",
    "Face front, true believers! The Marvel Universe awaits.",
    "With great power comes great responsibility — and great snacks.",
    "I never miss a cameo. Not even this one.",
    "I've appeared in more films than some franchises. Nuff said!",
    "To me, my atlas! I've always wanted to say that.",
    "Stan Lee present! Even in a fan project, I had to show up.",
    "Behind every great hero is a narrator who has seen it all.",
    "Keep watching, true believers. The best is yet to come.",
    "Excelsior! That's my way of saying you're welcome.",
    "I said I'd never retire. Same goes for this app.",
    "Reading this in my voice? You have a fine inner monologue.",
    "Every timeline has one thing in common: a cameo from yours truly.",
    "Nuff said. Now go collect some stones.",
    "Make mine Marvel — and make mine on time.",
  ];

  const EVENT_QUIPS = {
    detail: ["You see, true believer, every hero has a story.", "I read this dossier myself. Twice.", "A classic! I remember it like it was yesterday."],
    achievement: ["Excelsior! An achievement worthy of the House of Ideas.", "Stan Lee approves. Nuff said!", "Another trophy for a true believer."],
  };

  let toggleBtn;
  let caption;
  let active = false;
  let timer = 0;
  let quipIndex = 0;
  let patched = false;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function pick(list) {
    const item = list[quipIndex % list.length];
    quipIndex += 1 + Math.floor(Math.random() * 2);
    return item;
  }

  function say(text) {
    if (!caption || !active) return;
    caption.textContent = text;
    caption.classList.remove("is-in");
    void caption.offsetWidth;
    caption.classList.add("is-in");
  }

  function quip(list) {
    if (active) say(pick(list || QUIPS));
  }

  function startRotation() {
    window.clearInterval(timer);
    timer = window.setInterval(() => {
      if (active) say(pick(QUIPS));
    }, 14000);
  }

  function setActive(next) {
    active = next;
    try { localStorage.setItem(STORAGE_KEY, active ? "on" : "off"); } catch (e) { /* ignore */ }
    toggleBtn.classList.toggle("is-active", active);
    toggleBtn.setAttribute("aria-pressed", String(active));
    document.body.classList.toggle("is-stanlee", active);
    if (active) {
      say("Excelsior! I'm your narrator for the multiverse. Face front!");
      startRotation();
    } else {
      window.clearInterval(timer);
      caption.classList.remove("is-in");
      window.setTimeout(() => {
        caption.textContent = "";
      }, 300);
    }
  }

  function toggle() {
    setActive(!active);
  }

  function migrate() {
    try {
      const oldKey = "nexus.deadpool";
      if (localStorage.getItem(STORAGE_KEY) === null && localStorage.getItem(oldKey) !== null) {
        localStorage.setItem(STORAGE_KEY, localStorage.getItem(oldKey));
        localStorage.removeItem(oldKey);
      }
    } catch (e) { /* ignore */ }
  }

  function patchCore() {
    if (patched || !core() || !core().openDetail) return;
    patched = true;
    const origOpen = core().openDetail;
    core().openDetail = function (id) {
      const result = origOpen.call(this, id);
      quip(EVENT_QUIPS.detail);
      return result;
    };
    const origUnlock = core().unlockAchievement;
    core().unlockAchievement = function (id) {
      const result = origUnlock.call(this, id);
      if (result) quip(EVENT_QUIPS.achievement);
      return result;
    };
  }

  function bind() {
    toggleBtn.addEventListener("click", toggle);
    patchCore();
  }

  function init() {
    toggleBtn = document.getElementById("stanlee-toggle");
    caption = document.getElementById("stanlee-caption");
    if (!toggleBtn || !caption) return;
    migrate();
    try {
      active = localStorage.getItem(STORAGE_KEY) === "on";
    } catch (e) { active = false; }
    setActive(active);
    bind();
    window.StanLee = { toggle, on: () => active, say };
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
