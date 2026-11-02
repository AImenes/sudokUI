/**
 * The uniqueness family and BUG+1 walk in their own sentences
 * (docs/hint-readability-2026-11.md, H1: "No uniqueness walk says why the
 * rectangle would be deadly"; "BUG+1 never says every other cell holds two
 * candidates"). Each finder writes step.walk:
 * - frame 1 the rectangle, all of it, naming its floor (the corners holding
 *   only the pair) and its roof (the corners holding more), or the cells
 *   the pattern is made of;
 * - frame 2 what the roof adds, the key digit gold (G5);
 * - the conclusion, opening with why: with only the pair in the corners
 *   they could swap and the puzzle would have two solutions (the Avoidable
 *   Rectangles' solved corners, none a given; the Extended Rectangle's six
 *   cells, pair by pair; BUG+1's whole grid, every cell its other
 *   candidate).
 *
 * Every sentence is checked against the grid it speaks of: an oracle here
 * works out from the candidates alone what each frame must say, and checks
 * each fact the why rests on (the rectangle in two rows, columns and boxes,
 * none of it a given; the digit confined where the words say; the removals
 * seeing every cell they must), over every find of the eleven finders
 * along the solve paths of practice puzzles that use them, each also held
 * to the solution. BUG+1 places its digit only where the grid without it
 * is a true grave, every candidate twice in each of its houses: two finds
 * along the practice paths, beside a hidden single, placed a digit the
 * solution does not have.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { UNITS, CELL_UNITS, bit, popcount, digitsOf, rowOf, colOf, boxOf, sees, cellName, parseGrid, isSolved, cloneGrid } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { walkFrames } from '../src/engine/hintFrames';
import { solve } from '../src/engine/bruteForce';
import { setEngineText } from '../src/engine/text';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import type { Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

afterEach(() => setEngineText('en', null));

const FAMILY: Tech[] = [
  'UNIQUENESS_1',
  'UNIQUENESS_2',
  'UNIQUENESS_3',
  'UNIQUENESS_4',
  'UNIQUENESS_5',
  'UNIQUENESS_6',
  'HIDDEN_RECTANGLE',
  'AVOIDABLE_RECTANGLE_1',
  'AVOIDABLE_RECTANGLE_2',
  'EXTENDED_RECTANGLE',
  'BUG_PLUS_1'
];

const uniq = <T>(a: T[]) => [...new Set(a)];
const and = (xs: (string | number)[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);
const named = (cells: number[]) => and(cells.map(cellName));
const house = (u: number) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);
const SWAP = 'they could swap, and the puzzle would have two solutions.';

/** the candidates of digit d in house u */
const holders = (g: Grid, u: number, d: number) => UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));

function rectangle(g: Grid, corners: number[], at: string) {
  expect(corners.length, at).toBe(4);
  expect([uniq(corners.map(rowOf)).length, uniq(corners.map(colOf)).length, uniq(corners.map(boxOf)).length], `${at}: two rows, columns and boxes`).toEqual([2, 2, 2]);
  expect(corners.some((c) => g.given[c]), `${at}: no corner a given`).toBe(false);
}

function oneOfThem(z: number, cells: number[], seeing: number[]) {
  const e = named(seeing);
  if (cells.length === 2) return seeing.length === 1 ? `One of them must therefore be ${z}, and ${e} sees both.` : `One of them must therefore be ${z}, and ${e} each see both.`;
  return seeing.length === 1 ? `One of them must therefore be ${z}, and ${e} sees all of them.` : `One of them must therefore be ${z}, and ${e} each see all of them.`;
}

const floorAndRoof = (x: number, y: number, floor: number[], roof: number[]) =>
  `${x} and ${y} are candidates in all four corners of the rectangle: the floor, ${named(floor)}, holds only these two, and the roof, ${named(roof)}, holds other digits too.`;

