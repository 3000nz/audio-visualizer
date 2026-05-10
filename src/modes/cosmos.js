const TOTAL_STARS   = 1500;
const AVG_BREAK_PT  = 140;
const AVG_COLOR_SH  = 110;
const WAVE_PTS      = 512;
const FREQ_PTS      = 64;
const OUTER_PTS     = 32;
const TWO_PI        = Math.PI * 2;
const DEG           = Math.PI / 180; // PI_HALF in original

const PALETTES = [
  { // 0 — Neon
    bg:         ['#000011', '#060D1F', '#02243F'],
    starA: '#465677', starB: '#B5BFD4', starBeat: '#F451BA',
    ring1:  [77,  218, 248], ring1Shadow:  '#4DDAF8',  // inner  — cyan
    ring2: [157,  242, 157], ring2Shadow:  '#9DF29D',  // middle — green
    ring3: [100,   80, 255], ring3Shadow:  '#6450FF',  // outer  — violet
    glowH: 185,
  },
  { // 1 — Fire
    bg:         ['#110000', '#1F0600', '#3F1200'],
    starA: '#774646', starB: '#D4B5A0', starBeat: '#FFD050',
    ring1:  [255, 220,  60], ring1Shadow:  '#FFDC3C',
    ring2:  [255, 140,  40], ring2Shadow:  '#FF8C28',
    ring3:  [200,  50,  30], ring3Shadow:  '#C8321E',
    glowH: 30,
  },
  { // 2 — Deep Space
    bg:         ['#08000F', '#12001F', '#1E003F'],
    starA: '#4A3A77', starB: '#B0A8D4', starBeat: '#50E0FF',
    ring1:  [180,  70, 255], ring1Shadow:  '#B446FF',
    ring2:  [157, 140, 242], ring2Shadow:  '#9D8CF2',
    ring3:  [ 50, 100, 220], ring3Shadow:  '#3264DC',
    glowH: 280,
  },
  { // 3 — Mono
    bg:         ['#000000', '#080808', '#101010'],
    starA: '#333333', starB: '#777777', starBeat: '#CCCCCC',
    ring1:  [255, 255, 255], ring1Shadow:  '#FFFFFF',
    ring2:  [200, 200, 200], ring2Shadow:  '#C8C8C8',
    ring3:  [100, 100, 100], ring3Shadow:  '#646464',
    glowH: 0,
  },
];

// ── Star (faithful to original algorithm) ────────────────────────────────────

class Star {
  constructor(w, h, cx, cy, fill) { this.init(w, h, cx, cy, fill); }

  init(w, h, cx, cy, fill = false) {
    this.max_depth = Math.max(w / h, h / w);

    if (fill) {
      this.x = Math.random() * w - cx;
      this.y = Math.random() * h - cy;
    } else {
      const a = Math.random() * TWO_PI;
      const r = Math.random() * Math.min(w, h) * 0.03 + 1;
      this.x = Math.cos(a) * r;
      this.y = Math.sin(a) * r;
    }

    this.z      = this.max_depth;
    this.radius = 0.2;

    const ax = this.x >= 0 ? 1 : -1;
    const ay = this.y >= 0 ? 1 : -1;
    const ax_ = Math.abs(this.x);
    const ay_ = Math.abs(this.y);

    if (ax_ >= ay_ && ax_ > 0) {
      this.dx = ax;
      this.dy = (ay_ / ax_) * ay;
    } else if (ay_ > 0) {
      this.dx = (ax_ / ay_) * ax;
      this.dy = ay;
    } else {
      const a = Math.random() * TWO_PI;
      this.dx = Math.cos(a);
      this.dy = Math.sin(a);
    }

    this.ddx = 0.001 * this.dx;
    this.ddy = 0.001 * this.dy;
    this.dz  = -0.1;
    this.secondary = Math.random() < 0.3;
  }

  update(d) {
    this.x  += this.dx * d;
    this.y  += this.dy * d;
    this.z  += this.dz;
    this.dx += this.ddx;
    this.dy += this.ddy;
    this.radius = 0.2 + 0.1 * (this.max_depth - this.z);
  }

