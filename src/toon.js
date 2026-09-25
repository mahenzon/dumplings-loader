import {
  BackSide,
  CanvasTexture,
  Color,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
} from 'three';

/** Stepped gradient for MeshToonMaterial. More levels → softer, less "cel" look. */
export function createGradientMap(levels = [0.46, 0.58, 0.7, 0.82, 0.92, 1]) {
  const data = new Uint8Array(levels.length * 4);
  levels.forEach((level, i) => {
    const v = Math.round(level * 255);
    data.set([v, v, v, 255], i * 4);
  });
  const texture = new DataTexture(data, levels.length, 1, RGBAFormat);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/** Inverted-hull outline: back faces pushed out along normals. Optional. */
export function createOutlineMaterial(color, thickness) {
  return new ShaderMaterial({
    side: BackSide,
    uniforms: {
      color: { value: new Color(color) },
      thickness: { value: thickness },
    },
    vertexShader: /* glsl */ `
      uniform float thickness;
      void main() {
        vec3 p = position + normalize(normal) * thickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      void main() {
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });
}

function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function canvasTexture(size, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  draw(ctx, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Soft radial blob: opaque `color` in the centre fading to transparent. Used for shadows, steam, bubbles. */
export function createSoftTexture(hex = '#ffffff', { inner = 0, falloff = 1 } = {}) {
  return canvasTexture(128, (ctx, s) => {
    const c = s / 2;
    const gradient = ctx.createRadialGradient(c, c, inner * c, c, c, c);
    const stops = 8;
    for (let i = 0; i <= stops; i++) {
      const t = i / stops;
      gradient.addColorStop(t, rgba(hex, Math.pow(1 - t, falloff).toFixed(3)));
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Small bubble: soft body with a slightly brighter rim. */
export function createBubbleTexture() {
  return canvasTexture(64, (ctx, s) => {
    const c = s / 2;
    const gradient = ctx.createRadialGradient(c, c, 0, c, c, c * 0.9);
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.7, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(0.9, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, s, s);
  });
}

/** Water surface: milky broth with a gentle vignette and a soft reflection towards the light. */
export function createWaterTexture(centre, edge, highlight) {
  return canvasTexture(512, (ctx, s) => {
    const c = s / 2;
    const base = ctx.createRadialGradient(c, c, 0, c, c, c);
    base.addColorStop(0, centre);
    base.addColorStop(0.65, centre);
    base.addColorStop(1, edge);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);

    const glow = ctx.createRadialGradient(s * 0.36, s * 0.34, 0, s * 0.36, s * 0.34, s * 0.42);
    glow.addColorStop(0, rgba(highlight, 0.32));
    glow.addColorStop(1, rgba(highlight, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, s, s);
  });
}
