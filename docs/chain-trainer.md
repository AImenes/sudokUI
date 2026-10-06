# The chain trainer

Road item 2 of [goals.md](goals.md): the skill that generalises. Every
named chain technique, X-Wing to AIC, is strong and weak links in a row;
a player who can build one from scratch solves puzzles that need any of
them. The hints draw chains for the player to read; the trainer has the
player write them.

## How it plays

⛓ Chain in the Assist box (it counts as assistance: the engine checks
every link). Auto candidates come on, because the player taps
candidates, not cells.

- The first tap starts the chain. Each next tap must link to the last
  candidate: a **strong link** (the other candidate of a bivalue cell, or
  the digit's only other place in a row, column or box: one of the two is
  true) where the chain needs one, a **weak link** (two candidates of one
  cell, or the same digit in two cells that see each other: not both
  true) elsewhere. A strong link may serve as a weak one. Strong first,
  then alternating.
- The panel says what each link is in the technique's words ("r1c1 holds
  only 4 and 5, so one of them is true"; "r3c4 and r7c4 are the only
  places for 5 in column 4"), refuses what is not a link or is weak where
  a strong link is needed, and reads the chain back from its first
  candidate: "If the 4 in r1c1 is false, then the 5 in r1c1 is true, so
  the 5 in r3c1 is false, ...".
- A chain that ends on a strong link proves that one of its two ends is
  true, so every candidate that sees both ends is false. The panel lists
  them and **Apply** removes them; each removal is credited like any
  unaided move (docs/technique-stats.md). The board draws the chain
  exactly as a hint would: solid arrows for strong links, dashed for
  weak, red for what goes.
- Backspace takes the last candidate off, Clear starts over, Escape or
  Done leaves.

A chain built from the player's own candidates is sound only if those
candidates are right; a true candidate struck out earlier could mislead
it. Apply therefore checks the chain's removals against the solution and,
rather than damage the board, says that a candidate on the board is wrong
and points to Check.

## Code

`src/engine/chainTrainer.ts`: `classifyLink` (the vocabulary), `extend`
(alternation enforced, the message), `statement` (the chain read back),
`conclusions` (what sees both ends), `chainStep` (the step the board
draws). The game store holds the chain (`chain`, `chainNote`) and draws
it through `hint`; the board's pointer handler picks the candidate glyph
under a tap while a chain is being built; `ChainPanel` in HintPanel.tsx
is the panel. Tests: `tests/chainTrainer.test.ts` (the engine's own
X-Chain, XY-Chain and AIC examples are accepted link by link and reach
their eliminations; refusals), and a browser test.
