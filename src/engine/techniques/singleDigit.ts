import {
  Grid,
  UNITS,
  bit,
  rowOf,
  colOf,
  boxOf,
  sees,
  cellName,
  cellNames
} from '../board';
import { Step, CellDigit, alternatingLinks } from '../steps';
import { tr, unitName } from '../text';

type LinkType = 'row' | 'col' | 'box';
interface StrongLink {
  a: number;
  b: number;
  type: LinkType;
}

/** Conjugate pairs (units with exactly two candidates) for a digit. */
export function strongLinks(g: Grid, d: number): StrongLink[] {
  const links: StrongLink[] = [];
  const mask = bit(d);
  for (let u = 0; u < 27; u++) {
    const cells = UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & mask);
    if (cells.length === 2) {
      links.push({
        a: cells[0],
        b: cells[1],
        type: u < 9 ? 'row' : u < 18 ? 'col' : 'box'
      });
    }
  }
  return links;
}

/** the house in which a strong link's two cells are the only places for its digit */
const linkUnit = (l: StrongLink) =>
  l.type === 'row' ? rowOf(l.a) : l.type === 'col' ? 9 + colOf(l.a) : 18 + boxOf(l.a);

/**
 * Turbot-fish family: two strong links joined by a weak link; cells seeing
 * both free ends lose the digit. `variant` selects the HoDoKu classification:
 * skyscraper (two parallel line links), 2-string kite (row+col joined in a
 * box) or turbot fish (everything else, incl. box links).
 */
export function findTurbotFamily(
  g: Grid,
  variant: 'SKYSCRAPER' | 'TWO_STRING_KITE' | 'TURBOT_FISH'
): Step | null {
  for (let d = 1; d <= 9; d++) {
    const links = strongLinks(g, d);
    for (let i = 0; i < links.length; i++) {
      for (let j = i + 1; j < links.length; j++) {
        const l1 = links[i];
        const l2 = links[j];
        const cells1 = [l1.a, l1.b];
        const cells2 = [l2.a, l2.b];
        if (cells1.some((c) => cells2.includes(c))) continue;
        for (const p of cells1) {
          for (const q of cells2) {
            if (!sees(p, q)) continue;
            const a = p === l1.a ? l1.b : l1.a;
            const b = q === l2.a ? l2.b : l2.a;
            if (a === b || sees(a, b)) continue;
            // classify the pattern
            let kind: typeof variant;
            if (
              (l1.type === 'row' && l2.type === 'row') ||
              (l1.type === 'col' && l2.type === 'col')
            ) {
              kind = 'SKYSCRAPER';
            } else if (
              ((l1.type === 'row' && l2.type === 'col') ||
                (l1.type === 'col' && l2.type === 'row')) &&
              boxOf(p) === boxOf(q)
            ) {
              kind = 'TWO_STRING_KITE';
            } else {
              kind = 'TURBOT_FISH';
            }
            if (kind !== variant) continue;
            const pattern = [...cells1, ...cells2];
            const elims: CellDigit[] = [];
            for (let c = 0; c < 81; c++) {
              if (pattern.includes(c) || g.values[c] !== 0) continue;
              if (!(g.cands[c] & bit(d))) continue;
              if (sees(c, a) && sees(c, b)) elims.push({ cell: c, digit: d });
            }
            if (!elims.length) continue;
            // the names stay English in every language (docs/translations.md)
            const names: Record<typeof variant, string> = {
              SKYSCRAPER: tr`Skyscraper`,
              TWO_STRING_KITE: tr`2-String Kite`,
              TURBOT_FISH: tr`Turbot Fish`
            };
            return {
              tech: variant,
              truth: 'derived',
              placements: [],
              eliminations: elims,
              primary: pattern.map((cell) => ({ cell, digit: d })),
              labels: { primary: tr`the two strong links on ${d}` },
              links: alternatingLinks([a, p, q, b].map((cell) => [{ cell, digit: d }])),
              // each link named by the house it is a conjugate pair in: a
              // box link's two cells may share a line that holds more
              description: tr`${names[variant]} on ${d}: ${cellName(l1.a)} and ${cellName(l1.b)} are the only places for ${d} in ${unitName(linkUnit(l1))}, as are ${cellName(l2.a)} and ${cellName(l2.b)} in ${unitName(linkUnit(l2))}, and ${cellName(p)} sees ${cellName(q)}. If ${cellName(a)} is not ${d}, ${cellName(p)} is, so ${cellName(q)} is not, so ${cellName(b)} is: one of ${cellName(a)} and ${cellName(b)} is ${d}, and ${d} is removed from every cell that sees both.`
            };
          }
        }
      }
    }
  }
  return null;
}

/**
 * Empty Rectangle: in a box all candidates of a digit lie on one row+column
 * cross; combined with a conjugate pair in a line, one candidate falls.
 */
