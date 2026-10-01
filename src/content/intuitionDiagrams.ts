// Small schematic diagrams for the Intuition guide: a few cells of a grid
// in the hint colours, each showing one idea. Drawn light, like boardSvg's
// worked examples, so they read the same on light and dark pages and as
// image files on the static site.
import { COLOURS, TINTS } from './boardSvg';
import type { DiagramId } from './intuition';

type Kind = 'primary' | 'secondary' | 'fin' | 'elim' | 'place';

/** a candidate, plain or marked in one of the hint colours */
type Cand = number | [number, Kind];

interface Cell {
  /** row and column inside the panel's own grid, from 0 */
  r: number;
  c: number;
  given?: number;
  cands?: Cand[];
  tint?: Kind;
}

interface Link {
  /** [row, column, candidate] at each end */
  from: [number, number, number];
  to: [number, number, number];
  strong: boolean;
}

interface Panel {
  rows: number;
  cols: number;
  /** grid position of the panel's first row and column, for box lines */
  row0?: number;
  col0?: number;
  /** thick lines on box boundaries; off for a list that is not a grid */
  boxes?: boolean;
  rowLabels?: string[];
  colLabels?: string[];
  heading?: string;
  cells: Cell[];
  links?: Link[];
}

const S = 56; // cell size
const R = 8.2; // candidate marker radius
const GAP = 34;
const PAD = 10;

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const range = (n: number, from = 1) => Array.from({ length: n }, (_, i) => String(i + from));

function panelSize(p: Panel) {
  const rowLabels = p.rowLabels ?? range(p.rows, (p.row0 ?? 0) + 1);
  const labelW = Math.max(...rowLabels.map((l) => l.length)) * 7 + 12;
  const top = (p.heading ? 26 : 0) + 20;
  // a heading may be wider than a narrow panel: about 7.6px a character at 13.5px
  const headingW = p.heading ? p.heading.length * 7.6 : 0;
  return { labelW, top, w: Math.max(labelW + p.cols * S, headingW), h: top + p.rows * S };
}

function drawPanel(p: Panel, ox: number, oy: number): string[] {
  const { labelW, top } = panelSize(p);
  const x0 = ox + labelW;
  const y0 = oy + top;
  const out: string[] = [];
  const cx = (c: number) => x0 + c * S;
  const cy = (r: number) => y0 + r * S;
  const candXY = (r: number, c: number, d: number) => ({
    x: cx(c) + (((d - 1) % 3) + 0.5) * (S / 3),
    y: cy(r) + (Math.floor((d - 1) / 3) + 0.5) * (S / 3)
  });

  if (p.heading) out.push(`<text x="${ox}" y="${oy + 16}" class="hd">${esc(p.heading)}</text>`);
  out.push(`<rect x="${x0}" y="${y0}" width="${p.cols * S}" height="${p.rows * S}" fill="#ffffff"/>`);
  for (const cell of p.cells) {
    if (cell.tint) {
      out.push(`<rect x="${cx(cell.c)}" y="${cy(cell.r)}" width="${S}" height="${S}" fill="${TINTS[cell.tint]}"/>`);
    }
  }

  const rowLabels = p.rowLabels ?? range(p.rows, (p.row0 ?? 0) + 1);
  const colLabels = p.colLabels ?? range(p.cols, (p.col0 ?? 0) + 1);
  rowLabels.forEach((l, i) =>
    out.push(`<text x="${x0 - 8}" y="${cy(i) + S / 2 + 4}" class="lab lr">${esc(l)}</text>`)
  );
  colLabels.forEach((l, i) => out.push(`<text x="${cx(i) + S / 2}" y="${y0 - 7}" class="lab">${esc(l)}</text>`));

  // thin cell lines, then thick box lines and the outer border on top
  const boxes = p.boxes ?? true;
  const thickCol = (i: number) => i === 0 || i === p.cols || (boxes && ((p.col0 ?? 0) + i) % 3 === 0);
  const thickRow = (i: number) => i === 0 || i === p.rows || (boxes && ((p.row0 ?? 0) + i) % 3 === 0);
  for (const thick of [false, true]) {
    for (let i = 0; i <= p.cols; i++) {
      if (thickCol(i) !== thick) continue;
      out.push(`<line x1="${cx(i)}" y1="${y0}" x2="${cx(i)}" y2="${y0 + p.rows * S}" ${thick ? 'class="tk"' : 'class="tn"'}/>`);
    }
    for (let i = 0; i <= p.rows; i++) {
      if (thickRow(i) !== thick) continue;
      out.push(`<line x1="${x0}" y1="${cy(i)}" x2="${x0 + p.cols * S}" y2="${cy(i)}" ${thick ? 'class="tk"' : 'class="tn"'}/>`);
    }
  }

  for (const cell of p.cells) {
    if (cell.given) {
      out.push(`<text x="${cx(cell.c) + S / 2}" y="${cy(cell.r) + S / 2 + 10}" class="giv">${cell.given}</text>`);
      continue;
    }
    for (const cand of cell.cands ?? []) {
      const [d, kind] = typeof cand === 'number' ? [cand, undefined] : cand;
      const { x, y } = candXY(cell.r, cell.c, d);
      if (kind) {
        out.push(
          `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}" fill="${COLOURS[kind]}"/>`,
          `<text x="${x.toFixed(1)}" y="${(y + 4.2).toFixed(1)}" class="mk">${d}</text>`
        );
      } else {
        out.push(`<text x="${x.toFixed(1)}" y="${(y + 4.2).toFixed(1)}" class="cd">${d}</text>`);
      }
    }
  }

  for (const link of p.links ?? []) {
    const a = candXY(...link.from);
    const b = candXY(...link.to);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const x1 = a.x + ux * (R + 2);
    const y1 = a.y + uy * (R + 2);
    const x2 = b.x - ux * (R + 2);
    const y2 = b.y - uy * (R + 2);
    const bow = Math.min(16, len * 0.08);
    const mx = (x1 + x2) / 2 - uy * bow;
    const my = (y1 + y2) / 2 + ux * bow;
    out.push(
      `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${COLOURS.link}" stroke-width="2.4" stroke-linecap="round"${link.strong ? '' : ' stroke-dasharray="5 4"'}/>`
    );
  }
  return out;
}

