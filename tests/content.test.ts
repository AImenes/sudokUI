/**
 * The written content (technique explanations, glossary, static pages) is
 * held to rules a reviewer would otherwise have to re-check by hand: every
 * technique documented, hard word limits, house style, no dangling
 * references, and static pages that are well-formed and fully linked.
 */
import { describe, it, expect } from 'vitest';
import indexHtml from '../index.html?raw';
import { renderHome } from '../src/content/home';
import { TECHS, ALL_TECHS, PRACTICE_TECHS, Tech } from '../src/engine/ratings';
import { TECH_DOCS } from '../src/content/techniqueDocs';
import { GLOSSARY, GLOSSARY_GROUPS } from '../src/content/glossary';
import { CATEGORY_NOTES } from '../src/content/categories';
import { RATING_SUMMARY, RATING_POINTS, BAND_NOTES } from '../src/content/rating';
import { LANDING_PAGES, COUNTS } from '../src/content/landing';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { techSlug, techFromParam, slugify } from '../src/content/slugs';
import { linkGlossary } from '../src/content/glossaryLinks';
import { buildLearnPages, buildSitemap, SITE, LEARN_LANGS, HOME_URLS } from '../src/content/learnPages';

const words = (s: string) => s.trim().split(/\s+/).length;
const sentences = (s: string) => (s.match(/[.!?](\s|$)/g) ?? []).length;

