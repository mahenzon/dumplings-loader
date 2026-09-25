import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, RGBAFormat } from 'three';
import { canvasTexture, rgba } from './textures.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smooth = (t) => t * t * (3 - 2 * t);

/**
 * Tileable fractal value noise, `size` x `size`, values in [0, 1].
 * Each octave interpolates a wrapped lattice, so the result repeats seamlessly.
 */
export function createNoiseField(size, { octaves = 4, baseCells = 4, persistence = 0.5, seed = 1 } = {}) {
  const random = mulberry32(seed);
  const out = new Float32Array(size * size);
  let amplitude = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells * 2 ** o;
    const lattice = new Float32Array(cells * cells);
    for (let i = 0; i < lattice.length; i++) lattice[i] = random();
    const at = (x, y) => lattice[((y + cells) % cells) * cells + ((x + cells) % cells)];
    for (let y = 0; y < size; y++) {
      const fy = (y / size) * cells;
      const y0 = Math.floor(fy);
      const ty = smooth(fy - y0);
      for (let x = 0; x < size; x++) {
        const fx = (x / size) * cells;
        const x0 = Math.floor(fx);
        const tx = smooth(fx - x0);
        const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        out[y * size + x] += (top + (bottom - top) * ty) * amplitude;
      }
    }
    total += amplitude;
    amplitude *= persistence;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

/** Tangent-space normal map derived from a tileable height field. Wraps, so it can be scrolled. */
export function createNoiseNormalMap(size = 256, { strength = 2, ...noise } = {}) {
  const height = createNoiseField(size, noise);
  const data = new Uint8Array(size * size * 4);
  const h = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength * size * 0.02;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength * size * 0.02;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      data[i] = Math.round((-dx / len) * 127.5 + 127.5);
      data[i + 1] = Math.round((-dy / len) * 127.5 + 127.5);
      data[i + 2] = Math.round((1 / len) * 127.5 + 127.5);
      data[i + 3] = 255;
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function paintNoise(ctx, size, field, alpha) {
  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  for (let i = 0; i < size * size; i++) {
    const v = (field[i] - 0.5) * 255 * alpha;
    px[i * 4] = Math.max(0, Math.min(255, px[i * 4] + v));
    px[i * 4 + 1] = Math.max(0, Math.min(255, px[i * 4 + 1] + v));
    px[i * 4 + 2] = Math.max(0, Math.min(255, px[i * 4 + 2] + v));
  }
  ctx.putImageData(image, 0, 0);
}

/**
 * Milky broth surface: colour map (mottled, foam creeping in from the wall) and a matching alpha
 * map (the centre stays translucent so submerged pelmeni show through, the rim is opaque foam).
 */
export function createBrothMaps(centre, edge, { size = 512, centreAlpha = 0.58, edgeAlpha = 0.9 } = {}) {
  const mottle = createNoiseField(size, { octaves: 5, baseCells: 3, persistence: 0.55, seed: 7 });
  const colorMap = canvasTexture(size, (ctx, s) => {
    const c = s / 2;
    const base = ctx.createRadialGradient(c, c, 0, c, c, c);
    base.addColorStop(0, centre);
    base.addColorStop(0.5, centre);
    base.addColorStop(1, edge);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    paintNoise(ctx, s, mottle, 0.07);
    // Faint foam streaks near the wall.
    const foam = ctx.createRadialGradient(c, c, c * 0.8, c, c, c);
    foam.addColorStop(0, rgba('#ffffff', 0));
    foam.addColorStop(1, rgba('#ffffff', 0.35));
    ctx.fillStyle = foam;
    ctx.fillRect(0, 0, s, s);
  });
  const alphaMap = canvasTexture(size, (ctx, s) => {
    const c = s / 2;
    const toGrey = (a) => {
      const v = Math.round(a * 255);
      return `rgb(${v},${v},${v})`;
    };
    const base = ctx.createRadialGradient(c, c, 0, c, c, c);
    base.addColorStop(0, toGrey(centreAlpha));
    base.addColorStop(0.7, toGrey(centreAlpha + (edgeAlpha - centreAlpha) * 0.3));
    base.addColorStop(1, toGrey(edgeAlpha));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    paintNoise(ctx, s, mottle, 0.1);
  });
  return { colorMap, alphaMap };
}

/** Fine-grained dough surface for a bump map. */
export function createDoughBumpMap(size = 256) {
  const grain = createNoiseField(size, { octaves: 4, baseCells: 12, persistence: 0.6, seed: 3 });
  const texture = canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, s, s);
    paintNoise(ctx, s, grain, 0.9);
  });
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  return texture;
}
