// The control panel: mode switcher (digit/corner/centre/colour), number pad
// (doubles as the colour palette in colour mode), undo/redo/erase and the
// candidate tools (hint, check, auto candidates, fill, convert).
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useT, msg, Translator } from '../content/i18n';
import { useGame, EntryMode, useResting } from '../state/gameStore';
import { useSettings, MarkLayer } from '../state/settings';
import { Modal } from './Dialogs';
import { PALETTE, colourName } from './Grid';
import { TapGate } from './keyTap';
import { useMedia, PHONE } from './useMedia';

function eraseTitle(t: Translator, mode: EntryMode, auto: boolean): string {
  if (mode === 'color') return t('Erase colours in selected cells (Backspace) · W wipes everything');
  if (mode === 'corner' || mode === 'center') {
    if (auto) return t('Restore struck candidates in selected cells (Backspace) · W wipes everything');
    return mode === 'corner'
      ? t('Erase corner marks in selected cells (Backspace) · W wipes everything')
      : t('Erase centre marks in selected cells (Backspace) · W wipes everything');
  }
  // with auto candidates on, the marks the board shows are the candidates:
  // Erase gives back the struck ones and leaves the player's hidden marks
  if (auto) return t('Erase value, then restore struck candidates, then colours (Backspace) · W wipes everything');
  return t('Erase value, then marks, then colours (Backspace) · W wipes everything');
}

/**
 * What every button does, in one line each. Shown by the "?" in the assist
 * box and, for the assists, in the question asked before the first one: a
 * touch screen has no hover, so a tooltip alone explains nothing there.
 * The name is also what the store and the keyboard ask for
 * (askAssist('Hint')), so it stays English here and is translated where
 * it is shown.
 */
const BUTTONS: { name: string; icon: string; text: string; assist?: true }[] = [
  { name: msg('Undo'), icon: '↩', text: msg('Takes back your last action.') },
  { name: msg('Redo'), icon: '↪', text: msg('Brings back what Undo took away.') },
  { name: msg('Erase'), icon: '⌫', text: msg('Clears the selected cells: the digit first, then pencil marks (with auto candidates on, the struck candidates come back instead), then colours.') },
  { name: msg('Swap'), icon: '⇄', text: msg('Moves corner marks to the centre and centre marks to the corner, in the selected cells or the whole board. Held in Corner or Centre mode, it gathers those marks into that mode’s layer instead; Shift+S gathers in any mode, into the layer Fill uses. Notation only.') },
  { name: msg('Hint'), icon: '💡', text: msg('Names the technique for the next step. It shows the step itself only if you ask.'), assist: true },
  { name: msg('Check'), icon: '✓', text: msg('Marks wrong digits, and pencil marks that have lost the true digit.'), assist: true },
  { name: msg('Steps'), icon: '≡', text: msg('Lists every step of one complete solution. You can jump to any of them.'), assist: true },
  { name: msg('Scan'), icon: '🔎', text: msg('Lists every technique that works in this exact position, not only the easiest.'), assist: true },
  { name: msg('Chain'), icon: '⛓', text: msg('You build a chain on the board, candidate by candidate; the engine checks each link and says what the chain proves.'), assist: true },
  { name: msg('Auto candidates'), icon: '⌗', text: msg('Works out the candidates of every cell and keeps them up to date as you play.'), assist: true },
  { name: msg('Fill candidates'), icon: '✎', text: msg('Writes every candidate into the empty cells as pencil marks, once.'), assist: true }
];

const textOf = (name: string) => BUTTONS.find((b) => b.name === name)!.text;

/** the Fill button's title while auto candidates are on: what a press says
 *  (fillCandidates), true whatever the "Keep candidates" setting */
const FILL_UNDER_AUTO_TITLE = msg('Auto candidates are on: every empty cell already shows its candidates, so there is nothing to fill.');

/**
 * The Assist box folded into one row, on a phone held upright, as left on
 * this device: folded, the buttons under the box (New, Import, Share ...)
 * come into view without scrolling. Storage that cannot be read leaves the
 * box open, as it is the first time.
 */
