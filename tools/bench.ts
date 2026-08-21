/**
 * Measure how many shots each doctrine needs to clear a fleet.
 *
 * The published `expectedShots` in `@bs/ai` comes from this script, so rerun it
 * (`pnpm bench`) after changing targeting and update the doctrine table.
 */
import { type Difficulty, type Shot, DIFFICULTIES, fleetCells, hullSections, seededRng } from '@bs/rules';
import { chooseShot, randomFleet } from '@bs/ai';

const GAMES = Number(process.argv[2] ?? 300);

interface Run {
  /** Shots to destroy every hull. */
  readonly total: number;
  /** Shots to destroy every hull of more than one section. */
  readonly hunt: number;
}

function shotsToClear(difficulty: Difficulty, seed: number): Run {
  const rng = seededRng(seed * 7919);
  const cells = fleetCells(randomFleet(seededRng(seed * 977)));
  const shots: Shot[] = [];
  const damage = new Map<string, number>();
  const large = [...new Set(cells.values())].filter((id) => hullSections(id) > 1);
  let hunt = 0;

  for (let n = 1; n <= 100; n++) {
    const cell = chooseShot(shots, difficulty, rng);
    const hull = cells.get(cell);
    if (!hull) {
      shots.push({ cell, outcome: 'miss' });
      continue;
    }
    const hits = (damage.get(hull) ?? 0) + 1;
    damage.set(hull, hits);
    shots.push(hits === hullSections(hull) ? { cell, outcome: 'sunk', hull } : { cell, outcome: 'hit' });
    if (hunt === 0 && large.every((id) => (damage.get(id) ?? 0) === hullSections(id))) hunt = n;
    if ([...cells.values()].every((id) => (damage.get(id) ?? 0) === hullSections(id))) return { total: n, hunt };
  }
  throw new Error(`${difficulty} failed to clear the grid`);
}

// Four single-section submarines can only be found by search, so the full
// clear is dominated by luck; the hunt figure is where doctrine shows.
for (const difficulty of DIFFICULTIES) {
  let total = 0;
  let hunt = 0;
  for (let seed = 1; seed <= GAMES; seed++) {
    const run = shotsToClear(difficulty, seed);
    total += run.total;
    hunt += run.hunt;
  }
  console.log(
    `${difficulty.padEnd(9)} ${(total / GAMES).toFixed(1)} shots to clear, ${(hunt / GAMES).toFixed(1)} to the last multi-section hull, over ${GAMES} games`,
  );
}
