/**
 * A solved game in a real browser (the hunt of November 2026): the win
 * screen is a dialog as every other, Check, Steps and the rest used after
 * the win leave the solve as it was played, Undo or a Steps jump after it
 * puts the board back in play, a daily solved again shows its win screen
 * and says which solve stays its result; and the clock: a paused game
 * reloads paused, a reload keeps the time since the last move, and the
 * time the page is hidden does not count.
 */
import { test, expect, Page } from '@playwright/test';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import { readFileSync } from 'node:fs';
import { localDateKey } from '../../src/content/dailies';
import type { Daily } from '../../src/content/dailies';

/** the published dailies, read as a file: Playwright's loader takes no JSON import without an attribute */
const dailies: Daily[] = JSON.parse(new TextDecoder().decode(readFileSync('src/content/dailies.json')));

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

async function open(page: Page, path = `/#p=${EASY}`) {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await page.goto(path);
  await expect(page.locator('svg.board')).toBeVisible();
}

const cellBox = async (page: Page, cell: number) => {
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  return { x: box.x + ((cell % 9) + 0.5) * size, y: box.y + (Math.floor(cell / 9) + 0.5) * size };
};

const empties = (puzzle: string) => [...puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
const solutionOf = (puzzle: string) => gridToString(solve(parseGrid(puzzle)!)!);

/** a digit into a cell: a click on it, then the key */
async function enter(page: Page, cell: number, digit: string) {
  const c = await cellBox(page, cell);
  await page.mouse.click(c.x, c.y);
  await page.keyboard.press(`Digit${digit}`);
}

/** every empty cell filled; `beforeLast` runs before the last digit goes in */
async function solveBoard(page: Page, puzzle: string, beforeLast?: () => Promise<void>) {
  const solution = solutionOf(puzzle);
  const cells = empties(puzzle);
  for (const cell of cells) {
    if (beforeLast && cell === cells[cells.length - 1]) await beforeLast();
    await enter(page, cell, solution[cell]);
  }
}

const winScreen = (page: Page) => page.getByRole('dialog', { name: 'Puzzle solved' });
const secondsOn = async (page: Page) => {
  const [m, s] = (await page.locator('.timer').innerText()).split(':').map(Number);
  return m * 60 + s;
};

test.describe('a solved game', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the win screen is a dialog: focus moves into it, Tab stays inside, Escape closes it and focus goes back to the board', async ({ page }) => {
    await open(page);
    await solveBoard(page, EASY);
    const dialog = winScreen(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    // a screen reader hears what opened, and the result with it
    await expect(dialog).toBeFocused();
    await expect(dialog).toHaveAccessibleDescription(/^Easy · HoDoKu rating \d+ · \d+:\d\d$/);
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('.modal.victory'));
      expect(inside, `Tab ${i + 1} left the win screen`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.modal.victory'))).toBe(true);
    // nothing behind it was reached, so nothing opened under it
    await expect(page.getByRole('dialog')).toHaveCount(1);
    // Escape does what Admire the grid does, and the board has the focus again
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('svg.board')).toBeFocused();
    // the solved game's clock has stopped for good: the pause button has nothing to do
    const pause = page.getByRole('button', { name: 'Pause game' });
    await expect(pause).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Resume game' })).toHaveCount(0);
  });

  test('after a win, Check, Steps and Scan leave the daily unassisted: its Send button and its words stay, across a reload', async ({ page }) => {
    test.setTimeout(60_000);
    const today = localDateKey();
    const daily = dailies.find((d) => d.date === today)!;
    expect(daily, `a published daily for ${today}`).toBeTruthy();
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/daily/')) sent.push(r.url());
    });
    await open(page, `/daily/${today}`);
    await solveBoard(page, daily.puzzle);
    const dialog = winScreen(page);
    const send = dialog.getByRole('button', { name: /Send my time and compare/ });
    await expect(send).toBeVisible();
    await expect(dialog).toContainText('Unassisted solve: no help, every mark your own');
    await expect(dialog).toContainText('with your own marks');
    await dialog.getByRole('button', { name: 'Admire the grid' }).click();
    // to look at the solved board is no help with its solve: nothing asks
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Check' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Steps', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Steps' })).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Solution path' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Scan' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // and what has nothing left to do on a solved board is greyed out
    for (const name of ['Hint', 'Chain', 'Auto candidates', 'Fill candidates']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeDisabled();
    }
    await page.reload();
    const again = winScreen(page);
    await expect(again).toContainText('Unassisted solve: no help, every mark your own');
    await expect(again).toContainText('with your own marks');
    await expect(again.getByRole('button', { name: /Send my time and compare/ })).toBeVisible();
    expect(sent).toEqual([]);
  });

  test('a daily solved again by Restart shows its win screen, which says the first solve stays the day’s result', async ({ page }) => {
    test.setTimeout(90_000);
    const today = localDateKey();
    const daily = dailies.find((d) => d.date === today)!;
    expect(daily, `a published daily for ${today}`).toBeTruthy();
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/daily/')) sent.push(r.url());
    });
    await page.clock.install();
    await open(page, `/daily/${today}`);
    await solveBoard(page, daily.puzzle);
    const first = winScreen(page);
    await expect(first.getByRole('button', { name: /Send my time and compare/ })).toBeVisible();
    const [, firstTime] = /· (\d+:\d\d)$/.exec(await first.locator('p').first().innerText())!;
    await first.getByRole('button', { name: 'Admire the grid' }).click();
    await page.locator('.menu-row button', { hasText: 'Restart' }).click();
    await page.getByRole('dialog', { name: 'Restart puzzle?' }).getByRole('button', { name: 'Restart' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeEnabled();
    // a slower solve this time
    await solveBoard(page, daily.puzzle, () => page.clock.fastForward(45_000));
    const second = winScreen(page);
    await expect(second).toBeVisible();
    await expect(second).toContainText(`You solved this daily before, in ${firstTime}. That solve stays your result.`);
    await expect(second.getByRole('button', { name: /Send my time and compare/ })).toHaveCount(0);
    expect(sent).toEqual([]);
  });

  test('Undo after a win, or a Steps jump, leaves a board to play on, not a pause card', async ({ page }) => {
    await open(page);
    await solveBoard(page, EASY);
    await winScreen(page).getByRole('button', { name: 'Admire the grid' }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('.pause-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeEnabled();
    // the last digit goes in again: the same solve, whose win screen was put away
    // (its cell is still selected, and a tap on a selected cell lets it go)
    const solution = solutionOf(EASY);
    const cells = empties(EASY);
    const last = cells[cells.length - 1];
    await page.keyboard.press(`Digit${solution[last]}`);
    const where = `Row ${Math.floor(last / 9) + 1}, column ${(last % 9) + 1}`;
    await expect(page.locator('#board-status')).toHaveText(`${where}: ${solution[last]}.`);
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeDisabled();
    // Steps on the solved board, and a jump into its path: back in play
    await page.getByRole('button', { name: 'Steps', exact: true }).click();
    const path = page.getByRole('dialog', { name: 'Solution path' });
    const row = path.locator('.path-list > .path-row').first();
    await expect(row).toBeVisible();
    if (await row.evaluate((el) => el.classList.contains('path-group'))) await row.locator('.path-jump').click();
    else await row.click();
    await expect(path).toHaveCount(0);
    await expect(page.locator('.pause-card')).toHaveCount(0);
    const open1 = cells[0];
    await enter(page, open1, solution[open1]);
    await expect(page.locator('#board-status')).toHaveText(`Row ${Math.floor(open1 / 9) + 1}, column ${(open1 % 9) + 1}: ${solution[open1]}.`);
  });
});

