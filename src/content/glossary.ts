// The language of sudoku solving, each term defined once. Shown in the
// Learn dialog and on the static glossary pages; terms used inside the
// technique explanations link here (see glossaryLinks.ts).
//
// Audited and expanded from the research brief in docs/glossary_input.md,
// which also supplies the Norwegian and Spanish texts (locales/). Each
// definition states logic that holds and describes sudokUI as it is.
// Limits and house style are enforced by tests/content.test.ts.

export type GlossaryGroup =
  | 'The board'
  | 'Notation'
  | 'Basic logic'
  | 'Links and chains'
  | 'Fish'
  | 'Wings and other patterns'
  | 'Uniqueness'
  | 'Solving and rating';

/** the words of one entry in one language */
export interface GlossaryText {
  term: string;
  /** other names for the same thing */
  aka: string[];
  /** precise and self-contained */
  definition: string;
}

export interface GlossaryEntry extends GlossaryText {
  /** stable across languages: the anchor on the glossary page */
  id: string;
  /** related entries, by id */
  see: string[];
  group: GlossaryGroup;
  /** about sudokUI itself rather than sudoku in general */
  app?: boolean;
}

export const GLOSSARY_GROUPS: GlossaryGroup[] = [
  'The board',
  'Notation',
  'Basic logic',
  'Links and chains',
  'Fish',
  'Wings and other patterns',
  'Uniqueness',
  'Solving and rating'
];

