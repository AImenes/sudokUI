# Hint drawing, phase 4: sets (the design)

Decided 27 October 2026 for the chains that pass through groups (AIC with
Groups, Grouped Nice Loop, Grouped X-Cycles) and for the almost locked sets
(AIC with ALS, ALS-XZ, ALS-XY-Wing, ALS-XY-Chain, Death Blossom), from five
maps (groups, ALS, geometry, palette, HoDoKu), three independent designs
(HoDoKu fidelity, teaching first, risk first) and two judges (a
Nightmare-level solver; a casual and colour-blind player on a phone). The
owner delegated the decisions to the lead engineer, who settled them: risk
first's engine and test discipline as the base, teaching first's walk,
words and letter tabs, and HoDoKu's Death Blossom, `checkSets` and tight
tiles, as the solver judge listed them. Where those were silent this takes
the judges' grafts, and where the judges disagreed the table says which way
and why. It refines G5, G10, G11 and G16 of [hint-drawing.md](hint-drawing.md),
which point here. The working notes (maps, designs, judges, scans and their
scripts) are kept outside the repository. Amended the same day: the
ALS-XY-Chain overlap ban the designs put before phase 4 is dropped, and a
chain whose sets share cells is drawn as it derives (decisions 6 and 13).
Built the same day in its nine stages; where the build met a case the
design left open, it settled it as **As built** (at the end) records, and
the decisions it refines say so.

## Goal

A group must read as one node that never claims each of its members true,
and an almost locked set as one named thing wherever its cells lie. The ALS
patterns must read as the chains they are, in phase 2's grammar from the
full view to the conclusion, and say why a set locks. Nothing drawn may
claim more than the step proves. Every other drawing stays as it is, byte
for byte, and no conclusion, solve path or rating moves.

Today none of that holds (the maps):

- A true group's members are the pattern's blue disc ('oneTrue', the
  exception the spec kept until this phase), nothing joins a group's
  members, and in 48% of groups the arrow in and the arrow out land on
  different members, so a group reads as two nodes.
- The ALS patterns colour their sets by role, not identity: ALS-XY-Chain
  draws A and D both blue and B and C both amber, and Death Blossom paints
  every petal amber. The restricted common is a headed arrow; z is not
  marked.
- AIC with ALS drops the set (`GNode.als` dies in `nodeCds`), draws 103 of
  162 internal links as an arrow from one digit in one cell to another digit
  in another, and leaves the set's other digits undrawn.
- The ALS-XZ walk says only "Weak link on 1", and a set's internal link
  falls to a false generic sentence ("Strong link: if r8c2, r9c1 is not 5,
  r8c2 must be 1").
- Copy step names the wrong sets in 78 of 376 path XY-Wings, 62 of 211
  XY-Chains and 8 of 18 Death Blossoms, and braces an AIC with ALS set in 3
  of 67 path visits.

## What it draws

**A group is its members' own marks on a bar.** A group node (the 2-3
candidates of one digit in one box and one row or column) is drawn as one
object without a hull round other candidates:

- A TRUE group ("one of these is true") draws each member as a pale "one of
  these" rounded square behind its digit, with a thin edge in the true ink.
  It is never a true disc and never the true disc's green fill: square
  against disc says "one of", not "each".
- A FALSE group draws each member as phase 2's blue false ring, which is
  true of every member.
- A straight bar in the glyph-free gutter beside the members joins them,
  in their mark's ink: green under squares, blue under rings, the pattern's
  ink in a proof-only view, red under a removed group. The squares or rings
  sit on it.
- Grouped X-Cycles rule 3's start goes through three marks: green squares
  on a green bar while it is assumed, blue rings on a blue bar at the link
  that closes the loop, red removals on a red bar in the full view and the
  conclusion.
- Arrows still meet the member nearest the other end, at the exact edge of
  its square or ring, and no arrow crosses a bar except at the member it
  joins, so none passes between a group's members.

**An almost locked set is a tight tile in each of its cells, lettered.** Each
cell of a set gets a rounded tile round that cell's own candidates (every
candidate of an ALS cell belongs to the set), filled in the set's tint at
half strength and outlined in the set's ink. Nothing joins the cells: no
hull, no causeway, so no given, removal or other candidate is ever covered.
Every tile carries a small filled tab in the set's ink with the set's
letter (A, B, C, D) in the board's colour, in a free candidate place. Three
tints (sand, rose, violet) part the sets at a glance; the letter is the
identity, the name the walk, the legend and the copy line use. No word
names a tint.

**The ALS patterns are chains.** ALS-XZ, ALS-XY-Wing and ALS-XY-Chain are
drawn as the derived chains they are, (z)A=(x)A-(x)B=(z)B and its longer
forms, as AIC with ALS already is:

- the digit the chain enters a set by is blue false rings, the digit it
  leaves by a green true disc (one candidate) or green "one of these"
  squares (several), and the set's other digits are bold on the tile;
- the restricted common is a dashed arrow into the next set's false rings,
  as every weak link of a chain is;
- nothing is drawn inside a set: the tile carries the link (G12);
- a start dot, and the legend names the premise by the set's letter ("true,
  if set A holds no 5").

No pattern-blue or gold disc sits beside a truth mark.

**Death Blossom is the pattern until phase 5.** Its stem and each petal's
digit the stem sees are acts-through gold discs, every petal's z is a
pattern-blue disc, the petals are lettered tiles and the stem has none. A
headless dashed weak tie runs from each stem candidate to its petal's
candidates of that digit. No truth is drawn anywhere in its views (G2-G4
hold), and its walk tells each branch in words.

