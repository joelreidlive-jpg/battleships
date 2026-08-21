/**
 * The fiction, in one place. The game guide, the masthead and the callouts all
 * read from here so the invader is never named two different things.
 */

/** What the invaders call themselves. */
export const ALIEN_RACE = 'Kraal Ascendancy';

/** One-line strapline, short enough for the masthead. */
export const STRAPLINE = `The ${ALIEN_RACE} is here. Find their fleet before they find yours.`;

/**
 * Starfleet names offered at the briefing. A captain may type their own; these
 * are the suggestions, cycled through rather than drawn at random so the same
 * click always gives the same next name.
 */
export const STARFLEET_NAMES: readonly string[] = [
  'Terra Nova',
  'Solaris',
  'Orion Gate',
  'Vanguard',
  'Halcyon',
  'Perihelion',
  'Aurora',
  'Ironhold',
];

/** The opening paragraph of the game guide. */
export const STORY = `They came out of the dark past Neptune without a word of warning: the
${ALIEN_RACE}, a hive of world-burners who have crossed half the galaxy leaving
nothing but cinders behind them, and who have decided that Earth burns next.
Their armada is already in high orbit, running silent, and every fleet we had
between here and Mars is gone. What is left is you, one grid of home sectors,
and twenty sections of hull between eight billion people and the fire. Their
ships are hidden. So are yours. Fire into the dark, read what comes back, and
hunt the Kraal down sector by sector — because the moment they finish plotting
your fleet, the bombardment of Earth begins.`;
