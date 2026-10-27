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
//   whole curve, or, when marks beside both ends box it in, a curve with a
//   bend off each end (G10; HoDoKu always bends left by a fixed amount and
//   never checks); unrelated candidates and digits are crossed straight,
//   readable through the halo the board draws, and cut out of the line;
// - two links between the same two nodes are drawn side by side, not on top
//   of each other;
// - a group node is joined at its member nearest the other end (a centroid
//   can fall in a cell that is not one of its members), where the ray
//   towards the other end leaves that member's mark, a "one of these"
//   square's exactly;
// - a group's bar (docs/hint-drawing-sets.md, decisions 2 and 4) runs in
//   the glyph-free gutter beside its members, on the side that crosses the
//   least, and every arrow, start dot and walk number keeps off it, an
//   arrow passing only beside the member it is anchored at, so no arrow
//   runs between a group's members;
// - the first node of each branch carries the start marker (G14), beside
//   its mark: after a switch inside the start cell, the first drawn arrow
//   leaves from the second node, not the first.
// A colouring (docs/hint-drawing-colouring.md) draws its ties and its weak
// ties in different frames, so each is laid out without the other:
// - a tie is a quiet line, straight unless another mark its cluster's frame
//   draws, or another candidate of its digit the board shows, lies on it;
//   then it bends round it as an arrow would, with no head, so it never
//   seems to join that candidate, and leaves an end it shares with another
//   tie at a clear angle off that tie, crossing it nowhere further on, so
//   the two never read as one line; a bend off each end runs beside no
//   other tie, and no bend crosses one twice;
// - a weak tie is an arrow with no head and no start marker, bent like
//   one, which also keeps off the other candidates of its digit the board
//   shows, so it never seems to join a third, and off the end of another
//   weak tie into its cell, so two of them come in apart; two into one
//   candidate that cross before it are drawn again, apart; boxed in at an
//   end by the marks beside its candidate, it comes in from a free side;
//   inside one cell it is four corner brackets round the cell;
// - a bend of either keeps off the grid lines, box lines first, where its
//   line would merge with theirs, and off the board's edge.
import type { CellDigit, ChainLink, Step } from '../engine/steps';
import { MARK } from './hintPalette';

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
  /** a mark's outer radius where it is larger than `r` (a placement's outer ring, a "one of these" square's corners) */
  radiusOf?(cd: CellDigit): number;
  /**
   * how far a mark reaches from its centre along a direction (a unit
   * vector), where that is not its radius: a "one of these" square, 13 on
   * its axes and 15.5 at its corners (docs/hint-drawing-sets.md, decision
   * 4). An arrow's end and a start dot sit that far out, so they keep the
   * same gap off a square as off a disc at every angle
   */
  reach?(cd: CellDigit, dir: Point): number;
  /**
   * a digit is drawn at its place in its cell, cut out of the arrows (G11):
   * a head, a start dot and a walk number keep off it. Absent, a head is
   * steered off no digit, a start dot keeps off every place of its cell,
   * and a walk number takes every place for an empty one
   */
  shown?(cd: CellDigit): boolean;
  /** a cell holds a solved digit, drawn large in its middle, which a walk number keeps off */
  solved?(cell: number): boolean;
  /** a cell's size; the other sizes are fractions of it */
  cell: number;
  /** the grid's area: an arc stays inside it, and a cell's square is found from it */
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

