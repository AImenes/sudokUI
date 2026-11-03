/**
 * The words the readability check of November 2026 found wrong and small
 * enough to fix at once (docs/hint-readability-2026-11.md, section 4: quick
 * wins 1, 6, 10, 11, 15 and 17):
 * - H3: a fish's description runs no digit into its list of houses;
 * - M4 (Empty Rectangle): its labels and description name the row and the
 *   columns the argument uses, and say what is true (its walk and bands are
 *   held in tests/erWalks.test.ts);
 * - M20: the conclusion names its removals in reading order, a cell that
 *   loses several digits once, and the explanation never says "So" twice;
 * - M21: the explanation the full view shows ends with the conclusion
 *   unless its own words name every candidate placed or removed;
 * - L1: digits are never run together into a number ("256");
 * - L11 is held in tests/setWords.ts (a one-cell set named before its lock
 *   is named with its cell).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { Grid, cellName, colOf, rowOf, boxOf, parseGrid, isSolved, bit } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { conclusionText, describe as describeStep, namesCandidate, walkFrames } from '../src/engine/hintFrames';
import { listAnd, setEngineText, unitName } from '../src/engine/text';
import type { Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid, exampleStep } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

const LANGS = [
  ['en', null],
  ['nb', engineNb],
  ['es', engineEs]
] as const;

afterEach(() => setEngineText('en', null));

/** the grid mirrored in its main diagonal: rows become columns, so a finder finds its other orientation */
function transposed(g: Grid): Grid {
  const t = (cell: number) => colOf(cell) * 9 + rowOf(cell);
  const out: Grid = { values: new Uint8Array(81), cands: new Uint16Array(81), given: new Uint8Array(81) };
  for (let cell = 0; cell < 81; cell++) {
    out.values[t(cell)] = g.values[cell];
    out.cands[t(cell)] = g.cands[cell];
    out.given[t(cell)] = g.given[cell];
  }
  return out;
}

/** a technique's steps: at its stored example's position and at that position transposed */
function bothWays(tech: Tech): Step[] {
  const g = exampleGrid(EXAMPLES[tech]!);
  return [findStep(tech, g), findStep(tech, transposed(g))].filter((s): s is Step => s?.tech === tech);
}

/** the first `n` practice puzzles, of any pool, whose solve path takes a technique */
function puzzlesWith(tech: Tech, n: number): string[] {
  const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>);
  return [...new Set(pools.flatMap((pool) => pool.filter((e) => e.techs.includes(tech)).map((e) => e.puzzle)))].slice(0, n);
}

const FISH: Tech[] = [
  'X_WING',
  'SWORDFISH',
  'JELLYFISH',
  'FINNED_X_WING',
  'SASHIMI_X_WING',
  'FINNED_SWORDFISH',
  'SASHIMI_SWORDFISH',
  'FINNED_JELLYFISH',
  'SASHIMI_JELLYFISH'
];

describe('a fish names its houses as lists that end in a word, never in the digit (H3)', () => {
  /** the words before a list of rows or of columns, in each language */
  const HOUSES = /(?:rows|columns|radene|kolonnene|filas|columnas) (\d(?:(?:, | and | og | y )\d)*)/g;

  it('names exactly its base houses and its cover houses, in every language, both ways round, with and without several fins', () => {
    const shapes = new Set<string>();
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      for (const tech of FISH) {
        for (const s of bothWays(tech)) {
          const bases = s.units!.filter((u) => u.role === 'primary').map((u) => (u.unit % 9) + 1);
          const covers = s.units!.filter((u) => u.role === 'secondary').map((u) => (u.unit % 9) + 1);
          const lists = [...s.description.matchAll(HOUSES)].map((m) => [...m[1].matchAll(/\d/g)].map(Number));
          expect(lists, `${lang} ${s.description}`).toEqual([bases, covers]);
          // each list as the language writes one, and the digit only after it
          expect(s.description, lang).toContain(`${listAnd(bases)}`);
          expect(s.description, lang).toContain(`${listAnd(covers)}`);
          shapes.add(`${s.units![0].unit < 9 ? 'rows' : 'columns'} ${(s.fins?.length ?? 0) > 1 ? 'fins' : s.fins ? 'fin' : 'basic'}`);
        }
      }
    }
    // the six English sentences: basic, one fin and several fins, rows and columns
    expect([...shapes].sort()).toEqual(['columns basic', 'columns fin', 'columns fins', 'rows basic', 'rows fin', 'rows fins']);
  });

  it('reads as the report asks, in the three languages', () => {
    expect(EXAMPLES.X_WING!.step.description.startsWith('X-Wing on 7: in rows 3 and 8, the 7s lie only in columns 3 and 8 (r3c3, r3c8, r8c3, r8c8). ')).toBe(true);
    const want = {
      nb: 'X-Wing på 7: i radene 3 og 8 står 7-erne bare i kolonnene 3 og 8 (r3c3, r3c8, r8c3, r8c8). ',
      es: 'X-Wing en el 7: en las filas 3 y 8, los 7 solo están en las columnas 3 y 8 (r3c3, r3c8, r8c3, r8c8). '
    };
    for (const [lang, table] of LANGS.slice(1)) {
      setEngineText(lang, table);
      expect(exampleStep('X_WING', EXAMPLES.X_WING!).description.startsWith(want[lang as 'nb' | 'es']), lang).toBe(true);
    }
  });
});

