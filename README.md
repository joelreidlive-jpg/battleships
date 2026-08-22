# Orbital Battleships Command

Battleship, played against an alien invasion, in the visual language of a 1970s
science-fiction paperback. Classic rules — 10x10 grid, the five standard hulls,
alternating single shots — with the fleets reskinned as spacecraft and a
scoring system on top.

The server is authoritative: the invader's deployment lives inside a Durable
Object and is never sent to the browser until the battle is over.

## Documentation

Both documents are generated from the code that implements them, and CI fails
if they drift.

| Document | For | Path |
| --- | --- | --- |
| Game guide | Anyone — rules, fleet, scoring, difficulty, career | [`docs/product/GAME.md`](docs/product/GAME.md) |
| Technical specification | Rebuilding the game from scratch without the source | [`docs/technical/SPEC.md`](docs/technical/SPEC.md) |
| OpenAPI contract | Tooling | [`docs/technical/openapi.yaml`](docs/technical/openapi.yaml) |
| Bugs found and fixed | A one-page list of every defect and its fix | [`docs/reports/BUGS.md`](docs/reports/BUGS.md) |
| Codebase audit | The reasoning behind each defect, the tests that hold it, residual risks | [`docs/reports/AUDIT.md`](docs/reports/AUDIT.md) |

Both are also readable inside the game, under **Field manual**.

## Layout

| Package | Contents |
| --- | --- |
| `packages/rules` | Grid, fleet, placement legality, shot resolution, scoring. Pure, dependency-free, shared with the browser. |
| `packages/ai` | Deployment, inference from shot history, probability density, the three doctrines. |
| `packages/protocol` | Wire types and the API route table. |
| `apps/api` | Hono Worker, `MatchDO` Durable Object, D1 career records. |
| `apps/web` | React + Vite client, SVG grids. |

`apps/web` may not import `packages/ai` — the AI can see both grids, so
shipping it to the browser would ship the means to read them. This is enforced
by lint, not convention.

## Working on it

Requires Node 20+ and pnpm 9.

```bash
pnpm install
pnpm dev:web        # client on :5173, proxying /api to the Worker
pnpm dev:api        # Worker on :8787, with a local D1
```

| Command | Does |
| --- | --- |
| `pnpm lint` | ESLint, including the import bans above |
| `pnpm typecheck` | `tsc` across every project |
| `pnpm test` | Vitest |
| `pnpm e2e` | Playwright: plays the assembled game against a locally simulated Worker |
| `pnpm build` | Type-check and build the client into `apps/web/dist` |
| `pnpm docs` | Regenerate the published documents |
| `pnpm docs:check` | Fail if they are out of date (CI runs this) |
| `pnpm bench` | Measure how many shots each doctrine needs to clear a fleet |
| `pnpm audio` | Re-render the battle callouts (needs `espeak-ng` and `ffmpeg`) |

Before the first `pnpm dev:api`, create the local database:

```bash
cd apps/api
pnpm wrangler d1 execute battleships --local --file=migrations/0001_players.sql
```

## Deploying

The Worker serves both the API and the client bundle, so one deploy ships both.

```bash
pnpm wrangler d1 create battleships          # once; put the id in wrangler.jsonc
pnpm wrangler d1 execute battleships --remote --file=apps/api/migrations/0001_players.sql
pnpm build
cd apps/api && pnpm wrangler deploy
```

In CI this is tag-driven: pushing a `v*` tag runs the release workflow, which
verifies, builds and deploys, injecting the tag as `APP_VERSION` — reported by
`GET /api/health`. It needs `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
as secrets on the `production` environment.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch, commit and review rules,
and [SECURITY.md](SECURITY.md) for the threat model and how to report a
vulnerability.