export type ArrowShape =
  /** a link inside one cell, or between two digits of one set: no arrow (G12) */
  | { kind: 'none'; link: number }
  /**
   * a conjugate pair or a bivalue cell in a colouring: a quiet line from end
   * to end, straight unless another mark of its frame, or another candidate
   * of its digit, lies on it (`trace`: points along it)
   */
  | { kind: 'tie'; link: number; d: string; trace: Point[] }
  | {
      kind: 'arrow';
      link: number;
      /** the shaft, ending where the head begins */
      d: string;
      /** the head, a filled triangle whose tip is just outside the target; none for a weak tie */
      head: Point[];
      strong: boolean;
      /** where the shaft starts */
      tail: Point;
      /** the middle of the shaft, where the walk's number goes */
      mid: Point;
      /** points along the shaft and the head, for what must keep clear of it */
      trace: Point[];
      /** a colouring's weak tie: no head, no start marker, its two ends alike */
      undirected?: true;
    }
  /**
   * a colouring's weak tie inside one cell: four corner brackets round the
   * cell, in the arrows' ink, the walk's number on a clear corner
   */
  | {
      kind: 'cell';
      link: number;
      cell: number;
      /** the four L-shapes */
      d: string;
      /** points along them, for what must keep clear of them */
      trace: Point[];
      /** each bracket's corner, upper left first and round the clock: where the walk's number may go */
      corners: Point[];
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
  /** the start marker's radius, and the most it is drawn at: a small
   *  board enlarges it (src/ui/styles.css), and the Learn diagrams draw it so */
  dot: 0.045,
  dotLarge: 0.063,
  /** a walk number's badge radius, and the most a small board enlarges it */
  badge: 0.1,
  badgeLarge: 0.16,
  /** corner brackets: each corner's inset from the cell's edge, and its arms' length at most */
  bracketInset: 0.055,
  bracketArm: 0.1,
  /**
   * how far a bracket's arm keeps from the middle of each candidate's place
   * in its cell: on a small board, the bracket's halo (half width 0.03)
   * off a mark's disc (0.13), and its stroke (0.02) off a shade's keyline
   * (0.15), with a little more; the bottom row of places sits nearer the
   * cell's edge than the top row, so the bottom corners' arms are shorter
   */
  bracketClear: 0.18,
  /**
   * the room a colouring's walk number keeps from another beyond their two
   * radii at the largest size a number is drawn: their outlines in the
   * board's colour (0.016 each) and a gap between them that shows (0.05)
   */
  badgeGap: 0.08,
  /** how near a grid line a weak tie's or a tie's bend may run along it */
  gridLine: 0.08,
  /**
   * how far round the member an arrow is anchored at its group's own bar is
   * no obstacle, beyond the gap and the bar's half width: a little more than
   * a "one of these" square's reach on its axes (docs/hint-drawing-sets.md,
   * decision 4), so the arrow can leave the member on the bar's side
   */
  barFree: 0.14
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

/** how far a candidate's mark reaches from its centre along a direction: its radius, or a square's exact reach */
const reachAt = (layout: Layout, cd: CellDigit, dir: Point) => (layout.reach ? layout.reach(cd, dir) : radius(layout, cd));

/**
 * How far a "one of these" square reaches from its centre along a
 * direction (a unit vector): a rounded square of half side `half` and
 * corner radius `corner`, so on the app's board 13 along its axes and 15.5
 * at its corners (docs/hint-drawing-sets.md, decision 4)
 */
export function squareReach(dir: Point, half: number, corner: number): number {
  const [ax, ay] = [Math.abs(dir.x), Math.abs(dir.y)];
  const edge = half / Math.max(ax, ay);
  // the ray leaves by a straight side, short of the rounding
  if (Math.min(ax, ay) * edge <= half - corner) return edge;
  // or by a corner's arc, round a centre `half - corner` in from both sides
  const c = half - corner;
  const along = (ax + ay) * c;
  return along + Math.sqrt(along * along - 2 * c * c + corner * corner);
}

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

/** where a link's ends lie, straight: the candidates it joins, a group's member nearest the other end, and their centres */
function straightEnds(l: ChainLink, layout: Layout): { fromCd: CellDigit; toCd: CellDigit; a: Point; b: Point } {
  const fromCd = memberOf(l.from, layout, centroidOf(l.to, layout));
  const toCd = memberOf(l.to, layout, layout.centre(fromCd));
  return { fromCd, toCd, a: layout.centre(fromCd), b: layout.centre(toCd) };
}

/**
 * A group's bar (docs/hint-drawing-sets.md, decision 2): a straight line in
 * the glyph-free gutter beside the members, from the first member's centre
 * to the last's, moved MARK.groupBar off their line to one side
 */
export interface GroupBar {
  /** the group, an index into Step.sets */
  set: number;
  /** its members, in order along it */
  members: CellDigit[];
  /** its two ends */
  a: Point;
  b: Point;
}

/**
 * A hint's groups and sets as the board draws them, worked out once from
 * the full view (G14), as the arrows are: its groups' bars
 */
export interface SetShapes {
  bars: GroupBar[];
}

/** half a bar's width, at the widest it is drawn (a board under 330 CSS px), for what keeps off it */
const barHalf = (layout: Layout) => (MARK.groupBarStrokeTiny * layout.cell) / 2;

/**
 * A group's bar as obstacles for a line anchored at some candidates: the
 * whole bar, or, where one of them is its member, the stretches of it
 * beyond SIZES.barFree, the gap and the bar's half width from that member,
 * so a line can leave the member it is anchored at across its own bar
 * (decision 4), and nowhere else
 */
function barStretches(bar: GroupBar, anchors: CellDigit[], layout: Layout): Obstacle[] {
  const r = barHalf(layout);
  const free = (SIZES.barFree + SIZES.gap) * layout.cell + r;
  const ab = sub(bar.b, bar.a);
  const l2 = ab.x * ab.x + ab.y * ab.y || 1;
  let pieces: [number, number][] = [[0, 1]];
  for (const cd of anchors) {
    if (!bar.members.some((m) => key(m) === key(cd))) continue;
    // the stretch within `free` of the member: |a + t (b - a) - m| < free
    const am = sub(bar.a, layout.centre(cd));
    const mid = (am.x * ab.x + am.y * ab.y) / l2;
    const disc = mid * mid - (am.x * am.x + am.y * am.y - free * free) / l2;
    if (disc <= 0) continue;
    const [t0, t1] = [-mid - Math.sqrt(disc), -mid + Math.sqrt(disc)];
    pieces = pieces.flatMap(([u, v]): [number, number][] => [
      [u, Math.min(v, t0)],
      [Math.max(u, t1), v]
    ]);
    pieces = pieces.filter(([u, v]) => v > u);
  }
  return pieces.map(([u, v]) => ({ p: add(bar.a, mul(ab, u)), q: add(bar.a, mul(ab, v)), r }));
}

/**
 * The bars of a hint's groups (docs/hint-drawing-sets.md, decision 2), each
 * on the side of its members that crosses the least, scored as the design
 * gives it: 1000 for each digit the board shows that the bar would cross
 * (a candidate that is not a member, unmarked), 100 for each other mark of
 * the hint it would touch (within its radius, the keyline and the bar's
 * half width), 100 for each bar placed before it that it would touch, 500
 * for each straight arrow of the hint it would cross away from the member
 * the arrow is anchored at, 10 for running in an edge band (above members
 * in the top row of their cells' places, below the bottom row, and the
 * outer columns likewise), 1 for each solved digit it passes behind (cut
 * out by the digits, as the arrows are). The least wins; of two alike,
 * below, or to the right. `marks` are the candidates the full view marks
 */
export function setShapes(step: Step, layout: Layout, marks: CellDigit[]): SetShapes {
  const sets = step.sets ?? [];
  if (!sets.some((set) => set.kind === 'group')) return { bars: [] };
  const c = layout.cell;
  const gap = SIZES.gap * c;
  const r = barHalf(layout);
  const marked = new Set(marks.map(key));
  // the hint's arrows, straight, from just outside their marks, with the candidates they are anchored at
  const arrows = (step.links ?? [])
    .filter((l) => !l.undirected && !insideOneCell(l))
    .map((l) => {
      const { fromCd, toCd, a, b } = straightEnds(l, layout);
      const u = unit(sub(b, a));
      return { anchors: [fromCd, toCd], tail: add(a, mul(u, reachAt(layout, fromCd, u) + gap)), tip: sub(b, mul(u, reachAt(layout, toCd, mul(u, -1)) + gap)) };
    });
  // whether the bar a-b, grown by its half width, meets a box
  const meets = (a: Point, b: Point, x0: number, x1: number, y0: number, y1: number) =>
    Math.min(a.x, b.x) - r < x1 && Math.max(a.x, b.x) + r > x0 && Math.min(a.y, b.y) - r < y1 && Math.max(a.y, b.y) + r > y0;
  const bars: GroupBar[] = [];
  sets.forEach((set, k) => {
    if (set.kind !== 'group') return;
    const members = [...set.members].sort((x, y) => x.cell - y.cell);
    const own = new Set(members.map(key));
    // a row's group has its bar above or below the members, a column's beside them
    const across = set.unit < 9;
    const ps = members.map((cd) => layout.centre(cd));
    // the members' place in their cells: the top, middle or bottom row of places (the left, middle or right column)
    const place = across ? Math.floor((members[0].digit - 1) / 3) : (members[0].digit - 1) % 3;
    const scored = [1, -1].map((side) => {
      const shift = across ? { x: 0, y: side * MARK.groupBar * c } : { x: side * MARK.groupBar * c, y: 0 };
      const bar: GroupBar = { set: k, members, a: add(ps[0], shift), b: add(ps[ps.length - 1], shift) };
      let score = (place === 0 && side === -1) || (place === 2 && side === 1) ? 10 : 0;
      for (let cell = 0; cell < 81; cell++) {
        const x0 = layout.bounds.x0 + (cell % 9) * c;
        const y0 = layout.bounds.y0 + Math.floor(cell / 9) * c;
        if (!meets(bar.a, bar.b, x0, x0 + c, y0, y0 + c)) continue;
        if (layout.solved?.(cell)) {
          if (meets(bar.a, bar.b, x0 + 0.34 * c, x0 + 0.66 * c, y0 + 0.29 * c, y0 + 0.71 * c)) score += 1;
          continue;
        }
        for (let digit = 1; digit <= 9; digit++) {
          const cd = { cell, digit };
          if (own.has(key(cd)) || marked.has(key(cd)) || !layout.shown?.(cd)) continue;
          const p = layout.centre(cd);
          if (meets(bar.a, bar.b, p.x - 0.064 * c, p.x + 0.064 * c, p.y - 0.096 * c, p.y + 0.07 * c)) score += 1000;
        }
      }
      for (const cd of marks) {
        if (own.has(key(cd))) continue;
        if (distToSegment(layout.centre(cd), bar.a, bar.b) < radius(layout, cd) + MARK.keylineSmall * c + r) score += 100;
      }
      for (const earlier of bars) if (segmentsApart(bar.a, bar.b, earlier.a, earlier.b) < 2 * r + 0.02 * c) score += 100;
      for (const { anchors, tail, tip } of arrows) {
        if (barStretches(bar, anchors, layout).some((o) => segmentsApart(tail, tip, o.p, o.q!) < r)) score += 500;
      }
      return { bar, score };
    });
    bars.push(scored[1].score < scored[0].score ? scored[1].bar : scored[0].bar);
  });
  return { bars };
}

/** what the bars ask of a line anchored at some candidates: to keep off every bar but its own near the member it leaves from or ends at */
const barObstacles = (sets: SetShapes | undefined, anchors: CellDigit[], layout: Layout): Obstacle[] =>
  (sets?.bars ?? []).flatMap((bar) => barStretches(bar, anchors, layout));

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

/** a colouring's weak tie: at most one of its two ends is true, and it claims nothing more */
const weakTie = (link: ChainLink) => !!link.undirected && !link.strong;
/** a colouring's tie: exactly one of its two ends is true */
const clusterTie = (link: ChainLink) => !!link.undirected && link.strong;

/**
 * Four corner brackets round a cell (docs/hint-drawing-colouring.md,
 * decision 9): a weak tie between two candidates of one cell, where a line
 * would be too short to see. Each is an L inset from the cell's corner,
 * its arms along the cell's sides, clear of the box lines, and clear of
 * every candidate's place in the cell at a small board's stroke and halo:
 * as long as that leaves them, up to their full length
 */
function bracketsOf(link: ChainLink, i: number, layout: Layout): ArrowShape {
  const cell = link.from.find((cd) => link.to.some((o) => o.cell === cd.cell))!.cell;
  const c = layout.cell;
  const x0 = layout.bounds.x0 + (cell % 9) * c;
  const y0 = layout.bounds.y0 + Math.floor(cell / 9) * c;
  const inset = SIZES.bracketInset * c;
  const clear = SIZES.bracketClear * c;
  const places = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => layout.centre({ cell, digit }));
  const corners = [
    { x: x0 + inset, y: y0 + inset },
    { x: x0 + c - inset, y: y0 + inset },
    { x: x0 + c - inset, y: y0 + c - inset },
    { x: x0 + inset, y: y0 + c - inset }
  ];
  // each corner's two arms run along the cell's sides, inwards, the two of
  // a corner as long as each other, shortened a step at a time until both
  // keep clear of every place
  const ls = corners.map((p) => {
    const sx = p.x < x0 + c / 2 ? 1 : -1;
    const sy = p.y < y0 + c / 2 ? 1 : -1;
    const clearOf = (arm: number) =>
      [{ x: p.x, y: p.y + sy * arm }, { x: p.x + sx * arm, y: p.y }].every((tip) => places.every((m) => toSegment(m, p, tip).dist >= clear));
    let arm = SIZES.bracketArm * c;
    while (arm > 0.04 * c && !clearOf(arm)) arm -= 0.005 * c;
    return [{ x: p.x, y: p.y + sy * arm }, p, { x: p.x + sx * arm, y: p.y }];
  });
  const d = ls.map(([a, p, b]) => `M ${f(a.x)} ${f(a.y)} L ${f(p.x)} ${f(p.y)} L ${f(b.x)} ${f(b.y)}`).join(' ');
  const trace = ls.flatMap(([a, p, b]) => [a, mul(add(a, p), 0.5), p, mul(add(p, b), 0.5), b]);
  return { kind: 'cell', link: i, cell, d, trace, corners };
}

/**
 * A link goes on from the one before: it leaves the node the other reached,
 * or, in a chain of sets, another digit of the set it reached (the set's
 * own link, which is not drawn). A tie neither goes on nor is gone on
 * from: a colouring's cluster has no reading order, and a witness arrow
 * that leaves a node a tie reached starts a branch of its own
 */
const goesOn = (links: ChainLink[], i: number) =>
  i > 0 &&
  !links[i - 1].undirected &&
  !links[i].undirected &&
  (sameNode(links[i - 1].to, links[i].from) || shareACell(links[i - 1].to, links[i].from));

/** the shortest distance from a point to the segment a-b, and where along it (0..1) */
function toSegment(p: Point, a: Point, b: Point): { dist: number; t: number } {
  const ab = sub(b, a);
  const l2 = ab.x * ab.x + ab.y * ab.y || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
  return { dist: len(sub(p, add(a, mul(ab, t)))), t };
}

