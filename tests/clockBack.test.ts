/**
 * The game's clock never runs backwards or below zero (src/state/gameStore.ts,
 * elapsedMs): a device clock put back while a game runs in view leaves the
 * timer where it was until the clock passes it again, so no negative time is
 * shown, saved or sent. (A clock put forward is a documented limit,
 * docs/advent-calendar.md, "Edge cases left".)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const g = () => useGame.getState();

describe('the game clock and a device clock put back', () => {
  beforeEach(() => {
    storage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-12-10T12:00:00'));
    g().startGame(EASY, 196, 'Easy');
  });
  afterEach(() => vi.useRealTimers());

  it('stands still rather than running backwards, and is never below zero', () => {
    vi.setSystemTime(new Date('2026-12-10T12:02:00'));
    const twoMinutes = g().elapsedMs();
    expect(twoMinutes).toBeGreaterThanOrEqual(120_000);
    // the device's clock is put back ten minutes with the game running
    vi.setSystemTime(new Date('2026-12-10T11:52:00'));
    expect(g().elapsedMs()).toBeGreaterThanOrEqual(0);
    // paused there, the time kept is not below zero either
    g().togglePause?.();
    expect(g().elapsedBefore).toBeGreaterThanOrEqual(0);
    expect(g().elapsedMs()).toBeGreaterThanOrEqual(0);
  });

  it('reads a negative time saved by an earlier build as zero', () => {
    useGame.setState({ elapsedBefore: -478_111, paused: true });
    expect(g().elapsedMs()).toBe(0);
  });
});
