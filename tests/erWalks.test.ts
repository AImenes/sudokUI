/**
 * Empty Rectangle walks in its finder's own sentences and bands the houses
 * its argument uses (docs/hint-readability-2026-11.md, H1, M4 and L2; phase
 * 6), so it reads as the grouped 2-String Kite it is:
 * - the stored example walks as the report asks, in English, Norwegian and
 *   Spanish: the box's digits in its row and its column, then the pair, the
 *   only two of the digit in their line, then the two cases (the pair's
 *   other cell is the digit and the target sees it; or the cell on the box's
 *   line is, and the box's digit lies off that line, where the target sees
 *   it too), either way the target sees the digit, then the removal;
 * - each frame draws something new: the box's digits with the box, its row
 *   and its column banded solid in the pattern's colour, then the pair with
 *   its line banded dashed in the acts-through colour, then the removal; and
 *   each frame's legend names only what it draws;
 * - every sentence (the walk, the labels, the description) is true of its
 *   board and of the puzzle's solution at every find along practice solve
 *   paths, Norwegian and Spanish name the same cells and digits, and both
 *   orientations, a box digit off the arm in one cell and in two, and a box
 *   holding the digit where its row and column cross and not, all occur (a
 *   sample of the paths; ER_SCAN=all reads every practice puzzle's path).
 * The Copy step line is pinned in tests/eureka.test.ts, as it always was.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, bit, boxOf, parseGrid, isSolved, sees } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames, describe as describeStep } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { setEngineText } from '../src/engine/text';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

afterEach(() => setEngineText('en', null));

const OTHER = [
  ['nb', engineNb],
  ['es', engineEs]
] as const;

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const numbers = (s: string) => [...s.matchAll(/\d/g)].map((m) => Number(m[0]));
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const same = (a: number[], b: number[]) => JSON.stringify(sorted(a)) === JSON.stringify(sorted(b));
/** a row or a column as the words name it, as a house (a UNITS index) */
const house = (kind: string, n: string) => (kind === 'row' ? 0 : 9) + Number(n) - 1;
const inHouse = (u: number, cell: number) => UNITS[u].includes(cell);
const valuesOf = (g: Grid) => Array.from(g.values).join('');

const F1 = /^In box (\d), every (\d) lies in row (\d) or column (\d): (.+) in row \3, (.+) in column \4\.$/;
const F2 = /^(r\dc\d) and (r\dc\d) are the only (\d)s in (row|column) (\d), so one of them is \3\.$/;
const LEAD =
  /^If (r\dc\d) is (\d), (r\dc\d) sees it in (row|column) (\d)\. If (r\dc\d) is \2, (row|column) (\d) has no other \2, so the \2 of box (\d) must be in (r\dc\d)(?: or (r\dc\d))?, (?:which \3 sees|and \3 sees (both)) in (row|column) (\d)\. Either way \3 sees (a|an) \2\. So \2 is removed from \3\.$/;
const LABEL1 = /^box (\d): its (\d)s all lie in row (\d) or column (\d)$/;
const LABEL2 = /^(r\dc\d) and (r\dc\d): the only (\d)s in (row|column) (\d)$/;
const DESCRIPTION =
  /^The only (\d)s in (row|column) (\d) are (r\dc\d) and (r\dc\d)\. If (r\dc\d) is \1, (r\dc\d) sees it in (row|column) (\d)\. If (r\dc\d) is \1, box (\d) has no \1 left in (row|column) (\d), so its \1 lies in (row|column) (\d), which \7 sees too\. So \1 is removed from \7\.$/;

/**
 * What is wrong with an Empty Rectangle's English words at its position,
 * given the puzzle's solution: each sentence read back and held to the
 * board (which cells of a house hold the digit) and to the solution (one of
 * the pair is the digit; where it is the one on the box's line, the box's
 * digit lies off that line; the removal is not the answer)
 */
