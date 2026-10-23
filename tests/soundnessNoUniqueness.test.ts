/**
 * Hints without uniqueness keep their promise: a player who turns
 * uniqueness off (settings.useUniqueness) is told nothing that leans on
 * the puzzle having one solution. Hints, Steps, Scan, the why-not proofs
 * and the credit of a move then search in NO_UNIQUENESS_ORDER
 * (src/engine/ratings.ts), and this file holds them to it.
 *
 * Leaving the uniqueness family out of the order is not enough by itself:
 * any other technique could lean on uniqueness without saying so. The test
 * that settles it is a puzzle with SEVERAL solutions. There a deduction
 * that does not assume one solution must hold in every solution: a
 * placement is the digit every solution has in that cell, an elimination
 * removes a digit no solution has there. Every solution is listed by an
 * oracle of our own (tests/solutionOracle.ts, proven below before it is
 * trusted, the half that says what every solution agrees on included), the
 * solver plays step after step without uniqueness, and every step is
 * checked against all of them, as is every step Scan would list early in
 * the solve and just before the solver stops, every credited move and
 * every why-not proof. Every technique of the order is judged so on a
 * position with several solutions, and a test says which, so none drops
 * out unseen. With uniqueness on, the same puzzles show the oracle has
 * teeth: unique rectangles and their kin are false there, as they must
 * be, and nothing else is; a move credited or a digit proven wrong by them
 * is refused once uniqueness is off. The credit and the proofs run on a
 * clock that stands still, so what they find or refuse does not hang on
 * the machine's speed.
 *
 * A position with no solution at all would make every claim "true" in all
 * of its solutions, so every position judged here is shown to have one,
 * and the rare patterns are judged on positions with several. A test that
 * judges false moves counts them, so it cannot pass on none.
 *
 * That the game asks for the order without uniqueness where it should
 * (Steps rows, the credit sent to the worker, a change of the setting) is
 * tests/noUniquenessWiring.test.ts. The heavy version of this run
 * (thousands of puzzles on every core) lives outside the repository; what
 * is here is sized for CI.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { Grid, parseGrid, gridToString, cloneGrid, emptyGrid, isSolved, bit, cellName } from '../src/engine/board';
import { generatePuzzle, generateFullGrid } from '../src/engine/generator';
import { findNextStep, findAllSteps, findStep, applyStep, ratePuzzle } from '../src/engine/humanSolver';
import { justify } from '../src/engine/justify';
import { serveJustify, WorkerResponse } from '../src/engine/worker';
import { Step } from '../src/engine/steps';
import { TECHS, SOLVE_ORDER, NO_UNIQUENESS_ORDER, hintOrder, Tech } from '../src/engine/ratings';
import { TECH_DOCS } from '../src/content/techniqueDocs';
import { proveWrong, contractGrid, useGame, type CellState } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';
import { allSolutions, hasSolution, hasSolutionWithout, truthOf, isValidSolution, naiveCount, Truth } from './solutionOracle';

const CAP = 500;
const isUniqueness = (t: Tech) => TECHS[t].category === 'Uniqueness';
const isSingle = (t: Tech) => TECHS[t].category === 'Singles';

afterEach(() => {
  vi.restoreAllMocks();
  useSettings.getState().set({ useUniqueness: true, dontCount: false });
});

/** a small seeded generator, so a failure here can be replayed */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** generator.ts draws on Math.random: seeded here for the length of `fn` */
function seeded<T>(rnd: () => number, fn: () => T): T {
  const spy = vi.spyOn(Math, 'random').mockImplementation(rnd);
  try {
    return fn();
  } finally {
    spy.mockRestore();
  }
}

/**
 * The position's solutions, as the oracle lists them, each checked to be a
 * grid that keeps the rules, the values and the masks (an oracle that let a
 * clash through would list a grid that does not); null past the cap
 */
function solutionsAt(values: ArrayLike<number>, cands: ArrayLike<number> | undefined, cap = CAP): Uint8Array[] | null {
  const sols = allSolutions(values, cands, cap);
  const keeps = (s: Uint8Array) =>
    isValidSolution(s) && s.every((d, i) => (values[i] ? d === values[i] : !cands || (cands[i] & bit(d)) !== 0));
  expect((sols ?? []).filter((s) => !keeps(s)).map((s) => s.join('')), 'the oracle listed a grid that breaks a rule, a value or a mask').toEqual([]);
  return sols;
}

/** what the position's solutions agree on, as the oracle sees them; null past the cap */
function truthAt(g: Grid): Truth | null {
  const sols = solutionsAt(g.values, g.cands);
  return sols ? truthOf(sols) : null;
}

const bitCount = (m: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & bit(d)).length;

/**
 * Techniques judged on a position with several solutions, step or Scan, by
 * the tests of the describe that has them: its last test holds that every
 * technique of the order without uniqueness is among them
 */
const judgedOnSeveral = new Set<Tech>();

/** how a step is false in a position whose solutions `truth` describes: [] when it is true */
function falsehoods(step: Step, g: Grid, truth: Truth): string[] {
  const out: string[] = [];
  for (const { cell, digit } of step.placements) {
    if (truth.forced[cell] !== digit) out.push(`places ${digit} in ${cellName(cell)}, which not every solution has there`);
  }
  for (const { cell, digit } of step.eliminations) {
    if (truth.seen[cell] & bit(digit)) out.push(`removes ${digit} from ${cellName(cell)}, which a solution has there`);
  }
  for (const link of step.links ?? []) {
    for (const { cell, digit } of [...link.from, ...link.to]) {
      if (!(g.values[cell] === 0 && g.cands[cell] & bit(digit))) out.push(`draws a link through ${digit} in ${cellName(cell)}, not a candidate`);
    }
  }
  return out;
}

const describeStep = (label: string, i: number, step: Step, g: Grid) =>
  `${label}, step ${i}: ${step.tech} — ${step.description}\nposition ${gridToString(g)}`;

/**
 * Play `order` from a puzzle fresh from parseGrid until it stops, checking
 * every step against every solution; with `scan`, also every step
 * findAllSteps lists at the first `scan` positions that need more than a
 * single, and with `late` at the last `late` such positions, just before
 * the solver stops (where, on a puzzle with several solutions, the deadly
 * patterns are). Returns the techniques used.
 */
