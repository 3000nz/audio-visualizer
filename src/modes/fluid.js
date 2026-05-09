import * as THREE from 'three';
import { paletteGLSL } from '../colors.js';

const vertexShader = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.999, 1.0);
}
`;

const fragmentShader = /* glsl */`
precision highp float;
uniform float time;
uniform float bass;
uniform float mid;
uniform float treble;
uniform float energy;
uniform float hue;
uniform float speed;
uniform float intensity;
uniform float beatIntensity;
uniform float aspect;
uniform int palette;
varying vec2 vUv;

${paletteGLSL()}

// --- Gradient noise (Inigo Quilez) ---
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(dot(hash2(i + vec2(0,0)), f - vec2(0,0)),
        dot(hash2(i + vec2(1,0)), f - vec2(1,0)), u.x),
    mix(dot(hash2(i + vec2(0,1)), f - vec2(0,1)),
        dot(hash2(i + vec2(1,1)), f - vec2(1,1)), u.x), u.y);
}

// Fractal Brownian Motion
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * gnoise(p);
    p = p * 2.0 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

// Domain-warped fbm — gives fluid, organic look
float warpedFbm(vec2 p, float warp) {
  vec2 q = vec2(fbm(p), fbm(p + vec2(1.7, 9.2)));
  vec2 r = vec2(fbm(p + warp * q + vec2(1.7, 9.2)),
                fbm(p + warp * q + vec2(8.3, 2.8)));
  return fbm(p + warp * r);
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= aspect;

  float t = time * speed * 0.25;

  // Audio drives warp amount and detail scale
  float warpAmount = 1.5 + bass * 2.5 * intensity + beatIntensity * 1.5;
  float scale = 1.2 + mid * 0.8;

  float f = warpedFbm(uv * scale + vec2(t * 0.3, t * 0.2), warpAmount);

  // Map to brightness
  float brightness = f * 0.5 + 0.5;
  brightness = pow(brightness, 1.0 - energy * 0.4); // gamma squeeze on loud
  brightness *= intensity;
  brightness = clamp(brightness + beatIntensity * 0.2, 0.0, 1.0);

  // Hue shifts with the fluid contour
  float sat = 0.85 + treble * 0.15;
  float finalHue = hue + f * 0.2 + mid * 0.1;

  vec3 col = applyPalette(finalHue, sat, brightness, palette);

  // Extra glow on beat
  col += vec3(beatIntensity * 0.15);

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export class FluidMode {
  constructor() {
    this.mesh = null;
    this.material = null;
    this.hue = 0;
    this.name = 'Fluid';
  }

  init(scene) {
    const geo = new THREE.PlaneGeometry(2, 2);
    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        time:          { value: 0 },
        bass:          { value: 0 },
        mid:           { value: 0 },
        treble:        { value: 0 },
        energy:        { value: 0 },
        hue:           { value: 0 },
        speed:         { value: 1 },
        intensity:     { value: 1 },
        beatIntensity: { value: 0 },
        aspect:        { value: window.innerWidth / window.innerHeight },
        palette:       { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this._onResize = () => {
      this.material.uniforms.aspect.value = window.innerWidth / window.innerHeight;
    };
    window.addEventListener('resize', this._onResize);
  }

  update(_scene, audioData, beatData, clock, settings) {
    const { bass, mid, treble, energy } = audioData;
    const { intensity } = beatData;

    this.hue += 0.0005 + energy * 0.006;
    if (beatData.beat) this.hue += 0.05 * intensity;

    const u = this.material.uniforms;
    u.time.value = clock.getElapsedTime();
    u.bass.value = bass;
    u.mid.value = mid;
    u.treble.value = treble;
    u.energy.value = energy;
    u.hue.value = this.hue % 1;
    u.speed.value = settings.speed;
    u.intensity.value = settings.intensity;
    u.beatIntensity.value = intensity;
    u.palette.value = settings.palette;
  }

  dispose(scene) {
    window.removeEventListener('resize', this._onResize);
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.mesh = null;
    this.material = null;
  }
}
