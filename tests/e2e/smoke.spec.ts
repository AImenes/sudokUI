/**
 * The app in a real browser, on the production build: the things a player
 * meets in the first minute, at a laptop size and on a phone. Run with
 * `npm run test:e2e` after `npm run build`.
 */
import { test, expect, Page } from '@playwright/test';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

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

test.describe('your path', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('opens from the top bar, names the next technique, and starts its practice', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Your path and your record' }).click();
    const dialog = page.getByRole('dialog', { name: 'Your path' });
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
});
