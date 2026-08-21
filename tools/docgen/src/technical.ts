import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CELL_COUNT,
  COLUMNS,
  COLUMN_LABELS,
  FLEET,
  HULLS,
  PERFECT_SHOT_COUNT,
  RANKS,
  ROWS,
  SCORE_MULTIPLIER,
  SCORING,
  TOTAL_SECTIONS,
  candidatePlacements,
} from '@bs/rules';
import { DOCTRINE_LIST, OPEN_HIT_WEIGHT } from '@bs/ai';
import { API_ROUTES } from '@bs/protocol';
import { GENERATED_BANNER } from './banner.js';

/**
 * The reconstruction document. The test it has to pass: an engineer with this
 * file and no source code can rebuild a system that behaves identically.
 *
 * Anything that exists verbatim in the repository — the wire types, the
 * database schema — is embedded from the file itself rather than paraphrased.
 */
export function technicalSpec(root: string): string {
  const read = (relative: string) => readFileSync(join(root, relative), 'utf8').trimEnd();

  return [
    '# Orbital Battleships Command — technical specification',
    '',
    GENERATED_BANNER,
    '',
    scope(),
    architecture(),
    layout(),
    coordinates(),
    fleetModel(),
    stateMachine(),
    shotResolution(),
    scoringModel(),
    aiModel(),
    apiSurface(),
    wireTypes(read('packages/protocol/src/wire.ts')),
    persistence(read('apps/api/migrations/0001_players.sql')),
    security(),
    invariants(),
    delivery(),
    reconstruction(),
  ].join('\n');
}

function scope(): string {
  return `## 1. Scope

This document specifies the whole system: the rules engine, the opponent, the
HTTP contract, the persisted state and the deployment topology. It is written
so the game can be rebuilt from it if the source is lost. Where a rule is a
choice rather than a consequence, the reason is given, because a
reimplementation needs to know which parts are load-bearing.

`;
}

function architecture(): string {
  return `## 2. Architecture

One Cloudflare Worker serves both the JSON API and the static client, so there
is no cross-origin surface and a deploy cannot ship half a change.

\`\`\`
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
\`\`\`

Three properties drive the design:

1. **The server owns the secret.** The alien deployment exists only inside the
   Durable Object. The client is told the outcome of its own shots and nothing
   more, so there is no bundle to disassemble and no response to inspect.
2. **One Durable Object per campaign is the concurrency control.** It is the
   only writer of its state, so there is no lock, no transaction and no way for
   two shots to interleave.
3. **The invader plays through the same code path a human would.** It calls the
   same \`fire\` with the same legality checks, from a redacted view of its own
   shot history. Seating a second human later adds a transport, not a second
   game loop.

`;
}

function layout(): string {
  return `## 3. Package layout

| Package | Contents | Depends on |
| --- | --- | --- |
| \`packages/rules\` | Grid, fleet, placement legality, shot resolution, scoring, ranks, RNG helpers. Pure and dependency-free — the only package shared with the browser. | nothing |
| \`packages/ai\` | Fleet deployment, shot-history inference, probability density, the three doctrines. | \`@bs/rules\` |
| \`packages/protocol\` | Wire types and the API route table. Type-only apart from two constants. | \`@bs/rules\` |
| \`apps/api\` | Hono Worker, \`MatchDO\` Durable Object, D1 access. | all three |
| \`apps/web\` | React + Vite client, SVG grids. | \`@bs/rules\`, \`@bs/protocol\` |

\`apps/web\` importing \`@bs/ai\` is a lint error, not a convention: the AI can see
both grids, so shipping it to the browser would ship the means to read them.

`;
}

function coordinates(): string {
  return `## 4. Coordinate system

The grid is ${COLUMNS} columns by ${ROWS} rows, ${CELL_COUNT} cells. A cell is a single integer index:

\`\`\`
cell   = row * ${COLUMNS} + column          // 0 .. ${CELL_COUNT - 1}
column = cell % ${COLUMNS}
row    = floor(cell / ${COLUMNS})
label  = "${COLUMN_LABELS.join('')}"[column] + (row + 1)   // e.g. cell 61 -> "B7"
\`\`\`

An index rather than a pair because every hot path is a set-membership test,
and a number is a usable set key where an object is not. Neighbours are the up
to four orthogonally adjacent cells, clipped at the edges — a hull never wraps
from one row to the next.

`;
}

