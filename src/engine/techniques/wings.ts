import { Grid, PEERS, bit, digitsOf, popcount, sees, cellName } from '../board';
import { Step, CellDigit, alternatingLinks } from '../steps';
import { strongLinks } from './singleDigit';
import { tr, listAnd } from '../text';

/**
 * Wings — small pivot-and-pincer patterns built on bivalue cells.
 *
 * - XY-Wing: pivot XY sees pincers XZ and YZ; whichever value the pivot
 *   takes, some pincer becomes Z, so cells seeing both pincers lose Z.
 * - XYZ-Wing: like XY-Wing but the pivot also holds Z, so eliminations must
 *   additionally see the pivot.
 * - W-Wing: two XZ bivalue cells joined through a strong link on X; one of
 *   the two must be Z.
 * - WXYZ-Wing: four cells, four digits, one non-restricted digit Z that must
 *   land inside the pattern — an ALS-XZ of a bivalue cell and three cells,
 *   found and drawn as one in als.ts.
 */

/** the removals' cells named, and whether there is one: a lead's verb agrees with them */
const removed = (elims: CellDigit[]) => ({ cells: listAnd(elims.map((e) => cellName(e.cell))), one: elims.length === 1 });

/** a pincer's frame: if the pivot takes the digit it shares, the pincer is left with z */
const pincerText = (g: Grid, pivot: number, pincer: number, shared: number, z: number) => {
  const [a, b] = digitsOf(g.cands[pincer]);
  return tr`If ${cellName(pivot)} is ${shared}, the pincer ${cellName(pincer)} (only ${a} and ${b}) must be ${z}.`;
};

function collectZElims(
  g: Grid,
  z: number,
  mustSee: number[],
  exclude: number[]
): CellDigit[] {
  const elims: CellDigit[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] !== 0 || exclude.includes(c)) continue;
    if (!(g.cands[c] & bit(z))) continue;
    if (mustSee.every((m) => sees(c, m))) elims.push({ cell: c, digit: z });
  }
  return elims;
}

export function findXYWing(g: Grid): Step | null {
  const bivalue: number[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) bivalue.push(c);
  }
  for (const pivot of bivalue) {
    const [x, y] = digitsOf(g.cands[pivot]);
    const wings = bivalue.filter((c) => c !== pivot && sees(c, pivot));
    for (const w1 of wings) {
      if (!(g.cands[w1] & bit(x)) || g.cands[w1] === g.cands[pivot]) continue;
      const z = digitsOf(g.cands[w1]).find((d) => d !== x)!;
      if (z === y) continue;
      for (const w2 of wings) {
        if (w2 === w1) continue;
        if (g.cands[w2] !== (bit(y) | bit(z))) continue;
        const elims = collectZElims(g, z, [w1, w2], [pivot, w1, w2]);
        if (!elims.length) continue;
        const out = removed(elims);
        // coloured by what each digit does (the readability report's M3): the
        // pivot's digits and the one each pincer shares with it, which tie
        // the pincer to the pivot, and z in each pincer; walked cell by cell
        // (H1), each frame's legend naming only what it draws (the pivot,
        // then one pincer). The Copy step line is written from the pivot and
        // the pincers' z as it always was (src/content/eureka.ts wingGroups)
        return {
          tech: 'XY_WING',
          placements: [],
          eliminations: elims,
          primary: [{ cell: pivot, digit: x }, { cell: pivot, digit: y }, { cell: w1, digit: x }, { cell: w2, digit: y }],
          secondary: [{ cell: w1, digit: z }, { cell: w2, digit: z }],
          labels: { primary: tr`the pivot and the digit each pincer shares with it`, secondary: tr`${z} in each pincer` },
          walk: {
            frames: [
              { text: tr`The pivot ${cellName(pivot)} holds only ${listAnd([x, y])}.`, show: ['primary'], cells: [pivot], labels: { primary: tr`the pivot` } },
              {
                text: pincerText(g, pivot, w1, x, z),
                show: ['secondary'],
                cells: [w1],
                labels: { primary: tr`the pivot and the digit the pincer shares with it`, secondary: tr`${z} in the pincer` }
              },
              { text: pincerText(g, pivot, w2, y, z), show: [], cells: [w2] }
            ],
            lead: out.one ? tr`Either way a pincer is ${z}; ${out.cells} sees both.` : tr`Either way a pincer is ${z}; ${out.cells} see both.`
          },
          description: tr`XY-Wing: pivot ${cellName(pivot)} (${digitsOf(g.cands[pivot]).join('/')}) with pincers ${cellName(w1)} (${digitsOf(g.cands[w1]).join('/')}) and ${cellName(w2)} (${digitsOf(g.cands[w2]).join('/')}); one pincer must be ${z}, so ${z} is removed from cells seeing both.`
        };
      }
    }
  }
  return null;
}

