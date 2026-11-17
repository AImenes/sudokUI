/**
 * The win screen's show in a real browser (the owner's asking of 17
 * November 2026): fireworks and confetti on a canvas over the dialog,
 * which springs in, with every button under it still working; Settings'
 * "Celebrate a solved puzzle" takes all of it away, and so does a device
 * that asks for less motion.
 */
import { test, expect, Page } from '@playwright/test';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

async function open(page: Page) {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await page.goto(`/#p=${EASY}`);
  await expect(page.locator('svg.board')).toBeVisible();
}

/** every empty cell filled, by a click on it and the key */
async function solveBoard(page: Page) {
  const solution = gridToString(solve(parseGrid(EASY)!)!);
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  for (let cell = 0; cell < 81; cell++) {
    if (EASY[cell] !== '.') continue;
    await page.mouse.click(box.x + ((cell % 9) + 0.5) * size, box.y + (Math.floor(cell / 9) + 0.5) * size);
    await page.keyboard.press(`Digit${solution[cell]}`);
  }
}

/** how many of the canvas's pixels have something drawn on them */
const painted = (page: Page) =>
  page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas.fireworks');
    if (!c || !c.width || !c.height) return -1;
    const data = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) n++;
    return n;
  });

test('a solved puzzle is celebrated: the show plays over the dialog, whose buttons still work, and then ends', async ({ page }) => {
  await open(page);
  await solveBoard(page);
  const win = page.getByRole('dialog', { name: 'Puzzle solved' });
  await expect(win).toBeVisible();
  await expect(win).toHaveClass(/\bparty\b/);
  const canvas = page.locator('canvas.fireworks');
  await expect(canvas).toBeVisible();
  // the canvas covers the page and takes no click
  const size = await canvas.evaluate((c) => ({ w: c.clientWidth, h: c.clientHeight, view: [innerWidth, innerHeight], events: getComputedStyle(c).pointerEvents }));
  expect([size.w, size.h]).toEqual(size.view);
  expect(size.events).toBe('none');
  // pieces fly: many pixels are painted soon after the win
  await expect.poll(() => painted(page), { timeout: 5000 }).toBeGreaterThan(500);
  // and it ends by itself, the canvas clear again
  await expect.poll(() => painted(page), { timeout: 15000 }).toBe(0);
  // a button under the canvas works
  await win.getByRole('button', { name: 'Admire the grid' }).click();
  await expect(win).toBeHidden();
  await expect(canvas).toHaveCount(0);
});

test('Settings can switch the celebration off: the win screen then opens with no show, no confetti and no spring', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const row = settings.locator('label.setting-row', { hasText: 'Celebrate a solved puzzle' });
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await row.getByRole('switch').click();
  await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
  // it is kept with the other settings
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-settings-v1')!).state.celebrate)).toBe(false);
  await solveBoard(page);
  const win = page.getByRole('dialog', { name: 'Puzzle solved' });
  await expect(win).toBeVisible();
  await expect(win).not.toHaveClass(/\bparty\b/);
  await expect(page.locator('canvas.fireworks')).toHaveCount(0);
  await expect(page.locator('.confetti')).toHaveCount(0);
});

test('a device that asks for less motion gets no show: the canvas is hidden and nothing is drawn on it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page);
  await solveBoard(page);
  const win = page.getByRole('dialog', { name: 'Puzzle solved' });
  await expect(win).toBeVisible();
  await expect(page.locator('canvas.fireworks')).toBeHidden();
  expect(await win.evaluate((d) => getComputedStyle(d).animationName)).toBe('none');
  await page.waitForTimeout(600);
  expect(await painted(page)).toBeLessThanOrEqual(0);
});
