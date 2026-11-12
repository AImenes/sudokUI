/**
 * The advent calendar's public pages in a real browser, on a phone
 * (docs/advent-calendar.md, "The public pages"; src/content/adventPage.ts),
 * with the device's date moved by Playwright's clock: in November every
 * door is locked and the status line says when the calendar opens; on 5
 * December doors 1 to 5 are links into the app, door 5 is today's, and
 * one of them opens its door; from 1 January every door is closed; without
 * JavaScript every door reads as locked, with its day. And the quiet line
 * on /learn/ shows in November and December and not in October.
 */
import { test, expect, Page } from '@playwright/test';

test.use({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

/** the device's date and time, as the visitor's clock says (local time) */
const on = (page: Page, day: string) => page.clock.setFixedTime(new Date(`${day}T10:00:00`));

/** each door as the page shows it: its number, its address if it has one, its class and its word */
const doors = (page: Page) =>
  page.locator('#advent-doors a.door').evaluateAll((all) =>
    all.map((a) => ({
      n: Number(a.getAttribute('data-door')),
      href: a.getAttribute('href'),
      cls: a.className,
      state: a.querySelector('.state')?.textContent ?? ''
    }))
  );

test('in November every door is locked, with its day, and the page says when the calendar opens', async ({ page }) => {
  await on(page, '2026-11-12');
  await page.goto('/nb/julekalender/');
  await expect(page.locator('#advent-status')).toHaveText('Kalenderen åpner 1. desember 2026. Til da er alle lukene låst.');
  const all = await doors(page);
  expect(all.map((d) => d.n)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
  for (const d of all) expect(d, `door ${d.n}`).toEqual({ n: d.n, href: null, cls: 'door', state: 'Låst' });
  await expect(page.locator('#advent-doors a.door').first()).toContainText('1. des.');
  // nothing to scroll sideways on a phone
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('on 5 December doors 1 to 5 open into the app, door 5 is today’s, and a door opens its game', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await on(page, '2026-12-05');
  await page.goto('/advent/');
  await expect(page.locator('#advent-status')).toHaveText('Door 5 opened today. Every open door stays open until 31 December.');
  await expect.poll(async () => (await doors(page)).filter((d) => d.href).map((d) => d.n)).toEqual([1, 2, 3, 4, 5]);
  const all = await doors(page);
  for (const d of all) {
    if (d.n < 5) expect(d, `door ${d.n}`).toEqual({ n: d.n, href: `/advent/2026/${d.n}`, cls: 'door open', state: 'Open' });
    else if (d.n === 5) expect(d).toEqual({ n: 5, href: '/advent/2026/5', cls: 'door open today', state: 'Today' });
    else expect(d, `door ${d.n}`).toEqual({ n: d.n, href: null, cls: 'door', state: 'Locked' });
  }
  // an open door is a link a screen reader names by its door and day
  await expect(page.getByRole('link', { name: /^Door 3 3 Dec/ })).toBeVisible();
  await page.getByRole('link', { name: /^Door 3 3 Dec/ }).click();
  await expect(page).toHaveURL(/\/advent\/2026\/3$/);
  await expect(page.locator('svg.board')).toBeVisible();
});

test('in Spanish the open doors link to the Spanish app, and from 1 January every door is closed', async ({ page }) => {
  await on(page, '2026-12-27');
  await page.goto('/es/calendario-de-adviento/');
  await expect(page.locator('#advent-status')).toHaveText('Las 24 casillas están abiertas hasta el 31 de diciembre.');
  await expect.poll(async () => (await doors(page)).map((d) => d.href)).toEqual(Array.from({ length: 24 }, (_, i) => `/es/advent/2026/${i + 1}`));
  await page.clock.setFixedTime(new Date('2027-01-01T10:00:00'));
  await page.reload();
  await expect(page.locator('#advent-status')).toHaveText(
    'El calendario de 2026 se ha cerrado. Una casilla que hayas empezado se queda en la app, y puedes terminarla.'
  );
  for (const d of await doors(page)) expect(d, `door ${d.n}`).toEqual({ n: d.n, href: null, cls: 'door closed', state: 'Cerrada' });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('every door reads as locked, with its day, and the line to the calendar stays hidden', async ({ page }) => {
    await page.goto('/advent/');
    await expect(page.locator('#advent-status')).toHaveText('Door 1 opens on 1 December 2026, and door 24 on 24 December.');
    const all = await doors(page);
    expect(all).toHaveLength(24);
    for (const d of all) expect(d, `door ${d.n}`).toEqual({ n: d.n, href: null, cls: 'door', state: 'Locked' });
    await expect(page.locator('#advent-doors a.door').nth(23)).toContainText('24 Dec');
    await expect(page.getByRole('link', { name: /^Door/ })).toHaveCount(0);
    await page.goto('/learn/');
    await expect(page.locator('#advent-line')).toBeHidden();
  });
});

test('the quiet line on /learn/ shows in November and December, and not in October', async ({ page }) => {
  await on(page, '2026-10-20');
  await page.goto('/learn/');
  await expect(page.locator('#advent-line')).toBeHidden();
  await page.clock.setFixedTime(new Date('2026-11-20T10:00:00'));
  await page.reload();
  const line = page.getByRole('link', { name: 'Advent calendar: a sudoku behind each door, from 1 to 24 December' });
  await expect(line).toBeVisible();
  await line.click();
  await expect(page).toHaveURL(/\/advent\/$/);
  await expect(page.locator('h1')).toHaveText('Sudoku advent calendar 2026');
});
