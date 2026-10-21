/**
 * Counting plays (docs/online-goals.md, phase 3), the Worker's side: the
 * telemetry route (worker/telemetry.ts) with its closed list, its folding
 * of a batch into points, the rate limit and nothing written from a
 * refused body; the landing count of the share pages; the dashboard's
 * arithmetic and page (worker/admin.ts), with a stand-in for the SQL API;
 * and the privacy page in three languages (src/content/privacy.ts).
 */
import { describe, it, expect } from 'vitest';
import {
  handleTelemetry,
  checkEvent,
  checkBatch,
  fold,
  memoryEvents,
  countLanding,
  isLanding,
  isPersonAgent,
  BATCH_MAX,
  POINTS_MAX,
  BODY_MAX,
  RATE_LIMIT,
  TelemetryEvent
} from '../worker/telemetry';
import { handleAdmin, adminQuery, rowsOf, metricsOf, renderAdmin, sqlApi, DATASET, Row, ADMIN_PATH } from '../worker/admin';
import { handleRequest, Env, SHARE_TEMPLATE } from '../worker/index';
import template from '../index.html?raw';
import { LEVELS } from '../src/engine/ratings';
import { BUCKET_MAX } from '../src/content/dailies';
import dailies from '../src/content/dailies.json';
import type { Daily } from '../src/content/dailies';
import { PRIVACY, PRIVACY_URL } from '../src/content/privacy';
import { buildLearnPages, buildSitemap, SITE as PAGES_SITE } from '../src/content/learnPages';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { HOME_LANGS } from '../src/content/home';
import { version } from '../package.json';

const SITE = 'https://sudokui.app';
const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const DAILY = (dailies as Daily[])[10];

