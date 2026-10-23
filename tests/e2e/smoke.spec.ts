/**
 * The app in a real browser, on the production build: the things a player
 * meets in the first minute, at a laptop size and on a phone. Run with
 * `npm run test:e2e` after `npm run build`.
 */
import { test, expect, Page, Locator } from '@playwright/test';
import { parseGrid, gridToString, digitsOf, bit } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import { formatPencilGrid } from '../../src/content/textGrid';
import { readFileSync } from 'node:fs';
import { localDateKey } from '../../src/content/dailies';
import type { Daily } from '../../src/content/dailies';
import { TECHS, PRACTICE_TECHS } from '../../src/engine/ratings';
import { techNames as nbNames } from '../../src/content/locales/names.nb';
import { techNames as esNames } from '../../src/content/locales/names.es';

/** the published dailies, read as a file: Playwright's loader takes no JSON import without an attribute */
const dailies: Daily[] = JSON.parse(new TextDecoder().decode(readFileSync('src/content/dailies.json')));

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
/** a Hard puzzle (rated 1348 when written), for the links that name techniques */
const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';

async function open(page: Page, hash = `#p=${EASY}`) {
  await page.addInitScript(() => {
    localStorage.setItem('sudokui-welcomed', '1');
  });
  await page.goto(`/${hash}`);
  await expect(page.locator('svg.board')).toBeVisible();
}

const cellBox = async (page: Page, cell: number) => {
  const box = (await page.locator('svg.board').boundingBox())!;
  const size = box.width / 9;
  return { x: box.x + ((cell % 9) + 0.5) * size, y: box.y + (Math.floor(cell / 9) + 0.5) * size };
};

/** the languages, each with the longest technique name its practice bar can show */
const PRACTICE_LANGS = [
  { path: '/', names: {} },
  { path: '/nb/', names: nbNames },
  { path: '/es/', names: esNames }
].map(({ path, names }) => ({
  path,
  longest: PRACTICE_TECHS.map((t) => (names as Record<string, string>)[t] ?? TECHS[t].name).reduce((a, b) => (b.length > a.length ? b : a))
}));

/** a practice puzzle of X-Chain: its links are single cells, so the bar
 *  carries both buttons, Build it yourself and Next puzzle */
async function openPractice(page: Page, path = '/') {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await page.goto(`${path}#practice=X_CHAIN`);
  await expect(page.locator('.practice-bar button')).toHaveCount(2, { timeout: 15_000 });
}

/** what of the practice bar does not fit (empty when all of it does): the
 *  name or a button past the bar's padding, two of them overlapping, a
 *  clipped label, the bar past its column, the page scrolling sideways */
const practiceBarMisfits = (page: Page) =>
  page.locator('.practice-bar').evaluate((bar) => {
    const box = bar.getBoundingClientRect();
    const style = getComputedStyle(bar);
    const left = box.left + parseFloat(style.paddingLeft);
    const right = box.right - parseFloat(style.paddingRight);
    const column = bar.parentElement!.getBoundingClientRect();
    const misfits: string[] = [];
    if (box.left < column.left - 0.5 || box.right > column.right + 0.5) misfits.push('the bar leaves its column');
    if (document.documentElement.scrollWidth > window.innerWidth) misfits.push('the page scrolls sideways');
    const parts = [...bar.querySelectorAll<HTMLElement>('.practice-label, button')];
    const rects = parts.map((el) => el.getBoundingClientRect());
    const name = (i: number) => parts[i].innerText.replace(/\s+/g, ' ');
    rects.forEach((r, i) => {
      if (r.left < left - 0.5 || r.right > right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)
        misfits.push(`${name(i)} sticks out of the bar`);
      if (parts[i].scrollWidth > parts[i].clientWidth + 1) misfits.push(`${name(i)} is clipped`);
      rects.forEach((o, j) => {
        if (j > i && r.left < o.right - 0.5 && o.left < r.right - 0.5 && r.top < o.bottom - 0.5 && o.top < r.bottom - 0.5)
          misfits.push(`${name(i)} overlaps ${name(j)}`);
      });
    });
    return misfits;
  });

/** the bar as served, then with the language's longest technique name */
async function expectPracticeBarFits(page: Page, path: string, longest: string, widths: number[]) {
  for (const tech of [null, longest]) {
    if (tech) await page.locator('.practice-bar strong').evaluate((el, n) => (el.textContent = n), tech);
    for (const width of widths) {
      await page.setViewportSize({ width, height: page.viewportSize()!.height });
      expect(await practiceBarMisfits(page), `${path} at ${width} px${tech ? `, practising ${tech}` : ''}`).toEqual([]);
    }
  }
}

/** the keys and buttons of the control column (digits, modes, actions,
 *  the menu) that stick out of the column or whose label overflows its
 *  button, judged by their boxes: a key past the column's edge is cut
 *  off without the page ever scrolling sideways */
const controlMisfits = (page: Page) =>
  page.locator('.side').evaluate((side) => {
    const column = side.getBoundingClientRect();
    const misfits: string[] = [];
    for (const el of side.querySelectorAll<HTMLElement>('.num-btn, .mode-btn, .action-row button, .menu-row button')) {
      if (!el.getClientRects().length) continue; // not shown here
      const r = el.getBoundingClientRect();
      const name = el.innerText.replace(/\s+/g, ' ').trim();
      if (r.left < column.left - 0.5 || r.right > column.right + 0.5) misfits.push(`${name} sticks out of the column`);
      if (el.scrollWidth > el.clientWidth) misfits.push(`${name} overflows its button`);
    }
    return misfits;
  });

/** the control column at one size, in each language */
async function expectControlsFit(page: Page, width: number, height: number) {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await page.setViewportSize({ width, height });
  for (const path of ['/', '/nb/', '/es/']) {
    await page.goto(`${path}#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await controlMisfits(page), `${path} at ${width} x ${height}`).toEqual([]);
  }
}

test.describe('desktop, 1280 x 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('a repeated digit shows in red, a right one does not', async ({ page }) => {
    await open(page);
    // r1c1 is empty; the row already holds a 3 at r1c3
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Digit3');
    const value = page.locator('svg.board text', { hasText: /^3$/ }).first();
    await expect(page.locator('svg.board text[fill="var(--error-bg)"]')).toHaveCount(1);
    await page.keyboard.press('Digit4'); // the true digit
    await expect(page.locator('svg.board text[fill="var(--error-bg)"]')).toHaveCount(0);
    void value;
  });

  test('the mouse selects as before, and M turns multi-select on without a button', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const board = page.locator('svg.board');
    const drag = async (from: number, to: number, steps = 1) => {
      const a = await cellBox(page, from);
      const b = await cellBox(page, to);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps });
      await page.mouse.up();
    };
    // a drag along a row, sampled at its ends only: every cell between
    await drag(9, 17);
    await expect(status).toHaveText('9 cells selected.');
    // Shift-click adds a cell, and takes it out again
    const far = await cellBox(page, 80);
    await page.keyboard.down('Shift');
    await page.mouse.click(far.x, far.y);
    await expect(status).toHaveText('10 cells selected.');
    await page.mouse.click(far.x, far.y);
    await expect(status).toHaveText('9 cells selected.');
    await page.keyboard.up('Shift');
    // Alt + drag is a rectangle, r1c1 to r4c2: eight cells, a count the
    // nine of the row could not leave behind
    await page.keyboard.down('Alt');
    await drag(0, 28, 6);
    await page.keyboard.up('Alt');
    await expect(status).toHaveText('8 cells selected.');
    // the Multi button is for fingers; the key works for everyone
    await expect(page.locator('.mode-btn.multi')).toBeHidden();
    await expect(board).not.toHaveAttribute('data-multiselect', 'true');
    await page.keyboard.press('m');
    await expect(board).toHaveAttribute('data-multiselect', 'true');
    await expect(page.locator('.toast')).toContainText('Multi-select on');
    // a plain click now adds to the eight, and a second one takes out
    const mid = await cellBox(page, 40);
    await page.mouse.click(mid.x, mid.y);
    await expect(status).toHaveText('9 cells selected.');
    await page.mouse.click(mid.x, mid.y);
    await expect(status).toHaveText('8 cells selected.');
    // Escape leaves the mode and clears the selection
    await page.keyboard.press('Escape');
    await expect(status).toHaveText('No cell selected.');
    await expect(board).not.toHaveAttribute('data-multiselect', 'true');
  });

  test('B rings the cells with two candidates, once there are candidates to read', async ({ page }) => {
    await open(page);
    const rings = page.locator('svg.board g.bivalue');
    // no marks and no auto candidates: nothing to ring, though the setting is on
    await page.keyboard.press('b');
    await expect(rings).toHaveCount(0);
    await page.getByRole('button', { name: /Auto candidates/ }).first().click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    // every empty cell the engine leaves with exactly two candidates
    const g = parseGrid(EASY)!;
    const expected = Array.from({ length: 81 }, (_, i) => i).filter((i) => digitsOf(g.cands[i]).length === 2).length;
    expect(expected).toBeGreaterThan(0);
    await expect(rings).toHaveCount(expected);
    // each ring names its pair, smaller digit first, and wears one colour per half
    const pairsSeen = await rings.evaluateAll((els) =>
      els.map((el) => ({
        pair: el.getAttribute('data-pair'),
        strokes: [...el.querySelectorAll('path')].map((p) => p.getAttribute('stroke'))
      }))
    );
    for (const { pair, strokes } of pairsSeen) {
      expect(pair).toMatch(/^[1-9][1-9]$/);
      expect(pair![0] < pair![1]).toBe(true);
      expect(strokes).toEqual([`var(--tint-${pair![0]}, var(--cand))`, `var(--tint-${pair![1]}, var(--cand))`]);
    }
    // off again
    await page.keyboard.press('b');
    await expect(rings).toHaveCount(0);
  });

  test('with uniqueness off, hints, Steps and Scan find another way', async ({ page }) => {
    test.setTimeout(60_000);
    // the puzzle Cracking the Cryptic solved with two chains, declining the
    // unique rectangle the engine reaches for at the same point
    const UNIQ = '1...........6......6.935.....234..6.3....1..2.......84.5..6......1..2.9.8......71';
    await open(page, `#p=${UNIQ}`);
    // Steps, uniqueness on: the path takes a unique rectangle
    await page.getByRole('button', { name: /Steps/ }).first().click();
    await page.getByRole('button', { name: 'Use Steps' }).click();
    let path = page.getByRole('dialog', { name: 'Solution path' });
    const ur = path.locator('.path-row', { hasText: 'Unique Rectangle Type 3' });
    await expect(ur).toBeVisible({ timeout: 20_000 });
    // the board just before it: the hint is that rectangle
    await ur.click();
    await page.keyboard.press('KeyH');
    const panel = page.locator('.hint-panel');
    await expect(panel).toContainText('Unique Rectangle Type 3');
    await panel.getByRole('button', { name: 'Close' }).click();
    // and Scan lists it there
    const FAMILY = /Unique Rectangle|BUG\+1|Hidden Rectangle|Avoidable Rectangle|Extended Rectangle/;
    await page.getByRole('button', { name: /Scan/ }).first().click();
    let scan = page.getByRole('dialog', { name: "What's in this position?" });
    await expect(scan.locator('.path-row').first()).toBeVisible({ timeout: 20_000 });
    await expect(scan.locator('.path-row', { hasText: 'Unique Rectangle Type 3' })).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(scan).toHaveCount(0);
    // uniqueness off in Settings: the same position gives another technique
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const toggle = settings.getByRole('switch', { name: 'Use uniqueness in hints' });
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyH');
    await expect(panel).toContainText('Finned Swordfish');
    await expect(panel).not.toContainText('Unique Rectangle');
    await panel.getByRole('button', { name: 'Close' }).click();
    // Scan, at the same position, lists none of the family, and asked for the rectangle by name says why
    await page.getByRole('button', { name: /Scan/ }).first().click();
    scan = page.getByRole('dialog', { name: "What's in this position?" });
    await expect(scan.locator('.path-row').first()).toBeVisible({ timeout: 20_000 });
    await expect(scan.locator('.path-row', { hasText: 'Finned Swordfish' }).first()).toBeVisible();
    await expect(scan.locator('.path-row', { hasText: FAMILY })).toHaveCount(0);
    await scan.getByRole('searchbox', { name: 'Technique to look for' }).fill('Unique Rectangle Type 3');
    await expect(scan).toContainText('Unique Rectangle Type 3 is a uniqueness technique, and uniqueness is off in Settings.');
    await page.keyboard.press('Escape');
    await expect(scan).toHaveCount(0);
    // and Steps lists a path without any of the family
    await page.getByRole('button', { name: /Steps/ }).first().click();
    path = page.getByRole('dialog', { name: 'Solution path' });
    await expect(path.locator('.path-row').first()).toBeVisible({ timeout: 20_000 });
    await expect(path.locator('.path-row', { hasText: FAMILY })).toHaveCount(0);
    // a row past the point where the two paths part (step 22, a Finned
    // Swordfish where the engine's path takes the rectangle) sets the board
    // to the path without uniqueness: the hint there is that row's step,
    // where the engine's own path would have left a Hidden Single
    const row = path.locator('.path-row', { has: page.locator('.path-jump', { hasText: /^23$/ }) });
    await expect(row).toContainText('Finned Jellyfish');
    await row.click();
    await page.keyboard.press('KeyH');
    await expect(panel).toContainText('Finned Jellyfish');
  });

  test('a digit pressed with nothing selected is armed, and a tap enters it', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Escape');
    const fours = page.locator('svg.board text', { hasText: /^4$/ });
    const before = await fours.count();
    await page.keyboard.press('Digit4');
    await expect(page.locator('.num-btn.armed')).toHaveText('4');
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await expect(fours).toHaveCount(before + 1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.num-btn.armed')).toHaveCount(0);
  });

  test('the hint panel and its buttons are on screen, and H walks the hint', async ({ page }) => {
    await open(page);
    await page.keyboard.press('KeyH');
    // the first assist asks; answer with the button
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await expect(page.locator('.hint-panel')).toBeVisible();
    const show = page.getByRole('button', { name: 'Show me' });
    await expect(show).toBeInViewport();
    await page.keyboard.press('KeyH');
    const apply = page.getByRole('button', { name: 'Apply step' });
    await expect(apply).toBeInViewport();
  });

  test('a wrong digit followed by a hint names the digit, not the marks', async ({ page }) => {
    await open(page);
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Digit7');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Hint/ }).first().click();
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'A placed digit is wrong' })).toBeVisible();
  });

  test('the practice bar keeps its buttons inside it, in the 300 px column, in every language', async ({ page }) => {
    for (const { path, longest } of PRACTICE_LANGS) {
      await openPractice(page, path);
      await expectPracticeBarFits(page, path, longest, [1280, 1024]);
    }
  });
});

