// The web manifest (src/content/manifest.ts): what a browser reads to
// install sudokUI. Its id, start address and scope; the shortcuts a long
// press on the installed icon offers, each an address the app opens as
// the shortcut says; and the install sheet's two pictures, which must be
// in public/ at the sizes the manifest gives and never in the service
// worker's precache. The built manifest is checked in the browser test
// (tests/e2e/manifest.spec.ts).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { WEB_MANIFEST, MANIFEST_SCREENSHOTS, SCREENSHOTS_GLOB } from '../src/content/manifest';
import { readAppLink } from '../src/content/share';

/** a PNG's width and height, from its header */
const pngSize = (path: string) => {
  const b = readFileSync(path);
  expect(String.fromCharCode(...b.subarray(1, 4))).toBe('PNG');
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return `${view.getUint32(16)}x${view.getUint32(20)}`;
};
const at = (url: string) => {
  const u = new URL(url, 'https://sudokui.app');
  return { pathname: u.pathname, search: u.search, hash: u.hash };
};

describe('the web manifest', () => {
  it('names the app by an id, starts at the home page and covers the whole site', () => {
    expect(WEB_MANIFEST).toMatchObject({ id: '/', start_url: '/', scope: '/', lang: 'en', display: 'standalone' });
  });

  it('offers today’s daily and Learn on a long press, in English, each an address the app opens', () => {
    expect(WEB_MANIFEST.shortcuts.map((s) => [s.name, s.url])).toEqual([
      ['Today’s daily', '/#daily'],
      ['Learn', '/#learn=techniques']
    ]);
    // #daily is today's daily, whatever the day
    expect(readAppLink(at(WEB_MANIFEST.shortcuts[0].url), '2026-12-03')).toEqual({ daily: { date: '2026-12-03' } });
    // #learn= opens the guide and is no game link: the game on the board stays
    expect(readAppLink(at(WEB_MANIFEST.shortcuts[1].url))).toBeNull();
    for (const s of WEB_MANIFEST.shortcuts) {
      expect(s.short_name.length).toBeLessThanOrEqual(12);
      for (const icon of s.icons) expect(pngSize(`public/${icon.src}`)).toBe(icon.sizes);
    }
  });

  it('has a narrow and a wide picture for the install sheet, each a file of its size', () => {
    expect(MANIFEST_SCREENSHOTS.map((s) => s.form_factor)).toEqual(['narrow', 'wide']);
    expect(WEB_MANIFEST.screenshots).toBe(MANIFEST_SCREENSHOTS);
    for (const shot of MANIFEST_SCREENSHOTS) {
      expect(existsSync(`public/${shot.src}`)).toBe(true);
      expect(pngSize(`public/${shot.src}`)).toBe(shot.sizes);
      expect(shot.type).toBe('image/png');
      expect(shot.label.length).toBeGreaterThan(10);
    }
    const [narrow, wide] = MANIFEST_SCREENSHOTS.map((s) => s.sizes.split('x').map(Number));
    expect(narrow[1]).toBeGreaterThan(narrow[0]);
    expect(wide[0]).toBeGreaterThan(wide[1]);
  });

  it('keeps the pictures out of the service worker’s precache', () => {
    const config = new TextDecoder().decode(readFileSync('vite.config.ts'));
    expect(config).toMatch(/globIgnores: \[[^\]]*SCREENSHOTS_GLOB\]/);
    expect(config).toContain('manifest: WEB_MANIFEST');
    expect(MANIFEST_SCREENSHOTS.every((s) => s.src.startsWith(SCREENSHOTS_GLOB.replace('/**', '/')))).toBe(true);
  });
});
