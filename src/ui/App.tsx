// App shell: top bar (brand, difficulty/score, timer, quick toggles), the
// board + side panel layout, global keyboard handling, dialog routing,
// toast display and the first-visit bootstrap game.
import React, { Suspense, useEffect, useLayoutEffect, useState, useRef } from 'react';
import { SLOP_PX } from './touchIntent';
import { useGame, rateImport, Proof, listLayer } from '../state/gameStore';
import { cellName, PEERS } from '../engine/board';
import { useSettings } from '../state/settings';
import { useShownTheme, applyTheme } from './theme';
import { useAppStatus } from '../state/appStatus';
import { useT, translator, rich, langRoot } from '../content/i18n';
import type { Translator } from '../content/i18n';
import { Grid } from './Grid';
import { SetTracker } from './SetTracker';
import { Poodle } from './Poodle';
import { Controls } from './Controls';
import { HintPanel, ChainPanel } from './HintPanel';
import { RatingGauge, useRatingFit } from './RatingGauge';
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
import { SettingsDialog, InfoDialog, WhyDialog } from './SettingsInfo';
import { WHY, WHY_URL } from '../content/why';
import { ReportDialog } from './ReportDialog';
import type { ReportKind } from './report';
import type { Step } from '../engine/steps';
import { buildable } from '../engine/chainTrainer';
import { ProgressDialog } from './Progress';
import { Modal } from './Dialogs';
import type { LearnTarget } from './Learn';
import { partOrStandIn } from './lazyPart';

type GuideProps = React.ComponentProps<typeof import('./Learn').LearnDialog>;

/** the guide's file could not be fetched: the dialog closes, and the
 *  update bar says so and offers the reload, over the game as it was */
function GuideUnavailable({ onClose }: GuideProps) {
  useEffect(() => {
    useAppStatus.getState().setUpdateReady('chunk');
    onClose();
  }, [onClose]);
  return null;
}

// the guide is a third of the app's code and prose: fetched the first time
// it opens (and precached for offline), never as part of loading the game
const LearnDialog = React.lazy(
  partOrStandIn<React.ComponentType<GuideProps>>(() => import('./Learn').then((m) => m?.LearnDialog), GuideUnavailable)
);
import { PRACTICE_TECHS, Tech } from '../engine/ratings';
import { techFromParam } from '../content/slugs';
import { sharePath, readAppLink } from '../content/share';
import { localDateKey, dailyPath, pastDailyOn, dayName } from '../content/dailies';
import { startDaily, openAppLink, backToKept } from './links';
import { useDailyStats } from '../state/dailyStats';
import { useTelemetry } from '../state/telemetry';
import { RATING_URL, PRIVACY_URL } from '../content/staticRoutes';
import { BRAND } from './brand';
import { shortcutKey, followKeyFocus } from './shortcutKeys';

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

/** a new version waiting, or a file that could not load (offline in a
 *  first visit, or a deploy took it): the player decides when to reload;
 *  the game is saved either way */
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
              ? 'A part of sudokUI could not load. Reload to continue; your game is saved.'
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

/** the player's local date, kept current across a midnight with the app open and on coming back to it */
function useToday(): string {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    const check = () => setToday(localDateKey());
    const now = new Date();
    const untilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
    const id = setTimeout(check, untilMidnight + 1000);
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [today]);
  return today;
}

/**
 * Another day's daily on the board (the last game, resumed when the app
 * opens, or an old daily's link): a quiet line beside the board that says
 * which day it is, with the way to today's, which opens it as the Daily
 * button does. Never for today's daily; put away, it stays away for this
 * game (src/content/dailies.ts, pastDailyOn). Plain text in the page, so a
 * screen reader reads it where it stands; no dialog, nothing over the board.
 */