test.describe('why not', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('Check says why a wrong digit is wrong, and can show it', async ({ page }) => {
    await open(page);
    // r1c1 is 4; a 3 already sits in r1c3
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Digit3');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /Check/ }).first().click();
    await page.getByRole('button', { name: 'Use Check' }).click();
    const panel = page.getByRole('region', { name: 'Mistakes found' });
    await expect(panel).toBeVisible();
    await expect(panel.locator('.proof-list li')).toHaveText(/r1c1 cannot be 3: r1c3 already holds it/);
    await panel.getByRole('button', { name: 'Show me' }).click();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'already holds it' })).toBeVisible();
  });
});

test.describe('reachable by keyboard and screen reader', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the board takes focus, and the selected cell is read out', async ({ page }) => {
    await open(page);
    const board = page.locator('svg.board');
    await expect(board).toHaveAttribute('tabindex', '0');
    await expect(board).toHaveAttribute('aria-label', /Sudoku board/);
    await board.focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('#board-status')).toHaveText('No cell selected.');
    await page.keyboard.press('ArrowRight'); // from the centre: r5c6
    await expect(page.locator('#board-status')).toContainText('Row 5, column 6');
    const c = await cellBox(page, 2); // r1c3 holds a given 3
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#board-status')).toHaveText('Row 1, column 3: 3, given.');
  });

  test('Tab stays inside an open dialog', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /New/ }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'));
      expect(inside, `Tab ${i + 1} left the dialog`).toBe(true);
    }
    await page.keyboard.press('Shift+Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[role=dialog]'))).toBe(true);
  });
});

test.describe('the guide', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('loads on demand from a deep link, open at the technique', async ({ page }) => {
    await open(page, '#learn=X_WING');
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog.locator('#learn-X_WING')).toBeVisible();
    await expect(dialog.locator('#learn-X_WING')).toHaveAttribute('open', '');
  });
});

test.describe('the chain trainer', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a tapped bivalue pair is a strong link, Backspace takes it off, Escape leaves', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Chain/ }).first().click();
    await page.getByRole('button', { name: 'Use Chain' }).click();
    const panel = page.getByRole('region', { name: 'Build a chain' });
    await expect(panel).toBeVisible();
    // r1c1 holds only 4 and 5; candidate glyphs sit at fixed spots in the cell
    const box = (await page.locator('svg.board').boundingBox())!;
    const k = box.width / (9 * 100 + 8);
    const tap = async (cell: number, d: number) => {
      const x = box.x + (4 + (cell % 9) * 100 + 22 + ((d - 1) % 3) * 28) * k;
      const y = box.y + (4 + Math.floor(cell / 9) * 100 + 23 + Math.floor((d - 1) / 3) * 28) * k;
      await page.mouse.click(x, y);
    };
    await tap(0, 4);
    await expect(panel).toContainText('starts the chain');
    await tap(0, 5);
    await expect(panel).toContainText('Strong link');
    await expect(panel).toContainText('holds only 4 and 5');
    expect(await page.locator('svg.board .chain-arrows g path').count()).toBe(2);
    await page.keyboard.press('Backspace');
    await expect(panel).toContainText('1 candidate');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });
});

test.describe('scanning a photo', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  /** a printed-looking puzzle, screenshotted as the "photo" */
  async function photo(page: Page, transform: string, font = 'Georgia, "Times New Roman", serif', light = '#f4f1ea') {
    const rows = Array.from({ length: 9 }, (_, r) =>
      `<tr>${Array.from({ length: 9 }, (_, c) => `<td>${EASY[r * 9 + c] === '.' ? '' : EASY[r * 9 + c]}</td>`).join('')}</tr>`
    ).join('');
    await page.setContent(`<html><body style="margin:0;background:#f4f1ea">
      <div id="shot" style="width:720px;height:720px;display:flex;align-items:center;justify-content:center;background:${light}">
        <table style="border-collapse:collapse;transform:${transform};background:#fbfaf6">${rows}</table>
      </div>
      <style>
        td { width:52px; height:52px; text-align:center; vertical-align:middle; font: 36px ${font}; color:#111; border:1px solid #333; }
        td:nth-child(3n) { border-right: 3px solid #111; } td:first-child { border-left: 3px solid #111; }
        tr:nth-child(3n) td { border-bottom: 3px solid #111; } tr:first-child td { border-top: 3px solid #111; }
      </style></body></html>`);
    return page.locator('#shot').screenshot({ type: 'png' });
  }

  for (const [name, transform, font, light] of [
    ['upright', 'none', undefined, undefined],
    ['turned a quarter', 'rotate(90deg)', undefined, undefined],
    ['mirrored', 'scaleX(-1)', undefined, undefined],
    ['from an angle', 'perspective(900px) rotateY(22deg) rotateX(12deg) rotate(4deg)', undefined, undefined],
    ['in a sans-serif face under uneven light', 'rotate(-6deg)', 'Arial, Helvetica, sans-serif', 'linear-gradient(135deg, #ffffff, #b9b4a8)']
  ] as const) {
    test(`reads a printed puzzle ${name}`, async ({ page }) => {
      const shot = await photo(page, transform, font, light);
      await open(page);
      await page.getByRole('button', { name: /Import/ }).first().click();
      await expect(page.getByRole('dialog', { name: 'Import a puzzle' })).toBeVisible();
      await page.locator('input[type=file]').setInputFiles({ name: 'puzzle.png', mimeType: 'image/png', buffer: shot });
      const panel = page.getByRole('region').filter({ hasText: 'Custom puzzle' });
      await expect(page.locator('.scan-check')).toBeVisible({ timeout: 20_000 });
      const givens = EASY.replace(/\./g, '').length;
      await expect(page.locator('.hint-panel').filter({ hasText: 'Custom puzzle' })).toContainText(`(${givens} so far)`);
      // every digit must be right, or the validator (unique solution) refuses the puzzle
      await page.getByRole('button', { name: /Check & play/ }).click();
      await expect(page.locator('.dialog-error')).toHaveCount(0);
      await expect(page.locator('.scan-check')).toHaveCount(0);
      await expect(page.locator('.level-badge').first()).toBeVisible();
      void panel;
    });
  }
});

test.describe('scanning from New game', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('the New game dialog offers the scan too', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /New/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New game' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Or scan a photo of one')).toBeVisible();
    await expect(dialog.locator('input[type=file]')).toHaveCount(1);
  });
});

test.describe('the position scan', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('lists techniques with the score beside the name, not over it', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: /Scan/ }).first().click();
    await page.getByRole('button', { name: 'Use Scan' }).click();
    const dialog = page.getByRole('dialog', { name: "What's in this position?" });
    const row = dialog.locator('.path-row').first();
    await expect(row).toBeVisible({ timeout: 20000 });
    const jump = (await row.locator('.path-jump').boundingBox())!;
    const label = (await row.locator('.path-label').boundingBox())!;
    expect(jump.x + jump.width).toBeLessThanOrEqual(label.x + 1);
  });

  test('the assist buttons stack their icon above the word', async ({ page }) => {
    await open(page);
    const icon = (await page.locator('.assist-zone .btn-icon').first().boundingBox())!;
    const word = (await page.locator('.assist-zone .btn-icon + span').first().boundingBox())!;
    expect(icon.y + icon.height).toBeLessThanOrEqual(word.y + 1);
  });
});

test.describe('your path', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('opens from the top bar, names the next technique, and starts its practice', async ({ page }) => {
    await open(page);
    await page.locator('.menu-row button', { hasText: 'Learn' }).click();
    await page.getByRole('tab', { name: /Your path/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Learn' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.path-summary')).toContainText(/0 of \d+ learned · next: Naked Single/);
    await expect(dialog.locator('.path-row.path-next')).toContainText('Naked Single');
    await dialog.locator('.path-summary .path-go').click();
    await expect(page.locator('.practice-bar')).toContainText('Naked Single', { timeout: 15_000 });
  });
});

