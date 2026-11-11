/**
 * The chain trainer from the keyboard (the hunt of November 2026): while
 * it is open, a typed digit is the selected cell's candidate, as a tap on
 * it would be, and never goes onto the board (App.tsx sends digits to
 * chainKey; docs/chain-trainer.md).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';

vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
});

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const g = () => useGame.getState();
// r1c1 holds candidates 4 and 5; r1c3 a given 3
const R1C1 = 0;
const R1C3 = 2;
const board = () => JSON.stringify(g().cells);

beforeEach(() => {
  useSettings.getState().set({ confirmAssist: false });
  g().startGame(EASY, 196, 'Easy');
  g().startChain();
});

describe('the chain trainer takes typed digits', () => {
  it('a digit typed on the selected cell is its candidate in the chain; the board and the history stay as they were', () => {
    const before = board();
    const history = g().history.length;
    g().select([R1C1], false);
    g().chainKey(4);
    expect(g().chain!.nodes).toEqual([{ cell: R1C1, digit: 4 }]);
    expect(g().chainNote).toContain('starts the chain');
    g().chainKey(5);
    expect(g().chain!.nodes).toHaveLength(2);
    expect(g().chainNote).toMatch(/^Strong link/);
    expect(board()).toBe(before);
    expect(g().history).toHaveLength(history);
    expect(g().armedDigit).toBeNull();
  });

  it('a digit the cell does not hold, or a given, is refused as a tap would be', () => {
    g().select([R1C1], false);
    g().chainKey(9);
    expect(g().chain!.nodes).toHaveLength(0);
    expect(g().chainNote).toBe('r1c1 has no 9 to tap.');
    g().select([R1C3], false);
    g().chainKey(3);
    expect(g().chain!.nodes).toHaveLength(0);
    expect(g().cells[R1C3].value).toBe(3);
  });

  it('with no cell or several selected, the digit arms nothing and enters nothing: the note says how', () => {
    const before = board();
    g().select([], false);
    g().chainKey(4);
    expect(g().armedDigit).toBeNull();
    g().select([R1C1, R1C3 + 1], false);
    g().chainKey(4);
    expect(g().chain!.nodes).toHaveLength(0);
    expect(g().chainNote).toBe('Select one cell with the arrow keys, then type one of its candidates.');
    expect(board()).toBe(before);
  });
});
