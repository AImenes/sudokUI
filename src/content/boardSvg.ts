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
import { hintMarks, markedCandidates, legendKinds, placedKeys, COLOURING } from './hintMarks';
import type { Role } from './hintMarks';

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

/** a short, stable name for a string (djb2) */
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cellX = (cell: number) => L + (cell % 9) * S;
const cellY = (cell: number) => L + Math.floor(cell / 9) * S;

/**
 * where a candidate sits inside its cell: the digit's fixed 3×3 spot, on
 * the app board's pitch (src/ui/boardLayout.ts), which leaves a mark at
 * the cell's edge room for a placement's ring and a start dot
 */
const candX = (cd: CellDigit) => cellX(cd.cell) + (0.22 + ((cd.digit - 1) % 3) * 0.28) * S;
const candY = (cd: CellDigit) => cellY(cd.cell) + (0.23 + Math.floor((cd.digit - 1) / 3) * 0.28) * S;

/** where the diagram draws its candidates, for the hint geometry */
const LAYOUT: Layout = {
  centre: (cd) => ({ x: candX(cd), y: candY(cd) }),
  r: SIZES.r * S,
  cell: S,
  bounds: { x0: L, y0: L, x1: L + 9 * S, y1: L + 9 * S }
};

const P = LIGHT;
const f = (n: number) => n.toFixed(1);
/**
 * The diagrams are small (a cell is about 38 CSS px on a phone, 60 on a
 * wide page), so their lines are half again as thick as the app's, which
 * keeps the removal bar and the arrows at a CSS pixel and a half or more
 * (docs/hint-drawing.md G14a)
 */
const LINE = 1.5;

/**
 * The example as an SVG document. `title` becomes the image's accessible
 * name, so it should say what the diagram shows.
 */