test.describe('the walk', () => {
  test.use({ viewport: { width: 1280, height: 1000 } });

  test('reveals a chain one link at a time, by arrow keys, with a sentence each', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
    });
    // a practice technique served from stored puzzles, so it starts at once
    await page.goto('/#practice=SIMPLE_COLORS');
    await expect(page.locator('svg.board')).toBeVisible();
    // the practice puzzle arrives from the worker; the bar appears with it
    await expect(page.locator('.practice-bar')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Hint/ }).first().click();
    const use = page.getByRole('button', { name: 'Use Hint' });
    if (await use.count()) await use.click();
    await page.getByRole('button', { name: 'Show me' }).click();
    const all = await page.locator('svg.board .chain-arrows path').count();
    await page.getByRole('button', { name: 'Walk through it' }).click();
    await expect(page.locator('.hint-walk-count')).toContainText('1 of');
    const first = await page.locator('.hint-walk-text').innerText();
    expect(first.length).toBeGreaterThan(10);
    const shown = await page.locator('svg.board .chain-arrows path').count();
    expect(shown).toBeLessThan(all);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.hint-walk-count')).toContainText('2 of');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.hint-walk-count')).toContainText('1 of');
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page.locator('.hint-walk-count')).toHaveCount(0);
    expect(await page.locator('svg.board .chain-arrows path').count()).toBe(all);
  });
});

test.describe('phone, 390 x 844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('fits without horizontal scroll, with 44 px keys', async ({ page }) => {
    await open(page);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(wide).toBe(false);
    const key = (await page.locator('.num-btn').first().boundingBox())!;
    expect(key.height).toBeGreaterThanOrEqual(44);
    const mode = (await page.locator('.mode-btn').first().boundingBox())!;
    expect(mode.height).toBeGreaterThanOrEqual(40);
  });

  test('the header fits, and Learn holds the path, practice and theory', async ({ page }) => {
    await open(page);
    await expect(page.locator('.score-btn')).toBeVisible();
    const fits = await page.locator('.topbar').evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fits).toBe(true);
    const score = (await page.locator('.score-btn').boundingBox())!;
    const timer = (await page.locator('.timer').boundingBox())!;
    expect(score.x + score.width).toBeLessThanOrEqual(timer.x);
    await page.locator('.menu-row button', { hasText: 'Learn' }).click();
    const dialog = page.getByRole('dialog', { name: 'Learn' });
    const selected = (name: RegExp) => expect(dialog.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
    // it lands on the path: what to learn next
    await selected(/Your path/);
    await expect(dialog).toContainText('worth learning');
    await dialog.getByRole('tab', { name: /Practice/ }).click();
    await selected(/Practice/);
    await expect(dialog).toContainText('Pick a technique');
    await dialog.getByRole('tab', { name: /Theory/ }).click();
    await selected(/Theory/);
    await expect(dialog.getByRole('tab', { name: 'Glossary' })).toBeVisible();
    await dialog.getByRole('tab', { name: /Your path/ }).click();
    await selected(/Your path/);
    // the ladder's rows on a phone: the status sits inside its row, and
    // the rows do not overlap
    const rows = dialog.locator('.path-section .path-row');
    for (let i = 0; i < 4; i++) {
      const row = (await rows.nth(i).boundingBox())!;
      const play = (await rows.nth(i).locator('.path-play').boundingBox())!;
      expect(play.y + play.height).toBeLessThanOrEqual(row.y + row.height + 1);
      if (i) {
        const prev = (await rows.nth(i - 1).boundingBox())!;
        expect(row.y).toBeGreaterThanOrEqual(prev.y + prev.height - 1);
      }
    }
  });

  test('a held number key enters a corner mark, a tapped one the digit', async ({ page }) => {
    await open(page);
    const c = await cellBox(page, 40);
    await page.touchscreen.tap(c.x, c.y);
    await expect(page.locator('#board-status')).toContainText('Row 5, column 5: empty');
    const key = (await page.locator('.num-btn', { hasText: '4' }).boundingBox())!;
    const at = { x: key.x + key.width / 2, y: key.y + key.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await expect(page.locator('.num-btn.held-corner')).toHaveText('4');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toContainText('corner marks 4');
    await expect(page.locator('.num-btn.held-corner')).toHaveCount(0);
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.locator('#board-status')).toContainText('Row 5, column 5: 4');
  });

  test('a swipe over the board scrolls the page, a tap still selects', async ({ page }) => {
    await open(page);
    const scrolled = () =>
      page.evaluate(() => Math.max(window.scrollY, ...[...document.querySelectorAll('*')].map((el) => el.scrollTop)));
    expect(await scrolled()).toBe(0);
    const { x, y } = await cellBox(page, 40);
    const cdp = await page.context().newCDPSession(page);
    // the page is at its top, so a finger pulling straight down from the
    // top row has nowhere to scroll to: it is selecting a column, at once,
    // with no rest first, r1c5 to r5c5
    const top = await cellBox(page, 4);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: top.x, y: top.y }] });
    for (const part of [0.5, 1]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: top.x, y: top.y + (y - top.y) * part }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toHaveText('5 cells selected.');
    expect(await scrolled()).toBe(0);
    await page.keyboard.press('Escape');
    await expect(page.locator('#board-status')).toHaveText('No cell selected.');
    // a finger swiping up over the middle of the board
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 20 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(scrolled).toBeGreaterThan(20);
    await expect(page.locator('#board-status')).toHaveText('No cell selected.');
    // a tap is still a tap
    const tap = await cellBox(page, 40);
    await page.touchscreen.tap(tap.x, tap.y);
    await expect(page.locator('#board-status')).toContainText('Row 5, column 5');
    // a quick sideways flick is a drag-select: the cells it crossed, the
    // ones between its samples too
    const from = await cellBox(page, 54);
    const to = await cellBox(page, 58);
    // (each dispatched move is a round trip, so a flick is two of them)
    const sideways = async (steps: number) => {
      for (let i = 1; i <= steps; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + ((to.x - from.x) * i) / steps, y: from.y }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    await sideways(2);
    await expect(page.locator('#board-status')).toHaveText('5 cells selected.');
    // a steep flick is a scroll in the making, not a selection: the cell
    // lit by the landing goes back to what was selected before it
    await page.touchscreen.tap(tap.x, tap.y);
    await expect(page.locator('#board-status')).toContainText('Row 5, column 5');
    const steep = await cellBox(page, 22);
    // (landing and move back to back: a round trip between them could
    // outlast the board's 100 ms rest)
    await Promise.all([
      cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: steep.x, y: steep.y }] }),
      cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: steep.x + 12, y: steep.y + 30 }] })
    ]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toContainText('Row 5, column 5');
    // a finger that rests first, then drags sideways: a run of cells
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    await page.waitForTimeout(300);
    await sideways(8);
    await expect(page.locator('#board-status')).toHaveText('5 cells selected.');
    // and one that rests, then drags downwards: a column of cells, and
    // the page stays put (it is scrolled now, so without the rest the
    // drag would scroll it back up)
    const before = await scrolled();
    expect(before).toBeGreaterThan(0);
    const top2 = await cellBox(page, 4);
    const bottom = await cellBox(page, 40);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: top2.x, y: top2.y }] });
    await page.waitForTimeout(400);
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: top2.x, y: top2.y + ((bottom.y - top2.y) * i) / 8 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toHaveText('5 cells selected.');
    expect(await scrolled()).toBe(before);
    // two fingers are a pinch: the browser's zoom, and the selection is
    // exactly what it was, the first finger's landing put back
    const p1 = await cellBox(page, 31);
    const p2 = await cellBox(page, 49);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: p1.x, y: p1.y, id: 1 },
        { x: p2.x, y: p2.y, id: 2 }
      ]
    });
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: p1.x, y: p1.y - 40, id: 1 },
        { x: p2.x, y: p2.y + 40, id: 2 }
      ]
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toHaveText('5 cells selected.');
  });

  test('the practice bar keeps its buttons inside it, down to 320 px, in every language', async ({ page }) => {
    for (const { path, longest } of PRACTICE_LANGS) {
      await page.setViewportSize({ width: 390, height: 844 });
      await openPractice(page, path);
      await expectPracticeBarFits(page, path, longest, [390, 375, 360, 320]);
    }
  });

  test('on a 320 px phone the nine keys and every button fit the column, in every language', async ({ page }) => {
    await expectControlsFit(page, 320, 640);
    // narrower than wide, and still 44 px tall
    const key = (await page.locator('.num-btn').first().boundingBox())!;
    expect(key.width).toBeLessThan(34);
    expect(key.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('phone, 390 x 844, multi-select', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Multi: a drag selects at once in any direction, a tap adds or removes, the page stays put', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const board = page.locator('svg.board');
    const multi = page.locator('.mode-btn.multi');
    const scrolled = () =>
      page.evaluate(() => Math.max(window.scrollY, ...[...document.querySelectorAll('*')].map((el) => el.scrollTop)));
    const cdp = await page.context().newCDPSession(page);
    // a finger that lands and goes straight on, with no rest: two samples.
    // The landing and the first move go out back to back: a round trip
    // between them could outlast the board's 100 ms rest and commit a drag
    const flick = async (fromCell: number, toCell: number) => {
      const from = await cellBox(page, fromCell);
      const to = await cellBox(page, toCell);
      const at = (part: number) => ({ x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part });
      await Promise.all([
        cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at(0)] }),
        cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(0.5)] })
      ]);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at(1)] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // the button is there for a finger, off, and the board scrolls the page
    await expect(multi).toBeVisible();
    await expect(multi).toHaveAttribute('aria-pressed', 'false');
    await expect(board).toHaveCSS('touch-action', 'pan-y pinch-zoom');
    await multi.tap();
    await expect(multi).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.toast')).toContainText('Multi-select on');
    await expect(board).toHaveAttribute('data-multiselect', 'true');
    // no finger pans from the board, a pinch still zooms: the tablet's rule
    await expect(board).toHaveCSS('touch-action', 'pinch-zoom');
    // straight down the third column, r1c3 to r9c3, with no rest: nine
    // cells, and the page has not moved
    await flick(2, 74);
    await expect(status).toHaveText('9 cells selected.');
    expect(await scrolled()).toBe(0);
    // a tap adds a cell, a second tap on it takes it out
    const mid = await cellBox(page, 40);
    await page.touchscreen.tap(mid.x, mid.y);
    await expect(status).toHaveText('10 cells selected.');
    await page.touchscreen.tap(mid.x, mid.y);
    await expect(status).toHaveText('9 cells selected.');
    // a drag from a selected cell paints cells out: r1c3 to r4c3 leaves
    // the five below
    await flick(2, 29);
    await expect(status).toHaveText('5 cells selected.');
    // Escape turns the mode off and clears the selection
    await page.keyboard.press('Escape');
    await expect(status).toHaveText('No cell selected.');
    await expect(multi).toHaveAttribute('aria-pressed', 'false');
    await expect(board).toHaveCSS('touch-action', 'pan-y pinch-zoom');
    // and the swipe is the page's again
    await flick(40, 4);
    await expect.poll(scrolled).toBeGreaterThan(20);
    await expect(status).toHaveText('No cell selected.');
  });
});

