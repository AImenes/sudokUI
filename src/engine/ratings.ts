// Technique catalog ported from HoDoKu (Options.java DEFAULT_SOLVER_STEPS).
// Scores and difficulty bands are HoDoKu's defaults, so puzzle ratings are
// directly comparable with HoDoKu's.

export type Level = 'Easy' | 'Medium' | 'Hard' | 'Unfair' | 'Extreme';

export const LEVELS: Level[] = ['Easy', 'Medium', 'Hard', 'Unfair', 'Extreme'];

/** Max total score per level (HoDoKu defaults). */
export const LEVEL_MAX_SCORE: Record<Level, number> = {
  Easy: 800,
  Medium: 1000,
  Hard: 1600,
  Unfair: 1800,
  Extreme: Number.MAX_SAFE_INTEGER
};

export type Category =
  | 'Singles'
  | 'Intersections'
  | 'Subsets'
  | 'Basic Fish'
  | 'Finned Fish'
  | 'Complex Fish'
  | 'Single Digit Patterns'
  | 'Wings'
  | 'Uniqueness'
  | 'Chains and Loops'
  | 'Coloring'
  | 'Almost Locked Sets'
  | 'Miscellaneous'
  | 'Last Resort';

export interface TechInfo {
  /** HoDoKu solver index — determines search order */
  index: number;
  name: string;
  level: Level;
  category: Category;
  score: number;
  /** implemented in the sudokUI engine (unimplemented ones are roadmap) */
  implemented: boolean;
  /** enabled in the default solve/rating loop */
  enabled: boolean;
}

const t = (
  index: number,
  name: string,
  level: Level,
  category: Category,
  score: number,
  implemented = true,
  enabled = true
): TechInfo => ({ index, name, level, category, score, implemented, enabled });

