import { describe, it, expect } from 'vitest';
import { emptyGrid, cloneGrid, isSolved, gridToString, bit } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { generatePuzzle } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { findExocet, findDoubleExocet } from '../src/engine/techniques/exocet';

describe('exocet', () => {
  it('finds a synthetic exocet and derives the right eliminations', () => {
    const g = emptyGrid();
    // base r1c1,r1c2 = {1,2,3}; targets T1 = r2c4, T2 = r3c7.
    // For each base digit: rows 2 and 3 admit it only inside box 1 or at the
    // target, so any full placement through the base must use the targets.
    for (const d of [1, 2, 3]) {
      for (let col = 3; col < 9; col++) {
        if (col !== 3) g.cands[1 * 9 + col] &= ~bit(d); // row 2: only T1 outside box 1
        if (col !== 6) g.cands[2 * 9 + col] &= ~bit(d); // row 3: only T2 outside box 1
      }
    }
    // the base cells hold exactly the base set
    g.cands[0] = bit(1) | bit(2) | bit(3);
    g.cands[1] = bit(1) | bit(2) | bit(3);

    const step = findExocet(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('EXOCET');
    // targets r2c4 (cell 12) and r3c7 (cell 24) lose all non-base candidates
    const cells = new Set(step!.eliminations.map((e) => e.cell));
    expect(cells.has(12)).toBe(true);
    expect(cells.has(24)).toBe(true);
    expect(step!.eliminations.every((e) => e.digit >= 4)).toBe(true);
  });

  it('template proof rejects a non-exocet geometry', () => {
    const g = emptyGrid();
    // same shape but WITHOUT the row restrictions: base digits can escape
    // rows 2 and 3 elsewhere, so no elimination may be claimed
    g.cands[0] = bit(1) | bit(2) | bit(3);
    g.cands[1] = bit(1) | bit(2) | bit(3);
    const step = findExocet(g);
    expect(step).toBeNull();
  });

  it('finds a synthetic double exocet (line elimination)', () => {
    const g = emptyGrid();
    const S = [1, 2, 3, 4];
    // two bases on row 1: box 1 (r1c1,r1c2) and box 2 (r1c4,r1c5), same set
    for (const cell of [0, 1, 3, 4]) {
      g.cands[cell] = bit(1) | bit(2) | bit(3) | bit(4);
    }
    // rows 2 and 3: base digits confined so each exocet's template proof holds
    for (const d of S) {
      for (let col = 0; col < 9; col++) {
        if (col !== 1 && col !== 4) g.cands[1 * 9 + col] &= ~bit(d); // row 2: cols 2 & 5
        if (col !== 6 && col !== 7) g.cands[2 * 9 + col] &= ~bit(d); // row 3: cols 7 & 8
      }
    }
    const step = findDoubleExocet(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('DOUBLE_EXOCET');
    // the rest of row 1 (cols 3, 6, 7, 8, 9) loses the base digits
    const cells = [...new Set(step!.eliminations.map((e) => e.cell))].sort((a, b) => a - b);
    expect(cells).toEqual([2, 5, 6, 7, 8]);
    expect(step!.eliminations.every((e) => e.digit <= 4)).toBe(true);
  });

  it('validates every random-puzzle firing against the solution', { timeout: 300_000 }, () => {
    let fired = 0;
    for (let i = 0; i < 250; i++) {
      const puzzle = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const solution = solve(cloneGrid(puzzle));
      if (!solution) continue;
      const g = cloneGrid(puzzle);
      for (let s = 0; s < 200 && !isSolved(g); s++) {
        if (s % 3 === 0) {
          const hit = findExocet(g);
          if (hit) {
            fired++;
            for (const { cell, digit } of hit.eliminations) {
              expect(
                solution.values[cell],
                `EXOCET eliminated a solution digit: ${hit.description}\n${gridToString(puzzle)}`
              ).not.toBe(digit);
            }
          }
        }
        const step = findNextStep(g);
        if (!step) break;
        applyStep(g, step);
      }
    }
    // exocets are rare in random minimal puzzles — firings validate whenever
    // they occur, the synthetic tests carry the deterministic proof
    // eslint-disable-next-line no-console
    console.info(`exocet random firings validated: ${fired}`);
  });
});
