import type { SideStats } from '@bs/rules';
import type { LogEntry, MatchView } from '@bs/protocol';

/**
 * How long the invader appears to think before its reply lands. The Worker
 * resolves both shots in one call — it has to, or a client could stop after
 * its own — so the wait is staged here: the player's shot is shown alone,
 * then the reply, at something like the pace of a person across the table.
 */
export const ALIEN_PAUSE_MS = 1700;

/**
 * The same view with the invader's reply held back, or null when there was no
 * reply to hold (the player's shot ended the campaign, or missed the turn).
 *
 * Nothing is invented here: every field is the view the Worker sent, minus the
 * trailing alien entries and the marks they made.
 */
export function beforeReply(view: MatchView): MatchView | null {
  const replies: LogEntry[] = [];
  for (let i = view.log.length - 1; i >= 0 && view.log[i].side === 'alien'; i -= 1) {
    replies.unshift(view.log[i]);
  }
  if (replies.length === 0) return null;

  const cells = new Set(replies.map((entry) => entry.cell));
  const hulls = new Set(replies.flatMap((entry) => (entry.hull ? [entry.hull] : [])));
  const landed = replies.filter((entry) => entry.outcome !== 'miss').length;

  return {
    matchId: view.matchId,
    // The reply is still in flight, so the campaign cannot yet be over and the
    // invader's deployment stays sealed.
    status: 'playing',
    turn: 'alien',
    difficulty: view.difficulty,
    createdAt: view.createdAt,
    defence: {
      fleet: view.defence.fleet,
      shots: view.defence.shots.filter((shot) => !cells.has(shot.cell)),
      sunk: view.defence.sunk.filter((hull) => !hulls.has(hull)),
    },
    offence: view.offence,
    score: view.score,
    stats: {
      earth: {
        ...view.stats.earth,
        sectionsRemaining: view.stats.earth.sectionsRemaining + landed,
      },
      alien: rewind(view.stats.alien, replies),
    },
    log: view.log.slice(0, view.log.length - replies.length),
  };
}

/** The firing side's tally as it stood before those shots were taken. */
function rewind(stats: SideStats, replies: readonly LogEntry[]): SideStats {
  const hits = stats.hits - replies.filter((entry) => entry.outcome !== 'miss').length;
  const shots = stats.shots - replies.length;
  return {
    ...stats,
    shots,
    hits,
    misses: stats.misses - replies.filter((entry) => entry.outcome === 'miss').length,
    accuracy: shots === 0 ? 0 : hits / shots,
    sunk: stats.sunk - replies.filter((entry) => entry.outcome === 'sunk').length,
  };
}
