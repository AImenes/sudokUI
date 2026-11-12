/**
 * A game under way is never lost silently, in a real browser
 * (docs/architecture.md, "A game is never lost"; src/ui/links.ts): a
 * friend's link opened in a new tab of the same browser, or in the same
 * tab after a reload, or a Learn page's Practice link, puts the game
 * aside, and the note beside the board brings it back with its entries
 * and its time, then offers the other game in turn; put away, New still
 * offers it. A friend's position nobody touched is no work of the
 * player's, so a second link keeps the daily. New, then Daily puzzle, with
 * today's daily under way goes on with it, from behind a puzzle being
 * typed in too. Custom entry opened twice, then Cancel, brings back the
 * game from before the first; Share there says why there is no link yet,
 * and Restart clears the typed digits. Import of a Position link keeps its
 * entries and marks. After a crash, the error screen's Clear the board
 * keeps the game set aside.
 */
import { test, expect, Page, Locator, BrowserContext, Browser } from '@playwright/test';
import { localDateKey } from '../../src/content/dailies';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
/** a Hard puzzle (rated 1348 when written) */
const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';

const welcomed = () => localStorage.setItem('sudokui-welcomed', '1');
const note = (page: Page) => page.getByRole('note').filter({ hasText: 'Your game in progress is kept.' });

/**
 * the game as it was saved, and the one set aside; read again when the page
 * was between two documents (a page that takes the play may reload itself
 * once into the saves, docs/architecture.md, "Coming back")
 */
const saved = async (page: Page): Promise<Awaited<ReturnType<typeof readSaved>>> => {
  for (let i = 0; ; i++) {
    try {
      return await readSaved(page);
    } catch (e) {
      if (i >= 5 || !/context was destroyed|navigat/i.test(String(e))) throw e;
      await page.waitForLoadState('load').catch(() => {});
    }
  }
};
const readSaved = (page: Page) =>
  page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state ?? {};
    type Cell = { given: boolean; value: number; corner: number; center: number };
    const entries = (cells?: Cell[]) => (cells ?? []).filter((c) => !c.given && c.value).length;
    const marks = (cells?: Cell[]) => (cells ?? []).filter((c) => c.corner || c.center).length;
    return {
      puzzle: (s.info?.puzzle ?? null) as string | null,
      dailyKey: (s.info?.dailyKey ?? null) as string | null,
      entries: entries(s.cells),
      typed: ((s.cells ?? []) as Cell[]).filter((c) => c.value).length,
      marks: marks(s.cells),
      elapsed: (s.elapsedBefore ?? 0) as number,
      custom: !!s.custom,
      aside: s.setAside
        ? {
            puzzle: (s.setAside.info?.puzzle ?? null) as string | null,
            dailyKey: (s.setAside.info?.dailyKey ?? null) as string | null,
            entries: entries(s.setAside.cells),
            hidden: !!s.setAside.hidden
          }
        : null
    };
  });

/** a tap on a phone, a click at a desk */
const press = (phone: boolean, target: Locator) => (phone ? target.tap() : target.click());

/** the middle of a cell on screen */
const cellPoint = async (page: Page, cell: number) => {
  await page.locator('svg.board').scrollIntoViewIfNeeded();
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  return { x: box.x + ((cell % 9) + 0.5) * size, y: box.y + (Math.floor(cell / 9) + 0.5) * size };
};

/** correct digits in n empty cells, after the first `skip`, as the player enters them: a tap or a click on the cell, then the key */
async function enter(page: Page, phone: boolean, n: number, skip = 0) {
  const info = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.info as { puzzle: string; solution: string });
  const empty = [...info.puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
  for (const cell of empty.slice(skip, skip + n)) {
    const { x, y } = await cellPoint(page, cell);
    if (phone) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.keyboard.press(`Digit${info.solution[cell]}`);
  }
}

