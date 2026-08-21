import { DurableObject } from 'cloudflare:workers';
import {
  type Cell,
  type Difficulty,
  type GameState,
  type Placement,
  type Rng,
  type Shot,
  type Side,
  RuleError,
  fire,
  formatCell,
  isDifficulty,
  newGame,
  redactShot,
  scoreFor,
  shipName,
  shotProblem,
  statsFor,
  sunkShips,
  validateFleet,
} from '@bs/rules';
import { chooseShot, randomFleet } from '@bs/ai';
import type { CreateMatchRequest, LogEntry, MatchView } from '@bs/protocol';
import { MatchError } from './errors.js';
import { recordGame } from './players.js';

interface MatchMeta {
  readonly matchId: string;
  readonly difficulty: Difficulty;
  readonly playerKey: string;
  /** Digest of the bearer token, so the object never stores the secret. */
  readonly playerTokenHash: string;
  readonly createdAt: number;
  /** Set once the result has been written to D1, so it is written once. */
  recorded?: boolean;
}

/** Uniform in [0, 1) from the platform CSPRNG. Play is never client-seeded. */
const cryptoRng: Rng = () => {
  const words = new Uint32Array(1);
  crypto.getRandomValues(words);
  return words[0] / 4294967296;
};

async function hash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * One Durable Object per campaign. It is the only writer of the game state,
 * which makes it the concurrency control: there is no lock and no optimistic
 * retry, so two shots cannot interleave.
 *
 * It is also the reason the game is honest. The invader's deployment exists
 * only in here; the browser is told the outcome of its shots and nothing else,
 * so there is no bundle to read it out of and no response to inspect.
 */
export class MatchDO extends DurableObject<Env> {
  private meta: MatchMeta | null = null;
  private state: GameState | null = null;
  private log: LogEntry[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get<MatchMeta>('meta')) ?? null;
      this.state = (await ctx.storage.get<GameState>('state')) ?? null;
      this.log = (await ctx.storage.get<LogEntry[]>('log')) ?? [];
    });
  }

  async create(matchId: string, request: CreateMatchRequest, playerToken: string, playerKey: string): Promise<MatchView> {
    if (this.meta) throw new MatchError('campaign already exists', 409);

    const difficulty: Difficulty = isDifficulty(request.difficulty) ? request.difficulty : 'raider';
    const earthFleet = request.fleet ? [...request.fleet] : randomFleet(cryptoRng);
    if (request.fleet) {
      const problem = validateFleet(earthFleet);
      if (problem) throw new MatchError(problem, 400);
    }

    this.state = newGame(earthFleet, randomFleet(cryptoRng));
    this.meta = {
      matchId,
      difficulty,
      playerKey,
      playerTokenHash: await hash(playerToken),
      createdAt: Date.now(),
    };
    this.log = [];
    await this.persist();
    return this.view();
  }

  async get(token: string): Promise<MatchView> {
    await this.authorise(token);
    return this.view();
  }

  /**
   * The player's shot and the invader's reply are one call. Two round trips
   * would let a client stop after its own shot and re-read the state, and the
   * turn only ever passes back to the player anyway.
   */
  async fire(token: string, cell: Cell): Promise<MatchView> {
    const state = await this.authorise(token);
    const problem = shotProblem(state, 'earth', cell);
    if (problem) throw new MatchError(problem, 400);

    let next = this.applyShot(state, 'earth', cell);
    if (next.status === 'playing') {
      const reply = chooseShot(next.earth.shots.map(redactShot), this.meta!.difficulty, cryptoRng);
      next = this.applyShot(next, 'alien', reply);
    }
    this.state = next;
    await this.persist();
    if (next.status === 'finished') await this.record();
    return this.view();
  }

  async resign(token: string): Promise<MatchView> {
    const state = await this.authorise(token);
    if (state.status === 'finished') return this.view();
    this.state = { ...state, status: 'finished', winner: 'alien' };
    this.log = [
      ...this.log,
      {
        seq: this.log.length + 1,
        side: 'earth',
        cell: -1,
        outcome: 'miss',
        text: 'Earth Command has abandoned the defence.',
      },
    ];
    await this.persist();
    await this.record();
    return this.view();
  }

  private applyShot(state: GameState, side: Side, cell: Cell): GameState {
    let result;
    try {
      result = fire(state, side, cell);
    } catch (error) {
      throw error instanceof RuleError ? new MatchError(error.message, 400) : error;
    }
    this.log = [...this.log, this.describe(this.log.length + 1, side, result.shot)];
    return result.state;
  }

  private describe(seq: number, side: Side, shot: Shot): LogEntry {
    const target = formatCell(shot.cell);
    const defender: Side = side === 'earth' ? 'alien' : 'earth';
    const who = side === 'earth' ? 'Earth' : 'The invader';
    const text =
      shot.outcome === 'miss'
        ? `${who} fires on ${target} — nothing but vacuum.`
        : shot.outcome === 'hit'
          ? `${who} fires on ${target} — a hull is struck.`
          : `${who} fires on ${target} — the ${shipName(shot.ship!, defender)} is destroyed.`;
    // A hit names no hull: the shooter learns that only when it sinks.
    return { seq, side, cell: shot.cell, outcome: shot.outcome, ...(shot.ship && shot.outcome === 'sunk' ? { ship: shot.ship } : {}), text };
  }

  private async authorise(token: string): Promise<GameState> {
    if (!this.meta || !this.state) throw new MatchError('campaign not found', 404);
    if ((await hash(token)) !== this.meta.playerTokenHash) throw new MatchError('this is not your campaign', 403);
    return this.state;
  }

  private async record(): Promise<void> {
    const meta = this.meta!;
    if (meta.recorded) return;
    const state = this.state!;
    const stats = statsFor(state, 'earth');
    await recordGame(this.env.DB, meta.playerKey, {
      matchId: meta.matchId,
      difficulty: meta.difficulty,
      won: state.winner === 'earth',
      score: scoreFor(state, meta.difficulty).total,
      shots: stats.shots,
      hits: stats.hits,
    });
    this.meta = { ...meta, recorded: true };
    await this.ctx.storage.put('meta', this.meta);
  }

  private async persist(): Promise<void> {
    await this.ctx.storage.put({ meta: this.meta, state: this.state, log: this.log });
  }

  /**
   * The player's view. The invader's hulls appear only via the outcomes of the
   * player's own shots, and in full only once the battle has ended.
   */
  private view(): MatchView {
    const meta = this.meta!;
    const state = this.state!;
    const finished = state.status === 'finished';
    return {
      matchId: meta.matchId,
      status: state.status,
      turn: state.turn,
      difficulty: meta.difficulty,
      createdAt: meta.createdAt,
      defence: {
        fleet: state.earth.fleet,
        shots: state.earth.shots.map(redactShot),
        sunk: sunkShips(state.earth),
      },
      offence: {
        shots: state.alien.shots.map(redactShot),
        sunk: sunkShips(state.alien),
      },
      ...(finished ? { alienFleet: state.alien.fleet as Placement[] } : {}),
      score: scoreFor(state, meta.difficulty),
      stats: { earth: statsFor(state, 'earth'), alien: statsFor(state, 'alien') },
      log: this.log,
      ...(state.winner ? { winner: state.winner } : {}),
    };
  }
}
