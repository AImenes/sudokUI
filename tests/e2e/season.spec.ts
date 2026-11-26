/**
 * The season's rules in a real browser, the day set by Playwright's clock.
 *
 * The future-daily lock (src/content/dailies.ts, dailyLocked; src/ui/links.ts):
 * a daily whose day is after the player's local today opens nothing, not by
 * its address (a reload of it too), nor pasted into Import, and the toast
 * says when it opens; the game on the board stays as it was, with nothing
 * set aside; an earlier day's daily opens as before.
 *
 * The Christmas look (src/content/season.ts, src/state/settings.ts): offered
 * from 1 November to 31 December, in Settings and after Forest on the top
 * bar's button; on by itself from 1 December for a player who never picked
 * a theme, and kept off once switched off; gone on 1 January with the
 * theme from before back; a page left open across midnight follows. Its
 * decorations sit under no control on a 320 px phone, a 390 px phone held
 * either way and a laptop; the lights move once and not at all under
 * reduced motion; the shared picture stays light.
 *
 * The look is a winter night since 15 November 2026 (the owner: "a more
 * readable layout for christmas mode. I would like it darker"), and what
 * readable means is measured here from the colours the built app computes,
 * on a phone and a laptop: the board under way (givens and the player's
 * digits at 7:1 on every ground and far apart for every colour vision,
 * pencil marks and the conflict's red at 4.5:1, the conflict's bar, the
 * four grounds a step apart, the selection's border and the box lines at
 * 3:1, the thin lines quieter), Dark's hint colours, and every word at
 * 4.5:1 and every control's edge at 3:1 on the game, a hint, Settings, New,
 * the advent calendar with its open, solved, today's and locked doors,
 * Learn, Import, Share, Restart?, the pause card and the win screen.
 */
import { test, expect, Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Daily } from '../../src/content/dailies';
import { DARK, CSS_VARS } from '../../src/content/hintPalette';
import { contrast, de2000, seen, worstDE } from '../colourScience';

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
    await expect(toast(page, 'That daily opens on 20 November')).toBeVisible();
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

/** the stored theme (nothing stored yet: the default, dark) and what the page shows */
const theme = (page: Page) =>
  page.evaluate(() => ({
    shown: document.documentElement.dataset.theme,
    stored: JSON.parse(localStorage.getItem('sudokui-settings-v1') ?? '{}').state?.theme ?? 'dark'
  }));
/** a returning player's settings, as an earlier build (version 1) stored them */
const storedTheme = (t: string, version = 1) =>
  `localStorage.getItem('sudokui-settings-v1') || localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { theme: '${t}' }, version: ${version} }))`;
const openSettings = async (page: Page) => {
  await page.locator('button.gear').click();
  return page.getByRole('dialog', { name: 'Settings' }).getByRole('group', { name: 'Theme' });
};