/**
 * toSegment's distance, to the last bit, with no point made on the way: a
 * tie's bend search measures many shapes against many marks and lines
 */
function distToSegment(p: Point, a: Point, b: Point): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** a point of the quadratic curve a-c-b */
const quad = (a: Point, c: Point, b: Point, t: number): Point => ({
  x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x,
  y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y
});

/** a point of the cubic curve a-c-d-b */
const cubic = (a: Point, c: Point, d: Point, b: Point, t: number): Point => {
  const s = 1 - t;
  return {
    x: s * s * s * a.x + 3 * s * s * t * c.x + 3 * s * t * t * d.x + t * t * t * b.x,
    y: s * s * s * a.y + 3 * s * s * t * c.y + 3 * s * t * t * d.y + t * t * t * b.y
  };
};

/**
 * something an arrow must keep clear of: a mark, or another arrow's end, a
 * disc of radius `r` round `p`; or a stretch of a group's bar, from `p` to
 * `q`, `r` its half width
 */
interface Obstacle {
  p: Point;
  r: number;
  q?: Point;
}

/** whether a point lies inside a filled triangle: on the same side of all three edges */
function inTriangle(p: Point, head: Point[]): boolean {
  const side = (a: Point, b: Point) => Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const s = [side(head[0], head[1]), side(head[1], head[2]), side(head[2], head[0])];
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
}

/** the shortest distance from a point to a polyline and, when given, a filled triangle */
function toPath(p: Point, path: Point[], head: Point[] = []): number {
  let least = path.length === 1 ? len(sub(p, path[0])) : Infinity;
  for (let k = 0; k + 1 < path.length; k++) least = Math.min(least, distToSegment(p, path[k], path[k + 1]));
  if (head.length === 3) {
    for (let k = 0; k < 3; k++) least = Math.min(least, distToSegment(p, head[k], head[(k + 1) % 3]));
    if (inTriangle(p, head)) least = 0;
  }
  return least;
}

/** whether the segments a-b and p-q cross */
function segmentsCross(a: Point, b: Point, p: Point, q: Point): boolean {
  const side = (u: Point, v: Point, r: Point) => Math.sign((v.x - u.x) * (r.y - u.y) - (v.y - u.y) * (r.x - u.x));
  return side(a, b, p) * side(a, b, q) < 0 && side(p, q, a) * side(p, q, b) < 0;
}

/** the shortest distance between the segments a-b and p-q */
function segmentsApart(a: Point, b: Point, p: Point, q: Point): number {
  if (segmentsCross(a, b, p, q)) return 0;
  return Math.min(distToSegment(a, p, q), distToSegment(b, p, q), distToSegment(p, a, b), distToSegment(q, a, b));
}

/** the shortest distance from the segment p-q to a polyline and, when given, a filled triangle */
function segmentToPath(p: Point, q: Point, path: Point[], head: Point[] = []): number {
  let least = path.length === 1 ? distToSegment(path[0], p, q) : Infinity;
  for (let k = 0; k + 1 < path.length; k++) least = Math.min(least, segmentsApart(path[k], path[k + 1], p, q));
  if (head.length === 3) {
    for (let k = 0; k < 3; k++) least = Math.min(least, segmentsApart(head[k], head[(k + 1) % 3], p, q));
    if (inTriangle(p, head) || inTriangle(q, head)) least = 0;
  }
  return least;
}

/** how far an obstacle's middle (a point, or a bar's centre line) lies from a polyline and a filled triangle */
const apartFrom = (o: Obstacle, path: Point[], head: Point[] = []) => (o.q ? segmentToPath(o.p, o.q, path, head) : toPath(o.p, path, head));

/**
 * How clear a line keeps of the obstacles: the least room left between the
 * line (its segments, not only its points) and any obstacle's rim, negative
 * when one is crossed; and minus a cell for a point too near the board's
 * edge for its halo
 */
function clearanceOf(points: Point[], obstacles: Obstacle[], layout: Layout, margin: number, head: Point[] = []): number {
  let least = Infinity;
  const { x0, y0, x1, y1 } = layout.bounds;
  for (const p of [...points, ...head]) {
    if (p.x < x0 + margin || p.x > x1 - margin || p.y < y0 + margin || p.y > y1 - margin) least = Math.min(least, -layout.cell);
  }
  for (const o of obstacles) least = Math.min(least, apartFrom(o, points, head) - o.r);
  return least;
}

/** the head of an arrow whose last stretch runs along `dir` to `tip` */
function headAt(tip: Point, dir: Point, layout: Layout): Point[] {
  const base = sub(tip, mul(dir, SIZES.headLength * layout.cell));
  const w = (SIZES.headWidth * layout.cell) / 2;
  return [tip, add(base, mul(perp(dir), w)), sub(base, mul(perp(dir), w))];
}

/**
 * How far a line runs along a grid line: the stretches within
 * SIZES.gridLine of one and nearly parallel to it, a box line's in full and
 * a cell line's at half, so a bend keeps off the box lines first (`lined`);
 * and along a box line or the board's edge alone (`boxed`). `at` gives the
 * line's points, from 0 to 1
 */
function alongGridLines(at: (s: number) => Point, layout: Layout): { lined: number; boxed: number } {
  const c = layout.cell;
  const near = SIZES.gridLine * c;
  const { x0, y0 } = layout.bounds;
  const n = 60;
  let [lined, boxed] = [0, 0];
  let prev = at(0);
  for (let k = 1; k <= n; k++) {
    const p = at(k / n);
    const m = mul(add(prev, p), 0.5);
    const [dx, dy] = [Math.abs(p.x - prev.x), Math.abs(p.y - prev.y)];
    // a stretch within about 11 degrees of upright lies along a column's
    // line, one within as much of level along a row's
    const [off, steep] = dy > 5 * dx ? [m.x - x0, true] : dx > 5 * dy ? [m.y - y0, true] : [0, false];
    const line = Math.round(off / c);
    if (steep && Math.abs(off - line * c) < near) {
      lined += (line % 3 === 0 ? 1 : 0.5) * Math.hypot(dx, dy);
      if (line % 3 === 0) boxed += Math.hypot(dx, dy);
    }
    prev = p;
  }
  return { lined, boxed };
}

/**
 * Where two ties leave the candidate they share, the least angle a bend
 * keeps off the other's line: from about 0.2 of a cell from the
 * candidate's centre on, the two are then further apart than their halos
 * (two straight ties leave one candidate at 26.6 degrees at the least,
 * across a box)
 */
const FORK_ANGLE = Math.PI / 6;
/** how far from the candidate's centre two ties that leave it may meet, a fraction of a cell: its mark, a gap and a little more */
const FORK_FREE = 0.2;
/**
 * a bend that crosses a tie it shares an end with, beyond FORK_FREE,
 * counts as missing FORK_ANGLE by this much (in radians, about 11
 * degrees): a loop is worse than a narrow fork and better than a fused one
 */
const FORK_CROSSED = 0.2;
/**
 * a fork missed by less than this (in radians, 10 degrees), with no
 * crossing, still reads as two lines leaving apart: running along a box
 * line or the board's edge, or beside another tie, is worse
 */
const FORK_SLIGHT = Math.PI / 18;
/**
 * a tie bent off each end that runs nearer than this to another tie of its
 * frame (a fraction of a cell), and nearly along it, runs beside it as a
 * rail: the two read as a braided double line, though their halos never
 * touch
 */
const RAIL = 0.25;
/** how far from the candidate two weak ties into it may cross, a fraction of a cell */
const WEAK_FREE = 0.25;

/** the smallest box round a polyline's points */
function boxOf(ps: Point[]): { x0: number; y0: number; x1: number; y1: number } {
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const p of ps) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x0, y0, x1, y1 };
}

/**
 * The arrows of a hint. `obstacles` are every mark the hint draws (its
 * nodes, removals, placements and pattern candidates); an arrow is never
 * bent for a candidate the hint does not mark. The arrows also keep their
 * arcs and heads clear of each other's ends. A colouring's tie keeps off
 * only the marks of the frame that draws it, its cluster's and those of
 * the clusters before it: the candidates the ties join, cluster by cluster
 * in the order their ties come (docs/hint-drawing-colouring.md); and the
 * candidates of its digit the board shows
 */
