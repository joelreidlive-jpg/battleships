import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALIEN_LOSS_CALLOUTS,
  CALLOUTS,
  HIT_CALLOUTS,
  INCOMING_CALLOUTS,
  LAST_SHIP_CALLOUTS,
  OWN_LOSS_CALLOUTS,
} from './callouts.js';

const AUDIO = fileURLToPath(new URL('../public/audio/', import.meta.url));

describe('callouts', () => {
  it('has a rendered clip for every line', () => {
    const missing = CALLOUTS.filter((callout) => !existsSync(`${AUDIO}${callout.clip}`)).map((callout) => callout.clip);
    expect(missing).toEqual([]);
  });

  it('gives each line its own clip', () => {
    expect(new Set(CALLOUTS.map((callout) => callout.clip)).size).toBe(CALLOUTS.length);
  });

  it('offers enough readings of every moment that a campaign does not settle into a script', () => {
    for (const moment of [HIT_CALLOUTS, ALIEN_LOSS_CALLOUTS, INCOMING_CALLOUTS, OWN_LOSS_CALLOUTS, LAST_SHIP_CALLOUTS]) {
      expect(moment.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('calls a craft a ship, as the screen does', () => {
    const spoken = CALLOUTS.filter((callout) => /hull/i.test(callout.line)).map((callout) => callout.line);
    expect(spoken).toEqual([]);
  });

  it('keeps the Kraal off the crew voices', () => {
    for (const callout of [...ALIEN_LOSS_CALLOUTS, ...INCOMING_CALLOUTS]) expect(callout.voice).toBe('kraal');
    for (const callout of [...HIT_CALLOUTS, ...OWN_LOSS_CALLOUTS, ...LAST_SHIP_CALLOUTS]) {
      expect(callout.voice).not.toBe('kraal');
    }
  });
});
