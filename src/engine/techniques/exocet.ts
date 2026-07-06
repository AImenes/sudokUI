import { Grid, bit, digitsOf, popcount, boxOf, rowOf, colOf, cellName, cellNames } from '../board';
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
export function findExocet(g: Grid): Step | null {
  // template cache per digit for this call (null = overflow, no claims)
  const templateCache = new Map<number, number[][] | null>();
  const templatesOf = (d: number): number[][] | null => {
    if (!templateCache.has(d)) templateCache.set(d, digitTemplates(g, d, 20000));
    return templateCache.get(d)!;
  };

  for (const rows of [true, false]) {
    const lineOf = rows ? rowOf : colOf;
    const crossOf = rows ? colOf : rowOf;
    const cellAt = (line: number, cross: number) => (rows ? line * 9 + cross : cross * 9 + line);

    for (let band = 0; band < 3; band++) {
      const lines = [band * 3, band * 3 + 1, band * 3 + 2];
      for (const baseLine of lines) {
        for (let baseBoxSlot = 0; baseBoxSlot < 3; baseBoxSlot++) {
          // the mini-line: 3 cells of baseLine within this box slot
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
            // T1 in slot A on one line, T2 in slot B on the other line
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

                    // nothing to gain? cheap pre-check before the proof
                    const nonBaseInTargets =
                      (g.cands[T1] & ~S) !== 0 || (g.cands[T2] & ~S) !== 0;
                    const deadBase = digitsOf(S).some(
                      (d) => !((g.cands[T1] | g.cands[T2]) & bit(d))
                    );
                    if (!nonBaseInTargets && !deadBase) continue;

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

                    const elims: CellDigit[] = [];
                    for (const T of [T1, T2]) {
                      for (const d of digitsOf(g.cands[T] & ~S)) elims.push({ cell: T, digit: d });
                    }
                    for (const d of digitsOf(S)) {
                      if ((g.cands[T1] | g.cands[T2]) & bit(d)) continue;
                      for (const B of [B1, B2]) {
                        if (g.cands[B] & bit(d)) elims.push({ cell: B, digit: d });
                      }
                    }
                    if (!elims.length) continue;
                    return {
                      tech: 'EXOCET',
                      placements: [],
                      eliminations: elims,
                      primary: [B1, B2].flatMap((cell) =>
                        digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))
                      ),
                      secondary: [T1, T2].flatMap((cell) =>
                        digitsOf(g.cands[cell] & S).map((digit) => ({ cell, digit }))
                      ),
                      description: `Exocet: base ${cellNames([B1, B2])} (${digitsOf(S).join('')}) with targets ${cellName(T1)} and ${cellName(T2)} — a complete placement analysis proves the base digits must land in the targets, so the targets keep only base candidates.`
                    };
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return null;
}
