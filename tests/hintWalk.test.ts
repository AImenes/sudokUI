/**
 * The walk shows one new thing a frame, and the patterns draw what their
 * logic rests on (docs/hint-readability-2026-11.md, M1, H2, M4, M9, L4).
 *
 * - No two frames of a walk in a row draw the same, over every stored
 *   example and every step the drawing fixtures keep (M1). A pattern's
 *   band comes with its role's frame, a forcing step's broken house with
 *   the link into the contradiction, never from the first frame.
 * - A Hidden Single shades no band whose cells in its house another band
 *   already shades (M9).
 * - The uniqueness patterns draw the candidates and houses their argument
 *   uses, each in a role of its own: the Hidden Rectangle's strong digit in
 *   B's row and column, UR Type 3's roof extras and its naked subset's
 *   house, UR Type 4's locked digit and its house, UR Type 6's digit in its
 *   two lines (H2, M4); Avoidable Rectangle Type 2's rectangle before its
 *   extra digit (M4); UR Type 1's fourth corner and the Extended
 *   Rectangle's sixth cell before they go (L4).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from '../src/content/examples';
import { UNITS, bit, digitsOf, parseGrid, rowOf, colOf, PEERS, isSolved } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { walkFrames, drawnLinks } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, isParity } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import { hiddenSingleStep } from '../src/engine/techniques/singles';
import type { CellDigit, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

type Kept = { id: string; step: Step; values: string };

/** a kept position's grid: the puzzle's givens, its digits and every cell's candidates */
function gridOf(p: { puzzle: string; values: string; cands: number[] }): Grid {
  const g = parseGrid(p.puzzle)!;
  for (let c = 0; c < 81; c++) {
    g.values[c] = Number(p.values[c]);
    g.cands[c] = p.cands[c];
  }
  return g;
}

/**
 * every stored example, and every step the drawing fixtures keep, found
 * again at its position by the finders as they are now
 */
function everyKept(): Kept[] {
  const out: Kept[] = Object.entries(EXAMPLES).map(([tech, ex]) => ({
    id: `example ${tech}`,
    step: findStep(tech as Tech, gridOf({ puzzle: ex!.puzzle, values: ex!.values, cands: ex!.cands }))!,
    values: ex!.values
  }));
  for (const file of ['tests/fixtures/drawingSnapshot.json', 'tests/fixtures/setDrawings.json']) {
    const fixture = JSON.parse(new TextDecoder().decode(readFileSync(file)));
    for (const [section, entries] of Object.entries<Record<string, { position: { puzzle: string; values: string; cands: number[] } }>>(fixture)) {
      if (section === 'examples') continue;
      for (const [id, { position }] of Object.entries(entries)) {
        const tech = id.split(', ').at(-1) as Tech;
        const step = findStep(tech, gridOf(position));
        if (step?.tech === tech) out.push({ id, step, values: position.values });
      }
    }
  }
  return out;
}
const KEPT = everyKept();
const exampleOf = (tech: Tech) => KEPT.find((k) => k.id === `example ${tech}`)!;

/** everything a view draws: the candidates' marks, the colours in rings, the solved digits, the bands, the sets, the lines and the links */
function drawingOf(step: Step, frame: Frame | null, values: string): string {
  const m = frameMarks(step, frame, (c) => values[c] !== '0');
  const per = <K>(map: Map<number, Map<number, K>>) => [...map].flatMap(([c, ds]) => [...ds].map(([d, k]) => `${c}:${d}:${k}`)).sort();
  return JSON.stringify({
    cands: per(m.cands),
    inside: per(m.inside),
    values: [...m.values].sort((a, b) => a[0] - b[0]),
    bands: m.bands.map((b) => `${b.unit}:${b.role}`).sort(),
    sets: m.sets,
    lines: [...m.lines].sort(),
    links: [...drawnLinks(step, frame)].sort((a, b) => a - b)
  });
}

const bandsAt = (k: Kept, frame: Frame | null) => frameMarks(k.step, frame, (c) => k.values[c] !== '0').bands.map((b) => `${b.unit}:${b.role}`);
const kindAt = (k: Kept, frame: Frame | null, cd: CellDigit) => frameMarks(k.step, frame, (c) => k.values[c] !== '0').cands.get(cd.cell)?.get(cd.digit);
const same = (a: CellDigit[] | undefined, b: CellDigit[]) =>
  JSON.stringify([...(a ?? [])].map((x) => `${x.cell}:${x.digit}`).sort()) === JSON.stringify(b.map((x) => `${x.cell}:${x.digit}`).sort());
