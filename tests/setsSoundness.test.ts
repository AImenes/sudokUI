/**
 * The set tracker's soundness harness (src/engine/sets.ts, the line under
 * the board in src/ui/SetTracker.tsx, the colours in src/ui/Grid.tsx). A
 * false "these hold the same digits" is the worst thing the tracker could
 * say, so every verdict is checked against a referee written apart from the
 * module (tests/setsOracle.ts), which decides exactly, by the 46656 places a
 * digit can take, whether two sets hold the same digits in every grid:
 *  - every proof is recomputed cell by cell as an identity of houses, and
 *    the two sets, as painted and less their overlap, are counted in
 *    hundreds of valid grids from our own solver and sudoku's symmetries;
 *  - every "a valid grid fills them differently" grid is checked as a grid
 *    and as a counterexample, and "not proved" is checked to be the truth;
 *  - Phistomefel's ring, the ring with any cell moved, rows against
 *    columns, sets built from random signed sums of houses (with and
 *    without cells painted in both colours), sets one cell apart, random
 *    sets, empty sets and a set against itself all get a verdict the
 *    referee agrees with, and every pair the referee calls equal is proved;
 *  - no proof ever needs a scale (a theorem, checked here), and every
 *    proof so far counts each house once: the "×2" and "counted 2 times"
 *    the tracker can write are pinned out of reach, and rendered on their
 *    own in tests/setsRareLines.test.ts with "not proved";
 *  - the ledgers are recounted on boards with givens and placed digits,
 *    and what they say each set needs is checked against the solution;
 *  - and what the player reads (the line, the proof under Why?, in all
 *    three languages, on empty boards, boards being solved and boards with
 *    a wrong digit, in the default colours and others, and the colours on
 *    the board) is rendered, read back (tests/setsReader.ts) and checked to
 *    say no more than was proved. A list drawn from a wrong digit is held
 *    to the board's own completions where it has any, and counted where it
 *    is false of the solution.
 * Two KNOWN FINDINGs are kept at the end as it.fails, each with the
 * property it breaks. What a server rendering cannot show (the line
 * updated as cells are repainted and digits placed, the real Why? button,
 * the swatches' colours as the browser draws them) is in the browser smoke
 * test, tests/e2e/smoke.spec.ts, "the set tracker". The long run of the same
 * checks (tens of thousands of pairs and grids) lives outside the
 * repository; this is the part fast enough for every run.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compareSets, setLedgers, withoutOverlap, coverage, SetVerdict } from '../src/engine/sets';
import { Grid, PALETTE } from '../src/ui/Grid';
import { useSettings } from '../src/state/settings';
import { loadLocale } from '../src/content/i18n';
import { setEngineText } from '../src/engine/text';
import * as O from './setsOracle';
import { Lang, LINES, Shown, show, paint, inLang, withColours, otherColour, readHouses, readSwatches, readsTrue, tally } from './setsReader';

// The proof under Why? opens on a click, and there is no DOM to click in:
// while a test asks for it, the tracker's one boolean state starts open.
vi.mock('react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & { default?: Record<string, unknown> };
  const base = (actual.default ?? actual) as typeof import('react');
  const useState = ((init: unknown) =>
    base.useState((globalThis as { __openSetProof?: boolean }).__openSetProof && init === false ? true : init)) as typeof base.useState;
  return { ...actual, ...base, useState, default: { ...base, useState } };
});

// ---- the grids every proof is counted in -----------------------------------------

const GRIDS = O.makeGrids(400, 20261023);

/** what every verdict is held to; returns its kind */
const verdicts = new Map<string, number>();
const misses: string[] = [];
function check(a: number[], b: number[], label: string): SetVerdict {
  const v = compareSets(a, b);
  const truth = O.truthOf(a, b, O.rngFrom(a.length * 7919 + b.length));
  const { A, B } = truth;
  const what = `${label}: A=[${A}] B=[${B}] verdict ${JSON.stringify(v)}`;
  verdicts.set(v.kind, (verdicts.get(v.kind) ?? 0) + 1);
  // the module's own reading of the overlap is the referee's
  expect(withoutOverlap(a, b), what).toEqual([A, B]);
  switch (v.kind) {
    case 'empty':
      expect(A.length + B.length, what).toBe(0);
      break;
    case 'one':
      expect(A.length === 0 !== (B.length === 0), what).toBe(true);
      break;
    case 'sizes':
      expect([v.a, v.b], what).toEqual([A.length, B.length]);
      expect(v.a, what).not.toBe(v.b);
      expect(truth.same, what).toBe(false);
      break;
    case 'same': {
      // the worst outcome: a proof of something false
      expect(truth.same, `FALSE "SAME DIGITS" ${what}`).toBe(true);
      expect(O.proofFault(A, B, v.scale, v.withA, v.withB), what).toBeNull();
      const sideA = new Set(v.withA.map((t) => t.house));
      expect(v.withB.some((t) => sideA.has(t.house)), `a house on both sides: ${what}`).toBe(false);
      expect(v.withA.length > 0 && v.withB.length > 0, what).toBe(true);
      // the module's own count of what each side covers is the referee's
      expect(coverage(A, v.scale, v.withA), what).toEqual(O.coverCount(A, v.scale, v.withA));
      expect(coverage(B, v.scale, v.withB), what).toEqual(O.coverCount(B, v.scale, v.withB));
      // Pinned: no proof has needed a scale (a theorem below) or a house
      // counted twice, so the tracker has never drawn "×2" or "counted 2
      // times" for a real pair. A change that reaches them must be read by
      // a person first: tests/setsRareLines.test.ts shows how they read.
      expect(v.scale, `a proof with a scale: ${what}`).toBe(1);
      expect([...v.withA, ...v.withB].every((t) => t.times === 1), `a house counted more than once: ${what}`).toBe(true);
      // and so in every grid, as painted and less the overlap alike
      for (const g of GRIDS) {
        if (!O.sameDigits(g, A, B) || !O.sameDigits(g, new Set(a), new Set(b))) {
          throw new Error(`FALSE "SAME DIGITS" in grid ${Array.from(g).join('')}: ${what}`);
        }
      }
      break;
    }
    case 'differ': {
      const g = O.gridOf(v.grid);
      expect(O.isValidGrid(g), `not a valid grid: ${what}`).toBe(true);
      expect(O.sameDigits(g, A, B), `the grid does not tell them apart: ${what}`).toBe(false);
      expect(O.sameDigits(g, new Set(a), new Set(b)), `the grid does not tell the painted sets apart: ${what}`).toBe(false);
      expect(truth.same, what).toBe(false);
      break;
    }
    case 'unproved':
      // claims nothing, but the referee says whether a proof or a grid was missed
      misses.push(`${truth.same ? 'missed proof' : 'missed counterexample'} (${truth.imbalance} patterns tell them apart): ${what}`);
      break;
  }
  // every pair the referee calls equal is proved (a miss would be a weakness, not a falsehood)
  if (truth.same && A.length) {
    if (v.kind !== 'same') misses.push(`missed proof: ${what}`);
  }
  return v;
}

