/**
 * Share links that preview (docs/online-goals.md, phase 1): the share
 * address of a puzzle and what it carries (src/content/share.ts), the
 * page a chat app or a crawler finds there, rendered from the app's
 * template in three languages, the Worker that renders it in production
 * (worker/index.ts), and the band cards the page points at (public/og/).
 * The position-link encoding (#s=) is tests/share.test.ts.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import template from '../index.html?raw';
import {
  parseShareUrl,
  sharePath,
  shareUrl,
  techsWorthNaming,
  shareCopy,
  renderSharePage,
  ogShareCard,
  clockOf,
  joinNames,
  levelName,
  techName,
  SHARE,
  SHARE_PATH,
  SHARE_TECHS,
  ShareParams,
  ShareCopy
} from '../src/content/share';
import { handleRequest, SHARE_TEMPLATE, Env } from '../worker/index';
import { APP_NAVIGATION, HOME_LANGS, SITE, homePath, ogCard, renderHome } from '../src/content/home';
import { LANGS, langOfPath, langRoot } from '../src/content/i18n';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { LEVELS, TECHS, Tech } from '../src/engine/ratings';
import { techSlug, techFromParam } from '../src/content/slugs';
import { ratePuzzle } from '../src/engine/humanSolver';
import * as namesNb from '../src/content/locales/names.nb';
import * as namesEs from '../src/content/locales/names.es';
import type { Lang } from '../src/state/settings';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
/** a Hard puzzle (rated 1348 when written) whose path plays named techniques */
const HARD = '...6..9.1..95....4....4985..241....5....3....9....546..7549....3....12..1.2..3...';
const OTHER: Lang[] = ['nb', 'es'];
const TECH_KEYS = Object.keys(TECHS) as Tech[];

const url = (path: string) => new URL(path, SITE);
const parse = (path: string) => parseShareUrl(url(path));

/** the meta tags with this property or name */
const meta = (html: string, key: string) =>
  [...html.matchAll(new RegExp(`<meta\\s+(?:property|name)="${key}"\\s+content="([^"]*)"`, 'g'))].map((m) => m[1]);
const one = (html: string, re: RegExp) => {
  const all = [...html.matchAll(new RegExp(re, 'g'))];
  expect(all.length, String(re)).toBe(1);
  return all[0][1];
};
/** the page with every attribute value and every text emptied: what is left is its structure */
const structure = (html: string) =>
  html
    .replace(/\r\n/g, '\n')
    .replace(/"[^"]*"/g, '""')
    .replace(/>[^<]*</g, '><');

