/**
 * The static pages (src/content/learnPages.ts, written into dist/ by
 * scripts/build-learn.ts) in a real browser, on a phone: every address in
 * the sitemap fits the screen at 320, 360 and 390 px with nothing to scroll
 * sideways (WCAG 1.4.10, Reflow), a worked example's legend wraps inside
 * its column, the rating page's tables scroll in boxes of their own (the
 * page never does), and the brand link and the language line carry the
 * names a screen reader announces.
 */
import { test, expect, Page } from '@playwright/test';

const WIDTHS = [320, 360, 390];

test.use({ viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });

/** what makes the page wider than the screen: the element that reaches furthest right */
const tooWide = (page: Page, width: number) =>
  page.evaluate((width) => {
    const de = document.documentElement;
    if (de.scrollWidth <= width) return null;
    let widest = '';
    let right = 0;
    for (const el of document.body.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect().right;
      if (r > right) {
        right = r;
        widest = `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''} "${(el.textContent ?? '').trim().slice(0, 40)}"`;
      }
    }
    return `${de.scrollWidth} px wide at ${width}, widest: ${widest}`;
  }, width);

test('every page in the sitemap fits a phone screen, with nothing to scroll sideways', async ({ page, request }) => {
  test.setTimeout(240_000);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  const urls = [...sitemap.matchAll(/<loc>https:\/\/sudokui\.app([^<]*)<\/loc>/g)].map((m) => m[1]);
  // the home pages and every static page in three languages
  expect(urls.length).toBeGreaterThan(250);
  const wide: string[] = [];
  for (const url of urls) {
    await page.setViewportSize({ width: WIDTHS[0], height: 740 });
    await page.goto(url);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 740 });
      const why = await tooWide(page, width);
      if (why) wide.push(`${url}: ${why}`);
    }
  }
  expect(wide).toEqual([]);
});

test('a worked example’s legend wraps inside its column, each swatch beside its words', async ({ page }) => {
  // the longest legends: an X-Wing's cover columns, a WXYZ-Wing's lettered cells in Norwegian
  for (const url of ['/learn/x-wing/', '/nb/learn/wxyz-wing/', '/es/learn/als-xz/']) {
    await page.goto(url);
    const misfits = await page.locator('figcaption').evaluate((cap) => {
      const box = cap.getBoundingClientRect();
      const wrong: string[] = [];
      const keys = [...cap.querySelectorAll<HTMLElement>('.key')];
      if (keys.length === 0) wrong.push('no legend');
      let wrapped = false;
      for (const key of keys) {
        const r = key.getBoundingClientRect();
        const text = (key.textContent ?? '').slice(0, 30);
        if (r.left < box.left - 0.5 || r.right > box.right + 0.5) wrong.push(`"${text}" leaves the column`);
        const lines = Math.round(r.height / parseFloat(getComputedStyle(key).lineHeight));
        if (lines > 1) wrapped = true;
        const swatch = key.querySelector('i')?.getBoundingClientRect();
        if (swatch && (swatch.top > r.top + 20 || swatch.left > r.left + 6)) wrong.push(`"${text}": its swatch is not beside its first word`);
      }
      if (!wrapped) wrong.push('no item needed a second line: the test lost its long legend');
      return wrong;
    });
    expect(misfits, url).toEqual([]);
  }
});

test('the rating page’s tables scroll in boxes of their own, each named by its heading', async ({ page }) => {
  for (const [url, bands, times] of [
    ['/sudoku-difficulty-rating/', 'The five levels and two picks', 'How fast is fast?'],
    ['/nb/sudoku-difficulty-rating/', 'De fem nivåene og to smalere valg', 'Hvor raskt er raskt?'],
    ['/es/sudoku-difficulty-rating/', 'Los cinco niveles y dos opciones más acotadas', '¿Qué se considera rápido?']
  ]) {
    await page.goto(url);
    expect(await tooWide(page, 320), url).toBeNull();
    for (const heading of [bands, times]) {
      const box = page.getByRole('region', { name: heading, exact: true });
      await expect(box, `${url} ${heading}`).toBeVisible();
      // nothing inside it takes the focus, so the box does: a keyboard can scroll it
      await expect(box, `${url} ${heading}`).toHaveAttribute('tabindex', '0');
    }
    // the six-column solve times are wider than a phone: their box scrolls, the page does not
    const solveTimes = page.getByRole('region', { name: times, exact: true });
    await expect(solveTimes.locator('th', { hasText: /World class|Verdensklasse|Clase mundial/ })).toBeAttached();
    expect(await solveTimes.evaluate((el) => el.scrollWidth > el.clientWidth), url).toBe(true);
    await solveTimes.evaluate((el) => (el.scrollLeft = el.scrollWidth));
    expect(await solveTimes.evaluate((el) => el.scrollLeft), url).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.scrollX), url).toBe(0);
  }
});

test('the brand link is named “sudokUI”, and the language line is a named list of links', async ({ page }) => {
  for (const [url, language, others] of [
    ['/learn/x-wing/', 'Language', ['Norsk', 'Español']],
    ['/nb/learn/', 'Språk', ['English', 'Español']],
    ['/es/sudoku-difficulty-rating/', 'Idioma', ['English', 'Norsk']]
  ] as const) {
    await page.goto(url);
    const header = page.locator('header.site');
    await expect(header.getByRole('link', { name: 'sudokUI', exact: true }), url).toBeVisible();
    expect(await header.ariaSnapshot(), url).not.toContain('UI sudokUI');
    // the anchor text a search engine reads, and the tile still showing UI
    const brand = header.locator('a.brand');
    await expect(brand).toHaveText('sudokUI');
    expect(await brand.locator('.mark').evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"UI"');
    const langs = page.getByRole('navigation', { name: language, exact: true });
    await expect(langs, url).toBeVisible();
    for (const name of others) await expect(langs.getByRole('link', { name }), `${url} ${name}`).toBeVisible();
  }
});
