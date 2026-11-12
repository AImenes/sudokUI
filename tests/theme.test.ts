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

const { useSettings, shownTheme, nextTheme, deviceIsLight, onDeviceScheme, DEVICE_LIGHT, applySeason, seasonTheme, pickedTheme } = await import('../src/state/settings');
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
    for (const theme of ['dark', 'light', 'rose', 'forest', 'christmas'] as const) {
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
    // a day outside the Christmas season: the four looks
    const october = '2026-10-15';
    expect(['dark', 'light', 'rose', 'forest'].map((t) => nextTheme(t as never))).toEqual(['light', 'rose', 'forest', 'dark']);
    useSettings.getState().set({ theme: 'device' });
    deviceTurns('dark');
    useSettings.getState().toggleTheme(october);
    expect(useSettings.getState().theme).toBe('light');
    useSettings.getState().set({ theme: 'device' });
    deviceTurns('light');
    useSettings.getState().toggleTheme(october);
    expect(useSettings.getState().theme).toBe('rose');
    useSettings.getState().toggleTheme(october);
    expect(useSettings.getState().theme).toBe('forest');
    useSettings.getState().toggleTheme(october);
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

/**
 * The Christmas look's season (src/content/season.ts; the owner's decisions
 * of 12 November 2026), as the settings keep it (src/state/settings.ts,
 * seasonTheme, applySeason): it can be chosen from 1 November to
 * 31 December; from 1 December it goes on by itself, once a season, for a
 * player who never picked a theme; anyone can switch it off, and a player
 * who picks any theme keeps it; on 1 January a player on it gets back the
 * theme they had before (or the default), and it cannot be chosen again
 * until 1 November. Whether a player ever picked a theme is kept
 * (themePicked), and a player from before it was kept counts as having
 * picked one when they held a theme other than the default.
 */
describe('the Christmas season', () => {
  const fresh = () => {
    storage.clear();
    useSettings.setState({ ...useSettings.getInitialState() });
  };
  const s = () => useSettings.getState();
  beforeEach(fresh);

  it('starts a new player as one who never picked a theme', () => {
    expect(useSettings.getInitialState()).toMatchObject({ theme: 'dark', themePicked: false, themeBefore: null, themeAutoYear: null });
  });

  it('changes nothing before December for a player who never picked', () => {
    for (const day of ['2026-10-31', '2026-11-01', '2026-11-30']) {
      applySeason(day);
      expect(s().theme, day).toBe('dark');
    }
  });

  it('goes on by itself on 1 December for a player who never picked, and back to their theme on 1 January', () => {
    applySeason('2026-12-01');
    expect(s()).toMatchObject({ theme: 'christmas', themePicked: false, themeBefore: 'dark', themeAutoYear: 2026 });
    // the rest of December, and a page that asks again, leave it on
    applySeason('2026-12-24');
    applySeason('2026-12-31');
    expect(s().theme).toBe('christmas');
    applySeason('2027-01-01');
    expect(s()).toMatchObject({ theme: 'dark', themePicked: false, themeBefore: null });
    // and goes on again the next December: still a player who never picked
    applySeason('2027-11-15');
    expect(s().theme).toBe('dark');
    applySeason('2027-12-01');
    expect(s()).toMatchObject({ theme: 'christmas', themeAutoYear: 2027 });
  });

  it('a new player who first opens the app on 15 December gets it too', () => {
    applySeason('2026-12-15');
    expect(s().theme).toBe('christmas');
  });

  it('switched off is a pick: it stays off, this season and the next', () => {
    applySeason('2026-12-01');
    s().set({ theme: 'dark' });
    expect(s()).toMatchObject({ theme: 'dark', themePicked: true, themeBefore: null });
    applySeason('2026-12-02');
    applySeason('2027-12-01');
    expect(s().theme).toBe('dark');
  });

  it('goes on once a season: a theme put back without a pick (an older build’s button) stays', () => {
    applySeason('2026-12-01');
    useSettings.setState({ theme: 'rose' });
    applySeason('2026-12-02');
    expect(s().theme).toBe('rose');
  });

  it('a player who picked a theme keeps it in December', () => {
    for (const theme of ['dark', 'light', 'rose', 'forest', 'device'] as const) {
      fresh();
      s().set({ theme });
      applySeason('2026-12-01');
      expect(s().theme, theme).toBe(theme);
    }
  });

  it('chosen in November, it goes on 1 January and the theme from before comes back', () => {
    s().set({ theme: 'rose' });
    s().set({ theme: 'christmas' });
    expect(s()).toMatchObject({ theme: 'christmas', themePicked: true, themeBefore: 'rose' });
    applySeason('2026-12-31');
    expect(s().theme).toBe('christmas');
    applySeason('2027-01-01');
    expect(s()).toMatchObject({ theme: 'rose', themeBefore: null });
    // Match device before it comes back as Match device
    s().set({ theme: 'device' });
    s().set({ theme: 'christmas' });
    applySeason('2027-01-02');
    expect(s().theme).toBe('device');
  });

  it('chosen again while on, keeps the theme from before; another theme chosen drops it', () => {
    s().set({ theme: 'forest' });
    s().set({ theme: 'christmas' });
    s().set({ theme: 'christmas' });
    expect(s().themeBefore).toBe('forest');
    s().set({ theme: 'light' });
    expect(s().themeBefore).toBeNull();
    expect(pickedTheme({ theme: 'light', themePicked: true, themeBefore: null, themeAutoYear: null, themeSeason: null }, 'christmas').themeBefore).toBe('light');
  });

  it('goes when its own season is over, for a player who does not come back between 1 January and 31 October', () => {
    // on by itself on 10 December 2026, next seen on 1 November 2027: dark again, and on by itself again on 1 December
    applySeason('2026-12-10');
    expect(s()).toMatchObject({ theme: 'christmas', themeBefore: 'dark', themeSeason: 2026 });
    applySeason('2027-11-01');
    expect(s()).toMatchObject({ theme: 'dark', themeBefore: null, themeSeason: null });
    applySeason('2027-12-01');
    expect(s()).toMatchObject({ theme: 'christmas', themeBefore: 'dark', themeAutoYear: 2027, themeSeason: 2027 });
  });

  it('chosen in one season, gives the theme from before back in the next, even on the first day seen there', () => {
    s().set({ theme: 'light' });
    applySeason('2026-11-05');
    useSettings.setState(pickedTheme(s(), 'christmas', '2026-11-05'));
    expect(s()).toMatchObject({ theme: 'christmas', themeBefore: 'light', themeSeason: 2026 });
    applySeason('2027-12-15');
    expect(s()).toMatchObject({ theme: 'light', themeBefore: null, themeSeason: null });
    // a player who picked is not switched on by itself
    applySeason('2027-12-16');
    expect(s().theme).toBe('light');
  });

  it('with no theme kept from before, gives back the default, dark', () => {
    useSettings.setState({ theme: 'christmas', themeBefore: null, themePicked: true });
    applySeason('2027-01-01');
    expect(s().theme).toBe('dark');
    // nor does a Christmas kept as the theme from before (which no choice writes) bring the look back
    useSettings.setState({ theme: 'christmas', themeBefore: 'christmas', themePicked: true });
    applySeason('2027-01-01');
    expect(s()).toMatchObject({ theme: 'dark', themeBefore: null });
  });

  it('is in the top bar’s turn after Forest only in its season', () => {
    expect(nextTheme('forest', true)).toBe('christmas');
    expect(nextTheme('christmas', true)).toBe('dark');
    expect(nextTheme('christmas', false)).toBe('dark');
    expect(nextTheme('forest', false)).toBe('dark');
    s().set({ theme: 'forest' });
    s().toggleTheme('2026-11-12');
    expect(s()).toMatchObject({ theme: 'christmas', themeBefore: 'forest', themePicked: true });
    s().toggleTheme('2026-11-12');
    expect(s()).toMatchObject({ theme: 'dark', themeBefore: null });
    s().set({ theme: 'forest' });
    s().toggleTheme('2027-01-05');
    expect(s().theme).toBe('dark');
  });

  it('changes nothing for a theme of the player’s own outside the season, and tidies a kept theme', () => {
    const state = { theme: 'rose' as const, themePicked: true, themeBefore: null, themeAutoYear: 2026, themeSeason: null };
    for (const day of ['2027-01-01', '2027-06-01', '2027-10-31']) expect(seasonTheme(state, day)).toBeNull();
    expect(seasonTheme({ ...state, themeBefore: 'light' }, '2027-02-01')).toEqual({ themeBefore: null, themeSeason: null });
  });

  it('is kept: whether the player picked, the theme from before and the season it went on in', async () => {
    applySeason('2026-12-01');
    const saved = JSON.parse(storage.get(KEY)!);
    expect(saved.version).toBe(2);
    expect(saved.state).toMatchObject({ theme: 'christmas', themePicked: false, themeBefore: 'dark', themeAutoYear: 2026 });
    // the page starts again from only what was stored
    const stored = storage.get(KEY)!;
    useSettings.setState({ theme: 'dark', themeBefore: null, themeAutoYear: null });
    storage.set(KEY, stored);
    await useSettings.persist.rehydrate();
    expect(s()).toMatchObject({ theme: 'christmas', themeBefore: 'dark', themeAutoYear: 2026 });
  });
});

describe('the settings from before the theme pick was kept (version 2)', () => {
  const s = () => useSettings.getState();
  // a page that starts: the store's first state, then what was stored
  beforeEach(() => {
    storage.clear();
    useSettings.setState({ ...useSettings.getInitialState() });
  });
  const from = async (state: Record<string, unknown>, version: number) => {
    storage.set(KEY, JSON.stringify({ state, version }));
    await useSettings.persist.rehydrate();
  };

  it('count a theme other than the default as picked, kept through December', async () => {
    for (const theme of ['light', 'rose', 'forest', 'device'] as const) {
      await from({ theme }, 1);
      expect(s(), theme).toMatchObject({ theme, themePicked: true });
      applySeason('2026-12-01');
      expect(s().theme, theme).toBe(theme);
    }
  });

  it('count a stored dark, which cannot be told from the default, as no pick', async () => {
    await from({ theme: 'dark' }, 1);
    expect(s()).toMatchObject({ theme: 'dark', themePicked: false });
    applySeason('2026-12-01');
    expect(s().theme).toBe('christmas');
  });

  it('go through every migration before it too (version 0: the board scrolling off)', async () => {
    await from({ theme: 'forest', scrollOverBoard: true }, 0);
    expect(s()).toMatchObject({ theme: 'forest', themePicked: true, scrollOverBoard: false });
  });

  it('keep a pick already written (this build, then an older one writing version 1 over it)', async () => {
    await from({ theme: 'dark', themePicked: true }, 1);
    expect(s().themePicked).toBe(true);
    await from({ theme: 'rose', themePicked: false }, 1);
    expect(s().themePicked).toBe(false);
  });
});
