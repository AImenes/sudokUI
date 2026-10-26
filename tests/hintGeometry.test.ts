/**
 * Where a hint's arrows go (src/content/hintGeometry.ts; docs/hint-drawing.md
 * G9-G14): straight from just outside one mark to just outside the next,
 * with a head at the target; no arrow inside one cell; a gentle arc only
 * when another mark of the same hint lies on the line, clear of it along
 * the whole curve and inside the board; links between the same two nodes
 * side by side; the start marker on each branch's first arrow.
 */
import { describe, it, expect } from 'vitest';
import { arrowShapes, startMarkers, badgePoints, insideOneCell, Layout, Point, SIZES, ArrowShape } from '../src/content/hintGeometry';
import type { CellDigit, ChainLink } from '../src/engine/steps';
import { alternatingLinks } from '../src/engine/steps';
import { boardLayout, digitShown } from '../src/ui/boardLayout';
import { hintMarks, markedCandidates, placedKeys } from '../src/content/hintMarks';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid } from '../src/engine/board';
import { findNextStep, findAllSteps, applyStep } from '../src/engine/humanSolver';

/** the app board's layout: 100 units a cell, a 4-unit margin, candidates on a 28 pitch */
const layout: Layout = boardLayout();

const cd = (r: number, c: number, digit: number): CellDigit => ({ cell: (r - 1) * 9 + (c - 1), digit });
const link = (from: CellDigit | CellDigit[], to: CellDigit | CellDigit[], strong = true, undirected = false): ChainLink => ({
  from: Array.isArray(from) ? from : [from],
  to: Array.isArray(to) ? to : [to],
  strong,
  ...(undirected ? { undirected: true } : {})
});
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
/** the distance from a point to the segment a-b */
function toSegment(p: Point, a: Point, b: Point): number {
  const ab = { x: b.x - a.x, y: b.y - a.y };
  const l2 = ab.x * ab.x + ab.y * ab.y || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
  return dist(p, { x: a.x + ab.x * t, y: a.y + ab.y * t });
}
/** the distance from a point to a filled triangle: 0 inside it */
function toHead(p: Point, head: Point[]): number {
  const side = (a: Point, b: Point) => Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
  const s = [side(head[0], head[1]), side(head[1], head[2]), side(head[2], head[0])];
  if (s.every((v) => v >= 0) || s.every((v) => v <= 0)) return 0;
  return Math.min(toSegment(p, head[0], head[1]), toSegment(p, head[1], head[2]), toSegment(p, head[2], head[0]));
}
/** the distance from a point to an arrow as drawn: its shaft, read back from its path, and its head's edges */
function toArrow(p: Point, s: Extract<ArrowShape, { kind: 'arrow' }>): number {
  const line = samples(s.d);
  let least = Infinity;
  for (let k = 0; k + 1 < line.length; k++) least = Math.min(least, toSegment(p, line[k], line[k + 1]));
  for (let k = 0; k < s.head.length; k++) least = Math.min(least, toSegment(p, s.head[k], s.head[(k + 1) % s.head.length]));
  return least;
}
const arrow = (s: ArrowShape) => {
  if (s.kind !== 'arrow') throw new Error(`expected an arrow, got ${s.kind}`);
  return s;
};