/** the words of a text, placeholders left out, lower case; X-Wing is one word */
const words = (text: string) =>
  text
    .replace(/\{\w+\}/g, ' ')
    .toLowerCase()
    .match(/\p{L}[\p{L}\d'-]*/gu) ?? [];
/** words a translation may share with the English: the brand, and words the language writes the same way */
const SHARED = new Set(['sudokui', 'sudoku', 'javascript', 'app', 'hint', 'for', 'a', 'en']);
const englishLeft = (english: string[], translated: string[]) => {
  const vocabulary = new Set(english.flatMap(words));
  return [...new Set(translated.flatMap(words))].filter((w) => vocabulary.has(w) && !SHARED.has(w));
};
const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();

describe('the share address', () => {
  it('is /p/<puzzle> under the language root, with the hints as a query', () => {
    expect(sharePath({ lang: 'en', puzzle: EASY })).toBe(`/p/${EASY}`);
    expect(sharePath({ lang: 'nb', puzzle: EASY })).toBe(`/nb/p/${EASY}`);
    expect(sharePath({ lang: 'es', puzzle: EASY })).toBe(`/es/p/${EASY}`);
    expect(sharePath({ lang: 'en', puzzle: EASY, level: 'Hard', score: 1420, techs: ['X_WING', 'SKYSCRAPER'], vs: 552 })).toBe(
      `/p/${EASY}?b=hard&s=1420&t=x-wing,skyscraper&vs=552`
    );
    expect(shareUrl({ lang: 'nb', puzzle: EASY, level: 'Easy' })).toBe(`${SITE}/nb/p/${EASY}?b=easy`);
    expect(shareUrl({ lang: 'en', puzzle: EASY }, 'http://localhost:5173')).toBe(`http://localhost:5173/p/${EASY}`);
    for (const lang of HOME_LANGS) expect(sharePath({ lang, puzzle: EASY }).startsWith(homePath(lang))).toBe(true);
    for (const lang of HOME_LANGS) expect(homePath(lang)).toBe(langRoot(lang));
  });

  it('round-trips every hint, in every language and for every band', () => {
    for (const lang of HOME_LANGS) {
      for (const level of LEVELS) {
        const p: ShareParams = { lang, puzzle: EASY, level, score: 1420, techs: ['SKYSCRAPER', 'X_WING', 'HIDDEN_PAIR'], vs: 552 };
        expect(parseShareUrl(new URL(shareUrl(p)))).toEqual(p);
      }
      expect(parse(sharePath({ lang, puzzle: EASY }))).toEqual({ lang, puzzle: EASY });
    }
    // a trailing slash is the same address
    expect(parse(`/nb/p/${EASY}/`)).toEqual({ lang: 'nb', puzzle: EASY });
    // technique hints may be catalogue keys as well as slugs
    expect(parse(`/p/${EASY}?t=X_WING,skyscraper`)?.techs).toEqual(['X_WING', 'SKYSCRAPER']);
    for (const tech of TECH_KEYS) expect(parse(`/p/${EASY}?t=${techSlug(tech)}`)?.techs, tech).toEqual([tech]);
  });

  it('drops a hint that does not parse, and names at most three techniques', () => {
    expect(parse(`/p/${EASY}?b=nope&s=abc&t=unknown&vs=soon`)).toEqual({ lang: 'en', puzzle: EASY });
    expect(parse(`/p/${EASY}?b=HARD`)?.level).toBe('Hard');
    for (const bad of ['0', '-5', '1.5', '100000', '']) expect(parse(`/p/${EASY}?s=${bad}`)?.score, `s=${bad}`).toBeUndefined();
    for (const bad of ['0', '-1', '9.5', String(24 * 3600), '']) expect(parse(`/p/${EASY}?vs=${bad}`)?.vs, `vs=${bad}`).toBeUndefined();
    expect(parse(`/p/${EASY}?vs=${24 * 3600 - 1}`)?.vs).toBe(24 * 3600 - 1);
    expect(parse(`/p/${EASY}?t=x-wing,nothing,x-wing,skyscraper,swordfish,jellyfish`)?.techs).toEqual(['X_WING', 'SKYSCRAPER', 'SWORDFISH']);
    // the catalogue's own keys only: nothing inherited from Object counts
    for (const junk of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) expect(techFromParam(junk), junk).toBeUndefined();
    expect(parse(`/p/${EASY}?t=constructor,__proto__,x-wing,toString`)?.techs).toEqual(['X_WING']);
    expect(SHARE_TECHS).toBe(3);
    expect(sharePath({ lang: 'en', puzzle: EASY, techs: ['X_WING', 'SKYSCRAPER', 'SWORDFISH', 'JELLYFISH'] })).toBe(
      `/p/${EASY}?t=x-wing,skyscraper,swordfish`
    );
    // an unknown or empty level, score and time are not written
    expect(sharePath({ lang: 'en', puzzle: EASY, score: 0, vs: 0, techs: [] })).toBe(`/p/${EASY}`);
  });

  it('is nothing else: the path must be a puzzle', () => {
    for (const path of [
      '/',
      '/nb/',
      '/p/',
      '/p',
      `/p/${EASY.slice(1)}`,
      `/p/${EASY}1`,
      `/p/${EASY.replace('.', 'x')}`,
      `/de/p/${EASY}`,
      `/learn/p/${EASY}`,
      `/nb/p/${EASY}/x`,
      `/P/${EASY}`,
      `/${EASY}`
    ])
      expect(parse(path), path).toBeNull();
  });

  it('agrees with the service worker, the language roots and the static pages', () => {
    for (const lang of HOME_LANGS) {
      for (const path of [sharePath({ lang, puzzle: EASY }), sharePath({ lang, puzzle: EASY, level: 'Hard', score: 1, vs: 9 }), `${sharePath({ lang, puzzle: EASY })}/`]) {
        expect(APP_NAVIGATION.test(path), path).toBe(true);
        expect(STATIC_ROUTES.test(path), path).toBe(false);
        expect(langOfPath(path.split('?')[0]), path).toBe(lang === 'en' ? null : lang);
        expect(SHARE_PATH.test(path.split('?')[0]), path).toBe(true);
      }
    }
    for (const path of ['/p/', `/p/${EASY.slice(1)}`, `/nb/p/${EASY}/x`, `/de/p/${EASY}`]) {
      expect(APP_NAVIGATION.test(path), path).toBe(false);
      expect(SHARE_PATH.test(path), path).toBe(false);
      expect(langOfPath(path), path).toBeNull();
    }
    expect(HOME_LANGS).toEqual(LANGS.map((l) => l.value));
  });

  it('names the hardest techniques of a solve path, singles left out, three at most', () => {
    const rating = ratePuzzle(HARD)!;
    expect(rating.level).toBe('Hard');
    const named = techsWorthNaming(rating.steps.map((s) => s.tech));
    expect(named.length).toBeGreaterThan(0);
    expect(named.length).toBeLessThanOrEqual(SHARE_TECHS);
    for (const tech of named) {
      expect(rating.techniques[tech], tech).toBeGreaterThan(0);
      expect(TECHS[tech].level).not.toBe('Beginner');
    }
    // hardest first, by the catalogue's order
    for (let i = 1; i < named.length; i++) expect(TECHS[named[i - 1]].index).toBeGreaterThan(TECHS[named[i]].index);
    expect(techsWorthNaming(['NAKED_SINGLE', 'HIDDEN_SINGLE', 'FULL_HOUSE'])).toEqual([]);
    // brute force is the rater's way of finishing a puzzle the catalogue cannot, not a technique it needs
    expect(techsWorthNaming(['BRUTE_FORCE', 'X_WING'])).toEqual(['X_WING']);
    expect(techsWorthNaming(['X_WING', 'X_WING', 'SKYSCRAPER'])).toEqual(['SKYSCRAPER', 'X_WING'].sort((a, b) => TECHS[b as Tech].index - TECHS[a as Tech].index));
    expect(techsWorthNaming(['LOCKED_CANDIDATES_1', 'X_WING', 'SKYSCRAPER', 'SWORDFISH', 'JELLYFISH'])).toHaveLength(3);
  });

  it('writes a time as the app does', () => {
    expect(clockOf(552)).toBe('9:12');
    expect(clockOf(5)).toBe('0:05');
    expect(clockOf(60)).toBe('1:00');
    expect(clockOf(3661)).toBe('61:01');
  });
});

describe('the words of a share page', () => {
  const full: ShareParams = { lang: 'en', puzzle: EASY, level: 'Hard', score: 1420, techs: ['X_WING', 'SKYSCRAPER'] };

  it('exist in every language, built alike', () => {
    expect(Object.keys(SHARE).sort()).toEqual([...HOME_LANGS].sort());
    const keys = Object.keys(SHARE.en) as (keyof ShareCopy)[];
    for (const lang of OTHER) {
      expect(Object.keys(SHARE[lang]).sort(), lang).toEqual([...keys].sort());
      for (const key of keys) {
        expect(SHARE[lang][key].trim(), `${lang} ${key}`).not.toBe('');
        expect(placeholders(SHARE[lang][key]), `${lang} ${key}`).toEqual(placeholders(SHARE.en[key]));
      }
      // "needing …" is glued to the sentence before it, so it brings its own separator
      expect(SHARE[lang].needing, lang).toMatch(/^[ ,]/);
    }
    expect(SHARE.en.needing).toMatch(/^[ ,]/);
  });

  it('leave no English in the Norwegian and Spanish copy beyond names', () => {
    const english = Object.values(SHARE.en);
    for (const lang of OTHER) expect(englishLeft(english, Object.values(SHARE[lang])), lang).toEqual([]);
  });

  it('say what is known about the puzzle, and no more', () => {
    const c = shareCopy(full);
    expect(c.title).toBe('Hard sudoku, rated 1420 | sudokUI');
    expect(c.ogTitle).toBe('Can you solve this Hard sudoku?');
    expect(c.h1).toBe(c.ogTitle);
    expect(c.description).toBe('A Hard sudoku rated 1420, needing X-Wing and Skyscraper. Play it free on sudokUI, with hints that explain every step.');
    expect(c.ogImage).toBe(`${SITE}/og/hard.png`);
    expect(c.ogImageAlt).toBe('A Hard sudoku on sudokUI');

    const noScore = shareCopy({ ...full, score: undefined, techs: ['X_WING'] });
    expect(noScore.title).toBe('Hard sudoku | sudokUI');
    expect(noScore.description).toBe('A Hard sudoku, needing X-Wing. Play it free on sudokUI, with hints that explain every step.');

    const bare = shareCopy({ lang: 'en', puzzle: EASY });
    expect(bare.title).toBe('A sudoku to solve | sudokUI');
    expect(bare.ogTitle).toBe('Can you solve this sudoku?');
    expect(bare.description).toBe('A sudoku shared from sudokUI. Play it free, with hints that explain every step.');
    expect(bare.ogImage).toBe(ogCard('en'));
    expect(bare.ogImageAlt).toBe('A sudoku on sudokUI');
    // a score alone, with no band, is not quoted: the band gives it its meaning
    expect(shareCopy({ lang: 'en', puzzle: EASY, score: 1420 }).title).toBe(bare.title);
  });

  it('agrees the English article with the band: an Easy, an Unfair, an Extreme sudoku', () => {
    expect(shareCopy({ lang: 'en', puzzle: EASY, level: 'Easy', score: 600 }).description).toBe(
      'An Easy sudoku rated 600. Play it free on sudokUI, with hints that explain every step.'
    );
    expect(shareCopy({ lang: 'en', puzzle: EASY, level: 'Unfair', techs: ['X_WING'] }).description).toBe(
      'An Unfair sudoku, needing X-Wing. Play it free on sudokUI, with hints that explain every step.'
    );
    expect(shareCopy({ lang: 'en', puzzle: EASY, level: 'Extreme' }).ogImageAlt).toBe('An Extreme sudoku on sudokUI');
    expect(shareCopy({ lang: 'en', puzzle: EASY, level: 'Hard' }).ogImageAlt).toBe('A Hard sudoku on sudokUI');
    for (const level of LEVELS) {
      for (const lang of HOME_LANGS) {
        const c = shareCopy({ lang, puzzle: EASY, level, score: 1000, techs: ['X_WING'], vs: 61 });
        for (const text of [c.description, c.ogImageAlt]) {
          expect(text, `${lang} ${level}`).not.toMatch(/\bA [AEIOUaeiou]/);
          expect(text, `${lang} ${level}`).not.toMatch(/\bAn [^AEIOUaeiou]/);
          expect(text, `${lang} ${level}`).not.toContain('{');
        }
      }
    }
    expect(shareCopy({ lang: 'nb', puzzle: EASY, level: 'Easy', score: 600 }).description.startsWith('En sudoku på nivået Lett med poengsum 600.')).toBe(true);
    expect(shareCopy({ lang: 'es', puzzle: EASY, level: 'Easy', score: 600 }).description.startsWith('Un sudoku de nivel Fácil con puntuación 600.')).toBe(true);
  });

  it('put the challenge first when a time is set', () => {
    const c = shareCopy({ ...full, vs: 552 });
    expect(c.ogTitle).toBe('Solved in 9:12. Can you beat it?');
    expect(c.description).toBe(
      'Solved in 9:12 on sudokUI: can you beat it? A Hard sudoku rated 1420, needing X-Wing and Skyscraper. Play it free on sudokUI, with hints that explain every step.'
    );
    // the tab and the image stay the puzzle's
    expect(c.title).toBe('Hard sudoku, rated 1420 | sudokUI');
    expect(c.h1).toBe('Can you solve this Hard sudoku?');
    expect(c.ogImage).toBe(`${SITE}/og/hard.png`);
    expect(shareCopy({ lang: 'nb', puzzle: EASY, vs: 61 }).ogTitle).toBe('Løst på 1:01. Klarer du å slå det?');
    expect(shareCopy({ lang: 'es', puzzle: EASY, vs: 61 }).ogTitle).toBe('Resuelto en 1:01. ¿Puedes superarlo?');
  });

  it('name bands and techniques in the language, as the app does', () => {
    for (const level of LEVELS) {
      expect(levelName(level, 'en')).toBe(level);
      expect(levelName(level, 'nb')).toBe(namesNb.levels[level]);
      expect(levelName(level, 'es')).toBe(namesEs.levels[level]);
    }
    expect(techName('HIDDEN_SINGLE', 'nb')).toBe('Skjult singel');
    expect(techName('X_WING', 'nb')).toBe('X-Wing');
    expect(techName('X_WING', 'en')).toBe('X-Wing');
    for (const tech of TECH_KEYS) {
      expect(techName(tech, 'nb')).toBe(namesNb.techNames[tech] ?? TECHS[tech].name);
      expect(techName(tech, 'es')).toBe(namesEs.techNames[tech] ?? TECHS[tech].name);
    }
    const nb = shareCopy({ ...full, lang: 'nb' });
    expect(nb.title).toBe('Sudoku på nivået Vanskelig, poengsum 1420 | sudokUI');
    expect(nb.description).toContain(' som krever X-Wing og Skyscraper.');
    const es = shareCopy({ ...full, lang: 'es', techs: ['HIDDEN_PAIR', 'X_WING', 'SKYSCRAPER'] });
    expect(es.title).toBe('Sudoku de nivel Difícil, puntuación 1420 | sudokUI');
    expect(es.description).toContain(` que requiere ${techName('HIDDEN_PAIR', 'es')}, X-Wing y Skyscraper.`);
    expect(joinNames([], 'and')).toBe('');
    expect(joinNames(['A'], 'and')).toBe('A');
    expect(joinNames(['A', 'B'], 'og')).toBe('A og B');
    expect(joinNames(['A', 'B', 'C'], 'y')).toBe('A, B y C');
  });

  it('stay within what a tab and a preview show, at their longest', () => {
    for (const lang of HOME_LANGS) {
      const longest = [...TECH_KEYS].sort((a, b) => techName(b, lang).length - techName(a, lang).length).slice(0, SHARE_TECHS);
      for (const level of LEVELS) {
        const c = shareCopy({ lang, puzzle: EASY, level, score: 99999, techs: longest, vs: 24 * 3600 - 1 });
        expect(c.title.length, c.title).toBeLessThanOrEqual(70);
        expect(c.ogTitle.length, c.ogTitle).toBeLessThanOrEqual(90);
        expect(c.description.length, c.description).toBeLessThanOrEqual(300);
      }
    }
  });
});

describe('the share page', () => {
  const full: ShareParams = { lang: 'en', puzzle: EASY, level: 'Hard', score: 1420, techs: ['X_WING', 'SKYSCRAPER'], vs: 552 };
  const page = (p: ShareParams) => renderSharePage(template, p);

  it('fills every placeholder of the app template, in every language', () => {
    for (const lang of HOME_LANGS) {
      const html = page({ ...full, lang });
      expect(html).not.toContain('<!--home:');
      expect(one(html, /<html lang="([^"]*)">/)).toBe(lang);
    }
    expect(() => renderSharePage(template.replace('<!--home:boot-->', ''), full)).toThrow(/home:boot/);
  });

  it('describes the puzzle to a chat app, and asks search engines to leave', () => {
    const html = page(full);
    const c = shareCopy(full);
    expect(one(html, /<title>([^<]*)<\/title>/)).toBe(c.title);
    expect(meta(html, 'description')).toEqual([c.description]);
    expect(meta(html, 'og:title')).toEqual([c.ogTitle]);
    expect(meta(html, 'og:description')).toEqual([c.description]);
    expect(meta(html, 'og:url')).toEqual([(SITE + sharePath(full)).replace(/&/g, '&amp;')]);
    expect(meta(html, 'og:image')).toEqual([`${SITE}/og/hard.png`]);
    expect(meta(html, 'twitter:image')).toEqual([`${SITE}/og/hard.png`]);
    expect(meta(html, 'og:image:alt')).toEqual([c.ogImageAlt]);
    expect(meta(html, 'og:locale')).toEqual(['en_GB']);
    expect(meta(html, 'og:locale:alternate')).toEqual([]);
    expect(meta(html, 'og:image:width')).toEqual(['1200']);
    expect(meta(html, 'og:image:height')).toEqual(['630']);
    expect(meta(html, 'twitter:card')).toEqual(['summary_large_image']);
    expect(meta(html, 'robots')).toEqual(['noindex']);
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('hreflang');
    expect(one(html, /<script type="application\/ld\+json">\s*([^<]*?)\s*<\/script>/)).toBe('{}');
    const boot = one(html, /<div class="boot">([\s\S]*?)<\/div>/);
    expect(boot).toContain(`<h1>${c.h1}</h1>`);
    expect(boot).toContain(`<p>${c.description}</p>`);
    expect(boot).toContain('Loading the puzzle&hellip;');
    expect(boot).toContain('<a href="https://github.com/AImenes/sudokUI">github.com/AImenes/sudokUI</a>');
    expect(boot).not.toContain('<ul>');
  });

  it('is built the same way in every language and for every puzzle', () => {
    const en = structure(page(full));
    for (const lang of OTHER) expect(structure(page({ ...full, lang })), lang).toBe(en);
    expect(structure(page({ lang: 'en', puzzle: EASY }))).toBe(en);
    for (const lang of HOME_LANGS) {
      expect(meta(page({ ...full, lang }), 'og:locale')).toEqual([{ en: 'en_GB', nb: 'nb_NO', es: 'es_ES' }[lang]]);
      expect(meta(page({ ...full, lang }), 'og:url')).toEqual([(SITE + sharePath({ ...full, lang })).replace(/&/g, '&amp;')]);
    }
    // the home page and the share page share the template, not the structure: no links block, no list
    expect(structure(renderHome(template, 'en'))).not.toBe(en);
  });

  it('escapes what it writes into the page', () => {
    const html = page({ lang: 'es', puzzle: EASY, level: 'Tricky', vs: 61 });
    expect(html).toContain('¿Puedes superarlo?');
    expect(html).toContain('Cargando el sudoku&hellip;');
    expect(html).not.toMatch(/content="[^"]*[<>]/);
  });
});

describe('the Worker', () => {
  /** the static assets as the Worker sees them: share.tpl and a 404 for everything else */
  function assets(tpl: string | null = template) {
    const calls: string[] = [];
    const env: Env = {
      ASSETS: {
        fetch: async (request: Request) => {
          const u = new URL(request.url);
          calls.push(`${request.method} ${u.pathname}`);
          if (u.pathname === SHARE_TEMPLATE && tpl !== null) return new Response(tpl, { status: 200 });
          return new Response('not found', { status: 404, headers: { 'x-answered-by': 'assets' } });
        }
      }
    };
    return { env, calls };
  }
  const request = (path: string, method = 'GET') => new Request(SITE + path, { method });

  it('renders a share address from the template, once per request, and says what it is', async () => {
    const { env, calls } = assets();
    const path = sharePath({ lang: 'nb', puzzle: EASY, level: 'Hard', score: 1420, techs: ['X_WING'], vs: 552 });
    const res = await handleRequest(request(path), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    // the page names the build's hashed scripts, so a browser asks again each time
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, must-revalidate');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(await res.text()).toBe(renderSharePage(template, parse(path)!));
    expect(calls).toEqual([`GET ${SHARE_TEMPLATE}`]);
  });

  it('answers HEAD with the headers alone', async () => {
    const { env, calls } = assets();
    const res = await handleRequest(request(`/p/${EASY}`, 'HEAD'), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(await res.text()).toBe('');
    expect(calls).toEqual([`GET ${SHARE_TEMPLATE}`]);
  });

  it('hands everything else to the assets, untouched', async () => {
    for (const [path, method] of [
      ['/learn/', 'GET'],
      ['/nb/', 'GET'],
      ['/p/', 'GET'],
      [`/p/${EASY.slice(1)}`, 'GET'],
      [`/de/p/${EASY}`, 'GET'],
      ['/assets/app.js', 'GET'],
      [`/p/${EASY}`, 'POST'],
      [`/p/${EASY}`, 'OPTIONS']
    ]) {
      const { env, calls } = assets();
      const res = await handleRequest(request(path, method), env);
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(res.headers.get('x-answered-by'), `${method} ${path}`).toBe('assets');
      expect(calls, `${method} ${path}`).toEqual([`${method} ${path}`]);
    }
  });

  it('falls back to the assets when the template is missing', async () => {
    const { env, calls } = assets(null);
    const res = await handleRequest(request(`/p/${EASY}`), env);
    expect(res.status).toBe(404);
    expect(res.headers.get('x-answered-by')).toBe('assets');
    expect(calls).toEqual([`GET ${SHARE_TEMPLATE}`, `GET /p/${EASY}`]);
  });

  it('accepts a trailing slash and the dev server’s origin alike', async () => {
    const { env } = assets();
    const res = await handleRequest(new Request(`http://localhost:8787/es/p/${EASY}/?b=easy`), env);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(one(html, /<html lang="([^"]*)">/)).toBe('es');
    // the page names the site, whatever host served it
    expect(meta(html, 'og:url')).toEqual([`${SITE}/es/p/${EASY}?b=easy`]);
  });
});

describe('the band cards', () => {
  const CARDS = readdirSync('public/og');
  const bytes = (file: string): Uint8Array | null => (CARDS.includes(file) ? readFileSync(`public/og/${file}`) : null);
  const pngSize = (b: Uint8Array): [number, number] => {
    expect(String.fromCharCode(...b.slice(1, 4))).toBe('PNG');
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    return [view.getUint32(16), view.getUint32(20)];
  };

  it('exist for every band in every language, 1200 x 630, where share.ts points', () => {
    for (const level of LEVELS) {
      for (const lang of HOME_LANGS) {
        const address = ogShareCard(level, lang);
        expect(address).toBe(`${SITE}/og/${level.toLowerCase()}${lang === 'en' ? '' : `.${lang}`}.png`);
        const file = address.split('/og/')[1];
        const b = bytes(file);
        expect(b, `public/og/${file}`).not.toBeNull();
        expect(pngSize(b!), file).toEqual([1200, 630]);
        // a chat app fetches the card for every link: keep it light
        expect(b!.length, file).toBeLessThan(250_000);
      }
    }
    // and nothing else lies there
    expect(CARDS).toHaveLength(LEVELS.length * HOME_LANGS.length);
  });

  it('are the image of every share page that knows its band, and the home card of one that does not', () => {
    for (const level of LEVELS) for (const lang of HOME_LANGS) expect(shareCopy({ lang, puzzle: EASY, level }).ogImage).toBe(ogShareCard(level, lang));
    for (const lang of HOME_LANGS) expect(shareCopy({ lang, puzzle: EASY }).ogImage).toBe(ogCard(lang));
  });
});
