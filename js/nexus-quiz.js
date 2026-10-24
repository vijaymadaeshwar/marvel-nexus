(() => {
  "use strict";
  const core = () => window.NexusCore;
  const STORAGE_KEY = "marvel-nexus-quiz-best";
  const TOTAL = 10;

  const QUESTIONS = [
    { q: "Which film kicked off the MCU in 2008?", options: ["Iron Man", "The Incredible Hulk", "Captain America: The First Avenger", "Thor"], answer: 0, movieId: "iron-man" },
    { q: "Who pulled the strings behind the Chitauri invasion?", options: ["Thanos", "Loki", "Red Skull", "Ultron"], answer: 1, movieId: "the-avengers" },
    { q: "What is the name of Thor's hammer?", options: ["Stormbreaker", "Gungnir", "Mjolnir", "Jarnbjorn"], answer: 2, movieId: "thor" },
    { q: "Which Infinity Stone was hidden in Vision's forehead?", options: ["Time Stone", "Mind Stone", "Soul Stone", "Power Stone"], answer: 1, movieId: "avengers-age-of-ultron" },
    { q: "What is the name of the virtual reality world in WandaVision?", options: ["The Quantum Realm", "The Hex", "The Anomaly", "The Dome"], answer: 1, movieId: "series-wandavision-season-1" },
    { q: "Who became the first Captain America?", options: ["Bucky Barnes", "John Walker", "Sam Wilson", "Steve Rogers"], answer: 3, movieId: "captain-america-the-first-avenger" },
    { q: "Which planet did the Guardians of the Galaxy first meet?", options: ["Xandar", "Knowhere", "Titan", "Morag"], answer: 0, movieId: "guardians-of-the-galaxy" },
    { q: "What is the name of the city Black Panther protects?", options: ["Latveria", "Zandar", "Wakanda", "Sokovia"], answer: 2, movieId: "black-panther" },
    { q: "In Spider-Man: No Way Home, who cast the spell that made the world forget Peter Parker?", options: ["Wong", "Doctor Strange", "Mordo", "Agatha Harkness"], answer: 1, movieId: "spider-man-no-way-home" },
    { q: "Which actor played Wolverine in the original X-Men trilogy?", options: ["Ryan Reynolds", "Hugh Jackman", "Chris Evans", "Chris Hemsworth"], answer: 1, movieId: "x-men" },
    { q: "What is the name of Thanos's home world?", options: ["Xandar", "Ego", "Titan", "Vormir"], answer: 2, movieId: "avengers-infinity-war" },
    { q: "What song does Star-Lord use to distract Ronan?", options: ["Hooked on a Feeling", "Come and Get Your Love", "Ain't No Mountain High Enough", "O-o-h Child"], answer: 1, movieId: "guardians-of-the-galaxy" },
    { q: "Which MCU film is set primarily in 1995?", options: ["Ant-Man", "Captain Marvel", "Black Widow", "Doctor Strange"], answer: 1, movieId: "captain-marvel" },
    { q: "Who directed all three films in the MCU Spider-Man trilogy?", options: ["Sam Raimi", "Jon Watts", "Marc Webb", "James Gunn"], answer: 1, movieId: "spider-man-homecoming" },
    { q: "What is the name of the red gem in the Tesseract?", options: ["Reality Stone", "Space Stone", "Power Stone", "Time Stone"], answer: 1, movieId: "the-avengers" },
    { q: "In X-Men: Days of Future Past, whose consciousness is sent back to 1973?", options: ["Professor X", "Jean Grey", "Storm", "Wolverine"], answer: 3, movieId: "x-men-days-of-future-past" },
    { q: "Which Marvel character is known as the 'Sorcerer Supreme'?", options: ["Thor", "Doctor Strange", "Scarlet Witch", "Ancient One"], answer: 1, movieId: "doctor-strange" },
    { q: "What is the name of the AI Tony Stark creates in Avengers: Age of Ultron?", options: ["FRIDAY", "JARVIS", "Ultron", "VISION"], answer: 2, movieId: "avengers-age-of-ultron" },
    { q: "Which Spider-Man villain was played by Willem Dafoe?", options: ["Doctor Octopus", "Electro", "Green Goblin", "Venom"], answer: 2, movieId: "spider-man-2002" },
    { q: "What is the name of the planet where Thanos raises Gamora?", options: ["Morag", "Vormir", "Lumaria", "Zen-Whoberi"], answer: 3, movieId: "avengers-infinity-war" },
    { q: "Who directed Deadpool (2016)?", options: ["James Mangold", "David Leitch", "Tim Miller", "Shawn Levy"], answer: 2, movieId: "deadpool-2016" },
    { q: "Which team of villains appeared in Thunderbolts*?", options: ["The Sinister Six", "The Dark Avengers", "The Thunderbolts", "The Masters of Evil"], answer: 2, movieId: "thunderbolts" },
    { q: "What organization did Black Widow defect from in her standalone film?", options: ["HYDRA", "AIM", "The Red Room", "SWORD"], answer: 2, movieId: "black-widow" },
    { q: "Which villain is known as the 'God Butcher'?", options: ["Malekith", "Hela", "Gorr", "Knull"], answer: 2, movieId: "thor-love-and-thunder" },
    { q: "Who plays Doctor Doom in the MCU's upcoming Avengers films?", options: ["Mads Mikkelsen", "Robert Downey Jr.", "Cillian Murphy", "Oscar Isaac"], answer: 1, movieId: "avengers-doomsday" },
    { q: "In Spider-Man: Into the Spider-Verse, what is Miles Morales's uncle named?", options: ["Ben Parker", "Aaron Davis", "Norman Osborn", "Miles Warren"], answer: 1, movieId: "spider-man-into-the-spider-verse" },
    { q: "Which classic Marvel film was released in 1998 and starred Wesley Snipes?", options: ["Daredevil", "Blade", "The Punisher", "Ghost Rider"], answer: 1, movieId: "blade-1998" },
    { q: "What is the name of Namor's underwater kingdom in Wakanda Forever?", options: ["Atlantis", "Talokan", "Terra Nova", "Poseidonis"], answer: 1, movieId: "black-panther-wakanda-forever" },
    { q: "Which Fantastic Four film introduced the Silver Surfer?", options: ["Fantastic Four (2005)", "Fantastic Four (2015)", "Rise of the Silver Surfer", "First Steps"], answer: 2, movieId: "fantastic-four-rise-of-the-silver-surfer" },
    { q: "What is the name of the Time Variance Authority in the Loki series?", options: ["SWORD", "SHIELD", "TVA", "DODC"], answer: 2, movieId: "series-loki-season-1" },
    { q: "Who directed Avengers: Infinity War and Endgame?", options: ["Joss Whedon", "Ryan Coogler", "The Russo Brothers", "Taika Waititi"], answer: 2, movieId: "avengers-infinity-war" },
    { q: "Which film features the multiverse crossing of three Spider-Men?", options: ["Across the Spider-Verse", "No Way Home", "Far From Home", "Brand New Day"], answer: 1, movieId: "spider-man-no-way-home" },
    { q: "What is the name of the red universe in Doctor Strange in the Multiverse of Madness?", options: ["Earth-838", "Earth-616", "Earth-199999", "Earth-1218"], answer: 0, movieId: "doctor-strange-in-the-multiverse-of-madness" },
    { q: "Which villain does Shang-Chi confront in his solo film?", options: ["Mandarin", "Wenwu", "The Abomination", "Taskmaster"], answer: 1, movieId: "shang-chi-and-the-legend-of-the-ten-rings" },
    { q: "What is the name of the superhero team in The Fantastic Four: First Steps?", options: ["The Avengers", "The X-Men", "The Fantastic Four", "The Defenders"], answer: 2, movieId: "the-fantastic-four-first-steps" },
    { q: "Who is the main villain in Venom: The Last Dance?", options: ["Riot", "Carnage", "Knull", "Toxin"], answer: 2, movieId: "venom-the-last-dance" },
    { q: "What is the name of the ancient mutant in X-Men: Apocalypse?", options: ["Magneto", "En Sabah Nur", "Mr. Sinister", "Apocalypse"], answer: 1, movieId: "x-men-apocalypse" },
    { q: "Which Marvel film features the Eternals?", options: ["Eternals", "Guardians of the Galaxy Vol. 3", "The Marvels", "Shang-Chi"], answer: 0, movieId: "eternals" },
    { q: "What is the name of the criminal organization in Daredevil?", options: ["The Hand", "The Foot", "The Flock", "The Claw"], answer: 0, movieId: "series-daredevil-season-1" },
    { q: "Who plays the High Evolutionary in Guardians of the Galaxy Vol. 3?", options: ["Kurt Russell", "Christian Bale", "Chiwetel Ejiofor", "Lee Pace"], answer: 2, movieId: "guardians-of-the-galaxy-vol-3" },
  ];

  let panel = null;
  let body = null;
  let isOpen = false;
  let currentQ = 0;
  let score = 0;
  let questions = [];
  let answered = false;
  let results = [];

  function ensureStyles() {
    if (document.getElementById("quiz-styles")) return;
    const s = document.createElement("style");
    s.id = "quiz-styles";
    s.textContent = `
      .quiz-panel { /* inherits .experience-panel styles */ }
      .quiz-panel__body { padding:16px; overflow-y:auto; }
      .quiz-question { font:600 15px var(--font-body); color:var(--text); margin-bottom:14px; line-height:1.4; }
      .quiz-question small { display:block; color:var(--text-dim); font-weight:400; font-size:11px; margin-top:4px; }
      .quiz-options { display:grid; gap:8px; }
      .quiz-option { padding:12px 14px; border:1px solid var(--border); border-radius:12px; background:var(--bg-panel); color:var(--text); font:500 13px var(--font-body); cursor:pointer; text-align:left; transition: all .15s ease; }
      .quiz-option:hover { border-color:rgba(61,220,132,.5); background:rgba(61,220,132,.08); }
      .quiz-option.correct { border-color:#3ddc84; background:rgba(61,220,132,.2); color:#fff; }
      .quiz-option.wrong { border-color:#ff6b57; background:rgba(255,107,87,.15); }
      .quiz-option:disabled { cursor:default; opacity:.85; }
      .quiz-progress { display:flex; align-items:center; gap:10px; margin-bottom:16px; color:var(--text-dim); font:11px var(--font-mono); }
      .quiz-progress__bar { flex:1; height:4px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden; }
      .quiz-progress__fill { height:100%; border-radius:2px; background:linear-gradient(90deg,#3ddc84,#22d3ee); transition:width .3s ease; }
      .quiz-score { text-align:center; padding:30px 16px; }
      .quiz-score h3 { font:36px/1 var(--font-display); margin:0 0 6px; }
      .quiz-score p { color:var(--text-dim); font:13px var(--font-body); margin:0 0 20px; }
      .quiz-start { display:flex; flex-direction:column; align-items:center; gap:12px; padding:30px 16px; text-align:center; }
      .quiz-start p { color:var(--text-dim); font:12px var(--font-body); margin:0; }
      .quiz-start-btn, .quiz-play-again { padding:12px 28px; border:1px solid rgba(61,220,132,.5); border-radius:999px; background:linear-gradient(135deg,rgba(61,220,132,.2),rgba(45,212,191,.12)); color:#7dffb0; font:600 13px var(--font-body); cursor:pointer; transition: all .15s ease; }
      .quiz-start-btn:hover, .quiz-play-again:hover { background:linear-gradient(135deg,rgba(61,220,132,.35),rgba(45,212,191,.2)); box-shadow:0 0 20px rgba(61,220,132,.3); }
      .quiz-review { margin-top:16px; }
      .quiz-review-item { display:flex; align-items:center; gap:8px; padding:6px 0; border-bottom:1px solid rgba(255,255,255,.06); font:11px var(--font-body); color:var(--text-dim); }
      .quiz-review-item .quiz-review-icon { font-size:14px; }
      .quiz-review-item a { color:var(--accent-teal); text-decoration:none; }
    `;
    document.head.appendChild(s);
  }

  function ensurePanel() {
    if (panel) return;
    ensureStyles();
    panel = document.createElement("div");
    panel.className = "quiz-panel experience-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="experience-panel__head">
        <div><span>TRIVIA</span><h2>Timeline Quiz</h2></div>
        <button class="quiz-panel__close" aria-label="Close">&times;</button>
      </div>
      <div class="quiz-panel__body"></div>
    `;
    panel.querySelector(".quiz-panel__close").addEventListener("click", () => toggle(false));
    panel.addEventListener("click", (e) => {
      const btn = e.target.closest(".quiz-option");
      if (!btn || btn.disabled) return;
      handleAnswer(btn);
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest(".quiz-start-btn")) startQuiz();
    });
    panel.addEventListener("click", (e) => {
      if (e.target.closest(".quiz-play-again")) startQuiz();
    });
    panel.addEventListener("click", (e) => {
      const link = e.target.closest(".quiz-review-item a");
      if (!link) return;
      e.preventDefault();
      const movieId = link.getAttribute("data-movie-id");
      if (movieId && core() && core().revealTitle) {
        core().revealTitle(movieId);
      }
      if (movieId && core() && core().openDetail) {
        toggle(false);
        window.setTimeout(() => core().openDetail(movieId), 240);
      }
    });
    document.body.appendChild(panel);
    body = panel.querySelector(".quiz-panel__body");
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  function loadBest() {
    try { return Number(localStorage.getItem(STORAGE_KEY) || 0); } catch { return 0; }
  }

  function saveBest(val) {
    try { localStorage.setItem(STORAGE_KEY, String(val)); } catch { /* ignore */ }
  }

  function renderStart() {
    const best = loadBest();
    const bestText = best ? ` · Best: ${best}/${TOTAL}` : "";
    body.innerHTML = `
      <div class="quiz-start">
        <h3 class="quiz-score h3" style="font:36px/1 var(--font-display);margin:0">${QUESTIONS.length}</h3>
        <p>Marvel trivia questions across the entire timeline</p>
        <button class="quiz-start-btn" type="button">START QUIZ</button>
        ${bestText ? `<p>Best score: ${best}/${TOTAL}</p>` : ""}
      </div>
    `;
  }

  function startQuiz() {
    questions = shuffle(QUESTIONS).slice(0, TOTAL);
    currentQ = 0;
    score = 0;
    results = [];
    renderQuestion();
  }

  function renderQuestion() {
    const q = questions[currentQ];
    const pct = Math.round((currentQ / TOTAL) * 100);
    body.innerHTML = `
      <div class="quiz-progress">
        <span>${currentQ + 1}/${TOTAL}</span>
        <div class="quiz-progress__bar"><div class="quiz-progress__fill" style="width:${pct}%"></div></div>
        <span>Score: ${score}</span>
      </div>
      <div class="quiz-question">${escapeHtml(q.q)}<small>Question ${currentQ + 1} of ${TOTAL}</small></div>
      <div class="quiz-options">
        ${q.options.map((opt, i) => `<button class="quiz-option" type="button" data-idx="${i}">${escapeHtml(opt)}</button>`).join("")}
      </div>
    `;
    answered = false;
  }

  function handleAnswer(btn) {
    if (answered) return;
    answered = true;
    const idx = Number(btn.dataset.idx);
    const q = questions[currentQ];
    const correct = idx === q.answer;
    if (correct) score++;

    const buttons = body.querySelectorAll(".quiz-option");
    buttons.forEach((b) => {
      b.disabled = true;
      const bIdx = Number(b.dataset.idx);
      if (bIdx === q.answer) b.classList.add("correct");
      else if (bIdx === idx) b.classList.add("wrong");
    });

    results.push({ q: q.q, options: q.options, answer: q.answer, chosen: idx, movieId: q.movieId, correct });

    window.setTimeout(() => {
      currentQ++;
      if (currentQ >= TOTAL) renderResults();
      else renderQuestion();
    }, 1500);
  }

  function renderResults() {
    const pct = Math.round((score / TOTAL) * 100);
    const best = loadBest();
    if (score > best) saveBest(score);

    body.innerHTML = `
      <div class="quiz-score">
        <h3>${score}/${TOTAL}</h3>
        <p>${pct}% correct${score === TOTAL ? " · Perfect score!" : score >= TOTAL * 0.8 ? " · Amazing!" : score >= TOTAL * 0.5 ? " · Not bad!" : " · Keep studying!"}</p>
        <button class="quiz-play-again" type="button">Play Again</button>
      </div>
      <div class="quiz-review">
        ${results.map((r) => {
          const icon = r.correct ? "✓" : "✗";
          return `<div class="quiz-review-item">
            <span class="quiz-review-icon">${icon}</span>
            <span style="flex:1">${escapeHtml(r.q)}</span>
            <a href="#" data-movie-id="${escapeHtml(r.movieId)}">View title</a>
          </div>`;
        }).join("")}
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function openPanel() {
    isOpen = true;
    ensurePanel();
    panel.hidden = false;
    renderStart();
    requestAnimationFrame(() => panel.classList.add("is-open"));
  }

  function closePanel() {
    isOpen = false;
    panel.classList.remove("is-open");
    window.setTimeout(() => {
      if (!isOpen) panel.hidden = true;
    }, 220);
  }

  function toggle(force) {
    if (typeof force === "boolean" ? force : !isOpen) openPanel();
    else closePanel();
  }

  function bindEscape() {
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) toggle(false);
    }, true);
  }

  function init() {
    bindEscape();
    window.Quiz = { toggle, start: startQuiz };
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
