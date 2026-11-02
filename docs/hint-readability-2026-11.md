# Hint readability: sudokUI against HoDoKu, technique by technique

_The readability check of 1 November 2026: nine family readers and a report writer (workflow wf_bc943007-0ee) over every stored example on main at 101f0ea, phone and desktop, all four themes, every walk frame, the Learn figures. Scratch scripts and screenshots were kept outside the repository._

This report covers all 65 techniques with a stored example, on main at 101f0ea. It combines seven family reviews. Each review looked at the app's own board (phone and desktop, all four themes, every walk frame), the Learn figure, and steps built from the practice puzzles' solve paths. I re-opened the screenshot of every high and medium issue before ranking it. Phase 4's round 2 findings (docs/hint-drawing-p4-round2.md) are being fixed and are left out.

Paths below are relative to `/home/user/sudokUI/.vite/readability/`: `shots/` holds the app's board, `gallery/` the Learn figures, and `scratch/` the reviewers' scripts, scans and crops.

## 1. Verdict

1. sudokUI already reads better than HoDoKu in 40 of 65 techniques, the same in 19, and worse in 6: XY-Wing, XYZ-Wing, WXYZ-Wing, Chute Remote Pair, Sue de Coq and Digit Forcing Chain. The average score is 3.3 out of 5.
2. It wins on the board's grammar. True, false, removed and placed are told apart by shape, which works for colour-blind players and stays calm in all four themes. The board also draws houses as bands, groups as bars and squares, sets as lettered tiles, a colouring's two witnesses, and adds a legend and a walk. HoDoKu has none of these.
3. It does not yet win on the explanation. Most pattern walks read the legend back as fragments ('Pivot.', 'Pincers.'). Continuous loops and open chains remove candidates without saying why. Several hints do not draw the cells or house their logic rests on, and Chute Remote Pair, Hidden Rectangle, Unique Rectangle Type 3 and Aligned Pair Exclusion look wrong or arbitrary as a result.
4. Of the owner's three named problems, XY-Chain now reads well at a glance, but its walk still never says why r1c9 goes. Nice Loops draw well but explain nothing, and one stored loop paints the wrong state green. 3D Medusa is clear for the small stored example, but a typical real Medusa cluster is a web of 14 to 29 lines on a phone.
5. On a phone, a barred removal is hard to read. In light, dark and forest, the player's own digits share the hint's role colours. Lines strike through solved digits. Most fixes are words (phase 6) plus a few drawing rules; about 18 are small enough to do now (section 4).

## 2. Every technique

Score: 5 = the best display of this technique one could wish for, 1 = misleading. "Against HoDoKu" compares with HoDoKu's own display of the same step, or with its nearest technique where HoDoKu has none.

| Technique | Score | Against HoDoKu | In one line |
|---|---|---|---|
| **Singles and subsets** (avg 3.8) | | | |
| FULL_HOUSE | 4.5 | better | One band and the placed 8: the answer and its house read without words. |
| NAKED_SINGLE | 3.5 | better | Shows the eight digits that rule out the rest, but the answer is the smallest mark on the board. |
| HIDDEN_SINGLE | 3 | better | Crosshatching drawn as it is taught, but it is the busiest board of its family (36 of 81 cells shaded on average). |
| LOCKED_CANDIDATES_1 | 4 | better | A solid box and a dashed row tell the whole argument; walk frame 2 adds nothing. |
| LOCKED_CANDIDATES_2 | 4 | better | Pointing's grammar with the roles swapped; the same empty frame 2. |
| LOCKED_PAIR | 4 | better | Both houses are banded, so the reach of the removals shows; the barred 7s read as X marks on a phone. |
| LOCKED_TRIPLE | 4 | better | As Locked Pair; the barred 2s and 7s are hard to read on a phone. |
| NAKED_PAIR | 4 | better | As simple as HoDoKu, plus the house and a sentence. |
| NAKED_TRIPLE | 4 | better | Clean in every theme; 'between them' teaches the triple where no cell holds all three. |
| NAKED_QUADRUPLE | 4 | better | Nine discs still read calmly. |
| HIDDEN_PAIR | 3.5 | better | Discs and removals in the same cells show the idea; the crowded cell blurs on a phone. |
| HIDDEN_TRIPLE | 3.5 | better | The drawing works; the conclusion alternates between cells, digit by digit. |
| HIDDEN_QUADRUPLE | 3.5 | better | Readable on desktop; on a phone the removals merge with their neighbours. |
| **Fish** (avg 3.1) | | | |
| X_WING | 4 | better | The X and its removal read at once; the first sentence names a third row that is not there. |
| SWORDFISH | 3.5 | better | Shaded crossings explain the 2-2-2 shape; the one removal is small in a busy field. |
| JELLYFISH | 3 | same | The structure shows, but the removal is the faintest mark on a board two-thirds shaded. |
| FINNED_X_WING | 3 | same | The fin reads clearly; the fin's box, the reason only one cover candidate goes, is not drawn. |
| SASHIMI_X_WING | 3 | same | The missing corner shows as an empty crossing; nothing says the fins stand in for it. |
| FINNED_SWORDFISH | 3 | same | The fin is clear; a 3 survives in a cover column with no reason drawn. |
| SASHIMI_SWORDFISH | 2.5 | same | Three 1s stay inside cover bands while one goes, and the reason is invisible. |
| FINNED_JELLYFISH | 3 | same | Reads correctly here, but it is busy, and the least calm in forest. |
| SASHIMI_JELLYFISH | 2.5 | same | The fin and the removal share a box that nothing draws; finding the removal takes a search. |
| **Single-digit patterns and cycles** (avg 3.6) | | | |
| SKYSCRAPER | 4 | better | Shape and removal read at once; the walk never says "one of the two ends is 1". |
| TWO_STRING_KITE | 4 | better | The dashed diagonal shows the kite's box better than any colour; the walk never names box 2. |
| TURBOT_FISH | 4 | better | A clean chain; the column-7 arrow swallows a given 1 in dark and forest. |
| EMPTY_RECTANGLE | 2.5 | same | Roles only: the row, column and pair the logic uses are neither drawn nor named. |
| X_CHAIN | 4 | better | The clearest board in its family; a dashed link runs over a 1 of its own digit. |
| GROUPED_X_CYCLES | 3 | better | The group bars are excellent; the walk never says it is a loop, or why each removal goes. |
| **Wings, remote pairs and BUG** (avg 2.9) | | | |
| W_WING | 4 | better | Drawn as the chain it is, one link per frame; the conclusion never says "either way". |
| XY_WING | 2.5 | worse | Calm and correct, but the pincers' shared digits are unmarked and the walk is 'Pivot.', 'Pincers.'. |
| XYZ_WING | 2.5 | worse | The three 4s that every removal must see wear two different marks; HoDoKu groups them. |
| WXYZ_WING | 2 | worse | Roles are split by cell, not by digit; the walk names a cell two frames before drawing it. |
| REMOTE_PAIR | 4.5 | better | One two-shade cluster and two witness lines: the reason reads without words. |
| CHUTE_REMOTE_PAIR | 1.5 | worse | Only the pair and the removals are drawn; the whole argument is invisible. |
| BUG_PLUS_1 | 3.5 | better | The placement and its three houses read at once; the BUG idea itself is never stated. |
| **Uniqueness** (avg 3.2) | | | |
| UNIQUENESS_1 | 4 | better | HoDoKu's drawing with colour-blind-safe shapes; no frame says why the rectangle would be deadly. |
| UNIQUENESS_2 | 4 | better | A gold extra against a blue rectangle: the model for the whole family. |
| UNIQUENESS_3 | 2 | same | The roof extras that make the locked pair are plain grey, so the removal looks arbitrary. |
| UNIQUENESS_4 | 3 | same | Column 9, where 6 is locked, is neither drawn nor named. |
| UNIQUENESS_5 | 4 | better | The same grammar as Type 2, so it reads without help. |
| UNIQUENESS_6 | 3 | same | The X-Wing on 6 inside the rectangle is invisible. |
| HIDDEN_RECTANGLE | 2 | same | Walk frame 2 draws nothing new; the 5s that do the work are never drawn. |
| AVOIDABLE_RECTANGLE_1 | 4 | better | Outlined solved corners, and a gold would-be candidate that turns into the removal. |
| AVOIDABLE_RECTANGLE_2 | 3 | same | Roles are reversed against AR1 and UR2; the swap candidates that HoDoKu greens are plain. |
| EXTENDED_RECTANGLE | 3 | better | Ten pattern discs and two removals read at once; 'deadly 249 loop' does not. |
| **Colouring** (avg 3.7) | | | |
| SIMPLE_COLORS | 4 | better | Two shades and two dashed witness lines show the reason, which HoDoKu never draws. |
| MULTI_COLORS | 4 | better | The bridge is drawn and worded; the second removal is never explained. |
| MEDUSA_3D | 3 | better | The stored example reads; a typical real Medusa (27 to 37 candidates, 14 to 21 lines) is a web on a phone. |
| **Chains and loops** (avg 3.3) | | | |
| XY_CHAIN | 3.5 | better | The XY rhythm reads by shape; why r1c9 goes is never shown, and the walk takes two frames per cell. |
| NICE_LOOP | 2.5 | same | Drawn better than HoDoKu, but no removal is tied to its weak link and the walk never says it is a loop. |
| GROUPED_NICE_LOOP | 2.5 | better | Groups drawn far better than HoDoKu's; the stored example paints the wrong state green. |
| AIC | 4 | better | Reads at a glance; the walk removes without saying "one of the two ends". |
| AIC_GROUPED | 4 | better | The end group reads off its squares; the same conclusion gap. |
| **Almost locked sets and Sue de Coq** (avg 3.4) | | | |
| ALS_XZ | 4 | better | A short chain between lettered sets; the 1-arrow runs through an unrelated 1. |
| ALS_XY_WING | 4 | better | Wings and hinge are clear; the description runs to 10 lines on a phone. |
| ALS_XY_CHAIN | 3.5 | better | Ten frames, one idea each; a quarter of real steps (the clashes) draw no reason. |
| AIC_ALS | 3.5 | better | The board beats HoDoKu's; the words are the retired arrow notation. |
| DEATH_BLOSSOM | 3.5 | better | The walk is excellent; in the full view the stem's ties cross and swoop. |
| SUE_DE_COQ | 2 | worse | Coloured by cell, with no row or box drawn; HoDoKu shows the two locked sets. |
| **Exotic patterns and forcing chains** (avg 2.3) | | | |
| FIREWORKS | 3 | same | What goes is clear; why the three cells lock (row 8 and column 6) is never drawn. |
| ALIGNED_PAIR_EXCLUSION | 2 | same | The two sets that do the work look like three bivalue cells, so the hint looks wrong. |
| EXOCET | 2 | same | The roles read; the proof is a black box. |
| PATTERN_OVERLAY | 2 | same | One barred 9 and a count; none of the six placements is shown. |
| DIGIT_FORCING_CHAIN | 2 | worse | Reads as a loop; frame 1 draws the removed 3 like the premise; the second removal is never reached. |
| NISHIO_FORCING_CHAIN | 3 | same | The sentences read like a teacher's; the contradiction rests on a placement the line never shows. |

