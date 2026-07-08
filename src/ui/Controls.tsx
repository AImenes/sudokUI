// The control panel: mode switcher (digit/corner/centre/colour), number pad
// (doubles as the colour palette in colour mode), undo/redo/erase and the
// candidate tools (hint, check, auto candidates, fill, convert).
import React, { useState } from 'react';
import { useGame, EntryMode } from '../state/gameStore';
import { useSettings, MarkLayer } from '../state/settings';
import { Modal } from './Dialogs';
import { PALETTE } from './Grid';

function eraseTitle(mode: EntryMode, auto: boolean): string {
  if (mode === 'color') return 'Erase colours in selected cells (Backspace) · Shift+Backspace wipes everything';
  if (mode === 'corner' || mode === 'center') {
    return auto
      ? 'Restore struck candidates in selected cells (Backspace) · Shift+Backspace wipes everything'
      : `Erase ${mode === 'corner' ? 'corner' : 'centre'} marks in selected cells (Backspace) · Shift+Backspace wipes everything`;
  }
  return 'Erase value, then marks, then colours (Backspace) · Shift+Backspace wipes everything';
}

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
            {m.label}
            <span className="key-hint">{m.key}</span>
          </button>
        ))}
      </div>

      <div className="numpad">
        {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => (
          <button
            key={d}
            className={`num-btn ${mode === 'color' ? 'color-btn' : ''}`}
            style={
              mode === 'color'
                ? { background: PALETTE[d - 1], color: '#10131c' }
                : undefined
            }
            onClick={() => input(d)}
          >
            {mode === 'color' ? '' : d}
          </button>
        ))}
      </div>

      <div className="action-row">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">↩ Undo</button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">↪ Redo</button>
        <button onClick={erase} title={eraseTitle(effectiveMode, autoCandidates)}>⌫ Erase</button>
      </div>

      <div className="row-caption">Assist</div>
      <div className="action-row">
        <button onClick={requestHint} title="Hint (H) — names the technique first, reveals it only if you ask">💡 Hint</button>
        <button onClick={check} title="Check values and candidate lists against the solution">✓ Check</button>
        {onShowSteps && (
          <button
            onClick={onShowSteps}
            title="Show every step of one complete solution and jump to any point — counts as assistance"
          >
            ≡ Steps
          </button>
        )}
        {onScan && (
          <button
            onClick={onScan}
            title="List every technique available in this exact position, not just the cheapest — counts as assistance"
          >
            🔎 Scan
          </button>
        )}
      </div>

      <div className="row-caption">Candidates</div>
      <div className="action-row">
        <button
          className={autoCandidates ? 'toggled' : ''}
          onClick={onAutoToggle}
          title={
            autoCandidates
              ? 'Turn off — where the candidates go is configurable in Settings, and Ctrl+Z reverts'
              : 'Maintain candidates automatically (keeps your centre-mark eliminations); strike digits with pencil input'
          }
        >
          ⌗ Auto
        </button>
        <button
          onClick={fillCandidates}
          title={`Fill ${effectiveMode === 'corner' ? 'corner' : 'centre'} marks with all candidates — with several cells selected, only those are filled`}
        >
          ✎ Fill
        </button>
        <button
          onClick={convertMarks}
          title="Swap corner and centre marks (S) — with cells selected, only those are converted"
        >
          ⇄ Swap
        </button>
      </div>

      {autoOffPrompt && (
        <Modal title="Keep your candidates?" onClose={() => setAutoOffPrompt(false)}>
          <p className="dialog-note">
            Turning auto candidates off can write the current candidate state
            into pencil marks, so you continue exactly where auto left off.
            Your choice becomes the default — change it anytime in Settings.
          </p>
          <div className="level-list">
            <button className="level-btn" onClick={() => chooseAutoOff('center')}>
              <strong>Centre marks</strong>
              <span>The convention for full candidate lists — recommended</span>
            </button>
            <button className="level-btn" onClick={() => chooseAutoOff('corner')}>
              <strong>Corner marks</strong>
              <span>The digit-bound 3×3 layout that hint highlights align with</span>
            </button>
            <button className="level-btn" onClick={() => chooseAutoOff('none')}>
              <strong>Don't fill anything</strong>
              <span>Just switch off — your own marks stay as they were</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
