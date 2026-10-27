/**
 * Where a hint's arrows go (src/content/hintGeometry.ts; docs/hint-drawing.md
 * G9-G14): straight from just outside one mark to just outside the next,
 * with a head at the target; no arrow inside one cell; a gentle arc only
 * when another mark of the same hint lies on the line, clear of it along
 * the whole curve and inside the board; links between the same two nodes
 * side by side; the start marker on each branch's first arrow.
 */
import { describe, it, expect } from 'vitest';
import { arrowShapes, startMarkers, badgePoints, insideOneCell, setShapes, squareReach, hintDrawing, tilesIn, Layout, Point, SIZES, ArrowShape } from '../src/content/hintGeometry';
import type { GroupBar, SetShapes } from '../src/content/hintGeometry';
import { alsClash } from '../src/engine/truth';
import type { CellDigit, ChainLink, ChainSet, Step } from '../src/engine/steps';
import { alternatingLinks, groupSet } from '../src/engine/steps';
import { boardLayout, boardDrawing, digitShown, squareReachOf, M } from '../src/ui/boardLayout';
import { MARK } from '../src/content/hintPalette';
import { hintMarks, frameMarks, markedCandidates, placedKeys, squareKeys } from '../src/content/hintMarks';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid } from '../src/engine/board';
import { findNextStep, findAllSteps, findStep, applyStep } from '../src/engine/humanSolver';
import type { Tech } from '../src/engine/ratings';
import { readFileSync } from 'node:fs';

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

/** points along a shape's shaft, read back from its path: 40 along each line or curve it is made of */
function samples(d: string): Point[] {
  const tokens = d.match(/[MLQC]|-?\d+(\.\d+)?/g)!;
  const out: Point[] = [];
  let at = { x: 0, y: 0 };
  for (let k = 0; k < tokens.length; ) {
    const op = tokens[k++];
    const n: number[] = [];
    while (k < tokens.length && !/[MLQC]/.test(tokens[k])) n.push(Number(tokens[k++]));
    const from = at;
    const point = (t: number): Point => {
      const s = 1 - t;
      if (op === 'C') return { x: s ** 3 * from.x + 3 * s * s * t * n[0] + 3 * s * t * t * n[2] + t ** 3 * n[4], y: s ** 3 * from.y + 3 * s * s * t * n[1] + 3 * s * t * t * n[3] + t ** 3 * n[5] };
      if (op === 'Q') return { x: s * s * from.x + 2 * s * t * n[0] + t * t * n[2], y: s * s * from.y + 2 * s * t * n[1] + t * t * n[3] };
      return { x: from.x + (n[0] - from.x) * t, y: from.y + (n[1] - from.y) * t };
    };
    if (op === 'M') out.push((at = { x: n[0], y: n[1] }));
    else {
      for (let j = 1; j <= 40; j++) out.push(point(j / 40));
      at = out[out.length - 1];
    }
  }
  return out;
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

  it('joins a group at its member nearest the other end, never at a middle outside the group, where the ray leaves its square', () => {
    // a group of 8s in r5c7 and r6c7, linked to an 8 in r9c7 below them
    const group = [cd(5, 7, 8), cd(6, 7, 8)];
    const below = cd(9, 7, 8);
    const s = arrow(arrowShapes([link(group, below)], layout, [...group, below])[0]);
    expect(dist(s.tail, layout.centre(cd(6, 7, 8)))).toBeCloseTo(layout.r + SIZES.gap * 100, 0);
    // drawn as "one of these" squares, it is joined where the ray leaves the
    // square: towards r9c9, past the square's side and short of its corner
    const squares = boardLayout(new Set(), undefined, undefined, new Set(group.map((x) => `${x.cell}:${x.digit}`)));
    const far = cd(9, 9, 8);
    const t = arrow(arrowShapes([link(group, far)], squares, [...group, far])[0]);
    const from = squares.centre(cd(6, 7, 8));
    const u = { x: (t.tail.x - from.x) / dist(t.tail, from), y: (t.tail.y - from.y) / dist(t.tail, from) };
    expect(dist(t.tail, from)).toBeCloseTo(squareReachOf(u) + SIZES.gap * 100, 5);
    expect(squareReachOf(u)).toBeGreaterThan(13.2);
    expect(squareReachOf(u)).toBeLessThan(15.4);
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
    // a group's squares and bars as the board draws them (docs/hint-drawing-sets.md)
    const layout = boardLayout(placed, shown, solved, squareKeys(step, solved));
    return { marked, mk, shown, layout, sets: setShapes(step, layout, marked) };
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
      const { marked, mk, shown, layout: l, sets } = boardOf(ex);
      arrowShapes(step.links, l, marked, sets).forEach((s, i) => {
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
    /**
     * the numbers G14 lets fall back to the wide board's size, where nothing
     * on or beside their shaft is clear at a phone's: the stored Grouped Nice
     * Loop's closing link (docs/hint-drawing-sets.md, decision 22), a short
     * arc from the square of r1c9 under the 9 of r1c8 into its 7, between
     * that 9, its own head and the 3 and the empty place of 2 in r2c8
     */
    const wide: Record<string, number[]> = { GROUPED_NICE_LOOP: [7] };
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length) continue;
      const { marked, mk, shown, layout: l, sets } = boardOf(ex);
      const shapes = arrowShapes(step.links, l, marked, sets);
      const arrows = shapes.flatMap((s) => (s.kind === 'arrow' ? [s] : []));
      const at = badgePoints(shapes, l, marked, startMarkers(step.links, l, marked, shapes, sets), sets);
      for (const [i, p] of at) {
        numbers++;
        const r = (wide[tech]?.includes(i) ? SIZES.badge : SIZES.badgeLarge) * 100;
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
  const bent = (s: ArrowShape) => /[QC]/.test((s as { d: string }).d);

  it('is a quiet line with no head, straight over a mark its frame does not draw', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const between = cd(1, 5, 5);
    // the 5 of r1c5 marked by the hint (a removal, say), but no candidate of the cluster
    const [s] = arrowShapes([link(a, b, true, true)], layout, [a, b, between]);
    expect(s.kind).toBe('tie');
    expect(s.kind === 'tie' && s.d).toMatch(/ L /);
  });

  it('bends round another candidate of its cluster on its line, or of a cluster drawn before it, as an arrow does (G10)', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const between = cd(1, 5, 5);
    // one cluster: a~b, b~5r5c9, 5r5c9~5r5c5, 5r5c5~between
    const one = [link(a, b, true, true), link(b, cd(5, 9, 5), true, true), link(cd(5, 9, 5), cd(5, 5, 5), true, true), link(cd(5, 5, 5), between, true, true)];
    const marks = [a, b, between, cd(5, 9, 5), cd(5, 5, 5)];
    const [s] = arrowShapes(one, layout, marks);
    expect(s.kind).toBe('tie');
    expect(bent(s)).toBe(true);
    // clear of the 5 of r1c5 all along, and from end to end
    const line = samples((s as { d: string }).d);
    for (const p of line) expect(dist(p, layout.centre(between))).toBeGreaterThan(layout.r + SIZES.gap * 100);
    expect(dist(line[0], layout.centre(a))).toBeCloseTo(layout.r + SIZES.gap * 100, 0);
    expect(dist(line[line.length - 1], layout.centre(b))).toBeCloseTo(layout.r + SIZES.gap * 100, 0);
    // two clusters (Multi Colors): the first cluster's frame does not draw the second's candidates, the second's draws both
    const first = [link(a, b, true, true), link(between, cd(5, 5, 5), true, true)];
    expect(bent(arrowShapes(first, layout, marks)[0])).toBe(false);
    const second = [link(between, cd(5, 5, 5), true, true), link(a, b, true, true)];
    expect(bent(arrowShapes(second, layout, marks)[1])).toBe(true);
  });
});

describe('a weak tie', () => {
  it('keeps clear of the end of another weak tie, as an arrow keeps clear of another arrow\'s end', () => {
    // 5r1c5 to 5r5c5 down column 5, ending just above r5c5's 5; 2r5c1 to 2r5c9 along row 5's top places, past that end
    const down = link(cd(1, 5, 5), cd(5, 5, 5), false, true);
    const across = link(cd(5, 1, 2), cd(5, 9, 2), false, true);
    const marks = [cd(1, 5, 5), cd(5, 5, 5), cd(5, 1, 2), cd(5, 9, 2)];
    const [d, a] = arrowShapes([down, across], layout, marks).map(arrow);
    expect(d.d).toMatch(/ L /);
    expect(a.d).toMatch(/ Q /);
    // where the first ends, as the arrows reckon an end: just outside its mark, half a head further
    const end = { x: layout.centre(cd(5, 5, 5)).x, y: layout.centre(cd(5, 5, 5)).y - (SIZES.r + SIZES.gap + SIZES.headLength / 2) * 100 };
    expect(toArrow(end, a)).toBeGreaterThanOrEqual(((SIZES.headWidth / 2 + SIZES.clearance) * 100) - 0.5);
  });

  it('runs straight along a tie, which is never drawn with it, where a weak arrow would bend off it', () => {
    // the tie 5r3c1~5r3c9 and the weak tie 4r3c2-4r3c8, on one line along row 3's middle places
    const tie = link(cd(3, 1, 5), cd(3, 9, 5), true, true);
    const marks = [cd(3, 1, 5), cd(3, 9, 5), cd(3, 2, 4), cd(3, 8, 4)];
    const weak = (undirected: boolean) => link(cd(3, 2, 4), cd(3, 8, 4), false, undirected);
    expect(arrow(arrowShapes([tie, weak(true)], layout, marks)[1]).d).toMatch(/ L /);
    expect(arrow(arrowShapes([tie, weak(false)], layout, marks)[1]).d).toMatch(/ [QC] /);
  });
});

describe('what the second review of phase 3 found', () => {
  // 3D Medusa rule 6's weak tie 7r4c5-7r4c4, past the 8 of r4c4 on its
  // line, and 8r5c6-8r4c4 into that 8, the 1 of r5c5 beside it
  const marks = [cd(4, 5, 7), cd(4, 4, 7), cd(4, 4, 8), cd(5, 6, 8), cd(5, 5, 1)];
  const witnesses = (undirected: boolean) => [link(cd(4, 5, 7), cd(4, 4, 7), false, undirected), link(cd(5, 6, 8), cd(4, 4, 8), false, undirected)];

  it("ends a weak tie clearly nearer its own candidate than another mark of its cell: past the 8 of r4c4 into its 7, it comes in steeply, off the 8", () => {
    // alone, and with the other weak tie into the 8
    for (const links of [witnesses(true).slice(0, 1), witnesses(true)]) {
      const s = arrow(arrowShapes(links, layout, marks)[0]);
      expect(s.d).toMatch(/ [QC] /);
      const line = samples(s.d);
      const end = line[line.length - 1];
      expect(dist(end, layout.centre(cd(4, 4, 7)))).toBeCloseTo((SIZES.r + SIZES.gap) * 100, 0);
      // it ended 16.0 units from the 7 and 19.2 from the 8, in the gap between their rings
      expect(dist(end, layout.centre(cd(4, 4, 8)))).toBeGreaterThanOrEqual((SIZES.r + SIZES.gap + SIZES.clearance) * 100 - 0.15);
      // and is nowhere nearer the 8 than there
      for (const p of line) expect(dist(p, layout.centre(cd(4, 4, 8)))).toBeGreaterThanOrEqual((SIZES.r + SIZES.gap + SIZES.clearance) * 100 - 0.15);
    }
    // a weak tie whose ends are clear of the marks beside them stays straight: down column 5 from the 4 of r1c5, its 5 beside it
    const [down] = arrowShapes([link(cd(1, 5, 4), cd(5, 5, 4), false, true)], layout, [cd(1, 5, 4), cd(5, 5, 4), cd(1, 5, 5)]);
    expect(arrow(down).d).toMatch(/^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+$/);
  });

  it("keeps a colouring's walk number a gap off the marks, where a chain's keeps only off them: the 1 of r5c5 beside the weak tie into the 8 of r4c4", () => {
    const off = (p: Point) => Math.min(...marks.map((m) => dist(p, layout.centre(m)) - layout.r));
    const coloured = badgePoints(arrowShapes(witnesses(true), layout, marks), layout, marks);
    // it sat 29.4 units from the 1's centre: on a phone, 0.4 units off its ring
    for (const p of coloured.values()) expect(off(p)).toBeGreaterThanOrEqual((MARK.keylineSmall + SIZES.badgeLarge + SIZES.badgeGap) * 100 - 1e-9);
    // a chain's weak arrows, the same links with heads: their numbers as before, off the marks only
    const chain = [...badgePoints(arrowShapes(witnesses(false), layout, marks), layout, marks).values()];
    for (const p of chain) expect(off(p)).toBeGreaterThanOrEqual(SIZES.badgeLarge * 100 - 1e-9);
    expect(Math.min(...chain.map(off))).toBeLessThan((MARK.keylineSmall + SIZES.badgeLarge + SIZES.badgeGap) * 100);
  });
});

describe('a tie, where it meets another tie or passes a candidate of its digit', () => {
  const bent = (s: ArrowShape) => /[QC]/.test((s as { d: string }).d);
  /** the app board's layout, showing the candidates given and no other */
  const showing = (shown: CellDigit[]) => boardLayout(undefined, (x) => shown.some((o) => o.cell === x.cell && o.digit === x.digit));
  /** the way a line leaves its end nearer `at`, in degrees off the way `to` lies from `at` */
  const leaving = (line: Point[], at: Point, to: Point) => {
    const from = dist(line[0], at) <= dist(line[line.length - 1], at) ? line : [...line].reverse();
    const [u, v] = [
      { x: from[2].x - from[0].x, y: from[2].y - from[0].y },
      { x: to.x - at.x, y: to.y - at.y }
    ];
    return (Math.acos((u.x * v.x + u.y * v.y) / (Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y))) * 180) / Math.PI;
  };

  it('bends round a candidate of its digit the board shows, which it would seem to join, whether the hint marks it or not', () => {
    const a = cd(1, 1, 5);
    const b = cd(1, 9, 5);
    const between = cd(1, 5, 5);
    const tie = [link(a, b, true, true)];
    // shown and not marked, or marked by the hint (a removal its frame does not draw): round it, clear all along
    for (const marks of [
      [a, b],
      [a, b, between]
    ]) {
      const [s] = arrowShapes(tie, showing([a, b, between]), marks);
      expect(s.kind).toBe('tie');
      expect(bent(s)).toBe(true);
      for (const p of samples((s as { d: string }).d)) expect(dist(p, layout.centre(between))).toBeGreaterThan(layout.r + SIZES.gap * 100);
    }
    // another digit on its line is crossed, as an arrow crosses one; and a candidate the board does not show is no candidate
    expect(bent(arrowShapes(tie, showing([a, b, cd(1, 5, 4)]), [a, b])[0])).toBe(false);
    expect(bent(arrowShapes(tie, showing([a, b]), [a, b])[0])).toBe(false);
  });

  it('leaves an end it shares with another tie at a clear angle off that tie', () => {
    // 5r5c5 (in a cluster drawn before) lies on 5r5c1-5r5c9, which bends round it; 5r5c9-5r4c7 leaves 5r5c9
    // up and to the left, 27 degrees off the row, where the smallest arc towards the board's middle would
    // leave too, 20 degrees from it: the arc bends down instead
    const before = link(cd(5, 5, 5), cd(6, 5, 5), true, true);
    const up = link(cd(5, 9, 5), cd(4, 7, 5), true, true);
    const across = link(cd(5, 1, 5), cd(5, 9, 5), true, true);
    const marks = [cd(5, 5, 5), cd(6, 5, 5), cd(5, 9, 5), cd(4, 7, 5), cd(5, 1, 5)];
    const [, u, s] = arrowShapes([before, up, across], layout, marks);
    expect((u as { d: string }).d).toMatch(/ L /);
    expect(bent(s)).toBe(true);
    const line = samples((s as { d: string }).d);
    const at = layout.centre(cd(5, 9, 5));
    expect(leaving(line, at, layout.centre(cd(4, 7, 5)))).toBeGreaterThanOrEqual(30);
    // still clear of 5r5c5 all along
    for (const p of line) expect(dist(p, layout.centre(cd(5, 5, 5)))).toBeGreaterThan(layout.r + SIZES.gap * 100);
  });
});

