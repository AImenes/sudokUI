/**
 * The truth of a chain's nodes (src/engine/truth.ts; docs/hint-drawing.md,
 * "Truth: where it comes from"): what a hint draws as a true disc or a
 * false ring must be what the chain proves. Held three ways: the
 * derivation on chains built by hand in every shape (open, continuous,
 * discontinuous, inverted, broken, a true end left no candidate); every
 * stored example marked 'derived' derives without a problem; and every
 * 'derived' step met while solving a batch of puzzles does too, with each
 * open chain's removals in conflict with both its ends (checked here from
 * the board's houses, not by the finders' own code), its start false and
 * its end true, and every link true to the puzzle's solution: no strong
 * link without a true end, no weak link with two.
 *
 * The ALS patterns are chains too (docs/hint-drawing-sets.md, decisions 11
 * and 13): an ALS-XZ, ALS-XY-Wing or ALS-XY-Chain derives cleanly, but an
 * ALS-XY-Chain whose sets share a cell may clash, in a false set's node, a
 * true node left no candidate ('emptyTrue') or a loop back to its start,
 * and then draws no truth; both are counted. A Death Blossom claims no
 * truth until phase 5, but each of its branches derives from its two
 * links, and its removals conflict with every branch's end.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { alsClash, deriveLinks, deriveTruth } from '../src/engine/truth';
import { alternatingLinks, insideSet, CellDigit, ChainLink, ChainSet, Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, cloneGrid, isSolved, PEERS, UNITS, Grid, bit, popcount, sees } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, findAllSteps, findStep, applyStep } from '../src/engine/humanSolver';
import { findWWing } from '../src/engine/techniques/wings';
import { linkText, walkFrames } from '../src/engine/hintFrames';
import { frameMarks, premiseOf } from '../src/content/hintMarks';
import type { Tech } from '../src/engine/ratings';

const cd = (r: number, c: number, digit: number): CellDigit => ({ cell: (r - 1) * 9 + (c - 1), digit });
const k = (x: CellDigit) => `${x.cell}:${x.digit}`;

describe('the derivation', () => {
  it('reads an open chain: the start false, every strong link into a true node, every weak one into a false node', () => {
    const nodes = [[cd(5, 1, 2)], [cd(5, 7, 2)], [cd(7, 7, 2)], [cd(8, 9, 2)]];
    const d = deriveLinks(alternatingLinks(nodes));
    expect(d.problems).toEqual([]);
    expect(d.nodes.map((n) => n.truth)).toEqual([false, true, false, true]);
    expect(d.closure).toBeNull();
    expect(d.ends).toEqual([
      { from: false, to: true },
      { from: true, to: false },
      { from: false, to: true }
    ]);
  });

  it('reads a switch inside a cell like any other link', () => {
    // (8=6)r4c3 - (6=2)r4c7: 8 false, 6 true, 6 false, 2 true
    const d = deriveLinks(alternatingLinks([[cd(4, 3, 8)], [cd(4, 3, 6)], [cd(4, 7, 6)], [cd(4, 7, 2)]]));
    expect(d.problems).toEqual([]);
    expect([...d.candidates]).toEqual([
      ['29:8', 'false'],
      ['29:6', 'true'],
      ['33:6', 'false'],
      ['33:2', 'true']
    ]);
  });

  it('keeps a continuous loop in one world, and proves a discontinuous one the other way at its start', () => {
    const ring = [[cd(1, 1, 7)], [cd(1, 5, 7)], [cd(3, 5, 7)], [cd(3, 1, 7)]];
    const continuous = deriveLinks(alternatingLinks(ring, 'weak'));
    expect(continuous.problems).toEqual([]);
    expect(continuous.closure).toBeNull();
    const discontinuous = deriveLinks(alternatingLinks([...ring, [cd(3, 9, 7)]], 'strong'));
    expect(discontinuous.problems).toEqual([]);
    expect(discontinuous.closure).toEqual({ node: ring[0], assumed: false, proven: true });
    expect(discontinuous.candidates.get(k(cd(1, 1, 7)))).toBe('true');
  });

  it('assumes an inverted loop\'s start true, and proves it false', () => {
    // weak first: GROUPED_X_CYCLES rule 3
    const a = [cd(2, 2, 4), cd(2, 3, 4)];
    const links: ChainLink[] = [
      { from: a, to: [cd(2, 8, 4)], strong: false },
      { from: [cd(2, 8, 4)], to: [cd(6, 8, 4)], strong: true },
      { from: [cd(6, 8, 4)], to: [cd(6, 2, 4)], strong: false },
      { from: [cd(6, 2, 4)], to: a, strong: false }
    ];
    // the last weak link leaves a false node: a broken loop, reported
    expect(deriveLinks(links).problems.length).toBeGreaterThan(0);
    links[2] = { ...links[2], strong: false };
    links[3] = { from: [cd(6, 2, 4)], to: a, strong: false };
    const fixed: ChainLink[] = [
      { from: a, to: [cd(2, 8, 4)], strong: false },
      { from: [cd(2, 8, 4)], to: [cd(6, 8, 4)], strong: true },
      { from: [cd(6, 8, 4)], to: [cd(6, 3, 4)], strong: false },
      { from: [cd(6, 3, 4)], to: [cd(4, 3, 4)], strong: true },
      { from: [cd(4, 3, 4)], to: a, strong: false }
    ];
    const d = deriveLinks(fixed);
    expect(d.problems).toEqual([]);
    expect(d.closure).toEqual({ node: a, assumed: true, proven: false });
    // a false group: none of its members
    for (const m of a) expect(d.candidates.get(k(m))).toBe('false');
  });

  it('never calls a true group\'s members true, only "one of these"', () => {
    const g = [cd(5, 7, 8), cd(6, 7, 8)];
    const d = deriveLinks(alternatingLinks([[cd(5, 1, 8)], g, [cd(9, 7, 8)], [cd(9, 1, 8)]]));
    expect(d.problems).toEqual([]);
    for (const m of g) expect(d.candidates.get(k(m))).toBe('groupTrue');
  });

  it('reports a true node every candidate of which the chain makes false', () => {
    // a chain whose last set lies inside its first: the start, the first
    // set's 8s, is false, and the end, the last set's 8s, true, but every
    // one of them is one of the first set's (docs/hint-drawing-sets.md,
    // decision 13)
    const first = [cd(4, 4, 8), cd(5, 4, 8), cd(6, 4, 8)];
    const last = [cd(4, 4, 8), cd(6, 4, 8)];
    const chain = (end: CellDigit[]): ChainLink[] => [
      { from: first, to: [cd(2, 4, 6)], strong: true },
      { from: [cd(2, 4, 6)], to: [cd(5, 4, 6)], strong: false },
      { from: [cd(5, 4, 6)], to: end, strong: true }
    ];
    const d = deriveLinks(chain(last));
    expect(d.problems).toEqual([{ link: 0, issue: 'emptyTrue', at: '8r4c4,8r6c4' }]);
    for (const m of last) expect(d.candidates.get(k(m))).toBe('false');
    // one candidate the chain leaves it is enough
    const kept = deriveLinks(chain([cd(4, 4, 8), cd(7, 4, 8)]));
    expect(kept.problems).toEqual([]);
    expect(kept.candidates.get(k(cd(7, 4, 8)))).toBe('groupTrue');
  });

  it('reports a chain that does not alternate, or jumps', () => {
    // two strong links in a row: the second leaves a node the first made true
    expect(deriveLinks([
      { from: [cd(1, 1, 3)], to: [cd(1, 5, 3)], strong: true },
      { from: [cd(1, 5, 3)], to: [cd(4, 5, 3)], strong: true }
    ]).problems).toEqual([{ link: 2, issue: 'wrongTruth', at: '3r1c5' }]);
    // a link that leaves a node the chain never reached
    expect(deriveLinks([
      { from: [cd(1, 1, 3)], to: [cd(1, 5, 3)], strong: true },
      { from: [cd(9, 9, 3)], to: [cd(4, 5, 3)], strong: false }
    ]).problems).toEqual([{ link: 2, issue: 'unreached', at: '3r9c9' }]);
    // a node made true and later false by valid links, short of closing a
    // loop at its start
    expect(deriveLinks([
      { from: [cd(1, 1, 3)], to: [cd(1, 5, 3)], strong: true },
      { from: [cd(1, 5, 3)], to: [cd(4, 5, 3)], strong: false },
      { from: [cd(4, 5, 3)], to: [cd(4, 9, 3)], strong: true },
      { from: [cd(4, 9, 3)], to: [cd(1, 5, 3)], strong: false }
    ]).problems).toEqual([{ link: 4, issue: 'twoTruths', at: '3r1c5' }]);
  });

  it('derives nothing for a step that is not a derived chain', () => {
    expect(deriveTruth({ tech: 'X_WING', placements: [], eliminations: [], description: '' } as Step)).toBeNull();
  });
});

/** a candidate `e` conflicts with a node when it cannot be true if the node is: every member is in e's cell with another digit, or holds e's digit in a peer */
function conflicts(e: CellDigit, node: CellDigit[]): boolean {
  return node.every((m) => (m.cell === e.cell ? m.digit !== e.digit : m.digit === e.digit && PEERS[e.cell].includes(m.cell)));
}

