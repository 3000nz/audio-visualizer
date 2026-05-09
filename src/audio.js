export class AudioManager {
  constructor() {
    this.context = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.fftSize = 2048;
    this.frequencies = new Uint8Array(this.fftSize / 2);
    this.waveform = new Uint8Array(this.fftSize);
    this.sourceType = 'mic';
    this.active = false;
  }

  async init(sourceType = 'mic') {
    this.dispose();
    this.sourceType = sourceType;
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -90;
    this.analyser.maxDecibels = -10;

    if (sourceType === 'mic') {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } else {
      // Request display media with minimal video; stop video tracks after getting audio
      this.stream = await navigator.mediaDevices.getDisplayMedia({
        audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 },
        video: { width: 1, height: 1 },
      });
      // Stop video tracks immediately — we only want audio
      this.stream.getVideoTracks().forEach(t => t.stop());
    }

    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length === 0) throw new Error('No audio track in stream.');

    this.source = this.context.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    this.active = true;
  }

  getAudioData(sensitivity = 1.5) {
    if (!this.analyser) return this._silent();

    this.analyser.getByteFrequencyData(this.frequencies);
    this.analyser.getByteTimeDomainData(this.waveform);

    // Bin resolution: sampleRate / fftSize ≈ 21.5 Hz/bin at 44100 Hz
    const bassEnd = 7;    // ~20–150 Hz
    const midEnd = 90;    // ~150–1935 Hz
    const highEnd = 372;  // ~1935–8000 Hz

    let bassSum = 0, midSum = 0, highSum = 0;
    for (let i = 1; i <= bassEnd; i++) bassSum += this.frequencies[i];
    for (let i = bassEnd + 1; i <= midEnd; i++) midSum += this.frequencies[i];
    for (let i = midEnd + 1; i <= highEnd; i++) highSum += this.frequencies[i];

    const s = sensitivity;
    const bass = Math.min(1, bassSum / bassEnd / 255 * s);
    const mid = Math.min(1, midSum / (midEnd - bassEnd) / 255 * s);
    const treble = Math.min(1, highSum / (highEnd - midEnd) / 255 * s);
    const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

    return { frequencies: this.frequencies, waveform: this.waveform, bass, mid, treble, energy };
  }

  _silent() {
    return {
      frequencies: this.frequencies,
      waveform: this.waveform,
      bass: 0, mid: 0, treble: 0, energy: 0,
    };
  }

  dispose() {
    this.active = false;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.source) { this.source.disconnect(); this.source = null; }
    if (this.context) { this.context.close(); this.context = null; }
    this.analyser = null;
  }
}