export function findXYZWing(g: Grid): Step | null {
  for (let pivot = 0; pivot < 81; pivot++) {
    if (g.values[pivot] !== 0 || popcount(g.cands[pivot]) !== 3) continue;
    const pivotMask = g.cands[pivot];
    const wings = PEERS[pivot].filter(
      (c) =>
        g.values[c] === 0 &&
        popcount(g.cands[c]) === 2 &&
        (g.cands[c] & pivotMask) === g.cands[c]
    );
    for (let i = 0; i < wings.length; i++) {
      for (let j = i + 1; j < wings.length; j++) {
        const shared = g.cands[wings[i]] & g.cands[wings[j]];
        if (popcount(shared) !== 1) continue;
        if ((g.cands[wings[i]] | g.cands[wings[j]]) !== pivotMask) continue;
        const z = digitsOf(shared)[0];
        const elims = collectZElims(g, z, [pivot, wings[i], wings[j]], [pivot, wings[i], wings[j]]);
        if (!elims.length) continue;
        const out = removed(elims);
        // the pivot's other two digits, each with the pincer that shares it,
        // in the order of the digits
        const [x, y] = digitsOf(pivotMask & ~bit(z));
        const [wx, wy] = [wings[i], wings[j]].sort((a, b) => (g.cands[a] & bit(x) ? -1 : 1) - (g.cands[b] & bit(x) ? -1 : 1));
        // coloured by what each digit does (M3): z in all three cells, at
        // least one of which is z whichever digit the pivot takes, and x and
        // y, which tie each pincer to the pivot; walked cell by cell (H1),
        // each frame's legend naming only what it draws
        return {
          tech: 'XYZ_WING',
          placements: [],
          eliminations: elims,
          primary: [{ cell: pivot, digit: x }, { cell: pivot, digit: y }, { cell: wx, digit: x }, { cell: wy, digit: y }],
          secondary: [
            { cell: pivot, digit: z },
            { cell: wx, digit: z },
            { cell: wy, digit: z }
          ],
          labels: { primary: tr`the pivot's ${x} and ${y}, and the one each pincer shares with it`, secondary: tr`${z} in all three cells` },
          walk: {
            frames: [
              {
                text: tr`The pivot ${cellName(pivot)} holds only ${listAnd(digitsOf(pivotMask))}.`,
                show: ['primary', 'secondary'],
                cells: [pivot],
                labels: { primary: tr`the pivot's ${x} and ${y}`, secondary: tr`${z} in the pivot` }
              },
              {
                text: pincerText(g, pivot, wx, x, z),
                show: [],
                cells: [wx],
                labels: { primary: tr`the pivot's ${x} and ${y}, and the one the pincer shares with it`, secondary: tr`${z} in the pivot and the pincer` }
              },
              { text: pincerText(g, pivot, wy, y, z), show: [], cells: [wy] }
            ],
            lead: out.one
              ? tr`Or the pivot is ${z} itself. Whichever digit it takes, one of the three cells is ${z}; ${out.cells} sees all three.`
              : tr`Or the pivot is ${z} itself. Whichever digit it takes, one of the three cells is ${z}; ${out.cells} see all three.`
          },
          description: tr`XYZ-Wing: pivot ${cellName(pivot)} (${digitsOf(pivotMask).join('/')}) with pincers ${cellName(wings[i])} (${digitsOf(g.cands[wings[i]]).join('/')}) and ${cellName(wings[j])} (${digitsOf(g.cands[wings[j]]).join('/')}). Whichever digit the pivot takes, one of the three cells is ${z}, so ${z} is removed from every cell that sees all three.`
        };
      }
    }
  }
  return null;
}

export function findWWing(g: Grid): Step | null {
  const bivalue: number[] = [];
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 2) bivalue.push(c);
  }
  for (let i = 0; i < bivalue.length; i++) {
    for (let j = i + 1; j < bivalue.length; j++) {
      const A = bivalue[i];
      const B = bivalue[j];
      if (g.cands[A] !== g.cands[B] || sees(A, B)) continue;
      const [x, y] = digitsOf(g.cands[A]);
      for (const [linkDigit, elimDigit] of [
        [x, y],
        [y, x]
      ]) {
        for (const link of strongLinks(g, linkDigit)) {
          const ends = [link.a, link.b];
          if (ends.includes(A) || ends.includes(B)) continue;
          const [e1, e2] = ends;
          const connects =
            (sees(e1, A) && sees(e2, B)) || (sees(e1, B) && sees(e2, A));
          if (!connects) continue;
          const elims = collectZElims(g, elimDigit, [A, B], [A, B, e1, e2]);
          if (!elims.length) continue;
          return {
            tech: 'W_WING',
            truth: 'derived',
            placements: [],
            eliminations: elims,
            primary: [
              { cell: A, digit: elimDigit },
              { cell: B, digit: elimDigit }
            ],
            secondary: [
              { cell: e1, digit: linkDigit },
              { cell: e2, digit: linkDigit }
            ],
            labels: { primary: tr`cells holding ${x} and ${y}`, secondary: tr`strong link on ${linkDigit}` },
            // full AIC: z@A =s= w@A -w- w@e1 =s= w@e2 -w- w@B =s= z@B; each
            // weak link joins two cells that see each other, so the order
            // goes by both ends (e1 can see A and B while only e2 sees B)
            links: alternatingLinks(
              (sees(e1, A) && sees(e2, B)
                ? [
                    { cell: A, digit: elimDigit },
                    { cell: A, digit: linkDigit },
                    { cell: e1, digit: linkDigit },
                    { cell: e2, digit: linkDigit },
                    { cell: B, digit: linkDigit },
                    { cell: B, digit: elimDigit }
                  ]
                : [
                    { cell: A, digit: elimDigit },
                    { cell: A, digit: linkDigit },
                    { cell: e2, digit: linkDigit },
                    { cell: e1, digit: linkDigit },
                    { cell: B, digit: linkDigit },
                    { cell: B, digit: elimDigit }
                  ]
              ).map((cd) => [cd])
            ),
            description: tr`W-Wing: ${cellName(A)} and ${cellName(B)} both hold ${x}/${y}; the strong link on ${linkDigit} (${cellName(e1)}–${cellName(e2)}) forces one of them to be ${elimDigit}, removing ${elimDigit} from cells seeing both.`
          };
        }
      }
    }
  }
  return null;
}