test.describe('the clock', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a paused game comes back paused after a reload, its time as it stood', async ({ page }) => {
    await open(page);
    const cells = empties(EASY);
    await enter(page, cells[0], solutionOf(EASY)[cells[0]]);
    await page.waitForTimeout(2200);
    await page.getByRole('button', { name: 'Pause game' }).click();
    await expect(page.locator('.pause-card')).toBeVisible();
    const at = await page.locator('.timer').innerText();
    expect(at).not.toBe('0:00');
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(page.locator('.pause-card')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resume game' })).toBeVisible();
    await expect(page.locator('.timer')).toHaveText(at);
    await page.waitForTimeout(1500);
    await expect(page.locator('.timer')).toHaveText(at);
  });

  test('a reload, as the update bar’s Reload ends in, keeps the time since the last move', async ({ page }) => {
    await open(page);
    const cells = empties(EASY);
    await enter(page, cells[0], solutionOf(EASY)[cells[0]]);
    // thinking, with no move (the timer on screen redraws once a second)
    await page.waitForTimeout(4300);
    const before = await secondsOn(page);
    expect(before).toBeGreaterThanOrEqual(3);
    await page.evaluate(() => location.reload());
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await secondsOn(page)).toBeGreaterThanOrEqual(before);
    await expect(page.locator('.pause-card')).toHaveCount(0);
  });

  test('the time the page is hidden does not count, and the clock runs on when it is shown', async ({ page }) => {
    await open(page);
    const cells = empties(EASY);
    await enter(page, cells[0], solutionOf(EASY)[cells[0]]);
    const shown = (visible: boolean) =>
      page.evaluate((v) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
        document.dispatchEvent(new Event('visibilitychange'));
      }, visible);
    const before = await secondsOn(page);
    await shown(false);
    await page.waitForTimeout(4300);
    await shown(true);
    expect(await secondsOn(page)).toBeLessThanOrEqual(before + 1);
    // not a pause: no card, and the clock goes on (the timer redraws once a second)
    await expect(page.locator('.pause-card')).toHaveCount(0);
    await page.waitForTimeout(3300);
    expect(await secondsOn(page)).toBeGreaterThanOrEqual(before + 2);
  });
});
