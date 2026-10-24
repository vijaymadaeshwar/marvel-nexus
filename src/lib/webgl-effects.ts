export interface ParticleOptions {
  count: number;
  baseSize: number;
  speed: number;
  spread: number;
  colors: [number, number, number][];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  r: number;
  g: number;
  b: number;
  alpha: number;
  life: number;
  maxLife: number;
}

interface ShaderProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attribs: Record<string, number>;
}

const MAX_PARTICLES = 1000;

const VERT_FULLSCREEN = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_VIGNETTE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_intensity;
out vec4 fragColor;
void main() {
  vec2 center = v_uv - 0.5;
  float dist = length(center);
  float vig = smoothstep(0.5, 0.1, dist * u_intensity);
  fragColor = vec4(0.0, 0.0, 0.0, 1.0 - vig);
}`;

const FRAG_NOISE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform float u_intensity;
out vec4 fragColor;
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  float n = rand(v_uv * u_time * 100.0) * u_intensity;
  fragColor = vec4(vec3(n), n * 0.5);
}`;

const FRAG_SCANLINES = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_intensity;
uniform float u_speed;
uniform float u_time;
out vec4 fragColor;
void main() {
  float y = v_uv.y * 800.0 + u_time * u_speed;
  float line = step(0.5, fract(y));
  float alpha = line * u_intensity * 0.3;
  fragColor = vec4(0.0, 0.0, 0.0, alpha);
}`;

const FRAG_SHIMMER = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform float u_time;
uniform vec4 u_rect;
out vec4 fragColor;
void main() {
  vec2 p = (v_uv - u_rect.xy) / u_rect.zw;
  float wave = sin(p.x * 20.0 + u_time * 3.0) * 0.5 + 0.5;
  float wave2 = cos(p.y * 15.0 + u_time * 2.5) * 0.5 + 0.5;
  float shimmer = wave * wave2;
  vec3 col = mix(vec3(0.6, 0.8, 1.0), vec3(1.0, 0.6, 0.9), shimmer);
  float alpha = shimmer * 0.4 * (1.0 - smoothstep(0.0, 0.02, p.x)) * (1.0 - smoothstep(0.98, 1.0, p.x))
    * (1.0 - smoothstep(0.0, 0.02, p.y)) * (1.0 - smoothstep(0.98, 1.0, p.y));
  fragColor = vec4(col, alpha);
}`;

const VERT_PARTICLE = `#version 300 es
precision highp float;
in vec2 a_position;
in float a_size;
in vec4 a_color;
out vec4 v_color;
uniform vec2 u_resolution;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}`;

const FRAG_PARTICLE = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 fragColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float glow = exp(-d * 4.0) * v_color.a;
  fragColor = vec4(v_color.rgb, glow);
}`;

const VERT_RECT = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec2 u_resolution;
uniform vec4 u_rect;
void main() {
  vec2 pos = u_rect.xy + a_position * u_rect.zw;
  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAG_RECT = `#version 300 es
precision highp float;
uniform vec4 u_color;
uniform float u_glow;
out vec4 fragColor;
void main() {
  vec2 c = gl_FragCoord.xy;
  vec3 col = u_color.rgb;
  float glow = u_glow * 0.3;
  fragColor = vec4(col + glow, u_color.a);
}`;

const VERT_LINE = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec2 u_resolution;
uniform vec4 u_line;
void main() {
  vec2 pos = u_line.xy + a_position * (u_line.zw - u_line.xy);
  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAG_LINE = `#version 300 es
precision highp float;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform float u_t;
out vec4 fragColor;
void main() {
  fragColor = mix(u_color1, u_color2, u_t);
}`;

const VERT_PARTICLE_GLES = `precision highp float;
attribute vec2 a_position;
attribute float a_size;
attribute vec4 a_color;
varying vec4 v_color;
uniform vec2 u_resolution;
void main() {
  vec2 clip = (a_position / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = a_size;
  v_color = a_color;
}`;

const FRAG_PARTICLE_GLES = `precision highp float;
varying vec4 v_color;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  float glow = exp(-d * 4.0) * v_color.a;
  gl_FragColor = vec4(v_color.rgb, glow);
}`;

const VERT_FULLSCREEN_GLES = `precision highp float;
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAG_VIGNETTE_GLES = `precision highp float;
varying vec2 v_uv;
uniform float u_intensity;
void main() {
  vec2 center = v_uv - 0.5;
  float dist = length(center);
  float vig = smoothstep(0.5, 0.1, dist * u_intensity);
  gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - vig);
}`;

