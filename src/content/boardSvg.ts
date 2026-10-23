// Draws an example position as a standalone SVG: the board, its candidates,
// and a step's highlights in the same colours the app uses for hints. Pure
// string building, so the same drawing serves the static /learn/ pages
// (written to image files at build time) and the in-app guide.
//
// The board is always drawn light: a diagram has to read the same on a dark
// page, a light page and in an image search result.
import { CellDigit, Step } from '../engine/steps';
import { tr } from '../engine/text';
import { arrowShapes, startMarkers, pointsOf, SIZES } from './hintGeometry';
import type { ArrowShape, Layout } from './hintGeometry';
import { LIGHT, MARK, fillOf } from './hintPalette';
import type { MarkKind } from './hintPalette';

export interface Example {
  puzzle: string;
  /** index of the step in the puzzle's solve path */
  stepIndex: number;
  /** the position just before the step: placed digits, 0 for empty */
  values: string;
  /** candidate bitmask of every cell in that position */
  cands: number[];
  step: Step;
  /** where the puzzle comes from, when it is a published one */
  credit?: string;
  /**
   * the position was reached only after steps harder than the technique:
   * kept for the rarest techniques, which have no cleaner example
   */
  afterHarder?: boolean;
}

const S = 60; // cell size
const L = 24; // room for the row and column labels
const M = 6; // outer margin
export const BOARD_SIZE = L + 9 * S + M;

/**
 * The colours the intuition diagrams still draw with (src/content/
 * intuitionDiagrams.ts); the example diagrams below draw with the hint
 * palette (src/content/hintPalette.ts), as the app's board does
 */
export const COLOURS = {
  primary: '#3f7fd4',
  secondary: '#d9a13c',
  fin: '#9b74d8',
  elim: '#e05563',
  place: '#3d9a45',
  link: '#a8741a'
};

export const TINTS: Record<string, string> = {
  primary: '#dfeaf9',
  secondary: '#faf0d9',
  fin: '#ece4f8',
  elim: '#fbe3e6',
  place: '#dff2e0'
};

type Kind = MarkKind | 'elimOn';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cellX = (cell: number) => L + (cell % 9) * S;
const cellY = (cell: number) => L + Math.floor(cell / 9) * S;

/** where a candidate sits inside its cell: the digit's fixed 3×3 spot */
const candX = (cd: CellDigit) => cellX(cd.cell) + (((cd.digit - 1) % 3) + 0.5) * (S / 3);
const candY = (cd: CellDigit) => cellY(cd.cell) + (Math.floor((cd.digit - 1) / 3) + 0.5) * (S / 3);

/** where the diagram draws its candidates, for the hint geometry */
const LAYOUT: Layout = {
  centre: (cd) => ({ x: candX(cd), y: candY(cd) }),
  r: SIZES.r * S,
  cell: S,
  bounds: { x0: L, y0: L, x1: L + 9 * S, y1: L + 9 * S }
};

const P = LIGHT;
const f = (n: number) => n.toFixed(1);

/** the techniques whose colours are parities a removal still carries */
const COLOURING = new Set(['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D']);

/**
 * The example as an SVG document. `title` becomes the image's accessible
 * name, so it should say what the diagram shows.
 */
