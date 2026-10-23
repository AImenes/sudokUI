/**
 * The referee for the set tracker's soundness harness
 * (tests/setsSoundness.test.ts): everything a verdict of src/engine/sets.ts
 * is checked against, written from scratch so that a mistake in the module
 * cannot hide behind itself. Nothing here imports src/; the houses, the
 * grid checker, the solver, the grid transforms, the digit patterns and the
 * ledger are all this file's own. Not a test file itself.
 *
 * The exact referee is the patterns. Where one digit sits in a valid grid is
 * a "pattern": nine cells, one in each row, column and box. There are 46656
 * of them, and two sets of cells hold the same digits in every valid grid
 * exactly when every pattern meets them equally often:
 *  - if every pattern does, then in any grid the cells of each digit form a
 *    pattern, so each digit occurs as often in one set as in the other;
 *  - if one pattern does not, the grid that puts a 1 on that pattern (the
 *    solver completes it, and the witness is checked cell by cell) holds a
 *    different number of 1s in the two sets.
 * So "same" is decided by counting, and "different" always comes with a
 * grid that shows it, which is verified like any other grid.
 */

export type Rng = () => number;

/** sfc32: a seeded stream of numbers, unrelated to the one sets.ts uses */
export function rngFrom(seed: number): Rng {
  let a = 0x9e3779b9 | 0;
  let b = 0x243f6a88 | 0;
  let c = 0xb7e15162 | 0;
  let d = seed | 0;
  const next = () => {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 20; i++) next();
  return next;
}

export const randInt = (rng: Rng, n: number) => Math.floor(rng() * n);

/** a shuffled copy (Fisher-Yates) */
export function shuffled<T>(xs: readonly T[], rng: Rng): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---- houses ------------------------------------------------------------------

/**
 * The 27 houses as lists of cells, numbered as the module's Term says
 * (rows 0-8, columns 9-17, boxes 18-26, boxes left to right then down),
 * built from coordinates, not from the module's housesOf.
 */
export const HOUSE_CELLS: readonly number[][] = (() => {
  const out: number[][] = [];
  for (let r = 0; r < 9; r++) out.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) out.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let bandRow = 0; bandRow < 3; bandRow++) {
    for (let stackCol = 0; stackCol < 3; stackCol++) {
      const box: number[] = [];
      for (let dr = 0; dr < 3; dr++) for (let dc = 0; dc < 3; dc++) box.push((bandRow * 3 + dr) * 9 + stackCol * 3 + dc);
      out.push(box);
    }
  }
  return out;
})();

/** for each house, an 81-long 0/1 indicator */
export const HOUSE_IND: readonly Uint8Array[] = HOUSE_CELLS.map((cells) => {
  const v = new Uint8Array(81);
  for (const i of cells) v[i] = 1;
  return v;
});

/** a house's name as a solver writes it: "row 3", "column 5", "box 9" */
export const houseName = (h: number) => (h < 9 ? `row ${h + 1}` : h < 18 ? `column ${h - 8}` : `box ${h - 17}`);

// ---- grids -------------------------------------------------------------------

/** a completed valid grid: 81 digits 1-9, every row, column and box holding each once */
export function isValidGrid(g: ArrayLike<number>): boolean {
  if (g.length !== 81) return false;
  for (let i = 0; i < 81; i++) if (!Number.isInteger(g[i]) || g[i] < 1 || g[i] > 9) return false;
  for (const cells of HOUSE_CELLS) {
    let seen = 0;
    for (const i of cells) seen |= 1 << g[i];
    if (seen !== 0b1111111110) return false;
  }
  return true;
}

/** a grid from an 81-character string of digits */
export const gridOf = (s: string): Uint8Array => Uint8Array.from(s, (ch) => (ch >= '1' && ch <= '9' ? Number(ch) : 0));

/**
 * The first completion of a board (0 = empty) a backtracking search finds,
 * or null when it has none. Fewest options first; with a stream of numbers
 * the digits are tried in a random order, so empty boards give varied grids.
 * The givens are checked too: a board that breaks a rule has no completion.
 */