function playChecked(g: Grid, order: Tech[], label: string, scan = 0, late = 0): Set<Tech> {
  const truth = truthAt(g)!;
  expect(truth, `${label}: over the oracle's cap`).not.toBeNull();
  expect(truth.count, `${label}: no solution`).toBeGreaterThan(0);
  // the candidates the engine starts from lose no solution of the clues
  // alone: the oracle judges the puzzle, not a position the engine made up
  expect(allSolutions(g.values, undefined, CAP)?.length, `${label}: the engine's first candidates lose a solution`).toBe(truth.count);
  const used = new Set<Tech>();
  const scanned = (at: number, position: Grid, tag: string) => {
    for (const listed of findAllSteps(position, order)) {
      used.add(listed.tech);
      if (order === NO_UNIQUENESS_ORDER) expect(isUniqueness(listed.tech), describeStep(`${label} (${tag})`, at, listed, position)).toBe(false);
      expect(falsehoods(listed, position, truth), describeStep(`${label} (${tag})`, at, listed, position)).toEqual([]);
    }
  };
  const lastOnes: { at: number; position: Grid }[] = [];
  for (let i = 0; i < 400 && !isSolved(g); i++) {
    const step = findNextStep(g, order);
    if (!step) break;
    used.add(step.tech);
    if (order === NO_UNIQUENESS_ORDER) expect(isUniqueness(step.tech), describeStep(label, i, step, g)).toBe(false);
    expect(falsehoods(step, g, truth), describeStep(label, i, step, g)).toEqual([]);
    if (!isSingle(step.tech)) {
      if (scan > 0) {
        scan--;
        scanned(i, g, 'scan');
      } else if (late > 0) {
        lastOnes.push({ at: i, position: cloneGrid(g) });
        if (lastOnes.length > late) lastOnes.shift();
      }
    }
    applyStep(g, step);
    // a true step loses no solution: the oracle, asked again, agrees
    if (truth.count > 1) expect(allSolutions(g.values, g.cands, CAP)?.length, describeStep(label, i, step, g)).toBe(truth.count);
  }
  // the steps were true, so the solutions are those of every position on the way
  for (const { at, position } of lastOnes) scanned(at, position, 'late scan');
  // and a puzzle with several solutions is never completed: some cell stays open between them
  if (truth.count > 1) {
    expect(isSolved(g), label).toBe(false);
    for (const t of used) judgedOnSeveral.add(t);
  }
  return used;
}

/** a puzzle string with `k` of its clues taken away, chosen by `rnd` */
function withoutClues(puzzle: string, k: number, rnd: () => number): string {
  const s = puzzle.split('');
  const clues = s.flatMap((ch, i) => (ch === '.' ? [] : [i]));
  for (let j = 0; j < k; j++) s[clues.splice(Math.floor(rnd() * clues.length), 1)[0]] = '.';
  return s.join('');
}

/** a board as the game keeps it: the puzzle's clues, and `placed` as the player's entries */
function cellsOf(puzzle: string, placed: ArrayLike<number> = []): CellState[] {
  return Array.from({ length: 81 }, (_, i) => {
    const given = puzzle[i] !== '.';
    return { given, value: given ? Number(puzzle[i]) : placed[i] ?? 0, corner: 0, center: 0, excluded: 0, colors: [] };
  });
}

const HARD_PUZZLES = [
  '52...6.........7.13...........4..8..6......5...........418.........3..2...87.....',
  '4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......',
  '..53.....8......2..7..1.5..4....53...1..7...6..32...8..6.5....9..4....3......97..',
  '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...',
  '.2..5.7..4..1....68....3...2....8..3.4..2.5.....6...1...2.9.....9......57.4...9..',
  '1....7.9..3..2...8..96..5....53..9...1..8...26....4...3......1..4......7..7...3..'
];

/** the puzzle Cracking the Cryptic solved with chains where our engine takes a unique rectangle (tests/uniquenessSetting.test.ts) */
const CTC = '1...........6......6.935.....234..6.3....1..2.......84.5..6......1..2.9.8......71';

/**
 * Puzzles the engine's own order solves with the uniqueness family, one
 * per kind (src/content/examples.json, practicePuzzles.json): without
 * uniqueness, the solver has to find another way exactly where it would
 * have used one.
 */
const UNIQUENESS_PUZZLES = [
  '9.2...1......1.723.5..6.......1.6..7..6.2.3..3..8.5.......7..1.285.9......1...2.8', // UNIQUENESS_1
  '9..6..87.7...8.3...5...96..4.2.6..5...........1..9.2.7..49...3...5.4...6.87..1..4', // UNIQUENESS_2
  '..97....6.4..561......143...82....9.....2.....1....26...748......627..3.4....59..', // UNIQUENESS_3
  '.5.38..1...1......2.......35.4....9........6.7....25.....7..8..31.2........8.69..', // UNIQUENESS_4
  '.81.67..4.34.1....5..4.8...15....6...9.....2...6....49...8.9..1....5.86.8..13.97.', // UNIQUENESS_5
  '...4.65377..9..6..........4......1.6.465.238.8.3......4..........9..5..22853.4...', // UNIQUENESS_6
  '7.4..8.1.8.....3.7.596.......1..74..54.....76..74..8.......468.4.8.....3.7.8..1.4', // HIDDEN_RECTANGLE
  '7.....31...9...2...2.7.49.6.6..3.......2.1.......9..2.5.19.3.4...7...5...43.....7', // AVOIDABLE_RECTANGLE_1
  '..2......96.12....48.6.....6...3...9.3.512.8.5...9...1.....8.16....69.37......9..', // AVOIDABLE_RECTANGLE_2
  '.3...9..1...2..4...147.32.9..1......6...1...3......5..7.39.516...8..7...1..4...9.', // EXTENDED_RECTANGLE
  '3..8.....7...5.92..4..2..135....3.8.18.....39.7.2....641..3..7..57.8...1.....7..2' // BUG_PLUS_1
];

/**
 * Wrong digits whose shortest proof, with uniqueness on, is a uniqueness
 * technique: the player's board (values, the wrong digit included), the
 * cell, the digit, and the technique Check names with uniqueness on.
 */
const PROOF_CASES = [
  {
    puzzle: '9..6..87.7...8.3...5...96..4.2.6..5...........1..9.2.7..49...3...5.4...6.87..1..4',
    values: '9..6..87.7..48.39.2587396414.286.159..9...4.3.1..9.2.7124976538395248716687351924',
    cell: 12,
    wrong: 4,
    on: 'UNIQUENESS_2'
  },
  {
    puzzle: '3..8.....7...5.92..4..2..135....3.8.18.....39.7.2....641..3..7..57.8...1.....7..2',
    values: '3928.15..76135492884592..13526193.8.184..523997324815641..32.7525748.3.163.517..2',
    cell: 21,
    wrong: 9,
    on: 'BUG_PLUS_1'
  },
  {
    puzzle: '..8..6..29.4....8.2....9.3.....35.6.5...4...8.4.69.....9.7....6.1....5.97..9..3..',
    values: '3.8.16..2974....8.2.1..9.3.829135.6.536247..814769825349.75.8.661...457978596.3..',
    cell: 10,
    wrong: 7,
    on: 'HIDDEN_RECTANGLE'
  },
  {
    puzzle: '..97....6.4..561......143...82....9.....2.....1....26...748......627..3.4....59..',
    values: '159732..6.438561.9..891435..82.4..9.9.5.27....1459.26.5374896..896271.3.4213659..',
    cell: 41,
    wrong: 7,
    on: 'UNIQUENESS_3'
  }
] as const;

/**
 * Puzzles with several solutions (proper puzzles with a clue or two taken
 * away) on which the solver, without uniqueness, plays advanced techniques
 * before it stops: picked by a heavy run for the most techniques in the
 * least time.
 */
