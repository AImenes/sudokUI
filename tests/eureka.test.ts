/**
 * Steps as the forums write them (src/content/eureka.ts): chains in Eureka
 * notation, everything else as a HoDoKu line, held to the worked examples
 * character by character. Groups and almost locked sets are read from the
 * step's own sets (Step.sets, docs/hint-drawing-sets.md, decision 19).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { eurekaOf, stepText, hodokuLine, compactCells, conclusions } from '../src/content/eureka';
import { EXAMPLES } from '../src/content/examples';
import { alternatingLinks, insideSet } from '../src/engine/steps';
import type { Step, ChainLink, CellDigit } from '../src/engine/steps';
import { TECHS, Tech } from '../src/engine/ratings';
import { cellName, parseGrid } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, findStep, applyStep } from '../src/engine/humanSolver';

const step = (tech: Tech): Step => EXAMPLES[tech]!.step as Step;

/** a puzzle's position after its first `n` solve-path steps */
function onPath(puzzle: string, n: number): Grid {
  const g = parseGrid(puzzle)!;
  for (let i = 0; i < n; i++) applyStep(g, findNextStep(g)!);
  return g;
}

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
function kept(id: string): Step {
  const { position } = SET_FIXTURE.paths[id] ?? SET_FIXTURE.named[id];
  const g = parseGrid(position.puzzle)!;
  for (let cell = 0; cell < 81; cell++) {
    g.values[cell] = Number(position.values[cell]);
    g.cands[cell] = position.cands[cell];
  }
  return findStep(id.split(', ').at(-1) as Tech, g)!;
}

/**
 * The derived chain an ALS-XZ, ALS-XY-Wing or ALS-XY-Chain is
 * (docs/hint-drawing-sets.md, Data), built from the step's own sets and
 * restricted commons: (z)A=(x)A - (x)B=(z)B and its longer forms, each set's
 * internal strong link from the digit the chain enters it by to the one it
 * leaves by, both ends naming the set
 */
function asChain(pattern: Step): Step {
  const rcs = pattern.links!;
  const order = [rcs[0].fromSet!, ...rcs.map((l) => l.toSet!)];
  const z = pattern.eliminations[0].digit;
  const by = [z, ...rcs.map((l) => l.from[0].digit), z];
  const node = (set: number, digit: number): CellDigit[] => pattern.sets![set].members.filter((m) => m.digit === digit);
  const links: ChainLink[] = [];
  order.forEach((set, i) => {
    if (i > 0) links.push({ from: node(order[i - 1], by[i]), to: node(set, by[i]), strong: false, fromSet: order[i - 1], toSet: set });
    links.push({ from: node(set, by[i]), to: node(set, by[i + 1]), strong: true, fromSet: set, toSet: set });
  });
  return { ...pattern, links, truth: 'derived' };
}

