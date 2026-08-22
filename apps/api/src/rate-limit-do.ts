import { DurableObject } from 'cloudflare:workers';
import { CREATE_LIMIT, CREATE_WINDOW_MS, SlidingWindow } from './rate-limit.js';
import type { Verdict } from './rate-limit.js';

/**
 * One object per client address, so the count is shared by every edge location
 * that address reaches — an isolate-local counter would reset with each new
 * isolate, and so limit nothing. Held in memory only: if the object is evicted
 * the window restarts, which costs a flooder a round trip and a player nothing.
 */
export class RateLimiterDO extends DurableObject {
  private readonly window = new SlidingWindow(CREATE_LIMIT, CREATE_WINDOW_MS);

  take(): Verdict {
    return this.window.take(Date.now());
  }
}
