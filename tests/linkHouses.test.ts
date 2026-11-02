/**
 * A chain's link sentences name the house that makes each link
 * (docs/hint-readability-2026-11.md M17; src/engine/hintFrames.ts linkText,
 * src/engine/steps.ts withHouses):
 * - a strong link on one digit between cells says the house whose only
 *   places for the digit they are ("Strong link on 2 in box 8: r9c5 and
 *   r7c6 are its only 2s, so if r9c5 is not 2, r7c6 is."), a weak one the
 *   house they see each other in ("Weak link on 1 in column 3: r2c3 and
 *   r9c3 see each other, so ..."), a row or column before the box, so the
 *   box is named only where no line makes the link (Turbot Fish names the
 *   house its description does); a group is "one of" or "none of" its
 *   cells; a link inside a cell keeps its own words;
 * - a link into, out of or between almost locked sets names the house all
 *   its candidates lie in, where one does;
 * - the chain trainer's links between cells name theirs;
 * - held on the stored examples in English, Norwegian and Spanish, and at
 *   every find of the chain techniques along practice solve paths, against
 *   the board (the house named holds the link) and the puzzle's solution,
 *   Norwegian and Spanish naming the same cells, digits and house (a
 *   sample of the paths; LINK_SCAN=all reads every practice puzzle's path).
 * The drawings are not changed: tests/fixtures/drawingSnapshot.json and
 * setDrawings.json hold them, frame texts apart.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, bit, cellName, cloneGrid, isSolved, parseGrid } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { linkText, walkFrames } from '../src/engine/hintFrames';
import { chainStep, extend, EMPTY_CHAIN } from '../src/engine/chainTrainer';
import type { Chain } from '../src/engine/chainTrainer';
import { linkHouse } from '../src/engine/steps';
import type { ChainLink, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';
import { setEngineText, unitName } from '../src/engine/text';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

afterEach(() => setEngineText('en', null));

const OTHER = [
  ['nb', engineNb, ['rad', 'kolonne', 'boks']],
  ['es', engineEs, ['fila', 'columna', 'caja']]
] as const;

/** the chain techniques whose links the walk words (AIC_GROUPED's finder also gives AIC_ALS) */
const CHAINS: Tech[] = [
  'SKYSCRAPER',
  'TWO_STRING_KITE',
  'TURBOT_FISH',
  'W_WING',
  'X_CHAIN',
  'XY_CHAIN',
  'X_CYCLES',
  'GROUPED_X_CYCLES',
  'NICE_LOOP',
  'GROUPED_NICE_LOOP',
  'AIC',
  'AIC_GROUPED',
  'ALS_XZ',
  'ALS_XY_WING',
  'ALS_XY_CHAIN'
];

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const digitsIn = (s: string) => [...s.replace(/r\dc\d|(?:row|column|box|rad|kolonne|boks|fila|columna|caja) \d/g, '').matchAll(/\d/g)].map((m) => Number(m[0]));
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const uniq = <T>(xs: T[]) => [...new Set(xs)];
const same = (a: number[], b: number[]) => JSON.stringify(a) === JSON.stringify(b);
/** the house a sentence names ("row 3", "box 8"), as a UNITS index */
const houseOf = (kind: string, n: string) => (kind === 'row' ? 0 : kind === 'column' ? 9 : 18) + Number(n) - 1;
/** the empty cells of a house that hold the digit */
const places = (g: Grid, u: number, d: number) => UNITS[u].filter((c) => !g.values[c] && g.cands[c] & bit(d));

/** a strong link's sentence: the house, its only places for the digit, then the link read from its first end */
const STRONG = /^Strong link on (\d) in (row|column|box) (\d): (.+) are its only \1s, so if (?:none of (.+) is \1|(r\dc\d) is not \1), (?:one of (.+)|(r\dc\d)) is\.$/;
/** a weak link's sentence: the house they all see each other in, then the link */
const WEAK = /^Weak link on (\d) in (row|column|box) (\d): (.+?) (all )?see each other, so if (?:one of (.+)|(r\dc\d)) is \1, (?:none of (.+) is|(r\dc\d) is not)\.$/;

