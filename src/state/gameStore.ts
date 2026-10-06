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
  UNITS,
  cellName
} from '../engine/board';
import { solve, countSolutions } from '../engine/bruteForce';
import { findNextStep, applyStep, ratePuzzle } from '../engine/humanSolver';
import { Step } from '../engine/steps';
import { walkFrames } from '../engine/hintFrames';
import { justify, Move } from '../engine/justify';
import { contradictionStep } from '../engine/techniques/forcing';
import { Chain, EMPTY_CHAIN, extend, chainStep, conclusions } from '../engine/chainTrainer';
import type { CellDigit } from '../engine/steps';
import { Level, Tech } from '../engine/ratings';
import { useSettings } from './settings';
import { useStats } from './stats';
import { justifyMove } from './pools';
import { translator, msg } from '../content/i18n';

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

/* ---------- the candidate contract ----------
 * A missing pencil mark is ambiguous: not-written-yet, or eliminated? Only
 * the player knows, so when Hint/Scan first run on a board with manual
 * marks, the app asks once per game ("are your marks your remaining
 * candidates?") and remembers the answer:
 *
 * - 'exhaustive': every marked cell's marks (corner ∪ centre — the layers
 *   are positions, not semantics) are that cell's remaining candidates; the
 *   solver folds them in and continues from the player's real position.
 *   Auto candidates and Fill set this automatically — the machine wrote the
 *   marks, so it knows they are complete.
 * - 'open': marks are partial notes (e.g. Snyder notation); the solver
 *   reasons from all canonical possibilities, as if unmarked.
 * - 'unknown': not yet asked.
 */
export type MarkContract = 'unknown' | 'exhaustive' | 'open';

/** any pencil marks on empty cells? (the contract question is pointless
 *  on a bare board) */
export function hasManualMarks(cells: CellState[]): boolean {
  return cells.some((c) => !c.value && (c.corner | c.center) !== 0);
}

/**
 * The grid the solver reasons over. Under the 'exhaustive' contract (manual
 * play only), each marked cell's candidates are intersected with its marks —
 * per cell, so unmarked cells simply stay canonical. Marks can only narrow,
 * never add an impossible digit, and a cell is never zeroed: if a cell's
 * marks are disjoint from the canonical set they are corrupt, and the slip
 * guard in the callers routes that to Check instead.
 */
export function contractGrid(
  cells: CellState[],
  autoCandidates: boolean,
  contract: MarkContract
): Grid {
  const g = engineGrid(cells);
  if (autoCandidates || contract !== 'exhaustive') return g;
  for (let i = 0; i < 81; i++) {
    if (cells[i].value) continue;
    const marks = cells[i].corner | cells[i].center;
    if (!marks) continue;
    const folded = g.cands[i] & marks;
    if (folded) g.cands[i] = folded;
  }
  return g;
}

/** Under the exhaustive contract: the first marked cell whose marks omit its
 *  true solution digit, or -1. Reasoning from such a set would be reasoning
 *  from a corrupted position — Check exists to pinpoint exactly this. */
export function markSlip(cells: CellState[], solution: string): number {
  for (let i = 0; i < 81; i++) {
    const c = cells[i];
    if (c.value) continue;
    const marks = c.corner | c.center;
    if (marks && !(marks & bit(Number(solution[i])))) return i;
  }
  return -1;
}

/** True when a step cannot contradict the known solution: every placement
 *  is the solution digit and no elimination removes one. Any elimination of
 *  a non-solution digit is a true fact about the puzzle, so a step passing
 *  this check can never damage the board — the last line of the no-mistakes
 *  defence for hints derived from player-declared candidates. */
export function stepMatchesSolution(step: Step, solution: string): boolean {
  for (const { cell, digit } of step.placements) {
    if (Number(solution[cell]) !== digit) return false;
  }
  for (const { cell, digit } of step.eliminations) {
    if (Number(solution[cell]) === digit) return false;
  }
  return true;
}

export interface GameInfo {
  puzzle: string;
  solution: string;
  score: number;
  level: Level;
  practiceTech: Tech | null;
  /** the date of the daily puzzle this game is, for the streak */
  dailyKey?: string;
}

/**
 * Why a wrong digit is wrong, found by Check (docs/technique-stats.md,
 * "why not?"). The shortest argument wins: a peer that already holds the
 * digit; a technique that removes it in a step or two; else the digit
 * assumed and the singles it forces followed to the contradiction (a
 * Nishio trail, drawn with arrows); else the solver's longer path to the
 * removal, or to the right digit placed.
 */
export interface Proof {
  cell: number;
  wrong: number;
  right: number;
  /** a peer holding the wrong digit: no technique needed */
  conflict: number | null;
  tech: Tech | null;
  /** the steps played to the proof; the last one is the proof itself */
  steps: Step[];
  /** the proof places the right digit rather than removing the wrong one */
  places: boolean;
  /** the proof assumes the wrong digit and follows the forced singles to a contradiction */
  trail: boolean;
}

