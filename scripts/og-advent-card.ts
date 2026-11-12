/**
 * The social card of the advent calendar's page (src/content/adventPage.ts,
 * docs/advent-calendar.md): one per language for the latest published
 * calendar, 1200 x 630, written to public/ as og-advent-<year>.png,
 * og-advent-<year>.nb.png and og-advent-<year>.es.png, beside the site's
 * own card, the names the page asks for (adventCardPath). A year's card is made once, with its doors, and
 * kept: tests/adventPage.test.ts fails while the page's year has none.
 *
 * The card shows the calendar's name and year in the language and 24
 * closed doors in pine and gold, numbered out of order as a paper
 * calendar's are; no puzzle is on it.
 *
 *   npx vite-node scripts/og-advent-card.ts [--svg-only]
 *
 * Rasterised with Playwright's Chromium, or the one OG_BROWSER or
 * PW_CHROMIUM names; with --svg-only the SVGs are left in a temporary
 * folder to rasterise by hand (1200 x 630, device scale 1).
 */
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { chromium } from '@playwright/test';
import advent from '../src/content/advent.json';
import type { AdventDoor } from '../src/content/advent';
import { HOME_LANGS } from '../src/content/home';
import { adventCardPath } from '../src/content/adventPage';
import { pageCalendar } from '../src/content/learnPages';
import type { Lang } from '../src/state/settings';

/** the card's words per language: the calendar's name on one or two lines, and two lines under the year */
const WORDS: Record<Lang, { title: string[]; lines: [string, string] }> = {
  en: { title: ['Sudoku advent', 'calendar'], lines: ['A door a day, 1 to 24 December,', 'from Easy to Extreme. Free.'] },
  nb: { title: ['Sudoku-', 'julekalender'], lines: ['Én luke hver dag, 1. til 24. desember,', 'fra lett til ekstrem. Gratis.'] },
  es: { title: ['Calendario de', 'adviento de sudoku'], lines: ['Una casilla al día, del 1 al 24 de diciembre,', 'de fácil a extremo. Gratis.'] }
};

/** the doors' places on the card, out of order as on a paper calendar: six a row, four rows */
const ORDER = [17, 5, 22, 9, 1, 14, 11, 24, 3, 19, 7, 20, 2, 15, 8, 23, 12, 6, 21, 10, 18, 4, 13, 16];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT = 'Helvetica, Arial, sans-serif';

function card(lang: Lang, year: number): string {
  const words = WORDS[lang];
  const size = 62;
  const gap = 9;
  const doors = ORDER.map((n, i) => {
    const x = (i % 6) * (size + gap);
    const y = Math.floor(i / 6) * (size + gap);
    // door 1, the first to open, wears the holly ring
    const ring = n === 1 ? `<rect x="${x - 4}" y="${y - 4}" width="${size + 8}" height="${size + 8}" rx="15" fill="none" stroke="#e06b78" stroke-width="3"/>` : '';
    return `${ring}<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="12" fill="#1f5240" stroke="#e7c26a" stroke-opacity="0.55" stroke-width="1.5"/>
    <text x="${x + size / 2}" y="${y + size / 2 + 10}" font-family="${FONT}" font-size="27" font-weight="700" fill="#f3d27a" text-anchor="middle">${n}</text>`;
  });
  // a little snow, the same flakes on every card
  const snow = [
    [610, 70, 3],
    [1150, 110, 2.5],
    [660, 540, 2],
    [1120, 560, 3],
    [690, 120, 2],
    [1170, 330, 2],
    [880, 585, 2.5],
    [760, 60, 2]
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#ffffff" fill-opacity="0.35"/>`)
    .join('\n  ');
  const title = words.title
    .map((line, i) => `<text x="90" y="${232 + i * 66}" font-family="${FONT}" font-size="58" font-weight="800" fill="#f3efe2">${esc(line)}</text>`)
    .join('\n  ');
  const below = 232 + (words.title.length - 1) * 66;
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0f261d"/>
      <stop offset="1" stop-color="#173d2e"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c8cf8"/>
      <stop offset="1" stop-color="#a06ef5"/>
    </linearGradient>
    <pattern id="ribbon" width="48" height="10" patternUnits="userSpaceOnUse">
      <rect width="18" height="10" fill="#e06b78"/>
      <rect x="18" width="6" height="10" fill="#e7c26a"/>
      <rect x="24" width="18" height="10" fill="#2f7a5a"/>
      <rect x="42" width="6" height="10" fill="#e7c26a"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="10" fill="url(#ribbon)"/>
  ${snow}

  <g transform="translate(90,120)">
    <rect x="0" y="-48" width="64" height="64" rx="15" fill="url(#mark)"/>
    <text x="32" y="-4" font-family="${FONT}" font-size="30" font-weight="800" fill="#ffffff" text-anchor="middle">UI</text>
    <text x="80" y="-2" font-family="${FONT}" font-size="46" font-weight="800" fill="#f3efe2">sudok<tspan fill="#a99cf9">UI</tspan></text>
  </g>
  ${title}
  <text x="90" y="${below + 96}" font-family="${FONT}" font-size="92" font-weight="800" fill="#f3d27a">${year}</text>
  <text x="90" y="${below + 156}" font-family="${FONT}" font-size="26" fill="#cfe0d6">${esc(words.lines[0])}</text>
  <text x="90" y="${below + 194}" font-family="${FONT}" font-size="26" fill="#cfe0d6">${esc(words.lines[1])}</text>
  <text x="90" y="572" font-family="${FONT}" font-size="30" font-weight="700" fill="#e7c26a">sudokui.app</text>

  <g transform="translate(724,180)">
    ${doors.join('\n    ')}
  </g>
</svg>
`;
}

const { year } = pageCalendar(advent as AdventDoor[]);
const svgOnly = process.argv.includes('--svg-only');
const work = join(tmpdir(), 'sudokui-og-advent');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const out = resolve(process.cwd(), 'public');

const executablePath = process.env.OG_BROWSER || process.env.PW_CHROMIUM || undefined;
const browser = svgOnly ? null : await chromium.launch({ executablePath });
try {
  for (const lang of HOME_LANGS) {
    const svg = card(lang, year);
    const name = adventCardPath(lang, year);
    writeFileSync(join(work, name.split('/').pop()!.replace(/\.png$/, '.svg')), svg);
    if (!browser) continue;
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: join(out, name.slice(1)), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    await page.close();
    console.log(`wrote public${name}`);
  }
} finally {
  await browser?.close();
}
console.log(browser ? `SVGs in ${work}` : `SVGs in ${work}: rasterise each to public/<name>.png at 1200 x 630`);
