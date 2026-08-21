# Orbital Battleships Command — technical specification

> **Generated document — do not edit.**
> Produced by `pnpm docs` from the code that implements the behaviour it
> describes. CI runs `pnpm docs:check`, so this file cannot drift from the
> engine, the AI, the API surface or the database schema.

## 1. Scope

This document specifies the whole system: the rules engine, the opponent, the
HTTP contract, the persisted state and the deployment topology. It is written
so the game can be rebuilt from it if the source is lost. Where a rule is a
choice rather than a consequence, the reason is given, because a
reimplementation needs to know which parts are load-bearing.

Deliberately absent, so nobody plans around them: human-versus-human play (the
invader submits shots through the same code path a second player would, but no
transport or matchmaking exists), accounts, and any global leaderboard — the
career record is per browser.


## 2. Architecture

One Cloudflare Worker serves both the JSON API and the static client, so there
is no cross-origin surface and a deploy cannot ship half a change.

```
browser (React SPA)
   │  fetch /api/*        same origin
   ▼
Worker (Hono router)
   ├── /api/*  ──► MatchDO (Durable Object, one per campaign)
   │                 · authoritative game state
   │                 · alien fleet positions  ← never leaves this object
   │                 · invader's shot selection
   ├── /api/me/progress ──► D1 (SQLite): career records
   └── *  ──► static assets (the SPA build)
```

Three properties drive the design:

1. **The server owns the secret.** The alien deployment exists only inside the
   Durable Object. The client is told the outcome of its own shots and nothing
   more, so there is no bundle to disassemble and no response to inspect.
2. **One Durable Object per campaign is the concurrency control.** It is the
   only writer of its state, so there is no lock, no transaction and no way for
   two shots to interleave.
3. **The invader plays through the same code path a human would.** It calls the
   same `fire` with the same legality checks, from a redacted view of its own
   shot history. Seating a second human later adds a transport, not a second
   game loop.


## 3. Package layout

| Package | Contents | Depends on |
| --- | --- | --- |
| `packages/rules` | Grid, fleet, placement legality, shot resolution, scoring, ranks, RNG helpers. Pure and dependency-free — the only package shared with the browser. | nothing |
| `packages/ai` | Fleet deployment, shot-history inference, probability density, the three doctrines. | `@bs/rules` |
| `packages/protocol` | Wire types and the API route table. Type-only apart from two constants. | `@bs/rules` |
| `apps/api` | Hono Worker, `MatchDO` Durable Object, D1 access. | all three |
| `apps/web` | React + Vite client, SVG grids. | `@bs/rules`, `@bs/protocol` |

`apps/web` importing `@bs/ai` is a lint error, not a convention: the AI can see
both grids, so shipping it to the browser would ship the means to read them.


## 4. Coordinate system

The grid is 10 columns by 10 rows, 100 cells. A cell is a single integer index:

```
cell   = row * 10 + column          // 0 .. 99
column = cell % 10
row    = floor(cell / 10)
label  = "ABCDEFGHIJ"[column] + (row + 1)   // e.g. cell 61 -> "B7"
```

An index rather than a pair because every hot path is a set-membership test,
and a number is a usable set key where an object is not. Neighbours are the up
to four orthogonally adjacent cells, clipped at the edges — a hull never wraps
from one row to the next.


## 5. Fleet and deployment

| Class id | Hulls | Sections each | Earth name | Alien name | Legal positions on an empty grid |
| --- | --- | --- | --- | --- | --- |
| `battleship` | 1 | 4 | Solar Battleship | Hive Dreadnought | 140 |
| `cruiser` | 2 | 3 | Ion Cruiser | Swarm Cruiser | 160 |
| `destroyer` | 3 | 2 | Nova Destroyer | Needle Skiff | 180 |
| `submarine` | 4 | 1 | Void Submarine | Shadow Lurker | 100 |

A class may be deployed more than once, so the unit of play is the *hull*, not
the class. Hull ids are `${classId}-${ordinal}`, one-based in deployment
order:

```
battleship-1, cruiser-1, cruiser-2, destroyer-1, destroyer-2, destroyer-3, submarine-1, submarine-2, submarine-3, submarine-4
```

A single-section hull has one legal position per cell rather than two: the two
orientations are the same placement, and enumerating both would double its
weight in the density map.

Total 10 hulls, 20 sections per side. A placement is `{ hull, origin, orientation }` where
`origin` is the westmost cell when horizontal and the northmost when vertical:

```
cells(placement) = [0 .. sections-1].map(i =>
  orientation == horizontal ? cell(column + i, row) : cell(column, row + i))
```

