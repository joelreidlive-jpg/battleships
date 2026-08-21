/**
 * Randomness is injected, never ambient. The Worker passes a CSPRNG-backed
 * source; tests pass a seeded one, which is what makes an AI game replayable
 * from its seed alone.
 */
export type Rng = () => number;

/** Integer in `[0, bound)`. */
export function randomInt(rng: Rng, bound: number): number {
  if (bound <= 0) throw new RangeError('bound must be positive');
  return Math.min(bound - 1, Math.floor(rng() * bound));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new RangeError('cannot pick from an empty list');
  return items[randomInt(rng, items.length)];
}

/** Fisher-Yates, on a copy. */
export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Deterministic mulberry32. Test and replay use only; never for live play. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
