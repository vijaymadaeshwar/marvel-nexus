(function exposeTimelineUtils(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.MCUUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createTimelineUtils() {
  function yearFraction(dateStr) {
    if (!dateStr) return null;
    const date = new Date(`${dateStr}T00:00:00`);
    const year = date.getFullYear();
    const start = new Date(year, 0, 1).getTime();
    const end = new Date(year + 1, 0, 1).getTime();
    return year + (date.getTime() - start) / (end - start);
  }

  function movieYearValue(movie, mode) {
    if (mode === "story" && typeof movie.inUniverseYear === "number") {
      return Number.isInteger(movie.inUniverseYear)
        ? movie.inUniverseYear + 0.5
        : movie.inUniverseYear;
    }
    return yearFraction(movie.releaseDate);
  }

  function routeMatches(movie, route) {
    if (!route) return true;
    const timelineLines = {
      "marvel-television": "marvelTv",
      "marvel-on-disney-plus": "disneyPlus",
    };
    if (timelineLines[route]) return movie.line === timelineLines[route];

    const text = `${movie.id} ${movie.title} ${movie.synopsis || ""}`.toLowerCase();
    const terms = {
      "spider-man": ["spider-man", "spider man", "peter parker", "miles morales"],
      wolverine: ["wolverine", "logan"],
      deadpool: ["deadpool", "wade wilson"],
      avengers: ["avengers", "infinity war", "endgame", "doomsday", "secret wars"],
    };
    return (terms[route] || [route]).some((term) => text.includes(term));
  }

  function formatMoney(value) {
    if (!Number.isFinite(value) || value <= 0) return "NA";
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(value >= 10_000_000_000 ? 1 : 2).replace(/\.?0+$/, "")}B`;
    }
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(value >= 100_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  return { yearFraction, movieYearValue, routeMatches, formatMoney };
});
