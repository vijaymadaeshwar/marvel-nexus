/* eslint-disable @typescript-eslint/no-explicit-any */

// =============================================================================
// Marvel Nexus — Comprehensive Type Definitions
// Covers all data structures across the entire application
// =============================================================================

// =============================================================================
// Core Data Types
// =============================================================================

/** Distinguishes between theatrical films and streaming/TV series */
export type MovieType = 'movie' | 'series';

/** The franchise line / universe a title belongs to */
export type MovieLine =
  | 'mcu'
  | 'spider-man'
  | 'xmen'
  | 'fantastic-four'
  | 'blade'
  | 'other'
  | 'sony-spider-man'
  | 'fox-x-men'
  | 'deadpool'
  | 'venom';

/** Viewing priority recommendation level */
export type Priority = '' | 'recommended' | 'essential';

/** The user's relationship with a title in their journey tracker */
export type JourneyStatus = 'watched' | 'watching' | 'planned';

/** How the movie grid / timeline is sorted */
export type SortMode = 'story' | 'release';

/** A single Marvel movie or series entry */
export interface Movie {
  /** Unique identifier (e.g. slug or TMDB ID) */
  id: string;
  /** Display title */
  title: string;
  /** Whether this is a movie or series */
  type: MovieType;
  /** Which franchise line this belongs to */
  line: MovieLine;
  /** MCU phase or equivalent grouping string */
  phase: string;
  /** ISO date string of theatrical / premiere release */
  releaseDate: string;
  /** Year within the in-universe Marvel timeline */
  storyYear?: number;
  /** Alternative year used for in-universe ordering */
  inUniverseYear?: number;
  /** Approximate runtime in minutes */
  runtimeMinutes?: number;
  /** Primary director name */
  director?: string;
  /** Principal cast members */
  cast: CastMember[];
  /** Where to stream / watch online */
  ott?: OTTPlatform[];
  /** Genre labels */
  genres?: string[];
  /** Short synopsis or tagline */
  synopsis?: string;
  /** Path to the poster image asset */
  posterPath?: string;
  /** Path to the widescreen backdrop image */
  backdropPath?: string;
  /** URL to the official trailer (YouTube, etc.) */
  trailerUrl?: string;
  /** Information about mid/post-credit scenes */
  postCredits?: PostCreditScene[];
  /** Full crew / credit roll entries */
  credits?: CreditEntry[];
}

/** A cast member attached to a movie or series */
export interface CastMember {
  /** Actor's name */
  name: string;
  /** Character they portray */
  character?: string;
  /** Billing order (lower = higher billing) */
  order?: number;
  /** Path to their profile / headshot image */
  profilePath?: string;
}

/** An over-the-top streaming platform where a title is available */
export interface OTTPlatform {
  /** Human-readable provider name (e.g. "Disney+", "Netflix") */
  provider: string;
  /** URL-safe slug for the provider */
  slug?: string;
  /** Direct deep-link to the title on this platform */
  url?: string;
}

/** Metadata for a mid-credits or post-credits scene */
export interface PostCreditScene {
  /** Whether the scene appears after the credits start or after they finish */
  type: 'mid' | 'after';
  /** Brief description of the scene */
  description?: string;
  /** IDs of movies/series this scene directly connects to */
  connectsTo?: string[];
}

/** A single entry in the credits roll */
export interface CreditEntry {
  /** Person's name */
  name: string;
  /** Their credited role (e.g. "Director", "Producer") */
  role?: string;
  /** Department (e.g. "Directing", "Writing", "Production") */
  department?: string;
  /** Path to their profile image */
  profilePath?: string;
}

// =============================================================================
// Timeline Types
// =============================================================================

/** A single node on the interactive story-timeline graph */
export interface TimelineNode {
  /** The movie data this node represents */
  movie: Movie;
  /** Horizontal position in the timeline canvas */
  x: number;
  /** Vertical position in the timeline canvas */
  y: number;
  /** Which lane (franchise line) this node sits in */
  lane: string;
  /** Whether the user has marked this title as watched */
  watched: boolean;
}