export function boardSvg(example: Example, title: string): string {
  const { step } = example;
  const given = example.puzzle.split('').map((ch) => ch >= '1' && ch <= '9');
  const solved = (cell: number) => Number(example.values[cell]) > 0;
  // what is marked where, as the app's board marks it (src/content/hintMarks.ts)
  const drawn = hintMarks(step, { solved });
  const s = S;
  const parts: string[] = [];

  parts.push(`<rect x="${L}" y="${L}" width="${9 * S}" height="${9 * S}" fill="#ffffff"/>`);
  // the houses a pattern lives in (G15): a full-strength outline over a
  // barely-there fill, solid for the pattern and dashed for what it acts
  // through, under everything else
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
      `<rect x="${f(r.x + 3.5 * k)}" y="${f(r.y + 3.5 * k)}" width="${f(r.w - 7 * k)}" height="${f(r.h - 7 * k)}" rx="${f(8 * k)}" fill="none" stroke="${ink}" stroke-width="${f(3 * k * LINE)}"${
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

  // a hint's marks (G1-G5), under the grid lines, the arrows and the
  // digits: a filled disc with an edge for a role, a disc with an outer
  // ring for a placement, a tinted ring for a removal; and a rounded
  // square round a solved digit the step names, a shape as well as a colour
  const texts: string[] = [];
  const bars: string[] = [];
  for (let cell = 0; cell < 81; cell++) {
    const value = Number(example.values[cell]);
    if (value) {
      const kind = drawn.values.get(cell);
      let fill = '';
      if (kind) {
        const ink = kind === 'elim' || kind === 'elimOn' ? P.elim : fillOf(P, kind === 'placeOn' ? 'place' : kind).ink;
        // a style, not an attribute, so the class's own fill cannot win
        fill = ` style="fill:${ink}"`;
        parts.push(
          `<rect x="${f(cellX(cell) + 0.09 * S)}" y="${f(cellY(cell) + 0.09 * S)}" width="${f(0.82 * S)}" height="${f(0.82 * S)}" rx="${f(0.14 * S)}" fill="none" stroke="${ink}" stroke-width="${f(0.03 * S)}"/>`
        );
      }
      texts.push(`<text x="${cellX(cell) + S / 2}" y="${cellY(cell) + S / 2 + 12}" class="${given[cell] ? 'giv' : 'ent'}"${fill}>${value}</text>`);
      continue;
    }
    for (let digit = 1; digit <= 9; digit++) {
      if (!(example.cands[cell] & (1 << (digit - 1)))) continue;
      const cd = { cell, digit };
      const kind = drawn.cands.get(cell)?.get(digit);
      const x = f(candX(cd));
      const y = f(candY(cd));
      const ty = f(candY(cd) + 4.4);
      if (!kind) {
        texts.push(`<text x="${x}" y="${ty}" class="cd">${digit}</text>`);
        continue;
      }
      if (kind === 'elim' || kind === 'elimOn') {
        const colour = drawn.inside.get(cell)?.get(digit);
        const b = MARK.bar * s;
        parts.push(
          colour
            ? `<circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="${fillOf(P, colour).fill}" stroke="${P.elim}" stroke-width="${f(MARK.ringStroke * s * LINE)}"/>`
            : `<circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="${P.elim}" fill-opacity="${P.ringTint}"/><circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="none" stroke="${P.elim}" stroke-width="${f(MARK.ringStroke * s * LINE)}"/>`
        );
        texts.push(`<text x="${x}" y="${ty}" class="${colour ? 'mk' : 'rm'}">${digit}</text>`);
        bars.push(
          `<line x1="${f(candX(cd) - b)}" y1="${f(candY(cd) - b)}" x2="${f(candX(cd) + b)}" y2="${f(candY(cd) + b)}" stroke="${P.elim}" stroke-width="${f(MARK.barStroke * s * LINE)}"/>`
        );
        continue;
      }
      // a placed chain node keeps the colour the step names for it inside the placement's ring (G5)
      const inside = kind === 'placeOn' ? drawn.inside.get(cell)?.get(digit) : undefined;
      const { fill, ink } = fillOf(P, inside ?? (kind === 'placeOn' ? 'place' : kind));
      parts.push(
        `<circle cx="${x}" cy="${y}" r="${f((MARK.disc - MARK.edge / 2) * s)}" fill="${fill}" stroke="${ink}" stroke-width="${f(MARK.edge * s)}"/>`
      );
      if (kind === 'place' || kind === 'placeOn') {
        // the ring a small board draws (G3, G14a): thick, and moved out so the gap to the disc stays
        parts.push(`<circle cx="${x}" cy="${y}" r="${f(MARK.placeRingSmall * s)}" fill="none" stroke="${P.placeInk}" stroke-width="${f(MARK.placeRingSmallStroke * s)}"/>`);
      }
      texts.push(`<text x="${x}" y="${ty}" class="mk">${digit}</text>`);
    }
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

  // the arrows (G7-G14), over the grid lines and the marks and under the
  // digits, with every digit cut out of them (the mask holds the same
  // digits, black and thickened), so a digit an arrow crosses stays whole:
  // straight, in the one neutral ink, bent only round the hint's own
  // marks; every halo first
  const marked = markedCandidates(drawn);
  const placed = placedKeys(drawn);
  const layout: Layout = {
    ...LAYOUT,
    shown: (cd) => !Number(example.values[cd.cell]) && (example.cands[cd.cell] & (1 << (cd.digit - 1))) !== 0,
    solved,
    radiusOf: (cd) => (placed.has(`${cd.cell}:${cd.digit}`) ? (MARK.placeRingSmall + MARK.placeRingSmallStroke / 2) * S : LAYOUT.r)
  };
  const shapes = arrowShapes(step.links ?? [], layout, marked);
  const w = SIZES.stroke * s * LINE;
  // the mask's name, unique to this diagram where several share a page
  const mask = `knockout-${hash(`${example.puzzle}:${example.stepIndex}:${title}`)}`;
  if (shapes.some((sh) => sh.kind !== 'none')) {
    parts.push(
      // a head is never cut: where no approach keeps it off a digit, the digit is drawn over it
      `<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${BOARD_SIZE}" height="${BOARD_SIZE}"><rect width="${BOARD_SIZE}" height="${BOARD_SIZE}" fill="#ffffff"/><g class="ko">${texts.join('')}</g>${shapes
        .map((sh) => (sh.kind === 'arrow' && sh.head.length ? `<polygon points="${pointsOf(sh.head)}" fill="#ffffff" stroke="#ffffff" stroke-width="${f(SIZES.halo * s * 2)}" stroke-linejoin="round"/>` : ''))
        .join('')}</mask>`,
      `<g mask="url(#${mask})">`
    );
  }
  for (const sh of shapes) {
    if (sh.kind === 'tie') {
      parts.push(
        `<path d="${sh.d}" fill="none" stroke="#ffffff" stroke-width="${f(0.05 * s)}" stroke-linecap="round" opacity="0.5"/>`,
        `<path d="${sh.d}" fill="none" stroke="${P.arrow}" stroke-width="${f(0.02 * s * LINE)}" stroke-linecap="round" opacity="0.5"/>`
      );
    }
  }
  const arrows = shapes.filter((sh): sh is Extract<ArrowShape, { kind: 'arrow' }> => sh.kind === 'arrow');
  for (const sh of arrows) {
    parts.push(`<path d="${sh.d}" fill="none" stroke="#ffffff" stroke-width="${f(w + SIZES.halo * s)}" stroke-linecap="round" opacity="0.75"/>`);
    if (sh.head.length) parts.push(`<polygon points="${pointsOf(sh.head)}" fill="#ffffff" stroke="#ffffff" stroke-width="${f(SIZES.halo * s)}" stroke-linejoin="round" opacity="0.75"/>`);
  }
  for (const sh of arrows) {
    parts.push(
      `<path d="${sh.d}" fill="none" stroke="${P.arrow}" stroke-width="${f(w)}" stroke-linecap="${sh.strong ? 'round' : 'butt'}"${
        sh.strong ? '' : ` stroke-dasharray="${f(0.08 * s * LINE)} ${f(0.06 * s * LINE)}"`
      }/>`
    );
    if (sh.head.length) parts.push(`<polygon points="${pointsOf(sh.head)}" fill="${P.arrow}"/>`);
  }
  if (shapes.some((sh) => sh.kind !== 'none')) parts.push('</g>');
  // the digits, then the bars over the removed ones, then the start dots,
  // at the size a small board draws them
  parts.push(...texts, ...bars);
  for (const p of startMarkers(step.links ?? [], layout, marked, shapes)) {
    parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(SIZES.dotLarge * s)}" fill="${P.arrow}" stroke="#ffffff" stroke-width="${f(0.02 * s)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_SIZE} ${BOARD_SIZE}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-anchor:middle}.giv{font-size:34px;font-weight:700;fill:#1b2233}.ent{font-size:34px;font-weight:600;fill:#2f6fd0}.cd{font-size:13px;fill:#5d6577}.mk{font-size:12.5px;font-weight:700;fill:${P.onFill}}.rm{font-size:12.5px;font-weight:700;fill:${P.inRing}}.lab{font-size:12px;fill:#7a8294}.ko text{fill:#000!important;stroke:#000;stroke-width:max(.12em,2.4px);stroke-linejoin:round}</style>
<rect width="${BOARD_SIZE}" height="${BOARD_SIZE}" rx="8" fill="#f5f6fa"/>
${parts.join('\n')}
</svg>
`;
}

