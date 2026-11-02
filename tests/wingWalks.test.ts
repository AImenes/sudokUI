/**
 * XY-Wing, XYZ-Wing and WXYZ-Wing walk in their finders' own sentences and
 * are coloured by what each digit does (docs/hint-readability-2026-11.md,
 * H1 and M3):
 * - the stored examples walk as the report asks, in English, Norwegian and
 *   Spanish: the pivot, each pincer's case, the either-way (XYZ-Wing's
 *   third case, the pivot itself, with it); a WXYZ-Wing's bivalue cell,
 *   its three cells, the case where the bivalue cell takes the digit they
 *   lose;
 * - frame 1 draws exactly the cells it names, every frame draws every cell
 *   it names and something new; a pincer's digit shared with the pivot is
 *   the pattern's, every z is in one role (gold), and a WXYZ-Wing's house
 *   is banded from the frame that names its three cells;
 * - every sentence is true of its board and of the puzzle's solution at
 *   every find of the three techniques along practice solve paths, and
 *   Norwegian and Spanish name the same cells and digits (a sample of the
 *   paths; WING_SCAN=all reads every practice puzzle's path).
 * Their Copy step lines are pinned in tests/eureka.test.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, bit, digitsOf, parseGrid, isSolved, sees, cellName } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { setEngineText } from '../src/engine/text';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

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

/** the cells a view draws a mark in */
const drawnCells = (step: Step, frame: Frame | null, g: Grid) => sorted([...frameMarks(step, frame, (c) => g.values[c] > 0).cands.keys()]);
/** everything a view draws, to tell two frames apart */
const drawing = (step: Step, frame: Frame | null, g: Grid) => {
  const m = frameMarks(step, frame, (c) => g.values[c] > 0);
  return JSON.stringify({ cands: [...m.cands].map(([c, d]) => [c, [...d]]).sort(), bands: m.bands.map((b) => b.unit).sort() });
};

