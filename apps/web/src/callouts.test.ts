import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ALIEN_LOSS_CALLOUTS,
  CALLOUTS,
  HIT_CALLOUTS,
  INCOMING_CALLOUTS,
  LAST_HULL_CALLOUTS,
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

  it('offers a choice at every moment, so nothing is heard twice running', () => {
    for (const moment of [HIT_CALLOUTS, ALIEN_LOSS_CALLOUTS, INCOMING_CALLOUTS, OWN_LOSS_CALLOUTS, LAST_HULL_CALLOUTS]) {
      expect(moment.length).toBeGreaterThan(2);
    }
  });

  it('keeps the Kraal off the crew voices', () => {
    for (const callout of [...ALIEN_LOSS_CALLOUTS, ...INCOMING_CALLOUTS]) expect(callout.voice).toBe('kraal');
    for (const callout of [...HIT_CALLOUTS, ...OWN_LOSS_CALLOUTS, ...LAST_HULL_CALLOUTS]) {
      expect(callout.voice).not.toBe('kraal');
    }
  });
});
