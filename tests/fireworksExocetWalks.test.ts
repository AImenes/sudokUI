/**
 * Fireworks and Exocet walk their argument and draw the lines it uses
 * (docs/hint-readability-2026-11.md, H1, M4, L2 and L3):
 * - Fireworks bands its row and column, dashed, crossing at the cross cell,
 *   and walks them line by line: outside the box, the row has the digits
 *   only in its wing, then the column only in its wing, then why a digit in
 *   neither wing is in the cross; its legend says exactly what each colour
 *   is ("whichever of 1, 4 and 8 is in neither wing is here", not "the only
 *   cells 1/4/8 can land on");
 * - Exocet bands its base's mini-line and its targets' two lines, and walks
 *   the base, the targets' lines, then each base digit in a frame of its
 *   own that draws that digit alone: where the targets' boxes and lines
 *   settle it on the board, it says how; elsewhere it gives what the proof
 *   counted, the ways the board leaves to place all nine of the digit, and
 *   claims nothing more; a digit it keeps out of the base goes from the
 *   base where no target holds it, and where one does the step leaves it,
 *   so the frame says only that it is not one of the base's two digits and
 *   that this step does not remove it, and draws it in no cell;
 * - the stored examples walk so in English, Norwegian and Spanish, and the
 *   descriptions lead with the argument, not the technique's name (L3);
 * - each frame draws what it names and something new; the bands come with
 *   their frames; each frame's legend names only what that frame draws, in
 *   words (G23: Fireworks' row's wing before both wings, Exocet's targets
 *   by their lines before the walk argues what they hold, then each digit
 *   in the base and the targets);
 * - every sentence is true of its board and of the puzzle's solution at
 *   every find of the two techniques along practice solve paths, and
 *   Norwegian and Spanish name the same cells and digits (a sample of the
 *   paths; FIREWORKS_EXOCET_SCAN=all reads every practice puzzle's path).
 * Their Copy step lines are pinned in tests/eureka.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, bit, boxOf, colOf, rowOf, parseGrid, isSolved, sees } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames, describe as describeStep } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks } from '../src/content/hintMarks';
import { boardSvg, legendOf } from '../src/content/boardSvg';
import { digitTemplates } from '../src/engine/techniques/templates';
import { setEngineText, listAnd } from '../src/engine/text';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

afterEach(() => setEngineText('en', null));

const TECHS: Tech[] = ['FIREWORKS', 'EXOCET'];
const OTHER = [
  ['nb', engineNb],
  ['es', engineEs]
] as const;

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const digitsIn = (s: string) => [...s.replace(/r\dc\d/g, '').matchAll(/\d+/g)].map((m) => Number(m[0]));
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const uniq = (xs: number[]) => sorted([...new Set(xs)]);
const same = (a: number[], b: number[]) => JSON.stringify(uniq(a)) === JSON.stringify(uniq(b));
/** the cells and digits a sentence names, each once */
const namedIn = (s: string) => JSON.stringify([uniq(cellsIn(s)), uniq(digitsIn(s))]);
const valuesOf = (g: Grid) => Array.from(g.values).join('');
/** whether a cell holds the digit: placed there, or a candidate of an empty cell */
const holds = (g: Grid, c: number, d: number) => g.values[c] === d || (g.values[c] === 0 && !!(g.cands[c] & bit(d)));
const unitOf = (kind: string, n: number) => (kind === 'row' ? n - 1 : kind === 'column' ? 8 + n : 17 + n);
const drawnCells = (step: Step, frame: Frame | null, g: Grid) => sorted([...frameMarks(step, frame, (c) => g.values[c] > 0).cands.keys()]);
const drawnCands = (step: Step, frame: Frame | null, g: Grid) =>
  [...frameMarks(step, frame, (c) => g.values[c] > 0).cands].flatMap(([cell, m]) => [...m].map(([digit, kind]) => ({ cell, digit, kind })));
const bandsAt = (step: Step, frame: Frame | null, g: Grid) =>
  frameMarks(step, frame, (c) => g.values[c] > 0).bands.map((b) => `${b.unit}:${b.role}${b.within === undefined ? '' : `@${b.within}`}`);
const drawing = (step: Step, frame: Frame | null, g: Grid) => JSON.stringify([drawnCands(step, frame, g), bandsAt(step, frame, g)]);

// Fireworks' sentences
const FW_WING = /^Outside box (\d), (row|column) (\d) has ([\d, and]+) only in (r\dc\d)(?:, and no (\d)(?: or (\d))?)?\.$/;
const FW_CROSS = /^If one of ([\d, and]+) is in neither (r\dc\d) nor (r\dc\d), row (\d) and column (\d) both have it in box (\d), which holds only one: so it is in (r\dc\d), where they cross\.$/;
const FW_LEAD = /^Each of ([\d, and]+) must be in one of (r\dc\d), (r\dc\d) and (r\dc\d), so these three cells hold only ([\d, and]+)\. So /;
const FW_DESC = /^Outside box (\d), only (r\dc\d) in row (\d) and only (r\dc\d) in column (\d) can be (\d), (\d) or (\d)\. So each of the three is in (r\dc\d), in (r\dc\d) or in (r\dc\d), where the row and column cross, and these three cells hold nothing else\./;
const numbersOf = (s: string) => [...s.matchAll(/\d/g)].map((m) => Number(m[0]));

/** Fireworks' parts: the cross, its row's wing and its column's, the three digits, the box */
function fireworksParts(step: Step) {
  const A = step.primary![0].cell;
  const wings = [...new Set(step.secondary!.map((cd) => cd.cell))];
  const B = wings.find((c) => rowOf(c) === rowOf(A))!;
  const C = wings.find((c) => colOf(c) === colOf(A))!;
  const digits = uniq([...step.primary!, ...step.secondary!].map((cd) => cd.digit));
  return { A, B, C, digits, r: rowOf(A), c: colOf(A), b: boxOf(A) };
}

/**
 * What is wrong with a Fireworks walk, legend and description at its
 * position, given the puzzle's solution: each sentence read back and held to
 * the board, and the three cells to the solution
 */
