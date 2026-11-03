# Candidates and pencil marks, November 2026: the hunt, the fixes and Gather

## The owner's report

On 3 November 2026 the owner reported that the pencil marks went wrong around auto candidates, on the phone and
at the desk: with auto candidates on, Swap did nothing; switching auto off into centre marks left old corner
marks in the cells, drawn round their edge; in Centre mode a digit the list had ruled out could not be taken
away; and a slow tap on a number key put a corner mark in. Commit 308d543 fixed the three causes found then (a
held key entered a corner mark in any mode; auto off left the other layer's stale marks; Swap swapped hidden
marks), and a wider hunt followed.

He also asked for one feature, agreed with him afterwards: a way to gather every mark into one layer, by holding
Swap, and one rule for where the app writes a list of candidates.

## What the hunt found

Three explorers hunted from three angles (the store, the board in a browser, the features), and an independent
checker reproduced each finding with scripts of its own: 24 confirmed, none rejected, and 10 lows. 23 of the 24
confirmed findings fall into the clusters A to K below and are fixed; the 24th, a medium (Share's Position as text
and board picture under "unknown"), is left for the owner's decision (see Left as they are). Clustered:

- **A. Undo and Redo forgot how the board read the marks.** History held the cells alone, so Ctrl+Z after Auto
  on, Auto off, a jump to a step or a Check proof left auto candidates in the wrong state, and the next Auto off
  could write over the player's own marks. The marks' contract was not kept either: undoing a whole-board Fill
  or an auto-off write left the marks "complete", so Snyder notes were judged as full lists.
- **B. Hidden strikes.** A candidate struck while auto was on stayed in the cell's exclusions after auto went
  off. Hint, Scan and Fill still reasoned from it, Check never saw it, and writing the digit back by hand did not
  help: Hint and Check contradicted each other ("Run Check" / "Everything checks out").
- **C. A number key held longer than a second with a mouse entered twice.** The click guard ran from the
  pointer going down, so the click after a long press got through: Digit mode placed the digit over the corner
  mark, the other modes took the mark straight out again.
- **D. A keyboard digit held down toggled on and off** with the keyboard's auto-repeat; S, Space, H and the mode
  keys repeated too.
- **E. Erasing a placed digit did not give back the marks its placement took** from its cell and its peers, so
  Check reported cells the player never touched and Hint was blocked.
- **F. Turning auto on ignored corner-mark lists,** even ones the app had written itself (Auto off into corner
  marks, Fill in Corner mode): the player's eliminations came back, and were lost at the next Auto off.
- **G. Fill with auto on wrote into the hidden layer:** nothing changed on the board, yet the notice said
  "Filled", a step went into the history and the hidden notes were overwritten.
- **H. Fill or Auto pressed while typing a custom puzzle,** then Cancel: the game came back assisted and with its
  marks declared complete.
- **I. The chain trainer** switched auto on without the Auto button's handover (the player's centre-mark
  eliminations ignored, no undo step), left it on after Done, and stayed open across a new game, Next practice
  puzzle and Restart, with the old puzzle's goal.
- **J. Check ignored corner-mark candidate lists** while the mark question had not been asked, and said
  "Everything checks out so far".
- **K. Erase in Digit mode with auto on** first cleared the hidden manual marks (no visible change), and never
  gave back struck candidates.
- **Lows (10):** five are fixed: Ctrl/Cmd+C, X and V changed the entry mode; the Touch help still said a held
  number key enters a corner mark in any mode; with auto on, a cell with every candidate struck showed the hidden
  manual marks; Swap with only empty, unmarked cells selected said nothing; and Backspace in Digit mode with auto
  on erased the hidden marks (fixed with K). Five are left (below): Shift- and Ctrl-click with a digit armed, nine
  corner marks beside a centre mark, a centre list of five or more digits, the mark contract in a position link,
  and Hint and Scan under "notes".

## What was fixed, and how

All in src/state/gameStore.ts unless named.

- **A.** Each history step is a `Snapshot`: the cells, whether auto candidates were on, and the marks' contract.
  Undo, Redo and Check's "Back to the last correct position" put all three back. Every action that pushes history
  records it; opening the chain trainer with auto off (which switches it on) is a step of its own. The player's answer to the mark question is a fact
  about the whole puzzle, not a move, so answering rewrites "unknown" in the steps already taken: Undo past them
  does not ask again, while Undo of a Fill or an auto-off write gives back the contract from before it.
