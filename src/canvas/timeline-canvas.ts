export interface MovieEntry {
  id: string;
  title: string;
  year: number;
  phase: number;
  line: string;
  essential?: boolean;
  rating?: number;
}

export interface CanvasState {
  panX: number;
  panY: number;
  zoom: number;
  velocityX: number;
  velocityY: number;
  selectedId: string | null;
  hoveredId: string | null;
  mouseX: number;
  mouseY: number;
  isDirty: boolean;
  isDragging: boolean;
  lastDragX: number;
  lastDragY: number;
  dragStartX: number;
  dragStartY: number;
  lastPinchDist: number;
  animationFrameId: number | null;
}

export interface RenderOptions {
  background: string;
  nodeWidth: number;
  nodeHeight: number;
  nodeRadius: number;
  fontSize: number;
  phaseFontSize: number;
  yearFontSize: number;
  connectionWidth: number;
  particleCount: number;
  particleMinSize: number;
  particleMaxSize: number;
  gridOpacity: number;
  tooltipOffset: number;
  glowRadius: number;
  glowColor: string;
  friction: number;
  momentumDecay: number;
}

const PHASE_COLORS: string[] = [
  '#1a3a6e',
  '#2d1b69',
  '#5c1a3a',
  '#8a6914',
  '#1a5a3a',
  '#6e1a4a',
  '#3a1a6e',
  '#694514',
  '#1a6e5a',
  '#6e3a1a',
  '#145069',
  '#5a1a1a',
];

const PHASE_GLOW_COLORS: string[] = [
  '#3a7aff',
  '#7b3aff',
  '#ff3a6a',
  '#ffd700',
  '#3aff8a',
  '#ff3aaa',
  '#7a3aff',
  '#ffaa3a',
  '#3affea',
  '#ff6a3a',
  '#3ac8ff',
  '#ff3a3a',
];

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  speedX: number;
  speedY: number;
  opacity: number;
  phaseOffset: number;
}

interface Connection {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  opacity: number;
}

interface TooltipData {
  x: number;
  y: number;
  title: string;
  year: number;
  phase: number;
  line: string;
  essential: boolean;
  rating: number | undefined;
}

const DEFAULT_OPTIONS: RenderOptions = {
  background: '#0a0a1a',
  nodeWidth: 160,
  nodeHeight: 56,
  nodeRadius: 10,
  fontSize: 13,
  phaseFontSize: 48,
  yearFontSize: 14,
  connectionWidth: 1.5,
  particleCount: 120,
  particleMinSize: 0.5,
  particleMaxSize: 2.5,
  gridOpacity: 0.06,
  tooltipOffset: 12,
  glowRadius: 16,
  glowColor: 'rgba(255, 255, 255, 0.6)',
  friction: 0.92,
  momentumDecay: 0.0005,
};

class ParticlePool {
  private pool: Particle[] = [];
  private active: Particle[] = [];

  acquire(count: number, options: RenderOptions): Particle[] {
    const result: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const p: Particle = this.pool.pop() ?? {
        x: 0,
        y: 0,
        baseX: 0,
        baseY: 0,
        size: 0,
        speedX: 0,
        speedY: 0,
        opacity: 0,
        phaseOffset: 0,
      };
      p.x = 0;
      p.y = 0;
      p.baseX = Math.random() * 2000;
      p.baseY = Math.random() * 2000;
      p.size =
        options.particleMinSize +
        Math.random() * (options.particleMaxSize - options.particleMinSize);
      p.speedX = (Math.random() - 0.5) * 0.3;
      p.speedY = (Math.random() - 0.5) * 0.3;
      p.opacity = 0.1 + Math.random() * 0.4;
      p.phaseOffset = Math.random() * Math.PI * 2;
      this.active.push(p);
      result.push(p);
    }
    return result;
  }

  release(particles: Particle[]): void {
    for (const p of particles) {
      const idx = this.active.indexOf(p);
      if (idx !== -1) {
        this.active.splice(idx, 1);
        this.pool.push(p);
      }
    }
  }

  getActive(): Particle[] {
    return this.active;
  }

  clear(): void {
    this.pool.push(...this.active);
    this.active = [];
  }
}

