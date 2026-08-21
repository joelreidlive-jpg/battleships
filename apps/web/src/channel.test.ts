import { describe, expect, it } from 'vitest';
import { Channel, type Clock } from './channel.js';

const GAP = 200;

/** A clock the test drives by hand, so cue timing is exact rather than raced. */
function fakeClock() {
  let time = 0;
  let next = 1;
  const timers = new Map<number, { at: number; run: () => void }>();
  const clock: Clock = {
    now: () => time,
    delay: (run, ms) => {
      const id = next;
      next += 1;
      timers.set(id, { at: time + ms, run });
      return id;
    },
    cancel: (id) => {
      timers.delete(id);
    },
  };
  const advance = (ms: number) => {
    const until = time + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      timers.delete(due[0]);
      time = due[1].at;
      due[1].run();
    }
    time = until;
  };
  return { clock, advance, pending: () => timers.size };
}

/** Records when each cue sounded and how long it booked, to look for overlaps. */
function recorder(clock: Clock) {
  const sounded: { name: string; at: number; until: number }[] = [];
  return {
    sounded,
    cue: (channel: Channel, name: string, lengthMs: number) => {
      channel.play(() => sounded.push({ name, at: clock.now(), until: clock.now() + lengthMs }), lengthMs);
    },
    overlaps: () =>
      sounded.filter((cue, index) => index > 0 && cue.at < (sounded[index - 1]?.until ?? 0)).map((cue) => cue.name),
  };
}

describe('Channel', () => {
  it('plays a cue at once when nothing is sounding', () => {
    const { clock } = fakeClock();
    const channel = new Channel(clock, GAP);
    const tape = recorder(clock);

    tape.cue(channel, 'blast', 500);

    expect(tape.sounded.map((cue) => cue.name)).toEqual(['blast']);
    expect(tape.sounded[0]?.at).toBe(0);
  });

  it('holds a cue booked while another is sounding', () => {
    const { clock, advance } = fakeClock();
    const channel = new Channel(clock, GAP);
    const tape = recorder(clock);

    tape.cue(channel, 'blast', 500);
    tape.cue(channel, 'callout', 4000);
    expect(tape.sounded.map((cue) => cue.name)).toEqual(['blast']);

    advance(10_000);
    expect(tape.sounded.map((cue) => cue.name)).toEqual(['blast', 'callout']);
    expect(tape.sounded[1]?.at).toBe(500 + GAP);
  });

  it('never overlaps two exchanges, even when the next arrives mid-callout', () => {
    const { clock, advance } = fakeClock();
    const channel = new Channel(clock, GAP);
    const tape = recorder(clock);

    // A sunk hull: blast, then a four-second taunt.
    tape.cue(channel, 'blast', 520);
    tape.cue(channel, 'kraal', 4232);
    // The player fires again after the invader's 1.7s pause, twice over.
    advance(1700);
    tape.cue(channel, 'blast-2', 520);
    tape.cue(channel, 'hit-2', 1855);
    advance(1700);
    tape.cue(channel, 'blast-3', 520);
    tape.cue(channel, 'hit-3', 2038);
    advance(30_000);

    expect(tape.sounded.map((cue) => cue.name)).toEqual(['blast', 'kraal', 'blast-2', 'hit-2', 'blast-3', 'hit-3']);
    expect(tape.overlaps()).toEqual([]);
  });

  it('takes back a short cue only while nothing is waiting', () => {
    const { clock, advance } = fakeClock();
    const channel = new Channel(clock, GAP);
    const tape = recorder(clock);

    tape.cue(channel, 'long', 5000);
    channel.release();
    tape.cue(channel, 'after-release', 500);
    advance(GAP);
    // The five seconds booked by 'long' are given back, bar the gap.
    expect(tape.sounded.map((cue) => cue.name)).toEqual(['long', 'after-release']);
    expect(tape.sounded[1]?.at).toBe(GAP);

    const held = recorder(clock);
    held.cue(channel, 'sounding', 4000);
    held.cue(channel, 'queued', 500);
    channel.release();
    held.cue(channel, 'behind-queued', 500);
    advance(10_000);
    expect(held.sounded.map((cue) => cue.name)).toEqual(['sounding', 'queued', 'behind-queued']);
    expect(held.overlaps()).toEqual([]);
  });

  it('drops what is waiting when the channel is cleared', () => {
    const { clock, advance, pending } = fakeClock();
    const channel = new Channel(clock, GAP);
    const tape = recorder(clock);

    tape.cue(channel, 'blast', 500);
    tape.cue(channel, 'callout', 4000);
    channel.clear();
    expect(pending()).toBe(0);
    expect(channel.waiting).toBe(0);

    tape.cue(channel, 'verdict', 3527);
    advance(10_000);
    expect(tape.sounded.map((cue) => cue.name)).toEqual(['blast', 'verdict']);
    expect(tape.sounded[1]?.at).toBe(0);
  });
});