function fireworksWrong(step: Step, g: Grid, sol: Grid, kinds: Set<string>): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const { A, B, C, digits, r, c, b } = fireworksParts(step);
  ok(B !== undefined && C !== undefined && B !== C && boxOf(B) !== b && boxOf(C) !== b, 'the wings');
  ok(digits.length === 3, 'three digits');
  ok(same(step.units!.map((u) => u.unit), [r, 9 + c]) && step.units!.every((u) => u.role === 'secondary'), 'the bands are the row and the column, dashed');
  // the solution: the three cells hold the three digits
  ok(same([A, B, C].map((x) => sol.values[x]), digits), 'the three cells do not hold the three digits');
  ok(step.eliminations.every((e) => sol.values[e.cell] !== e.digit && [A, B, C].includes(e.cell) && !digits.includes(e.digit)), 'a removal is the answer or not the cells’ other digit');
  const texts = walkFrames(step).map((f) => f.text);
  if (texts.length !== 4) return [`not a Fireworks walk: ${texts.join(' / ')}`];
  // each wing's line: outside the box, the digits only in the wing, the others not at all
  for (const [i, wing, kind, house] of [
    [0, B, 'row', r],
    [1, C, 'column', 9 + c]
  ] as const) {
    const m = FW_WING.exec(texts[i]);
    if (!m) {
      out.push(`not a wing's sentence: ${texts[i]}`);
      continue;
    }
    ok(Number(m[1]) === b + 1 && m[2] === kind && unitOf(m[2], Number(m[3])) === house && cellOf(m[5]) === wing, `the wing's house and cell: ${texts[i]}`);
    const has = numbersOf(m[4]);
    const lacks = [m[6], m[7]].filter(Boolean).map(Number);
    kinds.add(['a wing with all three', 'a wing lacking one', 'a wing lacking two'][lacks.length]);
    ok(same([...has, ...lacks], digits) && has.length + lacks.length === 3, `the three digits: ${texts[i]}`);
    const outside = UNITS[house].filter((x) => boxOf(x) !== b);
    for (const d of has) ok(holds(g, wing, d) && outside.every((x) => x === wing || !holds(g, x, d)), `${d} only in the wing: ${texts[i]}`);
    for (const d of lacks) ok(outside.every((x) => !holds(g, x, d)) && UNITS[house].every((x) => g.values[x] !== d), `no ${d}: ${texts[i]}`);
  }
  const cross = FW_CROSS.exec(texts[2]);
  if (cross) {
    ok(same(numbersOf(cross[1]), digits) && cellOf(cross[2]) === B && cellOf(cross[3]) === C, `the cross's digits and wings: ${texts[2]}`);
    ok(Number(cross[4]) === r + 1 && Number(cross[5]) === c + 1 && Number(cross[6]) === b + 1 && cellOf(cross[7]) === A, `the cross's houses: ${texts[2]}`);
    // what it says: a digit in neither wing is in the cross
    for (const d of digits) if (sol.values[B] !== d && sol.values[C] !== d) ok(sol.values[A] === d, `${d} in neither wing nor the cross`);
  } else out.push(`not the cross's sentence: ${texts[2]}`);
  const lead = FW_LEAD.exec(texts[3]);
  if (lead) ok(same(numbersOf(lead[1]), digits) && same([lead[2], lead[3], lead[4]].map(cellOf), [A, B, C]) && same(numbersOf(lead[5]), digits), `the lead: ${texts[3]}`);
  else out.push(`not Fireworks' lead: ${texts[3]}`);
  const desc = FW_DESC.exec(step.description);
  if (desc) {
    ok(Number(desc[1]) === b + 1 && cellOf(desc[2]) === B && Number(desc[3]) === r + 1 && cellOf(desc[4]) === C && Number(desc[5]) === c + 1, `the description's houses: ${step.description}`);
    ok(same([desc[6], desc[7], desc[8]].map(Number), digits) && same([desc[9], desc[10], desc[11]].map(cellOf), [A, B, C]) && cellOf(desc[11]) === A, `the description's digits and cells: ${step.description}`);
  } else out.push(`not Fireworks' description: ${step.description}`);
  ok(step.labels!.primary === `the cross, where row ${r + 1} meets column ${c + 1}: whichever of ${digits[0]}, ${digits[1]} and ${digits[2]} is in neither wing is here`, `the cross's label: ${step.labels!.primary}`);
  ok(step.labels!.secondary === `the wings: outside box ${b + 1}, each is the only cell of its row or column that can be ${digits[0]}, ${digits[1]} or ${digits[2]}`, `the wings' label: ${step.labels!.secondary}`);
  return out;
}

/** Exocet's parts: its base and targets in reading order, its digits, its lines and boxes */
function exocetParts(step: Step) {
  const base = uniq(step.primary!.map((cd) => cd.cell));
  const [T1, T2] = uniq(step.secondary!.map((cd) => cd.cell));
  const rows = rowOf(base[0]) === rowOf(base[1]);
  const lineOf = (x: number) => (rows ? rowOf(x) : colOf(x));
  const lineUnit = (l: number) => (rows ? l : 9 + l);
  const digits = uniq(step.primary!.map((cd) => cd.digit));
  return { base, T1, T2, rows, lineOf, lineUnit, digits, Q: boxOf(base[0]), X: boxOf(T1), Y: boxOf(T2), L: lineOf(base[0]), lA: lineOf(T1), lB: lineOf(T2) };
}