/** a Position link made on another device: n digits and a corner mark on the puzzle, copied from Share */
async function positionLink(browser: Browser, puzzle: string, n: number): Promise<string> {
  const sender = await browser.newContext();
  await sender.addInitScript(() => {
    localStorage.setItem('sudokui-welcomed', '1');
    (window as any).__copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => (((window as any).__copied = s), Promise.resolve()) }
    });
  });
  const a = await sender.newPage();
  await a.goto(`/#p=${puzzle}`);
  await expect(a.locator('svg.board')).toBeVisible();
  await enter(a, false, n);
  const mark = [...puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0)[n + 2];
  const { x, y } = await cellPoint(a, mark);
  await a.mouse.click(x, y);
  await a.keyboard.press('Shift+Digit4');
  await expect.poll(async () => (await saved(a)).marks).toBe(1);
  await a.locator('.menu-row button', { hasText: 'Share' }).click();
  await a.getByRole('dialog', { name: 'Share this puzzle' }).getByRole('button', { name: 'Position link' }).click();
  const position = await a.evaluate(() => (window as any).__copied as string);
  expect(position).toContain('#s=');
  await sender.close();
  return position;
}

/** correct digits in n cells that are open on the board as saved (a practice opens with the app's digits in some) */
async function enterOpen(page: Page, n: number) {
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state as { info: { solution: string }; cells: { value: number }[] });
  const open = state.cells.map((c, i) => (c.value ? -1 : i)).filter((i) => i >= 0);
  for (const cell of open.slice(0, n)) {
    const { x, y } = await cellPoint(page, cell);
    await page.mouse.click(x, y);
    await page.keyboard.press(`Digit${state.info.solution[cell]}`);
  }
}

/** today's daily on the board, as #daily opens it */
async function openDaily(page: Page) {
  await page.goto('/#daily');
  await expect(page.locator('svg.board')).toBeVisible();
  await expect.poll(async () => (await saved(page)).dailyKey).toBe(localDateKey());
}

