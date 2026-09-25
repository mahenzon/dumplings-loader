import * as THREE from 'three';
import { HANDLE_ANGLE, POT_RADIUS, RING_RADIUS } from '../constants.js';
import { createDumplingGeometry } from '../dumpling-geometry.js';
import { createBubbleTexture, createSoftTexture } from '../textures.js';
import { createGradientMap, createWaterTexture } from '../toon.js';
import { randomIn } from '../utils.js';

export const name = 'cartoon';

export const pixelRatioScale = 1;

export const colors = Object.freeze({
  dough: '#f2e3c3',
  water: '#dbe8ee',
  waterEdge: '#b6c8d3',
  waterHighlight: '#ffffff',
  pot: '#c9ced4',
  potInside: '#8d949c',
  handle: '#2b2e33',
  shadow: '#3d4a55',
  outline: '#8a7454',
  label: 'currentColor',
});

/**
 * Cel-shaded look: flat toon dough, painted water disc, sprite contact shadows.
 * See ./realistic.js for the contract every appearance implements.
 */
export function create({ scene, renderer, colors: c, track, withOutline }) {
  renderer.toneMapping = THREE.NoToneMapping;

  // ---------- Lights (key from the top-left of the screen) ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfb4a4, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff5e6, 2.4);
  key.position.set(-6, 10, -5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbe9ff, 0.6);
  fill.position.set(6, 6, 5);
  scene.add(fill);

  // ---------- Pot ----------
  const pot = new THREE.Group();
  scene.add(pot);

  const steel = (color, extra = {}) =>
    track(new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.55, ...extra }));

  // Slanted wall: from above it reads as a shaded band between the rim and the water.
  const wallGeometry = track(
    new THREE.CylinderGeometry(POT_RADIUS + 0.05, POT_RADIUS - 0.5, 2.4, 96, 1, true),
  );
  const wallInner = new THREE.Mesh(
    wallGeometry,
    steel(c.potInside, { side: THREE.BackSide, roughness: 0.7 }),
  );
  wallInner.position.y = -0.6;
  pot.add(wallInner);
  const wallOuter = new THREE.Mesh(wallGeometry, steel(c.pot, { side: THREE.FrontSide }));
  wallOuter.position.y = -0.6;
  pot.add(withOutline(wallOuter));

  const rimGeometry = track(new THREE.TorusGeometry(POT_RADIUS + 0.05, 0.24, 24, 128));
  const rimMesh = new THREE.Mesh(rimGeometry, steel(c.pot, { roughness: 0.4 }));
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = 0.6;
  pot.add(withOutline(rimMesh));

  // Handle towards the bottom-right of the screen, like in the reference.
  const handleDir = new THREE.Vector3(Math.cos(HANDLE_ANGLE), 0, Math.sin(HANDLE_ANGLE));
  const handleGeometry = track(new THREE.CapsuleGeometry(0.36, 2.8, 8, 24));
  const handle = new THREE.Mesh(handleGeometry, steel(c.handle, { metalness: 0.1, roughness: 0.75 }));
  handle.rotation.order = 'YXZ';
  handle.rotation.y = -HANDLE_ANGLE;
  handle.rotation.z = Math.PI / 2;
  handle.scale.set(1, 1, 0.6);
  handle.position
    .copy(handleDir)
    .multiplyScalar(POT_RADIUS + 1.7)
    .setY(0.5);
  pot.add(withOutline(handle));

  const socketGeometry = track(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 24));
  const socket = new THREE.Mesh(socketGeometry, steel(c.pot));
  socket.rotation.order = 'YXZ';
  socket.rotation.y = -HANDLE_ANGLE;
  socket.rotation.z = Math.PI / 2;
  socket.scale.set(1, 1, 0.8);
  socket.position
    .copy(handleDir)
    .multiplyScalar(POT_RADIUS + 0.4)
    .setY(0.5);
  pot.add(withOutline(socket));

  // ---------- Water ----------
  const waterTexture = track(createWaterTexture(c.water, c.waterEdge, c.waterHighlight));
  const waterGeometry = track(new THREE.CircleGeometry(POT_RADIUS - 0.02, 128));
  const water = new THREE.Mesh(waterGeometry, track(new THREE.MeshBasicMaterial({ map: waterTexture })));
  water.rotation.x = -Math.PI / 2;
  pot.add(water);

  // ---------- Dumplings ----------
  const gradientMap = track(createGradientMap());
  const dumplingGeometry = track(createDumplingGeometry());
  const dumplingMaterial = track(new THREE.MeshToonMaterial({ color: c.dough, gradientMap }));

  const shadowTexture = track(createSoftTexture(c.shadow, { falloff: 1.6 }));
  const shadowMaterial = track(
    new THREE.SpriteMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.28 }),
  );

  return {
    restHeight: 0.08,
    dumplingGeometry,
    dumplingMaterial,
    shadow: {
      create() {
        const sprite = new THREE.Sprite(shadowMaterial);
        sprite.position.y = 0.02;
        return sprite;
      },
      update(d, lift) {
        // Shadow drifts away from the key light and shrinks/fades as the pelmen lifts.
        const liftFactor = 1 + lift * 1.5;
        d.shadow.position.set(d.anchor.position.x + 0.22, 0.02, d.anchor.position.z + 0.18);
        d.shadow.scale.setScalar(d.scale * 3.1 * liftFactor);
        d.shadow.material.opacity = 0.28 / liftFactor;
      },
    },
    bubbles: {
      texture: track(createBubbleTexture()),
      count: 30,
      opacity: 0.8,
      size: [0.1, 0.32],
      ttl: [0.7, 1.6],
      y: 0.3,
      radius: () =>
        Math.random() < 0.65 ? RING_RADIUS + randomIn(-1.3, 1.3) : randomIn(0, POT_RADIUS - 0.5),
    },
    steam: [
      {
        texture: track(createSoftTexture('#ffffff', { falloff: 1.3 })),
        count: 10,
        opacity: 0.5,
        size: [1.6, 3],
        ttl: [3.5, 6],
        y: 1.5,
        drift: 0.4,
        radius: [0.3, POT_RADIUS - 0.4],
      },
    ],
    ripples: { color: c.waterHighlight, opacity: 0.3, count: 6, inner: 0.9 },
  };
}
