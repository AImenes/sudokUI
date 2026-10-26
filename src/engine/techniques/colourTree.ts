// What a colouring draws of its clusters (docs/hint-drawing-colouring.md),
// worked out once for every colouring finder: which colour of a cluster is
// dark, the ties that join a cluster along its shortest drawn spanning
// tree, and the witnesses nearest a removal.
//
// The lengths are the app board's: each candidate sits on the 3×3 pitch of
// src/ui/boardLayout.ts, copied here so the engine needs nothing from the
// interface (tests/colouring.test.ts holds the two equal). A length is in
// cells.
import type { CellDigit, ChainLink, ColourCluster } from '../steps';

/** a candidate's mark's radius, in cells (src/content/hintGeometry.ts SIZES.r) */
const MARK_RADIUS = 0.13;
/** what a tie costs for each other mark of the hint it passes over, in cells of length */
const OVER_A_MARK = 3;

/** where the board draws a candidate, in cells from the board's top left corner: 22 and 23 hundredths into its cell, then 28 a digit */
export function candidateCentre({ cell, digit }: CellDigit): { x: number; y: number } {
  return {
    x: (cell % 9) + (22 + ((digit - 1) % 3) * 28) / 100,
    y: Math.floor(cell / 9) + (23 + Math.floor((digit - 1) / 3) * 28) / 100
  };
}

/** reading order: by cell, then by digit */
export const readingOrder = (a: CellDigit, b: CellDigit): number => a.cell - b.cell || a.digit - b.digit;

const key = (x: CellDigit) => x.cell * 9 + x.digit - 1;
const same = (a: CellDigit, b: CellDigit) => a.cell === b.cell && a.digit === b.digit;
/** a length to a billionth of a cell, so two lines the same length compare equal however their sums were rounded */
const rounded = (x: number) => Math.round(x * 1e9) / 1e9;

/** the distance from p to the segment ab */
function toSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
}

/** how far apart the board draws two candidates, in cells */
export function drawnDistance(a: CellDigit, b: CellDigit): number {
  const pa = candidateCentre(a);
  const pb = candidateCentre(b);
  return rounded(Math.hypot(pa.x - pb.x, pa.y - pb.y));
}

/** how many other marks of the hint a tie's straight line would pass over: their centres within a mark's radius of it (none inside one cell, where it draws no line) */
function marksOver(a: CellDigit, b: CellDigit, marks: readonly CellDigit[]): number {
  if (a.cell === b.cell) return 0;
  const pa = candidateCentre(a);
  const pb = candidateCentre(b);
  return marks.filter((m) => !same(m, a) && !same(m, b) && toSegment(candidateCentre(m), pa, pb) < MARK_RADIUS).length;
}

/**
 * What a tie costs to draw: nothing inside one cell, where it draws no
 * line; else its length, and 3 more for each other mark of the hint whose
 * centre lies within a mark's radius of the line, which the line would
 * pass over
 */
export function tieWeight(a: CellDigit, b: CellDigit, marks: readonly CellDigit[]): number {
  if (a.cell === b.cell) return 0;
  const pa = candidateCentre(a);
  const pb = candidateCentre(b);
  return rounded(Math.hypot(pa.x - pb.x, pa.y - pb.y) + OVER_A_MARK * marksOver(a, b, marks));
}

/** the way the board draws a line from one candidate towards another, as a unit vector */
function wayTo(from: CellDigit, to: CellDigit): { x: number; y: number } {
  const p = candidateCentre(from);
  const q = candidateCentre(to);
  const l = Math.hypot(q.x - p.x, q.y - p.y);
  return { x: (q.x - p.x) / l, y: (q.y - p.y) / l };
}

/** a line the tree draws from a tie's end within 60 degrees of the tie's own way crowds it: bent round a mark, the tie could run along it or cross it */
const CROWDED = Math.cos(Math.PI / 3);

/**
 * The ties a cluster draws: the shortest drawn spanning tree of its strong
 * relations (Kruskal), every tie weighed by tieWeight, so a cell's own two
 * candidates are joined first and a line over another mark is taken only
 * where nothing shorter joins. Of the ties that weigh the same, which any
 * order keeps as short, the tree takes them as it would draw them best:
 * first one whose straight line passes no other mark, so it draws
 * straight; then one whose line leaves its ends clear of the ties the tree
 * already draws there, the fewest of them within 60 degrees of it (a line
 * bent round a mark leaves its end well off its straight way, and would
 * run along such a tie or cross it); then the first in reading order.
 * `relations` are the cluster's strong relations (its conjugate pairs, its
 * bivalue cells, a Remote Pair's cells that see each other), `marks` every
 * candidate the hint marks. The ties come in walk order: breadth first
 * from the cluster's first candidate in reading order, each from the end
 * nearer it, a candidate's ties in reading order.
 */
