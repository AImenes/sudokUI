# The docs: what each one decides

Start here. Every decision a session reaches is written into one of these
and committed, so a new branch or a new session starts from the repository,
not from a chat. Where two disagree, the newer one wins, and should be fixed.

## Standing rules

- **Search is part of every change** (the owner, 2 November 2026). Anything
  a visitor should be able to find is a static page as well as whatever the
  app shows: words a dialog shows come from one copy that also builds a page
  (src/content/learnPages.ts), in all three languages, with a title of 60
  characters or fewer and a description of 160 or fewer that leads with the
  teaching, language alternates, a sitemap entry and a link from every
  footer. Never a page per generated puzzle (online-goals.md, "Do not
  build").
- **Light first.** No dialog on a first visit; nothing over the board that
  the player did not ask for. No accounts, no database for reach.

## Why, and the road

- [goals.md](goals.md): the mission (the fastest solver in the room, by
  skill), the six principles (offline, free, private, no account) and the
  road in order.
- [online-goals.md](online-goals.md): what a server may do and the lines it
  will not cross; share links, the daily, ID-less counting; the reach
  section points to the reach plan.
- [reach-plan-2026-11.md](reach-plan-2026-11.md): the ranked reach plan of
  November 2026 (what to build, what the owner does, Reddit's rules, what
  not to do, how to measure); its evidence in
  [reach-research-2026-11.md](reach-research-2026-11.md).

## The hints and their drawings

- [hint-drawing.md](hint-drawing.md): the spec, G1 to G25, the colours, and
  the Status of every phase and review round. The reference for any drawing.
- [hint-drawing-handoff.md](hint-drawing-handoff.md): where the hint work
  stands and what is next. Read before resuming it.
- [hint-drawing-colouring.md](hint-drawing-colouring.md) (phase 3) and
  [hint-drawing-sets.md](hint-drawing-sets.md) (phase 4): each phase's
  settled design, with its As built.
- [hint-drawing-p4-round2.md](hint-drawing-p4-round2.md),
  [hint-drawing-p4-round3.md](hint-drawing-p4-round3.md),
  [hint-readability-round1.md](hint-readability-round1.md): review rounds,
  what each found and fixed, and the lows left for later.
- [hint-readability-2026-11.md](hint-readability-2026-11.md): every
  technique's hint scored against HoDoKu, the issues, the quick wins and
  the phases after them.
- [highlighting.md](highlighting.md): how a technique is shown, before the
  hint drawings.
- [chain-trainer.md](chain-trainer.md): building a chain on the board, link
  by link.

## The engine and the content

- [architecture.md](architecture.md): how the app is put together.
- [generator.md](generator.md): making and rating puzzles.
- [technique-stats.md](technique-stats.md): the learning path from the
  player's own play.
- [concepts_description.md](concepts_description.md) and
  [glossary_input.md](glossary_input.md): the techniques' families and names,
  and the glossary in three languages.
- [translations.md](translations.md): how nb and es are kept.
- [search.md](search.md): the static Learn and landing pages.
- [photo-import.md](photo-import.md) and [scan.md](scan.md): scanning a
  puzzle from a photo.

## Running it

- [deployment.md](deployment.md): Cloudflare, deploys from main.
- [connect-the-analytics.md](connect-the-analytics.md),
  [connect-the-database.md](connect-the-database.md),
  [connect-the-feedback.md](connect-the-feedback.md): the owner's one-time
  setup steps.
- [review.md](review.md) and [handoff-2026-10-07.md](handoff-2026-10-07.md):
  October's review and handoff, kept for history.
