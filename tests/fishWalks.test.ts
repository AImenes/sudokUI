/**
 * The nine fish walk in their finders' own sentences and draw their fins'
 * box (docs/hint-readability-2026-11.md, H1 and M4):
 * - the stored examples walk as the report asks, in English, Norwegian and
 *   Spanish: a basic fish names its base houses and their cells, then its
 *   cover houses and why each takes its digit from the base, then the
 *   removals; a finned or sashimi fish its base, its fins (the base's only
 *   other cells), its cover if every fin is false (a sashimi fish first the
 *   crossing its fins stand in for), its fins' box if a fin is true, then
 *   each removal, in a cover house and in the fins' box, false either way;
 * - each frame draws the cells it names (frame 1 nothing else) and
 *   something new; the fins' box is banded, dotted in the fins' colour,
 *   from the frame that names it; each frame's legend names only what the
 *   frame draws;
 * - every sentence is true of its board and of the puzzle's solution at
 *   every find of the nine fish along practice solve paths, Norwegian and
 *   Spanish name the same cells and digits, and no list of houses runs into
 *   a digit (H3), in the three languages (a sample of the paths;
 *   FISH_SCAN=all reads every practice puzzle's path).
 * Their Copy step lines are pinned in tests/eureka.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, bit, boxOf, colOf, rowOf, parseGrid, isSolved } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, legendKinds } from '../src/content/hintMarks';
import { boardSvg, legendOf, swatchStyle } from '../src/content/boardSvg';
import { setEngineText } from '../src/engine/text';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

afterEach(() => setEngineText('en', null));

const BASIC: Tech[] = ['X_WING', 'SWORDFISH', 'JELLYFISH'];
const FINNED: Tech[] = ['FINNED_X_WING', 'SASHIMI_X_WING', 'FINNED_SWORDFISH', 'SASHIMI_SWORDFISH', 'FINNED_JELLYFISH', 'SASHIMI_JELLYFISH'];
const FISH = [...BASIC, ...FINNED];
const OTHER = [
  ['nb', engineNb],
  ['es', engineEs]
] as const;

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const numbers = (s: string) => [...s.matchAll(/\d/g)].map((m) => Number(m[0]));
const digitsIn = (s: string) => numbers(s.replace(/r\dc\d/g, ''));
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const same = (a: number[], b: number[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
/** a line's index (0-8) among rows or columns */
const lineOf = (rows: boolean, cell: number) => (rows ? rowOf(cell) : colOf(cell));
/** a line of rows or of columns, as a house (a UNITS index) */
const house = (rows: boolean, line: number) => (rows ? line : 9 + line);
/** the cells of these lines holding d */
const holding = (g: Grid, rows: boolean, lines: number[], d: number) =>
  lines.flatMap((l) => UNITS[house(rows, l)].filter((c) => g.values[c] === 0 && g.cands[c] & bit(d)));

/** a view's drawing: the candidates' marks and the bands, to tell two frames apart */
const drawing = (step: Step, frame: Frame | null, g: Grid) => {
  const m = frameMarks(step, frame, (c) => g.values[c] > 0);
  return JSON.stringify({ cands: [...m.cands].map(([c, d]) => [c, [...d]]).sort(), bands: m.bands.map((b) => `${b.unit}:${b.role}`).sort() });
};
const drawnCells = (step: Step, frame: Frame | null, g: Grid) => sorted([...frameMarks(step, frame, (c) => g.values[c] > 0).cands.keys()]);
const bandsAt = (step: Step, frame: Frame | null, g: Grid) => frameMarks(step, frame, (c) => g.values[c] > 0).bands.map((b) => `${b.unit}:${b.role}`);
const valuesOf = (g: Grid) => Array.from(g.values).join('');

