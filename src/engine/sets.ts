/**
 * Set equivalence (SET): two groups of cells that must hold the same
 * digits in every valid grid, the idea behind Phistomefel's ring and the
 * "four rows against four columns" construction. Used by the set tracker
 * under the board (src/ui/SetTracker.tsx).
 *
 * The proof is the one a solver writes on paper: count houses. If set A
 * with some rows, columns and boxes added covers exactly the same cells as
 * set B with as many houses added, both sides hold every digit of those
 * houses once each, so A and B hold the same digits. In vector form,
 * 1_A - 1_B = sum of c_h * 1_h over the 27 houses with sum c_h = 0; then
 * for any grid and any digit d, (1_A - 1_B) . x_d = sum c_h = 0. Rational
 * coefficients prove it as well as integer ones; they are scaled to whole
 * numbers for the reader.
 *
 * When no combination of houses links the two sets, the module looks for
 * a valid grid that fills them differently, and says "they can differ"
 * only when it has found one. Otherwise it says "not proved": nothing here
 * ever claims more than it has shown. Cells in both sets count in
 * neither, the way the overlap of four rows and four columns drops out.
 */
import { generateFullGrid } from './generator';

/** a house's index: rows 0-8, columns 9-17, boxes 18-26 (UNITS in board.ts) */
export type House = number;

/** a house and how many times it is counted */
export interface Term {
  house: House;
  times: number;
}

export type SetVerdict =
  /** nothing left once the overlap is removed */
  | { kind: 'empty' }
  /** only one of the two sets has cells */
  | { kind: 'one' }
  /** different numbers of cells cannot hold the same digits */
  | { kind: 'sizes'; a: number; b: number }
  /** proved: scale x A plus withA covers the same cells as scale x B plus withB */
  | { kind: 'same'; scale: number; withA: Term[]; withB: Term[] }
  /** no count of houses links them, and this valid grid fills them differently */
  | { kind: 'differ'; grid: string }
  /** no count of houses links them, and no grid tried tells them apart */
  | { kind: 'unproved' };

/** the three houses of a cell */
export const housesOf = (cell: number): [House, House, House] => {
  const r = Math.floor(cell / 9);
  const c = cell % 9;
  return [r, 9 + c, 18 + Math.floor(r / 3) * 3 + Math.floor(c / 3)];
};

/** the two sets as the tracker reads them: each without the cells it shares with the other */
export function withoutOverlap(a: Iterable<number>, b: Iterable<number>): [number[], number[]] {
  const sa = new Set(a);
  const sb = new Set(b);
  return [[...sa].filter((i) => !sb.has(i)).sort((x, y) => x - y), [...sb].filter((i) => !sa.has(i)).sort((x, y) => x - y)];
}

// ---- exact arithmetic --------------------------------------------------------

interface Q {
  n: bigint;
  d: bigint;
}
const gcd = (a: bigint, b: bigint): bigint => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const q = (n: bigint, d = 1n): Q => {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
const ZERO = q(0n);
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);

/**
 * The house coefficients c with M c = v (M: one row per cell, a 1 under
 * each of its three houses) and sum c = 0, by exact Gaussian elimination;
 * null when there are none.
 */
function solveHouses(v: number[]): Q[] | null {
  const rows: Q[][] = [];
  for (let cell = 0; cell < 81; cell++) {
    const row = Array.from({ length: 28 }, () => ZERO);
    for (const h of housesOf(cell)) row[h] = q(1n);
    row[27] = q(BigInt(v[cell]));
    rows.push(row);
  }
  rows.push([...Array.from({ length: 27 }, () => q(1n)), ZERO]);
  const pivots: number[] = [];
  let r = 0;
  for (let col = 0; col < 27 && r < rows.length; col++) {
    let p = -1;
    for (let i = r; i < rows.length; i++) if (rows[i][col].n !== 0n) { p = i; break; }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    const inv = rows[r][col];
    rows[r] = rows[r].map((x) => div(x, inv));
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i][col].n === 0n) continue;
      const f = rows[i][col];
      rows[i] = rows[i].map((x, j) => sub(x, mul(f, rows[r][j])));
    }
    pivots.push(col);
    r++;
  }
  for (let i = r; i < rows.length; i++) if (rows[i][27].n !== 0n) return null;
  const c = Array.from({ length: 27 }, () => ZERO);
  pivots.forEach((col, i) => (c[col] = rows[i][27]));
  return c;
}

/**
 * The six ways the same cells can be counted twice, which every proof may
 * add freely: a band's three rows cover what its three boxes cover, and so
 * does a stack's three columns. They span every such identity (the 27
 * houses have rank 21).
 */
const IDENTITIES: number[][] = [0, 1, 2].flatMap((k) => {
  const band = new Array(27).fill(0);
  const stack = new Array(27).fill(0);
  for (let i = 0; i < 3; i++) {
    band[3 * k + i] = 1;
    band[18 + 3 * k + i] = -1;
    stack[9 + 3 * k + i] = 1;
    stack[18 + k + 3 * i] = -1;
  }
  return [band, stack];
});

const weight = (c: number[]) => c.reduce((s, x) => s + Math.abs(x), 0);

