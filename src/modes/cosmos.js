const TOTAL_STARS   = 1500;
const AVG_BREAK_PT  = 140;
const AVG_COLOR_SH  = 110;
const WAVE_PTS      = 512;
const FREQ_PTS      = 64;
const BASS_PTS      = 48;
const TREBLE_PTS    = 96;
const OUTER_PTS     = 32;
const TWO_PI        = Math.PI * 2;
const DEG           = Math.PI / 180;

// Two complementary colors (colorA / colorB) per palette.
// Rings alternate A-B-A-B-A so adjacent rings always contrast.
const PALETTES = [
  { // 0 — Neon
    bg:        ['#000011', '#060D1F', '#02243F'],
    starA: '#465677', starB: '#B5BFD4', starBeat: '#F451BA',
    colorA: [77,  218, 248], shadowA: '#4DDAF8',   // cyan
    colorB: [244,  81, 186], shadowB: '#F451BA',   // magenta
    glowH: 185,
  },
  { // 1 — Fire
    bg:        ['#110000', '#1F0600', '#3F1200'],
    starA: '#774646', starB: '#D4B5A0', starBeat: '#FFD050',
    colorA: [255, 220,  60], shadowA: '#FFDC3C',   // gold
    colorB: [220,  55,  20], shadowB: '#DC3714',   // deep red
    glowH: 30,
  },
  { // 2 — Deep Space
    bg:        ['#08000F', '#12001F', '#1E003F'],
    starA: '#4A3A77', starB: '#B0A8D4', starBeat: '#50E0FF',
    colorA: [180,  70, 255], shadowA: '#B446FF',   // violet
    colorB: [ 50, 185, 255], shadowB: '#32B9FF',   // electric blue
    glowH: 280,
  },
  { // 3 — Mono
    bg:        ['#000000', '#080808', '#101010'],
    starA: '#333333', starB: '#777777', starBeat: '#CCCCCC',
    colorA: [255, 255, 255], shadowA: '#FFFFFF',   // white
    colorB: [140, 140, 140], shadowB: '#8C8C8C',   // gray
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

function ringPoints(cx, cy, baseR, disp, n) {
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
    this.autoHue   = 0;
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

  // Two complementary colors — auto mode uses H and H+180
  _ringColors(settings) {
    if (settings.autoColor) {
      const hA = (this.autoHue * 360) % 360;
      const hB = (hA + 180) % 360;
      return {
        colorA: null, colorAH: hA, shadowA: `hsl(${hA},100%,70%)`,
        colorB: null, colorBH: hB, shadowB: `hsl(${hB},100%,65%)`,
        glowH: hA,
      };
    }
    const p = PALETTES[settings.palette] ?? PALETTES[0];
    return {
      colorA: p.colorA, colorAH: null, shadowA: p.shadowA,
      colorB: p.colorB, colorBH: null, shadowB: p.shadowB,
      glowH: p.glowH,
    };
  }

  _strokeColor(rgb, h, alpha) {
    if (h !== null) return `hsla(${h},100%,62%,${alpha.toFixed(3)})`;
    const [r, g, b] = rgb;
    return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { waveform, frequencies, bass, treble } = audioData;
    const ctx = this.ctx;
    const { w, h, cx, cy } = this;
    const pal   = PALETTES[settings.palette] ?? PALETTES[0];
    const bloom = settings.bloomStrength;
    const sens  = settings.sensitivity;

    if (settings.autoColor) {
      this.autoHue = (this.autoHue + 0.0003 * settings.speed) % 1;
    }
    const rc = this._ringColors(settings);

    let sum = 0;
    for (let i = 0; i < frequencies.length; i++) sum += frequencies[i];
    const avg = Math.min(255, (sum / frequencies.length) * sens);

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

    // ── Edge vignette glow ────────────────────────────────────────────
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

    // Ring radii (inside → outside)
    const baseR    = Math.min(w, h) / 10;
    const freqR    = baseR * 0.55;   // ring 1 — freq shape
    const bassR    = baseR * 0.90;   // ring 2 — bass pulse
    const midR     = baseR * 1.30;   // ring 3 — waveform
    const trebleR  = baseR * 1.70;   // ring 4 — treble sparkle
    const outerR   = baseR * 2.10;   // ring 5 — energy, always visible

    // ── Ring 1 — freq shape, colorA ───────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(this.rotation); ctx.translate(-cx, -cy);

    const freqDisp = Array.from({ length: FREQ_PTS }, (_, i) => {
      const idx = Math.floor(i * (frequencies.length * 0.5) / FREQ_PTS);
      return Math.min(1, (frequencies[idx] / 255) * sens) * freqR * 0.75 * settings.intensity;
    });
    const freqAlpha = Math.min(1.0, 0.55 + (avg / 255) * 0.45);

    drawRing(ctx, ringPoints(cx, cy, freqR, freqDisp, FREQ_PTS));
    ctx.fillStyle   = 'rgba(29,36,57,0.1)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 18;
    ctx.shadowColor = rc.shadowA;
    ctx.strokeStyle = this._strokeColor(rc.colorA, rc.colorAH, freqAlpha);
    ctx.lineWidth   = 2.5 + bloom * 0.4;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Ring 2 — bass pulse, colorB ───────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-this.rotation * 1.1); ctx.translate(-cx, -cy);

    const bassLevel = Math.min(1, (bass ?? 0) * sens);
    const bassDisp = Array.from({ length: BASS_PTS }, (_, i) => {
      // Mix uniform bass energy with per-bin texture from low-freq bins
      const idx = Math.floor(i * 6 / BASS_PTS) + 1;
      const binVal = Math.min(1, (frequencies[idx] / 255) * sens);
      return (bassLevel * 0.65 + binVal * 0.35) * bassR * 0.85 * settings.intensity;
    });
    const bassAlpha = Math.min(1.0, 0.5 + bassLevel * 0.5);

    drawRing(ctx, ringPoints(cx, cy, bassR, bassDisp, BASS_PTS));
    ctx.fillStyle   = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 22 * (0.5 + bassLevel * 0.5);
    ctx.shadowColor = rc.shadowB;
    ctx.strokeStyle = this._strokeColor(rc.colorB, rc.colorBH, bassAlpha);
    ctx.lineWidth   = 2.5 + bloom * 0.5 + bassLevel * 2.0;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Ring 3 — waveform, colorA ─────────────────────────────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(-this.rotation * 0.7); ctx.translate(-cx, -cy);

    const waveDisp = Array.from({ length: WAVE_PTS }, (_, i) => {
      const idx = Math.floor(i * waveform.length / WAVE_PTS);
      return ((waveform[idx] - 128) / 128) * sens * midR * 0.28 * settings.intensity;
    });
    const waveAlpha = Math.min(0.75, 0.2 + (avg / 255) * 0.55);

    drawRing(ctx, ringPoints(cx, cy, midR, waveDisp, WAVE_PTS));
    ctx.fillStyle   = 'rgba(29,36,57,0.04)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 14;
    ctx.shadowColor = rc.shadowA;
    ctx.strokeStyle = this._strokeColor(rc.colorA, rc.colorAH, waveAlpha);
    ctx.lineWidth   = 1.8 + bloom * 0.3;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Ring 4 — treble sparkle, colorB ──────────────────────────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(this.rotation * 1.4); ctx.translate(-cx, -cy);

    // Maps to treble freq bins (~90–370) — spiky, high-resolution
    const trebleLevel = Math.min(1, (treble ?? 0) * sens);
    const trebleDisp = Array.from({ length: TREBLE_PTS }, (_, i) => {
      const idx = Math.min(frequencies.length - 1, Math.floor(90 + i * 280 / TREBLE_PTS));
      return Math.min(1, (frequencies[idx] / 255) * sens) * trebleR * 0.55 * settings.intensity;
    });
    const trebleAlpha = Math.min(0.9, 0.35 + trebleLevel * 0.55);

    drawRing(ctx, ringPoints(cx, cy, trebleR, trebleDisp, TREBLE_PTS));
    ctx.fillStyle   = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 16;
    ctx.shadowColor = rc.shadowB;
    ctx.strokeStyle = this._strokeColor(rc.colorB, rc.colorBH, trebleAlpha);
    ctx.lineWidth   = 1.5 + bloom * 0.3;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Ring 5 — outer energy, always fully visible, colorA ───────────
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(this.rotation * 0.25); ctx.translate(-cx, -cy);

    const energyDisp = (avg / 255) * sens * outerR * 0.1 * settings.intensity;
    const outerDispArr = new Array(OUTER_PTS).fill(energyDisp);
    // Always highly visible: minimum 0.8 alpha
    const outerAlpha = Math.min(1.0, 0.82 + (avg / 255) * 0.18);

    drawRing(ctx, ringPoints(cx, cy, outerR, outerDispArr, OUTER_PTS));
    ctx.fillStyle   = 'rgba(0,0,0,0)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 32;
    ctx.shadowColor = rc.shadowA;
    ctx.strokeStyle = this._strokeColor(rc.colorA, rc.colorAH, outerAlpha);
    ctx.lineWidth   = 4.0 + bloom * 0.9;
    ctx.lineCap     = 'round';
    ctx.stroke();
    // Second stroke pass for extra glow intensity
    ctx.shadowBlur  = bloom * 16;
    ctx.lineWidth   = 2.0 + bloom * 0.4;
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