## 3. Issues, ranked

Seven high, 23 medium, 12 low. Where the same fault shows in several families, it is one item that names them all.

### High

#### H1. Pattern walks read the legend back instead of reasoning

- **Techniques:** XY_WING, XYZ_WING, WXYZ_WING (high: common, and the walk teaches nothing); BUG_PLUS_1; all ten uniqueness techniques; all nine fish; EMPTY_RECTANGLE, SUE_DE_COQ, FIREWORKS, EXOCET; all thirteen singles and subsets (medium there).
- **What a player sees:** A pattern's walk frames are its legend labels, capitalised, with a full stop, then a bare 'So ... is removed'. The XY-Wing walk is 'Pivot.', 'Pincers.', 'So 6 is removed from r7c8, r8c6.' (shots/XY_WING-light-phone-walk1/2-panel.png). WXYZ-Wing opens with 'Cell whose 9 the bivalue cell sees.', two frames before it draws the bivalue cell (WXYZ_WING-light-phone-walk1-panel.png). No uniqueness walk says why the rectangle would be deadly. No finned fish walk gives the either/or that its own description gives. BUG+1 never says "every other cell holds two candidates". Singles read as noun phrases ('Row 4, with one cell left.'), and Locked Candidates never names 'row 5'. A beginner who walks learns less than one who reads the full view's description.
- **Fix:** Give every pattern technique frame sentences of its own, written by its finder (a `labels.why` or per-frame text), as Death Blossom's stem and petals already have (`blossomFrames`). Name cells and houses and give the argument. Examples:
  - XY-Wing: 'The pivot r7c7 holds only 7 and 9.' / 'If r7c7 is 7, the pincer r7c6 (only 6 and 7) must be 6.' / 'If 9, the pincer r8c9 (only 6 and 9) must be 6.' / 'Either way a pincer is 6; r7c8 and r8c6 see both, so 6 goes.' XYZ-Wing adds the third case ('if 4, the pivot itself').
  - WXYZ-Wing, in the description's order: 'r4c3 holds only 4 and 9.' / 'r4c4, r5c5, r6c5 in box 5 hold only 1, 4, 7, 9: one digit more than cells.' / 'If r4c3 is 9, the three cells must be 1, 4, 7, so r5c5 is 4.' / 'Either way a 4 in r4c3 or r5c5 is true; r4c6 and r5c3 see both.'
  - Uniqueness: a 'why' frame before the conclusion, e.g. 'If r4c8 were 5 or 8, all four corners would hold only 5 and 8; they could swap, and the puzzle would have two solutions.' Name the floor and roof cells.
  - Finned fish: base > fins ('Column 3 also has an 8 at r4c3, outside rows 5 and 8: the fin') > covers ('If the fin is false, columns 3 and 9 put their 8s in rows 5 and 8') > the fin's box > 'r5c1 is in row 5 and in box 4: false either way'. Sashimi adds 'its corner r9c4 has no 1; the fins stand in for it'. Basic fish name their rows and columns.
  - BUG+1: 'Every unsolved cell but r5c6 holds exactly two candidates.' / 'In r5c6's row, column and box, 3 appears three times.' / 'Without its 3 the grid would be a deadly pattern, so r5c6 is 3.'
  - Singles and subsets: 'Row 4 has one empty cell, r4c9, and lacks only 8.' / 'In box 4, every 3 lies in row 5, so no other cell of row 5 can be 3.'
