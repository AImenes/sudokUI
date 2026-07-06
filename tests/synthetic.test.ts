import { describe, it, expect } from 'vitest';
import { emptyGrid, setValue, bit } from '../src/engine/board';
import { findUniqueness, findAvoidableRectangle } from '../src/engine/techniques/uniqueness';
import { findBasicFish } from '../src/engine/techniques/fish';
import { findFrankenFish } from '../src/engine/techniques/complexFish';
import { findFireworks } from '../src/engine/techniques/fireworks';

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

  // Large basic fish (mathematically redundant — any N>4 fish implies a
  // complementary fish of size ≤4 — but implemented for completeness and
  // custom solve orders). Same generic algorithm as X-Wing/Swordfish.
  for (const [size, name] of [
    [5, 'SQUIRMBAG'],
    [6, 'WHALE'],
    [7, 'LEVIATHAN']
  ] as const) {
    it(`finds a ${name} (size-${size} fish)`, () => {
      const g = emptyGrid();
      // digit 5 confined to columns 0..size-1 within rows 0..size-1
      for (let row = 0; row < size; row++) {
        for (let col = size; col < 9; col++) {
          g.cands[row * 9 + col] &= ~bit(5);
        }
      }
      const step = findBasicFish(g, size);
      expect(step).not.toBeNull();
      expect(step!.tech).toBe(name);
      // eliminations: digit 5 in the cover columns outside the base rows
      expect(step!.eliminations.length).toBe((9 - size) * size);
      expect(step!.eliminations.every((e) => e.digit === 5 && e.cell % 9 < size)).toBe(true);
    });
  }

  it('finds a Franken X-Wing (row + box base)', () => {
    const g = emptyGrid();
    // digit 5: row 1 restricted to columns 1 and 5; box 5 restricted to
    // column 5 -> base {row 0, box 4} covered by columns {0, 4}
    for (let col = 0; col < 9; col++) {
      if (col !== 0 && col !== 4) g.cands[0 * 9 + col] &= ~bit(5);
    }
    for (const cell of [30, 32, 39, 41, 48, 50]) {
      g.cands[cell] &= ~bit(5); // box 4 keeps 5 only in its middle column
    }
    const step = findFrankenFish(g, 2);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('FRANKEN_X_WING');
    expect(step!.eliminations.length).toBeGreaterThan(0);
    // every elimination is digit 5 in column 1 or 5, outside row 1 and box 5
    expect(
      step!.eliminations.every(
        (e) => e.digit === 5 && (e.cell % 9 === 0 || e.cell % 9 === 4)
      )
    ).toBe(true);
  });

  it('finds a Fireworks triple', () => {
    const g = emptyGrid();
    // digits 1,2,3: row 1 candidates outside box 1 confined to r1c6 (B),
    // column 1 candidates outside box 1 confined to r6c1 (C)
    for (const d of [1, 2, 3]) {
      for (let col = 3; col < 9; col++) {
        if (col !== 5) g.cands[0 * 9 + col] &= ~bit(d);
      }
      for (let row = 3; row < 9; row++) {
        if (row !== 5) g.cands[row * 9 + 0] &= ~bit(d);
      }
    }
    const step = findFireworks(g);
    expect(step).not.toBeNull();
    expect(step!.tech).toBe('FIREWORKS');
    // cross r1c1 (0), row wing r1c6 (5), column wing r6c1 (45) lose digits 4-9
    const cells = new Set(step!.eliminations.map((e) => e.cell));
    expect([...cells].sort((a, b) => a - b)).toEqual([0, 5, 45]);
    expect(step!.eliminations.every((e) => e.digit >= 4)).toBe(true);
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
