/**
 * The social cards of the share pages (docs/online-goals.md, phase 1): one
 * per difficulty band in each language, 1200 x 630, written to public/og/
 * as <band>.png, <band>.nb.png and <band>.es.png, where share.ts points
 * every share address of that band (ogShareCard). A share page is
 * rendered per puzzle, but its image is one of these twenty-four: a chat
 * app fetches the image once per link, and a board rendered per puzzle
 * would cost the Worker time the free plan does not have.
 *
 * Each card shows the band's name in the language, where the band sits
 * among the eight, and a board: a real puzzle of that band, held to the
 * rater here so a card never shows a board of another band. It is the
 * band's example, not the puzzle behind the link.
 *
 *   npx vite-node scripts/og-share-cards.ts [--svg-only]
 *
 * The SVGs go to a temporary folder and are rasterised with a headless
 * Chromium: the one OG_BROWSER names, else Edge or Chrome where they
 * usually live. With --svg-only, or without a browser, the SVGs are left
 * there to rasterise by hand (1200 x 630, device scale 1).
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { LEVELS, Level } from '../src/engine/ratings';
import { ratePuzzle } from '../src/engine/humanSolver';
import { HOME_LANGS } from '../src/content/home';
import { levelName, ogShareCard } from '../src/content/share';
import type { Lang } from '../src/state/settings';

/**
 * The board on each card: a puzzle of the band, givens only, rotationally
 * symmetric where the generator found one. Checked against the rater on
 * every run: when a rating change moves one of them out of its band, the
 * run stops and asks for another puzzle (scripts/bench-generator.ts, or
 * the seed library for the hardest bands).
 */
const BOARD: Record<Level, string> = {
  Beginner: '.......8...4.5367....76.5..6.2.1....8..5.9..6....3.8.4..5.47....2169.7...9.......',
  Easy: '.95.4...1.18......7..16..8....6..8....37.21....6..5....6..51..3......71.8...9.64.',
  Medium: '.2...8.......9...5..83.6..7...7..2.4..2...9..5.3..9...1..5.37..6...2.......6...9.',
  Tricky: '3.8..4..2.4..6.5..6....7....3....17...2...4...57....8....9....1..9.1..2.2..8..6.9',
  Hard: '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...',
  Unfair: '..1.....5..9.12..3..5...4......4.5.8.2..6..4.3.4.2......6...8..4..79.6..9.....1..',
  Extreme: '..1.9.67..7.5....1...4.1....4.......2.8..9..66......8.92...8........2..3..3..542.',
  Nightmare: '......1.3.91......7..1...492.5.6.....7.9.5.8.....4.5.142...3..6......81.6.9......'
};

/** the band's colour, as its badge wears it in the app's dark theme (src/ui/styles.css) */
const BAND_COLOR: Record<Level, string> = {
  Beginner: '#6fd0cd',
  Easy: '#7fd486',
  Medium: '#b5d47f',
  Tricky: '#d3d36a',
  Hard: '#e6c74c',
  Unfair: '#e8934a',
  Extreme: '#ef7783',
  Nightmare: '#b78ae8'
};