const ADVANCED_MULTI = [
  { puzzle: '..78.3..128.6.........7....7...3..82.6...1.5...........2....13.8...4.2.74..32....', solutions: 2 }, // EMPTY_RECTANGLE, XYZ_WING, SKYSCRAPER, CHUTE_REMOTE_PAIR
  { puzzle: '.914......6...7..2...1..45.....6..2.7.29.45.6.3..1.....58..1...3..2...7......5.6.', solutions: 2 }, // X_WING, REMOTE_PAIR, MEDUSA_3D
  { puzzle: '..28...9..54..6.8.......1.6..6..1.52....9....47.5..6..3.9.........7..92..2...84..', solutions: 2 }, // SKYSCRAPER, FINNED_JELLYFISH, MEDUSA_3D
  { puzzle: '.1.5.2...2.37......59...7...3..7.8....4.6.9....8....2...1...46......62.1.....3.8.', solutions: 3 }, // NICE_LOOP, XY_WING, TWO_STRING_KITE, WXYZ_WING, FINNED_SWORDFISH, XY_CHAIN, MEDUSA_3D, W_WING
  { puzzle: '75..4....9...........1.956......815..9.....3..623....4.258.4...........6....3..95', solutions: 4 }, // TURBOT_FISH, GROUPED_X_CYCLES, CHUTE_REMOTE_PAIR
  { puzzle: '.84..2....1...7..87...4..6.....5.4..9..6.1..5..8.7.....9..2...11..7........3..87.', solutions: 6 }, // FINNED_SWORDFISH, GROUPED_NICE_LOOP, WXYZ_WING, XYZ_WING, SASHIMI_SWORDFISH, FINNED_X_WING, ALS_XZ, EMPTY_RECTANGLE, NICE_LOOP, ALS_XY_WING
  { puzzle: '34..9.............7.6.3.4..69.......47..52.........1.8....1..3...75...9..85..9...', solutions: 89 }, // SASHIMI_X_WING, ALS_XY_CHAIN
  { puzzle: '.5........6.8.4..9..9..1....2.35....5...6.....3....6..241....7.....7......59...21', solutions: 88 }, // AIC, NISHIO_FORCING_CHAIN
  { puzzle: '6.....72.....49.....13...........1.5.86.......4.....9..54..23....3..8......75..6.', solutions: 2 }, // SUE_DE_COQ
  { puzzle: '....3..2.....9.54846......9.3.9..8.....5.3.....6.41.5.9......83783.5.....4..8....', solutions: 13 }, // W_WING, WXYZ_WING, TWO_STRING_KITE, TURBOT_FISH, EMPTY_RECTANGLE, FINNED_SWORDFISH, X_CHAIN, SIMPLE_COLORS, MEDUSA_3D
  { puzzle: '...3...5.65..7.2.9..2..9...367.....2...2.7...1.....786..68..4..9.5.4..63.....3...', solutions: 3 }, // JELLYFISH, SKYSCRAPER
  { puzzle: '...17.5.....5...616.........92..3.....1.....63......9..3.....7..4..12..8...9..4..', solutions: 307 }, // AIC_ALS, AIC_GROUPED, ALIGNED_PAIR_EXCLUSION, CELL_FORCING_CHAIN
  { puzzle: '.3...2........7...8.29..4...8.3...6.57.....43.1...4.8...5..87.1..15.3......2...5.', solutions: 9 }, // TWO_STRING_KITE, EMPTY_RECTANGLE, TURBOT_FISH, SASHIMI_SWORDFISH, MULTI_COLORS, XY_CHAIN
  { puzzle: '..8..1..........34..1....6..5..8...6..965.7......2.8.........2..4.2.3..93...1....', solutions: 15 }, // ALS_XZ, DIGIT_FORCING_CHAIN
  { puzzle: '4.3..612..5...1.3.....7....5.9........7.1.8........4.2....8.2...8.1...7..769..3.1', solutions: 6 }, // W_WING, FINNED_SWORDFISH, XYZ_WING, WXYZ_WING, NICE_LOOP, SWORDFISH, CHUTE_REMOTE_PAIR, MEDUSA_3D, XY_CHAIN, ALS_XY_WING
  { puzzle: '.....9..16.9...3...1...7.2..4...1..22..7.8......9...7..9.5...8...4...2.57..1.....', solutions: 11 }, // DEATH_BLOSSOM
  { puzzle: '.2.....67..5......7.....5.......89...6.93..18....16..441.......5.9.2............3', solutions: 355 }, // FORCING_NET
  { puzzle: '.5......77.8..4...6..2......87........3..7.48...12...9.........829.4....5....93..', solutions: 230 } // UNIT_FORCING_CHAIN
];
/** what those puzzles must keep reaching, or they no longer test what they were picked for */
const ADVANCED_MUST: Tech[] = [
  'JELLYFISH', 'REMOTE_PAIR', 'CHUTE_REMOTE_PAIR', 'SKYSCRAPER', 'TWO_STRING_KITE', 'TURBOT_FISH', 'EMPTY_RECTANGLE',
  'W_WING', 'XY_WING', 'XYZ_WING', 'WXYZ_WING', 'FINNED_X_WING', 'SASHIMI_X_WING', 'FINNED_SWORDFISH', 'SASHIMI_SWORDFISH',
  'FINNED_JELLYFISH', 'SUE_DE_COQ', 'SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D', 'X_CHAIN', 'GROUPED_X_CYCLES', 'XY_CHAIN',
  'NICE_LOOP', 'GROUPED_NICE_LOOP', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'AIC', 'AIC_GROUPED', 'AIC_ALS', 'DEATH_BLOSSOM',
  'ALIGNED_PAIR_EXCLUSION', 'DIGIT_FORCING_CHAIN', 'NISHIO_FORCING_CHAIN', 'CELL_FORCING_CHAIN', 'UNIT_FORCING_CHAIN', 'FORCING_NET'
];

/** puzzles with several solutions on which, turned on, the uniqueness family is false: all eleven kinds between them */
const FALSE_UNIQUENESS = [
  { puzzle: '...5.8....2....3.9...6...4.4....3.851..8.....57............4......96.....597..62.', solutions: 14 }, // UNIQUENESS_1, AVOIDABLE_RECTANGLE_2
  { puzzle: '.31...4.7....5..3.9....6...2..3..8.6.8.....7.6.5..1..2...2....1.1..7....8.6...72.', solutions: 5 }, // UNIQUENESS_6, UNIQUENESS_1, BUG_PLUS_1
  { puzzle: '2..78....7....63.......398.3...2...9..23....469..1....8..4.......5.7..........2.3', solutions: 4 }, // EXTENDED_RECTANGLE, AVOIDABLE_RECTANGLE_1
  { puzzle: '564..1......5..1.679.......8..75.....4.9.2.3.....36..5.......634.3.........8..452', solutions: 12 }, // UNIQUENESS_4, HIDDEN_RECTANGLE, EXTENDED_RECTANGLE, BUG_PLUS_1
  { puzzle: '.4.6..1...8.......73.1..29....24..51..5...9..16..53....93....14.......6...8..5.7.', solutions: 5 }, // UNIQUENESS_2, BUG_PLUS_1
  { puzzle: '......23..9.4.3.6.2..........7.9....96.....75....1.8..........6.3.6.4.5..162.8...', solutions: 5 }, // UNIQUENESS_3, BUG_PLUS_1
  { puzzle: '.7.5...4...9.83...3.2.6....13...8..9....5....6..3...21....7.2.5...49.7.......5.1.', solutions: 6 } // UNIQUENESS_5
];

