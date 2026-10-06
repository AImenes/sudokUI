# Per-player technique stats

What a player has actually done, technique by technique, so the guide can
say "learn this next" from their own play rather than from averages, a
finished game can be summed up ("45 moves of your own: 31 × Naked Single,
12 × Hidden Single, 1 × X-Wing. From hints: 1 × XY-Wing. 2 wrong digits."), a
practice puzzle can say "you found it", and a wrong digit can be proved
wrong. Road items 1 and 3 of [goals.md](goals.md), built.

## Why it is possible

The app never needs to know what the player was thinking, or whether their
pencil marks are complete. It needs the position, and it has it:

- the board before every move is in hand when the move is made;
- every applied hint is a known technique (`applyHint`);
- `contractGrid` already turns the player's own marks into the grid the
  solver reasons from (the marks-aware hints).

## Attributing an unaided move

`justify(grid, move)` in `src/engine/justify.ts` answers, for a placement
or a candidate removal in a position: what is the easiest technique that
justifies it?

1. The grid is the player's position: placed digits, and the candidates
   as the solver would see them (auto candidates minus the player's
   strikes, or the marks under the exhaustive contract).
2. A placement that is a full house, a naked single or a hidden single in
   that grid is credited directly, and the step is built for that very
   cell (`singleAt`), so it can be shown as a hint.
3. Otherwise the player made eliminations in their head first. The solver
   plays on from the grid, cheapest technique first, until the placement
   becomes a single or the candidate is gone; the hardest technique on
   that short path is the credit, and the path is the proof.
4. Past the budget (60 steps or 300 ms), the move is "beyond the
   catalogue": credited to no technique, but counted.

The credit is the easiest known justification, not the player's reasoning:
a player who saw an XY-Wing where a hidden pair would also do is credited
with the hidden pair. A lucky guess is credited with whatever justifies
it. A wrong digit, or a true candidate struck out, counts as an error, not
a technique. The work happens in the background worker
(`justifyMove` in `src/state/pools.ts`), so a placement never waits for
the solver.

What is a move: a digit placed; a candidate struck out with auto
candidates on; a mark taken away under the exhaustive contract (when the
marks are declared to be the candidates). Marks that are notes (the open
contract, or undeclared) are not moves.

## Storage

`useStats` in `src/state/stats.ts`, persisted as `sudokui-stats-v1`:

- per technique: `{ unaided, hinted, lastUsed }`;
- the running game's tally: unaided and hinted per technique, errors,
  moves beyond the catalogue;
- per band: solves, unassisted solves, best and total time;
- the days the daily puzzle was solved, for the streak.

Nothing leaves the device.

## Surfaces

- **The win dialog**: the game summed up in a sentence; the player's
  record in the band ("Your 5th Hard solve, a new best"); the daily
  streak; for practice, whether the technique was found, hinted or
  bypassed.
- **Practice**: the puzzle knows the step it was prepared for
  (`practiceTarget`). When the player's own move does what that step does
  (its placement, one of its removals, or a digit placed where its
  removals leave only it), the bar says "found" and a toast says so.
- **Why not?**: when Check finds a wrong digit, it says why: a peer that
  already holds it, or the easiest technique that removes it from the
  cell (or, failing that, places the right digit), found by `justify`
  from the position with the wrong digits taken off. "Show me" removes
  the wrong digits, plays any easier steps on the way, and shows the
  proving step as a hint; Ctrl+Z goes back.
- **The guide**: each technique's row carries "Your play: n unaided, h
  from hints", and a fifth order, "Learn next": worth (frequency weighted
  by cost) divided by one plus the unaided uses, so a technique the
  player has shown they can do moves down the list.

- **The path** (📈 in the top bar, `src/content/path.ts`): the
  practisable techniques needed in at least one generated puzzle in a
  hundred, in solver order, grouped by class. A technique is learned
  after three unaided uses; the first unlearned one is next, with its
  practice a click away. Below it, the record: solves, unassisted solves,
  best and average time per band, and the daily streak.

## The practice ceiling

A practice puzzle needs nothing harder than its technique before the
target move, and now nothing much harder after it either. A technique of
a class up to Hard is practised in a puzzle at most one band above its
class (`practiceCeiling` in `src/engine/ratings.ts`), so an X-Wing drill
is never an Extreme puzzle after the move. Unfair-class techniques and
above have no ceiling but the top: a puzzle that needs an AIC is an
Extreme or a Nightmare by nature. The stored practice puzzles were
refiltered and rebuilt under the rule (`scripts/build-practice.ts`), the
worker rates practice candidates no further than the ceiling, and the
pools file a puzzle under a technique only when it is within it.

## Tests

`tests/justify.test.ts` (direct singles, removals credited to their
technique, a placement that needs the XY-Wing first, wrong moves, the
budget), `tests/stats.test.ts` (the counts, the streak, the order, the
sentence), `tests/learner.test.ts` (the practice target found, the error
counted, Check's proof and "show me", the hint counted),
`tests/pools.test.ts` and `tests/generator.test.ts` (the ceiling), and
the browser smoke test (`tests/e2e/smoke.spec.ts`, "why not").