describe('what the third review of phase 3 found', () => {
  /** the app board's layout, showing the candidates given and no other */
  const showing = (shown: CellDigit[]) => boardLayout(undefined, (x) => shown.some((o) => o.cell === x.cell && o.digit === x.digit));
  /** whether two lines cross further than `free` from `at` */
  const crossBeyond = (p: Point[], q: Point[], at: Point, free: number) => {
    const side = (a: Point, b: Point, c: Point) => Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
    for (let i = 1; i < p.length; i++)
      for (let j = 1; j < q.length; j++)
        if (dist(p[i - 1], at) >= free && dist(p[i], at) >= free && side(p[i - 1], p[i], q[j - 1]) * side(p[i - 1], p[i], q[j]) < 0 && side(q[j - 1], q[j], p[i - 1]) * side(q[j - 1], q[j], p[i]) < 0) return true;
    return false;
  };

  it("draws two weak ties into one candidate without crossing before it: the earlier, drawn again knowing the later, keeps its end clearly its own candidate's", () => {
    // 3D Medusa rule 4's witnesses into the 7 of r3c8: from 7r2c7, its 8 beside it, and from 7r3c7,
    // its 8 on the line; the second bends over that 8 and came into the 7 across the first
    const marks = [cd(2, 7, 7), cd(2, 7, 8), cd(3, 7, 7), cd(3, 7, 8), cd(3, 8, 7), cd(3, 8, 8)];
    const links = [link(cd(2, 7, 7), cd(3, 8, 7), false, true), link(cd(3, 7, 7), cd(3, 8, 7), false, true)];
    const l = showing(marks);
    const [p, q] = arrowShapes(links, l, marks).map((s) => samples(arrow(s).d));
    // they crossed at 35 degrees, half a cell before the 7: M 629.6 198.6 Q 644.9 264.1 710.4 279.4 and M 633.2 268.7 Q 648.0 239.0 712.1 275.1
    expect(crossBeyond(p, q, l.centre(cd(3, 8, 7)), 0.25 * 100)).toBe(false);
    // and the first still leaves the 7 of r2c7 clear of its 8, by the clearance
    expect(dist(p[0], l.centre(cd(2, 7, 8))) - dist(p[0], l.centre(cd(2, 7, 7)))).toBeGreaterThanOrEqual(SIZES.clearance * 100 - 0.15);
    expect(q[0].y).toBeLessThan(l.centre(cd(3, 7, 7)).y);
    // turning from its line no more than it must: it stays in its box, where a wide arc went round the 7 of r3c7 below
    for (const pt of p) expect([pt.x > l.bounds.x0 + 600, pt.y < l.bounds.y0 + 300]).toEqual([true, true]);
  });

  it("comes into an end boxed in by the marks of its cell from a free side, clear of every mark: under the 6 of r9c7 into the 6 of r9c8, off the 3 above it", () => {
    // a daily's 3D Medusa rule 2: the clash 6r9c3-6r9c8 along row 9, the 6 and 3 of r9c7 on its line, the 3 of
    // r9c8 above its end, the 9 of r9c5 below the row and the 9 of r8c6 above
    const marks = [cd(9, 3, 6), cd(9, 8, 6), cd(9, 8, 3), cd(9, 7, 6), cd(9, 7, 3), cd(9, 5, 1), cd(9, 5, 9), cd(8, 6, 9), cd(8, 6, 5), cd(9, 3, 1)];
    const l = showing(marks);
    const [s] = arrowShapes([link(cd(9, 3, 6), cd(9, 8, 6), false, true)], l, marks);
    const line = samples(arrow(s).d);
    const end = line[line.length - 1];
    // it ended 13.9 units from the 3's centre, on its disc, and 16.0 from the 6's
    expect(dist(end, l.centre(cd(9, 8, 3))) - dist(end, l.centre(cd(9, 8, 6)))).toBeGreaterThanOrEqual(SIZES.clearance * 100 - 0.15);
    expect(end.y).toBeGreaterThan(l.centre(cd(9, 8, 6)).y);
    for (const m of marks.slice(2)) for (const p of line) expect(dist(p, l.centre(m))).toBeGreaterThanOrEqual((SIZES.r + SIZES.clearance) * 100 - 0.5);
  });
});

