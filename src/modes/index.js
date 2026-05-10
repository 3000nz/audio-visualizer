import { BarsMode } from './bars.js';
import { ParticlesMode } from './particles.js';
import { KaleidoscopeMode } from './kaleidoscope.js';
import { TunnelMode } from './tunnel.js';
import { FluidMode } from './fluid.js';
import { CosmosMode } from './cosmos.js';

const MODES = [BarsMode, ParticlesMode, KaleidoscopeMode, TunnelMode, FluidMode, CosmosMode];

export class ModeManager {
  constructor() {
    this.current = null;
    this.index = 0;
    this.scene = null;
  }

  init(scene) {
    this.scene = scene;
    this._activate(0);
  }

  _activate(idx) {
    if (this.current) this.current.dispose(this.scene);
    this.index = ((idx % MODES.length) + MODES.length) % MODES.length;
    this.current = new MODES[this.index]();
    this.current.init(this.scene);
    return this.current.name;
  }

  next() { return this._activate(this.index + 1); }
  prev() { return this._activate(this.index - 1); }

  getName() { return this.current?.name ?? ''; }

  update(scene, audioData, beatData, clock, settings) {
    this.current?.update(scene, audioData, beatData, clock, settings);
  }
}