// Exocet's sentences
const EX_BASE = /^(r\dc\d) and (r\dc\d), where (row|column) (\d) meets box (\d), hold only ([\d, and]+) between them, and they see each other, so they hold two different ones of these digits\.$/;
const EX_TARGETS = /^The targets: (r\dc\d) in (row|column) (\d) and (r\dc\d) in (row|column) (\d)\. Whatever digit a base cell holds, (row|column) (\d) and box (\d) have it there, so box (\d) and box (\d) must put it in (row|column) (\d) and (row|column) (\d), one in each\.$/;
const EX_FORCED = /^If a base cell is (\d), box (\d) has no (\d) in (row|column) (\d), so box (\d) puts its (\d) in (row|column) (\d) and box (\d) in (row|column) (\d), and the only (\d) of box (\d) in (row|column) (\d) is the target (r\dc\d)\.$/;
const EX_NOBOX = /^If a base cell were (\d), box (\d) would need its (\d) in (row|column) (\d) or (row|column) (\d), but it has none there, so neither base cell can be (\d)\.$/;
const EX_NOLINE = /^If a base cell were (\d), (row|column) (\d) would need its (\d) from box (\d) or box (\d), but neither has one there, so neither base cell can be (\d)\.$/;
const EX_NONE = /^(?:The board leaves one way to place all nine (\d)s, and it uses neither base cell, so neither can be (\d)|None of the (\d+) ways the board leaves to place all nine (\d)s uses a base cell, so neither base cell can be (\d))\.$/;
/** the count of ways through the base with its noun after it ("6 of those ways"), never a bare number */
const EX_COUNT =
  /^If a base cell is (\d), so is a target: (?:the board leaves (one way|\d+ ways) to place all nine (\d)s, and (?:it|each) uses a base cell and a target|the board leaves (\d+) ways to place all nine (\d)s; (?:one of those ways uses a base cell, and it uses|(\d+) of those ways use a base cell, and each of them uses) a target too)\.$/;
/** where a target holds a digit the walk keeps out of the base, the step leaves it, and the sentence ends so */
const EX_LEFT = /, so (\d) is not one of the base's two digits\. This step does not remove it from (r\dc\d)(?: or (r\dc\d))?\.$/;

/**
 * A sentence keeping a digit out of the base, read back in the words the
 * removal's form has ("so neither base cell can be 5"), and the base cells
 * it says the step leaves the digit in, where it says so
 */
function outOfBase(text: string): { said: string; left: number[] | null } {
  const m = EX_LEFT.exec(text);
  if (!m) return { said: text, left: null };
  const neither = text.startsWith('The board leaves one way') ? 'neither can be' : 'neither base cell can be';
  return { said: `${text.slice(0, m.index)}, so ${neither} ${m[1]}.`, left: [m[2], m[3]].filter(Boolean).map((x) => cellOf(x!)) };
}
const EX_LEAD = /^The base holds two different digits, and each is in a target, so the two targets hold them both and nothing else\. So /;

/**
 * What is wrong with an Exocet walk and description at its position, given
 * the puzzle's solution: each sentence read back and held to the board (the
 * boxes and lines it names, where the digit can go in them, the ways the
 * board leaves to place it, counted again), and each claim to the solution
 */
