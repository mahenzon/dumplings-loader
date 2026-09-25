import * as THREE from 'three';
import { createDumplingGeometry } from './dumpling-geometry.js';
import {
  createBubbleTexture,
  createGradientMap,
  createOutlineMaterial,
  createSoftTexture,
  createWaterTexture,
} from './toon.js';

export const DEFAULT_OPTIONS = Object.freeze({
  count: 7,
  orbitSpeed: 0.35, // rad/s, whole ring drifts around the pot
  tumbleSpeed: 1.7, // rad/s, each pelmen flips over its tangent axis
  spinAxis: 'tangent', // 'tangent' | 'radial' | 'mixed'
  bob: 1, // vertical bobbing multiplier (visible through the contact shadow)
  label: 'Loading',
  labelPosition: 'top', // 'top' | 'bottom' | 'none'
  outline: false, // soft ink outline around meshes (off by default: subtler look)
  bubbles: true,
  steam: true,
  ripples: true,
  shadows: true,
  paused: false,
  reducedMotion: 'auto', // 'auto' | true | false
  pixelRatio: null, // null → min(devicePixelRatio, 2)
  colors: Object.freeze({
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
  }),
});

const POT_RADIUS = 4.4;
const RING_RADIUS = 2.9;
const DUMPLING_SCALE = 0.92;
const FRAME_RADIUS = 5.4; // world units visible from the centre along the shorter canvas side

const STYLE = `
.dl-root{position:relative;display:flex;flex-direction:column;width:100%;height:100%;min-height:0;box-sizing:border-box;container-type:inline-size}
.dl-stage{position:relative;flex:1 1 auto;min-height:0;width:100%;aspect-ratio:1;overflow:hidden}
.dl-stage canvas{position:absolute;inset:0;width:100%!important;height:100%!important;display:block}
.dl-label{flex:0 0 auto;text-align:center;font:500 clamp(18px,7cqw,34px)/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;letter-spacing:.01em;padding:.35em 0;user-select:none}
.dl-label--top{order:-1}
.dl-dots span{display:inline-block;width:.35em;animation:dl-dot 1.4s infinite ease-in-out}
.dl-dots span:nth-child(2){animation-delay:.2s}
.dl-dots span:nth-child(3){animation-delay:.4s}
@keyframes dl-dot{0%,80%,100%{opacity:0}40%{opacity:1}}
@media (prefers-reduced-motion:reduce){.dl-dots span{animation:none;opacity:1}}
`;

function mergeOptions(base, patch) {
  const out = { ...base, ...patch };
  out.colors = { ...base.colors, ...(patch?.colors || {}) };
  return out;
}