export function solveBoard(board: ArrayLike<number>, rng?: Rng): Uint8Array | null {
  const g = Uint8Array.from(board as ArrayLike<number>);
  const rowM = new Int32Array(9);
  const colM = new Int32Array(9);
  const boxM = new Int32Array(9);
  const boxOf = (i: number) => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);
  for (let i = 0; i < 81; i++) {
    const d = g[i];
    if (!d) continue;
    const bit = 1 << d;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = boxOf(i);
    if (rowM[r] & bit || colM[c] & bit || boxM[b] & bit) return null;
    rowM[r] |= bit;
    colM[c] |= bit;
    boxM[b] |= bit;
  }
  const rec = (): boolean => {
    let best = -1;
    let bestFree = 0;
    let bestN = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const free = ~(rowM[Math.floor(i / 9)] | colM[i % 9] | boxM[boxOf(i)]) & 0b1111111110;
      let n = 0;
      for (let x = free; x; x &= x - 1) n++;
      if (n < bestN) {
        bestN = n;
        best = i;
        bestFree = free;
        if (n <= 1) break;
      }
    }
    if (best < 0) return true;
    if (bestN === 0) return false;
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) if (bestFree & (1 << d)) digits.push(d);
    const order = rng ? shuffled(digits, rng) : digits;
    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxOf(best);
    for (const d of order) {
      const bit = 1 << d;
      g[best] = d;
      rowM[r] |= bit;
      colM[c] |= bit;
      boxM[b] |= bit;
      if (rec()) return true;
      rowM[r] &= ~bit;
      colM[c] &= ~bit;
      boxM[b] &= ~bit;
      g[best] = 0;
    }
    return false;
  };
  return rec() ? g : null;
}

/** how many completions a board has, counting no further than limit */
export function countCompletions(board: ArrayLike<number>, limit = 2): number {
  const g = Uint8Array.from(board as ArrayLike<number>);
  for (let i = 0; i < 81; i++) {
    if (!g[i]) continue;
    const d = g[i];
    g[i] = 0;
    for (const cells of HOUSE_CELLS) if (cells.includes(i) && cells.some((j) => g[j] === d)) return 0;
    g[i] = d;
  }
  let found = 0;
  const rec = () => {
    if (found >= limit) return;
    let best = -1;
    let bestDigits: number[] = [];
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const used = new Set<number>();
      for (const cells of HOUSE_CELLS) if (cells.includes(i)) for (const j of cells) used.add(g[j]);
      const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !used.has(d));
      if (best < 0 || ds.length < bestDigits.length) {
        best = i;
        bestDigits = ds;
        if (ds.length <= 1) break;
      }
    }
    if (best < 0) {
      found++;
      return;
    }
    for (const d of bestDigits) {
      g[best] = d;
      rec();
      g[best] = 0;
      if (found >= limit) return;
    }
  };
  rec();
  return found;
}

function mustBeValid(g: Uint8Array, what: string): Uint8Array {
  if (!isValidGrid(g)) throw new Error(`the oracle's ${what} broke a grid: ${Array.from(g).join('')}`);
  return g;
}

/** the same grid with its digits renamed: perm[d - 1] takes d's place */
export function relabel(g: Uint8Array, perm: number[]): Uint8Array {
  return mustBeValid(g.map((d) => perm[d - 1]), 'relabelling');
}

/** rows become columns */
export function transpose(g: Uint8Array): Uint8Array {
  const out = new Uint8Array(81);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) out[c * 9 + r] = g[r * 9 + c];
  return mustBeValid(out, 'transpose');
}

/** rows reordered: row r of the result is row order[r] of g */
function reorderRows(g: Uint8Array, order: number[], what: string): Uint8Array {
  const out = new Uint8Array(81);
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) out[r * 9 + c] = g[order[r] * 9 + c];
  return mustBeValid(out, what);
}

