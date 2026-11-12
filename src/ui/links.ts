// What the app does with a game it is asked to open from outside: an
// address of its own (src/content/share.ts, readAppLink) opened at start-up
// or in the same tab, or pasted into Import, and the day's daily (the New
// dialog's Daily, the past-daily note's link). The one rule: a game under
// way is never lost silently (docs/architecture.md, "A game is never
// lost"). It goes aside before another opens over it (gameStore.ts,
// openOver), and the note beside the board offers it back; a link or the
// Daily button that asks for the very game on the board, the one set
// aside, or the one behind a puzzle being typed in, brings it back where
// it was left. Only Restart starts a game under way again.
import { useGame, validatePuzzle, whereLeft } from '../state/gameStore';
import type { PositionRefusal, GameInfo } from '../state/gameStore';
import { dailyPuzzle } from '../engine/daily';
import { translator } from '../content/i18n';
import { clockOf } from '../content/share';
import type { AppLink } from '../content/share';
import { localDateKey, dateOfKey, loadDailies, findDaily, dailyNumber, dailyLocked, dayAfter, dayName } from '../content/dailies';
import { loadAdvent, findDoor } from '../content/advent';
import { calendarOpen, doorDate, doorState, isDoor } from '../content/season';
import { play } from '../state/play';

/** the challenger's time becomes the one to beat, and the player is told */
export function challenge(vs: number) {
  const t = translator();
  useGame.setState((s) => ({
    info: s.info && { ...s.info, challenge: vs },
    notice: t('A challenge: solve it faster than {time}', { time: clockOf(vs) })
  }));
}

/** a game nobody has touched: its clock may have run, nothing else has happened */
const untouched = () => useGame.getState().cells.every((c) => c.given || (!c.value && !c.corner && !c.center && !c.colors.length));

/** the game on the board is now the one a share link opened, for the counts (gameStore.ts, kindOf) */
const fromLink = () => useGame.setState((s) => ({ info: s.info && { ...s.info, fromLink: true } }));

/** the challenger's time over the game already on the board */
function challengeCurrent(vs: number) {
  // a finished game, or one not yet begun, starts over against that time,
  // as the link's game; one under way keeps its moves and takes the time on
  if (useGame.getState().won || untouched()) {
    useGame.getState().restart();
    fromLink();
  }
  challenge(vs);
}

/** the board holds this day's daily, not a puzzle being typed in */
const dailyOnBoard = (date: string) => {
  const g = useGame.getState();
  return !g.custom && g.info?.dailyKey === date;
};

/** why a day's daily is not on the board: the published list could not be loaded */
const unavailable = (date: string) => {
  const t = translator();
  return date === localDateKey()
    ? t('Today’s daily could not be loaded. Check the connection and try again')
    : t('The daily for {date} could not be loaded. Check the connection and try again', { date });
};

/**
 * The lock on a day still to come (the owner's decisions of 12 November
 * 2026; dailies.ts, dayToCome): a daily whose day is after the player's
 * local today (dailyLocked), or a door of the advent calendar whose day is
 * (season.ts, doorState), opens nothing, whatever asks for it, and this
 * line says when it does, in one style for both: at midnight when that day
 * is tomorrow, else on its day. "Tomorrow's daily opens at midnight",
 * "That daily opens on 20 November"; "Door 2 of the advent calendar opens
 * at midnight", "Door 24 of the advent calendar opens on 24 December".
 */
export function lockedLine(date: string, today = localDateKey(), door?: number): string {
  const t = translator();
  const tomorrow = date === dayAfter(today);
  if (door !== undefined)
    return tomorrow
      ? t('Door {door} of the advent calendar opens at midnight', { door })
      : t('Door {door} of the advent calendar opens on {date}', { door, date: dayName(date, t.locale, today) });
  return tomorrow ? t('Tomorrow’s daily opens at midnight') : t('That daily opens on {date}', { date: dayName(date, t.locale, today) });
}

/**
 * what startDaily did: brought back the day's daily where it was left,
 * started it, could not load it, let it go because the page no longer
 * held the play when the day's list came (`dropped`), or opened nothing
 * because the day has not come (`locked`)
 */
