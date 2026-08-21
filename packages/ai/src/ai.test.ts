import { describe, expect, it } from 'vitest';
import {
  type Difficulty,
  type Placement,
  type Shot,
  cellAt,
  fleetCells,
  formatCell,
  isSunk,
  parseCell,
  placementCells,
  seededRng,
  shipClass,
  validateFleet,
} from '@bs/rules';
import { randomFleet } from './deployment.js';
import { readIntel } from './intel.js';
import { densityMap } from './density.js';
import { chooseShot, targetCandidates } from './targeting.js';
import { DOCTRINE_LIST } from './doctrine.js';

/** Fire at a fleet until it is destroyed; return the number of shots taken. */
function shotsToClear(fleet: Placement[], difficulty: Difficulty, seed: number): number {
  const rng = seededRng(seed);
  const cells = fleetCells(fleet);
  const shots: Shot[] = [];
  const damage = new Map<string, number>();

  for (let n = 1; n <= 100; n++) {
    const cell = chooseShot(shots, difficulty, rng);
    expect(shots.some((shot) => shot.cell === cell)).toBe(false);
    const ship = cells.get(cell);
    if (!ship) {
      shots.push({ cell, outcome: 'miss' });
      continue;
    }
    const hits = (damage.get(ship) ?? 0) + 1;
    damage.set(ship, hits);
    const sunk = hits === shipClass(ship).sections;
    shots.push(sunk ? { cell, outcome: 'sunk', ship } : { cell, outcome: 'hit' });
    if ([...cells.values()].every((id) => (damage.get(id) ?? 0) === shipClass(id).sections)) return n;
  }
  throw new Error('the invader failed to clear the grid in 100 shots');
}

describe('deployment', () => {
  it('always produces a legal fleet', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 200; i++) expect(validateFleet(randomFleet(rng))).toBeNull();
  });

  it('spreads hulls over the grid rather than favouring a corner', () => {
    const rng = seededRng(11);
    const counts = new Map<number, number>();
    for (let i = 0; i < 400; i++) {
      for (const placement of randomFleet(rng)) {
        for (const cell of placementCells(placement)) counts.set(cell, (counts.get(cell) ?? 0) + 1);
      }
    }
    // Every cell gets used, and no cell dominates. Centre cells are legitimately
    // more likely than corners because more hulls can span them.
    expect(counts.size).toBe(100);
    expect(Math.min(...counts.values())).toBeGreaterThan(0);
  });
});

describe('intel', () => {
  it('attributes a sunk hull to the run of hits that explains it', () => {
    const intel = readIntel([
      { cell: parseCell('C3'), outcome: 'hit' },
      { cell: parseCell('D3'), outcome: 'sunk', ship: 'interceptor' },
    ]);
    expect(intel.openHits).toEqual([]);
    expect(intel.resolvedHits.size).toBe(2);
    expect(intel.remaining).not.toContain('interceptor');
  });

  it('keeps hits on a hull that is still afloat', () => {
    const intel = readIntel([
      { cell: parseCell('C3'), outcome: 'hit' },
      { cell: parseCell('D3'), outcome: 'hit' },
      { cell: parseCell('J9'), outcome: 'miss' },
    ]);
    expect(intel.openHits.map(formatCell).sort()).toEqual(['C3', 'D3']);
    expect(intel.untried).toHaveLength(97);
  });
});

describe('targeting', () => {
  it('extends along the axis two hits establish, not sideways', () => {
    const intel = readIntel([
      { cell: parseCell('C3'), outcome: 'hit' },
      { cell: parseCell('D3'), outcome: 'hit' },
    ]);
    expect(targetCandidates(intel).map(formatCell).sort()).toEqual(['B3', 'E3']);
  });

  it('tries all four neighbours of a lone hit', () => {
    const intel = readIntel([{ cell: parseCell('C3'), outcome: 'hit' }]);
    expect(targetCandidates(intel).map(formatCell).sort()).toEqual(['B3', 'C2', 'C4', 'D3']);
  });

  it('never fires at the same cell twice', () => {
    for (const doctrine of DOCTRINE_LIST) {
      const rng = seededRng(3);
      const shots: Shot[] = [];
      for (let i = 0; i < 100; i++) {
        const cell = chooseShot(shots, doctrine.id, rng);
        expect(shots.some((shot) => shot.cell === cell)).toBe(false);
        shots.push({ cell, outcome: 'miss' });
      }
      expect(() => chooseShot(shots, doctrine.id, rng)).toThrow(/exhausted/);
    }
  });

  it('ignores cells no surviving hull could occupy', () => {
    // A lone untouched cell walled in by misses cannot hold even the 2-section
    // skiff, so its density is zero and the Overmind will not waste a shot.
    const walled = cellAt(0, 0);
    const shots: Shot[] = [
      { cell: cellAt(1, 0), outcome: 'miss' },
      { cell: cellAt(0, 1), outcome: 'miss' },
    ];
    expect(densityMap(readIntel(shots)).get(walled) ?? 0).toBe(0);
    const rng = seededRng(5);
    for (let i = 0; i < 20; i++) expect(chooseShot(shots, 'overmind', rng)).not.toBe(walled);
  });
});

describe('doctrines are ordered by strength', () => {
  const GAMES = 60;

  function meanShots(difficulty: Difficulty): number {
    let total = 0;
    for (let seed = 1; seed <= GAMES; seed++) total += shotsToClear(randomFleet(seededRng(seed * 977)), difficulty, seed);
    return total / GAMES;
  }

  it('each doctrine clears the grid faster than the one below it', () => {
    const scout = meanShots('scout');
    const raider = meanShots('raider');
    const overmind = meanShots('overmind');

    expect(scout).toBeGreaterThan(raider);
    expect(raider).toBeGreaterThan(overmind);
    // Guard rails, so a regression that quietly breaks targeting is caught.
    expect(scout).toBeGreaterThan(90);
    expect(raider).toBeLessThan(60);
    expect(overmind).toBeLessThan(50);
  });
});

describe('a hull that sinks is off the board', () => {
  it('stops the shooter chasing a resolved hit', () => {
    const fleet: Placement[] = [
      { ship: 'carrier', origin: cellAt(0, 0), orientation: 'horizontal' },
      { ship: 'battlecruiser', origin: cellAt(0, 2), orientation: 'horizontal' },
      { ship: 'cruiser', origin: cellAt(0, 4), orientation: 'horizontal' },
      { ship: 'submersible', origin: cellAt(0, 6), orientation: 'horizontal' },
      { ship: 'interceptor', origin: cellAt(0, 8), orientation: 'horizontal' },
    ];
    const grid = { fleet, shots: placementCells(fleet[4]).map((cell, i, all) => ({
      cell,
      outcome: i === all.length - 1 ? ('sunk' as const) : ('hit' as const),
      ship: 'interceptor' as const,
    })) };
    expect(isSunk(grid, 'interceptor')).toBe(true);
    const intel = readIntel(grid.shots.map((shot) => (shot.outcome === 'sunk' ? shot : { cell: shot.cell, outcome: shot.outcome })));
    expect(intel.openHits).toEqual([]);
    expect(targetCandidates(intel)).toEqual([]);
  });
});