describe('the referee', () => {
  it('lists every place a digit can take, one cell in each row, column and box', () => {
    expect(O.PATTERNS.length).toBe(9 * O.PATTERN_COUNT);
    let bad = 0;
    for (let p = 0; p < O.PATTERN_COUNT; p++) {
      // one cell per row by construction; and every column and box once
      let cols = 0;
      let boxes = 0;
      for (const i of O.patternCells(p)) {
        cols |= 1 << i % 9;
        boxes |= 1 << (Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3));
      }
      if (cols !== 511 || boxes !== 511) bad++;
    }
    expect(bad).toBe(0);
    for (let p = 0; p < O.PATTERN_COUNT; p += 997) {
      const cells = O.patternCells(p);
      for (const house of O.HOUSE_CELLS) expect(cells.filter((i) => house.includes(i))).toHaveLength(1);
    }
    expect(new Set(Array.from({ length: 2000 }, (_, k) => O.patternCells(k * 23).join())).size).toBe(2000);
  });

  it('makes only valid grids, varied ones, and finds each digit of every one among the patterns', () => {
    for (const g of GRIDS) expect(O.isValidGrid(g)).toBe(true);
    expect(new Set(GRIDS.map((g) => Array.from(g).join(''))).size).toBeGreaterThan(390);
    let found = 0;
    for (const g of GRIDS) {
      for (let d = 1; d <= 9; d++) if (O.patternIndex([...Array(81).keys()].filter((i) => g[i] === d)) >= 0) found++;
    }
    expect(found).toBe(GRIDS.length * 9);
    // and its grid checker is not easily pleased
    const g = Uint8Array.from(GRIDS[0]);
    [g[0], g[1]] = [g[1], g[0]];
    expect(O.isValidGrid(g)).toBe(false);
    expect(O.isValidGrid(GRIDS[0].map((d) => (d === 9 ? 0 : d)))).toBe(false);
    expect(O.isValidGrid(GRIDS[0].slice(1))).toBe(false);
    expect(O.solveBoard(Uint8Array.from({ length: 81 }, (_, i) => (i < 2 ? 5 : 0)))).toBeNull();
  });

  it('knows the named cases before it judges anything', () => {
    expect(O.truthOf(O.CORNERS, O.RING).same).toBe(true);
    expect(O.truthOf(O.rowsOf(2, 4, 6, 8), O.colsOf(2, 3, 7, 8)).same).toBe(true);
    expect(O.truthOf(O.boxesOf(1), O.rowsOf(1, 2, 3).filter((i) => i % 9 < 3)).same).toBe(true);
    const single = O.truthOf([0], [40]);
    expect(single.same).toBe(false);
    expect(O.isValidGrid(single.witness!)).toBe(true);
    expect(single.witness![0]).not.toBe(single.witness![40]);
    expect(O.truthOf([0, 1], [40]).same).toBe(false);
    expect(O.truthOf([5, 6], [6, 5]).same).toBe(true);
    // the textbook proof of the ring, written out by hand: the corners with
    // the eight outer boxes cover what the ring covers with rows and
    // columns 1, 2, 8 and 9
    const boxes = [1, 2, 3, 4, 6, 7, 8, 9].map((b) => ({ house: 17 + b, times: 1 }));
    const lines = [0, 1, 7, 8].flatMap((k) => [{ house: k, times: 1 }, { house: 9 + k, times: 1 }]);
    expect(O.proofFault(O.CORNERS, O.RING, 1, boxes, lines)).toBeNull();
    expect(O.proofFault(O.CORNERS, O.RING, 1, [...boxes.slice(1), { house: 22, times: 1 }], lines)).not.toBeNull();
    expect(O.proofFault(O.CORNERS, O.RING, 2, boxes, lines)).not.toBeNull();
    // the same proof doubled holds at scale 2, and counts each cell twice on each side
    const twice = (ts: O.TermLike[]) => ts.map((t) => ({ ...t, times: 2 }));
    expect(O.proofFault(O.CORNERS, O.RING, 2, twice(boxes), twice(lines))).toBeNull();
    expect(O.coverCount(O.CORNERS, 2, twice(boxes))).toEqual(O.coverCount(O.CORNERS, 1, boxes).map((x) => 2 * x));
    // and the same sum of houses gives back the ring and its corners
    const coef = new Array(27).fill(0);
    for (const t of lines) coef[t.house] = 1;
    for (const t of boxes) coef[t.house] = -1;
    expect(O.setsFromHouses(coef)).toEqual({ a: O.CORNERS, b: O.RING, scale: 1 });
  });

  it('owes nothing to the patterns: sudoku’s only linear facts are its houses', () => {
    // Over a prime field the patterns reach rank 61, and the houses with
    // their six band and stack identities leave room for no more (81
    // cells less 20 balanced sums of houses). So a pair the houses cannot
    // link always has a grid that tells it apart: "not proved" is never
    // the truth about two equal sets, only a grid not found.
    const P = 2147483629;
    const basis: { lead: number; v: number[] }[] = [];
    const mod = (x: number) => ((x % P) + P) % P;
    const mulmod = (x: number, y: number) => Number((BigInt(x) * BigInt(y)) % BigInt(P));
    const inv = (x: number) => {
      let [r, newR, t, newT] = [BigInt(P), BigInt(x), 0n, 1n];
      while (newR) {
        const q = r / newR;
        [r, newR] = [newR, r - q * newR];
        [t, newT] = [newT, t - q * newT];
      }
      return Number(((t % BigInt(P)) + BigInt(P)) % BigInt(P));
    };
    const insert = (cells: number[]) => {
      const v = new Array(81).fill(0);
      for (const i of cells) v[i] = 1;
      for (const { lead, v: b } of basis) {
        if (!v[lead]) continue;
        const f = v[lead];
        for (let j = 0; j < 81; j++) if (b[j]) v[j] = mod(v[j] - mulmod(f, b[j]));
      }
      const lead = v.findIndex((x) => x !== 0);
      if (lead < 0) return;
      const s = inv(v[lead]);
      for (let j = 0; j < 81; j++) v[j] = mulmod(v[j], s);
      basis.push({ lead, v });
    };
    for (let p = 0; p < O.PATTERN_COUNT && basis.length < 62; p++) insert(O.patternCells(p));
    expect(basis.length).toBe(61);
    basis.length = 0;
    for (const house of O.HOUSE_CELLS) insert(house);
    expect(basis.length).toBe(21);
  });

  it('needs no scale for any proof: the balanced sums of houses miss no whole vector in their span', () => {
    // the diagonaliser on cases worked by hand: as many entries as the
    // rank, and their product the gcd of the largest nonzero minors
    const big = (rows: number[][]) => rows.map((r) => r.map(BigInt));
    const shape = (rows: number[][]) => {
      const d = O.integerDiagonal(big(rows));
      return { rank: d.length, product: d.reduce((p, x) => p * x, 1n) };
    };
    expect(shape([[2, 0], [0, 3]])).toEqual({ rank: 2, product: 6n });
    expect(shape([[2, 4], [6, 8]])).toEqual({ rank: 2, product: 8n });
    expect(shape([[1, 2], [3, 5]])).toEqual({ rank: 2, product: 1n });
    expect(shape([[2, 4, 6], [4, 8, 12]])).toEqual({ rank: 1, product: 2n });
    expect(shape([[0, 0], [0, 0]])).toEqual({ rank: 0, product: 1n });
    // (1, 1, 0) and (1, -1, 0) span (2, 0, 0) and not (1, 0, 0): a lattice with a hole
    expect(shape([[1, 1], [1, -1], [0, 0]])).toEqual({ rank: 2, product: 2n });
    expect(shape([[1, 0], [1, 1], [0, 1]])).toEqual({ rank: 2, product: 1n });
    // The 26 differences "house h less row 1" span every balanced sum of
    // houses (coefficients adding to 0). Brought to a diagonal they leave
    // twenty 1s and nothing else: rank 20, and every whole vector that is a
    // rational balanced sum is a whole one. So whenever scale x (A - B) is
    // a balanced sum of houses, A - B already is one: "×2" is never needed.
    const columns = Array.from({ length: 26 }, (_, k) => Array.from({ length: 81 }, (_, i) => BigInt(O.HOUSE_IND[k + 1][i] - O.HOUSE_IND[0][i])));
    const matrix = Array.from({ length: 81 }, (_, i) => columns.map((c) => c[i]));
    expect(O.integerDiagonal(matrix)).toEqual(new Array(20).fill(1n));
  });
});