function exocetWrong(step: Step, g: Grid, sol: Grid, kinds: Set<string>): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const { base, T1, T2, rows, lineOf, lineUnit, digits, Q, X, Y, L, lA, lB } = exocetParts(step);
  const kind = rows ? 'row' : 'column';
  const line = (k: string, n: string) => unitOf(k, Number(n));
  ok(base.length === 2 && sees(base[0], base[1]) && boxOf(base[1]) === Q && lineOf(base[1]) === L, 'the base: two cells of a mini-line');
  ok(new Set([Q, X, Y]).size === 3 && new Set([L, lA, lB]).size === 3 && Math.floor(L / 3) === Math.floor(lA / 3) && Math.floor(L / 3) === Math.floor(lB / 3), 'the targets: the band’s other two boxes and lines');
  ok(
    JSON.stringify(step.units) ===
      JSON.stringify([
        { unit: lineUnit(L), role: 'primary', within: 18 + Q },
        { unit: lineUnit(lA), role: 'secondary' },
        { unit: lineUnit(lB), role: 'secondary' }
      ]),
    `the bands: ${JSON.stringify(step.units)}`
  );
  // the solution: the targets hold the base's two digits
  const baseSol = base.map((x) => sol.values[x]);
  ok(same([sol.values[T1], sol.values[T2]], baseSol) && digits.includes(baseSol[0]) && digits.includes(baseSol[1]), 'the targets do not hold the base’s digits');
  ok(step.eliminations.every((e) => sol.values[e.cell] !== e.digit), 'a removal is the answer');
  const frames = walkFrames(step);
  const texts = frames.map((f) => f.text);
  if (texts.length !== digits.length + 3) return [`not an Exocet walk: ${texts.join(' / ')}`];
  const b1 = EX_BASE.exec(texts[0]);
  if (b1) ok(cellOf(b1[1]) === base[0] && cellOf(b1[2]) === base[1] && line(b1[3], b1[4]) === lineUnit(L) && Number(b1[5]) === Q + 1 && same(numbersOf(b1[6]), digits), `the base's sentence: ${texts[0]}`);
  else out.push(`not the base's sentence: ${texts[0]}`);
  const t = EX_TARGETS.exec(texts[1]);
  if (t) {
    ok(cellOf(t[1]) === T1 && line(t[2], t[3]) === lineUnit(lA) && cellOf(t[4]) === T2 && line(t[5], t[6]) === lineUnit(lB), `the targets: ${texts[1]}`);
    ok(line(t[7], t[8]) === lineUnit(L) && Number(t[9]) === Q + 1 && Number(t[10]) === X + 1 && Number(t[11]) === Y + 1 && line(t[12], t[13]) === lineUnit(lA) && line(t[14], t[15]) === lineUnit(lB), `the targets' houses: ${texts[1]}`);
    ok(t[2] === kind && t[7] === kind, `the targets' lines are the base's kind: ${texts[1]}`);
  } else out.push(`not the targets' sentence: ${texts[1]}`);
  const at = (box: number, l: number, d: number) => UNITS[18 + box].filter((x) => lineOf(x) === l && holds(g, x, d));
  const baseIs = (d: number) => baseSol.includes(d);
  // a digit kept out of the base: removed from every base cell holding it where no target holds it, and said so;
  // left where a target holds it, and said so, naming the base cells it stays in
  const outOf = (d: number, left: number[] | null, text: string) => {
    const inBase = base.filter((x) => holds(g, x, d));
    const fromBase = sorted(step.eliminations.filter((e) => e.digit === d && base.includes(e.cell)).map((e) => e.cell));
    if (holds(g, T1, d) || holds(g, T2, d)) {
      kinds.add('no base, left');
      ok(!!left && JSON.stringify(left) === JSON.stringify(inBase) && !fromBase.length, `the step leaves ${d} in the base, so the frame must say it does and where: ${text}`);
    } else ok(!left && JSON.stringify(fromBase) === JSON.stringify(inBase), `the frame says neither base cell can be ${d}, so the step must remove it from both: ${text}`);
  };
  digits.forEach((d, i) => {
    const text = texts[i + 2];
    const f = frames[i + 2];
    const { said, left } = outOfBase(text);
    // a frame draws its one digit; one that keeps it out of the base while the step leaves it, none
    ok(!!f.digits && JSON.stringify([...f.digits]) === JSON.stringify(left ? [] : [d]), `frame ${i + 3} draws ${left ? 'no digit' : 'one digit'}: ${text}`);
    let m: RegExpExecArray | null;
    if ((m = EX_FORCED.exec(text))) {
      kinds.add('forced');
      const [P, M] = [Number(m[2]) - 1, line(m[4], m[5])];
      ok([m[1], m[3], m[7], m[13]].every((x) => Number(x) === d), `the digit: ${text}`);
      // the box with no place in the line rules out the crossed way: box X in line B, or box Y in line A
      ok((P === X && M === lineUnit(lB)) || (P === Y && M === lineUnit(lA)), `the box and line that rule out the other way: ${text}`);
      ok(UNITS[18 + P].every((x) => !UNITS[M].includes(x) || !holds(g, x, d)), `box ${P + 1} has a ${d} in that line: ${text}`);
      ok(Number(m[6]) === X + 1 && line(m[8], m[9]) === lineUnit(lA) && Number(m[10]) === Y + 1 && line(m[11], m[12]) === lineUnit(lB), `the targets' boxes and lines: ${text}`);
      const [F, N, T] = [Number(m[14]) - 1, line(m[15], m[16]), cellOf(m[17])];
      ok((F === X && N === lineUnit(lA) && T === T1) || (F === Y && N === lineUnit(lB) && T === T2), `the forced target: ${text}`);
      const places = UNITS[18 + F].filter((x) => UNITS[N].includes(x) && holds(g, x, d));
      ok(JSON.stringify(places) === JSON.stringify([T]), `the only ${d} of box ${F + 1} in that line is not the target: ${text}`);
      kinds.add(T === T1 ? 'forced T1' : 'forced T2');
      if (baseIs(d)) ok(sol.values[T1] === d || sol.values[T2] === d, `${d} in the base and no target: ${text}`);
    } else if ((m = EX_NOBOX.exec(said))) {
      kinds.add('no base, box');
      outOf(d, left, text);
      const P = Number(m[2]) - 1;
      ok(Number(m[1]) === d && Number(m[3]) === d && Number(m[8]) === d && (P === X || P === Y), `the digit and box: ${text}`);
      ok(same([line(m[4], m[5]), line(m[6], m[7])], [lineUnit(lA), lineUnit(lB)]), `the lines: ${text}`);
      ok(!at(P, lA, d).length && !at(P, lB, d).length, `box ${P + 1} has a ${d} in those lines: ${text}`);
      ok(!baseIs(d), `the base holds ${d}: ${text}`);
    } else if ((m = EX_NOLINE.exec(said))) {
      kinds.add('no base, line');
      outOf(d, left, text);
      const M = line(m[2], m[3]);
      ok(Number(m[1]) === d && Number(m[4]) === d && Number(m[7]) === d && (M === lineUnit(lA) || M === lineUnit(lB)), `the digit and line: ${text}`);
      ok(same([Number(m[5]) - 1, Number(m[6]) - 1], [X, Y]), `the boxes: ${text}`);
      const l = M === lineUnit(lA) ? lA : lB;
      ok(!at(X, l, d).length && !at(Y, l, d).length, `a box has a ${d} in that line: ${text}`);
      ok(!baseIs(d), `the base holds ${d}: ${text}`);
    } else {
      // what the proof counted, counted again
      const all = digitTemplates(g, d, 20000)!;
      const through = all.filter((tp) => tp.includes(base[0]) || tp.includes(base[1]));
      ok(through.every((tp) => tp.includes(T1) || tp.includes(T2)), `a way through the base misses the targets: ${text}`);
      if ((m = EX_NONE.exec(said))) {
        kinds.add('no base, counted');
        outOf(d, left, text);
        const n = m[1] ? 1 : Number(m[3]);
        ok(Number(m[1] ?? m[4]) === d && Number(m[2] ?? m[5]) === d && n === all.length && !through.length, `the count: ${text}`);
        ok(!baseIs(d), `the base holds ${d}: ${text}`);
      } else if (!left && (m = EX_COUNT.exec(text))) {
        kinds.add(m[2] ? 'counted, every way' : m[6] ? 'counted, several' : 'counted, one');
        ok(Number(m[1]) === d && Number(m[3] ?? m[5]) === d, `the digit: ${text}`);
        const n = m[2] ? (m[2] === 'one way' ? 1 : Number(m[2].split(' ')[0])) : Number(m[4]);
        const k = m[2] ? n : m[6] ? Number(m[6]) : 1;
        ok(n === all.length && k === through.length && k > 0, `the count: ${text} (${all.length}, ${through.length})`);
        if (baseIs(d)) ok(sol.values[T1] === d || sol.values[T2] === d, `${d} in the base and no target: ${text}`);
      } else out.push(`not a base digit's sentence: ${text}`);
    }
  });
  const dead = digits.filter((d) => !holds(g, T1, d) && !holds(g, T2, d));
  const intoTargets = step.eliminations.some((e) => e.cell === T1 || e.cell === T2);
  if (intoTargets) ok(EX_LEAD.test(texts.at(-1)!), `the lead: ${texts.at(-1)}`);
  else ok(/^So /.test(texts.at(-1)!), `no lead without a target's removal: ${texts.at(-1)}`);
  kinds.add(intoTargets ? (dead.length ? 'removals from both' : 'removals from the targets') : 'removals from the base');
  kinds.add(rows ? 'rows' : 'columns');
  kinds.add(`${digits.length} digits`);
  const desc = `${base.map((x) => `r${rowOf(x) + 1}c${colOf(x) + 1}`).join(' and ')} hold two different digits of `;
  ok(step.description.startsWith(desc) && step.description.includes(` in the base without one in r${rowOf(T1) + 1}c${colOf(T1) + 1} or r${rowOf(T2) + 1}c${colOf(T2) + 1}. `), `the description: ${step.description}`);
  ok(dead.length ? step.description.includes(`and the base cannot hold `) : !/cannot hold/.test(step.description), `the description's dead digits: ${step.description}`);
  return out;
}

