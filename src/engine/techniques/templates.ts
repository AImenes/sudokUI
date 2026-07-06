import { Grid, bit, boxOf, cellName, digitsOf } from '../board';
import { Step, CellDigit } from '../steps';

/**
 * Pattern Overlay (sudokuwiki.org/Pattern_Overlay), single-digit form.
 *
 * A template for digit d is a complete, conflict-free placement: one cell
 * per row, all nine columns and boxes distinct, agreeing with current values
 * and candidates. Enumerating every template:
 *  - a candidate cell used by NO template can never hold d → eliminate;
 *  - a cell used by EVERY template must hold d → place.
 *
 * Cross-digit template pruning (sudokuwiki's rule 2) is not applied; that
 * only means fewer finds, never wrong ones.
 */
export function findPatternOverlay(g: Grid, maxTemplates = 20000): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    // per row: the admissible cells for d
    const rowChoices: number[][] = [];
    let solvedCount = 0;
    for (let r = 0; r < 9; r++) {
      const cells: number[] = [];
      for (let c = 0; c < 9; c++) {
        const i = r * 9 + c;
        if (g.values[i] === d) {
          cells.length = 0;
          cells.push(i);
          solvedCount++;
          break;
        }
        if (g.values[i] === 0 && g.cands[i] & mask) cells.push(i);
      }
      rowChoices.push(cells);
    }
    if (solvedCount === 9) continue; // digit finished
    if (rowChoices.some((cells) => cells.length === 0)) continue; // broken grid

    // enumerate templates with column/box masks
    const inAll = new Uint8Array(81).fill(1);
    const inAny = new Uint8Array(81);
    let count = 0;
    let overflow = false;
    const current: number[] = [];
    const rec = (row: number, colMask: number, boxMask: number): void => {
      if (overflow) return;
      if (row === 9) {
        count++;
        if (count > maxTemplates) {
          overflow = true;
          return;
        }
        const used = new Uint8Array(81);
        for (const c of current) used[c] = 1;
        for (let i = 0; i < 81; i++) {
          if (used[i]) inAny[i] = 1;
          else inAll[i] = 0;
        }
        return;
      }
      for (const cell of rowChoices[row]) {
        const cb = 1 << (cell % 9);
        const bb = 1 << boxOf(cell);
        if (colMask & cb || boxMask & bb) continue;
        current.push(cell);
        rec(row + 1, colMask | cb, boxMask | bb);
        current.pop();
        if (overflow) return;
      }
    };
    rec(0, 0, 0);
    if (overflow || count === 0) continue;

    const elims: CellDigit[] = [];
    const places: CellDigit[] = [];
    for (let i = 0; i < 81; i++) {
      if (g.values[i] !== 0) continue;
      const isCand = (g.cands[i] & mask) !== 0;
      if (isCand && !inAny[i]) elims.push({ cell: i, digit: d });
      else if (isCand && inAll[i]) places.push({ cell: i, digit: d });
    }
    if (!elims.length && !places.length) continue;
    return {
      tech: 'PATTERN_OVERLAY',
      placements: places,
      eliminations: elims,
      primary: places.length ? places : elims,
      description: `Pattern Overlay: of the ${count} complete placements possible for digit ${d}, ${
        places.length
          ? `every one uses ${places.map((p) => cellName(p.cell)).join(', ')}`
          : `none uses ${elims.map((e) => cellName(e.cell)).join(', ')}`
      }.`
    };
  }
  return null;
}
