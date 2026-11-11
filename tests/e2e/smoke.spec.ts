/**
 * The app in a real browser, on the production build: the things a player
 * meets in the first minute, at a laptop size and on a phone. Run with
 * `npm run test:e2e` after `npm run build`.
 */
import { test, expect, Page, Locator } from '@playwright/test';
import { parseGrid, gridToString, digitsOf, bit } from '../../src/engine/board';
import { solve } from '../../src/engine/bruteForce';
import { formatPencilGrid, parsePencilGrid } from '../../src/content/textGrid';
import { readFileSync } from 'node:fs';
import { localDateKey } from '../../src/content/dailies';
import type { Daily } from '../../src/content/dailies';
import { TECHS, PRACTICE_TECHS } from '../../src/engine/ratings';
import { dialAngle, TREMOR } from '../../src/ui/RatingGauge';
import { techNames as nbNames } from '../../src/content/locales/names.nb';
import { techNames as esNames } from '../../src/content/locales/names.es';
import { HOME, HOME_LANGS, homePath } from '../../src/content/home';

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
 *  off without the page ever scrolling sideways. And the two rows that
 *  must stay one: the edit row (Undo, Redo, Erase, Swap and, on a phone,
 *  the "?"), and the folded Assist row, whose note is shown whole beside
 *  the box's name or not at all, never cut and never on a line of its own */
const controlMisfits = (page: Page) =>
  page.locator('.side').evaluate((side) => {
    const column = side.getBoundingClientRect();
    const misfits: string[] = [];
    const nameOf = (el: HTMLElement) => el.innerText.replace(/\s+/g, ' ').trim() || el.getAttribute('aria-label') || el.textContent!.trim();
    for (const el of side.querySelectorAll<HTMLElement>('.num-btn, .mode-btn, .action-row button, .menu-row button, .zone-head button')) {
      if (!el.getClientRects().length) continue; // not shown here
      const r = el.getBoundingClientRect();
      const name = nameOf(el);
      if (r.left < column.left - 0.5 || r.right > column.right + 0.5) misfits.push(`${name} sticks out of the column`);
      if (el.scrollWidth > el.clientWidth) misfits.push(`${name} overflows its button`);
    }
    const edit = [...side.querySelectorAll<HTMLElement>('.edit-row > button')].filter((el) => el.getClientRects().length);
    const first = edit[0]?.getBoundingClientRect();
    for (const el of edit.slice(1)) {
      const r = el.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      if (first && (mid < first.top || mid > first.bottom)) misfits.push(`${nameOf(el)} wraps onto a second row`);
    }
    const title = side.querySelector<HTMLElement>('.assist-zone.folded .zone-title');
    if (title) {
      const head = title.parentElement!.getBoundingClientRect();
      const box = title.getBoundingClientRect();
      const note = title.querySelector<HTMLElement>('.zone-note')!.getBoundingClientRect();
      const shown = note.top < box.bottom - 0.5;
      if (head.height > 44) misfits.push('the folded Assist row takes a second line');
      if (shown && (note.right > box.right + 0.5 || note.bottom > box.bottom + 0.5)) misfits.push('the folded Assist note is cut off');
    }
    return misfits;
  });

/** the control column at one size, in each language, with the Assist box
 *  open and, where it folds (a phone held upright), folded */
