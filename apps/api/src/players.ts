import type { Difficulty } from '@bs/rules';
import { EMPTY_PROGRESS, type GameSummary, type PlayerProgress } from '@bs/protocol';

/**
 * A player is identified by an opaque bearer token held in the browser. There
 * are no accounts, so this is the whole identity: unguessable, but lost if the
 * browser is cleared. Adding real sign-in later means mapping an account to
 * this same key, not changing anything below it.
 */
export function newPlayerToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Rows are keyed by the token's digest so the database never holds the secret. */
export async function playerKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface PlayerRow {
  progress: string;
}

export async function loadProgress(db: D1Database, key: string): Promise<PlayerProgress> {
  const row = await db.prepare('SELECT progress FROM players WHERE id = ?').bind(key).first<PlayerRow>();
  return row ? (JSON.parse(row.progress) as PlayerProgress) : EMPTY_PROGRESS;
}

export interface FinishedGame {
  readonly matchId: string;
  readonly difficulty: Difficulty;
  readonly won: boolean;
  readonly score: number;
  readonly shots: number;
  readonly hits: number;
}

/**
 * Persist a finished campaign and return the new career total.
 *
 * The read-modify-write is safe because a player has at most one campaign
 * finishing at a time, and a lost update costs one game's statistics rather
 * than corrupting the total.
 */
export async function recordGame(db: D1Database, key: string, game: FinishedGame): Promise<PlayerProgress> {
  const previous = await loadProgress(db, key);
  const progress: PlayerProgress = {
    games: previous.games + 1,
    wins: previous.wins + (game.won ? 1 : 0),
    bestScore: Math.max(previous.bestScore, game.score),
    totalScore: previous.totalScore + game.score,
    shots: previous.shots + game.shots,
    hits: previous.hits + game.hits,
  };
  const now = Date.now();

  await db.batch([
    db
      .prepare(
        `INSERT INTO players (id, created_at, seen_at, progress) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET seen_at = excluded.seen_at, progress = excluded.progress`,
      )
      .bind(key, now, now, JSON.stringify(progress)),
    db
      .prepare(
        `INSERT INTO completed_games (player_id, match_id, finished_at, difficulty, won, score, shots, accuracy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        key,
        game.matchId,
        now,
        game.difficulty,
        game.won ? 1 : 0,
        game.score,
        game.shots,
        game.shots === 0 ? 0 : game.hits / game.shots,
      ),
  ]);
  return progress;
}

interface GameRow {
  match_id: string;
  finished_at: number;
  difficulty: string;
  won: number;
  score: number;
  shots: number;
  accuracy: number;
}

export async function recentGames(db: D1Database, key: string, limit = 10): Promise<GameSummary[]> {
  const { results } = await db
    .prepare(
      `SELECT match_id, finished_at, difficulty, won, score, shots, accuracy
       FROM completed_games WHERE player_id = ? ORDER BY finished_at DESC LIMIT ?`,
    )
    .bind(key, limit)
    .all<GameRow>();

  return results.map((row) => ({
    matchId: row.match_id,
    finishedAt: row.finished_at,
    difficulty: row.difficulty as Difficulty,
    won: row.won === 1,
    score: row.score,
    shots: row.shots,
    accuracy: row.accuracy,
  }));
}
