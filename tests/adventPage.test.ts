/**
 * The advent calendar's public pages (src/content/adventPage.ts, built by
 * src/content/learnPages.ts into dist/ by scripts/build-learn.ts): /advent/,
 * /nb/julekalender/ and /es/calendario-de-adviento/, each naming the other
 * two, in the sitemap, with true structured data and the year's own card;
 * every door written locked, with its day and rating and never its puzzle;
 * and the inline script that opens the doors whose day has come, run over
 * a small stand-in for the page with the device's date fixed, day by day
 * against the calendar's own rule (src/content/season.ts, doorOpen). Then
 * the quiet line on the home pages and /learn/, shown in November and
 * December by the same kind of script.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import template from '../index.html?raw';
import advent from '../src/content/advent.json';
import { ADVENT_DOORS, adventPath, calendarYears, type AdventDoor } from '../src/content/advent';
import { calendarOpen, doorOpen } from '../src/content/season';
import { ADVENT_PAGE, ADVENT_URLS, adventCardPath, fillAdvent } from '../src/content/adventPage';
import { ADVENT_LINE, LINE_ID, LINE_SCRIPT } from '../src/content/adventLine';
import { buildLearnPages, buildSitemap, pageCalendar, SITE, LEARN_LANGS } from '../src/content/learnPages';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { APP_NAVIGATION, renderHome } from '../src/content/home';
import type { Lang } from '../src/state/settings';

const pages = buildLearnPages();
const PAGE = Object.fromEntries(LEARN_LANGS.map((l) => [l, pages.find((p) => p.url === ADVENT_URLS[l])!])) as Record<Lang, (typeof pages)[number]>;
const { year, doors } = pageCalendar();
const unescapeHtml = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const one = (html: string, re: RegExp) => {
  const all = [...html.matchAll(new RegExp(re, 'g'))];
  expect(all.length, String(re)).toBe(1);
  return all[0][1];
};

/** a day key's next day */
const next = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/** every day from one key to another, both included */
const days = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = next(d)) out.push(d);
  return out;
};
/** the device's clock at noon, local time, on a day: what `new Date()` gives the page's script */
const clockAt = (date: string) =>
  class extends Date {
    constructor() {
      super(`${date}T12:00:00`);
    }
  };

interface FakeDoor {
  attrs: Record<string, string>;
  className: string;
  state: { textContent: string };
  getAttribute(k: string): string | null;
  setAttribute(k: string, v: string): void;
  querySelector(sel: string): { textContent: string } | null;
}

/**
 * Runs a calendar page's door script on a day, over a stand-in for the
 * page built from its HTML: the list, its doors as written, the status
 * line. What the script left on them is returned.
 */
function runDoors(html: string, date: string) {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  expect(scripts, 'one inline script').toHaveLength(1);
  const [, listYear, base] = /<ol class="doors" id="advent-doors" data-year="(\d+)" data-app="([^"]+)">/.exec(html)!;
  const doors: FakeDoor[] = [...html.matchAll(/<a class="door" data-door="(\d+)">[\s\S]*?<span class="state">([^<]*)<\/span><\/a>/g)].map((m): FakeDoor => ({
    attrs: { 'data-door': m[1] },
    className: 'door',
    state: { textContent: unescapeHtml(m[2]) },
    getAttribute(k) {
      return this.attrs[k] ?? null;
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    },
    querySelector(sel) {
      return sel === '.state' ? this.state : null;
    }
  }));
  const status = { textContent: unescapeHtml(/<p class="advent-status" id="advent-status">([^<]*)<\/p>/.exec(html)![1]) };
  const attrs: Record<string, string> = { 'data-year': listYear, 'data-app': base };
  const list = { getAttribute: (k: string) => attrs[k] ?? null, getElementsByTagName: (t: string) => (t === 'a' ? doors : []) };
  const document = { getElementById: (id: string) => (id === 'advent-doors' ? list : id === 'advent-status' ? status : null) };
  new Function('document', 'Date', scripts[0])(document, clockAt(date));
  return { doors, status: status.textContent };
}

/** runs the quiet line's script on a day over a stand-in line; whether the line is shown */
function runLine(script: string, date: string): boolean {
  const line = { hidden: true };
  new Function('document', 'Date', script)({ getElementById: (id: string) => (id === LINE_ID ? line : null) }, clockAt(date));
  return !line.hidden;
}

