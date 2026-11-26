/**
 * The web manifest as the build serves it (src/content/manifest.ts;
 * tests/manifest.test.ts holds the source): the page links it; it carries
 * an id, a start address, a scope, the two shortcuts and the install
 * sheet's two pictures; each picture is served, at its size, and is not in
 * the service worker's precache; and each shortcut's address opens what
 * it names: today's daily, and the technique guide.
 */
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test('the built manifest carries its id, scope, shortcuts and pictures, and the pictures are not precached', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('/manifest.webmanifest');
  const manifest = await (await request.get(href!)).json();
  expect(manifest).toMatchObject({ id: '/', start_url: '/', scope: '/', lang: 'en' });
  expect(manifest.shortcuts.map((s: { name: string; url: string }) => [s.name, s.url])).toEqual([
    ['Today’s daily', '/#daily'],
    ['Learn', '/#learn=techniques']
  ]);
  expect(manifest.screenshots.map((s: { form_factor: string; sizes: string }) => [s.form_factor, s.sizes])).toEqual([
    ['narrow', '1080x1920'],
    ['wide', '1280x800']
  ]);
  const sw = await (await request.get('/sw.js')).text();
  expect(sw).toContain('manifest.webmanifest');
  for (const shot of manifest.screenshots as { src: string; sizes: string }[]) {
    const res = await request.get(`/${shot.src}`);
    expect(res.status(), shot.src).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    const png = await res.body();
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(shot.sizes);
    expect(sw, `${shot.src} is not precached`).not.toContain(shot.src);
  }
});

test('the shortcuts open today’s daily and the technique guide', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T12:00:00'));
  await page.goto('/#daily');
  await expect(page.locator('.toast')).toContainText('Daily puzzle for 2026-10-15. Everyone gets this same board today');
  await expect.poll(() => page.evaluate(() => location.pathname)).toBe('/daily/2026-10-15');
  await page.goto('/#learn=techniques');
  const learn = page.getByRole('dialog', { name: 'Learn' });
  await expect(learn).toBeVisible();
  await expect(learn.getByRole('tab', { name: 'Techniques' })).toHaveAttribute('aria-selected', 'true');
});