/** points along a shape's shaft, read back from its path */
function samples(d: string): Point[] {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
  if (d.includes('C')) {
    const [x0, y0, ax, ay, bx, by, x1, y1] = n;
    return Array.from({ length: 41 }, (_, k) => {
      const t = k / 40;
      const s = 1 - t;
      return {
        x: s ** 3 * x0 + 3 * s * s * t * ax + 3 * s * t * t * bx + t ** 3 * x1,
        y: s ** 3 * y0 + 3 * s * s * t * ay + 3 * s * t * t * by + t ** 3 * y1
      };
    });
  }
  if (d.includes('Q')) {
    const [x0, y0, cx, cy, x1, y1] = n;
    return Array.from({ length: 41 }, (_, k) => {
      const t = k / 40;
      return {
        x: (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1,
        y: (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1
      };
    });
  }
  const [x0, y0, x1, y1] = n;
  return Array.from({ length: 41 }, (_, k) => ({ x: x0 + ((x1 - x0) * k) / 40, y: y0 + ((y1 - y0) * k) / 40 }));
}

describe('an arrow', () => {
  it('runs straight from just outside its start mark to just outside its target, head at the target', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const s = arrow(arrowShapes([link(a, b)], layout, [a, b])[0]);
    expect(s.d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
    const outside = layout.r + SIZES.gap * 100;
    expect(dist(s.tail, layout.centre(a))).toBeCloseTo(outside, 0);
    expect(dist(s.head[0], layout.centre(b))).toBeCloseTo(outside, 0);
    expect(s.head).toHaveLength(3);
    expect(s.strong).toBe(true);
  });

  it('crosses a candidate the hint does not mark, straight', () => {
    // r1c5's 5 lies on the line, but the hint does not mark it
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const s = arrow(arrowShapes([link(a, b, false)], layout, [a, b])[0]);
    expect(s.d).toContain(' L ');
    expect(s.strong).toBe(false);
  });

  it('bends round a mark of the same hint that lies on its line, and keeps clear of it all the way', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const between = cd(1, 5, 5);
    const s = arrow(arrowShapes([link(a, b)], layout, [a, b, between])[0]);
    expect(s.d).toContain(' Q ');
    const o = layout.centre(between);
    for (const p of samples(s.d)) expect(dist(p, o) - layout.r).toBeGreaterThanOrEqual(SIZES.clearance * 100 - 0.5);
  });

  it('bends to the side with room, never off the board', () => {
    // along the top row, a bend upward would leave the board
    const a = cd(1, 1, 2);
    const b = cd(1, 9, 2);
    const between = cd(1, 5, 2);
    const s = arrow(arrowShapes([link(a, b)], layout, [a, b, between])[0]);
    for (const p of samples(s.d)) expect(p.y).toBeGreaterThanOrEqual(layout.bounds.y0);
    expect(s.mid.y).toBeGreaterThan(layout.centre(between).y);
  });

  it('draws nothing for a link inside one cell, or between two digits of the same cells', () => {
    const switchInCell = link(cd(4, 3, 8), cd(4, 3, 6));
    expect(insideOneCell(switchInCell)).toBe(true);
    const alsDigits = link([cd(7, 8, 8), cd(8, 8, 8)], [cd(7, 8, 9), cd(8, 8, 9)]);
    expect(insideOneCell(alsDigits)).toBe(true);
    expect(insideOneCell(link(cd(4, 3, 6), cd(4, 7, 6)))).toBe(false);
    const shapes = arrowShapes([switchInCell, alsDigits], layout, []);
    expect(shapes.map((s) => s.kind)).toEqual(['none', 'none']);
  });

  it('leaves a cell from the candidate the chain exits by, while the start marker stays on the first node', () => {
    // (8=6)r4c3 - 6r4c7: no arrow for the switch; the first drawn arrow
    // leaves from the 6, but reading starts at the 8
    const links = [link(cd(4, 3, 8), cd(4, 3, 6)), link(cd(4, 3, 6), cd(4, 7, 6), false)];
    const shapes = arrowShapes(links, layout, links.flatMap((l) => [...l.from, ...l.to]));
    expect(shapes[0].kind).toBe('none');
    const s = arrow(shapes[1]);
    expect(dist(s.tail, layout.centre(cd(4, 3, 6)))).toBeLessThan(dist(s.tail, layout.centre(cd(4, 3, 8))));
    const [start] = startMarkers(links, layout);
    expect(dist(start, layout.centre(cd(4, 3, 8)))).toBeLessThan(dist(start, layout.centre(cd(4, 3, 6))));
    expect(dist(start, layout.centre(cd(4, 3, 8)))).toBeGreaterThan(layout.r);
  });

  it('joins a group at its member nearest the other end, never at a middle outside the group', () => {
    // a group of 8s in r5c7 and r6c7, linked to an 8 in r9c7 below them
    const group = [cd(5, 7, 8), cd(6, 7, 8)];
    const below = cd(9, 7, 8);
    const s = arrow(arrowShapes([link(group, below)], layout, [...group, below])[0]);
    expect(dist(s.tail, layout.centre(cd(6, 7, 8)))).toBeCloseTo(layout.r + SIZES.gap * 100, 0);
  });

  it('has no head when the link is too short to carry one', () => {
    const s = arrow(arrowShapes([link(cd(1, 1, 3), cd(1, 2, 1))], layout, [])[0]);
    expect(s.head).toEqual([]);
  });

  it('marks the start of each branch, and only there; a cluster of ties has none', () => {
    const r1 = cd(1, 1, 7);
    const r2 = cd(2, 1, 7);
    const r3 = cd(3, 4, 7);
    const other = cd(9, 9, 7);
    const starts = startMarkers([link(r1, r2), link(r2, r3, false), link(other, r3, false)], layout);
    expect(starts).toHaveLength(2);
    // beside the mark, just clear of its rim at the largest size it is drawn
    const beside = layout.r + (SIZES.gap * 100) / 2 + SIZES.dotLarge * 100;
    expect(dist(starts[0], layout.centre(r1))).toBeCloseTo(beside, 5);
    expect(dist(starts[1], layout.centre(other))).toBeCloseTo(beside, 5);
    expect(startMarkers([link(r1, r2, true, true), link(r2, r3, true, true)], layout)).toEqual([]);
  });

  it('draws two links between the same two nodes side by side', () => {
    const a = cd(2, 2, 4);
    const b = cd(2, 7, 4);
    const [s, t] = arrowShapes([link(a, b), link(b, a, false)], layout, [a, b]).map(arrow);
    expect(Math.abs(s.mid.y - t.mid.y)).toBeGreaterThan(SIZES.pair * 100 * 0.9);
  });
});

describe('what the review of phase 1 found', () => {
  it('draws no arrow for a set changing digit across different cells of the set', () => {
    // 9@r8c3 => 3@{r3c3,r8c3}: r8c3 could be 4 with the 3 in r3c3, so an
    // arrow from the 9 to the 3 of r8c3 would say more than the set does
    const change = link(cd(8, 3, 9), [cd(3, 3, 3), cd(8, 3, 3)]);
    expect(insideOneCell(change)).toBe(true);
    // and the near variant: 3 in rXc1 => 1@{rXc1,rXc2}, whose nearest 1 is in the next cell
    const near = link(cd(5, 1, 3), [cd(5, 1, 1), cd(5, 2, 1)]);
    expect(insideOneCell(near)).toBe(true);
    expect(arrowShapes([change, near], layout, []).map((s) => s.kind)).toEqual(['none', 'none']);
    // a link from a single to a group in other cells is still an arrow
    expect(insideOneCell(link(cd(1, 1, 8), [cd(5, 1, 8), cd(6, 1, 8)]))).toBe(false);
  });

  it('keeps a head off the mark beside its target, arriving steeply when it must', () => {
    // 2r1c1 => 2r1c9, with 1r1c9 (the next node) beside the target on the line
    const a = cd(1, 1, 2);
    const b = cd(1, 9, 2);
    const beside = cd(1, 9, 1);
    const s = arrow(arrowShapes([link(a, b), link(b, beside, false)], layout, [a, b, beside])[0]);
    const o = layout.centre(beside);
    for (const p of [...s.head, ...s.trace]) expect(dist(p, o)).toBeGreaterThan(layout.r);
    // and inside the board, halo and all
    for (const p of s.trace) expect(p.y).toBeGreaterThanOrEqual(layout.bounds.y0 + ((SIZES.stroke + SIZES.halo) * 100) / 2 - 1e-9);
  });

  it('starts and ends outside a placement\'s outer ring', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const big = SIZES.r * 100 + 5;
    const ringed: Layout = { ...layout, radiusOf: (x) => (x.cell === b.cell && x.digit === b.digit ? big : layout.r) };
    const s = arrow(arrowShapes([link(a, b)], ringed, [a, b])[0]);
    expect(dist(s.head[0], layout.centre(b))).toBeCloseTo(big + SIZES.gap * 100, 0);
  });

  it('puts the start dot clear of the first arrow, on whichever side has room', () => {
    // the first arrow leaves up and to the left, where the dot would go by default
    const a = cd(5, 5, 1);
    const b = cd(1, 1, 1);
    const [start] = startMarkers([link(a, b)], layout, [a, b]);
    const s = arrow(arrowShapes([link(a, b)], layout, [a, b])[0]);
    // the dot's rim, at its largest, clear of the shaft's edge and the head
    expect(toArrow(start, s)).toBeGreaterThan(SIZES.dotLarge * 100 + (SIZES.stroke * 100) / 2);
  });

  it('gives a chain of sets one start, going on through each set', () => {
    // A(x) - C(x), then C's other digit y - B(y): the set C is not a new branch
    const A = [cd(1, 1, 4), cd(1, 2, 4)];
    const Cx = [cd(1, 6, 4)];
    const Cy = [cd(1, 6, 7), cd(2, 6, 7)];
    const B = [cd(6, 6, 7)];
    expect(startMarkers([link(A, Cx, false), link(Cy, B, false)], layout, [...A, ...Cx, ...Cy, ...B])).toHaveLength(1);
  });
});

