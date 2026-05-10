const NUM_STARS = 1200;
const WAVEFORM_POINTS = 512;
const FREQ_POINTS = 64;

const PALETTES = [
  { // 0 — Neon
    bg: ['#000011', '#060D1F', '#02243F'],
    starA: [70, 86, 119],   starB: [181, 191, 212], starBeat: [244, 81, 186],
    wave: [157, 242, 157],  waveShadow: '#9DF29D',
    freq: 'rgba(77,218,248,1)', freqShadow: '#4DDAF8',
  },
  { // 1 — Fire
    bg: ['#110000', '#1F0600', '#3F1200'],
    starA: [119, 70, 70],   starB: [212, 181, 160], starBeat: [255, 208, 80],
    wave: [255, 140, 40],   waveShadow: '#FF8C28',
    freq: 'rgba(255,220,60,1)', freqShadow: '#FFDC3C',
  },
  { // 2 — Deep Space
    bg: ['#08000F', '#12001F', '#1E003F'],
    starA: [74, 58, 119],   starB: [176, 168, 212], starBeat: [80, 224, 255],
    wave: [157, 140, 242],  waveShadow: '#9D8CF2',
    freq: 'rgba(180,70,255,1)', freqShadow: '#B446FF',
  },
  { // 3 — Mono
    bg: ['#000000', '#080808', '#101010'],
    starA: [51, 51, 51],    starB: [119, 119, 119], starBeat: [204, 204, 204],
    wave: [200, 200, 200],  waveShadow: '#C8C8C8',
    freq: 'rgba(255,255,255,0.9)', freqShadow: '#FFFFFF',
  },
];

// ── Star ──────────────────────────────────────────────────────────────────────

class Star {
  constructor(randomZ) { this.init(randomZ); }

  init(randomZ = false) {
    // Spawn within a tiny circle at center so they all stream outward
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.0008;
    this.x  = Math.cos(a) * r;
    this.y  = Math.sin(a) * r;
    // randomZ=true on first fill so the field isn't initially empty
    this.z  = randomZ ? Math.random() * 0.95 + 0.05 : 1.0;
    this.pz = this.z;
    this.secondary = Math.random() < 0.3;
    this.fresh = true; // skip streak on first frame after spawn
  }

  update(speed) {
    this.pz    = this.z;
    this.z    -= speed;
    this.fresh = false;
  }

