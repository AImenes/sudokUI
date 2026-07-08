// The active game: cell state, selection, entry modes, undo/redo, timer,
// hints and toasts. The candidate model implemented here:
//   corner marks  = notation (Snyder-style, partial by design)
//   centre marks  = exhaustive candidate list (absence = eliminated)
//   auto          = engine-computed list minus per-cell exclusions (strikes)
// engineGrid() bridges UI cell state to the engine's Grid for hints/fill/check.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Grid,
  emptyGrid,
  setValue,
  parseGrid,
  gridToString,
  bit,
  PEERS,
  UNITS
} from '../engine/board';
import { solve, countSolutions } from '../engine/bruteForce';
import { findNextStep, applyStep, ratePuzzle } from '../engine/humanSolver';
import { Step } from '../engine/steps';
import { Level, Tech } from '../engine/ratings';
import { useSettings } from './settings';

export type EntryMode = 'digit' | 'corner' | 'center' | 'color';

export interface CellState {
  given: boolean;
  value: number; // 0 = empty
  corner: number; // 9-bit candidate mask
  center: number; // 9-bit candidate mask
  excluded: number; // candidates removed from the auto-candidate view
  colors: number[]; // palette indices 0..8
}

const emptyCell = (): CellState => ({
  given: false,
  value: 0,
  corner: 0,
  center: 0,
  excluded: 0,
  colors: []
});

const cloneCells = (cells: CellState[]): CellState[] =>
  cells.map((c) => ({ ...c, colors: [...c.colors] }));

/** Engine view of the board: placed values + canonical candidates minus
 *  explicit exclusions. */
export function engineGrid(cells: CellState[]): Grid {
  const g = emptyGrid();
  for (let i = 0; i < 81; i++) {
    if (cells[i].value) {
      setValue(g, i, cells[i].value);
      if (cells[i].given) g.given[i] = 1;
    }
  }
  for (let i = 0; i < 81; i++) if (!cells[i].value) g.cands[i] &= ~cells[i].excluded;
  return g;
}

/**
 * The candidate grid the SOLVER reasons over. Like {@link engineGrid}, but in
 * manual play it also folds the player's own CENTRE marks in as eliminations,
 * so Hint and Scan continue from where the player is rather than re-deriving
 * moves already made by hand.
 *
 * Only centre marks are trusted: they are exhaustive by convention (a missing
 * digit is a deliberate elimination). Corner marks are Snyder notation —
 * partial by nature — so their absence means nothing and they are never used;
 * `Swap` moves them into the centre layer when the player wants them counted.
 * In auto mode the `excluded` set already carries the player's eliminations,
 * so this is identical to `engineGrid`. Marks are only intersected with the
 * canonical set, never allowed to add an impossible candidate.
 */
export function solverGrid(cells: CellState[], autoCandidates: boolean): Grid {
  const g = engineGrid(cells);
  if (autoCandidates) return g;
  for (let i = 0; i < 81; i++) {
    if (cells[i].value || !cells[i].center) continue;
    const folded = g.cands[i] & cells[i].center;
    if (folded) g.cands[i] = folded; // never zero a cell; the solution guard
    // in the callers catches a mark that dropped the true digit
  }
  return g;
}

/** True when a step never contradicts the known solution: every placement is
 *  the solution digit and no elimination removes it. A step derived from
 *  player marks that fails this can only mean the marks are corrupted, so
 *  callers redirect to Check rather than show an unsound hint. */
export function stepMatchesSolution(step: Step, solution: string): boolean {
  for (const { cell, digit } of step.placements) {
    if (Number(solution[cell]) !== digit) return false;
  }
  for (const { cell, digit } of step.eliminations) {
    if (Number(solution[cell]) === digit) return false;
  }
  return true;
}

/** The cell where a centre mark has dropped the true solution digit, or -1.
 *  Such a slip means the player's candidate set is wrong; Check pinpoints it. */
export function centreMarkSlip(cells: CellState[], solution: string): number {
  for (let i = 0; i < 81; i++) {
    const c = cells[i];
    if (c.value || !c.center) continue;
    if (!(c.center & bit(Number(solution[i])))) return i;
  }
  return -1;
}

export interface GameInfo {
  puzzle: string;
  solution: string;
  score: number;
  level: Level;
  practiceTech: Tech | null;
}

