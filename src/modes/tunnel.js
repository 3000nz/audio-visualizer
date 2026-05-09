import * as THREE from 'three';
import { setColor } from '../colors.js';

const NUM_RINGS = 48;
const RING_SPACING = 2.2;
const TOTAL_DEPTH = NUM_RINGS * RING_SPACING;
const NEAR_Z = 4.5;     // just in front of camera (camera at z=6)
const FAR_Z = NEAR_Z - TOTAL_DEPTH;

export class TunnelMode {
  constructor() {
    this.rings = [];
    this.hue = 0;
    this.velocity = 0.06;
    this.name = 'Tunnel';
    this._color = new THREE.Color();
  }

  init(scene) {
    for (let i = 0; i < NUM_RINGS; i++) {
      const geo = new THREE.TorusGeometry(2.2, 0.04, 8, 80);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = NEAR_Z - i * RING_SPACING;
      mesh.rotation.z = Math.random() * Math.PI * 2;
      scene.add(mesh);
      this.rings.push({ mesh, spin: (Math.random() - 0.5) * 0.003 });
    }
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { frequencies, bass, energy } = audioData;
    const { beat, intensity } = beatData;

    this.hue += 0.0007 + energy * 0.006;

    // Bass hit kicks speed
    if (beat) this.velocity += intensity * 0.25 * settings.speed;
    // Drag toward base speed
    const baseSpeed = 0.06 * settings.speed;
    this.velocity += (baseSpeed - this.velocity) * 0.04;
    this.velocity = Math.max(baseSpeed * 0.3, this.velocity);

    for (let i = 0; i < NUM_RINGS; i++) {
      const { mesh, spin } = this.rings[i];

      // Advance ring toward camera
      mesh.position.z += this.velocity;
      if (mesh.position.z > NEAR_Z) {
        mesh.position.z -= TOTAL_DEPTH;
      }

      // Scale pulse from frequency band
      const freqIdx = Math.floor((i / NUM_RINGS) * 64);
      const amp = frequencies[freqIdx] / 255;
      const baseScale = 1 + amp * 0.9 * settings.intensity;
      const beatScale = 1 + intensity * 0.4;
      const depthFade = 1 - Math.max(0, (NEAR_Z - mesh.position.z) / TOTAL_DEPTH);
      mesh.scale.setScalar(baseScale * beatScale * (0.4 + depthFade * 0.6));

      // Hue shift per ring
      const h = (this.hue + i / NUM_RINGS * 0.4) % 1;
      const lit = 0.4 + amp * 0.5 + intensity * 0.2;
      setColor(this._color, h, 1.0, Math.min(1, lit), settings.palette);
      mesh.material.color.copy(this._color);

      mesh.rotation.z += spin + energy * 0.01;
    }
  }

  dispose(scene) {
    this.rings.forEach(({ mesh }) => {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    });
    this.rings = [];
  }
}
