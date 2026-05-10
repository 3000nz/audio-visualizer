const NUM_STARS = 1500;
const MAX_DEPTH = 4;
const WAVEFORM_POINTS = 512;
const FREQ_POINTS = 64;

// Per-palette color themes
const PALETTES = [
  { // 0 — Neon (original deep-space)
    bg: ['#000011', '#060D1F', '#02243F'],
    starA: '#465677', starB: '#B5BFD4', starBeat: '#F451BA',
    wave: [157, 242, 157], waveShadow: '#9DF29D',
    freq: 'rgba(77, 218, 248, 1)', freqShadow: '#4DDAF8',
  },
  { // 1 — Fire
    bg: ['#110000', '#1F0600', '#3F1200'],
    starA: '#774646', starB: '#D4B5A0', starBeat: '#FFD050',
    wave: [255, 140, 40], waveShadow: '#FF8C28',
    freq: 'rgba(255, 220, 60, 1)', freqShadow: '#FFDC3C',
  },
  { // 2 — Deep Space (purple)
    bg: ['#08000F', '#12001F', '#1E003F'],
    starA: '#4A3A77', starB: '#B0A8D4', starBeat: '#50E0FF',
    wave: [157, 140, 242], waveShadow: '#9D8CF2',
    freq: 'rgba(180, 70, 255, 1)', freqShadow: '#B446FF',
  },
  { // 3 — Mono
    bg: ['#000000', '#080808', '#101010'],
    starA: '#333333', starB: '#777777', starBeat: '#CCCCCC',
    wave: [200, 200, 200], waveShadow: '#C8C8C8',
    freq: 'rgba(255, 255, 255, 0.9)', freqShadow: '#FFFFFF',
  },
];

class Star {
  constructor(w, h) { this.init(w, h); }

  init(w, h) {
    this.x = (Math.random() - 0.5) * w;
    this.y = (Math.random() - 0.5) * h;
    this.z = Math.random() * MAX_DEPTH;
    this.dx = (Math.random() - 0.5) * 0.1;
    this.dy = (Math.random() - 0.5) * 0.1;
    this.ddx = (Math.random() - 0.5) * 0.001;
    this.ddy = (Math.random() - 0.5) * 0.001;
    this.secondary = Math.random() < 0.3;
  }

  update(w, h, d) {
    this.dx += this.ddx;
    this.dy += this.ddy;
    this.x += this.dx * d;
    this.y += this.dy * d;
    if (Math.abs(this.x) > w / 2 + 10 || Math.abs(this.y) > h / 2 + 10) this.init(w, h);
  }
}

function drawRing(ctx, points) {
  const N = points.length;
  ctx.beginPath();
  ctx.moveTo((points[0].x + points[N - 1].x) / 2, (points[0].y + points[N - 1].y) / 2);
  for (let i = 0; i < N; i++) {
    const curr = points[i];
    const next = points[(i + 1) % N];
    ctx.quadraticCurveTo(curr.x, curr.y, (curr.x + next.x) / 2, (curr.y + next.y) / 2);
  }
  ctx.closePath();
}

export class CosmosMode {
  constructor() {
    this.canvas2d = null;
    this.ctx = null;
    this.stars = [];
    this.rotation = 0;
    this.rotDir = 1;
    this.name = 'Cosmos';
    this._onResize = null;
  }

  init(_scene) {
    this.canvas2d = document.getElementById('canvas-2d');
    this.canvas2d.style.display = 'block';
    this._resize();
    this.ctx = this.canvas2d.getContext('2d');
    const { width: w, height: h } = this.canvas2d;
    this.stars = Array.from({ length: NUM_STARS }, () => new Star(w, h));
    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    if (!this.canvas2d) return;
    this.canvas2d.width = window.innerWidth;
    this.canvas2d.height = window.innerHeight;
  }