/** the card's words per language; each line fits the space left of the board */
const WORDS: Record<Lang, { rank: (n: number, of: number) => string; lines: [string, string] }> = {
  en: {
    rank: (n, of) => `Difficulty ${n} of ${of}`,
    lines: ['Free, with hints that explain every step.', 'Works offline. No ads, no account.']
  },
  nb: {
    rank: (n, of) => `Vanskelighetsgrad ${n} av ${of}`,
    lines: ['Gratis, med hint som forklarer hvert steg.', 'Virker uten nett. Ingen reklame, ingen konto.']
  },
  es: {
    rank: (n, of) => `Dificultad ${n} de ${of}`,
    lines: ['Gratis, con pistas que explican cada paso.', 'Funciona sin conexión, sin anuncios ni cuenta.']
  }
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const FONT = 'Helvetica, Arial, sans-serif';

function card(level: Level, lang: Lang): string {
  const puzzle = BOARD[level];
  const color = BAND_COLOR[level];
  const words = WORDS[lang];
  const CELL = 420 / 9;
  const values: string[] = [];
  for (let c = 0; c < 81; c++) {
    if (puzzle[c] === '.') continue;
    const x = (c % 9) * CELL + CELL / 2;
    const y = Math.floor(c / 9) * CELL + CELL / 2 + 12;
    values.push(`<text x="${x.toFixed(1)}" y="${y.toFixed(1)}">${puzzle[c]}</text>`);
  }
  const rank = LEVELS.indexOf(level) + 1;
  const pills = LEVELS.map(
    (_, i) => `<rect x="${i * 30}" y="0" width="22" height="10" rx="5" fill="${i < rank ? color : '#2b3147'}"/>`
  );
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#151827"/>
      <stop offset="1" stop-color="#1e2233"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#7c8cf8"/>
      <stop offset="1" stop-color="#a06ef5"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <g transform="translate(710,105)">
    <rect x="-14" y="-14" width="448" height="448" rx="18" fill="#11141f"/>
    <g stroke="#2b3147" stroke-width="1.5">
      <path d="M${CELL} 0V420 M${2 * CELL} 0V420 M${4 * CELL} 0V420 M${5 * CELL} 0V420 M${7 * CELL} 0V420 M${8 * CELL} 0V420"/>
      <path d="M0 ${CELL}H420 M0 ${2 * CELL}H420 M0 ${4 * CELL}H420 M0 ${5 * CELL}H420 M0 ${7 * CELL}H420 M0 ${8 * CELL}H420"/>
    </g>
    <g stroke="#4a5372" stroke-width="3.5" fill="none">
      <rect x="0" y="0" width="420" height="420" rx="6"/>
      <path d="M140 0V420 M280 0V420 M0 140H420 M0 280H420"/>
    </g>
    <g fill="#e8ecf6" font-family="${FONT}" font-size="32" font-weight="700" text-anchor="middle">
      ${values.join('\n      ')}
    </g>
  </g>

  <g transform="translate(90,150)">
    <rect x="0" y="-62" width="84" height="84" rx="20" fill="url(#mark)"/>
    <text x="42" y="-2" font-family="${FONT}" font-size="40" font-weight="800" fill="#ffffff" text-anchor="middle">UI</text>
    <text x="104" y="-4" font-family="${FONT}" font-size="64" font-weight="800" fill="#e8ecf6">sudok<tspan fill="#8f7ef7">UI</tspan></text>
  </g>

  <text x="90" y="300" font-family="${FONT}" font-size="76" font-weight="800" fill="${color}">${esc(levelName(level, lang))}</text>
  <g transform="translate(92,330)">
    ${pills.join('\n    ')}
  </g>
  <text x="90" y="384" font-family="${FONT}" font-size="28" fill="#aab3cb">${esc(words.rank(rank, LEVELS.length))}</text>
  <text x="90" y="446" font-family="${FONT}" font-size="25" fill="#7e879e">${esc(words.lines[0])}</text>
  <text x="90" y="484" font-family="${FONT}" font-size="25" fill="#7e879e">${esc(words.lines[1])}</text>
  <text x="90" y="560" font-family="${FONT}" font-size="30" font-weight="700" fill="#8f9df8">sudokui.app</text>
</svg>
`;
}

/** the file name share.ts asks for, so the two cannot drift */
const fileName = (level: Level, lang: Lang) => ogShareCard(level, lang).split('/og/')[1];

/** a headless Chromium to rasterise with, where one usually lives */
function findBrowser(): string | null {
  const candidates = [
    process.env.OG_BROWSER,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter((p): p is string => !!p);
  return candidates.find((p) => existsSync(p)) ?? null;
}

/** the width and height a PNG declares */
function pngSize(file: string): [number, number] {
  const b = readFileSync(file);
  if (b.length < 24 || b.toString('latin1', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

// every board is of its band, today
for (const level of LEVELS) {
  const r = ratePuzzle(BOARD[level]);
  if (!r || !r.solvable || r.level !== level) {
    throw new Error(`${level}: its board rates ${r ? r.level : 'as unsolvable'} now. Pick another puzzle of the band for BOARD.`);
  }
}

const svgOnly = process.argv.includes('--svg-only');
const work = join(tmpdir(), 'sudokui-og-cards');
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const out = resolve(process.cwd(), 'public', 'og');
mkdirSync(out, { recursive: true });

const browser = svgOnly ? null : findBrowser();
if (!browser) console.log(svgOnly ? 'SVGs only.' : 'No headless Chromium found (set OG_BROWSER): writing SVGs only.');

for (const level of LEVELS) {
  for (const lang of HOME_LANGS) {
    const name = fileName(level, lang);
    const svg = join(work, name.replace(/\.png$/, '.svg'));
    writeFileSync(svg, card(level, lang));
    if (!browser) continue;
    const png = join(out, name);
    rmSync(png, { force: true });
    // the browser's first process may hand the work to a child and return
    // at once (Edge on Windows does), so the file is waited for, and each
    // card gets a profile of its own so no launch joins an earlier one
    execFileSync(
      browser,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        '--no-first-run',
        '--no-default-browser-check',
        `--user-data-dir=${join(work, `profile-${name}`)}`,
        '--force-device-scale-factor=1',
        '--window-size=1200,630',
        `--screenshot=${png}`,
        pathToFileURL(svg).href
      ],
      { stdio: 'ignore', timeout: 90_000 }
    );
    const until = Date.now() + 60_000;
    let size: [number, number] | null = null;
    while (!size && Date.now() < until) {
      try {
        if (existsSync(png)) size = pngSize(png);
      } catch {
        // still being written
      }
      if (!size) execFileSync(process.execPath, ['-e', 'setTimeout(() => {}, 250)']);
    }
    if (!size) throw new Error(`${name}: the browser wrote no screenshot within a minute`);
    if (size[0] !== 1200 || size[1] !== 630) throw new Error(`${name}: ${size[0]} x ${size[1]}, wanted 1200 x 630`);
    console.log(`wrote public/og/${name}`);
  }
}
console.log(browser ? `SVGs in ${work}` : `SVGs in ${work}: rasterise each to public/og/<name>.png at 1200 x 630`);
