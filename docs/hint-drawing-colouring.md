# Hint drawing, phase 3: colouring (the design)

Decided 26 October 2026 for Simple Colors, Multi Colors, 3D Medusa and
Remote Pair, from a map of the code (six readers), three independent
designs (HoDoKu minimalism, teaching first, risk first) and two judges (a
Nightmare-level solver; a casual and colour-blind player on a phone). Both
judges built from the minimalist design and grafted from the others; this
is that synthesis. It refines G19 of [hint-drawing.md](hint-drawing.md),
which points here. The working notes (maps, designs, scans, fixtures) are
kept outside the repository.

## What a player sees

**The full view is HoDoKu's colouring, plus the reason and the proof.**
Each candidate the step colours is a filled disc behind a near-black digit,
in two shades of one hue per cluster: dark purple and light purple; in
Multi Colors a second cluster in dark and light orange. Removals are plain
red barred rings. No ties, no arrows, no start dots, no walk numbers. Two
things HoDoKu never shows:

- **The reason, as 1-3 thin dashed lines with no head**, from the candidates
  the argument rests on: the removal of a trap sees a dark and a light
  candidate of its digit, and both lines are on the board. A dashed line
  means "these two see each other (or share a cell), so at most one is
  true". It claims no truth, so it stays true whatever its ends become.
- **A proven colour.** Where the step proves a colour false (Simple
  Colors' wrap; Multi Colors where a colour sees both colours of the other
  cluster; 3D Medusa rules 1, 2 and 6), that colour is drawn as the
  removals it is, and its partner as green true discs (no outer ring:
  nothing is placed; the step only removes, and each is then a single). A
  step that proves no colour (a trap, a bridge, Medusa rules 3-5, Remote
  Pair) never draws anything true or false, in any frame.

**The walk tells the argument one idea at a time:**

1. One frame per cluster: its shades and its ties, thin quiet lines
   along the shortest tree that joins it, straight unless one would cross
   another mark of its frame or another candidate of its digit, when it
   bends round it as an arrow does, apart from the ties it meets, running
   beside none of them, and off the board's edge (G13). "Each line joins the only
   two 4s of a house: exactly one of them is true, so they take opposite
   shades." Inside a cell with only two candidates a tie draws nothing: a
   dark and a light disc side by side say it. The ties leave the board
   after their frame.
2. One frame per argument link (a bridge, a clash, a witness), each a
   headless dashed line wearing its frame's number, accumulating. A link
   between two candidates of one cell (Medusa) is drawn as corner brackets
   round the cell, so no frame is blank.
3. Where a colour is proven: a proof frame, in phase 2's grammar: the false
   colour as blue false rings, its partner as green true discs. "So dark
   purple is false and light purple is true: once dark purple is removed,
   every light purple candidate is a single."
4. The conclusion, identical to the full view.

