/**
 * Chute Remote Pair and Sue de Coq draw what their argument uses and walk
 * it in their own sentences (docs/hint-readability-2026-11.md, phase 6:
 * H2's and M3's parts for them, H1, L2's "chute").
 *
 * - Chute Remote Pair: the third box is a dashed acts-through band, its
 *   candidates of the digit its mini-line lacks are gold discs, all in the
 *   pair's lines, and the digit the mini-line holds is not marked there;
 *   the digit the pair cells lose to the removals turns purple with the
 *   frame that says one of them is it. The walk goes pair > the mini-line's
 *   missing digit > the either/or > the removal, and nothing says "chute".
 * - Sue de Coq: the line is a solid band with the line cell's digits in
 *   blue, the box a dashed band with the box cell's digits in gold, and the
 *   digit only the shared cells hold purple, each named in the legend; the
 *   walk names the shared cells, the line cell and the box cell and why
 *   each digit is locked where it is.
 * - Both keep their Copy step line as it always was.
 * - Along two solve paths that hold every kind of either (rows and
 *   columns; the mini-line's other digit a candidate, solved or missing
 *   too; shared cells of two and of three), every claim the words make is
 *   true of the solution, and every frame draws what its words name.
 */
import { describe, it, expect } from 'vitest';
import { EXAMPLES } from '../src/content/examples';
import { UNITS, bit, boxOf, cloneGrid, colOf, digitsOf, isSolved, parseGrid, rowOf, sees } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { applyStep, findNextStep, findStep } from '../src/engine/humanSolver';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { stepText } from '../src/content/eureka';
import { setEngineText } from '../src/engine/text';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';
import type { CellDigit, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

const gridOf = (p: { puzzle: string; values: string; cands: number[] }): Grid => {
  const g = parseGrid(p.puzzle)!;
  for (let c = 0; c < 81; c++) {
    g.values[c] = Number(p.values[c]);
    g.cands[c] = p.cands[c];
  }
  return g;
};
const example = (tech: Tech) => {
  const ex = EXAMPLES[tech]!;
  const g = gridOf(ex);
  return { g, step: findStep(tech, g)! };
};
const solvedIn = (g: Grid) => (c: number) => g.values[c] !== 0;
const kindAt = (step: Step, g: Grid, frame: Frame | null, cd: CellDigit) => frameMarks(step, frame, solvedIn(g)).cands.get(cd.cell)?.get(cd.digit);
const bandsAt = (step: Step, g: Grid, frame: Frame | null) => frameMarks(step, frame, solvedIn(g)).bands.map((b) => `${b.unit}:${b.role}`);
const legendAt = (step: Step, g: Grid, frame: Frame | null) => legendOf(step, Array.from(g.values).join(''), frame).map((e) => `${e.kind}: ${e.label}`);
const key = (cds: CellDigit[]) => cds.map((x) => `${x.cell}:${x.digit}`).sort();
/** the candidates of digit d in house u */
const candsIn = (g: Grid, u: number, d: number) => UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));
/** everything a view draws, to tell two frames apart */
const drawing = (step: Step, g: Grid, frame: Frame | null) => {
  const m = frameMarks(step, frame, solvedIn(g));
  return JSON.stringify({
    cands: [...m.cands].flatMap(([c, ds]) => [...ds].map(([d, k]) => `${c}:${d}:${k}`)).sort(),
    values: [...m.values].sort((a, b) => a[0] - b[0]),
    bands: m.bands.map((b) => `${b.unit}:${b.role}`).sort()
  });
};

