import * as cartoon from './cartoon.js';
import * as realistic from './realistic.js';

const APPEARANCES = { cartoon, realistic };

export const APPEARANCE_NAMES = Object.freeze(Object.keys(APPEARANCES));

export function getAppearance(name) {
  const appearance = APPEARANCES[name];
  if (!appearance) {
    throw new Error(
      `dumplings-loader: unknown appearance "${name}" (expected ${APPEARANCE_NAMES.join(' | ')})`,
    );
  }
  return appearance;
}
