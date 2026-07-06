import { Grid, UNITS, bit, digitsOf, popcount, cloneGrid, setValue, cellName } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Forcing techniques (net-style): assume a candidate, propagate naked and
 * hidden singles, and reason about the outcomes. Every derived fact is a
 * sound logical consequence of the assumption, so:
 *
 * - Nishio: an assumption that propagates into a contradiction is false.
 * - Cell forcing: whatever holds after EVERY candidate of one cell is tried
 *   holds unconditionally (the cell must be one of them).
 * - Unit forcing: same, over every position of a digit in one unit.
 *
 * These sit just before brute force in the solve order and are what make
 * Extreme puzzles solvable with reasons rather than guesses.
 */

/** Propagate singles until fixpoint. Returns false on contradiction. */
function propagate(g: Grid): boolean {
  for (let guard = 0; guard < 81; guard++) {
    let placed = false;
    for (let i = 0; i < 81; i++) {
      if (g.values[i] !== 0) continue;
      const n = popcount(g.cands[i]);
      if (n === 0) return false;
      if (n === 1) {
        setValue(g, i, digitsOf(g.cands[i])[0]);
        placed = true;
      }
    }
    for (const unit of UNITS) {
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
        if (count === 0) return false;
        if (count === 1) {
          setValue(g, pos, d);
          placed = true;
        }
      }
    }
    if (!placed) return true;
  }
  return true;
}

/**
 * Propagation with intersections on top of singles: after each singles pass,
 * apply pointing (box digit confined to a line clears the rest of the line)
 * and claiming (line digit confined to a box clears the rest of the box).
 * Strictly stronger than `propagate`, still every step a sound inference.
 * Returns false on contradiction.
 */
function propagateNet(g: Grid): boolean {
  for (let guard = 0; guard < 200; guard++) {
    if (!propagate(g)) return false;
    let changed = false;
    for (let d = 1; d <= 9; d++) {
      const m = bit(d);
      // pointing: box -> line
      for (let b = 0; b < 9; b++) {
        const cells = UNITS[18 + b].filter((c) => g.values[c] === 0 && g.cands[c] & m);
        if (cells.length < 2) continue;
        for (const axis of [0, 1] as const) {
          const lineOf = (c: number) => (axis === 0 ? Math.floor(c / 9) : c % 9);
          const l = lineOf(cells[0]);
          if (!cells.every((c) => lineOf(c) === l)) continue;
          for (const c of UNITS[axis === 0 ? l : 9 + l]) {
            if (g.values[c] === 0 && g.cands[c] & m && !UNITS[18 + b].includes(c)) {
              g.cands[c] &= ~m;
              changed = true;
            }
          }
        }
      }
      // claiming: line -> box
      for (let u = 0; u < 18; u++) {
        const cells = UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & m);
        if (cells.length < 2) continue;
        const box = Math.floor(cells[0] / 27) * 3 + Math.floor((cells[0] % 9) / 3);
        const boxOfC = (c: number) => Math.floor(c / 27) * 3 + Math.floor((c % 9) / 3);
        if (!cells.every((c) => boxOfC(c) === box)) continue;
        for (const c of UNITS[18 + box]) {
          if (g.values[c] === 0 && g.cands[c] & m && !UNITS[u].includes(c)) {
            g.cands[c] &= ~m;
            changed = true;
          }
        }
      }
    }
    if (!changed) return true;
  }
  return true;
}

/**
 * Forcing net: Nishio with the stronger net propagation. Fires only for
 * contradictions that plain singles propagation (Nishio, which runs earlier)
 * cannot reach.
 */
export function findForcingNet(g: Grid): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell] !== 0) continue;
    for (const d of digitsOf(g.cands[cell])) {
      const b = cloneGrid(g);
      setValue(b, cell, d);
      if (!propagateNet(b)) {
        return {
          tech: 'FORCING_NET',
          placements: [],
          eliminations: [{ cell, digit: d }],
          primary: [{ cell, digit: d }],
          description: `Forcing net: assuming ${cellName(cell)} = ${d} and following singles plus box/line intersections leads to a contradiction, so ${d} is impossible there.`
        };
      }
    }
  }
  return null;
}

/** Assume cell=digit and propagate; null means contradiction. */
function branch(g: Grid, cell: number, digit: number): Grid | null {
  const b = cloneGrid(g);
  setValue(b, cell, digit);
  return propagate(b) ? b : null;
}

/** Nishio: a candidate whose assumption self-destructs is eliminated. */
export function findNishio(g: Grid): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell] !== 0) continue;
    for (const d of digitsOf(g.cands[cell])) {
      if (branch(g, cell, d) === null) {
        return {
          tech: 'NISHIO_FORCING_CHAIN',
          placements: [],
          eliminations: [{ cell, digit: d }],
          primary: [{ cell, digit: d }],
          description: `Nishio: assuming ${cellName(cell)} = ${d} and following the forced singles leads to a contradiction, so ${d} is impossible there.`
        };
      }
    }
  }
  return null;
}