- **B.** Switching auto off clears every open cell's exclusions after writing the list (with any of the three
  choices: centre marks, corner marks, nothing; Ctrl+Z brings them back through A). With auto off the only
  exclusions left are eliminations the app applied and checked against the solution (an applied hint, an applied
  chain), which can never hide a true digit, so Hint moves on past them and Fill does not write them back. A
  digit written into a mark by hand clears its exclusion, so what the board shows is what the solver reads. A
  save or a position link from before the fix, with auto off, loses any struck solution digit when it is opened
  (`dropHiddenSlips`). Check reads only what the board shows; Hint and Scan (contractGrid) and Fill read the marks
  and, beside them, those applied eliminations, which the board does not draw with auto off but which never hide
  a true digit; Steps reads the puzzle alone.
- **C.** src/ui/Controls.tsx: a number key pressed by a pointer is handled by its pointer events however long
  the press; the click after it is ignored (`detail` not 0 after a pointer press), while the keyboard and
  assistive technology still click it.
- **D.** src/ui/App.tsx: a repeated keydown (`KeyboardEvent.repeat`) is ignored for every key except the arrows,
  Backspace, Delete and Ctrl/Cmd+Z and Y; the repeats of Space and the digits are still kept from the page.
- **E.** Placing a digit (`placeDigit`) records on the cell, in an optional `took` field saved with the game, the
  cell's own marks and the peers whose corner or centre marks held the digit. Taking the digit off (Backspace,
  the digit again, another digit typed over it, a Check proof taking a wrong digit off, W for the peers) gives
  them back (`giveBack`), only to cells still empty and only where no digit the peer sees is the same; a peer
  whose marks have since moved to the other layer alone takes it there. Older saves have no `took` and lose
  nothing. Undo works as before.
- **F.** Turning auto on (`autoOn`, shared with the chain trainer) reads each cell's candidate list
  (`candidateList`): its centre marks, or in a cell with no centre marks its corner marks when the contract is
  exhaustive. The digits the list leaves out become the cell's exclusions, replacing older ones, so a digit
  written back by hand is a candidate again and is never reported as "dropped". Corner notes under "open" adopt
  nothing, as before. Under "unknown", a cell with corner marks and no centre marks could be either, so Auto on
  asks the mark question first (round 2, below).
- **G.** Fill with auto on changes nothing, adds no step and says why, as Swap does; its button says the same.
- **H.** Fill and Auto do nothing without a game (`!info`, which is the custom-entry board), the Assist box is not
  shown while a puzzle is typed in, and the game's backup keeps `assisted` and `markContract`, which Cancel puts
  back (a backup saved before this keeps the values it had).
- **I.** Opening the trainer with auto off goes through the Auto button's handover (adoption, notice, one step).
  Done puts auto back off, as one more step, with nothing written over the marks; what it gives back is read from
  the board as it is then (round 2, below). If the player switches auto themselves while the trainer is open, Done
  leaves it. A new game, Next practice puzzle, Restart and custom entry close the trainer.
- **J.** Check reads a cell's centre marks as its list, and its corner marks too under "exhaustive". With the
  contract unknown it asks the mark question first only when that changes what it checks (round 2, below), and
  the answer runs Check; closing the question runs nothing.
- **K.** Erase in Digit mode with auto on: the digit, then the struck candidates, then the colours. The hidden
  manual marks are never touched.
