import type {
  Cell,
  Difficulty,
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
 * has ended.
 */

export interface DefenceView {
  readonly fleet: readonly Placement[];
  /** Shots the invader has fired at the player. */
  readonly shots: readonly Shot[];
  readonly sunk: readonly ShipClassId[];
}

export interface OffenceView {
  /** The player's own shots. A hull's identity appears only when it sinks. */
  readonly shots: readonly Shot[];
  readonly sunk: readonly ShipClassId[];
}

export interface LogEntry {
  readonly seq: number;
  readonly side: Side;
  readonly cell: Cell;
  readonly outcome: Shot['outcome'];
  readonly ship?: ShipClassId;
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

export interface ErrorResponse {
  readonly error: string;
}
