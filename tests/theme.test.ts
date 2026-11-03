/**
 * Match device (src/state/settings.ts, ThemeChoice; src/ui/theme.ts): beside
 * the four themes, a choice that shows the app's Daylight while the device
 * is set to light and its Dark while it is set to dark, and follows the
 * device as it changes. A new player still starts dark (the owner's
 * choice), and a returning player keeps the theme they had.
 */
import { describe, it, expect, beforeEach } from 'vitest';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

/** the device: light or dark, and the page's listeners on its scheme */
let light = false;
const queries: string[] = [];
const listeners = new Set<() => void>();
(globalThis as any).window = {
  addEventListener: () => {},
  matchMedia: (q: string) => {
    queries.push(q);
    return {
      get matches() {
        return light;
      },
      addEventListener: (type: string, fn: () => void) => type === 'change' && listeners.add(fn),
      removeEventListener: (type: string, fn: () => void) => type === 'change' && listeners.delete(fn)
    };
  }
};
/** the player turns the device light or dark, with the app open */
const deviceTurns = (to: 'light' | 'dark') => {
  light = to === 'light';
  for (const fn of [...listeners]) fn();
};

const { useSettings, shownTheme, nextTheme, deviceIsLight, onDeviceScheme, DEVICE_LIGHT } = await import('../src/state/settings');
const KEY = 'sudokui-settings-v1';

beforeEach(() => deviceTurns('dark'));

describe('Match device', () => {
  it('starts a new player dark, whatever the device says', () => {
    expect(useSettings.getInitialState().theme).toBe('dark');
    deviceTurns('light');
    expect(shownTheme(useSettings.getInitialState().theme, deviceIsLight())).toBe('dark');
  });

  it('shows Daylight on a light device and Dark on a dark one, and every other theme as it is', () => {
    expect(shownTheme('device', true)).toBe('light');
    expect(shownTheme('device', false)).toBe('dark');
    for (const theme of ['dark', 'light', 'rose', 'forest'] as const) {
      expect(shownTheme(theme, true)).toBe(theme);
      expect(shownTheme(theme, false)).toBe(theme);
    }
  });

  it('reads the device through prefers-color-scheme, and hears it change', () => {
    queries.length = 0;
    deviceTurns('light');
    expect(deviceIsLight()).toBe(true);
    expect(queries).toEqual([DEVICE_LIGHT]);
    expect(DEVICE_LIGHT).toBe('(prefers-color-scheme: light)');
    const heard: boolean[] = [];
    const stop = onDeviceScheme(() => heard.push(deviceIsLight()));
    deviceTurns('dark');
    deviceTurns('light');
    expect(heard).toEqual([false, true]);
    // once unsubscribed, the page hears nothing more
    stop();
    deviceTurns('dark');
    expect(heard).toEqual([false, true]);
  });

  it('is remembered as a choice, and the look follows the device while it is chosen', () => {
    useSettings.getState().set({ theme: 'device' });
    expect(JSON.parse(storage.get(KEY)!).state.theme).toBe('device');
    deviceTurns('light');
    expect(shownTheme(useSettings.getState().theme, deviceIsLight())).toBe('light');
    deviceTurns('dark');
    expect(shownTheme(useSettings.getState().theme, deviceIsLight())).toBe('dark');
    // a theme chosen after it holds whatever the device does
    useSettings.getState().set({ theme: 'rose' });
    deviceTurns('light');
    expect(shownTheme(useSettings.getState().theme, deviceIsLight())).toBe('rose');
  });

  it('the top bar’s theme button goes on from the look shown, so every press changes what the player sees', () => {
    expect(['dark', 'light', 'rose', 'forest'].map((t) => nextTheme(t as never))).toEqual(['light', 'rose', 'forest', 'dark']);
    useSettings.getState().set({ theme: 'device' });
    deviceTurns('dark');
    useSettings.getState().toggleTheme();
    expect(useSettings.getState().theme).toBe('light');
    useSettings.getState().set({ theme: 'device' });
    deviceTurns('light');
    useSettings.getState().toggleTheme();
    expect(useSettings.getState().theme).toBe('rose');
    useSettings.getState().toggleTheme();
    expect(useSettings.getState().theme).toBe('forest');
    useSettings.getState().toggleTheme();
    expect(useSettings.getState().theme).toBe('dark');
  });

  it('a returning player keeps their theme, from before Match device and from before the last migration', async () => {
    for (const [theme, version] of [
      ['light', 1],
      ['rose', 1],
      ['forest', 0],
      ['dark', 0],
      ['device', 1]
    ] as const) {
      storage.set(KEY, JSON.stringify({ state: { theme, showTimer: false }, version }));
      await useSettings.persist.rehydrate();
      expect(useSettings.getState().theme, `${theme} v${version}`).toBe(theme);
      expect(useSettings.getState().showTimer).toBe(false);
    }
  });
});