test.describe('the Christmas look', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('is offered from 1 November, in Settings and after Forest on the top bar, and not before', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-10-31') });
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await theme(page)).toEqual({ shown: 'dark', stored: 'dark' });
    let themes = await openSettings(page);
    await expect(themes.getByRole('button')).toHaveText(['Dark', 'Daylight', 'Rosé', 'Forest', 'Match device']);
    await themes.getByRole('button', { name: 'Forest' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toHaveAttribute('title', 'Cycle theme: dark → daylight → rosé → forest');

    await page.clock.setFixedTime(noon('2026-11-01'));
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    // the player picked Forest: November leaves it be
    expect(await theme(page)).toEqual({ shown: 'forest', stored: 'forest' });
    const button = page.getByRole('button', { name: 'Switch to Christmas theme' });
    await expect(button).toHaveAttribute('title', 'Cycle theme: dark → daylight → rosé → forest → Christmas');
    await expect(button).toHaveText('🎄');
    await button.click();
    await expect.poll(() => theme(page)).toEqual({ shown: 'christmas', stored: 'christmas' });
    // the browser's bar wears the top bar's pine
    const bars = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.color = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')!.content;
      document.body.appendChild(probe);
      const meta = getComputedStyle(probe).color;
      probe.remove();
      return { meta, top: getComputedStyle(document.querySelector('.topbar')!).backgroundColor };
    });
    expect(bars).toEqual({ meta: 'rgb(23, 61, 46)', top: 'rgb(23, 61, 46)' });
    themes = await openSettings(page);
    await expect(themes.getByRole('button')).toHaveText(['Dark', 'Daylight', 'Rosé', 'Forest', 'Christmas', 'Match device']);
    await expect(themes.getByRole('button', { name: 'Christmas' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toContainText('Christmas can be chosen from 1 November to 31 December');
    await page.keyboard.press('Escape');
    // the top bar goes on to dark after it
    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect.poll(() => theme(page)).toEqual({ shown: 'dark', stored: 'dark' });
  });

  test('goes on by itself in December for a player who never picked a theme, and stays off once switched off', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-12-01') });
    // a game of its own, not a first visit's door: a door wears the Christmas look whatever the theme (advent.spec.ts)
    await page.goto(`/#p=${byDate('2026-11-12').puzzle}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => theme(page)).toEqual({ shown: 'christmas', stored: 'christmas' });
    const themes = await openSettings(page);
    await themes.getByRole('button', { name: 'Dark' }).click();
    await page.keyboard.press('Escape');
    await expect.poll(() => theme(page)).toEqual({ shown: 'dark', stored: 'dark' });
    await page.clock.setFixedTime(noon('2026-12-02'));
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await theme(page)).toEqual({ shown: 'dark', stored: 'dark' });
  });

  test('a returning player who chose a theme before the pick was kept keeps it in December', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.addInitScript(storedTheme('rose'));
    await page.clock.install({ time: noon('2026-12-05') });
    // a game of its own, not a first visit's door: a door wears the Christmas look whatever the theme (advent.spec.ts)
    await page.goto(`/#p=${byDate('2026-11-12').puzzle}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await theme(page)).toEqual({ shown: 'rose', stored: 'rose' });
  });

  test('a returning player on the default, dark, gets the look in December', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { theme: 'dark' }, version: 1 }));
      }
    });
    await page.clock.install({ time: noon('2026-12-05') });
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => theme(page)).toEqual({ shown: 'christmas', stored: 'christmas' });
  });

  test('a page left open follows across midnight into December', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: new Date('2026-11-30T23:59:30') });
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await theme(page)).toEqual({ shown: 'dark', stored: 'dark' });
    await page.clock.fastForward(60_000);
    await expect.poll(() => theme(page)).toEqual({ shown: 'christmas', stored: 'christmas' });
  });

  test('on 1 January a player on it gets their theme back, with the page open across midnight, and it is offered no more', async ({ page }) => {
    await page.addInitScript(welcomed);
    // chosen in November over Daylight (and never written over by this test's own reload)
    await page.addInitScript(() => {
      if (!localStorage.getItem('sudokui-settings-v1'))
        localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { theme: 'christmas', themePicked: true, themeBefore: 'light' }, version: 2 }));
    });
    await page.clock.install({ time: new Date('2026-12-31T23:59:30') });
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await theme(page)).toEqual({ shown: 'christmas', stored: 'christmas' });
    await page.clock.fastForward(60_000);
    await expect.poll(() => theme(page)).toEqual({ shown: 'light', stored: 'light' });
    const themes = await openSettings(page);
    await expect(themes.getByRole('button')).toHaveText(['Dark', 'Daylight', 'Rosé', 'Forest', 'Match device']);
    await page.keyboard.press('Escape');
    // a reload on 1 January: still Daylight
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await theme(page)).toEqual({ shown: 'light', stored: 'light' });
  });

  test('Settings open across midnight on 31 December with the focus on Christmas: the focus goes to the theme come back, inside the dialog', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.addInitScript(() => {
      if (!localStorage.getItem('sudokui-settings-v1'))
        localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { theme: 'christmas', themePicked: true, themeBefore: 'light', themeSeason: 2026 }, version: 2 }));
    });
    await page.clock.install({ time: new Date('2026-12-31T23:59:30') });
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    const themes = await openSettings(page);
    await themes.getByRole('button', { name: 'Christmas' }).focus();
    await expect(themes.getByRole('button', { name: 'Christmas' })).toBeFocused();
    await page.clock.fastForward(60_000);
    await expect.poll(() => theme(page)).toEqual({ shown: 'light', stored: 'light' });
    await expect(themes.getByRole('button', { name: 'Christmas' })).toHaveCount(0);
    await expect(themes.getByRole('button', { name: 'Daylight' })).toBeFocused();
  });

  test('a new player’s look on 1 January is the default, dark, after a December of Christmas', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-12-20') });
    // a game of its own, not a first visit's door: a door wears the Christmas look whatever the theme (advent.spec.ts)
    await page.goto(`/#p=${byDate('2026-11-12').puzzle}`);
    await expect.poll(() => theme(page)).toEqual({ shown: 'christmas', stored: 'christmas' });
    await page.clock.setFixedTime(noon('2027-01-01'));
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => theme(page)).toEqual({ shown: 'dark', stored: 'dark' });
  });

  test('keeps the shared picture of the board light, as every look does', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-12-03') });
    await page.goto(`/#p=${byDate('2026-11-12').puzzle}`);
    await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
    const picture = async () => {
      await page.locator('.menu-row button', { hasText: 'Share' }).click();
      const share = page.getByRole('dialog', { name: 'Share this puzzle' });
      const src = (await share.locator('.share-image-preview').getAttribute('src'))!;
      await page.keyboard.press('Escape');
      await expect(share).toHaveCount(0);
      return src;
    };
    const christmas = await picture();
    await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
    expect(await picture()).toBe(christmas);
  });
});

