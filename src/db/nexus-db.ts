// nexus-db.ts — IndexedDB state layer for Marvel Nexus
// Uses raw IndexedDB API (compatible with idb patterns, zero dependencies)

const DB_NAME = 'marvel-nexus';
const DB_VERSION = 1;

const STORES = {
  watchlist: 'watchlist',
  journey: 'journey',
  gauntlet: 'gauntlet',
  achievements: 'achievements',
  settings: 'settings',
} as const;

type StoreName = (typeof STORES)[keyof typeof STORES];

const LS_KEYS = {
  watchlist: 'marvel-nexus-watchlist',
  journey: 'marvel-nexus-journey',
  gauntlet: 'marvel-nexus-gauntlet',
  achievements: 'marvel-nexus-achievements',
  settings: 'marvel-nexus-settings',
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = () => {
        const db = req.result;
        for (const name of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        }
      };

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
    });
  }
  return dbPromise;
}

function tx(store: StoreName, mode: IDBTransactionMode = 'readonly') {
  return openDB().then(
    (db) => db.transaction(store, mode).objectStore(store),
  );
}

function promisifyRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------------------------------------------------------------------------
// Generic CRUD
// ---------------------------------------------------------------------------

async function getAll<T>(store: StoreName): Promise<Map<string, T>> {
  const s = await tx(store);
  const results = await promisifyRequest(s.getAllKeys());
  const map = new Map<string, T>();
  if (results.length === 0) return map;

  const s2 = await tx(store);
  const entries = await promisifyRequest(s2.getAll());
  for (let i = 0; i < results.length; i++) {
    map.set(String(results[i]), entries[i] as T);
  }
  return map;
}

async function get<T>(store: StoreName, key: string): Promise<T | undefined> {
  const s = await tx(store);
  return promisifyRequest(s.get(key));
}

async function set<T>(store: StoreName, key: string, value: T): Promise<void> {
  const s = await tx(store, 'readwrite');
  await promisifyRequest(s.put(value, key));
}

async function del(store: StoreName, key: string): Promise<void> {
  const s = await tx(store, 'readwrite');
  await promisifyRequest(s.delete(key));
}

async function clear(store: StoreName): Promise<void> {
  const s = await tx(store, 'readwrite');
  await promisifyRequest(s.clear());
}

async function keys(store: StoreName): Promise<string[]> {
  const s = await tx(store);
  const raw = await promisifyRequest(s.getAllKeys());
  return raw.map(String);
}

// ---------------------------------------------------------------------------
// localStorage migration helpers
// ---------------------------------------------------------------------------

