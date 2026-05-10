const TOTAL_STARS = 1500;
const AVG_BREAK_POINT = 140;
const AVG_COLOR_SHIFT = 110;
const WAVEFORM_POINTS = 512;
const FREQ_POINTS = 64;
const PI_TWO = Math.PI * 2;
const PI_HALF = Math.PI / 180;

const PALETTES = [
  { // 0 — Neon (original colours)
    bg: ['#000011', '#060D1F', '#02243F'],
    starA: '#465677', starB: '#B5BFD4', starBeat: '#F451BA',
    wave: [157, 242, 157], waveShadow: '#9DF29D',
    freq: 'rgba(77,218,248,1)', freqShadow: '#4DDAF8',
  },
  { // 1 — Fire
    bg: ['#110000', '#1F0600', '#3F1200'],
    starA: '#774646', starB: '#D4B5A0', starBeat: '#FFD050',
    wave: [255, 140, 40], waveShadow: '#FF8C28',
    freq: 'rgba(255,220,60,1)', freqShadow: '#FFDC3C',
  },
  { // 2 — Deep Space
    bg: ['#08000F', '#12001F', '#1E003F'],
    starA: '#4A3A77', starB: '#B0A8D4', starBeat: '#50E0FF',
    wave: [157, 140, 242], waveShadow: '#9D8CF2',
    freq: 'rgba(180,70,255,1)', freqShadow: '#B446FF',
  },
  { // 3 — Mono
    bg: ['#000000', '#080808', '#101010'],
    starA: '#333333', starB: '#777777', starBeat: '#CCCCCC',
    wave: [200, 200, 200], waveShadow: '#C8C8C8',
    freq: 'rgba(255,255,255,0.9)', freqShadow: '#FFFFFF',
  },
];

// ── Star ──────────────────────────────────────────────────────────────────────
// Faithful to the original algorithm:
//   - direction vector points away from center, derived from spawn position
//   - acceleration (ddx/ddy) makes stars speed up as they age
//   - z drives radius growth only (not perspective projection)
//   - additive blending creates the glow without per-star shadow cost

class Star {
  constructor(w, h, cx, cy, fill) { this.init(w, h, cx, cy, fill); }

  init(w, h, cx, cy, fill = false) {
    this.max_depth = Math.max(w / h, h / w);

    if (fill) {
      // Initial field fill — random across screen, matching original
      this.x = Math.random() * w - cx;
      this.y = Math.random() * h - cy;
    } else {
      // Respawn near centre so new stars appear to explode outward
      const angle = Math.random() * PI_TWO;
      const spread = Math.min(w, h) * 0.03;
      const r = Math.random() * spread + 1; // minimum 1px so direction calc works
      this.x = Math.cos(angle) * r;
      this.y = Math.sin(angle) * r;
    }

    this.z = this.max_depth;
    this.radius = 0.2;

    // Original direction algorithm: normalise velocity so the dominant
    // axis is ±1 and the other is proportional — star moves straight
    // away from the centre along its spawn angle.
    const ax = this.x >= 0 ? 1 : -1;
    const ay = this.y >= 0 ? 1 : -1;
    const absx = Math.abs(this.x);
    const absy = Math.abs(this.y);

    if (absx >= absy && absx > 0) {
      this.dx = ax;
      this.dy = (absy / absx) * ay;
    } else if (absy > 0) {
      this.dx = (absx / absy) * ax;
      this.dy = ay;
    } else {
      // Exactly at origin — random angle fallback
      const a = Math.random() * PI_TWO;
      this.dx = Math.cos(a);
      this.dy = Math.sin(a);
    }

    // Original acceleration: 0.1% of velocity added per frame
    this.ddx = 0.001 * this.dx;
    this.ddy = 0.001 * this.dy;
    this.dz  = -0.1; // drives radius growth
    this.secondary = Math.random() < 0.3;
  }

  update(d) {
    this.x  += this.dx * d;
    this.y  += this.dy * d;
    this.z  += this.dz;
    this.dx += this.ddx; // accelerate
    this.dy += this.ddy;
    this.radius = 0.2 + 0.1 * (this.max_depth - this.z);
  }

  isOffScreen(cx, cy) {
    return this.x < -cx || this.x > cx || this.y < -cy || this.y > cy;
  }
}

// ── Ring helper ───────────────────────────────────────────────────────────────

