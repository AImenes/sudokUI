/**
 * The season's rules in a real browser, the day set by Playwright's clock.
 *
 * The future-daily lock (src/content/dailies.ts, dailyLocked; src/ui/links.ts):
 * a daily whose day is after the player's local today opens nothing, not by
 * its address (a reload of it too), nor pasted into Import, and the toast
 * says when it opens; the game on the board stays as it was, with nothing
 * set aside; an earlier day's daily opens as before.
 */
import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Daily } from '../../src/content/dailies';

const dailies: Daily[] = JSON.parse(new TextDecoder().decode(readFileSync('src/content/dailies.json')));
const byDate = (date: string) => dailies.find((d) => d.date === date)!;

const welcomed = () => localStorage.setItem('sudokui-welcomed', '1');
/** the game on the board and the one in the slot, as they were saved */
const saved = (page: Page) =>
  page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state ?? {};
    return { dailyKey: (state.info?.dailyKey ?? null) as string | null, puzzle: (state.info?.puzzle ?? null) as string | null, kept: !!state.setAside };
  });
const toast = (page: Page, text: string) => page.locator('.toast').filter({ hasText: text });
/** the player's local noon of a day: no time zone moves the date */
const noon = (date: string) => new Date(`${date}T12:00:00`);

test.describe('a daily whose day has not come', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('opens nothing by its address, for a new player or over a game, and says when it opens', async ({ page }) => {
    await page.clock.setFixedTime(noon('2026-11-12'));
    await page.addInitScript(welcomed);
    // a new player: the first game starts in its place, and the toast stays
    await page.goto('/daily/2026-11-13');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(toast(page, 'Tomorrow’s daily opens at midnight')).toBeVisible();
    await expect.poll(() => saved(page).then((s) => s.puzzle)).not.toBeNull();
    expect((await saved(page)).dailyKey).toBeNull();
    expect((await saved(page)).puzzle).not.toBe(byDate('2026-11-13').puzzle);
    // the address goes to the game on the board
    await expect.poll(() => page.evaluate(() => location.pathname)).toMatch(/^\/p\//);
    // today's daily, played on, and then a later day's address: the board stays, nothing goes aside
    await page.goto('/daily/2026-11-12');
    await expect.poll(() => saved(page).then((s) => s.dailyKey)).toBe('2026-11-12');
    const today = byDate('2026-11-12').puzzle;
    const cell = today.indexOf('.');
    const box = (await page.locator('svg.board').boundingBox())!;
    await page.mouse.click(box.x + ((cell % 9) + 0.5) * (box.width / 9), box.y + (Math.floor(cell / 9) + 0.5) * (box.width / 9));
    await page.keyboard.press('Digit5');
    await page.goto('/daily/2026-11-20');
    await expect(toast(page, 'The daily of 20 November opens on 20 November')).toBeVisible();
    await expect.poll(() => saved(page)).toEqual({ dailyKey: '2026-11-12', puzzle: today, kept: false });
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/daily/2026-11-12');
    // in Norwegian, the same, in its words
    await page.goto('/nb/daily/2026-11-13');
    await expect(toast(page, 'Morgendagens oppgave åpner ved midnatt')).toBeVisible();
    await expect.poll(() => saved(page)).toEqual({ dailyKey: '2026-11-12', puzzle: today, kept: false });
  });

  test('pasted into Import, is refused in the dialog, and an earlier day’s daily opens', async ({ page }) => {
    await page.clock.setFixedTime(noon('2026-11-12'));
    await page.addInitScript(welcomed);
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => saved(page).then((s) => s.puzzle)).not.toBeNull();
    const was = await saved(page);
    await page.locator('.menu-row button', { hasText: 'Import' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import a puzzle' });
    await dialog.locator('textarea').fill('https://sudokui.app/daily/2026-11-13');
    await dialog.getByRole('button', { name: 'Load puzzle' }).click();
    await expect(dialog.locator('.dialog-error')).toHaveText('Tomorrow’s daily opens at midnight');
    expect(await saved(page)).toEqual(was);
    // yesterday's daily opens from the same box
    await dialog.locator('textarea').fill('https://sudokui.app/daily/2026-11-11');
    await dialog.getByRole('button', { name: 'Load puzzle' }).click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => saved(page).then((s) => s.dailyKey)).toBe('2026-11-11');
  });

  test('opens on its day: the same address, a day on', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.setFixedTime(noon('2026-11-12'));
    await page.goto('/daily/2026-11-13');
    await expect(toast(page, 'Tomorrow’s daily opens at midnight')).toBeVisible();
    await page.clock.setFixedTime(noon('2026-11-13'));
    await page.goto('/daily/2026-11-13');
    await expect.poll(() => saved(page).then((s) => s.dailyKey)).toBe('2026-11-13');
    await expect(toast(page, 'Daily puzzle for 2026-11-13')).toBeVisible();
  });
});