/** the chain trainer's opening note; translated where it is shown: t(CHAIN_INTRO) */
const CHAIN_INTRO = msg(
  'Tap a candidate to start. Then tap the next: a strong link first (the other candidate of a bivalue cell, or the digit\'s only other place in a house), then a weak one (two candidates that cannot both be true), and so on.'
);

/** the solver's budget per wrong digit, so Check never stalls */
const PROOF_BUDGET = { steps: 40, ms: 120 };
const PROOFS_MAX = 3;

/**
 * Prove every wrong digit wrong, from the position with the wrong digits
 * taken off the board (a true position, so the solver's reasoning holds).
 */
export function proveWrong(cells: CellState[], solution: string, wrongCells: number[]): Proof[] {
  const clean = cells.map((c, i) => (c.value && c.value === Number(solution[i]) ? String(c.value) : '.')).join('');
  const g = parseGrid(clean);
  if (!g) return [];
  const proofs: Proof[] = [];
  for (const cell of wrongCells.slice(0, PROOFS_MAX)) {
    const wrong = cells[cell].value;
    const right = Number(solution[cell]);
    const base = { cell, wrong, right, conflict: null, places: false, trail: false };
    if (!(g.cands[cell] & bit(wrong))) {
      const conflict = PEERS[cell].find((p) => Number(clean[p]) === wrong) ?? null;
      proofs.push({ ...base, conflict, tech: null, steps: [] });
      continue;
    }
    const out = justify(g, { cell, digit: wrong, placed: false }, PROOF_BUDGET);
    if (out.tech && out.steps.length <= 2) {
      proofs.push({ ...base, tech: out.tech, steps: out.steps });
      continue;
    }
    // no short technique: assume the digit and watch the board break
    const trail = contradictionStep(g, cell, wrong);
    if (trail) {
      proofs.push({ ...base, tech: trail.tech, steps: [trail], trail: true });
      continue;
    }
    if (out.tech) {
      proofs.push({ ...base, tech: out.tech, steps: out.steps });
      continue;
    }
    const inn = justify(g, { cell, digit: right, placed: true }, PROOF_BUDGET);
    proofs.push({ ...base, tech: inn.tech, steps: inn.steps, places: true });
  }
  return proofs;
}

/** Does the player's move do what the practice target does? A placement
 *  the target makes, a candidate it removes, or a digit placed where the
 *  target's removals leave only it. */
export function matchesTarget(target: Step, before: Grid, move: Move): boolean {
  if (!move.placed) return target.eliminations.some((e) => e.cell === move.cell && e.digit === move.digit);
  if (target.placements.some((p) => p.cell === move.cell && p.digit === move.digit)) return true;
  let mask = before.cands[move.cell];
  for (const e of target.eliminations) if (e.cell === move.cell) mask &= ~bit(e.digit);
  return mask !== before.cands[move.cell] && mask === bit(move.digit);
}

/** Credit the player's own moves with the easiest technique that justifies
 *  each, worked out in the worker (docs/technique-stats.md). */