- **Where:** phase 6 (the catalogue pass). WXYZ-Wing's frame order (primary, secondary, fins, so the bivalue cell comes last) can be fixed now.

#### H2. The cells the logic rests on are not drawn, so the hint looks wrong or arbitrary

- **Techniques:** ALIGNED_PAIR_EXCLUSION, CHUTE_REMOTE_PAIR, UNIQUENESS_3, HIDDEN_RECTANGLE.
- **What a player sees:**
  - *Aligned Pair Exclusion* (shots/ALIGNED_PAIR_EXCLUSION-light-phone.png): r3c4 {2,6}, r9c4 {2,8} and r7c5 {2,9} are three loose gold cells. The logic uses two two-cell sets that share r9c4: A = r3c4 + r9c4 (2, 6, 8) and B = r7c5 + r9c4 (2, 8, 9). Read as bivalue cells, none of them rules out 6+8 or 9+8, so a careful player concludes the hint is wrong. The walk never shows a pairing.
  - *Chute Remote Pair* (CHUTE_REMOTE_PAIR-light-phone.png): two blue 5/6 cells and two barred 5s. That box 4's 6 must sit in row 4 or row 5 is invisible. 96 of 218 path steps draw no mini-line. In 122 others the gold mark sits on the digit that is present, under words about the one that is missing. The label 'one chute apart' contradicts the description ('in one chute').
  - *Unique Rectangle Type 3* (UNIQUENESS_3-light-phone.png): the 1 in r7c4 and the 6 in r7c5, which act as one cell, are plain grey. Only r7c6 is gold, so the board shows a gold 1/6 cell and a red 6 next to it, with no reason. Row 7 has no band. The description gives the floor cells roof extras.
  - *Hidden Rectangle* (HIDDEN_RECTANGLE-light-phone-walk1.png and -walk2.png are byte-identical): frame 2's legend is unchanged. Its sentence, '5 in the bivalue corner: confined to the rectangle in r6c5's row and column', can be read as being about r9c6. The 5s that are confined (row 6 and column 5) are never drawn.
- **Fix:**
  - APE: emit each set as phase 4's lettered tiles (A and B, with r9c4 a shared-cell tile) and label them 'set A: r3c4, r9c4 hold only 2, 6, 8'. Walk one frame per pairing of the removed candidate ('If r8c4 were 8, r7c4 would be 6 or 9; 6 with 8 leaves set A only 2 for two cells.'). *New item.*
  - CRP: shade the third box as a dashed acts-through band, and mark box 4's 6s as gold discs labelled 'box 4's 6s: all in the pair's rows'. Drop the mark on the present digit. Walk pair > 'row 6 of box 4 has no 6' > 'if row 4, r4c6 is 5; if row 5, r5c8 is 5' > removal. The alternative is to emit it as the chain it is, (5=6)r4c6 - (6)r4c2 = (6)r5c2 - (6=5)r5c8, drawn like a W-Wing. Change 'one chute apart' to 'in different rows and boxes of rows 4-6'. *New item.*
  - UR3: add the roof cells' extras to the secondary role, band row 7 as dashed, and label it '1 and 6: the roof's extras (r7c4, r7c5, read as one cell) and r7c6 hold only these in row 7: a locked pair'. Name the roof cells, the digits and the house in the description. *Now.*
  - Hidden Rectangle: move the strong digit's candidates in B, its row-mate and its column-mate to the secondary role, band row 6 and column 5 as dashed, and label them '5 in row 6 and in column 5: only in the rectangle'. A prototype is in scratch/uniq-proto.ts. *Now, after M1's band gating.*

#### H3. The English fish description runs the digit into the list of rows

- **Techniques:** all nine fish.
- **What a player sees:** 'X-Wing on 7: in rows 3, 8, 7 can only go in columns 3, 8' (shots/X_WING-light-phone-panel.png), which reads as three rows. 'Jellyfish on 6: in rows 2, 6, 8, 9, 6 can only go in columns 5, 6, 8, 9'. This is the first sentence of every fish hint, in the panel and on Learn, and it names houses that are not in the fish. Norwegian and Spanish are correct.
- **Fix:** Rewrite the four English strings in src/engine/techniques/fish.ts with listAnd and a plural noun: 'X-Wing on 7: in rows 3 and 8, the 7s lie only in columns 3 and 8 (r3c3, r3c8, r8c3, r8c8).' Add a test that no fish description has a digit right after a list of houses.
- **Where:** now.

#### H4. A continuous loop's walk never says it is a loop, nor why each removal goes

- **Techniques:** NICE_LOOP, GROUPED_NICE_LOOP, GROUPED_X_CYCLES (and X-Cycles).
- **What a player sees:** The walk follows the loop as an open chain under an unstated supposition. It comes back to its start with no word that the loop closed (GROUPED_X_CYCLES-light-phone-walk6-panel.png), then ends 'So 2 is removed from r3c6, r4c1, r3c1.' (walk7). r3c6 does not even see the start. Nice Loop's last frame lists five removals in three digits (NICE_LOOP-light-phone-walk7-panel.png). The rule that makes a loop work is stated once, abstractly, in the full view's description: it holds both ways round, so exactly one end of each weak link is true. Nothing ties a removal to its weak link. The cell removals caused by in-cell weak links (2r6c5; 1r9c9 and 6r9c9 in the grouped loop) have no mark at all. A player who learns from this walk takes away 'a removal sees the green discs', which is false.
- **Fix:** (1) When the loop closes, say so: 'The chain is back at r1c1, as it began: the loop holds whichever way round it is read, so each dashed link has exactly one end that is 2.' (2) Give one frame per weak link that removes something, drawing that link's removals: 'One of r1c6 and r2c4, r3c4 is 2; r3c6 sees all three, so it is not 2.' For a weak link inside a cell, draw G12's corner brackets round the cell.
- **Where:** now for the closing sentence; phase 6 for the frames per weak link and the brackets.

#### H5. Green discs are a supposition but read as the answer, and in the stored grouped loop every green mark is false

