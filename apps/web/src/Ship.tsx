import { type HullId, type Orientation, type Side, hullSections } from '@bs/rules';

/**
 * The spacecraft drawn on a grid. Geometry is built in cell units and centred
 * on the origin, so the same artwork serves both axes: a vertical hull is the
 * horizontal one rotated a quarter turn about its centre.
 *
 * Longer hulls get more of everything — engines, wings, hull plating — so the
 * silhouette alone tells a battleship from a destroyer.
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
  const sections = hullSections(hull);
  const length = sections * cell - 8;
  const beam = cell - 12;
  const nose = length / 2;
  const tail = -length / 2;

  const classes = ['ship', `ship--${side}`, sunk ? 'ship--sunk' : ''].filter(Boolean).join(' ');
  const rotation = orientation === 'vertical' ? 90 : 0;

  return (
    <g className={classes} transform={`translate(${cx} ${cy}) rotate(${rotation})`}>
      {sections === 1 ? <Saucer radius={beam} /> : <Hull nose={nose} tail={tail} beam={beam} sections={sections} />}
    </g>
  );
}

/** Single-section submarine: a lone scout saucer, deliberately tiny. */
function Saucer({ radius }: { radius: number }) {
  const rx = radius * 0.9;
  const ry = radius * 0.42;
  return (
    <>
      <ellipse className="ship__body" rx={rx} ry={ry} />
      <path className="ship__glass" d={`M${-rx * 0.45} ${-ry * 0.2} a ${rx * 0.45} ${ry * 1.1} 0 0 1 ${rx * 0.9} 0 Z`} />
      <circle className="ship__engine" cx={0} cy={ry * 0.55} r={radius * 0.12} />
    </>
  );
}

interface HullProps {
  readonly nose: number;
  readonly tail: number;
  readonly beam: number;
  readonly sections: number;
}

function Hull({ nose, tail, beam, sections }: HullProps) {
  const half = beam / 2;
  const snout = Math.min(beam, (nose - tail) * 0.28);
  const wingRoot = tail + (nose - tail) * 0.22;
  const wingTip = wingRoot + (nose - tail) * 0.3;
  const engines = Array.from({ length: sections - 1 }, (_, index) => (index - (sections - 2) / 2) * (beam * 0.5));

  return (
    <>
      {/* Swept wings, drawn under the fuselage. */}
      <path
        className="ship__wing"
        d={`M${wingRoot} 0 L${wingTip} ${-half * 2.1} L${wingTip + snout} ${-half * 2.1} L${wingTip + snout * 0.6} 0 Z`}
      />
      <path
        className="ship__wing"
        d={`M${wingRoot} 0 L${wingTip} ${half * 2.1} L${wingTip + snout} ${half * 2.1} L${wingTip + snout * 0.6} 0 Z`}
      />
      {/* Fuselage: blunt engine deck aft, tapered nose forward. */}
      <path
        className="ship__body"
        d={`M${tail + 2} ${-half} L${nose - snout} ${-half} Q${nose} ${-half * 0.35} ${nose} 0 Q${nose} ${half * 0.35} ${nose - snout} ${half} L${tail + 2} ${half} Q${tail - 2} 0 ${tail + 2} ${-half} Z`}
      />
      {/* Cockpit canopy. */}
      <ellipse className="ship__glass" cx={nose - snout * 1.1} cy={0} rx={snout * 0.5} ry={half * 0.45} />
      {/* Plating: one rib per section joint. */}
      {Array.from({ length: sections - 1 }, (_, index) => {
        const x = tail + ((index + 1) * (nose - tail)) / sections;
        return <line key={x} className="ship__rib" x1={x} y1={-half * 0.7} x2={x} y2={half * 0.7} />;
      })}
      {engines.map((offset) => (
        <circle key={offset} className="ship__engine" cx={tail + 4} cy={offset} r={half * 0.3} />
      ))}
    </>
  );
}
