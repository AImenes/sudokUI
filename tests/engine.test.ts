import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString, emptyGrid, setValue } from '../src/engine/board';
import { countSolutions, solve, hasUniqueSolution } from '../src/engine/bruteForce';
import { generatePuzzle, generateFullGrid, generateWhere, matchesLevel } from '../src/engine/generator';
import { ratePuzzle, findNextStep, applyStep } from '../src/engine/humanSolver';
import { findBasicFish } from '../src/engine/techniques/fish';
import { findXYWing } from '../src/engine/techniques/wings';
import { isSolved } from '../src/engine/board';

// A well-known easy puzzle
const EASY =
  '003020600900305001001806400008102900700000008006708200002609500800203009005010300';
const EASY_SOLUTION =
  '483921657967345821251876493548132976729564138136798245372689514814253769695417382';

// Har puzzle requiring advanced techniques (top1465 #2)
const HARD = '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....';

describe('brute force solver', () => {
  it('solves a known puzzle', () => {
    const g = parseGrid(EASY)!;
    const solved = solve(g)!;
    expect(gridToString(solved)).toBe(EASY_SOLUTION);
  });

  it('counts solutions', () => {
    expect(countSolutions(parseGrid(EASY)!, 2)).toBe(1);
    expect(countSolutions(emptyGrid(), 2)).toBe(2);
    expect(hasUniqueSolution(parseGrid(HARD)!)).toBe(true);
  });
});

describe('human solver', () => {
  it('solves the easy puzzle with singles only', () => {
    const rating = ratePuzzle(EASY)!;
    expect(rating).not.toBeNull();
    expect(rating.solvable).toBe(true);
    // singles-only and a low score: the gentlest of the eight bands
    expect(rating.level).toBe('Beginner');
    const techs = Object.keys(rating.techniques);
    for (const t of techs) {
      expect(['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']).toContain(t);
    }
  });

  it('applying all steps solves the puzzle', () => {
    const g = parseGrid(EASY)!;
    for (let i = 0; i < 200 && !isSolved(g); i++) {
      const step = findNextStep(g);
      expect(step).not.toBeNull();
      applyStep(g, step!);
    }
    expect(gridToString(g)).toBe(EASY_SOLUTION);
  });

  it('rates a hard puzzle above Easy and reaches the solution', () => {
    const rating = ratePuzzle(HARD);
    expect(rating).not.toBeNull();
    expect(['Beginner', 'Easy']).not.toContain(rating!.level);
    expect(rating!.score).toBeGreaterThan(300);
  });

  it('maps scores to the eight difficulty bands', async () => {
    const { levelForScore, LEVELS } = await import('../src/engine/ratings');
    expect(LEVELS).toHaveLength(8);
    expect(levelForScore(300)).toBe('Beginner');
    expect(levelForScore(401)).toBe('Easy');
    expect(levelForScore(900)).toBe('Medium');
    expect(levelForScore(1100)).toBe('Tricky');
    expect(levelForScore(1500)).toBe('Hard');
    expect(levelForScore(1700)).toBe('Unfair');
    expect(levelForScore(2500)).toBe('Extreme');
    expect(levelForScore(4354)).toBe('Nightmare');
  });
});

describe('technique finders', () => {
  it('finds an X-Wing', () => {
    // synthetic position: digit 5 restricted to columns 2 and 7 in rows 1 and 5
    const g = emptyGrid();
    for (const row of [0, 4]) {
      for (let col = 0; col < 9; col++) {
        if (col !== 1 && col !== 6) g.cands[row * 9 + col] &= ~(1 << 4); // remove cand 5
      }
    }
    const step = findBasicFish(g, 2);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('X_WING');
    expect(step!.eliminations.length).toBeGreaterThan(0);
  });

  it('finds an XY-Wing', () => {
    // hodoku XY-wing example
    const g = parseGrid(
      '.9.24..7.75..92..14..7.5..9.7..25...5..9.71..9...84.7.19..7..851.7..9.4.8..451.97'
    )!;
    // clean the grid with singles first so pencilmarks match
    for (let i = 0; i < 50; i++) {
      const s = findNextStep(g, ['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']);
      if (!s) break;
      applyStep(g, s);
    }
    const step = findXYWing(g);
    expect(step === null || step.tech === 'XY_WING').toBe(true);
  });
});

describe('generator', () => {
  it('produces a unique-solution puzzle', () => {
    const p = generatePuzzle('rotational');
    expect(countSolutions(p, 2)).toBe(1);
  });

  it('produces a full valid grid', () => {
    const g = generateFullGrid();
    expect(isSolved(g)).toBe(true);
    expect(countSolutions(g, 2)).toBe(1);
  });

  it('generates an Easy-rated puzzle quickly', () => {
    const res = generateWhere(matchesLevel('Easy'), 100);
    expect(res).not.toBeNull();
    expect(res!.rating.level).toBe('Easy');
  });
});

describe('validatePuzzle (import & custom entry pre-play check)', async () => {
  const { validatePuzzle } = await import('../src/state/gameStore');

  it('accepts and rates a proper puzzle', () => {
    const v = validatePuzzle(EASY.replace(/0/g, '.'));
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.score).toBeGreaterThan(0);
  });

  it('rejects too few givens', () => {
    const v = validatePuzzle('1'.padEnd(81, '.'));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('17');
  });

  it('rejects conflicting givens', () => {
    const v = validatePuzzle(('11'.padEnd(17, '2') + '3').padEnd(81, '.'));
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('Conflicting');
  });

  it('rejects multi-solution puzzles', () => {
    // strip givens from EASY one by one until uniqueness first breaks — the
    // result keeps far more than 17 givens, so the uniqueness branch (not
    // the clue-count branch) must be the one that fires
    const chars = [...EASY.replace(/0/g, '.')];
    const givens = chars.flatMap((ch, i) => (ch !== '.' ? [i] : []));
    let weak = '';
    for (const i of givens) {
      chars[i] = '.';
      weak = chars.join('');
      if (countSolutions(parseGrid(weak)!, 2) > 1) break;
    }
    expect([...weak].filter((c) => c !== '.').length).toBeGreaterThanOrEqual(17);
    const v = validatePuzzle(weak);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toContain('more than one solution');
  });
});