/** a legend entry: the kind of mark (its swatch is drawn like the mark, src/ui/styles.css .swatch-*) and its words */
export interface LegendEntry {
  kind: 'place' | 'elim' | 'primary' | 'secondary' | 'fin';
  label: string;
  /** the mark's fill and edge on the diagram, for a swatch drawn inline */
  colour: string;
  ink: string;
  /** drawn only on solved digits, as their rounded outline */
  onValue?: boolean;
  /** drawn only as a house band */
  onBand?: boolean;
}

/**
 * What the legend under a diagram names: the kinds the diagram draws, and
 * nothing it does not (G22). A role whose every candidate was drawn as a
 * removal or a placement lends its words to that entry. The colouring
 * techniques name their own colours in the explanation (blue and gold are
 * the two parities there), so only the removals and placements are listed.
 */
export function legendOf(step: Step, values?: string): LegendEntry[] {
  const drawn = hintMarks(step, { solved: (cell) => !!values && Number(values[cell]) > 0 });
  const { shown, onValue, onBand, intoRemove, intoPlace } = legendKinds(step, drawn);
  const words = (role: Role) => (role === 'primary' ? step.labels?.primary : role === 'secondary' ? step.labels?.secondary : step.labels?.fins);
  const lent = (roles: Role[]) => roles.map(words).filter((x): x is string => !!x);
  const out: LegendEntry[] = [];
  if (shown.has('place')) out.push({ kind: 'place', label: [tr`place`, ...lent(intoPlace)].join(': '), colour: P.place, ink: P.placeInk });
  if (shown.has('elim')) out.push({ kind: 'elim', label: [tr`remove`, ...lent(intoRemove)].join(': '), colour: '#ffffff', ink: P.elim });
  if (COLOURING.has(step.tech)) return out;
  const role = (kind: Role, label: string, colour: string, ink: string) =>
    out.push({ kind, label, colour, ink, ...(onValue.has(kind) ? { onValue: true } : onBand.has(kind) ? { onBand: true } : {}) });
  if (shown.has('primary')) role('primary', step.labels?.primary ?? tr`the pattern`, P.primary, P.primaryInk);
  if (shown.has('secondary')) role('secondary', step.labels?.secondary ?? tr`supporting cells`, P.secondary, P.secondaryInk);
  if (shown.has('fin')) role('fin', step.labels?.fins ?? tr`fin`, P.fin, P.finInk);
  return out;
}

