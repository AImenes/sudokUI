/**
 * One page of the app plays at a time, in a real browser
 * (docs/architecture.md, "One page plays at a time"; src/state/play.ts):
 * two pages in one browser context share the saves, the channel and the
 * locks, as two tabs do. A link opened in a new tab takes the play: the
 * first tab is a view that writes nothing, and back in it the play comes
 * back with the saves, the link's game on the board and the first game
 * kept. Switched back with nothing changed, a tab goes on as it was, its
 * win screen still up. A page that comes up hidden while another plays is
 * a view until it is shown. Two pages in view: the one that does not play
 * has the cover, whose Play here hands over. The holder closed, the view
 * takes the play when shown; a frozen holder has it taken after the wait;
 * and a view writes nothing for a minute.
 */
import { test, expect, Page, BrowserContext } from '@playwright/test';
import { parseGrid, gridToString } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import { localDateKey } from '../../src/content/dailies';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
/** a Hard puzzle (rated 1348 when written) */
const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';
const SAVES = ['sudokui-game-v1', 'sudokui-stats-v1', 'sudokui-daily-v1'];
/** the cover's line, which names its dialog */
const ELSEWHERE = 'sudokUI is open in another tab or window, and your game carries on there.';

const cover = (p: Page) => p.getByRole('dialog', { name: ELSEWHERE });
const note = (p: Page) => p.getByRole('note').filter({ hasText: 'Your game in progress is kept.' });

/** every write to the browser's storage, by key, and whether the cover was ever drawn, from before the app runs */
function watch(context: BrowserContext) {
  return context.addInitScript(() => {
    localStorage.setItem('sudokui-welcomed', '1');
    const writes: string[] = ((window as any).__writes = []);
    const set = Storage.prototype.setItem;
    const remove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k: string, v: string) {
      if (this === window.localStorage) writes.push(k);
      return set.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k: string) {
      if (this === window.localStorage) writes.push(k);
      return remove.call(this, k);
    };
    // the app's channels, so a test can make a page deaf, as a frozen one is
    const Channel = window.BroadcastChannel;
    const channels: BroadcastChannel[] = ((window as any).__channels = []);
    window.BroadcastChannel = class extends Channel {
      constructor(name: string) {
        super(name);
        channels.push(this);
      }
    };
    // (kept in the tab's session storage too, across a reload)
    (window as any).__coverSeen = false;
    new MutationObserver(() => {
      if (!document.querySelector('.play-cover')) return;
      (window as any).__coverSeen = true;
      sessionStorage.setItem('cover-seen', '1');
    }).observe(document, { subtree: true, childList: true });
  });
}
/** this page's writes to the saves and to the holder's name */
const writesOf = (p: Page) => p.evaluate((keys) => ((window as any).__writes as string[]).filter((k) => keys.includes(k)).length, [...SAVES, 'sudokui-play']);
/** the three saves as they stand */
const saves = (p: Page) => p.evaluate((keys) => keys.map((k) => localStorage.getItem(k)), SAVES);
/** the saves once they have stopped changing (the moves are credited to the record one by one, in a worker) */
async function settled(p: Page) {
  let last = '';
  await expect
    .poll(
      async () => {
        const now = JSON.stringify(await saves(p));
        const same = now === last;
        last = now;
        return same;
      },
      { intervals: [600], timeout: 15_000 }
    )
    .toBe(true);
  return JSON.parse(last) as (string | null)[];
}

/** the game as it was saved, and the one set aside */
const saved = (p: Page) =>
  p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state ?? {};
    type Cell = { given: boolean; value: number };
    const entries = (cells?: Cell[]) => (cells ?? []).filter((c) => !c.given && c.value).length;
    return {
      puzzle: (s.info?.puzzle ?? null) as string | null,
      dailyKey: (s.info?.dailyKey ?? null) as string | null,
      entries: entries(s.cells),
      paused: !!s.paused,
      aside: s.setAside ? { puzzle: (s.setAside.info?.puzzle ?? null) as string | null, dailyKey: (s.setAside.info?.dailyKey ?? null) as string | null, entries: entries(s.setAside.cells) } : null
    };
  });

/** a tab shown or hidden, as the browser does when another tab is in front */
const shown = (p: Page, visible: boolean) =>
  p.evaluate((v) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (v ? 'visible' : 'hidden') });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => !v });
    document.dispatchEvent(new Event('visibilitychange'));
  }, visible);

async function open(p: Page, path: string) {
  await p.goto(path);
  await expect(p.locator('svg.board')).toBeVisible();
  await expect.poll(async () => (await saved(p)).puzzle).not.toBeNull();
}

