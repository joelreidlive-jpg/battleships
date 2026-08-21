import { Hono } from 'hono';
import {
  COLUMNS,
  COLUMN_LABELS,
  FLEET,
  ROWS,
  SCORING,
  isCell,
  rankFor,
} from '@bs/rules';
import { DOCTRINE_LIST } from '@bs/ai';
import type {
  CreateMatchRequest,
  FireRequest,
  HealthResponse,
  LeaderboardResponse,
  ProgressResponse,
  ReferenceResponse,
} from '@bs/protocol';
import { MatchError } from './errors.js';
import type { MatchDO } from './match-do.js';
import { loadProgress, newPlayerToken, playerKey, recentGames } from './players.js';
import { board } from './leaderboard.js';

// The Durable Object class is imported for its *type* only, so this module
// stays loadable outside the Workers runtime and the route table can be
// asserted against in a plain unit test.
const app = new Hono<{ Bindings: Env }>();

function stub(env: Env, matchId: string): DurableObjectStub<MatchDO> {
  return env.MATCH.get(env.MATCH.idFromName(matchId));
}

function token(header: string | undefined): string {
  if (!header) throw new MatchError('missing player token', 401);
  return header;
}

/**
 * The client is a self-contained SPA with no third-party origins, so the
 * policy can be this tight. It is set here rather than in the asset handler so
 * API error pages carry it too.
 */
app.use('*', async (c, next) => {
  await next();
  c.header('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'no-referrer');
  c.header('X-Frame-Options', 'DENY');
});

app.onError((error, c) => {
  if (error instanceof MatchError) return c.json({ error: error.message }, error.status as 400);
  // A Durable Object rethrows on the calling side as a plain Error, so the
  // status has to be recovered from the message rather than lost.
  const message = error.message || 'internal error';
  const status = /not found/.test(message) ? 404 : /not your/.test(message) ? 403 : 400;
  return c.json({ error: message }, status);
});

app.post('/api/matches', async (c) => {
  const body = await c.req.json<CreateMatchRequest>().catch(() => ({}) as CreateMatchRequest);
  // A returning player sends the token they already hold, which is what makes
  // a career accumulate rather than resetting every campaign.
  const playerToken = c.req.header('x-player-token') ?? newPlayerToken();
  const matchId = crypto.randomUUID();
  const match = await stub(c.env, matchId).create(matchId, body, playerToken, await playerKey(playerToken));
  return c.json({ playerToken, match }, 201);
});

app.get('/api/matches/:id', async (c) => {
  return c.json(await stub(c.env, c.req.param('id')).get(token(c.req.header('x-player-token'))));
});

app.post('/api/matches/:id/fire', async (c) => {
  const { cell } = await c.req.json<FireRequest>().catch(() => ({}) as FireRequest);
  if (!isCell(cell)) throw new MatchError('cell must be a grid index', 400);
  return c.json(await stub(c.env, c.req.param('id')).fire(token(c.req.header('x-player-token')), cell));
});

app.post('/api/matches/:id/resign', async (c) => {
  return c.json(await stub(c.env, c.req.param('id')).resign(token(c.req.header('x-player-token'))));
});

app.get('/api/me/progress', async (c) => {
  const key = await playerKey(token(c.req.header('x-player-token')));
  const progress = await loadProgress(c.env.DB, key);
  const response: ProgressResponse = {
    progress,
    accuracy: progress.shots === 0 ? 0 : progress.hits / progress.shots,
    rank: rankFor(progress.totalScore),
    recentGames: await recentGames(c.env.DB, key),
  };
  return c.json(response);
});

app.get('/api/leaderboard', async (c) => {
  const header = c.req.header('x-player-token');
  const response: LeaderboardResponse = await board(
    c.env.DB,
    header ? await playerKey(header) : undefined,
  );
  return c.json(response);
});

app.get('/api/fleet', (c) => {
  const response: ReferenceResponse = {
    grid: { columns: COLUMNS, rows: ROWS, columnLabels: COLUMN_LABELS },
    fleet: FLEET.map(({ id, sections, count, earthName, alienName, blurb }) => ({
      id,
      sections,
      count,
      earthName,
      alienName,
      blurb,
    })),
    scoring: { ...SCORING },
    doctrines: DOCTRINE_LIST.map(({ id, name, tagline, scoreMultiplier }) => ({
      id,
      name,
      tagline,
      scoreMultiplier,
    })),
  };
  return c.json(response);
});

app.get('/api/health', (c) => {
  const response: HealthResponse = { status: 'ok', version: c.env.APP_VERSION ?? 'dev' };
  return c.json(response);
});

app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// Everything else is the single-page client, served from the same Worker so
// there is no CORS surface and one deploy ships both halves.
app.get('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