export type DailyOpened = 'resumed' | 'started' | 'unavailable' | 'dropped' | 'locked';

/**
 * The daily for a day, today's unless a date is given: the published
 * puzzle (src/content/dailies.ts), which has global statistics; or, for a
 * day the published list does not cover, the one derived from the date
 * (src/engine/daily.ts), which has none. The day's daily on the board, set
 * aside, or behind a puzzle being typed in, is the one that opens, where
 * it was left, solved or not: only Restart starts it again. One in none
 * of those places (never started, or gone: solved and then replaced,
 * since a solved game is not kept, or dropped by New) starts fresh. Without the published list (offline
 * before the app could keep it, a network error) no other board is passed
 * off as the day's: the board stays as it is, and the player is told. A
 * day after the player's local today (dailyLocked) opens nothing at all,
 * whatever asked for it: the board stays, and the player is told when it
 * opens (lockedLine).
 */
export async function startDaily(date = localDateKey()): Promise<DailyOpened> {
  const t = translator();
  const now = localDateKey();
  if (dailyLocked(date, now)) {
    useGame.setState({ notice: lockedLine(date, now) });
    return 'locked';
  }
  const today = date === now;
  const leftIt = () => (today ? t('Today’s daily, where you left it') : t('The daily for {date}, where you left it', { date }));
  // on the board, set aside, or behind a puzzle being typed in (on the
  // board or set aside): that daily, never a second copy of it
  if (dailyOnBoard(date) || useGame.getState().resumeSetAside((info) => info.dailyKey === date)) {
    useGame.setState({ notice: useGame.getState().won ? t('You have solved this daily. Restart plays it again') : leftIt() });
    return 'resumed';
  }
  const list = await loadDailies();
  // the play went while the list came (the player switched to another
  // tab, which plays now): a view opens nothing, as it writes nothing, so
  // the game another page carries on is the one this page comes back to
  if (!play.acts()) return 'dropped';
  const no = dailyNumber(date);
  if (!list && no) {
    useGame.setState({ notice: unavailable(date) });
    return 'unavailable';
  }
  const published = list && findDaily(list, date);
  useGame.getState().openOver(() => {
    if (published && no) {
      useGame.getState().startGame(published.puzzle, published.score, published.level, null, date);
      useGame.setState((s) => ({ info: s.info && { ...s.info, dailyNo: no } }));
    } else {
      const d = dailyPuzzle(dateOfKey(date) ?? new Date());
      useGame.getState().startGame(d.puzzle, d.score, d.level, null, date);
    }
    return true;
  });
  useGame.setState({
    notice: today ? t('Daily puzzle for {date}. Everyone gets this same board today', { date }) : t('The daily for {date}', { date })
  });
  return 'started';
}

/** the board holds this door of the advent calendar, not a puzzle being typed in */
const doorOnBoard = (year: number, door: number) => {
  const g = useGame.getState();
  return !g.custom && g.info?.adventYear === year && g.info?.adventDoor === door;
};

/** a game is this door */
const isTheDoor = (year: number, door: number) => (info: GameInfo) => info.adventYear === year && info.adventDoor === door;

/**
 * The lock line of an address that names a daily or a door whose day has
 * not come (lockedLine), or null: what its link, Import, Back and Forward
 * all ask before anything else
 */
function dayLock(link: AppLink, today = localDateKey()): string | null {
  if (link.daily) return dailyLocked(link.daily.date, today) ? lockedLine(link.daily.date, today) : null;
  if (!link.advent) return null;
  const { year, door } = link.advent;
  return doorState(year, door, today) === 'locked' ? lockedLine(doorDate(year, door), today, door) : null;
}

/** this door is a game the page holds: on the board, in the slot, or behind a puzzle being typed in (holds) */
const holdsDoor = (year: number, door: number) => holds({ advent: { year, door } });

/**
 * Why a door does not open on the player's today, or null when it may (the
 * season says where it stands, season.ts doorState). A door whose day has
 * not come is locked as a daily whose day has not come is, whatever the
 * page holds, and the line says when it opens (lockedLine). A door of a
 * calendar that has closed (from 1 January until November, or another
 * year's) opens only as a game the player already holds, which is theirs
 * and comes back where it was left (`held`); any other says the calendar
 * is closed.
 */