/**
 * A tridagon in a position with twelve solutions, built from a full grid
 * (no natural puzzle needs one): the eleven pattern cells keep only the
 * trio 1 5 9, one per row and column in each of four boxes, and the
 * guardian r6c3 keeps the trio and 2. The trio cannot fill all twelve, so
 * the guardian is 2 in every solution, which is what the step claims.
 */
const TRIDAGON_POSITION = {
  values: '473862195...473628286...347......764......23........8.......4.2.......73......8.6',
  trio: [1, 5, 9],
  pattern: [28, 32, 36, 39, 49, 55, 58, 63, 66, 74, 77],
  guardian: 47,
  guardianDigits: [1, 2, 5, 9],
  solutions: 12
};

/** the Exocet example puzzle (src/content/examples.json) less two clues: played without uniqueness, Scan lists an Exocet */
const EXOCET_MULTI = { puzzle: '..3.1.47.8..9.7..1.7.........21..3.4.........3....27.........3.1..5.6..9.98.7.1..', solutions: 140 };

/**
 * Moves on puzzles with several solutions that the engine's own order
 * credits through a uniqueness technique, though some solution contradicts
 * them; without uniqueness they get no credit.
 */
const CREDIT_CONTRAST = [
  { puzzle: '.572...1.4...13....3.....49.1...4..8.........5..8...7.94.....67...65...3.6...752.', cell: 63, digit: 2, placed: true }, // HIDDEN_RECTANGLE
  { puzzle: '......1.7..6...84992.......75.6.....4..2.8..5.....7.68.......34684...9..3.7..9...', cell: 3, digit: 5, placed: false } // UNIQUENESS_1
];

/**
 * A digit of another solution, entered on a puzzle with several: with
 * uniqueness on, Check proves it wrong through a uniqueness technique
 * against the solution it was given (`solution`); with uniqueness off it
 * has nothing to say.
 */
const PROOF_CONTRAST = [
  { puzzle: '61....3..7......69...4....15...6....28.3..1...9..1.5.68..7.2..........3......9.8.', solution: '612597348745183269938426751571964823286375194394218576863742915429851637157639482', cell: 18, wrong: 3 }, // UNIQUENESS_3
  { puzzle: '......1.7..6...84992.......75.6.....4..2.8..5.....7.68.......34684...9..3.7..9...', solution: '843596127576132849921784653758643291469218375132957468295861734684375912317429586', cell: 4, wrong: 5 } // UNIQUENESS_1
];

