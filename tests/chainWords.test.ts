/**
 * How a chain's walk ends (docs/hint-readability-2026-11.md, quick wins 7
 * and 8; src/engine/hintFrames.ts):
 * - an open chain (Skyscraper, 2-String Kite, Turbot Fish, X-Chain,
 *   XY-Chain, W-Wing, AIC and its grouped and ALS forms) ends on both its
 *   ends, one of which is true, and why each removal goes, before the
 *   removals (M2): a removal that sees both ends, of their digit; one in an
 *   end's cell that sees the other, "either way" not its digit; two ends in
 *   one cell, which holds one of their digits and nothing else;
 * - a continuous loop (Nice Loop, X-Cycles and their grouped forms, the
 *   chain trainer's closed loop) says, where it comes back to its start,
 *   that it holds whichever way round it is read, so each weak link has
 *   exactly one true end (H4); a discontinuous loop keeps its own words.
 * Held on the stored examples, on a position of each kind found along the
 * solve paths, against each puzzle's solution, in English, Norwegian and
 * Spanish.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, gridFromValues, sees } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, findStep, applyStep } from '../src/engine/humanSolver';
import { walkFrames, conclusionText } from '../src/engine/hintFrames';
import type { CellDigit, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';
import { solve } from '../src/engine/bruteForce';
import { setEngineText } from '../src/engine/text';
import { extend, chainStep, EMPTY_CHAIN } from '../src/engine/chainTrainer';
import type { Chain } from '../src/engine/chainTrainer';
import nb from '../src/content/locales/app.nb';
import es from '../src/content/locales/app.es';

/** a puzzle after the solver's first `at` steps */
function after(puzzle: string, at: number): Grid {
  const g = parseGrid(puzzle)!;
  for (let i = 0; i < at; i++) applyStep(g, findNextStep(g)!);
  return g;
}
const stepAt = (puzzle: string, at: number, tech: Tech) => findStep(tech, after(puzzle, at))!;
const last = (s: Step) => walkFrames(s).at(-1)!.text;
/** the frame of the chain's last link: the one that reaches it */
const closing = (s: Step) => walkFrames(s).find((f) => f.links === s.links!.length && !f.sets)!.text;
const holds = (solution: ArrayLike<number>, node: CellDigit[]) => node.some((cd) => solution[cd.cell] === cd.digit);

/** a stored example's grid, its candidates as stored */
function exampleGrid(tech: Tech): Grid {
  const ex = EXAMPLES[tech]!;
  const g = gridFromValues(ex.values.split('').map(Number));
  for (let i = 0; i < 81; i++) if (!g.values[i]) g.cands[i] = ex.cands[i];
  return g;
}