/**
 * What is wrong with a walk's drawing: a frame names a cell it does not
 * draw (an Exocet's digit frame names cells of its boxes and lines, which
 * its bands draw), two frames in a row draw the same, a band comes before
 * its frame, a digit frame draws another digit, or a digit the step leaves
 * in the base, and a frame's legend names, in its words, other than what
 * the frame draws (G23)
 */
function drawnWrong(step: Step, g: Grid): string[] {
  const out: string[] = [];
  const frames = walkFrames(step);
  frames.forEach((f, i) => {
    if (i && drawing(step, frames[i - 1], g) === drawing(step, f, g)) out.push(`frames ${i} and ${i + 1} draw the same`);
  });
  const at = frames.map((f) => bandsAt(step, f, g).sort());
  const legends = frames.map((f) => legendOf(step, valuesOf(g), f).map((e) => `${e.kind}: ${e.label}`));
  const legendWrong = (want: string[][]) => {
    legends.forEach((l, i) => {
      if (JSON.stringify(l) !== JSON.stringify(want[i])) out.push(`frame ${i + 1}'s legend: ${l.join(' / ')}, not ${want[i]?.join(' / ')}`);
    });
  };
  if (step.tech === 'FIREWORKS') {
    const { A, B, C, r, c } = fireworksParts(step);
    const cells = frames.map((f) => drawnCells(step, f, g));
    const want = [[B], [B, C], [A, B, C], [A, B, C]].map(sorted);
    if (JSON.stringify(cells) !== JSON.stringify(want)) out.push(`the cells by frame: ${JSON.stringify(cells)}`);
    const row = `${r}:secondary`;
    const col = `${9 + c}:secondary`;
    const both = [row, col].sort();
    if (JSON.stringify(at) !== JSON.stringify([[row], both, both, both])) out.push(`the bands by frame: ${JSON.stringify(at)}`);
    // the row's wing alone, then the wings, then the cross with them, then the removals
    const { b, digits } = fireworksParts(step);
    const [d1, d2, d3] = digits;
    const cross = `primary: the cross, where row ${r + 1} meets column ${c + 1}: whichever of ${d1}, ${d2} and ${d3} is in neither wing is here`;
    const wings = `secondary: the wings: outside box ${b + 1}, each is the only cell of its row or column that can be ${d1}, ${d2} or ${d3}`;
    const rowWing = `secondary: the row's wing: the only cell of row ${r + 1} outside box ${b + 1} that can be ${d1}, ${d2} or ${d3}`;
    legendWrong([[rowWing], [wings], [cross, wings], ['elim: remove', cross, wings]]);
  } else {
    const { base, T1, T2, digits, lineUnit, L, lA, lB, Q, rows } = exocetParts(step);
    const cells = frames.map((f) => drawnCells(step, f, g));
    if (JSON.stringify(cells[0]) !== JSON.stringify(base)) out.push(`frame 1 draws other cells than the base: ${cells[0]}`);
    if (JSON.stringify(cells[1]) !== JSON.stringify(sorted([...base, T1, T2]))) out.push(`frame 2 draws other cells than the base and targets: ${cells[1]}`);
    const mini = `${lineUnit(L)}:primary@${18 + Q}`;
    const lines = [`${lineUnit(lA)}:secondary`, `${lineUnit(lB)}:secondary`];
    const all = [mini, ...lines].sort();
    if (JSON.stringify(at) !== JSON.stringify([[mini], ...frames.slice(1).map(() => all)])) out.push(`the bands by frame: ${JSON.stringify(at)}`);
    // the legend: the base, then the targets by their lines, then each digit in the base and the targets, or the
    // bands alone where the frame draws none of a role, then the step's own words with the removals
    const lineName = (l: number) => `${rows ? 'row' : 'column'} ${l + 1}`;
    const [A, B] = [lineName(lA), lineName(lB)];
    const theBase = `primary: the base: two different digits of ${listAnd(digits)}, one in each cell`;
    const want = [[theBase], [theBase, `secondary: the targets, in ${A} and ${B}`]];
    digits.forEach((d, i) => {
      const f = frames[i + 2];
      const drawn = drawnCands(step, f, g);
      // a digit the walk keeps out of the base that the step leaves: drawn in no cell, so not read as the base's
      const left = !!outOfBase(f.text).left;
      const inTargets = holds(g, T1, d) || holds(g, T2, d);
      const cells = left ? [] : [...base, T1, T2].filter((x) => g.values[x] === 0 && g.cands[x] & bit(d));
      if (drawn.some((cd) => cd.digit !== d) || !same(drawn.map((cd) => cd.cell), cells) || drawn.length !== cells.length)
        out.push(`frame ${i + 3} draws other than the ${left ? 'bands' : `base's and targets' ${d}s`}: ${JSON.stringify(drawn)}`);
      if (drawn.some((cd) => cd.kind !== (base.includes(cd.cell) ? 'primary' : 'secondary'))) out.push(`frame ${i + 3} draws a base or target ${d} in another colour: ${JSON.stringify(drawn)}`);
      want.push([
        left ? `primary: the base, where ${lineName(L)} meets box ${Q + 1}` : `primary: ${d} in the base`,
        inTargets && !left ? `secondary: ${d} in the targets` : `secondary: the targets' lines, ${A} and ${B}`
      ]);
    });
    want.push(['elim: remove', theBase, `secondary: the targets, in ${A} and ${B}: each digit the base holds is in one of them`]);
    legendWrong(want);
    const last = drawnCands(step, frames.at(-1)!, g);
    if (!step.eliminations.every((e) => last.some((cd) => cd.cell === e.cell && cd.digit === e.digit && cd.kind === 'elim'))) out.push('the last frame does not draw every removal');
  }
  return out;
}

