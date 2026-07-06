import { Grid, UNITS, bit, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { Tech } from '../ratings';
import { combinations } from './subsets';

/**
 * Franken fish (finless), via the general set-cover fish theorem:
 *
 * For one digit, choose N base units whose candidate cells are pairwise
 * disjoint, and N cover units whose candidate cells are pairwise disjoint,
 * such that every base candidate lies in some cover unit. Each base unit
 * contains exactly one true instance, giving N true cells spread over the N
 * covers — so each cover's single true cell is a base cell, and the digit
 * falls from every cover cell outside the base.
 *
 * Franken = boxes allowed among the base or cover sets (rows base / cols
 * cover and vice versa, plus boxes on either side). Pure row/col fish are
 * found earlier as basic fish; a step is only reported when a box is
 * actually involved.
 */
export function findFrankenFish(g: Grid, size: 2 | 3): Step | null {
  const tech: Tech = size === 2 ? 'FRANKEN_X_WING' : 'FRANKEN_SWORDFISH';
  const name = size === 2 ? 'Franken X-Wing' : 'Franken Swordfish';

  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    // candidate cells per unit index
    const unitCells: number[][] = UNITS.map((u) =>
      u.filter((c) => g.values[c] === 0 && g.cands[c] & mask)
    );

    for (const rowsAsBase of [true, false]) {
      const baseUnits = [
        ...(rowsAsBase ? [0, 1, 2, 3, 4, 5, 6, 7, 8] : [9, 10, 11, 12, 13, 14, 15, 16, 17]),
        ...[18, 19, 20, 21, 22, 23, 24, 25, 26]
      ].filter((u) => unitCells[u].length >= 2);
      const coverUnits = [
        ...(rowsAsBase ? [9, 10, 11, 12, 13, 14, 15, 16, 17] : [0, 1, 2, 3, 4, 5, 6, 7, 8]),
        ...[18, 19, 20, 21, 22, 23, 24, 25, 26]
      ].filter((u) => unitCells[u].length >= 1);

      for (const base of combinations(baseUnits, size)) {
        // base candidate cells must be pairwise disjoint
        const baseCells = new Set<number>();
        let disjoint = true;
        for (const u of base) {
          for (const c of unitCells[u]) {
            if (baseCells.has(c)) {
              disjoint = false;
              break;
            }
            baseCells.add(c);
          }
          if (!disjoint) break;
        }
        if (!disjoint) continue;

        // covers worth considering: units intersecting the base cells
        const relevant = coverUnits.filter(
          (u) => !base.includes(u) && unitCells[u].some((c) => baseCells.has(c))
        );
        if (relevant.length < size) continue;

        for (const cover of combinations(relevant, size)) {
          const coverCells = new Set<number>();
          let ok = true;
          for (const u of cover) {
            for (const c of unitCells[u]) {
              if (coverCells.has(c)) {
                ok = false;
                break;
              }
              coverCells.add(c);
            }
            if (!ok) break;
          }
          if (!ok) continue;
          // every base candidate must be covered
          if (![...baseCells].every((c) => coverCells.has(c))) continue;
          // franken only: a box must take part somewhere
          if (![...base, ...cover].some((u) => u >= 18)) continue;

          const elims: CellDigit[] = [];
          for (const c of coverCells) {
            if (!baseCells.has(c)) elims.push({ cell: c, digit: d });
          }
          if (!elims.length) continue;
          return {
            tech,
            placements: [],
            eliminations: elims,
            primary: [...baseCells].map((cell) => ({ cell, digit: d })),
            description: `${name}: digit ${d}'s candidates in ${base.map(unitLabel).join(' + ')} are confined to ${cover.map(unitLabel).join(' + ')}; the ${size} true cells use up the covers, so ${d} falls from ${cellNames(elims.map((e) => e.cell))}.`
          };
        }
      }
    }
  }
  return null;
}

function unitLabel(u: number): string {
  if (u < 9) return `row ${u + 1}`;
  if (u < 18) return `column ${u - 8}`;
  return `box ${u - 17}`;
}