test.describe('phone on its side, 844 x 390', () => {
  test.use({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  test('keeps the keypad beside the board', async ({ page }) => {
    await open(page);
    const board = (await page.locator('svg.board').boundingBox())!;
    const key = (await page.locator('.num-btn').first().boundingBox())!;
    expect(key.x).toBeGreaterThan(board.x + board.width - 1);
    await expect(page.locator('.num-btn').first()).toBeInViewport();
  });

  test('a 320 px phone on its side: every key and button fits the column beside the board, in every language', async ({ page }) => {
    await expectControlsFit(page, 568, 320);
  });
});

test.describe('tablet, 820 x 1180', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

  test('a drag over the board selects at once in any direction, and the page scrolls from beside it', async ({ page }) => {
    await open(page);
    const scrolled = () =>
      page.evaluate(() => Math.max(window.scrollY, ...[...document.querySelectorAll('*')].map((el) => el.scrollTop)));
    const status = page.locator('#board-status');
    const cdp = await page.context().newCDPSession(page);
    // a finger that lands and goes straight on, with no rest: two samples
    const flick = async (fromCell: number, toCell: number) => {
      const from = await cellBox(page, fromCell);
      const to = await cellBox(page, toCell);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
      for (const part of [0.5, 1]) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: from.x + (to.x - from.x) * part, y: from.y + (to.y - from.y) * part }]
        });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    // the page is longer than the screen, and the board still keeps the
    // swipe: straight down is a column, r1c5 to r5c5
    expect(await page.locator('.layout').evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    await flick(4, 40);
    await expect(status).toHaveText('5 cells selected.');
    // straight up, which on a phone scrolls the page down: r9c5 to r7c5
    await flick(76, 58);
    await expect(status).toHaveText('3 cells selected.');
    // and a steep slant, r1c1 to r5c3, a step at a time
    await flick(0, 38);
    await expect(status).toHaveText('5 cells selected.');
    expect(await scrolled()).toBe(0);
    // a tap is still a tap
    const tap = await cellBox(page, 40);
    await page.touchscreen.tap(tap.x, tap.y);
    await expect(status).toContainText('Row 5, column 5');
    // a slow drag out of a digit is a drag, not the long press that lights
    // every cell of the digit: r1c5 is a 2, and the finger takes its time
    // inside the cell before it goes down to r3c5
    const slow = await cellBox(page, 4);
    const end = await cellBox(page, 22);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: slow.x, y: slow.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: slow.x, y: slow.y + 14 }] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: slow.x, y: end.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(status).toHaveText('3 cells selected.');
    // while a finger held still on it is that long press: the five 2s
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: slow.x, y: slow.y }] });
    await page.waitForTimeout(700);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(status).toHaveText('5 cells selected.');
    await page.touchscreen.tap(tap.x, tap.y);
    // the page scrolls from beside the board: a swipe up the margin
    const board = (await page.locator('svg.board').boundingBox())!;
    const x = board.x / 2;
    const y = board.y + board.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 8; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 20 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(scrolled).toBeGreaterThan(20);
    // the swipe beside the board was a scroll, not a tap: the selection stays
    await expect(status).toContainText('Row 5, column 5');
    // a tap there clears it
    const nowBoard = (await page.locator('svg.board').boundingBox())!;
    await page.touchscreen.tap(nowBoard.x / 2, nowBoard.y + nowBoard.height / 2);
    await expect(status).toHaveText('No cell selected.');
  });
});

test.describe('tablet on its side, 1180 x 820', () => {
  test.use({ viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true });

  test('a drag down the board selects a column at once', async ({ page }) => {
    await open(page);
    const from = await cellBox(page, 4);
    const to = await cellBox(page, 76);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y }] });
    for (const part of [0.5, 1]) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x, y: from.y + (to.y - from.y) * part }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toHaveText('9 cells selected.');
  });
});

test.describe('the app in Norwegian and Spanish', () => {
  // /nb/ and /es/ are pages of their own (built from src/content/home.ts)
  // and the app starts in their language, whatever the browser's
  const LANGS = [
    { path: '/nb/', lang: 'nb', title: /på nett/, caption: 'alt i denne boksen teller som hjelp' },
    { path: '/es/', lang: 'es', title: /online/, caption: 'todo lo de este cuadro cuenta como ayuda' }
  ];
  for (const l of LANGS) {
    test(`${l.path} serves its own page and starts the app in ${l.lang}`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
      const response = await page.goto(`${l.path}#p=${EASY}`);
      expect(await response!.text()).toContain(`<html lang="${l.lang}"`);
      await expect(page).toHaveTitle(l.title);
      await expect(page.locator('svg.board')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', l.lang);
      await expect(page.getByText(l.caption)).toBeVisible();
    });
  }
});

test.describe('a share link', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('is a page about the puzzle, which opens it with the time to beat', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    // the production build answers the share addresses the way the Worker does (vite.config.ts)
    const response = await page.goto(`/p/${EASY}?b=easy&s=600&vs=552`);
    const html = await response!.text();
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<meta name="robots" content="noindex" />');
    expect(html).toContain('<title>Easy sudoku, rated 600 | sudokUI</title>');
    expect(html).toContain('<meta property="og:title" content="Solved in 9:12. Can you beat it?" />');
    expect(html).toContain('<meta property="og:image" content="https://sudokui.app/og/easy.png" />');
    expect(html).not.toContain('rel="canonical"');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'solve it faster than 9:12' })).toBeVisible();
    // the address bar then names the puzzle as the app rates it, without the time to beat
    await expect.poll(() => page.evaluate(() => location.pathname + location.search)).toMatch(/^\/p\/[0-9.]{81}\?b=[a-z]+&s=\d+$/);
  });

  /** the clipboard, kept where the test can read it */
  const keepClipboard = () => {
    localStorage.setItem('sudokui-welcomed', '1');
    (window as any).__copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => (((window as any).__copied = s), Promise.resolve()) }
    });
  };
  const copied = (page: Page) => page.evaluate(() => (window as any).__copied as string);

  test('the Share dialog copies the share address of the puzzle on this origin, naming techniques only when asked', async ({ page }) => {
    await page.addInitScript(keepClipboard);
    // a Hard puzzle, whose path plays techniques worth naming
    await page.goto(`/#p=${HARD}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this puzzle' });
    const puzzle = HARD.replace(/\./g, '\\.');
    // the link carries the band and the score, and no technique: the names
    // would tell the recipient what to look for
    await dialog.getByRole('button', { name: 'Puzzle link' }).click();
    const link = await copied(page);
    expect(link).toMatch(new RegExp(`^http://localhost:4173/p/${puzzle}\\?b=[a-z]+&s=\\d+$`));
    await dialog.getByRole('button', { name: 'Position link' }).click();
    const position = await copied(page);
    expect(position.startsWith(link + '#s=')).toBe(true);
    // ticking "Say what it needs" names them, in both links
    const box = dialog.getByRole('checkbox', { name: 'Say what it needs' });
    await expect(box).not.toBeChecked();
    await box.check();
    await dialog.getByRole('button', { name: 'Puzzle link' }).click();
    const named = await copied(page);
    expect(named).toMatch(new RegExp(`^http://localhost:4173/p/${puzzle}\\?b=[a-z]+&s=\\d+&t=[a-z0-9-]+(,[a-z0-9-]+){0,2}$`));
    expect(named.startsWith(`${link}&t=`)).toBe(true);
    await dialog.getByRole('button', { name: 'Position link' }).click();
    expect((await copied(page)).startsWith(named + '#s=')).toBe(true);
    // the choice is not remembered: the box is off again the next time the dialog opens
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Say what it needs' })).not.toBeChecked();
  });

  test('a win against a challenge compares the times, and shares this time as the one to beat', async ({ page }) => {
    await page.addInitScript(keepClipboard);
    await page.goto(`/p/${EASY}?vs=552`);
    await expect(page.locator('svg.board')).toBeVisible();
    // solve it: every empty cell gets its digit
    const solution = gridToString(solve(parseGrid(EASY)!)!);
    const empties = [...EASY].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    for (const cell of empties) {
      // the clock counts whole seconds, and a solve of 0:00 is no time to
      // beat: let the clock tick once before the last digit
      if (cell === empties[empties.length - 1]) await page.waitForTimeout(1100);
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${solution[cell]}`);
    }
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Challenge beaten: 9:12 to beat, you took \d+:\d\d/);
    await dialog.getByRole('button', { name: /Challenge a friend/ }).click();
    const text = await copied(page);
    expect(text).toMatch(/^I solved an? [A-Za-z]+ sudoku \(rating \d+\) in \d+:\d\d/);
    // the band, the score and the time to beat, never the techniques: a challenge is about the time
    expect(text).toMatch(new RegExp(`https://sudokui\\.app/p/${EASY.replace(/\./g, '\\.')}\\?b=[a-z]+&s=\\d+&vs=\\d+$`));
  });

  test('/nb/p/ is the share page in Norwegian, and starts the app in Norwegian', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    const response = await page.goto(`/nb/p/${EASY}?b=easy`);
    const html = await response!.text();
    expect(html).toContain('<html lang="nb">');
    expect(html).toContain('<meta property="og:title" content="Klarer du denne sudokuen på nivået Lett?" />');
    expect(html).toContain('<meta property="og:image" content="https://sudokui.app/og/easy.nb.png" />');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'nb');
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe(`/nb/p/${EASY}`);
  });
});