describe('what the second review of phase 1 found', () => {
  /** a step's marks and the board's layout for it, as the app board works them out */
  function drawn(step: Parameters<typeof hintMarks>[0], solved: (cell: number) => boolean, cands?: number[]) {
    const marks = hintMarks(step, { solved });
    const marked = markedCandidates(marks);
    const placed = placedKeys(marks);
    // the digits the board shows: the candidates, and every digit the hint marks
    const shown = cands
      ? (cd: CellDigit) => !solved(cd.cell) && ((cands[cd.cell] & (1 << (cd.digit - 1))) !== 0 || !!marks.cands.get(cd.cell)?.has(cd.digit))
      : undefined;
    return { marked, layout: boardLayout(placed, shown) };
  }

  it('finds the arc that clears, turning near an end, before settling for the clearest that does not', () => {
    // 4r2c1=4r6c1-8r6c1=8r2c1-4r2c1, removing 1, 2, 7, 9 from r6c1: the
    // straight 4r2c1 => 4r6c1 meets its own 1 and 7 beside it, and the
    // removals of r6c1 sit round its target
    const g = parseGrid('52...6.........7.13...........4..8..6......5...........418.........3..2...87.....')!;
    for (let k = 0; k < 3; k++) applyStep(g, findNextStep(g)!);
    const step = findAllSteps(g).find((s) => s.tech === 'NICE_LOOP' && s.eliminations.length === 5)!;
    expect(step).toBeDefined();
    const { marked, layout: l } = drawn(step, (c) => g.values[c] > 0);
    const shapes = arrowShapes(step.links!, l, marked);
    shapes.forEach((s, i) => {
      if (s.kind !== 'arrow') return;
      const own = new Set([...step.links![i].from, ...step.links![i].to].map((cd) => `${cd.cell}:${cd.digit}`));
      for (const m of marked) {
        if (own.has(`${m.cell}:${m.digit}`)) continue;
        expect(toArrow(l.centre(m), s), `link ${i + 1} and ${m.digit} in cell ${m.cell}`).toBeGreaterThan(l.radiusOf!(m));
      }
    });
  });

  it('keeps the walk numbers of two crossing arrows apart', () => {
    // two diagonals crossing in r5c5: both middles fall on the crossing
    const a = link(cd(1, 1, 5), cd(9, 9, 5));
    const b = link(cd(1, 9, 5), cd(9, 1, 5), false);
    const nodes = [cd(1, 1, 5), cd(9, 9, 5), cd(1, 9, 5), cd(9, 1, 5)];
    const shapes = arrowShapes([a, b], layout, nodes);
    const at = badgePoints(shapes, layout, nodes);
    expect(dist(at.get(0)!, at.get(1)!)).toBeGreaterThanOrEqual(2 * SIZES.badgeLarge * 100);
    // each on its own arrow
    expect(toArrow(at.get(0)!, arrow(shapes[0]))).toBeLessThan(1);
    expect(toArrow(at.get(1)!, arrow(shapes[1]))).toBeLessThan(1);
  });

  it('puts every example\'s start dots inside their cell, off its other digits and clear of the arrows', () => {
    let dots = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, layout: l } = drawn(step, (c) => ex!.values[c] !== '0', ex!.cands);
      const shapes = arrowShapes(step.links, l, marked);
      for (const p of startMarkers(step.links, l, marked)) {
        dots++;
        const col = Math.floor((p.x - l.bounds.x0) / l.cell);
        const row = Math.floor((p.y - l.bounds.y0) / l.cell);
        const x0 = l.bounds.x0 + col * l.cell;
        const y0 = l.bounds.y0 + row * l.cell;
        const dot = SIZES.dotLarge * l.cell;
        // inside the cell, clear of its lines (a box line 6 units wide, a cell line 1.5)
        const half = (box: boolean) => (box ? 3 : 0.75);
        expect(p.x - x0, tech).toBeGreaterThan(dot + half(col % 3 === 0));
        expect(x0 + l.cell - p.x, tech).toBeGreaterThan(dot + half(col % 3 === 2));
        expect(p.y - y0, tech).toBeGreaterThan(dot + half(row % 3 === 0));
        expect(y0 + l.cell - p.y, tech).toBeGreaterThan(dot + half(row % 3 === 2));
        // in the cell of the node it marks, and off every other digit the cell shows
        const cell = row * 9 + col;
        expect(cell, tech).toBe(p.at.cell);
        const pitch = dist(l.centre({ cell, digit: 2 }), l.centre({ cell, digit: 1 }));
        for (const d of [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== p.at.digit && l.shown!({ cell, digit: d }))) {
          expect(dist(p, l.centre({ cell, digit: d })), `${tech}: the ${d} of the cell`).toBeGreaterThan(dot + 0.3 * pitch);
        }
        // clear of every arrow
        for (const s of shapes) if (s.kind === 'arrow') expect(toArrow(p, s), tech).toBeGreaterThan(dot + (SIZES.stroke * l.cell) / 2);
      }
    }
    expect(dots).toBeGreaterThan(15);
  });
});

