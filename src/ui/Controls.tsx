// The control panel: mode switcher (digit/corner/centre/colour), number pad
// (doubles as the colour palette in colour mode), undo/redo/erase and the
// candidate tools (hint, check, auto candidates, fill, convert).
import React, { useRef, useState } from 'react';
import { useT, msg, Translator } from '../content/i18n';
import { useGame, EntryMode } from '../state/gameStore';
import { useSettings, MarkLayer } from '../state/settings';
import { Modal } from './Dialogs';
import { PALETTE } from './Grid';

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

const MODES: { id: EntryMode; label: string; key: string }[] = [
  { id: 'digit', label: msg('Digit'), key: 'Z' },
  { id: 'corner', label: msg('Corner'), key: 'X' },
  { id: 'center', label: msg('Centre'), key: 'C' },
  { id: 'color', label: msg('Colour'), key: 'V' }
];

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
  // held for a moment it enters a corner mark instead, so a phone needs no
  // trip to the mode buttons for a pencil mark; the key shows the digit in
  // its corner while the hold lasts. In the other modes a press is a tap
  // however long it lasts: a slow tap in Centre mode must not put a corner
  // mark in the cell instead of the centre mark it was meant for.
  const keyHold = useRef<{ digit: number; timer: number; fired: boolean } | null>(null);
  // a key pressed by a pointer is handled by the pointer's own events,
  // however long the press: the click the browser sends after it is not a
  // second press (keyboard and assistive technology click with no pointer)
  const keyPointer = useRef(false);
  const [heldKey, setHeldKey] = useState<number | null>(null);
  const pressKey = (d: number) => {
    keyPointer.current = true;
    if (keyHold.current) window.clearTimeout(keyHold.current.timer);
    const hold = { digit: d, timer: 0, fired: false };
    const g = useGame.getState();
    if ((g.tempMode ?? g.mode) === 'digit')
      hold.timer = window.setTimeout(() => {
        hold.fired = true;
        setHeldKey(d);
        navigator.vibrate?.(12);
        input(d, 'corner');
      }, 450);
    keyHold.current = hold;
  };
  const releaseKey = (d: number | null) => {
    const hold = keyHold.current;
    if (!hold) return;
    keyHold.current = null;
    window.clearTimeout(hold.timer);
    setHeldKey(null);
    // lifted in time, on the key it landed on: a tap
    if (!hold.fired && d === hold.digit) input(d);
  };
  const setMode = useGame((s) => s.setMode);
  const input = useGame((s) => s.input);
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
  const assisted = useGame((s) => s.assisted);
  const pending = useGame((s) => s.pendingAssist);
  const askAssist = useGame((s) => s.askAssist);
  const armedDigit = useGame((s) => s.armedDigit);
  const multiSelect = useGame((s) => s.multiSelect);
  const setMultiSelect = useGame((s) => s.setMultiSelect);
  const [help, setHelp] = useState(false);
  const custom = useGame((s) => s.custom);

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
  const swapPointer = useRef(false);
  const [gatherArmed, setGatherArmed] = useState<MarkLayer | null>(null);
  const pressSwap = () => {
    swapPointer.current = true;
    if (swapHold.current) window.clearTimeout(swapHold.current.timer);
    const g = useGame.getState();
    const m = g.tempMode ?? g.mode;
    const hold = { timer: 0, layer: m === 'corner' || m === 'center' ? m : null, armed: false };
    if (hold.layer)
      hold.timer = window.setTimeout(() => {
        hold.armed = true;
        setGatherArmed(hold.layer);
        navigator.vibrate?.(12);
      }, 500);
    swapHold.current = hold;
  };
  const releaseSwap = (on: boolean) => {
    const hold = swapHold.current;
    if (!hold) return;
    swapHold.current = null;
    window.clearTimeout(hold.timer);
    setGatherArmed(null);
    if (!on) return;
    if (hold.armed && hold.layer) gatherMarks(hold.layer);
    else convertMarks();
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
    if (assisted || !useSettings.getState().confirmAssist) return run();
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
  return (
    <div className="controls">
      <div className="mode-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${effectiveMode === m.id ? 'active' : ''}${tempMode === m.id ? ' held' : ''}`}
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
            title={t(
              armedDigit === d
                ? '{d} is armed: tap a cell to enter it, tap {d} again to put it down'
                : '{d}. In Digit mode, hold it to enter a corner mark. With nothing selected, arms {d}: every {d} lights up and a tap on a cell enters it',
              { d }
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
            onPointerUp={() => releaseKey(d)}
            onPointerLeave={() => releaseKey(null)}
            onPointerCancel={() => releaseKey(null)}
            onContextMenu={(e) => e.preventDefault()}
            onClick={(e) => {
              // a pointer press was handled above, however long it lasted;
              // the keyboard (detail 0) and assistive technology enter here
              const fromPointer = keyPointer.current && e.detail !== 0;
              keyPointer.current = false;
              if (!fromPointer) input(d);
            }}
          >
            {effectiveMode === 'color' ? '' : d}
          </button>
        ))}
      </div>

      {/* history & notation: none of these count as help */}
      <div className="action-row">
        <button onClick={undo} disabled={!canUndo} title={t('Undo (Ctrl+Z)')}>↩ {t('Undo')}</button>
        <button onClick={redo} disabled={!canRedo} title={t('Redo (Ctrl+Y)')}>↪ {t('Redo')}</button>
        <button onClick={erase} title={eraseTitle(t, effectiveMode, autoCandidates)}>⌫ {t('Erase')}</button>
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
            if (swapHold.current && !onButton(e)) releaseSwap(false);
          }}
          onPointerUp={(e) => releaseSwap(onButton(e))}
          onPointerLeave={() => releaseSwap(false)}
          onPointerCancel={() => releaseSwap(false)}
          onContextMenu={(e) => e.preventDefault()}
          onClick={(e) => {
            // as the number keys: a pointer press was handled above
            const fromPointer = swapPointer.current && e.detail !== 0;
            swapPointer.current = false;
            if (!fromPointer) convertMarks();
          }}
          title={t('Swap corner and centre marks (S), in the selected cells or the whole board. Held in Corner or Centre mode it gathers those marks into that mode’s layer; Shift+S gathers into the layer Fill uses. Pure notation, never counts as help')}
        >
          {gatherArmed ? t(gatherArmed === 'corner' ? '→ Corner' : '→ Centre') : `⇄ ${t('Swap')}`}
        </button>
      </div>

      {/* one group, one caption: everything inside counts as help, and
          the solve is no longer unassisted the moment any of it is used.
          Not while a puzzle is typed in: there is no game to help with,
          and the one Cancel brings back must come back as it was */}
      {!custom && (
      <div className="assist-zone">
        <div className="row-caption zone-head">
          <span>
            {t('Assist')} <span className="zone-note">{t('everything in this box counts as help')}</span>
          </span>
          <button
            className="zone-help"
            onClick={() => setHelp(true)}
            aria-label={t('What the buttons do')}
            title={t('What the buttons do')}
          >
            ?
          </button>
        </div>
        <span className="row-sub">{t('Reveals logic')}</span>
        <div className="action-row">
          <button onClick={guarded('Hint', requestHint)} title={t('Hint (H): names the technique first, reveals it only if you ask')}>
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
              title={t('Show every step of one complete solution and jump to any point. Counts as assistance')}
            >
              <span className="btn-icon" aria-hidden="true">≡</span><span>{t('Steps')}</span>
            </button>
          )}
          {onScan && (
            <button
              onClick={guarded('Scan', onScan)}
              title={t('List every technique available in this exact position, not just the easiest. Counts as assistance')}
            >
              <span className="btn-icon" aria-hidden="true">🔎</span><span>{t('Scan')}</span>
            </button>
          )}
          <button
            onClick={guarded('Chain', startChain)}
            title={t('Build a chain yourself, candidate by candidate; the engine checks each link and says what it proves. Counts as assistance')}
          >
            <span className="btn-icon" aria-hidden="true">⛓</span><span>{t('Chain')}</span>
          </button>
        </div>

        <span className="row-sub">{t('Writes marks for you')}</span>
        <div className="action-row">
          <button
            className={autoCandidates ? 'toggled' : ''}
            onClick={autoCandidates ? onAutoToggle : guarded('Auto candidates', onAutoToggle)}
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
      )}

      {pending && (
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

      {help && (
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

      {autoOffPrompt && (
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
