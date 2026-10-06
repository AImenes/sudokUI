/**
 * The trail of a forcing chain: why each forced single followed from the
 * one before, so the proof the forcing finders run can be drawn.
 *
 * `propagateWithTrail` repeats the singles propagation the finders use
 * (forcing.ts), but records, for every placement, which earlier placements
 * made it forced: for a naked single, the placements that removed the
 * cell's other candidates; for a hidden single, the placements that took
 * the digit from the house's other cells (each by the placement that took
 * it, not a later one that filled the cell, so every link names the
 * placement that really made its single forced). A contradiction records
 * its causes the same way. `spine` then follows the most recent cause back
 * from the conclusion to the assumption: one line of the reasoning, read in order,
 * which is what the board draws and the walk reads. A net can have several
 * such lines; one is shown, and it is a sound one. In a position that still
 * has singles (Scan, Check's "why not"), a single that was there before
 * anything was assumed has no causes either, and a line can start at it;
 * its first sentence then names the assumption and calls the single what it
 * is, one the position already had (`opening`).
 */
import { Grid, UNITS, PEERS, bit, digitsOf, popcount, cloneGrid, cellName } from '../board';
import { CellDigit, ChainLink } from '../steps';
import { tr, unitName } from '../text';

export interface TrailStep {
  cell: number;
  digit: number;
  /** trail indices of the placements that forced this one; empty for the assumption */
  because: number[];
  /** how it was forced; the assumption has none */
  how?: 'naked' | 'hidden';
  /** the house, for a hidden single */
  unit?: number;
}

export type Broken =
  | { kind: 'cell'; cell: number; because: number[] }
  | { kind: 'unit'; unit: number; digit: number; because: number[] };

export interface Trail {
  /** trail[0] is the assumption: the candidate placed, or removed when `off` */
  steps: TrailStep[];
  broken: Broken | null;
  grid: Grid;
  /** trail index that removed a candidate (cell * 9 + digit - 1), -1 if never */
  removedBy: Int16Array;
  /** trail index that placed a cell, -1 if it was placed before the trail */
  placedBy: Int16Array;
}

/** Assume a candidate on (placed) or off (removed) and propagate singles, recording causes. */
export function propagateWithTrail(start: Grid, cell: number, digit: number, on: boolean): Trail {
  const g = cloneGrid(start);
  const removedBy = new Int16Array(729).fill(-1);
  const placedBy = new Int16Array(81).fill(-1);
  const steps: TrailStep[] = [{ cell, digit, because: [] }];

  const place = (c: number, d: number, index: number) => {
    for (const e of digitsOf(g.cands[c])) if (e !== d) removedBy[c * 9 + e - 1] = index;
    const b = bit(d);
    for (const p of PEERS[c]) if (g.values[p] === 0 && g.cands[p] & b) removedBy[p * 9 + d - 1] = index;
    g.values[c] = d;
    g.cands[c] = 0;
    for (const p of PEERS[c]) g.cands[p] &= ~b;
    placedBy[c] = index;
  };
  const uniq = (xs: number[]) => [...new Set(xs.filter((x) => x >= 0))].sort((a, b) => a - b);

  if (on) place(cell, digit, 0);
  else {
    g.cands[cell] &= ~bit(digit);
    removedBy[cell * 9 + digit - 1] = 0;
  }

  const done = (broken: Broken | null): Trail => ({ steps, broken, grid: g, removedBy, placedBy });

  for (let guard = 0; guard < 81; guard++) {
    let placed = false;
    for (let i = 0; i < 81; i++) {
      if (g.values[i] !== 0) continue;
      const n = popcount(g.cands[i]);
      if (n === 0) {
        const because = uniq(digitsOf(start.cands[i]).map((e) => removedBy[i * 9 + e - 1]));
        return done({ kind: 'cell', cell: i, because });
      }
      if (n === 1) {
        const d = digitsOf(g.cands[i])[0];
        const because = uniq(digitsOf(start.cands[i]).filter((e) => e !== d).map((e) => removedBy[i * 9 + e - 1]));
        steps.push({ cell: i, digit: d, because, how: 'naked' });
        place(i, d, steps.length - 1);
        placed = true;
      }
    }
    for (let u = 0; u < 27; u++) {
      const unit = UNITS[u];
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let pos = -1;
        let count = 0;
        let solved = false;
        for (const c of unit) {
          if (g.values[c] === d) {
            solved = true;
            break;
          }
          if (g.values[c] === 0 && g.cands[c] & b) {
            pos = c;
            count++;
          }
        }
        if (solved) continue;
        // the cells of the house that could have held d at the start and no
        // longer can, each by the step that took d from it: a cell placed
        // with another digit may have lost d long before it was placed, and
        // its placement is then not why d has no place there
        const lost = () =>
          uniq(
            unit
              .filter((c) => c !== pos && start.values[c] === 0 && start.cands[c] & b)
              .map((c) => removedBy[c * 9 + d - 1])
          );
        if (count === 0) return done({ kind: 'unit', unit: u, digit: d, because: lost() });
        if (count === 1) {
          steps.push({ cell: pos, digit: d, because: lost(), how: 'hidden', unit: u });
          place(pos, d, steps.length - 1);
          placed = true;
        }
      }
    }
    if (!placed) return done(null);
  }
  return done(null);
}

