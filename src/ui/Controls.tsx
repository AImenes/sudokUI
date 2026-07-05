import React from 'react';
import { useGame, EntryMode } from '../state/gameStore';
import { PALETTE } from './Grid';

const MODES: { id: EntryMode; label: string; key: string }[] = [
  { id: 'digit', label: 'Digit', key: 'Z' },
  { id: 'corner', label: 'Corner', key: 'X' },
  { id: 'center', label: 'Centre', key: 'C' },
  { id: 'color', label: 'Colour', key: 'V' }
];

export function Controls() {
  const mode = useGame((s) => s.mode);
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
  const requestHint = useGame((s) => s.requestHint);
  const check = useGame((s) => s.check);

  return (
    <div className="controls">
      <div className="mode-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`mode-btn ${mode === m.id ? 'active' : ''}`}
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
        <button onClick={erase} title="Erase (Backspace)">⌫ Erase</button>
      </div>
      <div className="action-row">
        <button onClick={requestHint} title="Hint (H)">💡 Hint</button>
        <button onClick={check} title="Check entered digits">✓ Check</button>
        <button
          className={autoCandidates ? 'toggled' : ''}
          onClick={toggleAutoCandidates}
          title="Show computed candidates in a 3×3 layout (HoDoKu style)"
        >
          ⚙ Auto cands
        </button>
        <button onClick={fillCandidates} title="Fill centre marks with all candidates">
          ✎ Fill cands
        </button>
      </div>
    </div>
  );
}
