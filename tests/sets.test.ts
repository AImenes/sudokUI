/**
 * Set equivalence (src/engine/sets.ts): every proof the engine gives must
 * be a true identity of cells, every "same digits" must hold in every
 * valid grid tried, every "they can differ" must come with a valid grid
 * that shows it, and the bookkeeping must count what is on the board.
 * Phistomefel's ring and the rows-against-columns construction are the
 * named cases; random sets of every size are the rest.
 */
import { describe, it, expect } from 'vitest';
import { compareSets, setLedgers, withoutOverlap, coverage, housesOf, SetVerdict } from '../src/engine/sets';
import { generateFullGrid } from '../src/engine/generator';

const cells = (pred: (r: number, c: number) => boolean) => [...Array(81).keys()].filter((i) => pred(Math.floor(i / 9), i % 9));
const rows = (...rs: number[]) => cells((r) => rs.includes(r + 1));
const cols = (...cs: number[]) => cells((_, c) => cs.includes(c + 1));
const corners = cells((r, c) => (r < 2 || r > 6) && (c < 2 || c > 6));
const ring = cells((r, c) => r >= 2 && r <= 6 && c >= 2 && c <= 6 && !(r >= 3 && r <= 5 && c >= 3 && c <= 5));

/** a stream of numbers the test can repeat */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = seeded(20261015);
const GRIDS = Array.from({ length: 300 }, () => generateFullGrid(rnd).values);
const digits = (grid: ArrayLike<number | string>, set: number[]) => set.map((i) => String(grid[i])).sort().join('');

/** a valid completed grid: every house holds 1 to 9 */
function isValidGrid(grid: string) {
  if (!/^[1-9]{81}$/.test(grid)) return false;
  for (let h = 0; h < 27; h++) {
    const inHouse = [...Array(81).keys()].filter((i) => housesOf(i).includes(h)).map((i) => grid[i]);
    if (new Set(inHouse).size !== 9) return false;
  }
  return true;
}

/** the checks every verdict must pass, whatever the sets */
function holdsTrue(a: number[], b: number[], v: SetVerdict) {
  const [A, B] = withoutOverlap(a, b);
  if (v.kind === 'same') {
    // the proof is a true identity of cells, and the houses balance
    expect(coverage(A, v.scale, v.withA)).toEqual(coverage(B, v.scale, v.withB));
    const count = (terms: { times: number }[]) => terms.reduce((s, x) => s + x.times, 0);
    expect(count(v.withA)).toBe(count(v.withB));
    // and so the digits agree in every grid
    for (const grid of GRIDS) expect(digits(grid, A)).toBe(digits(grid, B));
  }
  if (v.kind === 'differ') {
    expect(isValidGrid(v.grid)).toBe(true);
    expect(digits(v.grid, A)).not.toBe(digits(v.grid, B));
  }
  if (v.kind === 'sizes') expect(v.a).not.toBe(v.b);
}

