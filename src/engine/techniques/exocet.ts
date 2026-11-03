import { Grid, UNITS, bit, boxOf, digitsOf, popcount, rowOf, colOf, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { digitTemplates } from './templates';
import { tr, listAnd, unitName } from '../text';

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
 *
 * The hint (docs/hint-readability-2026-11.md, H1 and M4) bands the base's
 * mini-line and the targets' two lines, and walks it a base digit a frame,
 * claiming no more than the board shows: where the digit's places in the
 * targets' two boxes and lines already force it into a target (or keep it
 * out of the base), it says so; elsewhere it gives what the proof counted,
 * the ways the board leaves to place all nine of the digit. Where the walk
 * keeps a digit out of the base that a target holds, the step leaves it
 * (only (a) and (b) are removed), and the frame says so and draws it in
 * neither the base nor the targets.
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
    return exocetStep(g, ex, elims);
  }
  return null;
}

/**
 * Why a base digit, if the base holds it, is in a target, or why the base
 * cannot hold it (`out`), in the words the board allows. The base's line
 * L and box Q have the digit in the base, so the targets' boxes X and Y put
 * theirs in the targets' lines A and B, one in each: X in A and Y in B (the
 * targets' own lines), or X in B and Y in A. Where a box has no place for it in a
 * line, that settles it: neither way (the base cannot hold it), or only
 * the first, where X's only place in A is T1 or Y's only place in B is T2.
 * Where the board's places do not settle it, the sentence gives what the
 * proof counted: the ways the board leaves to place all nine of the digit,
 * and how many of them put one in the base, every one of those with one in
 * a target. A digit the base cannot hold goes from the base only where
 * neither target holds it (findExocet); where a target does, the step
 * leaves it, so the sentence says only that it is not one of the base's two
 * digits, and that this step does not remove it.
 */
