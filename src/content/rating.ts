// How the difficulty rating works, in words. One source for the in-app
// Learn dialog and the static /learn/rating/ page. Every claim here mirrors
// ratePuzzle() in engine/humanSolver.ts and the tables in engine/ratings.ts.
import { LEVELS, LEVEL_MAX_SCORE, Level, LevelPick, BEGINNER_MAX_SCORE, NIGHTMARE_MIN_SCORE } from '../engine/ratings';

export const RATING_SUMMARY =
  'sudokUI rates a puzzle by solving it the way a person would. At every step it takes the easiest technique that makes progress and adds that technique’s score. The total is the HoDoKu rating.';

export const RATING_POINTS: { title: string; text: string }[] = [
  {
    title: 'Easiest technique first',
    text: 'Techniques are tried in a fixed order, from singles up to forcing nets, and the first one that works is applied. The rating therefore measures a path built from the easiest steps available, not the cleverest one.'
  },
  {
    title: 'Scores compatible with HoDoKu',
    text: 'Scores and search order are the defaults of HoDoKu, the reference sudoku analyser, so ratings can be compared with HoDoKu’s. A Naked Single costs 4, an X-Wing 140, a Forcing Net 700. Techniques HoDoKu does not know are scored next to their closest relatives.'
  },
  {
    title: 'HoDoKu’s five levels',
    text: 'The level is set the way HoDoKu sets it. It starts at the level of the hardest technique needed, then rises one level at a time while the total is above the level’s limit: 800 for Easy, 1000 for Medium, 1600 for Hard and 1800 for Unfair. A puzzle needing an X-Wing is at least Hard, and one scoring over 1800 is Extreme.'
  },
  {
    title: 'Beginner and Nightmare',
    text: 'New game also offers two narrower picks: Beginner, the Easy puzzles scoring 400 or less, and Nightmare, the Extreme puzzles scoring over 3000. They choose which puzzles you get; the level a puzzle shows is still one of the five.'
  },
  {
    title: 'Rate any puzzle',
    text: 'Import an 81-character puzzle or type one in by hand. sudokUI first verifies that it has exactly one solution, then rates it before you play.'
  }
];

/** what each level and pick asks of the player, in plain words */
export const BAND_LEADS: Record<LevelPick, string> = {
  Beginner: 'A gentle start',
  Easy: 'Relaxed',
  Medium: 'Pencil marks help',
  Hard: 'One trick or several',
  Unfair: 'Expert',
  Extreme: 'Expert and long',
  Nightmare: 'The hardest there is'
};

/** what each level and pick feels like: the techniques a puzzle of it leans on */
export const BAND_NOTES: Record<LevelPick, string> = {
  Beginner: 'full houses and easy singles',
  Easy: 'singles only',
  Medium: 'locked candidates and subsets',
  Hard: 'fish, wings, kites and unique rectangles',
  Unfair: 'chains, ALS and finned fish',
  Extreme: 'long chains, colouring and nets',
  Nightmare: 'forcing nets and Exocets'
};

/**
 * The scores a level or pick covers, in words: "up to 800", "above 1800";
 * a pick says its level first, "Easy, up to 400"
 */
export function rangeOf(
  pick: LevelPick,
  levelOf: (l: Level) => string,
  upTo: (n: number) => string,
  above: (n: number) => string
): string {
  if (pick === 'Beginner') return `${levelOf('Easy')}, ${upTo(BEGINNER_MAX_SCORE)}`;
  if (pick === 'Nightmare') return `${levelOf('Extreme')}, ${above(NIGHTMARE_MIN_SCORE)}`;
  const i = LEVELS.indexOf(pick);
  return i === LEVELS.length - 1 ? above(LEVEL_MAX_SCORE[LEVELS[i - 1]]) : upTo(LEVEL_MAX_SCORE[pick]);
}
