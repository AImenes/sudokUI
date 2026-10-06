// The last line of defence: a render error anywhere in the app shows this
// panel instead of a blank page. The game is saved in localStorage, so a
// reload usually brings it back; if the saved game itself is what breaks,
// the second button clears it and starts fresh. Settings, stats and pools
// are left alone.
import React from 'react';
import { translator, makeTranslator, rich } from '../content/i18n';
import type { Translator } from '../content/i18n';

const GAME_KEY = 'sudokui-game-v1';
const ISSUES = 'github.com/AImenes/sudokUI/issues';

/** the chosen language; English if even that cannot be had, so the panel itself never fails */
function panelTranslator(): Translator {
  try {
    return translator();
  } catch {
    return makeTranslator('en');
  }
}

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
    const t = panelTranslator();
    return (
      <div className="crash" role="alert">
        <h1>{t('Something went wrong')}</h1>
        <p>
          {t(
            'sudokUI hit an error it could not recover from. Your game is saved on this device, so reloading usually brings it straight back.'
          )}
        </p>
        <p className="crash-detail">{String(error.message || error)}</p>
        <div className="hint-actions">
          <button onClick={() => window.location.reload()}>{t('Reload')}</button>
          <button className="ghost" onClick={reset} title={t('Clears the saved game only; settings and your record stay')}>
            {t('Clear the board and reload')}
          </button>
        </div>
        <p className="crash-detail">
          {rich(t('If it keeps happening, please report it: {link}'), {
            link: (
              <a href={`https://${ISSUES}`} target="_blank" rel="noopener">
                {ISSUES}
              </a>
            )
          })}
        </p>
      </div>
    );
  }
}
