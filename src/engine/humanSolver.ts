/**
 * The human-style solver: tries every enabled technique in SOLVE_ORDER
 * (cheapest first) to find the next step, applies steps, and rates whole
 * puzzles by summing per-technique scores along the solve path — the same
 * model HoDoKu uses. This is the single integration point for technique
 * finders; see `ratings.ts` for the catalogue and `techniques/` for finders.
 */
import { Grid, cloneGrid, setValue, bit, isSolved, isBroken, cellName, parseGrid } from './board';
import { solve } from './bruteForce';
import { Step } from './steps';
import { Tech, TECHS, Level, LEVELS, LEVEL_MAX_SCORE, SOLVE_ORDER, maxLevel } from './ratings';
import { findFullHouse, findNakedSingle, findHiddenSingle } from './techniques/singles';
import { findLockedCandidates1, findLockedCandidates2 } from './techniques/intersections';
import { findNakedSubset, findHiddenSubset } from './techniques/subsets';
import { findBasicFish, findFinnedFish } from './techniques/fish';
import { findTurbotFamily, findEmptyRectangle } from './techniques/singleDigit';
import { findXYWing, findXYZWing, findWWing } from './techniques/wings';
import { findRemotePair, findXChain, findXYChain } from './techniques/chains';
import { findSimpleColors, findMultiColors } from './techniques/coloring';
import {
  findUniqueness,
  findBugPlus1,
  findHiddenRectangle,
  findAvoidableRectangle
} from './techniques/uniqueness';
import {
  findAlsXz,
  findWxyzWing,
  findDeathBlossom,
  findAlsXyWing,
  findAlsXyChain
} from './techniques/als';
import { findFrankenFish } from './techniques/complexFish';
import { findAlignedPairExclusion } from './techniques/ape';
import { findPatternOverlay } from './techniques/templates';
import { findExocet, findDoubleExocet } from './techniques/exocet';
import { findNishio, findCellForcing, findUnitForcing, findDigitForcing, findForcingNet } from './techniques/forcing';
import { findSueDeCoq } from './techniques/sueDeCoq';
import { findMedusa3d } from './techniques/medusa';
import { findChuteRemotePair } from './techniques/chuteRemotePair';
import { findExtendedRectangle } from './techniques/extendedRectangle';
import { findXCycles } from './techniques/xCycles';
import { findAic, findNiceLoop } from './techniques/aic';
import { findGroupedXCycles } from './techniques/groupedXCycles';
import { findGroupedAic, findGroupedNiceLoop } from './techniques/groupedAic';
import { findFireworks } from './techniques/fireworks';
import { findTridagon } from './techniques/tridagon';

type Finder = (g: Grid) => Step | null;

const FINDERS: Partial<Record<Tech, Finder>> = {
  FULL_HOUSE: findFullHouse,
  NAKED_SINGLE: findNakedSingle,
  HIDDEN_SINGLE: findHiddenSingle,
  LOCKED_PAIR: (g) => findNakedSubset(g, 2, true),
  LOCKED_TRIPLE: (g) => findNakedSubset(g, 3, true),
  LOCKED_CANDIDATES_1: findLockedCandidates1,
  LOCKED_CANDIDATES_2: findLockedCandidates2,
  NAKED_PAIR: (g) => findNakedSubset(g, 2, false),
  NAKED_TRIPLE: (g) => findNakedSubset(g, 3, false),
  HIDDEN_PAIR: (g) => findHiddenSubset(g, 2),
  HIDDEN_TRIPLE: (g) => findHiddenSubset(g, 3),
  NAKED_QUADRUPLE: (g) => findNakedSubset(g, 4, false),
  HIDDEN_QUADRUPLE: (g) => findHiddenSubset(g, 4),
  X_WING: (g) => findBasicFish(g, 2),
  SWORDFISH: (g) => findBasicFish(g, 3),
  JELLYFISH: (g) => findBasicFish(g, 4),
  SQUIRMBAG: (g) => findBasicFish(g, 5),
  WHALE: (g) => findBasicFish(g, 6),
  LEVIATHAN: (g) => findBasicFish(g, 7),
  REMOTE_PAIR: findRemotePair,
  CHUTE_REMOTE_PAIR: findChuteRemotePair,
  BUG_PLUS_1: findBugPlus1,
  SKYSCRAPER: (g) => findTurbotFamily(g, 'SKYSCRAPER'),
  TWO_STRING_KITE: (g) => findTurbotFamily(g, 'TWO_STRING_KITE'),
  TURBOT_FISH: (g) => findTurbotFamily(g, 'TURBOT_FISH'),
  EMPTY_RECTANGLE: findEmptyRectangle,
  W_WING: findWWing,
  XY_WING: findXYWing,
  XYZ_WING: findXYZWing,
  WXYZ_WING: findWxyzWing,
  UNIQUENESS_1: (g) => findUniqueness(g, 1),
  UNIQUENESS_2: (g) => findUniqueness(g, 2),
  UNIQUENESS_3: (g) => findUniqueness(g, 3),
  UNIQUENESS_4: (g) => findUniqueness(g, 4),
  UNIQUENESS_5: (g) => findUniqueness(g, 5),
  UNIQUENESS_6: (g) => findUniqueness(g, 6),
  HIDDEN_RECTANGLE: findHiddenRectangle,
  AVOIDABLE_RECTANGLE_1: (g) => findAvoidableRectangle(g, 1),
  AVOIDABLE_RECTANGLE_2: (g) => findAvoidableRectangle(g, 2),
  FINNED_X_WING: (g) => findFinnedFish(g, 2, false),
  SASHIMI_X_WING: (g) => findFinnedFish(g, 2, true),
  FINNED_SWORDFISH: (g) => findFinnedFish(g, 3, false),
  SASHIMI_SWORDFISH: (g) => findFinnedFish(g, 3, true),
  FINNED_JELLYFISH: (g) => findFinnedFish(g, 4, false),
  SASHIMI_JELLYFISH: (g) => findFinnedFish(g, 4, true),
  EXTENDED_RECTANGLE: findExtendedRectangle,
  SUE_DE_COQ: findSueDeCoq,
  SIMPLE_COLORS: findSimpleColors,
  MULTI_COLORS: findMultiColors,
  MEDUSA_3D: findMedusa3d,
  X_CHAIN: (g) => findXChain(g),
  X_CYCLES: (g) => findXCycles(g),
  GROUPED_X_CYCLES: (g) => findGroupedXCycles(g),
  NICE_LOOP: (g) => findNiceLoop(g),
  GROUPED_NICE_LOOP: (g) => findGroupedNiceLoop(g),
  // one engine serves both: it labels steps AIC_ALS when an ALS node takes
  // part and AIC_GROUPED otherwise, so a second call would be pure waste
  AIC_GROUPED: (g) => findGroupedAic(g),
  FIREWORKS: findFireworks,
  TRIDAGON: findTridagon,
  XY_CHAIN: (g) => findXYChain(g),
  ALS_XZ: findAlsXz,
  ALS_XY_WING: findAlsXyWing,
  ALS_XY_CHAIN: findAlsXyChain,
  AIC: (g) => findAic(g),
  DEATH_BLOSSOM: findDeathBlossom,
  FRANKEN_X_WING: (g) => findFrankenFish(g, 2),
  FRANKEN_SWORDFISH: (g) => findFrankenFish(g, 3),
  ALIGNED_PAIR_EXCLUSION: findAlignedPairExclusion,
  EXOCET: findExocet,
  DOUBLE_EXOCET: findDoubleExocet, // disabled by default: line elims are a naked quad
  FORCING_NET: findForcingNet,
  PATTERN_OVERLAY: (g) => findPatternOverlay(g),
  DIGIT_FORCING_CHAIN: findDigitForcing,
  NISHIO_FORCING_CHAIN: findNishio,
  CELL_FORCING_CHAIN: findCellForcing,
  UNIT_FORCING_CHAIN: findUnitForcing
};

