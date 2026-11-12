/**
 * The advent calendar in a real browser (docs/advent-calendar.md;
 * src/ui/Advent.tsx, src/ui/links.ts startDoor), with the device's date
 * moved by Playwright's clock: in November New shows the calendar with
 * every door locked, each with its day; on 1 December door 1 opens and
 * door 2 is locked, and its address says it opens at midnight; a locked door asked for by
 * its address is refused with a toast and puts nothing over the game under
 * way; an earlier door opens on 10 December over a game under way, which
 * is kept with Back to it; a door solved offers Send for its time on its
 * day and up to 7 days late, but not 8; and from 1 January nothing of the
 * calendar shows while a door game in progress stays and can be finished.
 */
import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import type { AdventDoor } from '../../src/content/advent';

/** the published doors, read as a file: Playwright's loader takes no JSON import without an attribute */
const doors: AdventDoor[] = JSON.parse(new TextDecoder().decode(readFileSync('src/content/advent.json')));
const door = (n: number) => doors.find((d) => d.date === `2026-12-${String(n).padStart(2, '0')}`)!;

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

/** the device's date and time, as the player's clock says (local time) */
const on = (page: Page, day: string) => page.clock.setFixedTime(new Date(`${day}T10:00:00`));

async function open(page: Page, day: string, path: string) {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await on(page, day);
  await page.goto(path);
  await expect(page.locator('svg.board')).toBeVisible();
}
/** the game an address opened is the one on the board (a door comes after its list loads): only then is it played on */
const opened = (page: Page, puzzle: string) => expect.poll(() => saved(page).then((s) => s.puzzle)).toBe(puzzle);

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
/** the first n empty cells (from `from`) filled with their digits */
async function fill(page: Page, puzzle: string, n = Infinity, from = 0) {
  const solution = solutionOf(puzzle);
  for (const cell of empties(puzzle).slice(from, from + n)) await enter(page, cell, solution[cell]);
}

/** the game on the board, as it was saved */
const saved = (page: Page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state;
    return {
      puzzle: (s?.info?.puzzle ?? null) as string | null,
      door: (s?.info?.adventDoor ?? null) as number | null,
      aside: (s?.setAside?.info?.puzzle ?? null) as string | null,
      entries: ((s?.cells ?? []) as { given: boolean; value: number }[]).filter((c) => !c.given && c.value).length
    };
  });
const path = (page: Page) => page.evaluate(() => location.pathname);
const toast = (page: Page) => page.locator('.toast');
const newDialog = async (page: Page) => {
  await page.locator('.menu-row button', { hasText: 'New' }).click();
  const dialog = page.getByRole('dialog', { name: 'New game' });
  await expect(dialog).toBeVisible();
  return dialog;
};
const keptNote = (page: Page) => page.getByRole('note').filter({ hasText: 'Your game in progress is kept' });

