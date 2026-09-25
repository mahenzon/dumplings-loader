// Global JSX typing for the raw <dumplings-loader> tag (Preact, Solid, React <= 18 global JSX, ...).
// Add `/// <reference types="dumplings-loader/jsx" />` to a .d.ts in your project.
import type { DumplingsLoaderAttributes } from './index.js';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'dumplings-loader': DumplingsLoaderAttributes & Record<string, unknown>;
    }
  }
}

export {};
