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
import { useGame } from './state/gameStore';
import { useStats } from './state/stats';
import { useDailyStats } from './state/dailyStats';
import { play, startPlay, acted } from './state/play';
import { useAppStatus, reloadIntoLatest } from './state/appStatus';
import { useSettings } from './state/settings';
import { startLocales, langOfPath, langRoot } from './content/i18n';

// /nb/ and /es/ are the app in Norwegian and Spanish, the addresses search
// engines show for those languages: arriving there chooses the language
const arrived = langOfPath(window.location.pathname);
if (arrived && useSettings.getState().lang !== arrived) useSettings.getState().set({ lang: arrived });

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
// page wrote meanwhile; one that has acted goes on as it is when the saves
// are as it left them, and otherwise reloads, so it starts from them the
// way every page starts (it wrote nothing of its own while a view)
const STORES: Record<string, { persist: { rehydrate: () => unknown } }> = {
  'sudokui-game-v1': useGame,
  'sudokui-stats-v1': useStats,
  'sudokui-daily-v1': useDailyStats
};
play.hooks = {
  give: () => {
    useGame.getState().setAway(true);
    // (zustand's persist writes on every set, even one that changes nothing)
    useGame.setState((s) => s);
  },
  taken: (changed) => {
    if (!acted()) {
      // (the storage is read at once, so each save comes in within the call)
      for (const key of play.changedSaves()) void STORES[key]?.persist.rehydrate();
      return;
    }
    if (!changed) return;
    play.leave();
    // into the saves as they are: the board another page left, not this
    // page's address read as a link to its old game (the address follows
    // the board once the app is up)
    try {
      window.history.replaceState(null, '', langRoot(useSettings.getState().lang));
    } catch {
      /* an origin that allows no path of its own: the reload reads the hash */
    }
    window.location.reload();
  },
  lost: () => {}
};

// the first render waits for the chosen language's tables (precached, so a
// moment even offline), and for the play (a moment, or the holder's wait
// when it does not answer); if the tables cannot be fetched the app starts
// in English
const claimed = Promise.race([startPlay(), new Promise<void>((done) => setTimeout(done, 4000))]).catch(() => {});
Promise.all([startLocales().catch(() => {}), claimed]).finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
});