/** a rectangle's corners, its pair, floor and roof, read from the grid */
function corners(g: Grid, s: Step, at: string) {
  const cells = uniq(s.primary!.map((p) => p.cell)).sort((a, b) => a - b);
  rectangle(g, cells, at);
  const [x, y] = uniq(s.primary!.map((p) => p.digit)).sort();
  const pair = bit(x) | bit(y);
  expect(cells.every((c) => (g.cands[c] & pair) === pair), `${at}: the pair in every corner`).toBe(true);
  return { cells, x, y, pair, floor: cells.filter((c) => g.cands[c] === pair), roof: cells.filter((c) => g.cands[c] !== pair) };
}

/**
 * What the walk must say at this position, worked out from the grid alone
 * (frame 1, frame 2, the conclusion's lead), with every fact the words
 * rest on checked on the way
 */
function oracle(g: Grid, s: Step, at: string): string[] {
  const S = s.secondary ?? [];
  const seeing = uniq(s.eliminations.map((e) => e.cell)).sort((a, b) => a - b);
  switch (s.tech) {
    case 'UNIQUENESS_1': {
      const three = uniq(s.primary!.map((p) => p.cell)).sort((a, b) => a - b);
      const t = seeing[0];
      rectangle(g, [...three, t], at);
      const pair = g.cands[three[0]];
      expect(popcount(pair) === 2 && three.every((c) => g.cands[c] === pair), `${at}: three corners hold only the pair`).toBe(true);
      expect((g.cands[t] & pair) === pair && g.cands[t] !== pair, `${at}: the fourth holds the pair and more`).toBe(true);
      const [x, y] = digitsOf(pair);
      return [
        `Three corners of a rectangle, ${named(three)}, hold only ${x} and ${y}.`,
        `The fourth corner, ${cellName(t)}, holds ${x} and ${y} as well, and other digits too.`,
        `If ${cellName(t)} were ${x} or ${y}, all four corners would hold only ${x} and ${y}; ${SWAP}`
      ];
    }
    case 'UNIQUENESS_2':
    case 'UNIQUENESS_5': {
      const { x, y, pair, floor, roof } = corners(g, s, at);
      const z = S[0].digit;
      expect(roof.every((c) => g.cands[c] === (pair | bit(z))), `${at}: each roof cell holds the pair and ${z} only`).toBe(true);
      expect(s.eliminations.every((e) => e.digit === z && roof.every((r) => sees(e.cell, r))), `${at}: every removal sees the whole roof`).toBe(true);
      if (s.tech === 'UNIQUENESS_2') {
        expect([floor.length, roof.length], at).toEqual([2, 2]);
        return [
          floorAndRoof(x, y, floor, roof),
          `Each of ${named(roof)} holds just one other digit, the same one: ${z}.`,
          `If neither ${cellName(roof[0])} nor ${cellName(roof[1])} were ${z}, all four corners would hold only ${x} and ${y}; ${SWAP} ${oneOfThem(z, roof, seeing)}`
        ];
      }
      expect([floor.length, roof.length], at).toEqual([1, 3]);
      return [
        `${x} and ${y} are candidates in all four corners of the rectangle: ${named(floor)} holds only these two, and ${named(roof)} hold other digits too.`,
        `Each of ${named(roof)} holds just one other digit, the same one: ${z}.`,
        `If none of ${named(roof)} were ${z}, all four corners would hold only ${x} and ${y}; ${SWAP} ${oneOfThem(z, roof, seeing)}`
      ];
    }
    case 'UNIQUENESS_3': {
      const { cells, x, y, pair, floor, roof } = corners(g, s, at);
      expect([floor.length, roof.length], at).toEqual([2, 2]);
      const u = s.units![0].unit;
      const subset = uniq(S.map((cd) => cd.cell).filter((c) => !roof.includes(c))).sort((a, b) => a - b);
      expect([...roof, ...subset].every((c) => UNITS[u].includes(c)) && !subset.some((c) => cells.includes(c)), `${at}: the roof and the subset in ${house(u)}`).toBe(true);
      const extras = roof.reduce((m, c) => m | (g.cands[c] & ~pair), 0);
      const digits = subset.reduce((m, c) => m | g.cands[c], extras);
      expect(popcount(digits), `${at}: as many digits as the subset's cells and the roof read as one`).toBe(subset.length + 1);
      expect(s.eliminations.every((e) => UNITS[u].includes(e.cell) && ![...roof, ...subset].includes(e.cell) && digits & bit(e.digit)), `${at}: removals are the subset's digits elsewhere in ${house(u)}`).toBe(true);
      const word = ['pair', 'triple', 'quadruple'][subset.length - 1];
      const ds = and(digitsOf(digits));
      return [
        floorAndRoof(x, y, floor, roof),
        subset.length === 1
          ? `The roof's extras are ${and(digitsOf(extras))}, and ${named(subset)}, also in ${house(u)}, holds only ${ds}.`
          : `The roof's extras are ${and(digitsOf(extras))}, and ${named(subset)}, also in ${house(u)}, hold only ${ds} between them.`,
        `If neither roof cell took one of its extras, all four corners would hold only ${x} and ${y}; ${SWAP} A roof cell must therefore take one of its extras, and, read as one cell, the roof makes a naked ${word} with ${named(subset)}: ${ds} can go nowhere else in ${house(u)}.`
      ];
    }
    case 'UNIQUENESS_4': {
      const { x, y, floor, roof } = corners(g, s, at);
      expect([floor.length, roof.length], at).toEqual([2, 2]);
      const keep = S[0].digit;
      const kill = s.eliminations[0].digit;
      const u = s.units![0].unit;
      expect(holders(g, u, keep), `${at}: ${keep} only in the roof in ${house(u)}`).toEqual(roof);
      expect(seeing, at).toEqual(roof);
      return [
        floorAndRoof(x, y, floor, roof),
        `In ${house(u)}, ${keep} is a candidate only in the roof, so ${cellName(roof[0])} or ${cellName(roof[1])} is ${keep}.`,
        `If ${cellName(roof[0])} or ${cellName(roof[1])} were ${kill}, the other would be ${keep}, and all four corners would hold only ${x} and ${y}; ${SWAP}`
      ];
    }
    case 'UNIQUENESS_6': {
      const { cells, x, y, floor, roof } = corners(g, s, at);
      expect(floor.length === 2 && rowOf(floor[0]) !== rowOf(floor[1]) && colOf(floor[0]) !== colOf(floor[1]), `${at}: the floor on a diagonal`).toBe(true);
      const d = s.eliminations[0].digit;
      const lines = s.units!.map((b) => b.unit);
      for (const u of lines) expect(holders(g, u, d).every((c) => cells.includes(c)), `${at}: ${d} only in the rectangle in ${house(u)}`).toBe(true);
      expect(seeing, at).toEqual(roof);
      const [a, b] = lines.map((u) => (u % 9) + 1);
      return [
        floorAndRoof(x, y, floor, roof),
        lines[0] < 9
          ? `Rows ${a} and ${b} have ${d} only in the rectangle, so their two ${d}s lie on the same diagonal.`
          : `Columns ${a} and ${b} have ${d} only in the rectangle, so their two ${d}s lie on the same diagonal.`,
        `If ${cellName(roof[0])} or ${cellName(roof[1])} were ${d}, both would be, and ${named(floor)} would both be ${d === x ? y : x}: all four corners would hold only ${x} and ${y}; ${SWAP}`
      ];
    }
    case 'HIDDEN_RECTANGLE': {
      const { cells, x, y, pair } = corners(g, s, at);
      const { cell: B, digit: weak } = s.eliminations[0];
      const strong = weak === x ? y : x;
      const A = cells.find((c) => rowOf(c) !== rowOf(B) && colOf(c) !== colOf(B))!;
      const rowMate = cells.find((c) => c !== B && rowOf(c) === rowOf(B))!;
      const colMate = cells.find((c) => c !== B && colOf(c) === colOf(B))!;
      expect(g.cands[A], `${at}: ${cellName(A)} holds only the pair`).toBe(pair);
      expect(holders(g, rowOf(B), strong), `${at}: ${strong} in B's row`).toEqual([B, rowMate].sort((p, q) => p - q));
      expect(holders(g, 9 + colOf(B), strong), `${at}: ${strong} in B's column`).toEqual([B, colMate].sort((p, q) => p - q));
      expect(sees(A, rowMate) && sees(A, colMate), at).toBe(true);
      const [row, col] = [house(rowOf(B)), house(9 + colOf(B))];
      return [
        `${x} and ${y} are candidates in all four corners of the rectangle, and ${cellName(A)} holds only these two.`,
        `In ${row} and in ${col}, which cross at ${cellName(B)}, ${strong} is a candidate only in the rectangle.`,
        `If ${cellName(B)} were ${weak}, ${row} would have its ${strong} in ${cellName(rowMate)} and ${col} its ${strong} in ${cellName(colMate)}, so ${cellName(A)}, which sees both, would be ${weak}: all four corners would hold only ${x} and ${y}; ${SWAP}`
      ];
    }
    case 'AVOIDABLE_RECTANGLE_1': {
      const solved = s.primary!.map((p) => p.cell);
      const { cell: U, digit: a } = S[0];
      const cells = [...solved, U].sort((p, q) => p - q);
      rectangle(g, cells, at);
      expect(solved.every((c) => g.values[c] !== 0) && g.values[U] === 0 && (g.cands[U] & bit(a)) !== 0, `${at}: three corners solved, the fourth holding ${a}`).toBe(true);
      const D = cells.find((c) => rowOf(c) !== rowOf(U) && colOf(c) !== colOf(U))!;
      const sides = solved.filter((c) => c !== D).sort((p, q) => p - q);
      const b = g.values[sides[0]];
      expect([g.values[D], g.values[sides[1]]], `${at}: ${a} across from the fourth corner, ${b} beside it`).toEqual([a, b]);
      return [
        `Three corners of a rectangle are solved, none of them a given: ${named(sides)} are ${b}, and ${cellName(D)} is ${a}.`,
        `The fourth corner, ${cellName(U)}, still has ${a} as a candidate.`,
        `If ${cellName(U)} were ${a}, all four corners would hold only ${Math.min(a, b)} and ${Math.max(a, b)}, none of them a given; ${SWAP}`
      ];
    }
    case 'AVOIDABLE_RECTANGLE_2': {
      const solved = s.primary!.filter((p) => g.values[p.cell] !== 0).map((p) => p.cell).sort((p, q) => p - q);
      const open = S.map((cd) => cd.cell).sort((p, q) => p - q);
      const c = S[0].digit;
      const cells = [...solved, ...open].sort((p, q) => p - q);
      rectangle(g, cells, at);
      const across = open.map((u) => g.values[cells.find((d) => rowOf(d) !== rowOf(u) && colOf(d) !== colOf(u))!]);
      expect(open.every((u, i) => g.cands[u] === (bit(across[i]) | bit(c))), `${at}: each open corner holds its would-be digit and ${c} only`).toBe(true);
      expect(s.eliminations.every((e) => e.digit === c && open.every((u) => sees(e.cell, u))), `${at}: every removal sees both`).toBe(true);
      const [v1, v2] = solved.map((p) => g.values[p]);
      return [
        `Two corners of a rectangle are solved, neither of them a given: ${cellName(solved[0])} is ${v1} and ${cellName(solved[1])} is ${v2}; of the other two, ${cellName(open[0])} could be ${across[0]} and ${cellName(open[1])} could be ${across[1]}.`,
        `Each of ${named(open)} holds just one other digit, the same one: ${c}.`,
        `If neither ${cellName(open[0])} nor ${cellName(open[1])} were ${c}, they would be ${across[0]} and ${across[1]}, and all four corners would hold only ${Math.min(v1, v2)} and ${Math.max(v1, v2)}, none of them a given; ${SWAP} ${oneOfThem(c, open, seeing)}`
      ];
    }
    case 'EXTENDED_RECTANGLE': {
      const any = uniq([...s.primary!, ...S].map((cd) => cd.cell));
      const inRows = uniq(any.map(rowOf)).length === 2;
      // the formation's order: pair by pair across its three boxes
      const six = any.sort((p, q) => (inRows ? colOf(p) - colOf(q) || rowOf(p) - rowOf(q) : p - q));
      const lines = uniq(six.map(inRows ? rowOf : colOf)).sort();
      const across = uniq(six.map(inRows ? colOf : rowOf)).sort();
      expect(six.length === 6 && six.every((c) => g.values[c] === 0 && !g.given[c]), `${at}: six open cells`).toBe(true);
      expect(Math.floor(lines[0] / 3) === Math.floor(lines[1] / 3) && uniq(across.map((p) => Math.floor(p / 3))).length === 3 && uniq(six.map(boxOf)).length === 3, `${at}: two lines of one chute across three boxes`).toBe(true);
      const where = inRows ? `In rows ${lines[0] + 1} and ${lines[1] + 1}, across three boxes,` : `In columns ${lines[0] + 1} and ${lines[1] + 1}, across three boxes,`;
      const [p, q, r] = across.map((v) => v + 1);
      const swap = inRows
        ? `Swapping the two cells in each of columns ${p}, ${q} and ${r} at once would then give a second solution.`
        : `Swapping the two cells in each of rows ${p}, ${q} and ${r} at once would then give a second solution.`;
      if (s.eliminations.every((e) => six.includes(e.cell))) {
        const x = seeing[0];
        const five = six.filter((c) => c !== x);
        const trio = five.reduce((m, c) => m | g.cands[c], 0);
        const ds = digitsOf(g.cands[x] & trio);
        expect(popcount(trio) === 3 && (g.cands[x] & ~trio) !== 0 && ds.join() === s.eliminations.map((e) => e.digit).join(), `${at}: five cells on a trio, the sixth with more`).toBe(true);
        const t = and(digitsOf(trio));
        const lead = [`If ${cellName(x)} were ${ds[0]}`, `If ${cellName(x)} were ${ds[0]} or ${ds[1]}`, `If ${cellName(x)} were ${ds[0]}, ${ds[1]} or ${ds[2]}`][ds.length - 1];
        return [`${where} ${named(five)} hold only ${t}.`, `The sixth cell, ${cellName(x)}, holds ${and(ds)} as well, and other digits too.`, `${lead}, all six cells would hold only ${t}. ${swap}`];
      }
      const z = S[0].digit;
      const zCells = six.filter((c) => g.cands[c] & bit(z));
      const trio = six.reduce((m, c) => m | g.cands[c], 0) & ~bit(z);
      expect(popcount(trio), `${at}: a trio and one extra digit`).toBe(3);
      expect(s.eliminations.every((e) => e.digit === z && !six.includes(e.cell) && zCells.every((c) => sees(e.cell, c))), `${at}: every removal sees every ${z}`).toBe(true);
      const t = and(digitsOf(trio));
      const lead = zCells.length === 2 ? `If neither ${cellName(zCells[0])} nor ${cellName(zCells[1])} were ${z}` : `If none of ${named(zCells)} were ${z}`;
      return [`${where} ${named(six)} hold ${t} between them.`, `Their only other candidate is ${z}, in ${named(zCells)}.`, `${lead}, all six cells would hold only ${t}. ${swap} ${oneOfThem(z, zCells, seeing)}`];
    }
    case 'BUG_PLUS_1': {
      const { cell, digit: d } = s.placements[0];
      for (let c = 0; c < 81; c++) if (g.values[c] === 0) expect(popcount(g.cands[c]), `${at}: ${cellName(c)}`).toBe(c === cell ? 3 : 2);
      for (const u of CELL_UNITS[cell]) expect(holders(g, u, d).length, `${at}: ${d} in ${house(u)}`).toBe(3);
      // without it, every candidate twice in each of its houses
      const without = (c: number) => (c === cell ? g.cands[c] & ~bit(d) : g.cands[c]);
      for (let c = 0; c < 81; c++) {
        if (g.values[c] !== 0) continue;
        for (const e of digitsOf(without(c))) for (const u of CELL_UNITS[c]) expect(UNITS[u].filter((o) => g.values[o] === 0 && without(o) & bit(e)).length, `${at}: ${e} of ${cellName(c)} in ${house(u)}`).toBe(2);
      }
      const [row, col, box] = CELL_UNITS[cell].map(house);
      return [
        `Every unsolved cell but ${cellName(cell)} holds exactly two candidates; ${cellName(cell)} holds three.`,
        `In ${row}, ${col} and ${box}, which meet at ${cellName(cell)}, ${d} is a candidate in three cells each.`,
        `Without the ${d} in ${cellName(cell)}, every unsolved cell would hold two candidates, each found twice in its row, column and box. That is a deadly pattern: every cell could take its other candidate at once, and the puzzle would have two solutions.`
      ];
    }
  }
  throw new Error(`${at}: not in the family`);
}

