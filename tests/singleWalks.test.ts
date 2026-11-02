/**
 * The singles, the subsets and Locked Candidates walk in their finders' own
 * sentences (docs/hint-readability-2026-11.md, H1's singles and subsets,
 * M20's hidden-subset wording, L1's "only 3 and 7"):
 * - the stored examples walk as the report asks, in English, Norwegian and
 *   Spanish: a Full House's house and what it lacks; a Naked Single's cell,
 *   then the digits its houses hold; a Hidden Single's one place, then the
 *   digits that rule out the rest of its house; Locked Candidates' places,
 *   then the house they share, named; a subset's cells and digits, then
 *   why the digits go elsewhere, or what each cell keeps; the digits as a
 *   player says them, never "3/7", in the walk, the legend and the
 *   description;
 * - each frame draws what it names, frame 1 exactly the cells it names, and
 *   something new each time; the bands come with their roles (M1) and a
 *   Hidden Single keeps its band rule (M9, tests/hintWalk.test.ts);
 * - every sentence is true of its board and of the puzzle's solution at
 *   every find of the thirteen techniques along practice solve paths, every
 *   hidden single and naked single of each position with them, and
 *   Norwegian and Spanish name the same cells and digits (a sample of the
 *   paths; SINGLE_SCAN=all reads every practice puzzle's path).
 * Their Copy step lines are pinned in tests/eureka.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, PEERS, bit, digitsOf, parseGrid, isSolved, sees } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames, conclusionText, describe as describeStep } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { setEngineText } from '../src/engine/text';
import { hiddenSingleStep, nakedSingleStep } from '../src/engine/techniques/singles';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

afterEach(() => setEngineText('en', null));

const TECHS: Tech[] = [
  'FULL_HOUSE',
  'NAKED_SINGLE',
  'HIDDEN_SINGLE',
  'LOCKED_CANDIDATES_1',
  'LOCKED_CANDIDATES_2',
  'LOCKED_PAIR',
  'LOCKED_TRIPLE',
  'NAKED_PAIR',
  'NAKED_TRIPLE',
  'NAKED_QUADRUPLE',
  'HIDDEN_PAIR',
  'HIDDEN_TRIPLE',
  'HIDDEN_QUADRUPLE'
];
const OTHER = [
  ['nb', engineNb],
  ['es', engineEs]
] as const;

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const digitsIn = (s: string) => [...s.replace(/r\dc\d/g, '').matchAll(/\d/g)].map((m) => Number(m[0]));
const unitOf = (kind: string, n: string) => (/^[Rr]ow$/.test(kind) ? 0 : /^[Cc]olumn$/.test(kind) ? 9 : 18) + Number(n) - 1;
const housesIn = (s: string) => [...s.matchAll(/\b(row|column|box) (\d)/gi)].map((m) => unitOf(m[1], m[2]));
const maskOf = (ds: number[]) => ds.reduce((m, d) => m | bit(d), 0);
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const same = (a: number[], b: number[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
/** the empty cells of a house */
const emptyIn = (g: Grid, u: number) => UNITS[u].filter((c) => g.values[c] === 0);
/** a placed d sees the cell */
const seesPlaced = (g: Grid, cell: number, d: number) => PEERS[cell].some((p) => g.values[p] === d);

/**
 * What is wrong with one of the thirteen walks at its position, given the
 * puzzle's solution: each English sentence read back and held to the board
 * (what a house or a cell holds, what sees what) and to the solution
 */
