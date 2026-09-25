import * as THREE from 'three';
import { APPEARANCE_NAMES, getAppearance } from './appearances/index.js';
import { DUMPLING_SCALE, FRAME_RADIUS, RING_RADIUS } from './constants.js';
import { createOutlineMaterial } from './toon.js';
import { createSmoothNoise, randomIn } from './utils.js';
import STYLE from './loader.css?inline';

export { APPEARANCE_NAMES };

export const DEFAULT_OPTIONS = Object.freeze({
  appearance: 'cartoon', // 'cartoon' | 'realistic' (read once on mount)
  count: 7,
  orbitSpeed: 0.35, // rad/s, whole ring drifts around the pot
  tumbleSpeed: 1.7, // rad/s, each pelmen flips over its tangent axis
  spinAxis: 'tangent', // 'tangent' | 'radial' | 'mixed'
  bob: 1, // vertical bobbing multiplier (visible through the contact shadow)
  // 0..1: smooth random drift of each pelmen's slot, radius, tumble speed, tilt and yaw so the ring
  // looks less mechanical. 0 = fully deterministic motion (the same on every mount).
  randomness: 0,
  label: 'Loading',
  labelPosition: 'top', // 'top' | 'bottom' | 'none'
  outline: false, // soft ink outline around meshes (off by default: subtler look)
  bubbles: true,
  steam: true,
  ripples: true,
  shadows: true,
  paused: false,
  reducedMotion: 'auto', // 'auto' | true | false
  pixelRatio: null, // null → min(devicePixelRatio, 2), scaled down a little by the realistic appearance
  // Palette of the default (cartoon) appearance. Each appearance ships its own defaults;
  // anything you pass in `colors` overrides them.
  colors: getAppearance('cartoon').colors,
});

function mergeOptions(base, patch) {
  const out = { ...base, ...patch };
  out.colors = { ...base.colors, ...(patch?.colors || {}) };
  return out;
}

/**
 * Mounts the loader into `container`. Returns a handle with `setCount`, `setSpeed`,
 * `setSpinAxis`, `setRandomness`, `setLabel`, `pause`, `resume`, `destroy`.
 */