export function arrowShapes(links: ChainLink[], layout: Layout, obstacles: CellDigit[], sets?: SetShapes): ArrowShape[] {
  const c = layout.cell;
  const gap = SIZES.gap * c;
  const headLength = SIZES.headLength * c;
  const need = SIZES.clearance * c;
  const margin = ((SIZES.stroke + SIZES.halo) * c) / 2;
  const marks = obstacles.map((cd) => ({ cd, p: layout.centre(cd), r: radius(layout, cd) }));
  const centre = { x: (layout.bounds.x0 + layout.bounds.x1) / 2, y: (layout.bounds.y0 + layout.bounds.y1) / 2 };
  const marked = new Set(obstacles.map(key));
  // the other digits a target's cell shows, which its head keeps off where
  // it can: every digit is cut out of the arrows (G11), and a head cut away
  // would seem to end on the wrong digit
  const digitsRound = (cd: CellDigit): Obstacle[] =>
    [1, 2, 3, 4, 5, 6, 7, 8, 9]
      .filter((d) => d !== cd.digit && !marked.has(`${cd.cell}:${d}`) && (layout.shown?.({ cell: cd.cell, digit: d }) ?? false))
      .map((d) => ({ p: layout.centre({ cell: cd.cell, digit: d }), r: glyphOf(layout, cd.cell) }));
  // the candidates of a weak tie's digit the board shows and the hint does
  // not mark, to be kept off as if marked, along the whole line drawn
  const sameDigit = (l: ChainLink, own: Set<string>): Obstacle[] => {
    const digits = new Set([...l.from, ...l.to].map((cd) => cd.digit));
    if (digits.size !== 1 || !layout.shown) return [];
    const digit = [...digits][0];
    const out: Obstacle[] = [];
    for (let cell = 0; cell < 81; cell++) {
      const cd = { cell, digit };
      if (own.has(key(cd)) || marked.has(key(cd)) || !layout.shown(cd)) continue;
      out.push({ p: layout.centre(cd), r: layout.r });
    }
    return out;
  };
  // a weak tie has no head to say which candidate of a cell it ends at, so
  // each of its ends keeps further from the other marks of its cell than
  // from its own, by the clearance, as a head keeps off the digits round its
  // target (G10): an end in the gap between two rings would seem to go into
  // the other. How much room an end at `p` by its candidate `cd` leaves
  // (none to keep: all clear)
  const endRoom = (cd: CellDigit, p: Point) =>
    Math.min(...marks.filter((m) => m.cd.cell === cd.cell && key(m.cd) !== key(cd)).map((m) => len(sub(p, m.p)) - m.r - gap - need));

  // a colouring's clusters, as its ties join them, and the first tie of
  // each: a tie is drawn in its cluster's frame, with the candidates of its
  // cluster and of the clusters whose ties come before
  const root = new Map<string, string>();
  const rootOf = (k: string): string => {
    while (root.get(k) !== k) k = root.get(k)!;
    return k;
  };
  const tied = new Map<string, CellDigit>();
  for (const l of links) {
    if (!clusterTie(l)) continue;
    for (const cd of [...l.from, ...l.to]) {
      if (!root.has(key(cd))) root.set(key(cd), key(cd));
      tied.set(key(cd), cd);
      const [ra, rb] = [rootOf(key(cd)), rootOf(key(l.from[0]))];
      if (ra !== rb) root.set(ra, rb);
    }
  }
  const firstTie = new Map<string, number>();
  links.forEach((l, i) => {
    if (clusterTie(l) && !firstTie.has(rootOf(key(l.from[0])))) firstTie.set(rootOf(key(l.from[0])), i);
  });
  const clusterOf = (l: ChainLink) => firstTie.get(rootOf(key(l.from[0])))!;
  /** the candidates the frame of tie `l` draws, worked out once a frame */
  const frames = new Map<number, CellDigit[]>();
  const frameOf = (l: ChainLink) => {
    const k = clusterOf(l);
    if (!frames.has(k)) frames.set(k, [...tied].filter(([t]) => firstTie.get(rootOf(t))! <= k).map(([, cd]) => cd));
    return frames.get(k)!;
  };
  // what a tie keeps off: the other marks its frame draws, and the other
  // candidates of its digit the board shows, which a line of that digit
  // would seem to join as well, whether the hint marks them or not (a
  // removal is a candidate of the digit, though the cluster's frame does
  // not mark it); a Remote Pair's ties join cells that see each other, so
  // another of the digit can lie on the line, and a bend can pass one
  const showing = new Map<number, CellDigit[]>();
  const tieObstacles = (l: ChainLink, own: Set<string>): Obstacle[] => {
    const frame = frameOf(l).filter((cd) => !own.has(key(cd)));
    const out: Obstacle[] = frame.map((cd) => ({ p: layout.centre(cd), r: radius(layout, cd) }));
    const digits = new Set([...l.from, ...l.to].map((cd) => cd.digit));
    const shown = layout.shown;
    if (digits.size !== 1 || !shown) return out;
    const digit = [...digits][0];
    if (!showing.has(digit)) showing.set(digit, Array.from({ length: 81 }, (_, cell) => ({ cell, digit })).filter((cd) => shown(cd)));
    const drawn = new Set(frame.map(key));
    for (const cd of showing.get(digit)!) if (!own.has(key(cd)) && !drawn.has(key(cd))) out.push({ p: layout.centre(cd), r: layout.r });
    return out;
  };

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
  const ends = links.map((l) => straightEnds(l, layout));
  // the other arrows' ends, straight, just outside their marks: an arc or a
  // head keeps clear of them too
  const arrowEnds = links.flatMap((l, i): (Obstacle & { link: number })[] => {
    if (insideOneCell(l) || (l.undirected && !weakTie(l))) return [];
    const { fromCd, toCd, a, b } = ends[i];
    const u = unit(sub(b, a));
    const w = (SIZES.headWidth * c) / 2;
    return [
      { link: i, p: add(a, mul(u, reachAt(layout, fromCd, u) + gap)), r: w },
      { link: i, p: sub(b, mul(u, reachAt(layout, toCd, mul(u, -1)) + gap + headLength / 2)), r: w }
    ];
  });

  // the line each link is drawn as, once chosen (in link order), and its
  // straight line until then: an arrow keeps from running along another
  const chosen: (Point[] | null)[] = links.map(() => null);
  // and how clear of the marks it keeps, and its ends' room, once chosen
  const kept: { room: number; headRoom: number }[] = links.map(() => ({ room: Infinity, headRoom: Infinity }));
  const lineOf = (j: number): Point[] | null => {
    if (chosen[j]) return chosen[j];
    if (insideOneCell(links[j])) return null;
    const { fromCd, toCd, a, b } = ends[j];
    const u = unit(sub(b, a));
    return len(sub(b, a)) <= reachAt(layout, fromCd, u) + reachAt(layout, toCd, mul(u, -1)) + 2 * gap ? null : [a, b];
  };
  // where the other weak ties end at another candidate of a cell this one
  // joins, as drawn once chosen, straight until then, just outside their
  // marks: a weak tie keeps a mark's radius and a gap off them, so two
  // weak ties into one cell come in apart and never cross under its marks
  const besideEnds = (i: number): Obstacle[] => {
    const mine = [ends[i].fromCd, ends[i].toCd];
    return links.flatMap((o, j): Obstacle[] => {
      if (j === i || !weakTie(o) || insideOneCell(o) || pairKey(o) === pairKey(links[i])) return [];
      const line = lineOf(j);
      if (!line) return [];
      const { fromCd, toCd, a, b } = ends[j];
      const u = unit(sub(b, a));
      const at: [CellDigit, Point][] = chosen[j]
        ? [
            [fromCd, line[0]],
            [toCd, line[line.length - 1]]
          ]
        : [
            [fromCd, add(a, mul(u, radius(layout, fromCd) + gap))],
            [toCd, sub(b, mul(u, radius(layout, toCd) + gap))]
          ];
      return at
        .filter(([cd]) => mine.some((m) => m.cell === cd.cell) && !mine.some((m) => key(m) === key(cd)))
        .map(([cd, p]) => ({ p, r: radius(layout, cd) + gap }));
    });
  };

  const draw = (l: ChainLink, i: number, apart = false): ArrowShape => {
    if (insideOneCell(l)) return weakTie(l) ? bracketsOf(l, i, layout) : { kind: 'none', link: i };
    const { fromCd, toCd, a, b } = ends[i];
    const u = unit(sub(b, a));
    // each end just outside its mark, a gap off it, straight towards the
    // other end (a square reaches further at its corners than along its axes)
    const ra = reachAt(layout, fromCd, u) + gap;
    const rb = reachAt(layout, toCd, mul(u, -1)) + gap;
    // a degenerate link, its ends on one candidate or touching: nothing to draw
    if (len(sub(b, a)) <= ra + rb) return { kind: 'none', link: i };
    // the two nodes of the pair, spread sideways when more than one link joins them
    const group = pairs.get(pairKey(l)) ?? [i];
    const spread = group.length > 1 ? (group.indexOf(i) - (group.length - 1) / 2) * SIZES.pair * c : 0;
    // the sideways shift is measured in one fixed direction for the pair, so
    // links running opposite ways still end up apart
    const along = pairKey(l).startsWith(l.from.map(key).sort().join('+')) ? u : mul(u, -1);
    const shift = mul(perp(along), spread);

    const own = new Set([...l.from, ...l.to].map(key));
    const tie = clusterTie(l);
    // a colouring's line keeps off the board's edge, a box line, as it
    // keeps from running along one: nearer, its halo would touch the border
    // and the two would merge
    const inside = l.undirected ? SIZES.gridLine * c : margin;
    // a group's bar is an obstacle for every line but beside the member it
    // is anchored at (docs/hint-drawing-sets.md, decision 4); a colouring
    // has no groups
    const bars = barObstacles(sets, [fromCd, toCd], layout);
    // a tie: straight from end to end, unless another mark its frame draws,
    // or another candidate of its digit the board shows, lies within its
    // radius and a gap of the line, which it would seem to join; then it
    // bends round those, and nothing else, as an arrow does (G10), with no
    // head
    const seen: Obstacle[] = tie ? [...tieObstacles(l, own), ...bars] : [];
    if (tie) {
      const p0 = add(add(a, mul(u, ra)), shift);
      const p1 = add(sub(b, mul(u, rb)), shift);
      if (seen.every((o) => (o.q ? apartFrom(o, [p0, p1]) : toSegment(o.p, p0, p1).dist) >= o.r + gap)) {
        chosen[i] = [p0, p1];
        return { kind: 'tie', link: i, d: `M ${f(p0.x)} ${f(p0.y)} L ${f(p1.x)} ${f(p1.y)}`, trace: [p0, p1] };
      }
    }
    const round = tie ? [] : digitsRound(toCd);
    const others: Obstacle[] = tie
      ? seen
      : [
          ...marks.filter((m) => !own.has(key(m.cd))),
          // other arrows' ends, but not those that meet this one at its own
          // marks, where arrows into and out of one node always gather
          ...arrowEnds.filter((e) => e.link !== i && len(sub(e.p, a)) > ra + headLength + 1 && len(sub(e.p, b)) > rb + headLength + 1),
          // a weak tie also keeps off the other candidates of its digit the
          // board shows, so it never seems to run through a third one (a
          // wrap's house always has another place for its digit), and off
          // the ends of the other weak ties into its cells
          ...(weakTie(l) ? [...sameDigit(l, own), ...besideEnds(i)] : []),
          ...bars
        ];

    // the other links' lines, but those joining the same two nodes, which are
    // drawn side by side on purpose, and those never drawn with this one: a
    // tie is drawn with its own cluster's ties only, a weak tie never with a tie
    const lines = links.flatMap((o, j) => {
      if (j === i || group.includes(j)) return [];
      if (tie ? !clusterTie(o) || clusterOf(o) !== clusterOf(l) : weakTie(l) && clusterTie(o)) return [];
      return [lineOf(j)].filter((x): x is Point[] => !!x);
    });
    const lineBoxes = tie ? lines.map((line) => boxOf(line)) : [];
    const near = (SIZES.stroke + SIZES.halo) * c + 1;
    // how far a shaft runs along another line, away from its own ends, where
    // arrows into and out of a node always gather
    const runOf = (shaft: Point[], lines: Point[][]) => {
      let run = 0;
      for (let k = 0; k + 1 < shaft.length; k++) {
        const m = mul(add(shaft[k], shaft[k + 1]), 0.5);
        if (len(sub(m, a)) < 0.45 * c || len(sub(m, b)) < 0.45 * c) continue;
        if (lines.some((line) => toPath(m, line) < near)) run += len(sub(shaft[k + 1], shaft[k]));
      }
      return run;
    };
    // a tie's bend: the other ties of its frame that end at one of its own
    // two candidates, at which end, the way each leaves it and its line. Two
    // lines that leave one candidate the same way look like one line that
    // joins their far ends, two candidates of one shade, so a bend leaves
    // its ends at a clear angle to them; and it does not cross one of them
    // further on, where the two would close a loop and each seem to go on
    // along the other. A weak tie drawn again to keep `apart`: the other
    // weak ties into one of its own two candidates, all drawn in the full
    // view, which it does not cross away from that candidate, where the two
    // would swap sides just before it
    const weak = weakTie(l);
    const forks =
      tie || (weak && apart)
        ? links.flatMap((o, j) => {
            if (j === i || (tie ? !clusterTie(o) || clusterOf(o) !== clusterOf(l) : !weakTie(o) || group.includes(j))) return [];
            const line = lineOf(j);
            if (!line) return [];
            return [ends[i].fromCd, ends[i].toCd].flatMap((cd, end) => {
              const at = layout.centre(cd);
              if (key(ends[j].fromCd) === key(cd)) return [{ end, at, line, lb: boxOf(line), dir: unit(sub(line[1], line[0])) }];
              if (key(ends[j].toCd) === key(cd)) return [{ end, at, line, lb: boxOf(line), dir: unit(sub(line[line.length - 2], line[line.length - 1])) }];
              return [];
            });
          })
        : [];
    // the least angle between the way a shaft leaves an end and the way a
    // tie it shares that end with leaves it, and whether it crosses such a
    // tie beyond that end's mark (a weak tie's: a quarter of a cell from it)
    const forkOf = (shaft: Point[], box: ReturnType<typeof boxOf>) => {
      const n = shaft.length;
      const out = [unit(sub(shaft[1], shaft[0])), unit(sub(shaft[n - 2], shaft[n - 1]))];
      let angle = Math.PI;
      let crossed = false;
      for (const { end, at, line, dir, lb } of forks) {
        angle = Math.min(angle, Math.acos(Math.max(-1, Math.min(1, out[end].x * dir.x + out[end].y * dir.y))));
        crossed ||= crossesBeyond(shaft, box, line, lb, at, (tie ? FORK_FREE : WEAK_FREE) * c);
      }
      return { angle, crossed };
    };
    // a tie's bend: how far it runs `beside` another tie of its frame,
    // nearer than RAIL and within 30 degrees of along it, away from its own
    // ends, and a cell more for each tie it crosses twice, a loop round it
    // or, near it, a braided double line between the crossings
    const railOf = (shaft: Point[], box: ReturnType<typeof boxOf>, beside: boolean) => {
      const reach = RAIL * c;
      let rail = 0;
      lines.forEach((line, k) => {
        const lb = lineBoxes[k];
        if (Math.max(lb.x0 - box.x1, box.x0 - lb.x1, lb.y0 - box.y1, box.y0 - lb.y1) > reach) return;
        for (let q = 0; beside && q + 1 < shaft.length; q++) {
          const m = mul(add(shaft[q], shaft[q + 1]), 0.5);
          if (len(sub(m, a)) < 0.45 * c || len(sub(m, b)) < 0.45 * c) continue;
          const step = sub(shaft[q + 1], shaft[q]);
          let [least, at] = [Infinity, 0];
          for (let p = 0; p + 1 < line.length; p++) {
            const d = distToSegment(m, line[p], line[p + 1]);
            if (d < least) [least, at] = [d, p];
          }
          const other = unit(sub(line[at + 1], line[at]));
          if (least < reach && Math.abs(step.x * other.x + step.y * other.y) >= Math.cos(Math.PI / 6) * len(step)) rail += len(step);
        }
        if (crossings(shaft, line) >= 2) rail += c;
      });
      return rail;
    };

    // a candidate drawing: straight (no control point), one arc (one), or,
    // where marks box in both ends, an arc that leaves and arrives steeply,
    // each end on its own (two); scored by how clear it keeps of the hint's
    // other marks and the other arrows' ends, along its whole length and its
    // head (G9, G10), and a colouring's line by how little it runs along a
    // grid line, where its dashes would merge with the line
    const shape = (controls: Point[]) => {
      const first = controls[0];
      const last = controls[controls.length - 1];
      // a bent line leaves and arrives along its first and last bends, where its mark reaches that way
      const out = first && unit(sub(first, a));
      const into = last && unit(sub(last, b));
      const tail = out ? add(a, mul(out, reachAt(layout, fromCd, out) + gap)) : add(add(a, mul(u, ra)), shift);
      const tip = into ? add(b, mul(into, reachAt(layout, toCd, into) + gap)) : add(sub(b, mul(u, rb)), shift);
      const dir = unit(sub(tip, last ?? tail));
      const hasHead = !l.undirected && len(sub(tip, tail)) > headLength * 1.4;
      const head = hasHead ? headAt(tip, dir, layout) : [];
      const at = (s: number) =>
        controls.length === 2
          ? cubic(tail, controls[0], controls[1], tip, s)
          : controls.length === 1
            ? quad(tail, controls[0], tip, s)
            : add(tail, mul(sub(tip, tail), s));
      const shaft = Array.from({ length: 21 }, (_, k) => at(k / 20));
      // the head's room from the digits round its target, a weak tie's ends'
      // from the other marks of their cells (none: all clear)
      const headRoom = head.length ? Math.min(...round.map((o) => toPath(o.p, [], head) - o.r)) : weak ? Math.min(endRoom(fromCd, tail), endRoom(toCd, tip)) : Infinity;
      if (!tie) {
        const trace = [...shaft, ...head];
        const { lined, boxed } = l.undirected && controls.length ? alongGridLines(at, layout) : { lined: 0, boxed: 0 };
        const fork = forks.length && forkOf(shaft, boxOf(shaft)).crossed ? FORK_CROSSED * c : 0;
        return { tail, tip, dir, head, trace, shaft, controls, mid: at(0.5), room: clearanceOf(shaft, others, layout, inside, head), run: runOf(shaft, lines), headRoom, lined, boxed, fork, rail: 0 };
      }
      // a tie tries many bends among many marks and lines, and only those
      // near a bend can tell it from another: its room is never told apart
      // beyond `need` (better, ok), and a mark or a line farther than that
      // from its box leaves the room and the run as they are; the run, the
      // rail and the grid lines are worked out only when a choice comes to them
      const box = boxOf(shaft);
      const reach = (o: Obstacle) => {
        if (o.q) return true;
        const dx = Math.max(box.x0 - o.p.x, 0, o.p.x - box.x1);
        const dy = Math.max(box.y0 - o.p.y, 0, o.p.y - box.y1);
        return dx * dx + dy * dy <= (o.r + need + 1) * (o.r + need + 1);
      };
      const room = Math.min(clearanceOf(shaft, others.filter(reach), layout, inside), need);
      let fork: number | undefined;
      let run: number | undefined;
      let rail: number | undefined;
      let grid: { lined: number; boxed: number } | undefined;
      return {
        tail,
        tip,
        dir,
        head,
        trace: shaft,
        shaft,
        controls,
        mid: at(0.5),
        room,
        get run() {
          return (run ??= runOf(
            shaft,
            lines.filter((_, k) => {
              const lb = lineBoxes[k];
              return Math.max(lb.x0 - box.x1, box.x0 - lb.x1, lb.y0 - box.y1, box.y0 - lb.y1) <= near + 1;
            })
          ));
        },
        headRoom,
        get lined() {
          return (grid ??= controls.length ? alongGridLines(at, layout) : { lined: 0, boxed: 0 }).lined;
        },
        get boxed() {
          return (grid ??= controls.length ? alongGridLines(at, layout) : { lined: 0, boxed: 0 }).boxed;
        },
        // how far it misses a clear angle off a tie it shares an end with, as
        // a length a cell from the end, and FORK_CROSSED more where it
        // crosses one
        get fork() {
          if (fork === undefined) {
            const { angle, crossed } = forkOf(shaft, box);
            fork = Math.max(0, FORK_ANGLE - angle) * c + (crossed ? FORK_CROSSED * c : 0);
          }
          return fork;
        },
        // how far a bend off each end runs beside another tie of its frame
        // (an arc that does so runs there along the bulge the marks need,
        // and its run counts), and a cell for each tie it crosses twice
        get rail() {
          return (rail ??= controls.length ? railOf(shaft, box, controls.length === 2) : 0);
        }
      };
    };
    type Shape = ReturnType<typeof shape>;
    // a drawing that keeps clear of the marks, runs along no other arrow,
    // nor along a grid line, and lands its head off the target cell's other
    // digits; failing that, in that order: a head on a digit is painted
    // back over the cut (G11), an arrow lost in another is not. A tie's
    // bend also leaves its ends apart from the ties it shares them with,
    // which comes after the marks and before the other lines; a slight miss
    // with no crossing is better than running beside another tie or along
    // a box line or the board's edge. It then keeps from running beside
    // another tie of its frame, nearer than its halo or not, and from
    // crossing one twice. A weak tie drawn again to keep apart crosses no
    // other into its candidates, after the marks
    const lining = 0.1 * c;
    const slight = FORK_SLIGHT * c;
    const ok = (s: Shape) => s.room >= need && s.fork === 0 && s.rail <= 0.3 * c && s.run <= 0.3 * c && s.lined <= lining && s.headRoom >= 0;
    const better = (x: Shape, y: Shape) => {
      const [rx, ry] = [Math.min(x.room, need), Math.min(y.room, need)];
      if (Math.abs(rx - ry) > 0.01) return rx > ry;
      if (Math.abs(x.fork - y.fork) > 1) {
        if (x.fork <= slight && y.fork <= slight) {
          const [wx, wy] = [x, y].map((s) => Math.max(s.rail - 0.3 * c, 0) + Math.max(s.boxed - lining, 0));
          if (Math.abs(wx - wy) > 1) return wx < wy;
        }
        return x.fork < y.fork;
      }
      const [ax, ay] = [Math.max(x.rail, 0.3 * c), Math.max(y.rail, 0.3 * c)];
      if (Math.abs(ax - ay) > 1) return ax < ay;
      const [ux, uy] = [Math.max(x.run, 0.3 * c), Math.max(y.run, 0.3 * c)];
      if (Math.abs(ux - uy) > 1) return ux < uy;
      const [gx, gy] = [Math.max(x.lined, lining), Math.max(y.lined, lining)];
      if (Math.abs(gx - gy) > 1) return gx < gy;
      return Math.min(x.headRoom, 0) > Math.min(y.headRoom, 0) + 0.01;
    };

    // between two equally good drawings, the one bending towards the board's middle
    const pickOf = (p: Shape, q: Shape) =>
      better(p, q) ? p : better(q, p) ? q : len(sub(p.controls[0], centre)) <= len(sub(q.controls[0], centre)) ? p : q;

    let best = shape([]);
    // a weak tie boxed in at an end, by marks beside its candidate there,
    // or drawn again to keep apart from another weak tie into it: it comes
    // into each end from a side where the end is clearly its candidate's
    // (endRoom), a control point along that way off each end, as near or
    // far as the marks between need; the gentlest that does. Kept apart, it
    // tries these first, so it turns from its line no more than it must
    const steer = () => {
      const span = len(sub(b, a));
      const ways = (from: Point, cd: CellDigit, r: number, along: Point) =>
        TURNS.flatMap((t) => {
          const w = rotate(along, t);
          return endRoom(cd, add(from, mul(w, r))) >= 0 ? [{ w, t: Math.abs(t) }] : [];
        });
      const into = ways(b, toCd, rb, mul(u, -1));
      const tries = ways(a, fromCd, ra, u)
        .flatMap((p) => into.map((q) => ({ p, q })))
        .sort((x, y) => x.p.t + x.q.t - (y.p.t + y.q.t));
      for (const { p, q } of tries)
        // (along its line at both ends, the reach makes no odds: one straight line)
        for (const ka of p.t || q.t ? REACH : REACH.slice(0, 1))
          for (const kb of p.t || q.t ? REACH : REACH.slice(0, 1)) {
            const s = shape([add(add(a, mul(p.w, ka * span)), shift), add(add(b, mul(q.w, kb * span)), shift)]);
            if (better(s, best)) best = s;
            if (ok(best)) return;
          }
    };
    if (weak && apart && !ok(best)) steer();
    if (!ok(best)) {
      // one gentle arc, the smallest that does, on the side with more room
      // (the board's middle on a tie, so the choice never rests on
      // rounding); turning midway first, then nearer either end, which lets
      // an arrow come in steeply past a mark or a digit beside its target,
      // or leave steeply past one beside its start; if none does, the
      // clearest drawing of all
      for (const bulge of SIZES.bulges) {
        for (const at of [0.5, 0.78, 0.22, 0.9, 0.1, 0.65, 0.35, 1, 0]) {
          const base = add(a, mul(sub(b, a), at));
          const [p, q] = [1, -1].map((side) => shape([add(add(base, mul(perp(u), side * bulge * c * 2)), shift)]));
          const pick = pickOf(p, q);
          if (better(pick, best)) best = pick;
          if (ok(best)) break;
        }
        if (ok(best)) break;
      }
    }
    // what a bend off each end can mend: the marks, and a tie's fork, its
    // run along another tie and its loop round one, a weak tie's crossing;
    // not the grid lines alone, which a bend off each end escapes only to
    // run beside the ties it then has to pass
    const mend = (s: Shape) => s.room < need || s.fork > 0 || (tie && (s.rail > 0.3 * c || s.run > 0.3 * c));
    if (mend(best)) {
      // marks beside both ends on the line: one arc cannot leave steeply and
      // arrive steeply too, so two control points, one off each end, on one
      // side, leaning in, square or out; the smallest that does. A tie
      // tries them too when no arc leaves its ends apart from the other
      // ties there, or keeps off their lines; a weak tie when no arc keeps
      // from crossing another into its candidate
      for (const k of [0.4, 0.6, 0.8, 1.1, 1.5, 2]) {
        for (const lean of [0, 0.35, -0.35]) {
          const [p, q] = [1, -1].map((side) => {
            const off = mul(perp(u), side * k * c);
            return shape([add(add(add(a, off), mul(u, lean * k * c)), shift), add(add(sub(b, mul(u, lean * k * c)), off), shift)]);
          });
          const pick = pickOf(p, q);
          if (better(pick, best)) best = pick;
          if (ok(best)) break;
        }
        if (ok(best)) break;
      }
    }
    if (tie && mend(best)) {
      // a tie whose ends each have ties beside its line, on either side: it
      // leaves one end to one side and comes into the other from the other,
      // apart from them both, a control point off each end on either side;
      // the smallest that does
      for (const k of [0.4, 0.6, 0.8, 1.1, 1.5]) {
        for (const lean of [0, 0.35, -0.35]) {
          const [p, q] = [1, -1].map((side) => {
            const off = mul(perp(u), side * k * c);
            return shape([add(add(add(a, off), mul(u, lean * k * c)), shift), add(sub(sub(b, mul(u, lean * k * c)), off), shift)]);
          });
          const pick = pickOf(p, q);
          if (better(pick, best)) best = pick;
          if (ok(best)) break;
        }
        if (ok(best)) break;
      }
    }

    if (weak && !apart && (best.room < need || best.headRoom < 0)) steer();

    const { tail, tip, dir, head, trace, controls, mid } = best;
    chosen[i] = best.shaft;
    kept[i] = { room: best.room, headRoom: best.headRoom };
    // the shaft runs a little under the head so no seam shows between them
    const end = head.length ? sub(tip, mul(dir, headLength * 0.75)) : tip;
    const pt = (q: Point) => `${f(q.x)} ${f(q.y)}`;
    const d =
      controls.length === 2
        ? `M ${pt(tail)} C ${pt(controls[0])} ${pt(controls[1])} ${pt(end)}`
        : controls.length === 1
          ? `M ${pt(tail)} Q ${pt(controls[0])} ${pt(end)}`
          : `M ${pt(tail)} L ${pt(end)}`;
    if (tie) return { kind: 'tie', link: i, d, trace: best.shaft };
    return { kind: 'arrow', link: i, d, head, strong: l.strong, tail, mid, trace, ...(weak ? { undirected: true as const } : {}) };
  };

  const shapes = links.map((l, i) => draw(l, i));
  // two weak ties into one candidate that cross away from it, where they
  // would swap sides just before it: the earlier is drawn again knowing
  // the later, kept apart from it, or else the later knowing the earlier.
  // The new drawing is kept only where it crosses no weak tie into its
  // candidates and keeps as clear of the marks, its ends as clearly their
  // candidates', as the one it replaces
  const crosses = (i: number, j: number) => {
    if (j === i || !weakTie(links[i]) || !weakTie(links[j]) || pairKey(links[j]) === pairKey(links[i]) || !chosen[i] || !chosen[j]) return false;
    const at = [ends[i].fromCd, ends[i].toCd].find((cd) => key(cd) === key(ends[j].fromCd) || key(cd) === key(ends[j].toCd));
    return !!at && crossesBeyond(chosen[i]!, boxOf(chosen[i]!), chosen[j]!, boxOf(chosen[j]!), layout.centre(at), WEAK_FREE * c);
  };
  const crossing = (i: number) => links.some((_, j) => crosses(i, j));
  const redraw = (i: number) => {
    const [was, then] = [chosen[i], kept[i]];
    const again = draw(links[i], i, true);
    const now = kept[i];
    if (!crossing(i) && now.room >= Math.min(then.room, need) - 0.01 && now.headRoom >= Math.min(then.headRoom, 0) - 0.01) {
      shapes[i] = again;
      return true;
    }
    chosen[i] = was;
    kept[i] = then;
    return false;
  };
  links.forEach((_, i) => {
    for (let j = i + 1; j < links.length; j++) if (crosses(i, j) && !redraw(i)) redraw(j);
  });
  return shapes;
}