/** whole bands moved: band k of the result is band bands[k] of g */
export const permuteBands = (g: Uint8Array, bands: number[]) =>
  reorderRows(g, [0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => bands[Math.floor(r / 3)] * 3 + (r % 3)), 'band permutation');

/** rows moved within their bands: within[k] reorders band k's three rows */
export const permuteRowsInBands = (g: Uint8Array, within: number[][]) =>
  reorderRows(g, [0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => Math.floor(r / 3) * 3 + within[Math.floor(r / 3)][r % 3]), 'row permutation');

/** every symmetry at random: digits, transpose, bands, stacks, rows and columns within them */
export function randomTransform(g: Uint8Array, rng: Rng): Uint8Array {
  const p3 = () => shuffled([0, 1, 2], rng);
  let out = relabel(g, shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rng));
  out = permuteBands(out, p3());
  out = permuteRowsInBands(out, [p3(), p3(), p3()]);
  // stacks and columns: the same moves on the transposed grid
  out = transpose(out);
  out = permuteBands(out, p3());
  out = permuteRowsInBands(out, [p3(), p3(), p3()]);
  if (rng() < 0.5) out = transpose(out);
  return out;
}

/**
 * n valid grids: a fresh search from an empty board every fourth one, the
 * rest a random symmetry of an earlier one. Each is checked on the way.
 */
export function makeGrids(n: number, seed: number): Uint8Array[] {
  const rng = rngFrom(seed);
  const out: Uint8Array[] = [];
  for (let k = 0; k < n; k++) {
    const g = k % 4 === 0 || !out.length ? solveBoard(new Uint8Array(81), rng)! : randomTransform(out[randInt(rng, out.length)], rng);
    out.push(mustBeValid(g, 'grid maker'));
  }
  return out;
}

// ---- patterns ----------------------------------------------------------------

/**
 * Every placement of one digit: one cell in each row, column and box,
 * as the column chosen in each row (PATTERNS[9 * p + r]).
 */
export const PATTERN_COUNT = 46656;
export const PATTERNS: Uint8Array = (() => {
  const out = new Uint8Array(PATTERN_COUNT * 9);
  const cols = new Uint8Array(9);
  let n = 0;
  const rec = (r: number, usedCols: number, usedBoxes: number) => {
    if (r === 9) {
      if (n >= PATTERN_COUNT) throw new Error('more patterns than 46656');
      out.set(cols, n * 9);
      n++;
      return;
    }
    for (let c = 0; c < 9; c++) {
      const box = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      if (usedCols & (1 << c) || usedBoxes & (1 << box)) continue;
      cols[r] = c;
      rec(r + 1, usedCols | (1 << c), usedBoxes | (1 << box));
    }
  };
  rec(0, 0, 0);
  if (n !== PATTERN_COUNT) throw new Error(`${n} patterns, not 46656`);
  return out;
})();

export const patternCells = (p: number) => Array.from({ length: 9 }, (_, r) => r * 9 + PATTERNS[p * 9 + r]);

/** the index of the pattern a set of nine cells is, or -1 */
export function patternIndex(cells: number[]): number {
  const sorted = [...cells].sort((x, y) => x - y);
  if (sorted.length !== 9) return -1;
  // patterns are listed in lexicographic order of their columns
  const key = sorted.map((i) => i % 9);
  if (sorted.some((i, r) => Math.floor(i / 9) !== r)) return -1;
  let lo = 0;
  let hi = PATTERN_COUNT - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    let cmp = 0;
    for (let r = 0; r < 9 && !cmp; r++) cmp = PATTERNS[mid * 9 + r] - key[r];
    if (!cmp) return mid;
    if (cmp < 0) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}

/**
 * How the patterns meet the signed cell weights w (1 for A, -1 for B):
 * how many meet A and B unequally, and the first that does (-1 if none)
 */
