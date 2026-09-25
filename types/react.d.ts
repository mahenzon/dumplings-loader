import type { CSSProperties, ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from 'react';
import type {
  Appearance,
  DumplingsLoaderAttributes,
  DumplingsLoaderElement,
  LabelPosition,
  SpinAxis,
} from './index.js';

export interface DumplingsLoaderProps {
  appearance?: Appearance;
  count?: number;
  label?: string;
  labelPosition?: LabelPosition;
  orbitSpeed?: number;
  tumbleSpeed?: number;
  spinAxis?: SpinAxis;
  /** `0`..`1`; `true` means `1`. */
  randomness?: number | boolean;
  paused?: boolean;
  outline?: boolean;
  bubbles?: boolean;
  steam?: boolean;
  ripples?: boolean;
  shadows?: boolean;
  id?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
  [dataOrAria: `data-${string}` | `aria-${string}`]: string | number | boolean | undefined;
}

/**
 * React component wrapping `<dumplings-loader>`. `ref` is the element; `ref.current?.loader`
 * is the imperative handle (`setCount`, `pause`, `destroy`, ...).
 */
export const DumplingsLoader: ForwardRefExoticComponent<
  DumplingsLoaderProps & RefAttributes<DumplingsLoaderElement>
>;

// Lets you write the raw <dumplings-loader> tag in TSX as well.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'dumplings-loader': DumplingsLoaderAttributes &
        HTMLAttributes<DumplingsLoaderElement> &
        RefAttributes<DumplingsLoaderElement>;
    }
  }
}
