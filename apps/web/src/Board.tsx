import { useMemo } from 'react';
import {
  type Cell,
  COLUMNS,
  COLUMN_LABELS,
  ROWS,
  type Placement,
  type Shot,
  cellAt,
  columnOf,
  formatCell,
  placementCells,
  rowOf,
} from '@bs/rules';

const CELL = 42;
const GUTTER = 26;

export interface BoardProps {
  readonly title: string;
  readonly subtitle?: string;
  /** Shots fired *at* this grid. */
  readonly shots: readonly Shot[];
  /** Hulls to draw. Only ever passed for the player's own grid, or after the battle. */
  readonly fleet?: readonly Placement[];
  readonly onFire?: (cell: Cell) => void;
  readonly disabled?: boolean;
  /** Cells the pending deployment would occupy, and whether it is legal. */
  readonly ghost?: { readonly cells: readonly Cell[]; readonly legal: boolean };
  readonly onHover?: (cell: Cell | null) => void;
}

export function Board({ title, subtitle, shots, fleet, onFire, disabled, ghost, onHover }: BoardProps) {
  const byCell = useMemo(() => new Map(shots.map((shot) => [shot.cell, shot])), [shots]);
  const ghostCells = useMemo(() => new Set(ghost?.cells ?? []), [ghost]);
  const width = GUTTER + COLUMNS * CELL + 2;
  const height = GUTTER + ROWS * CELL + 2;

  return (
    <section className="board">
      <header>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </header>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={`grid ${disabled ? 'grid--locked' : ''}`}
        role="grid"
        aria-label={title}
        onMouseLeave={() => onHover?.(null)}
      >
        {COLUMN_LABELS.map((label, column) => (
          <text key={label} className="axis" x={GUTTER + column * CELL + CELL / 2} y={GUTTER - 9}>
            {label}
          </text>
        ))}
        {Array.from({ length: ROWS }, (_, row) => (
          <text key={row} className="axis" x={GUTTER - 10} y={GUTTER + row * CELL + CELL / 2 + 5}>
            {row + 1}
          </text>
        ))}

        {Array.from({ length: ROWS * COLUMNS }, (_, index) => {
          const cell = cellAt(index % COLUMNS, Math.floor(index / COLUMNS));
          const shot = byCell.get(cell);
          const x = GUTTER + columnOf(cell) * CELL;
          const y = GUTTER + rowOf(cell) * CELL;
          const interactive = Boolean(onFire) && !disabled && !shot;
          return (
            <g
              key={cell}
              className={[
                'cell',
                shot ? `cell--${shot.outcome}` : '',
                interactive ? 'cell--live' : '',
                ghostCells.has(cell) ? (ghost?.legal ? 'cell--ghost' : 'cell--ghost-bad') : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={interactive ? () => onFire?.(cell) : undefined}
              onMouseEnter={() => onHover?.(cell)}
              role="gridcell"
              aria-label={`${formatCell(cell)}${shot ? ` ${shot.outcome}` : ''}`}
            >
              <rect x={x} y={y} width={CELL} height={CELL} rx={3} />
            </g>
          );
        })}

        {/* Hulls sit above the cells so the grid does not paint over them, and
            below the shot marks so damage stays legible. */}
        <g className="overlay">
          {fleet?.map((placement) => {
            const cells = placementCells(placement);
            const first = cells[0];
            const horizontal = placement.orientation === 'horizontal';
            return (
              <rect
                key={placement.ship}
                className="hull"
                x={GUTTER + columnOf(first) * CELL + 5}
                y={GUTTER + rowOf(first) * CELL + 5}
                width={(horizontal ? cells.length : 1) * CELL - 10}
                height={(horizontal ? 1 : cells.length) * CELL - 10}
                rx={CELL / 2 - 5}
              />
            );
          })}

          {shots.map((shot) => {
            const x = GUTTER + columnOf(shot.cell) * CELL;
            const y = GUTTER + rowOf(shot.cell) * CELL;
            if (shot.outcome === 'miss') {
              return <circle key={shot.cell} cx={x + CELL / 2} cy={y + CELL / 2} r={5} className="mark-miss" />;
            }
            return (
              <g key={shot.cell} className={shot.outcome === 'sunk' ? 'mark-sunk' : 'mark-hit'}>
                <path
                  d={`M${x + 11} ${y + 11} L${x + CELL - 11} ${y + CELL - 11} M${x + CELL - 11} ${y + 11} L${x + 11} ${y + CELL - 11}`}
                />
                {shot.outcome === 'sunk' ? <circle cx={x + CELL / 2} cy={y + CELL / 2} r={15} /> : null}
              </g>
            );
          })}
        </g>
      </svg>
    </section>
  );
}