const good = (over: Record<string, unknown> = {}) => ({
  event: 'completed',
  band: 'Hard',
  bucket: 36,
  standalone: false,
  version: '1.0.0',
  source: 'tab',
  ...over
});
/** a person's browser: the route writes only what one sends (isPersonAgent) */
const ROUTE_BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/t`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': ROUTE_BROWSER, ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });

describe('the telemetry route', () => {
  it('answers nothing for other addresses', async () => {
    const events = memoryEvents();
    for (const path of ['/api/t/', '/api/t/x', '/api/daily/5/stats', '/t', '/api/telemetry'])
      expect(await handleTelemetry(new Request(SITE + path, { method: 'POST', body: '[]' }), events), path).toBeNull();
    expect(events.points).toHaveLength(0);
  });

  it('takes a batch and writes one point per distinct event, with a count', async () => {
    const events = memoryEvents();
    const res = (await handleTelemetry(post([good(), good(), good({ event: 'started', bucket: 0 })]), events, { country: 'NO' }))!;
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(events.points).toEqual([
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', 'NO'], doubles: [36, 2, 0, 0, 0, 0] },
      { indexes: ['started'], blobs: ['Hard', 'tab', '1.0.0', 'NO'], doubles: [0, 1, 0, 0, 0, 0] }
    ]);
  });

  it('keeps the flags apart, as doubles, and the country from the runtime, never the address', async () => {
    const events = memoryEvents();
    const res = (await handleTelemetry(
      post([good({ standalone: true, source: 'pwa', optin: true, offline: true, returning: true }), good({ optin: true }), good()], { 'cf-connecting-ip': '203.0.113.9' }),
      events
    ))!;
    expect(res.status).toBe(204);
    expect(events.points).toEqual([
      { indexes: ['completed'], blobs: ['Hard', 'pwa', '1.0.0', ''], doubles: [36, 1, 1, 1, 1, 1] },
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', ''], doubles: [36, 1, 0, 0, 1, 0] },
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', ''], doubles: [36, 1, 0, 0, 0, 0] }
    ]);
    expect(JSON.stringify(events.points)).not.toContain('203.0.113.9');
  });

  it('refuses whatever is off the closed list, and writes nothing from a refused body', async () => {
    const events = memoryEvents();
    const refused = async (body: unknown, status = 400) => {
      const res = (await handleTelemetry(post(body), events))!;
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(status);
      expect(res.headers.get('content-type')).toContain('json');
    };
    await refused('not json');
    await refused({});
    await refused([]);
    await refused([good({ event: 'solved' })]);
    await refused([good({ event: 'Completed' })]);
    await refused([good({ band: 'Hardest' })]);
    await refused([good({ band: 'hard' })]);
    await refused([good({ bucket: -1 })]);
    await refused([good({ bucket: BUCKET_MAX + 1 })]);
    await refused([good({ bucket: 1.5 })]);
    await refused([good({ bucket: '36' })]);
    await refused([good({ standalone: 'yes' })]);
    await refused([good({ version: '' })]);
    await refused([good({ version: 'x'.repeat(33) })]);
    await refused([good({ version: 'ver sion' })]);
    await refused([good({ source: 'bot' })]);
    await refused([good({ optin: 'yes' })]);
    await refused([good({ offline: 1 })]);
    // nothing rides along: an unknown field is refused, so the list stays closed
    await refused([good({ ip: '203.0.113.9' })]);
    await refused([good({ id: 'abc' })]);
    // one bad event refuses the whole batch
    await refused([good(), good(), good({ band: 'x' })]);
    await refused(Array.from({ length: BATCH_MAX + 1 }, () => good()));
    // a body too big to be a batch is not even read
    await refused([good({ version: 'v' }), { padding: 'x'.repeat(BODY_MAX) }], 413);
    const get = (await handleTelemetry(new Request(`${SITE}/api/t`), events))!;
    expect(get.status).toBe(405);
    expect(events.points).toHaveLength(0);
  });

  it('checks one event and one batch as the route does', () => {
    expect(checkEvent(good())).toEqual({ ...good(), offline: false, optin: false, returning: false });
    for (const band of LEVELS) expect(checkEvent(good({ band }))?.band).toBe(band);
    expect(checkEvent(good({ event: 'landing', bucket: 0 }))?.event).toBe('landing');
    expect(checkEvent(null)).toBeNull();
    expect(checkEvent([good()])).toBeNull();
    expect(checkBatch([good()])).toHaveLength(1);
    expect(checkBatch(good())).toBeNull();
  });

  it('folds identical events first, and writes at most the points one invocation may', async () => {
    const events = memoryEvents();
    const same = Array.from({ length: BATCH_MAX }, () => good());
    expect((await handleTelemetry(post(same), events))!.status).toBe(204);
    expect(events.points).toEqual([{ indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', ''], doubles: [36, BATCH_MAX, 0, 0, 0, 0] }]);
    // distinct buckets do not fold: the first POINTS_MAX points go, the rest are let go
    const spread = Array.from({ length: BATCH_MAX }, (_, i) => good({ bucket: i }));
    const again = memoryEvents();
    expect((await handleTelemetry(post(spread), again))!.status).toBe(204);
    expect(again.points).toHaveLength(POINTS_MAX);
    expect(again.points.map((p) => p.doubles[0])).toEqual(Array.from({ length: POINTS_MAX }, (_, i) => i));
    expect(fold(spread.map((e) => checkEvent(e)!), 'SE')).toHaveLength(BATCH_MAX);
  });

  it('answers 503 without a dataset, or with one that fails, and 429 past the rate limit', async () => {
    const none = (await handleTelemetry(post([good()]), null))!;
    expect(none.status).toBe(503);
    expect(none.headers.get('retry-after')).toBe('600');
    const broken = {
      writeDataPoint: () => {
        throw new Error('over the limit');
      }
    };
    expect((await handleTelemetry(post([good()]), broken))!.status).toBe(503);
    // one address, many batches: the counts live in this isolate's memory only
    const events = memoryEvents();
    const ip = { 'cf-connecting-ip': '203.0.113.7' };
    let last = 0;
    for (let i = 0; i < RATE_LIMIT.count + 1; i++) last = (await handleTelemetry(post([good()], ip), events))!.status;
    expect(last).toBe(429);
    expect(events.points).toHaveLength(RATE_LIMIT.count);
    expect((await handleTelemetry(post([good()], { 'cf-connecting-ip': '203.0.113.8' }), events))!.status).toBe(204);
  });
});

/** the static assets as the Worker sees them: share.tpl and a 404 for everything else */
function assets(extra: Partial<Env> = {}): Env {
  return {
    ASSETS: {
      fetch: async (request: Request) => {
        const u = new URL(request.url);
        if (u.pathname === SHARE_TEMPLATE) return new Response(template, { status: 200 });
        return new Response('not found', { status: 404, headers: { 'x-answered-by': 'assets' } });
      }
    },
    ...extra
  };
}

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const landing = (path: string, headers: Record<string, string> = {}, method = 'GET') =>
  new Request(SITE + path, { method, headers: { 'user-agent': BROWSER, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document', ...headers } });

describe('the landing count', () => {
  it('knows a person arriving from outside the site from everything else', () => {
    expect(isLanding(landing(`/p/${EASY}`))).toBe(true);
    expect(isLanding(landing(`/p/${EASY}`, { referer: 'https://chat.example/room/1' }))).toBe(true);
    // Safari before 16.4 sends no Sec-Fetch headers; it is a browser all the same
    expect(isLanding(new Request(`${SITE}/p/${EASY}`, { headers: { 'user-agent': BROWSER } }))).toBe(true);
    expect(isLanding(landing(`/p/${EASY}`, { referer: `${SITE}/` }))).toBe(false);
    expect(isLanding(landing(`/p/${EASY}`, { referer: `${SITE}/nb/p/${EASY}` }))).toBe(false);
    expect(isLanding(landing(`/p/${EASY}`, {}, 'HEAD'))).toBe(false);
    expect(isLanding(landing(`/p/${EASY}`, { 'sec-fetch-mode': 'cors' }))).toBe(false);
    expect(isLanding(landing(`/p/${EASY}`, { 'sec-fetch-dest': 'iframe' }))).toBe(false);
    for (const agent of [
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'WhatsApp/2.23.20.0',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'TelegramBot (like TwitterBot)',
      'http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)',
      'curl/8.4.0',
      ''
    ])
      expect(isLanding(landing(`/p/${EASY}`, { 'user-agent': agent })), agent).toBe(false);
  });

  it('writes a landing point from the share route, with the band and which address it was', async () => {
    const events = memoryEvents();
    const env = assets({ EVENTS: events });
    const res = await handleRequest(landing(`/nb/p/${EASY}?b=hard&s=1420`), env);
    expect(res.status).toBe(200);
    expect(events.points).toEqual([{ indexes: ['landing'], blobs: ['Hard', 'p', version, ''], doubles: [0, 1, 0, 0, 0, 0] }]);
    // a daily's address, with the band from the published list
    await handleRequest(landing(`/daily/${DAILY.date}`), env);
    expect(events.points[1]).toEqual({ indexes: ['landing'], blobs: [DAILY.level, 'daily', version, ''], doubles: [0, 1, 0, 0, 0, 0] });
    // a link without a band says so
    await handleRequest(landing(`/es/p/${EASY}`), env);
    expect(events.points[2].blobs).toEqual(['', 'p', version, '']);
    expect(events.points).toHaveLength(3);
  });

  it('counts no preview fetch, no click from inside the site, and nothing without a dataset', async () => {
    const events = memoryEvents();
    const env = assets({ EVENTS: events });
    for (const request of [
      landing(`/p/${EASY}`, { referer: `${SITE}/` }),
      landing(`/p/${EASY}`, { 'user-agent': 'facebookexternalhit/1.1' }),
      landing(`/p/${EASY}`, {}, 'HEAD'),
      // not a share address at all
      landing('/learn/')
    ]) {
      await handleRequest(request, env);
    }
    expect(events.points).toHaveLength(0);
    // without the binding the page still renders
    const res = await handleRequest(landing(`/p/${EASY}`), assets());
    expect(res.status).toBe(200);
    expect(countLanding(undefined, landing(`/p/${EASY}`), { level: 'Hard' })).toBe(false);
    // a dataset that throws never costs the page
    const broken = {
      writeDataPoint: () => {
        throw new Error('no');
      }
    };
    expect(countLanding(broken, landing(`/p/${EASY}`), { level: 'Hard' })).toBe(false);
    expect((await handleRequest(landing(`/p/${EASY}`), assets({ EVENTS: broken }))).status).toBe(200);
  });

  it('answers the telemetry route from the Worker as a whole, before the assets', async () => {
    const events = memoryEvents();
    const res = await handleRequest(post([good()]), assets({ EVENTS: events }));
    expect(res.status).toBe(204);
    expect(events.points).toHaveLength(1);
    expect((await handleRequest(post([good()]), assets())).status).toBe(503);
  });
});

describe('the dashboard', () => {
  const NOW = () => new Date('2026-10-13T12:00:00Z');
  const row = (day: string, event: string, source: string, over: Partial<Row> = {}): Row => ({
    day: `${day} 00:00:00`,
    event,
    source,
    n: 0,
    standalone: 0,
    offline: 0,
    optin: 0,
    optin_offline: 0,
    optin_returning: 0,
    ...over
  });
  const ROWS: Row[] = [
    row('2026-10-12', 'started', 'tab', { n: 10, optin: 4, optin_returning: 1 }),
    row('2026-10-12', 'completed', 'tab', { n: 6, standalone: 3, offline: 1, optin: 2, optin_offline: 1 }),
    row('2026-10-12', 'landing', 'p', { n: 3 }),
    row('2026-10-12', 'landing', 'daily', { n: 2 }),
    row('2026-10-01', 'completed', 'pwa', { n: 4, standalone: 4 }),
    // out of the window
    row('2026-09-01', 'completed', 'tab', { n: 100 }),
    // today so far
    row('2026-10-13', 'completed', 'tab', { n: 1 })
  ];
  const secrets = { ADMIN_ACCOUNT_ID: 'acc0unt1d', ADMIN_TOKEN: 's3cret-token' };
  const access = { 'cf-access-jwt-assertion': 'eyJ.header.payload' };
  /** the SQL API as a stand-in: what it was asked, and the answer it gives */
  function api(answer: () => Response) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return answer();
    }) as typeof fetch;
    return { calls, fetch: f };
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('asks for the last days, per UTC day, event and source, weighted by the sample interval', () => {
    const sql = adminQuery();
    expect(sql).toContain(`FROM ${DATASET}`);
    expect(sql).toContain("toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day");
    expect(sql).toContain('SUM(_sample_interval * double2) AS n');
    expect(sql).toContain("WHERE timestamp > NOW() - INTERVAL '31' DAY");
    expect(sql).toContain('GROUP BY day, event, source ORDER BY day FORMAT JSON');
    expect(DATASET).toBe('sudokui_events');
  });

  it('reads the rows the API gives, and nothing it does not', () => {
    expect(rowsOf({ data: [{ day: '2026-10-12 00:00:00', event: 'started', n: '7' }] })).toEqual([row('2026-10-12', 'started', '', { n: 7 })].map((r) => ({ ...r, day: '2026-10-12' })));
    expect(rowsOf({ data: [null, 4, { event: 'x' }, { day: 1 }] })).toEqual([]);
    expect(rowsOf('garbage')).toEqual([]);
    expect(rowsOf({ data: [{ day: '2026-10-12', event: 'completed', n: 'many' }] })[0].n).toBe(0);
  });

  it('computes the plan’s numbers: the week, the day before, the month and today', () => {
    const m = metricsOf(ROWS, NOW());
    expect(m.days).toHaveLength(31);
    expect(m.days[0].day).toBe('2026-09-13');
    expect(m.today.day).toBe('2026-10-13');
    expect(m.today.completed).toBe(1);
    const w = m.week;
    expect(w.starts).toBe(10);
    expect(w.completed).toBe(6);
    expect(w.online).toBe(5);
    expect(w.offlineReported).toBe(1);
    expect(w.optinOnline).toBe(1);
    expect(w.optinOffline).toBe(1);
    // the cohort played one offline per one online: everyone else's four online solves stand for four more
    expect(w.offlineEstimate).toBe(4);
    expect(w.total).toBe(10);
    expect(w.completionRate).toBeCloseTo(0.6);
    expect(w.installedShare).toBeCloseTo(0.5);
    expect(w.landings).toBe(5);
    expect(w.landingsDaily).toBe(2);
    expect(w.startsOptin).toBe(4);
    expect(w.startsNew).toBe(3);
    expect(w.startsReturning).toBe(1);
    expect(w.newShare).toBeCloseTo(0.75);
    expect(m.yesterday.landings).toBe(5);
    expect(m.month.completed).toBe(10);
    expect(m.month.installedShare).toBeCloseTo(0.7);
    // no opted-in device yet: no estimate, and no division by nothing
    const empty = metricsOf([], NOW());
    expect(empty.week.offlineEstimate).toBeNull();
    expect(empty.week.completionRate).toBeNull();
    expect(empty.week.newShare).toBeNull();
    expect(empty.week.total).toBe(0);
    expect(empty.generatedAt).toBe('2026-10-13 12:00 UTC');
  });

  it('renders the numbers and a sparkline, in plain HTML without a script', () => {
    const html = renderAdmin(metricsOf(ROWS, NOW()));
    expect(html).not.toContain('<script');
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
    expect(html).toContain('<svg viewBox="0 0 600 80"');
    expect(html).toContain('peak 6 on 2026-10-12');
    expect(html).toContain('<dt>Completed, last 7 days</dt><dd>5</dd>');
    expect(html).toContain('<dt>Offline, estimated</dt><dd>4</dd>');
    expect(html).toContain('<dt>Completed, total estimate</dt><dd>10</dd>');
    expect(html).toContain('<dt>Completion rate</dt><dd>60%</dd>');
    expect(html).toContain('<dt>Solved in installed app</dt><dd>50%</dd>');
    expect(html).toContain('not a count of installs');
    expect(html).toContain('<th>In installed app</th>');
    expect(html).not.toContain('<th>Installed</th>');
    expect(html).toContain('<dt>Landings yesterday</dt><dd>5</dd>');
    expect(html).toContain('<dt>New players</dt><dd>75%</dd>');
    expect(html).toContain('<dt>Returning players</dt><dd>25%</dd>');
    expect(html.match(/<dt>/g)).toHaveLength(12);
    expect(html.match(/<tr class="today">/g)).toHaveLength(1);
    expect(html).toContain('<td>2026-10-12</td><td>10</td><td>5</td><td>1</td><td>3</td><td>5</td><td>3</td><td>1</td>');
  });

  it('is an unknown path without its secrets, and outside Access', async () => {
    for (const env of [assets(), assets({ ADMIN_ACCOUNT_ID: 'x' }), assets({ ADMIN_TOKEN: 'y' })]) {
      const res = await handleRequest(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), env);
      expect(res.status).toBe(404);
      expect(res.headers.get('x-answered-by')).toBe('assets');
    }
    const outside = await handleRequest(new Request(`${SITE}${ADMIN_PATH}`), assets(secrets));
    expect(outside.status).toBe(404);
    expect(outside.headers.get('x-answered-by')).toBe('assets');
    expect(await handleAdmin(new Request(`${SITE}/admin/x`, { headers: access }), secrets)).toBeNull();
  });

  it('reads the dataset through the SQL API with the token, which never reaches the page', async () => {
    const { calls, fetch } = api(() => json({ meta: [], data: ROWS, rows: ROWS.length }));
    const res = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}/`, { headers: access }), secrets, { fetch, now: NOW }))!;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(sqlApi(secrets.ADMIN_ACCOUNT_ID));
    expect(calls[0].init?.method).toBe('POST');
    expect((calls[0].init?.headers as Record<string, string>).authorization).toBe(`Bearer ${secrets.ADMIN_TOKEN}`);
    expect(calls[0].init?.body).toBe(adminQuery());
    const html = await res.text();
    expect(html).toContain('<dt>Completed, total estimate</dt><dd>10</dd>');
    expect(html).not.toContain(secrets.ADMIN_TOKEN);
    expect(html).not.toContain(secrets.ADMIN_ACCOUNT_ID);
    const head = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { method: 'HEAD', headers: access }), secrets, { fetch, now: NOW }))!;
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const wrong = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { method: 'POST', headers: access }), secrets, { fetch, now: NOW }))!;
    expect(wrong.status).toBe(405);
  });

  it('says what the API said when it fails, without the secrets', async () => {
    const refused = api(() => json({ errors: [{ message: 'Authentication error' }] }, 403));
    const res = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), secrets, { fetch: refused.fetch, now: NOW }))!;
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).toContain('answered 403');
    expect(html).toContain('Authentication error');
    expect(html).not.toContain(secrets.ADMIN_TOKEN);
    const down = api(() => {
      throw new Error('fetch failed');
    });
    const gone = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), secrets, { fetch: down.fetch, now: NOW }))!;
    expect(gone.status).toBe(502);
    expect(await gone.text()).toContain('fetch failed');
    const html404 = api(() => new Response('<html>', { status: 200 }));
    expect((await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), secrets, { fetch: html404.fetch, now: NOW }))!.status).toBe(502);
  });
});

