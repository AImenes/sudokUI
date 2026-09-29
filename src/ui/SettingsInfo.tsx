// Settings dialog (gear) and help dialog (ⓘ): user preferences and a
// reference for modes, shortcuts and the candidate model.
import React from 'react';
import { useSettings, MarkLayer } from '../state/settings';
import { Modal } from './Dialogs';
import { BandTable, LearnTarget } from './Learn';
import { RATING_SUMMARY } from '../content/rating';

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
      <div className="setting-row stack" role="group" aria-label="Theme">
        <div className="setting-text">
          <span>Theme</span>
          <small>
            Rosé and Forest keep candidate and hint colours unchanged, so
            nothing about solving reads differently
          </small>
        </div>
        <div className="segmented">
          {(
            [
              ['dark', 'Dark'],
              ['light', 'Daylight'],
              ['rose', 'Rosé'],
              ['forest', 'Forest']
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={s.theme === value ? 'active' : ''}
              aria-pressed={s.theme === value}
              onClick={() => s.set({ theme: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Toggle
        label="Highlight row, column and box"
        hint="Shows which cells share a row, column or box with the selected cell"
        value={s.highlightPeers}
        onChange={(v) => s.set({ highlightPeers: v })}
      />
      <Toggle
        label="Highlight matching digits"
        hint="Tint every cell holding the selected digit, and light up its pencil marks wherever you have written them"
        value={s.highlightSameDigit}
        onChange={(v) => s.set({ highlightSameDigit: v })}
      />
      <Toggle
        label="Frame highlighted pencil marks"
        hint="Draw a thin box around the lit-up candidates too, since colour and bold alone are easy to miss"
        value={s.frameHighlights}
        onChange={(v) => s.set({ frameHighlights: v })}
      />
      <Toggle
        label="Show timer"
        value={s.showTimer}
        onChange={(v) => s.set({ showTimer: v })}
      />
      <Toggle
        label="Hide difficulty while playing"
        hint="No badge and no rating until you solve the puzzle. Pairs well with 'Surprise me' in New game"
        value={s.hideRating}
        onChange={(v) => s.set({ hideRating: v })}
      />
      <Toggle
        label="Nutella the poodle"
        hint="A small companion below the board"
        value={s.showPoodle}
        onChange={(v) => s.set({ showPoodle: v })}
      />

      <h4 className="setting-group">Practice</h4>
      <Toggle
        label="Jump to the technique"
        hint="Practice puzzles skip the routine steps and start where the chosen technique applies; off = play from the very beginning"
        value={s.practiceFastForward}
        onChange={(v) => s.set({ practiceFastForward: v })}
      />

      <h4 className="setting-group">Candidates</h4>
      <Toggle
        label="Keep candidates when Auto is switched off"
        hint="The candidates Auto was showing stay on the board as your own pencil marks"
        value={s.autoOffMaterialize}
        onChange={(v) => s.set({ autoOffMaterialize: v })}
      />
      <div
        className={`setting-row stack ${s.autoOffMaterialize ? '' : 'disabled'}`}
        role="group"
        aria-label="Write candidates as"
      >
        <div className="setting-text">
          <span>Write them as</span>
          <small>
            Centre: a compact list in the middle of the cell. Corner: each
            digit in its own fixed spot, which is where hints highlight it
          </small>
        </div>
        <div className="segmented">
          {(['center', 'corner'] as MarkLayer[]).map((layer) => (
            <button
              key={layer}
              disabled={!s.autoOffMaterialize}
              className={s.materializeLayer === layer ? 'active' : ''}
              aria-pressed={s.materializeLayer === layer}
              onClick={() => s.set({ materializeLayer: layer })}
            >
              {layer === 'center' ? 'Centre' : 'Corner'}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

const SHORTCUTS: [string, string][] = [
  ['1–9', 'Enter digit / mark / colour, depending on the mode'],
  ['Hold Shift', 'Corner-mark mode while held'],
  ['Hold Ctrl or Alt', 'Centre-mark mode while held'],
  ['Hold Shift + Ctrl/Alt', 'Colour mode while held'],
  ['Space', 'Cycle through the modes'],
  ['Z / X / C / V', 'Switch mode: Digit / Corner / Centre / Colour'],
  ['Arrow keys', 'Move the selection (Shift extends it)'],
  ['Click + drag', 'Select multiple cells'],
  ['Ctrl/Cmd + click', 'Add cells to the selection'],
  ['Double-click / long-press a digit', 'Select every cell with that digit'],
  ['Backspace / Delete', 'Erase the active layer: hold Shift for corner marks, Ctrl for centre, both for colours'],
  ['W', 'Wipe the selected cells completely'],
  ['Ctrl/Cmd + A', 'Select every cell (Erase and W then act board-wide)'],
  ['Ctrl/Cmd + Z · Y', 'Undo · Redo'],
  ['H', 'Hint'],
  ['L', 'Learn: every technique explained, glossary, rating'],
  ['S', 'Swap corner ↔ centre marks (selection, or the whole board)'],
  ['N', 'Next practice puzzle (in practice mode)'],
  ['P', 'Pause'],
  ['D or Escape', 'Clear the selection (D works in fullscreen, where Escape leaves fullscreen)'],
  ['Shift + click', 'Add a cell to the selection, or remove one that is already selected']
];

export function InfoDialog({
  onClose,
  onLearn
}: {
  onClose: () => void;
  /** jump to the Learn dialog (techniques, glossary, rating) */
  onLearn: (target: LearnTarget) => void;
}) {
  return (
    <Modal title="How to play sudokUI" onClose={onClose}>
      <h4 className="setting-group">The basics</h4>
      <p className="dialog-note">
        Fill the grid so that every row, every column and every 3×3 box holds
        the digits 1 to 9 once each. Select a cell, then type or tap a digit.
        Pencil marks, also called candidates, are small notes of the digits a
        cell could still hold.
      </p>
      <p className="dialog-note">
        New to a word or a technique?{' '}
        <button className="learn-link" onClick={() => onLearn({ tab: 'techniques' })}>
          Every technique explained
        </button>{' '}
        and the{' '}
        <button className="learn-link" onClick={() => onLearn({ tab: 'glossary' })}>
          glossary
        </button>{' '}
        live under 📖 in the top bar.
      </p>
      <h4 className="setting-group">Entry modes</h4>
      <p className="dialog-note">
        <strong>Digit</strong> places big numbers. <strong>Corner</strong>{' '}
        and <strong>Centre</strong> are two places to write pencil marks:
        corner marks sit at each digit's fixed spot in a 3×3 layout, centre
        marks are listed in the middle of the cell. Use either or both; what
        they mean is yours to decide.{' '}
        <strong>Colour</strong> paints cells from a nine-colour palette (a
        cell can hold several colours).
      </p>

      <h4 className="setting-group">Candidates</h4>
      <p className="dialog-note">
        <em>Fill</em> fills the current mode's layer; with cells selected,
        only those. <em>Auto</em> computes and maintains candidates for you;
        your centre-mark eliminations are adopted when you turn it on, and
        pencil input strikes candidates through while it's active. Turning it
        off can hand the state back as marks (see Settings). Every new game
        starts with Auto off, so switching it on is a per-game choice and the
        daily is a fair race. <em>Swap</em>{' '}
        exchanges corner and centre layers. <em>Check</em> flags wrong digits
        and candidate lists that lost the true digit.
      </p>

      <h4 className="setting-group">Difficulty rating</h4>
      <p className="dialog-note">
        {RATING_SUMMARY}{' '}
        <button className="learn-link" onClick={() => onLearn({ tab: 'rating' })}>
          How rating works, in full
        </button>
      </p>
      <BandTable />

      <h4 className="setting-group">Hints & practice</h4>
      <p className="dialog-note">
        <em>Hint</em> first names the next technique, then shows and explains
        it on the board, then applies it if you want. <em>Steps</em> lists a
        complete solution path with its crux, and <em>Scan</em> lists every
        technique available in the exact current position, not just the
        easiest, so you can hunt the pattern you prefer. <em>Practice</em>{' '}
        generates a puzzle that genuinely requires a chosen technique and
        skips you to the position where it applies (optional, see Settings);
        press N for the next one.
      </p>
      <p className="dialog-note">
        <strong>Hints follow your own play.</strong> A missing pencil mark can
        mean "eliminated" or just "not written yet", and only you know which, so
        the first time Hint or Scan meets your manual marks it asks once, and
        remembers for the rest of the puzzle.
      </p>
      <p className="dialog-note">
        Say your marks are your <em>remaining candidates</em> and hints
        continue from exactly where you are. Corner or centre makes no
        difference, since those are positions, not meanings (Snyder notation
        is a <em>method</em>: partial corner marks, which is the other
        answer). Auto and Fill answer the question automatically.
      </p>
      <p className="dialog-note">
        Every hint is verified against the true solution before it is shown,
        so a stray mark can point you to Check but can never produce a wrong
        hint.
      </p>
      <p className="dialog-note">
        A <strong>clean solve</strong> means finishing without anything from
        the Assist box: no hint, check, steps, scan, auto candidates or fill.
      </p>
      <p className="dialog-note">
        Hints name cells by row and column: r2c3 is row 2, column 3, counted
        from the top left.
      </p>

      <h4 className="setting-group">Touch</h4>
      <p className="dialog-note">
        Tap to select, drag to multi-select, and use the on-screen mode and
        number buttons. Tap the selected cell again, or anywhere beside the
        board, to clear the highlight, and long-press a digit to highlight
        all of its cells.
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
      <h4 className="setting-group">Offline and install</h4>
      <p className="dialog-note">
        Everything works offline once the app has loaded. Install it from
        your browser menu (on iPhone: Share → Add to Home Screen) for a
        full-screen experience.
      </p>
      <p className="dialog-note">
        sudokUI is open source at{' '}
        <a href="https://github.com/AImenes/sudokUI" target="_blank" rel="noreferrer">
          github.com/AImenes/sudokUI
        </a>
        . Bug reports, feature requests and technique contributions are very
        welcome.
      </p>
      <p className="dialog-note version-note">
        sudokUI v{__APP_VERSION__} ·{' '}
        <a
          href="https://github.com/AImenes/sudokUI/releases"
          target="_blank"
          rel="noreferrer"
        >
          what's new
        </a>
      </p>
    </Modal>
  );
}
