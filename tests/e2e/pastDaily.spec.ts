/**
 * Another day's daily on the board, in a real browser (src/ui/App.tsx,
 * PastDailyNote): the app resumes the last game when it opens, at the
 * daily's own address, so a returning player who opens the home page, or
 * anyone opening an old daily's link, is told which day's daily it is, in
 * a quiet line beside the board (never over it), with a link that opens
 * today's daily as the Daily button does. Never for today's daily; put
 * away, it stays away for that game; readable in all four themes; a
 * solved old daily keeps its win screen. On a laptop and on a phone.
 * And the IndexNow files the build serves (scripts/indexnow.ts).
 */
import { test, expect, Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import { localDateKey, dayName } from '../../src/content/dailies';
import type { Daily } from '../../src/content/dailies';

const dailies: Daily[] = JSON.parse(new TextDecoder().decode(readFileSync('src/content/dailies.json')));
/** the owner's example: the daily of 30 October 2026 */
const OLD = dailies.find((d) => d.date === '2026-10-30')!;

const welcomed = () => localStorage.setItem('sudokui-welcomed', '1');
const note = (page: Page) => page.getByRole('note').filter({ hasText: /The daily of|Oppgaven for|El sudoku del/ });
/** the game on the board, as it was saved */
const saved = (page: Page) =>
  page.evaluate(() => {
    const info = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info;
    return info ? { puzzle: info.puzzle as string, dailyKey: (info.dailyKey ?? null) as string | null, dailyNo: (info.dailyNo ?? null) as number | null } : null;
  });

/** what of the note is wrong where it stands: over the board, off the screen, the page scrolling sideways, a part clipped */
const misplaced = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('.past-daily')!;
    const n = el.getBoundingClientRect();
    const b = document.querySelector('svg.board')!.getBoundingClientRect();
    const wrong: string[] = [];
    if (n.left < b.right - 0.5 && b.left < n.right - 0.5 && n.top < b.bottom - 0.5 && b.top < n.bottom - 0.5) wrong.push('over the board');
    if (n.left < 0 || n.right > window.innerWidth || n.top < 0 || n.bottom > window.innerHeight) wrong.push('not all on screen');
    if (document.documentElement.scrollWidth > window.innerWidth) wrong.push('the page scrolls sideways');
    for (const part of el.querySelectorAll<HTMLElement>('p, a, button')) if (part.scrollWidth > part.clientWidth + 1) wrong.push(`${part.tagName} clipped`);
    return wrong;
  });

