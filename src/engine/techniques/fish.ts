import { Grid, bit, boxOf, cellName, cellNames } from '../board';
import { Step, CellDigit } from '../steps';
import { Tech } from '../ratings';
import { combinations } from './subsets';
import { aDigit, listAnd, tr, unitName } from '../text';

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

/**
 * A label that ends in its digit, the digit held to the word before it by
 * a no-break space, so a narrow legend never leaves the digit alone on a
 * line; every language ends the fins' box's label in its digit
 */
const digitHeld = (label: string): string => label.replace(/ (\d)$/, '\u00a0$1');

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
        // each list of houses ends in its own word ("rows 3 and 8, the 7s"), never in the digit
        const bases = listAnd(baseLines.map((l) => l + 1));
        const covers = listAnd(bitsOf(cover).map((p) => p + 1));
        const cells = listAnd(baseCells.map(cellName));
        return {
          tech: FISH_NAMES[size].toUpperCase().replace('-', '_') as Tech,
          placements: [],
          eliminations: elims,
          primary: baseCells.map((cell) => ({ cell, digit: d })),
          units: [
            ...baseLines.map((l) => ({ unit: rows ? l : 9 + l, role: 'primary' as const })),
            ...bitsOf(cover).map((p) => ({ unit: rows ? 9 + p : p, role: 'secondary' as const }))
          ],
          // the base's label names only the base, which the walk's first
          // frame draws alone; the cover's says why it loses the digit
          labels: rows
            ? {
                primary: tr`base rows: the ${d}s of the fish`,
                secondary: tr`cover columns: ${size} of them take the base's ${d}s, so ${d} goes nowhere else in them`
              }
            : {
                primary: tr`base columns: the ${d}s of the fish`,
                secondary: tr`cover rows: ${size} of them take the base's ${d}s, so ${d} goes nowhere else in them`
              },
          // the walk (H1): the base's houses and its cells, then the cover's
          // and why each takes its digit from the base, then the removals
          walk: {
            frames: [
              { text: rows ? tr`In rows ${bases}, the ${d}s lie only in ${cells}.` : tr`In columns ${bases}, the ${d}s lie only in ${cells}.`, show: ['primary'] },
              {
                text: rows
                  ? tr`These cells lie in columns ${covers}. Each of rows ${bases} needs ${aDigit(d)}, and no column holds two, so each of columns ${covers} gets its ${d} from one of rows ${bases}.`
                  : tr`These cells lie in rows ${covers}. Each of columns ${bases} needs ${aDigit(d)}, and no row holds two, so each of rows ${covers} gets its ${d} from one of columns ${bases}.`,
                show: ['secondary']
              }
            ],
            lead: rows ? tr`No other cell of columns ${covers} can be ${d}.` : tr`No other cell of rows ${covers} can be ${d}.`
          },
          description: rows
            ? tr`${name} on ${d}: in rows ${bases}, the ${d}s lie only in columns ${covers} (${cellNames(baseCells)}). Those ${size} rows will use up ${d} in those ${size} columns, so ${d} can go nowhere else in them.`
            : tr`${name} on ${d}: in columns ${bases}, the ${d}s lie only in rows ${covers} (${cellNames(baseCells)}). Those ${size} columns will use up ${d} in those ${size} rows, so ${d} can go nowhere else in them.`
        };
      }
    }
  }
  return null;
}

/**
 * A finned or sashimi fish's walk (the readability report's H1): the base
 * and its cells, then the fins, the base's only other cells; then the
 * cover, where the base puts its digits if every fin is false (a sashimi
 * fish first names the crossing of its base and cover that has no digit,
 * which its fins stand in for, an X-Wing's corner only when it lies in the
 * fins' box); then the fins' box, which a true fin empties of the digit;
 * then the removals in reading order, in a cover line and in the fins'
 * box, false either way.
 */
