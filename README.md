# sudokUI

**sudokUI** (*sudoku + UI* — [sudokui.app](https://sudokui.app)) is a free,
open-source sudoku app for playing, practising and rating puzzles. It aims to
combine a first-class playing experience with the deepest solving-technique
library available in a browser — from a beginner's first naked single to
Death Blossoms and finned fish.

Runs as an installable, offline-capable web app (PWA). The same build wraps
natively for iOS and Android via Capacitor.

## Features

**Play**
- SVG board with given/entered digits, corner pencil marks (digit-bound 3×3
  positions), centre pencil marks, and multi-colour cell colouring
- Mouse, touch and full keyboard control; drag or modifier-click to
  multi-select; undo/redo; timer and pause
- Auto-candidates view, one-click candidate fill, error check
- Import/export puzzles as 81-character strings, rated on import

**Learn**
- Progressive hints: first the technique name, then the full explanation with
  the pattern highlighted on the board, then one click to apply it
- Practice mode: pick any technique and get a generated puzzle that genuinely
  requires it — with nothing harder needed before it. The game fast-forwards
  through the routine steps so the chosen pattern is the very next move
- The technique catalogue is fully visible in-app: implemented techniques are
  playable, unimplemented ones are shown crossed out, so you always see the
  complete map of sudoku solving

**Rate**
- Every puzzle gets a difficulty score: the solver plays it with the cheapest
  applicable technique at each step and sums per-technique scores
- Five bands: Easy (≤800), Medium (≤1000), Hard (≤1600), Unfair (≤1800),
  Extreme

**Generate**
- Unique-solution generator with rotational/mirror symmetry
- Background generation in a Web Worker — the UI never blocks
- Generated puzzles are pooled per difficulty and per technique, so new games
  and practice sessions usually start instantly

## Technique library

80 techniques catalogued, 49 implemented and enabled in the default solve
order:

| Family | Implemented |
| --- | --- |
| Singles | Full House, Naked Single, Hidden Single |
| Intersections | Locked Pair/Triple, Pointing, Claiming |
| Subsets | Naked/Hidden Pair, Triple, Quadruple |
| Fish | X-Wing, Swordfish, Jellyfish; Finned/Sashimi X-Wing & Swordfish |
| Single-digit patterns | Skyscraper, 2-String Kite, Turbot Fish, Empty Rectangle |
| Wings | XY-Wing, XYZ-Wing, W-Wing, WXYZ-Wing |
| Uniqueness | UR Types 1–6, Hidden Rectangle, Avoidable Rectangles 1/2, BUG+1 |
| Colouring | Simple Colours, Multi Colours, 3D Medusa |
| Chains | Remote Pairs, Chute Remote Pairs, X-Chain, XY-Chain |
| ALS | ALS-XZ, Sue de Coq, Death Blossom |

Not yet implemented (visible in-app, marked ✗): X-Cycles, AICs, grouped
chains, ALS-XY-Wing/Chain, complex (franken/mutant) fish, Exocet, SK Loops,
Fireworks, Tridagons, Aligned Pair Exclusion, Pattern Overlay, and the
forcing-chain family. Contributions welcome — see *Adding a technique*.

### Correctness policy

No technique ships unless it is fully understood and machine-verified. The
test suite includes a soundness harness that solves batches of generated
puzzles and probes every finder at every position: a step's placements must
match the brute-force solution and its eliminations must never remove a
solution digit. Rare patterns additionally get deterministic synthetic-position
tests. A finder that ever contradicts a solution fails CI.

## Quick start

Requires Node 18+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine, generator, practice and soundness tests
npm run build      # production build + PWA service worker
```

## Architecture

A guided tour of how everything ties together lives in
[docs/architecture.md](docs/architecture.md); the production deployment
runbook (Hetzner + Cloudflare, GitOps) is
[docs/deployment.md](docs/deployment.md).

```
src/
  engine/            framework-free TypeScript solving engine
    board.ts         bitmask grid model, units/peers/candidates
    bruteForce.ts    backtracking solver + solution counter
    ratings.ts       technique catalogue: scores, difficulty bands, ordering
    humanSolver.ts   applies techniques in order, rates puzzles
    generator.ts     full-grid + hole-digging generator with filters
    worker.ts        Web Worker for background generation & pooling
    techniques/      one module per technique family
  state/             zustand stores: game, settings, puzzle pools
  ui/                React components: SVG board, controls, dialogs
tests/               vitest suites incl. the soundness harness
```

The engine has no DOM or framework dependencies — it runs identically in the
browser, in a worker, and under Node in tests.

### Adding a technique

1. Write a finder in `src/engine/techniques/` returning a `Step`
   (placements, eliminations, highlight data, description).
2. Register it in `humanSolver.ts` and flip `implemented: true` in
   `ratings.ts`.
3. Run the tests — the soundness harness automatically validates the new
   finder wherever it fires. Add a synthetic-position test if the pattern is
   rare in random puzzles.

## Mobile builds

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init sudokUI app.sudokui --web-dir dist
npm run build
npx cap add ios && npx cap open ios          # Xcode
npx cap add android && npx cap open android  # Android Studio
```

## Roadmap

- Chain-based techniques: X-Cycles, AICs, forcing chains
- Photo import: scan a puzzle from a book with the camera
- Teacher/annotation mode: arrows, shapes and freehand drawing over the
  board for streams and classroom use
- Statistics and streaks

## Credits & license

The rating model (per-technique scores and difficulty bands) and much of the
technique semantics follow HoDoKu by Bernhard Hobiger; several newer
strategies follow the definitions documented at sudokuwiki.org. sudokUI is an
independent implementation, released under the GPL-3.0 license (see
`LICENSE`).
