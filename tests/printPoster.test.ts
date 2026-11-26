/**
 * The advent calendar's posters and flyers (scripts/print-poster.ts,
 * promo/print/): each committed sheet is there as a PDF of one page of its
 * paper and a PNG preview, and every QR code on every preview reads back,
 * with a QR decoder, as the exact address it should open: the calendar's
 * page in the sheet's language with the poster tag, which the Worker
 * counts as `poster`. The code is measured on the preview too: at least
 * 3 cm across on a flyer, larger on a poster. How a sheet looks is judged
 * by eye; this holds what can break unseen, such as a code that no longer
 * opens the right page after a change of address.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { A4, A4_LANDSCAPE, A5, CODE_ALONE, OUT_DIR, PREVIEW_SCALE, PRINT_LANGS, PT_PER_MM, PX_PER_MM, POSTER_TAG, QR_MM, SHEETS, qrAddress, typedAddress } from '../scripts/print-poster/sheets';
import { pdfPages, pngDpi, pngModules, pngSize, readCodes, svgModules, svgWidthMm } from '../scripts/print-poster/read';
import { LINK_TAGS, landingWord } from '../worker/telemetry';
import { CALENDAR_PATHS } from '../worker/index';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import viteConfig from '../vite.config.ts?raw';

const file = (name: string) => `${OUT_DIR}/${name}`;
/** an iPhone's camera opening the code: a person's browser, a navigation, no referrer */
const scanned = (address: string) =>
  new Request(address, {
    headers: {
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document'
    }
  });
/** an Android phone opening the code from the app that scanned it, which a Custom Tab names as the referrer */
const scannedIn = (address: string, app: string) =>
  new Request(address, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Linux; Android 15; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-dest': 'document',
      referer: `android-app://${app}/`
    }
  });

