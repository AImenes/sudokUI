/**
 * Colourings built by hand, one for each shape a colouring's argument
 * takes (docs/hint-drawing-colouring.md, Per rule): the trap, the wrap, the
 * bridge, a colour seeing both colours of the other cluster, and 3D
 * Medusa's colour twice in a cell (rule 1), a cell holding both colours
 * (rule 3), a colour seen outside a cell that holds the other (rule 5), a
 * cell a colour would empty (rule 6), and Remote Pair. Each is the step
 * the design draws at one of its fixtures, a real position on a puzzle's
 * solve path (`at`: after that many of the solver's steps), written out
 * candidate by candidate: its two colours per cluster, dark the colour the
 * argument tries first; its ties, cluster by cluster, the first of each
 * with the cluster frame's sentence; its argument as weak ties, each with
 * its sentence. No finder writes `truth: 'parity'` yet, so these hold the
 * drawing to the design until the finders do. Not a test file itself.
 */
import { parseGrid } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import type { CellDigit, ChainLink, ColourRule, Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

/** a candidate as HoDoKu writes one, 4r1c5 */
export function cd(s: string): CellDigit {
  const m = /^(\d)r(\d)c(\d)$/.exec(s);
  if (!m) throw new Error(`not a candidate: ${s}`);
  return { cell: (Number(m[2]) - 1) * 9 + Number(m[3]) - 1, digit: Number(m[1]) };
}
/** candidates, written one after another */
export const cds = (s: string): CellDigit[] => s.split(/\s+/).filter(Boolean).map(cd);
/** a candidate's name, 4r1c5 */
export const nameOf = (x: CellDigit) => `${x.digit}r${Math.floor(x.cell / 9) + 1}c${(x.cell % 9) + 1}`;

/** a tie: exactly one end true */
const tie = (a: string, b: string, text?: string): ChainLink => ({ from: [cd(a)], to: [cd(b)], strong: true, undirected: true, ...(text ? { text } : {}) });
/** a weak tie: at most one end true */
const weak = (from: string, to: string, text: string): ChainLink => ({ from: cds(from), to: cds(to), strong: false, undirected: true, text });

export interface ParityFixture {
  /** the rule's shape, as the design names it */
  name: string;
  puzzle: string;
  /** the solver's steps before it */
  at: number;
  step: Step;
}

function parity(
  tech: Tech,
  rule: ColourRule,
  clusters: [string, string][],
  links: ChainLink[],
  eliminations: string,
  darkFalse?: 0 | 1
): Step {
  return {
    tech,
    placements: [],
    eliminations: cds(eliminations),
    links,
    truth: 'parity',
    colouring: {
      rule,
      clusters: clusters.map(([dark, light]) => ({ dark: cds(dark), light: cds(light) })),
      ...(darkFalse !== undefined ? { darkFalse } : {})
    },
    description: `A colouring built by hand (${rule}).`
  };
}

/** a single digit's cluster frame */
const simple = (d: number) =>
  `Each line joins the only two ${d}s of a house: exactly one of them is true, so they take opposite shades. Either every dark purple ${d} is true, or every light purple one is.`;
const another = (d: number) => `Another cluster of ${d}s, shaded the same way in orange: either every dark orange ${d} is true, or every light orange one is.`;
const medusa =
  'Each line joins the only two places for a digit in a row, column or box; a cell with only two candidates joins those two, side by side (no line inside a cell). Joined candidates take opposite shades: either every dark purple candidate is true, or every light purple one is.';

export const PARITY_FIXTURES: ParityFixture[] = [
  {
    name: 'trap',
    puzzle: '15.6..3.94.....76.6...1......823.....6.8.9.2.....658......2...5.16.....88.5..6.32',
    at: 24,
    step: parity(
      'SIMPLE_COLORS',
      'trap',
      [['4r1c5 4r6c4 4r8c6', '4r1c6 4r5c5 4r8c8']],
      [
        tie('4r1c5', '4r1c6', simple(4)),
        tie('4r1c5', '4r5c5'),
        tie('4r1c6', '4r8c6'),
        tie('4r5c5', '4r6c4'),
        tie('4r8c6', '4r8c8'),
        weak('4r6c4', '4r6c8', 'If dark purple is true, the 4 in r6c4 is true, and the 4 in r6c8 goes.'),
        weak('4r8c8', '4r6c8', 'If light purple is true, the 4 in r8c8 is true, and the 4 in r6c8 goes. Either way it is false.')
      ],
      '4r6c8'
    )
  },
  {
    name: 'wrap',
    puzzle: '8..6..37....93.62..3...7.....18...6..7..5..........4....85..9...1.2..5...4......1',
    at: 25,
    step: parity(
      'SIMPLE_COLORS',
      'wrap',
      [['7r4c7 7r6c9', '7r4c9 7r9c7 7r6c4']],
      [
        tie('7r4c7', '7r4c9', simple(7)),
        tie('7r4c7', '7r9c7'),
        tie('7r4c9', '7r6c9'),
        tie('7r6c9', '7r6c4'),
        weak('7r4c7', '7r6c9', 'Dark purple puts 7 in both r4c7 and r6c9 of box 6 (the dashed line). A digit appears once per house, so dark purple cannot be true.')
      ],
      '7r4c7 7r6c9',
      0
    )
  },
  {
    name: 'bridge',
    puzzle: '.5.8.4.......73.1.......9.89.....4...7.9.2.35..1...27..........7...8...4.8..597..',
    at: 25,
    step: parity(
      'MULTI_COLORS',
      'bridge',
      [
        ['6r8c7 6r4c9', '6r8c6 6r5c7'],
        ['6r1c3 6r9c8 6r2c9', '6r1c8 6r2c4']
      ],
      [
        tie('6r8c6', '6r8c7', simple(6)),
        tie('6r8c7', '6r5c7'),
        tie('6r5c7', '6r4c9'),
        tie('6r1c3', '6r1c8', another(6)),
        tie('6r1c8', '6r9c8'),
        tie('6r1c8', '6r2c9'),
        tie('6r2c9', '6r2c4'),
        weak('6r9c8', '6r8c7', 'The dark orange 6 in r9c8 and the dark purple 6 in r8c7 see each other (the dashed line), so they cannot both be true: light orange or light purple is true.'),
        weak('6r8c6', '6r3c6', 'If light purple is true, the 6 in r8c6 is true, and the 6 in r3c6 goes.'),
        weak('6r2c4', '6r3c6', 'If light orange is true, the 6 in r2c4 is true, and the 6 in r3c6 goes. One of them is true, so it is false either way; 1 more 6 falls the same way.')
      ],
      '6r3c6 6r7c4'
    )
  },
  {
    name: 'seesBoth',
    puzzle: '...3......3274.....84....9.......14..5316427..46.......6....38.....7652......2...',
    at: 28,
    step: parity(
      'MULTI_COLORS',
      'seesBoth',
      [
        ['9r5c1 9r6c7', '9r5c9 9r6c5 9r9c7'],
        ['9r2c1 9r7c6 9r1c5', '9r2c6']
      ],
      [
        tie('9r5c1', '9r5c9', simple(9)),
        tie('9r5c9', '9r6c7'),
        tie('9r6c7', '9r6c5'),
        tie('9r6c7', '9r9c7'),
        tie('9r2c1', '9r2c6', another(9)),
        tie('9r2c6', '9r7c6'),
        tie('9r2c6', '9r1c5'),
        weak('9r2c1', '9r5c1', 'The dark orange 9 in r2c1 sees the dark purple 9 in r5c1 (the dashed line): if dark orange were true, dark purple would be false, and light purple true.'),
        weak('9r1c5', '9r6c5', 'The dark orange 9 in r1c5 also sees the light purple 9 in r6c5: dark orange would make both purple colours false, and one of them must be true.')
      ],
      '9r2c1 9r7c6 9r1c5',
      1
    )
  },
  {
    name: 'medusa1',
    puzzle: '..3.5.4..5....2..3.74...8.6....1.6..8......357..5.....6..42.....2.9..1.......5...',
    at: 13,
    step: parity(
      'MEDUSA_3D',
      'medusa1',
      [['1r3c4 1r7c6 9r3c6 3r3c5 3r4c4 3r8c1 3r6c2 3r7c6', '1r3c6 1r9c4 3r3c4 9r3c5 3r4c1 3r7c2 4r8c1']],
      [
        tie('1r3c4', '1r3c6', medusa),
        tie('1r3c4', '1r9c4'),
        tie('1r3c4', '3r3c4'),
        tie('1r3c6', '1r7c6'),
        tie('1r3c6', '9r3c6'),
        tie('3r3c4', '3r3c5'),
        tie('3r3c4', '3r4c4'),
        tie('9r3c6', '9r3c5'),
        tie('3r4c4', '3r4c1'),
        tie('3r4c1', '3r8c1'),
        tie('3r4c1', '3r6c2'),
        tie('3r8c1', '3r7c2'),
        tie('3r8c1', '4r8c1'),
        tie('3r7c2', '3r7c6'),
        weak('1r7c6', '3r7c6', 'Dark purple colours both the 1 and the 3 in r7c6 (the corner marks). A cell holds one digit, so dark purple cannot be true.')
      ],
      '1r3c4 1r7c6 9r3c6 3r3c5 3r4c4 3r8c1 3r6c2 3r7c6',
      0
    )
  },
  {
    name: 'medusa3',
    puzzle: '2.3....8.8.6..32.47....26..3....6.........5..67.4...9....2.48....41.7..2....38..1',
    at: 22,
    step: parity(
      'MEDUSA_3D',
      'medusa3',
      [['9r1c7 9r7c9 7r1c9 3r8c7 3r3c8 3r6c9 1r6c7 5r3c9 8r6c3 1r5c3', '9r1c9 9r8c7 9r7c5 3r8c8 3r6c7 3r3c9 8r6c9 5r7c9 8r5c3']],
      [
        tie('9r1c7', '9r1c9', medusa),
        tie('9r1c7', '9r8c7'),
        tie('9r1c9', '9r7c9'),
        tie('9r1c9', '7r1c9'),
        tie('9r8c7', '3r8c7'),
        tie('9r7c9', '9r7c5'),
        tie('3r8c7', '3r8c8'),
        tie('3r8c7', '3r6c7'),
        tie('3r8c8', '3r3c8'),
        tie('3r6c7', '3r6c9'),
        tie('3r6c7', '1r6c7'),
        tie('3r3c8', '3r3c9'),
        tie('3r6c9', '8r6c9'),
        tie('3r3c9', '5r3c9'),
        tie('8r6c9', '8r6c3'),
        tie('5r3c9', '5r7c9'),
        tie('8r6c3', '8r5c3'),
        tie('8r5c3', '1r5c3'),
        weak('9r7c9 5r7c9', '6r7c9', 'r7c9 holds a dark purple 9 and a light purple 5 (the corner marks); one of them is true, so its 6 is false.')
      ],
      '6r7c9'
    )
  },
  {
    name: 'medusa5',
    puzzle: '.....2....76...1..2.4...9..6..9......5...1.2.3.18..5....91.....51.....4......4..6',
    at: 32,
    step: parity(
      'MEDUSA_3D',
      'medusa5',
      [['5r7c9 7r7c8 7r8c6 7r1c7', '5r7c8 5r3c9 7r8c7']],
      [
        tie('5r7c8', '5r7c9', medusa),
        tie('5r7c8', '7r7c8'),
        tie('5r7c9', '5r3c9'),
        tie('7r7c8', '7r8c7'),
        tie('7r8c7', '7r8c6'),
        tie('7r8c7', '7r1c7'),
        weak('7r1c7', '7r3c9', 'If dark purple is true, the 7 in r1c7 is true, and the 7 in r3c9 goes.'),
        weak('5r3c9', '7r3c9', 'If light purple is true, r3c9 is 5 (the corner marks), and its 7 goes. Either way the 7 is false.')
      ],
      '7r3c9'
    )
  },
  {
    name: 'medusa6',
    puzzle: '.7...4..6.1......2..3.5...7.9....4...6.2.....7.......1..23.7.......89.5.....6...8',
    at: 27,
    step: parity(
      'MEDUSA_3D',
      'medusa6',
      [['3r4c9 3r5c1 5r5c9 1r5c5 8r5c6 7r4c5', '3r4c1 3r5c9 5r4c9 1r5c1 5r5c6 1r4c5']],
      [
        tie('3r4c1', '3r4c9', medusa),
        tie('3r4c1', '3r5c1'),
        tie('3r4c9', '3r5c9'),
        tie('3r4c9', '5r4c9'),
        tie('3r5c1', '1r5c1'),
        tie('3r5c9', '5r5c9'),
        tie('1r5c1', '1r5c5'),
        tie('5r5c9', '5r5c6'),
        tie('1r5c5', '1r4c5'),
        tie('5r5c6', '8r5c6'),
        tie('1r4c5', '7r4c5'),
        weak('7r4c5', '7r4c4', 'If dark purple is true, the 7 in r4c5 is true, and r4c4 loses its 7.'),
        weak('8r5c6', '8r4c4', 'If dark purple is true, the 8 in r5c6 is true, and r4c4 loses its 8. r4c4 would then be empty, so dark purple cannot be true.')
      ],
      '3r4c9 3r5c1 5r5c9 1r5c5 8r5c6 7r4c5',
      0
    )
  },
  {
    name: 'remotePair',
    puzzle: '.2..17..567............2.8.2.496...78.......27...214.8.1.2............633..49..7.',
    at: 42,
    step: parity(
      'REMOTE_PAIR',
      'remotePair',
      [['3r2c3 3r3c4 3r5c5 5r2c5 5r6c4', '5r2c3 5r3c4 5r5c5 3r2c5 3r6c4']],
      [
        tie(
          '3r2c3',
          '3r2c5',
          'The cells r2c3, r2c5, r3c4, r5c5 and r6c4 hold only 3 and 5. Each line joins two of them that see each other: they cannot hold the same digit, so their 3s take opposite shades, and so do their 5s.'
        ),
        tie('3r2c5', '3r3c4'),
        tie('3r2c5', '3r5c5'),
        tie('3r5c5', '3r6c4'),
        // each cell's two candidates: exactly one is true, side by side, no line
        tie('3r2c3', '5r2c3'),
        tie('3r2c5', '5r2c5'),
        tie('3r3c4', '5r3c4'),
        tie('3r5c5', '5r5c5'),
        tie('3r6c4', '5r6c4'),
        weak('3r2c3', '3r6c3', 'If dark purple is true, the 3 in r2c3 is true, and the 3 in r6c3 goes.'),
        weak('3r6c4', '3r6c3', 'If light purple is true, the 3 in r6c4 is true, and the 3 in r6c3 goes. Either way it is false.')
      ],
      '3r6c3'
    )
  }
];

export const fixture = (name: string): ParityFixture => {
  const f = PARITY_FIXTURES.find((x) => x.name === name);
  if (!f) throw new Error(`no fixture ${name}`);
  return f;
};

const positions = new Map<string, { grid: Grid; solution: Uint8Array }>();

/** the position a fixture is drawn at, and the puzzle's solution */
export function positionOf(f: ParityFixture): { grid: Grid; solution: Uint8Array } {
  const key = `${f.puzzle}@${f.at}`;
  let p = positions.get(key);
  if (!p) {
    const grid = parseGrid(f.puzzle)!;
    for (let k = 0; k < f.at; k++) applyStep(grid, findNextStep(grid)!);
    p = { grid, solution: solve(parseGrid(f.puzzle)!)!.values };
    positions.set(key, p);
  }
  return p;
}

/** the position as a stored example keeps it: placed digits ('0' for empty), every cell's candidates */
export function exampleOf(f: ParityFixture) {
  const { grid } = positionOf(f);
  return { puzzle: f.puzzle, stepIndex: f.at, values: Array.from(grid.values).join(''), cands: Array.from(grid.cands), step: f.step };
}
