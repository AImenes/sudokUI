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
    };

/** the sizes, as fractions of a cell (docs/hint-drawing.md, Colours and sizes) */
export const SIZES = {
  /** a mark's outer radius */
  r: 0.13,
  /** the room between a mark's rim and an arrow's end */
  gap: 0.03,
  /** the shaft */
  stroke: 0.03,
  /** the head's length and width */
  headLength: 0.14,
  headWidth: 0.11,
  /** an arrow passing closer than this to another mark's rim must bend */
  clearance: 0.05,
  /** the bulge of an arc, tried from the smallest */
  bulges: [0.22, 0.32, 0.45, 0.6, 0.8],
  /** how far apart two links between the same nodes are drawn */
  pair: 0.09
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

/** the middle of a node's candidates */
function centroidOf(node: CellDigit[], layout: Layout): Point {
  const ps = node.map((cd) => layout.centre(cd));
  return { x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length };
}

/** the point a node is joined at: its candidate, or a group's member nearest `towards` */
export function anchorOf(node: CellDigit[], layout: Layout, towards?: Point): Point {
  if (node.length === 1 || !towards) return node.length === 1 ? layout.centre(node[0]) : centroidOf(node, layout);
  let best = layout.centre(node[0]);
  for (const cd of node) {
    const p = layout.centre(cd);
    if (len(sub(p, towards)) < len(sub(best, towards))) best = p;
  }
  return best;
}

/** a link starts a new branch: it is the first, or it does not go on from where the one before ended */
const startsBranch = (links: ChainLink[], i: number) => i === 0 || !sameNode(links[i - 1].to, links[i].from);

/**
 * Where the start markers go (G14): beside the first node of every branch
 * that infers something (a branch of ties only, a colouring's cluster, has
 * no reading order), at the upper left of its mark
 */
export function startMarkers(links: ChainLink[], layout: Layout): Point[] {
  const out: Point[] = [];
  links.forEach((l, i) => {
    if (!startsBranch(links, i)) return;
    // the branch's links, up to the next branch
    let j = i;
    while (j + 1 < links.length && !startsBranch(links, j + 1)) j++;
    if (links.slice(i, j + 1).every((b) => b.undirected)) return;
    const next = links.slice(i, j + 1).find((b) => !insideOneCell(b)) ?? l;
    const a = anchorOf(l.from, layout, centroidOf(next.to, layout));
    const off = (layout.r + SIZES.gap * layout.cell) / Math.SQRT2;
    out.push({ x: a.x - off, y: a.y - off });
  });
  return out;
}

/**
 * A link that needs no arrow: its two ends lie in the same cells (a bivalue
 * switch, or one set's two digits): the marks side by side say it (G12)
 */
export function insideOneCell(link: ChainLink): boolean {
  const cells = (node: CellDigit[]) => [...new Set(node.map((cd) => cd.cell))].sort((a, b) => a - b).join(',');
  return cells(link.from) === cells(link.to);
}

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

/**
 * How clear a curve keeps of the other marks: the least room left between
 * it and any mark's rim (negative when it crosses one), and minus a cell
 * for every sample outside the board, which no clearance makes up for
 */
function clearanceOf(points: Point[], obstacles: Point[], layout: Layout): number {
  let least = Infinity;
  const { x0, y0, x1, y1 } = layout.bounds;
  for (const p of points) {
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) least = Math.min(least, -layout.cell);
    for (const o of obstacles) least = Math.min(least, len(sub(p, o)) - layout.r);
  }
  return least;
}

/**
 * The arrows of a hint. `obstacles` are the centres of every mark the hint
 * draws (its nodes, removals, placements and pattern candidates); an arrow
 * is never bent for a candidate the hint does not mark.
 */
