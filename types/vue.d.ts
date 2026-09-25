import type { DefineComponent } from 'vue';
import type { Appearance, DumplingsLoaderAttributes, LabelPosition, SpinAxis } from './index.js';

export interface DumplingsLoaderProps {
  appearance?: Appearance;
  count?: number | string;
  label?: string;
  labelPosition?: LabelPosition;
  orbitSpeed?: number | string;
  tumbleSpeed?: number | string;
  spinAxis?: SpinAxis;
  /** `0`..`1`; `true` means `1`. */
  randomness?: number | boolean | string;
  paused?: boolean;
  outline?: boolean;
  bubbles?: boolean;
  steam?: boolean;
  ripples?: boolean;
  shadows?: boolean;
}

/**
 * Vue 3 component wrapping `<dumplings-loader>`. `class`, `style`, `id` fall through to the
 * element. A template ref on it gives the element (`ref.value.$el.loader` is the imperative handle).
 */
export const DumplingsLoader: DefineComponent<DumplingsLoaderProps>;

// Types the raw <dumplings-loader> tag in templates (vue-tsc / Volar). Attribute names are
// kebab-case: `label-position`, `:orbit-speed`. Bind kebab-case only: Vue sets unknown camelCase
// props on custom elements as lowercased attributes, which the element does not read.
declare module 'vue' {
  interface GlobalComponents {
    'dumplings-loader': DefineComponent<DumplingsLoaderAttributes>;
  }
}
