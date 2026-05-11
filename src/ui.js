export class UI {
  constructor() {
    this.settings = {
      sensitivity: 3.0,
      bloomStrength: 3.0,
      speed: 2.5,
      intensity: 3.0,
      palette: 0,
      autoColor: false,
      ringSize: 46,
      ringBrightness: 3.0,
    };
    this.visible = true;
    this._onSourceChange = null;
    this._onModeChange = null;
  }

  init({ onSourceChange, onModeChange, onModeNameChange }) {
    this._onSourceChange = onSourceChange;
    this._onModeChange = onModeChange;

    this._panel = document.getElementById('panel');
    this._modeLabel = document.getElementById('mode-name');

    // Mode buttons
    document.getElementById('prev-mode').addEventListener('click', () => {
      onModeNameChange(onModeChange('prev'));
    });
    document.getElementById('next-mode').addEventListener('click', () => {
      onModeNameChange(onModeChange('next'));
    });

    // Source toggle
    const srcMic = document.getElementById('src-mic');
    const srcSys = document.getElementById('src-system');
    srcMic.addEventListener('click', () => {
      srcMic.classList.add('active');
      srcSys.classList.remove('active');
      onSourceChange('mic');
    });
    srcSys.addEventListener('click', () => {
      srcSys.classList.add('active');
      srcMic.classList.remove('active');
      onSourceChange('system');
    });

    // Palette buttons
    document.querySelectorAll('.palette-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.settings.palette = parseInt(btn.dataset.palette, 10);
      });
    });

    // Auto Color toggle
    const autoColorBtn = document.getElementById('auto-color-btn');
    if (autoColorBtn) {
      autoColorBtn.addEventListener('click', () => {
        this.settings.autoColor = !this.settings.autoColor;
        autoColorBtn.classList.toggle('active', this.settings.autoColor);
        document.querySelectorAll('.palette-btn').forEach(b => {
          b.style.opacity = this.settings.autoColor ? '0.4' : '';
          b.style.pointerEvents = this.settings.autoColor ? 'none' : '';
        });
      });
    }

    // Sensitivity — display value 1–N; actual = display / 100 * 3
    // Boost buttons multiply the slider max (2× → max 200, etc.)
    const sensSlider = document.getElementById('sl-sensitivity');
    const sensVal    = document.getElementById('val-sensitivity');
    const updateSens = () => {
      const v = parseFloat(sensSlider.value);
      this.settings.sensitivity = v / 100 * 3;
      sensVal.textContent = Math.round(v) + '';
    };
    sensSlider.addEventListener('input', updateSens);

    document.querySelectorAll('.boost-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const boost = parseInt(btn.dataset.boost, 10);
        sensSlider.max = boost * 100;
        // Clamp value if it now exceeds new max (shouldn't happen going up, but going down)
        if (parseFloat(sensSlider.value) > boost * 100) sensSlider.value = boost * 100;
        updateSens();
        document.querySelectorAll('.boost-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

    this._bindSlider('sl-bloom',     'val-bloom',     'bloomStrength', v => v.toFixed(1));
    this._bindSlider('sl-speed',     'val-speed',     'speed',        v => v.toFixed(1) + '×');
    this._bindSlider('sl-intensity', 'val-intensity', 'intensity',    v => v.toFixed(1) + '×');
    this._bindSlider('sl-ringsize',      'val-ringsize',      'ringSize',      v => (v >= 0 ? '+' : '') + Math.round(v));
    this._bindSlider('sl-ringbrightness','val-ringbrightness','ringBrightness',v => v.toFixed(1) + '×');

    // Toggle panel button
    document.getElementById('toggle-panel').addEventListener('click', () => this.toggle());

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === 'H') this.toggle();
      if (e.key === 'm' || e.key === 'M') onModeNameChange(onModeChange('next'));
    });
  }

  _bindSlider(sliderId, valId, key, fmt) {
    const slider = document.getElementById(sliderId);
    const label  = document.getElementById(valId);
    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      this.settings[key] = v;
      label.textContent = fmt(v);
    });
  }

  setModeName(name) {
    if (this._modeLabel) this._modeLabel.textContent = name;
    const isCosmos = name === 'Cosmos';
    document.querySelectorAll('.cosmos-only').forEach(el => {
      el.style.display = isCosmos ? '' : 'none';
    });
  }

  toggle() {
    this.visible = !this.visible;
    this._panel.classList.toggle('hidden', !this.visible);
    const label = document.querySelector('.toggle-panel-label');
    if (label) label.textContent = this.visible ? 'Hide' : 'Show';
  }
}
