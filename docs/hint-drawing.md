# Hint drawing, version 2: HoDoKu's board, our teaching

The spec for redrawing every hint, written 23 October 2026 from the
owner's screenshots of HoDoKu, a reading of HoDoKu's source, a map of what
our renderer and every technique emit today, and a study of the other
solvers. It replaces the drawing rules of [highlighting.md](highlighting.md)
where they differ; that file keeps the family-by-family history and is
updated as each phase lands. The **Status** section at the end says what is
done, so a session that picks this up starts there.

## Why

HoDoKu's hints are easier to read than ours. Four things make the
difference, all on the board and none in the words:

1. A chain shows its **truth values**: each node is "assumed false" or
   "therefore true", so the logic reads off the board before a word of
   text (HoDoKu: blue and green discs; `SudokuPanel.java:2334-2342`).
2. **Ink only on candidates.** A hint never tints a cell; the rest of the
   board stays readable (`SudokuPanel.java:2415-2421`).
3. **Straight arrows**, disc edge to disc edge, bent only when another
   node of the same hint lies on the line (`SudokuPanel.java:2661-2687`).
   Ours swing out by design and loop inside cells.
4. **Arrows on top** of everything, grid lines included
   (`SudokuPanel.java:2501-2562`); ours are drawn under the grid lines
   (`Grid.tsx` draws links before the lines).

HoDoKu is also legacy, and its flaws are not copied: red and green carry
meaning alone (about 1 in 12 men cannot tell its eliminations from its true
nodes), red is both the arrows and the removals, blue means six different
things, nothing explains the colours, the notation is the only text, a
forcing net's overlapping branches are coloured "by chance", and it is a
light-only desktop window. What sudokUI already does better stays: the
legend that names every colour, the walk that reads a hint link by link,
the prose beside the notation, the house bands for fish and singles, the
named floor and roof of uniqueness patterns, four themes and phones.

The aim is the owner's: an engine you can feel, light and offline, whose
hints a Nightmare-level solver trusts at a glance and a casual player can
follow. A drawing that disagrees with the logic teaches something false, so
everything below is generated from one object per step and tested against
it.

## The grammar

Every rule is numbered so a commit, a test or a review can cite it.

### Marks

- **G1. Candidates only.** A hint marks candidates with discs behind the
  digit, and a solved cell by colouring its digit and drawing a rounded
  outline round it, so the shape says it as well as the colour (an
  entered digit is already coloured). It never tints a cell. The player's own layers (selection, peers, same digit,
  their colours, errors) stay under everything and are untouched. House
  bands (G15) and set tiles (G16) are the only areas a hint shades.
- **G2. Truth by colour and shape.** A chain node that is true under the
  hint's premise is a **filled disc** in the true colour; a node that is
  false is a **ring** in the false colour, faintly tinted inside, around
  its digit. The shape carries the meaning without colour vision, in print
  and in the legend; the colour helps everyone else. (HoDoKu: green
  filled, blue filled.) A hint always draws the digits it marks, even where
  the player has not pencilled them: a ring with nothing in it says
  nothing.
- **G3. Removed and placed are their own marks.** A removal is a ring in
  the removal colour **with a diagonal bar through it** (it is false, and
  removed); a placement is a true disc **with an outer ring** (it is true,
  and written in). Neither may be told from a true or a false node by
  colour alone. On a small board the outer ring is drawn thicker and moved
  out by as much, so the gap between it and the disc stays visible.
- **G4. Pattern roles keep their grammar.** Candidates that are part of a
  pattern but carry no truth claim (fish bases, a subset, a rectangle's
  floor, a wing's pivot) are filled discs in the role colours: pattern,
  acts-through, exception (today blue, amber, purple). A pattern disc
  must never use the true colour: painting a fish base "true" teaches that
  it is placed.
- **G5. Precedence.** One mark per candidate: removed > placed > chain
  truth (a true disc, a false ring, a "one of these" square) > a role > a
  set's member (its digit bold on the set's tile, no shape; since phase 4,
  [hint-drawing-sets.md](hint-drawing-sets.md)). A view draws roles inside
  a set only in Death Blossom, which draws no truth until phase 5, so no
  role disc sits beside a truth mark; an ALS pattern whose chain clashes
  (its sets share cells, and its truths would claim more than the step
  proves) draws neither, its sets' candidates members and its removals
  removals, in every view. A candidate a step lists in more
  than one role takes the first of pattern, acts-through, exception, in
  the full view and in every walk frame alike. A candidate that is removed
  keeps no ring of a colour it never had (before phase 1 four techniques
  drew a removal ringed blue that was never blue: Simple Colors' trap
  target, Multi Colors rule 1 and 2, Medusa rules 3-5, Digit Forcing's
  removal; Aligned Pair Exclusion, Exocet and Pattern Overlay ringed their
  removals blue because the removals sit in the pattern list). A
  colouring's removal holds nothing inside its ring, not even the shade it
  was in (on a dark board a removal ring on a shade's fill is 1.16:1); the
  legend names the shade instead ("remove: dark purple, proven false").
  The colouring exception, by which a colouring's removal kept its
  parity's colour inside the ring, was retired in phase 3. A removed or placed
  node of a chain whose truth is drawn (phase 2b) is the removal or the
  placement alone: the mark says its truth (removed is false, placed is
  true), so no truth ring or disc is drawn with it; the walk's frames
  before the conclusion show it as a truth mark (a true group's
  candidates as "one of these" squares on their bar, a false group's as
  rings on theirs, since phase 4). Any other removed chain
  node keeps the colour the step names for it inside the removal ring, as
  Nishio's removed assumption does, so the legend's words for that colour
  still find it. A placed chain node the step names keeps that colour in
  its disc inside the placement's outer ring, as Digit Forcing's placed
  assumption does.
- **G6. Digits on discs.** A digit on a filled disc is near-black in every
  theme; a digit inside a ring is the theme's strongest ink (the givens'
  colour), in bold. Unmarked candidates stay as they are: nothing is dimmed
  by default (see G17 for digit focus). Every mark has a thin keyline in
  the board's colour, so it stays distinct over the player's own cell
  colours (an edge-less dark-theme disc on a yellow cell is 1.2:1 without
  it).

### Arrows

- **G7. One arrow colour.** Every arrow and tie uses one high-contrast
  colour that no candidate mark uses (not the removal red, not the
  acts-through amber it shares today). Strong and weak differ by dash, not
  colour.