/** the turns tried off a boxed-in weak tie's ends, in radians (0, 23, 46 and 69 degrees), and how far its control points reach, fractions of the line */
const TURNS = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2];
const REACH = [0.15, 0.3, 0.5];
/** a direction turned by `t` radians */
const rotate = (v: Point, t: number): Point => ({ x: v.x * Math.cos(t) - v.y * Math.sin(t), y: v.x * Math.sin(t) + v.y * Math.cos(t) });

/** how many times two polylines cross */
function crossings(p: Point[], q: Point[]): number {
  const side = (a: Point, b: Point, r: Point) => Math.sign((b.x - a.x) * (r.y - a.y) - (b.y - a.y) * (r.x - a.x));
  let n = 0;
  for (let k = 1; k < p.length; k++)
    for (let m = 1; m < q.length; m++) if (side(p[k - 1], p[k], q[m - 1]) * side(p[k - 1], p[k], q[m]) < 0 && side(q[m - 1], q[m], p[k - 1]) * side(q[m - 1], q[m], p[k]) < 0) n++;
  return n;
}

/** whether a polyline crosses another (each with the box round it) further than `free` from `at` along the first */
function crossesBeyond(p: Point[], pb: ReturnType<typeof boxOf>, q: Point[], qb: ReturnType<typeof boxOf>, at: Point, free: number): boolean {
  // two lines whose boxes do not meet do not cross
  if (qb.x0 > pb.x1 || pb.x0 > qb.x1 || qb.y0 > pb.y1 || pb.y0 > qb.y1) return false;
  const side = (a: Point, b: Point, r: Point) => Math.sign((b.x - a.x) * (r.y - a.y) - (b.y - a.y) * (r.x - a.x));
  for (let k = 1; k < p.length; k++) {
    if (len(sub(p[k - 1], at)) < free || len(sub(p[k], at)) < free) continue;
    for (let m = 1; m < q.length; m++)
      if (side(p[k - 1], p[k], q[m - 1]) * side(p[k - 1], p[k], q[m]) < 0 && side(q[m - 1], q[m], p[k - 1]) * side(q[m - 1], q[m], p[k]) < 0) return true;
  }
  return false;
}