describe('Chute Remote Pair draws the box its argument rests on (H2, L2)', () => {
  const { g, step } = example('CHUTE_REMOTE_PAIR');
  const frames = walkFrames(step);
  // r4c6 and r5c8 hold 5/6; row 6 of box 4 holds a solved 5 and no 6
  const pair = [32, 43];

  it("shades box 4 as a dashed band and marks its 6s gold, all in the pair's rows; the 5 the mini-line holds is not marked", () => {
    expect(step.units).toEqual([{ unit: 21, role: 'secondary' }]);
    expect(key(step.secondary!)).toEqual(key(candsIn(g, 21, 6).map((cell) => ({ cell, digit: 6 }))));
    expect(step.secondary!.length).toBeGreaterThan(0);
    expect(step.secondary!.every((x) => [3, 4].includes(rowOf(x.cell)))).toBe(true);
    // nothing in row 6 of box 4, the mini-line, wears a mark in any view
    const mini = UNITS[21].filter((c) => rowOf(c) === 5);
    for (const frame of [null, ...frames]) {
      const m = frameMarks(step, frame, solvedIn(g));
      for (const c of mini) expect([m.cands.has(c), m.values.has(c)], `r6c${colOf(c) + 1}`).toEqual([false, false]);
    }
    expect(step.labels).toEqual({
      primary: 'the pair: only 5 and 6 in both cells, in different rows and boxes of rows 4-6',
      secondary: "box 4's 6s: all in the pair's rows",
      fins: '5 in the pair: one of the two cells is 5'
    });
  });

  it('walks pair > the mini-line lacks 6 > either row makes a pair cell 5 > the removal, each frame drawing what it names', () => {
    expect(frames.map((f) => f.text)).toEqual([
      'r4c6 and r5c8 hold only 5 and 6, in different rows and boxes of rows 4-6.',
      "In box 4, row 6 has no 6, so the box's 6 is in row 4 or row 5.",
      "If box 4's 6 is in row 4, r4c6 cannot be 6 and is 5; if it is in row 5, r5c8 is 5. Either way one of the two is 5.",
      'r4c9 and r5c6 see both pair cells. So 5 is removed from r4c9, r5c6.'
    ]);
    // frame 1: the whole pair, blue, and nothing else
    for (const cell of pair) for (const digit of [5, 6]) expect(kindAt(step, g, frames[0], { cell, digit })).toBe('primary');
    expect(bandsAt(step, g, frames[0])).toEqual([]);
    // frame 2: box 4's band and its 6s
    expect(bandsAt(step, g, frames[1])).toEqual(['21:secondary']);
    for (const x of step.secondary!) expect(kindAt(step, g, frames[1], x)).toBe('secondary');
    // frame 3: the pair's 5s turn purple, the 6s stay blue; so in the full view
    for (const view of [frames[2], frames[3], null]) {
      for (const cell of pair) {
        expect(kindAt(step, g, view, { cell, digit: 5 })).toBe('fin');
        expect(kindAt(step, g, view, { cell, digit: 6 })).toBe('primary');
      }
    }
    for (const cell of pair) expect(kindAt(step, g, frames[1], { cell, digit: 5 })).toBe('primary');
    for (let i = 1; i < frames.length; i++) expect(drawing(step, g, frames[i]), `frame ${i + 1}`).not.toBe(drawing(step, g, frames[i - 1]));
    // the legend names what each frame draws
    expect(legendAt(step, g, frames[2])).toEqual([
      'primary: the pair: only 5 and 6 in both cells, in different rows and boxes of rows 4-6',
      "secondary: box 4's 6s: all in the pair's rows",
      'fin: 5 in the pair: one of the two cells is 5'
    ]);
  });

  it("says what a chute is in plain words, and keeps the description's proof", () => {
    expect(step.description).toBe(
      "Chute Remote Pair: r4c6 and r5c8 hold only 5 and 6, in different rows and boxes of rows 4-6. In box 4, row 6 (r6c1, r6c2, r6c3) has no 6, so the box's 6 is in row 4 or row 5, and the pair cell in that row cannot be 6: it is 5. One pair cell is therefore 5, so 5 is removed from every cell that sees both."
    );
    for (const [lang, table, words] of [
      ['en', null, /chute|mini-line/i],
      ['nb', engineNb, /boksrekke|minilinje/i],
      ['es', engineEs, /franja|minilínea/i]
    ] as const) {
      setEngineText(lang, table);
      try {
        const s = findStep('CHUTE_REMOTE_PAIR', g)!;
        const texts = [s.description.replace('Chute Remote Pair', ''), ...Object.values(s.labels!), ...walkFrames(s).map((f) => f.text)];
        for (const t of texts) expect(t, lang).not.toMatch(words);
      } finally {
        setEngineText('en', null);
      }
    }
  });
});

