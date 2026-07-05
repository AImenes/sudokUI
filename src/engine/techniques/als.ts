import { Grid, UNITS, bit, digitsOf, popcount, sees, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { combinations } from './subsets';

interface Als {
  cells: number[];
  mask: number;
}

/** Almost Locked Sets: n cells in one unit with n+1 candidates. */
function collectAls(g: Grid, maxSize = 4, cap = 600): Als[] {
  const out: Als[] = [];
  const seen = new Set<string>();
  for (const unit of UNITS) {
    const empty = unit.filter((c) => g.values[c] === 0);
    for (let size = 1; size <= Math.min(maxSize, empty.length); size++) {
      for (const combo of combinations(empty, size)) {
        let mask = 0;
        for (const c of combo) mask |= g.cands[c];
        if (popcount(mask) !== size + 1) continue;
        const key = combo.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ cells: combo, mask });
        if (out.length >= cap) return out;
      }
    }
  }
  return out;
}

export function findAlsXz(g: Grid): Step | null {
  const alses = collectAls(g);
  for (let i = 0; i < alses.length; i++) {
    for (let j = i + 1; j < alses.length; j++) {
      const A = alses[i];
      const B = alses[j];
      if (A.cells.some((c) => B.cells.includes(c))) continue;
      const common = A.mask & B.mask;
      if (popcount(common) < 2) continue;
      for (const x of digitsOf(common)) {
        const ax = A.cells.filter((c) => g.cands[c] & bit(x));
        const bx = B.cells.filter((c) => g.cands[c] & bit(x));
        // restricted common: every x in A sees every x in B
        if (!ax.length || !bx.length) continue;
        if (!ax.every((a) => bx.every((b) => sees(a, b)))) continue;
        for (const z of digitsOf(common)) {
          if (z === x) continue;
          const zCells = [
            ...A.cells.filter((c) => g.cands[c] & bit(z)),
            ...B.cells.filter((c) => g.cands[c] & bit(z))
          ];
          const elims: CellDigit[] = [];
          for (let c = 0; c < 81; c++) {
            if (g.values[c] !== 0) continue;
            if (A.cells.includes(c) || B.cells.includes(c)) continue;
            if (!(g.cands[c] & bit(z))) continue;
            if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
          }
          if (elims.length) {
            return {
              tech: 'ALS_XZ',
              placements: [],
              eliminations: elims,
              primary: A.cells.flatMap((cell) =>
                digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
              ),
              secondary: B.cells.flatMap((cell) =>
                digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
              ),
              description: `ALS-XZ: sets ${cellNames(A.cells)} and ${cellNames(B.cells)} share restricted common ${x}; digit ${z} can be removed from cells seeing every ${z} of both sets.`
            };
          }
        }
      }
    }
  }
  return null;
}
