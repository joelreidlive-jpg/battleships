import { describe, expect, it } from 'vitest';
import { CREATE_LIMIT, SlidingWindow, guardCreation } from './rate-limit.js';
import { failureFor } from './errors.js';
import type { Verdict } from './rate-limit.js';

describe('the window on campaign creation', () => {
  it('lets a burst through and then stops it', () => {
    const window = new SlidingWindow(3, 60_000);
    expect([window.take(0), window.take(10), window.take(20)].map((v) => v.allowed)).toEqual([
      true,
      true,
      true,
    ]);
    expect(window.take(30).allowed).toBe(false);
  });

  it('says how long the caller must wait, counting from the oldest attempt', () => {
    const window = new SlidingWindow(1, 60_000);
    window.take(0);
    expect(window.take(15_000)).toEqual({ allowed: false, retryAfter: 45 });
  });

  it('reopens once the oldest attempt leaves the window', () => {
    const window = new SlidingWindow(2, 1_000);
    window.take(0);
    window.take(500);
    expect(window.take(900).allowed).toBe(false);
    expect(window.take(1_000).allowed).toBe(true);
  });

  it('counts each address separately', () => {
    const one = new SlidingWindow(1, 1_000);
    const other = new SlidingWindow(1, 1_000);
    one.take(0);
    expect(one.take(0).allowed).toBe(false);
    expect(other.take(0).allowed).toBe(true);
  });
});

function envAnswering(verdict: Verdict): Env {
  const namespace = {
    idFromName: (name: string) => name,
    get: () => ({ take: () => Promise.resolve(verdict) }),
  };
  return { RATE_LIMIT: namespace } as unknown as Env;
}

describe('the guard on POST /api/matches', () => {
  it('passes an allowed caller through', async () => {
    await expect(
      guardCreation(envAnswering({ allowed: true, retryAfter: 0 }), '203.0.113.1'),
    ).resolves.toBeUndefined();
  });

  it('rejects a flooder as 429, telling them when to come back', async () => {
    const rejection = guardCreation(envAnswering({ allowed: false, retryAfter: 42 }), '203.0.113.1');
    const failure = await rejection.then(() => null).catch((error: unknown) => failureFor(error));
    expect(failure?.status).toBe(429);
    expect(failure?.message).toContain('42s');
  });

  it('allows a person far more campaigns than they could play', () => {
    expect(CREATE_LIMIT).toBeGreaterThanOrEqual(10);
  });
});
