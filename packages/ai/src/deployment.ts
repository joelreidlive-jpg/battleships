import {
  type Cell,
  FLEET,
  type Placement,
  type Rng,
  candidatePlacements,
  pick,
  placementCells,
} from '@bs/rules';

/**
 * Deploy a fleet uniformly at random over legal, non-overlapping positions.
 *
 * Uniform is deliberate. Human placement has strong tells — edges, corners,
 * hulls kept apart — and any deterministic "clever" scheme the invader used
 * would be learnable across games, which is a worse leak than randomness is a
 * weakness.
 */
export function randomFleet(rng: Rng): Placement[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const fleet = tryDeploy(rng);
    if (fleet) return fleet;
  }
  // Unreachable in practice: five hulls on a 10x10 grid place first-try the
  // overwhelming majority of the time.
  throw new Error('could not deploy a fleet');
}

function tryDeploy(rng: Rng): Placement[] | null {
  const used = new Set<Cell>();
  const fleet: Placement[] = [];
  // Largest hull first: it has the fewest legal positions, so placing it last
  // is what causes the retries.
  for (const ship of [...FLEET].sort((a, b) => b.sections - a.sections)) {
    const options = candidatePlacements(ship.id).filter((placement) =>
      placementCells(placement).every((cell) => !used.has(cell)),
    );
    if (options.length === 0) return null;
    const chosen = pick(rng, options);
    for (const cell of placementCells(chosen)) used.add(cell);
    fleet.push(chosen);
  }
  return fleet;
}
