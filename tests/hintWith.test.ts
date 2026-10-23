/**
 * A hint remembers what it was found under (src/state/gameStore.ts,
 * hintWith): the uniqueness setting and the marks' meaning at the moment
 * it appeared, so a report of it (src/ui/report.ts) says what produced it
 * even if a setting changes while it is on screen.
 */
import { describe, it, expect } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { useSettings } = await import('../src/state/settings');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

describe('a hint and the settings it was found under', () => {
  it('keeps them when a setting changes while the hint is shown, and takes them anew with the next hint', () => {
    useSettings.setState({ useUniqueness: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    useGame.getState().requestHint();
    const first = useGame.getState().hint;
    expect(first).not.toBeNull();
    expect(useGame.getState().hintWith).toEqual({ useUniqueness: true, markContract: useGame.getState().markContract });
    // the player turns uniqueness off with the hint still on the board
    useSettings.setState({ useUniqueness: false });
    expect(useGame.getState().hintWith?.useUniqueness).toBe(true);
    // the next hint is found under the new setting
    useGame.getState().dismissHint();
    useGame.getState().requestHint();
    expect(useGame.getState().hint).not.toBeNull();
    expect(useGame.getState().hintWith?.useUniqueness).toBe(false);
  });
});
