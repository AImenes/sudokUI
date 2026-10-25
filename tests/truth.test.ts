/**
 * The truth of a chain's nodes (src/engine/truth.ts; docs/hint-drawing.md,
 * "Truth: where it comes from"): what a hint draws as a true disc or a
 * false ring must be what the chain proves. Held three ways: the
 * derivation on chains built by hand in every shape (open, continuous,
 * discontinuous, inverted, broken); every stored example marked 'derived'
 * derives without a problem; and every 'derived' step met while solving a
 * batch of puzzles does too, with each open chain's removals in conflict
 * with both its ends (checked here from the board's houses, not by the
 * finders' own code), its start false and its end true.
 */
import { describe, it, expect } from 'vitest';
import { deriveLinks, deriveTruth } from '../src/engine/truth';
import { alternatingLinks, CellDigit, ChainLink, Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, cloneGrid, isSolved, PEERS } from '../src/engine/board';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, findAllSteps, applyStep } from '../src/engine/humanSolver';
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

/** the chains whose links run from one end to the other, unclosed */
const OPEN: Tech[] = ['X_CHAIN', 'XY_CHAIN', 'AIC', 'AIC_GROUPED', 'AIC_ALS', 'SKYSCRAPER', 'TWO_STRING_KITE', 'TURBOT_FISH', 'W_WING'];

/** what every derived step must satisfy */
function checkDerived(step: Step, where: string): void {
  const d = deriveTruth(step)!;
  expect(d, where).not.toBeNull();
  expect(d.problems, where).toEqual([]);
  if (!OPEN.includes(step.tech)) return;
  const first = d.nodes[0];
  const last = d.nodes[d.nodes.length - 1];
  expect(first.truth, where).toBe(false);
  expect(last.truth, where).toBe(true);
  for (const e of step.eliminations) {
    expect(conflicts(e, first.node) && conflicts(e, last.node), `${where}: ${k(e)} must conflict with both ends`).toBe(true);
  }
}

describe('every chain the engine finds', () => {
  it('derives without a problem in every stored example', () => {
    let n = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      if (ex?.step.truth !== 'derived') continue;
      checkDerived(ex.step, tech);
      n++;
    }
    // the twelve derived techniques with a stored example (X_CYCLES has none)
    expect(n).toBe(12);
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
    for (const [pi, puzzle] of puzzles.entries()) {
      const g = cloneGrid(puzzle);
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        const step = findNextStep(g);
        if (!step) break;
        // where the solver needs more than a single, look at every step on offer
        if (!['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(step.tech)) {
          for (const s of findAllSteps(g)) {
            if (s.truth !== 'derived') continue;
            checkDerived(s, `puzzle ${pi}, step ${i}, ${s.tech}`);
            seen.set(s.tech, (seen.get(s.tech) ?? 0) + 1);
          }
        }
        applyStep(g, step);
      }
    }
    // eslint-disable-next-line no-console
    console.info('derived chains checked:', [...seen].map(([t, n]) => `${t} ${n}`).join(', '));
    expect(seen.size).toBeGreaterThanOrEqual(6);
  });
});