  isOffScreen(cx, cy) {
    return this.x < -cx || this.x > cx || this.y < -cy || this.y > cy;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function drawRing(ctx, pts) {
  const N = pts.length;
  ctx.beginPath();
  ctx.moveTo((pts[0].x + pts[N - 1].x) / 2, (pts[0].y + pts[N - 1].y) / 2);
  for (let i = 0; i < N; i++) {
    const c = pts[i], n = pts[(i + 1) % N];
    ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
  }
  ctx.closePath();
}

function ringPoints(cx, cy, baseR, disp, n, transform) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const angle = 360 * i / n;
    const r     = baseR + disp[i];
    pts.push({ x: cx + r * Math.sin(DEG * angle), y: cy + r * Math.cos(DEG * angle) });
  }
  return pts;
}

// ── CosmosMode ────────────────────────────────────────────────────────────────

export class CosmosMode {
  constructor() {
    this.canvas2d  = null;
    this.ctx       = null;
    this.stars     = [];
    this.w = this.h = this.cx = this.cy = 0;
    this.rotation  = 0;
    this.rotDir    = 1;
    this.surge     = 0;
    this.autoHue   = 0; // 0–1, cycles when autoColor is on
    this.name      = 'Cosmos';
    this._onResize = null;
  }

  init(_scene) {
    this.canvas2d = document.getElementById('canvas-2d');
    this.canvas2d.style.display = 'block';
    this._resize();
    this.ctx = this.canvas2d.getContext('2d');
    const { w, h, cx, cy } = this;
    this.stars = Array.from({ length: TOTAL_STARS }, () => new Star(w, h, cx, cy, true));
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    if (!this.canvas2d) return;
    this.canvas2d.width  = this.w  = window.innerWidth;
    this.canvas2d.height = this.h  = window.innerHeight;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
  }

  // Resolve the 3-ring color set — either from palette or auto-cycling hue
  _ringColors(settings) {
    if (settings.autoColor) {
      const h1 = (this.autoHue * 360)        % 360;
      const h2 = (this.autoHue * 360 + 120)  % 360;
      const h3 = (this.autoHue * 360 + 240)  % 360;
      return {
        ring1: null, ring1H: h1, ring1Shadow: `hsl(${h1},100%,70%)`,
        ring2: null, ring2H: h2, ring2Shadow: `hsl(${h2},100%,65%)`,
        ring3: null, ring3H: h3, ring3Shadow: `hsl(${h3},100%,60%)`,
        glowH: h1,
      };
    }
    const p = PALETTES[settings.palette] ?? PALETTES[0];
    return {
      ring1: p.ring1, ring1H: null, ring1Shadow: p.ring1Shadow,
      ring2: p.ring2, ring2H: null, ring2Shadow: p.ring2Shadow,
      ring3: p.ring3, ring3H: null, ring3Shadow: p.ring3Shadow,
      glowH: p.glowH,
    };
  }