/** snapshot of the running game, restored if custom entry is cancelled */
interface GameBackup {
  info: GameInfo | null;
  cells: CellState[];
  autoCandidates: boolean;
  elapsedBefore: number;
  won: boolean;
}

interface GameStore {
  info: GameInfo | null;
  cells: CellState[];
  /** true while the user is typing in a custom puzzle */
  custom: boolean;
  customBackup: GameBackup | null;
  selection: number[];
  mode: EntryMode;
  /** hold-modifier override (Shift = corner, Ctrl/Alt = centre, both =
   *  colour); null = use `mode`. Never persisted. */
  tempMode: EntryMode | null;
  activeColor: number;
  autoCandidates: boolean;
  history: CellState[][];
  future: CellState[][];
  startedAt: number;
  elapsedBefore: number;
  paused: boolean;
  won: boolean;
  /** true once a DEDUCTIVE assist was used (hint, check, steps, scan,
   *  revert) — these reveal reasoning, so the solve is no longer "clean". */
  assisted: boolean;
  /** true once a bookkeeping aid was used (auto candidates or Fill) — no
   *  reasoning revealed, but the machine tracked candidates for you, so the
   *  solve is not "pure". Swapping corner↔centre never sets this. */
  usedAuto: boolean;
  hint: Step | null;
  hintStage: 'hidden' | 'tech' | 'full';
  errors: number[];
  /** transient toast message */
  notice: string | null;
  /** history index of the last error-free position, set by check() */
  revertIndex: number | null;

  startGame: (puzzle: string, score: number, level: Level, practiceTech?: Tech | null) => void;
  /** blank board the user types givens onto; the running game is backed up */
  startCustomEntry: () => void;
  cancelCustomEntry: () => void;
  /** validate + rate the entered givens and start playing; returns an error
   *  message instead when the puzzle is not a proper sudoku */
  finishCustomEntry: () => string | null;
  /** reset the current puzzle to its starting position, timer included */
  restart: () => void;
  select: (cells: number[], additive: boolean) => void;
  selectAllOf: (digit: number) => void;
  setMode: (mode: EntryMode) => void;
  setTempMode: (mode: EntryMode | null) => void;
  setActiveColor: (c: number) => void;
  input: (digit: number) => void;
  erase: () => void;
  wipe: () => void;
  clearNotice: () => void;
  undo: () => void;
  redo: () => void;
  toggleAutoCandidates: () => void;
  fillCandidates: () => void;
  convertMarks: () => void;
  requestHint: () => void;
  revealHint: () => void;
  applyHint: () => void;
  dismissHint: () => void;
  check: () => void;
  /** restore a full shared position from an `#s=` link payload; false if
   *  the payload is corrupt or its givens are not a proper puzzle */
  loadPosition: (encoded: string) => boolean;
  /** flag the game as assisted (e.g. the solution path was viewed) */
  markAssisted: () => void;
  /** display an arbitrary step as the current full hint (used by Scan) */
  showStep: (step: Step) => void;
  /** set the board to the position just before solve-path step `k` —
   *  study aid; marks the game assisted and turns auto candidates on */
  jumpToStep: (k: number) => void;
  /** jump back to the most recent error-free position (offered by check) */
  revertToValid: () => void;
  dismissRevert: () => void;
  togglePause: () => void;
  elapsedMs: () => number;
}

