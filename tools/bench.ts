/**
 * Measure how many shots each doctrine needs to clear a fleet.
 *
 * The published `expectedShots` in `@bs/ai` comes from this script, so rerun it
 * (`pnpm bench`) after changing targeting and update the doctrine table.
 */
import { type Difficulty, type Shot, DIFFICULTIES, fleetCells, seededRng, shipClass } from '@bs/rules';
import { chooseShot, randomFleet } from '@bs/ai';

const GAMES = Number(process.argv[2] ?? 300);

function shotsToClear(difficulty: Difficulty, seed: number): number {
  const rng = seededRng(seed * 7919);
  const cells = fleetCells(randomFleet(seededRng(seed * 977)));
  const shots: Shot[] = [];
  const damage = new Map<string, number>();

  for (let n = 1; n <= 100; n++) {
    const cell = chooseShot(shots, difficulty, rng);
    const ship = cells.get(cell);
    if (!ship) {
      shots.push({ cell, outcome: 'miss' });
      continue;
    }
    const hits = (damage.get(ship) ?? 0) + 1;
    damage.set(ship, hits);
    shots.push(hits === shipClass(ship).sections ? { cell, outcome: 'sunk', ship } : { cell, outcome: 'hit' });
    if ([...cells.values()].every((id) => (damage.get(id) ?? 0) === shipClass(id).sections)) return n;
  }
  throw new Error(`${difficulty} failed to clear the grid`);
}

for (const difficulty of DIFFICULTIES) {
  let total = 0;
  for (let seed = 1; seed <= GAMES; seed++) total += shotsToClear(difficulty, seed);
  console.log(`${difficulty.padEnd(9)} ${(total / GAMES).toFixed(1)} shots over ${GAMES} games`);
}