function fleetModel(): string {
  const rows = FLEET.map(
    (ship) =>
      `| \`${ship.id}\` | ${ship.count} | ${ship.sections} | ${ship.earthName} | ${ship.alienName} | ${candidatePlacements(`${ship.id}-1`).length} |`,
  ).join('\n');

  return `## 5. Fleet and deployment

| Class id | Hulls | Sections each | Earth name | Alien name | Legal positions on an empty grid |
| --- | --- | --- | --- | --- | --- |
${rows}

A class may be deployed more than once, so the unit of play is the *hull*, not
the class. Hull ids are \`\${classId}-\${ordinal}\`, one-based in deployment
order:

\`\`\`
${HULLS.map((hull) => hull.id).join(', ')}
\`\`\`

A single-section hull has one legal position per cell rather than two: the two
orientations are the same placement, and enumerating both would double its
weight in the density map.

Total ${HULLS.length} hulls, ${TOTAL_SECTIONS} sections per side. A placement is \`{ hull, origin, orientation }\` where
\`origin\` is the westmost cell when horizontal and the northmost when vertical:

\`\`\`
cells(placement) = [0 .. sections-1].map(i =>
  orientation == horizontal ? cell(column + i, row) : cell(column, row + i))
\`\`\`

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

`;
}

function stateMachine(): string {
  return `## 6. Game state and lifecycle

\`\`\`
GameState {
  earth: { fleet: Placement[], shots: Shot[] }   // shots fired AT Earth
  alien: { fleet: Placement[], shots: Shot[] }   // shots fired AT the invader
  turn:   'earth' | 'alien'
  status: 'playing' | 'finished'
  winner?: 'earth' | 'alien'
}
Shot { cell, outcome: 'miss' | 'hit' | 'sunk', hull? }
\`\`\`

Shots are recorded against the grid that was *fired at*, which is what makes a
hull's damage a function of that grid alone: \`damage(hull) = count(shots where
shot.hull == hull)\`, and a hull is destroyed when its damage reaches its
section count. Damage is tracked per hull, not per class, so sinking one of the
two cruisers says nothing about the other.

Lifecycle:

\`\`\`
create  ──► playing ──► finished
              │            ▲
              └─ resign ───┘
\`\`\`

- **create** — validate both deployments, Earth to move.
- **playing** — turns alternate strictly. A hit never grants another shot.
- **finished** — reached when either fleet has no intact hull, or the player
  resigns. Shots are rejected from then on, and the alien deployment is
  released to the client.

There is no draw: the side that fires the destroying shot wins, and the loser
gets no reply.

`;
}

function shotResolution(): string {
  return `### 6.1 Shot resolution

\`\`\`
fire(state, side, cell):
  reject if state.status == 'finished'
  reject if state.turn != side
  reject if cell outside 0..${CELL_COUNT - 1}
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
\`\`\`

### 6.2 Information redaction

\`Shot.hull\` is recorded internally on every hit, because damage accounting
needs it, and stripped on the way out unless the outcome is \`sunk\`:

\`\`\`
redact(shot) = shot.outcome == 'sunk' ? shot : { cell, outcome }
\`\`\`

Both the wire protocol and the invader's own view of its shots pass through
this function. That is what makes the opponent fair rather than merely
polite: it is given exactly the information the player is given.

`;
}

function scoringModel(): string {
  const constants = Object.entries(SCORING)
    .map(([key, value]) => `| \`${key}\` | ${value} |`)
    .join('\n');
  const multipliers = Object.entries(SCORE_MULTIPLIER)
    .map(([key, value]) => `| \`${key}\` | x${value} |`)
    .join('\n');

  return `## 7. Scoring

| Constant | Value |
| --- | --- |
${constants}

| Doctrine | Multiplier |
| --- | --- |
${multipliers}

\`\`\`
hits        = playerHits * ${SCORING.hit}
sinks       = Σ sections(hull) * ${SCORING.sinkPerSection}   over destroyed alien hulls
wastedShots = max(0, playerShots - ${PERFECT_SHOT_COUNT}) * ${SCORING.wastedShot}
accuracy    = won ? round(${SCORING.accuracyBonus} * playerHits / playerShots) : 0
survival    = won ? intactSectionsOfPlayerFleet * ${SCORING.survivingSection} : 0
victory     = won ? ${SCORING.victory} : 0

subtotal    = max(0, hits + sinks + accuracy + survival + victory - wastedShots)
total       = round(subtotal * multiplier(difficulty))
\`\`\`

The function is total: it is defined mid-game (the victory lines are zero) and
after a loss, so the client can show a live score without a second code path.

Career ranks are awarded on lifetime total: ${RANKS.map((rank) => `${rank.title} (${rank.minCareerScore})`).join(', ')}.

`;
}

