-- The shared board every campaign is measured against. Unlike `players`, a row
-- here is public: it carries the captain and starfleet names the player typed
-- at their briefing, and nothing that identifies the browser beyond the same
-- token digest used elsewhere.
CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- Null for the seeded captains, which belong to no browser.
  player_id TEXT,
  captain TEXT NOT NULL,
  starfleet TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  won INTEGER NOT NULL,
  score INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard (score DESC);

-- Seed captains, so a first-time player has a board to climb rather than an
-- empty table. Fixed ids make the insert idempotent: re-running the migration
-- cannot duplicate them, and a real score never collides because those rows
-- take their ids from the sequence above these.
INSERT OR IGNORE INTO leaderboard (id, player_id, captain, starfleet, difficulty, won, score, achieved_at) VALUES
  (1,  NULL, 'Vela Okonkwo',    'Perihelion', 'overmind', 1, 17200, 1735689600000),
  (2,  NULL, 'Idris Vance',     'Ironhold',   'overmind', 1, 16050, 1735776000000),
  (3,  NULL, 'Mireille Sanz',   'Aurora',     'overmind', 1, 14800, 1735862400000),
  (4,  NULL, 'Kwame Adeyemi',   'Orion Gate', 'raider',   1, 13350, 1735948800000),
  (5,  NULL, 'Sun-hee Park',    'Halcyon',    'raider',   1, 12600, 1736035200000),
  (6,  NULL, 'Dmitri Kovalenko','Vanguard',   'raider',   1, 11450, 1736121600000),
  (7,  NULL, 'Ana Ferreira',    'Solaris',    'raider',   1, 10200, 1736208000000),
  (8,  NULL, 'Tobias Lindqvist','Terra Nova', 'scout',    1,  8900, 1736294400000),
  (9,  NULL, 'Nadia Haddad',    'Perihelion', 'scout',    1,  7650, 1736380800000),
  (10, NULL, 'Rafael Duarte',   'Aurora',     'scout',    1,  6400, 1736467200000),
  (11, NULL, 'Grace Whitlock',  'Ironhold',   'raider',   0,  4100, 1736553600000),
  (12, NULL, 'Hiroshi Tanabe',  'Vanguard',   'overmind', 0,  2750, 1736640000000);
