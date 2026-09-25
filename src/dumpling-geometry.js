import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Procedural cartoon pelmen (Russian dumpling).
 *
 * Built as a bent, tapered tube: the centre line is a circular arc (the "ear"),
 * the cross-section is a rounded profile that is fat on the inner side (the fold)
 * and pinched into a wavy lip on the outer side (the crimped seam). A small knob
 * bridges the two ends where the corners are pressed together.
 *
 * Local frame: lies flat in XZ, belly points to +X, up is +Y. Roughly 2 x 0.8 x 2.2 units.
 */
export function createDumplingGeometry({
  ringRadius = 0.52,
  tube = 0.56,
  height = 0.62,
  arc = Math.PI * 1.9,
  crimp = 0.13,
  crimpWaves = 10,
  uSegments = 80,
  vSegments = 36,
} = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const half = arc / 2;

  for (let i = 0; i <= uSegments; i++) {
    const t = i / uSegments;
    const theta = -half + t * arc;

    // Fat belly at theta = 0, pinched corners near the ends, rounded caps at the tips.
    const belly = Math.pow(Math.sin(Math.PI * t), 0.6);
    const cap = Math.sqrt(Math.min(1, Math.min(t, 1 - t) / 0.05));
    const taper = (0.22 + 0.78 * belly) * cap;

    const cx = ringRadius * Math.cos(theta);
    const cz = ringRadius * Math.sin(theta);
    const rx = Math.cos(theta);
    const rz = Math.sin(theta);

    const wave = 0.6 + 0.4 * Math.sin(theta * crimpWaves);
    const lipTilt = Math.sin(theta * crimpWaves + 1.2);

    for (let j = 0; j < vSegments; j++) {
      const phi = (j / vSegments) * Math.PI * 2;
      const c = Math.cos(phi);
      const s = Math.sin(phi);

      const outer = Math.pow((1 + c) / 2, 3); // 1 on the seam side, 0 on the fold side
      const lip = Math.pow((1 + c) / 2, 8); // sharp mask for the crimped lip
      const pinch = 1 - 0.78 * outer; // flatten towards the seam

      const radial = tube * taper * c * (1 + 0.25 * outer) + crimp * lip * wave * cap;
      const vertical = height * taper * s * pinch + crimp * 0.6 * lip * lipTilt * taper;

      positions.push(cx + radial * rx, vertical, cz + radial * rz);
      uvs.push(t, j / vSegments);
    }
  }

  for (let i = 0; i < uSegments; i++) {
    for (let j = 0; j < vSegments; j++) {
      const a = i * vSegments + j;
      const b = i * vSegments + ((j + 1) % vSegments);
      const c = (i + 1) * vSegments + j;
      const d = (i + 1) * vSegments + ((j + 1) % vSegments);
      indices.push(a, b, c, b, d, c);
    }
  }

  const body = new BufferGeometry();
  body.setAttribute('position', new Float32BufferAttribute(positions, 3));
  body.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  body.setIndex(indices);
  body.computeVertexNormals();

  // Knob where the two corners are pressed together.
  const knob = new SphereGeometry(tube * 0.36, 24, 16);
  knob.scale(1, 0.75, 1.3);
  knob.translate(-ringRadius, 0, 0);

  const merged = mergeGeometries([body, knob], false);
  body.dispose();
  knob.dispose();

  // Centre on the origin so tumbling looks balanced.
  merged.computeBoundingBox();
  const centre = new Vector3();
  merged.boundingBox.getCenter(centre);
  merged.translate(-centre.x, -centre.y, -centre.z);
  merged.computeBoundingSphere();

  return merged;
}