/** every find of the two techniques along the solve paths of these puzzles, with the puzzle's solution */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Grid; puzzle: string }[] {
  const out: { step: Step; g: Grid; sol: Grid; puzzle: string }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(g)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      for (const tech of TECHS) {
        const step = findStep(tech, g);
        if (step?.tech === tech) out.push({ step, g: { values: new Uint8Array(g.values), cands: new Uint16Array(g.cands), given: g.given }, sol, puzzle });
      }
      const s = findNextStep(g);
      if (!s) break;
      applyStep(g, s);
    }
  }
  return out;
}

/** a technique's step at its stored example's position, as its finder takes it now */
const found = (tech: Tech): Step => findStep(tech, exampleGrid(EXAMPLES[tech]!))!;

/**
 * practice puzzles whose paths hold an Exocet of every shape the walk words
 * (both orientations, three and four base digits, a digit forced into either
 * target, a base digit kept out by a box or a line, each count, removals
 * from the targets, the base and both), found by FIREWORKS_EXOCET_SCAN=all
 */
const SAMPLE = [
  '.6174......48.2.3......5.6782..1..5.......9.......3.82..7...5..64..5......2....7.',
  '83.7.....6....3.1..2.861....1.5.....98.....27.....8.5....487.3..4.6....9.....9.72',
  '53.4...7.6....1.35....85....4......3..7...1..1......8....29....38.6....1.9...8.52',
  '2...4...........75.1.8.74...4..1..6...69.35...3..5..2...37.2.5.48...........3...7',
  '....9..8.1.6.4....72....3....31....79...7...66....92....7....21....2.7.3.9..6....',
  '...3...5.65..7.2.9..2..96..367.....2...2.7...1.....786..68..4..9.5.4..63.7...3...',
  '.....2....9.7..84.....4.3...8...94...4..3....27.1.......69.5.........18.4..21...9',
  // a digit kept out of the base that a target holds, which the step leaves (phase 6 batch 3's review)
  '..7..48..1.36........2..96.....3...97.1.......8....5..8....7.....4.....3....8.12.',
  '.....931......2..5.8...3.921.4...9...3..1..2...7...4.162.3...4.3..8......952.....'
];