/**
 * One line of reasoning from the assumption to the step at `last`: at each
 * step the most recent cause is followed back. Indices, assumption first.
 */
export function spine(trail: Trail, last: number): number[] {
  const path: number[] = [];
  let i = last;
  while (i >= 0 && !path.includes(i)) {
    path.push(i);
    const because = trail.steps[i].because;
    i = because.length ? Math.max(...because) : -1;
  }
  return path.reverse();
}

/** the most recent of some causes, or the assumption */
export const latest = (because: number[]) => (because.length ? Math.max(...because) : 0);

/**
 * What one link of the trail says, for the walk: the premise (the step
 * before, or the assumed removal when `off`), the single it forces, and why
 * that single is forced.
 */
function linkText(from: TrailStep, to: TrailStep, off: boolean): string {
  const a = cellName(from.cell);
  const b = cellName(to.cell);
  if (to.how === 'hidden') {
    const u = unitName(to.unit!);
    return off
      ? tr`If ${a} is not ${from.digit}, then ${b} must be ${to.digit}: the only place left for ${to.digit} in ${u}.`
      : tr`${a} = ${from.digit}, then ${b} must be ${to.digit}: the only place left for ${to.digit} in ${u}.`;
  }
  return off
    ? tr`If ${a} is not ${from.digit}, then ${b} must be ${to.digit}: the only candidate left in ${b}.`
    : tr`${a} = ${from.digit}, then ${b} must be ${to.digit}: the only candidate left in ${b}.`;
}

const node = (s: TrailStep): CellDigit => ({ cell: s.cell, digit: s.digit });

/**
 * The first link of a line that starts at a single the position already
 * has, not at the assumption: the single is said to be there already, never
 * as if the assumption had forced it, and why it is a single.
 */
function alreadyLinkText(s: TrailStep, to: TrailStep): string {
  const a = cellName(s.cell);
  const b = cellName(to.cell);
  if (s.how === 'hidden') {
    const su = unitName(s.unit!);
    if (to.how === 'hidden') {
      const u = unitName(to.unit!);
      return tr`In ${su}, ${s.digit} already fits only in ${a}, so ${b} must be ${to.digit}: the only place left for ${to.digit} in ${u}.`;
    }
    return tr`In ${su}, ${s.digit} already fits only in ${a}, so ${b} must be ${to.digit}: the only candidate left in ${b}.`;
  }
  if (to.how === 'hidden') {
    const u = unitName(to.unit!);
    return tr`${a} already has only one candidate, ${s.digit}, so ${b} must be ${to.digit}: the only place left for ${to.digit} in ${u}.`;
  }
  return tr`${a} already has only one candidate, ${s.digit}, so ${b} must be ${to.digit}: the only candidate left in ${b}.`;
}

/**
 * The first sentence of a line. `spine` stops at a step with no causes:
 * the assumption, whose placement or removal is then the premise; or, in a
 * position that still has singles (Scan, Check's "why not"), a single that
 * was there before anything was assumed. Such a line never passes through
 * the assumption, yet what it goes on to force may depend on it, so the
 * assumption is stated first, as a sentence of its own, and the single
 * after it as a fact of the position.
 */
function opening(trail: Trail, start: number, on: boolean, fromAssumption: () => string, fromSingle: (s: TrailStep) => string): string {
  if (start === 0) return fromAssumption();
  const a = trail.steps[0];
  const x = cellName(a.cell);
  const assume = on ? tr`Assume ${x} = ${a.digit}.` : tr`Assume ${x} is not ${a.digit}.`;
  return `${assume} ${fromSingle(trail.steps[start])}`;
}

/**
 * The links that draw a spine: each forced placement points at the next,
 * and the first link opens the line (see `opening`).
 */
export function spineLinks(trail: Trail, path: number[], on: boolean): ChainLink[] {
  const links: ChainLink[] = [];
  for (let k = 1; k < path.length; k++) {
    const from = trail.steps[path[k - 1]];
    const to = trail.steps[path[k]];
    links.push({
      from: [node(from)],
      to: [node(to)],
      strong: true,
      text:
        k === 1
          ? opening(trail, path[0], on, () => linkText(from, to, !on), (s) => alreadyLinkText(s, to))
          : linkText(from, to, false)
    });
  }
  return links;
}

/** the candidates, in the real position, where a contradiction would show */
export function brokenCells(g: Grid, broken: Broken): CellDigit[] {
  if (broken.kind === 'cell') return digitsOf(g.cands[broken.cell]).map((digit) => ({ cell: broken.cell, digit }));
  return UNITS[broken.unit]
    .filter((c) => g.values[c] === 0 && g.cands[c] & bit(broken.digit))
    .map((cell) => ({ cell, digit: broken.digit }));
}