function wrongIn(step: Step, g: Grid, sol: Grid): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const texts = walkFrames(step).map((f) => f.text);
  const last = texts.at(-1)!;
  ok(step.placements.every((p) => sol.values[p.cell] === p.digit), 'a placement is not the answer');
  ok(step.eliminations.every((e) => sol.values[e.cell] !== e.digit && g.cands[e.cell] & bit(e.digit)), 'a removal is the answer');
  ok(last.endsWith(conclusionText(step)), `the walk ends without its conclusion: ${last}`);
  const tech = step.tech;
  if (tech === 'FULL_HOUSE') {
    const m = /^(Row|Column|Box) (\d) has one empty cell, (r\dc\d), and lacks only (\d)\.$/.exec(texts[0]);
    if (!m || texts.length !== 2) return [`not a Full House walk: ${texts.join(' / ')}`];
    const u = unitOf(m[1], m[2]);
    const cell = cellOf(m[3]);
    const d = Number(m[4]);
    ok(same(emptyIn(g, u), [cell]), 'the house has other empty cells');
    ok(same([1, 2, 3, 4, 5, 6, 7, 8, 9].filter((e) => !UNITS[u].some((c) => g.values[c] === e)), [d]), 'the house lacks another digit');
    ok(sol.values[cell] === d, 'the cell is not the digit');
  } else if (tech === 'NAKED_SINGLE') {
    const m = /^Only one candidate is left in (r\dc\d): (\d)(; the others were ruled out earlier)?\.$/.exec(texts[0]);
    if (!m) return [`not a Naked Single walk: ${texts.join(' / ')}`];
    const cell = cellOf(m[1]);
    const d = Number(m[2]);
    const held = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((e) => e !== d && seesPlaced(g, cell, e));
    ok(g.values[cell] === 0 && g.cands[cell] === bit(d) && sol.values[cell] === d, `the cell holds more, or is another digit: ${texts[0]}`);
    if (m[3]) ok(!held.length && texts.length === 2, 'its houses hold a digit the walk does not name');
    else {
      const eight = /^The row, column and box of (r\dc\d) already hold the other eight digits\.$/.exec(texts[1]);
      const fewer = /^The row, column and box of (r\dc\d) already hold (.+?); (.+?) (was|were) ruled out earlier\.$/.exec(texts[1]);
      if (!eight && !fewer) return [...out, `not a Naked Single's houses: ${texts[1]}`];
      ok(cellOf((eight ?? fewer)![1]) === cell && texts.length === 3, 'the houses are not the cell named');
      if (eight) ok(held.length === 8, 'its houses do not hold the other eight digits');
      else {
        const named = digitsIn(fewer![2]);
        const gone = digitsIn(fewer![3]);
        ok(same(named, held), `its houses hold other digits: ${texts[1]}`);
        ok(same([...named, ...gone, d], [1, 2, 3, 4, 5, 6, 7, 8, 9]), `the digits ruled out earlier are not the rest: ${texts[1]}`);
        ok((fewer![4] === 'was') === (gone.length === 1), 'the verb agrees');
      }
    }
  } else if (tech === 'HIDDEN_SINGLE') {
    const m = /^In (row|column|box) (\d), the (\d) can go only in (r\dc\d)(\.|: it was already ruled out in every other empty cell\.|, its one empty cell\.)$/.exec(texts[0]);
    if (!m) return [`not a Hidden Single walk: ${texts.join(' / ')}`];
    const u = unitOf(m[1], m[2]);
    const d = Number(m[3]);
    const pos = cellOf(m[4]);
    const others = emptyIn(g, u).filter((c) => c !== pos);
    ok(same(emptyIn(g, u).filter((c) => g.cands[c] & bit(d)), [pos]) && sol.values[pos] === d, `the digit has another place, or is elsewhere: ${texts[0]}`);
    if (m[5] === ', its one empty cell.') ok(!others.length && texts.length === 2, 'the house has other empty cells');
    else if (m[5] !== '.') ok(others.length > 0 && others.every((c) => !seesPlaced(g, c, d)) && texts.length === 2, 'a placed digit rules out a cell, which the walk does not name');
    else {
      const f = /^The (\d)(s?) in (.+?) (rules|rule) out (\d) in (?:every other empty cell of (row|column|box) (\d)(?: but (.+), where it was already ruled out)?|(r\dc\d), the other empty cell of (row|column|box) (\d))\.$/.exec(texts[1]);
      if (!f || texts.length !== 3) return [...out, `not a Hidden Single's reason: ${texts[1]}`];
      const by = cellsIn(f[3]);
      ok(Number(f[1]) === d && Number(f[5]) === d && by.every((c) => g.values[c] === d), `a cell named does not hold the digit: ${texts[1]}`);
      ok((f[2] === 's') === by.length > 1 && (f[4] === 'rule') === by.length > 1, 'the count agrees');
      const house = f[6] ? unitOf(f[6], f[7]) : unitOf(f[10], f[11]);
      ok(house === u, 'the reason names another house');
      const but = f[8] ? cellsIn(f[8]) : [];
      if (f[9]) ok(same(others, [cellOf(f[9])]), 'the house has more empty cells');
      ok(but.every((c) => others.includes(c) && !seesPlaced(g, c, d)), 'a cell ruled out earlier sees a placed digit');
      ok(others.filter((c) => !but.includes(c)).every((c) => by.some((b) => sees(b, c))), `a cell no digit named sees is said ruled out: ${texts[1]}`);
      ok(others.filter((c) => !seesPlaced(g, c, d)).every((c) => but.includes(c)), 'a cell ruled out earlier is not named');
    }
  } else if (tech === 'LOCKED_CANDIDATES_1' || tech === 'LOCKED_CANDIDATES_2') {
    const m = /^In (row|column|box) (\d), the only cells that can take (\d) are (.+)\.$/.exec(texts[0]);
    const f = /^One of them must be (\d), and (both|all three) lie in (row|column|box) (\d), so no other cell of \3 \4 can be \1\.$/.exec(texts[1] ?? '');
    if (!m || !f || texts.length !== 3) return [`not a Locked Candidates walk: ${texts.join(' / ')}`];
    const u = unitOf(m[1], m[2]);
    const d = Number(m[3]);
    const cells = cellsIn(m[4]);
    const shared = unitOf(f[3], f[4]);
    ok(same(emptyIn(g, u).filter((c) => g.cands[c] & bit(d)), cells), `the cells named are not the digit's places: ${texts[0]}`);
    ok((tech === 'LOCKED_CANDIDATES_1') === u >= 18 && (u >= 18) !== shared >= 18, 'pointing starts in a box, claiming in a line');
    ok(Number(f[1]) === d && (f[2] === 'both') === (cells.length === 2) && cells.every((c) => UNITS[shared].includes(c)), `the cells do not lie in the house named: ${texts[1]}`);
    ok(cells.some((c) => sol.values[c] === d), 'none of them is the digit');
    ok(step.eliminations.every((e) => e.digit === d && UNITS[shared].includes(e.cell) && !cells.includes(e.cell)), 'a removal is outside the house named');
  } else if (tech.startsWith('NAKED_') || tech.startsWith('LOCKED_')) {
    const m = /^In (.+?), (.+) hold only (.+?)( between them)?\.$/.exec(texts[0]);
    const lead = /^They must be (.+), one each: these digits can go nowhere else in (.+?)\. So /.exec(texts[1] ?? '');
    if (!m || !lead || texts.length !== 2) return [`not a naked subset's walk: ${texts.join(' / ')}`];
    const houses = housesIn(m[1]);
    const cells = cellsIn(m[2]);
    const ds = digitsIn(m[3]);
    const mask = cells.reduce((u, c) => u | g.cands[c], 0);
    ok(houses.length === (tech.startsWith('LOCKED_') ? 2 : 1) && cells.every((c) => g.values[c] === 0 && houses.every((h) => UNITS[h].includes(c))), `the cells are not in the houses named: ${texts[0]}`);
    ok(mask === maskOf(ds) && ds.length === cells.length, `the cells hold other digits: ${texts[0]}`);
    ok(!!m[4] === !cells.every((c) => g.cands[c] === mask), '"between them" is said where each cell holds every digit, or not where one does not');
    ok(same(digitsIn(lead[1]), ds) && same(housesIn(lead[2]), houses) && (houses.length === 1 || lead[2].includes(' or ')), `the lead names other digits or houses: ${texts[1]}`);
    ok(same(cells.map((c) => sol.values[c]), ds), 'the cells are not the digits named');
    ok(step.eliminations.every((e) => ds.includes(e.digit) && !cells.includes(e.cell) && houses.some((h) => UNITS[h].includes(e.cell))), 'a removal is outside the houses named');
  } else {
    const m = /^In (row|column|box) (\d), the digits (.+) can go only in (.+)\.$/.exec(texts[0]);
    const lead = /^They must be (.+), one each, and hold nothing else: (.+)\. So /.exec(texts[1] ?? '');
    if (!m || !lead || texts.length !== 2) return [`not a hidden subset's walk: ${texts.join(' / ')}`];
    const u = unitOf(m[1], m[2]);
    const ds = digitsIn(m[3]);
    const cells = cellsIn(m[4]);
    ok(same(emptyIn(g, u).filter((c) => g.cands[c] & maskOf(ds)), cells) && cells.length === ds.length, `the cells named are not the digits' places: ${texts[0]}`);
    ok(same(digitsIn(lead[1]), ds), 'the lead names other digits');
    ok(same(cells.map((c) => sol.values[c]), ds), 'the cells are not the digits named');
    const keeping: number[] = [];
    for (const clause of lead[2].split('; ')) {
      const k = /^(.+) (keeps|keep) only (.+)$/.exec(clause);
      if (!k) {
        out.push(`not what a cell keeps: ${clause}`);
        continue;
      }
      const cs = cellsIn(k[1]);
      const kept = digitsIn(k[3]);
      keeping.push(...cs);
      ok((k[2] === 'keeps') === (cs.length === 1), `the verb agrees: ${clause}`);
      ok(cs.every((c) => (g.cands[c] & maskOf(ds)) === maskOf(kept) && kept.includes(sol.values[c])), `a cell keeps other digits: ${clause}`);
    }
    ok(same(keeping, [...new Set(step.eliminations.map((e) => e.cell))]), 'the cells said to keep only some are not the cells that lose some');
    ok(step.eliminations.every((e) => cells.includes(e.cell) && !ds.includes(e.digit)), 'a removal is outside the cells, or one of the digits');
  }
  return out;
}

