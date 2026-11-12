/**
 * Offline and after a deploy, on the production build: a part of the app
 * whose file cannot be fetched leaves the game playable and the update
 * bar's Reload reloads; Nutella and the privacy page are there offline;
 * a phone on its side keeps the board clear of the notch and the home bar.
 * Run with `npm run test:e2e` after `npm run build`.
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import { PRIVACY } from '../../src/content/privacy';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const SOLUTION = gridToString(solve(parseGrid(EASY)!)!);
/** row 5, column 5: empty in EASY */
const CELL = 40;
/** the guide's own file (src/ui/Learn.tsx, its own chunk) */
const GUIDE_FILE = /\/assets\/Learn-[^/]+\.js$/;

async function open(page: Page, hash = `#p=${EASY}`) {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await page.goto(`/${hash}`);
  await expect(page.locator('svg.board')).toBeVisible();
}

/** enters the true digit in CELL with the mouse and the keyboard */
async function playTheCell(page: Page) {
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  await page.mouse.click(box.x + ((CELL % 9) + 0.5) * size, box.y + (Math.floor(CELL / 9) + 0.5) * size);
  await page.keyboard.press(`Digit${SOLUTION[CELL]}`);
  await expect(page.locator('#board-status')).toContainText(`Row 5, column 5: ${SOLUTION[CELL]}`);
}

/** the service worker has installed (and so precached the app): the page itself stays uncontrolled, as on a first visit */
async function installed(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}

/** the app opened again with no connection, as an installed app is relaunched */
async function relaunchOffline(context: BrowserContext, path = '/') {
  await context.setOffline(true);
  const again = await context.newPage();
  await again.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await again.goto(path);
  return again;
}

const seconds = (clock: string) => {
  const [m, s] = clock.trim().split(':').map(Number);
  return m * 60 + s;
};

test.describe('a part whose file cannot be fetched', () => {
  // an in-app browser with no service worker: every file comes from the network
  test.use({ serviceWorkers: 'block' });

  test('the guide: the update bar says so, and the board stays and plays on', async ({ page }) => {
    const crashes: string[] = [];
    page.on('console', (m) => {
      if (m.text().includes('sudokUI crashed')) crashes.push(m.text());
    });
    await open(page);
    // the deploy moved on: this tab's copy of the guide is gone
    await page.route(GUIDE_FILE, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
    await page.locator('footer.app-footer').getByRole('link', { name: 'Techniques' }).click();
    const bar = page.locator('.update-bar');
    await expect(bar).toContainText('A part of sudokUI could not load. Reload to continue; your game is saved.');
    await expect(bar.getByRole('button', { name: 'Reload' })).toBeVisible();
    await expect(page.locator('.crash')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(crashes).toEqual([]);
    await playTheCell(page);
  });
});

test.describe('Reload', () => {
  test('after a file failed in a first visit, with no new worker waiting, reloads into the app with the game and its clock kept', async ({
    page
  }) => {
    await open(page);
    await installed(page);
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(false);
    await playTheCell(page);
    await page.route(GUIDE_FILE, (route) => route.fulfill({ status: 404, contentType: 'text/plain', body: 'not found' }));
    await page.locator('footer.app-footer').getByRole('link', { name: 'Techniques' }).click();
    const reload = page.locator('.update-bar').getByRole('button', { name: 'Reload' });
    await expect(reload).toBeVisible();
    await page.unroute(GUIDE_FILE);
    // the clock runs on after the move: its time is saved with the game
    await page.waitForTimeout(3000);
    const before = seconds(await page.locator('.timer').innerText());
    await page.evaluate(() => ((window as any).__sameDocument = true));
    await Promise.all([page.waitForEvent('load'), reload.click()]);
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await page.evaluate(() => (window as any).__sameDocument ?? false)).toBe(false);
    expect(seconds(await page.locator('.timer').innerText())).toBeGreaterThanOrEqual(before);
    await expect(page.locator('.update-bar')).toHaveCount(0);
    // a game under way comes back behind the pause card (the page was left)
    await expect(page.locator('.pause-card')).toBeVisible();
    await page.getByRole('button', { name: 'Resume game' }).click();
    // the move is still on the board, and the guide opens now
    const box = (await page.locator('svg.board').boundingBox())!;
    const size = box.width / 9;
    await page.mouse.click(box.x + ((CELL % 9) + 0.5) * size, box.y + (Math.floor(CELL / 9) + 0.5) * size);
    await expect(page.locator('#board-status')).toContainText(`Row 5, column 5: ${SOLUTION[CELL]}`);
    await page.locator('footer.app-footer').getByRole('link', { name: 'Techniques' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('offline', () => {
  test('Nutella is there, from the service worker', async ({ page, context }) => {
    await page.addInitScript(() =>
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { showPoodle: true }, version: 1 }))
    );
    await open(page);
    await installed(page);
    const again = await relaunchOffline(context);
    const poodle = again.locator('img.poodle');
    await expect(poodle).toBeVisible();
    await expect.poll(() => poodle.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(320);
  });

  test("the footer's Privacy link opens the privacy page, in each language", async ({ page, context }) => {
    await open(page);
    await installed(page);
    const again = await relaunchOffline(context);
    await expect(again.locator('svg.board')).toBeVisible();
    const link = again.locator('footer.app-footer').getByRole('link', { name: 'Privacy' });
    // a real address for search engines, opened in place
    await expect(link).toHaveAttribute('href', '/privacy/');
    await link.click();
    await expect(again).toHaveURL(/\/privacy\/$/);
    await expect(again.locator('h1')).toHaveText(PRIVACY.en.h1);
    for (const lang of ['nb', 'es'] as const) {
      await again.goto(`/${lang}/privacy/`);
      await expect(again.locator('h1')).toHaveText(PRIVACY[lang].h1);
    }
  });
});

test.describe('an installed iPhone on its side', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  test('keeps the board and the column beside it clear of the notch and the home bar', async ({ page }) => {
    const inset = { left: 47, right: 47, bottom: 21, top: 0 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: inset });
    await open(page);
    const [width, height] = [844, 390];
    const board = (await page.locator('svg.board').boundingBox())!;
    const side = (await page.locator('.side').boundingBox())!;
    expect(board.x).toBeGreaterThanOrEqual(inset.left);
    expect(board.y + board.height).toBeLessThanOrEqual(height - inset.bottom);
    expect(side.x + side.width).toBeLessThanOrEqual(width - inset.right);
    // and at the end of the column, its last line clears the home bar
    await page.locator('.layout').evaluate((layout) => (layout.scrollTop = layout.scrollHeight));
    const footer = (await page.locator('.app-footer').boundingBox())!;
    expect(footer.y + footer.height).toBeLessThanOrEqual(height - inset.bottom);
  });
});