- **Lows fixed.** Ctrl/Cmd+C, X and V (and Alt with the mode keys) leave the entry mode alone, and Ctrl/Cmd+S
  swaps nothing. The Touch help says the hold works in Digit mode. With auto on, a cell whose candidates are all
  struck draws nothing (src/ui/Grid.tsx). Swap with nothing to swap says so ("No marks to swap in the selected
  cells").

## The feature as built

- **M. One rule for where a list goes** (`listLayer`): the layer of Corner or Centre mode when one is active;
  in Digit or Colour mode the setting **Candidates go in** (the old materializeLayer, which the first auto-off
  prompt sets). Settings shows it under Candidates, next to "Keep candidates when Auto is switched off", with its
  own words, and it no longer greys out when that switch is off. Fill candidates, switching auto off (when it
  writes) and Gather follow it, and the Fill button's title names the layer. The auto-off prompt still asks once,
  and the layer chosen there is used for that switch-off whichever mode is active; its notices are unchanged, and
  its text says what the choice sets (Keep candidates, and the layer as Candidates go in, which Digit and Colour
  mode use).
- **N. Gather** (`gatherMarks`): the marks into one layer. Scope as Swap's: the selected empty cells, else every
  empty cell, and the notices say which ("in 2 selected cells", "Nothing to gather into centre marks in the
  selected cells"). A cell with marks in only the other layer moves them across; a cell with marks in both is left
  as it is, and counted: "Gathered into centre marks in 23 cells; 2 cells have marks in both and were left as they
  are". Nothing to gather, or auto on, says so and changes nothing. One history step; pure notation (never help);
  the contract does not change.
  - On the Swap button: held for 500 ms in Corner or Centre mode it arms (a short vibration), and the button reads
    "→ Corner" or "→ Centre"; lifting on the button gathers, sliding off cancels. A tap is Swap, and in Digit or
    Colour mode a hold is a tap.
  - Shift+S gathers into the layer Fill uses: that of Corner or Centre mode, else the "Candidates go in" layer.
    The base mode decides, since Shift itself makes the mode Corner while held.
  - The Swap button's title, "What the buttons do", the Candidates and Touch help and the keyboard list say so,
    each with the scope (the selected cells, or the whole board).
- **The layout of corner marks** in the help: in a cell that also has centre marks they move round the edge.

## The review of the fixes (round 2)

A review of the fixes above found eight standing findings, three on which the skeptics split, and eight lows.
All are fixed here except one low, listed under Left as they are.

- **The chain trainer's handover** (three standing mediums and a split one). Undoing an applied chain did not
  undo it in the handover, so Done turned the undone elimination into a hidden strike with auto off (Fill then
  "corrected" the player's restored marks from it); pressing Chain again while the trainer was open dropped the
  handover, so Done left auto on; and an Undo past the trainer's opening turned auto off and left the trainer
  open, taking taps on candidates the board did not draw. Now (`startChain`, `endChain`, `trainerAfter`):
  - The handover keeps each cell's exclusions from before the trainer opened and right after (`before`,
    `opened`), not a list of what was applied. Done reads the board as it is then: each empty cell keeps the
    player's marks less each digit struck now that was not struck when the trainer opened (an applied chain still
    applied, a candidate struck by hand meanwhile). The marks are the hidden ones on the board, which are the
    marks as the trainer found them, changed only by the player's own steps since (an applied chain takes its
    digits out and Undo puts them back; a digit placed meanwhile takes itself from its peers, which keep that). Its exclusions are those struck now, less the handover's own
    (the player's lists, which live on as the marks) and less the cell's solution digit (a slip struck by hand,
    which shows as a digit gone from the marks where there are any). So a chain applied and undone leaves nothing,
    one still applied stays out of the marks and struck (also where the cell has no marks), and no strike with
    auto off hides a true digit.
  - Chain pressed again while the trainer is open on the candidates it switched on keeps the handover, with no
    new step; Done still switches auto off.
  - An Undo, a Redo or Check's jump back that leaves auto off closes the trainer cleanly: no handover left, the
    board as the step says. One that keeps auto on keeps it open.
- **Untrue words** (three standing mediums and a low). Fill's and Gather's notices under auto, and Fill's title,
  told the player to turn auto off to keep the candidates as marks, which with Keep candidates off writes
  nothing. They now say only what is true whatever that setting: "Auto candidates are on: every empty cell already
  shows its candidates, so there is nothing to fill.", "...no marks of yours to gather while they are on." Swap's
  notice from main had the same sentence and says the same now. Gather's notices name the selection when the scope
  is the selection, and no help or title says "every mark" without the rule (the selected cells, or the whole
  board). Erase's title in Digit mode with auto on says what it now does ("Erase value, then restore struck
  candidates, then colours"), and so does the Erase line of "What the buttons do".
- **Check's mark question** (a standing medium and a split one). Check asked on any board with manual marks,
  although its answer changes what Check checks only where a corner mark counts under "exhaustive" and not under
  the other answers: an empty cell whose corner marks hold a digit its centre marks do not (`cornerMarksCount`; a
  cell with corner marks and no centre marks is the usual case). Elsewhere Check runs at once, as on main
  (a37c744), so a board of centre marks meets no new question. Check itself reads as on main: the centre marks as
  each cell's list under every contract, and the corner marks too under "exhaustive". When Check asks, the
  question names Check and each answer says what Check then does: "Check reads the corner and centre marks of a
  cell together as its list, and flags a list that has lost the true digit", or "Check passes over your corner
  marks, and reads only your centre marks as a cell's list" (no answer says a missing digit means nothing, since
  Check still flags a centre list that lost its digit).
- **Corner-mark lists at Auto on** (split). Under "unknown", corner marks adopted nothing at Auto on, so a list
  Gather moved into the corner layer, or a Fill of the selection with Candidates go in set to Corner, lost its
  eliminations at Auto on and then at the next Auto off. Now Auto on with the contract unknown and some empty cell
  with corner marks and no centre marks asks the mark question first (`contractFor: 'auto'`, "How should Auto
  candidates read your corner marks?"), and the answer switches auto on: "my remaining candidates" keeps the
  corner lists' eliminations, "partial notes" keeps only the centre marks'. Closing it leaves auto off. No
  question when no cell has corner marks alone, as on main. The help says Check and Auto ask too when the corner
  marks would change what they do.
- **Lows.** Enter held on a focused number key (or any button) toggled the digit on every repeat; its repeats are
  now kept from the page, so one press is one entry (src/ui/App.tsx). The first auto-off prompt said "Your choice
  becomes the default"; it now says what it sets. The words say Corner or Centre mode, never "tab". Spanish (and
  Norwegian) put button names in «» in the new and changed strings, as the rest of each file does. The Gather
  words are shorter where a phone wrapped them: the Shift+S row of the keyboard list (three lines at 390 px) and
  the Candidates go in text. This document says which findings were fixed and which were left.