describe('what the third review of phase 1 found', () => {
  /** the app board's layout with the digits of the example's position shown and solved */
  function boardOf(ex: (typeof EXAMPLES)[keyof typeof EXAMPLES]) {
    const step = ex!.step;
    const solved = (c: number) => ex!.values[c] !== '0';
    const marks = hintMarks(step, { solved });
    const marked = markedCandidates(marks);
    const key = (cd: CellDigit) => `${cd.cell}:${cd.digit}`;
    const mk = new Set(marked.map(key));
    const placed = placedKeys(marks);
    const shown = (cd: CellDigit) => !solved(cd.cell) && ((ex!.cands[cd.cell] & (1 << (cd.digit - 1))) !== 0 || mk.has(key(cd)));
    return { marked, mk, shown, layout: boardLayout(placed, shown, solved) };
  }

  it('measures an arrow\'s clearance along its segments, not only at sample points', () => {
    // the 2 of r5c3 sits on the line from 1r5c1 to 1r5c9, between two of its samples
    const a = cd(5, 1, 1);
    const b = cd(5, 9, 1);
    const between = cd(5, 3, 2);
    const s = arrow(arrowShapes([link(a, b)], layout, [a, b, between])[0]);
    expect(s.d).toContain(' Q ');
    expect(toArrow(layout.centre(between), s)).toBeGreaterThan(layout.r);
  });

  it('lands every example\'s heads off the other digits of the target\'s cell, which are cut out of the arrows', () => {
    let heads = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, mk, shown, layout: l } = boardOf(ex);
      arrowShapes(step.links, l, marked).forEach((s, i) => {
        if (s.kind !== 'arrow' || !s.head.length) return;
        heads++;
        for (const t of step.links![i].to) {
          const pitch = dist(l.centre({ cell: t.cell, digit: 2 }), l.centre({ cell: t.cell, digit: 1 }));
          for (let d = 1; d <= 9; d++) {
            if (d === t.digit || mk.has(`${t.cell}:${d}`) || !shown({ cell: t.cell, digit: d })) continue;
            const o = l.centre({ cell: t.cell, digit: d });
            const edge = Math.min(...s.head.map((p, k) => {
              const q = s.head[(k + 1) % 3];
              const ab = { x: q.x - p.x, y: q.y - p.y };
              const u = Math.max(0, Math.min(1, ((o.x - p.x) * ab.x + (o.y - p.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y)));
              return dist(o, { x: p.x + ab.x * u, y: p.y + ab.y * u });
            }));
            expect(edge, `${tech} link ${i + 1}: its head and the ${d} of the target's cell`).toBeGreaterThan(0.3 * pitch);
          }
        }
      });
    }
    expect(heads).toBeGreaterThan(50);
  });

  it('keeps a walk number off a mark, a start dot and a digit the board shows, on its own shaft', () => {
    // 1r5c1 => 1r5c9: the middle of the shaft is the 1 of r5c5
    const a = cd(5, 1, 1);
    const b = cd(5, 9, 1);
    const middle = cd(5, 5, 1);
    const straight = arrowShapes([link(a, b)], layout, [a, b]);
    const mid = arrow(straight[0]).mid;
    // a mark there (an arrow bends round it, so take the straight one's shapes)
    expect(dist(badgePoints(straight, layout, [a, b, middle]).get(0)!, layout.centre(middle))).toBeGreaterThan(layout.r + SIZES.badgeLarge * 100);
    // a start dot there
    expect(dist(badgePoints(straight, layout, [a, b], [mid]).get(0)!, mid)).toBeGreaterThan(SIZES.dotLarge * 100 + SIZES.badgeLarge * 100);
    // the digit shown there
    const shownMiddle: Layout = { ...layout, shown: (x) => x.cell === middle.cell && x.digit === middle.digit };
    const p = badgePoints(straight, shownMiddle, [a, b]).get(0)!;
    expect(dist(p, layout.centre(middle))).toBeGreaterThan(0.25 * 28 + SIZES.badge * 100);
    expect(toArrow(p, arrow(straight[0]))).toBeLessThan(1);
    // a solved digit there
    const solvedMiddle: Layout = { ...layout, solved: (cell) => cell === middle.cell };
    const q = badgePoints(straight, solvedMiddle, [a, b]).get(0)!;
    expect(dist(q, { x: 4 + 4.5 * 100, y: 4 + 4.5 * 100 })).toBeGreaterThan(0.2 * 100 + SIZES.badge * 100);
  });

  it('keeps every example\'s walk numbers, at a phone\'s size, off every head, the digits shown and the empty places, nearest their own arrow', () => {
    let numbers = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, mk, shown, layout: l } = boardOf(ex);
      const shapes = arrowShapes(step.links, l, marked);
      const arrows = shapes.flatMap((s) => (s.kind === 'arrow' ? [s] : []));
      const at = badgePoints(shapes, l, marked, startMarkers(step.links, l, marked));
      const r = SIZES.badgeLarge * 100;
      for (const [i, p] of at) {
        numbers++;
        const what = `${tech} number ${i + 1}`;
        for (const s of arrows) if (s.head.length) expect(toHead(p, s.head), `${what} and the head of link ${s.link + 1}`).toBeGreaterThan(r);
        for (let cell = 0; cell < 81; cell++) {
          if (ex!.values[cell] !== '0') {
            const middle = { x: 4 + (cell % 9) * 100 + 50, y: 4 + Math.floor(cell / 9) * 100 + 50 };
            expect(dist(p, middle), `${what} on the solved digit of cell ${cell}`).toBeGreaterThan(20 + r);
            continue;
          }
          for (let d = 1; d <= 9; d++) {
            if (mk.has(`${cell}:${d}`)) continue;
            const q = l.centre({ cell, digit: d });
            if (shown({ cell, digit: d })) expect(dist(p, q), `${what} on the ${d} of cell ${cell}`).toBeGreaterThan(0.25 * 28 + r);
            else expect(dist(p, q), `${what} on the empty place of ${d} in cell ${cell}`).toBeGreaterThan(0.35 * 28);
          }
        }
        const own = toArrow(p, arrows.find((s) => s.link === i)!);
        for (const s of arrows) if (s.link !== i) expect(toArrow(p, s), `${what} nearer link ${s.link + 1}`).toBeGreaterThanOrEqual(own - 0.5);
      }
    }
    expect(numbers).toBeGreaterThan(50);
  });

  it('runs no arrow along another: an arc that keeps a head off a digit loses to one that does not hide an arrow', () => {
    // 4r2c1=4r6c1-8r6c1=8r2c1: a head-dodging arc for the first link ran
    // inside the third for a cell and a half
    const g = parseGrid('52...6.........7.131..........4..8..6......5...........418.........3..28.387.....')!;
    const step = findAllSteps(g).find((s) => s.tech === 'AIC' && s.links?.length === 3 && s.links[0].from[0].digit === 4)!;
    expect(step).toBeDefined();
    const solved = (c: number) => g.values[c] > 0;
    const marks = hintMarks(step, { solved });
    const marked = markedCandidates(marks);
    const mk = new Set(marked.map((m) => `${m.cell}:${m.digit}`));
    const l = boardLayout(placedKeys(marks), (cd) => !solved(cd.cell) && ((g.cands[cd.cell] & (1 << (cd.digit - 1))) !== 0 || mk.has(`${cd.cell}:${cd.digit}`)), solved);
    const arrows = arrowShapes(step.links!, l, marked).flatMap((s) => (s.kind === 'arrow' ? [s] : []));
    // the middle link is a switch inside r6c1: no arrow
    expect(arrows.length).toBe(2);
    for (const x of arrows)
      for (const y of arrows) {
        if (x === y) continue;
        const line = samples(x.d);
        const ends = [line[0], line[line.length - 1]];
        let run = 0;
        for (let k = 0; k + 1 < line.length; k++) {
          const m = { x: (line[k].x + line[k + 1].x) / 2, y: (line[k].y + line[k + 1].y) / 2 };
          if (ends.some((e) => dist(m, e) < 45)) continue;
          if (toArrow(m, y) < (SIZES.stroke + SIZES.halo) * 100 + 1) run += dist(line[k], line[k + 1]);
        }
        expect(run, `link ${x.link + 1} along link ${y.link + 1}`).toBeLessThanOrEqual(30);
      }
  });

  it('knows where the player\'s own marks are drawn, to keep off them', () => {
    const bit = (d: number) => 1 << (d - 1);
    const cell = (corner: number[], center: number[]) => ({ value: 0, corner: corner.reduce((m, d) => m | bit(d), 0), center: center.reduce((m, d) => m | bit(d), 0) });
    // corner marks alone sit at their places
    expect([1, 2, 3].map((d) => digitShown(cell([1, 3], []), d, null))).toEqual([true, false, true]);
    // a short centre line runs through the cell: every place is taken
    expect([1, 5, 9].map((d) => digitShown(cell([], [3, 7]), d, null))).toEqual([true, true, true]);
    // five or more centre marks go on the 3×3
    expect([1, 2, 6].map((d) => digitShown(cell([], [1, 3, 5, 7, 9]), d, null))).toEqual([true, false, false]);
    // corner marks round the edge with a centre line: every place is taken
    expect(digitShown(cell([9], [4]), 1, null)).toBe(true);
    // with auto candidates on, or in a cell the hint marks, the 3×3
    expect(digitShown(cell([], [3, 7]), 5, bit(2) | bit(5))).toBe(true);
    expect(digitShown(cell([], [3, 7]), 1, bit(2) | bit(5))).toBe(false);
    expect(digitShown(cell([], [3, 7]), 1, null, new Set([8]))).toBe(false);
    expect(digitShown(cell([], [3, 7]), 8, null, new Set([8]))).toBe(true);
    // a solved cell shows no candidate
    expect(digitShown({ value: 4, corner: 0, center: 0 }, 4, null)).toBe(false);
  });
});

