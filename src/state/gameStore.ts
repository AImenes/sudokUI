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
import { Level, Tech, SOLVE_ORDER, hintOrder, asLevel } from '../engine/ratings';
import { useSettings } from './settings';
import type { MarkLayer } from './settings';
import { useStats } from './stats';
import type { GameTally } from './stats';
import { useTelemetry, type PlayKind } from './telemetry';
import { useDailyStats } from './dailyStats';
import type { DailyResult } from './dailyStats';
import { dailyClosed } from '../content/dailies';
import { justifyMove } from './pools';
import { translator, msg } from '../content/i18n';
import type { TextPosition } from '../content/textGrid';
import { formatPencilGrid } from '../content/textGrid';

export type EntryMode = 'digit' | 'corner' | 'center' | 'color';

export interface CellState {
  given: boolean;
  value: number; // 0 = empty
  corner: number; // 9-bit candidate mask
  center: number; // 9-bit candidate mask
  excluded: number; // candidates removed from the auto-candidate view
  colors: number[]; // palette indices 0..8
  /** what placing this cell's digit took away (placeDigit): given back when
   *  the digit goes (giveBack). Absent in saves from before it was kept,
   *  and on cells whose value the player never placed */
  took?: Took;
}

/**
 * The pencil marks a placed digit cleared: the cell's own corner and centre
 * marks, and the peers that held the digit, in which layer. Never changed
 * once made (a cell's copy is shared by the undo snapshots), only replaced.
 */
