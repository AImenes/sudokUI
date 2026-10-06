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
  { name: msg('Erase'), icon: '⌫', text: msg('Clears the selected cells: the digit first, then pencil marks, then colours.') },
  { name: msg('Swap'), icon: '⇄', text: msg('Moves corner marks to the centre and centre marks to the corner. Notation only.') },
  { name: msg('Hint'), icon: '💡', text: msg('Names the technique for the next step. It shows the step itself only if you ask.'), assist: true },
  { name: msg('Check'), icon: '✓', text: msg('Marks wrong digits, and pencil marks that have lost the true digit.'), assist: true },
  { name: msg('Steps'), icon: '≡', text: msg('Lists every step of one complete solution. You can jump to any of them.'), assist: true },
  { name: msg('Scan'), icon: '🔎', text: msg('Lists every technique that works in this exact position, not only the easiest.'), assist: true },
  { name: msg('Chain'), icon: '⛓', text: msg('You build a chain on the board, candidate by candidate; the engine checks each link and says what the chain proves.'), assist: true },
  { name: msg('Auto candidates'), icon: '⌗', text: msg('Works out the candidates of every cell and keeps them up to date as you play.'), assist: true },
  { name: msg('Fill candidates'), icon: '✎', text: msg('Writes every candidate into the empty cells as pencil marks, once.'), assist: true }
];

const textOf = (name: string) => BUTTONS.find((b) => b.name === name)!.text;

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

  // A number key tapped enters the digit in the current mode; held for a
  // moment it enters a corner mark whatever the mode, so a phone needs no
  // trip to the mode buttons for a pencil mark. The key shows the digit in
  // its corner while the hold lasts.
  const keyHold = useRef<{ digit: number; timer: number; fired: boolean } | null>(null);
  const lastKeyPointer = useRef(0);
  const [heldKey, setHeldKey] = useState<number | null>(null);
  const pressKey = (d: number) => {
    lastKeyPointer.current = Date.now();
    if (keyHold.current) window.clearTimeout(keyHold.current.timer);
    const hold = { digit: d, timer: 0, fired: false };
    hold.timer = window.setTimeout(() => {
      hold.fired = true;
      setHeldKey(d);
      navigator.vibrate?.(12);
      input(d, 'corner');
    }, 350);
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
  const [help, setHelp] = useState(false);

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

  const chooseAutoOff = (layer: MarkLayer | 'none') => {
    useSettings.getState().set(
      layer === 'none'
        ? { autoOffMaterialize: false, autoOffPromptDone: true }
        : { autoOffMaterialize: true, materializeLayer: layer, autoOffPromptDone: true }
    );
    setAutoOffPrompt(false);
    toggleAutoCandidates();
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
                : '{d}. Hold it to enter a corner mark. With nothing selected, arms {d}: every {d} lights up and a tap on a cell enters it',
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
            onClick={() => {
              // a pointer was handled above; this is the keyboard, or
              // assistive technology, pressing the button
              if (Date.now() - lastKeyPointer.current < 1000) return;
              input(d);
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
        <button
          onClick={convertMarks}
          title={t('Swap corner and centre marks (S). Pure notation, never counts as help')}
        >
          ⇄ {t('Swap')}
        </button>
      </div>

      {/* one group, one caption: everything inside counts as help, and
          the solve is no longer unassisted the moment any of it is used */}
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
              autoCandidates
                ? 'Turn off. Where the candidates go is configurable in Settings, and Ctrl+Z reverts'
                : 'Maintain candidates automatically (keeps your centre-mark eliminations); strike digits with pencil input'
            )}
          >
            <span className="btn-icon" aria-hidden="true">⌗</span><span>{t('Auto candidates')}</span>
          </button>
          <button
            onClick={guarded('Fill candidates', fillCandidates)}
            title={t(
              effectiveMode === 'corner'
                ? 'Fill corner marks with all candidates. With several cells selected, only those are filled'
                : 'Fill centre marks with all candidates. With several cells selected, only those are filled'
            )}
          >
            <span className="btn-icon" aria-hidden="true">✎</span><span>{t('Fill candidates')}</span>
          </button>
        </div>
      </div>

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
              'When Auto is switched off, the candidates it was showing can stay on the board as your own pencil marks, so you continue exactly where Auto left off. Your choice becomes the default. Change it anytime in Settings.'
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