describe("Empty Rectangle names the houses its argument uses, and what it says is true (M4's quick win; phase 6's two cases)", () => {
  /** what the English description claims, read back: the pair, then the two cases */
  const CLAIM =
    /^The only (\d)s in (row|column) (\d) are (r\dc\d) and (r\dc\d)\. If (r\dc\d) is \1, (r\dc\d) sees it in (row|column) (\d)\. If (r\dc\d) is \1, box (\d) has no \1 left in (row|column) (\d), so its \1 lies in (row|column) (\d), which \7 sees too\. So \1 is removed from \7\.$/;
  const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
  const unitOf = (kind: string, n: string) => (kind === 'row' ? 0 : 9) + Number(n) - 1;
  const inUnit = (u: number, cell: number) => (u < 9 ? rowOf(cell) === u : colOf(cell) === u - 9);

  it('in the stored example: row 1, column 2, column 5 and row 6, in the labels, the walk and the description', () => {
    const s = EXAMPLES.EMPTY_RECTANGLE!.step;
    expect(s.labels).toEqual({ primary: 'box 1: its 5s all lie in row 1 or column 2', secondary: 'r1c5 and r6c5: the only 5s in column 5' });
    expect(walkFrames(s).map((f) => f.text)).toEqual([
      'In box 1, every 5 lies in row 1 or column 2: r1c2 and r1c3 in row 1, r2c2 in column 2.',
      'r1c5 and r6c5 are the only 5s in column 5, so one of them is 5.',
      'If r6c5 is 5, r6c2 sees it in row 6. If r1c5 is 5, row 1 has no other 5, so the 5 of box 1 must be in r2c2, which r6c2 sees in column 2. Either way r6c2 sees a 5. So 5 is removed from r6c2.'
    ]);
    expect(s.description).toBe(
      'The only 5s in column 5 are r1c5 and r6c5. If r6c5 is 5, r6c2 sees it in row 6. If r1c5 is 5, box 1 has no 5 left in row 1, so its 5 lies in column 2, which r6c2 sees too. So 5 is removed from r6c2.'
    );
  });

  it('is true of the board in both orientations, at the example and along the practice paths', () => {
    const cases: { s: Step; g: Grid }[] = [];
    const g0 = exampleGrid(EXAMPLES.EMPTY_RECTANGLE!);
    cases.push({ s: findStep('EMPTY_RECTANGLE', g0)!, g: g0 }, { s: findStep('EMPTY_RECTANGLE', transposed(g0))!, g: transposed(g0) });
    for (const puzzle of puzzlesWith('EMPTY_RECTANGLE', 6)) {
      const g = parseGrid(puzzle)!;
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        const s = findStep('EMPTY_RECTANGLE', g);
        if (s) cases.push({ s, g: { values: new Uint8Array(g.values), cands: new Uint16Array(g.cands), given: g.given } });
        applyStep(g, findNextStep(g)!);
      }
    }
    const lines = new Set<string>();
    for (const { s, g } of cases) {
      const m = CLAIM.exec(s.description);
      expect(m, s.description).not.toBeNull();
      const [, d, lineKind, line, pa, pb, p1, target, sharedKind, shared, p0, box, armKind, arm, otherKind, other] = m!;
      const digit = Number(d);
      const holds = (cell: number) => g.values[cell] === 0 && (g.cands[cell] & bit(digit)) !== 0;
      const all = (u: number) => [...Array(81).keys()].filter((c) => holds(c) && (u < 18 ? inUnit(u, c) : boxOf(c) === u - 18));
      const [L, S, A, O] = [unitOf(lineKind, line), unitOf(sharedKind, shared), unitOf(armKind, arm), unitOf(otherKind, other)];
      // the pair are the line's only two, in reading order, and the two cases are the two of them
      expect(all(L).map(cellName), s.description).toEqual([pa, pb]);
      expect([p0, p1].sort(), s.description).toEqual([pa, pb].sort());
      // the second shares a line with the target; the first lies on one of the box's lines, and the other runs through the target
      expect([inUnit(S, cellOf(p1)), inUnit(S, cellOf(target))], s.description).toEqual([true, true]);
      const inBox = all(18 + Number(box) - 1);
      expect(A !== O && A < 18 && O < 18 && A < 9 !== O < 9 && inUnit(A, cellOf(p0)) && inUnit(O, cellOf(target)), s.description).toBe(true);
      // the box's digits all lie in its two lines, some off the arm, all of those in the other line
      expect(inBox.every((c) => inUnit(A, c) || inUnit(O, c)) && inBox.some((c) => !inUnit(A, c)), s.description).toBe(true);
      expect(s.eliminations, s.description).toEqual([{ cell: cellOf(target), digit }]);
      // the labels say the same houses
      const [row, col] = A < 9 ? [A, O - 9] : [O, A - 9];
      expect(s.labels, s.description).toEqual({
        primary: `box ${box}: its ${d}s all lie in row ${row + 1} or column ${col + 1}`,
        secondary: `${pa} and ${pb}: the only ${d}s in ${lineKind} ${line}`
      });
      lines.add(lineKind);
    }
    expect([...lines].sort()).toEqual(['column', 'row']);
    expect(cases.length).toBeGreaterThan(5);
  });
});

