// App shell: top bar (brand, difficulty/score, timer, quick toggles), the
// board + side panel layout, global keyboard handling, dialog routing,
// toast display and the first-visit bootstrap game.
import React, { Suspense, useEffect, useState } from 'react';
import { useGame, rateImport, validatePuzzle, Proof } from '../state/gameStore';
import { cellName, PEERS } from '../engine/board';
import { dailyPuzzle } from '../engine/daily';
import { useSettings } from '../state/settings';
import { useAppStatus } from '../state/appStatus';
import { useT, translator, rich, langRoot } from '../content/i18n';
import type { Translator } from '../content/i18n';
import { Grid } from './Grid';
import { Poodle } from './Poodle';
import { Controls } from './Controls';
import { HintPanel, ChainPanel } from './HintPanel';
import {
  useNewGame,
  warmSeededPools,
  NewGameDialog,
  PracticeDialog,
  ImportDialog,
  ShareDialog,
  GeneratingDialog,
  VictoryDialog,
  SolutionPathDialog,
  ScanDialog,
  ContractDialog
} from './Dialogs';
import { SettingsDialog, InfoDialog } from './SettingsInfo';
import { ProgressDialog } from './Progress';
import { Modal } from './Dialogs';
import type { LearnTarget } from './Learn';

// the guide is a third of the app's code and prose: fetched the first time
// it opens (and precached for offline), never as part of loading the game
const LearnDialog = React.lazy(() => import('./Learn').then((m) => ({ default: m.LearnDialog })));
import { PRACTICE_TECHS, Tech } from '../engine/ratings';
import { techFromParam } from '../content/slugs';
import { parseShareUrl, sharePath, clockOf } from '../content/share';
import { RATING_URL } from '../content/staticRoutes';

/** the name, the same in every language: "sudok" and a coloured "UI" */
const BRAND = ['sudok', 'UI'] as const;
/** a no-break space: the &nbsp; after the rating's word in the top bar */
const NBSP = String.fromCharCode(160);

/** #learn=<technique key or slug> | intuition | glossary | rating | term:<glossary term> */
function parseLearnParam(param: string): LearnTarget {
  if (param === 'glossary') return { tab: 'glossary' };
  if (param === 'intuition') return { tab: 'intuition' };
  if (param === 'rating') return { tab: 'rating' };
  if (param.startsWith('term:')) return { tab: 'glossary', term: param.slice(5) };
  return { tab: 'techniques', tech: techFromParam(param) };
}

/** why a wrong digit is wrong, in a line (docs/technique-stats.md) */
function proofText(p: Proof, t: Translator): string {
  const cell = cellName(p.cell);
  const { wrong, right } = p;
  if (p.conflict !== null) return t('{cell} cannot be {wrong}: {other} already holds it.', { cell, wrong, other: cellName(p.conflict) });
  if (!p.tech) return t('{cell} should be {right}, not {wrong}. The proof is beyond a quick search.', { cell, right, wrong });
  // the easier steps played before the proof itself
  const n = p.steps.length - 1;
  const last = p.steps[p.steps.length - 1];
  // the drawn line shows the way to the contradiction, but the board may
  // need singles off it as well, so no count of moves is claimed
  if (p.trail) return t('{cell} cannot be {wrong}: place it and the singles it forces break the board.', { cell, wrong });
  const vars = { cell, right, wrong, tech: t.tech(p.tech), n };
  if (p.places)
    return t(
      n < 1
        ? '{cell} is {right}, not {wrong}: a {tech} places it.'
        : n === 1
          ? '{cell} is {right}, not {wrong}: a {tech} places it after {n} easier step.'
          : '{cell} is {right}, not {wrong}: a {tech} places it after {n} easier steps.',
      vars
    );
  // the digit may go by a placement in a peer rather than by a removal
  const peer = last.placements.find((q) => q.digit === p.wrong && PEERS[p.cell].includes(q.cell));
  return peer
    ? t(
        n < 1
          ? '{cell} cannot be {wrong}: a {tech} puts the {wrong} in {peer}.'
          : n === 1
            ? '{cell} cannot be {wrong}: a {tech} puts the {wrong} in {peer} after {n} easier step.'
            : '{cell} cannot be {wrong}: a {tech} puts the {wrong} in {peer} after {n} easier steps.',
        { ...vars, peer: cellName(peer.cell) }
      )
    : t(
        n < 1
          ? '{cell} cannot be {wrong}: a {tech} removes it.'
          : n === 1
            ? '{cell} cannot be {wrong}: a {tech} removes it after {n} easier step.'
            : '{cell} cannot be {wrong}: a {tech} removes it after {n} easier steps.',
        vars
      );
}

