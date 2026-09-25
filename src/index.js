export { createDumplingsLoader, DEFAULT_OPTIONS, APPEARANCE_NAMES } from './loader.js';
export { createDumplingGeometry } from './dumpling-geometry.js';
export { DumplingsLoaderElement, defineDumplingsLoader } from './element.js';

import { defineDumplingsLoader } from './element.js';

// Auto-register <dumplings-loader> when loaded in a browser.
defineDumplingsLoader();
