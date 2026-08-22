import { describe, expect, it } from 'vitest';
import { board, cleanName } from './leaderboard.js';

interface Row {
  player_id: string | null;
  captain: string;
  starfleet: string;
  difficulty: string;
  won: number;
  score: number;
  achieved_at: number;
}

/**
 * A D1 stand-in that answers the three statements the board issues, so the
 * ranking rules are tested without a database.
 */
function fakeDb(rows: readonly Row[]): D1Database {
  const ranked = [...rows].sort((a, b) => b.score - a.score || a.achieved_at - b.achieved_at);
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const statement = {
      bind(...bound: unknown[]) {
        args = bound;
        return statement;
      },
      all: async () => ({ results: ranked.slice(0, Number(args[0])) }),
      first: async () => {
        if (sql.includes('COUNT(*)')) {
          const [score, , achievedAt] = args as [number, number, number];
          const ahead = ranked.filter(
            (row) => row.score > score || (row.score === score && row.achieved_at < achievedAt),
          ).length;
          return { ahead };
        }
        return ranked.find((row) => row.player_id === args[0]) ?? null;
      },
    };
    return statement;
  };
  return { prepare } as unknown as D1Database;
}

function row(partial: Partial<Row> & { score: number }): Row {
  return {
    player_id: null,
    captain: 'Seeded',
    starfleet: 'Perihelion',
    difficulty: 'raider',
    won: 1,
    achieved_at: 1,
    ...partial,
  };
}

describe('captain names', () => {
  it('collapses whitespace and clamps length', () => {
    expect(cleanName('  Vela   Okonkwo  ', 'fallback')).toBe('Vela Okonkwo');
    expect(cleanName('x'.repeat(40), 'fallback')).toHaveLength(24);
  });

  it('falls back when the name is missing or blank', () => {
    expect(cleanName(undefined, 'Unknown Captain')).toBe('Unknown Captain');
    expect(cleanName('   ', 'Unknown Captain')).toBe('Unknown Captain');
  });
});

describe('the board', () => {
  const rows = [
    row({ score: 9000, achieved_at: 1 }),
    row({ score: 9000, achieved_at: 2 }),
    row({ score: 4000, achieved_at: 3 }),
  ];

  it('ranks by score, breaking ties on who got there first', async () => {
    const { entries, yourRank } = await board(fakeDb(rows));
    expect(entries.map((entry) => entry.rank)).toEqual([1, 2, 3]);
    expect(entries.map((entry) => entry.achievedAt)).toEqual([1, 2, 3]);
    expect(entries.every((entry) => !entry.you)).toBe(true);
    expect(yourRank).toBeUndefined();
  });

  it('marks the caller and reports their rank', async () => {
    const mine = [...rows, row({ score: 12000, achieved_at: 4, player_id: 'me' })];
    const { entries, yourRank } = await board(fakeDb(mine), 'me');
    expect(yourRank).toBe(1);
    expect(entries[0].you).toBe(true);
  });

  it('marks only the best of the caller’s rows', async () => {
    const mine = [
      ...rows,
      row({ score: 12000, achieved_at: 4, player_id: 'me' }),
      row({ score: 6000, achieved_at: 5, player_id: 'me' }),
    ];
    const { entries, yourRank } = await board(fakeDb(mine), 'me');
    expect(yourRank).toBe(1);
    expect(entries.filter((entry) => entry.you).map((entry) => entry.rank)).toEqual([1]);
  });

  it('carries the caller along when they are off the bottom of the board', async () => {
    const many = [
      ...Array.from({ length: 30 }, (_, index) => row({ score: 20000 + index, achieved_at: index })),
      row({ score: 10, achieved_at: 99, player_id: 'me', captain: 'Late Starter' }),
    ];
    const { entries, yourRank } = await board(fakeDb(many), 'me');
    expect(entries).toHaveLength(26);
    expect(yourRank).toBe(31);
    expect(entries[25]).toMatchObject({ captain: 'Late Starter', rank: 31, you: true });
  });
});
