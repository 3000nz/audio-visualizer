import './style.css';
import * as THREE from 'three';
import { AudioManager } from './audio.js';
import { BeatDetector } from './beat.js';
import { createScene } from './scene.js';
import { UI } from './ui.js';
import { ModeManager } from './modes/index.js';

// ---- Three.js setup ----
const canvas = document.getElementById('canvas');
const { scene, camera, composer, bloom } = createScene(canvas);
const clock = new THREE.Clock();

// ---- Audio ----
const audio = new AudioManager();
const beat = new BeatDetector();

// ---- Visualization modes ----
const modes = new ModeManager();
modes.init(scene);

// ---- UI ----
const ui = new UI();
ui.init({
  onSourceChange: async (sourceType) => {
    try {
      await audio.init(sourceType);
    } catch (err) {
      console.error('Audio init failed:', err);
      alert(`Could not access audio: ${err.message}`);
    }
  },
  onModeChange: (dir) => {
    const name = dir === 'prev' ? modes.prev() : modes.next();
    ui.setModeName(name);
    return name;
  },
  onModeNameChange: () => {},
});
ui.setModeName(modes.getName());

// ---- Start overlay ----
const overlay = document.getElementById('overlay');

async function startWith(sourceType) {
  try {
    await audio.init(sourceType);
    overlay.classList.add('gone');
    // Sync UI source buttons
    const srcMic = document.getElementById('src-mic');
    const srcSys = document.getElementById('src-system');
    if (sourceType === 'mic') {
      srcMic.classList.add('active'); srcSys.classList.remove('active');
    } else {
      srcSys.classList.add('active'); srcMic.classList.remove('active');
    }
  } catch (err) {
    console.error('Failed to start:', err);
    alert(`Could not access audio: ${err.message}`);
  }
}

document.getElementById('btn-mic').addEventListener('click', () => startWith('mic'));
document.getElementById('btn-system').addEventListener('click', () => startWith('system'));

// ---- Camera slow orbit for 3D modes ----
let camAngle = 0;

// ---- Render loop ----
function animate() {
  requestAnimationFrame(animate);

  const settings = ui.settings;
  bloom.strength = settings.bloomStrength;

  const audioData = audio.active
    ? audio.getAudioData(settings.sensitivity)
    : { frequencies: new Uint8Array(1024), waveform: new Uint8Array(2048), bass: 0, mid: 0, treble: 0, energy: 0 };

  const beatData = beat.update(audioData.bass);

  // Subtle camera sway for 3D modes (bars, tunnel, particles)
  const modeName = modes.getName();
  if (modeName === 'Radial Bars' || modeName === 'Tunnel') {
    camAngle += 0.0003 * settings.speed + audioData.energy * 0.0008;
    camera.position.x = Math.sin(camAngle) * 0.8;
    camera.position.y = Math.cos(camAngle * 0.7) * 0.4 + audioData.bass * 0.3;
    camera.lookAt(0, 0, 0);
  } else if (modeName === 'Particles') {
    camAngle += 0.0005 * settings.speed;
    camera.position.x = Math.sin(camAngle) * 0.5;
    camera.position.y = Math.cos(camAngle * 0.6) * 0.3;
    camera.lookAt(0, 0, 0);
  } else {
    // Shader modes — reset camera
    camera.position.set(0, 0, 6);
    camera.lookAt(0, 0, 0);
  }

  modes.update(scene, audioData, beatData, clock, settings);
  composer.render();
}

animate();