function wrongIn(step: Step, g: Grid, sol: Grid): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const texts = walkFrames(step).map((f) => f.text);
  const [a, b, c] = [F1.exec(texts[0]), F2.exec(texts[1]), LEAD.exec(texts[2] ?? '')];
  const [l1, l2, desc] = [LABEL1.exec(step.labels?.primary ?? ''), LABEL2.exec(step.labels?.secondary ?? ''), DESCRIPTION.exec(step.description)];
  if (!a || !b || !c || !l1 || !l2 || !desc || texts.length !== 3) return [`not an Empty Rectangle's words: ${[...texts, step.labels?.primary, step.labels?.secondary, step.description].join(' / ')}`];
  const d = Number(a[2]);
  const holds = (cell: number) => g.values[cell] === 0 && (g.cands[cell] & bit(d)) !== 0;
  const holding = (u: number) => UNITS[u].filter(holds);
  const box = 18 + Number(a[1]) - 1;
  const [row, col] = [house('row', a[3]), house('column', a[4])];
  const inBox = holding(box);
  // frame 1: the box's digits, every one of them in its row or its column, listed once under one of them
  const [listRow, listCol] = [cellsIn(a[5]), cellsIn(a[6])];
  ok(same([...listRow, ...listCol], inBox) && new Set([...listRow, ...listCol]).size === inBox.length, `the box's digits: ${texts[0]}`);
  ok(listRow.every((x) => inHouse(row, x)) && listCol.every((x) => inHouse(col, x)), `each in the line it is listed under: ${texts[0]}`);
  ok(listRow.length > 0 && listCol.length > 0 && inBox.some((x) => !inHouse(row, x)) && inBox.some((x) => !inHouse(col, x)), `some off each line: ${texts[0]}`);
  // frame 2: the pair, the line's only two, in reading order, outside the box
  const [pa, pb] = [cellOf(b[1]), cellOf(b[2])];
  const line = house(b[4], b[5]);
  ok(Number(b[3]) === d && JSON.stringify(holding(line)) === JSON.stringify([pa, pb]), `the pair: ${texts[1]}`);
  ok(boxOf(pa) !== box - 18 && boxOf(pb) !== box - 18 && line !== row && line !== col, `the pair is outside the box: ${texts[1]}`);
  // the lead: the two cases, the pair's two cells
  const [p1, target, shared, p0, arm] = [cellOf(c[1]), cellOf(c[3]), house(c[4], c[5]), cellOf(c[6]), house(c[7], c[8])];
  const off = [c[10], c[11]].filter(Boolean).map((x) => cellOf(x!));
  const other = house(c[13], c[14]);
  ok(Number(c[2]) === d && Number(c[9]) - 1 === box - 18 && same([p0, p1], [pa, pb]) && p0 !== p1, `the cases are the pair's: ${texts[2]}`);
  ok(step.eliminations.length === 1 && step.eliminations[0].cell === target && step.eliminations[0].digit === d && holds(target), `the removal: ${texts[2]}`);
  ok(inHouse(shared, p1) && inHouse(shared, target), `the target sees ${c[1]} in ${c[4]} ${c[5]}: ${texts[2]}`);
  // the box's line through p0 is its row or its column, and the other runs through the target
  ok([row, col].includes(arm) && [row, col].includes(other) && arm !== other && inHouse(arm, p0) && inHouse(other, target), `the box's lines: ${texts[2]}`);
  ok(!inHouse(box, target), `the target is outside the box: ${texts[2]}`);
  // off the arm: exactly the box's digits not in it, all in the other line, every one of which the target sees there
  ok(same(off, inBox.filter((x) => !inHouse(arm, x))) && off.every((x) => inHouse(other, x) && sees(x, target)), `the box's digits off ${c[7]} ${c[8]}: ${texts[2]}`);
  ok(!!c[12] === off.length > 1, `"both" for two: ${texts[2]}`);
  ok((c[15] === 'an') === (d === 8), `a or an: ${texts[2]}`);
  // the labels: the box's lines, and the pair in its line
  ok(Number(l1[1]) - 1 === box - 18 && Number(l1[2]) === d && house('row', l1[3]) === row && house('column', l1[4]) === col, `the box's label: ${step.labels?.primary}`);
  ok(cellOf(l2[1]) === pa && cellOf(l2[2]) === pb && Number(l2[3]) === d && house(l2[4], l2[5]) === line, `the pair's label: ${step.labels?.secondary}`);
  // the description: the same pair, cases, houses and removal
  ok(
    Number(desc[1]) === d && house(desc[2], desc[3]) === line && cellOf(desc[4]) === pa && cellOf(desc[5]) === pb && cellOf(desc[6]) === p1 && cellOf(desc[7]) === target,
    `the description's pair and target: ${step.description}`
  );
  ok(house(desc[8], desc[9]) === shared && cellOf(desc[10]) === p0 && Number(desc[11]) - 1 === box - 18 && house(desc[12], desc[13]) === arm && house(desc[14], desc[15]) === other, `the description's houses: ${step.description}`);
  // the solution: one of the pair is the digit, and where it is p0 the box's digit lies off the arm; the removal is not the answer
  ok((sol.values[p0] === d) !== (sol.values[p1] === d), 'not exactly one of the pair is the digit in the solution');
  if (sol.values[p0] === d) ok(off.some((x) => sol.values[x] === d), "the box's digit is not off the arm, where p0 is the digit");
  ok(sol.values[target] !== d, 'the removal is the answer');
  return out;
}

