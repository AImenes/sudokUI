/**
 * XY-Wing and XYZ-Wing walk in their finders' own sentences and are
 * coloured by what each digit does, and WXYZ-Wing is drawn and walked as
 * the ALS-XZ it is (docs/hint-readability-2026-11.md, H1, M3 and L3):
 * - the stored examples walk as the report asks, in English, Norwegian and
 *   Spanish: the pivot, each pincer's case, the either-way (XYZ-Wing's
 *   third case, the pivot itself, with it); a WXYZ-Wing's bivalue cell as
 *   set A and its lock, its three cells as set B, the link on x between
 *   them, B's lock, and the either-way of the two sets;
 * - frame 1 draws exactly the cells it names, every frame draws every cell
 *   it names and something new; a pincer's digit shared with the pivot is
 *   the pattern's, every z is in one role (gold); a WXYZ-Wing's two sets
 *   are lettered tiles, its chain's truth drawn as ALS-XZ's is, no role;
 * - a walk frame's legend names only what the frame draws: a wing's pivot
 *   before its pincers, one pincer before both (phase6-batch1-review.md),
 *   in the hint panel as in the Learn legend;
 * - every sentence is true of its board and of the puzzle's solution at
 *   every find of the three techniques along practice solve paths, and
 *   Norwegian and Spanish name the same cells and digits (a sample of the
 *   paths; WING_SCAN=all reads every practice puzzle's path).
 * Their Copy step lines are pinned in tests/eureka.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { env } from 'node:process';
import { Grid, UNITS, bit, digitsOf, parseGrid, isSolved, sees, cellName } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { stepText } from '../src/content/eureka';
import { setEngineText } from '../src/engine/text';
import { deriveTruth } from '../src/engine/truth';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';
import { wordProblems } from './setWords';
import { setProblems } from './chainSets';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { HintPanel } = await import('../src/ui/HintPanel');

afterEach(() => setEngineText('en', null));

const WINGS: Tech[] = ['XY_WING', 'XYZ_WING', 'WXYZ_WING'];
const OTHER = [
  ['nb', engineNb],
  ['es', engineEs]
] as const;

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const digitsIn = (s: string) => [...s.replace(/r\dc\d/g, '').matchAll(/\d/g)].map((m) => Number(m[0]));
const maskOf = (ds: number[]) => ds.reduce((m, d) => m | bit(d), 0);
/** the cell is empty and holds exactly these candidates */
const holdsOnly = (g: Grid, cell: number, ds: number[]) => g.values[cell] === 0 && g.cands[cell] === maskOf(ds);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const same = (a: number[], b: number[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
const houseOf = (kind: string, n: string) => (kind === 'row' ? 0 : kind === 'column' ? 9 : 18) + Number(n) - 1;
/** a grid's digits as an example stores them, '0' for an empty cell */
const valuesOf = (g: Grid) => Array.from(g.values).join('');

/** the cells a view draws a mark in */
const drawnCells = (step: Step, frame: Frame | null, g: Grid) => sorted([...frameMarks(step, frame, (c) => g.values[c] > 0).cands.keys()]);
/** everything a view draws, to tell two frames apart */
const drawing = (step: Step, frame: Frame | null, g: Grid) => {
  const m = frameMarks(step, frame, (c) => g.values[c] > 0);
  return JSON.stringify({ cands: [...m.cands].map(([c, d]) => [c, [...d]]).sort(), bands: m.bands.map((b) => b.unit).sort(), sets: m.sets });
};
/** each candidate a view draws, by its kind: r4c3:4:false */
const kindsAt = (step: Step, frame: Frame | null, g: Grid) =>
  [...frameMarks(step, frame, (c) => g.values[c] > 0).cands].flatMap(([c, m]) => [...m].map(([d, k]) => `${cellName(c)}:${d}:${k}`)).sort();

const PIVOT2 = /^The pivot (r\dc\d) holds only (\d) and (\d)\.$/;
const PIVOT3 = /^The pivot (r\dc\d) holds only (\d), (\d) and (\d)\.$/;
const PINCER = /^If (r\dc\d) is (\d), the pincer (r\dc\d) \(only (\d) and (\d)\) must be (\d)\.$/;
const XY_LEAD = /^Either way a pincer is (\d); (.+?) (sees|see) both\. So /;
const XYZ_LEAD = /^Or the pivot is (\d) itself\. Whichever digit it takes, one of the three cells is \1; (.+?) (sees|see) all three\. So /;
// the WXYZ-Wing's walk, the ALS-XZ's (src/engine/hintFrames.ts linkText, setText, endsText)
const SET_A = /^Set A is the cell (r\dc\d), which holds only (\d) and (\d): if it is not (\d), it must be (\d)\.$/;
const SET_B = /^Set B: the 3 cells (.+) of (row|column|box) (\d) hold only (.+): one digit more than cells\. Without any one of these digits, the others fill the cells\.$/;
const LINK_X = /^(?:In (row|column|box) (\d), every|Every) (\d) of set A sees every \3 of set B: if (r\dc\d) is \3, (?:(r\dc\d) cannot be|none of (.+) can be) \3\.$/;
const LOCK_B = /^If set B holds no (\d), its other 3 digits fill its 3 cells, so (?:one of (.+)|(r\dc\d)) must be (\d)\.$/;
const ENDS = /^Set A or set B holds an? (\d): if A holds none, B holds one\. Each removed \1 sees every \1 of both\. So \1 is removed from (.+)\.$/;
const WXYZ_DESCRIPTION =
  /^Either set A, the cell (r\dc\d), is (\d), or it is (\d), and then set B, in (row|column|box) (\d), holds an? (\d)\. Set A or set B holds an? (\d), so no cell that sees every (\d) of both can be (\d)\.$/;

/**
 * What is wrong with a wing's English walk at its position, given the
 * puzzle's solution: each sentence read back and held to the board (what
 * a cell holds, what sees what) and to the solution (an either-way is
 * true, a case's consequence follows where the solution takes the case)
 */
function wrongIn(step: Step, g: Grid, sol: Grid): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const texts = walkFrames(step).map((f) => f.text);
  const elims = step.eliminations.map((e) => e.cell);
  const z = step.eliminations[0].digit;
  ok(step.eliminations.every((e) => e.digit === z && sol.values[e.cell] !== z && g.cands[e.cell] & bit(z)), 'a removal is the answer');
  /** a pincer's case: names the pivot and its digit, the pincer holds only the two digits named and sees the pivot, and is z where the pivot takes the case */
  const pincer = (text: string, pivot: number, digit?: number): number => {
    const m = PINCER.exec(text);
    if (!m) return out.push(`not a pincer's case: ${text}`), -1;
    const w = cellOf(m[3]);
    const [a, b, left] = [Number(m[4]), Number(m[5]), Number(m[6])];
    ok(cellOf(m[1]) === pivot && (digit === undefined || Number(m[2]) === digit), `the case names the pivot's digit: ${text}`);
    ok(holdsOnly(g, w, [a, b]) && a < b && sees(w, pivot), `the pincer holds only ${a} and ${b} and sees the pivot: ${text}`);
    ok(left === z && [a, b].includes(Number(m[2])) && [a, b].includes(z) && Number(m[2]) !== z, `the pincer is left with z: ${text}`);
    ok(sol.values[pivot] !== Number(m[2]) || sol.values[w] === z, `the case is false in the solution: ${text}`);
    return w;
  };
  /** a lead's removals: the cells named are the removals, the verb agrees, and each sees every cell given */
  const removals = (names: string, verb: string, see: number[]) => {
    ok(JSON.stringify(cellsIn(names)) === JSON.stringify(elims), `the lead names the removals: ${names}`);
    ok((verb === 'sees') === (elims.length === 1), `the verb agrees: ${names} ${verb}`);
    ok(elims.every((e) => see.every((c) => sees(e, c))), 'a removal does not see the cells it is said to');
  };
  if (step.tech === 'XY_WING') {
    const m = PIVOT2.exec(texts[0]);
    if (!m || texts.length !== 4) return [`not an XY-Wing walk: ${texts.join(' / ')}`];
    const p = cellOf(m[1]);
    const [x, y] = [Number(m[2]), Number(m[3])];
    ok(holdsOnly(g, p, [x, y]), `the pivot holds only ${x} and ${y}`);
    const a = pincer(texts[1], p, x);
    const b = pincer(texts[2], p, y);
    const lead = XY_LEAD.exec(texts[3]);
    if (!lead) return [...out, `not an XY-Wing's either-way: ${texts[3]}`];
    ok(Number(lead[1]) === z && (sol.values[a] === z || sol.values[b] === z), 'no pincer is z');
    removals(lead[2], lead[3], [a, b]);
  } else if (step.tech === 'XYZ_WING') {
    const m = PIVOT3.exec(texts[0]);
    if (!m || texts.length !== 4) return [`not an XYZ-Wing walk: ${texts.join(' / ')}`];
    const p = cellOf(m[1]);
    const ds = [Number(m[2]), Number(m[3]), Number(m[4])];
    ok(holdsOnly(g, p, ds), `the pivot holds only ${ds}`);
    const others = ds.filter((d) => d !== z);
    ok(others.length === 2, 'the pivot holds z');
    const a = pincer(texts[1], p, others[0]);
    const b = pincer(texts[2], p, others[1]);
    const lead = XYZ_LEAD.exec(texts[3]);
    if (!lead) return [...out, `not an XYZ-Wing's either-way: ${texts[3]}`];
    ok(Number(lead[1]) === z && [p, a, b].some((c) => sol.values[c] === z), 'none of the three cells is z');
    removals(lead[2], lead[3], [p, a, b]);
  } else {
    const [a, b, link, lock, ends] = [SET_A.exec(texts[0]), SET_B.exec(texts[1]), LINK_X.exec(texts[2]), LOCK_B.exec(texts[3]), ENDS.exec(texts[4] ?? '')];
    if (!a || !b || !link || !lock || !ends || texts.length !== 5) return [`not a WXYZ-Wing walk: ${texts.join(' / ')}`];
    // set A: the bivalue cell, x and z; not z, it is x
    const A = cellOf(a[1]);
    const x = Number(a[5]);
    ok(holdsOnly(g, A, [Number(a[2]), Number(a[3])]) && Number(a[2]) < Number(a[3]), 'set A is a cell holding only the two digits named');
    ok(Number(a[4]) === z && x !== z && same([Number(a[2]), Number(a[3])], [x, z]), "set A's lock goes from z to the other digit");
    // set B: three cells in the house named, holding the four digits named between them, x and z among them
    const B = cellsIn(b[1]);
    const house = houseOf(b[2], b[3]);
    const digits = digitsIn(b[4]);
    const union = B.reduce((u, c) => u | g.cands[c], 0);
    ok(B.length === 3 && !B.includes(A) && B.every((c) => g.values[c] === 0 && UNITS[house].includes(c)), `set B is three cells of ${b[2]} ${b[3]}`);
    ok(digits.length === 4 && union === maskOf(digits) && (union & bit(x)) !== 0 && (union & bit(z)) !== 0, 'set B holds only the four digits named, x and z among them');
    ok(maskOf([...digits, x, z]) === maskOf(digits), 'the four cells hold four digits');
    const bx = B.filter((c) => g.cands[c] & bit(x));
    const bz = B.filter((c) => g.cands[c] & bit(z));
    // the link on x: every x of B sees A, in the house named where one is
    ok(Number(link[3]) === x && cellOf(link[4]) === A, 'the link is on x, from set A');
    const to = link[5] ? [cellOf(link[5])] : cellsIn(link[6] ?? '');
    ok(JSON.stringify(to) === JSON.stringify(bx) && !!link[6] === bx.length > 1, "the link names every x of set B, counted right");
    ok(bx.every((c) => sees(c, A)), 'every x of set B sees set A');
    if (link[1]) ok([A, ...bx].every((c) => UNITS[houseOf(link[1], link[2])].includes(c)), `the link's house holds its candidates: ${link[1]} ${link[2]}`);
    // B's lock: without x, B holds z, in the cells named
    ok(Number(lock[1]) === x && Number(lock[4]) === z, "set B's lock goes from x to z");
    const exit = lock[3] ? [cellOf(lock[3])] : cellsIn(lock[2] ?? '');
    ok(JSON.stringify(exit) === JSON.stringify(bz) && !!lock[2] === bz.length > 1, "B's lock names every z of set B, counted right");
    // where the solution takes the case, A is x, B has no x and holds a z
    if (sol.values[A] === x) {
      ok(!bx.some((c) => sol.values[c] === x), 'set B holds an x while set A is x');
      ok(bz.some((c) => sol.values[c] === z), 'set B holds no z while set A is x');
    }
    // the either-way, and each removal sees every z of both
    ok(Number(ends[1]) === z && (sol.values[A] === z || bz.some((c) => sol.values[c] === z)), 'neither set holds z');
    ok(JSON.stringify(cellsIn(ends[2])) === JSON.stringify(sorted(elims)), `the conclusion names the removals: ${ends[2]}`);
    ok(elims.every((e) => ![A, ...B].includes(e) && [A, ...bz].every((c) => sees(e, c))), 'a removal does not see every z of both sets');
    // the one-line description: the same either-way, with B's house
    const d = WXYZ_DESCRIPTION.exec(step.description);
    if (!d) return [...out, `not a WXYZ-Wing's description: ${step.description}`];
    ok(cellOf(d[1]) === A && Number(d[2]) === z && Number(d[3]) === x && Number(d[6]) === z, 'the description names set A, z and x');
    // and why the removals lose z, as the other ALS leads end
    ok([d[7], d[8], d[9]].every((n) => Number(n) === z), `the description's removal is of z: ${step.description}`);
    ok(houseOf(d[4], d[5]) === house, "the description names set B's house");
  }
  return out;
}

/** what is wrong with a wing's drawing: frames that draw what they do not name, or nothing new, and roles not by function (M3) */
function drawnWrong(step: Step, g: Grid): string[] {
  const out: string[] = [];
  const frames = walkFrames(step);
  const z = step.eliminations[0].digit;
  // frame 1 draws exactly what it names; every frame draws each cell it names
  const first = sorted([...new Set(cellsIn(frames[0].text))]);
  if (JSON.stringify(drawnCells(step, frames[0], g)) !== JSON.stringify(first)) out.push(`frame 1 draws other cells than it names: ${frames[0].text}`);
  frames.forEach((f, i) => {
    const drawn = new Set(drawnCells(step, f, g));
    if (cellsIn(f.text).some((c) => !drawn.has(c))) out.push(`frame ${i + 1} names a cell it does not draw: ${f.text}`);
    if (i && drawing(step, frames[i - 1], g) === drawing(step, f, g)) out.push(`frames ${i} and ${i + 1} draw the same`);
  });
  const last = frameMarks(step, frames.at(-1)!, (c) => g.values[c] > 0);
  if (step.tech === 'WXYZ_WING') {
    // the ALS-XZ it is: two lettered tiles, A from the first frame and B from its own, the chain's truth, no role and no band
    const [A, B] = step.sets ?? [];
    if (step.truth !== 'derived' || step.sets?.length !== 2 || A?.cells.length !== 1 || B?.cells.length !== 3) return [...out, 'not two sets, the bivalue cell A and three cells B'];
    if (deriveTruth(step)!.problems.length) out.push('its chain does not derive');
    const tiles = frames.map((f) => frameMarks(step, f, (c) => g.values[c] > 0).sets.map((x) => x.set).join(''));
    if (JSON.stringify(tiles) !== JSON.stringify(['0', '01', '01', '01', '01'])) out.push(`the tiles come in frames ${tiles}`);
    if (step.primary || step.secondary || step.units || frames.some((f) => frameMarks(step, f, (c) => g.values[c] > 0).bands.length)) out.push('a role or a band');
    const x = digitsOf(g.cands[A.cells[0]]).find((d) => d !== z)!;
    const zs = B.members.filter((m) => m.digit === z);
    const want = [
      `${A.cells[0]}:${z}:false`,
      `${A.cells[0]}:${x}:true`,
      ...B.members.map((m) => `${m.cell}:${m.digit}:${m.digit === x ? 'false' : m.digit !== z ? 'member' : zs.length > 1 ? 'oneOf' : 'true'}`),
      ...step.eliminations.map((e) => `${e.cell}:${e.digit}:elim`)
    ].sort();
    const got = [...last.cands].flatMap(([c, m]) => [...m].map(([d, k]) => `${c}:${d}:${k}`)).sort();
    if (JSON.stringify(got) !== JSON.stringify(want)) out.push(`the conclusion draws ${got}, not ${want}`);
    return out;
  }
  // by function: every z of the pattern gold, and nothing else
  const pattern = [...last.cands].flatMap(([cell, m]) => [...m].filter(([, k]) => k === 'primary' || k === 'secondary').map(([digit, kind]) => ({ cell, digit, kind })));
  if (!pattern.every((cd) => (cd.kind === 'secondary') === (cd.digit === z))) out.push('a z is not gold, or gold is not a z');
  // the pattern's cells, every candidate of each drawn (a pincer's shared digit with it)
  const cells = [...new Set(pattern.map((cd) => cd.cell))];
  if (!cells.every((c) => digitsOf(g.cands[c]).every((d) => pattern.some((cd) => cd.cell === c && cd.digit === d)))) out.push('a candidate of the pattern is not drawn');
  return out;
}

/**
 * What is wrong with an XY- or XYZ-Wing's legend in each walk frame: it
 * names the pincers as the frame draws them, none before the first, "the
 * pincer" while one is drawn, "each pincer" (or "all three cells") once
 * both are, in English
 */
function legendWrong(step: Step, g: Grid): string[] {
  if (step.tech === 'WXYZ_WING') return [];
  const out: string[] = [];
  const pivot = cellsIn(walkFrames(step)[0].text)[0];
  walkFrames(step).forEach((f, i) => {
    const pincers = drawnCells(step, f, g).filter((c) => c !== pivot && !step.eliminations.some((e) => e.cell === c)).length;
    const words = legendOf(step, valuesOf(g), f)
      .filter((e) => e.kind === 'primary' || e.kind === 'secondary')
      .map((e) => e.label)
      .join(' | ');
    const named = /each pincer|all three cells/.test(words) ? 2 : /the pincer/.test(words) ? 1 : /pincer|three/.test(words) ? -1 : 0;
    if (named !== pincers) out.push(`frame ${i + 1} draws ${pincers} pincers, its legend names ${named}: ${words}`);
  });
  return out;
}

/** the cells and digits a sentence names, in any order */
const named = (s: string) => JSON.stringify([sorted(cellsIn(s)), sorted(digitsIn(s))]);

/** every find of the three wings along the solve paths of these puzzles, with the puzzle's solution */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Grid }[] {
  const out: { step: Step; g: Grid; sol: Grid }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(g)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      for (const tech of WINGS) {
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

/** the hint panel at an example's position, showing its step in full or at a frame of its walk: its legend's words */
function panelLegend(tech: Tech, walkIndex: number | null): string[] {
  const ex = EXAMPLES[tech]!;
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(ex.values[i]);
    return { given: ex.puzzle[i] >= '1' && ex.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~ex.cands[i], colors: [] };
  });
  useGame.setState({
    cells,
    autoCandidates: true,
    hint: ex.step,
    hintStage: walkIndex === null ? 'full' : 'walk',
    walkIndex: walkIndex ?? 0,
    paused: false,
    won: false,
    chain: null,
    info: { puzzle: ex.puzzle, score: 1000, level: 'hard' } as any
  });
  // a server render reads the store's initial state: give it the one set here
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
  const html = renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
  const list = /<ul class="hint-legend">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
  const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return [...list.matchAll(/<li>(?:<i class="[^"]*"><\/i>)?([^<]*)<\/li>/g)].map((m) => decode(m[1]));
}

describe('the wings walk in their own sentences (H1)', () => {
  it('as the report asks, in the stored examples, in English, Norwegian and Spanish', () => {
    const want: Record<string, Record<string, string[]>> = {
      en: {
        XY_WING: [
          'The pivot r7c7 holds only 7 and 9.',
          'If r7c7 is 7, the pincer r7c6 (only 6 and 7) must be 6.',
          'If r7c7 is 9, the pincer r8c9 (only 6 and 9) must be 6.',
          'Either way a pincer is 6; r7c8 and r8c6 see both. So 6 is removed from r7c8, r8c6.'
        ],
        XYZ_WING: [
          'The pivot r2c5 holds only 4, 5 and 9.',
          'If r2c5 is 5, the pincer r3c6 (only 4 and 5) must be 4.',
          'If r2c5 is 9, the pincer r7c5 (only 4 and 9) must be 4.',
          'Or the pivot is 4 itself. Whichever digit it takes, one of the three cells is 4; r3c5 sees all three. So 4 is removed from r3c5.'
        ],
        WXYZ_WING: [
          'Set A is the cell r4c3, which holds only 4 and 9: if it is not 4, it must be 9.',
          'Set B: the 3 cells r4c4, r5c5, r6c5 of box 5 hold only 1, 4, 7 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.',
          'In row 4, every 9 of set A sees every 9 of set B: if r4c3 is 9, r4c4 cannot be 9.',
          'If set B holds no 9, its other 3 digits fill its 3 cells, so r5c5 must be 4.',
          'Set A or set B holds a 4: if A holds none, B holds one. Each removed 4 sees every 4 of both. So 4 is removed from r4c6, r5c3.'
        ]
      },
      nb: {
        XY_WING: [
          'Pivoten r7c7 har bare 7 og 9.',
          'Hvis r7c7 er 7, må klypen r7c6 (bare 6 og 7) være 6.',
          'Hvis r7c7 er 9, må klypen r8c9 (bare 6 og 9) være 6.',
          'Uansett er en av klypene 6; r7c8 og r8c6 ser begge. Så fjernes 6 fra r7c8, r8c6.'
        ],
        XYZ_WING: [
          'Pivoten r2c5 har bare 4, 5 og 9.',
          'Hvis r2c5 er 5, må klypen r3c6 (bare 4 og 5) være 4.',
          'Hvis r2c5 er 9, må klypen r7c5 (bare 4 og 9) være 4.',
          'Eller så er pivoten selv 4. Uansett hvilket tall den får, er en av de tre rutene 4; r3c5 ser alle tre. Så fjernes 4 fra r3c5.'
        ],
        WXYZ_WING: [
          'Mengde A er ruten r4c3, som bare har 4 og 9: er den ikke 4, må den være 9.',
          'Mengde B: de 3 rutene r4c4, r5c5, r6c5 i boks 5 har bare 1, 4, 7 og 9: ett tall mer enn ruter. Mangler ett av dem, uansett hvilket, fyller de andre tallene rutene.',
          'I rad 4 ser hvert 9-tall i mengde A hvert 9-tall i mengde B: hvis r4c3 er 9, kan r4c4 ikke være 9.',
          'Hvis mengde B ikke har noen 9, fyller de 3 andre tallene de 3 rutene, så r5c5 må være 4.',
          'Mengde A eller mengde B har en 4: har A ingen, har B en. Hvert 4-tall som fjernes, ser alle 4-tallene i begge. Så fjernes 4 fra r4c6, r5c3.'
        ]
      },
      es: {
        XY_WING: [
          'El pivote r7c7 solo tiene 7 y 9.',
          'Si r7c7 es 7, la pinza r7c6 (solo 6 y 7) debe ser 6.',
          'Si r7c7 es 9, la pinza r8c9 (solo 6 y 9) debe ser 6.',
          'En cualquier caso, una de las pinzas es 6; r7c8 y r8c6 ven ambas. Por tanto, se elimina el 6 de r7c8, r8c6.'
        ],
        XYZ_WING: [
          'El pivote r2c5 solo tiene 4, 5 y 9.',
          'Si r2c5 es 5, la pinza r3c6 (solo 4 y 5) debe ser 4.',
          'Si r2c5 es 9, la pinza r7c5 (solo 4 y 9) debe ser 4.',
          'O el propio pivote es 4. Sea cual sea el número que tome, una de las tres casillas es 4; r3c5 ve las tres. Por tanto, se elimina el 4 de r3c5.'
        ],
        WXYZ_WING: [
          'El conjunto A es la casilla r4c3, que solo tiene 4 y 9: si no es 4, debe ser 9.',
          'Conjunto B: las 3 casillas r4c4, r5c5, r6c5 de la caja 5 solo tienen 1, 4, 7 y 9: un número más que casillas. Sin uno cualquiera de ellos, los demás llenan las casillas.',
          'En la fila 4, cada 9 del conjunto A ve cada 9 del conjunto B: si r4c3 es 9, r4c4 no puede ser 9.',
          'Si el conjunto B no tiene ningún 9, sus otros 3 números llenan sus 3 casillas, así que r5c5 debe ser 4.',
          'El conjunto A o el conjunto B tiene un 4: si A no tiene ninguno, B tiene uno. Cada 4 eliminado ve todos los 4 de ambos. Por tanto, se elimina el 4 de r4c6, r5c3.'
        ]
      }
    };
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      for (const tech of WINGS) {
        const step = findStep(tech, exampleGrid(EXAMPLES[tech]!))!;
        expect(walkFrames(step).map((f) => f.text), `${lang} ${tech}`).toEqual(want[lang][tech]);
      }
    }
  });

  it("describes the WXYZ-Wing in one line, its either-way by its two sets and why the removals go (L3), in English, Norwegian and Spanish, and its Copy step line is the wing's", () => {
    const want: Record<string, string> = {
      en: 'Either set A, the cell r4c3, is 4, or it is 9, and then set B, in box 5, holds a 4. Set A or set B holds a 4, so no cell that sees every 4 of both can be 4.',
      nb: 'Enten er mengde A, ruten r4c3, lik 4, eller så er den lik 9, og da har mengde B, i boks 5, en 4. Mengde A eller mengde B har en 4, så ingen rute som ser alle 4-tallene i begge, kan være 4.',
      es: 'O el conjunto A, la casilla r4c3, es 4, o es 9, y entonces el conjunto B, en la caja 5, tiene un 4. El conjunto A o el conjunto B tiene un 4, así que ninguna casilla que vea todos los 4 de ambos puede ser 4.'
    };
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      expect(findStep('WXYZ_WING', exampleGrid(EXAMPLES.WXYZ_WING!))!.description, lang).toBe(want[lang]);
    }
    setEngineText('en', null);
    expect(EXAMPLES.WXYZ_WING!.step.description).toBe(want.en);
    // the line players paste is HoDoKu's wing line, from the sets, not the chain's Eureka
    expect(stepText(EXAMPLES.WXYZ_WING!.step)).toBe('WXYZ-Wing: 1/9 in r4c4 / 1/4/7 in r56c5 / 4/9 in r4c3 => r4c6<>4, r5c3<>4');
  });

  it('colours the stored examples by what each digit does, and names the colours so (M3)', () => {
    const legend = (tech: Tech) => legendOf(EXAMPLES[tech]!.step, EXAMPLES[tech]!.values).map((e) => `${e.kind}: ${e.label}`);
    const xy = EXAMPLES.XY_WING!.step;
    expect(xy.primary).toEqual([
      { cell: 60, digit: 7 },
      { cell: 60, digit: 9 },
      { cell: 59, digit: 7 },
      { cell: 71, digit: 9 }
    ]);
    expect(xy.secondary).toEqual([
      { cell: 59, digit: 6 },
      { cell: 71, digit: 6 }
    ]);
    expect(legend('XY_WING')).toEqual(['elim: remove', 'primary: the pivot and the digit each pincer shares with it', 'secondary: 6 in each pincer']);
    // the three 4s in one colour
    expect(EXAMPLES.XYZ_WING!.step.secondary!.map((cd) => `${cellName(cd.cell)}:${cd.digit}`)).toEqual(['r2c5:4', 'r3c6:4', 'r7c5:4']);
    expect(legend('XYZ_WING')).toEqual(['elim: remove', "primary: the pivot's 5 and 9, and the one each pincer shares with it", 'secondary: 4 in all three cells']);
  });

  it('draws the WXYZ-Wing as the ALS-XZ it is: the bivalue cell set A, its three cells set B, the link on 9 and the 4s by the chain they derive', () => {
    const ex = EXAMPLES.WXYZ_WING!;
    const step = ex.step;
    expect([step.truth, step.primary, step.secondary, step.units, step.labels, step.walk]).toEqual(['derived', undefined, undefined, undefined, undefined, undefined]);
    expect(step.sets!.map((s) => `${s.letter} ${s.cells.map(cellName).join(', ')} {${s.digits.join('')}}`)).toEqual(['A r4c3 {49}', 'B r4c4, r5c5, r6c5 {1479}']);
    // (4)A = (9)A - (9)B = (4)B, the ALS-XZ's chain
    expect(step.links!.map((l) => `${l.from.map((m) => `${m.digit}${cellName(m.cell)}`)}${l.strong ? '=' : '-'}${l.to.map((m) => `${m.digit}${cellName(m.cell)}`)}`)).toEqual([
      '4r4c3=9r4c3',
      '9r4c3-9r4c4',
      '9r4c4=4r5c5'
    ]);
    const g = exampleGrid(ex);
    expect(kindsAt(step, null, g)).toEqual([
      'r4c3:4:false',
      'r4c3:9:true',
      'r4c4:1:member',
      'r4c4:9:false',
      'r4c6:4:elim',
      'r5c3:4:elim',
      'r5c5:4:true',
      'r5c5:7:member',
      'r6c5:1:member',
      'r6c5:7:member'
    ]);
    expect(legendOf(step, ex.values).map((e) => `${e.kind}: ${e.label}`)).toEqual([
      'elim: remove: sees every 4 of set A and of set B, and one of the two holds a 4',
      'true: true, if set A holds no 4 (by the small dot)',
      'false: false, if set A holds no 4 (by the small dot)',
      'tile: lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells'
    ]);
    expect(setProblems(step, ex.cands)).toEqual([]);
    expect(wordProblems(step)).toEqual([]);
  });

  it('draws in each frame the cells it names, frame 1 nothing else, and something new each time, at the stored examples', () => {
    for (const tech of WINGS) {
      const g = exampleGrid(EXAMPLES[tech]!);
      expect(drawnWrong(findStep(tech, g)!, g), tech).toEqual([]);
    }
    // the XY-Wing's pivot alone, then each pincer with its shared digit blue and its 6 gold
    const g = exampleGrid(EXAMPLES.XY_WING!);
    const step = findStep('XY_WING', g)!;
    expect(walkFrames(step).slice(0, 3).map((f) => kindsAt(step, f, g))).toEqual([
      ['r7c7:7:primary', 'r7c7:9:primary'],
      ['r7c6:6:secondary', 'r7c6:7:primary', 'r7c7:7:primary', 'r7c7:9:primary'],
      ['r7c6:6:secondary', 'r7c6:7:primary', 'r7c7:7:primary', 'r7c7:9:primary', 'r8c9:6:secondary', 'r8c9:9:primary']
    ]);
    // the WXYZ-Wing's set A alone, its lock's truth, then set B's tile and members, its link, its lock
    const wg = exampleGrid(EXAMPLES.WXYZ_WING!);
    const wxyz = findStep('WXYZ_WING', wg)!;
    expect(walkFrames(wxyz).slice(0, 4).map((f) => kindsAt(wxyz, f, wg).filter((k) => !k.endsWith('member')))).toEqual([
      ['r4c3:4:false', 'r4c3:9:true'],
      ['r4c3:4:false', 'r4c3:9:true'],
      ['r4c3:4:false', 'r4c3:9:true', 'r4c4:9:false'],
      ['r4c3:4:false', 'r4c3:9:true', 'r4c4:9:false', 'r5c5:4:true']
    ]);
  });
});

