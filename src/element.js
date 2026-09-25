import { createDumplingsLoader, DEFAULT_OPTIONS } from './loader.js';
import HOST_STYLE from './element.css?inline';

const CSS_COLOR_VARS = {
  dough: '--dumplings-dough',
  doughShade: '--dumplings-dough-shade',
  water: '--dumplings-water',
  waterHighlight: '--dumplings-water-highlight',
  pot: '--dumplings-pot',
  potInside: '--dumplings-pot-inside',
  handle: '--dumplings-handle',
  shadow: '--dumplings-shadow',
  waterEdge: '--dumplings-water-edge',
  outline: '--dumplings-outline',
  label: '--dumplings-label',
};

const num = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

const flag = (element, name, fallback) => {
  if (!element.hasAttribute(name)) return fallback;
  const value = element.getAttribute(name);
  return !(value === 'false' || value === '0' || value === 'off');
};

/**
 * <dumplings-loader count="7" label="Loading" orbit-speed="0.35" tumble-speed="1.7" spin-axis="tangent"></dumplings-loader>
 * Size it with CSS (width / height or aspect-ratio). Colours via --dumplings-* custom properties.
 */
export class DumplingsLoaderElement extends HTMLElement {
  static get observedAttributes() {
    return ['count', 'label', 'label-position', 'orbit-speed', 'tumble-speed', 'spin-axis', 'paused'];
  }

  #loader = null;
  #mount = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = HOST_STYLE;
    this.#mount = document.createElement('div');
    this.#mount.className = 'host';
    shadow.append(style, this.#mount);
  }

  connectedCallback() {
    if (this.#loader) return;
    this.#loader = createDumplingsLoader(this.#mount, this.#readOptions());
    if (flag(this, 'paused', false)) this.#loader.pause();
  }

  disconnectedCallback() {
    this.#loader?.destroy();
    this.#loader = null;
  }

  attributeChangedCallback(name, _old, value) {
    const loader = this.#loader;
    if (!loader) return;
    switch (name) {
      case 'count':
        loader.setCount(num(value, DEFAULT_OPTIONS.count));
        break;
      case 'label':
      case 'label-position':
        loader.setLabel(
          this.getAttribute('label') ?? DEFAULT_OPTIONS.label,
          this.getAttribute('label-position') || undefined,
        );
        break;
      case 'orbit-speed':
        loader.setSpeed({ orbit: num(value, DEFAULT_OPTIONS.orbitSpeed) });
        break;
      case 'tumble-speed':
        loader.setSpeed({ tumble: num(value, DEFAULT_OPTIONS.tumbleSpeed) });
        break;
      case 'spin-axis':
        loader.setSpinAxis(value || DEFAULT_OPTIONS.spinAxis);
        break;
      case 'paused':
        if (flag(this, 'paused', false)) loader.pause();
        else loader.resume();
        break;
      default:
    }
  }

  /** Underlying loader handle (scene, camera, renderer, imperative API). */
  get loader() {
    return this.#loader;
  }

  #readOptions() {
    const computed = getComputedStyle(this);
    const colors = {};
    for (const [key, cssVar] of Object.entries(CSS_COLOR_VARS)) {
      const value = computed.getPropertyValue(cssVar).trim();
      if (value) colors[key] = value;
    }
    return {
      count: num(this.getAttribute('count'), DEFAULT_OPTIONS.count),
      label: this.hasAttribute('label') ? this.getAttribute('label') : DEFAULT_OPTIONS.label,
      labelPosition: this.getAttribute('label-position') || DEFAULT_OPTIONS.labelPosition,
      orbitSpeed: num(this.getAttribute('orbit-speed'), DEFAULT_OPTIONS.orbitSpeed),
      tumbleSpeed: num(this.getAttribute('tumble-speed'), DEFAULT_OPTIONS.tumbleSpeed),
      spinAxis: this.getAttribute('spin-axis') || DEFAULT_OPTIONS.spinAxis,
      outline: flag(this, 'outline', DEFAULT_OPTIONS.outline),
      bubbles: flag(this, 'bubbles', DEFAULT_OPTIONS.bubbles),
      steam: flag(this, 'steam', DEFAULT_OPTIONS.steam),
      ripples: flag(this, 'ripples', DEFAULT_OPTIONS.ripples),
      shadows: flag(this, 'shadows', DEFAULT_OPTIONS.shadows),
      colors,
    };
  }
}

export function defineDumplingsLoader(tagName = 'dumplings-loader') {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) customElements.define(tagName, DumplingsLoaderElement);
}
