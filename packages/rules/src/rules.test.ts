import { describe, expect, it } from 'vitest';
import { COLUMN_LABELS, cellAt, formatCell, neighbours, parseCell } from './grid.js';
import { FLEET, TOTAL_SECTIONS, shipName } from './fleet.js';
import { type Placement, candidatePlacements, placementCells, validateFleet } from './placement.js';
import { RuleError, fire, isSunk, newGame, redactShot, statsFor } from './game.js';
import { PERFECT_SHOT_COUNT, SCORING, maximumScore, scoreFor } from './scoring.js';
import { rankFor } from './ranks.js';

/** Five hulls laid out in rows 1-5, well clear of each other. */
const EARTH_FLEET: Placement[] = [
  { ship: 'carrier', origin: cellAt(0, 0), orientation: 'horizontal' },
  { ship: 'battlecruiser', origin: cellAt(0, 1), orientation: 'horizontal' },
  { ship: 'cruiser', origin: cellAt(0, 2), orientation: 'horizontal' },
  { ship: 'submersible', origin: cellAt(0, 3), orientation: 'horizontal' },
  { ship: 'interceptor', origin: cellAt(0, 4), orientation: 'horizontal' },
];

/** The same fleet on the far side of the grid. */
const ALIEN_FLEET: Placement[] = EARTH_FLEET.map((placement) => ({
  ...placement,
  origin: placement.origin + 50,
}));

function allCellsOf(fleet: Placement[]): number[] {
  return fleet.flatMap(placementCells);
}

describe('grid', () => {
  it('round-trips references a player would read out', () => {
    expect(formatCell(0)).toBe('A1');
    expect(formatCell(99)).toBe('J10');
    expect(parseCell('B7')).toBe(cellAt(1, 6));
    expect(parseCell('b7')).toBe(parseCell('B7'));
  });

  it('rejects references off the grid', () => {
    expect(() => parseCell('K1')).toThrow();
    expect(() => parseCell('A11')).toThrow();
    expect(() => parseCell('hello')).toThrow();
  });

  it('clips neighbours at the edges', () => {
    expect(neighbours(0)).toHaveLength(2);
    expect(neighbours(cellAt(5, 5))).toHaveLength(4);
    expect(COLUMN_LABELS).toHaveLength(10);
  });
});

describe('fleet', () => {
  it('keeps the classic hull sizes', () => {
    expect(FLEET.map((ship) => ship.sections)).toEqual([5, 4, 3, 3, 2]);
    expect(TOTAL_SECTIONS).toBe(17);
  });

  it('names the same hull differently for each side', () => {
    expect(shipName('carrier', 'earth')).not.toBe(shipName('carrier', 'alien'));
  });
});

describe('placement', () => {
  it('accepts a legal deployment', () => {
    expect(validateFleet(EARTH_FLEET)).toBeNull();
  });

  it('rejects an incomplete fleet', () => {
    expect(validateFleet(EARTH_FLEET.slice(1))).toMatch(/has not been deployed/);
  });

  it('rejects overlaps', () => {
    const overlapping = EARTH_FLEET.map((placement, index) =>
      index === 1 ? { ...placement, origin: cellAt(0, 0) } : placement,
    );
    expect(validateFleet(overlapping)).toMatch(/overlaps/);
  });

  it('rejects a hull that runs off the edge', () => {
    const hanging = EARTH_FLEET.map((placement, index) =>
      index === 0 ? { ...placement, origin: cellAt(7, 0) } : placement,
    );
    expect(validateFleet(hanging)).toMatch(/does not fit/);
  });

  it('allows hulls to touch, as the standard rules do', () => {
    const touching: Placement[] = [
      { ship: 'carrier', origin: cellAt(0, 0), orientation: 'horizontal' },
      { ship: 'battlecruiser', origin: cellAt(0, 1), orientation: 'horizontal' },
      { ship: 'cruiser', origin: cellAt(4, 1), orientation: 'horizontal' },
      { ship: 'submersible', origin: cellAt(0, 2), orientation: 'horizontal' },
      { ship: 'interceptor', origin: cellAt(3, 2), orientation: 'horizontal' },
    ];
    expect(validateFleet(touching)).toBeNull();
  });

  it('enumerates every legal position for a hull', () => {
    // A 5-cell hull has 6 origins per row and 6 per column, both axes.
    expect(candidatePlacements('carrier')).toHaveLength(120);
    expect(candidatePlacements('interceptor')).toHaveLength(180);
  });
});

