// The last line of defence: a render error anywhere in the app shows this
// panel instead of a blank page. The game is saved in localStorage, so a
// reload usually brings it back; if the saved game itself is what breaks,
// the second button clears it and starts fresh. Settings, stats and pools
// are left alone.
import React from 'react';

const GAME_KEY = 'sudokui-game-v1';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('sudokUI crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const reset = () => {
      try {
        localStorage.removeItem(GAME_KEY);
      } catch {
        /* storage unavailable: a reload is all that is left */
      }
      window.location.reload();
    };
    return (
      <div className="crash" role="alert">
        <h1>Something went wrong</h1>
        <p>
          sudokUI hit an error it could not recover from. Your game is saved on this device, so reloading
          usually brings it straight back.
        </p>
        <p className="crash-detail">{String(error.message || error)}</p>
        <div className="hint-actions">
          <button onClick={() => window.location.reload()}>Reload</button>
          <button className="ghost" onClick={reset} title="Clears the saved game only; settings and your record stay">
            Clear the board and reload
          </button>
        </div>
        <p className="crash-detail">
          If it keeps happening, please report it:{' '}
          <a href="https://github.com/AImenes/sudokUI/issues" target="_blank" rel="noopener">
            github.com/AImenes/sudokUI/issues
          </a>
        </p>
      </div>
    );
  }
}
