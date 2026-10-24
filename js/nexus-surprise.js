(() => {
  "use strict";

  const core = () => window.NexusCore;
  let lastPick = null;

  function surprise() {
    const c = core();
    if (!c) return null;
    const all = c.data()?.movies || [];
    if (!all.length) return null;
    const released = all.filter((m) => m.status === "released");
    let pool = released.length ? released : all;
    if (pool.length > 1 && lastPick) pool = pool.filter((m) => m.id !== lastPick);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    lastPick = pick.id;
    if (c.revealTitle) c.revealTitle(pick.id);
    if (c.openDetail) c.openDetail(pick.id);
    return pick;
  }

  function init() {
    const btn = document.getElementById("surprise-btn");
    if (btn) btn.addEventListener("click", surprise);
  }

  window.addEventListener("nexus-ready", init, { once: true });

  window.Surprise = { go: surprise };
})();
