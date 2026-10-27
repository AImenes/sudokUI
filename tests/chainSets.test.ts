/**
 * The sets in the data (docs/hint-drawing-sets.md, Data and "How it is
 * checked"): every group and almost locked set a step's links pass
 * through, or an ALS pattern is made of, is one of the step's sets
 * (Step.sets), and each link end names its own (fromSet, toSet). Held two
 * ways:
 * - src/engine/truth.ts checkSets on faults made by hand in the finders'
 *   own steps: each of its rules catches the fault it names;
 * - tests/chainSets.ts's rules (checkSets against the board's candidates,
 *   and the invariants beside it) over the stored examples, the set
 *   fixture's kept positions (every set step on offer along the hard
 *   paths, and the named positions, the ALS-XY-Chains whose sets share
 *   cells among them), every step on offer along the hard paths and a
 *   findAllSteps sample of generated puzzles.
 * The practice pools' and the seeds' solve paths, and the set techniques'
 * finds along them, are held to the same rules by tests/pathDigest.ts,
 * whose walk finds them anyway: walking them twice would take minutes more.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkSets } from '../src/engine/truth';
import type { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid, cloneGrid, isSolved, bit, popcount } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, findAllSteps, findStep, applyStep } from '../src/engine/humanSolver';
import type { Tech } from '../src/engine/ratings';
import { SET_TECHS, setProblems } from './chainSets';

const cd = (r: number, c: number, digit: number) => ({ cell: (r - 1) * 9 + (c - 1), digit });
/** a stored example's step, to break by hand */
const example = (tech: Tech): Step => JSON.parse(JSON.stringify(EXAMPLES[tech]!.step));
const candsOf = (tech: Tech) => EXAMPLES[tech]!.cands;