describe('every verdict, against the referee', () => {
  afterAll(() => {
    // eslint-disable-next-line no-console
    console.info('set verdicts:', JSON.stringify(Object.fromEntries(verdicts)), 'misses:', misses.length);
  });

  it('proves Phistomefel’s ring and rows against columns, either way round', () => {
    expect(check(O.CORNERS, O.RING, 'ring').kind).toBe('same');
    expect(check(O.RING, O.CORNERS, 'ring swapped').kind).toBe('same');
    const pick = O.rngFrom(31);
    for (let trial = 0; trial < 120; trial++) {
      const k = 1 + O.randInt(pick, 9);
      const rs = O.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], pick).slice(0, k);
      const cs = O.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], pick).slice(0, k);
      const v = check(O.rowsOf(...rs), O.colsOf(...cs), `rows ${rs} against columns ${cs}`);
      // all nine rows against all nine columns is the whole board twice: nothing left
      expect(v.kind).toBe(k === 9 ? 'empty' : 'same');
      // a different number of columns: different sizes
      const m = 1 + ((k + O.randInt(pick, 8)) % 9);
      if (m !== k) {
        const other = check(O.rowsOf(...rs), O.colsOf(...O.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], pick).slice(0, m)), 'k rows, m columns');
        // all nine of either covers the other: one set is left
        expect(other.kind).toBe(k === 9 || m === 9 ? 'one' : 'sizes');
      }
    }
    expect(misses).toEqual([]);
  });

  it('proves each house against row 1 at scale 1, so no proof is ever scaled', () => {
    // compareSets finds its coefficients by an elimination whose steps
    // never look at the two sets (only at which houses hold which cells),
    // so they are a fixed linear function of A - B. Whole on these 26
    // generators of the balanced sums (the test above: they reach every
    // pair a proof exists for), they are whole for every pair, and the
    // scale is 1. check() holds every proof to that as well.
    for (let h = 1; h < 27; h++) {
      const v = check(O.HOUSE_CELLS[h], O.HOUSE_CELLS[0], `${O.houseName(h)} against row 1`);
      expect(v.kind).toBe('same');
    }
  });

  it('never proves the ring with any one cell moved anywhere else', () => {
    // every cell of the ring, each to twelve places of the 65 outside it
    // (all 1040 moves in the long run)
    const pick = O.rngFrom(37);
    for (const from of O.RING) {
      const outside = [...Array(81).keys()].filter((i) => !O.RING.includes(i));
      for (const to of O.shuffled(outside, pick).slice(0, 12)) {
        const moved = [...O.RING.filter((i) => i !== from), to];
        const v = check(O.CORNERS, moved, `ring r${Math.floor(from / 9) + 1}c${(from % 9) + 1} moved to r${Math.floor(to / 9) + 1}c${(to % 9) + 1}`);
        // moved onto a corner, that cell counts in neither: fifteen against fifteen, still different
        expect(v.kind).toBe('differ');
      }
    }
    expect(misses).toEqual([]);
  });

  it('proves every pair built from a signed sum of houses, with cells in both colours or not', () => {
    const pick = O.rngFrom(47);
    let built = 0;
    for (let trial = 0; built < 150 && trial < 5000; trial++) {
      const made = O.setsFromHouses(O.randomHouseSum(pick, 1 + O.randInt(pick, 6)));
      if (!made || !made.a.length) continue;
      built++;
      // cells outside both sets painted in both colours change nothing
      const free = [...Array(81).keys()].filter((i) => !made.a.includes(i) && !made.b.includes(i));
      const both = O.shuffled(free, pick).slice(0, O.randInt(pick, 12));
      const a = O.shuffled([...made.a, ...both], pick);
      const b = O.shuffled([...made.b, ...both], pick);
      const v = check(a, b, `built ${made.a.length} against ${made.b.length}`);
      expect(v.kind).toBe('same');
      // and one cell of the second set moved to a cell in neither breaks it
      if (free.length) {
        const from = made.b[O.randInt(pick, made.b.length)];
        const to = free[O.randInt(pick, free.length)];
        expect(check(made.a, [...made.b.filter((i) => i !== from), to], 'built, one cell moved').kind).toBe('differ');
      }
    }
    expect(built).toBe(150);
    expect(misses).toEqual([]);
  });

  it('proves pairs built at scale 2 and 3 without a scale', () => {
    // houses counted up to three times on a side: the cells where the sum
    // is +s and -s, s up to 3, are still proved with each house once
    const pick = O.rngFrom(43);
    let built = 0;
    const scales = new Set<number>();
    for (let trial = 0; built < 60 && trial < 200000; trial++) {
      const coef = new Array(27).fill(0);
      for (let j = 1 + O.randInt(pick, 6); j > 0; j--) {
        const w = 1 + O.randInt(pick, 3);
        coef[O.randInt(pick, 27)] += w;
        coef[O.randInt(pick, 27)] -= w;
      }
      const made = O.setsFromHouses(coef);
      if (!made || !made.a.length || made.scale === 1) continue;
      built++;
      scales.add(made.scale);
      expect(check(made.a, made.b, `built at scale ${made.scale}`).kind).toBe('same');
    }
    expect(built).toBe(60);
    expect(scales.has(2) && scales.has(3)).toBe(true);
    expect(misses).toEqual([]);
  });

  it('proves two rows and a box against two columns and a box, and every such mix', () => {
    const pick = O.rngFrom(53);
    let built = 0;
    for (let trial = 0; trial < 4000 && built < 150; trial++) {
      // rows and a box on one side, columns and a box on the other
      const coef = new Array(27).fill(0);
      const n = 1 + O.randInt(pick, 3);
      for (const r of O.shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8], pick).slice(0, n)) coef[r] += 1;
      for (const c of O.shuffled([0, 1, 2, 3, 4, 5, 6, 7, 8], pick).slice(0, n)) coef[9 + c] -= 1;
      const [bx, by] = [18 + O.randInt(pick, 9), 18 + O.randInt(pick, 9)];
      coef[bx] += 1;
      coef[by] -= 1;
      const made = O.setsFromHouses(coef);
      if (!made || !made.a.length) continue;
      built++;
      expect(check(made.a, made.b, `rows+box against columns+box, scale ${made.scale}`).kind).toBe('same');
    }
    expect(built).toBeGreaterThan(50);
    expect(misses).toEqual([]);
  });

  it('tells random sets of every size apart with a grid, and never proves them', () => {
    const pick = O.rngFrom(59);
    for (let trial = 0; trial < 150; trial++) {
      const n = 1 + O.randInt(pick, 40);
      const cells = O.shuffled([...Array(81).keys()], pick);
      const overlap = O.randInt(pick, 4);
      const a = cells.slice(0, n + overlap);
      const b = [...cells.slice(n, n + overlap), ...cells.slice(n + overlap, 2 * n + overlap)];
      check(a, b, `random ${n}`);
      // and of different sizes
      check(a, cells.slice(n + overlap, n + overlap + 1 + O.randInt(pick, 30)), 'random sizes');
    }
    expect(misses).toEqual([]);
  });

  it('says nothing of empty sets, a set against itself, or a set inside the other', () => {
    expect(check([], [], 'empty').kind).toBe('empty');
    expect(check(O.RING, O.RING, 'itself').kind).toBe('empty');
    expect(check(O.RING, [...O.RING].reverse(), 'itself reversed').kind).toBe('empty');
    expect(check(O.RING, [], 'one').kind).toBe('one');
    expect(check([], O.RING, 'other').kind).toBe('one');
    expect(check(O.RING, O.RING.slice(3), 'inside').kind).toBe('one');
    expect(check([0, 0, 1], [40, 41, 41], 'cells listed twice').kind).toBe('differ');
    expect(check([0], [0, 1], 'one cell beyond').kind).toBe('one');
  });
});