const B1 = /^In (rows|columns) ([\d, and]+), the (\d)s lie only in (.+)\.$/;
const B2 = /^These cells lie in (rows|columns) ([\d, and]+)\. Each of (rows|columns) ([\d, and]+) needs (?:a|an) (\d), and no (row|column) holds two, so each of (rows|columns) ([\d, and]+) gets its (\d) from one of (rows|columns) ([\d, and]+)\.$/;
const BL = /^No other cell of (rows|columns) ([\d, and]+) can be (\d)\. So /;
const F1 = /^In (rows|columns) ([\d, and]+), the (\d)s lie in (.+?), and in (?:one more cell|(\d) more cells)\.$/;
const F2 = /^The only other (\d)(s?) in (rows|columns) ([\d, and]+) (is|are) (.+?): the (fin|fins)\.$/;
const CORNER = /^The fish's corner (r\dc\d) has no (\d): the (fin|fins) (.+?) (stands|stand) in for it\. /;
const SECOND = /^(Row|Column) (\d) has only one (\d) in (rows|columns) ([\d, and]+), (r\dc\d): the (fin|fins) (.+?) (stands|stand) in for a second\. /;
const F3 = /(?:^|\. )If (the fin is|every fin is) false, (rows|columns) ([\d, and]+) put their (\d)s in (rows|columns) ([\d, and]+), one in each, so no other cell of those (rows|columns) can be (\d)\.$/;
const F4 = /^If (the fin|a fin) is true, it is the (\d) of box (\d), so no other cell of box \3 can be \2\.$/;
const LEAD1 = /^(.+?) (is|are) in (row|column) (\d) and in box (\d), so (it cannot|none of them can) be (\d) either way\. So /;
const LEADS = /^(.+?) are in box (\d), each in one of (rows|columns) ([\d, and]+), so none of them can be (\d) either way\. So /;

/**
 * What is wrong with a fish's English walk at its position, given the
 * puzzle's solution: each sentence read back and held to the board (which
 * cells of a house hold the digit) and to the solution (each cover line
 * takes its digit from the base where every fin is false; no removal is
 * the answer)
 */
