/**
 * What justifies a move: the easiest technique the catalogue knows that
 * makes a placement or a removal correct in a given position. This is how
 * the app learns what a player can do from what they do
 * (docs/technique-stats.md): every unaided move is credited with the
 * easiest known justification, not with whatever the player was thinking.
 *
 * - A placement that is a single in the position is credited directly, and
 *   its step is built for that very cell, so it can be shown as a hint.
 * - Otherwise the solver plays on from the position, cheapest technique
 *   first, until the move becomes a single (or the removal is made); the
 *   hardest technique on that short path is the credit, and the path is
 *   the proof.
 * - Past the budget, the move is "beyond the catalogue": credited to no
 *   technique.
 */
import { Grid, UNITS, CELL_UNITS, bit, cloneGrid } from './board';
import { Step } from './steps';
import { Tech, TECHS } from './ratings';
import { findNextStep, applyStep } from './humanSolver';
import { fullHouseStep, nakedSingleStep, hiddenSingleStep } from './techniques/singles';

export interface Move {
  cell: number;
  digit: number;
  /** true for a placement, false for a candidate removed */
  placed: boolean;
}

export interface Justification {
  /** the easiest technique that justifies the move; null when none was found in budget */
  tech: Tech | null;
  /** the proof: one single for a direct move, else the path played to reach it */
  steps: Step[];
  /** the move was a single in the position itself */
  direct: boolean;
}

export interface Budget {
  steps: number;
  ms: number;
}

export const DEFAULT_BUDGET: Budget = { steps: 60, ms: 300 };

/** The single that places `digit` in `cell`, if the position has one. */
export function singleAt(g: Grid, cell: number, digit: number): Step | null {
  if (g.values[cell] !== 0 || !(g.cands[cell] & bit(digit))) return null;
  // full house first, as the solver does: a house with one cell left
  for (const u of CELL_UNITS[cell]) {
    if (UNITS[u].every((c) => c === cell || g.values[c] !== 0)) return fullHouseStep(u, cell, digit);
  }
  if (g.cands[cell] === bit(digit)) return nakedSingleStep(g, cell);
  for (const u of CELL_UNITS[cell]) {
    const b = bit(digit);
    if (UNITS[u].every((c) => c === cell || g.values[c] !== 0 || !(g.cands[c] & b))) {
      return hiddenSingleStep(g, u, digit, cell);
    }
  }
  return null;
}

const hardest = (steps: Step[]): Tech =>
  steps.reduce((best, s) => (TECHS[s.tech].index > TECHS[best].index ? s.tech : best), steps[0].tech);

export function justify(g: Grid, move: Move, budget: Budget = DEFAULT_BUDGET): Justification {
  const none: Justification = { tech: null, steps: [], direct: false };
  if (g.values[move.cell] !== 0) return none;
  if (!(g.cands[move.cell] & bit(move.digit))) return none;
  if (move.placed) {
    const single = singleAt(g, move.cell, move.digit);
    if (single) return { tech: single.tech, steps: [single], direct: true };
  }
  const work = cloneGrid(g);
  const path: Step[] = [];
  const start = performance.now();
  for (let i = 0; i < budget.steps && performance.now() - start < budget.ms; i++) {
    const step = findNextStep(work);
    if (!step) return none;
    applyStep(work, step);
    path.push(step);
    if (work.values[move.cell] !== 0) {
      // the cell got solved: the move was justified only if with this digit
      // (a placement), or because the digit went elsewhere (a removal)
      const solvedWith = work.values[move.cell];
      if (move.placed ? solvedWith === move.digit : solvedWith !== move.digit) {
        return { tech: hardest(path), steps: path, direct: false };
      }
      return none;
    }
    if (move.placed) {
      const single = singleAt(work, move.cell, move.digit);
      if (single) {
        path.push(single);
        return { tech: hardest(path), steps: path, direct: false };
      }
    } else if (!(work.cands[move.cell] & bit(move.digit))) {
      return { tech: hardest(path), steps: path, direct: false };
    }
  }
  return none;
}
