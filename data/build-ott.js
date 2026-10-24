#!/usr/bin/env node
// Build helper: manages the `ott` (where-to-watch platform slugs) field on
// every title, and strips any legacy `trailer` field, then regenerates both
// data/movies.json and data/movies.inline.js.
//
// Usage:  node data/build-ott.js

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname);
const JSON_FILE = path.join(DATA_DIR, "movies.json");
const INLINE_FILE = path.join(DATA_DIR, "movies.inline.js");

// ---------------------------------------------------------------------------
// OTT rules (best-available mix, no region filter):
//  - Disney-owned (MCU, Fox, Marvel Television, Disney+ series)  -> Disney+
//  - Sony titles (Spider-Man, Spider-Verse, SSU)                 -> Disney+ + buy/rent
//  - Titles not on Disney+ (Universal/Lionsgate-era)             -> buy/rent
// ---------------------------------------------------------------------------
const DISNEY = ["disneyplus"];
const SONY = ["disneyplus", "netflix", "primevideo", "appletv", "youtube"];
const RENT = ["primevideo", "appletv", "youtube"];
const SONYLINES = new Set(["spiderSony", "spiderVerse", "sonyVillains"]);
const RENT_ONLY = new Set([
  "punisher-2004",
  "hulk-2003",
  "ghost-rider-2007",
  "ghost-rider-spirit-of-vengeance"
]);
const SKIP_OTT = new Set(["blade-mcu"]); // shelved, no release to watch

function ottFor(movie) {
  if (SKIP_OTT.has(movie.id)) return undefined;
  if (RENT_ONLY.has(movie.id)) return RENT;
  if (SONYLINES.has(movie.line)) return SONY;
  return DISNEY;
}

// ---------------------------------------------------------------------------
async function main() {
  const data = JSON.parse(fs.readFileSync(JSON_FILE, "utf8"));
  const movies = data.movies;

  for (const movie of movies) {
    delete movie.trailer;

    const ott = ottFor(movie);
    if (ott) movie.ott = ott;
    else delete movie.ott;
  }

  const json = JSON.stringify(data, null, 2);
  fs.writeFileSync(JSON_FILE, json + "\n", "utf8");
  fs.writeFileSync(INLINE_FILE, `window.MOVIES_INLINE = ${json}\n;`, "utf8");

  const ottCount = movies.filter((m) => Array.isArray(m.ott)).length;
  const trailerCount = movies.filter((m) => m.trailer).length;
  console.log("=== build-ott complete ===");
  console.log(`  titles with ott    : ${ottCount} / ${movies.length}`);
  console.log(`  trailers remaining : ${trailerCount} (expect 0)`);
  console.log(`  wrote movies.json + movies.inline.js`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