describe('the oracle, proven before it is trusted', () => {
  it('finds exactly one solution to a proper puzzle, keeping the rules and the clues', () => {
    for (const p of [...HARD_PUZZLES, CTC]) {
      const g = parseGrid(p)!;
      const sols = allSolutions(g.values, undefined, 2)!;
      expect(sols, p).toHaveLength(1);
      expect(isValidSolution(sols[0])).toBe(true);
      for (let i = 0; i < 81; i++) if (p[i] !== '.') expect(sols[0][i]).toBe(Number(p[i]));
    }
  });

  it('counts 2^k for k deadly rectangles emptied from a full grid, as a naive count does', () => {
    // a deadly rectangle: two rows of one band, two columns of different
    // stacks, a b / b a at the corners. Emptied, only a and b fit, two ways;
    // k of them sharing no row and no column swap independently
    const rnd = mulberry32(7);
    let tried = 0;
    for (let n = 0; n < 40 && tried < 3; n++) {
      const full = generateFullGrid(rnd).values;
      expect(isValidSolution(full)).toBe(true);
      const rects: number[][] = [];
      const usedRows = new Set<number>();
      const usedCols = new Set<number>();
      for (let r1 = 0; r1 < 9; r1++) {
        for (let r2 = r1 + 1; r2 < 9 && Math.floor(r2 / 3) === Math.floor(r1 / 3); r2++) {
          for (let c1 = 0; c1 < 9; c1++) {
            for (let c2 = c1 + 1; c2 < 9; c2++) {
              if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
              if ([r1, r2].some((r) => usedRows.has(r)) || [c1, c2].some((c) => usedCols.has(c))) continue;
              const [a, b] = [full[r1 * 9 + c1], full[r1 * 9 + c2]];
              if (full[r2 * 9 + c1] !== b || full[r2 * 9 + c2] !== a) continue;
              rects.push([r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2]);
              usedRows.add(r1).add(r2);
              usedCols.add(c1).add(c2);
            }
          }
        }
      }
      if (rects.length < 2) continue;
      tried++;
      for (let k = 1; k <= Math.min(rects.length, 3); k++) {
        const values = new Uint8Array(full);
        for (const rect of rects.slice(0, k)) for (const c of rect) values[c] = 0;
        const sols = solutionsAt(values, undefined)!;
        expect(sols.length).toBe(2 ** k);
        expect(naiveCount(values)).toBe(2 ** k);
        // a cap one short of the count is a cap passed: no list, rather than a short one
        expect(allSolutions(values, undefined, 2 ** k - 1)).toBeNull();
        // and what the solutions agree on: each corner of an emptied rectangle
        // is a or b, so no digit is forced there; every other cell is the full grid's
        const truth = truthOf(sols);
        const pairOf = new Map<number, number>();
        for (const rect of rects.slice(0, k)) for (const c of rect) pairOf.set(c, bit(full[rect[0]]) | bit(full[rect[1]]));
        for (let c = 0; c < 81; c++) {
          const pair = pairOf.get(c);
          expect(truth.forced[c], cellName(c)).toBe(pair ? 0 : full[c]);
          expect(truth.seen[c], cellName(c)).toBe(pair ?? bit(full[c]));
        }
      }
    }
    expect(tried).toBeGreaterThan(0);
  });

  it('agrees with a naive count on full grids with up to 54 cells emptied', () => {
    const rnd = mulberry32(11);
    const counts: number[] = [];
    for (const k of [5, 25, 40, 45, 50, 52, 53, 54, 54]) {
      const values = new Uint8Array(generateFullGrid(rnd).values);
      const cells = Array.from({ length: 81 }, (_, i) => i);
      for (let j = 0; j < k; j++) values[cells.splice(Math.floor(rnd() * cells.length), 1)[0]] = 0;
      const sols = allSolutions(values, undefined, 100000)!;
      expect(sols.length, `${k} emptied`).toBe(naiveCount(values));
      expect(new Set(sols.map((s) => s.join(''))).size).toBe(sols.length);
      expect(sols.every((s) => isValidSolution(s) && s.every((d, i) => !values[i] || d === values[i]))).toBe(true);
      counts.push(sols.length);
    }
    // not a comparison of ones: some of these grids have many solutions
    expect(Math.max(...counts)).toBeGreaterThan(50);
  });

  it('honours candidate masks, and its yes-or-no questions agree with the full list', () => {
    const rnd = mulberry32(13);
    let checked = 0;
    for (let n = 0; n < 30 && checked < 4; n++) {
      const values = new Uint8Array(generateFullGrid(rnd).values);
      const cells = Array.from({ length: 81 }, (_, i) => i);
      for (let j = 0; j < 40; j++) values[cells.splice(Math.floor(rnd() * cells.length), 1)[0]] = 0;
      const all = allSolutions(values, undefined, 5000);
      if (!all || all.length < 3) continue;
      checked++;
      // masks that drop a random third of the candidates
      const masks = new Uint16Array(81);
      for (let i = 0; i < 81; i++) masks[i] = values[i] ? 0 : 0x1ff & ~(Math.floor(rnd() * 512) & Math.floor(rnd() * 512));
      const fits = (s: Uint8Array) => s.every((d, i) => values[i] !== 0 || (masks[i] & bit(d)) !== 0);
      const expected = all.filter(fits).map((s) => s.join('')).sort();
      const got = allSolutions(values, masks, 5000)!.map((s) => s.join('')).sort();
      expect(got).toEqual(expected);
      const truth = truthOf(all);
      for (let i = 0; i < 81; i++) {
        if (values[i]) continue;
        for (let d = 1; d <= 9; d++) {
          expect(hasSolution(values, undefined, i, d)).toBe((truth.seen[i] & bit(d)) !== 0);
          expect(hasSolutionWithout(values, undefined, i, d)).toBe(all.some((s) => s[i] !== d));
        }
      }
    }
    expect(checked).toBe(4);
    // past the cap it says so instead of guessing
    expect(allSolutions(new Uint8Array(81), undefined, CAP)).toBeNull();
    // values that already clash have no solution, however open the rest
    const clash = parseGrid(CTC)!.values.slice();
    clash[clash.indexOf(0, 1)] = clash[0];
    expect(clash[0]).toBeGreaterThan(0);
    expect(allSolutions(clash, undefined, CAP)).toEqual([]);
    expect(hasSolution(clash, undefined)).toBe(false);
    expect(naiveCount(clash)).toBe(0);
    // nor however full: a whole grid with two cells of its first row swapped
    // clashes in two columns, and with no cell left open, no search would
    // ever look at a house; only the check of the values themselves says no
    const swapped = new Uint8Array(generateFullGrid(mulberry32(17)).values);
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(isValidSolution(swapped)).toBe(false);
    expect(allSolutions(swapped, undefined, CAP)).toEqual([]);
    expect(hasSolution(swapped, undefined)).toBe(false);
    expect(naiveCount(swapped)).toBe(0);
    // while the grid as it was is its own one solution
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    expect(solutionsAt(swapped, undefined)!.map((s) => s.join(''))).toEqual([swapped.join('')]);
  });

  it('and the check built on it catches a false step', () => {
    const g = parseGrid(CTC)!;
    const truth = truthAt(g)!;
    const cell = g.values.indexOf(0);
    const right = truth.forced[cell];
    const other = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => d !== right && g.cands[cell] & bit(d))!;
    const fake = (placements: Step['placements'], eliminations: Step['eliminations']): Step => ({ tech: 'NAKED_PAIR', placements, eliminations, description: 'made up' });
    expect(falsehoods(fake([], [{ cell, digit: right }]), g, truth)).toHaveLength(1);
    expect(falsehoods(fake([{ cell, digit: other }], []), g, truth)).toHaveLength(1);
    expect(falsehoods(fake([{ cell, digit: right }], [{ cell, digit: other }]), g, truth)).toEqual([]);
    expect(falsehoods(findNextStep(g, NO_UNIQUENESS_ORDER)!, g, truth)).toEqual([]);
    // and on a puzzle with two solutions, where a step that leans on
    // uniqueness would be caught: a digit one solution has and the other
    // not is false to place and false to remove, whichever solution it is from
    const m = parseGrid(ADVANCED_MULTI[0].puzzle)!;
    const [s0, s1] = solutionsAt(m.values, m.cands)!;
    const both = truthAt(m)!;
    expect(both.count).toBe(2);
    const split = [...Array(81).keys()].filter((c) => s0[c] !== s1[c]);
    expect(split.length).toBeGreaterThanOrEqual(4);
    for (const c of split) {
      for (const s of [s0, s1]) {
        expect(falsehoods(fake([{ cell: c, digit: s[c] }], []), m, both), cellName(c)).toHaveLength(1);
        expect(falsehoods(fake([], [{ cell: c, digit: s[c] }]), m, both), cellName(c)).toHaveLength(1);
      }
    }
    // where they agree, placing their digit is true, and so is removing any other candidate
    for (const c of [...Array(81).keys()].filter((c) => !m.values[c] && s0[c] === s1[c])) {
      const others = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== s0[c] && m.cands[c] & bit(d));
      expect(falsehoods(fake([{ cell: c, digit: s0[c] }], others.map((digit) => ({ cell: c, digit }))), m, both), cellName(c)).toEqual([]);
    }
  });
});

describe('without uniqueness, on proper puzzles', () => {
  it('every step of random generated puzzles is true, and none is from the uniqueness family', () => {
    const rnd = mulberry32(2026);
    const used = new Set<Tech>();
    for (let n = 0; n < 40; n++) {
      const g = seeded(rnd, () => generatePuzzle(n % 2 ? 'rotational' : 'none'));
      for (const t of playChecked(g, NO_UNIQUENESS_ORDER, `generated ${gridToString(g)}`, n < 8 ? 1 : 0)) used.add(t);
    }
    expect(used.size).toBeGreaterThan(10);
  });

  it('so is every step on hard puzzles and on puzzles the engine solves with uniqueness, Steps included', () => {
    const used = new Set<Tech>();
    for (const p of [...HARD_PUZZLES, ...UNIQUENESS_PUZZLES]) {
      for (const t of playChecked(parseGrid(p)!, NO_UNIQUENESS_ORDER, p)) used.add(t);
    }
    // the Steps dialog: the rating's path in the player's order, brute force included where it
    // stalls (the last hard puzzle does, once, and the path goes on past it)
    let pastBruteForce = 0;
    for (const p of [CTC, ...UNIQUENESS_PUZZLES.slice(0, 3), HARD_PUZZLES[5]]) {
      const truth = truthAt(parseGrid(p)!)!;
      const g = parseGrid(p)!;
      let brute = false;
      for (const [i, step] of ratePuzzle(p, hintOrder(false))!.steps.entries()) {
        expect(isUniqueness(step.tech), describeStep(p, i, step, g)).toBe(false);
        expect(falsehoods(step, g, truth), describeStep(p, i, step, g)).toEqual([]);
        if (brute && step.tech !== 'BRUTE_FORCE') pastBruteForce++;
        brute ||= step.tech === 'BRUTE_FORCE';
        applyStep(g, step);
      }
    }
    expect(pastBruteForce).toBeGreaterThan(0);
    // these puzzles do need uniqueness in the engine's own order
    expect(UNIQUENESS_PUZZLES.every((p) => ratePuzzle(p)!.steps.some((s) => isUniqueness(s.tech)))).toBe(true);
    expect([...used].some((t) => TECHS[t].category === 'Last Resort')).toBe(true);
  });
});

