import { describe, expect, it } from 'vitest';
import { COLUMN_LABELS, cellAt, formatCell, neighbours, parseCell } from './grid.js';
import { FLEET, HULLS, TOTAL_SECTIONS, hullName, shipName } from './fleet.js';
import { type Placement, candidatePlacements, placementCells, validateFleet } from './placement.js';
import { RuleError, fire, isSunk, newGame, redactShot, statsFor } from './game.js';
import { PERFECT_SHOT_COUNT, SCORING, maximumScore, scoreFor } from './scoring.js';
import { rankFor } from './ranks.js';

/** All ten hulls laid out in rows 1-4, well clear of each other. */
const EARTH_FLEET: Placement[] = [
  { hull: 'battleship-1', origin: cellAt(0, 0), orientation: 'horizontal' },
  { hull: 'cruiser-1', origin: cellAt(0, 1), orientation: 'horizontal' },
  { hull: 'cruiser-2', origin: cellAt(4, 1), orientation: 'horizontal' },
  { hull: 'destroyer-1', origin: cellAt(0, 2), orientation: 'horizontal' },
  { hull: 'destroyer-2', origin: cellAt(3, 2), orientation: 'horizontal' },
  { hull: 'destroyer-3', origin: cellAt(6, 2), orientation: 'horizontal' },
  { hull: 'submarine-1', origin: cellAt(0, 3), orientation: 'horizontal' },
  { hull: 'submarine-2', origin: cellAt(2, 3), orientation: 'horizontal' },
  { hull: 'submarine-3', origin: cellAt(4, 3), orientation: 'horizontal' },
  { hull: 'submarine-4', origin: cellAt(6, 3), orientation: 'horizontal' },
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
  it('deploys one battleship, two cruisers, three destroyers and four submarines', () => {
    expect(FLEET.map((ship) => [ship.sections, ship.count])).toEqual([
      [4, 1],
      [3, 2],
      [2, 3],
      [1, 4],
    ]);
    expect(HULLS).toHaveLength(10);
    expect(TOTAL_SECTIONS).toBe(20);
  });

  it('names the same hull differently for each side', () => {
    expect(shipName('cruiser', 'earth')).not.toBe(shipName('cruiser', 'alien'));
  });

  it('numbers hulls whose class is deployed more than once', () => {
    expect(hullName('battleship-1', 'earth')).not.toMatch(/ I+$/);
    expect(hullName('cruiser-2', 'earth')).toMatch(/ II$/);
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
    const touching: Placement[] = EARTH_FLEET.map((placement, index) =>
      index === 1 ? { ...placement, origin: cellAt(4, 0) } : placement,
    );
    expect(validateFleet(touching)).toBeNull();
  });

  it('enumerates every legal position for a hull', () => {
    // A 4-cell hull has 7 origins per row and 7 per column, both axes.
    expect(candidatePlacements('battleship-1')).toHaveLength(140);
    // A single-section hull is enumerated once per cell, not once per axis.
    expect(candidatePlacements('submarine-1')).toHaveLength(100);
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
    const destroyer = placementCells(ALIEN_FLEET[3]);
    let result = fire(state, 'earth', destroyer[0]);
    expect(result.shot.outcome).toBe('hit');
    state = fire(result.state, 'alien', 99).state;
    result = fire(state, 'earth', destroyer[1]);
    expect(result.shot.outcome).toBe('sunk');
    expect(result.shot.hull).toBe('destroyer-1');
    expect(isSunk(result.state.alien, 'destroyer-1')).toBe(true);
  });

  it('sinks a single-section submarine on the first hit', () => {
    const state = newGame(EARTH_FLEET, ALIEN_FLEET);
    const result = fire(state, 'earth', ALIEN_FLEET[6].origin);
    expect(result.shot.outcome).toBe('sunk');
    expect(result.shot.hull).toBe('submarine-1');
  });

  it('hides which hull was struck until it sinks', () => {
    expect(redactShot({ cell: 4, outcome: 'hit', hull: 'cruiser-1' }).hull).toBeUndefined();
    expect(redactShot({ cell: 4, outcome: 'sunk', hull: 'cruiser-1' }).hull).toBe('cruiser-1');
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
  /** Play a flawless campaign: one shot per enemy section, nothing lost. */
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
    // Fire only into empty space, well past the perfect-game budget: the
    // invader is deployed in the lower half of its grid, the player in the upper
    // half of its own.
    for (let cell = 0; cell < 30; cell += 1) {
      state = fire(state, 'earth', cell).state;
      state = fire(state, 'alien', cell + 40).state;
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