/** Keys follow HoDoKu's SolutionType names. */
export const TECHS = {
  FULL_HOUSE: t(100, 'Full House', 'Easy', 'Singles', 4),
  NAKED_SINGLE: t(200, 'Naked Single', 'Easy', 'Singles', 4),
  HIDDEN_SINGLE: t(300, 'Hidden Single', 'Easy', 'Singles', 14),
  LOCKED_PAIR: t(1000, 'Locked Pair', 'Medium', 'Intersections', 40),
  LOCKED_TRIPLE: t(1100, 'Locked Triple', 'Medium', 'Intersections', 60),
  LOCKED_CANDIDATES_1: t(1200, 'Locked Candidates (Pointing)', 'Medium', 'Intersections', 50),
  LOCKED_CANDIDATES_2: t(1210, 'Locked Candidates (Claiming)', 'Medium', 'Intersections', 50),
  NAKED_PAIR: t(1300, 'Naked Pair', 'Medium', 'Subsets', 60),
  NAKED_TRIPLE: t(1400, 'Naked Triple', 'Medium', 'Subsets', 80),
  HIDDEN_PAIR: t(1500, 'Hidden Pair', 'Medium', 'Subsets', 70),
  HIDDEN_TRIPLE: t(1600, 'Hidden Triple', 'Medium', 'Subsets', 100),
  NAKED_QUADRUPLE: t(2000, 'Naked Quadruple', 'Hard', 'Subsets', 120),
  HIDDEN_QUADRUPLE: t(2100, 'Hidden Quadruple', 'Hard', 'Subsets', 150),
  X_WING: t(2200, 'X-Wing', 'Hard', 'Basic Fish', 140),
  SWORDFISH: t(2300, 'Swordfish', 'Hard', 'Basic Fish', 150),
  JELLYFISH: t(2400, 'Jellyfish', 'Hard', 'Basic Fish', 160),
  // Implemented but disabled by default (as in HoDoKu): any fish larger than
  // a jellyfish implies a complementary fish of size ≤ 4 on the same digit
  // (sudokuwiki: "a 5x5 automatically creates a 4x4 with the remaining
  // numbers"), so these can never be *required* by a solve path.
  SQUIRMBAG: t(2500, 'Squirmbag', 'Unfair', 'Basic Fish', 470, true, false),
  WHALE: t(2600, 'Whale', 'Unfair', 'Basic Fish', 470, true, false),
  LEVIATHAN: t(2700, 'Leviathan', 'Unfair', 'Basic Fish', 470, true, false),
  REMOTE_PAIR: t(2800, 'Remote Pair', 'Hard', 'Chains and Loops', 110),
  CHUTE_REMOTE_PAIR: t(2850, 'Chute Remote Pair', 'Hard', 'Chains and Loops', 110),
  BUG_PLUS_1: t(2900, 'BUG+1', 'Hard', 'Uniqueness', 100),
  SKYSCRAPER: t(3000, 'Skyscraper', 'Hard', 'Single Digit Patterns', 130),
  TWO_STRING_KITE: t(3100, '2-String Kite', 'Hard', 'Single Digit Patterns', 150),
  TURBOT_FISH: t(3120, 'Turbot Fish', 'Hard', 'Single Digit Patterns', 120),
  EMPTY_RECTANGLE: t(3170, 'Empty Rectangle', 'Hard', 'Single Digit Patterns', 120),
  W_WING: t(3200, 'W-Wing', 'Hard', 'Wings', 150),
  XY_WING: t(3300, 'XY-Wing', 'Hard', 'Wings', 160),
  XYZ_WING: t(3400, 'XYZ-Wing', 'Hard', 'Wings', 180),
  WXYZ_WING: t(3450, 'WXYZ-Wing', 'Hard', 'Wings', 200),
  UNIQUENESS_1: t(3500, 'Unique Rectangle Type 1', 'Hard', 'Uniqueness', 100),
  UNIQUENESS_2: t(3600, 'Unique Rectangle Type 2', 'Hard', 'Uniqueness', 100),
  UNIQUENESS_3: t(3700, 'Unique Rectangle Type 3', 'Hard', 'Uniqueness', 100),
  UNIQUENESS_4: t(3800, 'Unique Rectangle Type 4', 'Hard', 'Uniqueness', 100),
  UNIQUENESS_5: t(3900, 'Unique Rectangle Type 5', 'Hard', 'Uniqueness', 100),
  UNIQUENESS_6: t(4000, 'Unique Rectangle Type 6', 'Hard', 'Uniqueness', 100),
  HIDDEN_RECTANGLE: t(4010, 'Hidden Rectangle', 'Hard', 'Uniqueness', 100),
  AVOIDABLE_RECTANGLE_1: t(4020, 'Avoidable Rectangle Type 1', 'Hard', 'Uniqueness', 100),
  AVOIDABLE_RECTANGLE_2: t(4030, 'Avoidable Rectangle Type 2', 'Hard', 'Uniqueness', 100),
  FINNED_X_WING: t(4100, 'Finned X-Wing', 'Hard', 'Finned Fish', 130),
  SASHIMI_X_WING: t(4200, 'Sashimi X-Wing', 'Hard', 'Finned Fish', 150),
  FINNED_SWORDFISH: t(4300, 'Finned Swordfish', 'Unfair', 'Finned Fish', 200),
  SASHIMI_SWORDFISH: t(4400, 'Sashimi Swordfish', 'Unfair', 'Finned Fish', 240),
  FINNED_JELLYFISH: t(4500, 'Finned Jellyfish', 'Unfair', 'Finned Fish', 250),
  SASHIMI_JELLYFISH: t(4600, 'Sashimi Jellyfish', 'Unfair', 'Finned Fish', 260),
  SUE_DE_COQ: t(5300, 'Sue de Coq', 'Unfair', 'Miscellaneous', 250),
  SIMPLE_COLORS: t(5330, 'Simple Colors', 'Hard', 'Coloring', 150),
  MULTI_COLORS: t(5360, 'Multi Colors', 'Hard', 'Coloring', 200),
  // sudokUI extension (not in HoDoKu): rated between Multi Colors and X-Chain
  MEDUSA_3D: t(5370, '3D Medusa', 'Unfair', 'Coloring', 250),
  X_CHAIN: t(5400, 'X-Chain', 'Unfair', 'Chains and Loops', 260),
  XY_CHAIN: t(5500, 'XY-Chain', 'Unfair', 'Chains and Loops', 260),
  NICE_LOOP: t(5600, 'Nice Loop', 'Unfair', 'Chains and Loops', 280),
  GROUPED_NICE_LOOP: t(5650, 'Grouped Nice Loop', 'Unfair', 'Chains and Loops', 300),
  ALS_XZ: t(5700, 'ALS-XZ', 'Unfair', 'Almost Locked Sets', 300),
  ALS_XY_WING: t(5800, 'ALS-XY-Wing', 'Unfair', 'Almost Locked Sets', 320),
  ALS_XY_CHAIN: t(5900, 'ALS-XY-Chain', 'Unfair', 'Almost Locked Sets', 340),
  DEATH_BLOSSOM: t(6000, 'Death Blossom', 'Unfair', 'Almost Locked Sets', 360),
  FRANKEN_X_WING: t(6100, 'Franken X-Wing', 'Unfair', 'Complex Fish', 300),
  FRANKEN_SWORDFISH: t(6200, 'Franken Swordfish', 'Unfair', 'Complex Fish', 350),
  // --- not yet implemented; shown in the app for the full picture ---
  X_CYCLES: t(5450, 'X-Cycles (loops)', 'Unfair', 'Chains and Loops', 280),
  GROUPED_X_CYCLES: t(5460, 'Grouped X-Cycles', 'Unfair', 'Chains and Loops', 300),
  TWINNED_XY_CHAIN: t(5550, 'Twinned XY-Chains', 'Unfair', 'Chains and Loops', 300, false),
  AIC: t(5950, 'Alternating Inference Chain', 'Unfair', 'Chains and Loops', 320),
  AIC_GROUPED: t(5960, 'AIC with Groups', 'Unfair', 'Chains and Loops', 340),
  AIC_ALS: t(5970, 'AIC with ALSs', 'Unfair', 'Chains and Loops', 360, false),
  EXTENDED_RECTANGLE: t(4040, 'Extended Rectangle', 'Hard', 'Uniqueness', 110),
  FIREWORKS: t(6300, 'Fireworks', 'Extreme', 'Miscellaneous', 400),
  TRIDAGON: t(6310, 'Tridagon', 'Extreme', 'Miscellaneous', 400, false),
  SK_LOOP: t(6320, 'SK Loop', 'Extreme', 'Miscellaneous', 400, false),
  ALIGNED_PAIR_EXCLUSION: t(6330, 'Aligned Pair Exclusion', 'Unfair', 'Miscellaneous', 320),
  EXOCET: t(8300, 'Exocet', 'Extreme', 'Last Resort', 450, false),
  DOUBLE_EXOCET: t(8310, 'Double Exocet', 'Extreme', 'Last Resort', 480, false),
  PATTERN_OVERLAY: t(8320, 'Pattern Overlay', 'Extreme', 'Last Resort', 500),
  DIGIT_FORCING_CHAIN: t(8510, 'Digit Forcing Chain', 'Extreme', 'Last Resort', 500),
  NISHIO_FORCING_CHAIN: t(8520, 'Nishio Forcing Chain', 'Extreme', 'Last Resort', 500),
  CELL_FORCING_CHAIN: t(8530, 'Cell Forcing Chain', 'Extreme', 'Last Resort', 550),
  UNIT_FORCING_CHAIN: t(8540, 'Unit Forcing Chain', 'Extreme', 'Last Resort', 550),
  FORCING_CHAIN: t(8500, 'Forcing Chain', 'Extreme', 'Last Resort', 500, false),
  FORCING_NET: t(8600, 'Forcing Net', 'Extreme', 'Last Resort', 700, false),
  BRUTE_FORCE: t(8900, 'Brute Force', 'Extreme', 'Last Resort', 10000)
} as const;

export type Tech = keyof typeof TECHS;

/** Techniques in HoDoKu search order (implemented + enabled only). */
export const SOLVE_ORDER: Tech[] = (Object.keys(TECHS) as Tech[])
  .filter((k) => TECHS[k].implemented && TECHS[k].enabled)
  .sort((a, b) => TECHS[a].index - TECHS[b].index);

/** Techniques offered in practice mode (implemented, excluding last resorts). */
export const PRACTICE_TECHS: Tech[] = SOLVE_ORDER.filter(
  (k) => TECHS[k].category !== 'Last Resort'
);

/** Full catalogue in solver order, for the technique overview UI. */
export const ALL_TECHS: Tech[] = (Object.keys(TECHS) as Tech[]).sort(
  (a, b) => TECHS[a].index - TECHS[b].index
);

export function levelForScore(score: number): Level {
  for (const level of LEVELS) if (score <= LEVEL_MAX_SCORE[level]) return level;
  return 'Extreme';
}

export function maxLevel(a: Level, b: Level): Level {
  return LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b;
}
