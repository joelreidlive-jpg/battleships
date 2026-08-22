import { MatchError } from './errors.js';

/** Campaigns one address may start per window. Generous for a person, dull for a script. */
export const CREATE_LIMIT = 20;
export const CREATE_WINDOW_MS = 60_000;

export interface Verdict {
  readonly allowed: boolean;
  /** Whole seconds until the window rolls over, for `Retry-After`. */
  readonly retryAfter: number;
}

/**
 * A sliding window over the timestamps of recent attempts. Kept pure so the
 * decision can be tested against a clock we control rather than a real one.
 */
export class SlidingWindow {
  private hits: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  take(now: number): Verdict {
    this.hits = this.hits.filter((at) => now - at < this.windowMs);
    if (this.hits.length >= this.limit) {
      const oldest = this.hits[0];
      return { allowed: false, retryAfter: Math.ceil((this.windowMs - (now - oldest)) / 1000) };
    }
    this.hits.push(now);
    return { allowed: true, retryAfter: 0 };
  }
}

/**
 * Throttles campaign creation, the one unauthenticated write: everything else
 * needs a token bound to a campaign this caller already owns.
 */
export async function guardCreation(env: Env, address: string): Promise<void> {
  const verdict = await env.RATE_LIMIT.get(env.RATE_LIMIT.idFromName(address)).take();
  if (verdict.allowed) return;
  throw new MatchError(
    `too many campaigns started from this address; try again in ${verdict.retryAfter}s`,
    429,
  );
}
