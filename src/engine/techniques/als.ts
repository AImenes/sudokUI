import { Grid, UNITS, bit, digitsOf, popcount, sees, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { combinations } from './subsets';

export interface Als {
  cells: number[];
  mask: number;
}

/** Almost Locked Sets: n cells in one unit with n+1 candidates. */
export function collectAls(g: Grid, maxSize = 4, cap = 600): Als[] {
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

/** x is a restricted common of A and B: every x-cell of A sees every x-cell of B. */
function restrictedCommon(g: Grid, A: Als, B: Als, x: number): boolean {
  const ax = A.cells.filter((c) => g.cands[c] & bit(x));
  const bx = B.cells.filter((c) => g.cands[c] & bit(x));
  if (!ax.length || !bx.length) return false;
  return ax.every((a) => bx.every((b) => sees(a, b)));
}

function alsXzStep(
  g: Grid,
  A: Als,
  B: Als,
  x: number,
  z: number,
  tech: 'ALS_XZ' | 'WXYZ_WING'
): Step | null {
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
  if (!elims.length) return null;
  const name = tech === 'WXYZ_WING' ? 'WXYZ-Wing' : 'ALS-XZ';
  return {
    tech,
    placements: [],
    eliminations: elims,
    primary: A.cells.flatMap((cell) =>
      digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
    ),
    secondary: B.cells.flatMap((cell) =>
      digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
    ),
    description: `${name}: sets ${cellNames(A.cells)} and ${cellNames(B.cells)} share restricted common ${x}; digit ${z} can be removed from cells seeing every ${z} of both sets.`
  };
}

function findAlsXzPairs(
  g: Grid,
  accept: (A: Als, B: Als) => boolean,
  tech: 'ALS_XZ' | 'WXYZ_WING'
): Step | null {
  const alses = collectAls(g);
  for (let i = 0; i < alses.length; i++) {
    for (let j = i + 1; j < alses.length; j++) {
      const A = alses[i];
      const B = alses[j];
      if (!accept(A, B)) continue;
      if (A.cells.some((c) => B.cells.includes(c))) continue;
      const common = A.mask & B.mask;
      if (popcount(common) < 2) continue;
      for (const x of digitsOf(common)) {
        if (!restrictedCommon(g, A, B, x)) continue;
        for (const z of digitsOf(common)) {
          if (z === x) continue;
          const step = alsXzStep(g, A, B, x, z, tech);
          if (step) return step;
        }
      }
    }
  }
  return null;
}

/** WXYZ-Wing: the 4-cell/4-candidate special case of ALS-XZ (apex + 3-cell set). */
export function findWxyzWing(g: Grid): Step | null {
  return findAlsXzPairs(
    g,
    (A, B) =>
      Math.min(A.cells.length, B.cells.length) === 1 &&
      Math.max(A.cells.length, B.cells.length) === 3 &&
      popcount(A.mask | B.mask) === 4,
    'WXYZ_WING'
  );
}

export function findAlsXz(g: Grid): Step | null {
  return findAlsXzPairs(g, () => true, 'ALS_XZ');
}

/**
 * Death Blossom: a stem cell whose every candidate p links to a petal ALS
 * (all p-cells of the petal see the stem). Whatever the stem is, one petal
 * becomes a locked set, so a digit z common to all petals is placed in one of
 * them; cells seeing every z of every petal lose z.
 */
export function findDeathBlossom(g: Grid): Step | null {
  const alses = collectAls(g);
  for (let stem = 0; stem < 81; stem++) {
    if (g.values[stem] !== 0) continue;
    const stemDigits = digitsOf(g.cands[stem]);
    if (stemDigits.length < 2 || stemDigits.length > 3) continue;
    // petal candidates per stem digit
    const petals: Als[][] = stemDigits.map((p) =>
      alses
        .filter(
          (A) =>
            !A.cells.includes(stem) &&
            A.mask & bit(p) &&
            A.cells
              .filter((c) => g.cands[c] & bit(p))
              .every((c) => sees(c, stem))
        )
        .slice(0, 16)
    );
    if (petals.some((list) => list.length === 0)) continue;

    const pick = (idx: number, chosen: Als[]): Step | null => {
      if (idx === stemDigits.length) {
        // digits common to all petals, excluding stem candidates
        let common = 0x1ff & ~g.cands[stem];
        for (const A of chosen) common &= A.mask;
        for (const z of digitsOf(common)) {
          const zCells = chosen.flatMap((A) =>
            A.cells.filter((c) => g.cands[c] & bit(z))
          );
          if (!zCells.length) continue;
          const inPattern = new Set([stem, ...chosen.flatMap((A) => A.cells)]);
          const elims: CellDigit[] = [];
          for (let c = 0; c < 81; c++) {
            if (g.values[c] !== 0 || inPattern.has(c)) continue;
            if (!(g.cands[c] & bit(z))) continue;
            if (zCells.every((zc) => sees(c, zc))) elims.push({ cell: c, digit: z });
          }
          if (elims.length) {
            return {
              tech: 'DEATH_BLOSSOM',
              placements: [],
              eliminations: elims,
              primary: digitsOf(g.cands[stem]).map((digit) => ({ cell: stem, digit })),
              secondary: chosen.flatMap((A) =>
                A.cells.flatMap((cell) =>
                  digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
                )
              ),
              description: `Death Blossom: stem ${cellName(stem)} links each of its candidates to a petal set; whichever digit the stem takes, some petal locks and places ${z}, so ${z} is removed from cells seeing every ${z} of all petals.`
            };
          }
        }
        return null;
      }
      for (const A of petals[idx]) {
        // petals must not overlap each other
        if (chosen.some((B) => B.cells.some((c) => A.cells.includes(c)))) continue;
        const res = pick(idx + 1, [...chosen, A]);
        if (res) return res;
      }
      return null;
    };
    const step = pick(0, []);
    if (step) return step;
  }
  return null;
}