test.describe('the advent calendar', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('in November, New shows the calendar with every door locked, each with the day it opens', async ({ page }) => {
    await open(page, '2026-11-20', `/#p=${EASY}`);
    await opened(page, EASY);
    const dialog = await newDialog(page);
    const entry = dialog.getByRole('button', { name: /Advent calendar/ });
    await expect(entry).toContainText('Its doors open from 1 December: a door a day until Christmas Eve');
    await entry.click();
    const calendar = page.getByRole('dialog', { name: 'Advent calendar' });
    await expect(calendar).toBeVisible();
    await expect(calendar.getByRole('button', { name: 'Door 1, opens on 1 December' })).toBeDisabled();
    await expect(calendar.getByRole('button', { name: 'Door 24, opens on 24 December' })).toBeDisabled();
    await expect(calendar.locator('button.advent-door:not([disabled])')).toHaveCount(0);
    // and door 1's address opens nothing yet, over nothing
    await calendar.getByRole('button', { name: 'Close dialog' }).click();
    await page.goto('/advent/2026/1');
    await expect(toast(page)).toContainText('Door 1 of the advent calendar opens on 1 December');
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, door: null, aside: null });
  });

  test('on 1 December door 1 is open and door 2 locked; door 1 opens on the board at its own address', async ({ page }) => {
    await open(page, '2026-12-01', `/#p=${EASY}`);
    const dialog = await newDialog(page);
    await dialog.getByRole('button', { name: /Advent calendar/ }).click();
    const calendar = page.getByRole('dialog', { name: 'Advent calendar' });
    await expect(calendar).toBeVisible();
    const first = calendar.getByRole('button', { name: `Door 1, 1 December, ${door(1).level} ${door(1).score}` });
    await expect(first).toBeEnabled();
    await expect(calendar.getByRole('button', { name: 'Door 2, opens on 2 December' })).toBeDisabled();
    await expect(calendar.getByRole('button', { name: 'Door 24, opens on 24 December' })).toBeDisabled();
    // nothing of the page scrolls sideways on a phone
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await first.click();
    await expect(calendar).toHaveCount(0);
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: door(1).puzzle, door: 1 });
    await expect.poll(() => path(page)).toBe('/advent/2026/1');
    await expect(toast(page)).toContainText('Door 1 of the advent calendar. Everyone gets this same board');
    // Share gives the door's own address, and its picture names the door
    await page.evaluate(() => {
      (window as any).__shared = [];
      Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
      navigator.clipboard.writeText = async (text: string) => void (window as any).__shared.push(text);
    });
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const share = page.getByRole('dialog', { name: 'Share this puzzle' });
    await share.getByRole('button', { name: /Puzzle link/ }).click();
    await expect.poll(() => page.evaluate(() => (window as any).__shared[0] as string | undefined)).toBe(`${new URL(page.url()).origin}/advent/2026/1`);
    await expect(share.getByText(`sudokui.app · Advent door 1 · ${door(1).level}\u00a0${door(1).score}`)).toBeVisible();
    // no box to name the techniques: a door's preview names none
    await expect(share.getByText('Say what it needs')).toHaveCount(0);
  });

  test('a locked door asked for by its address is refused with a toast, and nothing goes over the game under way', async ({ page }) => {
    await open(page, '2026-12-01', `/#p=${EASY}`);
    await opened(page, EASY);
    await fill(page, EASY, 3);
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 3 });
    await page.goto('/advent/2026/5');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(toast(page)).toContainText('Door 5 of the advent calendar opens on 5 December');
    await expect.poll(() => saved(page)).toEqual({ puzzle: EASY, door: null, aside: null, entries: 3 });
    await expect(keptNote(page)).toHaveCount(0);
    // the address goes back to the game on the board
    await expect.poll(() => path(page)).toBe(`/p/${EASY}`);
    // in the tab too, by a link put into the address bar
    await page.evaluate(() => {
      history.pushState(null, '', '/advent/2026/9');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect.poll(() => saved(page)).toEqual({ puzzle: EASY, door: null, aside: null, entries: 3 });
    // tomorrow's door says midnight, as tomorrow's daily does
    await page.goto('/advent/2026/2');
    await expect(toast(page)).toContainText('Door 2 of the advent calendar opens at midnight');
    await expect.poll(() => saved(page)).toEqual({ puzzle: EASY, door: null, aside: null, entries: 3 });
  });

  test('a first visit to a locked door’s address plays a game of its own and says when the door opens', async ({ page }) => {
    await open(page, '2026-12-01', '/nb/advent/2026/6');
    await expect.poll(() => saved(page)).toMatchObject({ door: null, entries: 0 });
    await expect(toast(page)).toContainText('Luke 6 i julekalenderen åpner 6. desember');
    await expect.poll(() => path(page)).toMatch(/^\/nb\/p\//);
  });

  test('on 10 December an earlier door opens over a game under way, which is kept and comes back with Back to it', async ({ page }) => {
    await open(page, '2026-12-10', `/#p=${EASY}`);
    await opened(page, EASY);
    await fill(page, EASY, 4);
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 4 });
    await page.goto('/es/advent/2026/3');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: door(3).puzzle, door: 3, aside: EASY });
    await expect(toast(page)).toContainText('Casilla 3 del calendario de adviento');
    await expect.poll(() => saved(page)).toMatchObject({ entries: 0 });
    const note = page.getByRole('note').filter({ hasText: 'Tu partida en curso está guardada' });
    await expect(note).toBeVisible();
    await fill(page, door(3).puzzle, 2);
    await note.getByRole('button').first().click();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 4, aside: door(3).puzzle });
    await expect(toast(page)).toContainText('Vuelve tu partida de nivel Fácil');
    // and the door, in the slot now, comes back by its address as it was left
    await page.goto('/es/advent/2026/3');
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: door(3).puzzle, door: 3, entries: 2, aside: EASY });
  });

  for (const [late, offered] of [
    [0, true],
    [7, true],
    [8, false]
  ] as const) {
    test(`door 1 solved ${late} days after its day ${offered ? 'offers' : 'does not offer'} Send for its time`, async ({ page }) => {
      // opened and solved that day: an earlier door stays open all December
      await open(page, `2026-12-${String(1 + late).padStart(2, '0')}`, '/advent/2026/1');
      await opened(page, door(1).puzzle);
      // the server's answer, as the Worker gives it for a door's time on its days
      const posted: unknown[] = [];
      await page.route('**/api/daily/302601/result', async (route) => {
        posted.push(route.request().postDataJSON());
        await route.fulfill({ json: { ok: true, accepted: true, stats: { no: 302601, count: 1, median: 7, histogram: [[0, 1]] } } });
      });
      await fill(page, door(1).puzzle);
      const win = page.getByRole('dialog', { name: 'Puzzle solved' });
      await expect(win).toBeVisible();
      const send = win.getByRole('button', { name: /Send my time and compare/ });
      if (offered) {
        await expect(send).toBeVisible();
        await send.click();
        await expect.poll(() => posted.length).toBe(1);
        expect(posted[0]).toMatchObject({ no: 302601, unassisted: true, hints: 0, grid: solutionOf(door(1).puzzle) });
        await expect(win.getByText('The only time sent', { exact: false })).toBeVisible();
        // a door's time never goes by the daily's switch, which is not offered here
        await expect(win.getByRole('switch')).toHaveCount(0);
      } else {
        await expect(win.getByText('This door is closed for new times')).toBeVisible();
        await expect(send).toHaveCount(0);
      }
      // its share line names the door, its time and its address
      await page.evaluate(() => {
        (window as any).__shared = [];
        Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        navigator.clipboard.writeText = async (text: string) => void (window as any).__shared.push(text);
      });
      await win.getByRole('button', { name: /Challenge a friend/ }).click();
      await expect.poll(() => page.evaluate(() => (window as any).__shared[0] as string | undefined)).toMatch(/^I opened door 1 of the sudokUI advent calendar in \d+:\d\d · .* · .*\/advent\/2026\/1(\?vs=\d+)?$/);
    });
  }

  test('from 1 January nothing of the calendar shows, and a door game in progress stays and can be finished', async ({ page }) => {
    await open(page, '2026-12-31', '/advent/2026/1');
    await opened(page, door(1).puzzle);
    await fill(page, door(1).puzzle, 5);
    await expect.poll(() => saved(page)).toMatchObject({ door: 1, entries: 5 });
    await on(page, '2027-01-02');
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => saved(page)).toMatchObject({ door: 1, entries: 5 });
    // a game under way comes back behind the pause card, as after any reload
    await expect(page.locator('.pause-card')).toBeVisible();
    await page.getByRole('button', { name: 'Resume game' }).click();
    await expect.poll(() => path(page)).toBe('/advent/2026/1');
    const dialog = await newDialog(page);
    await expect(dialog.getByText(/advent calendar/i)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Close dialog' }).click();
    // another door's address opens nothing, and says why
    await page.goto('/advent/2026/2');
    await expect(toast(page)).toContainText('The advent calendar is closed until November');
    await expect.poll(() => saved(page)).toMatchObject({ door: 1, entries: 5 });
    await expect.poll(() => path(page)).toBe('/advent/2026/1');
    await page.getByRole('button', { name: 'Resume game' }).click();
    // the game in progress is finished, and its time is past counting
    await fill(page, door(1).puzzle, Infinity, 5);
    const win = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(win).toBeVisible();
    await expect(win.getByText('This door is closed for new times')).toBeVisible();
  });
});