// ---- the ledgers -----------------------------------------------------------------

/** a board consistent with a solution: some of its digits, the rest empty */
function partialBoard(solution: Uint8Array, rng: O.Rng, fill: number): Uint8Array {
  return solution.map((d) => (rng() < fill ? d : 0));
}

describe('the ledgers', () => {
  it('count each set’s cells, digits and needs as the referee does, on random boards', () => {
    const pick = O.rngFrom(61);
    for (let trial = 0; trial < 400; trial++) {
      const solution = GRIDS[trial % GRIDS.length];
      const values = partialBoard(solution, pick, pick());
      const cells = O.shuffled([...Array(81).keys()], pick);
      const n = O.randInt(pick, 30);
      const a = cells.slice(0, n);
      const b = cells.slice(n - O.randInt(pick, Math.min(n, 5) + 1), n + O.randInt(pick, 30));
      expect(setLedgers(a, b, values), `A=[${a}] B=[${b}]`).toEqual(O.ledgerTruth(a, b, values));
    }
  });

  it('only ever say a set needs digits its empty cells really hold, when the sets are proved equal', () => {
    const pick = O.rngFrom(67);
    let exact = 0;
    let needs = 0;
    for (let trial = 0, built = 0; built < 200 && trial < 5000; trial++) {
      const made = O.setsFromHouses(O.randomHouseSum(pick, 1 + O.randInt(pick, 5)));
      if (!made || !made.a.length) continue;
      built++;
      const solution = GRIDS[built % GRIDS.length];
      const values = partialBoard(solution, pick, pick());
      if (built % 10 === 0) expect(compareSets(made.a, made.b).kind).toBe('same');
      const ledgers = setLedgers(made.a, made.b, values);
      ledgers.forEach((l, side) => {
        const set = side ? made.b : made.a;
        const holds = set.filter((i) => !values[i]).map((i) => solution[i]);
        // a board consistent with a solution is never called impossible
        expect(l.needs.length).toBeLessThanOrEqual(l.empty);
        expect(O.within(l.needs, holds), `needs ${l.needs}, empty cells hold ${holds}`).toBe(true);
        if (l.needs.length) needs++;
        if (l.needs.length && l.needs.length === l.empty) {
          exact++;
          expect([...holds].sort()).toEqual(l.needs);
        }
      });
    }
    expect(needs).toBeGreaterThan(100);
    expect(exact).toBeGreaterThan(10);
  });
});