export function patternImbalance(w: ArrayLike<number>): { count: number; first: number } {
  let count = 0;
  let first = -1;
  for (let p = 0, o = 0; p < PATTERN_COUNT; p++, o += 9) {
    const s =
      w[PATTERNS[o]] +
      w[9 + PATTERNS[o + 1]] +
      w[18 + PATTERNS[o + 2]] +
      w[27 + PATTERNS[o + 3]] +
      w[36 + PATTERNS[o + 4]] +
      w[45 + PATTERNS[o + 5]] +
      w[54 + PATTERNS[o + 6]] +
      w[63 + PATTERNS[o + 7]] +
      w[72 + PATTERNS[o + 8]];
    if (s !== 0) {
      if (first < 0) first = p;
      count++;
    }
  }
  return { count, first };
}

/** a valid grid with 1 on pattern p, or null if none completes it */
export function gridWithOnes(p: number, rng?: Rng): Uint8Array | null {
  const board = new Uint8Array(81);
  for (const i of patternCells(p)) board[i] = 1;
  return solveBoard(board, rng);
}

// ---- sets and digits ---------------------------------------------------------

/** how often each digit occurs in the cells: counts[d] for d = 1..9 */
export function digitCounts(g: ArrayLike<number>, cells: Iterable<number>): number[] {
  const m = new Array(10).fill(0);
  for (const i of cells) m[g[i]]++;
  return m;
}

export const sameDigits = (g: ArrayLike<number>, a: Iterable<number>, b: Iterable<number>) => {
  const ca = digitCounts(g, a);
  const cb = digitCounts(g, b);
  return ca.every((x, d) => x === cb[d]);
};

/** a set as an 81-long membership array (a cell painted twice is still in once) */
export function membership(cells: Iterable<number>): Uint8Array {
  const m = new Uint8Array(81);
  for (const i of cells) m[i] = 1;
  return m;
}

/** each set less the cells it shares with the other, ascending: the overlap counts in neither */
export function reduce(a: Iterable<number>, b: Iterable<number>): [number[], number[]] {
  const ma = membership(a);
  const mb = membership(b);
  const onlyA: number[] = [];
  const onlyB: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (ma[i] && !mb[i]) onlyA.push(i);
    if (mb[i] && !ma[i]) onlyB.push(i);
  }
  return [onlyA, onlyB];
}

export interface Truth {
  /** the sets less their overlap */
  A: number[];
  B: number[];
  /** the same digits in every valid grid */
  same: boolean;
  /** when not: a valid grid where they differ (checked) */
  witness?: Uint8Array;
  /** patterns that meet A and B unequally (when the sizes agree) */
  imbalance: number;
}

/**
 * The truth about two painted sets, decided by the patterns (see the top
 * of the file). A "different" answer always carries a checked grid.
 */
export function truthOf(a: Iterable<number>, b: Iterable<number>, rng: Rng = rngFrom(1)): Truth {
  const [A, B] = reduce(a, b);
  if (A.length !== B.length) {
    // different sizes differ in every grid; any grid is a witness
    const witness = solveBoard(new Uint8Array(81), rng)!;
    if (sameDigits(witness, A, B)) throw new Error('oracle: sets of different sizes agreed');
    return { A, B, same: false, witness, imbalance: -1 };
  }
  const w = new Int8Array(81);
  for (const i of A) w[i] += 1;
  for (const i of B) w[i] -= 1;
  const { count, first } = patternImbalance(w);
  if (!count) return { A, B, same: true, imbalance: 0 };
  // a witness: a 1 on a pattern that meets them unequally
  for (let p = first; p < PATTERN_COUNT; p++) {
    let s = 0;
    for (const i of patternCells(p)) s += w[i];
    if (!s) continue;
    const g = gridWithOnes(p, rng);
    if (!g) continue;
    if (!isValidGrid(g) || sameDigits(g, A, B)) throw new Error(`oracle: the witness for pattern ${p} does not differ`);
    return { A, B, same: false, witness: g, imbalance: count };
  }
  throw new Error('oracle: no pattern that tells the sets apart completes to a grid');
}

