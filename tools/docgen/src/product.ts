import {
  COLUMNS,
  COLUMN_LABELS,
  FLEET,
  HULLS,
  PERFECT_SHOT_COUNT,
  RANKS,
  ROWS,
  SCORING,
  STORY,
  TOTAL_SECTIONS,
  type Placement,
  cellAt,
  fire,
  maximumScore,
  newGame,
  placementCells,
  scoreFor,
} from '@bs/rules';
import { DOCTRINE_LIST } from '@bs/ai';

/**
 * The player's document: what the game is, how it is played, what everything
 * is worth. Every number in it is read from the engine, and the worked example
 * is produced by playing an actual game through the rules.
 *
 * It is read inside the game, so it carries nothing a player cannot act on:
 * no implementation, no roadmap, and no notes about how the game is built or
 * run. That material belongs in the technical specification. The generated
 * banner is omitted for the same reason — CONTRIBUTING covers `pnpm docs`.
 */
export function productGuide(): string {
  return [
    '# Orbital Battleships Command — game guide',
    '',
    premise(),
    theBoard(),
    theFleet(),
    howATurnWorks(),
    winning(),
    scoring(),
    workedExample(),
    difficulty(),
    progression(),
  ].join('\n');
}

function premise(): string {
  return `## The premise

${STORY}

Before your first campaign you sign your commission: your captain's name and
the starfleet you command. Both are yours to choose, and the starfleet's name
flies above your Home Grid for the rest of the war.

You command Earth's remaining defence wing. Neither side can see the other:
both fleets sit hidden on a ${COLUMNS}x${ROWS} sector grid, and the only way to find an enemy
hull is to fire into a sector and see what comes back.

It is Battleship. The rules, the grid, the fleet sizes and the turn order are
the classic ones; the fiction, the artwork and the scoring are ours.

`;
}

function theBoard(): string {
  return `## The board

Each side has one grid of ${COLUMNS} columns (${COLUMN_LABELS[0]}–${COLUMN_LABELS[COLUMNS - 1]}) by ${ROWS} rows (1–${ROWS}): ${COLUMNS * ROWS} sectors.
A sector is named by its column letter and row number, so \`B7\` is the seventh
row of the second column.

- **Invasion Grid** — what you know about the alien fleet. You fire here.
- **Home Grid** — your own fleet, and every shot the invader has taken at it.

`;
}

function theFleet(): string {
  const rows = FLEET.map(
    (ship) =>
      `| ${ship.count} | ${ship.sections} | ${ship.earthName} | ${ship.alienName} | ${ship.ratings.speed}/5 | ${ship.ratings.defence}/5 | ${ship.ratings.firepower}/5 | ${ship.blurb} |`,
  ).join('\n');
  return `## The fleets

Both sides field the same ${HULLS.length} hulls under different names. Where a class is
deployed more than once the individual craft are numbered — Ion Cruiser I and
Ion Cruiser II — and each is positioned, damaged and destroyed separately.

| Count | Sections each | Earth Defence Wing | Invasion Fleet | Speed | Defence | Firepower | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
${rows}

Speed, defence and firepower are the character of a hull, not a rule: every
ship fires one shot a turn and loses one section per hit. What they tell you is
the trade you are making when you place it — the battleship soaks punishment
but is the easiest thing on the grid to find, and a submarine is almost
impossible to find but dies to a single lucky shot.

That is **${HULLS.length} hulls, ${TOTAL_SECTIONS} sections** per side. A hull occupies that many adjacent sectors in a
straight line, north–south or east–west. Hulls may not overlap and may not run
off the edge of the grid, but they *may* sit alongside one another — the
standard rule, and one a careful player can use to hide a short hull against a
long one.

You may position your fleet by hand, or let Fleet Command deploy it for you.
The invader deploys under the same rules, out of sight; you will not see where
its hulls lie until the battle is over.

`;
}

function howATurnWorks(): string {
  return `## How a turn works

1. **You fire** at one sector of the Invasion Grid that you have not already
   fired on.
2. The result is announced immediately:
   - **Miss** — nothing there.
   - **Hit** — you struck a hull, but you are *not* told which one.
   - **Destroyed** — that hit was the hull's last intact section, and that
     individual craft is named. A single-section submarine is therefore
     destroyed by the first hit that finds it.
3. **The invader fires back** at one sector of your Home Grid, and the same
   three results apply.

Turn order strictly alternates. A hit does not earn a second shot, so both
sides always have taken the same number of shots — which is what makes
accuracy worth scoring.

`;
}

function winning(): string {
  return `## Winning

The first side to destroy all ${HULLS.length} of the opponent's hulls — all ${TOTAL_SECTIONS} sections — wins
immediately. Because you fire first, the invader does not get a reply to the
shot that destroys its last hull.

If you abandon the defence, the campaign is recorded as a loss and the alien
deployment is revealed.

`;
}

