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
import { Ship } from './Ship.js';

export interface DeployProps {
  readonly onLaunch: (fleet: readonly Placement[] | undefined) => void;
  readonly busy: boolean;
  readonly starfleet: string;
}

/**
 * Fleet deployment. The player picks a hull, an axis and a cell; the same
 * `validateFleet` the Worker will run decides whether the deployment is legal,
 * so the client can never offer something the server would reject.
 */
export function Deploy({ onLaunch, busy, starfleet }: DeployProps) {
  const [placed, setPlaced] = useState<Placement[]>([]);
  const [orientation, setOrientation] = useState<Orientation>('horizontal');
  const [hover, setHover] = useState<Cell | null>(null);

  const next: HullId | undefined = HULLS.map((hull) => hull.id).find(
    (id) => !placed.some((placement) => placement.hull === id),
  );

  const candidate: Placement | null =
    next !== undefined && hover !== null ? { hull: next, origin: hover, orientation } : null;
  const occupied = useMemo(() => new Set(placed.flatMap(placementCells)), [placed]);

  /**
   * Whether the next hull may sit on `origin`. Asked of the cell that was
   * actually chosen rather than of the hovered one, because a touch screen
   * reports no hover at all and the deployment would otherwise be unreachable.
   */
  const legalAt = (origin: Cell): boolean => {
    if (next === undefined) return false;
    const placement: Placement = { hull: next, origin, orientation };
    return fitsOnGrid(placement) && placementCells(placement).every((cell) => !occupied.has(cell));
  };

  const legal = candidate !== null && legalAt(candidate.origin);

  const complete = validateFleet(placed) === null;

  return (
    <div className="deploy">
      <Board
        title={`Home Grid — ${starfleet} Starfleet`}
        subtitle={next ? `Positioning the ${hullName(next, 'earth')}` : 'Fleet ready. Launch when you are.'}
        shots={[]}
        fleet={placed}
        onFire={(cell) => {
          if (next === undefined || !legalAt(cell)) return;
          setPlaced([...placed, { hull: next, origin: cell, orientation }]);
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
                <RosterShip hull={hull.id} />
                <span className="roster__tag">{shipClass(hull.ship).tagline}</span>
                <span className="roster__pips">{'\u25A0'.repeat(hullSections(hull.id))}</span>
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

/** The hull itself, drawn at roster scale, in place of its name. */
function RosterShip({ hull }: { readonly hull: HullId }) {
  const cell = 34;
  const width = hullSections(hull) * cell + 12;
  return (
    <svg
      className="roster__ship"
      viewBox={`${-width / 2} ${-cell / 2} ${width} ${cell}`}
      style={{ width: `${width}px` }}
      role="img"
      aria-label={hullName(hull, 'earth')}
    >
      <Ship hull={hull} orientation="horizontal" cx={0} cy={0} cell={cell} side="earth" />
    </svg>
  );
}
