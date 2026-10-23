/**
 * Where a hint's arrows go (src/content/hintGeometry.ts; docs/hint-drawing.md
 * G9-G14): straight from just outside one mark to just outside the next,
 * with a head at the target; no arrow inside one cell; a gentle arc only
 * when another mark of the same hint lies on the line, clear of it along
 * the whole curve and inside the board; links between the same two nodes
 * side by side; the start marker on each branch's first arrow.
 */
import { describe, it, expect } from 'vitest';
import { arrowShapes, startMarkers, insideOneCell, Layout, Point, SIZES, ArrowShape } from '../src/content/hintGeometry';
import type { CellDigit, ChainLink } from '../src/engine/steps';

/** the app board's layout: 100 units a cell, a 4-unit margin, candidates on a 28 pitch */
const layout: Layout = {
  centre: ({ cell, digit }) => ({
    x: 4 + (cell % 9) * 100 + 22 + ((digit - 1) % 3) * 28,
    y: 4 + Math.floor(cell / 9) * 100 + 23 + Math.floor((digit - 1) / 3) * 28
  }),
  r: SIZES.r * 100,
  cell: 100,
  bounds: { x0: 0, y0: 0, x1: 908, y1: 908 }
};

const cd = (r: number, c: number, digit: number): CellDigit => ({ cell: (r - 1) * 9 + (c - 1), digit });
const link = (from: CellDigit | CellDigit[], to: CellDigit | CellDigit[], strong = true, undirected = false): ChainLink => ({
  from: Array.isArray(from) ? from : [from],
  to: Array.isArray(to) ? to : [to],
  strong,
  ...(undirected ? { undirected: true } : {})
});
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const arrow = (s: ArrowShape) => {
  if (s.kind !== 'arrow') throw new Error(`expected an arrow, got ${s.kind}`);
  return s;
};

/** points along a shape's shaft, read back from its path */
function samples(d: string): Point[] {
  const n = d.match(/-?\d+(\.\d+)?/g)!.map(Number);
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
    expect(dist(starts[0], layout.centre(r1))).toBeLessThan(layout.r + 5);
    expect(dist(starts[1], layout.centre(other))).toBeLessThan(layout.r + 5);
    expect(startMarkers([link(r1, r2, true, true), link(r2, r3, true, true)], layout)).toEqual([]);
  });

  it('draws two links between the same two nodes side by side', () => {
    const a = cd(2, 2, 4);
    const b = cd(2, 7, 4);
    const [s, t] = arrowShapes([link(a, b), link(b, a, false)], layout, [a, b]).map(arrow);
    expect(Math.abs(s.mid.y - t.mid.y)).toBeGreaterThan(SIZES.pair * 100 * 0.9);
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