describe('the conclusion, in reading order, a cell named once (M20)', () => {
  const conclusion = (tech: Tech) => conclusionText(EXAMPLES[tech]!.step);

  it("names a cell that loses several digits once, and every removal in reading order, cells that lose the same digits together", () => {
    expect(conclusion('HIDDEN_TRIPLE')).toBe('So 2 and 7 are removed from r8c4; 4 and 8 are removed from r8c6.');
    expect(conclusion('UNIQUENESS_1')).toBe('So 5 and 8 are removed from r4c8.');
    expect(conclusion('LOCKED_PAIR')).toBe('So 7 is removed from r2c3, r3c1, r3c3, r5c1, r6c1.');
    expect(conclusion('LOCKED_TRIPLE')).toBe('So 2 and 7 are removed from r7c2, r8c8; 7 is removed from r7c3, r8c7.');
    expect(conclusion('GROUPED_NICE_LOOP')).toBe('So 7 and 9 are removed from r2c8, r3c8; 1 and 6 are removed from r9c9.');
    expect(conclusion('GROUPED_X_CYCLES')).toBe('So 2 is removed from r3c1, r3c6, r4c1.');
    expect(conclusion('DIGIT_FORCING_CHAIN')).toBe('So 3 and 6 are removed from r1c1.');
  });

  it('names each cell once, in reading order, in every stored example and in every language', () => {
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      for (const [tech, ex] of Object.entries(EXAMPLES)) {
        const s = exampleStep(tech as Tech, ex!);
        const named = [...conclusionText(s).matchAll(/r\dc\d/g)].map((m) => m[0]);
        const cells = [...new Set([...s.placements, ...s.eliminations].map((cd) => cd.cell))];
        expect(named.length, `${lang} ${tech}`).toBe(cells.length);
        expect(new Set(named).size, `${lang} ${tech}`).toBe(cells.length);
        // each clause's cells in reading order, and the clauses by their first cell
        const clauses = conclusionText(s).split('; ').map((c) => [...c.matchAll(/r\dc\d/g)].map((m) => m[0]));
        const at = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
        for (const c of clauses) expect(c.map(at), `${lang} ${tech}`).toEqual(c.map(at).sort((a, b) => a - b));
        // placements first, then removals: each kind in reading order of its first cell
        const firsts = clauses.map((c) => at(c[0]));
        const placed = s.placements.length ? new Set(s.placements.map((p) => p.cell)).size : 0;
        const kinds = [firsts.slice(0, placed), firsts.slice(placed)];
        for (const k of kinds) expect(k, `${lang} ${tech}`).toEqual([...k].sort((a, b) => a - b));
      }
    }
  });

  it('never says "So" twice in the explanation: the conclusion after a finder\'s sentence opens with "Here"', () => {
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const shown = describeStep(ex!.step);
      expect(shown.match(/(?:^|\. )So /g)?.length ?? 0, `${tech}: ${shown}`).toBeLessThanOrEqual(1);
      if (shown !== ex!.step.description) expect(shown, tech).toBe(`${ex!.step.description} ${conclusionText(ex!.step, 'here')}`);
    }
    expect(describeStep(EXAMPLES.UNIQUENESS_2!.step)).toBe(
      'Unique Rectangle Type 2: to avoid the deadly pattern on 4/7, one of r5c4/r6c4 must be 6, so 6 is removed from cells seeing both. Here, 6 is removed from r4c4.'
    );
    const want = { nb: 'Her fjernes 6 fra r4c4.', es: 'Aquí se elimina el 6 de r4c4.' };
    for (const [lang, table] of LANGS.slice(1)) {
      setEngineText(lang, table);
      expect(describeStep(exampleStep('UNIQUENESS_2', EXAMPLES.UNIQUENESS_2!)).endsWith(` ${want[lang as 'nb' | 'es']}`), lang).toBe(true);
    }
  });
});