describe("a group's bar and a square (docs/hint-drawing-sets.md, decisions 1, 2 and 4)", () => {
  const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
  /** a grouped chain's step: its nodes, the groups among them as sets, and its links' set ends */
  function grouped(nodes: CellDigit[][], extra: Partial<Step> = {}): Step {
    const sets = nodes.filter((n) => n.length > 1).map((n) => groupSet(n.map((x) => x.cell), n[0].digit));
    const index = nodes.map((n) => (n.length > 1 ? sets.findIndex((g) => g.members.every((m) => n.some((x) => key(x) === key(m)))) : undefined));
    return { tech: 'AIC_GROUPED', truth: 'derived', placements: [], eliminations: [], description: '', links: alternatingLinks(nodes, undefined, index), sets, ...extra } as Step;
  }
  /** a step's bars, as the board works them out, every candidate of the step's cells shown */
  function barsOf(step: Step, marks: CellDigit[] = step.links!.flatMap((l) => [...l.from, ...l.to]), shown?: Layout['shown']) {
    return setShapes(step, boardLayout(new Set(), shown), marks).bars;
  }
  /** a bar's side of its members: +1 below or to the right, -1 above or to the left */
  const sideOf = (bar: GroupBar) => {
    const m = layout.centre(bar.members[0]);
    return Math.sign(bar.a.y - m.y + bar.a.x - m.x);
  };

  it('reaches 13 along its axes and 15.5 at its corners, and an arrow ends that far out and a gap more at every angle', () => {
    expect(squareReachOf({ x: 1, y: 0 })).toBeCloseTo(13, 9);
    expect(squareReachOf({ x: 0, y: -1 })).toBeCloseTo(13, 9);
    expect(squareReachOf({ x: Math.SQRT1_2, y: Math.SQRT1_2 })).toBeCloseTo(15.49, 2);
    expect(squareReach({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }, 13, 7)).toBeCloseTo(15.49, 2);
    // a square in the middle of r5c5, joined from eight cells round it, two away
    const centre = cd(5, 5, 5);
    const l = boardLayout(new Set(), undefined, undefined, new Set([key(centre)]));
    const round = [cd(5, 8, 5), cd(2, 8, 5), cd(2, 5, 5), cd(2, 2, 5), cd(5, 2, 5), cd(8, 2, 5), cd(8, 5, 5), cd(8, 8, 5)];
    for (const other of round) {
      const into = arrow(arrowShapes([link(other, centre)], l, [other, centre])[0]);
      const out = arrow(arrowShapes([link(centre, other)], l, [other, centre])[0]);
      const c = l.centre(centre);
      const dir = (p: Point) => ({ x: (p.x - c.x) / dist(p, c), y: (p.y - c.y) / dist(p, c) });
      expect(dist(into.head[0], c), `into from ${other.cell}`).toBeCloseTo(squareReachOf(dir(into.head[0])) + SIZES.gap * 100, 5);
      expect(dist(out.tail, c), `out to ${other.cell}`).toBeCloseTo(squareReachOf(dir(out.tail)) + SIZES.gap * 100, 5);
    }
    // a start dot beside a square keeps the same gap off its corner as off a disc's rim
    const [dot] = startMarkers([link(centre, cd(5, 9, 5))], l, [centre, cd(5, 9, 5)]);
    const c = l.centre(centre);
    expect(dist(dot, c)).toBeCloseTo(squareReachOf({ x: (dot.x - c.x) / dist(dot, c), y: (dot.y - c.y) / dist(dot, c) }) + (SIZES.gap * 100) / 2 + SIZES.dotLarge * 100, 5);
  });

  it('runs a bar in the gutter beside its members, below or to the right unless the other side crosses less', () => {
    // the 5s of r5c4 and r5c5, in the middle row of their cells: below them, from the first's centre to the last's
    const middle = grouped([[cd(2, 4, 5)], [cd(5, 4, 5), cd(5, 5, 5)], [cd(5, 9, 5)]]);
    const [bar] = barsOf(middle);
    expect(bar.a).toEqual({ x: layout.centre(cd(5, 4, 5)).x, y: layout.centre(cd(5, 4, 5)).y + MARK.groupBar * 100 });
    expect(bar.b).toEqual({ x: layout.centre(cd(5, 5, 5)).x, y: layout.centre(cd(5, 5, 5)).y + MARK.groupBar * 100 });
    // a column's group to the right
    expect(sideOf(barsOf(grouped([[cd(1, 5, 5)], [cd(4, 5, 5), cd(5, 5, 5)], [cd(5, 9, 5)]]))[0])).toBe(1);
    // members in the top row of their places: below, off the edge band; in the bottom row, above
    expect(sideOf(barsOf(grouped([[cd(2, 4, 2)], [cd(5, 4, 2), cd(5, 5, 2)], [cd(5, 9, 2)]]))[0])).toBe(1);
    expect(sideOf(barsOf(grouped([[cd(2, 4, 8)], [cd(5, 4, 8), cd(5, 5, 8)], [cd(5, 9, 8)]]))[0])).toBe(-1);
    // in the right column of their places, to the left, off the box line
    expect(sideOf(barsOf(grouped([[cd(1, 6, 6)], [cd(4, 6, 6), cd(5, 6, 6)], [cd(5, 1, 6)]]))[0])).toBe(-1);
    // another mark of the hint beside the gutter below sends it above
    expect(sideOf(barsOf(middle, [...middle.links!.flatMap((l) => [...l.from, ...l.to]), cd(5, 4, 8)])[0])).toBe(-1);
    // a straight arrow of the hint through the gutter below, away from the members it is anchored at, sends it
    // above: up from the 2 of r6c5 into the 4 of r5c5, between the gutters (its mark is beside both)
    const crossed = grouped([[cd(2, 4, 5)], [cd(5, 4, 5), cd(5, 5, 5)], [cd(5, 9, 5)]]);
    crossed.links!.push({ from: [cd(6, 5, 2)], to: [cd(5, 5, 4)], strong: true });
    expect(sideOf(barsOf(crossed)[0])).toBe(-1);
    // two groups on the same cells, both in the left column of their places: the second takes the other side
    const two = grouped([[cd(1, 9, 4)], [cd(4, 1, 4), cd(5, 1, 4)], [cd(4, 1, 7), cd(5, 1, 7)], [cd(9, 1, 7)]]);
    const [first, second] = barsOf(two);
    expect([sideOf(first), sideOf(second)]).toEqual([1, -1]);
  });

  it('keeps an arrow off a bar it is not anchored at: none passes between a group\'s members', () => {
    // the 5s of r5c4 and r5c5, their bar below them; an arrow from the 3 of r4c4 down to the 1 of r6c5 would cross it, between them
    const step = grouped([[cd(2, 4, 5)], [cd(5, 4, 5), cd(5, 5, 5)], [cd(5, 9, 5)]]);
    const across = link(cd(4, 4, 3), cd(6, 5, 1));
    step.links!.push(across);
    const marks = step.links!.flatMap((l) => [...l.from, ...l.to]);
    const sets = setShapes(step, layout, marks);
    const [bar] = sets.bars;
    const near = (s: Extract<ArrowShape, { kind: 'arrow' }>) => Math.min(...samples(s.d).map((p) => toSegment(p, bar.a, bar.b)));
    const half = (MARK.groupBarStrokeTiny * 100) / 2;
    // without the bars it runs straight across, with them it bends round
    expect(near(arrow(arrowShapes(step.links!, layout, marks)[2]))).toBeLessThan(1);
    expect(near(arrow(arrowShapes(step.links!, layout, marks, sets)[2]))).toBeGreaterThan(half + (SIZES.stroke * 100) / 2);
    // and an arrow anchored at a member crosses its own bar beside that member, straight
    const down = grouped([[cd(2, 4, 5)], [cd(5, 4, 5), cd(5, 5, 5)], [cd(9, 5, 5)]]);
    const downMarks = down.links!.flatMap((l) => [...l.from, ...l.to]);
    const own = setShapes(down, layout, downMarks);
    expect(own.bars.map(sideOf)).toEqual([1]);
    expect(arrow(arrowShapes(down.links!, layout, downMarks, own)[1]).d).toMatch(/^M [\d.]+ [\d.]+ L /);
  });

  it('keeps a start dot and a walk number off a bar, as off a mark', () => {
    const half = (MARK.groupBarStrokeTiny * 100) / 2;
    // a chain that opens at the 8s of r5c4 and r5c5, in the bottom row of their places: their bar runs
    // above them, and the dot's first place, upper left of the 8 of r5c5 it starts at, is on it
    const step = grouped([[cd(5, 4, 8), cd(5, 5, 8)], [cd(5, 9, 8)], [cd(2, 9, 8)]]);
    const marks = step.links!.flatMap((l) => [...l.from, ...l.to]);
    const sets = setShapes(step, layout, marks);
    expect(sets.bars.map(sideOf)).toEqual([-1]);
    const shapes = arrowShapes(step.links!, layout, marks, sets);
    const [bare] = startMarkers(step.links!, layout, marks, shapes);
    const [dot] = startMarkers(step.links!, layout, marks, shapes, sets);
    const [bar] = sets.bars;
    expect(toSegment(bare, bar.a, bar.b)).toBeLessThan(SIZES.dotLarge * 100 + half);
    expect(toSegment(dot, bar.a, bar.b)).toBeGreaterThanOrEqual(SIZES.dotLarge * 100 + half);
    // an arrow running beside the 5s' bar, under them: its number keeps off the bar
    const beside = grouped([[cd(2, 4, 5)], [cd(5, 4, 5), cd(5, 5, 5)], [cd(5, 9, 5)]]);
    beside.links!.push(link(cd(5, 3, 7), cd(5, 6, 9)));
    const besideMarks = beside.links!.flatMap((l) => [...l.from, ...l.to]);
    const besideSets = setShapes(beside, layout, besideMarks);
    const [under] = besideSets.bars;
    expect(sideOf(under)).toBe(1);
    const along = arrowShapes(beside.links!, layout, besideMarks, besideSets);
    expect(arrow(along[2]).d).toMatch(/^M [\d.]+ [\d.]+ L /);
    const number = (withBars: boolean) => badgePoints(along, layout, besideMarks, [], withBars ? besideSets : undefined).get(2)!;
    expect(toSegment(number(false), under.a, under.b)).toBeLessThan(SIZES.badgeLarge * 100 + half);
    expect(toSegment(number(true), under.a, under.b)).toBeGreaterThanOrEqual(SIZES.badgeLarge * 100 + half);
  });

  it('is laid out exactly as before for a step with no sets: the same arrows, dots and numbers, no bar, tile or tab', () => {
    for (const [tech, ex] of Object.entries(EXAMPLES)) {
      const step = ex!.step;
      if (!step.links?.length || step.sets?.length) continue;
      const solved = (c: number) => ex!.values[c] !== '0';
      const full = frameMarks(step, null, solved);
      const marks = markedCandidates(full);
      const l = boardLayout(placedKeys(full), undefined, solved, squareKeys(step, solved));
      const sets = setShapes(step, l, marks);
      expect(sets, tech).toEqual({ bars: [], tiles: [], tabs: [] });
      const shapes = arrowShapes(step.links, l, marks);
      expect(arrowShapes(step.links, l, marks, sets), tech).toEqual(shapes);
      const dots = startMarkers(step.links, l, marks, shapes);
      expect(startMarkers(step.links, l, marks, shapes, sets), tech).toEqual(dots);
      // and the whole drawing, worked out at once, is the four calls'
      expect(hintDrawing(step, l, marks), tech).toEqual({ sets, shapes, dots, badges: badgePoints(shapes, l, marks, dots) });
    }
  });

  /**
   * every grouped chain in the repository: the stored examples, and the set
   * fixture's grouped steps at the positions it keeps (the steps on offer
   * along the hard paths and the named positions)
   */
  const corpus = (() => {
    const GROUPED: Tech[] = ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'];
    const out: { where: string; step: Step; values: string; cands: number[] }[] = GROUPED.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step, values: EXAMPLES[tech]!.values, cands: EXAMPLES[tech]!.cands }));
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    for (const section of ['paths', 'named']) {
      for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
        const tech = id.split(', ').at(-1) as Tech;
        if (!GROUPED.includes(tech)) continue;
        const g = parseGrid(d.position.puzzle)!;
        for (let i = 0; i < 81; i++) {
          g.values[i] = Number(d.position.values[i]);
          g.cands[i] = d.position.cands[i];
        }
        const step = findStep(tech, g);
        if (step?.tech === tech) out.push({ where: id, step, values: d.position.values, cands: d.position.cands });
      }
    }
    return out;
  })();

  it('crosses no arrow over a bar but beside the member it is anchored at, and puts no glyph, start dot or walk number on a bar, in any grouped chain kept (strict)', () => {
    let bars = 0;
    let pairs = 0;
    // a bar's half width and an arrow's at the widest they are drawn, a phone's under 330 CSS px: their strokes never meet
    const half = (MARK.groupBarStrokeTiny * 100) / 2;
    const apart = half + 2.5;
    const free = (SIZES.barFree + SIZES.gap) * 100 + half;
    for (const { where, step, values, cands } of corpus) {
      // the drawing as the board works it out, the sets' tabs and all
      const { full, shown, layout: l, sets, shapes, dots, badges } = boardDrawing(step, (c) => ({ value: Number(values[c]), corner: 0, center: 0 }), (c) => cands[c]);
      for (const bar of sets.bars) {
        bars++;
        const own = new Set(bar.members.map(key));
        // no candidate's glyph the board shows under it, but its members'
        for (let cell = 0; cell < 81; cell++)
          for (let digit = 1; digit <= 9; digit++) {
            const x = { cell, digit };
            if (own.has(key(x)) || !shown(x)) continue;
            const p = l.centre(x);
            const meets = Math.min(bar.a.x, bar.b.x) - half < p.x + 6.4 && Math.max(bar.a.x, bar.b.x) + half > p.x - 6.4 && Math.min(bar.a.y, bar.b.y) - half < p.y + 7 && Math.max(bar.a.y, bar.b.y) + half > p.y - 9.6;
            if (!full.cands.get(cell)?.has(digit)) expect(meets, `${where}: the ${digit} of cell ${cell} under the bar of set ${bar.set}`).toBe(false);
          }
        for (const s of shapes) {
          if (s.kind !== 'arrow') continue;
          pairs++;
          const lk = step.links![s.link];
          const shaft = samples(s.d);
          // the member the arrow is anchored at, if it is anchored in this group: the member its nearer end is at
          const ends = [shaft[0], s.head[0] ?? shaft[shaft.length - 1]];
          const anchors = [...lk.from, ...lk.to].filter((x) => own.has(key(x)));
          const anchor = anchors.length ? anchors.reduce((b, x) => (Math.min(...ends.map((p) => dist(p, l.centre(x)))) < Math.min(...ends.map((p) => dist(p, l.centre(b)))) ? x : b)) : null;
          for (let k = 0; k <= 200; k++) {
            const p = { x: bar.a.x + ((bar.b.x - bar.a.x) * k) / 200, y: bar.a.y + ((bar.b.y - bar.a.y) * k) / 200 };
            if (anchor && dist(p, l.centre(anchor)) < free) continue;
            expect(Math.min(toArrow(p, s), s.head.length ? toHead(p, s.head) : Infinity), `${where}: arrow ${s.link} and the bar of set ${bar.set}`).toBeGreaterThanOrEqual(apart);
          }
        }
        for (const p of dots) expect(toSegment(p, bar.a, bar.b), `${where}: a start dot`).toBeGreaterThanOrEqual(SIZES.dotLarge * 100 + half);
        for (const [, p] of badges) expect(toSegment(p, bar.a, bar.b), `${where}: a walk number`).toBeGreaterThanOrEqual(SIZES.badgeLarge * 100 + half);
      }
    }
    expect(corpus.length).toBeGreaterThan(50);
    expect(bars).toBeGreaterThan(70);
    expect(pairs).toBeGreaterThan(300);
  });
});