function digitText(
  g: Grid,
  d: number,
  base: number[],
  T1: number,
  T2: number,
  lineOf: (cell: number) => number,
  lineUnit: (line: number) => number
): { text: string; out: boolean } {
  const [X, Y] = [boxOf(T1), boxOf(T2)];
  const [lA, lB] = [lineOf(T1), lineOf(T2)];
  const holds = (c: number) => g.values[c] === d || (g.values[c] === 0 && !!(g.cands[c] & bit(d)));
  const at = (box: number, line: number) => UNITS[18 + box].filter((c) => lineOf(c) === line && holds(c));
  const [XA, XB, YA, YB] = [at(X, lA), at(X, lB), at(Y, lA), at(Y, lB)];
  const [boxX, boxY, lineA, lineB] = [unitName(18 + X), unitName(18 + Y), unitName(lineUnit(lA)), unitName(lineUnit(lB))];
  const own = XA.length > 0 && YB.length > 0;
  const crossed = XB.length > 0 && YA.length > 0;
  // the base cannot hold d: the step removes it there where neither target
  // holds it, and leaves it where one does, which the words then say
  const left = base.filter((c) => g.cands[c] & bit(d));
  const kept = !!((g.cands[T1] | g.cands[T2]) & bit(d));
  const leaves =
    left.length === 1 ? tr`This step does not remove it from ${cellName(left[0])}.` : tr`This step does not remove it from ${cellName(left[0])} or ${cellName(left[1])}.`;
  const out = (removed: string, notOne: string) => ({ text: kept ? `${notOne} ${leaves}` : removed, out: true });
  const says = (text: string) => ({ text, out: false });
  if (!own && !crossed) {
    if (!XA.length && !XB.length)
      return out(
        tr`If a base cell were ${d}, ${boxX} would need its ${d} in ${lineA} or ${lineB}, but it has none there, so neither base cell can be ${d}.`,
        tr`If a base cell were ${d}, ${boxX} would need its ${d} in ${lineA} or ${lineB}, but it has none there, so ${d} is not one of the base's two digits.`
      );
    if (!YA.length && !YB.length)
      return out(
        tr`If a base cell were ${d}, ${boxY} would need its ${d} in ${lineA} or ${lineB}, but it has none there, so neither base cell can be ${d}.`,
        tr`If a base cell were ${d}, ${boxY} would need its ${d} in ${lineA} or ${lineB}, but it has none there, so ${d} is not one of the base's two digits.`
      );
    if (!XA.length && !YA.length)
      return out(
        tr`If a base cell were ${d}, ${lineA} would need its ${d} from ${boxX} or ${boxY}, but neither has one there, so neither base cell can be ${d}.`,
        tr`If a base cell were ${d}, ${lineA} would need its ${d} from ${boxX} or ${boxY}, but neither has one there, so ${d} is not one of the base's two digits.`
      );
    return out(
      tr`If a base cell were ${d}, ${lineB} would need its ${d} from ${boxX} or ${boxY}, but neither has one there, so neither base cell can be ${d}.`,
      tr`If a base cell were ${d}, ${lineB} would need its ${d} from ${boxX} or ${boxY}, but neither has one there, so ${d} is not one of the base's two digits.`
    );
  }
  const onlyT1 = XA.length === 1 && XA[0] === T1;
  const onlyT2 = YB.length === 1 && YB[0] === T2;
  if (!crossed && (onlyT1 || onlyT2)) {
    const [box, line] = !XB.length ? [boxX, lineB] : [boxY, lineA];
    return says(
      onlyT1
        ? tr`If a base cell is ${d}, ${box} has no ${d} in ${line}, so ${boxX} puts its ${d} in ${lineA} and ${boxY} in ${lineB}, and the only ${d} of ${boxX} in ${lineA} is the target ${cellName(T1)}.`
        : tr`If a base cell is ${d}, ${box} has no ${d} in ${line}, so ${boxX} puts its ${d} in ${lineA} and ${boxY} in ${lineB}, and the only ${d} of ${boxY} in ${lineB} is the target ${cellName(T2)}.`
    );
  }
  // what the proof counted (collectExocets): it never overflows on a find
  const all = digitTemplates(g, d, 20000) ?? [];
  const n = all.length;
  const m = all.filter((t) => t.includes(base[0]) || t.includes(base[1])).length;
  if (!m)
    return n === 1
      ? out(
          tr`The board leaves one way to place all nine ${d}s, and it uses neither base cell, so neither can be ${d}.`,
          tr`The board leaves one way to place all nine ${d}s, and it uses neither base cell, so ${d} is not one of the base's two digits.`
        )
      : out(
          tr`None of the ${n} ways the board leaves to place all nine ${d}s uses a base cell, so neither base cell can be ${d}.`,
          tr`None of the ${n} ways the board leaves to place all nine ${d}s uses a base cell, so ${d} is not one of the base's two digits.`
        );
  if (m === n)
    return says(
      n === 1
        ? tr`If a base cell is ${d}, so is a target: the board leaves one way to place all nine ${d}s, and it uses a base cell and a target.`
        : tr`If a base cell is ${d}, so is a target: the board leaves ${n} ways to place all nine ${d}s, and each uses a base cell and a target.`
    );
  // the count of ways through the base with its noun, never a bare number a player reads as a digit
  return says(
    m === 1
      ? tr`If a base cell is ${d}, so is a target: the board leaves ${n} ways to place all nine ${d}s; one of those ways uses a base cell, and it uses a target too.`
      : tr`If a base cell is ${d}, so is a target: the board leaves ${n} ways to place all nine ${d}s; ${m} of those ways use a base cell, and each of them uses a target too.`
  );
}

/**
 * The step: the base's candidates blue on its mini-line's band, the
 * targets' base digits gold on their lines' dashed bands, and a walk that
 * takes the base, the targets' lines, then each base digit alone. Each
 * frame's legend names what that frame draws (G23): the targets by their
 * lines before the walk has argued what they hold, then a digit in the base
 * and in the targets, or the bands alone where the frame draws no candidate
 * of the role (a digit no target holds; a digit the walk keeps out of the
 * base that the step leaves, which the frame does not draw at all). Its
 * Copy step line is the one it always was (src/content/eureka.ts)
 */