/** the chains whose links run from one end to the other, unclosed: the ALS patterns among them (docs/hint-drawing-sets.md, decision 11) */
const OPEN: Tech[] = [
  'X_CHAIN',
  'XY_CHAIN',
  'AIC',
  'AIC_GROUPED',
  'AIC_ALS',
  'SKYSCRAPER',
  'TWO_STRING_KITE',
  'TURBOT_FISH',
  'W_WING',
  'ALS_XZ',
  'ALS_XY_WING',
  'ALS_XY_CHAIN'
];

/**
 * What is wrong with a link on the board it was found on, if anything,
 * checked from the board's houses and not by the finders' own code: a weak
 * link joins two candidates of one cell, or two nodes of one digit whose
 * every member sees every member of the other; a strong link is the two
 * candidates of a bivalue cell, two nodes holding all of one house's
 * candidates for their digit, or two digits of one almost locked set, each
 * node all the set's cells that hold its digit: a set the step names
 * (Step.sets, an ALS pattern's or an AIC with ALS's), or one an AIC with
 * ALS's link lies in
 */
function linkProblem(g: Grid, l: ChainLink, step: Step): string | null {
  const cells = (n: CellDigit[]) => [...new Set(n.map((m) => m.cell))];
  const digits = (n: CellDigit[]) => [...new Set(n.map((m) => m.digit))];
  if (digits(l.from).length !== 1 || digits(l.to).length !== 1) return 'a node of more than one digit';
  const [fd, td] = [digits(l.from)[0], digits(l.to)[0]];
  const [fc, tc] = [cells(l.from), cells(l.to)];
  for (const m of [...l.from, ...l.to]) if (g.values[m.cell] || !(g.cands[m.cell] & bit(m.digit))) return `${k(m)} is not a candidate`;
  if (fd === td) {
    if (fc.some((c) => tc.includes(c))) return 'two nodes sharing a cell';
    if (!l.strong) return fc.every((a) => tc.every((b) => sees(a, b))) ? null : 'a weak link between cells that do not see each other';
    const both = [...fc, ...tc].sort((a, b) => a - b);
    const conjugate = UNITS.some((u) => {
      const holding = u.filter((c) => !g.values[c] && g.cands[c] & bit(fd));
      return holding.length === both.length && holding.every((c) => both.includes(c));
    });
    return conjugate ? null : 'a strong link that is not all of a house';
  }
  if (fc.length === 1 && tc.length === 1 && fc[0] === tc[0]) {
    if (!l.strong || popcount(g.cands[fc[0]]) === 2) return null;
  }
  if (!l.strong) return 'a weak link between two digits outside one cell';
  // a link inside a set the step names: an almost locked set on the board, each end all its cells that hold the end's digit
  const named: ChainSet | undefined = insideSet(l) ? step.sets?.[l.fromSet!] : undefined;
  if (named) {
    const cells = named.cells;
    const mask = cells.reduce((m, c) => m | g.cands[c], 0);
    const house = UNITS.some((u) => cells.every((c) => u.includes(c)));
    const holding = (d: number) => cells.filter((c) => g.cands[c] & bit(d)).join();
    const ok = named.kind === 'als' && house && cells.every((c) => !g.values[c]) && popcount(mask) === cells.length + 1;
    return ok && holding(fd) === [...fc].sort((a, b) => a - b).join() && holding(td) === [...tc].sort((a, b) => a - b).join()
      ? null
      : 'a strong link inside a set that is no almost locked set, or not all its cells holding a digit';
  }
  if (step.tech !== 'AIC_ALS') return 'a strong link between two digits that is not a bivalue cell';
  // an almost locked set in one house: as many cells as digits less one,
  // each node all of its cells that hold the node's digit
  const own = [...new Set([...fc, ...tc])];
  for (const u of UNITS) {
    if (!own.every((c) => u.includes(c))) continue;
    const rest = u.filter((c) => !g.values[c] && !own.includes(c));
    for (let pick = 0; pick < 1 << rest.length; pick++) {
      const set = [...own, ...rest.filter((_, i) => pick & (1 << i))];
      let mask = 0;
      for (const c of set) mask |= g.cands[c];
      if (popcount(mask) !== set.length + 1) continue;
      const holding = (d: number) => set.filter((c) => g.cands[c] & bit(d)).sort((a, b) => a - b).join();
      if (holding(fd) === [...fc].sort((a, b) => a - b).join() && holding(td) === [...tc].sort((a, b) => a - b).join()) return null;
    }
  }
  return 'a strong link between two digits that is no bivalue cell and no almost locked set';
}

