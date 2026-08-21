-- Career records are keyed by a hash of the player's bearer token, never the
-- token itself, so a leak of this table does not let anyone impersonate a
-- player or resume their campaigns.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  seen_at INTEGER NOT NULL,
  -- Aggregated PlayerProgress. Stored whole because it is only ever read and
  -- written as one object, and keeping it additive means no per-shot rows.
  progress TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS completed_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  match_id TEXT NOT NULL,
  finished_at INTEGER NOT NULL,
  difficulty TEXT NOT NULL,
  won INTEGER NOT NULL,
  score INTEGER NOT NULL,
  shots INTEGER NOT NULL,
  accuracy REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_completed_games_player
  ON completed_games (player_id, finished_at DESC);