// ---- what the player reads ----------------------------------------------------------

/** the daily of 2026-10-07, which has one solution */
const PUZZLE = '9.5.1...84....8..7...4...2..9.14...2..23.98..1...87.5..8...4...3..9....67...2.4.3';
const SOLUTION = O.solveBoard(O.gridOf(PUZZLE))!;

describe('what the player reads', () => {
  beforeAll(async () => {
    await loadLocale('nb');
    await loadLocale('es');
  });
  afterAll(() => {
    useSettings.getState().set({ lang: 'en', setTracker: false });
    setEngineText('en', null);
    // eslint-disable-next-line no-console
    console.info('what the tracker said, read back:', JSON.stringify(Object.fromEntries(tally)));
    for (const lang of ['en', 'nb', 'es'] as const) {
      expect(tally.get(`${lang} proofs read back`), lang).toBeGreaterThan(lang === 'en' ? 80 : 15);
      expect(tally.get(`${lang} lists checked against the solution`), lang).toBeGreaterThan(lang === 'en' ? 40 : 10);
      expect(tally.get(`${lang} "exactly" lists checked against the solution`), lang).toBeGreaterThan(0);
      expect(tally.get(`${lang} a digit is wrong`), lang).toBeGreaterThan(0);
      for (const kind of ['one', 'sizes', 'differ', 'same']) expect(tally.get(`${lang} line ${kind}`), `${lang} ${kind}`).toBeGreaterThan(0);
      // lists drawn from a wrong digit: held to the board's completions where it has any
      expect(tally.get(`${lang} lists on a board with a wrong digit`), lang).toBeGreaterThan(lang === 'en' ? 150 : 60);
      expect(tally.get(`${lang} lists on a board with a wrong digit, checked on a completion of it`), lang).toBeGreaterThan(lang === 'en' ? 250 : 100);
    }
  });

  /** pairs of every kind: proved, built, moved, random, nested, empty */
  function pairs(seed: number, n: number): [number[], number[]][] {
    const pick = O.rngFrom(seed);
    const out: [number[], number[]][] = [
      [O.CORNERS, O.RING],
      [O.rowsOf(2, 4, 6, 8), O.colsOf(2, 3, 7, 8)],
      [O.CORNERS, O.RING.slice(1)],
      [O.RING, []],
      [O.RING, O.RING],
      [O.RING, O.RING.slice(5)]
    ];
    while (out.length < n) {
      const kind = O.randInt(pick, 5);
      if (kind < 3) {
        let made = O.setsFromHouses(O.randomHouseSum(pick, 1 + O.randInt(pick, 6)));
        while (!made || !made.a.length) made = O.setsFromHouses(O.randomHouseSum(pick, 1 + O.randInt(pick, 6)));
        // cells in both colours: outside the two sets, or (the last kind) anywhere, which can break them
        const free = [...Array(81).keys()].filter((i) => kind === 2 || (!made.a.includes(i) && !made.b.includes(i)));
        const both = O.shuffled(free, pick).slice(0, O.randInt(pick, 6));
        out.push([[...made.a, ...both], [...made.b, ...both]]);
      } else {
        const cells = O.shuffled([...Array(81).keys()], pick);
        const k = 1 + O.randInt(pick, 20);
        out.push([cells.slice(0, k), cells.slice(k - O.randInt(pick, 3), 2 * k + (kind === 4 ? O.randInt(pick, 3) : 0))]);
      }
    }
    return out;
  }

  /** the daily, part solved: its givens and some of its other digits */
  const partSolved = (pick: O.Rng, share: number) => SOLUTION.map((d, i) => (PUZZLE[i] !== '.' || pick() < share ? d : 0));

  /**
   * A board where a proved pair cannot be completed: row 1 and column 1
   * (they share r1c1) full of the solution's digits but for r1c1, and r5c1
   * holding r1c1's 9 instead of its 6. Each set then holds a digit the other
   * has no room for, and no digit on the board repeats in a house.
   */
  function overfull(): Uint8Array {
    const v = new Uint8Array(81);
    for (let k = 1; k < 9; k++) {
      v[k] = SOLUTION[k];
      v[9 * k] = SOLUTION[9 * k];
    }
    v[36] = SOLUTION[0];
    return v;
  }

  it('reads a proof back as a solver would, and a wrong house in it breaks it', () => {
    inLang('en');
    const terms = (s: string, lang: Lang) => readHouses(s, lang).map((t) => `${t.house}x${t.times}`);
    expect(terms('rows 1, 2 and 8, column 3 and boxes 4 and 5 counted 2 times', 'en')).toEqual(['0x1', '1x1', '7x1', '11x1', '21x2', '22x2']);
    expect(terms('rows 1 and 2 counted 2 times and row 9', 'en')).toEqual(['0x2', '1x2', '8x1']);
    expect(terms('radene 1 og 2, 2 ganger og boks 9', 'nb')).toEqual(['0x2', '1x2', '26x1']);
    expect(terms('las filas 1, 4 y 7, la columna 2 y las cajas 3 y 9, 3 veces', 'es')).toEqual(['0x1', '3x1', '6x1', '10x1', '20x3', '26x3']);
    // read the other way, a count covers every group since the last one
    expect(readHouses('rows 1 and 2 and boxes 4 and 5 counted 2 times', 'en', 'run').map((t) => `${t.house}x${t.times}`)).toEqual(['0x2', '1x2', '21x2', '22x2']);
    expect(() => readHouses('rows 1 and 2 and 3 cells', 'en')).toThrow();
    // the ring's proof as the tracker writes it, and the same with box 8 written as box 7
    const ring = show(O.CORNERS, O.RING);
    const [, , withA, , withB] = LINES.en.sentence.exec(ring.proof!)!;
    expect(withA).toContain('box');
    expect(O.proofFault(O.CORNERS, O.RING, 1, readHouses(withA, 'en'), readHouses(withB, 'en'))).toBeNull();
    expect(O.proofFault(O.CORNERS, O.RING, 1, readHouses(withA.replace(/8$/, '7'), 'en'), readHouses(withB, 'en'))).not.toBeNull();
    // and the board above: no completion, and the line says a digit is wrong
    expect(O.solveBoard(overfull())).toBeNull();
    expect(show(O.rowsOf(1), O.colsOf(1), overfull()).verdict).toBe(LINES.en.wrong);
  });

  it('reads every swatch by the colour it is drawn in, and refuses one labelled as another', () => {
    inLang('en');
    const [ca, cb] = useSettings.getState().setColors;
    const swatch = (colour: number, label: string) => `<span class="set-swatch" style="background:${PALETTE[colour]}" role="img" aria-label="${label}"></span>`;
    expect(readSwatches(`${swatch(ca, `Colour ${ca + 1}`)} with ${swatch(cb, `Colour ${cb + 1}`)}`, 'en')).toBe('[A] with [B]');
    // drawn in one set's colour and labelled with the other's, labelled in
    // another language, in neither set's colour, or written some other way
    expect(() => readSwatches(swatch(ca, `Colour ${cb + 1}`), 'en')).toThrow();
    expect(() => readSwatches(swatch(ca, `Farge ${ca + 1}`), 'en')).toThrow();
    expect(() => readSwatches(swatch(otherColour(), `Colour ${otherColour() + 1}`), 'en')).toThrow();
    expect(() => readSwatches('<span class="set-swatch" role="img"></span>', 'en')).toThrow();
    // and the tracker writes its swatches the way the reader reads them
    const ring = show(O.CORNERS, O.RING);
    expect(ring.html).toContain(swatch(ca, `Colour ${ca + 1}`));
    expect(ring.html).toContain(swatch(cb, `Colour ${cb + 1}`));
    expect(ring.sides.map((s) => s.colour)).toEqual(['[A]', '[B]']);
    expect(ring.proof).toMatch(/^\[A\] with .* covers the same cells as \[B\] with /);
  });

  it('is not easily pleased: a rendering that says one thing more, or another, is refused', () => {
    const refused = (a: number[], b: number[], shown: Shown, lang: Lang, values?: Uint8Array) => expect(() => readsTrue(a, b, shown, lang, values, values && SOLUTION)).toThrow();
    for (const lang of ['en', 'nb'] as const) {
      inLang(lang);
      const L = LINES[lang];
      // the ring, proved: called different, the proof with a house changed, its button or class gone, its sides swapped
      const ring = show(O.CORNERS, O.RING);
      readsTrue(O.CORNERS, O.RING, ring, lang);
      refused(O.CORNERS, O.RING, { ...ring, verdict: L.differ }, lang);
      const changed = ring.proof!.replace(/(\d+)( covers| dekker)/, (_, d: string, rest: string) => `${(Number(d) % 9) + 1}${rest}`);
      expect(changed).not.toBe(ring.proof);
      refused(O.CORNERS, O.RING, { ...ring, proof: changed }, lang);
      refused(O.CORNERS, O.RING, { ...ring, why: null }, lang);
      refused(O.CORNERS, O.RING, { ...ring, proved: false }, lang);
      refused(O.CORNERS, O.RING, { ...ring, sides: [...ring.sides].reverse() }, lang);
      // one ring cell moved: called the same, or given a proof
      const moved = [...O.RING.slice(1), 3];
      const differ = show(O.CORNERS, moved);
      readsTrue(O.CORNERS, moved, differ, lang);
      refused(O.CORNERS, moved, { ...differ, verdict: L.proved }, lang);
      refused(O.CORNERS, moved, { ...differ, verdict: L.unproved }, lang);
      refused(O.CORNERS, moved, { ...differ, why: ring.why, proof: ring.proof }, lang);
      // row 2 against column 2 with row 2's digits placed: column 2's list, its lead-in and its digits
      const row2 = SOLUTION.map((d, i) => (Math.floor(i / 9) === 1 ? d : 0));
      const listed = show(O.rowsOf(2), O.colsOf(2), row2);
      readsTrue(O.rowsOf(2), O.colsOf(2), listed, lang, row2, SOLUTION);
      const side = (text: string) => ({ ...listed, sides: [listed.sides[0], { ...listed.sides[1], text }] });
      refused(O.rowsOf(2), O.colsOf(2), side(listed.sides[1].text.replace(L.exactly, L.stillNeeds)), lang, row2);
      refused(O.rowsOf(2), O.colsOf(2), side(listed.sides[1].text.replace(/\d$/, (d) => String((Number(d) % 9) + 1))), lang, row2);
      expect(listed.sides[1].text).toContain(`, ${L.exactly} `);
      refused(O.rowsOf(2), O.colsOf(2), side(listed.sides[1].text.slice(0, listed.sides[1].text.indexOf(`, ${L.exactly} `))), lang, row2);
      // the ask for the other set, naming the colour that has cells
      const one = show(O.RING, []);
      readsTrue(O.RING, [], one, lang);
      refused(O.RING, [], { ...one, verdict: one.verdict.replace('[B]', '[A]') }, lang);
    }
    inLang('en');
  });

  it('says no more than was proved, in English, on empty boards and on boards being solved', () => {
    inLang('en');
    const pick = O.rngFrom(71);
    for (const [a, b] of pairs(73, 120)) {
      readsTrue(a, b, show(a, b), 'en');
      // the same sets on the daily, part solved: the ledgers read the board
      const values = partSolved(pick, 0.4);
      readsTrue(a, b, show(a, b, values), 'en', values, SOLUTION);
    }
  });

  it('says a digit is wrong only when the board has no completion, and lists hold in every completion left', () => {
    inLang('en');
    const pick = O.rngFrom(79);
    let wrong = 0;
    for (const [a, b] of pairs(83, 120)) {
      // a board with one digit changed somewhere
      const values = partSolved(pick, 0.5);
      const i = O.randInt(pick, 81);
      values[i] = 1 + ((SOLUTION[i] + O.randInt(pick, 8)) % 9);
      const shown = show(a, b, values);
      if (shown.verdict === LINES.en.wrong) wrong++;
      readsTrue(a, b, shown, 'en', values, SOLUTION);
    }
    expect(wrong).toBeGreaterThan(0);
  });

  /**
   * Some digits of the grid with two of its digits swapped (itself a valid
   * grid, so the board has a completion), at least one of them where the
   * two grids differ, in one of the two sets when it can be: a board with
   * digits wrong for the first grid that can still be completed
   */
  function wrongButCompletable(pick: O.Rng, solution: Uint8Array, a: number[], b: number[]): Uint8Array {
    const [x, y] = O.shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], pick);
    const other = solution.map((d) => (d === x ? y : d === y ? x : d));
    const values = partialBoard(other, pick, 0.15 + 0.35 * pick());
    const [A, B] = O.reduce(a, b);
    const differ = [...Array(81).keys()].filter((i) => other[i] !== solution[i]);
    const inSets = differ.filter((i) => A.includes(i) || B.includes(i));
    const pool = inSets.length ? inSets : differ;
    const i = pool[O.randInt(pick, pool.length)];
    values[i] = other[i];
    return values;
  }

  it('on a board with wrong digits that can still be completed, every list holds in its completions', () => {
    // The daily has one solution, so a wrong digit on it leaves no
    // completion, and the test above has none to check a list against
    inLang('en');
    const pick = O.rngFrom(131);
    pairs(137, 150).forEach(([a, b], k) => {
      const solution = GRIDS[k % GRIDS.length];
      const values = wrongButCompletable(pick, solution, a, b);
      expect(O.agrees(values, solution)).toBe(false);
      expect(O.solveBoard(values)).not.toBeNull();
      readsTrue(a, b, show(a, b, values), 'en', values, solution);
    });
  });

  it('says the same, and no more, in Norwegian and Spanish', () => {
    for (const lang of ['nb', 'es'] as const) {
      inLang(lang);
      const pick = O.rngFrom(lang === 'nb' ? 107 : 109);
      for (const [a, b] of pairs(lang === 'nb' ? 89 : 97, 60)) {
        readsTrue(a, b, show(a, b), lang);
        const values = partSolved(pick, 0.4);
        readsTrue(a, b, show(a, b, values), lang, values, SOLUTION);
        // the daily with one empty cell given a wrong digit
        const wrong = partSolved(pick, 0.5);
        const empty = [...Array(81).keys()].filter((i) => PUZZLE[i] === '.');
        const i = empty[O.randInt(pick, empty.length)];
        wrong[i] = 1 + ((SOLUTION[i] + O.randInt(pick, 8)) % 9);
        readsTrue(a, b, show(a, b, wrong), lang, wrong, SOLUTION);
        // and some digits of another grid with two of its digits swapped: wrong for it, and still completable
        const grid = GRIDS[O.randInt(pick, GRIDS.length)];
        const sparse = wrongButCompletable(pick, grid, a, b);
        readsTrue(a, b, show(a, b, sparse), lang, sparse, grid);
      }
      // the sizes line, and a board that cannot be completed
      expect(show(O.CORNERS, O.RING.slice(1)).verdict).toBe(lang === 'nb' ? 'Ikke de samme tallene: 16 ruter mot 15' : 'No son los mismos números: 16 casillas frente a 15');
      readsTrue(O.rowsOf(1), O.colsOf(1), show(O.rowsOf(1), O.colsOf(1), overfull()), lang, overfull(), SOLUTION);
      // and row 2 against column 2 with row 2's digits placed: "the rest is exactly"
      const row2 = SOLUTION.map((d, i) => (Math.floor(i / 9) === 1 ? d : 0));
      const shown = show(O.rowsOf(2), O.colsOf(2), row2);
      expect(shown.sides[1].text).toMatch(new RegExp(`, ${LINES[lang].exactly} `));
      readsTrue(O.rowsOf(2), O.colsOf(2), shown, lang, row2, SOLUTION);
    }
    inLang('en');
  });

  it('reads the same with the two sets in other colours', () => {
    for (const colours of [[1, 5], [0, 7], [8, 3]] as [number, number][]) {
      withColours(colours, () => {
        for (const lang of ['en', 'nb'] as const) {
          inLang(lang);
          const pick = O.rngFrom(113 + colours[0]);
          for (const [a, b] of pairs(127 + colours[1], 25)) {
            readsTrue(a, b, show(a, b), lang);
            const values = partSolved(pick, 0.4);
            readsTrue(a, b, show(a, b, values), lang, values, SOLUTION);
          }
        }
        // the ask for the other set names the colour that is missing
        inLang('en');
        expect(show(O.RING, []).html).toContain(`aria-label="Colour ${colours[1] + 1}"`);
        expect(show([], O.RING).html).toContain(`aria-label="Colour ${colours[0] + 1}"`);
      });
    }
    inLang('en');
  });

  it('colours on the board exactly the cells it counts, and gives cells in both colours back when switched off', () => {
    const fills = (html: string) => {
      const out = Array.from({ length: 81 }, () => new Set<string>());
      for (const m of html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="[\d.]+" height="100" fill="(#[0-9a-f]+)" opacity="0.55"/g)) {
        out[Math.floor((Number(m[2]) - 4) / 100) * 9 + Math.floor((Number(m[1]) - 4) / 100)].add(m[3]);
      }
      return out;
    };
    let boards = 0;
    for (const colours of [[5, 1], [1, 5], [0, 8]] as [number, number][]) {
      withColours(colours, () => {
        const [ca, cb] = colours;
        const other = otherColour();
        for (const [a, b] of pairs(101 + ca, 20)) {
          const [A, B] = O.reduce(a, b);
          paint(a, b);
          const on = fills(renderToStaticMarkup(React.createElement(Grid)));
          paint(a, b, undefined, false);
          const off = fills(renderToStaticMarkup(React.createElement(Grid)));
          for (let i = 0; i < 81; i++) {
            expect(on[i].has(PALETTE[ca]), `cell ${i} in colour A`).toBe(A.includes(i));
            expect(on[i].has(PALETTE[cb]), `cell ${i} in colour B`).toBe(B.includes(i));
            // another colour on the cell is left alone
            expect(on[i].has(PALETTE[other]), `cell ${i} other colour`).toBe(i % 17 === 0);
            expect(off[i].has(PALETTE[ca]), `cell ${i} off`).toBe(a.includes(i));
            expect(off[i].has(PALETTE[cb]), `cell ${i} off`).toBe(b.includes(i));
          }
          boards++;
        }
      });
    }
    expect(boards).toBe(60);
  });
});