function wrongIn(step: Step, g: Grid, sol: Grid): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const texts = walkFrames(step).map((f) => f.text);
  const d = step.eliminations[0].digit;
  const rows = step.units![0].unit < 9;
  const [baseNoun, coverNoun] = rows ? ['rows', 'columns'] : ['columns', 'rows'];
  const base = step.units!.filter((u) => u.role === 'primary').map((u) => u.unit % 9);
  const cover = step.units!.filter((u) => u.role === 'secondary').map((u) => u.unit % 9);
  const elims = step.eliminations.map((e) => e.cell);
  ok(step.eliminations.every((e) => e.digit === d && sol.values[e.cell] !== d && g.cands[e.cell] & bit(d)), 'a removal is the answer');
  ok(elims.every((c) => cover.includes(lineOf(!rows, c)) && !base.includes(lineOf(rows, c))), 'a removal is not in the cover outside the base');
  // the solution: each cover line's digit lies in a base line, unless a fin is true
  const fins = (step.fins ?? []).map((f) => f.cell);
  const finTrue = fins.some((c) => sol.values[c] === d);
  const coverFromBase = cover.every((l) => UNITS[house(!rows, l)].some((c) => sol.values[c] === d && base.includes(lineOf(rows, c))));
  if (!finTrue) ok(coverFromBase, 'a cover line takes its digit from outside the base, no fin being true');
  if (!fins.length) {
    const [a, b, lead] = [B1.exec(texts[0]), B2.exec(texts[1]), BL.exec(texts[2])];
    if (!a || !b || !lead || texts.length !== 3) return [`not a basic fish's walk: ${texts.join(' / ')}`];
    ok(a[1] === baseNoun && same(numbers(a[2]).map((n) => n - 1), base) && Number(a[3]) === d, `the base named: ${texts[0]}`);
    // the cells named are every cell of the base holding the digit
    const cells = cellsIn(a[4]);
    ok(same(cells, holding(g, rows, base, d)) && same(cells, step.primary!.map((cd) => cd.cell)), `the base's cells: ${texts[0]}`);
    ok(b[1] === coverNoun && same([...new Set(cells.map((c) => lineOf(!rows, c)))], numbers(b[2]).map((n) => n - 1)), `the cells' lines: ${texts[1]}`);
    ok(same(numbers(b[2]), numbers(b[8])) && same(numbers(b[2]).map((n) => n - 1), cover) && cover.length === base.length, `the cover: ${texts[1]}`);
    ok(b[3] === baseNoun && b[10] === baseNoun && same(numbers(b[4]), numbers(b[11])) && same(numbers(b[4]).map((n) => n - 1), base), `the base again: ${texts[1]}`);
    ok(b[6] === coverNoun.slice(0, -1) && b[7] === coverNoun && Number(b[5]) === d && Number(b[9]) === d, `the nouns and digits: ${texts[1]}`);
    ok(coverFromBase, 'a cover line takes its digit from outside the base');
    ok(lead[1] === coverNoun && same(numbers(lead[2]).map((n) => n - 1), cover) && Number(lead[3]) === d, `the lead names the cover: ${texts[2]}`);
    // every other cell of the cover holding the digit goes
    ok(same(elims, holding(g, !rows, cover, d).filter((c) => !base.includes(lineOf(rows, c)))), 'the removals are not every other cell of the cover');
    return out;
  }
  const [a, b, c, e] = [F1.exec(texts[0]), F2.exec(texts[1]), F3.exec(texts[2]), F4.exec(texts[3])];
  if (!a || !b || !c || !e || texts.length !== 5) return [`not a finned fish's walk: ${texts.join(' / ')}`];
  const many = fins.length > 1;
  // frame 1: the base and its cells in the cover, and how many more
  ok(a[1] === baseNoun && same(numbers(a[2]).map((n) => n - 1), base) && Number(a[3]) === d, `the base named: ${texts[0]}`);
  const cells = cellsIn(a[4]);
  ok(same(cells, step.primary!.map((cd) => cd.cell)) && cells.every((x) => cover.includes(lineOf(!rows, x))), `the base's cells: ${texts[0]}`);
  ok(Number(a[5] ?? 1) === fins.length, `the count of cells more: ${texts[0]}`);
  // frame 2: the fins, the base's only other cells holding the digit, in one box
  const named = cellsIn(b[6]);
  ok(Number(b[1]) === d && b[3] === baseNoun && same(numbers(b[4]).map((n) => n - 1), base), `the fins' base: ${texts[1]}`);
  ok(same(named, fins) && same([...cells, ...named], holding(g, rows, base, d)), `the fins are the base's only other cells: ${texts[1]}`);
  ok((b[2] === 's') === many && (b[5] === 'are') === many && (b[7] === 'fins') === many, `fin or fins: ${texts[1]}`);
  const box = boxOf(fins[0]);
  ok(fins.every((x) => boxOf(x) === box), 'the fins are not in one box');
  // frame 3: a sashimi fish's crossing, then the cover if every fin is false
  const sashimi = step.tech.startsWith('SASHIMI');
  const corner = CORNER.exec(texts[2]);
  const second = SECOND.exec(texts[2]);
  ok(sashimi === !!(corner || second), `a sashimi fish's crossing named, and only a sashimi fish's: ${texts[2]}`);
  if (corner) {
    const x = cellOf(corner[1]);
    const l = lineOf(rows, x);
    ok(base.length === 2 && base.includes(l) && cover.includes(lineOf(!rows, x)), `the corner is a crossing of base and cover: ${texts[2]}`);
    ok(!(g.values[x] === 0 && g.cands[x] & bit(d)) && sol.values[x] !== d && Number(corner[2]) === d, `the corner has no ${d}: ${texts[2]}`);
    ok(holding(g, rows, [l], d).filter((y) => cover.includes(lineOf(!rows, y))).length === 1, `the corner's line has one ${d} in the cover: ${texts[2]}`);
    const own = fins.filter((y) => lineOf(rows, y) === l);
    ok(same(cellsIn(corner[4]), own) && own.length > 0 && (corner[3] === 'fins') === own.length > 1 && (corner[5] === 'stand') === own.length > 1, `the corner's line's fins: ${texts[2]}`);
  }
  if (second) {
    const l = Number(second[2]) - 1;
    const x = cellOf(second[6]);
    ok(base.length > 2 && second[1].toLowerCase() === baseNoun.slice(0, -1) && base.includes(l) && second[4] === coverNoun, `the sashimi line: ${texts[2]}`);
    ok(Number(second[3]) === d && same(numbers(second[5]).map((n) => n - 1), cover), `the sashimi line's cover: ${texts[2]}`);
    ok(same(holding(g, rows, [l], d).filter((y) => cover.includes(lineOf(!rows, y))), [x]), `the line has one ${d} in the cover, at the cell named: ${texts[2]}`);
    const own = fins.filter((y) => lineOf(rows, y) === l);
    ok(same(cellsIn(second[8]), own) && own.length > 0 && (second[7] === 'fins') === own.length > 1 && (second[9] === 'stand') === own.length > 1, `the sashimi line's fins: ${texts[2]}`);
  }
  // a sashimi fish has a base line with one digit in the cover, and a finned fish none
  ok(sashimi === base.some((l) => holding(g, rows, [l], d).filter((y) => cover.includes(lineOf(!rows, y))).length === 1), 'sashimi, or not, as the board is');
  ok((c[1] === 'every fin is') === many && c[2] === baseNoun && same(numbers(c[3]).map((n) => n - 1), base), `the cover's case: ${texts[2]}`);
  ok(Number(c[4]) === d && Number(c[8]) === d && c[5] === coverNoun && c[7] === coverNoun && same(numbers(c[6]).map((n) => n - 1), cover), `the cover: ${texts[2]}`);
  ok(cover.length === base.length, 'as many cover lines as base lines');
  // frame 4: the fins' box
  ok((e[1] === 'a fin') === many && Number(e[2]) === d && Number(e[3]) - 1 === box, `the fins' box: ${texts[3]}`);
  // the lead: each removal in a cover line and in the fins' box
  const lead1 = LEAD1.exec(texts[4]);
  const leads = LEADS.exec(texts[4]);
  const lines = [...new Set(elims.map((x) => lineOf(!rows, x)))];
  ok(elims.every((x) => boxOf(x) === box), 'a removal is not in the fins box');
  if (lead1) {
    ok(same(cellsIn(lead1[1]), elims) && (lead1[2] === 'are') === elims.length > 1 && (lead1[6] === 'none of them can') === elims.length > 1, `the lead's removals: ${texts[4]}`);
    ok(lead1[3] === coverNoun.slice(0, -1) && lines.length === 1 && Number(lead1[4]) - 1 === lines[0], `the lead's cover line: ${texts[4]}`);
    ok(Number(lead1[5]) - 1 === box && Number(lead1[7]) === d, `the lead's box and digit: ${texts[4]}`);
  } else if (leads) {
    ok(same(cellsIn(leads[1]), elims) && elims.length > 1 && Number(leads[2]) - 1 === box && Number(leads[5]) === d, `the lead's removals: ${texts[4]}`);
    ok(leads[3] === coverNoun && same(numbers(leads[4]).map((n) => n - 1), lines) && lines.length > 1, `the lead's cover lines: ${texts[4]}`);
  } else out.push(`not a finned fish's lead: ${texts[4]}`);
  return out;
}