/**
 * The link into a contradiction: the premise (the last step, or the assumed
 * removal when `off`), then the cell with no candidate or the house with no
 * place for a digit.
 */
export function brokenText(broken: Broken, from: CellDigit, off: boolean): string {
  const a = cellName(from.cell);
  if (broken.kind === 'cell') {
    const c = cellName(broken.cell);
    return off
      ? tr`If ${a} is not ${from.digit}, then ${c} would have no candidate left: a contradiction.`
      : tr`${a} = ${from.digit}, then ${c} would have no candidate left: a contradiction.`;
  }
  const u = unitName(broken.unit);
  return off
    ? tr`If ${a} is not ${from.digit}, then ${u} would have no place left for ${broken.digit}: a contradiction.`
    : tr`${a} = ${from.digit}, then ${u} would have no place left for ${broken.digit}: a contradiction.`;
}

/** the link into a contradiction from a single the position already has (see `opening`) */
function alreadyBrokenText(broken: Broken, s: TrailStep): string {
  const a = cellName(s.cell);
  if (s.how === 'hidden') {
    const su = unitName(s.unit!);
    return broken.kind === 'cell'
      ? tr`In ${su}, ${s.digit} already fits only in ${a}, so ${cellName(broken.cell)} would have no candidate left: a contradiction.`
      : tr`In ${su}, ${s.digit} already fits only in ${a}, so ${unitName(broken.unit)} would have no place left for ${broken.digit}: a contradiction.`;
  }
  return broken.kind === 'cell'
    ? tr`${a} already has only one candidate, ${s.digit}, so ${cellName(broken.cell)} would have no candidate left: a contradiction.`
    : tr`${a} already has only one candidate, ${s.digit}, so ${unitName(broken.unit)} would have no place left for ${broken.digit}: a contradiction.`;
}

// ---- what the finders draw ----

export interface Drawn {
  links: ChainLink[];
  /** the candidates where the contradiction would show */
  fins?: CellDigit[];
  /** the house with no place left, for a unit contradiction */
  unit?: number;
}

/**
 * The line from an assumption to the contradiction it causes: the spine's
 * links, then one more into the cells where the board would break.
 */
export function contradictionDrawing(g: Grid, cell: number, digit: number, on: boolean): Drawn | null {
  const trail = propagateWithTrail(g, cell, digit, on);
  if (!trail.broken) return null;
  const path = spine(trail, latest(trail.broken.because));
  const links = spineLinks(trail, path, on);
  const last = trail.steps[path[path.length - 1]];
  const broken = trail.broken;
  const fins = brokenCells(g, broken);
  if (fins.length) {
    links.push({
      from: [node(last)],
      to: fins,
      strong: false,
      // with no forced single before it, this link opens the line
      text:
        path.length === 1
          ? opening(trail, path[0], on, () => brokenText(broken, node(last), !on), (s) => alreadyBrokenText(broken, s))
          : brokenText(broken, node(last), false)
    });
  }
  return { links, fins, unit: trail.broken.kind === 'unit' ? trail.broken.unit : undefined };
}

/**
 * The line from an assumption to a conclusion every branch agrees on: a
 * placement the branch makes, or a candidate it removes.
 */
export function conclusionDrawing(
  g: Grid,
  cell: number,
  digit: number,
  on: boolean,
  conclusion: { place?: CellDigit; elim?: CellDigit }
): ChainLink[] {
  const trail = propagateWithTrail(g, cell, digit, on);
  if (conclusion.place) {
    const k = trail.placedBy[conclusion.place.cell];
    if (k < 0) return [];
    return spineLinks(trail, spine(trail, k), on);
  }
  const { cell: c, digit: e } = conclusion.elim!;
  const k = trail.removedBy[c * 9 + e - 1];
  if (k < 0) return [];
  const path = spine(trail, k);
  const links = spineLinks(trail, path, on);
  const last = trail.steps[k];
  const placed = () => tr`${cellName(last.cell)} = ${last.digit}, so ${e} is removed from ${cellName(c)}.`;
  links.push({
    from: [node(last)],
    to: [{ cell: c, digit: e }],
    strong: false,
    // with no forced single before it, this link opens the line
    text:
      path.length === 1
        ? opening(
            trail,
            k,
            on,
            () => (on ? placed() : tr`If ${cellName(cell)} is not ${digit}, so ${e} is removed from ${cellName(c)}.`),
            (s) => alreadyElimText(s, e, c)
          )
        : placed()
  });
  return links;
}

/** a removal made by a single the position already has (see `opening`) */
function alreadyElimText(s: TrailStep, e: number, c: number): string {
  const a = cellName(s.cell);
  return s.how === 'hidden'
    ? tr`In ${unitName(s.unit!)}, ${s.digit} already fits only in ${a}, so ${e} is removed from ${cellName(c)}.`
    : tr`${a} already has only one candidate, ${s.digit}, so ${e} is removed from ${cellName(c)}.`;
}