const FOLD_KEY = 'sudokui-assist-folded';
function readFolded(): boolean {
  try {
    return localStorage.getItem(FOLD_KEY) === '1';
  } catch {
    return false;
  }
}
function keepFolded(folded: boolean): void {
  try {
    if (folded) localStorage.setItem(FOLD_KEY, '1');
    else localStorage.removeItem(FOLD_KEY);
  } catch {
    // private browsing or full storage: the box stays as it is until a reload
  }
}

/**
 * Whether the edit row's words fit beside their icons, all on one row: read
 * with the words shown, in the font the device really has, and put back as
 * it was before anything is drawn. A label is never wider than its button
 * there (styles.css gives each its label's width), so a row whose words do
 * not fit wraps instead, and that is what tells.
 */
function editWordsFit(row: HTMLElement): boolean {
  const iconsOnly = row.classList.contains('icons');
  if (iconsOnly) row.classList.remove('icons');
  const buttons = [...row.children] as HTMLElement[];
  // a button that starts below the first one's foot has wrapped (the "?"
  // is shorter, centred on the row)
  const first = buttons[0];
  const foot = first ? first.offsetTop + first.offsetHeight : 0;
  const fit = buttons.every((b) => b.offsetTop < foot && b.scrollWidth <= b.clientWidth);
  if (iconsOnly) row.classList.add('icons');
  return fit;
}

const MODES: { id: EntryMode; label: string; key: string }[] = [
  { id: 'digit', label: msg('Digit'), key: 'Z' },
  { id: 'corner', label: msg('Corner'), key: 'X' },
  { id: 'center', label: msg('Centre'), key: 'C' },
  { id: 'color', label: msg('Colour'), key: 'V' }
];

/** the "?": what every button does, in a dialog */
function HelpButton({ t, onClick }: { t: Translator; onClick: () => void }) {
  return (
    <button className="zone-help" onClick={onClick} aria-label={t('What the buttons do')} title={t('What the buttons do')}>
      ?
    </button>
  );
}

