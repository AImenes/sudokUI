/**
 * Application entry point: mounts the React app inside its error boundary,
 * registers the service worker and wires the app's health signals
 * (src/state/appStatus.ts). Dev builds expose the zustand game store as
 * `window.__game` for console debugging and tests.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './ui/App';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './ui/styles.css';
import { useGame, asRead } from './state/gameStore';
import type { SavedGame, SetAside } from './state/gameStore';
import { useStats } from './state/stats';
import { useDailyStats } from './state/dailyStats';
import { play, startPlay, acted, clearing, SAVES } from './state/play';
import { useAppStatus, reloadIntoLatest } from './state/appStatus';
import { useSettings } from './state/settings';
import { startLocales, langOfPath, langRoot } from './content/i18n';
import { reloadMark, cameBack, entryState } from './ui/links';

// /nb/ and /es/ are the app in Norwegian and Spanish, the addresses search
// engines show for those languages: arriving there chooses the language.
// A page that comes up hidden (a link opened in a background tab) may be a
// view behind the page that plays, which writes nothing: its language
// waits until it holds the play (below). A page that plays alone (no Web
// Locks, or the browser refused one) takes it at once, as every page did
// before one page played at a time. App's start-up waits for the
// language's tables either way, so the link's first words are in it
const arrived = langOfPath(window.location.pathname);
let arrival = arrived;
const arrive = () => {
  const lang = arrival;
  arrival = null;
  if (lang && useSettings.getState().lang !== lang) useSettings.getState().set({ lang });
};
if (document.visibilityState !== 'hidden' || play.role === 'solo') arrive();

if (import.meta.env.DEV) {
  (window as any).__game = useGame;
  // screenshot staging for scripts/promo.sh (#demo=<scene> in the URL);
  // the boot flag must be claimed synchronously, before App's first effect
  // auto-starts a generated game
  if (window.location.hash.includes('demo=')) {
    (window as any).__sudokuiBooted = true;
    import('./ui/demo').catch(() => {});
  }
}

// A new build never replaces the running one under the player's feet: the
// service worker waits, the update bar offers a reload, and the open tab
// keeps the files it started with until then. Checked again every hour,
// for a tab that stays open all day.
const HOUR = 60 * 60 * 1000;
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh: () => useAppStatus.getState().setUpdateReady('update'),
  onOfflineReady: () => useAppStatus.getState().setOfflineReady(),
  onRegisteredSW: (_url, registration) => {
    if (!registration) return;
    setInterval(() => {
      if (navigator.onLine) registration.update().catch(() => {});
    }, HOUR);
  }
});
// Reload does what it says, with a new worker waiting or without one; the
// game is written first, its clock included (zustand's persist writes on
// every set, even one that changes nothing and so wakes no listener)
useAppStatus.getState().setReload(() => {
  void reloadIntoLatest(
    () => updateSW(true),
    () => useGame.setState((s) => s)
  );
});

// a lazily loaded file that cannot be fetched (the deploy moved on while
// the tab was open, or a first visit went offline before a service worker
// controlled it): say so and offer the reload. The import then resolves to
// nothing, which every loader takes as a failure (src/ui/lazyPart.ts for
// the guide, the photo reader in src/ui/Dialogs.tsx, ScanControls),
// instead of a broken dialog
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  useAppStatus.getState().setUpdateReady('chunk');
});

// One page of the app plays at a time (src/state/play.ts): asked for the
// play, this page writes its game, clock included, as a hidden page does
// (setAway pauses a game under way), then lets go and is a view. Given
// the play, a page that has not yet acted reads again the saves another
// page wrote meanwhile; one that has acted goes on as it is when nobody
// played meanwhile (the game's save as it left it, or differing only in
// the clock: inPlace), and reloads when another page played on the game
// or opened another, so it starts from the saves the way every page
// starts (it wrote nothing of its own while a view)
const STORES: Record<string, { persist: { rehydrate: () => unknown } }> = {
  'sudokui-game-v1': useGame,
  'sudokui-stats-v1': useStats,
  'sudokui-daily-v1': useDailyStats
};
const GAME = SAVES[0];

/** a game's save as clockOnly compares it (the kept game's note put away or not is taken from the save) */
type Saved = SavedGame & { setAside?: SetAside | null };

/**
 * The game's save differs from what this page last wrote or read only in
 * the clock, its time and whether it runs: another page showed a game
 * nobody played on, and its clock ran there (a game under way pauses as
 * the play goes, so its clock stands still), or paused or resumed it; or
 * it put the kept game's note away (✕), which this page then puts away
 * too. Both are compared as a page reading them takes them in (asRead): a
 * page that read the save with the chain trainer open closed the trainer
 * as it read it, so its next write has the trainer's auto candidates off,
 * with nothing played; this page keeps its trainer, and its next write
 * puts them back. And the game in this page's memory must still be the
 * one it last wrote: an opening that landed while it was a view (the
 * day's list or a new puzzle still coming as the play went) wrote
 * nothing, and the clock of the game it replaced is not its clock.
 * Nobody played, so nothing needs a reload: the clock is taken on from
 * where it stands. True once it has.
 */