/** every link of a chain is one the board has, and its sentence in the walk says what it is */
function checkLinks(g: Grid, step: Step, where: string): void {
  (step.links ?? []).forEach((l, i) => {
    if (l.undirected) return;
    expect(linkProblem(g, l, step), `${where}, link ${i + 1}`).toBeNull();
    // "the cell has only these two" only of a bivalue cell (an almost
    // locked set's two digits in one of its cells say so in their own words)
    const cell = l.from[0].cell;
    const text = linkText(l, step);
    if (text.includes('the cell has only these two')) expect(popcount(g.cands[cell]), `${where}, link ${i + 1}: ${text}`).toBe(2);
    // a group holds its digit in one of its cells at most: never "r5c7, r6c7 must be 2"
    // (a link into or out of an almost locked set is told as the set's, tests/setWords.test.ts)
    const many = (n: CellDigit[]) => new Set(n.map((m) => m.cell)).size > 1;
    const als = (k: number | undefined) => k !== undefined && step.sets?.[k]?.kind === 'als';
    if (!l.text && l.from[0].digit === l.to[0].digit && !als(l.fromSet) && !als(l.toSet)) {
      if (many(l.to)) expect(text, `${where}, link ${i + 1}`).toMatch(l.strong ? /one of .* must be/ : /none of .* can be/);
      if (many(l.from)) expect(text, `${where}, link ${i + 1}`).toMatch(l.strong ? /if none of/ : /if one of/);
    }
  });
}