function PastDailyNote({ onToday }: { onToday: () => void }) {
  const info = useGame((s) => s.info);
  const custom = useGame((s) => s.custom);
  // the kept game's note stands in its place: two notes would push the
  // digit keys off a small phone's screen (New still has the daily)
  const kept = useGame((s) => !!s.setAside && !s.setAside.hidden);
  const hide = useGame((s) => s.hidePastDaily);
  const lang = useSettings((s) => s.lang);
  const t = useT();
  const today = useToday();
  const day = custom || kept ? null : pastDailyOn(info, today);
  if (!day) return null;
  return (
    <div className="past-daily" role="note">
      <p>
        {t('The daily of {date}', { date: dayName(day, t.locale, today) })}
        <span aria-hidden="true"> · </span>
        {/* a real address, so a modified click opens today's in a new tab */}
        <a
          href={dailyPath(lang, today)}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onToday();
          }}
        >
          {t('Today’s daily')}
          <span aria-hidden="true"> →</span>
        </a>
      </p>
      <button className="past-daily-close" onClick={hide} title={t('Hide this note')} aria-label={t('Hide this note')}>
        ✕
      </button>
    </div>
  );
}

/**
 * A game under way that a link opened another over, kept (src/ui/links.ts):
 * a quiet line beside the board, in the past-daily note's place and look,
 * whose Back to it swaps the two games, so neither is lost: the game it
 * leaves goes aside in turn, and the note then offers that one. It goes
 * when nothing is left to keep, or when it is put away; the game stays
 * kept, and New still offers it.
 */