  draw(ctx, cx, cy, scale, rgb, highEnergy) {
    const sx  = (this.x / this.z)  * scale + cx;
    const sy  = (this.y / this.z)  * scale + cy;
    const px  = (this.x / this.pz) * scale + cx;
    const py  = (this.y / this.pz) * scale + cy;

    // Nonlinear brightness — dim far away, suddenly bright near
    const t      = 1 - this.z;
    const alpha  = Math.min(1, t * t * 2.5);
    const size   = Math.max(0.4, t * 2.2);
    const [r, g, b] = rgb;
    const color  = `rgba(${r},${g},${b},${alpha})`;

    ctx.strokeStyle = color;
    ctx.fillStyle   = color;
    ctx.lineWidth   = Math.max(0.4, size * 0.5);

    // Streak from previous position → current
    if (!this.fresh) {
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    }

    // Bright dot at the leading tip
    ctx.beginPath();
    ctx.arc(sx, sy, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  isOffScreen(cx, cy, scale) {
    const sx = (this.x / this.z) * scale + cx;
    const sy = (this.y / this.z) * scale + cy;
    const margin = 40;
    return (
      this.z <= 0.001 ||
      sx < -margin || sx > window.innerWidth  + margin ||
      sy < -margin || sy > window.innerHeight + margin
    );
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
    this.rotation  = 0;
    this.rotDir    = 1;
    this.surge     = 0;   // extra speed added by beat hits, decays each frame
    this.name      = 'Cosmos';
    this._onResize = null;
  }

  init(_scene) {
    this.canvas2d = document.getElementById('canvas-2d');
    this.canvas2d.style.display = 'block';
    this._resize();
    this.ctx = this.canvas2d.getContext('2d');
    // Pre-populate with random depths so the field looks full immediately
    this.stars = Array.from({ length: NUM_STARS }, () => new Star(true));
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    if (!this.canvas2d) return;
    this.canvas2d.width  = window.innerWidth;
    this.canvas2d.height = window.innerHeight;
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { waveform, frequencies } = audioData;
    const ctx  = this.ctx;
    const w    = this.canvas2d.width;
    const h    = this.canvas2d.height;
    const cx   = w / 2, cy = h / 2;
    const pal  = PALETTES[settings.palette] ?? PALETTES[0];
    const bloom = settings.bloomStrength;
    const sens  = settings.sensitivity;
    const scale = Math.min(w, h) * 0.55; // perspective projection scale

    // Average frequency (0–255 space, sensitivity-scaled)
    let sum = 0;
    for (let i = 0; i < frequencies.length; i++) sum += frequencies[i];
    const avg        = Math.min(255, (sum / frequencies.length) * sens);
    const highEnergy = avg > 140;

    // ── Speed: calm baseline, energy drift, beat surge ────────────────
    const baseSpeed  = 0.003 * settings.speed;
    const audioSpeed = (avg / 255) * 0.006 * settings.speed;
    if (beatData.beat) this.surge += beatData.intensity * 0.055 * settings.speed;
    this.surge *= 0.92; // exponential decay back to calm
    const speed = baseSpeed + audioSpeed + this.surge;

    // Ring rotation flips direction on high energy
    this.rotDir   = highEnergy ? -1 : 1;
    this.rotation += this.rotDir * 0.002 * settings.speed;

    // ── Background ────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0,   pal.bg[0]);
    bg.addColorStop(0.5, pal.bg[1]);
    bg.addColorStop(1,   pal.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Stars ─────────────────────────────────────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const star of this.stars) {
      star.update(speed);
      if (star.isOffScreen(cx, cy, scale)) {
        star.init(false); // respawn at center
        continue;
      }
      const rgb = highEnergy
        ? pal.starBeat
        : star.secondary ? pal.starB : pal.starA;
      star.draw(ctx, cx, cy, scale, rgb, highEnergy);
    }

    ctx.restore();

    // ── Waveform ring ─────────────────────────────────────────────────
    const baseR = Math.min(w, h) * 0.28;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    const wavePoints = [];
    for (let i = 0; i < WAVEFORM_POINTS; i++) {
      const srcIdx = Math.floor(i * waveform.length / WAVEFORM_POINTS);
      const amp    = ((waveform[srcIdx] - 128) / 128) * sens;
      const angle  = (i / WAVEFORM_POINTS) * Math.PI * 2;
      const rr     = baseR + amp * baseR * 0.3 * settings.intensity;
      wavePoints.push({ x: Math.cos(angle) * rr, y: Math.sin(angle) * rr });
    }

    const [wr, wg, wb] = pal.wave;
    const waveAlpha  = Math.min(0.9, 0.15 + (avg / 255) * 0.75);
    const waveColor  = `rgba(${wr},${wg},${wb},${waveAlpha})`;

    drawRing(ctx, wavePoints);
    ctx.fillStyle   = 'rgba(2,10,30,0.08)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 18;
    ctx.shadowColor = pal.waveShadow;
    ctx.strokeStyle = waveColor;
    ctx.lineWidth   = 1 + bloom * 0.3;
    ctx.stroke();
    ctx.restore();

    // ── Frequency ring ────────────────────────────────────────────────
    const freqR = baseR * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.rotation * 0.7);

    const freqPoints = [];
    for (let i = 0; i < FREQ_POINTS; i++) {
      const srcIdx = Math.floor(i * (frequencies.length * 0.5) / FREQ_POINTS);
      const amp    = Math.min(1, (frequencies[srcIdx] / 255) * sens);
      const angle  = (i / FREQ_POINTS) * Math.PI * 2;
      const rr     = freqR + amp * freqR * 0.6 * settings.intensity;
      freqPoints.push({ x: Math.cos(angle) * rr, y: Math.sin(angle) * rr });
    }

    drawRing(ctx, freqPoints);
    ctx.fillStyle   = 'rgba(2,10,30,0.12)';
    ctx.fill();
    ctx.shadowBlur  = bloom * 14;
    ctx.shadowColor = pal.freqShadow;
    ctx.strokeStyle = pal.freq;
    ctx.lineWidth   = 1.5 + bloom * 0.3;
    ctx.stroke();
    ctx.restore();
  }

  dispose(_scene) {
    if (this._onResize) window.removeEventListener('resize', this._onResize);
    if (this.canvas2d) {
      this.canvas2d.style.display = 'none';
      if (this.ctx) this.ctx.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);
    }
    this.stars = [];
    this.ctx = null;
    this.canvas2d = null;
  }
}