/** the cells a view draws a mark in, a candidate's or a solved digit's */
const drawnCells = (step: Step, frame: Frame | null, g: Grid) => {
  const m = frameMarks(step, frame, (c) => g.values[c] > 0);
  return sorted([...new Set([...m.cands.keys(), ...m.values.keys()])]);
};
/** everything a view draws, to tell two frames apart */
const drawing = (step: Step, frame: Frame | null, g: Grid) => {
  const m = frameMarks(step, frame, (c) => g.values[c] > 0);
  return JSON.stringify({
    cands: [...m.cands].map(([c, d]) => [c, [...d]]).sort(),
    values: [...m.values].sort(),
    bands: m.bands.map((b) => `${b.unit}:${b.role}`).sort()
  });
};

/** what is wrong with a walk's drawing: frames that name what they do not draw, frame 1 drawing more, or nothing new */
function drawnWrong(step: Step, g: Grid): string[] {
  const out: string[] = [];
  const frames = walkFrames(step);
  frames.forEach((f, i) => {
    const m = frameMarks(step, f, (c) => g.values[c] > 0);
    const marked = new Set(drawnCells(step, f, g));
    const banded = m.bands.map((b) => b.unit);
    // a cell named is drawn, or lies in a house the frame bands (a Full House's last cell, a cell an earlier removal ruled out)
    if (cellsIn(f.text).some((c) => !marked.has(c) && !banded.some((u) => UNITS[u].includes(c)))) out.push(`frame ${i + 1} names a cell it does not draw: ${f.text}`);
    if (housesIn(f.text).some((u) => !banded.includes(u))) out.push(`frame ${i + 1} names a house it does not band: ${f.text}`);
    if (i && drawing(step, frames[i - 1], g) === drawing(step, f, g)) out.push(`frames ${i} and ${i + 1} draw the same`);
  });
  // frame 1 draws exactly the cells it names (a Full House only its house)
  const first = sorted([...new Set(cellsIn(frames[0].text))]);
  const drawn = drawnCells(step, frames[0], g);
  if (step.tech === 'FULL_HOUSE' ? drawn.length : JSON.stringify(drawn) !== JSON.stringify(first)) out.push(`frame 1 draws other cells than it names: ${frames[0].text}`);
  return out;
}

