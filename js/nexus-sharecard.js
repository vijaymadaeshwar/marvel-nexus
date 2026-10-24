(() => {
  "use strict";

  const core = () => window.NexusCore;
  const SERIES_SUFFIX = / — Season \d+$/;
  const W = 1200;
  const H = 630;

  let panel;
  let closeBtn;
  let launchBtn;
  let canvas;
  let downloadBtn;
  let previewName;
  let open = false;

  function shortTitle(title) {
    return String(title).replace(SERIES_SUFFIX, "");
  }

  function session() {
    // No sign-in in Nexus — the card always celebrates a true believer.
    return { name: "True Believer", email: "truebeliever@marvel-nexus.local", initials: "TB" };
  }

  function stats() {
    const data = core() && core().data ? core().data() : null;
    const movies = data ? data.movies : [];
    const journey = (core() && core().state && core().state.journey) || {};
    const watched = Object.keys(journey).filter((id) => journey[id] === "watched").length;
    const watchlist = core() && core().watchlist ? core().watchlist().size : 0;
    const stones = core() && core().gauntlet ? core().gauntlet().length : 0;
    const honours = core() && core().achievements ? core().achievements().length : 0;
    const watchedTitles = movies
      .filter((m) => journey[m.id] === "watched")
      .sort((a, b) => String(a.releaseDate).localeCompare(String(b.releaseDate)))
      .slice(0, 3);
    return { movies: movies.length, watched, watchlist, stones, honours, watchedTitles };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function seedStars(ctx, count) {
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < count; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const r = rand() * 1.3 + 0.3;
      ctx.globalAlpha = rand() * 0.5 + 0.15;
      ctx.fillStyle = "#cfeeda";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!canvas) return;
    const s = stats();
    const user = session() || { name: "Guest", email: "guest@marvel-nexus.local", initials: "G" };
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, "#0d1f13");
    grad.addColorStop(0.5, "#0b1710");
    grad.addColorStop(1, "#07100b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    const accent = ctx.createLinearGradient(0, 0, W, 0);
    accent.addColorStop(0, "#3ddc84");
    accent.addColorStop(0.5, "#ffd166");
    accent.addColorStop(1, "#22d3ee");
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, W, 6);

    seedStars(ctx, 160);

    ctx.textAlign = "left";
    ctx.fillStyle = "#3ddc84";
    ctx.font = "700 15px 'Segoe UI', Arial, sans-serif";
    ctx.letterSpacing = "6px";
    ctx.fillText("M A R V E L   N E X U S", 72, 96);

    ctx.fillStyle = "#eafff2";
    ctx.font = "700 46px 'Segoe UI', Arial, sans-serif";
    ctx.letterSpacing = "1px";
    ctx.fillText("Your journey across the multiverse", 72, 152);

    ctx.fillStyle = "#8fa99a";
    ctx.font = "500 19px 'Segoe UI', Arial, sans-serif";
    ctx.letterSpacing = "0.5px";
    ctx.fillText("Charting the saga from Iron Man to Secret Wars", 72, 190);

    // avatar
    ctx.beginPath();
    ctx.arc(96, 296, 44, 0, Math.PI * 2);
    ctx.fillStyle = "#173826";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#3ddc84";
    ctx.stroke();
    ctx.fillStyle = "#7dffb0";
    ctx.font = "700 34px 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(user.initials, 96, 306);
    ctx.textAlign = "left";

    ctx.fillStyle = "#eafff2";
    ctx.font = "700 26px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(user.name, 158, 290);
    ctx.fillStyle = "#8fa99a";
    ctx.font = "500 16px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(user.email, 158, 316);

    // stat chips
    const chips = [
      { label: "WATCHED", value: `${s.watched}/${s.movies}`, color: "#3ddc84" },
      { label: "WATCHLIST", value: String(s.watchlist), color: "#22d3ee" },
      { label: "STONES", value: `${s.stones}/6`, color: "#ffd166" },
      { label: "HONOURS", value: String(s.honours), color: "#ff5da2" },
    ];
    const chipW = 248;
    const chipH = 96;
    const chipGap = 20;
    let cx = 72;
    chips.forEach((chip) => {
      roundRect(ctx, cx, 372, chipW, chipH, 16);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.stroke();
      ctx.fillStyle = chip.color;
      ctx.font = "700 38px 'Segoe UI', Arial, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(chip.value, cx + 20, 424);
      ctx.fillStyle = "#8fa99a";
      ctx.font = "600 12px 'Segoe UI', Arial, sans-serif";
      ctx.fillText(chip.label, cx + 20, 446);
      cx += chipW + chipGap;
    });

    // watched titles strip
    const y0 = 510;
    ctx.fillStyle = "#8fa99a";
    ctx.font = "600 14px 'Segoe UI', Arial, sans-serif";
    ctx.fillText(s.watchedTitles.length ? "REWINDING THE GOOD BITS" : "NOTHING WATCHED YET", 72, y0 - 8);
    let tx = 72;
    s.watchedTitles.forEach((m, i) => {
      const label = shortTitle(m.title);
      ctx.font = "600 17px 'Segoe UI', Arial, sans-serif";
      const tw = ctx.measureText(label).width;
      const px = tx;
      roundRect(ctx, px, y0, tw + 36, 38, 19);
      ctx.fillStyle = i % 2 ? "rgba(34,211,238,0.14)" : "rgba(61,220,132,0.14)";
      ctx.fill();
      ctx.strokeStyle = i % 2 ? "rgba(34,211,238,0.5)" : "rgba(61,220,132,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "#eafff2";
      ctx.fillText(label, px + 18, y0 + 25);
      tx += tw + 56;
    });

    ctx.fillStyle = "#5b6f63";
    ctx.font = "500 13px 'Segoe UI', Arial, sans-serif";
    ctx.fillText("Generated on " + new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }), 72, H - 40);

    if (previewName) previewName.textContent = user.name + " · " + user.email;
  }

  function download() {
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "marvel-nexus-journey.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function shareOrDownload() {
    if (!canvas) return;
    try {
      canvas.toBlob((blob) => {
        if (!blob) { download(); return; }
        const file = new File([blob], "marvel-nexus-journey.png", { type: "image/png" });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: "My Marvel Nexus journey", text: "Check out my Marvel journey card!" })
            .catch(() => download());
        } else {
          download();
        }
      }, "image/png");
    } catch (e) {
      download();
    }
  }

  function openPanel() {
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launchBtn.setAttribute("aria-pressed", "true");
    draw();
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
    downloadBtn.addEventListener("click", shareOrDownload);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) closePanel();
    }, true);
  }

  function init() {
    panel = document.getElementById("share-panel");
    if (!panel) return;
    closeBtn = document.getElementById("share-panel-close");
    launchBtn = document.getElementById("share-btn");
    canvas = document.getElementById("share-canvas");
    downloadBtn = document.getElementById("share-download");
    previewName = document.getElementById("share-name");
    if (!launchBtn || !canvas || !downloadBtn) return;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    bind();
    window.ShareCard = { open: openPanel, close: closePanel, toggle, draw, download };
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
