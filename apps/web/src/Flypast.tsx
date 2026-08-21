import { useEffect } from 'react';
import { Ship } from './Ship.js';
import * as sound from './sound.js';

/**
 * The curtain call: a single hull crosses the screen and the verdict is
 * revealed in its wake, as though painted on by the passing ship. The text is
 * wiped in by an animation timed to the flypast, so the words appear only
 * where the craft has already been.
 */
export function Flypast({ won, onDone }: { won: boolean; onDone: () => void }) {
  useEffect(() => {
    if (won) sound.playCheer();
    else sound.playAlienLaugh();
    const timer = window.setTimeout(onDone, 6200);
    return () => window.clearTimeout(timer);
  }, [won, onDone]);

  return (
    <div
      className={won ? 'flypast flypast--win' : 'flypast flypast--loss'}
      role="alertdialog"
      aria-label={won ? 'Earth is saved' : 'Earth is defeated'}
      onClick={onDone}
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
