/**
 * Pictures for the owner to post (the owner's asking of 23 November 2026:
 * "standalone PNGs and other wallpapers for the app in general to promote
 * it, both for christmas and regular"). The site's own cards are all
 * 1200 x 630 link previews; these are the two shapes a post wants, a
 * square (1080 x 1080) and a story (1080 x 1920), in English and
 * Norwegian:
 *
 *   regular    the app's mark, what it is in a line, and one of the app's
 *              own drawn hint examples (dist/learn/img/x-chain.svg)
 *   christmas  the advent calendar: its name and days on the calendar's
 *              pine and gold, with the door pictures (public/og/advent/)
 *              cropped to their centred squares
 *
 * Written to promo/, which the site does not serve: they are for posting,
 * not for the app. Needs a build first (npm run build), for the example.
 *
 *   npx vite-node scripts/promo-cards.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const OUT = resolve('promo');
const FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";
const uri = (path: string, type: string) => `data:${type};base64,${readFileSync(resolve(path)).toString('base64')}`;
const ICON = uri('public/icon.svg', 'image/svg+xml');
const BOARD = uri('dist/learn/img/x-chain.svg', 'image/svg+xml');
const door = (n: number) => uri(`public/og/advent/door-${String(n).padStart(2, '0')}.png`, 'image/png');

type Lang = 'en' | 'nb';
const WORDS: Record<Lang, { head: string; sub: string; chips: string[]; xmas: [string, string]; xmasLine: string }> = {
  en: {
    head: 'Sudoku hints that teach',
    sub: 'Stuck? The hint draws the technique on your own board and says why it works.',
    chips: ['Free', 'No ads', 'No account', 'Works offline'],
    xmas: ['Sudoku advent calendar', '1–24 December'],
    xmasLine: 'A door a day, a little harder each day. Free.'
  },
  nb: {
    head: 'Sudokuhint du lærer av',
    sub: 'Står du fast? Hintet tegner teknikken på ditt eget brett og sier hvorfor den virker.',
    chips: ['Gratis', 'Ingen reklame', 'Ingen konto', 'Virker uten nett'],
    xmas: ['Sudoku-julekalender', '1.–24. desember'],
    xmasLine: 'Én luke hver dag, litt vanskeligere for hver dag. Gratis.'
  }
};

const brand = (size: number, ink = '#ffffff') =>
  `<div class="brand" style="font-size:${size}px;color:${ink}"><img src="${ICON}" style="width:${size * 1.5}px;height:${size * 1.5}px"><span>sudok<b>UI</b></span></div>`;

const base = (w: number, h: number, body: string, css: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:${w}px;height:${h}px}
body{font-family:${FONT};overflow:hidden;display:flex;flex-direction:column;align-items:center}
.brand{display:flex;align-items:center;gap:.45em;font-weight:800;letter-spacing:-.01em}
.brand b{background:linear-gradient(90deg,#7aa6f0,#b08ae8);-webkit-background-clip:text;color:transparent}
${css}</style></head><body>${body}</body></html>`;

function regular(lang: Lang, story: boolean): string {
  const t = WORDS[lang];
  const [w, h] = story ? [1080, 1920] : [1080, 1080];
  const board = story ? 900 : 560;
  return base(
    w,
    h,
    `${brand(story ? 56 : 40)}
     <h1>${t.head}</h1>
     <p class="sub">${t.sub}</p>
     <div class="card"><img src="${BOARD}"></div>
     <div class="chips">${t.chips.map((c) => `<span>${c}</span>`).join('')}</div>
     <div class="site">sudokui.app</div>`,
    `body{background:radial-gradient(120% 90% at 50% 0%,#232a4a 0%,#12162a 55%,#0b0e1c 100%);color:#fff;justify-content:space-between;padding:${story ? '120px 70px 130px' : '54px 60px 50px'}}
     h1{font-size:${story ? 112 : 76}px;font-weight:800;letter-spacing:-.03em;line-height:1.04;text-align:center;margin-top:${story ? 30 : 6}px}
     .sub{font-size:${story ? 40 : 28}px;line-height:1.35;color:#b9c2de;text-align:center;max-width:${story ? 900 : 880}px}
     .card{width:${board}px;height:${board}px;background:#fff;border-radius:${story ? 36 : 26}px;padding:${story ? 22 : 14}px;box-shadow:0 30px 80px rgba(0,0,0,.55),0 0 0 1px rgba(255,255,255,.08)}
     .card img{width:100%;height:100%;display:block}
     .chips{display:flex;gap:${story ? 18 : 12}px;flex-wrap:wrap;justify-content:center}
     .chips span{font-size:${story ? 34 : 24}px;font-weight:600;color:#dfe6fb;border:2px solid rgba(160,180,240,.35);border-radius:999px;padding:${story ? '12px 26px' : '7px 18px'}}
     .site{font-size:${story ? 64 : 44}px;font-weight:800;letter-spacing:.01em;color:#fff}`
  );
}

function christmas(lang: Lang, story: boolean): string {
  const t = WORDS[lang];
  const [w, h] = story ? [1080, 1920] : [1080, 1080];
  const tile = (n: number) => `<div class="tile"><img src="${door(n)}"></div>`;
  const title = `<div class="tile title">${brand(story ? 44 : 26, '#f6efe0')}<h1>${t.xmas[0]}</h1><p class="days">${t.xmas[1]}</p>${story ? `<p class="line">${t.xmasLine}</p>` : ''}<p class="site">sudokui.app</p></div>`;
  const body = story
    ? `${title}<div class="grid">${[1, 7, 12, 15, 20, 24].map(tile).join('')}</div>`
    : `<div class="grid">${[1, 3, 7, 12].map(tile).join('')}${title}${[15, 20, 22, 24].map(tile).join('')}</div>`;
  return base(
    w,
    h,
    body,
    `body{background:#173d2e;background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.035) 0 6px,transparent 6px 12px),repeating-linear-gradient(-45deg,rgba(0,0,0,.06) 0 6px,transparent 6px 12px);color:#f6efe0;justify-content:center;padding:${story ? '0 50px' : '0'};border-top:14px solid #e7c26a;border-bottom:14px solid #e7c26a}
     .grid{display:grid;grid-template-columns:repeat(${story ? 2 : 3},1fr);gap:${story ? 22 : 16}px;width:${story ? 820 : 1016}px}
     .tile{aspect-ratio:1;border-radius:${story ? 28 : 22}px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.35)}
     .tile img{width:100%;height:100%;object-fit:cover;display:block}
     .title{background:#a8233d;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:${story ? 14 : 8}px;padding:${story ? 40 : 14}px;border:4px solid #e7c26a}
     .title h1{font-size:${story ? 84 : 38}px;font-weight:800;line-height:1.05;letter-spacing:-.02em;color:#f3d27a}
     .days{font-size:${story ? 52 : 27}px;font-weight:700}
     .line{font-size:34px;line-height:1.3;color:#f6e7c8;max-width:860px}
     .site{font-size:${story ? 48 : 25}px;font-weight:800;color:#fff}
     ${story ? '.title{aspect-ratio:auto;width:980px;margin-bottom:26px;padding:40px 36px;flex-shrink:0;overflow:visible}' : ''}`
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.OG_BROWSER ?? process.env.PW_CHROMIUM ?? undefined });
  for (const lang of ['en', 'nb'] as Lang[]) {
    for (const story of [false, true]) {
      for (const [name, html] of [['regular', regular(lang, story)], ['christmas', christmas(lang, story)]] as const) {
        const page = await browser.newPage({ viewport: story ? { width: 1080, height: 1920 } : { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'load' });
        await page.evaluate(() => document.fonts.ready);
        const file = resolve(OUT, `sudokui-${name}-${story ? 'story' : 'square'}.${lang}.png`);
        writeFileSync(file, await page.screenshot({ type: 'png' }));
        console.log(file);
        await page.close();
      }
    }
  }
  await browser.close();
}

void main();
