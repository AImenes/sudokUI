/**
 * An oracle for what is true in a position, written apart from the engine
 * so it can judge the engine: an exhaustive bitmask search over values and
 * candidate masks, with its own houses, sharing no code with
 * src/engine/bruteForce.ts or the technique finders (a deliberately naive
 * counter below checks it in turn). Not a test file
 * itself: tests/soundnessNoUniqueness.test.ts proves it on small cases and
 * then uses it, and a heavy run outside the repository uses it too.
 *
 * A position is 81 values (0 = empty) and, optionally, a 9-bit mask per
 * empty cell of the digits still allowed there (bit 0 = digit 1). Its
 * solutions are the completed grids that keep every value and every mask.
 * A deduction is sound in the position exactly when it holds in all of
 * them, however many there are: a placement must be the digit every
 * solution has in that cell, an elimination must remove a digit no
 * solution has there.
 */

const ROW: number[] = [];
const COL: number[] = [];
const BOX: number[] = [];
for (let i = 0; i < 81; i++) {
  const r = Math.floor(i / 9);
  const c = i % 9;
  ROW.push(r);
  COL.push(c);
  BOX.push(Math.floor(r / 3) * 3 + Math.floor(c / 3));
}

const ALL = 0x1ff;

function bitCount(m: number): number {
  let n = 0;
  for (; m; m &= m - 1) n++;
  return n;
}

/** the 27 houses: rows, columns, boxes */
const HOUSES: number[][] = [];
for (let h = 0; h < 9; h++) {
  HOUSES.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => ROW[i] === h));
  HOUSES.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => COL[i] === h));
  HOUSES.push(Array.from({ length: 81 }, (_, i) => i).filter((i) => BOX[i] === h));
}

/** thrown when a search runs past the node budget it was given: the question stays open */
export class OracleBudgetExceeded extends Error {}

/**
 * Depth-first search. At each node it branches on whichever is narrower:
 * the empty cell with the fewest digits left, or the digit with the fewest
 * places left in some house; a cell with no digit, or a house digit with no
 * place, ends the branch. Calls `found` with each solution (a fresh array)
 * and stops as soon as it returns true. A position whose values already
 * clash has no solution. Past `budget` nodes it throws.
 */
function search(values: ArrayLike<number>, cands: ArrayLike<number> | undefined, found: (s: Uint8Array) => boolean, budget = Infinity): void {
  const v = new Uint8Array(81);
  const allowed = new Uint16Array(81);
  const rows = new Uint16Array(9);
  const cols = new Uint16Array(9);
  const boxes = new Uint16Array(9);
  for (let i = 0; i < 81; i++) {
    const d = values[i];
    if (d) {
      const b = 1 << (d - 1);
      if (rows[ROW[i]] & b || cols[COL[i]] & b || boxes[BOX[i]] & b) return; // clashing values
      rows[ROW[i]] |= b;
      cols[COL[i]] |= b;
      boxes[BOX[i]] |= b;
      v[i] = d;
    } else {
      allowed[i] = cands ? cands[i] & ALL : ALL;
    }
  }
  let left = 0;
  for (let i = 0; i < 81; i++) if (!v[i]) left++;
  let stop = false;
  let nodes = 0;
  const optsOf = new Uint16Array(81);
  const place = (i: number, d: number) => {
    const b = 1 << (d - 1);
    v[i] = d;
    rows[ROW[i]] |= b;
    cols[COL[i]] |= b;
    boxes[BOX[i]] |= b;
    left--;
  };
  const unplace = (i: number, d: number) => {
    const b = 1 << (d - 1);
    v[i] = 0;
    rows[ROW[i]] &= ~b;
    cols[COL[i]] &= ~b;
    boxes[BOX[i]] &= ~b;
    left++;
  };
  const rec = (): void => {
    if (++nodes > budget) throw new OracleBudgetExceeded();
    if (left === 0) {
      stop = found(new Uint8Array(v));
      return;
    }
    // the empty cell with the fewest digits left
    let bestCell = -1;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (v[i]) continue;
      const opts = allowed[i] & ~(rows[ROW[i]] | cols[COL[i]] | boxes[BOX[i]]);
      optsOf[i] = opts;
      const n = bitCount(opts);
      if (n === 0) return;
      if (n < bestCount) {
        bestCell = i;
        bestCount = n;
      }
    }
    // the house digit with the fewest places left
    let bestHouse = -1;
    let bestDigit = 0;
    let bestPlaces = 10;
    for (let h = 0; h < 27; h++) {
      const house = HOUSES[h];
      let placed = 0;
      for (const i of house) if (v[i]) placed |= 1 << (v[i] - 1);
      for (let d = 1; d <= 9; d++) {
        const b = 1 << (d - 1);
        if (placed & b) continue;
        let n = 0;
        for (const i of house) if (!v[i] && optsOf[i] & b) n++;
        if (n === 0) return;
        if (n < bestPlaces) {
          bestHouse = h;
          bestDigit = d;
          bestPlaces = n;
        }
      }
    }
    if (bestPlaces < bestCount) {
      const b = 1 << (bestDigit - 1);
      const spots = HOUSES[bestHouse].filter((i) => !v[i] && optsOf[i] & b);
      for (const i of spots) {
        if (stop) return;
        place(i, bestDigit);
        rec();
        unplace(i, bestDigit);
      }
      return;
    }
    for (let opts = optsOf[bestCell]; opts && !stop; opts &= opts - 1) {
      const d = 32 - Math.clz32(opts & -opts);
      place(bestCell, d);
      rec();
      unplace(bestCell, d);
    }
  };
  rec();
}