A whole deployment is legal when, and only when:

1. every hull appears exactly once;
2. every hull fits inside the grid on its axis;
3. no two hulls share a cell.

Hulls may touch. Legality is validated as a set, not per hull, and the server
re-validates any client-supplied deployment before accepting it.

**Invader deployment** is uniform over legal, non-overlapping arrangements:
hulls are placed largest first, each drawn uniformly from the positions still
free, retrying the whole layout if a hull has nowhere to go. Uniform is
deliberate — any cleverer scheme would be learnable across games, which is a
worse leak than randomness is a weakness.


## 6. Game state and lifecycle

```
GameState {
  earth: { fleet: Placement[], shots: Shot[] }   // shots fired AT Earth
  alien: { fleet: Placement[], shots: Shot[] }   // shots fired AT the invader
  turn:   'earth' | 'alien'
  status: 'playing' | 'finished'
  winner?: 'earth' | 'alien'
}
Shot { cell, outcome: 'miss' | 'hit' | 'sunk', hull? }
```

Shots are recorded against the grid that was *fired at*, which is what makes a
hull's damage a function of that grid alone: `damage(hull) = count(shots where
shot.hull == hull)`, and a hull is destroyed when its damage reaches its
section count. Damage is tracked per hull, not per class, so sinking one of the
two cruisers says nothing about the other.

Lifecycle:

```
create  ──► playing ──► finished
              │            ▲
              └─ resign ───┘
```

- **create** — validate both deployments, Earth to move.
- **playing** — turns alternate strictly. A hit never grants another shot.
- **finished** — reached when either fleet has no intact hull, or the player
  resigns. Shots are rejected from then on, and the alien deployment is
  released to the client.

There is no draw: the side that fires the destroying shot wins, and the loser
gets no reply.


### 6.1 Shot resolution

```
fire(state, side, cell):
  reject if state.status == 'finished'
  reject if state.turn != side
  reject if cell outside 0..99
  reject if the defender's grid already has a shot at cell

  defender = other(side)
  hull     = hull occupying cell on the defender's grid, if any

  if no hull:            shot = { cell, 'miss' }
  else if damage(hull) + 1 == sections(hull):
                         shot = { cell, 'sunk', hull }
  else:                  shot = { cell, 'hit',  hull }

  append shot to the defender's grid
  if every defender hull is destroyed:
      status = 'finished'; winner = side          // no reply
  else:
      turn = defender
```

### 6.2 Information redaction

`Shot.hull` is recorded internally on every hit, because damage accounting
needs it, and stripped on the way out unless the outcome is `sunk`:

```
redact(shot) = shot.outcome == 'sunk' ? shot : { cell, outcome }
```

Both the wire protocol and the invader's own view of its shots pass through
this function. That is what makes the opponent fair rather than merely
polite: it is given exactly the information the player is given.


## 7. Scoring

| Constant | Value |
| --- | --- |
| `hit` | 100 |
| `sinkPerSection` | 60 |
| `victory` | 1000 |
| `accuracyBonus` | 1000 |
| `survivingSection` | 200 |
| `wastedShot` | 10 |

| Doctrine | Multiplier |
| --- | --- |
| `scout` | x1 |
| `raider` | x1.5 |
| `overmind` | x2 |

```
hits        = playerHits * 100
sinks       = Σ sections(hull) * 60   over destroyed alien hulls
wastedShots = max(0, playerShots - 20) * 10
accuracy    = won ? round(1000 * playerHits / playerShots) : 0
survival    = won ? intactSectionsOfPlayerFleet * 200 : 0
victory     = won ? 1000 : 0

subtotal    = max(0, hits + sinks + accuracy + survival + victory - wastedShots)
total       = round(subtotal * multiplier(difficulty))
```

The function is total: it is defined mid-game (the victory lines are zero) and
after a loss, so the client can show a live score without a second code path.

Career ranks are awarded on lifetime total: Cadet (0), Flight Officer (5000), Squadron Leader (20000), Wing Commander (50000), Star Marshal (100000), Defender of Earth (250000).


## 8. The opponent

| Id | Name | Score multiplier | Mean shots to clear a fleet (300 games) | Mean shots to the last multi-section hull |
| --- | --- | --- | --- | --- |
| `scout` | Scout Wave | x1 | 96.7 | 95.5 |
| `raider` | Raider Flight | x1.5 | 85.6 | 66.4 |
| `overmind` | Overmind | x2 | 85.5 | 50.3 |

The second figure is the one to test against. Nothing can be inferred about a
single-section hull, so hunting the four submarines is a uniform search that
costs all three doctrines roughly the same and compresses the first figure.

All three receive the same input — the redacted list of shots they have fired —
and return one untried cell. No doctrine sees the defender's grid.

### 8.1 Inference from shot history

```
readIntel(shots):
  fired, misses, resolvedHits, openHits = ∅
  for shot in shots (in order):
      fired += cell
      if miss: misses += cell; continue
      openHits += cell
      if outcome == 'sunk':
          size = sections(shot.hull)
          claim the run of openHits through cell along one axis, length size
          move those cells from openHits to resolvedHits
  remaining = hulls not yet announced as sunk