test.describe('the daily', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const keepClipboard = () => {
    localStorage.setItem('sudokui-welcomed', '1');
    (window as any).__copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => (((window as any).__copied = s), Promise.resolve()) }
    });
  };
  const copied = (page: Page) => page.evaluate(() => (window as any).__copied as string);

  test('/daily/<date> previews that day’s puzzle, opens it, and is its address', async ({ page }) => {
    await page.addInitScript(keepClipboard);
    const third = dailies[2];
    const response = await page.goto(`/daily/${third.date}`);
    const html = await response!.text();
    expect(html).toContain(`<meta property="og:title" content="sudokUI Daily #3, ${third.date}: can you solve it?" />`);
    expect(html).toContain(`<meta property="og:image" content="https://sudokui.app/og/${third.level.toLowerCase()}.png" />`);
    expect(html).toContain('<meta name="robots" content="noindex" />');
    await expect(page.locator('svg.board')).toBeVisible();
    // the notice names the day: "The daily for <date>", or "Daily puzzle for <date>" on the day itself
    await expect(page.locator('.toast, [role=status]').filter({ hasText: third.date })).toBeVisible();
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe(`/daily/${third.date}`);
    // the share dialog hands out the day's address, not the puzzle's
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this puzzle' });
    await dialog.getByRole('button', { name: 'Puzzle link' }).click();
    expect(await copied(page)).toBe(`http://localhost:4173/daily/${third.date}`);
  });

  test('a finished daily sends its time when asked, hears how it compares, and shares the day', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(keepClipboard);
    // the API takes results for recent days only, so today's daily it is;
    // and a solve must take at least a floor of real seconds, which the
    // app's clock is pushed past instead of waited for
    const today = localDateKey();
    const daily = dailies.find((d) => d.date === today)!;
    expect(daily, `a published daily for ${today}`).toBeTruthy();
    await page.clock.install();
    await page.goto(`/daily/${today}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: `Daily puzzle for ${today}` })).toBeVisible();
    const solution = gridToString(solve(parseGrid(daily.puzzle)!)!);
    const empties = [...daily.puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    for (const cell of empties) {
      if (cell === empties[empties.length - 1]) await page.clock.fastForward(45_000);
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${solution[cell]}`);
    }
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Solved unassisted by \d+ so far, median \d+:\d\d|Nobody has sent in a time for this daily yet/);
    await dialog.getByRole('button', { name: /Send my time and compare/ }).click();
    await expect(dialog).toContainText(/Your time is the first one in|You were faster than \d+% of them/);
    await dialog.getByRole('button', { name: /Challenge a friend/ }).click();
    const text = await copied(page);
    const no = dailies.indexOf(daily) + 1;
    expect(text.startsWith(`sudokUI Daily #${no} · ${daily.level} (${daily.score}) · `)).toBe(true);
    expect(text).toContain(' · unassisted · ');
    const [, time, link] = /· (\d+:\d\d) · unassisted · (?:faster than \d+% today · )?(https:\S+)$/.exec(text) ?? [];
    expect(time).toMatch(/^\d+:\d\d$/);
    expect(link).toMatch(/^https:\/\/sudokui\.app\/daily\/\d{4}-\d{2}-\d{2}\?vs=\d+$/);
    expect(link).toContain(`/daily/${today}?vs=`);
    // the day's statistics now count this result (asked afresh: the win
    // screen's own read a moment ago is still in the browser's cache)
    const stats = await page.evaluate(async (n) => (await fetch(`/api/daily/${n}/stats`, { cache: 'no-store' })).json(), no);
    expect(stats.count).toBeGreaterThanOrEqual(1);
  });

  test('an assisted daily shows the day’s times, sends nothing and shares no percentile', async ({ page }) => {
    test.setTimeout(60_000);
    await page.addInitScript(keepClipboard);
    const today = localDateKey();
    const daily = dailies.find((d) => d.date === today)!;
    expect(daily, `a published daily for ${today}`).toBeTruthy();
    await page.goto(`/daily/${today}`);
    await expect(page.locator('svg.board')).toBeVisible();
    // one Check is help: the solve is no longer unassisted
    await page.getByRole('button', { name: /Check/ }).first().click();
    await page.getByRole('button', { name: 'Use Check' }).click();
    const solution = gridToString(solve(parseGrid(daily.puzzle)!)!);
    const empties = [...daily.puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    for (const cell of empties) {
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${solution[cell]}`);
    }
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Solved unassisted by \d+ so far, median \d+:\d\d|Nobody has sent in a time for this daily yet/);
    await expect(dialog).toContainText('Only unassisted solves are counted in everyone’s times');
    await expect(dialog.getByRole('button', { name: /Send my time and compare/ })).toHaveCount(0);
    await dialog.getByRole('button', { name: /Challenge a friend/ }).click();
    const text = await copied(page);
    expect(text).toMatch(/^sudokUI Daily #\d+ · /);
    expect(text).not.toMatch(/unassisted|faster than/);
  });
});

test.describe('positions as text', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const keepClipboard = () => {
    localStorage.setItem('sudokui-welcomed', '1');
    (window as any).__copied = '';
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => (((window as any).__copied = s), Promise.resolve()) }
    });
  };
  const copied = (page: Page) => page.evaluate(() => (window as any).__copied as string);

  test('a pasted pencil-mark grid puts its candidates on the board, and Share copies the board back as the same grid', async ({ page }) => {
    await page.addInitScript(keepClipboard);
    await open(page);
    // the puzzle with its candidates, one false candidate already taken
    // out, as a forum post carries a position part-way through
    const g = parseGrid(EASY)!;
    const solution = gridToString(solve(parseGrid(EASY)!)!);
    const cell = Array.from({ length: 81 }, (_, i) => i).find((i) => !g.values[i] && digitsOf(g.cands[i]).length >= 3)!;
    const dropped = digitsOf(g.cands[cell]).find((d) => d !== Number(solution[cell]))!;
    const cells = Array.from({ length: 81 }, (_, i) => ({
      value: g.values[i],
      corner: 0,
      center: i === cell ? g.cands[i] & ~bit(dropped) : g.cands[i],
      excluded: 0
    }));
    const text = formatPencilGrid(cells, false, 'exhaustive');
    await page.locator('.menu-row button', { hasText: 'Import' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import a puzzle' });
    await dialog.locator('textarea').fill(text);
    await dialog.getByRole('button', { name: 'Load puzzle' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'Pencil-mark grid loaded' })).toBeVisible();
    // the candidates are the text's, not the engine's: the cell that lost one reads without it
    const c = await cellBox(page, cell);
    await page.mouse.click(c.x, c.y);
    const left = digitsOf(g.cands[cell] & ~bit(dropped)).join(' ');
    await expect(page.locator('#board-status')).toHaveText(
      `Row ${Math.floor(cell / 9) + 1}, column ${(cell % 9) + 1}: empty, centre marks ${left}.`
    );
    // and the board copied as text is the grid that was pasted
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await page.getByRole('dialog', { name: 'Share this puzzle' }).getByRole('button', { name: 'Position as text' }).click();
    expect(await copied(page)).toBe(text);
  });
});

test.describe('counting plays', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  /** every empty cell gets its digit; the clock ticks once before the last */
  async function solveBoard(page: Page, puzzle: string) {
    const solution = gridToString(solve(parseGrid(puzzle)!)!);
    const empties = [...puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    for (const cell of empties) {
      if (cell === empties[empties.length - 1]) await page.waitForTimeout(1100);
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${solution[cell]}`);
    }
    await expect(page.getByRole('dialog', { name: 'Puzzle solved' })).toBeVisible();
  }
  type Line = Record<string, unknown> & { event: string };

  test('a completed game sends one beacon, with nothing kept on the device', async ({ page }) => {
    const batches: Line[][] = [];
    await page.route('**/api/t', async (route) => {
      batches.push(JSON.parse(route.request().postData() ?? '[]'));
      await route.fulfill({ status: 204 });
    });
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/p/${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    // opened and not yet played: nothing is counted
    await page.waitForTimeout(1500);
    expect(batches.flat()).toHaveLength(0);
    await solveBoard(page, EASY);
    // the first move counted the start, the last one the solve
    await expect.poll(() => batches.flat().filter((e) => e.event === 'started').length).toBe(1);
    await expect.poll(() => batches.flat().filter((e) => e.event === 'completed').length).toBe(1);
    const completed = batches.flat().find((e) => e.event === 'completed')!;
    expect(completed).toEqual({
      event: 'completed',
      band: expect.stringMatching(/^(Beginner|Easy|Medium|Tricky|Hard|Unfair|Extreme|Nightmare)$/),
      bucket: 0,
      standalone: false,
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      source: 'tab'
    });
    // one beacon for the solve, and nothing on the device for it
    expect(batches.filter((b) => b.some((e) => e.event === 'completed'))).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.getItem('sudokui-telemetry-v1'))).toBeNull();
    // the win screen points at the switch, this first time
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).toContainText('Plays are counted without identifying anyone');
    await expect(dialog.getByRole('link', { name: 'What is sent' })).toHaveAttribute('href', '/privacy/');
    await dialog.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings.getByRole('switch', { name: 'Help count plays, including offline ones' })).toHaveAttribute('aria-checked', 'false');
  });

  test('offline with the switch off, nothing is sent and nothing is kept', async ({ page, context }) => {
    const attempts: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/t')) attempts.push(r.method());
    });
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/p/${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    // opened and not yet played: nothing sent
    await page.waitForTimeout(1500);
    expect(attempts).toHaveLength(0);
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    // the whole game, its first move included, offline: nothing goes
    await solveBoard(page, EASY);
    await page.waitForTimeout(1500);
    expect(attempts).toHaveLength(0);
    expect(await page.evaluate(() => localStorage.getItem('sudokui-telemetry-v1'))).toBeNull();
    await context.setOffline(false);
  });

  test('with the switch on, an offline solve is kept and sent when the connection returns', async ({ page, context }) => {
    const batches: Line[][] = [];
    await page.route('**/api/t', async (route) => {
      batches.push(JSON.parse(route.request().postData() ?? '[]'));
      await route.fulfill({ status: 204 });
    });
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { countPlays: true, countPlaysAsked: true }, version: 0 }));
    });
    await page.goto(`/p/${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    // the first move, online: a corner mark in r1c1, which the solve then overwrites
    const first = await cellBox(page, 0);
    await page.mouse.click(first.x, first.y);
    await page.keyboard.press('Shift+Digit1');
    // (a click on the lone selected cell would deselect it: start the solve from nothing selected)
    await page.keyboard.press('Escape');
    await expect.poll(() => batches.flat().filter((e) => e.event === 'started').length).toBe(1);
    expect(batches.flat()[0]).toMatchObject({ event: 'started', optin: true, returning: false });
    await context.setOffline(true);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    await solveBoard(page, EASY);
    // kept on the device, marked as made offline
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-telemetry-v1') ?? 'null'));
    expect(kept.queue).toHaveLength(1);
    expect(kept.queue[0]).toMatchObject({ event: 'completed', offline: true, optin: true, returning: false });
    expect(kept.firstSeen).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(batches.flat().filter((e) => e.event === 'completed')).toHaveLength(0);
    // and sent when the connection returns
    await context.setOffline(false);
    await expect.poll(() => batches.flat().filter((e) => e.event === 'completed').length).toBe(1);
    expect(batches.flat().find((e) => e.event === 'completed')).toMatchObject({ offline: true, optin: true });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-telemetry-v1') ?? 'null')?.queue?.length)).toBe(0);
    // the switch off takes the rest with it
    await page.getByRole('dialog', { name: 'Puzzle solved' }).getByRole('button', { name: 'Admire the grid' }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await settings.getByRole('switch', { name: 'Help count plays, including offline ones' }).click();
    expect(await page.evaluate(() => localStorage.getItem('sudokui-telemetry-v1'))).toBeNull();
  });

  test('a device left out of the counts sends nothing for a whole game, and says so in Settings', async ({ page }) => {
    const attempts: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/t')) attempts.push(r.method());
    });
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { dontCount: true }, version: 0 }));
    });
    await page.goto(`/p/${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await solveBoard(page, EASY);
    await page.waitForTimeout(1500);
    expect(attempts).toHaveLength(0);
    // no pointer at the counting switch on the win screen either
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).not.toContainText('Plays are counted without identifying anyone');
    await dialog.getByRole('button', { name: 'Admire the grid' }).click();
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings.getByRole('switch', { name: 'Leave this device out of the counts' })).toHaveAttribute('aria-checked', 'true');
    await expect(settings.getByRole('switch', { name: 'Help count plays, including offline ones' })).toBeDisabled();
  });

  test('the privacy page exists in three languages, and the footer links to it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await open(page);
    await expect(page.locator('.app-footer a', { hasText: 'Privacy' })).toHaveAttribute('href', '/privacy/');
    for (const [path, h1] of [
      ['/privacy/', 'What sudokUI sends, and what it keeps'],
      ['/nb/privacy/', 'Hva sudokUI sender, og hva appen beholder'],
      ['/es/privacy/', 'Qué envía sudokUI y qué conserva']
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(200);
      await expect(page.locator('h1')).toHaveText(h1);
    }
  });
});