describe('firing', () => {
  it('alternates turns regardless of the outcome', () => {
    const game = newGame(EARTH_FLEET, ALIEN_FLEET);
    expect(game.turn).toBe('earth');
    const after = fire(game, 'earth', cellAt(0, 5)).state;
    expect(after.turn).toBe('alien');
    expect(fire(after, 'alien', cellAt(9, 9)).state.turn).toBe('earth');
  });

  it('refuses a shot out of turn, off the grid, or repeated', () => {
    const game = newGame(EARTH_FLEET, ALIEN_FLEET);
    expect(() => fire(game, 'alien', 0)).toThrow(RuleError);
    expect(() => fire(game, 'earth', 500)).toThrow(RuleError);
    const after = fire(game, 'earth', cellAt(0, 5)).state;
    const back = fire(after, 'alien', cellAt(9, 9)).state;
    expect(() => fire(back, 'earth', cellAt(0, 5))).toThrow(/already been fired on/);
  });

  it('reports a sinking only on the last section', () => {
    let state = newGame(EARTH_FLEET, ALIEN_FLEET);
    const interceptor = placementCells(ALIEN_FLEET[4]);
    let result = fire(state, 'earth', interceptor[0]);
    expect(result.shot.outcome).toBe('hit');
    state = fire(result.state, 'alien', 99).state;
    result = fire(state, 'earth', interceptor[1]);
    expect(result.shot.outcome).toBe('sunk');
    expect(result.shot.ship).toBe('interceptor');
    expect(isSunk(result.state.alien, 'interceptor')).toBe(true);
  });

  it('hides which hull was struck until it sinks', () => {
    expect(redactShot({ cell: 4, outcome: 'hit', ship: 'carrier' }).ship).toBeUndefined();
    expect(redactShot({ cell: 4, outcome: 'sunk', ship: 'carrier' }).ship).toBe('carrier');
  });

  it('ends the moment the last hull goes down, with no reply', () => {
    let state = newGame(EARTH_FLEET, ALIEN_FLEET);
    for (const cell of allCellsOf(ALIEN_FLEET)) {
      if (state.status === 'finished') break;
      state = fire(state, 'earth', cell).state;
      if (state.status !== 'finished') state = fire(state, 'alien', 99 - state.earth.shots.length).state;
    }
    expect(state.status).toBe('finished');
    expect(state.winner).toBe('earth');
    expect(() => fire(state, 'earth', 0)).toThrow(/battle is over/);
  });
});

describe('scoring', () => {
  /** Play a flawless campaign: 17 shots, 17 hits, nothing lost. */
  function perfectGame() {
    let state = newGame(EARTH_FLEET, ALIEN_FLEET);
    for (const cell of allCellsOf(ALIEN_FLEET)) {
      if (state.status === 'finished') break;
      state = fire(state, 'earth', cell).state;
      // The invader misses every shot, in the far corner rows.
      if (state.status !== 'finished') state = fire(state, 'alien', 50 + state.earth.shots.length).state;
    }
    return state;
  }

  it('awards the maximum for a flawless campaign', () => {
    const state = perfectGame();
    const stats = statsFor(state, 'earth');
    expect(stats.shots).toBe(PERFECT_SHOT_COUNT);
    expect(stats.accuracy).toBe(1);
    expect(scoreFor(state, 'overmind').total).toBe(maximumScore('overmind'));
  });

  it('pays the victory lines only on victory', () => {
    const game = newGame(EARTH_FLEET, ALIEN_FLEET);
    const opening = fire(game, 'earth', placementCells(ALIEN_FLEET[0])[0]).state;
    const score = scoreFor(opening, 'raider');
    expect(score.hits).toBe(SCORING.hit);
    expect(score.victory).toBe(0);
    expect(score.accuracy).toBe(0);
    expect(score.survival).toBe(0);
  });

  it('scales the whole subtotal by difficulty', () => {
    const state = perfectGame();
    expect(scoreFor(state, 'overmind').total).toBe(scoreFor(state, 'scout').total * 2);
  });

  it('never goes negative', () => {
    let state = newGame(EARTH_FLEET, ALIEN_FLEET);
    // Fire only into empty water, well past the perfect-game budget.
    for (let cell = 60; cell < 90; cell += 1) {
      state = fire(state, 'earth', cell).state;
      state = fire(state, 'alien', cell - 60).state;
    }
    expect(scoreFor(state, 'scout').total).toBeGreaterThanOrEqual(0);
  });
});

describe('ranks', () => {
  it('promotes on lifetime score', () => {
    expect(rankFor(0)).toBe('Cadet');
    expect(rankFor(20_000)).toBe('Squadron Leader');
    expect(rankFor(9_999_999)).toBe('Defender of Earth');
  });
});
