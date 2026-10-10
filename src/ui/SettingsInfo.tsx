// Settings dialog (gear) and help dialog (ⓘ): user preferences and a
// reference for modes, shortcuts and the candidate model.
import React from 'react';
import { useSettings, MarkLayer, Font } from '../state/settings';
import { LANGS, useT, msg, rich } from '../content/i18n';
import { Modal } from './Dialogs';
import type { LearnTarget } from './Learn';
import { BandTable } from './BandTable';
import { RATING_SUMMARY } from '../content/rating';
import { useLearnLocale } from './useLearnLocale';

// The rating summary in the chosen language. English is at hand; a
// translation comes from the guide's own locale file (useLearnLocale.ts),
// so the guide's machinery (src/content/learnLocale.ts) stays out of the
// main chunk. Until it arrives, or if it cannot be fetched, the summary
// reads in English.
function useRatingSummary(): string {
  return useLearnLocale()?.rating.summary ?? RATING_SUMMARY;
}

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
  const t = useT();

  return (
    <Modal title={t('Settings')} onClose={onClose}>
      <div className="setting-row stack" role="group" aria-label={t('Language')}>
        <div className="setting-text">
          <span>{t('Language')}</span>
          <small>{t('The whole app, including hints and everything under Learn')}</small>
        </div>
        <div className="segmented">
          {LANGS.map((l) => (
            <button
              key={l.value}
              lang={l.tag}
              className={s.lang === l.value ? 'active' : ''}
              aria-pressed={s.lang === l.value}
              onClick={() => s.set({ lang: l.value })}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>
      <h4 className="setting-group">{t('Appearance')}</h4>
      <div className="setting-row stack" role="group" aria-label={t('Theme')}>
        <div className="setting-text">
          <span>{t('Theme')}</span>
          <small>
            {t(
              'Rosé and Forest keep candidate and hint colours unchanged, so nothing about solving reads differently'
            )}
          </small>
        </div>
        <div className="segmented">
          {(
            [
              ['dark', t('Dark')],
              ['light', t('Daylight')],
              ['rose', t('Rosé')],
              ['forest', t('Forest')]
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
      <div className="setting-row stack" role="group" aria-label={t('Board typeface')}>
        <div className="setting-text">
          <span>{t('Board typeface')}</span>
          <small>{t('For the digits and pencil marks on the board')}</small>
        </div>
        <div className="segmented">
          {(
            [
              ['classic', t('Classic')],
              ['rounded', t('Rounded')],
              ['serif', t('Serif')],
              ['mono', t('Mono')],
              ['hand', t('Hand')]
            ] as [Font, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              className={s.font === value ? 'active' : ''}
              aria-pressed={s.font === value}
              style={{ fontFamily: `var(--font-${value})` }}
              onClick={() => s.set({ font: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Toggle
        label={t('Highlight row, column and box')}
        hint={t('Shows which cells share a row, column or box with the selected cell')}
        value={s.highlightPeers}
        onChange={(v) => s.set({ highlightPeers: v })}
      />
      <Toggle
        label={t('Highlight matching digits')}
        hint={t(
          'Tint every cell holding the selected digit, and light up its pencil marks wherever you have written them'
        )}
        value={s.highlightSameDigit}
        onChange={(v) => s.set({ highlightSameDigit: v })}
      />
      <Toggle
        label={t('Frame highlighted pencil marks')}
        hint={t('Draw a thin box around the lit-up candidates too, since colour and bold alone are easy to miss')}
        value={s.frameHighlights}
        onChange={(v) => s.set({ frameHighlights: v })}
      />
      <Toggle
        label={t('Show conflicts')}
        hint={t(
          'Show a digit in red while it repeats within its row, column or box. A rule check on the board alone, never a look at the solution, so it does not count as help'
        )}
        value={s.showConflicts}
        onChange={(v) => s.set({ showConflicts: v })}
      />
      <Toggle
        label={t('Tint digits by value')}
        hint={t(
          'Each digit from 1 to 9 gets a slight colour of its own on the board, which makes patterns easier to see'
        )}
        value={s.digitTints}
        onChange={(v) => s.set({ digitTints: v })}
      />
      {s.digitTints && (
        <label className="setting-row setting-slider">
          <div className="setting-text">
            <span>{t('Tint strength')}</span>
            <small>{t('From a hint of colour to a clearly coloured digit')}</small>
          </div>
          <input
            type="range"
            min={10}
            max={80}
            step={5}
            value={s.tintStrength}
            onChange={(e) => s.set({ tintStrength: Number(e.target.value) })}
            aria-valuetext={t('{n} percent', { n: s.tintStrength })}
          />
          <output>{s.tintStrength}%</output>
        </label>
      )}
      <Toggle
        label={t('Show timer')}
        value={s.showTimer}
        onChange={(v) => s.set({ showTimer: v })}
      />
      <Toggle
        label={t('Hide difficulty while playing')}
        hint={t(
          "No badge and no rating until you solve the puzzle. Pairs well with '{surprise}' in {newGame}",
          { surprise: t('Surprise me'), newGame: t('New game') }
        )}
        value={s.hideRating}
        onChange={(v) => s.set({ hideRating: v })}
      />
      <Toggle
        label={t('Nutella the poodle')}
        hint={t('A small companion below the board')}
        value={s.showPoodle}
        onChange={(v) => s.set({ showPoodle: v })}
      />

      <h4 className="setting-group">{t('Assist')}</h4>
      <Toggle
        label={t('Ask before the first assist')}
        hint={t('Says what the button does, and protects an unassisted solve from a stray tap')}
        value={s.confirmAssist}
        onChange={(v) => s.set({ confirmAssist: v })}
      />

      <h4 className="setting-group">{t('Practice||the settings heading')}</h4>
      <Toggle
        label={t('Jump to the technique')}
        hint={t(
          'Practice puzzles skip the routine steps and start where the chosen technique applies; off = play from the very beginning'
        )}
        value={s.practiceFastForward}
        onChange={(v) => s.set({ practiceFastForward: v })}
      />

      <h4 className="setting-group">{t('Candidates')}</h4>
      <Toggle
        label={t('Keep candidates when Auto is switched off')}
        hint={t('The candidates Auto was showing stay on the board as your own pencil marks')}
        value={s.autoOffMaterialize}
        onChange={(v) => s.set({ autoOffMaterialize: v })}
      />
      <div
        className={`setting-row stack ${s.autoOffMaterialize ? '' : 'disabled'}`}
        role="group"
        aria-label={t('Write candidates as')}
      >
        <div className="setting-text">
          <span>{t('Write them as')}</span>
          <small>
            {t(
              'Centre: a compact list in the middle of the cell. Corner: each digit in its own fixed spot, which is where hints highlight it'
            )}
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
              {t(layer === 'center' ? 'Centre' : 'Corner')}
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

// keys and what they do; both columns are translated where the table is
// shown, and a key that is only key names (Space, Ctrl/Cmd + A) has no
// translation, so it stays as it is in every language
const SHORTCUTS: [string, string][] = [
  ['1–9', msg('Enter digit / mark / colour, depending on the mode')],
  [
    msg('1–9 with nothing selected'),
    msg(
      'Arm the digit: every cell and pencil mark of it lights up, and a tap on a cell enters it. The digit again, or Escape, puts it down'
    )
  ],
  [msg('Hold Shift'), msg('Corner-mark mode while held')],
  [msg('Hold Ctrl or Alt'), msg('Centre-mark mode while held')],
  [msg('Hold Shift + Ctrl/Alt'), msg('Colour mode while held')],
  ['Space', msg('Cycle through the modes')],
  ['Z / X / C / V', msg('Switch mode: Digit / Corner / Centre / Colour')],
  [msg('Arrow keys'), msg('Move the selection (Shift extends it)')],
  [msg('Click + drag'), msg('Select multiple cells')],
  [msg('Touch: drag'), msg('Select a run of cells (on a phone a vertical swipe scrolls the page: rest a moment first to drag in any direction)')],
  [msg('Touch: hold a number'), msg('Enter it as a corner mark, whatever the mode')],
  [msg('Alt + drag'), msg('Select a rectangle, from the first cell to the one under the pointer (Option on a Mac)')],
  [msg('Ctrl/Cmd + click'), msg('Add cells to the selection')],
  [msg('Double-click / long-press a digit'), msg('Select every cell with that digit')],
  ['Backspace / Delete', msg('Erase the active layer: hold Shift for corner marks, Ctrl for centre, both for colours')],
  ['W', msg('Wipe the selected cells completely')],
  ['Ctrl/Cmd + A', msg('Select every cell (Erase and W then act board-wide)')],
  ['Ctrl/Cmd + Z · Y', msg('Undo · Redo')],
  ['H', msg('Hint: names the technique; again shows it on the board; again applies it')],
  ['L', msg('Learn: every technique explained, glossary, rating')],
  ['S', msg('Swap corner ↔ centre marks (selection, or the whole board)')],
  ['N', msg('Next practice puzzle (in practice mode)')],
  ['P', msg('Pause')],
  [msg('D or Escape'), msg('Clear the selection (D works in fullscreen, where Escape leaves fullscreen)')],
  [msg('Shift + click'), msg('Add a cell to the selection, or remove one that is already selected')]
];

const REPO = 'github.com/AImenes/sudokUI';

export function InfoDialog({
  onClose,
  onLearn
}: {
  onClose: () => void;
  /** jump to the Learn dialog (techniques, glossary, rating) */
  onLearn: (target: LearnTarget) => void;
}) {
  const t = useT();
  const ratingSummary = useRatingSummary();
  return (
    <Modal title={t('How to play sudokUI')} onClose={onClose}>
      <h4 className="setting-group">{t('The basics')}</h4>
      <p className="dialog-note">
        {t(
          'Fill the grid so that every row, every column and every 3×3 box holds the digits 1 to 9 once each. Select a cell, then type or tap a digit. Pencil marks, also called candidates, are small notes of the digits a cell could still hold.'
        )}
      </p>
      <p className="dialog-note">
        {rich(t('New to a word or a technique? {techniques} and the {glossary} live under Learn → Theory, below the board.'), {
          techniques: (
            <button className="learn-link" onClick={() => onLearn({ tab: 'techniques' })}>
              {t('Every technique explained||the link in the help')}
            </button>
          ),
          glossary: (
            <button className="learn-link" onClick={() => onLearn({ tab: 'glossary' })}>
              {t('glossary||the link in the help')}
            </button>
          )
        })}
      </p>
      <h4 className="setting-group">{t('Entry modes')}</h4>
      <p className="dialog-note">
        {rich(
          t(
            "{digit} places big numbers. {corner} and {centre} are two places to write pencil marks: corner marks sit at each digit's fixed spot in a 3×3 layout, centre marks are listed in the middle of the cell. Use either or both; what they mean is yours to decide. {colour} paints cells from a nine-colour palette (a cell can hold several colours)."
          ),
          {
            digit: <strong>{t('Digit')}</strong>,
            corner: <strong>{t('Corner')}</strong>,
            centre: <strong>{t('Centre')}</strong>,
            colour: <strong>{t('Colour')}</strong>
          }
        )}
      </p>

      <h4 className="setting-group">{t('Candidates')}</h4>
      <p className="dialog-note">
        {rich(
          t(
            "{fill} fills the corner marks in Corner mode and the centre marks in any other mode; with empty cells selected, only those. {auto} computes and maintains candidates for you; your centre-mark eliminations are adopted when you turn it on, and pencil input strikes candidates through while it's active. Turning it off can hand the state back as marks (see Settings). New games start with Auto off, so switching it on is a per-game choice and the daily is a fair race. A practice puzzle that jumps straight to its technique is the exception: it starts with Auto on. {swap} exchanges corner and centre layers. {check} flags wrong digits and candidate lists that lost the true digit."
          ),
          {
            fill: <em>{t('Fill||the Fill candidates button, in the help')}</em>,
            auto: <em>{t('Auto||the Auto candidates button, in the help')}</em>,
            swap: <em>{t('Swap')}</em>,
            check: <em>{t('Check')}</em>
          }
        )}
      </p>

      <h4 className="setting-group">{t('Difficulty rating')}</h4>
      <p className="dialog-note">
        {ratingSummary}{' '}
        <button className="learn-link" onClick={() => onLearn({ tab: 'rating' })}>
          {t('How rating works, in full')}
        </button>
      </p>
      <BandTable />

      <h4 className="setting-group">{t('Hints & practice')}</h4>
      <p className="dialog-note">
        {rich(
          t(
            '{hint} first names the next technique, then shows and explains it on the board, then applies it if you want. {steps} lists a complete solution path with its crux, and {scan} lists every technique available in the exact current position, not just the easiest, so you can hunt the pattern you prefer. {practice} generates a puzzle that genuinely requires a chosen technique and skips you to the position where it applies (optional, see Settings); press N for the next one.'
          ),
          {
            hint: <em>{t('Hint')}</em>,
            steps: <em>{t('Steps')}</em>,
            scan: <em>{t('Scan')}</em>,
            practice: <em>{t('Practice')}</em>
          }
        )}
      </p>
      <p className="dialog-note">
        <strong>{t('Hints follow your own play.')}</strong>{' '}
        {t(
          'A missing pencil mark can mean "eliminated" or just "not written yet", and only you know which, so the first time Hint or Scan meets your manual marks it asks once, and remembers for the rest of the puzzle.'
        )}
      </p>
      <p className="dialog-note">
        {rich(
          t(
            'Say your marks are your {remaining} and hints continue from exactly where you are. Corner or centre makes no difference, since those are positions, not meanings (Snyder notation is a {method}: partial corner marks, which is the other answer). Auto and a whole-board Fill answer the question automatically.'
          ),
          {
            remaining: <em>{t('remaining candidates||the answer, in the help')}</em>,
            method: <em>{t('method||Snyder notation is a method, in the help')}</em>
          }
        )}
      </p>
      <p className="dialog-note">
        {t(
          'Every hint is verified against the true solution before it is shown, so a stray mark can point you to Check but can never produce a wrong hint.'
        )}
      </p>
      <p className="dialog-note">
        {rich(
          t(
            'An {unassisted} means finishing without anything from the Assist box: no hint, check, steps, scan, chain, auto candidates or fill.'
          ),
          { unassisted: <strong>{t('unassisted solve||in the help')}</strong> }
        )}
      </p>
      <p className="dialog-note">
        {t('Hints name cells by row and column: r2c3 is row 2, column 3, counted from the top left.')}
      </p>

      <h4 className="setting-group">{t('Touch')}</h4>
      <p className="dialog-note">
        {t(
          'Tap to select, and use the on-screen mode and number buttons. To select several cells, drag across them. On a phone a quick swipe up or down over the board scrolls the page instead: rest your finger on the first cell for a moment, then drag in any direction. Hold a number key for a moment to enter it as a corner mark without changing mode. Tap the selected cell again, or anywhere beside the board, to clear the highlight, and long-press a digit on the board to highlight all of its cells.'
        )}
      </p>

      <h4 className="setting-group">{t('Keyboard')}</h4>
      <table className="shortcut-table">
        <tbody>
          {SHORTCUTS.map(([keys, what]) => (
            <tr key={keys}>
              <td>
                <kbd>{t(keys)}</kbd>
              </td>
              <td>{t(what)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="setting-group">{t('Offline and install')}</h4>
      <p className="dialog-note">
        {t(
          'Everything works offline once the app has loaded. Install it from your browser menu (on iPhone: Share → Add to Home Screen) for a full-screen experience.'
        )}
      </p>
      <p className="dialog-note">
        {rich(
          t(
            'sudokUI is open source at {link}. Bug reports, feature requests and technique contributions are very welcome.'
          ),
          {
            link: (
              <a href={`https://${REPO}`} target="_blank" rel="noreferrer">
                {REPO}
              </a>
            )
          }
        )}
      </p>
      <p className="dialog-note version-note">
        sudokUI v{__APP_VERSION__} ·{' '}
        <a
          href="https://github.com/AImenes/sudokUI/releases"
          target="_blank"
          rel="noreferrer"
        >
          {t("what's new")}
        </a>
      </p>
    </Modal>
  );
}
