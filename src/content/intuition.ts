// The Intuition guide: the few ideas underneath the technique catalogue,
// how the names relate, and how solving changed. Built from the research
// brief in docs/concepts_description.md; every relationship stated here is
// one the brief sources, or one the engine itself demonstrates. Shared by
// the Learn dialog's Intuition tab and the static /learn/intuition/ page.
//
// Each section explains its idea properly, then again "like I'm 12": no
// letters standing for digits, no cell names, no notation of any kind
// (tests/intuition.test.ts holds that line).
import { ALL_TECHS, Tech } from '../engine/ratings';

export type DiagramId = 'fish-sideways' | 'naked-hidden' | 'bent-triple' | 'kite' | 'deadly';

export interface IntuitionSection {
  /** anchor, unique on the page */
  id: string;
  heading: string;
  paragraphs: string[];
  /** the same idea with no notation at all */
  eli12?: string;
  diagram?: { id: DiagramId; caption: string };
  /** dated milestones, for the history section */
  points?: { when: string; what: string }[];
  /** the catalogued techniques this idea covers */
  techs?: Tech[];
}

export interface IntuitionPart {
  id: string;
  heading: string;
  /** a short name for the part, for the jump chips */
  nav: string;
  intro: string;
  sections: IntuitionSection[];
}

export const INTUITION_URL = '/learn/intuition/';

export const INTUITION_LEAD = `sudokUI's catalogue names ${ALL_TECHS.length} techniques. Underneath them are three ideas and one promise the puzzle makes. Learn the ideas and every name becomes a new shape of something you already know. Each idea is explained twice here: once properly, and once the way you would explain it to a 12-year-old.`;

