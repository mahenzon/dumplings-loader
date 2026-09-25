# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

## [1.0.0] - 2026-09-25

First public release.

### Added

- `<dumplings-loader>` Web Component and `createDumplingsLoader()` JS API: pelmeni tumbling in a
  boiling pot, top-down orthographic Three.js scene with bubbles, ripples, steam and shadows.
- Two looks sharing the same physics and options, selected with `appearance`: `cartoon`
  (cel-shaded) and `realistic` (PBR steel, translucent milky broth, submerged pelmeni, real cast
  shadows, steam haze, soft focus).
- Options / attributes: `count`, `label`, `label-position`, `orbit-speed`, `tumble-speed`,
  `spin-axis`, `randomness`, `paused`, `outline`, `bubbles`, `steam`, `ripples`, `shadows`,
  `reducedMotion`, `pixelRatio`, `colors`; CSS custom properties `--dumplings-*` and
  `::part(stage)` / `::part(label)`.
- Live-updatable `count`, speeds, spin axis and label; `appearance` rebuilds the scene.
- Framework entries: `dumplings-loader/react` (typed wrapper, `'use client'`) and
  `dumplings-loader/vue` (typed wrapper, types the raw tag for vue-tsc); SSR-safe import.
- TypeScript declarations, `dumplings-loader/jsx` for global JSX typing of the raw tag.
- Standalone builds with Three.js bundled (`dumplings-loader/standalone`, IIFE for `<script>`
  via unpkg / jsDelivr / GitHub Pages).
- Automatic pause when off-screen or the tab is hidden; `prefers-reduced-motion` support.
- GitHub Pages demo, CI, release workflow with npm provenance.

[Unreleased]: https://github.com/mahenzon/dumplings-loader/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mahenzon/dumplings-loader/releases/tag/v1.0.0
