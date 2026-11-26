/**
 * The advent calendar on paper (the owner's asking of 26 November 2026): a
 * poster and a flyer for noticeboards, in Norwegian (bokmål) and English,
 * each with a QR code that opens the calendar's page in its language with
 * the poster tag (?utm_source=poster), so that its visits show on /admin
 * as `poster` (worker/telemetry.ts, LINK_TAGS). A phone's camera sends no
 * referrer, or on Android only the scanning app's name: without the tag
 * they would read as `none`, `search` or `other`.
 *
 *   advent-poster-a4.<lang>.pdf       an A4 poster
 *   advent-flyer-a5.<lang>.pdf        an A5 flyer
 *   advent-flyers-2up-a4.<lang>.pdf   two A5 flyers side by side on an A4
 *                                     sheet on its side, a line to cut along
 *
 * each with a PNG preview of the same name, and the code alone,
 * advent-qr.<lang>.svg and .png (40 mm with its white border, the PNG at
 * 600 dots to the inch), for a newsletter's own layout, into promo/print/ (never
 * public/: they are for printing, not for the site); promo/print/README.md
 * says how to print them and where to hang them. The look is the doors'
 * pictures' (scripts/og-advent-doors.ts): a knitted band in the
 * calendar's pine with a snow pattern and a gold row, and the doors'
 * pictures from public/og/advent/, cropped about their middle a little
 * wider than square, so the motif and the door's number show whole. The
 * paper stays white, the text near black and the code pure black on
 * white, so a black-and-white printer does it justice.
 *
 * Every run checks itself and stops with an error if anything is off: each
 * preview's code (each half of the sheet of two) is read back with a QR
 * decoder (jsQR), in colour and in grey, and must be the exact address
 * (print-poster/sheets.ts, qrAddress); each PDF must be one page of its
 * paper. The grey renders, for looking at, go to .vite/print-grey/.
 * tests/printPoster.test.ts reads the committed previews the same way.
 *
 *   npx vite-node scripts/print-poster.ts
 *
 * Rasterised with Playwright's Chromium (OG_BROWSER or PW_CHROMIUM names
 * one, else /opt/pw-browsers/chromium when it is there). Nothing is
 * fetched: the fonts are the machine's (Inter where it is installed), the
 * pictures are read from public/.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium, type Page } from '@playwright/test';
import { CRANBERRY, GOLD, GROUNDS, PINE, SNOW } from './advent-doors/felt';
import { BANDS, doorName, type BandName } from './advent-doors/doors';
import { CODE_ALONE, OUT_DIR, PREVIEW_SCALE, PRINT_LANGS, PT_PER_MM, PX_PER_MM, SHEETS, qrAddress, typedAddress, type PrintLang, type Sheet } from './print-poster/sheets';
import { pdfPages, pngDpi, readCodes } from './print-poster/read';
import { qrPng, qrSvg } from './print-poster/qr';

const FONT = "Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif";
/** the text: near black, which a laser printer still prints as solid black */
const INK = '#1b1f24';
const MUTED = '#3d4650';
const GREY_DIR = resolve('.vite/print-grey');
/** the pine line around a code, outside its quiet zone, which stays the code's own white */
const FRAME_MM = 0.5;

const uri = (path: string, type: string) => `data:${type};base64,${readFileSync(resolve(path)).toString('base64')}`;
const ICON = uri('public/icon.svg', 'image/svg+xml');
const door = (n: number) => uri(`public/og/advent/${doorName(n)}.png`, 'image/png');

// ---------------------------------------------------------------- the words

interface Words {
  title: string;
  days: string;
  /** after the dates, in their large line, so it carries across a room */
  free: string;
  lead: string;
  lines: string[];
  hint: string;
  chips: string[];
  scan: string;
  /** before the address written out */
  type: string;
  foot: string;
  /** along the line to cut on the sheet of two flyers */
  cut: string;
}

/**
 * True to the calendar's own page (src/content/adventPage.ts) and the home
 * page's promises (src/content/home.ts): 24 doors, one a day from 1 to 24
 * December, door 1 very easy and each a little harder; free, no account,
 * no ads, works offline; a hint that shows the next step on the player's
 * own board and why it works. Few words, so they can be large: what a
 * noticeboard shows from two metres is the title, the dates with "free",
 * the doors and the code; the rest is read up close, by older eyes too
 * (the body at least 11 pt on the flyer).
 */
