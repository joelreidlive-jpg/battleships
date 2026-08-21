import type { Side } from '@bs/rules';

export type Reaction = 'none' | 'cheer' | 'laugh';

/**
 * Who is shooting, painted. The portrait follows the turn — your captain while
 * the guns are yours, the Kraal warlord while the invader answers — and takes
 * the win: a raised fist when you gut one of theirs, a laugh when they gut one
 * of yours.
 */
export function Portrait({
  turn,
  reaction,
  captain,
}: {
  readonly turn: Side;
  readonly reaction: Reaction;
  readonly captain: string;
}) {
  const alien = turn === 'alien' || reaction === 'laugh';
  const cheering = !alien && reaction === 'cheer';
  const source = alien
    ? reaction === 'laugh'
      ? '/art/kraal-laugh.webp'
      : '/art/kraal-idle.webp'
    : cheering
      ? '/art/captain-cheer.webp'
      : '/art/captain-idle.webp';
  const who = alien ? 'The Kraal Overlord' : `Captain ${captain}`;
  const mood = alien
    ? reaction === 'laugh'
      ? 'laughing as one of your hulls burns'
      : 'taking aim at your fleet'
    : cheering
      ? 'punching the air over a broken invader'
      : 'awaiting your order';

  return (
    <figure className={`portrait${alien ? ' portrait--alien' : ''}${reaction === 'none' ? '' : ' portrait--react'}`}>
      <img src={source} alt={`${who}, ${mood}`} width={512} height={512} />
      <figcaption>{who}</figcaption>
    </figure>
  );
}
