/**
 * Difficulty names the invader's targeting doctrine. It lives in the rules
 * package rather than the AI package because the score multiplier is part of
 * the scoring rules, and the browser needs the name without the algorithm.
 */
export type Difficulty = 'scout' | 'raider' | 'overmind';

export const DIFFICULTIES: readonly Difficulty[] = ['scout', 'raider', 'overmind'];

/** Beating a better opponent is worth more. Applied to the whole subtotal. */
export const SCORE_MULTIPLIER: Record<Difficulty, number> = {
  scout: 1,
  raider: 1.5,
  overmind: 2,
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === 'string' && (DIFFICULTIES as readonly string[]).includes(value);
}
