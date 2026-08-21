import {
  CELL_COUNT,
  COLUMNS,
  type Cell,
  type Difficulty,
  type Rng,
  type Shot,
  columnOf,
  hullSections,
  neighbours,
  pick,
  rowOf,
} from '@bs/rules';
import { type Intel, readIntel } from './intel.js';
import { densityMap } from './density.js';

/** Pick the invader's next shot from its own shot history. */
export function chooseShot(shots: readonly Shot[], difficulty: Difficulty, rng: Rng): Cell {
  const intel = readIntel(shots);
  if (intel.untried.length === 0) throw new Error('the grid is exhausted');
  switch (difficulty) {
    case 'scout':
      return pick(rng, intel.untried);
    case 'raider':
      return huntAndTarget(intel, rng);
    case 'overmind':
      return highestDensity(intel, rng);
  }
}

/**
 * Chase an open hit if there is one, otherwise sweep.
 *
 * The sweep uses parity: a hull of length `n` must cover a cell on every
 * `n`-th diagonal, so only those cells need probing to guarantee a first hit.
 * The step shrinks as hulls sink; with single-section submarines in the fleet
 * it is 1 from the outset, so the sweep only sharpens once they are all found.
 */
function huntAndTarget(intel: Intel, rng: Rng): Cell {
  const target = targetCandidates(intel);
  if (target.length > 0) return pick(rng, target);

  const step = Math.min(...intel.remaining.map(hullSections));
  const parity = intel.untried.filter((cell) => (columnOf(cell) + rowOf(cell)) % step === 0);
  return pick(rng, parity.length > 0 ? parity : intel.untried);
}

/**
 * Cells worth firing at given the open hits. Two hits in line fix the hull's
 * axis, so only the two ends of that run are worth trying; a lone hit leaves
 * all four neighbours.
 */
export function targetCandidates(intel: Intel): Cell[] {
  if (intel.openHits.length === 0) return [];
  const open = new Set(intel.openHits);
  const ends: Cell[] = [];

  for (const axis of ['horizontal', 'vertical'] as const) {
    const step = axis === 'horizontal' ? 1 : COLUMNS;
    const sameLine = (a: Cell, b: Cell) =>
      axis === 'horizontal' ? rowOf(a) === rowOf(b) : columnOf(a) === columnOf(b);
    for (const hit of intel.openHits) {
      const partner = hit + step;
      if (partner >= CELL_COUNT || !sameLine(hit, partner) || !open.has(partner)) continue;
      for (const direction of [-step, step]) {
        let cell = direction < 0 ? hit : partner;
        while (open.has(cell)) {
          const next = cell + direction;
          if (next < 0 || next >= CELL_COUNT || !sameLine(cell, next)) break;
          cell = next;
        }
        if (!intel.fired.has(cell) && sameLine(hit, cell)) ends.push(cell);
      }
    }
  }
  if (ends.length > 0) return [...new Set(ends)];

  return [...new Set(intel.openHits.flatMap(neighbours))].filter((cell) => !intel.fired.has(cell));
}

/** Argmax over the placement-density map, ties broken at random. */
function highestDensity(intel: Intel, rng: Rng): Cell {
  const density = densityMap(intel);
  let best = -1;
  let bestCells: Cell[] = [];
  for (const [cell, weight] of density) {
    if (weight > best) {
      best = weight;
      bestCells = [cell];
    } else if (weight === best) {
      bestCells.push(cell);
    }
  }
  // Every remaining cell can be excluded only if the shot history is
  // inconsistent with any placement, which the rules make impossible; fall
  // back rather than throw.
  return bestCells.length > 0 ? pick(rng, bestCells) : pick(rng, intel.untried);
}