describe('the privacy page', () => {
  const pages = buildLearnPages();
  const byLang = Object.fromEntries(HOME_LANGS.map((l) => [l, pages.find((p) => p.url === `${l === 'en' ? '' : `/${l}`}${PRIVACY_URL}`)!]));
  /** words that would mean the English stayed */
  const ENGLISH = /\b(the|and|with|when|your|nothing|sends|server|device|offline|never|only)\b/i;

  it('exists in every language, built alike, and says what is sent', () => {
    for (const lang of HOME_LANGS) {
      const page = byLang[lang];
      expect(page, lang).toBeDefined();
      expect(page.lang).toBe(lang);
      expect(page.alternateOf).toBe(PRIVACY_URL);
      const c = PRIVACY[lang];
      expect(page.html).toContain(`<h1>${c.h1}</h1>`);
      for (const s of c.sections) expect(page.html).toContain(`<h2>${s.heading}</h2>`);
      expect(page.html).toContain('<a href="https://github.com/AImenes/sudokUI" rel="noopener">github.com/AImenes/sudokUI</a>');
      expect(page.html).not.toContain('{source}');
      expect(c.sections.map((s) => s.paragraphs.length)).toEqual(PRIVACY.en.sections.map((s) => s.paragraphs.length));
      expect(c.title.length).toBeLessThanOrEqual(48);
      // the page names the two lines, the bucket, the country and what is never there
      expect(page.html).toContain('15');
      expect(page.html).toContain('IP');
      expect(page.html).toContain('Cloudflare');
    }
    expect(PRIVACY.en.sections[0].paragraphs[0]).toContain('15-second');
    expect(PRIVACY.en.sections[0].paragraphs[1]).toContain('Nothing is stored on your device');
    expect(PRIVACY.en.sections[1].paragraphs[0]).toContain('Help count plays, including offline ones');
  });

  it('leaves no English in the Norwegian and Spanish copy', () => {
    for (const lang of ['nb', 'es'] as const) {
      const c = PRIVACY[lang];
      const texts = [c.name, c.title, c.description, c.h1, c.lead, c.updated, ...c.sections.flatMap((s) => [s.heading, ...s.paragraphs])];
      for (const text of texts) expect(ENGLISH.exec(text)?.[0], `${lang}: ${text.slice(0, 60)}`).toBeUndefined();
      for (const [i, text] of texts.entries()) {
        const en = [PRIVACY.en.name, PRIVACY.en.title, PRIVACY.en.description, PRIVACY.en.h1, PRIVACY.en.lead, PRIVACY.en.updated, ...PRIVACY.en.sections.flatMap((s) => [s.heading, ...s.paragraphs])][i];
        expect(text, `${lang} ${i}`).not.toBe(en);
      }
    }
  });

  it('is a static page the service worker leaves alone, in the sitemap, and in every footer', () => {
    for (const url of [PRIVACY_URL, '/nb/privacy/', '/es/privacy', '/privacy']) expect(STATIC_ROUTES.test(url), url).toBe(true);
    const sitemap = buildSitemap(pages);
    for (const lang of HOME_LANGS) expect(sitemap).toContain(`<loc>${PAGES_SITE}${byLang[lang].url}</loc>`);
    // every static page's footer names it, in the page's language
    for (const page of pages) {
      const prefix = page.lang === 'en' ? '' : `/${page.lang}`;
      expect(page.html, page.url).toContain(`<a href="${prefix}${PRIVACY_URL}">${PRIVACY[page.lang].name}</a>`);
    }
  });
});

