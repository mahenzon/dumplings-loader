import type { BufferGeometry, OrthographicCamera, Scene, WebGLRenderer } from 'three';

export type Appearance = 'cartoon' | 'realistic';
export type SpinAxis = 'tangent' | 'radial' | 'mixed';
export type LabelPosition = 'top' | 'bottom' | 'none';

export interface DumplingsColors {
  dough?: string;
  water?: string;
  waterEdge?: string;
  waterHighlight?: string;
  pot?: string;
  potInside?: string;
  handle?: string;
  shadow?: string;
  outline?: string;
  label?: string;
}

export interface DumplingsLoaderOptions {
  /** `cartoon` (default) or `realistic`. Read once on mount. */
  appearance?: Appearance;
  /** Number of pelmeni on the ring. */
  count?: number;
  /** Ring rotation, rad/s. Negative reverses. */
  orbitSpeed?: number;
  /** Per-pelmen flip speed, rad/s. */
  tumbleSpeed?: number;
  spinAxis?: SpinAxis;
  /** Vertical bobbing multiplier. */
  bob?: number;
  /** Label text; empty string hides it. */
  label?: string;
  labelPosition?: LabelPosition;
  /** Thin ink outline around meshes. */
  outline?: boolean;
  bubbles?: boolean;
  steam?: boolean;
  ripples?: boolean;
  shadows?: boolean;
  paused?: boolean;
  /** `'auto'` honours `prefers-reduced-motion`. */
  reducedMotion?: 'auto' | boolean;
  /** `null` → `min(devicePixelRatio, 2)` (scaled down a little by the realistic look). */
  pixelRatio?: number | null;
  colors?: DumplingsColors;
}

export type ResolvedDumplingsLoaderOptions = Readonly<
  Required<Omit<DumplingsLoaderOptions, 'colors'>> & { colors: Readonly<Required<DumplingsColors>> }
>;

export interface DumplingsLoaderHandle {
  /** Root element mounted into the container. */
  readonly element: HTMLElement;
  readonly canvas: HTMLCanvasElement;
  readonly scene: Scene;
  readonly camera: OrthographicCamera;
  readonly renderer: WebGLRenderer;
  readonly options: ResolvedDumplingsLoaderOptions;
  readonly appearance: Appearance;
  setCount(count: number): void;
  setSpeed(speed: { orbit?: number; tumble?: number }): void;
  setSpinAxis(spinAxis: SpinAxis): void;
  setLabel(text: string, position?: LabelPosition): void;
  pause(): void;
  resume(): void;
  /** Stops the loop, frees WebGL resources and removes the DOM. */
  destroy(): void;
}

export interface DumplingGeometryOptions {
  ringRadius?: number;
  tube?: number;
  height?: number;
  arc?: number;
  crimp?: number;
  crimpWaves?: number;
  uSegments?: number;
  vSegments?: number;
}

export const DEFAULT_OPTIONS: ResolvedDumplingsLoaderOptions;
export const APPEARANCE_NAMES: readonly Appearance[];

/** Mounts the loader into `container` and starts animating. */
export function createDumplingsLoader(
  container: HTMLElement,
  options?: DumplingsLoaderOptions,
): DumplingsLoaderHandle;

/** Procedural pelmen mesh, if you only want the geometry. */
export function createDumplingGeometry(options?: DumplingGeometryOptions): BufferGeometry;

/**
 * `<dumplings-loader>` custom element. Attributes: `appearance`, `count`, `label`, `label-position`,
 * `orbit-speed`, `tumble-speed`, `spin-axis`, `paused`, `outline`, `bubbles`, `steam`, `ripples`, `shadows`.
 */
export class DumplingsLoaderElement extends HTMLElement {
  static get observedAttributes(): string[];
  /** Imperative handle of the mounted loader (null before connect / after disconnect). */
  readonly loader: DumplingsLoaderHandle | null;
}

/** Registers the custom element (no-op if already registered or outside a browser). */
export function defineDumplingsLoader(tagName?: string): void;

/** Attributes accepted by `<dumplings-loader>` in JSX-like templates. */
export interface DumplingsLoaderAttributes {
  appearance?: Appearance;
  count?: number | string;
  label?: string;
  'label-position'?: LabelPosition;
  'orbit-speed'?: number | string;
  'tumble-speed'?: number | string;
  'spin-axis'?: SpinAxis;
  paused?: boolean | string;
  outline?: boolean | string;
  bubbles?: boolean | string;
  steam?: boolean | string;
  ripples?: boolean | string;
  shadows?: boolean | string;
}
