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
      <label className="setting-row">
        <div className="setting-text">
          <span>Theme</span>
          <small>
            Rosé keeps candidate and hint colours unchanged, so nothing about
            solving reads differently
          </small>
        </div>
        <div className="segmented">
          {(
            [
              ['dark', 'Dark'],
              ['light', 'Daylight'],
              ['rose', 'Rosé']
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={s.theme === value ? 'active' : ''}
              onClick={() => s.set({ theme: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </label>
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
      <Toggle
        label="Hide difficulty while playing"
        hint="No badge, no rating — revealed when you solve the puzzle. Pairs well with 'Surprise me' in New game"
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
      <Toggle
        label="Corner marks are a complete list"
        hint="Hint and Scan already read your centre marks. Turn this on only if you also fill every candidate in the corner layer — then they read those too. Leave off for Snyder notation, where a missing corner mark means nothing."
        value={s.cornerMarksExhaustive}
        onChange={(v) => s.set({ cornerMarksExhaustive: v })}
      />
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
  ['Backspace / Delete', 'Erase the active layer — hold Shift for corner marks, Ctrl for centre, both for colours'],
  ['W', 'Wipe the selected cells completely'],
  ['Ctrl/Cmd + A', 'Select every cell (Erase and W then act board-wide)'],
  ['Ctrl/Cmd + Z · Y', 'Undo · Redo'],
  ['H', 'Hint'],
  ['S', 'Swap corner ↔ centre marks (selection, or the whole board)'],
  ['N', 'Next practice puzzle (in practice mode)'],
  ['P', 'Pause'],
  ['D or Escape', 'Clear the selection (D works in fullscreen, where Escape leaves fullscreen)'],
  ['Shift + click', 'Add a cell to the selection — or remove one that is already selected']
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
        <em>Fill</em> fills the current mode's layer — with cells selected,
        only those. <em>Auto</em> computes and maintains candidates for you;
        your centre-mark eliminations are adopted when you turn it on, and
        pencil input strikes candidates through while it's active. Turning it
        off can hand the state back as marks (see Settings). <em>Swap</em>{' '}
        exchanges corner and centre layers. <em>Check</em> flags wrong digits
        and candidate lists that lost the true digit.
      </p>
      <p className="dialog-note">
        The <strong>highlight you use changes what the engine sees.</strong>{' '}
        <strong>Hint</strong> and <strong>Scan</strong> read your{' '}
        <strong>centre</strong> marks as an exhaustive list, so they continue
        from the eliminations you have already made rather than re-suggesting
        them. Corner marks are Snyder-style (partial) — their absence can't
        mean "eliminated", so press <em>Swap</em> to move them into centre, or,
        if you fill every candidate in corners, turn on{' '}
        <em>"Corner marks are a complete list"</em> in Settings to have them
        counted too.
      </p>

      <h4 className="setting-group">Difficulty rating</h4>
      <p className="dialog-note">
        The rating is the summed cost of solving the puzzle: sudokUI plays it
        using the cheapest applicable technique at every step and adds each
        technique's score (naked single 4 … Death Blossom 360). Scores follow
        HoDoKu, so ratings are directly comparable. The bands:
      </p>
      <table className="shortcut-table">
        <tbody>
          <tr><td><kbd>Beginner</kbd></td><td>≤ 400 — full houses and easy singles</td></tr>
          <tr><td><kbd>Easy</kbd></td><td>≤ 800 — singles only territory</td></tr>
          <tr><td><kbd>Medium</kbd></td><td>≤ 1000 — locked candidates, subsets</td></tr>
          <tr><td><kbd>Tricky</kbd></td><td>≤ 1150 — a first fish, wing or kite</td></tr>
          <tr><td><kbd>Hard</kbd></td><td>≤ 1600 — fish, wings, patterns in force</td></tr>
          <tr><td><kbd>Unfair</kbd></td><td>≤ 1800 — chains, ALS, finned fish</td></tr>
          <tr><td><kbd>Extreme</kbd></td><td>≤ 3000 — long chains, colouring, nets</td></tr>
          <tr><td><kbd>Nightmare</kbd></td><td>above — forcing nets and Exocets</td></tr>
        </tbody>
      </table>

      <h4 className="setting-group">Hints & practice</h4>
      <p className="dialog-note">
        <em>Hint</em> first names the next technique, then shows and explains
        it on the board, then applies it if you want. <em>Steps</em> lists a
        complete solution path with its crux, and <em>Scan</em> lists every
        technique available in the exact current position — not just the
        cheapest — so you can hunt the pattern you prefer. <em>Practice</em>{' '}
        generates a puzzle that genuinely requires a chosen technique and
        skips you to the position where it applies (optional, see Settings);
        press N for the next one.
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
        on-screen mode and number buttons. Tap the selected cell again — or
        anywhere beside the board — to clear the highlight, and long-press a
        digit to highlight all of its cells. Everything works
        offline once the app has loaded — install it from your browser menu
        (on iPhone: Share → Add to Home Screen) for a full-screen experience.
      </p>
      <p className="dialog-note">
        sudokUI is open source —{' '}
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