describe('what the fifth review of phase 1 found', () => {
  /** a step's marks and the app board's layout for it, with the position's candidates shown */
  function drawn(step: Parameters<typeof hintMarks>[0], solved: (cell: number) => boolean, cands: number[]) {
    const marks = hintMarks(step, { solved });
    const marked = markedCandidates(marks);
    const shown = (x: CellDigit) => !solved(x.cell) && ((cands[x.cell] & (1 << (x.digit - 1))) !== 0 || !!marks.cands.get(x.cell)?.has(x.digit));
    return { marked, layout: boardLayout(placedKeys(marks), shown, solved) };
  }
  const named =(s: string): CellDigit => ({ cell: (Number(s[2]) - 1) * 9 + Number(s[4]) - 1, digit: Number(s[0]) });
  /** a chain from its nodes, every digit the board shows one of its marks */
  function chainOf(nodes: string[], extra: string[] = [], placed: string[] = []) {
    const links = alternatingLinks(nodes.map((s) => [named(s)]));
    const marks = [...new Map([...links.flatMap((l) => [...l.from, ...l.to]), ...extra.map(named)].map((x) => [`${x.cell}:${x.digit}`, x])).values()];
    const l = boardLayout(new Set(placed.map((s) => `${named(s).cell}:${named(s).digit}`)), (x) => marks.some((m) => m.cell === x.cell && m.digit === x.digit));
    return { links, marks, layout: l, shapes: arrowShapes(links, l, marks) };
  }
  const inside = (c: ReturnType<typeof chainOf>) =>
    c.shapes.flatMap((s, i) => {
      if (s.kind !== 'arrow') return [];
      const own = new Set([...c.links[i].from, ...c.links[i].to].map((x) => `${x.cell}:${x.digit}`));
      return c.marks.filter((m) => !own.has(`${m.cell}:${m.digit}`) && toArrow(c.layout.centre(m), s) < c.layout.radiusOf!(m)).map((m) => `link ${i + 1} and ${m.digit} in cell ${m.cell}`);
    });

  it('draws an arrow boxed in at both ends with two bends, leaving and arriving steeply, clear of every mark', () => {
    // in r1c6 the 9 sits under the 6, in r9c6 the 3 over the target 6
    const xy = chainOf(['5r1c2', '1r1c2', '1r1c8', '9r1c8', '9r1c6', '6r1c6', '6r9c6', '3r9c6', '3r9c5', '5r9c5'], ['5r9c2']);
    expect(inside(xy)).toEqual([]);
    expect(xy.shapes.some((s) => s.kind === 'arrow' && s.d.includes(' C '))).toBe(true);
    // a discontinuous Nice Loop placing 7r7c7: 8r7c7 => 8r7c1 past the 9 beside its target
    const loop = chainOf(['7r7c7', '8r7c7', '8r7c1', '9r7c1', '9r5c1', '8r5c1', '8r5c9', '8r8c9', '2r8c9', '2r8c7', '7r8c7', '7r7c7'], [], ['7r7c7']);
    expect(inside(loop)).toEqual([]);
  });

  it('keeps a start dot off the ties, and nearer its own node than any other mark', () => {
    let dots = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, layout: l } = drawn(step, (c) => ex!.values[c] !== '0', ex!.cands);
      const shapes = arrowShapes(step.links, l, marked);
      for (const p of startMarkers(step.links, l, marked, shapes)) {
        dots++;
        for (const s of shapes) if (s.kind === 'tie') expect(toSegment(p, s.trace[0], s.trace[1]), `${tech}: the dot on a tie`).toBeGreaterThan(SIZES.dotLarge * 100 + 1.5);
        const own = dist(p, l.centre(p.at)) - l.radiusOf!(p.at);
        for (const m of marked) if (m.cell !== p.at.cell || m.digit !== p.at.digit) expect(dist(p, l.centre(m)) - l.radiusOf!(m), `${tech}: the dot nearer ${m.digit} of cell ${m.cell}`).toBeGreaterThan(own);
      }
    }
    expect(dots).toBeGreaterThan(15);
    // (7=4)r1c5 - 4r8c5, the 4 right above the 7: the dot is the 7's, not the 4's the first arrow leaves
    const sw = chainOf(['7r1c5', '4r1c5', '4r8c5']);
    const [p] = startMarkers(sw.links, sw.layout, sw.marks, sw.shapes);
    expect(dist(p, sw.layout.centre(named('7r1c5')))).toBeLessThan(dist(p, sw.layout.centre(named('4r1c5'))));
  });

  it('never puts the walk number of a short weak arrow on the parallel arrow beside it', () => {
    // r9c1 and r9c2 both {5, 7}: 7r9c1=5r9c1-5r9c2=7r9c2-7r9c1, two short
    // weak arrows 28 units apart along the board's bottom edge
    const loop = chainOf(['7r9c1', '5r9c1', '5r9c2', '7r9c2', '7r9c1']);
    const arrows = loop.shapes.flatMap((s) => (s.kind === 'arrow' ? [s] : []));
    expect(arrows).toHaveLength(2);
    const at = badgePoints(loop.shapes, loop.layout, loop.marks, startMarkers(loop.links, loop.layout, loop.marks, loop.shapes));
    for (const s of arrows) {
      const p = at.get(s.link)!;
      for (const o of arrows) if (o !== s) expect(toArrow(p, s), `number ${s.link + 1}`).toBeLessThanOrEqual(toArrow(p, o) + 0.5);
    }
  });

  it('leaves a short weak arrow a dash, a gap and a dash in sight beside its walk number', () => {
    let weak = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, layout: l } = drawn(step, (c) => ex!.values[c] !== '0', ex!.cands);
      const shapes = arrowShapes(step.links, l, marked);
      const at = badgePoints(shapes, l, marked, startMarkers(step.links, l, marked, shapes));
      for (const s of shapes) {
        if (s.kind !== 'arrow' || s.strong) continue;
        weak++;
        const p = at.get(s.link)!;
        const line = samples(s.d);
        // where along the shaft the number sits, if on it
        let k = 0;
        for (let j = 1; j < line.length; j++) if (dist(line[j], p) < dist(line[k], p)) k = j;
        if (dist(line[k], p) > 2) continue; // beside the shaft
        let before = 0;
        for (let j = 1; j <= k; j++) before += dist(line[j], line[j - 1]);
        let after = 0;
        for (let j = k + 1; j < line.length; j++) after += dist(line[j], line[j - 1]);
        const r = SIZES.badgeLarge * 100;
        expect(Math.max(before - r, after - r), `${tech} link ${s.link + 1}`).toBeGreaterThanOrEqual(30 - 2);
      }
    }
    expect(weak).toBeGreaterThan(10);
  });
});

