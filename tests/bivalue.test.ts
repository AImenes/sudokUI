/**
 * The cells left with exactly two candidates (src/state/bivalue.ts): read
 * from the auto candidates, or from marks the player declared complete,
 * and from nothing else.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, digitsOf, bit } from '../src/engine/board';
import { bivalueCells } from '../src/state/bivalue';
import type { CellState } from '../src/state/gameStore';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const cellsOf = (puzzle: string): CellState[] =>
  [...puzzle].map((ch) => ({ given: ch !== '.', value: ch === '.' ? 0 : Number(ch), corner: 0, center: 0, excluded: 0, colors: [] }));

describe('bivalue cells', () => {
  it('are the auto candidates’ when those are on, struck ones gone', () => {
    const cells = cellsOf(EASY);
    const g = parseGrid(EASY)!;
    const expected = [...Array(81).keys()].filter((i) => !cells[i].value && digitsOf(g.cands[i]).length === 2);
    expect(expected.length).toBeGreaterThan(0);
    expect(bivalueCells(cells, true, 'unknown')).toEqual(expected);
    // the engine's grid can be handed in, and gives the same answer
    expect(bivalueCells(cells, true, 'open', g)).toEqual(expected);
    // a struck candidate counts as gone: one digit left is no pair
    const struck = cells.map((c) => ({ ...c }));
    const i = expected[0];
    struck[i].excluded = bit(digitsOf(g.cands[i])[0]);
    expect(bivalueCells(struck, true, 'unknown')).not.toContain(i);
  });

  it('are the corner and centre marks together under the exhaustive contract, and nothing under notes', () => {
    const cells = cellsOf(EASY);
    const empties = cells.map((c, i) => (c.value ? -1 : i)).filter((i) => i >= 0);
    const [a, b, c] = empties;
    cells[a].center = bit(1) | bit(6);
    cells[b].corner = bit(2);
    cells[b].center = bit(7);
    cells[c].corner = bit(3) | bit(4) | bit(5);
    expect(bivalueCells(cells, false, 'exhaustive')).toEqual([a, b]);
    // notes, or marks never declared: two marks are not two candidates
    expect(bivalueCells(cells, false, 'open')).toEqual([]);
    expect(bivalueCells(cells, false, 'unknown')).toEqual([]);
  });

  it('never name a solved cell', () => {
    const cells = cellsOf(EASY);
    const i = cells.findIndex((c) => c.value);
    cells[i].center = bit(1) | bit(2);
    expect(bivalueCells(cells, false, 'exhaustive')).toEqual([]);
    expect(bivalueCells(cells, true, 'unknown')).not.toContain(i);
  });
});