for (const [name, use] of [
  ['laptop', { viewport: { width: 1280, height: 800 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(`another day’s daily, ${name}`, () => {
    test.use(use);
    const today = localDateKey();

    test('an old daily’s link says which day it is, beside the board, and its link opens today’s daily', async ({ page }) => {
      expect(OLD.date).not.toBe(today);
      await page.addInitScript(welcomed);
      await page.goto(`/daily/${OLD.date}`);
      await expect(page.locator('svg.board')).toBeVisible();
      const line = note(page);
      await expect(line).toBeVisible();
      // in words, the date the player's way; the dot and the arrow are only drawn
      await expect(line).toContainText(`The daily of ${dayName(OLD.date, 'en-GB', today)}`);
      const link = line.getByRole('link', { name: 'Today’s daily', exact: true });
      await expect(link).toHaveAttribute('href', `/daily/${today}`);
      await expect(line.getByRole('button', { name: 'Hide this note' })).toBeVisible();
      expect(await misplaced(page)).toEqual([]);
      // no dialog: the board takes the first tap
      await expect(page.getByRole('dialog')).toHaveCount(0);
      if (name === 'phone') await link.tap();
      else await link.click();
      await expect.poll(() => page.evaluate(() => location.pathname)).toBe(`/daily/${today}`);
      // today's daily, as the Daily button opens it: the day's published board, its number, its notice
      const published = dailies.find((d) => d.date === today);
      await expect.poll(() => saved(page)).toEqual({
        puzzle: published ? published.puzzle : expect.any(String),
        dailyKey: today,
        dailyNo: published ? dailies.indexOf(published) + 1 : null
      });
      await expect(page.locator('.toast').filter({ hasText: `Daily puzzle for ${today}` })).toBeVisible();
      await expect(note(page)).toHaveCount(0);
    });

    test('a saved old daily resumes with the note; put away, it stays away for that game; today’s daily never has one', async ({ page }) => {
      await page.addInitScript(welcomed);
      await page.goto(`/daily/${OLD.date}`);
      await expect(note(page)).toBeVisible();
      // the next visit opens the home page, and the app resumes the game at its address
      await page.goto('/');
      await expect(page.locator('svg.board')).toBeVisible();
      await expect.poll(() => page.evaluate(() => location.pathname)).toBe(`/daily/${OLD.date}`);
      await expect(note(page)).toBeVisible();
      expect(await misplaced(page)).toEqual([]);
      // put away, for this game: across a reload too
      await note(page).getByRole('button', { name: 'Hide this note' }).click();
      await expect(note(page)).toHaveCount(0);
      await page.reload();
      await expect(page.locator('svg.board')).toBeVisible();
      await expect.poll(() => saved(page).then((s) => s?.dailyKey)).toBe(OLD.date);
      await expect(note(page)).toHaveCount(0);
      // today's daily by the Daily button: none
      await page.locator('.menu-row button', { hasText: 'New' }).click();
      await page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /Daily puzzle/ }).click();
      await expect.poll(() => saved(page).then((s) => s?.dailyKey)).toBe(today);
      await expect(page.locator('svg.board')).toBeVisible();
      await expect(note(page)).toHaveCount(0);
      // nor by its link
      await page.goto(`/daily/${today}`);
      await expect(page.locator('svg.board')).toBeVisible();
      await page.waitForTimeout(300);
      await expect(note(page)).toHaveCount(0);
      // and the old daily opened again is a new game of it: the note is back
      await page.goto(`/daily/${OLD.date}`);
      await expect(note(page)).toBeVisible();
    });
  });
}

test.describe('another day’s daily, in every theme and language', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const today = localDateKey();

  /** WCAG contrast of two computed colours, the second opaque */
  const contrastIn = (page: Page, selector: string) =>
    page.evaluate((sel) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const bg = rgb(getComputedStyle(document.querySelector('.past-daily')!).backgroundColor);
      const fg = rgb(getComputedStyle(document.querySelector(sel)!).color);
      const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return (a + 0.05) / (b + 0.05);
    }, selector);

  test('reads clearly in all four themes', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.goto(`/daily/${OLD.date}`);
    await expect(note(page)).toBeVisible();
    for (const theme of ['dark', 'light', 'rose', 'forest']) {
      await page.evaluate((t) => (document.documentElement.dataset.theme = t), theme);
      for (const part of ['.past-daily p', '.past-daily a', '.past-daily-close']) {
        expect(await contrastIn(page, part), `${part} in ${theme}`).toBeGreaterThanOrEqual(4.5);
      }
      // a background of the theme's own, which the contrast above was measured on
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.past-daily')!).backgroundColor);
      expect(bg, theme).toMatch(/^rgb\(/);
    }
  });

  test('names the day in Norwegian and Spanish, and links to today’s in the same language', async ({ page }) => {
    await page.addInitScript(welcomed);
    for (const [root, text, link, locale] of [
      ['/nb/', 'Oppgaven for', 'Dagens oppgave', 'nb-NO'],
      ['/es/', 'El sudoku del', 'El sudoku de hoy', 'es-ES']
    ] as const) {
      await page.goto(`${root}daily/${OLD.date}`);
      const line = note(page);
      await expect(line).toContainText(`${text} ${dayName(OLD.date, locale, today)}`);
      await expect(line.getByRole('link', { name: link, exact: true })).toHaveAttribute('href', `${root}daily/${today}`);
      expect(await misplaced(page)).toEqual([]);
    }
  });
});

test.describe('a solved old daily', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('keeps its win screen, on the day and after a reload', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(welcomed);
    await page.clock.install();
    await page.goto(`/daily/${OLD.date}`);
    await expect(page.locator('svg.board')).toBeVisible();
    const solution = gridToString(solve(parseGrid(OLD.puzzle)!)!);
    const empties = [...OLD.puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    const box = (await page.locator('svg.board').boundingBox())!;
    for (const cell of empties) {
      if (cell === empties[empties.length - 1]) await page.clock.fastForward(45_000);
      await page.mouse.click(box.x + ((cell % 9) + 0.5) * (box.width / 9), box.y + (Math.floor(cell / 9) + 0.5) * (box.width / 9));
      await page.keyboard.press(`Digit${solution[cell]}`);
    }
    const won = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(won).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Puzzle solved' })).toBeVisible();
    // and behind it, once it is closed, the way to today's
    await page.getByRole('dialog', { name: 'Puzzle solved' }).getByRole('button', { name: 'Admire the grid' }).click();
    await expect(note(page)).toBeVisible();
  });
});

test.describe('IndexNow', () => {
  test('the key file and the list are served as they were built, and the list covers the sitemap', async ({ request }) => {
    const names = readdirSync('public').filter((n) => /^[0-9a-f]{32}\.txt$/.test(n));
    expect(names).toHaveLength(1);
    const key = names[0].slice(0, 32);
    const keyFile = await request.get(`/${key}.txt`);
    expect(keyFile.status()).toBe(200);
    expect((await keyFile.text()).trim()).toBe(key);
    const list = await request.get('/indexnow.json');
    expect(list.status()).toBe(200);
    const manifest = (await list.json()) as { commit: string | null; pages: Record<string, string> };
    const sitemap = await (await request.get('/sitemap.xml')).text();
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(200);
    expect(Object.keys(manifest.pages)).toEqual(urls);
    for (const hash of Object.values(manifest.pages)) expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});
