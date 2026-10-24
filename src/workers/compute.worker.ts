// compute.worker.ts

interface WorkerMessage {
  id: string;
  type: 'score-recommendations' | 'compute-constellation' | 'score-priorities' | 'compute-variants';
  payload: unknown;
}

interface WorkerResponse {
  id: string;
  type: string;
  payload: unknown;
}

interface MovieData {
  id: string;
  title: string;
  type: string;
  line: string;
  phase: string;
  releaseDate: string;
  cast: { name: string; character?: string }[];
}

interface RecommendationInput {
  movies: MovieData[];
  watched: string[];
  priority: string;
}

interface RecommendationOutput {
  recommendations: {
    movieId: string;
    score: number;
    reason: string;
  }[];
}

interface ConstellationInput {
  actorName: string;
  movies: MovieData[];
  watched: string[];
}

interface ConstellationOutput {
  litIds: string[];
  edges: { from: string; to: string }[];
}

interface PriorityInput {
  movies: MovieData[];
  watched: string[];
}

interface PriorityOutput {
  scores: Record<string, { score: number; reason: string }>;
}

interface VariantInput {
  movies: MovieData[];
}

interface VariantOutput {
  groups: { movies: string[]; shared: string[] }[];
  flagged: string[];
}

function respond(id: string, type: string, payload: unknown) {
  (self as unknown as Worker).postMessage({ id, type, payload } satisfies WorkerResponse);
}