describe("a walk frame's legend names only what the frame draws (phase6-batch1-review.md)", () => {
  it('names the pivot, then one pincer, then both, in each frame of the stored XY- and XYZ-Wing, in English, Norwegian and Spanish', () => {
    const want: Record<string, Record<string, string[][]>> = {
      en: {
        XY_WING: [
          ['primary: the pivot'],
          ['primary: the pivot and the digit the pincer shares with it', 'secondary: 6 in the pincer'],
          ['primary: the pivot and the digit each pincer shares with it', 'secondary: 6 in each pincer'],
          ['elim: remove', 'primary: the pivot and the digit each pincer shares with it', 'secondary: 6 in each pincer']
        ],
        XYZ_WING: [
          ["primary: the pivot's 5 and 9", 'secondary: 4 in the pivot'],
          ["primary: the pivot's 5 and 9, and the one the pincer shares with it", 'secondary: 4 in the pivot and the pincer'],
          ["primary: the pivot's 5 and 9, and the one each pincer shares with it", 'secondary: 4 in all three cells'],
          ['elim: remove', "primary: the pivot's 5 and 9, and the one each pincer shares with it", 'secondary: 4 in all three cells']
        ]
      },
      nb: {
        XY_WING: [
          ['primary: pivoten'],
          ['primary: pivoten og tallet klypen deler med den', 'secondary: 6 i klypen'],
          ['primary: pivoten og tallet hver klype deler med den', 'secondary: 6 i hver klype'],
          ['elim: fjern', 'primary: pivoten og tallet hver klype deler med den', 'secondary: 6 i hver klype']
        ],
        XYZ_WING: [
          ['primary: pivotens 5 og 9', 'secondary: 4 i pivoten'],
          ['primary: pivotens 5 og 9, og det av dem klypen deler med den', 'secondary: 4 i pivoten og klypen'],
          ['primary: pivotens 5 og 9, og det av dem hver klype deler med den', 'secondary: 4 i alle tre rutene'],
          ['elim: fjern', 'primary: pivotens 5 og 9, og det av dem hver klype deler med den', 'secondary: 4 i alle tre rutene']
        ]
      },
      es: {
        XY_WING: [
          ['primary: el pivote'],
          ['primary: el pivote y el número que la pinza comparte con él', 'secondary: el 6 de la pinza'],
          ['primary: el pivote y el número que cada pinza comparte con él', 'secondary: el 6 de cada pinza'],
          ['elim: eliminar', 'primary: el pivote y el número que cada pinza comparte con él', 'secondary: el 6 de cada pinza']
        ],
        XYZ_WING: [
          ['primary: el 5 y el 9 del pivote', 'secondary: el 4 del pivote'],
          ['primary: el 5 y el 9 del pivote, y el que la pinza comparte con él', 'secondary: el 4 del pivote y de la pinza'],
          ['primary: el 5 y el 9 del pivote, y el que cada pinza comparte con él', 'secondary: el 4 de las tres casillas'],
          ['elim: eliminar', 'primary: el 5 y el 9 del pivote, y el que cada pinza comparte con él', 'secondary: el 4 de las tres casillas']
        ]
      }
    };
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      for (const tech of ['XY_WING', 'XYZ_WING'] as Tech[]) {
        const ex = EXAMPLES[tech]!;
        const step = findStep(tech, exampleGrid(ex))!;
        const legends = walkFrames(step).map((f) => legendOf(step, ex.values, f).map((e) => `${e.kind}: ${e.label}`));
        expect(legends, `${lang} ${tech}`).toEqual(want[lang][tech]);
      }
    }
  });

  it('says in the hint panel what the Learn legend says, in the full view and every frame of each wing', () => {
    for (const tech of WINGS) {
      const ex = EXAMPLES[tech]!;
      const frames = walkFrames(ex.step);
      for (const at of [null, ...frames.map((_, i) => i)]) {
        const learn = legendOf(ex.step, ex.values, at === null ? null : frames[at]).map((e) => e.label);
        expect(panelLegend(tech, at), `${tech} ${at === null ? 'full view' : `frame ${at + 1}`}`).toEqual(learn);
      }
    }
  });
});

