/**
 * The difficulty levels are HoDoKu's: the same five, the same limits, the
 * same technique levels and the same rule for a puzzle's level. The values
 * below are copied from HoDoKu's own source, SVN revision r147
 * (https://sourceforge.net/p/hodoku/code/147/tree/HoDoKu/trunk/), so a
 * change on either side shows up here:
 *
 * - src/sudoku/Options.java, DEFAULT_DIFFICULTY_LEVELS:
 *     new DifficultyLevel(DifficultyType.EASY, 800, ...)
 *     new DifficultyLevel(DifficultyType.MEDIUM, 1000, ...)
 *     new DifficultyLevel(DifficultyType.HARD, 1600, ...)
 *     new DifficultyLevel(DifficultyType.UNFAIR, 1800, ...)
 *     new DifficultyLevel(DifficultyType.EXTREME, Integer.MAX_VALUE, ...)
 * - src/sudoku/Options.java, DEFAULT_SOLVER_STEPS: each technique's
 *   StepConfig(index, type, level, category, baseScore, ...)
 * - src/solver/SudokuSolver.java, solve() and getHint(): the level starts
 *   at EASY, takes the level of every step that is found if it is higher,
 *   and once the puzzle is solved "while (score > level.getMaxScore())
 *   level = getDifficultyLevel(level.getOrdinal() + 1)".
 */
import { describe, it, expect } from 'vitest';
import {
  LEVELS,
  LEVEL_MAX_SCORE,
  TECHS,
  Tech,
  Level,
  PICKS,
  asLevel,
  subPick,
  inPick,
  pickLevel,
  pickOf,
  practiceCeiling,
  BEGINNER_MAX_SCORE,
  NIGHTMARE_MIN_SCORE
} from '../src/engine/ratings';
import { ratePuzzle, levelOf } from '../src/engine/humanSolver';
import { generatePuzzle } from '../src/engine/generator';
import { gridToString } from '../src/engine/board';

/** DifficultyType's order and DEFAULT_DIFFICULTY_LEVELS' max scores, INCOMPLETE left out */
const HODOKU_LEVELS: [string, number][] = [
  ['EASY', 800],
  ['MEDIUM', 1000],
  ['HARD', 1600],
  ['UNFAIR', 1800],
  ['EXTREME', 2147483647]
];

/**
 * DEFAULT_SOLVER_STEPS for every technique sudokUI shares with HoDoKu:
 * [SolutionType, DifficultyType, baseScore]. HoDoKu's LOCKED_CANDIDATES_1
 * and _2 are sudokUI's pointing and claiming.
 */
