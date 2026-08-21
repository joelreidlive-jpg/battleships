/**
 * The fleet: one battleship of four sections, two cruisers of three, three
 * destroyers of two and four submarines of one — twenty sections per side,
 * reskinned as spacecraft. The sizes and counts are the game's balance, so
 * they are the part that does not get to change; the names are theme.
 *
 * Because a class can be deployed more than once, hulls are identified
 * individually: `cruiser-2` is a hull, `cruiser` is its class. Everything that
 * has to tell two hulls apart — placement, damage, sinking — keys off the hull
 * id, and only presentation looks up the class.
 */

export type ShipClassId = 'battleship' | 'cruiser' | 'destroyer' | 'submarine';

export interface ShipClass {
  readonly id: ShipClassId;
  /** Hull length in grid cells. */
  readonly sections: number;
  /** How many hulls of this class each side deploys. */
  readonly count: number;
  /** Name shown on the defender's (player's) grid. */
  readonly earthName: string;
  /** Name shown for the same hull in the invader's fleet. */
  readonly alienName: string;
  readonly blurb: string;
  /** The blurb cut to a glance, for lists that show the hull's artwork. */
  readonly tagline: string;
  /**
   * Briefing ratings, out of five. They are flavour, not mechanics: every hull
   * fires one shot a turn and dies one section at a time, so nothing in the
   * engine reads these. They describe what a hull's length costs it — a long
   * hull is slow and easy to find but soaks damage; a submarine is the reverse.
   */
  readonly ratings: {
    readonly speed: number;
    readonly defence: number;
    readonly firepower: number;
  };
}

export const FLEET: readonly ShipClass[] = [
  {
    id: 'battleship',
    sections: 4,
    count: 1,
    earthName: 'Solar Battleship',
    alienName: 'Hive Dreadnought',
    blurb: 'Four sections of armoured spine. The flagship, and the hardest hull to hide.',
    tagline: 'Armoured spine. Hardest to hide.',
    ratings: { speed: 1, defence: 5, firepower: 5 },
  },
  {
    id: 'cruiser',
    sections: 3,
    count: 2,
    earthName: 'Ion Cruiser',
    alienName: 'Swarm Cruiser',
    blurb: 'Three sections of ion lance. Fast enough to reposition between waves.',
    tagline: 'Ion lance. Quick between waves.',
    ratings: { speed: 3, defence: 4, firepower: 4 },
  },
  {
    id: 'destroyer',
    sections: 2,
    count: 3,
    earthName: 'Nova Destroyer',
    alienName: 'Needle Skiff',
    blurb: 'Two sections. Numerous, and the hull that decides most endgames.',
    tagline: 'Numerous. Decides most endgames.',
    ratings: { speed: 4, defence: 2, firepower: 3 },
  },
  {
    id: 'submarine',
    sections: 1,
    count: 4,
    earthName: 'Void Submarine',
    alienName: 'Shadow Lurker',
    blurb: 'A single section running dark. Impossible to deduce, and found only by luck.',
    tagline: 'Runs dark. Found only by luck.',
    ratings: { speed: 5, defence: 1, firepower: 2 },
  },
];

/** A hull id, e.g. `battleship-1` or `cruiser-2`. */
export type HullId = string;

export interface Hull {
  readonly id: HullId;
  readonly ship: ShipClassId;
  /** 1-based index within the class, for naming: Ion Cruiser II. */
  readonly ordinal: number;
  readonly sections: number;
}

/** Every hull a side deploys, largest class first. */
export const HULLS: readonly Hull[] = FLEET.flatMap((ship) =>
  Array.from({ length: ship.count }, (_, index) => ({
    id: `${ship.id}-${index + 1}`,
    ship: ship.id,
    ordinal: index + 1,
    sections: ship.sections,
  })),
);

/** 4 + 2x3 + 3x2 + 4x1 = 20, so 20 hits is a perfect game. */
export const TOTAL_SECTIONS = HULLS.reduce((sum, hull) => sum + hull.sections, 0);

const CLASS_BY_ID = new Map(FLEET.map((ship) => [ship.id, ship]));
const HULL_BY_ID = new Map(HULLS.map((hull) => [hull.id, hull]));

export function shipClass(id: ShipClassId): ShipClass {
  const ship = CLASS_BY_ID.get(id);
  if (!ship) throw new RangeError(`unknown ship class "${id}"`);
  return ship;
}

export function hull(id: HullId): Hull {
  const found = HULL_BY_ID.get(id);
  if (!found) throw new RangeError(`unknown hull "${id}"`);
  return found;
}

export function isHullId(value: unknown): value is HullId {
  return typeof value === 'string' && HULL_BY_ID.has(value);
}

export function hullSections(id: HullId): number {
  return hull(id).sections;
}

export type Side = 'earth' | 'alien';

const NUMERALS = ['I', 'II', 'III', 'IV', 'V'];

/** Display name for one hull, numbered when its class has siblings. */
export function hullName(id: HullId, side: Side): string {
  const { ship, ordinal } = hull(id);
  const shipType = shipClass(ship);
  const base = side === 'earth' ? shipType.earthName : shipType.alienName;
  return shipType.count > 1 ? `${base} ${NUMERALS[ordinal - 1]}` : base;
}

export function shipName(id: ShipClassId, side: Side): string {
  const ship = shipClass(id);
  return side === 'earth' ? ship.earthName : ship.alienName;
}