/** the cells and digits a sentence names, in any order */
const named = (s: string) => JSON.stringify([sorted(cellsIn(s)), sorted(digitsIn(s))]);

const copy = (g: Grid): Grid => ({ values: new Uint8Array(g.values), cands: new Uint16Array(g.cands), given: g.given });

/**
 * every find of the thirteen techniques along the solve paths of these
 * puzzles, and every other hidden single and naked single of each position
 * (as Check and the credit of a move build them, src/engine/justify.ts),
 * with the puzzle's solution
 */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Grid; rebuild: () => Step }[] {
  const out: { step: Step; g: Grid; sol: Grid; rebuild: () => Step }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(g)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      const at = copy(g);
      for (const tech of TECHS) {
        const step = findStep(tech, at);
        if (step?.tech === tech) out.push({ step, g: at, sol, rebuild: () => findStep(tech, at)! });
      }
      for (let u = 0; u < 27; u++) {
        for (let d = 1; d <= 9; d++) {
          const places = emptyIn(at, u).filter((c) => at.cands[c] & bit(d));
          if (places.length === 1) out.push({ step: hiddenSingleStep(at, u, d, places[0]), g: at, sol, rebuild: () => hiddenSingleStep(at, u, d, places[0]) });
        }
      }
      for (let c = 0; c < 81; c++) {
        if (at.values[c] === 0 && digitsOf(at.cands[c]).length === 1) out.push({ step: nakedSingleStep(at, c), g: at, sol, rebuild: () => nakedSingleStep(at, c) });
      }
      const s = findNextStep(g);
      if (!s) break;
      applyStep(g, s);
    }
  }
  return out;
}