## Tests

- tests/candidateLayers.test.ts: the store, one scenario per cluster from the reports (A, B, E, F, G, H, I, J, K,
  M for the rule of where a list goes, N for Gather, and Swap's notice); 33 of its first 43 tests fail on
  a37c744, the rest pin behaviour kept on purpose. Round 2 added 16 (the handover and Undo in I, Check's question
  in J, Auto on's question in F2, the words under auto in G, the selection in N) and changed one notice in N: 15
  of them fail on 20b799d; "a chain still applied at Done stays" and "with no cell of corner marks alone it asks
  nothing" pin behaviour kept. Tests whose corner marks alone now raise Auto's question answer it.
- tests/firstMove.test.ts: opening the trainer still counts the game as begun; after Done the board is as it was,
  so the reload case keeps the trainer open.
- tests/e2e/smoke.spec.ts: a mouse hold of 1.5 s on a number key enters once (Digit and Centre mode), the focused
  key still answers Enter; a digit key held with two repeats enters once, and S swaps once; Ctrl/Cmd with C, X and
  V keep the mode, and a cell with every candidate struck under auto draws nothing; on a phone, Swap held in
  Centre mode shows "→ Centre" and gathers, sliding off cancels, and a tap still swaps. Round 2: Enter held on a
  focused number key enters once; with auto on and Keep candidates off, the Erase and Fill titles and Fill's notice
  say what a press does; Check on a board of centre marks checks at once, and with a corner list asks in its own
  words; Auto on with a corner list asks, and keeps its eliminations once they are complete. The four fail on a
  build of 20b799d.
- Each fix was undone once and its tests seen to fail, then restored (the browser ones on a build of each); in
  round 2 the new tests were run against 20b799d (the store's in the suite, the browser's on its build).
- The checks of round 1: tsc; the whole unit suite (1567 passed); the path digest with its menus, unchanged; the
  build (270 pages); and the browser tests, 100 of 100 in both font setups.
- The checks of round 2: tsc; the whole unit suite (1583 passed); the path digest with its menus, unchanged; the
  build (270 pages); and the browser tests, 104 of 104 in both font setups.

## Left as they are

- **The board picture and Position as text under "unknown"** (a confirmed medium of the hunt) write the engine's
  candidates, not the player's marks, unless the marks are declared complete. Whether Share should ask the mark
  question, or draw the marks as written, is the owner's decision, so it is left for him.
- **A wrong digit on the board when Auto goes off or Fill runs** (a low of round 2): the list written for each of
  its peers lacks the digit, and erasing the wrong digit later does not give it back (its placement recorded only
  the marks there were then), so Check flags a peer the player never touched. Main does the same; recording the
  written lists in the placed digit's `took` would fix it, and is left for a later round.
- **The chain trainer's own switch to auto candidates does not ask the mark question.** Under "unknown", corner
  marks alone adopt nothing in the trainer's view, as on main, but Done gives them back untouched, so nothing is
  lost.
- **A position link does not carry the mark contract** (a low), so the recipient reads the same marks as "unknown" (and
  colours come back in palette order). It needs a new payload version.
- **Hint and Scan under "notes" ignore centre lists** (a low) that Check and the ring read as candidates, so a hint can
  repeat an elimination already made in the centre marks.
- **A cell with nine corner marks and a centre mark draws eight corner marks** (a low) (eight places round the edge).
- **A centre list of five or more digits looks like a corner list** (a low) (same places, a lighter weight), so Swap on
  such a cell seems to do nothing.
- **Shift-click and Ctrl-click with a digit armed** (a low of the hunt) add the cell to the selection instead of entering the digit
  in the corner or centre layer. Shift- and Ctrl-click are documented as selection keys ("Add a cell to the
  selection", "Add cells to the selection"), and the code keeps that meaning deliberately (`armed && !add` in
  Grid.tsx), while Alt, which selects nothing, gives its temporary mode. Which should win is not clear from the
  code, so it is left, for the owner.
- **Both layers under "exhaustive"** (a decision of round 1, not a finding): Check, Hint and the ring read a cell's corner and centre marks together as
  its list, while turning auto on keeps a cell's centre list when it has one (F, as decided). In a cell with
  corner notes beside a centre list, the corner digits count for Check and not for the auto view.

Nothing sent from the device changed, so the privacy page is unchanged.