/** a new version waiting, or a file this version can no longer load: the
 *  player decides when to reload; the game is saved either way */
function UpdateBar() {
  const updateReady = useAppStatus((s) => s.updateReady);
  const reason = useAppStatus((s) => s.reason);
  const offlineReady = useAppStatus((s) => s.offlineReady);
  const reload = useAppStatus((s) => s.reload);
  const dismiss = useAppStatus((s) => s.dismiss);
  const t = useT();
  // the offline note is good news, not a decision: it goes by itself
  useEffect(() => {
    if (!offlineReady || updateReady) return;
    const id = setTimeout(dismiss, 6000);
    return () => clearTimeout(id);
  }, [offlineReady, updateReady, dismiss]);
  if (updateReady) {
    return (
      <div className="update-bar" role="status">
        <span>
          {t(
            reason === 'chunk'
              ? 'sudokUI was updated while this tab was open, and a part of it could not load. Reload to continue; your game is saved.'
              : 'A new version of sudokUI is ready. Reload when it suits you; your game is saved.'
          )}
        </span>
        <button onClick={reload}>{t('Reload')}</button>
        <button className="ghost" onClick={dismiss}>
          {t('Later')}
        </button>
      </div>
    );
  }
  if (offlineReady) {
    return (
      <div className="update-bar" role="status">
        <span>{t('sudokUI is ready to play offline.')}</span>
        <button className="ghost" onClick={dismiss}>
          OK
        </button>
      </div>
    );
  }
  return null;
}

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
  const proofs = useGame((s) => s.proofs);
  const showProof = useGame((s) => s.showProof);
  const practiceFound = useGame((s) => s.practiceFound);
  const chain = useGame((s) => s.chain);
  const scanPreview = useGame((s) => s.scanPreview);
  const scanDoubts = useGame((s) => s.scanDoubts);
  const practiceTarget = useGame((s) => s.practiceTarget);
  const startChain = useGame((s) => s.startChain);
  const requestHint = useGame((s) => s.requestHint);
  const selection = useGame((s) => s.selection);
  const select = useGame((s) => s.select);
  const custom = useGame((s) => s.custom);
  const contractPrompt = useGame((s) => s.contractPrompt);
  const answerContract = useGame((s) => s.answerContract);
  const dismissContractPrompt = useGame((s) => s.dismissContractPrompt);
  const convertMarks = useGame((s) => s.convertMarks);
  const startCustomEntry = useGame((s) => s.startCustomEntry);
  const cancelCustomEntry = useGame((s) => s.cancelCustomEntry);
  const finishCustomEntry = useGame((s) => s.finishCustomEntry);
  const givenCount = useGame((s) =>
    s.custom ? s.cells.filter((c) => c.value > 0).length : 0
  );
  const { theme, font, toggleTheme, showTimer, hideRating, showPoodle, lang } = useSettings();
  const t = useT();
  const { start, genState, cancel } = useNewGame();
  // the hardest bands start from seeds: stock their pools while idle, so
  // even the first Nightmare on this device starts at once
  useEffect(() => {
    const t = setTimeout(() => warmSeededPools(), 4000);
    return () => clearTimeout(t);
  }, []);

  const [dialog, setDialog] = useState<
    'none' | 'new' | 'practice' | 'io' | 'share' | 'settings' | 'info' | 'restart' | 'steps' | 'scan' | 'learn' | 'progress'
  >('none');
  const [learnTarget, setLearnTarget] = useState<LearnTarget>({ tab: 'techniques' });
  // a technique the guide asked Scan to look for on the board
  const [scanFor, setScanFor] = useState<Tech | null>(null);
  const openLearn = (target: LearnTarget = { tab: 'techniques' }) => {
    setLearnTarget(target);
    setDialog('learn');
  };
  // footer links are real URLs (crawlable, and they open the static page in
  // a new tab on a modified click); a plain click opens the in-app dialog
  const learnLink = (target: LearnTarget) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    openLearn(target);
  };
  const restart = useGame((s) => s.restart);
  const [victoryDismissed, setVictoryDismissed] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  // first visit only, and never over a shared or deep link: those visitors
  // arrived with a purpose
  const [welcome, setWelcome] = useState(
    () =>
      !localStorage.getItem('sudokui-welcomed') &&
      !window.location.hash.match(/(^#|&)(p=|s=|learn=|practice=|daily)/) &&
      !parseShareUrl(window.location)
  );
  const dismissWelcome = () => {
    localStorage.setItem('sudokui-welcomed', '1');
    setWelcome(false);
  };
  const startDaily = () => {
    const d = dailyPuzzle();
    useGame.getState().startGame(d.puzzle, d.score, d.level, null, d.dateKey);
    // translator(), not the render's t: the boot effect calls this from its
    // first render's closure
    const t = translator();
    useGame.setState({ notice: t('Daily puzzle for {date}. Everyone gets this same board today', { date: d.dateKey }) });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);

  // boot: a shared link wins over everything — #s= carries a full position
  // (entries, marks, colours), /p/<puzzle> and #p= just the puzzle, and a
  // share path may carry a challenger's time (src/content/share.ts);
  // otherwise a saved game resumes, otherwise start an easy one. The
  // /learn/ pages deep-link in with #practice=<technique> (start practising
  // it) and #learn=<topic> (open the guide there). StrictMode-guarded.
  useEffect(() => {
    if ((window as any).__sudokuiBooted) return;
    (window as any).__sudokuiBooted = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const learn = params.get('learn');
    if (learn) openLearn(parseLearnParam(learn));
    const practice = techFromParam(params.get('practice') ?? '');
    if (practice && PRACTICE_TECHS.includes(practice)) {
      start({ kind: 'tech', tech: practice });
      return;
    }
    if (params.has('daily')) {
      startDaily();
      return;
    }
    const sharedPosition = params.get('s');
    if (sharedPosition && useGame.getState().loadPosition(sharedPosition)) return;
    const share = parseShareUrl(window.location);
    // a puzzle string may write its empty cells as zeros; the app writes dots
    const shared = (share?.puzzle ?? params.get('p') ?? '').replace(/[^0-9.]/g, '').replace(/0/g, '.');
    const game = useGame.getState();
    /** the challenger's time becomes the one to beat, and the player is told */
    const challenge = (vs: number) => {
      const t = translator();
      useGame.setState((s) => ({
        info: s.info && { ...s.info, challenge: vs },
        notice: t('A challenge: solve it faster than {time}', { time: clockOf(vs) })
      }));
    };
    if (shared && shared === game.info?.puzzle) {
      // the puzzle already on the board (a reload lands here), perhaps with
      // a challenger's time for it: a finished game, or one not yet begun
      // (its clock may have run), starts over against that time; one under
      // way keeps its moves and takes the time on
      if (share?.vs) {
        const untouched = game.cells.every((c) => c.given || (!c.value && !c.corner && !c.center && !c.colors.length));
        if (game.won || untouched) game.restart();
        challenge(share.vs);
      }
      return;
    }
    if (shared) {
      const v = shared.length === 81 ? validatePuzzle(shared) : null;
      if (v && v.ok) {
        game.startGame(shared, v.score, v.level);
        if (share?.vs) challenge(share.vs);
        return;
      }
      // a share page promised a puzzle the app cannot play (no solution,
      // several, too few clues): say so, then go on as with no link
      if (share) {
        const t = translator();
        useGame.setState({ notice: t('The shared puzzle could not be opened. {reason}', { reason: v ? v.reason : '' }).trim() });
      }
    }
    if (!useGame.getState().info) start({ kind: 'level', level: 'Easy' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setVictoryDismissed(false), [info?.puzzle]);

  // a shared link opened in this tab: load it, unless a game is under way
  useEffect(() => {
    const onHash = () => {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const shared = (params.get('p') ?? '').replace(/[^0-9.]/g, '').replace(/0/g, '.');
      const g = useGame.getState();
      if (shared.length !== 81 || shared === g.info?.puzzle) return;
      if (g.history.length > 0 && !g.won) {
        const t = translator();
        useGame.setState({ notice: t('A puzzle link was opened. Finish or restart this game first, or open the link in a new tab') });
        return;
      }
      const rating = rateImport(shared);
      if (rating) g.startGame(shared, rating.score, rating.level);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // keep the address bar shareable: it always points at the current
  // puzzle, at the address that previews when pasted into a chat, in the
  // app's language (the Worker and the service worker both answer it with
  // the app, src/content/home.ts). The band and the score stay out of it
  // while the rating is hidden and the game is on (the share dialog still
  // puts them in a link made for someone else), and so does a challenger's
  // time: the player's own copy of the link should not carry it. The
  // tab's title, which a share page sets to its puzzle, goes back to the
  // app's own, so it never names a puzzle that has left the board.
  useEffect(() => {
    if (!info?.puzzle) return;
    const rated = !(hideRating && !won);
    try {
      window.history.replaceState(
        null,
        '',
        sharePath({ lang, puzzle: info.puzzle, level: rated ? info.level : undefined, score: rated ? info.score : undefined })
      );
    } catch {
      // an origin that allows no path of its own (a file:// build): the
      // hash link still names the puzzle, and the app still reads it
      window.history.replaceState(null, '', `#p=${info.puzzle}`);
    }
    import('../content/home')
      .then((m) => {
        document.title = m.HOME[lang].title;
      })
      .catch(() => {});
  }, [info?.puzzle, info?.level, info?.score, lang, hideRating, won]);

  // toasts fade after a few seconds
  useEffect(() => {
    if (!notice) return;
    // long notices stay long enough to be read
    const id = setTimeout(clearNotice, Math.max(3500, notice.length * 70));
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
      // a dialog is open: its keys must not act on the board behind it
      // (N stays live, for "next puzzle" from the victory dialog)
      if (document.querySelector('.modal-backdrop') && e.code !== 'KeyN') return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (!e.metaKey) {
        const other = e.ctrlKey || e.altKey;
        setTempMode(
          e.shiftKey && other ? 'color' : e.shiftKey ? 'corner' : other ? 'center' : null
        );
      }
      const mod = e.metaKey || e.ctrlKey;
      // walking a hint: the arrow keys step through its frames, Escape
      // returns to the whole drawing
      const walking = useGame.getState().hintStage === 'walk';
      if (walking && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault();
        useGame.getState().walkHint(e.code === 'ArrowRight' ? 1 : -1);
        return;
      }
      if (walking && e.code === 'Escape') {
        useGame.getState().revealHint();
        return;
      }
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
          if (useGame.getState().chain) {
            e.preventDefault();
            useGame.getState().chainUndo();
            break;
          }
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
        case 'KeyH': {
          // H walks the hint: ask, then reveal, then apply; the first
          // assist of a clean game asks the same question the button does
          const g = useGame.getState();
          if (g.hintStage === 'tech') g.revealHint();
          else if (g.hintStage === 'full' || g.hintStage === 'walk') g.applyHint();
          else if (g.assisted || !useSettings.getState().confirmAssist) requestHint();
          else g.askAssist('Hint');
          break;
        }
        case 'KeyS':
          convertMarks(); // swap corner ↔ centre marks (selection or board)
          break;
        case 'KeyP':
          togglePause();
          break;
        case 'KeyL':
          openLearn();
          break;
        case 'Escape':
          if (useGame.getState().chain) useGame.getState().endChain();
          else select([], false);
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
          <span className="brand-mark">{BRAND[1]}</span>
          <h1>
            {BRAND[0]}<span className="brand-ui">{BRAND[1]}</span>
          </h1>
        </div>
        {info && (
          <div className="game-meta">
            {hideRating && !won ? (
              <button
                className="score-btn hidden-rating"
                onClick={() => setDialog('settings')}
                title={t('Difficulty is hidden until you solve the puzzle. Change this in Settings')}
              >
                <span className="level-badge level-hidden">🎲 {t('hidden||the difficulty, until the puzzle is solved')}</span>
              </button>
            ) : (
              <>
                <span className={`level-badge level-${info.level.toLowerCase()}`}>{t.level(info.level)}</span>
                <button
                  className="score-btn"
                  onClick={() => openLearn({ tab: 'rating' })}
                  title={t('How this rating is calculated')}
                  aria-label={t('Rating {score}. How the rating is calculated', { score: info.score })}
                >
                  <span className="rating-word">{t("Rating||the puzzle's score, before the number")}{NBSP}</span><strong>{info.score}</strong> <span className="mini-i">ⓘ</span>
                </button>
              </>
            )}
            {info.practiceTech && (
              <span className="practice-badge">{t('Practice: {tech}', { tech: t.tech(info.practiceTech) })}</span>
            )}
          </div>
        )}
        <div className="topbar-right">
          {showTimer && <Timer />}
          <button
            className="icon-btn"
            onClick={togglePause}
            title={t('Pause (P)')}
            aria-label={t(paused ? 'Resume game' : 'Pause game')}
          >
            {paused ? '⏵' : '⏸'}
          </button>
          <button
            className="icon-btn theme-btn"
            onClick={toggleTheme}
            title={t('Cycle theme: dark → daylight → rosé → forest')}
            aria-label={t(
              theme === 'dark'
                ? 'Switch to daylight theme'
                : theme === 'light'
                  ? 'Switch to rosé theme'
                  : theme === 'rose'
                    ? 'Switch to forest theme'
                    : 'Switch to dark theme'
            )}
          >
            {theme === 'dark' ? '☀️' : theme === 'light' ? '🌸' : theme === 'rose' ? '🌲' : '🌙'}
          </button>
          <button
            className="icon-btn"
            onClick={() => setDialog('info')}
            title={t('How to play, modes & shortcuts')}
            aria-label={t('How to play, modes and shortcuts')}
          >
            ⓘ
          </button>
          <button
            className="icon-btn gear"
            onClick={() => setDialog('settings')}
            title={t('Settings')}
            aria-label={t('Settings')}
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
        <aside className={`side${paused && !won ? ' paused' : ''}`}>
          <div className="menu-row">
            <button onClick={() => setDialog('new')}>
              <span className="menu-icon">▦</span>{t('New')}
            </button>
            <button
              className={info?.practiceTech ? 'active' : ''}
              onClick={() => setDialog('progress')}
              title={t('Your path, practice and the theory of every technique')}
            >
              <span className="menu-icon">🎓</span>{t('Learn')}
            </button>
            <button onClick={() => setDialog('io')}>
              <span className="menu-icon">⇅</span>{t('Import')}
            </button>
            <button onClick={() => setDialog('share')}>
              <span className="menu-icon">🔗</span>{t('Share')}
            </button>
            <button onClick={() => setDialog('restart')} title={t('Reset this puzzle and the timer')}>
              <span className="menu-icon">↺</span>{t('Restart')}
            </button>
          </div>
          <Controls
            onShowSteps={info && !custom ? () => setDialog('steps') : undefined}
            onScan={info && !custom ? () => setDialog('scan') : undefined}
          />
          {info?.practiceTech && !custom && (
            <div className="practice-bar">
              <span>
                {rich(t('Practicing {tech}'), { tech: <strong>{t.tech(info.practiceTech)}</strong> })}
                {practiceFound && <span className="practice-found"> · {t('found||the technique being practised')} 🎯</span>}
              </span>
              {!practiceFound &&
                !chain &&
                practiceTarget?.links?.length &&
                practiceTarget.links.every((l) => l.from.length === 1 && l.to.length === 1) && (
                  <button
                    className="ghost"
                    onClick={() => startChain(practiceTarget.eliminations)}
                    title={t("Open the chain trainer with this technique's removal as the goal")}
                  >
                    {t('Build it yourself')}
                  </button>
                )}
              <button onClick={() => start({ kind: 'tech', tech: info.practiceTech! })}>
                {t('Next puzzle (N)')}
              </button>
            </div>
          )}
          {chain ? <ChainPanel /> : <HintPanel onLearn={(tech) => openLearn({ tab: 'techniques', tech })} />}
          {custom && (
            <div className="hint-panel">
              <div className="hint-head">
                <strong>{t('Custom puzzle')}</strong>
              </div>
              <div className="hint-body">
                {scanPreview && (
                  <div className="scan-check">
                    <img src={scanPreview} alt={t('The scanned grid, as the scanner saw it')} />
                    <p>
                      {t(
                        scanDoubts.length > 0
                          ? "The photo, straightened. Compare it with the board; the red cells are the scanner's doubts: a digit it was unsure of, or ink it could not read."
                          : 'The photo, straightened. Compare it with the board.'
                      )}
                    </p>
                  </div>
                )}
                <p>
                  {t(
                    'Type the givens onto the board ({n} so far). When you are done, sudokUI verifies the puzzle has exactly one solution and rates it before play begins.',
                    { n: givenCount }
                  )}
                </p>
                {customError && <p className="dialog-error">{customError}</p>}
                <div className="hint-actions">
                  <button
                    onClick={() => setCustomError(finishCustomEntry())}
                  >
                    ✓ {t('Check & play')}
                  </button>
                  <button
                    className="ghost"
                    onClick={() => {
                      setCustomError(null);
                      cancelCustomEntry();
                    }}
                  >
                    {t('Cancel')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {errors.length > 0 && (revertIndex !== null || proofs.length > 0) && (
            <div className="hint-panel" role="region" aria-label={t('Mistakes found')}>
              <div className="hint-head">
                <strong>{t('Mistakes found')}</strong>
              </div>
              <div className="hint-body">
                {proofs.length > 0 && (
                  <ul className="proof-list">
                    {proofs.map((p, k) => (
                      <li key={p.cell}>
                        <span>{proofText(p, t)}</span>
                        {(p.conflict !== null || p.steps.length > 0) && (
                          <button className="ghost" onClick={() => showProof(k)}>
                            {t('Show me')}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {revertIndex !== null && (
                  <p>
                    {t(
                      'Jump back to the last position where everything was correct? Your later entries are removed. Ctrl+Z brings them back.'
                    )}
                  </p>
                )}
                <div className="hint-actions">
                  {revertIndex !== null && <button onClick={revertToValid}>↩ {t('Back to correct')}</button>}
                  <button className="ghost" onClick={dismissRevert}>
                    {t('Keep looking')}
                  </button>
                </div>
              </div>
            </div>
          )}
          <footer className="app-footer">
            {/* the static pages exist in every language: /learn/, /nb/learn/, /es/learn/ */}
            <nav className="footer-learn" aria-label={t('Learn sudoku')}>
              <span>{t('Learn:')} </span>
              <a href={`${langRoot(t.lang)}learn/`} onClick={learnLink({ tab: 'techniques' })}>
                {t('Techniques')}
              </a>
              <span aria-hidden="true"> · </span>
              <a href={`${langRoot(t.lang)}learn/intuition/`} onClick={learnLink({ tab: 'intuition' })}>
                {t('Intuition')}
              </a>
              <span aria-hidden="true"> · </span>
              <a href={`${langRoot(t.lang)}learn/glossary/`} onClick={learnLink({ tab: 'glossary' })}>
                {t('Glossary')}
              </a>
              <span aria-hidden="true"> · </span>
              <a href={`${langRoot(t.lang)}${RATING_URL.slice(1)}`} onClick={learnLink({ tab: 'rating' })}>
                {t('Rating')}
              </a>
            </nav>
            <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">
              {t('Open source on GitHub')}
            </a>
            <span> · {t('feedback welcome')}</span>
            <span className="dedication">{t('for thth ♥')}</span>
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
          onDaily={() => {
            setDialog('none');
            startDaily();
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
          onLearn={() => openLearn()}
          onPath={() => setDialog('progress')}
        />
      )}
      {dialog === 'learn' && (
        <Suspense fallback={null}>
          <LearnDialog
            target={learnTarget}
            onClose={() => setDialog('none')}
            onPractice={(tech) => {
              setDialog('none');
              start({ kind: 'tech', tech });
            }}
            hub={{ onPractice: () => setDialog('practice'), onPath: () => setDialog('progress') }}
            onScan={
              info && !custom
                ? (tech) => {
                    setScanFor(tech);
                    setDialog('scan');
                  }
                : undefined
            }
            onExample={async (tech) => {
              // the example's own puzzle, started as practice of its technique:
              // with "Jump to the technique" on, that is the pictured position
              const EXAMPLES = await import('../content/examples').then((m) => m.EXAMPLES).catch(() => null);
              const example = EXAMPLES?.[tech];
              const rating = example && rateImport(example.puzzle);
              if (!example || !rating) return;
              setDialog('none');
              useGame.getState().startGame(example.puzzle, rating.score, rating.level, tech);
            }}
          />
        </Suspense>
      )}
      {dialog === 'io' && <ImportDialog onClose={() => setDialog('none')} />}
      {dialog === 'share' && <ShareDialog onClose={() => setDialog('none')} />}
      {dialog === 'steps' && <SolutionPathDialog onClose={() => setDialog('none')} />}
      {dialog === 'scan' && (
        <ScanDialog
          lookFor={scanFor ?? undefined}
          onClose={() => {
            setScanFor(null);
            setDialog('none');
          }}
        />
      )}
      {contractPrompt && (
        <ContractDialog onAnswer={answerContract} onClose={dismissContractPrompt} />
      )}
      {welcome && (
        <Modal title={t('Welcome to sudokUI')} onClose={dismissWelcome}>
          <p className="dialog-note">
            {t('A free, open-source sudoku studio. No ads, no account, and it works offline once loaded.')}
          </p>
          <ul className="welcome-list">
            <li>
              <strong>{t('Hints that teach.')}</strong>{' '}
              {t('77 solving techniques, each one explained and drawn on the board when you ask.')}
            </li>
            <li>
              <strong>{t('Practice what you struggle with.')}</strong>{' '}
              {t('Pick any of {n} techniques and get a puzzle that truly needs it.', { n: PRACTICE_TECHS.length })}
            </li>
            <li>
              <strong>{t('One daily puzzle for the whole world.')}</strong>{' '}
              {t('Same board for everyone, every day. Race your friends.')}
            </li>
          </ul>
          <p className="dialog-note">
            {t(
              'Learn, under the board, is where you follow your path, practise a technique and read the theory of every technique and the words solvers use; ⓘ in the top bar covers modes, shortcuts and the candidate system.'
            )}
          </p>
          <div className="hint-actions">
            <button
              onClick={() => {
                dismissWelcome();
                startDaily();
              }}
            >
              {t("Play today's daily")}
            </button>
            <button className="ghost" onClick={dismissWelcome}>
              {t('Just play')}
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog('none')} />}
      {dialog === 'info' && <InfoDialog onClose={() => setDialog('none')} onLearn={openLearn} />}
      {dialog === 'progress' && (
        <ProgressDialog
          onClose={() => setDialog('none')}
          onLearn={openLearn}
          onPracticeList={() => setDialog('practice')}
          onPractice={(tech) => {
            setDialog('none');
            start({ kind: 'tech', tech });
          }}
        />
      )}
      {dialog === 'restart' && (
        <Modal title={t('Restart puzzle?')} onClose={() => setDialog('none')}>
          <p className="dialog-note">
            {t(
              info?.practiceTech
                ? 'The board and timer reset to the beginning of the practice position. Your progress on this puzzle is lost.'
                : 'The board and timer reset to the beginning. Your progress on this puzzle is lost.'
            )}
          </p>
          <div className="hint-actions">
            <button
              onClick={() => {
                setDialog('none');
                restart();
              }}
            >
              {t('Restart')}
            </button>
            <button className="ghost" onClick={() => setDialog('none')}>
              {t('Keep playing')}
            </button>
          </div>
        </Modal>
      )}
      {genState && !welcome && (
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
          onProgress={() => {
            setVictoryDismissed(true);
            setDialog('progress');
          }}
        />
      )}
      <UpdateBar />
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          {notice}
        </div>
      )}
    </div>
  );
}
