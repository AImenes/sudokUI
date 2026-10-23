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
  digit, and solved cells by colouring their digit (as now). It never
  tints a cell. The player's own layers (selection, peers, same digit,
  their colours, errors) stay under everything and are untouched. House
  bands (G15) and set hulls (G16) are the only areas a hint shades.
- **G2. Truth by colour and shape.** A chain node that is true under the
  hint's premise is a **filled disc** in the true colour; a node that is
  false is a **ring** in the false colour around an unfilled digit. The
  shape carries the meaning without colour vision, in print and in the
  legend; the colour helps everyone else. (HoDoKu: green filled, blue
  filled.)
- **G3. Removed and placed are their own marks.** A removal is a filled
  disc in the removal colour **with a diagonal stroke through it**; a
  placement is a filled disc in the placement colour **with a double ring**.
  Neither may be told from a true or a false node by colour alone.
- **G4. Pattern roles keep their grammar.** Candidates that are part of a
  pattern but carry no truth claim (fish bases, a subset, a rectangle's
  floor, a wing's pivot) are filled discs in the role colours: pattern,
  acts-through, exception (today blue, amber, purple). A pattern disc
  must never use the true colour: painting a fish base "true" teaches that
  it is placed.
- **G5. Precedence.** One mark per candidate: removed > placed > chain
  truth > exception > acts-through > pattern. A candidate that is removed
  keeps no ring of a colour it never had (today four techniques draw a
  removal ringed blue that was never blue: Simple Colors' trap target,
  Multi Colors rule 1 and 2, Medusa rules 3-5, Digit Forcing's removal;
  Aligned Pair Exclusion, Exocet and Pattern Overlay ring their removals
  blue because the removals sit in the pattern list). A removed node that
  WAS a chain node keeps its truth ring under the removal mark, because
  the walk names it.
- **G6. Digits on discs.** A digit on a filled disc is drawn in the
  colour that contrasts with that disc; a digit inside a ring keeps the
  board's candidate colour, in bold. Unmarked candidates stay as they are:
  nothing is dimmed by default (see G17 for digit focus).

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
  those marks; if neither side clears, the larger arc wins. Unrelated
  candidates and digits are crossed straight, readable through the halo
  (G11). Two arrows sharing a corridor are offset sideways a few units
  rather than bent. (HoDoKu always bends left by a fixed 20 px and never
  checks the curve; ours chooses.)
- **G11. On top, with a halo.** Arrows are drawn last, over discs,
  digits and grid lines, each with a halo in the board's background
  colour so a line stays legible where it crosses a digit or a box line.
  Round caps and joins.
- **G12. No arrow inside a cell.** A link between two candidates of one
  cell (a bivalue switch, an ALS digit change) draws no arrow: the false
  ring and the true disc side by side say it. The walk still gives it a
  frame and a sentence. The next arrow starts at the candidate the chain
  leaves the cell by.
- **G13. Ties stay quiet.** An undirected tie (a conjugate pair or a
  bivalue cell in colouring) is a thin straight line in the arrow colour
  at reduced opacity, no head, drawn only where the hint needs it (G19).
- **G14. A start marker.** The first node of each branch carries a small
  start marker; the walk numbers arrows in reading order, as now.

### Areas

- **G15. Bands** shade a whole house under the marks: a fish's base and
  cover lines, a subset's house, a single's house, Locked Candidates' box
  and line. Base and cover differ by style (filled band vs outlined band),
  not only by colour.
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
  its eliminations use both parities.
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
  the hint uses: true disc, false ring, removed, placed, each role, solid
  and dashed arrow, tie, start marker. Prose and notation can carry the
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
  geometry; each renderer only paints it in its own theme. Today they are
  three separate implementations that differ in 25 ways.

## Truth: where it comes from

A node's truth is never guessed by the renderer. The rule:

- A link's `strong` already says what the link infers about its target:
  `strong` = the target is true, weak = the target is false. That holds
  for AICs (a strong link enters a true node) and for forcing trails
  (`strong` = placed in the branch, `forcingTrail.ts:218-234`) alike.
- The first node of each branch has a declared truth: a new optional
  field on the link that starts a branch, `fromTrue?: boolean`. Absent
  means false, the AIC premise ("suppose the start is false").
- Every other node takes the truth its incoming link gives it. A node
  given two different truths is either the closing node of a
  discontinuous loop (allowed, G18) or a bug: a test fails.

What each finder must add (from the map of what they emit today):

| Technique | Today | Needed |
| --- | --- | --- |
| X-Chain, XY-Chain, AIC, AIC_GROUPED, AIC_ALS, Skyscraper, Kite, Turbot, W-Wing | alternating links, start strong | nothing: start false, derived |
| X_CYCLES, GROUPED_X_CYCLES, NICE_LOOP, GROUPED_NICE_LOOP rule 1 (continuous) | alternating + weak closure | nothing (one consistent world; the legend says "if the start is false") |
| … rule 2 (discontinuous, strong closure) | alternating + strong closure | nothing: start false, proven true, G18 |
| GROUPED_X_CYCLES rule 3 | inverted, weak first | `fromTrue: true` on its first link |
| Digit, Cell, Unit, Nishio forcing; Check's why-not | branches; on/off only in the first sentence's text | `fromTrue` on each branch's first link |
| SIMPLE_COLORS, MULTI_COLORS, MEDUSA_3D, REMOTE_PAIR | ties + witnesses | a cluster index and parity per candidate (new `clusters` field), truth only for a proven wrap |
| ALS_XZ, ALS_XY_WING, ALS_XY_CHAIN | weak links between groups, implicit ALS links missing | the ALS's internal strong links (digit node to digit node, as AIC_ALS already emits) and an ALS index per set |
| DEATH_BLOSSOM | a fan of weak links | one branch per stem digit, `fromTrue: true` |

## Phases

Each phase is one or a few commits, each green on its own (tsc, unit
tests, browser tests), reviewed by refuting reviewers, and merged to main
when clean. The order puts the biggest visible gain first and the riskiest
data changes later.

1. **The board foundation** (no data change; every hint benefits):
   - the shared geometry module (G25 first part): anchors, gaps,
     straight-or-arc decision with clearance check (G9, G10), arrowheads,
     in-cell links skipped (G12), corridor offsets; pure functions with
     unit tests;
   - z-order: arrows over grid lines with a halo (G11);
   - no hint cell tints (G1); placements get their disc (G3);
   - the arrow colour token, separate from acts-through (G7), in all four
     themes and the Learn pages;
   - Grid.tsx and boardSvg.ts both use it.
   Accept: every stored example renders; the gallery (below) shows no
   arrow under a grid line, no loop inside a cell, no arrow crossing one
   of its own hint's marks.
2. **Truth** (G2, G3, G5, G8, G18): `fromTrue` on ChainLink, the
   derivation function with its consistency check, true discs and false
   rings, removal stroke, placement ring, the precedence fix (the blue
   rings). Accept: a test derives truth for every stored example and
   every chain step in a solve batch, finds no conflict except loop
   closures, and checks that every elimination of an AIC sees a true node
   at each end under the derivation.
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

## Colours

To be filled from the measured colour study: exact values for true,
false, removed, placed, pattern, acts-through, exception, four ALS tints,
cluster hues and shades, arrow, halo and start marker, in each of the four
themes and the Learn pages, with their contrast against the board and each
other and their separation under protanopia, deuteranopia and
tritanopia.

## Status

- [ ] Phase 1: the board foundation
- [ ] Phase 2: truth
- [ ] Phase 3: colouring
- [ ] Phase 4: sets
- [ ] Phase 5: forcing
- [ ] Phase 6: words
- [ ] Phase 7: polish

Branch `claude/hint-drawings`. Research behind this spec (HoDoKu's source
read at SVN r147, our renderer's map, the other solvers) was summarised
here; the HoDoKu line references are to
`svn.code.sf.net/p/hodoku/code/HoDoKu/trunk/src/sudoku/`.
