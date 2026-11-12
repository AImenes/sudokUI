// The last line of defence: a render error anywhere in the app shows this
// panel instead of a blank page. The game is saved in localStorage, so a
// reload usually brings it back; if the saved game itself is what breaks,
// the second button clears it and starts fresh. Settings, stats and pools
// are left alone, and so is a game kept aside, or the game a puzzle being
// typed in was opened over (boardCleared).
import React from 'react';
import { translator, makeTranslator, rich } from '../content/i18n';
import type { Translator } from '../content/i18n';
import { play, setClearing } from '../state/play';

const GAME_KEY = 'sudokui-game-v1';
const ISSUES = 'github.com/AImenes/sudokUI/issues';
/** the public address reports go to (src/ui/report.ts), which Email Routing forwards */
const FEEDBACK_ADDRESS = 'feedback@sudokui.app';

/** the chosen language; English if even that cannot be had, so the panel itself never fails */
function panelTranslator(): Translator {
  try {
    return translator();
  } catch {
    return makeTranslator('en');
  }
}

/**
 * The save once the board is cleared: only the game kept aside (a link
 * opened over it, src/ui/links.ts), which is never drawn until it comes
 * back, so cannot be what broke, and the note still offers it back. With
 * the slot empty and a puzzle being typed in, the game that puzzle was
 * opened over, which is not drawn either, takes the slot (unless it was
 * solved: a solved game is not kept), so the note offers it back, with
 * its tally from the record (`record`, the stats save: while a puzzle is
 * typed in, its game tally is still that game's). Null when there is
 * neither, or the save cannot be read: then all of it goes.
 */
export function boardCleared(saved: string | null, record: string | null = null): string | null {
  try {
    const save = saved ? JSON.parse(saved) : null;
    const state = save?.state;
    const aside = state?.setAside;
    const behind = state?.custom ? state.customBackup : null;
    // while a puzzle is typed in, the save's solve and practice fields are
    // those of the game behind it (a backup saved before it kept them has none)
    const own = (b: Record<string, unknown>) =>
      'solved' in b || !state.solved
        ? b
        : { ...b, solved: true, solvedMs: state.solvedMs ?? null, solvedAssisted: state.solvedAssisted ?? null, solvedAuto: state.solvedAuto ?? null, dailyKept: state.dailyKept };
    const withTarget = (b: Record<string, unknown>) =>
      'practiceTarget' in b ? b : { ...b, practiceTarget: state.practiceTarget ?? null, practiceFound: !!state.practiceFound };
    const tally = (b: Record<string, unknown>) => {
      try {
        const game = record ? JSON.parse(record)?.state?.game : undefined;
        return game && typeof game === 'object' ? { ...b, tally: game } : b;
      } catch {
        return b;
      }
    };
    const kept =
      aside && typeof aside === 'object'
        ? aside
        : behind && typeof behind === 'object' && behind.info && !behind.won
          ? tally(withTarget(own(behind)))
          : null;
    return kept ? JSON.stringify({ state: { setAside: kept }, version: save.version ?? 0 }) : null;
  } catch {
    return null;
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
    const reset = async () => {
      // only the page that holds the play writes the save (src/state/play.ts):
      // a view takes the play first, as Play here does, and then clears; it
      // reads the saves another page wrote meanwhile in place instead of
      // reloading into them, so the board it clears is the one in the save
      if (!play.mayWrite()) {
        setClearing(true);
        await play.here().catch(() => {});
      }
      try {
        if (play.mayWrite()) {
          const left = boardCleared(localStorage.getItem(GAME_KEY), localStorage.getItem('sudokui-stats-v1'));
          localStorage.removeItem(GAME_KEY);
          if (left) localStorage.setItem(GAME_KEY, left);
        }
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
          <button className="ghost" onClick={() => void reset()} title={t('Clears the saved game only; settings and your record stay')}>
            {t('Clear the board and reload')}
          </button>
        </div>
        <p className="crash-detail">
          {rich(t('If it keeps happening, please write to {address} or report it on {link}'), {
            // a letter from the player's own mail app, with the error in it:
            // the app itself may be what is broken
            address: (
              <a
                href={`mailto:${FEEDBACK_ADDRESS}?subject=${encodeURIComponent('[sudokUI] Something went wrong')}&body=${encodeURIComponent(
                  `${String(error.message || error)}\n\nsudokUI ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`
                )}`}
              >
                {FEEDBACK_ADDRESS}
              </a>
            ),
            link: (
              <a href={`https://${ISSUES}`} target="_blank" rel="noopener">
                GitHub
              </a>
            )
          })}
        </p>
      </div>
    );
  }
}
