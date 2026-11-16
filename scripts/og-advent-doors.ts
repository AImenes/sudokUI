/**
 * The pictures of the advent calendar's 24 doors (docs/advent-calendar.md):
 * what a chat shows when a door's link, /advent/<year>/<n>, is shared. As a
 * paper calendar's, each door has its own picture, the same every year:
 * public/og/advent/door-01.png ... door-24.png, 1200 x 630.
 *
 * The look is Nordic knitting: a ground of stocking stitch in the site's
 * pine or cranberry, a band of small pattern and a gold row along the top
 * and the bottom, a Selbu rose knitted on each side, the door's motif in
 * the middle as a felt cut-out in snow and gold with a hard shadow and a
 * running stitch, and the door's number in gold on a sewn-on patch shaped
 * as a door of the calendar, in the other colour of the two. The brand and
 * the address are at the bottom. No words but those: one set of 24 serves
 * every language. No puzzle is on a picture.
 *
 * This file is the frame and the rendering; the table of the 24 doors is
 * scripts/advent-doors/doors.ts, on its own so that a test can read it. A
 * door's motif is one file, scripts/advent-doors/door-<nn>.ts, whose
 * default export returns the motif's SVG for the motif box; what the
 * motifs share is in scripts/advent-doors/felt.ts, and how to draw one in
 * scripts/advent-doors/README.md. A door whose file is missing stops the
 * run and says so.
 *
 *   npx vite-node scripts/og-advent-doors.ts                    all 24, into public/og/advent/
 *   npx vite-node scripts/og-advent-doors.ts 5 17 --out .vite/doors
 *   ... --previews [dir]       also door-<nn>-small.png (400 x 210) and door-<nn>-square.png (the
 *                              centred 630 x 630), into dir (default .vite/advent-doors/previews)
 *   ... --sheet <file.png>     one picture for looking at the doors named: for each door a row with
 *                              the picture at 600 wide, at 300 wide and its square crop at 300, the
 *                              door's number beside them (eight doors a sheet; with more, the name
 *                              takes -1, -2 ...)
 *   ... --sheet-small <file.png>  the doors named at 300 wide, four across, as a chat shows them
 *   ... --svg                  also door-<nn>.svg beside each PNG
 *   ... --guides               the motif's box and the square crop drawn over each picture
 *   ... --frame                the frame alone, with the guides, as frame-<nn>.png: a door needs no
 *                              motif file for this (the table's grounds, bands and numbers at a glance)
 *
 * The sheets and the previews are for whoever draws and checks, never for
 * the site: keep them under .vite/. Rasterised with Playwright's Chromium
 * at device scale 1 (the one OG_BROWSER or PW_CHROMIUM names, else
 * /opt/pw-browsers/chromium when it is there). Nothing is fetched.
 */
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { BOX, GOLD, GROUNDS, SNOW, type GroundName, type Motif, feltOf, hardShadow, mix, n1 } from './advent-doors/felt';
import { DOORS, H, MAX_BYTES, W, doorName, type BandName } from './advent-doors/doors';

export { DOORS, H, MAX_BYTES, W, doorName };

/** one knitted stitch, in pixels: the picture is 120 stitches by 63 rows */
const S = 10;
const COLS = W / S;
const ROWS = H / S;
/** the stack of the calendar's own card (scripts/og-advent-card.ts) */
const FONT = 'Helvetica, Arial, sans-serif';

const here = dirname(fileURLToPath(import.meta.url));

/** the motif of a door, from its file; a clear word when the file is not there or exports no motif */
export async function motifOf(door: number): Promise<Motif> {
  const cfg = DOORS[door - 1];
  if (!cfg) throw new Error(`door ${door}: the calendar has doors 1 to 24`);
  const file = join(here, 'advent-doors', `${doorName(door)}.ts`);
  if (!existsSync(file)) throw new Error(`door ${door}: its motif (${cfg.motif}) is not drawn yet: scripts/advent-doors/${doorName(door)}.ts is missing (scripts/advent-doors/README.md says how to draw it)`);
  const mod = (await import(/* @vite-ignore */ pathToFileURL(file).href)) as { default?: unknown };
  if (typeof mod.default !== 'function') throw new Error(`door ${door}: scripts/advent-doors/${doorName(door)}.ts must export its motif as the default function`);
  return mod.default as Motif;
}

// ---------------------------------------------------------------- knitting

