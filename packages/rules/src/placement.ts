import { type Cell, COLUMNS, ROWS, cellAt, columnOf, formatCell, isCell, rowOf } from './grid.js';
import { HULLS, type HullId, hullName, hullSections, isHullId } from './fleet.js';

export type Orientation = 'horizontal' | 'vertical';

/** A hull on the grid: which hull, the cell holding its bow, and its axis. */
export interface Placement {
  readonly hull: HullId;
  /** Leftmost cell when horizontal, topmost when vertical. */
  readonly origin: Cell;
  readonly orientation: Orientation;
}

export function placementCells(placement: Placement): Cell[] {
  const sections = hullSections(placement.hull);
  const column = columnOf(placement.origin);
  const row = rowOf(placement.origin);
  return Array.from({ length: sections }, (_, i) =>
    placement.orientation === 'horizontal' ? cellAt(column + i, row) : cellAt(column, row + i),
  );
}

/** True when the hull fits inside the grid without wrapping a row. */
export function fitsOnGrid(placement: Placement): boolean {
  if (!isCell(placement.origin)) return false;
  const sections = hullSections(placement.hull);
  return placement.orientation === 'horizontal'
    ? columnOf(placement.origin) + sections <= COLUMNS
    : rowOf(placement.origin) + sections <= ROWS;
}

/**
 * Validate a whole fleet, not one hull at a time: "every hull exactly once"
 * and "no overlaps" are properties of the set. Returns `null` when the
 * deployment is legal, otherwise the reason, phrased for the player.
 *
 * Hulls may touch. That is the standard rule, and forbidding contact would
 * leak information to a solver that knows the constraint.
 */
export function validateFleet(placements: readonly Placement[]): string | null {
  const seen = new Set<HullId>();
  for (const placement of placements) {
    if (!isHullId(placement.hull)) return `unknown hull "${placement.hull}"`;
    if (seen.has(placement.hull)) return `${hullName(placement.hull, 'earth')} is deployed twice`;
    seen.add(placement.hull);
    if (placement.orientation !== 'horizontal' && placement.orientation !== 'vertical') {
      return `${hullName(placement.hull, 'earth')} has no valid orientation`;
    }
    if (!fitsOnGrid(placement)) return `${hullName(placement.hull, 'earth')} does not fit on the grid`;
  }
  for (const hull of HULLS) {
    if (!seen.has(hull.id)) return `${hullName(hull.id, 'earth')} has not been deployed`;
  }

  const occupied = new Map<Cell, HullId>();
  for (const placement of placements) {
    for (const cell of placementCells(placement)) {
      const other = occupied.get(cell);
      if (other !== undefined) {
        return `${hullName(placement.hull, 'earth')} overlaps ${hullName(other, 'earth')} at ${formatCell(cell)}`;
      }
      occupied.set(cell, placement.hull);
    }
  }
  return null;
}

export function fleetCells(placements: readonly Placement[]): Map<Cell, HullId> {
  const cells = new Map<Cell, HullId>();
  for (const placement of placements) {
    for (const cell of placementCells(placement)) cells.set(cell, placement.hull);
  }
  return cells;
}

/**
 * Every legal origin/orientation for one hull, ignoring the others. A
 * single-section hull is only enumerated horizontally, since the two
 * orientations would describe the same cell.
 */
export function candidatePlacements(hull: HullId): Placement[] {
  const sections = hullSections(hull);
  const out: Placement[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column + sections <= COLUMNS; column++) {
      out.push({ hull, origin: cellAt(column, row), orientation: 'horizontal' });
    }
  }
  if (sections === 1) return out;
  for (let column = 0; column < COLUMNS; column++) {
    for (let row = 0; row + sections <= ROWS; row++) {
      out.push({ hull, origin: cellAt(column, row), orientation: 'vertical' });
    }
  }
  return out;
}