async function expectControlsFit(page: Page, width: number, height: number) {
  await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
  await page.setViewportSize({ width, height });
  for (const path of ['/', '/nb/', '/es/']) {
    await page.goto(`${path}#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    expect(await controlMisfits(page), `${path} at ${width} x ${height}`).toEqual([]);
    const fold = page.locator('.zone-fold');
    if (await fold.count()) {
      await fold.click();
      await expect(page.locator('.assist-zone.folded')).toBeVisible();
      expect(await controlMisfits(page), `${path} at ${width} x ${height}, Assist folded`).toEqual([]);
      // opened again, as the next language should find it
      await fold.click();
      await expect(page.locator('.assist-zone.folded')).toHaveCount(0);
    }
  }
}

test.describe('desktop, 1280 x 800', () => {
  test.use({ viewport: { width: 1280, height: 800 } });


  test('the Assist box does not fold at a desk, even where a phone folded it', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-assist-folded', '1'));
    await open(page);
    await expect(page.locator('.zone-fold')).toHaveCount(0);
    await expect(page.locator('.assist-zone')).not.toHaveClass(/folded/);
    await expect(page.locator('#assist-buttons').getByRole('button', { name: 'Steps' })).toBeVisible();
    await expect(page.locator('.assist-zone')).toContainText('everything in this box counts as help');
    // the "?" stays in the box's head, and the edit row keeps its words
    await expect(page.locator('.zone-head .zone-help')).toBeVisible();
    await expect(page.locator('.edit-row .zone-help')).toHaveCount(0);
    await expect(page.locator('.edit-row')).not.toHaveClass(/icons/);
  });

  test('the top bar’s name is read once: its UI tile is a picture of the name beside it', async ({ page }) => {
    await open(page);
    const brand = page.locator('header.topbar .brand');
    await expect(brand.locator('.brand-mark')).toHaveText('UI');
    await expect(brand).toMatchAriaSnapshot('- heading "sudokUI" [level=1]');
    expect(await brand.ariaSnapshot()).not.toContain('text: UI');
  });

  test('the pause card shows the app’s mark and address, inside the board', async ({ page }) => {
    await open(page);
    await page.keyboard.press('KeyP');
    const card = page.locator('.pause-card');
    // the tile shows UI; a screen reader hears the address alone
    await expect(card.locator('.pause-brand .brand-mark')).toHaveText('UI');
    await expect(card.locator('.pause-brand')).toMatchAriaSnapshot('- paragraph: sudokui.app');
    const board = (await page.locator('svg.board').boundingBox())!;
    const brand = (await card.locator('.pause-brand').boundingBox())!;
    const resume = (await card.locator('.resume-btn').boundingBox())!;
    expect(brand.y).toBeGreaterThan(resume.y + resume.height);
    expect(brand.y + brand.height).toBeLessThanOrEqual(board.y + board.height);
    await page.keyboard.press('KeyP');
    await expect(card).toHaveCount(0);
  });

  test('frames a highlighted digit in a line of centre marks as it frames a corner mark', async ({ page }) => {
    await open(page);
    const given = [...EASY].findIndex((c) => c !== '.');
    const d = EASY[given];
    const other = d === '9' ? '8' : String(Number(d) + 1);
    const [a, b] = [...EASY].flatMap((c, i) => (c === '.' ? [i] : [])).slice(0, 2);
    // a line of centre marks in one empty cell, a corner mark of the same digit in another
    const ca = await cellBox(page, a);
    await page.mouse.click(ca.x, ca.y);
    await page.keyboard.press(`Control+Digit${other}`);
    await page.keyboard.press(`Control+Digit${d}`);
    await expect(page.locator('#board-status')).toContainText('centre marks');
    const cb = await cellBox(page, b);
    await page.mouse.click(cb.x, cb.y);
    await page.keyboard.press(`Shift+Digit${d}`);
    // the given digit, selected, lights its pencilled twins: each framed
    const cg = await cellBox(page, given);
    await page.mouse.click(cg.x, cg.y);
    const frame = page.locator('svg.board rect.centre-frame');
    await expect(frame).toHaveCount(1);
    // round the digit itself, not its neighbour in the line
    const digit = page.locator('svg.board tspan', { hasText: new RegExp(`^${d}$`) }).first();
    const [f, g] = [(await frame.boundingBox())!, (await digit.boundingBox())!];
    expect(f.x).toBeLessThanOrEqual(g.x);
    expect(f.x + f.width).toBeGreaterThanOrEqual(g.x + g.width);
    expect(f.width).toBeLessThan(g.width * 2.2);
    // and nothing framed once the digit is no longer selected
    await page.keyboard.press('Escape');
    await expect(frame).toHaveCount(0);
  });
  test('a repeated digit shows in red, a right one does not', async ({ page }) => {
    await open(page);
    // r1c1 is empty; the row already holds a 3 at r1c3
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Digit3');
    const value = page.locator('svg.board text', { hasText: /^3$/ }).first();
    await expect(page.locator('svg.board text[fill="var(--danger-text)"]')).toHaveCount(1);
    // and underlined, for an eye that cannot tell this red from the
    // theme's own digits (Rosé's are red too)
    await expect(page.locator('svg.board .conflict-mark')).toHaveCount(1);
    await page.keyboard.press('Digit4'); // the true digit
    await expect(page.locator('svg.board text[fill="var(--danger-text)"]')).toHaveCount(0);
    await expect(page.locator('svg.board .conflict-mark')).toHaveCount(0);
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

  test('a number key held down with the mouse enters once, however long the press', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const undo = page.locator('.action-row button', { hasText: 'Undo' });
    const c = await cellBox(page, 40);
    await page.mouse.click(c.x, c.y);
    const key = (await page.locator('.num-btn', { hasText: '4' }).boundingBox())!;
    const hold = async (ms: number) => {
      await page.mouse.move(key.x + key.width / 2, key.y + key.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(ms);
      await page.mouse.up();
    };
    // Digit mode: a hold enters a corner mark, and a press of a second and
    // a half is no tap after it (the click that follows is the same press):
    // one step, which one Ctrl+Z takes back
    await hold(1500);
    await expect(status).toContainText('Row 5, column 5: empty, corner marks 4.');
    await page.keyboard.press('Control+KeyZ');
    await expect(status).toContainText('Row 5, column 5: empty.');
    await expect(undo).toBeDisabled();
    // Centre mode: a press is a tap however long, once
    await page.keyboard.press('KeyC');
    await hold(1500);
    await expect(status).toContainText('Row 5, column 5: empty, centre marks 4.');
    await page.keyboard.press('Control+KeyZ');
    await expect(status).toContainText('Row 5, column 5: empty.');
    await expect(undo).toBeDisabled();
    // and the keyboard on the focused key still enters, at once
    await page.locator('.num-btn', { hasText: '5' }).focus();
    await page.keyboard.press('Enter');
    await expect(status).toContainText('Row 5, column 5: empty, centre marks 5.');
  });

  test('a digit key held down enters once: the repeats the keyboard sends are ignored', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const undo = page.locator('.action-row button', { hasText: 'Undo' });
    const c = await cellBox(page, 1);
    await page.mouse.click(c.x, c.y);
    // held: the first keydown, then two the keyboard repeats
    const holdKey = async (code: string) => {
      await page.keyboard.down(code);
      await page.keyboard.down(code);
      await page.keyboard.down(code);
      await page.keyboard.up(code);
    };
    await holdKey('Digit4');
    await expect(status).toContainText('Row 1, column 2: 4.');
    await page.keyboard.press('Control+KeyZ');
    await expect(status).toContainText('Row 1, column 2: empty.');
    await expect(undo).toBeDisabled();
    await page.keyboard.press('KeyX');
    await holdKey('Digit9');
    await expect(status).toContainText('Row 1, column 2: empty, corner marks 9.');
    // S swaps once, however long it is held
    await holdKey('KeyS');
    await expect(status).toContainText('Row 1, column 2: empty, centre marks 9.');
    await page.keyboard.press('Control+KeyZ');
    await expect(status).toContainText('Row 1, column 2: empty, corner marks 9.');
    await page.keyboard.press('Control+KeyZ');
    await expect(status).toContainText('Row 1, column 2: empty.');
    await expect(undo).toBeDisabled();
  });

  test('Ctrl/Cmd with C, X and V leave the entry mode alone, and a cell with every candidate struck draws nothing', async ({ page }) => {
    await open(page);
    const active = page.locator('.mode-btn.active');
    await expect(active).toContainText('Digit');
    for (const keys of ['Control+KeyC', 'Control+KeyX', 'Control+KeyV', 'Meta+KeyC']) {
      await page.keyboard.press(keys);
      await expect(active, keys).toContainText('Digit');
    }
    // r1c1 has candidates 4 and 5; corner marks 1 2 written by hand there
    // are hidden once auto candidates are on, also when both are struck
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyX');
    await page.keyboard.press('Digit1');
    await page.keyboard.press('Digit2');
    await expect(page.locator('#board-status')).toContainText('Row 1, column 1: empty, corner marks 1 2.');
    await page.getByRole('button', { name: /Auto candidates/ }).first().click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    // corner marks alone: Auto asks what they are first
    await page.getByRole('button', { name: /They are partial notes/ }).click();
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit5');
    await expect(page.locator('#board-status')).toContainText('Row 1, column 1: empty, candidates none.');
    const drawn = await page.evaluate(({ x, y, size }) =>
      [...document.querySelectorAll('svg.board text')].filter((el) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return r.width > 0 && Math.abs(cx - x) < size / 2 && Math.abs(cy - y) < size / 2;
      }).length,
      { ...c, size: (await page.locator('svg.board').boundingBox())!.width / 9 }
    );
    expect(drawn).toBe(0);
  });

  test('Enter held on a focused number key enters once: its repeats click nothing', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const c = await cellBox(page, 40);
    await page.mouse.click(c.x, c.y);
    await page.locator('.num-btn', { hasText: '6' }).focus();
    // held: the first keydown, then three the keyboard repeats
    for (let k = 0; k < 4; k++) await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    await expect(status).toContainText('Row 5, column 5: 6.');
    await page.keyboard.press('Control+KeyZ');
    await expect(status).toContainText('Row 5, column 5: empty.');
    await expect(page.locator('.action-row button', { hasText: 'Undo' })).toBeDisabled();
  });

  test('with auto candidates on, Erase and Fill say what a press does, with Keep candidates off too', async ({ page }) => {
    // Keep candidates off, as the first prompt's "Don't fill anything" leaves it
    await page.addInitScript(() =>
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { autoOffMaterialize: false, autoOffPromptDone: true }, version: 1 }))
    );
    await open(page);
    const erase = page.locator('.action-row button', { hasText: 'Erase' });
    const fill = page.getByRole('button', { name: 'Fill candidates', exact: true });
    await expect(erase).toHaveAttribute('title', 'Erase value, then marks, then colours (Backspace) · W wipes everything');
    await page.getByRole('button', { name: /Auto candidates/ }).first().click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    await expect(erase).toHaveAttribute('title', 'Erase value, then restore struck candidates, then colours (Backspace) · W wipes everything');
    await expect(fill).toHaveAttribute('title', 'Auto candidates are on: every empty cell already shows its candidates, so there is nothing to fill.');
    await expect(page.getByRole('button', { name: /Auto candidates/ }).first()).toHaveAttribute(
      'title',
      'Turn off. Nothing is written into your marks, since Settings is set not to keep the candidates, and Ctrl+Z reverts'
    );
    await fill.click();
    await expect(page.locator('.toast').filter({ hasText: 'every empty cell already shows its candidates' })).toBeVisible();
  });

  test('Auto’s title with auto on says where switching it off writes, and the first time that it asks, in words that name the settings', async ({ page }) => {
    await open(page);
    const auto = page.getByRole('button', { name: /Auto candidates/ }).first();
    await auto.click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    await expect(auto).toHaveAttribute('title', 'Turn off. The first time, you choose whether the candidates stay as your marks, and Ctrl+Z reverts');
    await auto.click();
    const prompt = page.getByRole('dialog', { name: 'Keep your candidates?' });
    await expect(prompt).toContainText(
      'Your choice is saved in Settings as “Keep candidates when Auto is switched off” and, for a layer, as “Candidates go in”, the layer Digit and Colour mode use (Corner and Centre mode use their own). You can change both there anytime.'
    );
    await prompt.getByRole('button', { name: /Centre marks/ }).click();
    await auto.click();
    // Digit mode: the layer set in Settings; Corner and Centre mode: their own
    await expect(auto).toHaveAttribute('title', 'Turn off. The candidates are written into your centre marks, and Ctrl+Z reverts');
    await page.keyboard.press('KeyX');
    await expect(auto).toHaveAttribute('title', 'Turn off. The candidates are written into your corner marks, and Ctrl+Z reverts');
    await auto.click();
    await expect(page.locator('.toast').filter({ hasText: 'Current state written to corner marks' })).toBeVisible();
  });

  test('the mark question says what answers it by itself: a whole-board Fill, or Auto switched off into the marks', async ({ page }) => {
    await open(page);
    // r1c1 (candidates 4 5): corner marks alone
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyX');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit5');
    await page.keyboard.press('KeyZ');
    await page.getByRole('button', { name: /Hint/ }).first().click();
    await page.getByRole('button', { name: 'Use Hint' }).click();
    const question = page.getByRole('dialog', { name: 'How should hints read your pencil marks?' });
    await expect(question).toContainText(
      'Your answer is remembered for the rest of this puzzle (a whole-board Fill, or Auto switched off with its candidates kept as your marks, answers it automatically).'
    );
    await page.keyboard.press('Escape');
    // Auto, which the note no longer says answers it, asks it
    await page.getByRole('button', { name: /Auto candidates/ }).first().click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    await expect(page.getByRole('dialog', { name: 'How should Auto candidates read your corner marks?' })).toBeVisible();
  });

  test('Check asks the mark question only when corner marks change what it checks, in words of what it then does', async ({ page }) => {
    await open(page);
    const toast = page.locator('.toast');
    const check = page.getByRole('button', { name: 'Check', exact: true });
    // centre marks alone: r1c1 (candidates 4 5, solution 4) with only a 5
    let c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyC');
    await page.keyboard.press('Digit5');
    await check.click();
    await page.getByRole('button', { name: 'Use Check' }).click();
    await expect(toast.filter({ hasText: '1 problem found' })).toBeVisible();
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    // a corner list in r1c2 (candidates 4 5 7 8) that has lost its 8
    c = await cellBox(page, 1);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyX');
    for (const d of ['Digit4', 'Digit5', 'Digit7']) await page.keyboard.press(d);
    await check.click();
    await expect(page.getByRole('dialog', { name: 'How should Check read your pencil marks?' })).toBeVisible();
    await expect(page.getByRole('button', { name: /They are partial notes/ })).toContainText('Check passes over your corner marks');
    const complete = page.getByRole('button', { name: /They are my remaining candidates/ });
    await expect(complete).toContainText('Check reads the corner and centre marks of a cell together as its list');
    await complete.click();
    await expect(toast.filter({ hasText: '2 problems found' })).toBeVisible();
  });

  test('Auto on asks first when a cell has corner marks alone, and keeps a corner list’s eliminations once they are complete', async ({ page }) => {
    await open(page);
    // r1c2 (candidates 4 5 7 8): a corner list without the 5
    const c = await cellBox(page, 1);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyX');
    for (const d of ['Digit4', 'Digit7', 'Digit8']) await page.keyboard.press(d);
    await page.getByRole('button', { name: /Auto candidates/ }).first().click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    await expect(page.getByRole('dialog', { name: 'How should Auto candidates read your corner marks?' })).toBeVisible();
    await page.getByRole('button', { name: /They are my remaining candidates/ }).click();
    await expect(page.locator('#board-status')).toContainText('Row 1, column 2: empty, candidates 4 7 8.');
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

  test('Space presses a button reached with Tab; after a mouse click on a number key it still changes the mode', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const mode = page.locator('.mode-btn.active');
    const gear = page.getByRole('button', { name: 'Settings' });
    for (let i = 0; i < 40 && !(await gear.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(gear).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(mode).toContainText('Digit');
    // focus is back on the gear, brought there by a key: Space presses it again
    await expect(gear).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    // a number key clicked with the mouse keeps focus, and Space is the
    // mode's as before: the 5 is not pressed a second time, which would
    // take it out again
    const c = await cellBox(page, 40);
    await page.mouse.click(c.x, c.y);
    await page.locator('.num-btn', { hasText: '5' }).click();
    await expect(status).toContainText('Row 5, column 5: 5.');
    await page.keyboard.press('Space');
    await expect(mode).toContainText('Corner');
    await expect(status).toContainText('Row 5, column 5: 5.');
    // the board itself, with focus: Space cycles the mode
    await page.locator('svg.board').focus();
    await page.keyboard.press('Space');
    await expect(mode).toContainText('Centre');
  });

  test('Space after Escape, back on a button the mouse pressed, changes the mode: Settings, the hint question and the trainer stay shut', async ({ page }) => {
    await open(page);
    const mode = page.locator('.mode-btn.active');
    const dialogs = page.getByRole('dialog');
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    // Settings, opened with the mouse and shut with Escape, which gives
    // focus back to the gear
    const gear = page.getByRole('button', { name: 'Settings' });
    await gear.click();
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogs).toHaveCount(0);
    await expect(gear).toBeFocused();
    await page.keyboard.press('Space');
    await expect(mode).toContainText('Corner');
    await expect(dialogs).toHaveCount(0);
    // the question the Hint button asks
    await page.getByRole('button', { name: /^Hint/ }).first().click();
    await expect(page.getByRole('dialog', { name: 'Use Hint?' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialogs).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(mode).toContainText('Centre');
    await expect(dialogs).toHaveCount(0);
    // the chain trainer, opened and left: Space does not open it again,
    // where the next digits would go to the chain
    await page.getByRole('button', { name: /Chain/ }).first().click();
    await page.getByRole('button', { name: 'Use Chain' }).click();
    const panel = page.getByRole('region', { name: 'Build a chain' });
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await page.keyboard.press('Space');
    await expect(mode).toContainText('Colour');
    await expect(panel).toHaveCount(0);
  });

  test('Ctrl+Z undoes on a German and a French keyboard, and the French Z is no wipe', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const undo = page.locator('.action-row button', { hasText: 'Undo' });
    // a key as that keyboard sends it: its US place (code) and the letter
    // printed on it (key); then Ctrl let go
    const send = (code: string, key: string, mods: { ctrlKey?: boolean; metaKey?: boolean } = {}) =>
      page.evaluate(
        ({ code, key, mods }) => {
          const at = document.activeElement ?? document.body;
          at.dispatchEvent(new KeyboardEvent('keydown', { code, key, ...mods, bubbles: true, cancelable: true }));
          at.dispatchEvent(new KeyboardEvent('keyup', { code, key, ...mods, bubbles: true, cancelable: true }));
          at.dispatchEvent(new KeyboardEvent('keyup', { code: 'ControlLeft', key: 'Control', bubbles: true, cancelable: true }));
        },
        { code, key, mods }
      );
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    for (const [layout, code, mods] of [
      ['QWERTZ, Ctrl', 'KeyY', { ctrlKey: true }],
      ['AZERTY, Ctrl', 'KeyW', { ctrlKey: true }],
      ['AZERTY, Cmd', 'KeyW', { metaKey: true }]
    ] as const) {
      await page.keyboard.press('Digit4');
      await expect(status).toContainText('Row 1, column 1: 4.');
      await send(code, 'z', mods);
      await expect(status, layout).toContainText('Row 1, column 1: empty.');
      await expect(undo, layout).toBeDisabled();
    }
    // the key printed Z on a French keyboard (the US W's place) is Digit
    // mode, as Z is: corner marks stay
    const d = await cellBox(page, 1);
    await page.mouse.click(d.x, d.y);
    await page.keyboard.press('KeyX');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit8');
    await expect(status).toContainText('Row 1, column 2: empty, corner marks 4 8.');
    await send('KeyW', 'z');
    await expect(page.locator('.mode-btn.active')).toContainText('Digit');
    await expect(status).toContainText('Row 1, column 2: empty, corner marks 4 8.');
  });

  test('the mode buttons, Auto candidates and the Colour keys say their state and colour', async ({ page }) => {
    await open(page);
    await expect(page.getByRole('button', { name: 'Digit Z', exact: true, pressed: true })).toBeVisible();
    await page.keyboard.press('KeyX');
    await expect(page.getByRole('button', { name: 'Corner X', exact: true, pressed: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Digit Z', exact: true, pressed: false })).toBeVisible();
    await page.keyboard.press('KeyV');
    await expect(page.getByRole('button', { name: 'Colour V', exact: true, pressed: true })).toBeVisible();
    const words = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink', 'grey'];
    for (const [k, word] of words.entries()) {
      await expect(page.getByRole('button', { name: `Colour ${k + 1}, ${word}`, exact: true })).toBeVisible();
    }
    await page.keyboard.press('KeyZ');
    await expect(page.getByRole('button', { name: '1', exact: true })).toBeVisible();
    const auto = page.getByRole('button', { name: 'Auto candidates', exact: true });
    await expect(auto).toHaveAttribute('aria-pressed', 'false');
    await auto.click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    await expect(auto).toHaveAttribute('aria-pressed', 'true');
  });

  test('Escape on the mark question raised from Settings closes the question alone', async ({ page }) => {
    await open(page);
    // corner marks in r1c1, so the ring must ask how to read them
    const c = await cellBox(page, 0);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyX');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit5');
    await page.getByRole('button', { name: 'Settings' }).click();
    const ring = page.getByRole('switch', { name: /Highlight cells with two candidates/ });
    await ring.click();
    const question = page.getByRole('dialog', { name: 'How should the board read your pencil marks?' });
    await expect(question).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(question).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
    await expect(ring).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
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
    // a link inside one cell draws no arrow: its two marks say it
    // (docs/hint-drawing.md G12), and the start dot shows where it begins
    expect(await page.locator('svg.board .chain-arrows g path').count()).toBe(0);
    await expect(page.locator('svg.board .chain-start')).toHaveCount(1);
    await page.keyboard.press('Backspace');
    await expect(panel).toContainText('1 candidate');
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
  });

  test('from the keyboard: focus goes into it, a typed digit is the selected cell’s candidate, and Done brings focus back', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const chain = page.getByRole('button', { name: /Chain/ }).first();
    await chain.focus();
    await page.keyboard.press('Enter');
    const use = page.getByRole('button', { name: 'Use Chain' });
    for (let i = 0; i < 10 && !(await use.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    const panel = page.getByRole('region', { name: 'Build a chain' });
    await expect(panel).toBeFocused();
    // from the centre to r1c1 (candidates 4 and 5) with the arrow keys
    for (let k = 0; k < 4; k++) {
      await page.keyboard.press('ArrowUp');
      await page.keyboard.press('ArrowLeft');
    }
    await expect(status).toContainText('Row 1, column 1: empty, candidates 4 5.');
    await page.keyboard.press('Digit4');
    await expect(panel).toContainText('starts the chain');
    await expect(panel).toContainText('1 candidate');
    await page.keyboard.press('Digit5');
    await expect(panel).toContainText('Strong link');
    // nothing went onto the board
    await expect(status).toContainText('Row 1, column 1: empty, candidates 4 5.');
    await page.keyboard.press('Shift+Tab');
    const done = panel.getByRole('button', { name: 'Done' });
    for (let i = 0; i < 10 && !(await done.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(chain).toBeFocused();
    await expect(status).toContainText('Row 1, column 1: empty.');
  });

  test('on a practice puzzle, Build it yourself has focus again when the trainer closes', async ({ page }) => {
    await openPractice(page);
    const build = page.getByRole('button', { name: 'Build it yourself' });
    const panel = page.getByRole('region', { name: 'Build a chain' });
    // the button is hidden while the trainer is open: the one that comes
    // back takes focus, after Escape and after Done
    await build.focus();
    await page.keyboard.press('Enter');
    await expect(panel).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(build).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(panel).toBeFocused();
    await panel.getByRole('button', { name: 'Done' }).focus();
    await page.keyboard.press('Enter');
    await expect(panel).toHaveCount(0);
    await expect(build).toBeFocused();
  });

  test('a reload while it is open closes it as Done does: auto candidates off, the player’s marks back', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const auto = page.getByRole('button', { name: /Auto candidates/ }).first();
    // r1c2 (candidates 4 5 7 8): two corner marks of the player's
    const c = await cellBox(page, 1);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('KeyX');
    await page.keyboard.press('Digit4');
    await page.keyboard.press('Digit5');
    await page.keyboard.press('KeyZ');
    await expect(status).toContainText('Row 1, column 2: empty, corner marks 4 5.');
    await page.getByRole('button', { name: /Chain/ }).first().click();
    await page.getByRole('button', { name: 'Use Chain' }).click();
    await expect(page.getByRole('region', { name: 'Build a chain' })).toBeVisible();
    await expect(auto).toHaveClass(/toggled/);
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Build a chain' })).toHaveCount(0);
    await expect(auto).not.toHaveClass(/toggled/);
    // the game was under way when the page went, so it comes back paused
    await page.getByRole('button', { name: 'Resume game' }).click();
    await page.mouse.click(c.x, c.y);
    await expect(status).toContainText('Row 1, column 2: empty, corner marks 4 5.');
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
    // a colouring (docs/hint-drawing-colouring.md): the full view draws its
    // argument, dashed lines with no head and no start dot, and no tie
    const shafts = page.locator('svg.board .chain-arrows .chain-shaft');
    const ties = page.locator('svg.board .chain-arrows .chain-tie');
    const heads = page.locator('svg.board .chain-arrows polygon');
    const all = await shafts.count();
    expect(all).toBeGreaterThanOrEqual(1);
    expect(all).toBeLessThanOrEqual(3);
    await expect(page.locator('svg.board .chain-arrows .chain-shaft.weak-tie')).toHaveCount(all);
    await expect(heads).toHaveCount(0);
    await expect(ties).toHaveCount(0);
    await expect(page.locator('svg.board .chain-start')).toHaveCount(0);
    await expect(page.locator('svg.board .walk-badge')).toHaveCount(0);
    await page.getByRole('button', { name: 'Walk through it' }).click();
    await expect(page.locator('.hint-walk-count')).toContainText('1 of');
    const first = await page.locator('.hint-walk-text').innerText();
    expect(first.length).toBeGreaterThan(10);
    // the cluster's frame: its ties, and no line of the argument yet
    expect(await ties.count()).toBeGreaterThan(0);
    await expect(shafts).toHaveCount(0);
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.hint-walk-count')).toContainText('2 of');
    // the argument's first line, wearing its frame's number, and the ties gone
    await expect(shafts).toHaveCount(1);
    await expect(ties).toHaveCount(0);
    await expect(heads).toHaveCount(0);
    await expect(page.locator('svg.board .walk-badge')).toHaveText(['2']);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.hint-walk-count')).toContainText('1 of');
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(page.locator('.hint-walk-count')).toHaveCount(0);
    await expect(shafts).toHaveCount(all);
  });

  test('walks a directed chain: each frame adds its arrow and its number, and Show all keeps every arrow', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sudokui-welcomed', '1');
    });
    await page.goto('/#practice=X_CHAIN');
    await expect(page.locator('.practice-bar')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: /Hint/ }).first().click();
    const use = page.getByRole('button', { name: 'Use Hint' });
    if (await use.count()) await use.click();
    await page.getByRole('button', { name: 'Show me' }).click();
    const shafts = page.locator('svg.board .chain-arrows .chain-shaft');
    // a head is drawn in the arrow's ink, over a halo of its own
    const heads = page.locator('svg.board .chain-arrows polygon[fill="var(--hint-arrow)"]');
    const badges = page.locator('svg.board .walk-badge');
    // the full view: every arrow, a head on all but the shortest, one start
    // dot, and no walk numbers
    const all = await shafts.count();
    expect(all).toBeGreaterThan(1);
    const allHeads = await heads.count();
    expect(allHeads).toBeGreaterThan(0);
    await expect(page.locator('svg.board .chain-start')).toHaveCount(1);
    await expect(badges).toHaveCount(0);
    await page.getByRole('button', { name: 'Walk through it' }).click();
    // frame by frame, one more arrow and its number; the dot stays
    for (let k = 1; k <= all; k++) {
      await expect(page.locator('.hint-walk-count')).toContainText(`${k} of`);
      await expect(shafts).toHaveCount(k);
      await expect(badges).toHaveText(Array.from({ length: k }, (_, i) => String(i + 1)));
      await expect(page.locator('svg.board .chain-start')).toHaveCount(1);
      expect(await heads.count()).toBeLessThanOrEqual(k);
      await page.keyboard.press('ArrowRight');
    }
    await page.getByRole('button', { name: 'Show all' }).click();
    await expect(shafts).toHaveCount(all);
    await expect(heads).toHaveCount(allHeads);
    await expect(badges).toHaveCount(0);
  });
});

/**
 * A grouped chain on the board (docs/hint-drawing-sets.md, stage 5): the
 * stored AIC with Groups, loaded as a pencil-mark grid at its position, ends
 * at a TRUE group, its two members pale "one of these" squares on a bar in
 * the true ink, drawn from the walk frame of the link that reaches it
 */
async function showGroupedChain(page: Page) {
  const examples = JSON.parse(new TextDecoder().decode(readFileSync('src/content/examples.json')));
  const ex = examples.AIC_GROUPED as { values: string; cands: number[] };
  await open(page);
  const cells = Array.from({ length: 81 }, (_, i) => ({ value: Number(ex.values[i]), corner: 0, center: Number(ex.values[i]) ? 0 : ex.cands[i], excluded: 0 }));
  await page.locator('.menu-row button', { hasText: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import a puzzle' });
  await dialog.locator('textarea').fill(formatPencilGrid(cells, false, 'exhaustive'));
  await dialog.getByRole('button', { name: 'Load puzzle' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /Hint/ }).first().click();
  const use = page.getByRole('button', { name: 'Use Hint' });
  if (await use.count()) await use.click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.locator('.hint-tech strong')).toHaveText('AIC with Groups');
}

for (const [name, size] of [
  ['desktop', { viewport: { width: 1280, height: 1000 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(`a grouped chain, ${name}`, () => {
    test.use(size);

    test("draws its TRUE group as squares on a bar in the true ink, from the frame that reaches it", async ({ page }) => {
      await showGroupedChain(page);
      const squares = page.locator('svg.board rect.hint-one-of');
      const bars = page.locator('svg.board .hint-group-bar');
      await expect(squares).toHaveCount(2);
      await expect(bars).toHaveCount(1);
      await expect(bars).toHaveAttribute('stroke', 'var(--hint-place-ink)');
      // under the marks, cut out by the digits as the arrows are, and wider on a phone (G14a)
      await expect(page.locator('svg.board g.hint-group-bars')).toHaveAttribute('mask', /^url\(#/);
      expect(await bars.evaluate((el) => getComputedStyle(el).strokeWidth)).toBe(name === 'phone' ? '4.5px' : '3px');
      // never a true disc: the squares' fill is the pale "one of these" one, and the legend names them by shape
      await expect(squares.first()).toHaveAttribute('fill', 'var(--hint-one-of)');
      await expect(page.locator('.hint-legend li', { hasText: 'squares joined by a bar' }).locator('i.swatch-one-of-bar')).toHaveCount(1);
      await expect(page.locator('.hint-legend')).toContainText('squares joined by a bar: one of them is true, if the first candidate (by the small dot) is false');
      await expect(page.locator('.hint-legend')).not.toContainText('each group');
      // the walk: no bar until the last link reaches the group, then the squares on their bar
      await page.getByRole('button', { name: 'Walk through it' }).click();
      await expect(page.locator('.hint-walk-count')).toContainText('1 of 8');
      await expect(bars).toHaveCount(0);
      await expect(squares).toHaveCount(0);
      for (let k = 2; k <= 7; k++) await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-count')).toContainText('7 of 8');
      await expect(bars).toHaveCount(1);
      await expect(squares).toHaveCount(2);
      await expect(page.locator('.hint-walk-text')).toHaveText('Strong link on 8 in box 8: r8c5, r8c6 and r9c6 are its only 8s, so if r8c5 is not 8, one of r8c6, r9c6 is.');
    });
  });
}

/**
 * An almost locked set on the board (docs/hint-drawing-sets.md, stages 6
 * and 7): the stored AIC with ALS, loaded as a pencil-mark grid at its
 * position, goes through set A, r7c8 and r8c8: a tile in each cell in its
 * tint, outlined in its ink, wider on a phone, with a lettered tab, drawn
 * from the walk frame that introduces the set, before the link that reaches
 * it; the link inside A draws no arrow
 */
async function showAlsChain(page: Page) {
  const examples = JSON.parse(new TextDecoder().decode(readFileSync('src/content/examples.json')));
  const ex = examples.AIC_ALS as { values: string; cands: number[] };
  await open(page);
  const cells = Array.from({ length: 81 }, (_, i) => ({ value: Number(ex.values[i]), corner: 0, center: Number(ex.values[i]) ? 0 : ex.cands[i], excluded: 0 }));
  await page.locator('.menu-row button', { hasText: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import a puzzle' });
  await dialog.locator('textarea').fill(formatPencilGrid(cells, false, 'exhaustive'));
  await dialog.getByRole('button', { name: 'Load puzzle' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /Hint/ }).first().click();
  const use = page.getByRole('button', { name: 'Use Hint' });
  if (await use.count()) await use.click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.locator('.hint-tech strong')).toHaveText('AIC with ALSs');
}

for (const [name, size] of [
  ['desktop', { viewport: { width: 1280, height: 1000 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(`an almost locked set, ${name}`, () => {
    test.use(size);

    test('draws a lettered tile in each cell of the set, from the frame that introduces it, and no arrow inside it', async ({ page }) => {
      await showAlsChain(page);
      const tiles = page.locator('svg.board g.hint-tile');
      const tabs = page.locator('svg.board g.hint-tab');
      await expect(tiles).toHaveCount(2);
      await expect(tabs).toHaveCount(2);
      await expect(tabs.locator('text')).toHaveText(['A', 'A']);
      // the tab: one rect in the set's ink, its keyline drawn apart, under the tile's outline
      await expect(tabs.first().locator('rect')).toHaveCount(1);
      await expect(tabs.first().locator('rect')).toHaveAttribute('fill', 'var(--hint-set-1-ink)');
      await expect(page.locator('svg.board g.hint-tab-key')).toHaveCount(2);
      // the outline drawn for the board's size: 2.5 units on a desktop, 4.5 on a phone, and the tab 26 units across there
      const shownOutline = tiles.first().locator(name === 'phone' ? 'rect.hint-tile-small' : 'rect.hint-tile-wide');
      await expect(shownOutline).toBeVisible();
      await expect(tiles.first().locator(name === 'phone' ? 'rect.hint-tile-wide' : 'rect.hint-tile-small')).toBeHidden();
      expect(await shownOutline.evaluate((el) => getComputedStyle(el).strokeWidth)).toBe(name === 'phone' ? '4.5px' : '2.5px');
      const scale = await tabs.first().evaluate((el) => getComputedStyle(el).transform);
      if (name === 'phone') expect(scale).toMatch(/^matrix\(1\.444\d*, 0, 0, 1\.444\d*, 0, 0\)$/);
      else expect(scale).toBe('none');
      // the tab's keyline grows with it
      expect(await page.locator('svg.board g.hint-tab-key').first().evaluate((el) => getComputedStyle(el).transform)).toBe(scale);
      // four of its five links drawn: the one inside the set draws nothing
      await expect(page.locator('svg.board .chain-shaft')).toHaveCount(4);
      await expect(page.locator('.hint-legend li', { hasText: 'lettered cells' }).locator('i.swatch-set-1')).toHaveCount(1);
      // the walk: no tile until set A's own frame, which introduces it before the link that reaches it, then its tiles and tabs
      await page.getByRole('button', { name: 'Walk through it' }).click();
      await expect(page.locator('.hint-walk-count')).toContainText('1 of 7');
      await expect(tiles).toHaveCount(0);
      await expect(tabs).toHaveCount(0);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-count')).toContainText('2 of 7');
      await expect(page.locator('.hint-walk-text')).toHaveText(
        'Set A: the 2 cells r7c8, r8c8 of column 8 hold only 4, 8 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.'
      );
      await expect(tiles).toHaveCount(2);
      await expect(tabs).toHaveCount(2);
      // no link added: only the first arrow, with its number; the next frame adds the link into the set, numbered 3
      await expect(page.locator('svg.board .walk-badge')).toHaveText(['1']);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-text')).toHaveText('If r2c8 is 8, set A holds no 8: every 8 of A sees r2c8 in column 8.');
      await expect(page.locator('svg.board .walk-badge')).toHaveText(['1', '3']);
    });
  });
}

/**
 * The ALS patterns as chains, and Death Blossom (docs/hint-drawing-sets.md,
 * stage 8), each loaded as a pencil-mark grid at its position: the stored
 * ALS-XZ and Death Blossom, and the set fixture's two ALS-XY-Chains whose
 * sets share a cell, the one that derives and the one that clashes
 */
async function showAt(page: Page, at: { values: string; cands: number[] }, name: string) {
  await open(page);
  const cells = Array.from({ length: 81 }, (_, i) => ({ value: Number(at.values[i]), corner: 0, center: Number(at.values[i]) ? 0 : at.cands[i], excluded: 0 }));
  await page.locator('.menu-row button', { hasText: 'Import' }).click();
  const dialog = page.getByRole('dialog', { name: 'Import a puzzle' });
  await dialog.locator('textarea').fill(formatPencilGrid(cells, false, 'exhaustive'));
  await dialog.getByRole('button', { name: 'Load puzzle' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: /Hint/ }).first().click();
  const use = page.getByRole('button', { name: 'Use Hint' });
  if (await use.count()) await use.click();
  await page.getByRole('button', { name: 'Show me' }).click();
  await expect(page.locator('.hint-tech strong')).toHaveText(name);
}

const storedExample = (tech: string) => JSON.parse(new TextDecoder().decode(readFileSync('src/content/examples.json')))[tech] as { values: string; cands: number[] };
const namedPosition = (id: string) =>
  JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json'))).named[id].position as { values: string; cands: number[] };

/** the letters of the tabs drawn in a cell of the board */
const tabsIn = (page: Page, cell: number) =>
  page.locator('svg.board g.hint-tab').evaluateAll((tabs, cell) => {
    const out: string[] = [];
    for (const tab of tabs) {
      const m = /translate\(([\d.]+) ([\d.]+)\)/.exec(tab.parentElement?.getAttribute('transform') ?? '');
      if (!m) continue;
      const [col, row] = [Math.floor((Number(m[1]) - 4) / 100), Math.floor((Number(m[2]) - 4) / 100)];
      if (row * 9 + col === cell) out.push(tab.querySelector('text')?.textContent ?? '');
    }
    return out.sort();
  }, cell);

for (const [name, size] of [
  ['desktop', { viewport: { width: 1280, height: 1000 } }],
  ['phone', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }]
] as const) {
  test.describe(`the ALS patterns as chains, and Death Blossom, ${name}`, () => {
    test.use(size);
    const shafts = (page: Page) => page.locator('svg.board .chain-shaft');
    const heads = (page: Page) => page.locator('svg.board .chain-arrows polygon[fill="var(--hint-arrow)"]');
    const trueDiscs = (page: Page) => page.locator('svg.board circle[fill="var(--hint-place)"]');
    const falseRings = (page: Page) => page.locator('svg.board circle.hint-ring[stroke="var(--hint-false)"]');
    const squares = (page: Page) => page.locator('svg.board rect.hint-one-of');

    test('walks an ALS-XZ in six frames: two lettered sets, one dashed arrow between them, a start dot, no arrow inside a set', async ({ page }) => {
      await showAt(page, storedExample('ALS_XZ'), 'ALS-XZ');
      const tiles = page.locator('svg.board g.hint-tile');
      const tabs = page.locator('svg.board g.hint-tab');
      // sets A and B, a tile and a tab in each of their two cells
      await expect(tiles).toHaveCount(4);
      await expect(tabs).toHaveCount(4);
      expect((await tabs.locator('text').allTextContents()).sort()).toEqual(['A', 'A', 'B', 'B']);
      // one arrow, the restricted common, dashed with its head; the locks inside A and B draw nothing
      await expect(shafts(page)).toHaveCount(1);
      await expect(shafts(page)).toHaveClass('chain-shaft weak');
      await expect(heads(page)).toHaveCount(1);
      await expect(page.locator('svg.board .chain-start')).toHaveCount(1);
      // A's 5s false, its 1 and B's 5 true, B's 1 false; no role
      await expect(falseRings(page)).toHaveCount(3);
      await expect(trueDiscs(page)).toHaveCount(2);
      await expect(page.locator('svg.board circle[fill="var(--hint-primary)"], svg.board circle[fill="var(--hint-secondary)"]')).toHaveCount(0);
      await expect(page.locator('.hint-legend')).toContainText('true, if set A holds no 5 (by the small dot)');
      // the walk: set A, its lock, set B, the restricted common, B's lock, the conclusion
      await page.getByRole('button', { name: 'Walk through it' }).click();
      await expect(page.locator('.hint-walk-count')).toContainText('1 of 6');
      await expect(page.locator('.hint-walk-text')).toHaveText(
        'Set A: the 2 cells r8c2, r9c1 of box 7 hold only 1, 5 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.'
      );
      await expect(tiles).toHaveCount(2);
      await expect(shafts(page)).toHaveCount(0);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-text')).toHaveText('If set A holds no 5, its other 2 digits fill its 2 cells, so r8c2 must be 1.');
      await expect(shafts(page)).toHaveCount(0);
      await expect(page.locator('svg.board .chain-start')).toHaveCount(1);
      await page.keyboard.press('ArrowRight');
      await expect(tiles).toHaveCount(4);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-text')).toHaveText('In row 8, every 1 of set A sees every 1 of set B: if r8c2 is 1, r8c9 cannot be 1.');
      await expect(shafts(page)).toHaveCount(1);
      await expect(page.locator('svg.board .walk-badge')).toHaveText(['4']);
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-count')).toContainText('6 of 6');
      await expect(page.locator('.hint-walk-text')).toHaveText(
        'Set A or set B holds a 5: if A holds none, B holds one. Each removed 5 sees every 5 of both. So 5 is removed from r7c1.'
      );
    });

    test("draws a Death Blossom with three headless dashed ties from its stem, no start dot and no truth, and walks it branch by branch", async ({ page }) => {
      await showAt(page, storedExample('DEATH_BLOSSOM'), 'Death Blossom');
      const ties = page.locator('svg.board .chain-shaft.weak-tie');
      await expect(ties).toHaveCount(3);
      await expect(shafts(page)).toHaveCount(3);
      await expect(heads(page)).toHaveCount(0);
      await expect(page.locator('svg.board .chain-start')).toHaveCount(0);
      await expect(trueDiscs(page)).toHaveCount(0);
      await expect(falseRings(page)).toHaveCount(0);
      await expect(squares(page)).toHaveCount(0);
      // the stem and each petal's stem digit gold, every petal's 4 blue; the petals lettered, the stem not
      await expect(page.locator('svg.board circle[fill="var(--hint-secondary)"]')).toHaveCount(6);
      await expect(page.locator('svg.board circle[fill="var(--hint-primary)"]')).toHaveCount(3);
      expect(await tabsIn(page, 7 * 9 + 8)).toEqual([]);
      expect((await page.locator('svg.board g.hint-tab text').allTextContents()).sort()).toEqual(['A', 'B', 'B', 'C']);
      await expect(page.locator('.hint-legend li', { hasText: 'dashed line' }).locator('i.swatch-weak-tie')).toHaveCount(1);
      await expect(page.locator('.hint-legend')).not.toContainText('small dot');
      // the walk: the stem alone, then a tie a branch, numbered by its frame
      await page.getByRole('button', { name: 'Walk through it' }).click();
      await expect(page.locator('.hint-walk-count')).toContainText('1 of 6');
      await expect(page.locator('.hint-walk-text')).toHaveText('The stem r8c9 holds 2, 5 and 7: one of them is true, and each has a petal.');
      await expect(ties).toHaveCount(0);
      await expect(page.locator('svg.board circle[fill="var(--hint-secondary)"]')).toHaveCount(3);
      await page.keyboard.press('ArrowRight');
      await expect(ties).toHaveCount(1);
      await expect(page.locator('svg.board .walk-badge')).toHaveText(['2']);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.hint-walk-text')).toContainText("Petal B, for the stem's 5:");
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('svg.board .walk-badge')).toHaveText(['2', '4']);
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('svg.board .walk-badge')).toHaveText(['2', '4', '5']);
      await expect(page.locator('svg.board .chain-start')).toHaveCount(0);
    });

    test("draws an ALS-XY-Chain whose set A lies inside its set D as the chain it derives: A's tile and D's dashed outline on r7c7, both tabs", async ({ page }) => {
      await showAt(page, namedPosition('shared cells that derive, step 25, ALS_XY_CHAIN'), 'ALS-XY-Chain');
      const r7c7 = 6 * 9 + 6;
      expect(await tabsIn(page, r7c7)).toEqual(['A', 'D']);
      // seven tiles for four sets on seven cells, one of them D's dashed outline inside A's on r7c7
      await expect(page.locator('svg.board g.hint-tile')).toHaveCount(7);
      await expect(page.locator('svg.board g.hint-tile').filter({ has: page.locator('rect[stroke-dasharray="6 4"]') })).toHaveCount(1);
      // its truth drawn: three dashed arrows between the sets, a start dot, true discs, false rings and r7c5's 1 a square
      await expect(shafts(page)).toHaveCount(3);
      await expect(page.locator('svg.board .chain-start')).toHaveCount(1);
      await expect(trueDiscs(page)).toHaveCount(3);
      await expect(falseRings(page)).toHaveCount(4);
      await expect(squares(page)).toHaveCount(1);
      await expect(page.locator('.hint-legend')).toContainText('true, if set A holds no 1 (by the small dot)');
    });

    test("draws an ALS-XY-Chain whose sets share cells and whose chain clashes with no truth: tiles, tabs, arrows, the removal and its reason, A's 8s, a legend naming no truth", async ({ page }) => {
      await showAt(page, namedPosition('shared cells that clash, step 15, ALS_XY_CHAIN'), 'ALS-XY-Chain');
      // D (r4c4, r6c4) inside A (r1c4, r4c4, r5c4, r6c4): both tabs on each shared cell
      expect(await tabsIn(page, 3 * 9 + 3)).toEqual(['A', 'D']);
      expect(await tabsIn(page, 5 * 9 + 3)).toEqual(['A', 'D']);
      await expect(page.locator('svg.board g.hint-tile')).toHaveCount(9);
      await expect(shafts(page)).toHaveCount(3);
      await expect(page.locator('svg.board circle.hint-ring[stroke="var(--hint-elim)"]')).toHaveCount(1);
      // no truth mark, no start dot, and a legend that names no truth; the reason r3c4's 8 goes, the 8s of A
      // (r1c4, r4c4, r5c4, r6c4), the pattern's discs (readability report M15), and no other role
      await expect(trueDiscs(page)).toHaveCount(0);
      await expect(falseRings(page)).toHaveCount(0);
      await expect(squares(page)).toHaveCount(0);
      await expect(page.locator('svg.board circle[fill="var(--hint-primary)"]')).toHaveCount(4);
      await expect(page.locator('svg.board circle[fill="var(--hint-secondary)"]')).toHaveCount(0);
      await expect(page.locator('svg.board .chain-start')).toHaveCount(0);
      // and the dashed outline of a cell of two sets, drawn like it
      await expect(page.locator('.hint-legend li')).toHaveText([/^remove/, /^the 8s of set A$/, /^lettered cells/, /^dashed outline/]);
      await expect(page.locator('.hint-legend li', { hasText: 'dashed outline' }).locator('i.swatch-shared')).toHaveCount(1);
    });
  });
}

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

  test('in Centre mode a held number key is a tap: it takes the centre mark away, and puts no corner mark in', async ({ page }) => {
    await open(page);
    const c = await cellBox(page, 40);
    await page.touchscreen.tap(c.x, c.y);
    await page.locator('.mode-btn', { hasText: 'Centre' }).tap();
    const key = (await page.locator('.num-btn', { hasText: '4' }).boundingBox())!;
    const at = { x: key.x + key.width / 2, y: key.y + key.height / 2 };
    await page.touchscreen.tap(at.x, at.y);
    await expect(page.locator('#board-status')).toContainText('centre marks 4');
    // a slow tap, well past the hold that enters a corner mark in Digit mode
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.waitForTimeout(900);
    await expect(page.locator('.num-btn.held-corner')).toHaveCount(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#board-status')).toContainText('Row 5, column 5: empty.');
    await expect(page.locator('#board-status')).not.toContainText('corner marks');
  });

  /**
   * Number-first entry on a phone (the owner's report of 4 November 2026):
   * a tap on a cell selects it as it enters the armed digit, and the armed
   * key then has to put the digit down, whatever is selected, or a phone,
   * with no Escape, has no way out
   */
  test('an armed digit: a tap on a cell enters it there, and a tap on the armed key puts it down, entering nothing', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const armed = page.locator('.num-btn.armed');
    const one = page.locator('.num-btn', { hasText: /^1$/ });
    await expect(status).toHaveText('No cell selected.');
    await one.tap();
    await expect(armed).toHaveText('1');
    await expect(one).toHaveAttribute('aria-pressed', 'true');
    // r9c1, empty: the tap enters the 1 and selects the cell
    const c = await cellBox(page, 72);
    await page.touchscreen.tap(c.x, c.y);
    await expect(status).toHaveText('Row 9, column 1: 1.');
    await expect(armed).toHaveText('1');
    await expect(one).toHaveAttribute('title', /1 is armed: .*Tap 1 again to put it down, whatever is selected/);
    // the way out: the armed key, with the cell still selected
    await one.tap();
    await expect(armed).toHaveCount(0);
    await expect(status).toHaveText('Row 9, column 1: 1.');
    // a plain selection now: a tap on the cell lets go of it
    await page.touchscreen.tap(c.x, c.y);
    await expect(status).toHaveText('No cell selected.');
    await expect(armed).toHaveCount(0);
  });

  test('an armed digit: a held armed key is a tap too, putting it down with no corner mark put in', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const one = page.locator('.num-btn', { hasText: /^1$/ });
    await one.tap();
    // the owner's screenshot: 1 armed and an empty cell selected (a tap on
    // a cell enters the 1, a second takes it off again)
    const c = await cellBox(page, 72);
    await page.touchscreen.tap(c.x, c.y);
    await page.touchscreen.tap(c.x, c.y);
    await expect(status).toHaveText('Row 9, column 1: empty.');
    await expect(page.locator('.num-btn.armed')).toHaveText('1');
    const key = (await one.boundingBox())!;
    const at = { x: key.x + key.width / 2, y: key.y + key.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await page.waitForTimeout(900);
    await expect(page.locator('.num-btn.held-corner')).toHaveCount(0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.num-btn.armed')).toHaveCount(0);
    await expect(status).toHaveText('Row 9, column 1: empty.');
  });

  test('an armed digit: another key arms that one instead, entering nothing, and the cells take it', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const armed = page.locator('.num-btn.armed');
    await page.locator('.num-btn', { hasText: /^1$/ }).tap();
    const c = await cellBox(page, 72);
    await page.touchscreen.tap(c.x, c.y);
    await expect(status).toHaveText('Row 9, column 1: 1.');
    const four = page.locator('.num-btn', { hasText: /^4$/ });
    await expect(four).toHaveAttribute('title', 'Arm 4 instead of 1: a tap on a cell then enters 4');
    await four.tap();
    await expect(armed).toHaveText('4');
    // nothing entered in the selected cell
    await expect(status).toHaveText('Row 9, column 1: 1.');
    // r1c1, empty: it takes the 4
    const d = await cellBox(page, 0);
    await page.touchscreen.tap(d.x, d.y);
    await expect(status).toHaveText('Row 1, column 1: 4.');
    await expect(armed).toHaveText('4');
    await four.tap();
    await expect(armed).toHaveCount(0);
  });

  test('a tap on a number key counts once, in Chromium’s order of events and in iOS Safari’s', async ({ page }) => {
    await open(page);
    const status = page.locator('#board-status');
    const c = await cellBox(page, 72);
    await page.touchscreen.tap(c.x, c.y);
    await expect(status).toHaveText('Row 9, column 1: empty.');
    const five = page.locator('.num-btn', { hasText: /^5$/ });
    // a real tap: the 5 goes in, once (twice would take it out again)
    await five.tap();
    await expect(status).toHaveText('Row 9, column 1: 5.');
    await five.tap();
    await expect(status).toHaveText('Row 9, column 1: empty.');
    // the events as iOS Safari may send them: its click can carry a detail
    // of 0, as a keyboard's does, and a pointerleave can come before the
    // pointerup; each tap still counts once, so the 5 goes in and out in turn
    const tapAs = (order: string[]) =>
      five.evaluate((key, order) => {
        const r = key.getBoundingClientRect();
        const at = { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 };
        const pointer = (type: string, bubbles = true) =>
          key.dispatchEvent(
            new PointerEvent(type, { bubbles, cancelable: true, composed: true, pointerType: 'touch', pointerId: 9, isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, relatedTarget: null, ...at })
          );
        for (const e of order) {
          if (e === 'down') pointer('pointerdown');
          if (e === 'up') pointer('pointerup');
          // React hears a leave from the pointerout before it
          if (e === 'leave') {
            pointer('pointerout');
            pointer('pointerleave', false);
          }
          if (e === 'click') key.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, detail: 0, ...at }));
        }
      }, order);
    const orders = [
      ['down', 'up', 'leave', 'click'],
      ['down', 'leave', 'up', 'click'],
      ['down', 'click', 'up', 'leave'],
      ['down', 'up', 'leave']
    ];
    let shown = false;
    for (const order of orders) {
      await tapAs(order);
      shown = !shown;
      await expect(status, order.join(', ')).toHaveText(shown ? 'Row 9, column 1: 5.' : 'Row 9, column 1: empty.');
    }
    // and with nothing selected, a tap arms the digit (twice would put it straight down)
    await page.touchscreen.tap(c.x, c.y);
    await expect(status).toHaveText('No cell selected.');
    await tapAs(['down', 'up', 'leave', 'click']);
    await expect(page.locator('.num-btn.armed')).toHaveText('5');
    await tapAs(['down', 'leave', 'up', 'click']);
    await expect(page.locator('.num-btn.armed')).toHaveCount(0);
  });

  test('the Assist box folds into one row that keeps Hint, the menu under it then in view, and the phone remembers', async ({ page }) => {
    await open(page);
    const fold = page.getByRole('button', { name: 'Assist buttons' });
    const menu = page.locator('.menu-row');
    const zone = page.locator('.assist-zone');
    const inView = async () => {
      const b = (await menu.boundingBox())!;
      return b.y >= 0 && b.y + b.height <= 844;
    };
    const scrolled = () => page.evaluate(() => Math.max(window.scrollY, ...[...document.querySelectorAll('*')].map((el) => el.scrollTop)));
    // open, as it was: every assist, the menu below the screen's edge
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
    await expect(fold).toHaveAttribute('aria-controls', 'assist-buttons');
    await expect(page.locator('#assist-buttons')).toBeVisible();
    expect(await inView()).toBe(false);
    await fold.tap();
    // folded: one row that says it counts as help, Hint in it, and the
    // menu (New, Learn, Import, Share, Restart) in view without a scroll
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#assist-buttons')).toBeHidden();
    await expect(zone).toContainText('counts as help');
    const hint = zone.getByRole('button', { name: 'Hint' });
    await expect(hint).toBeVisible();
    const row = (await zone.boundingBox())!;
    expect(row.height).toBeLessThan(70);
    expect(await scrolled()).toBe(0);
    expect(await inView()).toBe(true);
    for (const name of ['New', 'Learn', 'Import', 'Share', 'Restart']) await expect(menu.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
    // the folded Hint is the box's Hint: the first assist asks first
    await hint.tap();
    await expect(page.getByRole('dialog', { name: 'Use Hint?' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).tap();
    // kept on the device
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    // opened again, as it was, and kept so
    await fold.tap();
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#assist-buttons').getByRole('button', { name: 'Steps' })).toBeVisible();
    expect(await inView()).toBe(false);
    await page.reload();
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
    // in every language the folded row fits the column, down to a 320 px phone
    await fold.tap();
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/', '/nb/', '/es/']) {
      await page.goto(`${path}#p=${EASY}`);
      await expect(page.locator('.assist-zone.folded')).toBeVisible();
      expect(await controlMisfits(page), path).toEqual([]);
      expect((await zone.boundingBox())!.height, path).toBeLessThan(80);
    }
  });

  test('the pause card shows the app’s mark and address, inside the board', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Pause game' }).tap();
    const card = page.locator('.pause-card');
    await expect(card).toBeVisible();
    await expect(card.locator('.pause-brand .brand-mark')).toHaveText('UI');
    await expect(card.locator('.pause-brand')).toMatchAriaSnapshot('- paragraph: sudokui.app');
    await expect(card.locator('.pause-site')).toHaveText('sudokui.app');
    const board = (await page.locator('svg.board').boundingBox())!;
    for (const part of ['h3', '.pause-tip', '.resume-btn', '.pause-brand']) {
      const b = (await card.locator(part).boundingBox())!;
      expect(b.y, part).toBeGreaterThanOrEqual(board.y);
      expect(b.y + b.height, part).toBeLessThanOrEqual(board.y + board.height);
    }
    // read from a seat away: the size of a title
    expect(await card.locator('.pause-site').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(20);
    await card.getByRole('button', { name: /Resume/ }).tap();
    await expect(card).toHaveCount(0);
  });

  test('on a 320 px phone the pause card holds the mark and Nutella too, inside the board', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { showPoodle: true }, version: 1 })));
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    await page.getByRole('button', { name: 'Pause game' }).tap();
    const card = page.locator('.pause-card');
    await expect(card.locator('.pause-poodle')).toBeVisible();
    const board = (await page.locator('svg.board').boundingBox())!;
    for (const part of ['h3', '.pause-tip', '.resume-btn', '.pause-poodle', '.pause-brand']) {
      const b = (await card.locator(part).boundingBox())!;
      expect(b.y, part).toBeGreaterThanOrEqual(board.y);
      expect(b.y + b.height, part).toBeLessThanOrEqual(board.y + board.height);
      expect(b.x, part).toBeGreaterThanOrEqual(board.x);
      expect(b.x + b.width, part).toBeLessThanOrEqual(board.x + board.width);
    }
  });

  for (const lang of ['nb', 'es']) {
    test(`on a small phone on its side the pause card stays inside the board (/${lang}/)`, async ({ page }) => {
      await page.setViewportSize({ width: 568, height: 320 });
      await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
      await page.goto(`/${lang}/#p=${EASY}`);
      await expect(page.locator('svg.board')).toBeVisible();
      // the pause key, P, as on any keyboard the phone has; the button's name is in the page's language
      await page.keyboard.press('p');
      const card = page.locator('.pause-card');
      await expect(card.locator('.pause-brand')).toBeVisible();
      const board = (await page.locator('svg.board').boundingBox())!;
      for (const part of ['h3', '.resume-btn', '.pause-brand']) {
        const b = (await card.locator(part).boundingBox())!;
        expect(b.y, part).toBeGreaterThanOrEqual(board.y);
        expect(b.y + b.height, part).toBeLessThanOrEqual(board.y + board.height);
      }
    });
  }

  test('Swap held in Centre mode says where the marks go and gathers them there; sliding off cancels; a tap still swaps', async ({ page }) => {
    await open(page);
    // the board as saved on the device: each cell's corner and centre marks
    const cellsOf = () =>
      page.evaluate(() =>
        (JSON.parse(localStorage.getItem('sudokui-game-v1')!).state.cells as { corner: number; center: number }[]).map((c) => [c.corner, c.center])
      );
    // corner marks in two cells, then nothing selected: the whole board
    await page.locator('.mode-btn', { hasText: 'Corner' }).tap();
    for (const [cell, digits] of [[40, [4, 7]], [41, [1, 2]]] as const) {
      const c = await cellBox(page, cell);
      await page.touchscreen.tap(c.x, c.y);
      for (const d of digits) await page.locator('.num-btn', { hasText: String(d) }).tap();
    }
    const c = await cellBox(page, 41);
    await page.touchscreen.tap(c.x, c.y);
    await expect(page.locator('#board-status')).toContainText('No cell selected');
    const marks = { corner: [bit(4) | bit(7), bit(1) | bit(2)] };
    expect((await cellsOf()).slice(40, 42)).toEqual([[marks.corner[0], 0], [marks.corner[1], 0]]);
    await page.locator('.mode-btn', { hasText: 'Centre' }).tap();
    const swap = page.locator('.action-row button.swap-btn');
    const box = (await swap.boundingBox())!;
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    // held: the button says where the marks will go, and lifting does it
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await expect(swap).toHaveText('→ Centre');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(swap).toHaveText('⇄ Swap');
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'Gathered into centre marks in 2 cells' })).toBeVisible();
    expect((await cellsOf()).slice(40, 42)).toEqual([[0, marks.corner[0]], [0, marks.corner[1]]]);
    // Undo, then a hold slid off the button: nothing happens
    await page.locator('.action-row button', { hasText: 'Undo' }).tap();
    expect((await cellsOf()).slice(40, 42)).toEqual([[marks.corner[0], 0], [marks.corner[1], 0]]);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await expect(swap).toHaveText('→ Centre');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: at.x, y: at.y - 200 }] });
    await expect(swap).toHaveText('⇄ Swap');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect((await cellsOf()).slice(40, 42)).toEqual([[marks.corner[0], 0], [marks.corner[1], 0]]);
    // a tap is Swap, as ever
    await swap.tap();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'Swapped corner and centre marks in 2 cells' })).toBeVisible();
    expect((await cellsOf()).slice(40, 42)).toEqual([[0, marks.corner[0]], [0, marks.corner[1]]]);
  });

  test('a swipe over the board scrolls the page, a tap still selects', async ({ page }) => {
    // with the setting on (off by default since 2 November 2026)
    await page.addInitScript(() => localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { scrollOverBoard: true }, version: 1 })));
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

  // the phones in use, from the smallest to the largest held upright: the
  // edit row with the "?" in it, open and folded, in every language
  for (const width of [320, 360, 375, 390, 430])
    test(`at ${width} px the edit row and its "?" keep to one row and the folded Assist row to one line, in every language`, async ({ page }) => {
      await expectControlsFit(page, width, 844);
      // from 360 px up the folded note has its room in every language: "Assist · counts as help"
      if (width >= 360)
        for (const path of ['/', '/nb/', '/es/']) {
          await page.addInitScript(() => localStorage.setItem('sudokui-assist-folded', '1'));
          await page.goto(`${path}#p=${EASY}`);
          const title = page.locator('.assist-zone.folded .zone-title');
          const [box, note] = [(await title.boundingBox())!, (await title.locator('.zone-note').boundingBox())!];
          expect(note.y, `${path}: the note is on the line`).toBeLessThan(box.y + box.height - 1);
        }
    });

  test('the "?" ends the edit row, beside Swap; where the words cannot fit the row shows icons and each button keeps its name', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await open(page);
    const row = page.locator('.edit-row');
    await expect(page.locator('.zone-head .zone-help')).toHaveCount(0);
    const help = row.getByRole('button', { name: 'What the buttons do' });
    await expect(help).toBeVisible();
    await expect(row.locator('button').last()).toHaveAttribute('aria-label', 'What the buttons do');
    await expect(row.locator('button').nth(3)).toHaveClass(/swap-btn/);
    await help.tap();
    await expect(page.getByRole('dialog', { name: 'What the buttons do' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // English has its words at 320 px
    await expect(row).not.toHaveClass(/icons/);
    for (const name of ['Undo', 'Redo', 'Erase', 'Swap']) await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
    // Spanish does not: the icons alone, each button still named by its word
    await page.goto(`/es/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(row).toHaveClass(/icons/);
    for (const name of ['Deshacer', 'Rehacer', 'Borrar', 'Cambiar', 'Qué hace cada botón'])
      await expect(row.getByRole('button', { name, exact: true })).toBeVisible();
    expect((await row.locator('.edit-word').first().boundingBox())!.width).toBeLessThanOrEqual(1);
    // held in Corner mode, Swap says where Gather puts the marks, whole, inside the button and the row's height
    await page.locator('.mode-btn').nth(1).tap();
    const swap = row.locator('.swap-btn');
    const before = (await swap.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: before.x + before.width / 2, y: before.y + before.height / 2 }] });
    await expect(swap).toHaveText('→ Esquina');
    const held = (await swap.boundingBox())!;
    expect([held.x, held.width, held.height]).toEqual([before.x, before.width, before.height]);
    expect(await swap.evaluate((el) => el.scrollWidth <= el.clientWidth && el.scrollHeight <= el.clientHeight)).toBe(true);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(swap).toHaveText('⇄ Cambiar');
  });
});

test.describe('phone, 390 x 844, multi-select', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('Multi: a drag selects at once in any direction, a tap adds or removes, the page stays put', async ({ page }) => {
    // with scrolling over the board on, which Multi turns off for itself
    await page.addInitScript(() => localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { scrollOverBoard: true }, version: 1 })));
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

test.describe('zoomed to 200%: a 1024 x 768 window', () => {
  test.use({ viewport: { width: 512, height: 384 }, deviceScaleFactor: 2 });

  test('the nine keys fit beside the board, and the play area does not scroll sideways', async ({ page }) => {
    await open(page);
    for (const [width, height] of [[512, 384], [640, 450]]) {
      await page.setViewportSize({ width, height });
      const side = (await page.locator('.side').boundingBox())!;
      for (const d of [7, 8, 9]) {
        const key = page.getByRole('button', { name: String(d), exact: true });
        await expect(key, `${d} at ${width} x ${height}`).toBeInViewport({ ratio: 1 });
        const box = (await key.boundingBox())!;
        expect(box.x + box.width, `${d} at ${width} x ${height}`).toBeLessThanOrEqual(side.x + side.width + 0.5);
      }
      expect(await page.locator('.layout').evaluate((el) => el.scrollWidth - el.clientWidth), `${width} x ${height}`).toBe(0);
    }
  });
});

test.describe('reduced motion', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a hint brings the page back to the top at once, without the smooth scroll', async ({ page }) => {
    // how the page is asked to scroll
    await page.addInitScript(() => {
      const asked: unknown[] = [];
      (window as unknown as { scrolls: unknown[] }).scrolls = asked;
      const own = Element.prototype.scrollTo;
      Element.prototype.scrollTo = function (this: Element, ...args: unknown[]) {
        asked.push(args[0]);
        return (own as (...a: unknown[]) => void).apply(this, args);
      };
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await page.locator('.layout').evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await page.evaluate(() => ((window as unknown as { scrolls: unknown[] }).scrolls.length = 0));
    await page.getByRole('button', { name: /Hint/ }).first().click();
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await expect(page.locator('.hint-panel')).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { scrolls: unknown[] }).scrolls)).toContainEqual({ top: 0, behavior: 'auto' });
    expect(await page.evaluate(() => (window as unknown as { scrolls: { behavior?: string }[] }).scrolls.some((s) => s?.behavior === 'smooth'))).toBe(false);
  });
});

test.describe('tablet, 820 x 1180', () => {
  test.use({ viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true });

  test('the "?" stays in the Assist box’s head, as at a desk, and the edit row keeps its words', async ({ page }) => {
    await open(page);
    await expect(page.locator('.zone-head .zone-help')).toBeVisible();
    await expect(page.locator('.edit-row button')).toHaveCount(4);
    await expect(page.locator('.edit-row')).not.toHaveClass(/icons/);
  });

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
    expect(html).toContain('<title>Easy sudoku, HoDoKu rating 600 | sudokUI</title>');
    expect(html).toContain('<meta property="og:title" content="Solved in 9:12. Can you beat it?" />');
    expect(html).toContain('<meta property="og:image" content="https://sudokui.app/og/easy.png" />');
    expect(html).not.toContain('rel="canonical"');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(page.locator('.toast, [role=status]').filter({ hasText: 'solve it faster than 9:12' })).toBeVisible();
    // the address bar then names the puzzle as the app rates it, without the time to beat
    await expect.poll(() => page.evaluate(() => location.pathname + location.search)).toMatch(/^\/p\/[0-9.]{81}\?b=[a-z]+&s=\d+$/);
  });

  test('sent before HoDoKu’s five levels, it still opens, named by its level', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    // a link from when the site had eight bands: Tricky lies inside HoDoKu's Hard
    const response = await page.goto(`/p/${EASY}?b=tricky&s=1100`);
    const html = await response!.text();
    expect(html).toContain('<title>Hard sudoku, HoDoKu rating 1100 | sudokUI</title>');
    expect(html).toContain('<meta property="og:image" content="https://sudokui.app/og/hard.png" />');
    await expect(page.locator('svg.board')).toBeVisible();
    // the app rates the puzzle itself, and the address names its level
    await expect(page.locator('.game-meta .level-badge')).toHaveText('Easy');
    await expect.poll(() => page.evaluate(() => location.search)).toMatch(/^\?b=easy&s=\d+$/);
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
    // each link copied counts as a share, by kind and way (src/state/telemetry.ts)
    const lines: Record<string, unknown>[] = [];
    await page.route('**/api/t', async (route) => {
      lines.push(...JSON.parse(route.request().postData() ?? '[]'));
      await route.fulfill({ status: 204 });
    });
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
    expect(link).toMatch(new RegExp(`^http://localhost:\\d+/p/${puzzle}\\?b=[a-z]+&s=\\d+$`));
    await dialog.getByRole('button', { name: 'Position link' }).click();
    const position = await copied(page);
    expect(position.startsWith(link + '#s=')).toBe(true);
    // ticking "Say what it needs" names them, in both links
    const box = dialog.getByRole('checkbox', { name: 'Say what it needs' });
    await expect(box).not.toBeChecked();
    await box.check();
    await dialog.getByRole('button', { name: 'Puzzle link' }).click();
    const named = await copied(page);
    expect(named).toMatch(new RegExp(`^http://localhost:\\d+/p/${puzzle}\\?b=[a-z]+&s=\\d+&t=[a-z0-9-]+(,[a-z0-9-]+){0,2}$`));
    expect(named.startsWith(`${link}&t=`)).toBe(true);
    await dialog.getByRole('button', { name: 'Position link' }).click();
    expect((await copied(page)).startsWith(named + '#s=')).toBe(true);
    await expect.poll(() => lines.filter((l) => l.event === 'shared').length).toBe(4);
    expect(lines.filter((l) => l.event === 'shared').map((l) => `${l.what}/${l.via}`)).toEqual(['puzzle/copy', 'position/copy', 'puzzle/copy', 'position/copy']);
    expect(JSON.stringify(lines)).not.toContain(HARD);
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
    expect(text).toMatch(/^I solved an? [A-Za-z]+ sudoku \(HoDoKu rating \d+\) in \d+:\d\d/);
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
    expect(await copied(page)).toBe(`${new URL(page.url()).origin}/daily/${third.date}`);
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
    // where the time stands: its place while few have played, the percentile from twenty up
    const standing = /The only time sent today|Fastest of \d+ today|\d+(?:st|nd|rd|th) fastest of \d+ today|Tied for (?:\d+(?:st|nd|rd|th) )?fastest of \d+ today|You were faster than \d+% of them/;
    await expect(dialog).toContainText(standing);
    await dialog.getByRole('button', { name: /Challenge a friend/ }).click();
    const text = await copied(page);
    const no = dailies.indexOf(daily) + 1;
    expect(text.startsWith(`sudokUI Daily #${no} · ${daily.level} (${daily.score}) · `)).toBe(true);
    expect(text).toContain(' · unassisted · ');
    const [, time, link] = /· (\d+:\d\d) · unassisted · (?:[^·]+ today · )?(https:\S+)$/.exec(text) ?? [];
    expect(time).toMatch(/^\d+:\d\d$/);
    expect(link).toMatch(/^https:\/\/sudokui\.app\/daily\/\d{4}-\d{2}-\d{2}\?vs=\d+$/);
    expect(link).toContain(`/daily/${today}?vs=`);
    // the day's statistics now count this result (asked afresh: the win
    // screen's own read a moment ago is still in the browser's cache)
    const stats = await page.evaluate(async (n) => (await fetch(`/api/daily/${n}/stats`, { cache: 'no-store' })).json(), no);
    expect(stats.count).toBeGreaterThanOrEqual(1);

    // after the win screen has closed, the Share dialog offers the same
    // line again, and no position: a solved board's would be the solution
    await dialog.getByRole('button', { name: 'Admire the grid' }).click();
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const share = page.getByRole('dialog', { name: 'Share this puzzle' });
    await expect(share.getByRole('button', { name: /Position link|Position as text/ })).toHaveCount(0);
    await expect(share).toContainText('A solved board has no position to share');
    // and its picture is the puzzle from the start, its givens alone: the board as it stands is the solution
    await expect(share).toContainText('A picture of the puzzle from the start');
    const picture = decodeURIComponent((await share.locator('.share-image-preview').getAttribute('src'))!.replace(/^data:image\/svg\+xml;utf8,/, ''));
    expect(picture.match(/class="giv"/g)?.length).toBe([...daily.puzzle].filter((ch) => ch !== '.' && ch !== '0').length);
    expect(picture).not.toContain('class="ent"');
    await share.getByRole('button', { name: `Your result in Daily #${no}` }).click();
    expect(await copied(page)).toBe(text);
  });

  test('a player who has sent a daily time can switch on sending them, and the next daily sends its time by itself', async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(keepClipboard);
    const today = localDateKey();
    const yesterday = localDateKey(new Date(Date.now() - 24 * 60 * 60 * 1000));
    const first = dailies.find((d) => d.date === yesterday)!;
    const next = dailies.find((d) => d.date === today)!;
    expect(first && next, `published dailies for ${yesterday} and ${today}`).toBeTruthy();
    /** solves the daily on the board, past the server's floor of real seconds */
    const solveDaily = async (daily: Daily) => {
      const solution = gridToString(solve(parseGrid(daily.puzzle)!)!);
      const empties = [...daily.puzzle].map((ch, i) => (ch === '.' ? i : -1)).filter((i) => i >= 0);
      for (const cell of empties) {
        if (cell === empties[empties.length - 1]) await page.clock.fastForward(45_000);
        const c = await cellBox(page, cell);
        await page.mouse.click(c.x, c.y);
        await page.keyboard.press(`Digit${solution[cell]}`);
      }
    };
    /** the day's daily is on the board: until the dailies file has loaded,
     *  the board shown is still the last game, and digits would go on it */
    const onBoard = (date: string) =>
      expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info?.dailyKey)).toBe(date);
    const results: string[] = [];
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().includes('/api/daily/')) results.push(new URL(r.url()).pathname);
    });
    await page.clock.install();
    // the first daily: nothing goes until the player taps Send
    await page.goto(`/daily/${yesterday}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await onBoard(yesterday);
    await solveDaily(first);
    const dialog = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(dialog).toBeVisible();
    const auto = dialog.getByRole('switch', { name: /Send my daily times automatically/ });
    await expect(auto).toHaveCount(0);
    expect(results).toEqual([]);
    await dialog.getByRole('button', { name: /Send my time and compare/ }).click();
    await expect(dialog).toContainText(/so far|You were faster than/);
    expect(results).toEqual([`/api/daily/${dailies.indexOf(first) + 1}/result`]);
    // then the switch, unticked until the player ticks it
    await expect(auto).toHaveAttribute('aria-checked', 'false');
    await auto.click();
    await expect(auto).toHaveAttribute('aria-checked', 'true');
    // the next daily goes in by itself, and its place shows at once
    await page.goto(`/daily/${today}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await onBoard(today);
    await solveDaily(next);
    const second = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(second).toBeVisible();
    await expect(second).toContainText(/The only time sent today|fastest of \d+ today|You were faster than \d+% of them/i);
    await expect(second.getByRole('button', { name: /Send my time and compare/ })).toHaveCount(0);
    expect(results).toEqual([`/api/daily/${dailies.indexOf(first) + 1}/result`, `/api/daily/${dailies.indexOf(next) + 1}/result`]);
    // and Settings turns it off
    await second.getByRole('button', { name: 'Admire the grid' }).click();
    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const inSettings = settings.getByRole('switch', { name: /Send my daily times automatically/ });
    await expect(inSettings).toHaveAttribute('aria-checked', 'true');
    await inSettings.click();
    await expect(inSettings).toHaveAttribute('aria-checked', 'false');
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

  test('a pasted pencil-mark grid puts its candidates on the board, and Share copies the board back as the solver reads it', async ({ page }) => {
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
    // and the board copied as text is the grid that was pasted, as the
    // solver reads it: a single candidate pasted is a placed digit (as the
    // forums read it), so the lists beside it lose that digit, and the list
    // that lost a candidate is the player's, without it
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await page.getByRole('dialog', { name: 'Share this puzzle' }).getByRole('button', { name: 'Position as text' }).click();
    const back = parsePencilGrid(text)!;
    const board = back.values.map((value, i) => ({ value, corner: 0, center: back.cands![i], excluded: 0 }));
    const again = await copied(page);
    expect(again).toBe(formatPencilGrid(board, false, 'exhaustive'));
    const read = parsePencilGrid(again)!;
    expect(read.cands![cell] & bit(dropped)).toBe(0);
    // every list is the pasted one, less only digits the placed digits rule out
    for (let i = 0; i < 81; i++) if (!read.values[i]) expect(read.cands![i] & ~back.cands![i], `cell ${i}`).toBe(0);
  });

  /** EASY with the player's own marks: r1c2 (candidates 4 5 7 8) a centre pair, r2c2 (2 4 6 7 8) a corner pair */
  const marked = async (page: Page) => {
    for (const [cell, keys] of [
      [1, ['Control+Digit7', 'Control+Digit8']],
      [10, ['Shift+Digit6', 'Shift+Digit7']]
    ] as const) {
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      for (const k of keys) await page.keyboard.press(k);
    }
    const g = parseGrid(EASY)!;
    return Array.from({ length: 81 }, (_, i) => ({ value: g.values[i], corner: i === 10 ? bit(6) | bit(7) : 0, center: i === 1 ? bit(7) | bit(8) : 0, excluded: 0 }));
  };

  test('over marks never declared, Position as text asks the mark question first; partial notes copy every candidate still open, and say so', async ({ page }) => {
    await page.addInitScript(keepClipboard);
    await open(page);
    const cells = await marked(page);
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const share = page.getByRole('dialog', { name: 'Share this puzzle' });
    const text = share.getByRole('button', { name: 'Position as text' });
    await text.click();
    // the question, in its own words, over the Share dialog, and nothing copied yet
    const question = page.getByRole('dialog', { name: 'How should Position as text read your pencil marks?' });
    await expect(question).toBeVisible();
    await expect(question.getByRole('button', { name: /They are my remaining candidates/ })).toContainText('The text lists a marked cell’s corner and centre marks together as its candidates');
    await expect(question.getByRole('button', { name: /They are partial notes/ })).toContainText('The text lists every candidate still open in each empty cell instead, and leaves your marks out.');
    expect(await copied(page)).toBe('');
    // Escape closes the question alone
    await page.keyboard.press('Escape');
    await expect(question).toBeHidden();
    await expect(share).toBeVisible();
    expect(await copied(page)).toBe('');
    // asked again, answered: the answer's tap copies the text it described, and a line says what it holds
    await text.click();
    await question.getByRole('button', { name: /They are partial notes/ }).click();
    await expect(question).toBeHidden();
    await expect(share.getByRole('button', { name: /Copied/ })).toBeVisible();
    expect(await copied(page)).toBe(formatPencilGrid(cells, false, 'open'));
    await expect(share.getByRole('status')).toHaveText('You said your pencil marks are partial notes, so the text leaves them out and lists every candidate still open in each empty cell.');
    // remembered for the puzzle: the text asks no more, nor does Hint
    await page.evaluate(() => ((window as any).__copied = ''));
    await page.keyboard.press('Escape');
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await text.click();
    await expect(question).toBeHidden();
    expect(await copied(page)).toBe(formatPencilGrid(cells, false, 'open'));
    await page.keyboard.press('Escape');
    await page.keyboard.press('KeyH');
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await expect(page.locator('.hint-panel')).toBeVisible();
    await expect(page.getByRole('dialog', { name: /read your pencil marks/ })).toHaveCount(0);
  });

  test('my remaining candidates copy the player’s own lists, as complete lists', async ({ page }) => {
    await page.addInitScript(keepClipboard);
    await open(page);
    const cells = await marked(page);
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const share = page.getByRole('dialog', { name: 'Share this puzzle' });
    await share.getByRole('button', { name: 'Position as text' }).click();
    await page.getByRole('dialog', { name: 'How should Position as text read your pencil marks?' }).getByRole('button', { name: /They are my remaining candidates/ }).click();
    const text = await copied(page);
    expect(text).toBe(formatPencilGrid(cells, false, 'exhaustive'));
    // r1c2 and r2c2 carry the player's lists; r1c1, unmarked, every candidate
    expect(text.split('\n')[1]).toMatch(/^\| 45 +78 +3 /);
    expect(text.split('\n')[2]).toMatch(/^\| 9 +67 +/);
    await expect(share.getByRole('status')).toHaveCount(0);
  });
});