const WORDS: Record<PrintLang, Words> = {
  nb: {
    title: 'Sudoku-julekalender',
    days: '1.–24. desember',
    free: 'Gratis',
    lead: 'Hver dag åpner du en ny luke, med en sudoku bak.',
    lines: ['Luke 1 er veldig lett, og hver luke er litt vanskeligere enn den forrige.'],
    hint: 'Står du fast? Et hint viser neste steg på ditt eget brett og forklarer hvorfor.',
    chips: ['Ingen konto', 'Ingen reklame', 'Virker uten nett'],
    scan: 'Skann med mobilkameraet',
    type: 'eller skriv inn',
    foot: 'Virker i nettleseren på mobil, nettbrett og PC. Ingenting å installere.',
    cut: 'Klipp her'
  },
  en: {
    title: 'Sudoku advent calendar',
    days: '1–24 December',
    free: 'Free',
    lead: 'A new door opens every day, with a sudoku behind it.',
    lines: ['Door 1 is very easy, and each door is a little harder than the one before.'],
    hint: 'Stuck? A hint shows you the next step on your own board, and why it works.',
    chips: ['No account', 'No ads', 'Works offline'],
    scan: 'Scan with your phone',
    type: 'or type',
    foot: 'Works in the browser on a phone, tablet or computer. Nothing to install.',
    cut: 'Cut here'
  }
};

// ---------------------------------------------------------------- the knitting

/** one stitch, the V of stocking stitch, in a cell 10 wide and 10 high, as the doors' pictures knit it */
const stitch = (c: number, r: number) => `M${c * 10 + 0.8},${r * 10}l4.2,3.6 4.2,-3.6v7l-4.2,3.6 -4.2,-3.6z`;

/**
 * A knitted band as wide as `widthMm`, stitches about `stitchMm` wide: a
 * row of ground, the band's five rows of pattern in snow, a row of ground,
 * a gold row and a row of ground; upside down for the foot of the sheet.
 * Every stitch is a path of its own colour, so the PDF keeps it as lines.
 */
function knitBand(widthMm: number, stitchMm: number, band: BandName, foot: boolean): string {
  const cols = Math.round(widthMm / stitchMm);
  const rows = 9;
  const pattern = BANDS[band];
  const period = pattern[0].length;
  const wide = Math.max(...pattern.map((row) => row.lastIndexOf('S'))) + 1;
  // one figure in the middle, as on a door's picture
  const first = Math.round(cols / 2 - wide / 2);
  const ground: string[] = [];
  const snow: string[] = [];
  const gold: string[] = [];
  for (let c = 0; c < cols; c++) {
    const k = (((c - first) % period) + period) % period;
    for (let r = 0; r < rows; r++) {
      // the head's order: ground, the pattern's rows 1 to 5, ground, gold, ground; the foot's the other way up
      const at = foot ? rows - 1 - r : r;
      const cell = stitch(c, r);
      if (at >= 1 && at <= 5 && pattern[at - 1][k] === 'S') snow.push(cell);
      else if (at === 7) gold.push(cell);
      else ground.push(cell);
    }
  }
  const g = GROUNDS.pine;
  return `<svg class="band" viewBox="0 0 ${cols * 10} ${rows * 10}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="${cols * 10}" height="${rows * 10}" fill="${g.gap}"/>
  <path d="${ground.join('')}" fill="${PINE}"/>
  <path d="${snow.join('')}" fill="${SNOW}"/>
  <path d="${gold.join('')}" fill="${GOLD}"/>
</svg>`;
}

// ---------------------------------------------------------------- the sheets

/**
 * The measures of a poster and of a flyer, in millimetres; a font's size
 * is its em, so 3.9 mm is 11 pt and 6 mm 17 pt
 */
const SIZES = {
  poster: { w: 210, h: 297, pad: 10, stitch: 2.4, gap: 5, brand: 6.2, title: 15, days: 8.6, lead: 7.6, line: 6, chip: 5, scan: 5, address: 6, foot: 4.4, doors: [1, 8, 12, 24], doorGap: 5, radius: 3.5 },
  flyer: { w: 148, h: 210, pad: 8, stitch: 1.8, gap: 3.4, brand: 4.6, title: 10.6, days: 6.2, lead: 4.8, line: 3.9, chip: 3.3, scan: 3.6, address: 4.3, foot: 3.3, doors: [1, 12, 24], doorGap: 4, radius: 2.5 }
} as const;
type Size = (typeof SIZES)[keyof typeof SIZES];

