// User preferences, persisted to localStorage. Kept separate from the game
// store so changing a setting never touches game state or undo history.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { lookAvailable, lookAuto, seasonYear } from '../content/season';
import { localDateKey } from '../content/dailies';

export type MarkLayer = 'center' | 'corner';

/** a look the app is shown in: what the page's data-theme says and the
 *  colours of src/ui/styles.css are keyed by. Christmas is the season's
 *  look, there to choose from 1 November to 31 December only
 *  (src/content/season.ts; seasonTheme, below) */
export type Theme = 'dark' | 'light' | 'rose' | 'forest' | 'christmas';

/** what the player chooses in Settings: one of the looks, or 'device',
 *  which shows Daylight while the device is set to light and Dark while it
 *  is set to dark, and changes the moment the device does (src/ui/theme.ts) */
export type ThemeChoice = Theme | 'device';

/** the device asks for a light look. A device that says nothing either way
 *  gets dark, the app's default */
export const DEVICE_LIGHT = '(prefers-color-scheme: light)';

const deviceQuery = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DEVICE_LIGHT) : null;

/** the device is set to light, now */
export const deviceIsLight = () => deviceQuery()?.matches ?? false;

/** call back whenever the device turns light or dark; returns the unsubscribe */
export function onDeviceScheme(fn: () => void): () => void {
  const q = deviceQuery();
  if (!q) return () => {};
  if (q.addEventListener) {
    q.addEventListener('change', fn);
    return () => q.removeEventListener('change', fn);
  }
  // Safari before 14 has only the older listener (as RatingGauge.tsx)
  q.addListener(fn);
  return () => q.removeListener(fn);
}

/** the look a choice shows, with the device light or not */
export const shownTheme = (choice: ThemeChoice, deviceLight: boolean): Theme =>
  choice === 'device' ? (deviceLight ? 'light' : 'dark') : choice;

/** the top bar's theme button: the look after the one shown, in the order
 *  dark, daylight, rosé, forest, and Christmas while the season has it
 *  (`christmas`: src/content/season.ts, lookAvailable). From Match device
 *  it starts at what the device shows, so every press changes what the
 *  player sees */
export const nextTheme = (shown: Theme, christmas = false): Theme =>
  shown === 'dark'
    ? 'light'
    : shown === 'light'
      ? 'rose'
      : shown === 'rose'
        ? 'forest'
        : shown === 'forest' && christmas
          ? 'christmas'
          : 'dark';

/** what the settings hold of the theme: the choice, and what the season's rules read and keep */
export interface ThemeState {
  theme: ThemeChoice;
  /** the player has chosen a theme: in Settings or with the top bar's button, ever (or held a theme of their own before this was kept: the migration below) */
  themePicked: boolean;
  /** the theme the Christmas look took the place of, which comes back when the season ends; null while the look is not on */
  themeBefore: ThemeChoice | null;
  /** the season (its year) in which the Christmas look last went on by itself, so it does so once a season */
  themeAutoYear: number | null;
}

/**
 * The player chooses a theme (Settings, or the top bar's button): it is
 * theirs from now on, never changed by the season but for the Christmas
 * look going at its end. Choosing Christmas keeps the theme it replaces,
 * to give it back on 1 January; choosing any other drops that.
 */
export function pickedTheme(s: ThemeState, theme: ThemeChoice): ThemeState {
  return {
    theme,
    themePicked: true,
    themeBefore: theme !== 'christmas' ? null : s.theme === 'christmas' ? s.themeBefore : s.theme,
    themeAutoYear: s.themeAutoYear
  };
}

/**
 * The season's rules for the theme on a day (the player's local date,
 * src/content/season.ts), or null when they change nothing:
 * - outside the season (1 January to 31 October) a player on the
 *   Christmas look gets back the theme they had before it (the default,
 *   dark, when none was kept), and the look cannot be chosen;
 * - from 1 December a player who never picked a theme gets the look by
 *   itself, once a season: anyone can switch it off, which is a pick, and
 *   a player who picked any theme keeps it.
 */
export function seasonTheme(s: ThemeState, today: string): Partial<ThemeState> | null {
  if (!lookAvailable(today)) {
    // (a kept Christmas, which no choice writes, would only bring the look back)
    if (s.theme === 'christmas') return { theme: s.themeBefore && s.themeBefore !== 'christmas' ? s.themeBefore : 'dark', themeBefore: null };
    return s.themeBefore !== null ? { themeBefore: null } : null;
  }
  const year = seasonYear(today);
  if (lookAuto(today) && !s.themePicked && s.theme !== 'christmas' && s.themeAutoYear !== year) {
    return { theme: 'christmas', themeBefore: s.theme, themeAutoYear: year };
  }
  return null;
}

