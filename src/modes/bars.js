import * as THREE from 'three';
import { setColor } from '../colors.js';

const NUM_BARS = 128;

export class BarsMode {
  constructor() {
    this.mesh = null;
    this.dummy = new THREE.Object3D();
    this.hue = 0;
    this.color = new THREE.Color();
    this.name = 'Radial Bars';
  }

  init(scene) {
    const geo = new THREE.CylinderGeometry(0.08, 0.12, 1, 6);
    // Shift geometry so bottom is at y=0 — bars grow upward from the ring
    geo.translate(0, 0.5, 0);

    const mat = new THREE.MeshBasicMaterial();
    this.mesh = new THREE.InstancedMesh(geo, mat, NUM_BARS);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate instance color buffer
    const colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(NUM_BARS * 3), 3);
    this.mesh.instanceColor = colorAttr;
    scene.add(this.mesh);
  }

  update(_scene, audioData, beatData, _clock, settings) {
    const { frequencies, bass, energy } = audioData;
    const { intensity } = beatData;

    this.hue += 0.0008 + energy * 0.008;
    if (beatData.beat) this.hue += 0.04 * intensity;

    const radius = 3.5;

    for (let i = 0; i < NUM_BARS; i++) {
      const angle = (i / NUM_BARS) * Math.PI * 2;
      const freqIdx = Math.floor((i / NUM_BARS) * (frequencies.length * 0.75));
      const amp = frequencies[freqIdx] / 255;
      const height = Math.max(0.04, amp * 4.5 * settings.intensity + intensity * 0.6);

      this.dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      this.dummy.rotation.y = -angle;
      this.dummy.scale.set(1, height, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);

      const h = (this.hue + (i / NUM_BARS) * 0.35) % 1;
      const lit = 0.35 + amp * 0.45 + intensity * 0.25;
      setColor(this.color, h, 1.0, Math.min(1, lit), settings.palette);
      this.mesh.setColorAt(i, this.color);
    }

    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;

    // Gentle camera bob in sync with bass
    // handled in main.js via settings; modes just mutate scene objects
  }

  dispose(scene) {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh = null;
  }
}