export function spanningTies(
  nodes: readonly CellDigit[],
  relations: readonly [CellDigit, CellDigit][],
  marks: readonly CellDigit[]
): [CellDigit, CellDigit][] {
  const edges = relations
    .map(([a, b]) => (readingOrder(a, b) <= 0 ? [a, b] : [b, a]) as [CellDigit, CellDigit])
    .map(([a, b]) => ({ a, b, w: tieWeight(a, b, marks), over: marksOver(a, b, marks) > 0 }))
    .sort((p, q) => p.w - q.w || readingOrder(p.a, q.a) || readingOrder(p.b, q.b));
  type Edge = (typeof edges)[number];
  const parent = new Map(nodes.map((x) => [key(x), key(x)]));
  const root = (x: number): number => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  const tree = new Map<number, CellDigit[]>();
  const join = (a: CellDigit, b: CellDigit) => tree.set(key(a), [...(tree.get(key(a)) ?? []), b]);
  /** whether a tie still joins two parts of the tree */
  const joins = ({ a, b }: Edge) => parent.has(key(a)) && parent.has(key(b)) && root(key(a)) !== root(key(b));
  /** how many lines the tree draws from a tie's ends within 60 degrees of its own */
  const crowding = ({ a, b }: Edge): number => {
    if (a.cell === b.cell) return 0;
    let n = 0;
    for (const [end, other] of [
      [a, b],
      [b, a]
    ]) {
      const u = wayTo(end, other);
      for (const next of tree.get(key(end)) ?? []) {
        if (next.cell === end.cell) continue;
        const v = wayTo(end, next);
        if (u.x * v.x + u.y * v.y > CROWDED + 1e-9) n++;
      }
    }
    return n;
  };
  // Kruskal, a weight at a time: of the ties that weigh the same, the best drawn next
  for (let i = 0, j = 0; i < edges.length; i = j) {
    while (j < edges.length && edges[j].w === edges[i].w) j++;
    let open = edges.slice(i, j).filter(joins);
    while (open.length) {
      let best = open[0];
      let score = [Number(best.over), crowding(best)];
      for (const e of open.slice(1)) {
        const s = [Number(e.over), crowding(e)];
        if (s[0] < score[0] || (s[0] === score[0] && s[1] < score[1])) [best, score] = [e, s];
      }
      parent.set(root(key(best.a)), root(key(best.b)));
      join(best.a, best.b);
      join(best.b, best.a);
      open = open.filter((e) => e !== best && joins(e));
    }
  }
  // walk order: breadth first from the first candidate
  const sorted = [...nodes].sort(readingOrder);
  const out: [CellDigit, CellDigit][] = [];
  const seen = new Set<number>();
  for (const start of sorted) {
    if (seen.has(key(start))) continue;
    seen.add(key(start));
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const next of [...(tree.get(key(cur)) ?? [])].sort(readingOrder)) {
        if (seen.has(key(next))) continue;
        seen.add(key(next));
        out.push([cur, next]);
        queue.push(next);
      }
    }
  }
  return out;
}

/** of the candidates given, the one the board draws nearest `to`; of two as near, the first in reading order */
export function nearest(to: CellDigit, options: readonly CellDigit[]): CellDigit {
  return [...options].sort((a, b) => drawnDistance(to, a) - drawnDistance(to, b) || readingOrder(a, b))[0];
}

/** the parity of a cluster's first candidate in reading order: dark, where nothing in the argument says otherwise */
export function firstParity(cands: readonly CellDigit[], parity: (x: CellDigit) => number): number {
  return parity([...cands].sort(readingOrder)[0]);
}

/** a cluster's two colours, dark the parity given (the colour the argument tries first), each in reading order */
export function shades(cands: readonly CellDigit[], parity: (x: CellDigit) => number, dark: number): ColourCluster {
  const sorted = [...cands].sort(readingOrder);
  return { dark: sorted.filter((x) => parity(x) === dark), light: sorted.filter((x) => parity(x) !== dark) };
}

/** a cluster's ties as links, in walk order, the first carrying the sentence of the cluster's frame */
export function tieLinks(ties: readonly [CellDigit, CellDigit][], text: string): ChainLink[] {
  return ties.map(([a, b], i) => ({ from: [a], to: [b], strong: true, undirected: true, ...(i === 0 ? { text } : {}) }));
}

/** a weak tie of the argument: its two ends see each other or share a cell, so at most one of them is true */
export const weakTie = (from: CellDigit[], to: CellDigit[], text: string): ChainLink => ({ from, to, strong: false, undirected: true, text });