describe('set equivalence', () => {
  it('proves Phistomefel’s ring with a handful of houses', () => {
    const v = compareSets(corners, ring);
    expect(v.kind).toBe('same');
    if (v.kind !== 'same') return;
    expect(v.scale).toBe(1);
    expect(v.withA.length + v.withB.length).toBeLessThanOrEqual(10);
    holdsTrue(corners, ring, v);
  });

  it('proves any rows against as many columns, overlaps cancelled, with exactly those houses', () => {
    for (const [rs, cs] of [
      [[2], [2]],
      [[1, 2], [1, 2]],
      [[2, 4, 6, 8], [2, 3, 7, 8]],
      [[1, 5, 9], [1, 5, 9]],
      [[7, 8, 9], [1, 5, 9]],
      [[1, 2, 3, 4, 5], [5, 6, 7, 8, 9]]
    ]) {
      const v = compareSets(rows(...rs), cols(...cs));
      expect(v.kind, `rows ${rs} against columns ${cs}`).toBe('same');
      if (v.kind !== 'same') continue;
      holdsTrue(rows(...rs), cols(...cs), v);
      // never longer than the textbook proof: the columns added to the
      // rows' side and the rows to the columns' side
      const houses = [...v.withA, ...v.withB].reduce((s, x) => s + x.times, 0);
      expect(houses, `rows ${rs} against columns ${cs}`).toBeLessThanOrEqual(rs.length + cs.length);
    }
    // and for the board's own construction it is exactly the textbook proof
    const v = compareSets(rows(2, 4, 6, 8), cols(2, 3, 7, 8));
    if (v.kind !== 'same') throw new Error('not proved');
    expect(v.withA.map((x) => x.house)).toEqual([10, 11, 15, 16]);
    expect(v.withB.map((x) => x.house)).toEqual([1, 3, 5, 7]);
  });

  it('says when sets can hold different digits, and shows the grid', () => {
    const shifted = [...new Set(ring.map((i) => (i % 9 === 8 ? i : i + 1)))];
    expect(shifted).toHaveLength(16);
    const v = compareSets(corners, shifted);
    expect(v.kind).toBe('differ');
    holdsTrue(corners, shifted, v);
  });

  it('counts a cell painted in both colours in neither', () => {
    // a row and a column share one cell: eight against eight
    const [A, B] = withoutOverlap(rows(2), cols(2));
    expect(A).toHaveLength(8);
    expect(B).toHaveLength(8);
    expect(A).not.toContain(10);
    expect(B).not.toContain(10);
    // the same cells in both sets leave nothing to compare
    expect(compareSets(rows(1), rows(1)).kind).toBe('empty');
    expect(compareSets(corners, []).kind).toBe('one');
    expect(compareSets(corners, ring.slice(1))).toEqual({ kind: 'sizes', a: 16, b: 15 });
  });

  it('never claims more than it shows, for random sets of every size', () => {
    const pick = seeded(7);
    const kinds = new Map<string, number>();
    for (let trial = 0; trial < 150; trial++) {
      const n = 1 + Math.floor(pick() * 30);
      const shuffled = [...Array(81).keys()].sort(() => pick() - 0.5);
      const a = shuffled.slice(0, n);
      const b = shuffled.slice(n, 2 * n);
      const v = compareSets(a, b);
      kinds.set(v.kind, (kinds.get(v.kind) ?? 0) + 1);
      holdsTrue(a, b, v);
    }
    // random sets are not equivalent, and a grid shows it every time
    expect(kinds.get('differ')).toBe(150);
  });

  it('proves sets built from houses in any way, and agrees with every grid', () => {
    const pick = seeded(11);
    for (let trial = 0; trial < 60; trial++) {
      // a random signed sum of houses that is a set difference: A = the
      // cells counted once on the plus side, B on the minus side
      const k = 1 + Math.floor(pick() * 4);
      const houses = [...Array(27).keys()].sort(() => pick() - 0.5);
      const plus = houses.slice(0, k);
      const minus = houses.slice(k, 2 * k);
      const count = new Array(81).fill(0);
      for (let i = 0; i < 81; i++) {
        for (const h of housesOf(i)) {
          if (plus.includes(h)) count[i]++;
          if (minus.includes(h)) count[i]--;
        }
      }
      if (count.some((x) => Math.abs(x) > 1)) continue;
      const a = count.flatMap((x, i) => (x === 1 ? [i] : []));
      const b = count.flatMap((x, i) => (x === -1 ? [i] : []));
      const v = compareSets(a, b);
      if (a.length === 0 && b.length === 0) {
        expect(v.kind).toBe('empty');
        continue;
      }
      expect(v.kind, `plus ${plus} minus ${minus}`).toBe('same');
      holdsTrue(a, b, v);
    }
  });
});

describe('the ledgers', () => {
  it('count the cells and the digits on the board, and what each set still needs', () => {
    const values = new Array(81).fill(0);
    // rows 2, 4, 6, 8 against columns 2, 3, 7, 8 on the screenshot's puzzle
    const P = '.5..9....1.....957......1.6.145.......87624.......853.3.1......986.....5....8..7.';
    for (let i = 0; i < 81; i++) values[i] = P[i] === '.' ? 0 : Number(P[i]);
    const [la, lb] = setLedgers(rows(2, 4, 6, 8), cols(2, 3, 7, 8), values);
    expect(la).toEqual({ size: 20, placed: [1, 5, 5, 7, 8, 9], empty: 14, needs: [1, 4] });
    expect(lb).toEqual({ size: 20, placed: [1, 1, 4, 5, 7, 8], empty: 14, needs: [5, 9] });
  });

  it('say when the empty cells are exactly what is needed, or fewer', () => {
    const values = new Array(81).fill(0);
    const A = [0, 1, 2];
    const B = [30, 31, 32];
    values[30] = 4;
    values[31] = 7;
    values[0] = 4;
    const [la, lb] = setLedgers(A, B, values);
    expect(la.needs).toEqual([7]);
    expect(la.empty).toBe(2);
    expect(lb.needs).toEqual([]);
    values[1] = 9;
    values[2] = 3;
    const [full] = setLedgers(A, B, values);
    // two digits owed (7 from B, and B owes 9 and 3 back), no empty cell left
    expect(full.empty).toBe(0);
    expect(full.needs).toEqual([7]);
  });
});
