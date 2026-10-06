import { Grid, bit, boxOf, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { Tech } from '../ratings';
import { combinations } from './subsets';
import { tr } from '../text';

const FISH_NAMES = ['', '', 'X-Wing', 'Swordfish', 'Jellyfish', 'Squirmbag', 'Whale', 'Leviathan'];

/** cell index for (baseLine, coverPos); rows=true means base lines are rows */
const cellAt = (rows: boolean, line: number, pos: number) =>
  rows ? line * 9 + pos : pos * 9 + line;

/** for each base line, bitmask of cover positions holding the digit */
function linePositions(g: Grid, d: number, rows: boolean): number[] {
  const mask = bit(d);
  const out: number[] = [];
  for (let line = 0; line < 9; line++) {
    let posMask = 0;
    for (let pos = 0; pos < 9; pos++) {
      const c = cellAt(rows, line, pos);
      if (g.values[c] === 0 && g.cands[c] & mask) posMask |= 1 << pos;
    }
    out.push(posMask);
  }
  return out;
}

const bitsOf = (m: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < 9; i++) if (m & (1 << i)) out.push(i);
  return out;
};
const popcount9 = (m: number): number => bitsOf(m).length;

export function findBasicFish(g: Grid, size: number): Step | null {
  for (const rows of [true, false]) {
    for (let d = 1; d <= 9; d++) {
      const positions = linePositions(g, d, rows);
      const candidateLines = [];
      for (let l = 0; l < 9; l++) {
        const n = popcount9(positions[l]);
        if (n >= 2 && n <= size) candidateLines.push(l);
      }
      if (candidateLines.length < size) continue;
      for (const baseLines of combinations(candidateLines, size)) {
        let cover = 0;
        for (const l of baseLines) cover |= positions[l];
        if (popcount9(cover) !== size) continue;
        const elims: CellDigit[] = [];
        for (const pos of bitsOf(cover)) {
          for (let line = 0; line < 9; line++) {
            if (baseLines.includes(line)) continue;
            const c = cellAt(rows, line, pos);
            if (g.values[c] === 0 && g.cands[c] & bit(d)) elims.push({ cell: c, digit: d });
          }
        }
        if (!elims.length) continue;
        const baseCells = baseLines.flatMap((l) =>
          bitsOf(positions[l]).map((p) => cellAt(rows, l, p))
        );
        // the fish's name stays English in every language (docs/translations.md)
        const name = FISH_NAMES[size];
        const bases = baseLines.map((l) => l + 1).join(', ');
        const covers = bitsOf(cover).map((p) => p + 1).join(', ');
        return {
          tech: FISH_NAMES[size].toUpperCase().replace('-', '_') as Tech,
          placements: [],
          eliminations: elims,
          primary: baseCells.map((cell) => ({ cell, digit: d })),
          units: [
            ...baseLines.map((l) => ({ unit: rows ? l : 9 + l, role: 'primary' as const })),
            ...bitsOf(cover).map((p) => ({ unit: rows ? 9 + p : p, role: 'secondary' as const }))
          ],
          labels: rows
            ? {
                primary: tr`base rows: the ${d}s of the fish, ${size} rows with ${d} only in the cover columns`,
                secondary: tr`cover columns: ${size} of them take the base's ${d}s, so ${d} goes nowhere else in them`
              }
            : {
                primary: tr`base columns: the ${d}s of the fish, ${size} columns with ${d} only in the cover rows`,
                secondary: tr`cover rows: ${size} of them take the base's ${d}s, so ${d} goes nowhere else in them`
              },
          description: rows
            ? tr`${name} on ${d}: in rows ${bases}, ${d} can only go in columns ${covers} (${cellNames(baseCells)}). Those ${size} rows will use up ${d} in those ${size} columns, so ${d} can go nowhere else in them.`
            : tr`${name} on ${d}: in columns ${bases}, ${d} can only go in rows ${covers} (${cellNames(baseCells)}). Those ${size} columns will use up ${d} in those ${size} rows, so ${d} can go nowhere else in them.`
        };
      }
    }
  }
  return null;
}

/**
 * Finned/sashimi basic fish. All fins must share a box; eliminations are
 * restricted to cover cells inside the fin box.
 */
