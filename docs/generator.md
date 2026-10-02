# The generator

The generator serves the player's level: a puzzle of the band they asked
for, on the board in under a second, never the same one twice, and every
puzzle proper, minimal and worth solving. Road item 4 in [goals.md](goals.md).

## How a puzzle is made

1. **A full grid.** Random backtracking fills the 81 cells.
2. **Digging.** Clues are removed in random order, one at a time or in
   rotationally symmetric pairs (seven puzzles in ten), and a removal
   stands only if the puzzle stays proper. The puzzle was proper before
   the removal, so any second solution would have to differ in one of the
   emptied cells: the check is that no other digit can go in any of them,
   a few targeted solver calls instead of a full count. A clue that cannot
   be removed now can never be removed later, so the result is minimal:
   every clue left is needed. With a symmetry it is minimal as pairs: no
   pair can go, though a clue on its own often could, about six per
   puzzle. The symmetry is kept whole on purpose; a puzzle dug without one
   has about three clues fewer.
3. **Rating.** The human solver plays the puzzle with the cheapest
   technique at every step and sums the scores
   ([sudoku-difficulty-rating](https://sudokui.app/sudoku-difficulty-rating/)).
   When a band is wanted, the rating stops the moment the puzzle is past
   it. The band of a path only ever rises: the hardest technique's band,
   Hard once two Hard-class steps are in, the score over a cap. When a
   technique is wanted for practice, it stops at the first step above the
   technique in solver order if the technique has not appeared yet, since
   the puzzle could no longer need it cleanly.
4. **Filters.** Proper, minimal as above, solvable by the catalogue (no
   brute force anywhere on the path), and, for a band, the crux on a live
   board: the hardest technique first fires with at least 20 empty cells,
   so the pattern is met on a board with room in it, not as an endgame
   formality. The crux may not be BUG+1 either, which by its nature fires
   only when every other cell is down to two candidates. Practice puzzles
   skip the last two: practice fast-forwards to the move, so where it
   falls does not matter. The crux is one definition for the whole app,
   `cruxIndex` in `src/engine/generator.ts`: the first step of the hardest
   technique by solver order, the step the solution path dialog marks.

The brute force solver underneath propagates naked and hidden singles
before every branch. That is what makes the dig fast: the search tree of
a uniqueness proof shrinks by an order of magnitude, and the dig makes
exactly the same decisions as before in the same random order, so the
daily puzzle for any date is unchanged (`tests/daily.test.ts` pins four
dates). The daily puzzle is pinned as it was and skips the filters.

The dig itself is not guided by the rating, and does not need to be: it
costs 2 ms, and rating a Beginner to Hard puzzle costs 1 to 6 ms, so a
band is found by trying, with the rating stopping early on everything
that overshoots. Guiding the dig would cost a rating per removal, which
is the one expensive thing here.

## Where the time goes

Measured on the development machine with `scripts/bench-generator.ts`,
on an idle worker. A phone is slower, two to three times on a cheap one,
and the budget leaves room for that.

| Step | Before | After |
| --- | --- | --- |
| Dig, seven in ten symmetric | 48 ms | 2 ms |
| Rating, Beginner to Hard | 1 to 6 ms | the same, less under a cap |
| Rating, Unfair and Extreme | 30 to 65 ms | the same, less under a cap |
| Rating, Nightmare | 0.5 to 0.7 s mean, up to 1.8 s | the same |

Random digging yields the bands in these shares: Beginner 53%, Easy 8 to
10%, Medium 12%, Tricky 5 to 7%, Hard 8%, Unfair 3 to 5%, Extreme 5%,
Nightmare 2 to 3%. (Easy is thin because it is a score band: singles only,
but heavy on hidden singles.) The crux filter rejects under 2% of all
puzzles. With the cap, a waiting player gets a puzzle of the band in
(20 puzzles per band):

| Band | Attempts | Wait, mean | p90 |
| --- | --- | --- | --- |
| Beginner | 1 | 4 ms | 10 ms |
| Easy | 8 | 41 ms | 125 ms |
| Medium | 6 | 34 ms | 118 ms |
| Tricky | 14 | 74 ms | 205 ms |
| Hard | 11 | 57 ms | 143 ms |
| Unfair | 16 | 184 ms | 748 ms |
| Extreme | 32 | 562 ms | 1.4 s |
| Nightmare | 23 | 463 ms | 872 ms |

Beginner to Hard come in a tenth of a second or so, with three times
that to spare on a phone. Unfair's tail, Extreme and Nightmare are over
the budget on a phone, and Nightmare is bounded below by its own rating
whatever the method: its puzzles are collected, not generated (goals.md,
item 5). Those three bands come from the seed library. Before this work
the same machine took 72 ms per attempt and 1 to 4 s for the upper bands.

## The seed library

`src/content/seeds.json` holds 48 puzzles for each of Unfair, Extreme and
Nightmare (`SEEDED_LEVELS` in `src/content/seeds.ts`), found by
`scripts/build-seeds.ts` on every core, held to the same filters, chosen
round robin over the technique that is each puzzle's crux so that no one
pattern dominates, each stored with its rating. The file is fetched only
when a seed is needed.

A seed is never played as stored. The worker takes the band's seeds in
random order and applies a random isomorphism to one: relabel the digits,
swap the three bands and the three stacks, the rows within each band and
the columns within each stack, and transpose or not. There are 2 × 6^8 ×
9! of them, about 1.2 × 10^12 per seed, and every one keeps the solution
unique and the clues minimal, so nothing repeats. Then it rates the
result, capped at the band, and serves it only if the band held. The
rating follows the solve path, and the path can change under an
isomorphism because the solver takes the first instance of a technique it
finds. Measured over 100 isomorphs per band: the band holds 99% of the
time for Unfair, 82% for Extreme and 86% for Nightmare, and the worker
takes the next seed when it does not. Rating the isomorph costs 11 ms
for Unfair and 32 ms for Extreme. A Nightmare isomorph is a Nightmare,
and no cap can stop the rating of the top band, so it costs a full
Nightmare rating, 0.3 to 0.7 s mean. That is why the seeded bands are
also stocked ahead of time: a few seconds after start-up the app verifies
one isomorph per seeded band in the background, and a top-up follows
every game, so the urgent path is the exception, a cold start on a device
that was never idle.

The saved practice puzzles for the rarest techniques
(`src/content/practicePuzzles.json`) are served the same way, through an
isomorphism, rated with the technique cap, and only if the technique
still comes cleanly.

```bash
npx vite-node scripts/build-seeds.ts          # all cores, 15 minutes
npx vite-node scripts/build-seeds.ts 40       # 40 minutes
npx vite-node scripts/bench-generator.ts      # the timing tables
```

`tests/seeds.test.ts` holds the library to the engine like the saved
practice puzzles: every seed is proper, minimal (as pairs when
symmetric), in its band, and passes the filters.

## The workers

Generation runs in two Web Workers, time-sliced so cancel messages get
through. A request from a waiting player is urgent: it has a worker of its
own, so it never queues behind a background rating of a monster, its
candidates are rated only as far as the wanted band or technique, and the
seeds it carries are served first. The generating dialog appears only
after a quarter of a second, since a seed answers in milliseconds. A
background top-up is not urgent: it rates every puzzle in full, so a
search for one band stocks the pools of every band and technique it
stumbles over, and the pools fill with fresh puzzles rather than seeds.
Candidates travel to the main thread once per slice and are filed in one
write.

## Nothing repeats

Pools hold eight puzzles per band and per technique in localStorage, and
a puzzle leaves every pool it sits in when it is played, so a puzzle
solved as a Hard game does not come back as X-Wing practice. The answer
to a request is never pooled, only the puzzles found on the way. Seeds
and saved practice puzzles are served through a random isomorphism each
time, and the pools fill behind them with generated puzzles. Generated
puzzles repeat with the probability of two random digs agreeing, which is
none.
