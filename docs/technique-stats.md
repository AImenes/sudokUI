# Per-player technique stats (design, not built)

What a player has actually done, technique by technique, so the guide can
say "worth learning next" from their own play rather than from averages,
and a finished game can be summed up: "48 placements: 31 naked singles, 12
hidden singles, 3 needed locked candidates, 2 needed an X-Wing, all your
own; one XY-Wing from a hint."

## Why it is possible

The app never needs to know what the player was thinking, or whether their
pencil marks are complete. It needs the position, and it has it:

- `gameStore.history` holds a snapshot of the board before every move.
- Every applied hint is a known technique (`applyHint`), and Scan, Check
  and the solution view already mark a game as assisted.
- `solvePath(puzzle)` caches the engine's own path for the puzzle.
- `contractGrid` already turns the player's own marks into a grid the
  solver reasons from (the marks-aware hints).

## Attributing an unaided move

For each placement or candidate removal the player makes without a hint,
ask of the position just before it: what is the easiest technique that
justifies it?

1. Build the grid from the placed digits (givens and entries), with the
   full candidate set. The player's marks are not needed; under the
   exhaustive contract they may be used to skip eliminations already made.
2. If the placement is a naked or hidden single in that grid, credit that.
3. Otherwise the player made eliminations in their head first. Run
   `findNextStep` repeatedly from that grid until the placement becomes a
   single, and credit the hardest technique on that short path. Stop at a
   budget (a few hundred milliseconds, in the worker); past it, credit
   "beyond the catalogue".
4. A candidate the player crosses out is credited with the easiest
   technique whose eliminations include it, found the same way.

The credit is the easiest known justification, not the player's reasoning:
a player who saw an XY-Wing where a hidden pair would also do is credited
with the hidden pair. A lucky guess is credited with whatever justifies it.
A placement later erased or flagged by Check counts as an error, not a
technique.

## Storage

A small persisted store (`sudokui-stats-v1` in localStorage), keyed by
technique: `{ unaided: number, hinted: number, lastUsed: ISO date }`, plus
per-game counters for the post-game summary. Nothing leaves the device.

## Surfaces

- Post-game summary in the win dialog: the counts above, with the
  techniques linked to the guide.
- A mastery column in Learn's technique list: "used 12 times, 2 with
  hints", and a fifth sort order, "learn next": high worth (frequency ×
  cost) and low unaided use first.
- The practice picker can show the same numbers.

## Cost

Engine: one function, `justify(grid, move)`, with tests against known
positions. Store: a dozen lines. UI: the summary, the column and the sort.
About half a day of work; roughly 4 to 6% of a weekly budget.
