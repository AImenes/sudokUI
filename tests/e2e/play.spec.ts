/**
 * One page of the app plays at a time, in a real browser
 * (docs/architecture.md, "One page plays at a time"; src/state/play.ts):
 * two pages in one browser context share the saves, the channel and the
 * locks, as two tabs do. A link opened in a new tab takes the play: the
 * first tab is a view that writes nothing, and back in it the play comes
 * back with the saves, the link's game on the board and the first game
 * kept. Switched back with nothing changed, a tab goes on as it was, its
 * win screen still up, also when the other tab only fetched the day's
 * numbers. A page that comes up hidden while another plays is a view until
 * it is shown; one that comes up hidden with no page playing opens its
 * link only once it is looked at, so what the one slot lets go is told
 * where the player sees it. Two pages in view: the one that does not play
 * has the cover, whose Play here hands over. The holder closed, the view
 * takes the play when shown; a frozen holder has it taken after the wait;
 * and a view writes nothing for a minute.
 */
import { test, expect, chromium, Page, BrowserContext } from '@playwright/test';
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
      elapsed: (s.elapsedBefore ?? 0) as number,
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
/** whether the mark is still there; unknown (null) while the page is between two documents */
const same = (p: Page) => p.evaluate(() => (window as any).__same === true).catch(() => null);

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

  test('a game nobody has played on, with Learn open, and another tab opened and left: back in the first, no reload, Learn still open, and the clock is the one that ran in the other tab', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await a.getByRole('button', { name: /Learn/ }).first().click();
    const learn = a.getByRole('dialog', { name: 'Learn' });
    await expect(learn).toBeVisible();
    await mark(a);
    await shown(a, false);
    // the app opened in another tab: the same game, its clock running there for a while
    const b = await context.newPage();
    await open(b, '/');
    await expect(b.locator('.play-cover')).toHaveCount(0);
    await b.waitForTimeout(3000);
    await shown(b, false);
    const ran = (await saved(b)).elapsed;
    expect(ran).toBeGreaterThan(2500);
    await shown(a, true);
    await a.waitForTimeout(800);
    expect(await same(a)).toBe(true);
    await expect(learn).toBeVisible();
    await expect(a.locator('.play-cover')).toHaveCount(0);
    // the clock went on from where the other tab left it
    const secs = await a.locator('.timer').evaluate((el) => {
      const [m, s] = (el.textContent ?? '0:0').split(':').map(Number);
      return m * 60 + s;
    });
    expect(secs).toBeGreaterThanOrEqual(Math.floor(ran / 1000));
    expect(secs).toBeLessThanOrEqual(Math.floor(ran / 1000) + 3);
    // and back and forth again, touching nothing: still no reload
    await shown(a, false);
    await shown(b, true);
    await b.waitForTimeout(600);
    await shown(b, false);
    await shown(a, true);
    await a.waitForTimeout(600);
    expect(await same(a)).toBe(true);
    await expect(learn).toBeVisible();
  });

  test('the chain trainer open, and another tab opened and left with nothing done: back in the first, no reload, the trainer still open and its undo steps there', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/p/${HARD}`);
    await enter(a, 2);
    await a.getByRole('button', { name: /Chain/ }).first().click();
    await a.getByRole('button', { name: 'Use Chain' }).click();
    const trainer = a.getByRole('region', { name: 'Build a chain' });
    await expect(trainer).toBeVisible();
    const chainSave = (p: Page) =>
      p.evaluate(() => {
        const s = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state ?? {};
        return { auto: !!s.autoCandidates, handover: !!s.chainHandover };
      });
    await expect.poll(() => chainSave(a)).toEqual({ auto: true, handover: true });
    await mark(a);
    await shown(a, false);
    // the app opened in another tab and left: it reads the save as the
    // trainer's Done would leave it, so what it writes has the trainer's
    // auto candidates off, with nothing played
    const b = await context.newPage();
    await open(b, '/');
    await expect(b.locator('.play-cover')).toHaveCount(0);
    await expect(b.locator('.pause-card')).toBeVisible();
    const holderB = await b.evaluate(() => localStorage.getItem('sudokui-play'));
    await shown(b, false);
    await expect.poll(() => chainSave(b)).toEqual({ auto: false, handover: false });
    await shown(a, true);
    // the first takes the play back, and its write puts its trainer's auto candidates back
    await expect.poll(() => a.evaluate(() => localStorage.getItem('sudokui-play'))).not.toBe(holderB);
    await expect.poll(() => chainSave(a)).toEqual({ auto: true, handover: true });
    expect(await same(a)).toBe(true);
    await expect(a.locator('.play-cover')).toHaveCount(0);
    await expect(trainer).toBeVisible();
    // and its undo steps are there: the trainer's auto candidates, then the digits
    await a.locator('.pause-card .resume-btn').click();
    await expect(a.locator('.pause-card')).toHaveCount(0);
    const undo = a.locator('.action-row button', { hasText: 'Undo' });
    await undo.click();
    await expect(trainer).toHaveCount(0);
    await expect.poll(() => chainSave(a)).toEqual({ auto: false, handover: false });
    await undo.click();
    await expect.poll(async () => (await saved(a)).entries).toBe(1);
    expect(await same(a)).toBe(true);
  });

  test('a game kept in the slot, and another tab that only puts its note away: back in the first, no reload, the note away there too, and the undo steps still there', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    // a link in the same tab: the game under way goes into the slot
    await a.evaluate((p) => (window.location.hash = `p=${p}`), HARD);
    await expect(note(a)).toBeVisible();
    await enter(a, 2);
    await expect.poll(() => saved(a)).toMatchObject({ puzzle: HARD, entries: 2, aside: { puzzle: EASY, entries: 2 } });
    await mark(a);
    await shown(a, false);
    const b = await context.newPage();
    await open(b, '/');
    await expect(note(b)).toBeVisible();
    await note(b).getByRole('button', { name: 'Hide this note' }).click();
    await expect(note(b)).toHaveCount(0);
    await shown(b, false);
    await shown(a, true);
    await a.waitForTimeout(800);
    expect(await same(a)).toBe(true);
    await expect(note(a)).toHaveCount(0);
    await expect(a.locator('.play-cover')).toHaveCount(0);
    await a.locator('.pause-card .resume-btn').click();
    await a.locator('.action-row button', { hasText: 'Undo' }).click();
    await expect.poll(async () => (await saved(a)).entries).toBe(1);
    // the slot still holds its game, offered by New
    expect((await saved(a)).aside).toMatchObject({ puzzle: EASY, entries: 2 });
  });

  test('a page that has played and is a view carries the home address: reloaded (or a discarded tab brought back), it opens no old link over the game under way', async ({ context }) => {
    const today = localDateKey();
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    await shown(a, false);
    const b = await context.newPage();
    await open(b, `/p/${HARD}/`);
    await enter(b, 2);
    await b.evaluate(() => (location.hash = 'daily'));
    await expect.poll(async () => (await saved(b)).dailyKey).toBe(today);
    await enter(b, 2);
    const then = await saved(b);
    expect(then).toMatchObject({ dailyKey: today, aside: { puzzle: HARD, entries: 2 } });
    // a, the view, no longer names its old game
    expect(new URL(a.url()).pathname).toBe('/');
    await shown(b, false);
    await a.reload();
    await expect(a.locator('svg.board')).toBeVisible();
    await a.waitForTimeout(800);
    expect(await saved(a)).toMatchObject({ dailyKey: today, entries: 2, aside: { puzzle: HARD, entries: 2 } });
    await expect(a.locator('.toast', { hasText: 'is gone' })).toHaveCount(0);
  });

  test('the window that plays closed beside a view in view: the view takes the play by itself, its cover gone', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    const b = await context.newPage();
    await open(b, '/');
    await expect(cover(a)).toBeVisible();
    await b.close();
    await expect(a.locator('.play-cover')).toHaveCount(0, { timeout: 4000 });
    await expect(a.locator('.app')).not.toHaveAttribute('inert', '');
    expect(await a.evaluate(() => navigator.locks.query().then((q) => q.held?.length ?? 0))).toBe(1);
  });

  test('Play here with a dialog open: the focus goes back into the dialog, not the board behind it, and Tab stays inside', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    await a.locator('.icon-btn.gear').click();
    const settings = a.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    const b = await context.newPage();
    await open(b, '/');
    const here = cover(a).getByRole('button', { name: 'Play here' });
    await expect(here).toBeFocused();
    await a.keyboard.press('Enter');
    await expect(a.locator('.play-cover')).toHaveCount(0);
    await expect(settings).toBeVisible();
    await expect.poll(() => a.evaluate(() => !!document.activeElement?.closest('.modal[role="dialog"]'))).toBe(true);
    for (let k = 0; k < 3; k++) {
      await a.keyboard.press('Tab');
      expect(await a.evaluate(() => !!document.activeElement?.closest('.modal[role="dialog"]'))).toBe(true);
    }
  });

  test('two links opened in background tabs with two games under way: each opens only once it is looked at, and the game the one slot lets go is told there', async ({ context }) => {
    const today = localDateKey();
    // one tab: a game kept and another under way, then closed
    const first = await context.newPage();
    await open(first, `/#p=${EASY}`);
    await enter(first, 2);
    await first.evaluate((h) => (location.hash = '#p=' + h), HARD);
    await expect.poll(async () => (await saved(first)).puzzle).toBe(HARD);
    await enter(first, 2);
    await expect.poll(() => saved(first)).toMatchObject({ puzzle: HARD, entries: 2, aside: { puzzle: EASY, entries: 2 } });
    await first.close();
    // two links opened in background tabs, hidden from their first moment until looked at
    const background = async (path: string) => {
      const p = await context.newPage();
      await p.addInitScript(() => {
        if (sessionStorage.getItem('looked')) return;
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      });
      await p.goto(path);
      await expect(p.locator('svg.board')).toBeAttached();
      return p;
    };
    const look = async (p: Page) => {
      await p.evaluate(() => sessionStorage.setItem('looked', '1'));
      await shown(p, true);
    };
    // the first takes the play (no page held it), but opens nothing yet: nobody has seen it
    const b = await background(`/daily/${today}`);
    await b.waitForTimeout(800);
    expect(await saved(b)).toMatchObject({ puzzle: HARD, aside: { puzzle: EASY } });
    const c = await background('/#practice=x-wing');
    await c.waitForTimeout(800);
    expect(await saved(c)).toMatchObject({ puzzle: HARD, aside: { puzzle: EASY } });
    await mark(b);
    // the player looks at the second first: its practice opens, and its toast says which game went
    await look(c);
    await expect(c.locator('.practice-bar')).toBeVisible();
    await expect(c.locator('.toast')).toContainText('Only one game in progress is kept at a time: your Easy game is gone, your Hard game is kept');
    await expect.poll(() => saved(c)).toMatchObject({ aside: { puzzle: HARD, entries: 2 } });
    // then at the first: it takes the play back with no reload and opens its daily, told in its own toast
    await shown(c, false);
    await look(b);
    await expect.poll(async () => (await saved(b)).dailyKey).toBe(today);
    await expect(b.locator('.toast')).toContainText('Daily puzzle for');
    expect(await same(b)).toBe(true);
    expect(await saved(b)).toMatchObject({ aside: { puzzle: HARD, entries: 2 } });
  });

  test('a link opened in a background tab and never looked at, loaded again as Back and Forward load a page (as the browser restores a tab, or reopens a closed one): looked at, it opens its link, the game under way kept', async ({ context }) => {
    const a = await context.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    // the friend's link in a background tab, hidden from its first moment
    // until looked at: a view behind the first, which keeps its link
    const b = await context.newPage();
    await b.addInitScript(() => {
      if (sessionStorage.getItem('looked')) return;
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    });
    await b.goto(`/p/${HARD}`);
    await expect(b.locator('svg.board')).toBeAttached();
    // loaded again from the tab's history, as a restored tab is: a load of
    // the Back and Forward kind, its entry's history state as it was left
    await b.goto('/privacy/');
    await b.goBack();
    await expect(b.locator('svg.board')).toBeAttached();
    expect(await b.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type)).toBe('back_forward');
    expect(decodeURI(new URL(b.url()).pathname)).toBe(`/p/${HARD}`);
    // looked at: its link opens over the game under way, which is kept, as a link does
    await shown(a, false);
    await b.evaluate(() => sessionStorage.setItem('looked', '1'));
    await shown(b, true);
    await expect.poll(() => saved(b)).toMatchObject({ puzzle: HARD, aside: { puzzle: EASY, entries: 2 } });
    await expect(note(b)).toBeVisible();
    await expect.poll(() => decodeURI(new URL(b.url()).pathname)).toBe(`/p/${HARD}`);
  });

  test('the browser restores its last session, a link it opened in a background tab never looked at: the restored tab opens its link, the game under way kept', async ({ baseURL, launchOptions }, testInfo) => {
    const dir = testInfo.outputPath('profile');
    const launch = () =>
      chromium.launchPersistentContext(dir, {
        ...launchOptions,
        args: [...(launchOptions.args ?? []), '--restore-last-session'],
        viewport: { width: 1280, height: 800 },
        baseURL
      });
    let browser = await launch();
    await browser.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    const a = await browser.newPage();
    await open(a, `/#p=${EASY}`);
    await enter(a, 2);
    // the friend's link in a background tab, never looked at: a view behind the first, which keeps its link
    const b = await browser.newPage();
    await b.addInitScript(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    });
    await b.goto(`/p/${HARD}`);
    await expect(b.locator('svg.board')).toBeAttached();
    // the first tab closed, then the browser quit with the link's tab open
    await a.close();
    await browser.close();
    // started again with the session restored: the tab loads as Back and Forward load a page
    browser = await launch();
    try {
      const app = () => browser.pages().find((p) => p.url().startsWith(baseURL!));
      const any = await expect
        .poll(() => !!app(), { timeout: 5000 })
        .toBe(true)
        .then(
          () => true,
          () => false
        );
      // (the headless shell keeps no session to restore)
      test.skip(!any, 'this browser restores no session');
      const restored = app()!;
      await expect(restored.locator('svg.board')).toBeVisible();
      expect(await restored.evaluate(() => (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming).type)).toBe('back_forward');
      await expect.poll(() => saved(restored)).toMatchObject({ puzzle: HARD, aside: { puzzle: EASY, entries: 2 } });
      await expect(note(restored)).toBeVisible();
    } finally {
      await browser.close();
    }
  });

  test('a solved daily with Learn open, and the other tab fetches the day’s numbers, which have grown: switched back and forth, neither reloads, Learn stays open and the win screen stays away', async ({ context }) => {
    // the day's numbers as a live server gives them: the count grows as others send their times
    let count = 3;
    await context.route('**/api/**', (route) => {
      const url = route.request().url();
      const day = /\/api\/daily\/(\d+)\/stats/.exec(url);
      if (day) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ no: Number(day[1]), count: count++, median: 200, histogram: [[13, count - 3]] }) });
      return route.fulfill({ status: 204, body: '' });
    });
    const numbers = (p: Page) => p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('sudokui-daily-v1') ?? '{}').state?.stats ?? null));
    const a = await context.newPage();
    await open(a, '/#daily');
    const left = await a.evaluate(() => (JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells as { value: number }[]).filter((c) => !c.value).length);
    await enter(a, left);
    const won = a.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(won).toBeVisible();
    // the win screen put away, Learn open
    await a.keyboard.press('Escape');
    await expect(won).toHaveCount(0);
    await a.getByRole('button', { name: /Learn/ }).first().click();
    const learn = a.getByRole('dialog', { name: 'Learn' });
    await expect(learn).toBeVisible();
    await mark(a);
    await shown(a, false);
    // the other tab: the solved daily's win screen, which fetches the day's numbers
    const b = await context.newPage();
    const before = await numbers(a);
    await open(b, '/');
    await expect(b.getByRole('dialog', { name: 'Puzzle solved' })).toBeVisible();
    await expect.poll(() => numbers(b)).not.toBe(before);
    await mark(b);
    for (let k = 0; k < 2; k++) {
      await shown(b, false);
      await shown(a, true);
      await a.waitForTimeout(800);
      expect(await same(a)).toBe(true);
      await expect(learn).toBeVisible();
      await expect(won).toHaveCount(0);
      await expect(a.locator('.play-cover')).toHaveCount(0);
      await shown(a, false);
      await shown(b, true);
      await b.waitForTimeout(800);
      expect(await same(b)).toBe(true);
      await expect(b.getByRole('dialog', { name: 'Puzzle solved' })).toBeVisible();
    }
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
    // two windows side by side: the page that plays stays in view and
    // rests, and the view beside it, its clock and its cover up, waits
    const then = await settled(a);
    const before = await writesOf(a);
    await a.waitForTimeout(60_000);
    expect(await writesOf(a)).toBe(before);
    expect(await saves(a)).toEqual(then);
    expect(await a.evaluate(() => localStorage.getItem('sudokui-play'))).toBe(await b.evaluate(() => localStorage.getItem('sudokui-play')));
  });
});

