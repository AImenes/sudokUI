// Draws an example position as a standalone SVG: the board, its candidates,
// and a step's highlights in the same colours the app uses for hints. Pure
// string building, so the same drawing serves the static /learn/ pages
// (written to image files at build time) and the in-app guide.
//
// The board is always drawn light: a diagram has to read the same on a dark
// page, a light page and in an image search result.
import { CellDigit, ChainLink, Step } from '../engine/steps';

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
}

const S = 60; // cell size
const L = 24; // room for the row and column labels
const M = 6; // outer margin
export const BOARD_SIZE = L + 9 * S + M;

const COLOURS = {
  primary: '#3f7fd4',
  secondary: '#d9a13c',
  fin: '#9b74d8',
  elim: '#e05563',
  place: '#3d9a45',
  link: '#a8741a'
};

const TINTS: Record<string, string> = {
  primary: '#dfeaf9',
  secondary: '#faf0d9',
  fin: '#ece4f8',
  elim: '#fbe3e6',
  place: '#dff2e0'
};

type Kind = keyof typeof TINTS;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const cellX = (cell: number) => L + (cell % 9) * S;
const cellY = (cell: number) => L + Math.floor(cell / 9) * S;

/** where a candidate sits inside its cell: the digit's fixed 3×3 spot */
const candX = (cd: CellDigit) => cellX(cd.cell) + (((cd.digit - 1) % 3) + 0.5) * (S / 3);
const candY = (cd: CellDigit) => cellY(cd.cell) + (Math.floor((cd.digit - 1) / 3) + 0.5) * (S / 3);

const centroid = (cds: CellDigit[]) => ({
  x: cds.reduce((a, cd) => a + candX(cd), 0) / cds.length,
  y: cds.reduce((a, cd) => a + candY(cd), 0) / cds.length
});

const R = 8.6; // radius of a candidate marker

function linkPath(link: ChainLink): string {
  const a = centroid(link.from);
  const b = centroid(link.to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // start and end on the rim of the markers, not under them
  const x1 = a.x + ux * (R + 1);
  const y1 = a.y + uy * (R + 1);
  const x2 = b.x - ux * (R + 5);
  const y2 = b.y - uy * (R + 5);
  // a gentle bow keeps a link off the digits that lie straight between its
  // ends; links inside one cell bow further so they clear the cell's marks
  const bow = len < S ? 14 : Math.min(18, len * 0.08);
  const mx = (x1 + x2) / 2 - uy * bow;
  const my = (y1 + y2) / 2 + ux * bow;
  const f = (n: number) => n.toFixed(1);
  return `M${f(x1)} ${f(y1)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}`;
}

/**
 * The example as an SVG document. `title` becomes the image's accessible
 * name, so it should say what the diagram shows.
 */
export function boardSvg(example: Example, title: string): string {
  const { step } = example;
  const given = example.puzzle.split('').map((ch) => ch >= '1' && ch <= '9');
  const parts: string[] = [];

  // what is marked where; the same precedence the app's board uses
  const marks = new Map<string, Kind>();
  const tints = new Map<number, Kind>();
  const mark = (cd: CellDigit, kind: Kind, force = false) => {
    const key = `${cd.cell}:${cd.digit}`;
    if (force || !marks.has(key)) marks.set(key, kind);
    if (force || !tints.has(cd.cell)) tints.set(cd.cell, kind);
  };
  for (const cd of step.primary ?? []) mark(cd, 'primary');
  for (const cd of step.secondary ?? []) mark(cd, 'secondary');
  for (const link of step.links ?? []) for (const cd of [...link.from, ...link.to]) mark(cd, 'primary');
  for (const cd of step.fins ?? []) mark(cd, 'fin');
  for (const cd of step.eliminations) mark(cd, 'elim', true);
  for (const cd of step.placements) mark(cd, 'place', true);

  parts.push(`<rect x="${L}" y="${L}" width="${9 * S}" height="${9 * S}" fill="#ffffff"/>`);
  for (const [cell, kind] of tints) {
    parts.push(`<rect x="${cellX(cell)}" y="${cellY(cell)}" width="${S}" height="${S}" fill="${TINTS[kind]}"/>`);
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

  for (let cell = 0; cell < 81; cell++) {
    const value = Number(example.values[cell]);
    if (value) {
      parts.push(
        `<text x="${cellX(cell) + S / 2}" y="${cellY(cell) + S / 2 + 12}" class="${given[cell] ? 'giv' : 'ent'}">${value}</text>`
      );
      continue;
    }
    for (let digit = 1; digit <= 9; digit++) {
      if (!(example.cands[cell] & (1 << (digit - 1)))) continue;
      const cd = { cell, digit };
      const kind = marks.get(`${cell}:${digit}`);
      if (kind) {
        parts.push(
          `<circle cx="${candX(cd).toFixed(1)}" cy="${candY(cd).toFixed(1)}" r="${R}" fill="${COLOURS[kind as keyof typeof COLOURS]}"/>`,
          `<text x="${candX(cd).toFixed(1)}" y="${(candY(cd) + 4.4).toFixed(1)}" class="mk">${digit}</text>`
        );
      } else {
        parts.push(
          `<text x="${candX(cd).toFixed(1)}" y="${(candY(cd) + 4.4).toFixed(1)}" class="cd">${digit}</text>`
        );
      }
    }
  }

  for (const link of step.links ?? []) {
    parts.push(
      `<path d="${linkPath(link)}" fill="none" stroke="${COLOURS.link}" stroke-width="2.2" stroke-linecap="round"${
        link.strong ? '' : ' stroke-dasharray="5 4"'
      } marker-end="url(#arrow)"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOARD_SIZE} ${BOARD_SIZE}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5.5" markerHeight="5.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${COLOURS.link}"/></marker></defs>
<style>text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-anchor:middle}.giv{font-size:34px;font-weight:700;fill:#1b2233}.ent{font-size:34px;font-weight:600;fill:#2f6fd0}.cd{font-size:13px;fill:#5d6577}.mk{font-size:12.5px;font-weight:700;fill:#ffffff}.lab{font-size:12px;fill:#7a8294}</style>
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
  const colouring = step.tech === 'SIMPLE_COLORS' || step.tech === 'MULTI_COLORS' || step.tech === 'MEDUSA_3D';
  const out: { colour: string; label: string }[] = [];
  if (step.placements.length) out.push({ colour: COLOURS.place, label: 'place' });
  if (step.eliminations.length) out.push({ colour: COLOURS.elim, label: 'remove' });
  if (colouring) return out;
  if (step.primary?.length || step.links?.length) out.push({ colour: COLOURS.primary, label: 'the pattern' });
  if (step.secondary?.length) out.push({ colour: COLOURS.secondary, label: 'supporting cells' });
  if (step.fins?.length) out.push({ colour: COLOURS.fin, label: 'fin' });
  return out;
}
