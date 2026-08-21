import { describe, expect, it } from 'vitest';
import type { SideStats } from '@bs/rules';
import type { LogEntry, MatchView } from '@bs/protocol';
import { beforeReply } from './pace.js';

const stats = (partial: Partial<SideStats>): SideStats => ({
  shots: 0,
  hits: 0,
  misses: 0,
  accuracy: 0,
  sunk: 0,
  sectionsRemaining: 20,
  ...partial,
});

const entry = (partial: Partial<LogEntry> & Pick<LogEntry, 'seq' | 'side'>): LogEntry => ({
  cell: 0,
  outcome: 'miss',
  text: '',
  ...partial,
});

function view(partial: Partial<MatchView>): MatchView {
  return {
    matchId: 'm',
    status: 'playing',
    turn: 'earth',
    difficulty: 'raider',
    createdAt: 0,
    defence: { fleet: [], shots: [], sunk: [] },
    offence: { shots: [], sunk: [] },
    score: { total: 0 } as MatchView['score'],
    stats: { earth: stats({}), alien: stats({}) },
    log: [],
    ...partial,
  };
}

describe('holding the invader back', () => {
  it('is nothing to stage when the player fired last', () => {
    expect(beforeReply(view({ log: [entry({ seq: 1, side: 'earth' })] }))).toBeNull();
  });

  it('removes the reply, its mark and the hull it took', () => {
    const staged = beforeReply(
      view({
        status: 'finished',
        turn: 'earth',
        winner: 'alien',
        defence: {
          fleet: [],
          shots: [
            { cell: 0, outcome: 'miss' },
            { cell: 11, outcome: 'sunk', hull: 'submarine-1' },
          ],
          sunk: ['destroyer-1', 'submarine-1'],
        },
        stats: {
          earth: stats({ sectionsRemaining: 17 }),
          alien: stats({ shots: 4, hits: 3, misses: 1, accuracy: 0.75, sunk: 2 }),
        },
        log: [
          entry({ seq: 1, side: 'earth' }),
          entry({ seq: 2, side: 'alien', cell: 11, outcome: 'sunk', hull: 'submarine-1' }),
        ],
      }),
    );

    expect(staged).not.toBeNull();
    expect(staged?.status).toBe('playing');
    expect(staged?.turn).toBe('alien');
    expect(staged?.winner).toBeUndefined();
    expect(staged?.defence.shots).toEqual([{ cell: 0, outcome: 'miss' }]);
    expect(staged?.defence.sunk).toEqual(['destroyer-1']);
    expect(staged?.log.map((item) => item.seq)).toEqual([1]);
    expect(staged?.stats.earth.sectionsRemaining).toBe(18);
    expect(staged?.stats.alien).toMatchObject({ shots: 3, hits: 2, misses: 1, sunk: 1 });
    expect(staged?.stats.alien.accuracy).toBeCloseTo(2 / 3);
  });
});