/** one stitch, the V of stocking stitch, at column c and row r */
function stitch(c: number, r: number): string {
  const x = c * S;
  const y = r * S;
  return `M${n1(x + 0.8)},${y}l4.2,3.6 4.2,-3.6v7l-4.2,3.6 -4.2,-3.6z`;
}

type Cell = [number, number];

/** stitches of one colour as one path */
function stitches(cells: Cell[], fill: string): string {
  if (!cells.length) return '';
  return `<path d="${cells.map(([c, r]) => stitch(c, r)).join('')}" fill="${fill}"/>`;
}

/** the patterns of the bands, five rows each, repeated along the band */
const BANDS: Record<BandName, string[]> = {
  zigzag: ['S...S...', '...S.S..', '..S...S.', '.S.....S', 'S...S...'],
  diamonds: ['..S...', '.S.S..', 'S.S.S.', '.S.S..', '..S...'],
  hearts: ['.S.S...', 'SSSSS..', 'SSSSS..', '.SSS...', '..S....'],
  stars: ['S.S.S..', '.SSS...', 'SS.SS..', '.SSS...', 'S.S.S..'],
  // nine dots, three by three, a bar between one box and the next
  ninedot: ['S.S.S...', '......S.', 'S.S.S.S.', '......S.', 'S.S.S...'],
  trees: ['..S....', '.SSS...', '..S....', '.SSS...', 'SSSSS..']
};

/** the cells of both bands: the pattern's, and the gold row's */
function bandCells(name: BandName): [Cell[], Cell[]] {
  const rows = BANDS[name];
  const period = rows[0].length;
  // the figure's own width, and the column that puts one figure in the middle of the picture
  const wide = Math.max(...rows.map((row) => row.lastIndexOf('S'))) + 1;
  const first = Math.round(COLS / 2 - wide / 2);
  const pattern: Cell[] = [];
  const line: Cell[] = [];
  for (let c = 0; c < COLS; c++) {
    const k = (((c - first) % period) + period) % period;
    for (let r = 0; r < 5; r++) {
      if (rows[r][k] === 'S') {
        pattern.push([c, 1 + r]);
        pattern.push([c, ROWS - 6 + r]);
      }
    }
    line.push([c, 7], [c, ROWS - 8]);
  }
  return [pattern, line];
}

/**
 * The eight-petalled rose of Selbu on 21 by 21 stitches: eight
 * parallelograms about the middle, a stitch of ground along the axes and
 * the diagonals. cut 0: a slit down each petal; 1: whole petals; 2: an eye
 * in each petal. A small diamond fills each corner.
 */
function roseCells(cut: 0 | 1 | 2, c0: number, r0: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = -10; y <= 10; y++) {
    for (let x = -10; x <= 10; x++) {
      const lo = Math.min(Math.abs(x), Math.abs(y));
      const hi = Math.max(Math.abs(x), Math.abs(y));
      let on = lo >= 1 && lo <= 5 && hi >= lo + 1 && hi <= lo + 5;
      if (on && cut === 0 && hi - lo === 3 && lo >= 2 && lo <= 4) on = false;
      if (on && cut === 2 && hi - lo === 3 && lo === 3) on = false;
      // the corner diamonds
      if (Math.abs(Math.abs(x) - 9) + Math.abs(Math.abs(y) - 9) === 1) on = true;
      if (on) cells.push([c0 + x, r0 + y]);
    }
  }
  return cells;
}

/** nine dots, three by three: the quiet nod to the puzzle */
function nineCells(c0: number, r0: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = -2; y <= 2; y += 2) for (let x = -2; x <= 2; x += 2) cells.push([c0 + x, r0 + y]);
  return cells;
}

// ---------------------------------------------------------------- the picture

/**
 * Where things sit. The motif's box (BOX, 340 by 410) and the patch share
 * the middle 630 px, the square some chat apps crop to, with 10 px to
 * spare on each side: the box from x 295 to 635, the patch from 645 to
 * 905. The roses, the brand and the address are outside the square.
 */
export const MOTIF_AT: [number, number] = [465, 321];
export const PATCH = { x: 645, y: 185, size: 260, rx: 50 } as const;
/** the roses' middles, in stitches: columns 4 to 24 and 95 to 115, 45 px clear of the box and of the patch */
const ROSE_AT: Cell[] = [
  [14, 31],
  [COLS - 15, 31]
];
/**
 * The number's ink: a quarter of the picture's height is 157.5 px, the
 * least a chat preview 300 px wide still reads at a glance; one digit
 * stands a little taller on the same patch. Every number is drawn at nine
 * tenths of its width, a pair of digits a little closer together too, so
 * that the widest pair keeps `side` clear of the patch's edge at full
 * height; a pair wider still would be narrowed further, never lowered.
 */