const FRAG_NOISE_GLES = `precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform float u_intensity;
float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
  float n = rand(v_uv * u_time * 100.0) * u_intensity;
  gl_FragColor = vec4(vec3(n), n * 0.5);
}`;

const FRAG_SCANLINES_GLES = `precision highp float;
varying vec2 v_uv;
uniform float u_intensity;
uniform float u_speed;
uniform float u_time;
void main() {
  float y = v_uv.y * 800.0 + u_time * u_speed;
  float line = step(0.5, fract(y));
  float alpha = line * u_intensity * 0.3;
  gl_FragColor = vec4(0.0, 0.0, 0.0, alpha);
}`;

const FRAG_SHIMMER_GLES = `precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec4 u_rect;
void main() {
  vec2 p = (v_uv - u_rect.xy) / u_rect.zw;
  float wave = sin(p.x * 20.0 + u_time * 3.0) * 0.5 + 0.5;
  float wave2 = cos(p.y * 15.0 + u_time * 2.5) * 0.5 + 0.5;
  float shimmer = wave * wave2;
  vec3 col = mix(vec3(0.6, 0.8, 1.0), vec3(1.0, 0.6, 0.9), shimmer);
  float alpha = shimmer * 0.4 * (1.0 - smoothstep(0.0, 0.02, p.x)) * (1.0 - smoothstep(0.98, 1.0, p.x))
    * (1.0 - smoothstep(0.0, 0.02, p.y)) * (1.0 - smoothstep(0.98, 1.0, p.y));
  gl_FragColor = vec4(col, alpha);
}`;

const VERT_RECT_GLES = `precision highp float;
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec4 u_rect;
void main() {
  vec2 pos = u_rect.xy + a_position * u_rect.zw;
  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAG_RECT_GLES = `precision highp float;
