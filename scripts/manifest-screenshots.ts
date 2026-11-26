/**
 * The two pictures an install sheet shows (the web manifest's
 * `screenshots`, src/content/manifest.ts): a narrow one for phones,
 * 1080 x 1920, and a wide one for laptops, 1280 x 800. Taken from the
 * built app, so they show what an installed app really looks like:
 *
 *   npm run build
 *   npx vite-node scripts/manifest-screenshots.ts
 *
 * It serves dist/ with `vite preview` on SHOT_PORT (5815 by default),
 * opens a Medium puzzle with a hint drawn on the board,
 * in English, in the default dark look, on a date outside the Christmas
 * season (the pictures are kept all year), with service workers blocked
 * so no "ready to play offline" line is in the picture, and writes
 * public/screenshots/narrow.png and wide.png. A browser of your own can
 * be pointed at with PW_CHROMIUM=/path/to/chromium. The files are for the
 * install sheet only: the service worker never precaches them
 * (vite.config.ts, globIgnores).
 */
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { MANIFEST_SCREENSHOTS } from '../src/content/manifest';
import dailies from '../src/content/dailies.json';
import type { Daily } from '../src/content/dailies';

const PORT = Number(process.env.SHOT_PORT ?? 5815);
const BASE = `http://localhost:${PORT}`;
/** the first published Medium daily: a real puzzle whose hint is drawn on the board */
const PUZZLE = (dailies as Daily[]).find((d) => d.level === 'Medium')!.puzzle;

async function serve() {
  // vite itself, not through npx, so stopping it stops the server
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/`)).ok) return server;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  server.kill();
  throw new Error(`vite preview did not answer on ${BASE}`);
}

/** the puzzle on the board and a hint asked for */
async function stage(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));
  await page.goto(`${BASE}/#p=${PUZZLE}`);
  await page.locator('svg.board').waitFor();
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Hint$/ }).first().click();
  // the question before the first hint, then the step drawn on the board
  await page.getByRole('button', { name: 'Use Hint', exact: true }).click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await page.waitForTimeout(1200);
  // the board at the top of a phone's screen, as the app opens
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
}

const server = await serve();
try {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  mkdirSync(resolve('public/screenshots'), { recursive: true });
  for (const shot of MANIFEST_SCREENSHOTS) {
    const [w, h] = shot.sizes.split('x').map(Number);
    const narrow = shot.form_factor === 'narrow';
    // a phone at three device pixels to the CSS pixel, as most are
    const scale = narrow ? 3 : 1;
    const context = await browser.newContext({
      viewport: { width: w / scale, height: h / scale },
      deviceScaleFactor: scale,
      isMobile: narrow,
      hasTouch: narrow,
      locale: 'en-GB',
      colorScheme: 'dark',
      serviceWorkers: 'block'
    });
    const page = await context.newPage();
    await stage(page);
    await page.screenshot({ path: resolve('public', shot.src) });
    console.log(`wrote public/${shot.src} (${shot.sizes})`);
    await context.close();
  }
  await browser.close();
} finally {
  server.kill();
}