export function Controls({
  onShowSteps,
  onScan
}: {
  onShowSteps?: () => void;
  onScan?: () => void;
}) {
  const mode = useGame((s) => s.mode);
  const tempMode = useGame((s) => s.tempMode);
  const effectiveMode = tempMode ?? mode;

  // A number key tapped enters the digit in the current mode. In Digit mode,
  // with cells selected, held for a moment it enters a corner mark instead,
  // so a phone needs no trip to the mode buttons for a pencil mark; the key
  // shows the digit in its corner while the hold lasts. In the other modes a
  // press is a tap however long it lasts: a slow tap in Centre mode must not
  // put a corner mark in the cell instead of the centre mark it was meant
  // for. While a digit is armed the keys choose the armed digit (numberKey),
  // and a hold is a tap too: the armed key always puts the digit down.
  const keyHold = useRef<{ digit: number; timer: number } | null>(null);
  // a key pressed by a pointer is handled by the pointer's own events,
  // however long the press: the click the browser sends after it is the
  // same press again (keyboard and assistive technology click with no
  // pointer); keyTap.ts matches the two by time, as iOS Safari needs
  const [keyTaps] = useState(() => new TapGate<number>());
  const [heldKey, setHeldKey] = useState<number | null>(null);
  const endHold = () => {
    const hold = keyHold.current;
    if (!hold) return;
    keyHold.current = null;
    window.clearTimeout(hold.timer);
    setHeldKey(null);
  };
  const pressKey = (d: number) => {
    endHold();
    keyTaps.down(d);
    const hold = { digit: d, timer: 0 };
    const g = useGame.getState();
    if ((g.tempMode ?? g.mode) === 'digit' && g.armedDigit === null && g.selection.length > 0)
      hold.timer = window.setTimeout(() => {
        if (keyHold.current !== hold || keyTaps.pressing !== d) return;
        keyTaps.spend();
        setHeldKey(d);
        navigator.vibrate?.(12);
        input(d, 'corner');
      }, 450);
    keyHold.current = hold;
  };
  /** the press on key d ends: lifted on the key (on), or slid off it, or taken by the browser */
  // `at` is the event's own time (Event.timeStamp, on performance.now's
  // clock), so a click the browser hands over late, on a busy phone, is
  // still matched to the lift it follows
  const releaseKey = (d: number, on: boolean, at: number) => {
    if (keyHold.current?.digit === d) endHold();
    // lifted in time, on the key it landed on: a tap
    if (keyTaps.up(d, on, at)) numberKey(d);
  };
  const setMode = useGame((s) => s.setMode);
  const input = useGame((s) => s.input);
  const numberKey = useGame((s) => s.numberKey);
  const erase = useGame((s) => s.erase);
  const undo = useGame((s) => s.undo);
  const redo = useGame((s) => s.redo);
  const canUndo = useGame((s) => s.history.length > 0);
  const canRedo = useGame((s) => s.future.length > 0);
  const autoCandidates = useGame((s) => s.autoCandidates);
  const toggleAutoCandidates = useGame((s) => s.toggleAutoCandidates);
  const fillCandidates = useGame((s) => s.fillCandidates);
  const convertMarks = useGame((s) => s.convertMarks);
  const requestHint = useGame((s) => s.requestHint);
  const check = useGame((s) => s.check);
  const [autoOffPrompt, setAutoOffPrompt] = useState(false);
  // a question asked of the game on the board goes with that game: another
  // game brought in (Back or Forward, a link in this tab, the slot) closes
  // it, so its answer never acts on the game that came in
  const boardGame = useGame((s) => s.info);
  const boardCustom = useGame((s) => s.custom);
  useEffect(() => setAutoOffPrompt(false), [boardGame, boardCustom]);
  const assisted = useGame((s) => s.assisted);
  // a solved board: its solve is recorded as it was played. Check, Steps and
  // Scan still study it, asking nothing, since nothing of the solve changes;
  // Hint, Chain, Auto and Fill have nothing left to do on it
  const won = useGame((s) => s.won);
  // behind the pause card the controls rest: inert, and their questions
  // wait until the game resumes (App.tsx)
  const resting = useResting();
  const pending = useGame((s) => s.pendingAssist);
  const askAssist = useGame((s) => s.askAssist);
  const armedDigit = useGame((s) => s.armedDigit);
  const multiSelect = useGame((s) => s.multiSelect);
  const setMultiSelect = useGame((s) => s.setMultiSelect);
  const [help, setHelp] = useState(false);
  const custom = useGame((s) => s.custom);
  // the Assist box folds on a phone only: elsewhere it is always open, and
  // a phone turned on its side opens it (the choice is kept for upright)
  const phone = useMedia(PHONE);
  const [foldChoice, setFoldChoice] = useState(readFolded);
  const folded = phone && foldChoice;
  const toggleFold = () => {
    setFoldChoice(!folded);
    keepFolded(!folded);
  };
  // on a phone the "?" stands at the end of the edit row, beside Swap, and
  // the four buttons give it their room: where their words then cannot
  // fit (a 320 px phone in Spanish), the row shows the icons alone, and
  // each button keeps its word as its name
  const editRow = useRef<HTMLDivElement>(null);
  const [editIcons, setEditIcons] = useState(false);

  // the first assist of a clean game asks first; after that, and for
  // anyone who has switched the question off, the buttons act at once
  // first time auto candidates are switched OFF, let the user decide what
  // happens to the candidate state (the answer becomes their setting)
  const onAutoToggle = () => {
    if (autoCandidates && !useSettings.getState().autoOffPromptDone) {
      setAutoOffPrompt(true);
      return;
    }
    toggleAutoCandidates();
  };

  // Swap held for a moment in Corner or Centre mode gathers the marks
  // into that layer (Gather): the button says where they will go, the
  // phone buzzes, and lifting on the button does it; sliding off cancels.
  // In Digit or Colour mode a hold is a tap
  const gatherMarks = useGame((s) => s.gatherMarks);
  const swapHold = useRef<{ timer: number; layer: MarkLayer | null; armed: boolean } | null>(null);
  // as the number keys: the click after a pointer press is that press again
  const [swapTaps] = useState(() => new TapGate<'swap'>());
  const [gatherArmed, setGatherArmed] = useState<MarkLayer | null>(null);
  const pressSwap = () => {
    if (swapHold.current) window.clearTimeout(swapHold.current.timer);
    swapTaps.down('swap');
    const g = useGame.getState();
    const m = g.tempMode ?? g.mode;
    const hold = { timer: 0, layer: m === 'corner' || m === 'center' ? m : null, armed: false };
    if (hold.layer)
      hold.timer = window.setTimeout(() => {
        if (swapHold.current !== hold) return;
        hold.armed = true;
        // a hold is never a tap, lifted on the button or not
        swapTaps.spend();
        setGatherArmed(hold.layer);
        navigator.vibrate?.(12);
      }, 500);
    swapHold.current = hold;
  };
  const releaseSwap = (on: boolean, at: number) => {
    const hold = swapHold.current;
    if (hold) {
      swapHold.current = null;
      window.clearTimeout(hold.timer);
      setGatherArmed(null);
    }
    const tap = swapTaps.up('swap', on, at);
    if (hold?.armed && hold.layer && on) gatherMarks(hold.layer);
    else if (tap) convertMarks();
  };
  /** the pointer is over the button (a touch stays the button's while it lasts, so the place is what tells) */
  const onButton = (e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };

  const chooseAutoOff = (layer: MarkLayer | 'none') => {
    useSettings.getState().set(
      layer === 'none'
        ? { autoOffMaterialize: false, autoOffPromptDone: true }
        : { autoOffMaterialize: true, materializeLayer: layer, autoOffPromptDone: true }
    );
    setAutoOffPrompt(false);
    // the layer just chosen, whichever mode is active
    toggleAutoCandidates(layer === 'none' ? undefined : layer);
  };

  const startChain = useGame((s) => s.startChain);
  const guarded = (name: string, run: () => void) => () => {
    if (assisted || won || !useSettings.getState().confirmAssist) return run();
    askAssist(name);
  };
  // what each named assist runs once the question is answered; the keyboard
  // asks through the store (H for a hint), so the answer must find its action here
  const actions: Record<string, (() => void) | undefined> = {
    Hint: requestHint,
    Check: check,
    Steps: onShowSteps,
    Scan: onScan,
    Chain: startChain,
    'Auto candidates': onAutoToggle,
    'Fill candidates': fillCandidates
  };
  const use = (stopAsking: boolean) => {
    if (stopAsking) useSettings.getState().set({ confirmAssist: false });
    if (pending) actions[pending]?.();
    askAssist(null);
  };

  const t = useT();
  // where Fill writes (listLayer): the mode's layer, or the one set in
  // Settings; and so does switching Auto off, when it keeps the candidates
  // (the first time, it asks)
  const materializeLayer = useSettings((s) => s.materializeLayer);
  const fillLayer = effectiveMode === 'corner' || effectiveMode === 'center' ? effectiveMode : materializeLayer;
  const keepCandidates = useSettings((s) => s.autoOffMaterialize);
  const autoOffPromptDone = useSettings((s) => s.autoOffPromptDone);
  const rowHelp = phone && !custom;
  useLayoutEffect(() => {
    const row = editRow.current;
    if (!phone || !row) {
      setEditIcons(false);
      return;
    }
    // not while Swap is held: Gather's label is not the row's
    const measure = () => {
      if (!row.querySelector('.gather-armed')) setEditIcons(!editWordsFit(row));
    };
    measure();
    // a phone turned, a window resized; a browser without the observer
    // keeps the first reading
    const seen = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    seen?.observe(row);
    let live = true;
    document.fonts?.ready.then(() => live && measure());
    return () => {
      live = false;
      seen?.disconnect();
    };
  }, [phone, rowHelp, t.lang]);
  return (
    <div className="controls" inert={resting ? '' : undefined}>
      <div className="mode-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${effectiveMode === m.id ? 'active' : ''}${tempMode === m.id ? ' held' : ''}`}
            aria-pressed={effectiveMode === m.id}
            onClick={() => setMode(m.id)}
            title={`${t(m.label)} (${m.key})`}
          >
            {t(m.label)}
            <span className="key-hint">{m.key}</span>
          </button>
        ))}
        {/* multi-select, for fingers (styles.css shows it on coarse pointers
            only): a tap adds a cell or takes it out, a drag paints, and the
            board keeps every touch so the drag goes any way (Grid.tsx). The
            label is one short word: five buttons share a phone's width */}
        <button
          className={`mode-btn multi${multiSelect ? ' active' : ''}`}
          aria-pressed={multiSelect}
          onClick={() => setMultiSelect(!multiSelect)}
          title={t('Multi-select (M): tap cells to add or remove them, drag to paint them in or out; the page scrolls from beside the board')}
        >
          {t('Multi')}
          <span className="key-hint">M</span>
        </button>
      </div>

      <div className="numpad">
        {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
          <button
            key={d}
            className={`num-btn ${effectiveMode === 'color' ? 'color-btn' : ''}${armedDigit === d ? ' armed' : ''}${heldKey === d ? ' held-corner' : ''}`}
            aria-pressed={armedDigit === d}
            // a Colour key shows no digit: its name is its colour's
            aria-label={effectiveMode === 'color' ? colourName(t, d - 1) : undefined}
            title={t(
              armedDigit === d
                ? '{d} is armed: tap a cell to enter it. Tap {d} again to put it down, whatever is selected'
                : armedDigit !== null
                  ? 'Arm {d} instead of {a}: a tap on a cell then enters {d}'
                  : effectiveMode === 'color'
                    ? 'Paints the selected cells in this colour, or takes it off when they all have it'
                    : '{d}. In Digit mode, hold it to enter a corner mark. With nothing selected, arms {d}: every {d} lights up and a tap on a cell enters it',
              { d, a: armedDigit ?? '' }
            )}
            style={
              effectiveMode === 'color'
                ? { background: PALETTE[d - 1], color: '#10131c' }
                : undefined
            }
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              pressKey(d);
            }}
            onPointerUp={(e) => releaseKey(d, true, e.timeStamp)}
            onPointerLeave={(e) => releaseKey(d, false, e.timeStamp)}
            onPointerCancel={(e) => releaseKey(d, false, e.timeStamp)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              // a pointer press was handled above, however long it lasted;
              // the keyboard and assistive technology enter here, and so
              // does a tap whose lift did not count (keyTap.ts)
              const pressed = keyTaps.pressing === d;
              if (!keyTaps.click(d, e.timeStamp)) return;
              if (pressed) endHold();
              numberKey(d);
            }}
          >
            {effectiveMode === 'color' ? '' : d}
          </button>
        ))}
      </div>

      {/* history & notation: none of these count as help. On a phone the
          "?" that explains every button ends the row */}
      <div ref={editRow} className={`action-row edit-row${editIcons ? ' icons' : ''}`}>
        <button onClick={undo} disabled={!canUndo} title={t('Undo (Ctrl+Z)')}>
          <span className="edit-icon" aria-hidden="true">↩</span> <span className="edit-word">{t('Undo')}</span>
        </button>
        <button onClick={redo} disabled={!canRedo} title={t('Redo (Ctrl+Y)')}>
          <span className="edit-icon" aria-hidden="true">↪</span> <span className="edit-word">{t('Redo')}</span>
        </button>
        <button onClick={erase} title={eraseTitle(t, effectiveMode, autoCandidates)}>
          <span className="edit-icon" aria-hidden="true">⌫</span> <span className="edit-word">{t('Erase')}</span>
        </button>
        {/* a tap swaps; held in Corner or Centre mode it arms Gather,
            shows where the marks will go, and lifting on the button does
            it (sliding off cancels) */}
        <button
          className={`swap-btn${gatherArmed ? ' gather-armed' : ''}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            pressSwap();
          }}
          onPointerMove={(e) => {
            if (swapHold.current && !onButton(e)) releaseSwap(false, e.timeStamp);
          }}
          onPointerUp={(e) => releaseSwap(onButton(e), e.timeStamp)}
          onPointerLeave={(e) => releaseSwap(false, e.timeStamp)}
          onPointerCancel={(e) => releaseSwap(false, e.timeStamp)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            // as the number keys: a pointer press was handled above
            const pressed = swapTaps.pressing !== null;
            if (!swapTaps.click('swap', e.timeStamp)) return;
            if (pressed) releaseSwap(false, e.timeStamp);
            convertMarks();
          }}
          title={t('Swap corner and centre marks (S), in the selected cells or the whole board. Held in Corner or Centre mode it gathers those marks into that mode’s layer; Shift+S gathers into the layer Fill uses. Pure notation, never counts as help')}
        >
          {gatherArmed ? (
            // where the marks will go: on a narrow row the arrow stands over the word
            <span className="gather-label">{t(gatherArmed === 'corner' ? '→ Corner' : '→ Centre')}</span>
          ) : (
            <>
              <span className="edit-icon" aria-hidden="true">⇄</span> <span className="edit-word">{t('Swap')}</span>
            </>
          )}
        </button>
        {rowHelp && <HelpButton t={t} onClick={() => setHelp(true)} />}
      </div>

      {/* one group, one caption: everything inside counts as help, and
          the solve is no longer unassisted the moment any of it is used.
          Not while a puzzle is typed in: there is no game to help with,
          and the one Cancel brings back must come back as it was */}
      {!custom && (
      <div className={`assist-zone${folded ? ' folded' : ''}`}>
        <div className="row-caption zone-head">
          {/* folded, one line that names the box and says what it costs;
              where the line has no room for the note, it drops the note
              (styles.css) rather than taking a second line */}
          <span className="zone-title">
            {t('Assist')}{' '}
            {/* not on a solved board: Check, Steps and Scan study it for
                free there, and the rest is greyed out */}
            {won ? null : folded ? (
              <span className="zone-note">
                <span className="zone-dot" aria-hidden="true">·</span> {t('counts as help||after the name of the Assist box, folded into one row')}
              </span>
            ) : (
              <span className="zone-note">{t('everything in this box counts as help')}</span>
            )}
          </span>
          {/* folded, the box keeps the assist used most */}
          {folded && (
            <button className="zone-hint" onClick={guarded('Hint', requestHint)} disabled={won} title={t('Hint (H): names the technique first, reveals it only if you ask')}>
              <span className="btn-icon" aria-hidden="true">💡</span>
              <span>{t('Hint')}</span>
            </button>
          )}
          {!phone && <HelpButton t={t} onClick={() => setHelp(true)} />}
          {phone && (
            <button
              className="zone-fold"
              onClick={toggleFold}
              aria-expanded={!folded}
              aria-controls="assist-buttons"
              aria-label={t('Assist buttons')}
              title={t(folded ? 'Show every assist' : 'Fold the box into one row, keeping Hint')}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
        <div className="assist-body" id="assist-buttons" hidden={folded}>
          <span className="row-sub">{t('Reveals logic')}</span>
          <div className="action-row">
            <button onClick={guarded('Hint', requestHint)} disabled={won} title={t('Hint (H): names the technique first, reveals it only if you ask')}>
              <span className="btn-icon" aria-hidden="true">💡</span>
              <span>{t('Hint')}</span>
            </button>
            <button onClick={guarded('Check', check)} title={t('Check values and candidate lists against the solution')}>
              <span className="btn-icon" aria-hidden="true">✓</span>
              <span>{t('Check')}</span>
            </button>
            {onShowSteps && (
              <button
                onClick={guarded('Steps', onShowSteps)}
                title={
                  won
                    ? t('Show every step of one complete solution and jump to any point')
                    : t('Show every step of one complete solution and jump to any point. Counts as assistance')
                }
              >
                <span className="btn-icon" aria-hidden="true">≡</span><span>{t('Steps')}</span>
              </button>
            )}
            {onScan && (
              <button
                onClick={guarded('Scan', onScan)}
                title={
                  won
                    ? t('List every technique available in this exact position, not just the easiest')
                    : t('List every technique available in this exact position, not just the easiest. Counts as assistance')
                }
              >
                <span className="btn-icon" aria-hidden="true">🔎</span><span>{t('Scan')}</span>
              </button>
            )}
            <button
              onClick={guarded('Chain', startChain)}
              disabled={won}
              title={t('Build a chain yourself, candidate by candidate; the engine checks each link and says what it proves. Counts as assistance')}
            >
              <span className="btn-icon" aria-hidden="true">⛓</span><span>{t('Chain')}</span>
            </button>
          </div>

          <span className="row-sub">{t('Writes marks for you')}</span>
          <div className="action-row">
            <button
              className={autoCandidates ? 'toggled' : ''}
              aria-pressed={autoCandidates}
              onClick={autoCandidates ? onAutoToggle : guarded('Auto candidates', onAutoToggle)}
              disabled={won}
              title={t(
                !autoCandidates
                  ? 'Maintain candidates automatically (keeps your centre-mark eliminations); strike digits with pencil input'
                  : !autoOffPromptDone
                    ? 'Turn off. The first time, you choose whether the candidates stay as your marks, and Ctrl+Z reverts'
                    : !keepCandidates
                      ? 'Turn off. Nothing is written into your marks, since Settings is set not to keep the candidates, and Ctrl+Z reverts'
                      : fillLayer === 'corner'
                        ? 'Turn off. The candidates are written into your corner marks, and Ctrl+Z reverts'
                        : 'Turn off. The candidates are written into your centre marks, and Ctrl+Z reverts'
              )}
            >
              <span className="btn-icon" aria-hidden="true">⌗</span><span>{t('Auto candidates')}</span>
            </button>
            <button
              onClick={guarded('Fill candidates', fillCandidates)}
              disabled={won}
              title={t(
                autoCandidates
                  ? FILL_UNDER_AUTO_TITLE
                  : fillLayer === 'corner'
                    ? 'Fill corner marks with all candidates. With empty cells selected, only those are filled'
                    : 'Fill centre marks with all candidates. With empty cells selected, only those are filled'
              )}
            >
              <span className="btn-icon" aria-hidden="true">✎</span><span>{t('Fill candidates')}</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {pending && !resting && (
        <Modal title={t('Use {name}?', { name: t(pending) })} onClose={() => askAssist(null)}>
          <p className="dialog-note">{t(textOf(pending))}</p>
          <p className="dialog-note">
            {t('Using it counts as help, so this solve will no longer be unassisted. Everything else stays as it is.')}
          </p>
          <div className="hint-actions">
            <button onClick={() => use(false)}>{t('Use {name}', { name: t(pending) })}</button>
            <button className="ghost" onClick={() => askAssist(null)}>
              {t('Cancel')}
            </button>
            <button className="ghost" onClick={() => use(true)}>
              {t('Use, and stop asking')}
            </button>
          </div>
        </Modal>
      )}

      {help && !resting && (
        <Modal title={t('What the buttons do')} onClose={() => setHelp(false)}>
          <dl className="learn-points button-help">
            {BUTTONS.map((b) => (
              <React.Fragment key={b.name}>
                <dt>
                  <span className="button-help-icon" aria-hidden="true">
                    {b.icon}
                  </span>
                  {t(b.name)}
                  {b.assist && <span className="zone-note">{t('counts as help')}</span>}
                </dt>
                <dd>{t(b.text)}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Modal>
      )}

      {autoOffPrompt && !resting && (
        <Modal title={t('Keep your candidates?')} onClose={() => setAutoOffPrompt(false)}>
          <p className="dialog-note">
            {t(
              'When Auto is switched off, the candidates it was showing can stay on the board as your own pencil marks, so you continue exactly where Auto left off. Your choice is saved in Settings as “Keep candidates when Auto is switched off” and, for a layer, as “Candidates go in”, the layer Digit and Colour mode use (Corner and Centre mode use their own). You can change both there anytime.'
            )}
          </p>
          <div className="level-list">
            <button className="level-btn" onClick={() => chooseAutoOff('center')}>
              <strong>{t('Centre marks')}</strong>
              <span>{t('A compact list in the middle of the cell (recommended)')}</span>
            </button>
            <button className="level-btn" onClick={() => chooseAutoOff('corner')}>
              <strong>{t('Corner marks')}</strong>
              <span>{t('Each digit in its own fixed spot, where hints highlight it')}</span>
            </button>
            <button className="level-btn" onClick={() => chooseAutoOff('none')}>
              <strong>{t("Don't fill anything")}</strong>
              <span>{t('Just switch off. Your own marks stay as they were')}</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