const NUMBER = { two: 162, one: 184, side: 20, narrow: 0.9, closer: 8 } as const;

/** the measure of a number's ink at 100 px: what the browser that draws it says */
export interface Ink {
  left: number;
  right: number;
  ascent: number;
  descent: number;
}

/**
 * The picture of a door as SVG.
 * @param door 1 to 24
 * @param motif the door's motif (motifOf), or null for the frame alone
 * @param ink the measure of the number at 100 px
 * @param guides draw the motif's box and the square crop over the picture: for whoever draws, never for the site
 */
export function picture(door: number, motif: Motif | null, ink: Ink, guides = false): string {
  const cfg = DOORS[door - 1];
  const g = GROUNDS[cfg.ground];
  const id = `d${door}`;
  const k = feltOf(cfg.ground, id);

  // the knitted pattern
  const [pattern, line] = bandCells(cfg.band);
  const roses = ROSE_AT.flatMap(([c, r]) => roseCells(cfg.rose, c, r));
  const nines = ROSE_AT.flatMap(([c]) => nineCells(c, 14));

  // the number, its ink in the middle of the patch
  const text = String(door);
  const inkH = ink.ascent + ink.descent;
  const size = ((text.length > 1 ? NUMBER.two : NUMBER.one) / inkH) * 100;
  const sc = size / 100;
  const closer = text.length > 1 ? NUMBER.closer : 0;
  // the ink's left and right edges at this size, before narrowing: the digits of a pair are moved together
  const left = -ink.left * sc;
  const right = ink.right * sc - closer * (text.length - 1);
  const narrow = Math.min(NUMBER.narrow, (PATCH.size - 2 * NUMBER.side) / (right - left));
  const cx = PATCH.x + PATCH.size / 2;
  const cy = PATCH.y + PATCH.size / 2;
  const ty = cy + ((ink.ascent - ink.descent) / 2) * sc;
  // the text is drawn from x 0 and moved: its ink's middle to the patch's middle
  const tx = cx - ((left + right) / 2) * narrow;

  const p = PATCH;
  const guide = guides
    ? `<g fill="none" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="6 6">
    <rect x="${MOTIF_AT[0] + BOX.left}" y="${MOTIF_AT[1] + BOX.top}" width="${BOX.w}" height="${BOX.h}"/>
    <rect x="${(W - H) / 2}" y="0.75" width="${H}" height="${H - 1.5}" stroke="#7cc4ff"/>
    <path d="M${MOTIF_AT[0] - 12},${MOTIF_AT[1]}h24M${MOTIF_AT[0]},${MOTIF_AT[1] - 12}v24" stroke-dasharray="none"/>
  </g>`
    : '';
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="${id}-knit" width="${S}" height="${S}" patternUnits="userSpaceOnUse">
      <rect width="${S}" height="${S}" fill="${g.gap}"/>
      <path d="${stitch(0, 0)}${stitch(0, -1)}" fill="${g.stitch}"/>
    </pattern>
    <linearGradient id="${id}-mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c8cf8"/>
      <stop offset="1" stop-color="#a06ef5"/>
    </linearGradient>
    ${hardShadow(`${id}-cut`, g.deep, W, H)}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#${id}-knit)"/>
  ${stitches(pattern, SNOW)}
  ${stitches(line, GOLD)}
  ${stitches(roses, ROSE[cfg.ground])}
  ${stitches(nines, GOLD)}

  <g filter="url(#${id}-cut)">
    <g transform="translate(${MOTIF_AT[0]},${MOTIF_AT[1]})">${motif ? motif(k) : ''}
    </g>
    <rect x="${p.x}" y="${p.y}" width="${p.size}" height="${p.size}" rx="${p.rx}" fill="${g.patch}"/>
  </g>
  <rect x="${p.x + 8}" y="${p.y + 8}" width="${p.size - 16}" height="${p.size - 16}" rx="${p.rx - 8}" fill="none" stroke="${GOLD}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="12 10"/>
  <text transform="translate(${n1(tx)},${n1(ty)}) scale(${+narrow.toFixed(4)},1)" font-family="${FONT}" font-size="${n1(size)}" font-weight="800"${closer ? ` letter-spacing="${-closer}"` : ''} fill="${GOLD}">${text}</text>

  <!-- the brand, as the label sewn into a garment, and the address -->
  <g transform="translate(40,484)">
    <rect width="210" height="58" rx="9" fill="#0f261d"/>
    <path d="M7,13v34M203,13v34" stroke="#6f8579" stroke-width="2" stroke-dasharray="4 4"/>
    <rect x="17" y="9" width="40" height="40" rx="9.5" fill="url(#${id}-mark)"/>
    <text x="37" y="36" font-family="${FONT}" font-size="19" font-weight="800" fill="#ffffff" text-anchor="middle">UI</text>
    <text x="66" y="39.5" font-family="${FONT}" font-size="30" font-weight="800" fill="${SNOW}">sudok<tspan fill="#a99cf9">UI</tspan></text>
  </g>
  <text x="${W - 145}" y="523" font-family="${FONT}" font-size="27" font-weight="700" fill="${GOLD}" text-anchor="middle">sudokui.app</text>
  ${guide}
</svg>
`;
}

/**
 * The roses' yarn: snow, held back so that the motif and the number stay
 * in front. On cranberry a little of the ground does it; on pine the same
 * mix goes grey, so the rose there is knitted in a pale green of its own.
 */
const ROSE: Record<GroundName, string> = {
  pine: mix(SNOW, '#5fae86', 0.3),
  cranberry: mix(SNOW, GROUNDS.cranberry.stitch, 0.22)
};

// ---------------------------------------------------------------- the files

interface Args {
  doors: number[];
  out: string;
  previews: string | null;
  sheet: string | null;
  sheetSmall: string | null;
  svg: boolean;
  guides: boolean;
  frame: boolean;
}

/** where the site's 24 pictures live: the Worker's share page names them as /og/advent/door-<nn>.png */
const SITE_OUT = resolve('public/og/advent');

const USAGE = 'usage: npx vite-node scripts/og-advent-doors.ts [doors 1-24 ...] [--out dir] [--previews [dir]] [--sheet file.png] [--sheet-small file.png] [--svg] [--guides] [--frame]';

function parse(argv: string[]): Args {
  const a: Args = { doors: [], out: SITE_OUT, previews: null, sheet: null, sheetSmall: null, svg: false, guides: false, frame: false };
  const isValue = (s: string | undefined): s is string => s !== undefined && !s.startsWith('--');
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const value = (): string => {
      if (!isValue(argv[i + 1])) throw new Error(`${arg} needs a name after it\n${USAGE}`);
      return resolve(argv[++i]);
    };
    if (arg === '--out') a.out = value();
    else if (arg === '--sheet') a.sheet = value();
    else if (arg === '--sheet-small') a.sheetSmall = value();
    else if (arg === '--previews') a.previews = isValue(argv[i + 1]) && !/^\d+$/.test(argv[i + 1]) ? resolve(argv[++i]) : resolve('.vite/advent-doors/previews');
    else if (arg === '--svg') a.svg = true;
    else if (arg === '--guides') a.guides = true;
    else if (arg === '--frame') a.frame = a.guides = true;
    else if (/^\d+$/.test(arg) && +arg >= 1 && +arg <= 24) a.doors.push(+arg);
    else throw new Error(`${arg}: not a door (1 to 24) and not an option\n${USAGE}`);
  }
  if (!a.doors.length) a.doors = DOORS.map((_, i) => i + 1);
  a.doors = [...new Set(a.doors)];
  for (const f of [a.sheet, a.sheetSmall]) if (f && extname(f) !== '.png') throw new Error(`${f}: a sheet is a .png\n${USAGE}`);
  // a picture with guides on it must never reach the site
  if (a.guides && a.out === SITE_OUT) throw new Error(`--guides and --frame draw for the makers, not for the site: name a folder with --out (.vite/advent-doors, say)`);
  return a;
}

const dataUri = (file: string): string => `data:image/png;base64,${readFileSync(file).toString('base64')}`;

/** a page of HTML as one PNG, as large as its content */
async function shootPage(page: Page, html: string, file: string): Promise<void> {
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#e6e7ea;font-family:${FONT};color:#1d2430">${html}</body></html>`);
  await page.locator('#sheet').screenshot({ path: file });
}