export const INTUITION: IntuitionPart[] = [
  {
    id: 'rule',
    nav: 'The rule',
    heading: 'The one rule',
    intro: 'Every row, column and box holds each digit exactly once. Everything else follows from that sentence.',
    sections: [
      {
        id: 'two-facts',
        heading: 'Two facts in one rule',
        paragraphs: [
          'Exactly once is two promises. At least once: if a digit has only two places left in a unit, one of them is it. At most once: two candidates for the same digit in cells that see each other, by sharing a row, a column or a box, cannot both be true. A cell makes the same two promises: it holds at least one digit, and at most one.',
          'When exactly two options are left, two places for a digit in a unit or two candidates in a cell, solvers call the first kind a strong link; the second kind is a weak link. Nearly every technique on this site, from the Hidden Single to the Forcing Net, combines these two facts until a candidate is ruled out or a digit is forced. Only the uniqueness techniques add a fact of their own, further down.',
          'There are two ways to ask the question. Ask a cell which digits it can still hold, or ask a digit where it can still go in a unit. The first way finds the naked patterns, the second the hidden ones, and good solvers switch between them without thinking.'
        ],
        eli12:
          'Think of a row as a team of nine players wearing the shirts 1 to 9, and no two players share a shirt. If only two players could possibly be wearing shirt 7, one of them is. And if one player is wearing shirt 7, nobody else on the team can be. That is the whole game. Nearly every clever trick is those two thoughts, chained together.'
      }
    ]
  },
  {
    id: 'locked',
    nav: 'Locked sets',
    heading: 'Locked sets: things that must fit',
    intro: 'The first engine. When some things must fit into exactly as many places, they fill those places completely, and nothing else can go there.',
    sections: [
      {
        id: 'singles',
        heading: 'Singles: one thing, one place',
        paragraphs: [
          'A Naked Single is a cell with one candidate left: one place, one digit. A Hidden Single is a digit with one place left in a unit. They are the smallest locked sets there are, seen from the two directions: ask the cell, or ask the digit. A Full House, the last empty cell of a unit, is both at once.'
        ],
        eli12:
          'Every seat must be filled and everyone must sit, one person to a seat. If a seat has only one person who could sit in it, that person sits there. If a person has only one seat they could take, they take it. It is the same idea from opposite ends.',
        techs: ['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE']
      },
      {
        id: 'subsets',
        heading: 'Subsets: two, three or four at a time',
        paragraphs: [
          'Scale the single up. If two cells of a unit can hold only the same two digits, those digits are used up there, so no other cell of the unit can have them: a Naked Pair. If two digits can go only in the same two cells of a unit, those cells are taken, so they can hold nothing else: a Hidden Pair. Triples and quads work the same way.',
          'Naked and hidden are two descriptions of one fact. In a unit with seven empty cells, a naked triple leaves the other four cells for the other four digits, and those four cells are a hidden quad. That is also why nobody needs a naked or hidden five: its other side is always four or smaller.'
        ],
        diagram: {
          id: 'naked-hidden',
          caption:
            'One row, one fact. The three blue cells can hold only 1, 2 and 3: a naked triple. That leaves 4, 5, 6 and 7 with only the four gold cells: a hidden quad. Both descriptions remove the same red candidates.'
        },
        eli12:
          'A row has seven empty chairs and seven people still to seat, one per chair. Three of the chairs are so small that only the same three people fit in them. Those chairs will end up holding exactly those three people, so the three cannot sit anywhere else. Turn it round: the other four people now have only the other four chairs, so those chairs are spoken for. One fact, told from both ends.',
        techs: ['NAKED_PAIR', 'HIDDEN_PAIR', 'NAKED_TRIPLE', 'HIDDEN_TRIPLE', 'NAKED_QUADRUPLE', 'HIDDEN_QUADRUPLE']
      },
      {
        id: 'intersections',
        heading: 'Where a box crosses a line',
        paragraphs: [
          "A box and a row share three cells. If all of a digit's candidates in the box lie in that overlap, the box will put the digit there, so the rest of the row cannot have it: Pointing. Swap the roles and it is Claiming: a row whose candidates for a digit all lie inside one box clears that digit from the rest of the box. Columns work the same way.",
          'It is the smallest locked set between two units: one unit forced to place its digit inside another. A Locked Pair is a naked pair sitting in the overlap, so it clears both units at once.'
        ],
        eli12:
          "A box needs a 4, and its only spots for one lie along its top edge. That edge is part of a long row across the grid, which can hold just one 4, so the box's 4 is that row's 4. The rest of the long row cannot be a 4. It works the other way too: if a row's only spots for a 4 are inside one box, the rest of that box cannot be a 4.",
        techs: ['LOCKED_CANDIDATES_1', 'LOCKED_CANDIDATES_2', 'LOCKED_PAIR', 'LOCKED_TRIPLE']
      },
      {
        id: 'fish',
        heading: 'Fish: one digit, many rows',
        paragraphs: [
          'Now follow one digit across the whole grid. If in two rows the digit can go only in the same two columns, the two rows will use those two columns up, one each, so nothing else in those columns can be that digit: an X-Wing. Three rows in three columns is a Swordfish, four in four a Jellyfish. In a Swordfish a row may have two spots or three; what matters is that all of them fall in the same three columns.',
          'Shrink an X-Wing to one row and one column and you get a Hidden Single: a row where the digit fits in one column only. So a Hidden Single really is a 1-fish, an X-Wing a 2-fish and a Swordfish a 3-fish, and rows and columns can swap roles. Pointing and Claiming are 1-fish too, with a box on one side. A fish bigger than four is never needed, because a fish in five rows always comes with a smaller one in the columns, just as a naked five comes with a hidden subset of four or fewer.'
        ],
        eli12:
          'Two rows each need a 5. In both rows the 5 can only go in the second column or the eighth. Whichever way it works out, one row takes the second column and the other takes the eighth, because a column cannot have two 5s. So both columns get their 5 from these two rows, and every other cell in them can forget about 5.',
        techs: ['X_WING', 'SWORDFISH', 'JELLYFISH', 'SQUIRMBAG', 'WHALE', 'LEVIATHAN']
      },
      {
        id: 'sideways',
        heading: 'The same trick, seen sideways',
        paragraphs: [
          'Picture the puzzle as a cube whose three directions are rows, columns and digits. The usual grid shows rows against columns. Turn the cube and you see rows against digits instead. For one digit, write down for each row the columns where it can still go. Each row becomes a little cell whose candidates are column numbers, and the nine rows behave like a unit: every column number belongs to exactly one of them.',
          "Now an X-Wing is two of those cells holding the same two column numbers: a Naked Pair. A Swordfish is a Naked Triple and a Jellyfish a Naked Quad. Turned another way, the cube shows a naked pair as a hidden pair. Every fish of rows and columns without a fin is a subset in costume, and so is every subset in a row or column; a subset inside a box, or a fish that uses a box, has no such twin, because a box is not one of the cube's directions."
        ],
        diagram: {
          id: 'fish-sideways',
          caption:
            "Left: where 5 can go in a grid with an X-Wing in rows 2 and 7. Right: the same 5s listed by row, as cells holding column numbers. Rows 2 and 7 hold only 3 and 8, a naked pair, so no other row can put its 5 in column 3 or 8."
        },
        eli12:
          "Write each row's possible spots for a 5 on a card. Two cards say only the third column and the eighth. Each of those rows needs a 5 and no column can take two, so between them they use up both columns, and no other card can use either. Two cards stuck with the same two choices is just a pair, like two cells that can only be a 3 or an 8. The X-Wing is a pair, seen sideways.",
        techs: ['X_WING', 'NAKED_PAIR', 'HIDDEN_PAIR']
      },
      {
        id: 'fins',
        heading: 'Fins, and fish with boxes',
        paragraphs: [
          "A finned fish is a fish with a few extra candidates, the fin, crowded into one box. Either the fish is real or the fin holds the digit, so a cell in the fish's columns, outside its rows, that sees every fin cell loses the digit either way. A Sashimi fish is a finned fish whose finned row, without its fin, would have only one spot left. Franken fish let boxes stand in for rows or columns.",
          'Either this or that is how chains think, and chains come later. A finned fish is the first place on this page where a locked set and a chain meet.'
        ],
        eli12:
          "A finned fish is an X-Wing with one messy corner: one row has an extra spot or two for the 5, all in the same box as one of its corners. Either the neat X-Wing is real, or the 5 is in those extra spots. A cell loses its 5 for real only if it loses it in both stories: it sits in one of the X-Wing's columns, outside its two rows, and sees every extra spot.",
        techs: ['FINNED_X_WING', 'SASHIMI_X_WING', 'FINNED_SWORDFISH', 'FRANKEN_X_WING']
      }
    ]
  },
  {
    id: 'almost',
    nav: 'Almost locked',
    heading: 'Almost locked: one too many',
    intro: 'The second engine. A group that is one digit away from being locked is nearly as useful as a locked one, because whatever spoils it has to happen somewhere you can point at.',
    sections: [
      {
        id: 'als',
        heading: 'Almost locked sets',
        paragraphs: [
          'An almost locked set is N cells in one unit holding N+1 digits between them. Take any one of those digits away and the cells lock onto the rest. The smallest is a single bivalue cell: one cell, two candidates.',
          'That makes every almost locked set a switch. If one of its digits turns out to be impossible, the set becomes locked and places all the others.'
        ],
        eli12:
          'Four friends sitting together each pick a different snack from a list of five. If one of the five runs out, the four friends must take the other four, one each, so every one of those four snacks gets picked.',
        techs: ['ALS_XZ']
      },
      {
        id: 'bent',
        heading: 'Bent subsets: the wings',
        paragraphs: [
          'Put a naked triple in one row and it is locked. Bend it round a corner, so the three cells sit in two units, and it nearly still works. That is an XY-Wing or an XYZ-Wing: three cells, three digits, bent. Four cells and four digits make a WXYZ-Wing, a bent quad, and five make a VWXYZ-Wing, a bent quint.',
          'Why it works: in a bent subset, every digit but one has its candidates in cells that all see each other, so it can be used at most once. Only one digit, Z, might repeat, because its cells do not all see each other. Without Z, the cells would need as many different digits as there are cells, from one digit fewer. That is impossible, so Z is in the pattern, and any cell that sees every Z in it loses Z.',
          'XY-Wing and XYZ-Wing differ only in whether the middle cell, the pivot, also holds Z. If it does, the removed cells must see the pivot as well.'
        ],
        diagram: {
          id: 'bent-triple',
          caption:
            'Top: a naked triple in one row. Bottom: the same three digits bent round a corner, an XY-Wing. The blue pivot holds 1 and 2 and sees both gold pincers. Whatever the pivot is, one pincer must be 3, so the two cells with a red 3, which see both pincers, cannot be 3.'
        },
        eli12:
          'Four friends each take one snack, and nobody may have the same snack as someone they can see. There are only four kinds. Three kinds can go to one friend at most, because everyone who might take them can see each other. Only cookies could go to two friends who sit apart. With no cookie, four friends would need four different snacks from three kinds. So somebody has a cookie, and anyone who can see every possible cookie taker cannot have one.',
        techs: ['XY_WING', 'XYZ_WING', 'WXYZ_WING']
      },
      {
        id: 'als-xz',
        heading: 'ALS-XZ: the parent of every bent wing',
        paragraphs: [
          'Take two almost locked sets with no cell in common, both holding the digits X and Z. If every X in the first set sees every X in the second, at most one set can have X, so at least one set goes without it. A set without X locks onto its other digits, Z among them. So at least one of the two sets places Z, and Z can go from any cell that sees all the Zs in both sets.',
          'Each bent wing in the catalogue is this rule with one set made of a single bivalue cell: an XY-Wing is a bivalue cell plus a two-cell set, a WXYZ-Wing a bivalue cell plus a three-cell set. That is why some guides, sudoku.coach among them, now call the bigger wings simply ALS-XZ, and why sudokUI finds a five-cell wing of that shape under ALS-XZ.',
          'The idea grows from there. ALS-XY-Wing is an XY-Wing whose three cells have grown into sets, Death Blossom gives each candidate of one cell a set of its own, and Sue de Coq shares out the crowded cells where a box crosses a line between one set in the rest of the line and one in the rest of the box.'
        ],
        eli12:
          'Nobody may have the same snack as someone they can see, and friends at a table see each other. Two tables each have one more snack on their list than friends, so a table that loses a snack takes all the rest. Both lists have crisps and chocolate. Every possible crisps eater at one table can see those at the other, so at most one table gets crisps. A table without crisps takes everything else, chocolate included. So anyone who can see every possible chocolate eater cannot have chocolate.',
        techs: ['ALS_XZ', 'ALS_XY_WING', 'DEATH_BLOSSOM', 'SUE_DE_COQ']
      },
      {
        id: 'w-wing',
        heading: 'Not every wing is bent',
        paragraphs: [
          'The W-Wing shares the name but not the idea. It is two identical bivalue cells joined by a strong link on one of their digits, which makes it a short chain rather than a bigger XYZ-Wing. The W does not mean one more letter.'
        ],
        eli12:
          'Two cells can each only be a 1 or a 2. Somewhere else, a row, column or box has just two spots left for 2, and each cell sees a different one of them. If the first cell is a 2, the spot it sees is not, so the other spot is the 2, and the second cell, which sees it, must be a 1. So one of the two cells is always a 1, and a cell that sees both is not.',
        techs: ['W_WING']
      }
    ]
  },
  {
    id: 'chains',
    nav: 'Chains',
    heading: 'Chains: if not this, then that',
    intro: 'The third engine, and the umbrella over most of the others. A chain passes one inference along from candidate to candidate until its two ends agree on something.',
    sections: [
      {
        id: 'links',
        heading: 'Strong and weak links',
        paragraphs: [
          'A strong link joins two candidates of which at least one is true: a digit with two spots left in a unit, or a cell with two candidates. A weak link joins two of which at most one is true: two candidates for one digit that see each other, or two candidates in one cell. A chain alternates them, starting and ending with a strong link. If this end is false, the next is true, so the one after is false, and so on.',
          'When a chain starts and ends on the same digit, one of its two ends is true, so any cell that sees both ends loses that digit. When a chain closes into a loop whose links alternate all the way round, every weak link in it can remove candidates of its own.'
        ],
        eli12:
          'Every possible number in a cell is a light switch, on if it is the answer. A strong link is two switches with at least one on, a weak link two with at most one on. Line them up strong, weak, strong: if the first is off, the second is on, the third off, the fourth on. So the first or the last is on, and if both are a 6, a cell that sees both ends is not a 6.',
        techs: ['X_CHAIN', 'AIC']
      },
      {
        id: 'one-digit',
        heading: 'One-digit chains: kites, skyscrapers and turbots',
        paragraphs: [
          'A chain that follows one digit is an X-Chain. Its shortest useful form is two strong links joined by a weak one, four candidates in all, and its shapes have their own names: a Skyscraper when the two strong links run parallel, a 2-String Kite when one runs along a row and the other down a column and they meet in a box, and a Turbot Fish for the other shapes.',
          'An X-Wing is that chain closed into a loop, and an Empty Rectangle splits the candidates in one box into a row group and a column group, at least one of which holds the digit. Longer chains on one digit are X-Chains too, and the loops are X-Cycles.'
        ],
        diagram: {
          id: 'kite',
          caption:
            'A 2-String Kite on 4. Row 2 has only two spots for 4, and so has column 3; the gold one of each sits in box 1. If neither blue end were 4, both gold cells would be, and a box cannot hold two 4s. So one end is 4, and the red cell, which sees both ends, is not.'
        },
        eli12:
          'A row and a column each have just two spots for 4. One spot from each sits in the same box, and they are two different cells; call the other two the ends. Is there a world where neither end is the 4? Then the row and the column would both put their 4 in that box, in two different cells, and a box cannot hold two 4s. That world does not exist. So at least one end is the 4, and a cell that sees both ends is not.',
        techs: ['SKYSCRAPER', 'TWO_STRING_KITE', 'TURBOT_FISH', 'EMPTY_RECTANGLE', 'X_CHAIN', 'X_CYCLES']
      },
      {
        id: 'colouring',
        heading: 'Colouring: two worlds',
        paragraphs: [
          'Start from one candidate of a digit and follow its strong links outwards, colouring alternately in two colours. Everything you reach is one cluster, and in it one colour is entirely true and the other entirely false; you just do not know which yet. If one colour would put the digit twice in a unit, that colour is false. If a cell sees both colours, it loses the digit whichever colour wins. A separate cluster needs colours of its own.',
          "Simple Colors pictures one cluster of strong links at once, so it finds every X-Chain built only from that cluster's links. Multi Colors joins two clusters, and 3D Medusa colours across all the digits at once."
        ],
        eli12:
          'Pick one spot where a 7 could go and paint it blue. Whenever a row, column or box has only two spots for 7 and one is painted, give the other the opposite colour, so blue and gold take turns. Keep going until nothing more can be painted. Now either every blue spot is a 7 and no gold one is, or the other way round. Any other spot that can see a blue and a gold is not a 7 either way.',
        techs: ['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D']
      },
      {
        id: 'pairs',
        heading: 'Chains of pairs',
        paragraphs: [
          'A bivalue cell is a strong link inside a cell: if it is not one digit, it is the other. Hop from a bivalue cell to another bivalue cell that sees it, through a digit they share, and leave each cell by its other digit: that is an XY-Chain. Its three-cell version is the XY-Wing again, which is how one pattern can be a wing, a bent subset, a pair of almost locked sets and a chain at the same time. A Remote Pair is an XY-Chain whose cells all hold the same two digits.'
        ],
        eli12:
          'A line of dominoes each has two numbers and shows just one. Each shares one number with the domino before and its other with the domino after, and neighbours sit in the same row, column or box, so they cannot both show the number they share. If the first hides its outer number, it shows the shared one, so the second shows its other number, and so on down the line. So one outer number shows, and if both match, a cell seeing both ends is not that number.',
        techs: ['XY_CHAIN', 'REMOTE_PAIR', 'XY_WING']
      },
      {
        id: 'aic',
        heading: 'One chain to hold them all',
        paragraphs: [
          'An Alternating Inference Chain allows every kind of link at once: one digit along a unit, two digits in a cell, a group of candidates in a box, even a whole almost locked set. Most named patterns are short AICs or loops: the X-Wing, the Skyscraper, the XY-Wing, the W-Wing and ALS-XZ among them. A Nice Loop is the same thing written as a loop.',
          'Forcing chains are the last step before guessing. Assume a candidate and follow every consequence, then do the same for the alternatives. If all the branches agree on something, it is true, and if one branch ends in a contradiction, its starting assumption was false. They are powerful, but there is no shape to spot, which is why sudokUI keeps them for the hardest puzzles.'
        ],
        eli12:
          'Detective work. A cell can only be a 3 or a 5. Suppose it is a 3 and follow everything that must happen next. Then suppose it is a 5 and follow that too. If both stories end with the same other cell being a 9, that cell is a 9, whichever the first cell turns out to be. It only works when the stories cover every number the first cell could be.',
        techs: ['AIC', 'NICE_LOOP', 'AIC_ALS', 'CELL_FORCING_CHAIN']
      }
    ]
  },
  {
    id: 'unique',
    nav: 'One solution',
    heading: 'The promise: one solution',
    intro: 'A side branch with its own logic. A proper puzzle has exactly one solution, and that promise is itself a clue.',
    sections: [
      {
        id: 'deadly',
        heading: 'Deadly patterns',
        paragraphs: [
          'Four cells in two rows, two columns and two boxes that could only hold the same two digits would be a trap: the two digits could swap places and both versions would fit. That is two solutions, so a puzzle with one solution never ends up like that. If three corners of the rectangle hold only 1 and 2 and the fourth holds 1, 2 and 5, the fourth must be 5. That is a Unique Rectangle. BUG+1 uses the same promise on a trap that covers the whole grid, and the Avoidable Rectangles on rectangles whose corners include digits you placed yourself.',
          'These techniques are only valid when the puzzle really has one solution. sudokUI only accepts puzzles that do, so here they are always safe.'
        ],
        diagram: {
          id: 'deadly',
          caption:
            'A Unique Rectangle. Three blue corners hold only 1 and 2. If the fourth corner were 1 or 2 as well, the 1s and 2s could swap and the puzzle would have two solutions. So its 1 and 2 go, and it is 5.'
        },
        eli12:
          'Four empty cells sit at the corners of a rectangle, in two rows, two columns and only two boxes. Three of them can only be a 1 or a 2. If the fourth were a 1 or a 2 as well, you could swap every 1 and 2 among the four corners and the puzzle would still work: two answers. A good puzzle has only one, so the fourth corner is neither a 1 nor a 2.',
        techs: ['UNIQUENESS_1', 'BUG_PLUS_1', 'AVOIDABLE_RECTANGLE_1']
      }
    ]
  },
  {
    id: 'sets',
    nav: 'Underneath',
    heading: 'Underneath it all',
    intro: 'The three engines turn out to be one counting idea, seen at different strengths.',
    sections: [
      {
        id: 'truths',
        heading: 'Truths and links',
        paragraphs: [
          "Allan Barker's set logic describes nearly all of it at once. A truth is a group of candidates of which exactly one is true: the candidates of a cell, or one digit's places in a unit. A link is a weak link stretched to a whole group: of all its candidates, at most one is true. If N truths that share no candidate are covered by N links, the truths use up every link, so any other candidate in those links is false. That single rule is every locked set and every fish without a fin.",
          'Allow one link more than there are truths and you get chains, finned fish and wings, where a candidate falls only if it sits in two of the links at once. Most technique names are short ways of saying where the truths and the links are.'
        ],
        eli12:
          'Three jobs each need exactly one helper, and only three helpers can do any of them. No helper can take on two jobs. So all three helpers end up busy with these jobs, and none of them is free for anything else on their lists.'
      }
    ]
  },
  {
    id: 'names',
    nav: 'Names and history',
    heading: 'Why the names are a mess',
    intro: 'Many of these names come from internet forums around 2005, before anyone had joined the techniques into one theory. They stuck because they were memorable and widely used, not because they were systematic.',
    sections: [
      {
        id: 'x-wing-first',
        heading: 'X-Wing came first',
        paragraphs: [
          'By June 2005 a forum regular already counted X-Wing and Swordfish among the few names most players agreed on, and nobody in that thread could say who had coined them. The two-row fish was known and named before players saw that three or four rows work too, so the family was named around it: Swordfish, Jellyfish, then Squirmbag, Whale and Leviathan for sizes nobody needs. That is why the X-Wing is a fish and not a wing.',
          'Squirmbag was unpopular, and by late 2005 players were suggesting Starfish instead. The X most likely stands for the diagonal shape of the four corners. The Star Wars fighter and the Fairey Swordfish biplane are popular stories without a known source, so treat them as folklore.'
        ],
        techs: ['X_WING', 'SQUIRMBAG']
      },
      {
        id: 'letters',
        heading: 'Letters that count digits',
        paragraphs: [
          "In the wings the letters nearly count digits. The XYZ-Wing, WXYZ-Wing and VWXYZ-Wing use three, four and five digits, so as bent subsets they are a triple, a quad and a quint. The XY-Wing uses three digits too, a bent triple like the XYZ-Wing, but its letters name only the two in its pivot. Y-Wing is not a different or a newer technique. It began in 2005 as a forum shorthand for XY-Wing, and both names are still in use. Bigger wings, VWXYZ and up, have names too, but they are found as ALS-XZ, the rule they come from, and some guides now use only that name.",
          'The W-Wing breaks the pattern: it is a chain, and its W does not count anything.'
        ],
        techs: ['XY_WING', 'XYZ_WING', 'WXYZ_WING', 'W_WING']
      },
      {
        id: 'shape-names',
        heading: 'Names that teach',
        paragraphs: [
          'On 26 December 2005 a forum user called Havard posted the Skyscraper and the 2-String Kite, while admitting that both were Turbot Fish. Another regular asked why an existing technique needed new names, and listed ten names already in use for the same family. Havard answered that the names help people remember the pattern. The shape names won, because they teach better.',
          'Sue de Coq is usually said to be named after the forum handle of the player who first posted it, as Two-Sector Disjoint Subsets. Bob Hanson named 3D Medusa himself: a three-dimensional view made him think of Medusa and her hair.'
        ],
        techs: ['SKYSCRAPER', 'TWO_STRING_KITE', 'SUE_DE_COQ', 'MEDUSA_3D']
      },
      {
        id: 'history',
        heading: 'How solving changed',
        paragraphs: [
          'The techniques arrived as separate tricks with separate names, and the theory that joins them came later. That order is the reason the catalogue reads like a zoo.'
        ],
        points: [
          { when: 'Mid-2005', what: 'X-Wing and Swordfish are already standard names, and fish of up to five rows have names on a programmers forum.' },
          {
            when: 'Autumn 2005',
            what: 'Names are still unsettled: one player calls every fish of three or more rows a Swordfish, another says he found the X-Wing on his own and called it a rectangle. Sue de Coq is posted as Two-Sector Disjoint Subsets.'
          },
          { when: 'November 2005', what: 'The BUG principle: if every unsolved cell has two candidates and every candidate appears twice in each unit, the grid cannot have exactly one solution.' },
          { when: 'December 2005', what: "The Skyscraper and the 2-String Kite get their names. 3D Medusa, Bob Hanson's colouring across all digits, is already one of the names in use." },
          { when: 'January 2006', what: 'A forum regular sums up what players have been noticing: the XY-Wing is just a short forcing chain, and the X-Wing and the Turbot Fish are X-Cycles.' },
          { when: 'Around 2006 and 2007', what: 'A forum guide to fish covers boxes (Franken and Mutant fish) and Kraken fish, and the Empty Rectangle is in use.' },
          { when: 'Since then', what: 'Unifying ideas take over: almost locked sets show that the bent wings are one rule, set logic shows that fish, subsets and chains are one counting idea, and the Sudoku Explainer rating becomes the common yardstick of difficulty.' }
        ]
      }
    ]
  },
  {
    id: 'fast',
    nav: 'Getting fast',
    heading: 'Getting fast',
    intro: 'Knowing which idea a pattern belongs to is what turns dozens of names into a handful of habits.',
    sections: [
      {
        id: 'see',
        heading: 'Hard to see is not hard to understand',
        paragraphs: [
          'Sudoku Explainer rates the Naked Pair 3.0, the X-Wing 3.2 and the Hidden Pair 3.4, though in a row or column all three are one pattern seen from different sides. It rates the Turbot Fish 6.6, yet other guides, HoDoKu among them, teach it early. Ratings measure how hard a pattern is to spot, not how deep it is. Once you know the idea, a new pattern stops being a thing to memorise and becomes a familiar thing in a new place.',
          'So scan by idea, not by name. Count first: singles. Then look for locks: pairs and triples in a unit, a digit confined to a box and line overlap, one digit lining up in the same columns across several rows. Then look for almost locks: bivalue cells are the smallest almost locked set and the start of every wing and XY-Chain. Then follow links: a digit with two spots in a unit is a strong link waiting to be chained.',
          'The How to solve tab shows how the best solvers order this in practice, and practice mode puts most techniques, one at a time, in front of you as the very next move.'
        ],
        eli12:
          'You do not learn dozens of tricks. You learn three ideas and one promise: things that must fit, things that almost fit, if not this then that, and the promise of only one answer. Everything else is those wearing different clothes.'
      }
    ]
  }
];

/** every section, in page order */
export const INTUITION_SECTIONS: IntuitionSection[] = INTUITION.flatMap((p) => p.sections);