function aiModel(): string {
  const rows = DOCTRINE_LIST.map(
    (doctrine) =>
      `| \`${doctrine.id}\` | ${doctrine.name} | x${doctrine.scoreMultiplier} | ${doctrine.expectedShots} | ${doctrine.expectedHuntShots} |`,
  ).join('\n');

  return `## 8. The opponent

| Id | Name | Score multiplier | Mean shots to clear a fleet (300 games) | Mean shots to the last multi-section hull |
| --- | --- | --- | --- | --- |
${rows}

The second figure is the one to test against. Nothing can be inferred about a
single-section hull, so hunting the four submarines is a uniform search that
costs all three doctrines roughly the same and compresses the first figure.

All three receive the same input — the redacted list of shots they have fired —
and return one untried cell. No doctrine sees the defender's grid.

### 8.1 Inference from shot history

\`\`\`
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
\`\`\`

A sinking announces the hull but not the cells it occupied, so the run
through the sinking cell is claimed for it. This is wrong only when two hulls
were hit adjacently and in line, and the cost is one wasted probe.

### 8.2 Doctrines

**${DOCTRINE_LIST[0].name}** — uniformly random untried cell.

**${DOCTRINE_LIST[1].name}** — hunt and target.

\`\`\`
if openHits is non-empty:
    if two openHits are adjacent in line, fire at either end of that run
    else fire at an orthogonal neighbour of an open hit
else:
    step = smallest section count among surviving hulls
    fire at a random untried cell where (column + row) % step == 0
\`\`\`

The parity sweep is exact, not a heuristic: a hull of length *n* must cover a
cell on every *n*-th diagonal, so those cells are sufficient to guarantee a
first hit, and the step shrinks as hulls sink.

**${DOCTRINE_LIST[2].name}** — exact placement density.

\`\`\`
for each surviving hull:
    for each legal placement of that hull:
        skip if it covers a miss or a resolved hit
        weight = ${OPEN_HIT_WEIGHT} ^ (number of open hits it covers)
        add weight to every untried cell it covers
fire at the maximum, ties broken at random
\`\`\`

This enumerates every consistent arrangement rather than sampling — at most a
few thousand placements per turn — so it is exact, deterministic given its tie
break, and needs no tuning. The weight makes explaining a known hit dominate
mere plausibility, which is what merges "hunt" and "target" into one rule.

### 8.3 Randomness

Every random choice takes an injected \`Rng: () => number\`. The Worker passes a
CSPRNG (\`crypto.getRandomValues\`); tests pass a seeded mulberry32, which makes
a campaign reproducible from its seed. \`Math.random\` is a lint error across the
repository.

`;
}

function apiSurface(): string {
  const rows = API_ROUTES.map(
    (route) =>
      `| \`${route.method} ${route.path}\` | ${route.auth ? 'yes' : 'no'} | ${route.requestType ? `\`${route.requestType}\`` : '—'} | \`${route.responseType}\` | ${route.summary} |`,
  ).join('\n');

  return `## 9. HTTP API

All responses are JSON. Errors are \`{ "error": string }\` with status 400
(illegal move or malformed request), 401 (no token), 403 (not your campaign),
404 (unknown campaign) or 409 (campaign already exists).

| Endpoint | Token | Request | Response | Purpose |
| --- | --- | --- | --- | --- |
${rows}

Authentication is the \`x-player-token\` header: a 32-byte random hex string
issued by \`POST /api/matches\` and stored in \`localStorage\`. There are no
accounts. The Durable Object stores only the SHA-256 digest of the token and
compares digests, so the object's storage cannot be used to impersonate the
player.

\`POST /api/matches/:id/fire\` resolves **both** shots — the player's and the
invader's reply — and returns the resulting view. One round trip, because two
would let a client take its own shot and then abandon the turn.

The route table above is \`API_ROUTES\` in \`@bs/protocol\`, and a unit test
diffs it against the routes Hono actually registered, so an undocumented
endpoint fails the build.

`;
}

function wireTypes(source: string): string {
  return `## 10. Wire types

Embedded verbatim from \`packages/protocol/src/wire.ts\`.

\`\`\`ts
${source}
\`\`\`

`;
}

