/**
 * A single audio channel: one cue sounds at a time, and anything asked for
 * while it is busy waits its turn. Kept apart from the sounds themselves, and
 * from the browser, so the ordering can be tested against a fake clock.
 */

export interface Clock {
  now(): number;
  delay(run: () => void, ms: number): number;
  cancel(id: number): void;
}

export const browserClock: Clock = {
  now: () => performance.now(),
  delay: (run, ms) => window.setTimeout(run, ms),
  cancel: (id) => window.clearTimeout(id),
};

export class Channel {
  private freeAt = 0;
  private readonly pending = new Set<number>();

  constructor(
    private readonly clock: Clock,
    /** Silence left between two cues, so they read as separate lines. */
    private readonly gapMs: number,
  ) {}

  /** Cues booked and not yet started. */
  get waiting(): number {
    return this.pending.size;
  }

  /**
   * Sound `cue` as soon as the channel is free, reserving `lengthMs` for it.
   * A cue booked while another is playing is held, never layered on top.
   */
  play(cue: () => void, lengthMs: number): void {
    const start = Math.max(this.clock.now(), this.freeAt);
    this.freeAt = start + lengthMs + this.gapMs;
    const wait = start - this.clock.now();
    if (wait <= 0) {
      cue();
      return;
    }
    const timer = this.clock.delay(() => {
      this.pending.delete(timer);
      cue();
    }, wait);
    this.pending.add(timer);
  }

  /**
   * Give the channel back early, for a cue that turned out shorter than it
   * booked. Ignored while cues are waiting: pulling the channel forward under
   * one of them is exactly how two sounds end up on top of each other.
   */
  release(): void {
    if (this.pending.size === 0) {
      this.freeAt = Math.min(this.freeAt, this.clock.now() + this.gapMs);
    }
  }

  /** Drop everything waiting and free the channel. */
  clear(): void {
    for (const timer of this.pending) this.clock.cancel(timer);
    this.pending.clear();
    this.freeAt = 0;
  }
}