export function arrowShapes(links: ChainLink[], layout: Layout, obstacles: CellDigit[]): ArrowShape[] {
  const c = layout.cell;
  const gap = SIZES.gap * c;
  const headLength = SIZES.headLength * c;
  const headWidth = SIZES.headWidth * c;
  const need = SIZES.clearance * c;
  const marks = obstacles.map((cd) => ({ cd, p: layout.centre(cd) }));

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

  return links.map((l, i): ArrowShape => {
    if (insideOneCell(l)) return { kind: 'none', link: i };

    // a group is joined at its member nearest the other end
    const a = anchorOf(l.from, layout, centroidOf(l.to, layout));
    const b = anchorOf(l.to, layout, a);
    const u = unit(sub(b, a));
    // the two nodes of the pair, spread sideways when more than one link joins them
    const group = pairs.get(pairKey(l)) ?? [i];
    const spread = group.length > 1 ? (group.indexOf(i) - (group.length - 1) / 2) * SIZES.pair * c : 0;
    // the sideways shift is measured in one fixed direction for the pair, so
    // links running opposite ways still end up apart
    const along = pairKey(l).startsWith(l.from.map(key).sort().join('+')) ? u : mul(u, -1);
    const shift = mul(perp(along), spread);

    const own = new Set([...l.from, ...l.to].map(key));
    const others = marks.filter((m) => !own.has(key(m.cd))).map((m) => m.p);

    if (l.undirected) {
      const p0 = add(add(a, mul(u, layout.r + gap)), shift);
      const p1 = add(sub(b, mul(u, layout.r + gap)), shift);
      return { kind: 'tie', link: i, d: `M ${f(p0.x)} ${f(p0.y)} L ${f(p1.x)} ${f(p1.y)}` };
    }

    // straight, if it keeps clear of the hint's other marks (G9, G10)
    const s0 = add(add(a, mul(u, layout.r + gap)), shift);
    const tip0 = add(sub(b, mul(u, layout.r + gap)), shift);
    const blocked = others.some((o) => {
      const { dist, t } = toSegment(o, s0, tip0);
      return t > 0 && t < 1 && dist < layout.r + need;
    });

    let tail = s0;
    let tip = tip0;
    let control: Point | null = null;
    if (blocked) {
      // one gentle arc, to the side and of the size that keeps clear of the
      // other marks along the whole curve; if none does, the clearest one
      const mid = mul(add(a, b), 0.5);
      let best: { control: Point; room: number } | null = null;
      for (const bulge of SIZES.bulges) {
        for (const side of [1, -1]) {
          const cp = add(add(mid, mul(perp(u), side * bulge * c * 2)), shift);
          const t0 = add(a, mul(unit(sub(cp, a)), layout.r + gap));
          const t1 = add(b, mul(unit(sub(cp, b)), layout.r + gap));
          const samples = Array.from({ length: 19 }, (_, k) => quad(t0, cp, t1, (k + 1) / 20));
          const room = clearanceOf(samples, others, layout);
          if (!best || room > best.room) best = { control: cp, room };
        }
        if (best && best.room >= need) break;
      }
      control = best!.control;
      tail = add(a, mul(unit(sub(control, a)), layout.r + gap));
      tip = add(b, mul(unit(sub(control, b)), layout.r + gap));
    }

    // the head points along the curve's last stretch; the shaft stops where
    // the head begins, so its end never shows past the tip
    const dir = unit(sub(tip, control ?? tail));
    const span = len(sub(tip, tail));
    const hasHead = span > headLength * 1.4;
    const headBase = hasHead ? sub(tip, mul(dir, headLength)) : tip;
    const head = hasHead
      ? [tip, add(headBase, mul(perp(dir), headWidth / 2)), sub(headBase, mul(perp(dir), headWidth / 2))]
      : [];
    // the shaft runs a little under the head so no seam shows between them
    const end = hasHead ? sub(tip, mul(dir, headLength * 0.75)) : tip;
    const d = control
      ? `M ${f(tail.x)} ${f(tail.y)} Q ${f(control.x)} ${f(control.y)} ${f(end.x)} ${f(end.y)}`
      : `M ${f(tail.x)} ${f(tail.y)} L ${f(end.x)} ${f(end.y)}`;
    const mid = control ? quad(tail, control, tip, 0.5) : mul(add(tail, tip), 0.5);
    return { kind: 'arrow', link: i, d, head, strong: l.strong, tail, mid };
  });
}

/** a polygon's points, for an SVG `points` attribute */
export const pointsOf = (ps: Point[]) => ps.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
