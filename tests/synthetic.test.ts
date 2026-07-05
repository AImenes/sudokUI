import { describe, it, expect } from 'vitest';
import { emptyGrid, setValue, bit } from '../src/engine/board';
import { findUniqueness, findAvoidableRectangle } from '../src/engine/techniques/uniqueness';

// Deterministic positions for the rare finders that random hunts seldom hit.
// (Their common siblings are validated against real solutions in hunt-new.)

describe('synthetic rare-pattern positions', () => {
  it('UR Type 5: three corners with the same extra digit', () => {
    const g = emptyGrid();
    // rectangle r1c1/r1c4/r2c1/r2c4 spans exactly two boxes
    const pair = bit(1) | bit(2);
    g.cands[0] = pair; // r1c1 = {1,2}
    g.cands[3] = pair | bit(7); // r1c4 = {1,2,7}
    g.cands[9] = pair | bit(7); // r2c1 = {1,2,7}
    g.cands[12] = pair | bit(7); // r2c4 = {1,2,7}
    const step = findUniqueness(g, 5);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('UNIQUENESS_5');
    // r2c5 (cell 13) sees all three extras: row 2 for r2c1/r2c4, box 2 for r1c4
    expect(step!.eliminations).toContainEqual({ cell: 13, digit: 7 });
    expect(step!.eliminations.every((e) => e.digit === 7)).toBe(true);
  });

  it('Avoidable Rectangle Type 2: solved non-given pair + common extra', () => {
    const g = emptyGrid();
    setValue(g, 0, 5); // r1c1 = 5, solved but NOT given
    setValue(g, 3, 6); // r1c4 = 6, solved but NOT given
    g.cands[9] = bit(6) | bit(9); // r2c1 = {6,9}, deadly digit 6 (diagonal to r1c4)
    g.cands[12] = bit(5) | bit(9); // r2c4 = {5,9}, deadly digit 5 (diagonal to r1c1)
    const step = findAvoidableRectangle(g, 2);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('AVOIDABLE_RECTANGLE_2');
    // one of the roofs must be 9, so 9 falls from cells seeing both (e.g. r2c2)
    expect(step!.eliminations).toContainEqual({ cell: 10, digit: 9 });
    expect(step!.eliminations.every((e) => e.digit === 9)).toBe(true);
  });

  it('Avoidable Rectangle Type 2 does NOT fire when a corner is a given', () => {
    const g = emptyGrid();
    setValue(g, 0, 5);
    g.given[0] = 1; // given clue -> uniqueness argument is void
    setValue(g, 3, 6);
    g.cands[9] = bit(6) | bit(9);
    g.cands[12] = bit(5) | bit(9);
    expect(findAvoidableRectangle(g, 2)).toBeNull();
  });
});
