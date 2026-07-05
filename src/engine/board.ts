// Core board model: 81 cells, digits 1..9 stored as 1..9 (0 = empty),
// candidates as 9-bit masks (bit 0 = digit 1).

export const ALL_CANDS = 0x1ff;

/** units[0..8] rows, units[9..17] cols, units[18..26] boxes */
export const UNITS: number[][] = [];
/** for each cell: [rowUnit, colUnit, boxUnit] indices into UNITS */
export const CELL_UNITS: [number, number, number][] = [];
/** for each cell: the 20 peers */
export const PEERS: number[][] = [];

for (let r = 0; r < 9; r++) UNITS.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
for (let c = 0; c < 9; c++) UNITS.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
for (let b = 0; b < 9; b++) {
  const br = Math.floor(b / 3) * 3;
  const bc = (b % 3) * 3;
  const cells: number[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cells.push((br + r) * 9 + bc + c);
  UNITS.push(cells);
}

for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  CELL_UNITS.push([r, 9 + c, 18 + b]);
  const set = new Set<number>();
  for (const u of [UNITS[r], UNITS[9 + c], UNITS[18 + b]]) for (const cell of u) set.add(cell);
  set.delete(i);
  PEERS.push([...set].sort((a, z) => a - z));
}

export const rowOf = (cell: number) => Math.floor(cell / 9);
export const colOf = (cell: number) => cell % 9;
export const boxOf = (cell: number) => Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3);

export const sees = (a: number, b: number) =>
  a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

export const cellName = (cell: number) => `r${rowOf(cell) + 1}c${colOf(cell) + 1}`;
export const cellNames = (cells: number[]) => cells.map(cellName).join(', ');

export const bit = (digit: number) => 1 << (digit - 1);
export const hasCand = (mask: number, digit: number) => (mask & bit(digit)) !== 0;

export function popcount(x: number): number {
  x -= (x >> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
  x = (x + (x >> 4)) & 0x0f0f0f0f;
  return (x * 0x01010101) >> 24;
}

/** digits present in a 9-bit mask, ascending */
export function digitsOf(mask: number): number[] {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
  return out;
}

/** Grid = plain solving state, cheap to clone. */
export interface Grid {
  values: Uint8Array; // 81, 0 = empty
  cands: Uint16Array; // 81, 9-bit masks; 0 for solved cells
  /** 1 = clue from the original puzzle (avoidable rectangles need this) */
  given: Uint8Array;
}

export function emptyGrid(): Grid {
  const g: Grid = {
    values: new Uint8Array(81),
    cands: new Uint16Array(81),
    given: new Uint8Array(81)
  };
  g.cands.fill(ALL_CANDS);
  return g;
}

export function cloneGrid(g: Grid): Grid {
  return {
    values: new Uint8Array(g.values),
    cands: new Uint16Array(g.cands),
    given: new Uint8Array(g.given)
  };
}

/** Place a digit and strip it from peers' candidates. */
export function setValue(g: Grid, cell: number, digit: number): void {
  g.values[cell] = digit;
  g.cands[cell] = 0;
  const b = bit(digit);
  for (const p of PEERS[cell]) g.cands[p] &= ~b;
}

/** Parse an 81-char string ('.', '0' = empty). Returns null if malformed. */
export function parseGrid(s: string): Grid | null {
  const chars = s.replace(/[^0-9.]/g, '');
  if (chars.length !== 81) return null;
  const g = emptyGrid();
  for (let i = 0; i < 81; i++) {
    const ch = chars[i];
    if (ch !== '.' && ch !== '0') {
      setValue(g, i, Number(ch));
      g.given[i] = 1;
    }
  }
  return g;
}

export function gridToString(g: Grid): string {
  let s = '';
  for (let i = 0; i < 81; i++) s += g.values[i] === 0 ? '.' : String(g.values[i]);
  return s;
}

export function isSolved(g: Grid): boolean {
  for (let i = 0; i < 81; i++) if (g.values[i] === 0) return false;
  return true;
}

/** true if some empty cell has no candidates or a unit misses a digit entirely */
export function isBroken(g: Grid): boolean {
  for (let i = 0; i < 81; i++) if (g.values[i] === 0 && g.cands[i] === 0) return true;
  for (const unit of UNITS) {
    let present = 0;
    for (const cell of unit) {
      present |= g.values[cell] ? bit(g.values[cell]) : g.cands[cell];
    }
    if (present !== ALL_CANDS) return true;
  }
  return false;
}