const HODOKU_STEPS: [Tech, string, number][] = [
  ['FULL_HOUSE', 'EASY', 4],
  ['NAKED_SINGLE', 'EASY', 4],
  ['HIDDEN_SINGLE', 'EASY', 14],
  ['LOCKED_PAIR', 'MEDIUM', 40],
  ['LOCKED_TRIPLE', 'MEDIUM', 60],
  ['LOCKED_CANDIDATES_1', 'MEDIUM', 50],
  ['LOCKED_CANDIDATES_2', 'MEDIUM', 50],
  ['NAKED_PAIR', 'MEDIUM', 60],
  ['NAKED_TRIPLE', 'MEDIUM', 80],
  ['HIDDEN_PAIR', 'MEDIUM', 70],
  ['HIDDEN_TRIPLE', 'MEDIUM', 100],
  ['NAKED_QUADRUPLE', 'HARD', 120],
  ['HIDDEN_QUADRUPLE', 'HARD', 150],
  ['X_WING', 'HARD', 140],
  ['SWORDFISH', 'HARD', 150],
  ['JELLYFISH', 'HARD', 160],
  ['SQUIRMBAG', 'UNFAIR', 470],
  ['WHALE', 'UNFAIR', 470],
  ['LEVIATHAN', 'UNFAIR', 470],
  ['REMOTE_PAIR', 'HARD', 110],
  ['BUG_PLUS_1', 'HARD', 100],
  ['SKYSCRAPER', 'HARD', 130],
  ['W_WING', 'HARD', 150],
  ['TWO_STRING_KITE', 'HARD', 150],
  ['XY_WING', 'HARD', 160],
  ['XYZ_WING', 'HARD', 180],
  ['UNIQUENESS_1', 'HARD', 100],
  ['UNIQUENESS_2', 'HARD', 100],
  ['UNIQUENESS_3', 'HARD', 100],
  ['UNIQUENESS_4', 'HARD', 100],
  ['UNIQUENESS_5', 'HARD', 100],
  ['UNIQUENESS_6', 'HARD', 100],
  ['FINNED_X_WING', 'HARD', 130],
  ['SASHIMI_X_WING', 'HARD', 150],
  ['FINNED_SWORDFISH', 'UNFAIR', 200],
  ['SASHIMI_SWORDFISH', 'UNFAIR', 240],
  ['FINNED_JELLYFISH', 'UNFAIR', 250],
  ['SASHIMI_JELLYFISH', 'UNFAIR', 260],
  ['SUE_DE_COQ', 'UNFAIR', 250],
  ['X_CHAIN', 'UNFAIR', 260],
  ['XY_CHAIN', 'UNFAIR', 260],
  ['NICE_LOOP', 'UNFAIR', 280],
  ['ALS_XZ', 'UNFAIR', 300],
  ['ALS_XY_WING', 'UNFAIR', 320],
  ['ALS_XY_CHAIN', 'UNFAIR', 340],
  ['DEATH_BLOSSOM', 'UNFAIR', 360],
  ['FRANKEN_X_WING', 'UNFAIR', 300],
  ['FRANKEN_SWORDFISH', 'UNFAIR', 350],
  ['FORCING_CHAIN', 'EXTREME', 500],
  ['FORCING_NET', 'EXTREME', 700],
  ['BRUTE_FORCE', 'EXTREME', 10000],
  ['GROUPED_NICE_LOOP', 'UNFAIR', 300],
  ['EMPTY_RECTANGLE', 'HARD', 120],
  ['HIDDEN_RECTANGLE', 'HARD', 100],
  ['AVOIDABLE_RECTANGLE_1', 'HARD', 100],
  ['AVOIDABLE_RECTANGLE_2', 'HARD', 100],
  ['SIMPLE_COLORS', 'HARD', 150],
  ['MULTI_COLORS', 'HARD', 200],
  ['TURBOT_FISH', 'HARD', 120]
];

const asHodoku = (l: Level) => HODOKU_LEVELS[LEVELS.indexOf(l)][0];

/** SudokuSolver.solve's rule, written out again over HoDoKu's own numbers */
function hodokuLevel(techs: Tech[], score: number): string {
  let level = 0; // EASY
  for (const t of techs) level = Math.max(level, LEVELS.indexOf(TECHS[t].level));
  while (score > HODOKU_LEVELS[level][1]) level++;
  return HODOKU_LEVELS[level][0];
}