/**
 * What is wrong with a fish's drawing: frame 1 draws other cells than it
 * names, a frame does not draw a cell it names (a sashimi fish's empty
 * corner is drawn by the two bands that cross on it), two frames in a row
 * draw the same, the fins' box is banded before the frame that names it,
 * and a frame's legend names what it does not draw
 */
function drawnWrong(step: Step, g: Grid): string[] {
  const out: string[] = [];
  const frames = walkFrames(step);
  const first = sorted([...new Set(cellsIn(frames[0].text))]);
  if (JSON.stringify(drawnCells(step, frames[0], g)) !== JSON.stringify(first)) out.push(`frame 1 draws other cells than it names: ${frames[0].text}`);
  const rows = step.units![0].unit < 9;
  frames.forEach((f, i) => {
    const drawn = new Set(drawnCells(step, f, g));
    const bands = frameMarks(step, f, (c) => g.values[c] > 0).bands;
    const banded = (cell: number, role: string) => bands.some((b) => b.role === role && UNITS[b.unit].includes(cell));
    for (const cell of cellsIn(f.text)) {
      if (drawn.has(cell)) continue;
      // the corner a sashimi fish lacks: where a base band and a cover band cross
      if (/corner/.test(f.text) && banded(cell, 'primary') && banded(cell, 'secondary')) continue;
      out.push(`frame ${i + 1} names a cell it does not draw: ${f.text}`);
    }
    if (i && drawing(step, frames[i - 1], g) === drawing(step, f, g)) out.push(`frames ${i} and ${i + 1} draw the same`);
  });
  // the bands frame by frame: the base, then the cover, then (a finned fish) the fins' box
  const fin = step.fins?.length ? `${18 + boxOf(step.fins[0].cell)}:fin` : null;
  const at = frames.map((f) => bandsAt(step, f, g));
  const base = step.units!.filter((u) => u.role === 'primary').map((u) => `${u.unit}:primary`);
  const cover = step.units!.filter((u) => u.role === 'secondary').map((u) => `${u.unit}:secondary`);
  const want = fin ? [base, base, [...base, ...cover], [...base, ...cover, fin], [...base, ...cover, fin]] : [base, [...base, ...cover], [...base, ...cover]];
  if (JSON.stringify(at) !== JSON.stringify(want)) out.push(`the bands by frame: ${JSON.stringify(at)}`);
  if (step.units!.some((u) => u.role === 'primary' && u.unit < 9 !== rows)) out.push('a base band of the other orientation');
  // each frame's legend names only what it draws, and words nothing it does not draw
  const kinds = frames.map((f) => legendOf(step, valuesOf(g), f).map((e) => e.kind).join());
  const wantKinds = fin
    ? ['primary', 'primary,fin', 'primary,secondary,fin', 'primary,secondary,fin,finBox', 'elim,primary,secondary,fin,finBox']
    : ['primary', 'primary,secondary', 'elim,primary,secondary'];
  if (JSON.stringify(kinds) !== JSON.stringify(wantKinds)) out.push(`the legend by frame: ${kinds.join(' / ')}`);
  frames.forEach((f, i) => {
    const words = legendOf(step, valuesOf(g), f).map((e) => e.label);
    const legend = legendKinds(step, frameMarks(step, f, (c) => g.values[c] > 0));
    for (const w of words) {
      if (/cover/.test(w) && !legend.shown.has('secondary')) out.push(`frame ${i + 1}'s legend names the cover: ${w}`);
      if (/box/.test(w) && !legend.finBox) out.push(`frame ${i + 1}'s legend names the fins' box: ${w}`);
      if (/remov/.test(w) && !legend.shown.has('elim')) out.push(`frame ${i + 1}'s legend names a removal: ${w}`);
    }
  });
  return out;
}

