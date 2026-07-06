import { describe, it, expect } from 'vitest';
import { emptyGrid, bit, Grid } from '../src/engine/board';
import { findTridagon } from '../src/engine/techniques/tridagon';

const T = bit(1) | bit(2) | bit(3);
const cellAt = (r: number, c: number) => r * 9 + c;

/** trio digits live ONLY in the pattern cells (+ extras in the guardian) */
function build(pattern: number[], guardian: number): Grid {
  const g = emptyGrid();
  for (let c = 0; c < 81; c++) {
    if (!pattern.includes(c)) g.cands[c] &= ~T;
  }
  for (const c of pattern) g.cands[c] = T;
  g.cands[guardian] = T | bit(7);
  return g;
}

describe('tridagon', () => {
  it('fires on an empirically-proven impossible triomino pattern', () => {
    // four same-oriented L-triominoes (verified unsatisfiable exhaustively)
    const cells = [
      [0, 1], [1, 0], [1, 1],
      [0, 4], [1, 3], [1, 4],
      [3, 1], [4, 0], [4, 1],
      [3, 4], [4, 3], [4, 4]
    ].map(([r, c]) => cellAt(r, c));
    const g = build(cells, cells[0]);
    const step = findTridagon(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('TRIDAGON');
    expect(step!.eliminations.map((e) => e.digit).sort()).toEqual([1, 2, 3]);
    expect(step!.eliminations.every((e) => e.cell === cells[0])).toBe(true);
  });

  it('stays silent on a satisfiable arrangement', () => {
    // four full mini-rows on distinct rows: locally satisfiable, no claim
    const cells: number[] = [];
    for (const [r, c0] of [[0, 0], [1, 3], [3, 0], [4, 3]] as const) {
      for (let k = 0; k < 3; k++) cells.push(cellAt(r, c0 + k));
    }
    const g = build(cells, cells[0]);
    expect(findTridagon(g)).toBeNull();
  });
});