export const GLOSSARY: GlossaryEntry[] = [
  {
    id: 'cell',
    term: 'cell',
    definition: 'One of the 81 squares of the grid. It holds a given, a digit you have placed, or pencil marks while it is unsolved.',
    aka: ['square'],
    see: ['given', 'cell-name', 'peer'],
    group: 'The board'
  },
  {
    id: 'row',
    term: 'row',
    definition: 'A horizontal line of nine cells. Each digit from 1 to 9 appears exactly once in every row.',
    aka: [],
    see: ['column', 'line', 'unit'],
    group: 'The board'
  },
  {
    id: 'column',
    term: 'column',
    definition: 'A vertical line of nine cells. Each digit from 1 to 9 appears exactly once in every column.',
    aka: [],
    see: ['row', 'line', 'unit'],
    group: 'The board'
  },
  {
    id: 'box',
    term: 'box',
    definition: 'One of the nine squares of three by three cells marked by thick lines. Each digit from 1 to 9 appears exactly once in every box. Boxes are numbered 1 to 9 from the top left, row by row.',
    aka: ['block', 'region', 'nonet'],
    see: ['unit', 'band', 'stack'],
    group: 'The board'
  },
  {
    id: 'unit',
    term: 'unit',
    definition: 'A row, a column or a box: any group of nine cells that must contain each digit from 1 to 9 exactly once. The grid has 27 units.',
    aka: ['house'],
    see: ['row', 'column', 'box', 'peer'],
    group: 'The board'
  },
  {
    id: 'line',
    term: 'line',
    definition: 'A row or a column. The word is used when a rule works the same way in both directions.',
    aka: [],
    see: ['row', 'column', 'unit'],
    group: 'The board'
  },
  {
    id: 'band',
    term: 'band',
    definition: 'Three boxes side by side, covering three neighbouring rows. The grid has three bands: top, middle and bottom. Not to be confused with a difficulty band.',
    aka: ['floor'],
    see: ['stack', 'chute', 'difficulty-band'],
    group: 'The board'
  },
  {
    id: 'stack',
    term: 'stack',
    definition: 'Three boxes on top of each other, covering three neighbouring columns. The grid has three stacks: left, middle and right.',
    aka: ['tower'],
    see: ['band', 'chute'],
    group: 'The board'
  },
  {
    id: 'chute',
    term: 'chute',
    definition: 'A band or a stack: three boxes in a line, together with the three rows or columns that run through them.',
    aka: [],
    see: ['band', 'stack', 'box'],
    group: 'The board'
  },
  {
    id: 'intersection',
    term: 'intersection',
    definition: 'The three cells that a box shares with a row or column crossing it. Locked candidates work on intersections, and a grouped node lies inside one.',
    aka: ['mini-line', 'minirow', 'minicolumn', 'box-line intersection'],
    see: ['locked-candidates', 'pointing', 'claiming', 'grouped-node'],
    group: 'The board'
  },
  {
    id: 'peer',
    term: 'peer',
    definition: 'A cell that shares a row, column or box with another cell. Every cell has 20 peers, and no peer can hold the same digit as the cell itself.',
    aka: ['buddy'],
    see: ['sees', 'unit'],
    group: 'The board'
  },
  {
    id: 'sees',
    term: 'sees',
    definition: 'Two cells see each other when they share a row, column or box, so they cannot hold the same digit. Two candidates for the same digit see each other when their cells do.',
    aka: [],
    see: ['peer', 'unit', 'weak-link'],
    group: 'The board'
  },
  {
    id: 'digit',
    term: 'digit',
    definition: 'One of the nine symbols 1 to 9. Digits are labels, not quantities, so no arithmetic is involved.',
    aka: ['number', 'value'],
    see: ['cell', 'candidate'],
    group: 'The board'
  },
  {
    id: 'given',
    term: 'given',
    definition: 'A digit printed in the puzzle from the start. Givens are always correct and cannot be changed.',
    aka: ['clue'],
    see: ['cell', 'unique-solution'],
    group: 'The board'
  },
  {
    id: 'solution',
    term: 'solution',
    definition: 'A completely filled grid that keeps every given and obeys the rule in all 27 units.',
    aka: [],
    see: ['unique-solution', 'proper-puzzle'],
    group: 'The board'
  },
  {
    id: 'proper-puzzle',
    term: 'proper puzzle',
    definition: 'A puzzle with exactly one solution. Uniqueness techniques are valid only for proper puzzles.',
    aka: ['valid puzzle'],
    see: ['unique-solution', 'uniqueness'],
    group: 'The board'
  },
  {
    id: 'pencil-mark',
    term: 'pencil mark',
    definition: 'A small digit written in a cell as a note, usually to record a candidate. sudokUI has two positions for pencil marks, corner and centre.',
    aka: ['note', 'pencilmark'],
    see: ['candidate', 'corner-mark', 'centre-mark', 'snyder-notation', 'pencil-mark-grid'],
    group: 'Notation'
  },
  {
    id: 'pencil-mark-grid',
    term: 'pencil mark grid',
    definition: 'The grid with every candidate of every unsolved cell written in. Most techniques beyond singles are read from it.',
    aka: ['PM'],
    see: ['pencil-mark', 'auto-candidates'],
    group: 'Notation'
  },
  {
    id: 'corner-mark',
    term: 'corner mark',
    definition: "A pencil mark drawn at its digit's fixed spot in a three by three layout; when centre marks share the cell, the corner marks go round its edge in digit order. Corner is a position, not a meaning, though Snyder notation usually goes there.",
    aka: ['corner pencil mark'],
    see: ['pencil-mark', 'centre-mark', 'snyder-notation'],
    group: 'Notation',
    app: true
  },
  {
    id: 'centre-mark',
    term: 'centre mark',
    definition: "A pencil mark written in the middle of the cell, the usual place for a full list of candidates. Check reads centre marks as the cell's remaining candidates; hints and Scan read corner and centre marks alike, once you have said your marks are your remaining candidates.",
    aka: ['centre pencil mark', 'center mark'],
    see: ['pencil-mark', 'corner-mark', 'candidate', 'auto-candidates'],
    group: 'Notation',
    app: true
  },
  {
    id: 'snyder-notation',
    term: 'Snyder notation',
    definition: 'A marking method named after Thomas Snyder: in each box, a digit is marked only if it has exactly two possible places there, though some solvers also mark three. The marks are partial, so a missing mark does not mean the digit is eliminated.',
    aka: ['Snyder marks'],
    see: ['pencil-mark', 'corner-mark', 'box'],
    group: 'Notation'
  },
  {
    id: 'cell-name',
    term: 'cell name',
    definition: 'The address of a cell, written as its row and column numbers counted from the top left: r3c5 is the cell in row 3, column 5. Some solvers combine cells, so r57c2 means r5c2 and r7c2; sudokUI hints name each cell separately.',
    aka: ['r1c1 notation'],
    see: ['cell', 'row', 'column'],
    group: 'Notation'
  },
  {
    id: 'auto-candidates',
    term: 'auto candidates',
    definition: 'A sudokUI tool, switched on with the Auto candidates button, that works out the candidates of every unsolved cell and keeps them up to date. New games start with it off; a practice puzzle that jumps straight to its technique starts with it on.',
    aka: ['Auto'],
    see: ['candidate', 'pencil-mark', 'centre-mark'],
    group: 'Notation',
    app: true
  },
  {
    id: 'check',
    term: 'Check',
    definition: 'A sudokUI button that compares your placed digits with the solution and checks that each marked cell still lists its true digit: the auto candidates when they are on, otherwise your centre marks, and your corner marks too once you have said your marks are your remaining candidates. Mistakes are tinted red.',
    aka: [],
    see: ['centre-mark', 'solution'],
    group: 'Notation',
    app: true
  },
  {
    id: 'steps',
    term: 'Steps',
    definition: 'The sudokUI list of the whole solve path from the start of the puzzle, with the crux marked. Clicking a step sets the board to the position just before it.',
    aka: [],
    see: ['solve-path', 'crux'],
    group: 'Notation',
    app: true
  },
  {
    id: 'candidate',
    term: 'candidate',
    definition: 'A digit that is still possible in an unsolved cell: no peer of the cell holds it, and no logic has ruled it out. Solving removes candidates until every cell has one left.',
    aka: ['possibility'],
    see: ['pencil-mark', 'elimination', 'peer', 'auto-candidates'],
    group: 'Basic logic'
  },
  {
    id: 'placement',
    term: 'placement',
    definition: 'Writing a digit into a cell as its final value. A hint that ends in a placement has proved that the digit must go there.',
    aka: [],
    see: ['elimination', 'single'],
    group: 'Basic logic'
  },
  {
    id: 'elimination',
    term: 'elimination',
    definition: 'Removing a candidate from a cell because logic proves the digit cannot go there. Most advanced techniques end in eliminations, not placements.',
    aka: ['exclusion'],
    see: ['candidate', 'placement', 'technique'],
    group: 'Basic logic'
  },
  {
    id: 'contradiction',
    term: 'contradiction',
    definition: 'A state that breaks the rules: a cell with no candidates, a digit with no place in a unit, or the same digit twice in a unit. An assumption that leads to one is false.',
    aka: ['conflict'],
    see: ['forcing-chain', 'nishio', 'brute-force'],
    group: 'Basic logic'
  },
  {
    id: 'single',
    term: 'single',
    definition: 'A placement forced because only one possibility is left: a cell with one candidate (naked single) or a digit with one possible cell in a unit (hidden single).',
    aka: [],
    see: ['naked', 'hidden', 'full-house', 'placement'],
    group: 'Basic logic'
  },
  {
    id: 'full-house',
    term: 'full house',
    definition: 'A unit with only one empty cell left, which must take the one digit the unit is missing. It is the simplest kind of single; strictly, last digit means the last empty cell of the whole grid.',
    aka: ['last digit'],
    see: ['single', 'unit'],
    group: 'Basic logic'
  },
  {
    id: 'naked',
    term: 'naked',
    definition: "Describes a pattern found in the cells: N cells of one unit hold only N candidates between them. A naked single is a cell with one candidate; a naked pair removes its two digits from the unit's other cells.",
    aka: [],
    see: ['hidden', 'single', 'subset', 'locked-set'],
    group: 'Basic logic'
  },
  {
    id: 'hidden',
    term: 'hidden',
    definition: 'Describes a pattern found in the digits: N digits of one unit have only N cells to go in. A hidden single is a digit with one possible cell; a hidden pair removes all other candidates from its two cells.',
    aka: [],
    see: ['naked', 'single', 'subset'],
    group: 'Basic logic'
  },
  {
    id: 'subset',
    term: 'subset',
    definition: 'N cells of one unit that must hold N digits between them, found as a naked or a hidden pattern. Sizes two, three and four are called pair, triple and quadruple.',
    aka: ['pair', 'triple', 'quadruple', 'quad'],
    see: ['naked', 'hidden', 'locked-set'],
    group: 'Basic logic'
  },
  {
    id: 'locked-set',
    term: 'locked set',
    definition: "N unsolved cells in one unit that hold exactly N candidates between them. Those digits must fill those cells, so they are removed from every other cell of the unit. HoDoKu's Locked Pair and Locked Triple are the special case that also lies in one intersection.",
    aka: ['naked subset'],
    see: ['subset', 'naked', 'almost-locked-set'],
    group: 'Basic logic'
  },
  {
    id: 'locked-candidates',
    term: 'locked candidates',
    definition: 'A digit whose possible cells in one unit all lie inside its intersection with a second unit. The digit must go in the intersection, so it is removed from the rest of the second unit.',
    aka: ['intersection removal'],
    see: ['intersection', 'pointing', 'claiming'],
    group: 'Basic logic'
  },
  {
    id: 'pointing',
    term: 'pointing',
    definition: 'Locked candidates starting from a box: every place for a digit in the box lies in one row or column, so the digit is removed from the rest of that row or column.',
    aka: ['locked candidates type 1', 'pointing pair', 'pointing triple'],
    see: ['locked-candidates', 'claiming', 'intersection'],
    group: 'Basic logic'
  },
  {
    id: 'claiming',
    term: 'claiming',
    definition: 'Locked candidates starting from a line: every place for a digit in a row or column lies in one box, so the digit is removed from the rest of that box.',
    aka: ['locked candidates type 2', 'box-line reduction'],
    see: ['locked-candidates', 'pointing', 'intersection'],
    group: 'Basic logic'
  },
  {
    id: 'bivalue-cell',
    term: 'bivalue cell',
    definition: 'An unsolved cell with exactly two candidates. Exactly one of them is true, so the two are joined by a strong link and a weak link at once.',
    aka: ['bi-value cell'],
    see: ['strong-link', 'weak-link', 'conjugate-pair', 'bug'],
    group: 'Basic logic'
  },
  {
    id: 'conjugate-pair',
    term: 'conjugate pair',
    definition: 'The only two candidates for a digit in a unit. Exactly one is true: if one is false the other is true (strong link), and if one is true the other is false (weak link).',
    aka: [],
    see: ['bilocation', 'strong-link', 'weak-link', 'colouring'],
    group: 'Basic logic'
  },
  {
    id: 'bilocation',
    term: 'bilocation',
    definition: 'A digit that has exactly two possible cells left in a unit. Those two candidates form a conjugate pair.',
    aka: [],
    see: ['conjugate-pair', 'bivalue-cell', 'strong-link'],
    group: 'Basic logic'
  },
  {
    id: 'link',
    term: 'link',
    definition: 'A logical relation between two candidates, or between nodes, that a chain can use. Links are strong or weak, and a strong link can also be used as a weak one.',
    aka: [],
    see: ['strong-link', 'weak-link', 'inference', 'chain'],
    group: 'Links and chains'
  },
  {
    id: 'strong-link',
    term: 'strong link',
    definition: 'A link between candidates A and B meaning that if A is false then B is true, so at least one of them is true. Conjugate pairs and bivalue cells give strong links.',
    aka: ['strong inference'],
    see: ['weak-link', 'conjugate-pair', 'bivalue-cell', 'inference'],
    group: 'Links and chains'
  },
  {
    id: 'weak-link',
    term: 'weak link',
    definition: 'A link between candidates A and B meaning that if A is true then B is false, so at most one of them is true. Two candidates in one cell, or for one digit in one unit, are weakly linked.',
    aka: ['weak inference'],
    see: ['strong-link', 'sees', 'inference'],
    group: 'Links and chains'
  },
  {
    id: 'inference',
    term: 'inference',
    definition: 'One step of reasoning from one candidate to the next. A strong inference says that if this is false, that is true; a weak inference says that if this is true, that is false.',
    aka: [],
    see: ['strong-link', 'weak-link', 'chain', 'link'],
    group: 'Links and chains'
  },
  {
    id: 'chain',
    term: 'chain',
    definition: 'A sequence of nodes joined by links, each inference feeding the next, so that one state of the first node forces a state of the last.',
    aka: [],
    see: ['node', 'inference', 'aic', 'nice-loop'],
    group: 'Links and chains'
  },
  {
    id: 'node',
    term: 'node',
    definition: 'One element of a chain. It is usually a single candidate, meaning one digit in one cell, but it can also be a grouped node or an almost locked set.',
    aka: [],
    see: ['chain', 'grouped-node', 'almost-locked-set'],
    group: 'Links and chains'
  },
  {
    id: 'aic',
    term: 'alternating inference chain',
    definition: 'A chain whose links alternate strong and weak, beginning and ending with a strong link. At least one of its two end nodes is true, so any candidate that is weakly linked to both ends is eliminated.',
    aka: ['AIC'],
    see: ['chain', 'strong-link', 'weak-link', 'nice-loop', 'grouped-node'],
    group: 'Links and chains'
  },
  {
    id: 'grouped-node',
    term: 'grouped node',
    definition: 'A node made of the two or three candidates for one digit inside one intersection. It counts as true when any one of its cells holds the digit.',
    aka: ['group node'],
    see: ['node', 'intersection', 'aic'],
    group: 'Links and chains'
  },
  {
    id: 'nice-loop',
    term: 'nice loop',
    definition: 'A chain of alternating strong and weak links that closes into a loop by returning to where it started. It is continuous if the alternation holds all the way round, and discontinuous if it breaks at one node.',
    aka: ['loop'],
    see: ['continuous-loop', 'discontinuous-loop', 'x-cycle', 'aic'],
    group: 'Links and chains'
  },
  {
    id: 'continuous-loop',
    term: 'continuous loop',
    definition: 'A nice loop whose links alternate without a break. Every link in it, strong or weak, then has exactly one true end, so any other candidate that is weakly linked to both ends of any of its links is eliminated.',
    aka: ['continuous nice loop', 'AIC loop'],
    see: ['nice-loop', 'discontinuous-loop', 'weak-link'],
    group: 'Links and chains'
  },
  {
    id: 'discontinuous-loop',
    term: 'discontinuous loop',
    definition: 'A nice loop whose alternation breaks at one node. Two strong links meeting there prove that candidate true, and two weak links meeting there prove it false. When a strong link on one digit and a weak link on another meet in one cell, the digit of the weak link is false there.',
    aka: ['discontinuous nice loop'],
    see: ['nice-loop', 'continuous-loop', 'strong-link', 'weak-link'],
    group: 'Links and chains'
  },
  {
    id: 'x-cycle',
    term: 'X-cycle',
    definition: 'A nice loop on a single digit: a closed chain of strong and weak links between the possible cells of one digit.',
    aka: ['fishy cycle'],
    see: ['nice-loop', 'x-chain', 'conjugate-pair'],
    group: 'Links and chains'
  },
  {
    id: 'x-chain',
    term: 'X-chain',
    definition: 'An AIC on a single digit. At least one end is true, so the digit is removed from every cell that sees both ends.',
    aka: [],
    see: ['aic', 'x-cycle', 'turbot-fish'],
    group: 'Links and chains'
  },
  {
    id: 'xy-chain',
    term: 'XY-chain',
    definition: 'An AIC made only of bivalue cells, with weak links between cells on a shared digit. If both ends hold digit Z, Z is removed from every cell that sees both ends.',
    aka: [],
    see: ['aic', 'bivalue-cell', 'remote-pair', 'xy-wing'],
    group: 'Links and chains'
  },
  {
    id: 'remote-pair',
    term: 'remote pair',
    definition: 'An XY-chain of an even number of cells that all hold the same two digits. Both digits are removed from every cell that sees both ends.',
    aka: [],
    see: ['xy-chain', 'bivalue-cell'],
    group: 'Links and chains'
  },
  {
    id: 'colouring',
    term: 'colouring',
    definition: "Giving a cluster's candidates two colours so that the ends of every conjugate pair differ. Exactly one colour is true everywhere: two candidates of one colour that see each other make that colour false (colour wrap), and an outside candidate that sees both colours is eliminated (colour trap).",
    aka: ['Simple Colors', 'simple colours', 'coloring'],
    see: ['cluster', 'conjugate-pair', 'sees', 'multi-colouring'],
    group: 'Links and chains'
  },
  {
    id: 'multi-colouring',
    term: 'multi-colouring',
    definition: 'Colouring two separate clusters of one digit. If a colour of one cluster sees both colours of the other, it is false; if one colour of each cluster see each other, a candidate seeing the other two colours is eliminated.',
    aka: ['Multi Colors'],
    see: ['colouring', 'cluster'],
    group: 'Links and chains'
  },
  {
    id: 'cluster',
    term: 'cluster',
    definition: 'A set of candidates connected to each other by conjugate pairs (and, in 3D Medusa, by bivalue cells). Settling one of them settles them all, which is why a cluster can be coloured in two colours.',
    aka: [],
    see: ['colouring', 'conjugate-pair', '3d-medusa'],
    group: 'Links and chains'
  },
  {
    id: '3d-medusa',
    term: '3D Medusa',
    definition: 'Colouring across several digits, joining candidates through both conjugate pairs and bivalue cells. Its rules extend colour wrap and colour trap to candidates in the same cell.',
    aka: [],
    see: ['colouring', 'cluster', 'bivalue-cell'],
    group: 'Links and chains'
  },
  {
    id: 'forcing-chain',
    term: 'forcing chain',
    definition: 'A technique that follows each case of a premise, such as every candidate of one cell, to its consequences. What holds in every case is true, and a single case that ends in a contradiction is false.',
    aka: [],
    see: ['chain', 'forcing-net', 'nishio', 'contradiction'],
    group: 'Links and chains'
  },
  {
    id: 'forcing-net',
    term: 'forcing net',
    definition: 'A forcing chain whose reasoning may branch and rejoin, so that one conclusion can depend on several earlier ones together. It is the last logical technique sudokUI tries before brute force.',
    aka: [],
    see: ['forcing-chain', 'nishio', 'brute-force'],
    group: 'Links and chains'
  },
  {
    id: 'nishio',
    term: 'Nishio',
    definition: 'A test of one candidate: assume it is true and follow the consequences. If they lead to a contradiction, the candidate is false and is eliminated. In the strict sense only that one digit is followed; sudokUI follows the singles of every digit.',
    aka: ['Nishio forcing chain'],
    see: ['forcing-chain', 'forcing-net', 'elimination'],
    group: 'Links and chains'
  },
  {
    id: 'fish',
    term: 'fish',
    definition: 'A pattern on one digit: N base sets whose candidates for the digit all lie inside N cover sets. Every candidate of the digit in the cover sets that is not in a base set is eliminated. Sizes 2 to 7 are X-wing, swordfish, jellyfish, squirmbag, whale and leviathan.',
    aka: ['squirmbag', 'whale', 'leviathan'],
    see: ['base-set', 'cover-set', 'x-wing', 'fin', 'franken-fish', 'mutant-fish'],
    group: 'Fish'
  },
  {
    id: 'x-wing',
    term: 'X-wing',
    definition: 'The smallest fish: in two rows (or columns) a digit has places only in the same two columns (or rows), so it is removed from the rest of those. Despite the name it is a fish, not a wing.',
    aka: [],
    see: ['fish', 'swordfish', 'base-set', 'cover-set'],
    group: 'Fish'
  },
  {
    id: 'swordfish',
    term: 'swordfish',
    definition: 'A fish of size three: in three lines a digit has places only in the same three crossing lines, so it is removed from the rest of those.',
    aka: [],
    see: ['fish', 'x-wing', 'jellyfish'],
    group: 'Fish'
  },
  {
    id: 'jellyfish',
    term: 'jellyfish',
    definition: 'A fish of size four: in four lines a digit has places only in the same four crossing lines, so it is removed from the rest of those.',
    aka: [],
    see: ['fish', 'swordfish'],
    group: 'Fish'
  },
  {
    id: 'base-set',
    term: 'base set',
    definition: 'One of the N units that define a fish. No candidate of the digit may lie in two base sets, though the units themselves may overlap; a candidate that does is treated as an endo fin. Each base set must hold the digit exactly once, which makes N true cells in all.',
    aka: ['base unit', 'base sector'],
    see: ['fish', 'cover-set', 'fin', 'endo-fin'],
    group: 'Fish'
  },
  {
    id: 'cover-set',
    term: 'cover set',
    definition: "One of the N units that together contain every candidate of a fish's base sets. The base sets need N true cells and each cover set takes only one, so cover candidates outside the base sets lose the digit.",
    aka: ['cover unit', 'cover sector'],
    see: ['fish', 'base-set', 'fin', 'cannibalism'],
    group: 'Fish'
  },
  {
    id: 'fin',
    term: 'fin',
    definition: 'A base candidate of a fish that lies outside every cover set. Either one of the fins is true or the plain fish holds, so a finned fish eliminates only those cover candidates outside the base sets that also see every fin.',
    aka: ['exo fin'],
    see: ['fish', 'finned-fish', 'endo-fin', 'sashimi'],
    group: 'Fish'
  },
  {
    id: 'finned-fish',
    term: 'finned fish',
    definition: "A fish with one or more fins. Its eliminations are the plain fish's eliminations that also see every fin.",
    aka: ['finned X-wing', 'finned swordfish'],
    see: ['fin', 'fish', 'sashimi'],
    group: 'Fish'
  },
  {
    id: 'endo-fin',
    term: 'endo fin',
    definition: 'A base candidate that lies in two base sets, possible only in franken and mutant fish. It is treated as a fin, because if it were true the base sets would hold fewer than N true cells.',
    aka: [],
    see: ['fin', 'base-set', 'franken-fish'],
    group: 'Fish'
  },
  {
    id: 'cannibalism',
    term: 'cannibalism',
    definition: 'A base candidate that lies in two cover sets is eliminated by its own fish, because if it were true one cover set would hold the digit twice. In a finned fish it must also see every fin.',
    aka: ['cannibalistic fish'],
    see: ['cover-set', 'fish'],
    group: 'Fish'
  },
  {
    id: 'sashimi',
    term: 'sashimi',
    definition: 'A finned fish that would not be a proper fish of its size without its fins, for example because a base set would be left with only one candidate. Eliminations follow the same rule as for any finned fish.',
    aka: ['sashimi fish'],
    see: ['fin', 'fish', 'base-set'],
    group: 'Fish'
  },
  {
    id: 'franken-fish',
    term: 'franken fish',
    definition: 'A fish in which boxes are allowed among the base sets or the cover sets. Apart from boxes, one side uses only rows and the other only columns.',
    aka: [],
    see: ['fish', 'base-set', 'cover-set', 'mutant-fish'],
    group: 'Fish'
  },
  {
    id: 'mutant-fish',
    term: 'mutant fish',
    definition: 'A fish whose base sets or cover sets mix rows, columns and boxes in any way.',
    aka: [],
    see: ['fish', 'franken-fish'],
    group: 'Fish'
  },
  {
    id: 'kraken-fish',
    term: 'kraken fish',
    definition: 'A finned fish combined with chains: a candidate is eliminated if it is false both when the plain fish holds and when any one fin is true.',
    aka: [],
    see: ['finned-fish', 'forcing-chain'],
    group: 'Fish'
  },
  {
    id: 'turbot-fish',
    term: 'turbot fish',
    definition: 'A single-digit chain of two conjugate pairs joined by a weak link. The digit is removed from every cell that sees both free ends. Skyscraper and two-string kite are special cases.',
    aka: [],
    see: ['x-chain', 'skyscraper', 'two-string-kite', 'empty-rectangle'],
    group: 'Wings and other patterns'
  },
  {
    id: 'skyscraper',
    term: 'skyscraper',
    definition: 'Two parallel conjugate pairs of one digit, in two rows or two columns, with one end of each in the same crossing line. The digit is removed from cells that see both other ends.',
    aka: [],
    see: ['turbot-fish', 'conjugate-pair'],
    group: 'Wings and other patterns'
  },
  {
    id: 'two-string-kite',
    term: 'two-string kite',
    definition: 'A conjugate pair in a row and one in a column for the same digit, with one end of each in the same box. The digit is removed from the cell that sees both other ends.',
    aka: ['2-String Kite'],
    see: ['turbot-fish', 'conjugate-pair', 'box'],
    group: 'Wings and other patterns'
  },
  {
    id: 'empty-rectangle',
    term: 'empty rectangle',
    definition: 'A box whose candidates for a digit all lie in one row and one column of the box, combined with a conjugate pair outside it. Together they act as a chain that removes the digit from one cell.',
    aka: ['ER'],
    see: ['turbot-fish', 'box', 'conjugate-pair'],
    group: 'Wings and other patterns'
  },
  {
    id: 'wing',
    term: 'wing',
    definition: 'A small pattern, such as the XY-wing, XYZ-wing, WXYZ-wing or W-wing, proving that a digit Z must go in one of a few cells. Z is removed from every cell that sees all of them. The X-wing is a fish, not a wing.',
    aka: [],
    see: ['pivot', 'pincer', 'xy-wing', 'w-wing'],
    group: 'Wings and other patterns'
  },
  {
    id: 'pivot',
    term: 'pivot',
    definition: 'The middle cell of an XY-wing or XYZ-wing, which sees both pincers. In an XY-wing it holds XY; in an XYZ-wing it holds XYZ, so eliminations must also see it.',
    aka: ['hinge'],
    see: ['wing', 'pincer', 'xy-wing', 'xyz-wing'],
    group: 'Wings and other patterns'
  },
  {
    id: 'pincer',
    term: 'pincer',
    definition: 'One of the two outer cells of an XY-wing or XYZ-wing, each of which sees the pivot. The pincers hold XZ and YZ.',
    aka: ['pincer cell'],
    see: ['wing', 'pivot'],
    group: 'Wings and other patterns'
  },
  {
    id: 'xy-wing',
    term: 'XY-wing',
    definition: 'A bivalue pivot XY that sees two bivalue pincers XZ and YZ. Whatever the pivot is, one pincer is Z, so Z is removed from every cell that sees both pincers.',
    aka: ['Y-wing'],
    see: ['wing', 'pivot', 'pincer', 'xy-chain'],
    group: 'Wings and other patterns'
  },
  {
    id: 'xyz-wing',
    term: 'XYZ-wing',
    definition: 'An XY-wing whose pivot also holds Z. One of the three cells is Z, so Z is removed only from cells that see the pivot and both pincers.',
    aka: [],
    see: ['xy-wing', 'pivot', 'pincer'],
    group: 'Wings and other patterns'
  },
  {
    id: 'wxyz-wing',
    term: 'WXYZ-wing',
    definition: 'Four cells holding four digits between them, in which every digit except Z is restricted, meaning all its places see each other. One of the four must then be Z, so Z is removed from every cell that sees all the Zs among them. sudokUI finds it as a bivalue cell plus a three-cell set.',
    aka: ['bent quad'],
    see: ['wing', 'almost-locked-set', 'als-xz', 'bivalue-cell'],
    group: 'Wings and other patterns'
  },
  {
    id: 'w-wing',
    term: 'W-wing',
    definition: 'Two bivalue cells with the same digits XZ, joined by a strong link on X whose ends each see one of them. One of the two cells is Z, so Z is removed from every cell that sees both.',
    aka: [],
    see: ['wing', 'bivalue-cell', 'strong-link'],
    group: 'Wings and other patterns'
  },
  {
    id: 'almost-locked-set',
    term: 'almost locked set',
    definition: 'N unsolved cells in one unit that hold exactly N+1 candidates between them. If any one of those digits is removed from all the cells, they become a locked set of the N digits that remain. A bivalue cell is the smallest ALS.',
    aka: ['ALS'],
    see: ['locked-set', 'restricted-common-candidate', 'als-xz'],
    group: 'Wings and other patterns'
  },
  {
    id: 'restricted-common-candidate',
    term: 'restricted common candidate',
    definition: 'A digit shared by two almost locked sets, where all its cells in one see all its cells in the other, and none of them lies in cells the two sets share. It can be true in at most one set, and a set that loses it becomes a locked set.',
    aka: ['RCC', 'restricted common'],
    see: ['almost-locked-set', 'locked-set', 'sees'],
    group: 'Wings and other patterns'
  },
  {
    id: 'als-xz',
    term: 'ALS-XZ',
    definition: 'Two almost locked sets joined by an RCC X and sharing another digit Z. One set becomes locked, so Z is removed from every cell that sees all the Zs in both. With two RCCs (doubly linked) both sets become locked.',
    aka: [],
    see: ['almost-locked-set', 'restricted-common-candidate'],
    group: 'Wings and other patterns'
  },
  {
    id: 'als-xy-wing',
    term: 'ALS-XY-wing',
    definition: 'Three almost locked sets A, B and C, where A and C each share a different RCC with B, and A and C share a digit Z. Z is removed from every cell that sees all the Zs in A and C.',
    aka: [],
    see: ['als-xz', 'almost-locked-set'],
    group: 'Wings and other patterns'
  },
  {
    id: 'death-blossom',
    term: 'death blossom',
    definition: 'A stem cell whose every candidate is an RCC with its own almost locked set, the petals. Whichever candidate the stem takes, one petal becomes locked, so a digit Z common to all petals is removed from cells that see all their Zs.',
    aka: [],
    see: ['almost-locked-set', 'restricted-common-candidate'],
    group: 'Wings and other patterns'
  },
  {
    id: 'sue-de-coq',
    term: 'Sue de Coq',
    definition: 'Two or three cells of one intersection whose candidates split between a set in the rest of the box and a set in the rest of the line. Each part is locked, so its digits are removed from the rest of its unit.',
    aka: [],
    see: ['intersection', 'almost-locked-set', 'locked-set'],
    group: 'Wings and other patterns'
  },
  {
    id: 'template',
    term: 'template',
    definition: 'One complete way to place a digit in all nine rows, columns and boxes that agrees with the current grid. A candidate found in no template is eliminated, and a cell found in every template takes the digit.',
    aka: ['pattern overlay', 'POM'],
    see: ['elimination', 'placement', 'exocet'],
    group: 'Wings and other patterns'
  },
  {
    id: 'exocet',
    term: 'Exocet',
    definition: 'Two base cells in one intersection, with three or four candidates between them, and two target cells in the other two boxes of their chute that do not see them. When every base digit is confined to at most two lines in the rest of the chute, the targets must take the same two digits as the base, so the targets lose every candidate the base cells lack.',
    aka: ['Junior Exocet', 'JE'],
    see: ['intersection', 'chute', 'template', 'elimination'],
    group: 'Wings and other patterns'
  },
  {
    id: 'uniqueness',
    term: 'uniqueness',
    definition: 'The fact that a proper puzzle has exactly one solution, used as a solving argument. Any candidate that would leave a deadly pattern, and so two solutions, is false.',
    aka: ['uniqueness technique'],
    see: ['unique-solution', 'deadly-pattern', 'unique-rectangle', 'bug'],
    group: 'Uniqueness'
  },
  {
    id: 'unique-solution',
    term: 'unique solution',
    definition: 'The one and only way to complete a proper sudoku from its givens. sudokUI checks that every puzzle it generates, and every puzzle you import or type in, has exactly one solution.',
    aka: [],
    see: ['uniqueness', 'given', 'brute-force'],
    group: 'Uniqueness'
  },
  {
    id: 'deadly-pattern',
    term: 'deadly pattern',
    definition: 'A set of cells, none of them givens, whose digits could be swapped among themselves without breaking any rule. That would mean two solutions, so the solution of a proper puzzle never contains such a pattern.',
    aka: [],
    see: ['uniqueness', 'unique-rectangle', 'bug', 'given'],
    group: 'Uniqueness'
  },
  {
    id: 'unique-rectangle',
    term: 'unique rectangle',
    definition: 'Four cells, none of them givens, in two rows, two columns and two boxes, sharing the same two candidates. With only those two digits in all four it would be a deadly pattern, so at least one extra candidate in the rectangle is true.',
    aka: ['UR', 'uniqueness test'],
    see: ['deadly-pattern', 'uniqueness', 'hidden-rectangle'],
    group: 'Uniqueness'
  },
  {
    id: 'hidden-rectangle',
    term: 'hidden rectangle',
    definition: 'A unique rectangle found through conjugate pairs on its two digits rather than through bivalue cells. It removes one of the two digits from the corner opposite the conjugate pairs.',
    aka: ['HR'],
    see: ['unique-rectangle', 'conjugate-pair'],
    group: 'Uniqueness'
  },
  {
    id: 'avoidable-rectangle',
    term: 'avoidable rectangle',
    definition: 'A rectangle in which some cells are already solved by you, not given, and the rest could complete a deadly pattern. The candidate that would complete it is false.',
    aka: ['AR'],
    see: ['unique-rectangle', 'given'],
    group: 'Uniqueness'
  },
  {
    id: 'bug',
    term: 'BUG',
    definition: 'A state where every unsolved cell has exactly two candidates and every candidate occurs exactly twice in each of its units. Such a state has no solution or more than one, so a proper puzzle can never reach it.',
    aka: ['bivalue universal grave'],
    see: ['bivalue-cell', 'deadly-pattern', 'uniqueness', 'bug-plus-one'],
    group: 'Uniqueness'
  },
  {
    id: 'bug-plus-one',
    term: 'BUG+1',
    definition: 'A BUG with one extra candidate in one cell. That candidate, the one that occurs three times in its units, must be true.',
    aka: [],
    see: ['bug', 'bivalue-cell'],
    group: 'Uniqueness'
  },
  {
    id: 'technique',
    term: 'technique',
    definition: 'A named pattern of logic that justifies a placement or an elimination, such as a hidden single or an X-wing. Each technique has a score that counts towards the rating.',
    aka: ['strategy'],
    see: ['rating', 'solve-path', 'technique-score'],
    group: 'Solving and rating'
  },
  {
    id: 'technique-score',
    term: 'technique score',
    definition: "The fixed number of points a technique adds each time it is used. sudokUI uses HoDoKu's default scores, from 4 for a naked single up to 10000 for brute force, and scores the techniques HoDoKu lacks next to their closest relatives.",
    aka: ['step score'],
    see: ['technique', 'rating', 'hodoku'],
    group: 'Solving and rating'
  },
  {
    id: 'solve-path',
    term: 'solve path',
    definition: 'The ordered list of steps that solves a puzzle. sudokUI builds it by trying techniques in a fixed order, roughly easiest first, and taking the first that works at every step, and shows it under Steps.',
    aka: ['solution path'],
    see: ['technique', 'crux', 'rating', 'steps'],
    group: 'Solving and rating'
  },
  {
    id: 'crux',
    term: 'crux',
    definition: 'The most expensive step of the solve path: the one whose technique has the highest score, or the first of them if several tie. sudokUI marks it in the Steps list.',
    aka: ['hardest step'],
    see: ['solve-path', 'technique', 'rating'],
    group: 'Solving and rating',
    app: true
  },
  {
    id: 'rating',
    term: 'rating',
    definition: "A puzzle's difficulty as a number: the sum of the technique scores of every step along the solve path. Because scores and solving order follow HoDoKu, ratings can be compared with HoDoKu's for puzzles that need only techniques HoDoKu also has.",
    aka: ['difficulty rating', 'puzzle score'],
    see: ['solve-path', 'technique-score', 'difficulty-band', 'hodoku'],
    group: 'Solving and rating'
  },
  {
    id: 'difficulty-band',
    term: 'difficulty band',
    definition: "One of eight named levels of difficulty: Beginner, Easy, Medium, Tricky, Hard, Unfair, Extreme and Nightmare. A puzzle's band follows from its total score and from the hardest techniques it needs: one Hard-class step makes it at least Tricky, two make it at least Hard. HoDoKu itself has five levels.",
    aka: ['difficulty level', 'level'],
    see: ['rating', 'technique', 'hodoku', 'band'],
    group: 'Solving and rating',
    app: true
  },
  {
    id: 'brute-force',
    term: 'brute force',
    definition: "Solving by trial and error: try a digit, carry on, and go back when a contradiction appears. In sudokUI it checks that a puzzle has a unique solution, and it is the solver's last resort, scored at 10000.",
    aka: ['backtracking', 'trial and error', 'guessing'],
    see: ['unique-solution', 'forcing-net', 'rating'],
    group: 'Solving and rating'
  },
  {
    id: 'hodoku',
    term: 'HoDoKu',
    definition: "A free, open source (GPLv3) sudoku program in Java by Bernhard Hobiger, known for its solver, technique guide and difficulty scores. sudokUI takes its technique scores and solving order from HoDoKu, so ratings of puzzles that need only HoDoKu's techniques can be compared.",
    aka: [],
    see: ['rating', 'difficulty-band', 'technique'],
    group: 'Solving and rating'
  }
];

export const glossaryEntry = (id: string): GlossaryEntry | undefined => GLOSSARY.find((e) => e.id === id);
