// The home page in its three languages (src/content/home.ts filling
// index.html): every version complete, built the same way, pointing at its
// own language, and saying in Norwegian and Spanish what the English says.
// Then the 404 pages, which Cloudflare serves from the nearest folder up
// (wrangler.jsonc): public/404.html, public/nb/404.html, public/es/404.html.
import { describe, it, expect } from 'vitest';
import template from '../index.html?raw';
import notFoundEn from '../public/404.html?raw';
import notFoundNb from '../public/nb/404.html?raw';
import notFoundEs from '../public/es/404.html?raw';
import {
  HOME,
  HOME_LANGS,
  HomeCopy,
  renderHome,
  homePath,
  homeLangOfPath,
  structuredData,
  APP_NAVIGATION,
  BOOT_LINKS,
  SITE as HOME_SITE
} from '../src/content/home';
import { LANGS, langOfPath, langRoot } from '../src/content/i18n';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { COUNTS } from '../src/content/landing';
import { buildLearnPages, SITE } from '../src/content/learnPages';
import type { Lang } from '../src/state/settings';

const OTHER: Lang[] = ['nb', 'es'];
const PAGE = Object.fromEntries(HOME_LANGS.map((l) => [l, renderHome(template, l)])) as Record<Lang, string>;
const OG_LOCALE: Record<Lang, string> = { en: 'en_GB', nb: 'nb_NO', es: 'es_ES' };

/** the page with every attribute value and every text emptied: what is left is its structure */
const structure = (html: string) =>
  html
    .replace(/\r\n/g, '\n')
    .replace(/"[^"]*"/g, '""')
    .replace(/>[^<]*</g, '><');

