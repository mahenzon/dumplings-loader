import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { FRAME_RADIUS, HANDLE_ANGLE, POT_RADIUS, RING_RADIUS } from '../constants.js';
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
  shadow: '#15171a', // table shadow under the pot
  outline: '#8a7454',
  label: 'currentColor',
});

const RIM_Y = 1;
const FLOOR_Y = -1.8;
const WALL_TOP_RADIUS = POT_RADIUS - 0.05;
const WALL_BOTTOM_RADIUS = 3.45;
// Wall radius at the water line (y = 0).
const WATER_RADIUS =
  WALL_BOTTOM_RADIUS + (WALL_TOP_RADIUS - WALL_BOTTOM_RADIUS) * ((0 - FLOOR_Y) / (RIM_Y - FLOOR_Y));
// Rolled lip: a flattened torus hanging over the wall top, ~0.7 wide seen from above.
const RIM_TUBE = 0.34;
const RIM_CENTRE_RADIUS = POT_RADIUS + 0.12;
const RIM_OUTER_RADIUS = RIM_CENTRE_RADIUS + RIM_TUBE;
// The handle starts under the lip; local +x of the handle group points away from the pot.
const HANDLE_ROOT_RADIUS = POT_RADIUS + 0.35;
const HANDLE_Y = 0.55;
const HANDLE_PITCH = 0.1; // rad, the grip rises slightly away from the pot

/**
 * Phenolic saucepan grip seen from above: a rounded-rectangle bar that pinches into a waist behind
 * the collar, widens towards a round tip and has a hanging hole. Built by extruding the top-view
 * outline with a bevel (rounded edges), then smoothing the normals. Lies along +x, centred on y = 0;
 * ~0.6 wide at the neck, ~0.78 at the tip, 0.7 thick.
 */