/** A directed edge connecting two timeline nodes */
export interface TimelineEdge {
  /** ID of the source movie */
  from: string;
  /** ID of the target movie */
  to: string;
  /** Which lane the edge visually belongs to */
  lane: string;
}

/** A horizontal lane in the timeline representing a franchise line */
export interface Lane {
  /** Unique lane identifier */
  id: string;
  /** Human-readable display label */
  label: string;
  /** CSS color used to render the lane */
  color: string;
  /** Ordered list of movie IDs in this lane */
  movies: string[];
}

// =============================================================================
// Application State Types
// =============================================================================

/** The global reactive application state */
export interface AppState {
  /** Current sort mode for the movie grid */
  sortMode: SortMode;
  /** Free-text search query */
  query: string;
  /** Active phase filter (empty string = all phases) */
  phaseFilter: string;
  /** Current SPA route path */
  route: string;
  /** Set of movie IDs the user has bookmarked */
  watchlist: Set<string>;
  /** Map of movie ID → journey status for the user's tracker */
  journey: Record<string, JourneyStatus>;
  /** Set of movie IDs in the user's Infinity Gauntlet challenge */
  gauntlet: Set<string>;
  /** List of achievement IDs the user has unlocked */
  achievements: string[];
  /** Set of franchise-line IDs the user has hidden from view */
  hiddenLines: Set<string>;
  /** Movie ID for the currently highlighted crossover path, or null */
  crossoverPath: string | null;
  /** Movie ID acting as the "butterfly effect" source, or null */
  butterflySource: string | null;
  /** Movie ID for the currently scanned teaser, or null */
  teaserScan: string | null;
  /** Whether the alternate-variant scan mode is active */
  variantScan: boolean;
  /** Current playhead position on the audio timeline (ms), or null */
  playhead: number | null;
  /** Whether sound effects / music are enabled */
  soundEnabled: boolean;
  /** Whether era-grouping mode is active */
  eraMode: boolean;
  /** Set of era IDs the user has collapsed */
  collapsedEras: Set<string>;
  /** Whether the mode-note banner has been dismissed */
  modeNoteDismissed: boolean;
}

// =============================================================================
// IndexedDB / Persistence Types
// =============================================================================

/** Shape of the IndexedDB object-store schema */
export interface DBSchema {
  /** Movie IDs in the user's watchlist */
  watchlist: { key: string; value: string };
  /** Per-movie journey tracking records */
  journey: { key: string; value: JourneyRecord };
  /** Movie IDs completed in the Gauntlet challenge */
  gauntlet: { key: string; value: string };
  /** Achievement unlock records */
  achievements: { key: string; value: AchievementRecord };
  /** User preference key-value pairs */
  settings: { key: string; value: SettingRecord };
  /** Aggregate statistics entries */
  stats: { key: string; value: StatsRecord };
}

/** A persisted journey-tracker entry */
export interface JourneyRecord {
  /** The movie this record tracks */
  movieId: string;
  /** Current journey status */
  status: JourneyStatus;
  /** Unix epoch milliseconds when this record was last updated */
  updatedAt: number;
}

/** A persisted achievement unlock record */
export interface AchievementRecord {
  /** The achievement identifier */
  id: string;
  /** Unix epoch milliseconds when it was unlocked */
  unlockedAt: number;
}

/** A persisted user-setting entry */
export interface SettingRecord {
  /** Setting key name */
  key: string;
  /** Arbitrary setting value */
  value: unknown;
}

/** A persisted statistics entry */
export interface StatsRecord {
  /** Statistics key name (e.g. "totalWatched", "totalMinutes") */
  key: string;
  /** Statistics value */
  value: unknown;
}

// =============================================================================
// Feature Types
// =============================================================================

/** A single multiple-choice quiz question */
export interface QuizQuestion {
  /** The question text */
  q: string;
  /** Available answer options */
  options: string[];
  /** Index of the correct answer in `options` */
  answer: number;
  /** ID of the movie this question relates to */
  movieId: string;
}