export function doorLocked(year: number, door: number, today = localDateKey(), held = holdsDoor(year, door)): string | null {
  const t = translator();
  if (!isDoor(door)) return t('The advent calendar has no door {door}', { door });
  const state = doorState(year, door, today);
  if (state === 'open') return null;
  if (state === 'locked') return lockedLine(doorDate(year, door), today, door);
  if (held) return null;
  return calendarOpen(today) ? t('That door is from another year’s advent calendar') : t('The advent calendar is closed until November');
}

/** what startDoor did: as startDaily, `locked` for a door whose day has not come or whose calendar has closed */
export type DoorOpened = 'resumed' | 'started' | 'locked' | 'unavailable' | 'dropped';

/**
 * A door of the advent calendar (src/content/advent.ts), as the day's
 * daily opens (startDaily). A door whose day has not come (doorState, the
 * player's local date) opens nothing, by its address, a link, Import or
 * the calendar, not even a copy of it in the slot (it stays there, where
 * Back to it brings it): the player is told when it opens, and nothing
 * goes over the game on the board. A door whose day has come is the one
 * on the board, set aside, or behind a puzzle being typed in, where it was
 * left, never a second copy; and so it is from 1 January (a door game in
 * progress is never lost, and can be finished after the calendar closes),
 * when no other door opens. Any other open door starts fresh over a game
 * under way set aside (openOver). Without the published list (offline
 * before the app could keep it) the board stays and the player is told.
 */
export async function startDoor(year: number, door: number): Promise<DoorOpened> {
  const t = translator();
  const named = isTheDoor(year, door);
  const locked = doorLocked(year, door);
  if (locked) {
    useGame.setState({ notice: locked });
    return 'locked';
  }
  if (doorOnBoard(year, door) || useGame.getState().resumeSetAside((info) => named(info))) {
    useGame.setState({
      notice: useGame.getState().won
        ? t('You have solved this door. Restart plays it again')
        : t('Door {door} of the advent calendar, where you left it', { door })
    });
    return 'resumed';
  }
  const list = await loadAdvent();
  // the play went while the list came: a view opens nothing (startDaily)
  if (!play.acts()) return 'dropped';
  const found = list && findDoor(list, year, door);
  if (!found) {
    useGame.setState({ notice: t('Door {door} of the advent calendar could not be loaded. Check the connection and try again', { door }) });
    return 'unavailable';
  }
  useGame.getState().openOver(() => {
    useGame.getState().startGame(found.puzzle, found.score, found.level, null);
    useGame.setState((s) => ({ info: s.info && { ...s.info, adventYear: year, adventDoor: door } }));
    return true;
  });
  useGame.setState({ notice: t('Door {door} of the advent calendar. Everyone gets this same board', { door }) });
  return 'started';
}

/** a position link's board, over a game under way set aside: true, or why it could not be loaded */
function openPosition(payload: string): true | PositionRefusal {
  let result: true | PositionRefusal = 'unreadable';
  useGame.getState().openOver(() => (result = useGame.getState().loadPosition(payload)) === true);
  return result;
}

/**
 * Where an address came from: the app's own start-up (a reload of the
 * game on the board lands here, quietly), a hash change in the same tab,
 * or Import, whose dialog shows a refusal itself.
 */
export type LinkFrom = 'boot' | 'tab' | 'import';

/** what opening an address did: whether a game opened, and, when its puzzle could not be, why */
export interface LinkOpened {
  opened: boolean;
  refused?: string;
}

/**
 * Opens an address of the app's own, the same way wherever it arrives: a
 * position (#s=) as it was shared; a daily (startDaily); a puzzle, which
 * is the game on the board or the one set aside when it is that puzzle
 * (a practice of it too, but for Import), and otherwise opens fresh, a
 * challenger's time on it where one rides along. A game under way goes
 * aside first. A position that cannot be loaded (a chat or a copy cut the
 * link short, most likely) leaves the puzzle under it to open from the
 * start, and the player is told why the marks are not there.
 */
