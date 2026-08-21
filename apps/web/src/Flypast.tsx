import { useEffect, useState } from 'react';
import type { LeaderboardResponse } from '@bs/protocol';
import { Leaderboard } from './Leaderboard.js';
import { Ship } from './Ship.js';
import * as sound from './sound.js';

/** How long the hull takes to cross before the board, if any, is cut to. */
const FLIGHT_MS = 4600;
const CURTAIN_MS = 6200;

interface FlypastProps {
  readonly won: boolean;
  /** Set when this campaign beat the player's own best. */
  readonly highScore: boolean;
  readonly board: LeaderboardResponse | null;
  readonly onDone: () => void;
}

/**
 * The curtain call: a single hull crosses the screen and the verdict is
 * revealed in its wake, as though painted on by the passing ship. On a win, or
 * on a personal best, the flypast then cuts to the shared board and scrolls to
 * where the player has landed.
 */
export function Flypast({ won, highScore, board, onDone }: FlypastProps) {
  const cuts = won || highScore;
  const [showBoard, setShowBoard] = useState(false);

  useEffect(() => {
    if (won) sound.playCheer();
    else sound.playAlienLaugh();
  }, [won]);

  useEffect(() => {
    if (!cuts) {
      const timer = window.setTimeout(onDone, CURTAIN_MS);
      return () => window.clearTimeout(timer);
    }
    const timer = window.setTimeout(() => setShowBoard(true), FLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [cuts, onDone]);

  const words = highScore ? 'New high score' : won ? 'Earth is saved' : 'Earth is defeated';

  if (showBoard) {
    return (
      <div className="flypast flypast--board" role="alertdialog" aria-label={words}>
        <p className={highScore ? 'flypast__words flypast__words--flash' : 'flypast__words'}>{words}</p>
        {board ? <Leaderboard board={board} /> : <p>Signalling fleet records…</p>}
        <button type="button" className="primary" onClick={onDone}>
          Stand down
        </button>
      </div>
    );
  }

  return (
    <div
      className={won ? 'flypast flypast--win' : 'flypast flypast--loss'}
      role="alertdialog"
      aria-label={words}
      onClick={cuts ? undefined : onDone}
    >
      <p className="flypast__words">{won ? 'Earth is saved' : 'Earth is defeated'}</p>
      <svg className="flypast__craft" viewBox="-160 -60 320 120" aria-hidden="true">
        <Ship
          hull={won ? 'battleship-1' : 'cruiser-1'}
          orientation="horizontal"
          cx={0}
          cy={0}
          cell={60}
          side={won ? 'earth' : 'alien'}
        />
      </svg>
    </div>
  );
}
