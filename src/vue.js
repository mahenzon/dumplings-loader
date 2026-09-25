import { defineComponent, h } from 'vue';
import { defineDumplingsLoader } from './element.js';

// camelCase prop → attribute of <dumplings-loader>. class / style / id / data-* fall through as attrs.
const ATTRIBUTES = {
  appearance: 'appearance',
  count: 'count',
  label: 'label',
  labelPosition: 'label-position',
  orbitSpeed: 'orbit-speed',
  tumbleSpeed: 'tumble-speed',
  spinAxis: 'spin-axis',
  randomness: 'randomness',
  paused: 'paused',
  outline: 'outline',
  bubbles: 'bubbles',
  steam: 'steam',
  ripples: 'ripples',
  shadows: 'shadows',
};

/**
 * Vue 3 wrapper around <dumplings-loader>: camelCase props, works in templates without
 * `isCustomElement`, SSR-safe (Nuxt). Get the element with a template ref; `el.loader` is the
 * imperative handle. The raw tag works too; importing this module types it for vue-tsc.
 *
 *   <DumplingsLoader appearance="realistic" :count="5" label="Loading" style="width: 200px" />
 */
export const DumplingsLoader = defineComponent({
  name: 'DumplingsLoader',
  props: {
    appearance: String,
    count: [Number, String],
    label: String,
    labelPosition: String,
    orbitSpeed: [Number, String],
    tumbleSpeed: [Number, String],
    spinAxis: String,
    // `default: undefined` disables Vue's Boolean casting, so an absent prop keeps the element default.
    randomness: { type: [Number, Boolean, String], default: undefined },
    paused: Boolean,
    outline: Boolean,
    bubbles: { type: Boolean, default: true },
    steam: { type: Boolean, default: true },
    ripples: { type: Boolean, default: true },
    shadows: { type: Boolean, default: true },
  },
  setup(props) {
    defineDumplingsLoader();
    return () => {
      const attributes = {};
      for (const [key, value] of Object.entries(props)) {
        if (value == null) continue;
        // Booleans become "true" / "false" strings: the element reads "false" as off.
        attributes[ATTRIBUTES[key]] = typeof value === 'boolean' ? String(value) : value;
      }
      return h('dumplings-loader', attributes);
    };
  },
});