/** typefaces already on the device: nothing to download, works offline */
export type Font = 'classic' | 'rounded' | 'serif' | 'mono' | 'hand';

/** the app's language: the interface, the hints and every other sentence the
 *  engine writes, and the Learn section (docs/translations.md) */
export type Lang = 'en' | 'nb' | 'es';

/** the device's language, when it is one we have */
export function deviceLang(): Lang {
  const tag = (typeof navigator !== 'undefined' ? navigator.language : 'en').toLowerCase();
  if (tag.startsWith('nb') || tag.startsWith('nn') || tag.startsWith('no')) return 'nb';
  if (tag.startsWith('es')) return 'es';
  return 'en';
}

interface Settings extends ThemeState {
  /** the app's language */
  lang: Lang;
  /** the theme chosen: dark, daylight, rosé, forest, Christmas in its
   *  season, or the device's light or dark (shownTheme gives the look) */
  theme: ThemeChoice;
  /** typeface of the board (digits and pencil marks); all other text
   *  keeps the face made for reading */
  font: Font;
  /** tint the row/column/box of a single selected cell */
  highlightPeers: boolean;
  /** tint all cells holding the same digit as the selection */
  highlightSameDigit: boolean;
  /** show an entered digit in red while it repeats within its row, column
   *  or box: a rule check, not a solution lookup, so it never counts as help */
  showConflicts: boolean;
  showTimer: boolean;
  /** when auto candidates are switched off, write the current candidate
   *  state into pencil marks so play continues seamlessly */
  autoOffMaterialize: boolean;
  /** which mark layer receives those candidates. Centre is the convention
   *  for exhaustive candidate lists; corner puts them in the digit-bound
   *  3×3 layout that hint highlights align with */
  materializeLayer: MarkLayer;
  /** practice mode jumps straight to the position where the chosen
   *  technique is the next step; off = play the puzzle from the start */
  practiceFastForward: boolean;
  /** the one-time "keep your candidates?" prompt on first auto-off has been
   *  answered */
  autoOffPromptDone: boolean;
  /** hide the difficulty badge and rating while playing (revealed on solve) —
   *  knowing a puzzle is rated 1200 tells you to expect advanced techniques */
  hideRating: boolean;
  /** show Nutella, the resident poodle, beneath the board */
  showPoodle: boolean;
  /** draw a thin frame around highlighted candidates (the held digit's
   *  pencil occurrences) — bold + colour alone can be hard to spot */
  frameHighlights: boolean;
  /** ring every unsolved cell whose marks leave exactly two candidates:
   *  where wings, chains and remote pairs begin, what a stuck player scans
   *  for. A view of the player's own marks (or of the auto candidates),
   *  never of the solution, so it never counts as help; under marks not
   *  declared complete it reads the centre marks alone (src/state/bivalue.ts) */
  highlightBivalue: boolean;
  /** two palette colours are two sets of cells, and a line under the board
   *  counts them, says what each still needs and whether they must hold the
   *  same digits (src/engine/sets.ts, src/ui/SetTracker.tsx). A view of the
   *  player's own board, never of the solution, so it never counts as help */
  setTracker: boolean;
  /** the palette indices of the two sets (0..8; key n paints index n - 1) */
  setColors: [number, number];
  /** a vertical swipe over the board on a phone scrolls the page (the
   *  board reads each touch, src/ui/touchIntent.ts); off, every move on the
   *  board selects, as on a tablet, and the page scrolls from beside it */
  scrollOverBoard: boolean;
  /** the first assist in a clean game asks first: it says what the button
   *  does (touch screens have no hover) and guards against a stray tap */
  confirmAssist: boolean;
  /** hints, Steps, Scan, the why-not proofs and the credit of a move may use
   *  the uniqueness family (unique rectangles, BUG+1 and their kin). Off,
   *  they find another way, as many solvers prefer: uniqueness leans on the
   *  puzzle having exactly one solution. The rating is HoDoKu's either way */
  useUniqueness: boolean;
  /** give each digit 1 to 9 a slight colour of its own on the board */
  digitTints: boolean;
  /** how much of the digit's own hue is mixed in, in percent */
  tintStrength: number;
  /** count this device's plays, offline ones included (src/state/telemetry.ts):
   *  the queue it keeps and the day it began exist only while this is on */
  countPlays: boolean;
  /** the win screen has pointed at that switch, once */
  countPlaysAsked: boolean;
  /** this device sends no counted lines at all (src/state/telemetry.ts): for
   *  the owner's and testers' devices, and for anyone who would rather not
   *  be counted. Kept at the player's request, like every setting */
  dontCount: boolean;
  /** a daily's time goes in by itself after every unassisted solve, as if
   *  the player had tapped "Send my time and compare" (gameStore.ts,
   *  recordDaily). Off until the player turns it on: offered on the win
   *  screen once a time has been sent, and here in Settings */
  autoSendDaily: boolean;