/** what of the season's decorations sits over a control or the board: the bar's lights under a button, the mark's snow over the name, a snowflake under the board, a button or a word */
const covered = (page: Page) =>
  page.evaluate(() => {
    const wrong: string[] = [];
    const bar = document.querySelector('.topbar')!.getBoundingClientRect();
    const lights = getComputedStyle(document.querySelector('.topbar')!, '::after');
    const strip = { top: bar.bottom - parseFloat(lights.bottom) - parseFloat(lights.height), bottom: bar.bottom - parseFloat(lights.bottom) };
    for (const el of document.querySelectorAll<HTMLElement>('.topbar button, .topbar .level-badge, .topbar .timer, .topbar .brand-mark')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.bottom > strip.top + 0.5) wrong.push(`the lights under ${el.className || el.tagName} (${r.bottom} > ${strip.top})`);
    }
    if (strip.top < bar.top) wrong.push('the lights above the bar');
    // the mark's snow: inside the bar, and above the letters
    const mark = document.querySelector('.topbar .brand-mark')!;
    const m = mark.getBoundingClientRect();
    const snow = getComputedStyle(mark, '::after');
    const snowTop = m.top + parseFloat(snow.top);
    const snowBottom = snowTop + parseFloat(snow.height);
    if (snowTop < bar.top) wrong.push('the snow above the bar');
    const letters = document.createRange();
    letters.selectNodeContents(mark);
    if (snowBottom > letters.getBoundingClientRect().top + 0.5) wrong.push(`the snow over the mark's letters (${snowBottom} > ${letters.getBoundingClientRect().top})`);
    // the snowflakes of a wide screen, where the stylesheet puts them
    const bg = getComputedStyle(document.body).backgroundImage;
    if (bg.includes('url(')) {
      const W = innerWidth;
      const H = innerHeight;
      const flakes = [
        { x: 0.03 * W, y: 130, s: 84 },
        { x: W - 0.035 * W - 56, y: 200, s: 56 },
        { x: 0.06 * W, y: H - 70 - 44, s: 44 }
      ];
      for (const el of document.querySelectorAll<Element>('svg.board, button, a, input, .layout p, .layout span, .layout h2, .layout h3')) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        for (const f of flakes) if (r.left < f.x + f.s && f.x < r.right && r.top < f.y + f.s && f.y < r.bottom) wrong.push(`a snowflake under ${el.tagName}.${el.getAttribute('class') ?? ''}`);
      }
    }
    if (document.documentElement.scrollWidth > innerWidth) wrong.push('the page scrolls sideways');
    return wrong;
  });