/** the sheets of rows: each door at 600 wide, at 300 wide and its square crop at 300 */
async function sheets(page: Page, made: { door: number; file: string }[], file: string): Promise<string[]> {
  const per = 8;
  const written: string[] = [];
  for (let at = 0, n = 1; at < made.length; at += per, n++) {
    const rows = made
      .slice(at, at + per)
      .map(({ door, file: png }) => {
        const src = dataUri(png);
        return `<div style="display:flex;gap:12px;align-items:flex-start;margin-top:12px">
        <div style="width:44px;font-size:30px;font-weight:800;text-align:right;line-height:40px">${door}</div>
        <img src="${src}" width="600" height="315">
        <img src="${src}" width="300" height="158">
        <div style="width:300px;height:300px;overflow:hidden"><img src="${src}" height="300" style="margin-left:${n1((-285 * 300) / 630)}px"></div>
      </div>`;
      })
      .join('\n');
    const name = made.length > per ? file.replace(/\.png$/, `-${n}.png`) : file;
    mkdirSync(dirname(name), { recursive: true });
    await shootPage(page, `<div id="sheet" style="display:inline-block;padding:4px 16px 16px">${rows}</div>`, name);
    written.push(name);
  }
  return written;
}

/** every door named at 300 wide, four across */
async function smallSheet(page: Page, made: { door: number; file: string }[], file: string): Promise<void> {
  const cells = made
    .map(({ door, file: png }) => `<div><div style="font-size:20px;font-weight:800;line-height:28px">${door}</div><img src="${dataUri(png)}" width="300" height="158" style="display:block"></div>`)
    .join('\n');
  mkdirSync(dirname(file), { recursive: true });
  await shootPage(page, `<div id="sheet" style="display:inline-grid;grid-template-columns:repeat(4,300px);gap:8px 12px;padding:8px 16px 16px">${cells}</div>`, file);
}