describe('who is counted', () => {
  it('takes the lines of a crawler, a headless browser or an audit tool, and writes none of them', async () => {
    for (const agent of [
      '',
      'curl/8.4.0',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse'
    ]) {
      const events = memoryEvents();
      const res = (await handleTelemetry(post([good(), good({ event: 'started', bucket: 0 })], { 'user-agent': agent }), events))!;
      expect(res.status, agent).toBe(204);
      expect(events.points, agent).toEqual([]);
    }
    // a person's browser is written
    const events = memoryEvents();
    expect((await handleTelemetry(post([good()]), events))!.status).toBe(204);
    expect(events.points).toHaveLength(1);
    // and a refused body is still refused, whoever sends it
    expect((await handleTelemetry(post([{ event: 'nope' }], { 'user-agent': 'curl/8.4.0' }), memoryEvents()))!.status).toBe(400);
  });

  it('counts the people in the X, LinkedIn and Pinterest apps, and not those apps’ preview fetchers', () => {
    for (const agent of [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.31.1234',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.80',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 [Pinterest/Android]'
    ]) {
      expect(isPersonAgent(agent), agent).toBe(true);
      expect(isLanding(landing(`/p/${EASY}`, { 'user-agent': agent })), agent).toBe(true);
    }
    for (const agent of [
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'Twitterbot/1.0',
      'Mozilla/5.0 (compatible; Pinterestbot/1.0; +http://www.pinterest.com/bot.html)'
    ]) {
      expect(isPersonAgent(agent), agent).toBe(false);
      expect(isLanding(landing(`/p/${EASY}`, { 'user-agent': agent })), agent).toBe(false);
    }
  });

  it('counts a game played in Telegram’s browser, or in Instagram’s on a CUBOT phone, and not Skype’s preview fetcher', async () => {
    for (const agent of [
      'Mozilla/5.0 (Linux; Android 14; SM-A155F Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Telegram-Android/11.11.0 (Samsung SM-A155F; Android 14; SDK 34; AVERAGE)',
      'Mozilla/5.0 (Linux; Android 12; KINGKONG 9 Build/SP1A.210812.016; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.0.0 Android (31/12; 480dpi; 1080x2400; CUBOT; KINGKONG 9; KINGKONG_9; mt6789; en_GB; 800000000)'
    ]) {
      expect(isPersonAgent(agent), agent).toBe(true);
      expect(isLanding(landing(`/p/${EASY}`, { 'user-agent': agent })), agent).toBe(true);
      const events = memoryEvents();
      expect((await handleTelemetry(post([good()], { 'user-agent': agent }), events))!.status, agent).toBe(204);
      expect(events.points, agent).toHaveLength(1);
    }
    expect(isPersonAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com')).toBe(false);
    // another rugged-phone brand in Instagram's agent
    expect(
      isPersonAgent(
        'Mozilla/5.0 (Linux; Android 13; F102 Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36 Instagram 400.0.0.0.0 Android (33/13; 400dpi; 1080x2408; FOSSiBOT; F102; F102; mt6789; en_GB; 800000000)'
      )
    ).toBe(true);
  });

  it('leaves out Google’s inspection and read-aloud fetchers, the fetches AI assistants make for a user, and Bluesky’s link cards', () => {
    for (const agent of [
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36 (compatible; Google-InspectionTool/1.0;)',
      'Mozilla/5.0 (compatible; GoogleOther)',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 (compatible; Google-Read-Aloud; +https://support.google.com/webmasters/answer/1061943)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)',
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)',
      // Bluesky's link cards
      'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app) Chrome/124.0.6367.207 Safari/537.36'
    ]) {
      expect(isPersonAgent(agent), agent).toBe(false);
    }
  });
});