export async function openAppLink(link: AppLink, from: LinkFrom): Promise<LinkOpened> {
  const t = translator();
  const game = useGame.getState;
  // a daily or a door whose day has not come opens nothing, nor does a
  // door of a calendar that has closed which this page does not hold, not
  // even a position shared on its address (/daily/<date>#s=…): before
  // anything else, so no game goes aside for it. Its own copy already on
  // the board (an earlier build opened it, the device's clock went back)
  // stays as it is, quietly; the toast says when it opens, and Import says
  // it in its own dialog
  const lock = dayLock(link) ?? (link.advent ? doorLocked(link.advent.year, link.advent.door) : null);
  if (lock) {
    const own = link.daily ? dailyOnBoard(link.daily.date) : !!link.advent && doorOnBoard(link.advent.year, link.advent.door);
    if (from !== 'import' && own) return { opened: true };
    if (from === 'import') return { opened: false, refused: lock };
    useGame.setState({ notice: lock });
    return { opened: false };
  }
  const position = link.position ? openPosition(link.position) : null;
  if (position === true) return { opened: true };
  const refusal = position === 'cut'
    ? t('This link looks cut off, so the entries and marks it shared could not be loaded')
    : position
      ? t('The entries and marks this link shared could not be read')
      : null;
  const positionRefused = () => {
    if (refusal) useGame.setState({ notice: refusal });
  };
  if (link.daily) {
    const { date, vs } = link.daily;
    // the day's board already on the board: a reload lands here, quietly
    if (from !== 'import' && dailyOnBoard(date)) {
      if (vs) challengeCurrent(vs);
      positionRefused();
      return { opened: true };
    }
    const opened = await startDaily(date);
    if (opened === 'dropped') return { opened: false };
    if (opened === 'unavailable') {
      // Import says it in its own dialog
      if (from === 'import') useGame.setState({ notice: null });
      return { opened: false, refused: unavailable(date) };
    }
    if (vs) (opened === 'started' ? challenge : challengeCurrent)(vs);
    positionRefused();
    return { opened: true };
  }
  if (link.advent) {
    const { year, door, vs } = link.advent;
    // the door on the board already: a reload lands here, quietly
    if (from !== 'import' && doorOnBoard(year, door)) {
      if (vs) challengeCurrent(vs);
      positionRefused();
      return { opened: true };
    }
    const opened = await startDoor(year, door);
    if (opened === 'dropped') return { opened: false };
    if (opened === 'locked' || opened === 'unavailable') {
      // Import says it in its own dialog; anywhere else the notice stands
      // (locked: the day turned since the check above)
      const why = useGame.getState().notice ?? '';
      if (from === 'import') useGame.setState({ notice: null });
      return { opened: false, refused: why };
    }
    if (vs) (opened === 'started' ? challenge : challengeCurrent)(vs);
    positionRefused();
    return { opened: true };
  }
  if (link.puzzle) {
    const { cells, share, vs } = link.puzzle;
    const g = game();
    // the puzzle already on the board (a reload lands here), perhaps with
    // a challenger's time for it; pasted into Import, it goes on as it was
    // unless it is solved, when Import plays it again, or its practice
    if (!g.custom && g.info?.puzzle === cells && (from !== 'import' || (!g.won && !g.info.practiceTech))) {
      if (vs) challengeCurrent(vs);
      else if (from === 'import') useGame.setState({ notice: t('Your game on this puzzle, where you left it') });
      positionRefused();
      return { opened: true };
    }
    // the puzzle set aside, or behind a puzzle being typed in, asked for
    // again: it comes back where it was left, and a challenger's time
    // goes on its moves (on the same terms as the board's, above). A
    // practice is another game, but the address bar names its puzzle: a
    // reload, Back or Forward to it brings a kept practice of that puzzle
    // back when no plain game of it is kept (not Import, which plays the
    // puzzle itself)
    if (
      g.resumeSetAside((info, won) => info.puzzle === cells && !info.practiceTech && (from !== 'import' || !won)) ||
      (from !== 'import' && g.resumeSetAside((info, won) => info.puzzle === cells && !!info.practiceTech && !won))
    ) {
      useGame.setState({ notice: whereLeft() });
      if (vs) challengeCurrent(vs);
      positionRefused();
      return { opened: true };
    }
    const v = validatePuzzle(cells);
    if (v.ok) {
      // a share address is someone's link; a bare #p= is mostly the Learn
      // pages' own (their examples and their paste box), so its game is
      // counted as a new one. Marked as it opens, so a game the one slot
      // lets go is named apart from it (gameStore.ts, letGoLine)
      game().openOver(() => {
        game().startGame(cells, v.score, v.level);
        if (share) fromLink();
        return true;
      });
      if (vs) challenge(vs);
      else if (from === 'import')
        useGame.setState({
          notice: t('Imported from {site}, HoDoKu rating {score} ({level})', { site: t('a sudokUI link'), score: v.score, level: t.level(v.level) })
        });
      positionRefused();
      return { opened: true };
    }
    // a share page promised a puzzle the app cannot play (no solution,
    // several, too few clues); Import says why in its own dialog
    if (from !== 'import') positionRefused();
    return { opened: false, refused: v.reason };
  }
  // a position alone, whose puzzle came with it and could not be read
  if (from !== 'import') positionRefused();
  return { opened: false, ...(refusal ? { refused: refusal } : {}) };
}