/**
 * A legend swatch drawn like its mark on the diagram (G22), on a chip of
 * the diagram's white, since the page round it may be dark: a disc with an
 * edge for a role, a disc with an outer ring for a placement, a barred ring
 * for a removal
 */
export function swatchStyle(l: LegendEntry): { background: string; border: string; boxShadow: string; borderRadius?: string; width?: string } {
  const chip = '0 0 0 1.5px #ffffff';
  // a role drawn only on solved digits: the digit's rounded outline
  if (l.onValue) return { background: '#ffffff', border: `1.5px solid ${l.ink}`, boxShadow: chip, borderRadius: '3px' };
  // a role drawn only as a house band: a small band, dashed for a cover
  if (l.onBand) {
    return {
      background: `linear-gradient(${l.colour}4d,${l.colour}4d),#ffffff`,
      border: `1.5px ${l.kind === 'secondary' ? 'dashed' : 'solid'} ${l.ink}`,
      boxShadow: chip,
      borderRadius: '2px',
      width: '16px'
    };
  }
  if (l.kind === 'elim') {
    return {
      background: `linear-gradient(45deg,transparent 40%,${l.ink} 40%,${l.ink} 60%,transparent 60%),#ffffff`,
      border: `1.5px solid ${l.ink}`,
      boxShadow: chip
    };
  }
  return {
    background: l.colour,
    border: `1px solid ${l.ink}`,
    boxShadow: l.kind === 'place' ? `${chip},0 0 0 3px ${l.ink},0 0 0 4px #ffffff` : chip
  };
}

/** the same swatch as a style attribute, for the static pages */
export const swatchCss = (l: LegendEntry): string =>
  Object.entries(swatchStyle(l))
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${v}`)
    .join(';');
