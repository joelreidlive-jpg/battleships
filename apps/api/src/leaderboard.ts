import type { Difficulty } from '@bs/rules';
import type { LeaderboardEntry, LeaderboardResponse } from '@bs/protocol';

/** How many rows the board shows. Deep enough to climb, short enough to scroll. */
export const BOARD_SIZE = 25;

/** Names are the player's own words, so they are clamped before they are stored. */
const NAME_LIMIT = 24;

export function cleanName(value: string | undefined, fallback: string): string {
  const trimmed = (value ?? '').replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
  return trimmed === '' ? fallback : trimmed;
}

export interface BoardEntry {
  readonly captain: string;
  readonly starfleet: string;
  readonly difficulty: Difficulty;
  readonly won: boolean;
  readonly score: number;
}

export async function postScore(db: D1Database, playerId: string, entry: BoardEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO leaderboard (player_id, captain, starfleet, difficulty, won, score, achieved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(playerId, entry.captain, entry.starfleet, entry.difficulty, entry.won ? 1 : 0, entry.score, Date.now())
    .run();
}

interface BoardRow {
  player_id: string | null;
  captain: string;
  starfleet: string;
  difficulty: string;
  won: number;
  score: number;
  achieved_at: number;
}

/**
 * The top of the board, highest score first, ties broken by who got there
 * first. `playerId` is optional: the board is public, and a caller without a
 * token simply has no row marked as theirs.
 */
export async function board(db: D1Database, playerId?: string): Promise<LeaderboardResponse> {
  const { results } = await db
    .prepare(
      `SELECT player_id, captain, starfleet, difficulty, won, score, achieved_at
       FROM leaderboard ORDER BY score DESC, achieved_at ASC LIMIT ?`,
    )
    .bind(BOARD_SIZE)
    .all<BoardRow>();

  const entries: LeaderboardEntry[] = results.map((row, index) =>
    toEntry(row, index + 1, playerId !== undefined && row.player_id === playerId),
  );

  const shown = entries.find((entry) => entry.you);
  if (shown) return { entries, yourRank: shown.rank };
  if (playerId === undefined) return { entries };

  // Outside the top of the board, the player's own best is carried along as a
  // trailing row so there is always somewhere to scroll to.
  const mine = await bestFor(db, playerId);
  if (mine === null) return { entries };
  return { entries: [...entries, mine], yourRank: mine.rank };
}

async function bestFor(db: D1Database, playerId: string): Promise<LeaderboardEntry | null> {
  const row = await db
    .prepare(
      `SELECT player_id, captain, starfleet, difficulty, won, score, achieved_at
       FROM leaderboard WHERE player_id = ? ORDER BY score DESC, achieved_at ASC LIMIT 1`,
    )
    .bind(playerId)
    .first<BoardRow>();
  if (row === null) return null;

  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS ahead FROM leaderboard
       WHERE score > ? OR (score = ? AND achieved_at < ?)`,
    )
    .bind(row.score, row.score, row.achieved_at)
    .first<{ ahead: number }>();

  return toEntry(row, (ahead?.ahead ?? 0) + 1, true);
}

function toEntry(row: BoardRow, rank: number, you: boolean): LeaderboardEntry {
  return {
    rank,
    captain: row.captain,
    starfleet: row.starfleet,
    difficulty: row.difficulty as Difficulty,
    won: row.won === 1,
    score: row.score,
    achievedAt: row.achieved_at,
    you,
  };
}