describe('the wings along the practice paths', () => {
  it('say only what is true, and draw what they say, at every find, in the three languages', () => {
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    const puzzles =
      env.WING_SCAN === 'all'
        ? [...new Set(pools.map((e) => e.puzzle))]
        : [...new Set(WINGS.flatMap((tech) => pools.filter((e) => e.techs.includes(tech)).slice(0, 4).map((e) => e.puzzle)))];
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const shapes = new Set<string>();
    for (const { step, g, sol } of finds) {
      const at = `${step.tech} ${step.description}`;
      for (const w of [...wrongIn(step, g, sol), ...drawnWrong(step, g), ...legendWrong(step, g)]) wrong.push(`${at}: ${w}`);
      if (step.tech === 'WXYZ_WING') for (const w of [...setProblems(step, g.cands), ...wordProblems(step)]) wrong.push(`${at}: ${w}`);
      const texts = walkFrames(step).map((f) => f.text);
      const english = [step.description, ...texts].map(named);
      // the shapes of sentence the finds cover
      if (step.tech === 'WXYZ_WING') {
        shapes.add(
          `WXYZ_WING ${step.eliminations.length > 1 ? 'removals' : 'removal'}${/, so one of /.test(texts[3]) ? ', zs' : ''}${/none of /.test(texts[2]) ? ', xs' : ''}${/^In /.test(texts[2]) ? ', house' : ''}`
        );
      } else shapes.add(`${step.tech} ${step.eliminations.length > 1 ? 'removals' : 'removal'}`);
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        const there = findStep(step.tech, g)!;
        const words = [there.description, ...walkFrames(there).map((f) => f.text)].map(named);
        if (JSON.stringify(words) !== JSON.stringify(english)) wrong.push(`${lang} ${at}: names other cells or digits than English`);
        setEngineText('en', null);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    // eslint-disable-next-line no-console
    if (env.WING_SCAN === 'all') console.info(`wing finds read: ${WINGS.map((t) => `${t} ${finds.filter((f) => f.step.tech === t).length}`).join(', ')}; shapes: ${[...shapes].sort().join(', ')}`);
    expect(finds.length).toBeGreaterThan(500);
    for (const tech of WINGS) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(50);
    // one removal and several; a WXYZ-Wing's z in one of its three cells and in several, its x in one and in several
    for (const shape of ['XY_WING removal', 'XY_WING removals', 'XYZ_WING removal', 'WXYZ_WING removal', 'WXYZ_WING removals'])
      expect([...shapes].some((s) => s === shape || s.startsWith(`${shape},`)), shape).toBe(true);
    const wxyz = [...shapes].filter((s) => s.startsWith('WXYZ_WING'));
    for (const part of [', zs', ', xs']) {
      expect(wxyz.some((s) => s.includes(part)), part).toBe(true);
      expect(wxyz.some((s) => !s.includes(part)), `not${part}`).toBe(true);
    }
    // the link always names its house: the bivalue cell sees every x of the
    // three cells, so they lie in its row, its column or its box with it
    expect(wxyz.every((s) => s.endsWith(', house')), wxyz.join('; ')).toBe(true);
  });
});