/** house style for every player-visible sentence */
function expectHouseStyle(text: string, where: string) {
  expect(text, `${where}: no em or en dashes`).not.toMatch(/[–—]/);
  expect(text, `${where}: no exclamation marks`).not.toContain('!');
  expect(text, `${where}: no markdown`).not.toMatch(/[*_`#]|\[[^\]]*\]\(/);
  expect(text, `${where}: British spelling`).not.toMatch(/\b(color|colors|colored|coloring|center|centers)\b/);
  expect(text.trim(), `${where}: no stray whitespace`).toBe(text);
}

describe('technique reference', () => {
  it('documents every catalogued technique, and nothing else', () => {
    expect(Object.keys(TECH_DOCS).sort()).toEqual([...ALL_TECHS].sort());
  });

  for (const tech of ALL_TECHS) {
    it(`${tech}: within limits and in house style`, () => {
      const doc = TECH_DOCS[tech];
      expect(words(doc.what), 'what: at most 30 words').toBeLessThanOrEqual(30);
      expect(sentences(doc.what), 'what: one sentence').toBe(1);
      expect(words(doc.why), 'why: at most 45 words').toBeLessThanOrEqual(45);
      expect(sentences(doc.why), 'why: one or two sentences').toBeLessThanOrEqual(2);
      expect(words(doc.spot), 'spot: at most 25 words').toBeLessThanOrEqual(25);
      expect(sentences(doc.spot), 'spot: one sentence').toBe(1);
      for (const field of ['what', 'why', 'spot'] as const) {
        // technique names keep their catalogue spelling (Simple Colors)
        const prose = doc[field].replace(/(Simple|Multi) Colors/g, '');
        expectHouseStyle(prose, `${tech}.${field}`);
        expect(doc[field], `${tech}.${field}: ends with a full stop`).toMatch(/\.$/);
        expect(doc[field], `${tech}.${field}: general, no cell coordinates`).not.toMatch(/\br\d+c\d+\b/i);
      }
      for (const name of doc.aka) expect(name.trim()).not.toBe('');
    });
  }

  it('says that every uniqueness technique assumes a single solution', () => {
    for (const tech of ALL_TECHS.filter((t) => TECHS[t].category === 'Uniqueness')) {
      const doc = TECH_DOCS[tech];
      expect(`${doc.what} ${doc.why}`, tech).toMatch(/one solution|single solution|unique solution|uniquely/i);
    }
  });
});

describe('glossary', () => {
  it('has unique terms in known groups, within limits and in house style', () => {
    const seen = new Set<string>();
    for (const e of GLOSSARY) {
      const key = slugify(e.term);
      expect(seen.has(key), `duplicate term ${e.term}`).toBe(false);
      seen.add(key);
      expect(GLOSSARY_GROUPS, e.term).toContain(e.group);
      // the audited definitions of docs/glossary_input.md: precise, so some need three sentences
      expect(words(e.definition), `${e.term}: at most 70 words`).toBeLessThanOrEqual(70);
      expect(sentences(e.definition), `${e.term}: at most three sentences`).toBeLessThanOrEqual(3);
      expectHouseStyle(e.definition, e.term);
    }
  });

  it('only cross-references entries that exist', () => {
    const ids = new Set(GLOSSARY.map((e) => e.id));
    expect(ids.size, 'ids are unique').toBe(GLOSSARY.length);
    for (const e of GLOSSARY) {
      expect(e.id, 'ids are lower-case slugs').toMatch(/^[a-z0-9-]+$/);
      for (const ref of e.see) expect(ids.has(ref), `${e.id} -> ${ref}`).toBe(true);
    }
  });

  it('defines the language the hints rely on', () => {
    const terms = new Set(GLOSSARY.map((e) => e.term.toLowerCase()));
    for (const must of ['strong link', 'weak link', 'conjugate pair', 'bivalue cell', 'candidate', 'unit']) {
      expect([...terms].some((t) => t.startsWith(must)), must).toBe(true);
    }
  });

  it('states the two link types exactly', () => {
    const def = (name: string) =>
      GLOSSARY.find((e) => e.term.toLowerCase().startsWith(name))!.definition.toLowerCase();
    // strong: at least one is true (one false forces the other true)
    expect(def('strong link')).toMatch(/false/);
    expect(def('strong link')).toMatch(/true/);
    // weak: at most one is true (one true forces the other false)
    expect(def('weak link')).toMatch(/true/);
    expect(def('weak link')).toMatch(/false/);
  });

  it('links terms inside running text, once each and never to itself', () => {
    const segs = linkGlossary('A strong link and another strong link meet a weak link.');
    const linked = segs.filter((s) => s.term).map((s) => s.term!);
    expect(linked.filter((t) => t === 'strong-link')).toHaveLength(1);
    expect(linked).toContain('weak-link');
    expect(segs.map((s) => s.text).join('')).toBe(
      'A strong link and another strong link meet a weak link.'
    );
    const strong = GLOSSARY.find((e) => e.term.toLowerCase().startsWith('strong link'))!;
    expect(linkGlossary(strong.definition, strong.id).some((s) => s.term === strong.id)).toBe(false);
  });
});

describe('supporting copy', () => {
  it('keeps to house style', () => {
    for (const [cat, note] of Object.entries(CATEGORY_NOTES)) expectHouseStyle(note, cat);
    for (const [level, note] of Object.entries(BAND_NOTES)) expectHouseStyle(note, level);
    expectHouseStyle(RATING_SUMMARY, 'rating summary');
    for (const p of RATING_POINTS) expectHouseStyle(p.text, p.title);
    for (const page of LANDING_PAGES) {
      expectHouseStyle(page.lead, page.url);
      for (const s of page.sections) for (const p of s.paragraphs) expectHouseStyle(p, `${page.url} ${s.heading}`);
    }
  });

  it('quotes scores that match the catalogue', () => {
    const text = RATING_POINTS.map((p) => p.text).join(' ');
    expect(text).toContain(`Naked Single costs ${TECHS.NAKED_SINGLE.score}`);
    expect(text).toContain(`X-Wing ${TECHS.X_WING.score}`);
    expect(text).toContain(`Forcing Net ${TECHS.FORCING_NET.score}`);
  });

  it('counts techniques the way the catalogue does', () => {
    expect(COUNTS.catalogued).toBe(ALL_TECHS.length);
    expect(COUNTS.practice).toBe(PRACTICE_TECHS.length);
    // the English home page (index.html, filled in by src/content/home.ts)
    // quotes both numbers, and keeps its bare tab title
    const home = renderHome(indexHtml, 'en');
    expect(home).toContain(`${COUNTS.implemented} `);
    expect(home).toContain(`${COUNTS.practice} `);
    expect(home).toContain('<title>sudokUI</title>');
  });
});

describe('slugs', () => {
  it('gives every technique a unique, URL-safe slug that resolves back', () => {
    const seen = new Set<string>();
    for (const tech of ALL_TECHS) {
      const slug = techSlug(tech);
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(seen.has(slug), slug).toBe(false);
      seen.add(slug);
      expect(techFromParam(slug)).toBe(tech);
      expect(techFromParam(tech)).toBe(tech);
    }
    expect(techFromParam('no-such-technique')).toBeUndefined();
    expect(techFromParam('')).toBeUndefined();
  });

  // Slugs are public addresses. If this snapshot fails, a technique was
  // renamed or added: for a NEW technique, add its line; for a RENAME, keep
  // the old slug (SLUG_OVERRIDES) or add a redirect in public/_redirects.
  it('never changes a published address', () => {
    expect(Object.fromEntries(ALL_TECHS.map((t) => [t, techSlug(t)]))).toMatchInlineSnapshot(`
      {
        "AIC": "alternating-inference-chain",
        "AIC_ALS": "aic-with-als",
        "AIC_GROUPED": "aic-with-groups",
        "ALIGNED_PAIR_EXCLUSION": "aligned-pair-exclusion",
        "ALS_XY_CHAIN": "als-xy-chain",
        "ALS_XY_WING": "als-xy-wing",
        "ALS_XZ": "als-xz",
        "AVOIDABLE_RECTANGLE_1": "avoidable-rectangle-type-1",
        "AVOIDABLE_RECTANGLE_2": "avoidable-rectangle-type-2",
        "BRUTE_FORCE": "brute-force",
        "BUG_PLUS_1": "bug-plus-1",
        "CELL_FORCING_CHAIN": "cell-forcing-chain",
        "CHUTE_REMOTE_PAIR": "chute-remote-pair",
        "DEATH_BLOSSOM": "death-blossom",
        "DIGIT_FORCING_CHAIN": "digit-forcing-chain",
        "DOUBLE_EXOCET": "double-exocet",
        "EMPTY_RECTANGLE": "empty-rectangle",
        "EXOCET": "exocet",
        "EXTENDED_RECTANGLE": "extended-rectangle",
        "FINNED_JELLYFISH": "finned-jellyfish",
        "FINNED_SWORDFISH": "finned-swordfish",
        "FINNED_X_WING": "finned-x-wing",
        "FIREWORKS": "fireworks",
        "FORCING_CHAIN": "forcing-chain",
        "FORCING_NET": "forcing-net",
        "FRANKEN_SWORDFISH": "franken-swordfish",
        "FRANKEN_X_WING": "franken-x-wing",
        "FULL_HOUSE": "full-house",
        "GROUPED_NICE_LOOP": "grouped-nice-loop",
        "GROUPED_X_CYCLES": "grouped-x-cycles",
        "HIDDEN_PAIR": "hidden-pair",
        "HIDDEN_QUADRUPLE": "hidden-quadruple",
        "HIDDEN_RECTANGLE": "hidden-rectangle",
        "HIDDEN_SINGLE": "hidden-single",
        "HIDDEN_TRIPLE": "hidden-triple",
        "JELLYFISH": "jellyfish",
        "LEVIATHAN": "leviathan",
        "LOCKED_CANDIDATES_1": "locked-candidates-pointing",
        "LOCKED_CANDIDATES_2": "locked-candidates-claiming",
        "LOCKED_PAIR": "locked-pair",
        "LOCKED_TRIPLE": "locked-triple",
        "MEDUSA_3D": "3d-medusa",
        "MULTI_COLORS": "multi-colors",
        "NAKED_PAIR": "naked-pair",
        "NAKED_QUADRUPLE": "naked-quadruple",
        "NAKED_SINGLE": "naked-single",
        "NAKED_TRIPLE": "naked-triple",
        "NICE_LOOP": "nice-loop",
        "NISHIO_FORCING_CHAIN": "nishio-forcing-chain",
        "PATTERN_OVERLAY": "pattern-overlay",
        "REMOTE_PAIR": "remote-pair",
        "SASHIMI_JELLYFISH": "sashimi-jellyfish",
        "SASHIMI_SWORDFISH": "sashimi-swordfish",
        "SASHIMI_X_WING": "sashimi-x-wing",
        "SIMPLE_COLORS": "simple-colors",
        "SKYSCRAPER": "skyscraper",
        "SK_LOOP": "sk-loop",
        "SQUIRMBAG": "squirmbag",
        "SUE_DE_COQ": "sue-de-coq",
        "SWORDFISH": "swordfish",
        "TRIDAGON": "tridagon",
        "TURBOT_FISH": "turbot-fish",
        "TWINNED_XY_CHAIN": "twinned-xy-chains",
        "TWO_STRING_KITE": "2-string-kite",
        "UNIQUENESS_1": "unique-rectangle-type-1",
        "UNIQUENESS_2": "unique-rectangle-type-2",
        "UNIQUENESS_3": "unique-rectangle-type-3",
        "UNIQUENESS_4": "unique-rectangle-type-4",
        "UNIQUENESS_5": "unique-rectangle-type-5",
        "UNIQUENESS_6": "unique-rectangle-type-6",
        "UNIT_FORCING_CHAIN": "unit-forcing-chain",
        "WHALE": "whale",
        "WXYZ_WING": "wxyz-wing",
        "W_WING": "w-wing",
        "XYZ_WING": "xyz-wing",
        "XY_CHAIN": "xy-chain",
        "XY_WING": "xy-wing",
        "X_CHAIN": "x-chain",
        "X_CYCLES": "x-cycles",
        "X_WING": "x-wing",
      }
    `);
  });
});

describe('static pages', () => {
  const pages = buildLearnPages();
  const urls = new Set(pages.map((p) => p.url));
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  /** the app itself in a language: /, /nb/, /es/ */
  const home = (lang: string) => (lang === 'en' ? '/' : `/${lang}/`);

  it('builds one page per technique plus the hubs and landing pages, in every language', () => {
    // hubs: the technique index, the Intuition guide, the glossary and the rating page;
    // in English, Norwegian and Spanish: every technique, the four hubs and every landing page
    expect(pages).toHaveLength(3 * (ALL_TECHS.length + 4 + LANDING_PAGES.length));
    for (const lang of ['nb', 'es']) {
      for (const tech of ALL_TECHS) expect(urls.has(`/${lang}/learn/${techSlug(tech)}/`), `${lang} ${tech}`).toBe(true);
      for (const p of LANDING_PAGES) expect(urls.has(`/${lang}${p.url}`), `${lang} ${p.url}`).toBe(true);
    }
    for (const tech of ALL_TECHS) expect(urls.has(`/learn/${techSlug(tech)}/`), tech).toBe(true);
    expect(urls.size).toBe(pages.length);
    expect(HOME_URLS).toEqual(['/', '/nb/', '/es/']);
  });

  // Addresses are public: if this fails, a page moved or a new one was
  // added. For a new page, add its line; never move a published one
  // without a redirect in public/_redirects. (Technique pages are frozen
  // by the slug snapshot above.)
  it('never moves a published page', () => {
    const technique = new Set(ALL_TECHS.map((t) => `/learn/${techSlug(t)}/`));
    expect(pages.map((p) => p.url).filter((u) => !technique.has(u.replace(/^\/(nb|es)\//, '/')))).toMatchInlineSnapshot(`
      [
        "/daily-sudoku/",
        "/sudoku-solver/",
        "/hodoku/",
        "/how-the-best-solve/",
        "/sudoku-difficulty-rating/",
        "/learn/",
        "/learn/intuition/",
        "/learn/glossary/",
        "/nb/daily-sudoku/",
        "/nb/sudoku-solver/",
        "/nb/hodoku/",
        "/nb/how-the-best-solve/",
        "/nb/sudoku-difficulty-rating/",
        "/nb/learn/",
        "/nb/learn/intuition/",
        "/nb/learn/glossary/",
        "/es/daily-sudoku/",
        "/es/sudoku-solver/",
        "/es/hodoku/",
        "/es/how-the-best-solve/",
        "/es/sudoku-difficulty-rating/",
        "/es/learn/",
        "/es/learn/intuition/",
        "/es/learn/glossary/",
      ]
    `);
  });

  it('keeps every page out of the service worker’s reach, and the app in its reach', () => {
    for (const p of pages) expect(STATIC_ROUTES.test(p.url), p.url).toBe(true);
    // the home pages are the app itself, in each language
    for (const url of HOME_URLS) expect(STATIC_ROUTES.test(url), url).toBe(false);
    expect(STATIC_ROUTES.test('/nb')).toBe(false);
    expect(STATIC_ROUTES.test('/learning')).toBe(false);
  });

  it('names every language version of a page, and each names the others back', () => {
    for (const page of pages) {
      const english = page.alternateOf!;
      expect(english, `${page.url}: has language versions`).toBeDefined();
      const hreflang = [...page.html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map((m) => [m[1], m[2]]);
      const versions = LEARN_LANGS.map((l) => [l, `${SITE}${l === 'en' ? '' : `/${l}`}${english}`]);
      expect(hreflang, page.url).toEqual([...versions, ['x-default', `${SITE}${english}`]]);
      // this page is the version in its own language, and every version exists and agrees
      expect(versions.find(([l]) => l === page.lang)![1]).toBe(`${SITE}${page.url}`);
      for (const [l, href] of versions) {
        const other = byUrl.get(href.slice(SITE.length));
        expect(other, `${page.url} -> ${href}`).toBeDefined();
        expect(other!.lang).toBe(l);
        expect(other!.alternateOf).toBe(english);
      }
      // the language line in the footer links to the same versions
      const line = page.html.match(/<p class="langs"[^>]*>(.*)<\/p>/)![1];
      for (const [l, href] of versions) {
        if (l === page.lang) expect(line).toContain('<span aria-current="true">');
        else expect(line, `${page.url}: language line`).toContain(`<a href="${href.slice(SITE.length)}" hreflang="${l}" lang="${l}">`);
      }
    }
  });

  it('sends readers into the app in the page’s language', () => {
    for (const page of pages) {
      const root = home(page.lang);
      // every link to the app itself, with or without a deep link
      const appLinks = [...page.html.matchAll(/href="(\/(?:nb\/|es\/)?)(#[^"]*)?"/g)].map((m) => m[1]);
      expect(appLinks.length, `${page.url}: links to the app`).toBeGreaterThan(0);
      for (const link of appLinks) expect(link, page.url).toBe(root);
      // and the paste-a-puzzle box
      for (const m of page.html.matchAll(/location\.href = '([^']*)' \+ s/g)) expect(m[1], page.url).toBe(`${root}#p=`);
      expect(page.html, `${page.url}: breadcrumb home`).toContain(`<p class="crumbs"><a href="${root}">sudokUI</a>`);
    }
  });

  for (const page of pages) {
    it(`${page.url}: well-formed, self-canonical, fully linked`, () => {
      const { html, url, path } = page;
      expect(path).toBe(`${url.slice(1)}index.html`);
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html.match(/<title>/g)).toHaveLength(1);
      expect(html).toContain(`<link rel="canonical" href="${SITE}${url}" />`);

      const title = html.match(/<title>([^<]*)<\/title>/)![1];
      expect(title.length, `title length: ${title}`).toBeLessThanOrEqual(60);
      const description = html.match(/<meta name="description" content="([^"]*)"/)![1];
      expect(description.length, 'description length').toBeGreaterThanOrEqual(50);
      expect(description.length, `description length: ${description}`).toBeLessThanOrEqual(200);

      // structured data must parse
      for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
        expect(() => JSON.parse(m[1])).not.toThrow();
      }

      // every internal link lands on a page that exists (or on the app)
      for (const m of html.matchAll(/href="(\/[^"#]*)(#[^"]*)?"/g)) {
        const target = m[1];
        if (HOME_URLS.includes(target) || /\.(svg|png|xml)$/.test(target)) continue;
        expect(urls.has(target), `${url} links to missing ${target}`).toBe(true);
      }
      // deep links into the app name real techniques
      for (const m of html.matchAll(/href="(?:\/nb|\/es)?\/#(practice|learn)=([A-Z0-9_]+)"/g)) {
        expect(m[2] in TECHS, m[2]).toBe(true);
        if (m[1] === 'practice') expect(PRACTICE_TECHS).toContain(m[2] as Tech);
      }
      // no raw angle brackets leaked from content
      expect(html).not.toMatch(/&lt;(a|p|h\d|span) /);
    });
  }

  it('anchors every glossary link on the glossary page', () => {
    const glossary = pages.find((p) => p.url === '/learn/glossary/')!.html;
    const ids = new Set([...glossary.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
    for (const page of pages) {
      for (const m of page.html.matchAll(/href="(?:\/(?:nb|es))?\/learn\/glossary\/#([^"]+)"/g)) {
        expect(ids.has(m[1]), `${page.url} -> #${m[1]}`).toBe(true);
      }
    }
  });

  it('lists the app in every language and every page in the sitemap, each with its language versions', () => {
    const xml = buildSitemap(pages);
    expect(xml).not.toMatch(/<priority>|<changefreq>|<lastmod>/);
    expect(xml.match(/<url>/g)).toHaveLength(pages.length + HOME_URLS.length);
    const versions = (english: string) =>
      [...LEARN_LANGS.map((l) => [l, `${SITE}${l === 'en' ? '' : `/${l}`}${english}`]), ['x-default', `${SITE}${english}`]]
        .map(([l, href]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${href}"/>`)
        .join('');
    // the home pages are the app itself in English, Norwegian and Spanish
    for (const url of HOME_URLS) expect(xml).toContain(`<url><loc>${SITE}${url}</loc>${versions('/')}</url>`);
    for (const p of pages) expect(xml).toContain(`<url><loc>${SITE}${p.url}</loc>${versions(p.alternateOf!)}</url>`);
  });
});

describe('glossary links in running text', () => {
  it('leave everyday words alone', () => {
    const linkedIn = (text: string) =>
      linkGlossary(text)
        .filter((s) => s.term)
        .map((s) => s.text.toLowerCase());
    // "group" and "link" are aliases of glossary terms, but ordinary words;
    // the headwords themselves link, once each
    expect(linkedIn('Any group of nine cells, each candidate a possible link.')).toEqual(['cells', 'candidate']);
    expect(linkedIn('A unit is a row, a column or a box, and every unit has nine cells.')).toEqual(['unit', 'row', 'column', 'box', 'cells']);
    expect(linkedIn('An ALS and a conjugate pair.').sort()).toEqual(['als', 'conjugate pair']);
    // abbreviations only in capitals: "als" inside a word or in lower case is not one
    expect(linkedIn('The signals are false.')).toEqual([]);
  });
});

describe('technique frequencies', () => {
  it('are measured on a real sample and cover the whole solve order', async () => {
    const { FREQUENCY } = await import('../src/content/frequency');
    const { SOLVE_ORDER } = await import('../src/engine/ratings');
    expect(FREQUENCY.sample).toBeGreaterThanOrEqual(10_000);
    expect(Object.keys(FREQUENCY.counts).sort()).toEqual([...SOLVE_ORDER].sort());
    for (const [tech, count] of Object.entries(FREQUENCY.counts)) {
      expect(count, tech).toBeGreaterThanOrEqual(0);
      expect(count, tech).toBeLessThanOrEqual(FREQUENCY.sample);
    }
    // every puzzle needs singles, and no generated puzzle may need guessing
    expect(FREQUENCY.counts.HIDDEN_SINGLE! / FREQUENCY.sample).toBeGreaterThan(0.9);
    expect(FREQUENCY.counts.BRUTE_FORCE).toBe(0);
  });

  it('read as plain statements', async () => {
    const { frequencyLabel } = await import('../src/content/frequency');
    const f = {
      sample: 50_000,
      counts: { NAKED_SINGLE: 50_000, NAKED_PAIR: 17_000, X_WING: 1_234, EXOCET: 3, TRIDAGON: 0 }
    };
    expect(frequencyLabel('NAKED_SINGLE', f)).toBe('every puzzle');
    expect(frequencyLabel('NAKED_PAIR', f)).toBe('34% of puzzles');
    expect(frequencyLabel('X_WING', f)).toBe('1 in 41 puzzles');
    expect(frequencyLabel('EXOCET', f)).toBe('1 in 17,000 puzzles');
    expect(frequencyLabel('TRIDAGON', f)).toBe('fewer than 1 in 50,000 puzzles');
    // a technique the solver never uses has no frequency at all
    expect(frequencyLabel('SK_LOOP', f)).toBeNull();
  });
});
