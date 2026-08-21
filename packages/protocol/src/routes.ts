/**
 * The HTTP surface, declared once.
 *
 * This table is the source of truth for three things that would otherwise
 * drift apart: the Worker's routes, the generated OpenAPI document, and the
 * technical specification. `apps/api` has a test that diffs the routes Hono
 * actually registered against this list, so adding an endpoint without
 * describing it fails the build.
 */
export interface RouteSpec {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly summary: string;
  /** Whether the `x-player-token` header is required. */
  readonly auth: boolean;
  readonly requestType?: string;
  readonly responseType: string;
}

export const API_ROUTES: readonly RouteSpec[] = [
  {
    method: 'POST',
    path: '/api/matches',
    summary: 'Start a campaign. Deploys the player fleet, or accepts one, and the invader fleet.',
    auth: false,
    requestType: 'CreateMatchRequest',
    responseType: 'CreateMatchResponse',
  },
  {
    method: 'GET',
    path: '/api/matches/:id',
    summary: 'Current state of a campaign, from the player\u2019s point of view.',
    auth: true,
    responseType: 'MatchView',
  },
  {
    method: 'POST',
    path: '/api/matches/:id/fire',
    summary: 'Fire at one cell of the invader grid; the invader replies in the same call.',
    auth: true,
    requestType: 'FireRequest',
    responseType: 'MatchView',
  },
  {
    method: 'POST',
    path: '/api/matches/:id/resign',
    summary: 'Concede the campaign. The invader fleet is revealed.',
    auth: true,
    responseType: 'MatchView',
  },
  {
    method: 'GET',
    path: '/api/me/progress',
    summary: 'Career record and rank for the bearer token.',
    auth: true,
    responseType: 'ProgressResponse',
  },
  {
    method: 'GET',
    path: '/api/leaderboard',
    summary: 'The shared board of best campaigns, seeded captains included.',
    auth: false,
    responseType: 'LeaderboardResponse',
  },
  {
    method: 'GET',
    path: '/api/fleet',
    summary: 'Fleet roster, grid size, scoring table and difficulty doctrines. Public reference data.',
    auth: false,
    responseType: 'ReferenceResponse',
  },
  {
    method: 'GET',
    path: '/api/health',
    summary: 'Liveness probe with the deployed version.',
    auth: false,
    responseType: 'HealthResponse',
  },
];
