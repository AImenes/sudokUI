import { Grid, UNITS, bit, sees, cellName, cellNames } from '../board';
import { Step, CellDigit, alternatingLinks } from '../steps';

/**
 * X-Cycles (sudokuwiki.org/X_Cycles): closed alternating strong/weak loops on
 * a single digit.
 *
 * - Continuous loop (perfect alternation, even number of links): for every
 *   weak link, exactly one endpoint is true, so the digit falls from all
 *   off-loop cells seeing both endpoints of that link (Nice Loop Rule 1).
 * - Discontinuous loop with two STRONG links meeting at one node: assuming
 *   that node false forces it true, so the digit is PLACED there (Rule 2).
 * - Two WEAK links meeting at a node (Rule 3) is exactly the X-Chain
 *   elimination, which runs earlier in the solve order, so it is not
 *   re-implemented here.
 *
 * The search anchors the discontinuity at the start node: paths alternate
 * strictly (beginning with a strong link), so any flaw can only occur where
 * the loop closes.
 */
export function findXCycles(g: Grid, maxLen = 12): Step | null {
  for (let d = 1; d <= 9; d++) {
    const mask = bit(d);
    const cells: number[] = [];
    for (let c = 0; c < 81; c++) if (g.values[c] === 0 && g.cands[c] & mask) cells.push(c);
    if (cells.length < 4) continue;

    const strong = new Map<number, number[]>();
    for (const c of cells) strong.set(c, []);
    for (const unit of UNITS) {
      const uc = unit.filter((c) => g.values[c] === 0 && g.cands[c] & mask);
      if (uc.length === 2) {
        strong.get(uc[0])!.push(uc[1]);
        strong.get(uc[1])!.push(uc[0]);
      }
    }
    const isStrong = (a: number, b: number) => strong.get(a)!.includes(b);

    let budget = 30000; // expansion cap per digit, keeps the finder responsive

    const dfs = (
      path: number[],
      nextType: 'strong' | 'weak'
    ): Step | null => {
      if (budget-- <= 0 || path.length > maxLen) return null;
      const cur = path[path.length - 1];
      const start = path[0];

      // try to close the loop (path holds >= 3 nodes so the closure link is
      // distinct from the first link)
      if (path.length >= 3) {
        const lastWasStrong = nextType === 'weak'; // the link INTO cur
        if (!lastWasStrong && isStrong(cur, start)) {
          // weak entry into cur + strong closure: alternation holds at every
          // node except start, which carries two strong links -> Rule 2
          const step = rule2(g, d, path);
          if (step) return step;
        }
        if (lastWasStrong && sees(cur, start) && path.length % 2 === 0) {
          // strong entry + weak closure completes perfect alternation ->
          // Rule 1 continuous loop
          const step = rule1(g, d, path);
          if (step) return step;
        }
      }

      const nexts =
        nextType === 'strong'
          ? strong.get(cur)!
          : cells.filter((c) => sees(c, cur));
      for (const next of nexts) {
        if (path.includes(next)) continue;
        const res = dfs([...path, next], nextType === 'strong' ? 'weak' : 'strong');
        if (res) return res;
      }
      return null;
    };

    for (const start of cells) {
      if (strong.get(start)!.length === 0) continue;
      const res = dfs([start], 'strong');
      if (res) return res;
    }
  }
  return null;
}

/** Rule 2: the start node has two strong links — it must be the digit. */
function rule2(g: Grid, d: number, path: number[]): Step | null {
  const start = path[0];
  return {
    tech: 'X_CYCLES',
    placements: [{ cell: start, digit: d }],
    eliminations: [],
    primary: path.map((cell) => ({ cell, digit: d })),
    links: alternatingLinks(path.map((cell) => [{ cell, digit: d }]), 'strong'),
    description: `X-Cycle on ${d}: the loop ${path.map(cellName).join(' → ')} closes with two strong links at ${cellName(start)} — if it were not ${d}, the loop would force it to be ${d}. So ${cellName(start)} is ${d}.`
  };
}

/** Rule 1: continuous loop — eliminate along every weak link. */
function rule1(g: Grid, d: number, path: number[]): Step | null {
  const mask = bit(d);
  // links alternate strong, weak, strong, ... and the closure (odd index) is weak
  const weakLinks: [number, number][] = [];
  for (let i = 1; i < path.length; i += 2) {
    weakLinks.push([path[i], path[(i + 1) % path.length]]);
  }
  const elims: CellDigit[] = [];
  const seen = new Set<number>();
  for (const [a, b] of weakLinks) {
    for (let c = 0; c < 81; c++) {
      if (g.values[c] !== 0 || path.includes(c) || seen.has(c)) continue;
      if (!(g.cands[c] & mask)) continue;
      if (sees(c, a) && sees(c, b)) {
        seen.add(c);
        elims.push({ cell: c, digit: d });
      }
    }
  }
  if (!elims.length) return null;
  return {
    tech: 'X_CYCLES',
    placements: [],
    eliminations: elims,
    primary: path.map((cell) => ({ cell, digit: d })),
    links: alternatingLinks(path.map((cell) => [{ cell, digit: d }]), 'weak'),
    description: `X-Cycle on ${d}: the continuous loop ${cellNames(path)} alternates perfectly, so along each weak link one end is ${d} — ${d} falls from every outside cell seeing both ends of a weak link.`
  };
}
