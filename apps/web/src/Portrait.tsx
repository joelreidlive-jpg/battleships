export type Reaction = 'none' | 'cheer' | 'laugh';

/**
 * A commander's post, one above each grid: your captain over the Home Grid,
 * the Kraal warlord over the Invasion Grid. Each stays where it is for the
 * whole battle — only the expression moves. `active` is whose turn it is, and
 * `reaction` is the moment a hull dies: a raised fist over there, a laugh over
 * here.
 */
export function Portrait({
  who,
  name,
  active,
  reaction,
}: {
  readonly who: 'captain' | 'kraal';
  readonly name: string;
  readonly active: boolean;
  readonly reaction: Reaction;
}) {
  const alien = who === 'kraal';
  const reacting = reaction === (alien ? 'laugh' : 'cheer');
  const source = alien
    ? reacting
      ? '/art/kraal-laugh.webp'
      : '/art/kraal-idle.webp'
    : reacting
      ? '/art/captain-cheer.webp'
      : '/art/captain-idle.webp';
  const mood = alien
    ? reacting
      ? 'laughing as one of your hulls burns'
      : active
        ? 'taking aim at your fleet'
        : 'watching the void'
    : reacting
      ? 'punching the air over a broken invader'
      : active
        ? 'awaiting your order'
        : 'braced for the reply';

  return (
    <figure
      className={[
        'portrait',
        alien ? 'portrait--alien' : '',
        active ? 'portrait--turn' : '',
        reacting ? 'portrait--react' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <img src={source} alt={`${name}, ${mood}`} width={512} height={512} />
      <figcaption>{name}</figcaption>
    </figure>
  );
}
