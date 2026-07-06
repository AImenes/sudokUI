// App shell: top bar (brand, difficulty/score, timer, quick toggles), the
// board + side panel layout, global keyboard handling, dialog routing,
// toast display and the first-visit bootstrap game.
import React, { useEffect, useState } from 'react';
import { useGame } from '../state/gameStore';
import { useSettings } from '../state/settings';
import { Grid } from './Grid';
import { Controls } from './Controls';
import { HintPanel } from './HintPanel';
import {
  useNewGame,
  NewGameDialog,
  PracticeDialog,
  ImportExportDialog,
  GeneratingDialog,
  VictoryDialog
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
  const requestHint = useGame((s) => s.requestHint);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const { theme, toggleTheme, showTimer } = useSettings();
  const { start, genState, cancel } = useNewGame();

  const [dialog, setDialog] = useState<
    'none' | 'new' | 'practice' | 'io' | 'settings' | 'info' | 'restart'
  >('none');
  const restart = useGame((s) => s.restart);
  const [victoryDismissed, setVictoryDismissed] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // first visit: start an easy game (guarded against StrictMode double-fire)
  useEffect(() => {
    if (!useGame.getState().info && !(window as any).__sudokuiBooted) {
      (window as any).__sudokuiBooted = true;
      start({ kind: 'level', level: 'Easy' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setVictoryDismissed(false), [info?.puzzle]);

  // toasts fade after a few seconds
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(clearNotice, 3500);
    return () => clearTimeout(id);
  }, [notice, clearNotice]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
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
          const s = useGame.getState();
          if (e.shiftKey) {
            const m = s.mode;
            s.setMode('corner');
            s.input(d);
            s.setMode(m);
          } else if (e.altKey) {
            const m = s.mode;
            s.setMode('center');
            s.input(d);
            s.setMode(m);
          } else {
            input(d);
          }
          return;
        }
      }
      switch (e.code) {
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          if (e.shiftKey) wipe();
          else erase();
          break;
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
  }, [input, erase, wipe, undo, redo, setMode, requestHint, select, selection, togglePause]);

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
            <span className={`level-badge level-${info.level.toLowerCase()}`}>{info.level}</span>
            <button
              className="score-btn"
              onClick={() => setDialog('info')}
              title="Difficulty rating — the summed technique cost of solving this puzzle. Click to learn more."
            >
              Rating <strong>{info.score}</strong> <span className="mini-i">ⓘ</span>
            </button>
            {info.practiceTech && (
              <span className="practice-badge">Practice: {TECHS[info.practiceTech].name}</span>
            )}
          </div>
        )}
        <div className="topbar-right">
          {showTimer && <Timer />}
          <button className="icon-btn" onClick={togglePause} title="Pause (P)">
            {paused ? '⏵' : '⏸'}
          </button>
          <button className="icon-btn" onClick={toggleTheme} title="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="icon-btn" onClick={() => setDialog('info')} title="How to play, modes & shortcuts">
            ⓘ
          </button>
          <button className="icon-btn gear" onClick={() => setDialog('settings')} title="Settings">
            ⚙
          </button>
        </div>
      </header>

      <main className="layout">
        <Grid />
        <aside className="side">
          <div className="menu-row">
            <button onClick={() => setDialog('new')}>
              <span className="menu-icon">▦</span>New
            </button>
            <button onClick={() => setDialog('practice')}>
              <span className="menu-icon">🎯</span>Practice
            </button>
            <button onClick={() => setDialog('io')}>
              <span className="menu-icon">⇅</span>Import
            </button>
            <button onClick={() => setDialog('restart')} title="Reset this puzzle and the timer">
              <span className="menu-icon">↺</span>Restart
            </button>
          </div>
          <Controls />
          <HintPanel />
        </aside>
      </main>

      {dialog === 'new' && (
        <NewGameDialog
          onClose={() => setDialog('none')}
          onStart={(level) => {
            setDialog('none');
            start({ kind: 'level', level });
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
      {dialog === 'io' && <ImportExportDialog onClose={() => setDialog('none')} />}
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
          onClose={() => setVictoryDismissed(true)}
        />
      )}
      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}
