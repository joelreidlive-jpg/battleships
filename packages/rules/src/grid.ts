/**
 * The board is the classic Battleship 10x10 lettered grid. Cells are stored as
 * a single index (`row * COLUMNS + column`) rather than a pair, because every
 * hot path — shot bookkeeping, the AI's probability map — is a set membership
 * test, and a number keys a `Set` correctly where an object does not.
 */

export const COLUMNS = 10;
export const ROWS = 10;
export const CELL_COUNT = COLUMNS * ROWS;

/** Column headers, in the order they are displayed. */
export const COLUMN_LABELS = 'ABCDEFGHIJ'.slice(0, COLUMNS).split('');

/** A cell index in `[0, CELL_COUNT)`. */
export type Cell = number;

export function cellAt(column: number, row: number): Cell {
  return row * COLUMNS + column;
}

export function columnOf(cell: Cell): number {
  return cell % COLUMNS;
}

export function rowOf(cell: Cell): number {
  return Math.floor(cell / COLUMNS);
}

export function isCell(value: unknown): value is Cell {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < CELL_COUNT;
}

/** `"B7"` — the label a player reads out, column letter then 1-based row. */
export function formatCell(cell: Cell): string {
  if (!isCell(cell)) throw new RangeError(`cell ${cell} is off the grid`);
  return `${COLUMN_LABELS[columnOf(cell)]}${rowOf(cell) + 1}`;
}

export function parseCell(label: string): Cell {
  const match = /^([A-Za-z])(\d{1,2})$/.exec(label.trim());
  if (!match) throw new RangeError(`"${label}" is not a grid reference`);
  const column = COLUMN_LABELS.indexOf(match[1].toUpperCase());
  const row = Number(match[2]) - 1;
  if (column < 0 || row < 0 || row >= ROWS) throw new RangeError(`"${label}" is off the grid`);
  return cellAt(column, row);
}

export const ALL_CELLS: readonly Cell[] = Array.from({ length: CELL_COUNT }, (_, i) => i);

/** The up-to-four orthogonal neighbours of a cell, clipped at the edges. */
export function neighbours(cell: Cell): Cell[] {
  const column = columnOf(cell);
  const row = rowOf(cell);
  const out: Cell[] = [];
  if (column > 0) out.push(cellAt(column - 1, row));
  if (column < COLUMNS - 1) out.push(cellAt(column + 1, row));
  if (row > 0) out.push(cellAt(column, row - 1));
  if (row < ROWS - 1) out.push(cellAt(column, row + 1));
  return out;
}
