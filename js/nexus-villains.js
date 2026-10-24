(() => {
  "use strict";

  const core = () => window.NexusCore;
  const THUMB = "https://image.tmdb.org/t/p/w185";
  const SERIES_SUFFIX = / — Season \d+$/;

  const PHASE_BIG_BADS = [
    { phase: "Phase One", villain: "Loki", actor: "Tom Hiddleston", movieId: "thor", color: "#3ddc84", blurb: "The God of Mischief pulled the strings from Thor to the Battle of New York — charming, wounded, and always two steps ahead.", saga: ["thor", "the-avengers", "series-loki-season-1"] },
    { phase: "Phase Two", villain: "Ultron", actor: "James Spader", movieId: "avengers-age-of-ultron", color: "#ff5da2", blurb: "A rogue AI forged from Tony Stark's armor, Ultron decided that peace meant extinction — and built himself a family to do it.", saga: ["avengers-age-of-ultron", "series-what-if-season-1"] },
    { phase: "Phase Three", villain: "Thanos", actor: "Josh Brolin", movieId: "avengers-infinity-war", color: "#ffb454", blurb: "The Mad Titan gathered the Infinity Stones and erased half of all life. It took two Avengers films — and a snap of their own — to undo him.", saga: ["avengers-infinity-war", "avengers-endgame"] },
    { phase: "Phase Four", villain: "Kang the Conqueror", actor: "Jonathan Majors", movieId: "ant-man-and-the-wasp-quantumania", color: "#22d3ee", blurb: "Seeded in the season finale of Loki, the time-travelling conqueror finally stepped out of the Quantum Realm.", saga: ["series-loki-season-1", "ant-man-and-the-wasp-quantumania", "series-loki-season-2"] },
    { phase: "Phase Five", villain: "The Council of Kangs", actor: "Jonathan Majors", movieId: "ant-man-and-the-wasp-quantumania", color: "#7dd3a8", blurb: "Kang is not one man — he is a dynasty. Variant upon variant, the Council rules the timelines from beyond.", saga: ["series-loki-season-1", "ant-man-and-the-wasp-quantumania", "series-loki-season-2"] },
    { phase: "Phase Six", villain: "Doctor Doom", actor: "Robert Downey Jr.", movieId: "avengers-doomsday", color: "#ffd166", blurb: "Victor Von Doom reshapes the multiverse to save his own — and the saga's face is unmistakably familiar.", saga: ["the-fantastic-four-first-steps", "avengers-doomsday", "avengers-secret-wars"] },
  ];

  const TITLE_VILLAINS = {
    "blade-1998": { name: "Deacon Frost", role: "The vampire purity cultist", actor: "Stephen Dorff" },
    "x-men": { name: "Magneto", role: "Master of magnetism", actor: "Ian McKellen" },
    "blade-ii": { name: "Jared Nomak", role: "The Reaper", actor: "Luke Goss" },
    "spider-man-2002": { name: "Norman Osborn", role: "Green Goblin", actor: "Willem Dafoe" },
    "daredevil-2003": { name: "Wilson Fisk", role: "The Kingpin", actor: "Michael Clarke Duncan" },
    "x2-x-men-united": { name: "William Stryker", role: "The mutant hunter", actor: "Brian Cox" },
    "hulk-2003": { name: "David Banner", role: "The Absorbing Man", actor: "Nick Nolte" },
    "punisher-2004": { name: "Howard Saint", role: "The crime lord", actor: "John Travolta" },
    "spider-man-2": { name: "Otto Octavius", role: "Doctor Octopus", actor: "Alfred Molina" },
    "blade-trinity": { name: "Dracula", role: "The origin of the bloodline", actor: "Dominic Purcell" },
    "elektra-2005": { name: "Kirigi", role: "The Hand's assassin", actor: "Will Yun Lee" },
    "fantastic-four-2005": { name: "Victor Von Doom", role: "Doctor Doom", actor: "Julian McMahon" },
    "x-men-the-last-stand": { name: "Jean Grey", role: "The Dark Phoenix", actor: "Famke Janssen" },
    "ghost-rider-2007": { name: "Blackheart", role: "Son of Mephisto", actor: "Wes Bentley" },
    "spider-man-3": { name: "Eddie Brock", role: "Venom", actor: "Topher Grace" },
    "fantastic-four-rise-of-the-silver-surfer": { name: "Victor Von Doom", role: "Doctor Doom", actor: "Julian McMahon" },
    "iron-man": { name: "Obadiah Stane", role: "Iron Monger", actor: "Jeff Bridges" },
    "the-incredible-hulk": { name: "Emil Blonsky", role: "Abomination", actor: "Tim Roth" },
    "x-men-origins-wolverine": { name: "William Stryker", role: "The Weapon X program", actor: "Danny Huston" },
    "iron-man-2": { name: "Ivan Vanko", role: "Whiplash", actor: "Mickey Rourke" },
    "thor": { name: "Loki", role: "God of Mischief", actor: "Tom Hiddleston" },
    "x-men-first-class": { name: "Sebastian Shaw", role: "The Hellfire Club", actor: "Kevin Bacon" },
    "captain-america-the-first-avenger": { name: "Red Skull", role: "Hydra's founder", actor: "Hugo Weaving" },
    "ghost-rider-spirit-of-vengeance": { name: "Mephisto", role: "The dealmaker", actor: "Ciarán Hinds" },
    "the-avengers": { name: "Loki", role: "Chitauri invasion", actor: "Tom Hiddleston" },
    "the-amazing-spider-man": { name: "Curt Connors", role: "The Lizard", actor: "Rhys Ifans" },
    "iron-man-3": { name: "Aldrich Killian", role: "The Mandarin", actor: "Guy Pearce" },
    "the-wolverine": { name: "Yashida", role: "The Silver Samurai", actor: "Hal Yamanouchi" },
    "series-agents-of-s-h-i-e-l-d-season-1": { name: "John Garrett", role: "HYDRA's eyes on the team", actor: "Bill Paxton" },
    "thor-the-dark-world": { name: "Malekith", role: "The Accursed", actor: "Christopher Eccleston" },
    "captain-america-the-winter-soldier": { name: "Alexander Pierce", role: "HYDRA inside SHIELD", actor: "Robert Redford" },
    "the-amazing-spider-man-2": { name: "Max Dillon", role: "Electro", actor: "Jamie Foxx" },
    "x-men-days-of-future-past": { name: "Bolivar Trask", role: "The Sentinel program", actor: "Peter Dinklage" },
    "guardians-of-the-galaxy": { name: "Ronan", role: "The Accuser", actor: "Lee Pace" },
    "series-agents-of-s-h-i-e-l-d-season-2": { name: "Jiaying", role: "The Inhuman elder", actor: "Dichen Lachman" },
    "series-agent-carter-season-1": { name: "Dottie Underwood", role: "The Black Widow", actor: "Bridget Regan" },
    "series-daredevil-season-1": { name: "Wilson Fisk", role: "The Kingpin", actor: "Vincent D'Onofrio" },
    "avengers-age-of-ultron": { name: "Ultron", role: "Sentient peace program", actor: "James Spader" },
    "ant-man": { name: "Darren Cross", role: "Yellowjacket", actor: "Corey Stoll" },
    "fantastic-four-2015": { name: "Victor Von Doom", role: "Doctor Doom", actor: "Toby Kebbell" },
    "series-agents-of-s-h-i-e-l-d-season-3": { name: "Hive", role: "The Inhuman parasite", actor: "Brett Dalton" },
    "series-jessica-jones-season-1": { name: "Kilgrave", role: "The mind controller", actor: "David Tennant" },
    "series-agent-carter-season-2": { name: "Whitney Frost", role: "The Zero Matter host", actor: "Wynn Everett" },
    "deadpool-2016": { name: "Francis", role: "Ajax", actor: "Ed Skrein" },
    "series-daredevil-season-2": { name: "The Punisher", role: "Hell's Kitchen's judge", actor: "Jon Bernthal" },
    "captain-america-civil-war": { name: "Helmut Zemo", role: "The Sokovia Accords saboteur", actor: "Daniel Brühl" },
    "x-men-apocalypse": { name: "En Sabah Nur", role: "Apocalypse", actor: "Oscar Isaac" },
    "series-agents-of-s-h-i-e-l-d-season-4": { name: "Aida", role: "The Life-Model Decoy", actor: "Mallory Jansen" },
    "series-luke-cage-season-1": { name: "Cornell Stokes", role: "Cottonmouth", actor: "Mahershala Ali" },
    "doctor-strange": { name: "Kaecilius", role: "Servant of Dormammu", actor: "Mads Mikkelsen" },
    "logan": { name: "Donald Pierce", role: "The Reavers' handler", actor: "Boyd Holbrook" },
    "series-iron-fist-season-1": { name: "Harold Meachum", role: "The manipulator", actor: "David Wenham" },
    "guardians-of-the-galaxy-vol-2": { name: "Ego", role: "A living planet", actor: "Kurt Russell" },
    "spider-man-homecoming": { name: "Adrian Toomes", role: "Vulture", actor: "Michael Keaton" },
    "series-the-defenders-season-1": { name: "Alexandra", role: "The Hand's elder", actor: "Sigourney Weaver" },
    "series-inhumans-season-1": { name: "Maximus", role: "The usurper of Attilan", actor: "Iwan Rheon" },
    "thor-ragnarok": { name: "Hela", role: "Goddess of Death", actor: "Cate Blanchett" },
    "series-the-punisher-season-1": { name: "William Rawlins", role: "Agent Orange", actor: "Paul Schulze" },
    "series-runaways-season-1": { name: "Jonah", role: "The Pride's benefactor", actor: "Julian McMahon" },
    "series-agents-of-s-h-i-e-l-d-season-5": { name: "Kasius", role: "The Kree warlord", actor: "Dominic Rains" },
    "black-panther": { name: "Erik Killmonger", role: "Challenger for the throne", actor: "Michael B. Jordan" },
    "series-jessica-jones-season-2": { name: "Alisa Jones", role: "The unhinged mother", actor: "Janet McTeer" },
    "avengers-infinity-war": { name: "Thanos", role: "The Mad Titan", actor: "Josh Brolin" },
    "deadpool-2": { name: "Nathan Summers", role: "Cable", actor: "Josh Brolin" },
    "series-cloak-and-dagger-season-1": { name: "Andre Deschaine", role: "Roxxon's fixer", actor: "Lane Garrison" },
    "series-luke-cage-season-2": { name: "Mariah Dillard", role: "Black Mariah", actor: "Alfre Woodard" },
    "ant-man-and-the-wasp": { name: "Ava Starr", role: "Ghost", actor: "Hannah John-Kamen" },
    "series-iron-fist-season-2": { name: "Davos", role: "The Steel Serpent", actor: "Sacha Dhawan" },
    "venom": { name: "Riot", role: "The symbiote conqueror", actor: "Riz Ahmed" },
    "series-daredevil-season-3": { name: "Wilson Fisk", role: "The Kingpin unchained", actor: "Vincent D'Onofrio" },
    "spider-man-into-the-spider-verse": { name: "Wilson Fisk", role: "The Kingpin", actor: "Liev Schreiber" },
    "series-runaways-season-2": { name: "Morgan le Fay", role: "The dark dimension sorceress", actor: "Elizabeth Hurley" },
    "series-the-punisher-season-2": { name: "John Pilgrim", role: "The zealot", actor: "Josh Stewart" },
    "captain-marvel": { name: "Yon-Rogg", role: "Starforce commander", actor: "Jude Law" },
    "series-cloak-and-dagger-season-2": { name: "Mayhem", role: "Brigid's vengeful alter", actor: "Emma Lahana" },
    "avengers-endgame": { name: "Thanos", role: "The Mad Titan (2014)", actor: "Josh Brolin" },
    "series-agents-of-s-h-i-e-l-d-season-6": { name: "Izel", role: "The shrike queen", actor: "Clark Gregg" },
    "dark-phoenix": { name: "Jean Grey", role: "The Dark Phoenix", actor: "Sophie Turner" },
    "series-jessica-jones-season-3": { name: "Gregory Salinger", role: "The human hunter", actor: "Jeremy Bobb" },
    "spider-man-far-from-home": { name: "Quentin Beck", role: "Mysterio", actor: "Jake Gyllenhaal" },
    "series-runaways-season-3": { name: "Morgan le Fay", role: "The dark dimension sorceress", actor: "Elizabeth Hurley" },
    "series-agents-of-s-h-i-e-l-d-season-7": { name: "Nathaniel Malick", role: "The HYDRA prodigy", actor: "Thomas E. Sullivan" },
    "the-new-mutants": { name: "The Demon Bear", role: "Manifestation of trauma", actor: "" },
    "series-helstrom-season-1": { name: "Kthara", role: "The Mother of demons", actor: "" },
    "series-wandavision-season-1": { name: "Agatha Harkness", role: "The nosy neighbour", actor: "Kathryn Hahn" },
    "series-the-falcon-and-the-winter-soldier-season-1": { name: "Karli Morgenthau", role: "The Flag Smashers", actor: "Erin Kellyman" },
    "series-loki-season-1": { name: "He Who Remains", role: "The master of the Citadel", actor: "Jonathan Majors" },
    "black-widow": { name: "Dreykov", role: "Taskmaster's master", actor: "Ray Winstone" },
    "series-what-if-season-1": { name: "Ultron", role: "The multiversal conqueror", actor: "Ross Marquand" },
    "shang-chi-and-the-legend-of-the-ten-rings": { name: "Wenwu", role: "The Mandarin", actor: "Tony Leung" },
    "venom-let-there-be-carnage": { name: "Cletus Kasady", role: "Carnage", actor: "Woody Harrelson" },
    "eternals": { name: "Ikaris", role: "The rogue Eternal", actor: "Richard Madden" },
    "series-hawkeye-season-1": { name: "Eleanor Bishop", role: "The Bishop masquerade", actor: "Vera Farmiga" },
    "spider-man-no-way-home": { name: "Norman Osborn", role: "Green Goblin", actor: "Willem Dafoe" },
    "series-moon-knight-season-1": { name: "Arthur Harrow", role: "Servant of Ammit", actor: "Ethan Hawke" },
    "morbius": { name: "Milo", role: "The second living vampire", actor: "Matt Smith" },
    "doctor-strange-in-the-multiverse-of-madness": { name: "Wanda Maximoff", role: "Scarlet Witch", actor: "Elizabeth Olsen" },
    "series-ms-marvel-season-1": { name: "Najma", role: "The Clandestine leader", actor: "Nimra Bucha" },
    "thor-love-and-thunder": { name: "Gorr", role: "The God Butcher", actor: "Christian Bale" },
    "series-i-am-groot-season-1": { name: "The Void Creature", role: "Intergalactic mischief", actor: "" },
    "series-she-hulk-attorney-at-law-season-1": { name: "Todd Phelps", role: "HulkKing", actor: "Jon Bass" },
    "black-panther-wakanda-forever": { name: "Namor", role: "Kukulkan of Talokan", actor: "Tenoch Huerta" },
    "ant-man-and-the-wasp-quantumania": { name: "Kang", role: "The Conqueror", actor: "Jonathan Majors" },
    "guardians-of-the-galaxy-vol-3": { name: "High Evolutionary", role: "The perfecter of species", actor: "Chiwetel Ejiofor" },
    "spider-man-across-the-spider-verse": { name: "Miguel O'Hara", role: "Spider-Man 2099", actor: "Oscar Isaac" },
    "series-secret-invasion-season-1": { name: "Gravik", role: "The Skrull radical", actor: "Kingsley Ben-Adir" },
    "series-i-am-groot-season-2": { name: "The Void Creature", role: "Intergalactic mischief", actor: "" },
    "series-loki-season-2": { name: "Victor Timely", role: "A Kang variant", actor: "Jonathan Majors" },
    "the-marvels": { name: "Dar-Benn", role: "Kree warrior", actor: "Zawe Ashton" },
    "series-what-if-season-2": { name: "Strange Supreme", role: "The sorcerer gone dark", actor: "Benedict Cumberbatch" },
    "series-echo-season-1": { name: "Wilson Fisk", role: "The Kingpin", actor: "Vincent D'Onofrio" },
    "madame-web": { name: "Ezekiel Sims", role: "The hunter of futures", actor: "Tahar Rahim" },
    "series-x-men-97-season-1": { name: "Bastion", role: "The Prime Sentinel", actor: "Theodore Whitmore" },
    "deadpool-and-wolverine": { name: "Cassandra Nova", role: "Warden of the Void", actor: "Emma Corrin" },
    "series-agatha-all-along-season-1": { name: "Rio Vidal", role: "Death herself", actor: "Aubrey Plaza" },
    "venom-the-last-dance": { name: "Knull", role: "The King in Black", actor: "" },
    "kraven-the-hunter": { name: "Nikolai Kravinoff", role: "The hunter's father", actor: "Russell Crowe" },
    "series-what-if-season-3": { name: "The Eminence", role: "The Watcher's elder", actor: "" },
    "series-your-friendly-neighborhood-spider-man-season-1": { name: "Otto Octavius", role: "The mentor turned foe", actor: "Hugh Dancy" },
    "captain-america-brave-new-world": { name: "Red Hulk", role: "Thaddeus Ross transformed", actor: "Harrison Ford" },
    "series-daredevil-born-again-season-1": { name: "Wilson Fisk", role: "The Mayor of New York", actor: "Vincent D'Onofrio" },
    "thunderbolts": { name: "Void", role: "The Sentry's dark half", actor: "Lewis Pullman" },
    "series-ironheart-season-1": { name: "Parker Robbins", role: "The Hood", actor: "Anthony Ramos" },
    "the-fantastic-four-first-steps": { name: "Galactus", role: "The Devourer of Worlds", actor: "Ralph Ineson" },
    "series-eyes-of-wakanda-season-1": { name: "Ulysses Klaue", role: "Wakanda's nemesis", actor: "Andy Serkis" },
    "series-marvel-zombies-season-1": { name: "The Zombified", role: "The infected multiverse", actor: "" },
    "series-wonder-man-season-1": { name: "Grim Reaper", role: "Simon's shadow", actor: "" },
    "series-daredevil-born-again-season-2": { name: "Muse", role: "The artist of corpses", actor: "Hunter Emery" },
    "series-x-men-97-season-2": { name: "Apocalypse", role: "The First Mutant", actor: "" },
    "spider-man-brand-new-day": { name: "Jean Grey", role: "The telepathic phantom", actor: "Sadie Sink" },
    "avengers-doomsday": { name: "Doctor Doom", role: "Sorcerer Supreme of Battleworld", actor: "Robert Downey Jr." },
    "spider-man-beyond-the-spider-verse": { name: "The Spot", role: "The reality warper", actor: "Jason Schwartzman" },
    "avengers-secret-wars": { name: "Doctor Doom", role: "God Emperor of Battleworld", actor: "Robert Downey Jr." },
    "blade-mcu": { name: "TBA", role: "Shelved", actor: "" },
    "series-marvel-zombies-season-2": { name: "The Zombified", role: "The endless hunger", actor: "" },
    "series-wonder-man-season-2": { name: "TBA", role: "Awaiting announcement", actor: "" },
  };

  let panel;
  let closeBtn;
  let launchBtn;
  let bigbads;
  let list;
  let searchInput;
  let resultCount;
  let query = "";
  let open = false;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function shortTitle(title) {
    return String(title).replace(SERIES_SUFFIX, "");
  }

  function movie(id) {
    return core() && core().movieById ? core().movieById(id) : null;
  }

  function poster(m, color) {
    if (m && m.poster) return `<img src="${THUMB}${encodeURI(m.poster)}" alt="${escapeAttr(m.title)}" loading="lazy" decoding="async">`;
    return `<span class="villain-card__monogram" style="--v-color:${color}">${m ? m.title.charAt(0) : "?"}</span>`;
  }

  function bigBadCards() {
    return PHASE_BIG_BADS.map((bb) => {
      const m = movie(bb.movieId);
      const sagaCount = (bb.saga || []).length;
      return `<article class="villain-card" style="--v-color:${bb.color}">
        <span class="villain-card__poster">${poster(m, bb.color)}</span>
        <div class="villain-card__copy">
          <span class="villain-card__phase">${escapeHtml(bb.phase)}${sagaCount ? ` · ${sagaCount}-title saga` : ""}</span>
          <strong>${escapeHtml(bb.villain)}</strong>
          <em>${escapeHtml(bb.actor)}</em>
          <p>${escapeHtml(bb.blurb)}</p>
          <button type="button" class="villain-card__open" data-movie-id="${escapeHtml(bb.movieId)}">See their saga →</button>
        </div>
      </article>`;
    }).join("");
  }

  function titleRow(movieId) {
    const v = TITLE_VILLAINS[movieId];
    const m = movie(movieId);
    if (!m || !v) return "";
    const line = core().lineById ? core().lineById(m.line) : null;
    const color = line ? line.color : "#3ddc84";
    const year = m.releaseDate ? m.releaseDate.slice(0, 4) : "";
    return `<li class="villain-title" style="--v-color:${color}">
      <button type="button" class="villain-title__open" data-movie-id="${escapeHtml(movieId)}">
        <span class="villain-title__poster">${poster(m, color)}</span>
        <span class="villain-title__names"><strong>${escapeHtml(shortTitle(m.title))}</strong><em>${year ? year + " · " : ""}${escapeHtml(v.role)}</em></span>
      </button>
      <span class="villain-title__bad" title="${escapeHtml(v.name + " — " + v.role)}">${escapeHtml(v.name)}${v.actor ? `<small>${escapeHtml(v.actor)}</small>` : ""}</span>
    </li>`;
  }

  function matches(movieId) {
    if (!query) return true;
    const v = TITLE_VILLAINS[movieId];
    const m = movie(movieId);
    if (!m || !v) return false;
    return [m.title, v.name, v.role, v.actor].join(" ").toLowerCase().includes(query);
  }

  function renderTitleList() {
    const ids = Object.keys(TITLE_VILLAINS)
      .filter(matches)
      .sort((a, b) => {
        const ma = movie(a);
        const mb = movie(b);
        return String(ma && ma.releaseDate).localeCompare(String(mb && mb.releaseDate));
      });
    resultCount.textContent = ids.length + " of " + Object.keys(TITLE_VILLAINS).length + " titles";
    list.innerHTML = `<ul class="villains-titles">${ids.map(titleRow).join("") || '<li class="villain-empty"><strong>No matches.</strong><span>Try a villain, hero, or title.</span></li>'}</ul>`;
  }

  function openPanel() {
    open = true;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add("is-open"));
    launchBtn.setAttribute("aria-pressed", "true");
    renderTitleList();
    if (searchInput) window.setTimeout(() => searchInput.focus(), 120);
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
    panel.addEventListener("click", (event) => {
      const openBtn = event.target.closest("[data-movie-id]");
      if (!openBtn) return;
      const id = openBtn.dataset.movieId;
      closePanel();
      window.setTimeout(() => {
        if (core() && core().revealTitle) core().revealTitle(id);
        if (core() && core().openDetail) core().openDetail(id);
      }, 240);
    });
    searchInput.addEventListener("input", () => {
      query = searchInput.value.trim().toLowerCase();
      renderTitleList();
    });
    if (bigbads) {
      bigbads.addEventListener("wheel", (event) => {
        if (!bigbads.scrollWidth || bigbads.scrollWidth <= bigbads.clientWidth) return;
        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
        event.preventDefault();
        bigbads.scrollLeft += event.deltaY;
      }, { passive: false });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && open) closePanel();
    }, true);
  }

  function init() {
    panel = document.getElementById("villains-panel");
    if (!panel) return;
    closeBtn = document.getElementById("villains-panel-close");
    launchBtn = document.getElementById("villains-btn");
    bigbads = document.getElementById("villains-bigbads");
    list = document.getElementById("villains-list");
    searchInput = document.getElementById("villains-search");
    resultCount = document.getElementById("villains-count");
    if (!launchBtn || !bigbads || !list || !closeBtn) return;
    bind();
    bigbads.innerHTML = bigBadCards();
    window.NexusVillains = { open: openPanel, close: closePanel, toggle, count: () => Object.keys(TITLE_VILLAINS).length };
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