function finnedWalk(
  rows: boolean,
  d: number,
  size: number,
  baseLines: number[],
  coverPositions: number[],
  positions: number[],
  baseCells: number[],
  finCells: number[],
  elims: CellDigit[]
): NonNullable<Step['walk']> {
  const many = finCells.length > 1;
  const bases = listAnd(baseLines.map((l) => l + 1));
  const covers = listAnd(coverPositions.map((p) => p + 1));
  const cells = listAnd(baseCells.map(cellName));
  const finNames = listAnd(finCells.map(cellName));
  const box = unitName(18 + boxOf(finCells[0]));
  const k = finCells.length;
  const first = rows
    ? many
      ? tr`In rows ${bases}, the ${d}s lie in ${cells}, and in ${k} more cells.`
      : tr`In rows ${bases}, the ${d}s lie in ${cells}, and in one more cell.`
    : many
      ? tr`In columns ${bases}, the ${d}s lie in ${cells}, and in ${k} more cells.`
      : tr`In columns ${bases}, the ${d}s lie in ${cells}, and in one more cell.`;
  const second = rows
    ? many
      ? tr`The only other ${d}s in rows ${bases} are ${finNames}: the fins.`
      : tr`The only other ${d} in rows ${bases} is ${finNames}: the fin.`
    : many
      ? tr`The only other ${d}s in columns ${bases} are ${finNames}: the fins.`
      : tr`The only other ${d} in columns ${bases} is ${finNames}: the fin.`;
  // a sashimi fish: a base line with one digit in the cover, its fins in its stead
  const sashimi: string[] = [];
  let cover = 0;
  for (const p of coverPositions) cover |= 1 << p;
  for (const l of baseLines) {
    const inCover = bitsOf(positions[l] & cover);
    if (inCover.length !== 1) continue;
    const own = finCells.filter((c) => (rows ? Math.floor(c / 9) : c % 9) === l);
    const its = listAnd(own.map(cellName));
    if (size === 2) {
      // the corner its fins stand in for, said only when it lies in the
      // fins' box: a fin in another box stands in for no corner, though the
      // finder takes the fish (and its removals hold)
      const at = cellAt(rows, l, coverPositions.find((p) => p !== inCover[0])!);
      if (boxOf(at) !== boxOf(finCells[0])) continue;
      const corner = cellName(at);
      sashimi.push(
        own.length > 1
          ? tr`The fish's corner ${corner} has no ${d}: the fins ${its} stand in for it.`
          : tr`The fish's corner ${corner} has no ${d}: the fin ${its} stands in for it.`
      );
    } else {
      const only = cellName(cellAt(rows, l, inCover[0]));
      sashimi.push(
        rows
          ? own.length > 1
            ? tr`Row ${l + 1} has only one ${d} in columns ${covers}, in ${only}: the fins ${its} stand in for a second ${d}.`
            : tr`Row ${l + 1} has only one ${d} in columns ${covers}, in ${only}: the fin ${its} stands in for a second ${d}.`
          : own.length > 1
            ? tr`Column ${l + 1} has only one ${d} in rows ${covers}, in ${only}: the fins ${its} stand in for a second ${d}.`
            : tr`Column ${l + 1} has only one ${d} in rows ${covers}, in ${only}: the fin ${its} stands in for a second ${d}.`
      );
    }
  }
  const third = rows
    ? many
      ? tr`If every fin is false, rows ${bases} put their ${d}s in columns ${covers}, one in each, so no other cell of those columns can be ${d}.`
      : tr`If the fin is false, rows ${bases} put their ${d}s in columns ${covers}, one in each, so no other cell of those columns can be ${d}.`
    : many
      ? tr`If every fin is false, columns ${bases} put their ${d}s in rows ${covers}, one in each, so no other cell of those rows can be ${d}.`
      : tr`If the fin is false, columns ${bases} put their ${d}s in rows ${covers}, one in each, so no other cell of those rows can be ${d}.`;
  const fourth = many
    ? tr`If a fin is true, it is the ${d} of ${box}, so no other cell of ${box} can be ${d}.`
    : tr`If the fin is true, it is the ${d} of ${box}, so no other cell of ${box} can be ${d}.`;
  // the removals: each in a cover line and in the fins' box, in reading
  // order, as the conclusion after them names them (the finder lists them
  // cover line by cover line)
  const lineOf = (c: number) => (rows ? c % 9 : Math.floor(c / 9));
  const lines = [...new Set(elims.map((e) => lineOf(e.cell)))].sort((a, b) => a - b);
  const removedCells = elims.map((e) => e.cell).sort((a, b) => a - b);
  const removed = listAnd(removedCells.map(cellName));
  const line = unitName(rows ? 9 + lines[0] : lines[0]);
  const across = listAnd(lines.map((p) => p + 1));
  const lead =
    removedCells.length === 1
      ? tr`${removed} is in ${line} and in ${box}, so it cannot be ${d} either way.`
      : removedCells.length === 2
        ? lines.length === 1
          ? tr`${removed} are in ${line} and in ${box}, so neither of them can be ${d} either way.`
          : rows
            ? tr`${removed} are in ${box}, each in one of columns ${across}, so neither of them can be ${d} either way.`
            : tr`${removed} are in ${box}, each in one of rows ${across}, so neither of them can be ${d} either way.`
        : lines.length === 1
          ? tr`${removed} are in ${line} and in ${box}, so none of them can be ${d} either way.`
          : rows
            ? tr`${removed} are in ${box}, each in one of columns ${across}, so none of them can be ${d} either way.`
            : tr`${removed} are in ${box}, each in one of rows ${across}, so none of them can be ${d} either way.`;
  return {
    frames: [
      { text: first, show: ['primary'] },
      { text: second, show: ['fins'] },
      { text: [...sashimi, third].join(' '), show: ['secondary'] },
      { text: fourth, show: ['finBox'] }
    ],
    lead
  };
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
          const bases = listAnd(baseLines.map((l) => l + 1));
          const covers = listAnd(coverPositions.map((p) => p + 1));
          const base = cellNames(baseCells);
          const fins = cellNames(finCells);
          const many = finCells.length > 1;
          const walk = finnedWalk(rows, d, size, baseLines, coverPositions, positions, baseCells, finCells, elims);
          return {
            tech: `${prefix.toUpperCase()}_${FISH_NAMES[size].toUpperCase().replace('-', '_')}` as Tech,
            placements: [],
            eliminations: elims,
            primary: baseCells.map((cell) => ({ cell, digit: d })),
            fins: finCells.map((cell) => ({ cell, digit: d })),
            // the fins' box last, over the base and the cover (G15)
            units: [
              ...baseLines.map((l) => ({ unit: rows ? l : 9 + l, role: 'primary' as const })),
              ...coverPositions.map((p) => ({ unit: rows ? 9 + p : p, role: 'secondary' as const })),
              { unit: 18 + finBox, role: 'fin' as const }
            ],
            // each label names only what the walk has drawn by the frame
            // that brings it in: the base, its fins, the cover, the fins' box
            labels: {
              primary: rows ? tr`base rows: the ${d}s of the fish` : tr`base columns: the ${d}s of the fish`,
              secondary: rows
                ? many
                  ? tr`cover columns: where the base rows put their ${d}s if every fin is false`
                  : tr`cover columns: where the base rows put their ${d}s if the fin is false`
                : many
                  ? tr`cover rows: where the base columns put their ${d}s if every fin is false`
                  : tr`cover rows: where the base columns put their ${d}s if the fin is false`,
              fins: rows
                ? many
                  ? tr`fins: ${d}s of the base rows outside the fish`
                  : tr`fin: ${aDigit(d)} of the base rows outside the fish`
                : many
                  ? tr`fins: ${d}s of the base columns outside the fish`
                  : tr`fin: ${aDigit(d)} of the base columns outside the fish`,
              finBox: digitHeld(
                many
                  ? tr`the fins' box: if a fin is true, no other cell here can be ${d}`
                  : tr`the fin's box: if the fin is true, no other cell here can be ${d}`
              )
            },
            walk,
            description: rows
              ? many
                ? tr`${name} on ${d}: in rows ${bases}, the ${d}s lie in columns ${covers} (${base}) except for the fins ${fins}. Either the fins are false and the fish holds, or a fin is true; ${aDigit(d)} that sees every fin and lies in the cover columns outside the base is false both ways.`
                : tr`${name} on ${d}: in rows ${bases}, the ${d}s lie in columns ${covers} (${base}) except for the fin ${fins}. Either the fin is false and the fish holds, or the fin is true; ${aDigit(d)} that sees every fin and lies in the cover columns outside the base is false both ways.`
              : many
                ? tr`${name} on ${d}: in columns ${bases}, the ${d}s lie in rows ${covers} (${base}) except for the fins ${fins}. Either the fins are false and the fish holds, or a fin is true; ${aDigit(d)} that sees every fin and lies in the cover rows outside the base is false both ways.`
                : tr`${name} on ${d}: in columns ${bases}, the ${d}s lie in rows ${covers} (${base}) except for the fin ${fins}. Either the fin is false and the fish holds, or the fin is true; ${aDigit(d)} that sees every fin and lies in the cover rows outside the base is false both ways.`
          };
        }
      }
    }
  }
  return null;
}