for (const [name, use] of [
  ['laptop', { viewport: { width: 1280, height: 800 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(`a game under way, ${name}`, () => {
    test.use(use);
    const phone = name === 'phone';
    const today = localDateKey();

    test.beforeEach(async ({ context }: { context: BrowserContext }) => {
      await context.addInitScript(welcomed);
    });

    test('a friend’s link opened in a new tab keeps the daily under way, and the note brings it back with its entries and its time', async ({ context, page }) => {
      await openDaily(page);
      await enter(page, phone, 4);
      await page.waitForTimeout(2100);
      // the last digit saves the clock as it stands
      await enter(page, phone, 1, 4);
      const before = await saved(page);
      expect(before).toMatchObject({ dailyKey: today, entries: 5, aside: null });
      expect(before.elapsed).toBeGreaterThan(2000);
      await page.close();

      // the friend's challenge, tapped in a chat: it opens, and the daily is kept
      const friend = await context.newPage();
      await friend.goto(`/p/${EASY}?vs=300`);
      await expect(friend.locator('svg.board')).toBeVisible();
      await expect(friend.locator('.toast')).toContainText('A challenge: solve it faster than 5:00');
      await expect(note(friend)).toBeVisible();
      expect(await saved(friend)).toMatchObject({ puzzle: EASY, aside: { dailyKey: today, entries: 5 } });
      await friend.close();

      // the app opened again: the link's game, and the note offering the daily back
      const again = await context.newPage();
      await again.goto('/');
      await expect(again.locator('svg.board')).toBeVisible();
      const line = note(again);
      await expect(line).toBeVisible();
      // beside the board, never over it, and no dialog
      await expect(again.getByRole('dialog')).toHaveCount(0);
      await press(phone, line.getByRole('button', { name: 'Back to it' }));
      await expect.poll(() => saved(again)).toMatchObject({ dailyKey: today, entries: 5, aside: null });
      expect((await saved(again)).elapsed).toBeGreaterThanOrEqual(before.elapsed);
      await expect(again.locator('.timer')).not.toHaveText('0:00');
      await expect(line).toHaveCount(0);
      await expect.poll(() => again.evaluate(() => location.pathname)).toBe(`/daily/${today}`);
    });

    test('a friend’s position nobody touched, then a second friend’s link: today’s daily stays kept', async ({ browser, context, page }) => {
      const position = await positionLink(browser, EASY, 5);
      await openDaily(page);
      await enter(page, phone, 3);
      await page.close();

      // the first friend's position: five entries and a mark of theirs, not the player's
      const first = await context.newPage();
      await first.goto(position);
      await expect(first.locator('.toast')).toHaveText('Shared position loaded, with entries, marks and colours');
      expect(await saved(first)).toMatchObject({ puzzle: EASY, entries: 5, aside: { dailyKey: today, entries: 3 } });
      await first.close();

      // the second friend's challenge: the daily is still the game kept
      const second = await context.newPage();
      await second.goto(`/p/${HARD}?vs=600`);
      await expect(second.locator('.toast')).toContainText('A challenge: solve it faster than 10:00');
      expect(await saved(second)).toMatchObject({ puzzle: HARD, aside: { dailyKey: today, entries: 3 } });
      await press(phone, note(second).getByRole('button', { name: 'Back to it' }));
      await expect.poll(() => saved(second)).toMatchObject({ dailyKey: today, entries: 3 });
    });

    test('Back to it offers the other game in turn, and a game with no link of its own stays one tap away, from New once its note is put away', async ({ context, page }) => {
      // a first visit's own game: it has no link a friend could send back
      await page.goto('/');
      await expect.poll(async () => (await saved(page)).puzzle).not.toBeNull();
      const own = (await saved(page)).puzzle;
      await enter(page, phone, 3);
      await page.close();

      const friend = await context.newPage();
      await friend.goto(`/p/${EASY}/`);
      await expect(note(friend)).toBeVisible();
      await enter(friend, phone, 2);
      await press(phone, note(friend).getByRole('button', { name: 'Back to it' }));
      await expect.poll(() => saved(friend)).toMatchObject({ puzzle: own, entries: 3, aside: { puzzle: EASY, entries: 2, hidden: false } });
      // the note now offers the friend's game
      await expect(note(friend)).toBeVisible();
      await friend.close();

      // the friend's link again: that game, and the player's own still offered
      const again = await context.newPage();
      await again.goto(`/p/${EASY}/`);
      await expect(again.locator('.toast')).toHaveText('Back to your game on a shared puzzle, where you left it');
      expect(await saved(again)).toMatchObject({ puzzle: EASY, entries: 2, aside: { puzzle: own, entries: 3, hidden: false } });
      await expect(note(again)).toBeVisible();

      // put away, the note is gone, and New offers the game
      await press(phone, note(again).getByRole('button', { name: 'Hide this note' }));
      await expect(note(again)).toHaveCount(0);
      await press(phone, again.locator('.menu-row button', { hasText: 'New' }));
      await press(phone, again.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Back to your game in progress/ }));
      await expect.poll(() => saved(again)).toMatchObject({ puzzle: own, entries: 3, aside: { puzzle: EASY, entries: 2 } });
      await expect(again.locator('.toast')).toHaveText('Back to your Easy game, where you left it');
    });

    test('New, then Daily puzzle, with today’s daily under way goes on with it: its entries stay, from behind a puzzle being typed in too', async ({ page }) => {
      await openDaily(page);
      await enter(page, phone, 3);
      await press(phone, page.locator('.menu-row button', { hasText: 'New' }));
      const dialog = page.getByRole('dialog', { name: 'New game' });
      await press(phone, dialog.getByRole('button', { name: /^Daily puzzle/ }));
      await expect(dialog).toBeHidden();
      await expect(page.locator('.toast')).toHaveText('Today’s daily, where you left it');
      expect(await saved(page)).toMatchObject({ dailyKey: today, entries: 3 });

      // a puzzle typed in over it, then Daily again: the same daily, not a second copy
      await press(phone, page.locator('.menu-row button', { hasText: 'New' }));
      await press(phone, dialog.getByRole('button', { name: /^Custom/ }));
      const { x, y } = await cellPoint(page, 0);
      if (phone) await page.touchscreen.tap(x, y);
      else await page.mouse.click(x, y);
      await page.keyboard.press('Digit5');
      await expect.poll(async () => (await saved(page)).custom).toBe(true);
      await press(phone, page.locator('.menu-row button', { hasText: 'New' }));
      await press(phone, dialog.getByRole('button', { name: /^Daily puzzle/ }));
      await expect(page.locator('.toast')).toHaveText('Today’s daily, where you left it');
      await expect.poll(() => saved(page)).toMatchObject({ dailyKey: today, entries: 3, custom: false });
    });

    test('custom entry opened twice, then Cancel, brings back the game from before the first', async ({ page }) => {
      await page.goto(`/#p=${EASY}`);
      await expect(page.locator('svg.board')).toBeVisible();
      await enter(page, phone, 3);
      for (let k = 0; k < 2; k++) {
        await press(phone, page.locator('.menu-row button', { hasText: 'New' }));
        await press(phone, page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Custom/ }));
        await expect(page.locator('.hint-panel', { hasText: 'Custom puzzle' })).toBeVisible();
        const { x, y } = await cellPoint(page, 0);
        if (phone) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await page.keyboard.press('Digit5');
      }
      await press(phone, page.locator('.hint-panel', { hasText: 'Custom puzzle' }).getByRole('button', { name: 'Cancel', exact: true }));
      await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 3, custom: false });
    });

    test('while a puzzle is typed in, Share says why there is no link yet and Restart clears the digits', async ({ page }) => {
      await page.goto(`/#p=${EASY}`);
      await expect(page.locator('svg.board')).toBeVisible();
      await press(phone, page.locator('.menu-row button', { hasText: 'New' }));
      await press(phone, page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Custom/ }));
      for (const [cell, key] of [[0, 'Digit5'], [1, 'Digit6']] as const) {
        const { x, y } = await cellPoint(page, cell);
        if (phone) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
        await page.keyboard.press(key);
      }
      await expect.poll(async () => (await saved(page)).typed).toBe(2);
      // it looks unavailable (aria-disabled), and a tap still says why
      const share = page.locator('.menu-row button', { hasText: 'Share' });
      await expect(share).toHaveAttribute('aria-disabled', 'true');
      await (phone ? share.tap({ force: true }) : share.click({ force: true }));
      await expect(page.locator('.toast')).toHaveText('A puzzle being typed in has no link yet. Press Check & play first');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await press(phone, page.locator('.menu-row button', { hasText: 'Restart' }));
      const ask = page.getByRole('dialog', { name: 'Clear the board?' });
      await expect(ask).toContainText('Every digit on the board is cleared.');
      await expect(ask.getByRole('button', { name: 'Keep typing' })).toBeVisible();
      await press(phone, ask.getByRole('button', { name: 'Clear', exact: true }));
      await expect(page.locator('.toast')).toHaveText('Board cleared');
      expect(await saved(page)).toMatchObject({ custom: true, typed: 0 });
    });
  });
}