- **Techniques:** NICE_LOOP, GROUPED_NICE_LOOP, GROUPED_X_CYCLES (the loops); also XY_CHAIN, AIC, AIC_GROUPED and the other open chains (medium there).
- **What a player sees:** A continuous loop needs no supposition, but the full view, the Learn figure and every frame paint one of its two equally valid states green, with a start dot. In the stored Grouped Nice Loop the solution is the other state (checked with scratch/chains/sol.ts). 7r1c8 is drawn as the false start but is the solution's 7, and 9r1c8, 9r5c9, 8r9c9 and the 7 squares are all false (shots/GROUPED_NICE_LOOP-light-phone.png). A player who reads green as "true", as HoDoKu's own docs teach, would place a wrong 9 and a wrong 8. In open chains the supposition is needed, but the legend leads with 'true' and repeats the condition on every line. In the stored XY-Chain, 3 of the 4 green discs are false in the solution.
- **Fix:** Draw a continuous loop as a two-shade cluster (G19's shade pair, no truth, no start dot), with the legend 'one shade is true and the other false; the loop holds either way'. If that is too far from G18, keep discs and rings but drop the supposition and the dot for continuous loops, and add a frame that swaps them. For open chains, put the supposition first, once, naming the cell: 'Suppose r1c6 is not 4 (the dot). Then: disc = true, ring = false, ...'. Check the stored examples against the solution in a test.
- **Where:** new item (loops); phase 6 (open-chain legend).

#### H6. A real-size 3D Medusa's cluster frame is unreadable, and no screenshot shows it

- **Techniques:** MEDUSA_3D.
- **What a player sees:** On the practice paths, Medusa steps colour a median of 27 to 37 candidates (up to 54) and draw 14 to 21 tie lines (up to 29), all in frame 1. In a built step (scratch/colour/fx/big54-f1-phone.png: 54 candidates of 8 digits, 29 lines) the lines cross many times. Row-7 ties strike through the givens 1, 7 and 6, and arcs span the board. Only 9 of those 29 lines carry the proof. The stored example colours 6 candidates with 3 lines, so every screenshot round and the Learn page review only the easy case. This is the readability problem the owner named.
- **Fix:** For a cluster with more than about 8 ties, split the cluster frame. A path frame comes first: only the ties on the path between the argument's candidates (the two clashing ones, or the two witnesses), with every other candidate shaded and drawn without ties. Its sentence: 'Follow these lines from the 2 in r9c9: the shades alternate, and they reach the 6 in r9c9 in the same shade.' The rest of the cluster follows in frames of at most about 8 ties, or not at all. Choose the tree so that this path is the shortest one. Add a representative Medusa step to the readability shots and the drawing fixture now, for example '.68..........19.24.9...61..8.3.5.....5..3..6.....4.2.5..17...9.97.28..........75.' after 29 steps.
- **Where:** new item, before phase 6; the representative example now.

#### H7. Forcing chains: what the walk draws does not prove what it says

- **Techniques:** DIGIT_FORCING_CHAIN, NISHIO_FORCING_CHAIN.
- **What a player sees:**
  - Digit Forcing frame 1 says 'r1c1 = 8, so 3 is removed from r1c1.' and draws the 8 and the 3 as identical blue discs. The candidate to be removed looks like the premise, and the premise is stated as a fact. Frame 2 says 'If r1c1 is not 8' over the same blue 8 (scratch/rep-dfc.png, from shots/DIGIT_FORCING_CHAIN-light-phone-walk1.png).
  - The second removal (6 from r1c1) is never drawn or explained. The off branch stops at 3. Over the positions with no singles, 18% of Digit Forcing steps on offer have a conclusion that no drawn line reaches.
  - The line hides placements its singles rest on. Nishio's frame 7 says 'row 4 would have no place left for 7', but 7r4c8 was removed by r9c8 = 7, which is not on the line (49% of Nishio lines have a link that rests on an undrawn placement, and 84% a contradiction that does). Digit Forcing's frame 5 calls r7c4 'the only place left for 6 in box 8' while the board still shows a 6 in r8c6.
- **Fix:** Draw truth per branch (G21). Open each branch with 'Assume' or 'If'. Extend each branch to every conclusion it claims. Prefer a line closed under its causes. Where none exists, draw the net: each off-line placement as a true disc with a short arrow into the single it enables, in its own frame. Add tests that every conclusion ends a drawn line and every drawn single's causes are drawn.
- **Where:** phase 5.

### Medium

#### M1. A walk frame that adds nothing: every band is drawn from frame 1

- **Techniques:** LOCKED_CANDIDATES_1, LOCKED_CANDIDATES_2, HIDDEN_SINGLE, all nine fish, BUG_PLUS_1, HIDDEN_RECTANGLE, NISHIO_FORCING_CHAIN.
- **What a player sees:** Walk frames 1 and 2 are byte-identical boards for X-Wing, Swordfish, Finned X-Wing, both Locked Candidates, BUG+1 and Hidden Rectangle (light phone, md5). Only the sentence changes, and the legend already names the dashed cover band in frame 1 (scratch/rep-xw-panels.png). This happens in 813 of 813 Pointing walks and 225 of 225 Claiming walks on the practice paths. Hidden Single's frame 1 already draws all four crosshatch bands. Nishio's breaking row appears six inferences early.
- **Fix:** Draw a band with its role's part: primary bands from the frame that shows 'primary', secondary bands from the frame that shows 'secondary' (in hintMarks, walk frames only). Keep 'units' in the base only where the band is the whole drawing (Full House). Forcing steps show their band from the contradiction frame. Add a test that no two consecutive frames of a walk draw the same marks. H2's UR3 and Hidden Rectangle fixes and M4's UR4 fix depend on this.
- **Where:** now.

#### M2. Open chains never say "one of the two ends is the digit"

- **Techniques:** SKYSCRAPER, TWO_STRING_KITE, TURBOT_FISH, X_CHAIN, XY_CHAIN, AIC, AIC_GROUPED, W_WING, AIC_ALS; the ALS patterns' 'remove' legend.
- **What a player sees:** The walk proves one direction and ends 'So 1 is removed from r1c9, r8c7.' (SKYSCRAPER-light-phone-walk4-panel.png), or 'So 6 is removed from r9c7.' (W_WING walk6). The start is drawn as a false ring and the end as a green disc, so a beginner reads "r9c9 is 1, so r1c9 goes": half the argument. The full view's descriptions give the either/or for some of these techniques (Skyscraper, Kite, Turbot), but the walk does not. In the ALS patterns, B's green 5 reads as "place it", and the symmetric reason ('A or B holds a 5') lives only in words.
- **Fix:** End the walk with both ends: 'Either r2c7 (by the dot) is 1, or the chain makes r9c9 1: one of them is 1. r1c9 and r8c7 see both, so 1 is removed from them.' For a removal in an end's own cell: 'r1c6 is 8, or r1c9 is 2; either way r1c9 is not 8.' Lend the same words to the 'remove' legend entry. Optionally, in the conclusion frame of a chain with up to three removals, draw dashed headless ties from each removal to both ends (G13).
- **Where:** now (the sentence and legend); phase 6 (the ties).

#### M3. Wings and Sue de Coq colour cells by role, not the digits the logic uses (worse than HoDoKu)

- **Techniques:** XY_WING, XYZ_WING, WXYZ_WING, SUE_DE_COQ.
- **What a player sees:** XY-Wing marks the pivot's 7 and 9 and the pincers' 6s, but leaves the pincers' 7 and 9 as plain pencil marks, so the board does not show what ties each pincer to the pivot. In XYZ-Wing the three 4s that every removal must see wear two different marks, blue in the pivot and gold in the pincers (scratch/rep-xyz.png). In WXYZ-Wing the 4 in r4c3 is lavender and the 4 in r5c5 gold, and box 5 is not drawn (shots/WXYZ_WING-light-phone.png). Sue de Coq colours the intersection blue and the outside cells gold, with no row or box band, so which digits lock into row 9 and which into box 9 is invisible (SUE_DE_COQ-light-phone.png). HoDoKu colours by digit (x and y green, z blue; Sue de Coq's row digits blue and box digits violet), and its pictures show the whole pattern.
- **Fix:** Colour by function. XY-Wing: the pincers' shared digits join the pattern role, labelled 'the pivot and the digit each pincer shares with it'. XYZ-Wing: z (4) gold in all three cells, labelled 'the 4s: one of these three is true'; x and y blue. WXYZ-Wing: draw it as the ALS-XZ it is (tile B on box 5's three cells, the bivalue cell as A, the 9 link, z truth), or at least put all the 4s in one role and band box 5. Sue de Coq: band row 9 and box 9, and colour the line digits (2, 6), the box digits (4, 7) and the intersection-only digit (8) in three roles, each named in the legend.
- **Where:** new item.