/** The current state of an active quiz session */
export interface QuizState {
  /** Index of the question currently being answered */
  currentQ: number;
  /** Running score (correct answers) */
  score: number;
  /** The full list of questions for this quiz */
  questions: QuizQuestion[];
  /** Whether each question has been answered (parallel to `questions`) */
  answered: boolean[];
  /** Completed question results with correctness */
  results: { question: QuizQuestion; correct: boolean }[];
}

/** A participant in a Watch Party session */
export interface PartyMember {
  /** Display name */
  name: string;
  /** Shorthand initials for the avatar */
  initials: string;
  /** Assigned avatar / tag color */
  color: string;
  /** IDs of movies this member has watched */
  watched: string[];
}

/** A real-time Watch Party session */
export interface WatchParty {
  /** Unique room / invite code */
  code: string;
  /** Whether the current user is the host */
  host: boolean;
  /** Unix epoch milliseconds when the party was created */
  created: number;
  /** All participating members */
  members: PartyMember[];
  /** Monotonically increasing sync version for conflict resolution */
  syncVersion: number;
}

/** A single recommendation entry in the "For You" feed */
export interface Recommendation {
  /** The movie being recommended */
  movie: Movie;
  /** Numeric relevance score (higher = better match) */
  score: number;
  /** Human-readable reason for the recommendation */
  reason: string;
  /** Display rank in the list (1-based) */
  rank: number;
}

// =============================================================================
// Three.js / 3D Galaxy Types
// =============================================================================

/** A node in the 3D galaxy visualization */
export interface GalaxyNode {
  /** The movie data this node represents */
  movie: Movie;
  /** Angular position (radians) on the galactic disc */
  angle: number;
  /** Distance from the center of the galaxy */
  radius: number;
  /** Index of the phase ring this node sits in */
  phaseIndex: number;
  /** Optional reference to the Three.js mesh */
  mesh?: { position: { x: number; y: number; z: number }; scale: { x: number; y: number; z: number } };
}

/** Configuration for the 3D galaxy renderer */
export interface GalaxyConfig {
  /** Innermost ring radius */
  innerRadius: number;
  /** Outermost ring radius */
  outerRadius: number;
  /** Number of concentric phase rings */
  phaseCount: number;
  /** Size of each node sphere */
  nodeSize: number;
  /** Radians per frame of ambient rotation */
  rotationSpeed: number;
}

// =============================================================================
// Web Worker / Compute Types
// =============================================================================

/** An incoming message sent to a web-worker for background computation */
export interface ComputeMessage {
  /** The computation task type */
  type: 'score-recommendations' | 'compute-constellation' | 'priority-batch';
  /** Task-specific input payload */
  payload: unknown;
}

/** A response message returned from a web-worker */
export interface ComputeResponse {
  /** The computation result type */
  type: 'recommendations' | 'constellation' | 'priorities';
  /** Task-specific output payload */
  payload: unknown;
}

// =============================================================================
// Notification Types
// =============================================================================

/** Payload for a browser / push notification */
export interface NotificationPayload {
  /** Notification title text */
  title: string;
  /** Notification body text */
  body: string;
  /** URL or path to the notification icon */
  icon?: string;
  /** URL or path to the notification badge */
  badge?: string;
  /** Deduplication tag */
  tag?: string;
  /** Arbitrary data attached to the notification click event */
  data?: Record<string, unknown>;
}

// =============================================================================
// Image Pipeline Types
// =============================================================================

/** Configuration for a responsive / lazy-loaded image */
export interface ImageConfig {
  /** Source URL or import path */
  src: string;
  /** Accessible alt text */
  alt: string;
  /** Explicit width in pixels (for layout stability) */
  width?: number;
  /** Explicit height in pixels (for layout stability) */
  height?: number;
  /** Whether to lazy-load the image */
  lazy?: boolean;
  /** Low-quality placeholder image URL or data-URI */
  placeholder?: string;
  /** Preferred output format for responsive images */
  format?: 'webp' | 'avif' | 'jpg' | 'png';
}
