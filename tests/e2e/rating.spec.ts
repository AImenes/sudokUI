/**
 * The rating follows the player's uniqueness setting, in a real browser
 * (docs/architecture.md, "The rating follows the uniqueness setting"): a
 * player who turns uniqueness off is shown each puzzle's rating worked out
 * without it, by the worker, the board never waiting; switching the
 * setting mid-game shows the figure for the new setting; a daily keeps
 * its published rating and the rating's title says it differs. The
 * Washington Post puzzle of November 2026 rates Unfair 1322 with
 * uniqueness and Extreme 2226 without; the daily of 27 October 2026 Hard
 * 1088 with it and Unfair 1208 without.
 */
import { test, expect, Page } from '@playwright/test';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';

const WAPO = '.4......1...7.5...9...3.........15.6.....2..8.79......4.2....3...53..8...9..4...7';

const withoutUniqueness = () => {
  localStorage.setItem('sudokui-welcomed', '1');
  if (!localStorage.getItem('sudokui-settings-v1')) localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { useUniqueness: false }, version: 2 }));
};

const badge = (page: Page) => page.locator('.game-meta .level-badge');
const score = (page: Page) => page.locator('.game-meta .score-btn strong');

async function setUniqueness(page: Page, on: boolean) {
  await page.getByRole('button', { name: 'Settings' }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  const toggle = settings.locator('label.setting-row', { hasText: 'Use uniqueness in hints' }).getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', String(!on));
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', String(on));
  await page.keyboard.press('Escape');
  await expect(settings).toBeHidden();
}

test('a player without uniqueness sees the rating without it, and the figure follows the setting mid-game', async ({ page }) => {
  await page.addInitScript(withoutUniqueness);
  await page.goto(`/p/${WAPO}`);
  await expect(page.locator('svg.board')).toBeVisible();
  await expect(badge(page)).toHaveText('Extreme');
  await expect(score(page)).toHaveText('2226');
  await expect(page.locator('.game-meta .score-btn')).toHaveAttribute('title', /^Rated without uniqueness techniques, as you play\. How this rating is calculated$/);
  // a small mark beside the score says it is the player's own; gone when the figure is HoDoKu's
  await expect(page.locator('.game-meta .score-btn .rating-own')).toHaveText('*');
  // the address names the puzzle by its HoDoKu rating, whoever opened it
  await expect.poll(() => page.evaluate(() => location.search)).toBe('?b=unfair&s=1322');
  await setUniqueness(page, true);
  await expect(badge(page)).toHaveText('Unfair');
  await expect(score(page)).toHaveText('1322');
  await expect(page.locator('.game-meta .score-btn')).toHaveAttribute('title', 'How this rating is calculated');
  await expect(page.locator('.game-meta .score-btn .rating-own')).toHaveCount(0);
  await setUniqueness(page, false);
  await expect(badge(page)).toHaveText('Extreme');
  await expect(score(page)).toHaveText('2226');
});

test('a daily keeps its published rating, and says the player’s own differs', async ({ page }) => {
  await page.addInitScript(withoutUniqueness);
  await page.goto('/daily/2026-10-27');
  await expect(page.locator('svg.board')).toBeVisible();
  await expect(badge(page)).toHaveText('Unfair');
  await expect(score(page)).toHaveText('1208');
  await expect(page.locator('.game-meta .score-btn')).toHaveAttribute(
    'title',
    'Rated without uniqueness techniques, as you play. The published rating is Hard, 1088. How this rating is calculated'
  );
  // the game keeps the published rating
  const info = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info);
  expect([info.level, info.score]).toEqual(['Hard', 1088]);
});

const empties = (puzzle: string) => [...puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);

/** every empty cell filled, a click on it and the key */
async function solveBoard(page: Page, puzzle: string) {
  const solution = gridToString(solve(parseGrid(puzzle)!)!);
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  for (const cell of empties(puzzle)) {
    await page.mouse.click(box.x + ((cell % 9) + 0.5) * size, box.y + (Math.floor(cell / 9) + 0.5) * size);
    await page.keyboard.press(`Digit${solution[cell]}`);
  }
}

test('the record line after a win counts and names the level the player saw', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(withoutUniqueness);
  const win = page.getByRole('dialog', { name: 'Puzzle solved' });
  // Unfair 1322 with uniqueness, Extreme 2226 without
  await page.goto(`/p/${WAPO}`);
  await expect(badge(page)).toHaveText('Extreme');
  await solveBoard(page, WAPO);
  await expect(win).toBeVisible();
  // Hard 1218 with uniqueness, Extreme 2318 without
  const HARD = '1.2...6....5..1.7.6.4..7.51...3..1...6..9..3...3..6...38.2..7.5.2.5..4....6...2.8';
  await page.goto(`/p/${HARD}`);
  await expect(badge(page)).toHaveText('Extreme');
  await expect(score(page)).toHaveText('2318');
  await solveBoard(page, HARD);
  await expect(win).toBeVisible();
  await expect(win).toContainText('Extreme · HoDoKu rating 2318');
  await expect(win.locator('.solve-record').first()).toHaveText(/^Your 2nd Extreme solve(, a new best|; best \d+:\d\d)$/);
});

test('the New dialog does not promise unique rectangles to a player without uniqueness', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(withoutUniqueness);
  await page.goto(`/p/${WAPO}`);
  await expect(page.locator('svg.board')).toBeVisible();
  await page.getByRole('button', { name: /New/ }).first().click();
  const hard = page.getByRole('dialog', { name: 'New game' }).locator('.level-btn.level-hard');
  await expect(hard).toContainText('fish, wings and kites');
  await expect(hard).not.toContainText('unique rectangles');
});