describe('Sue de Coq colours its digits by where they are locked (M3, H1)', () => {
  const { g, step } = example('SUE_DE_COQ');
  const frames = walkFrames(step);
  // r9c7, r9c8, r9c9 (2/4/6/7/8) where row 9 meets box 9; r9c4 (2/6) in the row, r7c7 (4/7) in the box
  const C = [78, 79, 80];

  it('bands row 9 solid and box 9 dashed, with the row cell\'s digits blue, the box cell\'s gold and the 8 purple', () => {
    expect(step.units).toEqual([
      { unit: 8, role: 'primary' },
      { unit: 26, role: 'secondary' }
    ]);
    const where = (cells: number[], ds: number[]) => cells.flatMap((cell) => ds.filter((d) => g.cands[cell] & bit(d)).map((digit) => ({ cell, digit })));
    expect(key(step.primary!)).toEqual(key(where([...C, 75], [2, 6])));
    expect(key(step.secondary!)).toEqual(key(where([...C, 60], [4, 7])));
    expect(key(step.fins!)).toEqual(key(where(C, [8])));
    expect(step.labels).toEqual({
      primary: '2 and 6 in row 9: one in r9c4, the other where it meets box 9',
      secondary: '4 and 7 in box 9: one in r7c7, the other where it meets row 9',
      fins: '8: where row 9 meets box 9, so in both'
    });
    // the full view's legend names all three
    expect(legendAt(step, g, null).filter((e) => !e.startsWith('elim'))).toEqual([
      'primary: 2 and 6 in row 9: one in r9c4, the other where it meets box 9',
      'secondary: 4 and 7 in box 9: one in r7c7, the other where it meets row 9',
      'fin: 8: where row 9 meets box 9, so in both'
    ]);
  });

  it('walks the row cell, the box cell, the shared cells\' last digit and the conclusion, each band with its frame', () => {
    expect(frames.map((f) => f.text)).toEqual([
      'In row 9, r9c4 holds only 2 and 6. Whichever it is, r9c7, r9c8 and r9c9 can take at most one of 2 and 6.',
      'The three cells are in box 9 too, where r7c7 holds only 4 and 7, so they can take at most one of 4 and 7 as well.',
      'Their only other digit is 8, which they can take at most once. Three cells need three digits, so they hold one of 2 and 6, one of 4 and 7, and the 8.',
      'Then r9c4 and the three cells hold both 2 and 6, r7c7 and the three cells both 4 and 7, and the three cells the 8. So 6 is removed from r9c1; 2 is removed from r9c2.'
    ]);
    expect(bandsAt(step, g, frames[0])).toEqual(['8:primary']);
    expect(bandsAt(step, g, frames[1])).toEqual(['8:primary', '26:secondary']);
    for (const x of step.fins!) {
      expect(kindAt(step, g, frames[1], x)).toBeUndefined();
      expect(kindAt(step, g, frames[2], x)).toBe('fin');
    }
    for (let i = 1; i < frames.length; i++) expect(drawing(step, g, frames[i]), `frame ${i + 1}`).not.toBe(drawing(step, g, frames[i - 1]));
  });

  it('names its houses and the digits each loses in the description', () => {
    expect(step.description).toBe(
      'Sue de Coq: r9c7, r9c8 and r9c9, in both row 9 and box 9, hold only 2, 4, 6, 7 and 8. r9c4 in row 9 takes 2 or 6, and r7c7 in box 9 takes 4 or 7, so the three cells hold one of 2 and 6, one of 4 and 7, and the 8. The other cells of row 9 outside box 9 lose 2, 6 and 8, and those of box 9 outside row 9 lose 4, 7 and 8.'

    );
  });
});

/**
 * Two puzzles whose solve paths, taken a position at a time, hold every
 * kind of either: Chute Remote Pairs in rows and in columns whose mini-line
 * holds the other digit as a candidate, as a solved digit, or neither, and
 * Sue de Coqs in rows and columns with two shared cells and with three
 */
const PATHS = [
  '...9..8..9..2....4....782.1....5.7.33....2..6..786..1...3.....8....471..4.1..5...',
  '.4.....2.3...2.5..6.9..8.......72368...5.6...76384.......4..7.9..7.6...1.8.....3.'
];
/** every Chute Remote Pair and Sue de Coq on offer along the two paths, each with its position and the solution */
function along(): { step: Step; g: Grid; sol: Uint8Array | number[] }[] {
  const out: { step: Step; g: Grid; sol: Uint8Array | number[] }[] = [];
  for (const puzzle of PATHS) {
    const g = parseGrid(puzzle)!;
    const sol = solve(cloneGrid(g))!.values;
    for (let s = 0; s < 400 && !isSolved(g); s++) {
      for (const tech of ['CHUTE_REMOTE_PAIR', 'SUE_DE_COQ'] as const) {
        const step = findStep(tech, g);
        if (step) out.push({ step, g: cloneGrid(g), sol });
      }
      const next = findNextStep(g);
      if (!next) break;
      applyStep(g, next);
    }
  }
  return out;
}
const ALONG = along();
const CRP_FINDS = 10;
const SDC_FINDS = 22;

