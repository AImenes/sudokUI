/**
 * The pause card's tips in a real browser (src/ui/tips.ts): the card shows
 * one that fits the device, and every tip of the bank, in every language,
 * keeps the card inside the board on a 320 px phone with Nutella shown:
 * the tip is drawn at random, so one that did not fit would fail a run
 * only now and then (as it did on CI on 23 November 2026).
 */
import { test, expect } from '@playwright/test';
import { TIPS, tipsFor } from '../../src/ui/tips';
import nb from '../../src/content/locales/ui.nb';
import es from '../../src/content/locales/ui.es';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const said = (table: Record<string, string>, tip: string) => table['Did you know? {tip}'].replace('{tip}', table[tip]);

test.use({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true });

test('on a 320 px phone every tip, in en, nb and es, keeps the pause card inside the board, Nutella shown', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('sudokui-welcomed', '1');
    localStorage.setItem('sudokui-settings-v1', JSON.stringify({ state: { showPoodle: true }, version: 1 }));
  });
  await page.goto(`/#p=${EASY}`);
  await expect(page.locator('svg.board')).toBeVisible();
  const box = (await page.locator('svg.board').boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 18, box.y + box.height / 18);
  await page.getByRole('button', { name: '4', exact: true }).tap();
  await page.getByRole('button', { name: 'Pause game' }).tap();
  const card = page.locator('.pause-card');
  await expect(card).toBeVisible();
  // the tip shown is one for a phone in a browser tab: no keyboard shortcut
  const phone = tipsFor({ keys: false, touch: true, tab: true, advent: true }).map((t) => `Did you know? ${t.text}`);
  expect(phone).toContain(await card.locator('.pause-tip').innerText());
  const texts = TIPS.flatMap((t) => [`Did you know? ${t.text}`, said(nb as Record<string, string>, t.text), said(es as Record<string, string>, t.text)]);
  expect(texts.length).toBe(TIPS.length * 3);
  const outside = await page.evaluate((all) => {
    const b = document.querySelector('svg.board')!.getBoundingClientRect();
    const tip = document.querySelector('.pause-card .pause-tip')!;
    const bad: string[] = [];
    for (const text of all) {
      tip.textContent = text;
      for (const part of document.querySelectorAll('.pause-card h3, .pause-card .pause-tip, .pause-card .resume-btn, .pause-card .pause-poodle, .pause-card .pause-brand')) {
        const p = part.getBoundingClientRect();
        if (p.top < b.top || p.bottom > b.bottom || p.left < b.left || p.right > b.right) bad.push(`${part.className || part.tagName}: ${text}`);
      }
    }
    return bad;
  }, texts);
  expect(outside).toEqual([]);
});