export class TimelineCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private data: MovieEntry[];
  private options: RenderOptions;
  private state: CanvasState;
  private particlePool: ParticlePool;
  private particles: Particle[] = [];
  private connections: Connection[] = [];
  private layoutCache: Map<
    string,
    { x: number; y: number; phaseIndex: number; color: string; glowColor: string }
  > = new Map();
  private resizeObserver: ResizeObserver | null = null;
  private throttleTimer: number | null = null;
  private touchStartTimer: number | null = null;
  private pinchActive = false;
  private lastTime = 0;
  private dpr = 1;
  private width = 0;
  private height = 0;
  private tooltipData: TooltipData | null = null;

  private boundOnMouseDown: (e: MouseEvent) => void;
  private boundOnMouseMove: (e: MouseEvent) => void;
  private boundOnMouseUp: (e: MouseEvent) => void;
  private boundOnWheel: (e: WheelEvent) => void;
  private boundOnTouchStart: (e: TouchEvent) => void;
  private boundOnTouchMove: (e: TouchEvent) => void;
  private boundOnTouchEnd: (e: TouchEvent) => void;

  constructor(
    canvas: HTMLCanvasElement,
    data: MovieEntry[],
    options?: Partial<RenderOptions>,
  ) {
    this.canvas = canvas;
    this.data = data;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Failed to get 2D context');
    this.ctx = ctx;

    this.offscreen = document.createElement('canvas');
    const offCtx = this.offscreen.getContext('2d', { alpha: false });
    if (!offCtx) throw new Error('Failed to get offscreen 2D context');
    this.offCtx = offCtx;

    this.state = {
      panX: 0,
      panY: 0,
      zoom: 1,
      velocityX: 0,
      velocityY: 0,
      selectedId: null,
      hoveredId: null,
      mouseX: 0,
      mouseY: 0,
      isDirty: true,
      isDragging: false,
      lastDragX: 0,
      lastDragY: 0,
      dragStartX: 0,
      dragStartY: 0,
      lastPinchDist: 0,
      animationFrameId: null,
    };

    this.particlePool = new ParticlePool();
    this.dpr = window.devicePixelRatio || 1;

    this.boundOnMouseDown = this.onMouseDown.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnTouchStart = this.onTouchStart.bind(this);
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchEnd = this.onTouchEnd.bind(this);

    this.attachEvents();
    this.resize();
    this.computeLayout();
    this.computeConnections();
    this.spawnParticles();
    this.startLoop();
  }

  private attachEvents(): void {
    this.canvas.addEventListener('mousedown', this.boundOnMouseDown);
    this.canvas.addEventListener('mousemove', this.boundOnMouseMove);
    this.canvas.addEventListener('mouseup', this.boundOnMouseUp);
    this.canvas.addEventListener('mouseleave', this.boundOnMouseUp);
    this.canvas.addEventListener('wheel', this.boundOnWheel, { passive: false });
    this.canvas.addEventListener('touchstart', this.boundOnTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.boundOnTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.boundOnTouchEnd);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
      this.state.isDirty = true;
    });
    this.resizeObserver.observe(this.canvas);
  }

  private detachEvents(): void {
    this.canvas.removeEventListener('mousedown', this.boundOnMouseDown);
    this.canvas.removeEventListener('mousemove', this.boundOnMouseMove);
    this.canvas.removeEventListener('mouseup', this.boundOnMouseUp);
    this.canvas.removeEventListener('mouseleave', this.boundOnMouseUp);
    this.canvas.removeEventListener('wheel', this.boundOnWheel);
    this.canvas.removeEventListener('touchstart', this.boundOnTouchStart);
    this.canvas.removeEventListener('touchmove', this.boundOnTouchMove);
    this.canvas.removeEventListener('touchend', this.boundOnTouchEnd);
    this.resizeObserver?.disconnect();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.offscreen.width = rect.width * this.dpr;
    this.offscreen.height = rect.height * this.dpr;
    this.state.isDirty = true;
  }

  private computeLayout(): void {
    this.layoutCache.clear();
    const sorted = [...this.data].sort((a, b) => a.year - b.year || a.phase - b.phase);

    const phaseGroups = new Map<number, MovieEntry[]>();
    for (const entry of sorted) {
      const list = phaseGroups.get(entry.phase) ?? [];
      list.push(entry);
      phaseGroups.set(entry.phase, list);
    }

    const phaseIndices = [...phaseGroups.keys()].sort((a, b) => a - b);
    const phaseSpacing = 260;
    const nodeSpacingX = 220;
    const baseY = 400;

    for (let pi = 0; pi < phaseIndices.length; pi++) {
      const phase = phaseIndices[pi];
      const entries = phaseGroups.get(phase)!;
      const xStart = pi * phaseSpacing;

      for (let ni = 0; ni < entries.length; ni++) {
        const entry = entries[ni];
        const row = ni % 3;
        const col = Math.floor(ni / 3);
        const x = xStart + col * nodeSpacingX;
        const y = baseY + (row - 1) * 90;
        const colorIdx = phase % PHASE_COLORS.length;
        this.layoutCache.set(entry.id, {
          x,
          y,
          phaseIndex: pi,
          color: PHASE_COLORS[colorIdx],
          glowColor: PHASE_GLOW_COLORS[colorIdx],
        });
      }
    }
  }

  private computeConnections(): void {
    this.connections = [];
    const lineMap = new Map<string, MovieEntry[]>();
    for (const entry of this.data) {
      const list = lineMap.get(entry.line) ?? [];
      list.push(entry);
      lineMap.set(entry.line, list);
    }

    for (const [, entries] of lineMap) {
      if (entries.length < 2) continue;
      const sorted = entries.sort((a, b) => a.year - b.year);
      for (let i = 0; i < sorted.length - 1; i++) {
        const fromPos = this.layoutCache.get(sorted[i].id);
        const toPos = this.layoutCache.get(sorted[i + 1].id);
        if (fromPos && toPos) {
          this.connections.push({
            fromX: fromPos.x,
            fromY: fromPos.y,
            toX: toPos.x,
            toY: toPos.y,
            opacity: 0.15,
          });
        }
      }
    }
  }

  private spawnParticles(): void {
    this.particlePool.clear();
    this.particles = this.particlePool.acquire(this.options.particleCount, this.options);
  }

  private onMouseDown = (e: MouseEvent): void => {
    this.state.isDragging = true;
    this.state.lastDragX = e.clientX;
    this.state.lastDragY = e.clientY;
    this.state.dragStartX = e.clientX;
    this.state.dragStartY = e.clientY;
    this.state.velocityX = 0;
    this.state.velocityY = 0;
    this.canvas.style.cursor = 'grabbing';
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.throttleTimer !== null) return;
    this.throttleTimer = window.setTimeout(() => {
      this.throttleTimer = null;
    }, 8);

    const rect = this.canvas.getBoundingClientRect();
    this.state.mouseX = e.clientX - rect.left;
    this.state.mouseY = e.clientY - rect.top;

    if (this.state.isDragging) {
      const dx = e.clientX - this.state.lastDragX;
      const dy = e.clientY - this.state.lastDragY;
      this.state.panX += dx;
      this.state.panY += dy;
      this.state.velocityX = dx;
      this.state.velocityY = dy;
      this.state.lastDragX = e.clientX;
      this.state.lastDragY = e.clientY;
      this.state.isDirty = true;
    } else {
      this.hitTest();
      this.state.isDirty = true;
    }
  };

  private onMouseUp = (_e: MouseEvent): void => {
    if (this.state.isDragging) {
      this.state.isDragging = false;
      this.canvas.style.cursor = 'default';
      const dist = Math.hypot(
        this.state.dragStartX - this.state.lastDragX,
        this.state.dragStartY - this.state.lastDragY,
      );
      if (dist < 4) {
        this.handleTap();
      }
    }
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newZoom = Math.max(0.2, Math.min(5, this.state.zoom * zoomFactor));

    const worldX = (mx - this.state.panX) / this.state.zoom;
    const worldY = (my - this.state.panY) / this.state.zoom;

    this.state.zoom = newZoom;
    this.state.panX = mx - worldX * newZoom;
    this.state.panY = my - worldY * newZoom;
    this.state.isDirty = true;
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length === 1) {
      const t = e.touches[0];
      this.state.isDragging = true;
      this.state.lastDragX = t.clientX;
      this.state.lastDragY = t.clientY;
      this.state.dragStartX = t.clientX;
      this.state.dragStartY = t.clientY;
      this.state.velocityX = 0;
      this.state.velocityY = 0;

      const rect = this.canvas.getBoundingClientRect();
      this.state.mouseX = t.clientX - rect.left;
      this.state.mouseY = t.clientY - rect.top;
    } else if (e.touches.length === 2) {
      this.state.isDragging = false;
      this.pinchActive = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.state.lastPinchDist = Math.hypot(dx, dy);
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length === 1 && this.state.isDragging && !this.pinchActive) {
      const t = e.touches[0];
      const dx = t.clientX - this.state.lastDragX;
      const dy = t.clientY - this.state.lastDragY;
      this.state.panX += dx;
      this.state.panY += dy;
      this.state.velocityX = dx;
      this.state.velocityY = dy;
      this.state.lastDragX = t.clientX;
      this.state.lastDragY = t.clientY;

      const rect = this.canvas.getBoundingClientRect();
      this.state.mouseX = t.clientX - rect.left;
      this.state.mouseY = t.clientY - rect.top;
      this.hitTest();
      this.state.isDirty = true;
    } else if (e.touches.length === 2 && this.pinchActive) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);

      if (this.state.lastPinchDist > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const rect = this.canvas.getBoundingClientRect();
        const cx = midX - rect.left;
        const cy = midY - rect.top;

        const scale = dist / this.state.lastPinchDist;
        const newZoom = Math.max(0.2, Math.min(5, this.state.zoom * scale));

        const worldX = (cx - this.state.panX) / this.state.zoom;
        const worldY = (cy - this.state.panY) / this.state.zoom;

        this.state.zoom = newZoom;
        this.state.panX = cx - worldX * newZoom;
        this.state.panY = cy - worldY * newZoom;
      }
      this.state.lastPinchDist = dist;
      this.state.isDirty = true;
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    if (e.touches.length === 0) {
      if (this.pinchActive) {
        this.pinchActive = false;
        this.state.lastPinchDist = 0;
      } else if (this.state.isDragging) {
        const dist = Math.hypot(
          this.state.dragStartX - this.state.lastDragX,
          this.state.dragStartY - this.state.lastDragY,
        );
        this.state.isDragging = false;
        if (dist < 8) {
          this.handleTap();
        }
      }
    } else if (e.touches.length === 1) {
      this.pinchActive = false;
      this.state.lastPinchDist = 0;
      const t = e.touches[0];
      this.state.isDragging = true;
      this.state.lastDragX = t.clientX;
      this.state.lastDragY = t.clientY;
    }
  };

  private handleTap(): void {
    const hit = this.hitTest();
    if (hit) {
      this.state.selectedId = hit.id === this.state.selectedId ? null : hit.id;
    } else {
      this.state.selectedId = null;
    }
    this.state.isDirty = true;
  }

  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.state.panX) / this.state.zoom,
      y: (sy - this.state.panY) / this.state.zoom,
    };
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx * this.state.zoom + this.state.panX,
      y: wy * this.state.zoom + this.state.panY,
    };
  }

  private hitTest(): MovieEntry | null {
    const world = this.screenToWorld(this.state.mouseX, this.state.mouseY);
    const hw = this.options.nodeWidth / 2;
    const hh = this.options.nodeHeight / 2;

    for (const entry of this.data) {
      const pos = this.layoutCache.get(entry.id);
      if (!pos) continue;
      if (
        world.x >= pos.x - hw &&
        world.x <= pos.x + hw &&
        world.y >= pos.y - hh &&
        world.y <= pos.y + hh
      ) {
        this.tooltipData = {
          x: this.state.mouseX,
          y: this.state.mouseY,
          title: entry.title,
          year: entry.year,
          phase: entry.phase,
          line: entry.line,
          essential: entry.essential ?? false,
          rating: entry.rating,
        };
        return entry;
      }
    }
    this.tooltipData = null;
    return null;
  }

  private isInViewport(wx: number, wy: number, margin: number): boolean {
    const s = this.worldToScreen(wx, wy);
    return (
      s.x > -margin &&
      s.x < this.width + margin &&
      s.y > -margin &&
      s.y < this.height + margin
    );
  }

  private updateParticles(dt: number, time: number): void {
    for (const p of this.particles) {
      p.x = p.baseX + Math.sin(time * 0.0003 + p.phaseOffset) * 20;
      p.y = p.baseY + Math.cos(time * 0.0004 + p.phaseOffset * 1.3) * 15;
      p.baseX += p.speedX * dt * 0.02;
      p.baseY += p.speedY * dt * 0.02;

      if (p.baseX < -100) p.baseX = 2100;
      if (p.baseX > 2100) p.baseX = -100;
      if (p.baseY < -100) p.baseY = 2100;
      if (p.baseY > 2100) p.baseY = -100;
    }
  }

  private updateMomentum(): boolean {
    if (this.state.isDragging) return false;

    const vx = this.state.velocityX;
    const vy = this.state.velocityY;
    if (Math.abs(vx) < 0.01 && Math.abs(vy) < 0.01) return false;

    this.state.panX += vx;
    this.state.panY += vy;
    this.state.velocityX *= this.options.friction;
    this.state.velocityY *= this.options.friction;
    this.state.isDirty = true;
    return true;
  }

  private render(time: number): void {
    const c = this.offCtx;
    const dpr = this.dpr;
    const w = this.width;
    const h = this.height;

    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    c.fillStyle = this.options.background;
    c.fillRect(0, 0, w, h);

    c.save();
    c.translate(this.state.panX, this.state.panY);
    c.scale(this.state.zoom, this.state.zoom);

    this.renderGrid(c, time);
    this.renderParticles(c, time);
    this.renderPhaseLabels(c);
    this.renderConnections(c, time);
    this.renderYearMarkers(c);
    this.renderNodes(c, time);

    c.restore();

    this.renderTooltip(c);

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.drawImage(this.offscreen, 0, 0);
  }

  private renderGrid(c: CanvasRenderingContext2D, _time: number): void {
    const margin = 200;
    const screenLeft = -this.state.panX / this.state.zoom - margin;
    const screenRight =
      (this.width - this.state.panX) / this.state.zoom + margin;
    const screenTop = -this.state.panY / this.state.zoom - margin;
    const screenBottom =
      (this.height - this.state.panY) / this.state.zoom + margin;

    c.strokeStyle = `rgba(255, 255, 255, ${this.options.gridOpacity})`;
    c.lineWidth = 0.5 / this.state.zoom;

    const startYear = Math.floor(screenLeft / 220) * 1;
    const endYear = Math.ceil(screenRight / 220) * 1;

    c.beginPath();
    for (let i = startYear; i <= endYear; i++) {
      const x = i * 220;
      if (x >= screenLeft && x <= screenRight) {
        c.moveTo(x, screenTop);
        c.lineTo(x, screenBottom);
      }
    }
    c.stroke();

    c.beginPath();
    for (let y = Math.floor(screenTop / 100) * 100; y <= screenBottom; y += 100) {
      c.moveTo(screenLeft, y);
      c.lineTo(screenRight, y);
    }
    c.stroke();
  }

  private renderParticles(c: CanvasRenderingContext2D, time: number): void {
    const margin = 100;
    for (const p of this.particles) {
      const sx = p.x * this.state.zoom + this.state.panX;
      const sy = p.y * this.state.zoom + this.state.panY;
      if (sx < -margin || sx > this.width + margin || sy < -margin || sy > this.height + margin) {
        continue;
      }

      const flicker = 0.5 + 0.5 * Math.sin(time * 0.001 + p.phaseOffset);
      const alpha = p.opacity * flicker;
      const size = p.size / this.state.zoom;

      c.globalAlpha = alpha;
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(p.x, p.y, size, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  private renderPhaseLabels(c: CanvasRenderingContext2D): void {
    const phaseGroups = new Map<number, { x: number; phase: number }>();
    for (const entry of this.data) {
      const pos = this.layoutCache.get(entry.id);
      if (!pos) continue;
      if (!phaseGroups.has(entry.phase)) {
        phaseGroups.set(entry.phase, {
          x: pos.x,
          phase: entry.phase,
        });
      }
    }

    const fontSize = this.options.phaseFontSize / this.state.zoom;
    c.font = `900 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';

    for (const [, group] of phaseGroups) {
      if (!this.isInViewport(group.x, 200, 300)) continue;
      const alpha = 0.04 + 0.02 * Math.sin(Date.now() * 0.0005 + group.phase);
      c.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      c.fillText(`PHASE ${group.phase}`, group.x, 200);
    }
  }

  private renderConnections(c: CanvasRenderingContext2D, time: number): void {
    const margin = 200;
    for (const conn of this.connections) {
      if (
        !this.isInViewport(conn.fromX, conn.fromY, margin) &&
        !this.isInViewport(conn.toX, conn.toY, margin)
      ) {
        continue;
      }

      const pulse = 0.7 + 0.3 * Math.sin(time * 0.001 + conn.fromX * 0.01);
      const grad = c.createLinearGradient(conn.fromX, conn.fromY, conn.toX, conn.toY);
      grad.addColorStop(0, `rgba(255, 255, 255, ${conn.opacity * pulse})`);
      grad.addColorStop(0.5, `rgba(255, 255, 255, ${conn.opacity * pulse * 1.5})`);
      grad.addColorStop(1, `rgba(255, 255, 255, ${conn.opacity * pulse})`);

      c.strokeStyle = grad;
      c.lineWidth = this.options.connectionWidth / this.state.zoom;
      c.beginPath();
      c.moveTo(conn.fromX, conn.fromY);

      const midX = (conn.fromX + conn.toX) / 2;
      const midY = (conn.fromY + conn.toY) / 2 - 30;
      c.quadraticCurveTo(midX, midY, conn.toX, conn.toY);
      c.stroke();
    }
  }

  private renderYearMarkers(c: CanvasRenderingContext2D): void {
    const margin = 200;
    const screenLeft = -this.state.panX / this.state.zoom - margin;
    const screenRight = (this.width - this.state.panX) / this.state.zoom + margin;

    const years = new Set<number>();
    for (const entry of this.data) {
      years.add(entry.year);
    }

    const fontSize = this.options.yearFontSize / this.state.zoom;
    c.font = `500 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'bottom';

    for (const year of years) {
      const pos = this.layoutCache.values().next().value;
      if (!pos) break;
      const x = pos.x + (year - this.data[0].year) * 10;
      if (x < screenLeft || x > screenRight) continue;

      c.fillStyle = 'rgba(255, 255, 255, 0.5)';
      c.fillText(String(year), x, 340);
    }
  }

  private renderNodes(c: CanvasRenderingContext2D, time: number): void {
    const hw = this.options.nodeWidth / 2;
    const hh = this.options.nodeHeight / 2;
    const r = this.options.nodeRadius;
    const margin = 100;

    for (const entry of this.data) {
      const pos = this.layoutCache.get(entry.id);
      if (!pos) continue;

      if (!this.isInViewport(pos.x, pos.y, margin)) continue;

      const isSelected = entry.id === this.state.selectedId;
      const isHovered = entry.id === this.state.hoveredId;
      const isActive = isSelected || isHovered;

      if (isSelected) {
        const glowPulse = 1 + 0.2 * Math.sin(time * 0.003);
        c.shadowColor = pos.glowColor;
        c.shadowBlur = this.options.glowRadius * glowPulse;
        c.shadowOffsetX = 0;
        c.shadowOffsetY = 0;
      }

      const grad = c.createLinearGradient(
        pos.x - hw,
        pos.y - hh,
        pos.x + hw,
        pos.y + hh,
      );
      grad.addColorStop(0, pos.color);
      grad.addColorStop(1, this.lightenColor(pos.color, 0.25));

      c.fillStyle = grad;
      this.roundRect(c, pos.x - hw, pos.y - hh, this.options.nodeWidth, this.options.nodeHeight, r);
      c.fill();

      if (isActive) {
        c.strokeStyle = pos.glowColor;
        c.lineWidth = 2 / this.state.zoom;
        this.roundRect(c, pos.x - hw, pos.y - hh, this.options.nodeWidth, this.options.nodeHeight, r);
        c.stroke();
      }

      c.shadowColor = 'transparent';
      c.shadowBlur = 0;

      if (entry.essential) {
        c.fillStyle = '#ffd700';
        const starSize = 6 / this.state.zoom;
        this.drawStar(c, pos.x + hw - 14 / this.state.zoom, pos.y - hh + 14 / this.state.zoom, starSize, 5);
        c.fill();
      }

      const fontSize = this.options.fontSize / this.state.zoom;
      c.font = `600 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffffff';
      c.shadowColor = 'rgba(0, 0, 0, 0.7)';
      c.shadowBlur = 3 / this.state.zoom;

      const maxTextWidth = this.options.nodeWidth - 20;
      let title = entry.title;
      if (c.measureText(title).width > maxTextWidth) {
        while (c.measureText(title + '…').width > maxTextWidth && title.length > 0) {
          title = title.slice(0, -1);
        }
        title += '…';
      }
      c.fillText(title, pos.x, pos.y - 2 / this.state.zoom);

      const subSize = (fontSize * 0.8) / 1;
      c.font = `400 ${subSize}px "Segoe UI", system-ui, sans-serif`;
      c.fillStyle = 'rgba(255, 255, 255, 0.7)';
      c.fillText(
        `${entry.year} · Phase ${entry.phase}`,
        pos.x,
        pos.y + fontSize * 0.7,
      );

      c.shadowColor = 'transparent';
      c.shadowBlur = 0;

      if (entry.rating !== undefined) {
        const ratingSize = 10 / this.state.zoom;
        c.font = `700 ${ratingSize}px "Segoe UI", system-ui, sans-serif`;
        c.textAlign = 'left';
        c.textBaseline = 'top';
        c.fillStyle = '#ffd700';
        c.fillText(
          '★ ' + entry.rating.toFixed(1),
          pos.x - hw + 6 / this.state.zoom,
          pos.y + hh - 14 / this.state.zoom,
        );
      }
    }
  }

  private renderTooltip(c: CanvasRenderingContext2D): void {
    if (!this.tooltipData) return;
    const t = this.tooltipData;
    const pad = 12;
    const lineH = 20;
    const tipW = 220;
    const tipH = 110;

    let tx = t.x + this.options.tooltipOffset;
    let ty = t.y + this.options.tooltipOffset;
    if (tx + tipW > this.width) tx = t.x - tipW - this.options.tooltipOffset;
    if (ty + tipH > this.height) ty = t.y - tipH - this.options.tooltipOffset;

    c.fillStyle = 'rgba(10, 10, 30, 0.92)';
    c.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    c.lineWidth = 1;
    this.roundRect(c, tx, ty, tipW, tipH, 8);
    c.fill();
    this.roundRect(c, tx, ty, tipW, tipH, 8);
    c.stroke();

    c.fillStyle = '#ffffff';
    c.font = '600 13px "Segoe UI", system-ui, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';

    let yOff = ty + pad;
    const title = t.title.length > 26 ? t.title.slice(0, 24) + '…' : t.title;
    c.fillText(title, tx + pad, yOff);
    yOff += lineH;

    c.font = '400 12px "Segoe UI", system-ui, sans-serif';
    c.fillStyle = 'rgba(255, 255, 255, 0.7)';
    c.fillText(`${t.year} · Phase ${t.phase}`, tx + pad, yOff);
    yOff += lineH;

    c.fillText(`Line: ${t.line}`, tx + pad, yOff);
    yOff += lineH;

    if (t.essential) {
      c.fillStyle = '#ffd700';
      c.fillText('★ Essential', tx + pad, yOff);
      yOff += lineH;
    }

    if (t.rating !== undefined) {
      c.fillStyle = '#ffd700';
      c.fillText(`Rating: ${t.rating.toFixed(1)}`, tx + pad, yOff);
    }
  }

  private roundRect(
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  private drawStar(
    c: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    points: number,
  ): void {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const angle = (i * Math.PI) / points - Math.PI / 2;
      const r = i % 2 === 0 ? radius : radius * 0.45;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.closePath();
  }

  private lightenColor(hex: string, amount: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, ((num >> 16) & 0xff) + Math.floor(255 * amount));
    const g = Math.min(255, ((num >> 8) & 0xff) + Math.floor(255 * amount));
    const b = Math.min(255, (num & 0xff) + Math.floor(255 * amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private startLoop(): void {
    const loop = (time: number) => {
      const dt = time - this.lastTime;
      this.lastTime = time;

      const moving = this.updateMomentum();
      this.updateParticles(dt, time);

      if (moving || this.state.isDirty || this.tooltipData) {
        this.render(time);
        this.state.isDirty = false;
      }

      this.state.animationFrameId = requestAnimationFrame(loop);
    };
    this.state.animationFrameId = requestAnimationFrame(loop);
  }

  public setData(data: MovieEntry[]): void {
    this.data = data;
    this.computeLayout();
    this.computeConnections();
    this.state.isDirty = true;
  }

  public setSelected(id: string | null): void {
    this.state.selectedId = id;
    this.state.isDirty = true;
  }

  public focusOn(id: string, animated = true): void {
    const pos = this.layoutCache.get(id);
    if (!pos) return;

    const targetPanX = this.width / 2 - pos.x * this.state.zoom;
    const targetPanY = this.height / 2 - pos.y * this.state.zoom;

    if (!animated) {
      this.state.panX = targetPanX;
      this.state.panY = targetPanY;
      this.state.selectedId = id;
      this.state.isDirty = true;
      return;
    }

    const startPanX = this.state.panX;
    const startPanY = this.state.panY;
    const startTime = performance.now();
    const duration = 400;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - t, 3);

      this.state.panX = startPanX + (targetPanX - startPanX) * ease;
      this.state.panY = startPanY + (targetPanY - startPanY) * ease;
      this.state.isDirty = true;

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.state.selectedId = id;
      }
    };
    requestAnimationFrame(animate);
  }

  public resetView(): void {
    this.state.panX = 0;
    this.state.panY = 0;
    this.state.zoom = 1;
    this.state.velocityX = 0;
    this.state.velocityY = 0;
    this.state.selectedId = null;
    this.state.isDirty = true;
  }

  public destroy(): void {
    if (this.state.animationFrameId !== null) {
      cancelAnimationFrame(this.state.animationFrameId);
    }
    if (this.throttleTimer !== null) {
      clearTimeout(this.throttleTimer);
    }
    if (this.touchStartTimer !== null) {
      clearTimeout(this.touchStartTimer);
    }
    this.detachEvents();
    this.particlePool.clear();
  }
}
