// Where a hint's arrows go (docs/hint-drawing.md, G9-G14), shared by every
// board that draws one: the app's (src/ui/Grid.tsx) and the Learn
// diagrams' (src/content/boardSvg.ts). Pure geometry: a board says where
// its candidates sit and how big a mark is, and gets back, for every link,
// either nothing (a link inside one cell, G12), a quiet tie, or an arrow
// with its path, its head and where its walk number goes. Each board paints
// the result in its own colours.
//
// The rules, in HoDoKu's spirit and with its legacy flaws fixed:
// - an arrow is straight, from just outside its start mark to just outside
//   its target, with a head at the target only (G9);
// - it bends only when another mark of the same hint lies on its line, into
//   one gentle arc to the side that clears those marks, checked along the
//   whole curve (G10; HoDoKu always bends left by a fixed amount and never
//   checks); unrelated candidates and digits are crossed straight, readable
//   through the halo the board draws;
// - two links between the same two nodes are drawn side by side, not on top
//   of each other;
// - a group node is joined at its member nearest the other end (a centroid
//   can fall in a cell that is not one of its members);
// - the first node of each branch carries the start marker (G14), beside
//   its mark: after a switch inside the start cell, the first drawn arrow
//   leaves from the second node, not the first.
import type { CellDigit, ChainLink } from '../engine/steps';

export interface Point {
  x: number;
  y: number;
}

/** what a board tells the geometry about itself */
export interface Layout {
  /** the centre of a candidate's mark */
  centre(cd: CellDigit): Point;
  /** a mark's outer radius */
  r: number;
  /** a mark's outer radius where it is larger than `r` (a placement's outer ring) */
  radiusOf?(cd: CellDigit): number;
  /** a cell's size; the other sizes are fractions of it */
  cell: number;
  /** the area an arc may use */
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

export type ArrowShape =
  /** a link inside one cell, or between two digits of one set: no arrow (G12) */
  | { kind: 'none'; link: number }
  /** a conjugate pair or a bivalue cell in a colouring: a quiet straight line */
  | { kind: 'tie'; link: number; d: string }
  | {
      kind: 'arrow';
      link: number;
      /** the shaft, ending where the head begins */
      d: string;
      /** the head, a filled triangle whose tip is just outside the target */
      head: Point[];
      strong: boolean;
      /** where the shaft starts */
      tail: Point;
      /** the middle of the shaft, where the walk's number goes */
      mid: Point;
      /** points along the shaft and the head, for what must keep clear of it */
      trace: Point[];
    };

/** the sizes, as fractions of a cell (docs/hint-drawing.md, Colours and sizes) */
export const SIZES = {
  /** a mark's outer radius */
  r: 0.13,
  /** the room between a mark's rim and an arrow's end */
  gap: 0.03,
  /** the shaft, and its halo's extra width */
  stroke: 0.03,
  halo: 0.02,
  /** the head's length and width */
  headLength: 0.14,
  headWidth: 0.11,
  /** an arrow passing closer than this to another mark's rim must bend */
  clearance: 0.05,
  /** the bulge of an arc, tried from the smallest */
  bulges: [0.22, 0.32, 0.45, 0.6, 0.8, 1.0],
  /** how far apart two links between the same nodes are drawn */
  pair: 0.09,
  /** the start marker's radius */
  dot: 0.045
};

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
const len = (a: Point) => Math.hypot(a.x, a.y);
const unit = (a: Point): Point => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
/** a quarter turn to the left on the screen (y down) */
const perp = (a: Point): Point => ({ x: a.y, y: -a.x });
const f = (n: number) => n.toFixed(1);

const key = (cd: CellDigit) => `${cd.cell}:${cd.digit}`;
const sameNode = (a: CellDigit[], b: CellDigit[]) =>
  a.length === b.length && a.every((cd) => b.some((o) => o.cell === cd.cell && o.digit === cd.digit));
const shareACell = (a: CellDigit[], b: CellDigit[]) => a.some((cd) => b.some((o) => o.cell === cd.cell));
const digitsOf = (node: CellDigit[]) => [...new Set(node.map((cd) => cd.digit))].sort().join(',');

/** the middle of a node's candidates */
function centroidOf(node: CellDigit[], layout: Layout): Point {
  const ps = node.map((cd) => layout.centre(cd));
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

/** a candidate's mark radius on this board */
const radius = (layout: Layout, cd: CellDigit) => layout.radiusOf?.(cd) ?? layout.r;

/** the member a node is joined at: its candidate, or a group's member nearest `towards` */
function memberOf(node: CellDigit[], layout: Layout, towards?: Point): CellDigit {
  if (node.length === 1 || !towards) return node[0];
  let best = node[0];
  for (const cd of node) if (len(sub(layout.centre(cd), towards)) < len(sub(layout.centre(best), towards))) best = cd;
  return best;
}

/** the point a node is joined at: its candidate, or a group's member nearest `towards` */
export function anchorOf(node: CellDigit[], layout: Layout, towards?: Point): Point {
  if (node.length > 1 && !towards) return centroidOf(node, layout);
  return layout.centre(memberOf(node, layout, towards));
}

/**
 * A link that needs no arrow (G12): its two ends share a cell and differ in
 * digit. A bivalue switch, or a set's change of digit, whose two digits may
 * cover different cells of the set: an arrow inside one cell, or from one
 * member to another, would say more than the set does ("if r8c3 is not 9
 * it is 3", where r8c3 could be 4 with the 3 elsewhere in the set). The
 * marks side by side say it, and the walk names it.
 */
export function insideOneCell(link: ChainLink): boolean {
  return shareACell(link.from, link.to) && digitsOf(link.from) !== digitsOf(link.to);
}

/**
 * A link goes on from the one before: it leaves the node the other reached,
 * or, in a chain of sets, another digit of the set it reached (the set's
 * own link, which is not drawn)
 */
const goesOn = (links: ChainLink[], i: number) =>
  i > 0 && (sameNode(links[i - 1].to, links[i].from) || shareACell(links[i - 1].to, links[i].from));

/** the shortest distance from a point to the segment a-b, and where along it (0..1) */
function toSegment(p: Point, a: Point, b: Point): { dist: number; t: number } {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
  return { dist: len(sub(p, add(a, mul(ab, t)))), t };
}

/** a point of the quadratic curve a-c-b */
const quad = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
});