```

A sinking announces the hull but not the cells it occupied, so the run
through the sinking cell is claimed for it. This is wrong only when two hulls
were hit adjacently and in line, and the cost is one wasted probe.

### 8.2 Doctrines

**Scout Wave** — uniformly random untried cell.

**Raider Flight** — hunt and target.

```
if openHits is non-empty:
    if two openHits are adjacent in line, fire at either end of that run
    else fire at an orthogonal neighbour of an open hit
else:
    step = smallest section count among surviving hulls
    fire at a random untried cell where (column + row) % step == 0
```

The parity sweep is exact, not a heuristic: a hull of length *n* must cover a
cell on every *n*-th diagonal, so those cells are sufficient to guarantee a
first hit, and the step shrinks as hulls sink.

**Overmind** — exact placement density.

```
for each surviving hull:
    for each legal placement of that hull:
        skip if it covers a miss or a resolved hit
        weight = 50 ^ (number of open hits it covers)
        add weight to every untried cell it covers
fire at the maximum, ties broken at random
```

This enumerates every consistent arrangement rather than sampling — at most a
few thousand placements per turn — so it is exact, deterministic given its tie
break, and needs no tuning. The weight makes explaining a known hit dominate
mere plausibility, which is what merges "hunt" and "target" into one rule.

### 8.3 Randomness

Every random choice takes an injected `Rng: () => number`. The Worker passes a
CSPRNG (`crypto.getRandomValues`); tests pass a seeded mulberry32, which makes
a campaign reproducible from its seed. `Math.random` is a lint error across the
repository.


## 9. HTTP API

All responses are JSON. Errors are `{ "error": string }` with status 400
(illegal move or malformed request), 401 (no token), 403 (not your campaign),
404 (unknown campaign) or 409 (campaign already exists).

| Endpoint | Token | Request | Response | Purpose |
| --- | --- | --- | --- | --- |
| `POST /api/matches` | no | `CreateMatchRequest` | `CreateMatchResponse` | Start a campaign. Deploys the player fleet, or accepts one, and the invader fleet. |
| `GET /api/matches/:id` | yes | — | `MatchView` | Current state of a campaign, from the player’s point of view. |
| `POST /api/matches/:id/fire` | yes | `FireRequest` | `MatchView` | Fire at one cell of the invader grid; the invader replies in the same call. |
| `POST /api/matches/:id/resign` | yes | — | `MatchView` | Concede the campaign. The invader fleet is revealed. |
| `GET /api/me/progress` | yes | — | `ProgressResponse` | Career record and rank for the bearer token. |
| `GET /api/leaderboard` | no | — | `LeaderboardResponse` | The shared board of best campaigns, seeded captains included. |
| `GET /api/fleet` | no | — | `ReferenceResponse` | Fleet roster, grid size, scoring table and difficulty doctrines. Public reference data. |
| `GET /api/health` | no | — | `HealthResponse` | Liveness probe with the deployed version. |

Authentication is the `x-player-token` header: a 32-byte random hex string
issued by `POST /api/matches` and stored in `localStorage`. There are no
accounts. The Durable Object stores only the SHA-256 digest of the token and
compares digests, so the object's storage cannot be used to impersonate the
player.

`POST /api/matches/:id/fire` resolves **both** shots — the player's and the
invader's reply — and returns the resulting view. One round trip, because two
would let a client take its own shot and then abandon the turn.

The route table above is `API_ROUTES` in `@bs/protocol`, and a unit test
diffs it against the routes Hono actually registered, so an undocumented
endpoint fails the build.


## 10. Wire types

Embedded verbatim from `packages/protocol/src/wire.ts`.

```ts
import type {
  Cell,
  Difficulty,
  HullId,
  Placement,
  ScoreBreakdown,
  ShipClassId,
  Shot,
  Side,
  SideStats,
} from '@bs/rules';

