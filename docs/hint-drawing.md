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
  bands (G15) and set hulls (G16) are the only areas a hint shades.
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
  truth > a role. A candidate a step lists in more than one role takes the
  first of pattern, acts-through, exception, in the full view and in every
  walk frame alike. A candidate that is removed
  keeps no ring of a colour it never had (today four techniques draw a
  removal ringed blue that was never blue: Simple Colors' trap target,
  Multi Colors rule 1 and 2, Medusa rules 3-5, Digit Forcing's removal;
  Aligned Pair Exclusion, Exocet and Pattern Overlay ring their removals
  blue because the removals sit in the pattern list). A removed or placed
  node of a chain whose truth is drawn (phase 2b) is the removal or the
  placement alone: the mark says its truth (removed is false, placed is
  true), so no truth ring or disc is drawn with it; the walk's frames
  before the conclusion show it as a truth mark (a true group's
  candidates as the pattern's disc, until phase 4). Any other removed chain
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
  node, a removal, a member of a set hull), the arrow becomes one gentle
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
  group node is anchored at the member nearest the other end of the link
  (a centroid can fall in a cell that is not one of its members); HoDoKu
  anchors at a member too.
- **G11. Over the lines and marks, under the digits.** The layers, from
  the bottom: the player's own layers, bands, marks, solved-digit
  outlines, grid lines, arrows and ties (every halo before any line),
  digits, removal bars, start markers and walk numbers. An arrow crosses
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
  cell by. (Colouring's in-cell ties in 3D Medusa wait for phase 3.)
- **G13. Ties stay quiet.** An undirected tie (a conjugate pair or a
  bivalue cell in colouring) is a thin straight line in the arrow colour
  at reduced opacity, no head, drawn only where the hint needs it (G19).
- **G14. A start marker.** The first node of each branch carries a small
  start marker beside its mark (not at the tail of the first drawn arrow:
  after a switch inside the start cell, that tail is the second node),
  inside the node's cell, off the digits the cell shows and clear of the
  arrows and the other marks: upper left when that is clear, then round
  the clock, else wherever has most room (a cell line's real width
  counts, so a dot boxed in may touch a thin cell line, never a box line
  when it can help it). A cluster of undirected ties has no reading
  order and no marker, and a witness arrow that leaves a node a tie
  reached starts a branch of its own, with its dot beside that node. The walk numbers each arrow by the frame that adds
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
- **G16. Set hulls.** A group node and an almost locked set are drawn as a
  rounded hull around their candidates, not as discs that each claim a
  truth: a TRUE group means "one of these", and painting every member true
  teaches that all are placed. A group hull takes the truth style of its
  node (filled tint for true, outline for false); an ALS hull takes one of
  four ALS tints, in order of first appearance, with its restricted-common
  digits in the acts-through colour and its eliminating digit in the
  pattern colour. Arrows attach to the hull's edge.
- **G17. Digit focus (optional, Settings).** During a hint about one
  digit (fish, single-digit patterns, X-Chains, colouring), the other
  digits' candidates are dimmed. Off by default; a toggle in Settings and
  in the hint panel.

### Families

- **G18. Chains** (X-Chain, XY-Chain, AIC, grouped and ALS AICs, Nice
  Loops, X-Cycles, Skyscraper, 2-String Kite, Turbot Fish, W-Wing):
  truth discs and rings (G2), solid and dashed arrows (G8), no in-cell
  arrows (G12). A discontinuous loop's start node is proven the opposite of
  its premise: the full view shows the proven value and its conclusion;
  the walk's first frame shows the premise.
- **G19. Colouring** (Simple Colors, Multi Colors, 3D Medusa, Remote
  Pair): **hue per cluster, shade per parity** (HoDoKu's Multi Colors:
  dark and light orange for one cluster, dark and light purple for the
  next). No arrows in the full view. The witnesses (two same-coloured
  candidates that see each other, the candidate that sees both colours)
  are drawn as arrows only in the walk frame that names them. When a
  colour is proven false (a wrap), its candidates become false rings and
  the other colour true discs. Remote Pair is a colouring of two digits
  and is drawn as one: parity, not a single "start false" chain, because
  its eliminations use both parities. A candidate the step puts in no
  colour is drawn in none, in the full view and every walk frame: a
  removal as a removal from the frame that reaches it, anything else (3D
  Medusa's cell that would be left empty) as a plain ring in the arrow's
  ink round its digit, which the legend does not name. Since phase 1.
- **G20. Patterns** (singles, intersections, subsets, fish, wings,
  uniqueness, Sue de Coq, Fireworks, Exocet, APE, Pattern Overlay,
  Tridagon, Extended Rectangle, Chute Remote Pair, BUG+1): role colours
  (G4), bands (G15), hulls where a set is the point (G16), no arrows
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
  legend, every link is in exactly one walk frame.
- **G23. The legend speaks in shapes.** It shows a swatch for each mark
  the hint uses, drawn like the mark: true disc, false ring, removed
  (a barred ring), placed (a disc with an outer ring), each role (a disc;
  the rounded outline where the role is drawn only on solved digits; a
  small band, dashed for a cover, where it is drawn only as a house band),
  solid and dashed arrow, tie, start marker. It names only what the board
  draws: a role every candidate of which became a removal or a placement
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
  turns a step into a display list (marks, bands, hulls, arrows) with
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
- **parity** (colouring and Remote Pair): a cluster index and a parity
  per candidate, and the parity proven false where one is (Simple Colors'
  wrap, Multi Colors rule 1, Medusa rules 1, 2 and 6).

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
3. **Colouring** (G19): `clusters` on the four colouring techniques, hue
   per cluster and shade per parity, witnesses only in their walk frames.
   Accept: coloringViz tests updated; the prose's colour words match the
   drawn hues.
4. **Sets** (G16): group hulls, ALS hulls and tints, ALS finders emit
   their internal links and ALS index, Death Blossom branches. Accept:
   derivation covers the ALS family; eurekaOf renders ALS in braces.
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
an outer ring is placed, a rounded square is a member of a set. Digits on
fills are near-black (#10131c, weight 700) in every theme, at 5.5:1 or
more; marks are opaque (today's discs are 0.85 opacity with white digits,
2.4 to 3.4:1, which is a measured reason HoDoKu reads better: its black on
pastel is 8 to 11:1). Lightness separates what colour blindness merges:
true green is the lightest truth colour on light boards and the darkest on
dark ones. Arrows are the only achromatic mark.

| Token | LIGHT | DARK | Shape |
| --- | --- | --- | --- |
| `--hint-true` (fill / ink) | #57c274 / #006c2f | #35a458 | disc r 13; light themes add a 2-unit edge in the ink |
| `--hint-false` | #175bb7 | #7fbbff (HoDoKu's own off-blue) | ring r 11.5, stroke 3, inside tinted 0.10 / 0.16 |
| `--hint-removed` | #bc072a | #fe9696 | the false ring in red plus a 45° bar (upper left to lower right, rim to rim, stroke 2.25, over the digit: the ISO "no" bar) |
| placed | true fill + ring in true ink | same | disc plus a concentric ring r 16.5, stroke 2.5 (on a small board and in Learn r 17.5, stroke 4.5) |
| `--hint-pattern` (fill / ink) | #498de5 / #175bb7 | #498de5 | disc |
| `--hint-secondary` (acts-through) | #f8b93f / #805500 | #f8b93f | disc |
| `--hint-fin` (exception) | #dec4fe / #7646a5 | #dec4fe | disc |
| `--hint-als-1..5` (fill / light edge) | #ffd3b8/#9b5212, #dfe2fe/#5353ad, #a2b63c/#5b6704, #ec84b8/#9e366f, #a9926b/#745e39 | same fills, no edge | rounded square 24×24, rx 6 |
| `--hint-arrow` (arrows, ties, start dot, walk badges) | #151a24 | #f2f4f9 | stroke 3; weak dash "8 6" with butt caps; head 14 long × 11 wide; tail and tip 3 units outside the marks' rims |
| halo | `--cell-bg`, arrow width + 2 (`SIZES.halo`), opacity 0.75, the head outlined 2 wide | same | drawn after the grid lines, with the arrow; on a small board 6.5 round a 4.5 shaft |
| band | role fill at alpha 0.07 | 0.10 | outline inset 3.5, stroke 3, rx 8, role ink at full opacity |
| `--hint-on-fill` / `--hint-in-ring` (digits) | #10131c / #1b2233 | #10131c / #eef1f8 | weight 700 |

Tie: arrow ink, width 2, opacity 0.5, halo 5 at 0.5 (on a small board 3 and 6). Start dot: r 4.5 in
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
put beside true discs either (light protan ΔE 8.3). Two exceptions stand
until their phases: a true group's members keep the pattern's disc
(a true group is "one of these", so none of them is a true disc), named
in the legend as one candidate of each group true, until phase 4 draws
groups as hulls, and the chain trainer's gold suggestions
sit beside its true discs until phase 6 gives them a mark and a legend
entry of their own.

**Where shape carries it.** True vs false: disc vs ring. Removed: the
bar. Placed vs true: the outer ring (same colour by design). A set member:
the square. Strong vs weak: solid vs dashed. Every other pair is told
apart by colour alone under all three simulations in the light themes;
in the dark ones true/false (ΔE 11.9 tritan), secondary/removed (5.9) and
fin/false (5.3) lean on shape.

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
- [ ] Phase 2: truth. 2a done (commit 16556da): `truth: 'derived'` on
  every AIC-form finder, `src/engine/truth.ts` with its self-check, the
  examples refreshed, tests/truth.test.ts (518 chain steps of a solve batch,
  all clean); the chain trainer draws each link as the kind it is used as
  and says `truth: 'derived'`. 2b built, in review: a derived chain draws
  each node as the chain makes it (`src/content/hintMarks.ts`), a true
  node a filled disc in the true colour and a false one a ring in the false
  colour, faintly tinted, before the roles; a true group's members keep
  the pattern's disc until phase 4; a discontinuous loop's start shows its
  premise until the walk draws the link that closes the loop, its proven
  value after; a removed or placed node is its removal or placement. The
  legend names both, worded by the premise ("true, if the first candidate
  (by the dot) is false"; an inverted loop's "... is true"), in the app,
  the chain trainer and the Learn diagrams, in all three languages.
  Arrows were already dashed exactly into false nodes (G8).
  Review round 1 found one high defect (an inverted grouped loop drew its
  whole start group true in the walk), fixed; what is left before 2b can
  merge, and how the work is run, is in `docs/hint-drawing-handoff.md`.
- [ ] Phase 3: colouring
- [ ] Phase 4: sets
- [ ] Phase 5: forcing
- [ ] Phase 6: words
- [ ] Phase 7: polish

Branch `claude/hint-drawings`. Research behind this spec (HoDoKu's source
read at SVN r147, our renderer's map, the other solvers) was summarised
here; the HoDoKu line references are to
`svn.code.sf.net/p/hodoku/code/HoDoKu/trunk/src/sudoku/`.
