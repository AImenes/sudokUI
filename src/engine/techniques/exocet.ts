import { Grid, bit, digitsOf, popcount, rowOf, colOf, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { digitTemplates } from './templates';

/**
 * Exocet (sudokuwiki.org/Exocet), with a per-position PROOF instead of
 * pattern-condition heuristics.
 *
 * Geometry (JExocet shape, row version; columns symmetric): two BASE cells
 * in one mini-line of box Q with 3–4 candidates in total (the base set S);
 * two TARGET cells in the band's other two boxes, on the band's other two
 * lines — so targets never see the base or each other.
 *
 * The exocet property — "the two digits the base takes both appear in the
 * targets" — is not assumed from the shape. It is PROVEN per position, per
 * digit, by complete template enumeration: for every base digit d, every
 * valid full placement of d that includes a base cell must include a target.
 * If any digit's enumeration overflows its cap, no claim is made.
 *
 * Once proven, in any solution val(B1) and val(B2) are two different base
 * digits whose templates pass through the base, hence each occupies a
 * target — so the two targets hold exactly the two base digits. Two
 * elimination classes follow directly:
 *  (a) non-base candidates cannot sit in a target;
 *  (b) a base digit with no candidate in either target cannot be a base
 *      value, so it falls from both base cells.
 * (Mirror-cell and cross-line eliminations from the S-cell theory are
 * deliberately not implemented — they carry no per-position proof here.)
 */

export interface ProvenExocet {
  rows: boolean; // orientation of the base line
  line: number; // 0-8 within the orientation
  boxSlot: number; // which third of the line holds the base
  S: number; // base candidate mask (3-4 digits)
  base: [number, number];
  targets: [number, number];
}

/**
 * All template-proven exocets of the position. `needElims` restricts the
 * search to patterns whose basic eliminations are non-empty (cheap cull for
 * the single-exocet finder); the double-exocet finder needs every proven
 * pattern regardless.
 */
export function collectExocets(g: Grid, needElims: boolean): ProvenExocet[] {
  const out: ProvenExocet[] = [];
  const templateCache = new Map<number, number[][] | null>();
  const templatesOf = (d: number): number[][] | null => {
    if (!templateCache.has(d)) templateCache.set(d, digitTemplates(g, d, 20000));
    return templateCache.get(d)!;
  };

  for (const rows of [true, false]) {
    const cellAt = (line: number, cross: number) => (rows ? line * 9 + cross : cross * 9 + line);

    for (let band = 0; band < 3; band++) {
      const lines = [band * 3, band * 3 + 1, band * 3 + 2];
      for (const baseLine of lines) {
        for (let baseBoxSlot = 0; baseBoxSlot < 3; baseBoxSlot++) {
          const mini = [0, 1, 2].map((k) => cellAt(baseLine, baseBoxSlot * 3 + k));
          for (let skip = 0; skip < 3; skip++) {
            const B1 = mini[(skip + 1) % 3];
            const B2 = mini[(skip + 2) % 3];
            if (g.values[B1] !== 0 || g.values[B2] !== 0) continue;
            if (popcount(g.cands[B1]) < 2 || popcount(g.cands[B2]) < 2) continue;
            const S = g.cands[B1] | g.cands[B2];
            if (popcount(S) < 3 || popcount(S) > 4) continue;

            const otherLines = lines.filter((l) => l !== baseLine);
            const otherSlots = [0, 1, 2].filter((s) => s !== baseBoxSlot);
            for (const [slotA, slotB] of [
              [otherSlots[0], otherSlots[1]],
              [otherSlots[1], otherSlots[0]]
            ]) {
              for (const lineA of otherLines) {
                const lineB = otherLines.find((l) => l !== lineA)!;
                for (let ka = 0; ka < 3; ka++) {
                  const T1 = cellAt(lineA, slotA * 3 + ka);
                  if (g.values[T1] !== 0 || !(g.cands[T1] & S)) continue;
                  for (let kb = 0; kb < 3; kb++) {
                    const T2 = cellAt(lineB, slotB * 3 + kb);
                    if (g.values[T2] !== 0 || !(g.cands[T2] & S)) continue;

                    if (needElims) {
                      const nonBaseInTargets =
                        (g.cands[T1] & ~S) !== 0 || (g.cands[T2] & ~S) !== 0;
                      const deadBase = digitsOf(S).some(
                        (d) => !((g.cands[T1] | g.cands[T2]) & bit(d))
                      );
                      if (!nonBaseInTargets && !deadBase) continue;
                    }

                    // the proof: every base digit's templates through the
                    // base must pass through a target
                    let proven = true;
                    for (const d of digitsOf(S)) {
                      const templates = templatesOf(d);
                      if (templates === null) {
                        proven = false; // overflow: no claim
                        break;
                      }
                      for (const t of templates) {
                        const throughBase = t.includes(B1) || t.includes(B2);
                        if (throughBase && !t.includes(T1) && !t.includes(T2)) {
                          proven = false;
                          break;
                        }
                      }
                      if (!proven) break;
                    }
                    if (!proven) continue;

                    out.push({
                      rows,
                      line: baseLine,
                      boxSlot: baseBoxSlot,
                      S,
                      base: [B1, B2],
                      targets: [T1, T2]
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return out;
}

export function findExocet(g: Grid): Step | null {
  for (const ex of collectExocets(g, true)) {
    const { S, base, targets } = ex;
    const elims: CellDigit[] = [];
    for (const T of targets) {
      for (const d of digitsOf(g.cands[T] & ~S)) elims.push({ cell: T, digit: d });
    }
    for (const d of digitsOf(S)) {
      if ((g.cands[targets[0]] | g.cands[targets[1]]) & bit(d)) continue;
      for (const B of base) {
        if (g.cands[B] & bit(d)) elims.push({ cell: B, digit: d });
      }
    }
    if (!elims.length) continue;
    return {
      tech: 'EXOCET',
      placements: [],
      eliminations: elims,
      primary: base.flatMap((cell) =>
        digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
      ),
      secondary: targets.flatMap((cell) =>
        digitsOf(g.cands[cell] & S).map((digit) => ({ cell, digit }))
      ),
      description: `Exocet: base ${cellNames(base)} (${digitsOf(S).join('')}) with targets ${cellName(targets[0])} and ${cellName(targets[1])}: a complete placement analysis proves the base digits must land in the targets, so the targets keep only base candidates.`
    };
  }
  return null;
}

/**
 * Double Exocet: two proven exocets whose bases share the SAME line and the
 * SAME four-digit base set, in different boxes. The four base cells sit in
 * one line, each pair drawn from S with |S| = 4, so their values are four
 * distinct digits — exactly S. Every other cell of that line therefore
 * holds a non-S digit: S falls from the rest of the line.
 */
export function findDoubleExocet(g: Grid): Step | null {
  const all = collectExocets(g, false);
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const a = all[i];
      const b = all[j];
      if (a.rows !== b.rows || a.line !== b.line) continue;
      if (a.boxSlot === b.boxSlot) continue;
      if (a.S !== b.S || popcount(a.S) !== 4) continue;

      const baseCells = new Set([...a.base, ...b.base]);
      if (baseCells.size !== 4) continue;
      const lineCells = a.rows
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8].map((c) => a.line * 9 + c)
        : [0, 1, 2, 3, 4, 5, 6, 7, 8].map((r) => r * 9 + a.line);
      const elims: CellDigit[] = [];
      for (const c of lineCells) {
        if (baseCells.has(c) || g.values[c] !== 0) continue;
        for (const d of digitsOf(g.cands[c] & a.S)) elims.push({ cell: c, digit: d });
      }
      if (!elims.length) continue;
      return {
        tech: 'DOUBLE_EXOCET',
        placements: [],
        eliminations: elims,
        primary: [...baseCells].flatMap((cell) =>
          digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
        ),
        secondary: [...a.targets, ...b.targets].flatMap((cell) =>
          digitsOf(g.cands[cell] & a.S).map((digit) => ({ cell, digit }))
        ),
        description: `Double Exocet: two proven exocets on the same line share the base set ${digitsOf(a.S).join('')}: the four base cells ${cellNames([...baseCells])} must hold exactly those four digits, so they fall from the rest of the line.`
      };
    }
  }
  return null;
}