**The walk introduces each set before the chain uses it.** A set of several
cells gets its own frame first ("the 2 cells r8c2, r9c1 of box 7 hold only
1, 5 and 9: one digit more than cells. Without any one of these digits, the
others fill the cells."); a one-cell set's introduction is folded into its
internal link's frame. Then one link per frame, as every chain walk. The
conclusion names both end sets and gives the reason ("Each removed 5 sees
every 5 of both."). Every sentence comes from the step's data: a single
exit reads "r8c2 must be 1", an exit of several cells "one of r4c9, r6c8
must be 7".

**The legend** draws squares on a bar, rings on a bar, squares in a set and a
lettered tile as they look: "squares joined by a bar: one of them is true,
if ..."; "rings joined by a bar: none of them is true, if ..."; "lettered
cells: an almost locked set ...". The Learn diagram is the full view and its
legend, under a description rewritten so the diagram explains the removal.

**Copy step** writes Eureka with braces round the whole set for the four
chain techniques, `(5=1){r8c2,r9c1} - (1=5){r7c8,r8c9} => r7c1<>5`, and
Death Blossom's HoDoKu line built from the step's own sets.

## Decisions

| # | Question | Decision | Why |
| --- | --- | --- | --- |
| 1 | A TRUE group's members | A pale "one of these" rounded square per member (`--hint-one-of`, #abe1ba light, #296243 dark, opaque), 26 × 26, rx 7, a 2-unit edge drawn inside in the true ink (#006c2f; #35a458), the keyline in the board's colour (1.5 units, 2 on a small board, as the shades'), the digit bold in `--hint-in-ring`. Never a true disc, never the true green fill; same size on every board | 62% of groups are true (474 of 762); HoDoKu paints every member of a true group green, which teaches that each is placed. A square is not a disc, so shape says "one of" without colour; the square is 11.6 from the true disc (worst model, light themes) and 22.9 (dark), where its digit also flips to the light ink (near-black would be 2.58:1). The pattern disc it replaces was 4.1 from true under tritan vision in the dark theme |
| 2 | What joins a group | A straight bar 15 units off the members' line in the glyph-free gutter, from the first member's centre to the last's, in the members' mark ink; width 3 (4.5 under 600 CSS px, 5.5 under 330), round caps; under the marks, whose keylines part them from it; cut out by the digits as arrows are. Its side by teaching's score: 1000 per shown non-member glyph crossed, 100 per other hint mark within 13 + keyline + half-width, 100 per earlier bar within its width + 2, 500 per straight arrow of the hint crossing it away from its anchoring member, 10 for an edge band, 1 per solved digit passed; the least wins, ties below, then right | Nothing joins the members today. A capsule round them would cover another candidate in 55% of groups (421 of 762) and a solved cell in 147 of 214 gapped groups; HoDoKu's rail along the members' own line strings non-members onto the group (the Grouped Nice Loop example's rails through 1r2c9, 1r3c9, 3r2c9, 6r3c9). Over 785 group nodes the gutter bar crossed no glyph: 590 clean, 146 behind a solved digit (cut out), 34 in an edge band (2.25 units or more off a box line on a tiny board), 20 touching another mark, drawn over it. Knowing earlier bars puts two groups on the same cells on two sides |
| 3 | FALSE groups, rule 3, proof-only views | A FALSE group: its members' false rings on a blue bar. Rule 3's start: green squares on a green bar before the closing link, with the start dot by the member nearest the next node; blue rings on a blue bar at the closing link; red barred rings (the pattern colour inside, G5) on a red bar in the full view and the conclusion. A discontinuous loop's full view and conclusion: pattern discs on a pattern-ink bar. `oneTrue` and its pattern-disc exception are retired | Every member of a false group is false, so each ring is true. The bar takes its members' ink in every state, so rule 3 reads assumed, proven false, removed. 17 groups are rule-3 starts; 48 Grouped Nice Loops and 7 Grouped X-Cycles are placing loops |
| 4 | Where arrows meet groups and sets | At the node's member nearest the other end, as today, never at a bar's or tile's edge; the tail or tip where the ray towards the other end (or the first or last control point) leaves that member's mark exactly (a square reaches 13 on its axes, 15.5 at its corners), plus the gap. Bars and tabs are obstacles for every arrow, tie, start dot and walk number; a group's own bar is exempt within 14 + gap + half-width of the anchoring member. A strict test: no arrow crosses a bar except at its anchoring member. Tiles are areas, crossed as bands are; a set's members are obstacles, as marks are. All through an optional argument, so a step with no sets is laid out byte for byte as today | Joining a hull's nearest point lands beside another digit's member at 57% of ALS ends and beside a foreign digit at 22% of group ends; the member keeps the head on its candidate (HoDoKu anchors at a group's first member only, so its other members get no arrow). Another arrow passes between a group's members in 63 groups today; the exact reach keeps the gap at every angle |
| 5 | The ALS mark | One tile per cell of the set: the rectangle round the centres of that cell's candidates, 15 units out, corner radius 10; fill the set's tint at `--hint-set-alpha` 0.5; outline in the set's ink at full strength, stroked inwards, 2.5 units (4.5 under 600 CSS px, 5 under 330; Learn half again, built 1.65 times, As built), never under 1.5 CSS px on a phone. Its outer edge keeps 6 units from the cell's edge on every board (3 clear of a box line). No hull, no causeway, no whole-cell tint | 80-90% of multi-cell sets are not compact, and 68% have cells between their cells, 64% of them solved. A padded hull covers a foreign candidate in 43% of sets and a removal in 13% (the stored XY-Chain's 4r4c5); per-cell tiles round a cell's own candidates held no foreign candidate in 5,032 cases. A whole-cell tile is a cell tint (G1) and reads as the player's own colours (rose is 2.7 from their pink). Causeways hug a grid line in 17% of cases on a phone and cross another set's in about 3%. Outlines of 4.5 and 5 units are 1.6 CSS px at the smallest board of each step (G14a) |
| 6 | A cell in two sets | The smaller set's tile (on equal sizes, the earlier set's); the other set's outline dashed "6 4", one outline width inside it, no fill; both tabs, each in its own free place. So a set lying wholly inside another's cells has a tile in each of its cells, and the set round it shows its tint on its other cells and its dashed outline and tab on the shared ones: at `.37.4......67.8...........972.....61..91.54..14.....856...........9.28......8.23.` step 25, A (the cell r7c7) lies inside D (r7c5, r7c7), so r7c7 is A's tile with D's dashed outline inside it and both tabs, and r7c5 is D's tile. As built: a set this leaves with no filled tile takes one of its cells from a set that keeps another; four sets on three cells leave one without (As built) | Common, since ALS-XY-Chain keeps HoDoKu's rule (decision 13): in the maps' scan of the practice pools, seeds and examples, 61 of 113 path XY-Chains put a cell in two sets (A and D in 57), and 32 put one set wholly inside another's cells, 29 of them A and D (124 and 64 of 211 over every corpus); AIC with ALS menu steps share a cell in 31 of 4,778, none on the paths. No cell is in three sets: only sets that are not neighbours share cells, and no three of A-D are (none in the scans). So a shared cell draws the same two outlines however the sets nest; nesting decides only whose tint shows. The earlier set's tile, as first decided, left a set with no filled tile in 19 of the 113 (31 of 211), a later set lying in earlier sets' cells (D inside A in 16), so its tint showed nowhere; the smaller set's tile leaves every set a filled tile in all 211. Stacked tints read as one (1.6-5.8 apart); a second filled tile inside the first does not fit a cell on a phone |
| 7 | The letter | A tab on every tile: a rounded square in the set's ink (18 units, rx 4; 26 on a small board and in Learn) with a 1.5 keyline, the letter bold in the board's colour (13; 19). It is centred on a candidate place of the tile's cell that shows no digit: the places inside the tile's rectangle first, then those beside it, each in the order 1, 3, 7, 9, 2, 4, 6, 8, 5, taking the first where, at the phone's size, it keeps from every mark, start dot, walk number and head the 2 units two neighbouring discs keep; if none, the place with most room. Tabs are obstacles (radius 13; 18.4 on a small board). As built: placed against the drawing without them, a free place off the arrows' lines first, the places beside the tile nearest first (As built) | Only a letter on every tile identifies every cell for a colour-blind player, on a phone, and over the player's own colours, where a tile's fill all but vanishes (sand on yellow 1.8, dark rose on teal 0.6). Drawn inverse, it cannot pass for a candidate, as a bare letter in a candidate place reads as an 8; it is 12.9 or more from the walk badge's fill. A grid-corner diamond sits on four cells and names the wrong one. An ALS cell shows at most 5 digits, so 4 places are free |
| 8 | Tints and who takes which | Three: sand, rose, violet. Up to three sets take one each in letter order. Four or more take, in letter order, the lowest tint no set they conflict with already has (linked by a restricted common, sharing a cell, or sharing a cell side), and where none is free the lowest no linked set has: a tint is reused, never on two linked sets. Sets that share a tint are told apart by their tabs | Three tints are 15.3 apart (light) and 13.9 (forest) in the worst model, and keep linked, overlapping or touching sets apart in 555 of 556 path steps (in the one left, an ALS-XY-Chain whose sets share cells, A and D share a tint and a cell, parted there by the dashed outline and everywhere by their tabs); two tints fail in 41 (16 XY-Wings, 25 XY-Chains); four cannot hold digit contrast, the player's cells and the "one of these" square at once (palette map) |
| 9 | The dark violet ink | #c896ce, in place of the teaching design's #d4a3f7 | Pushed as far from the false ring's blue as the numbers allow: 8.7 worst-model (#d4a3f7 is 2.7, the map's #b4a6ff 0.5), and no nearer any other dark-theme mark or set ink (the pattern 9.4, the rose ink 9.1, the removal 12.8), at 6.03:1 or more on every dark board and panel and 5.35:1 on its own tile. It costs some saturation (CIELAB chroma 36 against 48) and contrast (7.19:1 before). The light violet ink stays #6a40d0, 3.3 from the false blue: an outline round candidates and a filled tab never take a ring's shape; a measured #8400fc (8.5) is kept in reserve should the screenshots show an outline read as a false ring |
| 10 | The mark of each candidate of a set | In a derived view a chain node takes its truth: a false node's candidates false rings, a true node of one candidate a true disc, of several "one of these" squares (no bar: the tile carries them), unless a node of one candidate already makes one of them true (an ALS-XY-Chain whose sets share a cell): that one is then its disc and the others, which see it, false rings, never squares beside the disc. A walk frame draws the truths the links it has drawn prove, never one a later set's lock adds. The set's other digits are the new `member` mark: no shape, the digit bold in `--hint-in-ring` on the tile. No primary, secondary or fin role in a derived ALS step. G5 becomes removed > placed > chain truth (disc, ring, square) > a role > a set member. Roles are drawn only where a view has no truth (Death Blossom) | G2-G5 forbid role discs beside truth marks (pattern blue against true 4.1, gold against true 8.3). The candidate ink `--cand` is 2.2-3.9:1 on a tint, so members are drawn in the ring ink, as G2 already asks of a digit a hint marks |
| 11 | ALS-XZ, ALS-XY-Wing, ALS-XY-Chain | Derived chains (`truth: 'derived'`): the finder emits each set's internal strong link, digit node to digit node, and the restricted commons as weak links. The restricted common is a dashed arrow with a head into the false ring(s), numbered in the walk; nothing is drawn inside a set; a start dot; the conclusion frame equals the full view. The one orientation the derivation picks, the finder's A first, is labelled by the premise in the legend, as W-Wing's is | They derive cleanly on every path and menu step of the corpora (391 and 9,142 XZ, 376 and 9,418 XY-Wing), as do the 87 path XY-Chains of four separate sets (decision 13 for those whose sets share cells), and every removal conflicts with both ends. One grammar holds for the family: AIC with ALS draws the same relation the same way, and nothing changes kind on the last frame (HoDoKu's pattern full view would turn the walk's rings into blue discs). A headless tie would break a chain's reading order |
| 12 | Doubly linked ALS-XZ | Only the restricted common the finder used is drawn and worded; the second common digit is a member | 13 path and 3,866 menu steps have two. Drawing the second would imply removals the step does not make; taking them is a finder change, its own review |
| 13 | ALS-XY-Chain whose sets share cells | No overlap ban: `findAlsXyChain` stays as it is, HoDoKu's rule (neighbouring sets share no cell, as a restricted common is looked for only between sets that share none; sets further apart may share cells), and a chain whose sets share cells is drawn honestly. One whose derivation is clean is drawn as the derived chain, its shared cells by decision 6. For an ALS pattern whose derivation has a problem, a closure or an `emptyTrue`, `hintMarks` draws no truth in any frame: tiles, tabs, members, arrows and removals only, the legend naming no truth, the walk in words; a closure is never drawn as a proof. As built, it has no start dot either (As built). truth.ts gains `emptyTrue`: a TRUE node of several candidates all of which the chain makes false | The designs took the ban (their E1, the four sets pairwise disjoint) for HoDoKu's default, `ALLOW_ALS_OVERLAP=false`. It is not: HoDoKu builds restricted commons only between sets that share no cell, so neighbours are kept apart, but "two non adjacent ALS may overlap without restrictions" (the javadoc of `AlsSolver.getAlsXYChainInt`), which is what `findAlsXyChain` does. The app's rating is HoDoKu's, so a ban would be stricter than HoDoKu. Built and measured on its own (commit eecb8c1, kept outside the repository for reference), it changed the solve paths of 21 of 336 practice puzzles and 17 of 144 seeds, moved 33 stored scores (-1,454 to +2,694), needed three stored puzzles replaced, and of 103,619 generated puzzles, where 990 take an ALS-XY-Chain and 696 one whose sets share a cell, moved 8 to another level; at some positions the hint became harder (a forcing chain in place of the overlapping chain). So the lead engineer kept the finder. On the paths 124 of 211 XY-Chains have sets sharing a cell: 56 clash in the derivation (36 `inFalseGroup`, 10 closures, 10 `emptyTrue`, a true end whose every candidate is false) and draw no truth; the other 68 are drawn as derived chains, with their shared cells. No chain of four separate sets clashes, and one whose last set lies inside the first always does, as its z are the first set's. A closure drawn as a discontinuous loop would prove "set A holds z", more than the step concludes. `emptyTrue` trips on none of 1,243 current derived chains, so it changes no drawing outside the ALS patterns |
| 14 | AIC with ALS whose only "set" is a bivalue cell | Keep the label; draw no tile and no letter for a one-cell set: it is the bivalue cell it is, drawn and worded as one (G12, "if it is not 2, it must be 6"), written `(2=6)r3c4`. The relabel is a later engine change, measured as the colouring search orders were | The judges split: the casual one would relabel so the title never names an undrawn set; the solver would keep it. It affects 557 menu steps and none on the paths, so the title is a menu-only inaccuracy, while nothing drawn is false. Relabelling can move the search's first find and moves the step's rating (5970 against 5960), so it is not phase 4's |
| 15 | Death Blossom (no truth until phase 5) | The pattern view: the stem's candidates and each petal's candidates of its stem digit acts-through gold, every petal's z pattern blue, the petals' other digits members; petals lettered tiles in stem-digit order, the stem no tile and never rings; a headless dashed weak tie from each stem digit to its petal's candidates of that digit, numbered in the walk, drawn from its frame on and in the full view; no start dot. Walk: the stem, then each petal in words only (a petal of several cells introduced first), then the conclusion. The branch links, (p)stem-(p)petal and (p)petal=(z)petal, are emitted in the data and derived in tests, ready for phase 5. As built: the legend in its role order with the tie in the colouring's words, the stem shown in every frame through a walk part of its own (As built) | The removal's reason (every petal's z, seen by each removal) is on the board, and nothing claims a truth the full view cannot have: three stem candidates cannot be true at once in one map. Rings for the stem would be G2's false shape; one-of squares on the petals' z would read as "each petal holds its 4", true in one branch only. Branches drawn per frame are phase 5's model; emitting the links now means phase 5 extends rather than rebuilds. All 18 path Death Blossoms and the 8,726 menu ones derive branch by branch with no problem |
| 16 | Letters | HoDoKu's: ALS-XZ A and B (A holds the start); ALS-XY-Wing A and B the wings (A linked by x, B by y), C the hinge; ALS-XY-Chain A to D along the chain; Death Blossom's petals A, B, C in stem-digit order; AIC with ALS in order of first appearance. The XY-Wing's walk reads A, C, B, and its hinge's frames say "set C, the hinge" | The board, the walk, the legend and the HoDoKu line must name one set alike (G22), and forum readers know the hinge as C. The solver judge asked for it; the casual judge's chain order (hinge B) loses that for a walk that reads A, B, C |
| 17 | The walk | A frame per set of several cells before the first link that reaches it (no link added; its tiles, tab and members drawn, no truth yet); a one-cell set's introduction folded into its internal link's frame; then one frame per link; the conclusion naming both end sets and the reason. The words are built from `Step.sets` and the links, so a single reads "r8c2 must be 1" and several "one of r4c9, r6c8 must be 7". The restricted common's frame names the drawn candidates. Group chains keep today's frames and sentences | One idea per frame: the locking idea before the chain uses it. The casual judge's folds keep a bivalue hinge to one frame (73 one-cell sets on the scanned XY-Wing paths) and name the arrow's ends. The worked sentences must come from the data: in the stored ALS-XZ, A holds 1 only in r8c2 and B holds 5 only in r7c8 |
| 18 | The legend | Shape words, no colour words: "squares joined by a bar: one of them is true, if <premise>"; "rings joined by a bar: none of them is true, if <premise>" (when a false group is drawn); "squares in a set: one of them is true, if <premise>"; "lettered cells: an almost locked set ..."; "bar: a group ..." where a bar is in the pattern's or the removal's ink; a set premise "if set A holds no 5". The 'one candidate of each group is true' entry and its pattern swatch go | The colour-free wording is the colour-blind reader's (both judges); the false-group line names a false group as one node (the solver judge's graft). An ALS start was worded "the first group", which is false for a set |
| 19 | Copy step | ALS-XZ, ALS-XY-Wing, ALS-XY-Chain and AIC with ALS: Eureka, every set of several cells in braces over all its cells, from set identity (consecutive links inside one set merge into one node); a one-cell set plain, `(4=6)r6c3`. Death Blossom: HoDoKu's line rebuilt from `Step.sets`. `hodokuLine` builds every ALS pattern's line from `Step.sets` with the board's letters (the XY-Wing's hinge C); `alsSets`, the guesser, is retired; `stepText` keeps its rule (Eureka where `eurekaOf` gives a line) | G24 makes every chain Eureka, and the spec's acceptance line asks for ALS in braces. Braces from identity also fix AIC with ALS's false strong links ("(3)r8c2 = (8)r78c1" becomes "(3=8){r7c1,r8c12}"); reading the sets fixes every wrongly named set the scans found |
| 20 | Data | `Step.sets` (kind `'group'` or `'als'`, cells, digits, members, unit, letter) and each link end's set (`fromSet`, `toSet`); `GNode.als` kept through the links; `checkSets` in src/engine/truth.ts holds every set and link to its rules over the corpora | 98 of 168 ALS digit nodes are box-line shaped, so shape cannot tell an ALS from a group; drawing, legend, walk and notation then read one object (G22). `members` and `unit` are the teaching design's (the tile and the words need a cell's candidates and the set's house); `checkSets` is HoDoKu's |
| 21 | The chain trainer | `buildable()` refuses any step with sets | It accepts the stored ALS-XZ, ALS-XY-Wing and Death Blossom today, whose restricted commons happen to be single candidates, and offers "Build it yourself" for chains it cannot build (a set's internal link) |
| 22 | Stored examples and Learn | AIC_GROUPED becomes `..5...2...7..14...6.........94..6..571.9.2.......3..8.......8..1..5...96.39.2..4.` at step 18, whose end group 8r89c6 is TRUE; GROUPED_NICE_LOOP becomes `.13.5......6...8.......34...2..6...5...2.1....39....6.68..7..2.1..8....4......9..` at step 10, a TRUE 7-group and a FALSE 9-group of three members on r1c9-r3c9; GROUPED_X_CYCLES keeps its false group, whose bar shows the point (a capsule would cover r2c4's 5); the ALS examples stay where they are, each a chain whose sets share no cell, and no example is hunted again for the overlap ban, which is dropped (decision 13). The ALS patterns' and Death Blossom's descriptions are rewritten with the letters, so the Learn page explains the removal without a walk | All three stored group examples show a false group, so no Learn page shows the common case or a group of three. Both swaps are first uses on their paths (checked), so `exampleFrom` makes them again. With no ban no stored path moves, so every ALS example keeps its position (the ban would have brought the AIC with ALS and Nishio examples a step earlier), and a Learn page never opens on a shared cell; the overlapping chains are held by the set fixture's named positions instead. The grouped chains' and AIC with ALS's descriptions are chain lines whose form phase 6 replaces for every chain at once (G24); their legends already explain the removal from the two ends |
| 23 | Proving nothing else moves | Data first, behind guards made before it: the drawing fixture split, the eight set techniques in their own file, rewritten only on purpose in a commit that names them, every other entry never rewritten, each path entry stored with its position so a solver change cannot move it; a path digest of every solve-path step's technique, placements and removals, and of the set techniques' menus | Phase 3's guard, sharpened. The digest proves the finders' data changes alter no conclusion; frozen positions keep any later solver change, as the colouring search orders were, from shifting the fixture. With the overlap ban dropped (decision 13) no solver change comes before phase 4 |
| 24 | Left out | WXYZ-Wing and Sue de Coq keep their role drawings (they stay in the untouched fixture); forcing chains' multi-candidate nodes are phase 5's; an Eureka line for Grouped X-Cycles rule 3 (weak first) is phase 6's; the trainer does not build groups or sets | Scope and the merge rule |

## Data

```ts
// src/engine/steps.ts
/** a node of several candidates a chain reads as one, or an almost locked set (docs/hint-drawing-sets.md) */
export interface ChainSet {
  /**
   * 'group': the 2-3 candidates of one digit in one box and one row or column,
   * all the digit has there: one node (TRUE: one of them; FALSE: none).
   * 'als': n cells of one house holding n+1 digits between them; each digit is
   * a node (the set's cells holding it), and without any one digit the others
   * fill the cells.
   */
  kind: 'group' | 'als';
  cells: number[];      // ascending
  digits: number[];     // ascending: a group's one digit, an ALS's n+1
  members: CellDigit[]; // every candidate of the set at the step's position, by cell then digit
  unit: number;         // the house the finder found it in (a UNITS index), for the words
  letter?: string;      // an ALS's name, 'A' to 'D' (HoDoKu's lettering); none for a group
}
export interface ChainLink {
  /* as today */
  /** the set each end is a node of (an index into Step.sets): a group, or one digit of an ALS (of one candidate too, so a link inside a set is known); absent for a lone candidate, and for AIC with ALS's one-cell "set", a bivalue cell */
  fromSet?: number;
  toSet?: number;
}
/** a link between two digits of one almost locked set: drawn as nothing (G12), carried by its tiles and its sentence */
export const insideSet = (l: ChainLink) => l.fromSet !== undefined && l.fromSet === l.toSet;
export interface Step {
  /* as today */
  /** the groups and almost locked sets the step's links pass through, or its pattern is made of */
  sets?: ChainSet[];
}
// src/engine/hintFrames.ts: Frame gains sets?: number[], a set frame's set, shown before any link reaches it
```

What each finder emits:

- **groupedAic.ts** (AIC_GROUPED, GROUPED_NICE_LOOP, AIC_ALS): `nodeCds`
  becomes an end builder that keeps `GNode.als` and the group's identity;
  `sets` lists each group node and each ALS of two or more cells on the
  path, once, in order of first appearance, the ALSs lettered A, B, ...;
  a one-cell ALS is a bivalue cell and gets no set. `alsLinkTexts` goes: the
  sentences come from `hintFrames.ts` reading the sets.
- **groupedXCycles.ts** (GROUPED_X_CYCLES): its groups as sets, ends
  indexed; rule 3's inversion is unchanged.
- **als.ts**, ALS_XZ (`alsXzStep`; WXYZ_WING returns before it, unchanged):
  `sets` [A, B]; links (z)A=(x)A {strong, fromSet 0, toSet 0}, (x)A-(x)B
  {weak, 0 to 1}, (x)B=(z)B {strong, 1 to 1}, where (d)S is S's cells
  holding d; `truth: 'derived'`; no primary, secondary, fins or labels;
  the description rewritten.
- ALS_XY_WING: `sets` [A, B, C] (C the hinge); links (z)A=(x)A, (x)A-(x)C,
  (x)C=(y)C, (y)C-(y)B, (y)B=(z)B; derived; no roles.
- ALS_XY_CHAIN: `sets` [A, B, C, D], neighbours disjoint, and A and C, A
  and D or B and D free to share cells, as in HoDoKu (decision 13);
  seven links, (z)A=(x1)A-(x1)B=(x2)B-(x2)C=(x3)C-(x3)D=(z)D; derived; no
  roles.
- DEATH_BLOSSOM: no `truth`; `sets` the petals A, B, C in stem-digit order;
  per stem digit p, (p)stem-(p)petal, a weak link marked `undirected` (a
  weak tie), and (p)petal=(z)petal, strong, inside the petal; secondary the
  stem's candidates and each petal's candidates of its stem digit, primary
  every petal's z, with new labels; the description rewritten.

No finder's search, eliminations, placements, technique or rating changes in
phase 4 (the path digest holds it), and no change before it moves a path:
the overlap ban is dropped (decision 13).

**truth.ts.** `Problem.issue` gains `emptyTrue` (above). `checkSets(step,
cands)` returns what is wrong with a step's sets, each a bug in its finder:
`shape` (a group not 2-3 candidates of one digit in one box and one line,
all of the digit there; an ALS not n cells of one house holding n+1 digits,
or its members not every candidate of its cells), `notMember` (a link end
not exactly its set's cells holding that one digit), `internal` (a link
inside one set that is weak, joins one digit, or is inside a group; a strong
link between two digits in different cells that is not inside one ALS), `notRestricted` (a
restricted common some candidate of which does not see every candidate of
that digit in the other set), `zNotSeen` (a removal that does not see every
z of both end sets, or of every petal), `overlap` (two sets sharing a
cell that the technique keeps apart: any two of an ALS-XZ, an ALS-XY-Wing
or a Death Blossom's petals, and an ALS-XY-Chain's neighbours; its other
pairs may share cells, decision 13), `letters` (letters not the
technique's convention). The derivation is unchanged: a set's internal
link is an ordinary strong link between two nodes.

**Marks and geometry.** In src/content/hintMarks.ts the `oneTrue` mark
becomes `oneOf` (the square) and `member` is added; `HintMarks` gains the
sets a frame draws, each with its style (`oneOf`, `false`, `primary`,
`elim`, or `als` with its tint); `premiseOf` returns a kind (`candidate`,
`group`, `set` with its letter and digit); `legendKinds` reports bars by
style, tiles, and squares in a set. In src/content/hintGeometry.ts
`setShapes(step, layout, marks)` returns the bars, tiles and tabs, worked
out once from the full view (G14); `arrowShapes`, `startMarkers` and
`badgePoints` take them as an optional argument, and a link with
`insideSet` has the shape `none`.

## Per technique

Every stored example below is redrawn from its puzzle; the frames are its
walk, the numbers on arrows and ties those of the frame that adds them.

- **AIC with Groups** (the new example, step 18: `(8=4)r1c2 - (4)r1c1 =
  (4)r7c1 - (4)r7c5 = (4-8)r8c5 = (8)r89c6 => r1c6<>8`): phase 2's truth
  from the first node's premise; the end group 8r89c6 is two "one of these"
  squares on a green bar down the gutter of column 6, the last solid arrow
  ending at r8c6's square, the member nearest r8c5; r1c6's 8 removed. Walk:
  today's frames and sentences ("Strong link on 8: if r8c5 is not 8, one of
  r8c6, r9c6 must be 8 (nowhere else for it)."), the squares and bar from
  the frame of that link, the last. Legend: remove; true and false, if the
  first candidate (by the small dot) is false; squares joined by a bar;
  arrows; start dot. Copy: Eureka, unchanged.
- **Grouped Nice Loop and Grouped X-Cycles, continuous** (the new example,
  `(7=9)r1c8 - (9)r123c9 = (9-8)r5c9 = (8-7)r9c9 = (7)r123c9 - loop`): the
  false 9-group is three rings on a blue bar and the true 7-group three
  squares on a green bar, on the same three cells, each bar in its own
  gutter: "one of these" beside "none of these". The stored Grouped
  X-Cycles keeps its false 2r23c4, whose bar passes beside r2c4's 5 and 8,
  not through them. Walk, legend (adding "rings joined by a bar") and Copy as
  today.
- **Discontinuous grouped loops** (48 Grouped Nice Loops and 7 Grouped
  X-Cycles place their start): the walk draws truth up to the closing link,
  groups as squares or rings on their bars, and the closing frame says the
  premise is impossible (G18). The full view and conclusion draw the proof
  as main does, groups as pattern discs on a pattern-ink bar. Legend: place,
  the loop's pattern label, "bar: a group ...".
- **Grouped X-Cycles rule 3** (fixture `.4...2.6.8.2.....51..4.8...4....1..7..5.7.6..3..5....4...1.9..66.....9.2.9.2...5.`
  at step 14): green squares on a green bar with the start dot ("one of these
  is true, if one candidate of the first group (by the small dot) is true"),
  then at the closing link blue rings on a blue bar ("So assuming one of
  r1c4, r1c5 is 9 rules them all out: that is impossible, so none of them is
  9."), then removals on a red bar. Copy: HoDoKu's form, as today.
- **AIC with ALS** (stored, step 22: `(8)r2c9 = (8)r2c8 - (8=9){r78c8} -
  (9)r6c8 = (9)r6c9 => r6c9<>8`): set A, tiles on r7c8 and r8c8 (sand), its
  8s false rings, its 9s "one of these" squares, its 4s members; no arrow
  inside A; a dashed arrow from r2c8's 8 into r7c8's 8 and one from the 9
  square nearest r6c8 to r6c8. Frames: link 1 (today's); set A ("Set A: the
  2 cells r7c8, r8c8 of column 8 hold only 4, 8 and 9: one digit more than
  cells. Without any one of these digits, the others fill the cells.", the house
  being the finder's); "If r2c8 is 8, set A holds no 8: every 8 of A sees
  r2c8."; "If set A holds no 8, its other 2 digits fill its 2 cells, so one
  of r7c8, r8c8 must be 9."; "If set A holds a 9, r6c8 cannot be 9: it sees
  every 9 of A."; link 5 (today's); the conclusion. Legend: remove; true and
  false; squares in a set; lettered cells; arrows; start dot. Copy: the
  stored line unchanged, and a set entered and left on different cells now
  braced, `(3=8){r7c1,r8c12}`.
- **AIC with ALS whose only set is one cell** (menu only): a plain AIC, the
  bivalue cell's ring and disc side by side, no tile, the bivalue sentence,
  `(2=6)r3c4`; the label kept (decision 14).
- **ALS-XZ** (stored, `...3...2..81...7..7..8.15..2....6.3.8...4...5.4.7....2..26.8..4..6...87..3...4...`
  at step 30: A r8c2 {159}, r9c1 {59}; B r7c8 {59}, r8c9 {19}; x 1, z 5).
  Full view: tiles A (sand) and B (rose); A's 5s false rings, the start dot
  by r8c2's; r8c2's 1 a true disc; a dashed arrow from it into r8c9's 1, a
  false ring; r7c8's 5 a true disc; the 9s members; r7c1's 5 removed. Six
  frames: set A; "If set A holds no 5, its other 2 digits fill its 2 cells,
  so r8c2 must be 1."; set B; "Every 1 of set A sees every 1 of set B: if
  r8c2 is 1, r8c9 cannot be 1." (arrow 4); "If set B holds no 1, its other 2
  digits fill its 2 cells, so r7c8 must be 5."; "Set A or set B holds a 5: if
  A holds none, B holds one. Each removed 5 sees every 5 of both. So 5 is
  removed from r7c1." Legend: remove; true, false, if set A holds no 5 (by
  the small dot); lettered cells; dashed arrow; start dot. Copy:
  `(5=1){r8c2,r9c1} - (1=5){r7c8,r8c9} => r7c1<>5`; its HoDoKu line
  (`hodokuLine`), `A=r8c2,r9c1 {159}, B=r7c8,r8c9 {159}, X=1, Z=5`.
- **ALS-XY-Wing** (stored, step 28: A r8c3, r8c8 {247}; C, the hinge, r6c3
  {46}; B r4c9, r6c8 {467}; x 4, y 6, z 7). Full view: tiles A (sand), B
  (rose), C (violet); r8c8's 7 a false ring with the start dot, r8c3's 4 a
  true disc; a dashed arrow into r6c3's 4 (a ring), r6c3's 6 a disc beside it
  (nothing drawn in the cell); a dashed arrow into r6c8's 6 (a ring); B's 7s
  at r4c9 and r6c8 "one of these" squares; the 2s and B's 4 members; r4c8's
  7 removed. Eight frames: set A; A's lock ("... so r8c3 must be 4."); "Every
  4 of set A sees every 4 of set C: if r8c3 is 4, r6c3 cannot be 4."; "Set C,
  the hinge, is the cell r6c3, which holds only 4 and 6: if it is not 4, it
  must be 6."; set B; "Every 6 of set C sees every 6 of set B: if r6c3 is 6,
  r6c8 cannot be 6."; "If set B holds no 6, its other 2 digits fill its 2
  cells, so one of r4c9, r6c8 must be 7."; "Set A or set B holds a 7 ... So 7
  is removed from r4c8." Copy: `(7=4){r8c38} - (4=6)r6c3 - (6=7){r4c9,r6c8}
  => r4c8<>7`; HoDoKu's line letters the hinge C, `A=r8c38 {247},
  B=r4c9,r6c8 {467}, C=r6c3 {46}, X,Y=4,6, Z=7`.
- **ALS-XY-Chain** (stored, `.5.1....789......6......45...25....8.87.1.52.9....71...78......6......412....6.9.`
  at step 27, four sets that share no cell: A r4c2, r4c7 {469}; B
  r1c7 {39}; C r1c5, r1c6 {239}; D r7c5 {49}; restricted commons 9, 3, 9; z
  4). Full view: tints by decision 8, a tab on every tile; r4c2's 4 a ring
  with the start dot, r4c7's 9 a disc, three dashed arrows between the sets,
  C's 3s two rings, D's 4 a disc; r4c5's 4 removed, between A's two tiles
  and covered by neither. Ten frames: set A, A's lock, the 9 link, set B
  folded into its lock ("Set B is the cell r1c7, which holds only 3 and 9: if
  it is not 9, it must be 3."), set C, the 3 link ("if r1c7 is 3, none of
  r1c5, r1c6 can be 3"), C's lock, the 9 link, set D folded into its lock,
  the conclusion ("Set A or set D holds a 4 ..."). Copy: `(4=9){r4c27} -
  (9=3)r1c7 - (3=9){r1c56} - (9=4)r7c5 => r4c5<>4`.
- **ALS-XY-Chain whose sets share cells** (124 of 211 on the paths,
  decision 13; named positions in the set fixture). One that derives,
  `.37.4......67.8...........972.....61..91.54..14.....856...........9.28......8.23.`
  at step 25 (A r7c7 {15}; B r2c7, r2c9 {235}; C r5c5, r5c9 {237}; D
  r7c5, r7c7 {157}, so A lies inside D; restricted commons 5, 2, 7; z 1):
  the derived chain, r7c7 A's tile with D's dashed outline inside it and
  both tabs, r7c5 D's tile (decision 6); r7c7's 1 a false ring with the
  start dot and its 5 a true disc; dashed arrows into r2c7's 5, r5c9's 2
  and r7c5's 7, false rings, with 2r2c9 and 7r5c5 true discs; D's 1s are
  r7c5's, a "one of these" square, and r7c7's, already a false ring; r7c6's
  1 removed. The walk as the stored chain's, A folded into its lock ("Set
  A is the cell r7c7, which holds only 1 and 5: if it is not 1, it must be
  5."), D's lock naming both its 1s ("... so one of r7c5, r7c7 must be
  1."), and the conclusion ("Set A or set D holds a 1 ..."). Copy:
  `(1=5)r7c7 - (5=2){r2c79} - (2=7){r5c59} - (7=1){r7c57} => r7c6<>1`.
  One that clashes,
  `..2....61...5.....7.4.....3.......3.42..3.9..3...9267..9.3...5.56.1.......3.8....`
  at step 15 (A r1c4, r4c4, r5c4, r6c4 {46789}; B r1c1 {89}; C r4c1, r4c3
  {689}; D r4c4, r6c4 {468}, inside A; restricted commons 9, 8, 6; z 8):
  D's 8s are A's, which the premise makes false (`emptyTrue`), so no frame
  draws a truth: D's tiles on r4c4 and r6c4 with A's dashed outlines inside
  them, A's tiles on r1c4 and r5c4, a tab on every tile and both on each
  shared cell, the sets' candidates members, three dashed arrows and
  r3c4's 8 removed; the legend names no truth; the walk tells the same
  frames in words. Copy:
  `(8=9){r1456c4} - (9=8)r1c1 - (8=6){r4c13} - (6=8){r46c4} => r3c4<>8`.
- **Death Blossom** (stored, `1.9..3.......9.5.....5.281.2..........18.....86.3...249.....1........63.5..76...8`
  at step 26: stem r8c9 {257}; petals A r9c7 {24}, B r8c5, r9c6 {145}, C
  r8c1 {47}; z 4). Full view: the stem's 2, 5 and 7 gold, no tile; tiles A,
  B, C in three tints; gold 2r9c7, 5r8c5 and 7r8c1; blue 4r9c7, 4r9c6 and
  4r8c1; B's other candidates members; three headless dashed ties,
  2r8c9-2r9c7, 5r8c9-5r8c5 and 7r8c9-7r8c1 (the last bent round the marks
  in its way along row 8); r9c2's and r9c3's 4 removed; no start dot, no truth. Six frames: "The stem r8c9 holds
  2, 5 and 7: one of them is true, and each has a petal."; "Petal A is the
  cell r9c7, which holds only 2 and 4, and its 2 sees the stem: if the stem
  is 2, r9c7 must be 4." (tie 2); petal B ("Petal B, for the stem's 5: the 2
  cells r8c5, r9c6 of box 8 hold only 1, 4 and 5: one digit more than cells,
  and every 5 of it sees the stem."); "If the stem is 5, petal B holds no 5,
  so its other 2 digits fill its 2 cells: r9c6 must be 4." (tie 4); petal C
  (tie 5); "Whichever digit the stem takes, a petal holds a 4. Each removed
  4 sees every 4 of every petal. So 4 is removed from r9c2, r9c3." Legend:
  remove; gold, "the stem's candidates, and each petal's digit the stem
  sees"; blue, "4 in every petal: whichever digit the stem takes, a petal
  holds a 4"; lettered cells, "a petal: an almost locked set for one of the
  stem's digits"; dashed line. Copy: `Death Blossom: [r8c9], -2- r9c7 {24},
  -5- r8c5,r9c6 {145}, -7- r8c1 {47} => r9c2<>4, r9c3<>4` (HoDoKu's form,
  SolutionStep.java:1220-1235).
- **WXYZ-Wing** (an ALS-XZ HoDoKu names apart, sharing its search): unchanged.

## Colours

New tokens, in src/content/hintPalette.ts (LIGHT, DARK, `CSS_VARS`) and both
blocks of src/ui/styles.css. LIGHT is the light and rose themes and Learn;
DARK is dark and forest. Measured with tests/colourScience.ts (worst model
over normal vision and the Machado, Brettel and Viénot protan, deutan and
tritan simulations), each tint composited at 0.5 over each theme's cell.

| Token | LIGHT | DARK | Shape |
| --- | --- | --- | --- |
| `--hint-one-of` (opaque) | #abe1ba (the true #57c274 at 0.5 over white), edge #006c2f | #296243 (#35a458 at 0.5 over #1c202e), edge #35a458 | rounded square 26 × 26, rx 7, edge 2 inside, keyline 1.5 (2 on a small board), digit `--hint-in-ring` |
| `--hint-set-1` (sand) fill / ink | #faea37 / #6b6000 | #474801 / #e6d27a | tile at `--hint-set-alpha`, outline and tab in the ink |
| `--hint-set-2` (rose) fill / ink | #bf5481 / #a3365f | #b4537b / #f0a0c0 | the same |
| `--hint-set-3` (violet) fill / ink | #8c56ff / #6a40d0 | #4020d0 / #c896ce | the same |
| `--hint-set-alpha` | 0.5 | 0.5 | |
| bar | the members' ink: true #006c2f, false #175bb7, pattern #175bb7, removal #bc072a | #35a458, #7fbbff, #498de5, #fe9696 | width 3 (4.5, 5.5), round caps, 15 off the members' line |
| tile outline | the set's ink | the same | 2.5 (4.5 under 600 CSS px, 5 under 330), stroked inwards |
| tab | the set's ink, letter `--cell-bg` | the same | 18 × 18, rx 4 (26 on a small board and in Learn), letter 13 (19) |

| | Light (white) | Rose theme | Dark | Forest |
| --- | --- | --- | --- | --- |
| tiles as drawn (sand, rose, violet) | #fdf59b, #dfaac0, #c6abff | #fdf39a, #dfa8bf, #c6a9fe | #323418, #683a55, #2e207f | #2f360e, #653c4b, #2b2275 |
| tints apart (sand-rose, sand-violet, rose-violet) | 15.6, 16.1, 15.3 | 15.5, 16.0, 15.3 | 16.4, 17.7, 14.0 | 16.5, 13.9, 18.2 |
| tints from the board | 9.4, 15.3, 15.8 | 8.3, 15.0, 15.7 | 9.3, 11.0, 11.1 | 8.1, 14.2, 9.6 |
| hint ink on the tints | 14.14, 8.05, 8.06:1 | 13.95, 7.93, 7.94 | 11.32, 7.99, 11.40 | about the same |
| hint ink on a tile over the player's colours, least | 5.25:1 | 5.25 | 4.01 (yellow; 3.68 today, so better) | 4.01 |
| set inks (and tab letters on them), least on any board or panel of the family | 6.04, 6.13, 6.12:1 | the same | 9.60, 7.27, 6.03:1 | the same |

- The "one of these" square: its digit 10.74:1 (light), 6.36:1 (dark); 11.6
  from the true disc in the light themes (Brettel tritan: shape carries it,
  square against disc, plus the bar or the tile) and 22.9 in the dark; 10.6
  and 11.3 from a false ring's inside; 20.8 and 22.8 from the pattern disc;
  13.5 (rose 13.4) and 19.8 (forest 17.7) from the board; 12.1-14.2 and
  12.2-13.6 from the tiles under it (forest rose 8.4, parted by the
  keyline). Over the player's own colours it is weak: 2.4 from their green
  in light, 1.9 from their red in dark, 2.8 from their blue in forest, where
  the true-ink edge and the keyline (2 units on a small board) carry it. It
  is 1.6 from light orange under protan vision; the two are never drawn
  together (a test holds it).
- Tiles over the player's colours nearly vanish in places (light sand on
  yellow 1.8, rose theme 1.6, dark rose on teal 0.6, forest rose on blue
  2.0), where the rose and violet outlines are 2.1-2.95:1 on their own tile:
  the tab carries the set there.
- Bars: 6.36:1 or more on the light boards, 4.78 (the pattern ink) to 8.03
  on the dark ones; every bar ink 21.5 or more from the arrow ink. A true
  bar and a false bar are 4.0 apart in the light themes (12.1 in the dark);
  the squares and rings on them part them by shape.
- Pairs that never share a step or lean on shape: the light violet ink and
  the false blue (3.3, an outline and a tab never take a ring's shape); the
  sand ink and the acts-through ink (0.2 under deutan vision: inks are never
  named); the gold disc on the light rose tint (6.8-7.0; its keyline and its edge,
  3.26-3.31:1, carry it, and only Death Blossom draws gold on a tile); the violet
  tile and the colouring's purple shades (3.0 as areas: sets and colourings
  never share a step, a test holds it, and the spec's "purple and orange are
  a colouring's alone" becomes "purple and orange discs").
- Legend swatches: a small tile in its tint over `--panel` with its tab
  (7.1-15.8 from every panel), two squares on a green bar, two rings on a
  blue bar, a bar alone in the pattern's or the removal's ink, or one of
  each, the pattern's above, where a view draws both (rule 3's full view);
  a cell of two sets as the small tile of the set whose tile it carries,
  with the other set's outline dashed inside it, in their tints and inks.

## The walk and its words

`linkText(link, step)` builds every set sentence from `Step.sets`; no finder
writes one, and the generic "Strong link: if ..." can never be reached for
a link inside a set. `{L}`, `{M}` are letters; `{cells}` a list of cells,
`{digits}` a list of digits with the language's "and"; `{house}` the set's
unit as `unitName` names it (box 7, boks 7, caja 7). Each line is one
template; a variant is its own template, never a glued fragment
(docs/translations.md). Norwegian is plain bokmål as `nb.ts` writes it
(mengde, rute, kronblad, stamme, hengsel, as the locale already says them);
Spanish as `es.ts` (conjunto, casilla, pétalo, tallo, bisagra). A
template's "a {z}" is the digit with its article, which English writes
"a 5" but "an 8" (`aDigit` in src/engine/text.ts, its own template in each
language: en 8, un 8), so the sentence's template reads "holds {z}".

| Frame | en | nb | es |
| --- | --- | --- | --- |
| set of several cells | Set {L}: the {n} cells {cells} of {house} hold only {digits}: one digit more than cells. Without any one of these digits, the others fill the cells. | Mengde {L}: de {n} rutene {cells} i {house} har bare {digits}: ett tall mer enn ruter. Mangler ett av dem, uansett hvilket, fyller de andre tallene rutene. | Conjunto {L}: las {n} casillas {cells} de la {house} solo tienen {digits}: un número más que casillas. Sin uno cualquiera de ellos, los demás llenan las casillas. |
| the same, the XY-Wing's hinge | Set {L}, the hinge: the {n} cells ... | Mengde {L}, hengselet: de {n} rutene ... | Conjunto {L}, la bisagra: las {n} casillas ... |
| a set's lock, one exit | If set {L} holds no {a}, its other {n} digits fill its {n} cells, so {cell} must be {b}. | Hvis mengde {L} ikke har noen {a}, fyller de {n} andre tallene de {n} rutene, så {cell} må være {b}. | Si el conjunto {L} no tiene ningún {a}, sus otros {n} números llenan sus {n} casillas, así que {cell} debe ser {b}. |
| a set's lock, several | ..., so one of {cells} must be {b}. | ..., så en av {cells} må være {b}. | ..., así que una de {cells} debe ser {b}. |
| a one-cell set, folded | Set {L} is the cell {cell}, which holds only {a} and {b}: if it is not {a}, it must be {b}. | Mengde {L} er ruten {cell}, som bare har {a} og {b}: er den ikke {a}, må den være {b}. | El conjunto {L} es la casilla {cell}, que solo tiene {a} y {b}: si no es {a}, debe ser {b}. |
| the same, the hinge | Set {L}, the hinge, is the cell {cell}, ... | Mengde {L}, hengselet, er ruten {cell}, ... | El conjunto {L}, la bisagra, es la casilla {cell}, ... |
| restricted common | Every {x} of set {L} sees every {x} of set {M}: if {from} is {x}, {to} cannot be {x}. | Hvert {x}-tall i mengde {L} ser hvert {x}-tall i mengde {M}: hvis {from} er {x}, kan {to} ikke være {x}. | Cada {x} del conjunto {L} ve cada {x} del conjunto {M}: si {from} es {x}, {to} no puede ser {x}. |
| the same, several at either end | ... if one of {cells} is {x}, ... / ... none of {cells} can be {x}. | ... hvis en av {cells} er {x}, ... / ... kan ingen av {cells} være {x}. | ... si una de {cells} es {x}, ... / ... ninguna de {cells} puede ser {x}. |
| into a set (AIC with ALS) | If {cell} is {x}, set {L} holds no {x}: every {x} of {L} sees {cell}. | Hvis {cell} er {x}, har mengde {L} ingen {x}: hvert {x}-tall i {L} ser {cell}. | Si {cell} es {x}, el conjunto {L} no tiene ningún {x}: cada {x} de {L} ve {cell}. |
| the same, from a group | If one of {cells} is {x}, set {L} holds no {x}: every {x} of {L} sees all of them. | Hvis en av {cells} er {x}, har mengde {L} ingen {x}: hvert {x}-tall i {L} ser alle disse. | Si una de {cells} es {x}, el conjunto {L} no tiene ningún {x}: cada {x} de {L} las ve todas. |
| out of a set | If set {L} holds a {x}, {cell} cannot be {x}: it sees every {x} of {L}. | Hvis mengde {L} har en {x}, kan {cell} ikke være {x}: ruten ser hvert {x}-tall i {L}. | Si el conjunto {L} tiene un {x}, {cell} no puede ser {x}: ve cada {x} de {L}. |
| the same, into a group | If set {L} holds a {x}, none of {cells} can be {x}: they see every {x} of {L}. | Hvis mengde {L} har en {x}, kan ingen av {cells} være {x}: de ser hvert {x}-tall i {L}. | Si el conjunto {L} tiene un {x}, ninguna de {cells} puede ser {x}: ven cada {x} de {L}. |
| conclusion (the three patterns), before today's "So ... is removed" | Set {F} or set {L} holds a {z}: if {F} holds none, {L} holds one. Each removed {z} sees every {z} of both. | Mengde {F} eller mengde {L} har en {z}: har {F} ingen, har {L} en. Hvert {z}-tall som fjernes, ser alle {z}-tallene i begge. | El conjunto {F} o el conjunto {L} tiene un {z}: si {F} no tiene ninguno, {L} tiene uno. Cada {z} eliminado ve todos los {z} de ambos. |
| the conclusion of an ALS-XY-Chain whose chain clashes (decision 13; its last set {L} holds z only in cells of its first, {F}), one cell, as an `inFalseGroup` | Set {L} holds {z} only in {cell}, a cell of set {F}: if {F} holds no {z}, {cell} must be {z}, and {F} holds one after all. {F} cannot lack a {z}, so set {F} holds a {z}. Each removed {z} sees every {z} of {F}. | Mengde {L} har {z} bare i {cell}, og den ruten hører til mengde {F}: har {F} ingen {z}, må {cell} være {z}, og da har {F} likevel en. {F} kan ikke mangle en {z}, så mengde {F} har en {z}. Hvert {z}-tall som fjernes, ser alle {z}-tallene i {F}. | El conjunto {L} solo puede tener el {z} en {cell}, una casilla del conjunto {F}: si {F} no tiene ningún {z}, {cell} debe ser {z}, y {F} tiene uno después de todo. {F} no puede quedarse sin un {z}, así que el conjunto {F} tiene un {z}. Cada {z} eliminado ve todos los {z} de {F}. |
| the same, several cells (`emptyTrue`) | Set {L} holds {z} only in {cells}, cells of set {F}: if {F} holds no {z}, one of these cells must be {z}, ... | Mengde {L} har {z} bare i {cells}, og de rutene hører til mengde {F}: har {F} ingen {z}, må en av disse rutene være {z}, ... | El conjunto {L} solo puede tener el {z} en {cells}, casillas del conjunto {F}: si {F} no tiene ningún {z}, una de esas casillas debe ser {z}, ... |
| the same, all of the first set's (a closure) | Set {L} holds {z} only in {cells}, the very cells set {F} holds it in, so the chain comes back to {F}: if {F} holds no {z}, one of these cells must be {z}, ... | Mengde {L} har {z} bare i {cells}, akkurat der mengde {F} har {z}-tallene sine, så kjeden kommer tilbake til {F}: ... | El conjunto {L} solo puede tener el {z} en {cells}, justo donde puede tenerlo el conjunto {F}, así que la cadena vuelve a {F}: ... |
| Death Blossom: the stem | The stem {cell} holds {digits}: one of them is true, and each has a petal. | Stammen {cell} har {digits}: ett av dem er sant, og hvert har et kronblad. | El tallo {cell} tiene {digits}: uno de ellos es verdadero, y cada uno tiene un pétalo. |
| a petal of several cells | Petal {L}, for the stem's {p}: the {n} cells {cells} of {house} hold only {digits}: one digit more than cells, and every {p} of it sees the stem. | Kronblad {L}, for stammens {p}: de {n} rutene {cells} i {house} har bare {digits}: ett tall mer enn ruter, og hvert {p}-tall i kronbladet ser stammen. | Pétalo {L}, para el {p} del tallo: las {n} casillas {cells} de la {house} solo tienen {digits}: un número más que casillas, y cada {p} suyo ve el tallo. |
| its branch, one exit (several: "one of {cells}") | If the stem is {p}, petal {L} holds no {p}, so its other {n} digits fill its {n} cells: {cell} must be {z}. | Hvis stammen er {p}, har kronblad {L} ingen {p}, så de {n} andre tallene fyller de {n} rutene: {cell} må være {z}. | Si el tallo es {p}, el pétalo {L} no tiene ningún {p}, así que sus otros {n} números llenan sus {n} casillas: {cell} debe ser {z}. |
| a one-cell petal, folded | Petal {L} is the cell {cell}, which holds only {p} and {z}, and its {p} sees the stem: if the stem is {p}, {cell} must be {z}. | Kronblad {L} er ruten {cell}, som bare har {p} og {z}, og {p}-tallet der ser stammen: hvis stammen er {p}, må {cell} være {z}. | El pétalo {L} es la casilla {cell}, que solo tiene {p} y {z}, y su {p} ve el tallo: si el tallo es {p}, {cell} debe ser {z}. |
| Death Blossom: conclusion | Whichever digit the stem takes, a petal holds a {z}. Each removed {z} sees every {z} of every petal. | Uansett hvilket tall stammen får, har et kronblad en {z}. Hvert {z}-tall som fjernes, ser alle {z}-tallene i alle kronbladene. | Tome el tallo el número que tome, algún pétalo tiene un {z}. Cada {z} eliminado ve todos los {z} de todos los pétalos. |

Legend lines (each premise ending is today's, or the set's):

| Entry | en | nb | es |
| --- | --- | --- | --- |
| squares on a bar | squares joined by a bar: one of them is true, if {premise} | firkanter forbundet med en bjelke: én av dem er sann hvis {premise} | cuadrados unidos por una barra: uno de ellos es verdadero si {premise} |
| rings on a bar | rings joined by a bar: none of them is true, if {premise} | ringer forbundet med en bjelke: ingen av dem er sann hvis {premise} | anillos unidos por una barra: ninguno de ellos es verdadero si {premise} |
| squares in a set | squares in a set: one of them is true, if {premise} | firkanter i en mengde: én av dem er sann hvis {premise} | cuadrados en un conjunto: uno de ellos es verdadero si {premise} |
| a bar alone (both inks where both are drawn) | bar: a group (one digit's cells in one box and one row or column), read as one node | bjelke: en gruppe (rutene til ett tall i én boks og én rad eller kolonne), lest som én node | barra: un grupo (las casillas de un número en una caja y una fila o columna), leído como un solo nodo |
| tiles | lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells | ruter med bokstav: en nesten låst mengde, ett tall mer enn ruter; mangler ett av tallene, fyller de øvrige tallene rutene | casillas con letra: un conjunto casi bloqueado, un número más que casillas; sin uno cualquiera de sus números, los demás llenan sus casillas |
| tiles, Death Blossom | lettered cells: a petal, an almost locked set for one of the stem's digits | ruter med bokstav: et kronblad, en nesten låst mengde for ett av stammens tall | casillas con letra: un pétalo, un conjunto casi bloqueado para uno de los números del tallo |
| a set premise | true, if set {L} holds no {a} (by the small dot) | sann hvis mengde {L} ikke har noen {a} (ved den lille prikken) | verdadero si el conjunto {L} no tiene ningún {a} (junto al punto pequeño) |
| Death Blossom, gold | the stem's candidates, and each petal's digit the stem sees | stammens kandidater, og tallet i hvert kronblad som stammen ser | los candidatos del tallo, y el número de cada pétalo que el tallo ve |
| the same, where no petal's digit is drawn yet (the stem's frame) | the stem's candidates | stammens kandidater | los candidatos del tallo |
| a cell of two sets (decision 6), where a view draws one | dashed outline: a cell of two sets; each tab names one | stiplet ramme: en rute i to mengder; hver bokstav står for én av dem | contorno discontinuo: una casilla de dos conjuntos; cada letra nombra uno de ellos |
| Death Blossom, blue | {z} in every petal: whichever digit the stem takes, a petal holds a {z} | {z} i hvert kronblad: uansett hvilket tall stammen får, har et kronblad en {z} | el {z} de cada pétalo: tome el tallo el número que tome, algún pétalo tiene un {z} |

The bar is "bjelke" and "barra", never "strek" or "línea", which are phase
3's tie line. The new descriptions follow the walk's words; the ALS-XZ one
reads "ALS-XZ: sets A (r8c2, r9c1) and B (r7c8, r8c9) each hold one digit
more than they have cells, and every 1 of A sees every 1 of B, so at most
one of them keeps a 1. The other loses its 1, its other digits fill its
cells, and it holds a 5: A or B holds a 5, so 5 is removed from every cell
that sees every 5 of both." The XY-Wing's says the hinge C holds 4 or 6 and
so takes one of them from a wing; the XY-Chain's that each set in turn
loses its link digit and fills up; Death Blossom's that whichever digit the
stem takes, its petal loses it and holds the z. Each has its nb and es with
it, and one template per number of petals.

## How it is checked

- **Nothing else moves.** tests/drawingSnapshot.test.ts splits its fixture:
  tests/fixtures/drawingSnapshot.json keeps every drawing outside the eight
  set techniques (53 examples and 45 path entries), each path entry with its
  position so a solver change cannot move it, and is rewritten once, in
  stage 1, with a check that every drawing in it is byte-identical to
  main's, never again in phase 4; tests/fixtures/setDrawings.json holds the
  set techniques, rewritten only by `DRAWING_SNAPSHOT=write-sets` in a
  commit that names them. tests/pathDigest.test.ts holds every solve-path
  step's technique, placements and removals (practice pools, seeds, the six
  hard puzzles, the examples' puzzles) and the set techniques' first finds at
  every path position of the pools and seeds, from stage 1 to the end.
- **The data.** tests/chainSets.test.ts runs `checkSets` and the set
  invariants (every end of a derived step with several candidates carries a
  set of its kind; letters unique and in the technique's convention; one-cell
  ALSs of AIC with ALS carry no set) over the examples, the pools' and seeds'
  paths and menus, the hard paths and a `findAllSteps` sample.
- **The logic.** tests/truth.test.ts: the three patterns join `OPEN`; a
  strong link inside an ALS is valid where `Step.sets` says so; over every
  corpus each derived ALS step either derives cleanly (no problem, no
  closure, no `emptyTrue`), every removal conflicting with both ends, or,
  when its derivation has a problem, a closure or an `emptyTrue`, draws no
  truth (decision 13); the test counts both (on the paths today, of 211
  ALS-XY-Chains 155 clean and 56 without truth) and holds that only an
  ALS-XY-Chain whose sets share a cell takes the second, so every ALS-XZ,
  ALS-XY-Wing and AIC with ALS step and every chain of four separate sets
  derives cleanly; each Death Blossom branch derives from its two
  links (the stem's digit true, the petal's z true) and every removal
  conflicts with every branch end; the solution check finds no strong link
  without a true end and no weak link with two.
- **The marks.** A true node of several candidates is "one of these"
  squares, or, where a node of one candidate already makes one of its
  candidates true, that disc and false rings for the others, never a disc
  beside squares; under a premise that holds in the solution every disc is
  true there, every ring false, and a node's squares hold its true
  candidate; a walk frame draws only what the links it has drawn prove,
  and a chain whose nodes share no candidate draws each frame as before
  (tests/hintMarks.test.ts, over the set examples, the set fixture and the
  review's shared-cell positions); a bar's ink is its members' mark;
  rule 3 is squares, rings, removals in turn; no primary, secondary or fin
  mark in a derived ALS step;
  no gold or pattern-blue disc beside a truth mark in any frame; Death
  Blossom draws no truth in any frame, nor does an ALS pattern whose
  derivation clashes, whose legend names no truth; sets and colourings
  never share a step; tints follow decision 8.
- **The geometry**, over the examples, both fixtures and the cached grouped
  chains: no arrow crosses a bar except at its anchoring member (strict:
  none); no bar crosses a shown glyph; an arrow ends at a square's exact
  reach plus the gap at eight angles; no arrow for a link inside a set;
  every tile holds only its cell's candidates and keeps 3 units off a box
  line on every board; a cell in two sets draws the smaller set's tile and
  the other's dashed outline inside it, never a cell in three, and every
  set keeps a filled tile on at least one cell, a set inside another
  included; every tab sits on a free place with its room at a
  phone's size, off every dot, number and head; a step with no sets is laid
  out exactly as before. (Over the maps' cached grouped chains two arrows
  are forced across a bar: As built.)
- **The words.** tests/setWords.test.ts: every set is introduced by one
  frame before any frame that reaches it, a one-cell set by its internal
  link's; no set technique reaches the generic sentence; no ALS sentence or
  legend says "group"; the letters a sentence names are drawn in its frame;
  the legend names only what the frame draws, and the app's and Learn's
  legends agree. tests/i18n.test.ts: every new template in nb and es.
- **The notation.** tests/eureka.test.ts: braces over the whole set from its
  identity; the stored AIC with ALS line unchanged and `(3=8){r7c1,r8c12}`
  added; the three patterns in Eureka; each HoDoKu line naming exactly
  `Step.sets` with the board's letters, on the four positions the maps found
  wrong (`...3...2..81...7..` step 32, `1.9..3.......9.5...` step 22,
  `1..6732..6....2...` step 28, `......4...5...9.3.2.93...` step 28).
- **The palette** (tests/hintPalette.test.ts): the numbers above as floors in
  all four themes; hint ink 4.5:1 or more on each tint and never below
  min(4.5, today) over the player's colours; inks and tab letters 4.5:1 or
  more on board and panel; CSS equal to the palette.
- **The trainer** (tests/chainTrainer.test.ts): `buildable()` false for every
  step with sets.
- **The browser** (tests/e2e/smoke.spec.ts, in both font setups): an ALS-XZ
  walk (six frames, two tiles, two tabs, one dashed arrow, a start dot, no
  arrow inside a set), a grouped chain's squares and bar, Death Blossom's
  three headless ties and no start dot, and two ALS-XY-Chains whose sets
  share a cell (Per technique): the one that derives (A's tile and D's
  dashed outline on r7c7 with both tabs, its truth drawn) and the one that
  clashes (tiles, tabs, arrows and the removal, no truth mark, the legend
  naming no truth), on desktop and a phone.
- **Review rounds** as in the handoff, on screenshots of every set example
  and the set fixture's named positions (the true group, the Grouped Nice
  Loop pair, the gapped group over a solved cell at
  `.1.........7.....1.9...32.51..58...9......76....9......54.......2.81.5.......98.7`
  step 20, rule 3, the short link of `..652....32.8...6..9.76.1.....39...8....5..3.1.26....9......5.4.5.....8...9....21`
  step 16, an XY-Wing whose wings touch at `..8.....1.61.9.......7..5...7.5....431..8..756....3.8...3..6.......4.23.1.....8..`
  step 33, a two-digit stem, the two ALS-XY-Chains whose sets share a cell
  from Per technique and the other two kinds of clash, `inFalseGroup` at
  `7..1.4..9....694....25.....56.....1...4...7...1.....24.....69....591....3..2.5..6`
  step 29 and a closure at
  `..9.2..6....56........714..3.......6.5...2.98..4...5..4.........3.7..1....7.5..32`
  step 16) in all four themes, on a desktop
  and a phone, walk frames included, and over the player's own cell colours
  under the tiles and the squares.

## Stages

There is no stage before phase 4: the overlap ban once planned there is
dropped (decision 13), so phase 4's branch starts from main as it is.
Every commit below is green on its own: `npx tsc -b`, the whole
`npx vitest run`, `npm run build`; the browser tests run at every stage
that changes the board. The branch merges to main whole, after its review
rounds, as phase 3 did; stage 6 shows the patterns' tiles beside their old
role discs until stage 8, on the branch only.

1. **Data only**, in two commits.
   1. *The guards* (tests only; nothing in src changes): the fixture split
      with frozen positions in tests/drawingSnapshot.test.ts,
      tests/fixtures/drawingSnapshot.json rewritten once with positions and
      without the set techniques (a scratch check that each drawing left is
      byte-identical to main's), tests/fixtures/setDrawings.json with the
      eight techniques' examples and path entries, every set step on offer
      along the hard paths whatever its truth, and the named positions; the
      `write-sets` flag and a test that the other file holds no set
      technique; tests/pathDigest.test.ts and tests/fixtures/pathDigest.json.
   2. *Sets in the data* (no drawing changes): src/engine/steps.ts
      (`ChainSet`, `Step.sets`, `fromSet`, `toSet`, `insideSet`);
      src/engine/techniques/groupedAic.ts (`GNode.als` kept, groups and ALSs
      of two or more cells as lettered sets, ends indexed; links and texts
      unchanged); src/engine/techniques/groupedXCycles.ts (its groups);
      src/engine/techniques/als.ts (the four patterns' sets with HoDoKu's
      letters and set indices on their existing links; Death Blossom's
      petals); src/engine/truth.ts (`emptyTrue`, `checkSets`);
      `npx vite-node scripts/hunt-examples.ts refresh` (new fields only).
      Tests: tests/chainSets.test.ts (new), tests/truth.test.ts (a synthetic
      `emptyTrue` chain, none in the batch), tests/examples.test.ts. Both
      fixtures and the digest unchanged.
2. **The trainer refuses sets**: src/engine/chainTrainer.ts `buildable()`;
   tests/chainTrainer.test.ts extends "no chain through a group" to the ALS
   family. A behaviour change, named in its commit.
3. **Notation from the sets**: src/content/eureka.ts (`eurekaOf` merges the
   links inside one set and braces the whole set; `hodokuLine` from
   `Step.sets`, Death Blossom in HoDoKu's form; `alsSets` retired).
   tests/eureka.test.ts (the pins at 37-39, 62-75 and 101-106, the four
   wrong lines, the braced hop). Fixtures unchanged.
4. **The palette**: src/content/hintPalette.ts (`oneOf`, `set1`-`set3`,
   their inks, `setAlpha`, the sizes) and src/ui/styles.css (both blocks, the
   small-board widths, the swatches); tests/hintPalette.test.ts. Nothing
   draws them yet: fixtures unchanged.
5. **Groups on the board**: src/content/hintMarks.ts (`oneOf` for `oneTrue`,
   the groups' styles per frame, `premiseOf` kinds, `legendKinds`);
   src/content/hintGeometry.ts (bars and their side, the exact square reach,
   bars as obstacles with the anchoring member's exemption);
   src/ui/boardLayout.ts; src/ui/Grid.tsx (the square, the bar layer under
   the digits' mask, `MARK_FILL.oneTrue` gone); src/content/boardSvg.ts (the
   same, `legendOf`, `swatchStyle`, `truthWords`); src/ui/HintPanel.tsx;
   src/content/locales/engine.nb.ts, engine.es.ts, ui.nb.ts, ui.es.ts;
   src/content/examples.json (the AIC_GROUPED and GROUPED_NICE_LOOP swaps,
   refreshed). setDrawings.json rewritten for the four grouped techniques.
   Tests: tests/hintMarks.test.ts (150-151, 207-263), tests/gridDrawing.test.ts
   (97-107), tests/hintGeometry.test.ts (151-156 at the square's reach; the
   side rule; the strict bar test), tests/examples.test.ts (counts by class;
   a TRUE group and groups of three), tests/colouring.test.ts and
   tests/parityDrawing.test.ts (`oneTrue` in their lists), tests/i18n.test.ts,
   tests/e2e/smoke.spec.ts (new: a grouped chain's squares and bar).
6. **ALS tiles and tabs**: src/content/hintGeometry.ts (tiles, tabs and
   their room, the shared cell with the smaller set's tile, tabs as
   obstacles, nothing drawn for a link inside a set, the start dot of a set
   start); src/content/hintMarks.ts (`member`, the tints, a set drawn from
   the frame that first reaches it, "lettered cells"); src/ui/Grid.tsx and
   src/content/boardSvg.ts (the tile layer after the bands, tabs after the
   removal bars, members in the ring ink); src/ui/HintPanel.tsx (the tile
   swatch). setDrawings.json rewritten for AIC with ALS and the four
   patterns. Tests: tests/hintGeometry.test.ts (tiles, tabs, no arrow
   inside a set, a set inside another), tests/hintMarks.test.ts,
   tests/gridDrawing.test.ts, tests/examples.test.ts, a test that sets and
   colourings never share a step.
7. **The set walk and its words**: src/engine/hintFrames.ts (set frames,
   `linkText` from the sets, one-cell sets folded); groupedAic.ts's
   `alsLinkTexts` retired; src/content/hintMarks.ts (`Frame.sets`, the set
   premise); the legends in src/ui/HintPanel.tsx and src/content/boardSvg.ts;
   the four locale files. setDrawings.json rewritten for AIC with ALS. Tests:
   tests/setWords.test.ts (new), tests/i18n.test.ts, tests/hintMarks.test.ts,
   tests/alsaic.test.ts.
8. **The ALS patterns as chains, and Death Blossom**: src/engine/techniques/als.ts
   (the three patterns' AIC with their internal links, `truth: 'derived'`, no
   roles, new descriptions; Death Blossom's roles, labels, weak ties and
   branch links, new description); src/engine/hintFrames.ts (the patterns'
   conclusion, Death Blossom's frames); src/content/hintMarks.ts (no truth for
   an ALS pattern whose derivation has a problem, a closure or an
   `emptyTrue`; Death Blossom's marks); src/content/hintGeometry.ts (weak
   ties outside a colouring); the four locale files; examples refreshed.
   setDrawings.json rewritten for the four patterns. Tests:
   tests/truth.test.ts (`OPEN`, the internal links, every corpus clean or
   drawn without truth and both counted, Death Blossom's branches),
   tests/hintMarks.test.ts (113-118 rewritten; no roles beside truth; Death
   Blossom without truth), tests/eureka.test.ts (the three patterns in
   Eureka), tests/setWords.test.ts, tests/alsaic.test.ts,
   tests/examples.test.ts, tests/e2e/smoke.spec.ts (the ALS-XZ walk, Death
   Blossom, the two ALS-XY-Chains whose sets share a cell).
9. **Screenshots and the spec**: scripts/hint-shots.cjs gains an option
   that paints the player's own colours under a hint's cells, and with
   scripts/hint-gallery.ts photographs every set example and named position
   (four themes, desktop and phone, `WALK=1` and `PANEL=1`, with and without
   the player's colours); docs/hint-drawing.md (the rules as built, the
   Status) and docs/hint-drawing-handoff.md. Then the review rounds, and the
   merge when nothing is high, medium, false or regressed.

The path digest and drawingSnapshot.json never change after stage 1.

## As built

Phase 4 was built in the nine stages above, each commit green on its own;
the commits are listed in the spec's Status. Where the build met a case
the design left open, or a number it did not reach, it settled it as
below, each held by a test (tests/hintGeometry.test.ts, setWords,
hintMarks, i18n), and the decisions it refines point here.

- **A set with no filled tile** (decision 6). The smaller set's tile left
  a set with no filled tile in 8 of the set fixture's 16 ALS-XY-Chains
  along the hard paths, where equal sizes tie or every cell of a set lies
  in smaller sets (the maps had found none among their 211 path chains).
  At `4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......`
  after 3 steps, A (r7c1, r7c3, r8c2, r9c2) lies in C (r7c1, r7c3) and D
  (r7c2, r8c2, r9c2). Such a set takes the first of its cells whose set
  keeps another tile, there r7c1 from C, which keeps r7c3, so every set
  shows its tint wherever the cells allow (`tilesIn` in
  src/content/hintGeometry.ts). A chain of more sets than cells cannot: at
  `52...6.........7.13...........4..8..6......5...........418.........3..2...87.....`
  after 3 steps an ALS-XY-Chain puts four sets on three cells (A r7c1,
  r9c1; B r8c1; C r9c1; D r7c1, r8c1), and D shows only its dashed
  outlines and its two tabs; of the steps the fixtures keep, it is the
  only one left so.
- **Where a tab goes** (decision 7). The tabs are placed against the
  drawing the hint has without them: they keep off its heads, start dots
  and walk numbers, and of the free places one off the lines its arrows
  take comes first, so no arrow bends for a tab where a place allows (the
  stored ALS-XZ's arrow stays straight); the arrows, dots and numbers are
  then worked out again round the tabs (`hintDrawing`). The places beside
  a tile are taken nearest first, so a tab never floats two places off
  its tile when one next to it is free.
- **The Learn tile's outline** (decision 5). Half again the app's is
  under 1.5 CSS px on a phone's 350 px diagram, so the Learn diagrams
  draw it 1.65 times the app's (`TILE` in src/content/boardSvg.ts), as
  they draw the removal bar 1.85 times.
- **No start dot for a clash** (decision 13). An ALS pattern whose chain
  clashes words no premise and draws no truth, so no dot says where a
  reading starts: it has none, in any view (`hintDrawing`, `alsClash`).
- **Start dots and bars** (decision 4). A start dot keeps off every bar,
  its own group's too, the whole of it: an arrow is free of its own bar
  only beside the member it is anchored at, a dot nowhere, so a dot never
  sits on the bar of the group it opens.
- **Arrows over bars** (How it is checked). No arrow crosses a bar but
  beside its anchoring member, strictly, over the stored examples and
  both fixtures. Over 357 grouped steps (those, and every grouped step on
  offer at the positions of the maps' 577 cached grouped chains; 437
  bars, about 2,480 pairs of an arrow and a bar), two arrows still meet a
  bar where no drawing clears it. At
  `2..49..6....7.6583..6.5.......3...........418.94.1....6.....7.4.....7.9.45.9.....`
  after 23 steps, a Grouped Nice Loop on offer, whose weak link
  5r4c9-5r8c9 runs down column 9 a unit from the end of the bar under
  6r6c79, which spans r6c7 to r6c9, with r6c9's 6 and the board's edge
  closing the way round on the right. At
  `....5.8.91.5......8..76...4..754.9.8......3...81...56..1.8.......9......7..31.6..`
  after 11 steps, an AIC with ALS on offer, whose first link
  7r1c2=7r1c8 runs along row 1 across the bar beside 3r13c3, which runs
  down column 3 from r1c3 to r3c3: the only ways past are over its top
  member at the board's edge or below row 3. Neither is a solve path's
  step.
- **Death Blossom's legend and walk** (decision 15). The legend keeps its
  role order: remove; blue ("4 in every petal: whichever digit
  the stem takes, a petal holds a 4"); gold ("the stem's candidates, and
  each petal's digit the stem sees"); lettered cells ("a petal, an almost
  locked set for one of the stem's digits"); and its ties in the words of
  a colouring's weak tie, "dashed line: its two ends see each other, so
  at most one is true". The stem's candidates are drawn gold from the
  walk's first frame on, through a walk part of their own, `stem`
  (src/engine/hintFrames.ts `Part`), so each branch's frame shows the
  stem beside its petal. A one-cell petal names its two digits in order,
  as a one-cell set does ("Petal C is the cell r8c1, which holds only 4
  and 7, and its 7 sees the stem").
- **Words the table did not give** (decision 17). A one-cell set lists
  its two digits in order ("Set B is the cell r1c7, which holds only 3 and
  9: if it is not 9, it must be 3."). An AIC with ALS can link a set's
  digit that only one of its cells holds to another digit of that cell, a
  candidate's or another set's; three templates say so ("If r6c5 is 2,
  set A holds no 4: the only 4 of A is in r6c5."). English writes "an 8"
  where a template has "a {z}" (The walk and its words).