function clockOnly(): boolean {
  try {
    const now = localStorage.getItem(GAME);
    const before = play.last(GAME);
    if (!now || !before) return false;
    const a = JSON.parse(before) as { state?: Saved; version?: number };
    const b = JSON.parse(now) as { state?: Saved; version?: number };
    const clock = b.state?.elapsedBefore;
    if (!a.state || !b.state || typeof clock !== 'number' || a.version !== b.version) return false;
    const game = (s: Saved) =>
      JSON.stringify({ ...asRead(s), elapsedBefore: 0, paused: false, setAside: s.setAside ? { ...s.setAside, hidden: undefined } : (s.setAside ?? null) });
    // this page's game as its next write would write it
    const partialize = useGame.persist.getOptions().partialize;
    if (!partialize) return false;
    const mine = JSON.parse(JSON.stringify(partialize(useGame.getState()))) as Saved;
    if (game(a.state) !== game(b.state) || game(mine) !== game(a.state)) return false;
    play.read(GAME, now);
    const kept = useGame.getState().setAside;
    useGame.setState({
      elapsedBefore: clock,
      paused: asRead(b.state).paused,
      startedAt: Date.now(),
      ...(kept && !!kept.hidden !== !!b.state.setAside?.hidden ? { setAside: { ...kept, hidden: !!b.state.setAside?.hidden } } : {})
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Nobody played while this page was a view: the game's save is as it left
 * it, or differs only in the clock (clockOnly). The record and the dailies'
 * save may still have changed, as another page showed the day's win screen
 * and fetched the day's numbers from the server, or sent the time: they
 * hold nothing of this page's own (its open panels, its undo steps and its
 * questions are the game store's), so they are read again in place, and
 * the page goes on as it is, its win screen and open panels with it. True
 * once it has; false when another page played (a reload is due).
 */
function inPlace(): boolean {
  const changed = play.changedSaves();
  if (changed.includes(GAME) && !clockOnly()) return false;
  for (const key of changed) if (key !== GAME) void STORES[key]?.persist.rehydrate();
  return true;
}

play.hooks = {
  give: () => {
    useGame.getState().setAway(true);
    // (zustand's persist writes on every set, even one that changes nothing)
    useGame.setState((s) => s);
  },
  taken: (changed, back) => {
    // a page that came up hidden in a link's language has it from now
    arrive();
    // (and the error screen's Clear, which reloads by itself once it has
    // cleared the board in the save: src/ui/ErrorBoundary.tsx)
    if (!acted() || clearing()) {
      // (the storage is read at once, so each save comes in within the call)
      for (const key of play.changedSaves()) void STORES[key]?.persist.rehydrate();
      // come back by Back or Forward before it ever started: its start
      // follows the rule of Back and Forward (src/ui/App.tsx)
      if (back && !acted()) cameBack();
      return;
    }
    if (!changed || inPlace()) return;
    play.leave();
    // into the saves as they are, the way every page starts. A page come
    // back by Back or Forward (from the back-forward cache) keeps its
    // entry's address, and its start brings that game back if this page
    // holds it, as Back does in the tab (src/ui/App.tsx). Any other starts
    // at the home address: the board another page left, not this page's
    // old game read as a link (the address follows the board once the app
    // is up), but with a link put into its address bar while it was a view
    // (the hash), which its start then opens. The reload takes the play
    // as a page shown again does, so it never takes it from the window the
    // player is in (Play.boot); one Play here brought takes it as a page
    // that starts does, so a window beside it that took the play while it
    // reloaded gives it back
    const mark = entryState({ sudokuiReload: { again: true, ...(back ? { back: true } : {}), ...(play.hereAsked ? { here: true } : {}) } });
    try {
      if (back) window.history.replaceState(mark, '');
      else window.history.replaceState(mark, '', langRoot(useSettings.getState().lang) + window.location.hash);
    } catch {
      /* an origin that allows no path of its own: the reload reads the hash */
    }
    window.location.reload();
  },
  lost: (away) => {
    // a page that has played carries the home address from now on, so a
    // reload of it, or the browser bringing back a discarded tab, starts
    // from the saves as coming back does, never from its old game's
    // address read as a link over the game another page has on the board.
    // Not one going into the back-forward cache: Back to it brings its own
    // game back (src/ui/App.tsx). A page that never started keeps its link
    if (!acted() || away) return;
    try {
      window.history.replaceState(entryState(), '', langRoot(useSettings.getState().lang));
    } catch {
      /* an origin that allows no path of its own */
    }
  }
};

// the first render waits for the chosen language's tables (precached, so a
// moment even offline), and for the play (a moment, or the holder's wait
// when it does not answer); if the tables cannot be fetched the app starts
// in English
const claimed = Promise.race([startPlay(!!reloadMark.again, !!reloadMark.here), new Promise<void>((done) => setTimeout(done, 4000))])
  .catch(() => {})
  // (a page the browser refused a lock plays alone: its link's language now)
  .then(() => {
    if (play.role === 'solo') arrive();
  });
Promise.all([startLocales().catch(() => {}), claimed]).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