/** the distance between two neighbouring digits' places in a cell */
const pitchOf = (layout: Layout, cell: number) => len(sub(layout.centre({ cell, digit: 2 }), layout.centre({ cell, digit: 1 })));

/** the room a cell's pencilled digit takes in the arrows, cut-out margin and all: its share of the pitch */
const glyphOf = (layout: Layout, cell: number) => 0.3 * pitchOf(layout, cell) + 0.02 * layout.cell;

/** a drawn arrow's shaft (its points along the line) and head */
const partsOf = (s: Extract<ArrowShape, { kind: 'arrow' }>) => ({ shaft: s.trace.slice(0, s.trace.length - s.head.length), head: s.head });

/**
 * Where the start markers go (G14): beside the first node of every branch
 * that infers something (a branch of ties only, a colouring's cluster, has
 * no reading order; a chain of sets goes on through each set, so it has one
 * start). The dot stays inside its node's cell and off the places of the
 * cell's other digits, so it never sits on a grid line or reads as part of
 * a pencilled digit, and keeps clear of the arrows, the ties and the other
 * marks, at the largest size it is drawn, nearer its own node than any
 * other mark, so it never seems to mark the node the first arrow leaves
 * from after a switch: upper left when that is clear, then round the
 * clock, else wherever has most room among the places that are its node's.
 * `shapes` are the arrows already worked out, when the board has them;
 * `sets` the hint's groups' bars, which a dot keeps off, the whole of each
 */