/** how each ALS pattern's chain derives, by technique: cleanly, or with a clash and no truth drawn */
type Tally = Record<string, { clean: number; clash: number }>;

/**
 * An ALS pattern's chain that clashes (decision 13): only an ALS-XY-Chain
 * whose sets share a cell, and it draws no truth in any view, nor words a
 * premise
 */
function checkClash(step: Step, where: string, g?: Grid): void {
  const sets = step.sets ?? [];
  expect(step.tech, where).toBe('ALS_XY_CHAIN');
  expect(sets.some((a, i) => sets.slice(i + 1).some((b) => a.cells.some((c) => b.cells.includes(c)))), `${where}: sets sharing a cell`).toBe(true);
  for (const f of [null, ...walkFrames(step)]) {
    const kinds = [...frameMarks(step, f, (c) => !!g?.values[c]).cands.values()].flatMap((m) => [...m.values()]);
    expect(kinds.filter((k) => k === 'true' || k === 'false' || k === 'oneOf'), `${where}, frame ${f?.links ?? 'full'}`).toEqual([]);
  }
  expect(premiseOf(step), where).toBeNull();
}

/** what every derived step must satisfy; an ALS pattern's chain counted in `tally`, cleanly derived or clashing */
function checkDerived(step: Step, where: string, g?: Grid, tally?: Tally): void {
  const d = deriveTruth(step)!;
  expect(d, where).not.toBeNull();
  if (g) checkLinks(g, step, where);
  const count = (k: 'clean' | 'clash') => tally && ((tally[step.tech] ??= { clean: 0, clash: 0 })[k] += 1);
  if (alsClash(step)) {
    checkClash(step, where, g);
    count('clash');
    return;
  }
  expect(d.problems, where).toEqual([]);
  if (['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN'].includes(step.tech)) {
    expect(d.closure, where).toBeNull();
    count('clean');
  }
  if (!OPEN.includes(step.tech)) return;
  // its ends: the first link's first node and the last link's second, which
  // may be a node the chain reached before (an ALS-XY-Chain whose last set
  // holds z only in a cell of an earlier set, where that set's node is)
  const links = step.links!.filter((l) => !l.undirected);
  const first = { node: links[0].from, truth: d.nodes[0].truth };
  const last = { node: links[links.length - 1].to, truth: d.ends[d.ends.length - 1].to };
  expect(first.truth, where).toBe(false);
  expect(last.truth, where).toBe(true);
  for (const e of step.eliminations) {
    expect(conflicts(e, first.node) && conflicts(e, last.node), `${where}: ${k(e)} must conflict with both ends`).toBe(true);
  }
}