describe("HoDoKu's difficulty levels (Options.java and SudokuSolver.java, r147)", () => {
  it('are the five levels, in order, with exactly the limits of DEFAULT_DIFFICULTY_LEVELS', () => {
    expect(LEVELS.map((l) => l.toUpperCase())).toEqual(HODOKU_LEVELS.map(([name]) => name));
    expect(LEVELS.map((l) => LEVEL_MAX_SCORE[l])).toEqual(HODOKU_LEVELS.map(([, max]) => max));
  });

  it("give every shared technique HoDoKu's level and score (DEFAULT_SOLVER_STEPS)", () => {
    for (const [tech, level, score] of HODOKU_STEPS) {
      expect(asHodoku(TECHS[tech].level), tech).toBe(level);
      expect(TECHS[tech].score, tech).toBe(score);
    }
  });

  it('rate a puzzle by the rule of SudokuSolver.solve: the hardest step, raised while the score is over the limit', () => {
    // the rule at its edges: a limit is inclusive, and a level can rise more than once
    expect(levelOf('Easy', 800)).toBe('Easy');
    expect(levelOf('Easy', 801)).toBe('Medium');
    expect(levelOf('Easy', 1001)).toBe('Hard');
    expect(levelOf('Medium', 1601)).toBe('Unfair');
    expect(levelOf('Hard', 1800)).toBe('Unfair');
    expect(levelOf('Hard', 1801)).toBe('Extreme');
    expect(levelOf('Unfair', 400)).toBe('Unfair');
    expect(levelOf('Extreme', 0)).toBe('Extreme');
    // and over whole solve paths, against the rule written out again
    for (let i = 0; i < 150; i++) {
      const puzzle = gridToString(generatePuzzle(i % 3 ? 'rotational' : 'none'));
      const r = ratePuzzle(puzzle)!;
      expect(r, puzzle).not.toBeNull();
      expect(r.score, puzzle).toBe(r.steps.reduce((sum, s) => sum + TECHS[s.tech].score, 0));
      expect(asHodoku(r.level), puzzle).toBe(
        hodokuLevel(
          r.steps.map((s) => s.tech),
          r.score
        )
      );
    }
  });
});

describe('the narrower picks of New game', () => {
  it('lie inside one level each: Beginner the Easy puzzles up to 400, Nightmare the Extreme ones above 3000', () => {
    expect(PICKS).toEqual(['Beginner', 'Easy', 'Medium', 'Hard', 'Unfair', 'Extreme', 'Nightmare']);
    expect(BEGINNER_MAX_SCORE).toBe(400);
    expect(NIGHTMARE_MIN_SCORE).toBe(3000);
    expect(pickLevel('Beginner')).toBe('Easy');
    expect(pickLevel('Nightmare')).toBe('Extreme');
    expect(subPick('Easy', 400)).toBe('Beginner');
    expect(subPick('Easy', 401)).toBeNull();
    expect(subPick('Extreme', 3000)).toBeNull();
    expect(subPick('Extreme', 3001)).toBe('Nightmare');
    expect(subPick('Medium', 300)).toBeNull();
    expect(inPick('Easy', 'Easy', 200)).toBe(true);
    expect(inPick('Beginner', 'Easy', 200)).toBe(true);
    expect(inPick('Beginner', 'Easy', 600)).toBe(false);
    expect(inPick('Extreme', 'Extreme', 3500)).toBe(true);
    expect(inPick('Nightmare', 'Extreme', 3500)).toBe(true);
    expect(inPick('Nightmare', 'Unfair', 1700)).toBe(false);
    expect(pickOf('Easy', 200)).toBe('Beginner');
    expect(pickOf('Hard', 1200)).toBe('Hard');
  });
});

describe('the eight band names from before the five', () => {
  it('each read as the HoDoKu level its puzzles lie in', () => {
    expect(asLevel('Beginner')).toBe('Easy');
    expect(asLevel('Easy')).toBe('Easy');
    expect(asLevel('Medium')).toBe('Medium');
    expect(asLevel('Tricky')).toBe('Hard');
    expect(asLevel('Hard')).toBe('Hard');
    expect(asLevel('Unfair')).toBe('Unfair');
    expect(asLevel('Extreme')).toBe('Extreme');
    expect(asLevel('Nightmare')).toBe('Extreme');
    for (const x of ['', 'hard', 'Insane', 'constructor', '__proto__', 'toString', null, undefined, 3, {}]) {
      expect(asLevel(x), String(x)).toBeNull();
    }
  });
});

describe('practice ceilings', () => {
  it('keep singles to Easy, give Medium and Hard classes one level more, and the rest no ceiling', () => {
    expect(practiceCeiling('HIDDEN_SINGLE')).toBe('Easy');
    expect(practiceCeiling('NAKED_PAIR')).toBe('Hard');
    expect(practiceCeiling('X_WING')).toBe('Unfair');
    expect(practiceCeiling('XY_CHAIN')).toBe('Extreme');
    expect(practiceCeiling('FORCING_NET')).toBe('Extreme');
  });
});