describe('the explanation names what the step removes or places (M21)', () => {
  it('appends the conclusion where the sentence names a cell but not what leaves it', () => {
    const shown = (tech: Tech) => describeStep(EXAMPLES[tech]!.step);
    expect(shown('ALIGNED_PAIR_EXCLUSION').endsWith(' leaves no place for the removed candidate. Here, 8 is removed from r8c4.')).toBe(true);
    expect(shown('DIGIT_FORCING_CHAIN').endsWith(' the forced singles agree on the same conclusions. Here, 3 and 6 are removed from r1c1.')).toBe(true);
    expect(shown('AIC').endsWith(' a candidate that would make both false cannot be true. Here, 8 is removed from r1c9.')).toBe(true);
    expect(shown('EXOCET').endsWith(" So these targets hold the base's two digits and nothing else. Here, 8 is removed from r8c5.")).toBe(true);
    expect(shown('FIREWORKS').endsWith(' and these three cells hold nothing else. Here, 5 and 6 are removed from r2c6.')).toBe(true);
  });

  it('leaves alone, of the stored examples, exactly the sentences that name every candidate by its cell and digit', () => {
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      const alone = Object.entries(EXAMPLES)
        .filter(([tech, ex]) => {
          const s = exampleStep(tech as Tech, ex!);
          return describeStep(s) === s.description;
        })
        .map(([tech]) => tech)
        .sort();
      expect(alone, lang).toEqual(
        [
          'AVOIDABLE_RECTANGLE_1',
          'BUG_PLUS_1',
          'EMPTY_RECTANGLE',
          // its sentence ends on what goes, in words (the readability report's L2)
          'EXTENDED_RECTANGLE',
          'FULL_HOUSE',
          'HIDDEN_RECTANGLE',
          'HIDDEN_SINGLE',
          'MEDUSA_3D',
          'NAKED_SINGLE',
          'NISHIO_FORCING_CHAIN',
          'PATTERN_OVERLAY',
          'REMOTE_PAIR',
          'SIMPLE_COLORS',
          'UNIQUENESS_1',
          // its sentence names both removals' cells beside the digit (the review of the readability pass)
          'UNIQUENESS_4',
          'UNIQUENESS_6'
        ].sort()
      );
    }
  });

  it('reads a candidate as named only by its digit beside its cell, not by a house, a chain node or a list of digits', () => {
    const at = (name: string, digit: number) => ({ cell: (Number(name[1]) - 1) * 9 + Number(name[3]) - 1, digit });
    // named
    expect(namesCandidate('Unique Rectangle Type 1: r4c1, r4c8, r5c1, r5c8 would form a deadly pattern on 5/8; r4c8 cannot be 5 or 8.', at('r4c8', 8))).toBe(true);
    expect(namesCandidate('Hidden Single: 1 fits only in r2c2 within row 2.', at('r2c2', 1))).toBe(true);
    expect(namesCandidate('Empty Rectangle on 5: ... So 5 is removed from r6c2.', at('r6c2', 5))).toBe(true);
    // the review of the readability pass: the cells before a ';' and the digit after it ('so 4 is removed from both')
    // named no candidate, and UR4 and a 3D Medusa said their conclusion twice; their sentences now name both together
    expect(namesCandidate('r1c6 holds a dark purple 9 and a light purple 2; one of them is true, so 4 is removed from r1c6', at('r1c6', 4))).toBe(true);
    expect(namesCandidate('r1c6 holds a dark purple 9 and a light purple 2; one of them is true, so its 4 is removed', at('r1c6', 4))).toBe(false);
    // the cell alone
    expect(namesCandidate('Aligned Pair Exclusion: every candidate pairing of r7c4 and r8c4 that survives the sets they both see leaves no place for the removed candidate.', at('r8c4', 8))).toBe(false);
    expect(namesCandidate('Digit forcing: whether r1c1 is 8 or not, the forced singles agree on the same conclusions.', at('r1c1', 3))).toBe(false);
    // a house's number, in each language
    expect(namesCandidate('Hidden Pair: in row 4, digits 6/8 fit only in r4c3, r4c7, so all other candidates there can be removed.', at('r4c7', 4))).toBe(false);
    setEngineText('nb', engineNb);
    expect(unitName(3)).toBe('rad 4');
    expect(namesCandidate('Skjult par: i rad 4 passer tallene 6/8 bare i r4c3, r4c7, så alle andre kandidater i disse rutene kan fjernes.', at('r4c7', 4))).toBe(false);
    setEngineText('en', null);
    // a chain's node, a list of digits a cell holds, a digit in a cell's name
    expect(namesCandidate('AIC: 8@r1c6 → 4@r1c6 → 2@r1c9; at least one of 8@r1c6 and 2@r1c9 is true, so candidates conflicting with both are removed.', at('r1c9', 8))).toBe(false);
    expect(namesCandidate('Exocet: base r3c7, r3c8 (4/7/9) with targets r2c3 and r1c5: the targets keep only base candidates.', at('r3c8', 4))).toBe(false);
    expect(namesCandidate('X-Chain on 1: r8c3 → r8c6 → r9c8; one end must be 1.', at('r9c8', 8))).toBe(false);
  });
});