/** every solution of the position, or null when there are more than `cap` */
export function allSolutions(values: ArrayLike<number>, cands: ArrayLike<number> | undefined, cap: number): Uint8Array[] | null {
  const out: Uint8Array[] = [];
  let over = false;
  search(values, cands, (s) => {
    if (out.length === cap) {
      over = true;
      return true;
    }
    out.push(s);
    return false;
  });
  return over ? null : out;
}

/**
 * Does the position have a solution at all; with `cell` and `digit`, one
 * with that digit there. Past `budget` search nodes it throws
 * OracleBudgetExceeded rather than answer.
 */
export function hasSolution(values: ArrayLike<number>, cands: ArrayLike<number> | undefined, cell?: number, digit?: number, budget = Infinity): boolean {
  let masks: ArrayLike<number> | undefined = cands;
  if (cell !== undefined && digit !== undefined) {
    if (values[cell]) return values[cell] === digit && hasSolution(values, cands, undefined, undefined, budget);
    const m = new Uint16Array(81);
    for (let i = 0; i < 81; i++) m[i] = cands ? cands[i] : ALL;
    m[cell] &= 1 << (digit - 1);
    masks = m;
  }
  let any = false;
  search(
    values,
    masks,
    () => {
      any = true;
      return true;
    },
    budget
  );
  return any;
}

/** does the position have a solution WITHOUT `digit` in `cell` */
export function hasSolutionWithout(values: ArrayLike<number>, cands: ArrayLike<number> | undefined, cell: number, digit: number, budget = Infinity): boolean {
  if (values[cell]) return values[cell] !== digit && hasSolution(values, cands, undefined, undefined, budget);
  const masks = new Uint16Array(81);
  for (let i = 0; i < 81; i++) masks[i] = cands ? cands[i] : ALL;
  masks[cell] &= ~(1 << (digit - 1));
  return hasSolution(values, masks, undefined, undefined, budget);
}

/**
 * What a set of solutions agrees on, cell by cell: `seen` is the mask of
 * digits some solution has there, `forced` the digit all of them have (0
 * where they differ).
 */
export interface Truth {
  count: number;
  seen: Uint16Array;
  forced: Uint8Array;
}

export function truthOf(solutions: Uint8Array[]): Truth {
  const seen = new Uint16Array(81);
  const forced = new Uint8Array(81);
  for (const s of solutions) for (let i = 0; i < 81; i++) seen[i] |= 1 << (s[i] - 1);
  for (let i = 0; i < 81; i++) if (solutions.length && bitCount(seen[i]) === 1) forced[i] = solutions[0][i];
  return { count: solutions.length, seen, forced };
}

/** a completed grid that keeps the rules: every row, column and box holds 1 to 9 once */
export function isValidSolution(s: ArrayLike<number>): boolean {
  for (let u = 0; u < 9; u++) {
    let r = 0;
    let c = 0;
    let b = 0;
    for (let k = 0; k < 9; k++) {
      const rd = s[u * 9 + k];
      const cd = s[k * 9 + u];
      const bd = s[(Math.floor(u / 3) * 3 + Math.floor(k / 3)) * 9 + (u % 3) * 3 + (k % 3)];
      if (rd < 1 || rd > 9 || cd < 1 || cd > 9 || bd < 1 || bd > 9) return false;
      r |= 1 << (rd - 1);
      c |= 1 << (cd - 1);
      b |= 1 << (bd - 1);
    }
    if (r !== ALL || c !== ALL || b !== ALL) return false;
  }
  return true;
}

/**
 * A second, deliberately naive counter to check the first against: cells
 * in index order, each digit tried by scanning the 20 peers, no masks, no
 * ordering heuristic, and its own arithmetic for rows, columns and boxes
 * (not the tables above), so a slip in those cannot hide in both. Only fit
 * for nearly full grids.
 */
export function naiveCount(values: ArrayLike<number>, cap = Infinity): number {
  const v = Array.from(values);
  const peers = (a: number, b: number) =>
    Math.floor(a / 9) === Math.floor(b / 9) ||
    a % 9 === b % 9 ||
    (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));
  const fits = (i: number, d: number) => {
    for (let k = 0; k < 81; k++) {
      if (k === i || v[k] !== d) continue;
      if (peers(k, i)) return false;
    }
    return true;
  };
  for (let i = 0; i < 81; i++) if (v[i] && !fits(i, v[i])) return 0;
  let count = 0;
  const rec = (i: number): void => {
    if (count >= cap) return;
    if (i === 81) {
      count++;
      return;
    }
    if (v[i]) return rec(i + 1);
    for (let d = 1; d <= 9; d++) {
      if (!fits(i, d)) continue;
      v[i] = d;
      rec(i + 1);
      v[i] = 0;
    }
  };
  rec(0);
  return count;
}
