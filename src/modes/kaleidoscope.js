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

// 2D rotation
vec2 rot(vec2 p, float a) {
  float c = cos(a), s = sin(a);
  return vec2(p.x*c - p.y*s, p.x*s + p.y*c);
}

// Value hash
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1,0)), u.x),
    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv.x *= aspect;

  // Polar coordinates
  float r = length(uv);
  float theta = atan(uv.y, uv.x);

  // 8-fold kaleidoscope symmetry
  float segments = 8.0;
  float segAngle = 2.0 * 3.14159265 / segments;
  theta = mod(theta, segAngle);
  theta = abs(theta - segAngle * 0.5);

  // Reconstruct Cartesian after symmetry fold
  uv = vec2(cos(theta), sin(theta)) * r;

  float t = time * speed;

  // Concentric ring pattern driven by bass
  float ring = sin(r * 6.0 - t * 1.5 + bass * 6.28) * (0.5 + bass * 0.5);

  // Rotating arms driven by mid
  float arm  = sin(theta * 3.0 + t * 0.8 + mid * 3.14) * mid;

  // Fine texture from treble
  float tex  = noise(uv * (3.0 + treble * 4.0) + t * 0.3) * treble;

  // Interference pattern
  float wave = sin(uv.x * 4.0 + t) * cos(uv.y * 4.0 - t * 0.7);

  float pattern = (ring + arm + tex * 0.5 + wave * 0.3) * intensity;
  float brightness = 0.3 + 0.5 * (pattern * 0.5 + 0.5) + beatIntensity * 0.35;

  // Radial vignette — brighten center on bass hits
  float vignette = 1.0 - smoothstep(0.4, 1.8, r) * 0.6;
  brightness *= vignette;
  brightness += bass * 0.15;

  float sat = 0.85 + energy * 0.15;
  float finalHue = hue + pattern * 0.12;

  vec3 col = applyPalette(finalHue, sat, clamp(brightness, 0.0, 1.0), palette);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class KaleidoscopeMode {
  constructor() {
    this.mesh = null;
    this.material = null;
    this.hue = 0;
    this.name = 'Kaleidoscope';
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

    this.hue += 0.0006 + energy * 0.007;
    if (beatData.beat) this.hue += 0.06 * intensity;

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
