const NUM_STARS = 1500;
const MAX_DEPTH = 4;
const WAVEFORM_POINTS = 512;
const FREQ_POINTS = 64;

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
    if (Math.abs(this.x) > w / 2 + 10 || Math.abs(this.y) > h / 2 + 10) {
      this.init(w, h);
    }
  }

  draw(ctx, cx, cy, highEnergy) {
    const r = 0.2 + 0.1 * (MAX_DEPTH - this.z);
    ctx.beginPath();
    ctx.arc(cx + this.x, cy + this.y, r, 0, Math.PI * 2);
    ctx.fillStyle = highEnergy ? '#F451BA' : (this.secondary ? '#B5BFD4' : '#465677');
    ctx.fill();
  }
}

function drawRing(ctx, points) {
  const N = points.length;
  const first = points[0];
  const last = points[N - 1];
  ctx.beginPath();
  ctx.moveTo((first.x + last.x) / 2, (first.y + last.y) / 2);
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

    const w = this.canvas2d.width, h = this.canvas2d.height;
    this.stars = Array.from({ length: NUM_STARS }, () => new Star(w, h));

    this._onResize = () => this._resize();
    window.addEventListener('resize', this._onResize);
  }

  _resize() {
    if (!this.canvas2d) return;
    this.canvas2d.width = window.innerWidth;
    this.canvas2d.height = window.innerHeight;
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { waveform, frequencies } = audioData;
    const ctx = this.ctx;
    const w = this.canvas2d.width;
    const h = this.canvas2d.height;
    const cx = w / 2, cy = h / 2;

    // Raw 0–255 average to preserve the original's threshold logic
    let sum = 0;
    for (let i = 0; i < frequencies.length; i++) sum += frequencies[i];
    const avg = sum / frequencies.length;
    const highEnergy = avg > 140;

    // Star movement multiplier — faithful to original (avg/20 or avg/50)
    const d = (highEnergy ? avg / 20 : avg / 50) * settings.speed;

    this.rotDir = highEnergy ? -1 : 1;
    this.rotation += this.rotDir * 0.002 * settings.speed;

    // ── Background gradient ─────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#000011');
    bg.addColorStop(0.5, '#060D1F');
    bg.addColorStop(1, '#02243F');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // ── Stars — additive blending for glow ─────────────────────────
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const star of this.stars) {
      star.update(w, h, d);
      star.draw(ctx, cx, cy, highEnergy);
    }
    ctx.restore();

    // ── Waveform ring (512 pts, time-domain) ───────────────────────
    const baseR = Math.min(w, h) * 0.28;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(this.rotation);

    const wavePoints = [];
    for (let i = 0; i < WAVEFORM_POINTS; i++) {
      const srcIdx = Math.floor(i * waveform.length / WAVEFORM_POINTS);
      const amp = (waveform[srcIdx] - 128) / 128;
      const angle = (i / WAVEFORM_POINTS) * Math.PI * 2;
      const r = baseR + amp * baseR * 0.3 * settings.intensity;
      wavePoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    const waveAlpha = Math.min(0.8, 0.11 + (avg / 255) * 0.7);
    drawRing(ctx, wavePoints);
    ctx.fillStyle = 'rgba(2, 10, 30, 0.1)';
    ctx.fill();
    ctx.strokeStyle = `rgba(157, 242, 157, ${waveAlpha})`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    // ── Average frequency ring (64 pts, frequency-domain) ──────────
    const freqR = baseR * 0.7;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-this.rotation * 0.7);

    const freqPoints = [];
    for (let i = 0; i < FREQ_POINTS; i++) {
      // Sample the lower half of the spectrum (most musical content)
      const srcIdx = Math.floor(i * (frequencies.length * 0.5) / FREQ_POINTS);
      const amp = frequencies[srcIdx] / 255;
      const angle = (i / FREQ_POINTS) * Math.PI * 2;
      const r = freqR + amp * freqR * 0.6 * settings.intensity;
      freqPoints.push({ x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    }

    drawRing(ctx, freqPoints);
    ctx.fillStyle = 'rgba(2, 10, 30, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(77, 218, 248, 1)';
    ctx.lineWidth = 1.5;
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
