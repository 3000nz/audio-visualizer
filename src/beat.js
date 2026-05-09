export class BeatDetector {
  constructor() {
    // ~700 ms history at 60fps
    this.historyLen = 43;
    this.history = new Float32Array(this.historyLen);
    this.idx = 0;
    this.cooldown = 0;
    this.intensity = 0;
    this.beat = false;
  }

  update(bass) {
    this.history[this.idx] = bass;
    this.idx = (this.idx + 1) % this.historyLen;

    let avg = 0;
    for (let i = 0; i < this.historyLen; i++) avg += this.history[i];
    avg /= this.historyLen;

    this.cooldown = Math.max(0, this.cooldown - 1);

    const threshold = Math.max(0.12, avg * 1.45);
    this.beat = this.cooldown === 0 && bass > threshold;

    if (this.beat) {
      this.intensity = Math.min(1, bass / threshold);
      this.cooldown = 10; // ~160 ms lockout
    } else {
      this.intensity *= 0.88; // decay
    }

    return { beat: this.beat, intensity: this.intensity };
  }
}