function compose(panels: Panel[], layout: 'row' | 'column', title: string): string {
  const sizes = panels.map(panelSize);
  const w =
    layout === 'row'
      ? sizes.reduce((a, s) => a + s.w, 0) + GAP * (panels.length - 1)
      : Math.max(...sizes.map((s) => s.w));
  const h =
    layout === 'row'
      ? Math.max(...sizes.map((s) => s.h))
      : sizes.reduce((a, s) => a + s.h, 0) + GAP * (panels.length - 1);
  const parts: string[] = [];
  let at = PAD;
  panels.forEach((p, i) => {
    parts.push(...(layout === 'row' ? drawPanel(p, at, PAD) : drawPanel(p, PAD, at)));
    at += (layout === 'row' ? sizes[i].w : sizes[i].h) + GAP;
  });
  const W = w + PAD * 2;
  const H = h + PAD * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>text{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-anchor:middle}.giv{font-size:28px;font-weight:700;fill:#1b2233}.cd{font-size:12.5px;fill:#5d6577}.mk{font-size:12px;font-weight:700;fill:#ffffff}.lab{font-size:12px;fill:#7a8294}.lr{text-anchor:end}.hd{font-size:13.5px;font-weight:600;fill:#1b2233;text-anchor:start}.tn{stroke:#b4bac8;stroke-width:1}.tk{stroke:#23293a;stroke-width:2.4}</style>
<rect width="${W}" height="${H}" rx="8" fill="#f5f6fa"/>
${parts.join('\n')}
</svg>
`;
}

// ---- the diagrams --------------------------------------------------------

/** where 5 can go, row by row: columns, from 1; rows 2 and 7 are the X-Wing */
const FIVES: number[][] = [[1, 3, 6], [3, 8], [5, 7, 8], [2, 3, 9], [4, 6], [1, 8, 9], [3, 8], [2, 5, 7], [4, 6, 9]];
const XW_ROWS = [1, 6];
const XW_COLS = [3, 8];
const fiveKind = (row: number, col: number): Kind | undefined =>
  XW_COLS.includes(col) ? (XW_ROWS.includes(row) ? 'primary' : 'elim') : undefined;

function fishSideways(): string {
  const grid: Panel = {
    rows: 9,
    cols: 9,
    heading: 'Where 5 can go',
    cells: FIVES.flatMap((cols, r) =>
      cols.map((col) => {
        const kind = fiveKind(r, col);
        return { r, c: col - 1, cands: [kind ? ([5, kind] as Cand) : 5] };
      })
    )
  };
  const list: Panel = {
    rows: 9,
    cols: 1,
    boxes: false,
    heading: 'The same, by row',
    rowLabels: range(9).map((n) => `row ${n}`),
    colLabels: ['columns'],
    cells: FIVES.map((cols, r) => ({
      r,
      c: 0,
      tint: XW_ROWS.includes(r) ? 'primary' : undefined,
      cands: cols.map((col) => {
        const kind = fiveKind(r, col);
        return kind ? ([col, kind] as Cand) : col;
      })
    }))
  };
  return compose([grid, list], 'row', 'An X-Wing on 5, and the same 5s listed by row as a naked pair');
}

function nakedHidden(): string {
  const P = 'primary';
  const G = 'secondary';
  const X = 'elim';
  const row: Panel = {
    rows: 1,
    cols: 9,
    rowLabels: ['row'],
    cells: [
      { r: 0, c: 0, given: 8 },
      { r: 0, c: 1, tint: P, cands: [[1, P], [2, P]] },
      { r: 0, c: 2, tint: G, cands: [[1, X], [4, G], [5, G]] },
      { r: 0, c: 3, tint: P, cands: [[1, P], [3, P]] },
      { r: 0, c: 4, given: 9 },
      { r: 0, c: 5, tint: G, cands: [[2, X], [5, G], [6, G], [7, G]] },
      { r: 0, c: 6, tint: P, cands: [[2, P], [3, P]] },
      { r: 0, c: 7, tint: G, cands: [[3, X], [4, G], [6, G]] },
      { r: 0, c: 8, tint: G, cands: [[1, X], [6, G], [7, G]] }
    ]
  };
  return compose([row], 'row', 'A naked triple and a hidden quad in the same row');
}

function bentTriple(): string {
  const P = 'primary';
  const G = 'secondary';
  const X = 'elim';
  const straight: Panel = {
    rows: 1,
    cols: 9,
    heading: 'Naked triple: three cells in one row',
    rowLabels: ['row'],
    cells: [
      { r: 0, c: 1, tint: P, cands: [[1, P], [2, P]] },
      { r: 0, c: 2, cands: [[3, X], 6] },
      { r: 0, c: 4, tint: P, cands: [[2, P], [3, P]] },
      { r: 0, c: 7, tint: P, cands: [[1, P], [3, P]] },
      { r: 0, c: 8, cands: [[1, X], 4] }
    ]
  };
  const bent: Panel = {
    rows: 3,
    cols: 9,
    heading: 'Bent triple: an XY-Wing',
    cells: [
      { r: 0, c: 0, tint: P, cands: [[1, P], [2, P]] },
      { r: 0, c: 2, cands: [[3, X], 6] },
      { r: 0, c: 6, tint: G, cands: [[1, G], [3, G]] },
      { r: 2, c: 1, tint: G, cands: [[2, G], [3, G]] },
      { r: 2, c: 7, cands: [[3, X], 9] }
    ]
  };
  return compose([straight, bent], 'column', 'A naked triple in one row, and the same three digits bent round a corner as an XY-Wing');
}

function kite(): string {
  const P = 'primary';
  const G = 'secondary';
  const panel: Panel = {
    rows: 9,
    cols: 9,
    cells: [
      { r: 1, c: 1, tint: G, cands: [[4, G]] },
      { r: 1, c: 6, tint: P, cands: [[4, P]] },
      { r: 2, c: 2, tint: G, cands: [[4, G]] },
      { r: 7, c: 2, tint: P, cands: [[4, P]] },
      { r: 7, c: 6, tint: 'elim', cands: [[4, 'elim']] }
    ],
    links: [
      { from: [1, 1, 4], to: [1, 6, 4], strong: true },
      { from: [2, 2, 4], to: [7, 2, 4], strong: true },
      { from: [1, 1, 4], to: [2, 2, 4], strong: false }
    ]
  };
  return compose([panel], 'row', 'A 2-String Kite on 4');
}

function deadly(): string {
  const P = 'primary';
  const panel: Panel = {
    rows: 2,
    cols: 6,
    cells: [
      { r: 0, c: 0, tint: P, cands: [[1, P], [2, P]] },
      { r: 0, c: 3, tint: P, cands: [[1, P], [2, P]] },
      { r: 1, c: 0, tint: P, cands: [[1, P], [2, P]] },
      { r: 1, c: 3, tint: 'place', cands: [[1, 'elim'], [2, 'elim'], [5, 'place']] }
    ]
  };
  return compose([panel], 'row', 'A Unique Rectangle in rows 1 and 2, columns 1 and 4');
}

const DIAGRAMS: Record<DiagramId, () => string> = {
  'fish-sideways': fishSideways,
  'naked-hidden': nakedHidden,
  'bent-triple': bentTriple,
  kite,
  deadly
};

/** the diagram as a standalone SVG document */
export const intuitionDiagram = (id: DiagramId): string => DIAGRAMS[id]();

export const intuitionDiagramUrl = (id: DiagramId) => `/learn/img/intuition-${id}.svg`;

export const DIAGRAM_IDS = Object.keys(DIAGRAMS) as DiagramId[];