- **G8. Style follows the inference.** An arrow into a true node is solid;
  an arrow into a false node is dashed (HoDoKu's rule:
  `SudokuPanel.java:2639-2643`). In a correct chain this is the link's
  own strength; where a strong link is used as a weak one (the chain
  trainer, some loops), the arrow is dashed and the walk says so ("this
  pair is strong too; here only its weak half is needed").
- **G9. Straight, edge to edge.** An arrow is a straight segment from the
  edge of its start disc to the edge of its target disc, with a small gap
  at each end, and a head at the target only. A link shorter than about
  half a cell has no head.
- **G10. Bend only to clear the hint's own marks.** If the straight
  segment passes within a disc radius of another mark of the same hint (a
  node, a removal, a member of a group or set), the arrow becomes one gentle
  arc to the side with more clearance, and the arc is checked to clear
  those marks along its segments and its head, not only at sample points.
  The arc turns midway first, then nearer either end (an arrow can then
  come in or leave steeply past a mark beside its node), the smallest bulge
  first. Where marks beside both ends box the arrow in, one arc cannot
  leave steeply and arrive steeply too, so an arc with a bend off each end
  is tried next (a cubic, its two control points on one side); if none
  clears, the clearest drawing wins. A head also keeps off the
  other digits its target's cell shows, which are cut out of the arrows
  (G11): an arrow that would land its head on one comes in from a clear
  side instead, so it never seems to end on the wrong digit. No arrow runs
  along another of the same hint (away from the nodes where arrows
  gather): an arc that would hide another arrow loses to any drawing that
  does not, and keeping clear of the marks comes first, then not hiding
  an arrow, then the head's room. Arcs stay
  on the board: HoDoKu's loop that seems to leave the grid is an accident
  of its fixed bend, which always bulges to the left of travel by a set
  amount and is never checked against what it passes
  (`SudokuPanel.java:2693-2711`); ours chooses the side. Unrelated
  candidates and digits are crossed straight, readable through the halo
  (G11). Two arrows joining the same two nodes are drawn side by side. A
  group or set node is anchored at its member nearest the other end of the
  link (a centroid can fall in a cell that is not one of its members;
  HoDoKu anchors at a group's first member only, so its other members get
  no arrow), never at a bar's or tile's edge: the tail or tip is where the
  ray towards the other end leaves that member's mark, exactly (a "one of
  these" square reaches 13 on its axes and 15.5 at its corners), plus the
  gap. Since phase 4 a group's bar and a set's letter tabs are obstacles
  for every arrow, tie, start dot and walk number: an arrow is free of its
  own group's bar only beside the member it anchors at, a start dot not at
  all, so a dot never sits on the bar of the group it opens. No arrow
  crosses a bar except at its anchoring member, so none passes between a
  group's members (63 of 762 groups had one): over the stored examples and
  both drawing fixtures none does, and of the grouped steps on offer at
  the positions of the maps' 577 cached grouped chains two arrows still
  meet a bar where no drawing clears it. A set's tiles are areas, crossed
  as bands are, and its members obstacles, as marks are. The tabs are
  placed knowing the drawing without them, off its heads, dots and
  numbers and, where a place allows, off its arrows' lines, so no arrow
  bends for a tab; the arrows, dots and numbers are then worked out round
  the tabs, once for the whole hint (G14). A link between two digits of
  one set draws no line, wherever the two lie (G12). A step with no sets
  is laid out exactly as before
  ([hint-drawing-sets.md](hint-drawing-sets.md), As built).
- **G11. Over the lines and marks, under the digits.** The layers, from
  the bottom: the player's own layers, bands, set tiles (fill, then
  outline; a shared cell's dashed inner outline), group bars (cut out by
  the digits, as arrows are), marks (each keyline parting its mark from a
  bar under it), solved-digit outlines, grid lines (a thin cell line
  crosses a gapped group's bar; a group never crosses a box line), arrows
  and ties (every halo before any line), digits (a set's members bold, in
  the ring's ink), removal bars, letter tabs, start markers and walk
  numbers (the tiles, bars and tabs since phase 4,
  [hint-drawing-sets.md](hint-drawing-sets.md)). The Learn diagrams draw
  the same layers. An arrow crosses
  box lines as HoDoKu's do, with a halo in the board's background colour,
  and passes under a digit: every digit is cut out of the arrows (a mask
  holding the digits, thickened), so a digit an arrow crosses stays whole
  and is never struck through, whatever the cell's colour, and an arrow
  reads as passing behind it. A head is never cut: where no approach keeps
  it off a digit, the digit is drawn over it. HoDoKu draws its arrows over the digits and
  loses some; the arrows share the givens' ink, so without the cut a 3
  crossed at its edge reads as an 8. Round caps and joins; a weak link's
  dashes have square ends.
- **G12. No arrow inside a cell.** A link whose two ends share a cell and
  differ in digit (a bivalue switch; an ALS's change of digit, even where
  the set spans other cells too) draws no arrow: the false ring and the
  true disc side by side say it. The walk still gives it a frame and a
  sentence. The next arrow starts at the candidate the chain leaves the
  cell by. A colouring's tie inside one cell (a bivalue cell in 3D Medusa
  or a Remote Pair) draws nothing either: a dark and a light disc side by
  side say it. A colouring's weak tie inside one cell (3D Medusa's witness
  or clash between two candidates of a cell) is drawn as **corner
  brackets** round the cell, so no frame is blank: four L-shapes in the
  arrow ink, inset 0.055 of a cell, arms 0.10 (shorter at the bottom
  corners, which sit nearer the bottom row of candidates, so every arm
  keeps 0.18 of a cell from each candidate's place), the arrow's stroke
  and halo (thicker on a phone), the walk number on the first clear
  corner.
- **G13. Ties stay quiet.** An undirected tie (a conjugate pair or a
  bivalue cell in colouring: exactly one of its ends is true) is a thin
  line in the arrow colour at reduced opacity, no head, straight unless it
  would pass within a mark and a gap of another mark its frame draws, or
  of another candidate of its digit the board shows (marked or not: a
  Remote Pair's tie joins two cells that see each other, and its own
  removal can lie on the line), when it bends round them with G10's
  router (no head, no dot), leaving a candidate it shares with another
  tie at least 30 degrees off that tie and crossing it nowhere further
  on, wherever the marks leave room (an S, leaving to one side of its
  line and arriving from the other, when ties stand beside both ends), so
  the two never read as one line joining their far ends (two candidates
  of one shade); missing those 30 degrees by under 10, with no crossing,
  is better than running along a box line or beside another tie. A bend
  off each end (a two-bend or an S) is tried only for the marks, a fork
  or a run along another tie, never just to leave a grid line, and it
  loses to the arc when it runs within a quarter of a cell beside another
  tie of its frame for more than 0.3 of a cell (the two read as a double
  line though their halos never touch); no bend crosses another tie
  twice. Ties and weak ties keep 0.08 of a cell off the board's edge,
  their halo and half the border, where the line would merge with the
  border. A tie is drawn only in its cluster's walk frame (G19), along
  the shortest drawn tree that joins the cluster (Kruskal on the drawn
  length, 3 cells more for each other mark of the hint within 0.13 of a
  cell of the line; of ties that weigh the same, first a straight line,
  then one with the fewest ties at its ends within 60 degrees of it, then
  reading order), and never in the full view. A **weak tie** (a
  colouring's witness, clash or bridge: its two ends see each other or
  share a cell, so at most one is true) is a dashed line with no head and
  no start dot, bent like an arrow (G10), with its halo and the digits cut
  out (G11), and numbered in the walk. With no head to say which
  candidate of a cell it ends at, each end keeps a mark's radius, a gap
  and the clearance further from the other marks of its cell than from
  its own; boxed in there by those marks, it comes into its candidate
  from a free side, a control point off each end along a way that keeps
  the end clear. Two weak ties into one candidate cross nowhere further
  than a quarter of a cell from it, wherever the marks leave room, where
  they would swap sides just before it: the earlier is drawn again
  knowing the later, turning from its line no more than it must, or else
  the later knowing the earlier, and neither gives up its end's room or
  its clearance of the marks for it. A weak tie claims no truth, so it
  stays true whatever its ends turn out to be: it is drawn from its frame
  on, in the full view and in the Learn diagram.
- **G14. A start marker.** The first node of each branch carries a small
  start marker beside its mark (not at the tail of the first drawn arrow:
  after a switch inside the start cell, that tail is the second node),
  inside the node's cell, off the digits the cell shows and clear of the
  arrows and the other marks: upper left when that is clear, then round
  the clock, else wherever has most room (a cell line's real width
  counts, so a dot boxed in may touch a thin cell line, never a box line
  when it can help it). A colouring's ties and weak ties have no reading
  order and no marker. The walk numbers each arrow by the frame that adds
  it, so the number on the board is the one the panel shows; a number
  sits on its arrow's shaft, as near the middle as keeps it clear of the
  numbers placed before it, the marks, the start dots and every head; on
  its shaft before beside it (and beside it, never nearer another arrow
  than its own); clear of the digits the board shows at the size a phone
  draws it, and off the empty candidate places, where it would read as a
  candidate the cell does not have; at the wide board's size only when
  nothing else is clear. The geometry knows where the player's own marks
  are drawn (a centre line or the edge layout takes the whole cell), and a
  cell the full view marks keeps its digits on the 3×3 through the walk. The
  arrows, dots and numbers are worked out once for the whole hint, from
  the full view, so an arrow the reader has followed never moves or
  changes shape as the walk goes on; each frame draws the first of them.
- **G14a. Lines that survive a phone.** At a phone's 36-40 CSS pixels a
  cell, a 0.03-cell arrow is a pixel and the removal bar less; on a board
  narrower than 600 CSS pixels (measured on the board, not the window)
  arrows, bars and rings are drawn thicker so none falls below about 1.5
  CSS pixels, and a step thicker again under 330; the start dots grow by
  1.4 and the walk numbers by 1.6, and the geometry leaves room for them
  at that size everywhere. A browser without container queries goes by
  the window instead: its width, or its height for a phone on its side. The Learn diagrams, small on every screen,
  draw their lines half again as thick and their start dots at the
  larger size, and put their candidates on the app board's pitch.

### Areas

- **G15. Bands** shade a whole house under the marks: a fish's base and
  cover lines, a subset's house, a single's house, Locked Candidates' box
  and line. A pattern's band (base) has a solid outline, an acts-through
  band (cover) a dashed one, so the two differ by shape and not only by
  colour.
- **G16. Sets.** A group node (the 2-3 candidates of one digit in one box
  and one row or column) and an almost locked set are drawn as what they
  are, never as a hull round cells or candidates that are not theirs (a
  hull would cover another candidate in 55% of groups and 33-43% of sets).
  Since phase 4 ([hint-drawing-sets.md](hint-drawing-sets.md), which gives
  the shapes, tints, words and what the build refined):
  - A group is its members' own marks on a bar: a short straight line in
    the glyph-free gutter beside them, in their mark's ink, on the side
    that crosses fewest glyphs, marks, earlier bars and arrows. A TRUE
    group's members are pale "one of these" rounded squares, never a true
    disc and never the true green fill (a TRUE group means "one of these",
    and painting every member true teaches that all are placed); a FALSE
    group's are its false rings; a proof-only view's are pattern discs on
    a pattern-ink bar; Grouped X-Cycles rule 3's start goes from squares
    (assumed) to rings (proven false at the closing link) to removals, its
    bar following. A group is drawn from the walk frame of the first link
    that reaches it.
  - An almost locked set is a tight rounded tile in each of its cells,
    round that cell's own candidates (every candidate of an ALS cell
    belongs to it) and 6 units inside the cell, in one of three tints
    (sand, rose, violet) at half strength, outlined inwards in the set's
    ink (the Learn diagrams 1.65 times as thick), with a lettered tab (A to
    D, HoDoKu's lettering) on every tile; nothing joins its cells. A tab
    sits on a free candidate place of its cell, inside its tile first, then
    beside it, nearest first, keeping a phone's room from every mark, and
    off the arrows' lines where a place allows. A cell in two sets is the
    smaller set's tile (of two alike, the earlier's) with the other's
    outline dashed inside it and both tabs; a set left with no filled tile
    takes one of its cells from a set that keeps another, so every set
    shows its tint wherever there are cells enough. Sets that share a tint
    are told apart by their letters, and the letter, never the tint, names
    a set in the walk, the legend and the notation.
  - In a derived chain the set's node digits take their truth (rings, a
    disc, "one of these" squares), its other digits are members, bold on
    the tile, and a link inside the set draws nothing (G12). A multi-cell
    set is introduced by a walk frame of its own before the chain reaches
    it, drawing its tiles, tabs and members and no truth. An ALS pattern
    whose chain clashes (sets that share cells, a truth claiming more than
    the step proves) draws no truth, no role and no start dot in any view:
    tiles, tabs, members, arrows and removals, the walk in words. Only
    Death Blossom, which draws no truth until phase 5, draws roles in a
    set: the stem's candidates and each petal's digit the stem sees
    acts-through gold, every petal's z pattern blue, the stem no tile, a
    headless dashed weak tie from each stem digit into its petal.
  - Arrows attach at a member (G10).
