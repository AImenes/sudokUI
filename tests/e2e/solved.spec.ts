/**
 * A solved game in a real browser (the hunt of November 2026): the win
 * screen is a dialog as every other, Check, Steps and the rest used after
 * the win leave the solve as it was played, Undo or a Steps jump after it
 * puts the board back in play, and Undo of the jump brings the solved board
 * back, with its own time, and Redo leaves it in play again; a daily solved
 * again shows its win screen, says which solve stays its result, and still
 * sends and shares that one; and the clock: a paused game reloads paused, a
 * reload keeps the time since the last move, the time the page is hidden
 * does not count, a second tab shown again does not put its older board
 * back, and a tab with a game under way keeps it while another tab opens
 * another puzzle.
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

/** a tab shown or hidden, as the browser does when another tab is in front or the screen locks */
const shown = (p: Page, visible: boolean) =>
  p.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);
/** a tab left: closed, or the browser quit from it */
const left = (p: Page) => p.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));

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
    // after a reload the win screen opens with nothing focused before it:
    // closed, it still gives the focus to the board, not to the page
    await page.reload();
    await expect(winScreen(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(winScreen(page)).toHaveCount(0);
    await expect(page.locator('svg.board')).toBeFocused();
  });

  test('after a win, Check, Steps and Scan leave the daily unassisted: its Send button, its words and its time stay, across a Steps jump undone and a reload', async ({ page }) => {
    test.setTimeout(60_000);
    const today = localDateKey();
    const daily = dailies.find((d) => d.date === today)!;
    expect(daily, `a published daily for ${today}`).toBeTruthy();
    const sent: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/daily/')) sent.push(r.url());
    });
    await open(page, `/daily/${today}`);
    await expect(page.locator('.zone-title .zone-note')).toHaveText('everything in this box counts as help');
    await solveBoard(page, daily.puzzle);
    const dialog = winScreen(page);
    const send = dialog.getByRole('button', { name: /Send my time and compare/ });
    await expect(send).toBeVisible();
    await expect(dialog).toContainText('Unassisted solve: no help, every mark your own');
    await expect(dialog).toContainText('with your own marks');
    const result = await dialog.locator('p').first().innerText();
    await dialog.getByRole('button', { name: 'Admire the grid' }).click();
    // to look at the solved board is no help with its solve: nothing asks,
    // and the Assist box does not say it is
    await expect(page.locator('.zone-title .zone-note')).toHaveCount(0);
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Check' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Scan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Scan' })).toHaveCount(0);
    const scan = page.getByRole('dialog', { name: "What's in this position?" });
    await expect(scan).toContainText('The board is solved: nothing is left to find.');
    await expect(scan).not.toContainText('a candidate is off');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Steps', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Use Steps' })).toHaveCount(0);
    const path = page.getByRole('dialog', { name: 'Solution path' });
    await expect(path).toBeVisible();
    // a jump into its path, a while on it, and Ctrl+Z back to the solved board
    const row = path.locator('.path-list > .path-row').nth(1);
    if (await row.evaluate((el) => el.classList.contains('path-group'))) await row.locator('.path-jump').click();
    else await row.click();
    await expect(path).toHaveCount(0);
    await page.waitForTimeout(2200);
    await page.locator('svg.board').focus();
    await page.keyboard.press('Control+KeyZ');
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeDisabled();
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
    // the same solve, its own time, and no solve before it
    await expect(again.locator('p').first()).toHaveText(result);
    await expect(again).not.toContainText('You solved this daily before');
    expect(sent).toEqual([]);
  });

  test('a daily solved again by Restart shows its win screen, which says the first solve stays the day’s result, and sends and shares that one', async ({ page }) => {
    test.setTimeout(90_000);
    const today = localDateKey();
    const daily = dailies.find((d) => d.date === today)!;
    expect(daily, `a published daily for ${today}`).toBeTruthy();
    const no = dailies.indexOf(daily) + 1;
    // what is sent, answered as the server would; what is shared, from the clipboard
    const sent: { seconds: number; unassisted: boolean; grid: string }[] = [];
    await page.route('**/api/daily/*/result', async (route) => {
      const body = route.request().postDataJSON();
      sent.push(body);
      await route.fulfill({ json: { accepted: true, stats: { no, count: 3, median: 600, histogram: [[Math.floor(body.seconds / 15), 3]] } } });
    });
    await page.addInitScript(() => {
      (window as unknown as { copied: string[] }).copied = [];
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => void (window as unknown as { copied: string[] }).copied.push(text) }
      });
    });
    const copied = () => page.evaluate(() => (window as unknown as { copied: string[] }).copied);
    await page.clock.install();
    await open(page, `/daily/${today}`);
    await solveBoard(page, daily.puzzle);
    const first = winScreen(page);
    await expect(first.getByRole('button', { name: /Send my time and compare/ })).toBeVisible();
    const [, firstTime] = /· (\d+:\d\d)$/.exec(await first.locator('p').first().innerText())!;
    // not sent: the win screen is put away
    await first.getByRole('button', { name: 'Admire the grid' }).click();
    await page.locator('.menu-row button', { hasText: 'Restart' }).click();
    await page.getByRole('dialog', { name: 'Restart puzzle?' }).getByRole('button', { name: 'Restart' }).click();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeEnabled();
    // a slower solve this time
    await solveBoard(page, daily.puzzle, () => page.clock.fastForward(45_000));
    const second = winScreen(page);
    await expect(second).toBeVisible();
    const [, secondTime] = /· (\d+:\d\d)$/.exec(await second.locator('p').first().innerText())!;
    expect(secondTime).not.toBe(firstTime);
    // the first solve's time never went in: it is the one Send offers
    await expect(second).toContainText(`You solved this daily before, in ${firstTime}. That time is the one that goes in.`);
    // and the one a friend is challenged with, as the Share dialog's
    await second.getByRole('button', { name: /Challenge a friend/ }).click();
    await expect.poll(copied).toHaveLength(1);
    expect((await copied())[0]).toContain(`· ${firstTime} ·`);
    expect((await copied())[0]).not.toContain(secondTime);
    // still there after a reload
    await page.reload();
    const again = winScreen(page);
    await expect(again).toContainText(`You solved this daily before, in ${firstTime}. That time is the one that goes in.`);
    expect(sent).toEqual([]);
    await again.getByRole('button', { name: /Send my time and compare/ }).click();
    await expect(again).toContainText(`The time in the results is the first one you sent, ${firstTime}.`);
    const [m, ss] = firstTime.split(':').map(Number);
    expect(sent.map((r) => [r.seconds, r.unassisted, r.grid])).toEqual([[m * 60 + ss, true, solutionOf(daily.puzzle)]]);
    await expect(again.getByRole('button', { name: /Send my time and compare/ })).toHaveCount(0);
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

  test('Ctrl+Z after a Steps jump on the solved board, as its notice offers, brings the solved board back as it was: stopped, unassisted, its own time; Redo leaves a board to play on', async ({ page }) => {
    await open(page);
    await solveBoard(page, EASY);
    const result = await winScreen(page).locator('p').first().innerText();
    await winScreen(page).getByRole('button', { name: 'Admire the grid' }).click();
    // on a solved board, looking is no help with its solve, and nothing says it is
    const steps = page.getByRole('button', { name: 'Steps', exact: true });
    await expect(steps).toHaveAttribute('title', 'Show every step of one complete solution and jump to any point');
    await steps.click();
    const path = page.getByRole('dialog', { name: 'Solution path' });
    await expect(path).toContainText('The crux, the single most expensive step, is highlighted.');
    await expect(path).not.toContainText('counts as assistance');
    const row = path.locator('.path-list > .path-row').first();
    await expect(row).toBeVisible();
    if (await row.evaluate((el) => el.classList.contains('path-group'))) await row.locator('.path-jump').click();
    else await row.click();
    await expect(page.getByText(/Jumped to step \d+ of \d+ \(Ctrl\+Z goes back\)/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeEnabled();
    await page.locator('svg.board').focus();
    await page.keyboard.press('Control+KeyZ');
    // solved again: the clock stands still, and nothing is left to pause or hint
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Hint', exact: true })).toBeDisabled();
    await expect(page.locator('.pause-card')).toHaveCount(0);
    const at = await page.locator('.timer').innerText();
    await page.waitForTimeout(2200);
    await expect(page.locator('.timer')).toHaveText(at);
    // Redo goes to the jump again: a board to play on, not a pause card,
    // and a digit goes in
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.locator('.pause-card')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeEnabled();
    const open1 = await page.evaluate(() => (JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells as { value: number }[]).findIndex((c) => !c.value));
    const digit = solutionOf(EASY)[open1];
    await enter(page, open1, digit);
    await expect(page.locator('#board-status')).toHaveText(`Row ${Math.floor(open1 / 9) + 1}, column ${(open1 % 9) + 1}: ${digit}.`);
    await page.waitForTimeout(1500);
    // back past the digit and the jump: the solved board as it was played, its time the solve's
    await page.keyboard.press('Control+KeyZ');
    await page.keyboard.press('Control+KeyZ');
    await expect(page.getByRole('button', { name: 'Pause game' })).toBeDisabled();
    await expect(page.locator('.timer')).toHaveText(at);
    // the win screen put away stays away; a reload shows it, as the solve was played
    await expect(winScreen(page)).toHaveCount(0);
    await page.reload();
    await expect(winScreen(page)).toContainText('Unassisted solve: no help, every mark your own');
    await expect(winScreen(page).locator('p').first()).toHaveText(result);
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

  test('a second tab, shown again, plays on from the moves made in the other and does not put its older board back', async ({ context }) => {
    const filledInSave = (p: Page) =>
      p.evaluate(() => (JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells as { value: number }[]).filter((c) => c.value).length);
    const givens = 81 - empties(EASY).length;
    // tab B opens the puzzle, then goes behind tab A, which opens the same game
    const b = await context.newPage();
    await open(b, `/#p=${EASY}`);
    await shown(b, false);
    const a = await context.newPage();
    await open(a, '/');
    const solution = solutionOf(EASY);
    const played = empties(EASY).slice(0, 4);
    for (const cell of played) await enter(a, cell, solution[cell]);
    await expect.poll(() => filledInSave(a)).toBe(givens + 4);
    // A is closed, the browser shows B, then is quit from B
    await left(a);
    await a.close();
    await shown(b, true);
    await b.waitForTimeout(300);
    expect(await filledInSave(b)).toBe(givens + 4);
    await left(b);
    expect(await filledInSave(b)).toBe(givens + 4);
    // and B's board has A's moves on it, to play on from
    const c = await cellBox(b, played[3]);
    await b.mouse.click(c.x, c.y);
    await expect(b.locator('#board-status')).toHaveText(`Row ${Math.floor(played[3] / 9) + 1}, column ${(played[3] % 9) + 1}: ${solution[played[3]]}.`);
  });

  test('a tab with a game under way keeps it, and its moves, while another tab opens another puzzle and goes away with it', async ({ context }) => {
    const savedInfo = (p: Page) => p.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.info as { puzzle: string; practiceTech: string | null });
    const solution = solutionOf(EASY);
    const played = empties(EASY).slice(0, 4);
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    for (const cell of played) await enter(a, cell, solution[cell]);
    // A goes behind a new tab, as a Learn page's link opens one, and there
    // Practice opens the app on another puzzle
    await shown(a, false);
    const b = await context.newPage();
    await open(b, '/#practice=X_WING');
    await expect.poll(async () => (await savedInfo(b)).practiceTech).toBe('X_WING');
    // a move on the practice: B has a game under way too
    const practice = await b.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state as { info: { solution: string }; cells: { value: number }[] });
    const free = practice.cells.findIndex((cell) => !cell.value);
    await enter(b, free, practice.info.solution[free]);
    await expect(b.locator('#board-status')).toHaveText(`Row ${Math.floor(free / 9) + 1}, column ${(free % 9) + 1}: ${practice.info.solution[free]}.`);
    // the screen locks, or B is closed: B goes away with its own game
    await shown(b, false);
    await left(b);
    // A shown again: its own game, its moves on the board and in the save
    await shown(a, true);
    await expect.poll(async () => (await savedInfo(a)).puzzle).toBe(EASY);
    expect(a.url()).toContain(EASY);
    // (the last cell played is still selected, and a click on it lets it go)
    const c = await cellBox(a, played[0]);
    await a.mouse.click(c.x, c.y);
    await expect(a.locator('#board-status')).toHaveText(`Row ${Math.floor(played[0] / 9) + 1}, column ${(played[0] % 9) + 1}: ${solution[played[0]]}.`);
    // and B, shown again, still has its practice
    await shown(b, true);
    await expect.poll(async () => (await savedInfo(b)).practiceTech).toBe('X_WING');
    expect(b.url()).not.toContain(EASY);
  });

  test('the time the page is hidden does not count, and the clock runs on when it is shown', async ({ page }) => {
    await open(page);
    const cells = empties(EASY);
    await enter(page, cells[0], solutionOf(EASY)[cells[0]]);
    const before = await secondsOn(page);
    await shown(page, false);
    await page.waitForTimeout(4300);
    await shown(page, true);
    expect(await secondsOn(page)).toBeLessThanOrEqual(before + 1);
    // not a pause: no card, and the clock goes on (the timer redraws once a second)
    await expect(page.locator('.pause-card')).toHaveCount(0);
    await page.waitForTimeout(3300);
    expect(await secondsOn(page)).toBeGreaterThanOrEqual(before + 2);
  });
});
