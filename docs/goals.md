# Goals

## The mission

sudokUI exists to make its player the fastest solver in the room: someone
for whom no newspaper, airport or expert-website sudoku is an obstacle. It
gets there by skill, never by search, and it teaches easiest first.

The app does not say this anywhere. It is simply built so that a player
who follows it ends up there.

## What "every sudoku" means

Every valid sudoku yields to logic, but the hardest few hundred ever
published (the Golden Nugget class) need forcing nets: branching chains
that nobody spots as a pattern, and that the engine itself files under
last resort. Those are search, not skill, and the mission stops short of
them on purpose.

Everything else, which is every puzzle anyone meets in daily life and on
the expert sites, is covered by the catalogue through AICs with ALSs, the
uniqueness family and Exocets. That is the ground the app must own.

## Principles

1. **Easiest first.** The solver takes the cheapest technique at every
   step, the guide ranks by solver order, practice fast-forwards to the
   target move. Nothing asks the player for a harder idea than the
   position needs.
2. **Skill, not search.** Forcing chains and nets exist in the engine so
   every puzzle can be rated, but they are never the thing being taught.
   Hints, practice and the learning path stop at what a human can see.
3. **Chains are the skill that generalises.** X-Wing, Skyscraper, W-Wing,
   Nice Loop and AIC are one idea at rising generality: strong and weak
   links. A player who builds chains from scratch solves puzzles that need
   any named pattern. The named techniques are the vocabulary; chain
   building is the fluency.
4. **Measured, not asserted.** Frequencies come from millions of rated
   puzzles, examples are re-derived by the engine, and every claim the
   guide makes is held by a test. The same goes for the player: what they
   can do is observed from their play, not assumed from a level badge.
5. **Speed is the output.** The fastest solver is the one who recognises
   the pattern first. Everything the app teaches should end as recognition,
   which is why practice puts the target move next and why the stats will
   measure time to the first non-single move.
6. **Offline, free, private.** Everything runs on the device. No account,
   no upload, no ads. Learning data stays with the player.

## The road, in order

1. **Learning path from the player's own play.** Attribute every unaided
   move to the easiest technique that justifies it, keep the counts, and
   let the guide say "learn this next": high worth (frequency weighted by
   cost), low unaided use. Built: [technique-stats.md](technique-stats.md),
   with the path on top of it: the techniques needed in at least one
   puzzle in a hundred, in solver order, each learned after three unaided
   uses, the next one a click from its practice (`src/content/path.ts`).
2. **Chain trainer.** The player builds a chain on the board link by link;
   the engine checks each link and says what the chain proves so far. The
   reverse of the hint renderer that draws chains today. Built:
   [chain-trainer.md](chain-trainer.md).
3. **"Why not?" on every mistake.** When Check flags a placement, show the
   technique that proves the digit wrong. Mistakes are where learning
   happens. Built: Check names the peer that already holds the digit or
   the easiest technique that removes it, and "show me" plays the proof
   ([technique-stats.md](technique-stats.md)).
4. **A generator that serves the player's level.** Any band in under a
   second, a shipped seed library with transformations so nothing repeats,
   minimality and path-quality filters. Built: [generator.md](generator.md).
5. **The hardest puzzles, collected.** Published extremes with credits and
   the engine's step-by-step, so the top of the ladder has real opponents.
   Exocets and their kin are collected, not generated; nobody generates
   them live.
6. **Speed training.** Timed recognition drills on single patterns, then
   whole puzzles against the player's own best, once the stats exist to
   make the numbers mean something.

Variants (killer, thermo, arrows) wait behind all of this. They would
double the engine and teach nothing the mission needs.

## What is already in place

- A generator that serves any band in well under a second, the hardest
  bands and the rarest practice techniques from saved puzzles through
  random isomorphisms, so nothing repeats ([generator.md](generator.md)).
- 80 techniques catalogued and explained, 77 implemented, each with a
  worked example where one exists, and frequencies from 2.8 million rated
  puzzles.
- Progressive hints that reason from the player's own candidates, with the
  assisted and unassisted solve tiers.
- Practice mode for 65 techniques, with saved puzzles for the rarest,
  each puzzle within one band of its technique's class, and "you found
  it" when the player's own move is the target.
- The player's record: every unaided move credited with the easiest
  technique that justifies it, the game summed up at the end, mastery
  per technique in the guide and a "learn next" order, the band records
  and the daily streak. On the device only.
- Scan: every technique that fires in the position, or one asked for by
  name.
- The guide sorted by family, difficulty, frequency or worth, with every
  term linked to the glossary.