  update(_scene, audioData, _beatData, _clock, settings) {
    const { waveform, frequencies } = audioData;
    const ctx = this.ctx;
    const w = this.canvas2d.width, h = this.canvas2d.height;
    const cx = w / 2, cy = h / 2;
    const pal = PALETTES[settings.palette] ?? PALETTES[0];
    const bloom = settings.bloomStrength;
    const sens = settings.sensitivity;

    // Average frequency scaled by sensitivity (kept in 0–255 space for original thresholds)
    let sum = 0;
    for (let i = 0; i < frequencies.length; i++) sum += frequencies[i];
    const avg = Math.min(255, (sum / frequencies.length) * sens);
    const highEnergy = avg > 140;

    const d = (highEnergy ? avg / 20 : avg / 50) * settings.speed;
    this.rotDir = highEnergy ? -1 : 1;
    this.rotation += this.rotDir * 0.002 * settings.speed;

    // ── Background ────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0,   pal.bg[0]);
    bg.addColorStop(0.5, pal.bg[1]);
    bg.addColorStop(1,   pal.bg[2]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Stars — batched by color for performance ──────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (const star of this.stars) star.update(w, h, d);

    const drawStarBatch = (color, filter) => {
      ctx.fillStyle = color;
      for (const star of this.stars) {
        if (!filter(star)) continue;
        const r = 0.2 + 0.1 * (MAX_DEPTH - star.z);
        ctx.beginPath();
        ctx.arc(cx + star.x, cy + star.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (highEnergy) {
      drawStarBatch(pal.starBeat, () => true);
    } else {
      drawStarBatch(pal.starA, s => !s.secondary);
      drawStarBatch(pal.starB, s => s.secondary);
    }
    ctx.restore();

    // ── Waveform ring (time-domain, 512 pts) ─────────────────────────
    const baseR = Math.min(w, h) * 0.28;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    const wavePoints = [];
    for (let i = 0; i < WAVEFORM_POINTS; i++) {
      const srcIdx = Math.floor(i * waveform.length / WAVEFORM_POINTS);
      // Sensitivity scales the displacement amplitude
      const amp = ((waveform[srcIdx] - 128) / 128) * sens;
      const angle = (i / WAVEFORM_POINTS) * Math.PI * 2;
      const r = baseR + amp * baseR * 0.3 * settings.intensity;
      wavePoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    const [wr, wg, wb] = pal.wave;
    const waveAlpha = Math.min(0.9, 0.15 + (avg / 255) * 0.75);
    const waveColor = `rgba(${wr}, ${wg}, ${wb}, ${waveAlpha})`;

    drawRing(ctx, wavePoints);
    ctx.fillStyle = 'rgba(2, 10, 30, 0.08)';
    ctx.fill();
    ctx.shadowBlur = bloom * 18;
    ctx.shadowColor = pal.waveShadow;
    ctx.strokeStyle = waveColor;
    ctx.lineWidth = 1 + bloom * 0.3;
    ctx.stroke();
    ctx.restore();

    // ── Frequency ring (freq-domain, 64 pts) ─────────────────────────
    const freqR = baseR * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.rotation * 0.7);

    const freqPoints = [];
    for (let i = 0; i < FREQ_POINTS; i++) {
      const srcIdx = Math.floor(i * (frequencies.length * 0.5) / FREQ_POINTS);
      const amp = Math.min(1, (frequencies[srcIdx] / 255) * sens);
      const angle = (i / FREQ_POINTS) * Math.PI * 2;
      const r = freqR + amp * freqR * 0.6 * settings.intensity;
      freqPoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    drawRing(ctx, freqPoints);
    ctx.fillStyle = 'rgba(2, 10, 30, 0.12)';
    ctx.fill();
    ctx.shadowBlur = bloom * 14;
    ctx.shadowColor = pal.freqShadow;
    ctx.strokeStyle = pal.freq;
    ctx.lineWidth = 1.5 + bloom * 0.3;
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
