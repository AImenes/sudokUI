// App shell: top bar (brand, difficulty/score, timer, quick toggles), the
// board + side panel layout, global keyboard handling, dialog routing,
// toast display and the first-visit bootstrap game.
import React, { useEffect, useState } from 'react';
import { useGame, rateImport } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { Grid } from './Grid';
import { Poodle } from './Poodle';
import { Controls } from './Controls';
import { HintPanel } from './HintPanel';
import {
  useNewGame,
  NewGameDialog,
  PracticeDialog,
  ImportDialog,
  ShareDialog,
  GeneratingDialog,
  VictoryDialog,
  SolutionPathDialog,
  ScanDialog
} from './Dialogs';
import { SettingsDialog, InfoDialog } from './SettingsInfo';
import { Modal } from './Dialogs';
import { TECHS } from '../engine/ratings';

function Timer() {
  const elapsedMs = useGame((s) => s.elapsedMs);
  const paused = useGame((s) => s.paused);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const secs = Math.floor(elapsedMs() / 1000);
  const mm = Math.floor(secs / 60);
  const ss = String(secs % 60).padStart(2, '0');
  return (
    <span className={`timer ${paused ? 'paused' : ''}`}>
      {mm}:{ss}
    </span>
  );
}

export default function App() {
  const info = useGame((s) => s.info);
  const won = useGame((s) => s.won);
  const paused = useGame((s) => s.paused);
  const togglePause = useGame((s) => s.togglePause);
  const input = useGame((s) => s.input);
  const erase = useGame((s) => s.erase);
  const wipe = useGame((s) => s.wipe);
  const notice = useGame((s) => s.notice);
  const clearNotice = useGame((s) => s.clearNotice);
  const undo = useGame((s) => s.undo);
  const redo = useGame((s) => s.redo);
  const setMode = useGame((s) => s.setMode);
  const setTempMode = useGame((s) => s.setTempMode);
  const mode = useGame((s) => s.mode);
  const errors = useGame((s) => s.errors);
  const revertIndex = useGame((s) => s.revertIndex);
  const revertToValid = useGame((s) => s.revertToValid);
  const dismissRevert = useGame((s) => s.dismissRevert);
  const requestHint = useGame((s) => s.requestHint);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const custom = useGame((s) => s.custom);
  const convertMarks = useGame((s) => s.convertMarks);
  const startCustomEntry = useGame((s) => s.startCustomEntry);
  const cancelCustomEntry = useGame((s) => s.cancelCustomEntry);
  const finishCustomEntry = useGame((s) => s.finishCustomEntry);
  const givenCount = useGame((s) =>
    s.custom ? s.cells.filter((c) => c.value > 0).length : 0
  );
  const { theme, toggleTheme, showTimer, hideRating, showPoodle } = useSettings();
  const { start, genState, cancel } = useNewGame();

  const [dialog, setDialog] = useState<
    'none' | 'new' | 'practice' | 'io' | 'share' | 'settings' | 'info' | 'restart' | 'steps' | 'scan'
  >('none');
  const restart = useGame((s) => s.restart);
  const [victoryDismissed, setVictoryDismissed] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // boot: a shared link wins over everything — #s= carries a full position
  // (entries, marks, colours), #p= just the puzzle; otherwise a saved game
  // resumes, otherwise start an easy one. StrictMode-guarded.
  useEffect(() => {
    if ((window as any).__sudokuiBooted) return;
    (window as any).__sudokuiBooted = true;
    const sharedPosition = new URLSearchParams(window.location.hash.slice(1)).get('s');
    if (sharedPosition && useGame.getState().loadPosition(sharedPosition)) return;
    const shared = new URLSearchParams(window.location.hash.slice(1)).get('p');
    if (shared && shared !== useGame.getState().info?.puzzle) {
      const cleaned = shared.replace(/[^0-9.]/g, '');
      const rating = cleaned.length === 81 ? rateImport(cleaned) : null;
      if (rating) {
        useGame.getState().startGame(cleaned, rating.score, rating.level);
        return;
      }
    }
    if (!useGame.getState().info) start({ kind: 'level', level: 'Easy' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setVictoryDismissed(false), [info?.puzzle]);

  // keep the address bar shareable: it always points at the current puzzle
  useEffect(() => {
    if (info?.puzzle) {
      window.history.replaceState(null, '', `#p=${info.puzzle}`);
    }
  }, [info?.puzzle]);

  // toasts fade after a few seconds
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(clearNotice, 3500);
    return () => clearTimeout(id);
  }, [notice, clearNotice]);

  // hold-modifier temporary modes: Shift = corner, Ctrl/Alt = centre,
  // Shift together with Ctrl/Alt = colour; release returns to the base mode
  useEffect(() => {
    const applyModifiers = (e: KeyboardEvent) => {
      if (e.metaKey) return void setTempMode(null); // leave Cmd shortcuts alone
      const other = e.ctrlKey || e.altKey;
      setTempMode(
        e.shiftKey && other ? 'color' : e.shiftKey ? 'corner' : other ? 'center' : null
      );
    };
    const onUp = (e: KeyboardEvent) => applyModifiers(e);
    const onBlur = () => setTempMode(null);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [setTempMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!e.metaKey) {
        const other = e.ctrlKey || e.altKey;
        setTempMode(
          e.shiftKey && other ? 'color' : e.shiftKey ? 'corner' : other ? 'center' : null
        );
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.code === 'KeyZ' && !e.shiftKey) return void (e.preventDefault(), undo());
      if (mod && (e.code === 'KeyY' || (e.code === 'KeyZ' && e.shiftKey)))
        return void (e.preventDefault(), redo());
      if (mod && e.code === 'KeyA')
        return void (e.preventDefault(), select(Array.from({ length: 81 }, (_, i) => i), false));
      if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
        const d = Number(e.code.replace('Digit', '').replace('Numpad', ''));
        if (d >= 1 && d <= 9) {
          e.preventDefault();
          input(d); // held modifiers already routed via the temporary mode
          return;
        }
      }
      switch (e.code) {
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          // held modifiers route through the temporary mode, so
          // Shift+Backspace erases corner marks, Ctrl+Backspace centre
          // marks, both together colours — full wipe lives on W
          erase();
          break;
        case 'KeyW':
          wipe();
          break;
        case 'KeyD':
          // deselect — the Escape alternative for fullscreen browsers,
          // where Escape exits fullscreen instead
          select([], false);
          break;
        case 'KeyN': {
          const tech = useGame.getState().info?.practiceTech;
          if (tech) start({ kind: 'tech', tech });
          break;
        }
        case 'Space': {
          e.preventDefault();
          const order = ['digit', 'corner', 'center', 'color'] as const;
          setMode(order[(order.indexOf(useGame.getState().mode) + 1) % order.length]);
          break;
        }
        case 'KeyZ':
          setMode('digit');
          break;
        case 'KeyX':
          setMode('corner');
          break;
        case 'KeyC':
          setMode('center');
          break;
        case 'KeyV':
          setMode('color');
          break;
        case 'KeyH':
          requestHint();
          break;
        case 'KeyS':
          convertMarks(); // swap corner ↔ centre marks (selection or board)
          break;
        case 'KeyP':
          togglePause();
          break;
        case 'Escape':
          select([], false);
          break;
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight': {
          e.preventDefault();
          const cur = selection.length ? selection[selection.length - 1] : 40;
          let r = Math.floor(cur / 9);
          let c = cur % 9;
          if (e.code === 'ArrowUp') r = (r + 8) % 9;
          if (e.code === 'ArrowDown') r = (r + 1) % 9;
          if (e.code === 'ArrowLeft') c = (c + 8) % 9;
          if (e.code === 'ArrowRight') c = (c + 1) % 9;
          select([r * 9 + c], e.shiftKey || e.metaKey || e.ctrlKey);
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [input, erase, wipe, undo, redo, setMode, requestHint, select, selection, togglePause, convertMarks, start]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">UI</span>
          <h1>
            sudok<span className="brand-ui">UI</span>
          </h1>
        </div>
        {info && (
          <div className="game-meta">
            {hideRating && !won ? (
              <button
                className="score-btn"
                onClick={() => setDialog('info')}
                title="Difficulty hidden until you solve the puzzle (change in Settings)"
              >
                <strong>???</strong>
              </button>
            ) : (
              <>
                <span className={`level-badge level-${info.level.toLowerCase()}`}>{info.level}</span>
                <button
                  className="score-btn"
                  onClick={() => setDialog('info')}
                  title="Difficulty rating — the summed technique cost of solving this puzzle. Click to learn more."
                >
                  <span className="rating-word">Rating&nbsp;</span><strong>{info.score}</strong> <span className="mini-i">ⓘ</span>
                </button>
              </>
            )}
            {info.practiceTech && (
              <span className="practice-badge">Practice: {TECHS[info.practiceTech].name}</span>
            )}
          </div>
        )}
        <div className="topbar-right">
          {showTimer && <Timer />}
          <button
            className="icon-btn"
            onClick={togglePause}
            title="Pause (P)"
            aria-label={paused ? 'Resume game' : 'Pause game'}
          >
            {paused ? '⏵' : '⏸'}
          </button>
          <button
            className="icon-btn"
            onClick={toggleTheme}
            title="Cycle theme: dark → daylight → rosé"
            aria-label={
              theme === 'dark'
                ? 'Switch to daylight theme'
                : theme === 'light'
                  ? 'Switch to rosé theme'
                  : 'Switch to dark theme'
            }
          >
            {theme === 'dark' ? '☀️' : theme === 'light' ? '🌸' : '🌙'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setDialog('info')}
            title="How to play, modes & shortcuts"
            aria-label="How to play, modes and shortcuts"
          >
            ⓘ
          </button>
          <button
            className="icon-btn gear"
            onClick={() => setDialog('settings')}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </header>

      <main
        className="layout"
        onPointerDown={(e) => {
          // touch has no Escape key: tapping the empty space around the
          // board clears the selection
          const t = e.target as HTMLElement;
          if (t.classList.contains('layout') || t.classList.contains('board-col')) {
            select([], false);
          }
        }}
      >
        <div className="board-col">
          <Grid />
          {/* while paused, Nutella moves onto the pause card instead */}
          {showPoodle && (!paused || won) && <Poodle />}
        </div>
        <aside className="side">
          <div className="menu-row">
            <button onClick={() => setDialog('new')}>
              <span className="menu-icon">▦</span>New
            </button>
            <button
              className={info?.practiceTech ? 'active' : ''}
              onClick={() => setDialog('practice')}
            >
              <span className="menu-icon">🎯</span>Practice
            </button>
            <button onClick={() => setDialog('io')}>
              <span className="menu-icon">⇅</span>Import
            </button>
            <button onClick={() => setDialog('share')}>
              <span className="menu-icon">🔗</span>Share
            </button>
            <button onClick={() => setDialog('restart')} title="Reset this puzzle and the timer">
              <span className="menu-icon">↺</span>Restart
            </button>
          </div>
          <Controls
            onShowSteps={info && !custom ? () => setDialog('steps') : undefined}
            onScan={info && !custom ? () => setDialog('scan') : undefined}
          />
          {info?.practiceTech && !custom && (
            <div className="practice-bar">
              <span>
                Practicing <strong>{TECHS[info.practiceTech].name}</strong>
              </span>
              <button onClick={() => start({ kind: 'tech', tech: info.practiceTech! })}>
                Next puzzle (N)
              </button>
            </div>
          )}
          <HintPanel />
          {custom && (
            <div className="hint-panel">
              <div className="hint-head">
                <strong>Custom puzzle</strong>
              </div>
              <div className="hint-body">
                <p>
                  Type the givens onto the board ({givenCount} so far). When
                  you are done, sudokUI verifies the puzzle has exactly one
                  solution and rates it before play begins.
                </p>
                {customError && <p className="dialog-error">{customError}</p>}
                <div className="hint-actions">
                  <button
                    onClick={() => setCustomError(finishCustomEntry())}
                  >
                    ✓ Check &amp; play
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      setCustomError(null);
                      cancelCustomEntry();
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {revertIndex !== null && errors.length > 0 && (
            <div className="hint-panel">
              <div className="hint-head">
                <strong>Mistakes found</strong>
              </div>
              <div className="hint-body">
                <p>
                  Jump back to the last position where everything was correct?
                  Your later entries are removed — Ctrl+Z brings them back.
                </p>
                <div className="hint-actions">
                  <button onClick={revertToValid}>↩ Back to correct</button>
                  <button className="ghost" onClick={dismissRevert}>
                    Keep looking
                  </button>
                </div>
              </div>
            </div>
          )}
          <footer className="app-footer">
            <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">
              Open source on GitHub
            </a>
            <span> · feature requests & issues welcome</span>
            <span className="dedication">for thth ♥</span>
          </footer>
        </aside>
      </main>

      {dialog === 'new' && (
        <NewGameDialog
          onClose={() => setDialog('none')}
          onStart={(level) => {
            setDialog('none');
            start({ kind: 'level', level });
          }}
          onCustom={() => {
            setDialog('none');
            setCustomError(null);
            startCustomEntry();
          }}
        />
      )}
      {dialog === 'practice' && (
        <PracticeDialog
          onClose={() => setDialog('none')}
          onStart={(tech) => {
            setDialog('none');
            start({ kind: 'tech', tech });
          }}
        />
      )}
      {dialog === 'io' && <ImportDialog onClose={() => setDialog('none')} />}
      {dialog === 'share' && <ShareDialog onClose={() => setDialog('none')} />}
      {dialog === 'steps' && <SolutionPathDialog onClose={() => setDialog('none')} />}
      {dialog === 'scan' && <ScanDialog onClose={() => setDialog('none')} />}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog('none')} />}
      {dialog === 'info' && <InfoDialog onClose={() => setDialog('none')} />}
      {dialog === 'restart' && (
        <Modal title="Restart puzzle?" onClose={() => setDialog('none')}>
          <p className="dialog-note">
            The board and timer reset to the beginning
            {info?.practiceTech ? ' of the practice position' : ''}. Your
            progress on this puzzle is lost.
          </p>
          <div className="hint-actions">
            <button
              onClick={() => {
                setDialog('none');
                restart();
              }}
            >
              Restart
            </button>
            <button className="ghost" onClick={() => setDialog('none')}>
              Keep playing
            </button>
          </div>
        </Modal>
      )}
      {genState && (
        <GeneratingDialog label={genState.label} attempts={genState.attempts} onCancel={cancel} />
      )}
      {won && !victoryDismissed && (
        <VictoryDialog
          onNewGame={() => {
            setVictoryDismissed(true);
            setDialog('new');
          }}
          onAnother={
            info?.practiceTech
              ? () => {
                  setVictoryDismissed(true);
                  start({ kind: 'tech', tech: info.practiceTech! });
                }
              : undefined
          }
          onClose={() => setVictoryDismissed(true)}
        />
      )}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
