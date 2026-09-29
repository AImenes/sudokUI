// Finds one real, engine-verified example position per technique for the
// /learn/ pages and the in-app guide, and stores it in
// src/content/examples.json.
//
//   npx vite-node scripts/hunt-examples.ts             hunt for 15 minutes
//   npx vite-node scripts/hunt-examples.ts 40          hunt for 40 minutes
//   npx vite-node scripts/hunt-examples.ts refresh     re-derive the stored
//                                                      steps from their puzzles
//
// Hunting keeps whatever is already stored and only replaces an example
// with a clearer one (a smaller pattern on a fuller board). Run `refresh`
// after changing a finder or its description: tests/examples.test.ts
// fails when the stored steps no longer match what the engine produces.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generatePuzzle, cleanTechniques } from '../src/engine/generator';
import { Grid, cloneGrid, gridToString, parseGrid } from '../src/engine/board';
import { ratePuzzle, applyStep } from '../src/engine/humanSolver';
import { Step } from '../src/engine/steps';
import { SOLVE_ORDER, TECHS, Tech } from '../src/engine/ratings';

interface Example {
  puzzle: string;
  /** index of the step in the puzzle's solve path */
  stepIndex: number;
  /** the position just before the step: placed digits, 0 for empty */
  values: string;
  /** candidate bitmask of every cell in that position */
  cands: number[];
  step: Step;
}

const FILE = join(process.cwd(), 'src/content/examples.json');
const stored: Partial<Record<Tech, Example>> = existsSync(FILE)
  ? JSON.parse(readFileSync(FILE, 'utf8'))
  : {};

/** the example for `tech` at its first occurrence in the solve path */
function exampleFrom(puzzle: string, tech: Tech): Example | null {
  const rating = ratePuzzle(puzzle);
  if (!rating || !rating.solvable) return null;
  const stepIndex = rating.steps.findIndex((s) => s.tech === tech);
  if (stepIndex < 0) return null;
  const g = parseGrid(puzzle) as Grid;
  for (let i = 0; i < stepIndex; i++) applyStep(g, rating.steps[i]);
  return {
    puzzle,
    stepIndex,
    values: Array.from(g.values).join(''),
    cands: Array.from(g.cands).map((c, i) => (g.values[i] ? 0 : c)),
    step: rating.steps[stepIndex]
  };
}

/** lower is clearer: a small pattern, few links, a well-filled board */
function clutter(e: Example): number {
  const marks =
    (e.step.primary?.length ?? 0) + (e.step.secondary?.length ?? 0) + (e.step.fins?.length ?? 0);
  const links = e.step.links?.length ?? 0;
  const empty = e.values.split('').filter((v) => v === '0').length;
  return marks * 4 + links * 6 + empty + e.step.description.length / 40;
}

const save = () => {
  const ordered: Partial<Record<Tech, Example>> = {};
  for (const tech of SOLVE_ORDER) if (stored[tech]) ordered[tech] = stored[tech];
  writeFileSync(FILE, JSON.stringify(ordered, null, 1) + '\n');
};

if (process.argv.includes('refresh')) {
  let changed = 0;
  for (const tech of Object.keys(stored) as Tech[]) {
    const fresh = exampleFrom(stored[tech]!.puzzle, tech);
    if (!fresh) {
      console.log(`${tech}: the stored puzzle no longer needs this technique, example dropped`);
      delete stored[tech];
      changed++;
    } else if (JSON.stringify(fresh) !== JSON.stringify(stored[tech])) {
      stored[tech] = fresh;
      changed++;
    }
  }
  save();
  console.log(`refreshed: ${changed} example(s) changed, ${Object.keys(stored).length} stored`);
} else {
  const minutes = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 15);
  const deadline = Date.now() + minutes * 60_000;
  const wanted = SOLVE_ORDER.filter((t) => t !== 'BRUTE_FORCE');
  let puzzles = 0;
  let lastSave = Date.now();

  while (Date.now() < deadline) {
    const grid = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
    const rating = ratePuzzle(cloneGrid(grid));
    puzzles++;
    if (!rating || !rating.solvable) continue;
    const puzzle = gridToString(grid);
    // only techniques reached without anything harder before them, as in
    // practice mode: the example position is then within a learner's reach
    for (const tech of cleanTechniques(rating)) {
      if (!wanted.includes(tech) || TECHS[tech].category === 'Singles') continue;
      const candidate = exampleFrom(puzzle, tech);
      if (!candidate) continue;
      const current = stored[tech];
      if (!current || clutter(candidate) < clutter(current)) {
        if (!current) console.log(`+ ${tech} (${Object.keys(stored).length + 1}/${wanted.length})`);
        stored[tech] = candidate;
      }
    }
    // singles: any puzzle shows them, take the first of each from this one
    for (const tech of ['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'] as Tech[]) {
      if (stored[tech]) continue;
      const candidate = exampleFrom(puzzle, tech);
      if (candidate) stored[tech] = candidate;
    }
    if (Date.now() - lastSave > 30_000) {
      save();
      lastSave = Date.now();
    }
  }
  save();
  const missing = wanted.filter((t) => !stored[t]);
  console.log(`examined ${puzzles} puzzles; ${Object.keys(stored).length} examples stored`);
  console.log(missing.length ? `still without an example: ${missing.join(', ')}` : 'every technique has an example');
}
