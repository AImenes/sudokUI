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
import { useGame, validatePuzzle } from '../state/gameStore';
import type { PositionRefusal } from '../state/gameStore';
import { dailyPuzzle } from '../engine/daily';
import { translator } from '../content/i18n';
import { clockOf } from '../content/share';
import type { AppLink } from '../content/share';
import { localDateKey, dateOfKey, loadDailies, findDaily, dailyNumber } from '../content/dailies';

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

/** what startDaily did: brought back the day's daily where it was left, started it, or could not load it */
export type DailyOpened = 'resumed' | 'started' | 'unavailable';

/**
 * The daily for a day, today's unless a date is given: the published
 * puzzle (src/content/dailies.ts), which has global statistics; or, for a
 * day the published list does not cover, the one derived from the date
 * (src/engine/daily.ts), which has none. The day's daily on the board, set
 * aside, or behind a puzzle being typed in, is the one that opens, where
 * it was left, solved or not: only Restart starts it again. Without the
 * published list (offline before the app could keep it, a network error)
 * no other board is passed off as the day's: the board stays as it is, and
 * the player is told.
 */
export async function startDaily(date = localDateKey()): Promise<DailyOpened> {
  const t = translator();
  const today = date === localDateKey();
  const leftIt = () => (today ? t('Today’s daily, where you left it') : t('The daily for {date}, where you left it', { date }));
  // on the board, set aside, or behind a puzzle being typed in (on the
  // board or set aside): that daily, never a second copy of it
  if (dailyOnBoard(date) || useGame.getState().resumeSetAside((info) => info.dailyKey === date)) {
    useGame.setState({ notice: useGame.getState().won ? t('You have solved this daily. Restart plays it again') : leftIt() });
    return 'resumed';
  }
  const list = await loadDailies();
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
 * is the game on the board or the one set aside when it is that puzzle,
 * and otherwise opens fresh, a challenger's time on it where one rides
 * along. A game under way goes aside first. A position that cannot be
 * loaded (a chat or a copy cut the link short, most likely) leaves the
 * puzzle under it to open from the start, and the player is told why the
 * marks are not there.
 */
export async function openAppLink(link: AppLink, from: LinkFrom): Promise<LinkOpened> {
  const t = translator();
  const game = useGame.getState;
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
    if (opened === 'unavailable') {
      // Import says it in its own dialog
      if (from === 'import') useGame.setState({ notice: null });
      return { opened: false, refused: unavailable(date) };
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
    // goes on its moves (on the same terms as the board's, above)
    if (g.resumeSetAside((info, won) => info.puzzle === cells && !info.practiceTech && (from !== 'import' || !won))) {
      useGame.setState({ notice: t('Your game on this puzzle, where you left it') });
      if (vs) challengeCurrent(vs);
      positionRefused();
      return { opened: true };
    }
    const v = validatePuzzle(cells);
    if (v.ok) {
      game().openOver(() => (game().startGame(cells, v.score, v.level), true));
      // a share address is someone's link; a bare #p= is mostly the Learn
      // pages' own (their examples and their paste box), so its game is
      // counted as a new one
      if (share) fromLink();
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
 * Back to it (the note beside the board, or New): the kept game returns
 * where it was left, the game on the board takes its place if it is under
 * way, and the player is told which game is back.
 */
export function backToKept() {
  const t = translator();
  useGame.getState().backToSetAside();
  const g = useGame.getState();
  const day = g.info?.dailyKey;
  useGame.setState({
    notice: g.custom
      ? t('The puzzle you were typing in, where you left it')
      : day === localDateKey()
        ? t('Today’s daily, where you left it')
        : day
          ? t('The daily for {date}, where you left it', { date: day })
          : t('Your game on this puzzle, where you left it')
  });
}