/** something an arrow must keep clear of: a mark, or another arrow's end */
interface Obstacle {
  p: Point;
  r: number;
}

/**
 * How clear a set of points keeps of the obstacles: the least room left
 * between them and any obstacle's rim (negative when one is crossed), and
 * minus a cell for a point too near the board's edge for its halo
 */
function clearanceOf(points: Point[], obstacles: Obstacle[], layout: Layout, margin: number): number {
  let least = Infinity;
  const { x0, y0, x1, y1 } = layout.bounds;
  for (const p of points) {
    if (p.x < x0 + margin || p.x > x1 - margin || p.y < y0 + margin || p.y > y1 - margin) least = Math.min(least, -layout.cell);
    for (const o of obstacles) least = Math.min(least, len(sub(p, o.p)) - o.r);
  }
  return least;
}

/** the head of an arrow whose last stretch runs along `dir` to `tip` */
function headAt(tip: Point, dir: Point, layout: Layout): Point[] {
  const base = sub(tip, mul(dir, SIZES.headLength * layout.cell));
  const w = (SIZES.headWidth * layout.cell) / 2;
  return [tip, add(base, mul(perp(dir), w)), sub(base, mul(perp(dir), w))];
}

/**
 * The arrows of a hint. `obstacles` are every mark the hint draws (its
 * nodes, removals, placements and pattern candidates); an arrow is never
 * bent for a candidate the hint does not mark. The arrows also keep their
 * arcs and heads clear of each other's ends.
 */
