// Settings dialog (gear) and help dialog (ⓘ): user preferences and a
// reference for modes, shortcuts and the candidate model.
import React from 'react';
import { useSettings, MarkLayer } from '../state/settings';
import { Modal } from './Dialogs';

function Toggle({
  label,
  hint,
  value,
  onChange,
  disabled = false
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`setting-row ${disabled ? 'disabled' : ''}`}>
      <div className="setting-text">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <button
        role="switch"
        aria-checked={value}
        disabled={disabled}
        className={`switch ${value ? 'on' : ''}`}
        onClick={() => onChange(!value)}
      >
        <span className="knob" />
      </button>
    </label>
  );
}

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const s = useSettings();

  return (
    <Modal title="Settings" onClose={onClose}>
      <h4 className="setting-group">Appearance</h4>
      <Toggle
        label="Dark theme"
        hint="Switch between the dark and light board"
        value={s.theme === 'dark'}
        onChange={() => s.toggleTheme()}
      />
      <Toggle
        label="Highlight row, column and box"
        hint="Tint the units of the selected cell"
        value={s.highlightPeers}
        onChange={(v) => s.set({ highlightPeers: v })}
      />
      <Toggle
        label="Highlight matching digits"
        hint="Tint every cell holding the same digit as the selection"
        value={s.highlightSameDigit}
        onChange={(v) => s.set({ highlightSameDigit: v })}
      />
      <Toggle
        label="Show timer"
        value={s.showTimer}
        onChange={(v) => s.set({ showTimer: v })}
      />

      <h4 className="setting-group">Candidates</h4>
      <Toggle
        label="Keep candidates when turning auto off"
        hint="Writes the current candidate state into pencil marks so you continue where auto left off"
        value={s.autoOffMaterialize}
        onChange={(v) => s.set({ autoOffMaterialize: v })}
      />
      <label className={`setting-row ${s.autoOffMaterialize ? '' : 'disabled'}`}>
        <div className="setting-text">
          <span>Write them as</span>
          <small>
            Centre is the convention for exhaustive candidate lists; corner
            uses the digit-bound 3×3 layout that hint highlights align with
          </small>
        </div>
        <div className="segmented">
          {(['center', 'corner'] as MarkLayer[]).map((layer) => (
            <button
              key={layer}
              disabled={!s.autoOffMaterialize}
              className={s.materializeLayer === layer ? 'active' : ''}
              onClick={() => s.set({ materializeLayer: layer })}
            >
              {layer === 'center' ? 'Centre' : 'Corner'}
            </button>
          ))}
        </div>
      </label>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ['1–9', 'Enter digit / mark / colour, depending on the mode'],
  ['Shift + 1–9', 'Corner mark (from any mode)'],
  ['Alt + 1–9', 'Centre mark (from any mode)'],
  ['Z / X / C / V', 'Switch mode: Digit / Corner / Centre / Colour'],
  ['Arrow keys', 'Move the selection (Shift extends it)'],
  ['Click + drag', 'Select multiple cells'],
  ['Ctrl/Cmd + click', 'Add cells to the selection'],
  ['Double-click a digit', 'Select every cell with that digit'],
  ['Backspace / Delete', "Erase the current mode's layer"],
  ['Shift + Backspace', 'Wipe a cell completely'],
  ['Ctrl/Cmd + Z · Y', 'Undo · Redo'],
  ['H', 'Hint'],
  ['P', 'Pause'],
  ['Escape', 'Clear the selection']
];

export function InfoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to play sudokUI" onClose={onClose}>
      <h4 className="setting-group">Entry modes</h4>
      <p className="dialog-note">
        <strong>Digit</strong> places big numbers. <strong>Corner</strong> is
        for Snyder-style notation — small marks at the digit's fixed 3×3 spot,
        meaningful by presence. <strong>Centre</strong> holds an exhaustive
        candidate list — a missing digit means you have eliminated it.{' '}
        <strong>Colour</strong> paints cells from a nine-colour palette (a
        cell can hold several colours).
      </p>

      <h4 className="setting-group">Candidates</h4>
      <p className="dialog-note">
        <em>Fill cands</em> fills the current mode's layer — with several
        cells selected, only those. <em>Auto cands</em> computes and maintains
        candidates for you; your centre-mark eliminations are adopted when you
        turn it on, and pencil input strikes candidates through while it's
        active. Turning it off can hand the state back as marks (see
        Settings). <em>⇄ Marks</em> swaps corner and centre layers.{' '}
        <em>Check</em> flags wrong digits and candidate lists that lost the
        true digit.
      </p>

      <h4 className="setting-group">Hints & practice</h4>
      <p className="dialog-note">
        <em>Hint</em> first names the next technique, then shows and explains
        it on the board, then applies it if you want. <em>Practice</em>{' '}
        generates a puzzle that genuinely requires a chosen technique and
        skips you to the position where it is the next step.
      </p>

      <h4 className="setting-group">Keyboard</h4>
      <table className="shortcut-table">
        <tbody>
          {SHORTCUTS.map(([keys, what]) => (
            <tr key={keys}>
              <td>
                <kbd>{keys}</kbd>
              </td>
              <td>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dialog-note">
        On touch devices: tap to select, drag to multi-select, and use the
        on-screen mode and number buttons. Everything works offline once the
        app has loaded — install it from your browser menu for a full-screen
        experience.
      </p>
    </Modal>
  );
}
