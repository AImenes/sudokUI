# sudokUI

**Play it now: [sudokui.app](https://sudokui.app)** · free · open source · no ads · works offline

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![Tests](https://img.shields.io/badge/tests-vitest%20%2B%20soundness%20harness-brightgreen.svg)](tests)

**sudokUI** (*sudoku + UI*) is a free, open-source sudoku studio for playing,
practising and rating puzzles. It combines a first-class playing experience —
in the spirit of SudokuPad — with the deepest *verified* solving-technique
library available in a browser: **80 techniques catalogued, 77 implemented**,
from a beginner's first Naked Single to Exocets and Tridagons, each one
explainable step by step.

It runs as an installable, offline-capable web app (PWA). The same build wraps
natively for iOS and Android via Capacitor.

## Highlights

**Play**
- SVG board with given/entered digits, corner pencil marks (digit-bound 3×3
  positions, Snyder-friendly), centre pencil marks, and multi-colour cell
  colouring
- Mouse, touch and full keyboard control; drag or modifier-click to
  multi-select; hold-modifier temporary input modes; undo/redo; timer & pause
- Auto-candidates with per-cell strike-through exclusions, one-click candidate
  fill, error check with restore-to-last-correct
- Import/export puzzles as 81-character strings — every import is rated
- **Shareable links**: `sudokui.app/#p=<81 chars>` opens the exact puzzle

**Learn**
- Progressive hints: first the technique name, then the full explanation with
  the pattern drawn on the board, then one click to apply it. Every
  technique draws its logic: the houses it lives in as bands, chains as
  candidate-anchored arrows (solid for strong links, dashed for weak,
  HoDoKu-style), colouring as quiet ties with the witnesses as arrows,
  forcing chains as their line of forced singles. "Walk through it" reveals
  any drawing one idea at a time, ← and →, with a sentence for each
  (see [docs/highlighting.md](docs/highlighting.md))
- **Practice mode** for 61 named techniques: pick one and get a generated
  puzzle that genuinely requires it — with nothing harder needed before it.
  The game fast-forwards through the routine steps so the chosen pattern is
  the very next move, the puzzle stays within one band of the technique,
  and the bar says **found** when your own move is the one it was prepared
  for. The rarest techniques come from puzzles found in advance by a
  multi-hour search, so they start instantly too
- **Your record, on your device**: every move you make is credited with the
  easiest technique that justifies it, a finished game is summed up
  ("45 moves of your own: 31 Naked Singles, 12 Hidden Singles, 1 X-Wing.
  From hints: 1 XY-Wing."), the guide shows what you have used unaided and
  sorts by **learn next**, the path (📈) shows the techniques worth
  learning in the order puzzles need them with the next one a click from
  its practice, and the win dialog keeps your band records and the daily
  streak. **Why not?**: when Check finds a wrong digit it says
  why, from a peer that already holds it to the forced singles that would
  break the board, and shows it (see
  [docs/technique-stats.md](docs/technique-stats.md))
- **The guide** (📖 in the top bar): every one of the 80 techniques explained
  in three short parts (what the pattern is, why it works, how to spot it),
  most with a worked example drawn on a real board that you can open and
  play. A **glossary** defines the language of solving (strong link,
  conjugate pair, almost locked set…), and the terms inside every
  explanation link to it
- The same content is published as plain web pages:
  [sudokui.app/learn](https://sudokui.app/learn/) has one page per
  technique, the glossary, and
  [how the difficulty rating works](https://sudokui.app/sudoku-difficulty-rating/)
  with the full score table
- The complete technique catalogue is visible in-app with its ratings;
  unimplemented techniques are shown crossed out, so you always see the whole
  map of sudoku solving

**Rate**
- Every puzzle gets a difficulty score: the solver plays it with the easiest
  applicable technique at each step and sums per-technique scores
  (HoDoKu-compatible model)
- Eight bands: Beginner (≤400), Easy (≤800), Medium (≤1000), Tricky (≤1150),
  Hard (≤1600), Unfair (≤1800), Extreme (≤3000) and Nightmare above — the
  HoDoKu thresholds, with the extremes subdivided. One fish or wing makes a
  puzzle Tricky; several make it Hard
- Optional hidden-rating mode and "Surprise me"

**Generate**
- Unique-solution generator with rotational symmetry; every puzzle is
  minimal (no clue, or with symmetry no pair of clues, can be removed) and
  solvable by the technique catalogue
- Any difficulty band in well under a second: digging proves uniqueness
  with a propagating solver, and rating stops the moment a puzzle is past
  the band asked for. The hardest bands come from a shipped seed library,
  served through one of 10^12 isomorphisms each time so nothing repeats
  (see [docs/generator.md](docs/generator.md))
- Background generation in a Web Worker — the UI never blocks
- Puzzles are pooled per difficulty and per technique, so new games and
  practice sessions usually start instantly

## Technique library

80 techniques catalogued, **77 implemented, 73 enabled** in the default solve
order. The ≈ entries are implemented and tested but disabled because they are
*provably redundant* — anything they find, an enabled cheaper technique finds
first.

| Family | Techniques |
| --- | --- |
| Singles | Full House · Naked Single · Hidden Single |
| Intersections | Locked Pair · Locked Triple · Pointing · Claiming |
| Subsets | Naked/Hidden Pair · Triple · Quadruple |
| Basic fish | X-Wing · Swordfish · Jellyfish · ≈ Squirmbag · ≈ Whale · ≈ Leviathan |
| Finned fish | Finned/Sashimi X-Wing · Swordfish · Jellyfish |
| Complex fish | Franken X-Wing · Franken Swordfish (set-cover fish theorem) |
| Single-digit patterns | Skyscraper · 2-String Kite · Turbot Fish · Empty Rectangle |
| Wings | XY-Wing · XYZ-Wing · W-Wing · WXYZ-Wing |
| Uniqueness | Unique Rectangle Types 1–6 · Hidden Rectangle · Avoidable Rectangles 1/2 · Extended Rectangles · BUG+1 |
| Colouring | Simple Colours · Multi Colours · 3D Medusa |
| Chains & loops | Remote Pairs · Chute Remote Pairs · X-Chain · X-Cycles · XY-Chain · AICs · Nice Loops — each with grouped and ALS-augmented variants |
| ALS | ALS-XZ · ALS-XY-Wing · ALS-XY-Chain · Sue de Coq · Death Blossom |
| Miscellaneous | Aligned Pair Exclusion · Fireworks · Tridagon (per-position impossibility proof) |
| Last resorts | Exocet (per-position template proof) · ≈ Double Exocet · Pattern Overlay · Nishio / Digit / Cell / Unit forcing · Forcing Net with intersections |

Not implemented, by editorial decision (still visible in-app, marked ✗):
**Twinned XY-Chains** and **SK Loops** (historical patterns subsumed in
practice by the AIC/ALS engines) and the generic linear **Forcing Chain**
entry (AICs and Nice Loops *are* its linear forms; its net forms are
implemented). These are documented decisions, not gaps — contributions
welcome, see [Adding a technique](#adding-a-technique).

### Correctness policy: no mistakes

No technique ships unless it is fully understood and machine-verified.

- A **soundness harness** ([tests/soundness.test.ts](tests/soundness.test.ts))
  solves batches of generated puzzles and probes every finder at every
  position: a step's placements must match the brute-force solution and its
  eliminations must never remove a solution digit. A finder that ever
  contradicts a solution fails the suite.
- Expensive finders get the same treatment on dedicated hunts
  ([tests/hunt-heavy.test.ts](tests/hunt-heavy.test.ts)).
- Rare patterns additionally get deterministic **synthetic-position tests**.
- The hardest patterns carry **per-position proofs**: every Exocet step
  re-proves its base/target relation by exhaustive digit-template
  enumeration, and every Tridagon step re-proves the local impossibility by
  exhaustively assigning the trio to the twelve pattern cells.

## Quick start

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, generator, practice and soundness tests
npm run build      # production build + PWA service worker + static pages
```

`npm run build` ends by generating the static pages (the technique guide,
glossary, rating explainer and landing pages) and `sitemap.xml` into `dist/`.
They are not served by `npm run dev`; to look at them, build and then run
`npx wrangler dev`. How they are made, and what to do after adding or
renaming a technique, is in [docs/search.md](docs/search.md).

## Architecture

What the app is for, and the road ahead in order, is in
[docs/goals.md](docs/goals.md). A guided tour lives in
[docs/architecture.md](docs/architecture.md); the production deployment
runbook (Cloudflare Workers Builds) is [docs/deployment.md](docs/deployment.md).

```
src/
  engine/            framework-free TypeScript solving engine
    board.ts         bitmask grid model, units/peers/candidates
    bruteForce.ts    backtracking solver + solution counter
    ratings.ts       technique catalogue: scores, difficulty bands, ordering
    humanSolver.ts   applies techniques in order, rates puzzles
    generator.ts     full-grid + hole-digging generator, targets, filters
    transform.ts     grid isomorphisms (how a seed is served, never twice)
    worker.ts        Web Worker for background generation & pooling
    techniques/      one module per technique family, documented finders
  content/           the written content: technique explanations, glossary,
                     rating explainer, worked examples, and the builder
                     that turns them into static pages
  state/             zustand stores: game, settings, puzzle pools
  ui/                React components: SVG board, controls, dialogs
scripts/             build-learn (static pages), hunt-examples (worked
                     examples), measure-frequency (how often each
                     technique is needed), build-seeds (the seed library),
                     bench-generator, og-card, promo screenshots
tests/               vitest suites incl. the soundness harness & hunts
```

The engine has no DOM or framework dependencies — it runs identically in the
browser, in a worker, and under Node in tests. Grids are flat typed arrays
(`Uint8Array` values, `Uint16Array` 9-bit candidate masks), so the whole
solver is allocation-light and rates most puzzles in a few milliseconds
(the monsters past 3000 take most of a second).

## Contributing

Bug reports, feature requests and technique contributions are all welcome —
open an issue at
[github.com/AImenes/sudokUI/issues](https://github.com/AImenes/sudokUI/issues).

Every module starts with a documentation comment explaining the technique or
subsystem it implements, usually with a link to the reference definition
(sudokuwiki.org or HoDoKu). Reading `src/engine/techniques/` top to bottom is
meant to double as a course in advanced sudoku solving.

### Adding a technique

1. Write a finder in `src/engine/techniques/` returning a `Step`
   (placements, eliminations, highlight data, human-readable description).
2. Register it in `humanSolver.ts` and flip `implemented: true` in
   `ratings.ts`.
3. Run `npm test` — the soundness harness automatically validates the new
   finder wherever it fires. Add a synthetic-position test if the pattern is
   rare in random puzzles.
4. Explain it: add its entry to `src/content/techniqueDocs.ts` (the type
   system insists on one per technique) and its address to the slug
   snapshot in `tests/content.test.ts`. If it is another technique in
   disguise (a Hidden Single is a 1-fish), say so in `src/content/kin.ts`. Run
   `npx vite-node scripts/hunt-examples.ts` to find it a worked example.

## Mobile builds

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init sudokUI app.sudokui --web-dir dist
npm run build
npx cap add ios && npx cap open ios          # Xcode
npx cap add android && npx cap open android  # Android Studio
```

## Roadmap

Toward the best open-source sudoku tool anywhere:

- **Photo import** — scan a puzzle from a newspaper or book with the camera
  (see [docs/photo-import.md](docs/photo-import.md))
- **Teacher / annotation mode** — arrows, shapes and freehand drawing over
  the board for streams and classroom use
- **Statistics & streaks** — local solve history, per-technique mastery
  tracking; optional accounts (Cloudflare D1) for sync across devices
- **Curated library** — classic named puzzles (Escargot, Golden Nugget…) and
  a daily puzzle per difficulty band, next to today's shared daily
- **Custom solve-order editor** — reorder/disable techniques and see how
  ratings change; export your own rating profile
- **Accessibility & i18n** — full screen-reader support, colour-blind-safe
  palettes, translated UI and hint text
- **Native builds** — ship the Capacitor iOS/Android wrappers to the stores
- **Variants** — Killer, X-Sudoku, Chaos/irregular boxes (engine units are
  already abstracted as cell lists)

## Credits & license

The rating model (per-technique scores and difficulty bands) and much of the
technique semantics follow **HoDoKu** by Bernhard Hobiger; several newer
strategies follow the definitions documented at **sudokuwiki.org**. sudokUI
is an independent implementation, released under the **GPL-3.0** license
(see [LICENSE](LICENSE)).