/** a link on one digit between different cells, outside a set's lock: the kind whose sentence names its house */
function betweenCells(link: ChainLink): { d: number; from: number[]; to: number[] } | null {
  if (link.text || link.undirected) return null;
  const d = link.from[0].digit;
  if (![...link.from, ...link.to].every((cd) => cd.digit === d)) return null;
  const [from, to] = [link.from, link.to].map((node) => uniq(node.map((cd) => cd.cell)));
  return from.some((c) => to.includes(c)) ? null : { d, from, to };
}

/** the almost locked set a link end is a node of, along a derived chain (src/engine/hintFrames.ts alsAt) */
const alsAt = (step: Step, k: number | undefined) => (step.truth === 'derived' && k !== undefined && step.sets?.[k]?.kind === 'als' ? step.sets[k] : undefined);

/**
 * What is wrong with a step's link sentences at its position, given the
 * puzzle's solution: a link between cells with no house, a house that
 * does not make the link (a strong link's cells not its only places for
 * the digit, a weak link's not all in it), a box named where a line makes
 * the link, a sentence that names other cells than the link's or words a
 * group wrong, a consequence false in the solution, and a frame that does
 * not read the sentence
 */
function wrongIn(step: Step, g: Grid, sol: Grid, shapes: Set<string>): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const frames = walkFrames(step);
  (step.links ?? []).forEach((link, i) => {
    const ends = betweenCells(link);
    if (!ends) return;
    const { d, from, to } = ends;
    const cells = [...from, ...to];
    const text = linkText(link, step);
    const [fromSet, toSet] = [alsAt(step, link.fromSet), alsAt(step, link.toSet)];
    if (link.unit === undefined) {
      // only a set link may lie in no one house (every x of one set seeing every x of the other across houses), and it then names none
      if (!(fromSet || toSet)) return void out.push(`no house: ${text}`);
      ok(linkHouse(g, cells, d, link.strong) < 0 && !/In (row|column|box) \d, | in (row|column|box) \d\./.test(text), `a set link names no house it lies in: ${text}`);
      return void shapes.add('set link in no one house');
    }
    const u = link.unit;
    // the house makes the link, on the board
    ok(cells.every((c) => UNITS[u].includes(c)), `the house does not hold every cell: ${text}`);
    if (link.strong) ok(same(sorted(places(g, u, d)), sorted(cells)), `not the house's only places for ${d}: ${text}`);
    // a row or column before the box (a Turbot Fish's strong link in the house its description names)
    if (step.tech === 'TURBOT_FISH' && link.strong) ok(step.description.includes(` in ${unitName(u)}`), `not the description's house: ${text}`);
    else ok(linkHouse(g, cells, d, link.strong) === u, `a box named where a line makes the link: ${text}`);
    // in the solution: a strong link's house holds the digit in one of its cells, a weak link's in at most one
    const holding = cells.filter((c) => sol.values[c] === d).length;
    ok(link.strong ? holding === 1 : holding <= 1, `false in the solution: ${text}`);
    // the frame that reaches the link reads it
    const frame = frames.find((f) => f.links === i + 1 && !f.sets);
    ok(!!frame?.text.startsWith(text), `the frame does not read the sentence: ${text}`);
    const house = unitName(u);
    if (fromSet || toSet) {
      // a set link: every candidate of the link, and every x of each set at its ends, in the house it names
      const xs = [fromSet, toSet].flatMap((set) => set?.members.filter((m) => m.digit === d).map((m) => m.cell) ?? []);
      ok(text.includes(`In ${house}, `) || text.includes(` in ${house}.`), `the set link names no house: ${text}`);
      ok(xs.every((c) => UNITS[u].includes(c)), `a set's ${d} outside ${house}: ${text}`);
      ok(same(sorted(uniq(cellsIn(text))), sorted(uniq(cellsIn(text).filter((c) => cells.includes(c))))), `names a cell outside the link: ${text}`);
      shapes.add(fromSet && toSet ? 'set to set' : fromSet ? 'out of a set' : 'into a set');
      return;
    }
    const m = (link.strong ? STRONG : WEAK).exec(text);
    if (!m) return void out.push(`not a link sentence of its house: ${text}`);
    ok(Number(m[1]) === d && houseOf(m[2], m[3]) === u, `names another digit or house: ${text}`);
    ok(same(cellsIn(m[4]), cells), `lists other cells than the link's: ${text}`);
    const [fromGroup, toGroup] = [from.length > 1, to.length > 1];
    if (link.strong) {
      ok(same(cellsIn(m[5] ?? m[6]), from) && !!m[5] === fromGroup, `reads another first end: ${text}`);
      ok(same(cellsIn(m[7] ?? m[8]), to) && !!m[7] === toGroup, `reads another last end: ${text}`);
    } else {
      ok(!!m[5] === cells.length > 2, `"all" does not agree: ${text}`);
      ok(same(cellsIn(m[6] ?? m[7]), from) && !!m[6] === fromGroup, `reads another first end: ${text}`);
      ok(same(cellsIn(m[8] ?? m[9]), to) && !!m[8] === toGroup, `reads another last end: ${text}`);
    }
    // which houses the cells share: the box alone, or a line and the box
    const lines = [...Array(18).keys()].filter((x) => cells.every((c) => UNITS[x].includes(c)));
    const where = u >= 18 ? (lines.length ? 'box, a line shared' : 'box alone') : 'line';
    shapes.add(`${link.strong ? 'strong' : 'weak'} ${fromGroup ? 'group' : 'cell'} to ${toGroup ? 'group' : 'cell'}, ${where}`);
  });
  return out;
}