/** the candidates of digit d in house u, at an example's position */
const candsIn = (tech: Tech, u: number, d: number): number[] => {
  const ex = EXAMPLES[tech]!;
  return UNITS[u].filter((c) => ex.values[c] === '0' && ex.cands[c] & bit(d));
};

describe('a walk', () => {
  it("walks a pattern in its finder's own sentences when the finder writes them (step.walk, H1)", () => {
    const ex = exampleOf('XY_WING');
    const s: Step = {
      ...ex.step,
      walk: {
        frames: [
          { text: 'The pivot holds only two digits.', show: ['primary'] },
          { text: 'Each pincer shares one of them.', show: ['secondary'] }
        ],
        lead: 'Either way a pincer holds the digit.'
      }
    };
    const frames = walkFrames(s);
    expect(frames.map((f) => f.text)).toEqual([
      'The pivot holds only two digits.',
      'Each pincer shares one of them.',
      `Either way a pincer holds the digit. ${walkFrames(ex.step).at(-1)!.text}`
    ]);
    expect([frames[0].show.has('primary'), frames[0].show.has('secondary')]).toEqual([true, false]);
    expect([frames[1].show.has('primary'), frames[1].show.has('secondary')]).toEqual([true, true]);
    expect(frames[2].show.has('conclusion')).toBe(true);
    // without it, the labels as before
    expect(walkFrames(ex.step).length).toBe(3);
  });

  it('draws something new in every frame: no two frames in a row draw the same (M1)', () => {
    const repeats: string[] = [];
    let walks = 0;
    for (const k of KEPT) {
      const frames = walkFrames(k.step);
      if (frames.length < 2) continue;
      walks++;
      for (let i = 1; i < frames.length; i++) {
        // a colouring's conclusion is its full view, which its last weak
        // tie's frame may already draw (the readability report's L10, a
        // phase 6 item): it alone may repeat the frame before it
        if (isParity(k.step) && i === frames.length - 1) continue;
        if (drawingOf(k.step, frames[i - 1], k.values) === drawingOf(k.step, frames[i], k.values)) repeats.push(`${k.id}: frames ${i} and ${i + 1}`);
      }
    }
    expect(walks).toBeGreaterThan(200);
    expect(repeats).toEqual([]);
  });

  it("draws a pattern's band with its role: its houses with the pattern, a house that loses with what acts on it (M1)", () => {
    let banded = 0;
    for (const k of KEPT) {
      const units = k.step.units ?? [];
      if (!units.length || k.step.links?.length) continue;
      // a band that is the whole drawing (a Full House) is there from the first frame
      const whole = !k.step.primary?.length && !k.step.secondary?.length && !k.step.fins?.length;
      for (const [i, frame] of walkFrames(k.step).entries()) {
        const want = units.filter((u) => whole || frame.show.has(u.role)).map((u) => `${u.unit}:${u.role}`);
        expect(bandsAt(k, frame).sort(), `${k.id}, frame ${i + 1}`).toEqual(want.sort());
      }
      banded++;
    }
    expect(banded).toBeGreaterThanOrEqual(20);
    // the report's own cases: the first frame shades only the pattern's houses
    const first = (tech: Tech) => bandsAt(exampleOf(tech), walkFrames(exampleOf(tech).step)[0]);
    expect(first('LOCKED_CANDIDATES_1')).toEqual(['21:primary']);
    expect(first('X_WING').every((b) => b.endsWith(':primary'))).toBe(true);
    expect(first('HIDDEN_SINGLE')).toEqual(['1:primary']);
    expect(first('BUG_PLUS_1')).toEqual([]);
    expect(first('FULL_HOUSE')).toEqual(['3:primary']);
  });

  it("draws a forcing step's broken house from the link into the contradiction, never inferences ahead of it (M1)", () => {
    let forcing = 0;
    for (const k of KEPT) {
      if (!k.step.units?.length || !k.step.links?.length) continue;
      const frames = walkFrames(k.step);
      const fin = (cd: CellDigit) => k.step.fins?.some((f) => f.cell === cd.cell && f.digit === cd.digit);
      const broken = k.step.links.findIndex((l) => l.to.some(fin));
      expect(broken, k.id).toBeGreaterThanOrEqual(0);
      for (const [i, frame] of frames.entries()) {
        expect(bandsAt(k, frame).length > 0, `${k.id}, frame ${i + 1}`).toBe(frame.links > broken);
      }
      forcing++;
    }
    expect(forcing).toBeGreaterThanOrEqual(1);
    // Nishio's row 4, six inferences early before
    const nishio = exampleOf('NISHIO_FORCING_CHAIN');
    expect(walkFrames(nishio.step).map((f) => bandsAt(nishio, f).length)).toEqual([0, 0, 0, 0, 0, 0, 1, 1]);
  });
});