test.describe('Back and Forward, phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('three games in one tab, then Back twice: the game set aside comes back, and a puzzle nobody played on opens nothing over it, the daily keeping its digit', async ({ page }) => {
    await page.addInitScript(welcomed);
    const today = localDateKey();
    // a friend's puzzle, untouched; a Hard one over it, two digits; today's daily over that, one
    await page.goto(`/p/${EASY}/`);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(EASY);
    await page.evaluate((p) => (location.hash = `#p=${p}`), HARD);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(HARD);
    await enter(page, true, 2);
    await page.evaluate(() => (location.hash = '#daily'));
    await expect.poll(async () => (await saved(page)).dailyKey).toBe(today);
    await enter(page, true, 1);
    await expect.poll(() => saved(page)).toMatchObject({ dailyKey: today, entries: 1, aside: { puzzle: HARD, entries: 2 } });
    // Back: the Hard game comes back, the daily goes into the slot
    await page.goBack();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: HARD, entries: 2, aside: { dailyKey: today, entries: 1 } });
    // Back again, to the friend's puzzle nobody played on and nobody kept:
    // nothing opens over the Hard game, the daily stays kept, and the
    // address is the board's again
    await page.goBack();
    await page.waitForTimeout(600);
    expect(await saved(page)).toMatchObject({ puzzle: HARD, entries: 2, aside: { dailyKey: today, entries: 1 } });
    expect(page.url()).toContain(HARD);
    await expect(page.locator('.toast')).not.toContainText('is gone');
    // Forward to the daily brings it back with its digit, never a fresh one
    await page.goForward();
    await page.goForward();
    await expect.poll(() => saved(page)).toMatchObject({ dailyKey: today, entries: 1, aside: { puzzle: HARD, entries: 2 } });
  });
});

