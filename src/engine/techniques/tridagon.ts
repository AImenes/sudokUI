import { Grid, bit, digitsOf, popcount, boxOf, sees, cellName, cellNames } from '../board';
import { Step } from '../steps';
import { combinations } from './subsets';

/**
 * Tridagon / trivalue oddagon: twelve cells, three per box of a 2×2 box
 * rectangle, restricted to one trio of digits — for certain shapes no
 * assignment of the trio can satisfy the row/column/box constraints.
 *
 * Whether a selection is impossible is NOT taken from shape lore. It is
 * decided per position by exhaustive local assignment: a solution restricted
 * to the twelve cells must satisfy every pairwise constraint among them, so
 * zero local assignments ⇒ no solution keeps all twelve inside the trio.
 * When impossibility is proven and exactly one of the twelve cells carries
 * extra candidates (the guardian), that cell must take an extra — the trio
 * digits fall from it.
 */
export function findTridagon(g: Grid): Step | null {
  // candidate trios: the exact candidate sets of 3-candidate cells
  const trios = new Set<number>();
  for (let c = 0; c < 81; c++) {
    if (g.values[c] === 0 && popcount(g.cands[c]) === 3) trios.add(g.cands[c]);
  }

  for (const T of trios) {
    const pure: number[][] = Array.from({ length: 9 }, () => []);
    const near: number[][] = Array.from({ length: 9 }, () => []);
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0) continue;
      const m = g.cands[c];
      if ((m & ~T) === 0 && popcount(m) >= 2) pure[boxOf(c)].push(c);
      // realistic guardians carry the trio plus one or two extras; anything
      // looser makes the search explode without matching real tridagons
      else if ((m & T) !== 0 && popcount(m & ~T) <= 2 && popcount(m & T) >= 2) {
        near[boxOf(c)].push(c);
      }
    }

    for (const bands of [[0, 1], [0, 2], [1, 2]]) {
      for (const stacks of [[0, 1], [0, 2], [1, 2]]) {
        const boxes = [
          bands[0] * 3 + stacks[0],
          bands[0] * 3 + stacks[1],
          bands[1] * 3 + stacks[0],
          bands[1] * 3 + stacks[1]
        ];
        // a real tridagon box carries at least one exact-trio cell
        if (!boxes.every((b) => pure[b].some((c) => g.cands[c] === T))) continue;
        for (let gi = 0; gi < 4; gi++) {
          if (!boxes.every((b, k) => pure[b].length >= (k === gi ? 2 : 3))) continue;
          for (const guardian of near[boxes[gi]]) {
            const triples = boxes.map((b, k) =>
              k === gi
                ? combinations(pure[b], 2).slice(0, 12).map((pair) => [guardian, ...pair])
                : combinations(pure[b], 3).slice(0, 12)
            );
            let budget = 300;
            for (const t0 of triples[0]) {
              for (const t1 of triples[1]) {
                for (const t2 of triples[2]) {
                  for (const t3 of triples[3]) {
                    if (budget-- <= 0) break;
                    const cells = [...t0, ...t1, ...t2, ...t3];
                    if (trioSatisfiable(cells)) continue;
                    // impossible with trio digits only -> the guardian must
                    // take one of its extra candidates
                    const elims = digitsOf(g.cands[guardian] & T).map((digit) => ({
                      cell: guardian,
                      digit
                    }));
                    if (!elims.length) continue;
                    return {
                      tech: 'TRIDAGON',
                      placements: [],
                      eliminations: elims,
                      primary: cells
                        .filter((c) => c !== guardian)
                        .flatMap((cell) =>
                          digitsOf(g.cands[cell] & T).map((digit) => ({ cell, digit }))
                        ),
                      secondary: digitsOf(g.cands[guardian] & ~T).map((digit) => ({
                        cell: guardian,
                        digit
                      })),
                      description: `Tridagon: the cells ${cellNames(cells)} cannot all take digits from ${digitsOf(T).join('')} (proven by complete case analysis), so the guardian ${cellName(guardian)} must take one of its other candidates — ${digitsOf(T).join('/')} fall from it.`
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

/** Can the cells all take (distinct-where-seeing) digits from a 3-digit trio? */
function trioSatisfiable(cells: number[]): boolean {
  const assign = new Array(cells.length).fill(0);
  const ok = (i: number, d: number): boolean => {
    for (let j = 0; j < i; j++) {
      if (assign[j] === d && sees(cells[i], cells[j])) return false;
    }
    return true;
  };
  const rec = (i: number): boolean => {
    if (i === cells.length) return true;
    for (let d = 1; d <= 3; d++) {
      if (ok(i, d)) {
        assign[i] = d;
        if (rec(i + 1)) return true;
      }
    }
    return false;
  };
  return rec(0);
}
