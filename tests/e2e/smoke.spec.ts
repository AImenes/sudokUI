/**
 * The app in a real browser, on the production build: the things a player
 * meets in the first minute, at a laptop size and on a phone. Run with
 * `npm run test:e2e` after `npm run build`.
 */
import { test, expect, Page } from '@playwright/test';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

async function open(page: Page, hash = `#p=${EASY}`) {
  await page.addInitScript(() => {
    localStorage.setItem('sudokui-welcomed', '1');
  });
  await page.goto(`/${hash}`);
  await expect(page.locator('svg.board')).toBeVisible();
}

const cellBox = async (page: Page, cell: number) => {
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  return { x: box.x + ((cell % 9) + 0.5) * size, y: box.y + (Math.floor(cell / 9) + 0.5) * size };
};

test.describe('desktop, 1280 x 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a repeated digit shows in red, a right one does not', async ({ page }) => {
    await open(page);
    // r1c1 is empty; the row already holds a 3 at r1c3
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Digit3');
    const value = page.locator('svg.board text', { hasText: /^3$/ }).first();
    await expect(page.locator('svg.board text[fill="var(--error-bg)"]')).toHaveCount(1);
    await page.keyboard.press('Digit4'); // the true digit
    await expect(page.locator('svg.board text[fill="var(--error-bg)"]')).toHaveCount(0);
    void value;
  });

  test('a digit pressed with nothing selected is armed, and a tap enters it', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Escape');
    const fours = page.locator('svg.board text', { hasText: /^4$/ });
    const before = await fours.count();
    await page.keyboard.press('Digit4');
    await expect(page.locator('.num-btn.armed')).toHaveText('4');
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await expect(fours).toHaveCount(before + 1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.num-btn.armed')).toHaveCount(0);
  });

  test('the hint panel and its buttons are on screen, and H walks the hint', async ({ page }) => {
    await open(page);
    await page.keyboard.press('KeyH');
    // the first assist asks; answer with the button
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await expect(page.locator('.hint-panel')).toBeVisible();
    const show = page.getByRole('button', { name: 'Show me' });
    await expect(show).toBeInViewport();
    await page.keyboard.press('KeyH');
    const apply = page.getByRole('button', { name: 'Apply step' });
    await expect(apply).toBeInViewport();
  });

  test('a wrong digit followed by a hint names the digit, not the marks', async ({ page }) => {
    await open(page);
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Digit7');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Hint/ }).first().click();
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'A placed digit is wrong' })).toBeVisible();
  });
});

test.describe('the walk', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('reveals a chain one link at a time, by arrow keys, with a sentence each', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
    });
    // a practice technique served from stored puzzles, so it starts at once
    await page.goto('/#practice=SIMPLE_COLORS');
    await expect(page.locator('svg.board')).toBeVisible();
    // the practice puzzle arrives from the worker; the bar appears with it
    await expect(page.locator('.practice-bar')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Hint/ }).first().click();
    const use = page.getByRole('button', { name: 'Use Hint' });
    if (await use.count()) await use.click();
    await page.getByRole('button', { name: 'Show me' }).click();
    const all = await page.locator('svg.board .chain-arrows path').count();
    await page.getByRole('button', { name: 'Walk through it' }).click();
    await expect(page.locator('.hint-walk-count')).toContainText('1 of');
    const first = await page.locator('.hint-walk-text').innerText();
    expect(first.length).toBeGreaterThan(10);
    const shown = await page.locator('svg.board .chain-arrows path').count();
    expect(shown).toBeLessThan(all);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.hint-walk-count')).toContainText('2 of');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.hint-walk-count')).toContainText('1 of');
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page.locator('.hint-walk-count')).toHaveCount(0);
    expect(await page.locator('svg.board .chain-arrows path').count()).toBe(all);
  });
});

test.describe('phone, 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('fits without horizontal scroll, with 44 px keys', async ({ page }) => {
    await open(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(wide).toBe(false);
    const key = (await page.locator('.num-btn').first().boundingBox())!;
    expect(key.height).toBeGreaterThanOrEqual(44);
    const mode = (await page.locator('.mode-btn').first().boundingBox())!;
    expect(mode.height).toBeGreaterThanOrEqual(40);
  });
});

test.describe('phone on its side, 844 x 390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('keeps the keypad beside the board', async ({ page }) => {
    await open(page);
    const board = (await page.locator('svg.board').boundingBox())!;
    const key = (await page.locator('.num-btn').first().boundingBox())!;
    expect(key.x).toBeGreaterThan(board.x + board.width - 1);
    await expect(page.locator('.num-btn').first()).toBeInViewport();
  });
});
