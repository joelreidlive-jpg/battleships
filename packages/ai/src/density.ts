import { type Cell, candidatePlacements, placementCells, shipClass } from '@bs/rules';
import type { Intel } from './intel.js';

/**
 * Each open hit a placement explains multiplies its weight by this much, so a
 * hull consistent with two known hits dominates any merely-plausible one. It
 * is a weight rather than a hard filter because the shooter cannot be certain
 * which hull an open hit belongs to.
 */
export const OPEN_HIT_WEIGHT = 50;

/**
 * How many ways the surviving hulls could still cover each untried cell.
 *
 * This is the exact count over all placements consistent with the shot
 * history — no sampling — which is cheap here: five hulls, 100 cells, at most
 * a few thousand candidate placements per turn.
 */
export function densityMap(intel: Intel): Map<Cell, number> {
  const openHits = new Set(intel.openHits);
  const blocked = new Set<Cell>([...intel.misses, ...intel.resolvedHits]);
  const density = new Map<Cell, number>();

  for (const ship of intel.remaining) {
    const sections = shipClass(ship).sections;
    for (const placement of candidatePlacements(ship)) {
      const cells = placementCells(placement);
      if (cells.some((cell) => blocked.has(cell))) continue;

      let covered = 0;
      for (const cell of cells) if (openHits.has(cell)) covered++;
      // A hull cannot be longer than the run of hits it is meant to explain.
      if (covered > sections) continue;

      const weight = OPEN_HIT_WEIGHT ** covered;
      for (const cell of cells) {
        if (intel.fired.has(cell)) continue;
        density.set(cell, (density.get(cell) ?? 0) + weight);
      }
    }
  }
  return density;
}
