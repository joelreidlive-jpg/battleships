import { type Difficulty, DIFFICULTIES, SCORE_MULTIPLIER } from '@bs/rules';

/**
 * The player-facing description of each doctrine, and the one the
 * documentation is generated from. Keeping it beside the implementation is
 * what stops the published description drifting from what the invader does.
 */
export interface Doctrine {
  readonly id: Difficulty;
  readonly name: string;
  readonly tagline: string;
  /** How the shot is chosen, in one sentence a product owner can check. */
  readonly targeting: string;
  /** Mean shots to destroy all 20 sections, measured by `pnpm bench`. */
  readonly expectedShots: number;
  /**
   * Mean shots to destroy every hull larger than a submarine, also from
   * `pnpm bench`. The four single-section submarines can only be found by
   * searching, so this is the figure that separates the doctrines.
   */
  readonly expectedHuntShots: number;
  readonly scoreMultiplier: number;
}

export const DOCTRINES: Record<Difficulty, Doctrine> = {
  scout: {
    id: 'scout',
    name: 'Scout Wave',
    tagline: 'Probing fire, no coordination.',
    targeting: 'Fires at a uniformly random cell it has not tried before, ignoring its own hits.',
    expectedShots: 96.7,
    expectedHuntShots: 95.5,
    scoreMultiplier: SCORE_MULTIPLIER.scout,
  },
  raider: {
    id: 'raider',
    name: 'Raider Flight',
    tagline: 'Hunts on a parity sweep, then finishes what it finds.',
    targeting:
      'Sweeps cells on a diagonal whose spacing equals the smallest hull still afloat; on a hit, works outward along the axis the hits establish.',
    expectedShots: 85.6,
    expectedHuntShots: 66.4,
    scoreMultiplier: SCORE_MULTIPLIER.raider,
  },
  overmind: {
    id: 'overmind',
    name: 'Overmind',
    tagline: 'Counts every arrangement your fleet could still be in.',
    targeting:
      'Counts, for every untried cell, how many placements of the surviving hulls are consistent with its shot history — weighting those that explain a known hit — and fires at the maximum.',
    expectedShots: 85.5,
    expectedHuntShots: 50.3,
    scoreMultiplier: SCORE_MULTIPLIER.overmind,
  },
};

export const DOCTRINE_LIST: readonly Doctrine[] = DIFFICULTIES.map((id) => DOCTRINES[id]);