/** a fish's step at its stored example's position, as its finder takes it now */
const found = (tech: Tech): Step => findStep(tech, exampleGrid(EXAMPLES[tech]!))!;

/** the cells and digits a sentence names, in any order */
const namedIn = (s: string) => JSON.stringify([sorted(cellsIn(s)), sorted(digitsIn(s))]);

/** the lists of rows or of columns a sentence names, in each language, each read as its numbers */
const HOUSES = /(?:rows|columns|radene|kolonnene|filas|columnas) (\d(?:(?:, | and | og | y )\d)*)/g;
const houseLists = (s: string) => [...s.matchAll(HOUSES)].map((m) => sorted(numbers(m[1]).map((n) => n - 1)));

/** every find of the nine fish along the solve paths of these puzzles, with the puzzle's solution */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Grid }[] {
  const out: { step: Step; g: Grid; sol: Grid }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(g)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      for (const tech of FISH) {
        const step = findStep(tech, g);
        if (step?.tech === tech) out.push({ step, g: { values: new Uint8Array(g.values), cands: new Uint16Array(g.cands), given: g.given }, sol });
      }
      const s = findNextStep(g);
      if (!s) break;
      applyStep(g, s);
    }
  }
  return out;
}

describe('the fish walk in their own sentences (H1)', () => {
  it('as the report asks, in the stored examples, in English, Norwegian and Spanish', () => {
    const want: Record<string, Partial<Record<Tech, string[]>>> = {
      en: {
        X_WING: [
          'In rows 3 and 8, the 7s lie only in r3c3, r3c8, r8c3 and r8c8.',
          'These cells lie in columns 3 and 8. Each of rows 3 and 8 needs a 7, and no column holds two, so each of columns 3 and 8 gets its 7 from one of rows 3 and 8.',
          'No other cell of columns 3 and 8 can be 7. So 7 is removed from r2c3.'
        ],
        SWORDFISH: [
          'In columns 1, 4 and 8, the 9s lie only in r3c1, r5c1, r4c4, r5c4, r3c8 and r4c8.',
          'These cells lie in rows 3, 4 and 5. Each of columns 1, 4 and 8 needs a 9, and no row holds two, so each of rows 3, 4 and 5 gets its 9 from one of columns 1, 4 and 8.',
          'No other cell of rows 3, 4 and 5 can be 9. So 9 is removed from r5c2.'
        ],
        FINNED_X_WING: [
          'In columns 3 and 9, the 8s lie in r5c3, r8c3, r5c9 and r8c9, and in one more cell.',
          'The only other 8 in columns 3 and 9 is r4c3: the fin.',
          'If the fin is false, columns 3 and 9 put their 8s in rows 5 and 8, one in each, so no other cell of those rows can be 8.',
          'If the fin is true, it is the 8 of box 4, so no other cell of box 4 can be 8.',
          'r5c1 is in row 5 and in box 4, so it cannot be 8 either way. So 8 is removed from r5c1.'
        ],
        SASHIMI_X_WING: [
          'In columns 4 and 8, the 1s lie in r6c4, r6c8 and r9c8, and in 2 more cells.',
          'The only other 1s in columns 4 and 8 are r7c4 and r8c4: the fins.',
          "The fish's corner r9c4 has no 1: the fins r7c4 and r8c4 stand in for it. If every fin is false, columns 4 and 8 put their 1s in rows 6 and 9, one in each, so no other cell of those rows can be 1.",
          'If a fin is true, it is the 1 of box 8, so no other cell of box 8 can be 1.',
          'r9c6 is in row 9 and in box 8, so it cannot be 1 either way. So 1 is removed from r9c6.'
        ],
        SASHIMI_SWORDFISH: [
          'In rows 5, 6 and 8, the 1s lie in r5c3, r5c7, r6c5, r8c5 and r8c7, and in one more cell.',
          'The only other 1 in rows 5, 6 and 8 is r6c2: the fin.',
          'Row 6 has only one 1 in columns 3, 5 and 7, r6c5: the fin r6c2 stands in for a second. If the fin is false, rows 5, 6 and 8 put their 1s in columns 3, 5 and 7, one in each, so no other cell of those columns can be 1.',
          'If the fin is true, it is the 1 of box 4, so no other cell of box 4 can be 1.',
          'r4c3 is in column 3 and in box 4, so it cannot be 1 either way. So 1 is removed from r4c3.'
        ]
      },
      nb: {
        X_WING: [
          'I radene 3 og 8 står 7-erne bare i r3c3, r3c8, r8c3 og r8c8.',
          'Disse rutene ligger i kolonnene 3 og 8. Hver av radene 3 og 8 trenger en 7-er, og ingen kolonne kan ha to, så hver av kolonnene 3 og 8 får sin 7-er fra en av radene 3 og 8.',
          'Ingen annen rute i kolonnene 3 og 8 kan være 7. Så fjernes 7 fra r2c3.'
        ],
        FINNED_X_WING: [
          'I kolonnene 3 og 9 står 8-erne i r5c3, r8c3, r5c9 og r8c9, og i én rute til.',
          'Den eneste andre 8-eren i kolonnene 3 og 9 er r4c3: finnen.',
          'Hvis finnen er usann, setter kolonnene 3 og 9 sine 8-ere i radene 5 og 8, én i hver, så ingen annen rute i disse radene kan være 8.',
          'Hvis finnen er sann, er den 8-eren i boks 4, så ingen annen rute i boks 4 kan være 8.',
          'r5c1 ligger i rad 5 og i boks 4, så den kan ikke være 8 uansett. Så fjernes 8 fra r5c1.'
        ],
        SASHIMI_X_WING: [
          'I kolonnene 4 og 8 står 1-erne i r6c4, r6c8 og r9c8, og i 2 ruter til.',
          'De eneste andre 1-erne i kolonnene 4 og 8 er r7c4 og r8c4: finnene.',
          'Fiskens hjørne r9c4 har ingen 1-er: finnene r7c4 og r8c4 står i stedet for det. Hvis alle finnene er usanne, setter kolonnene 4 og 8 sine 1-ere i radene 6 og 9, én i hver, så ingen annen rute i disse radene kan være 1.',
          'Hvis en av finnene er sann, er den 1-eren i boks 8, så ingen annen rute i boks 8 kan være 1.',
          'r9c6 ligger i rad 9 og i boks 8, så den kan ikke være 1 uansett. Så fjernes 1 fra r9c6.'
        ]
      },
      es: {
        X_WING: [
          'En las filas 3 y 8, los 7 solo están en r3c3, r3c8, r8c3 y r8c8.',
          'Estas casillas están en las columnas 3 y 8. Cada una de las filas 3 y 8 necesita un 7, y ninguna columna puede tener dos, así que cada una de las columnas 3 y 8 recibe su 7 de una de las filas 3 y 8.',
          'Ninguna otra casilla de las columnas 3 y 8 puede ser 7. Por tanto, se elimina el 7 de r2c3.'
        ],
        FINNED_X_WING: [
          'En las columnas 3 y 9, los 8 están en r5c3, r8c3, r5c9 y r8c9, y en una casilla más.',
          'El único otro 8 de las columnas 3 y 9 es r4c3: la aleta.',
          'Si la aleta es falsa, las columnas 3 y 9 ponen sus 8 en las filas 5 y 8, uno en cada una, así que ninguna otra casilla de esas filas puede ser 8.',
          'Si la aleta es verdadera, es el 8 de la caja 4, así que ninguna otra casilla de la caja 4 puede ser 8.',
          'r5c1 está en la fila 5 y en la caja 4, así que no puede ser 8 en ningún caso. Por tanto, se elimina el 8 de r5c1.'
        ],
        SASHIMI_X_WING: [
          'En las columnas 4 y 8, los 1 están en r6c4, r6c8 y r9c8, y en 2 casillas más.',
          'Los únicos otros 1 de las columnas 4 y 8 son r7c4 y r8c4: las aletas.',
          'La esquina r9c4 del pez no tiene ningún 1: las aletas r7c4 y r8c4 ocupan su lugar. Si todas las aletas son falsas, las columnas 4 y 8 ponen sus 1 en las filas 6 y 9, uno en cada una, así que ninguna otra casilla de esas filas puede ser 1.',
          'Si alguna aleta es verdadera, es el 1 de la caja 8, así que ninguna otra casilla de la caja 8 puede ser 1.',
          'r9c6 está en la fila 9 y en la caja 8, así que no puede ser 1 en ningún caso. Por tanto, se elimina el 1 de r9c6.'
        ]
      }
    };
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      for (const [tech, frames] of Object.entries(want[lang])) {
        const step = findStep(tech as Tech, exampleGrid(EXAMPLES[tech as Tech]!))!;
        expect(walkFrames(step).map((f) => f.text), `${lang} ${tech}`).toEqual(frames);
      }
    }
  });

  it('names in each legend entry only what its frame draws, and the fins in the plural when there are two', () => {
    const legend = (tech: Tech) => legendOf(found(tech), EXAMPLES[tech]!.values).map((e) => `${e.kind}: ${e.label}`);
    expect(legend('X_WING')).toEqual([
      'elim: remove',
      'primary: base rows: the 7s of the fish',
      "secondary: cover columns: 2 of them take the base's 7s, so 7 goes nowhere else in them"
    ]);
    expect(legend('FINNED_X_WING')).toEqual([
      'elim: remove',
      'primary: base columns: the 8s of the fish',
      'secondary: cover rows: where the base columns put their 8s if the fin is false',
      'fin: fin: an 8 of the base columns outside the fish',
      "finBox: the fin's box: if the fin is true, no other cell here can be 8"
    ]);
    expect(legend('SASHIMI_X_WING')).toEqual([
      'elim: remove',
      'primary: base columns: the 1s of the fish',
      'secondary: cover rows: where the base columns put their 1s if every fin is false',
      'fin: fins: 1s of the base columns outside the fish',
      "finBox: the fins' box: if a fin is true, no other cell here can be 1"
    ]);
  });

  it("draws the fins' box dotted in the fins' colour, from the frame that names it, on the board and in the Learn diagram", () => {
    for (const tech of FINNED) {
      const ex = EXAMPLES[tech]!;
      const step = found(tech);
      const box = boxOf(step.fins![0].cell);
      // the fins' box is the step's last band, of the fins' role
      expect(step.units!.at(-1), tech).toEqual({ unit: 18 + box, role: 'fin' });
      const frames = walkFrames(step);
      expect(frames.map((f) => f.show.has('finBox')), tech).toEqual([false, false, false, true, true]);
      expect(frames[3].text, tech).toMatch(new RegExp(`box ${box + 1}`));
      // the full view draws it, and its legend names it
      const marks = frameMarks(step, null, (c) => ex.values[c] !== '0');
      expect(marks.bands.some((b) => b.role === 'fin' && b.unit === 18 + box), tech).toBe(true);
      expect(legendKinds(step, marks).finBox, tech).toBe(true);
    }
    // the Learn diagram's swatch and band: dotted, in the fins' colour
    const learn = legendOf(found('FINNED_X_WING'), EXAMPLES.FINNED_X_WING!.values);
    const entry = learn.find((e) => e.kind === 'finBox')!;
    const fin = learn.find((e) => e.kind === 'fin')!;
    expect(entry.onBand && [entry.colour, entry.ink]).toEqual([fin.colour, fin.ink]);
    expect(swatchStyle(entry).border).toMatch(/dotted/);
    const svg = boardSvg(EXAMPLES.FINNED_X_WING!, 'Finned X-Wing');
    expect(svg).toMatch(new RegExp(`stroke="${fin.ink}" stroke-width="[\\d.]+" stroke-dasharray="[\\d. ]+" stroke-linecap="round"`));
    // a basic fish has no fins' box
    for (const tech of BASIC) expect(found(tech).units!.some((u) => u.role === 'fin'), tech).toBe(false);
  });

  it('draws in each frame the cells it names, frame 1 nothing else, and something new each time, at the stored examples', () => {
    for (const tech of FISH) {
      const g = exampleGrid(EXAMPLES[tech]!);
      expect(drawnWrong(findStep(tech, g)!, g), tech).toEqual([]);
    }
  });

  it('says only what is true, and draws what it says, at every find along practice solve paths, in the three languages', () => {
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    const puzzles =
      env.FISH_SCAN === 'all'
        ? [...new Set(pools.map((e) => e.puzzle))]
        : [...new Set(FISH.flatMap((tech) => pools.filter((e) => e.techs.includes(tech)).slice(0, 3).map((e) => e.puzzle)))];
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const shapes = new Set<string>();
    for (const { step, g, sol } of finds) {
      const at = `${step.tech} ${step.description}`;
      for (const w of [...wrongIn(step, g, sol), ...drawnWrong(step, g)]) wrong.push(`${at}: ${w}`);
      const english = walkFrames(step).map((f) => namedIn(f.text));
      // the lists of houses a sentence names are the base's, the cover's, or the removals' cover lines, in each language (H3)
      const rows = step.units![0].unit < 9;
      const lists = [
        step.units!.filter((u) => u.role === 'primary').map((u) => u.unit % 9),
        step.units!.filter((u) => u.role === 'secondary').map((u) => u.unit % 9),
        [...new Set(step.eliminations.map((e) => lineOf(!rows, e.cell)))]
      ].map((l) => JSON.stringify(sorted(l)));
      const housesWrong = (lang: string, s: Step) => {
        for (const f of walkFrames(s)) for (const l of houseLists(f.text)) if (!lists.includes(JSON.stringify(l))) wrong.push(`${lang} ${at}: a list of houses runs into a digit: ${f.text}`);
      };
      housesWrong('en', step);
      const texts = walkFrames(step).map((f) => f.text);
      shapes.add(
        [
          step.tech,
          rows ? 'rows' : 'columns',
          step.eliminations.length > 1 ? 'removals' : 'removal',
          (step.fins?.length ?? 0) > 1 ? 'fins' : '',
          / each in one of /.test(texts.at(-1)!) ? 'lines' : ''
        ]
          .filter(Boolean)
          .join(' ')
      );
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        const there = findStep(step.tech, g)!;
        const words = walkFrames(there).map((f) => namedIn(f.text));
        if (JSON.stringify(words) !== JSON.stringify(english)) wrong.push(`${lang} ${at}: names other cells or digits than English`);
        housesWrong(lang, there);
        setEngineText('en', null);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    for (const tech of FISH) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(env.FISH_SCAN === 'all' ? 100 : 10);
    // both orientations, one removal and several, one fin and several, removals in two cover lines
    const seen = [...shapes];
    for (const tech of FISH) for (const o of ['rows', 'columns']) expect(seen.some((s) => s.startsWith(`${tech} ${o}`)), `${tech} ${o}`).toBe(true);
    for (const part of [' removals', ' fins', ' lines']) expect(seen.some((s) => s.includes(part)), part).toBe(true);
    expect(seen.some((s) => s.startsWith('SASHIMI_X_WING') && s.includes(' fins'))).toBe(true);
  });
});