describe('a Hidden Single (M9)', () => {
  /** every hidden single at a position, as its finder words each */
  const singlesAt = (g: Grid): Step[] => {
    const out: Step[] = [];
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const places = UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));
        if (places.length === 1) out.push(hiddenSingleStep(g, u, d, places[0]));
      }
    }
    return out;
  };

  it('shades no band whose cells in the house another band shades, and still shades every cell a placed digit rules out', () => {
    // the puzzles of the stored examples of singles, intersections and subsets, along their solve paths
    const families: Tech[] = ['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE', 'LOCKED_CANDIDATES_1', 'LOCKED_CANDIDATES_2', 'NAKED_PAIR', 'NAKED_TRIPLE', 'HIDDEN_PAIR', 'HIDDEN_TRIPLE', 'LOCKED_PAIR'];
    const puzzles = [...new Set(families.map((tech) => EXAMPLES[tech]!.puzzle))];
    let singles = 0;
    let dropped = 0;
    for (const puzzle of puzzles) {
      const g = parseGrid(puzzle)!;
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        for (const s of singlesAt(g)) {
          singles++;
          const [house, ...lines] = s.units!.map((b) => b.unit);
          const pos = s.placements[0].cell;
          const d = s.placements[0].digit;
          const others = UNITS[house].filter((x) => x !== pos && g.values[x] === 0);
          const crossing = (l: number) => others.filter((x) => UNITS[l].includes(x));
          // no band says nothing more than the others
          for (const l of lines) {
            const rest = lines.filter((m) => m !== l);
            expect(
              crossing(l).every((x) => rest.some((m) => UNITS[m].includes(x))),
              `${puzzle} step ${i}: ${s.description} band ${l}`
            ).toBe(false);
          }
          // every cell a placed d sees is still shaded
          for (const x of others) {
            if (!PEERS[x].some((p) => g.values[p] === d)) continue;
            expect(lines.some((l) => UNITS[l].includes(x)), `${puzzle} step ${i}: ${s.description} r${rowOf(x) + 1}c${colOf(x) + 1}`).toBe(true);
          }
          // and every d it shows shades a band
          for (const b of s.secondary!) expect(lines.some((l) => UNITS[l].includes(b.cell)), `${puzzle} step ${i}: ${s.description}`).toBe(true);
          const all = new Set<number>();
          for (const x of others) {
            const holders = PEERS[x].filter((p) => g.values[p] === d);
            const h = holders.find((p) => rowOf(p) === rowOf(x) || colOf(p) === colOf(x)) ?? holders[0];
            if (h !== undefined) all.add(rowOf(h) === rowOf(x) ? rowOf(x) : colOf(h) === colOf(x) ? 9 + colOf(x) : 18 + Math.floor(rowOf(x) / 3) * 3 + Math.floor(colOf(x) / 3));
          }
          dropped += all.size - lines.length;
        }
        const next = findNextStep(g);
        if (!next) break;
        applyStep(g, next);
      }
    }
    expect(singles).toBeGreaterThan(4000);
    // the bands another band covers, which the finder shaded before: 1,360 over these 4,108 singles
    expect(dropped).toBeGreaterThan(1000);
  });

  it("drops the stored example's column 5, which box 2's band already covers in row 2", () => {
    const s = exampleOf('HIDDEN_SINGLE').step;
    expect(s.units).toEqual([
      { unit: 1, role: 'primary' },
      { unit: 9, role: 'secondary' },
      { unit: 19, role: 'secondary' },
      { unit: 17, role: 'secondary' }
    ]);
    // r1c5's 1 stays: it shades box 2
    expect(same(s.secondary, [{ cell: 27, digit: 1 }, { cell: 4, digit: 1 }, { cell: 62, digit: 1 }])).toBe(true);
  });
});