describe('the advent calendar’s pages', () => {
  it('show the latest published calendar, every one of its 24 doors', () => {
    expect(year).toBe(calendarYears(advent as AdventDoor[]).at(-1));
    expect(doors.map((d) => d.door)).toEqual(Array.from({ length: ADVENT_DOORS }, (_, i) => i + 1));
    expect(() => pageCalendar([])).toThrow(/no calendar/);
    expect(() => pageCalendar((advent as AdventDoor[]).filter((d) => d.door !== 7))).toThrow(/no door 7/);
  });

  it('live at their own address in each language, kept from the service worker’s app shell, door addresses apart', () => {
    expect(ADVENT_URLS).toEqual({ en: '/advent/', nb: '/nb/julekalender/', es: '/es/calendario-de-adviento/' });
    for (const lang of LEARN_LANGS) {
      const page = PAGE[lang];
      expect(page.lang).toBe(lang);
      expect(page.path).toBe(`${ADVENT_URLS[lang].slice(1)}index.html`);
      expect(page.alternates).toEqual(ADVENT_URLS);
    }
    for (const url of ['/advent/', '/advent', '/advent/?utm_source=x', '/nb/julekalender/', '/es/calendario-de-adviento/', '/nb/julekalender'])
      expect(STATIC_ROUTES.test(url), url).toBe(true);
    // a door's address is the app's, which an installed app answers offline
    for (const url of ['/advent/2026/5', '/nb/advent/2026/5', '/es/advent/2026/24/', '/advent/2026/5?vs=90']) {
      expect(STATIC_ROUTES.test(url), url).toBe(false);
      expect(APP_NAVIGATION.test(url), url).toBe(true);
    }
    for (const url of ['/adventure/', '/julekalender/', '/nb/advent/', '/es/julekalender/']) expect(STATIC_ROUTES.test(url), url).toBe(false);
  });

  it('are written for search: a title and a description that fit, the year in both, canonical and every language named', () => {
    for (const lang of LEARN_LANGS) {
      const { html, url } = PAGE[lang];
      const title = unescapeHtml(one(html, /<title>([^<]*)<\/title>/));
      expect(title).toBe(fillAdvent(ADVENT_PAGE[lang].title, { year }));
      expect(title.length, title).toBeLessThanOrEqual(60);
      expect(title).toContain(String(year));
      expect(title.toLowerCase()).toContain(lang === 'nb' ? 'julekalender' : lang === 'es' ? 'calendario de adviento' : 'advent calendar');
      const description = unescapeHtml(one(html, /<meta name="description" content="([^"]*)"/));
      expect(description.length, description).toBeGreaterThanOrEqual(120);
      expect(description.length, description).toBeLessThanOrEqual(160);
      expect(one(html, /<link rel="canonical" href="([^"]*)"/)).toBe(SITE + url);
      expect(one(html, /<h1>([^<]*)<\/h1>/)).toBe(fillAdvent(ADVENT_PAGE[lang].h1, { year }));
      const hreflang = Object.fromEntries([...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)" \/>/g)].map((m) => [m[1], m[2]]));
      expect(hreflang).toEqual({
        en: `${SITE}/advent/`,
        nb: `${SITE}/nb/julekalender/`,
        es: `${SITE}/es/calendario-de-adviento/`,
        'x-default': `${SITE}/advent/`
      });
      // the footer's language line goes to the same pages
      const line = one(html, /<nav class="langs" aria-label="[^"]+">(.*)<\/nav>/);
      for (const other of LEARN_LANGS.filter((l) => l !== lang)) expect(line).toContain(`<a href="${ADVENT_URLS[other]}" hreflang="${other}" lang="${other}">`);
    }
  });

  it('are in the sitemap, each with the other two', () => {
    const xml = buildSitemap(pages);
    const alternates = LEARN_LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${SITE}${ADVENT_URLS[l]}"/>`).join('') +
      `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/advent/"/>`;
    for (const lang of LEARN_LANGS) expect(xml).toContain(`<url><loc>${SITE}${ADVENT_URLS[lang]}</loc>${alternates}</url>`);
    // and nothing of a door's address: those are the app's, and noindex
    expect(xml).not.toMatch(/advent\/\d{4}\//);
  });

  it('carry structured data that is true: a page listing the doors, with no event claimed', () => {
    for (const lang of LEARN_LANGS) {
      const { html, url } = PAGE[lang];
      const data = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
      expect(data.map((d) => d['@type'])).toEqual(['CollectionPage', 'BreadcrumbList']);
      expect(JSON.stringify(data)).not.toMatch(/"Event"|startDate|offers/);
      const [page] = data;
      expect(page.url).toBe(SITE + url);
      expect(page.inLanguage).toBe(lang);
      expect(page.image).toBe(SITE + adventCardPath(lang, year));
      const list = page.mainEntity;
      expect(list['@type']).toBe('ItemList');
      expect(list.numberOfItems).toBe(ADVENT_DOORS);
      expect(list.itemListElement.map((i: { position: number }) => i.position)).toEqual(doors.map((d) => d.door));
      // each names its door, its day and its rating; no address, since a door's is the app's
      for (const [i, item] of list.itemListElement.entries()) {
        expect(item.name).toContain(String(doors[i].score));
        expect(item.name).toMatch(new RegExp(`^\\D+ ${doors[i].door}, ${doors[i].door}\\.? `));
        expect(item.url).toBeUndefined();
      }
    }
  });

  it('have the year’s own card, 1200 x 630 and light, described in the language', () => {
    for (const lang of LEARN_LANGS) {
      const { html } = PAGE[lang];
      const path = adventCardPath(lang, year);
      expect(path).toBe(`/og-advent-${year}${lang === 'en' ? '' : `.${lang}`}.png`);
      expect(one(html, /<meta property="og:image" content="([^"]*)"/)).toBe(SITE + path);
      expect(one(html, /<meta property="og:image:width" content="([^"]*)"/)).toBe('1200');
      expect(one(html, /<meta property="og:image:height" content="([^"]*)"/)).toBe('630');
      expect(unescapeHtml(one(html, /<meta property="og:image:alt" content="([^"]*)"/))).toBe(fillAdvent(ADVENT_PAGE[lang].imageAlt, { year }));
      expect(one(html, /<meta property="og:type" content="([^"]*)"/)).toBe('website');
      // made by scripts/og-advent-card.ts for the year: a new year's doors need their card
      const file = `public${path}`;
      expect(existsSync(file), `${file}: run scripts/og-advent-card.ts`).toBe(true);
      const b = readFileSync(file);
      expect(String.fromCharCode(...b.slice(1, 4))).toBe('PNG');
      const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
      expect(b.length).toBeLessThan(250_000);
    }
  });

  it('write every door locked, with its day, level and rating, and never a puzzle', () => {
    for (const lang of LEARN_LANGS) {
      const { html } = PAGE[lang];
      const written = [...html.matchAll(/<li><a class="door" data-door="(\d+)">(.*?)<\/a><\/li>/g)];
      expect(written.map((m) => Number(m[1]))).toEqual(doors.map((d) => d.door));
      for (const [i, m] of written.entries()) {
        const d = doors[i];
        expect(m[2]).toContain(`<b>${d.door}</b>`);
        expect(m[2]).toContain(`<span class="sc">${d.score}</span>`);
        expect(m[2]).toContain(`<span class="state">${ADVENT_PAGE[lang].state.locked}</span>`);
        expect(m[2]).toMatch(new RegExp(`<span class="day">${d.door}\\.? `));
      }
      // no door is a link until the script opens it, and no puzzle is on the page
      expect(html).not.toContain('href="/advent/20');
      expect(html).not.toMatch(/advent\/\d{4}\/\d/);
      for (const d of advent as AdventDoor[]) expect(html).not.toContain(d.puzzle);
      expect(html).not.toMatch(/[0-9.]{81}/);
      // without the script, the status line says what is true on any day
      expect(one(html, /<p class="advent-status" id="advent-status">([^<]*)<\/p>/)).toBe(fillAdvent(ADVENT_PAGE[lang].statusStatic, { year }));
      // links to the app and to today's daily, in the page's language
      const root = lang === 'en' ? '/' : `/${lang}/`;
      expect(html).toContain(`<a class="cta" href="${root}">`);
      expect(html).toContain(`<a class="cta ghost" href="${root}#daily">`);
    }
  });

  it('open, by the visitor’s own date, exactly the doors the calendar opens, each a link to its address in the app', () => {
    for (const lang of LEARN_LANGS) {
      const { html } = PAGE[lang];
      const c = ADVENT_PAGE[lang];
      for (const date of [...days(`${year}-11-25`, `${year + 1}-01-03`), `${year}-01-01`, `${year}-06-15`, `${year - 1}-12-10`, `${year + 1}-12-05`]) {
        const { doors: after, status } = runDoors(html, date);
        const dayOf = date.slice(0, 7) === `${year}-12` ? Number(date.slice(8)) : 0;
        for (const door of after) {
          const n = Number(door.attrs['data-door']);
          const open = doorOpen(year, n, date);
          const where = `${lang} ${date} door ${n}`;
          expect(door.attrs.href, where).toBe(open ? adventPath(lang, year, n) : undefined);
          if (open) {
            expect(door.className, where).toBe(n === dayOf ? 'door open today' : 'door open');
            expect(door.state.textContent, where).toBe(n === dayOf ? c.state.today : c.state.open);
          } else if (date > `${year}-12-31`) {
            expect(door.className, where).toBe('door closed');
            expect(door.state.textContent, where).toBe(c.state.closed);
          } else {
            expect(door.className, where).toBe('door');
            expect(door.state.textContent, where).toBe(c.state.locked);
          }
        }
        // the status line says where the calendar stands
        const want =
          date < `${year}-12-01`
            ? fillAdvent(c.status.before, { year })
            : date <= `${year}-12-24`
              ? fillAdvent(c.status.day, { door: dayOf })
              : date <= `${year}-12-31`
                ? c.status.all
                : fillAdvent(c.status.over, { year });
        expect(status, `${lang} ${date}`).toBe(want);
      }
    }
  });

  it('say the same in Norwegian and Spanish as in English, with the same numbers, in the house style', () => {
    const texts = (c: typeof ADVENT_PAGE.en) =>
      Object.entries(c).flatMap(([field, v]) =>
        typeof v === 'string' ? [[field, v]] : Array.isArray(v) ? v.map((s, i) => [`${field}[${i}]`, s]) : Object.entries(v).map(([k, s]) => [`${field}.${k}`, s as string])
      );
    const numbers = (s: string) => (s.replace(/\{\w+\}/g, '').match(/\d+/g) ?? []).join(' ');
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(' ');
    const en = [...texts(ADVENT_PAGE.en), ['line', ADVENT_LINE.en]];
    for (const lang of ['nb', 'es'] as const) {
      const other = [...texts(ADVENT_PAGE[lang]), ['line', ADVENT_LINE[lang]]];
      expect(other.map(([f]) => f)).toEqual(en.map(([f]) => f));
      for (const [i, [field, text]] of other.entries()) {
        expect(placeholders(text), `${lang} ${field}`).toBe(placeholders(en[i][1]));
        // (the Spanish title has no room for the 24 doors beside its long name)
        if (!(lang === 'es' && field === 'title')) expect(numbers(text), `${lang} ${field}`).toBe(numbers(en[i][1]));
        expect(text, `${lang} ${field}`).not.toBe(en[i][1]);
      }
    }
    for (const lang of LEARN_LANGS) {
      for (const [field, text] of [...texts(ADVENT_PAGE[lang]), ['line', ADVENT_LINE[lang]]]) {
        expect(text, `${lang} ${field}`).not.toMatch(/[–—!]/);
        expect(text.trim(), `${lang} ${field}`).toBe(text);
      }
    }
  });
});

describe('the quiet line to the calendar', () => {
  const learn = Object.fromEntries(LEARN_LANGS.map((l) => [l, pages.find((p) => p.url === (l === 'en' ? '/learn/' : `/${l}/learn/`))!.html])) as Record<Lang, string>;
  const home = Object.fromEntries(LEARN_LANGS.map((l) => [l, renderHome(template, l)])) as Record<Lang, string>;

  it('is on the home pages and /learn/, hidden, linking to the calendar in the page’s language', () => {
    for (const lang of LEARN_LANGS) {
      for (const html of [home[lang], learn[lang]]) {
        const line = one(html, new RegExp(`<p class="[^"]*season" id="${LINE_ID}" hidden>(.*?)</p>`));
        expect(line).toBe(`<a href="${ADVENT_URLS[lang]}">${ADVENT_LINE[lang]}</a>`);
        // its script, right after it
        expect(html).toMatch(new RegExp(`id="${LINE_ID}" hidden>.*</p>\\s*<script>[^<]*</script>`));
      }
    }
    // only there: no other page carries it
    expect(pages.filter((p) => p.html.includes(LINE_ID)).map((p) => p.url)).toEqual(['/learn/', '/nb/learn/', '/es/learn/']);
  });

  it('shows in November and December by the visitor’s own date, and on no other day', () => {
    const script = /id="advent-line" hidden>.*?<\/p>\s*<script>([^<]*)<\/script>/.exec(home.nb)![1];
    expect(script).toBe(LINE_SCRIPT.replace(/\n\s*/g, ' '));
    for (const date of [...days('2026-01-01', '2026-12-31'), '2027-01-01', '2027-11-01']) {
      expect(runLine(script, date), date).toBe(calendarOpen(date));
    }
  });
});
