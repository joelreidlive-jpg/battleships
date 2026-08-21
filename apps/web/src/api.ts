import type { Difficulty, Placement } from '@bs/rules';
import type {
  CreateMatchResponse,
  LeaderboardResponse,
  MatchView,
  ProgressResponse,
  ReferenceResponse,
} from '@bs/protocol';

/**
 * The bearer token is the player's whole identity. It lives in localStorage
 * because there are no accounts; clearing the browser starts a new career.
 */
const TOKEN_KEY = 'bs.playerToken';

export function playerToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function headers(): HeadersInit {
  const token = playerToken();
  return { 'content-type': 'application/json', ...(token ? { 'x-player-token': token } : {}) };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, headers: headers() });
  const body = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) throw new Error((body as { error?: string }).error ?? 'the transmission failed');
  return body as T;
}

export interface Names {
  readonly captain: string;
  readonly starfleet: string;
}

export async function createMatch(
  difficulty: Difficulty,
  names: Names,
  fleet?: readonly Placement[],
): Promise<MatchView> {
  const { playerToken: issued, match } = await request<CreateMatchResponse>('/api/matches', {
    method: 'POST',
    body: JSON.stringify({ difficulty, ...names, ...(fleet ? { fleet } : {}) }),
  });
  localStorage.setItem(TOKEN_KEY, issued);
  return match;
}

export function fire(matchId: string, cell: number): Promise<MatchView> {
  return request<MatchView>(`/api/matches/${matchId}/fire`, { method: 'POST', body: JSON.stringify({ cell }) });
}

export function resign(matchId: string): Promise<MatchView> {
  return request<MatchView>(`/api/matches/${matchId}/resign`, { method: 'POST' });
}

export function progress(): Promise<ProgressResponse> {
  return request<ProgressResponse>('/api/me/progress');
}

export function leaderboard(): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>('/api/leaderboard');
}

export function reference(): Promise<ReferenceResponse> {
  return request<ReferenceResponse>('/api/fleet');
}
