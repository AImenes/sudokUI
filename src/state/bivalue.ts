// The cells left with exactly two candidates: where the XY-Wing, the
// XY-Chain, the W-Wing, remote pairs and unique rectangles begin, and what
// a player scans the board for when stuck. The board rings them on request
// (settings.highlightBivalue, the key B). A view of the player's own marks,
// or of the auto candidates, never of the solution: highlighting, not help.
import { digitsOf } from '../engine/board';
import type { Grid } from '../engine/board';
import { engineGrid } from './gameStore';
import type { CellState, MarkContract } from './gameStore';

/**
 * The unsolved cells with exactly two candidates, each with its pair,
 * smaller digit first. Under auto candidates they are the machine's,
 * struck ones left out; under marks the player declared complete (the
 * exhaustive contract) they are the corner and centre marks together, as
 * the player wrote them; under notes, or marks whose meaning was never
 * declared, a cell with two marks is not a bivalue cell, and nothing is.
 * `grid` saves the engine's work when the caller has it already.
 */
export function bivaluePairs(cells: CellState[], autoCandidates: boolean, contract: MarkContract, grid?: Grid): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  if (!autoCandidates && contract !== 'exhaustive') return out;
  const cands = autoCandidates ? (grid ?? engineGrid(cells)).cands : null;
  for (let i = 0; i < 81; i++) {
    if (cells[i].value) continue;
    const digits = digitsOf(cands ? cands[i] : cells[i].corner | cells[i].center);
    if (digits.length === 2) out.set(i, [digits[0], digits[1]]);
  }
  return out;
}

/** the bivalue cells alone, in board order */
export function bivalueCells(cells: CellState[], autoCandidates: boolean, contract: MarkContract, grid?: Grid): number[] {
  return [...bivaluePairs(cells, autoCandidates, contract, grid).keys()];
}
