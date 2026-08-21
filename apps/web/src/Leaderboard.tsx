import { useEffect, useRef } from 'react';
import type { LeaderboardResponse } from '@bs/protocol';
import { DOCTRINE_LABEL } from './doctrine.js';

/**
 * The shared board. Every finished campaign posts to it, so the seeded
 * captains are simply the ones already there. The player's own row is marked
 * and scrolled to, which is the only reason the list can be this long.
 */
export function Leaderboard({ board }: { readonly board: LeaderboardResponse }) {
  const mine = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    // Left to the browser's own smooth scroll so the eye can follow the climb.
    mine.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [board]);

  return (
    <div className="leaderboard">
      <table>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Captain</th>
            <th scope="col">Starfleet</th>
            <th scope="col">Doctrine</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {board.entries.map((entry) => (
            <tr
              key={`${entry.rank}-${entry.captain}-${entry.achievedAt}`}
              className={entry.you ? 'leaderboard__you' : undefined}
              ref={entry.you && entry.rank === board.yourRank ? mine : undefined}
            >
              <td>{entry.rank}</td>
              <td>{entry.captain}</td>
              <td>{entry.starfleet}</td>
              <td>{DOCTRINE_LABEL[entry.difficulty].name}</td>
              <td>{entry.score.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