/**
 * Whether the game an address names is one this page holds: on the board,
 * in the slot, or behind a puzzle being typed in (on the board or in the
 * slot); a day's daily by its date, any other game by its puzzle (a
 * practice of it too, as the address bar names a practice by its puzzle).
 * Back and Forward bring back only such a game (src/ui/App.tsx).
 */
export function holds(link: AppLink): boolean {
  const g = useGame.getState();
  const games = [
    g.custom ? g.customBackup?.info : g.info,
    g.setAside?.custom ? g.setAside.customBackup?.info : g.setAside?.info
  ].filter((info): info is GameInfo => !!info);
  if (link.daily) {
    const { date } = link.daily;
    return games.some((info) => info.dailyKey === date);
  }
  if (link.advent) return games.some(isTheDoor(link.advent.year, link.advent.door));
  if (link.puzzle) {
    const { cells } = link.puzzle;
    return games.some((info) => info.puzzle === cells);
  }
  return false;
}

/**
 * Back or Forward to an address that names a game this page holds (holds):
 * that game comes back as a link to it brings it, where it was left, but
 * never by letting a game go. The game behind a puzzle being typed in on
 * the board stays behind it (it is the board's already, under the entry,
 * and Cancel brings it), and a swap the one slot could not keep whole
 * (resumeSetAside's `keep`) is not made: the board stays as it is. A
 * daily or a door whose day has not come stays in the slot, as its link
 * leaves it (dayLock). True when the board is now the game the address
 * names.
 */
export function backTo(link: AppLink): boolean {
  const g = useGame.getState();
  const named = (info: GameInfo | null | undefined) =>
    !!info &&
    (link.daily
      ? info.dailyKey === link.daily.date
      : link.advent
        ? isTheDoor(link.advent.year, link.advent.door)(info)
        : !!link.puzzle && info.puzzle === link.puzzle.cells);
  if (!g.custom && named(g.info)) return true;
  if (g.custom && named(g.customBackup?.info)) return false;
  // a daily or a door whose day has not come is not brought onto the
  // board, as its link brings nothing: it stays where it is, in the slot,
  // and the toast says when it opens
  const lock = dayLock(link);
  if (lock) {
    useGame.setState({ notice: lock });
    return false;
  }
  const back = link.daily || link.advent
    ? g.resumeSetAside((info) => named(info), true)
    : // a plain game of the puzzle first, a practice of it only when none is kept (as a link to it)
      g.resumeSetAside((info) => named(info) && !info.practiceTech, true) || g.resumeSetAside((info, won) => named(info) && !!info.practiceTech && !won, true);
  if (back) useGame.setState({ notice: whereLeft() });
  return back;
}

/**
 * The marks the app leaves in a history entry. One for an entry it has not
 * yet started on (`sudokuiLink`), written as the page loads: a link opened
 * in a background tab that was never looked at keeps it, so when the
 * browser's session restore or Reopen closed tab loads it again (as Back
 * and Forward load a page) it opens its link as a link does. And one for an
 * entry it has started on (`sudokuiStarted`, App: markStarted), which every
 * address the app writes from then keeps (entryState): Back or Forward to
 * it follows the rule of Back and Forward (traversed), and so does an entry
 * with neither, which an earlier build of the app wrote. They say only
 * that, stay in the tab's history, and are never sent.
 */