function credit(before: Grid, moves: Move[]) {
  for (const move of moves) {
    justifyMove(before, move).then((j) => j && useStats.getState().recordUnaided(j.tech));
  }
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
  /** number-first entry: a digit pressed with nothing selected arms it;
   *  every cell and pencil mark of that digit lights up (a digit filter)
   *  and a tap on a cell enters it. Escape, or the digit again, disarms. */
  armedDigit: number | null;
  /** an assist the keyboard asked for while the first-assist question is
   *  on: the control panel shows the question and runs it on yes */
  pendingAssist: string | null;
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
  /** true once any assist was used this game — hint, check, steps, scan,
   *  revert, auto candidates or fill. A solve is "clean" only while this
   *  stays false; swapping corner↔centre marks never sets it. Reset by
   *  restart/new. */
  assisted: boolean;
  hint: Step | null;
  /** tech: the name only; full: the drawing and the explanation; walk: the
   *  drawing revealed one frame at a time (src/engine/hintFrames.ts) */
  hintStage: 'hidden' | 'tech' | 'full' | 'walk';
  /** the frame shown while walking */
  walkIndex: number;
  /** how manual pencil marks are to be read (see MarkContract); per game */
  markContract: MarkContract;
  /** the one-time contract question is being shown (set by requestHint) */
  contractPrompt: boolean;
  errors: number[];
  /** why each wrong digit found by check() is wrong */
  proofs: Proof[];
  /** transient toast message */
  notice: string | null;
  /** history index of the last error-free position, set by check() */
  revertIndex: number | null;
  /** practice: the step the puzzle was prepared for, and whether the
   *  player's own move did what it does */
  practiceTarget: Step | null;
  practiceFound: boolean;
  /** the chain trainer: the chain being built, or null when not building
   *  (src/engine/chainTrainer.ts); the board draws it through `hint` */
  chain: Chain | null;
  chainNote: string;
  /** a scanned photo being checked on the custom-entry board: the warped grid, and the cells the scanner doubted */
  scanPreview: string | null;
  scanDoubts: number[];
  /** candidates the chain should remove (practice), and whether the board marks where to go next */
  chainGoal: CellDigit[] | null;
  chainSuggest: boolean;

  startGame: (puzzle: string, score: number, level: Level, practiceTech?: Tech | null, dailyKey?: string) => void;
  /** blank board the user types givens onto; the running game is backed up */
  startCustomEntry: () => void;
  cancelCustomEntry: () => void;
  /** validate + rate the entered givens and start playing; returns an error
   *  message instead when the puzzle is not a proper sudoku */
  finishCustomEntry: () => string | null;
  /** reset the current puzzle to its starting position, timer included */
  restart: () => void;
  select: (cells: number[], additive: boolean) => void;
  armDigit: (digit: number | null) => void;
  askAssist: (name: string | null) => void;
  selectAllOf: (digit: number) => void;
  setMode: (mode: EntryMode) => void;
  setTempMode: (mode: EntryMode | null) => void;
  setActiveColor: (c: number) => void;
  /** enter a digit in the current mode, or in the mode given (a held number key enters a corner mark) */
  input: (digit: number, as?: EntryMode) => void;
  erase: () => void;
  wipe: () => void;
  clearNotice: () => void;
  undo: () => void;
  redo: () => void;
  toggleAutoCandidates: () => void;
  fillCandidates: () => void;
  convertMarks: () => void;
  requestHint: () => void;
  /** declare the marks' meaning without any follow-up action (Scan) */
  setMarkContract: (contract: 'exhaustive' | 'open') => void;
  /** answer the contract question and continue with the pending hint */
  answerContract: (contract: 'exhaustive' | 'open') => void;
  dismissContractPrompt: () => void;
  revealHint: () => void;
  /** start the walk, or move through it by a number of frames */
  walkHint: (delta?: number) => void;
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
  /** show why wrong digit `k` of the last check is wrong: the wrong digits
   *  come off the board, the easier steps on the way are played, and the
   *  proving step is shown as a hint */
  showProof: (k: number) => void;
  startChain: (goal?: CellDigit[]) => void;
  /** put a scanned puzzle on the custom-entry board for checking */
  loadScan: (digits: number[], doubts: number[], preview: string) => void;
  chainToggleSuggest: () => void;
  endChain: () => void;
  /** add the tapped candidate to the chain, if it links */
  chainTap: (cell: number, digit: number) => void;
  chainUndo: () => void;
  chainClear: () => void;
  /** remove what the chain proves false */
  chainApply: () => void;
  togglePause: () => void;
  elapsedMs: () => number;
}

function checkWin(cells: CellState[], solution: string): boolean {
  for (let i = 0; i < 81; i++) {
    if (cells[i].value !== Number(solution[i])) return false;
  }
  return true;
}

/** practice: the player's own move did what the target technique does */
function foundNotice(tech: Tech): string {
  const t = translator();
  return t('You found the {name} 🎯', { name: t.tech(tech) });
}

/** a finished game goes into the band record; practice starts part-way
 *  through and compares with nothing */
