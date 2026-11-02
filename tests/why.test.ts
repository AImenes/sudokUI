/**
 * Why sudokUI? (src/content/why.ts): one copy in three languages, shown as
 * the static page /why/ that search engines read and as the app's dialog
 */
import { describe, it, expect } from 'vitest';
import { WHY, WHY_URL } from '../src/content/why';
import { PRIVACY_URL } from '../src/content/privacy';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { buildLearnPages, buildSitemap, SITE } from '../src/content/learnPages';

const LANGS = ['en', 'nb', 'es'] as const;
const at = (lang: string, url: string) => `${lang === 'en' ? '' : `/${lang}`}${url}`;

describe('Why sudokUI?', () => {
  const pages = buildLearnPages();
  const byLang = Object.fromEntries(LANGS.map((l) => [l, pages.find((p) => p.url === at(l, WHY_URL))!]));

  it('is a page in every language, built alike, with its links filled in', () => {
    for (const lang of LANGS) {
      const page = byLang[lang];
      const c = WHY[lang];
      expect(page, lang).toBeDefined();
      expect(page.lang).toBe(lang);
      expect(page.alternateOf).toBe(WHY_URL);
      expect(page.html).toContain(`<h1>${c.name}</h1>`);
      for (const s of c.sections) expect(page.html).toContain(`<h2>${s.heading}</h2>`);
      expect(page.html).toContain(`<a href="${at(lang, PRIVACY_URL)}">${c.privacyLink}</a>`);
      expect(page.html).toContain(c.feedbackLink);
      expect(page.html).not.toMatch(/\{(privacy|feedback)\}/);
      expect(c.sections.map((s) => s.paragraphs.length)).toEqual(WHY.en.sections.map((s) => s.paragraphs.length));
    }
  });

  it('reads well in a search result: a title and a line that fit, the teaching first, every language its own', () => {
    for (const lang of LANGS) {
      const c = WHY[lang];
      expect(c.title.length, lang).toBeLessThanOrEqual(60);
      expect(c.description.length, lang).toBeLessThanOrEqual(160);
      expect(byLang[lang].html).toContain(`<title>${c.title}</title>`);
      expect(byLang[lang].html).toContain(c.description);
      if (lang !== 'en') {
        expect(c.lead).not.toBe(WHY.en.lead);
        expect(c.description).not.toBe(WHY.en.description);
      }
    }
    // the hint that teaches comes before what the app leaves out (docs/reach-plan-2026-11.md)
    expect(WHY.en.description.indexOf('technique')).toBeLessThan(WHY.en.description.indexOf('no ads'));
  });

  it('is a static page the service worker leaves alone, in the sitemap, and in every footer', () => {
    for (const url of [WHY_URL, '/nb/why/', '/es/why', '/why']) expect(STATIC_ROUTES.test(url), url).toBe(true);
    const sitemap = buildSitemap(pages);
    for (const lang of LANGS) expect(sitemap).toContain(`<loc>${SITE}${byLang[lang].url}</loc>`);
    for (const page of pages) expect(page.html, page.url).toContain(`<a href="${at(page.lang, WHY_URL)}">${WHY[page.lang as 'en'].name}</a>`);
  });
});