export function arrowShapes(links: ChainLink[], layout: Layout, obstacles: CellDigit[]): ArrowShape[] {
  const c = layout.cell;
  const gap = SIZES.gap * c;
  const headLength = SIZES.headLength * c;
  const need = SIZES.clearance * c;
  const margin = ((SIZES.stroke + SIZES.halo) * c) / 2;
  const marks = obstacles.map((cd) => ({ cd, p: layout.centre(cd), r: radius(layout, cd) }));
  const centre = { x: (layout.bounds.x0 + layout.bounds.x1) / 2, y: (layout.bounds.y0 + layout.bounds.y1) / 2 };

  // links between the same two nodes, in either direction, are spread apart
  const pairKey = (l: ChainLink) => {
    const a = l.from.map(key).sort().join('+');
    const b = l.to.map(key).sort().join('+');
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  };
  const pairs = new Map<string, number[]>();
  links.forEach((l, i) => {
    if (insideOneCell(l)) return;
    const k = pairKey(l);
    pairs.set(k, [...(pairs.get(k) ?? []), i]);
  });

  // where each link's ends lie, straight: the candidates it joins
  const ends = links.map((l) => {
    const fromCd = memberOf(l.from, layout, centroidOf(l.to, layout));
    const toCd = memberOf(l.to, layout, layout.centre(fromCd));
    return { fromCd, toCd, a: layout.centre(fromCd), b: layout.centre(toCd) };
  });
  // the other arrows' ends, straight, just outside their marks: an arc or a
  // head keeps clear of them too
  const arrowEnds = links.flatMap((l, i): (Obstacle & { link: number })[] => {
    if (insideOneCell(l) || l.undirected) return [];
    const { fromCd, toCd, a, b } = ends[i];
    const u = unit(sub(b, a));
    const w = (SIZES.headWidth * c) / 2;
    return [
      { link: i, p: add(a, mul(u, radius(layout, fromCd) + gap)), r: w },
      { link: i, p: sub(b, mul(u, radius(layout, toCd) + gap + headLength / 2)), r: w }
    ];
  });

  return links.map((l, i): ArrowShape => {
    if (insideOneCell(l)) return { kind: 'none', link: i };
    const { fromCd, toCd, a, b } = ends[i];
    const ra = radius(layout, fromCd) + gap;
    const rb = radius(layout, toCd) + gap;
    // a degenerate link, its ends on one candidate or touching: nothing to draw
    if (len(sub(b, a)) <= ra + rb) return { kind: 'none', link: i };
    const u = unit(sub(b, a));
    // the two nodes of the pair, spread sideways when more than one link joins them
    const group = pairs.get(pairKey(l)) ?? [i];
    const spread = group.length > 1 ? (group.indexOf(i) - (group.length - 1) / 2) * SIZES.pair * c : 0;
    // the sideways shift is measured in one fixed direction for the pair, so
    // links running opposite ways still end up apart
    const along = pairKey(l).startsWith(l.from.map(key).sort().join('+')) ? u : mul(u, -1);
    const shift = mul(perp(along), spread);

    const own = new Set([...l.from, ...l.to].map(key));
    const others: Obstacle[] = [
      ...marks.filter((m) => !own.has(key(m.cd))),
      // other arrows' ends, but not those that meet this one at its own
      // marks, where arrows into and out of one node always gather
      ...arrowEnds.filter((e) => e.link !== i && len(sub(e.p, a)) > ra + headLength + 1 && len(sub(e.p, b)) > rb + headLength + 1)
    ];

    if (l.undirected) {
      const p0 = add(add(a, mul(u, ra)), shift);
      const p1 = add(sub(b, mul(u, rb)), shift);
      return { kind: 'tie', link: i, d: `M ${f(p0.x)} ${f(p0.y)} L ${f(p1.x)} ${f(p1.y)}` };
    }

    // a candidate drawing, straight or one arc, scored by how clear it keeps
    // of the hint's other marks and the other arrows' ends, along its whole
    // length and its head (G9, G10)
    const shape = (control: Point | null) => {
      const tail = control ? add(a, mul(unit(sub(control, a)), ra)) : add(add(a, mul(u, ra)), shift);
      const tip = control ? add(b, mul(unit(sub(control, b)), rb)) : add(sub(b, mul(u, rb)), shift);
      const dir = unit(sub(tip, control ?? tail));
      const hasHead = len(sub(tip, tail)) > headLength * 1.4;
      const head = hasHead ? headAt(tip, dir, layout) : [];
      const trace = [
        ...Array.from({ length: 21 }, (_, k) => (control ? quad(tail, control, tip, k / 20) : add(tail, mul(sub(tip, tail), k / 20)))),
        ...head
      ];
      return { tail, tip, dir, head, trace, control, room: clearanceOf(trace, others, layout, margin) };
    };

    let best = shape(null);
    if (best.room < need) {
      // one gentle arc, the smallest that keeps clear, on the side with
      // more room (the board's middle on a tie, so the choice never rests
      // on rounding); turning midway first, then near either end, which
      // lets an arrow come in steeply past a mark beside its target; if
      // none keeps clear, the clearest drawing of all
      for (const bulge of SIZES.bulges) {
        for (const at of [0.5, 0.78, 0.22]) {
          const base = add(a, mul(sub(b, a), at));
          const [p, q] = [1, -1].map((side) => shape(add(add(base, mul(perp(u), side * bulge * c * 2)), shift)));
          const pick =
            Math.abs(p.room - q.room) < 0.5
              ? len(sub(p.control!, centre)) <= len(sub(q.control!, centre))
                ? p
                : q
              : p.room > q.room
                ? p
                : q;
          if (pick.room > best.room + 0.01) best = pick;
          if (best.room >= need) break;
        }
        if (best.room >= need) break;
      }
    }

    const { tail, tip, dir, head, trace, control } = best;
    // the shaft runs a little under the head so no seam shows between them
    const end = head.length ? sub(tip, mul(dir, headLength * 0.75)) : tip;
    const d = control
      ? `M ${f(tail.x)} ${f(tail.y)} Q ${f(control.x)} ${f(control.y)} ${f(end.x)} ${f(end.y)}`
      : `M ${f(tail.x)} ${f(tail.y)} L ${f(end.x)} ${f(end.y)}`;
    const mid = control ? quad(tail, control, tip, 0.5) : mul(add(tail, tip), 0.5);
    return { kind: 'arrow', link: i, d, head, strong: l.strong, tail, mid, trace };
  });
}

