import { TOTAL_SECTIONS, hullSections } from './fleet.js';
import { type Difficulty, SCORE_MULTIPLIER } from './difficulty.js';
import { type GameState, gridOf, opponent, statsFor, sunkHulls } from './game.js';

/**
 * Every scoring constant, in one object, because this is the table a product
 * owner argues about and the documentation generator reads it directly. Change
 * a number here and the published rules change with it.
 */
export const SCORING = {
  /** Per section struck. */
  hit: 100,
  /** Per section of a hull, awarded again when the hull is destroyed. */
  sinkPerSection: 60,
  /** Awarded once, on victory only. */
  victory: 1000,
  /** Multiplied by hit rate, on victory only. */
  accuracyBonus: 1000,
  /** Per section of the player's own fleet still intact, on victory only. */
  survivingSection: 200,
  /** Deducted per shot beyond the one-per-enemy-section a perfect game needs. */
  wastedShot: 10,
} as const;

/** One shot per enemy section is a flawless campaign. */
export const PERFECT_SHOT_COUNT = TOTAL_SECTIONS;

export interface ScoreBreakdown {
  readonly hits: number;
  readonly sinks: number;
  readonly accuracy: number;
  readonly survival: number;
  readonly victory: number;
  readonly wastedShots: number;
  /** Sum of the lines above, floored at zero before the multiplier. */
  readonly subtotal: number;
  readonly multiplier: number;
  readonly total: number;
}

/**
 * Score the player's campaign. Defined for a game in progress too, so the UI
 * can show a live total; the victory-only lines are simply zero until the last
 * alien hull goes down.
 */
export function scoreFor(state: GameState, difficulty: Difficulty): ScoreBreakdown {
  const stats = statsFor(state, 'earth');
  const enemy = gridOf(state, opponent('earth'));
  const won = state.status === 'finished' && state.winner === 'earth';

  const hits = stats.hits * SCORING.hit;
  const sinks = sunkHulls(enemy).reduce((sum, hull) => sum + hullSections(hull) * SCORING.sinkPerSection, 0);
  const wastedShots = Math.max(0, stats.shots - PERFECT_SHOT_COUNT) * SCORING.wastedShot;
  const accuracy = won ? Math.round(SCORING.accuracyBonus * stats.accuracy) : 0;
  const survival = won ? stats.sectionsRemaining * SCORING.survivingSection : 0;
  const victory = won ? SCORING.victory : 0;

  const subtotal = Math.max(0, hits + sinks + accuracy + survival + victory - wastedShots);
  const multiplier = SCORE_MULTIPLIER[difficulty];
  return {
    hits,
    sinks,
    accuracy,
    survival,
    victory,
    wastedShots,
    subtotal,
    multiplier,
    total: Math.round(subtotal * multiplier),
  };
}

/** The highest score reachable: no wasted shots, no losses, on this doctrine. */
export function maximumScore(difficulty: Difficulty): number {
  const subtotal =
    TOTAL_SECTIONS * SCORING.hit +
    TOTAL_SECTIONS * SCORING.sinkPerSection +
    SCORING.accuracyBonus +
    TOTAL_SECTIONS * SCORING.survivingSection +
    SCORING.victory;
  return Math.round(subtotal * SCORE_MULTIPLIER[difficulty]);
}