const PIVOT2 = /^The pivot (r\dc\d) holds only (\d) and (\d)\.$/;
const PIVOT3 = /^The pivot (r\dc\d) holds only (\d), (\d) and (\d)\.$/;
const PINCER = /^If (r\dc\d) is (\d), the pincer (r\dc\d) \(only (\d) and (\d)\) must be (\d)\.$/;
const XY_LEAD = /^Either way a pincer is (\d); (.+?) (sees|see) both\. So /;
const XYZ_LEAD = /^Or the pivot is (\d) itself\. Whichever digit it takes, one of the three cells is \1; (.+?) (sees|see) all three\. So /;
const BIVALUE = /^The bivalue cell (r\dc\d) holds only (\d) and (\d)\.$/;
const THREE = /^The three cells (.+) in (row|column|box) (\d) hold only (.+) between them: one digit more than cells\.$/;
const IF_X = /^If (r\dc\d) is (\d), none of the three cells can be \2 \(it sees the \2s? in (.+?)\), so they must be (.+), and (one of )?(.+) is (\d)\.$/;
const WXYZ_LEAD = /^Either way (one of )?(.+?) is (\d); (.+?) (sees|see) (both|all of them)\. So /;

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
    const m = BIVALUE.exec(texts[0]);
    const three = THREE.exec(texts[1]);
    const ifX = IF_X.exec(texts[2]);
    if (!m || !three || !ifX || texts.length !== 4) return [`not a WXYZ-Wing walk: ${texts.join(' / ')}`];
    const l = cellOf(m[1]);
    ok(holdsOnly(g, l, [Number(m[2]), Number(m[3])]), 'the bivalue cell holds only the two digits named');
    const cells = cellsIn(three[1]);
    const house = (three[2] === 'row' ? 0 : three[2] === 'column' ? 9 : 18) + Number(three[3]) - 1;
    const digits = digitsIn(three[4]);
    const union = cells.reduce((u, c) => u | g.cands[c], 0);
    ok(cells.length === 3 && !cells.includes(l) && cells.every((c) => g.values[c] === 0 && UNITS[house].includes(c)), `three cells in ${three[2]} ${three[3]}`);
    ok(union === maskOf(digits) && digits.length === 4, 'the three cells hold only the four digits named');
    const x = Number(ifX[2]);
    ok(cellOf(ifX[1]) === l && holdsOnly(g, l, sorted([x, z])), 'the case names the bivalue cell and its other digit');
    const seen = cellsIn(ifX[3]);
    ok(JSON.stringify(seen) === JSON.stringify(cells.filter((c) => g.cands[c] & bit(x))) && seen.every((c) => sees(c, l)), 'it sees every x of the three cells');
    ok((ifX[3].includes(' and ') || ifX[3].includes(',')) === seen.length > 1, 'the x are counted right');
    const rest = digitsIn(ifX[4]);
    ok(maskOf(rest) === (union & ~bit(x)) && rest.length === 3, 'the three cells are left with the three digits named');
    const zs = cellsIn(ifX[6]);
    ok(Number(ifX[7]) === z && JSON.stringify(zs) === JSON.stringify(cells.filter((c) => g.cands[c] & bit(z))), 'the cells named are the three cells holding z');
    ok(!!ifX[5] === zs.length > 1, '"one of" agrees with the cells holding z');
    // the case, where the solution takes it: the three cells hold the three digits, and a z
    if (sol.values[l] === x) {
      ok(maskOf(cells.map((c) => sol.values[c])) === maskOf(rest), 'the three cells are not the digits named');
      ok(zs.some((c) => sol.values[c] === z), 'no cell named is z');
    }
    const lead = WXYZ_LEAD.exec(texts[3]);
    if (!lead) return [...out, `not a WXYZ-Wing's either-way: ${texts[3]}`];
    const all = cellsIn(lead[2]);
    ok(JSON.stringify(all) === JSON.stringify([l, ...zs]) && Number(lead[3]) === z, 'the lead names the bivalue cell and the cells holding z');
    ok(!!lead[1] === all.length > 2 && (lead[6] === 'both') === (all.length === 2), 'the lead counts the cells right');
    ok(all.some((c) => sol.values[c] === z), 'none of the cells named is z');
    removals(lead[4], lead[5], all);
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
  // by function: every z of the pattern gold, and nothing else
  const last = frameMarks(step, frames.at(-1)!, (c) => g.values[c] > 0).cands;
  const pattern = [...last].flatMap(([cell, m]) => [...m].filter(([, k]) => k === 'primary' || k === 'secondary').map(([digit, kind]) => ({ cell, digit, kind })));
  if (!pattern.every((cd) => (cd.kind === 'secondary') === (cd.digit === z))) out.push('a z is not gold, or gold is not a z');
  // the pattern's cells, every candidate of each drawn (a pincer's shared digit with it)
  const cells = [...new Set(pattern.map((cd) => cd.cell))];
  if (!cells.every((c) => digitsOf(g.cands[c]).every((d) => pattern.some((cd) => cd.cell === c && cd.digit === d)))) out.push('a candidate of the pattern is not drawn');
  if (step.tech === 'WXYZ_WING') {
    const bandAt = frames.map((f) => frameMarks(step, f, (c) => g.values[c] > 0).bands.length);
    if (JSON.stringify(bandAt) !== '[0,1,1,1]') out.push(`the house is banded in frames ${bandAt}`);
  }
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
          'The bivalue cell r4c3 holds only 4 and 9.',
          'The three cells r4c4, r5c5 and r6c5 in box 5 hold only 1, 4, 7 and 9 between them: one digit more than cells.',
          'If r4c3 is 9, none of the three cells can be 9 (it sees the 9 in r4c4), so they must be 1, 4 and 7, and r5c5 is 4.',
          'Either way r4c3 or r5c5 is 4; r4c6 and r5c3 see both. So 4 is removed from r4c6, r5c3.'
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
          'Toverdiruten r4c3 har bare 4 og 9.',
          'De tre rutene r4c4, r5c5 og r6c5 i boks 5 har til sammen bare 1, 4, 7 og 9: ett tall mer enn ruter.',
          'Hvis r4c3 er 9, kan ingen av de tre rutene være 9 (den ser 9-tallet i r4c4), så de må være 1, 4 og 7, og r5c5 er 4.',
          'Uansett er r4c3 eller r5c5 lik 4; r4c6 og r5c3 ser begge. Så fjernes 4 fra r4c6, r5c3.'
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
          'La casilla bivalor r4c3 solo tiene 4 y 9.',
          'Las tres casillas r4c4, r5c5 y r6c5 de la caja 5 solo tienen 1, 4, 7 y 9 entre las tres: un número más que casillas.',
          'Si r4c3 es 9, ninguna de las tres casillas puede ser 9 (ve el 9 de r4c4), así que deben ser 1, 4 y 7, y r5c5 es 4.',
          'En cualquier caso, r4c3 o r5c5 es 4; r4c6 y r5c3 ven ambas. Por tanto, se elimina el 4 de r4c6, r5c3.'
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
    // every 4 in one colour, and box 5 banded
    const wxyz = EXAMPLES.WXYZ_WING!.step;
    expect(wxyz.secondary!.map((cd) => `${cellName(cd.cell)}:${cd.digit}`)).toEqual(['r4c3:4', 'r5c5:4']);
    expect(wxyz.units).toEqual([{ unit: 22, role: 'primary' }]);
    expect(wxyz.fins).toBeUndefined();
    expect(legend('WXYZ_WING')).toEqual(['elim: remove', 'primary: the bivalue cell and the three cells in box 5', 'secondary: the 4s: at least one of them is true']);
  });

  it('draws in each frame the cells it names, frame 1 nothing else, and something new each time, at the stored examples', () => {
    for (const tech of WINGS) {
      const g = exampleGrid(EXAMPLES[tech]!);
      expect(drawnWrong(findStep(tech, g)!, g), tech).toEqual([]);
    }
    // the XY-Wing's pivot alone, then each pincer with its shared digit blue and its 6 gold
    const g = exampleGrid(EXAMPLES.XY_WING!);
    const step = findStep('XY_WING', g)!;
    const kinds = (f: Frame) =>
      [...frameMarks(step, f, () => false).cands].flatMap(([c, m]) => [...m].map(([d, k]) => `${cellName(c)}:${d}:${k}`)).sort();
    expect(walkFrames(step).slice(0, 3).map(kinds)).toEqual([
      ['r7c7:7:primary', 'r7c7:9:primary'],
      ['r7c6:6:secondary', 'r7c6:7:primary', 'r7c7:7:primary', 'r7c7:9:primary'],
      ['r7c6:6:secondary', 'r7c6:7:primary', 'r7c7:7:primary', 'r7c7:9:primary', 'r8c9:6:secondary', 'r8c9:9:primary']
    ]);
  });

  it('says only what is true, and draws what it says, at every find along practice solve paths, in the three languages', () => {
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
      for (const w of [...wrongIn(step, g, sol), ...drawnWrong(step, g)]) wrong.push(`${at}: ${w}`);
      const english = walkFrames(step).map((f) => named(f.text));
      // the shapes of sentence the finds cover
      const texts = walkFrames(step).map((f) => f.text);
      shapes.add(`${step.tech} ${step.eliminations.length > 1 ? 'removals' : 'removal'}${/, and one of /.test(texts[2]) ? ', zs' : ''}${/the \ds in/.test(texts[2]) ? ', xs' : ''}`);
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        const there = findStep(step.tech, g)!;
        const words = walkFrames(there).map((f) => named(f.text));
        if (JSON.stringify(words) !== JSON.stringify(english)) wrong.push(`${lang} ${at}: names other cells or digits than English`);
        setEngineText('en', null);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    expect(finds.length).toBeGreaterThan(500);
    for (const tech of WINGS) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(50);
    // one removal and several, a WXYZ-Wing's z in one of the three cells and in several, its x in one and in several
    for (const shape of ['XY_WING removal', 'XY_WING removals', 'XYZ_WING removal', 'WXYZ_WING removal', 'WXYZ_WING removals', 'WXYZ_WING removal, zs'])
      expect([...shapes], shape).toContain(shape);
    expect([...shapes].some((s) => s.startsWith('WXYZ_WING') && s.endsWith('xs'))).toBe(true);
  });
});
