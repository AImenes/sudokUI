import { Grid, PEERS, bit, digitsOf, sees, cellName } from '../board';
import { Step, CellDigit } from '../steps';
import { collectAls, Als } from './als';

/**
 * Aligned Pair Exclusion (sudokuwiki.org/Aligned_Pair_Exclusion).
 *
 * Take two cells that see each other and enumerate every pair of candidates
 * (a for the first, b for the second). A pair is impossible when:
 *  - a == b (the cells share a unit), or
 *  - a ≠ b and some ALS visible in its entirety to BOTH cells contains both
 *    digits: placing a and b would strip two of the set's k+1 digits,
 *    leaving k cells only k−1 digits. (A bivalue cell is the k = 1 case.)
 *
 * A candidate that appears in no surviving pair cannot be placed at all.
 */
export function findAlignedPairExclusion(g: Grid): Step | null {
  const alses = collectAls(g, 4, 400);
  const peerSets: Set<number>[] = PEERS.map((p) => new Set(p));

  for (let a = 0; a < 81; a++) {
    if (g.values[a] !== 0) continue;
    for (const b of PEERS[a]) {
      if (b <= a || g.values[b] !== 0) continue;

      // ALSs whose every cell is seen by both a and b (and contains neither)
      const shared = alses.filter(
        (S) =>
          !S.cells.includes(a) &&
          !S.cells.includes(b) &&
          S.cells.every((c) => peerSets[a].has(c) && peerSets[b].has(c))
      );
      if (!shared.length) continue;

      const dsA = digitsOf(g.cands[a]);
      const dsB = digitsOf(g.cands[b]);
      const validA = new Set<number>();
      const validB = new Set<number>();
      let killers: Als[] = [];
      for (const da of dsA) {
        for (const db of dsB) {
          if (da === db) continue; // the cells see each other
          const both = bit(da) | bit(db);
          const killer = shared.find((S) => (S.mask & both) === both);
          if (killer) {
            if (!killers.includes(killer)) killers.push(killer);
            continue;
          }
          validA.add(da);
          validB.add(db);
        }
      }

      const elims: CellDigit[] = [];
      for (const da of dsA) if (!validA.has(da)) elims.push({ cell: a, digit: da });
      for (const db of dsB) if (!validB.has(db)) elims.push({ cell: b, digit: db });
      if (!elims.length) continue;
      return {
        tech: 'ALIGNED_PAIR_EXCLUSION',
        placements: [],
        eliminations: elims,
        primary: [
          ...dsA.map((digit) => ({ cell: a, digit })),
          ...dsB.map((digit) => ({ cell: b, digit }))
        ],
        secondary: killers.flatMap((S) =>
          S.cells.flatMap((cell) => digitsOf(g.cands[cell]).map((digit) => ({ cell, digit })))
        ),
        description: `Aligned Pair Exclusion: every candidate pairing of ${cellName(a)} and ${cellName(b)} that survives the sets they both see leaves no place for the removed candidate${elims.length > 1 ? 's' : ''}.`
      };
    }
  }
  return null;
}