for (const [name, use] of [
  ['a 320 px phone', { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true }],
  ['a 390 px phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
  ['a phone on its side', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
  ['an iPad on its side', { viewport: { width: 1180, height: 820 }, hasTouch: true }],
  ['a 1200 px screen', { viewport: { width: 1200, height: 900 } }],
  ['the narrowest screen with snowflakes', { viewport: { width: 1240, height: 800 } }],
  ['a laptop', { viewport: { width: 1280, height: 800 } }],
  ['a wide screen', { viewport: { width: 1920, height: 1080 } }]
] as const) {
  test.describe(`the Christmas look on ${name}`, () => {
    test.use(use);

    test('decorates nothing a player needs: no light under a button, no snow over a word or the board', async ({ page }) => {
      await page.addInitScript(welcomed);
      await page.clock.install({ time: noon('2026-12-10') });
      await page.goto('/');
      await expect(page.locator('svg.board')).toBeVisible();
      await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
      // the first game is on the board (a new player's starts a moment after the page)
      await expect.poll(() => saved(page).then((s) => s.puzzle)).not.toBeNull();
      await expect.poll(() => covered(page)).toEqual([]);
      // paused, the holly sits beside its word, inside the board
      await page.getByRole('button', { name: 'Pause game' }).click();
      const card = page.locator('.pause-card');
      await expect(card).toBeVisible();
      const outside = () =>
        card.evaluate((el) => {
          const board = document.querySelector('svg.board')!.getBoundingClientRect();
          return [...el.querySelectorAll('h3, button, .pause-brand')]
            .filter((part) => {
              const r = part.getBoundingClientRect();
              return r.top < board.top - 0.5 || r.bottom > board.bottom + 0.5 || r.left < board.left - 0.5 || r.right > board.right + 0.5;
            })
            .map((part) => part.className || part.tagName);
        });
      await expect.poll(outside).toEqual([]);
      expect(await page.locator('.pause-card h3').evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toContain('data:image/svg+xml');
    });

    test('the six looks of the season fit Settings: every choice inside the dialog, its words a full line', async ({ page }) => {
      await page.addInitScript(welcomed);
      await page.clock.install({ time: noon('2026-12-02') });
      await page.goto('/');
      await expect(page.locator('svg.board')).toBeVisible();
      await page.getByRole('button', { name: 'Settings' }).first().click();
      const fit = () =>
        page.evaluate(() => {
          const modal = document.querySelector('.modal[role="dialog"]')!.getBoundingClientRect();
          const choices = [...document.querySelectorAll('.theme-choice button')].map((b) => b.getBoundingClientRect());
          const words = document.querySelector('.theme-row .setting-text')!.getBoundingClientRect();
          return {
            choices: choices.length,
            outside: choices.filter((r) => r.right > modal.right + 0.5 || r.left < modal.left - 0.5).length,
            wordsFill: words.width > modal.width * 0.75
          };
        });
      await expect.poll(fit).toEqual({ choices: 6, outside: 0, wordsFill: true });
    });
  });
}

/** a puzzle and its solution, for a game under way and a win */
const PUZZLE = '.63.1...5.......18....654...3.1..5..2.8...1.7..5..2.8...625....17.......9...8.73.';
const SOLUTION = '463819275597324618821765493639178524248593167715642389386257941174936852952481736';

/** select a cell of the board (a click at its centre; the board's margin is 4 of its 908 units) */
async function select(page: Page, cell: number) {
  const box = (await page.locator('svg.board').boundingBox())!;
  const m = (4 / 908) * box.width;
  const size = (box.width - 2 * m) / 9;
  await page.mouse.click(box.x + m + ((cell % 9) + 0.5) * size, box.y + m + (Math.floor(cell / 9) + 0.5) * size);
}

/**
 * a game under way: a few of the player's digits, corner and centre marks,
 * a conflict (a second 7 in row 8, beside the given one), and a cell
 * selected, r6c5, whose digit, a 4 of the player's, is on the board four
 * times and in two cells' marks
 */
async function playSome(page: Page) {
  const at = (r: number, c: number) => (r - 1) * 9 + (c - 1);
  for (const [r, c] of [[1, 1], [2, 1], [4, 1], [5, 5], [6, 5], [7, 1], [9, 4], [5, 2]]) {
    await select(page, at(r, c));
    await page.keyboard.press(`Digit${SOLUTION[at(r, c)]}`);
  }
  await select(page, at(8, 3));
  await page.keyboard.press('Digit7');
  const marks = async (r: number, c: number, digits: number[], mod: string) => {
    await select(page, at(r, c));
    for (const d of digits) await page.keyboard.press(`${mod}+Digit${d}`);
  };
  await marks(1, 6, [7, 9], 'Shift');
  await marks(2, 2, [2, 9], 'Shift');
  await marks(4, 8, [2, 4, 9], 'Shift');
  await marks(2, 5, [2, 3], 'Control');
  await marks(4, 9, [4, 9], 'Control');
  await marks(8, 5, [3, 9], 'Control');
  await select(page, at(6, 5));
}

/** rgb(a) as the page computes it, as #rrggbb */
const hexOf = (c: string) =>
  '#' +
  (c.match(/[\d.]+/g) ?? [])
    .slice(0, 3)
    .map((n) => Math.round(Number(n)).toString(16).padStart(2, '0'))
    .join('');
/** an rgb(a) layer at an opacity over a ground, as a browser composites it */
const overRgba = (c: string, opacity: number, under: string) => {
  const m = (c.match(/[\d.]+/g) ?? []).map(Number);
  const a = (m.length > 3 ? m[3] : 1) * opacity;
  const u = [1, 3, 5].map((k) => parseInt(under.slice(k, k + 2), 16));
  return '#' + [0, 1, 2].map((k) => Math.round(m[k] * a + u[k] * (1 - a)).toString(16).padStart(2, '0')).join('');
};

/** the board's own colours, from the computed fills and strokes of its SVG */
function boardColours() {
  const board = document.querySelector('svg.board')!;
  const css = (el: Element) => getComputedStyle(el);
  // the cell layers: the board's first 81 groups, each a cell's ground and the tints over it
  const cells = [...board.querySelectorAll(':scope > g')].slice(0, 81).map((g) =>
    [...g.querySelectorAll(':scope > rect')].map((r) => ({ fill: css(r).fill, stroke: css(r).stroke, opacity: Number(css(r).opacity), strokeWidth: parseFloat(css(r).strokeWidth) }))
  );
  const texts = [...board.querySelectorAll('text')].filter((t) => !t.closest('mask, defs'));
  const sizeOf = (t: Element) => parseFloat(t.getAttribute('font-size') ?? '0');
  const digits = texts.filter((t) => sizeOf(t) === 58).map((t) => ({ fill: css(t).fill, weight: Number(t.getAttribute('font-weight')), text: t.textContent }));
  const marks = texts
    .filter((t) => sizeOf(t) < 58)
    .flatMap((t) => {
      const own = [...t.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('');
      return [{ el: t as Element, text: own }, ...[...t.querySelectorAll('tspan')].map((el) => ({ el: el as Element, text: el.textContent ?? '' }))].filter((m) => m.text);
    })
    .map((m) => ({ fill: css(m.el).fill, weight: Number(css(m.el).fontWeight) }));
  const lines = [...board.querySelectorAll(':scope > line')].map((l) => ({ stroke: css(l).stroke, width: parseFloat(css(l).strokeWidth) }));
  const bars = [...board.querySelectorAll('.conflict-mark')].map((r) => ({ fill: css(r).fill, h: Number(r.getAttribute('height')) }));
  const frames = board.querySelectorAll('rect[fill="none"]').length;
  return { cells, digits, marks, lines, bars, frames, unit: board.getBoundingClientRect().width / 908 };
}

test.describe('the Christmas look, a winter night: its words, its controls and its board', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** every word in view whose contrast on what is under it is below WCAG AA (3:1 for large type) */
  const unreadable = (page: Page) =>
    page.evaluate(() => {
      const parse = (c: string) => {
        const m = (c.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
        return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
      };
      type C = ReturnType<typeof parse>;
      const lum = ({ r, g, b }: C) => {
        const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const mix = (fg: C, bg: C): C => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
      const under = (el: Element) => {
        const layers: C[] = [];
        for (let e: Element | null = el; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c.a > 0) layers.push(c);
          if (c.a >= 1) break;
        }
        return layers.reverse().reduce((bg, l) => mix(l, bg), { r: 255, g: 255, b: 255, a: 1 });
      };
      const bad: string[] = [];
      for (const el of document.querySelectorAll('body *')) {
        if (el.closest('svg, [aria-hidden="true"], :disabled')) continue;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim())) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        // text clipped to a gradient (the name's UI) has no colour of its own
        if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') continue;
        let op = 1;
        for (let e: Element | null = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
        if (op < 0.99) continue;
        const bg = under(el);
        const [a, b] = [lum(mix(parse(cs.color), bg)), lum(bg)].sort((x, y) => y - x);
        const ratio = (a + 0.05) / (b + 0.05);
        const size = parseFloat(cs.fontSize);
        const need = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700) ? 3 : 4.5;
        if (ratio < need) bad.push(`${el.textContent!.trim().slice(0, 30)}: ${ratio.toFixed(2)}`);
      }
      return bad;
    });

  /**
   * every control in view whose edge is under 3:1 on what it sits on: its
   * border where it has one, else its own fill. A control with neither (an
   * icon, a link, a choice inside a bordered group) is its glyph or its
   * word, and a dimmed one is the look's own dimmed state
   */
  const edgeless = (page: Page) =>
    page.evaluate(() => {
      const parse = (c: string) => {
        const m = (c.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
        return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 };
      };
      type C = ReturnType<typeof parse>;
      const lum = ({ r, g, b }: C) => {
        const f = (v: number) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
      };
      const ratio = (x: C, y: C) => {
        const [a, b] = [lum(x), lum(y)].sort((p, q) => q - p);
        return (a + 0.05) / (b + 0.05);
      };
      const mix = (fg: C, bg: C): C => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
      const under = (el: Element | null) => {
        const layers: C[] = [];
        for (let e = el; e; e = e.parentElement) {
          const c = parse(getComputedStyle(e).backgroundColor);
          if (c.a > 0) layers.push(c);
          if (c.a >= 1) break;
        }
        return layers.reverse().reduce((bg, l) => mix(l, bg), { r: 255, g: 255, b: 255, a: 1 });
      };
      const bad: string[] = [];
      let measured = 0;
      for (const el of document.querySelectorAll('button, input, textarea, select')) {
        if (el.closest('svg, :disabled, [inert]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.backgroundImage !== 'none') continue;
        let op = 1;
        for (let e: Element | null = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
        if (op < 0.99) continue;
        const outside = under(el.parentElement);
        const own = under(el);
        const border = parse(cs.borderTopColor);
        const edged = parseFloat(cs.borderTopWidth) >= 0.5 && cs.borderTopStyle !== 'none' && border.a > 0.01;
        const byBorder = edged ? ratio(mix(border, own), outside) : 1;
        const byFill = ratio(own, outside);
        // a wash under a word is no edge
        if (!edged && byFill < 1.5) continue;
        measured++;
        const best = Math.max(byBorder, byFill);
        if (best < 3) bad.push(`${(el.getAttribute('aria-label') ?? el.textContent ?? el.tagName).trim().slice(0, 30)}: ${best.toFixed(2)}`);
      }
      return { bad, measured };
    });

  /** the words and the controls' edges of what is in view: none under its floor */
  const readable = async (page: Page, what: string, controls = 1) => {
    expect(await unreadable(page), `${what}: words`).toEqual([]);
    const edges = await edgeless(page);
    expect(edges.bad, `${what}: controls' edges`).toEqual([]);
    expect(edges.measured, `${what}: controls measured`).toBeGreaterThanOrEqual(controls);
  };
  const close = async (page: Page) => {
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal[role="dialog"]')).toHaveCount(0);
  };
  const menu = (page: Page, name: string) => page.locator('.menu-row button', { hasText: name }).click();

  for (const [name, use] of [
    ['a phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],
    ['a laptop', { viewport: { width: 1280, height: 800 } }]
  ] as const) {
    test.describe(`on ${name}`, () => {
      test.use(use);

      test('reads at 4.5:1 everywhere, its controls edged at 3:1: the game, a hint, Settings, New, the advent calendar, Learn, Import, Share, Restart? and the pause card', async ({ page }) => {
        test.setTimeout(60_000);
        await page.addInitScript(welcomed);
        // door 3 solved on this device: the calendar shows a solved door among its open, today's and locked ones
        await page.addInitScript(() => {
          if (!localStorage.getItem('sudokui-daily-v1'))
            localStorage.setItem(
              'sudokui-daily-v1',
              JSON.stringify({ state: { tokens: {}, submitted: {}, pending: {}, stats: {}, played: { '302603': { date: '2026-12-03', level: 'Easy', score: 310, seconds: 412, assisted: false } } }, version: 1 })
            );
        });
        await page.clock.install({ time: noon('2026-12-10') });
        await page.goto(`/#p=${PUZZLE}`);
        await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
        await expect.poll(() => saved(page).then((s) => s.puzzle)).toBe(PUZZLE);
        await readable(page, 'the game', 20);

        await page.locator('button.gear').click();
        await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
        await readable(page, 'Settings', 3);
        await close(page);

        await menu(page, 'New');
        const fresh = page.getByRole('dialog', { name: 'New game' });
        await expect(fresh).toBeVisible();
        await readable(page, 'New', 3);
        await fresh.getByRole('button', { name: /Advent calendar/ }).click();
        const calendar = page.getByRole('dialog', { name: 'Advent calendar' });
        await expect(calendar).toBeVisible();
        const doors = () => calendar.locator('.advent-door').evaluateAll((all) => all.map((d) => d.className.replace('advent-door', '').trim() || 'open'));
        await expect.poll(async () => [...new Set(await doors())].sort()).toEqual(['locked', 'open', 'solved', 'today']);
        expect(await doors()).toHaveLength(24);
        await readable(page, 'the advent calendar', 24);
        await close(page);

        await menu(page, 'Learn');
        await expect(page.locator('.modal[role="dialog"]')).toBeVisible();
        await readable(page, 'Learn', 3);
        await page.locator('.hub-tabs button', { hasText: 'Theory' }).click();
        await expect(page.locator('.learn-tech').first()).toBeVisible();
        await readable(page, 'Learn, Theory', 5);
        await close(page);

        await menu(page, 'Import');
        const imp = page.getByRole('dialog', { name: 'Import a puzzle' });
        await imp.locator('textarea').fill('not a puzzle');
        await imp.getByRole('button', { name: 'Load puzzle' }).click();
        await readable(page, 'Import', 2);
        await close(page);

        await menu(page, 'Share');
        await expect(page.getByRole('dialog', { name: 'Share this puzzle' })).toBeVisible();
        await readable(page, 'Share', 2);
        await close(page);

        await menu(page, 'Restart');
        await expect(page.getByRole('dialog', { name: 'Restart puzzle?' })).toBeVisible();
        await readable(page, 'Restart?', 2);
        await close(page);

        // a hint showing, with its drawing on the board
        await page.keyboard.press('KeyH');
        // the first help of a game asks first
        const ask = page.getByRole('dialog', { name: 'Use Hint?' });
        await expect(ask).toBeVisible();
        await readable(page, 'Use Hint?', 1);
        await ask.getByRole('button', { name: 'Use Hint' }).click();
        const panel = page.locator('.hint-panel');
        await expect(panel).toBeVisible();
        await panel.scrollIntoViewIfNeeded();
        await readable(page, 'a hint', 3);
        await panel.getByRole('button', { name: 'Close' }).click();
        await expect(panel).toHaveCount(0);

        await page.getByRole('button', { name: 'Pause game' }).click();
        await expect(page.locator('.pause-card')).toBeVisible();
        await readable(page, 'the pause card', 1);
        // the stopped clock is dimmed and still a word
        const clock = await page.locator('.timer.paused').evaluate((el) => ({ opacity: Number(getComputedStyle(el).opacity), color: getComputedStyle(el).color, bar: getComputedStyle(document.querySelector('.topbar')!).backgroundColor }));
        const mixed = clock.color.match(/[\d.]+/g)!.map(Number).map((c, k) => Math.round(c * clock.opacity + clock.bar.match(/[\d.]+/g)!.map(Number)[k] * (1 - clock.opacity)));
        expect(contrast(hexOf(`rgb(${mixed.join(',')})`), hexOf(clock.bar))).toBeGreaterThanOrEqual(4.5);
      });

      test('the win screen reads at 4.5:1 under its cranberry ribbon, its confetti snow, gold and berries', async ({ page }) => {
        test.setTimeout(60_000);
        await page.addInitScript(welcomed);
        await page.clock.install({ time: noon('2026-12-10') });
        await page.goto(`/#p=${PUZZLE}`);
        await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
        await expect.poll(() => saved(page).then((s) => s.puzzle)).toBe(PUZZLE);
        for (let i = 0; i < 81; i++) {
          if (PUZZLE[i] !== '.') continue;
          await select(page, i);
          await page.keyboard.press(`Digit${SOLUTION[i]}`);
        }
        const won = page.getByRole('dialog', { name: 'Puzzle solved' });
        await expect(won).toBeVisible();
        await readable(page, 'the win screen', 2);
        const look = await won.evaluate((el) => {
          const cs = getComputedStyle(el);
          const bits = [...document.querySelectorAll('.confetti i')].slice(0, 12).map((i) => getComputedStyle(i).backgroundColor);
          return { ribbon: cs.backgroundImage, size: cs.backgroundSize, bits: [...new Set(bits)] };
        });
        // the ribbon: the buttons' cranberry, 5 px across the dialog's top
        expect(look.ribbon).toContain('linear-gradient(rgb(203, 58, 84), rgb(203, 58, 84))');
        expect(look.size).toContain('100% 5px');
        // the confetti, while it falls: snow, candle gold and berries, each plain on the night
        if (look.bits.length) {
          expect(look.bits.sort()).toEqual(['rgb(212, 69, 95)', 'rgb(230, 238, 234)', 'rgb(242, 199, 92)']);
          const panel = hexOf(await won.evaluate((el) => getComputedStyle(el).backgroundColor));
          for (const bit of look.bits) expect(contrast(hexOf(bit), panel), bit).toBeGreaterThanOrEqual(3);
        }
      });

      test('the board under way reads as designed: digits, marks, the conflict, the four grounds and the lines, from the colours the page computes', async ({ page }) => {
        await page.addInitScript(welcomed);
        await page.clock.install({ time: noon('2026-12-10') });
        await page.goto(`/#p=${PUZZLE}`);
        await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
        await expect.poll(() => saved(page).then((s) => s.puzzle)).toBe(PUZZLE);
        await playSome(page);
        // the selected cell, r6c5, holds a 4 of the player's: its row, column and box are peers, the other 4s same digits
        const SEL = 49;
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells?.[49]?.value ?? null)).toBe(4);
        const b = await page.evaluate(boardColours);
        const flat = (layers: { fill: string; opacity: number }[]) => layers.reduce((under, l) => overRgba(l.fill, l.opacity, under), '#000000');
        const isPeer = (i: number) => i !== SEL && (Math.floor(i / 9) === 5 || i % 9 === 4 || (Math.floor(i / 27) === 1 && Math.floor((i % 9) / 3) === 1));
        const grounds = b.cells.map(flat);
        const plain = grounds[b.cells.findIndex((c) => c.length === 1)];
        const peerAt = b.cells.findIndex((c, i) => isPeer(i) && c.length === 2);
        const sameAt = b.cells.findIndex((c, i) => !isPeer(i) && i !== SEL && c.length === 2);
        const [peer, same, selected] = [grounds[peerAt], grounds[sameAt], grounds[SEL]];
        // a repeated digit that is the selected cell's peer and its same digit wears both tints
        const both = flat([...b.cells[peerAt], b.cells[sameAt][1]]);
        const G = { plain, peer, 'same digit': same, selected, 'peer and same digit': both };
        const hex = hexOf;
        const danger = hex(b.bars[0].fill);
        const given = hex(b.digits.find((d) => d.weight === 700 && hex(d.fill) !== danger)!.fill);
        const entered = hex(b.digits.find((d) => d.weight === 500 && hex(d.fill) !== danger)!.fill);
        const cand = hex(b.marks.find((m) => m.weight < 700)!.fill);
        const lit = hex(b.marks.find((m) => m.weight >= 700)!.fill);
        const normal = (x: string, y: string) => de2000(seen(x, 'normal'), seen(y, 'normal'));
        for (const [where, ground] of Object.entries(G)) {
          expect(contrast(given, ground), `a given ${given} on the ${where} ground ${ground}`).toBeGreaterThanOrEqual(7);
          expect(contrast(entered, ground), `the player's ${entered} on the ${where} ground ${ground}`).toBeGreaterThanOrEqual(7);
          expect(contrast(cand, ground), `a pencil mark ${cand} on the ${where} ground ${ground}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(lit, ground), `a highlighted mark ${lit} on the ${where} ground ${ground}`).toBeGreaterThanOrEqual(4.5);
          expect(contrast(danger, ground), `the conflict ${danger} on the ${where} ground ${ground}`).toBeGreaterThanOrEqual(4.5);
        }
        // givens and the player's digits, told apart at a glance
        expect(normal(given, entered)).toBeGreaterThanOrEqual(25);
        expect(worstDE(given, entered).de).toBeGreaterThanOrEqual(15);
        expect(seen(given, 'normal')[0] - seen(entered, 'normal')[0]).toBeGreaterThanOrEqual(10);
        // highlighted candidates, apart from ordinary ones, bold and framed
        expect(worstDE(lit, cand).de).toBeGreaterThanOrEqual(15);
        expect(b.frames).toBeGreaterThan(0);
        // the conflict: the second 7 of row 8 in red, apart from both digits' colours for every colour vision, with its bar
        expect(b.digits.filter((d) => hex(d.fill) === danger).map((d) => d.text)).toEqual(['7']);
        expect(b.bars).toHaveLength(1);
        for (const bar of b.bars) expect(bar.h * b.unit, 'the bar, in CSS px').toBeGreaterThanOrEqual(1.5);
        expect(worstDE(danger, given).de).toBeGreaterThanOrEqual(15);
        expect(worstDE(danger, entered).de).toBeGreaterThanOrEqual(15);
        // the four grounds, each told from the next, the selection strongest, in a border of 3:1
        expect(normal(plain, peer), 'plain to peer').toBeGreaterThanOrEqual(6);
        expect(normal(peer, same), 'peer to same digit').toBeGreaterThanOrEqual(6);
        expect(normal(same, selected), 'same digit to selected').toBeGreaterThanOrEqual(6);
        expect(normal(peer, selected), 'peer to selected').toBeGreaterThanOrEqual(6);
        expect(normal(plain, selected)).toBeGreaterThan(Math.max(normal(plain, peer), normal(plain, same)));
        const sel = b.cells[SEL][1];
        const border = overRgba(sel.stroke, sel.opacity, plain);
        for (const ground of [plain, peer, same, selected]) expect(contrast(border, ground), `the selection's border ${border} on ${ground}`).toBeGreaterThanOrEqual(3);
        expect(sel.strokeWidth * b.unit, "the border's width, in CSS px").toBeGreaterThanOrEqual(1.5);
        // the grid: box lines at 3:1, the thin lines there and quieter
        const box = hex(b.lines.find((l) => l.width > 3)!.stroke);
        const thin = hex(b.lines.find((l) => l.width < 3)!.stroke);
        expect(contrast(box, plain)).toBeGreaterThanOrEqual(3);
        expect(contrast(thin, plain)).toBeGreaterThanOrEqual(1.5);
        expect(contrast(thin, plain)).toBeLessThan(contrast(box, plain) / 1.5);
        // nothing of the season is drawn over the board
        expect(await page.locator('svg.board').evaluate((el) => getComputedStyle(el, '::before').content + getComputedStyle(el, '::after').content)).toBe('nonenone');
      });

      test("draws a hint in Dark's colours, on a cell and a panel of its own", async ({ page }) => {
        await page.addInitScript(welcomed);
        await page.clock.install({ time: noon('2026-12-10') });
        await page.goto(`/#p=${PUZZLE}`);
        await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
        // as the stylesheet gives them (the build writes 0.5 as .5)
        const tokens = async (vars: string[]) =>
          (await page.evaluate((names) => names.map((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim()), vars)).map((v) => (/^[\d.]+$/.test(v) ? String(Number(v)) : v));
        const names = Object.values(CSS_VARS);
        const christmas = await tokens(names);
        expect(christmas).toEqual(Object.keys(CSS_VARS).map((k) => String(DARK[k as keyof typeof DARK])));
        const [cell, panel] = await tokens(['--cell-bg', '--panel']);
        await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
        expect(await tokens(names)).toEqual(christmas);
        // every mark's edge, the ring's digit and the arrows keep Dark's floors on the pine-black cell and panel
        for (const ink of [DARK.primaryInk, DARK.secondaryInk, DARK.finInk, DARK.placeInk, DARK.elim, DARK.false, DARK.purpleInk, DARK.orangeInk])
          for (const ground of [cell, panel]) expect(contrast(ink, ground), `${ink} on ${ground}`).toBeGreaterThanOrEqual(3);
        expect(contrast(DARK.inRing, cell)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(DARK.arrow, cell)).toBeGreaterThanOrEqual(12);
      });
    });
  }
});

test.describe('the Christmas look, its motion and its languages', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('turns its lights on once, and not at all under reduced motion', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-12-10') });
    await page.goto('/');
    await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
    const motion = () =>
      page.evaluate(() => {
        const s = getComputedStyle(document.querySelector('.topbar')!, '::after');
        return { name: s.animationName, count: s.animationIterationCount };
      });
    expect(await motion()).toEqual({ name: 'lights-on', count: '1' });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await motion()).toEqual({ name: 'none', count: '1' });
  });

  test('offers its choice in every language on a phone, the row wrapping rather than running past the dialog', async ({ page }) => {
    await page.clock.install({ time: noon('2026-11-12') });
    for (const [width, path, label] of [
      [320, '/', 'Christmas'],
      [390, '/nb/', 'Jul'],
      [320, '/es/', 'Navidad']
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(welcomed);
      await page.goto(path);
      await expect(page.locator('svg.board')).toBeVisible();
      await page.locator('button.gear').click();
      const row = page.locator('.modal .theme-choice');
      await expect(row.getByRole('button', { name: label, exact: true })).toBeVisible();
      const misfits = await row.evaluate((seg) => {
        const box = seg.parentElement!.getBoundingClientRect();
        return [...seg.querySelectorAll('button')]
          .filter((b) => {
            const r = b.getBoundingClientRect();
            return r.left < box.left - 0.5 || r.right > box.right + 0.5 || b.scrollWidth > b.clientWidth + 1;
          })
          .map((b) => b.textContent);
      });
      expect(misfits, `${width} ${path}`).toEqual([]);
      await page.keyboard.press('Escape');
    }
  });
});