describe("an almost locked set's tiles and letter tabs (docs/hint-drawing-sets.md, decisions 4-7)", () => {
  const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
  /** an almost locked set: each cell with its candidates */
  const als = (cells: [CellDigit[], number][], letter = 'A', unit = 0): ChainSet => {
    const members = cells.flatMap(([cds]) => cds);
    return { kind: 'als', cells: cells.map(([, cell]) => cell).sort((a, b) => a - b), digits: [...new Set(members.map((x) => x.digit))].sort(), members, unit, letter };
  };
  /** a cell's candidates, as the set lists them */
  const at = (r: number, c: number, digits: number[]): [CellDigit[], number] => [digits.map((d) => cd(r, c, d)), (r - 1) * 9 + c - 1];
  const stepOf = (sets: ChainSet[], links: ChainLink[]): Step => ({ tech: 'AIC_ALS', placements: [], eliminations: [], description: '', truth: 'derived', sets, links }) as Step;
  /** a board showing only the candidates a step names */
  const boardOf = (step: Step) => {
    const named = new Set([...step.sets!.flatMap((x) => x.members), ...step.links!.flatMap((l) => [...l.from, ...l.to])].map(key));
    return boardLayout(new Set(), (x) => named.has(key(x)));
  };
  const marksOf = (step: Step) => [...new Map([...step.sets!.flatMap((x) => x.members), ...step.links!.flatMap((l) => [...l.from, ...l.to])].map((x) => [key(x), x])).values()];
  /** which candidate place of its cell a point is */
  const placeOf = (p: Point, cell: number) => [1, 2, 3, 4, 5, 6, 7, 8, 9].find((d) => dist(p, layout.centre({ cell, digit: d })) < 0.5);
  const tabHalf = (MARK.tabLarge / 2) * 100;
  const tabReach = (dir: Point) => squareReach(dir, tabHalf, MARK.tabRadius * (MARK.tabLarge / MARK.tab) * 100);
  const tabRadius = tabHalf * Math.SQRT2;

  it("draws a tile round each cell's own candidates, 15 units out, kept 6 inside its cell", () => {
    // the stored ALS-XZ: A r8c2 {159}, r9c1 {59}; B r7c8 {59}, r8c9 {19}
    const ex = EXAMPLES.ALS_XZ!;
    const { tiles } = setShapes(ex.step, layout, []);
    const corner = (r: number, c: number) => ({ x: M + (c - 1) * 100, y: M + (r - 1) * 100 });
    const tileAt = (r: number, c: number) => tiles.find((t) => t.cell === (r - 1) * 9 + c - 1)!;
    // r8c2 holds 1, 5 and 9, round the whole 3×3; r9c1 holds 5 and 9, the lower right four places
    expect(tileAt(8, 2)).toEqual({ set: 0, cell: 64, x0: corner(8, 2).x + 7, y0: corner(8, 2).y + 8, x1: corner(8, 2).x + 93, y1: corner(8, 2).y + 94 });
    expect(tileAt(9, 1)).toEqual({ set: 0, cell: 72, x0: corner(9, 1).x + 35, y0: corner(9, 1).y + 36, x1: corner(9, 1).x + 93, y1: corner(9, 1).y + 94 });
    // r8c9 holds 1 and 9, the top left and bottom right places
    expect(tileAt(8, 9)).toEqual({ set: 1, cell: 71, x0: corner(8, 9).x + 7, y0: corner(8, 9).y + 8, x1: corner(8, 9).x + 93, y1: corner(8, 9).y + 94 });
    expect(tiles.map((t) => t.cell)).toEqual([64, 72, 61, 71]);
    // a single candidate's tile, 30 across; no set, no tile
    expect(setShapes(stepOf([als([at(5, 5, [5])])], []), layout, []).tiles[0]).toMatchObject({ x0: corner(5, 5).x + 35, x1: corner(5, 5).x + 65, y0: corner(5, 5).y + 36, y1: corner(5, 5).y + 66 });
    expect(setShapes(EXAMPLES.AIC!.step, layout, [])).toEqual({ bars: [], tiles: [], tabs: [] });
  });

  it("puts a letter tab on every tile, on a place of its cell that shows no digit: inside the tile first, then beside it, the nearest first, the corners first", () => {
    const tabOf = (step: Step) => {
      const l = boardOf(step);
      const { sets } = hintDrawing(step, l, marksOf(step));
      return sets.tabs.map((t) => [t.letter, placeOf(t.p, t.cell)]);
    };
    // 4 and 6 of r5c5: the middle row, whose one free place inside the tile is 5, between them
    expect(tabOf(stepOf([als([at(5, 5, [4, 6])])], [link(cd(5, 5, 4), cd(5, 2, 4), false)]))).toEqual([['A', 5]]);
    // 1 and 2: no free place inside, so the first corner beside it, 3
    expect(tabOf(stepOf([als([at(5, 5, [1, 2])])], [link(cd(5, 5, 1), cd(9, 5, 1), false)]))).toEqual([['A', 3]]);
    // 1 and 4, the left column: beside it the nearest first, the corner 7 below the 4, not 3, two places off
    expect(tabOf(stepOf([als([at(5, 5, [1, 4])])], [link(cd(5, 5, 1), cd(5, 1, 1), false)]))).toEqual([['A', 7]]);
    // 2 and 4: inside, the corner 1 before the middle
    expect(tabOf(stepOf([als([at(5, 5, [2, 4])])], [link(cd(5, 5, 2), cd(1, 5, 2), false)]))).toEqual([['A', 1]]);
    // 1 and 9: the whole 3×3 inside, the first free corner, 3, before the side 2
    expect(tabOf(stepOf([als([at(5, 5, [1, 9])])], [link(cd(5, 5, 9), cd(9, 5, 9), false)]))).toEqual([['A', 3]]);
    // 2 and 9, the 2 placed, its outer ring reaching 18.75: the corner 3 beside it is too near, the side 6 is not
    const placed = stepOf([als([at(5, 5, [2, 9])])], [link(cd(9, 5, 9), cd(5, 5, 9), false)]);
    const ring = boardLayout(new Set([key(cd(5, 5, 2))]), boardOf(placed).shown);
    expect(hintDrawing(placed, ring, marksOf(placed)).sets.tabs.map((t) => placeOf(t.p, t.cell))).toEqual([6]);
    expect(hintDrawing(placed, boardOf(placed), marksOf(placed)).sets.tabs.map((t) => placeOf(t.p, t.cell))).toEqual([3]);
    // a set of two cells, a tab on each, lettered: r5c6 holds 2, 4 and 7, so its corner 1 is inside its tile and free
    const two = stepOf([als([at(5, 5, [2, 4]), at(5, 6, [2, 4, 7])], 'C')], [link(cd(5, 6, 7), cd(5, 9, 7), false)]);
    expect(tabOf(two)).toEqual([
      ['C', 1],
      ['C', 1]
    ]);
  });

  it('keeps a tab off the line an arrow would take without it, where a place allows, so the arrow stays straight', () => {
    // 2 and 4 of r5c5, an arrow left from the 2 along the top row of places: the corner 1 is on its line, so the middle
    const step = stepOf([als([at(5, 5, [2, 4])])], [{ ...link(cd(5, 5, 2), cd(5, 1, 2), false), fromSet: 0 }]);
    const l = boardOf(step);
    const { sets, shapes } = hintDrawing(step, l, marksOf(step));
    expect(placeOf(sets.tabs[0].p, sets.tabs[0].cell)).toBe(5);
    expect(arrow(shapes[0]).d).toMatch(/^M [\d.]+ [\d.]+ L /);
    // with the tab on the corner, the arrow bends round it
    const onLine: SetShapes = { ...sets, tabs: [{ ...sets.tabs[0], p: l.centre(cd(5, 5, 1)) }] };
    expect(arrow(arrowShapes(step.links!, l, marksOf(step), onLine)[0]).d).toMatch(/ [QC] /);
  });

  it('keeps every arrow, start dot and walk number off a tab, a disc of 18.4 round it', () => {
    const tabAt = (p: Point): SetShapes => ({ bars: [], tiles: [], tabs: [{ set: 0, cell: 40, letter: 'A', p }] });
    // an arrow straight along the middle row of r5's places, through the middle of r5c5, bends round a tab there
    const across = [link(cd(5, 3, 5), cd(5, 7, 5))];
    const marks = [cd(5, 3, 5), cd(5, 7, 5)];
    const tab = tabAt(layout.centre(cd(5, 5, 5)));
    expect(arrow(arrowShapes(across, layout, marks)[0]).d).toMatch(/^M [\d.]+ [\d.]+ L /);
    const bent = arrow(arrowShapes(across, layout, marks, tab)[0]);
    expect(Math.min(...samples(bent.d).map((p) => dist(p, tab.tabs[0].p)))).toBeGreaterThanOrEqual(tabRadius + SIZES.clearance * 100 - 0.5);
    // a walk number on an arrow down column 5, a tab 28 units beside it, far enough off the shaft to leave it
    // straight: the number moves off the tab
    const down = [link(cd(2, 5, 5), cd(8, 5, 5))];
    const downMarks = [cd(2, 5, 5), cd(8, 5, 5)];
    const number = badgePoints(arrowShapes(down, layout, downMarks), layout, downMarks).get(0)!;
    const beside = tabAt({ x: number.x - 28, y: number.y });
    const shapes = arrowShapes(down, layout, downMarks, beside);
    expect(arrow(shapes[0]).d).toMatch(/^M [\d.]+ [\d.]+ L /);
    expect(badgePoints(shapes, layout, downMarks).get(0)).toEqual(number);
    expect(dist(badgePoints(shapes, layout, downMarks, [], beside).get(0)!, beside.tabs[0].p)).toBeGreaterThanOrEqual(tabRadius + SIZES.badgeLarge * 100);
    // a start dot by the 5 of r5c5, whose first place, upper left, is on a tab at its place 1
    const from = [link(cd(5, 5, 5), cd(5, 9, 5))];
    const fromMarks = [cd(5, 5, 5), cd(5, 9, 5)];
    const corner = tabAt(layout.centre(cd(5, 5, 1)));
    const [bare] = startMarkers(from, layout, fromMarks);
    const [dot] = startMarkers(from, layout, fromMarks, arrowShapes(from, layout, fromMarks, corner), corner);
    expect(dist(bare, corner.tabs[0].p)).toBeLessThan(tabRadius + SIZES.dotLarge * 100);
    expect(dist(dot, corner.tabs[0].p)).toBeGreaterThanOrEqual(tabRadius + SIZES.dotLarge * 100);
  });

  it("draws no arrow for a link between two digits of one set, wherever they lie, and starts a chain that opens inside a set by the candidate nearest the first line drawn", () => {
    // set A in box 1: the 1s of r1c2 and r1c3, the 3 and 4 of r3c1; (1)A = (3)A - 3r3c9 = 3r9c9, its first link
    // inside A, on no shared cell
    const A = als([at(1, 2, [1, 2]), at(1, 3, [1, 2]), at(3, 1, [3, 4])], 'A', 18);
    const links: ChainLink[] = [
      { from: [cd(1, 2, 1), cd(1, 3, 1)], to: [cd(3, 1, 3)], strong: true, fromSet: 0, toSet: 0 },
      { from: [cd(3, 1, 3)], to: [cd(3, 9, 3)], strong: false, fromSet: 0 },
      link(cd(3, 9, 3), cd(9, 9, 3))
    ];
    const marks = [...A.members, cd(3, 9, 3), cd(9, 9, 3)];
    expect(insideOneCell(links[0])).toBe(false);
    const shapes = arrowShapes(links, layout, marks);
    expect(shapes.map((s) => s.kind)).toEqual(['none', 'arrow', 'arrow']);
    // the dot by the 1 of r1c3, the first node's candidate nearest the 3 of r3c9 the first line goes to, not the
    // 1 of r1c2 nearest the set's own 3
    const [dot] = startMarkers(links, layout, marks, shapes);
    expect(dot.at).toEqual(cd(1, 3, 1));
    expect(Math.floor((dot.x - M) / 100)).toBe(2);
    // a Death Blossom's branches, a weak tie from the stem into the petal and
    // the petal's lock inside it, have no reading order: no dot (decision 15)
    const P = als([at(9, 7, [2, 4])], 'A', 8);
    const blossom: ChainLink[] = [
      { from: [cd(8, 9, 2)], to: [cd(9, 7, 2)], strong: false, undirected: true, toSet: 0 },
      { from: [cd(9, 7, 2)], to: [cd(9, 7, 4)], strong: true, fromSet: 0, toSet: 0 }
    ];
    expect(arrowShapes(blossom, layout, [cd(8, 9, 2), ...P.members]).map((x) => x.kind)).toEqual(['arrow', 'none']);
    expect(startMarkers(blossom, layout, [cd(8, 9, 2), ...P.members])).toEqual([]);
    // the same lock alone after an arrow that is no weak tie starts a reading
    expect(startMarkers([{ ...blossom[0], undirected: undefined }, blossom[1]], layout, [cd(8, 9, 2), ...P.members])).toHaveLength(1);
    // an ALS pattern's chain starts at one dot; one that clashes, drawn with no truth, at none (decision 13);
    // a Death Blossom at none
    const dots: Record<string, number[]> = {};
    for (const { step: s } of corpus) {
      const kind = alsClash(s) ? 'clash' : s.tech === 'DEATH_BLOSSOM' ? 'blossom' : s.tech === 'AIC_ALS' ? null : 'clean';
      if (kind) (dots[kind] ??= []).push(hintDrawing(s, layout, s.links!.flatMap((l) => [...l.from, ...l.to])).dots.length);
    }
    expect(Object.fromEntries(Object.entries(dots).map(([k, ns]) => [k, [...new Set(ns)]]))).toEqual({ clean: [1], clash: [0], blossom: [0] });
    expect(dots.clash.length).toBe(9);
    // a step's every link inside a set, in every set step kept, draws nothing
    for (const { where, step: s } of corpus) {
      const kinds = arrowShapes(s.links!, layout, s.links!.flatMap((l) => [...l.from, ...l.to])).map((x) => x.kind);
      s.links!.forEach((l, i) => {
        if (l.fromSet !== undefined && l.fromSet === l.toSet) expect(kinds[i], `${where}: link ${i}`).toBe('none');
      });
    }
  });

  /** the almost locked set steps the repository keeps: the stored examples, and the set fixture's at the positions it keeps */
  const corpus = (() => {
    const ALS: Tech[] = ['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
    const out: { where: string; step: Step; values: string; cands: number[] }[] = ALS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step, values: EXAMPLES[tech]!.values, cands: EXAMPLES[tech]!.cands }));
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    for (const section of ['paths', 'named']) {
      for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
        const tech = id.split(', ').at(-1) as Tech;
        if (!ALS.includes(tech)) continue;
        const g = parseGrid(d.position.puzzle)!;
        for (let i = 0; i < 81; i++) {
          g.values[i] = Number(d.position.values[i]);
          g.cands[i] = d.position.cands[i];
        }
        const step = findStep(tech, g);
        if (step?.tech === tech) out.push({ where: id, step, values: d.position.values, cands: d.position.cands });
      }
    }
    return out;
  })();

  /** a set step's drawing as the board works it out */
  const drawingOf = ({ step, values, cands }: (typeof corpus)[number]) => {
    const d = boardDrawing(step, (c) => ({ value: Number(values[c]), corner: 0, center: 0 }), (c) => cands[c]);
    return { ...d, l: d.layout };
  };

  it('keeps every tile inside its cell, 3 units clear of a box line, round its cell\'s candidates only, in every set step kept', () => {
    let tiles = 0;
    for (const entry of corpus) {
      const { sets } = drawingOf(entry);
      const { step, where } = entry;
      const lettered = step.sets!.filter((x) => x.kind === 'als');
      expect(sets.tiles.length, where).toBe(lettered.reduce((n, x) => n + x.cells.length, 0));
      for (const t of sets.tiles) {
        tiles++;
        const x = M + (t.cell % 9) * 100;
        const y = M + Math.floor(t.cell / 9) * 100;
        // 6 off each side of its cell: a box line's half width (3) and 3 more
        expect(Math.min(t.x0 - x, t.y0 - y, x + 100 - t.x1, y + 100 - t.y1), `${where}: the tile on cell ${t.cell}`).toBeGreaterThanOrEqual(MARK.tileMargin * 100 - 1e-9);
        // round the centres of the cell's candidates, 15 out
        const own = step.sets![t.set].members.filter((m) => m.cell === t.cell).map((m) => layout.centre(m));
        expect(t.x0, where).toBeCloseTo(Math.min(...own.map((p) => p.x)) - 15, 9);
        expect(t.y1, where).toBeCloseTo(Math.max(...own.map((p) => p.y)) + 15, 9);
        expect(own.length, where).toBeGreaterThan(0);
      }
    }
    expect(corpus.length).toBeGreaterThan(60);
    expect(tiles).toBeGreaterThan(400);
  });

  it('puts every tab on a free place of its cell, with the room two neighbouring discs keep, at a phone\'s size, from every mark, tab, start dot, walk number and head, and every arrow clear of it, in every set step kept (strict)', () => {
    let tabs = 0;
    const keep = 2 - 1e-6;
    const gap = (p: Point, q: Point, beyond: number) => {
      const d = dist(p, q);
      return d - tabReach({ x: (q.x - p.x) / d, y: (q.y - p.y) / d }) - beyond;
    };
    const nearestOn = (p: Point, a: Point, b: Point) => {
      const ab = { x: b.x - a.x, y: b.y - a.y };
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / (ab.x * ab.x + ab.y * ab.y || 1)));
      return { x: a.x + ab.x * t, y: a.y + ab.y * t };
    };
    for (const entry of corpus) {
      const { marks, shown, l, sets, shapes, dots, badges } = drawingOf(entry);
      const { where, step } = entry;
      expect(sets.tabs.map((t) => `${t.set}:${t.cell}`), where).toEqual(sets.tiles.map((t) => `${t.set}:${t.cell}`));
      for (const tab of sets.tabs) {
        tabs++;
        const what = `${where}: the tab ${tab.letter} on cell ${tab.cell}`;
        expect(tab.letter, what).toBe(step.sets![tab.set].letter);
        const place = placeOf(tab.p, tab.cell);
        expect(place, what).toBeDefined();
        const cdAt = { cell: tab.cell, digit: place! };
        expect(shown(cdAt) || marks.some((m) => key(m) === key(cdAt)), what).toBe(false);
        for (const m of marks) {
          const p = l.centre(m);
          const d = dist(tab.p, p);
          expect(gap(tab.p, p, l.reach ? l.reach(m, { x: (tab.p.x - p.x) / d, y: (tab.p.y - p.y) / d }) : l.radiusOf!(m)), `${what} and the mark of ${key(m)}`).toBeGreaterThanOrEqual(keep);
        }
        for (const o of sets.tabs) if (o !== tab) expect(dist(tab.p, o.p) - 2 * tabReach({ x: (o.p.x - tab.p.x) / dist(tab.p, o.p), y: (o.p.y - tab.p.y) / dist(tab.p, o.p) }), what).toBeGreaterThanOrEqual(keep);
        for (const p of dots) expect(gap(tab.p, p, SIZES.dotLarge * 100), `${what} and a start dot`).toBeGreaterThanOrEqual(keep);
        for (const [, p] of badges) expect(gap(tab.p, p, SIZES.badgeLarge * 100), `${what} and a walk number`).toBeGreaterThanOrEqual(keep);
        for (const s of shapes) {
          if (s.kind !== 'arrow') continue;
          for (let k = 0; k < s.head.length; k++) expect(gap(tab.p, nearestOn(tab.p, s.head[k], s.head[(k + 1) % 3]), 0), `${what} and the head of link ${s.link}`).toBeGreaterThanOrEqual(keep);
          // the shaft, at a phone's width, never under the tab
          const line = samples(s.d);
          for (let k = 0; k + 1 < line.length; k++) expect(gap(tab.p, nearestOn(tab.p, line[k], line[k + 1]), 2.25), `${what} and link ${s.link}`).toBeGreaterThanOrEqual(keep);
        }
      }
    }
    expect(tabs).toBeGreaterThan(400);
  });

  it('draws a cell in two sets as the smaller set\'s tile and the other\'s outline dashed inside it, never three, and leaves every set a filled tile', () => {
    // the named ALS-XY-Chain whose A, the cell r7c7, lies inside D, r7c5 and r7c7
    const shared = corpus.find((x) => x.where.startsWith('shared cells that derive'))!;
    const { sets } = drawingOf(shared);
    const [A, D] = [0, 3];
    expect(shared.step.sets![A].cells).toEqual([60]);
    expect(shared.step.sets![D].cells).toEqual([58, 60]);
    const view = (drawn: number[]) => tilesIn(shared.step, sets, drawn).map((t) => [t.set, t.cell, t.inset]);
    expect(view([0, 1, 2, 3])).toEqual([
      [0, 60, 0],
      [1, 15, 0],
      [1, 17, 0],
      [2, 40, 0],
      [2, 44, 0],
      [3, 58, 0],
      [3, 60, 1]
    ]);
    // a view that draws D alone draws its own tile on r7c7
    expect(view([3])).toEqual([
      [3, 58, 0],
      [3, 60, 0]
    ]);
    // the clash: D, r4c4 and r6c4, inside A, r1c4, r4c4, r5c4 and r6c4: D's tiles there, A's outline dashed inside them
    const clash = corpus.find((x) => x.where.startsWith('shared cells that clash'))!;
    const both = tilesIn(clash.step, drawingOf(clash).sets, [0, 1, 2, 3]).filter((t) => t.set === 0 || t.set === 3);
    expect(both.map((t) => [t.set, t.cell, t.inset])).toEqual([
      [0, 3, 0],
      [0, 39, 0],
      [3, 30, 0],
      [3, 48, 0],
      [0, 30, 1],
      [0, 48, 1]
    ]);
    // every set step kept: no cell in three, every set a filled tile on some cell, the dashed one a tab of its own
    let sharing = 0;
    const crowded: string[] = [];
    for (const entry of corpus) {
      const { sets: shapes } = drawingOf(entry);
      const lettered = entry.step.sets!.flatMap((x, k) => (x.kind === 'als' ? [k] : []));
      const tiles = tilesIn(entry.step, shapes, lettered);
      for (const t of tiles) expect(t.inset, `${entry.where}: cell ${t.cell}`).toBeLessThan(2);
      // (a chain of more sets than cells cannot give each a tile of its own: an ALS-XY-Chain of four sets on three cells)
      const cells = new Set(lettered.flatMap((k) => entry.step.sets![k].cells));
      if (cells.size >= lettered.length) for (const k of lettered) expect(tiles.some((t) => t.set === k && t.inset === 0), `${entry.where}: set ${k}`).toBe(true);
      else crowded.push(entry.where);
      for (const t of tiles.filter((x) => x.inset === 1)) {
        sharing++;
        const owner = tiles.find((x) => x.cell === t.cell && x.inset === 0)!;
        const size = (k: number) => entry.step.sets![k].cells.length;
        // the smaller set's tile, of two alike the earlier's; or the tile of a set that has no other, the other set keeping one
        const own = (k: number) => tiles.filter((x) => x.set === k && x.inset === 0).length;
        if (!(size(owner.set) < size(t.set) || (size(owner.set) === size(t.set) && owner.set < t.set))) {
          expect([own(owner.set), own(t.set) > 0], `${entry.where}: cell ${t.cell}`).toEqual([1, true]);
        }
        expect(shapes.tabs.filter((x) => x.cell === t.cell).map((x) => x.set).sort(), entry.where).toEqual([owner.set, t.set].sort());
      }
    }
    expect(sharing).toBeGreaterThan(5);
    expect(crowded).toEqual(['hard 0, step 3, ALS_XY_CHAIN']);
    // where the smaller set's tile alone leaves a set none, it takes a cell from a set that keeps another:
    // A (four cells) lies in C (r7c1, r7c3) and D (three cells), so it takes r7c1 from C, which keeps r7c3
    const lent = corpus.find((x) => x.where === 'hard 1, step 3, ALS_XY_CHAIN')!;
    const filled = (drawn: number[]) => tilesIn(lent.step, drawingOf(lent).sets, drawn).filter((t) => t.inset === 0).map((t) => [t.set, t.cell]);
    expect(lent.step.sets!.map((x) => x.cells)).toEqual([[54, 56, 64, 73], [55], [54, 56], [55, 64, 73]]);
    expect(filled([0, 1, 2, 3])).toEqual([
      [0, 54],
      [1, 55],
      [2, 56],
      [3, 64],
      [3, 73]
    ]);
  });
});