describe('the posters and flyers of the advent calendar', () => {
  it('opens the calendar’s page in its language with the poster tag, which the Worker counts as poster', () => {
    expect(qrAddress('nb')).toBe('https://sudokui.app/nb/julekalender/?utm_source=poster');
    expect(qrAddress('en')).toBe('https://sudokui.app/advent/?utm_source=poster');
    expect(typedAddress('nb')).toBe('sudokui.app/nb/julekalender');
    expect(typedAddress('en')).toBe('sudokui.app/advent');
    expect(LINK_TAGS as readonly string[]).toContain(POSTER_TAG);
    for (const lang of PRINT_LANGS) {
      // the page the code opens is one the Worker counts a landing on, and one an installed
      // app's service worker leaves to the network, tag and all, so a player's scan counts too
      const { pathname, search } = new URL(qrAddress(lang));
      expect(CALENDAR_PATHS).toContain(pathname);
      expect(STATIC_ROUTES.test(pathname + search)).toBe(true);
      expect(landingWord(scanned(qrAddress(lang)))).toBe('poster');
      // Google Lens in the Google app, Lens's own app and a Samsung camera: still poster
      for (const app of ['com.google.android.googlequicksearchbox', 'com.google.ar.lens', 'com.sec.android.app.camera'])
        expect(landingWord(scannedIn(qrAddress(lang), app)), app).toBe('poster');
      // the address written out for typing has no tag: a typed address counts as none, as it should
      expect(landingWord(scanned(`https://${typedAddress(lang)}/`))).toBe('none');
    }
  });

  it('has a poster, a flyer and a sheet of two flyers in Norwegian and in English, each a PDF and a PNG, the code alone, and nothing else', () => {
    expect(SHEETS.map((s) => s.name).sort()).toEqual(
      ['advent-poster-a4', 'advent-flyer-a5', 'advent-flyers-2up-a4'].flatMap((n) => [`${n}.nb`, `${n}.en`]).sort()
    );
    for (const s of SHEETS) {
      expect(existsSync(file(`${s.name}.pdf`)), s.name).toBe(true);
      expect(existsSync(file(`${s.name}.png`)), s.name).toBe(true);
    }
    const made = readdirSync(OUT_DIR).filter((f) => f !== 'README.md');
    const alone = PRINT_LANGS.flatMap((lang) => [`${CODE_ALONE.name(lang)}.svg`, `${CODE_ALONE.name(lang)}.png`]);
    expect(made.sort()).toEqual([...SHEETS.flatMap((s) => [`${s.name}.pdf`, `${s.name}.png`]), ...alone].sort());
    expect(existsSync(file('README.md'))).toBe(true);
  });

  it('prints each PDF as one page of its paper', () => {
    const paper = { poster: A4, flyer: A5, flyers: A4_LANDSCAPE };
    for (const s of SHEETS) {
      expect(s.paper, s.name).toBe(paper[s.kind]);
      const pages = pdfPages(readFileSync(file(`${s.name}.pdf`)));
      expect(pages, s.name).toHaveLength(1);
      // Chromium rounds a page to its own pixels: within 0.6 point (0.2 mm) of the paper, which a printer
      // still takes as A4 or A5 (the README says so)
      expect(Math.abs(pages[0][0] - s.paper.w * PT_PER_MM), s.name).toBeLessThan(0.6);
      expect(Math.abs(pages[0][1] - s.paper.h * PT_PER_MM), s.name).toBeLessThan(0.6);
    }
  });

  it('reads every code on every preview back as the exact address, and finds it large enough to scan', () => {
    for (const s of SHEETS) {
      const png = readFileSync(file(`${s.name}.png`));
      const [w, h] = pngSize(png);
      // the preview is the paper, at the scale the script draws it
      expect(Math.abs(w - s.paper.w * PX_PER_MM * PREVIEW_SCALE), s.name).toBeLessThan(3);
      expect(Math.abs(h - s.paper.h * PX_PER_MM * PREVIEW_SCALE), s.name).toBeLessThan(3);
      const codes = readCodes(png, s.codes);
      expect(codes, s.name).toHaveLength(s.codes);
      for (const code of codes) {
        expect(code?.data, s.name).toBe(qrAddress(s.lang));
        // the code itself, quiet zone aside, as printed: at least 3 cm on a flyer, more on a poster
        const mm = code!.widthPx / (PX_PER_MM * PREVIEW_SCALE);
        expect(mm, s.name).toBeGreaterThanOrEqual(s.kind === 'poster' ? 60 : 30);
        // and as wide as the script says it draws it, its quiet zone of four modules on each side taken off
        expect(Math.abs(mm - (s.qrMm * code!.modules) / (code!.modules + 8)), s.name).toBeLessThan(0.5);
      }
    }
    expect(QR_MM.poster).toBeGreaterThan(QR_MM.flyer);
  });

  it('has the code alone for a newsletter: an SVG that says its width and a 600 dpi PNG, the same modules, read back as the exact address', () => {
    for (const lang of PRINT_LANGS) {
      const name = CODE_ALONE.name(lang);
      const png = readFileSync(file(`${name}.png`));
      const svg = new TextDecoder().decode(readFileSync(file(`${name}.svg`)));
      const code = readCodes(png)[0];
      expect(code?.data, name).toBe(qrAddress(lang));
      // printed about 40 mm wide with its white border, which leaves at least 3 cm of code
      expect(pngDpi(png), name).toBe(CODE_ALONE.dpi);
      const [w, h] = pngSize(png);
      expect(w, name).toBe(h);
      expect(Math.abs((w / CODE_ALONE.dpi) * 25.4 - CODE_ALONE.mm), name).toBeLessThan(0.5);
      expect((code!.widthPx / CODE_ALONE.dpi) * 25.4, name).toBeGreaterThanOrEqual(30);
      expect(svgWidthMm(svg), name).toBe(CODE_ALONE.mm);
      // the SVG draws the same code as the PNG, module for module, its quiet zone of four included
      const grid = svgModules(svg);
      expect(grid.length, name).toBe(code!.modules + 8);
      expect(pngModules(png, grid.length), name).toEqual(grid);
      for (const row of [...grid.slice(0, 4), ...grid.slice(-4)]) expect(row.every((dark) => !dark), name).toBe(true);
    }
  });

  it('keeps the sheets out of the site and its precache: they are for printing, not serving', () => {
    expect(OUT_DIR.startsWith('public')).toBe(false);
    // the precache takes what dist/ holds, which is public/ and the build: no PDF is there
    const listed = (dir: string): string[] | null => {
      try {
        return readdirSync(dir);
      } catch {
        return null;
      }
    };
    const pdfs = (dir: string): string[] => (listed(dir) ?? []).flatMap((f) => (f.endsWith('.pdf') ? [`${dir}/${f}`] : listed(`${dir}/${f}`) ? pdfs(`${dir}/${f}`) : []));
    expect(pdfs('public')).toEqual([]);
    expect(viteConfig).not.toContain('promo');
  });
});