describe('checkSets', () => {
  it("passes the finders' steps: every stored example of the eight set techniques", () => {
    for (const tech of SET_TECHS) expect(checkSets(EXAMPLES[tech]!.step, candsOf(tech)), tech).toEqual([]);
  });

  it("catches a set of the wrong shape: an almost locked set short of a candidate or a digit, a group short of its digit's cells, a set its unit does not hold", () => {
    // ALS-XZ's set A (r8c2, r9c1) without r9c1's 9: its members are not every candidate of its cells
    const short = example('ALS_XZ');
    short.sets![0].members = short.sets![0].members.filter((m) => !(m.cell === cd(9, 1, 9).cell && m.digit === 9));
    expect(checkSets(short, candsOf('ALS_XZ'))).toEqual([{ link: 0, issue: 'shape', at: 'set A' }]);
    // set B with as many digits as cells
    const locked = example('ALS_XZ');
    locked.sets![1].digits = [1, 5];
    expect(checkSets(locked, candsOf('ALS_XZ'))).toEqual([{ link: 0, issue: 'shape', at: 'set B' }]);
    // Grouped X-Cycles' group 2r2c4, 2r3c4, with a 2 left in r1c4, of the same box and column
    const cands = [...candsOf('GROUPED_X_CYCLES')];
    cands[cd(1, 4, 2).cell] |= bit(2);
    expect(checkSets(EXAMPLES.GROUPED_X_CYCLES!.step, cands)).toEqual([{ link: 0, issue: 'shape', at: '2r2c4,2r3c4' }]);
    // AIC with ALS's set in row 1, which does not hold it
    const away = example('AIC_ALS');
    away.sets![0].unit = 0;
    expect(checkSets(away, candsOf('AIC_ALS'))).toEqual([{ link: 0, issue: 'shape', at: 'set A' }]);
  });

  it("catches a link end that is not its set's cells holding its digit", () => {
    // AIC with ALS: (8)r2c8 - (8)A, into r7c8 only of A's two 8s
    const step = example('AIC_ALS');
    step.links![1].to = [cd(7, 8, 8)];
    expect(checkSets(step, candsOf('AIC_ALS'))).toEqual([{ link: 2, issue: 'notMember', at: '8r2c8' }]);
  });

  it('catches a link inside a set that is weak or inside a group, and a strong link between two digits of different cells outside one set', () => {
    // AIC with ALS's (8=9)A, weak
    const weak = example('AIC_ALS');
    weak.links![2].strong = false;
    expect(checkSets(weak, candsOf('AIC_ALS'))).toEqual([{ link: 3, issue: 'internal', at: '8r7c8,8r8c8' }]);
    // the same link with no set at its ends
    const loose = example('AIC_ALS');
    delete loose.links![2].fromSet;
    delete loose.links![2].toSet;
    expect(checkSets(loose, candsOf('AIC_ALS'))).toEqual([{ link: 3, issue: 'internal', at: '8r7c8,8r8c8' }]);
    // Grouped X-Cycles: its group linked to itself
    const group = example('GROUPED_X_CYCLES');
    group.links![2] = { ...group.links![2], to: group.links![2].from, toSet: 0 };
    expect(checkSets(group, candsOf('GROUPED_X_CYCLES'))).toEqual([{ link: 3, issue: 'internal', at: '2r2c4,2r3c4' }]);
  });

  it('catches a restricted common some candidate of which does not see every candidate of its digit in the other set', () => {
    // ALS-XZ on 5 in place of 1: r8c2's 5 does not see r7c8's
    const step = example('ALS_XZ');
    step.links![0] = { ...step.links![0], from: [cd(8, 2, 5), cd(9, 1, 5)], to: [cd(7, 8, 5)] };
    expect(checkSets(step, candsOf('ALS_XZ'))).toEqual([{ link: 1, issue: 'notRestricted', at: '5r8c2,5r9c1' }]);
  });

  it('catches a removal that does not see every z of both end sets, or of every petal', () => {
    // ALS-XZ: r9c3 sees A's 5s, not B's in r7c8
    const xz = example('ALS_XZ');
    xz.eliminations.push(cd(9, 3, 5));
    expect(checkSets(xz, candsOf('ALS_XZ'))).toEqual([{ link: 0, issue: 'zNotSeen', at: '5r9c3' }]);
    // Death Blossom: r7c1 sees petal C's 4 in r8c1, not petal A's in r9c7
    const blossom = example('DEATH_BLOSSOM');
    blossom.eliminations.push(cd(7, 1, 4));
    expect(checkSets(blossom, candsOf('DEATH_BLOSSOM'))).toEqual([{ link: 0, issue: 'zNotSeen', at: '4r7c1' }]);
  });

  it("catches sets an ALS pattern keeps apart that share a cell, and lets an ALS-XY-Chain's sets that are not neighbours share cells", () => {
    // ALS-XZ whose set B is set A again: no restricted common either, as no cell sees itself
    const step = example('ALS_XZ');
    step.sets![1] = { ...step.sets![0], letter: 'B' };
    step.links![0].to = [cd(8, 2, 1)];
    expect(checkSets(step, candsOf('ALS_XZ'))).toEqual([
      { link: 1, issue: 'notRestricted', at: '1r8c2' },
      { link: 0, issue: 'overlap', at: 'set A set B' }
    ]);
    // the chain whose set A, the cell r7c7, lies inside its set D (r7c5, r7c7), as HoDoKu allows
    const { step: shared, cands } = kept('shared cells that derive, step 25, ALS_XY_CHAIN');
    expect(shared.sets!.map((s) => `${s.letter} ${s.cells}`)).toEqual(['A 60', 'B 15,17', 'C 40,44', 'D 58,60']);
    expect(checkSets(shared, cands)).toEqual([]);
  });

  it("catches letters out of the technique's convention", () => {
    // an ALS-XY-Wing whose hinge is lettered B: then its removal does not see every 7 of "set B" either
    const wing = example('ALS_XY_WING');
    [wing.sets![1].letter, wing.sets![2].letter] = ['C', 'B'];
    expect(checkSets(wing, candsOf('ALS_XY_WING'))).toEqual([
      { link: 0, issue: 'zNotSeen', at: '7r4c8' },
      { link: 0, issue: 'letters', at: 'A,C,B' }
    ]);
    // Death Blossom's petals lettered against the order of the stem's links to them
    const crossed = example('DEATH_BLOSSOM');
    crossed.sets!.reverse().forEach((s, i) => (s.letter = 'ABC'[i]));
    crossed.links!.forEach((l) => (l.toSet = 2 - l.toSet!));
    expect(checkSets(crossed, candsOf('DEATH_BLOSSOM'))).toEqual([{ link: 0, issue: 'letters', at: 'A,B,C' }]);
    // and petals and links both out of stem-digit order: A the 7's petal, C the 2's
    const backwards = example('DEATH_BLOSSOM');
    backwards.sets!.reverse().forEach((s, i) => (s.letter = 'ABC'[i]));
    backwards.links!.reverse().forEach((l, i) => (l.toSet = i));
    expect(checkSets(backwards, candsOf('DEATH_BLOSSOM'))).toEqual([{ link: 0, issue: 'letters', at: 'A,B,C' }]);
    // the Grouped Nice Loop pair's groups listed against the order the loop reaches them
    const { step: pair, cands } = kept('the Grouped Nice Loop pair, step 10, GROUPED_NICE_LOOP');
    expect(pair.sets!.map((s) => `${s.digits} ${s.cells}`)).toEqual(['9 8,17,26', '7 8,17,26']);
    expect(checkSets(pair, cands)).toEqual([]);
    pair.sets!.reverse();
    pair.links!.forEach((l) => {
      if (l.fromSet !== undefined) l.fromSet = 1 - l.fromSet;
      if (l.toSet !== undefined) l.toSet = 1 - l.toSet;
    });
    expect(checkSets(pair, cands)).toEqual([{ link: 0, issue: 'letters', at: 'group,group' }]);
    // a lettered group
    const group = example('AIC_GROUPED');
    group.sets![0].letter = 'A';
    expect(checkSets(group, candsOf('AIC_GROUPED'))).toEqual([{ link: 0, issue: 'letters', at: 'A' }]);
    // AIC with ALS's first set lettered B
    const als = example('AIC_ALS');
    als.sets![0].letter = 'B';
    expect(checkSets(als, candsOf('AIC_ALS'))).toEqual([{ link: 0, issue: 'letters', at: 'B' }]);
  });
});

