// The language of sudoku solving, each term defined once. Shown in the
// Learn dialog and on the static glossary page; terms used inside the
// technique explanations link here (see glossaryLinks.ts).
//
// Each definition was reviewed for the logic it states and against how
// sudokUI itself names and does things. Limits and house style are
// enforced by tests/content.test.ts.

export type GlossaryGroup =
  | 'The board'
  | 'Notation'
  | 'Basic logic'
  | 'Links and chains'
  | 'Patterns'
  | 'Uniqueness'
  | 'Solving and rating';

export interface GlossaryEntry {
  term: string;
  /** one or two sentences, precise and self-contained */
  definition: string;
  /** other names for the same thing */
  aka: string[];
  /** related terms, spelled exactly like their own `term` */
  see: string[];
  group: GlossaryGroup;
}

export const GLOSSARY_GROUPS: GlossaryGroup[] = [
  'The board',
  'Notation',
  'Basic logic',
  'Links and chains',
  'Patterns',
  'Uniqueness',
  'Solving and rating'
];

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'cell',
    definition: 'One of the 81 squares of the grid. It holds a given, a digit you have placed, or pencil marks while it is unsolved.',
    aka: ['square'],
    see: ['given', 'cell name', 'peer'],
    group: 'The board'
  },
  {
    term: 'row',
    definition: 'A horizontal line of nine cells. Each digit from 1 to 9 appears exactly once in every row.',
    aka: [],
    see: ['column', 'line', 'unit'],
    group: 'The board'
  },
  {
    term: 'column',
    definition: 'A vertical line of nine cells. Each digit from 1 to 9 appears exactly once in every column.',
    aka: [],
    see: ['row', 'line', 'unit'],
    group: 'The board'
  },
  {
    term: 'box',
    definition: 'One of the nine squares of three by three cells marked by thick lines. Each digit from 1 to 9 appears exactly once in every box.',
    aka: ['block', 'region', 'nonet'],
    see: ['unit', 'band', 'stack'],
    group: 'The board'
  },
  {
    term: 'unit',
    definition: 'A row, a column or a box: any group of nine cells that must contain each digit from 1 to 9 exactly once. The grid has 27 units.',
    aka: ['house'],
    see: ['row', 'column', 'box', 'peer'],
    group: 'The board'
  },
  {
    term: 'line',
    definition: 'A row or a column. The word is used when a rule works the same way in both directions.',
    aka: [],
    see: ['row', 'column', 'unit'],
    group: 'The board'
  },
  {
    term: 'band',
    definition: 'Three boxes side by side, covering three neighbouring rows. The grid has three bands: top, middle and bottom.',
    aka: ['floor'],
    see: ['stack', 'chute', 'difficulty band'],
    group: 'The board'
  },
  {
    term: 'stack',
    definition: 'Three boxes on top of each other, covering three neighbouring columns. The grid has three stacks: left, middle and right.',
    aka: ['tower'],
    see: ['band', 'chute'],
    group: 'The board'
  },
  {
    term: 'chute',
    definition: 'A band or a stack: three boxes in a line, together with the three rows or columns that run through them.',
    aka: [],
    see: ['band', 'stack', 'box'],
    group: 'The board'
  },
  {
    term: 'intersection',
    definition: 'The three cells that a box shares with a row or column crossing it. Locked candidates work on intersections, and a grouped node lies inside one.',
    aka: ['mini-line', 'box-line intersection'],
    see: ['locked candidates', 'pointing', 'claiming', 'grouped node'],
    group: 'The board'
  },
  {
    term: 'peer',
    definition: 'A cell that shares a row, column or box with another cell. Every cell has 20 peers, and no peer can hold the same digit as the cell itself.',
    aka: ['buddy'],
    see: ['sees', 'unit'],
    group: 'The board'
  },
  {
    term: 'sees',
    definition: 'Two cells see each other when they share a row, column or box, so they cannot hold the same digit. Two candidates for the same digit see each other when their cells do.',
    aka: [],
    see: ['peer', 'unit', 'weak link'],
    group: 'The board'
  },
  {
    term: 'given',
    definition: 'A digit printed in the puzzle from the start. Givens are always correct and cannot be changed.',
    aka: ['clue'],
    see: ['cell', 'unique solution'],
    group: 'The board'
  },
  {
    term: 'pencil mark',
    definition: 'A small digit written in a cell as a note, usually to record a candidate. sudokUI has two positions for pencil marks, corner and centre.',
    aka: ['note', 'pencilmark'],
    see: ['candidate', 'corner mark', 'centre mark', 'Snyder notation'],
    group: 'Notation'
  },
  {
    term: 'corner mark',
    definition: "A pencil mark sudokUI draws at its digit's fixed spot in a three by three layout, or round the cell's edge when centre marks share the cell. Corner is a position, not a meaning, though Snyder notation usually goes there.",
    aka: ['corner pencil mark'],
    see: ['pencil mark', 'centre mark', 'Snyder notation'],
    group: 'Notation'
  },
  {
    term: 'centre mark',
    definition: "A pencil mark normally written in the middle of the cell, the usual place for a full list of candidates. Hints read both positions alike, but Auto and Check treat centre marks as the cell's remaining candidates.",
    aka: ['centre pencil mark', 'center mark'],
    see: ['pencil mark', 'corner mark', 'candidate', 'auto candidates'],
    group: 'Notation'
  },
  {
    term: 'Snyder notation',
    definition: 'A marking method named after Thomas Snyder: in each box, a digit is marked only if it has exactly two possible places there. The marks are partial, so a missing mark does not mean the digit is eliminated.',
    aka: ['Snyder marks'],
    see: ['pencil mark', 'corner mark', 'box'],
    group: 'Notation'
  },
  {
    term: 'auto candidates',
    definition: 'A sudokUI tool, switched on with the Auto button, that works out the candidates of every unsolved cell and keeps them up to date. New games start with it off, except practice puzzles that jump to the technique.',
    aka: ['auto'],
    see: ['candidate', 'pencil mark', 'centre mark'],
    group: 'Notation'
  },
  {
    term: 'cell name',
    definition: 'The address of a cell, written as its row and column numbers counted from the top left: r3c5 is the cell in row 3, column 5. sudokUI hints name cells this way.',
    aka: ['r1c1 notation'],
    see: ['cell', 'row', 'column'],
    group: 'Notation'
  },
  {
    term: 'candidate',
    definition: 'A digit that is still possible in an unsolved cell: no peer of the cell holds it, and no logic has ruled it out. Solving removes candidates until every cell has one left.',
    aka: ['possibility'],
    see: ['pencil mark', 'elimination', 'peer', 'auto candidates'],
    group: 'Basic logic'
  },
  {
    term: 'placement',
    definition: 'Writing a digit into a cell as its final value. A hint that ends in a placement has proved that the digit must go there.',
    aka: [],
    see: ['elimination', 'single'],
    group: 'Basic logic'
  },
  {
    term: 'elimination',
    definition: 'Removing a candidate from a cell because logic proves the digit cannot go there. Most advanced techniques end in eliminations, not placements.',
    aka: ['exclusion'],
    see: ['candidate', 'placement', 'technique'],
    group: 'Basic logic'
  },
  {
    term: 'single',
    definition: 'A placement forced because only one possibility is left: a cell with one candidate (naked single) or a digit with one possible cell in a unit (hidden single).',
    aka: [],
    see: ['naked', 'hidden', 'full house', 'placement'],
    group: 'Basic logic'
  },
  {
    term: 'full house',
    definition: 'A unit with only one empty cell left, which must take the one digit the unit is missing. It is the simplest kind of single.',
    aka: ['last digit'],
    see: ['single', 'unit'],
    group: 'Basic logic'
  },
  {
    term: 'naked',
    definition: "Describes a pattern found in the cells: N cells of one unit hold only N candidates between them. A naked single is a cell with one candidate; a naked pair removes its two digits from the unit's other cells.",
    aka: [],
    see: ['hidden', 'single', 'subset', 'locked set'],
    group: 'Basic logic'
  },
  {
    term: 'hidden',
    definition: 'Describes a pattern found in the digits: N digits of one unit have only N cells to go in. A hidden single is a digit with one possible cell; a hidden pair removes all other candidates from its two cells.',
    aka: [],
    see: ['naked', 'single', 'subset'],
    group: 'Basic logic'
  },
  {
    term: 'subset',
    definition: 'N cells of one unit that must hold N digits between them, found as a naked or a hidden pattern. Sizes two, three and four are called pair, triple and quadruple.',
    aka: [],
    see: ['naked', 'hidden', 'locked set'],
    group: 'Basic logic'
  },
  {
    term: 'locked set',
    definition: 'N unsolved cells in one unit that hold exactly N candidates between them. Those digits must fill those cells, so they are removed from every other cell of the unit.',
    aka: ['naked subset'],
    see: ['subset', 'naked', 'almost locked set'],
    group: 'Basic logic'
  },
  {
    term: 'locked candidates',
    definition: 'A digit whose possible cells in one unit all lie inside its intersection with a second unit. The digit must go in the intersection, so it is removed from the rest of the second unit.',
    aka: ['intersection removal'],
    see: ['intersection', 'pointing', 'claiming'],
    group: 'Basic logic'
  },
  {
    term: 'pointing',
    definition: 'Locked candidates starting from a box: every place for a digit in the box lies in one row or column, so the digit is removed from the rest of that row or column.',
    aka: ['locked candidates type 1', 'pointing pair', 'pointing triple'],
    see: ['locked candidates', 'claiming', 'intersection'],
    group: 'Basic logic'
  },
  {
    term: 'claiming',
    definition: 'Locked candidates starting from a line: every place for a digit in a row or column lies in one box, so the digit is removed from the rest of that box.',
    aka: ['locked candidates type 2', 'box-line reduction'],
    see: ['locked candidates', 'pointing', 'intersection'],
    group: 'Basic logic'
  },
  {
    term: 'bivalue cell',
    definition: 'An unsolved cell with exactly two candidates. Exactly one of them is true, so the two are joined by a strong link and a weak link at once.',
    aka: ['bi-value cell'],
    see: ['strong link', 'weak link', 'conjugate pair', 'BUG'],
    group: 'Links and chains'
  },
  {
    term: 'conjugate pair',
    definition: 'The only two candidates for a digit in a unit. Exactly one is true: if one is false the other is true (strong link), and if one is true the other is false (weak link).',
    aka: [],
    see: ['bilocation', 'strong link', 'weak link', 'colouring'],
    group: 'Links and chains'
  },
  {
    term: 'bilocation',
    definition: 'A digit that has exactly two possible cells left in a unit. Those two candidates form a conjugate pair.',
    aka: [],
    see: ['conjugate pair', 'bivalue cell', 'strong link'],
    group: 'Links and chains'
  },
  {
    term: 'strong link',
    definition: 'A link between candidates A and B meaning that if A is false then B is true, so at least one of them is true. Conjugate pairs and bivalue cells give strong links.',
    aka: ['strong inference'],
    see: ['weak link', 'conjugate pair', 'bivalue cell', 'inference'],
    group: 'Links and chains'
  },
  {
    term: 'weak link',
    definition: 'A link between candidates A and B meaning that if A is true then B is false, so at most one of them is true. Two candidates in one cell, or for one digit in one unit, are weakly linked.',
    aka: ['weak inference'],
    see: ['strong link', 'sees', 'inference'],
    group: 'Links and chains'
  },
  {
    term: 'inference',
    definition: 'One step of reasoning from one candidate to the next. A strong inference says that if this is false, that is true; a weak inference says that if this is true, that is false.',
    aka: ['link'],
    see: ['strong link', 'weak link', 'chain'],
    group: 'Links and chains'
  },
  {
    term: 'chain',
    definition: 'A sequence of nodes joined by links, each inference feeding the next, so that one state of the first node forces a state of the last.',
    aka: [],
    see: ['node', 'inference', 'alternating inference chain', 'nice loop'],
    group: 'Links and chains'
  },
  {
    term: 'node',
    definition: 'One element of a chain. It is usually a single candidate, meaning one digit in one cell, but it can also be a grouped node or an almost locked set.',
    aka: [],
    see: ['chain', 'grouped node', 'almost locked set'],
    group: 'Links and chains'
  },
  {
    term: 'alternating inference chain',
    definition: 'A chain whose links alternate strong and weak, beginning and ending with a strong link. At least one of its two end nodes is true, so any candidate that is weakly linked to both ends is eliminated.',
    aka: ['AIC', 'alternate inference chain'],
    see: ['chain', 'strong link', 'weak link', 'nice loop', 'grouped node'],
    group: 'Links and chains'
  },
  {
    term: 'grouped node',
    definition: 'A node made of the two or three candidates for one digit inside one intersection. It counts as true when any one of its cells holds the digit.',
    aka: ['group node'],
    see: ['node', 'intersection', 'alternating inference chain'],
    group: 'Links and chains'
  },
  {
    term: 'nice loop',
    definition: 'A chain of alternating strong and weak links that closes into a loop by returning to where it started. It is continuous if the alternation holds all the way round, and discontinuous if it breaks at one node.',
    aka: [],
    see: ['continuous loop', 'discontinuous loop', 'X-cycle', 'alternating inference chain'],
    group: 'Links and chains'
  },
  {
    term: 'continuous loop',
    definition: 'A nice loop whose links alternate without a break. Every weak link in it has exactly one true end, so any other candidate that is weakly linked to both ends of such a link is eliminated.',
    aka: ['continuous nice loop'],
    see: ['nice loop', 'discontinuous loop', 'weak link'],
    group: 'Links and chains'
  },
  {
    term: 'discontinuous loop',
    definition: 'A nice loop whose alternation breaks at one node. Two strong links meeting there prove that candidate true, and two weak links meeting there prove it false.',
    aka: ['discontinuous nice loop'],
    see: ['nice loop', 'continuous loop', 'strong link', 'weak link'],
    group: 'Links and chains'
  },
  {
    term: 'X-cycle',
    definition: 'A nice loop on a single digit: a closed chain of strong and weak links between the possible cells of one digit.',
    aka: ['fishy cycle'],
    see: ['nice loop', 'continuous loop', 'discontinuous loop', 'conjugate pair'],
    group: 'Links and chains'
  },
  {
    term: 'colouring',
    definition: "Giving a cluster's candidates two colours so that the ends of every conjugate pair differ. One colour is all true: a colour with two candidates that see each other is false, as is an outside candidate seeing both colours.",
    aka: ['Simple Colors', 'simple colours', 'coloring'],
    see: ['cluster', 'conjugate pair', 'sees'],
    group: 'Links and chains'
  },
  {
    term: 'cluster',
    definition: 'A set of candidates connected to each other by conjugate pairs (and, in 3D Medusa, by bivalue cells). Settling one of them settles them all, which is why a cluster can be coloured in two colours.',
    aka: [],
    see: ['colouring', 'conjugate pair', 'bivalue cell'],
    group: 'Links and chains'
  },
  {
    term: 'forcing chain',
    definition: 'A technique that follows each case of a premise, such as every candidate of one cell, to its consequences. What holds in every case is true, and a single case that ends in a contradiction is false.',
    aka: [],
    see: ['chain', 'forcing net', 'Nishio'],
    group: 'Links and chains'
  },
  {
    term: 'forcing net',
    definition: 'A forcing chain whose reasoning may branch and rejoin, so that one conclusion can depend on several earlier ones together. It is the last logical technique sudokUI tries before brute force.',
    aka: [],
    see: ['forcing chain', 'Nishio', 'brute force'],
    group: 'Links and chains'
  },
  {
    term: 'Nishio',
    definition: 'A test of one candidate: assume it is true and follow the consequences. If they lead to a contradiction, the candidate is false and is eliminated.',
    aka: ['Nishio forcing chain'],
    see: ['forcing chain', 'forcing net', 'elimination'],
    group: 'Links and chains'
  },
  {
    term: 'fish',
    definition: 'A pattern on one digit: N base sets whose candidates for the digit all lie inside N cover sets. The digit is removed from every cell of the cover sets that is not in a base set.',
    aka: [],
    see: ['base set', 'cover set', 'X-wing', 'fin', 'franken fish'],
    group: 'Patterns'
  },
  {
    term: 'X-wing',
    definition: 'The smallest fish: in two rows (or columns) a digit has places only in the same two columns (or rows), so it is removed from the rest of those. Swordfish and jellyfish use three and four lines.',
    aka: [],
    see: ['fish', 'base set', 'cover set', 'line'],
    group: 'Patterns'
  },
  {
    term: 'base set',
    definition: 'One of the N units that define a fish, usually rows or columns. Base sets share no candidates, and each must hold the digit exactly once, which makes N true cells in all.',
    aka: ['base unit'],
    see: ['fish', 'cover set', 'fin'],
    group: 'Patterns'
  },
  {
    term: 'cover set',
    definition: "One of the N units that together contain every candidate of a fish's base sets. The base sets need N true cells and each cover set takes only one, so cover set cells outside the base sets lose the digit.",
    aka: ['cover unit'],
    see: ['fish', 'base set', 'fin'],
    group: 'Patterns'
  },
  {
    term: 'fin',
    definition: 'A candidate in a base set of a fish that lies outside every cover set. Either one of the fins is true or the plain fish holds, so the fish eliminates only candidates that see every fin.',
    aka: [],
    see: ['fish', 'sashimi', 'base set', 'cover set'],
    group: 'Patterns'
  },
  {
    term: 'sashimi',
    definition: 'A finned fish that would be incomplete without its fins: with every fin false, some base set has at most one place left for the digit. Eliminations follow the same rule as for any finned fish.',
    aka: ['sashimi fish'],
    see: ['fin', 'fish', 'base set'],
    group: 'Patterns'
  },
  {
    term: 'franken fish',
    definition: 'A fish in which boxes are allowed among the base sets or the cover sets. Apart from boxes, one side uses only rows and the other only columns.',
    aka: [],
    see: ['fish', 'base set', 'cover set', 'box'],
    group: 'Patterns'
  },
  {
    term: 'wing',
    definition: 'A small pattern, such as the XY-wing, XYZ-wing or W-wing, proving that a digit Z must go in one of a few cells. Z is removed from every cell that sees all of them.',
    aka: [],
    see: ['pivot', 'pincer', 'bivalue cell', 'sees'],
    group: 'Patterns'
  },
  {
    term: 'pivot',
    definition: 'The middle cell of an XY-wing or XYZ-wing, which sees both pincers. In a WXYZ-wing it is the cell holding X (rarely two) among the three sharing a unit, seen by the fourth cell, bivalue with X and Z.',
    aka: ['hinge'],
    see: ['wing', 'pincer'],
    group: 'Patterns'
  },
  {
    term: 'pincer',
    definition: 'One of the two outer cells of an XY-wing or XYZ-wing, each of which sees the pivot. In an XY-wing the pincers hold XZ and YZ, and one of them must be Z.',
    aka: ['pincer cell'],
    see: ['wing', 'pivot'],
    group: 'Patterns'
  },
  {
    term: 'almost locked set',
    definition: 'N unsolved cells in one unit that hold exactly N+1 candidates between them. If any one of those digits is removed from all the cells, they become a locked set of the N digits that remain.',
    aka: ['ALS'],
    see: ['locked set', 'restricted common candidate', 'bivalue cell'],
    group: 'Patterns'
  },
  {
    term: 'restricted common candidate',
    definition: 'A digit shared by two almost locked sets, where all its cells in one see all its cells in the other. It can be true in at most one set, and a set that loses it becomes a locked set.',
    aka: ['RCC', 'restricted common'],
    see: ['almost locked set', 'locked set', 'sees'],
    group: 'Patterns'
  },
  {
    term: 'template',
    definition: 'One complete way to place a digit in all nine rows, columns and boxes that agrees with the current grid. A candidate found in no template is eliminated, and a cell found in every template takes the digit.',
    aka: ['pattern overlay', 'pattern overlay method', 'POM'],
    see: ['elimination', 'placement', 'Exocet'],
    group: 'Patterns'
  },
  {
    term: 'Exocet',
    definition: 'Two base cells in one intersection, with three or four candidates between them, and two target cells elsewhere in their chute that must take the same two digits as the base. The targets lose every candidate the base cells lack.',
    aka: [],
    see: ['intersection', 'chute', 'template', 'elimination'],
    group: 'Patterns'
  },
  {
    term: 'uniqueness',
    definition: 'The fact that a proper puzzle has exactly one solution, used as a solving argument. Any candidate that would leave a deadly pattern, and so two solutions, is false.',
    aka: ['uniqueness technique'],
    see: ['unique solution', 'deadly pattern', 'unique rectangle', 'BUG'],
    group: 'Uniqueness'
  },
  {
    term: 'unique solution',
    definition: 'The one and only way to complete a proper sudoku from its givens. sudokUI checks that every puzzle it generates, and every puzzle you import or type in, has exactly one solution.',
    aka: [],
    see: ['uniqueness', 'given', 'brute force'],
    group: 'Uniqueness'
  },
  {
    term: 'deadly pattern',
    definition: 'A set of cells, none of them givens, whose digits could be swapped among themselves without breaking any rule. That would mean two solutions, so the solution of a proper puzzle never contains such a pattern.',
    aka: [],
    see: ['uniqueness', 'unique rectangle', 'BUG', 'given'],
    group: 'Uniqueness'
  },
  {
    term: 'unique rectangle',
    definition: 'Four cells in two rows, two columns and two boxes sharing the same two candidates. With only those two digits in all four it would be a deadly pattern, so at least one extra candidate in the rectangle is true.',
    aka: ['UR'],
    see: ['deadly pattern', 'uniqueness'],
    group: 'Uniqueness'
  },
  {
    term: 'BUG',
    definition: 'A state where every unsolved cell has exactly two candidates and every candidate occurs exactly twice in each of its units, ruling out a unique solution. BUG+1 adds one candidate to one cell, and that candidate is true.',
    aka: ['bivalue universal grave'],
    see: ['bivalue cell', 'deadly pattern', 'uniqueness'],
    group: 'Uniqueness'
  },
  {
    term: 'technique',
    definition: 'A named pattern of logic that justifies a placement or an elimination, such as a hidden single or an X-wing. Each technique has a score that counts towards the rating.',
    aka: ['strategy'],
    see: ['rating', 'solve path', 'placement', 'elimination'],
    group: 'Solving and rating'
  },
  {
    term: 'solve path',
    definition: 'The ordered list of steps that solves a puzzle. sudokUI builds it by trying techniques in a fixed order, roughly easiest first, and taking the first that works at every step, and shows it under Steps.',
    aka: ['solution path'],
    see: ['technique', 'crux', 'rating'],
    group: 'Solving and rating'
  },
  {
    term: 'crux',
    definition: 'The most expensive step of the solve path: the one whose technique has the highest score. sudokUI highlights it in the Steps list.',
    aka: [],
    see: ['solve path', 'technique', 'rating'],
    group: 'Solving and rating'
  },
  {
    term: 'rating',
    definition: "A puzzle's difficulty as a number: the sum of the technique scores of every step along the solve path. Scores are compatible with HoDoKu, from 4 for a naked single upwards.",
    aka: ['score', 'difficulty rating'],
    see: ['solve path', 'technique', 'difficulty band', 'HoDoKu'],
    group: 'Solving and rating'
  },
  {
    term: 'difficulty band',
    definition: "One of eight named levels of difficulty: Beginner, Easy, Medium, Tricky, Hard, Unfair, Extreme and Nightmare. A puzzle's band follows from its rating and from the hardest techniques it needs.",
    aka: ['difficulty level', 'level'],
    see: ['rating', 'technique', 'HoDoKu', 'band'],
    group: 'Solving and rating'
  },
  {
    term: 'brute force',
    definition: "Solving by trial and error: try a digit, carry on, and go back when a contradiction appears. In sudokUI it checks that a puzzle has a unique solution, and it is the solver's last resort, scored at 10000.",
    aka: ['backtracking', 'trial and error'],
    see: ['unique solution', 'forcing net', 'rating'],
    group: 'Solving and rating'
  },
  {
    term: 'HoDoKu',
    definition: 'A free, open source sudoku program by Bernhard Hobiger, known for its solver, technique guide and difficulty scores. sudokUI takes its technique scores and solving order from HoDoKu, so ratings can be compared.',
    aka: [],
    see: ['rating', 'difficulty band', 'technique'],
    group: 'Solving and rating'
  }
];
