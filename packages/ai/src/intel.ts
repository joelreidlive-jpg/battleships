import { ALL_CELLS, type Cell, HULLS, type HullId, type Shot, columnOf, hullSections, rowOf } from '@bs/rules';

/**
 * What a shooter can deduce from its own shot history alone. This is the only
 * input any targeting policy gets, which is what stops the invader from
 * reading the defender's grid.
 */
export interface Intel {
  readonly fired: ReadonlySet<Cell>;
  readonly misses: ReadonlySet<Cell>;
  /** Hits attributed to a hull that has since sunk. Nothing lives there now. */
  readonly resolvedHits: ReadonlySet<Cell>;
  /** Hits on a hull still afloat — the cells worth chasing. */
  readonly openHits: readonly Cell[];
  /** Hulls not yet destroyed. */
  readonly remaining: readonly HullId[];
  readonly untried: readonly Cell[];
}

/**
 * Attribute each hit to a hull.
 *
 * A "sunk" announcement names the hull, so its length is known, but not which
 * cells it occupied. The standard inference is to claim the contiguous run of
 * open hits through the sinking cell along one axis; it is right except in the
 * rare case of two hulls hit adjacently and in line, where the only cost is
 * that the shooter keeps probing a dead cell for a turn.
 */
export function readIntel(shots: readonly Shot[]): Intel {
  const fired = new Set<Cell>();
  const misses = new Set<Cell>();
  const resolvedHits = new Set<Cell>();
  const open = new Set<Cell>();
  const sunk = new Set<HullId>();

  for (const shot of shots) {
    fired.add(shot.cell);
    if (shot.outcome === 'miss') {
      misses.add(shot.cell);
      continue;
    }
    open.add(shot.cell);
    if (shot.outcome === 'sunk' && shot.hull) {
      sunk.add(shot.hull);
      for (const cell of claimHull(shot.cell, hullSections(shot.hull), open)) {
        open.delete(cell);
        resolvedHits.add(cell);
      }
    }
  }

  return {
    fired,
    misses,
    resolvedHits,
    openHits: [...open],
    remaining: HULLS.map((hull) => hull.id).filter((id) => !sunk.has(id)),
    untried: ALL_CELLS.filter((cell) => !fired.has(cell)),
  };
}

/** The run of open hits through `cell` that best accounts for a hull of `size`. */
function claimHull(cell: Cell, size: number, open: ReadonlySet<Cell>): Cell[] {
  for (const axis of ['horizontal', 'vertical'] as const) {
    const run = runThrough(cell, size, open, axis);
    if (run.length === size) return run;
  }
  return [cell];
}

function runThrough(cell: Cell, size: number, open: ReadonlySet<Cell>, axis: 'horizontal' | 'vertical'): Cell[] {
  const step = axis === 'horizontal' ? 1 : 10;
  const sameLine = (a: Cell, b: Cell) => (axis === 'horizontal' ? rowOf(a) === rowOf(b) : columnOf(a) === columnOf(b));
  const run = [cell];
  for (const direction of [-step, step]) {
    let next = cell + direction;
    while (run.length < size && next >= 0 && next < 100 && sameLine(cell, next) && open.has(next)) {
      run.push(next);
      next += direction;
    }
  }
  return run;
}

/** Sections of hulls still afloat that have not been hit yet. */
export function sectionsOutstanding(intel: Intel): number {
  const total = intel.remaining.reduce((sum, id) => sum + hullSections(id), 0);
  return total - intel.openHits.length;
}