/**
 * Where the start markers go (G14): beside the first node of every branch
 * that infers something (a branch of ties only, a colouring's cluster, has
 * no reading order; a chain of sets goes on through each set, so it has one
 * start), on whichever side of the mark keeps clearest of the arrows and
 * the other marks, upper left when all are clear
 */
export function startMarkers(links: ChainLink[], layout: Layout, obstacles: CellDigit[] = []): Point[] {
  const c = layout.cell;
  const dot = SIZES.dot * c;
  const traces = arrowShapes(links, layout, obstacles).flatMap((s) => (s.kind === 'arrow' ? s.trace : []));
  const out: Point[] = [];
  links.forEach((l, i) => {
    if (goesOn(links, i)) return;
    // the branch's links, up to the next branch
    let j = i;
    while (j + 1 < links.length && goesOn(links, j + 1)) j++;
    if (links.slice(i, j + 1).every((b) => b.undirected)) return;
    const next = links.slice(i, j + 1).find((b) => !insideOneCell(b)) ?? l;
    const at = memberOf(l.from, layout, centroidOf(next.to, layout));
    const a = layout.centre(at);
    const reach = radius(layout, at) + SIZES.gap * c + dot / 2;
    const own = new Set(l.from.map(key));
    const marks: Obstacle[] = obstacles.filter((cd) => !own.has(key(cd))).map((cd) => ({ p: layout.centre(cd), r: radius(layout, cd) }));
    // upper left first, then round the clock
    let best: { p: Point; room: number } | null = null;
    for (let k = 0; k < 8; k++) {
      const angle = Math.PI * (1.25 + k / 4);
      const p = add(a, mul({ x: Math.cos(angle), y: Math.sin(angle) }, reach));
      const room = Math.min(
        clearanceOf([p], marks, layout, dot),
        ...traces.map((t) => len(sub(p, t)) - (SIZES.stroke * c) / 2)
      ) - dot;
      if (!best || room > best.room + 0.5) best = { p, room };
    }
    out.push(best!.p);
  });
  return out;
}

/** a polygon's points, for an SVG `points` attribute */
export const pointsOf = (ps: Point[]) => ps.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