test.describe('a picture of the board', () => {
  test.use({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });

  /** a download's bytes, checked as a PNG: its signature, and its size in pixels from the header */
  const pngOf = async (download: import('@playwright/test').Download) => {
    const bytes = readFileSync((await download.path())!);
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  };

  test('Save image saves the board as a PNG, made on the device, counted by kind and way only, and the ticks are remembered', async ({ page }) => {
    const lines: Record<string, unknown>[] = [];
    await page.route('**/api/t', async (route) => {
      lines.push(...JSON.parse(route.request().postData() ?? '[]'));
      await route.fulfill({ status: 204 });
    });
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/#p=${HARD}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this puzzle' });
    // the preview, with the line under it shown beside its tick, the level
    // and the rating held together by a no-break space
    await expect(dialog.getByRole('img', { name: 'The picture as it will be shared' })).toBeVisible();
    await expect(dialog).toContainText(/sudokui\.app · (Easy|Medium|Hard|Unfair|Extreme)\u00a0\d+/);
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Save image' }).click()]);
    expect(download.suggestedFilename()).toBe('sudokui-board.png');
    // 570 units wide at 2 pixels a unit, with 40 more for the footer
    expect(await pngOf(download)).toEqual({ width: 1140, height: 1220 });
    await expect(dialog.getByRole('button', { name: /Saved/ })).toBeVisible();
    await expect.poll(() => lines.filter((l) => l.event === 'shared').length).toBe(1);
    expect(lines.filter((l) => l.event === 'shared').map((l) => `${l.what}/${l.via}`)).toEqual(['image/save']);
    // the picture never leaves the device: nothing sent holds the puzzle or an image
    expect(JSON.stringify(lines)).not.toContain(HARD);
    expect(JSON.stringify(lines)).not.toMatch(/png|base64|svg/i);
    // the footer off, remembered on this device the next time the dialog opens
    await dialog.getByRole('checkbox', { name: 'Footer' }).uncheck();
    const [bare] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: /Save image|Saved/ }).click()]);
    expect(await pngOf(bare)).toEqual({ width: 1140, height: 1140 });
    await page.keyboard.press('Escape');
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Footer' })).not.toBeChecked();
    // a board with no marks and auto candidates off draws nothing in its empty cells, so it has no tick for them
    await expect(dialog.getByRole('checkbox', { name: /Candidates|Your pencil marks/ })).toHaveCount(0);
  });

  test('the picture draws the board as the player sees it: their own pencil marks with auto candidates off, the auto candidates with them on', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/#p=${HARD}`);
    await expect(page.locator('svg.board')).toBeVisible();
    const svgOf = async (dialog: Locator) =>
      decodeURIComponent((await dialog.locator('.share-image-preview').getAttribute('src'))!.replace(/^data:image\/svg\+xml;utf8,/, ''));
    /** the texts the picture draws in its empty cells, by kind: candidates on the grid, corner marks there, round the edge, centre lines */
    const drawn = (svg: string) =>
      [...svg.replace(/<mask [\s\S]*?<\/mask>/g, '').matchAll(/class="(cd|cc|ce|cl)"[^>]*>([^<]*)</g)].map((m) => `${m[1]}:${m[2]}`).sort();
    // r1c1 (candidates 2 3 5 7 8): corner marks alone; r1c2: a centre line; r1c3: both layers
    const enter = async (cell: number, keys: string[]) => {
      const c = await cellBox(page, cell);
      await page.mouse.click(c.x, c.y);
      for (const k of keys) await page.keyboard.press(k);
    };
    await enter(0, ['Shift+Digit2', 'Shift+Digit7']);
    await enter(1, ['Control+Digit3', 'Control+Digit8']);
    await enter(2, ['Shift+Digit5', 'Control+Digit7', 'Control+Digit8']);
    await expect(page.locator('#board-status')).toHaveText('Row 1, column 3: empty, corner marks 5, centre marks 7 8.');
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this puzzle' });
    await expect(dialog).toContainText('A picture of the board as you see it, for a post or a chat.');
    // the tick is named for what it draws, and the picture draws the marks the board shows, laid out as it lays them out, and nothing else
    const marks = dialog.getByRole('checkbox', { name: 'Your pencil marks' });
    await expect(marks).toBeChecked();
    expect(drawn(await svgOf(dialog))).toEqual(['cc:2', 'cc:7', 'ce:5', 'cl:38', 'cl:78']);
    // off, no marks; and the choice is remembered
    await marks.uncheck();
    await expect.poll(async () => drawn(await svgOf(dialog))).toEqual([]);
    await page.keyboard.press('Escape');
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await expect(marks).not.toBeChecked();
    await marks.check();
    await expect.poll(async () => drawn(await svgOf(dialog))).toHaveLength(5);
    await page.keyboard.press('Escape');
    // with auto candidates on, the board's candidates, and the tick says so
    await page.getByRole('button', { name: /Auto candidates/ }).first().click();
    await page.getByRole('button', { name: 'Use Auto candidates' }).click();
    await page.getByRole('button', { name: /They are partial notes/ }).click();
    await expect(page.locator('#board-status')).toContainText('candidates');
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Candidates' })).toBeChecked();
    await expect(dialog.getByRole('checkbox', { name: 'Your pencil marks' })).toHaveCount(0);
    const auto = drawn(await svgOf(dialog));
    expect(auto.length).toBeGreaterThan(100);
    expect(auto.every((t) => t.startsWith('cd:'))).toBe(true);
  });

  test('Share this hint saves the board with the hint drawn, and names no technique', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/#p=${HARD}`);
    await expect(page.locator('svg.board')).toBeVisible();
    await page.keyboard.press('KeyH');
    await page.getByRole('button', { name: 'Use Hint' }).click();
    await page.getByRole('button', { name: 'Show me' }).click();
    const name = await page.locator('.hint-tech strong').innerText();
    await page.getByRole('button', { name: 'Share this hint' }).click();
    const dialog = page.getByRole('dialog', { name: 'Share this hint' });
    await expect(dialog.getByRole('img', { name: 'The picture as it will be shared' })).toBeVisible();
    await expect(dialog).not.toContainText(name);
    // the preview draws the hint's marks, and its words name no technique
    const svg = decodeURIComponent((await dialog.locator('.share-image-preview').getAttribute('src'))!.replace(/^data:image\/svg\+xml;utf8,/, ''));
    expect(svg).toMatch(/class="(mk|rm)"/);
    expect(svg).not.toContain(name);
    // as the board shows it with auto candidates off and no marks: the hint's digits alone
    expect(svg).not.toMatch(/class="(cd|cc|ce|cl)"/);
    const [download] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('button', { name: 'Save image' }).click()]);
    expect(download.suggestedFilename()).toBe('sudokui-hint.png');
    expect(await pngOf(download)).toEqual({ width: 1140, height: 1220 });
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
    // a share address's game, in the app's language
    expect(completed).toEqual({
      event: 'completed',
      band: expect.stringMatching(/^(Easy|Medium|Hard|Unfair|Extreme)$/),
      bucket: 0,
      standalone: false,
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      source: 'tab',
      kind: 'shared',
      lang: 'en'
    });
    expect(batches.flat().find((e) => e.event === 'started')).toMatchObject({ kind: 'shared', lang: 'en' });
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

  test('a Learn page’s #p= link begins a new game, counted in the language of the page it opens', async ({ page }) => {
    const lines: Line[] = [];
    await page.route('**/api/t', async (route) => {
      lines.push(...JSON.parse(route.request().postData() ?? '[]'));
      await route.fulfill({ status: 204 });
    });
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.goto(`/nb/#p=${EASY}`);
    await expect(page.locator('svg.board')).toBeVisible();
    const empty = [...EASY].indexOf('.');
    const c = await cellBox(page, empty);
    await page.mouse.click(c.x, c.y);
    await page.keyboard.press('Shift+Digit1');
    await expect.poll(() => lines.filter((e) => e.event === 'started').length).toBe(1);
    expect(lines[0]).toMatchObject({ event: 'started', kind: 'new', lang: 'nb' });
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

test.describe('described for AI assistants and search', () => {
  // as the build writes them: /llms.txt a file of its own, and the home
  // pages' structured data, with their titles and descriptions as they are
  test('the build serves /llms.txt as it is, and each home page describes the app in JSON-LD that parses', async ({ page }) => {
    const llms = await page.request.get('/llms.txt');
    expect(llms.status()).toBe(200);
    expect(llms.headers()['content-type']).toMatch(/^text\/plain/);
    expect(await llms.text()).toBe(new TextDecoder().decode(readFileSync('public/llms.txt')));
    for (const lang of HOME_LANGS) {
      const res = await page.request.get(homePath(lang));
      expect(res.status(), lang).toBe(200);
      const html = await res.text();
      expect(html, lang).toContain(`<title>${HOME[lang].title}</title>`);
      const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
      expect(scripts, lang).toHaveLength(1);
      const data = JSON.parse(scripts[0][1]);
      const app = data['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebApplication');
      expect(app, lang).toMatchObject({
        name: 'sudokUI',
        description: HOME[lang].appDescription,
        url: `https://sudokui.app${homePath(lang)}`,
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0' },
        inLanguage: lang
      });
    }
  });
});

test.describe('a first visit', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  /** the game on the board, as it was saved */
  const saved = (page: Page) =>
    page.evaluate(() => {
      const info = JSON.parse(localStorage.getItem('sudokui-game-v1') ?? '{}').state?.info;
      return info ? { level: info.level as string, dailyKey: (info.dailyKey ?? null) as string | null } : null;
    });
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

  test('opens straight on an easy board, nothing over it, the board taking every touch', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('svg.board')).toBeVisible();
    await expect.poll(() => saved(page)).toEqual({ level: 'Easy', dailyKey: null });
    await page.waitForTimeout(800);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // a swipe over the board selects; the page scrolls from beside it
    await expect(page.locator('svg.board')).toHaveAttribute('data-noscroll', 'true');
    await expect(page.locator('svg.board')).toHaveCSS('touch-action', 'pinch-zoom');
    // and a game won on it gets its win screen, with a quiet link to Why sudokUI?
    await solveSaved(page);
    const won = page.getByRole('dialog', { name: 'Puzzle solved' });
    await expect(won).toBeVisible();
    await won.getByRole('button', { name: 'Why sudokUI?' }).click();
    await expect(page.getByRole('dialog', { name: 'Why sudokUI?' })).toContainText('What stays true');
  });

  test('a returning player, with scrolling over the board on only because it was the default, gets it off once', async ({ page }) => {
    await page.addInitScript(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { scrollOverBoard: true, theme: 'light' }, version: 0 }));
    });
    await page.goto('/');
    await expect(page.locator('svg.board')).toHaveAttribute('data-noscroll', 'true');
    // the rest of the settings kept, and the change made once: on again, it stays on
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-settings-v1')!).state.theme)).toBe('light');
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('sudokui-settings-v1')!);
      s.state.scrollOverBoard = true;
      localStorage.setItem('sudokui-settings-v1', JSON.stringify(s));
    });
    await page.reload();
    await expect(page.locator('svg.board')).not.toHaveAttribute('data-noscroll', 'true');
  });
});