describe('without uniqueness, on puzzles with several solutions (nothing may lean on uniqueness)', () => {
  it('every step holds in every solution of generated puzzles with clues taken away', () => {
    const rnd = mulberry32(99);
    const used = new Set<Tech>();
    let puzzles = 0;
    for (let n = 0; n < 40 && puzzles < 4; n++) {
      const proper = gridToString(seeded(rnd, () => generatePuzzle(n % 2 ? 'rotational' : 'none')));
      const p = withoutClues(proper, 1 + (n % 3), rnd);
      const sols = allSolutions(parseGrid(p)!.values, undefined, CAP);
      if (!sols || sols.length < 2) continue;
      puzzles++;
      for (const t of playChecked(parseGrid(p)!, NO_UNIQUENESS_ORDER, `${p} (${sols.length} solutions)`, 0, 1)) used.add(t);
    }
    expect(puzzles).toBe(4);
    expect([...used].some((t) => TECHS[t].category === 'Last Resort')).toBe(true);
  });

  it('and on puzzles chosen to reach the advanced techniques, Scan included, early and just before the solver stops', () => {
    const used = new Set<Tech>();
    for (const { puzzle, solutions } of ADVANCED_MULTI) {
      const g = parseGrid(puzzle)!;
      expect(allSolutions(g.values, undefined, CAP)!.length, puzzle).toBe(solutions);
      for (const t of playChecked(g, NO_UNIQUENESS_ORDER, puzzle, 1, 1)) used.add(t);
    }
    const advanced = [...used].filter((t) => !['Singles', 'Intersections', 'Subsets'].includes(TECHS[t].category));
    // eslint-disable-next-line no-console
    console.info('advanced techniques checked on several-solution puzzles:', advanced.sort().join(', '));
    for (const t of ADVANCED_MUST) expect(used.has(t), t).toBe(true);
  });

  it('and the rare patterns, on positions with several solutions or far more, claim only what every solution keeps, unlike uniqueness', () => {
    // a tridagon: every solution listed, the step and the whole Scan judged against them
    {
      const { values, trio, pattern, guardian, guardianDigits, solutions } = TRIDAGON_POSITION;
      const g = parseGrid(values)!;
      const T = trio.reduce((m, d) => m | bit(d), 0);
      for (const c of pattern) g.cands[c] &= T;
      g.cands[guardian] &= guardianDigits.reduce((m, d) => m | bit(d), 0);
      expect(pattern.every((c) => g.cands[c] === T)).toBe(true);
      const truth = truthAt(g)!;
      expect(truth.count).toBe(solutions);
      const step = findStep('TRIDAGON', g)!;
      expect(step?.tech).toBe('TRIDAGON');
      expect(step.eliminations.map(({ cell, digit }) => `${digit}${cellName(cell)}`).sort()).toEqual(trio.map((d) => `${d}${cellName(guardian)}`));
      expect(falsehoods(step, g, truth)).toEqual([]);
      const listed = findAllSteps(g, NO_UNIQUENESS_ORDER);
      expect(listed.map((s) => s.tech)).toContain('TRIDAGON');
      for (const s of listed) {
        expect(falsehoods(s, g, truth), describeStep('tridagon position (scan)', 0, s, g)).toEqual([]);
        judgedOnSeveral.add(s.tech);
      }
    }
    // an Exocet: played without uniqueness, every step checked, until Scan's Exocet appears and is checked too
    {
      const g = parseGrid(EXOCET_MULTI.puzzle)!;
      const truth = truthAt(g)!;
      expect(truth.count).toBe(EXOCET_MULTI.solutions);
      let exocet: Step | null = null;
      for (let i = 0; i < 40 && !exocet; i++) {
        exocet = findStep('EXOCET', g);
        if (exocet) break;
        const step = findNextStep(g, NO_UNIQUENESS_ORDER)!;
        expect(falsehoods(step, g, truth), describeStep(EXOCET_MULTI.puzzle, i, step, g)).toEqual([]);
        judgedOnSeveral.add(step.tech);
        applyStep(g, step);
      }
      expect(exocet?.tech, 'the fixture no longer reaches an Exocet').toBe('EXOCET');
      expect(exocet!.eliminations.length).toBeGreaterThan(0);
      expect(falsehoods(exocet!, g, truth), describeStep(EXOCET_MULTI.puzzle, -1, exocet!, g)).toEqual([]);
      judgedOnSeveral.add('EXOCET');
    }
    // far past the cap: the synthetic positions of tests/synthetic.test.ts, almost empty
    // grids with solutions beyond counting, so the oracle is asked yes or no: a solution
    // with the removed digit there, or without the placed one
    const fireworks = (() => {
      const g = emptyGrid();
      for (const d of [1, 2, 3]) {
        for (let col = 3; col < 9; col++) if (col !== 5) g.cands[col] &= ~bit(d);
        for (let row = 3; row < 9; row++) if (row !== 5) g.cands[row * 9] &= ~bit(d);
      }
      return g;
    })();
    const rectangle = (() => {
      const g = emptyGrid();
      g.cands[0] = bit(1) | bit(2);
      g.cands[3] = g.cands[9] = g.cands[12] = bit(1) | bit(2) | bit(7);
      return g;
    })();
    const falseIn = (g: Grid, step: Step) => [
      ...step.eliminations.filter(({ cell, digit }) => hasSolution(g.values, g.cands, cell, digit)),
      ...step.placements.filter(({ cell, digit }) => hasSolutionWithout(g.values, g.cands, cell, digit))
    ];
    // both grids have solutions, more than the cap: the yes-or-no answers below are not vacuous
    for (const g of [fireworks, rectangle]) {
      expect(hasSolution(g.values, g.cands)).toBe(true);
      expect(allSolutions(g.values, g.cands, CAP)).toBeNull();
    }
    const step = findStep('FIREWORKS', fireworks)!;
    expect(step?.tech).toBe('FIREWORKS');
    expect(step.eliminations.length).toBeGreaterThan(0);
    expect(falseIn(fireworks, step)).toEqual([]);
    judgedOnSeveral.add('FIREWORKS');
    // the same question to a unique rectangle: on a grid with many solutions it is false
    const ur = findStep('UNIQUENESS_5', rectangle)!;
    expect(ur.tech).toBe('UNIQUENESS_5');
    expect(falseIn(rectangle, ur).length).toBeGreaterThan(0);
  });

  it('between them, every technique of the order without uniqueness was judged on a position with several solutions', () => {
    // read from the tests above, in this describe: run with them
    expect(judgedOnSeveral.size, 'run this with the tests above it').toBeGreaterThan(0);
    // brute force has no finder (the catalogue test, below): no hint or Scan can be one
    const findable = NO_UNIQUENESS_ORDER.filter((t) => t !== 'BRUTE_FORCE');
    // a technique added to the order, or one a fixture change stops reaching,
    // must be judged where uniqueness would show, or named here with the reason
    const NOT_JUDGED: Tech[] = [];
    expect(findable.filter((t) => !judgedOnSeveral.has(t))).toEqual(NOT_JUDGED);
  });
});