function randomIn(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Mounts the loader into `container`. Returns a handle with `setCount`, `setSpeed`,
 * `setSpinAxis`, `setLabel`, `pause`, `resume`, `destroy`.
 */
export function createDumplingsLoader(container, userOptions = {}) {
  if (!container) throw new Error('dumplings-loader: container element is required');
  let options = mergeOptions(DEFAULT_OPTIONS, userOptions);
  const colors = options.colors;

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'dl-root';
  const style = document.createElement('style');
  style.textContent = STYLE;
  root.appendChild(style);

  const stage = document.createElement('div');
  stage.className = 'dl-stage';
  stage.setAttribute('part', 'stage');
  root.appendChild(stage);

  const label = document.createElement('div');
  label.className = 'dl-label';
  label.setAttribute('part', 'label');
  label.setAttribute('role', 'status');
  label.setAttribute('aria-live', 'polite');
  const labelText = document.createElement('span');
  const dots = document.createElement('span');
  dots.className = 'dl-dots';
  dots.setAttribute('aria-hidden', 'true');
  dots.innerHTML = '<span>.</span><span>.</span><span>.</span>';
  label.append(labelText, dots);
  root.appendChild(label);

  const applyLabel = () => {
    const text = options.label ?? '';
    const position = options.labelPosition;
    labelText.textContent = text;
    label.style.color = colors.label;
    label.style.display = text && position !== 'none' ? '' : 'none';
    label.classList.toggle('dl-label--top', position === 'top');
  };
  applyLabel();
  container.appendChild(root);

  // ---------- Renderer / camera ----------
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  // Straight top-down orthographic view. Screen right = +X, screen up = -Z.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(0, 30, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const fitCamera = (aspect) => {
    const halfW = aspect >= 1 ? FRAME_RADIUS * aspect : FRAME_RADIUS;
    const halfH = aspect >= 1 ? FRAME_RADIUS : FRAME_RADIUS / aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();
  };

  // ---------- Lights (key from the top-left of the screen) ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbfb4a4, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff5e6, 2.4);
  key.position.set(-6, 10, -5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdbe9ff, 0.6);
  fill.position.set(6, 6, 5);
  scene.add(fill);

  const gradientMap = createGradientMap();
  const disposables = [gradientMap];
  const track = (resource) => {
    disposables.push(resource);
    return resource;
  };

  const outlineMaterial = track(createOutlineMaterial(colors.outline, 0.035));
  const withOutline = (mesh) => {
    if (!options.outline) return mesh;
    const hull = new THREE.Mesh(mesh.geometry, outlineMaterial);
    hull.renderOrder = -1;
    mesh.add(hull);
    return mesh;
  };

  // ---------- Pot ----------
  const pot = new THREE.Group();
  scene.add(pot);

  const steel = (color, extra = {}) =>
    track(new THREE.MeshStandardMaterial({ color, metalness: 0.35, roughness: 0.55, ...extra }));

  // Slanted wall: from above it reads as a shaded band between the rim and the water.
  const wallGeometry = track(new THREE.CylinderGeometry(POT_RADIUS + 0.05, POT_RADIUS - 0.5, 2.4, 96, 1, true));
  const wallInner = new THREE.Mesh(wallGeometry, steel(colors.potInside, { side: THREE.BackSide, roughness: 0.7 }));
  wallInner.position.y = -0.6;
  pot.add(wallInner);
  const wallOuter = new THREE.Mesh(wallGeometry, steel(colors.pot, { side: THREE.FrontSide }));
  wallOuter.position.y = -0.6;
  pot.add(withOutline(wallOuter));

  const rimGeometry = track(new THREE.TorusGeometry(POT_RADIUS + 0.05, 0.24, 24, 128));
  const rimMesh = new THREE.Mesh(rimGeometry, steel(colors.pot, { roughness: 0.4 }));
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = 0.6;
  pot.add(withOutline(rimMesh));

  // Handle towards the bottom-right of the screen, like in the reference.
  const handleAngle = Math.PI / 5;
  const handleDir = new THREE.Vector3(Math.cos(handleAngle), 0, Math.sin(handleAngle));
  const handleGeometry = track(new THREE.CapsuleGeometry(0.36, 2.8, 8, 24));
  const handle = new THREE.Mesh(handleGeometry, steel(colors.handle, { metalness: 0.1, roughness: 0.75 }));
  handle.rotation.order = 'YXZ';
  handle.rotation.y = -handleAngle;
  handle.rotation.z = Math.PI / 2;
  handle.scale.set(1, 1, 0.6);
  handle.position.copy(handleDir).multiplyScalar(POT_RADIUS + 1.7).setY(0.5);
  pot.add(withOutline(handle));

  const socketGeometry = track(new THREE.CylinderGeometry(0.42, 0.42, 0.6, 24));
  const socket = new THREE.Mesh(socketGeometry, steel(colors.pot));
  socket.rotation.order = 'YXZ';
  socket.rotation.y = -handleAngle;
  socket.rotation.z = Math.PI / 2;
  socket.scale.set(1, 1, 0.8);
  socket.position.copy(handleDir).multiplyScalar(POT_RADIUS + 0.4).setY(0.5);
  pot.add(withOutline(socket));

  // ---------- Water ----------
  const waterTexture = track(createWaterTexture(colors.water, colors.waterEdge, colors.waterHighlight));
  const waterGeometry = track(new THREE.CircleGeometry(POT_RADIUS - 0.02, 128));
  const water = new THREE.Mesh(waterGeometry, track(new THREE.MeshBasicMaterial({ map: waterTexture })));
  water.rotation.x = -Math.PI / 2;
  pot.add(water);

  // ---------- Dumplings ----------
  const dumplingGeometry = track(createDumplingGeometry());
  const doughMaterial = track(new THREE.MeshToonMaterial({ color: colors.dough, gradientMap }));
  const shadowTexture = track(createSoftTexture(colors.shadow, { falloff: 1.6 }));
  const shadowMaterial = track(
    new THREE.SpriteMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: 0.28 }),
  );
  const dumplingsGroup = new THREE.Group();
  scene.add(dumplingsGroup);
  let dumplings = [];

  const buildDumplings = (count) => {
    dumplings.forEach((d) => {
      dumplingsGroup.remove(d.anchor);
      if (d.shadow) dumplingsGroup.remove(d.shadow);
    });
    dumplings = [];
    const n = Math.max(1, Math.round(count));
    // Shrink pelmeni when the ring gets crowded (each one is ~2.2 units wide).
    const scale = Math.min(DUMPLING_SCALE, ((Math.PI * 2 * RING_RADIUS) / n) / 2.4);
    for (let i = 0; i < n; i++) {
      const anchor = new THREE.Group();
      const tumbler = new THREE.Group();
      const mesh = new THREE.Mesh(dumplingGeometry, doughMaterial);
      mesh.scale.setScalar(scale);
      withOutline(mesh);
      tumbler.add(mesh);
      anchor.add(tumbler);
      dumplingsGroup.add(anchor);

      let shadow = null;
      if (options.shadows) {
        shadow = new THREE.Sprite(shadowMaterial);
        shadow.position.y = 0.02;
        dumplingsGroup.add(shadow);
      }

      dumplings.push({
        anchor,
        tumbler,
        mesh,
        shadow,
        scale,
        baseAngle: (i / n) * Math.PI * 2 + randomIn(-0.08, 0.08),
        radius: RING_RADIUS + randomIn(-0.12, 0.12),
        tumbleRate: randomIn(0.85, 1.15),
        tumblePhase: randomIn(0, Math.PI * 2),
        bobPhase: randomIn(0, Math.PI * 2),
        bobRate: randomIn(1.6, 2.3),
        wobblePhase: randomIn(0, Math.PI * 2),
        yaw: randomIn(-0.25, 0.25),
      });
    }
  };
  buildDumplings(options.count);

  // ---------- Particles ----------
  const makeSprites = (texture, count, opacity) => {
    const material = track(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity }),
    );
    return Array.from({ length: count }, () => {
      const sprite = new THREE.Sprite(track(material.clone()));
      sprite.visible = false;
      scene.add(sprite);
      return { sprite, life: 0, ttl: 0, x: 0, z: 0, size: 1, drift: 0 };
    });
  };

  const bubbles = options.bubbles ? makeSprites(track(createBubbleTexture()), 30, 0.8) : [];
  const steam = options.steam ? makeSprites(track(createSoftTexture('#ffffff', { falloff: 1.3 })), 10, 0.5) : [];

  const spawnBubble = (b) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() < 0.65 ? RING_RADIUS + randomIn(-1.3, 1.3) : randomIn(0, POT_RADIUS - 0.5);
    b.x = Math.cos(angle) * radius;
    b.z = Math.sin(angle) * radius;
    b.size = randomIn(0.1, 0.32);
    b.ttl = randomIn(0.7, 1.6);
    b.life = 0;
    b.sprite.visible = true;
  };

  const spawnSteam = (s) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = randomIn(0.3, POT_RADIUS - 0.4);
    s.x = Math.cos(angle) * radius;
    s.z = Math.sin(angle) * radius;
    s.size = randomIn(1.6, 3);
    s.ttl = randomIn(3.5, 6);
    s.drift = randomIn(-0.4, 0.4);
    s.life = 0;
    s.sprite.visible = true;
  };

  bubbles.forEach((b) => {
    spawnBubble(b);
    b.life = Math.random() * b.ttl;
  });
  steam.forEach((s) => {
    spawnSteam(s);
    s.life = Math.random() * s.ttl;
  });

  const rippleMaterial = track(
    new THREE.MeshBasicMaterial({ color: colors.waterHighlight, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  const rippleGeometry = track(new THREE.RingGeometry(0.9, 1, 48));
  const ripples = options.ripples
    ? Array.from({ length: 6 }, () => {
        const mesh = new THREE.Mesh(rippleGeometry, track(rippleMaterial.clone()));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.015;
        mesh.visible = false;
        scene.add(mesh);
        return { mesh, life: 0, ttl: 0 };
      })
    : [];

  const spawnRipple = (r) => {
    const d = dumplings[Math.floor(Math.random() * dumplings.length)];
    if (!d) return;
    r.mesh.position.x = d.anchor.position.x + randomIn(-0.4, 0.4);
    r.mesh.position.z = d.anchor.position.z + randomIn(-0.4, 0.4);
    r.ttl = randomIn(1.3, 2);
    r.life = 0;
    r.mesh.visible = true;
  };
  ripples.forEach((r) => {
    spawnRipple(r);
    r.life = Math.random() * r.ttl;
  });

  // ---------- Animation ----------
  const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedMotion = () =>
    options.reducedMotion === 'auto' ? Boolean(reducedMotionQuery?.matches) : Boolean(options.reducedMotion);

  let elapsed = 0;
  let lastTime = 0;
  let rafId = 0;
  let paused = Boolean(options.paused);
  let visible = true;
  let destroyed = false;

  const axisMix = () => {
    switch (options.spinAxis) {
      case 'radial':
        return 1;
      case 'mixed':
        return 0.5;
      default:
        return 0;
    }
  };

  const update = (dt) => {
    elapsed += dt;
    const t = elapsed;
    const bobAmp = 0.14 * options.bob;
    const mix = axisMix();

    dumplings.forEach((d) => {
      const angle = d.baseAngle + options.orbitSpeed * t;
      const radius = d.radius + Math.sin(t * 0.9 + d.wobblePhase) * 0.1;
      const lift = Math.sin(t * d.bobRate + d.bobPhase) * bobAmp;
      d.anchor.position.set(Math.cos(angle) * radius, lift + 0.08, Math.sin(angle) * radius);
      // Local +X points outwards from the pot centre, local +Z is the ring tangent.
      d.anchor.rotation.set(0, -angle, 0);

      const spin = options.tumbleSpeed * d.tumbleRate * t + d.tumblePhase;
      const wobble = Math.sin(t * 1.3 + d.wobblePhase) * 0.18;
      d.tumbler.rotation.set(spin * mix + wobble * (1 - mix), 0, -spin * (1 - mix) + wobble * mix);
      d.mesh.rotation.y = d.yaw;

      if (d.shadow) {
        // Shadow drifts away from the key light and shrinks/fades as the pelmen lifts.
        const liftFactor = 1 + lift * 1.5;
        d.shadow.position.set(d.anchor.position.x + 0.22, 0.02, d.anchor.position.z + 0.18);
        d.shadow.scale.setScalar(d.scale * 3.1 * liftFactor);
        d.shadow.material.opacity = 0.28 / liftFactor;
      }
    });

    bubbles.forEach((b) => {
      b.life += dt;
      if (b.life >= b.ttl) spawnBubble(b);
      const p = b.life / b.ttl;
      const grow = THREE.MathUtils.smoothstep(p, 0, 0.6);
      const pop = p > 0.8 ? (p - 0.8) / 0.2 : 0;
      b.sprite.position.set(b.x + Math.sin(b.life * 4) * 0.04, 0.3, b.z);
      b.sprite.scale.setScalar(b.size * (0.4 + 0.6 * grow) * (1 + pop * 0.8));
      b.sprite.material.opacity = 0.8 * grow * (1 - pop);
    });

    steam.forEach((s) => {
      s.life += dt;
      if (s.life >= s.ttl) spawnSteam(s);
      const p = s.life / s.ttl;
      const fade = Math.sin(p * Math.PI);
      s.sprite.position.set(s.x + Math.sin(s.life * 0.6) * 0.4 + s.drift * p * 2, 1.5, s.z - p * 1.2);
      s.sprite.scale.setScalar(s.size * (0.7 + p * 0.8));
      s.sprite.material.opacity = 0.5 * fade;
    });

    ripples.forEach((r) => {
      r.life += dt;
      if (r.life >= r.ttl) spawnRipple(r);
      const p = r.life / r.ttl;
      r.mesh.scale.setScalar(0.4 + p * 1.3);
      r.mesh.material.opacity = 0.3 * (1 - p) * (1 - p);
    });
  };

  const render = () => renderer.render(scene, camera);

  const frame = (time) => {
    rafId = 0;
    if (destroyed || paused || !visible) return;
    const dt = Math.min(0.05, lastTime ? (time - lastTime) / 1000 : 0.016);
    lastTime = time;
    if (reducedMotion()) {
      render();
      return; // static frame; nothing loops
    }
    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  };

  const start = () => {
    if (rafId || destroyed || paused || !visible) return;
    lastTime = 0;
    rafId = requestAnimationFrame(frame);
  };

  const stop = () => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  };

  // ---------- Sizing / visibility ----------
  const resize = () => {
    const width = stage.clientWidth || 1;
    const height = stage.clientHeight || width;
    renderer.setSize(width, height, false);
    fitCamera(width / height);
    if (!rafId) render();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);
  resize();

  const intersectionObserver =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => {
          visible = entries.some((e) => e.isIntersecting);
          if (visible) start();
          else stop();
        })
      : null;
  intersectionObserver?.observe(stage);

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const onMotionChange = () => start();
  reducedMotionQuery?.addEventListener?.('change', onMotionChange);

  // Warm up: advance so the first frame already looks "in motion".
  update(1.5);
  start();

  // ---------- Public API ----------
  return {
    element: root,
    canvas: renderer.domElement,
    scene,
    camera,
    renderer,
    get options() {
      return options;
    },
    setCount(count) {
      options = mergeOptions(options, { count });
      buildDumplings(count);
      update(0);
      if (!rafId) render();
    },
    setSpeed({ orbit, tumble } = {}) {
      options = mergeOptions(options, {
        ...(orbit != null ? { orbitSpeed: orbit } : {}),
        ...(tumble != null ? { tumbleSpeed: tumble } : {}),
      });
    },
    setSpinAxis(spinAxis) {
      options = mergeOptions(options, { spinAxis });
    },
    setLabel(text, position) {
      options = mergeOptions(options, { label: text, ...(position ? { labelPosition: position } : {}) });
      applyLabel();
    },
    pause() {
      paused = true;
      stop();
    },
    resume() {
      paused = false;
      start();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotionQuery?.removeEventListener?.('change', onMotionChange);
      disposables.forEach((d) => d.dispose?.());
      renderer.dispose();
      root.remove();
    },
  };
}