export function boardSvg(example: Example, title: string): string {
  const { step } = example;
  const given = example.puzzle.split('').map((ch) => ch >= '1' && ch <= '9');
  const parts: string[] = [];

  // what is marked where, with the precedence the app's board uses
  // (docs/hint-drawing.md G5): the first kind a candidate is given wins,
  // except that a removal wins over everything and a placement over
  // everything but a removal
  const marks = new Map<string, Kind>();
  // a colouring's removal keeps the colour the step names for it
  const inside = new Map<string, Exclude<MarkKind, 'elim'>>();
  // a solved cell listed in a colour shows it on its digit
  const valueMarks = new Map<number, MarkKind>();
  const solved = (cell: number) => Number(example.values[cell]) > 0;
  const mark = (cd: CellDigit, kind: MarkKind) => {
    const key = `${cd.cell}:${cd.digit}`;
    if (solved(cd.cell)) {
      if (!valueMarks.has(cd.cell) || kind === 'elim') valueMarks.set(cd.cell, kind);
      return;
    }
    const prev = marks.get(key);
    if (!prev || kind === 'elim' || (kind === 'place' && prev !== 'elim')) marks.set(key, kind);
  };
  const has = (list: CellDigit[] | undefined, cd: CellDigit) => !!list?.some((o) => o.cell === cd.cell && o.digit === cd.digit);
  const named = (cd: CellDigit) =>
    has(step.fins, cd) ? 'fin' : has(step.secondary, cd) ? 'secondary' : has(step.primary, cd) ? 'primary' : null;
  for (const cd of step.primary ?? []) mark(cd, 'primary');
  for (const cd of step.secondary ?? []) mark(cd, 'secondary');
  for (const link of step.links ?? []) for (const cd of [...link.from, ...link.to]) mark(cd, named(cd) ?? 'primary');
  for (const cd of step.fins ?? []) mark(cd, 'fin');
  for (const cd of step.eliminations) mark(cd, 'elim');
  for (const cd of step.placements) mark(cd, 'place');
  if (COLOURING.has(step.tech)) {
    for (const cd of step.eliminations) {
      const colour = named(cd);
      if (!colour || solved(cd.cell)) continue;
      marks.set(`${cd.cell}:${cd.digit}`, 'elimOn');
      inside.set(`${cd.cell}:${cd.digit}`, colour);
    }
  }

  parts.push(`<rect x="${L}" y="${L}" width="${9 * S}" height="${9 * S}" fill="#ffffff"/>`);
  // the houses a pattern lives in (G15): a full-strength outline over a
  // barely-there fill, under everything else
  for (const { unit, role } of step.units ?? []) {
    const r =
      unit < 9
        ? { x: L, y: L + unit * S, w: 9 * S, h: S }
        : unit < 18
          ? { x: L + (unit - 9) * S, y: L, w: S, h: 9 * S }
          : { x: L + ((unit - 18) % 3) * 3 * S, y: L + Math.floor((unit - 18) / 3) * 3 * S, w: 3 * S, h: 3 * S };
    const { fill, ink } = fillOf(P, role);
    const k = S / 100;
    parts.push(
      `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" fill-opacity="${P.bandAlpha}"/>`,
      `<rect x="${f(r.x + 3.5 * k)}" y="${f(r.y + 3.5 * k)}" width="${f(r.w - 7 * k)}" height="${f(r.h - 7 * k)}" rx="${f(8 * k)}" fill="none" stroke="${ink}" stroke-width="${f(3 * k)}"${
        role === 'secondary' ? ` stroke-dasharray="${MARK.coverDash.map((d) => f(d * S)).join(' ')}"` : ''
      }/>`
    );
  }

  // row and column numbers, so a cell name such as r2c3 can be found
  for (let i = 0; i < 9; i++) {
    parts.push(
      `<text x="${L + (i + 0.5) * S}" y="${L - 8}" class="lab">${i + 1}</text>`,
      `<text x="${L - 12}" y="${L + (i + 0.5) * S + 4.5}" class="lab">${i + 1}</text>`
    );
  }

  // thin cell lines first, the thick box lines on top of them
  for (const thick of [false, true]) {
    for (let i = 0; i <= 9; i++) {
      if ((i % 3 === 0) !== thick) continue;
      const at = L + i * S;
      const line = thick ? 'stroke="#23293a" stroke-width="2.6"' : 'stroke="#b4bac8" stroke-width="1"';
      parts.push(
        `<line x1="${at}" y1="${L}" x2="${at}" y2="${L + 9 * S}" ${line}/>`,
        `<line x1="${L}" y1="${at}" x2="${L + 9 * S}" y2="${at}" ${line}/>`
      );
    }
  }

  // a hint's marks (G1-G5): a filled disc with an edge for a role, a disc
  // with an outer ring for a placement, a tinted ring with a bar over its
  // digit for a removal
  const s = S;
  for (let cell = 0; cell < 81; cell++) {
    const value = Number(example.values[cell]);
    if (value) {
      const kind = valueMarks.get(cell);
      const fill = kind ? ` fill="${kind === 'elim' ? P.elim : fillOf(P, kind).ink}"` : '';
      parts.push(
        `<text x="${cellX(cell) + S / 2}" y="${cellY(cell) + S / 2 + 12}" class="${given[cell] ? 'giv' : 'ent'}"${fill}>${value}</text>`
      );
      continue;
    }
    for (let digit = 1; digit <= 9; digit++) {
      if (!(example.cands[cell] & (1 << (digit - 1)))) continue;
      const cd = { cell, digit };
      const key = `${cell}:${digit}`;
      const kind = marks.get(key);
      const x = f(candX(cd));
      const y = f(candY(cd));
      const ty = f(candY(cd) + 4.4);
      if (!kind) {
        parts.push(`<text x="${x}" y="${ty}" class="cd">${digit}</text>`);
        continue;
      }
      if (kind === 'elim' || kind === 'elimOn') {
        const colour = inside.get(key);
        const b = MARK.bar * s;
        parts.push(
          colour
            ? `<circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="${fillOf(P, colour).fill}" stroke="${P.elim}" stroke-width="${f(MARK.ringStroke * s)}"/>`
            : `<circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="${P.elim}" fill-opacity="${P.ringTint}"/><circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="none" stroke="${P.elim}" stroke-width="${f(MARK.ringStroke * s)}"/>`,
          `<text x="${x}" y="${ty}" class="${colour ? 'mk' : 'rm'}">${digit}</text>`,
          `<line x1="${f(candX(cd) - b)}" y1="${f(candY(cd) - b)}" x2="${f(candX(cd) + b)}" y2="${f(candY(cd) + b)}" stroke="${P.elim}" stroke-width="${f(MARK.barStroke * s)}"/>`
        );
        continue;
      }
      const { fill, ink } = fillOf(P, kind);
      parts.push(
        `<circle cx="${x}" cy="${y}" r="${f((MARK.disc - MARK.edge / 2) * s)}" fill="${fill}" stroke="${ink}" stroke-width="${f(MARK.edge * s)}"/>`
      );
      if (kind === 'place') {
        parts.push(`<circle cx="${x}" cy="${y}" r="${f(MARK.placeRing * s)}" fill="none" stroke="${ink}" stroke-width="${f(MARK.placeRingStroke * s)}"/>`);
      }
      parts.push(`<text x="${x}" y="${ty}" class="mk">${digit}</text>`);
    }
  }

  // the arrows (G7-G14), over everything: straight, in the one neutral ink,
  // bent only round the hint's own marks; every halo before every line
  const marked: CellDigit[] = [...marks.keys()].map((k) => {
    const [cell, digit] = k.split(':').map(Number);
    return { cell, digit };
  });
  const shapes = arrowShapes(step.links ?? [], LAYOUT, marked);
  const w = SIZES.stroke * s;
  for (const sh of shapes) {
    if (sh.kind === 'tie') {
      parts.push(
        `<path d="${sh.d}" fill="none" stroke="#ffffff" stroke-width="${f(0.06 * s)}" stroke-linecap="round" opacity="0.5"/>`,
        `<path d="${sh.d}" fill="none" stroke="${P.arrow}" stroke-width="${f(0.02 * s)}" stroke-linecap="round" opacity="0.5"/>`
      );
    }
  }
  const arrows = shapes.filter((sh): sh is Extract<ArrowShape, { kind: 'arrow' }> => sh.kind === 'arrow');
  for (const sh of arrows) {
    parts.push(`<path d="${sh.d}" fill="none" stroke="#ffffff" stroke-width="${f(w + 0.04 * s)}" stroke-linecap="round" opacity="0.85"/>`);
    if (sh.head.length) parts.push(`<polygon points="${pointsOf(sh.head)}" fill="#ffffff" stroke="#ffffff" stroke-width="${f(0.04 * s)}" stroke-linejoin="round" opacity="0.85"/>`);
  }
  for (const sh of arrows) {
    parts.push(
      `<path d="${sh.d}" fill="none" stroke="${P.arrow}" stroke-width="${f(w)}" stroke-linecap="${sh.strong ? 'round' : 'butt'}"${
        sh.strong ? '' : ` stroke-dasharray="${f(0.08 * s)} ${f(0.06 * s)}"`
      }/>`
    );
    if (sh.head.length) parts.push(`<polygon points="${pointsOf(sh.head)}" fill="${P.arrow}"/>`);
  }
  // the first node of each branch wears a dot: reading starts here
  for (const p of startMarkers(step.links ?? [], LAYOUT)) {
    parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(0.045 * s)}" fill="${P.arrow}" stroke="#ffffff" stroke-width="${f(0.02 * s)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_SIZE} ${BOARD_SIZE}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-anchor:middle}.giv{font-size:34px;font-weight:700;fill:#1b2233}.ent{font-size:34px;font-weight:600;fill:#2f6fd0}.cd{font-size:13px;fill:#5d6577}.mk{font-size:12.5px;font-weight:700;fill:${P.onFill}}.rm{font-size:12.5px;font-weight:700;fill:${P.inRing}}.lab{font-size:12px;fill:#7a8294}</style>
<rect width="${BOARD_SIZE}" height="${BOARD_SIZE}" rx="8" fill="#f5f6fa"/>
${parts.join('\n')}
</svg>
`;
}

/**
 * Which highlight colours a step uses, for the legend under its diagram.
 * The colouring techniques name their own colours in the explanation (blue
 * and gold are the two parities there), so only the removals are listed.
 */
export function legendOf(step: Step): { colour: string; label: string }[] {
  const colouring = COLOURING.has(step.tech);
  const out: { colour: string; label: string }[] = [];
  if (step.placements.length) out.push({ colour: P.place, label: tr`place` });
  if (step.eliminations.length) out.push({ colour: P.elim, label: tr`remove` });
  if (colouring) return out;
  const banded = (role: 'primary' | 'secondary') => !!step.units?.some((u) => u.role === role);
  if (step.primary?.length || step.links?.length || banded('primary')) out.push({ colour: P.primary, label: step.labels?.primary ?? tr`the pattern` });
  if (step.secondary?.length || banded('secondary')) out.push({ colour: P.secondary, label: step.labels?.secondary ?? tr`supporting cells` });
  if (step.fins?.length) out.push({ colour: P.fin, label: step.labels?.fins ?? tr`fin` });
  return out;
}
