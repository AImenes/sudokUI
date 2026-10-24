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
import { boardLayout } from '../src/ui/boardLayout';
import { hintMarks, markedCandidates } from '../src/content/hintMarks';
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
    const placed = new Set(marked.filter((m) => marks.cands.get(m.cell)?.get(m.digit) === 'place').map((m) => `${m.cell}:${m.digit}`));
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
    const placed = new Set(marked.filter((m) => marks.cands.get(m.cell)?.get(m.digit) === 'place').map(key));
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

  it('keeps every example\'s walk numbers off the heads and the digits shown', () => {
    let numbers = 0;
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, mk, shown, layout: l } = boardOf(ex);
      const shapes = arrowShapes(step.links, l, marked);
      const at = badgePoints(shapes, l, marked, startMarkers(step.links, l, marked));
      for (const [i, p] of at) {
        numbers++;
        for (const s of shapes) if (s.kind === 'arrow' && s.head.length) {
          for (const h of s.head) expect(dist(p, h) > SIZES.badgeLarge * 100 || s.link !== i, `${tech} number ${i + 1}`).toBe(true);
        }
        for (let cell = 0; cell < 81; cell++)
          for (let d = 1; d <= 9; d++)
            if (shown({ cell, digit: d }) && !mk.has(`${cell}:${d}`)) expect(dist(p, l.centre({ cell, digit: d })), `${tech} number ${i + 1} on the ${d} of cell ${cell}`).toBeGreaterThan(0.25 * 28 + SIZES.badge * 100 - 3);
      }
    }
    expect(numbers).toBeGreaterThan(50);
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