/** the walk's words: frame 1, frame 2, and the conclusion's lead */
function words(s: Step): string[] {
  const frames = walkFrames(s);
  expect(frames.length).toBe(3);
  const lead = s.walk!.lead!;
  expect(frames[2].text.startsWith(`${lead} `)).toBe(true);
  return [frames[0].text, frames[1].text, lead];
}

/** the first `n` practice puzzles, of any pool, whose solve path takes a technique */
function puzzlesWith(tech: Tech, n: number): string[] {
  const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>);
  return [...new Set(pools.flatMap((pool) => pool.filter((e) => e.techs.includes(tech)).map((e) => e.puzzle)))].slice(0, n);
}

describe('the uniqueness family and BUG+1 walk with their why (H1)', () => {
  it("say at every stored example what the grid says, frame by frame, and why the pattern would be deadly", () => {
    const want: Partial<Record<Tech, string[]>> = {
      UNIQUENESS_1: [
        'Three corners of a rectangle, r4c1, r5c1 and r5c8, hold only 5 and 8.',
        'The fourth corner, r4c8, holds 5 and 8 as well, and other digits too.',
        'If r4c8 were 5 or 8, all four corners would hold only 5 and 8; they could swap, and the puzzle would have two solutions. So 5 and 8 are removed from r4c8.'
      ],
      UNIQUENESS_2: [
        '4 and 7 are candidates in all four corners of the rectangle: the floor, r5c2 and r6c2, holds only these two, and the roof, r5c4 and r6c4, holds other digits too.',
        'Each of r5c4 and r6c4 holds just one other digit, the same one: 6.',
        'If neither r5c4 nor r6c4 were 6, all four corners would hold only 4 and 7; they could swap, and the puzzle would have two solutions. One of them must therefore be 6, and r4c4 sees both. So 6 is removed from r4c4.'
      ],
      UNIQUENESS_3: [
        '7 and 8 are candidates in all four corners of the rectangle: the floor, r3c4 and r3c5, holds only these two, and the roof, r7c4 and r7c5, holds other digits too.',
        "The roof's extras are 1 and 6, and r7c6, also in row 7, holds only 1 and 6.",
        'If neither roof cell took one of its extras, all four corners would hold only 7 and 8; they could swap, and the puzzle would have two solutions. A roof cell must therefore take one of its extras, and, read as one cell, the roof makes a naked pair with r7c6: 1 and 6 can go nowhere else in row 7. So 6 is removed from r7c7.'
      ],
      UNIQUENESS_4: [
        '4 and 6 are candidates in all four corners of the rectangle: the floor, r2c7 and r8c7, holds only these two, and the roof, r2c9 and r8c9, holds other digits too.',
        'In column 9, 6 is a candidate only in the roof, so r2c9 or r8c9 is 6.',
        'If r2c9 or r8c9 were 4, the other would be 6, and all four corners would hold only 4 and 6; they could swap, and the puzzle would have two solutions. So 4 is removed from r2c9, r8c9.'
      ],
      UNIQUENESS_5: [
        '4 and 8 are candidates in all four corners of the rectangle: r5c8 holds only these two, and r5c9, r8c8 and r8c9 hold other digits too.',
        'Each of r5c9, r8c8 and r8c9 holds just one other digit, the same one: 5.',
        'If none of r5c9, r8c8 and r8c9 were 5, all four corners would hold only 4 and 8; they could swap, and the puzzle would have two solutions. One of them must therefore be 5, and r9c9 sees all of them. So 5 is removed from r9c9.'
      ],
      UNIQUENESS_6: [
        '5 and 6 are candidates in all four corners of the rectangle: the floor, r5c6 and r6c9, holds only these two, and the roof, r5c9 and r6c6, holds other digits too.',
        'Rows 5 and 6 have 6 only in the rectangle, so their two 6s lie on the same diagonal.',
        'If r5c9 or r6c6 were 6, both would be, and r5c6 and r6c9 would both be 5: all four corners would hold only 5 and 6; they could swap, and the puzzle would have two solutions. So 6 is removed from r5c9, r6c6.'
      ],
      HIDDEN_RECTANGLE: [
        '3 and 5 are candidates in all four corners of the rectangle, and r9c6 holds only these two.',
        'In row 6 and in column 5, which cross at r6c5, 5 is a candidate only in the rectangle.',
        'If r6c5 were 3, row 6 would have its 5 in r6c6 and column 5 its 5 in r9c5, so r9c6, which sees both, would be 3: all four corners would hold only 3 and 5; they could swap, and the puzzle would have two solutions. So 3 is removed from r6c5.'
      ],
      AVOIDABLE_RECTANGLE_1: [
        'Three corners of a rectangle are solved, none of them a given: r2c7 and r7c9 are 3, and r7c7 is 2.',
        'The fourth corner, r2c9, still has 2 as a candidate.',
        'If r2c9 were 2, all four corners would hold only 2 and 3, none of them a given; they could swap, and the puzzle would have two solutions. So 2 is removed from r2c9.'
      ],
      AVOIDABLE_RECTANGLE_2: [
        'Two corners of a rectangle are solved, neither of them a given: r6c3 is 5 and r9c3 is 4; of the other two, r6c2 could be 4 and r9c2 could be 5.',
        'Each of r6c2 and r9c2 holds just one other digit, the same one: 3.',
        'If neither r6c2 nor r9c2 were 3, they would be 4 and 5, and all four corners would hold only 4 and 5, none of them a given; they could swap, and the puzzle would have two solutions. One of them must therefore be 3, and r7c2 sees both. So 3 is removed from r7c2.'
      ],
      EXTENDED_RECTANGLE: [
        'In rows 8 and 9, across three boxes, r8c1, r9c1, r8c5, r8c9 and r9c9 hold only 2, 4 and 9.',
        'The sixth cell, r9c5, holds 4 and 9 as well, and other digits too.',
        'If r9c5 were 4 or 9, all six cells would hold only 2, 4 and 9. Swapping the two cells in each of columns 1, 5 and 9 at once would then give a second solution. So 4 and 9 are removed from r9c5.'
      ],
      BUG_PLUS_1: [
        'Every unsolved cell but r5c6 holds exactly two candidates; r5c6 holds three.',
        'In row 5, column 6 and box 5, which meet at r5c6, 3 is a candidate in three cells each.',
        'Without the 3 in r5c6, every unsolved cell would hold two candidates, each found twice in its row, column and box. That is a deadly pattern: every cell could take its other candidate at once, and the puzzle would have two solutions. So r5c6 must be 3.'
      ]
    };
    for (const tech of FAMILY) {
      const g = exampleGrid(EXAMPLES[tech]!);
      const s = findStep(tech, g)!;
      expect(walkFrames(s).map((f) => f.text), tech).toEqual(want[tech]);
      // and the oracle agrees with the pin
      expect(words(s), tech).toEqual(oracle(g, s, tech));
      // frame 1 the pattern, frame 2 what the roof adds, then the conclusion
      const frames = walkFrames(s);
      expect(frames.map((f) => ['primary', 'secondary', 'conclusion'].filter((p) => f.show.has(p as 'primary'))), tech).toEqual([['primary'], ['primary', 'secondary'], ['primary', 'secondary', 'conclusion']]);
    }
  });

  it('say only what is true, at every find along the solve paths of practice puzzles that use them, each find held to the solution', () => {
    const found: Partial<Record<Tech, number>> = {};
    const puzzles = uniq(FAMILY.flatMap((tech) => puzzlesWith(tech, 4)));
    for (const puzzle of puzzles) {
      const g = parseGrid(puzzle)!;
      const solution = solve(cloneGrid(g))!;
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        for (const tech of FAMILY) {
          const s = findStep(tech, g);
          if (!s) continue;
          const at = `${tech} at step ${i} of ${puzzle}`;
          for (const e of s.eliminations) expect(solution.values[e.cell], `${at}: removes ${e.digit} from ${cellName(e.cell)}`).not.toBe(e.digit);
          for (const p of s.placements) expect(solution.values[p.cell], `${at}: places ${p.digit} in ${cellName(p.cell)}`).toBe(p.digit);
          expect(words(s), at).toEqual(oracle(g, s, at));
          found[tech] = (found[tech] ?? 0) + 1;
        }
        const next = findNextStep(g);
        if (!next) break;
        applyStep(g, next);
      }
    }
    // every finder met, most of them often
    for (const tech of FAMILY) expect(found[tech] ?? 0, tech).toBeGreaterThanOrEqual(tech === 'UNIQUENESS_5' || tech === 'AVOIDABLE_RECTANGLE_2' || tech === 'BUG_PLUS_1' ? 2 : 20);
  });

  it('BUG+1 places nothing where the grid without its digit is no grave: two finds along the practice paths placed a digit the solution does not have', () => {
    for (const [puzzle, steps, cell, digit] of [
      ['.5...8.2......1537..36....8.4.8......3..26...821..9.......67.8.4......6.9..2..1..', 41, 'r8c3', 5],
      ['4.......2.32..1..5...8...6.....7......1...49.......8.6.5..9.....9..145..78..6....', 53, 'r6c1', 5]
    ] as const) {
      const g = parseGrid(puzzle)!;
      const solution = solve(cloneGrid(g))!;
      for (let i = 0; i < steps; i++) applyStep(g, findNextStep(g)!);
      // every cell but one holds two candidates, and the one holds three, its 5 three times in each of its houses...
      const open = Array.from({ length: 81 }, (_, c) => c).filter((c) => g.values[c] === 0);
      const tri = open.filter((c) => popcount(g.cands[c]) !== 2);
      expect(tri.map(cellName), puzzle).toEqual([cell]);
      expect(CELL_UNITS[tri[0]].map((u) => holders(g, u, digit).length), puzzle).toEqual([3, 3, 3]);
      // ...but without it some digit is a candidate once in a house, a hidden single, so the grid is no grave
      const once = UNITS.some((unit) => [1, 2, 3, 4, 5, 6, 7, 8, 9].some((d) => unit.filter((c) => g.values[c] === 0 && (c === tri[0] ? g.cands[c] & ~bit(digit) : g.cands[c]) & bit(d)).length === 1));
      expect(once, puzzle).toBe(true);
      // and the solution's digit there is another
      expect(solution.values[tri[0]], puzzle).not.toBe(digit);
      expect(findStep('BUG_PLUS_1', g), puzzle).toBeNull();
    }
  });
});
