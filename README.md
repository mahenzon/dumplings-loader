# dumplings-loader

Stylised loading indicator built with [Three.js](https://threejs.org): pelmeni tumbling in a
boiling pot, seen straight from above (orthographic, no perspective). Soft cel shading, contact
shadows, bubbles, ripples and steam haze.
Ships as a framework-agnostic **Web Component** plus a plain JS API, so it drops into React, Vue,
Svelte, Angular or vanilla HTML.

Live demo: `https://<your-github-user>.github.io/dumplings-loader/` (deployed from `master` by GitHub Actions).

## Install

```bash
npm install dumplings-loader three
```

`three` is a peer dependency (>= 0.160). Your bundler tree-shakes it, the loader itself is ~7 KB gzipped.

No bundler? Use the standalone build that bundles Three.js:

```html
<script src="https://unpkg.com/dumplings-loader/dist/dumplings-loader.standalone.iife.js"></script>
<dumplings-loader></dumplings-loader>
```

## Usage

### Web Component (any framework)

```html
<script type="module">
  import 'dumplings-loader';
</script>

<dumplings-loader count="7" label="Loading"></dumplings-loader>
```

Size it with CSS. The host defaults to `display: inline-block; width: 320px; aspect-ratio: 1`.

```css
dumplings-loader {
  width: 240px;
  --dumplings-water: #f3dde2;
  --dumplings-water-edge: #d8b9c2;
  --dumplings-pot: #e6dbe9;
  --dumplings-pot-inside: #a58fae;
}
dumplings-loader::part(label) { font-family: 'Comic Neue', cursive; }
```

| Attribute        | Default   | Description                                                   |
| ---------------- | --------- | ------------------------------------------------------------- |
| `count`          | `7`       | Number of pelmeni on the ring. Live-updatable.                |
| `label`          | `Loading` | Text under/over the pot. Empty string hides it.               |
| `label-position` | `top`     | `top`, `bottom` or `none`.                                    |
| `orbit-speed`    | `0.35`    | Ring rotation, rad/s. Negative reverses direction.            |
| `tumble-speed`   | `1.7`     | Per-pelmen flip speed, rad/s.                                 |
| `spin-axis`      | `tangent` | `tangent` (flip toward the centre, like the video), `radial` (roll along the ring), `mixed`. |
| `paused`         | –         | Present → animation paused.                                   |
| `outline`        | `false`   | Set `outline` to add a thin ink outline around meshes (read once on mount). |
| `bubbles` / `steam` / `ripples` / `shadows` | `true` | Set to `"false"` to disable a layer (read once on mount). |

CSS custom properties (read once on mount): `--dumplings-dough`, `--dumplings-water`,
`--dumplings-water-edge`, `--dumplings-water-highlight`, `--dumplings-pot`, `--dumplings-pot-inside`,
`--dumplings-handle`, `--dumplings-shadow`, `--dumplings-outline`, `--dumplings-label`.

Shadow parts: `::part(stage)` (canvas wrapper), `::part(label)`.

The element exposes the imperative handle as `element.loader` (see below).

### React

```jsx
import 'dumplings-loader';

export function Spinner({ count = 7 }) {
  return <dumplings-loader count={count} label="Loading" style={{ width: 200 }} />;
}
```

### Vue

```vue
<script setup>
import 'dumplings-loader';
</script>

<template>
  <dumplings-loader :count="7" label="Loading" style="width: 200px" />
</template>
```

Add `dumplings-loader` to `compilerOptions.isCustomElement` if Vue warns about an unknown element.

### Plain JS API

```js
import { createDumplingsLoader } from 'dumplings-loader';

const loader = createDumplingsLoader(document.querySelector('#spinner'), {
  count: 7,
  orbitSpeed: 0.35,
  tumbleSpeed: 1.7,
  spinAxis: 'tangent',
  label: 'Loading',
  labelPosition: 'top',
  colors: { water: '#dbe8ee', dough: '#f2e3c3' },
});

loader.setCount(9);
loader.setSpeed({ orbit: 0.5, tumble: 2 });
loader.setLabel('Cooking');
loader.pause();
loader.resume();
loader.destroy(); // frees WebGL resources, removes DOM
```

The handle also exposes `scene`, `camera`, `renderer` and `canvas` if you want to tinker.

`createDumplingGeometry(options)` is exported too if you just want the pelmen mesh.

## Behaviour

- Renders on a transparent canvas, so it sits on any background.
- Pauses automatically when off-screen or when the tab is hidden.
- Honours `prefers-reduced-motion` (renders one static frame). Override with `reducedMotion: false`.
- Pixel ratio capped at 2. Override with the `pixelRatio` option.

## Development

```bash
npm install
npm run dev           # demo at http://localhost:5173 (examples/standalone.html tests the IIFE build after `npm run build`)
npm run build         # dist/ (lib + standalone builds)
npm run build:site    # site/ (demo for GitHub Pages; set BASE_PATH=/<repo>/ for project pages)
npm run preview:site  # serve site/ locally
```

## Releasing to GitHub Pages

`.github/workflows/pages.yml` builds the library and the demo site on every push to `master` and
deploys `site/` (with `dist/` copied inside) to GitHub Pages. One-time setup in the repository:
Settings → Pages → Source: **GitHub Actions**.