describe("what the first review of phase 4 found: where the ties, the tabs and two links joined alike go", () => {
  const key = (x: CellDigit) => `${x.cell}:${x.digit}`;
  const SET_TECHS: Tech[] = ['AIC_GROUPED', 'AIC_ALS', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
  /** a step's drawing on the app's board at a position (its digits, every cell's candidates), as src/ui/Grid.tsx works it out */
  const appDrawing = (step: Step, values: string, cands: number[]) => {
    const solved = (c: number) => values[c] !== '0';
    const full = frameMarks(step, null, solved);
    const marks = markedCandidates(full);
    const shown = (x: CellDigit) => digitShown({ value: Number(values[x.cell]), corner: 0, center: 0 }, x.digit, cands[x.cell], full.cands.get(x.cell));
    const l = boardLayout(placedKeys(full), shown, solved, squareKeys(step, solved));
    return { marks, shown, solved, l, ...hintDrawing(step, l, marks) };
  };
  /** the position after `n` of the solver's steps, and the step there: the solver's own, or a technique's finder's */
  const after = (puzzle: string, n: number, tech?: Tech) => {
    const g = parseGrid(puzzle)!;
    for (let i = 0; i < n; i++) applyStep(g, findNextStep(g)!);
    const step = tech ? findStep(tech, g)! : findNextStep(g)!;
    return { step, values: Array.from(g.values).join(''), cands: Array.from(g.cands) };
  };
  /** every step of the eight set techniques the repository keeps: the stored examples, and the set fixture's at the positions it keeps */
  const kept = (() => {
    const out: { where: string; step: Step; values: string; cands: number[] }[] = SET_TECHS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step, values: EXAMPLES[tech]!.values, cands: EXAMPLES[tech]!.cands }));
    const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
    for (const section of ['paths', 'named']) {
      for (const [id, d] of Object.entries<{ position: { puzzle: string; values: string; cands: number[] } }>(fx[section])) {
        const tech = id.split(', ').at(-1) as Tech;
        const g = parseGrid(d.position.puzzle)!;
        for (let i = 0; i < 81; i++) {
          g.values[i] = Number(d.position.values[i]);
          g.cands[i] = d.position.cands[i];
        }
        const step = findStep(tech, g);
        if (step?.tech === tech) out.push({ where: id, step, values: d.position.values, cands: d.position.cands });
      }
    }
    return out.map((x) => ({ ...x, drawing: appDrawing(x.step, x.values, x.cands) }));
  })();
  const lineOf = (s: ArrowShape) => (s.kind === 'arrow' || s.kind === 'tie' ? samples(s.d) : []);
  const lengthOf = (line: Point[]) => line.reduce((n, p, k) => (k ? n + dist(p, line[k - 1]) : 0), 0);
  /** where two lines cross */
  const crossings = (p: Point[], q: Point[]) => {
    const out: Point[] = [];
    const side = (a: Point, b: Point, r: Point) => Math.sign((b.x - a.x) * (r.y - a.y) - (b.y - a.y) * (r.x - a.x));
    for (let k = 1; k < p.length; k++)
      for (let m = 1; m < q.length; m++) {
        const [a, b, c, d] = [p[k - 1], p[k], q[m - 1], q[m]];
        if (side(a, b, c) * side(a, b, d) >= 0 || side(c, d, a) * side(c, d, b) >= 0) continue;
        const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / ((b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x));
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    return out;
  };
  /**
   * whether a point of the app's board lies where a digit is cut out of the
   * lines: a solved digit's box in its cell's middle, or a pencilled
   * candidate's at its place (but the hint's marks), with the 4 units the
   * cut-out's outline adds round each
   */
  const underADigit = (p: Point, d: (typeof kept)[number]['drawing'], values: string) => {
    const [col, row] = [Math.floor((p.x - M) / 100), Math.floor((p.y - M) / 100)];
    const cell = row * 9 + col;
    const [x0, y0] = [M + col * 100, M + row * 100];
    if (values[cell] !== '0') return p.x > x0 + 30 && p.x < x0 + 70 && p.y > y0 + 25 && p.y < y0 + 75;
    return [1, 2, 3, 4, 5, 6, 7, 8, 9].some((digit) => {
      const x = { cell, digit };
      if (!d.shown(x) || d.marks.some((m) => key(m) === key(x))) return false;
      const q = d.l.centre(x);
      return Math.abs(p.x - q.x) < 6.4 + 4 && p.y > q.y - 9.6 - 4 && p.y < q.y + 7 + 4;
    });
  };

  it("runs the stored Death Blossom's 7 tie along row 8, which its two candidates share, bending only round the 7 of r8c2 between them", () => {
    // the drawing Learn opens on: 7r8c9 to 7r8c1, along the bottom row of row 8's places; the line sagged through
    // row 9, over r9c2's 2 and 3 and past the solved 7 and 9 there, 821 units long
    const ex = EXAMPLES.DEATH_BLOSSOM!;
    const d = appDrawing(ex.step, ex.values, ex.cands);
    const i = ex.step.links!.findIndex((l) => key(l.from[0]) === key(cd(8, 9, 7)) && key(l.to[0]) === key(cd(8, 1, 7)));
    const line = lineOf(d.shapes[i]);
    const bottom = d.l.centre(cd(8, 1, 7)).y;
    // in row 8 all the way, never above its middle row of places, never into row 9
    expect(Math.min(...line.map((p) => p.y))).toBeGreaterThanOrEqual(d.l.centre(cd(8, 1, 4)).y);
    expect(Math.max(...line.map((p) => p.y))).toBeLessThanOrEqual(M + 8 * 100);
    // on the row's line but in r8c1 and r8c2, where it rises over r8c2's 7, clear of it as of a mark
    expect(line.filter((p) => p.x > M + 2 * 100).every((p) => Math.abs(p.y - bottom) < 0.5)).toBe(true);
    expect(Math.min(...line.map((p) => dist(p, d.l.centre(cd(8, 2, 7)))))).toBeGreaterThanOrEqual(SIZES.r * 100 + SIZES.clearance * 100 - 0.5);
    expect(lengthOf(line)).toBeLessThan(790);
  });

  it('crosses no Death Blossom tie over another under a digit, where the cut-out hides the crossing: the stored example and every Death Blossom kept', () => {
    // the stored example's 2 tie (2r8c9 to 2r9c7) crossed its 5 tie (5r8c9 to 5r8c5) at (766, 743), in r8c8's solved 3
    let ties = 0;
    let crossed = 0;
    for (const { where, step, values, drawing } of kept.filter((x) => x.step.tech === 'DEATH_BLOSSOM')) {
      const lines = drawing.shapes.filter((s) => s.kind === 'arrow').map((s) => ({ link: s.link, line: lineOf(s) }));
      ties += lines.length;
      for (const [k, a] of lines.entries())
        for (const b of lines.slice(k + 1))
          for (const p of crossings(a.line, b.line)) {
            crossed++;
            expect(underADigit(p, drawing, values), `${where}: ties ${a.link} and ${b.link} at (${p.x.toFixed(0)}, ${p.y.toFixed(0)})`).toBe(false);
          }
    }
    expect(ties).toBeGreaterThan(15);
    expect(crossed).toBeGreaterThan(0);
  });

  it("never puts a tab nearer another set's tile than its own, nor two places off its tile where one beside it has the room", () => {
    const fromTile = (p: Point, t: { x0: number; y0: number; x1: number; y1: number }) => Math.hypot(Math.max(t.x0 - p.x, 0, p.x - t.x1), Math.max(t.y0 - p.y, 0, p.y - t.y1));
    const offOwn = (d: (typeof kept)[number]['drawing'], tab: (typeof d)['sets']['tabs'][number]) => fromTile(tab.p, d.sets.tiles.find((t) => t.set === tab.set && t.cell === tab.cell)!);
    const nearestOther = (d: (typeof kept)[number]['drawing'], tab: (typeof d)['sets']['tabs'][number]) => Math.min(...d.sets.tiles.filter((t) => t.set !== tab.set).map((t) => fromTile(tab.p, t)));
    // an ALS-XY-Chain on the solve path: C's tab on r2c1 went to the place right of the 1, two places off C's
    // tile and 16 units from B's on r2c2 (as though r2c2 were in both sets); now inside C's tile, between its 1 and 7
    const one = after('9.....71...693..2..8.4........74.6..4.......7..2.63........7.5..1..593...37.....1', 22);
    expect(one.step.tech).toBe('ALS_XY_CHAIN');
    const d1 = appDrawing(one.step, one.values, one.cands);
    const c = d1.sets.tabs.find((t) => t.letter === 'C' && t.cell === 9)!;
    expect(c.p).toEqual(d1.l.centre(cd(2, 1, 4)));
    // and D's tab on r7c9 went below its tile to the place above C's tile on r8c9; now beside its own
    const two = after('.5.....284...........3.617....9..5.292..4.........7.1...6..2...7....3.5..8.4....7', 18);
    expect(two.step.tech).toBe('ALS_XY_CHAIN');
    const d2 = appDrawing(two.step, two.values, two.cands);
    const tab = d2.sets.tabs.find((t) => t.letter === 'D' && t.cell === 62)!;
    expect(offOwn(d2, tab)).toBeLessThanOrEqual(28);
    const C = two.step.sets!.findIndex((x) => x.letter === 'C');
    expect(offOwn(d2, tab)).toBeLessThan(fromTile(tab.p, d2.sets.tiles.find((t) => t.set === C && t.cell === 71)!));
    // every set step kept: no tab nearer another set's tile than its own; and a tab two places off its tile only
    // where no place inside or beside it keeps the room from the marks, the other tabs and the heads, start dots
    // and walk numbers of the drawing without tabs
    let tabs = 0;
    const far: string[] = [];
    for (const { where, drawing: d } of kept) {
      for (const t of d.sets.tabs) {
        tabs++;
        expect(nearestOther(d, t), `${where}: the tab ${t.letter} on cell ${t.cell}`).toBeGreaterThanOrEqual(offOwn(d, t) - 1e-9);
        if (offOwn(d, t) > 28) far.push(`${where}: ${t.letter} on r${Math.floor(t.cell / 9) + 1}c${(t.cell % 9) + 1}`);
      }
    }
    expect(tabs).toBeGreaterThan(400);
    // r7c2 of the hard ALS-XY-Chains whose four sets lie on three cells: in two sets, its 8 and 9 take three
    // arrowheads and their walk numbers, and no place beside its tile has the room
    expect(far).toEqual(['hard 1, step 3, ALS_XY_CHAIN: B on r7c2', 'hard 1, step 4, ALS_XY_CHAIN: D on r7c2', 'hard 1, step 5, ALS_XY_CHAIN: D on r7c2', 'hard 1, step 6, ALS_XY_CHAIN: D on r7c2']);
  });

  it('never draws two links of a step as one line: a link between other nodes joined at the same two candidates as an earlier one is joined at two others, or drawn beside it', () => {
    // the fixture's ALS-XY-Chain whose four sets lie on three cells: 8 from A to B and 8 from C to D were both
    // drawn from 8r7c1 to 8r7c2; C's 8s are in r7c1 and r7c3, so the second now leaves from r7c3
    const lent = kept.find((x) => x.where === 'hard 1, step 3, ALS_XY_CHAIN')!;
    // whether an arrow leaves one candidate and its head points into another, a mark's radius and a gap off each
    const by = (s: ArrowShape, from: CellDigit, to: CellDigit) =>
      [dist(arrow(s).tail, lent.drawing.l.centre(from)), dist(arrow(s).head[0], lent.drawing.l.centre(to))].every((r) => r < 0.17 * 100);
    expect(by(lent.drawing.shapes[1], cd(7, 1, 8), cd(7, 2, 8))).toBe(true);
    expect(by(lent.drawing.shapes[5], cd(7, 3, 8), cd(7, 2, 8))).toBe(true);
    // a practice puzzle's ALS-XY-Chain on offer: 3r1c4 to 3r1c5 (A to B) and the 3s of r1c4 and r1c6 to 3r1c5 (C to D)
    const pool = after('.71....49.3..915......87..........24..8.......1...9738257.......8..5.39.....6....', 2, 'ALS_XY_CHAIN');
    const dp = appDrawing(pool.step, pool.values, pool.cands);
    const drawn = dp.shapes.filter((s) => s.kind === 'arrow').map((s) => (s.kind === 'arrow' ? s.d : ''));
    expect(new Set(drawn).size).toBe(drawn.length);
    // nodes whose only members are those two candidates: the two are drawn side by side, as two links between the
    // same nodes are
    const x = cd(5, 2, 4);
    const y = cd(5, 8, 4);
    const z = cd(9, 8, 4);
    const both = arrowShapes([link(x, [y, z], false), link(x, y, false)], layout, [x, y, z]).map((s) => samples(arrow(s).d));
    for (const line of both) expect(Math.abs(line[0].y - line[line.length - 1].y)).toBeLessThan(0.01);
    expect(Math.abs(both[0][0].y - both[1][0].y)).toBeCloseTo(SIZES.pair * 100, 6);
    // and in every step kept, no two links drawn on one line, nor two links between other nodes from and to the same two candidates
    for (const { where, drawing } of kept) {
      const lines = drawing.shapes.flatMap((s) => (s.kind === 'arrow' || s.kind === 'tie' ? [s.d] : []));
      expect(new Set(lines).size, where).toBe(lines.length);
    }
  });
});
