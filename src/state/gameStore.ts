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

  startGame: (puzzle: string, score: number, level: Level, practiceTech?: Tech | null) => void;
  select: (cells: number[], additive: boolean) => void;
  selectAllOf: (digit: number) => void;
  setMode: (mode: EntryMode) => void;
  setActiveColor: (c: number) => void;
  input: (digit: number) => void;
  erase: () => void;
  undo: () => void;
  redo: () => void;
  toggleAutoCandidates: () => void;
  fillCandidates: () => void;
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
        // technique is the next step
        if (practiceTech) {
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
          // practice needs the candidate state visible to spot the pattern
          ...(practiceTech ? { autoCandidates: true } : {})
        });
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
          const key = s.mode;
          const editable = targets.filter((i) => !cells[i].given && !cells[i].value);
          const allHave = editable.length > 0 && editable.every((i) => cells[i][key] & bit(digit));
          for (const i of editable) {
            if (allHave) cells[i][key] &= ~bit(digit);
            else cells[i][key] |= bit(digit);
            changed = true;
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

      erase: () => {
        const s = get();
        if (s.won || s.paused) return;
        const targets = s.selection.filter((i) => !s.cells[i].given);
        const colorTargets = s.selection;
        if (!colorTargets.length) return;
        const cells = cloneCells(s.cells);
        let changed = false;
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
          for (const i of colorTargets) {
            if (cells[i].colors.length) {
              cells[i].colors = [];
              changed = true;
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

      toggleAutoCandidates: () => set((s) => ({ autoCandidates: !s.autoCandidates })),

      /** Fill center marks with the canonical candidates (HoDoKu "fill candidates"). */
      fillCandidates: () => {
        const s = get();
        const g = engineGrid(s.cells);
        const cells = cloneCells(s.cells);
        for (let i = 0; i < 81; i++) {
          if (!cells[i].value && !cells[i].given) cells[i].center = g.cands[i];
        }
        set({ cells, history: [...s.history, cloneCells(s.cells)], future: [] });
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

      check: () => {
        const s = get();
        if (!s.info) return;
        const errors: number[] = [];
        for (let i = 0; i < 81; i++) {
          if (s.cells[i].value && s.cells[i].value !== Number(s.info.solution[i])) {
            errors.push(i);
          }
        }
        set({ errors });
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
      name: 'ninefold-game-v1',
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
