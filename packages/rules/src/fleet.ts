/**
 * The fleet is the classic Battleship line-up — hulls of 5, 4, 3, 3 and 2
 * sections, seventeen sections in total — reskinned as spacecraft. The sizes
 * are the game's balance, so they are the part that does not get to change;
 * the names are theme.
 */

export type ShipClassId = 'carrier' | 'battlecruiser' | 'cruiser' | 'submersible' | 'interceptor';

export interface ShipClass {
  readonly id: ShipClassId;
  /** Hull length in grid cells. Classic Battleship sizes. */
  readonly sections: number;
  /** Name shown on the defender's (player's) grid. */
  readonly earthName: string;
  /** Name shown for the same hull length in the invader's fleet. */
  readonly alienName: string;
  readonly blurb: string;
}

export const FLEET: readonly ShipClass[] = [
  {
    id: 'carrier',
    sections: 5,
    earthName: 'Orbital Carrier',
    alienName: 'Hive Dreadnought',
    blurb: 'Five sections of launch deck. The largest hull on either side and the slowest to hide.',
  },
  {
    id: 'battlecruiser',
    sections: 4,
    earthName: 'Solar Battlecruiser',
    alienName: 'Devourer Cruiser',
    blurb: 'Four sections. The main line of battle above the atmosphere.',
  },
  {
    id: 'cruiser',
    sections: 3,
    earthName: 'Ion Cruiser',
    alienName: 'Swarm Cruiser',
    blurb: 'Three sections of ion lance. Fast enough to reposition between waves.',
  },
  {
    id: 'submersible',
    sections: 3,
    earthName: 'Void Submersible',
    alienName: 'Shadow Lurker',
    blurb: 'Three sections, running dark below the ecliptic. Same hull length as a cruiser.',
  },
  {
    id: 'interceptor',
    sections: 2,
    earthName: 'Nova Interceptor',
    alienName: 'Needle Skiff',
    blurb: 'Two sections. Small, quick, and the hull that decides most endgames.',
  },
];

/** 5 + 4 + 3 + 3 + 2 = 17, so 17 hits is a perfect game. */
export const TOTAL_SECTIONS = FLEET.reduce((sum, ship) => sum + ship.sections, 0);

const BY_ID = new Map(FLEET.map((ship) => [ship.id, ship]));

export function shipClass(id: ShipClassId): ShipClass {
  const ship = BY_ID.get(id);
  if (!ship) throw new RangeError(`unknown ship class "${id}"`);
  return ship;
}

export type Side = 'earth' | 'alien';

export function shipName(id: ShipClassId, side: Side): string {
  const ship = shipClass(id);
  return side === 'earth' ? ship.earthName : ship.alienName;
}
