// The control panel: mode switcher (digit/corner/centre/colour), number pad
// (doubles as the colour palette in colour mode), undo/redo/erase and the
// candidate tools (hint, check, auto candidates, fill, convert).
import React, { useState } from 'react';
import { useT } from '../content/i18n';
import { useGame, EntryMode } from '../state/gameStore';
import { useSettings, MarkLayer } from '../state/settings';
import { Modal } from './Dialogs';
import { PALETTE } from './Grid';

function eraseTitle(mode: EntryMode, auto: boolean): string {
  if (mode === 'color') return 'Erase colours in selected cells (Backspace) · W wipes everything';
  if (mode === 'corner' || mode === 'center') {
    return auto
      ? 'Restore struck candidates in selected cells (Backspace) · W wipes everything'
      : `Erase ${mode === 'corner' ? 'corner' : 'centre'} marks in selected cells (Backspace) · W wipes everything`;
  }
  return 'Erase value, then marks, then colours (Backspace) · W wipes everything';
}

/**
 * What every button does, in one line each. Shown by the "?" in the assist
 * box and, for the assists, in the question asked before the first one: a
 * touch screen has no hover, so a tooltip alone explains nothing there.
 */
const BUTTONS: { name: string; icon: string; text: string; assist?: true }[] = [
  { name: 'Undo', icon: '↩', text: 'Takes back your last action.' },
  { name: 'Redo', icon: '↪', text: 'Brings back what Undo took away.' },
  { name: 'Erase', icon: '⌫', text: 'Clears the selected cells: the digit first, then pencil marks, then colours.' },
  { name: 'Swap', icon: '⇄', text: 'Moves corner marks to the centre and centre marks to the corner. Notation only.' },
  { name: 'Hint', icon: '💡', text: 'Names the technique for the next step. It shows the step itself only if you ask.', assist: true },
  { name: 'Check', icon: '✓', text: 'Marks wrong digits, and pencil marks that have lost the true digit.', assist: true },
  { name: 'Steps', icon: '≡', text: 'Lists every step of one complete solution. You can jump to any of them.', assist: true },
  { name: 'Scan', icon: '🔎', text: 'Lists every technique that works in this exact position, not only the easiest.', assist: true },
  { name: 'Chain', icon: '⛓', text: 'You build a chain on the board, candidate by candidate; the engine checks each link and says what the chain proves.', assist: true },
  { name: 'Auto candidates', icon: '⌗', text: 'Works out the candidates of every cell and keeps them up to date as you play.', assist: true },
  { name: 'Fill candidates', icon: '✎', text: 'Writes every candidate into the empty cells as pencil marks, once.', assist: true }
];

const textOf = (name: string) => BUTTONS.find((b) => b.name === name)!.text;

