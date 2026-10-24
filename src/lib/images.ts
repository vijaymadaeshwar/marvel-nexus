// images.ts — Image optimization pipeline for Marvel Nexus

const TMDB_BASE = 'https://image.tmdb.org/t/p';
const SIZES = { w92: 'w92', w154: 'w154', w185: 'w185', w342: 'w342', w500: 'w500', original: 'original' } as const;

type SizeKey = keyof typeof SIZES;

// Detect browser support for modern formats
let _supportsWebP: boolean | null = null;
let _supportsAVIF: boolean | null = null;

export async function supportsWebP(): Promise<boolean> {
  if (_supportsWebP !== null) return _supportsWebP;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { _supportsWebP = img.width > 0 && img.height > 0; resolve(_supportsWebP); };
    img.onerror = () => { _supportsWebP = false; resolve(false); };
    img.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiTzd0wA=';
  });
}

export async function supportsAVIF(): Promise<boolean> {
  if (_supportsAVIF !== null) return _supportsAVIF;
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { _supportsAVIF = img.width > 0 && img.height > 0; resolve(_supportsAVIF); };
    img.onerror = () => { _supportsAVIF = false; resolve(false); };
    img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWQgaW1hZ2U9AAAAAASTLWlzZQ==';
  });
}

// Generate TMDB URL with optimal size
export function posterUrl(path: string | null | undefined, size: SizeKey = 'w185'): string {
  if (!path) return '';
  return `${TMDB_BASE}/${SIZES[size]}${path}`;
}

// Generate responsive srcset for TMDB images
export function posterSrcSet(path: string | null | undefined): string {
  if (!path) return '';
  return [
    `${TMDB_BASE}/w92${path} 92w`,
    `${TMDB_BASE}/w154${path} 154w`,
    `${TMDB_BASE}/w185${path} 185w`,
    `${TMDB_BASE}/w342${path} 342w`,
  ].join(', ');
}

// Create a blurred placeholder using canvas
export function createPlaceholder(width = 20, height = 28): string {
  // Returns a tiny base64 JPEG as placeholder
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, 'rgba(118,87,255,.24)');
  grad.addColorStop(1, 'rgba(0,0,0,.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.5);
}

// Lazy load images with IntersectionObserver
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        if (img.dataset.srcset) {
          img.srcset = img.dataset.srcset;
          img.removeAttribute('data-srcset');
        }
        img.classList.add('is-loaded');
        observer.unobserve(img);
      }
    });
  },
  { rootMargin: '200px' }
);

export function observeImage(img: HTMLImageElement): void {
  if (img.dataset.src || img.dataset.srcset) {
    observer.observe(img);
  }
}

// Batch observe all images in a container
export function observeImages(container: HTMLElement): void {
  container.querySelectorAll('img[data-src], img[data-srcset]').forEach(img => {
    observeImage(img as HTMLImageElement);
  });
}

// Create an optimized <img> element for a poster
export function createPosterImage(
  path: string | null | undefined,
  alt: string,
  className = ''
): HTMLImageElement {
  const img = document.createElement('img');
  img.alt = alt;
  img.className = className;
  img.loading = 'lazy';
  img.decoding = 'async';
  
  if (path) {
    img.src = posterUrl(path, 'w92'); // tiny placeholder
    img.dataset.src = posterUrl(path, 'w185');
    img.dataset.srcset = posterSrcSet(path);
    img.sizes = '(max-width: 200px) 92px, 185px';
  } else {
    img.src = createPlaceholder();
  }
  
  observeImage(img);
  return img;
}

// Preload critical images
export function preloadImage(src: string): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = src;
  document.head.appendChild(link);
}
