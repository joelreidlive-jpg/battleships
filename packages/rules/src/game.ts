import { type Cell, formatCell, isCell } from './grid.js';
import { FLEET, type Side, type ShipClassId, shipClass } from './fleet.js';
import { type Placement, fleetCells, placementCells, validateFleet } from './placement.js';

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

/** One resolved shot, recorded against the grid that was fired *at*. */
export interface Shot {
  readonly cell: Cell;
  readonly outcome: ShotOutcome;
  /** The hull struck, on `hit` and `sunk`. Absent on a miss. */
  readonly ship?: ShipClassId;
}

/** One side's grid: the hulls deployed on it and every shot fired at it. */
export interface Grid {
  readonly fleet: readonly Placement[];
  readonly shots: readonly Shot[];
}

export type GameStatus = 'playing' | 'finished';

export interface GameState {
  readonly earth: Grid;
  readonly alien: Grid;
  /** Whose shot it is. Earth always fires first. */
  readonly turn: Side;
  readonly status: GameStatus;
  readonly winner?: Side;
}

export class RuleError extends Error {}

export function opponent(side: Side): Side {
  return side === 'earth' ? 'alien' : 'earth';
}

/** The grid a side owns — the one their opponent shoots at. */
export function gridOf(state: GameState, side: Side): Grid {
  return side === 'earth' ? state.earth : state.alien;
}

export function newGame(earthFleet: readonly Placement[], alienFleet: readonly Placement[]): GameState {
  for (const [side, fleet] of [
    ['Earth', earthFleet],
    ['alien', alienFleet],
  ] as const) {
    const problem = validateFleet(fleet);
    if (problem) throw new RuleError(`${side} deployment rejected: ${problem}`);
  }
  return {
    earth: { fleet: earthFleet, shots: [] },
    alien: { fleet: alienFleet, shots: [] },
    turn: 'earth',
    status: 'playing',
  };
}

export function shotAt(grid: Grid, cell: Cell): Shot | undefined {
  return grid.shots.find((shot) => shot.cell === cell);
}

/** Hits recorded against one hull. */
export function damageTo(grid: Grid, ship: ShipClassId): number {
  return grid.shots.filter((shot) => shot.ship === ship).length;
}

export function isSunk(grid: Grid, ship: ShipClassId): boolean {
  return damageTo(grid, ship) >= shipClass(ship).sections;
}

export function sunkShips(grid: Grid): ShipClassId[] {
  return grid.fleet.map((p) => p.ship).filter((ship) => isSunk(grid, ship));
}

export function isFleetDestroyed(grid: Grid): boolean {
  return grid.fleet.every((placement) => isSunk(grid, placement.ship));
}

/** Cells of a hull that have not been hit. Only ever shown for your own fleet. */
export function intactCells(grid: Grid, placement: Placement): Cell[] {
  const struck = new Set(grid.shots.filter((shot) => shot.outcome !== 'miss').map((shot) => shot.cell));
  return placementCells(placement).filter((cell) => !struck.has(cell));
}

/** Why this shot is illegal, or `null`. Separated so callers can pre-check. */
export function shotProblem(state: GameState, side: Side, cell: Cell): string | null {
  if (state.status === 'finished') return 'the battle is over';
  if (state.turn !== side) return 'it is not your turn';
  if (!isCell(cell)) return 'that reference is off the grid';
  if (shotAt(gridOf(state, opponent(side)), cell)) return `${formatCell(cell)} has already been fired on`;
  return null;
}

/**
 * Resolve one shot. Turn order strictly alternates: a hit does not earn
 * another shot, which is what keeps the two sides' shot counts comparable and
 * makes accuracy a meaningful score.
 */
export function fire(state: GameState, side: Side, cell: Cell): { state: GameState; shot: Shot } {
  const problem = shotProblem(state, side, cell);
  if (problem) throw new RuleError(problem);

  const defender = opponent(side);
  const grid = gridOf(state, defender);
  const ship = fleetCells(grid.fleet).get(cell);

  let shot: Shot = { cell, outcome: 'miss' };
  if (ship !== undefined) {
    const wouldSink = damageTo(grid, ship) + 1 >= shipClass(ship).sections;
    shot = { cell, outcome: wouldSink ? 'sunk' : 'hit', ship };
  }

  const nextGrid: Grid = { fleet: grid.fleet, shots: [...grid.shots, shot] };
  const destroyed = isFleetDestroyed(nextGrid);
  const next: GameState = {
    earth: defender === 'earth' ? nextGrid : state.earth,
    alien: defender === 'alien' ? nextGrid : state.alien,
    turn: destroyed ? side : defender,
    status: destroyed ? 'finished' : 'playing',
    ...(destroyed ? { winner: side } : {}),
  };
  return { state: next, shot };
}

/**
 * A shot as the *firing* side is entitled to know it. Striking a hull tells
 * you only that you hit something; which hull it was is announced when it
 * sinks. Both the wire protocol and the AI's own view go through here, so the
 * invader plays under exactly the information the player has.
 */
export function redactShot(shot: Shot): Shot {
  return shot.outcome === 'sunk' ? shot : { cell: shot.cell, outcome: shot.outcome };
}

export interface SideStats {
  readonly shots: number;
  readonly hits: number;
  readonly misses: number;
  /** Hits divided by shots, `0` before the first shot. */
  readonly accuracy: number;
  readonly sunk: number;
  /** Hull sections still intact in this side's own fleet. */
  readonly sectionsRemaining: number;
}

/** Statistics for the shots a side has *fired*, plus the state of its fleet. */
export function statsFor(state: GameState, side: Side): SideStats {
  const target = gridOf(state, opponent(side));
  const own = gridOf(state, side);
  const shots = target.shots.length;
  const hits = target.shots.filter((shot) => shot.outcome !== 'miss').length;
  return {
    shots,
    hits,
    misses: shots - hits,
    accuracy: shots === 0 ? 0 : hits / shots,
    sunk: sunkShips(target).length,
    sectionsRemaining: own.fleet.reduce((sum, placement) => sum + intactCells(own, placement).length, 0),
  };
}

/** Hull classes in the order they are deployed, for UI fleet rosters. */
export const FLEET_ORDER: readonly ShipClassId[] = FLEET.map((ship) => ship.id);
