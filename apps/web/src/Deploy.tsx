import { useMemo, useState } from 'react';
import {
  type Cell,
  HULLS,
  type HullId,
  type Orientation,
  type Placement,
  fitsOnGrid,
  hullName,
  hullSections,
  placementCells,
  shipClass,
  validateFleet,
} from '@bs/rules';
import { Board } from './Board.js';

export interface DeployProps {
  readonly onLaunch: (fleet: readonly Placement[] | undefined) => void;
  readonly busy: boolean;
}

/**
 * Fleet deployment. The player picks a hull, an axis and a cell; the same
 * `validateFleet` the Worker will run decides whether the deployment is legal,
 * so the client can never offer something the server would reject.
 */
export function Deploy({ onLaunch, busy }: DeployProps) {
  const [placed, setPlaced] = useState<Placement[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Cell | null>(null);

  const next: HullId | undefined = HULLS.map((hull) => hull.id).find(
    (id) => !placed.some((placement) => placement.hull === id),
  );

  const candidate: Placement | null =
    next !== undefined && hover !== null ? { hull: next, origin: hover, orientation } : null;
  const occupied = useMemo(() => new Set(placed.flatMap(placementCells)), [placed]);
  const legal =
    candidate !== null && fitsOnGrid(candidate) && placementCells(candidate).every((cell) => !occupied.has(cell));

  const complete = validateFleet(placed) === null;

  return (
    <div className="deploy">
      <Board
        title="Home Grid — deploy your fleet"
        subtitle={next ? `Positioning the ${hullName(next, 'earth')}` : 'Fleet ready.'}
        shots={[]}
        fleet={placed}
        onFire={(cell) => {
          if (!candidate || !legal) return;
          setPlaced([...placed, { ...candidate, origin: cell }]);
        }}
        onHover={setHover}
        ghost={candidate ? { cells: fitsOnGrid(candidate) ? placementCells(candidate) : [candidate.origin], legal } : undefined}
      />

      <div className="deploy__panel">
        <h2>Deployment orders</h2>
        <ol className="roster">
          {HULLS.map((hull) => {
            const done = placed.some((placement) => placement.hull === hull.id);
            const current = hull.id === next;
            return (
              <li
                key={hull.id}
                className={['roster__item', done ? 'roster__item--done' : '', current ? 'roster__item--next' : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="roster__name">{hullName(hull.id, 'earth')}</span>
                <span className="roster__pips">{'\u25A0'.repeat(hullSections(hull.id))}</span>
                <span className="roster__blurb">{shipClass(hull.ship).blurb}</span>
              </li>
            );
          })}
        </ol>

        <div className="controls">
          <button type="button" onClick={() => setOrientation(orientation === 'horizontal' ? 'vertical' : 'horizontal')}>
            Axis: {orientation === 'horizontal' ? 'East–West' : 'North–South'}
          </button>
          <button type="button" onClick={() => setPlaced([])} disabled={placed.length === 0}>
            Recall fleet
          </button>
        </div>

        <div className="controls">
          <button type="button" className="primary" disabled={!complete || busy} onClick={() => onLaunch(placed)}>
            Launch defence
          </button>
          <button type="button" disabled={busy} onClick={() => onLaunch(undefined)}>
            Let Fleet Command deploy
          </button>
        </div>
      </div>
    </div>
  );
}