describe('the uniqueness patterns draw what their argument uses (H2, M4, L4)', () => {
  it("Hidden Rectangle: the strong digit's candidates in B's row and column, the only ones there, banded and named", () => {
    const k = exampleOf('HIDDEN_RECTANGLE');
    const s = k.step;
    const B = s.eliminations[0].cell;
    const strong = s.secondary![0].digit;
    const confined = [...new Set([...candsIn('HIDDEN_RECTANGLE', rowOf(B), strong), ...candsIn('HIDDEN_RECTANGLE', 9 + colOf(B), strong)])];
    // the 5s of row 6 and column 5, all of them, are the rectangle's three
    expect(confined.sort((a, b) => a - b)).toEqual([49, 50, 76]);
    expect(same(s.secondary, confined.map((cell) => ({ cell, digit: strong })))).toBe(true);
    expect(s.units).toEqual([
      { unit: rowOf(B), role: 'secondary' },
      { unit: 9 + colOf(B), role: 'secondary' }
    ]);
    expect(s.labels!.secondary).toBe('5 in row 6 and in column 5: only in the rectangle');
    // the second frame draws them, the first does not
    const [one, two] = walkFrames(s);
    expect(bandsAt(k, one)).toEqual([]);
    expect(bandsAt(k, two).sort()).toEqual(['13:secondary', '5:secondary']);
    expect(confined.map((cell) => kindAt(k, two, { cell, digit: strong }))).toEqual(['secondary', 'secondary', 'secondary']);
  });

  it("UR Type 3: the roof's extras with the subset's cells, the house banded, and the roof, digits and house named", () => {
    const k = exampleOf('UNIQUENESS_3');
    const s = k.step;
    const ex = EXAMPLES.UNIQUENESS_3!;
    const [x, y] = digitsOf(s.primary!.filter((cd) => cd.cell === s.primary![0].cell).reduce((m, cd) => m | bit(cd.digit), 0));
    const corners = [...new Set(s.primary!.map((cd) => cd.cell))];
    const roof = corners.filter((c) => ex.cands[c] !== (bit(x) | bit(y)));
    expect(roof).toEqual([57, 58]);
    // every extra of the roof is drawn, beside the subset's cells
    const extras = roof.flatMap((cell) => digitsOf(ex.cands[cell] & ~(bit(x) | bit(y))).map((digit) => ({ cell, digit })));
    for (const cd of extras) expect(s.secondary!.some((o) => o.cell === cd.cell && o.digit === cd.digit), `${cd.cell}:${cd.digit}`).toBe(true);
    // the subset's digits: those of the roof's extras and its cells, as many as its cells and the roof read as one
    const digits = new Set(s.secondary!.map((cd) => cd.digit));
    const cells = new Set(s.secondary!.map((cd) => cd.cell).filter((c) => !roof.includes(c)));
    expect(digits.size).toBe(cells.size + 1);
    // the band: a house holding the roof and the subset, the house the removals are in
    expect(s.units).toEqual([{ unit: 6, role: 'secondary' }]);
    for (const c of [...roof, ...cells, ...s.eliminations.map((e) => e.cell)]) expect(UNITS[6]).toContain(c);
    expect(s.labels!.secondary).toBe("1 and 6: the roof's extras (r7c4, r7c5, read as one cell) and r7c6 hold only these in row 7, a naked pair");
    for (const words of ['r7c4, r7c5', '(1 and 6)', 'row 7', 'naked pair with r7c6']) expect(s.description).toContain(words);
    expect(bandsAt(k, walkFrames(s)[1])).toEqual(['6:secondary']);
  });

  it('UR Type 4: the locked digit in the roof in its own colour, and the house it is locked into', () => {
    const k = exampleOf('UNIQUENESS_4');
    const s = k.step;
    const [unit] = s.units!.map((u) => u.unit);
    const keep = s.secondary![0].digit;
    // in column 9, the roof holds every 6
    expect(unit).toBe(17);
    expect(same(s.secondary, candsIn('UNIQUENESS_4', unit, keep).map((cell) => ({ cell, digit: keep })))).toBe(true);
    expect(same(s.secondary, s.eliminations.map((e) => ({ cell: e.cell, digit: keep })))).toBe(true);
    expect(s.labels).toEqual({ primary: 'the rectangle: 4/6 in all four corners', secondary: '6 in column 9: only in the roof, so one of r2c9, r8c9 is 6' });
    expect(bandsAt(k, walkFrames(s)[1])).toEqual(['17:secondary']);
  });

  it('UR Type 6: the digit in all four corners in its own colour, and the two lines it is confined to the rectangle in', () => {
    const k = exampleOf('UNIQUENESS_6');
    const s = k.step;
    const d = s.eliminations[0].digit;
    const corners = [...new Set(s.primary!.map((cd) => cd.cell))];
    expect(same(s.secondary, corners.map((cell) => ({ cell, digit: d })))).toBe(true);
    expect(s.units!.map((u) => u.unit)).toEqual([4, 5]);
    // rows 5 and 6 hold 6 only in the rectangle
    for (const u of [4, 5]) for (const c of candsIn('UNIQUENESS_6', u, d)) expect(corners).toContain(c);
    expect(s.labels!.secondary).toBe('6 in rows 5 and 6: only in the rectangle, so on one diagonal');
  });

  it('UR Type 4, UR Type 6 and Hidden Rectangle: frame 1 draws the whole rectangle its words name, frame 2 turns the key digit gold (G5)', () => {
    for (const tech of ['UNIQUENESS_4', 'UNIQUENESS_6', 'HIDDEN_RECTANGLE'] as Tech[]) {
      const k = exampleOf(tech);
      const s = k.step;
      const [one, two] = walkFrames(s);
      const [x, y] = s.labels!.primary!.match(/(\d)\/(\d) in all four corners/)!.slice(1).map(Number);
      const corners = [...new Set(s.primary!.map((cd) => cd.cell))];
      expect(corners, tech).toHaveLength(4);
      expect(one.text, tech).toBe(`The rectangle: ${x}/${y} in all four corners.`);
      // every corner's x and y, blue, as the sentence says
      for (const cell of corners) for (const digit of [x, y]) expect(kindAt(k, one, { cell, digit }), `${tech} frame 1 ${cell}:${digit}`).toBe('primary');
      // then the key digit in its own colour
      for (const cd of s.secondary!) expect(kindAt(k, two, cd), `${tech} frame 2 ${cd.cell}:${cd.digit}`).toBe('secondary');
    }
  });
  it("Avoidable Rectangle Type 2: the rectangle first, its solved corners and the candidates that would complete it, then the extra digit", () => {
    const k = exampleOf('AVOIDABLE_RECTANGLE_2');
    const s = k.step;
    const ex = EXAMPLES.AVOIDABLE_RECTANGLE_2!;
    const c = s.eliminations[0].digit;
    // the extra 3s in the two unsolved corners
    expect(s.secondary).toEqual([
      { cell: 46, digit: c },
      { cell: 73, digit: c }
    ]);
    // the solved corners by their digits, and the 4 in r6c2 and the 5 in r9c2, which would make the rectangle swap
    expect(same(s.primary, [{ cell: 47, digit: 5 }, { cell: 74, digit: 4 }, { cell: 46, digit: 4 }, { cell: 73, digit: 5 }])).toBe(true);
    for (const cd of s.primary!) {
      if (ex.values[cd.cell] !== '0') expect(Number(ex.values[cd.cell])).toBe(cd.digit);
      else expect(ex.cands[cd.cell] & bit(cd.digit)).toBeTruthy();
    }
    const [one, two] = walkFrames(s);
    expect(one.text).toBe('The two solved corners, neither of them a given, and the 4 and 5 that would complete the rectangle.');
    expect(two.text).toBe('3 in the two unsolved corners: one of them must be it.');
  });

  it("UR Type 1 and the Extended Rectangle: the corner the pattern must not reach, marked before its candidates go", () => {
    for (const [tech, words] of [
      ['UNIQUENESS_1', '5 and 8 in the fourth corner: either would complete the deadly pattern'],
      ['EXTENDED_RECTANGLE', '4 and 9 in r9c5: each would complete the deadly loop']
    ] as const) {
      const k = exampleOf(tech);
      const s = k.step;
      expect(same(s.secondary, s.eliminations), tech).toBe(true);
      expect(s.labels!.secondary, tech).toBe(words);
      const frames = walkFrames(s);
      // drawn in their own frame, then removed; the removal says why
      for (const e of s.eliminations) {
        expect(kindAt(k, frames[0], e), tech).toBeUndefined();
        expect(kindAt(k, frames[1], e), tech).toBe('secondary');
        expect(kindAt(k, frames.at(-1)!, e), tech).toBe('elim');
      }
      expect(legendOf(s, k.values).map((l) => l.label), tech).toContain(`remove: ${words}`);
    }
    // the first frame says nothing of a corner it does not draw
    expect(walkFrames(exampleOf('UNIQUENESS_1').step)[0].text).toBe('The three corners holding only 5/8.');
  });
});