- **G17. Digit focus (optional, Settings).** During a hint about one
  digit (fish, single-digit patterns, X-Chains, colouring), the other
  digits' candidates are dimmed. Off by default; a toggle in Settings and
  in the hint panel.

### Families

- **G18. Chains** (X-Chain, XY-Chain, AIC, grouped and ALS AICs, Nice
  Loops, X-Cycles, Skyscraper, 2-String Kite, Turbot Fish, W-Wing):
  truth discs and rings (G2), solid and dashed arrows (G8), no in-cell
  arrows (G12). A discontinuous loop proves its start the opposite of its
  premise, so its nodes' truths hold only under a premise it refutes: the
  walk draws them frame by frame, the start as its premise, up to the link
  that closes the loop, whose frame shows the start's proven value, says
  the premise is impossible ("So assuming r6c1 is not 6 makes it 6: that
  is impossible, so r6c1 is 6.") and adds that line to the legend; the
  full view and the conclusion frame draw its proof as main did, the
  start's placement or removal beside the other nodes in the pattern's
  colour, as a forcing chain's full view does (G21). An open chain whose
  truths put two true candidates in one cell, or one digit twice in a
  house, also proves its premise impossible; its legend says so (the
  stronger conclusion this proves is the finder's to take, not the
  drawing's). A group node is worded as one: "one of r5c7, r6c7 must be
  2", never all of them.
- **G19. Colouring** (Simple Colors, Multi Colors, 3D Medusa, Remote
  Pair): **hue per cluster, shade per parity**, designed in full in
  [hint-drawing-colouring.md](hint-drawing-colouring.md). In short: each
  coloured candidate is a filled disc in dark or light purple (the first
  cluster) or, for Multi Colors' second cluster, dark or light orange,
  dark being the colour the argument tries first. The full view is
  HoDoKu's colouring plus the reason: the shades, the removals and the 1-3
  dashed weak ties (G13) the argument rests on; no ties, no arrows, no
  start dots, no walk numbers. The walk draws one frame per cluster with
  its ties, then one per weak tie of the argument (a witness, a clash, a
  bridge), each kept from its frame on; where the step proves a colour
  false (Simple Colors' wrap, Multi Colors where a colour sees both
  colours of the other cluster, 3D Medusa rules 1, 2 and 6), a proof
  frame draws that colour as false rings and its partner as true discs,
  and the conclusion and the full view draw it as the removals it is,
  beside the true discs (nothing is placed: the step only removes, and
  each is then a single). A step that proves no colour draws nothing true
  or false. Remote Pair is one purple cluster over its two digits, each
  cell a dark and a light candidate, its ties on the lower digit. A
  candidate the step puts in no colour is drawn in none: a removal as a
  removal from the frame that reaches it, 3D Medusa's cell a colour would
  empty as a plain ring in the arrow's ink round its digit, which the
  legend names ("a cell dark purple would empty"). Hypotheses are never
  drawn: the words say "if dark purple is true, the 4 in r6c4 is true",
  never "placed". Since phase 3.
- **G20. Patterns** (singles, intersections, subsets, fish, wings,
  uniqueness, Sue de Coq, Fireworks, Exocet, APE, Pattern Overlay,
  Tridagon, Extended Rectangle, Chute Remote Pair, BUG+1): role colours
  (G4), bands (G15), set tiles where a set is the point (G16), no arrows
  unless the technique's own logic is a chain.
- **G21. Forcing chains** (Nishio, Digit, Cell, Unit; Check's "why not"):
  one branch at a time. The full view shows the premise or premises and
  the conclusion only; each branch is a walk frame with its own truth
  colouring. A node reached by two branches is never coloured "by
  chance": it shows in the frame of each branch that reaches it. The
  Forcing Net stays undrawn.

### One object, four views

- **G22. Drawing, legend, notation and walk come from one step.** The
  board, the legend under it, the notation line and the walk frames are
  all generated from the step's links and roles, and tests hold them
  equal: every node in the notation is drawn, every role drawn is in the
  legend, every link is introduced by exactly one walk frame (a chain's
  link then stays drawn; a colouring's weak tie stays drawn from that
  frame on, and its ties are drawn in their cluster's frame only).
- **G23. The legend speaks in shapes.** It shows a swatch for each mark
  the hint uses, drawn like the mark: true disc, false ring, removed
  (a barred ring), placed (a disc with an outer ring), each role (a disc;
  the rounded outline where the role is drawn only on solved digits; a
  small band, dashed for a cover, where it is drawn only as a house band),
  solid and dashed arrow, tie, start marker; a colouring's pair of shades
  per cluster, its dashed weak tie and its corner brackets. It names only
  what the board draws: a role every candidate of which became a removal
  or a placement
  lends its words to that entry ("remove: the cell that would complete
  the rectangle"). During a walk it names what the frame shows. The marks
  and the legend both come from one call in `src/content/hintMarks.ts`
  (`frameMarks`), so they cannot disagree. Prose and notation can carry the
  same swatches inline ("if r5c1 is ◯ false, then r5c7 is ● true").
- **G24. Notation.** Every chain hint shows its line in Eureka notation,
  the form the HoDoKu and Enjoy Sudoku community reads:
  `(2)r5c1=r5c7-r7c7=r8c9 => r8c1<>2`, with groups as `r5c78`, ALS in
  braces, loops closing on their start. It can be copied. Today's form
  (`2@r1c5 → 2@r7c5`) goes.
- **G25. One renderer.** The app board (`src/ui/Grid.tsx`), the Learn
  diagrams (`src/content/boardSvg.ts`) and the intuition diagrams
  (`src/content/intuitionDiagrams.ts`) draw from one shared module that
  turns a step into a display list (marks, bands, tiles and bars, arrows) with
  geometry; each renderer only paints it in its own theme. Before this
  work they were three separate implementations that differed in 25 ways;
  since phase 1 the app board and the Learn diagrams share the marks
  (`src/content/hintMarks.ts`), the geometry
  (`src/content/hintGeometry.ts`) and the palette
  (`src/content/hintPalette.ts`). The intuition diagrams join in phase 7.

## Truth: where it comes from

A node's truth is never guessed by the renderer, and never inferred from
the technique's name (the chain trainer reuses X_CHAIN, AIC, X_CYCLES and
NICE_LOOP for chains whose links carry their real kind, not the kind
used). A step says how its truth is read, in a new field
`truth?: 'derived' | 'parity' | 'branches'`; absent means none (patterns).

- **derived** (AIC-form chains). A strong link leaves a false node and
  enters a true one; a weak link leaves a true node and enters a false one.
  So node 0 is `!links[0].strong` and every target is `link.strong`. That
  derives the inverted GROUPED_X_CYCLES rule 3 (weak first: assumed true,
  proven false) with no new field. The derivation checks itself: a link
  that leaves a node with the wrong truth is a bug, and a node given two
  truths is a bug except the closing node of a discontinuous loop (G18).
  Undirected ties carry no truth.
- **branches** (forcing chains and Check's why-not). `strong` there means
  "placed in this branch" (`forcingTrail.ts:218-234`), an on-to-on or
  off-to-on implication, so truth is per branch: each branch carries its
  premise (the candidate, true or false, and whether its line opens at a
  single the position already had, whose first node is then a fact and
  not the premise), and its targets take `strong` as their truth. The same
  candidate can be true in one branch and false in another (the stored
  Digit Forcing example assumes 8 in r1c1 both ways), so one map cannot
  hold it.
- **parity** (colouring and Remote Pair): each cluster's dark and light
  candidates, and the cluster whose dark colour is proven false where one
  is (Simple Colors' wrap, Multi Colors where a colour sees both colours
  of the other cluster, HoDoKu's Multi Colors 2, Medusa rules 1, 2 and
  6); `src/engine/truth.ts` `checkParity` holds it to its rules.

What each finder must add (checked by replaying the rule on the 21 stored
examples with links):

| Technique | Today | Needed |
| --- | --- | --- |
| X-Chain, XY-Chain, AIC, AIC_GROUPED, AIC_ALS, Skyscraper, Kite, Turbot, W-Wing, all Nice Loops and X-Cycles | alternating links | `truth: 'derived'`; nothing else |
| Digit, Cell, Unit, Nishio forcing; Check's why-not | branches; on/off only in the first sentence's text | `truth: 'branches'` and a premise per branch |
| SIMPLE_COLORS, MULTI_COLORS, MEDUSA_3D, REMOTE_PAIR | ties + witnesses (Remote Pair often no links) | `truth: 'parity'`, cluster and parity per candidate, the proven-false parity |
| ALS_XZ, ALS_XY_WING, ALS_XY_CHAIN | weak links between restricted-common groups only | the end sets' z digit nodes and each set's internal strong links (digit node to digit node, as AIC_ALS emits), an ALS index per node; then `derived` |
| DEATH_BLOSSOM | a fan of weak links, stem to petal | per stem digit a branch that also runs inside the petal to its z group |
| the chain trainer | links with their real kind | the kind used on each link (it computes it already), so a pair used weakly is drawn dashed |

## Phases

Each phase is one or a few commits, each green on its own (tsc, unit
tests, browser tests), reviewed by refuting reviewers, and merged to main
when clean. The order puts the biggest visible gain first and the riskiest
data changes later.

1. **The board foundation** (no data change; every hint benefits):
   - the shared geometry module (G25 first part): anchors (a group at its
     nearest member), gaps, straight-or-arc decision with clearance check
     (G9, G10), arrowheads, in-cell links skipped (G12), side-by-side
     pairs, start markers on node 0 (G14); pure functions with unit tests;
   - z-order: arrows over grid lines with a halo (G11);
   - no hint cell tints (G1); the measured palette, opaque marks with
     near-black digits and a keyline (G6); removals as barred rings and
     placements as ringed discs (G3); bands with solid and dashed outlines
     (G15); a hint draws its digits even where the player has none (G2);
     thicker lines on phones (G14a);
   - the arrow colour token, separate from acts-through (G7), in all four
     themes and the Learn pages;
   - Grid.tsx and boardSvg.ts both use it; the browser test that drew an
     arrow inside a bivalue cell now expects none.
   Accept: every stored example renders; the gallery (below) shows no
   arrow under a grid line, no loop inside a cell, no arrow crossing one
   of its own hint's marks.
2. **Truth** (G2, G5, G8, G18): the `truth` field, the derivation with
   its self-check, true discs and false rings for `derived` steps, the
   trainer's used kinds. Accept: a test derives truth for every stored
   example and every chain step of a solve batch with no conflict except
   discontinuous closures (and builds such loops on purpose, since no
   stored example has one), and checks that every elimination of an AIC
   conflicts with both end nodes (the start is false and the end true
   under the derivation, by design); the legend's words follow (G8: solid
   means "therefore true", which is the strong link only in AIC form).
3. **Colouring** (G19, [hint-drawing-colouring.md](hint-drawing-colouring.md)):
   `colouring` on the four colouring techniques, hue per cluster and shade
   per parity, ties only in their cluster's frame, the argument's weak
   ties from their walk frame on and in the full view, a proof frame
   where a colour is proven. Accept: coloringViz tests updated; the
   prose's colour words match the drawn hues.
4. **Sets** (G16, [hint-drawing-sets.md](hint-drawing-sets.md)): group
   bars and "one of these" squares, ALS tiles, tints and letters, the
   finders' sets and the ALS patterns' internal links, Death Blossom's
   branch links. Accept: derivation covers the ALS family; eurekaOf
   renders ALS in braces.
5. **Forcing** (G21): per-branch walk, summary full view, `fromTrue` from
   the forcing finders. Accept: forcingTrail tests hold; no node coloured
   by two branches at once.
6. **Words** (G22, G23, G24): Eureka for every chain, the legend with
   shape swatches, inline chips, the tests that hold drawing, legend,
   notation and walk equal; the hint-text standard pass over the
   catalogue's terse descriptions.
7. **Polish**: digit focus (G17), the intuition diagrams on the shared
   module, highlighting.md rewritten to this standard, Learn pages
   regenerated.

## Checking it

- **Unit tests** for the geometry (pure functions), the truth derivation
  (every family), the precedence, and G22's equalities.
- **The gallery**: a script renders every stored example (65 techniques)
  through the shared module in light and dark into one HTML page, and
  Playwright screenshots it; reviewers (and the owner) read the PNGs.
  Output stays in scratch, never deployed.
- **Refuting reviewers** per phase: a sudoku expert lens (is every drawn
  truth and arrow what the technique proves?), an accessibility lens
  (colour vision, contrast in all themes, phones), and a code lens.
- Existing guards stay: `tests/examples.test.ts` (refresh examples with
  `npx vite-node scripts/hunt-examples.ts refresh` when a Step field
  changes), `tests/coloringViz.test.ts`, `tests/forcingTrail.test.ts`,
  `tests/chainTrainer.test.ts`, `tests/eureka.test.ts`, the soundness
  harnesses, and the browser tests that count arrows.

## Colours and sizes

Measured (WCAG contrast; CIEDE2000 under Machado 2009 protan, deutan and
tritan, with Viénot and Brettel as cross-checks). LIGHT applies to the
light and rose themes and the Learn diagrams; DARK to dark and forest. A
cell is 100 units (the Learn diagrams scale everything by 0.6).

**Principles.** Shape carries truth, hue carries meaning: a filled disc
is true or a role, a ring is false, a barred ring is removed, a disc with
an outer ring is placed, a pale rounded square is one of several of which
exactly one is true (a TRUE group's members, or a set's digit in one of
its cells; since phase 4). Digits on
fills are near-black (#10131c, weight 700) in every theme, at 5.5:1 or
more; marks are opaque (today's discs are 0.85 opacity with white digits,
2.4 to 3.4:1, which is a measured reason HoDoKu reads better: its black on
pastel is 8 to 11:1). Lightness separates what colour blindness merges:
true green is the lightest truth colour on light boards and the darkest on
dark ones. Arrows are the only achromatic mark.

| Token | LIGHT | DARK | Shape |
| --- | --- | --- | --- |
| true (`--hint-place` / `--hint-place-ink`, shared with placed) | #57c274 / #006c2f | #35a458 | disc r 13; light themes add a 2-unit edge in the ink; a placement adds the outer ring |
| `--hint-false` | #175bb7 | #7fbbff (HoDoKu's own off-blue) | ring r 11.5, stroke 3, inside tinted 0.10 / 0.16 |
| `--hint-removed` | #bc072a | #fe9696 | the false ring in red plus a 45° bar (upper left to lower right, rim to rim, stroke 2.25, over the digit: the ISO "no" bar) |
| placed | true fill + ring in true ink | same | disc plus a concentric ring r 16.5, stroke 2.5 (on a small board and in Learn r 17.5, stroke 4.5) |
| `--hint-pattern` (fill / ink) | #498de5 / #175bb7 | #498de5 | disc |
| `--hint-secondary` (acts-through) | #f8b93f / #805500 | #f8b93f | disc |
| `--hint-fin` (exception) | #dec4fe / #7646a5 | #dec4fe | disc |
| `--hint-purple` (dark purple; fill / light edge) | #c361f1 / #c361f1 | #c361f1, edge = fill | disc r 13, digit #10131c at 5.57:1; a colouring's first cluster (G19) |
| `--hint-purple-light` (light purple) | #ccb9e7 / #c361f1 | #ccb9e7, edge = fill | disc r 13, digit at 10.30:1 |
| `--hint-orange` (dark orange) | #ed6907 / #ed6907 | #ed6907, edge = fill | disc r 13, digit at 5.85:1; Multi Colors' second cluster only |
| `--hint-orange-light` (light orange) | #fcd2b1 / #ed6907 | #fcd2b1, edge = fill | disc r 13, digit at 13.24:1 |
| `--hint-one-of` ("one of these"; since phase 4) | #abe1ba (true at 0.5 over white), edge #006c2f | #296243, edge #35a458 | rounded square 26×26, rx 7, edge 2 inside, keyline 1.5 (2 on a small board), digit `--hint-in-ring` (10.74:1; 6.36:1) |
| `--hint-set-1..3` (fill / ink; since phase 4) | sand #faea37 / #6b6000, rose #bf5481 / #a3365f, violet #8c56ff / #6a40d0 | #474801 / #e6d27a, #b4537b / #f0a0c0, #4020d0 / #c896ce | a tile per cell round its candidates, 15 out, rx 10, fill at `--hint-set-alpha` 0.5, outline in the ink stroked inwards 2.5 (4.5 under 600 CSS px, 5 under 330; in Learn 1.65 times, 1.5 CSS px on a phone's diagram); a shared cell's other outline dashed "6 4", one outline width inside, no fill; a tab in the ink, 18×18 rx 4 (26 on a small board and in Learn), letter in `--cell-bg` |
| group bar (since phase 4) | the members' ink: true #006c2f, false #175bb7, pattern #175bb7, removal #bc072a | #35a458, #7fbbff, #498de5, #fe9696 | stroke 3 (4.5, 5.5), round caps, 15 off the members' line, under the marks, cut out by the digits |
| `--hint-arrow` (arrows, ties, start dot, walk badges) | #151a24 | #f2f4f9 | stroke 3; weak dash "8 6" with butt caps; head 14 long × 11 wide; tail and tip 3 units outside the marks' rims |
| halo | `--cell-bg`, arrow width + 2 (`SIZES.halo`), opacity 0.75, the head outlined 2 wide | same | drawn after the grid lines, with the arrow; on a small board 6.5 round a 4.5 shaft |
| band | role fill at alpha 0.07 | 0.10 | outline inset 3.5, stroke 3, rx 8, role ink at full opacity |
| `--hint-on-fill` / `--hint-in-ring` (digits) | #10131c / #1b2233 | #10131c / #eef1f8 | weight 700 |

Shades: the light themes rim both shades of a cluster in its dark shade,
1 unit drawn inwards, on every board and in Learn, so a light shade keeps
its own fill over 85% of the disc; the dark themes draw no edge. On a
phone or in a diagram a disc is about ten CSS pixels across and the eye
mixes its rim into its fill, so a rim in the dark shade pulls the light
one towards it: mixed by area (the digit left out), as the app draws them
at both sizes, as Learn draws them and as the legends' swatches draw them
(a rim about a thirteenth of the radius), a cluster's two shades stay 15
or more apart in worst-model CIEDE2000, purple 15.2 and orange 20.6 in
the light themes, the fills' own 17.6 and 22.7 in the dark ones
(tests/shadeRender.test.ts; a 4-unit rim had brought purple to 9). The
keyline, not the rim, parts a shade from the player's own cell colours (a
light shade is 2.6 and 4.0 from the player's purple and orange cells on
white): 2 units for a shade on a small board, as wide as two marks side
by side in a cell allow. Weak tie: the weak arrow's dash and halo, no
head. Corner brackets: inset 5.5, arms 10 (7 at the bottom corners), the
arrow's stroke (4 on a small board). Tie: arrow ink, width 2, opacity 0.5, halo 5 at 0.5 (on a small board 3 and 6). Start dot: r 4.5 in
arrow ink with a 2-unit board-coloured stroke (6.3 on a small board and
in Learn). Walk badge: r 10, arrow ink, numeral 13 in `--cell-bg` (1.6
times on a small board). Digits are cut out of the arrows with a
0.12em stroke, at least 4 units.

**The blue clash, resolved.** HoDoKu's blue is "false", ours is "the
pattern". From now on blue is the pattern only as a filled disc and false
only as a ring; green is always true or placed; red is always removed. In
a chain step every node takes its truth mark, and pattern-blue discs are
not used beside truth marks (in the dark theme pattern and true are only
ΔE 4.1 apart under tritan vision, and both are discs). Gold discs are not
put beside true discs either (light protan ΔE 8.3), nor orange shades
(ΔE 10.7): in Multi Colors orange is removals and true discs once a
colour is proven, and a test holds it. Purple and orange discs are a
colouring's alone; the exception's light purple (`--hint-fin`) is never
drawn beside them. Phase 4's violet set tint is an area under an outline
and a letter, never a disc, and sets and colourings never share a step (a
test holds it). One exception stands until its phase: the chain trainer's
gold suggestions sit beside its true discs until phase 6 gives them a mark
and a legend entry of their own. Phase 4 retired the other: a true
group's members, the pattern's disc until then, are pale "one of these"
squares on a bar, never the pattern's disc and never the true disc, and
Death Blossom, whose gold and pattern-blue discs sit on its petals' tiles,
draws no truth beside them ([hint-drawing-sets.md](hint-drawing-sets.md)).

**Where shape carries it.** True vs false: disc vs ring. Removed: the
bar. Placed vs true: the outer ring (same colour by design). "One of
these" vs true: square vs disc (11.6 apart in the light themes), with the
bar or the tile. Which set: the letter, never the tint. Strong vs weak:
solid vs dashed. Every other pair is told
apart by colour alone under all three simulations in the light themes;
in the dark ones true/false (ΔE 11.9 tritan), secondary/removed (5.9),
fin/false (5.3), dark orange/removed (11.8) and light orange/removed (8.5)
lean on shape. The shades' own numbers (within purple 17.6, within orange
22.7, across the clusters 14.6 and up) are in
[hint-drawing-colouring.md](hint-drawing-colouring.md), Colours.

While a hint draws, the player's peer and same-digit tints step aside
(the amber same-digit tint reads like a gold band), as the bivalue rings
already do; the player's own cell colours stay under the marks.

The study's scripts (WCAG, CIEDE2000, the three simulations, a rendered
specimen of every mark in every theme) are kept outside the repository;
the values above are its final ones.

## Status

- [x] Phase 1: the board foundation. Built and green (tsc, unit and
  browser tests): `src/content/hintGeometry.ts`, `src/content/hintPalette.ts`
  and `src/content/hintMarks.ts` with their tests, both renderers on
  them, the CSS tokens, `scripts/hint-gallery.ts` for looking at all 65
  examples. Review round 1's findings are fixed (geometry in ee03238; the
  shared marks, the layer order, value outlines, frame-numbered walk
  badges, legend swatches drawn like the marks, phone line widths, the
  trainer's goal and the hint cleared when auto candidates switch in
  8ebba30). Round 2's are fixed too: the digits cut out of the arrows,
  arcs measured to their segments and turning nearer the ends, start
  dots inside their cell and off its digits, walk numbers kept apart and
  enlarged on phones, the placement ring on small boards, Nishio's
  assumption keeping its colour, band swatches, the trainer's legend
  (solid into a candidate it makes true, dashed into one it makes false),
  the trainer's chain kept when auto candidates switch off, a fallback
  for browsers without container queries (ab0bee9). Round 3's are fixed:
  heads never cut and steered off the target cell's digits (over the
  chain steps of 38 puzzles, heads on a digit fell from 1,116 of 9,487 to
  7, at the cost of 942 more arcs), the arrows worked out once per hint so
  the walk never moves them, walk numbers off digits and heads, the
  legend per walk frame, one role order in the walk and the full view,
  the fallback's under-330 step, and tests that fail when each fix is
  undone (1a9d6a4). Round 4's are fixed: an arrow no longer runs along
  another (over 39 puzzles, runs of more than half a cell fell from 181
  to 56, nearly all of them forcing chains whose branches repeat a link,
  phase 5), walk numbers at a phone's size and off the empty places (on
  an empty place: from about 13% to 0.3%), never nearer another arrow
  beside their shaft, the player's own centre and edge marks known to the
  geometry, Digit Forcing's placed assumption keeping its colour, the
  fallback for a phone on its side, and tests that check every head and
  the heads painted back into the mask (f5793cb). Round 5's are fixed:
  an arrow boxed in at both ends takes a bend off each end, so it never
  seems to leave or reach the wrong candidate (over the chain steps of 66
  puzzles, 12,215 arrows, 58 needed it; 5 still come more than a unit
  inside another mark's rim, by 3.5 at most, each an ALS arrow passing
  another candidate of its own set in a cell of the link, which phase 4's
  set hulls redraw); start dots keep off the ties and nearer their own
  node than any other mark; a short weak arrow keeps a dash in sight
  beside its walk number; the start dots reuse the arrows already worked
  out; no mask when no line is drawn; the trainer's drawing follows its
  own rule when auto candidates switch; the halo sizes here match the
  code. Left for phase 7, low: walk numbers on an empty place in about
  0.3% of arrows, and on a digit at a phone's size in about 1%, where no
  spot on or beside a short shaft is clear (b7e0e59). Round 6's are
  fixed: a short weak arrow's number never lands on the parallel arrow
  beside it (its own crowded shaft comes before another arrow); a
  colouring colours only what the step puts in a colour (G19), so 3D
  Medusa's empty-cell rule no longer paints the target cell's candidates
  blue in a step that proves blue false; the two-bend curve only where
  marks box an arrow in; the Learn removal bar at 1.5 CSS px on a phone.
  Also left for later, low: an arrow's tail is not steered off its start
  cell's other digits (phase 7), and the chain trainer's legend does not
  name its gold suggestions and purple goal (phase 6) (43b6219). Round
  7's are fixed: a colouring's witness keeps its own start dot where the
  last tie of the cluster ends on its start (the dot had gone to a
  cluster candidate, a regression against main); the plain node ring
  thickens on a small board. Also left for later, low: where an arc
  keeps clear of the marks but lands its head on a digit, the two-bend
  curve is not tried (the digit is drawn over the head, G11; phase 7);
  Remote Pair's "chain of 35 pairs" runs its two digits together, as on
  main (phase 6's words) (b229d6e). Round 8 confirmed nothing of high or
  medium severity and nothing false, which is the owner's rule for
  merging: phase 1 merged then, with a render test for the app board's
  digit cut-out and a store test for the trainer's chain starting over.

  Left for phase 7, all low (round 8 and before): in a start cell boxed in
  on every side the start dot can sit nearer the switch partner than node
  0 (2 dots in 14,374 chain steps); in a loop boxed in at both ends a head
  can overlap a removal ring (3 of 67,815 arrows); the removal bar merges
  with the removed digit on a phone (a halo round the bar, or a larger
  digit); the cut-out leaves dash specks between close digits (end each
  dashed shaft on a full dash); an arrow's tail is not steered off its
  start cell's other digits; the two-bend curve is not tried where only a
  head would land on a digit; walk numbers on an empty place in about
  0.3% of arrows. For phase 6: the chain trainer's legend does not name
  its suggestions and goal; Remote Pair's "chain of 35 pairs"; a sentence
  when the trainer's chain starts over. To photograph the app's own board with
  an example's hint, a scratch Playwright run on port 4174 opens each
  example's position link (kept in the git-ignored `.vite/`).
- [x] Phase 2: truth. 2a (commit 16556da): `truth: 'derived'` on every
  AIC-form finder, `src/engine/truth.ts` with its self-check, the examples
  refreshed, tests/truth.test.ts; the chain trainer draws each link as the
  kind it is used as and says `truth: 'derived'`. 2b: a derived chain
  draws each node as the chain makes it (`src/content/hintMarks.ts`), a
  true node a filled disc in the true colour and a false one a ring in the
  false colour, faintly tinted, before the roles; a true group's
  candidates are their own mark, `oneTrue`, drawn as the pattern's disc
  until phase 4; a removed or placed node is its removal or placement. The
  legend names them by the first node's premise ("true, if the first
  candidate (by the small dot) is false"; a group start "... if no
  candidate of the first group (by the small dot) is true"; an inverted
  loop's "... is true"; a true group "one candidate of each group is true,
  if ..."), in the app, the chain trainer and the Learn diagrams, in all
  three languages. A discontinuous loop draws its truths in the walk up to
  the link that closes it, which says the premise is impossible, and its
  proof as main did in the full view and the conclusion (G18); any frame
  that shows its premise impossible (also an open chain whose truths
  clash) says so in the legend. The walk words a group as one ("one of
  r5c7, r6c7 must be 2") and an ALS's link as the set's. Arrows were already
  dashed exactly into false nodes (G8). Every link of every derived step
  in the batch and the examples is checked against the board's houses
  (tests/truth.test.ts). Three review rounds: round 1 found a high (an
  inverted grouped loop drew its whole start group true in the walk, fixed
  in e7c17ea) and a medium (a W-Wing could join a weak link between cells
  that do not see each other, fixed in cf3e83f); round 2 four mediums (a
  group's walk sentence said all its cells "must be" the digit; a true
  group took the whole loop's label; a placing loop's full view drew its
  start placed beside its partner true; fixed in 528a2af-a819369) and
  lows; round 3, on a819369, found one high in round 2's own fix (a
  halo under the removal bar painted out the middle of the removed digit,
  an 8 read as a 3), reverted to main's bar in 8b4f50f, and lows (tests
  for the app board's truth marks and both legends; the trainer's legend
  names a removal only in the frame that draws it; the ALS sentence only
  on a strong link), fixed; its logic lens checked 28,613 derived steps,
  15,702 trainer chains and 201,813 grouped and ALS chains against each
  puzzle's solution, and its regression lens 113,114 steps against main,
  with nothing else found. Merged then.

  Left for later, low: the ALS-XZ label's "one digit short of locked"
  (phase 6's words, main's wording); an open chain whose truths clash
  proves a stronger conclusion than its finder reports (the legend says
  the premise is impossible; taking the placement is the finder's, not
  the drawing's); the chain trainer's legend does not name its gold
  suggestions and purple goal (phase 6); with false rings beside
  removals, the bar is what tells removed from false without colour, and
  on a phone it merges with the digit (phase 7's item; a halo under the
  bar was tried in round 2 and round 3 found it erased the digit, an 8
  read as a 3, so it went: keep the digit whole, e.g. outline the digit
  in the board's colour over a bar drawn under it, or stop the bar short
  of the digit's box).
- [x] Phase 3: colouring. Merged and live after three review rounds
  (round 1 on 1db1969, round 2 on 95d53a3, a targeted round 3 on
  e9df0f6), as [hint-drawing-colouring.md](hint-drawing-colouring.md)
  designs it: the design (e47f3ab); a fixture of every drawing that is
  not a colouring, made before any change, which every later commit
  passes unchanged (`tests/drawingSnapshot.test.ts`, 1debe13); the
  palette, dark and light purple and orange (7a68a55); the drawing
  machinery for `truth: 'parity'` (`checkParity`, `Frame.drawn` and
  `drawnLinks`, the shades, weak ties and corner brackets on both boards
  and in both legends, f1b9d5e); the four finders saying their parity in
  the shades' words in three languages, the shortest drawn tree of ties,
  HoDoKu's colouring notation and the swapped Multi Colors example, with
  every removal they make on the practice paths unchanged (b6c2dce); then
  the browser walk test, the older-colouring code retired, a colouring's
  removals named in reading order, and this spec (1db1969).

  Round 1 (three medium) made the light shade keep light on a phone with
  a thin rim (46fa4e6), bent a tie round another mark of its frame
  instead of through it (72cead8), and gave every colouring "Build it
  yourself" (0dd1756), with its lows: weak ties off box lines and off
  candidates of their digit, brackets clear of a phone's marks, walk
  numbers a gap apart, clearer words. Round 2 (one regression in words,
  one fork) named every removal of a colouring in the full view
  (b11851b), bent a tie apart from another that shares its end and off
  every candidate of its digit, and made the tie search about six times
  faster (e9df0f6), with its lows: the colours' nouns neuter in nb, rule
  3's bracket legend, the trainer's goal note without a colour, a weak
  tie's ends nearer their own candidate and walk numbers off the marks
  (84c6b60). Round 3 found nothing high, medium, false or regressed.

  Round 3's eight lows were fixed in a follow-up after the merge: rule
  4 says its other removals "fall the same way" only where they do, the
  developer docs speak of shades, the review gallery shows what Learn
  shows (408f188); of ties that weigh the same the tree takes the one it
  draws best, so the stored Remote Pair draws without a crossing
  (94d00cf); ties keep off the board's edge and run beside no other tie,
  two weak ties into one candidate no longer cross before it, and a
  boxed-in weak tie comes in from a free side (2404ed1).

  The Multi Colors search order (decision 13) is done, in its own change
  after the merge: a colour seeing both colours of another cluster, on
  any digit, comes before any bridge, so the 191 bridges that hid one on
  the practice paths (26% of the bridges given there) are each a sees-both
  now. No stored solve path, rating, practice puzzle or example changed;
  9 of 480 served isomorphs of the saved Multi Colors puzzles take the
  sees-both on their path, 10 points lower and at the same level.
  Simple Colors' order followed in the same way, in its own change: a
  wrap, on any digit, comes before any trap, so the 455 traps that hid one
  on the practice paths (5% of the traps given there) are each a wrap now.
  No stored solve path, rating, practice puzzle or example changed, nor
  any of 800 served isomorphs of the stored puzzles whose path takes
  Simple Colors.

  Left for later, low: off the solve paths, in corner or edge cells boxed
  in by marks, a few ties keep outside the marks but under a mark and a
  gap, meet at under 20 degrees, cross a tie they share an end with, or
  run beside another (the tests bound each); a walk number on a bracket's
  corner can touch another line at a phone's size where no corner is clear
  (G14's trade-off; phase 7); a big chain hint's layout on the main
  thread, which main already pays (phase 7).
- [ ] Phase 4: sets. Built, in review. Designed (27 October 2026) in
  [hint-drawing-sets.md](hint-drawing-sets.md), from five maps, three
  designs and two judges, and built in its nine stages, each commit green
  on its own (tsc, the unit tests, the build, and the browser tests in
  both font setups at every stage that changed the board): the design
  (c7086a8) and its amendment, which keeps HoDoKu's ALS-XY-Chain
  (baec444); the palette (65263ee); the guards, a split drawing fixture
  with frozen positions and a path digest (e8ae343); sets in the data,
  `Step.sets`, the links' set ends and `checkSets` (91f11d0); the trainer
  refusing sets (fdbdfc9); the notation from the sets (8c7cfbf); groups on
  the board, "one of these" squares on a bar (59459db); ALS tiles and
  lettered tabs (e88d986); the set walk and its words (2413875); the ALS
  patterns as the chains they derive, and Death Blossom's pattern view
  with its branch links (852ae01); then the screenshots, this spec and
  "an 8" for English (the stage 9 commit). A group is its members' marks
  on a bar in the gutter beside them, a TRUE group's members pale "one of
  these" squares (retiring `oneTrue`'s pattern disc); an almost locked set
  a tight tile per cell with a lettered tab on every tile, in three tints;
  ALS-XZ, ALS-XY-Wing and ALS-XY-Chain derived chains like AIC with ALS;
  Death Blossom the pattern, with its branch links emitted for phase 5; a
  walk that introduces each set before the chain uses it; Eureka with
  braces round the whole set, and HoDoKu's lines rebuilt from the sets.
  ALS-XY-Chain keeps HoDoKu's rule, neighbouring sets apart and sets
  further apart free to share cells: the overlap ban first planned before
  this phase was measured and dropped, as it would rate stricter than
  HoDoKu and moved solve paths and ratings, so a chain whose sets share
  cells is drawn as it derives, with no truth where its derivation clashes.
  No conclusion, solve path or rating moved: the path digest and
  tests/fixtures/drawingSnapshot.json are as stage 1 left them, and
  tests/fixtures/setDrawings.json was written again only in the commits
  that name its techniques. What the build refined where the design was
  silent is in the design's As built. The screenshots for the review
  rounds (every set example and the set fixture's named positions, in
  all four themes, desktop and phone, walk frames and panel, with and
  without the player's own cell colours, `PLAYER=1` in
  scripts/hint-shots.cjs) and the Learn gallery are kept outside the
  repository. Next: the review rounds, then the merge when nothing is
  high, medium, false or regressed. The relabelling of AIC with ALS steps
  whose only set is a bivalue cell is left to a later measured engine
  change.

  Left for later, low: of the grouped steps on offer at the positions of
  the maps' 577 cached grouped chains, two arrows meet a bar where no
  drawing clears it, neither on a solve path (the design's As built names
  them); an ALS-XY-Chain of more sets than cells
  leaves one set no filled tile (four sets on three cells on a hard path),
  its tabs and dashed outlines carrying it; App.tsx's "a {tech} places it"
  and the share line's "a {level} sudoku" can read "a X-Wing" and "a
  Extreme sudoku" in English (a name, not a digit: phase 6's words).
- [ ] Phase 5: forcing
- [ ] Phase 6: words
- [ ] Phase 7: polish

Branch `claude/hint-drawings`. Research behind this spec (HoDoKu's source
read at SVN r147, our renderer's map, the other solvers) was summarised
here; the HoDoKu line references are to
`svn.code.sf.net/p/hodoku/code/HoDoKu/trunk/src/sudoku/`.
