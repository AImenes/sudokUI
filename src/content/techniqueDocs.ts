// Every technique in the catalogue, explained: what the pattern is, why it
// works and how to spot it. Shown in the Learn dialog, in the first stage
// of a hint, and on the static /learn/ pages.
//
// Each entry was written against the finder it describes, then reviewed
// twice: once for the sudoku logic, once against what the finder actually
// detects and eliminates. The rules every entry obeys (hard word limits,
// one sentence for "what" and "spot", no cell coordinates, house style)
// are enforced by tests/content.test.ts.
//
// These describe the technique in general. What a technique does in one
// particular position is the finder's own description of the step.
import { Tech } from '../engine/ratings';

export interface TechDoc {
  /** the pattern and the conditions that must hold: one sentence */
  what: string;
  /** the logic that forces the conclusion, and what is removed or placed */
  why: string;
  /** a practical tip for finding it on a real board: one sentence */
  spot: string;
  /** other names players use for the same technique */
  aka: string[];
}

export const TECH_DOCS: Record<Tech, TechDoc> = {
  FULL_HOUSE: {
    what: 'A row, column or box has eight of its nine cells filled, leaving exactly one empty cell.',
    why: 'A unit must contain each digit from 1 to 9 exactly once, so the one digit missing from the eight filled cells is placed in the empty cell.',
    spot: 'Scan for a row, column or box with eight digits filled in, then work out which digit from 1 to 9 is absent.',
    aka: ['Open Single', 'Last Free Cell']
  },
  NAKED_SINGLE: {
    what: 'An empty cell has exactly one candidate left, every other digit having been ruled out for that cell.',
    why: 'Every cell must hold a digit, and eight of the nine have been excluded here, so the one remaining candidate is placed in the cell.',
    spot: 'Look for empty cells whose row, column and box between them already show many different digits, then check whether only one digit is left.',
    aka: ['Sole Candidate', 'Forced Digit', 'Last Possible Number']
  },
  HIDDEN_SINGLE: {
    what: 'In a row, column or box, a digit X is a candidate in exactly one cell, whatever other candidates that cell may hold.',
    why: 'Every unit must contain X once, and only one cell in this unit can still take it, so X is placed in that cell.',
    spot: 'Take one digit at a time, rule out every cell that sees a placed copy, and look for a unit with one place remaining.',
    aka: ['Unique Candidate', 'Pinned Digit', 'Last Remaining Cell']
  },
  LOCKED_PAIR: {
    what: 'Two cells in the same box and the same row or column are both bivalue cells with the same two candidates, X and Y.',
    why: 'Those two cells must take X and Y in some order, so no other cell that sees both can hold either digit. X and Y are eliminated from every other cell of the box and of the shared row or column.',
    spot: 'If two bivalue cells in a box hold the same candidates and share a row or column, look for those digits elsewhere in both units.',
    aka: []
  },
  LOCKED_TRIPLE: {
    what: 'Three empty cells in one box that also share a row or column contain between them only the candidates X, Y and Z, though no cell needs all three.',
    why: 'Three cells that all see each other need three different digits, and only X, Y and Z are available, so all three are used there. X, Y and Z are eliminated from every other cell of the box and of that row or column.',
    spot: 'Check the three cells where a box crosses a row or column: all must be empty and hold just three different candidates between them.',
    aka: []
  },
  LOCKED_CANDIDATES_1: {
    what: 'Within one box, every candidate for a digit X lies in the same row or the same column, in two or three cells.',
    why: 'The box must contain X, and every place for it is in one row or column, so the X of that row or column must lie inside the box. X is eliminated from the cells of that row or column outside the box.',
    spot: "Go through a box digit by digit: when a digit's candidates all share a row or column, follow that row or column beyond the box.",
    aka: ['Pointing Pair', 'Pointing Triple', 'Locked Candidates Type 1']
  },
  LOCKED_CANDIDATES_2: {
    what: 'Within one row or column, every candidate for a digit X lies inside the same box, in two or three cells.',
    why: 'The row or column must contain X, and every place for it is inside one box, so the X of that box must lie in that row or column. X is eliminated from the cells of the box outside that row or column.',
    spot: "Go through a row or column digit by digit: when a digit's candidates all fall in one box, check the rest of that box.",
    aka: ['Box/Line Reduction', 'Claiming Pair', 'Claiming Triple', 'Locked Candidates Type 2']
  },
  NAKED_PAIR: {
    what: 'Two cells in the same unit that each hold exactly the same two candidates, X and Y, and nothing else.',
    why: 'One cell must take X and the other Y, in either order, so neither digit can go anywhere else in a unit that contains both cells. Remove X and Y from all other cells of each such unit.',
    spot: 'Find two bivalue cells that see each other and show the same two digits, then look for those digits elsewhere in every unit they share.',
    aka: ['Obvious Pair', 'Naked Twins']
  },
  NAKED_TRIPLE: {
    what: 'Three empty cells in the same unit whose candidates, taken together, are exactly three digits X, Y and Z, though no single cell needs to hold all three.',
    why: 'Three cells in one unit need three different digits, and only X, Y and Z are available, so those cells use up all three. Remove X, Y and Z from all other cells of each unit that contains all three cells.',
    spot: 'In one unit, gather the cells with only two or three candidates and test whether three of them hold just three digits between them.',
    aka: ['Naked Triplet', 'Obvious Triple']
  },
  HIDDEN_PAIR: {
    what: 'Two digits X and Y, both still missing from a unit, whose only places in that unit are the same two cells.',
    why: 'The unit needs both X and Y, and only these two cells can take them, so one cell must be X and the other Y. Remove all candidates except X and Y from both cells.',
    spot: 'Go through a unit digit by digit, noting where each can go, and watch for two digits limited to the same two cells.',
    aka: []
  },
  HIDDEN_TRIPLE: {
    what: 'Three digits, all still missing from a unit, whose places in that unit fall within the same three cells, though a digit need not appear in all three.',
    why: 'The unit needs all three digits in three different cells, and only these three cells can take them, so the digits fill all three cells. Remove all candidates except those three digits from the three cells.',
    spot: 'For each missing digit in a unit, list its possible cells, then look for three digits whose lists together name only three cells.',
    aka: ['Hidden Triplet']
  },
  NAKED_QUADRUPLE: {
    what: 'Four empty cells in the same unit whose candidates, taken together, are exactly four digits, though no single cell needs to hold all four.',
    why: 'Four cells in one unit need four different digits, and only those four are available, so the cells use up all of them. Remove the four digits from all other cells of that unit.',
    spot: 'In a unit with many empty cells, look for four cells whose candidates never stray outside the same four digits.',
    aka: ['Naked Quad']
  },
  HIDDEN_QUADRUPLE: {
    what: 'Four digits, all still missing from a unit, whose places in that unit fall within the same four cells, though a digit need not appear in all four.',
    why: 'The unit needs all four digits in four different cells, and only these four cells can take them, so the digits fill all four cells. Remove all candidates except those four digits from the four cells.',
    spot: 'In a unit with many empty cells, find digits with at most four places, then check whether four of them fit the same four cells.',
    aka: ['Hidden Quad']
  },
  X_WING: {
    what: 'Digit X has exactly two candidates in each of two rows, all four lying in the same two columns, or likewise with rows and columns swapped.',
    why: 'Each row places X in one of the two columns, and the two rows cannot share a column, so each column gets its X from these four cells. Remove X from all other cells in those columns, or in those rows for the swapped form.',
    spot: 'Filter on one digit and look for two rows, or two columns, whose only two candidates form the corners of a rectangle.',
    aka: []
  },
  SWORDFISH: {
    what: 'Digit X has two or three candidates in each of three rows, all lying in the same three columns, or likewise with rows and columns swapped.',
    why: 'Each of the three rows places X in a different one of the three columns, so all three columns get their X from these rows. Remove X from all other cells in those columns, or in those rows for the swapped form.',
    spot: 'Filter on one digit and find three rows whose candidates together span only three columns: a row may use just two of them.',
    aka: []
  },
  JELLYFISH: {
    what: 'Digit X has two to four candidates in each of four rows, all lying in the same four columns, or likewise with rows and columns swapped.',
    why: 'Each of the four rows places X in a different one of the four columns, so all four columns get their X from these rows. Remove X from all other cells in those columns, or in those rows for the swapped form.',
    spot: 'Filter on one digit and find four rows whose candidates together span only four columns: a row may use just two of them.',
    aka: []
  },
  SQUIRMBAG: {
    what: 'Digit X has two to five candidates in each of five rows, all lying in the same five columns, or likewise with rows and columns swapped.',
    why: 'Each of the five rows places X in a different one of the five columns, so all five columns get their X from these rows. Remove X from all other cells in those columns, or in those rows for the swapped form.',
    spot: 'Look at the columns outside the pattern: at most four still need X, and they form smaller fish or singles giving the same eliminations.',
    aka: ['Starfish', '5-Fish']
  },
  WHALE: {
    what: 'Digit X has two to six candidates in each of six rows, all lying in the same six columns, or likewise with rows and columns swapped.',
    why: 'Each of the six rows places X in a different one of the six columns, so all six columns get their X from these rows. Remove X from all other cells in those columns, or in those rows for the swapped form.',
    spot: 'Look at the columns outside the pattern: at most three still need X, and they form smaller fish or singles giving the same eliminations.',
    aka: ['6-Fish']
  },
  LEVIATHAN: {
    what: 'Digit X has two to seven candidates in each of seven rows, all lying in the same seven columns, or likewise with rows and columns swapped.',
    why: 'Each of the seven rows places X in a different one of the seven columns, so all seven columns get their X from these rows. Remove X from all other cells in those columns, or in those rows for the swapped form.',
    spot: 'Look at the columns outside the pattern: at most two still need X, and they form an X-Wing or singles giving the same eliminations.',
    aka: ['7-Fish']
  },
  REMOTE_PAIR: {
    what: 'A chain of at least four bivalue cells that all hold the same two candidates X and Y, each cell seeing the next.',
    why: 'Neighbouring chain cells must differ, so the chain alternates between X and Y. A cell outside the chain that sees two chain cells an odd number of steps apart sees one X and one Y, so X and Y are both removed from it.',
    spot: 'Find four or more bivalue cells holding the same two candidates, link those that see each other, and colour the chain alternately.',
    aka: ['Remote Pairs']
  },
  CHUTE_REMOTE_PAIR: {
    what: 'Two bivalue cells, both X and Y, in one chute (three aligned boxes), not seeing each other, where the three chute cells seeing neither hold no X, solved or candidate.',
    why: 'The box holding those three cells must have its X in the row or column of one pair cell, which makes that cell Y. Y is removed from every cell seeing both pair cells, and X too if the three cells also hold no Y.',
    spot: 'Scan each chute for two identical bivalue cells sharing no unit, then test the three chute cells seeing neither for X and Y in turn.',
    aka: ['Chute Remote Pairs', 'CRP']
  },
  BUG_PLUS_1: {
    what: "All unsolved cells are bivalue cells except one with three candidates, and every candidate in a unit appears exactly twice, except X, three times in each of that cell's units.",
    why: "Without X in that cell, the grid would be all bivalue cells with every candidate twice per unit, so any solution would have a twin using each cell's other candidate. Assuming the puzzle has exactly one solution, X is placed in that cell.",
    spot: 'When all unsolved cells but one are bivalue cells, find the cell with three candidates: the one appearing three times in its row is X.',
    aka: ['Bivalue Universal Grave + 1', 'BUG + 1', 'BUG']
  },
  SKYSCRAPER: {
    what: 'Two rows (or columns) each hold a conjugate pair for digit X; one end of each shares a column (or row), and the other ends do not see each other.',
    why: 'The two ends that share a column (or row) cannot both be X, so at least one of the other two ends must be X. X is eliminated from every cell outside the pattern that sees both of those ends.',
    spot: 'Pick a digit, find two rows where it has exactly two places, and check whether two of those places sit in the same column.',
    aka: []
  },
  TWO_STRING_KITE: {
    what: 'A row and a column each hold a conjugate pair for X, four different cells; one end of each shares a box, and the others do not see each other.',
    why: 'The two ends in the shared box cannot both be X, so at least one of the other two ends must be X. X is eliminated from every cell outside the pattern that sees both of those ends.',
    spot: 'Find a box where a row conjugate pair and a column conjugate pair each have one end, then check the cell seeing both far ends.',
    aka: ['Two-String Kite']
  },
  TURBOT_FISH: {
    what: 'Digit X forms two conjugate pairs on four different cells; an end of one pair sees an end of the other, and the remaining ends do not see each other.',
    why: 'The two ends that see each other cannot both be X, so at least one of the remaining ends must be X. X is eliminated from every cell outside the pattern that sees both remaining ends.',
    spot: 'Skyscraper and 2-String Kite are special cases; otherwise look for shapes where at least one of the conjugate pairs lies in a box.',
    aka: []
  },
  EMPTY_RECTANGLE: {
    what: "A box's candidates for X lie only on one row and one column; a column (or row) conjugate pair outside the box has one end on that row (or column).",
    why: 'With the end on the row, X in the box lies either on that row, making the other end X, or on the column; so any cell on that column outside the box that sees the other end loses X. Swap row and column otherwise.',
    spot: 'Look for a box where four cells forming a rectangle have no candidate X, leaving X along both one row and one column.',
    aka: []
  },
  W_WING: {
    what: 'Two bivalue cells, both with candidates X and Z, do not see each other; a conjugate pair for X has one end seeing the first, the other seeing the second.',
    why: 'One end of the conjugate pair must be X, so the bivalue cell it sees loses X and becomes Z. At least one bivalue cell is therefore Z, so Z is eliminated from every cell outside the pattern that sees both bivalue cells.',
    spot: 'Find two identical bivalue cells that do not see each other, then look for a conjugate pair on one of their digits bridging them.',
    aka: []
  },
  XY_WING: {
    what: 'A bivalue pivot cell with candidates X and Y sees two bivalue pincer cells, one with candidates X and Z, the other with candidates Y and Z.',
    why: 'If the pivot is X, the pincer with X becomes Z; if the pivot is Y, the pincer with Y becomes Z. At least one pincer is therefore Z, so Z is eliminated from every other cell that sees both pincers.',
    spot: 'From a bivalue cell, scan the bivalue cells it sees for two that split its digits between them and share one new digit.',
    aka: ['Y-Wing']
  },
  XYZ_WING: {
    what: 'A pivot cell with exactly three candidates X, Y and Z sees two bivalue pincer cells, one with candidates X and Z, the other with candidates Y and Z.',
    why: 'If the pivot is X or Y, the pincer holding that digit becomes Z; otherwise the pivot itself is Z. At least one of the three cells is therefore Z, so Z is eliminated from every other cell that sees all three.',
    spot: 'Find a three-candidate cell, then look in its box and along its row or column for two bivalue cells holding different pairs of its candidates.',
    aka: []
  },
  WXYZ_WING: {
    what: 'Three cells in one unit hold exactly the candidates W, X, Y and Z between them; a fourth cell, bivalue with X and Z, sees each of those holding X.',
    why: 'If the bivalue cell is X, the three cells lose X and must share W, Y and Z, so one of them is Z; otherwise the bivalue cell is Z. Z is eliminated from every other cell that sees all pattern cells holding candidate Z.',
    spot: 'Look for three cells in a unit holding four candidates between them, then for a fourth, bivalue cell nearby made of two of those digits.',
    aka: ['Bent Quad']
  },
  UNIQUENESS_1: {
    what: 'Four cells forming a rectangle in exactly two boxes, where three hold only X and Y and the fourth holds X, Y and at least one other candidate.',
    why: 'If the fourth cell were X or Y, the four cells would hold only X and Y, and swapping them would give a second solution. Assuming the puzzle has exactly one solution, X and Y are removed from the fourth cell.',
    spot: 'Look for three bivalue cells with the same two candidates on three corners of a rectangle that lies in exactly two boxes.',
    aka: ['Uniqueness Test 1', 'UR Type 1', 'UR1']
  },
  UNIQUENESS_2: {
    what: 'A rectangle in exactly two boxes where two corners hold only X and Y and the other two each hold exactly X, Y and Z.',
    why: 'If neither corner were Z, the rectangle would hold only X and Y, and swapping them would give a second solution. Assuming the puzzle has exactly one solution, at least one is Z, so Z is removed from every other cell that sees both.',
    spot: 'Find two bivalue cells with the same pair on a rectangle, then check whether both remaining corners add the same single extra candidate.',
    aka: ['Uniqueness Test 2', 'UR Type 2', 'UR2']
  },
  UNIQUENESS_3: {
    what: "A rectangle in exactly two boxes: two corners hold only X and Y, the others share a unit, and their extras and K other cells' candidates there total K+1 digits.",
    why: "Assuming the puzzle has exactly one solution, one corner takes an extra, or swapping X and Y would give a second solution. That corner and the K cells use up the K+1 digits, which are removed from that unit's remaining cells outside the rectangle.",
    spot: 'When the two corners with extras share a unit, look there for cells whose candidates are all among those extras.',
    aka: ['Uniqueness Test 3', 'UR Type 3', 'UR3']
  },
  UNIQUENESS_4: {
    what: 'A rectangle in exactly two boxes: two corners hold only X and Y, the other two hold extras too and are the only places for X in a shared unit.',
    why: 'One of those two corners must be X. If the other were Y, the rectangle would hold only X and Y and swapping them would give a second solution, so assuming the puzzle has exactly one solution, Y is removed from both corners.',
    spot: 'After finding two bivalue corners, check whether X or Y has exactly two places in a unit shared by the other two corners.',
    aka: ['Uniqueness Test 4', 'UR Type 4', 'UR4']
  },
  UNIQUENESS_5: {
    what: 'A rectangle in exactly two boxes where one corner holds only X and Y and the other three each hold exactly X, Y and Z.',
    why: 'If none of the three were Z, the rectangle would hold only X and Y, and swapping them would give a second solution. Assuming the puzzle has exactly one solution, at least one is Z, so Z is removed from other cells seeing all three.',
    spot: 'Start from a bivalue cell and look for a rectangle whose other three corners each show the same pair plus one shared extra candidate.',
    aka: ['Uniqueness Test 5', 'UR Type 5', 'UR5']
  },
  UNIQUENESS_6: {
    what: 'A rectangle in exactly two boxes: two opposite corners hold only X and Y, the others hold extras too, and its two rows, or two columns, have no other X.',
    why: 'If a corner with extras were X, the rest of the rectangle would be forced into X and Y only, and swapping them would give a second solution. Assuming the puzzle has exactly one solution, X is removed from both corners with extras.',
    spot: 'With bivalue corners on a diagonal, check whether X or Y forms a conjugate pair inside the rectangle in both rows or both columns.',
    aka: ['Uniqueness Test 6', 'UR Type 6', 'UR6']
  },
  HIDDEN_RECTANGLE: {
    what: "A rectangle in exactly two boxes with X and Y in every corner, one holding nothing else, and X confined to rectangle corners in the opposite corner's row and column.",
    why: 'If the opposite corner were Y, X would be forced into the two neighbouring corners and Y into the bivalue cell, letting X and Y swap for a second solution. Assuming the puzzle has exactly one solution, Y is removed from the opposite corner.',
    spot: "From a bivalue cell, check the opposite corner: one of the two digits must form a conjugate pair in both that corner's row and column.",
    aka: ['Hidden Unique Rectangle', 'Hidden UR']
  },
  AVOIDABLE_RECTANGLE_1: {
    what: 'A rectangle in exactly two boxes with three solved corners, none of them givens: the two seeing the unsolved corner are both Y, and the one opposite it is X.',
    why: 'If the unsolved corner were X, the four cells would hold only X and Y, and swapping them would give a second solution without changing any given. Assuming the puzzle has exactly one solution, X is removed from that corner.',
    spot: 'Keep givens and your own placements visually distinct, then look for three of your placements on a rectangle using only two digits.',
    aka: ['AR Type 1', 'AR1']
  },
  AVOIDABLE_RECTANGLE_2: {
    what: 'A rectangle in exactly two boxes: two corners in one row or column are solved, not givens, and each unsolved corner holds only Z and the digit diagonally opposite it.',
    why: 'If neither unsolved corner were Z, the rectangle would hold two digits that could swap without touching a given, making a second solution. Assuming the puzzle has exactly one solution, one is Z, so Z is removed from every other cell that sees both.',
    spot: 'Look for two of your own placements in one row or column of a rectangle whose remaining corners are bivalue cells sharing one candidate.',
    aka: ['AR Type 2', 'AR2']
  },
  EXTENDED_RECTANGLE: {
    what: "Six unsolved cells where two rows cross three columns, or two columns cross three rows, in exactly three boxes, holding three digits plus one cell's extras or one extra digit.",
    why: "Without extras, each box's two cells could swap values, giving a second solution. Assuming the puzzle has exactly one solution, the cell with extras loses the three digits, or the extra digit is removed from outside cells seeing every pattern cell holding it.",
    spot: 'Look for three digits recurring in two rows or columns that run through the same three boxes, one pair of cells per box.',
    aka: ['Extended Unique Rectangle']
  },
  FINNED_X_WING: {
    what: "Two rows (or columns) have candidate X at all four corners of a rectangle, and their only other candidates for X, the fins, all lie in one corner's box.",
    why: 'If no fin is true, a plain X-Wing removes X elsewhere in its columns; if one is, its box holds no other X. Cells of those columns in the fin box, outside the two rows, lose X, or likewise with rows and columns swapped.',
    spot: 'Look for two rows or columns that would form an X-Wing but for extra candidates, all inside the box of one corner.',
    aka: []
  },
  SASHIMI_X_WING: {
    what: "Two rows (or columns) have candidate X at three corners of a rectangle, and their only other candidates for X, the fins, all lie in the missing corner's box.",
    why: 'If no fin is true, both columns get their X from the two rows; if one is, its box holds no other X. Cells of those columns in the fin box, outside the two rows, lose X, or likewise with rows and columns swapped.',
    spot: "Look for an X-Wing with one corner missing, where the gap's row or column has its other candidates for X inside the gap's box.",
    aka: ['Sashimi Finned X-Wing', 'Finned Sashimi X-Wing']
  },
  FINNED_SWORDFISH: {
    what: 'Three rows (or columns) have candidate X only in three shared columns (or rows) plus fins, extra cells all in one box, with at least two non-fin candidates per row.',
    why: 'If no fin is true, a plain Swordfish removes X elsewhere in its columns; if one is, its box holds no other X. Cells of those columns in the fin box, outside the three rows, lose X, or likewise with rows and columns swapped.',
    spot: 'When three rows almost form a Swordfish, check whether every extra candidate for X sits in one box crossed by one of its three columns.',
    aka: []
  },
  SASHIMI_SWORDFISH: {
    what: 'Three rows (or columns) have candidate X only in three shared columns (or rows) plus fins, extra cells in one box, and a finned row has only one non-fin candidate.',
    why: 'If no fin is true, all three columns get their X from the three rows; if one is, its box holds no other X. Cells of those columns in the fin box, outside the three rows, lose X, or likewise with rows and columns swapped.',
    spot: 'Look for a Swordfish where one row has a single non-fin candidate, plus other candidates for X in one box crossed by another Swordfish column.',
    aka: ['Sashimi Finned Swordfish', 'Finned Sashimi Swordfish']
  },
  FINNED_JELLYFISH: {
    what: 'Four rows (or columns) have candidate X only in four shared columns (or rows) plus fins, extra cells all in one box, with at least two non-fin candidates per row.',
    why: 'If no fin is true, a plain Jellyfish removes X elsewhere in its columns; if one is, its box holds no other X. Cells of those columns in the fin box, outside the four rows, lose X, or likewise with rows and columns swapped.',
    spot: 'Find four rows whose candidates for X fit four columns except for a few extras, all in one box crossed by one of those columns.',
    aka: []
  },
  SASHIMI_JELLYFISH: {
    what: 'Four rows (or columns) have candidate X only in four shared columns (or rows) plus fins, extra cells in one box, and a finned row has only one non-fin candidate.',
    why: 'If no fin is true, all four columns get their X from the four rows; if one is, its box holds no other X. Cells of those columns in the fin box, outside the four rows, lose X, or likewise with rows and columns swapped.',
    spot: 'Find four rows fitting four columns where one row has a single non-fin candidate and its extras lie in one box crossed by another column.',
    aka: ['Sashimi Finned Jellyfish', 'Finned Sashimi Jellyfish']
  },
  SUE_DE_COQ: {
    what: 'Two or three box cells in one row or column hold two more candidates than cells; two bivalue cells, one elsewhere in each unit, split four of those candidates.',
    why: "With as many cells as candidates, the pattern places every candidate once. The candidates of the box's bivalue cell are removed from the rest of the box, the other bivalue cell's from the rest of the row or column, and any remaining candidate from both.",
    spot: 'Look for two or three crowded cells where a box meets a row or column, with a bivalue cell elsewhere in each of those units.',
    aka: ['Two-Sector Disjoint Subsets', 'SdC']
  },
  SIMPLE_COLORS: {
    what: 'For one digit X, cells joined by conjugate pairs form a cluster, coloured in two colours so that the two cells of every conjugate pair get opposite colours.',
    why: 'One colour holds X in all its cells, the other in none. If two cells of one colour see each other, that colour is false and X is removed from all its cells; any uncoloured cell that sees cells of both colours also loses X.',
    spot: 'Pick a digit, mark every unit where it has exactly two places, and follow pairs that share a cell to build the cluster.',
    aka: ['Simple Colouring', 'Singles Chains']
  },
  MULTI_COLORS: {
    what: 'For one digit X, two separate clusters of conjugate pairs are each coloured alternately in their own two colours, and a cell of one sees a cell of the other.',
    why: 'Two colours that see each other cannot both be true, so X is removed from any cell outside both clusters that sees cells of both remaining colours. A colour that sees both colours of the other cluster is false: remove X from all its cells.',
    spot: 'Colour two separate clusters of the same digit in four colours, then look for a unit holding a coloured cell from each cluster.',
    aka: ['Multi-Colouring']
  },
  MEDUSA_3D: {
    what: 'Candidates of several digits, joined by conjugate pairs or by sharing a bivalue cell, form a cluster coloured alternately in two colours so linked candidates get opposite colours.',
    why: 'Exactly one colour is entirely true. A whole colour is removed if it puts two digits in a cell, a digit twice in a unit, or leaves a cell with no candidates; an uncoloured candidate is removed if it is false whichever colour is true.',
    spot: 'Start from a bivalue cell and spread outwards through conjugate pairs and other bivalue cells, colouring candidates alternately as you go.',
    aka: ['Medusa Colouring', '3D Colouring']
  },
  X_CHAIN: {
    what: 'Four or more cells with candidate X in a chain whose links alternate between conjugate pairs (strong) and cells that see each other (weak), starting and ending strong.',
    why: 'If one end is not X, the strong links force X and the weak links forbid it in turn, making the other end X. At least one end is therefore X, so X is removed from every cell outside the chain that sees both ends.',
    spot: 'Filter the grid to one digit, mark its conjugate pairs, and join pairs end to end wherever two of their cells see each other.',
    aka: ['X-Chains']
  },
  X_CYCLES: {
    what: 'A closed loop of cells holding candidate X whose links alternate strong and weak throughout, or except at one cell where two strong or two weak links meet.',
    why: 'In a fully alternating loop every weak link has X at one end, so X is removed from outside cells seeing both ends of one weak link. Two strong links meeting place X in that cell, and two weak links meeting remove X from it.',
    spot: 'Draw the conjugate pairs of one digit, join them where cells see each other, and check whether the chain returns to its starting cell.',
    aka: ['X-Cycle', 'Fishy Cycle']
  },
  GROUPED_X_CYCLES: {
    what: 'An X-Cycle loop where a group of two or three X candidates in one box and one row or column acts as one cell, true if any member is X.',
    why: 'Seeing a group means seeing every member. A fully alternating loop removes X from outside cells seeing both ends of a weak link, an end joining two strong links is true, so cells seeing it lose X, and one joining two weak links loses X.',
    spot: 'Look for a unit whose X candidates all lie in a group plus one other cell or group: those two ends are strongly linked.',
    aka: ['Grouped X-Cycle']
  },
  XY_CHAIN: {
    what: 'A chain of bivalue cells, each seeing the next and joined to it by a shared candidate that changes at every cell, leaving an unused candidate Z at both ends.',
    why: 'If one end is not Z, it takes its joining candidate, forcing each following cell to its other candidate until the far end becomes Z. At least one end is Z, so Z is removed from every cell outside the chain seeing both ends.',
    spot: 'Start at a bivalue cell, assume it is not Z, follow the forced digits through bivalue cells, and stop when one becomes Z.',
    aka: ['XY-Chains']
  },
  TWINNED_XY_CHAIN: {
    what: "Six cells where two rows cross three columns, or the reverse, holding exactly six different digits as candidates between them, with each digit's pattern cells all seeing each other.",
    why: 'Each digit can fill at most one pattern cell, yet six cells need six digits, so every digit is used exactly once. Any of the six digits, X, is removed from every cell outside the pattern that sees all pattern cells containing X.',
    spot: 'Find three bivalue cells in one row or column that share a digit, then test a parallel row or column for the other three cells.',
    aka: ['Twinned XY-Chain']
  },
  NICE_LOOP: {
    what: 'A loop of candidates whose links alternate strong and weak, either perfectly all the way round or everywhere except at one candidate where two strong or two weak links meet.',
    why: 'With perfect alternation one end of every weak link is true: if both ends share a cell its other candidates go, otherwise their digit leaves cells seeing both. A candidate where two strong links meet is placed, one where two weak links meet is eliminated.',
    spot: 'Follow alternating links out from a bivalue cell or conjugate pair and watch for the chain returning to link with its starting candidate.',
    aka: ['Continuous Nice Loop', 'Discontinuous Nice Loop']
  },
  GROUPED_NICE_LOOP: {
    what: 'A Nice Loop with at least one group node: two or three cells holding candidate X in one box and one row or column, true if any becomes X.',
    why: 'With perfect alternation one end of every weak link is true, eliminating any candidate weakly linked to both its ends. A node where two strong links meet is true: a candidate is placed, a group removes X from outside cells seeing all its cells.',
    spot: "Where a unit's only places for X are a group plus one other cell or group, use that strong link to extend a loop.",
    aka: ['Grouped Continuous Nice Loop', 'Grouped Discontinuous Nice Loop']
  },
  ALS_XZ: {
    what: 'Two almost locked sets, each within one unit and sharing no cell, both contain two digits, X and Z, and every X in one sees every X in the other.',
    why: 'X cannot be placed in both sets, so at least one set is left with as many candidates as cells and must contain Z. So Z is removed from every cell outside both sets that sees every Z in both sets.',
    spot: "Start with small sets such as bivalue cells, find two that share two digits, then test whether one digit's cells all see each other.",
    aka: ['ALS-XZ Rule', 'Almost Locked Sets XZ-Rule']
  },
  ALS_XY_WING: {
    what: 'Three non-overlapping almost locked sets: every hinge X sees every X in one wing, every hinge Y sees every Y in the other, and both wings hold another digit Z.',
    why: 'The hinge can lack only one digit, so it holds X or Y, removing that digit from the matching wing, which becomes a locked set containing Z. So Z is removed from any cell outside all three sets seeing every Z in both wings.',
    spot: 'Picture an XY-Wing whose cells have grown into sets: find a hinge linked to two wings by different digits, then look for a shared Z.',
    aka: ['ALS XY-Wing', 'Almost Locked Sets XY-Wing']
  },
  ALS_XY_CHAIN: {
    what: "Four almost locked sets form a chain: neighbours share a joining digit whose cells all see each other, each middle set's joins differ, and both ends hold another digit Z.",
    why: 'If one end lacks Z it locks and places its joining digit, removing that digit from the next set, and so on until the far end must place Z. So Z is removed from any cell outside the chain seeing every Z in both ends.',
    spot: 'Build the chain from small sets such as bivalue cells, link by link, and after three links check whether both ends share a candidate.',
    aka: ['ALS Chain', 'Almost Locked Sets Chain']
  },
  AIC: {
    what: 'A chain of candidates, which may mix digits, whose links alternate strong, weak, strong and so on, beginning and ending with a strong link.',
    why: 'If one end is false the links force the other true, so at least one end is true. Any candidate weakly linked to both ends is eliminated, whether through a shared cell or through the same digit in cells that see each other.',
    spot: 'Conjugate pairs and bivalue cells give the strong links: join them where two candidates share a cell, or share a digit and a unit.',
    aka: ['AIC']
  },
  AIC_GROUPED: {
    what: 'An Alternating Inference Chain with at least one group node: two or three cells holding candidate X in one box and one row or column, true if any becomes X.',
    why: "A group and another X node are strongly linked when together they are a unit's only places for X, weakly linked when all their cells see each other. At least one chain end is true, so any candidate weakly linked to both ends is eliminated.",
    spot: 'When a chain stalls at a unit with three places for X, check whether two of them form a group, restoring a strong link.',
    aka: ['Grouped AIC']
  },
  AIC_ALS: {
    what: 'An Alternating Inference Chain that uses an ALS as a strong link between two of its digits: if X is nowhere in the ALS, Y must be somewhere in it.',
    why: 'Without X the ALS has N candidates for N cells, so all are placed, Y included. At least one end is true, eliminating candidates weakly linked to both: an ALS digit weakly links to that digit in outside cells seeing every ALS cell holding it.',
    spot: 'A bivalue cell already gives a strong link, so look next at two cells in one unit holding three candidates between them.',
    aka: ['AIC with Almost Locked Sets']
  },
  DEATH_BLOSSOM: {
    what: "A stem cell's candidates each have a separate petal, an almost locked set holding that candidate only in cells seeing the stem; every petal holds Z, which the stem lacks.",
    why: 'Whichever digit the stem takes is removed from its petal, which becomes a locked set and must contain Z. So Z is removed from any cell outside the stem and petals that sees every Z in every petal.',
    spot: 'Start from a cell with two or three candidates, then hunt nearby for one small set per candidate, all sharing some other digit.',
    aka: []
  },
  FRANKEN_X_WING: {
    what: 'Two base units (rows or boxes) share no candidate for X, all their X candidates lying in two cover units (columns or boxes) sharing none, or rows and columns swapped.',
    why: 'Each base unit places X once, in separate cells, and each cover unit has room for one X, so both cover units get theirs from the base. Remove X from every cell of the cover units that lies outside the base units.',
    spot: 'Filter on X and test two rows or boxes against two columns or boxes: at least one of the four units must be a box.',
    aka: []
  },
  FRANKEN_SWORDFISH: {
    what: 'Three base units (rows or boxes) share no candidate for X, all their X candidates lying in three cover units (columns or boxes) sharing none, or rows and columns swapped.',
    why: 'Each base unit places X once, in separate cells, and each cover unit has room for one X, so all three cover units get theirs from the base. Remove X from every cell of the cover units that lies outside the base units.',
    spot: 'Filter on X and test three rows or boxes against three columns or boxes: at least one of the six units must be a box.',
    aka: []
  },
  FIREWORKS: {
    what: 'Three digits missing from a row and a column whose candidates in those two units, outside the box where they cross, all sit in one wing cell of each.',
    why: 'Each digit sits in a wing, or else inside the box for both the row and the column, which can only be the cell where they cross. Three digits therefore fill these three cells, which lose all candidates except those three digits.',
    spot: 'Scan a row and column that cross in a box for digits whose candidates outside that box sit in a single cell of each.',
    aka: ['Firework', 'Triple Firework']
  },
  TRIDAGON: {
    what: 'Four boxes forming a rectangle each hold three cells on a diagonal, one box slanting against the other three; only one cell, the guardian, has candidates besides X, Y, Z.',
    why: 'Twelve such cells can never all be filled from X, Y and Z without repeating a digit in some row, column or box. So the guardian must take one of its other candidates, and X, Y and Z are eliminated from it.',
    spot: 'Look for four boxes crowded with the same three candidates; diagonals may wrap round a box edge, stepping right or left as they go down.',
    aka: ["Thor's Hammer", 'Trivalue Oddagon']
  },
  SK_LOOP: {
    what: 'Four solved cells forming a rectangle in four boxes; their rows and columns inside those boxes give eight cell pairs, each holding four candidates, two shared with each neighbouring pair.',
    why: "Neighbouring pairs share a box, row or column, so each shared digit fits only once in their four cells. Eight such links fill at most sixteen cells, exactly the loop's size, so every shared digit is used and eliminated from the rest of that unit.",
    spot: 'Look for four solved cells forming a rectangle across four boxes, each with its row and column inside the box otherwise unsolved.',
    aka: ['Domino Loop', 'SK-Loop']
  },
  ALIGNED_PAIR_EXCLUSION: {
    what: 'Two cells that see each other, together with one or more almost locked sets, bivalue cells included, in which every cell sees both of the two cells.',
    why: "The two cells cannot hold the same digit, nor two digits that are both candidates of one such ALS, which would leave it a digit short. A candidate of either cell is eliminated when all its pairings with the other cell's candidates are ruled out.",
    spot: 'Pick two cells in the same unit with few candidates, then look for bivalue cells or small ALSs seen by both.',
    aka: ['APE']
  },
  EXOCET: {
    what: 'Along one row or column, two base cells in one box together hold three or four candidates; its other two boxes each have a target seeing neither base nor target.',
    why: "When every base digit, once placed in a base cell, is also forced into a target, the targets hold the base's two digits. Targets lose every candidate that is not a base digit, and base digits absent from both targets leave both base cells.",
    spot: 'Start from two cells in one box and row or column with three or four candidates, then trace each digit alone from base to targets.',
    aka: ['JExocet', 'Junior Exocet']
  },
  DOUBLE_EXOCET: {
    what: 'Two valid Exocets whose base pairs sit in different boxes of the same row or column, each pair holding the same four candidates between its two cells.',
    why: "The four base cells share one row or column and hold only those four candidates, so between them they take all four digits. Those digits are therefore eliminated from every other cell of that row or column, in addition to each Exocet's own eliminations.",
    spot: 'After finding one Exocet, check the same row or column in another box for a second base pair with the same four candidates.',
    aka: ['Double JExocet']
  },
  PATTERN_OVERLAY: {
    what: 'Every complete pattern for one digit X is listed: nine cells, one in each row, column and box, containing every placed X and otherwise only cells with candidate X.',
    why: 'In the solution, the nine cells holding X form exactly one of these patterns. A candidate X that lies in no pattern is eliminated, and an empty cell that lies in every pattern must be X.',
    spot: 'Pick a digit with several already placed and few candidates left, so that only a handful of complete patterns remain to be written out.',
    aka: ['Pattern Overlay Method', 'POM', 'Templates']
  },
  FORCING_CHAIN: {
    what: 'One assumption, or each of a set of assumptions that covers every case, such as all candidates of one cell, is followed through the steps it forces.',
    why: 'One of a set of assumptions covering every case must be true, so any placement or elimination that every one of them forces is certain. An assumption that leads to a contradiction is false: a candidate assumed true is eliminated, one assumed false is placed.',
    spot: 'Begin where the choice is smallest, a bivalue cell or a conjugate pair, and pencil each run in its own colour to compare them.',
    aka: ['Forcing Chains']
  },
  DIGIT_FORCING_CHAIN: {
    what: 'One candidate is followed both ways, once assumed true and once assumed false, each time placing the naked and hidden singles that follow, and the two results are compared.',
    why: 'The candidate is either true or false, so whatever both runs agree on is certain: a digit both place in the same cell is placed, a candidate both remove is eliminated. If the false run ends in a contradiction, the candidate itself is placed.',
    spot: 'Start from a candidate in a bivalue cell or a conjugate pair, because there the false run also forces a placement straight away.',
    aka: ['Digit Forcing Chains']
  },
  NISHIO_FORCING_CHAIN: {
    what: 'One candidate is assumed true, and the singles it forces end in a contradiction: an empty cell without candidates, or a unit with no place for a digit it lacks.',
    why: 'Every naked or hidden single in the run is a certain consequence of the assumption, so the contradiction proves the assumption false. The assumed candidate is eliminated, and nothing else from the run is kept.',
    spot: 'Test a candidate X whose cell sees several bivalue cells containing X, since assuming it true turns each of them into a naked single.',
    aka: ['Nishio']
  },
  CELL_FORCING_CHAIN: {
    what: 'Every candidate of one cell is assumed true in turn, each time placing the naked and hidden singles that follow, and the results are compared.',
    why: 'The cell must hold one of its candidates, so one of the runs follows the true case. A digit every run places in the same cell is placed, and a candidate every run removes is eliminated.',
    spot: 'Choose a cell with two or three candidates that sees bivalue cells sharing those candidates, so each assumption sets off a run of singles.',
    aka: ['Cell Forcing Chains']
  },
  UNIT_FORCING_CHAIN: {
    what: 'Every place for a digit X in one unit is assumed true in turn, each time placing the naked and hidden singles that follow, and the results are compared.',
    why: 'X must go somewhere in the unit, so one of the runs follows the true case. A digit every run places in the same cell is placed, and a candidate every run removes is eliminated.',
    spot: 'Start with a conjugate pair, which needs only two runs, then try digits with three places left in a unit.',
    aka: ['Unit Forcing Chains', 'Region Forcing Chains']
  },
  FORCING_NET: {
    what: 'One candidate is assumed true and followed through locked candidates as well as naked and hidden singles, any step drawing on several earlier ones, until a contradiction appears.',
    why: 'Every step is a certain consequence of the assumption, so a contradiction, an empty cell without candidates or a unit with no place for a digit, proves the assumption false. Only the assumed candidate is eliminated.',
    spot: 'When singles stall without a contradiction, look for a digit confined in some unit to the cells where a box crosses a row or column.',
    aka: ['Forcing Nets', 'Forcing Net Contradiction', 'Dynamic Forcing Chains']
  },
  BRUTE_FORCE: {
    what: 'No pattern at all: digits are tried in the empty cells one after another, backing up at every dead end, until the whole grid is filled.',
    why: 'A grid filled without breaking a rule is a solution, and a proper puzzle has exactly one. A digit from that solution is placed in an empty cell, with no reasoning a player could follow.',
    spot: 'There is nothing to spot: if you must guess by hand, choose a bivalue cell and note where the guess began.',
    aka: ['Backtracking', 'Trial and Error', 'Guessing']
  }
};