/**
 * A Death Blossom's branches (decision 15): for each stem digit, a weak tie
 * from the stem into its petal and the petal's lock, which derive from the
 * stem's digit true to the petal's z true ('groupTrue' over several cells),
 * every removal in conflict with that end; and no truth drawn in any view
 */
function checkBlossom(step: Step, where: string, g?: Grid): number {
  const links = step.links ?? [];
  expect(step.truth, where).toBeUndefined();
  const ties = links.flatMap((l, i) => (l.undirected && !l.strong ? [i] : []));
  expect(ties.length, where).toBe(step.sets!.length);
  const z = step.eliminations[0].digit;
  for (const i of ties) {
    const [tie, lock] = [links[i], links[i + 1]];
    expect([tie.fromSet, tie.toSet, lock.fromSet, lock.toSet, lock.strong], `${where}, branch ${i / 2 + 1}`).toEqual([undefined, i / 2, i / 2, i / 2, true]);
    const d = deriveLinks([tie, lock]);
    expect(d.problems, where).toEqual([]);
    expect(d.nodes.map((n) => n.truth), where).toEqual([true, false, true]);
    const end = d.nodes[2].node;
    expect(new Set(end.map((cd) => cd.digit)), where).toEqual(new Set([z]));
    for (const cd of end) expect(d.candidates.get(k(cd)), where).toBe(end.length > 1 ? 'groupTrue' : 'true');
    for (const e of step.eliminations) expect(conflicts(e, end), `${where}: ${k(e)} must conflict with branch ${i / 2 + 1}'s end`).toBe(true);
  }
  for (const f of [null, ...walkFrames(step)]) {
    const kinds = [...frameMarks(step, f, (c) => !!g?.values[c]).cands.values()].flatMap((m) => [...m.values()]);
    expect(kinds.filter((x) => x === 'true' || x === 'false' || x === 'oneOf'), `${where}, frame ${f?.links ?? 'full'}`).toEqual([]);
  }
  return ties.length;
}

