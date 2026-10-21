/**
 * Settings follow each other across open windows (src/state/settings.ts):
 * a switch turned on in one tab, or in the installed app's window, holds
 * in the others at once, and their next write does not put the old value
 * back. "Leave this device out of the counts" is the one that must.
 */
import { describe, it, expect } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};
/** the page's storage listeners: what another tab's write fires here */
const listeners: ((e: { key: string | null }) => void)[] = [];
(globalThis as any).window = {
  addEventListener: (type: string, fn: (e: { key: string | null }) => void) => {
    if (type === 'storage') listeners.push(fn);
  }
};

const { useSettings } = await import('../src/state/settings');
const KEY = 'sudokui-settings-v1';

/** another tab writes its settings, and the browser tells this one */
const otherTabWrites = (change: Record<string, unknown>) => {
  const saved = JSON.parse(storage.get(KEY)!);
  storage.set(KEY, JSON.stringify({ ...saved, state: { ...saved.state, ...change } }));
  for (const fn of listeners) fn({ key: KEY });
};

describe('settings across open windows', () => {
  it('takes a switch turned on in another tab, and keeps it through this tab’s next write', async () => {
    useSettings.getState().set({ countPlaysAsked: false });
    expect(useSettings.getState().dontCount).toBe(false);
    otherTabWrites({ dontCount: true, countPlays: false });
    await Promise.resolve();
    expect(useSettings.getState().dontCount).toBe(true);
    // this tab writes an unrelated setting, as the win screen does
    useSettings.getState().set({ countPlaysAsked: true });
    expect(JSON.parse(storage.get(KEY)!).state.dontCount).toBe(true);
  });

  it('ignores storage events for other keys', () => {
    useSettings.getState().set({ showTimer: true });
    storage.set(KEY, JSON.stringify({ state: { showTimer: false }, version: 0 }));
    for (const fn of listeners) fn({ key: 'sudokui-game-v1' });
    expect(useSettings.getState().showTimer).toBe(true);
  });
});
