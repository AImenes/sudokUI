/**
 * Application entry point: mounts the React app. Dev builds expose the
 * zustand game store as `window.__game` for console debugging and tests.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import './ui/styles.css';
import { useGame } from './state/gameStore';

if (import.meta.env.DEV) {
  (window as any).__game = useGame;
  // screenshot staging for scripts/promo.sh (#demo=<scene> in the URL);
  // the boot flag must be claimed synchronously, before App's first effect
  // auto-starts a generated game
  if (window.location.hash.includes('demo=')) {
    (window as any).__sudokuiBooted = true;
    import('./ui/demo');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