test.describe('Match device', () => {
  /** the colour the page gives the browser's bar and an installed app's
   *  status bar, and the top bar's own background, both as rgb() */
  const bars = (page: Page) =>
    page.evaluate(() => {
      const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
      const probe = document.createElement('div');
      probe.style.color = metas[0].content;
      document.body.appendChild(probe);
      const meta = getComputedStyle(probe).color;
      probe.remove();
      return { count: metas.length, meta, top: getComputedStyle(document.querySelector('.topbar')!).backgroundColor };
    });
  /** the picture the Share dialog would share, as its SVG */
  const picture = async (page: Page) => {
    await page.locator('.menu-row button', { hasText: 'Share' }).click();
    const share = page.getByRole('dialog', { name: 'Share this puzzle' });
    const src = (await share.locator('.share-image-preview').getAttribute('src'))!;
    await page.keyboard.press('Escape');
    await expect(share).toHaveCount(0);
    return decodeURIComponent(src.replace(/^data:image\/svg\+xml;utf8,/, ''));
  };

  test('follows the device into light and dark with the app open, the status bar with it, and the picture stays light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await open(page);
    const html = page.locator('html');
    // a new player starts dark, whatever the device says (the owner's choice)
    await expect(html).toHaveAttribute('data-theme', 'dark');
    const dark = await bars(page);
    expect(dark.count).toBe(1);
    expect(dark.meta).toBe(dark.top);
    const chosen = await picture(page);

    await page.getByRole('button', { name: 'Settings' }).click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    const themes = settings.getByRole('group', { name: 'Theme' });
    await themes.getByRole('button', { name: 'Match device' }).click();
    await expect(themes.getByRole('button', { name: 'Match device' })).toHaveAttribute('aria-pressed', 'true');
    await expect(themes.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false');
    await expect(settings).toContainText('“Match device” shows Daylight while your device is in light mode, and Dark while it is in dark mode');
    // the device is light: Daylight, and the bars wear its top bar's colour
    await expect(html).toHaveAttribute('data-theme', 'light');
    const day = await bars(page);
    expect(day.meta).toBe(day.top);
    expect(day.meta).not.toBe(dark.meta);
    // the device turns dark with the app open, and light again: the look follows at once
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await bars(page)).toEqual(dark);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-theme', 'light');
    expect(await bars(page)).toEqual(day);
    await page.keyboard.press('Escape');

    // the picture is the same light picture whatever the app shows
    expect(await picture(page)).toBe(chosen);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await picture(page)).toBe(chosen);

    // the choice is kept: opened again on a dark device, still Match device, and dark
    await page.reload();
    await expect(page.locator('svg.board')).toBeVisible();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sudokui-settings-v1')!).state.theme)).toBe('device');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html).toHaveAttribute('data-theme', 'light');

    // the top bar's theme button goes on from the look shown (Daylight here) and leaves Match device
    await page.getByRole('button', { name: 'Switch to rosé theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'rose');
    const rose = await bars(page);
    expect(rose.meta).toBe(rose.top);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(200);
    await expect(html).toHaveAttribute('data-theme', 'rose');

    // and a theme chosen in Settings holds whatever the device does
    await page.getByRole('button', { name: 'Settings' }).click();
    await themes.getByRole('button', { name: 'Forest' }).click();
    await expect(themes.getByRole('button', { name: 'Match device' })).toHaveAttribute('aria-pressed', 'false');
    await expect(html).toHaveAttribute('data-theme', 'forest');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(200);
    await expect(html).toHaveAttribute('data-theme', 'forest');
    const forest = await bars(page);
    expect(forest.meta).toBe(forest.top);
  });

  test('on a phone the five choices fit the dialog in every language, wrapping rather than running past its edge', async ({ page }) => {
    for (const [width, path, device] of [
      [360, '/', 'Match device'],
      [390, '/nb/', 'Som enheten'],
      [320, '/es/', 'Automático']
    ] as const) {
      await page.setViewportSize({ width, height: 800 });
      await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
      await page.goto(path);
      await expect(page.locator('svg.board')).toBeVisible();
      await page.locator('button.gear').click();
      const row = page.locator('.modal .theme-choice');
      await expect(row.getByRole('button', { name: device })).toBeVisible();
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
    }
  });
});

