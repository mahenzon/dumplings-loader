import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HANDLE_ANGLE, POT_RADIUS, RING_RADIUS } from '../constants.js';
import { createDumplingGeometry } from '../dumpling-geometry.js';
import { createBrothMaps, createDoughBumpMap, createNoiseNormalMap } from '../procedural.js';
import { createRingBubbleTexture, createSoftTexture } from '../textures.js';
import { randomIn } from '../utils.js';

export const name = 'realistic';

// Rendered slightly below device resolution: the upscale gives the soft focus of the reference video.
export const pixelRatioScale = 0.7;

export const colors = Object.freeze({
  dough: '#dfcfae',
  water: '#bfbdb6', // milky broth
  waterEdge: '#e2e0da', // foam creeping in from the wall
  waterHighlight: '#ffffff',
  pot: '#d0d3d2', // stainless steel
  potInside: '#7c8184',
  handle: '#16171a',
  shadow: '#4a4d4f',
  outline: '#8a7454',
  label: 'currentColor',
});

const RIM_Y = 0.8;
const FLOOR_Y = -1.8;
const WALL_TOP_RADIUS = POT_RADIUS - 0.03;
const WALL_BOTTOM_RADIUS = 3.6;
// Wall radius at the water line (y = 0).
const WATER_RADIUS =
  WALL_BOTTOM_RADIUS + (WALL_TOP_RADIUS - WALL_BOTTOM_RADIUS) * ((0 - FLOOR_Y) / (RIM_Y - FLOOR_Y));

// Scrolls two copies of the tileable normal map in different directions so the broth surface shimmers.
const WATER_NORMAL_CHUNK = /* glsl */ `
#ifdef USE_NORMALMAP_TANGENTSPACE
  vec2 dlUv1 = vNormalMapUv * 3.0 + vec2(uTime * 0.030, uTime * 0.018);
  vec2 dlUv2 = vNormalMapUv * 5.2 - vec2(uTime * 0.021, uTime * 0.041);
  vec3 dlN1 = texture2D(normalMap, dlUv1).xyz * 2.0 - 1.0;
  vec3 dlN2 = texture2D(normalMap, dlUv2).xyz * 2.0 - 1.0;
  vec3 mapN = normalize(vec3(dlN1.xy + dlN2.xy, dlN1.z * dlN2.z));
  mapN.xy *= normalScale;
  normal = normalize(tbn * mapN);
#endif
`;

/**
 * Photo-real look: PBR stainless steel with an environment map, translucent milky broth with
 * animated normals, pelmeni that sink into the water and get veiled by it, real cast shadows.
 *
 * Appearance contract (shared with ./cartoon.js):
 *   restHeight            ring centre height at rest (y)
 *   dumplingGeometry / dumplingMaterial
 *   shadow                { create(d) → Object3D | null, update(d, lift) } or null
 *   bubbles               { texture, count, opacity, size, ttl, y, radius() } or null
 *   steam                 [{ texture, count, opacity, size, ttl, y, drift, radius }]
 *   ripples               { color, opacity, count, inner } or null
 *   update(t, dt)         optional per-frame hook
 */