/**
 * Wire types shared by the Worker and the browser. Type-only, so importing
 * this package adds nothing to either bundle.
 *
 * The shape enforces the game's one secret: `defence` carries the player's own
 * hulls, `offence` carries only the results of the player's own shots, and the
 * invader's deployment appears in `alienFleet` exactly once — after the battle
 * has ended. A destroyed invader hull is the one exception: its position is
 * already fully known from the player's own hit marks, so its wreck is sent
 * back to be drawn.
 */

export interface DefenceView {
  readonly fleet: readonly Placement[];
  /** Shots the invader has fired at the player. */
  readonly shots: readonly Shot[];
  readonly sunk: readonly HullId[];
}

export interface OffenceView {
  /** The player's own shots. A hull's identity appears only when it sinks. */
  readonly shots: readonly Shot[];
  readonly sunk: readonly HullId[];
  /** Destroyed invader hulls, so the craft the player killed can be seen. */
  readonly wrecks: readonly Placement[];
}

export interface LogEntry {
  readonly seq: number;
  readonly side: Side;
  readonly cell: Cell;
  readonly outcome: Shot['outcome'];
  readonly hull?: HullId;
  /** Pre-rendered so the transcript reads identically everywhere. */
  readonly text: string;
}

export interface MatchView {
  readonly matchId: string;
  readonly status: 'playing' | 'finished';
  readonly turn: Side;
  readonly difficulty: Difficulty;
  readonly createdAt: number;
  readonly defence: DefenceView;
  readonly offence: OffenceView;
  /** Revealed only once the battle is over. */
  readonly alienFleet?: readonly Placement[];
  readonly score: ScoreBreakdown;
  readonly stats: { readonly earth: SideStats; readonly alien: SideStats };
  readonly log: readonly LogEntry[];
  readonly winner?: Side;
}

export interface CreateMatchRequest {
  readonly difficulty?: Difficulty;
  /** Omit to have Fleet Command deploy for you. */
  readonly fleet?: readonly Placement[];
  /** Names from the briefing, carried so a finished campaign can be posted to the board. */
  readonly captain?: string;
  readonly starfleet?: string;
}

export interface CreateMatchResponse {
  /** Opaque bearer token identifying the player. Store it and send it back. */
  readonly playerToken: string;
  readonly match: MatchView;
}

export interface FireRequest {
  readonly cell: Cell;
}

export interface GameSummary {
  readonly matchId: string;
  readonly finishedAt: number;
  readonly difficulty: Difficulty;
  readonly won: boolean;
  readonly score: number;
  readonly shots: number;
  readonly accuracy: number;
}

export interface PlayerProgress {
  readonly games: number;
  readonly wins: number;
  readonly bestScore: number;
  readonly totalScore: number;
  readonly shots: number;
  readonly hits: number;
}

export const EMPTY_PROGRESS: PlayerProgress = {
  games: 0,
  wins: 0,
  bestScore: 0,
  totalScore: 0,
  shots: 0,
  hits: 0,
};

export interface ProgressResponse {
  readonly progress: PlayerProgress;
  /** Career hit rate across every campaign. */
  readonly accuracy: number;
  readonly rank: string;
  readonly recentGames: readonly GameSummary[];
}

/** Reference data the client renders rather than hard-coding. */
export interface ReferenceResponse {
  readonly grid: { readonly columns: number; readonly rows: number; readonly columnLabels: readonly string[] };
  readonly fleet: readonly {
    readonly id: ShipClassId;
    readonly sections: number;
    /** How many hulls of this class each side deploys. */
    readonly count: number;
    readonly earthName: string;
    readonly alienName: string;
    readonly blurb: string;
  }[];
  readonly scoring: Record<string, number>;
  readonly doctrines: readonly {
    readonly id: Difficulty;
    readonly name: string;
    readonly tagline: string;
    readonly scoreMultiplier: number;
  }[];
}

export interface HealthResponse {
  readonly status: 'ok';
  readonly version: string;
}

/** One row of the shared board. Ranks are 1-based and dense from the top. */
export interface LeaderboardEntry {
  readonly rank: number;
  readonly captain: string;
  readonly starfleet: string;
  readonly difficulty: Difficulty;
  readonly won: boolean;
  readonly score: number;
  readonly achievedAt: number;
  /** True when this row was posted by the bearer of the calling token. */
  readonly you: boolean;
}

export interface LeaderboardResponse {
  readonly entries: readonly LeaderboardEntry[];
  /** The caller's best rank within `entries`, when they hold one. */
  readonly yourRank?: number;
}

