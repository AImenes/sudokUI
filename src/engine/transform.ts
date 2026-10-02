/**
 * Isomorphisms of the sudoku grid: the rearrangements that keep every
 * rule. Relabel the digits, permute the three bands and the rows within
 * each, the three stacks and the columns within each, and transpose or
 * not: 9! × 6^4 × 6^4 × 2 of them, about 1.2 × 10^12. Each one maps
 * solutions to solutions one to one, so a proper puzzle stays proper and
 * a minimal one minimal, and every technique that applies at a position
 * applies at its image. The solver may find a different instance of a
 * technique first, so the rating can move a little (docs/generator.md).
 */

export interface Isomorphism {
  /** digit d becomes digits[d - 1] */
  digits: number[];
  /** row r moves to rows[r] */
  rows: number[];
  /** column c moves to cols[c] */
  cols: number[];
  transpose: boolean;
}

function shuffled(n: number, rnd: () => number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** a permutation of nine lines: the three chutes shuffled, and the lines within each */
function lines(rnd: () => number): number[] {
  const chutes = shuffled(3, rnd);
  const out: number[] = [];
  for (let chute = 0; chute < 3; chute++) {
    const within = shuffled(3, rnd);
    for (let k = 0; k < 3; k++) out.push(chutes[chute] * 3 + within[k]);
  }
  return out;
}

export function randomIsomorphism(rnd: () => number = Math.random): Isomorphism {
  return {
    digits: shuffled(9, rnd).map((d) => d + 1),
    rows: lines(rnd),
    cols: lines(rnd),
    transpose: rnd() < 0.5
  };
}

export const IDENTITY: Isomorphism = {
  digits: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  rows: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  cols: [0, 1, 2, 3, 4, 5, 6, 7, 8],
  transpose: false
};

/** Apply an isomorphism to an 81-character puzzle or solution. */
export function applyIsomorphism(puzzle: string, iso: Isomorphism): string {
  const out = new Array<string>(81).fill('.');
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const ch = puzzle[r * 9 + c];
      const v = ch >= '1' && ch <= '9' ? iso.digits[Number(ch) - 1] : 0;
      let rr = iso.rows[r];
      let cc = iso.cols[c];
      if (iso.transpose) [rr, cc] = [cc, rr];
      out[rr * 9 + cc] = v ? String(v) : '.';
    }
  }
  return out.join('');
}

/** A random isomorph of the puzzle. */
export function transformPuzzle(puzzle: string, rnd: () => number = Math.random): string {
  return applyIsomorphism(puzzle, randomIsomorphism(rnd));
}
