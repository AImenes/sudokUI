// How the difficulty rating works, in words. One source for the in-app
// Learn dialog and the static /learn/rating/ page. Every claim here mirrors
// ratePuzzle() in engine/humanSolver.ts and the tables in engine/ratings.ts.
import { Level } from '../engine/ratings';

export const RATING_SUMMARY =
  'sudokUI rates a puzzle by solving it the way a person would. At every step it takes the easiest technique that makes progress and adds that technique’s score. The total is the rating.';

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
    title: 'Eight difficulty bands',
    text: 'The band is the higher of two readings: the band of the total score, and the band of the hardest technique needed. A puzzle needing a single fish, wing or kite is at least Tricky, and one needing several is at least Hard.'
  },
  {
    title: 'Rate any puzzle',
    text: 'Import an 81-character puzzle or type one in by hand. sudokUI first verifies that it has exactly one solution, then rates it before you play.'
  }
];

/** what each band asks of the player, in plain words */
export const BAND_LEADS: Record<Level, string> = {
  Beginner: 'A gentle start',
  Easy: 'Relaxed',
  Medium: 'Pencil marks help',
  Tricky: 'One new trick',
  Hard: 'Several patterns at once',
  Unfair: 'Expert',
  Extreme: 'Expert and long',
  Nightmare: 'The hardest there is'
};

/** what each band feels like: the techniques a puzzle of that band leans on */
export const BAND_NOTES: Record<Level, string> = {
  Beginner: 'full houses and easy singles',
  Easy: 'singles only, but more of them',
  Medium: 'locked candidates and subsets',
  Tricky: 'a first fish, wing or kite',
  Hard: 'fish, wings and patterns in force',
  Unfair: 'chains, ALS and finned fish',
  Extreme: 'long chains, colouring and nets',
  Nightmare: 'forcing nets and Exocets'
};
