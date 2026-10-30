/**
 * The cells left with exactly two candidates (src/state/bivalue.ts): read
 * from the auto candidates, or from marks the player declared complete,
 * and from nothing else.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, digitsOf, bit } from '../src/engine/board';
import { bivalueCells, bivaluePairs } from '../src/state/bivalue';
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
    // each with its pair, smaller digit first
    const pairs = bivaluePairs(cells, true, 'unknown');
    for (const i of expected) expect(pairs.get(i)).toEqual(digitsOf(g.cands[i]));
    // the engine's grid can be handed in, and gives the same answer
    expect(bivalueCells(cells, true, 'open', g)).toEqual(expected);
    // a struck candidate counts as gone: one digit left is no pair
    const struck = cells.map((c) => ({ ...c }));
    const i = expected[0];
    struck[i].excluded = bit(digitsOf(g.cands[i])[0]);
    expect(bivalueCells(struck, true, 'unknown')).not.toContain(i);
  });

  it('are the corner and centre marks together under the exhaustive contract, and the centre marks alone under notes', () => {
    const cells = cellsOf(EASY);
    const empties = cells.map((c, i) => (c.value ? -1 : i)).filter((i) => i >= 0);
    const [a, b, c] = empties;
    cells[a].center = bit(1) | bit(6);
    cells[b].corner = bit(2);
    cells[b].center = bit(7);
    cells[c].corner = bit(3) | bit(4) | bit(5);
    expect(bivalueCells(cells, false, 'exhaustive')).toEqual([a, b]);
    expect([...bivaluePairs(cells, false, 'exhaustive')]).toEqual([
      [a, [1, 6]],
      [b, [2, 7]]
    ]);
    // notes, or marks never declared: the centre marks alone are a cell's
    // candidates (Snyder style), so b's corner 2 does not make 7 a pair
    expect(bivalueCells(cells, false, 'open')).toEqual([a]);
    expect(bivalueCells(cells, false, 'unknown')).toEqual([a]);
  });

  it("read Snyder-style marks as their writer means them: a cell's centre marks are its candidates, its corner marks notes on a box", () => {
    const cells = cellsOf(EASY);
    const empties = cells.map((c, i) => (c.value ? -1 : i)).filter((i) => i >= 0);
    const [pair, corners, both, three] = empties;
    cells[pair].center = bit(1) | bit(2);
    // 4 and 7 each sit in one of two places in the box: not this cell's only candidates
    cells[corners].corner = bit(4) | bit(7);
    cells[both].corner = bit(5);
    cells[both].center = bit(3) | bit(8);
    cells[three].center = bit(2) | bit(6) | bit(9);
    for (const contract of ['open', 'unknown'] as const) {
      expect([...bivaluePairs(cells, false, contract)], contract).toEqual([
        [pair, [1, 2]],
        [both, [3, 8]]
      ]);
    }
    // declared complete, both layers count: the corners' 4 and 7 are a pair, and 5 makes three
    expect(bivalueCells(cells, false, 'exhaustive')).toEqual([pair, corners]);
  });

  it('never name a solved cell', () => {
    const cells = cellsOf(EASY);
    const i = cells.findIndex((c) => c.value);
    cells[i].center = bit(1) | bit(2);
    expect(bivalueCells(cells, false, 'exhaustive')).toEqual([]);
    expect(bivalueCells(cells, true, 'unknown')).not.toContain(i);
  });
});