export function create({ scene, renderer, colors: c, options, track }) {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  if (options.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  // ---------- Environment (reflections for the steel and the water) ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTarget = pmrem.fromScene(room, 0.04);
  room.dispose?.();
  pmrem.dispose();
  track(envTarget);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.5;

  // ---------- Lights ----------
  const key = new THREE.DirectionalLight(0xfff0dc, 1.4);
  key.position.set(-6, 12, -5);
  if (options.shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const extent = POT_RADIUS + 1;
    Object.assign(key.shadow.camera, {
      left: -extent,
      right: extent,
      top: extent,
      bottom: -extent,
      near: 1,
      far: 30,
    });
    key.shadow.camera.updateProjectionMatrix();
    key.shadow.radius = 5;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
  }
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xf2f5ff, 0x4d463f, 0.4));

  // ---------- Pot ----------
  const pot = new THREE.Group();
  scene.add(pot);

  const steel = (color, extra = {}) =>
    track(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 1,
        roughness: 0.26,
        anisotropy: 0.55, // brushed / spun finish
        envMapIntensity: 1,
        ...extra,
      }),
    );

  const wallGeometry = track(
    new THREE.CylinderGeometry(WALL_TOP_RADIUS, WALL_BOTTOM_RADIUS, RIM_Y - FLOOR_Y, 128, 1, true),
  );
  const wallInner = new THREE.Mesh(
    wallGeometry,
    steel(c.potInside, { side: THREE.BackSide, roughness: 0.42, envMapIntensity: 0.8 }),
  );
  wallInner.position.y = (RIM_Y + FLOOR_Y) / 2;
  wallInner.receiveShadow = true;
  pot.add(wallInner);

  const floorGeometry = track(new THREE.CircleGeometry(WALL_BOTTOM_RADIUS, 96));
  const floor = new THREE.Mesh(
    floorGeometry,
    steel('#3e4245', { roughness: 0.6, anisotropy: 0.2, envMapIntensity: 0.4 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  pot.add(floor);

  // Rolled rim.
  const rimGeometry = track(new THREE.TorusGeometry(POT_RADIUS + 0.08, 0.27, 32, 192));
  const rim = new THREE.Mesh(rimGeometry, steel(c.pot, { roughness: 0.2 }));
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.55; // flattened rolled edge: reads as a wide bright band from above
  rim.position.y = RIM_Y;
  pot.add(rim);

  // Handle: black phenolic grip on a steel ferrule, towards the bottom-right like in the reference.
  const handleDir = new THREE.Vector3(Math.cos(HANDLE_ANGLE), 0, Math.sin(HANDLE_ANGLE));
  const orient = (mesh) => {
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = -HANDLE_ANGLE;
    mesh.rotation.z = Math.PI / 2;
  };
  const handleGeometry = track(new THREE.CapsuleGeometry(0.34, 2.9, 12, 32));
  const handle = new THREE.Mesh(
    handleGeometry,
    track(
      new THREE.MeshPhysicalMaterial({
        color: c.handle,
        metalness: 0,
        roughness: 0.42,
        clearcoat: 0.35,
        clearcoatRoughness: 0.35,
        envMapIntensity: 0.8,
      }),
    ),
  );
  orient(handle);
  handle.scale.set(1, 1, 0.62);
  handle.position
    .copy(handleDir)
    .multiplyScalar(POT_RADIUS + 1.85)
    .setY(0.55);
  handle.castShadow = Boolean(options.shadows);
  pot.add(handle);

  const ferruleGeometry = track(new THREE.CylinderGeometry(0.4, 0.4, 0.8, 32));
  const ferrule = new THREE.Mesh(ferruleGeometry, steel(c.pot, { roughness: 0.3 }));
  orient(ferrule);
  ferrule.scale.set(1, 1, 0.8);
  ferrule.position
    .copy(handleDir)
    .multiplyScalar(POT_RADIUS + 0.5)
    .setY(0.55);
  pot.add(ferrule);

  // ---------- Water ----------
  const { colorMap, alphaMap } = createBrothMaps(c.water, c.waterEdge, {
    centreAlpha: 0.66,
    edgeAlpha: 0.92,
  });
  track(colorMap);
  track(alphaMap);
  const waterNormal = track(createNoiseNormalMap(256, { strength: 1.4, octaves: 4, baseCells: 4, seed: 11 }));
  const time = { value: 0 };
  const waterMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: colorMap,
      alphaMap,
      transparent: true,
      roughness: 0.16,
      metalness: 0,
      normalMap: waterNormal,
      normalScale: new THREE.Vector2(0.36, 0.36),
      envMapIntensity: 0.9,
      specularIntensity: 0.8,
    }),
  );
  waterMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.fragmentShader = `uniform float uTime;\n${shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      WATER_NORMAL_CHUNK,
    )}`;
  };
  const waterGeometry = track(new THREE.CircleGeometry(WATER_RADIUS + 0.03, 160));
  const water = new THREE.Mesh(waterGeometry, waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  pot.add(water);

  // ---------- Dumplings ----------
  const dumplingGeometry = track(
    createDumplingGeometry({
      crimp: 0.09,
      crimpWaves: 9,
      uSegments: 96,
      vSegments: 48,
      tube: 0.58,
      height: 0.66,
    }),
  );
  const bump = track(createDoughBumpMap(256));
  bump.repeat.set(4, 2);
  const dumplingMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: c.dough,
      metalness: 0,
      roughness: 0.6,
      bumpMap: bump,
      bumpScale: 0.012,
      sheen: 0.25,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color('#fff8ec'),
      clearcoat: 0.16, // wet dough
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.25,
    }),
  );
  // Below the water line the dough fades towards the broth colour and loses its gloss,
  // so submerged parts read as cloudy shapes under the surface.
  dumplingMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uBroth = { value: new THREE.Color(c.water).multiplyScalar(0.92) };
    shader.uniforms.uSubmerge = { value: 0.5 };
    shader.vertexShader = `varying float vDlWorldY;\n${shader.vertexShader.replace(
      '#include <project_vertex>',
      '#include <project_vertex>\n  vDlWorldY = (modelMatrix * vec4(transformed, 1.0)).y;',
    )}`;
    shader.fragmentShader = `varying float vDlWorldY;\nuniform vec3 uBroth;\nuniform float uSubmerge;\n${shader.fragmentShader
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  float dlDepth = smoothstep(0.0, uSubmerge, -vDlWorldY);\n  diffuseColor.rgb = mix(diffuseColor.rgb, uBroth, dlDepth * 0.9);',
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 1.0, dlDepth);',
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\n  material.clearcoat *= 1.0 - dlDepth;\n#endif\n#ifdef USE_SHEEN\n  material.sheenColor *= 1.0 - dlDepth;\n#endif',
      )}`;
  };

  return {
    restHeight: -0.28,
    dumplingGeometry,
    dumplingMaterial,
    shadow: {
      create(d) {
        d.mesh.castShadow = true;
        d.mesh.receiveShadow = true;
        return null;
      },
      update() {},
    },
    bubbles: {
      texture: track(createRingBubbleTexture()),
      count: 46,
      opacity: 0.7,
      size: [0.06, 0.2],
      ttl: [0.45, 1.1],
      y: 0.06,
      // Rolling boil: most bubbles hug the wall, the rest rise around the pelmeni.
      radius: () => {
        const r = Math.random();
        if (r < 0.45) return WATER_RADIUS - randomIn(0.15, 0.7);
        if (r < 0.85) return RING_RADIUS + randomIn(-1.1, 1.1);
        return randomIn(0, WATER_RADIUS - 0.5);
      },
    },
    steam: [
      {
        // Wisps.
        texture: track(createSoftTexture('#efeeea', { falloff: 1.1 })),
        count: 18,
        opacity: 0.3,
        size: [2.2, 4],
        ttl: [4, 7],
        y: 2,
        drift: 0.5,
        radius: [0.3, WATER_RADIUS - 0.4],
      },
      {
        // Standing haze over the whole pot.
        texture: track(createSoftTexture('#f2f1ed', { falloff: 0.9 })),
        count: 4,
        opacity: 0.2,
        size: [7, 9.5],
        ttl: [8, 12],
        y: 2.2,
        drift: 0.15,
        radius: [0, 1.4],
      },
    ],
    ripples: { color: c.waterHighlight, opacity: 0.11, count: 5, inner: 0.95 },
    update(t) {
      time.value = t;
    },
  };
}
