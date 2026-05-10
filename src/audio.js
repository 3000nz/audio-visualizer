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
      this.stream = await this._getMicStream();
    } else {
      this.stream = await this._getSystemStream();
    }

    const audioTracks = this.stream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error(
        'No audio track was captured. ' +
        'For system audio, tick "Share audio" (or "Share tab audio") in the browser dialog.'
      );
    }

    this.source = this.context.createMediaStreamSource(this.stream);
    this.source.connect(this.analyser);
    this.active = true;
  }

  async _getMicStream() {
    // getUserMedia is only available in secure contexts (HTTPS / localhost)
    if (!window.isSecureContext) {
      throw new Error(
        'Microphone access requires HTTPS. ' +
        'Make sure your site is served over https:// and try again.'
      );
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(
        'Your browser does not support microphone access. ' +
        'Try the latest version of Chrome, Firefox, or Safari.'
      );
    }
    try {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (err) {
      throw new Error(this._micError(err));
    }
  }

  async _getSystemStream() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      throw new Error(
        'System audio capture is not supported in this browser. ' +
        'Try Chrome or Edge on desktop.'
      );
    }
    let stream;
    try {
      // Use plain { audio: true } — avoid advanced constraints (sampleRate etc.)
      // that cause "Requested device not found" on many systems.
      stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
    } catch (err) {
      throw new Error(this._systemError(err));
    }
    // Drop the video track — we only needed it to satisfy the getDisplayMedia API.
    stream.getVideoTracks().forEach(t => t.stop());
    return stream;
  }

  _micError(err) {
    switch (err.name) {
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        // NotFoundError fires both when no device exists AND when the OS
        // privacy settings block the browser from seeing the device.
        return (
          'Microphone not found or blocked by your OS. ' +
          'Check: macOS → System Settings → Privacy → Microphone, ' +
          'or Windows → Settings → Privacy → Microphone — ' +
          'make sure your browser is allowed.'
        );
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Microphone access was denied. Click the lock icon in the address bar and allow microphone access, then reload.';
      case 'NotReadableError':
      case 'TrackStartError':
        return 'Your microphone is in use by another application. Close it and try again.';
      default:
        return `Microphone error: ${err.message}`;
    }
  }

  _systemError(err) {
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'Screen share was cancelled or denied. Click "System Audio" again and allow sharing.';
      case 'NotFoundError':
        return 'No shareable audio source was found. Make sure your OS has an audio output device.';
      case 'AbortError':
        return 'Screen share was closed before audio could be captured. Try again.';
      default:
        return `System audio error: ${err.message}`;
    }
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
    const bass   = Math.min(1, bassSum / bassEnd / 255 * s);
    const mid    = Math.min(1, midSum / (midEnd - bassEnd) / 255 * s);
    const treble = Math.min(1, highSum / (highEnd - midEnd) / 255 * s);
    const energy = bass * 0.5 + mid * 0.3 + treble * 0.2;

    return { frequencies: this.frequencies, waveform: this.waveform, bass, mid, treble, energy };
  }

  _silent() {
    return { frequencies: this.frequencies, waveform: this.waveform, bass: 0, mid: 0, treble: 0, energy: 0 };
  }

  dispose() {
    this.active = false;
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    if (this.source) { this.source.disconnect(); this.source = null; }
    if (this.context) { this.context.close(); this.context = null; }
    this.analyser = null;
  }
}
