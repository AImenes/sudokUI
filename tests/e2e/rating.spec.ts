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
  // the address names the puzzle by its HoDoKu rating, whoever opened it
  await expect.poll(() => page.evaluate(() => location.search)).toBe('?b=unfair&s=1322');
  await setUniqueness(page, true);
  await expect(badge(page)).toHaveText('Unfair');
  await expect(score(page)).toHaveText('1322');
  await expect(page.locator('.game-meta .score-btn')).toHaveAttribute('title', 'How this rating is calculated');
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
