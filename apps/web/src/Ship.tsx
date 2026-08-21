import { useId } from 'react';
import { type HullId, type Orientation, type Side, hullSections } from '@bs/rules';

/**
 * The spacecraft drawn on a grid, in the manner of a 1970s paperback cover:
 * Earth flies banded liners with a blunt engine deck, the invaders fly dark
 * delta wedges.
 *
 * Geometry is built in cell units and centred on the origin, so the same
 * artwork serves both axes: a vertical hull is the horizontal one rotated a
 * quarter turn about its centre. One livery band falls on each section joint,
 * so the silhouette still tells you how long a hull is.
 */
export interface ShipProps {
  readonly hull: HullId;
  readonly orientation: Orientation;
  /** Centre of the hull, in board coordinates. */
  readonly cx: number;
  readonly cy: number;
  /** Board cell size, in the same coordinates. */
  readonly cell: number;
  readonly side: Side;
  readonly sunk?: boolean;
}

export function Ship({ hull, orientation, cx, cy, cell, side, sunk }: ShipProps) {
  const clip = useId();
  const sections = hullSections(hull);
  const classes = ['ship', `ship--${side}`, sunk ? 'ship--sunk' : ''].filter(Boolean).join(' ');
  const rotation = orientation === 'vertical' ? 90 : 0;
  const shape =
    side === 'alien' ? (
      sections === 1 ? (
        <AlienPod cell={cell} />
      ) : (
        <Wedge cell={cell} sections={sections} clip={clip} />
      )
    ) : sections === 1 ? (
      <EarthPod cell={cell} />
    ) : (
      <Liner cell={cell} sections={sections} clip={clip} />
    );

  return (
    <g className={classes} transform={`translate(${cx} ${cy}) rotate(${rotation})`}>
      {shape}
    </g>
  );
}

interface HullProps {
  readonly cell: number;
  readonly sections: number;
  readonly clip: string;
}

/** Joint positions along the hull, one per section boundary. */
function joints(cell: number, sections: number): number[] {
  const tail = (-sections * cell) / 2;
  return Array.from({ length: sections - 1 }, (_, index) => tail + (index + 1) * cell);
}

/** Earth: a banded liner with a blunt engine deck aft and a tapered nose. */
function Liner({ cell, sections, clip }: HullProps) {
  const length = sections * cell - 8;
  const half = cell * 0.34;
  const nose = length / 2;
  const tail = -length / 2;
  const snout = Math.min(cell * 0.9, length * 0.3);
  const body = `M${tail} ${-half} L${nose - snout} ${-half} Q${nose} ${-half * 0.85} ${nose} 0 Q${nose} ${half * 0.85} ${nose - snout} ${half} L${tail} ${half} Z`;

  return (
    <>
      {sections >= 3 ? (
        <path className="ship__fin" d={`M${tail + 12} ${-half} L${tail + 26} ${-half * 2.1} L${tail + 42} ${-half} Z`} />
      ) : null}
      <clipPath id={clip}>
        <path d={body} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect className="ship__skin" x={tail} y={-half} width={length} height={half * 2} />
        <rect className="ship__belly" x={tail} y={0} width={length} height={half} />
        {joints(cell, sections).map((x) => (
          <g key={x}>
            <rect className="ship__band" x={x - 5} y={-half} width={4} height={half * 2} />
            <rect className="ship__band2" x={x + 1} y={-half} width={2} height={half * 2} />
          </g>
        ))}
        <path className="ship__chevron" d={`M${nose - snout} ${-half} L${nose - snout * 0.5} 0 L${nose - snout} ${half} Z`} />
      </g>
      <path className="ship__outline" d={body} />
      <rect className="ship__deck" x={tail - 5} y={-half - 3} width={11} height={half * 2 + 6} rx={2} />
      <circle className="ship__engine" cx={tail} cy={-half * 0.45} r={half * 0.24} />
      <circle className="ship__engine" cx={tail} cy={half * 0.45} r={half * 0.24} />
    </>
  );
}

/** Earth: the one-section scout, a lone saucer. */
function EarthPod({ cell }: { readonly cell: number }) {
  const rx = cell * 0.36;
  const ry = cell * 0.17;
  return (
    <>
      <ellipse className="ship__belly-disc" rx={rx} ry={ry} cy={ry * 0.5} />
      <ellipse className="ship__skin-disc" rx={rx * 0.76} ry={ry * 0.8} />
      <path className="ship__chevron" d={`M${-rx * 0.4} ${-ry * 0.4} a ${rx * 0.4} ${ry * 1.1} 0 0 1 ${rx * 0.8} 0 Z`} />
      <rect className="ship__band" x={-rx * 0.55} y={ry} width={rx * 1.1} height={2.5} />
    </>
  );
}

/** Invader: a flat delta wedge with slanted panel breaks. */
function Wedge({ cell, sections, clip }: HullProps) {
  const length = sections * cell - 8;
  const half = cell * 0.33;
  const nose = length / 2;
  const tail = -length / 2;
  const shoulder = tail + Math.min(cell * 0.7, length * 0.3);
  const body = `M${nose} 0 L${shoulder} ${-half} L${tail} ${-half * 0.5} L${tail} ${half * 0.5} L${shoulder} ${half} Z`;

  return (
    <>
      <clipPath id={clip}>
        <path d={body} />
      </clipPath>
      <g clipPath={`url(#${clip})`}>
        <rect className="ship__skin" x={tail} y={-half} width={length} height={half * 2} />
        <rect className="ship__crown" x={tail} y={-half} width={length} height={half} />
        {joints(cell, sections).map((x) => (
          <path key={x} className="ship__panel" d={`M${x + 5} ${-half} L${x - 6} ${half} L${x - 1} ${half} L${x + 10} ${-half} Z`} />
        ))}
        <path className="ship__chevron" d={`M${nose - cell * 0.7} 0 L${nose} ${-2} L${nose} 2 Z`} />
      </g>
      <path className="ship__outline" d={body} />
      <circle className="ship__engine" cx={tail + 5} cy={-half * 0.2} r={half * 0.2} />
      <circle className="ship__engine" cx={tail + 5} cy={half * 0.25} r={half * 0.2} />
    </>
  );
}

/** Invader: the one-section lurker, a dart running dark. */
function AlienPod({ cell }: { readonly cell: number }) {
  const r = cell * 0.3;
  return (
    <>
      <path className="ship__outline ship__skin-disc" d={`M0 ${-r} L${r * 0.85} ${r * 0.35} L0 ${r} L${-r * 0.85} ${r * 0.35} Z`} />
      <circle className="ship__engine" r={r * 0.28} cy={r * 0.1} />
    </>
  );
}