function drawRing(ctx, points) {
  const N = points.length;
  ctx.beginPath();
  ctx.moveTo((points[0].x + points[N - 1].x) / 2, (points[0].y + points[N - 1].y) / 2);
  for (let i = 0; i < N; i++) {
    const c = points[i], nx = points[(i + 1) % N];
    ctx.quadraticCurveTo(c.x, c.y, (c.x + nx.x) / 2, (c.y + nx.y) / 2);
  }
  ctx.closePath();
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
    this.surge     = 0; // beat-driven speed boost, decays each frame
    this.name      = 'Cosmos';
    this._onResize = null;
  }

  init(_scene) {
    this.canvas2d = document.getElementById('canvas-2d');
    this.canvas2d.style.display = 'block';
    this._resize();
    this.ctx = this.canvas2d.getContext('2d');

    // Fill field immediately with random stars across the screen (original behaviour)
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

  update(_scene, audioData, beatData, _clock, settings) {
    const { waveform, frequencies } = audioData;
    const ctx  = this.ctx;
    const { w, h, cx, cy } = this;
    const pal  = PALETTES[settings.palette] ?? PALETTES[0];
    const bloom = settings.bloomStrength;
    const sens  = settings.sensitivity;

    // ── Audio average (0–255 space, sensitivity-scaled) ───────────────
    let sum = 0;
    for (let i = 0; i < frequencies.length; i++) sum += frequencies[i];
    const avg = Math.min(255, (sum / frequencies.length) * sens);

    // Original speed formula + beat surge
    if (beatData.beat) this.surge += beatData.intensity * 4 * settings.speed;
    this.surge *= 0.91;
    const d = ((avg > AVG_BREAK_POINT ? avg / 20 : avg / 50) * settings.speed) + this.surge;

    // Ring rotation reverses on high energy (original behaviour)
    this.rotDir   = avg > AVG_BREAK_POINT ? -1 : 1;
    this.rotation += this.rotDir * 0.001 * settings.speed;

    // ── Background ────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0,    pal.bg[0]);
    bg.addColorStop(0.96, pal.bg[1]);
    bg.addColorStop(1,    pal.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Stars ─────────────────────────────────────────────────────────
    // Colour logic mirrors original: avg drives colour tier
    const starColor = avg > AVG_BREAK_POINT ? pal.starBeat
                    : avg > AVG_COLOR_SHIFT  ? pal.starB
                    : null; // null = per-star primary/secondary

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const star of this.stars) {
      star.update(d);
      if (star.isOffScreen(cx, cy)) {
        star.init(w, h, cx, cy, false); // respawn at centre
        continue;
      }
      const color = starColor ?? (star.secondary ? pal.starB : pal.starA);
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(cx + star.x, cy + star.y, star.radius, 0, PI_TWO, false);
      ctx.fill();
    }

    ctx.restore();

    // ── Waveform ring (time-domain, 512 pts) ─────────────────────────
    const baseR = Math.min(w, h) / 10; // matches original: Math.abs(w,h)/10
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);
    ctx.translate(-cx, -cy);

    const wavePoints = [];
    for (let i = 0; i < WAVEFORM_POINTS; i++) {
      const srcIdx = Math.floor(i * waveform.length / WAVEFORM_POINTS);
      const amp    = ((waveform[srcIdx] - 128) / 128) * sens;
      const angle  = (360 * i / WAVEFORM_POINTS);
      const disp   = amp * baseR * 0.8 * settings.intensity;
      wavePoints.push({
        x: cx + baseR * Math.sin(PI_HALF * angle) + disp * Math.sin(PI_HALF * angle),
        y: cy + baseR * Math.cos(PI_HALF * angle) + disp * Math.cos(PI_HALF * angle),
      });
    }

    const [wr, wg, wb] = pal.wave;
    const waveAlpha = Math.min(0.9, 0.11 + (avg / 255) * 0.69);
    const waveColor = `rgba(${wr},${wg},${wb},${waveAlpha})`;

    drawRing(ctx, wavePoints);
    ctx.fillStyle   = 'rgba(29,36,57,0.05)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 16;
    ctx.shadowColor = pal.waveShadow;
    ctx.strokeStyle = waveColor;
    ctx.lineWidth   = 1 + bloom * 0.3;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();

    // ── Average frequency ring (freq-domain, 64 pts) ──────────────────
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.rotation * 0.7);
    ctx.translate(-cx, -cy);

    const freqD = avg > AVG_BREAK_POINT ? avg + 10 * Math.random() : avg;
    const freqPoints = [];
    for (let i = 0; i < FREQ_POINTS; i++) {
      const srcIdx = Math.floor(i * (frequencies.length * 0.5) / FREQ_POINTS);
      const amp    = Math.min(1, (frequencies[srcIdx] / 255) * sens);
      const angle  = (360 * i / FREQ_POINTS);
      const disp   = amp * freqD * 0.5 * settings.intensity;
      freqPoints.push({
        x: cx + baseR * Math.sin(PI_HALF * angle) + disp * Math.sin(PI_HALF * angle),
        y: cy + baseR * Math.cos(PI_HALF * angle) + disp * Math.cos(PI_HALF * angle),
      });
    }

    drawRing(ctx, freqPoints);
    ctx.fillStyle   = 'rgba(29,36,57,0.1)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 14;
    ctx.shadowColor = pal.freqShadow;
    ctx.strokeStyle = pal.freq;
    ctx.lineWidth   = 1.5 + bloom * 0.3;
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
    this.stars    = [];
    this.ctx      = null;
    this.canvas2d = null;
  }
}