/**
 * The clock justify and proveWrong read stands still: their time budgets
 * (300 and 120 ms) never run out and only their step budgets bound them,
 * so a credit or a proof refused here is refused for want of a true path,
 * not of time, and one found is found on a slow machine too
 */
const stillClock = () => vi.spyOn(performance, 'now').mockReturnValue(0);

describe('the credit of a move and the why-not proofs, without uniqueness', () => {
  it('credits no move that some solution contradicts, and credits true moves truly', () => {
    stillClock();
    let credited = 0;
    let refused = 0;
    for (const { puzzle } of ADVANCED_MULTI.slice(0, 3)) {
      const g = parseGrid(puzzle)!;
      const truth = truthAt(g)!;
      const open = [...Array(81).keys()].filter((c) => !g.values[c] && !truth.forced[c]);
      expect(open.length, `${puzzle}: cells where the solutions differ`).toBeGreaterThanOrEqual(2);
      for (const c of open.slice(0, 2)) {
        // a digit one solution has there and another not: placing it and removing it are both false
        const d = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((x) => truth.seen[c] & bit(x))!;
        expect(bitCount(truth.seen[c])).toBeGreaterThan(1);
        for (const placed of [true, false]) {
          const j = justify(g, { cell: c, digit: d, placed }, undefined, NO_UNIQUENESS_ORDER);
          expect(j.tech, `${puzzle}: ${placed ? 'placing' : 'removing'} ${d} in ${cellName(c)} credited`).toBeNull();
          refused++;
        }
      }
      // a candidate no solution has: if credited, by true steps without uniqueness
      const dead = [...Array(81).keys()].flatMap((c) =>
        [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !g.values[c] && g.cands[c] & bit(d) && !(truth.seen[c] & bit(d))).map((d) => ({ cell: c, digit: d, placed: false }))
      );
      for (const move of dead.slice(0, 3)) {
        const j = justify(g, move, undefined, NO_UNIQUENESS_ORDER);
        if (j.tech) credited++;
        const w = cloneGrid(g);
        for (const [i, step] of j.steps.entries()) {
          expect(isUniqueness(step.tech)).toBe(false);
          expect(falsehoods(step, w, truth), describeStep(puzzle, i, step, w)).toEqual([]);
          applyStep(w, step);
        }
      }
    }
    // every false move was put to it, and the true moves were credited, by paths the loop above replayed
    expect(refused).toBe(12);
    expect(credited).toBeGreaterThan(0);
  });

  it('refuses the credit that uniqueness gives a false move', () => {
    stillClock();
    for (const { puzzle, cell, digit, placed } of CREDIT_CONTRAST) {
      const g = parseGrid(puzzle)!;
      const truth = truthAt(g)!;
      expect(truth.count).toBeGreaterThan(1);
      // false: some solution has the digit elsewhere, or has it there
      expect(placed ? truth.forced[cell] !== digit : (truth.seen[cell] & bit(digit)) !== 0).toBe(true);
      const move = { cell, digit, placed };
      const on = justify(g, move, undefined, SOLVE_ORDER);
      expect(on.tech, `${puzzle}: credited with uniqueness on`).not.toBeNull();
      expect(on.steps.some((s) => isUniqueness(s.tech))).toBe(true);
      expect(justify(g, move, undefined, NO_UNIQUENESS_ORDER).tech, `${puzzle}: credited with uniqueness off`).toBeNull();
    }
  });

  it('the worker that credits moves leaves uniqueness out when told to', () => {
    stillClock();
    // the CTC position where the engine's cheapest step is a unique rectangle
    const g = parseGrid(CTC)!;
    const basic = SOLVE_ORDER.filter((t) => ['Singles', 'Intersections', 'Subsets'].includes(TECHS[t].category));
    for (let s = findNextStep(g, basic); s; s = findNextStep(g, basic)) applyStep(g, s);
    const ur = findNextStep(g)!;
    expect(ur.tech).toBe('UNIQUENESS_3');
    const e = ur.eliminations[0];
    const values = gridToString(g);
    const cands = Array.from(g.cands, (m, i) => (g.values[i] ? 0 : m));
    const ask = (noUniqueness: boolean) => {
      const out: WorkerResponse[] = [];
      serveJustify({ id: 1, kind: 'justify', values, cands, move: { cell: e.cell, digit: e.digit, placed: false }, noUniqueness }, (m) => out.push(m));
      return (out[0] as Extract<WorkerResponse, { type: 'justified' }>).tech;
    };
    expect(ask(false)).toBe('UNIQUENESS_3');
    const off = ask(true);
    expect(off === null || !isUniqueness(off)).toBe(true);
  });

  it('proves a wrong digit without uniqueness where uniqueness would have been the proof, and truly', () => {
    stillClock();
    for (const { puzzle, values, cell, wrong, on } of PROOF_CASES) {
      const truth = truthAt(parseGrid(puzzle)!)!;
      expect(truth.count).toBe(1);
      const solution = Array.from({ length: 81 }, (_, i) => truth.forced[i]).join('');
      const placed = values.split('').map((ch) => (ch === '.' ? 0 : Number(ch)));
      const cells = cellsOf(puzzle, placed);
      expect(cells[cell].value).toBe(wrong);
      useSettings.getState().set({ useUniqueness: true });
      const [withU] = proveWrong(cells, solution, [cell]);
      expect(withU.tech).toBe(on);
      useSettings.getState().set({ useUniqueness: false });
      const [proof] = proveWrong(cells, solution, [cell]);
      expect(proof.useUniqueness).toBe(false);
      expect(proof.tech, puzzle).not.toBeNull();
      // replayed from the board the proof starts from: every step true, none from the family, and it proves the point
      const w = parseGrid(cells.map((c, i) => (c.value && c.value === truth.forced[i] ? String(c.value) : '.')).join(''))!;
      for (const [i, step] of proof.steps.entries()) {
        expect(isUniqueness(step.tech), describeStep(puzzle, i, step, w)).toBe(false);
        expect(falsehoods(step, w, truth), describeStep(puzzle, i, step, w)).toEqual([]);
        applyStep(w, step);
      }
      if (proof.places) expect(w.values[cell]).toBe(truth.forced[cell]);
      else expect(w.values[cell] !== 0 ? w.values[cell] !== wrong : (w.cands[cell] & bit(wrong)) === 0).toBe(true);
    }
  });

  it('never proves wrong a digit that another solution has', () => {
    stillClock();
    let judged = 0;
    for (const { puzzle } of ADVANCED_MULTI.slice(0, 3)) {
      const g = parseGrid(puzzle)!;
      const sols = solutionsAt(g.values, undefined)!;
      const truth = truthOf(sols);
      // three cells where the solutions differ, each given a digit of another solution
      const open = [...Array(81).keys()].filter((c) => !g.values[c] && !truth.forced[c]).slice(0, 3);
      expect(open, `${puzzle}: cells where the solutions differ`).toHaveLength(3);
      const placed = new Uint8Array(81);
      for (const c of open) placed[c] = sols.find((s) => s[c] !== sols[0][c])![c];
      for (const c of open) expect(placed[c] !== sols[0][c] && sols.some((s) => s[c] === placed[c])).toBe(true);
      useSettings.getState().set({ useUniqueness: false });
      const proofs = proveWrong(cellsOf(puzzle, placed), sols[0].join(''), open);
      expect(proofs.map((p) => p.cell)).toEqual(open);
      for (const proof of proofs) {
        expect(proof.tech, `${puzzle}: ${proof.wrong} in ${cellName(proof.cell)} proved wrong`).toBeNull();
        expect(proof.conflict).toBeNull();
        judged++;
      }
    }
    expect(judged).toBe(9);
  });

  it('where uniqueness would prove such a digit wrong, it has no proof once uniqueness is off', () => {
    stillClock();
    for (const { puzzle, solution, cell, wrong } of PROOF_CONTRAST) {
      const sols = solutionsAt(parseGrid(puzzle)!.values, undefined)!;
      expect(sols.length).toBeGreaterThan(1);
      expect(sols.map((s) => s.join(''))).toContain(solution);
      // the digit belongs to another solution
      expect(sols.some((s) => s[cell] === wrong)).toBe(true);
      const placed = new Uint8Array(81);
      placed[cell] = wrong;
      const cells = cellsOf(puzzle, placed);
      useSettings.getState().set({ useUniqueness: true });
      const [on] = proveWrong(cells, solution, [cell]);
      expect(on.tech, `${puzzle}: proved with uniqueness on`).not.toBeNull();
      expect(on.steps.some((s) => isUniqueness(s.tech))).toBe(true);
      useSettings.getState().set({ useUniqueness: false });
      const [off] = proveWrong(cells, solution, [cell]);
      expect(off.tech, `${puzzle}: ${wrong} in ${cellName(cell)} proved wrong with uniqueness off`).toBeNull();
      expect(off.conflict).toBeNull();
    }
  });
});