uniform vec4 u_color;
uniform float u_glow;
void main() {
  vec3 col = u_color.rgb;
  float glow = u_glow * 0.3;
  gl_FragColor = vec4(col + glow, u_color.a);
}`;

const VERT_LINE_GLES = `precision highp float;
attribute vec2 a_position;
uniform vec2 u_resolution;
uniform vec4 u_line;
void main() {
  vec2 pos = u_line.xy + a_position * (u_line.zw - u_line.xy);
  vec2 clip = (pos / u_resolution) * 2.0 - 1.0;
  clip.y = -clip.y;
  gl_Position = vec4(clip, 0.0, 1.0);
}`;

const FRAG_LINE_GLES = `precision highp float;
uniform vec4 u_color1;
uniform vec4 u_color2;
uniform float u_t;
void main() {
  gl_FragColor = mix(u_color1, u_color2, u_t);
}`;

export class WebGLEffects {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext | WebGLRenderingContext;
  private isWebGL2: boolean;
  private width = 0;
  private height = 0;
  private particles: Particle[] = [];
  private particleBuffer: WebGLBuffer | null = null;
  private quadBuffer: WebGLBuffer | null = null;
  private programs: Record<string, ShaderProgram> = {};
  private animFrame = 0;
  private disposed = false;
  private depthTestEnabled = false;
  private blendEnabled = false;

  constructor(canvas?: HTMLCanvasElement) {
    if (canvas) {
      this.canvas = canvas;
    } else {
      this.canvas = document.createElement("canvas");
    }

    let ctx = this.canvas.getContext("webgl2") as WebGL2RenderingContext | null;
    if (ctx) {
      this.isWebGL2 = true;
      this.gl = ctx;
    } else {
      ctx = this.canvas.getContext("webgl") as unknown as WebGL2RenderingContext;
      if (!ctx) {
        throw new Error("WebGL not supported");
      }
      this.isWebGL2 = false;
      this.gl = ctx as unknown as WebGLRenderingContext;
    }

    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.initBuffers();
  }

  private initBuffers(): void {
    const gl = this.gl;

    this.quadBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    if (this.isWebGL2) {
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
        gl.STATIC_DRAW
      );
    } else {
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
        gl.STATIC_DRAW
      );
    }

    this.particleBuffer = gl.createBuffer();
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("Shader compile error: " + info);
    }
    return shader;
  }

  private createProgram(vertSrc: string, fragSrc: string, attribs: string[]): ShaderProgram {
    const gl = this.gl;
    const vert = this.compileShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.compileShader(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram()!;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error("Program link error: " + info);
    }
    gl.deleteShader(vert);
    gl.deleteShader(frag);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < numUniforms; i++) {
      const info = gl.getActiveUniform(program, i)!;
      uniforms[info.name] = gl.getUniformLocation(program, info.name);
    }

    const attribMap: Record<string, number> = {};
    for (const name of attribs) {
      attribMap[name] = gl.getAttribLocation(program, name);
    }

    return { program, uniforms, attribs: attribMap };
  }

  private getProgram(name: string, vertSrc: string, fragSrc: string, attribs: string[]): ShaderProgram {
    if (!this.programs[name]) {
      this.programs[name] = this.createProgram(vertSrc, fragSrc, attribs);
    }
    return this.programs[name];
  }

  init(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.disable(gl.DEPTH_TEST);
    this.depthTestEnabled = false;
    this.blendEnabled = true;
  }

  drawParticleField(time: number, options: ParticleOptions): void {
    const gl = this.gl;
    const prog = this.getProgram(
      "particle",
      this.isWebGL2 ? VERT_PARTICLE : VERT_PARTICLE_GLES,
      this.isWebGL2 ? FRAG_PARTICLE : FRAG_PARTICLE_GLES,
      ["a_position", "a_size", "a_color"]
    );

    const count = Math.min(options.count, MAX_PARTICLES);
    while (this.particles.length < count) {
      this.spawnParticle(options);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += 1 / 60;
      if (p.life >= p.maxLife) {
        if (this.particles.length > count) {
          this.particles.splice(i, 1);
        } else {
          this.resetParticle(p, options);
        }
        continue;
      }
      p.x += p.vx * options.speed;
      p.y += p.vy * options.speed;
      const lifeRatio = p.life / p.maxLife;
      p.alpha = lifeRatio < 0.2 ? lifeRatio / 0.2 : lifeRatio > 0.8 ? (1 - lifeRatio) / 0.2 : 1;
    }

    if (this.particles.length === 0) return;

    gl.useProgram(prog.program);
    this.ensureBlend(true);

    const stride = 28;
    const data = new Float32Array(this.particles.length * 7);
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const o = i * 7;
      data[o] = p.x;
      data[o + 1] = p.y;
      data[o + 2] = p.size;
      data[o + 3] = p.r;
      data[o + 4] = p.g;
      data[o + 5] = p.b;
      data[o + 6] = p.alpha;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);

    const posLoc = prog.attribs["a_position"];
    const sizeLoc = prog.attribs["a_size"];
    const colorLoc = prog.attribs["a_color"];

    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, stride, 0);

    gl.enableVertexAttribArray(sizeLoc);
    gl.vertexAttribPointer(sizeLoc, 1, gl.FLOAT, false, stride, 8);

    gl.enableVertexAttribArray(colorLoc);
    gl.vertexAttribPointer(colorLoc, 4, gl.FLOAT, false, stride, 12);

    gl.uniform2f(prog.uniforms["u_resolution"], this.width, this.height);

    gl.drawArrays(gl.POINTS, 0, this.particles.length);

    gl.disableVertexAttribArray(posLoc);
    gl.disableVertexAttribArray(sizeLoc);
    gl.disableVertexAttribArray(colorLoc);
  }

  drawGlowRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: [number, number, number, number],
    glowIntensity: number
  ): void {
    const gl = this.gl;
    const prog = this.getProgram(
      "rect",
      this.isWebGL2 ? VERT_RECT : VERT_RECT_GLES,
      this.isWebGL2 ? FRAG_RECT : FRAG_RECT_GLES,
      ["a_position"]
    );

    gl.useProgram(prog.program);
    this.ensureBlend(true);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(prog.attribs["a_position"]);
    gl.vertexAttribPointer(prog.attribs["a_position"], 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(prog.uniforms["u_resolution"], this.width, this.height);
    gl.uniform4f(prog.uniforms["u_rect"], x, y, w, h);
    gl.uniform4f(prog.uniforms["u_color"], color[0], color[1], color[2], color[3]);
    gl.uniform1f(prog.uniforms["u_glow"], glowIntensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(prog.attribs["a_position"]);
  }

  drawGradientLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color1: [number, number, number, number],
    color2: [number, number, number, number]
  ): void {
    const gl = this.gl;
    const prog = this.getProgram(
      "line",
      this.isWebGL2 ? VERT_LINE : VERT_LINE_GLES,
      this.isWebGL2 ? FRAG_LINE : FRAG_LINE_GLES,
      ["a_position"]
    );

    gl.useProgram(prog.program);
    this.ensureBlend(true);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(prog.attribs["a_position"]);
    gl.vertexAttribPointer(prog.attribs["a_position"], 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(prog.uniforms["u_resolution"], this.width, this.height);
    gl.uniform4f(prog.uniforms["u_line"], x1, y1, x2, y2);
    gl.uniform4f(prog.uniforms["u_color1"], color1[0], color1[1], color1[2], color1[3]);
    gl.uniform4f(prog.uniforms["u_color2"], color2[0], color2[1], color2[2], color2[3]);
    gl.uniform1f(prog.uniforms["u_t"], 0.5);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(prog.attribs["a_position"]);
  }

  drawVignette(intensity: number): void {
    this.drawFullscreen("vignette", this.isWebGL2 ? FRAG_VIGNETTE : FRAG_VIGNETTE_GLES, (prog) => {
      this.gl.uniform1f(prog.uniforms["u_intensity"], intensity);
    });
  }

  drawNoiseGrain(time: number, intensity: number): void {
    this.drawFullscreen("noise", this.isWebGL2 ? FRAG_NOISE : FRAG_NOISE_GLES, (prog) => {
      this.gl.uniform1f(prog.uniforms["u_time"], time);
      this.gl.uniform1f(prog.uniforms["u_intensity"], intensity);
    });
  }

  drawScanlines(intensity: number, speed: number): void {
    this.drawFullscreen("scanlines", this.isWebGL2 ? FRAG_SCANLINES : FRAG_SCANLINES_GLES, (prog) => {
      this.gl.uniform1f(prog.uniforms["u_intensity"], intensity);
      this.gl.uniform1f(prog.uniforms["u_speed"], speed);
      this.gl.uniform1f(prog.uniforms["u_time"], performance.now() / 1000);
    });
  }

  drawShimmer(x: number, y: number, w: number, h: number, time: number): void {
    const gl = this.gl;
    const prog = this.getProgram(
      "shimmer",
      this.isWebGL2 ? VERT_FULLSCREEN : VERT_FULLSCREEN_GLES,
      this.isWebGL2 ? FRAG_SHIMMER : FRAG_SHIMMER_GLES,
      ["a_position"]
    );

    gl.useProgram(prog.program);
    this.ensureBlend(true);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(prog.attribs["a_position"]);
    gl.vertexAttribPointer(prog.attribs["a_position"], 2, gl.FLOAT, false, 0, 0);

    gl.uniform1f(prog.uniforms["u_time"], time);
    gl.uniform4f(prog.uniforms["u_rect"], x / this.width, y / this.height, w / this.width, h / this.height);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(prog.attribs["a_position"]);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.animFrame);

    const gl = this.gl;
    if (this.particleBuffer) gl.deleteBuffer(this.particleBuffer);
    if (this.quadBuffer) gl.deleteBuffer(this.quadBuffer);

    for (const key of Object.keys(this.programs)) {
      gl.deleteProgram(this.programs[key].program);
    }
    this.programs = {};
    this.particles = [];
  }

  private drawFullscreen(name: string, fragSrc: string, configure: (prog: ShaderProgram) => void): void {
    const gl = this.gl;
    const prog = this.getProgram(
      name,
      this.isWebGL2 ? VERT_FULLSCREEN : VERT_FULLSCREEN_GLES,
      fragSrc,
      ["a_position"]
    );

    gl.useProgram(prog.program);
    this.ensureBlend(true);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    gl.enableVertexAttribArray(prog.attribs["a_position"]);
    gl.vertexAttribPointer(prog.attribs["a_position"], 2, gl.FLOAT, false, 0, 0);

    configure(prog);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disableVertexAttribArray(prog.attribs["a_position"]);
  }

  private ensureBlend(enabled: boolean): void {
    if (this.blendEnabled !== enabled) {
      if (enabled) {
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
      } else {
        this.gl.disable(this.gl.BLEND);
      }
      this.blendEnabled = enabled;
    }
  }

  private spawnParticle(options: ParticleOptions): void {
    const p: Particle = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      size: 0,
      r: 0,
      g: 0,
      b: 0,
      alpha: 0,
      life: 0,
      maxLife: 0,
    };
    this.resetParticle(p, options);
    this.particles.push(p);
  }

  private resetParticle(p: Particle, options: ParticleOptions): void {
    const halfSpread = options.spread * 0.5;
    p.x = Math.random() * this.width;
    p.y = Math.random() * this.height;
    p.vx = (Math.random() - 0.5) * halfSpread;
    p.vy = (Math.random() - 0.5) * halfSpread;
    p.size = options.baseSize * (0.5 + Math.random());
    const color = options.colors[Math.floor(Math.random() * options.colors.length)];
    p.r = color[0];
    p.g = color[1];
    p.b = color[2];
    p.alpha = 0;
    p.life = 0;
    p.maxLife = 3 + Math.random() * 5;
  }
}