/** every link of a chain true to the puzzle's solution: a node is true where one of its candidates is the solution's digit */
function checkSolution(step: Step, solution: Grid, where: string): void {
  const holds = (node: CellDigit[]) => node.some((cd) => solution.values[cd.cell] === cd.digit);
  (step.links ?? []).forEach((l, i) => {
    if (l.undirected) return;
    if (l.strong) expect(holds(l.from) || holds(l.to), `${where}, link ${i + 1}: a strong link with no true end`).toBe(true);
    else expect(holds(l.from) && holds(l.to), `${where}, link ${i + 1}: a weak link with two true ends`).toBe(false);
  });
}

/** a position the set fixture keeps, and the step found again there */
function keptSteps(): { where: string; step: Step; g: Grid }[] {
  const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
  const out: { where: string; step: Step; g: Grid }[] = [];
  for (const section of ['paths', 'named']) {
    for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
      const g = parseGrid(d.position.puzzle)!;
      for (let cell = 0; cell < 81; cell++) {
        g.values[cell] = Number(d.position.values[cell]);
        g.cands[cell] = d.position.cands[cell];
      }
      const step = findStep(id.split(', ').at(-1) as Tech, g);
      if (step) out.push({ where: id, step, g });
    }
  }
  return out;
}

describe('every chain the engine finds', () => {
  it('derives without a problem in every stored example', () => {
    let n = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      if (ex?.step.truth !== 'derived') continue;
      const g: Grid = { values: Uint8Array.from(ex.values, Number), cands: Uint16Array.from(ex.cands), given: new Uint8Array(81) };
      checkDerived(ex.step, tech, g);
      n++;
    }
    // the fifteen derived techniques with a stored example (X_CYCLES has none), the three ALS patterns among them
    expect(n).toBe(15);
  });

  it('derives without a problem in every chain step met while solving a batch of puzzles', () => {
    const HARD = [
      '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
      '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
      '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
      '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
      '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
      '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
    ];
    const puzzles = [...HARD.map((p) => parseGrid(p)!), ...Array.from({ length: 24 }, (_, i) => generatePuzzle(i % 2 ? 'rotational' : 'none'))];
    const seen = new Map<string, number>();
    const tally: Tally = {};
    let branches = 0;
    for (const [pi, puzzle] of puzzles.entries()) {
      const g = cloneGrid(puzzle);
      const solution = solve(cloneGrid(puzzle))!;
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        const step = findNextStep(g);
        if (!step) break;
        // where the solver needs more than a single, look at every step on offer
        if (!['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(step.tech)) {
          for (const s of findAllSteps(g)) {
            const where = `puzzle ${pi}, step ${i}, ${s.tech}`;
            if (s.tech === 'DEATH_BLOSSOM') branches += checkBlossom(s, where, g);
            if (s.truth !== 'derived') continue;
            checkDerived(s, where, g, tally);
            checkSolution(s, solution, where);
            seen.set(s.tech, (seen.get(s.tech) ?? 0) + 1);
          }
        }
        applyStep(g, step);
      }
    }
    // eslint-disable-next-line no-console
    console.info('derived chains checked:', [...seen].map(([t, n]) => `${t} ${n}`).join(', '), '; the ALS patterns:', JSON.stringify(tally), `; ${branches} Death Blossom branches`);
    expect(seen.size).toBeGreaterThanOrEqual(6);
    // the six hard paths alone offer each ALS pattern, and Death Blossoms
    for (const tech of ['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN']) expect(tally[tech]?.clean, tech).toBeGreaterThan(0);
    expect(branches).toBeGreaterThan(0);
  });

  it('reads each ALS pattern the repository keeps as a chain that derives cleanly, or, an ALS-XY-Chain whose sets share a cell, clashes and draws no truth: both counted (decision 13)', () => {
    const tally: Tally = {};
    const steps = [
      ...(['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN'] as Tech[]).map((tech) => {
        const ex = EXAMPLES[tech]!;
        return { where: tech, step: ex.step, g: { values: Uint8Array.from(ex.values, Number), cands: Uint16Array.from(ex.cands), given: new Uint8Array(81) } as Grid };
      }),
      ...keptSteps()
    ];
    for (const { where, step, g } of steps) if (['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN'].includes(step.tech)) checkDerived(step, where, g, tally);
    // the examples, the hard paths' offers and the named positions: only
    // ALS-XY-Chains clash, 9 of the 21, the named clashes in a false group,
    // that close and that leave a true end no candidate among them
    expect(tally).toEqual({
      ALS_XZ: { clean: 18, clash: 0 },
      ALS_XY_WING: { clean: 16, clash: 0 },
      ALS_XY_CHAIN: { clean: 12, clash: 9 }
    });
    for (const name of ['shared cells that clash, step 15', 'a clash in a false group, step 29', 'a clash that closes, step 16']) {
      const { step } = steps.find((x) => x.where.startsWith(name))!;
      expect(alsClash(step), name).toBe(true);
    }
    const derives = steps.find((x) => x.where.startsWith('shared cells that derive'))!.step;
    expect([alsClash(derives), deriveTruth(derives)!.problems]).toEqual([false, []]);
    const issues = (name: string) => {
      const d = deriveTruth(steps.find((x) => x.where.startsWith(name))!.step)!;
      return [d.problems.map((p) => p.issue), !!d.closure];
    };
    expect(issues('shared cells that clash')).toEqual([['emptyTrue'], false]);
    expect(issues('a clash in a false group')).toEqual([['inFalseGroup'], false]);
    expect(issues('a clash that closes')).toEqual([[], true]);
  });

  it("derives each Death Blossom's branch from the stem's digit to its petal's z, every removal in conflict with each branch's end (decision 15)", () => {
    let branches = 0;
    const ex = EXAMPLES.DEATH_BLOSSOM!;
    branches += checkBlossom(ex.step, 'DEATH_BLOSSOM', { values: Uint8Array.from(ex.values, Number), cands: Uint16Array.from(ex.cands), given: new Uint8Array(81) } as Grid);
    for (const { where, step, g } of keptSteps()) if (step.tech === 'DEATH_BLOSSOM') branches += checkBlossom(step, where, g);
    // the stored example's three, and the set fixture's nine Death Blossoms' eighteen
    expect(branches).toBe(21);
  });

  it("joins a W-Wing's weak links between cells that see each other", () => {
    // positions where one end of the strong link sees both bivalue cells,
    // and only the other end sees the second: the link order once went by
    // the first end alone, and joined two cells that do not see each other
    // (24 and 31 steps in, as "What's in this position?" finds them)
    const PUZZLES = [
      '3....681..8......6.....8.5.......27...4.....5.57..1..91....4...9.6....3.7...9..62',
      '..5......1.2..5....6.3...1...1.893.6.7..6..21.....3.8.8.....4...576........7.....'
    ];
    let wings = 0;
    for (const [pi, p] of PUZZLES.entries()) {
      const g = parseGrid(p)!;
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        const w = findWWing(g);
        if (w) {
          checkDerived(w, `puzzle ${pi}, step ${i}, W_WING`, g);
          wings++;
        }
        const step = findNextStep(g);
        if (!step) break;
        applyStep(g, step);
      }
    }
    expect(wings).toBeGreaterThan(1);
  });
});