describe('Eureka notation', () => {
  it('writes an XY-Chain as bivalue cells with the strong link inside each', () => {
    expect(stepText(step('XY_CHAIN'))).toBe('XY-Chain: (4=3)r1c6 - (3=1)r5c6 - (1=6)r5c7 - (6=4)r2c7 => r1c9<>4');
  });

  it('writes an AIC with the links inside a cell and the links between cells apart', () => {
    expect(stepText(step('AIC'))).toBe('Alternating Inference Chain: (8=4)r1c6 - (4=2)r5c6 - (2)r5c9 = (2)r1c9 => r1c9<>8');
  });

  it('writes a continuous Nice Loop with a weak link inside a cell, closing on "loop"', () => {
    expect(stepText(step('NICE_LOOP'))).toBe(
      'Nice Loop: (3=4)r1c4 - (4)r6c4 = (4-3)r6c5 = (3)r2c5 - loop => r3c4<>4, r8c4<>4, r6c5<>2, r2c4<>3, r2c6<>3'
    );
    expect(stepText(step('GROUPED_NICE_LOOP'))).toBe(
      'Grouped Nice Loop: (7)r5c9 = (7)r7c9 - (7=8)r7c7 - (8)r56c7 = (8)r5c9 - loop => r9c7<>8, r5c9<>1'
    );
    expect(stepText(step('GROUPED_X_CYCLES'))).toBe(
      'Grouped X-Cycles: (2)r1c1 = (2)r1c6 - (2)r23c4 = (2)r4c4 - (2)r4c3 = (2)r2c3 - loop => r3c6<>2, r4c1<>2, r3c1<>2'
    );
  });

  it('writes a group as r3c23 and an almost locked set as its own node, in braces over all its cells', () => {
    expect(stepText(step('AIC_GROUPED'))).toBe('AIC with Groups: (6=2)r1c1 - (2)r3c23 = (2)r3c6 - (2=6)r4c6 => r4c1<>6');
    expect(stepText(step('AIC_ALS'))).toBe('AIC with ALSs: (8)r2c9 = (8)r2c8 - (8=9){r78c8} - (9)r6c8 = (9)r6c9 => r6c9<>8');
    // set A (r7c1, r8c1, r8c2) entered by its 3, in r8c2, and left by its
    // 8s, in r7c1 and r8c1: once '(3)r8c2 = (8)r78c1', a strong link between
    // two digits of different cells, unbraced
    const hop = findNextStep(onPath('......4...5...9.3.2.93...7..8.9....136...8..44...6.78......2.53..65....752....9..', 28))!;
    expect(hop.tech).toBe('AIC_ALS');
    expect(stepText(hop)).toBe(
      'AIC with ALSs: (6)r1c1 = (6)r1c6 - (6=1)r3c6 - (1)r123c5 = (1-3)r9c5 = (3)r9c3 - (3=8){r7c1,r8c12} => r1c1<>8'
    );
    // a chain whose only "set" is a bivalue cell, r2c4: the cell it is, no braces (decision 14)
    const bivalue = findStep('AIC_GROUPED', onPath('4..1.27.......3..45.7.9...3..45..62..8.....4..25..43..7...4.9.12..3.......67.9..2', 10))!;
    expect(bivalue.tech).toBe('AIC_ALS');
    expect(stepText(bivalue)).toBe(
      'AIC with ALSs: (3)r1c2 = (3-8)r1c3 = (8)r2c1 - (8=6)r2c4 - (6)r5c4 = (6-3)r5c1 = (3)r9c1 => r7c2<>3, r9c2<>3'
    );
  });

  it('writes a chain through almost locked sets with each set one node, its internal link inside it, over all its cells', () => {
    // the three ALS patterns' examples as the chains they are; a one-cell set, the XY-Wing's hinge C, plainly
    expect(eurekaOf(asChain(step('ALS_XZ')))).toBe('(5=1){r8c2,r9c1} - (1=5){r7c8,r8c9} => r7c1<>5');
    expect(eurekaOf(asChain(step('ALS_XY_WING')))).toBe('(7=4){r8c38} - (4=6)r6c3 - (6=7){r4c9,r6c8} => r4c8<>7');
    expect(eurekaOf(asChain(step('ALS_XY_CHAIN')))).toBe('(4=9){r4c27} - (9=3)r1c7 - (3=9){r1c56} - (9=4)r7c5 => r4c5<>4');
    // set B (r3c3, r4c3, r5c3), whose 7s and 4s lie in two of its cells, over all three
    expect(eurekaOf(asChain(kept('the short link, step 16, ALS_XZ')))).toBe('(4=7){r4c267} - (7=4){r345c3} => r4c1<>4');
    // ALS-XY-Chains whose sets share cells: A (r7c7) inside D (r7c5, r7c7); D (r4c4, r6c4) inside A
    expect(eurekaOf(asChain(kept('shared cells that derive, step 25, ALS_XY_CHAIN')))).toBe(
      '(1=5)r7c7 - (5=2){r2c79} - (2=7){r5c59} - (7=1){r7c57} => r7c6<>1'
    );
    expect(eurekaOf(asChain(kept('shared cells that clash, step 15, ALS_XY_CHAIN')))).toBe(
      '(8=9){r1456c4} - (9=8)r1c1 - (8=6){r4c13} - (6=8){r46c4} => r3c4<>8'
    );
    // its last set's 3s are its first set's, r1c7 and r1c9: the same candidates, not the same node, so no loop
    const ends = findStep('ALS_XY_CHAIN', onPath('9..86....3......9..784..2....6.4.5...9..5..8...3.1.7....5..716..8......4....34..7', 22))!;
    expect(ends.sets!.map((s) => s.cells.map(cellName).join(','))).toEqual(['r1c2,r1c7,r1c9', 'r1c3', 'r2c3', 'r1c2,r1c3,r1c7,r1c9']);
    const chain = asChain(ends);
    expect(chain.links!.at(-1)!.to).toEqual(chain.links![0].from);
    expect(eurekaOf(chain)).toBe('(3=2){r1c279} - (2=1)r1c3 - (1=2)r2c3 - (2=3){r1c2379} => r1c6<>3, r3c9<>3');
    // a link that does not leave the node the one before it reached, there of another set, is no chain
    const torn = asChain(step('ALS_XZ'));
    torn.links![1] = { ...torn.links![1], fromSet: 1 };
    expect(eurekaOf(torn)).toBeNull();
  });

  it('writes the single-digit chains and the W-Wing', () => {
    expect(stepText(step('X_CHAIN'))).toBe('X-Chain: (1)r8c3 = (1)r8c6 - (1)r6c6 = (1)r6c7 - (1)r4c8 = (1)r9c8 => r9c3<>1');
    expect(stepText(step('SKYSCRAPER'))).toBe('Skyscraper: (1)r2c7 = (1)r2c3 - (1)r9c3 = (1)r9c9 => r1c9<>1, r8c7<>1');
    expect(stepText(step('TWO_STRING_KITE'))).toBe('2-String Kite: (8)r1c8 = (8)r1c6 - (8)r3c4 = (8)r7c4 => r7c8<>8');
    expect(stepText(step('W_WING'))).toBe('W-Wing: (6=4)r3c7 - (4)r8c7 = (4)r8c5 - (4=6)r9c5 => r9c7<>6');
  });

  it('writes a loop that closes with two strong links as a chain back to its start, which it places', () => {
    const at = (cell: number) => [{ cell, digit: 5 }];
    // r1c1 = r1c5 - r3c5 = r3c1 - r2c2 = r1c1
    const loop: Step = {
      tech: 'X_CYCLES',
      placements: [{ cell: 0, digit: 5 }],
      eliminations: [],
      links: alternatingLinks([at(0), at(4), at(22), at(18), at(10)], 'strong'),
      description: ''
    };
    expect(eurekaOf(loop)).toBe('(5)r1c1 = (5)r1c5 - (5)r3c5 = (5)r3c1 - (5)r2c2 = (5)r1c1 => r1c1=5');
  });

  it('is not written for links that are not a chain: colouring ties, forcing trails, the restricted commons of ALS patterns', () => {
    // an ALS pattern's links are its restricted commons alone, Death Blossom's
    // the stem's to its petals: Copy step gives HoDoKu's line, from the sets
    const patterns: Tech[] = [
      'SIMPLE_COLORS',
      'MULTI_COLORS',
      'MEDUSA_3D',
      'DIGIT_FORCING_CHAIN',
      'NISHIO_FORCING_CHAIN',
      'ALS_XZ',
      'ALS_XY_WING',
      'ALS_XY_CHAIN',
      'DEATH_BLOSSOM'
    ];
    for (const tech of patterns) expect(eurekaOf(step(tech)), tech).toBeNull();
    for (const tech of ['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'] as Tech[]) {
      expect(stepText(step(tech)), tech).toBe(hodokuLine(step(tech)));
    }
    expect(eurekaOf(step('X_WING'))).toBeNull();
  });
});

