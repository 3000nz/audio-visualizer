import * as THREE from 'three';
import { setColor } from '../colors.js';

const MAX_PARTICLES = 8000;

export class ParticlesMode {
  constructor() {
    this.geometry = null;
    this.material = null;
    this.points = null;
    this.pool = [];
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.hue = 0;
    this.name = 'Particles';
    this._c = new THREE.Color();
  }

  init(scene) {
    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setDrawRange(0, 0);

    this.material = new THREE.PointsMaterial({
      size: 0.07,
      vertexColors: true,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    scene.add(this.points);

    this.pool = Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0, y: 0, z: 0,
      vx: 0, vy: 0, vz: 0,
      life: 0, maxLife: 1,
      r: 1, g: 1, b: 1,
    }));
  }

  _spawn(count, energy, settings) {
    let spawned = 0;
    for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
      const p = this.pool[i];
      if (p.active) continue;

      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const speed = (0.015 + Math.random() * 0.07) * settings.speed * (1 + energy * 2);
      p.active = true;
      p.x = (Math.random() - 0.5) * 0.3;
      p.y = (Math.random() - 0.5) * 0.3;
      p.z = (Math.random() - 0.5) * 0.3;
      p.vx = Math.sin(phi) * Math.cos(theta) * speed;
      p.vy = Math.sin(phi) * Math.sin(theta) * speed;
      p.vz = Math.cos(phi) * speed;
      p.life = 1.0;
      p.maxLife = 0.6 + Math.random() * 2.0;

      const h = (this.hue + Math.random() * 0.25) % 1;
      setColor(this._c, h, 1.0, 0.6, settings.palette);
      p.r = this._c.r; p.g = this._c.g; p.b = this._c.b;
      spawned++;
    }
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { bass, energy } = audioData;
    const { beat, intensity } = beatData;

    this.hue += 0.001 + energy * 0.009;
    if (beat) {
      this.hue += 0.08 * intensity;
      this._spawn(Math.floor(120 * intensity * settings.intensity), energy, settings);
    }
    // Continuous ambient trickle
    if (energy > 0.05) {
      this._spawn(Math.ceil(energy * 8 * settings.intensity), energy, settings);
    }

    let alive = 0;
    const dt = 0.016;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt / p.maxLife;
      if (p.life <= 0) { p.active = false; continue; }

      p.x += p.vx;
      p.y += p.vy;
      p.z += p.vz;
      // Slight drag
      p.vx *= 0.992;
      p.vy *= 0.992;
      p.vz *= 0.992;

      const o = alive * 3;
      this.positions[o] = p.x;
      this.positions[o + 1] = p.y;
      this.positions[o + 2] = p.z;

      const fade = p.life * p.life; // quadratic fade
      this.colors[o] = p.r * fade;
      this.colors[o + 1] = p.g * fade;
      this.colors[o + 2] = p.b * fade;
      alive++;
    }

    this.geometry.setDrawRange(0, alive);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
  }

  dispose(scene) {
    scene.remove(this.points);
    this.geometry.dispose();
    this.material.dispose();
    this.points = null;
    this.geometry = null;
  }
}
