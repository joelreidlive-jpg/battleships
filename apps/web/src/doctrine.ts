/**
 * How each targeting doctrine is described to the player. The algorithms live
 * in `@bs/ai` and the multipliers in `@bs/rules`; this is only the wording, so
 * the briefing and the masthead say the same thing about the same opponent.
 */

import type { Difficulty } from '@bs/rules';

export const DOCTRINE_LABEL: Record<Difficulty, { readonly name: string; readonly blurb: string }> = {
  scout: { name: 'Scout Wave', blurb: 'Unco-ordinated probing fire. Score x1.' },
  raider: { name: 'Raider Flight', blurb: 'Sweeps, then hunts what it finds. Score x1.5.' },
  overmind: { name: 'Overmind', blurb: 'Reasons about every hull you could still have. Score x2.' },
};
