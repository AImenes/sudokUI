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
            const names: Record<typeof variant, string> = {
              SKYSCRAPER: 'Skyscraper',
              TWO_STRING_KITE: '2-String Kite',
              TURBOT_FISH: 'Turbot Fish'
            };
            return {
              tech: variant,
              placements: [],
              eliminations: elims,
              primary: pattern.map((cell) => ({ cell, digit: d })),
              links: alternatingLinks([a, p, q, b].map((cell) => [{ cell, digit: d }])),
              description: `${names[variant]}: strong links on ${d} (${cellName(l1.a)}–${cellName(l1.b)} and ${cellName(l2.a)}–${cellName(l2.b)}) are weakly connected, so ${d} can be removed from cells seeing both ${cellName(a)} and ${cellName(b)}.`
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
              return erStep(g, d, b, boxCells, [inErRow, other], target);
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
              return erStep(g, d, b, boxCells, [inErCol, other], target);
            }
          }
        }
      }
    }
  }
  return null;
}

function erStep(
  g: Grid,
  d: number,
  box: number,
  boxCells: number[],
  pair: number[],
  target: number
): Step {
  return {
    tech: 'EMPTY_RECTANGLE',
    placements: [],
    eliminations: [{ cell: target, digit: d }],
    primary: boxCells.map((cell) => ({ cell, digit: d })),
    secondary: pair.map((cell) => ({ cell, digit: d })),
    description: `Empty Rectangle: in box ${box + 1} digit ${d} sits on a row/column cross; with the conjugate pair ${cellNames(pair)}, ${d} can be removed from ${cellName(target)}.`
  };
}