function SetAsideNote() {
  const shown = useGame((s) => !!s.setAside && !s.setAside.hidden);
  const hide = useGame((s) => s.hideSetAside);
  const t = useT();
  if (!shown) return null;
  const back = (e: React.MouseEvent) => {
    backToKept();
    // pressed from the keyboard (a click with no pointer behind it), the
    // focus goes on from the board, since the note may go with the swap;
    // the toast says which game is back. A tap leaves the focus alone, so
    // no ring is drawn round the board
    if (e.detail === 0) document.querySelector<SVGElement>('svg[role="application"]')?.focus();
  };
  return (
    <div className="past-daily set-aside" role="note">
      <p>
        {t('Your game in progress is kept.')}{' '}
        <button className="link-button" onClick={back}>
          {t('Back to it')}
        </button>
      </p>
      <button className="past-daily-close" onClick={hide} title={t('Hide this note')} aria-label={t('Hide this note')}>
        ✕
      </button>
    </div>
  );
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
  const numberKey = useGame((s) => s.numberKey);
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
  const kept = useGame((s) => !!s.setAside);
  const contractPrompt = useGame((s) => s.contractPrompt);
  const contractFor = useGame((s) => s.contractFor);
  const answerContract = useGame((s) => s.answerContract);
  const dismissContractPrompt = useGame((s) => s.dismissContractPrompt);
  const convertMarks = useGame((s) => s.convertMarks);
  const startCustomEntry = useGame((s) => s.startCustomEntry);
  const cancelCustomEntry = useGame((s) => s.cancelCustomEntry);
  const finishCustomEntry = useGame((s) => s.finishCustomEntry);
  const givenCount = useGame((s) =>
    s.custom ? s.cells.filter((c) => c.value > 0).length : 0
  );
  const { font, toggleTheme, showTimer, hideRating, showPoodle, lang } = useSettings();
  const t = useT();
  const { start, genState, cancel } = useNewGame();
  // the hardest bands start from seeds: stock their pools while idle, so
  // even the first Nightmare on this device starts at once
  useEffect(() => {
    const t = setTimeout(() => warmSeededPools(), 4000);
    return () => clearTimeout(t);
  }, []);

  const [dialog, setDialog] = useState<
    'none' | 'new' | 'practice' | 'io' | 'share' | 'shareHint' | 'settings' | 'info' | 'why' | 'restart' | 'steps' | 'scan' | 'learn' | 'progress'
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
  // the report dialog, with the hint it is about when it came from "Looks wrong?"
  const [report, setReport] = useState<{ kind: ReportKind; hint?: Step } | null>(null);
  // a first visit opens straight on the board, an easy puzzle and no
  // dialog over it: the playing says what the app is (the owner's call,
  // 2 November 2026); what it stands for is under ⓘ and after a win.
  // The day's daily (startDaily) and the app's own links (openAppLink)
  // open through src/ui/links.ts, which never loses a game under way

  // before the first paint, so the app never shows a frame in the wrong look;
  // under Match device the look follows the device while the app is open
  const shown = useShownTheme();
  useLayoutEffect(() => applyTheme(shown), [shown]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);

  // boot: a link of the app's own opens first (src/ui/links.ts): #s=
  // carries a full position (entries, marks, colours), /p/<puzzle> and #p=
  // just the puzzle, /daily/<date> and #daily a day's daily, and a share
  // path may carry a challenger's time (src/content/share.ts). A game under
  // way is put aside, never lost, and the note beside the board offers it
  // back. Otherwise a saved game resumes (or a puzzle being typed in, which
  // has no address of its own), otherwise start an easy one. The /learn/
  // pages deep-link in with #practice=<technique> (start practising it) and
  // #learn=<topic> (open the guide there). StrictMode-guarded.
  useEffect(() => {
    if ((window as any).__sudokuiBooted) return;
    (window as any).__sudokuiBooted = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const learn = params.get('learn');
    if (learn) openLearn(parseLearnParam(learn));
    const practice = techFromParam(params.get('practice') ?? '');
    if (practice && PRACTICE_TECHS.includes(practice)) {
      // a Learn page's Practice link: from a page, the game under way
      // cannot be seen, so it goes aside as for any link
      start({ kind: 'tech', tech: practice }, { setAside: true });
      return;
    }
    const fallBack = () => {
      const now = useGame.getState();
      if (!now.info && !now.custom) start({ kind: 'level', level: 'Easy' });
    };
    const link = readAppLink(window.location);
    if (!link) return fallBack();
    void openAppLink(link, 'boot').then(({ opened, refused }) => {
      if (opened) return;
      // a share page promised a puzzle the app cannot play: say so, then
      // go on as with no link
      if (refused !== undefined && link.puzzle?.share) {
        const t = translator();
        useGame.setState({ notice: t('The shared puzzle could not be opened. {reason}', { reason: refused }).trim() });
      }
      fallBack();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the win screen put away stays away for that solve, an Undo and the
  // same digit again included (the same solve, recordWin); a new game, the
  // same puzzle by Restart or the solved daily chosen again among them,
  // shows its own
  const solved = useGame((s) => s.solved);
  useEffect(() => {
    if (!solved) setVictoryDismissed(false);
  }, [solved, info?.puzzle]);

  // a link opened in this tab (its hash changed): opened as at start-up,
  // a game under way put aside. The path is the address bar's own, the
  // puzzle on the board, so only the hash is read
  useEffect(() => {
    const onHash = () => {
      const link = readAppLink({ pathname: '/', search: '', hash: window.location.hash });
      if (link) void openAppLink(link, 'tab');
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
  // app's own, so it never names a puzzle that has left the board. A
  // puzzle being typed in has no address yet: the bar shows the home page,
  // so a reload keeps the entry (the boot, above) rather than reopening the
  // game that was on the board before it.
  useEffect(() => {
    const homeTitle = () =>
      import('../content/home')
        .then((m) => {
          document.title = m.HOME[lang].title;
        })
        .catch(() => {});
    if (custom) {
      try {
        window.history.replaceState(null, '', langRoot(lang));
      } catch {
        // an origin that allows no path of its own (a file:// build): at
        // least the old puzzle's hash goes, so a reload does not reopen it
        window.history.replaceState(null, '', window.location.pathname);
      }
      homeTitle();
      return;
    }
    if (!info?.puzzle) return;
    const rated = !(hideRating && !won);
    try {
      // a published daily's address is its day (src/content/dailies.ts)
      const path =
        info.dailyNo && info.dailyKey
          ? dailyPath(lang, info.dailyKey)
          : sharePath({ lang, puzzle: info.puzzle, level: rated ? info.level : undefined, score: rated ? info.score : undefined });
      window.history.replaceState(null, '', path);
    } catch {
      // an origin that allows no path of its own (a file:// build): the
      // hash link still names the puzzle, and the app still reads it
      window.history.replaceState(null, '', `#p=${info.puzzle}`);
    }
    homeTitle();
  }, [custom, info?.puzzle, info?.level, info?.score, info?.dailyNo, info?.dailyKey, lang, hideRating, won]);

  // a daily result that could not be sent goes on the next open, and when
  // the connection comes back (src/state/dailyStats.ts)
  useEffect(() => {
    const flush = () => void useDailyStats.getState().flushPending();
    flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, []);

  // the clock counts only while the board can be seen: it stops when the
  // page is hidden or left (another app, the screen off, a reload, the
  // update bar's among them) and is saved as it stood, so a page the
  // system closes in the background comes back at that time. A game under
  // way pauses, so the player comes back to the pause card; one not yet
  // played on runs on when shown again (gameStore.ts, setAway)
  useEffect(() => {
    const setAway = useGame.getState().setAway;
    const onVisibility = () => setAway(document.visibilityState === 'hidden');
    const onHide = () => setAway(true);
    const onShow = () => {
      if (document.visibilityState !== 'hidden') setAway(false);
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onShow);
    };
  }, []);

  // the plays counted (src/state/telemetry.ts): what waits goes on the
  // open, when the app is hidden or left, and when the connection comes back
  useEffect(() => {
    const flush = () => void useTelemetry.getState().flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    flush();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('online', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('online', flush);
    };
  }, []);

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

  /** the top bar's rating group: how much of the rating it has room for (RatingGauge.tsx) */
  const metaRef = useRef<HTMLDivElement>(null);
  useRatingFit(metaRef, [!!info, info?.level, info?.score, info?.practiceTech, hideRating, won, lang]);

  /** where a pointer landed on the empty space around the board, until it lifts */
  const layoutTap = useRef<{ x: number; y: number } | null>(null);
  const emptySpace = (el: EventTarget | null) =>
    el instanceof HTMLElement && (el.classList.contains('layout') || el.classList.contains('board-col'));

  // how focus last arrived, for Space (shortcutKeys.ts): followed from
  // the start, not anew whenever the handler below is replaced
  const keyFocus = useRef<ReturnType<typeof followKeyFocus> | null>(null);
  useEffect(() => {
    const follow = followKeyFocus();
    keyFocus.current = follow;
    return () => {
      follow.stop();
      keyFocus.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the shortcut a key names: a letter by its character, the rest by
      // its place (shortcutKeys.ts)
      const k = shortcutKey(e);
      // a dialog is open: its keys must not act on the board behind it
      // (N stays live, for "next puzzle" from the victory dialog)
      if (document.querySelector('.modal-backdrop') && k !== 'KeyN') return;
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      // Space presses a button the player reached with Tab, as anywhere
      // else; on the board, the page or a button the mouse pressed (focus
      // given back to it by Escape too) it cycles the mode
      if (e.code === 'Space' && keyFocus.current?.spaceIsControls(e)) return;
      if (!e.metaKey) {
        const other = e.ctrlKey || e.altKey;
        setTempMode(
          e.shiftKey && other ? 'color' : e.shiftKey ? 'corner' : other ? 'center' : null
        );
      }
      const mod = e.metaKey || e.ctrlKey;
      // a key held down repeats (the OS sends keydowns with repeat set).
      // Digits, Swap, Space, the mode keys, H, B, M, P and N each act once
      // per press, or a held digit would put itself in and take itself out
      // again: only moving, erasing and undo/redo repeat. The repeats the
      // first press kept from the page (scrolling, typing) are kept too
      const repeatable =
        e.code.startsWith('Arrow') || e.code === 'Backspace' || e.code === 'Delete' || (mod && (k === 'KeyZ' || k === 'KeyY'));
      // Enter on a focused button clicks it on every keydown, so its repeats
      // are kept from the page too: one press of a number key, one entry
      if (e.repeat && !repeatable) {
        if (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter' || /^(Digit|Numpad)[1-9]$/.test(e.code)) e.preventDefault();
        return;
      }
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
      if (mod && k === 'KeyZ' && !e.shiftKey) return void (e.preventDefault(), undo());
      if (mod && (k === 'KeyY' || (k === 'KeyZ' && e.shiftKey)))
        return void (e.preventDefault(), redo());
      if (mod && k === 'KeyA')
        return void (e.preventDefault(), select(Array.from({ length: 81 }, (_, i) => i), false));
      // any other letter with Ctrl or Cmd is the browser's or the system's
      // (Ctrl+H, Ctrl+P, Cmd+W...): it never wipes, pauses or hints
      if (mod && k.startsWith('Key')) return;
      if (e.code.startsWith('Digit') || e.code.startsWith('Numpad')) {
        const d = Number(e.code.replace('Digit', '').replace('Numpad', ''));
        if (d >= 1 && d <= 9) {
          e.preventDefault();
          // the chain trainer open: the digit is the selected cell's
          // candidate, as a tap on it would be, and never goes on the board
          if (useGame.getState().chain) return void useGame.getState().chainKey(d);
          // held modifiers already routed via the temporary mode; while a
          // digit is armed the key chooses the armed digit instead, as the
          // number keys on screen do
          numberKey(d);
          return;
        }
      }
      switch (k) {
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
        // Ctrl/Cmd with C, X and V copy, cut and paste: the mode stays
        case 'KeyZ':
          if (mod || e.altKey) break;
          setMode('digit');
          break;
        case 'KeyX':
          if (mod || e.altKey) break;
          setMode('corner');
          break;
        case 'KeyC':
          if (mod || e.altKey) break;
          setMode('center');
          break;
        case 'KeyV':
          if (mod || e.altKey) break;
          setMode('color');
          break;
        case 'KeyH': {
          // H walks the hint: ask, then reveal, then apply; the first
          // assist of a clean game asks the same question the button does
          const g = useGame.getState();
          if (g.hintStage === 'tech') g.revealHint();
          else if (g.hintStage === 'full' || g.hintStage === 'walk') g.applyHint();
          // (a solved board has no hint to give, and no question to ask)
          else if (g.assisted || g.won || !useSettings.getState().confirmAssist) requestHint();
          else g.askAssist('Hint');
          break;
        }
        case 'KeyS': {
          // Ctrl/Cmd+S is the browser's
          if (mod || e.altKey) break;
          // Shift+S gathers the marks (selection or board) into the layer
          // of the mode chosen (Shift itself makes the mode Corner while
          // held, so the base mode decides); S swaps corner and centre marks
          if (e.shiftKey) {
            const g = useGame.getState();
            g.gatherMarks(listLayer(g.mode));
          } else convertMarks();
          break;
        }
        case 'KeyP':
          togglePause();
          break;
        case 'KeyL':
          openLearn();
          break;
        case 'KeyB': {
          // the ring around cells with two candidates, on or off
          if (mod || e.altKey) break;
          useGame.getState().setBivalueHighlight(!useSettings.getState().highlightBivalue);
          break;
        }
        case 'KeyM': {
          // Cmd+M minimises the window, Ctrl+M is the browser's: not ours
          if (mod || e.altKey) break;
          const g = useGame.getState();
          g.setMultiSelect(!g.multiSelect);
          break;
        }
        case 'Escape': {
          const g = useGame.getState();
          if (g.chain) g.endChain();
          else {
            // the way out of multi-select, as of a selection
            if (g.multiSelect) g.setMultiSelect(false);
            select([], false);
          }
          break;
        }
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
  }, [numberKey, erase, wipe, undo, redo, setMode, requestHint, select, selection, togglePause, convertMarks, start]);

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
          <div className="game-meta" ref={metaRef}>
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
                <RatingGauge level={info.level} score={info.score} puzzle={info.puzzle} />
                {/* the title names the level where a narrow phone shortens it */}
                <span className={`level-badge level-${info.level.toLowerCase()}`} title={t.level(info.level)}>
                  {t.level(info.level)}
                </span>
                <button
                  className="score-btn"
                  onClick={() => openLearn({ tab: 'rating' })}
                  title={t('How this rating is calculated')}
                  aria-label={t('HoDoKu rating {score}. How the rating is calculated', { score: info.score })}
                >
                  <span className="rating-word">{t("HoDoKu rating||the puzzle's score, before the number")}{NBSP}</span><strong>{info.score}</strong> <span className="mini-i">ⓘ</span>
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
          {/* a solved game's clock has stopped for good: nothing to pause or resume */}
          <button
            className="icon-btn"
            onClick={togglePause}
            disabled={won}
            title={t('Pause (P)')}
            aria-label={t(paused && !won ? 'Resume game' : 'Pause game')}
          >
            {paused && !won ? '⏵' : '⏸'}
          </button>
          <button
            className="icon-btn theme-btn"
            onClick={toggleTheme}
            title={t('Cycle theme: dark → daylight → rosé → forest')}
            aria-label={t(
              shown === 'dark'
                ? 'Switch to daylight theme'
                : shown === 'light'
                  ? 'Switch to rosé theme'
                  : shown === 'rose'
                    ? 'Switch to forest theme'
                    : 'Switch to dark theme'
            )}
          >
            {shown === 'dark' ? '☀️' : shown === 'light' ? '🌸' : shown === 'rose' ? '🌲' : '🌙'}
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
        // touch has no Escape key: a tap on the empty space around the
        // board clears the selection. A tap, not any touch: a scroll that
        // starts beside the board (on a tablet, or in multi-select, where
        // the board keeps its own touches) ends in a pointercancel, never
        // here, and leaves the selection as it was
        onPointerDown={(e) => {
          layoutTap.current = emptySpace(e.target) ? { x: e.clientX, y: e.clientY } : null;
        }}
        onPointerUp={(e) => {
          const down = layoutTap.current;
          layoutTap.current = null;
          if (down && emptySpace(e.target) && Math.hypot(e.clientX - down.x, e.clientY - down.y) <= SLOP_PX) select([], false);
        }}
      >
        <div className="board-col">
          <Grid />
          <SetTracker />
          {/* while paused, Nutella moves onto the pause card instead */}
          {showPoodle && (!paused || won) && <Poodle />}
        </div>
        <aside className={`side${paused && !won ? ' paused' : ''}`}>
          <SetAsideNote />
          <PastDailyNote onToday={() => void startDaily()} />
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
            {/* a puzzle being typed in has no link yet: the tap says so */}
            <button
              aria-disabled={custom || undefined}
              onClick={() =>
                custom
                  ? useGame.setState({ notice: t('A puzzle being typed in has no link yet. Press {button} first', { button: t('Check & play') }) })
                  : setDialog('share')
              }
            >
              <span className="menu-icon">🔗</span>{t('Share')}
            </button>
            <button onClick={() => setDialog('restart')} title={custom ? t('Clear the board') : t('Reset this puzzle and the timer')}>
              <span className="menu-icon">↺</span>{t('Restart')}
            </button>
          </div>
          <Controls
            onShowSteps={info && !custom ? () => setDialog('steps') : undefined}
            onScan={info && !custom ? () => setDialog('scan') : undefined}
          />
          {info?.practiceTech && !custom && (
            <div className="practice-bar">
              <span className="practice-label">
                {rich(t('Practicing {tech}'), { tech: <strong>{t.tech(info.practiceTech)}</strong> })}
                {practiceFound && <span className="practice-found"> · {t('found||the technique being practised')} 🎯</span>}
              </span>
              <div className="practice-actions">
                {!practiceFound &&
                  !chain &&
                  practiceTarget &&
                  buildable(practiceTarget) && (
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
            </div>
          )}
          {chain ? (
            <ChainPanel />
          ) : (
            <HintPanel
              onLearn={(tech) => openLearn({ tab: 'techniques', tech })}
              onReport={(hint) => setReport({ kind: 'hint', hint })}
              onShare={() => setDialog('shareHint')}
            />
          )}
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
                      // the game from before the entry comes back, a reload
                      // or not; with none (a save from before the backup was
                      // kept), a fresh easy one
                      if (!useGame.getState().info) start({ kind: 'level', level: 'Easy' });
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
                {t('HoDoKu rating')}
              </a>
            </nav>
            <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">
              {t('Open source on GitHub')}
            </a>
            <span aria-hidden="true"> · </span>
            <button className="link-button" onClick={() => setReport({ kind: 'problem' })}>
              {t('Send feedback')}
            </button>
            <span aria-hidden="true"> · </span>
            {/* what the app sends, exactly: a static page in the app's language */}
            <a href={`${langRoot(t.lang)}${PRIVACY_URL.slice(1)}`}>{t('Privacy')}</a>
            <span aria-hidden="true"> · </span>
            {/* what sudokUI is for: a static page for search engines, the same words as a dialog here */}
            <a
              href={`${langRoot(t.lang)}${WHY_URL.slice(1)}`}
              onClick={(e) => {
                e.preventDefault();
                setDialog('why');
              }}
            >
              {WHY[t.lang].name}
            </a>
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
            void startDaily();
          }}
          onCustom={() => {
            setDialog('none');
            setCustomError(null);
            startCustomEntry();
          }}
          onKept={
            kept
              ? () => {
                  setDialog('none');
                  backToKept();
                }
              : undefined
          }
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
      {(dialog === 'share' || dialog === 'shareHint') && <ShareDialog onClose={() => setDialog('none')} withHint={dialog === 'shareHint'} />}
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
      {dialog === 'settings' && <SettingsDialog onClose={() => setDialog('none')} />}
      {dialog === 'info' && (
        <InfoDialog
          onClose={() => setDialog('none')}
          onLearn={openLearn}
          onFeedback={() => {
            setDialog('none');
            setReport({ kind: 'problem' });
          }}
        />
      )}
      {dialog === 'why' && (
        <WhyDialog
          onClose={() => setDialog('none')}
          onFeedback={() => {
            setDialog('none');
            setReport({ kind: 'problem' });
          }}
        />
      )}
      {report && <ReportDialog kind={report.kind} hint={report.hint} onClose={() => setReport(null)} />}
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
        <Modal title={custom ? t('Clear the board?') : t('Restart puzzle?')} onClose={() => setDialog('none')}>
          <p className="dialog-note">
            {custom
              ? t('Every digit on the board is cleared.')
              : t(
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
              {custom ? t('Clear||the board, while a puzzle is typed in') : t('Restart')}
            </button>
            <button className="ghost" onClick={() => setDialog('none')}>
              {custom ? t('Keep typing') : t('Keep playing')}
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
          onSettings={() => {
            setVictoryDismissed(true);
            setDialog('settings');
          }}
          onProgress={() => {
            setVictoryDismissed(true);
            setDialog('progress');
          }}
          onWhy={() => {
            setVictoryDismissed(true);
            setDialog('why');
          }}
        />
      )}
      {/* last among the dialogs, so it paints above the one that raised it
          (the Settings dialog's toggle asks it too); Position as text's is
          the Share dialog's own, whose answer copies the text */}
      {contractPrompt && contractFor !== 'text' && (
        <ContractDialog onAnswer={answerContract} onClose={dismissContractPrompt} asked={contractFor} />
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
