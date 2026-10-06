/**
 * The trail of a forcing chain: why each forced single followed from the
 * one before, so the proof the forcing finders run can be drawn.
 *
 * `propagateWithTrail` repeats the singles propagation the finders use
 * (forcing.ts), but records, for every placement, which earlier placements
 * made it forced: for a naked single, the placements that removed the
 * cell's other candidates; for a hidden single, the placements that took
 * the digit's other cells in the house. A contradiction records its causes
 * the same way. `spine` then follows the most recent cause back from the
 * conclusion to the assumption: one line of the reasoning, read in order,
 * which is what the board draws and the walk reads. A net can have several
 * such lines; one is shown, and it is a sound one.
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
        // the cells of the house that could have held d at the start and no longer can
        const lost = () =>
          uniq(
            unit
              .filter((c) => c !== pos && start.values[c] === 0 && start.cands[c] & b)
              .map((c) => (g.values[c] !== 0 ? placedBy[c] : removedBy[c * 9 + d - 1]))
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
 * The links that draw a spine: each forced placement points at the next,
 * and the assumption's own link says whether it was placed or removed.
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
      text: linkText(from, to, k === 1 && !on)
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
  const fins = brokenCells(g, trail.broken);
  const off = path.length === 1 && !on;
  if (fins.length) {
    links.push({
      from: [node(last)],
      to: fins,
      strong: false,
      text: brokenText(trail.broken, off ? { cell, digit } : node(last), off)
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
  links.push({
    from: [node(last)],
    to: [{ cell: c, digit: e }],
    strong: false,
    text:
      k === 0 && !on
        ? tr`If ${cellName(cell)} is not ${digit}, so ${e} is removed from ${cellName(c)}.`
        : tr`${cellName(last.cell)} = ${last.digit}, so ${e} is removed from ${cellName(c)}.`
  });
  return links;
}
