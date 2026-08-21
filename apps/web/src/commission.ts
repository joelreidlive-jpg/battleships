/**
 * Who the player is: the captain's name and the starfleet they command.
 *
 * It is asked for once, at the briefing, and kept in this browser. The server
 * neither knows nor needs it — it is fiction printed over the top of a match,
 * so nothing about scoring or the campaign depends on it.
 */

const KEY = 'bs.commission';

export interface Commission {
  readonly captain: string;
  readonly starfleet: string;
}

export function storedCommission(): Commission | null {
  const raw = localStorage.getItem(KEY);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return null;
    const { captain, starfleet } = value as Partial<Commission>;
    if (typeof captain !== 'string' || typeof starfleet !== 'string') return null;
    if (captain.trim() === '' || starfleet.trim() === '') return null;
    return { captain, starfleet };
  } catch {
    return null;
  }
}

export function saveCommission(commission: Commission): void {
  localStorage.setItem(KEY, JSON.stringify(commission));
}

export function clearCommission(): void {
  localStorage.removeItem(KEY);
}