describe('every Chute Remote Pair and Sue de Coq along two solve paths', () => {
  it('holds every kind of either', () => {
    const kinds = new Set<string>();
    for (const { step } of ALONG) {
      if (step.tech === 'CHUTE_REMOTE_PAIR') {
        const rows = /different rows/.test(step.description);
        const both = step.fins!.length === 4;
        kinds.add(`crp ${rows ? 'rows' : 'columns'} ${both ? 'neither' : step.copyOnly!.length ? 'candidate' : 'solved'}`);
      } else kinds.add(`sdc ${step.units![0].unit < 9 ? 'row' : 'column'} ${step.fins ? 3 : 2}`);
    }
    expect([...kinds].sort()).toEqual([
      'crp columns candidate',
      'crp columns neither',
      'crp columns solved',
      'crp rows candidate',
      'crp rows neither',
      'crp rows solved',
      'sdc column 2',
      'sdc column 3',
      'sdc row 2',
      'sdc row 3'
    ]);
  });

  it("Chute Remote Pair: every claim true of the solution, the box's missing digit always gold, never the digit present", () => {
    let n = 0;
    for (const { step, g, sol } of ALONG) {
      if (step.tech !== 'CHUTE_REMOTE_PAIR') continue;
      n++;
      const at = step.description;
      const pair = [...new Set(step.primary!.map((x) => x.cell))];
      const lineOf = /different rows/.test(at) ? rowOf : colOf;
      const lines = pair.map(lineOf);
      const box = step.units![0].unit;
      const lost = [...new Set(step.fins!.map((x) => x.digit))];
      const missing = lost.length === 2 ? lost : digitsOf(g.cands[pair[0]]).filter((d) => !lost.includes(d));
      // the gold: the box's every candidate of the missing digit, all in the pair's lines
      expect(step.secondary!.length, at).toBeGreaterThan(0);
      expect(key(step.secondary!), at).toEqual(key(missing.flatMap((d) => candsIn(g, box, d).map((cell) => ({ cell, digit: d })))));
      expect(step.secondary!.every((x) => lines.includes(lineOf(x.cell))), at).toBe(true);
      // in the solution the box's missing digit is in a pair cell's line, whose cell is then the other digit
      for (const m of missing) {
        const cell = UNITS[box].find((c) => sol[c] === m)!;
        expect(lines, at).toContain(lineOf(cell));
        expect(sol[pair[lines.indexOf(lineOf(cell))]], at).not.toBe(m);
      }
      // one pair cell is the digit lost; with neither present, one is each
      expect(pair.some((c) => lost.includes(sol[c])), at).toBe(true);
      if (lost.length === 2) expect(sol[pair[0]], at).not.toBe(sol[pair[1]]);
      // the lead: every removal sees both pair cells
      for (const e of step.eliminations) expect(pair.every((c) => sees(c, e.cell)), at).toBe(true);
      // what each frame names it draws: the pair whole in frame 1, the lost digit purple from frame 3
      const frames = walkFrames(step);
      expect(frames.length, at).toBe(4);
      for (const cell of pair) for (const digit of digitsOf(g.cands[cell])) expect(kindAt(step, g, frames[0], { cell, digit }), at).toBe('primary');
      for (const x of step.fins!) {
        expect(kindAt(step, g, frames[1], x), at).toBe('primary');
        expect(kindAt(step, g, frames[2], x), at).toBe('fin');
        expect(kindAt(step, g, null, x), at).toBe('fin');
      }
      for (let i = 1; i < frames.length; i++) expect(drawing(step, g, frames[i]), at).not.toBe(drawing(step, g, frames[i - 1]));
      expect(boxOf(pair[0]) !== boxOf(pair[1]) && !sees(pair[0], pair[1]), at).toBe(true);
    }
    expect(n).toBe(CRP_FINDS);
  });

  it('Sue de Coq: every claim true of the solution, each band with its frame', () => {
    let n = 0;
    for (const { step, g, sol } of ALONG) {
      if (step.tech !== 'SUE_DE_COQ') continue;
      n++;
      const at = step.description;
      const [line, box] = step.units!.map((u) => UNITS[u.unit]);
      const roles = [...step.primary!, ...step.secondary!, ...(step.fins ?? [])];
      const C = [...new Set(roles.map((x) => x.cell))].filter((c) => line.includes(c) && box.includes(c));
      const D = step.primary!.find((x) => !C.includes(x.cell))!.cell;
      const E = step.secondary!.find((x) => !C.includes(x.cell))!.cell;
      const [dd, ed] = [digitsOf(g.cands[D]), digitsOf(g.cands[E])];
      const inC = C.map((c) => sol[c]);
      // the shared cells hold one of the line cell's digits, one of the box cell's, and the third digit
      expect(inC.filter((d) => dd.includes(d)).length, at).toBe(1);
      expect(inC.filter((d) => ed.includes(d)).length, at).toBe(1);
      if (step.fins) expect(inC, at).toContain(step.fins[0].digit);
      // the lead: the line cell and the shared cells hold both its digits, the box cell and the shared cells both of its
      for (const d of dd) expect([D, ...C].some((c) => sol[c] === d), at).toBe(true);
      for (const d of ed) expect([E, ...C].some((c) => sol[c] === d), at).toBe(true);
      // the line's band with frame 1, the box's with frame 2, the third digit purple with frame 3
      const frames = walkFrames(step);
      expect(frames.length, at).toBe(step.fins ? 4 : 3);
      expect(bandsAt(step, g, frames[0]), at).toEqual([`${step.units![0].unit}:primary`]);
      expect(bandsAt(step, g, frames[1]), at).toEqual([`${step.units![0].unit}:primary`, `${step.units![1].unit}:secondary`]);
      for (let i = 1; i < frames.length; i++) expect(drawing(step, g, frames[i]), at).not.toBe(drawing(step, g, frames[i - 1]));
      // the removals: the line's digits from the line outside the box, the box's from the box outside the line
      for (const e of step.eliminations) {
        const inLine = line.includes(e.cell) && !box.includes(e.cell);
        const inBox = box.includes(e.cell) && !line.includes(e.cell);
        expect((inLine && !ed.includes(e.digit)) || (inBox && !dd.includes(e.digit)), at).toBe(true);
      }
    }
    expect(n).toBe(SDC_FINDS);
  });

  it('keeps every Copy step line as it was before the hint coloured them anew', () => {
    const lines = new Set(ALONG.map(({ step }) => stepText(step)));
    expect([...lines].sort()).toEqual(
      [
        'Chute Remote Pair: 1/9 in r5c2,r6c6 => r5c5<>1, r5c5<>9',
        'Chute Remote Pair: 1/9 in r4c4,r9c5 => r9c4<>1, r9c4<>9',
        'Chute Remote Pair: 1/9 in r5c2,r6c8 / 1 in r4c4 => r5c7<>1, r5c8<>1',
        'Chute Remote Pair: 1/9 in r5c2,r6c8 => r5c7<>1, r5c8<>1',
        'Chute Remote Pair: 5/8 in r2c3,r8c1 => r8c3<>5, r8c3<>8',
        'Chute Remote Pair: 6/9 in r8c3,r9c7 => r8c9<>9, r9c2<>9',
        'Chute Remote Pair: 5/8 in r2c3,r8c2 / 8 in r4c1 => r2c2<>8',
        'Chute Remote Pair: 5/8 in r2c3,r8c2 => r2c2<>8',
        'Sue de Coq: 1/4/6/9 in r2c46 / r1c5,r2c9 => r2c8<>4, r1c4<>1, r1c4<>9, r1c6<>1, r1c6<>9, r3c4<>1',
        'Sue de Coq: 1/3/7/9 in r1c56 / r1c9,r2c4 => r3c4<>1',
        'Sue de Coq: 5/6/8/9 in r45c3 / r2c3,r4c2 => r1c3<>5, r8c3<>5, r8c3<>8',
        'Sue de Coq: 2/5/6/8/9 in r789c2 / 5/6/8/9 in r4c2,r8c1 => r1c2<>2, r8c3<>2, r8c3<>5, r8c3<>8',
        'Sue de Coq: 2/5/6/8/9 in r789c2 / 5/6/8/9 in r4c2,r8c1 => r1c2<>2, r8c3<>2',
        'Sue de Coq: 2/5/6/8/9 in r8c123 / 2/5/6/9 in r7c2,r8c9 => r8c8<>2, r9c2<>6'
      ].sort()
    );
  });
});