// ---- proofs ------------------------------------------------------------------

export interface TermLike {
  house: number;
  times: number;
}

/** how often one side of a proof covers each cell: scale for each cell of the set, times for each house */
export function coverCount(cells: number[], scale: number, terms: TermLike[]): number[] {
  const m = new Array(81).fill(0);
  for (const i of cells) m[i] += scale;
  for (const { house, times } of terms) for (const i of HOUSE_CELLS[house]) m[i] += times;
  return m;
}

/**
 * Why a proof "scale x A with withA covers the same cells as scale x B with
 * withB" fails as an identity, or null when it holds: every cell covered as
 * often on both sides, the same number of houses on both sides, and every
 * number a positive whole one. A and B are the sets the proof is about.
 */
export function proofFault(A: number[], B: number[], scale: number, withA: TermLike[], withB: TermLike[]): string | null {
  if (!Number.isInteger(scale) || scale < 1) return `scale ${scale}`;
  for (const t of [...withA, ...withB]) {
    if (!Number.isInteger(t.house) || t.house < 0 || t.house > 26) return `house ${t.house}`;
    if (!Number.isInteger(t.times) || t.times < 1) return `${houseName(t.house)} counted ${t.times} times`;
  }
  const left = coverCount(A, scale, withA);
  const right = coverCount(B, scale, withB);
  for (let i = 0; i < 81; i++) {
    if (left[i] !== right[i]) return `r${Math.floor(i / 9) + 1}c${(i % 9) + 1} is covered ${left[i]} times on the first side and ${right[i]} on the second`;
  }
  const houses = (ts: TermLike[]) => ts.reduce((s, t) => s + t.times, 0);
  if (houses(withA) !== houses(withB)) return `${houses(withA)} houses against ${houses(withB)}`;
  return null;
}

/**
 * Two sets made from a signed sum of houses: with w = sum of coef[h] times
 * house h, the cells where w = +s are A and those where w = -s are B, and
 * then s x (A - B) is that sum. Null when w takes any other value, or when
 * the coefficients do not sum to zero (then the houses do not balance).
 */
export function setsFromHouses(coef: number[]): { a: number[]; b: number[]; scale: number } | null {
  if (coef.reduce((s, x) => s + x, 0) !== 0) return null;
  const w = new Array(81).fill(0);
  coef.forEach((x, h) => {
    if (x) for (const i of HOUSE_CELLS[h]) w[i] += x;
  });
  const s = Math.max(...w.map(Math.abs));
  if (!s || w.some((x) => x !== 0 && Math.abs(x) !== s)) return null;
  return { a: w.flatMap((x, i) => (x === s ? [i] : [])), b: w.flatMap((x, i) => (x === -s ? [i] : [])), scale: s };
}

/**
 * The diagonal an integer matrix is brought to by swapping and adding whole
 * multiples of rows and of columns (moves that keep every lattice they
 * span), its zeros left off. The product of the entries is the gcd of the
 * matrix's largest nonzero minors, so all of them are 1 exactly when the
 * lattice the columns span holds every whole vector in its rational span.
 */
export function integerDiagonal(matrix: bigint[][]): bigint[] {
  const A = matrix.map((row) => row.slice());
  const m = A.length;
  const n = m ? A[0].length : 0;
  const abs = (x: bigint) => (x < 0n ? -x : x);
  const out: bigint[] = [];
  for (let t = 0; t < Math.min(m, n); t++) {
    for (;;) {
      // the smallest entry left, to the corner
      let bi = -1;
      let bj = -1;
      for (let i = t; i < m; i++) for (let j = t; j < n; j++) if (A[i][j] && (bi < 0 || abs(A[i][j]) < abs(A[bi][bj]))) [bi, bj] = [i, j];
      if (bi < 0) return out;
      [A[t], A[bi]] = [A[bi], A[t]];
      for (const row of A) [row[t], row[bj]] = [row[bj], row[t]];
      // clear its row and column; what is left over is smaller, and goes round again
      let clear = true;
      for (let i = t + 1; i < m; i++) {
        if (!A[i][t]) continue;
        const f = A[i][t] / A[t][t];
        for (let j = t; j < n; j++) A[i][j] -= f * A[t][j];
        if (A[i][t]) clear = false;
      }
      for (let j = t + 1; j < n; j++) {
        if (!A[t][j]) continue;
        const f = A[t][j] / A[t][t];
        for (let i = t; i < m; i++) A[i][j] -= f * A[i][t];
        if (A[t][j]) clear = false;
      }
      if (clear) break;
    }
    out.push(abs(A[t][t]));
  }
  return out;
}