describe('hints in the game, without uniqueness, from the player\'s own marks', () => {
  it('every hint is true and none from the family, from the start to the end of a puzzle that needs uniqueness in the engine\'s order', () => {
    // a device left out of the counts sends nothing (src/state/telemetry.ts)
    useSettings.getState().set({ dontCount: true });
    for (const p of [UNIQUENESS_PUZZLES[1], UNIQUENESS_PUZZLES[10]]) {
      const truth = truthAt(parseGrid(p)!)!;
      expect(allSolutions(parseGrid(p)!.values, undefined, CAP)?.length).toBe(truth.count);
      useSettings.getState().set({ useUniqueness: false });
      useGame.getState().startGame(p, 0, 'Hard');
      useGame.setState({ selection: [], mode: 'digit' });
      // the player's own marks, complete: Fill writes them and declares them exhaustive
      useGame.getState().fillCandidates();
      expect(useGame.getState().markContract).toBe('exhaustive');
      let hints = 0;
      for (let i = 0; i < 200 && !useGame.getState().won; i++) {
        const s = useGame.getState();
        const position = contractGrid(s.cells, s.autoCandidates, s.markContract);
        const expected = findNextStep(position, NO_UNIQUENESS_ORDER);
        s.requestHint();
        const hint = useGame.getState().hint;
        // the guard against unsound hints (stepMatchesSolution) never had to hide one
        expect(hint, `${p}: the solver found ${expected?.tech}, the game showed nothing: ${useGame.getState().notice}`).toEqual(expected);
        if (!hint) break;
        hints++;
        expect(isUniqueness(hint.tech)).toBe(false);
        expect(falsehoods(hint, position, truth), describeStep(p, i, hint, position)).toEqual([]);
        useGame.getState().applyHint();
      }
      // to the end, where the solver can go without uniqueness
      expect(hints).toBeGreaterThan(0);
      expect(useGame.getState().won, p).toBe(ratePuzzle(p, NO_UNIQUENESS_ORDER)!.solvable);
    }
  });
});

describe('with uniqueness on, the same check has teeth', () => {
  it('finds the uniqueness family false on puzzles with several solutions, and nothing else', () => {
    const fired = new Set<Tech>();
    for (const { puzzle, solutions } of FALSE_UNIQUENESS) {
      const g = parseGrid(puzzle)!;
      let truth = truthAt(g)!;
      expect(truth.count, puzzle).toBe(solutions);
      let falseHere = 0;
      for (let i = 0; i < 400 && !isSolved(g); i++) {
        const step = findNextStep(g, SOLVE_ORDER);
        if (!step) break;
        const wrong = falsehoods(step, g, truth);
        if (!isUniqueness(step.tech)) expect(wrong, describeStep(puzzle, i, step, g)).toEqual([]);
        applyStep(g, step);
        if (wrong.length) {
          falseHere++;
          fired.add(step.tech);
          // the step threw solutions away: ask the oracle again
          const now = allSolutions(g.values, g.cands, CAP)!;
          if (!now.length) break;
          truth = truthOf(now);
        }
      }
      expect(falseHere, puzzle).toBeGreaterThan(0);
    }
    // eslint-disable-next-line no-console
    console.info('uniqueness techniques false on several-solution puzzles:', [...fired].sort().join(', '));
    // every kind of the family the order leaves out, each caught false
    expect([...fired].sort()).toEqual(SOLVE_ORDER.filter(isUniqueness).sort());
  });
});

describe('the catalogue', () => {
  it('names no technique outside the uniqueness family that leans on one solution, but brute force', () => {
    const LEANS = /second solution|exactly one solution|unique solution|proper puzzle|uniqueness|unique rectangle|deadly|avoidable|\bBUG\b|universal grave/i;
    const leaning = (Object.keys(TECHS) as Tech[]).filter((t) => {
      const d = TECH_DOCS[t];
      return LEANS.test([TECHS[t].name, d.what, d.why, d.spot, ...d.aka].join(' '));
    });
    // the words find the whole family...
    expect((Object.keys(TECHS) as Tech[]).filter(isUniqueness).filter((t) => !leaning.includes(t))).toEqual([]);
    // ...and outside it only brute force
    expect(leaning.filter((t) => !isUniqueness(t))).toEqual(['BRUTE_FORCE']);
    // which no hint can be: it has no finder, so only the Steps dialog's
    // fallback places it, from the one solution
    const g = parseGrid(CTC)!;
    expect(findStep('BRUTE_FORCE', g)).toBeNull();
    expect(NO_UNIQUENESS_ORDER.filter(isUniqueness)).toEqual([]);
  });
});