const STARTED = 'sudokuiStarted';
const LINK = 'sudokuiLink';

const flagged = (state: unknown, key: string) => !!state && typeof state === 'object' && (state as Record<string, unknown>)[key] === true;

/** this page's history entry as the page loaded: started on before (its mark), or not yet started on (its link's mark) */
const entryAtLoad = (() => {
  if (typeof window === 'undefined') return { started: false, link: false };
  try {
    const state = window.history.state as unknown;
    const at = { started: flagged(state, STARTED), link: flagged(state, LINK) };
    // not started on: marked so until the start-up runs (the rest of the
    // state kept, a reload's mark among it)
    if (!at.started && !at.link) window.history.replaceState({ ...(state && typeof state === 'object' ? state : {}), [LINK]: true }, '');
    return at;
  } catch {
    return { started: false, link: false };
  }
})();
const startedBefore = entryAtLoad.started;

/** this page's start-up has run (markStarted) */
let startedNow = false;

/**
 * The history state the app writes with an address (replaceState): the
 * started mark, once this page has started or when its entry has it, and
 * else the mark of an entry not yet started on; and what else is asked
 * for (a reload's mark).
 */
export function entryState(extra?: Record<string, unknown>): Record<string, unknown> {
  let started = startedNow || startedBefore;
  try {
    if (!started && typeof window !== 'undefined') started = flagged(window.history.state, STARTED);
  } catch {
    /* no history to read: the flags above say it */
  }
  return { [started ? STARTED : LINK]: true, ...extra };
}

/** App's start-up runs: this entry, and every address the app writes from now, carries the mark */
export function markStarted() {
  startedNow = true;
  markEntry();
}

/** a new entry of this page's (a hash put into the address bar), once its start-up has run: the app is on it, so it carries the mark */
export function markEntry() {
  if (!startedNow) return;
  try {
    window.history.replaceState(entryState(), '');
  } catch {
    /* an origin that allows no history state: Back and Forward then read as links */
  }
}

/**
 * What a page reloading itself left in its own history entry for its next
 * start (src/main.tsx): `again`, it reloaded to take the play back (it then
 * takes it as a page shown again does, src/state/play.ts); `here`, Play
 * here brought that reload (it takes it as a page that starts does);
 * `back`, it came back by Back or Forward. Read once, as the page loads,
 * and taken off the entry (the started mark stays); never sent.
 */
export const reloadMark: { again?: boolean; back?: boolean; here?: boolean } = (() => {
  if (typeof window === 'undefined') return {};
  try {
    const mark = (window.history.state as { sudokuiReload?: { again?: boolean; back?: boolean; here?: boolean } } | null)?.sudokuiReload;
    if (!mark) return {};
    window.history.replaceState(entryState(), '');
    return { again: !!mark.again, back: !!mark.back, here: !!mark.here };
  } catch {
    return {};
  }
})();

/** this page came back by Back or Forward before it ever started (src/main.tsx) */
export function cameBack() {
  reloadMark.back = true;
}

/**
 * This page was reached by Back or Forward (a page of the app another
 * document of the tab left, or one come back from the back-forward cache
 * and reloaded into the saves) on an entry the app had started on, or one
 * an earlier build wrote (neither mark): its start follows the rule of
 * Back and Forward, as in the tab (backTo), not a link's. A tab the
 * browser restores or reopens loads as Back and Forward do; one whose
 * entry never started (a link opened in a background tab and never looked
 * at: the link's mark) opens its link as a link does.
 */
export function traversed(): boolean {
  if (entryAtLoad.link) return false;
  if (reloadMark.back) return true;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'back_forward';
  } catch {
    return false;
  }
}

/**
 * Back to it (the note beside the board, or New): the kept game returns
 * where it was left, the game on the board takes its place if it is under
 * way, and the player is told which game is back.
 */
export function backToKept() {
  useGame.getState().backToSetAside();
  useGame.setState({ notice: whereLeft() });
}