export function createDumplingsLoader(container, userOptions = {}) {
  if (!container) throw new Error('dumplings-loader: container element is required');
  const appearanceModule = getAppearance(userOptions.appearance ?? DEFAULT_OPTIONS.appearance);
  let options = mergeOptions({ ...DEFAULT_OPTIONS, colors: appearanceModule.colors }, userOptions);
  const colors = options.colors;

  // ---------- DOM ----------
  const root = document.createElement('div');
  root.className = 'dl-root';
  root.dataset.appearance = appearanceModule.name;
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
    label.classList.toggle('dl-label-top', position === 'top');
  };
  applyLabel();
  container.appendChild(root);

  // ---------- Renderer / camera ----------
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(
    options.pixelRatio ?? Math.min(window.devicePixelRatio || 1, 2) * (appearanceModule.pixelRatioScale ?? 1),
  );
  renderer.setClearColor(0x000000, 0);
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

  const disposables = [];
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

  // ---------- Appearance: lights, pot, water, materials, particle tuning ----------
  const appearance = appearanceModule.create({ scene, renderer, colors, options, track, withOutline });

  // ---------- Dumplings ----------
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
    const scale = Math.min(DUMPLING_SCALE, (Math.PI * 2 * RING_RADIUS) / n / 2.4);
    // How far `randomness` may push a pelmen along the ring: a share of its slot, so neighbours
    // on a crowded ring do not pile up.
    const slotDrift = Math.min(0.12, ((Math.PI * 2) / n) * 0.12);
    for (let i = 0; i < n; i++) {
      const anchor = new THREE.Group();
      const tumbler = new THREE.Group();
      const mesh = new THREE.Mesh(appearance.dumplingGeometry, appearance.dumplingMaterial);
      mesh.scale.setScalar(scale);
      withOutline(mesh);
      tumbler.add(mesh);
      anchor.add(tumbler);
      dumplingsGroup.add(anchor);

      const d = {
        anchor,
        tumbler,
        mesh,
        shadow: null,
        scale,
        baseAngle: (i / n) * Math.PI * 2 + randomIn(-0.08, 0.08),
        radius: RING_RADIUS + randomIn(-0.12, 0.12),
        tumbleRate: randomIn(0.85, 1.15),
        tumblePhase: randomIn(0, Math.PI * 2),
        bobPhase: randomIn(0, Math.PI * 2),
        bobRate: randomIn(1.6, 2.3),
        wobblePhase: randomIn(0, Math.PI * 2),
        yaw: randomIn(-0.25, 0.25),
        slotDrift,
        // Independent smooth noise per channel, only advanced while `randomness` > 0.
        noise: {
          orbit: createSmoothNoise(randomIn(2.5, 4)),
          radius: createSmoothNoise(randomIn(2, 3.5)),
          tumble: createSmoothNoise(randomIn(1, 2)),
          tilt: createSmoothNoise(randomIn(1.5, 2.5)),
          yaw: createSmoothNoise(randomIn(3, 5)),
          bob: createSmoothNoise(randomIn(2, 3)),
        },
        tumbleDrift: 0, // accumulated extra flip angle from the tumble-speed noise
      };
      if (options.shadows && appearance.shadow) {
        d.shadow = appearance.shadow.create(d);
        if (d.shadow) dumplingsGroup.add(d.shadow);
      }
      dumplings.push(d);
    }
  };
  buildDumplings(options.count);

  // ---------- Particles ----------
  const makeSprites = (texture, count, opacity) => {
    const material = track(
      new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity,
        toneMapped: false,
      }),
    );
    return Array.from({ length: count }, () => {
      const sprite = new THREE.Sprite(track(material.clone()));
      sprite.visible = false;
      scene.add(sprite);
      return { sprite, life: 0, ttl: 0, x: 0, z: 0, size: 1, drift: 0 };
    });
  };

  const bubbleConfig = options.bubbles ? appearance.bubbles : null;
  const bubbles = bubbleConfig
    ? makeSprites(bubbleConfig.texture, bubbleConfig.count, bubbleConfig.opacity)
    : [];

  const steamLayers = options.steam
    ? appearance.steam.map((layer) => ({
        layer,
        sprites: makeSprites(layer.texture, layer.count, layer.opacity),
      }))
    : [];

  const spawnBubble = (b) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = bubbleConfig.radius();
    b.x = Math.cos(angle) * radius;
    b.z = Math.sin(angle) * radius;
    b.size = randomIn(...bubbleConfig.size);
    b.ttl = randomIn(...bubbleConfig.ttl);
    b.life = 0;
    b.sprite.visible = true;
  };

  const spawnSteam = (s, layer) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = randomIn(...layer.radius);
    s.x = Math.cos(angle) * radius;
    s.z = Math.sin(angle) * radius;
    s.size = randomIn(...layer.size);
    s.ttl = randomIn(...layer.ttl);
    s.drift = randomIn(-layer.drift, layer.drift);
    s.life = 0;
    s.sprite.visible = true;
  };

  bubbles.forEach((b) => {
    spawnBubble(b);
    b.life = Math.random() * b.ttl;
  });
  steamLayers.forEach(({ layer, sprites }) =>
    sprites.forEach((s) => {
      spawnSteam(s, layer);
      s.life = Math.random() * s.ttl;
    }),
  );

  const rippleConfig = options.ripples ? appearance.ripples : null;
  const rippleMaterial = rippleConfig
    ? track(
        new THREE.MeshBasicMaterial({
          color: rippleConfig.color,
          transparent: true,
          opacity: rippleConfig.opacity,
          depthWrite: false,
          toneMapped: false,
        }),
      )
    : null;
  const rippleGeometry = rippleConfig ? track(new THREE.RingGeometry(rippleConfig.inner, 1, 48)) : null;
  const ripples = rippleConfig
    ? Array.from({ length: rippleConfig.count }, () => {
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
  let randomness = 0; // eases towards options.randomness so live changes never snap
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

    const targetRandomness = Math.max(0, Number(options.randomness) || 0);
    randomness += (targetRandomness - randomness) * Math.min(1, dt * 4);
    if (targetRandomness === 0 && randomness < 1e-3) randomness = 0;
    const jitter = randomness;

    dumplings.forEach((d) => {
      let angle = d.baseAngle + options.orbitSpeed * t;
      let radius = d.radius + Math.sin(t * 0.9 + d.wobblePhase) * 0.1;
      let bobScale = 1;
      let tilt = 0;
      let yaw = d.yaw;
      if (jitter > 0) {
        const n = d.noise;
        angle += n.orbit(dt) * d.slotDrift * jitter;
        radius += n.radius(dt) * 0.18 * jitter;
        d.tumbleDrift += options.tumbleSpeed * d.tumbleRate * n.tumble(dt) * 0.4 * jitter * dt;
        tilt = n.tilt(dt) * 0.14 * jitter;
        yaw += n.yaw(dt) * 0.35 * jitter;
        bobScale = 1 + n.bob(dt) * 0.5 * jitter;
      }

      const lift = Math.sin(t * d.bobRate + d.bobPhase) * bobAmp * bobScale;
      d.anchor.position.set(Math.cos(angle) * radius, lift + appearance.restHeight, Math.sin(angle) * radius);
      // Local +X points outwards from the pot centre, local +Z is the ring tangent.
      d.anchor.rotation.set(0, -angle, 0);

      const spin = options.tumbleSpeed * d.tumbleRate * t + d.tumblePhase + d.tumbleDrift;
      const wobble = Math.sin(t * 1.3 + d.wobblePhase) * 0.18 + tilt;
      d.tumbler.rotation.set(spin * mix + wobble * (1 - mix), 0, -spin * (1 - mix) + wobble * mix);
      d.mesh.rotation.y = yaw;

      if (d.shadow) appearance.shadow.update(d, lift);
    });

    bubbles.forEach((b) => {
      b.life += dt;
      if (b.life >= b.ttl) spawnBubble(b);
      const p = b.life / b.ttl;
      const grow = THREE.MathUtils.smoothstep(p, 0, 0.6);
      const pop = p > 0.8 ? (p - 0.8) / 0.2 : 0;
      b.sprite.position.set(b.x + Math.sin(b.life * 4) * 0.04, bubbleConfig.y, b.z);
      b.sprite.scale.setScalar(b.size * (0.4 + 0.6 * grow) * (1 + pop * 0.8));
      b.sprite.material.opacity = bubbleConfig.opacity * grow * (1 - pop);
    });

    steamLayers.forEach(({ layer, sprites }) =>
      sprites.forEach((s) => {
        s.life += dt;
        if (s.life >= s.ttl) spawnSteam(s, layer);
        const p = s.life / s.ttl;
        const fade = Math.sin(p * Math.PI);
        s.sprite.position.set(s.x + Math.sin(s.life * 0.6) * 0.4 + s.drift * p * 2, layer.y, s.z - p * 1.2);
        s.sprite.scale.setScalar(s.size * (0.7 + p * 0.8));
        s.sprite.material.opacity = layer.opacity * fade;
      }),
    );

    ripples.forEach((r) => {
      r.life += dt;
      if (r.life >= r.ttl) spawnRipple(r);
      const p = r.life / r.ttl;
      r.mesh.scale.setScalar(0.4 + p * 1.3);
      r.mesh.material.opacity = rippleConfig.opacity * (1 - p) * (1 - p);
    });

    appearance.update?.(t, dt);
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
    get appearance() {
      return appearanceModule.name;
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
    setRandomness(level) {
      options = mergeOptions(options, { randomness: Math.max(0, Number(level) || 0) });
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