export function findFinnedFish(g: Grid, size: number, sashimi: boolean): Step | null {
  for (const rows of [true, false]) {
    for (let d = 1; d <= 9; d++) {
      const positions = linePositions(g, d, rows);
      const candidateLines = [];
      for (let l = 0; l < 9; l++) {
        const n = popcount9(positions[l]);
        if (n >= 2 && n <= size + 2) candidateLines.push(l);
      }
      if (candidateLines.length < size) continue;
      for (const baseLines of combinations(candidateLines, size)) {
        let union = 0;
        for (const l of baseLines) union |= positions[l];
        const unionPositions = bitsOf(union);
        if (unionPositions.length <= size || unionPositions.length > size + 2) continue;
        for (const coverPositions of combinations(unionPositions, size)) {
          let cover = 0;
          for (const p of coverPositions) cover |= 1 << p;
          // fins: base candidates outside the cover set
          const finCells: number[] = [];
          let degenerate = false;
          let isSashimi = false;
          for (const l of baseLines) {
            const inCover = positions[l] & cover;
            if (!inCover) {
              degenerate = true;
              break;
            }
            if (popcount9(inCover) < 2 && (positions[l] & ~cover) !== 0) isSashimi = true;
            for (const p of bitsOf(positions[l] & ~cover)) finCells.push(cellAt(rows, l, p));
          }
          if (degenerate || finCells.length === 0) continue;
          const finBox = boxOf(finCells[0]);
          if (!finCells.every((c) => boxOf(c) === finBox)) continue;
          if (isSashimi !== sashimi) continue;
          const elims: CellDigit[] = [];
          for (const pos of coverPositions) {
            for (let line = 0; line < 9; line++) {
              if (baseLines.includes(line)) continue;
              const c = cellAt(rows, line, pos);
              if (boxOf(c) !== finBox) continue;
              if (g.values[c] === 0 && g.cands[c] & bit(d)) elims.push({ cell: c, digit: d });
            }
          }
          if (!elims.length) continue;
          const baseCells = baseLines.flatMap((l) =>
            bitsOf(positions[l] & cover).map((p) => cellAt(rows, l, p))
          );
          const prefix = sashimi ? 'Sashimi' : 'Finned';
          // the fish's name stays English in every language (docs/translations.md)
          const name = `${prefix} ${FISH_NAMES[size]}`;
          const bases = baseLines.map((l) => l + 1).join(', ');
          const covers = coverPositions.map((p) => p + 1).join(', ');
          const base = cellNames(baseCells);
          const fins = cellNames(finCells);
          const many = finCells.length > 1;
          return {
            tech: `${prefix.toUpperCase()}_${FISH_NAMES[size].toUpperCase().replace('-', '_')}` as Tech,
            placements: [],
            eliminations: elims,
            primary: baseCells.map((cell) => ({ cell, digit: d })),
            fins: finCells.map((cell) => ({ cell, digit: d })),
            units: [
              ...baseLines.map((l) => ({ unit: rows ? l : 9 + l, role: 'primary' as const })),
              ...coverPositions.map((p) => ({ unit: rows ? 9 + p : p, role: 'secondary' as const }))
            ],
            labels: {
              primary: rows ? tr`base rows: the ${d}s of the fish` : tr`base columns: the ${d}s of the fish`,
              secondary: rows ? tr`cover columns: where the base's ${d}s must land` : tr`cover rows: where the base's ${d}s must land`,
              fins: tr`fin: ${d}s outside the fish, in one box; a removal must see every fin`
            },
            description: rows
              ? many
                ? tr`${name} on ${d}: in rows ${bases}, ${d} sits in columns ${covers} (${base}) except for the fins ${fins}. Either the fins are false and the fish holds, or a fin is true; a ${d} that sees every fin and lies in the cover columns outside the base is false both ways.`
                : tr`${name} on ${d}: in rows ${bases}, ${d} sits in columns ${covers} (${base}) except for the fin ${fins}. Either the fin is false and the fish holds, or the fin is true; a ${d} that sees every fin and lies in the cover columns outside the base is false both ways.`
              : many
                ? tr`${name} on ${d}: in columns ${bases}, ${d} sits in rows ${covers} (${base}) except for the fins ${fins}. Either the fins are false and the fish holds, or a fin is true; a ${d} that sees every fin and lies in the cover rows outside the base is false both ways.`
                : tr`${name} on ${d}: in columns ${bases}, ${d} sits in rows ${covers} (${base}) except for the fin ${fins}. Either the fin is false and the fish holds, or the fin is true; a ${d} that sees every fin and lies in the cover rows outside the base is false both ways.`
          };
        }
      }
    }
  }
  return null;
}
