// main.ts — Marvel Nexus v2 Entry Point
// Bootstraps all new TypeScript upgrade modules and bridges to legacy app

import './styles/index.css';
import { nexusDB } from './db/nexus-db';
import { observeImages, preloadImage, supportsWebP, supportsAVIF } from './lib/images';
import { initNotifications, scheduleNotifications } from './lib/notifications';

// New technology modules
import { AudioEngine } from './lib/audio-engine';
import { WebGLEffects } from './lib/webgl-effects';
import { WasmEngine } from './lib/wasm-bridge';
import { RealtimeSync } from './lib/websocket-sync';
import { ProgressiveLoader } from './lib/streams-loader';

// === State ===
let computeWorker: Worker | null = null;

// === Boot Sequence ===
async function boot(): Promise<void> {
  console.log('[NX v2] Booting upgrade layer...');

  // 1. Initialize IndexedDB and migrate from localStorage
  try {
    await nexusDB.migrate();
    console.log('[NX v2] IndexedDB ready, migration complete');
  } catch (err) {
    console.warn('[NX v2] IndexedDB init failed, falling back to localStorage', err);
  }

  // 2. Initialize notifications
  try {
    initNotifications();
    console.log('[NX v2] Notifications initialized');
  } catch (err) {
    console.warn('[NX v2] Notifications init failed', err);
  }

  // 3. Detect modern image format support
  try {
    const [webp, avif] = await Promise.all([supportsWebP(), supportsAVIF()]);
    document.documentElement.classList.toggle('supports-webp', webp);
    document.documentElement.classList.toggle('supports-avif', avif);
    console.log(`[NX v2] Image formats: WebP=${webp}, AVIF=${avif}`);
  } catch (err) {
    console.warn('[NX v2] Format detection failed', err);
  }

  // 4. Initialize image lazy loading on existing content
  initImagePipeline();

  // 5. Start compute worker
  initComputeWorker();

  // 6. Bridge IndexedDB with legacy app
  bridgeLegacyApp();

  // 8. Schedule periodic notification checks
  setInterval(scheduleNotifications, 60 * 60 * 1000);

  // Initialize new modules
  try { AudioEngine.getInstance().init(); } catch (e) { console.warn('AudioEngine init failed:', e); }
  try { const gl = new WebGLEffects(); await gl.init(); (window as any).__WEBGL_EFFECTS__ = gl; } catch (e) { console.warn('WebGL Effects init failed:', e); }
  try { const wasm = new WasmEngine(); await wasm.init(); (window as any).__WASM__ = wasm; } catch (e) { console.warn('WASM init failed:', e); }
  try { const sync = new RealtimeSync('marvel-nexus'); (window as any).__SYNC__ = sync; } catch (e) { console.warn('Sync init failed:', e); }
  try { const loader = new ProgressiveLoader(); (window as any).__LOADER__ = loader; } catch (e) { console.warn('Loader init failed:', e); }

  console.log('[NX v2] All upgrade modules loaded');
}

// === Image Pipeline ===
function initImagePipeline(): void {
  const main = document.querySelector('.main-content, main, #main, .app-content');
  if (main) {
    observeImages(main as HTMLElement);
  }

  // Re-observe when DOM changes (movie grid populates async)
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node instanceof HTMLElement) {
          observeImages(node);
          node.querySelectorAll('img[data-src]').forEach((img) => {
            observeImages(img as HTMLElement);
          });
        }
      }
    }
  });

  const target = document.querySelector('.movie-grid, .card-grid, .list, main, #main');
  if (target) {
    observer.observe(target, { childList: true, subtree: true });
  }

  // Preload hero images
  preloadImage('/assets/logo.png');
  preloadImage('/assets/background.jpg');
}

// === Compute Worker ===
function initComputeWorker(): void {
  try {
    computeWorker = new Worker(
      new URL('./workers/compute.worker.ts', import.meta.url),
      { type: 'module' }
    );
    computeWorker.onmessage = (e) => {
      const { type, payload } = e.data;
      window.dispatchEvent(new CustomEvent('nx:worker-result', { detail: { type, payload } }));
    };
    computeWorker.onerror = (err) => {
      console.warn('[NX v2] Worker error:', err);
    };
    console.log('[NX v2] Compute worker ready');
  } catch (err) {
    console.warn('[NX v2] Worker init failed (will use main thread fallback)', err);
  }

  // Listen for worker requests from legacy app
  window.addEventListener('nx:worker-request', ((e: CustomEvent) => {
    if (computeWorker) {
      computeWorker.postMessage(e.detail);
    }
  }) as EventListener);
}

// Expose worker API for legacy app
export function postToWorker(type: string, payload: unknown): void {
  const event = new CustomEvent('nx:worker-request', { detail: { id: crypto.randomUUID(), type, payload } });
  window.dispatchEvent(event);
}

// === Legacy Bridge ===
function bridgeLegacyApp(): void {
  // Poll for NexusCore availability (legacy app loads async)
  let attempts = 0;
  const check = setInterval(() => {
    if (window.NexusCore || attempts > 50) {
      clearInterval(check);
      if (window.NexusCore) {
        syncLegacyState();
        console.log('[NX v2] Legacy app bridged');
      }
    }
    attempts++;
  }, 200);
}

async function syncLegacyState(): Promise<void> {
  // Sync IndexedDB -> legacy window state on load
  try {
    const [watchlist, journey, gauntlet, achievements] = await Promise.all([
      nexusDB.getWatchlist(),
      nexusDB.getJourney(),
      nexusDB.getGauntlet(),
      nexusDB.getAchievements(),
    ]);

    // Write to localStorage as fallback for legacy code
    if (watchlist.size > 0) {
      localStorage.setItem('marvel-nexus-watchlist', JSON.stringify([...watchlist]));
    }
    if (Object.keys(journey).length > 0) {
      localStorage.setItem('marvel-nexus-journey', JSON.stringify(journey));
    }
    if (gauntlet.size > 0) {
      localStorage.setItem('marvel-nexus-gauntlet', JSON.stringify([...gauntlet]));
    }
    if (achievements.length > 0) {
      localStorage.setItem('marvel-nexus-achievements', JSON.stringify(achievements));
    }
  } catch (err) {
    console.warn('[NX v2] Legacy sync failed', err);
  }
}

// === Initialize ===
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// === Exports for other modules ===
export { nexusDB };
export { showNotification, NOTIFICATIONS } from './lib/notifications';
export { posterUrl, posterSrcSet, observeImages, createPosterImage } from './lib/images';
