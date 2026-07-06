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
  PEERS
} from '../engine/board';
import { solve } from '../engine/bruteForce';
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

export interface GameInfo {
  puzzle: string;
  solution: string;
  score: number;
  level: Level;
  practiceTech: Tech | null;
}

interface GameStore {
  info: GameInfo | null;
  cells: CellState[];
  selection: number[];
  mode: EntryMode;
  activeColor: number;
  autoCandidates: boolean;
  history: CellState[][];
  future: CellState[][];
  startedAt: number;
  elapsedBefore: number;
  paused: boolean;
  won: boolean;
  hint: Step | null;
  hintStage: 'hidden' | 'tech' | 'full';
  errors: number[];
  /** transient toast message */
  notice: string | null;

  startGame: (puzzle: string, score: number, level: Level, practiceTech?: Tech | null) => void;
  /** reset the current puzzle to its starting position, timer included */
  restart: () => void;
  select: (cells: number[], additive: boolean) => void;
  selectAllOf: (digit: number) => void;
  setMode: (mode: EntryMode) => void;
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
      selection: [],
      mode: 'digit' as EntryMode,
      activeColor: 0,
      autoCandidates: false,
      history: [],
      future: [],
      startedAt: Date.now(),
      elapsedBefore: 0,
      paused: false,
      won: false,
      hint: null,
      hintStage: 'hidden' as const,
      errors: [],
      notice: null,

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
          cells,
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
      setActiveColor: (activeColor) => set({ activeColor, mode: 'color' }),

      input: (digit) => {
        const s = get();
        if (s.won || s.paused) return;
        const targets = s.selection.filter((i) => !s.cells[i].given || s.mode === 'color');
        if (!targets.length) return;
        const cells = cloneCells(s.cells);
        const history = [...s.history, cloneCells(s.cells)];
        let changed = false;

        if (s.mode === 'digit') {
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
        } else if (s.mode === 'corner' || s.mode === 'center') {
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
            const key = s.mode;
            const allHave =
              editable.length > 0 && editable.every((i) => cells[i][key] & bit(digit));
            for (const i of editable) {
              if (allHave) cells[i][key] &= ~bit(digit);
              else cells[i][key] |= bit(digit);
              changed = true;
            }
          }
        } else if (s.mode === 'color') {
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

        if (s.mode === 'color') {
          for (const i of s.selection) {
            if (cells[i].colors.length) {
              cells[i].colors = [];
              changed = true;
            }
          }
        } else if (s.mode === 'corner' || s.mode === 'center') {
          if (s.autoCandidates) {
            // restore struck-through candidates
            for (const i of targets) {
              if (cells[i].excluded) {
                cells[i].excluded = 0;
                changed = true;
              }
            }
          } else {
            const key = s.mode;
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
        const layer = s.mode === 'corner' ? 'corner' : 'center';
        const scope = s.selection.filter((i) => !cells[i].given && !cells[i].value);
        const partial = scope.length >= 2;
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
        const partial = scope.length >= 2;
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
        const g = engineGrid(s.cells);
        const step = findNextStep(g);
        if (step) {
          set({ hint: step, hintStage: 'tech' });
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
        set({
          errors,
          notice:
            errors.length === 0
              ? 'Everything checks out so far'
              : `${errors.length} problem${errors.length > 1 ? 's' : ''} found — values or candidate lists missing the true digit`
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
        autoCandidates: s.autoCandidates,
        elapsedBefore: s.elapsedMs(),
        won: s.won
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

/** Rate an imported puzzle (synchronous; may take a moment on hard ones). */
export function rateImport(puzzle: string): { score: number; level: Level } | null {
  const g = parseGrid(puzzle);
  if (!g) return null;
  const rating = ratePuzzle(g);
  if (!rating) return null;
  return { score: rating.score, level: rating.level };
}