function extractPhaseNumber(phase: string): number {
  const match = phase.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function normalizeDate(dateStr: string): number {
  const parsed = new Date(dateStr).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getWatchedMovieSet(watched: string[]): Set<string> {
  return new Set(watched);
}

function getCurrentPhaseFrontier(watchedMovies: MovieData[]): number {
  if (watchedMovies.length === 0) return 1;
  let maxPhase = 1;
  for (const movie of watchedMovies) {
    const phase = extractPhaseNumber(movie.phase);
    if (phase > maxPhase) maxPhase = phase;
  }
  return maxPhase;
}

function getTypeDistribution(watchedMovies: MovieData[]): Record<string, number> {
  const dist: Record<string, number> = {};
  for (const movie of watchedMovies) {
    dist[movie.type] = (dist[movie.type] || 0) + 1;
  }
  return dist;
}

function getDominantType(dist: Record<string, number>): string {
  let best = '';
  let max = 0;
  for (const [type, count] of Object.entries(dist)) {
    if (count > max) {
      max = count;
      best = type;
    }
  }
  return best;
}

function handleScoreRecommendations(id: string, input: RecommendationInput) {
  const { movies, watched, priority } = input;
  const watchedSet = getWatchedMovieSet(watched);
  const unwatched = movies.filter((m) => !watchedSet.has(m.id));

  if (unwatched.length === 0) {
    respond(id, 'score-recommendations', { recommendations: [] } satisfies RecommendationOutput);
    return;
  }

  const watchedMovies = movies.filter((m) => watchedSet.has(m.id));
  const phaseFrontier = getCurrentPhaseFrontier(watchedMovies);
  const typeDist = getTypeDistribution(watchedMovies);
  const dominantType = getDominantType(typeDist);

  const watchedCast = new Set<string>();
  for (const movie of watchedMovies) {
    for (const member of movie.cast) {
      watchedCast.add(member.name.toLowerCase());
    }
  }

  const maxDate = normalizeDate('2030-01-01');
  const minDate = normalizeDate('2008-01-01');

  const recommendations: RecommendationOutput['recommendations'] = [];

  for (const movie of unwatched) {
    const moviePhase = extractPhaseNumber(movie.phase);
    const priorityPath = priority.toLowerCase();

    const inPriorityPath =
      movie.line.toLowerCase().includes(priorityPath) ||
      movie.type.toLowerCase().includes(priorityPath) ||
      movie.phase.toLowerCase().includes(priorityPath);

    const pathwayScore = inPriorityPath ? 1.0 : 0.0;

    const phaseDiff = Math.max(0, moviePhase - phaseFrontier);
    const phaseProximityScore = phaseDiff <= 1 ? 1.0 : phaseDiff <= 2 ? 0.6 : phaseDiff <= 3 ? 0.3 : 0.1;

    let castOverlap = 0;
    for (const member of movie.cast) {
      if (watchedCast.has(member.name.toLowerCase())) {
        castOverlap++;
      }
    }
    const castScore = movie.cast.length > 0 ? Math.min(castOverlap / movie.cast.length, 1) : 0;

    const movieDate = normalizeDate(movie.releaseDate);
    const recencyScore = maxDate === minDate ? 0.5 : (movieDate - minDate) / (maxDate - minDate);

    const typeScore = movie.type.toLowerCase() === dominantType.toLowerCase() ? 1.0 : 0.5;

    const totalScore =
      pathwayScore * 0.4 +
      phaseProximityScore * 0.2 +
      castScore * 0.2 +
      recencyScore * 0.1 +
      typeScore * 0.1;

    const reasons: string[] = [];
    if (inPriorityPath) reasons.push(`matches ${priority} pathway`);
    if (phaseDiff <= 1) reasons.push('next in phase order');
    if (castOverlap > 0) reasons.push(`${castOverlap} cast connection${castOverlap > 1 ? 's' : ''}`);
    if (recencyScore > 0.8) reasons.push('recent release');
    if (movie.type.toLowerCase() === dominantType.toLowerCase()) reasons.push('preferred type');

    recommendations.push({
      movieId: movie.id,
      score: Math.round(totalScore * 1000) / 1000,
      reason: reasons.length > 0 ? reasons.join('; ') : 'general recommendation',
    });
  }

  recommendations.sort((a, b) => b.score - a.score);

  respond(id, 'score-recommendations', { recommendations } satisfies RecommendationOutput);
}

function handleConstellation(id: string, input: ConstellationInput) {
  const { actorName, movies, watched } = input;
  const watchedSet = getWatchedMovieSet(watched);
  const query = actorName.toLowerCase();

  const actorMovies = movies.filter((m) =>
    m.cast.some((c) => c.name.toLowerCase() === query),
  );

  const litIds = actorMovies.map((m) => m.id);

  const edges: ConstellationOutput['edges'] = [];
  const actorMovieIds = new Set(litIds);

  for (let i = 0; i < actorMovies.length; i++) {
    for (let j = i + 1; j < actorMovies.length; j++) {
      const a = actorMovies[i];
      const b = actorMovies[j];

      const sharedCast = a.cast.some(
        (ca) =>
          ca.name.toLowerCase() !== query &&
          b.cast.some((cb) => cb.name.toLowerCase() === ca.name.toLowerCase()),
      );

      if (a.line === b.line || a.phase === b.phase || sharedCast) {
        edges.push({ from: a.id, to: b.id });
      }
    }
  }

  for (const movie of actorMovies) {
    if (!watchedSet.has(movie.id)) {
      continue;
    }
    for (const other of movies) {
      if (actorMovieIds.has(other.id) || other.id === movie.id) continue;
      const sharedWithActor = movie.cast.some(
        (cm) => cm.name.toLowerCase() === query,
      );
      if (!sharedWithActor) continue;

      const sharedCast = movie.cast.some(
        (cm) =>
          cm.name.toLowerCase() !== query &&
          other.cast.some((co) => co.name.toLowerCase() === cm.name.toLowerCase()),
      );

      if (sharedCast) {
        edges.push({ from: movie.id, to: other.id });
        if (!actorMovieIds.has(other.id)) {
          litIds.push(other.id);
        }
      }
    }
  }

  respond(id, 'compute-constellation', { litIds, edges } satisfies ConstellationOutput);
}

function handlePriorityBatch(id: string, input: PriorityInput) {
  const { movies, watched } = input;
  const watchedSet = getWatchedMovieSet(watched);
  const watchedMovies = movies.filter((m) => watchedSet.has(m.id));
  const phaseFrontier = getCurrentPhaseFrontier(watchedMovies);
  const typeDist = getTypeDistribution(watchedMovies);
  const dominantType = getDominantType(typeDist);

  const scores: PriorityOutput['scores'] = {};

  for (const movie of movies) {
    if (watchedSet.has(movie.id)) {
      scores[movie.id] = { score: 0, reason: 'already watched' };
      continue;
    }

    const moviePhase = extractPhaseNumber(movie.phase);
    const phaseScore = moviePhase <= phaseFrontier + 1 ? 1.0 : moviePhase <= phaseFrontier + 2 ? 0.7 : 0.4;

    const typeScore = movie.type.toLowerCase() === dominantType.toLowerCase() ? 1.0 : 0.5;

    const totalScore = phaseScore * 0.6 + typeScore * 0.4;

    const reasons: string[] = [];
    if (moviePhase <= phaseFrontier + 1) reasons.push('in progression');
    else reasons.push('future phase');
    if (movie.type.toLowerCase() === dominantType.toLowerCase()) reasons.push('matching type');
    else reasons.push('different type');

    scores[movie.id] = {
      score: Math.round(totalScore * 1000) / 1000,
      reason: reasons.join('; '),
    };
  }

  respond(id, 'score-priorities', { scores } satisfies PriorityOutput);
}

function handleVariants(id: string, input: VariantInput) {
  const { movies } = input;

  const castToMovies = new Map<string, string[]>();
  for (const movie of movies) {
    for (const member of movie.cast) {
      const key = member.name.toLowerCase();
      const list = castToMovies.get(key) || [];
      list.push(movie.id);
      castToMovies.set(key, list);
    }
  }

  const groups: VariantOutput['groups'] = [];
  const processed = new Set<string>();
  const flagged: string[] = [];

  for (const [castMember, movieIds] of castToMovies) {
    const uniqueIds = [...new Set(movieIds)];
    if (uniqueIds.length < 2) continue;

    const groupKey = uniqueIds.sort().join('|');
    if (processed.has(groupKey)) continue;
    processed.add(groupKey);

    const shared = [castMember];
    for (const otherCast of castToMovies.keys()) {
      if (otherCast === castMember) continue;
      const otherMovies = new Set(castToMovies.get(otherCast));
      if (uniqueIds.every((id) => otherMovies.has(id))) {
        shared.push(otherCast);
      }
    }

    groups.push({ movies: uniqueIds, shared });
    if (uniqueIds.length >= 3) {
      flagged.push(castMember);
    }
  }

  respond(id, 'compute-variants', { groups, flagged } satisfies VariantOutput);
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = e.data;

  switch (type) {
    case 'score-recommendations':
      handleScoreRecommendations(id, payload as RecommendationInput);
      break;
    case 'compute-constellation':
      handleConstellation(id, payload as ConstellationInput);
      break;
    case 'score-priorities':
      handlePriorityBatch(id, payload as PriorityInput);
      break;
    case 'compute-variants':
      handleVariants(id, payload as VariantInput);
      break;
  }
};