function checkWin(cells: CellState[], solution: string): boolean {
  for (let i = 0; i < 81; i++) {
    if (cells[i].value !== Number(solution[i])) return false;
  }
  return true;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      info: null,
      cells: Array.from({ length: 81 }, emptyCell),
      custom: false,
      customBackup: null as GameBackup | null,
      selection: [],
      mode: 'digit' as EntryMode,
      tempMode: null,
      activeColor: 0,
      autoCandidates: false,
      history: [],
      future: [],
      startedAt: Date.now(),
      elapsedBefore: 0,
      paused: false,
      won: false,
      assisted: false,
      usedAuto: false,
      hint: null,
      hintStage: 'hidden' as const,
      errors: [],
      notice: null,
      revertIndex: null as number | null,

      startGame: (puzzle, score, level, practiceTech = null) => {
        const g = parseGrid(puzzle);
        if (!g) return;
        const solved = solve(g);
        if (!solved) return;
        const cells = Array.from({ length: 81 }, (_, i) => {
          const cell = emptyCell();
          const ch = puzzle[i];
          if (ch !== '.' && ch !== '0') {
            cell.given = true;
            cell.value = Number(ch);
          }
          return cell;
        });
        // practice mode: fast-forward to the position where the target
        // technique is the next step (unless the user prefers playing from
        // the very start — see Settings)
        const fastForward = practiceTech && useSettings.getState().practiceFastForward;
        if (fastForward) {
          const eg = engineGrid(cells);
          for (let guard = 0; guard < 200; guard++) {
            const step = findNextStep(eg);
            if (!step || step.tech === practiceTech) break;
            applyStep(eg, step);
            for (const { cell, digit } of step.eliminations) {
              cells[cell].excluded |= bit(digit);
            }
            for (const { cell, digit } of step.placements) {
              cells[cell].value = digit;
            }
          }
        }
        set({
          info: {
            puzzle,
            solution: gridToString(solved),
            score,
            level,
            practiceTech
          },
          custom: false,
          customBackup: null,
          cells,
          selection: [],
          history: [],
          future: [],
          startedAt: Date.now(),
          elapsedBefore: 0,
          paused: false,
          won: false,
          assisted: false,
          // a fast-forwarded practice puzzle turns auto candidates on for you,
          // which is a bookkeeping aid — so that solve starts "not pure"
          usedAuto: !!fastForward,
          hint: null,
          hintStage: 'hidden',
          errors: [],
          // after a jump the candidate state must be visible to spot the pattern
          ...(fastForward ? { autoCandidates: true } : {})
        });
      },

      restart: () => {
        const s = get();
        if (!s.info) return;
        get().startGame(s.info.puzzle, s.info.score, s.info.level, s.info.practiceTech);
        set({ notice: 'Puzzle restarted' });
      },

      startCustomEntry: () => {
        const s = get();
        set({
          customBackup: {
            info: s.info,
            cells: cloneCells(s.cells),
            autoCandidates: s.autoCandidates,
            elapsedBefore: s.elapsedMs(),
            won: s.won
          },
          custom: true,
          info: null,
          cells: Array.from({ length: 81 }, emptyCell),
          selection: [],
          history: [],
          future: [],
          startedAt: Date.now(),
          elapsedBefore: 0,
          paused: false,
          won: false,
          hint: null,
          hintStage: 'hidden',
          errors: [],
          autoCandidates: false,
          mode: 'digit'
        });
      },

      cancelCustomEntry: () => {
        const b = get().customBackup;
        set({
          custom: false,
          customBackup: null,
          info: b?.info ?? null,
          cells: b?.cells ?? Array.from({ length: 81 }, emptyCell),
          autoCandidates: b?.autoCandidates ?? false,
          elapsedBefore: b?.elapsedBefore ?? 0,
          startedAt: Date.now(),
          won: b?.won ?? false,
          paused: b?.won ?? false,
          selection: [],
          history: [],
          future: [],
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
      },

      finishCustomEntry: () => {
        const s = get();
        const puzzle = s.cells.map((c) => (c.value ? String(c.value) : '.')).join('');
        const v = validatePuzzle(puzzle);
        if (!v.ok) return v.reason;
        set({ custom: false, customBackup: null });
        get().startGame(puzzle, v.score, v.level);
        set({ notice: `Puzzle checked: unique solution, rated ${v.score} (${v.level})` });
        return null;
      },

      select: (cells, additive) =>
        set((s) => ({
          selection: additive
            ? [...new Set([...s.selection, ...cells])]
            : cells,
          hint: s.hint,
          errors: s.errors
        })),

      selectAllOf: (digit) =>
        set((s) => ({
          selection: s.cells
            .map((c, i) => (c.value === digit ? i : -1))
            .filter((i) => i >= 0)
        })),

      setMode: (mode) => set({ mode }),
      setTempMode: (tempMode) =>
        set((s) => (s.tempMode === tempMode ? {} : { tempMode })),
      setActiveColor: (activeColor) => set({ activeColor, mode: 'color' }),

      input: (digit) => {
        const s = get();
        if (s.won || s.paused) return;
        const mode = s.tempMode ?? s.mode;
        const targets = s.selection.filter((i) => !s.cells[i].given || mode === 'color');
        if (!targets.length) return;
        const cells = cloneCells(s.cells);
        const history = [...s.history, cloneCells(s.cells)];
        let changed = false;

        if (mode === 'digit') {
          const editable = targets.filter((i) => !cells[i].given);
          const allSet = editable.length > 0 && editable.every((i) => cells[i].value === digit);
          for (const i of editable) {
            if (allSet) {
              cells[i].value = 0;
              changed = true;
            } else {
              cells[i].value = digit;
              cells[i].corner = 0;
              cells[i].center = 0;
              changed = true;
              // clear this digit from pencilmarks of peers
              for (const p of PEERS[i]) {
                cells[p].corner &= ~bit(digit);
                cells[p].center &= ~bit(digit);
              }
            }
          }
        } else if (mode === 'corner' || mode === 'center') {
          const editable = targets.filter((i) => !cells[i].given && !cells[i].value);
          if (s.autoCandidates) {
            // auto mode: pencil input strikes a candidate through (exclusion),
            // pressing again restores it
            const eg = engineGrid(cells);
            const relevant = editable.filter(
              (i) => eg.cands[i] & bit(digit) || cells[i].excluded & bit(digit)
            );
            const allExcluded =
              relevant.length > 0 &&
              relevant.every((i) => cells[i].excluded & bit(digit));
            for (const i of relevant) {
              if (allExcluded) cells[i].excluded &= ~bit(digit);
              else cells[i].excluded |= bit(digit);
              changed = true;
            }
          } else {
            const key = mode;
            const allHave =
              editable.length > 0 && editable.every((i) => cells[i][key] & bit(digit));
            for (const i of editable) {
              if (allHave) cells[i][key] &= ~bit(digit);
              else cells[i][key] |= bit(digit);
              changed = true;
            }
          }
        } else if (mode === 'color') {
          const colorIdx = digit - 1;
          const allHave = targets.every((i) => cells[i].colors.includes(colorIdx));
          for (const i of targets) {
            if (allHave) cells[i].colors = cells[i].colors.filter((c) => c !== colorIdx);
            else if (!cells[i].colors.includes(colorIdx)) cells[i].colors.push(colorIdx);
            changed = true;
          }
        }
        if (!changed) return;
        const won = s.info ? checkWin(cells, s.info.solution) : false;
        set({
          cells,
          history,
          future: [],
          won,
          hint: null,
          hintStage: 'hidden',
          errors: [],
          ...(won ? { elapsedBefore: get().elapsedMs(), paused: true } : {})
        });
      },

      /** Erase only the layer belonging to the current mode. Digit mode keeps
       *  the forgiving progressive behaviour: value, then marks, then colours. */
      erase: () => {
        const s = get();
        if (s.won || s.paused || !s.selection.length) return;
        const targets = s.selection.filter((i) => !s.cells[i].given);
        const cells = cloneCells(s.cells);
        let changed = false;

        const mode = s.tempMode ?? s.mode;
        if (mode === 'color') {
          for (const i of s.selection) {
            if (cells[i].colors.length) {
              cells[i].colors = [];
              changed = true;
            }
          }
        } else if (mode === 'corner' || mode === 'center') {
          if (s.autoCandidates) {
            // restore struck-through candidates
            for (const i of targets) {
              if (cells[i].excluded) {
                cells[i].excluded = 0;
                changed = true;
              }
            }
          } else {
            const key = mode;
            for (const i of targets) {
              if (cells[i][key]) {
                cells[i][key] = 0;
                changed = true;
              }
            }
          }
        } else {
          // digit mode: progressive
          for (const i of targets) {
            if (cells[i].value) {
              cells[i].value = 0;
              changed = true;
            } else if (cells[i].corner || cells[i].center) {
              cells[i].corner = 0;
              cells[i].center = 0;
              changed = true;
            }
          }
          if (!changed) {
            for (const i of s.selection) {
              if (cells[i].colors.length) {
                cells[i].colors = [];
                changed = true;
              }
            }
          }
        }
        if (!changed) return;
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
      },

      /** Wipe everything from the selected cells (Shift+Erase). */
      wipe: () => {
        const s = get();
        if (s.won || s.paused || !s.selection.length) return;
        const cells = cloneCells(s.cells);
        let changed = false;
        for (const i of s.selection) {
          const c = cells[i];
          if (
            (!c.given && (c.value || c.corner || c.center || c.excluded)) ||
            c.colors.length
          ) {
            if (!c.given) {
              c.value = 0;
              c.corner = 0;
              c.center = 0;
              c.excluded = 0;
            }
            c.colors = [];
            changed = true;
          }
        }
        if (!changed) return;
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
      },

      clearNotice: () => set({ notice: null }),

      undo: () => {
        const s = get();
        if (!s.history.length) return;
        const prev = s.history[s.history.length - 1];
        set({
          cells: prev,
          history: s.history.slice(0, -1),
          future: [cloneCells(s.cells), ...s.future],
          won: false,
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
      },

      redo: () => {
        const s = get();
        if (!s.future.length) return;
        const [next, ...rest] = s.future;
        set({
          cells: next,
          future: rest,
          history: [...s.history, cloneCells(s.cells)],
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
      },

      /**
       * Auto candidates on/off with a clean handover:
       * - ON: centre-mark eliminations are adopted as exclusions (centre marks
       *   are an exhaustive list; corner marks are notation and left alone).
       *   Impossible marks are dropped, and both events are reported.
       * - OFF: if the "write candidates to marks" setting is on, the current
       *   auto view is written into the configured mark layer so play
       *   continues exactly where auto left off.
       */
      toggleAutoCandidates: () => {
        const s = get();
        const cells = cloneCells(s.cells);
        let notice: string | null = null;

        if (!s.autoCandidates) {
          const eg = engineGrid(cells);
          let adopted = 0;
          let dropped = 0;
          for (let i = 0; i < 81; i++) {
            const c = cells[i];
            if (c.given || c.value || !c.center) continue;
            const missing = eg.cands[i] & ~c.center;
            if (missing) {
              c.excluded |= missing;
              adopted++;
            }
            if (c.center & ~eg.cands[i]) dropped++;
          }
          const parts: string[] = [];
          if (adopted) parts.push(`kept your eliminations in ${adopted} cell${adopted > 1 ? 's' : ''}`);
          if (dropped) parts.push(`dropped impossible marks in ${dropped} cell${dropped > 1 ? 's' : ''}`);
          if (parts.length) notice = `Auto candidates on — ${parts.join(', ')}`;
        } else {
          const { autoOffMaterialize, materializeLayer } = useSettings.getState();
          if (autoOffMaterialize) {
            const eg = engineGrid(cells);
            for (let i = 0; i < 81; i++) {
              if (!cells[i].given && !cells[i].value) cells[i][materializeLayer] = eg.cands[i];
            }
            notice = `Auto candidates off — current state written to ${
              materializeLayer === 'corner' ? 'corner' : 'centre'
            } marks (Ctrl+Z reverts)`;
          } else {
            notice = 'Auto candidates off';
          }
        }
        set({
          autoCandidates: !s.autoCandidates,
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          // turning auto ON is a bookkeeping aid; the flag is sticky
          usedAuto: s.usedAuto || !s.autoCandidates,
          notice
        });
      },

      /**
       * Fill candidates into the marks of the current mode (corner mode fills
       * corners, everything else fills centre). With 2+ cells selected only
       * those cells are filled — handy when your own logic is already
       * underway elsewhere. Wrong marks are corrected and reported.
       */
      fillCandidates: () => {
        const s = get();
        const g = engineGrid(s.cells);
        const cells = cloneCells(s.cells);
        const layer = (s.tempMode ?? s.mode) === 'corner' ? 'corner' : 'center';
        const scope = s.selection.filter((i) => !cells[i].given && !cells[i].value);
        const partial = scope.length >= 1;
        const targets = partial
          ? scope
          : Array.from({ length: 81 }, (_, i) => i).filter(
              (i) => !cells[i].given && !cells[i].value
            );
        let corrected = 0;
        for (const i of targets) {
          if (cells[i][layer] && cells[i][layer] !== g.cands[i]) corrected++;
          cells[i][layer] = g.cands[i];
        }
        const layerName = layer === 'corner' ? 'corner' : 'centre';
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          usedAuto: true, // Fill did the candidate bookkeeping for you
          notice: `Filled ${layerName} marks${partial ? ' in selection' : ''}${
            corrected ? ` — corrected ${corrected} cell${corrected > 1 ? 's' : ''}` : ''
          }`
        });
      },

      /**
       * Swap corner ↔ centre marks. With 2+ cells selected only those cells
       * are converted, otherwise every cell with marks. Swapping is
       * self-inverse and loses nothing — handy after auto-off wrote an
       * exhaustive list into the "wrong" layer for your style.
       */
      convertMarks: () => {
        const s = get();
        if (s.won || s.paused) return;
        const cells = cloneCells(s.cells);
        const scope = s.selection.filter((i) => !cells[i].given && !cells[i].value);
        const partial = scope.length >= 1;
        const targets = partial
          ? scope
          : Array.from({ length: 81 }, (_, i) => i).filter(
              (i) => !cells[i].given && !cells[i].value
            );
        let changed = 0;
        for (const i of targets) {
          const c = cells[i];
          if (!c.corner && !c.center) continue;
          [c.corner, c.center] = [c.center, c.corner];
          changed++;
        }
        if (!changed) return;
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          notice: `Swapped corner and centre marks in ${changed} cell${changed > 1 ? 's' : ''}${partial ? ' (selection)' : ''}`
        });
      },

      requestHint: () => {
        const s = get();
        if (!s.info || s.won) return;
        const sol = s.info.solution;
        // a centre mark that dropped the true digit corrupts the candidate
        // set — don't reason from it; that slip is Check's job to pinpoint
        if (!s.autoCandidates) {
          const slip = centreMarkSlip(s.cells, sol);
          if (slip >= 0) {
            set({
              hint: null,
              hintStage: 'hidden',
              assisted: true,
              notice: 'A pencil mark dropped a digit that belongs there — run Check to find it'
            });
            return;
          }
        }
        // reason from the player's own candidates (centre marks folded in)
        const step = findNextStep(solverGrid(s.cells, s.autoCandidates));
        if (step && stepMatchesSolution(step, sol)) {
          // even the technique's name is information — no longer a clean solve
          set({ hint: step, hintStage: 'tech', assisted: true });
        } else if (step) {
          // a technique fired but contradicts the solution: the marks misled
          // it (e.g. a uniqueness pattern faked by a wrong elimination)
          set({
            hint: null,
            hintStage: 'hidden',
            assisted: true,
            notice: 'Your pencil marks lead to an impossible deduction — run Check'
          });
        } else {
          set({ hint: null, hintStage: 'hidden' });
        }
      },

      revealHint: () => set({ hintStage: 'full' }),

      applyHint: () => {
        const s = get();
        const step = s.hint;
        if (!step) return;
        const cells = cloneCells(s.cells);
        for (const { cell, digit } of step.eliminations) {
          cells[cell].excluded |= bit(digit);
          cells[cell].corner &= ~bit(digit);
          cells[cell].center &= ~bit(digit);
        }
        for (const { cell, digit } of step.placements) {
          cells[cell].value = digit;
          cells[cell].corner = 0;
          cells[cell].center = 0;
          for (const p of PEERS[cell]) {
            cells[p].corner &= ~bit(digit);
            cells[p].center &= ~bit(digit);
          }
        }
        const won = s.info ? checkWin(cells, s.info.solution) : false;
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          hint: null,
          hintStage: 'hidden',
          won,
          ...(won ? { elapsedBefore: get().elapsedMs(), paused: true } : {})
        });
      },

      dismissHint: () => set({ hint: null, hintStage: 'hidden' }),

      /** Flags wrong values, plus cells whose candidate list (auto view or
       *  centre marks) no longer contains the solution digit. */
      check: () => {
        const s = get();
        if (!s.info) return;
        set({ assisted: true });
        const errors: number[] = [];
        const eg = s.autoCandidates ? engineGrid(s.cells) : null;
        for (let i = 0; i < 81; i++) {
          const sol = Number(s.info.solution[i]);
          const c = s.cells[i];
          if (c.value) {
            if (c.value !== sol) errors.push(i);
          } else if (eg) {
            if (!(eg.cands[i] & bit(sol))) errors.push(i);
          } else if (c.center && !(c.center & bit(sol))) {
            errors.push(i);
          }
        }
        // offer a jump back to the last position with no wrong values
        let revertIndex: number | null = null;
        if (errors.length) {
          for (let h = s.history.length - 1; h >= 0; h--) {
            const snap = s.history[h];
            let valid = true;
            for (let i = 0; i < 81 && valid; i++) {
              if (snap[i].value && snap[i].value !== Number(s.info.solution[i])) valid = false;
            }
            if (valid) {
              revertIndex = h;
              break;
            }
          }
        }
        set({
          errors,
          revertIndex,
          notice:
            errors.length === 0
              ? 'Everything checks out so far'
              : `${errors.length} problem${errors.length > 1 ? 's' : ''} found — values or candidate lists missing the true digit`
        });
      },

      revertToValid: () => {
        const s = get();
        if (s.revertIndex === null || !s.history[s.revertIndex]) return;
        set({
          cells: cloneCells(s.history[s.revertIndex]),
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          errors: [],
          revertIndex: null,
          hint: null,
          hintStage: 'hidden',
          notice: 'Back to the last correct position (Ctrl+Z restores your entries)'
        });
      },

      dismissRevert: () => set({ revertIndex: null }),

      loadPosition: (encoded) => {
        const decoded = decodePosition(encoded);
        if (!decoded) return false;
        const givens = decoded.cells
          .map((c) => (c.given ? String(c.value) : '.'))
          .join('');
        const v = validatePuzzle(givens);
        if (!v.ok) return false;
        // start the underlying game (computes the solution), then overlay
        // the shared progress: entries, marks, exclusions and colours
        get().startGame(givens, v.score, v.level);
        set({
          cells: decoded.cells,
          autoCandidates: decoded.autoCandidates,
          notice: 'Shared position loaded — entries, marks and colours included'
        });
        return true;
      },

      markAssisted: () => set({ assisted: true }),

      showStep: (step) => set({ hint: step, hintStage: 'full', assisted: true }),

      jumpToStep: (k) => {
        const s = get();
        if (!s.info) return;
        const steps = solvePath(s.info.puzzle);
        const cells = Array.from({ length: 81 }, (_, i) => {
          const cell = emptyCell();
          const ch = s.info!.puzzle[i];
          if (ch !== '.' && ch !== '0') {
            cell.given = true;
            cell.value = Number(ch);
          }
          return cell;
        });
        // replay the path up to (not including) step k, recording placements
        // as entries and eliminations as candidate exclusions — the same
        // mechanics practice fast-forward uses
        const eg = engineGrid(cells);
        for (let i = 0; i < k && i < steps.length; i++) {
          const step = steps[i];
          applyStep(eg, step);
          for (const { cell, digit } of step.eliminations) {
            cells[cell].excluded |= bit(digit);
          }
          for (const { cell, digit } of step.placements) {
            cells[cell].value = digit;
          }
        }
        set({
          cells,
          selection: [],
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          assisted: true,
          autoCandidates: true,
          won: false,
          hint: null,
          hintStage: 'hidden',
          errors: [],
          revertIndex: null,
          notice: `Jumped to step ${Math.min(k, steps.length - 1) + 1} of ${steps.length} — Ctrl+Z goes back`
        });
      },

      togglePause: () => {
        const s = get();
        if (s.won) return;
        if (s.paused) {
          set({ paused: false, startedAt: Date.now() });
        } else {
          set({ paused: true, elapsedBefore: s.elapsedMs() });
        }
      },

      elapsedMs: () => {
        const s = get();
        return s.paused ? s.elapsedBefore : s.elapsedBefore + (Date.now() - s.startedAt);
      }
    }),
    {
      name: 'sudokui-game-v1',
      partialize: (s) => ({
        info: s.info,
        cells: s.cells,
        // an in-progress custom entry survives a reload (its backup doesn't)
        custom: s.custom,
        autoCandidates: s.autoCandidates,
        elapsedBefore: s.elapsedMs(),
        won: s.won,
        assisted: s.assisted,
        usedAuto: s.usedAuto
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.startedAt = Date.now();
          state.paused = state.won; // stopped timer for finished games
        }
      }
    }
  )
);