function persistence(schema: string): string {
  return `## 11. Persistence

### 11.1 Durable Object storage (one per campaign)

| Key | Value |
| --- | --- |
| \`meta\` | \`{ matchId, difficulty, playerKey, playerTokenHash, createdAt, recorded? }\` |
| \`state\` | the \`GameState\` above, including both fleets |
| \`log\` | the rendered transcript, one entry per shot |

The object is loaded into memory in \`blockConcurrencyWhile\` at construction and
written back after every accepted shot. A campaign is self-contained: losing
one loses that campaign and nothing else.

### 11.2 D1 (career records, shared)

Embedded verbatim from \`apps/api/migrations/0001_players.sql\`.

\`\`\`sql
${schema}
\`\`\`

Rows are keyed by the SHA-256 digest of the bearer token, so the database never
holds a credential. \`progress\` is a whole JSON object because it is only ever
read and written as one, and the read-modify-write at the end of a campaign is
safe: a player finishes at most one campaign at a time, and a lost update costs
one game's statistics rather than corrupting the total.

`;
}

function security(): string {
  return `## 12. Security model

| Threat | Control |
| --- | --- |
| Reading the alien fleet | It exists only in the Durable Object. Responses carry only the outcomes of the player's own shots; the deployment is released after the battle ends. A lint rule keeps \`@bs/ai\` out of the browser bundle. |
| Forging a shot | The Worker re-validates turn, bounds and repetition against its own state. Nothing the client sends is trusted, including its own deployment. |
| Playing another player's campaign | Every campaign request carries the bearer token; the object compares its digest and answers 403 otherwise. |
| Token theft from storage | Only digests are stored, in both the Durable Object and D1. |
| Predictable placement or targeting | All randomness comes from \`crypto.getRandomValues\` in production. |
| XSS | The client renders no HTML from any input, and the Worker sets \`Content-Security-Policy: default-src 'self'\`, \`X-Content-Type-Options: nosniff\`, \`X-Frame-Options: DENY\` and \`Referrer-Policy: no-referrer\` on every response. |
| Supply chain | Dependencies are pinned by lockfile, reviewed by Dependabot and scanned by CodeQL on every pull request. |

There are no secrets in the repository and none in the client bundle. The
Cloudflare API token used to deploy exists only as a GitHub Actions secret.

`;
}

function invariants(): string {
  return `## 13. Invariants

A reimplementation is correct when all of these hold. Each is covered by a test
in the repository.

1. A cell is never fired at twice on the same grid.
2. Turn order alternates strictly; a hit grants no extra shot.
3. A shot is refused out of turn, off the grid, or after the game ends.
4. \`sunk\` is reported on, and only on, the shot that takes a hull's last
   section.
5. The identity of a struck hull is never disclosed before it sinks.
6. The game ends the instant a fleet loses its last hull, and the losing side
   does not reply.
7. Any deployment that is incomplete, overlapping or off the grid is rejected,
   from client or server.
8. A flawless campaign scores exactly \`maximumScore(difficulty)\`; the total is
   never negative.
9. The doctrines are strictly ordered by mean shots to destroy every
   multi-section hull:
   ${DOCTRINE_LIST.map((doctrine) => doctrine.name).join(' > ')}.
10. Every route Hono registers appears in \`API_ROUTES\`, and vice versa.

`;
}

function delivery(): string {
  return `## 14. Build, test and delivery

| Concern | Choice |
| --- | --- |
| Package manager | pnpm workspaces, Node 20+ |
| Language | TypeScript, \`strict\`, project references |
| Tests | Vitest, with coverage thresholds enforced in CI |
| Lint | ESLint, including the import bans described above |
| CI | GitHub Actions on every pull request: lint, typecheck, unit tests, documentation drift check, client build, CodeQL |
| Versioning | Semantic Versioning; a \`v*\` tag builds and deploys, and the tag is injected as \`APP_VERSION\` and reported by \`GET /api/health\` |
| Deploy | \`wrangler deploy\` from the release workflow; the client build is uploaded as Worker assets in the same deploy |
| Configuration | \`apps/api/wrangler.jsonc\` — Durable Object binding \`MATCH\`, D1 binding \`DB\`, asset binding \`ASSETS\` |

`;
}

function reconstruction(): string {
  return `## 15. Rebuilding from this document

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
`;
}
