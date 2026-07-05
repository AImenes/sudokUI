# Ninefold

A modern, cross-platform sudoku app — the spiritual successor to [HoDoKu](http://hodoku.sourceforge.net/).
Play beautifully (SudokuPad-style pencil marks and colouring), **practise specific
techniques** (empty rectangle, XY-wing, skyscraper…), and get a **HoDoKu-compatible
difficulty rating** for every puzzle.

The name: a *ninefold* is a thing made of nine parts — nine rows, nine columns,
nine boxes. It also nods to the "fold" of logic each technique adds.

> Not a commercial project. Built for the love of the puzzle.

## Why this exists

HoDoKu (Java, last updated 2020) has the best sudoku solving-technique library
around, but it's a desktop-only Swing app. Ninefold reimplements its engine in
**TypeScript** so the exact same logic runs on the **web, iOS and Android** from
one codebase, with a touch-first playing experience.

## Stack

- **TypeScript + React + Vite** — one codebase, runs everywhere.
- **Web is the primary target** (installable PWA, works offline).
- **iOS / Android** via [Capacitor](https://capacitorjs.com/) — the same build
  wrapped as a native app (see *Mobile* below). This is why the stack is TS/React
  rather than Python: no mature framework ships the *same* sudoku UI to web, iOS
  and Android, and a browser-based engine avoids a server round-trip for solving.
- The solving engine is **pure, framework-free TypeScript** (`src/engine/`) so it
  can be reused, tested, or run in a Web Worker with no DOM.

## Features (HoDoKu parity)

| HoDoKu feature | Ninefold |
| --- | --- |
| Play with given/entered digits | ✅ digit mode |
| Candidate pencil marks | ✅ corner **and** centre marks (SudokuPad-style) |
| Auto-fill / show all candidates | ✅ "Auto cands" (3×3 layout) and "Fill cands" |
| Cell colouring | ✅ 9-colour palette, multi-colour per cell |
| Difficulty rating (summed technique scores) | ✅ identical scores & bands (see below) |
| Solve step-by-step / hints | ✅ progressive hints (name → explanation → apply) |
| Practise a specific technique | ✅ generates a puzzle needing it, with no harder step required before it; the game fast-forwards to the position where it is the next step |
| Puzzle generator with symmetry | ✅ rotational / mirror / none, unique-solution guaranteed |
| Import / export puzzle strings | ✅ 81-char strings, with auto-rating on import |
| Keyboard driven | ✅ full keyboard + mouse-drag + touch multiselect |
| Undo / redo, timer, pause | ✅ |

### Rating model

Ratings come straight from HoDoKu's defaults (`Options.java`), so a puzzle rated
"Hard / 1450" here matches HoDoKu. The solver applies the cheapest applicable
technique at each step, sums the technique scores, and picks the band:

| Band | Max score |
| --- | --- |
| Easy | ≤ 800 |
| Medium | ≤ 1000 |
| Hard | ≤ 1600 |
| Unfair | ≤ 1800 |
| Extreme | above |

The full technique catalogue with HoDoKu scores lives in
[`src/engine/ratings.ts`](src/engine/ratings.ts).

### Techniques implemented

Singles (full house, naked, hidden) · locked candidates (pointing/claiming) ·
naked & hidden subsets (pair→quad) · basic fish (X-wing, swordfish, jellyfish) ·
finned & sashimi fish · skyscraper · 2-string kite · turbot fish · empty
rectangle · XY-wing · XYZ-wing · W-wing · remote pairs · unique rectangles
(types 1/2/4) · BUG+1 · simple & multi colours · **3D Medusa** · **Sue de Coq**
· X-chain · XY-chain · ALS-XZ · brute-force fallback.

3D Medusa and Sue de Coq follow the definitions on
[sudokuwiki.org](https://www.sudokuwiki.org/). Every technique is covered by a
soundness harness (`tests/soundness.test.ts`): whatever fires during a solve,
its placements must match the brute-force solution and its eliminations must
never remove a solution digit.

Roadmap techniques (rated & offered by HoDoKu, not yet ported) are marked
`implemented: false` in `ratings.ts`: more UR types, hidden/avoidable
rectangles, nice loops, AICs/grouped chains, ALS chains, complex
(franken/mutant) fish, and forcing chains/nets. Adding one is: write a finder
in `src/engine/techniques/`, register it in `humanSolver.ts`, flip the flag —
the soundness harness validates it wherever it fires.

## Project layout

```
src/
  engine/            framework-free solving engine (unit-tested)
    board.ts         bitmask grid model, units/peers/candidates
    bruteForce.ts    backtracking solver + solution counter
    ratings.ts       HoDoKu technique catalogue, scores, difficulty bands
    steps.ts         Step type (placements/eliminations + highlight data)
    humanSolver.ts   applies techniques in HoDoKu order, rates a puzzle
    generator.ts     full-grid + hole-digging generator, "generate where"
    worker.ts        Web Worker: background generation & pooling
    techniques/      one file per technique family
  state/             zustand stores (game, settings, puzzle pools)
  ui/                React components (SVG grid, controls, dialogs)
tests/               vitest engine + practice-generation tests
```

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + practice tests
npm run build      # production build + PWA service worker
```

> This machine has no system Node. A local copy was installed at
> `~/.local/node22`; prepend `export PATH="$HOME/.local/node22/bin:$PATH"` or
> install Node 18+ however you prefer.

## Mobile (iOS & Android)

The web build is wrapped natively with Capacitor — no code changes, same UI:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init Ninefold app.ninefold --web-dir dist
npm run build
npx cap add ios      # opens in Xcode:        npx cap open ios
npx cap add android  # opens in Android Studio: npx cap open android
```

The generator runs in a Web Worker, so heavy puzzle search never blocks the UI on
any platform.

## Credits

Solving-technique logic, scores and difficulty bands are derived from **HoDoKu**
by Bernhard Hobiger (GPLv3). 3D Medusa and Sue de Coq follow
[sudokuwiki.org](https://www.sudokuwiki.org/). Ninefold is an independent
reimplementation released under the GPLv3 (see `LICENSE`).
