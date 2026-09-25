import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { defineDumplingsLoader } from './element.js';

// camelCase prop → attribute of <dumplings-loader>. Anything else (id, style, data-*, aria-*) passes through.
const ATTRIBUTES = {
  appearance: 'appearance',
  count: 'count',
  label: 'label',
  labelPosition: 'label-position',
  orbitSpeed: 'orbit-speed',
  tumbleSpeed: 'tumble-speed',
  spinAxis: 'spin-axis',
  paused: 'paused',
  outline: 'outline',
  bubbles: 'bubbles',
  steam: 'steam',
  ripples: 'ripples',
  shadows: 'shadows',
};

/**
 * React wrapper around <dumplings-loader>. Works with React 17+, SSR-safe (the element is
 * registered in an effect). `ref` gives you the element; `ref.current.loader` is the imperative handle.
 *
 *   <DumplingsLoader appearance="realistic" count={5} label="Loading" style={{ width: 200 }} />
 */
export const DumplingsLoader = forwardRef(({ className, ...props }, ref) => {
  const element = useRef(null);
  useImperativeHandle(ref, () => element.current, []);
  useEffect(() => {
    defineDumplingsLoader();
  }, []);

  const attributes = { ref: element };
  if (className != null) attributes.class = className;
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    // Booleans become "true" / "false" strings: the element reads "false" as off (works in React 17-19).
    attributes[ATTRIBUTES[key] ?? key] = typeof value === 'boolean' ? String(value) : value;
  }
  return createElement('dumplings-loader', attributes);
});
DumplingsLoader.displayName = 'DumplingsLoader';