function scoring(): string {
  return `## Scoring

Score accrues as you fire, so the number on screen during a battle is real. The
three bonuses marked *on victory* are paid only if you win.

| Line | Value | When |
| --- | --- | --- |
| Hit | ${SCORING.hit} | Per section struck |
| Hull destroyed | ${SCORING.sinkPerSection} x sections | When a hull is destroyed, so a ${FLEET[0].sections}-section hull pays ${SCORING.sinkPerSection * FLEET[0].sections} |
| Wasted ordnance | -${SCORING.wastedShot} | Per shot beyond the ${PERFECT_SHOT_COUNT} a flawless campaign needs |
| Accuracy bonus | ${SCORING.accuracyBonus} x hit rate | On victory |
| Fleet preserved | ${SCORING.survivingSection} | Per section of *your* fleet still intact, on victory |
| Victory | ${SCORING.victory} | On victory |

The subtotal is floored at zero, then multiplied by the doctrine multiplier
below. A flawless campaign — ${PERFECT_SHOT_COUNT} shots, ${PERFECT_SHOT_COUNT} hits, nothing lost — against the
hardest doctrine scores **${maximumScore('overmind').toLocaleString('en-GB')}**, which is the highest score the game can
produce.

`;
}

/** Played through the real engine, so the arithmetic cannot be wrong. */
function workedExample(): string {
  // Packed left to right, wrapping at the edge of the grid: two full rows.
  const earth: Placement[] = [];
  let column = 0;
  let row = 0;
  for (const hull of HULLS) {
    if (column + hull.sections > COLUMNS) {
      row += 1;
      column = 0;
    }
    earth.push({ hull: hull.id, origin: cellAt(column, row), orientation: 'horizontal' });
    column += hull.sections;
  }
  const alien: Placement[] = earth.map((placement) => ({ ...placement, origin: placement.origin + 50 }));

  let state = newGame(earth, alien);
  const targets = alien.flatMap(placementCells);
  let miss = 0;
  for (const cell of targets) {
    if (state.status === 'finished') break;
    state = fire(state, 'earth', cell).state;
    if (state.status === 'finished') break;
    // The invader lands three hits on the flagship over the campaign.
    state = fire(state, 'alien', miss < 3 ? cellAt(miss, 0) : cellAt(miss % COLUMNS, ROWS - 1 - Math.floor(miss / COLUMNS))).state;
    miss++;
  }
  const score = scoreFor(state, 'raider');

  return `### A worked example

A campaign against **${DOCTRINE_LIST[1].name}** in which you find every hull without a wasted
shot, while the invader lands three hits on your ${FLEET[0].earthName}:

| Line | Score |
| --- | --- |
| Hits | ${score.hits.toLocaleString('en-GB')} |
| Hulls destroyed | ${score.sinks.toLocaleString('en-GB')} |
| Accuracy bonus | ${score.accuracy.toLocaleString('en-GB')} |
| Fleet preserved | ${score.survival.toLocaleString('en-GB')} |
| Victory | ${score.victory.toLocaleString('en-GB')} |
| Wasted ordnance | ${score.wastedShots === 0 ? '0' : `-${score.wastedShots.toLocaleString('en-GB')}`} |
| Subtotal | ${score.subtotal.toLocaleString('en-GB')} |
| Doctrine multiplier | x${score.multiplier} |
| **Total** | **${score.total.toLocaleString('en-GB')}** |

`;
}

function difficulty(): string {
  const rows = DOCTRINE_LIST.map(
    (doctrine) =>
      `| ${doctrine.name} | x${doctrine.scoreMultiplier} | ${doctrine.expectedHuntShots} | ${doctrine.tagline} |`,
  ).join('\n');
  return `## Invasion doctrines

Choose how the invader fights before you launch. Nothing else changes: the
grid, the fleets and the scoring are identical whichever you pick, so the
harder the invader, the more your score is multiplied.

| Doctrine | Score multiplier | Shots it needs to hunt down your bigger hulls | How it comes at you |
| --- | --- | --- | --- |
${rows}

The shot count is what the invader typically spends destroying every hull of
yours larger than a submarine — ${PERFECT_SHOT_COUNT} shots would be flawless and 100 is the
whole grid, so lower means a shorter, more dangerous campaign. Your four
single-section submarines are pure luck to find, and cost every invader about
the same, so they are left out of the comparison. Against ${DOCTRINE_LIST[2].name} expect
to lose ships roughly twice as fast as against ${DOCTRINE_LIST[0].name}.

`;
}

function progression(): string {
  const rows = RANKS.map((rank) => `| ${rank.title} | ${rank.minCareerScore.toLocaleString('en-GB')} |`).join('\n');
  return `## Career

Every campaign you finish adds to a lifetime score, and the rank beside your
name climbs with it. There is nothing to sign up for: your record simply
follows the device you play on.

| Rank | Lifetime score |
| --- | --- |
${rows}

`;
}
