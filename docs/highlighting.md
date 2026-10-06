# Highlighting: how a technique is shown

What the board draws for a hint, what the words beside it say, and the
rules every technique follows, so that a player can read the logic of any
of the 77 techniques off the board. This is the standard set out in
[review.md](review.md), as built. The rendering lives in
`src/ui/Grid.tsx` (the app) and `src/content/boardSvg.ts` (the Learn
pages), the walk in `src/engine/hintFrames.ts`, and each technique's
drawing in its finder under `src/engine/techniques/`.

## The vocabulary

A step (`Step` in `src/engine/steps.ts`) carries everything the board
needs:

- **Colours, with one grammar.** Blue (`primary`) is the pattern itself:
  the base cells, the chain, the locked set, the stem. Amber
  (`secondary`) is what the pattern acts through: cover lines, pincers,
  the second colour, the petals. Purple (`fins`) is the exception: a fin,
  the extra candidate, the bridge colours, where a forcing chain breaks.
  Red is removed, green is placed. A technique that has had its colours
  chosen with care keeps them; the grammar names what they mean.
- **A legend that always speaks.** `labels` says in words what each colour
  means in this step, in the technique's own terms ("base rows", "the
  roof's extra candidate", "gold: the other colour"). Every technique
  carries them; the generic "the pattern" is a fallback nothing uses.
- **Bands.** `units` shades whole houses under the marks: a fish's base
  and cover lines, a locked set's house, the box and the line of a Locked
  Candidates step, the house a single was found in, the lines a hidden
  single is crosshatched along.
- **Solved cells.** A solved cell listed in a colour shows that colour on
  its digit, never a candidate circle: the digits that exclude a naked
  single, the solved corners of an Avoidable Rectangle.
- **Arrows and ties.** `links` are drawn between candidates. An inference
  is an arrow, solid for a strong link and dashed for a weak one, with a
  halo in the board colour so it stays legible over pencil marks, and a
  dot on the first node, where reading starts. An arrow swings out near
  its start, to keep off the digits that lie straight between its ends,
  and arrives straight along the line to its target, so the head points
  where the eye expects. A tie (`undirected`) is a quiet straight line
  without an arrowhead, never routed: a conjugate pair, or the two
  candidates of a bivalue cell, exactly one of them true. Every link can
  carry its own sentence (`text`); the colouring witnesses do.
- **Red over a colour.** A coloured candidate that the step removes is
  drawn red with a ring in its colour, so a colour that is removed
  entirely (a Medusa or colouring wrap) is still there to be read. A cell
  keeps the tint of the colour it holds; red tints only a cell with
  nothing else to say.
- **The walk.** Every hint with more than one idea can be walked: "Walk
  through it" in the hint panel, then ← and →. A chain reveals one link
  per frame, numbered on the board, with its sentence; a run of ties is
  one frame, the cluster; a pattern reveals one colour per frame, in the
  order the legend introduces them; the last frame is the conclusion. H
  still applies the step from any stage.

## Family by family

- **Singles.** A Full House shades its house. A Naked Single marks the
  cell and the eight digits that exclude every other candidate, one peer
  per digit. A Hidden Single shades its house and crosshatches it: the
  placed digits that rule out the other cells are marked, and the line
  (or box) each one shades across the house is drawn, the way crosshatching
  is taught.
- **Locked Candidates.** The box is blue, the line is amber (pointing), or
  the other way round (claiming); the confined candidates are circled and
  the removals are red.
- **Subsets.** The house is shaded and the set is circled; a locked set in
  an intersection shades both houses it clears.
- **Fish.** Base lines are blue bands, cover lines amber bands, the base
  candidates are circled, fins are purple. Complex fish name their base and
  cover sets.
- **Single-digit patterns and wings.** As before: the chain's arrows, the
  pivot and the pincers. An Empty Rectangle shades its box.
- **Uniqueness.** The rectangle is the pattern; the legend names floor,
  roof and extras. Avoidable Rectangles show their solved corners. BUG+1
  shades the three houses that hold the digit three times.
- **Chains and loops.** Arrows, solid and dashed, from the first node to
  the last; the walk reads each link as the inference it is.
- **Colouring.** The cluster's conjugate ties are quiet straight lines,
  blue and gold candidates, and the only arrows are the witnesses the
  explanation names: the blue and the gold candidate the removed one
  sees, the two same-coloured candidates that clash, the bridge in Multi
  Colours. Each witness carries its sentence ("If blue is true, the 6 in
  r3c3 is placed, and the 6 in r3c7 goes."). The walk shows the cluster
  in one frame and the witnesses one by one. When a whole colour is
  removed, its candidates are red with a ring in that colour.
- **ALS.** Each set in its colour; the restricted common digits are drawn
  as links between the sets; a Death Blossom links each stem candidate to
  its petal; an ALS-XY-Wing links its hinge to both sets.
- **Forcing chains.** Nishio, Digit, Cell and Unit forcing draw one line of
  their reasoning: the assumption, each forced single pointing at the next
  with a sentence saying why it was forced, and at the end either the
  cells where the board would break (purple) or the conclusion the
  branches agree on. In a position that still has singles of its own (in
  Scan, or Check's "why not"), a line may start at such a single: its
  first sentence then states the assumption, and the single as a fact
  the position already has ("Assume r1c1 = 7. In row 2, 7 already fits
  only in r2c7, so ..."). A net can have several such lines; one sound one is
  shown. The Forcing Net itself is not drawn: it reasons with
  intersections as well as singles and is search, not a pattern.
- **Everything else** (Sue de Coq, Exocet, Fireworks, APE, Pattern
  Overlay, Chute Remote Pair, Extended Rectangle) keeps its drawing and
  names its colours.

## The rules

1. A technique's colours are never changed for taste. They change only
   when the drawing contradicts the technique's own words (Multi Colours
   named purple candidates the old renderer drew blue, because a chain
   node took its colour before the fins were read; now a named colour
   wins over the chain default).
2. Every step names its colours. `tests/examples.test.ts` holds every
   worked example to the engine; a drawing change means
   `npx vite-node scripts/hunt-examples.ts refresh` and a look at the
   diagrams.
3. Everything drawn is on the board: every marked candidate exists in the
   position, a solved cell is marked only with its own digit, every band
   is a real house, every forcing link is a placement the trail really
   makes (`tests/forcingTrail.test.ts`).
4. The app board and the Learn diagrams draw the same thing from the same
   step.
5. Fewer marks that mean more beat many that mean little: a tie is a thin
   line, an inference an arrow, and only what the explanation names gets
   an arrow.
