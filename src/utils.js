export function randomIn(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Smooth random signal in [-1, 1]. Every `period` seconds it picks a fresh random target and
 * eases towards it with a smoothstep, so the value (and its slope) never jumps. The returned
 * function advances the signal by `dt` seconds and returns the current value.
 */
export function createSmoothNoise(period) {
  let from = randomIn(-1, 1);
  let to = randomIn(-1, 1);
  let time = Math.random() * period;
  return (dt) => {
    time += dt;
    while (time >= period) {
      time -= period;
      from = to;
      to = randomIn(-1, 1);
    }
    const p = time / period;
    return from + (to - from) * p * p * (3 - 2 * p);
  };
}