/** a view's drawing: the candidates' marks and the bands, to tell two frames apart */
const drawing = (step: Step, frame: Frame | null, g: Grid) => {
  const m = frameMarks(step, frame, (c) => g.values[c] > 0);
  return JSON.stringify({ cands: [...m.cands].map(([c, d]) => [c, [...d]]).sort(), bands: m.bands.map((b) => `${b.unit}:${b.role}`).sort() });
};
const drawnCells = (step: Step, frame: Frame | null, g: Grid) => sorted([...frameMarks(step, frame, (c) => g.values[c] > 0).cands.keys()]);
const bandsAt = (step: Step, frame: Frame | null, g: Grid) => frameMarks(step, frame, (c) => g.values[c] > 0).bands.map((b) => `${b.unit}:${b.role}`);

/**
 * What is wrong with an Empty Rectangle's drawing: frame 1 draws other
 * cells than the box's digits, a frame does not draw a cell it names (but
 * the target before the last frame, which sees what is drawn), two frames
 * in a row draw the same, a band comes before its role's frame, and a
 * frame's legend names what it does not draw
 */
function drawnWrong(step: Step, g: Grid): string[] {
  const out: string[] = [];
  const frames = walkFrames(step);
  const box = step.primary!.map((cd) => cd.cell);
  const pair = step.secondary!.map((cd) => cd.cell);
  const target = step.eliminations[0].cell;
  const want = [sorted(box), sorted([...box, ...pair]), sorted([...box, ...pair, target])];
  frames.forEach((f, i) => {
    if (JSON.stringify(drawnCells(step, f, g)) !== JSON.stringify(want[i])) out.push(`frame ${i + 1} draws other cells: ${f.text}`);
    const drawn = new Set(drawnCells(step, f, g));
    for (const cell of cellsIn(f.text)) if (!drawn.has(cell)) out.push(`frame ${i + 1} names a cell it does not draw: ${f.text}`);
    if (i && drawing(step, frames[i - 1], g) === drawing(step, f, g)) out.push(`frames ${i} and ${i + 1} draw the same`);
  });
  // the bands frame by frame: the box with its row and its column, then the pair's line
  const units = step.units!;
  const lines = units.filter((u) => u.role === 'primary').map((u) => u.unit);
  const line = units.filter((u) => u.role === 'secondary').map((u) => u.unit);
  if (units.length !== 4 || lines.length !== 3 || line.length !== 1) out.push(`the bands: ${JSON.stringify(units)}`);
  if (lines[0] !== 18 + boxOf(box[0]) || !(lines[1] < 9) || !(lines[2] >= 9 && lines[2] < 18)) out.push(`the box's bands: ${JSON.stringify(lines)}`);
  if (!box.every((c) => inHouse(lines[1], c) || inHouse(lines[2], c))) out.push("a box digit off the box's row and column");
  if (!pair.every((c) => inHouse(line[0], c))) out.push("the pair off its line's band");
  const primary = lines.map((u) => `${u}:primary`);
  const at = frames.map((f) => bandsAt(step, f, g));
  const bands = [primary, [...primary, `${line[0]}:secondary`], [...primary, `${line[0]}:secondary`]];
  if (JSON.stringify(at) !== JSON.stringify(bands)) out.push(`the bands by frame: ${JSON.stringify(at)}`);
  // the full view draws every band
  if (JSON.stringify(bandsAt(step, null, g)) !== JSON.stringify(bands[2])) out.push(`the full view's bands: ${JSON.stringify(bandsAt(step, null, g))}`);
  // each frame's legend names only what it draws
  const kinds = frames.map((f) => legendOf(step, valuesOf(g), f).map((e) => e.kind).join());
  if (JSON.stringify(kinds) !== JSON.stringify(['primary', 'primary,secondary', 'elim,primary,secondary'])) out.push(`the legend by frame: ${kinds.join(' / ')}`);
  return out;
}

