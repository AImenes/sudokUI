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
import { useAppStatus } from './state/appStatus';

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
useAppStatus.getState().setReload(() => {
  updateSW(true).catch(() => window.location.reload());
});

// a lazily loaded file this version can no longer fetch (the deploy moved
// on while the tab was open): say so and offer the reload, instead of a
// broken dialog
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  useAppStatus.getState().setUpdateReady('chunk');
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