**The legend** names what the frame draws, drawn like the marks: per
cluster a pair swatch ("dark purple, light purple: either every dark
purple 4 is true, or every light purple one is"); "line: exactly one of its
two ends is true" in a cluster frame; "dashed line: its two ends see each
other, so at most one is true"; "corner brackets: two candidates of one
cell, at most one true" (Medusa rules 1 and 5), or for rule 3's "corner
brackets: a cell holding both shades; one is true, so its other
candidates go"; "remove", or after a proof "remove: dark purple,
proven false"; "true: light purple, proven (this step only removes)"; in
the proof frame "false: dark purple, proven"; Medusa rule 6's emptied
cell. The Learn diagram is the full view with its legend.

## Decisions

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | Ties in the full view? | No: only in their cluster's walk frame, along the shortest drawn spanning tree; nothing inside one cell | HoDoKu draws none; Medusa's BFS trees draw up to 46 lines, 418 of 1,431 over another mark; the shortest tree (Kruskal on drawn length + 3 per hint mark within 0.13 cell; of equal weights, a straight line first, then the fewest ties at its ends within 60 degrees, then reading order) cuts that to 173 (177 with reading order alone) |
| 2 | Witness, clash, bridge lines | A weak tie: dashed, headless, no start dot, bent like an arrow (G10), halo, digits cut out (G11), numbered in the walk; each end clearly its own candidate's, two into one candidate never crossing before it where the marks leave room (G13); drawn from its frame on, and in the full view and Learn (1-3 lines) | the reason on the board, faster than HoDoKu; a directed head would claim an inference, and some would point into a candidate that is true in the solution (checked) |
| 3 | A symmetric clash | the same weak tie; inside one cell, corner brackets | "not both true" has no direction |
| 4 | A proven-false colour | proof frame: false rings; conclusion and full view: plain removals, no shade inside (G5's colouring exception retired: a dark-theme removal ring on a shade fill is 1.16:1) | G19 as written, phase 2's order; the shade's name lives on in the legend |
| 5 | The proven-true colour | green true discs, no outer ring; placements stay [] | it is proven; "each is then a single" holds (corpus test) |
| 6 | Which parity is dark | the colour the argument tests first: the colour proven false; both colours a bridge joins; the colour Medusa rule 5's removal sees across a house; otherwise the colour of the cluster's first candidate in reading order, and witness frames take dark first | a shade means the same thing every time, and one template per sentence |
| 7 | Palette and words | purple #c361f1 / #ccb9e7 (cluster 0: every single-cluster hint; in Multi Colors the cluster left in shades), orange #ed6907 / #fcd2b1 (cluster 1, Multi Colors only); light themes rim both shades in the dark shade, thin (1 unit, inwards) on every board and in Learn, so the eye's mix of rim and fill keeps the shades 15 or more apart; a shade's keyline, 2 units on a small board, parts it from the player's cell colours; dark themes edge = fill. en dark/light purple, dark/light orange; nb mørkelilla, lyselilla, mørkeoransje, lyseoransje; es morado oscuro, morado claro, naranja oscuro, naranja claro | see Colours below; the nb and es words do not inflect, and a colour named as a noun is neuter in nb ("mørkelilla er sant", as "blått er sant" was) and masculine in es ("el morado oscuro es verdadero") |
| 8 | Hypotheses | never drawn; a witness sentence says "If dark purple is true, the 4 in r6c4 is true, and the 4 in r6c8 goes." ("is true", never "is placed") | nothing on the board is conditional |
| 9 | Medusa inside one cell | ties draw nothing; a witness or clash inside one cell draws corner brackets (four L-shapes in the arrow ink, inset 0.055 cell, arms 0.10 and shorter at the bottom corners, arrow stroke, halo, thicker on a phone, walk number on a clear corner); rule 3's two in-cell witnesses become one link and one frame | 59 of 118 Medusa witness frames drew nothing |
| 10 | Remote Pair | one purple cluster over its two digits, the whole component (what the finder proves); every cell one dark and one light candidate; ties on the lower digit along the shortest tree; trap witnesses; never "conjugate", "chain of 35 pairs" or '"colors"' | it is a two-digit colouring; drawn as a chain from one end, 23 of 37 path steps' removals rested on the other parity |
| 11 | Learn diagram | the full view (with its 1-3 dashed lines) and its legend | equal to the app's full view (G22, G25) |
| 12 | Copy step | HoDoKu's form: `Simple Colors Trap: 4 (r1c5,r6c4,r8c6) / (r1c6,r5c5,r8c8) => r6c8<>4`; Multi Colors 1 (bridge) and 2 (sees both), clusters joined by ", "; 3D Medusa with candidate items; Remote Pair cells by colour; no Eureka line for a colouring | the community's notation |
| 13 | Multi Colors hides "sees both" behind a bridge (24% of available bridges, and the stored example) | swap the stored example now; fix the search order in its own reviewed change after phase 3 | the fix changes solve paths |
| 14 | Place the proven-true colour? | no | it would change solve paths and ratings |
| 15 | Frame model | `Frame.links` keeps "links reached" (walk numbers, a loop's closure); a colouring frame adds `drawn?: number[]`; every consumer goes through one `drawnLinks(step, frame)`; geometry is computed once from all links (G14) | chain walks are untouched |

## Data

```ts
// src/engine/steps.ts
truth?: 'derived' | 'parity';
colouring?: Colouring; // with truth 'parity' only; such a step has no primary, secondary, fins or labels

export type ColourRule = 'trap' | 'wrap' | 'bridge' | 'seesBoth'
  | 'medusa1' | 'medusa2' | 'medusa3' | 'medusa4' | 'medusa5' | 'medusa6' | 'remotePair';
export interface ColourCluster { dark: CellDigit[]; light: CellDigit[] } // exactly one of the two is wholly true
export interface Colouring {
  rule: ColourRule;
  clusters: ColourCluster[]; // 0 purple; 1 orange (Multi Colors only)
  darkFalse?: 0 | 1;          // the cluster whose dark colour the step proves false
}
// ChainLink.undirected: strong = a tie (exactly one end true); weak = a weak tie (at most one end true)
```

Links come in walk order: cluster 0's ties (the first carries the cluster
frame's sentence in `text`), cluster 1's ties likewise, then the argument
links, each with its `text`. `src/engine/truth.ts` gains `checkParity`
(a candidate in two shades or clusters; a tie joining equal shades or no
real strong relation; a cluster its ties do not span; a proven-false
candidate not removed; a removed coloured candidate outside the proven-false
colour). The finders' removals, the techniques and the ratings do not
change.

## Per rule

Fixtures (puzzle, solve step) for every rule are in `tests/colouring.test.ts`;
the stored examples are a trap, a bridge (the swapped Multi Colors
example, `.5.8.4.......73.1.......9.89.....4...7.9.2.35..1...27..........7...8...4.8..597..`
at step 25), Medusa rule 4 and Remote Pair.

- **Simple Colors trap**: one cluster; the full view draws the shades, the
  removals, and the two dashed lines of the first removal; extra removals
  are worded ("; 3 more 4s fall the same way"), and the explanation the
  full view shows then names them all: a colouring that removes more than
  one candidate is followed by its conclusion, as a cell its sentence
  names may lose a second candidate. Frames: cluster, dark witness, light
  witness ("Either way it is false."), conclusion.
- **Simple Colors wrap**: dark = the colour that appears twice in a house;
  frames: cluster, the clash ("Dark purple puts 6 in both r4c5 and r4c7 of
  row 4. A digit appears once per house, so dark purple cannot be true."),
  proof, conclusion; full view: dark as removals, light as true discs, the
  clash line.
- **Multi Colors bridge** (HoDoKu Multi Colors 1): cluster 0 purple (the
  cluster the bridge reaches), cluster 1 orange; dark = each cluster's end
  of the bridge. Frames: purple cluster, orange cluster, the bridge ("...
  cannot both be true: light orange or light purple is true"), the light
  purple witness, the light orange witness, conclusion.
- **Multi Colors sees both** (HoDoKu Multi Colors 2): orange dark = the
  colour that sees both purples (proven false). Frames: purple cluster,
  orange cluster, first bridge, second bridge (which proves it), proof,
  conclusion. Orange never shares a frame with a true disc of its own:
  after the proof it is removals and true discs only.
- **3D Medusa rules 1 and 2**: dark = the colour twice in a cell (brackets)
  or a house (dashed line); proof; conclusion.
- **Rule 3**: a cell holding both colours loses its uncoloured candidates:
  one bracket frame for the first such cell; others worded; a single
  removal named ("so its 6 is removed").
- **Rule 4**: as the trap, but where a removal after the first sees
  only one shade of its digit while its own cell holds the other (rule
  5's reason), the extra removals "are false whichever shade is true":
  "the same way" would send a reader looking for both shades round each.
- **Rule 5**: dark = the colour seen outside the cell (a dashed line), light
  = the colour in its own cell (brackets); extra removals "fall the same
  way", as the trap's, since its sentence already says "whichever shade".
- **Rule 6**: dark = the colour that would empty a cell; one dashed line
  per candidate of that cell, which is drawn as plain rings and named in
  the legend ("a cell dark purple would empty"); proof; conclusion.
- **Remote Pair**: see decision 10; frames: cluster ("The cells ... hold
  only 3 and 5. Each line joins two of them that see each other: they
  cannot hold the same digit, so their 3s take opposite shades, and so do
  their 5s."), dark witness, light witness, conclusion.

## Colours

The same fills in LIGHT and DARK; the rims as in decision 7. The numbers
below are the fills'; drawn, a light-theme light shade is its fill mixed
with a 1-unit rim of the dark shade, which leaves dark and light purple
15.2 apart (worst model) and orange 20.6 (docs/hint-drawing.md, Colours
and sizes; tests/shadeRender.test.ts).

| Token | Fill | Digit #10131c on it | On white / dark cell |
| --- | --- | --- | --- |
| `--hint-purple` (dark purple) | #c361f1 | 5.57:1 | 3.33 / 4.86 |
| `--hint-purple-light` | #ccb9e7 | 10.30 | rim / 9.00 |
| `--hint-orange` (dark orange) | #ed6907 | 5.85 | 3.17 / 5.11 |
| `--hint-orange-light` | #fcd2b1 | 13.24 | rim / 11.57 |

Worst-model CIEDE2000 (the lowest over normal vision and the Machado 2009,
Brettel 1997 and Viénot 1999 protan, deutan and tritan simulations, the
method behind the spec's numbers): within purple 17.6, within orange 22.7,
across clusters 14.6 (light/light, tritan) and up, purple against true green
23.4 and up, purple against the removal 15.1 and up; HoDoKu's own pairs
are 6.7 and 11.4. Pairs that lean on shape: in the dark theme dark orange
vs the removal (11.8) and light orange vs the removal (8.5): a disc against
a barred ring. Orange against true green (10.7) is never drawn together,
and a test holds it.

## How it is checked

A fixture, made on main before any change, of every non-colouring drawing
(frames, marks, legends, shapes, dots, badges) that must stay identical;
`checkParity` and the solution over the practice pools' paths and sampled
positions; the corpus claim that every light candidate is a single once its
dark colour is removed; frame counts, drawn links and marks per frame for
every fixture; no orange shade beside a true disc; the words of every
sentence and legend naming only the hues the frame draws, in en, nb and es;
the palette numbers above; the tie tree's totals; the notation; the
renderers and the browser walk test. Then review rounds as in the handoff,
on screenshots of every fixture in all four themes and on a phone.