function recordWin(s: GameStore) {
  if (!s.info || s.info.practiceTech) return;
  useStats.getState().recordSolve(s.info.level, s.elapsedMs(), !s.assisted, s.info.dailyKey);
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      info: null,
      cells: Array.from({ length: 81 }, emptyCell),
      custom: false,
      customBackup: null as GameBackup | null,
      selection: [],
      armedDigit: null,
      pendingAssist: null,
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
      hint: null,
      hintStage: 'hidden' as const,
      walkIndex: 0,
      markContract: 'unknown' as MarkContract,
      contractPrompt: false,
      errors: [],
      proofs: [],
      notice: null,
      revertIndex: null as number | null,
      practiceTarget: null,
      practiceFound: false,
      chain: null,
      chainNote: '',
      scanPreview: null,
      scanDoubts: [],
      chainGoal: null,
      chainSuggest: false,

      startGame: (puzzle, score, level, practiceTech = null, dailyKey) => {
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
        let practiceTarget: Step | null = null;
        if (fastForward) {
          const eg = engineGrid(cells);
          for (let guard = 0; guard < 200; guard++) {
            const step = findNextStep(eg);
            if (step?.tech === practiceTech) practiceTarget = step;
            if (!step || step.tech === practiceTech) break;
            applyStep(eg, step);
            for (const { cell, digit } of step.eliminations) {
              cells[cell].excluded |= bit(digit);
            }
            for (const { cell, digit } of step.placements) {
              cells[cell].value = digit;
            }
          }
        } else if (practiceTech) {
          // played from the start: the target is where the technique first
          // appears on the solver's path
          practiceTarget = solvePath(puzzle).find((step) => step.tech === practiceTech) ?? null;
        }
        useStats.getState().newGame();
        set({
          info: {
            puzzle,
            solution: gridToString(solved),
            score,
            level,
            practiceTech,
            ...(dailyKey ? { dailyKey } : {})
          },
          practiceTarget,
          practiceFound: false,
          proofs: [],
          revertIndex: null,
          custom: false,
          customBackup: null,
          cells,
          selection: [],
          armedDigit: null,
          history: [],
          future: [],
          startedAt: Date.now(),
          elapsedBefore: 0,
          paused: false,
          won: false,
          // fast-forwarded practice switches auto candidates on for you,
          // which under the house rules already counts as assistance
          assisted: !!fastForward,
          hint: null,
          hintStage: 'hidden',
          // a fresh game means fresh marks — the contract question is asked
          // anew the first time assistance meets manual marks
          markContract: 'unknown',
          contractPrompt: false,
          errors: [],
          // Every new game starts with auto candidates OFF, even when the
          // previous game had them on: assists are chosen per game, and a
          // sticky auto would silently cost the clean badge (and give daily
          // players an unequal start). Fast-forwarded practice is the
          // exception; there the candidate state must be visible to spot
          // the pattern, and the game is already marked assisted above.
          autoCandidates: !!fastForward
        });
      },

      restart: () => {
        const s = get();
        if (!s.info) return;
        get().startGame(s.info.puzzle, s.info.score, s.info.level, s.info.practiceTech, s.info.dailyKey);
        const t = translator();
        set({ notice: t('Puzzle restarted') });
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

      loadScan: (digits, doubts, preview) => {
        get().startCustomEntry();
        const cells = Array.from({ length: 81 }, (_, i) => {
          const cell = emptyCell();
          cell.value = digits[i] ?? 0;
          // the scanner's doubts are shaded, for the eye to settle
          if (doubts.includes(i)) cell.colors = [0];
          return cell;
        });
        const found = digits.filter(Boolean).length;
        const t = translator();
        // the button the custom-entry board shows, by its own label
        const vars = { n: found, doubts: doubts.length, button: t('Check & play') };
        set({
          cells,
          scanPreview: preview,
          scanDoubts: doubts,
          notice: doubts.length
            ? t(
                found === 1
                  ? 'Read {n} digit from the photo, unsure about {doubts}. Compare with the preview, fix anything wrong, then press {button}'
                  : 'Read {n} digits from the photo, unsure about {doubts}. Compare with the preview, fix anything wrong, then press {button}',
                vars
              )
            : t(
                found === 1
                  ? 'Read {n} digit from the photo. Compare with the preview, fix anything wrong, then press {button}'
                  : 'Read {n} digits from the photo. Compare with the preview, fix anything wrong, then press {button}',
                vars
              )
        });
      },

      cancelCustomEntry: () => {
        const b = get().customBackup;
        set({
          custom: false,
          customBackup: null,
          scanPreview: null,
          scanDoubts: [],
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
        set({ custom: false, customBackup: null, scanPreview: null, scanDoubts: [] });
        get().startGame(puzzle, v.score, v.level);
        const t = translator();
        set({ notice: t('Puzzle checked: unique solution, rated {score} ({level})', { score: v.score, level: t.level(v.level) }) });
        return null;
      },

      select: (cells, additive) =>
        set((s) => ({
          selection: additive
            ? [...new Set([...s.selection, ...cells])]
            : cells,
          // clearing the selection (Escape, a tap beside the board) also
          // puts down an armed digit
          armedDigit: cells.length === 0 && !additive ? null : s.armedDigit,
          hint: s.hint,
          errors: s.errors
        })),

      armDigit: (digit) => set({ armedDigit: digit }),

      askAssist: (name) => set({ pendingAssist: name }),

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

      input: (digit, as) => {
        const s = get();
        if (s.won || s.paused) return;
        const mode = as ?? s.tempMode ?? s.mode;
        // nothing selected: the digit is armed (number-first), or put down
        // again if it was the armed one
        if (s.selection.length === 0) {
          set({ armedDigit: s.armedDigit === digit ? null : digit });
          return;
        }
        const targets = s.selection.filter((i) => !s.cells[i].given || mode === 'color');
        if (!targets.length) return;
        const cells = cloneCells(s.cells);
        const history = [...s.history, cloneCells(s.cells)];
        let changed = false;
        // the player's own moves, credited after the board is updated: the
        // position before them, the correct ones, the wrong ones
        const before = s.info ? contractGrid(s.cells, s.autoCandidates, s.markContract) : null;
        const moves: Move[] = [];
        let wrong = 0;
        const sol = s.info?.solution ?? '';

        if (mode === 'digit') {
          const editable = targets.filter((i) => !cells[i].given);
          const allSet = editable.length > 0 && editable.every((i) => cells[i].value === digit);
          for (const i of editable) {
            if (allSet) {
              cells[i].value = 0;
              changed = true;
            } else {
              if (sol) {
                if (Number(sol[i]) === digit) moves.push({ cell: i, digit, placed: true });
                else wrong++;
              }
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
              else {
                cells[i].excluded |= bit(digit);
                // a candidate struck out is a move: a removal, or a mistake
                if (sol && cells[i].excluded !== s.cells[i].excluded) {
                  if (Number(sol[i]) === digit) wrong++;
                  else moves.push({ cell: i, digit, placed: false });
                }
              }
              changed = true;
            }
          } else {
            const key = mode;
            const allHave =
              editable.length > 0 && editable.every((i) => cells[i][key] & bit(digit));
            for (const i of editable) {
              if (allHave) {
                cells[i][key] &= ~bit(digit);
                // under the exhaustive contract a mark taken away is a
                // candidate removed; otherwise marks are notes
                if (sol && s.markContract === 'exhaustive' && !((cells[i].corner | cells[i].center) & bit(digit))) {
                  if (Number(sol[i]) === digit) wrong++;
                  else moves.push({ cell: i, digit, placed: false });
                }
              } else cells[i][key] |= bit(digit);
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
        // practice: did one of these moves do what the target does?
        const found =
          !s.practiceFound &&
          !!s.practiceTarget &&
          !!before &&
          moves.some((m) => matchesTarget(s.practiceTarget!, before, m));
        set({
          cells,
          history,
          future: [],
          won,
          hint: null,
          hintStage: 'hidden',
          errors: [],
          ...(found ? { practiceFound: true, notice: foundNotice(s.info!.practiceTech!) } : {}),
          ...(won ? { elapsedBefore: get().elapsedMs(), paused: true } : {})
        });
        if (before) credit(before, moves);
        const stats = useStats.getState();
        for (let k = 0; k < wrong; k++) stats.recordError();
        if (won) recordWin(get());
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

      /** Wipe everything from the selected cells (W). */
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
        const t = translator();

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
          const vars = { n: adopted, m: dropped };
          if (adopted && dropped) {
            notice =
              adopted > 1
                ? t(
                    dropped > 1
                      ? 'Auto candidates on: kept your eliminations in {n} cells, dropped impossible marks in {m} cells'
                      : 'Auto candidates on: kept your eliminations in {n} cells, dropped impossible marks in {m} cell',
                    vars
                  )
                : t(
                    dropped > 1
                      ? 'Auto candidates on: kept your eliminations in {n} cell, dropped impossible marks in {m} cells'
                      : 'Auto candidates on: kept your eliminations in {n} cell, dropped impossible marks in {m} cell',
                    vars
                  );
          } else if (adopted) {
            notice = t(
              adopted > 1 ? 'Auto candidates on: kept your eliminations in {n} cells' : 'Auto candidates on: kept your eliminations in {n} cell',
              vars
            );
          } else if (dropped) {
            notice = t(
              dropped > 1 ? 'Auto candidates on: dropped impossible marks in {m} cells' : 'Auto candidates on: dropped impossible marks in {m} cell',
              vars
            );
          }
        } else {
          const { autoOffMaterialize, materializeLayer } = useSettings.getState();
          if (autoOffMaterialize) {
            const eg = engineGrid(cells);
            for (let i = 0; i < 81; i++) {
              if (!cells[i].given && !cells[i].value) cells[i][materializeLayer] = eg.cands[i];
            }
            notice = t(
              materializeLayer === 'corner'
                ? 'Auto candidates off. Current state written to corner marks (Ctrl+Z reverts)'
                : 'Auto candidates off. Current state written to centre marks (Ctrl+Z reverts)'
            );
          } else {
            notice = t('Auto candidates off');
          }
        }
        const materialized = s.autoCandidates && useSettings.getState().autoOffMaterialize;
        set({
          autoCandidates: !s.autoCandidates,
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          // machine-maintained candidates are assistance: the bookkeeping
          // (and its materialised marks on the way out) was done for you
          assisted: true,
          // marks the machine just wrote ARE the remaining candidates — the
          // contract question answers itself
          ...(materialized ? { markContract: 'exhaustive' as MarkContract } : {}),
          notice
        });
      },

      /**
       * Fill candidates into the marks of the current mode (corner mode fills
       * corners, everything else fills centre). With any empty cell selected,
       * only the selected empty cells are filled — handy when your own logic is already
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
        const t = translator();
        const corner = layer === 'corner';
        const vars = { n: corrected };
        // the layer, the selection and the corrections, each sentence whole
        const notice = !corrected
          ? partial
            ? t(corner ? 'Filled corner marks in selection' : 'Filled centre marks in selection')
            : t(corner ? 'Filled corner marks' : 'Filled centre marks')
          : corrected === 1
            ? partial
              ? t(corner ? 'Filled corner marks in selection; corrected {n} cell' : 'Filled centre marks in selection; corrected {n} cell', vars)
              : t(corner ? 'Filled corner marks; corrected {n} cell' : 'Filled centre marks; corrected {n} cell', vars)
            : partial
              ? t(corner ? 'Filled corner marks in selection; corrected {n} cells' : 'Filled centre marks in selection; corrected {n} cells', vars)
              : t(corner ? 'Filled corner marks; corrected {n} cells' : 'Filled centre marks; corrected {n} cells', vars);
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          assisted: true, // the machine wrote your candidates for you
          // a full-board fill makes every mark machine-complete; a partial
          // fill says nothing about the player's other marks
          ...(partial ? {} : { markContract: 'exhaustive' as MarkContract }),
          notice
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
        const t = translator();
        const vars = { n: changed };
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          notice:
            changed > 1
              ? t(partial ? 'Swapped corner and centre marks in {n} cells (selection)' : 'Swapped corner and centre marks in {n} cells', vars)
              : t(partial ? 'Swapped corner and centre marks in {n} cell (selection)' : 'Swapped corner and centre marks in {n} cell', vars)
        });
      },

      requestHint: () => {
        const s = get();
        if (!s.info || s.won) return;
        // manual marks whose meaning was never declared: ask the one-time
        // contract question first (the answer re-enters this action)
        if (!s.autoCandidates && s.markContract === 'unknown' && hasManualMarks(s.cells)) {
          set({ contractPrompt: true });
          return;
        }
        const sol = s.info.solution;
        const t = translator();
        // a wrong digit on the board: no technique can reason from it, and
        // the player should hear that it is a digit, not their marks
        if (s.cells.some((c, i) => c.value && !c.given && c.value !== Number(sol[i]))) {
          set({
            hint: null,
            hintStage: 'hidden',
            assisted: true,
            notice: t('A placed digit is wrong, so no hint can be trusted. Run Check to find it')
          });
          return;
        }
        // under the exhaustive contract a marked cell that lost its true
        // digit is a corrupted position — Check pinpoints it; we won't
        // reason from it
        if (!s.autoCandidates && s.markContract === 'exhaustive') {
          const slip = markSlip(s.cells, sol);
          if (slip >= 0) {
            set({
              hint: null,
              hintStage: 'hidden',
              assisted: true,
              notice: t('A pencil mark somewhere dropped a digit that belongs. Run Check to find it')
            });
            return;
          }
        }
        const step = findNextStep(contractGrid(s.cells, s.autoCandidates, s.markContract));
        if (step && stepMatchesSolution(step, sol)) {
          // even the technique's name is information — the solve is no
          // longer clean
          set({ hint: step, hintStage: 'tech', assisted: true });
        } else if (step) {
          // a technique fired from the declared marks but contradicts the
          // solution — the marks misled it; never show an unsound hint
          set({
            hint: null,
            hintStage: 'hidden',
            assisted: true,
            notice: t('Your pencil marks lead to an impossible deduction. Run Check')
          });
        } else {
          set({ hint: null, hintStage: 'hidden' });
        }
      },

      setMarkContract: (contract) => set({ markContract: contract, contractPrompt: false }),

      answerContract: (contract) => {
        set({ markContract: contract, contractPrompt: false });
        // the question was only ever raised on the way to a hint
        get().requestHint();
      },

      dismissContractPrompt: () => set({ contractPrompt: false }),

      revealHint: () => set({ hintStage: 'full' }),

      walkHint: (delta) => {
        const s = get();
        if (!s.hint) return;
        const frames = walkFrames(s.hint).length;
        if (s.hintStage !== 'walk') {
          set({ hintStage: 'walk', walkIndex: 0 });
          return;
        }
        const next = Math.max(0, Math.min(frames - 1, s.walkIndex + (delta ?? 0)));
        set({ walkIndex: next });
      },

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
        useStats.getState().recordHinted(step.tech);
        if (won) recordWin(get());
      },

      dismissHint: () => set({ hint: null, hintStage: 'hidden' }),

      /** Flags wrong values, plus cells whose candidate list (auto view, or
       *  pencil marks under their declared contract) no longer contains the
       *  solution digit. */
      check: () => {
        const s = get();
        if (!s.info) return;
        set({ assisted: true });
        const errors: number[] = [];
        const eg = s.autoCandidates ? engineGrid(s.cells) : null;
        for (let i = 0; i < 81; i++) {
          const sol = Number(s.info.solution[i]);
          const c = s.cells[i];
          // which marks claim to be the cell's remaining candidates: centre
          // by convention; both layers once declared exhaustive
          const claimed =
            s.markContract === 'exhaustive' ? c.corner | c.center : c.center;
          if (c.value) {
            if (c.value !== sol) errors.push(i);
          } else if (eg) {
            if (!(eg.cands[i] & bit(sol))) errors.push(i);
          } else if (claimed && !(claimed & bit(sol))) {
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
        // why each wrong digit is wrong: the learning is in the mistake
        const wrongCells = errors.filter((i) => s.cells[i].value);
        const proofs = wrongCells.length ? proveWrong(s.cells, s.info.solution, wrongCells) : [];
        const t = translator();
        set({
          errors,
          revertIndex,
          proofs,
          notice:
            errors.length === 0
              ? t('Everything checks out so far')
              : t(
                  errors.length > 1
                    ? '{n} problems found: values or candidate lists missing the true digit'
                    : '{n} problem found: values or candidate lists missing the true digit',
                  { n: errors.length }
                )
        });
      },

      revertToValid: () => {
        const s = get();
        if (s.revertIndex === null || !s.history[s.revertIndex]) return;
        const t = translator();
        set({
          cells: cloneCells(s.history[s.revertIndex]),
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          errors: [],
          revertIndex: null,
          proofs: [],
          hint: null,
          hintStage: 'hidden',
          notice: t('Back to the last correct position (Ctrl+Z restores your entries)')
        });
      },

      dismissRevert: () => set({ revertIndex: null, proofs: [] }),

      startChain: (goal) => {
        const s = get();
        if (!s.info || s.won) return;
        const t = translator();
        // the goal and the instructions are separate sentences
        const list = goal?.map((c) => t('{digit} from {cell}', { digit: c.digit, cell: cellName(c.cell) })).join(', ');
        set({
          chain: EMPTY_CHAIN,
          chainGoal: goal?.length ? goal : null,
          chainNote: goal?.length
            ? `${t('Goal: remove {list} (circled purple).', { list: list! })} ${t(CHAIN_INTRO)}`
            : t(CHAIN_INTRO),
          hint: null,
          hintStage: 'hidden',
          selection: [],
          armedDigit: null,
          // the engine checks every link, and the trainer taps candidates,
          // so they must be on the board
          assisted: true,
          autoCandidates: true
        });
      },

      endChain: () => set({ chain: null, chainNote: '', chainGoal: null, hint: null, hintStage: 'hidden' }),

      chainToggleSuggest: () => {
        const s = get();
        if (!s.chain) return;
        const chainSuggest = !s.chainSuggest;
        const g = engineGrid(s.cells);
        const drawn = s.chain.links.length > 0 || (chainSuggest && s.chain.nodes.length > 0);
        set({
          chainSuggest,
          hint: drawn ? chainStep(g, s.chain, { suggest: chainSuggest, goal: s.chainGoal ?? undefined }) : null,
          hintStage: drawn ? 'full' : 'hidden'
        });
      },

      chainTap: (cell, digit) => {
        const s = get();
        if (!s.chain) return;
        const g = engineGrid(s.cells);
        const r = extend(g, s.chain, { cell, digit });
        const drawn = r.chain.links.length > 0 || (s.chainSuggest && r.chain.nodes.length > 0);
        // practice: the goal is met once the chain removes one of its candidates
        const removed = r.ok ? conclusions(g, r.chain) : [];
        const met = !!s.chainGoal && !s.practiceFound && s.chainGoal.some((c) => removed.some((e) => e.cell === c.cell && e.digit === c.digit));
        const t = translator();
        set({
          chain: r.chain,
          // r.message is the engine's sentence, already in the player's language
          chainNote: met ? t('{message} That reaches the goal: you built it yourself.', { message: r.message }) : r.message,
          hint: drawn ? chainStep(g, r.chain, { suggest: s.chainSuggest, goal: s.chainGoal ?? undefined }) : null,
          hintStage: drawn ? 'full' : 'hidden',
          ...(met && s.info?.practiceTech
            ? { practiceFound: true, notice: t('You built the {name} yourself 🎯', { name: t.tech(s.info.practiceTech) }) }
            : {})
        });
      },

      chainUndo: () => {
        const s = get();
        if (!s.chain?.nodes.length) return;
        const chain: Chain = { nodes: s.chain.nodes.slice(0, -1), links: s.chain.links.slice(0, -1) };
        const g = engineGrid(s.cells);
        const drawn = chain.links.length > 0 || (s.chainSuggest && chain.nodes.length > 0);
        const t = translator();
        set({
          chain,
          chainNote: chain.nodes.length ? t('Last candidate taken off the chain.') : t(CHAIN_INTRO),
          hint: drawn ? chainStep(g, chain, { suggest: s.chainSuggest, goal: s.chainGoal ?? undefined }) : null,
          hintStage: drawn ? 'full' : 'hidden'
        });
      },

      chainClear: () => set({ chain: EMPTY_CHAIN, chainNote: translator()(CHAIN_INTRO), hint: null, hintStage: 'hidden' }),

      chainApply: () => {
        const s = get();
        if (!s.chain || !s.info) return;
        const g = engineGrid(s.cells);
        const elims = conclusions(g, s.chain);
        if (!elims.length) return;
        const t = translator();
        // sound by construction, from the candidates on the board; a true
        // candidate struck out earlier could still mislead it, so never let
        // a chain damage the board
        if (elims.some((e) => Number(s.info!.solution[e.cell]) === e.digit)) {
          set({ chainNote: t('This chain would remove a true digit, so a candidate on the board is wrong. Run Check to find it.') });
          return;
        }
        const cells = cloneCells(s.cells);
        for (const { cell, digit } of elims) {
          cells[cell].excluded |= bit(digit);
          cells[cell].corner &= ~bit(digit);
          cells[cell].center &= ~bit(digit);
        }
        set({
          cells,
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          errors: [],
          chain: EMPTY_CHAIN,
          // {button}: the trainer's Done button, by its own label
          chainNote: t(
            elims.length > 1
              ? 'Applied: your chain removed {n} candidates. Build another, or {button}.'
              : 'Applied: your chain removed {n} candidate. Build another, or {button}.',
            { n: elims.length, button: t('Done') }
          ),
          hint: null,
          hintStage: 'hidden'
        });
        // the player's own logic, checked: credited like any unaided move
        credit(g, elims.map((e) => ({ cell: e.cell, digit: e.digit, placed: false })));
      },

      showProof: (k) => {
        const s = get();
        const proof = s.proofs[k];
        if (!proof || !s.info) return;
        const t = translator();
        if (proof.conflict !== null) {
          set({
            selection: [proof.cell, proof.conflict],
            notice: t('{cell} cannot be {digit}: {other} already holds it', {
              cell: cellName(proof.cell),
              digit: proof.wrong,
              other: cellName(proof.conflict)
            })
          });
          return;
        }
        if (!proof.steps.length) return;
        const sol = s.info.solution;
        const cells = cloneCells(s.cells);
        // the wrong digits come off the board: the proof reasons from a true position
        for (let i = 0; i < 81; i++) {
          if (cells[i].value && !cells[i].given && cells[i].value !== Number(sol[i])) cells[i].value = 0;
        }
        const path = proof.steps.slice(0, -1);
        const last = proof.steps[proof.steps.length - 1];
        for (const step of path) {
          for (const { cell, digit } of step.eliminations) cells[cell].excluded |= bit(digit);
          for (const { cell, digit } of step.placements) {
            cells[cell].value = digit;
            cells[cell].corner = 0;
            cells[cell].center = 0;
          }
        }
        // the easier steps, and a trail's forced singles, are visible only
        // with their candidates on the board
        const autoCandidates = s.autoCandidates || path.length > 0 || proof.trail;
        // auto candidates switched on here: the notice says so
        const candidatesOn = autoCandidates && !s.autoCandidates;
        const vars = { n: path.length, name: t.tech(last.tech) };
        set({
          cells,
          selection: [],
          history: [...s.history, cloneCells(s.cells)],
          future: [],
          errors: [],
          revertIndex: null,
          proofs: [],
          hint: last,
          hintStage: 'full',
          walkIndex: 0,
          assisted: true,
          autoCandidates,
          notice: path.length
            ? path.length > 1
              ? t(
                  candidatesOn
                    ? '{n} easier steps played first, then the {name}; auto candidates on (Ctrl+Z goes back)'
                    : '{n} easier steps played first, then the {name} (Ctrl+Z goes back)',
                  vars
                )
              : t(
                  candidatesOn
                    ? '{n} easier step played first, then the {name}; auto candidates on (Ctrl+Z goes back)'
                    : '{n} easier step played first, then the {name} (Ctrl+Z goes back)',
                  vars
                )
            : proof.trail
              ? t(
                  candidatesOn
                    ? 'The wrong digit is off the board. Walk through it to see what placing it would force; auto candidates on'
                    : 'The wrong digit is off the board. Walk through it to see what placing it would force'
                )
              : t(
                  candidatesOn
                    ? 'The wrong digit is off the board; the {name} shows why; auto candidates on'
                    : 'The wrong digit is off the board; the {name} shows why',
                  vars
                )
        });
      },

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
        const t = translator();
        set({
          cells: decoded.cells,
          autoCandidates: decoded.autoCandidates,
          // auto candidates count as help, whoever switched them on
          ...(decoded.autoCandidates ? { assisted: true } : {}),
          notice: t('Shared position loaded, with entries, marks and colours')
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
        const t = translator();
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
          notice: t('Jumped to step {k} of {n} (Ctrl+Z goes back)', { k: Math.min(k, steps.length - 1) + 1, n: steps.length })
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
        // the declared meaning of the marks survives a reload with them
        markContract: s.markContract,
        practiceTarget: s.practiceTarget,
        practiceFound: s.practiceFound
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
  // the reason is shown to the player, in their language
  const t = translator();
  const clues = [...puzzle].filter((ch) => ch >= '1' && ch <= '9').length;
  if (clues < 17) {
    return {
      ok: false,
      reason: t(
        clues === 1
          ? 'Only {n} given. A puzzle needs at least 17 to have a unique solution.'
          : 'Only {n} givens. A puzzle needs at least 17 to have a unique solution.',
        { n: clues }
      )
    };
  }
  for (const unit of UNITS) {
    const seen = new Set<string>();
    for (const c of unit) {
      const ch = puzzle[c];
      if (ch < '1' || ch > '9') continue;
      if (seen.has(ch)) return { ok: false, reason: t('Conflicting givens: two {digit}s share a row, column or box.', { digit: ch }) };
      seen.add(ch);
    }
  }
  const g = parseGrid(puzzle);
  if (!g) return { ok: false, reason: t('That is not a valid puzzle.') };
  const solutions = countSolutions(g, 2);
  if (solutions === 0) return { ok: false, reason: t('The puzzle has no solution.') };
  if (solutions > 1) return { ok: false, reason: t('The puzzle has more than one solution.') };
  const rating = ratePuzzle(parseGrid(puzzle)!);
  if (!rating) return { ok: false, reason: t('The puzzle could not be rated.') };
  return { ok: true, score: rating.score, level: rating.level };
}

/** Rate an imported puzzle; null unless it is a proper unique-solution
 *  sudoku. Thin wrapper around `validatePuzzle` for the URL seeding path. */
export function rateImport(puzzle: string): { score: number; level: Level } | null {
  const v = validatePuzzle(puzzle);
  return v.ok ? { score: v.score, level: v.level } : null;
}