test.describe('Why sudokUI?', () => {
  test('the footer links the page search engines read, and in the app opens the same words', async ({ page }) => {
    await open(page);
    const link = page.locator('footer.app-footer a', { hasText: 'Why sudokUI?' });
    await expect(link).toHaveAttribute('href', '/why/');
    await link.click();
    const dialog = page.getByRole('dialog', { name: 'Why sudokUI?' });
    await expect(dialog).toContainText('without the clutter');
    await expect(dialog.getByRole('link', { name: 'see the privacy page' })).toHaveAttribute('href', '/privacy/');
    // its feedback link opens the report dialog
    await dialog.getByRole('button', { name: 'send feedback from the app' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('dialog').first()).toBeVisible();
    // and the app stayed where it was: the link opened words, not the page
    expect(new URL(page.url()).pathname).not.toBe('/why/');
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
  /** the lines the app sends to count plays and shares (src/state/telemetry.ts) */
  const countLines = async (page: Page) => {
    const lines: Record<string, unknown>[] = [];
    await page.route('**/api/t', async (route) => {
      lines.push(...JSON.parse(route.request().postData() ?? '[]'));
      await route.fulfill({ status: 204 });
    });
    return () => lines.filter((l) => l.event === 'shared');
  };

  test('a link goes to the share sheet, a puzzle string to the clipboard', async ({ page }) => {
    const shares = await countLines(page);
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
    // the share is counted: what and how, never the link
    await expect.poll(() => shares().length).toBe(1);
    expect(shares()[0]).toEqual({
      event: 'shared',
      band: expect.stringMatching(/^(Easy|Medium|Hard|Unfair|Extreme)$/),
      bucket: 0,
      standalone: false,
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      source: 'tab',
      what: 'puzzle',
      via: 'sheet'
    });
    // what goes into another tool is copied, never shared, and not counted
    await dialog.getByRole('button', { name: 'Puzzle string' }).click();
    await expect.poll(() => copied(page)).toBe(EASY);
    expect(await shared(page)).toHaveLength(1);
    await page.waitForTimeout(1500);
    expect(shares()).toHaveLength(1);
  });

  test('a challenge after a win goes to the share sheet', async ({ page }) => {
    const shares = await countLines(page);
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
    await expect.poll(() => shares().length).toBe(1);
    expect(shares()[0]).toMatchObject({ event: 'shared', what: 'challenge', via: 'sheet', bucket: 0 });
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


test.describe('the HoDoKu rating in the top bar', () => {
  /** a Nightmare of the seed library (src/content/seeds.json): Extreme, rated 3020, a four-figure rating */
  const NIGHTMARE = '......1.3.91......7..1...492.5.6.....7.9.5.8.....4.5.142...3..6......81.6.9......';
  /** an Unfair seed rated 1800, the widest level name (Urettferdig) with a four-figure rating */
  const UNFAIR = '..79..1..5...8..7..6.2.1...1..5.....7.4...5.3.....7..8...3.6.4..7..2...5..5..83..';
  /** a Fireworks practice puzzle: Extreme by its technique, rated only 1752 */
  const FIREWORKS = '....89....6.2.....8..7..4....7.5.......6...95...31..7.......21..1.8.....732.....6';
  const LANGS = [
    { path: '/', word: 'HoDoKu rating' },
    { path: '/nb/', word: 'HoDoKu-poengsum' },
    { path: '/es/', word: 'Puntuación HoDoKu' }
  ];

  /** the page's uncaught errors, a ResizeObserver loop among them */
  const errorsOf = (page: Page) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && /ResizeObserver/.test(m.text()) && errors.push(m.text()));
    return errors;
  };

  async function openPuzzle(page: Page, path: string, width: number, puzzle: string, score: string) {
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${path}#p=${puzzle}`);
    await expect(page.locator('.score-btn strong')).toHaveText(score, { timeout: 15_000 });
  }

  /** what of the bar does not fit (empty when all of it does): the bar or the
   *  page scrolling sideways, the rating group overflowing or running under
   *  the timer, any of its parts clipped */
  const misfits = (page: Page) =>
    page.evaluate(() => {
      const out: string[] = [];
      const bar = document.querySelector('.topbar')!;
      if (bar.scrollWidth > bar.clientWidth + 1) out.push('the bar scrolls');
      if (document.documentElement.scrollWidth > innerWidth + 1) out.push('the page scrolls sideways');
      const meta = document.querySelector('.game-meta')!;
      if (meta.scrollWidth > meta.clientWidth + 1) out.push('the rating group overflows');
      const m = meta.getBoundingClientRect();
      const right = document.querySelector('.topbar-right')!.getBoundingClientRect();
      if (m.right > right.left + 1) out.push('the rating group runs under the timer');
      for (const sel of ['.game-meta .level-badge', '.score-btn strong', '.rating-word', '.rating-gauge', '.mini-i', '.practice-badge']) {
        const e = document.querySelector(sel);
        if (!e) continue;
        const b = e.getBoundingClientRect();
        if (b.width === 0) continue;
        if (b.left < m.left - 1 || b.right > m.right + 1) out.push(`${sel} clipped`);
        if (b.right > right.left + 1) out.push(`${sel} under the timer`);
      }
      return out;
    });
  const twoFrames = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const shown = (page: Page, sel: string) => page.locator(sel).evaluate((e) => e.getBoundingClientRect().width > 0);

  // GitHub's runner draws these in DejaVu Sans, wider than the Inter a
  // developer's machine may have: run them with
  // FONTCONFIG_FILE=$PWD/tests/e2e/ci-fonts.conf to see the bar as CI does

  /** every width from a phone to a wide laptop: the bar fits, the level and the rating always show */
  async function sweep(page: Page, label: string) {
    for (let width = 320; width <= 1440; width += 20) {
      await page.setViewportSize({ width, height: 800 });
      // the bar is measured again after a resize (useRatingFit, RatingGauge.tsx)
      await twoFrames(page);
      expect(await misfits(page), `${label} at ${width} px`).toEqual([]);
      expect(await shown(page, '.game-meta .level-badge'), `${label} at ${width} px: the level`).toBe(true);
      expect(await shown(page, '.score-btn strong'), `${label} at ${width} px: the rating`).toBe(true);
      // the level's whole name: only a phone narrower than 360 px may shorten it, with its title still whole
      const badge = page.locator('.game-meta .level-badge');
      if (width >= 360) expect(await badge.evaluate((b) => b.scrollWidth <= b.clientWidth), `${label} at ${width} px: the whole name`).toBe(true);
      expect(await badge.getAttribute('title'), `${label} at ${width} px: the title`).toBe(await badge.textContent());
      // a phone keeps the compact form
      if (width <= 560) expect(await shown(page, '.rating-gauge'), `${label} at ${width} px: no gauge`).toBe(false);
      // a laptop has room for all of it
      if (width >= 1000) {
        expect(await shown(page, '.rating-gauge'), `${label} at ${width} px: the gauge`).toBe(true);
        expect(await shown(page, '.rating-word'), `${label} at ${width} px: the words`).toBe(true);
      }
    }
  }

  for (const { path, word } of LANGS) {
    test(`fits every width from 320 to 1440 px, with the words and the gauge where there is room (${path})`, async ({ page }) => {
      const errors = errorsOf(page);
      await openPuzzle(page, path, 1440, NIGHTMARE, '3020');
      await sweep(page, `${path} Extreme 3020`);
      await page.setViewportSize({ width: 1280, height: 800 });
      await expect(page.locator('.rating-word')).toHaveText(new RegExp(`^${word}`));
      expect(errors).toEqual([]);
    });
  }

  test('fits every width with the widest level name too, Urettferdig with a four-figure rating', async ({ page }) => {
    const errors = errorsOf(page);
    await openPuzzle(page, '/nb/', 1440, UNFAIR, '1800');
    await expect(page.locator('.game-meta .level-badge')).toHaveText('Urettferdig');
    await sweep(page, '/nb/ Unfair 1800');
    expect(errors).toEqual([]);
  });

  test('gives a practice badge its room before the gauge and the words', async ({ page }) => {
    const errors = errorsOf(page);
    await page.addInitScript(() => localStorage.setItem('sudokui-welcomed', '1'));
    await page.setViewportSize({ width: 1440, height: 800 });
    await page.goto('/es/#practice=X_CHAIN');
    await expect(page.locator('.practice-badge')).toBeVisible({ timeout: 15_000 });
    for (let width = 320; width <= 1440; width += 20) {
      await page.setViewportSize({ width, height: 800 });
      await twoFrames(page);
      expect(await misfits(page), `practice at ${width} px`).toEqual([]);
      const cut = await page.locator('.practice-badge').evaluate((b) => b.scrollWidth > b.clientWidth);
      // the technique's name is cut short only once the gauge and the words have gone
      if (cut) expect(await page.locator('.game-meta').getAttribute('data-fit'), `practice at ${width} px`).toBe('2');
    }
    expect(errors).toEqual([]);
  });

  /** the angle the needle is drawn at right now, from its computed transform, mid-transition too */
  const drawnAngle = (page: Page) =>
    page.locator('.gauge-needle').evaluate((n) => {
      const m = new DOMMatrix(getComputedStyle(n).transform);
      return (Math.atan2(m.b, m.a) * 180) / Math.PI;
    });

  for (const { name, puzzle, score, level } of [
    { name: 'a Nightmare rated 3020', puzzle: NIGHTMARE, score: 3020, level: 'Extreme' as const },
    { name: 'a puzzle Extreme by its technique, rated 1752', puzzle: FIREWORKS, score: 1752, level: 'Extreme' as const }
  ]) {
    test(`the gauge sweeps up into its level and hovers there, never past its place (${name})`, async ({ page }) => {
      const errors = errorsOf(page);
      await openPuzzle(page, '/', 1280, puzzle, String(score));
      const gauge = page.locator('.rating-gauge');
      await expect(gauge).toBeVisible();
      await expect(gauge).toHaveAttribute('aria-hidden', 'true');
      const target = dialAngle(level, score);
      // the sweep, as drawn: from zero up, never beyond the needle's hover
      const sweep: number[] = [];
      for (let i = 0; i < 30; i++) {
        sweep.push(await drawnAngle(page));
        await page.waitForTimeout(50);
      }
      for (const a of sweep) expect(a, 'the sweep').toBeLessThanOrEqual(target + TREMOR + 0.01);
      await page.waitForTimeout(2000);
      // then it hovers: a tremor either way of its place, and never still
      const seen = new Set<number>();
      for (let i = 0; i < 16; i++) {
        const a = await drawnAngle(page);
        expect(a, 'hovering').toBeGreaterThanOrEqual(target - TREMOR - 0.01);
        expect(a, 'hovering').toBeLessThanOrEqual(target + TREMOR + 0.01);
        seen.add(Math.round(a * 100));
        await page.waitForTimeout(150);
      }
      expect(seen.size).toBeGreaterThan(1);
      // and its place lies inside Extreme's arc, 144 to 180 degrees
      expect(target - TREMOR).toBeGreaterThan(144);
      expect(target + TREMOR).toBeLessThan(180);
      expect(errors).toEqual([]);
    });
  }

  test('with reduced motion the needle stands at its place', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPuzzle(page, '/', 1280, NIGHTMARE, '3020');
    const target = dialAngle('Extreme', 3020);
    await page.waitForTimeout(300);
    const first = await drawnAngle(page);
    expect(first).toBeCloseTo(target, 3);
    await page.waitForTimeout(1500);
    expect(await drawnAngle(page)).toBeCloseTo(first, 6);
  });
});