/**
 * Every combination of the six identities with weights -1, 0 or 1: one
 * move can then swap "three rows" for "the other six columns" at once
 * (all rows minus all columns is the sum of all six), which single moves
 * never reach because each passes through boxes on the way
 */
const MOVES: number[][] = (() => {
  const out: number[][] = [];
  for (let code = 1; code < 729; code++) {
    const w: number[] = [];
    for (let k = 0, n = code; k < 6; k++, n = Math.floor(n / 3)) w.push((n % 3) - 1);
    out.push(Array.from({ length: 27 }, (_, h) => w.reduce((s, x, k) => s + x * IDENTITIES[k][h], 0)));
  }
  return out;
})();

/** the proof with the fewest houses the moves reach: rows and columns over boxes when it ties */
function simplest(c: number[]): number[] {
  const cost = (x: number[]) => weight(x) * 4 + x.slice(18).reduce((s, v) => s + Math.abs(v), 0);
  let best = c;
  for (let improved = true; improved; ) {
    improved = false;
    for (const move of MOVES) {
      const next = best.map((x, i) => x + move[i]);
      if (cost(next) < cost(best)) {
        best = next;
        improved = true;
      }
    }
  }
  return best;
}

// ---- the verdict -------------------------------------------------------------

/** a small, seeded stream of numbers, so the verdict is the same on every run */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** how many valid grids are tried for a counterexample before saying "not proved" */
export const GRIDS_TRIED = 48;

const digitsIn = (grid: ArrayLike<number>, cells: number[]) =>
  cells
    .map((i) => grid[i])
    .sort((x, y) => x - y)
    .join('');

/** whether two sets of cells must hold the same digits, and why (see the module's comment) */
export function compareSets(a: Iterable<number>, b: Iterable<number>): SetVerdict {
  const [A, B] = withoutOverlap(a, b);
  if (!A.length && !B.length) return { kind: 'empty' };
  if (!A.length || !B.length) return { kind: 'one' };
  if (A.length !== B.length) return { kind: 'sizes', a: A.length, b: B.length };

  const v = new Array(81).fill(0);
  for (const i of A) v[i] += 1;
  for (const i of B) v[i] -= 1;
  const c = solveHouses(v);
  if (c) {
    // whole numbers: scale by the common denominator
    let scale = 1n;
    for (const x of c) scale = (scale * x.d) / gcd(scale, x.d);
    const whole = simplest(c.map((x) => Number((x.n * scale) / x.d)));
    // scale x 1_A - scale x 1_B = sum c_h 1_h: A takes the houses with
    // c < 0, B those with c > 0
    const terms = (sign: number) =>
      whole.flatMap((x, house) => (Math.sign(x) === sign ? [{ house, times: Math.abs(x) }] : []));
    return { kind: 'same', scale: Number(scale), withA: terms(-1), withB: terms(1) };
  }

  const rnd = seeded(0x5e7 + A.length * 131 + B[0]);
  for (let t = 0; t < GRIDS_TRIED; t++) {
    const grid = generateFullGrid(rnd).values;
    if (digitsIn(grid, A) !== digitsIn(grid, B)) return { kind: 'differ', grid: Array.from(grid).join('') };
  }
  return { kind: 'unproved' };
}

// ---- the bookkeeping ---------------------------------------------------------

/** one set's digits on the board, and what it still needs from the other */
export interface SetLedger {
  size: number;
  /** the digits placed in it, ascending */
  placed: number[];
  empty: number;
  /** digits placed in the other set and not yet matched in this one, ascending; each must be in this set's empty cells */
  needs: number[];
}

const counts = (digits: number[]) => {
  const m = new Array(10).fill(0);
  for (const d of digits) m[d]++;
  return m;
};

/**
 * The two sets' ledgers from the digits on the board (0 = empty). "Needs"
 * holds only when the sets hold the same digits: the caller shows it for
 * a proved verdict alone.
 */
export function setLedgers(a: Iterable<number>, b: Iterable<number>, values: ArrayLike<number>): [SetLedger, SetLedger] {
  const [A, B] = withoutOverlap(a, b);
  const placed = (cells: number[]) => cells.map((i) => values[i]).filter((d) => d > 0).sort((x, y) => x - y);
  const pa = placed(A);
  const pb = placed(B);
  const ca = counts(pa);
  const cb = counts(pb);
  const owed = (mine: number[], theirs: number[]) => {
    const out: number[] = [];
    for (let d = 1; d <= 9; d++) for (let k = mine[d]; k < theirs[d]; k++) out.push(d);
    return out;
  };
  return [
    { size: A.length, placed: pa, empty: A.length - pa.length, needs: owed(ca, cb) },
    { size: B.length, placed: pb, empty: B.length - pb.length, needs: owed(cb, ca) }
  ];
}

/** the cells a proof's two sides cover, each with how often: equal on both sides when the proof holds */
export function coverage(cells: number[], scale: number, terms: Term[]): number[] {
  const m = new Array(81).fill(0);
  for (const i of cells) m[i] += scale;
  for (const { house, times } of terms) {
    for (let cell = 0; cell < 81; cell++) if (housesOf(cell).includes(house)) m[cell] += times;
  }
  return m;
}
