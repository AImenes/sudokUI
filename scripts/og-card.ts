/**
 * Generates the social preview card (public/og-card.png source SVG).
 *
 * The board on the card is real: a generated puzzle whose solve path
 * requires an X-Wing, fast-forwarded to the exact position where the
 * X-Wing applies. Pattern cells are highlighted with the fish digit as a
 * pencil mark and the eliminated candidates are shown in red — the same
 * visual language the app uses for hints.
 *
 * Usage: npx vite-node scripts/og-card.ts <out.svg>
 * Then rasterise to 1200x630 PNG (e.g. headless Chrome --screenshot).
 */
import { writeFileSync } from 'node:fs';
import { parseGrid, gridToString } from '../src/engine/board';
import { generateWhere, requiresTechnique } from '../src/engine/generator';
import { findNextStep, applyStep } from '../src/engine/humanSolver';

const res = generateWhere(requiresTechnique('X_WING'), 400);
if (!res) throw new Error('no X-Wing puzzle found in budget');

const g = parseGrid(res.puzzle);
let step = findNextStep(g);
while (step && step.tech !== 'X_WING') {
  applyStep(g, step);
  step = findNextStep(g);
}
if (!step || !step.primary?.length) throw new Error('X-Wing step not reached');

const digit = step.primary[0].digit;
const pattern = new Set(step.primary.map((p) => p.cell));
const elims = new Set(step.eliminations.map((e) => e.cell));
console.log(`position: ${gridToString(g)}`);
console.log(`X-Wing on ${digit}s, cells ${[...pattern]}, elims ${[...elims]}`);

const CELL = 420 / 9;
const parts: string[] = [];
for (const c of pattern) {
  parts.push(
    `<rect x="${(c % 9) * CELL}" y="${Math.floor(c / 9) * CELL}" width="${CELL}" height="${CELL}" fill="#7c8cf8" opacity="0.28"/>`
  );
}
const values: string[] = [];
const marks: string[] = [];
for (let c = 0; c < 81; c++) {
  const x = (c % 9) * CELL + CELL / 2;
  if (g.values[c]) {
    values.push(`<text x="${x.toFixed(1)}" y="${(Math.floor(c / 9) * CELL + CELL / 2 + 12).toFixed(1)}">${g.values[c]}</text>`);
  } else if (pattern.has(c) || elims.has(c)) {
    const fill = pattern.has(c) ? '#a8b4fa' : '#e06c75';
    marks.push(
      `<text x="${x.toFixed(1)}" y="${(Math.floor(c / 9) * CELL + CELL / 2 + 8).toFixed(1)}" fill="${fill}">${digit}</text>`
    );
  }
}

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
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
    ${parts.join('\n    ')}
    <g stroke="#2b3147" stroke-width="1.5">
      <path d="M${CELL} 0V420 M${2 * CELL} 0V420 M${4 * CELL} 0V420 M${5 * CELL} 0V420 M${7 * CELL} 0V420 M${8 * CELL} 0V420"/>
      <path d="M0 ${CELL}H420 M0 ${2 * CELL}H420 M0 ${4 * CELL}H420 M0 ${5 * CELL}H420 M0 ${7 * CELL}H420 M0 ${8 * CELL}H420"/>
    </g>
    <g stroke="#4a5372" stroke-width="3.5" fill="none">
      <rect x="0" y="0" width="420" height="420" rx="6"/>
      <path d="M140 0V420 M280 0V420 M0 140H420 M0 280H420"/>
    </g>
    <g fill="#e8ecf6" font-family="Helvetica, Arial, sans-serif" font-size="32" font-weight="700" text-anchor="middle">
      ${values.join('\n      ')}
    </g>
    <g font-family="Helvetica, Arial, sans-serif" font-size="21" font-weight="700" text-anchor="middle">
      ${marks.join('\n      ')}
    </g>
  </g>

  <g transform="translate(90,200)">
    <rect x="0" y="-62" width="84" height="84" rx="20" fill="url(#mark)"/>
    <text x="42" y="-2" font-family="Helvetica, Arial, sans-serif" font-size="40" font-weight="800" fill="#ffffff" text-anchor="middle">UI</text>
    <text x="104" y="-4" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="800" fill="#e8ecf6">sudok<tspan fill="#8f7ef7">UI</tspan></text>
    <text x="2" y="86" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#aab3cb">Play · Practise · Rate</text>
    <text x="2" y="140" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#7e879e">77 solving techniques, explainable hints,</text>
    <text x="2" y="180" font-family="Helvetica, Arial, sans-serif" font-size="27" fill="#7e879e">shareable puzzles. Free &amp; open source.</text>
    <text x="2" y="266" font-family="Helvetica, Arial, sans-serif" font-size="30" font-weight="700" fill="#8f9df8">sudokui.app</text>
  </g>
</svg>
`;

writeFileSync(process.argv[2] ?? 'og-card.svg', svg);
console.log(`wrote ${process.argv[2] ?? 'og-card.svg'}`);