/** every find of the chain techniques along the solve paths of these puzzles, where the solver needs more than a single, with the puzzle's solution */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Grid }[] {
  const out: { step: Step; g: Grid; sol: Grid }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(g)!;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      const next = findNextStep(g);
      if (!next) break;
      if (!['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(next.tech)) {
        for (const tech of CHAINS) {
          const step = findStep(tech, g);
          if (step?.links?.length) out.push({ step, g: cloneGrid(g), sol });
        }
      }
      applyStep(g, next);
    }
  }
  return out;
}

/** a step's link sentences between cells, in the language the engine is writing in (each is worded from the link when read) */
const wordsOf = (step: Step): string[] => (step.links ?? []).flatMap((l) => (betweenCells(l) ? [linkText(l, step)] : []));

/** the frames that read a link, a loop's closing words with its last: every frame but a set's and the conclusion */
const linkFrames = (step: Step) => walkFrames(step).slice(0, -1).filter((f) => !f.sets);

describe('a link sentence names the house that makes the link (M17)', () => {
  it('in the stored examples, in English, Norwegian and Spanish', () => {
    const links = (tech: Tech) => {
      const step = findStep(tech, exampleGrid(EXAMPLES[tech]!))!;
      return step.links!.map((l) => linkText(l, step));
    };
    // a diagonal link: the box is the house, and the board does not draw it
    expect(links('TURBOT_FISH')).toEqual([
      'Strong link on 2 in column 7: r5c7 and r9c7 are its only 2s, so if r5c7 is not 2, r9c7 is.',
      'Weak link on 2 in row 9: r9c7 and r9c5 see each other, so if r9c7 is 2, r9c5 is not.',
      'Strong link on 2 in box 8: r9c5 and r7c6 are its only 2s, so if r9c5 is not 2, r7c6 is.'
    ]);
    expect(links('TWO_STRING_KITE')).toEqual([
      'Strong link on 8 in row 1: r1c8 and r1c6 are its only 8s, so if r1c8 is not 8, r1c6 is.',
      'Weak link on 8 in box 2: r1c6 and r3c4 see each other, so if r1c6 is 8, r3c4 is not.',
      'Strong link on 8 in column 4: r3c4 and r7c4 are its only 8s, so if r3c4 is not 8, r7c4 is.'
    ]);
    // a link inside a cell keeps its own words
    expect(links('W_WING')).toEqual([
      'In r3c7: if it is not 6, it must be 4 (the cell has only these two).',
      'Weak link on 4 in column 7: r3c7 and r8c7 see each other, so if r3c7 is 4, r8c7 is not.',
      'Strong link on 4 in row 8: r8c7 and r8c5 are its only 4s, so if r8c7 is not 4, r8c5 is.',
      'Weak link on 4 in column 5: r8c5 and r9c5 see each other, so if r8c5 is 4, r9c5 is not.',
      'In r9c5: if it is not 4, it must be 6 (the cell has only these two).'
    ]);
    // groups: "none of" a false group, "one of" a true one, every cell in the list of the house's places
    expect(links('GROUPED_NICE_LOOP').filter((t) => !t.startsWith('In '))).toEqual([
      'Weak link on 9 in box 3: r1c8, r1c9, r2c9 and r3c9 all see each other, so if r1c8 is 9, none of r1c9, r2c9, r3c9 is.',
      'Strong link on 9 in column 9: r1c9, r2c9, r3c9 and r5c9 are its only 9s, so if none of r1c9, r2c9, r3c9 is 9, r5c9 is.',
      'Strong link on 8 in column 9: r5c9 and r9c9 are its only 8s, so if r5c9 is not 8, r9c9 is.',
      'Strong link on 7 in column 9: r9c9, r1c9, r2c9 and r3c9 are its only 7s, so if r9c9 is not 7, one of r1c9, r2c9, r3c9 is.',
      'Weak link on 7 in box 3: r1c9, r2c9, r3c9 and r1c8 all see each other, so if one of r1c9, r2c9, r3c9 is 7, r1c8 is not.'
    ]);
    expect(links('AIC_GROUPED').at(-1)).toBe('Strong link on 8 in box 8: r8c5, r8c6 and r9c6 are its only 8s, so if r8c5 is not 8, one of r8c6, r9c6 is.');
    // sets: the house every candidate of the link lies in
    expect(links('AIC_ALS')).toEqual([
      'Strong link on 8 in row 2: r2c9 and r2c8 are its only 8s, so if r2c9 is not 8, r2c8 is.',
      'If r2c8 is 8, set A holds no 8: every 8 of A sees r2c8 in column 8.',
      'If set A holds no 8, its other 2 digits fill its 2 cells, so one of r7c8, r8c8 must be 9.',
      'If set A holds a 9, r6c8 cannot be 9: it sees every 9 of A in column 8.',
      'Strong link on 9 in row 6: r6c8 and r6c9 are its only 9s, so if r6c8 is not 9, r6c9 is.'
    ]);
    expect(links('ALS_XY_WING').filter((t) => t.includes(' sees '))).toEqual([
      'In column 3, every 4 of set A sees every 4 of set C, the hinge r6c3: if r8c3 is 4, r6c3 cannot be 4.',
      'In row 6, every 6 of set C sees every 6 of set B: if r6c3 is 6, r6c8 cannot be 6.'
    ]);
    setEngineText('nb', engineNb);
    expect(links('TURBOT_FISH')[2]).toBe('Sterk lenke på 2 i boks 8: r9c5 og r7c6 er de eneste 2-erne der, så hvis r9c5 ikke er 2, er r7c6 det.');
    expect(links('TURBOT_FISH')[1]).toBe('Svak lenke på 2 i rad 9: r9c7 og r9c5 ser hverandre, så hvis r9c7 er 2, er r9c5 det ikke.');
    expect(links('GROUPED_NICE_LOOP')[1]).toBe(
      'Svak lenke på 9 i boks 3: r1c8, r1c9, r2c9 og r3c9 ser alle hverandre, så hvis r1c8 er 9, er ingen av r1c9, r2c9, r3c9 det.'
    );
    expect(links('AIC_ALS')[3]).toBe('Hvis mengde A har en 9, kan r6c8 ikke være 9: i kolonne 8 ser ruten hvert 9-tall i A.');
    expect(links('ALS_XY_WING').find((t) => t.startsWith('I kolonne'))).toBe(
      'I kolonne 3 ser hvert 4-tall i mengde A hvert 4-tall i mengde C, hengselet r6c3: hvis r8c3 er 4, kan r6c3 ikke være 4.'
    );
    setEngineText('es', engineEs);
    expect(links('TURBOT_FISH')[2]).toBe('Enlace fuerte en el 2, en la caja 8: r9c5 y r7c6 son sus únicos 2, así que si r9c5 no es 2, r7c6 sí lo es.');
    expect(links('TURBOT_FISH')[1]).toBe('Enlace débil en el 2, en la fila 9: r9c7 y r9c5 se ven, así que si r9c7 es 2, r9c5 no lo es.');
    expect(links('GROUPED_NICE_LOOP')[1]).toBe(
      'Enlace débil en el 9, en la caja 3: r1c8, r1c9, r2c9 y r3c9 se ven todas entre sí, así que si r1c8 es 9, ninguna de r1c9, r2c9, r3c9 lo es.'
    );
    expect(links('AIC_ALS')[1]).toBe('Si r2c8 es 8, el conjunto A no tiene ningún 8: cada 8 de A ve r2c8 en la columna 8.');
  });

  it('names the house its finder found, and a step built without houses keeps the words that name none', () => {
    // a Turbot Fish's strong links are named by the houses its description names
    const turbot = findStep('TURBOT_FISH', exampleGrid(EXAMPLES.TURBOT_FISH!))!;
    expect(turbot.links!.map((l) => l.unit)).toEqual([15, 8, 25]);
    expect(turbot.description).toContain('in box 8');
    // a box link whose cells are row 6's only 2s too: read as a row link the pattern would be a Skyscraper's
    const g = parseGrid('...2..4...64.37.1.......7.92.....5..7865.2193..5.....88.2.......1.72.85...3..1...')!;
    const boxed = findStep('TURBOT_FISH', g)!;
    expect(boxed.description).toContain('as are r6c7 and r6c8 in box 6');
    expect(linkText(boxed.links![2], boxed)).toBe('Strong link on 2 in box 6: r6c7 and r6c8 are its only 2s, so if r6c7 is not 2, r6c8 is.');
    expect(linkHouse(g, [51, 52], 2, true)).toBe(5);
    // a link without a house (a step kept from before houses were named)
    const step = EXAMPLES.TURBOT_FISH!.step;
    const bare = step.links!.map(({ unit: _, ...l }) => linkText(l, step));
    expect(bare[2]).toBe('Strong link on 2: if r9c5 is not 2, r7c6 must be 2 (nowhere else for it).');
  });

  it('says only what is true at every find of the chain techniques along practice solve paths, in the three languages', () => {
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    const puzzles =
      env.LINK_SCAN === 'all'
        ? uniq(pools.map((e) => e.puzzle))
        : uniq([...CHAINS, 'AIC_ALS' as Tech].flatMap((tech) => pools.filter((e) => e.techs.includes(tech)).slice(0, 1).map((e) => e.puzzle)));
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const shapes = new Set<string>();
    let longest = { lang: '', text: '' };
    for (const { step, g, sol } of finds) {
      const at = `${step.tech} ${step.description}`;
      for (const w of wrongIn(step, g, sol, shapes)) wrong.push(`${at}: ${w}`);
      const english = wordsOf(step);
      const houses = (step.links ?? []).flatMap((l) => (betweenCells(l) ? [l.unit] : []));
      for (const f of linkFrames(step)) if (f.text.length > longest.text.length) longest = { lang: 'en', text: f.text };
      for (const [lang, table, kinds] of OTHER) {
        setEngineText(lang, table);
        wordsOf(step).forEach((t, k) => {
          const e = english[k];
          if (!same(cellsIn(t), cellsIn(e)) || !same(sorted(digitsIn(t)), sorted(digitsIn(e)))) wrong.push(`${lang} ${at}: names other cells or digits than English: ${t}`);
          const u = houses[k];
          if (u !== undefined && !t.includes(`${kinds[Math.floor(u / 9)]} ${(u % 9) + 1}`)) wrong.push(`${lang} ${at}: names another house than English: ${t}`);
        });
        for (const f of linkFrames(step)) if (f.text.length > longest.text.length) longest = { lang, text: f.text };
        setEngineText('en', null);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    expect(finds.length).toBeGreaterThan(400);
    for (const tech of [...CHAINS, 'AIC_ALS' as Tech]) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(5);
    // the forms of sentence the finds cover: each kind of end, a box alone and a box beside a shared line, and the set links
    for (const shape of [
      'strong cell to cell, line',
      'strong cell to cell, box alone',
      'strong cell to cell, box, a line shared',
      'strong group to cell, line',
      'strong cell to group, line',
      'weak cell to cell, line',
      'weak cell to cell, box alone',
      'weak cell to group, box alone',
      'weak group to cell, box alone',
      'set to set',
      'into a set',
      'out of a set'
    ])
      expect([...shapes], shape).toContain(shape);
    // the longest frame a link makes, a loop's closing link with its closing words, is no longer than
    // frames the walks show already (an ALS-XY-Chain's clash ending runs to 365 characters in Spanish)
    expect(longest.text.length, `${longest.lang}: ${longest.text}`).toBeLessThan(360);
  });
});

describe("the chain trainer's links name their houses (M17)", () => {
  /** the stored example's chain built in the trainer one candidate at a time, at its position */
  function built(tech: Tech): { step: Step; g: Grid } {
    const ex = EXAMPLES[tech]!;
    const g = exampleGrid(ex);
    const links = ex.step.links!;
    let chain: Chain = EMPTY_CHAIN;
    for (const node of [links[0].from[0], ...links.map((l) => l.to[0])]) chain = extend(g, chain, node).chain;
    return { step: chainStep(g, chain), g };
  }
  const LINK = /\((strong link: they are the only (\d)s in|weak link: they see each other in|a strong link in) (row|column|box) (\d)(?:, used here as a weak one)?\)\.$/;

  it('a link between cells names the house that makes it; a link inside a cell keeps its words', () => {
    for (const tech of ['X_CHAIN', 'W_WING', 'XY_CHAIN', 'AIC', 'NICE_LOOP'] as Tech[]) {
      const { step, g } = built(tech);
      step.links!.forEach((link, i) => {
        const [a, b] = [link.from[0], link.to[0]];
        const text = link.text!;
        if (a.cell === b.cell) {
          expect(text, tech).toMatch(/\((strong link|weak link|a strong link, used here as a weak one)\)\.$/);
          return;
        }
        const m = LINK.exec(text);
        expect(m, `${tech}: ${text}`).not.toBeNull();
        const u = houseOf(m![3], m![4]);
        expect(UNITS[u].includes(a.cell) && UNITS[u].includes(b.cell), text).toBe(true);
        // a strong link (one used as a weak one too) in the house whose only places for the digit they are
        if (m![1] !== 'weak link: they see each other in') expect(sorted(places(g, u, a.digit)), text).toEqual(sorted([a.cell, b.cell]));
        expect(m![1].startsWith('strong'), text).toBe(i % 2 === 0);
        expect(u, text).toBe(linkHouse(g, [a.cell, b.cell], a.digit, m![1] !== 'weak link: they see each other in'));
      });
    }
  });

  it('in English, Norwegian and Spanish', () => {
    const texts = () => built('X_CHAIN').step.links!.slice(0, 2).map((l) => l.text);
    expect(texts()).toEqual([
      'If the 1 in r8c3 is false, the 1 in r8c6 is true (strong link: they are the only 1s in row 8).',
      'If the 1 in r8c6 is true, the 1 in r6c6 is false (weak link: they see each other in column 6).'
    ]);
    setEngineText('nb', engineNb);
    expect(texts()).toEqual([
      'Hvis 1-tallet i r8c3 er usant, er 1-tallet i r8c6 sant (sterk lenke: de er de eneste 1-erne i rad 8).',
      'Hvis 1-tallet i r8c6 er sant, er 1-tallet i r6c6 usant (svak lenke: de ser hverandre i kolonne 6).'
    ]);
    setEngineText('es', engineEs);
    expect(texts()).toEqual([
      'Si el 1 de r8c3 es falso, el 1 de r8c6 es verdadero (enlace fuerte: son los únicos 1 de la fila 8).',
      'Si el 1 de r8c6 es verdadero, el 1 de r6c6 es falso (enlace débil: se ven en la columna 6).'
    ]);
  });

  it('names the house a strong link used as a weak one is strong in', () => {
    // a chain whose weak link is a conjugate pair: found along a practice path
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    let seen = '';
    for (const { puzzle } of pools.slice(0, 120)) {
      const g = parseGrid(puzzle)!;
      for (let i = 0; i < 300 && !isSolved(g) && !seen; i++) {
        const s = findStep('X_CHAIN', g);
        if (s) {
          let chain: Chain = EMPTY_CHAIN;
          for (const node of [s.links![0].from[0], ...s.links!.map((l) => l.to[0])]) chain = extend(g, chain, node).chain;
          const k = chain.links.findIndex((kind, j) => j % 2 === 1 && kind === 'strong');
          if (k >= 0) {
            seen = chainStep(g, chain).links![k].text!;
            const [a, b] = [chain.nodes[k], chain.nodes[k + 1]];
            expect(seen).toBe(
              `If the ${a.digit} in ${cellName(a.cell)} is true, the ${b.digit} in ${cellName(b.cell)} is false (a strong link in ${unitName(linkHouse(g, [a.cell, b.cell], a.digit, true))}, used here as a weak one).`
            );
          }
        }
        const next = findNextStep(g);
        if (!next) break;
        applyStep(g, next);
      }
      if (seen) break;
    }
    expect(seen).not.toBe('');
  });
});