test.describe('an opening that lands once the play has gone', () => {
  // (no service worker, so the day's list can be held back on its way)
  test.use({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
  test.beforeEach(async ({ context }) => {
    await watch(context);
  });

  test('the Daily button pressed, and the player switches to another tab before the day’s list comes: the daily opens nowhere, and back in the first tab its game goes on, with the clock and the pause the other tab left', async ({ context }) => {
    // the day's list slow to come, as a first fetch on a slow connection does
    let release = () => {};
    const held = new Promise<void>((done) => (release = done));
    let asked = false;
    await context.route(/\/assets\/dailies-[^/]*\.js$/, async (route) => {
      asked = true;
      await held;
      await route.continue();
    });
    const a = await context.newPage();
    await open(a, `/p/${HARD}`);
    await enter(a, 2);
    await a.locator('.menu-row button', { hasText: 'New' }).click();
    await a.getByRole('dialog', { name: 'New game' }).getByRole('button', { name: /Daily puzzle/ }).click();
    await expect.poll(() => asked).toBe(true);
    await mark(a);
    // another tab, before the list is in: it takes the play, and the game resumed there runs a while
    await shown(a, false);
    const b = await context.newPage();
    await open(b, '/');
    await b.getByRole('button', { name: 'Resume game' }).click();
    await b.waitForTimeout(2500);
    // the list reaches the first tab, a view now
    release();
    await a.waitForTimeout(800);
    await shown(b, false);
    const left = await saved(b);
    expect(left).toMatchObject({ puzzle: HARD, dailyKey: null, entries: 2, paused: true });
    expect(left.elapsed).toBeGreaterThan(2000);
    // back in the first tab: no reload (nobody played), the game under way on the board, not the daily
    await shown(a, true);
    await a.waitForTimeout(800);
    expect(await same(a)).toBe(true);
    await expect(a.locator('.pause-card')).toBeVisible();
    expect(await saved(a)).toMatchObject({ puzzle: HARD, dailyKey: null, entries: 2, paused: true, aside: null });
    const secs = await a.locator('.timer').evaluate((el) => {
      const [m, s] = (el.textContent ?? '0:0').split(':').map(Number);
      return m * 60 + s;
    });
    expect(secs).toBe(Math.floor(left.elapsed / 1000));
    expect(a.url()).toContain(HARD);
  });
});
