import { type Cell, COLUMNS, ROWS, cellAt, columnOf, formatCell, isCell, rowOf } from './grid.js';
import { FLEET, type ShipClassId, shipClass } from './fleet.js';

export type Orientation = 'horizontal' | 'vertical';

/** A hull on the grid: its class, the cell holding its bow, and its axis. */
export interface Placement {
  readonly ship: ShipClassId;
  /** Leftmost cell when horizontal, topmost when vertical. */
  readonly origin: Cell;
  readonly orientation: Orientation;
}

export function placementCells(placement: Placement): Cell[] {
  const { sections } = shipClass(placement.ship);
  const column = columnOf(placement.origin);
  const row = rowOf(placement.origin);
  return Array.from({ length: sections }, (_, i) =>
    placement.orientation === 'horizontal' ? cellAt(column + i, row) : cellAt(column, row + i),
  );
}

/** True when the hull fits inside the grid without wrapping a row. */
export function fitsOnGrid(placement: Placement): boolean {
  if (!isCell(placement.origin)) return false;
  const { sections } = shipClass(placement.ship);
  return placement.orientation === 'horizontal'
    ? columnOf(placement.origin) + sections <= COLUMNS
    : rowOf(placement.origin) + sections <= ROWS;
}

/**
 * Validate a whole fleet, not one hull at a time: "every class exactly once"
 * and "no overlaps" are properties of the set. Returns `null` when the
 * deployment is legal, otherwise the reason, phrased for the player.
 *
 * Hulls may touch. That is the standard rule, and forbidding contact would
 * leak information to a solver that knows the constraint.
 */
export function validateFleet(placements: readonly Placement[]): string | null {
  const seen = new Set<ShipClassId>();
  for (const placement of placements) {
    if (!FLEET.some((ship) => ship.id === placement.ship)) return `unknown ship class "${placement.ship}"`;
    if (seen.has(placement.ship)) return `${shipClass(placement.ship).earthName} is deployed twice`;
    seen.add(placement.ship);
    if (placement.orientation !== 'horizontal' && placement.orientation !== 'vertical') {
      return `${shipClass(placement.ship).earthName} has no valid orientation`;
    }
    if (!fitsOnGrid(placement)) return `${shipClass(placement.ship).earthName} does not fit on the grid`;
  }
  for (const ship of FLEET) {
    if (!seen.has(ship.id)) return `${ship.earthName} has not been deployed`;
  }

  const occupied = new Map<Cell, ShipClassId>();
  for (const placement of placements) {
    for (const cell of placementCells(placement)) {
      const other = occupied.get(cell);
      if (other !== undefined) {
        return `${shipClass(placement.ship).earthName} overlaps ${shipClass(other).earthName} at ${formatCell(cell)}`;
      }
      occupied.set(cell, placement.ship);
    }
  }
  return null;
}

export function fleetCells(placements: readonly Placement[]): Map<Cell, ShipClassId> {
  const cells = new Map<Cell, ShipClassId>();
  for (const placement of placements) {
    for (const cell of placementCells(placement)) cells.set(cell, placement.ship);
  }
  return cells;
}

/** Every legal origin/orientation for one class, ignoring other hulls. */
export function candidatePlacements(ship: ShipClassId): Placement[] {
  const { sections } = shipClass(ship);
  const out: Placement[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let column = 0; column + sections <= COLUMNS; column++) {
      out.push({ ship, origin: cellAt(column, row), orientation: 'horizontal' });
    }
  }
  for (let column = 0; column < COLUMNS; column++) {
    for (let row = 0; row + sections <= ROWS; row++) {
      out.push({ ship, origin: cellAt(column, row), orientation: 'vertical' });
    }
  }
  return out;
}