function createGripGeometry() {
  const bevel = 0.2;
  // Half-widths of the flat top face along the grip; the bevel adds `bevel` all around.
  const edge = [
    [0, 0.42],
    [0.7, 0.38],
    [1.6, 0.4],
    [2.6, 0.48],
    [3.4, 0.56],
    [3.8, 0.58],
  ];
  const [tipX, tipRadius] = edge[edge.length - 1];
  const shape = new THREE.Shape();
  shape.moveTo(edge[0][0], -edge[0][1]);
  shape.splineThru(edge.slice(1).map(([x, y]) => new THREE.Vector2(x, -y)));
  shape.absarc(tipX, 0, tipRadius, -Math.PI / 2, Math.PI / 2, false);
  shape.splineThru(
    edge
      .slice(0, -1)
      .reverse()
      .map(([x, y]) => new THREE.Vector2(x, y)),
  );
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(tipX - 0.05, 0, 0.34, 0, Math.PI * 2, true);
  shape.holes.push(hole);

  const extruded = new THREE.ExtrudeGeometry(shape, {
    depth: 0.3,
    steps: 1,
    curveSegments: 16,
    bevelEnabled: true,
    bevelThickness: 0.2,
    bevelSize: bevel,
    bevelSegments: 6,
  });
  // ExtrudeGeometry is flat-shaded (duplicated vertices); weld it and rebuild smooth normals.
  extruded.deleteAttribute('uv');
  extruded.deleteAttribute('normal');
  const geometry = mergeVertices(extruded, 1e-4);
  extruded.dispose();
  geometry.computeVertexNormals();
  geometry.rotateX(-Math.PI / 2); // extrusion axis → +y
  geometry.translate(0, -(0.3 / 2), 0);
  return geometry;
}

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
    key.shadow.mapSize.set(1536, 1536);
    const extent = FRAME_RADIUS + 1.6;
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
  const shaded = (mesh) => {
    mesh.castShadow = Boolean(options.shadows);
    mesh.receiveShadow = true;
    return mesh;
  };

  // Inner wall: open cone, seen from inside. Casts too, so the near wall shades the water and the
  // whole pot shades the table (DoubleSide: a single-sided surface would drop out of the shadow map).
  const wallGeometry = track(
    new THREE.CylinderGeometry(WALL_TOP_RADIUS, WALL_BOTTOM_RADIUS, RIM_Y - FLOOR_Y, 128, 1, true),
  );
  const wallInner = shaded(
    new THREE.Mesh(
      wallGeometry,
      steel(c.potInside, {
        side: THREE.BackSide,
        shadowSide: THREE.DoubleSide,
        roughness: 0.42,
        envMapIntensity: 0.8,
      }),
    ),
  );
  wallInner.position.y = (RIM_Y + FLOOR_Y) / 2;
  pot.add(wallInner);

  const floorGeometry = track(new THREE.CircleGeometry(WALL_BOTTOM_RADIUS, 96));
  const floor = shaded(
    new THREE.Mesh(
      floorGeometry,
      steel('#3e4245', {
        shadowSide: THREE.DoubleSide,
        roughness: 0.6,
        anisotropy: 0.2,
        envMapIntensity: 0.4,
      }),
    ),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  pot.add(floor);

  // Rolled lip: flattened torus overhanging the wall top; reads as a wide bright band from above.
  const rimGeometry = track(new THREE.TorusGeometry(RIM_CENTRE_RADIUS, RIM_TUBE, 48, 256));
  const rim = shaded(new THREE.Mesh(rimGeometry, steel(c.pot, { roughness: 0.2 })));
  rim.rotation.x = Math.PI / 2;
  rim.scale.z = 0.5;
  rim.position.y = RIM_Y;
  pot.add(rim);

  // Handle: black phenolic grip behind a flared steel collar, towards the bottom-right like in the
  // reference. The group's local +x runs along the handle, away from the pot.
  const handle = new THREE.Group();
  handle.rotation.y = -HANDLE_ANGLE;
  handle.position.set(
    Math.cos(HANDLE_ANGLE) * HANDLE_ROOT_RADIUS,
    HANDLE_Y,
    Math.sin(HANDLE_ANGLE) * HANDLE_ROOT_RADIUS,
  );
  pot.add(handle);

  const collarGeometry = track(new THREE.CylinderGeometry(0.36, 0.4, 0.5, 48));
  collarGeometry.rotateZ(-Math.PI / 2); // axis along +x, the wider end towards the pot
  const collar = shaded(
    new THREE.Mesh(collarGeometry, steel(c.pot, { roughness: 0.38, envMapIntensity: 0.7 })),
  );
  collar.scale.set(1, 1, 1.15);
  collar.position.x = 0.25;
  handle.add(collar);

  const gripGeometry = track(createGripGeometry());
  const gripMaterial = track(
    new THREE.MeshPhysicalMaterial({
      color: c.handle,
      metalness: 0,
      roughness: 0.5,
      clearcoat: 0.5,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.45,
    }),
  );
  const grip = shaded(new THREE.Mesh(gripGeometry, gripMaterial));
  grip.position.x = 0.45; // neck sits inside the collar
  grip.rotation.z = HANDLE_PITCH;
  handle.add(grip);

  // Table: catches the pot's and the handle's shadow, fades out before the canvas edge so the
  // shadow never ends in a hard line at the frame boundary.
  if (options.shadows) {
    const groundMaterial = track(new THREE.ShadowMaterial({ color: c.shadow, opacity: 0.32 }));
    groundMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uFade = { value: new THREE.Vector2(RIM_OUTER_RADIUS - 0.05, FRAME_RADIUS - 0.05) };
      shader.vertexShader = `varying vec3 vDlWorld;\n${shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n  vDlWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      )}`;
      shader.fragmentShader = `varying vec3 vDlWorld;\nuniform vec2 uFade;\n${shader.fragmentShader.replace(
        'opacity * ( 1.0 - getShadowMask() )',
        'opacity * ( 1.0 - getShadowMask() ) * (1.0 - smoothstep(uFade.x, uFade.y, length(vDlWorld.xz)))',
      )}`;
    };
    const groundGeometry = track(new THREE.PlaneGeometry(FRAME_RADIUS * 6, FRAME_RADIUS * 6));
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = FLOOR_Y - 0.1;
    ground.receiveShadow = true;
    scene.add(ground);
  }

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