/** a random signed sum of houses that makes two sets, or null; k houses on each side */
export function randomHouseSum(rng: Rng, k: number): number[] {
  const coef = new Array(27).fill(0);
  const houses = shuffled([...Array(27).keys()], rng);
  for (let i = 0; i < k; i++) coef[houses[i]] += 1;
  for (let i = k; i < 2 * k; i++) coef[houses[i]] -= 1;
  return coef;
}

// ---- the ledgers -------------------------------------------------------------

export interface LedgerTruth {
  size: number;
  placed: number[];
  empty: number;
  needs: number[];
}

/**
 * Each set's count from the board (0 = empty): its cells less the overlap,
 * the digits on them, how many are empty, and the digits the other set has
 * placed that this one has not matched yet (taken one by one out of a list).
 */
export function ledgerTruth(a: Iterable<number>, b: Iterable<number>, values: ArrayLike<number>): [LedgerTruth, LedgerTruth] {
  const [A, B] = reduce(a, b);
  const on = (cells: number[]) => cells.map((i) => values[i]).filter((d) => d !== 0);
  const pa = on(A);
  const pb = on(B);
  const owed = (mine: number[], theirs: number[]) => {
    const left = [...mine];
    const out: number[] = [];
    for (const d of theirs) {
      const k = left.indexOf(d);
      if (k >= 0) left.splice(k, 1);
      else out.push(d);
    }
    return out.sort((x, y) => x - y);
  };
  const asc = (xs: number[]) => [...xs].sort((x, y) => x - y);
  return [
    { size: A.length, placed: asc(pa), empty: A.length - pa.length, needs: owed(pa, pb) },
    { size: B.length, placed: asc(pb), empty: B.length - pb.length, needs: owed(pb, pa) }
  ];
}

/** whether every digit on the board (0 = empty) is the one the solution has there */
export const agrees = (board: ArrayLike<number>, solution: ArrayLike<number>) => {
  for (let i = 0; i < 81; i++) if (board[i] && board[i] !== solution[i]) return false;
  return true;
};

/** whether the multiset small fits inside the multiset big */
export function within(small: number[], big: number[]): boolean {
  const left = [...big];
  for (const d of small) {
    const k = left.indexOf(d);
    if (k < 0) return false;
    left.splice(k, 1);
  }
  return true;
}

// ---- shapes ------------------------------------------------------------------

export const cellsWhere = (pred: (r: number, c: number) => boolean) =>
  [...Array(81).keys()].filter((i) => pred(Math.floor(i / 9), i % 9));
/** rows and columns counted from 1, as a solver names them */
export const rowsOf = (...rs: number[]) => cellsWhere((r) => rs.includes(r + 1));
export const colsOf = (...cs: number[]) => cellsWhere((_, c) => cs.includes(c + 1));
export const boxesOf = (...bs: number[]) => bs.flatMap((b) => HOUSE_CELLS[17 + b]);
/** Phistomefel's ring and the sixteen corner cells it is equal to */
export const RING = cellsWhere((r, c) => r >= 2 && r <= 6 && c >= 2 && c <= 6 && !(r >= 3 && r <= 5 && c >= 3 && c <= 5));
export const CORNERS = cellsWhere((r, c) => (r < 2 || r > 6) && (c < 2 || c > 6));