/** Conclusions common to every viable branch. */
function intersectBranches(g: Grid, branches: Grid[]): { places: CellDigit[]; elims: CellDigit[] } {
  const places: CellDigit[] = [];
  const elims: CellDigit[] = [];
  for (let i = 0; i < 81; i++) {
    if (g.values[i] !== 0) continue;
    const first = branches[0].values[i];
    if (first !== 0 && branches.every((br) => br.values[i] === first)) {
      places.push({ cell: i, digit: first });
      continue;
    }
    for (const d of digitsOf(g.cands[i])) {
      const gone = branches.every(
        (br) => (br.values[i] !== 0 && br.values[i] !== d) || (br.values[i] === 0 && !(br.cands[i] & bit(d)))
      );
      if (gone) elims.push({ cell: i, digit: d });
    }
  }
  return { places, elims };
}

function verityStep(
  g: Grid,
  tech: 'CELL_FORCING_CHAIN' | 'UNIT_FORCING_CHAIN',
  origin: CellDigit[],
  branches: Grid[],
  what: string
): Step | null {
  const { places, elims } = intersectBranches(g, branches);
  if (!places.length && !elims.length) return null;
  return {
    tech,
    placements: places,
    eliminations: elims,
    primary: origin,
    description: `${tech === 'CELL_FORCING_CHAIN' ? 'Cell' : 'Unit'} forcing: every possibility for ${what} leads, via forced singles, to the same conclusion${places.length + elims.length > 1 ? 's' : ''}.`
  };
}

/**
 * Digit forcing: follow BOTH parities of one candidate — placed, or removed —
 * and keep whatever the two outcomes agree on. If removing the candidate
 * self-destructs, it must be true and is placed. (The placed-parity
 * contradiction is Nishio's find and is left to it.)
 */
export function findDigitForcing(g: Grid): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell] !== 0) continue;
    for (const d of digitsOf(g.cands[cell])) {
      const on = branch(g, cell, d);
      const off = cloneGrid(g);
      off.cands[cell] &= ~bit(d);
      const offOk = propagate(off);
      if (!offOk && on) {
        return {
          tech: 'DIGIT_FORCING_CHAIN',
          placements: [{ cell, digit: d }],
          eliminations: [],
          primary: [{ cell, digit: d }],
          description: `Digit forcing: removing ${d} from ${cellName(cell)} collapses the puzzle via forced singles, so ${cellName(cell)} must be ${d}.`
        };
      }
      if (!on || !offOk) continue;
      const { places, elims } = intersectBranches(g, [on, off]);
      if (!places.length && !elims.length) continue;
      return {
        tech: 'DIGIT_FORCING_CHAIN',
        placements: places,
        eliminations: elims,
        primary: [{ cell, digit: d }],
        description: `Digit forcing: whether ${cellName(cell)} is ${d} or not, the forced singles agree on the same conclusion${places.length + elims.length > 1 ? 's' : ''}.`
      };
    }
  }
  return null;
}

/** Try every candidate of a cell; keep what all outcomes agree on. */
export function findCellForcing(g: Grid): Step | null {
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell] !== 0) continue;
    const ds = digitsOf(g.cands[cell]);
    if (ds.length < 2 || ds.length > 4) continue;
    const branches: Grid[] = [];
    let contradiction = false;
    for (const d of ds) {
      const br = branch(g, cell, d);
      if (!br) {
        contradiction = true; // Nishio's find — it runs first in the order
        break;
      }
      branches.push(br);
    }
    if (contradiction) continue;
    const step = verityStep(
      g,
      'CELL_FORCING_CHAIN',
      ds.map((digit) => ({ cell, digit })),
      branches,
      cellName(cell)
    );
    if (step) return step;
  }
  return null;
}

/** Try every position of a digit in a unit; keep the common conclusions. */
export function findUnitForcing(g: Grid): Step | null {
  for (const [ui, unit] of UNITS.entries()) {
    for (let d = 1; d <= 9; d++) {
      if (unit.some((c) => g.values[c] === d)) continue;
      const spots = unit.filter((c) => g.values[c] === 0 && g.cands[c] & bit(d));
      if (spots.length < 2 || spots.length > 4) continue;
      const branches: Grid[] = [];
      let contradiction = false;
      for (const c of spots) {
        const br = branch(g, c, d);
        if (!br) {
          contradiction = true;
          break;
        }
        branches.push(br);
      }
      if (contradiction) continue;
      const step = verityStep(
        g,
        'UNIT_FORCING_CHAIN',
        spots.map((cell) => ({ cell, digit: d })),
        branches,
        `digit ${d} in ${ui < 9 ? `row ${ui + 1}` : ui < 18 ? `column ${ui - 8}` : `box ${ui - 17}`}`
      );
      if (step) return step;
    }
  }
  return null;
}