#### M4. The house or line the logic uses is not drawn

- **Techniques:** the six finned and sashimi fish, UNIQUENESS_4, UNIQUENESS_6, AVOIDABLE_RECTANGLE_2, EMPTY_RECTANGLE, FIREWORKS, EXOCET, PATTERN_OVERLAY, BUG_PLUS_1 (low there). This is H2's pattern, at a smaller cost.
- **What a player sees and the fix:**
  - *Finned and sashimi fish:* only the cover cells in the fin's box lose the digit, but the cover band is drawn as in a basic fish ('goes nowhere else in them'). FINNED_X_WING-light-phone.png keeps r8c2's 8 inside dashed row 8. 9,293 of 9,436 finned steps on the practice paths leave such a candidate. Fix: draw the fin's box as a third band style (dotted, in the fin colour) from the fin frame on, with the legend 'fin's box: a removal lies here and sees every fin'. *New item.*
  - *UR4:* column 9, where 6 is locked, is neither drawn nor named; all four corners are the same blue (scratch/rep-ur2.png). Fix: the roof's 6s become gold, and column 9 gets a dashed band, labelled '6 in column 9: only in the roof, so one of r2c9, r8c9 is 6'. *Now.*
  - *UR6:* the X-Wing on 6 inside the rectangle is invisible. Fix: make the four 6s secondary, band rows 5 and 6, and label them '6 in rows 5 and 6: only in the rectangle, so on one diagonal'. *Now.*
  - *AR2:* the 4 in r6c2 and the 5 in r9c2, which would complete the swap, are plain, while HoDoKu greens exactly them. The roles are the reverse of AR1 and UR2, so frame 1 claims 'one of them must be 3' before the rectangle is shown. Fix: the solved corners and the swap candidates become primary, and the extra 3s secondary (gold). *Now.*
  - *Empty Rectangle:* nothing shows row 1, column 2, the pair's column 5, or why r6c2 goes. The label 'every 5 in it lies on one row and one column' is true of any candidate. Fix now: labels 'box 1: its 5s all lie in row 1 or column 2' and 'r1c5 and r6c5: the only 5s in column 5', and a description with the two cases. Then *new item:* draw it as the grouped Kite it is, (5)r6c5 = (5)r1c5 - (5)r1c23 = (5)r2c2 => r6c2<>5, which also gives Copy a Eureka line.
  - *Fireworks:* three cells in three houses look like a broken naked triple. Fix: dashed bands on row 8 and column 6 that cross at r8c6, and a walk per line ('Outside box 8, row 8 has 4 and 8 only in r8c3'). *New item.*
  - *Exocet:* 'a complete placement analysis proves ...' and nothing on the board to check. Fix: band the target rows and the base's mini-line, and add a walk frame per base digit. *New item.*
  - *Pattern Overlay:* none of the six placements of 9 is shown, and walk frame 1 paints the victim pattern-blue. Fix: one frame per placement (capped at about 8), each drawing its nine 9s, with r9c1 as a plain ring ('placement 3 of 6: does not use r9c1'). *New item.*
  - *BUG+1:* the bands say '3 three times', but the other 3s are unmarked. Fix: mark them as gold acts-through discs. *New item.*

#### M5. The barred removal cannot be read on a phone

- **Techniques:** the ten subsets and Locked Candidates, PATTERN_OVERLAY, NISHIO_FORCING_CHAIN, EXOCET; every removal in principle.
- **What a player sees:** At 390 px the bar merges with the digit. LOCKED_PAIR-dark-phone.png's 7s read as X marks. LC2's 5 reads as an S with a slash (scratch/lc2-elim-light.png). In hidden subsets the barred digit sits against its own cell's blue discs. Nishio's removed 4 keeps a blue fill under the bar and reads as a bare circle-slash. For these techniques the removal is the whole answer, and the player has to find and erase exactly that digit. HoDoKu's black digit on a pink disc stays readable.
- **Fix:** Use the planned phase-7 fix: keep the digit whole (outline the digit in the board's colour over a bar drawn under it, or stop the bar short of the digit's box). Lighten the tint inside a removed assumption's ring.
- **Where:** phase 7, first item of that phase.

#### M6. Theme inks collide with the hint's roles

