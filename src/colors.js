import * as THREE from 'three';

const _color = new THREE.Color();

/**
 * Apply palette-aware HSL to a THREE.Color.
 * palette: 0=neon, 1=fire, 2=space, 3=mono
 */
export function setColor(target, hue, sat, lit, palette) {
  switch (palette) {
    case 1: // Fire — reds / oranges / yellows
      target.setHSL((hue * 0.12) % 1, sat, lit);
      break;
    case 2: // Deep space — blues / purples
      target.setHSL((0.55 + hue * 0.22) % 1, sat * 0.9, lit * 0.85);
      break;
    case 3: // Mono — grayscale
      target.setHSL(0, 0, lit);
      break;
    default: // Neon — full rainbow
      target.setHSL(hue % 1, sat, lit);
  }
}

/**
 * Return GLSL snippet that computes palette-adjusted hue.
 * Consumed by shader modes as an injected #define block.
 */
export function paletteGLSL() {
  return /* glsl */`
vec3 applyPalette(float rawHue, float sat, float lit, int palette) {
  float h;
  float s = sat;
  float l = lit;
  if (palette == 1) {
    h = mod(rawHue * 0.12, 1.0);
  } else if (palette == 2) {
    h = mod(0.55 + rawHue * 0.22, 1.0);
    s *= 0.9; l *= 0.85;
  } else if (palette == 3) {
    h = 0.0; s = 0.0;
  } else {
    h = mod(rawHue, 1.0);
  }
  // HSL → RGB
  vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
`;
}