test.describe('a link from another site', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a pasted Sudoku Exchange link opens its puzzle, and the notice names the site', async ({ page }) => {
    // on one puzzle, the link of another, as Sudoku Exchange writes it: 81 digits, 0 for empty, and the band
    await open(page, `#p=${HARD}`);
    const link = `https://sudokuexchange.com/play/?s=${EASY.replace(/\./g, '0')}&d=1`;
    await page.locator('.menu-row button', { hasText: 'Import' }).click();
    const dialog = page.getByRole('dialog', { name: 'Import a puzzle' });
    await dialog.locator('textarea').fill(link);
    await dialog.getByRole('button', { name: 'Load puzzle' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'Imported from Sudoku Exchange' })).toBeVisible();
    // the board is that puzzle: r1c3 holds its given 3, and the address names it
    const c = await cellBox(page, 2);
    await page.mouse.click(c.x, c.y);
    await expect(page.locator('#board-status')).toHaveText('Row 1, column 3: 3, given.');
    await expect.poll(() => page.evaluate(() => location.pathname)).toBe(`/p/${EASY}`);
  });
});

test.describe('the set tracker', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('a row against a column: the overlap drops out, the line counts both and proves them equal', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { setTracker: true }, version: 0 }));
    });
    await page.goto(`/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    const tracker = page.locator('.set-tracker');
    await expect(tracker).toHaveCount(0);
    // row 2 in colour 6 (the first set's), column 2 in colour 2 (the second's)
    const paint = async (from: number, key: 'ArrowRight' | 'ArrowDown', colour: string) => {
      const c = await cellBox(page, from);
      await page.mouse.click(c.x, c.y);
      for (let i = 0; i < 8; i++) await page.keyboard.press(`Shift+${key}`);
      await page.keyboard.press('KeyV');
      await page.keyboard.press(`Digit${colour}`);
    };
    await paint(9, 'ArrowRight', '6');
    await expect(tracker).toContainText('Paint the other set');
    await paint(1, 'ArrowDown', '2');
    // row 2 holds 9, 3, 5 and 1; column 2 is empty; r2c2 is in both and counts in neither
    await expect(tracker).toContainText('8 cells, 4 placed');
    await expect(tracker).toContainText('8 cells, 0 placed, still needs 1, 3, 5 and 9');
    await expect(tracker).toContainText('Same digits, proved by counting houses');
    // the board shows what is counted: eight blue, eight orange, and r2c2, in both, in neither
    await expect(page.locator('svg.board rect[fill="#5b8fe0"]')).toHaveCount(8);
    await expect(page.locator('svg.board rect[fill="#e8934a"]')).toHaveCount(8);
    await tracker.getByRole('button', { name: 'Why?' }).click();
    await expect(tracker).toContainText('with column 2 covers the same cells as');
    await expect(tracker).toContainText('with row 2. Each house holds every digit once');
    // it is not help
    await expect(page.locator('.level-badge').first()).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.assisted ?? false)).toBe(false);
  });

  /**
   * The board with the tracker on, in colour mode: cells are toggled in a
   * colour by a click and its key, from nothing selected (a click on the one
   * selected cell would let go of it, and the key would then arm a digit)
   */
  async function tracking(page: Page) {
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { setTracker: true }, version: 0 }));
    });
    await page.goto(`/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await page.keyboard.press('KeyV');
    return async (cells: number[], colour: string) => {
      for (const cell of cells) {
        await page.keyboard.press('Escape');
        const c = await cellBox(page, cell);
        await page.mouse.click(c.x, c.y);
        await page.keyboard.press(`Digit${colour}`);
      }
    };
  }

  /** the claim and its proof go together: no "Same digits", no Why?, no proof, no list of digits */
  async function claimsNothing(tracker: Locator) {
    await expect(tracker).toContainText('Not necessarily the same digits: no count of houses links them, and some valid grid fills them differently');
    await expect(tracker).not.toContainText('Same digits');
    await expect(tracker.locator('.set-verdict.proved')).toHaveCount(0);
    await expect(tracker.locator('.set-why')).toHaveCount(0);
    await expect(tracker.locator('.set-proof')).toHaveCount(0);
    await expect(tracker).not.toContainText('still needs');
    await expect(tracker).not.toContainText('the rest is exactly');
  }

  /**
   * What an element of the tracker says, as the player sees it: each
   * swatch written as the colour the browser draws it in ("[#5b8fe0]", or
   * "[unseen]" when it has no size), buttons left out
   */
  const said = (loc: Locator) =>
    loc.evaluate((el) => {
      const swatch = (e: Element) => {
        const box = e.getBoundingClientRect();
        if (!box.width || !box.height) return '[unseen]';
        const rgb = (getComputedStyle(e).backgroundColor.match(/\d+/g) ?? []).slice(0, 3);
        return `[#${rgb.map((x) => Number(x).toString(16).padStart(2, '0')).join('')}]`;
      };
      const walk = (n: Node): string =>
        n.nodeType === Node.TEXT_NODE
          ? (n.textContent ?? '')
          : n instanceof HTMLButtonElement
            ? ''
            : n instanceof Element && n.classList.contains('set-swatch')
              ? swatch(n)
              : [...n.childNodes].map(walk).join('');
      return walk(el).trim();
    });

  /** the colours the board draws on a cell, as it writes them */
  const fillsOf = (page: Page, cell: number) =>
    page
      .locator(`svg.board rect[y="${4 + Math.floor(cell / 9) * 100}"][height="100"][opacity="0.55"]`)
      .evaluateAll(
        (rects, x) =>
          rects
            .filter((r) => Number(r.getAttribute('x')) >= x && Number(r.getAttribute('x')) < x + 100)
            .map((r) => r.getAttribute('fill')),
        4 + (cell % 9) * 100
      );

  /** the two sets' colours as the board draws them: colour 6 and colour 2 */
  const [BLUE, ORANGE] = ['#5b8fe0', '#e8934a'];
  const PROOF_END = 'Each house holds every digit once, so the two sets hold the same digits.';

  /** proved again: whatever proof shows is this pair's, and the button says whether it shows */
  async function provedAgain(tracker: Locator, proof: string) {
    await expect(tracker).toContainText('Same digits, proved by counting houses');
    const why = tracker.locator('.set-why');
    await expect(why).toHaveCount(1);
    const proofs = tracker.locator('.set-proof');
    const open = (await why.getAttribute('aria-expanded')) === 'true';
    await expect(proofs).toHaveCount(open ? 1 : 0);
    if (!open) await why.click();
    await expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(await said(proofs)).toBe(proof);
    // and it folds and opens on a click
    await why.click();
    await expect(proofs).toHaveCount(0);
    await expect(why).toHaveText('Why?');
    await why.click();
    await expect(why).toHaveText('Hide the proof');
    expect(await said(proofs)).toBe(proof);
  }

  test('a proof opened, then a cell repainted: the claim and the proof go, and come back with the pair', async ({ page }) => {
    const toggle = await tracking(page);
    const tracker = page.locator('.set-tracker');
    // row 2 in colour 6, column 2 in colour 2, the proof opened and folded again
    await toggle([9, 10, 11, 12, 13, 14, 15, 16, 17], '6');
    await toggle([1, 10, 19, 28, 37, 46, 55, 64, 73], '2');
    await expect(tracker).toContainText('Same digits, proved by counting houses');
    const why = tracker.getByRole('button', { name: 'Why?' });
    await why.click();
    await expect(tracker.locator('.set-proof')).toContainText('with column 2 covers the same cells as');
    await expect(tracker.locator('.set-why')).toHaveAttribute('aria-expanded', 'true');
    await tracker.getByRole('button', { name: 'Hide the proof' }).click();
    await expect(tracker.locator('.set-proof')).toHaveCount(0);
    await why.click();
    await expect(tracker.locator('.set-proof')).toHaveCount(1);
    // r9c2 out of the second set and r9c1 in: eight against eight, which no count of houses links
    await toggle([73, 72], '2');
    await claimsNothing(tracker);
    await expect(tracker).toContainText('8 cells, 4 placed');
    // painted back
    await toggle([72, 73], '2');
    await provedAgain(tracker, `[${BLUE}] with column 2 covers the same cells as [${ORANGE}] with row 2. ${PROOF_END}`);
  });

  test('Phistomefel’s ring against its corners, one ring cell moved and moved back', async ({ page }) => {
    const toggle = await tracking(page);
    const tracker = page.locator('.set-tracker');
    const corners = [0, 1, 7, 8, 9, 10, 16, 17, 63, 64, 70, 71, 72, 73, 79, 80];
    const ring = [20, 21, 22, 23, 24, 29, 33, 38, 42, 47, 51, 56, 57, 58, 59, 60];
    await toggle(corners, '6');
    await toggle(ring, '2');
    await expect(tracker).toContainText('Same digits, proved by counting houses');
    await tracker.getByRole('button', { name: 'Why?' }).click();
    // the proof checked cell by cell in tests/setsSoundness.test.ts
    const proof = `[${BLUE}] with columns 3 and 7 and boxes 2 and 8 covers the same cells as [${ORANGE}] with rows 1, 2, 8 and 9. ${PROOF_END}`;
    await expect.poll(() => said(tracker.locator('.set-proof'))).toBe(proof);
    // r3c3 out of the ring and r1c4 in: sixteen against sixteen, unequal
    await toggle([20, 3], '2');
    await claimsNothing(tracker);
    await expect(tracker.locator('.set-side')).toHaveCount(2);
    await expect(tracker.locator('.set-side').nth(1)).toContainText('16 cells');
    // moved back
    await toggle([3, 20], '2');
    await provedAgain(tracker, proof);
  });

  test('each swatch is drawn in its set’s colour on the board; an open proof follows the pair into another proof, and the lists follow the digits', async ({ page }) => {
    const toggle = await tracking(page);
    const tracker = page.locator('.set-tracker');
    const side = (k: number) => said(tracker.locator('.set-side').nth(k));
    const proof = tracker.locator('.set-proof');
    const row2 = [9, 10, 11, 12, 13, 14, 15, 16, 17];
    const column2 = [1, 10, 19, 28, 37, 46, 55, 64, 73];
    await toggle(row2, '6');
    await toggle(column2, '2');
    await expect(tracker).toContainText('Same digits, proved by counting houses');
    // the board fills each set's cells in one colour and r2c2, in both, in neither;
    // the line's swatches are drawn in those colours, and so are the proof's
    for (const cell of row2) expect(await fillsOf(page, cell), `r2c${cell - 8}`).toEqual(cell === 10 ? [] : [BLUE]);
    for (const cell of column2) expect(await fillsOf(page, cell), `r${Math.floor(cell / 9) + 1}c2`).toEqual(cell === 10 ? [] : [ORANGE]);
    expect(await side(0)).toBe(`[${BLUE}] 8 cells, 4 placed`);
    expect(await side(1)).toBe(`[${ORANGE}] 8 cells, 0 placed, still needs 1, 3, 5 and 9`);
    expect(await said(tracker.locator('.set-verdict'))).toBe('✓ Same digits, proved by counting houses');
    await tracker.getByRole('button', { name: 'Why?' }).click();
    await expect.poll(() => said(proof)).toBe(`[${BLUE}] with column 2 covers the same cells as [${ORANGE}] with row 2. ${PROOF_END}`);

    // r1c2's 8 placed: the second set has one digit, which the first then needs; taken out, as before
    await page.keyboard.press('KeyZ');
    await page.keyboard.press('Escape');
    const r1c2 = await cellBox(page, 1);
    await page.mouse.click(r1c2.x, r1c2.y);
    await page.keyboard.press('Digit8');
    await expect.poll(() => side(0)).toBe(`[${BLUE}] 8 cells, 4 placed, still needs 8`);
    await expect.poll(() => side(1)).toBe(`[${ORANGE}] 8 cells, 1 placed, still needs 1, 3, 5 and 9`);
    await page.keyboard.press('Backspace');
    await expect.poll(() => side(0)).toBe(`[${BLUE}] 8 cells, 4 placed`);
    await expect.poll(() => side(1)).toBe(`[${ORANGE}] 8 cells, 0 placed, still needs 1, 3, 5 and 9`);
    await expect(proof).toHaveCount(1);

    // row 3 painted into the first set, the proof still open: sixteen against seven, no claim and no proof
    await page.keyboard.press('KeyV');
    await toggle([18, 19, 20, 21, 22, 23, 24, 25, 26], '6');
    await expect(tracker).toContainText('Not the same digits: 16 cells against 7');
    await expect(proof).toHaveCount(0);
    await expect(tracker.locator('.set-why')).toHaveCount(0);
    await expect(tracker).not.toContainText('still needs');
    // and column 3 into the second: rows 2 and 3 against columns 2 and 3, proved, and the proof shown is theirs
    await toggle([2, 11, 20, 29, 38, 47, 56, 65, 74], '2');
    await expect(tracker).toContainText('Same digits, proved by counting houses');
    expect(await side(0)).toBe(`[${BLUE}] 14 cells, 7 placed, still needs 2`);
    expect(await side(1)).toBe(`[${ORANGE}] 14 cells, 5 placed, still needs 1, 4 and 9`);
    await provedAgain(tracker, `[${BLUE}] with columns 2 and 3 covers the same cells as [${ORANGE}] with rows 2 and 3. ${PROOF_END}`);
  });
});