/** a position the set fixture keeps: the puzzle, the board's digits and every cell's candidates */
interface Position {
  puzzle: string;
  values: string;
  cands: number[];
}
const SET_FIXTURE = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json'))) as Record<
  string,
  Record<string, { position: Position }>
>;

/** the step of an entry of the set fixture, found again at its kept position */
function kept(id: string): { step: Step; cands: number[] } {
  const { position } = SET_FIXTURE.paths[id] ?? SET_FIXTURE.named[id];
  const g = parseGrid(position.puzzle)!;
  for (let cell = 0; cell < 81; cell++) {
    g.values[cell] = Number(position.values[cell]);
    g.cands[cell] = position.cands[cell];
  }
  const step = findStep(id.split(', ').at(-1) as Tech, g)!;
  return { step, cands: position.cands };
}

/** how many steps of each set technique a corpus has, with sets */
const tally = (counts: Record<string, number>, step: Step) => {
  if (step.sets) counts[step.tech] = (counts[step.tech] ?? 0) + 1;
};

describe("the finders' sets keep their rules", () => {
  it('in every stored example: each set technique names its sets, and no other technique any', () => {
    const counts: Record<string, number> = {};
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      expect(setProblems(ex!.step, ex!.cands), tech).toEqual([]);
      tally(counts, ex!.step);
    }
    expect(Object.keys(counts).sort()).toEqual([...SET_TECHS].sort());
  });

  it("at the set fixture's positions: every set step on offer along the hard paths, and the named positions", () => {
    const counts: Record<string, number> = {};
    for (const id of [...Object.keys(SET_FIXTURE.paths), ...Object.keys(SET_FIXTURE.named)]) {
      const { step, cands } = kept(id);
      expect(step, id).toBeTruthy();
      expect(setProblems(step, cands), id).toEqual([]);
      tally(counts, step);
    }
    // every one with its sets: the chain whose only "set" is a bivalue cell is not among them
    expect(counts).toEqual({
      AIC_GROUPED: 11,
      AIC_ALS: 8,
      GROUPED_NICE_LOOP: 17,
      GROUPED_X_CYCLES: 17,
      ALS_XZ: 17,
      ALS_XY_WING: 15,
      ALS_XY_CHAIN: 20,
      DEATH_BLOSSOM: 9
    });
    // the chain that clashes: its set D (r4c4, r6c4) lies inside its set A (r1c4, r4c4, r5c4, r6c4)
    const { step } = kept('shared cells that clash, step 15, ALS_XY_CHAIN');
    expect(step.sets!.map((s) => `${s.letter} ${s.cells}`)).toEqual(['A 3,30,39,48', 'B 0', 'C 27,29', 'D 30,48']);
  });

  it('in an AIC with ALS whose only set is a bivalue cell: it keeps its name, and the cell is no set (decision 14)', () => {
    const g = parseGrid('4..1.27.......3..45.7.9...3..45..62..8.....4..25..43..7...4.9.12..3.......67.9..2')!;
    for (let i = 0; i < 10; i++) applyStep(g, findNextStep(g)!);
    const step = findStep('AIC_GROUPED', g)!;
    expect(step.tech).toBe('AIC_ALS');
    expect(step.description).toMatch(/^AIC with ALS: 3@r1c2 → 3@r1c3 → 8@r1c3 → 8@r2c1/);
    // the cell r2c4, holding only 8 and 6: a strong link with no set at either end
    const inCell = step.links!.filter((l) => l.strong && l.from[0].cell === l.to[0].cell);
    expect(inCell).toEqual([{ from: [cd(2, 4, 8)], to: [cd(2, 4, 6)], strong: true }]);
    expect(popcount(g.cands[cd(2, 4, 8).cell])).toBe(2);
    expect(step.sets).toBeUndefined();
    expect(step.links!.filter((l) => l.fromSet !== undefined || l.toSet !== undefined)).toEqual([]);
    expect(setProblems(step, g.cands)).toEqual([]);
  });

  it('in every step on offer along the hard paths, and in a sample of generated puzzles', () => {
    const HARD = [
      '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
      '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
      '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
      '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
      '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
      '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
    ];
    const puzzles: Grid[] = [...HARD.map((p) => parseGrid(p)!), ...Array.from({ length: 6 }, (_, i) => generatePuzzle(i % 2 ? 'rotational' : 'none'))];
    const counts: Record<string, number> = {};
    let steps = 0;
    for (const [pi, puzzle] of puzzles.entries()) {
      const g = cloneGrid(puzzle);
      for (let i = 0; i < 300 && !isSolved(g); i++) {
        const step = findNextStep(g);
        if (!step) break;
        if (!['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'].includes(step.tech)) {
          for (const s of findAllSteps(g)) {
            expect(setProblems(s, g.cands), `puzzle ${pi}, step ${i}, ${s.tech}`).toEqual([]);
            tally(counts, s);
            steps++;
          }
        }
        applyStep(g, step);
      }
    }
    // eslint-disable-next-line no-console
    console.info(`sets checked in ${steps} steps:`, Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(', '));
    for (const tech of SET_TECHS) expect(counts[tech], tech).toBeGreaterThan(0);
  }, 120_000);
});