// ---- known findings ------------------------------------------------------------------

/**
 * Found by this harness and fixed (October 2026): the "differ" line used to
 * read "Not the same digits: …", said of sets that may well hold the same
 * digits in the solution of the puzzle on the board. What is shown is only
 * that some grid tells them apart. On the daily of 2026-10-07, r3c3 and
 * r1c4 are both empty and both 7 in its one solution, and a player who read
 * "Not the same digits" as "r3c3 is not r1c4" would eliminate wrongly. The
 * line now says "Not necessarily the same digits", in every language; the
 * "sizes" line keeps "Not the same digits", which is always true.
 */
describe('"Not necessarily the same digits": the differ line claims only that some grid tells them apart', () => {
  const R3C3 = 20;
  const R1C4 = 3;

  it('the case: two empty cells of a one-solution daily that hold the same digit, and a verdict of "differ"', () => {
    expect(O.countCompletions(O.gridOf(PUZZLE), 2)).toBe(1);
    expect(O.isValidGrid(SOLUTION)).toBe(true);
    expect([PUZZLE[R3C3], PUZZLE[R1C4]]).toEqual(['.', '.']);
    expect([SOLUTION[R3C3], SOLUTION[R1C4]]).toEqual([7, 7]);
    expect(compareSets([R3C3], [R1C4]).kind).toBe('differ');
    // and Phistomefel's ring with r3c3 moved to r1c4 holds the corners' digits on this daily too
    const moved = [...O.RING.filter((i) => i !== R3C3), R1C4];
    expect(compareSets(O.CORNERS, moved).kind).toBe('differ');
    expect(O.sameDigits(SOLUTION, O.CORNERS, moved)).toBe(true);
    for (const lang of ['en', 'nb', 'es'] as const) {
      inLang(lang);
      expect(show([R3C3], [R1C4], O.gridOf(PUZZLE)).verdict).toBe(LINES[lang].differ);
    }
    inLang('en');
  });

  it('never calls them "not the same digits", in any language, while the board’s puzzle may give them the same', () => {
    const flat = { en: /^Not the same digits/, nb: /^Ikke de samme tallene/, es: /^No son los mismos números/ };
    for (const lang of ['en', 'nb', 'es'] as const) {
      inLang(lang);
      expect(show([R3C3], [R1C4], O.gridOf(PUZZLE)).verdict).not.toMatch(flat[lang]);
    }
    inLang('en');
  });
});