export interface ErrorResponse {
  readonly error: string;
}
```


## 11. Persistence

### 11.1 Durable Object storage (one per campaign)

| Key | Value |
| --- | --- |
| `meta` | `{ matchId, difficulty, playerKey, playerTokenHash, createdAt, recorded? }` |
| `state` | the `GameState` above, including both fleets |
| `log` | the rendered transcript, one entry per shot |

The object is loaded into memory in `blockConcurrencyWhile` at construction and
written back after every accepted shot. A campaign is self-contained: losing
one loses that campaign and nothing else.

### 11.2 D1 (career records, shared)

Embedded verbatim from `apps/api/migrations/0001_players.sql`.

```sql
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
```

Rows are keyed by the SHA-256 digest of the bearer token, so the database never
holds a credential. `progress` is a whole JSON object because it is only ever
read and written as one, and the read-modify-write at the end of a campaign is
safe: a player finishes at most one campaign at a time, and a lost update costs
one game's statistics rather than corrupting the total.


## 12. Security model

| Threat | Control |
| --- | --- |
| Reading the alien fleet | It exists only in the Durable Object. Responses carry only the outcomes of the player's own shots; the deployment is released after the battle ends. A lint rule keeps `@bs/ai` out of the browser bundle. |
| Forging a shot | The Worker re-validates turn, bounds and repetition against its own state. Nothing the client sends is trusted, including its own deployment. |
| Playing another player's campaign | Every campaign request carries the bearer token; the object compares its digest and answers 403 otherwise. |
| Token theft from storage | Only digests are stored, in both the Durable Object and D1. |
| Predictable placement or targeting | All randomness comes from `crypto.getRandomValues` in production. |
| XSS | The client renders no HTML from any input, and the Worker sets `Content-Security-Policy: default-src 'self'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` and `Referrer-Policy: no-referrer` on every response. |
| Supply chain | Dependencies are pinned by lockfile, reviewed by Dependabot and scanned by CodeQL on every pull request. |

There are no secrets in the repository and none in the client bundle. The
Cloudflare API token used to deploy exists only as a GitHub Actions secret.


## 13. Invariants

A reimplementation is correct when all of these hold. Each is covered by a test
in the repository.

1. A cell is never fired at twice on the same grid.
2. Turn order alternates strictly; a hit grants no extra shot.
3. A shot is refused out of turn, off the grid, or after the game ends.
4. `sunk` is reported on, and only on, the shot that takes a hull's last
   section.
5. The identity of a struck hull is never disclosed before it sinks.
6. The game ends the instant a fleet loses its last hull, and the losing side
   does not reply.
7. Any deployment that is incomplete, overlapping or off the grid is rejected,
   from client or server.
8. A flawless campaign scores exactly `maximumScore(difficulty)`; the total is
   never negative.
9. The doctrines are strictly ordered by mean shots to destroy every
   multi-section hull:
   Scout Wave > Raider Flight > Overmind.
10. Every route Hono registers appears in `API_ROUTES`, and vice versa.


## 14. Build, test and delivery

| Concern | Choice |
| --- | --- |
| Package manager | pnpm workspaces, Node 20+ |
| Language | TypeScript, `strict`, project references |
| Tests | Vitest, with coverage thresholds enforced in CI |
| Lint | ESLint, including the import bans described above |
| CI | GitHub Actions on every pull request: lint, typecheck, unit tests, documentation drift check, client build, CodeQL |
| Versioning | Semantic Versioning; a `v*` tag builds and deploys, and the tag is injected as `APP_VERSION` and reported by `GET /api/health` |
| Deploy | `wrangler deploy` from the release workflow; the client build is uploaded as Worker assets in the same deploy |
| Configuration | `apps/api/wrangler.jsonc` — Durable Object binding `MATCH`, D1 binding `DB`, asset binding `ASSETS` |


## 15. Rebuilding from this document

In order:

1. Implement §4–§7 as a pure library with no I/O. It is testable on its own and
   everything else depends on it.
2. Implement §8 against the redacted shot list only. Verify with the ordering
   in §13.9 before wiring anything up.
3. Implement the state holder of §2 and §11.1 — one instance per campaign, the
   only writer, holding both fleets.
4. Implement §9 over it, redacting per §6.2.
5. Build a client that renders two grids and posts one cell per turn. It needs
   no game logic beyond deployment validation, which it shares with the server.

A different host is fine. The Durable Object can be any per-campaign
single-writer store and D1 any SQL database; nothing above depends on
Cloudflare beyond the deployment chapter.
