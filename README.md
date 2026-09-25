# dumplings-loader

[![CI](https://github.com/mahenzon/dumplings-loader/actions/workflows/ci.yaml/badge.svg)](https://github.com/mahenzon/dumplings-loader/actions/workflows/ci.yaml)
[![npm](https://img.shields.io/npm/v/dumplings-loader)](https://www.npmjs.com/package/dumplings-loader)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Loading indicator built with [Three.js](https://threejs.org): pelmeni tumbling in a boiling pot,
seen straight from above. One tag, two looks, works in any stack.

<p align="center">
  <a href="https://mahenzon.github.io/dumplings-loader/">
    <img src="https://raw.githubusercontent.com/mahenzon/dumplings-loader/master/docs/demo.webp" alt="dumplings-loader: cartoon and realistic looks side by side" width="760">
  </a>
  <br>
  <a href="https://mahenzon.github.io/dumplings-loader/"><b>▶ Live demo</b></a> — it moves: pelmeni tumble and bob, the water shimmers, steam drifts.
</p>

- **`cartoon`** (default): soft cel shading, painted water, contact shadows, bubbles, ripples, steam.
- **`realistic`**: PBR stainless steel with a rolled rim and a phenolic handle, environment
  reflections, translucent milky broth with a shimmering surface, pelmeni that sink into the water
  and get veiled by it, real cast shadows (pot on the table, wall on the water), dense steam haze
  and a slight soft focus. Modelled on a phone video of the real thing.

Both looks share the same physics and options. Ships as a framework-agnostic **Web Component**
(`<dumplings-loader>`), a plain **JS API** and a **React wrapper**. Works in static HTML, React,
Vue, Angular, Svelte, Next.js / Nuxt (SSR-safe). Fully procedural: nothing to download at runtime.
~11 KB gzipped on top of Three.js.

## Quick start

### Static page, no build step

```html
<dumplings-loader appearance="realistic" count="7" label="Loading"></dumplings-loader>
<script src="https://unpkg.com/dumplings-loader"></script>
```

That file bundles Three.js (~150 KB gzipped) and registers the tag. Pin a version in production:
`https://unpkg.com/dumplings-loader@1.0.0`. Same file on jsDelivr:
`https://cdn.jsdelivr.net/npm/dumplings-loader`, and, unversioned, from GitHub Pages:
`https://mahenzon.github.io/dumplings-loader/dist/dumplings-loader.standalone.iife.js`.

Already loading Three.js on the page? Use the ES module build with an import map so both share
one copy: see [examples/static-esm.html](examples/static-esm.html).

### With a bundler (Vite, webpack, Next.js, Nuxt, Angular CLI, SvelteKit, ...)

```bash
npm install dumplings-loader three
```

```js
import 'dumplings-loader'; // registers <dumplings-loader>
```

`three` is a peer dependency (>= 0.160); your bundler tree-shakes it.

## Frameworks

### React

```jsx
import { DumplingsLoader } from 'dumplings-loader/react';

export function Spinner({ busy }) {
  return (
    <DumplingsLoader appearance="realistic" count={7} label="Loading" paused={!busy} style={{ width: 200 }} />
  );
}
```

Props are the attributes in camelCase (`labelPosition`, `orbitSpeed`, `tumbleSpeed`, `spinAxis`,
`randomness`, `paused`, `outline`, `bubbles`, `steam`, `ripples`, `shadows`) plus `className`,
`style`, `id`, `data-*` / `aria-*`. `ref` gives you the element; `ref.current.loader` is the
[imperative handle](#plain-js-api). React 17+, marked `'use client'` for the Next.js App Router.

The raw tag works too (`import 'dumplings-loader'`, then `<dumplings-loader count={7} />`); the
`dumplings-loader/react` types teach TSX about it.

### Vue 3

```vue
<script setup>
import 'dumplings-loader';
</script>

<template>
  <dumplings-loader appearance="realistic" :count="7" label="Loading" style="width: 200px" />
</template>
```

Tell the template compiler it is a custom element, otherwise Vue warns about an unknown component:

```js
// vite.config.js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'dumplings-loader' } } });
```

Nuxt: same option under `vue.compilerOptions` in `nuxt.config`, and import the package from a
`plugins/dumplings.client.js` plugin (or inside `<ClientOnly>`).

### Angular

```ts
// main.ts (or any file that runs in the browser)
import 'dumplings-loader';
```

```ts
@Component({
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<dumplings-loader
    appearance="realistic"
    [attr.count]="count"
    label="Loading"
  ></dumplings-loader>`,
})
export class SpinnerComponent {
  count = 7;
}
```

### Svelte / SvelteKit

```svelte
<script>
  import { onMount } from 'svelte';
  onMount(() => import('dumplings-loader')); // dynamic import keeps SvelteKit SSR happy
</script>

<dumplings-loader appearance="realistic" count="7" label="Loading" style="width: 200px"></dumplings-loader>
```

### Server-side rendering (Next.js, Nuxt, SvelteKit, Astro)

Importing the package on the server is safe: it touches no browser globals at import time and
registers the element only when `customElements` exists. The tag renders empty on the server and
upgrades in the browser. Astro: put the tag in the `.astro` file and add
`<script>import 'dumplings-loader';</script>`.

## Options

Attributes of `<dumplings-loader>` (the JS API takes the same options in camelCase):

| Attribute                                   | Default   | Description                                                                                   |
| ------------------------------------------- | --------- | --------------------------------------------------------------------------------------------- |
| `appearance`                                | `cartoon` | `cartoon` or `realistic`. Changing it rebuilds the scene (same physics, different materials). |
| `count`                                     | `7`       | Number of pelmeni on the ring. Live-updatable.                                                |
| `label`                                     | `Loading` | Text over/under the pot. Empty string hides it.                                               |
| `label-position`                            | `top`     | `top`, `bottom` or `none`.                                                                    |
| `orbit-speed`                               | `0.35`    | Ring rotation, rad/s. Negative reverses direction.                                            |
| `tumble-speed`                              | `1.7`     | Per-pelmen flip speed, rad/s.                                                                 |
| `spin-axis`                                 | `tangent` | `tangent` (flip toward the centre, like the video), `radial` (roll along the ring), `mixed`.  |
| `randomness`                                | `0`       | `0`–`1`: smooth random drift (slot, radius, flip speed, tilt). Bare = `1`. Live-updatable.    |
| `paused`                                    | –         | Present (and not `"false"`) → animation paused.                                               |
| `outline`                                   | `false`   | Thin ink outline around meshes (read once on mount).                                          |
| `bubbles` / `steam` / `ripples` / `shadows` | `true`    | Set to `"false"` to disable a layer (read once on mount).                                     |

Size it with CSS. The host defaults to `display: inline-block; width: 320px; aspect-ratio: 1`.

Colours are CSS custom properties, read once on mount: `--dumplings-dough`, `--dumplings-water`,
`--dumplings-water-edge`, `--dumplings-water-highlight`, `--dumplings-pot`, `--dumplings-pot-inside`,
`--dumplings-handle`, `--dumplings-shadow`, `--dumplings-outline`, `--dumplings-label`. Each look
has its own default palette (blue-ish cartoon water vs. grey milky broth); a custom property
overrides the default of whichever look is active. In `realistic` mode `--dumplings-water-edge`
is the foam near the wall and `--dumplings-water` also tints submerged pelmeni.

```css
dumplings-loader {
  width: 240px;
  --dumplings-water: #f3dde2;
  --dumplings-water-edge: #d8b9c2;
  --dumplings-pot: #e6dbe9;
  --dumplings-pot-inside: #a58fae;
}
dumplings-loader::part(label) {
  font-family: 'Comic Neue', cursive;
}
```

Shadow parts: `::part(stage)` (canvas wrapper), `::part(label)`. The element exposes the
imperative handle as `element.loader`.

## Plain JS API

```js
import { createDumplingsLoader } from 'dumplings-loader';

const loader = createDumplingsLoader(document.querySelector('#spinner'), {
  appearance: 'realistic', // or 'cartoon' (default)
  count: 7,
  orbitSpeed: 0.35,
  tumbleSpeed: 1.7,
  spinAxis: 'tangent',
  randomness: 0, // 0..1, a little organic drift; off by default
  label: 'Loading',
  labelPosition: 'top',
  colors: { water: '#dbe8ee', dough: '#f2e3c3' },
});

loader.setCount(9);
loader.setSpeed({ orbit: 0.5, tumble: 2 });
loader.setRandomness(0.5);
loader.setLabel('Cooking');
loader.pause();
loader.resume();
loader.destroy(); // frees WebGL resources, removes DOM
```

The handle also exposes `scene`, `camera`, `renderer`, `canvas` and the active `appearance` name.
`appearance` is read once: to switch looks, `destroy()` and create a new loader (the Web Component
does this for you when the attribute changes). `APPEARANCE_NAMES` lists the available looks,
`createDumplingGeometry(options)` returns just the pelmen mesh.

## TypeScript

Declarations ship with the package for `dumplings-loader` and `dumplings-loader/react`. To type
the raw `<dumplings-loader>` tag outside React (Preact, Solid, React <= 18 with the global `JSX`
namespace) add a reference in any `.d.ts` of your project:

```ts
/// <reference types="dumplings-loader/jsx" />
```

## Package layout

| Import                                                                | What                                                                       |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `dumplings-loader`                                                    | ES module, `three` external (peer). Registers the element.                 |
| `dumplings-loader/react`                                              | React component wrapper (`react` optional peer).                           |
| `dumplings-loader/standalone`                                         | ES module with Three.js bundled.                                           |
| `https://unpkg.com/dumplings-loader` (IIFE, `window.DumplingsLoader`) | Script tag with Three.js bundled; also `dumplings-loader/standalone-iife`. |
| `dumplings-loader/jsx`                                                | Types only: global JSX typing for the tag.                                 |

## Behaviour

- Renders on a transparent canvas, so it sits on any background.
- Pauses automatically when off-screen or when the tab is hidden.
- Honours `prefers-reduced-motion` (renders one static frame). Override with `reducedMotion: false`.
- Motion is deterministic by default (only the initial phases are random). `randomness` adds a
  smooth, low-frequency random drift per pelmen; it never jumps and is eased in when changed live.
- Pixel ratio capped at 2 (the realistic look renders at 0.7x of that for a soft-focus feel).
  Override with the `pixelRatio` option.
- Everything is procedural: no textures or models to load; the realistic look generates its noise
  maps and environment map on mount.

## Development

```bash
npm install
npm run dev           # demo at http://localhost:5173; /examples/react.html tests the React wrapper
npm run build         # dist/ (lib + react entry + standalone builds)
npm run build:site    # site/ (demo for GitHub Pages; set BASE_PATH=/<repo>/ for project pages)
npm run preview:site  # serve site/ locally
npm run lint          # ESLint + Stylelint + html-validate + tsc (types) + Prettier check
npm run format        # Prettier write
npm run capture       # then open /scripts/capture.html on the dev server → regenerates docs/demo.webp
```

`examples/standalone.html` tests the IIFE build after `npm run build`; `examples/static-cdn.html`
and `examples/static-esm.html` are the copy-paste templates for static pages.

## Releasing

Push to `master` redeploys the demo site; pushing a `v*` tag (`npm version minor && git push --follow-tags`)
publishes to npm with provenance and creates a GitHub release. One-time setup and the full
checklist: [RELEASING.md](RELEASING.md).

## License

[MIT](LICENSE)