describe('Fireworks and Exocet walk their argument (H1, M4)', () => {
  it('as the report asks, in the stored examples, in English, Norwegian and Spanish', () => {
    const want: Record<string, Partial<Record<Tech, string[]>>> = {
      en: {
        FIREWORKS: [
          'Outside box 8, row 8 has 4 and 8 only in r8c3, and no 1.',
          'Outside box 8, column 6 has 1 and 8 only in r2c6, and no 4.',
          'If one of 1, 4 and 8 is in neither r8c3 nor r2c6, row 8 and column 6 both have it in box 8, which holds only one: so it is in r8c6, where they cross.',
          'Each of 1, 4 and 8 must be in one of r2c6, r8c3 and r8c6, so these three cells hold only 1, 4 and 8. So 5 and 6 are removed from r2c6.'
        ],
        EXOCET: [
          'r9c8 and r9c9, where row 9 meets box 9, hold only 2, 5 and 6 between them, and they see each other, so they hold two different ones of these digits.',
          'The targets: r7c3 in row 7 and r8c5 in row 8. Whatever digit a base cell holds, row 9 and box 9 have it there, so box 7 and box 8 must put it in row 7 and row 8, one in each.',
          'If a base cell is 2, box 7 has no 2 in row 8, so box 7 puts its 2 in row 7 and box 8 in row 8, and the only 2 of box 8 in row 8 is the target r8c5.',
          'If a base cell is 5, so is a target: the board leaves 9 ways to place all nine 5s; 6 of those ways use a base cell, and each of them uses a target too.',
          'If a base cell is 6, so is a target: the board leaves 8 ways to place all nine 6s; 5 of those ways use a base cell, and each of them uses a target too.',
          'The base holds two different digits, and each is in a target, so the two targets hold them both and nothing else. So 8 is removed from r8c5.'
        ]
      },
      nb: {
        FIREWORKS: [
          'Utenfor boks 8 står 4 og 8 i rad 8 bare i r8c3, og ingen 1-er.',
          'Utenfor boks 8 står 1 og 8 i kolonne 6 bare i r2c6, og ingen 4-er.',
          'Hvis ett av tallene 1, 4 og 8 står i verken r8c3 eller r2c6, har både rad 8 og kolonne 6 det i boks 8, som bare har ett: da står det i r8c6, der de krysser hverandre.',
          'Hvert av tallene 1, 4 og 8 må stå i en av r2c6, r8c3 og r8c6, så disse tre rutene har bare 1, 4 og 8. Så fjernes 5 og 6 fra r2c6.'
        ],
        EXOCET: [
          'r9c8 og r9c9, der rad 9 møter boks 9, har til sammen bare 2, 5 og 6, og de ser hverandre, så de har to ulike av disse tallene.',
          'Målrutene: r7c3 i rad 7 og r8c5 i rad 8. Uansett hvilket tall en basisrute har, har rad 9 og boks 9 det der, så boks 7 og boks 8 må sette det i rad 7 og rad 8, ett i hver.',
          'Hvis en basisrute er 2, har boks 7 ingen 2-er i rad 8, så boks 7 setter 2-eren sin i rad 7 og boks 8 sin i rad 8, og den eneste 2-eren i boks 8 i rad 8 er målruten r8c5.',
          'Hvis en basisrute er 5, er også en målrute 5: brettet gir 9 måter å plassere alle ni 5-erne på; 6 av disse måtene bruker en basisrute, og hver av dem bruker også en målrute.',
          'Hvis en basisrute er 6, er også en målrute 6: brettet gir 8 måter å plassere alle ni 6-erne på; 5 av disse måtene bruker en basisrute, og hver av dem bruker også en målrute.',
          'Basen har to ulike tall, og hvert av dem står i en målrute, så de to målrutene har begge tallene og ikke noe annet. Så fjernes 8 fra r8c5.'
        ]
      },
      es: {
        FIREWORKS: [
          'Fuera de la caja 8, la fila 8 solo tiene 4 y 8 en r8c3, y ningún 1.',
          'Fuera de la caja 8, la columna 6 solo tiene 1 y 8 en r2c6, y ningún 4.',
          'Si uno de los números 1, 4 y 8 no está ni en r8c3 ni en r2c6, la fila 8 y la columna 6 lo tienen las dos en la caja 8, que solo tiene uno: así que está en r8c6, donde se cruzan.',
          'Cada uno de los números 1, 4 y 8 debe estar en una de r2c6, r8c3 y r8c6, así que esas tres casillas solo tienen 1, 4 y 8. Por tanto, se eliminan los candidatos 5 y 6 de r2c6.'
        ],
        EXOCET: [
          'r9c8 y r9c9, donde la fila 9 se cruza con la caja 9, solo tienen 2, 5 y 6 entre las dos, y se ven entre sí, así que tienen dos números distintos de estos.',
          'Los objetivos: r7c3 en la fila 7 y r8c5 en la fila 8. Sea cual sea el número de una casilla base, la fila 9 y la caja 9 lo tienen ahí, así que la caja 7 y la caja 8 deben ponerlo en la fila 7 y en la fila 8, uno en cada una.',
          'Si una casilla base es 2, la caja 7 no tiene ningún 2 en la fila 8, así que la caja 7 pone su 2 en la fila 7 y la caja 8 el suyo en la fila 8, y el único 2 de la caja 8 en la fila 8 es el objetivo r8c5.',
          'Si una casilla base es 5, también lo es un objetivo: el tablero deja 9 formas de colocar los nueve 5; 6 de esas formas usan una casilla base, y cada una de ellas usa también un objetivo.',
          'Si una casilla base es 6, también lo es un objetivo: el tablero deja 8 formas de colocar los nueve 6; 5 de esas formas usan una casilla base, y cada una de ellas usa también un objetivo.',
          'La base tiene dos números distintos, y cada uno está en un objetivo, así que los dos objetivos tienen esos dos números y nada más. Por tanto, se elimina el 8 de r8c5.'
        ]
      }
    };
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      for (const [tech, frames] of Object.entries(want[lang])) expect(walkFrames(found(tech as Tech)).map((f) => f.text), `${lang} ${tech}`).toEqual(frames);
    }
  });

  it("says a digit it keeps out of the base, which the step leaves, is not one of the base's two digits, draws it in no cell, and says the step does not remove it", () => {
    // phase 6 batch 3's review: the base r7c5 {2,6}, r8c5 {1,2,5}, the targets r1c4 {1,5} and r5c6 {2,6,9}; the
    // walk keeps 5 out of the base, but r1c4 holds 5, so the step removes only r5c6's 9; and the base r2c5, r3c5,
    // where r5c4 holds 6
    const at = (puzzle: string, steps: number): Grid => {
      const g = parseGrid(puzzle)!;
      for (let i = 0; i < steps; i++) applyStep(g, findNextStep(g)!);
      return g;
    };
    const cases = [
      {
        g: at('..7..48..1.36........2..96.....3...97.1.......8....5..8....7.....4.....3....8.12.', 45),
        frame: 4,
        en: "If a base cell were 5, column 6 would need its 5 from box 2 or box 5, but neither has one there, so 5 is not one of the base's two digits. This step does not remove it from r8c5.",
        nb: 'Hvis en basisrute var 5, måtte kolonne 6 få 5-eren sin fra boks 2 eller boks 5, men ingen av dem har en der, så 5 er ikke ett av basens to tall. Dette steget fjerner det ikke fra r8c5.',
        es: 'Si una casilla base fuera 5, la columna 6 tendría que recibir su 5 de la caja 2 o de la caja 5, pero ninguna tiene uno ahí, así que el 5 no es uno de los dos números de la base. Este paso no lo elimina de r8c5.',
        legend: ['primary: the base, where column 5 meets box 8', "secondary: the targets' lines, column 4 and column 6"],
        elims: [{ cell: cellOf('r5c6'), digit: 9 }]
      },
      {
        g: at('.....931......2..5.8...3.921.4...9...3..1..2...7...4.162.3...4.3..8......952.....', 18),
        frame: 4,
        en: "None of the 17 ways the board leaves to place all nine 6s uses a base cell, so 6 is not one of the base's two digits. This step does not remove it from r2c5.",
        nb: 'Ingen av de 17 måtene brettet gir for å plassere alle ni 6-erne, bruker en basisrute, så 6 er ikke ett av basens to tall. Dette steget fjerner det ikke fra r2c5.',
        es: 'Ninguna de las 17 formas que deja el tablero de colocar los nueve 6 usa una casilla base, así que el 6 no es uno de los dos números de la base. Este paso no lo elimina de r2c5.',
        legend: ['primary: the base, where column 5 meets box 2', "secondary: the targets' lines, column 4 and column 6"],
        elims: [{ cell: cellOf('r7c6'), digit: 1 }]
      }
    ];
    for (const { g, frame, legend, elims, ...words } of cases) {
      const step = findStep('EXOCET', g)!;
      expect(step.eliminations).toEqual(elims);
      const f = walkFrames(step)[frame];
      expect(f.text).toBe(words.en);
      expect(drawnCands(step, f, g)).toEqual([]);
      expect(legendOf(step, valuesOf(g), f).map((e) => `${e.kind}: ${e.label}`)).toEqual(legend);
      expect(drawnWrong(step, g)).toEqual([]);
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        expect(walkFrames(findStep('EXOCET', g)!)[frame].text, lang).toBe(words[lang]);
        setEngineText('en', null);
      }
    }
  });

  it('leads the description with the argument, not the name, and says the legend exactly (L2, L3)', () => {
    const shown = (tech: Tech) => describeStep(found(tech));
    expect(shown('FIREWORKS')).toBe(
      'Outside box 8, only r8c3 in row 8 and only r2c6 in column 6 can be 1, 4 or 8. So each of the three is in r8c3, in r2c6 or in r8c6, where the row and column cross, and these three cells hold nothing else. Here, 5 and 6 are removed from r2c6.'
    );
    expect(shown('EXOCET')).toBe(
      "r9c8 and r9c9 hold two different digits of 2, 5 and 6, and the board leaves no way to place either of them in the base without one in r7c3 or r8c5. So these targets hold the base's two digits and nothing else. Here, 8 is removed from r8c5."
    );
    const legend = (tech: Tech) => legendOf(found(tech), EXAMPLES[tech]!.values).map((e) => `${e.kind}: ${e.label}`);
    expect(legend('FIREWORKS')).toEqual([
      'elim: remove',
      'primary: the cross, where row 8 meets column 6: whichever of 1, 4 and 8 is in neither wing is here',
      'secondary: the wings: outside box 8, each is the only cell of its row or column that can be 1, 4 or 8'
    ]);
    expect(legend('EXOCET')).toEqual([
      'elim: remove',
      'primary: the base: two different digits of 2, 5 and 6, one in each cell',
      'secondary: the targets, in row 7 and row 8: each digit the base holds is in one of them'
    ]);
    for (const [lang, table] of OTHER) {
      setEngineText(lang, table);
      for (const tech of TECHS) {
        const s = found(tech);
        expect(s.description, `${lang} ${tech}`).not.toMatch(/^(Fireworks|Exocet)/);
        // the digits as a player says them, never 1/4/8 (L1)
        for (const t of [s.description, ...Object.values(s.labels ?? {})]) expect(t, `${lang} ${tech}`).not.toMatch(/\d\/\d/);
      }
    }
  });

  it("draws Fireworks' row and column dashed, crossing at the cross, and Exocet's mini-line and target lines, on the board and in the Learn diagram", () => {
    const fw = found('FIREWORKS');
    expect(fw.units).toEqual([
      { unit: 7, role: 'secondary' },
      { unit: 14, role: 'secondary' }
    ]);
    const ex = found('EXOCET');
    expect(ex.units).toEqual([
      { unit: 8, role: 'primary', within: 26 },
      { unit: 6, role: 'secondary' },
      { unit: 7, role: 'secondary' }
    ]);
    // the mini-line's band in the Learn diagram: three cells of row 9, in box 9
    const svg = boardSvg(EXAMPLES.EXOCET!, 'Exocet');
    const fills = [...svg.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="[^"]+" fill-opacity="[\d.]+"\/>/g)].map((m) => m.slice(1, 5).map(Number));
    const [, , w, h] = fills.find(([, , ww, hh]) => hh < ww && ww < 4 * hh)!;
    expect(w / h).toBeCloseTo(3, 5);
    expect(fills.filter(([, , ww, hh]) => Math.abs(ww / hh - 9) < 0.01).length).toBe(2);
    for (const tech of TECHS) {
      const g = exampleGrid(EXAMPLES[tech]!);
      expect(drawnWrong(findStep(tech, g)!, g), tech).toEqual([]);
    }
  });

  it('says only what is true, and draws what it says, at every find along practice solve paths, in the three languages', () => {
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    const puzzles =
      env.FIREWORKS_EXOCET_SCAN === 'all'
        ? [...new Set(pools.map((e) => e.puzzle))]
        : [...new Set([...pools.filter((e) => e.techs.includes('FIREWORKS')).slice(0, 4).map((e) => e.puzzle), ...SAMPLE])];
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const kinds = new Set<string>();
    const shapes = new Map<string, Set<string>>();
    for (const { step, g, sol, puzzle } of finds) {
      const at = `${step.tech} ${step.description}`;
      const before = new Set(kinds);
      const errs = step.tech === 'FIREWORKS' ? fireworksWrong(step, g, sol, kinds) : exocetWrong(step, g, sol, kinds);
      for (const w of [...errs, ...drawnWrong(step, g)]) wrong.push(`${at}: ${w}`);
      for (const k of kinds) if (!before.has(k)) shapes.set(k, new Set([...(shapes.get(k) ?? []), puzzle]));
      const english = walkFrames(step).map((f) => namedIn(f.text));
      const words = [step.description, ...Object.values(step.labels ?? {})].map(namedIn);
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        const there = findStep(step.tech, g)!;
        if (JSON.stringify(walkFrames(there).map((f) => namedIn(f.text))) !== JSON.stringify(english)) wrong.push(`${lang} ${at}: names other cells or digits than English`);
        if (JSON.stringify([there.description, ...Object.values(there.labels ?? {})].map(namedIn)) !== JSON.stringify(words)) wrong.push(`${lang} ${at}: the description or legend names other cells or digits than English`);
        setEngineText('en', null);
      }
    }
    // the practice puzzles first showing each shape, for SAMPLE
    if (env.FIREWORKS_EXOCET_SCAN === 'all') console.info(JSON.stringify([...shapes].map(([k, ps]) => [k, [...ps][0]])), finds.length);
    expect(wrong.slice(0, 10)).toEqual([]);
    for (const tech of TECHS) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(env.FIREWORKS_EXOCET_SCAN === 'all' ? 500 : 10);
    // every shape the walk words, in the sample too
    for (const k of [
      'a wing with all three',
      'a wing lacking one',
      'a wing lacking two',
      'forced',
      'forced T1',
      'forced T2',
      'no base, box',
      'no base, line',
      'no base, counted',
      'no base, left',
      'counted, one',
      'counted, several',
      'counted, every way',
      'removals from the targets',
      'removals from the base',
      'removals from both',
      'rows',
      'columns',
      '3 digits',
      '4 digits'
    ])
      expect(kinds.has(k), k).toBe(true);
  });
});
