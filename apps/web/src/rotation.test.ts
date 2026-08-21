import { describe, expect, it } from 'vitest';
import { Rotation } from './rotation.js';

/** A random source the test drives, so a draw is a choice rather than a race. */
function draws(...values: number[]): () => number {
  let at = 0;
  return () => {
    const value = values[at % values.length];
    at += 1;
    return value;
  };
}

describe('Rotation', () => {
  it('picks the drawn line while nothing is recent', () => {
    expect(new Rotation(['a', 'b', 'c'], draws(0.7)).next()).toBe('c');
  });

  it('never says the same line twice running, however the draw falls', () => {
    const rotation = new Rotation(['a', 'b', 'c', 'd'], draws(0, 0, 0, 0.99, 0.99, 0.5));
    const heard = [rotation.next(), rotation.next(), rotation.next(), rotation.next(), rotation.next(), rotation.next()];
    for (let i = 1; i < heard.length; i += 1) expect(heard[i]).not.toBe(heard[i - 1]);
  });

  it('reaches every line', () => {
    const rotation = new Rotation(['a', 'b', 'c'], draws(0, 0.5, 0.99, 0, 0.99, 0.5));
    const heard = new Set([rotation.next(), rotation.next(), rotation.next(), rotation.next()]);
    expect([...heard].sort()).toEqual(['a', 'b', 'c']);
  });

  it('spreads the remaining lines evenly rather than favouring the neighbour', () => {
    const counts = new Map<string, number>();
    let seed = 1;
    const rotation = new Rotation(['a', 'b', 'c', 'd'], () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    });
    for (let i = 0; i < 4000; i += 1) {
      const line = rotation.next();
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
    for (const line of ['a', 'b', 'c', 'd']) expect(counts.get(line)).toBeGreaterThan(700);
  });

  it('repeats the only line it has', () => {
    const rotation = new Rotation(['a'], draws(0.4));
    expect([rotation.next(), rotation.next()]).toEqual(['a', 'a']);
  });

  it('forgets the last campaign, so any line can open the next one', () => {
    const rotation = new Rotation(['a', 'b'], draws(0.99));
    expect(rotation.next()).toBe('b');
    rotation.reset();
    expect(rotation.next()).toBe('b');
  });

  it('refuses an empty list, which would have nothing to say', () => {
    expect(() => new Rotation([], draws(0))).toThrow(/at least one/);
  });
});