export function startMarkers(
  links: ChainLink[],
  layout: Layout,
  obstacles: CellDigit[] = [],
  shapes: ArrowShape[] = arrowShapes(links, layout, obstacles),
  sets?: SetShapes
): (Point & { link: number; at: CellDigit })[] {
  const c = layout.cell;
  const dot = SIZES.dotLarge * c;
  // a cell line's half width, a box line's when the edge is one, and a little more
  const line = (box: boolean) => (box ? 0.03 : 0.0075) * c + 0.005 * c;
  const arrows = shapes.flatMap((s) => (s.kind === 'arrow' ? [partsOf(s)] : []));
  const ties = shapes.flatMap((s) => (s.kind === 'tie' ? [s.trace] : []));
  const out: (Point & { link: number; at: CellDigit })[] = [];
  links.forEach((l, i) => {
    if (goesOn(links, i)) return;
    // the branch's links, up to the next branch
    let j = i;
    while (j + 1 < links.length && goesOn(links, j + 1)) j++;
    if (links.slice(i, j + 1).every((b) => b.undirected)) return;
    const next = links.slice(i, j + 1).find((b) => !insideOneCell(b)) ?? l;
    const at = memberOf(l.from, layout, centroidOf(next.to, layout));
    const a = layout.centre(at);
    // beside its mark, the gap's half and the dot off it, which way it lies
    const reach = (dir: Point) => reachAt(layout, at, dir) + (SIZES.gap * c) / 2 + dot;
    const own = new Set(l.from.map(key));
    // its cell's square, and the places of the cell's other digits
    const col = at.cell % 9;
    const row = Math.floor(at.cell / 9);
    const x0 = layout.bounds.x0 + col * c;
    const y0 = layout.bounds.y0 + row * c;
    const pitch = len(sub(layout.centre({ cell: at.cell, digit: 2 }), layout.centre({ cell: at.cell, digit: 1 })));
    const marks = obstacles.filter((cd) => !own.has(key(cd))).map((cd) => ({ p: layout.centre(cd), r: radius(layout, cd) }));
    const others: Obstacle[] = [
      ...marks,
      ...(sets?.bars ?? []).map((bar) => ({ p: bar.a, q: bar.b, r: barHalf(layout) })),
      ...[1, 2, 3, 4, 5, 6, 7, 8, 9]
        .filter((d) => d !== at.digit && (layout.shown?.({ cell: at.cell, digit: d }) ?? true))
        .map((d) => ({ p: layout.centre({ cell: at.cell, digit: d }), r: 0.3 * pitch }))
    ];
    // clear enough: the first such side in the order below wins
    const enough = (SIZES.gap * c) / 2;
    let best: { p: Point; room: number; owned: boolean } | null = null;
    for (let k = 0; k < 8; k++) {
      const angle = Math.PI * (1.25 + k / 4);
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const p = add(a, mul(dir, reach(dir)));
      const room =
        Math.min(
          ...others.map((o) => (o.q ? distToSegment(p, o.p, o.q) : len(sub(p, o.p))) - o.r),
          p.x - x0 - line(col % 3 === 0),
          x0 + c - p.x - line(col % 3 === 2),
          p.y - y0 - line(row % 3 === 0),
          y0 + c - p.y - line(row % 3 === 2),
          ...arrows.map((s) => toPath(p, s.shaft, s.head) - (SIZES.stroke * c) / 2),
          ...ties.map((tie) => toPath(p, tie) - 0.015 * c)
        ) - dot;
      // the node's own: its rim nearer than any other mark's, by a margin
      const owned = len(sub(p, a)) - reachAt(layout, at, dir) + 0.02 * c <= Math.min(...marks.map((m) => len(sub(p, m.p)) - m.r));
      if (room >= enough && owned) {
        best = { p, room, owned };
        break;
      }
      const rank = (x: { room: number; owned: boolean }) => (x.owned && x.room > -dot / 2 ? 1e6 : 0) + x.room;
      if (!best || rank({ room, owned }) > rank(best) + 0.5) best = { p, room, owned };
    }
    out.push({ ...best!.p, link: i, at });
  });
  return out;
}