/**
 * "The rest is exactly 2" and "still needs 2" are stated as facts, and are
 * drawn from the digits on the board, a wrong one too. On the daily of
 * 2026-10-07 with row 1 in one colour and column 1 in the other, and a 6 in
 * r7c1 where the solution has 2 (no 6 repeats in its row, column or box),
 * the tracker says column 1's "rest is exactly 2"; its one empty cell, r5c1,
 * is 6. The deduction is right for the board as it stands, which has no
 * completion; but the line does not say it rests on the player's digits,
 * while the app's own Hint refuses to reason from a wrong digit ("A placed
 * digit is wrong, so no hint can be trusted"). The same happens in
 * Norwegian and Spanish. The tracker calls a board wrong only when a list
 * outgrows the empty cells ("a digit on the board is wrong"); short of
 * that it states its lists as facts. Where a board with a wrong digit can
 * still be completed (not on a daily), every list holds in its completions:
 * "on a board with wrong digits that can still be completed" above.
 */
describe('KNOWN FINDING: a list of digits a set needs is stated as fact from a wrong digit', () => {
  const BOARD = O.gridOf('965712348403598107817403920598146732072359810130287650689004571340975086750021403');
  const R7C1 = 54;
  const R5C1 = 36;

  it('the case: one wrong digit that breaks no rule, row 1 against column 1, and "the rest is exactly 2" where the solution has 6', () => {
    // the daily's givens, the solution's digits but one, and that one r7c1's 6
    for (let i = 0; i < 81; i++) if (PUZZLE[i] !== '.') expect(BOARD[i]).toBe(SOLUTION[i]);
    expect([...Array(81).keys()].filter((i) => BOARD[i] && BOARD[i] !== SOLUTION[i])).toEqual([R7C1]);
    expect([PUZZLE[R7C1], BOARD[R7C1], SOLUTION[R7C1]]).toEqual(['.', 6, 2]);
    for (const house of O.HOUSE_CELLS.filter((h) => h.includes(R7C1))) expect(house.filter((j) => BOARD[j] === 6)).toEqual([R7C1]);
    expect(O.solveBoard(BOARD)).toBeNull();
    // the tracker: proved, and column 1's one empty cell called 2, in every language
    const said = {
      en: ['8 cells, 8 placed', '8 cells, 7 placed, the rest is exactly 2'],
      nb: ['8 ruter, 8 utfylt', '8 ruter, 7 utfylt, resten er nøyaktig 2'],
      es: ['8 casillas, 8 con número', '8 casillas, 7 con número, el resto es exactamente 2']
    };
    for (const lang of ['en', 'nb', 'es'] as const) {
      inLang(lang);
      const shown = show(O.rowsOf(1), O.colsOf(1), BOARD);
      expect(shown.verdict).toBe(LINES[lang].proved);
      expect(shown.sides.map((s) => s.text)).toEqual(said[lang]);
    }
    inLang('en');
    expect([BOARD[R5C1], SOLUTION[R5C1]]).toEqual([0, 6]);
    // On a puzzle with one solution, whose givens are on the board, a wrong
    // digit always leaves the board with no completion (a second solver
    // agrees here): that is how the finding arises in play
    expect(O.countCompletions(BOARD, 1)).toBe(0);
  });

  it.fails('FINDING: a list stated as fact is true of the puzzle’s solution', () => {
    inLang('en');
    const shown = show(O.rowsOf(1), O.colsOf(1), BOARD);
    const [A, B] = O.reduce(O.rowsOf(1), O.colsOf(1));
    shown.sides.forEach((side, k) => {
      const m = LINES.en.side.exec(side.text)!;
      if (!m[4]) return;
      const listed = (m[5].match(/\d+/g) ?? []).map(Number);
      const holds = (k ? B : A).filter((i) => !BOARD[i]).map((i) => SOLUTION[i]);
      expect(O.within(listed, holds), `"${side.text}", the empty cells hold ${holds}`).toBe(true);
      if (m[4] === LINES.en.exactly) expect([...holds].sort()).toEqual(listed);
    });
  });
});