/** a paragraph whose last two words keep together, so no word is left alone on the last line */
const keepLast = (text: string) => text.replace(/ (\S+)$/, '&nbsp;$1');

/** one poster or one flyer, as a block of its paper's size */
function face(lang: PrintLang, s: Size, qrMm: number): string {
  const t = WORDS[lang];
  const code = qrSvg(qrAddress(lang)).svg;
  const inner = s.w - 2 * s.pad;
  return `<section class="face" style="width:${s.w}mm;height:${s.h}mm;padding:${s.pad}mm;gap:${s.gap}mm">
  ${knitBand(inner, s.stitch, 'stars', false)}
  <header class="brand" style="font-size:${s.brand}mm"><img src="${ICON}" alt=""><span>sudok<b>UI</b></span><span class="site">sudokui.app</span></header>
  <div class="heading">
    <h1 class="fit" style="font-size:${s.title}mm">${t.title}</h1>
    <p class="days" style="font-size:${s.days}mm">${t.days} · ${t.free}</p>
  </div>
  <div class="doors" style="gap:${s.doorGap}mm">${s.doors.map((n) => `<img src="${door(n)}" alt="" style="border-radius:${s.radius}mm">`).join('')}</div>
  <div class="main" style="gap:${s.gap * 1.4}mm">
    <div class="text">
      <p class="lead" style="font-size:${s.lead}mm">${keepLast(t.lead)}</p>
      ${t.lines.map((l) => `<p class="line" style="font-size:${s.line}mm">${keepLast(l)}</p>`).join('\n      ')}
      <p class="line hint" style="font-size:${s.line}mm">${keepLast(t.hint)}</p>
      <p class="chips" style="font-size:${s.chip}mm">${t.chips.map((c) => `<span>${c}</span>`).join('')}</p>
    </div>
    <div class="code" style="width:${qrMm + 2 * FRAME_MM}mm">
      <div class="frame" style="width:${qrMm}mm;height:${qrMm}mm;border-radius:${s.radius}mm">${code}</div>
      <p class="scan" style="font-size:${s.scan}mm">${t.scan}</p>
      <p class="address fit" style="font-size:${s.address}mm"><small>${t.type}</small> ${typedAddress(lang)}</p>
    </div>
  </div>
  <p class="foot" style="font-size:${s.foot}mm">${keepLast(t.foot)}</p>
  ${knitBand(inner, s.stitch, 'stars', true)}
</section>`;
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#ffffff}
body{font-family:${FONT};color:${INK};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{display:flex;position:relative;overflow:hidden;background:#ffffff}
.face{display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;flex:none}
.band{display:block;width:100%;height:auto;flex:none}
.brand{display:flex;align-items:center;gap:.4em;font-weight:800;letter-spacing:-.01em;color:${INK}}
.brand img{width:1.5em;height:1.5em;display:block}
.brand b{color:#6a55d0}
.brand .site{margin-left:auto;font-weight:700;color:${PINE};font-size:.8em}
.heading{text-align:center}
h1{font-weight:800;letter-spacing:-.025em;line-height:1.02;color:${PINE};white-space:nowrap}
.days{font-weight:800;color:${CRANBERRY};margin-top:.12em;letter-spacing:-.01em}
.doors{display:flex}
/* 687 of the picture's 1200 across: the motif and the number's patch with room about them, and nothing of the roses or the brand's label at the sides */
.doors img{flex:1;min-width:0;aspect-ratio:687/630;object-fit:cover;object-position:center;display:block}
.main{display:flex;align-items:center}
.text{flex:1;min-width:0;display:flex;flex-direction:column;gap:.55em}
.lead{font-weight:800;line-height:1.2;color:${PINE}}
.line{line-height:1.32;color:${INK}}
.hint{font-weight:600}
.chips{display:flex;flex-wrap:wrap;gap:.45em;margin-top:.25em}
.chips span{border:.12em solid ${PINE};color:${PINE};border-radius:999px;padding:.18em .6em;font-weight:700;white-space:nowrap}
.code{flex:none;display:flex;flex-direction:column;align-items:center;text-align:center}
.frame{box-sizing:content-box;background:#ffffff;border:${FRAME_MM}mm solid ${PINE};overflow:hidden}
.qr{display:block;width:100%;height:100%}
.scan{font-weight:700;margin-top:.5em;color:${INK}}
.address{font-weight:800;color:#000000;margin-top:.2em;white-space:nowrap;letter-spacing:-.005em}
.address small{display:block;font-size:.85em;font-weight:600;color:${MUTED};letter-spacing:0;margin-bottom:.05em}
.foot{text-align:center;line-height:1.3;color:${MUTED}}
.cut{position:absolute;top:0;bottom:0;left:50%;border-left:.35mm dashed #6b7280}
.cut span{position:absolute;left:0;transform:translate(-50%,0);background:#ffffff;color:#4b5563;font-size:3mm;font-weight:600;white-space:nowrap;padding:.6mm 0;writing-mode:vertical-rl}
.cut .top{top:6mm}
.cut .bottom{bottom:6mm}
`;

/** a sheet as a whole page: its paper's size, exactly, and nothing outside it */
function sheetHtml(sheet: Sheet): string {
  const { w, h } = sheet.paper;
  let body: string;
  if (sheet.kind === 'poster') body = face(sheet.lang, SIZES.poster, sheet.qrMm);
  else if (sheet.kind === 'flyer') body = face(sheet.lang, SIZES.flyer, sheet.qrMm);
  else {
    // two A5 flyers on an A4 sheet on its side: each half 148.5 mm wide, the flyer's own 148 mm in it
    const half = { ...SIZES.flyer, w: w / 2 };
    const cut = WORDS[sheet.lang].cut;
    body = `${face(sheet.lang, half, sheet.qrMm)}${face(sheet.lang, half, sheet.qrMm)}<div class="cut" aria-hidden="true"><span class="top">✂ ${cut}</span><span class="bottom">${cut} ✂</span></div>`;
  }
  return `<!doctype html><html lang="${sheet.lang === 'nb' ? 'nb' : 'en'}"><head><meta charset="utf-8"><title>${sheet.name}</title><style>
@page{size:${w}mm ${h}mm;margin:0}
html,body{width:${w}mm;height:${h}mm}
${STYLE}</style></head><body><main class="page" style="width:${w}mm;height:${h}mm">${body}</main></body></html>`;
}

/** shrinks each one-line text marked .fit until it fits its box: a font wider than Inter keeps the title on its line */
async function fitText(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('.fit'))) {
      const box = el.parentElement!;
      const room = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) - parseFloat(getComputedStyle(box).paddingRight);
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > room && size > 4) {
        size *= 0.97;
        el.style.fontSize = `${size}px`;
      }
    }
  });
}

/** the faces whose content does not fit their paper: a measure that went wrong must stop the run, not print cut */
async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.face, .text, .code, .doors')).flatMap((el) =>
      el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1 ? [`${el.className}: ${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight}`] : []
    )
  );
}

// ---------------------------------------------------------------- the run

async function main(): Promise<void> {
  const out = resolve(OUT_DIR);
  mkdirSync(out, { recursive: true });
  mkdirSync(GREY_DIR, { recursive: true });
  const executablePath = process.env.OG_BROWSER || process.env.PW_CHROMIUM || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
  const browser = await chromium.launch({ executablePath });
  const wrong: string[] = [];
  try {
    for (const sheet of SHEETS) {
      const html = sheetHtml(sheet);
      const width = Math.ceil(sheet.paper.w * PX_PER_MM);
      const height = Math.ceil(sheet.paper.h * PX_PER_MM);
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: PREVIEW_SCALE });
      await page.setContent(html, { waitUntil: 'load' });
      await fitText(page);
      for (const o of await overflowing(page)) wrong.push(`${sheet.name}: does not fit its paper: ${o}`);

      // the PDF, at the paper's own size
      const pdfFile = join(out, `${sheet.name}.pdf`);
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true, pageRanges: '1' });
      writeFileSync(pdfFile, pdf);
      const pages = pdfPages(pdf);
      const [pw, ph] = [sheet.paper.w * PT_PER_MM, sheet.paper.h * PT_PER_MM];
      if (pages.length !== 1 || Math.abs(pages[0][0] - pw) > 1 || Math.abs(pages[0][1] - ph) > 1)
        wrong.push(`${sheet.name}.pdf: ${pages.length} page(s), ${pages.map(([a, b]) => `${a} x ${b}`).join(', ')} pt; ${pw.toFixed(1)} x ${ph.toFixed(1)} pt was wanted`);

      // the preview, and the code read back from it
      const pngFile = join(out, `${sheet.name}.png`);
      const png = await page.locator('.page').screenshot({ type: 'png' });
      writeFileSync(pngFile, png);
      const want = qrAddress(sheet.lang);
      const read = readCodes(png, sheet.codes).map((c) => c?.data ?? null);
      for (const [i, got] of read.entries()) if (got !== want) wrong.push(`${sheet.name}.png, code ${i + 1}: read ${JSON.stringify(got)}, ${JSON.stringify(want)} was wanted`);

      // the same in grey, as a black-and-white printer has it
      await page.addStyleTag({ content: 'html{filter:grayscale(1)}' });
      const grey = await page.locator('.page').screenshot({ type: 'png' });
      writeFileSync(join(GREY_DIR, `${sheet.name}.grey.png`), grey);
      for (const [i, got] of readCodes(grey, sheet.codes).map((c) => c?.data ?? null).entries())
        if (got !== want) wrong.push(`${sheet.name}, grey, code ${i + 1}: read ${JSON.stringify(got)}, ${JSON.stringify(want)} was wanted`);

      const { modules } = qrSvg(want);
      const moduleMm = sheet.qrMm / (modules + 8);
      console.log(
        `wrote ${pdfFile} (${Math.round(pdf.length / 1024)} KB) and .png (${Math.round(png.length / 1024)} KB): ${sheet.paper.name}, code ${sheet.qrMm} mm with its quiet zone, ${(moduleMm * modules).toFixed(0)} mm without, ${modules} modules of ${moduleMm.toFixed(2)} mm, reads ${read.map((r) => (r === want ? 'right' : 'WRONG')).join(' and ')}`
      );
      await page.close();
    }
    // the code alone, for a newsletter's layout: SVG at its printed size, and a PNG at 600 dots to the inch
    for (const lang of PRINT_LANGS) {
      const want = qrAddress(lang);
      const name = CODE_ALONE.name(lang);
      writeFileSync(join(out, `${name}.svg`), `${qrSvg(want, CODE_ALONE.mm).svg}\n`);
      const { png, px, mm } = qrPng(want, CODE_ALONE.mm, CODE_ALONE.dpi);
      writeFileSync(join(out, `${name}.png`), png);
      const got = readCodes(png)[0]?.data ?? null;
      if (got !== want) wrong.push(`${name}.png: read ${JSON.stringify(got)}, ${JSON.stringify(want)} was wanted`);
      if (pngDpi(png) !== CODE_ALONE.dpi) wrong.push(`${name}.png: says ${pngDpi(png)} dots to the inch, ${CODE_ALONE.dpi} was wanted`);
      // the SVG drawn as the browser draws it, read back the same way
      const page = await browser.newPage({ viewport: { width: 400, height: 400 } });
      await page.setContent(`<body style="margin:0;background:#fff">${qrSvg(want, CODE_ALONE.mm).svg}</body>`);
      const shot = await page.locator('svg').screenshot({ type: 'png' });
      await page.close();
      const fromSvg = readCodes(shot)[0]?.data ?? null;
      if (fromSvg !== want) wrong.push(`${name}.svg: read ${JSON.stringify(fromSvg)}, ${JSON.stringify(want)} was wanted`);
      console.log(`wrote ${join(out, name)}.svg and .png (${px} px, ${mm.toFixed(1)} mm at ${CODE_ALONE.dpi} dpi), reads ${got === want && fromSvg === want ? 'right' : 'WRONG'}`);
    }
  } finally {
    await browser.close();
  }
  console.log(`grey renders in ${GREY_DIR}`);
  if (wrong.length) throw new Error(`the print run is not right:\n  ${wrong.join('\n  ')}`);
}

await main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