/** correct digits in the next n open cells of the game on the board, a click on the cell, then the key */
async function enter(p: Page, n: number) {
  const s = await p.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state as { info: { puzzle: string }; cells: { value: number }[] });
  const solution = gridToString(solve(parseGrid(s.info.puzzle)!)!);
  const open = s.cells.map((c, i) => (c.value ? -1 : i)).filter((i) => i >= 0);
  const box = (await p.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  for (const cell of open.slice(0, n)) {
    await p.mouse.click(box.x + ((cell % 9) + 0.5) * size, box.y + (Math.floor(cell / 9) + 0.5) * size);
    await p.keyboard.press(`Digit${solution[cell]}`);
  }
  await expect.poll(async () => (await saved(p)).entries).toBeGreaterThanOrEqual(n);
}

/** a mark on the page that a reload would take away */
const mark = (p: Page) => p.evaluate(() => ((window as any).__same = true));
const same = (p: Page) => p.evaluate(() => (window as any).__same === true);

test.describe('one page plays at a time', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.beforeEach(async ({ context }) => {
    await watch(context);
  });

  test('a link opened in a new tab while the first has a game under way: the first is a view, nothing is lost, and back in it the play comes back with the saves, the link’s game on the board and the first kept with Back to it', async ({ context }) => {
    const today = localDateKey();
    const a = await context.newPage();
    await open(a, '/#daily');
    await enter(a, 3);
    // the chat app in front, then the friend's link in a new tab
    await shown(a, false);
    const b = await context.newPage();
    await open(b, `/p/${HARD}/`);
    await expect(note(b)).toBeVisible();
    await expect.poll(() => saved(b)).toMatchObject({ puzzle: HARD, aside: { dailyKey: today, entries: 3 } });
    const before = await writesOf(a);
    await enter(b, 2);
    // the first tab wrote nothing meanwhile
    expect(await writesOf(a)).toBe(before);
    await mark(a);
    // back in the first tab: it takes the play back and, the saves changed, reloads into them
    await shown(b, false);
    await shown(a, true);
    await expect.poll(() => same(a)).toBe(false);
    await expect(a.locator('svg.board')).toBeVisible();
    expect(a.url()).toContain(HARD);
    expect(await saved(a)).toMatchObject({ puzzle: HARD, entries: 2, aside: { dailyKey: today, entries: 3 } });
    // the link's game behind the pause card it was left with, and the daily one tap away
    await expect(a.locator('.pause-card')).toBeVisible();
    await a.getByRole('button', { name: 'Resume game' }).click();
    await note(a).getByRole('button', { name: 'Back to it' }).click();
    await expect.poll(() => saved(a)).toMatchObject({ dailyKey: today, entries: 3, aside: { puzzle: HARD, entries: 2 } });
    // and the second tab, a view now, wrote nothing after it gave the play
    const given = await writesOf(b);
    await a.waitForTimeout(300);
    expect(await writesOf(b)).toBe(given);
    await expect(a.locator('.play-cover')).toHaveCount(0);
    // hidden as a view, then shown and back in play: the cover never came up in the first tab
    expect(await a.evaluate(() => sessionStorage.getItem('cover-seen'))).toBeNull();
  });

  test('switched back with nothing changed in the other tab, a tab goes on as it was: no reload, its win screen still up', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 81 - [...EASY].filter((ch) => ch !== '.').length);
    const won = a.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(won).toBeVisible();
    await mark(a);
    await shown(a, false);
    // the app opened in another tab, looked at, and left
    const b = await context.newPage();
    await open(b, '/');
    await expect(b.locator('.play-cover')).toHaveCount(0);
    await shown(b, false);
    await shown(a, true);
    await a.waitForTimeout(500);
    expect(await same(a)).toBe(true);
    await expect(won).toBeVisible();
    await expect(won).toContainText('Unassisted solve');
    await expect(a.locator('.play-cover')).toHaveCount(0);
    // and it plays: its win screen's buttons answer
    await won.getByRole('button', { name: 'Admire the grid' }).click();
    await expect(won).toHaveCount(0);
  });

  test('a page that comes up hidden while another plays is a view and writes nothing; shown, it takes the play and opens its link, the cover never drawn', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    const then = await settled(a);
    // a link opened in a background tab
    const b = await context.newPage();
    await b.addInitScript(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    });
    await b.goto(`/p/${HARD}/`);
    await expect(b.locator('svg.board')).toBeAttached();
    await expect(b.locator('.app')).toHaveAttribute('inert', '');
    await b.waitForTimeout(800);
    expect(await writesOf(b)).toBe(0);
    expect(await saves(b)).toEqual(then);
    // its link waits for it, and the first tab still plays
    expect(b.url()).toContain(HARD);
    await expect(a.locator('.play-cover')).toHaveCount(0);
    // shown the first time: the play is its own, the link opens over the game under way
    await shown(b, true);
    await expect.poll(() => saved(b)).toMatchObject({ puzzle: HARD, aside: { puzzle: EASY, entries: 2 } });
    await expect(note(b)).toBeVisible();
    await expect(b.locator('.app')).not.toHaveAttribute('inert', '');
    expect(await b.evaluate(() => (window as any).__coverSeen)).toBe(false);
    // the first tab, in view beside it, is the view now
    await expect(cover(a)).toBeVisible();
  });

  test('two pages in view: the one that does not play has the cover, and its Play here hands over', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 1);
    const b = await context.newPage();
    await open(b, '/');
    // a: the cover, a dialog with its name, the focus on Play here
    await expect(cover(a)).toBeVisible();
    const here = cover(a).getByRole('button', { name: 'Play here' });
    await expect(here).toBeFocused();
    await expect(a.locator('.app')).toHaveAttribute('inert', '');
    // nothing behind it acts: a digit, Undo, a mode, Escape; no Tab stop behind it
    const then = await settled(a);
    const before = await writesOf(a);
    for (const key of ['Digit5', 'Control+KeyZ', 'KeyX', 'Escape', 'KeyP']) await a.keyboard.press(key);
    await a.keyboard.press('Tab');
    expect(await a.evaluate(() => !!document.activeElement?.closest('.app'))).toBe(false);
    await a.mouse.click(640, 400);
    expect(await saves(a)).toEqual(then);
    expect(await writesOf(a)).toBe(before);
    await expect(cover(b)).toHaveCount(0);
    // a minimised and shown again beside b, which is in view: b keeps the play, a its cover
    await shown(a, false);
    await shown(a, true);
    await a.waitForTimeout(400);
    await expect(cover(a)).toBeVisible();
    await expect(cover(b)).toHaveCount(0);
    expect(await writesOf(a)).toBe(before);
    // Play here: the play comes back to a, and b is the view
    await here.focus();
    await a.keyboard.press('Enter');
    await expect(cover(b)).toBeVisible();
    await expect(a.locator('.play-cover')).toHaveCount(0);
    await expect(a.locator('.app')).not.toHaveAttribute('inert', '');
    // the game under way paused as the play went, and is a's to resume
    await expect(a.locator('svg.board')).toBeFocused();
    await a.getByRole('button', { name: 'Resume game' }).click();
    await enter(a, 2);
    expect((await saved(a)).entries).toBe(3);
  });

  test('the holder closed: the view takes the play when it is shown, and reloads into the moves made there', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 1);
    const b = await context.newPage();
    await open(b, '/');
    await expect(cover(a)).toBeVisible();
    await shown(a, false);
    // (the game under way paused as the play went)
    await b.getByRole('button', { name: 'Resume game' }).click();
    await enter(b, 3);
    await b.close();
    await mark(a);
    await shown(a, true);
    await expect.poll(() => same(a)).toBe(false);
    await expect(a.locator('svg.board')).toBeVisible();
    await expect(a.locator('.play-cover')).toHaveCount(0);
    // the digit made here and the three made there, behind the pause card the page left it with
    expect(await saved(a)).toMatchObject({ puzzle: EASY, entries: 4, paused: true });
    await expect(a.locator('.pause-card')).toBeVisible();
  });

  test('a frozen holder has the play taken after the wait; woken, it writes nothing and is a view', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 1);
    // frozen by the browser: it answers nothing
    await a.evaluate(() => ((window as any).__channels as BroadcastChannel[]).forEach((c) => (c.onmessage = null)));
    const cdp = await context.newCDPSession(a);
    await cdp.send('Page.setWebLifecycleState', { state: 'frozen' });
    const b = await context.newPage();
    const start = Date.now();
    await open(b, `/p/${HARD}/`);
    // the holder did not answer: the play was taken after the wait
    expect(Date.now() - start).toBeGreaterThanOrEqual(1400);
    await expect.poll(() => saved(b)).toMatchObject({ puzzle: HARD, aside: { puzzle: EASY, entries: 1 } });
    await enter(b, 1);
    const then = await settled(b);
    const before = await writesOf(a);
    await cdp.send('Page.setWebLifecycleState', { state: 'active' });
    await expect(cover(a)).toBeVisible();
    for (const key of ['Digit5', 'Control+KeyZ']) await a.keyboard.press(key);
    await a.waitForTimeout(300);
    expect(await writesOf(a)).toBe(before);
    expect(await saves(a)).toEqual(then);
  });

  test('a view writes nothing for a minute', async ({ context }) => {
    test.setTimeout(120_000);
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    const b = await context.newPage();
    await open(b, '/');
    await expect(cover(a)).toBeVisible();
    // the page that plays goes behind the others and rests
    await shown(b, false);
    const then = await settled(a);
    const before = await writesOf(a);
    await a.waitForTimeout(60_000);
    expect(await writesOf(a)).toBe(before);
    expect(await saves(a)).toEqual(then);
    expect(await a.evaluate(() => localStorage.getItem('sudokui-play'))).toBe(await b.evaluate(() => localStorage.getItem('sudokui-play')));
  });
});
