# Phase 4, review round 2: the findings

Round 2 (a confirmation round, five lenses: logic, words, design, code, regression; two refuting skeptics on each
blocking claim) reviewed main at 0600b2e, phase 4 merged with round 1 fixed. It found one medium, a regression
against main, and ten lows. Fixing paused on 30 October 2026 (the week's budget); resume from here.

Plan: one geometry fix (M1, L-arrows, L-tint) and one words fix (the clash endings and description, Death Blossom's
blue legend, "tab", the G18 note); the violet-against-blue low for protan and deutan players in the light themes is
left as a known limit. Then all checks, the skeptics' corpus scan against main before phase 4 (99516ad) to show M1
gone, and the merge with the board-scrolling setting.

## 1. A clashing ALS-XY-Chain whose last set's z are not all inside the first still ends with 'if A holds none, D holds one', after a walk that contradicts itself without saying so

Severity low; teaches false: False; regression: False.

**Where.** src/engine/hintFrames.ts:375-412 (endsText; clashText returns '' at line 403 when the last set's z are not all cells of the first; the comment at 398 says no chain the corpora keep does this, which holds only for the set fixture)

**Scenario.** `4.......3.28..6..4.....598.6..4..3.8...6.1...5.3..9..1.579.....2..8..74.1.......9` (a daily) after 16 steps, findStep('ALS_XY_CHAIN'). The solver takes a Locked Pair here. This chain is offered in "What's in this position?": (2=7){r9c2578} - (7=9)r1c5 - (9=7)r2c5 - (7=2){r79c5} => r9c6<>2. The walk says in F2 "If set A holds no 2, its other 4 digits fill its 4 cells, so r9c5 must be 7." and in F8 "Every 7 of set C sees every 7 of set D: if r2c5 is 7, r9c5 cannot be 7." No sentence notes the contradiction. F10 then ends "Set A or set D holds a 2: if A holds none, D holds one. Each removed 2 sees every 2 of both. So 2 is removed from r9c6." alsClash is true (twoTruths at 7r9c5), so nothing on the board explains it either: the legend is only remove, lettered cells and the dashed outline. Round 1 rejected this ending for clashing chains, but the fix only covers the case where all of D's z are cells of A. Here D's 2s are r7c5 and r9c5, and r7c5 is not in A. Three more positions behave the same way. `.97.....1.2...8...8..4..92...3..2......561......9..5...38..9..7...2...5.5.....68.` after 10 steps: A (r3c2, r3c5, r3c6) lies inside D; F2 says "one of r3c5, r3c6 must be 3" and F9 says "none of r3c5, r3c6 can be 3". `8.57.....7.....6.8.23........7.34..1..9....4.....687...1.6.3...4...1...79......2.` after 17 steps: F2 says "r3c6 must be 9" and F9 says "none of r1c6, r3c6 can be 9". `7..8..5..9.8..3..2....4..8.6.2..7.....7.6.2.....1..9.6.6..9....3..7..6.5..4..8..9` after 10 steps: F2 says "r6c5 must be 2" and F8 says "r6c5 cannot be 2". I took the first ALS-XY-Chain find at every position past the singles on the solve paths of the practice pools, seeds and dailies: 3,785 distinct finds, 550 of which clash. These 4 keep the plain ending; all are menu finds (three from dailies, one from a practice puzzle). nb and es read the same way ("har A ingen, har D en" / "si A no tiene ninguno, D tiene uno"). Scan: /home/user/sudokUI/.vite/review-p4/words-r2/clashscan.ts, output in clash-*.txt.

**Fix.** Add a fourth clash ending for a contradiction the derivation names that is not 'the last set's z lie in the first' (twoTruths or inFalseGroup at a node it reports). For example: "The chain makes r9c5 both 7 and not 7, so A cannot lack a 2: set A holds a 2. Each removed 2 sees every 2 of A." Write it in en, nb and es. The removals do see every z of A, as the clash tests already check. Add these four positions to setWords' clash check, and correct the comment in clashText.

## 2. A clashing ALS-XY-Chain's description, the first thing the full view shows, still tells the impossible branch as the normal one and ends with 'A or D holds an 8'

Severity low; teaches false: False; regression: False.

**Where.** src/engine/techniques/als.ts:332 (the ALS-XY-Chain description, used for clashing chains too); shots-r2/shared-cells-that-clash/ALS_XY_CHAIN-15-*-panel.png; the same at a-clash-in-a-false-group and a-clash-that-closes

**Scenario.** Named position 'shared cells that clash', `..2....61...5.....7.4.....3.......3.42..3.9..3...9267..9.3...5.56.1.......3.8....` after 15 steps. After Show me, the full view panel (ALS_XY_CHAIN-15-light-phone-panel.png) reads: "If A holds no 8, its other digits fill its cells, so it holds a 9; then B holds no 9 and holds an 8, C no 8 and a 6, and D no 6 and an 8: each set in turn loses its link digit and fills its cells. A or D holds an 8, so 8 is removed from every cell that sees every 8 of both." D (r4c4, r6c4) lies inside A, so "A holds no 8" and "D holds an 8" cannot both be true. That is the round 1 complaint, which the fix answered only in the walk's last frame. That frame now says "Set D holds 8 only in r4c4, r6c4, cells of set A: ... A cannot lack an 8, so set A holds an 8. Each removed 8 sees every 8 of A." So the full view and the conclusion give two different reasons, and the one shown first hides the clash. nb ("... og D ingen 6 og en 8 ... A eller D har en 8") and es read the same. Decision 13 counts 56 of the 211 path ALS-XY-Chains as clashing, and each of them opens on this description. The stored example, which Learn shows, does not clash, so Learn is unaffected.

**Fix.** For an alsClash step, end the description with the clash reason the walk's conclusion uses. For example: "... and D no 6 and an 8. D's 8s are all cells of A, so A cannot lack an 8: it holds one, and 8 is removed from every cell that sees every 8 of A." Use one template per kind of clash, in en, nb and es.

## 3. Death Blossom: the blue legend claims '4 in every petal: whichever digit the stem takes, a petal holds a 4' from the first petal's frame, while only one petal is drawn

Severity low; teaches false: False; regression: False.

**Where.** src/engine/techniques/als.ts:400 (labels.primary), used by legendOf in src/content/boardSvg.ts and by the HintPanel legend; shots-r2/DEATH_BLOSSOM-*-walk2-panel.png

**Scenario.** Stored DEATH_BLOSSOM (`1.9..3.......9.5.....5.281.2..........18.....86.3...249.....1........63.5..76...8` after 26 steps), walk frame 2: "Petal A is the cell r9c7, which holds only 2 and 4, and its 2 sees the stem: ...". The board (DEATH_BLOSSOM-light-phone-walk2.png) draws only petal A and a single blue 4 at r9c7. The legend (walk2-panel.png) already reads "4 in every petal: whichever digit the stem takes, a petal holds a 4", which is frame 6's conclusion, stated before petals B and C are on the board (frames 2-5). The two-digit stem (step 43) shows "1 in every petal: ..." in frames 3 and 4, where only petal A's 1 (r9c6) is drawn. nb has "4 i hvert kronblad: ..." and es has "el 4 de cada pétalo: ...". Round 1 changed the gold entry to "the stem's candidates" while only the stem is drawn, under the rule that a legend names what its frame draws. The blue entry still states the whole step's claim. It is true of the step, so this misleads no one, but it gets ahead of the walk.

**Fix.** Until every petal's z is drawn, word the blue entry by what is drawn, for example "4 in a petal: if the stem takes that petal's digit, the petal holds a 4". Switch to the full label from the last petal's frame on, as stemAlone does for the gold entry. Write it in en, nb and es, in the panel and the Learn legend.

## 4. The English shared-cell legend says 'each tab names one': players never meet the word 'tab', and nb and es say 'letter'

Severity low; teaches false: False; regression: False.

**Where.** src/content/boardSvg.ts:639 and src/ui/HintPanel.tsx:481 (the key in engine.nb/es.ts:313 and ui.nb/es.ts:416); shots-r2/shared-cells-that-clash/ALS_XY_CHAIN-15-light-phone-walk11-panel.png

**Scenario.** Wherever two drawn sets share a cell, for example 'shared cells that derive' (`.37.4......67.8...........972.....61..91.54..14.....856...........9.28......8.23.` after 25 steps, full view and frames 8-11) and 'shared cells that clash' (frames 8-11), the legend reads "dashed outline: a cell of two sets; each tab names one". No sentence, legend entry or Learn text a player sees calls the small lettered square a 'tab'; the entry just above says "lettered cells". A casual player can't connect 'tab' to anything on the board. The Norwegian ("hver bokstav står for én av dem") and Spanish ("cada letra nombra uno de ellos") versions say 'letter' and read clearly.

**Fix.** "dashed outline: a cell of two sets; each letter names one". Rename the key in the engine and ui tables; the nb and es values can stay.

## 5. Some clashing ALS-XY-Chains still end with the plain ending after their walk contradicts itself (round 1's clash-ending low, only partly fixed)

Severity low; teaches false: False; regression: False.

**Where.** src/engine/hintFrames.ts:400-403 (clashText returns '' when the last set's z are not all cells of the first; its comment says no chain in the corpora does this), endsText at :383

**Scenario.** Practice pool UNIQUENESS_6, puzzle #8 `8.57.....7.....6.8.23........7.34..1..9....4.....687...1.6.3...4...1...79......2.`, after 17 steps. The step is findStep('ALS_XY_CHAIN'), on offer: `(1=9){r3c16} - (9=4)r1c5 - (4=9){r2359c5} - (9=1){r13c6} => r3c4<>1`. alsClash is true (inFalseGroup at 9r3c6). Frame 2 says "If set A holds no 1, its other 2 digits fill its 2 cells, so r3c6 must be 9." Frame 9 says "Every 9 of set C sees every 9 of set D: if one of r2c5, r3c5 is 9, none of r1c6, r3c6 can be 9." Frame 11 then ends with the plain "Set A or set D holds a 1: if A holds none, D holds one. Each removed 1 sees every 1 of both. So 1 is removed from r3c4." D's 1s are r1c6 and r3c6, and r1c6 is not a cell of A, so clashText returns '' and none of the new 'after all' templates applies. The walk shows r3c6 as both 9 and not 9 and never says the premise is impossible. That is the case round 1 reported, and the fix covered only clashes where D's z lie inside A. The same thing happens in 5 daily menu steps, all twoTruths. Example: `.97.....1.2...8...8..4..92...3..2......561......9..5...38..9..7...2...5.5.....68.` after 10 steps, `(6=3){r3c256} - (3=6)r1c4 - (6=3){r27c4} - (3=6){r3c2356} => r3c9<>6`. Its frame 2 says "so one of r3c5, r3c6 must be 3", its frame 9 says "none of r3c5, r3c6 can be 3", and it ends with the plain ending. All 6 are menu steps (1 in the pools/seeds, 5 in the dailies) out of about 49,000 set steps scanned; none is on a solve path. Every sentence is a valid conditional, so nothing taught is false.

**Fix.** When alsClash(step) and clashText finds D's z outside A, word the ending from the derivation's own problem: name the node the chain makes both true and false (from Derivation.problems: twoTruths or inFalseGroup at its `at`). For example: "The chain makes r3c6 both 9 and not 9, so A cannot lack a 1: set A holds a 1. Each removed 1 sees every 1 of A." (checkSets' zNotSeen already guarantees each removal sees every z of A.) Add nb/es templates, and add the practice position above to the set fixture's clash positions.

## 6. A true group or set whose every "one of these" square is ruled out by a true disc is drawn without G18's "premise is impossible" note

Severity low; teaches false: False; regression: False.

**Where.** src/content/hintMarks.ts:427-429 (clashing/refuted count only two true discs); src/engine/truth.ts deriveLinks (emptyTrue counts only candidates marked false)

**Scenario.** Seed Extreme #13 `6.3.......5..4...7..2.8...4.2.....8.......7.5..9....2..14.2...8..64..13.....71.9.`, after 44 steps. findStep('ALS_XY_CHAIN') gives `(1=8)r5c3 - (8=1)r2c3 - (1=9){r2c48} - (9=1){r238c1} => r5c1<>1`, which derives cleanly (no problems, alsClash false). Frame 3 ("Set B is the cell r2c3, which holds only 1 and 8: if it is not 8, it must be 1.") draws 1r2c3 as a true disc. Frame 9 ("If set D holds no 9, its other 3 digits fill its 3 cells, so one of r2c1, r3c1 must be 1.") adds 1r2c1 and 1r3c1 as "one of these" squares. All three are in box 1, so the drawing shows the premise is impossible: the solution has r5c3=1. Yet frameMarks(...).refuted is false. The full-view legend reads "remove | true, if set A holds no 1 (by the small dot) | false, ... | squares in a set: one of them is true, if set A holds no 1 (by the small dot) | lettered cells: ...", with no "the chain shows that premise is impossible: set A holds a 1". If D's 1 were a single disc, `clashing` would set refuted and the note would show. The same happens for AIC with Groups. Practice pool SIMPLE_COLORS #5 `.7.19.6.56....5.....2....7..5...42...6.....5...32...8..2....8.....6....93.4.27.6.` after 20 steps gives `(3)r2c2 = (3)r2c45 - (3=6)r3c5 - (6=3)r3c6 => r3c2<>3`: squares 3r2c4 and 3r2c5 sit beside a true disc on 3r3c6 in box 2, and there is no note. Over about 49,000 set steps scanned from the pools', seeds' and dailies' paths and menus, this happens at 13 positions (7 ALS-XY-Chain, 4 AIC with ALS, 2 AIC with Groups), all on offer only. Every claim is a conditional on an impossible premise, so nothing is false, but the board shows a contradiction it never names. For AIC with Groups this is not a regression: main drew the same chain as 'oneTrue' discs with the same missing note. For the ALS-XY-Chain it is new, since main drew no truth.

**Fix.** Count a true node of several candidates as refuted when every candidate drawn as a square is excluded by a drawn true disc (the same cell, or the same digit in a cell that sees it): add this to `clashing` in hintMarks so the legend gives the refuted note. Better, add it in deriveLinks as an emptyTrue problem (treating candidates a true candidate excludes as false), so an ALS pattern takes alsClash's no-truth drawing and its clash ending, and an AIC gets the note. Hold the 13 positions in a test.

## 7. Light and rose themes, protan and deutan vision: a violet set's outline and tab are the false-ring blue, so the XY-Wing hinge's false ring merges into one blue capsule

Severity low; teaches false: False; regression: False.

**Where.** src/content/hintPalette.ts LIGHT.set3Ink '#6a40d0' (src/ui/styles.css --hint-set-3-ink, light/rose block); decision 9 in docs/hint-drawing-sets.md. Screenshots: shots-r2/ALS_XY_WING-light-phone.png (hinge r6c3), shots-r2/wings-that-touch/ALS_XY_WING-33-light-phone.png (C on r2c7, r6c7, r7c7), shots-r2/DEATH_BLOSSOM-light-phone.png (petal C r8c1). Simulations: /home/user/sudokUI/.vite/review-p4/vis/m-xyw-hinge-cvd.png, m-wtt-c.png, m-wtt-c2.png, m-db-a-cvd.png, made with /home/user/sudokUI/.vite/review-p4/vis/cvd.py (Machado severity 1)

**Scenario.** Decision 8 gives sets their tints in letter order, so the third set is always violet. That makes every ALS-XY-Wing's hinge C violet, and also an XY-Chain's D and a Death Blossom's petal C. The hinge is where the chain comes in on a false ring and leaves on a true disc. Stored ALS-XY-Wing (..3.5........76..52..4..8.6..8...2..9.5.2.13..2.1..5.9......4..5..8.9....8.34.... after 28 steps), light phone, hinge r6c3: normal vision shows a violet pill (outline and C tab) round a blue 4 ring and a green 6 disc. Under Machado protan or deutan, #6a40d0 becomes #0060d4 / #005bcd, which is the false ring's #175bb7 blue (CIEDE2000 3.3, the design's own number). The outline and the tab become one solid blue capsule, and the 4's false ring is told apart from it only by its white keyline. A two-candidate tile in one row or column is a pill: about half of all bivalue tiles, e.g. wings-that-touch r7c7 round 1 and 4, both members. Such a pill becomes a blue outline round digits, the false ring's colour. Death Blossom's petal C (r8c1) shows the same with its pattern-blue 4 disc, whose edge is the same #175bb7. Nothing drawn is false: shape, the keyline and the tab still carry the meaning. But blue is the board's colour for false, and for these players the violet set picks it up. Dark and forest are fine: #c896ce against #7fbbff is 8.7 or more under every simulation, as m-xyw-hinge-cvd-d.png shows. Decision 9 keeps #8400fc in reserve 'should the screenshots show an outline read as a false ring'. These simulations are that check. Note that the reserve also turns blue under protan (#0062fe), and its 8.5 comes from lightness, not hue.

**Fix.** Either apply decision 9's reserve and re-check the hinge pill in simulation, or better, move the light violet ink well away from #175bb7 in lightness, where protan and deutan still see a difference. One way is a clearly darker violet such as about #4b1d9e, checked against the 4.5:1 tab-letter floor and the rose-ink separation. Or record in decision 9 that under protan and deutan the light-theme violet set is told from a false ring by shape, keyline and tab alone, citing the XY-Wing hinge.

## 8. Grouped chains: a group's bar pushes an arrow onto the next or previous arrow of the chain, which main drew apart

Severity medium; teaches false: False; regression: True.

**Where.** src/content/hintGeometry.ts arrowShapes (barObstacles/barStretches as obstacles; the arc and bend search scores marks, bars and tabs but never the hint's other arrows) and groupBars (side scoring checks only the straight shaft against the bar half-width, not the head and clearance the router needs); app board via src/ui/boardLayout.ts boardDrawing

**Scenario.** Repro 1: `2...7........5.84...13...96....176.3.6.....1.1.356....34...29...26.3........9...4` after 6 steps, findStep('GROUPED_NICE_LOOP'). The solver takes a Locked Triple here, so this loop is on offer in "What's in this position?". The chain is (6)r1c4 = (6)r1c6 - (6=5)r9c6 - (5)r9c13 = (5-7)r7c3 = (7)r9c13 - (7=6)r9c4 - loop. On the app board (boardDrawing), link 6, (7)r7c3 = (7)r9c13, is drawn `M 236.0 695.5 Q 386.0 883.0 252.5 883.0`. It runs out to the right and comes into 7r9c3 along y=883, on top of link 7, (7)r9c13 - (7)r9c4, drawn `M 242.0 883.0 L 299.5 883.0`. 52% of link 7 lies within 4 units of link 6, and link 6's solid head sits on the start of link 7's dashed line, so the pair reads as a strong arrow from 7r9c4 into 7r9c3. Main draws link 6 straight down, `M 226.0 699.0 L 226.0 856.5`. Called with the same sets but bars: [], arrowShapes gives main's straight line again. The cause is the bar of 5r9c13, at y=870 from x=54 to 254, which sits between row 9's 5s and its 7s: the straight head would end 0.25 units from it. Repro 2: `.5...612...9.....6....95...84..5...1..7...8..3...7..64...78....1.....9...359...8.` after 19 steps, findStep('AIC_GROUPED'), on offer at 13 positions (k19 to k32). Link 4, (2)r2c5 = (2)r23c4, is drawn `M 442.0 116.4 Q 404.0 83.0 375.7 107.9`. It runs back along link 3, (2)r2c1 - (2)r2c5, drawn `M 69.9 125.1 Q 414.0 83.0 436.2 107.4`: 78% of link 4 is within 4 units of link 3, at a minimum of 0. Main draws link 4 below, `M 442.0 137.6 Q 404.0 171.0 373.9 144.5`, never nearer than 30.8. With no bars the same call gives `M 442.0 137.6 Q 404.0 171.0 375.7 146.1`. Here the group's own bar, at x=369 for y 127-227, blocks the route below beyond the exempt 19.75 units round 2r2c4. Scope: over the grouped chains on offer at every non-single position of the 480 pool and seed paths, 4 chains (17 positions) have one arrow within 4 units of another for more than half its length. Main has none of these (the 8 main has are unchanged), and none is a solve path's step.

**Fix.** When an arrow bends for a bar or a tab, count the hint's other arrows as a cost: their shafts as soft obstacles, as a weak tie already keeps off other ties' ends. Or let an arrow cross another group's bar square-on within a mark's reach of its own target member. Have groupBars score a side with the head and the clearance the router will need, not only the shaft against the bar's half-width. Add a test over the menus' grouped chains that no two arrows of a hint run within a stroke width of each other for more than a few units.

## 9. Round 1's 'two links drawn as one arrow' is still there when the two links join the same two nodes and the arrow bends; its test passes on distinct d strings

Severity low; teaches false: False; regression: False.

**Where.** src/content/hintGeometry.ts arrowShapes shape(): a bent line's tail and tip come from the control points without the side-by-side shift (lines 1299-1300), so `spread` moves only the control point; tests/hintGeometry.test.ts "never draws two links of a step as one line" (`new Set(lines).size === lines.length`)

**Scenario.** `9....3.2.....1.3.7...8..9...38.46........84...6.7.............8..9..5..11.5.9.7..` after 31 steps, findStep('ALS_XY_CHAIN'), on offer (the solver takes a Nice Loop): (4=5){r2c8,r3c9} - (5=6){r2c2346} - (6=5)r2c8 - (5=4){r27c2}. A's 5 and C's 5 are both 5r2c8, and B's 5 and D's 5 are both 5r2c2. Link 1 (A to B) is drawn `M 739.2 161.1 Q 454.0 279.5 178.5 165.2` and link 5 (C to D) `M 739.1 160.7 Q 454.0 270.5 178.7 164.5`. Their tails are 0.4 units apart and their tips 0.7, so the two heads coincide, and the curves are at most 4.5 units apart at the apex. Walk frame 5 adds an arrow on top of frame 2's, as round 1 described. Main draws the same pair, so this is not a regression; As built says such links are drawn beside each other. A related case: `...4.65377..9..6..........4......1.6.465.238.8.3......4..........9..5..22853.4...` after 12 steps. There link 5 (C's 1s to D's 1) is re-anchored to r1c5, `M 410.0 29.3 Q 126.0 71.0 126.0 53.5`. It runs within 4 units of link 1, `M 210.5 35.7 Q 148.0 71.0 137.9 50.7`, for 52% of link 1's length, crossing it twice at shallow angles, and both heads end in 1r1c2 from below, 12 units apart. The test passes in both cases because the two `d` strings differ.

**Fix.** Apply the sideways shift to a bent line's tail and tip as well (offset along the perpendicular at each end), so two links between the same nodes are drawn apart from end to end, with two heads. Make the test measure distance, not string equality: no two arrows of a step within, say, a stroke and a halo of each other over more than a few units.

## 10. A clashing ALS-XY-Chain whose last set holds z outside its first still ends with the plain 'if A holds none, D holds one' after an unspoken contradiction

Severity low; teaches false: False; regression: False.

**Where.** src/engine/hintFrames.ts clashText (returns '' unless every z of the last set lies in the first) and endsText; the doc comment says no chain the corpora keep does this

**Scenario.** `8.57.....7.....6.8.23........7.34..1..9....4.....687...1.6.3...4...1...79......2.` after 17 steps, findStep('ALS_XY_CHAIN'), on offer in "What's in this position?" (the solver takes Locked Candidates): (1=9){r3c16} - (9=4)r1c5 - (4=9){r2359c5} - (9=1){r13c6} => r3c4<>1. A is r3c1, r3c6 and D is r1c6, r3c6. alsClash is true (inFalseGroup at 9r3c6). Walk frame 2 says "... so r3c6 must be 9." and frame 9 says "... none of r1c6, r3c6 can be 9." The conclusion is still the plain "Set A or set D holds a 1: if A holds none, D holds one. Each removed 1 sees every 1 of both.", because D's 1s (r1c6, r3c6) are not all A's (r3c1, r3c6). This is round 1's logic low 6, which was fixed only for a last set inside the first. It is 1 of the 693 clashing ALS-XY-Chains on offer along the 480 pool and seed paths. The other 692 get the new endings, which are correct.

**Fix.** Give an inFalseGroup or twoTruths clash an ending that names where it happens, for example "If A holds no 1, r3c6 must be 9, yet C's 9s leave r3c6 no 9: A cannot lack a 1, so set A holds a 1. Each removed 1 sees every 1 of A." Do not fall back to the plain ending for a clash. Add this position to the set fixture's named clashes.

## 11. The new tint rule puts one tint on two sets that share a cell where an equally good choice would put it on two sets that only touch

Severity low; teaches false: False; regression: False.

**Where.** src/content/hintMarks.ts setTints (15dc6bb): costs [linked alike, conflicting alike, pairs alike], with a shared cell and a shared side counted the same, ties to letter order

**Scenario.** `...4.65377..9..6..........4......1.6.465.238.8.3......4..........9..5..22853.4...` after 12 steps, findStep('ALS_XY_CHAIN'): (2=1){r13c3} - (1=2)r1c2 - (2=1){r1c35} - (1=2){r146c2}. A (r1c3, r3c3) and C (r1c3, r1c5) share r1c3, and setTints gives both sand (A=1, B=2, C=1, D=3). So r1c3 is a sand tile with a sand dashed outline inside it, and the legend's 'dashed outline' swatch is sand on sand (tile-1 dash-1). The round-1 code (d0a28dc) gave C violet and D sand. D (r1c2, r4c2, r6c2) only borders A by a side, and that choice has the same three costs: no linked pair alike, one conflicting pair alike, one pair alike. Over the 5,148 ALS-XY-Chains on offer along the 480 paths, 128 draw two cell-sharing sets in one tint. In 43 of them an assignment with the same three costs avoids it, and 36 are new against the round-1 rule (126 had it before).

**Fix.** Before evenness, add a cost for cell-sharing pairs alike (or weigh a shared cell above a shared side), so a tint that must repeat goes to sets that only touch. Add one of these positions to the tint tests.

## The skeptics on the medium (finding 8)

### Skeptic 1: refuted False, severity low

Both repros are real and new in phase 4, but the claim rates them too high. They are a rare readability flaw, not a medium regression.

Real and caused by the bars: on 0600b2e, `boardDrawing` gives exactly the paths the claim quotes. If I pass the same sets to `arrowShapes` with `bars: []`, I get main's lines back. Main (pre-p4) draws both chains with the arrows apart. Neither step is on a solve path: the solver's next step is LOCKED_TRIPLE at the first position and LOCKED_CANDIDATES_1 at the second.

The cause, read end to end:
- **Repro 1:** 7r9c3 sits between the 5-group's bar (y=870, x 54-254, and not exempt for a link of 7s) and its own 7-bar below. The only approach that keeps clear of every bar is from the right, along row 9, which is where link 7 leaves.
- **Repro 2:** the group's own bar at x=369 blocks main's route below, just beyond the exempt zone. `groupBars` scores both sides 0, because it checks only the straight shaft, and the tie-break puts the bar on the right.

One part of the claim's diagnosis is wrong. The router does score other arrows: `runOf` measures a shaft's run along the other links' lines (`lines`). But it skips points within 0.45 cell of the arrow's own ends, where G10 lets arrows gather, and it ranks clearance of marks and bars first, as G10 and decision 4 say. Link 6's counted run stays under 0.3 cell, and the 100-unit link 4 is almost all inside its end zones, so the code treats both drawings as ok. In short, the code follows its spec; the spec's node exemption is what lets this through.

Why low and not medium:
1. **Rare.** Over the 577 stored grouped-chain positions (examples, paths and offers in groups-steps.json), neither main nor phase 4 has one arrow within 4 units of another for more than half its length. The claim's own wider scan finds 4 chains at 17 on-offer positions out of about 9,339 steps, none on a solve path and none a stored example.
2. **Not new as a kind of flaw.** By the claim's own count, main already has 8 chains of the same kind: an arrow along another near a shared node, which G10's node exemption allows. Phase 4's bars set off that existing router limit in 4 more chains. The design already accepts the sibling cost of bars as obstacles (44 chains where an arrow meets a bar) as known.
3. **Nothing taught is false, and the heads stay correct.** On my phone-scale renders, link 6's head clearly ends at 7r9c3 and link 7's head at 7r9c4; link 3's head stays at 2r2c5 and link 4's at 2r2c4. The walk text names each link. The harm is clutter. In repro 1, the start of the dashed weak link 7 lies under the solid link 6, so only about one dash shows before its head, and its walk badge "8" sits on the overlap. That could make link 7 look strong at a glance, but only at an on-offer position.
4. **Precedent.** Round 1 rated a worse collision low: two links drawn as one identical arrow with two walk numbers.

"Regression against main" is technically true for these few positions. These eight techniques are redrawn on purpose, though, and the phase already accepts route costs of the bars. A cluttered junction in about 0.2% of on-offer grouped positions fits low: "rare edge cases that mislead no one" (or barely). The fix ideas are reasonable polish: score the bar's side with the head and clearance the router needs, and count runs near a shared node when an arc is forced by a bar.

**Evidence.** My scripts are in /home/user/sudokUI/.vite/review-p4/sk2b/.

- **Same paths as the claim:** repro.ts runs on main-wt and builds `boardDrawing` with cellOf from the grid values and `auto` = g.cands.
  - Repro 1, GROUPED_NICE_LOOP after 6 steps (solver next: LOCKED_TRIPLE): link 6 = `M 236.0 695.5 Q 386.0 883.0 252.5 883.0`, head tip at (242,883); link 7 = `M 242.0 883.0 L 299.5 883.0`. The 5-bar runs from (54,870) to (254,870) and the 7-bar from (26,898) to (226,898).
  - Repro 2, AIC_GROUPED after 19 steps (solver next: LOCKED_CANDIDATES_1): link 4 = `M 442.0 116.4 Q 404.0 83.0 375.7 107.9`; link 3 = `M 69.9 125.1 Q 414.0 83.0 436.2 107.4`. The bar runs from (369,127) to (369,227).
- **How much they overlap:** link 7 has 63% of its samples within 4 units of link 6, and link 4 has 76% within 4 units of link 3, at a minimum distance of 0. Measured with the router's own `near` of 6 units (run.ts), link 6's shaft runs 46.7 units along link 7, and link 4 runs 69.2 of its 82.8 units along link 3.
- **Main draws them apart:** main.ts runs in /home/user/pre-p4 with `arrowShapes`, as main's Grid.tsx calls it. It gives link 6 = `M 226.0 699.0 L 226.0 856.5` and link 4 = `M 442.0 137.6 Q 404.0 171.0 373.9 144.5`, with no overlap.
- **The bars are the cause:** nobars.ts calls `arrowShapes` with `{...sets, bars: []}` and gets back `M 226.0 699.0 L 226.0 856.5` and `M 442.0 137.6 Q 404.0 171.0 375.7 146.1`.
- **Code read:** in `arrowShapes` (src/content/hintGeometry.ts 1190-1213 and 1410-1434), `runOf` skips segments within 0.45c of either end, and `better()` ranks `room` (marks, bars and tabs) above `run`. In `groupBars` (lines 465-467), the side score checks only the straight tail-to-tip segment against the bar's half-width (2.75), so both sides score 0 in repro 2 and the tie-break picks the right side. G10 in docs/hint-drawing.md:145-148 sets that order and the exemption at nodes.
- **Corpus scan (scan.ts):** over all 577 positions in .vite/p4/groups-steps.json, re-found with `findStep` on both trees, no pair of arrows has more than 50% of one within 4 units of the other, on main or on phase 4.
- **Visual check:** render.ts and topng.mjs draw phone-scale versions (stroke 4.5, dashes 11/8): p4-gnl-phone-crop.png, main-gnl-phone-crop.png, p4-aicg-phone-crop.png, main-aicg-phone-crop.png. On phase 4, link 6 swoops right and comes into 7r9c3 over link 7's dashed start, with link 7's walk badge at (279,883) on the overlap, and link 4 hugs link 3's end above row 2. Every head stays on its correct candidate.

### Skeptic 2: refuted False, severity medium

The claim holds, and its scope is understated: one of the cases is a solve path's own step.

Real on this commit: both repros give exactly the paths claimed. In repro 1 the head of link 6 ends at (242,883), which is where link 7's tail starts, and link 6's last ~40 units lie on link 7. In repro 2 link 4 runs back over the end of link 3's dashed arc.

New in phase 4: main draws both cases apart. If arrowShapes is called with the same sets but `bars: []`, it returns main's lines again. So the group bars cause the bend.
- Repro 1: the bar of 5r9c13 sits at y=870 from x=54 to 254. That is between where link 6's straight head would end (y=867) and the 7r9c3 square. groupBars, scoring as decision 2 says, picks this side: below scores 200 (it touches the two 7 squares), above scores 500 (link 6's straight shaft crosses it). The only clean way into 7r9c3 is then from the right, along link 7.
- Repro 2: the two sides score the same (link 3 crosses both, 500 each). The tie rule puts the bar on the right at x=369, which blocks link 4's lower route.

Not settled on purpose by the design:
- Decision 4 makes bars obstacles, and G10 puts clearing marks before not hiding an arrow.
- G10 also says "an arc that would hide another arrow loses to any drawing that does not".
- The design never considers bars pushing arrows onto arrows, and As built does not mention it. As built names only arrows crossing bars.
- The project's own G10 test metric passes all of these cases, so no test catches them: it skips 45 units at each end of a line and allows a run of up to 30 units. Measured with it: repro 1 run 8.9, repro 2 run 27.9, the solve-path case run 0.

Scope, from my own scan: every non-single position on the solve paths of all 480 pool and seed puzzles, the three grouped finders, 8,135 steps, the same steps on both trees. Rule: one arrow within 4 units of another for more than half its length.
- Main: 1 chain (a Grouped X-Cycles case, 2 positions). Phase 4 draws it the same.
- Phase 4: that chain plus 4 new ones at 14 positions: repro 2 (11 positions), `....1.63..` @14 AIC_GROUPED, `.1298.....` @22 AIC_ALS, and one solve-path step.
- Repro 1 scores 40% and 22% under my rule, so it is not counted, but it is clearly visible.
- The claim says "none is a solve path's step". That is wrong: seed Extreme #45, after 8 steps, is the solver's own Grouped Nice Loop, and it overlaps.

Severity: by the definitions, a regression against main is medium. These are real hint drawings, one of them on a solve path, where main kept two arrows apart and phase 4 draws one over the other. In the solve-path case the loop's closing weak link 9r2c3-9r2c2 is mostly hidden under the solid start of link 0, and its head sits on link 0's tail.

It teaches nothing false: every head stays on its own target, and the walk adds each link in its own frame with its number. It is also rare (about 0.2% of grouped steps on offer).

If the owner treats a rare drawing that is worse than main as low, the case for low is that round 1 rated a worse effect low (two links drawn as one identical arrow). But that case was not a regression against main.

Also, in the solve-path case either side of the bar blocks link 0's straight path, so the claim's groupBars fix alone cannot cure it. It needs the router to count other arrows (fix 1).

**Evidence.** Scripts are in /home/user/sudokUI/.vite/review-p4/sk1-ov/ (repro.ts, main.ts, nobar.ts, g10.ts, scan.ts, svg.ts + draw.py). Each was run with npx vite-node in /home/user/main-wt (phase 4) or /home/user/pre-p4 (main).

Repro 1: `2...7........5.84...13...96....176.3.6.....1.1.356....34...29...26.3........9...4`, 6 steps, findStep GROUPED_NICE_LOOP; the next step on the path is LOCKED_TRIPLE. Through boardDrawing (auto candidates on):
- link 6 is `M 236.0 695.5 Q 386.0 883.0 252.5 883.0`, head tip (242,883)
- link 7 is `M 242.0 883.0 L 299.5 883.0`
- bars: 5r9c13 from (54,870) to (254,870); 7r9c13 from (26,898) to (226,898)
- main's link 6 is `M 226.0 699.0 L 226.0 856.5`; phase 4 with `bars: []` gives the same line.

Repro 2: `.5...612...9.....6....95...84..5...1..7...8..3...7..64...78....1.....9...359...8.`, 19 steps, AIC_GROUPED:
- link 4 is `M 442.0 116.4 Q 404.0 83.0 375.7 107.9`; link 3 is `M 69.9 125.1 Q 414.0 83.0 436.2 107.4`
- the bar runs from (369,127) to (369,227)
- main's link 4 is `M 442.0 137.6 Q 404.0 171.0 373.9 144.5`; with no bars, phase 4 gives `M 442.0 137.6 Q 404.0 171.0 375.7 146.1`.

Missed by the claim, on a solve path: seed Extreme #45, `3.89........1..4...6...7.95.....9..74...5...95..8.....62.3...1...7..2........12.6`. After 8 steps findNextStep is this GROUPED_NICE_LOOP; the links are identical to findStep's.
- link 0 (9r2c2=9r6c2) is `M 198.0 183.0 C 382.0 183.0 382.0 583.0 208.5 583.0`. It leaves 9r2c2 along y=183, on link 9 (9r2c3-9r2c2) `M 266.0 183.0 L 208.5 183.0`, whose head tip (198,183) is link 0's tail.
- 60% of link 9's trace is within 4 units of link 0.
- main's link 0 is `M 184.2 198.8 Q 226.0 495.0 193.9 559.3`; with no bars, phase 4 gives the same line.
- The cause is the bar of 2r3c13, (54,242) to (254,242), across column 2. Above or below, it crosses link 0's straight path (500 points either way).

Rendered crops comparing both trees: r1-wt.png/r1-main.png, r2-wt.png/r2-main.png, r3-wt.png/r3-main.png in the folder above.

Scan totals: main 1 chain / 2 positions; phase 4 5 chains / 16 positions (wt-*.jsonl, main-*.jsonl).

The project's G10 metric (runs more than 45 units from the line's ends, near = 6, limit 30) passes all three cases: 8.9, 27.9 and 0.

The design doc (decision 2's side score, decision 4's obstacles, As built's "Arrows over bars") and G10 in docs/hint-drawing.md:132-150 do not cover arrows bent onto arrows.