export function findEmptyRectangle(g: Grid): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    for (let b = 0; b < 9; b++) {
      const boxCells = UNITS[18 + b].filter((c) => g.values[c] === 0 && g.cands[c] & mask);
      if (boxCells.length < 2) continue;
      const rows = [...new Set(boxCells.map(rowOf))];
      const cols = [...new Set(boxCells.map(colOf))];
      if (rows.length < 2 && cols.length < 2) continue; // single line: locked candidates
      const boxRows = [Math.floor(b / 3) * 3, Math.floor(b / 3) * 3 + 1, Math.floor(b / 3) * 3 + 2];
      const boxCols = [(b % 3) * 3, (b % 3) * 3 + 1, (b % 3) * 3 + 2];
      for (const erRow of boxRows) {
        for (const erCol of boxCols) {
          if (!boxCells.every((c) => rowOf(c) === erRow || colOf(c) === erCol)) continue;
          // need candidates in both arms for a genuine ER
          if (!boxCells.some((c) => rowOf(c) === erRow && colOf(c) !== erCol)) continue;
          if (!boxCells.some((c) => colOf(c) === erCol && rowOf(c) !== erRow)) continue;
          // conjugate pair in a column crossing the ER row
          for (let x = 0; x < 9; x++) {
            if (Math.floor(x / 3) === b % 3) continue; // outside the box stack
            const colCells = UNITS[9 + x].filter(
              (c) => g.values[c] === 0 && g.cands[c] & mask
            );
            if (colCells.length !== 2) continue;
            const inErRow = colCells.find((c) => rowOf(c) === erRow);
            const other = colCells.find((c) => rowOf(c) !== erRow);
            if (!inErRow || !other) continue;
            if (Math.floor(rowOf(other) / 3) === Math.floor(b / 3)) continue;
            const target = rowOf(other) * 9 + erCol;
            if (g.values[target] === 0 && g.cands[target] & mask) {
              return erStep(g, d, b, boxCells, [inErRow, other], target, 'col');
            }
          }
          // conjugate pair in a row crossing the ER column
          for (let r = 0; r < 9; r++) {
            if (Math.floor(r / 3) === Math.floor(b / 3)) continue;
            const rowCells = UNITS[r].filter((c) => g.values[c] === 0 && g.cands[c] & mask);
            if (rowCells.length !== 2) continue;
            const inErCol = rowCells.find((c) => colOf(c) === erCol);
            const other = rowCells.find((c) => colOf(c) !== erCol);
            if (!inErCol || !other) continue;
            if (Math.floor(colOf(other) / 3) === b % 3) continue;
            const target = erRow * 9 + colOf(other);
            if (g.values[target] === 0 && g.cands[target] & mask) {
              return erStep(g, d, b, boxCells, [inErCol, other], target, 'row');
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * `pairLine` is the kind of line the conjugate pair lies in. With the pair
 * in a column, pair[0] lies on the box's row and pair[1] shares a row with
 * the target, which lies on the box's column; with the pair in a row, the
 * same with rows and columns swapped. The labels and the description name
 * the houses the argument uses: the box's row and column, the pair's line,
 * the line pair[1] shares with the target, and the arm pair[0] empties.
 */
function erStep(
  g: Grid,
  d: number,
  box: number,
  boxCells: number[],
  pair: number[],
  target: number,
  pairLine: 'row' | 'col'
): Step {
  const inCol = pairLine === 'col';
  // the box's row and column, as units: every d of the box lies on one of them
  const boxRow = inCol ? rowOf(pair[0]) : rowOf(target);
  const boxCol = 9 + (inCol ? colOf(target) : colOf(pair[0]));
  // the pair's line; the line pair[1] shares with the target; the box's line pair[0] lies on, and the other
  const line = inCol ? 9 + colOf(pair[0]) : rowOf(pair[0]);
  const shared = inCol ? rowOf(pair[1]) : 9 + colOf(pair[1]);
  const [arm, other] = inCol ? [boxRow, boxCol] : [boxCol, boxRow];
  const [b, r, c, l] = [unitName(18 + box), unitName(boxRow), unitName(boxCol), unitName(line)];
  const [p0, p1, t] = [cellName(pair[0]), cellName(pair[1]), cellName(target)];
  return {
    tech: 'EMPTY_RECTANGLE',
    placements: [],
    eliminations: [{ cell: target, digit: d }],
    primary: boxCells.map((cell) => ({ cell, digit: d })),
    secondary: pair.map((cell) => ({ cell, digit: d })),
    units: [{ unit: 18 + box, role: 'primary' }],
    labels: {
      primary: tr`${b}: its ${d}s all lie in ${r} or ${c}`,
      secondary: tr`${l}: its only ${d}s are ${p0} and ${p1}`
    },
    description: tr`Empty Rectangle on ${d}: in ${b} every ${d} lies in ${r} or ${c}, and ${p0} and ${p1} are the only ${d}s in ${l}. If ${p1} is ${d}, ${t} is not: they share ${unitName(shared)}. If not, ${p0} is ${d}, so ${b} has no ${d} in ${unitName(arm)}; its ${d} lies in ${unitName(other)}, which runs through ${t}, so again ${t} is not ${d}. So ${d} is removed from ${t}.`
  };
}