/** Find the next step in HoDoKu order. Never returns BRUTE_FORCE. */
export function findNextStep(g: Grid, order: Tech[] = SOLVE_ORDER): Step | null {
  for (const tech of order) {
    const finder = FINDERS[tech];
    if (!finder) continue;
    const step = finder(g);
    if (step) return step;
  }
  return null;
}

/** Apply a step to the grid: eliminations strip candidate bits, placements
 *  set values (which also strips the digit from all peers). */
export function applyStep(g: Grid, step: Step): void {
  for (const { cell, digit } of step.eliminations) g.cands[cell] &= ~bit(digit);
  for (const { cell, digit } of step.placements) setValue(g, cell, digit);
}

export interface Rating {
  score: number;
  level: Level;
  steps: Step[];
  /** technique -> occurrence count */
  techniques: Partial<Record<Tech, number>>;
  solvable: boolean; // solvable with implemented techniques (no brute force)
}

/**
 * Rate a puzzle HoDoKu-style: solve with the cheapest applicable technique
 * each step, sum the scores, and derive the difficulty level.
 */
export function ratePuzzle(input: Grid | string, order: Tech[] = SOLVE_ORDER): Rating | null {
  const start = typeof input === 'string' ? parseGrid(input) : cloneGrid(input);
  if (!start) return null;
  const solution = solve(start);
  if (!solution) return null;

  const g = start;
  const steps: Step[] = [];
  const techniques: Partial<Record<Tech, number>> = {};
  let score = 0;
  let level: Level = 'Easy';
  let solvable = true;

  while (!isSolved(g)) {
    if (isBroken(g)) return null;
    let step = findNextStep(g, order);
    if (!step) {
      // brute-force fallback: place one digit from the real solution
      solvable = false;
      let cell = -1;
      for (let c = 0; c < 81; c++) {
        if (g.values[c] === 0) {
          cell = c;
          break;
        }
      }
      step = {
        tech: 'BRUTE_FORCE',
        placements: [{ cell, digit: solution.values[cell] }],
        eliminations: [],
        description: `Brute force: set ${cellName(cell)} to ${solution.values[cell]}.`
      };
    }
    applyStep(g, step);
    steps.push(step);
    techniques[step.tech] = (techniques[step.tech] ?? 0) + 1;
    score += TECHS[step.tech].score;
    level = maxLevel(level, TECHS[step.tech].level);
    if (steps.length > 400) return null; // safety
  }

  // HoDoKu: bump the level while the total score exceeds the level cap
  let li = LEVELS.indexOf(level);
  while (li < LEVELS.length - 1 && score > LEVEL_MAX_SCORE[LEVELS[li]]) li++;
  level = LEVELS[li];

  return { score, level, steps, techniques, solvable };
}