test.describe('tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

  test('the mode buttons are a finger’s size, the same width as before', async ({ page }) => {
    await open(page);
    const mode = (await page.locator('.mode-btn').first().boundingBox())!;
    expect(mode.height).toBeGreaterThanOrEqual(52);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(wide).toBe(false);
  });
});

test.describe('the welcome', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const dialogOf = (page: Page) => page.getByRole('dialog', { name: 'Welcome to sudokUI' });
  /** the game on the board, as it was saved */
  const saved = (page: Page) =>
    page.evaluate(() => {
      const info = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info;
      return info ? { level: info.level as string, dailyKey: (info.dailyKey ?? null) as string | null } : null;
    });

  test('on a day whose daily is Hard, a first visit starts with an easy puzzle, the daily a tap away', async ({ page }) => {
    // the published daily for 2 November 2026 is Hard (src/content/dailies.json)
    await page.clock.install({ time: new Date('2026-11-02T12:00:00') });
    await page.goto('/');
    const dialog = dialogOf(page);
    const buttons = dialog.locator('.hint-actions button');
    await expect(buttons.first()).toHaveText('Start with an easy puzzle');
    await expect(buttons.nth(1)).toHaveText("Today's daily (Hard)");
    await buttons.first().click();
    await expect(dialog).toBeHidden();
    await expect.poll(() => saved(page)).toEqual({ level: 'Easy', dailyKey: null });
    // a game won after the welcome gets its win screen
    await solveSaved(page);
    await expect(page.getByRole('dialog', { name: 'Puzzle solved' })).toBeVisible();
  });

  test('the daily stays one tap away on that day, and stays when the first visit’s own game arrives after it', async ({ page }) => {
    await slowMaker(page);
    await page.clock.install({ time: new Date('2026-11-02T12:00:00') });
    await page.goto('/');
    await dialogOf(page).getByRole('button', { name: "Today's daily (Hard)" }).click();
    await expect.poll(() => saved(page)).toEqual({ level: 'Hard', dailyKey: '2026-11-02' });
    // the easy game the app was making for this first visit lands now, and is dropped
    await page.waitForTimeout(3000);
    expect(await saved(page)).toEqual({ level: 'Hard', dailyKey: '2026-11-02' });
  });

  /** a game saved on an earlier visit that never saw the welcome: Hard, with one digit placed, or won */
  const seed = (o: { puzzle?: string; level?: string; state: 'untouched' | 'begun' | 'won'; dailyKey?: string }) => {
    const puzzle = o.puzzle ?? HARD;
    const won = o.state === 'won';
    const solution = gridToString(solve(parseGrid(puzzle)!)!);
    const cells = [...puzzle].map((ch, i) => ({
      given: ch !== '.',
      value: ch !== '.' ? Number(ch) : won || (o.state === 'begun' && i === puzzle.indexOf('.')) ? Number(solution[i]) : 0,
      corner: 0,
      center: 0,
      excluded: 0,
      colors: [] as number[]
    }));
    const state = {
      info: { puzzle, solution, score: 1500, level: o.level ?? 'Hard', practiceTech: null, ...(o.dailyKey ? { dailyKey: o.dailyKey } : {}) },
      cells,
      custom: false,
      autoCandidates: false,
      elapsedBefore: 60_000,
      won,
      solved: won,
      assisted: false,
      markContract: 'unknown',
      practiceTarget: null,
      practiceFound: false
    };
    return JSON.stringify({ state, version: 0 });
  };
  const seedHard = (won: boolean) => seed({ state: won ? 'won' : 'begun' });
  /** the digits placed on the saved board, givens aside */
  const placed = (page: Page) =>
    page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells.filter((c: any) => !c.given && c.value).length);
  /** the puzzle maker, slowed so that a game started meanwhile is there first */
  const slowMaker = (page: Page) =>
    page.route('**/assets/worker-*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
  /** solves the game on the board from what was saved */
  const solveSaved = async (page: Page) => {
    const info = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.info);
    const empties = [...(info.puzzle as string)].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    for (const cell of empties) {
      if (cell === empties[empties.length - 1]) await page.waitForTimeout(1100);
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${info.solution[cell]}`);
    }
  };

  test('a game begun on an earlier visit stays: Just play keeps it, on a Hard day too', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-02T12:00:00') });
    await page.addInitScript((saved) => localStorage.setItem('sudokui-game-v1', saved), seedHard(false));
    await page.goto('/');
    const buttons = dialogOf(page).locator('.hint-actions button');
    await expect(buttons.first()).toHaveText('Just play');
    await expect(buttons.nth(1)).toHaveText("Today's daily (Hard)");
    await buttons.first().click();
    await expect(dialogOf(page)).toBeHidden();
    expect(await saved(page)).toEqual({ level: 'Hard', dailyKey: null });
    const placed = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells.filter((c: any) => !c.given && c.value).length);
    expect(placed).toBe(1);
  });

  test('a game already won makes way for an easy one, and its win screen does not come back', async ({ page }) => {
    await slowMaker(page);
    await page.clock.install({ time: new Date('2026-11-02T12:00:00') });
    await page.addInitScript((saved) => {
      localStorage.setItem('sudokui-game-v1', saved);
      // whether the old win's screen ever shows, however briefly
      (window as any).__sawWin = false;
      new MutationObserver(() => {
        if (document.querySelector('[aria-label="Puzzle solved"]')) (window as any).__sawWin = true;
      }).observe(document, { subtree: true, childList: true });
    }, seedHard(true));
    await page.goto('/');
    const buttons = dialogOf(page).locator('.hint-actions button');
    await expect(buttons.first()).toHaveText('Start with an easy puzzle');
    await buttons.first().click();
    await expect.poll(() => saved(page), { timeout: 10_000 }).toEqual({ level: 'Easy', dailyKey: null });
    expect(await page.evaluate(() => (window as any).__sawWin)).toBe(false);
  });

  test('an untouched game above Easy makes way for an easy one', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-02T12:00:00') });
    await page.addInitScript((saved) => localStorage.setItem('sudokui-game-v1', saved), seed({ state: 'untouched' }));
    await page.goto('/');
    await dialogOf(page).getByRole('button', { name: 'Start with an easy puzzle' }).click();
    await expect.poll(() => saved(page)).toEqual({ level: 'Easy', dailyKey: null });
  });

  test('a game begun on an earlier visit stays on a Medium day too', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T12:00:00') });
    await page.addInitScript((saved) => localStorage.setItem('sudokui-game-v1', saved), seedHard(false));
    await page.goto('/');
    const buttons = dialogOf(page).locator('.hint-actions button');
    await expect(buttons.first()).toHaveText('Just play');
    await expect(buttons.nth(1)).toHaveText("Play today's daily");
    await buttons.first().click();
    expect(await saved(page)).toEqual({ level: 'Hard', dailyKey: null });
    expect(await placed(page)).toBe(1);
  });

  test('today’s daily under way is kept, not restarted, by the daily button', async ({ page }) => {
    const today = dailies.find((d) => d.date === '2026-11-03')!;
    await page.clock.install({ time: new Date('2026-11-03T12:00:00') });
    await page.addInitScript(
      (saved) => localStorage.setItem('sudokui-game-v1', saved),
      seed({ puzzle: today.puzzle, level: today.level, state: 'begun', dailyKey: today.date })
    );
    await page.goto('/');
    await dialogOf(page).getByRole('button', { name: "Play today's daily" }).click();
    await expect(dialogOf(page)).toBeHidden();
    expect(await saved(page)).toEqual({ level: today.level, dailyKey: today.date });
    expect(await placed(page)).toBe(1);
  });

  test('today’s daily already solved is kept by the daily button, and its win screen shows', async ({ page }) => {
    const today = dailies.find((d) => d.date === '2026-11-03')!;
    await page.clock.install({ time: new Date('2026-11-03T12:00:00') });
    await page.addInitScript(
      (saved) => localStorage.setItem('sudokui-game-v1', saved),
      seed({ puzzle: today.puzzle, level: today.level, state: 'won', dailyKey: today.date })
    );
    await page.goto('/');
    await dialogOf(page).getByRole('button', { name: "Play today's daily" }).click();
    await expect(dialogOf(page)).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Puzzle solved' })).toBeVisible();
    const won = await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.won);
    expect(won).toBe(true);
    expect(await saved(page)).toEqual({ level: today.level, dailyKey: today.date });
  });

  test("with Hide rating on, the welcome does not name the daily's band", async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-02T12:00:00') });
    await page.addInitScript(() => localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { hideRating: true }, version: 0 })));
    await page.goto('/');
    const buttons = dialogOf(page).locator('.hint-actions button');
    await expect(buttons.first()).toHaveText('Start with an easy puzzle');
    await expect(buttons.nth(1)).toHaveText("Play today's daily");
  });

  test('on a day whose daily is Medium, the welcome offers the daily first', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-11-03T12:00:00') });
    await page.goto('/');
    const buttons = dialogOf(page).locator('.hint-actions button');
    await expect(buttons.first()).toHaveText("Play today's daily");
    await expect(buttons.nth(1)).toHaveText('Just play');
  });
});

test.describe('sending from a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  /** the share sheet and the clipboard, kept where the test can read them */
  const keepSheet = () => {
    localStorage.setItem('sudokui-welcomed', '1');
    (window as any).__shared = [];
    (window as any).__copied = '';
    Object.defineProperty(navigator, 'share', {
      value: (d: { text?: string; url?: string }) =>
        (navigator as any).userActivation?.isActive === false
          ? Promise.reject(new DOMException('the tap no longer counts', 'NotAllowedError'))
          : ((window as any).__shared.push(d), Promise.resolve()),
      configurable: true
    });
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (s: string) => (((window as any).__copied = s), Promise.resolve()) },
      configurable: true
    });
  };
  const shared = (page: Page) => page.evaluate(() => (window as any).__shared as { text?: string; url?: string }[]);
  const copied = (page: Page) => page.evaluate(() => (window as any).__copied as string);

  test('a link goes to the share sheet, a puzzle string to the clipboard', async ({ page }) => {
    await page.addInitScript(keepSheet);
    await page.goto(`/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this puzzle' });
    await dialog.getByRole('button', { name: 'Puzzle link' }).click();
    await expect.poll(async () => (await shared(page)).length).toBe(1);
    // a bare link goes over as a link
    expect((await shared(page))[0].url).toContain(`/p/${EASY}`);
    // the sheet was the answer: nothing copied, no tick
    expect(await copied(page)).toBe('');
    await expect(dialog.getByRole('button', { name: /Puzzle link/ })).not.toContainText('Copied');
    // what goes into another tool is copied, never shared
    await dialog.getByRole('button', { name: 'Puzzle string' }).click();
    await expect.poll(() => copied(page)).toBe(EASY);
    expect(await shared(page)).toHaveLength(1);
  });

  test('a challenge after a win goes to the share sheet', async ({ page }) => {
    await page.addInitScript(keepSheet);
    await page.goto(`/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    const solution = gridToString(solve(parseGrid(EASY)!)!);
    const empties = [...EASY].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
    for (const cell of empties) {
      if (cell === empties[empties.length - 1]) await page.waitForTimeout(1100);
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${solution[cell]}`);
    }
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Challenge a friend/ }).click();
    await expect.poll(async () => (await shared(page)).length).toBe(1);
    expect((await shared(page))[0].text).toMatch(/Can you beat that\? https:\/\/sudokui\.app\/p\//);
    expect(await copied(page)).toBe('');
  });
});

