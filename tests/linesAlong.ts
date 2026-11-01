/**
 * Whether a hint's lines run along each other, as a player sees them
 * (docs/hint-drawing-sets.md, review round 2 of phase 4): for tests of the
 * arrows (tests/hintGeometry.test.ts) and for the walk of the set
 * techniques' finds along the pools' and the seeds' paths
 * (tests/pathDigest.ts, PATH_DIGEST=menus). Not a test file itself.
 */
import type { ArrowShape, Point } from '../src/content/hintGeometry';

/** the distance from a point to a polyline */
function toLine(p: Point, line: Point[]): number {
  let least = Infinity;
  for (let k = 1; k < line.length; k++) {
    const [a, b] = [line[k - 1], line[k]];
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const l2 = ab.x * ab.x + ab.y * ab.y || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
    least = Math.min(least, Math.hypot(p.x - a.x - ab.x * t, p.y - a.y - ab.y * t));
  }
  return least;
}

/** the share of a line's length (measured along its points) that lies within `w` of another line */
export function shareWithin(line: Point[], other: Point[], w: number): number {
  let [near, all] = [0, 0];
  for (let k = 1; k < line.length; k++) {
    const step = Math.hypot(line[k].x - line[k - 1].x, line[k].y - line[k - 1].y);
    all += step;
    if (toLine({ x: (line[k].x + line[k - 1].x) / 2, y: (line[k].y + line[k - 1].y) / 2 }, other) < w) near += step;
  }
  return all ? near / all : 0;
}

/**
 * The lines of a drawing (its arrows, shaft and head, and its ties) one of
 * which lies within `w` of another for more than `most` of its own length:
 * each such pair once, the one that lies along the other first, with the
 * share
 */
export function linesAlong(shapes: ArrowShape[], w: number, most = 0.5): { a: number; b: number; share: number }[] {
  const lines = shapes.flatMap((s) => (s.kind === 'arrow' || s.kind === 'tie' ? [{ link: s.link, line: s.trace }] : []));
  const out: { a: number; b: number; share: number }[] = [];
  for (const [i, x] of lines.entries())
    for (const y of lines.slice(i + 1)) {
      const [xy, yx] = [shareWithin(x.line, y.line, w), shareWithin(y.line, x.line, w)];
      if (Math.max(xy, yx) > most) out.push(xy >= yx ? { a: x.link, b: y.link, share: xy } : { a: y.link, b: x.link, share: yx });
    }
  return out;
}