function readLS<T>(lsKey: string): T | undefined {
  try {
    const raw = localStorage.getItem(lsKey);
    if (raw === null) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function removeLS(lsKey: string): void {
  try {
    localStorage.removeItem(lsKey);
  } catch {
    // storage may be unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// Typed store helpers (Set serialised as string array, Record kept as-is)
// ---------------------------------------------------------------------------

function arrayToSet(arr: unknown): Set<string> {
  if (Array.isArray(arr)) return new Set(arr.map(String));
  return new Set<string>();
}

function setToArray(s: Set<string>): string[] {
  return [...s];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const nexusDB = {
  // ── Watchlist ───────────────────────────────────────────────────────────

  async getWatchlist(): Promise<Set<string>> {
    const map = await getAll<string>(STORES.watchlist);
    return new Set(map.keys());
  },

  async addToWatchlist(id: string): Promise<void> {
    await set(STORES.watchlist, id, id);
  },

  async removeFromWatchlist(id: string): Promise<void> {
    await del(STORES.watchlist, id);
  },

  async toggleWatchlist(id: string): Promise<boolean> {
    const existing = await get<string>(STORES.watchlist, id);
    if (existing !== undefined) {
      await del(STORES.watchlist, id);
      return false;
    }
    await set(STORES.watchlist, id, id);
    return true;
  },

  // ── Journey ─────────────────────────────────────────────────────────────

  async getJourney(): Promise<Record<string, string>> {
    const map = await getAll<string>(STORES.journey);
    const result: Record<string, string> = {};
    for (const [k, v] of map) {
      result[k] = v;
    }
    return result;
  },

  async setJourneyStatus(id: string, status: string): Promise<void> {
    await set(STORES.journey, id, status);
  },

  async getJourneyStatus(id: string): Promise<string | undefined> {
    return get<string>(STORES.journey, id);
  },

  // ── Gauntlet (Infinity Stones) ──────────────────────────────────────────

  async getGauntlet(): Promise<Set<string>> {
    const map = await getAll<string>(STORES.gauntlet);
    return new Set(map.keys());
  },

  async collectStone(id: string): Promise<void> {
    await set(STORES.gauntlet, id, id);
  },

  async removeStone(id: string): Promise<void> {
    await del(STORES.gauntlet, id);
  },

  async resetGauntlet(): Promise<void> {
    await clear(STORES.gauntlet);
  },

  // ── Achievements ────────────────────────────────────────────────────────

  async getAchievements(): Promise<string[]> {
    const map = await getAll<string>(STORES.achievements);
    return [...map.keys()];
  },

  async unlockAchievement(id: string): Promise<void> {
    await set(STORES.achievements, id, id);
  },

  async hasAchievement(id: string): Promise<boolean> {
    const val = await get<string>(STORES.achievements, id);
    return val !== undefined;
  },

  // ── Settings ────────────────────────────────────────────────────────────

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    const val = await get<T>(STORES.settings, key);
    return val !== undefined ? val : defaultValue;
  },

  async setSetting<T>(key: string, value: T): Promise<void> {
    await set(STORES.settings, key, value);
  },

  // ── Migration from localStorage ─────────────────────────────────────────

  async migrate(): Promise<void> {
    // Watchlist — stored as JSON array of IDs
    const lsWatchlist = readLS<string[]>(LS_KEYS.watchlist);
    if (lsWatchlist && lsWatchlist.length > 0) {
      const existing = await this.getWatchlist();
      for (const id of lsWatchlist) {
        existing.add(id);
      }
      // Batch-write all entries
      const s = await tx(STORES.watchlist, 'readwrite');
      for (const id of existing) {
        s.put(id, id);
      }
      removeLS(LS_KEYS.watchlist);
    }

    // Journey — stored as Record<string, string>
    const lsJourney = readLS<Record<string, string>>(LS_KEYS.journey);
    if (lsJourney && Object.keys(lsJourney).length > 0) {
      const s = await tx(STORES.journey, 'readwrite');
      for (const [k, v] of Object.entries(lsJourney)) {
        s.put(v, k);
      }
      removeLS(LS_KEYS.journey);
    }

    // Gauntlet — stored as JSON array of stone IDs
    const lsGauntlet = readLS<string[]>(LS_KEYS.gauntlet);
    if (lsGauntlet && lsGauntlet.length > 0) {
      const s = await tx(STORES.gauntlet, 'readwrite');
      for (const id of lsGauntlet) {
        s.put(id, id);
      }
      removeLS(LS_KEYS.gauntlet);
    }

    // Achievements — stored as JSON array of achievement IDs
    const lsAchievements = readLS<string[]>(LS_KEYS.achievements);
    if (lsAchievements && lsAchievements.length > 0) {
      const s = await tx(STORES.achievements, 'readwrite');
      for (const id of lsAchievements) {
        s.put(id, id);
      }
      removeLS(LS_KEYS.achievements);
    }

    // Settings — stored as Record<string, unknown>
    const lsSettings = readLS<Record<string, unknown>>(LS_KEYS.settings);
    if (lsSettings && Object.keys(lsSettings).length > 0) {
      const s = await tx(STORES.settings, 'readwrite');
      for (const [k, v] of Object.entries(lsSettings)) {
        s.put(v, k);
      }
      removeLS(LS_KEYS.settings);
    }
  },

  // ── Reset everything ────────────────────────────────────────────────────

  async resetAll(): Promise<void> {
    await Promise.all([
      clear(STORES.watchlist),
      clear(STORES.journey),
      clear(STORES.gauntlet),
      clear(STORES.achievements),
      clear(STORES.settings),
    ]);
  },
};