const WANT: Record<string, Partial<Record<Tech, string[]>>> = {
  en: {
    FULL_HOUSE: ['Row 4 has one empty cell, r4c9, and lacks only 8.', 'So r4c9 must be 8.'],
    NAKED_SINGLE: ['Only one candidate is left in r4c1: 1.', 'The row, column and box of r4c1 already hold the other eight digits.', 'So r4c1 must be 1.'],
    HIDDEN_SINGLE: ['In row 2, the 1 can go only in r2c2.', 'The 1s in r4c1, r1c5 and r7c9 rule out 1 in every other empty cell of row 2.', 'So r2c2 must be 1.'],
    LOCKED_CANDIDATES_1: [
      'In box 4, the only cells that can take 3 are r5c1 and r5c3.',
      'One of them must be 3, and both lie in row 5, so no other cell of row 5 can be 3.',
      'So 3 is removed from r5c4.'
    ],
    LOCKED_CANDIDATES_2: [
      'In row 1, the only cells that can take 5 are r1c5 and r1c6.',
      'One of them must be 5, and both lie in box 2, so no other cell of box 2 can be 5.',
      'So 5 is removed from r2c5.'
    ],
    LOCKED_PAIR: [
      'In column 1 and box 1, r1c1 and r2c1 hold only 3 and 7.',
      'They must be 3 and 7, one each: these digits can go nowhere else in column 1 or box 1. So 7 is removed from r2c3, r3c1, r3c3, r5c1, r6c1.'
    ],
    LOCKED_TRIPLE: [
      'In row 8 and box 7, r8c1, r8c2 and r8c3 hold only 2, 3 and 7 between them.',
      'They must be 2, 3 and 7, one each: these digits can go nowhere else in row 8 or box 7. So 2 and 7 are removed from r7c2, r8c8; 7 is removed from r7c3, r8c7.'
    ],
    NAKED_PAIR: ['In row 9, r9c2 and r9c7 hold only 2 and 5.', 'They must be 2 and 5, one each: these digits can go nowhere else in row 9. So 5 is removed from r9c6.'],
    NAKED_TRIPLE: [
      'In box 8, r7c4, r8c6 and r9c4 hold only 2, 6 and 7 between them.',
      'They must be 2, 6 and 7, one each: these digits can go nowhere else in box 8. So 6 is removed from r7c5; 2 is removed from r9c6.'
    ],
    NAKED_QUADRUPLE: [
      'In row 5, r5c4, r5c5, r5c6 and r5c9 hold only 5, 6, 8 and 9 between them.',
      'They must be 5, 6, 8 and 9, one each: these digits can go nowhere else in row 5. So 9 is removed from r5c3, r5c8.'
    ],
    HIDDEN_PAIR: [
      'In row 4, the digits 6 and 8 can go only in r4c3 and r4c7.',
      'They must be 6 and 8, one each, and hold nothing else: r4c3 and r4c7 keep only 6 and 8. So 9 is removed from r4c3; 3 is removed from r4c7.'
    ],
    HIDDEN_TRIPLE: [
      'In row 8, the digits 3, 5 and 9 can go only in r8c4, r8c6 and r8c9.',
      'They must be 3, 5 and 9, one each, and hold nothing else: r8c4 keeps only 3 and 5; r8c6 keeps only 3 and 9. So 2 and 7 are removed from r8c4; 4 and 8 are removed from r8c6.'
    ],
    HIDDEN_QUADRUPLE: [
      'In box 5, the digits 1, 2, 5 and 8 can go only in r4c5, r4c6, r5c5 and r5c6.',
      'They must be 1, 2, 5 and 8, one each, and hold nothing else: r4c5 keeps only 1 and 2; r4c6 keeps only 1 and 5; r5c5 keeps only 2 and 8. So 9 is removed from r4c5, r4c6; 7 is removed from r5c5.'
    ]
  },
  nb: {
    FULL_HOUSE: ['Rad 4 har én tom rute, r4c9, og mangler bare 8.', 'Så må r4c9 være 8.'],
    NAKED_SINGLE: ['Det er bare én kandidat igjen i r4c1: 1.', 'Raden, kolonnen og boksen til r4c1 har allerede de åtte andre tallene.', 'Så må r4c1 være 1.'],
    HIDDEN_SINGLE: ['I rad 2 kan 1-tallet bare stå i r2c2.', '1-tallene i r4c1, r1c5 og r7c9 utelukker 1 i alle de andre tomme rutene i rad 2.', 'Så må r2c2 være 1.'],
    LOCKED_CANDIDATES_1: [
      'I boks 4 er r5c1 og r5c3 de eneste rutene som kan ta 3.',
      'En av dem må være 3, og begge ligger i rad 5, så ingen annen rute i rad 5 kan være 3.',
      'Så fjernes 3 fra r5c4.'
    ],
    NAKED_PAIR: ['I rad 9 har r9c2 og r9c7 bare 2 og 5.', 'De må være 2 og 5, ett tall i hver: disse tallene kan ikke stå noe annet sted i rad 9. Så fjernes 5 fra r9c6.'],
    NAKED_TRIPLE: [
      'I boks 8 har r7c4, r8c6 og r9c4 til sammen bare 2, 6 og 7.',
      'De må være 2, 6 og 7, ett tall i hver: disse tallene kan ikke stå noe annet sted i boks 8. Så fjernes 6 fra r7c5; 2 fjernes fra r9c6.'
    ],
    LOCKED_PAIR: [
      'I kolonne 1 og boks 1 har r1c1 og r2c1 bare 3 og 7.',
      'De må være 3 og 7, ett tall i hver: disse tallene kan ikke stå noe annet sted i kolonne 1 eller boks 1. Så fjernes 7 fra r2c3, r3c1, r3c3, r5c1, r6c1.'
    ],
    HIDDEN_TRIPLE: [
      'I rad 8 kan tallene 3, 5 og 9 bare stå i r8c4, r8c6 og r8c9.',
      'De må være 3, 5 og 9, ett tall i hver, og kan ikke ha andre tall: r8c4 beholder bare 3 og 5; r8c6 beholder bare 3 og 9. Så fjernes 2 og 7 fra r8c4; 4 og 8 fjernes fra r8c6.'
    ]
  },
  es: {
    FULL_HOUSE: ['La fila 4 tiene una sola casilla vacía, r4c9, y solo le falta el 8.', 'Por tanto, r4c9 debe ser 8.'],
    NAKED_SINGLE: ['En r4c1 solo queda un candidato: el 1.', 'La fila, la columna y la caja de r4c1 ya tienen los otros ocho números.', 'Por tanto, r4c1 debe ser 1.'],
    HIDDEN_SINGLE: [
      'En la fila 2, el 1 solo puede ir en r2c2.',
      'Los 1 de r4c1, r1c5 y r7c9 descartan el 1 en todas las demás casillas vacías de la fila 2.',
      'Por tanto, r2c2 debe ser 1.'
    ],
    LOCKED_CANDIDATES_2: [
      'En la fila 1, las únicas casillas que pueden tener el 5 son r1c5 y r1c6.',
      'Una de ellas debe ser 5, y las dos están en la caja 2, así que ninguna otra casilla de la caja 2 puede ser 5.',
      'Por tanto, se elimina el 5 de r2c5.'
    ],
    NAKED_PAIR: [
      'En la fila 9, r9c2 y r9c7 solo tienen 2 y 5.',
      'Deben ser 2 y 5, uno en cada una: esos números no pueden ir en ninguna otra casilla de la fila 9. Por tanto, se elimina el 5 de r9c6.'
    ],
    LOCKED_TRIPLE: [
      'En la fila 8 y la caja 7, r8c1, r8c2 y r8c3 solo tienen 2, 3 y 7 entre ellas.',
      'Deben ser 2, 3 y 7, uno en cada una: esos números no pueden ir en ninguna otra casilla de la fila 8 ni de la caja 7. Por tanto, se eliminan los candidatos 2 y 7 de r7c2, r8c8; se elimina el 7 de r7c3, r8c7.'
    ],
    HIDDEN_PAIR: [
      'En la fila 4, los números 6 y 8 solo pueden ir en r4c3 y r4c7.',
      'Deben ser 6 y 8, uno en cada una, y no pueden tener nada más: r4c3 y r4c7 conservan solo 6 y 8. Por tanto, se elimina el 9 de r4c3; se elimina el 3 de r4c7.'
    ]
  }
};

