// Draws an example position as a standalone SVG: the board, its candidates,
// and a step's highlights in the same colours the app uses for hints. Pure
// string building, so the same drawing serves the static /learn/ pages
// (written to image files at build time) and the in-app guide.
//
// The board is always drawn light: a diagram has to read the same on a dark
// page, a light page and in an image search result.
import { CellDigit, Step } from '../engine/steps';
import { aDigit, tr } from '../engine/text';
import { hintDrawing, tilesIn, squareReach, pointsOf, SIZES } from './hintGeometry';
import type { ArrowShape, Layout } from './hintGeometry';
import { LIGHT, MARK, fillOf } from './hintPalette';
import type { HintPalette } from './hintPalette';
import { frameMarks, markedCandidates, legendKinds, placedKeys, squareKeys, premiseOf, isParity, isShade, parityLegend, stemAlone, sharedTile } from './hintMarks';
import type { BarStyle, Premise, Role, Tint } from './hintMarks';
import type { Frame } from '../engine/hintFrames';
import { drawnLinks } from '../engine/hintFrames';

interface TruthWords {
  isTrue: string;
  isFalse: string;
  /** a TRUE group, a FALSE group, and a set's true digit of several candidates (docs/hint-drawing-sets.md, decision 18) */
  squaresOnBar: string;
  ringsOnBar: string;
  squaresInSet: string;
  refuted: string;
}

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
/** the removal bar, thinner than a ring by design, a little more: about 1.5 CSS px on a phone's 350 px diagram */
const BAR = 1.85;
/** a set tile's outline, half again as thick as the app's and a little more: 1.5 CSS px on a phone's 350 px diagram */
const TILE = 1.65;

/** a group's bar takes its members' mark's ink (docs/hint-drawing-sets.md, decisions 2 and 3) */
const BAR_INK: Record<BarStyle, string> = { oneOf: P.placeInk, false: P.false, primary: P.primaryInk, elim: P.elim };

/** an almost locked set's tint and its ink, sand, rose and violet (docs/hint-drawing-sets.md, decision 8) */
const TINT: Record<Tint, { fill: keyof HintPalette; ink: keyof HintPalette }> = {
  1: { fill: 'set1', ink: 'set1Ink' },
  2: { fill: 'set2', ink: 'set2Ink' },
  3: { fill: 'set3', ink: 'set3Ink' }
};
const tintOf = (t: Tint) => ({ fill: P[TINT[t].fill] as string, ink: P[TINT[t].ink] as string });

/**
 * The example as an SVG document. `title` becomes the image's accessible
 * name, so it should say what the diagram shows.
 */
