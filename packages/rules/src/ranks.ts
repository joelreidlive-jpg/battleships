/**
 * Career progression. Purely cosmetic — it changes no game rule — but it is
 * the thing that makes a second campaign worth playing, so it is specified
 * here rather than invented in the UI.
 */
export interface Rank {
  readonly title: string;
  /** Lifetime score at which the rank is awarded. */
  readonly minCareerScore: number;
}

export const RANKS: readonly Rank[] = [
  { title: 'Cadet', minCareerScore: 0 },
  { title: 'Flight Officer', minCareerScore: 5_000 },
  { title: 'Squadron Leader', minCareerScore: 20_000 },
  { title: 'Wing Commander', minCareerScore: 50_000 },
  { title: 'Star Marshal', minCareerScore: 100_000 },
  { title: 'Defender of Earth', minCareerScore: 250_000 },
];

export function rankFor(careerScore: number): string {
  let title = RANKS[0].title;
  for (const rank of RANKS) if (careerScore >= rank.minCareerScore) title = rank.title;
  return title;
}