describe('digits are never run together into a number (L1)', () => {
  /** a number of two or more digits, outside cell names */
  const RUN = /(?<![rc\d])\d{2,}/;

  it('in any stored example: its description, its legend labels and its walk, in every language', () => {
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      for (const [tech, ex] of Object.entries(EXAMPLES)) {
        const s = exampleStep(tech as Tech, ex!);
        const texts = [s.description, ...Object.values(s.labels ?? {}), ...walkFrames(s).map((f) => f.text)];
        for (const t of texts) expect(t, `${lang} ${tech}`).not.toMatch(RUN);
      }
    }
  });

  it("writes a cell's or a pattern's digits with '/', as the report's examples name them", () => {
    const d = (tech: Tech) => EXAMPLES[tech]!.step.description;
    expect(d('XY_WING')).toContain('pivot r7c7 (7/9) with pincers r7c6 (6/7) and r8c9 (6/9)');
    expect(d('W_WING')).toContain('both hold 4/6;');
    expect(d('HIDDEN_RECTANGLE')).toContain('holds only 3/5,');
    // phase 6 writes them as a player says them (L1)
    expect(d('EXOCET')).toContain('hold two different digits of 2, 5 and 6');
    expect(d('SUE_DE_COQ')).toContain('hold only 2, 4, 6, 7 and 8');
    // the WXYZ-Wing's description is one line since phase 6 (L3), naming no cell's digits: tests/wingWalks.test.ts
    expect(d('CHUTE_REMOTE_PAIR')).toContain('hold only 5 and 6, in different rows and boxes of rows 4-6');
    expect(d('EXTENDED_RECTANGLE')).toContain('hold only 2, 4 and 9');
    expect(d('XYZ_WING')).toContain('(4/5/9)');
  });
});