// the full solve path of the current puzzle, cached — rating a hard puzzle
// can take a few hundred milliseconds and the path never changes
let pathCache: { puzzle: string; steps: Step[] } | null = null;

/** Ordered list of solver steps from the puzzle's start to its solution. */
export function solvePath(puzzle: string): Step[] {
  if (pathCache?.puzzle !== puzzle) {
    const rating = ratePuzzle(puzzle);
    pathCache = { puzzle, steps: rating?.steps ?? [] };
  }
  return pathCache.steps;
}

/* ---------- shareable position links (#s=<payload>) ----------
 * The full board state — entries, corner/centre marks, exclusions, colours
 * and the auto-candidates flag — bit-packed into a URL-safe string, so a
 * half-solved puzzle can be handed to someone exactly as it stands.
 * Worst case ≈ 450 characters; messengers handle that fine. */

const B64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SHARE_VERSION = 1;

class BitWriter {
  private bits: number[] = [];
  write(value: number, width: number) {
    for (let i = width - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  }
  toString() {
    let out = '';
    for (let i = 0; i < this.bits.length; i += 6) {
      let v = 0;
      for (let j = 0; j < 6; j++) v = (v << 1) | (this.bits[i + j] ?? 0);
      out += B64URL[v];
    }
    return out;
  }
}

class BitReader {
  private bits: number[] = [];
  private pos = 0;
  constructor(s: string) {
    for (const ch of s) {
      const v = B64URL.indexOf(ch);
      if (v < 0) throw new Error('bad character');
      for (let i = 5; i >= 0; i--) this.bits.push((v >> i) & 1);
    }
  }
  read(width: number) {
    let v = 0;
    for (let i = 0; i < width; i++) v = (v << 1) | (this.bits[this.pos++] ?? 0);
    return v;
  }
}

/** Pack a position for sharing. Layout per cell: given(1) value(4)
 *  colours(9), plus corner/centre/excluded (9 each) for open cells. */
export function encodePosition(cells: CellState[], autoCandidates: boolean): string {
  const w = new BitWriter();
  w.write(SHARE_VERSION, 4);
  w.write(autoCandidates ? 1 : 0, 1);
  for (const c of cells) {
    w.write(c.given ? 1 : 0, 1);
    w.write(c.value, 4);
    let colorMask = 0;
    for (const k of c.colors) colorMask |= 1 << k;
    w.write(colorMask, 9);
    if (!c.given && c.value === 0) {
      w.write(c.corner, 9);
      w.write(c.center, 9);
      w.write(c.excluded, 9);
    }
  }
  return w.toString();
}

/** Inverse of encodePosition; null for corrupt or foreign payloads. */
export function decodePosition(
  encoded: string
): { cells: CellState[]; autoCandidates: boolean } | null {
  try {
    const r = new BitReader(encoded);
    if (r.read(4) !== SHARE_VERSION) return null;
    const autoCandidates = r.read(1) === 1;
    const cells: CellState[] = [];
    for (let i = 0; i < 81; i++) {
      const given = r.read(1) === 1;
      const value = r.read(4);
      if (value > 9 || (given && value === 0)) return null;
      const colorMask = r.read(9);
      const colors: number[] = [];
      for (let k = 0; k < 9; k++) if (colorMask & (1 << k)) colors.push(k);
      const cell: CellState = { given, value, corner: 0, center: 0, excluded: 0, colors };
      if (!given && value === 0) {
        cell.corner = r.read(9);
        cell.center = r.read(9);
        cell.excluded = r.read(9);
      }
      cells.push(cell);
    }
    return { cells, autoCandidates };
  } catch {
    return null;
  }
}

export type PuzzleValidation =
  | { ok: true; score: number; level: Level }
  | { ok: false; reason: string };

/**
 * Full pre-play validation of a puzzle string: well-formed, no conflicting
 * givens, exactly one solution (brute-force counted), then rated. Shared by
 * the import dialog, custom entry and URL seeding. Synchronous — rating a
 * hard puzzle can take a few hundred milliseconds.
 */
export function validatePuzzle(puzzle: string): PuzzleValidation {
  const clues = [...puzzle].filter((ch) => ch >= '1' && ch <= '9').length;
  if (clues < 17) {
    return {
      ok: false,
      reason: `Only ${clues} given${clues === 1 ? '' : 's'} — a puzzle needs at least 17 to have a unique solution.`
    };
  }
  for (const unit of UNITS) {
    const seen = new Set<string>();
    for (const c of unit) {
      const ch = puzzle[c];
      if (ch < '1' || ch > '9') continue;
      if (seen.has(ch)) return { ok: false, reason: `Conflicting givens: two ${ch}s share a row, column or box.` };
      seen.add(ch);
    }
  }
  const g = parseGrid(puzzle);
  if (!g) return { ok: false, reason: 'That is not a valid puzzle.' };
  const solutions = countSolutions(g, 2);
  if (solutions === 0) return { ok: false, reason: 'The puzzle has no solution.' };
  if (solutions > 1) return { ok: false, reason: 'The puzzle has more than one solution.' };
  const rating = ratePuzzle(parseGrid(puzzle)!);
  if (!rating) return { ok: false, reason: 'The puzzle could not be rated.' };
  return { ok: true, score: rating.score, level: rating.level };
}

/** Rate an imported puzzle; null unless it is a proper unique-solution
 *  sudoku. Thin wrapper around `validatePuzzle` for the URL seeding path. */
export function rateImport(puzzle: string): { score: number; level: Level } | null {
  const v = validatePuzzle(puzzle);
  return v.ok ? { score: v.score, level: v.level } : null;
}