describe('the HoDoKu line', () => {
  it('names a fish by its digit, base and cover houses, and its fins', () => {
    expect(stepText(step('X_WING'))).toBe('X-Wing: 7 r38 c38 => r2c3<>7');
    expect(stepText(step('SWORDFISH'))).toBe('Swordfish: 9 c148 r345 => r5c2<>9');
    expect(stepText(step('FINNED_X_WING'))).toBe('Finned X-Wing: 8 c39 r58 fr4c3 => r5c1<>8');
    expect(stepText(step('SASHIMI_X_WING'))).toBe('Sashimi X-Wing: 1 c48 r69 fr78c4 => r9c6<>1');
  });

  it('names a subset by its digits and cells, an intersection by its house', () => {
    expect(stepText(step('NAKED_PAIR'))).toBe('Naked Pair: 2,5 in r9c27 => r9c6<>5');
    expect(stepText(step('HIDDEN_PAIR'))).toBe('Hidden Pair: 6,8 in r4c37 => r4c3<>9, r4c7<>3');
    expect(stepText(step('NAKED_TRIPLE'))).toBe('Naked Triple: 2,6,7 in r79c4,r8c6 => r7c5<>6, r9c6<>2');
    expect(stepText(step('LOCKED_CANDIDATES_1'))).toBe('Locked Candidates (Pointing): 3 in b4 => r5c4<>3');
    expect(stepText(step('LOCKED_CANDIDATES_2'))).toBe('Locked Candidates (Claiming): 5 in r1 => r2c5<>5');
  });

  it('names a single by its cell, a hidden single by its house too', () => {
    expect(stepText(step('FULL_HOUSE'))).toBe('Full House: r4c9=8');
    expect(stepText(step('NAKED_SINGLE'))).toBe('Naked Single: r4c1=1');
    expect(stepText(step('HIDDEN_SINGLE'))).toBe('Hidden Single: 1 in r2 => r2c2=1');
  });

  it("names an ALS pattern set by set with the board's letters, the digits in braces, with its restricted commons and z", () => {
    expect(hodokuLine(step('ALS_XZ'))).toBe('ALS-XZ: A=r8c2,r9c1 {159}, B=r7c8,r8c9 {159}, X=1, Z=5 => r7c1<>5');
    // the wings A and B, linked to the hinge C by x and by y, as HoDoKu letters them
    expect(hodokuLine(step('ALS_XY_WING'))).toBe('ALS-XY-Wing: A=r8c38 {247}, B=r4c9,r6c8 {467}, C=r6c3 {46}, X,Y=4,6, Z=7 => r4c8<>7');
    expect(hodokuLine(step('ALS_XY_CHAIN'))).toBe(
      'ALS-XY-Chain: A=r4c27 {469}, B=r1c7 {39}, C=r1c56 {239}, D=r7c5 {49}, RCs=9,3,9, Z=4 => r4c5<>4'
    );
    // the same from the chains they are: a link inside a set is no restricted common
    for (const tech of ['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN'] as Tech[]) {
      expect(hodokuLine(asChain(step(tech))), tech).toBe(hodokuLine(step(tech)));
    }
    // HoDoKu's form (its SolutionStep): the stem, then each petal after the stem's digit it is for
    expect(hodokuLine(step('DEATH_BLOSSOM'))).toBe(
      'Death Blossom: [r8c9], -2- r9c7 {24}, -5- r8c5,r9c6 {145}, -7- r8c1 {47} => r9c2<>4, r9c3<>4'
    );
  });

  it('names the sets the step is made of where they were once guessed wrong', () => {
    // a chain of four sets once named as five, A to E, its set B (r4c2, r6c1) split in two
    const chain = findNextStep(onPath('...3...2..81...7..7..8.15..2....6.3.8...4...5.4.7....2..26.8..4..6...87..3...4...', 32))!;
    expect(chain.tech).toBe('ALS_XY_CHAIN');
    expect(hodokuLine(chain)).toBe(
      'ALS-XY-Chain: A=r2c168 {3569}, B=r4c2,r6c1 {139}, C=r18c2 {159}, D=r8c9 {19}, RCs=3,9,1, Z=9 => r2c9<>9'
    );
    // a wing once named with four sets, its hinge C (r2c1, r3c2) split into B and C
    const wing = findNextStep(onPath('1.9..3.......9.5.....5.281.2..........18.....86.3...249.....1........63.5..76...8', 22))!;
    expect(wing.tech).toBe('ALS_XY_WING');
    expect(hodokuLine(wing)).toBe('ALS-XY-Wing: A=r8c1 {47}, B=r346c3 {3457}, C=r2c1,r3c2 {347}, X,Y=4,3, Z=7 => r8c3<>7');
    // an ALS-XZ on offer whose set A, the cell r1c3, once took r2c2 from its set B
    const xz = findStep('ALS_XZ', onPath('1..6732..6....2.......1...79..2.1..8.54...61.7..5.8..95...3.......9....1..1725..3', 28))!;
    expect(hodokuLine(xz)).toBe('ALS-XZ: A=r1c3 {89}, B=r238c2 {2789}, X=8, Z=9 => r2c3<>9');
  });

  it("names exactly the step's sets, with their letters, in every ALS pattern of the examples and the set fixture", () => {
    const steps = [
      ...Object.values(EXAMPLES).map((ex) => ex!.step),
      ...[...Object.keys(SET_FIXTURE.paths), ...Object.keys(SET_FIXTURE.named)].map(kept)
    ].filter((s) => TECHS[s.tech].category === 'Almost Locked Sets');
    const counts: Record<string, number> = {};
    for (const s of steps) {
      const line = hodokuLine(s);
      const at = `${s.tech}: ${line}`;
      const sets = s.sets!;
      const z = s.eliminations[0].digit;
      if (s.tech === 'DEATH_BLOSSOM') {
        // the stem, then each petal after the stem's digit it is for
        const fromStem = s.links!.filter((l) => l.fromSet === undefined);
        expect(line.startsWith(`Death Blossom: [${cellName(fromStem[0].from[0].cell)}], `), at).toBe(true);
        expect([...line.matchAll(/-(\d)- (\S+) \{(\d+)\}/g)].map((m) => m.slice(1).join(' ')), at).toEqual(
          sets.map((p, i) => `${fromStem.find((l) => l.toSet === i)!.from[0].digit} ${compactCells(p.cells)} ${p.digits.join('')}`)
        );
      } else {
        expect([...line.matchAll(/\b([A-D])=(\S+) \{(\d+)\}/g)].map((m) => m.slice(1).join(' ')), at).toEqual(
          sets.map((p) => `${p.letter} ${compactCells(p.cells)} ${p.digits.join('')}`)
        );
        // the restricted commons, the links between two sets, in the chain's order; then z
        const rcs = s.links!.filter((l) => !insideSet(l)).map((l) => l.from[0].digit);
        expect(line, at).toContain(`=${rcs.join(',')}, Z=${z} => `);
      }
      expect(line.endsWith(conclusions(s)), at).toBe(true);
      counts[s.tech] = (counts[s.tech] ?? 0) + 1;
    }
    // one of each stored, and every one of the set fixture's
    expect(counts).toEqual({ ALS_XZ: 18, ALS_XY_WING: 16, ALS_XY_CHAIN: 21, DEATH_BLOSSOM: 10 });
  });

  it('writes wings, uniqueness and colouring one colour after another', () => {
    expect(stepText(step('XY_WING'))).toBe('XY-Wing: 7/9 in r7c7 / 6 in r7c6,r8c9 => r7c8<>6, r8c6<>6');
    expect(stepText(step('UNIQUENESS_1'))).toBe('Unique Rectangle Type 1: 5/8 in r4c1,r5c18 => r4c8<>5, r4c8<>8');
    expect(stepText(step('UNIQUENESS_4'))).toBe('Unique Rectangle Type 4: 4/6 in r28c79 => r2c9<>4, r8c9<>4');
    expect(stepText(step('SIMPLE_COLORS'))).toBe('Simple Colors Trap: 4 (r1c5,r6c4,r8c6) / (r1c6,r5c5,r8c8) => r6c8<>4');
    expect(stepText(step('DIGIT_FORCING_CHAIN'))).toBe('Digit Forcing Chain: 8 in r1c1 => r1c1<>3, r1c1<>6');
  });

  it('writes every worked example as one line, the name first and what it does last', () => {
    for (const tech of Object.keys(EXAMPLES) as Tech[]) {
      const s = step(tech);
      const line = stepText(s);
      // a colouring by HoDoKu's name for its rule: Simple Colors Trap, Multi Colors 1
      expect(line.startsWith(`${TECHS[tech].name}${s.truth === 'parity' && /Colors/.test(TECHS[tech].name) ? ' ' : ': '}`), tech).toBe(true);
      expect(line, tech).not.toMatch(/undefined|NaN|\n|\|/);
      expect(line.endsWith(conclusions(s)), tech).toBe(true);
      for (const cd of [...s.placements, ...s.eliminations]) expect(line, tech).toContain(cellName(cd.cell));
    }
  });
});

describe('cells in the notation', () => {
  it('are compacted to rows by columns when they fill them, else by row, by column and singly', () => {
    expect(compactCells([])).toBe('');
    expect(compactCells([0])).toBe('r1c1');
    expect(compactCells([2, 0, 1])).toBe('r1c123');
    expect(compactCells([2, 11, 20])).toBe('r123c3');
    expect(compactCells([27, 34, 36, 43])).toBe('r45c18');
    expect(compactCells([36, 43, 27])).toBe('r4c1,r5c18');
    expect(compactCells([59, 71])).toBe('r7c6,r8c9');
    expect(compactCells([3, 12, 17, 26, 80])).toBe('r1c4,r2c49,r39c9');
  });
});