  _strokeColor(rgb, h, alpha) {
    if (h !== null) return `hsla(${h},100%,60%,${alpha.toFixed(3)})`;
    const [r, g, b] = rgb;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { waveform, frequencies } = audioData;
    const ctx = this.ctx;
    const { w, h, cx, cy } = this;
    const pal   = PALETTES[settings.palette] ?? PALETTES[0];
    const bloom = settings.bloomStrength;
    const sens  = settings.sensitivity;

    // Auto-color hue drift
    if (settings.autoColor) {
      this.autoHue = (this.autoHue + 0.0003 * settings.speed) % 1;
    }
    const rc = this._ringColors(settings);

    // Average (0–255, sensitivity-scaled)
    let sum = 0;
    for (let i = 0; i < frequencies.length; i++) sum += frequencies[i];
    const avg = Math.min(255, (sum / frequencies.length) * sens);

    // Speed + beat surge
    if (beatData.beat) this.surge += beatData.intensity * 4 * settings.speed;
    this.surge *= 0.91;
    const d = ((avg > AVG_BREAK_PT ? avg / 20 : avg / 50) * settings.speed) + this.surge;

    this.rotDir   = avg > AVG_BREAK_PT ? -1 : 1;
    this.rotation += this.rotDir * 0.001 * settings.speed;

    // ── Background ────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0,    pal.bg[0]);
    bg.addColorStop(0.96, pal.bg[1]);
    bg.addColorStop(1,    pal.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Edge vignette glow (bloom-driven) ─────────────────────────────
    const glowAlpha = (avg / 255) * bloom * 0.22;
    if (glowAlpha > 0.005) {
      const glowR  = Math.sqrt(cx * cx + cy * cy);
      const clearR = Math.min(cx, cy) * 0.55;
      const vign   = ctx.createRadialGradient(cx, cy, clearR, cx, cy, glowR);
      vign.addColorStop(0, 'rgba(0,0,0,0)');
      vign.addColorStop(1, `hsla(${rc.glowH},100%,60%,${glowAlpha.toFixed(3)})`);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = vign;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // ── Stars ─────────────────────────────────────────────────────────
    const starColor = avg > AVG_BREAK_PT ? pal.starBeat
                    : avg > AVG_COLOR_SH  ? pal.starB
                    : null;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.stars) {
      star.update(d);
      if (star.isOffScreen(cx, cy)) { star.init(w, h, cx, cy, false); continue; }
      ctx.beginPath();
      ctx.fillStyle = starColor ?? (star.secondary ? pal.starB : pal.starA);
      ctx.arc(cx + star.x, cy + star.y, star.radius, 0, TWO_PI, false);
      ctx.fill();
    }
    ctx.restore();

    // Shared ring setup
    const baseR  = Math.min(w, h) / 10;
    const innerR = baseR * 0.75;
    const midR   = baseR * 1.25;
    const outerR = baseR * 1.85;

    // ── Ring 1 — inner, freq-domain, brightest ────────────────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(this.rotation); ctx.translate(-cx, -cy);

    const freqDisp = Array.from({ length: FREQ_PTS }, (_, i) => {
      const idx = Math.floor(i * (frequencies.length * 0.5) / FREQ_PTS);
      return Math.min(1, (frequencies[idx] / 255) * sens) * innerR * 0.7 * settings.intensity;
    });
    const ring1Pts = ringPoints(cx, cy, innerR, freqDisp, FREQ_PTS);
    const freqAlpha = Math.min(1.0, 0.5 + (avg / 255) * 0.5);

    drawRing(ctx, ring1Pts);
    ctx.fillStyle   = 'rgba(29,36,57,0.1)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 18;
    ctx.shadowColor = rc.ring1Shadow;
    ctx.strokeStyle = this._strokeColor(rc.ring1, rc.ring1H, freqAlpha);
    ctx.lineWidth   = 2.0 + bloom * 0.4;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Ring 2 — middle, waveform-domain, medium opacity ──────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-this.rotation * 0.8); ctx.translate(-cx, -cy);

    const waveDisp = Array.from({ length: WAVE_PTS }, (_, i) => {
      const idx = Math.floor(i * waveform.length / WAVE_PTS);
      return ((waveform[idx] - 128) / 128) * sens * midR * 0.3 * settings.intensity;
    });
    const ring2Pts = ringPoints(cx, cy, midR, waveDisp, WAVE_PTS);
    const waveAlpha = Math.min(0.7, 0.15 + (avg / 255) * 0.55);

    drawRing(ctx, ring2Pts);
    ctx.fillStyle   = 'rgba(29,36,57,0.05)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 14;
    ctx.shadowColor = rc.ring2Shadow;
    ctx.strokeStyle = this._strokeColor(rc.ring2, rc.ring2H, waveAlpha);
    ctx.lineWidth   = 1.5 + bloom * 0.3;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Ring 3 — outer, energy pulse, most transparent ────────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(this.rotation * 0.4); ctx.translate(-cx, -cy);

    const energyDisp = (avg / 255) * sens * outerR * 0.12 * settings.intensity;
    // Uniform displacement = perfect circle that breathes with energy
    const outerDispArr = new Array(OUTER_PTS).fill(energyDisp);
    const ring3Pts = ringPoints(cx, cy, outerR, outerDispArr, OUTER_PTS);
    const outerAlpha = Math.min(0.28, 0.04 + (avg / 255) * 0.24);

    drawRing(ctx, ring3Pts);
    ctx.fillStyle   = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 22;
    ctx.shadowColor = rc.ring3Shadow;
    ctx.strokeStyle = this._strokeColor(rc.ring3, rc.ring3H, outerAlpha);
    ctx.lineWidth   = 1.0 + bloom * 0.4;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
  }

  dispose(_scene) {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this.canvas2d) {
      this.canvas2d.style.display = 'none';
      if (this.ctx) this.ctx.clearRect(0, 0, this.w, this.h);
    }
    this.stars = [];
    this.ctx = null;
    this.canvas2d = null;
  }
}