/** the cells and digits a sentence names, in any order */
const namedIn = (s: string) => JSON.stringify([sorted(cellsIn(s)), sorted(numbers(s.replace(/r\dc\d/g, '')))]);
/** every sentence of a step: the walk, the labels and the description */
const sentencesOf = (step: Step) => [...walkFrames(step).map((f) => f.text), step.labels!.primary!, step.labels!.secondary!, describeStep(step)];

/** every find of Empty Rectangle along the solve paths of these puzzles, with the puzzle's solution */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Grid }[] {
  const out: { step: Step; g: Grid; sol: Grid }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(g)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      const step = findStep('EMPTY_RECTANGLE', g);
      if (step) out.push({ step, g: { values: new Uint8Array(g.values), cands: new Uint16Array(g.cands), given: g.given }, sol });
      const s = findNextStep(g);
      if (!s) break;
      applyStep(g, s);
    }
  }
  return out;
}

const found = (): Step => findStep('EMPTY_RECTANGLE', exampleGrid(EXAMPLES.EMPTY_RECTANGLE!))!;

describe('Empty Rectangle walks in its own sentences, as the grouped Kite it is (H1, M4, L2)', () => {
  it('as the report asks, in the stored example, in English, Norwegian and Spanish', () => {
    const want: Record<string, string[]> = {
      en: [
        'In box 1, every 5 lies in row 1 or column 2: r1c2 and r1c3 in row 1, r2c2 in column 2.',
        'r1c5 and r6c5 are the only 5s in column 5, so one of them is 5.',
        'If r6c5 is 5, r6c2 sees it in row 6. If r1c5 is 5, row 1 has no other 5, so the 5 of box 1 must be in r2c2, which r6c2 sees in column 2. Either way r6c2 sees a 5. So 5 is removed from r6c2.',
        'box 1: its 5s all lie in row 1 or column 2',
        'r1c5 and r6c5: the only 5s in column 5',
        'The only 5s in column 5 are r1c5 and r6c5. If r6c5 is 5, r6c2 sees it in row 6. If r1c5 is 5, box 1 has no 5 left in row 1, so its 5 lies in column 2, which r6c2 sees too. So 5 is removed from r6c2.'
      ],
      nb: [
        'I boks 1 ligger alle 5-erne i rad 1 eller kolonne 2: r1c2 og r1c3 i rad 1, r2c2 i kolonne 2.',
        'r1c5 og r6c5 er de eneste 5-erne i kolonne 5, så én av dem er 5.',
        'Hvis r6c5 er 5, ser r6c2 den i rad 6. Hvis r1c5 er 5, har rad 1 ingen annen 5-er, så 5-eren i boks 1 må stå i r2c2, som r6c2 ser i kolonne 2. Uansett ser r6c2 en 5-er. Så fjernes 5 fra r6c2.',
        'boks 1: alle 5-erne der ligger i rad 1 eller kolonne 2',
        'r1c5 og r6c5: de eneste 5-erne i kolonne 5',
        'De eneste 5-erne i kolonne 5 er r1c5 og r6c5. Hvis r6c5 er 5, ser r6c2 den i rad 6. Hvis r1c5 er 5, har boks 1 ingen 5-er igjen i rad 1, så boksens 5-er ligger i kolonne 2, som r6c2 også ser. Så fjernes 5 fra r6c2.'
      ],
      es: [
        'En la caja 1, todos los 5 están en la fila 1 o en la columna 2: r1c2 y r1c3 en la fila 1, r2c2 en la columna 2.',
        'r1c5 y r6c5 son los únicos 5 de la columna 5, así que una de ellas es 5.',
        'Si r6c5 es 5, r6c2 lo ve en la fila 6. Si r1c5 es 5, la fila 1 no tiene otro 5, así que el 5 de la caja 1 tiene que estar en r2c2, que r6c2 ve en la columna 2. En cualquier caso, r6c2 ve un 5. Por tanto, se elimina el 5 de r6c2.',
        'caja 1: todos sus 5 están en la fila 1 o en la columna 2',
        'r1c5 y r6c5: los únicos 5 de la columna 5',
        'Los únicos 5 de la columna 5 son r1c5 y r6c5. Si r6c5 es 5, r6c2 lo ve en la fila 6. Si r1c5 es 5, a la caja 1 no le queda ningún 5 en la fila 1, así que su 5 está en la columna 2, que r6c2 también ve. Por tanto, se elimina el 5 de r6c2.'
      ]
    };
    for (const [lang, table] of [['en', null], ...OTHER] as const) {
      setEngineText(lang, table);
      expect(sentencesOf(found()), lang).toEqual(want[lang]);
    }
    // the stored step is the finder's
    setEngineText('en', null);
    expect(EXAMPLES.EMPTY_RECTANGLE!.step).toEqual(JSON.parse(JSON.stringify(found())));
  });

  it("words the box's digits off its line as two, when there are two, and an 8 with its article", () => {
    // box 9's 8s in row 7 (r7c8, r7c9) and column 7 (r8c7, r9c7), the
    // crossing r7c7 empty of them; the pair r7c4, r1c4 in column 4
    // every cell empty, holding 1 and 2 (no pattern on them), and 8 only where named
    const cands = new Uint16Array(81).fill(bit(1) | bit(2));
    for (const n of ['r7c8', 'r7c9', 'r8c7', 'r9c7', 'r7c4', 'r1c4', 'r1c7']) cands[cellOf(n)] |= bit(8);
    const at: Grid = { values: new Uint8Array(81), cands, given: new Uint8Array(81) };
    const step = findStep('EMPTY_RECTANGLE', at)!;
    expect(step.eliminations).toEqual([{ cell: cellOf('r1c7'), digit: 8 }]);
    expect(walkFrames(step).map((f) => f.text)).toEqual([
      'In box 9, every 8 lies in row 7 or column 7: r7c8 and r7c9 in row 7, r8c7 and r9c7 in column 7.',
      'r1c4 and r7c4 are the only 8s in column 4, so one of them is 8.',
      'If r1c4 is 8, r1c7 sees it in row 1. If r7c4 is 8, row 7 has no other 8, so the 8 of box 9 must be in r8c7 or r9c7, and r1c7 sees both in column 7. Either way r1c7 sees an 8. So 8 is removed from r1c7.'
    ]);
    for (const [lang, table] of OTHER) {
      setEngineText(lang, table);
      expect(walkFrames(findStep('EMPTY_RECTANGLE', at)!)[2].text, lang).toBe(
        lang === 'nb'
          ? 'Hvis r1c4 er 8, ser r1c7 den i rad 1. Hvis r7c4 er 8, har rad 7 ingen annen 8-er, så 8-eren i boks 9 må stå i r8c7 eller r9c7, og r1c7 ser begge i kolonne 7. Uansett ser r1c7 en 8-er. Så fjernes 8 fra r1c7.'
          : 'Si r1c4 es 8, r1c7 lo ve en la fila 1. Si r7c4 es 8, la fila 7 no tiene otro 8, así que el 8 de la caja 9 tiene que estar en r8c7 o en r9c7, y r1c7 ve las dos en la columna 7. En cualquier caso, r1c7 ve un 8. Por tanto, se elimina el 8 de r1c7.'
      );
    }
  });

  it('draws the box with its row and column, then the pair with its line, then the removal, each legend naming what its frame draws', () => {
    const g = exampleGrid(EXAMPLES.EMPTY_RECTANGLE!);
    const step = found();
    expect(drawnWrong(step, g)).toEqual([]);
    // box 1, row 1 and column 2 solid in the pattern's colour; column 5 dashed in the acts-through colour
    expect(step.units).toEqual([
      { unit: 18, role: 'primary' },
      { unit: 0, role: 'primary' },
      { unit: 10, role: 'primary' },
      { unit: 13, role: 'secondary' }
    ]);
    expect(legendOf(step, EXAMPLES.EMPTY_RECTANGLE!.values).map((e) => `${e.kind}: ${e.label}`)).toEqual([
      'elim: remove',
      'primary: box 1: its 5s all lie in row 1 or column 2',
      'secondary: r1c5 and r6c5: the only 5s in column 5'
    ]);
  });

  it('says only what is true, and draws what it says, at every find along practice solve paths, in the three languages', () => {
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    const puzzles =
      env.ER_SCAN === 'all'
        ? [...new Set(pools.map((e) => e.puzzle))]
        : [...new Set(pools.filter((e) => e.techs.includes('EMPTY_RECTANGLE')).map((e) => e.puzzle))].slice(0, 8);
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const shapes = new Set<string>();
    for (const { step, g, sol } of finds) {
      const at = step.description;
      for (const w of [...wrongIn(step, g, sol), ...drawnWrong(step, g)]) wrong.push(`${at}: ${w}`);
      const english = sentencesOf(step).map(namedIn);
      const box = step.primary!.map((cd) => cd.cell);
      const [row, col] = [step.units![1].unit, step.units![2].unit];
      const line = step.units![3].unit;
      shapes.add(
        [
          line < 9 ? 'pair in a row' : 'pair in a column',
          `${box.filter((c) => !inHouse(line < 9 ? col : row, c)).length} off the arm`,
          box.some((c) => inHouse(row, c) && inHouse(col, c)) ? 'crossing' : 'no crossing'
        ].join(', ')
      );
      for (const [lang, table] of OTHER) {
        setEngineText(lang, table);
        const there = findStep('EMPTY_RECTANGLE', g)!;
        if (JSON.stringify(sentencesOf(there).map(namedIn)) !== JSON.stringify(english)) wrong.push(`${lang} ${at}: names other cells or digits than English`);
        setEngineText('en', null);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    expect(finds.length).toBeGreaterThan(env.ER_SCAN === 'all' ? 4000 : 50);
    // both orientations, one box digit off the arm and two, the crossing holding the digit and not
    const seen = [...shapes];
    for (const part of ['pair in a row', 'pair in a column', '1 off the arm', '2 off the arm', ', crossing', 'no crossing']) {
      expect(seen.some((s) => s.includes(part)), `${part}: ${seen.join(' / ')}`).toBe(true);
    }
  });
});
