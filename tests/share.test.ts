/**
 * Position-link encoding: the #s= payload must survive a round trip for
 * arbitrary board states — entries, marks, exclusions, colours — and
 * reject corrupt payloads instead of producing garbage boards.
 */
import { describe, it, expect } from 'vitest';
import { encodePosition, decodePosition, CellState } from '../src/state/gameStore';

const EASY =
  '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

function fuzzedCells(seed: number): CellState[] {
  // deterministic pseudo-random board state derived from the puzzle
  let s = seed;
  const rnd = (n: number) => {
    s = (s * 48271) % 2147483647;
    return s % n;
  };
  return Array.from({ length: 81 }, (_, i) => {
    const given = EASY[i] !== '.';
    const cell: CellState = {
      given,
      value: given ? Number(EASY[i]) : rnd(4) === 0 ? 1 + rnd(9) : 0,
      corner: 0,
      center: 0,
      excluded: 0,
      colors: rnd(5) === 0 ? [rnd(9), (rnd(9) + 3) % 9].filter((v, k, a) => a.indexOf(v) === k) : []
    };
    if (!given && cell.value === 0) {
      cell.corner = rnd(512);
      cell.center = rnd(512);
      cell.excluded = rnd(512);
    }
    return cell;
  });
}

describe('position links', () => {
  it('round-trips arbitrary positions exactly', () => {
    for (const seed of [1, 42, 999]) {
      const cells = fuzzedCells(seed);
      for (const auto of [true, false]) {
        const encoded = encodePosition(cells, auto);
        expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(encoded.length).toBeLessThan(600);
        const decoded = decodePosition(encoded)!;
        expect(decoded).not.toBeNull();
        expect(decoded.autoCandidates).toBe(auto);
        expect(decoded.cells).toEqual(
          cells.map((c) => ({ ...c, colors: [...c.colors].sort((a, b) => a - b) }))
        );
      }
    }
  });

  it('rejects corrupt payloads', () => {
    expect(decodePosition('not!valid!chars!')).toBeNull();
    expect(decodePosition('')).toBeNull();
    const good = encodePosition(fuzzedCells(7), true);
    // flipping the version nibble must invalidate it
    expect(decodePosition('z' + good.slice(1))).toBeNull();
  });
});
