// Copy for the static landing pages: what sudokUI does, addressed to the
// things people actually search for. Every sentence describes behaviour
// that exists in the app; when a feature changes, change it here too.
import { TECHS, ALL_TECHS, PRACTICE_TECHS } from '../engine/ratings';
import { RATING_URL } from './staticRoutes';

export { RATING_URL };

const implemented = ALL_TECHS.filter((t) => TECHS[t].implemented).length;

export interface LandingSection {
  heading: string;
  paragraphs: string[];
}

export interface LandingPage {
  /** canonical URL path, with leading and trailing slash */
  url: string;
  /** short name for breadcrumbs and navigation */
  name: string;
  title: string;
  description: string;
  h1: string;
  lead: string;
  sections: LandingSection[];
  cta: { label: string; href: string };
  /** replaces the call to action with a paste-a-puzzle box, so labelled */
  puzzleBox?: string;
  /** further reading, shown as links under the call to action */
  related: { label: string; href: string }[];
}

export const LANDING_PAGES: LandingPage[] = [
  {
    url: '/daily-sudoku/',
    name: 'Daily sudoku',
    title: 'Daily sudoku: the same puzzle for everyone | sudokUI',
    description:
      'One new sudoku every day, identical for every player in the world. Free, no account, no ads. Solve today’s puzzle and compare times with friends.',
    h1: 'Daily sudoku',
    lead: 'One new sudoku every day, identical for every player in the world. Solve it, then compare times with friends who played the very same board.',
    sections: [
      {
        heading: 'How it works',
        paragraphs: [
          'One puzzle is published for every day, the same board for everyone, without any account. A new one opens at midnight, your local time. When you finish, you can submit your time and see how you compare with everyone else who played it: how many solved it, the median, and the share you were faster than.'
        ]
      },
      {
        heading: 'How hard is it?',
        paragraphs: [
          'The daily is usually Medium, Tricky or Hard. Its difficulty band and rating are shown in the top bar, like for any other puzzle.'
        ]
      },
      {
        heading: 'A fair race',
        paragraphs: [
          'The daily starts with automatic candidates off for everyone. Finish without anything from the Assist box, such as hints, checks or automatic candidates, and the result counts as an unassisted solve.',
          'When you finish, Challenge a friend copies a message with your time and a link that carries the puzzle itself.'
        ]
      }
    ],
    cta: { label: 'Play today’s daily', href: '/#daily' },
    related: [
      { label: 'How the difficulty rating works', href: RATING_URL },
      { label: 'Every technique explained', href: '/learn/' }
    ]
  },
  {
    url: '/sudoku-solver/',
    name: 'Sudoku solver',
    title: 'Sudoku solver that explains every step | sudokUI',
    description:
      'Enter any sudoku and see it solved step by step: every technique named, drawn on the board and explained. Free, private, works offline.',
    h1: 'A sudoku solver that explains every step',
    lead: 'Enter any sudoku and sudokUI solves it the way a person would: one named technique at a time, drawn on the board and explained in words.',
    sections: [
      {
        heading: 'Enter your puzzle',
        paragraphs: [
          'Choose Import and paste the puzzle as 81 characters (digits, with dots or zeros for empty cells), or choose New, then Custom, and type the givens onto the board. sudokUI checks that the puzzle has exactly one solution before it starts.'
        ]
      },
      {
        heading: 'See the whole solution path',
        paragraphs: [
          'Steps lists every step of one complete solution, easiest technique first, with the most expensive step marked as the crux. Click any step to set the board to the position just before it.'
        ]
      },
      {
        heading: 'Or take one step at a time',
        paragraphs: [
          'Hint first names the next technique, then shows it on the board with an explanation, then applies it if you want. Scan lists every technique that works in the current position, not only the easiest, and Check flags wrong digits.'
        ]
      },
      {
        heading: `${implemented} techniques, machine-verified`,
        paragraphs: [
          `The solver knows ${implemented} techniques, from Naked Single to Exocet and Forcing Nets. Every hint is checked against the puzzle’s true solution before it is shown.`
        ]
      },
      {
        heading: 'Private and offline',
        paragraphs: [
          'Everything runs on your device. There is no account, no advertising and no upload, and the app keeps working without a connection once it has loaded.'
        ]
      }
    ],
    cta: { label: 'Open the solver', href: '/' },
    puzzleBox: 'Solve this puzzle',
    related: [
      { label: 'Every technique explained', href: '/learn/' },
      { label: 'How the difficulty rating works', href: RATING_URL }
    ]
  },
  {
    url: '/hodoku/',
    name: 'HoDoKu',
    title: 'HoDoKu-compatible sudoku ratings in your browser | sudokUI',
    description:
      'sudokUI rates and explains sudoku with HoDoKu’s technique scores and search order, in any browser: phone, tablet, Mac or PC. Nothing to install, works offline.',
    h1: 'HoDoKu-compatible ratings, in your browser',
    lead: 'sudokUI rates and explains sudoku the way HoDoKu does, with nothing to install. It runs in any browser, on a phone, tablet or computer, and keeps working offline.',
    sections: [
      {
        heading: 'What HoDoKu is',
        paragraphs: [
          'HoDoKu is a free sudoku generator, solver, trainer and analyser by Bernhard Hobiger, written in Java and released under the GPLv3. Its technique catalogue and scores became a common reference for rating sudoku difficulty. The latest release, version 2.2, dates from 2012.'
        ]
      },
      {
        heading: 'What sudokUI shares with it',
        paragraphs: [
          'sudokUI uses HoDoKu’s default score for each technique and its default search order, and rates a puzzle the same way: solve it with the first technique that works at every step, and add up the scores.',
          'The score thresholds for Easy (800), Medium (1000), Hard (1600) and Unfair (1800) are HoDoKu’s as well.'
        ]
      },
      {
        heading: 'Where they differ',
        paragraphs: [
          'sudokUI is an independent project and is not affiliated with HoDoKu.',
          'It adds techniques HoDoKu does not have, such as 3D Medusa, Chute Remote Pair, Fireworks, Tridagon and Exocet, scored next to their closest relatives, and it leaves out a few of HoDoKu’s rarest, such as Mutant and Kraken Fish. On a puzzle that needs one of these, the solve path and the rating can differ.',
          'sudokUI names eight difficulty bands where HoDoKu has five: Beginner, Tricky and Nightmare are additions.'
        ]
      },
      {
        heading: 'The same puzzle in both',
        paragraphs: [
          'A puzzle written as 81 characters works in both programs. Paste it into sudokUI’s Import dialog to see its rating, its full solution path and every technique available in any position.'
        ]
      }
    ],
    cta: { label: 'Open sudokUI', href: '/' },
    related: [
      { label: 'How the difficulty rating works', href: RATING_URL },
      { label: 'Score of every technique', href: `${RATING_URL}#scores` },
      { label: 'HoDoKu’s own site', href: 'https://hodoku.sourceforge.net/' }
    ]
  },
  {
    url: '/how-the-best-solve/',
    name: 'How the best solve',
    title: 'How the best sudoku solvers play | sudokUI',
    description:
      'Champion sudoku solvers do not fill in candidates first. They scan for singles, mark only certain pairs, and bring in harder techniques in a fixed order. The order, and how to train it.',
    h1: 'How the best sudoku solvers play',
    lead: 'The fastest solvers write almost nothing down. They scan, mark only what is certain, and reach for notation and harder techniques only when the puzzle forces them to. The order they work in is the order sudokUI teaches.',
    sections: [
      {
        heading: 'Start with nothing written',
        paragraphs: [
          'A competition solver places the first ten digits before a beginner has finished writing candidates. They take one digit at a time and sweep the grid for it: wherever its rows and columns leave a single free cell in a box, that is a hidden single, and in it goes. Then the next digit. This cross-hatching finds most of an easy puzzle on its own, and it works on paper, on a phone, anywhere.',
          'A full candidate grid is the opposite of this. It costs minutes to write, it hides the few marks that matter among dozens that do not, and every placement means erasing. The best solvers never start there.',
          'A placement is not the end of a sweep but the start of a smaller one. Each digit placed changes its row, its column and its box, so the fast solver looks there first: is that digit now a single in a neighbouring box, and did the cell it filled leave a single somewhere in its lines? Only then does the sweep continue with the next digit. A full pass from 1 to 9 that places nothing is the signal that the singles are gone, and not before.'
        ]
      },
      {
        heading: 'Mark only pairs: Snyder notation',
        paragraphs: [
          'When a digit has exactly two places left in a box, and no more, they write it small in the corner of both cells. Nothing else gets a mark. These corner pairs, named after the champion Thomas Snyder who made the habit famous, are the raw material of the next stage: two corner marks in one row of a box are a pointing pair, two digits sharing the same two cells are a hidden pair, and two boxes whose pairs line up are the start of an X-Wing.',
          'In sudokUI the corner mark mode is built for this: marks are bound to their digit, the pair stays visible when the cell is selected, and hints reason from your marks rather than from a candidate grid you never wrote.'
        ]
      },
      {
        heading: 'The order the puzzle asks for',
        paragraphs: [
          'Singles first, until none remain. Then the box pairs: pointing and claiming, which cost nothing once the corner marks are there. Then naked and hidden pairs and triples in the lines. Only when all of that is exhausted do the best solvers fill in the remaining candidates, and they fill them for the whole grid at once, never cell by cell.',
          'With candidates in, the search widens: X-Wings, Skyscrapers and kites on one digit, then XY-Wings and W-Wings on bivalue cells, then chains. This is the same order the sudokUI solver follows when it rates a puzzle, which is why the technique guide is sorted that way and why a hint names the easiest technique that works, never a harder one.',
          'The order is a ladder climbed from the bottom every time, not a sequence walked once. After any success on a higher rung, a pointing pair, a hidden pair, an X-Wing, go straight back to singles: one elimination often frees a single, and that single frees three more. Nobody keeps hunting for X-Wings while a single is available. The solver works the same way, restarting from the easiest technique after every step.'
        ]
      },
      {
        heading: 'Expert puzzles: candidates, then links',
        paragraphs: [
          'On the puzzles that expert websites publish, the opening is the same but short: the singles run out early. From there the strongest solvers think in links rather than in named patterns. A digit with two places in a unit is a strong link; a bivalue cell is a strong link between two digits. Chains of strong and weak links prove eliminations, and the named techniques from X-Wing up to the alternating inference chain are all special cases of one chain. Colouring is the same idea with paint instead of arrows.',
          'Uniqueness patterns are the other expert shortcut: a published puzzle has one solution, so any arrangement that would allow two is forbidden, and the unique rectangle family turns that into eliminations in seconds.'
        ]
      },
      {
        heading: 'Speed is recognition',
        paragraphs: [
          'The fastest solver at a given difficulty is not the one who writes fastest but the one who sees the pattern first. Champions report seeing an X-Wing the way a reader sees a word, without spelling it out. That comes from repetition on the specific pattern, which is what practice mode is for: pick a technique, get a puzzle that needs it with nothing harder in the way, and meet the pattern as the very next move, again and again.',
          'Two habits keep the time down. Do not undo good work by filling candidates too early, and do not search for a hard technique while an easy one is still available. The worth sort in the guide shows which techniques repay practice most: the ones that are needed often, weighted by how much they cost.'
        ]
      },
      {
        heading: 'How to train it here',
        paragraphs: [
          'New games start with automatic candidates off, as a champion would start; a practice puzzle that jumps straight to its technique is the exception. Use corner marks for Snyder pairs and leave the rest blank. When you are stuck, Scan shows every technique that works in the exact position with your own marks, so you learn what you missed rather than what a candidate grid would have shown. Scan counts as help, like everything else in the Assist box: finish without any of it and the result counts as an unassisted solve.'
        ]
      }
    ],
    cta: { label: 'Play sudokUI', href: '/' },
    related: [
      { label: 'Every technique explained', href: '/learn/' },
      { label: 'How the difficulty rating works', href: RATING_URL }
    ]
  }
];

export const COUNTS = {
  catalogued: ALL_TECHS.length,
  implemented,
  practice: PRACTICE_TECHS.length
};