test.describe('Back and Forward across pages of the app, phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('addresses typed into one tab, then Back twice and Forward twice: the kept game comes back, a friend’s puzzle nobody played on opens nothing, and the daily keeps its digit', async ({ page }) => {
    await page.addInitScript(welcomed);
    const today = localDateKey();
    // each address typed into the tab is a page of its own (no back-forward cache here)
    await page.goto(`/p/${EASY}/`);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(EASY);
    await page.goto(`/p/${HARD}/`);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(HARD);
    await enter(page, true, 2);
    await page.goto(`/daily/${today}`);
    await expect.poll(async () => (await saved(page)).dailyKey).toBe(today);
    await enter(page, true, 1);
    await expect.poll(() => saved(page)).toMatchObject({ dailyKey: today, entries: 1, aside: { puzzle: HARD, entries: 2 } });
    // Back: the Hard game comes back, the daily goes into the slot
    await page.goBack();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: HARD, entries: 2, aside: { dailyKey: today, entries: 1 } });
    // Back again, to the friend's puzzle nobody kept: no fresh copy opens over the Hard game
    await page.goBack();
    await expect(page.locator('svg.board')).toBeVisible();
    await page.waitForTimeout(800);
    expect(await saved(page)).toMatchObject({ puzzle: HARD, entries: 2, aside: { dailyKey: today, entries: 1 } });
    expect(page.url()).toContain(HARD);
    await expect(page.locator('.toast', { hasText: 'is gone' })).toHaveCount(0);
    // Forward twice: the daily with its digit, never a fresh one
    await page.goForward();
    await page.goForward();
    await expect.poll(() => saved(page)).toMatchObject({ dailyKey: today, entries: 1, aside: { puzzle: HARD, entries: 2 } });
    await expect(page.locator('.toast', { hasText: 'is gone' })).toHaveCount(0);
  });

  test('Back while a puzzle is typed in over a game, with another kept, lets no game go: the entry stays on the board', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.goto(`/#p=${EASY}`);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(EASY);
    await enter(page, true, 3);
    await page.evaluate((p) => (location.hash = `#p=${p}`), HARD);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(HARD);
    await enter(page, true, 2);
    // Back to it, on the note: Easy on the board, Hard kept, and the address Easy's
    await note(page).getByRole('button', { name: 'Back to it' }).tap();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 3, aside: { puzzle: HARD, entries: 2 } });
    await expect.poll(() => page.url()).toContain(EASY);
    // New, Custom, two digits typed
    await page.locator('.menu-row button', { hasText: 'New' }).tap();
    await page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Custom/ }).tap();
    for (const [cell, key] of [[0, 'Digit5'], [1, 'Digit6']] as const) {
      const { x, y } = await cellPoint(page, cell);
      await page.touchscreen.tap(x, y);
      await page.keyboard.press(key);
    }
    await expect.poll(async () => (await saved(page)).typed).toBe(2);
    // the browser's Back (or the back gesture), to the entry that names Easy, the game behind the entry:
    // it opens nothing over the entry, and the address goes back to the board's (the entry's)
    const entryAddress = page.url();
    await page.goBack();
    await expect.poll(() => page.url()).toBe(entryAddress);
    await page.waitForTimeout(600);
    expect(await saved(page)).toMatchObject({ custom: true, typed: 2, aside: { puzzle: HARD, entries: 2 } });
    await expect(page.locator('.toast', { hasText: 'is gone' })).toHaveCount(0);
    // and Cancel still brings back the Easy game behind it
    await page.locator('.hint-panel', { hasText: 'Custom puzzle' }).getByRole('button', { name: 'Cancel', exact: true }).tap();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 3, custom: false, aside: { puzzle: HARD, entries: 2 } });
  });
});