describe('an open chain ends on both its ends (docs/hint-readability-2026-11.md M2)', () => {
  afterEach(() => setEngineText('en', null));

  /** the stored examples' conclusions: the either/or and the reason, then the removals as conclusionText words them */
  const STORED: [Tech, string][] = [
    ['SKYSCRAPER', 'Either r2c7 (by the small dot) is 1, or the chain makes r9c9 1: one of them is 1. Each removed 1 sees both.'],
    ['TWO_STRING_KITE', 'Either r1c8 (by the small dot) is 8, or the chain makes r7c4 8: one of them is 8. Each removed 8 sees both.'],
    ['TURBOT_FISH', 'Either r5c7 (by the small dot) is 2, or the chain makes r7c6 2: one of them is 2. Each removed 2 sees both.'],
    ['X_CHAIN', 'Either r8c3 (by the small dot) is 1, or the chain makes r9c8 1: one of them is 1. Each removed 1 sees both.'],
    ['XY_CHAIN', 'Either r1c6 (by the small dot) is 4, or the chain makes r2c7 4: one of them is 4. Each removed 4 sees both.'],
    ['W_WING', 'Either r3c7 (by the small dot) is 6, or the chain makes r9c5 6: one of them is 6. Each removed 6 sees both.'],
    // a removal in an end's own cell: either way not its digit
    ['AIC', 'Either r1c6 (by the small dot) is 8, or the chain makes r1c9 2. Either way r1c9 is not 8.'],
    ['AIC_ALS', 'Either r2c9 (by the small dot) is 8, or the chain makes r6c9 9. Either way r6c9 is not 8.'],
    // a group at the end: every 8 of it
    ['AIC_GROUPED', 'Either r1c2 (by the small dot) is 8, or the chain puts 8 in one of r8c6, r9c6. Each removed 8 sees every 8 of both.']
  ];

  it("in the chain trainer, from its first strong link on, and only where the chain ends on a strong link", () => {
    const step = EXAMPLES.X_CHAIN!.step;
    const g = exampleGrid('X_CHAIN');
    const nodes = [step.links![0].from[0], ...step.links!.map((l) => l.to[0])];
    let chain: Chain = EMPTY_CHAIN;
    const ends: string[] = [];
    let built: Step | null = null;
    for (const node of nodes) {
      chain = extend(g, chain, node).chain;
      built = chainStep(g, chain);
      if (chain.links.length) ends.push(last(built));
    }
    expect(ends).toEqual([
      'Either r8c3 (by the small dot) is 1, or the chain makes r8c6 1: one of them is 1.',
      '',
      'Either r8c3 (by the small dot) is 1, or the chain makes r6c7 1: one of them is 1.',
      '',
      `Either r8c3 (by the small dot) is 1, or the chain makes r9c8 1: one of them is 1. Each removed 1 sees both. ${conclusionText(built!)}`
    ]);
  });

  it('in every stored open chain, before the removals', () => {
    for (const [tech, words] of STORED) {
      const step = EXAMPLES[tech]!.step;
      expect(last(step), tech).toBe(`${words} ${conclusionText(step)}`);
    }
  });
  /**
   * A position for each other kind of ending the finders give along the
   * solve paths of the pools, seeds and dailies (each of the 14,432 open
   * chains on offer there takes one of these forms or the stored
   * examples'): the step findStep gives after
   * the solver's first `at` steps, and what its conclusion says before the
   * removals
   */
  const FOUND: [string, number, Tech, string][] = [
    // an almost locked set at the end
    ['........17....149.3....4.....7.5..1959..4..3668..3.7.....6....7.768....59........', 18, 'AIC_GROUPED', 'Either r1c1 (by the small dot) is 2, or the chain puts a 2 in set A. Each removed 2 sees every 2 of both.'],
    ['..97....6.4..561......143...82....9.....2.....1....26...748......627..3.4....59..', 28, 'AIC_GROUPED', 'Either r1c7 (by the small dot) is 8, or the chain puts an 8 in set A. Each removed 8 sees every 8 of both.'],
    // two digits, the removal in the start's own cell
    ['...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.', 17, 'AIC_GROUPED', 'Either r1c1 (by the small dot) is 3, or the chain puts a 4 in set B. Either way r1c1 is not 4.'],
    ['83.7.....6....3.1..2.861....1.5.....98.....27.....8.5....487.3..4.6....9.....9.72', 8, 'AIC_GROUPED', 'Either r1c5 (by the small dot) is 9, or the chain puts 2 in one of r2c4, r2c5. Either way r1c5 is not 2.'],
    ['...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.', 17, 'AIC', 'Either r1c1 (by the small dot) is 3, or the chain makes r1c3 4. Either way r1c1 is not 4.'],
    // a removal in each end's cell
    ['....9.....3...28.99.....5.4..6.8....78.91....49...325.........5......9.1...43..6.', 17, 'AIC', 'Either r1c1 (by the small dot) is 1, or the chain makes r1c4 5. Either way r1c4 is not 1, and r1c1 is not 5.'],
    // both ends in one cell
    ['...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.', 11, 'AIC', 'Either r1c5 (by the small dot) is 6, or the chain makes r1c5 8. Either way r1c5 is 6 or 8, and nothing else.']
  ];

  it('in each kind of ending along the paths, and true in the solution: one end holds, and each removal is false', () => {
    for (const [puzzle, at, tech, words] of FOUND) {
      const step = stepAt(puzzle, at, tech);
      const where = `${puzzle} after ${at}`;
      expect(last(step), where).toBe(`${words} ${conclusionText(step)}`);
      const solution = solve(parseGrid(puzzle)!)!.values;
      const links = step.links!;
      expect(holds(solution, links[0].from) || holds(solution, links[links.length - 1].to), where).toBe(true);
      for (const e of step.eliminations) expect(solution[e.cell], where).not.toBe(e.digit);
    }
    // and in every stored open chain
    for (const [tech] of STORED) {
      const ex = EXAMPLES[tech]!;
      const links = ex.step.links!;
      const solution = solve(parseGrid(ex.puzzle)!)!.values;
      expect(holds(solution, links[0].from) || holds(solution, links[links.length - 1].to), tech).toBe(true);
    }
  });

  it('in Norwegian and Spanish', () => {
    const want = {
      nb: [
        'Enten er r2c7 (ved den lille prikken) 1, eller så gjør kjeden r9c9 til 1: én av dem er 1. Hvert 1-tall som fjernes, ser begge. ',
        'Enten er r1c6 (ved den lille prikken) 8, eller så gjør kjeden r1c9 til 2. Uansett er r1c9 ikke 8. ',
        'Enten er r1c2 (ved den lille prikken) 8, eller så setter kjeden 8 i en av r8c6, r9c6. Hvert 8-tall som fjernes, ser alle 8-tallene i begge. '
      ],
      es: [
        'O bien r2c7 (junto al punto pequeño) es 1, o la cadena hace que r9c9 sea 1: una de las dos es 1. Cada 1 eliminado ve las dos. ',
        'O bien r1c6 (junto al punto pequeño) es 8, o la cadena hace que r1c9 sea 2. En cualquier caso, r1c9 no es 8. ',
        'O bien r1c2 (junto al punto pequeño) es 8, o la cadena pone el 8 en una de r8c6, r9c6. Cada 8 eliminado ve todos los 8 de ambos extremos. '
      ]
    };
    for (const [lang, loc] of [
      ['nb', nb],
      ['es', es]
    ] as const) {
      setEngineText(lang, loc.engine);
      const ends = (['SKYSCRAPER', 'AIC', 'AIC_GROUPED'] as const).map((tech) => last(EXAMPLES[tech]!.step));
      ends.forEach((text, i) => expect(text.startsWith(want[lang][i]), `${lang}: ${text}`).toBe(true));
    }
  });
});