describe('the singles, subsets and Locked Candidates walk in their own sentences (H1)', () => {
  it('as the report asks, in the stored examples, in English, Norwegian and Spanish', () => {
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      for (const [tech, want] of Object.entries(WANT[lang]) as [Tech, string[]][]) {
        const step = findStep(tech, exampleGrid(EXAMPLES[tech]!))!;
        expect(walkFrames(step).map((f) => f.text), `${lang} ${tech}`).toEqual(want);
      }
    }
    // every technique's example pinned in English
    expect(Object.keys(WANT.en).sort()).toEqual([...TECHS].sort());
  });

  it('says the digits as a player says them, and names the row or column, in the stored examples: the description, the legend (L1)', () => {
    const at = (tech: Tech) => {
      const ex = EXAMPLES[tech]!;
      const step = findStep(tech, exampleGrid(ex))!;
      return [describeStep(step), ...legendOf(step, ex.values).map((e) => `${e.kind}: ${e.label}`)];
    };
    expect(at('NAKED_SINGLE')).toEqual([
      'Naked Single: the row, column and box of r4c1 already hold the other eight digits, so r4c1 must be 1.',
      'place: place: the cell with one candidate left',
      'secondary: the other eight digits, each already in its row, column or box'
    ]);
    expect(at('LOCKED_CANDIDATES_1')).toEqual([
      'Locked Candidates (Pointing): in box 4, every 3 lies in row 5, so no other cell of row 5 can be 3. Here, 3 is removed from r5c4.',
      'elim: remove',
      'primary: box 4: every 3 in it sits on one row',
      'secondary: row 5, which loses 3 outside box 4'
    ]);
    expect(at('LOCKED_CANDIDATES_2')).toEqual([
      'Locked Candidates (Claiming): in row 1, every 5 lies in box 2, so no other cell of box 2 can be 5. Here, 5 is removed from r2c5.',
      'elim: remove',
      'primary: row 1: every 5 in it sits in one box',
      'secondary: box 2, which loses 5 outside row 1'
    ]);
    expect(at('LOCKED_PAIR')).toEqual([
      'Locked Pair: in column 1 and box 1, r1c1 and r2c1 hold only 3 and 7, so these digits can go nowhere else in column 1 or box 1. Here, 7 is removed from r2c3, r3c1, r3c3, r5c1, r6c1.',
      'elim: remove',
      'primary: 2 cells that hold only 3 and 7 between them, in column 1 and box 1'
    ]);
    expect(at('NAKED_TRIPLE')).toEqual([
      'Naked Triple: in box 8, r7c4, r8c6 and r9c4 hold only 2, 6 and 7 between them, so these digits can go nowhere else in box 8. Here, 6 is removed from r7c5; 2 is removed from r9c6.',
      'elim: remove',
      'primary: 3 cells that hold only 2, 6 and 7 between them, in box 8'
    ]);
    expect(at('HIDDEN_TRIPLE')).toEqual([
      'Hidden Triple: in row 8, the digits 3, 5 and 9 can go only in r8c4, r8c6 and r8c9, so these cells hold nothing else. Here, 2 and 7 are removed from r8c4; 4 and 8 are removed from r8c6.',
      'elim: remove',
      'primary: the only 3 cells of row 8 where 3, 5 and 9 can go'
    ]);
    // no slash between digits in any language
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      for (const tech of TECHS) {
        const ex = EXAMPLES[tech]!;
        const step = findStep(tech, exampleGrid(ex))!;
        for (const t of [describeStep(step), ...legendOf(step, ex.values).map((e) => e.label), ...walkFrames(step).map((f) => f.text)])
          expect(t, `${lang} ${tech}`).not.toMatch(/\d\/\d/);
      }
    }
  });

  it('draws in each frame what it names, frame 1 exactly its cells, and something new each time, at the stored examples', () => {
    for (const tech of TECHS) {
      const g = exampleGrid(EXAMPLES[tech]!);
      expect(drawnWrong(findStep(tech, g)!, g), tech).toEqual([]);
    }
    // Locked Candidates: the box and its 3s, then row 5 with them
    const g = exampleGrid(EXAMPLES.LOCKED_CANDIDATES_1!);
    const step = findStep('LOCKED_CANDIDATES_1', g)!;
    expect(walkFrames(step).map((f) => frameMarks(step, f, (c) => g.values[c] > 0).bands.map((b) => `${b.unit}:${b.role}`))).toEqual([
      ['21:primary'],
      ['21:primary', '4:secondary'],
      ['21:primary', '4:secondary']
    ]);
  });

  it('says only what is true, and draws what it says, at every find along practice solve paths, in the three languages', () => {
    const byTech = practice as Record<string, { puzzle: string }[]>;
    const all = [...new Set(Object.values(byTech).flat().map((e) => e.puzzle))];
    // a sample: three puzzles practice serves for each of the techniques but the singles, and every sixteenth of the rest
    const puzzles =
      env.SINGLE_SCAN === 'all'
        ? all
        : [...new Set([...TECHS.flatMap((tech) => (byTech[tech] ?? []).slice(0, 3).map((e) => e.puzzle)), ...all.filter((_, i) => i % 16 === 0)])];
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const shapes = new Set<string>();
    for (const { step, g, sol, rebuild } of finds) {
      const at = `${step.tech} ${step.description}`;
      for (const w of [...wrongIn(step, g, sol), ...drawnWrong(step, g)]) wrong.push(`${at}: ${w}`);
      const texts = walkFrames(step).map((f) => f.text);
      // the shapes of sentence the find takes
      const tags: [boolean, string][] = [
        [step.tech === 'HIDDEN_SINGLE' && /^The \d in /.test(texts[1] ?? ''), 'one digit rules out'],
        [step.tech === 'HIDDEN_SINGLE' && /^The \ds in /.test(texts[1] ?? ''), 'several digits rule out'],
        [/, the other empty cell of /.test(texts[1] ?? ''), 'the other empty cell'],
        [/ but r\dc\d.*, where it was already ruled out\.$/.test(texts[1] ?? ''), 'beside cells ruled out earlier'],
        [/: it was already ruled out in every other empty cell\.$/.test(texts[0]), 'by earlier removals alone'],
        [/ ruled out earlier\.$/.test(texts[1] ?? ''), 'a naked single beside candidates ruled out earlier'],
        [/ all three lie in /.test(texts[1] ?? ''), 'Locked Candidates on three cells'],
        [step.tech.startsWith('NAKED_') && / between them\.$/.test(texts[0]), 'a naked subset between them'],
        [step.tech.startsWith('NAKED_') && !/ between them\.$/.test(texts[0]), 'a naked subset each holding every digit'],
        [/ keeps? only [^;]*; /.test(texts[1] ?? ''), 'cells that keep different digits']
      ];
      for (const [on, tag] of tags) if (on) shapes.add(tag);
      const english = texts.map(named);
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        const words = walkFrames(rebuild()).map((f) => named(f.text));
        if (JSON.stringify(words) !== JSON.stringify(english)) wrong.push(`${lang} ${at}: names other cells or digits than English`);
        setEngineText('en', null);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    for (const tech of TECHS) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(tech.endsWith('QUADRUPLE') ? 3 : 20);
    expect([...shapes].sort()).toEqual(
      [
        'one digit rules out',
        'several digits rule out',
        'the other empty cell',
        'beside cells ruled out earlier',
        'by earlier removals alone',
        'a naked single beside candidates ruled out earlier',
        'Locked Candidates on three cells',
        'a naked subset between them',
        'a naked subset each holding every digit',
        'cells that keep different digits'
      ].sort()
    );
  });
});