test.describe('links and Import, laptop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a link opened in the same tab after a reload puts the game aside instead of replacing it', async ({ page }) => {
    await page.addInitScript(welcomed);
    await openDaily(page);
    await enter(page, false, 2);
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await page.evaluate((p) => (location.hash = `#p=${p}`), EASY);
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, aside: { dailyKey: localDateKey(), entries: 2 } });
    await expect(note(page)).toBeVisible();
  });

  test('a Position link of the board’s own puzzle opened in the tab leaves the address once open: a reload, or Back then Forward, keeps the moves made on it', async ({ browser }) => {
    const position = await positionLink(browser, EASY, 3);
    const context = await browser.newContext();
    await context.addInitScript(welcomed);
    const page = await context.newPage();
    await page.goto(`/p/${EASY}/`);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(EASY);
    await enter(page, false, 5);
    // the friend's position of the same puzzle, pasted into the address bar: a hash change
    await page.evaluate((hash) => (location.hash = hash), new URL(position).hash);
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 3, aside: { puzzle: EASY, entries: 5 } });
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
    await enterOpen(page, 4);
    await expect.poll(async () => (await saved(page)).entries).toBe(7);
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await page.waitForTimeout(600);
    expect(await saved(page)).toMatchObject({ puzzle: EASY, entries: 7, aside: { puzzle: EASY, entries: 5 } });
    await expect(page.locator('.toast', { hasText: 'is gone' })).toHaveCount(0);
    await page.goBack();
    await page.goForward();
    await page.waitForTimeout(600);
    expect(await saved(page)).toMatchObject({ puzzle: EASY, entries: 7, aside: { puzzle: EASY, entries: 5 } });
    await expect(page.locator('.toast', { hasText: 'is gone' })).toHaveCount(0);
    await context.close();
  });

  test('Import of a Position link keeps its entries and marks, and puts the game under way aside', async ({ browser }) => {
    // a position made on one device: three digits and a corner mark, copied as a Position link
    const position = await positionLink(browser, EASY, 3);

    // pasted into Import on another, with a game under way there
    const receiver = await browser.newContext();
    await receiver.addInitScript(welcomed);
    const b = await receiver.newPage();
    await b.goto(`/#p=${HARD}`);
    await expect(b.locator('svg.board')).toBeVisible();
    await enter(b, false, 1);
    await b.locator('.menu-row button', { hasText: 'Import' }).click();
    const dialog = b.getByRole('dialog', { name: 'Import a puzzle' });
    await dialog.locator('textarea').fill(position);
    await dialog.getByRole('button', { name: 'Load puzzle' }).click();
    await expect(dialog).toBeHidden();
    await expect(b.locator('.toast')).toHaveText('Shared position loaded, with entries, marks and colours');
    expect(await saved(b)).toMatchObject({ puzzle: EASY, entries: 3, marks: 1, aside: { puzzle: HARD, entries: 1 } });
    await expect(note(b)).toBeVisible();
    await receiver.close();
  });

  test('the Learn page’s Practice tab, reloaded while another tab has the daily under way, comes back to its practice behind the pause card, the daily kept, with no toast', async ({ context }) => {
    await context.addInitScript(welcomed);
    const hide = (p: Page) =>
      p.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    // tab 1: today's daily, two digits, then behind the other tab (it pauses)
    const first = await context.newPage();
    await openDaily(first);
    await enter(first, false, 2);
    await hide(first);
    // tab 2: a Learn page, its Practice link, three digits, then a reload
    const second = await context.newPage();
    await second.goto('/learn/x-wing/');
    await second.locator('a.cta', { hasText: 'Practice X-Wing' }).first().click();
    await expect(second.locator('.practice-bar')).toBeVisible();
    await enter(second, false, 3);
    await expect.poll(async () => (await saved(second)).entries).toBeGreaterThanOrEqual(3);
    await second.reload();
    await expect(second.locator('svg.board')).toBeVisible();
    await expect(second.locator('.practice-bar')).toBeVisible();
    await expect(second.locator('.pause-card')).toBeVisible();
    expect(await saved(second)).toMatchObject({ aside: { dailyKey: localDateKey(), entries: 2 } });
    await expect(note(second)).toBeVisible();
    // nothing to say: no game came back from elsewhere, none went
    await second.waitForTimeout(400);
    await expect(second.locator('.toast')).toHaveCount(0);
    // tab 1, a view now, carries the home address: a reload of it, or the
    // tab brought back after the browser discarded it, starts from the saves
    // (the practice, the daily kept) instead of opening its old address
    expect(await first.evaluate(() => location.pathname)).toBe('/');
  });

  test('a practice set aside by a link in the same tab comes back with Back, and again after a reload', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.goto('/learn/x-wing/');
    await page.locator('a.cta', { hasText: 'Practice X-Wing' }).first().click();
    await expect(page.locator('.practice-bar')).toBeVisible();
    await expect.poll(async () => (await saved(page)).puzzle).not.toBeNull();
    const start = await saved(page);
    await enterOpen(page, 2);
    await expect.poll(async () => (await saved(page)).entries).toBe(start.entries + 2);
    // a friend's link in the same tab: the practice goes aside
    await page.evaluate((p) => (location.hash = `#p=${p}`), EASY);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(EASY);
    await enter(page, false, 3);
    await expect.poll(async () => (await saved(page)).entries).toBe(3);
    // Back: the address is the practice's again, and so is the board
    await page.goBack();
    await expect(page.locator('.practice-bar')).toBeVisible();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: start.puzzle, entries: start.entries + 2, aside: { puzzle: EASY, entries: 3 } });
    // a reload of that address keeps the practice, behind the pause card, and lets nothing go
    await page.reload();
    await expect(page.locator('.practice-bar')).toBeVisible();
    await expect(page.locator('.pause-card')).toBeVisible();
    expect(await saved(page)).toMatchObject({ puzzle: start.puzzle, entries: start.entries + 2, aside: { puzzle: EASY, entries: 3 } });
    await page.waitForTimeout(400);
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('a Learn page’s Practice link puts the daily under way aside', async ({ page }) => {
    await page.addInitScript(welcomed);
    await openDaily(page);
    await enter(page, false, 3);
    await page.goto('/learn/x-wing/');
    await page.locator('a.cta', { hasText: 'Practice X-Wing' }).first().click();
    await expect(page.locator('.practice-bar')).toBeVisible();
    await expect.poll(() => saved(page)).toMatchObject({ aside: { dailyKey: localDateKey(), entries: 3 } });
    await expect(note(page)).toBeVisible();
  });

  test('after a crash, Clear the board and reload keeps the game set aside, and the note brings it back', async ({ page }) => {
    await page.addInitScript(welcomed);
    await openDaily(page);
    await enter(page, false, 3);
    await page.goto(`/p/${EASY}/`);
    await expect(note(page)).toBeVisible();
    // a save the board cannot draw, as the next page finds it (the page
    // going away saves its own good board first, so the save is broken
    // once that page has gone): the error screen
    await page.addInitScript(() => {
      if (sessionStorage.getItem('break-the-save') !== '1') return;
      sessionStorage.removeItem('break-the-save');
      const save = JSON.parse(localStorage.getItem('sudokui-game-v1')!);
      save.state.cells = 'broken';
      localStorage.setItem('sudokui-game-v1', JSON.stringify(save));
    });
    await page.evaluate(() => sessionStorage.setItem('break-the-save', '1'));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Something went wrong');
    await page.getByRole('button', { name: 'Clear the board and reload' }).click();
    await expect(note(page)).toBeVisible();
    await expect.poll(() => saved(page)).toMatchObject({ puzzle: EASY, entries: 0, aside: { dailyKey: localDateKey(), entries: 3 } });
    await note(page).getByRole('button', { name: 'Back to it' }).click();
    await expect.poll(() => saved(page)).toMatchObject({ dailyKey: localDateKey(), entries: 3 });
  });

  test('with a game kept and another under way, a third opened by a link lets one go and the toast, read to a screen reader, says which', async ({ page }) => {
    await page.addInitScript(welcomed);
    await openDaily(page);
    await enter(page, false, 3);
    await page.goto(`/p/${EASY}/`);
    await expect(note(page)).toBeVisible();
    await enter(page, false, 1);
    await expect.poll(async () => (await saved(page)).entries).toBe(1);
    // the toast is a live region before it has anything to say
    await expect(page.locator('[role="status"][aria-live="polite"]').first()).toBeAttached();
    await page.goto(`/p/${HARD}/`);
    // the friend's game is named apart from the other friend's game now on the board, by its rating
    const told = 'Only one game in progress is kept at a time: your game on a shared puzzle (HoDoKu rating 196) is gone, today’s daily is kept';
    await expect(page.getByRole('status').filter({ hasText: told })).toBeVisible();
    await expect(page.locator('.toast')).toHaveText(told);
    expect(await saved(page)).toMatchObject({ puzzle: HARD, aside: { dailyKey: localDateKey(), entries: 3 } });
    await expect(note(page)).toBeVisible();
    // a puzzle typed in, opened right away: the toast does not stand over its empty board
    await page.locator('.menu-row button', { hasText: 'New' }).click();
    await page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Custom/ }).click();
    await expect(page.locator('.hint-panel', { hasText: 'Custom puzzle' })).toBeVisible();
    await expect(page.locator('.toast')).toHaveCount(0);
  });

  test('after a crash with a puzzle being typed in and nothing set aside, Clear the board keeps the game it was typed over', async ({ page }) => {
    await page.addInitScript(welcomed);
    await openDaily(page);
    await enter(page, false, 3);
    await page.locator('.menu-row button', { hasText: 'New' }).click();
    await page.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /^Custom/ }).click();
    const { x, y } = await cellPoint(page, 0);
    await page.mouse.click(x, y);
    await page.keyboard.press('Digit5');
    await expect.poll(async () => (await saved(page)).custom).toBe(true);
    expect((await saved(page)).aside).toBeNull();
    await page.addInitScript(() => {
      if (sessionStorage.getItem('break-the-save') !== '1') return;
      sessionStorage.removeItem('break-the-save');
      const save = JSON.parse(localStorage.getItem('sudokui-game-v1')!);
      save.state.cells = 'broken';
      localStorage.setItem('sudokui-game-v1', JSON.stringify(save));
    });
    await page.evaluate(() => sessionStorage.setItem('break-the-save', '1'));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('Something went wrong');
    await page.getByRole('button', { name: 'Clear the board and reload' }).click();
    await expect(note(page)).toBeVisible();
    await expect.poll(() => saved(page)).toMatchObject({ custom: false, aside: { dailyKey: localDateKey(), entries: 3 } });
    await note(page).getByRole('button', { name: 'Back to it' }).click();
    await expect.poll(() => saved(page)).toMatchObject({ dailyKey: localDateKey(), entries: 3 });
  });

  test('Back to it by keyboard leaves the focus on the board, and the toast says which game is back', async ({ context, page }) => {
    await context.addInitScript(welcomed);
    await openDaily(page);
    await enter(page, false, 2);
    await page.close();
    const friend = await context.newPage();
    await friend.goto(`/p/${EASY}/`);
    await note(friend).getByRole('button', { name: 'Back to it' }).focus();
    await friend.keyboard.press('Enter');
    await expect(friend.locator('.toast')).toHaveText('Back to today’s daily, where you left it');
    await expect(friend.locator('svg.board')).toBeFocused();
    expect(await saved(friend)).toMatchObject({ dailyKey: localDateKey(), entries: 2 });
  });

  test('Back to it pressed twice in a row is heard twice, each time naming the game back; the note put away from the keyboard leaves the focus on the board', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.goto(`/p/${EASY}/`);
    await expect.poll(async () => (await saved(page)).puzzle).toBe(EASY);
    await enter(page, false, 3);
    await page.goto(`/p/${HARD}/`);
    await expect(note(page)).toBeVisible();
    await enter(page, false, 2);
    // what the live region says: words added to it, once per change
    await page.evaluate(() => {
      const region = document.querySelector('.toast, .toast-idle')!;
      const heard: string[] = ((window as any).__heard = []);
      new MutationObserver((records) => {
        if (records.some((r) => [...r.addedNodes].some((n) => n.textContent))) heard.push(region.textContent ?? '');
      }).observe(region, { childList: true, subtree: true, characterData: true });
    });
    const back = note(page).getByRole('button', { name: 'Back to it' });
    await back.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('svg.board')).toBeFocused();
    await back.focus();
    await page.keyboard.press('Enter');
    // two friends' games: each named apart from the other by its rating
    await expect
      .poll(() => page.evaluate(() => (window as any).__heard as string[]))
      .toEqual(['Back to your game on a shared puzzle (HoDoKu rating 196), where you left it', 'Back to your game on a shared puzzle (HoDoKu rating 1348), where you left it']);
    expect(await saved(page)).toMatchObject({ puzzle: HARD, entries: 2, aside: { puzzle: EASY, entries: 3 } });
    // put away from the keyboard: the note goes, the focus stays on the board, the game stays kept
    await note(page).getByRole('button', { name: 'Hide this note' }).focus();
    await page.keyboard.press('Enter');
    await expect(note(page)).toHaveCount(0);
    await expect(page.locator('svg.board')).toBeFocused();
    expect(await saved(page)).toMatchObject({ aside: { puzzle: EASY, entries: 3, hidden: true } });
  });

  test('on a small phone the kept game’s note stands in for the past-daily note, and the digit keys stay on screen', async ({ browser }) => {
    const phone = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });
    await phone.addInitScript(welcomed);
    const page = await phone.newPage();
    await page.goto('/es/#daily');
    await expect.poll(async () => (await saved(page)).dailyKey).toBe(localDateKey());
    await enter(page, true, 3);
    await page.goto('/es/daily/2026-11-01');
    await expect.poll(async () => (await saved(page)).dailyKey).toBe('2026-11-01');
    await expect(page.locator('.set-aside')).toBeVisible();
    await expect(page.locator('.past-daily:not(.set-aside)')).toHaveCount(0);
    const keys = (await page.locator('.numpad').boundingBox())!;
    expect(keys.y + keys.height / 2).toBeLessThan(568);
    // put away, the past-daily note comes back
    await page.locator('.set-aside').getByRole('button', { name: 'Ocultar este aviso' }).tap();
    await expect(page.locator('.past-daily:not(.set-aside)')).toBeVisible();
    await phone.close();
  });
});
