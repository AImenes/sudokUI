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
 * either way and a laptop; its words read at 4.5:1; the lights move once
 * and not at all under reduced motion; the shared picture stays light.
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
    await page.goto('/');
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
    await page.goto('/');
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

  test('a new player’s look on 1 January is the default, dark, after a December of Christmas', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-12-20') });
    await page.goto('/');
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

test.describe('the Christmas look, its words and its motion', () => {
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

  test('reads at 4.5:1 everywhere: the bar, the board’s controls, Settings, New and the pause card', async ({ page }) => {
    await page.addInitScript(welcomed);
    await page.clock.install({ time: noon('2026-12-10') });
    await page.goto('/');
    await expect.poll(() => theme(page).then((t) => t.shown)).toBe('christmas');
    await expect.poll(() => saved(page).then((s) => s.puzzle)).not.toBeNull();
    expect(await unreadable(page)).toEqual([]);
    await page.locator('button.gear').click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    expect(await unreadable(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await page.locator('.menu-row button', { hasText: 'New' }).click();
    await expect(page.getByRole('dialog', { name: 'New game' })).toBeVisible();
    expect(await unreadable(page)).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pause game' }).click();
    await expect(page.locator('.pause-card')).toBeVisible();
    expect(await unreadable(page)).toEqual([]);
  });

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