async function main(): Promise<void> {
  const a = parse(process.argv.slice(2));
  // every motif first: a missing door stops the run before anything is written
  const motifs = new Map<number, Motif | null>();
  for (const door of a.doors) motifs.set(door, a.frame ? null : await motifOf(door));

  mkdirSync(a.out, { recursive: true });
  if (a.previews) mkdirSync(a.previews, { recursive: true });
  const executablePath = process.env.OG_BROWSER || process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath });
  const made: { door: number; file: string }[] = [];
  const heavy: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    for (const door of a.doors) {
      // the number's ink, measured in the browser that draws it, so that it sits in the middle whatever the font
      await page.setContent('<!doctype html><html><body></body></html>');
      const ink: Ink = await page.evaluate(
        ([text, font]) => {
          const c = document.createElement('canvas').getContext('2d')!;
          c.font = `800 100px ${font}`;
          const m = c.measureText(text);
          return { left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
        },
        [String(door), FONT]
      );
      const name = a.frame ? doorName(door).replace('door', 'frame') : doorName(door);
      const svg = picture(door, motifs.get(door) ?? null, ink, a.guides);
      if (a.svg) writeFileSync(join(a.out, `${name}.svg`), svg);
      const file = join(a.out, `${name}.png`);
      await page.setContent(`<!doctype html><html><body style="margin:0;background:#000">${svg}</body></html>`);
      await page.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: H } });
      const bytes = statSync(file).size;
      if (bytes > MAX_BYTES) heavy.push(`${name}.png (${Math.round(bytes / 1024)} KB)`);
      console.log(`wrote ${file} (${Math.round(bytes / 1024)} KB): ${DOORS[door - 1].motif}`);
      made.push({ door, file });
      if (a.previews) {
        // the square a chat may crop to, and the picture as small as a chat shows it: the PNG scaled down, as the chat does it
        await page.screenshot({ path: join(a.previews, `${name}-square.png`), clip: { x: (W - H) / 2, y: 0, width: H, height: H } });
        await page.setContent(`<!doctype html><html><body style="margin:0"><img src="${dataUri(file)}" width="400" height="210" style="display:block"></body></html>`);
        await page.screenshot({ path: join(a.previews, `${name}-small.png`), clip: { x: 0, y: 0, width: 400, height: 210 } });
      }
    }
    if (a.previews) console.log(`previews in ${a.previews}`);
    if (a.sheet) for (const f of await sheets(page, made, a.sheet)) console.log(`sheet ${f}`);
    if (a.sheetSmall) {
      await smallSheet(page, made, a.sheetSmall);
      console.log(`sheet ${a.sheetSmall}`);
    }
  } finally {
    await browser.close();
  }
  if (heavy.length) throw new Error(`over ${MAX_BYTES / 1024} KB, too heavy for a chat preview: ${heavy.join(', ')}`);
}

await main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
