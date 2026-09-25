// Compile-only smoke test for the shipped declarations (npm run lint:types). Never executed.
import { useRef } from 'react';
import {
  APPEARANCE_NAMES,
  createDumplingsLoader,
  DEFAULT_OPTIONS,
  DumplingsLoaderElement,
} from 'dumplings-loader';
import { DumplingsLoader } from 'dumplings-loader/react';

const loader = createDumplingsLoader(document.body, {
  appearance: 'realistic',
  count: 5,
  colors: { water: '#ccc' },
});
loader.setSpeed({ orbit: 0.5 });
loader.setLabel('Cooking', 'bottom');
const name: 'cartoon' | 'realistic' = loader.appearance;
const defaults: number = DEFAULT_OPTIONS.count;
const looks: readonly string[] = APPEARANCE_NAMES;

export function Spinner() {
  const ref = useRef<DumplingsLoaderElement>(null);
  return (
    <>
      <DumplingsLoader
        ref={ref}
        appearance="cartoon"
        count={7}
        paused
        style={{ width: 200 }}
        data-testid="x"
      />
      <dumplings-loader appearance="realistic" count={3} label-position="none" />
      <button onClick={() => ref.current?.loader?.pause()}>{name + defaults + looks.length}</button>
    </>
  );
}