describe('a true node of several candidates one of which a node of one candidate makes true (phase 4 review round 1)', () => {
  it("calls that one true and the node's others, which see it, false, never \"one of these\"", () => {
    // the set fixture's hard 1, step 19: (5=7)r9c6 - (7=5)r4c6 - (5=7){r4c1379} - (7=5){r234c6}.
    // B, the cell r4c6, makes 5r4c6 true, and D's 5s, r2c6, r3c6, r4c6, are a true node
    const D = [cd(2, 6, 5), cd(3, 6, 5), cd(4, 6, 5)];
    const C7 = [cd(4, 1, 7), cd(4, 7, 7), cd(4, 9, 7)];
    const d = deriveLinks(alternatingLinks([[cd(9, 6, 5)], [cd(9, 6, 7)], [cd(4, 6, 7)], [cd(4, 6, 5)], [cd(4, 3, 5), cd(4, 7, 5)], C7, [cd(4, 6, 7)], D]));
    expect(d.problems).toEqual([]);
    expect(D.map((m) => d.candidates.get(k(m)))).toEqual(['false', 'false', 'true']);
    // a true node with no member made true keeps its squares
    expect(C7.map((m) => d.candidates.get(k(m)))).toEqual(['groupTrue', 'groupTrue', 'groupTrue']);
  });

  it('turns a member an earlier true node made "one of these" false where a later one settles it, and keeps the earlier node\'s others', () => {
    // X, 8r1c3 or 8r1c4, is true first; 8r2c6 is made true later; Y, 8r1c4 or
    // 8r2c6 (box 2), is true at the end: 8r1c4 sees 8r2c6, 8r1c3 does not
    const X = [cd(1, 3, 8), cd(1, 4, 8)];
    const Y = [cd(1, 4, 8), cd(2, 6, 8)];
    const d = deriveLinks(alternatingLinks([[cd(1, 3, 5)], X, [cd(7, 3, 8)], [cd(2, 6, 8)], [cd(2, 6, 9)], Y]));
    expect(d.problems).toEqual([]);
    expect([...X, cd(2, 6, 8)].map((m) => d.candidates.get(k(m)))).toEqual(['groupTrue', 'false', 'true']);
  });

  it('leaves no true node of several candidates with a true candidate beside "one of these" in any derived step the repository keeps, every such node one digit in one house', () => {
    let nodes = 0;
    let settled = 0;
    const steps = [
      ...Object.entries(EXAMPLES).flatMap(([tech, ex]) => (ex?.step.truth === 'derived' ? [{ where: tech, step: ex.step }] : [])),
      ...keptSteps().filter(({ step }) => step.truth === 'derived')
    ];
    for (const { where, step } of steps) {
      const d = deriveTruth(step)!;
      for (const { node, truth } of d.nodes) {
        if (node.length < 2) continue;
        nodes++;
        // one digit in one house, so a member made true sees every other
        expect(new Set(node.map((m) => m.digit)).size, where).toBe(1);
        expect(UNITS.some((u) => node.every((m) => u.includes(m.cell))), `${where}: ${node.map(k)}`).toBe(true);
        if (!truth) continue;
        const kinds = node.map((m) => d.candidates.get(k(m)));
        if (kinds.includes('true')) settled++;
        expect(kinds.includes('true') && kinds.includes('groupTrue'), `${where}: ${node.map(k)} ${kinds}`).toBe(false);
      }
    }
    expect(nodes).toBeGreaterThan(200);
    // three ALS-XY-Chains on the hard paths, hard 1, step 19's D among them
    expect(settled).toBeGreaterThanOrEqual(3);
  });
});