export function boardSvg(example: Example, title: string): string {
  const { step } = example;
  const given = example.puzzle.split('').map((ch) => ch >= '1' && ch <= '9');
  const solved = (cell: number) => Number(example.values[cell]) > 0;
  // what is marked where, as the app's board marks it in full (src/content/hintMarks.ts)
  const drawn = frameMarks(step, null, solved);
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

  // where the diagram draws the hint: its marks, the placements' outer
  // rings and the squares any view draws, which reach further than a disc,
  // and the candidates it shows; the groups' bars are worked out from these
  // first, and the arrows keep off them, as on the app's board
  const marked = markedCandidates(drawn);
  const placed = placedKeys(drawn);
  const squares = squareKeys(step, solved);
  const radiusOf = (cd: CellDigit) =>
    placed.has(`${cd.cell}:${cd.digit}`)
      ? (MARK.placeRingSmall + MARK.placeRingSmallStroke / 2) * S
      : squares.has(`${cd.cell}:${cd.digit}`)
        ? squareReach({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, MARK.oneOf * S, MARK.oneOfRadius * S)
        : LAYOUT.r;
  const layout: Layout = {
    ...LAYOUT,
    shown: (cd) => !Number(example.values[cd.cell]) && (example.cands[cd.cell] & (1 << (cd.digit - 1))) !== 0,
    solved,
    radiusOf,
    ...(squares.size
      ? { reach: (cd, dir) => (squares.has(`${cd.cell}:${cd.digit}`) ? squareReach(dir, MARK.oneOf * S, MARK.oneOfRadius * S) : radiusOf(cd)) }
      : {})
  };
  // the groups' bars and the sets' tiles and tabs, then the arrows and
  // the start dots, which keep off them, as the app's board works them out
  const { sets, shapes: all, dots } = hintDrawing(step, layout, marked);
  // the almost locked sets the full view draws (docs/hint-drawing-sets.md,
  // decisions 5-8): a tile round each cell's candidates in the set's tint
  // at half strength, outlined inwards in its ink, a cell in two sets the
  // smaller set's tile and the other's outline dashed inside it; over the
  // bands, under everything else
  const tints = new Map(drawn.sets.flatMap((m) => (m.tint ? [[m.set, m.tint] as const] : [])));
  for (const tile of tilesIn(step, sets, tints.keys())) {
    const { fill, ink } = tintOf(tints.get(tile.set)!);
    const w = MARK.tileStroke * s * TILE;
    const k = tile.inset * w + w / 2;
    const rx = MARK.tileRadius * s;
    if (!tile.inset) {
      parts.push(
        `<rect class="tl" x="${f(tile.x0)}" y="${f(tile.y0)}" width="${f(tile.x1 - tile.x0)}" height="${f(tile.y1 - tile.y0)}" rx="${f(rx)}" fill="${fill}" fill-opacity="${P.setAlpha}"/>`
      );
    }
    parts.push(
      `<rect class="to" x="${f(tile.x0 + k)}" y="${f(tile.y0 + k)}" width="${f(tile.x1 - tile.x0 - 2 * k)}" height="${f(tile.y1 - tile.y0 - 2 * k)}" rx="${f(Math.max(rx - k, 0))}" fill="none" stroke="${ink}" stroke-width="${f(w)}"${
        tile.inset ? ` stroke-dasharray="${MARK.tileDash.map((d) => f(d * s)).join(' ')}"` : ''
      }/>`
    );
  }
  // the groups the full view draws, each bar in its members' mark's ink
  // (docs/hint-drawing-sets.md, decisions 2 and 3); their members' marks
  // keep a keyline in the board's colour, which parts them from the bar
  const groupBars = drawn.sets.flatMap(({ set, style }) => {
    const bar = style !== 'als' && sets.bars.find((b) => b.set === set);
    return bar ? [{ bar, style }] : [];
  });
  const onBar = new Set(groupBars.flatMap(({ bar }) => bar.members.map((cd) => `${cd.cell}:${cd.digit}`)));
  // the bars go under the marks, here, once the digits that cut them are known
  const barsAt = parts.length;

  // a hint's marks (G1-G5), under the grid lines, the arrows and the
  // digits: a filled disc with an edge for a role, a disc with an outer
  // ring for a placement, a tinted ring for a removal, a pale square for one
  // of several candidates; and a rounded square round a solved digit the
  // step names, a shape as well as a colour
  const texts: string[] = [];
  const bars: string[] = [];
  for (let cell = 0; cell < 81; cell++) {
    const value = Number(example.values[cell]);
    if (value) {
      const kind = drawn.values.get(cell);
      let fill = '';
      if (kind && kind !== 'node' && kind !== 'true' && kind !== 'false' && kind !== 'oneOf' && kind !== 'member') {
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
      if (kind === 'member') {
        // an almost locked set's member: no shape, its digit bold in the ring's ink on the set's tile (decision 10)
        texts.push(`<text x="${x}" y="${ty}" class="rm">${digit}</text>`);
        continue;
      }
      if (onBar.has(`${cell}:${digit}`)) {
        // a group's member on its bar: a keyline in the board's colour round its mark
        const k = MARK.keylineSmall * s;
        parts.push(
          kind === 'oneOf'
            ? `<rect class="kl" x="${f(candX(cd) - MARK.oneOf * s - k / 2)}" y="${f(candY(cd) - MARK.oneOf * s - k / 2)}" width="${f(2 * MARK.oneOf * s + k)}" height="${f(2 * MARK.oneOf * s + k)}" rx="${f(MARK.oneOfRadius * s + k / 2)}" fill="none" stroke="#ffffff" stroke-width="${f(k)}"/>`
            : `<circle class="kl" cx="${x}" cy="${y}" r="${f(MARK.disc * s + k / 2)}" fill="none" stroke="#ffffff" stroke-width="${f(k)}"/>`
        );
      }
      if (kind === 'oneOf') {
        // one of several candidates read as one node is true: a pale "one
        // of these" square edged inside in the true ink, never a true disc
        // (docs/hint-drawing-sets.md, decision 1); its digit in the ring's ink
        const half = MARK.oneOf * s;
        const edge = MARK.oneOfEdge * s * LINE;
        parts.push(
          `<rect class="sq" x="${f(candX(cd) - half + edge / 2)}" y="${f(candY(cd) - half + edge / 2)}" width="${f(2 * half - edge)}" height="${f(2 * half - edge)}" rx="${f(MARK.oneOfRadius * s - edge / 2)}" fill="${P.oneOf}" stroke="${P.placeInk}" stroke-width="${f(edge)}"/>`
        );
        texts.push(`<text x="${x}" y="${ty}" class="rm">${digit}</text>`);
        continue;
      }
      if (kind === 'false') {
        // a chain node the chain makes false: a ring in the false colour, faintly tinted inside
        parts.push(`<circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="${P.false}" fill-opacity="${P.ringTint}" stroke="${P.false}" stroke-width="${f(MARK.ringStroke * s * LINE)}"/>`);
        texts.push(`<text x="${x}" y="${ty}" class="rm">${digit}</text>`);
        continue;
      }
      if (kind === 'node') {
        // a chain node no colour claims: a plain ring in the arrow's ink round its digit
        parts.push(`<circle cx="${x}" cy="${y}" r="${f(MARK.ring * s)}" fill="none" stroke="${P.arrow}" stroke-width="${f(MARK.ringStroke * s * LINE)}"/>`);
        texts.push(`<text x="${x}" y="${ty}" class="rm">${digit}</text>`);
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
          `<line x1="${f(candX(cd) - b)}" y1="${f(candY(cd) - b)}" x2="${f(candX(cd) + b)}" y2="${f(candY(cd) + b)}" stroke="${P.elim}" stroke-width="${f(MARK.barStroke * s * BAR)}"/>`
        );
        continue;
      }
      // a placed chain node keeps the colour the step names for it inside the placement's ring (G5)
      const inside = kind === 'placeOn' ? drawn.inside.get(cell)?.get(digit) : undefined;
      const { fill, ink } = fillOf(P, inside ?? (kind === 'placeOn' || kind === 'true' ? 'place' : kind));
      // a colouring's shade takes the app's thin rim, so its light shade
      // keeps its fill and the diagram's small discs do not mix it into
      // the dark one
      const edge = isShade(kind) ? MARK.shadeEdge : MARK.edge;
      parts.push(
        `<circle cx="${x}" cy="${y}" r="${f((MARK.disc - edge / 2) * s)}" fill="${fill}" stroke="${ink}" stroke-width="${f(edge * s)}"/>`
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
  // marks and its groups' bars; every halo first. Worked out from every
  // link, as the app's board does, and drawn as its full view draws them:
  // a colouring's argument, without its ties
  const shown = drawnLinks(step, null);
  const shapes = all.filter((sh) => shown.has(sh.link));
  const w = SIZES.stroke * s * LINE;
  // the mask's name, unique to this diagram where several share a page
  const mask = `knockout-${hash(`${example.puzzle}:${example.stepIndex}:${title}`)}`;
  // a head is never cut: where no approach keeps it off a digit, the digit is drawn over it
  const maskEl = `<mask id="${mask}" maskUnits="userSpaceOnUse" x="0" y="0" width="${BOARD_SIZE}" height="${BOARD_SIZE}"><rect width="${BOARD_SIZE}" height="${BOARD_SIZE}" fill="#ffffff"/><g class="ko">${texts.join('')}</g>${shapes
    .map((sh) => (sh.kind === 'arrow' && sh.head.length ? `<polygon points="${pointsOf(sh.head)}" fill="#ffffff" stroke="#ffffff" stroke-width="${f(SIZES.halo * s * 2)}" stroke-linejoin="round"/>` : ''))
    .join('')}</mask>`;
  // a group's bar (docs/hint-drawing-sets.md, decision 2): a straight line
  // in the gutter beside its members, under their marks, cut out by the
  // digits as the arrows are, so the mask comes before it
  if (groupBars.length) {
    parts.splice(
      barsAt,
      0,
      maskEl,
      `<g mask="url(#${mask})">`,
      ...groupBars.map(
        ({ bar, style }) =>
          `<line class="gb" x1="${f(bar.a.x)}" y1="${f(bar.a.y)}" x2="${f(bar.b.x)}" y2="${f(bar.b.y)}" stroke="${BAR_INK[style]}" stroke-width="${f(MARK.groupBarStroke * s * LINE)}" stroke-linecap="round"/>`
      ),
      '</g>'
    );
  }
  if (shapes.some((sh) => sh.kind !== 'none')) parts.push(...(groupBars.length ? [] : [maskEl]), `<g mask="url(#${mask})">`);
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
  // a colouring's weak tie inside one cell: corner brackets round it, haloed like an arrow
  const brackets = shapes.filter((sh): sh is Extract<ArrowShape, { kind: 'cell' }> => sh.kind === 'cell');
  for (const sh of brackets) {
    parts.push(`<path d="${sh.d}" fill="none" stroke="#ffffff" stroke-width="${f(w + SIZES.halo * s)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>`);
  }
  for (const sh of arrows) {
    parts.push(
      `<path d="${sh.d}" fill="none" stroke="${P.arrow}" stroke-width="${f(w)}" stroke-linecap="${sh.strong ? 'round' : 'butt'}"${
        sh.strong ? '' : ` stroke-dasharray="${f(0.08 * s * LINE)} ${f(0.06 * s * LINE)}"`
      }/>`
    );
    if (sh.head.length) parts.push(`<polygon points="${pointsOf(sh.head)}" fill="${P.arrow}"/>`);
  }
  for (const sh of brackets) {
    parts.push(`<path d="${sh.d}" fill="none" stroke="${P.arrow}" stroke-width="${f(w)}" stroke-linecap="round" stroke-linejoin="round"/>`);
  }
  if (shapes.some((sh) => sh.kind !== 'none')) parts.push('</g>');
  // the digits, then the bars over the removed ones, then the sets' letter
  // tabs (decision 7), then the start dots, the tabs and the dots at the
  // size a small board draws them
  parts.push(...texts, ...bars);
  const scale = MARK.tabLarge / MARK.tab;
  for (const tab of sets.tabs.filter((t) => tints.has(t.set))) {
    const half = (MARK.tabLarge / 2) * s;
    const k = MARK.keyline * scale * s;
    const rx = MARK.tabRadius * scale * s;
    parts.push(
      `<rect class="tk" x="${f(tab.p.x - half - k / 2)}" y="${f(tab.p.y - half - k / 2)}" width="${f(2 * half + k)}" height="${f(2 * half + k)}" rx="${f(rx + k / 2)}" fill="none" stroke="#ffffff" stroke-width="${f(k)}"/>`,
      `<rect class="tb" x="${f(tab.p.x - half)}" y="${f(tab.p.y - half)}" width="${f(2 * half)}" height="${f(2 * half)}" rx="${f(rx)}" fill="${tintOf(tints.get(tab.set)!).ink}"/>`,
      `<text x="${f(tab.p.x)}" y="${f(tab.p.y + 0.35 * MARK.tabLetter * scale * s)}" class="tab">${esc(tab.letter)}</text>`
    );
  }
  for (const p of dots) {
    parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${f(SIZES.dotLarge * s)}" fill="${P.arrow}" stroke="#ffffff" stroke-width="${f(0.02 * s)}"/>`);
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_SIZE} ${BOARD_SIZE}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-anchor:middle}.giv{font-size:34px;font-weight:700;fill:#1b2233}.ent{font-size:34px;font-weight:600;fill:#2f6fd0}.cd{font-size:13px;fill:#5d6577}.mk{font-size:12.5px;font-weight:700;fill:${P.onFill}}.rm{font-size:12.5px;font-weight:700;fill:${P.inRing}}.lab{font-size:12px;fill:#7a8294}${sets.tabs.some((t) => tints.has(t.set)) ? `.tab{font-size:${f(MARK.tabLetter * (MARK.tabLarge / MARK.tab) * S)}px;font-weight:700;fill:#ffffff}` : ''}.ko text{fill:#000!important;stroke:#000;stroke-width:max(.12em,2.4px);stroke-linejoin:round}</style>
<rect width="${BOARD_SIZE}" height="${BOARD_SIZE}" rx="8" fill="#f5f6fa"/>
${parts.join('\n')}
</svg>
`;
}

/**
 * The legend's words for a chain's true discs and false rings, and for its
 * groups and sets drawn as shapes ("squares joined by a bar", "rings joined
 * by a bar", "squares in a set"; docs/hint-drawing-sets.md, decision 18),
 * under the premise of its first node, the one with the small start dot, a
 * group worded as a group (true: one of its candidates; false: none), a
 * digit of an almost locked set as the set's (true: the set holds it;
 * false: it holds none); and the line that says so when the drawing shows
 * that premise impossible
 */
function truthWords(p: Premise): TruthWords {
  if (p.kind === 'set') {
    const [L, a] = [p.letter, p.digit];
    return p.assumed
      ? {
          isTrue: tr`true, if set ${L} holds ${aDigit(a)} (by the small dot)`,
          isFalse: tr`false, if set ${L} holds ${aDigit(a)} (by the small dot)`,
          squaresOnBar: tr`squares joined by a bar: one of them is true, if set ${L} holds ${aDigit(a)} (by the small dot)`,
          ringsOnBar: tr`rings joined by a bar: none of them is true, if set ${L} holds ${aDigit(a)} (by the small dot)`,
          squaresInSet: tr`squares in a set: one of them is true, if set ${L} holds ${aDigit(a)} (by the small dot)`,
          refuted: tr`the chain shows that premise is impossible: set ${L} holds no ${a} (by the small dot)`
        }
      : {
          isTrue: tr`true, if set ${L} holds no ${a} (by the small dot)`,
          isFalse: tr`false, if set ${L} holds no ${a} (by the small dot)`,
          squaresOnBar: tr`squares joined by a bar: one of them is true, if set ${L} holds no ${a} (by the small dot)`,
          ringsOnBar: tr`rings joined by a bar: none of them is true, if set ${L} holds no ${a} (by the small dot)`,
          squaresInSet: tr`squares in a set: one of them is true, if set ${L} holds no ${a} (by the small dot)`,
          refuted: tr`the chain shows that premise is impossible: set ${L} holds ${aDigit(a)} (by the small dot)`
        };
  }
  if (p.kind === 'group') {
    return p.assumed
      ? {
          isTrue: tr`true, if one candidate of the first group (by the small dot) is true`,
          isFalse: tr`false, if one candidate of the first group (by the small dot) is true`,
          squaresOnBar: tr`squares joined by a bar: one of them is true, if one candidate of the first group (by the small dot) is true`,
          ringsOnBar: tr`rings joined by a bar: none of them is true, if one candidate of the first group (by the small dot) is true`,
          squaresInSet: tr`squares in a set: one of them is true, if one candidate of the first group (by the small dot) is true`,
          refuted: tr`the chain shows that premise is impossible: no candidate of the first group (by the small dot) is true`
        }
      : {
          isTrue: tr`true, if no candidate of the first group (by the small dot) is true`,
          isFalse: tr`false, if no candidate of the first group (by the small dot) is true`,
          squaresOnBar: tr`squares joined by a bar: one of them is true, if no candidate of the first group (by the small dot) is true`,
          ringsOnBar: tr`rings joined by a bar: none of them is true, if no candidate of the first group (by the small dot) is true`,
          squaresInSet: tr`squares in a set: one of them is true, if no candidate of the first group (by the small dot) is true`,
          refuted: tr`the chain shows that premise is impossible: one candidate of the first group (by the small dot) is true`
        };
  }
  return p.assumed
    ? {
        isTrue: tr`true, if the first candidate (by the small dot) is true`,
        isFalse: tr`false, if the first candidate (by the small dot) is true`,
        squaresOnBar: tr`squares joined by a bar: one of them is true, if the first candidate (by the small dot) is true`,
        ringsOnBar: tr`rings joined by a bar: none of them is true, if the first candidate (by the small dot) is true`,
        squaresInSet: tr`squares in a set: one of them is true, if the first candidate (by the small dot) is true`,
        refuted: tr`the chain shows that premise is impossible: the first candidate (by the small dot) is false`
      }
    : {
        isTrue: tr`true, if the first candidate (by the small dot) is false`,
        isFalse: tr`false, if the first candidate (by the small dot) is false`,
        squaresOnBar: tr`squares joined by a bar: one of them is true, if the first candidate (by the small dot) is false`,
        ringsOnBar: tr`rings joined by a bar: none of them is true, if the first candidate (by the small dot) is false`,
        squaresInSet: tr`squares in a set: one of them is true, if the first candidate (by the small dot) is false`,
        refuted: tr`the chain shows that premise is impossible: the first candidate (by the small dot) is true`
      };
}

/** a legend entry: the kind of mark (its swatch is drawn like the mark, src/ui/styles.css .swatch-*) and its words */
export interface LegendEntry {
  /**
   * 'note' is a line of words with no swatch; a colouring's are a
   * cluster's two shades ('pair'), its lines ('tie', 'weakTie', 'corners')
   * and the plain ring of the cell a colour would empty ('node'); a set's
   * (docs/hint-drawing-sets.md, decision 18) "one of these" squares on a
   * bar ('oneOfBar'), false rings on a bar ('falseBar'), squares in a set
   * ('oneOf') and a bar alone, in the pattern's or the removal's ink
   * ('bar'), or one in each where a view draws both ('bars'); an almost
   * locked set's lettered tile ('tile'), and a cell of two sets, one's
   * tile with the other's outline dashed inside it ('shared')
   */
  kind:
    | 'place'
    | 'elim'
    | 'true'
    | 'false'
    | 'oneOf'
    | 'oneOfBar'
    | 'falseBar'
    | 'bar'
    | 'bars'
    | 'tile'
    | 'shared'
    | 'primary'
    | 'secondary'
    | 'fin'
    | 'note'
    | 'pair'
    | 'tie'
    | 'weakTie'
    | 'corners'
    | 'node';
  label: string;
  /** the mark's fill and edge on the diagram, for a swatch drawn inline (a pair's dark shade) */
  colour: string;
  ink: string;
  /** a pair's light shade and its rim */
  light?: string;
  lightInk?: string;
  /** drawn only on solved digits, as their rounded outline */
  onValue?: boolean;
  /** drawn only as a house band */
  onBand?: boolean;
  /** a cell of two sets: the ink of the set whose outline is dashed inside the other's tile */
  dash?: string;
}

/**
 * What the legend under a diagram names (or under a walk frame, given one): the kinds the diagram draws, and
 * nothing it does not (G22). A role whose every candidate was drawn as a
 * removal or a placement lends its words to that entry. A colouring names
 * its shades, lines and proven colours as the app's legend does
 * (src/content/hintMarks.ts parityLegend).
 */
export function legendOf(step: Step, values?: string, frame: Frame | null = null): LegendEntry[] {
  const drawn = frameMarks(step, frame, (cell) => !!values && Number(values[cell]) > 0);
  if (isParity(step)) {
    return parityLegend(step, drawn).map((e): LegendEntry => {
      if (e.kind === 'pair') {
        const dark = fillOf(P, e.cluster === 1 ? 'orangeDark' : 'purpleDark');
        const light = fillOf(P, e.cluster === 1 ? 'orangeLight' : 'purpleLight');
        return { kind: 'pair', label: e.label, colour: dark.fill, ink: dark.ink, light: light.fill, lightInk: light.ink };
      }
      if (e.kind === 'true') return { kind: 'true', label: e.label, colour: P.place, ink: P.placeInk };
      if (e.kind === 'false') return { kind: 'false', label: e.label, colour: '#ffffff', ink: P.false };
      if (e.kind === 'elim') return { kind: 'elim', label: e.label, colour: '#ffffff', ink: P.elim };
      return { kind: e.kind, label: e.label, colour: '#ffffff', ink: P.arrow };
    });
  }
  const { shown, onValue, onBand, intoRemove, intoPlace, refuted, bars, setSquares, tiles, lines } = legendKinds(step, drawn);
  const words = (role: Role) => (role === 'primary' ? step.labels?.primary : role === 'secondary' ? step.labels?.secondary : step.labels?.fins);
  const lent = (roles: Role[]) => roles.map(words).filter((x): x is string => !!x);
  const out: LegendEntry[] = [];
  if (shown.has('place')) out.push({ kind: 'place', label: [tr`place`, ...lent(intoPlace)].join(': '), colour: P.place, ink: P.placeInk });
  if (shown.has('elim')) out.push({ kind: 'elim', label: [tr`remove`, ...lent(intoRemove)].join(': '), colour: '#ffffff', ink: P.elim });
  // a derived chain's truth, worded by its first node's premise
  const premise = premiseOf(step);
  if (premise) {
    const w = truthWords(premise);
    if (shown.has('true')) out.push({ kind: 'true', label: w.isTrue, colour: P.place, ink: P.placeInk });
    if (shown.has('false')) out.push({ kind: 'false', label: w.isFalse, colour: '#ffffff', ink: P.false });
    if (bars.has('oneOf')) out.push({ kind: 'oneOfBar', label: w.squaresOnBar, colour: P.oneOf, ink: P.placeInk });
    if (bars.has('false')) out.push({ kind: 'falseBar', label: w.ringsOnBar, colour: '#ffffff', ink: P.false });
    if (setSquares) out.push({ kind: 'oneOf', label: w.squaresInSet, colour: P.oneOf, ink: P.placeInk });
    // a line of words, no swatch: the premise the marks are drawn under is shown impossible
    if (refuted) out.push({ kind: 'note', label: w.refuted, colour: '', ink: '' });
  }
  const role = (kind: Role, label: string, colour: string, ink: string) =>
    out.push({ kind, label, colour, ink, ...(onValue.has(kind) ? { onValue: true } : onBand.has(kind) ? { onBand: true } : {}) });
  if (shown.has('primary')) role('primary', step.labels?.primary ?? tr`the pattern`, P.primary, P.primaryInk);
  // a Death Blossom's gold before any petal's digit is drawn: the stem's candidates alone
  if (shown.has('secondary')) role('secondary', stemAlone(step, drawn) ? tr`the stem's candidates` : (step.labels?.secondary ?? tr`supporting cells`), P.secondary, P.secondaryInk);
  if (shown.has('fin')) role('fin', step.labels?.fins ?? tr`fin`, P.fin, P.finInk);
  // a bar in the pattern's ink (a proof-only view) or the removal's: what a
  // bar is, its swatch in the ink drawn, or one bar in each where both are
  // (Grouped X-Cycles rule 3's full view: the removed start and the proof)
  if (bars.has('primary') || bars.has('elim')) {
    const label = tr`bar: a group (one digit's cells in one box and one row or column), read as one node`;
    if (bars.has('primary') && bars.has('elim')) out.push({ kind: 'bars', label, colour: P.primaryInk, ink: P.elim });
    else {
      const ink = bars.has('primary') ? P.primaryInk : P.elim;
      out.push({ kind: 'bar', label, colour: ink, ink });
    }
  }
  // an almost locked set's lettered tiles (decision 18), the swatch in the first tint drawn: a Death Blossom's are its petals
  if (tiles.length) {
    const { fill, ink } = tintOf(tiles[0]);
    const label =
      step.tech === 'DEATH_BLOSSOM'
        ? tr`lettered cells: a petal, an almost locked set for one of the stem's digits`
        : tr`lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells`;
    out.push({ kind: 'tile', label, colour: fill, ink });
  }
  // a cell of two sets drawn (decision 6): one set's tile, the other's outline dashed inside it, in their tints
  const shared = sharedTile(step, drawn);
  if (shared) {
    const [tile, dashed] = [tintOf(shared.tile), tintOf(shared.dashed)];
    out.push({ kind: 'shared', label: tr`dashed outline: a cell of two sets; each tab names one`, colour: tile.fill, ink: tile.ink, dash: dashed.ink });
  }
  // a Death Blossom's weak ties from its stem to its petals, dashed with no head (decision 15)
  if (lines.has('weakTie')) out.push({ kind: 'weakTie', label: tr`dashed line: its two ends see each other, so at most one is true`, colour: '#ffffff', ink: P.arrow });
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
  // a colouring's: a cluster's two shades side by side, rimmed as on the
  // diagram (a rim about a thirteenth of the disc's radius,
  // MARK.shadeEdge; tests/shadeRender.test.ts); a tie's line, faint as
  // drawn; a weak tie's dashes; the corner brackets; the plain ring of the
  // cell a colour would empty
  if (l.kind === 'pair') {
    const disc = (x: number, fill: string, ink: string) => `radial-gradient(circle at ${x}px 50%,${fill} 4.35px,${ink} 4.45px 4.6px,transparent 4.9px)`;
    return {
      background: `${disc(5.5, l.colour, l.ink)},${disc(16.5, l.light ?? l.colour, l.lightInk ?? l.ink)},#ffffff`,
      border: 'none',
      boxShadow: chip,
      borderRadius: '5px',
      width: '22px'
    };
  }
  if (l.kind === 'tie') {
    return { background: `linear-gradient(#ffffff 40%,${l.ink}80 40% 60%,#ffffff 60%)`, border: 'none', boxShadow: chip, borderRadius: '0', width: '18px' };
  }
  if (l.kind === 'weakTie') {
    return {
      background: `linear-gradient(#ffffff 40%,transparent 40% 60%,#ffffff 60%),repeating-linear-gradient(90deg,${l.ink} 0 4px,#ffffff 4px 7px)`,
      border: 'none',
      boxShadow: chip,
      borderRadius: '0',
      width: '18px'
    };
  }
  if (l.kind === 'corners') {
    const arm = (at: string, w: string, h: string) => `linear-gradient(${l.ink},${l.ink}) ${at}/${w} ${h} no-repeat`;
    return {
      background: [
        ...['top left', 'top right', 'bottom left', 'bottom right'].flatMap((at) => [arm(at, '4px', '1.5px'), arm(at, '1.5px', '4px')]),
        '#ffffff'
      ].join(','),
      border: 'none',
      boxShadow: chip,
      borderRadius: '0'
    };
  }
  // a set's (docs/hint-drawing-sets.md, decision 18): two "one of these"
  // squares, edged in the true ink, alone or on a bar in that ink; two
  // false rings on a bar; a bar alone, in its ink. Each square or ring keeps
  // a gap of the chip's white from the bar under it
  const square = (x: number) => [
    `linear-gradient(${l.colour},${l.colour}) ${x + 1}px 1px/5px 5px no-repeat`,
    `linear-gradient(${l.ink},${l.ink}) ${x}px 0/7px 7px no-repeat`
  ];
  const ring = (x: number) => `radial-gradient(circle at ${x + 3.5}px 3.5px,transparent 2.4px,${l.ink} 2.6px 3.4px,transparent 3.6px)`;
  const bar = `linear-gradient(${l.ink},${l.ink}) 4px 8px/12px 2px no-repeat`;
  if (l.kind === 'oneOfBar') return { background: [...square(1), ...square(11), bar, '#ffffff'].join(','), border: 'none', boxShadow: chip, borderRadius: '0', width: '20px' };
  if (l.kind === 'oneOf') return { background: [...square(1), ...square(11), '#ffffff'].join(','), border: 'none', boxShadow: chip, borderRadius: '0', width: '20px' };
  if (l.kind === 'falseBar') return { background: [ring(1), ring(11), bar, '#ffffff'].join(','), border: 'none', boxShadow: chip, borderRadius: '0', width: '20px' };
  if (l.kind === 'bar') {
    return { background: `linear-gradient(${l.ink},${l.ink}) 2px 3.5px/16px 3px no-repeat,#ffffff`, border: 'none', boxShadow: chip, borderRadius: '0', width: '20px' };
  }
  // a bar in the pattern's ink above one in the removal's
  if (l.kind === 'bars') {
    return {
      background: `linear-gradient(${l.colour},${l.colour}) 2px 1px/16px 3px no-repeat,linear-gradient(${l.ink},${l.ink}) 2px 6px/16px 3px no-repeat,#ffffff`,
      border: 'none',
      boxShadow: chip,
      borderRadius: '0',
      width: '20px'
    };
  }
  // a set's small tile, its tint at half strength over the chip's white,
  // outlined in its ink, with its tab in the corner, a keyline round it
  if (l.kind === 'tile') {
    return {
      background: `linear-gradient(${l.ink},${l.ink}) 1px 1px/4px 4px no-repeat,linear-gradient(#ffffff,#ffffff) 0 0/6px 6px no-repeat,linear-gradient(${l.colour}80,${l.colour}80),#ffffff`,
      border: `1.5px solid ${l.ink}`,
      boxShadow: chip,
      borderRadius: '3px',
      width: '14px'
    };
  }
  // a cell of two sets: the small tile of one, its outline dashed inside it in the other's ink
  if (l.kind === 'shared') {
    const dash = l.dash ?? l.ink;
    const edge = (dir: string, at: string) =>
      `repeating-linear-gradient(${dir},${dash} 0 2.5px,transparent 2.5px 4px) ${at} no-repeat`;
    return {
      background: [
        edge('90deg', '0 0/100% 1.5px'),
        edge('90deg', '0 100%/100% 1.5px'),
        edge('180deg', '0 0/1.5px 100%'),
        edge('180deg', '100% 0/1.5px 100%'),
        `linear-gradient(${l.colour}80,${l.colour}80)`,
        '#ffffff'
      ].join(','),
      border: `1.5px solid ${l.ink}`,
      boxShadow: chip,
      borderRadius: '3px',
      width: '14px'
    };
  }
  if (l.kind === 'node') return { background: '#ffffff', border: `1.5px solid ${l.ink}`, boxShadow: chip };
  if (l.kind === 'false') return { background: '#ffffff', border: `2px solid ${l.ink}`, boxShadow: chip };
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