describe('what the seventh review of phase 1 found', () => {
  it('gives a colouring\'s witness its own start dot, even where the last tie ends on its start', () => {
    // ties 1r1c1~1r1c5, 1r1c5~1r5c5 (the cluster), then the witness
    // 1r5c5 - 1r5c9, which leaves the node the last tie reached
    const a = cd(1, 1, 1);
    const b = cd(1, 5, 1);
    const c = cd(5, 5, 1);
    const d = cd(5, 9, 1);
    const links = [link(a, b, true, true), link(b, c, true, true), link(c, d, false)];
    const dots = startMarkers(links, layout, [a, b, c, d]);
    expect(dots.map((p) => p.link)).toEqual([2]);
    expect(dots[0].at).toEqual(c);
  });

  it('never puts a start dot on a node only ties reach, in a Simple Colors hint the solver gives: a colouring draws none', () => {
    const g = parseGrid('..8.......2...9.411...3...9.4...3..7.3.245.6.8..9...5.9...5...445.8...7.......5..')!;
    let step = findNextStep(g)!;
    for (let k = 0; k < 60 && step.tech !== 'SIMPLE_COLORS'; k++) {
      applyStep(g, step);
      step = findNextStep(g)!;
    }
    expect(step.tech).toBe('SIMPLE_COLORS');
    const solved = (cell: number) => g.values[cell] > 0;
    const marks = hintMarks(step, { solved });
    const marked = markedCandidates(marks);
    const l = boardLayout(placedKeys(marks), undefined, solved);
    const dots = startMarkers(step.links!, l, marked);
    // its witnesses are weak ties (docs/hint-drawing-colouring.md): they
    // claim no direction, so no link of it has a start
    expect(step.truth).toBe('parity');
    expect(step.links!.filter((w) => !w.strong).length).toBe(2);
    expect(step.links!.every((w) => w.undirected)).toBe(true);
    expect(dots).toEqual([]);
  });
});

describe('a tie', () => {
  it('is a quiet straight line with no head, never bent', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const between = cd(1, 5, 5);
    const [s] = arrowShapes([link(a, b, true, true)], layout, [a, b, between]);
    expect(s.kind).toBe('tie');
    expect(s.kind === 'tie' && s.d).toMatch(/ L /);
  });
});