export interface Took {
  corner: number;
  center: number;
  /** peers whose corner marks held the digit */
  peerCorner: number[];
  /** peers whose centre marks held the digit */
  peerCenter: number[];
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
 *  explicit exclusions (left in, for the candidates the placed digits
 *  alone allow). With auto candidates off, the only exclusions left are
 *  eliminations the app applied and checked against the solution (an
 *  applied hint or chain) and strikes the chain trainer's Done keeps,
 *  never a true digit: switching auto off clears the strikes, in every
 *  cell, so nothing the board does not show can steer a hint, a fill or a
 *  check. */
export function engineGrid(cells: CellState[], withExclusions = true): Grid {
  const g = emptyGrid();
  for (let i = 0; i < 81; i++) {
    if (cells[i].value) {
      setValue(g, i, cells[i].value);
      if (cells[i].given) g.given[i] = 1;
    }
  }
  if (withExclusions) for (let i = 0; i < 81; i++) if (!cells[i].value) g.cands[i] &= ~cells[i].excluded;
  return g;
}

/**
 * Place digit d in cell i: the cell's own marks go, and d from every peer's
 * marks, and what went is kept on the cell, so that taking the digit off
 * again gives it back (giveBack). A digit already there is taken off first.
 */
export function placeDigit(cells: CellState[], i: number, d: number) {
  if (cells[i].value) giveBack(cells, i);
  const c = cells[i];
  const b = bit(d);
  c.took = {
    corner: c.corner,
    center: c.center,
    peerCorner: PEERS[i].filter((p) => !cells[p].value && cells[p].corner & b),
    peerCenter: PEERS[i].filter((p) => !cells[p].value && cells[p].center & b)
  };
  c.value = d;
  c.corner = 0;
  c.center = 0;
  for (const p of PEERS[i]) {
    cells[p].corner &= ~b;
    cells[p].center &= ~b;
  }
}

/**
 * Take a placed digit off cell i and give back the pencil marks its
 * placement took (placeDigit): the cell's own, unless `own` is false (W
 * wipes the cell), and the digit to each peer that held it, while that
 * peer is still empty and no digit it sees is the same. A peer whose
 * marks have since moved to the other layer alone (Swap, Gather, a Fill
 * or Auto switched off) takes it in that layer.
 */
export function giveBack(cells: CellState[], i: number, own = true) {
  const c = cells[i];
  const v = c.value;
  const t = c.took;
  c.value = 0;
  c.took = undefined;
  if (!v || !t || c.given) return;
  if (own) {
    c.corner |= t.corner;
    c.center |= t.center;
  }
  const b = bit(v);
  const back = (p: number, layer: MarkLayer) => {
    const q = cells[p];
    if (q.value || PEERS[p].some((r) => cells[r].value === v)) return;
    const other = layer === 'corner' ? 'center' : 'corner';
    q[q[layer] || !q[other] ? layer : other] |= b;
  };
  for (const p of t.peerCorner) back(p, 'corner');
  for (const p of t.peerCenter) back(p, 'center');
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

/** what asked the mark question (contractFor): Position as text (the Share dialog) is 'text' */
export type ContractAsker = 'hint' | 'highlight' | 'check' | 'auto' | 'text';

/* what Swap, Gather and Fill say while auto candidates are on: only what
 * is true whatever the "Keep candidates" setting, since with it off,
 * switching auto off writes nothing */
/** Swap (convertMarks) */
const SWAP_UNDER_AUTO = msg('Auto candidates are on: the app draws them, so there are no marks of yours to swap while they are on.');
/** Gather (gatherMarks) */
const GATHER_UNDER_AUTO = msg('Auto candidates are on: the app draws them, so there are no marks of yours to gather while they are on.');
/** Fill (fillCandidates), and the Fill button's title meanwhile (Controls.tsx) */
const FILL_UNDER_AUTO = msg('Auto candidates are on: every empty cell already shows its candidates, so there is nothing to fill.');
/** what the ring around bivalue cells says when the marks are notes: it reads the centre marks alone */
const NOTES_RING_CENTRE = msg('Your marks are notes for now, so the rings read your centre marks alone, as each cell’s candidates; corner marks do not count');

/**
 * The cell's candidate list, as the player wrote it: its centre marks; or,
 * in a cell with none, its corner marks once the marks are declared
 * complete (the exhaustive contract: the app wrote them, or the player
 * said so). Corner marks are otherwise notes. Turning auto candidates on
 * keeps the eliminations this list makes.
 */
export function candidateList(c: CellState, contract: MarkContract): number {
  return c.center || (contract === 'exhaustive' ? c.corner : 0);
}

/**
 * Where the app writes a candidate list (Fill candidates, auto candidates
 * switched off, Gather): the layer of Corner or Centre mode when one is
 * active, otherwise, in Digit or Colour mode, the layer set in Settings
 * ("Candidates go in", which the first auto-off prompt also sets).
 */
export function listLayer(mode: EntryMode): MarkLayer {
  return mode === 'corner' || mode === 'center' ? mode : useSettings.getState().materializeLayer;
}

/** the chain trainer's switch to auto candidates, which Done undoes
 *  (startChain, endChain): each cell's exclusions from before it opened,
 *  and right after (the handover's strikes) */
export interface ChainHandover {
  before: number[];
  opened: number[];
}

/**
 * One step of the undo history: the cells, and how the board read them then
 * (auto candidates on or off, the marks' contract, and the chain trainer's
 * handover), so Undo and Redo put back the view with the marks: Ctrl+Z after
 * Auto off turns Auto on again, after a whole-board Fill the marks are notes
 * again if they were, and a step taken while the trainer had switched auto
 * on still has Done switch it off.
 */
export interface Snapshot {
  cells: CellState[];
  auto: boolean;
  contract: MarkContract;
  handover: ChainHandover | null;
}

const snap = (s: { cells: CellState[]; autoCandidates: boolean; markContract: MarkContract; chainHandover: ChainHandover | null }): Snapshot => ({
  cells: cloneCells(s.cells),
  auto: s.autoCandidates,
  contract: s.markContract,
  handover: s.chainHandover
});

/** the state a snapshot puts back */
const restore = (x: Snapshot) => ({ cells: cloneCells(x.cells), autoCandidates: x.auto, markContract: x.contract });

/** the chain trainer runs on auto candidates: an Undo, a Redo or a jump
 *  back that leaves them off closes it, with no handover left for Done,
 *  and the board stays as the step says. One that keeps them on keeps it
 *  open, with the step's handover (none if auto was the player's then);
 *  with the trainer closed there is none */
const trainerAfter = (open: boolean, x: Snapshot) =>
  open && !x.auto
    ? { chain: null, chainNote: '', chainGoal: null, chainHandover: null }
    : { chainHandover: open ? x.handover : null };

/** the player's answer to the mark question holds for the whole puzzle: the
 *  steps taken before it was asked read the marks the same way, so Undo
 *  past them does not ask again */
const answered = (stack: Snapshot[], contract: MarkContract) =>
  stack.map((x) => (x.contract === 'unknown' ? { ...x, contract } : x));

/** Exclusions with auto candidates off hold only eliminations the app
 *  applied and checked, so a struck solution digit there is a slip from a
 *  save or a link made before strikes went with auto off: the board does not
 *  show it, so it goes; and a cell holding a digit keeps none (auto off and
 *  a digit taken off clear them), so a save from before keeps none there */
function dropHiddenSlips(cells: CellState[], solution: string): CellState[] {
  return cells.map((c, i) =>
    c.value
      ? c.given || !c.excluded
        ? c
        : { ...c, excluded: 0 }
      : c.excluded & bit(Number(solution[i]))
        ? { ...c, excluded: c.excluded & ~bit(Number(solution[i])) }
        : c
  );
}

/**
 * The chain trainer closes on the auto candidates it switched on (Done, or
 * a reload while it was open): they go off again, and what comes back is
 * read from the board as it is now, not from a list kept of what was
 * applied. Each empty cell keeps the player's own marks, hidden meanwhile
 * (as the trainer found them, changed only by the player's own steps
 * since: an applied chain takes its digits out and Undo puts them back, a
 * digit placed takes itself from its peers), less each digit struck now
 * that was not struck when the trainer opened (an applied chain still
 * applied, a candidate struck by hand), and with each digit struck then
 * and not now (a candidate restored, by Erase or pressed again) back in
 * the cell's list (its centre marks, or its corner marks once complete); a
 * chain applied and undone leaves nothing. Nothing is written over the
 * marks. The strikes kept are those from before it opened and those made
 * since, never a true digit (a slip struck by hand: where the cell has
 * marks, its removal shows there), and never the handover's own, which
 * were the player's lists and are still the marks. A cell holding a digit
 * keeps no strike: with auto off, none would show when the digit goes.
 */
function handBack(cells: CellState[], h: ChainHandover, solution: string, contract: MarkContract): CellState[] {
  const canon = engineGrid(cells, false);
  return cells.map((c, i) => {
    if (c.value) return c.given || !c.excluded ? c : { ...c, colors: [...c.colors], excluded: 0 };
    const struck = c.excluded & ~h.opened[i];
    const adopted = h.opened[i] & ~h.before[i];
    const restored = h.opened[i] & ~c.excluded & canon.cands[i];
    // the list the restored digits go back to, as candidateList reads it
    const list = c.center ? 'center' : contract === 'exhaustive' && c.corner ? 'corner' : null;
    const corner = c.corner & ~struck;
    const center = c.center & ~struck;
    return {
      ...c,
      colors: [...c.colors],
      corner: list === 'corner' ? corner | restored : corner,
      center: list === 'center' ? center | restored : center,
      excluded: c.excluded & ~adopted & ~bit(Number(solution[i]))
    };
  });
}

/** any pencil marks on empty cells? (the contract question is pointless
 *  on a bare board) */
export function hasManualMarks(cells: CellState[]): boolean {
  return cells.some((c) => !c.value && (c.corner | c.center) !== 0);
}

/** an empty cell whose corner marks hold a digit its centre marks do not:
 *  the only cells where Check's reading depends on the mark question
 *  (corner and centre together once complete, the centre alone otherwise) */
export function cornerMarksCount(cells: CellState[]): boolean {
  return cells.some((c) => !c.value && (c.corner & ~c.center) !== 0);
}

/** an empty cell with corner marks and no centre marks: the only cells
 *  where turning auto on depends on the mark question (candidateList) */
export function cornerOnlyLists(cells: CellState[]): boolean {
  return cells.some((c) => !c.value && c.corner !== 0 && c.center === 0);
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
  /** the daily's number when it is a published one (src/content/dailies.ts): global statistics exist for it */
  dailyNo?: number;
  /** a challenger's time in seconds, from the share link this game was opened from (src/content/share.ts) */
  challenge?: number;
  /** opened from a position link (#s=), part-way through: its time compares with nothing */
  fromPosition?: boolean;
  /** opened from a link someone shared: a puzzle's share address (/p/), or a position link (#s=); a daily's address opens the daily, and a bare #p= is mostly a Learn page's own link */
  fromLink?: boolean;
  /** the player put away the note that this daily is another day's (src/content/dailies.ts, pastDailyOn), for this game */
  pastDailyHidden?: boolean;
  /**
   * The board as it opened, when it opened with more than its givens on
   * it (a shared position, a practice puzzle fast-forwarded, a pasted
   * grid), packed as a position link packs it (encodePosition): only what
   * differs from it is the player's own work (underWay, workOf)
   */
  opening?: string;
}

/**
 * What kind of game the counts say a game is (src/state/telemetry.ts):
 * practice, the daily (a published one or the one derived from its date),
 * a puzzle opened from a shared link, or else a new one: by band,
 * imported, typed, pasted or scanned, or opened from a Learn page
 */
export function kindOf(info: GameInfo): PlayKind {
  if (info.practiceTech) return 'practice';
  if (info.dailyKey) return 'daily';
  return info.fromLink ? 'shared' : 'new';
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
  /** the uniqueness setting the proof was found under, when Check ran; a report of it says so */
  useUniqueness: boolean;
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
  // the techniques a proof may use: without uniqueness, if the player so set
  const useUniqueness = useSettings.getState().useUniqueness;
  const order = hintOrder(useUniqueness);
  for (const cell of wrongCells.slice(0, PROOFS_MAX)) {
    const wrong = cells[cell].value;
    const right = Number(solution[cell]);
    const base = { cell, wrong, right, conflict: null, places: false, trail: false, useUniqueness };
    if (!(g.cands[cell] & bit(wrong))) {
      const conflict = PEERS[cell].find((p) => Number(clean[p]) === wrong) ?? null;
      proofs.push({ ...base, conflict, tech: null, steps: [] });
      continue;
    }
    const out = justify(g, { cell, digit: wrong, placed: false }, PROOF_BUDGET, order);
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
    const inn = justify(g, { cell, digit: right, placed: true }, PROOF_BUDGET, order);
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
  // a player who does not use uniqueness is never credited with it
  const noUniqueness = !useSettings.getState().useUniqueness;
  for (const move of moves) {
    justifyMove(before, move, undefined, noUniqueness).then((j) => j && useStats.getState().recordUnaided(j.tech));
  }
}

/** snapshot of the running game, restored if custom entry is cancelled */
interface GameBackup {
  info: GameInfo | null;
  cells: CellState[];
  autoCandidates: boolean;
  elapsedBefore: number;
  won: boolean;
  /** the game as it was, help and the marks' meaning too: an assist pressed
   *  on the blank entry board must not reach it (absent in older saves) */
  assisted?: boolean;
  markContract?: MarkContract;
}

/**
 * The game under way that a link (or Import) opened another over, kept so
 * that it is never lost (docs/architecture.md, "A game is never lost"):
 * the board as a custom entry's backup keeps it, with what else it needs
 * to come back whole, and a puzzle being typed in with the game it was
 * opened over. One slot, saved with the game.
 */
export interface SetAside extends GameBackup {
  /** a puzzle being typed in, and the game Cancel brings back */
  custom?: boolean;
  customBackup?: GameBackup | null;
  solved?: boolean;
  practiceTarget?: Step | null;
  practiceFound?: boolean;
  /** the running game's tally (src/state/stats.ts), for its win screen */
  tally?: GameTally;
  /** the note that offers it back was put away; the game stays kept */
  hidden?: boolean;
}

interface GameStore {
  info: GameInfo | null;
  cells: CellState[];
  /** true while the user is typing in a custom puzzle */
  custom: boolean;
  customBackup: GameBackup | null;
  /** the game under way a link opened another over (SetAside), offered back beside the board */
  setAside: SetAside | null;
  selection: number[];
  /** number-first entry: a digit pressed with nothing selected arms it;
   *  every cell and pencil mark of that digit lights up (a digit filter)
   *  and a tap on a cell enters it. While it is armed the number keys
   *  choose the armed digit (numberKey): the same digit again puts it
   *  down, whatever is selected, another arms that one. Escape, or a
   *  selection emptied, puts it down too. */
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
  history: Snapshot[];
  future: Snapshot[];
  startedAt: number;
  elapsedBefore: number;
  paused: boolean;
  won: boolean;
  /** the game's first move has been counted as a start (countFirstMove,
   *  below the store). In memory only, never saved: nothing is stored on
   *  the device for counting, and a game resumed from storage is taken as
   *  counted when its board shows a move (playedOn) */
  counted: boolean;
  /** the game has been solved: its solve is in the band record (practice
   *  aside), and was counted unless the device was left out (recordWin). Unlike won, Undo does not clear it, so a solve
   *  undone and solved again is the same solve, and the puzzle started
   *  again is a new game. Saved with the game, like won, for the player's
   *  own record; a save from before it existed has it when it was won */
  solved: boolean;
  /** true once any assist was used this game — hint, check, steps, scan,
   *  revert, auto candidates or fill. A solve is "clean" only while this
   *  stays false; swapping corner↔centre marks never sets it. Reset by
   *  restart/new. */
  assisted: boolean;
  hint: Step | null;
  /** the settings the hint on screen was found under, taken when it
   *  appeared (below the store): what a report of it says, even if a
   *  setting changes while it is shown (src/ui/report.ts) */
  hintWith: { useUniqueness: boolean; markContract: MarkContract } | null;
  /** tech: the name only; full: the drawing and the explanation; walk: the
   *  drawing revealed one frame at a time (src/engine/hintFrames.ts) */
  hintStage: 'hidden' | 'tech' | 'full' | 'walk';
  /** the frame shown while walking */
  walkIndex: number;
  /** how manual pencil marks are to be read (see MarkContract); per game */
  markContract: MarkContract;
  /** the one-time contract question is being shown (set by requestHint) */
  contractPrompt: boolean;
  /** what raised it: a hint, Check, or auto candidates switched on goes on
   *  once it is answered; the ring around bivalue cells simply shows */
  contractFor: ContractAsker;
  errors: number[];
  /** why each wrong digit found by check() is wrong */
  proofs: Proof[];
  /** transient toast message */
  notice: string | null;
  /**
   * Multi-select (the Multi button, M): a tap adds a cell to the selection
   * or takes it out, a drag paints cells in or out, and the board keeps
   * every touch that starts on it, so a drag selects whichever way it goes
   * and the page scrolls from beside the board (Grid.tsx, styles.css).
   * Sticky until the button or Escape; not kept between sessions.
   */
  multiSelect: boolean;
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
  /** the trainer switched auto candidates on, and Done switches them off
   *  again (startChain, endChain): each cell's exclusions from before it
   *  opened, and right after (the handover's strikes), against which Done
   *  reads what was struck while it was open. Null when auto was on
   *  already, or the player has switched it since, and whenever the
   *  trainer is closed. Each history step keeps it (Snapshot), and the
   *  save too, so a reload closes the trainer as Done does */
  chainHandover: ChainHandover | null;

  startGame: (puzzle: string, score: number, level: Level, practiceTech?: Tech | null, dailyKey?: string) => void;
  /**
   * A position pasted as text (src/content/textGrid.ts): the puzzle is its
   * givens, checked and rated as every import is; digits the text marks as
   * placed become entries, and its candidates the centre marks under the
   * exhaustive contract, so hints continue from them. Returns why the
   * puzzle was refused, or null once it is on the board.
   */
  importText: (position: TextPosition) => string | null;
  /**
   * A puzzle from a link or a string (src/content/importLinks.ts), checked
   * and rated as every import is; when the site it came from is named, the
   * notice says so. Returns why the puzzle was refused, or null once it is
   * on the board.
   */
  importPuzzle: (puzzle: string, site?: string | null) => string | null;
  /** blank board the user types givens onto; the running game is backed up */
  startCustomEntry: () => void;
  cancelCustomEntry: () => void;
  /** validate + rate the entered givens and start playing; returns an error
   *  message instead when the puzzle is not a proper sudoku */
  finishCustomEntry: () => string | null;
  /** reset the current puzzle to its starting position, timer included */
  restart: () => void;
  /** puts away the note that the daily on the board is another day's, for this game (src/ui/App.tsx, PastDailyNote) */
  hidePastDaily: () => void;
  /**
   * Opens a game from outside over the board: `open` puts it there and
   * says whether it did. A game under way goes aside first, into the one
   * slot (setAside), unless the game already there holds more of the
   * player's own work (workOf); returns what `open` returned.
   */
  openOver: (open: () => boolean) => boolean;
  /** Back to it: the set-aside game returns, and the game on the board takes its place in the slot if it is under way, its note shown, so either game is one tap away */
  backToSetAside: () => void;
  /**
   * The game asked for (a link to its puzzle, its daily) comes back where
   * it was left when it is kept: set aside (as Back to it), or behind a
   * puzzle being typed in, on the board or set aside (as Cancel would
   * bring it; the typed puzzle, with a digit on it, goes aside). `match`
   * sees each kept game's info and whether it was solved; true if one
   * came back.
   */
  resumeSetAside: (match: (info: GameInfo, won: boolean) => boolean) => boolean;
  /** puts away the note that offers the set-aside game back; the game stays kept, and New still offers it */
  hideSetAside: () => void;
  select: (cells: number[], additive: boolean) => void;
  setMultiSelect: (on: boolean) => void;
  armDigit: (digit: number | null) => void;
  askAssist: (name: string | null) => void;
  selectAllOf: (digit: number) => void;
  setMode: (mode: EntryMode) => void;
  setTempMode: (mode: EntryMode | null) => void;
  setActiveColor: (c: number) => void;
  /** enter a digit in the current mode, or in the mode given (a held number key enters a corner mark) */
  input: (digit: number, as?: EntryMode) => void;
  /** a number key pressed, on screen or on the keyboard: while a digit is
   *  armed it chooses the armed digit and enters nothing; otherwise input */
  numberKey: (digit: number) => void;
  erase: () => void;
  wipe: () => void;
  clearNotice: () => void;
  undo: () => void;
  redo: () => void;
  /** `layer`: where the candidates go when auto goes off and they are kept,
   *  when the player has just chosen it (the first auto-off prompt) */
  toggleAutoCandidates: (layer?: MarkLayer) => void;
  fillCandidates: () => void;
  convertMarks: () => void;
  /** every mark into one layer (Gather: Swap held, or Shift+S): the cells
   *  with marks in only the other layer move them across */
  gatherMarks: (into: MarkLayer) => void;
  requestHint: () => void;
  /** declare the marks' meaning without any follow-up action (Scan) */
  setMarkContract: (contract: 'exhaustive' | 'open') => void;
  /** the ring around cells with two candidates (settings.highlightBivalue,
   *  src/state/bivalue.ts): turned on over manual marks never declared, it
   *  asks the contract question once; over notes it says why nothing shows */
  setBivalueHighlight: (on: boolean) => void;
  /** answer the contract question and continue with the pending hint */
  answerContract: (contract: 'exhaustive' | 'open') => void;
  /**
   * The board as a pencil-mark grid, for Position as text in the Share
   * dialog: each cell's list as the solver reads it (src/content/textGrid.ts
   * candidateLists), since the tools it goes into read every list as
   * complete. Null when the marks' meaning must be asked first (auto
   * candidates off, manual marks, the contract unknown): this raises the
   * question (contractFor 'text'), and the dialog copies the text once it
   * is answered
   */
  positionText: () => string | null;
  dismissContractPrompt: () => void;
  revealHint: () => void;
  /** start the walk, or move through it by a number of frames */
  walkHint: (delta?: number) => void;
  applyHint: () => void;
  dismissHint: () => void;
  check: () => void;
  /** restore a full shared position from an `#s=` link payload: true, or
   *  why not (cut short; or corrupt, or its givens not a proper puzzle) */
  loadPosition: (encoded: string) => true | PositionRefusal;
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
 *  through and compares with nothing, so it stays out. The solve is
 *  counted, practice too, with its kind and nothing that names the player
 *  (src/state/telemetry.ts). Once per game:
 *  a solve undone (Undo clears the win) and solved again, by the same
 *  digit or by Redo, is the same solve. A solved puzzle started again,
 *  by Restart or otherwise, even after its solve was undone, is a new
 *  game (startGame), and its solve counts again */
function recordWin(s: GameStore) {
  if (!s.info || s.solved) return;
  useGame.setState({ solved: true });
  if (!s.info.practiceTech) useStats.getState().recordSolve(s.info.level, s.elapsedMs(), !s.assisted, s.info.dailyKey);
  useTelemetry.getState().track('completed', s.info.level, Math.floor(s.elapsedMs() / 1000), kindOf(s.info));
  recordDaily(s);
}

/**
 * The result of a solved published daily, exactly what the win screen's
 * "Send my time and compare" sends (src/state/dailyStats.ts): the day's
 * number, the finished grid, the time in whole seconds, the hints taken
 * and whether the solve was unassisted. Null for any other game.
 */
export function dailyResultOf(s: Pick<GameStore, 'info' | 'cells' | 'assisted' | 'elapsedMs'>): DailyResult | null {
  if (!s.info?.dailyNo || !s.info.dailyKey) return null;
  return {
    no: s.info.dailyNo,
    grid: s.cells.map((c) => c.value).join(''),
    seconds: Math.floor(s.elapsedMs() / 1000),
    hints: Object.values(useStats.getState().game.hinted).reduce((sum, n) => sum + (n ?? 0), 0),
    unassisted: !s.assisted
  };
}

/**
 * A solved published daily is kept on the device for its share line, and,
 * when the player has switched on sending daily times automatically
 * (Settings, offered on the win screen after a first send), its time goes
 * in by itself: the same request the button makes, once per solve, and
 * only for an unassisted solve of a day the server still takes times for,
 * whose time has not gone in before. With the switch off, nothing is sent
 * until the player taps the button.
 */
function recordDaily(s: GameStore) {
  const result = dailyResultOf(s);
  if (!result || !s.info?.dailyKey) return;
  const daily = useDailyStats.getState();
  daily.recordPlayed(result.no, { date: s.info.dailyKey, level: s.info.level, score: s.info.score, seconds: result.seconds, assisted: s.assisted });
  if (!useSettings.getState().autoSendDaily || !result.unassisted || dailyClosed(result.no)) return;
  if (daily.submitted[result.no] !== undefined || daily.pending[result.no] || daily.inFlight[result.no]) return;
  void daily.submit({ ...result, auto: true });
}

/**
 * Auto candidates going on (toggleAutoCandidates, the chain trainer): each
 * cell's candidate list (candidateList) becomes its exclusions, the digits
 * the list leaves out struck, so the auto view shows the list, digits put
 * back by hand included; a cell without one keeps its exclusions (applied
 * eliminations). Returns the notice saying what was kept and dropped, or
 * null when nothing was.
 */
function autoOn(cells: CellState[], contract: MarkContract): string | null {
  const canon = engineGrid(cells, false);
  let adopted = 0;
  let dropped = 0;
  for (let i = 0; i < 81; i++) {
    const c = cells[i];
    if (c.given || c.value) continue;
    const list = candidateList(c, contract);
    if (!list) continue;
    const missing = canon.cands[i] & ~list;
    c.excluded = missing;
    if (missing) adopted++;
    if (list & ~canon.cands[i]) dropped++;
  }
  const t = translator();
  const vars = { n: adopted, m: dropped };
  if (adopted && dropped) {
    return adopted > 1
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
  }
  if (adopted) return t(adopted > 1 ? 'Auto candidates on: kept your eliminations in {n} cells' : 'Auto candidates on: kept your eliminations in {n} cell', vars);
  if (dropped) return t(dropped > 1 ? 'Auto candidates on: dropped impossible marks in {m} cells' : 'Auto candidates on: dropped impossible marks in {m} cell', vars);
  return null;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      info: null,
      cells: Array.from({ length: 81 }, emptyCell),
      custom: false,
      customBackup: null as GameBackup | null,
      setAside: null as SetAside | null,
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
      counted: false,
      solved: false,
      assisted: false,
      hint: null,
      hintWith: null,
      hintStage: 'hidden' as const,
      walkIndex: 0,
      markContract: 'unknown' as MarkContract,
      contractPrompt: false,
      contractFor: 'hint' as const,
      errors: [],
      proofs: [],
      notice: null,
      multiSelect: false,
      revertIndex: null as number | null,
      practiceTarget: null,
      practiceFound: false,
      chain: null,
      chainNote: '',
      scanPreview: null,
      scanDoubts: [],
      chainGoal: null,
      chainSuggest: false,
      chainHandover: null,

      startGame: (puzzle, score, level, practiceTech = null, dailyKey) => {
        // a puzzle string may write its empty cells as zeros; the app
        // writes dots, everywhere, so the same puzzle always compares equal
        puzzle = puzzle.replace(/0/g, '.');
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
        // the start is counted at the game's first move, not here: a game
        // the app opens by itself, or a link nobody plays, is no game
        // begun (countFirstMove, below the store). Starting the puzzle
        // under way again, by Restart or by choosing it anew, before it
        // was ever solved, is the same game, so its start stays counted;
        // playing a solved puzzle again, even one whose solve was undone,
        // is a new one
        const prev = get();
        const same = practiceTech === (prev.info?.practiceTech ?? null) && prev.info?.puzzle === puzzle && !prev.won && !prev.solved;
        set({
          info: {
            puzzle,
            solution: gridToString(solved),
            score,
            level,
            practiceTech,
            ...(dailyKey ? { dailyKey } : {}),
            // the app's own digits, strikes and candidates are not the
            // player's work: only what differs from them is (workOf)
            ...(fastForward ? { opening: encodePosition(cells, true) } : {})
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
          counted: same && prev.counted,
          solved: false,
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
          // the chain trainer belongs to the puzzle it was opened on: its
          // goal and its taps mean nothing on another (or on this one
          // started again). The board marking the way stays the player's
          // preference, as Done keeps it
          chain: null,
          chainNote: '',
          chainGoal: null,
          chainHandover: null,
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
        // a puzzle being typed in starts again from an empty board; the
        // game it was opened over stays, for Cancel
        if (s.custom) {
          const t = translator();
          set({
            cells: Array.from({ length: 81 }, emptyCell),
            selection: [],
            armedDigit: null,
            history: [],
            future: [],
            scanDoubts: [],
            errors: [],
            notice: t('Board cleared')
          });
          return;
        }
        if (!s.info) return;
        const { challenge, dailyNo, fromLink, pastDailyHidden } = s.info;
        get().startGame(s.info.puzzle, s.info.score, s.info.level, s.info.practiceTech, s.info.dailyKey);
        const t = translator();
        // a challenger's time (a share link's ?vs=) is still the one to
        // beat, a published daily is still that daily, and a puzzle from a
        // shared link is still from it; the same game, so a note put away
        // stays away
        set((g) => ({
          info: g.info
            ? {
                ...g.info,
                ...(challenge ? { challenge } : {}),
                ...(dailyNo ? { dailyNo } : {}),
                ...(fromLink ? { fromLink } : {}),
                ...(pastDailyHidden ? { pastDailyHidden } : {})
              }
            : g.info,
          notice: t('Puzzle restarted')
        }));
      },

      hidePastDaily: () => set((s) => (s.info ? { info: { ...s.info, pastDailyHidden: true } } : {})),

      openOver: (open) => {
        const s = get();
        const kept = underWay(s) ? asideOf(s) : null;
        const opened = open();
        if (opened && kept) set({ setAside: oneSlot(kept, get().setAside) });
        return opened;
      },

      backToSetAside: () => {
        const s = get();
        const back = s.setAside;
        if (!back) return;
        // the game on the board goes aside in its place, and the note
        // offers it back: either game is one tap away
        const kept = underWay(s) ? asideOf(s) : null;
        useStats.setState({ game: back.tally ?? emptyTally() });
        set({ ...boardOf(back), setAside: kept });
      },

      resumeSetAside: (match) => {
        const s = get();
        // behind the puzzle being typed in on the board: back as Cancel
        // brings it, and the typed puzzle, once it has a digit, goes aside
        const behind = s.custom ? s.customBackup : null;
        if (behind?.info && match(behind.info, behind.won)) {
          const entry = s.cells.some((c) => c.value) ? { ...asideOf(s), customBackup: null } : null;
          get().cancelCustomEntry();
          set({ setAside: oneSlot(entry, get().setAside) });
          return true;
        }
        const back = s.setAside;
        if (back?.info && !back.custom && match(back.info, back.won)) {
          get().backToSetAside();
          return true;
        }
        // behind a puzzle being typed in that was set aside: that game
        // comes back, and the slot keeps the typed puzzle (once it has a
        // digit) or the game on the board, whichever holds more work
        const aside = back?.custom ? back.customBackup : null;
        if (back && aside?.info && match(aside.info, aside.won)) {
          const kept = underWay(s) ? asideOf(s) : null;
          const entry = back.cells.some((c) => c.value) ? { ...back, customBackup: null } : null;
          useStats.setState({ game: back.tally ?? emptyTally() });
          set({ ...boardOf(aside), setAside: oneSlot(kept, entry) });
          return true;
        }
        return false;
      },

      hideSetAside: () => set((s) => (s.setAside ? { setAside: { ...s.setAside, hidden: true } } : {})),

      startCustomEntry: () => {
        // the chain trainer closes first, as Done closes it: a tap on the
        // entry board selects a cell for a given, and the game comes back
        // on Cancel as the trainer would have left it
        if (get().chain) get().endChain();
        const s = get();
        set({
          // opened again over a puzzle being typed in (New, then Custom
          // again, or a scan), the backup is still the game the first
          // entry was opened over: Cancel brings that one back
          customBackup: s.custom
            ? s.customBackup
            : {
                info: s.info,
                cells: cloneCells(s.cells),
                autoCandidates: s.autoCandidates,
                elapsedBefore: s.elapsedMs(),
                won: s.won,
                assisted: s.assisted,
                markContract: s.markContract
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
          contractPrompt: false,
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
          // the game as it was: nothing pressed while the puzzle was typed
          // in reaches it (a save from before these were kept leaves them)
          ...(b?.assisted !== undefined ? { assisted: b.assisted } : {}),
          ...(b?.markContract !== undefined ? { markContract: b.markContract } : {}),
          contractPrompt: false,
          notice: null,
          selection: [],
          history: [],
          future: [],
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
        // the game back on the board may have been played on while the
        // device was left out, and the switch gone off since: it is begun
        countStart();
      },

      finishCustomEntry: () => {
        const s = get();
        const puzzle = s.cells.map((c) => (c.value ? String(c.value) : '.')).join('');
        const v = validatePuzzle(puzzle);
        if (!v.ok) return v.reason;
        set({ custom: false, customBackup: null, scanPreview: null, scanDoubts: [] });
        get().startGame(puzzle, v.score, v.level);
        const t = translator();
        set({ notice: t('Puzzle checked: unique solution, HoDoKu rating {score} ({level})', { score: v.score, level: t.level(v.level) }) });
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

      // the toast says what the mode does, since the button alone cannot;
      // the selection stays, so a digit can go into it after the mode is off
      setMultiSelect: (on) =>
        set((s) => {
          if (s.multiSelect === on) return {};
          const t = translator();
          return {
            multiSelect: on,
            notice: on
              ? t('Multi-select on: tap cells to add or remove them, drag to paint. The same again, or Escape, turns it off')
              : t('Multi-select off')
          };
        }),

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

      // While a digit is armed, the number keys choose the armed digit:
      // the armed one again puts it down and another arms that one, with
      // or without a selection, and nothing goes into the cells, which take
      // the armed digit from a tap (Grid.tsx). A tap on a cell selects it,
      // so a key that entered into the selection here could never put the
      // digit down again on a phone, which has no Escape: every tap on the
      // armed key would toggle the digit in the cell, a hold would put a
      // corner mark in, and a tap on the cell enters the digit rather than
      // letting go of it (the owner's report of 4 November 2026)
      numberKey: (digit) => {
        const s = get();
        if (s.won || s.paused) return;
        if (s.armedDigit !== null) {
          set({ armedDigit: s.armedDigit === digit ? null : digit });
          return;
        }
        get().input(digit);
      },

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
        const history = [...s.history, snap(s)];
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
              // the digit again takes it off, and gives back what it took
              giveBack(cells, i);
              changed = true;
            } else {
              if (cells[i].value === digit) continue;
              if (sol) {
                if (Number(sol[i]) === digit) moves.push({ cell: i, digit, placed: true });
                else wrong++;
              }
              // the cell's marks and this digit from its peers' marks go, and
              // come back if the digit does (typed over, erased, or the same
              // digit again)
              placeDigit(cells, i, digit);
              changed = true;
            }
            // with auto off a strike under a digit would be hidden once the
            // digit goes: a digit typed or taken off clears the cell's
            if (!s.autoCandidates) cells[i].excluded = 0;
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
              } else {
                cells[i][key] |= bit(digit);
                // a digit written by hand is on the board now: an earlier
                // elimination of it, which the board no longer shows, must
                // not steer a hint
                cells[i].excluded &= ~bit(digit);
              }
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
          // digit mode: progressive. The digit goes first, giving back the
          // marks its placement took; then the marks the board shows: with
          // auto candidates on, the struck candidates come back, and the
          // player's own marks, hidden while auto is on, are left alone
          for (const i of targets) {
            if (cells[i].value) {
              giveBack(cells, i);
              // with auto off its strikes would be hidden: they go with it
              if (!s.autoCandidates) cells[i].excluded = 0;
              changed = true;
            } else if (s.autoCandidates ? cells[i].excluded : cells[i].corner || cells[i].center) {
              if (s.autoCandidates) cells[i].excluded = 0;
              else {
                cells[i].corner = 0;
                cells[i].center = 0;
              }
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
          history: [...s.history, snap(s)],
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
        // the peers get back what a placed digit took from them (the cells
        // wiped excepted, so first): the cell itself is wiped
        const placed = s.selection.filter((i) => !s.cells[i].given && s.cells[i].value);
        for (const i of placed) giveBack(cells, i, false);
        for (const i of s.selection) {
          const c = cells[i];
          const was = s.cells[i];
          if (
            (!c.given && (was.value || c.corner || c.center || c.excluded)) ||
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
          history: [...s.history, snap(s)],
          future: [],
          hint: null,
          hintStage: 'hidden',
          errors: []
        });
      },

      clearNotice: () => set({ notice: null }),

      // each step puts back the cells and how the board read them: auto
      // candidates on or off, and the marks' contract (Snapshot)
      undo: () => {
        const s = get();
        if (!s.history.length) return;
        const prev = s.history[s.history.length - 1];
        set({
          ...restore(prev),
          ...trainerAfter(!!s.chain, prev),
          history: s.history.slice(0, -1),
          future: [snap(s), ...s.future],
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
        // redoing the winning move wins again (the game is already
        // solved, so its solve is not recorded twice)
        const won = s.info ? checkWin(next.cells, s.info.solution) : false;
        set({
          ...restore(next),
          ...trainerAfter(!!s.chain, next),
          future: rest,
          history: [...s.history, snap(s)],
          hint: null,
          hintStage: 'hidden',
          errors: [],
          won,
          ...(won ? { elapsedBefore: get().elapsedMs(), paused: true } : {})
        });
        if (won) recordWin(get());
      },

      /**
       * Auto candidates on/off with a clean handover:
       * - ON: the eliminations in each cell's candidate list are adopted as
       *   exclusions (candidateList: centre marks, or corner marks in a cell
       *   without them once the marks are declared complete; corner notes
       *   are otherwise left alone). Impossible marks are dropped, and both
       *   events are reported (autoOn). A cell with corner marks alone while
       *   the marks' meaning is unknown: the mark question first, as Hint
       *   asks it, and the answer switches auto on (answerContract), so a
       *   corner list (Gather's, a Fill's) keeps its eliminations.
       * - OFF: if the "keep candidates" setting is on, the current auto view
       *   is written into one layer (listLayer: Corner or Centre mode's,
       *   else the one set in Settings) so play continues exactly where auto
       *   left off. Either way the strikes go: they lived in the auto view,
       *   and the board no longer shows them (Ctrl+Z brings it all back).
       */
      toggleAutoCandidates: (layer) => {
        const s = get();
        // a puzzle being typed in is no game yet: nothing to help with
        if (!s.info) return;
        if (!s.autoCandidates && s.markContract === 'unknown' && cornerOnlyLists(s.cells)) {
          set({ contractPrompt: true, contractFor: 'auto' });
          return;
        }
        const cells = cloneCells(s.cells);
        let notice: string | null = null;
        const t = translator();
        let materialized = false;

        if (!s.autoCandidates) {
          notice = autoOn(cells, s.markContract);
        } else {
          const { autoOffMaterialize } = useSettings.getState();
          const into = layer ?? listLayer(s.tempMode ?? s.mode);
          if (autoOffMaterialize) {
            const eg = engineGrid(cells);
            // the candidates as they stand are the cell's whole list: they go
            // in the one layer chosen, and the other layer's marks, left from
            // before auto candidates went on and hidden while they were, go
            // (Ctrl+Z brings them back). A cell keeping both would draw its
            // corner marks round the edge and keep digits the list has ruled out
            for (let i = 0; i < 81; i++) {
              if (cells[i].given || cells[i].value) continue;
              cells[i][into] = eg.cands[i];
              cells[i][into === 'corner' ? 'center' : 'corner'] = 0;
            }
            materialized = true;
            notice = t(
              into === 'corner'
                ? 'Auto candidates off. Current state written to corner marks (Ctrl+Z reverts)'
                : 'Auto candidates off. Current state written to centre marks (Ctrl+Z reverts)'
            );
          } else {
            notice = t('Auto candidates off');
          }
          // the strikes were the auto view's: written into the marks above,
          // or, with nothing written, gone with the view. Kept hidden, they
          // would steer Hint, Scan and Fill by candidates the board no
          // longer shows, which Check cannot see; so in a cell holding a
          // digit too, where they would be hidden once the digit goes
          for (let i = 0; i < 81; i++) if (!cells[i].given) cells[i].excluded = 0;
        }
        // a hint shown was found and drawn for the candidates the board
        // showed before; the board now shows others. The chain trainer's
        // drawing is the player's own chain: it stays while every node is
        // still a candidate (switching auto off changes none of them),
        // drawn anew over the candidates as they now are, and starts over
        // if one has gone
        const g = engineGrid(cells);
        const chainHolds = !!s.chain && s.chain.nodes.every((n) => !g.values[n.cell] && (g.cands[n.cell] & bit(n.digit)) !== 0);
        // (drawn by the trainer's own rule, as chainTap draws it)
        const drawn = !!s.chain && (s.chain.links.length > 0 || (s.chainSuggest && s.chain.nodes.length > 0));
        const shown = !s.chain
          ? { hint: null, hintStage: 'hidden' as const }
          : chainHolds && drawn
            ? { hint: chainStep(g, s.chain, { suggest: s.chainSuggest, goal: s.chainGoal ?? undefined }), hintStage: s.hintStage === 'walk' ? ('walk' as const) : ('full' as const) }
            : chainHolds
              ? { hint: null, hintStage: 'hidden' as const }
              : { chain: EMPTY_CHAIN, chainNote: t(CHAIN_INTRO), hint: null, hintStage: 'hidden' as const };
        set({
          autoCandidates: !s.autoCandidates,
          cells,
          history: [...s.history, snap(s)],
          future: [],
          // machine-maintained candidates are assistance: the bookkeeping
          // (and its materialised marks on the way out) was done for you
          assisted: true,
          // marks the machine just wrote ARE the remaining candidates — the
          // contract question answers itself
          ...(materialized ? { markContract: 'exhaustive' as MarkContract } : {}),
          // the player has switched auto themselves: Done leaves it as it is
          chainHandover: null,
          ...shown,
          notice
        });
      },

      /**
       * Fill candidates into one layer of marks (listLayer: the Corner or
       * Centre mode's, else, in Digit or Colour mode, the one set in
       * Settings). With any empty cell selected, only the selected empty
       * cells are filled — handy when your own logic is already underway
       * elsewhere. Wrong marks are corrected and reported. With auto
       * candidates on it changes nothing and says why: the app draws the
       * candidates, and the player's marks are hidden.
       */
      fillCandidates: () => {
        const s = get();
        // a puzzle being typed in is no game yet
        if (s.won || s.paused || !s.info) return;
        if (s.autoCandidates) {
          set({ notice: translator()(FILL_UNDER_AUTO) });
          return;
        }
        const g = engineGrid(s.cells);
        const cells = cloneCells(s.cells);
        const layer = listLayer(s.tempMode ?? s.mode);
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
          history: [...s.history, snap(s)],
          future: [],
          assisted: true, // the machine wrote your candidates for you
          // a full-board fill makes every mark machine-complete; a partial
          // fill says nothing about the player's other marks
          ...(partial ? {} : { markContract: 'exhaustive' as MarkContract }),
          notice
        });
      },

      /**
       * Swap corner ↔ centre marks. With empty cells selected only those cells
       * are converted, otherwise every cell with marks. Swapping is
       * self-inverse and loses nothing — handy after auto-off wrote an
       * exhaustive list into the "wrong" layer for your style.
       */
      convertMarks: () => {
        const s = get();
        if (s.won || s.paused) return;
        // auto candidates are drawn by the app, not kept in either layer, and
        // the player's own marks are hidden while they are on: nothing to
        // swap that the board would show, so say so
        if (s.autoCandidates) {
          set({ notice: translator()(SWAP_UNDER_AUTO) });
          return;
        }
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
        const t = translator();
        // nothing to swap: say so, rather than a press that does nothing
        if (!changed) {
          set({ notice: t(partial ? 'No marks to swap in the selected cells' : 'No marks to swap') });
          return;
        }
        const vars = { n: changed };
        set({
          cells,
          history: [...s.history, snap(s)],
          future: [],
          notice:
            changed > 1
              ? t(partial ? 'Swapped corner and centre marks in {n} cells (selection)' : 'Swapped corner and centre marks in {n} cells', vars)
              : t(partial ? 'Swapped corner and centre marks in {n} cell (selection)' : 'Swapped corner and centre marks in {n} cell', vars)
        });
      },

      /**
       * Gather: every mark into one layer, the scope Swap's (the selected
       * empty cells, or every empty cell). A cell with marks in the other
       * layer alone moves them across; a cell with marks in both is left as
       * it is, and counted, since merging would make a note a candidate or
       * a candidate a note. Pure notation like Swap: never help, the contract
       * unchanged, one step for Ctrl+Z.
       */
      gatherMarks: (into) => {
        const s = get();
        if (s.won || s.paused) return;
        const t = translator();
        if (s.autoCandidates) {
          set({ notice: t(GATHER_UNDER_AUTO) });
          return;
        }
        const cells = cloneCells(s.cells);
        const scope = s.selection.filter((i) => !cells[i].given && !cells[i].value);
        const partial = scope.length > 0;
        const targets = partial
          ? scope
          : Array.from({ length: 81 }, (_, i) => i).filter((i) => !cells[i].given && !cells[i].value);
        const from = into === 'corner' ? 'center' : 'corner';
        let moved = 0;
        let both = 0;
        for (const i of targets) {
          const c = cells[i];
          if (!c[from]) continue;
          if (c[into]) {
            both++;
            continue;
          }
          c[into] = c[from];
          c[from] = 0;
          moved++;
        }
        const corner = into === 'corner';
        // the scope said, as Swap says it: the selected cells, or the board
        const first = moved
          ? partial
            ? t(
                moved > 1
                  ? corner ? 'Gathered into corner marks in {n} selected cells' : 'Gathered into centre marks in {n} selected cells'
                  : corner ? 'Gathered into corner marks in {n} selected cell' : 'Gathered into centre marks in {n} selected cell',
                { n: moved }
              )
            : t(
                moved > 1
                  ? corner ? 'Gathered into corner marks in {n} cells' : 'Gathered into centre marks in {n} cells'
                  : corner ? 'Gathered into corner marks in {n} cell' : 'Gathered into centre marks in {n} cell',
                { n: moved }
              )
          : partial
            ? t(corner ? 'Nothing to gather into corner marks in the selected cells' : 'Nothing to gather into centre marks in the selected cells')
            : t(corner ? 'Nothing to gather into corner marks' : 'Nothing to gather into centre marks');
        const notice = both
          ? `${first}; ${t(both > 1 ? '{n} cells have marks in both and were left as they are' : '{n} cell has marks in both and was left as it is', { n: both })}`
          : first;
        if (!moved) {
          set({ notice });
          return;
        }
        set({ cells, history: [...s.history, snap(s)], future: [], notice });
      },

      requestHint: () => {
        const s = get();
        if (!s.info || s.won) return;
        // manual marks whose meaning was never declared: ask the one-time
        // contract question first (the answer re-enters this action)
        if (!s.autoCandidates && s.markContract === 'unknown' && hasManualMarks(s.cells)) {
          set({ contractPrompt: true, contractFor: 'hint' });
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
        // the techniques the player uses: without uniqueness, if so set
        const useUniqueness = useSettings.getState().useUniqueness;
        const position = contractGrid(s.cells, s.autoCandidates, s.markContract);
        const step = findNextStep(position, hintOrder(useUniqueness));
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
        } else if (!useUniqueness && findNextStep(position)) {
          // only uniqueness moves on from here: say so, never hint it anyway
          set({
            hint: null,
            hintStage: 'hidden',
            notice: t('Only a uniqueness technique finds the next step here. Turn on “Use uniqueness in hints” in Settings to see it')
          });
        } else {
          set({ hint: null, hintStage: 'hidden' });
        }
      },

      // the answer holds for the whole puzzle, the steps already taken too
      setMarkContract: (contract) =>
        set((s) => ({ markContract: contract, contractPrompt: false, history: answered(s.history, contract), future: answered(s.future, contract) })),

      setBivalueHighlight: (on) => {
        useSettings.getState().set({ highlightBivalue: on });
        const s = get();
        if (!on) {
          // turned off while its question was still open: the question goes too
          if (s.contractPrompt && s.contractFor === 'highlight') set({ contractPrompt: false });
          return;
        }
        // the ring reads the marks as the player wrote them: auto candidates
        // speak for themselves, so does a board without marks, and a board
        // still being typed in (custom entry) is no game yet
        if (!s.info || s.autoCandidates || !hasManualMarks(s.cells)) return;
        if (s.markContract === 'unknown') set({ contractPrompt: true, contractFor: 'highlight' });
        else if (s.markContract === 'open') set({ notice: translator()(NOTES_RING_CENTRE) });
      },

      answerContract: (contract) => {
        const asked = get().contractFor;
        get().setMarkContract(contract);
        // raised on the way to a hint, by Check or by auto candidates
        // switched on, that goes on; raised by the ring around bivalue
        // cells, the answer is all it needed, and "notes" means the ring
        // reads the centre marks alone, which the player should hear
        if (asked === 'hint') get().requestHint();
        else if (asked === 'check') get().check();
        else if (asked === 'auto') get().toggleAutoCandidates();
        // Position as text: the Share dialog that asked copies it, from the answer's own tap
        else if (asked === 'text') return;
        else if (contract === 'open') set({ notice: translator()(NOTES_RING_CENTRE) });
      },

      positionText: () => {
        const s = get();
        // the question only where the answer changes the text: marks that
        // read as lists the same either way need no answer
        if (
          !s.autoCandidates &&
          s.markContract === 'unknown' &&
          hasManualMarks(s.cells) &&
          formatPencilGrid(s.cells, false, 'exhaustive') !== formatPencilGrid(s.cells, false, 'open')
        ) {
          set({ contractPrompt: true, contractFor: 'text' });
          return null;
        }
        return formatPencilGrid(s.cells, s.autoCandidates, s.markContract);
      },

      // the ring's question closed unanswered is a "no": the setting goes
      // off again rather than staying on with nothing to show; a hint's,
      // Check's or Auto's question closed is that hint, Check or switch not
      // wanted
      dismissContractPrompt: () => {
        if (get().contractFor === 'highlight') useSettings.getState().set({ highlightBivalue: false });
        set({ contractPrompt: false });
      },

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
        for (const { cell, digit } of step.placements) placeDigit(cells, cell, digit);
        const won = s.info ? checkWin(cells, s.info.solution) : false;
        set({
          cells,
          history: [...s.history, snap(s)],
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
        // Check reads a cell's centre marks as its list, and its corner marks
        // too once the marks are declared complete: when some corner mark
        // would count only then, it asks the one-time question first, as
        // Hint does (the answer re-enters this action). Otherwise the answer
        // changes nothing Check does, and it checks at once
        if (!s.autoCandidates && s.markContract === 'unknown' && cornerMarksCount(s.cells)) {
          set({ contractPrompt: true, contractFor: 'check' });
          return;
        }
        set({ assisted: true });
        const errors: number[] = [];
        const eg = s.autoCandidates ? engineGrid(s.cells) : null;
        for (let i = 0; i < 81; i++) {
          const sol = Number(s.info.solution[i]);
          const c = s.cells[i];
          // which marks claim to be the cell's remaining candidates: the
          // centre marks of notes (Snyder style); both layers once declared
          // exhaustive, so a corner-only cell's corner marks are its list
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
            const past = s.history[h].cells;
            let valid = true;
            for (let i = 0; i < 81 && valid; i++) {
              if (past[i].value && past[i].value !== Number(s.info.solution[i])) valid = false;
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
          ...restore(s.history[s.revertIndex]),
          ...trainerAfter(!!s.chain, s.history[s.revertIndex]),
          history: [...s.history, snap(s)],
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
        // the engine checks every link, and the trainer taps candidates, so
        // they must be on the board: switched on here through the Auto
        // button's own handover (the eliminations in the player's lists
        // kept, one step for Ctrl+Z), and off again at Done
        const handover = !s.autoCandidates;
        const cells = handover ? cloneCells(s.cells) : s.cells;
        const notice = handover ? autoOn(cells, s.markContract) : null;
        // pressed again while the trainer is open, on the auto candidates
        // it switched on: the handover stands, and Done still switches them off
        set({
          chain: EMPTY_CHAIN,
          chainGoal: goal?.length ? goal : null,
          chainNote: goal?.length
            ? `${t('Goal: remove {list} (marked on the board as you build).', { list: list! })} ${t(CHAIN_INTRO)}`
            : t(CHAIN_INTRO),
          hint: null,
          hintStage: 'hidden',
          selection: [],
          armedDigit: null,
          assisted: true,
          ...(handover
            ? {
                cells,
                autoCandidates: true,
                history: [...s.history, snap(s)],
                future: [],
                chainHandover: { before: s.cells.map((c) => c.excluded), opened: cells.map((c) => c.excluded) },
                ...(notice ? { notice } : {})
              }
            : { chainHandover: s.chain ? s.chainHandover : null })
        });
      },

      /**
       * Done: the trainer closes. When it switched auto candidates on, they
       * go off again, with the marks read from the board as it is now
       * (handBack). One step for Ctrl+Z.
       */
      endChain: () => {
        const s = get();
        const closed = { chain: null, chainNote: '', chainGoal: null, chainHandover: null, hint: null, hintStage: 'hidden' as const };
        const h = s.chainHandover;
        if (!h || !s.autoCandidates || !s.info) return set(closed);
        const cells = handBack(s.cells, h, s.info.solution, s.markContract);
        set({ ...closed, cells, autoCandidates: false, history: [...s.history, snap(s)], future: [] });
      },

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
        // struck, and so kept when Done switches auto candidates off again
        // while they are still struck (endChain reads the board)
        for (const { cell, digit } of elims) {
          cells[cell].excluded |= bit(digit);
          cells[cell].corner &= ~bit(digit);
          cells[cell].center &= ~bit(digit);
        }
        set({
          cells,
          history: [...s.history, snap(s)],
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
        const path = proof.steps.slice(0, -1);
        const last = proof.steps[proof.steps.length - 1];
        // the easier steps, and a trail's forced singles, are visible only
        // with their candidates on the board
        const autoCandidates = s.autoCandidates || path.length > 0 || proof.trail;
        // the wrong digits come off the board, giving back the marks they
        // took: the proof reasons from a true position. With auto off a
        // strike under one would be hidden, so it goes with the digit
        for (let i = 0; i < 81; i++) {
          if (cells[i].value && !cells[i].given && cells[i].value !== Number(sol[i])) {
            giveBack(cells, i);
            if (!autoCandidates) cells[i].excluded = 0;
          }
        }
        for (const step of path) {
          for (const { cell, digit } of step.eliminations) cells[cell].excluded |= bit(digit);
          for (const { cell, digit } of step.placements) {
            cells[cell].value = digit;
            cells[cell].corner = 0;
            cells[cell].center = 0;
          }
        }
        // auto candidates switched on here: the notice says so
        const candidatesOn = autoCandidates && !s.autoCandidates;
        const vars = { n: path.length, name: t.tech(last.tech) };
        set({
          cells,
          selection: [],
          history: [...s.history, snap(s)],
          future: [],
          errors: [],
          revertIndex: null,
          proofs: [],
          hint: last,
          // found when Check ran, from the digits alone, under the setting of that moment
          hintWith: { useUniqueness: proof.useUniqueness, markContract: s.markContract },
          hintStage: 'full',
          walkIndex: 0,
          assisted: true,
          autoCandidates,
          // a proof shown while the chain trainer is open keeps the trainer's
          // handover when auto was already on (the trainer switched it on),
          // so Done still gives the player's marks back
          chainHandover: s.autoCandidates ? s.chainHandover : null,
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

      importText: (position) => {
        const givens = position.values.map((v, i) => (v && position.given[i] ? String(v) : '.')).join('');
        const v = validatePuzzle(givens);
        if (!v.ok) return v.reason;
        // a game under way goes aside first (openOver), as for a link
        get().openOver(() => (get().startGame(givens, v.score, v.level), true));
        const placed = position.values.some((d, i) => d && !position.given[i]);
        if (!position.cands && !placed) return null;
        const t = translator();
        set((s) => {
          const cells = cloneCells(s.cells);
          for (let i = 0; i < 81; i++) {
            if (position.values[i] && !position.given[i]) cells[i].value = position.values[i];
            else if (!position.values[i] && position.cands) cells[i].center = position.cands[i];
          }
          return {
            cells,
            // digits already placed mean the game starts part-way through,
            // so its time compares with nothing (as a position link's does);
            // what it opened with was pasted, not played here (workOf)
            info: s.info && { ...s.info, ...(placed ? { fromPosition: true } : {}), opening: encodePosition(cells, false) },
            ...(position.cands
              ? {
                  markContract: 'exhaustive' as MarkContract,
                  notice: t('Pencil-mark grid loaded: its candidates are your centre marks, HoDoKu rating {score} ({level})', {
                    score: v.score,
                    level: t.level(v.level)
                  })
                }
              : {})
          };
        });
        return null;
      },

      importPuzzle: (puzzle, site) => {
        const v = validatePuzzle(puzzle);
        if (!v.ok) return v.reason;
        // the puzzle already under way, on the board, set aside or behind
        // a puzzle being typed in, goes on where it was left (Restart
        // starts it again), unless that is its practice, which is another
        // game; any other opens with a game under way set aside first, as
        // for a link
        const p = puzzle.replace(/0/g, '.');
        const s = get();
        const same = (info: GameInfo | null) => info?.puzzle === p && !info.practiceTech;
        if ((same(s.info) && !s.custom && !s.won) || get().resumeSetAside((info, won) => same(info) && !won)) {
          const t = translator();
          set({ notice: t('Your game on this puzzle, where you left it') });
          return null;
        }
        get().openOver(() => (get().startGame(puzzle, v.score, v.level), true));
        if (site) {
          const t = translator();
          set({ notice: t('Imported from {site}, HoDoKu rating {score} ({level})', { site, score: v.score, level: t.level(v.level) }) });
        }
        return null;
      },

      loadPosition: (encoded) => {
        const decoded = readPosition(encoded);
        if ('refused' in decoded) return decoded.refused;
        const givens = decoded.cells
          .map((c) => (c.given ? String(c.value) : '.'))
          .join('');
        const v = validatePuzzle(givens);
        if (!v.ok) return 'unreadable';
        // start the underlying game (computes the solution), then overlay
        // the shared progress: entries, marks, exclusions and colours
        get().startGame(givens, v.score, v.level);
        const t = translator();
        set((s) => {
          // with auto candidates off, a struck true digit the board cannot
          // show (a link made before strikes went with auto off) goes
          const cells = !decoded.autoCandidates && s.info ? dropHiddenSlips(decoded.cells, s.info.solution) : decoded.cells;
          return {
            // a position link is someone's share, counted as one when it
            // opens with moves on it, in this same change; what it opened
            // with is the sender's work, not the player's (workOf)
            info: s.info && { ...s.info, fromPosition: true, fromLink: true, opening: encodePosition(cells, decoded.autoCandidates) },
            cells,
            autoCandidates: decoded.autoCandidates,
            // auto candidates count as help, whoever switched them on
            ...(decoded.autoCandidates ? { assisted: true } : {}),
            notice: t('Shared position loaded, with entries, marks and colours')
          };
        });
        return true;
      },

      markAssisted: () => set({ assisted: true }),

      showStep: (step) => set({ hint: step, hintStage: 'full', assisted: true }),

      jumpToStep: (k) => {
        const s = get();
        if (!s.info) return;
        // the path the Steps dialog listed: without uniqueness, if so set
        const steps = solvePath(s.info.puzzle, hintOrder(useSettings.getState().useUniqueness));
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
          history: [...s.history, snap(s)],
          future: [],
          assisted: true,
          autoCandidates: true,
          // a board set anew: Done leaves auto candidates on
          chainHandover: null,
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
        // an in-progress custom entry survives a reload, and so does the
        // game it was opened over, which Cancel brings back
        custom: s.custom,
        customBackup: s.custom ? s.customBackup : null,
        // the game a link opened another over, until it comes back
        setAside: s.setAside,
        autoCandidates: s.autoCandidates,
        elapsedBefore: s.elapsedMs(),
        won: s.won,
        // solved survives an Undo of the winning digit, and a reload with it
        solved: s.solved,
        assisted: s.assisted,
        // the declared meaning of the marks survives a reload with them
        markContract: s.markContract,
        // the chain trainer is not kept, but the auto candidates it switched
        // on are: its handover lets a reload switch them off as Done would
        chainHandover: s.chainHandover,
        practiceTarget: s.practiceTarget,
        practiceFound: s.practiceFound
      }),
      // a game saved under a band name from before HoDoKu's five levels
      // plays on as its level (ratings.ts, asLevel)
      merge: (persisted, current) => {
        const p = { ...(persisted as Partial<GameStore>) };
        if (p.info) p.info = levelled(p.info);
        if (p.customBackup?.info) p.customBackup = { ...p.customBackup, info: levelled(p.customBackup.info) };
        if (p.setAside?.info) p.setAside = { ...p.setAside, info: levelled(p.setAside.info) };
        if (p.setAside?.customBackup?.info) p.setAside = { ...p.setAside, customBackup: { ...p.setAside.customBackup, info: levelled(p.setAside.customBackup.info) } };
        return { ...current, ...p };
      },
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.startedAt = Date.now();
          state.paused = state.won; // stopped timer for finished games
          // the board says whether this game was begun, so nothing about
          // counting needs saving: a move on it was counted when made, and
          // so was a position opened with entries on it (countStart). Not
          // while the device is left out, when nothing was counted, so the
          // start still goes ahead of the solve if the switch goes off
          // later. A practice puzzle that opened part-way through shows
          // the app's moves from the start, so it is taken as counted even
          // if the player never moved on it before the reload: one gap
          // more, the other way
          // (while a puzzle is being typed in, the game Cancel will bring
          // back is judged by its own saved board)
          const g = state.custom && state.customBackup ? state.customBackup : state;
          state.counted = !!g.info && !useSettings.getState().dontCount && playedOn(g);
          // a save from before solved was kept has it when it was won
          state.solved = !!state.solved || state.won;
          // the chain trainer, open when the page went, does not come back:
          // it closes as Done closes it, so the auto candidates it switched
          // on go off with the player's marks back (after the count above,
          // which they were part of). A save from before the handover was
          // kept has none, and keeps auto as it was
          if (state.chainHandover && state.autoCandidates && state.info) {
            state.cells = handBack(state.cells, state.chainHandover, state.info.solution, state.markContract);
            state.autoCandidates = false;
          }
          state.chainHandover = null;
          // a save from before strikes went with auto candidates off may
          // hold a struck true digit the board cannot show: it goes
          if (state.info && !state.autoCandidates) state.cells = dropHiddenSlips(state.cells, state.info.solution);
        }
      }
    }
  )
);

/** a saved game's info with its band as one of HoDoKu's five levels; a name that is no band at all is left as it was */
export function levelled(info: GameInfo): GameInfo {
  const level = asLevel(info.level);
  return level && level !== info.level ? { ...info, level } : info;
}

/** the board shows a move of the player's: a digit, a mark, an exclusion, a colour, or auto candidates switched on */
export function playedOn(s: Pick<GameStore, 'cells' | 'autoCandidates'>): boolean {
  return s.autoCandidates || s.cells.some((c) => (!c.given && c.value) || c.corner || c.center || c.excluded || c.colors.length);
}

/**
 * A game under way, which a link or Import never replaces without putting
 * it aside first (docs/architecture.md, "A game is never lost"): not won,
 * and played on by the player since it opened (a digit, a mark, a strike
 * or a colour the board did not open with, or auto candidates switched);
 * or a puzzle being typed in, once it has a digit on it or the game it was
 * opened over is under way. A shared position or a fast-forwarded practice
 * nobody has touched, or an empty entry board over nothing begun, holds
 * nothing of the player's to lose.
 */
export function underWay(s: { info: GameInfo | null; cells: CellState[]; autoCandidates: boolean; won: boolean; custom?: boolean; customBackup?: GameBackup | null }): boolean {
  if (s.won) return false;
  if (s.custom) return s.cells.some((c) => c.value) || (!!s.customBackup && underWay({ ...s.customBackup, custom: false }));
  if (!s.info) return false;
  const opening = openingOf(s.info);
  return ownCells(opening, s.cells) > 0 || s.autoCandidates !== (opening?.autoCandidates ?? false);
}

/** how much of the player's own work a game holds: the cells written in since it opened (ownCells), with those of the game a puzzle being typed in was opened over */
export function workOf(g: { info: GameInfo | null; cells: CellState[]; custom?: boolean; customBackup?: GameBackup | null }): number {
  const behind = g.custom && g.customBackup ? ownCells(openingOf(g.customBackup.info), g.customBackup.cells) : 0;
  return ownCells(openingOf(g.info), g.cells) + behind;
}

/** the board a game opened with, when that was more than its givens (GameInfo.opening) */
function openingOf(info: GameInfo | null | undefined) {
  return info?.opening ? decodePosition(info.opening) : null;
}

/**
 * The cells the player has written in: a digit, a mark, a strike or a
 * colour; on a board that opened with some of these (a shared position, a
 * fast-forwarded practice), only the cells that differ from how it opened,
 * compared as a position link carries a cell (its digit and colours, and
 * an open cell's marks).
 */
function ownCells(opening: { cells: CellState[] } | null, cells: CellState[]): number {
  const sameColours = (a: number[], b: number[]) => a.length === b.length && a.every((k) => b.includes(k));
  return cells.filter((c, i) => {
    const o = opening?.cells[i];
    if (!o) return (!c.given && c.value) || c.corner || c.center || c.excluded || c.colors.length;
    return c.value !== o.value || !sameColours(c.colors, o.colors) || (!c.value && (c.corner !== o.corner || c.center !== o.center || c.excluded !== o.excluded));
  }).length;
}

/**
 * One slot: of the game going aside and the one already there, the one
 * with more of the player's own work stays, the newer on a tie. The one
 * that stays has its note shown, so a kept game never stays out of sight
 * while another is dropped.
 */
function oneSlot(kept: SetAside | null, old: SetAside | null): SetAside | null {
  if (!kept) return old;
  if (!old || workOf(kept) >= workOf(old)) return kept;
  return old.hidden ? { ...old, hidden: false } : old;
}

const emptyTally = (): GameTally => ({ unaided: {}, hinted: {}, errors: 0, beyond: 0 });

/** the board a kept game comes back to (Back to it, or a link asking for it): where it was left, as after a reload */
function boardOf(back: SetAside): Partial<GameStore> {
  // the board says whether the game was begun, as after a reload
  const g = back.custom && back.customBackup ? back.customBackup : back;
  return {
    info: back.info,
    cells: cloneCells(back.cells),
    custom: !!back.custom,
    customBackup: back.custom ? (back.customBackup ?? null) : null,
    autoCandidates: back.autoCandidates,
    elapsedBefore: back.elapsedBefore,
    startedAt: Date.now(),
    won: back.won,
    paused: back.won,
    solved: !!back.solved || back.won,
    counted: !!g.info && !useSettings.getState().dontCount && playedOn(g),
    assisted: back.assisted ?? false,
    markContract: back.markContract ?? 'unknown',
    practiceTarget: back.practiceTarget ?? null,
    practiceFound: !!back.practiceFound,
    selection: [],
    armedDigit: null,
    history: [],
    future: [],
    hint: null,
    hintStage: 'hidden',
    contractPrompt: false,
    errors: [],
    proofs: [],
    revertIndex: null,
    chain: null,
    chainNote: '',
    chainGoal: null,
    chainHandover: null,
    scanPreview: null,
    scanDoubts: [],
    notice: null,
    // a puzzle being typed in takes digits, as when it was opened
    ...(back.custom ? { mode: 'digit' as EntryMode } : {})
  };
}

/** the game on the board, as the set-aside slot keeps it: with the chain trainer open, as Done (and a reload) would leave it */
function asideOf(s: GameStore): SetAside {
  const handover = s.chainHandover && s.autoCandidates && s.info ? s.chainHandover : null;
  return {
    info: s.info,
    cells: cloneCells(handover ? handBack(s.cells, handover, s.info!.solution, s.markContract) : s.cells),
    autoCandidates: handover ? false : s.autoCandidates,
    elapsedBefore: s.elapsedMs(),
    won: s.won,
    solved: s.solved,
    assisted: s.assisted,
    markContract: s.markContract,
    practiceTarget: s.practiceTarget,
    practiceFound: s.practiceFound,
    ...(s.custom ? { custom: true, customBackup: s.customBackup } : {}),
    tally: useStats.getState().game
  };
}

/**
 * A game is counted as begun (src/state/telemetry.ts) the first time its
 * board shows anything beyond the givens (playedOn): the player's first
 * digit, mark or colour, candidates switched on (by Auto, Steps or the
 * chain trainer), an applied hint; or, for a shared position or a pasted
 * grid that opens with any of these on it, the moment it opens. A game
 * the app opens by itself on a first visit, or a link opened and never
 * played, is not a game begun. A practice puzzle may open part-way
 * through, with the app's own digits and candidates on it, so it is begun
 * at the player's own first move (the first entry in its history). The
 * flag lives in memory only; a game resumed from storage is taken as
 * counted when its board shows anything beyond the givens, which is
 * exactly when it was counted, so a reload does not count it again. Two
 * gaps, since nothing about counting is saved: a game whose moves were
 * all undone or erased before a reload counts as begun again at its next
 * move; and a game counted, then left out of the counts across a reload,
 * counts as begun again when the switch goes off. While the device is left out
 * of the counts nothing is marked; when the switch goes off, a game
 * already played on is counted at once (below), ahead of its solve.
 */
export function countFirstMove(s: GameStore, prev: GameStore) {
  // a game won before this change is past counting: its solve was
  // counted, or the device was left out of it
  if (!s.info || s.counted || prev.won) return;
  // a new game's own first state is not a move (a position's entries,
  // put on the board right after, are)
  if (s.info.puzzle !== prev.info?.puzzle) return;
  countStart();
}
useGame.subscribe(countFirstMove);

// a hint appearing takes note of what it was found under, unless the
// action that showed it already did (Check's proof, found earlier)
useGame.subscribe((s, prev) => {
  if (s.hint && s.hint !== prev.hint && s.hintWith === prev.hintWith) {
    useGame.setState({ hintWith: { useUniqueness: useSettings.getState().useUniqueness, markContract: s.markContract } });
  }
});

// the device rejoins the counts: a game already played on while it was
// left out is begun now, before its solve, and before a reload could
// take its board for one already counted
useSettings.subscribe((s, prev) => {
  if (prev.dontCount && !s.dontCount && !useGame.getState().won) countStart();
});

/** counts the game on the board as begun, once, with its kind: not while the device is left out */
function countStart() {
  const s = useGame.getState();
  // a solved game is past counting: its start was counted before the
  // win, or the device was left out of it, and its solve too
  if (!s.info || s.counted || s.solved) return;
  if (!(s.info.practiceTech ? s.history.length > 0 : playedOn(s))) return;
  if (useSettings.getState().dontCount) return;
  useGame.setState({ counted: true });
  useTelemetry.getState().track('started', s.info.level, 0, kindOf(s.info));
}

// the full solve path of the current puzzle, cached — rating a hard puzzle
// can take a few hundred milliseconds and the path never changes — one per
// order, since Steps follows the player's choice on uniqueness while the
// share link's techniques and practice follow HoDoKu's
const pathCache = new Map<Tech[], { puzzle: string; steps: Step[] }>();

/**
 * Ordered list of solver steps from the puzzle's start to its solution.
 * `order` is HoDoKu's by default (what the rating, the share link's
 * techniques and practice use); Steps passes the player's (hintOrder).
 */
export function solvePath(puzzle: string, order: Tech[] = SOLVE_ORDER): Step[] {
  const hit = pathCache.get(order);
  if (hit?.puzzle === puzzle) return hit.steps;
  const steps = ratePuzzle(puzzle, order)?.steps ?? [];
  pathCache.set(order, { puzzle, steps });
  return steps;
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
  /** read past the end: the payload was cut short (what was read there is not the sender's) */
  get overrun() {
    return this.pos > this.bits.length;
  }
  /** the payload is exactly as long as the bits read need, and what is left of its last character is the writer's zero padding */
  fits() {
    return Math.ceil(this.pos / 6) * 6 === this.bits.length && this.bits.slice(this.pos).every((b) => b === 0);
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

/** a position link's payload that cannot be loaded: cut short (a chat or a copy lost its end), or unreadable */
export type PositionRefusal = 'cut' | 'unreadable';

/** Inverse of encodePosition; null for corrupt or foreign payloads. */
export function decodePosition(encoded: string): { cells: CellState[]; autoCandidates: boolean } | null {
  const read = readPosition(encoded);
  return 'refused' in read ? null : read;
}

/**
 * Inverse of encodePosition, or why not. The length a payload must have
 * follows from what it says as it is read (an open cell carries its marks,
 * a filled one does not), so a payload cut short, by however little, is
 * refused rather than read with zeros where its end was; and one with
 * characters past its end is refused too.
 */
export function readPosition(encoded: string): { cells: CellState[]; autoCandidates: boolean } | { refused: PositionRefusal } {
  const unreadable = { refused: 'unreadable' } as const;
  try {
    const r = new BitReader(encoded);
    if (r.read(4) !== SHARE_VERSION) return r.overrun ? { refused: 'cut' } : unreadable;
    const autoCandidates = r.read(1) === 1;
    const cells: CellState[] = [];
    for (let i = 0; i < 81; i++) {
      const given = r.read(1) === 1;
      const value = r.read(4);
      if (value > 9 || (given && value === 0)) return r.overrun ? { refused: 'cut' } : unreadable;
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
      if (r.overrun) return { refused: 'cut' };
    }
    if (!r.fits()) return unreadable;
    return { cells, autoCandidates };
  } catch {
    return unreadable;
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