test.describe('a puzzle being typed in', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  const panel = (page: Page) => page.locator('.hint-panel').filter({ hasText: 'Custom puzzle' });
  /** the level of the game saved on the device, if any */
  const savedLevel = (page: Page) =>
    page.evaluate(() => (JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info?.level ?? null) as string | null);
  /** opens custom entry from New game and types the first n givens of EASY */
  const typeIn = async (page: Page, n: number) => {
    await page.locator('.menu-row button', { hasText: 'New' }).click();
    await page.getByRole('button', { name: /^Custom/ }).click();
    await expect(panel(page)).toBeVisible();
    const givens = [...EASY].map((ch, i) => (ch === '.' ? -1 : i)).filter((i) => i >= 0).slice(0, n);
    for (const cell of givens) {
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      await page.keyboard.press(`Digit${EASY[cell]}`);
    }
    await expect(panel(page)).toContainText(`(${n} so far)`);
  };

  /** the puzzle of the game saved on the device, if any */
  const savedPuzzle = (page: Page) =>
    page.evaluate(() => (JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info?.puzzle ?? null) as string | null);

  test('survives a reload, at the home address, and Cancel then brings back the game from before', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => savedLevel(page)).toBe('Easy');
    const before = await savedPuzzle(page);
    await typeIn(page, 5);
    // a puzzle being typed in has no address of its own yet
    expect(new URL(page.url()).pathname).toBe('/');
    await page.reload();
    await expect(panel(page)).toContainText('(5 so far)');
    // no game was started over it while the page came back
    await page.waitForTimeout(1500);
    await expect(panel(page)).toContainText('(5 so far)');
    // the game the entry was opened over comes back
    await panel(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(panel(page)).toHaveCount(0);
    expect(await savedPuzzle(page)).toBe(before);
  });

  test('is kept by the welcome that a reload shows a visitor who came by a link', async ({ page }) => {
    // a Medium day, when the welcome would otherwise lead with the daily
    await page.clock.install({ time: new Date('2026-11-03T12:00:00') });
    // a first visit by a puzzle link: no welcome there, and none dismissed
    await page.goto(`/p/${HARD}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await typeIn(page, 4);
    await page.reload();
    const welcome = page.getByRole('dialog', { name: 'Welcome to sudokUI' });
    const buttons = welcome.locator('.hint-actions button');
    await expect(buttons.first()).toHaveText('Just play');
    await buttons.first().click();
    await expect(welcome).toBeHidden();
    await expect(panel(page)).toContainText('(4 so far)');
  });

  test('survives a reload when it was begun over a puzzle link', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/p/${HARD}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await typeIn(page, 4);
    // the address no longer names the puzzle from before, which a reload would reopen over the entry
    expect(new URL(page.url()).pathname).toBe('/');
    await page.reload();
    await expect(panel(page)).toContainText('(4 so far)');
    await page.waitForTimeout(1500);
    await expect(panel(page)).toContainText('(4 so far)');
  });
});

test.describe('feedback', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  /** the app on the EASY board, with the welcome already seen */
  const openEasy = async (page: Page) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
  };
  const dialogOf = (page: Page, name: string) => page.getByRole('dialog', { name });
  /** presses Send and returns what went to the route and how the preview server's copy of the Worker answered */
  const sendAndRead = async (page: Page, dialog: ReturnType<typeof dialogOf>) => {
    const [request, response] = await Promise.all([
      page.waitForRequest('**/api/feedback'),
      page.waitForResponse('**/api/feedback'),
      dialog.getByRole('button', { name: 'Send', exact: true }).click()
    ]);
    return { body: JSON.parse(request.postData() ?? '{}'), status: response.status() };
  };

  test('the footer opens it; a report goes with the board and the browser, and the route takes it', async ({ page }) => {
    await openEasy(page);
    await page.locator('.app-footer').getByRole('button', { name: 'Send feedback' }).click();
    const dialog = dialogOf(page, 'Send feedback');
    await expect(dialog).toContainText('Anders Imenes');
    const send = dialog.getByRole('button', { name: 'Send', exact: true });
    // nothing written yet: nothing to send
    await expect(send).toBeDisabled();
    await dialog.getByRole('textbox').first().fill('The timer kept running while paused.');
    await dialog.getByRole('textbox', { name: /e-mail address/ }).fill('not an address');
    await expect(dialog.locator('.dialog-error')).toContainText('does not look like an e-mail address');
    await expect(send).toBeDisabled();
    await dialog.getByRole('textbox', { name: /e-mail address/ }).fill('player@example.org');
    // the board goes unless unticked; the browser's details only when ticked
    await expect(dialog.getByRole('checkbox', { name: /Include the board/ })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: /browser’s details/ })).not.toBeChecked();
    await dialog.getByRole('checkbox', { name: /browser’s details/ }).check();
    const { body, status } = await sendAndRead(page, dialog);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      kind: 'problem',
      message: 'The timer kept running while paused.',
      reply: 'player@example.org',
      lang: 'en',
      board: { puzzle: EASY }
    });
    // the hidden field goes only when something filled it in
    expect(body.website).toBeUndefined();
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(body.board.position).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(body.browser).toContain('Mozilla/');
    expect(body.hint).toBeUndefined();
    await expect(dialogOf(page, 'Thank you')).toContainText('An answer will come to the address you gave');
  });

  test('without the ticks, a report carries neither the board nor the browser', async ({ page }) => {
    await openEasy(page);
    await page.locator('.app-footer').getByRole('button', { name: 'Send feedback' }).click();
    const dialog = dialogOf(page, 'Send feedback');
    await dialog.getByRole('radio', { name: 'An idea' }).check();
    await dialog.getByRole('textbox').first().fill('A daily for each band, please.');
    // an idea does not carry the board unless asked to
    await expect(dialog.getByRole('checkbox', { name: /Include the board/ })).not.toBeChecked();
    const { body, status } = await sendAndRead(page, dialog);
    expect(status).toBe(200);
    expect(body.kind).toBe('idea');
    expect(body.board).toBeUndefined();
    expect(body.browser).toBeUndefined();
    expect(body.reply).toBeUndefined();
    await expect(dialogOf(page, 'Thank you')).toContainText('Your report is on its way.');
  });

  test('"Looks wrong?" under a hint sends the hint, the settings and whether it agrees with the solution', async ({ page }) => {
    await openEasy(page);
    await page.keyboard.press('KeyH');
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await page.getByRole('button', { name: 'Show me' }).click();
    await page.locator('.hint-panel').getByRole('button', { name: 'Looks wrong?' }).click();
    const dialog = dialogOf(page, 'Report a hint');
    await expect(dialog.locator('.report-hint code')).not.toBeEmpty();
    // a hint report may say nothing, and be sent at once: the dialog waits
    // out the two seconds the Worker takes a quicker report for a robot's
    const { body, status } = await sendAndRead(page, dialog);
    expect(status).toBe(200);
    expect(body.openedMs).toBeGreaterThanOrEqual(2000);
    expect(body.kind).toBe('hint');
    expect(body.message).toBe('');
    expect(body.hint).toMatchObject({ useUniqueness: true, markContract: 'unknown', agrees: true });
    expect(body.hint.tech).toMatch(/^[A-Z0-9_]+$/);
    expect(body.hint.text.length).toBeGreaterThan(5);
    expect(body.board.puzzle).toBe(EASY);
  });

  test('when the route cannot take it, the letter and GitHub are offered, with the report in the letter', async ({ page }) => {
    await page.route('**/api/feedback', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }));
    await openEasy(page);
    await page.locator('.app-footer').getByRole('button', { name: 'Send feedback' }).click();
    const dialog = dialogOf(page, 'Send feedback');
    await dialog.getByRole('textbox').first().fill('The board froze.');
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    const letter = dialog.getByRole('link', { name: 'feedback@sudokui.app' });
    await expect(letter).toBeVisible();
    const href = (await letter.getAttribute('href'))!;
    expect(href.startsWith('mailto:feedback@sudokui.app?subject=')).toBe(true);
    expect(decodeURIComponent(href)).toContain('The board froze.');
    await expect(dialog.getByRole('link', { name: 'GitHub' })).toHaveAttribute('href', /github\.com\/AImenes\/sudokUI\/issues/);
  });

  test('the form is locked while the report waits to go, and closing the dialog then sends nothing', async ({ page }) => {
    let posts = 0;
    await page.route('**/api/feedback', (route) => {
      posts++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
    await openEasy(page);
    await page.locator('.app-footer').getByRole('button', { name: 'Send feedback' }).click();
    const dialog = dialogOf(page, 'Send feedback');
    await dialog.getByRole('textbox').first().fill('The timer froze.');
    await dialog.getByRole('button', { name: 'Send', exact: true }).click();
    // what is shown is what goes: nothing can change while it waits
    await expect(dialog.getByRole('textbox').first()).toBeDisabled();
    await expect(dialog.getByRole('checkbox', { name: /browser’s details/ })).toBeDisabled();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(2600);
    expect(posts).toBe(0);
  });

  test('Info opens it too', async ({ page }) => {
    await openEasy(page);
    await page.getByRole('button', { name: /How to play|Info/ }).first().click();
    await dialogOf(page, 'How to play sudokUI').getByRole('button', { name: 'Send feedback' }).click();
    await expect(dialogOf(page, 'Send feedback')).toBeVisible();
    await expect(dialogOf(page, 'How to play sudokUI')).toHaveCount(0);
  });
});