function exocetStep(g: Grid, ex: ProvenExocet, elims: CellDigit[]): Step {
  const { rows, S } = ex;
  const base = [...ex.base].sort((a, b) => a - b);
  const [T1, T2] = [...ex.targets].sort((a, b) => a - b);
  const lineOf = (c: number) => (rows ? rowOf(c) : colOf(c));
  const lineUnit = (l: number) => (rows ? l : 9 + l);
  const Q = boxOf(base[0]);
  const digits = digitsOf(S);
  const [B1, B2, n1, n2] = [...base, T1, T2].map(cellName);
  const [line, box] = [unitName(lineUnit(ex.line)), unitName(18 + Q)];
  const [lineA, lineB, boxX, boxY] = [unitName(lineUnit(lineOf(T1))), unitName(lineUnit(lineOf(T2))), unitName(18 + boxOf(T1)), unitName(18 + boxOf(T2))];
  // a base digit neither target holds, which the base therefore cannot
  const dead = digits.filter((d) => !((g.cands[T1] | g.cands[T2]) & bit(d)));
  const intoTargets = elims.some((e) => e.cell === T1 || e.cell === T2);
  return {
    tech: 'EXOCET',
    placements: [],
    eliminations: elims,
    primary: base.flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit }))),
    secondary: [T1, T2].flatMap((cell) => digitsOf(g.cands[cell] & S).map((digit) => ({ cell, digit }))),
    units: [
      { unit: lineUnit(ex.line), role: 'primary', within: 18 + Q },
      { unit: lineUnit(lineOf(T1)), role: 'secondary' },
      { unit: lineUnit(lineOf(T2)), role: 'secondary' }
    ],
    labels: {
      primary: tr`the base: two different digits of ${listAnd(digits)}, one in each cell`,
      secondary: tr`the targets, in ${lineA} and ${lineB}: each digit the base holds is in one of them`
    },
    walk: {
      frames: [
        { text: tr`${B1} and ${B2}, where ${line} meets ${box}, hold only ${listAnd(digits)} between them, and they see each other, so they hold two different ones of these digits.`, show: ['primary'] },
        {
          text: tr`The targets: ${n1} in ${lineA} and ${n2} in ${lineB}. Whatever digit a base cell holds, ${line} and ${box} have it there, so ${boxX} and ${boxY} must put it in ${lineA} and ${lineB}, one in each.`,
          show: ['secondary'],
          labels: { secondary: tr`the targets, in ${lineA} and ${lineB}` }
        },
        ...digits.map((d) => {
          const { text, out } = digitText(g, d, base, T1, T2, lineOf, lineUnit);
          const inTargets = !!((g.cands[T1] | g.cands[T2]) & bit(d));
          // kept out of the base by the walk, left by the step: drawn in no cell, so not read as the base's
          const left = out && inTargets;
          return {
            text,
            show: [] as ('primary' | 'secondary')[],
            digits: left ? [] : [d],
            labels: {
              primary: left ? tr`the base, where ${line} meets ${box}` : tr`${d} in the base`,
              secondary: inTargets && !left ? tr`${d} in the targets` : tr`the targets' lines, ${lineA} and ${lineB}`
            }
          };
        })
      ],
      ...(intoTargets && { lead: tr`The base holds two different digits, and each is in a target, so the two targets hold them both and nothing else.` })
    },
    description: dead.length
      ? tr`${B1} and ${B2} hold two different digits of ${listAnd(digits)}, and the board leaves no way to place either of them in the base without one in ${n1} or ${n2}. So these targets hold the base's two digits and nothing else, and the base cannot hold ${listAnd(dead)}, which neither target can.`
      : tr`${B1} and ${B2} hold two different digits of ${listAnd(digits)}, and the board leaves no way to place either of them in the base without one in ${n1} or ${n2}. So these targets hold the base's two digits and nothing else.`
  };
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
        description: tr`Double Exocet: two proven exocets on the same line share the base set ${digitsOf(a.S).join('/')}: the four base cells ${cellNames([...baseCells])} must hold exactly those four digits, so they fall from the rest of the line.`
      };
    }
  }
  return null;
}
