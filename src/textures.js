import { CanvasTexture, SRGBColorSpace } from 'three';

export function rgba(hex, alpha) {
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

export function canvasTexture(size, draw) {
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

/** Thin-walled bubble: transparent body, bright ring and a small specular dot. Reads as a real water bubble. */
export function createRingBubbleTexture() {
  return canvasTexture(64, (ctx, s) => {
    const c = s / 2;
    const body = ctx.createRadialGradient(c, c, 0, c, c, c * 0.9);
    body.addColorStop(0, 'rgba(255,255,255,0.08)');
    body.addColorStop(0.72, 'rgba(255,255,255,0.18)');
    body.addColorStop(0.86, 'rgba(255,255,255,0.9)');
    body.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, s, s);
    const dot = ctx.createRadialGradient(s * 0.36, s * 0.34, 0, s * 0.36, s * 0.34, s * 0.14);
    dot.addColorStop(0, 'rgba(255,255,255,0.95)');
    dot.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = dot;
    ctx.fillRect(0, 0, s, s);
  });
}
