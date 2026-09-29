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
          'The daily puzzle is generated on your own device from the date, so everyone gets the same board without any server or account. A new puzzle arrives at midnight UTC.'
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
          'Every game starts with automatic candidates off. Finish without hints, checks or automatic candidates and the result counts as a clean solve.',
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
  }
];

export const COUNTS = {
  catalogued: ALL_TECHS.length,
  implemented,
  practice: PRACTICE_TECHS.length
};