- **Techniques:** any step with entered digits (most visible in HIDDEN_SINGLE, LOCKED_CANDIDATES_1/2, CHUTE_REMOTE_PAIR, fish, EMPTY_RECTANGLE, XY_WING, BUG_PLUS_1); rose removals everywhere.
- **What a player sees:** Entered digits are blue in light (#2f6fd0 against pattern ink #175bb7) and in dark, and gold in forest (#dfb15e against acts-through #f8b93f). In LOCKED_CANDIDATES_1-forest-phone.png, row 5's gold band holds gold 8, 1, 5, 7. In the light shots, box 4's blue band holds blue 7, 6, 5, 1. A beginner reads them as part of the pattern or as reasons. In rose the removal red (#bc072a) sits only CIEDE2000 about 10 from the crimson givens (#a81d47), so the one conclusion is the least distinct hue. The Learn figures use the entered ink too, although the figure is not the reader's own work. Shape keeps colour-blind players no worse off.
- **Fix:** While a hint draws, let entered digits step to a neutral ink, as the peer and same-digit tints already do. In Learn, draw every solved digit in the givens' ink. Give rose a removal red further from its givens (or move its givens toward plum) and re-measure.
- **Where:** new item; the rose ink in phase 7.

#### M7. Arrows run straight over candidates of their own digit, which then read as stops on the chain

- **Techniques:** X_CHAIN, SKYSCRAPER, TURBOT_FISH, GROUPED_X_CYCLES, XY_CHAIN, AIC, AIC_GROUPED, ALS_XZ, ALS_XY_WING, ALS_XY_CHAIN, AIC_ALS.
- **What a player sees:** XY-Chain's dashed arrow down column 6 passes exactly over the 3s in r3c6 and r4c6 (scratch/rep-xy.png), so it looks like a chain through four 3s. ALS-XZ's 1-arrow along row 8 runs through 1r8c4 (scratch/rep-als.png). X-Chain's dashed link runs over the 1 in r7c6. In ALS-XY-Chain an arrow runs over a 9 in the removal's own cell. Measured: 29% of Skyscrapers, 18% of Turbots, 15% of chain links along a row or column, and 17% of ALS-XY-Chains. G13 already keeps ties off such candidates (`sameDigit`, used only for weak ties).
- **Fix:** Add the arrow's own digit's candidates (marked or not) to its obstacles for every single-digit arrow, softly, so a gentle arc or a half-pitch shift is enough. Test that no stored example's arrow passes within a mark's radius of such a candidate.
- **Where:** now (re-run the drawing fixture).

#### M8. The answer is the faintest mark on the board

- **Techniques:** NAKED_SINGLE; JELLYFISH, FINNED_JELLYFISH, SASHIMI_JELLYFISH, SWORDFISH, SASHIMI_SWORDFISH.
- **What a player sees:** In NAKED_SINGLE-dark-phone.png eight large gold outlines dominate, and the placed 1 is a 16 px disc in the corner of r4c1. In dark and forest the gold outshines the green. A Jellyfish's eight bands shade 56 of 81 cells, and its single removal is an unfilled ring about 9 px across (JELLYFISH-dark-phone.png, r3c9).
- **Fix:** Singles: draw the placement centred at value size, in place-green, inside the solved-digit outline, and draw the reasons' outlines thinner and a step lighter. Name the cell in frame 1. Big fish: in the full view and the conclusion frame, halve the band fills (keep the outlines), and turn digit focus (G17) on by default for single-digit patterns.
- **Where:** new item (singles); phase 7 (fish).

#### M9. Hidden Single shades too much

- **Techniques:** HIDDEN_SINGLE.
- **What a player sees:** HIDDEN_SINGLE-light-phone.png shades rows, columns and a box with four dashed bands, and column 5 lies inside box 2's band (r3c5 double-tinted). On the practice paths a hidden single shades 36 of 81 cells on average. 43% have a band that another band covers. 97% are shown in a row or column, even when the box form needs fewer bands (3.6 bands instead of 5.1 over the 2,862 that are also box singles).
- **Fix:** Drop a secondary band whose crossing cells are all covered by another (*now*). Present the single in the house that needs the fewest bands, the box on a tie, without changing which placement the finder takes, so no rating moves (*new item*). Refresh the example.

#### M10. Lines strike through solved digits and unrelated candidates

- **Techniques:** TURBOT_FISH, TWO_STRING_KITE, SKYSCRAPER, X_CHAIN, GROUPED_X_CYCLES, MEDUSA_3D, MULTI_COLORS, SIMPLE_COLORS, REMOTE_PAIR, NISHIO_FORCING_CHAIN, DIGIT_FORCING_CHAIN.
- **What a player sees:** In TURBOT_FISH-dark-phone.png the given 1 in r7c7 becomes a thicker stretch of the arrow. In the Kite, the line shows inside the open counters of 6, 3 and 5. MEDUSA_3D-light-phone.png's row 7 reads '1--3-⊘--3-1'. Multi Colors' orange ties run through the middles of eight givens. Nishio's row-6 arrow strikes a small 4, which in pencil-mark notation means removed. About half of this family's steps have an arrow through a solved digit's middle. Separately, an arrow's tail crosses another digit of its own start cell in 38 to 58% of chain steps (already a phase-7 item).
- **Fix:** Where an arrow crosses a solved digit, cut out a rounded box (advance by cap height, plus halo) instead of the glyph, so the shaft stops and resumes. Among routes that clear the marks equally, prefer the one that crosses fewer digits, and let a tie bow gently to do so. Steer an arrow's tail off its start cell's digits, as its head already is.
- **Where:** phase 7.

#### M11. The lines of one hint cross each other

- **Techniques:** DEATH_BLOSSOM; long XY_CHAIN and AIC.
- **What a player sees:** In DEATH_BLOSSOM-light-phone.png and the Learn figure, the stem's 2-tie crosses the 5-tie and the 7-tie. The 5-tie swoops into row 7, and the 7-tie runs about eight cells along row 8, so a reader following 2r8c9 can end at 5r8c5. In a built 9-cell XY-Chain, three arrows in column 4 cross twice and two heads arrive from the same side (scratch/chains/xy9-zoom.png).
- **Fix:** Count a crossing of the hint's other lines as a cost before length. Ties that share an end leave it at least 30 degrees apart, towards their own target. Add a no-crossing test on the stored example and a long-chain test.
- **Where:** now (Death Blossom); phase 7 (long chains).

#### M12. Colourings remove candidates that no frame explains

- **Techniques:** MEDUSA_3D (rules 4 and 5), MULTI_COLORS, SIMPLE_COLORS.
- **What a player sees:** Multi Colors' frame 5 says 'one more 6 falls the same way' over a board with no mark at r7c4 (scratch/rep-mc.png). Frame 6 bars it with no line. On the practice paths, 18 of 33 Medusa rule 4 and 5 removals have no line, bracket or sentence of their own. 'The same way' is sometimes a different rule.
- **Fix:** Before the conclusion, give the extra removals a frame (or one each, when there are few), each with its own reason and its dashed lines: 'The 6 in r7c4 also sees r2c4 and r8c6, so it is false too.'
- **Where:** phase 6.

#### M13. In a proof, the reason mark's legend does not say what it proves

- **Techniques:** MEDUSA_3D (rules 1, 2 and 6), SIMPLE_COLORS (wrap), MULTI_COLORS (sees both).
- **What a player sees:** The full view shows only removals and green trues. Its one reason mark joins two removals and carries the generic legend 'corner brackets: two candidates of one cell, at most one true' (scratch/colour/fx/big54-full.png). The reader is not told the two shared a shade.
- **Fix:** Word the legend for the proof: 'corner brackets: dark purple would make r9c9 both 2 and 6, so dark purple is false'.
- **Where:** phase 6.

#### M14. The Learn figure of a colouring draws no ties

- **Techniques:** MEDUSA_3D (also SIMPLE_COLORS, MULTI_COLORS).
- **What a player sees:** gallery/MEDUSA_3D-phone.png shows shades but not the links between 1 and 8 in r1c1 and r7c3, which are the technique.
- **Fix:** When Learn is regenerated, add the cluster frame (or H6's path frame) as a second, smaller figure, captioned with its sentence.
- **Where:** phase 7.

#### M15. A clashing ALS-XY-Chain draws no reason for its removal

- **Techniques:** ALS_XY_CHAIN (56 of 211 path steps).
- **What a player sees:** The arrows land on plain bold digits, there is no start dot, and A's 8s look like every other member (scratch/rep-als.png, right). The legend is 'remove / lettered cells / dashed outline'. HoDoKu marks z blue in every set.
- **Fix:** In a clash view, draw the first set's z as pattern discs (no truth claimed, as Death Blossom's z), labelled '8 in set A: every removed 8 sees each of them'. Amend G5 and decision 13. This goes with round 2's clash endings.
- **Where:** now.

#### M16. Forcing chains: the full view reads as a loop, and the dead candidates as present

- **Techniques:** DIGIT_FORCING_CHAIN, NISHIO_FORCING_CHAIN.
- **What a player sees:** Digit Forcing's full view is one long line from 8r1c1 round to a dashed arrow back into 3r1c1, the shape of a Nice Loop. The on branch is inside the cell and invisible. Nishio's three 7s in row 4 are filled purple discs, under 'no place left for 7' (scratch/rep-nish.png).
- **Fix:** Use G21's full view: the premise taken both ways (a mark phase 5 defines), the removals, and no arrows. Draw dead candidates as false rings, each with the number of the frame that removed it.
- **Where:** phase 5.

#### M17. Link sentences never name the house that makes the link

- **Techniques:** all chains and single-digit patterns, W_WING, the loops.
- **What a player sees:** '(nowhere else for it)' and '(they see each other)', without a house (scratch/rep-gxc.png). On a diagonal link the house is exactly what the player must check, and the board does not draw it (Turbot's box 8, the Kite's box 2).
- **Fix:** 'Strong link on 2 in box 8: r9c5 and r7c6 are its only 2s, so ...'; 'Weak link on 8 in box 2: ...'. Name the box when it is the only shared house.
- **Where:** phase 6.

#### M18. The legend lacks the marks a beginner needs most

- **Techniques:** all chains and ALS patterns (arrows, start dot); fish (the solid base band); HIDDEN_SINGLE and LOCKED_CANDIDATES (a role drawn both as marks and as a band shows one swatch); FULL_HOUSE and the subsets ('place' and 'remove' carry no words, and they come first).
- **What a player sees:** The solid arrow (therefore true) and the dashed arrow (therefore false) are in no legend, swatch or sentence (NICE_LOOP-light-phone-panel.png). The dot is named only inline. A colour-blind player has no legend entry for the fish's solid base outline.
- **Fix:** As G23 plans: swatches drawn like the marks for solid arrow, dashed arrow and dot, shown when drawn; a combined swatch (disc on band) for a role drawn both ways; words on 'place' and 'remove'; pattern first, conclusion last.
- **Where:** phase 6.

#### M19. Descriptions use notation, and the Eureka or HoDoKu line is only on the clipboard

- **Techniques:** XY_CHAIN ('r1c6 -> r5c6 -> ...', with no digits), NICE_LOOP and GROUPED_NICE_LOOP ('3@r1c4 -> ...'), AIC_ALS (the retired arrow form, the only text on its Learn page), X_CHAIN, GROUPED_X_CYCLES ('nodes (groups included)'); every pattern (hodokuLine not shown); SUE_DE_COQ's copy line merges the row cell and the box cell.
- **What a player sees:** scratch/rep-words.png. Links show no kind, and sets are written '[r7c8, r8c8]' while the board calls them set A. An expert from HoDoKu cannot see the one line they read at a glance.
- **Fix:** Show the Eureka line (chains) or HoDoKu's line (patterns) in a small, selectable monospace row under a prose description in the style of Skyscraper's. Give Sue de Coq HoDoKu's own copy form.
- **Where:** phase 6.

#### M20. The conclusion sentence follows the finder's order

- **Techniques:** HIDDEN_PAIR, HIDDEN_TRIPLE, HIDDEN_QUADRUPLE (medium); UNIQUENESS_1, EXTENDED_RECTANGLE, FIREWORKS, DIGIT_FORCING_CHAIN (the same cell named once per digit); LOCKED_PAIR, LOCKED_TRIPLE, GROUPED_X_CYCLES (not in reading order); UNIQUENESS_2/3/5, AVOIDABLE_RECTANGLE_2, W_WING, the ALS patterns ('So ... So').
- **What a player sees:** 'So 2 is removed from r8c4; 4 is removed from r8c6; 7 is removed from r8c4; 8 is removed from r8c6.' (HIDDEN_TRIPLE walk2). 'So 5 is removed from r4c8; 8 is removed from r4c8.' 'r3c1, r5c1, r6c1, r2c3, r3c3'. The descriptions end '... so 6 is removed from cells seeing both. So 6 is removed from r4c4.'
- **Fix:** In conclusionText, sort removals in reading order. Group by cell when a cell loses several digits ('So 5 and 8 are removed from r4c8'). Append the cells without a second 'So'. For hidden subsets, in phase 6: 'So r8c4 keeps only 3 and 5 (2 and 7 go)'.
- **Where:** now (sorting, grouping, the double 'So'); phase 6 (hidden-subset wording).

#### M21. The full view's words never name what is removed

- **Techniques:** ALIGNED_PAIR_EXCLUSION, DIGIT_FORCING_CHAIN.
- **What a player sees:** describe() appends the conclusion only when the description does not name every cell involved. APE names r8c4 as a pair cell and Digit Forcing names r1c1 as the premise cell, so '8 is removed from r8c4' and '3 and 6 are removed from r1c1' appear nowhere in the panel or on Learn.
- **Fix:** Test for the conclusion's own words (digit and cell), not just the cell name.
- **Where:** now.

#### M22. A placing loop's legend says "impossible" frames before any sentence does

- **Techniques:** NICE_LOOP, GROUPED_NICE_LOOP (30% and 26% of placing loops); 4-5% of XY_CHAIN, AIC, AIC_GROUPED.
- **What a player sees:** In a built placing loop (scratch/report/dplace.ts), the legend line 'the chain shows that premise is impossible' appears at frame 9 ('In r8c7: if it is not 3, it must be 1'). The sentence that says why comes at frame 11, and the clash (two 1s in box 9) is never named.
- **Fix:** In the frame where the truths first clash, say so: '... so r8c7 is 1. But r7c8 is already 1 in box 9: supposing r3c8 is not 1 is impossible already.' Draw the two clashing discs joined by a weak tie.
- **Where:** phase 6.

#### M23. The XY-Chain walk takes two frames per cell

- **Techniques:** XY_CHAIN (and bivalue cells in AIC).
- **What a player sees:** Every switch inside a cell gets its own frame with no new line ('In r5c6: if it is not 3, it must be 1 (the cell has only these two).'), so the arrows carry only even numbers and a 10-cell chain needs 20 taps.
- **Fix:** Fold the switch into the weak link's frame: 'If r1c6 is 3, r5c6 cannot be 3 (column 6), so it is 1, its other digit.' Keep the first cell's switch as the opening supposition.
- **Where:** phase 6.

### Low

| # | Techniques | What a player sees | Fix | Where |
|---|---|---|---|---|
| L1 | EXOCET ('256'), HIDDEN_RECTANGLE ('35'), W_WING ('46'), XY_WING ('(76)'), CHUTE_REMOTE_PAIR ('56'), SUE_DE_COQ ('24678'), WXYZ_WING ('1479'), EXTENDED_RECTANGLE ('249'); subsets' '3/7' | Digits run together read as numbers ('two hundred and fifty-six'); slash lists are notation | Join with '/' now; write 'only 3 and 7' in phase 6 | now / 6 |
| L2 | BUG_PLUS_1 ('a bivalue grid with two solutions'), UNIQUENESS_3 ('pseudo-cell'), CHUTE_REMOTE_PAIR ('chute'), EMPTY_RECTANGLE ('conjugate pair'), EXTENDED_RECTANGLE ('Type 1', 'loop'), FIREWORKS ('the only cells 1/4/8 can land on'), ALS_XY_WING ('C lacks at most one'), fish fin labels ('fin:' for two fins), AIC (three names in one panel) | Words a player does not know, and a few that are not quite true | Plain and exact words in the catalogue pass, in en, nb and es | 6 |
| L3 | WXYZ_WING (8 lines), ALS_XY_CHAIN (12), ALS_XY_WING (10), GROUPED_NICE_LOOP (9), MEDUSA_3D rules 1-2 (29 removals listed), every panel ('Full House: ...' repeats the title) | The description pushes the buttons below the fold on a phone | Lead with one line; leave long lists to Copy step; drop the 'Name:' prefix | 6 |
| L4 | UNIQUENESS_1, EXTENDED_RECTANGLE | Frame 1 says 'the fourth must not join them' without marking the fourth corner (r4c8; r9c5) | Mark its would-be candidates as secondary, so they turn into removals at the end (as AR1 does) | now |
| L5 | GROUPED_X_CYCLES ('44'), SKYSCRAPER, W_WING ('❸3'), MULTI_COLORS (bridge) | A walk number beside the same numeral reads as one number; on a short link the number hides the dash | In badge placement, penalise a same-numeral neighbour; put the number beside a link shorter than about 1.3 cells | 7 |
| L6 | AIC, AIC_GROUPED, XY_CHAIN | The start dot sits between the start's ring and its partner's green disc, so 'by the small dot' can point at the wrong one | Place the dot on the side away from the partner | 7 |
| L7 | JELLYFISH, FINNED_SWORDFISH (Learn) | A mark at a cell's edge sits on the band's dashed outline | Inset the outline more in Learn, or break it under a mark's keyline | 7 |
| L8 | all | Cell names ('r4c1') are not tied to the phone board, which has no coordinates | Show the Learn figures' edge numbers while a hint is open, or make cell names tappable | 7 |
| L9 | MEDUSA_3D (rule 6) | The rings of the cell dark purple would empty have the same shape as false rings | A dashed ring or corner brackets, with a matching swatch | 7 |
| L10 | SIMPLE_COLORS, MULTI_COLORS, MEDUSA_3D | The first witness frame already bars the target, while its sentence is still 'if' | A 'would go' ring in that frame; the bar in the 'Either way' frame | 6 |
| L11 | ALS_XY_WING, ALS_XY_CHAIN | The restricted-common frame names set C one frame before it is introduced | Name the cell with it: 'set C, the hinge r6c3' | now |
| L12 | the ALS patterns (desktop) | Set letters are about 9 px at 1x | Tab 22 units with a 16-unit letter on wide boards | 7 |

## 4. Quick wins: small enough to do now

1. Fix the four English fish strings and add the test (H3).
2. Draw each band from its role's frame, and test that no two consecutive frames draw the same marks (M1). This unblocks items 3 to 5.
3. Hidden Rectangle: move the strong digit to secondary and band B's row and column (H2; prototype in scratch/uniq-proto.ts).
4. UR3: draw the roof extras and band row 7; name the roof, digits and house in the description (H2).
5. UR4, UR6 and AR2: the locked digit or swap candidates in their own role, with bands, and AR2's roles the right way round (M4).
6. Empty Rectangle's labels and description name row 1, column 2 and column 5 (M4).
7. Open chains end with "one of the two ends is the digit", and the ALS 'remove' legend gets the same words (M2).
8. A continuous loop's closing link says the loop closed and holds both ways (H4).
9. Arrows avoid their own digit's candidates (M7).
10. conclusionText: reading order, grouping by cell, no double 'So' (M20).
11. describe() appends the conclusion when its words are missing (M21).
12. Hidden Single: drop a band that another band covers (M9).
13. Death Blossom: count a crossing of another stem tie as a cost (M11).
14. Clashing ALS-XY-Chain: draw the first set's z (M15).
15. Join digits with '/' (L1).
16. UR1 and Extended Rectangle: mark the fourth corner and r9c5 in frame 1 (L4).
17. Name a one-cell set in the restricted-common sentence (L11).
18. Add a real-size Medusa step to the readability shots and the drawing fixture (H6).

## 5. What to keep

- **Truth by shape.** A disc for true, a ring for false, a barred ring for a removal, a ringed disc for a placement; solid arrows into true and dashed into false; solid bands for the house that confines and dashed for the house that loses. All of it survives colour blindness and reads the same in all four themes. Pattern blue is never true-green (G4), so a fish's base never claims a placement.
- **Bands that argue.** Locked Candidates' solid box and dashed row carry the whole intersection argument in two shapes. Fish crossings that stay shaded without a disc show the holes of a 2-2-2 Swordfish and the missing corner of a sashimi fish. In a Hidden Single, the answer's cell is the only one of its house left pure blue.
- **Reasons on the board.** Naked Single's outlined solved digits (keep them, lighter). Colouring's two dashed witness lines and corner brackets. Remote Pair as one two-shade cluster. The proof frame that turns shades into truth before the conclusion.
- **Arrows done right.** Over the grid lines with a halo, digits cut out, heads steered off digits, laid out once so the walk never moves them, numbered by the frame that adds them. No arrow inside a cell: a ring beside a disc shows the switch. Arcs choose their side and stay on the board (HoDoKu's leave it).
- **Groups and sets.** Rings on a bar for 'none of these', squares on a bar for 'one of these', each arrow anchored at the nearest member, and the walk wording a group as one node. ALS tiles with a letter on every tile, never a hull, and a one-cell hinge folded into one frame. All of these are far beyond HoDoKu.
- **Walks that teach.** One link per frame for chains, with each sentence matching its frame. ALS-XZ's six frames. Death Blossom's stem, then one petal per frame with its branch sentence. Simple Colors' 'If dark purple is true ... Either way it is false.' The discontinuous loop's 'that is impossible, so r3c8 is 1', with the start turning from ring to disc. Nishio's 'the only candidate left in r1c2'. Use these as the model for H1.
- **Models inside the uniqueness family.** UR2's gold extra against the blue rectangle. AR1's gold would-be candidate in frame 2 that becomes the removal, and the legend lending its words to the removal (G23). Use them for UR1, Extended Rectangle and the other types.
- **Descriptions that already reason.** Skyscraper, Kite and Turbot name their houses and give the either/or. WXYZ-Wing's and Chute Remote Pair's descriptions are complete proofs, and XYZ-Wing's states the idea in a player's words. 'Between them' for a naked triple; 'the only 3 cells of row 8 that can take 3/5/9' for a hidden triple.
- **Honesty.** Pattern Overlay gives its template count, Exocet claims only what its proof shows, and Nishio calls its line 'one line of the reasoning'.
- **One drawing everywhere.** The Learn figure equals the full view, with row and column numbers, and Copy step keeps HoDoKu's line and Eureka for experts.