/**
 * Where the walk's numbers go (G14): on each arrow's own shaft, in link
 * order, as near its middle as keeps clear of the numbers already placed,
 * the hint's marks, the start dots and every head (its own included), at
 * the largest size a number is drawn, and off the digits the board shows
 * (a pencilled digit, a solved one) at the size a wide board draws it;
 * beside the shaft when nothing on it is clear; the clearest place when
 * nothing is. Corner brackets take theirs on the first clear corner, by
 * the same rules. A colouring's numbers keep a gap from each other and from
 * the marks too, and are placed without its ties, which are never drawn
 * with them. A number keeps off the groups' bars (`sets`) as off the marks
 */
export function badgePoints(
  shapes: ArrowShape[],
  layout: Layout,
  obstacles: CellDigit[],
  dots: Point[] = [],
  sets?: SetShapes
): Map<number, Point> {
  const c = layout.cell;
  const r = SIZES.badgeLarge * c;
  const small = SIZES.badge * c;
  const marks = obstacles.map((cd) => ({ p: layout.centre(cd), r: radius(layout, cd) }));
  // a group's bar, which a number keeps off, the whole of it, as off a mark
  const bars = (sets?.bars ?? []).map((bar) => ({ p: bar.a, q: bar.b, r: barHalf(layout) }));
  const marked = new Set(obstacles.map(key));
  const arrows = shapes.flatMap((s) => (s.kind === 'arrow' ? [s] : []));
  // the digits drawn round a point, its cell's and the neighbours': a
  // pencilled digit at its place, a solved digit in its cell's middle; and
  // an unsolved cell's empty places, where a number would read as a
  // candidate the cell does not have
  const digitsNear = (p: Point): (Obstacle & { empty: boolean })[] => {
    const col = Math.floor((p.x - layout.bounds.x0) / c);
    const row = Math.floor((p.y - layout.bounds.y0) / c);
    const out: (Obstacle & { empty: boolean })[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const [rr, cc] = [row + dr, col + dc];
        if (rr < 0 || rr > 8 || cc < 0 || cc > 8) continue;
        const cell = rr * 9 + cc;
        if (layout.solved?.(cell)) {
          out.push({ p: { x: layout.bounds.x0 + (cc + 0.5) * c, y: layout.bounds.y0 + (rr + 0.5) * c }, r: 0.2 * c, empty: false });
          continue;
        }
        for (let d = 1; d <= 9; d++) {
          const cd = { cell, digit: d };
          if (marked.has(key(cd))) continue;
          const shown = layout.shown?.(cd) ?? false;
          out.push({ p: layout.centre(cd), r: (shown ? 0.25 : 0.2) * pitchOf(layout, cell), empty: !shown });
        }
      }
    return out;
  };
  const placed: Point[] = [];
  const out = new Map<number, Point>();
  const numbered = shapes.filter((s): s is Extract<ArrowShape, { kind: 'arrow' | 'cell' }> => s.kind === 'arrow' || s.kind === 'cell');
  for (const s of numbered) {
    // a bracket's own lines, which its number keeps beside rather than on
    const bracket = s.kind === 'cell' ? s.trace : null;
    const { shaft } = s.kind === 'arrow' ? partsOf(s) : { shaft: s.corners };
    const middle = (shaft.length - 1) / 2;
    // from the middle outwards, never into the last fifth at either end;
    // then the same places beside the shaft, either side
    const order = Array.from({ length: shaft.length }, (_, k) => k)
      .filter((k) => Math.abs(k - middle) <= shaft.length * 0.3)
      .sort((x, y) => Math.abs(x - middle) - Math.abs(y - middle) || x - y);
    const beside = (k: number, side: number) => {
      const along = unit(sub(shaft[Math.min(k + 1, shaft.length - 1)], shaft[Math.max(k - 1, 0)]));
      return add(shaft[k], mul(perp(along), side * (r + SIZES.stroke * c)));
    };
    // a weak arrow keeps a dash, a gap and a dash in sight on one side of
    // its number, at the phone's dash, so the frame that brings it in still
    // shows it is dashed (G8); a short one takes its number beside it
    const along = shaft.map((_, k) => (k ? len(sub(shaft[k], shaft[k - 1])) : 0)).reduce<number[]>((acc, x, k) => [...acc, (acc[k - 1] ?? 0) + x], []);
    const total = along[along.length - 1];
    const dashes = (k: number) => s.kind === 'cell' || s.strong || Math.max(along[k] - r, total - along[k] - r - SIZES.headLength * c) >= 0.3 * c;
    // the places on the shaft that would hide its dashes, kept for when
    // nothing else is clear: a number on its own arrow beats one on another
    const crowded = bracket ? [] : order.filter((k) => !dashes(k)).map((k) => ({ p: shaft[k], on: true }));
    const spots = bracket
      ? shaft.map((p) => ({ p, on: true }))
      : [
          ...order.filter(dashes).map((k) => ({ p: shaft[k], on: true })),
          ...order.flatMap((k) => [beside(k, 1), beside(k, -1)].map((q) => ({ p: q, on: false })))
        ];
    // a colouring's weak tie or brackets: never drawn with a tie
    const colouring = s.kind === 'cell' || !!s.undirected;
    const otherShafts = [
      ...arrows.filter((a) => a !== s).map((a) => partsOf(a).shaft),
      ...shapes.flatMap((x) => ((x.kind === 'tie' && !colouring) || (x.kind === 'cell' && x !== s) ? [x.trace] : []))
    ];
    // a colouring's number keeps a gap from the others too, so two never
    // touch on a phone and read as one; and from the marks, their keyline
    // at its widest included, so it never sits against a candidate's ring
    const apart = 2 * r + (colouring ? SIZES.badgeGap * c : 0);
    const offMarks = r + (colouring ? (MARK.keylineSmall + SIZES.badgeGap) * c : 0);
    // what a number must keep clear of: the numbers placed, the marks, the
    // dots, every head, the board's edge; and, beside its shaft, every other
    // arrow, so it is never nearer another arrow than its own
    const hard = (q: { p: Point; on: boolean }) =>
      Math.min(
        ...placed.map((x) => len(sub(q.p, x)) - apart),
        ...marks.map((m) => len(sub(q.p, m.p)) - m.r - offMarks),
        ...bars.map((o) => distToSegment(q.p, o.p, o.q) - o.r - r),
        ...dots.map((x) => len(sub(q.p, x)) - SIZES.dotLarge * c - r),
        ...arrows.map((a) => (a.head.length ? toPath(q.p, [], a.head) - r : Infinity)),
        ...(q.on ? [] : otherShafts.map((sh) => toPath(q.p, sh) - r - SIZES.stroke * c)),
        q.p.x - layout.bounds.x0 - r,
        layout.bounds.x1 - q.p.x - r,
        q.p.y - layout.bounds.y0 - r,
        layout.bounds.y1 - q.p.y - r
      );
    // what it had best keep clear of, at a size: the digits, and on its
    // shaft the other arrows (a crossing is still its own arrow)
    // empty places count 'clear' (the whole number off them), 'off' (its
    // middle off them, so it does not stand where a digit would) or not at all
    const soft = (q: { p: Point; on: boolean }, size: number, empty: 'clear' | 'off' | 'none') =>
      Math.min(
        ...digitsNear(q.p).map((o) =>
          !o.empty ? len(sub(q.p, o.p)) - o.r - size : empty === 'clear' ? len(sub(q.p, o.p)) - o.r - size : empty === 'off' ? len(sub(q.p, o.p)) - 1.75 * o.r : Infinity
        ),
        ...(q.on ? otherShafts.map((sh) => toPath(q.p, sh) - size - (SIZES.stroke * c) / 2) : [])
      );
    // on its shaft before beside it: clear of every place at the size a
    // small board draws it, else of the digits shown at that size and off
    // the empty places; then the same beside the shaft; then the same at
    // the size a wide board draws it; then off the digits shown only; else
    // the clearest spot
    const tiers: [boolean, number, 'clear' | 'off' | 'none'][] = [
      [true, r, 'clear'],
      [true, r, 'off'],
      [false, r, 'clear'],
      [false, r, 'off'],
      [true, small, 'off'],
      [false, small, 'off'],
      [true, small, 'none'],
      [false, small, 'none']
    ];
    let found: Point | null = null;
    for (const [on, size, empty] of tiers) {
      const q = spots.find((x) => x.on === on && hard(x) >= 0 && soft(x, size, empty) >= 0);
      if (q) {
        found = q.p;
        break;
      }
    }
    if (!found) found = crowded.find((x) => hard(x) >= 0 && soft(x, small, 'none') >= 0)?.p ?? null;
    if (!found) {
      const score = (q: { p: Point; on: boolean }) => {
        const h = hard(q);
        return h >= 0 ? 1e6 + soft(q, small, 'none') : h;
      };
      const all = [...spots, ...crowded];
      found = all.reduce((x, y) => (score(y) > score(x) ? y : x), all[0]).p;
    }
    const at = found ?? (s.kind === 'arrow' ? s.mid : s.corners[0]);
    placed.push(at);
    out.set(s.link, at);
  }
  return out;
}

/** a polygon's points, for an SVG `points` attribute */
export const pointsOf = (ps: Point[]) => ps.map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
