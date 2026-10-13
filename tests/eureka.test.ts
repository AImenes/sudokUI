/**
 * Steps as the forums write them (src/content/eureka.ts): chains in Eureka
 * notation, everything else as a HoDoKu line, held to the worked examples
 * character by character.
 */
import { describe, it, expect } from 'vitest';
import { eurekaOf, stepText, compactCells, conclusions } from '../src/content/eureka';
import { EXAMPLES } from '../src/content/examples';
import { alternatingLinks } from '../src/engine/steps';
import type { Step } from '../src/engine/steps';
import { TECHS, Tech } from '../src/engine/ratings';
import { cellName } from '../src/engine/board';

const step = (tech: Tech): Step => EXAMPLES[tech]!.step as Step;

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

  it('writes a group as r3c23 and an ALS in braces', () => {
    expect(stepText(step('AIC_GROUPED'))).toBe('AIC with Groups: (6=2)r1c1 - (2)r3c23 = (2)r3c6 - (2=6)r4c6 => r4c1<>6');
    expect(stepText(step('AIC_ALS'))).toBe('AIC with ALSs: (8)r2c9 = (8)r2c8 - (8=9){r78c8} - (9)r6c8 = (9)r6c9 => r6c9<>8');
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

  it('names an ALS pattern set by set, the digits in braces, with its restricted commons and z', () => {
    expect(stepText(step('ALS_XZ'))).toBe('ALS-XZ: A=r8c2,r9c1 {159}, B=r7c8,r8c9 {159}, X=1, Z=5 => r7c1<>5');
    expect(stepText(step('ALS_XY_WING'))).toBe('ALS-XY-Wing: A=r8c38 {247}, B=r6c3 {46}, C=r4c9,r6c8 {467}, X,Y=4,6, Z=7 => r4c8<>7');
    expect(stepText(step('ALS_XY_CHAIN'))).toBe(
      'ALS-XY-Chain: A=r4c27 {469}, B=r1c7 {39}, C=r1c56 {239}, D=r7c5 {49}, RCs=9,3,9, Z=4 => r4c5<>4'
    );
  });

  it('writes wings, uniqueness and colouring one colour after another', () => {
    expect(stepText(step('XY_WING'))).toBe('XY-Wing: 7/9 in r7c7 / 6 in r7c6,r8c9 => r7c8<>6, r8c6<>6');
    expect(stepText(step('UNIQUENESS_1'))).toBe('Unique Rectangle Type 1: 5/8 in r4c1,r5c18 => r4c8<>5, r4c8<>8');
    expect(stepText(step('UNIQUENESS_4'))).toBe('Unique Rectangle Type 4: 4/6 in r28c79 => r2c9<>4, r8c9<>4');
    expect(stepText(step('SIMPLE_COLORS'))).toBe('Simple Colors: 4 in r1c5,r6c4,r8c6 / r1c6,r5c5,r8c8 => r6c8<>4');
    expect(stepText(step('DIGIT_FORCING_CHAIN'))).toBe('Digit Forcing Chain: 8 in r1c1 => r1c1<>3, r1c1<>6');
  });

  it('writes every worked example as one line, the name first and what it does last', () => {
    for (const tech of Object.keys(EXAMPLES) as Tech[]) {
      const s = step(tech);
      const line = stepText(s);
      expect(line.startsWith(`${TECHS[tech].name}: `), tech).toBe(true);
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