  /** the top bar's theme button: the next look (nextTheme), Christmas among them on a day of its season */
  toggleTheme: (today?: string) => void;
  /** a theme in the change is the player's pick (pickedTheme) */
  set: (p: Partial<Omit<Settings, 'toggleTheme' | 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      lang: deviceLang(),
      // dark for a new player (the owner's choice); Match device is beside
      // it in Settings. Every theme stored before Match device came is
      // still a choice, so a returning player keeps theirs with no migration.
      // In December a player who never picked one gets the Christmas look
      // (seasonTheme)
      theme: 'dark',
      themePicked: false,
      themeBefore: null,
      themeAutoYear: null,
      font: 'classic',
      highlightPeers: true,
      highlightSameDigit: true,
      showConflicts: true,
      showTimer: true,
      autoOffMaterialize: true,
      materializeLayer: 'center',
      practiceFastForward: true,
      autoOffPromptDone: false,
      hideRating: false,
      showPoodle: false,
      frameHighlights: true,
      highlightBivalue: false,
      setTracker: false,
      // blue and orange: keys 6 and 2 in Colour mode
      setColors: [5, 1],
      // off: the board takes every touch, which plays better on a phone or a
      // tablet; the page scrolls from beside it (the owner's call, 2 November 2026)
      scrollOverBoard: false,
      confirmAssist: true,
      useUniqueness: true,
      digitTints: false,
      tintStrength: 50,
      countPlays: false,
      countPlaysAsked: false,
      dontCount: false,
      autoSendDaily: false,
      toggleTheme: (today = localDateKey()) =>
        set((s) => pickedTheme(s, nextTheme(shownTheme(s.theme, deviceIsLight()), lookAvailable(today)))),
      set: (p) => set((s) => (p.theme === undefined ? p : { ...p, ...pickedTheme(s, p.theme) }))
    }),
    {
      name: 'sudokui-settings-v1',
      // version 1 (2 November 2026): scrolling over the board went off by
      // default. Every player kept it on only because it was the default,
      // so it goes off once for all of them; anyone who had turned it off
      // keeps it off, and anyone may turn it on again in Settings.
      // Version 2 (12 November 2026): whether the player ever picked a
      // theme is kept (themePicked), so December's Christmas look goes on
      // by itself only for a player who never did. Before it was kept, a
      // theme other than the default (dark) can only have been picked, so
      // it counts as one; a stored dark cannot be told from the default,
      // and counts as none (that player can switch the look off, a pick).
      // A flag already there (written by this build, then by an older one)
      // stays as it is
      version: 2,
      migrate: (stored, version) => {
        let state = (stored ?? {}) as Partial<Settings>;
        if (version < 1) state = { ...state, scrollOverBoard: false };
        if (version < 2 && state.themePicked === undefined) state = { ...state, themePicked: !!state.theme && state.theme !== 'dark' };
        return state as Settings;
      }
    }
  )
);

/**
 * The season's rules applied to the stored theme on the player's local
 * date (seasonTheme): the app asks as it starts, before its first paint,
 * and again whenever its day changes with the page open (src/ui/App.tsx,
 * useToday), so a page left open across midnight into December or into
 * January follows. A page that does not hold the play writes its settings
 * too (they are not the play's saves); every page reaches the same answer.
 */
export function applySeason(today = localDateKey()) {
  const change = seasonTheme(useSettings.getState(), today);
  if (change) useSettings.setState(change);
}

// A setting changed in another tab, or in the installed app's window, is
// taken here too, so a switch such as leaving the device out of the counts
// holds in every open window at once, and this window's next write of its
// settings does not put the old value back
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'sudokui-settings-v1') void useSettings.persist.rehydrate();
  });
}