const MODES: { id: EntryMode; label: string; key: string }[] = [
  { id: 'digit', label: 'Digit', key: 'Z' },
  { id: 'corner', label: 'Corner', key: 'X' },
  { id: 'center', label: 'Centre', key: 'C' },
  { id: 'color', label: 'Colour', key: 'V' }
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
            title={`${m.label} (${m.key})`}
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
            className={`num-btn ${effectiveMode === 'color' ? 'color-btn' : ''}${armedDigit === d ? ' armed' : ''}`}
            aria-pressed={armedDigit === d}
            title={armedDigit === d ? `${d} is armed: tap a cell to enter it, tap ${d} again to put it down` : `${d}. With nothing selected, arms ${d}: every ${d} lights up and a tap on a cell enters it`}
            style={
              effectiveMode === 'color'
                ? { background: PALETTE[d - 1], color: '#10131c' }
                : undefined
            }
            onClick={() => input(d)}
          >
            {effectiveMode === 'color' ? '' : d}
          </button>
        ))}
      </div>

      {/* history & notation: none of these count as help */}
      <div className="action-row">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩ {t('Undo')}</button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪ {t('Redo')}</button>
        <button onClick={erase} title={eraseTitle(effectiveMode, autoCandidates)}>⌫ {t('Erase')}</button>
        <button
          onClick={convertMarks}
          title="Swap corner and centre marks (S). Pure notation, never counts as help"
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
          <button onClick={guarded('Hint', requestHint)} title="Hint (H): names the technique first, reveals it only if you ask">
            <span className="btn-icon" aria-hidden="true">💡</span>
            <span>{t('Hint')}</span>
          </button>
          <button onClick={guarded('Check', check)} title="Check values and candidate lists against the solution">
            <span className="btn-icon" aria-hidden="true">✓</span>
            <span>{t('Check')}</span>
          </button>
          {onShowSteps && (
            <button
              onClick={guarded('Steps', onShowSteps)}
              title="Show every step of one complete solution and jump to any point. Counts as assistance"
            >
              <span className="btn-icon" aria-hidden="true">≡</span><span>{t('Steps')}</span>
            </button>
          )}
          {onScan && (
            <button
              onClick={guarded('Scan', onScan)}
              title="List every technique available in this exact position, not just the easiest. Counts as assistance"
            >
              <span className="btn-icon" aria-hidden="true">🔎</span><span>{t('Scan')}</span>
            </button>
          )}
          <button
            onClick={guarded('Chain', startChain)}
            title="Build a chain yourself, candidate by candidate; the engine checks each link and says what it proves. Counts as assistance"
          >
            <span className="btn-icon" aria-hidden="true">⛓</span><span>{t('Chain')}</span>
          </button>
        </div>

        <span className="row-sub">{t('Writes marks for you')}</span>
        <div className="action-row">
          <button
            className={autoCandidates ? 'toggled' : ''}
            onClick={autoCandidates ? onAutoToggle : guarded('Auto candidates', onAutoToggle)}
            title={
              autoCandidates
                ? 'Turn off. Where the candidates go is configurable in Settings, and Ctrl+Z reverts'
                : 'Maintain candidates automatically (keeps your centre-mark eliminations); strike digits with pencil input'
            }
          >
            <span className="btn-icon" aria-hidden="true">⌗</span><span>{t('Auto candidates')}</span>
          </button>
          <button
            onClick={guarded('Fill candidates', fillCandidates)}
            title={`Fill ${effectiveMode === 'corner' ? 'corner' : 'centre'} marks with all candidates. With several cells selected, only those are filled`}
          >
            <span className="btn-icon" aria-hidden="true">✎</span><span>{t('Fill candidates')}</span>
          </button>
        </div>
      </div>

      {pending && (
        <Modal title={`Use ${pending}?`} onClose={() => askAssist(null)}>
          <p className="dialog-note">{textOf(pending)}</p>
          <p className="dialog-note">
            Using it counts as help, so this solve will no longer be
            unassisted. Everything else stays as it is.
          </p>
          <div className="hint-actions">
            <button onClick={() => use(false)}>Use {pending}</button>
            <button className="ghost" onClick={() => askAssist(null)}>
              Cancel
            </button>
            <button className="ghost" onClick={() => use(true)}>
              Use, and stop asking
            </button>
          </div>
        </Modal>
      )}

      {help && (
        <Modal title="What the buttons do" onClose={() => setHelp(false)}>
          <dl className="learn-points button-help">
            {BUTTONS.map((b) => (
              <React.Fragment key={b.name}>
                <dt>
                  <span className="button-help-icon" aria-hidden="true">
                    {b.icon}
                  </span>
                  {b.name}
                  {b.assist && <span className="zone-note">counts as help</span>}
                </dt>
                <dd>{b.text}</dd>
              </React.Fragment>
            ))}
          </dl>
        </Modal>
      )}

      {autoOffPrompt && (
        <Modal title="Keep your candidates?" onClose={() => setAutoOffPrompt(false)}>
          <p className="dialog-note">
            When Auto is switched off, the candidates it was showing can stay
            on the board as your own pencil marks, so you continue exactly
            where Auto left off. Your choice becomes the default. Change it
            anytime in Settings.
          </p>
          <div className="level-list">
            <button className="level-btn" onClick={() => chooseAutoOff('center')}>
              <strong>Centre marks</strong>
              <span>A compact list in the middle of the cell (recommended)</span>
            </button>
            <button className="level-btn" onClick={() => chooseAutoOff('corner')}>
              <strong>Corner marks</strong>
              <span>Each digit in its own fixed spot, where hints highlight it</span>
            </button>
            <button className="level-btn" onClick={() => chooseAutoOff('none')}>
              <strong>Don't fill anything</strong>
              <span>Just switch off. Your own marks stay as they were</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
