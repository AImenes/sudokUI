/**
 * A position the tests name by its place on a solve path: a puzzle after
 * the solver's first `at` steps. Filing the AIC with the Nice Loops
 * (docs/rating-chains.md) moved some solve paths, and with them some of
 * the positions the tests were written for. Those are kept as the paths
 * reached them before, in tests/fixtures/pathsBefore.json (the puzzle,
 * the steps, the board's digits and every cell's candidates), as the set
 * fixture keeps its positions, so each test still looks at its own board;
 * every other position is walked now. The finders are the same, so the
 * step a test looks for at a kept position is the one it was written for.
 *
 * PATHS_BEFORE=record npx vitest run lists the positions the tests ask
 * for (.vite/paths-asked.txt), for writing the fixture again.
 *
 * Not a test file itself.
 */
import { readFileSync, appendFileSync } from 'node:fs';
import { env } from 'node:process';
import { parseGrid } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, applyStep } from '../src/engine/humanSolver';

interface Kept {
  values: string;
  cands: number[];
}

const KEPT: Record<string, Kept> = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/pathsBefore.json')));

/** the position after the solver's first `at` steps of `puzzle`: kept, where the path to it moved, else walked now */
export function walkTo(puzzle: string, at: number): Grid {
  const key = `${puzzle}@${at}`;
  if (env.PATHS_BEFORE === 'record') appendFileSync('.vite/paths-asked.txt', `${key}\n`);
  const g = parseGrid(puzzle)!;
  const kept = KEPT[key];
  if (kept) {
    for (let cell = 0; cell < 81; cell++) {
      g.values[cell] = Number(kept.values[cell]);
      g.cands[cell] = kept.cands[cell];
    }
    return g;
  }
  for (let i = 0; i < at; i++) applyStep(g, findNextStep(g)!);
  return g;
}

/** how many positions are kept */
export const keptPositions = () => Object.keys(KEPT).length;