describe('a continuous loop says it closed, and that it holds either way round (docs/hint-readability-2026-11.md H4)', () => {
  afterEach(() => setEngineText('en', null));

  it('in every stored continuous loop, at the link back to its start, worded by its digits and its weak links', () => {
    expect(closing(EXAMPLES.GROUPED_X_CYCLES!.step)).toBe(
      'Weak link on 2: if r2c3 is 2, r1c1 cannot be 2 (they see each other). The chain is back at r1c1, as it began: the loop holds whichever way round it is read, so each dashed link has exactly one end that is 2.'
    );
    // several digits, and a weak link inside a cell, which draws no arrow
    expect(closing(EXAMPLES.NICE_LOOP!.step)).toBe(
      'Weak link on 3: if r2c5 is 3, r1c4 cannot be 3 (they see each other). The chain is back at r1c4, as it began: the loop holds whichever way round it is read, so each weak link, dashed or inside a cell, has exactly one end that is true.'
    );
    expect(closing(EXAMPLES.GROUPED_NICE_LOOP!.step)).toMatch(
      /^Weak link on 7: if one of r1c9, r2c9, r3c9 is 7, r1c8 cannot be 7 \(they see each other\)\. The chain is back at r1c8, as it began: the loop holds whichever way round it is read, so each weak link, dashed or inside a cell, has exactly one end that is true\.$/
    );
    // said once, and the conclusion stays the removals
    for (const tech of ['GROUPED_X_CYCLES', 'NICE_LOOP', 'GROUPED_NICE_LOOP'] as const) {
      const step = EXAMPLES[tech]!.step;
      expect(walkFrames(step).filter((f) => /The chain is back at/.test(f.text)), tech).toHaveLength(1);
      expect(last(step), tech).toBe(conclusionText(step));
    }
  });

  /** a loop of each kind along the paths: the step findStep gives after the solver's first `at` steps, and its closing words */
  const LOOPS: [string, number, Tech, string][] = [
    // one digit
    ['...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.', 11, 'X_CYCLES', 'each dashed link has exactly one end that is 4.'],
    ['1.........5.386...96...1...59.1..7.6..3...9..6.1..8.53...4...72...573.4.........5', 8, 'NICE_LOOP', 'each dashed link has exactly one end that is 9.'],
    // several digits, every weak link between cells
    ['.8.67.........374.5...2.8.........396...194......6..5...1...9..4.9........65.8...', 7, 'NICE_LOOP', 'each dashed link has exactly one end that is true.']
  ];

  it('in a loop of each kind along the paths, true in the solution: each weak link has exactly one true end', () => {
    for (const [puzzle, at, tech, words] of LOOPS) {
      const step = stepAt(puzzle, at, tech);
      const where = `${puzzle} after ${at}`;
      expect(closing(step), where).toMatch(new RegExp(`\\. The chain is back at r\\dc\\d, as it began: the loop holds whichever way round it is read, so ${words.replace('.', '\\.')}$`));
    }
    const loops = [...LOOPS.map(([puzzle, at, tech]) => ({ puzzle, step: stepAt(puzzle, at, tech) })), ...(['GROUPED_X_CYCLES', 'NICE_LOOP', 'GROUPED_NICE_LOOP'] as const).map((tech) => ({ puzzle: EXAMPLES[tech]!.puzzle, step: EXAMPLES[tech]!.step }))];
    for (const { puzzle, step } of loops) {
      const solution = solve(parseGrid(puzzle)!)!.values;
      for (const l of step.links!.filter((x) => !x.strong)) expect(holds(solution, l.from) !== holds(solution, l.to), `${puzzle}: ${step.tech}`).toBe(true);
    }
  });

  it('is not said of a discontinuous loop, which says what it proves', () => {
    expect(closing(stepAt('1..52.97.5.39.8.1.................53..2.1.6..45.................4.3.62.7.95.72..8', 23, 'NICE_LOOP'))).toBe(
      'Strong link on 7: if r5c4 is not 7, r3c4 must be 7 (nowhere else for it). So assuming r3c4 is not 7 makes it 7: that is impossible, so r3c4 is 7.'
    );
    expect(closing(stepAt('83.7.....6....3.1..2.861....1.5.....98.....27.....8.5....487.3..4.6....9.....9.72', 11, 'GROUPED_X_CYCLES'))).toMatch(/: that is impossible, so none of them is 5\.$/);
  });

  it('in Norwegian and Spanish', () => {
    const want = {
      nb: 'Kjeden er tilbake ved r1c1, akkurat slik den begynte: sløyfen holder uansett hvilken vei den leses, så hver stiplet lenke har nøyaktig én ende som er 2.',
      es: 'La cadena ha vuelto a r1c1, tal como empezó: el bucle es válido sea cual sea el sentido en que se lea, así que cada enlace discontinuo tiene exactamente un extremo que es 2.'
    };
    for (const [lang, loc] of [
      ['nb', nb],
      ['es', es]
    ] as const) {
      setEngineText(lang, loc.engine);
      expect(closing(EXAMPLES.GROUPED_X_CYCLES!.step).endsWith(` ${want[lang]}`), lang).toBe(true);
      expect(closing(EXAMPLES.NICE_LOOP!.step), lang).toMatch(lang === 'nb' ? /så hver svak lenke, stiplet eller inne i en rute, har nøyaktig én ende som er sann\.$/ : /así que cada enlace débil, discontinuo o dentro de una casilla, tiene exactamente un extremo verdadero\.$/);
    }
  });

  it('is said of the chain trainer\'s closed loop too, and of no open chain', () => {
    const step = EXAMPLES.NICE_LOOP!.step;
    const g = exampleGrid('NICE_LOOP');
    let chain: Chain = EMPTY_CHAIN;
    for (const node of [step.links![0].from[0], ...step.links!.map((l) => l.to[0])]) chain = extend(g, chain, node).chain;
    expect(chain.closed).toBe(true);
    const built = chainStep(g, chain);
    expect(closing(built)).toMatch(/^If the 3 in r2c5 is true, the 3 in r1c4 is false \(.*\)\. The chain is back at r1c4, as it began: the loop holds whichever way round it is read, so each weak link, dashed or inside a cell, has exactly one end that is true\.$/);
    for (const tech of ['SKYSCRAPER', 'X_CHAIN', 'XY_CHAIN', 'AIC', 'AIC_GROUPED', 'AIC_ALS', 'W_WING', 'ALS_XY_CHAIN'] as const) {
      expect(walkFrames(EXAMPLES[tech]!.step).some((f) => /The chain is back at/.test(f.text)), tech).toBe(false);
    }
  });
});