const one = (html: string, re: RegExp) => {
  const all = [...html.matchAll(new RegExp(re, 'g'))];
  expect(all.length, String(re)).toBe(1);
  return all[0][1];
};
const meta = (html: string, key: string) =>
  [...html.matchAll(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`, 'g'))].map((m) => m[1]);

/** the copy's texts, each with where it sits */
const texts = (c: HomeCopy): [string, string][] =>
  Object.entries(c).flatMap(([field, v]) =>
    Array.isArray(v) ? v.map((s, i): [string, string] => [`${field}[${i}]`, s]) : [[field, v] as [string, string]]
  );

/** the words of a text, lower case; X-Wing and HoDoKu-compatible are one word each */
const words = (text: string) => text.toLowerCase().match(/\p{L}[\p{L}\d'-]*/gu) ?? [];

/**
 * Words a translation may share with the English: the brand, HoDoKu,
 * technique names, and words the language itself writes the same way
 * (Norwegian "hint", "for"; Spanish "app", "online", "paso a paso").
 */
const SHARED = new Set(['sudokui', 'sudoku', 'hodoku', 'x-wing', 'exocet', 'javascript', 'app', 'hint', 'online', 'for', 'a']);
const englishLeft = (english: string[], translated: string[]) => {
  const vocabulary = new Set(english.flatMap(words));
  return [...new Set(translated.flatMap(words))].filter((w) => vocabulary.has(w) && !SHARED.has(w));
};

/** every address the build writes a page for: the home pages and the static pages */
const PAGES = new Set([...HOME_LANGS.map(homePath), ...buildLearnPages().map((p) => p.url)]);

describe('the home page', () => {
  it('fills every placeholder, and refuses a template that has lost or gained one', () => {
    for (const lang of HOME_LANGS) expect(PAGE[lang]).not.toContain('<!--home:');
    expect(() => renderHome(template.replace('<!--home:boot-->', ''), 'en')).toThrow(/home:boot/);
    expect(() => renderHome(template + '<!--home:footer-->', 'en')).toThrow(/home:footer/);
  });

  it('is built the same way in every language', () => {
    for (const lang of OTHER) expect(structure(PAGE[lang]), lang).toBe(structure(PAGE.en));
    for (const lang of OTHER) {
      for (const key of Object.keys(HOME.en) as (keyof HomeCopy)[]) {
        const en = HOME.en[key];
        if (Array.isArray(en)) expect((HOME[lang][key] as string[]).length, `${lang} ${key}`).toBe(en.length);
      }
    }
  });

  it('serves the languages the app has, at the addresses the app reads', () => {
    expect(HOME_LANGS).toEqual(LANGS.map((l) => l.value));
    expect(HOME_SITE).toBe(SITE);
    for (const lang of HOME_LANGS) expect(homePath(lang)).toBe(langRoot(lang));
    for (const path of ['/', '/nb/', '/es/', '/nb', '/es', '/nb/learn/', '/de/', '/index.html', '/learn/', '/nbx/'])
      expect(homeLangOfPath(path), path).toBe(langOfPath(path));
  });

  it('names its language, its own address and the other two', () => {
    for (const lang of HOME_LANGS) {
      const html = PAGE[lang];
      const self = SITE + homePath(lang);
      expect(one(html, /<html lang="([^"]*)">/)).toBe(lang);
      expect(one(html, /<link rel="canonical" href="([^"]*)"/)).toBe(self);
      expect(meta(html, 'og:url')).toEqual([self]);
      const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)];
      expect(Object.fromEntries(alternates.map((m) => [m[1], m[2]]))).toEqual({
        en: `${SITE}/`,
        nb: `${SITE}/nb/`,
        es: `${SITE}/es/`,
        'x-default': `${SITE}/`
      });
      expect(alternates).toHaveLength(4);
      expect(meta(html, 'og:locale')).toEqual([OG_LOCALE[lang]]);
      expect(meta(html, 'og:locale:alternate')).toEqual(HOME_LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]));
      expect(meta(html, 'og:title')).toHaveLength(1);
      expect(meta(html, 'og:description')).toHaveLength(1);
      expect(meta(html, 'og:image:alt')).toHaveLength(1);
      expect(meta(html, 'description')).toHaveLength(1);
    }
  });

  it('describes the app in structured data, in its language', () => {
    for (const lang of HOME_LANGS) {
      const json = one(PAGE[lang], /<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      const data = JSON.parse(json);
      // the page carries exactly what structuredData() says
      expect(data).toEqual(structuredData(lang));
      const [site, app] = data['@graph'];
      const self = SITE + homePath(lang);
      expect(site['@type']).toBe('WebSite');
      expect(app['@type']).toBe('WebApplication');
      expect(site.inLanguage).toBe(lang);
      expect(app.inLanguage).toBe(lang);
      expect(site.url).toBe(self);
      expect(app.url).toBe(self);
      expect(app.isPartOf['@id']).toBe(site['@id']);
      expect(app.featureList).toEqual(HOME[lang].features);
      expect(app.description).toBe(HOME[lang].appDescription);
      const shape = (o: unknown): unknown =>
        Array.isArray(o) ? o.map(shape) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)])) : typeof o;
      expect(shape(data)).toEqual(shape(structuredData('en')));
    }
  });

  it('keeps titles and descriptions to what search results show', () => {
    // English keeps its bare tab title
    expect(HOME.en.title).toBe('sudokUI');
    for (const lang of OTHER) {
      const { title, description } = HOME[lang];
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(title.length, title).toBeGreaterThanOrEqual(40);
      expect(title).toMatch(/ \| sudokUI$/);
      expect(title.toLowerCase()).toContain('sudoku gratis');
      expect(description.length, description).toBeGreaterThanOrEqual(120);
    }
    for (const lang of HOME_LANGS) {
      expect(HOME[lang].description.length, HOME[lang].description).toBeLessThanOrEqual(160);
      expect(HOME[lang].ogTitle.length).toBeLessThanOrEqual(90);
      expect(HOME[lang].ogDescription.length).toBeLessThanOrEqual(240);
    }
  });

  it('quotes the catalogue: the same numbers in every language', () => {
    const numbers = (s: string) => s.match(/\d+/g) ?? [];
    const allowed = [String(COUNTS.implemented), String(COUNTS.practice)];
    const en = Object.fromEntries(texts(HOME.en));
    for (const n of Object.values(en).flatMap(numbers)) expect(allowed).toContain(n);
    expect(numbers(en.intro)).toEqual(allowed);
    expect(numbers(en.description)).toEqual([String(COUNTS.practice)]);
    for (const lang of OTHER) {
      const copy = texts(HOME[lang]);
      expect(copy.map(([field]) => field)).toEqual(Object.keys(en));
      for (const [field, text] of copy) expect(numbers(text), `${lang} ${field}`).toEqual(numbers(en[field]));
    }
  });

  it('links to pages in its own language, every one of which exists', () => {
    for (const lang of HOME_LANGS) {
      const boot = one(PAGE[lang], /<div class="boot">([\s\S]*?)<\/div>/);
      const local = [...boot.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
      expect(local).toEqual(BOOT_LINKS.map((path) => (lang === 'en' ? path : `/${lang}${path}`)));
      for (const href of local) expect(PAGES.has(href), href).toBe(true);
      expect(boot).toContain('<a href="https://github.com/AImenes/sudokUI">github.com/AImenes/sudokUI</a>');
      expect(boot).toContain(`<h1>${HOME[lang].h1}</h1>`);
    }
  });

  it('leaves no English in the Norwegian and Spanish copy beyond names', () => {
    const english = texts(HOME.en).map(([, t]) => t);
    for (const lang of OTHER) expect(englishLeft(english, texts(HOME[lang]).map(([, t]) => t)), lang).toEqual([]);
  });

  it('lets the service worker answer only the home addresses with the app', () => {
    for (const url of ['/', '/?utm_source=x', '/nb/', '/es/', '/nb/?gclid=1', '/es/?a=b&c=d'])
      expect(APP_NAVIGATION.test(url), url).toBe(true);
    for (const url of ['/nb', '/nb/learn/', '/es/hodoku/', '/learn/', '/de/', '/nb/x', '/index.html', '/nb/index.html'])
      expect(APP_NAVIGATION.test(url), url).toBe(false);
    // and no home address is mistaken for a static page
    for (const lang of HOME_LANGS) expect(STATIC_ROUTES.test(homePath(lang))).toBe(false);
  });
});

describe('the 404 pages', () => {
  const PAGE404: Record<Lang, string> = { en: notFoundEn, nb: notFoundNb, es: notFoundEs };
  const visible = (html: string) => [
    one(html, /<title>([^<]*)<\/title>/),
    html.slice(html.indexOf('<body>')).replace(/<[^>]+>/g, ' ')
  ];

  it('exist in every language, built the same way, kept out of search', () => {
    for (const lang of HOME_LANGS) {
      const html = PAGE404[lang];
      expect(one(html, /<html lang="([^"]*)">/)).toBe(lang);
      expect(html).toContain('<meta name="robots" content="noindex" />');
      expect(one(html, /<title>([^<]*)<\/title>/)).toMatch(/ \| sudokUI$/);
      expect(structure(html), lang).toBe(structure(PAGE404.en));
    }
  });

  it('link to pages in their own language, every one of which exists', () => {
    for (const lang of HOME_LANGS) {
      // the pages, not the icon
      const links = [...PAGE404[lang].matchAll(/href="(\/(?:[^"]*\/)?)"/g)].map((m) => m[1]);
      expect(links).toHaveLength(4);
      expect(links[0]).toBe(homePath(lang));
      for (const href of links) {
        expect(PAGES.has(href), href).toBe(true);
        if (lang === 'en') expect(href).not.toMatch(/^\/(nb|es)\//);
        else expect(href.startsWith(`/${lang}/`), href).toBe(true);
      }
    }
  });

  it('leave no English in Norwegian and Spanish', () => {
    const english = visible(PAGE404.en);
    for (const lang of OTHER) expect(englishLeft(english, visible(PAGE404[lang])), lang).toEqual([]);
  });
});
