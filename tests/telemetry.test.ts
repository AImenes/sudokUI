/**
 * Counting plays (docs/online-goals.md, phase 3), the Worker's side: the
 * telemetry route (worker/telemetry.ts) with its closed list, its folding
 * of a batch into points, the rate limit and nothing written from a
 * refused body; the landing count of the share pages; the dashboard's
 * arithmetic and page (worker/admin.ts), with a stand-in for the SQL API
 * and a signed Access token (tests/accessToken.ts);
 * and the privacy page in three languages (src/content/privacy.ts).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  handleTelemetry,
  checkEvent,
  checkBatch,
  fold,
  memoryEvents,
  countLanding,
  isLanding,
  isPersonAgent,
  landingFrom,
  landingWord,
  assistantTagged,
  LANDING_FROM,
  LANDING_SLOTS,
  PLAY_KINDS,
  PLAY_LANGS,
  SHARE_KINDS,
  SHARE_VIAS,
  BATCH_MAX,
  POINTS_MAX,
  BODY_MAX,
  RATE_LIMIT,
  TelemetryEvent
} from '../worker/telemetry';
import { handleAdmin, adminQuery, rowsOf, metricsOf, renderAdmin, sqlApi, DATASET, Row, ADMIN_PATH, dailySent, dailySentTable } from '../worker/admin';
import { handleRequest, Env, SHARE_TEMPLATE, HOME_PATHS } from '../worker/index';
import { ACCESS_HEADER, type AccessKeys } from '../worker/access';
import { ACCESS_SECRETS, certsEndpoint, claimsAt, keysOver, signer, type Signer } from './accessToken';
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
import { readFileSync } from 'node:fs';

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
/** a share line, as the app sends one (src/state/telemetry.ts, shared) */
const shared = (over: Record<string, unknown> = {}) => ({
  event: 'shared',
  band: 'Hard',
  bucket: 0,
  standalone: false,
  version: '1.0.0',
  source: 'tab',
  what: 'challenge',
  via: 'copy',
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

  it("takes the eight band names an app from before HoDoKu's five sends, and writes each as its level", async () => {
    const events = memoryEvents();
    const old = ['Beginner', 'Easy', 'Medium', 'Tricky', 'Hard', 'Unfair', 'Extreme', 'Nightmare'];
    const res = (await handleTelemetry(post(old.map((band) => good({ band }))), events, { country: 'NO' }))!;
    expect(res.status).toBe(204);
    // identical once read as levels, so the eight fold into five points
    expect(events.points.map((p) => [p.blobs[0], p.doubles[1]])).toEqual([
      ['Easy', 2],
      ['Medium', 1],
      ['Hard', 2],
      ['Unfair', 1],
      ['Extreme', 2]
    ]);
    expect(checkEvent(good({ band: 'Tricky' }))?.band).toBe('Hard');
    expect(checkEvent(good({ band: 'tricky' }))).toBeNull();
    expect(checkEvent(good({ band: 'constructor' }))).toBeNull();
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
    // a landing is the share route's own: none can be posted
    await refused([good({ event: 'landing', bucket: 0 })]);
    // a share says what and how, from the lists, with no time and none of the opt-in's flags
    await refused([shared({ what: undefined })]);
    await refused([shared({ via: undefined })]);
    await refused([shared({ what: 'link' })]);
    await refused([shared({ what: 'https://sudokui.app/p/x' })]);
    await refused([shared({ via: 'whatsapp' })]);
    await refused([shared({ bucket: 3 })]);
    await refused([shared({ optin: true })]);
    await refused([shared({ offline: true })]);
    await refused([shared({ returning: true })]);
    await refused([shared({ to: 'friend' })]);
    // and a play line carries neither
    await refused([good({ what: 'puzzle' })]);
    await refused([good({ event: 'started', bucket: 0, via: 'copy' })]);
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
    expect(checkEvent(good({ event: 'landing', bucket: 0 }))).toBeNull();
    for (const what of SHARE_KINDS)
      for (const via of SHARE_VIAS) expect(checkEvent(shared({ what, via }))).toEqual({ ...shared({ what, via }), offline: false, optin: false, returning: false });
    // false flags are what a share line has anyway
    expect(checkEvent(shared({ optin: false, offline: false, returning: false }))).not.toBeNull();
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

  it('writes a share as a point with what was shared and how, folded by both', async () => {
    const events = memoryEvents();
    const batch = [shared(), shared(), shared({ via: 'sheet' }), shared({ what: 'daily', band: 'Easy' }), good()];
    expect((await handleTelemetry(post(batch), events, { country: 'NO' }))!.status).toBe(204);
    expect(events.points).toEqual([
      { indexes: ['shared'], blobs: ['Hard', 'tab', '1.0.0', 'NO', 'challenge', 'copy'], doubles: [0, 2, 0, 0, 0, 0] },
      { indexes: ['shared'], blobs: ['Hard', 'tab', '1.0.0', 'NO', 'challenge', 'sheet'], doubles: [0, 1, 0, 0, 0, 0] },
      { indexes: ['shared'], blobs: ['Easy', 'tab', '1.0.0', 'NO', 'daily', 'copy'], doubles: [0, 1, 0, 0, 0, 0] },
      // a play line keeps its four blobs
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', 'NO'], doubles: [36, 1, 0, 0, 0, 0] }
    ]);
  });

  it('takes a start or a solve with its kind of game and language, from the lists, and writes both', async () => {
    const events = memoryEvents();
    const batch = [
      good({ kind: 'daily', lang: 'nb' }),
      good({ kind: 'daily', lang: 'nb' }),
      good({ event: 'started', bucket: 0, kind: 'practice', lang: 'es' }),
      good({ kind: 'shared', lang: 'en' }),
      // an app from before them sends neither, and is still taken
      good()
    ];
    expect((await handleTelemetry(post(batch), events, { country: 'NO' }))!.status).toBe(204);
    expect(events.points).toEqual([
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', 'NO', 'daily', 'nb'], doubles: [36, 2, 0, 0, 0, 0] },
      { indexes: ['started'], blobs: ['Hard', 'tab', '1.0.0', 'NO', 'practice', 'es'], doubles: [0, 1, 0, 0, 0, 0] },
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', 'NO', 'shared', 'en'], doubles: [36, 1, 0, 0, 0, 0] },
      { indexes: ['completed'], blobs: ['Hard', 'tab', '1.0.0', 'NO'], doubles: [36, 1, 0, 0, 0, 0] }
    ]);
    for (const kind of PLAY_KINDS)
      for (const lang of PLAY_LANGS) {
        // a door of the advent calendar says which door, as its line must (tests/adventApi.test.ts)
        const door = kind === 'advent' ? { door: 7 } : {};
        expect(checkEvent(good({ kind, lang, ...door }))).toMatchObject({ kind, lang });
        expect(checkEvent(good({ event: 'started', bucket: 0, kind, lang, optin: true, offline: true, returning: true, ...door }))).toMatchObject({ kind, lang });
      }
    expect(checkEvent(good())).not.toHaveProperty('kind');
  });

  it('refuses a kind or a language off the lists, one without the other, and either on a share', async () => {
    const events = memoryEvents();
    for (const body of [
      good({ kind: 'weekly', lang: 'en' }),
      good({ kind: 'Daily', lang: 'en' }),
      good({ kind: 'daily', lang: 'de' }),
      good({ kind: 'daily', lang: 'en-GB' }),
      good({ kind: 'daily', lang: 'NB' }),
      good({ kind: 1, lang: 'en' }),
      good({ kind: 'daily', lang: null }),
      good({ kind: 'daily' }),
      good({ lang: 'nb' }),
      good({ kind: '', lang: '' }),
      good({ kind: 'daily', lang: 'nb', what: 'puzzle' }),
      good({ kind: 'daily', lang: 'nb', country: 'NO' }),
      shared({ kind: 'daily', lang: 'en' }),
      shared({ kind: 'daily' }),
      shared({ lang: 'en' })
    ]) {
      expect(checkEvent(body), JSON.stringify(body)).toBeNull();
      expect((await handleTelemetry(post([body]), events))!.status, JSON.stringify(body)).toBe(400);
    }
    expect(events.points).toHaveLength(0);
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
    // a page fetched ahead of a click is no one arriving yet (the review of the reach batch)
    expect(isLanding(landing(`/p/${EASY}`, { 'sec-purpose': 'prefetch' }))).toBe(false);
    expect(isLanding(landing('/', { 'sec-purpose': 'prefetch;prerender' }))).toBe(false);
    expect(isLanding(landing('/', { purpose: 'prefetch' }))).toBe(false);
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
    expect(events.points).toEqual([{ indexes: ['landing'], blobs: ['Hard', 'p', version, '', 'none'], doubles: [0, 1, 0, 0, 0, 0] }]);
    // a daily's address, with the band from the published list
    await handleRequest(landing(`/daily/${DAILY.date}`), env);
    expect(events.points[1]).toEqual({ indexes: ['landing'], blobs: [DAILY.level, 'daily', version, '', 'none'], doubles: [0, 1, 0, 0, 0, 0] });
    // a link without a band says so
    await handleRequest(landing(`/es/p/${EASY}`), env);
    expect(events.points[2].blobs).toEqual(['', 'p', version, '', 'none']);
    // where it came from is one word, never the address
    const thread = 'http://forum.enjoysudoku.com/viewtopic.php?f=2&t=12345&secret=abc';
    await handleRequest(landing(`/p/${EASY}`, { referer: thread }), env);
    expect(events.points[3].blobs).toEqual(['', 'p', version, '', 'enjoysudoku']);
    expect(JSON.stringify(events.points)).not.toContain('viewtopic');
    expect(JSON.stringify(events.points)).not.toContain('forum.enjoysudoku.com');
    expect(events.points).toHaveLength(4);
  });

  it('turns a referrer into one word of a closed list, and nothing else', () => {
    const cases: [string | null, string][] = [
      [null, 'none'],
      ['', 'none'],
      ['not a url', 'none'],
      ['https://www.google.com/', 'search'],
      ['https://www.google.no/', 'search'],
      ['https://www.google.co.uk/search?q=sudoku', 'search'],
      ['https://google.com.br/', 'search'],
      ['https://www.bing.com/', 'search'],
      ['https://duckduckgo.com/', 'search'],
      ['https://search.yahoo.com/', 'search'],
      ['https://search.brave.com/', 'search'],
      ['android-app://com.google.android.googlequicksearchbox/', 'search'],
      ['https://mail.google.com/', 'mail'],
      ['https://outlook.live.com/', 'mail'],
      ['https://mail.yahoo.com/', 'mail'],
      ['android-app://com.google.android.gm/', 'mail'],
      ['https://gemini.google.com/', 'ai'],
      ['https://chatgpt.com/', 'ai'],
      ['https://www.perplexity.ai/', 'ai'],
      ['https://www.reddit.com/', 'reddit'],
      ['https://old.reddit.com/r/sudoku/', 'reddit'],
      ['https://out.reddit.com/', 'reddit'],
      ['android-app://com.reddit.frontpage/', 'reddit'],
      ['http://forum.enjoysudoku.com/', 'enjoysudoku'],
      ['https://news.ycombinator.com/', 'hackernews'],
      ['https://l.facebook.com/', 'facebook'],
      ['https://m.facebook.com/', 'facebook'],
      ['android-app://com.facebook.katana/', 'facebook'],
      ['https://discord.com/', 'discord'],
      ['https://t.co/', 'social'],
      ['https://x.com/', 'social'],
      ['https://www.linkedin.com/', 'social'],
      ['https://bsky.app/', 'social'],
      ['https://web.whatsapp.com/', 'chat'],
      ['https://web.telegram.org/', 'chat'],
      ['android-app://org.telegram.messenger/', 'chat'],
      ['android-app://com.Slack/', 'chat'],
      ['https://github.com/AImenes/sudokUI', 'github'],
      ['https://www.sudokuwiki.org/', 'sudoku'],
      ['https://sudoku.coach/', 'sudoku'],
      ['https://sudokupad.app/', 'sudoku'],
      ['https://example.com/', 'other'],
      ['https://notgoogle.com/', 'other'],
      ['https://google.evil.example/', 'other'],
      ['https://reddit.com.evil.example/', 'other'],
      ['https://evilreddit.com/', 'other'],
      ['android-app://com.example.unknown/', 'other'],
      ['ftp://github.com/', 'other'],
      ['https://WWW.GOOGLE.COM./', 'search'],
      // a search engine is its search host, not its whole domain
      ['https://chat.google.com/', 'chat'],
      ['https://sites.google.com/view/club', 'other'],
      ['https://groups.google.com/g/rec.puzzles', 'other'],
      ['https://docs.google.com/', 'other'],
      ['https://news.yahoo.com/', 'other'],
      ['https://no.search.yahoo.com/', 'search'],
      ['https://mail.naver.com/', 'mail'],
      ['https://search.naver.com/', 'search'],
      ['https://cafe.naver.com/', 'other'],
      ['https://email.seznam.cz/', 'mail'],
      ['https://www.seznam.cz/', 'search'],
      ['https://tieba.baidu.com/', 'other'],
      ['https://www.baidu.com/', 'search'],
      ['https://yandex.ru/', 'search'],
      ['https://music.yandex.ru/', 'other'],
      // Microsoft 365's own hosts, the mail and the chat; its home is another site
      ['https://outlook.office.com/', 'mail'],
      ['https://outlook.cloud.microsoft/', 'mail'],
      ['https://teams.cloud.microsoft/', 'chat'],
      ['https://m365.cloud.microsoft/', 'other'],
      // the apps of the services named, and the phone's messages apps
      ['android-app://com.google.android.youtube/', 'social'],
      ['android-app://com.whatsapp.w4b/', 'chat'],
      ['android-app://com.google.android.apps.dynamite/', 'chat'],
      ['android-app://com.google.android.apps.messaging/', 'chat'],
      ['android-app://com.samsung.android.messaging/', 'chat'],
      ['android-app://com.microsoft.teams/', 'chat'],
      ['android-app://ch.protonmail.android/', 'mail'],
      // a site that sends its whole address: only the host is read
      ['https://www.reddit.com/r/sudoku/comments/abc/title/?utm_source=share', 'reddit'],
      // the directories of apps, Lemmy and Mastodon, the press, and the Norwegian sudoku site
      ['https://alternativeto.net/software/hodoku/', 'directory'],
      ['https://www.saashub.com/', 'directory'],
      ['https://www.producthunt.com/', 'directory'],
      ['https://pwa.directory/', 'directory'],
      ['https://pwastore.io/', 'directory'],
      ['https://store.app/', 'directory'],
      ['https://lemmy.world/c/sudoku', 'fediverse'],
      ['https://lemmy.ml/', 'fediverse'],
      ['https://mastodon.social/', 'fediverse'],
      ['https://fosstodon.org/', 'fediverse'],
      ['https://snabelen.no/', 'fediverse'],
      ['android-app://org.joinmastodon.android/', 'fediverse'],
      ['android-app://com.jerboa/', 'fediverse'],
      ['https://www.kode24.no/', 'press'],
      ['https://www.tu.no/artikler/x', 'press'],
      ['https://www.aftenposten.no/', 'press'],
      ['https://www.menneske.no/sudoku/', 'sudoku'],
      ['https://notkode24.no/', 'other'],
      ['https://lemmy.world.evil.example/', 'other'],
      ['https://menu.no/', 'other']
    ];
    for (const [referer, word] of cases) expect(landingFrom(referer), String(referer)).toBe(word);
    // every word is on the list
    for (const [referer] of cases) expect(LANDING_FROM as readonly string[]).toContain(landingFrom(referer));
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
    expect(countLanding(undefined, landing(`/p/${EASY}`), 'p', 'Hard')).toBe(false);
    // a dataset that throws never costs the page
    const broken = {
      writeDataPoint: () => {
        throw new Error('no');
      }
    };
    expect(countLanding(broken, landing(`/p/${EASY}`), 'p', 'Hard')).toBe(false);
    expect((await handleRequest(landing(`/p/${EASY}`), assets({ EVENTS: broken }))).status).toBe(200);
  });

  /** the assets with the three home pages: each answers with its own file */
  function withHomes(extra: Partial<Env> = {}): Env {
    return {
      ASSETS: {
        fetch: async (request: Request) => {
          const u = new URL(request.url);
          if ((HOME_PATHS as string[]).includes(u.pathname)) return new Response(`home ${u.pathname}`, { status: 200, headers: { 'x-answered-by': 'assets' } });
          return new Response('not found', { status: 404, headers: { 'x-answered-by': 'assets' } });
        }
      },
      ...extra
    };
  }

  it('counts a person arriving at a home page from outside the site, and answers with the page itself', async () => {
    const events = memoryEvents();
    const env = withHomes({ EVENTS: events });
    for (const path of ['/', '/nb/', '/es/']) {
      const res = await handleRequest(landing(path, { referer: 'https://alternativeto.net/software/sudokui/' }), env);
      expect(res.status, path).toBe(200);
      expect(res.headers.get('x-answered-by')).toBe('assets');
      expect(await res.text()).toBe(`home ${path}`);
    }
    expect(events.points).toEqual(
      ['/', '/nb/', '/es/'].map(() => ({ indexes: ['landing'], blobs: ['', 'home', version, '', 'directory'], doubles: [0, 1, 0, 0, 0, 0] }))
    );
    // a query, a campaign's say, is still the home page; with a referrer the word is the referrer's, never the query's
    await handleRequest(landing('/?utm_source=kode24', { referer: 'https://www.kode24.no/artikkel/1' }), env);
    expect(events.points[3].blobs).toEqual(['', 'home', version, '', 'press']);
    await handleRequest(landing('/nb/'), env);
    expect(events.points[4].blobs).toEqual(['', 'home', version, '', 'none']);
    expect(JSON.stringify(events.points)).not.toContain('kode24');
    expect(LANDING_SLOTS).toEqual(['p', 'daily', 'home', 'advent']);
  });

  it('counts a landing with no referrer as ai when an AI assistant tagged its link, reading that one tag and keeping nothing of it', async () => {
    // the tag names an assistant by the hosts of `ai`, a subdomain included, in any case
    for (const tag of ['chatgpt.com', 'ChatGPT.com', 'chat.openai.com', 'perplexity.ai', 'www.perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com', 'chatgpt.com.'])
      expect(assistantTagged(`${SITE}/?utm_source=${encodeURIComponent(tag)}`), tag).toBe(true);
    // anything else is no assistant: another source, a lookalike, a host that only contains one, another parameter
    for (const address of [
      `${SITE}/`,
      `${SITE}/?utm_source=`,
      `${SITE}/?utm_source=newsletter`,
      `${SITE}/?utm_source=google.com`,
      `${SITE}/?utm_source=notchatgpt.com`,
      `${SITE}/?utm_source=chatgpt.com.evil.example`,
      `${SITE}/?utm_source=https%3A%2F%2Fchatgpt.com%2F`,
      `${SITE}/?ref=chatgpt.com`,
      `${SITE}/?utm_medium=chatgpt.com`,
      `${SITE}/#utm_source=chatgpt.com`,
      'not an address'
    ])
      expect(assistantTagged(address), address).toBe(false);
    // the word: with no referrer, the tag; with one, the referrer, whatever the tag says
    expect(landingWord(landing('/?utm_source=chatgpt.com'))).toBe('ai');
    expect(landingWord(landing('/?utm_source=newsletter'))).toBe('none');
    expect(landingWord(landing('/?utm_source=chatgpt.com', { referer: 'https://www.reddit.com/' }))).toBe('reddit');
    expect(landingWord(landing('/?utm_source=chatgpt.com', { referer: 'https://unknown.example/' }))).toBe('other');
    expect(landingWord(landing('/', { referer: 'https://chatgpt.com/' }))).toBe('ai');
    // on the home pages and the share addresses alike, and nothing of the address is written
    const events = memoryEvents();
    const env = withHomes({ EVENTS: events });
    await handleRequest(landing('/?utm_source=chatgpt.com'), env);
    await handleRequest(landing('/es/?utm_source=perplexity.ai&utm_medium=referral&utm_campaign=sudoku-tips&q=private'), env);
    expect(events.points).toEqual(
      ['/', '/es/'].map(() => ({ indexes: ['landing'], blobs: ['', 'home', version, '', 'ai'], doubles: [0, 1, 0, 0, 0, 0] }))
    );
    const shares = memoryEvents();
    await handleRequest(landing(`/nb/p/${EASY}?b=hard&utm_source=chatgpt.com`), assets({ EVENTS: shares }));
    await handleRequest(landing(`/daily/${DAILY.date}?utm_source=claude.ai`), assets({ EVENTS: shares }));
    expect(shares.points.map((p) => [p.blobs[1], p.blobs[4]])).toEqual([
      ['p', 'ai'],
      ['daily', 'ai']
    ]);
    const written = JSON.stringify([...events.points, ...shares.points]);
    for (const part of ['utm', 'chatgpt', 'perplexity', 'claude', 'referral', 'sudoku-tips', 'private']) expect(written).not.toContain(part);
    // from inside the site no landing is counted, tag or not
    await handleRequest(landing('/?utm_source=chatgpt.com', { referer: `${SITE}/learn/` }), env);
    expect(events.points).toHaveLength(2);
  });

  it('counts no home landing from the site itself, from a robot or a preview, for a fetch that is no visit, or on another page', async () => {
    const events = memoryEvents();
    const env = withHomes({ EVENTS: events });
    for (const request of [
      // a click from inside the site: a Learn page, the privacy page, a share page, the other language
      landing('/', { referer: `${SITE}/learn/x-wing/` }),
      landing('/nb/', { referer: `${SITE}/` }),
      landing('/es/', { referer: `${SITE}/es/privacy/` }),
      // robots, preview fetchers and audit tools
      landing('/', { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }),
      landing('/', { 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)' }),
      landing('/nb/', { 'user-agent': 'facebookexternalhit/1.1' }),
      landing('/es/', { 'user-agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' }),
      landing('/', { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/141.0.0.0 Safari/537.36' }),
      landing('/', { 'user-agent': 'curl/8.4.0' }),
      landing('/', { 'user-agent': '' }),
      // not a visit: a HEAD, a script's fetch, a frame, the service worker storing the page
      landing('/', {}, 'HEAD'),
      landing('/', { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }),
      landing('/', { 'sec-fetch-dest': 'iframe' }),
      landing('/', { 'sec-fetch-mode': 'same-origin', 'sec-fetch-dest': 'empty', referer: `${SITE}/sw.js` }),
      // other pages: no home, and not one the Worker counts
      landing('/nb'),
      landing('/index.html'),
      landing('/learn/'),
      landing('/privacy/'),
      landing('/fr/')
    ]) {
      await handleRequest(request, env);
    }
    expect(events.points).toHaveLength(0);
    // without the binding, or with one that fails, the page is still the page
    expect(await (await handleRequest(landing('/'), withHomes())).text()).toBe('home /');
    const broken = {
      writeDataPoint: () => {
        throw new Error('no');
      }
    };
    expect(await (await handleRequest(landing('/es/'), withHomes({ EVENTS: broken }))).text()).toBe('home /es/');
  });

  it('is sent the three home pages first by wrangler.jsonc, and only those besides its own paths', () => {
    // the comments are // lines; the strings hold no //
    const config = JSON.parse(
      new TextDecoder()
        .decode(readFileSync('wrangler.jsonc'))
        .split('\n')
        .filter((line) => !line.trim().startsWith('//'))
        .join('\n')
    ) as { assets: { run_worker_first: string[] } };
    const first = config.assets.run_worker_first;
    for (const path of HOME_PATHS) expect(first, path).toContain(path);
    expect(HOME_PATHS).toEqual(['/', '/nb/', '/es/']);
    // no pattern that would send every page through the Worker
    expect(first).not.toContain('/*');
    expect(first.filter((p) => !p.includes('*') && p.endsWith('/'))).toEqual(HOME_PATHS);
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
    kind: '',
    via: '',
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
    row('2026-10-12', 'landing', 'p', { n: 3, kind: 'enjoysudoku' }),
    row('2026-10-12', 'landing', 'daily', { n: 2, kind: 'none' }),
    row('2026-10-11', 'shared', 'tab', { n: 2, kind: 'challenge', via: 'sheet' }),
    row('2026-10-11', 'shared', 'tab', { n: 1, kind: 'challenge', via: 'copy' }),
    row('2026-10-12', 'shared', 'pwa', { n: 1, kind: 'position', via: 'copy' }),
    row('2026-10-01', 'completed', 'pwa', { n: 4, standalone: 4 }),
    // a landing counted before where it came from was kept
    row('2026-10-01', 'landing', 'p', { n: 1 }),
    // out of the window
    row('2026-09-01', 'completed', 'tab', { n: 100 }),
    // today so far
    row('2026-10-13', 'completed', 'tab', { n: 1 })
  ];
  const secrets = { ADMIN_ACCOUNT_ID: 'acc0unt1d', ADMIN_TOKEN: 's3cret-token', ...ACCESS_SECRETS };
  // a token Access signed for the dashboard (tests/accessToken.ts), and the team's keys behind a stand-in endpoint
  let team: Signer;
  let access: Record<string, string>;
  let accessKeys: AccessKeys;
  beforeAll(async () => {
    team = await signer('9338abe1baf2fe492f646a736f25afbf7b025e35c627be4f60c414d4c73069b8');
    access = { [ACCESS_HEADER]: await team.sign(claimsAt(NOW())) };
    accessKeys = keysOver(certsEndpoint(() => [team]));
  });
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

  it('asks for the last days, per UTC day, event, source, kind and way, weighted by the sample interval', () => {
    const sql = adminQuery();
    expect(sql).toContain(`FROM ${DATASET}`);
    expect(sql).toContain("toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day");
    expect(sql).toContain('blob2 AS source, blob5 AS kind, blob6 AS via');
    expect(sql).toContain('SUM(_sample_interval * double2) AS n');
    expect(sql).toContain("WHERE timestamp > NOW() - INTERVAL '31' DAY");
    expect(sql).toContain('GROUP BY day, event, source, kind, via ORDER BY day FORMAT JSON');
    expect(DATASET).toBe('sudokui_events');
  });

  it('reads the rows the API gives, and nothing it does not', () => {
    expect(rowsOf({ data: [{ day: '2026-10-12 00:00:00', event: 'started', n: '7' }] })).toEqual([row('2026-10-12', 'started', '', { n: 7 })].map((r) => ({ ...r, day: '2026-10-12' })));
    expect(rowsOf({ data: [{ day: '2026-10-12', event: 'shared', source: 'tab', kind: 'daily', via: 'sheet', n: 2 }] })[0]).toMatchObject({ kind: 'daily', via: 'sheet', n: 2 });
    expect(rowsOf({ data: [{ day: '2026-10-12', event: 'landing', kind: 5, via: null, n: 1 }] })[0]).toMatchObject({ kind: '', via: '' });
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
    // the shares, by kind and way, and where the landings came from
    expect(w.shares).toBe(4);
    expect(w.sharesSheet).toBe(2);
    expect(w.sharesBy).toEqual({ challenge: { sheet: 2, copy: 1, save: 0 }, position: { sheet: 0, copy: 1, save: 0 } });
    expect(w.sharesSaved).toBe(0);
    expect(w.landingsPerShare).toBeCloseTo(1.25);
    expect(w.landingsFrom).toEqual({ enjoysudoku: 3, none: 2 });
    expect(m.yesterday.shares).toBe(1);
    expect(m.month.landingsFrom).toEqual({ enjoysudoku: 3, none: 2, '': 1 });
    expect(m.days.find((d) => d.day === '2026-10-11')!.shares).toBe(3);
    // no opted-in device yet: no estimate, and no division by nothing
    const empty = metricsOf([], NOW());
    expect(empty.week.offlineEstimate).toBeNull();
    expect(empty.week.completionRate).toBeNull();
    expect(empty.week.newShare).toBeNull();
    expect(empty.week.landingsPerShare).toBeNull();
    expect(empty.week.sharesBy).toEqual({});
    expect(empty.week.total).toBe(0);
    expect(empty.generatedAt).toBe('2026-10-13 12:00 UTC');
  });

  it('counts a picture of the board as a share, saved as a file or not, and leaves it out of the landings per share', () => {
    const m = metricsOf(
      [
        ...ROWS,
        row('2026-10-12', 'shared', 'tab', { n: 3, kind: 'image', via: 'save' }),
        row('2026-10-12', 'shared', 'tab', { n: 1, kind: 'image', via: 'sheet' }),
        row('2026-10-12', 'shared', 'tab', { n: 2, kind: 'image', via: 'copy' })
      ],
      NOW()
    );
    const w = m.week;
    expect(w.shares).toBe(10);
    expect(w.sharesSheet).toBe(3);
    expect(w.sharesSaved).toBe(3);
    expect(w.sharesBy.image).toEqual({ sheet: 1, copy: 2, save: 3 });
    // a picture carries no link: the five landings are over the four links shared, as before
    expect(w.landingsPerShare).toBeCloseTo(1.25);
    const html = renderAdmin(m);
    expect(html).toContain('<dt>Shares, last 7 days</dt><dd>10</dd><small>3 through the share sheet, 4 copied, 3 saved as a picture</small>');
    expect(html).toContain('<thead><tr><th>Shared</th><th>Share sheet</th><th>Copied</th><th>Saved</th><th>All</th></tr></thead>');
    expect(html).toContain('<tr><td>Picture of the board (Share, or a hint)</td><td>1</td><td>2</td><td>3</td><td>6</td></tr>');
    expect(html).toContain('<small>5 share-page landings over 4 shares of a link, 7 days</small>');
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
    expect(html).toContain('<dt>Shares, last 7 days</dt><dd>4</dd><small>2 through the share sheet, 2 copied</small>');
    expect(html).toContain('<dt>Landings per share</dt><dd>1.25</dd>');
    expect(html.match(/<dt>/g)).toHaveLength(14);
    // today's row in the every-day table and in the games begun per day
    expect(html.match(/<tr class="today">/g)).toHaveLength(2);
    expect(html).toContain('<th>Shares</th><th>Landings</th>');
    expect(html).toContain('<td>2026-10-12</td><td>10</td><td>5</td><td>1</td><td>3</td><td>1</td><td>5</td><td>0</td><td>3</td><td>1</td>');
    // what was shared, every kind in the list's order, and where landings came from, the most first
    expect(html).toContain('<tr><td>Puzzle link (Share)</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>');
    expect(html).toContain('<tr><td>Challenge (win screen)</td><td>2</td><td>1</td><td>0</td><td>3</td></tr>');
    expect(html).toContain('<tr><td>Picture of the board (Share, or a hint)</td><td>0</td><td>0</td><td>0</td><td>0</td></tr>');
    expect(html.indexOf('Puzzle link (Share)')).toBeLessThan(html.indexOf('Daily line (win screen)'));
    expect(html).toContain('<tr><td>Enjoy Sudoku forum</td><td>0</td><td>3</td><td>3</td><td>60%</td></tr>');
    expect(html).toContain('<tr><td>No referrer: typed, a bookmark, most apps</td><td>0</td><td>2</td><td>2</td><td>40%</td></tr>');
    expect(html.indexOf('Enjoy Sudoku forum')).toBeLessThan(html.indexOf('No referrer'));
    // a week without landings says so
    expect(renderAdmin(metricsOf([], NOW()))).toContain('<tr><td>No landings</td><td>0</td><td>0</td><td>0</td><td>—</td></tr>');
  });

  it('shows home landings apart, and the games by kind and language, with practice out of the play counts', () => {
    const rows: Row[] = [
      // a week from the November builds on: kinds and languages, and the home pages
      row('2026-10-12', 'started', 'tab', { n: 3, kind: 'daily', via: 'nb', optin: 1 }),
      row('2026-10-12', 'started', 'pwa', { n: 2, kind: 'new', via: 'en' }),
      row('2026-10-12', 'started', 'tab', { n: 1, kind: 'shared', via: 'es' }),
      row('2026-10-12', 'completed', 'pwa', { n: 2, kind: 'daily', via: 'nb', standalone: 2 }),
      row('2026-10-11', 'started', 'tab', { n: 5, kind: 'practice', via: 'en', optin: 2, optin_returning: 1 }),
      row('2026-10-11', 'completed', 'pwa', { n: 4, kind: 'practice', via: 'en', standalone: 4, offline: 1, optin: 1, optin_offline: 1 }),
      // an older build's line says neither
      row('2026-10-11', 'started', 'tab', { n: 4 }),
      row('2026-10-12', 'landing', 'home', { n: 4, kind: 'search' }),
      row('2026-10-12', 'landing', 'home', { n: 1, kind: 'directory' }),
      row('2026-10-12', 'landing', 'p', { n: 2, kind: 'directory' }),
      row('2026-10-11', 'landing', 'daily', { n: 1, kind: 'fediverse' }),
      row('2026-10-12', 'shared', 'tab', { n: 2, kind: 'puzzle', via: 'copy' })
    ];
    const m = metricsOf(rows, NOW());
    const w = m.week;
    // the play counts read as before practice was counted
    expect(w.starts).toBe(10);
    expect(w.completed).toBe(2);
    expect(w.offlineReported).toBe(0);
    expect(w.standalone).toBe(2);
    expect(w.startsOptin).toBe(1);
    expect(w.startsReturning).toBe(0);
    expect(w.completionRate).toBeCloseTo(0.2);
    // and every start and solve by kind and language, practice included
    expect(w.startsBy).toEqual({ daily: 3, new: 2, shared: 1, practice: 5, '': 4 });
    expect(w.completedBy).toEqual({ daily: 2, practice: 4 });
    expect(w.startsByLang).toEqual({ nb: 3, en: 7, es: 1, '': 4 });
    expect(w.completedByLang).toEqual({ nb: 2, en: 4 });
    // home landings, apart and by word; landings per share counts the share pages only
    expect(w.landings).toBe(8);
    expect(w.landingsHome).toBe(5);
    expect(w.landingsDaily).toBe(1);
    expect(w.landingsFrom).toEqual({ search: 4, directory: 3, fediverse: 1 });
    expect(w.landingsFromHome).toEqual({ search: 4, directory: 1 });
    expect(w.landingsPerShare).toBeCloseTo(1.5);
    expect(m.yesterday.landingsHome).toBe(5);
    const html = renderAdmin(m);
    expect(html).toContain("<dt>Landings yesterday</dt><dd>7</dd><small>5 on a home page, 0 on a daily's address</small>");
    expect(html).toContain('<dt>Landings per share</dt><dd>1.50</dd><small>3 share-page landings over 2 shares of a link, 7 days</small>');
    expect(html).toContain('<dt>Starts, last 7 days</dt><dd>10</dd>');
    // the games by kind and language: columns in the lists' order, then the older builds' lines
    expect(html).toContain(
      '<thead><tr><th>Games</th><th>Daily</th><th>New</th><th>Practice</th><th>From a share link</th><th>Advent calendar</th><th>English</th><th>Norwegian</th><th>Spanish</th><th>Not recorded</th></tr></thead>'
    );
    expect(html).toContain('<tr><td>Begun</td><td>3</td><td>2</td><td>5</td><td>1</td><td>0</td><td>7</td><td>3</td><td>1</td><td>4</td></tr>');
    expect(html).toContain('<tr><td>Completed</td><td>2</td><td>0</td><td>4</td><td>0</td><td>0</td><td>4</td><td>2</td><td>0</td><td>0</td></tr>');
    // and per day
    expect(html).toContain('<thead><tr><th>Day</th><th>Daily</th><th>New</th>');
    expect(html).toContain('<tr><td>2026-10-11</td><td>0</td><td>0</td><td>5</td><td>0</td><td>0</td><td>5</td><td>0</td><td>0</td><td>4</td></tr>');
    expect(html).toContain('<tr><td>2026-10-12</td><td>3</td><td>2</td><td>0</td><td>1</td><td>0</td><td>2</td><td>3</td><td>1</td><td>0</td></tr>');
    // where landings came from: on a home page, on a share page, both
    expect(html).toContain("<tr><td>A search engine (and links Google's own redirect passed on)</td><td>4</td><td>0</td><td>4</td><td>50%</td></tr>");
    expect(html).toContain('<tr><td>An app directory (AlternativeTo, SaaSHub, Product Hunt and the like)</td><td>1</td><td>2</td><td>3</td><td>38%</td></tr>');
    expect(html).toContain('<tr><td>Lemmy or Mastodon</td><td>0</td><td>1</td><td>1</td><td>13%</td></tr>');
    // the every-day table's home column
    expect(html).toContain('<th>Landings</th><th>On a home page</th>');
    expect(html).toContain('<td>2026-10-12</td><td>6</td><td>2</td><td>0</td><td>2</td><td>2</td><td>7</td><td>5</td><td>1</td><td>0</td>');
  });

  it('is an unknown path without its four secrets, or without a valid Access token, wherever it is reached', async () => {
    const sql = api(() => json({ meta: [], data: ROWS, rows: ROWS.length }));
    const admin = { fetch: sql.fetch, now: NOW, accessKeys };
    /** the answer must be the one an unknown path gets, to the byte */
    const asUnknown = async (res: Response) => {
      const unknown = await handleRequest(new Request(`${SITE}/no-such-page`), assets(secrets));
      expect(res.status).toBe(404);
      expect(res.status).toBe(unknown.status);
      expect([...res.headers]).toEqual([...unknown.headers]);
      expect(await res.text()).toBe(await unknown.text());
    };
    const get = (headers: Record<string, string> = {}, base = SITE, method = 'GET') => new Request(`${base}${ADMIN_PATH}`, { method, headers });
    // a valid token, but a secret missing
    for (const missing of ['ADMIN_ACCOUNT_ID', 'ADMIN_TOKEN', 'ACCESS_TEAM_DOMAIN', 'ACCESS_AUD'] as const) {
      const env = assets({ ...secrets, [missing]: undefined });
      await asUnknown(await handleRequest(get(access), env, undefined, admin));
    }
    await asUnknown(await handleRequest(get(access), assets(), undefined, admin));
    // every secret set, and a token that is missing, made up, or not Access's for this application now
    const stranger = await signer(team.kid);
    const t = NOW().getTime() / 1000;
    const tokens = [
      '',
      'eyJ.header.payload',
      await stranger.sign(claimsAt(NOW())),
      await team.sign(claimsAt(NOW(), { aud: ['another-app'] })),
      await team.sign(claimsAt(NOW(), { iss: 'https://another-team.cloudflareaccess.com' })),
      await team.sign(claimsAt(NOW(), { exp: t - 1 }))
    ];
    await asUnknown(await handleRequest(get(), assets(secrets), undefined, admin));
    for (const token of tokens) {
      await asUnknown(await handleRequest(get({ [ACCESS_HEADER]: token }), assets(secrets), undefined, admin));
      // the same on an address Access does not stand in front of, and for a method the page refuses
      await asUnknown(await handleRequest(get({ [ACCESS_HEADER]: token }, 'https://sudokui.someone.workers.dev'), assets(secrets), undefined, admin));
      await asUnknown(await handleRequest(get({ [ACCESS_HEADER]: token }, SITE, 'POST'), assets(secrets), undefined, admin));
    }
    // the analytics were never asked
    expect(sql.calls).toHaveLength(0);
    expect(await handleAdmin(new Request(`${SITE}/admin/x`, { headers: access }), secrets, admin)).toBeNull();
    // and the valid token, with every secret, opens it
    const res = await handleRequest(get(access), assets(secrets), undefined, admin);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-answered-by')).toBeNull();
    expect(sql.calls).toHaveLength(1);
  });

  it('reads the dataset through the SQL API with the token, which never reaches the page', async () => {
    const { calls, fetch } = api(() => json({ meta: [], data: ROWS, rows: ROWS.length }));
    const res = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}/`, { headers: access }), secrets, { fetch, now: NOW, accessKeys }))!;
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
    // nor anything of the Access token: the owner's address, the token itself
    expect(html).not.toContain('owner@example.com');
    expect(html).not.toContain(access[ACCESS_HEADER].split('.')[2]);
    const head = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { method: 'HEAD', headers: access }), secrets, { fetch, now: NOW, accessKeys }))!;
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const wrong = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { method: 'POST', headers: access }), secrets, { fetch, now: NOW, accessKeys }))!;
    expect(wrong.status).toBe(405);
  });

  it('says what the API said when it fails, without the secrets', async () => {
    const refused = api(() => json({ errors: [{ message: 'Authentication error' }] }, 403));
    const res = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), secrets, { fetch: refused.fetch, now: NOW, accessKeys }))!;
    expect(res.status).toBe(502);
    const html = await res.text();
    expect(html).toContain('answered 403');
    expect(html).toContain('Authentication error');
    expect(html).not.toContain(secrets.ADMIN_TOKEN);
    const down = api(() => {
      throw new Error('fetch failed');
    });
    const gone = (await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), secrets, { fetch: down.fetch, now: NOW, accessKeys }))!;
    expect(gone.status).toBe(502);
    expect(await gone.text()).toContain('fetch failed');
    const html404 = api(() => new Response('<html>', { status: 200 }));
    expect((await handleAdmin(new Request(`${SITE}${ADMIN_PATH}`, { headers: access }), secrets, { fetch: html404.fetch, now: NOW, accessKeys }))!.status).toBe(502);
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

  it('names every landing word, the home pages, and the kind of game and language on a play line, in every language', () => {
    /** how each language's page says each word a landing can be (LANDING_FROM) */
    const WORDS: Record<'en' | 'nb' | 'es', Record<(typeof LANDING_FROM)[number], string>> = {
      en: {
        none: 'none (',
        search: 'a search engine',
        ai: 'an AI assistant',
        reddit: 'Reddit',
        enjoysudoku: 'the Enjoy Sudoku forum',
        hackernews: 'Hacker News',
        facebook: 'Facebook',
        discord: 'Discord',
        social: 'another social site or app',
        chat: 'a chat app or site',
        mail: 'a mail app or webmail',
        github: 'GitHub',
        sudoku: 'another sudoku site',
        directory: 'an app directory',
        fediverse: 'Lemmy or Mastodon',
        press: 'a news site',
        other: 'or another site or app'
      },
      nb: {
        none: 'ingen (',
        search: 'en søkemotor',
        ai: 'en KI-assistent',
        reddit: 'Reddit',
        enjoysudoku: 'Enjoy Sudoku-forumet',
        hackernews: 'Hacker News',
        facebook: 'Facebook',
        discord: 'Discord',
        social: 'et annet sosialt nettsted',
        chat: 'en chatapp',
        mail: 'en e-postapp',
        github: 'GitHub',
        sudoku: 'et annet sudokunettsted',
        directory: 'en appkatalog',
        fediverse: 'Lemmy eller Mastodon',
        press: 'et nyhetsnettsted',
        other: 'eller et annet nettsted eller en annen app'
      },
      es: {
        none: 'ninguna (',
        search: 'un buscador',
        ai: 'un asistente de IA',
        reddit: 'Reddit',
        enjoysudoku: 'el foro Enjoy Sudoku',
        hackernews: 'Hacker News',
        facebook: 'Facebook',
        discord: 'Discord',
        social: 'otra red social',
        chat: 'una app o web de chat',
        mail: 'una app de correo',
        github: 'GitHub',
        sudoku: 'otro sitio de sudoku',
        directory: 'un directorio de apps',
        fediverse: 'Lemmy o Mastodon',
        press: 'un sitio de noticias',
        other: 'u otro sitio u otra app'
      }
    };
    /** the two fields of a play line, and the home pages among the landings */
    const FIELDS = {
      en: ['a new puzzle, a practice puzzle, or one opened from a link someone shared', 'the language the app is set to', 'a daily puzzle’s link or the home page', 'or the home page, opened from outside'],
      nb: ['en ny oppgave, en øvingsoppgave eller en som ble åpnet fra en lenke noen delte', 'språket appen er satt til', 'en lenke til dagens sudoku eller forsiden, på et hvilket som helst av de tre språkene', 'en lenke til dagens sudoku eller forsiden som åpnes'],
      es: ['un sudoku nuevo, un sudoku de práctica o uno abierto desde un enlace que alguien compartió', 'el idioma en que está la app', 'el enlace de un sudoku del día o la página de inicio', 'el del sudoku del día o la página de inicio, abiertos']
    };
    for (const lang of HOME_LANGS) {
      const text = PRIVACY[lang].sections.flatMap((s) => s.paragraphs).join(' ');
      for (const word of LANDING_FROM) expect(text, `${lang} ${word}`).toContain(WORDS[lang][word]);
      for (const field of FIELDS[lang]) expect(text, lang).toContain(field);
    }
    // the one tag read from a link with no referrer, what it is read for, and that nothing else is read or kept
    const TAG = {
      en: ['When the browser reports nothing, the server reads one tag in the link itself, utm_source', 'utm_source=chatgpt.com', 'ChatGPT, Perplexity, Claude, Gemini or Copilot, the word is “an AI assistant”', 'Nothing else in the link is read for this word, and the tag is not kept'],
      nb: ['Når nettleseren ikke oppgir noe, leser tjeneren én merkelapp i selve lenken, utm_source', 'utm_source=chatgpt.com', 'ChatGPT, Perplexity, Claude, Gemini eller Copilot, blir ordet «en KI-assistent»', 'Ingenting annet i lenken leses for dette ordet, og merkelappen beholdes ikke'],
      es: ['Si el navegador no indica nada, el servidor lee una sola etiqueta del propio enlace, utm_source', 'utm_source=chatgpt.com', 'ChatGPT, Perplexity, Claude, Gemini o Copilot, la palabra es «un asistente de IA»', 'No se lee nada más del enlace para esta palabra, y la etiqueta no se guarda']
    };
    for (const lang of HOME_LANGS) {
      const text = PRIVACY[lang].sections.flatMap((s) => s.paragraphs).join(' ');
      for (const words of TAG[lang]) expect(text, lang).toContain(words);
    }
    // a practice puzzle is counted now, at the player's own first move
    expect(PRIVACY.en.sections[0].paragraphs[2]).toContain('A practice puzzle may open part-way through');
    expect(PRIVACY.en.sections[0].paragraphs[2]).not.toContain('practice puzzle sends nothing');
  });

  it('names a picture of the board among what is shared, saving it among the ways, and says the picture itself is never sent, in every language', () => {
    // the closed lists the line is checked against carry the picture and the saved file (worker/telemetry.ts)
    expect(SHARE_KINDS).toContain('image');
    expect(SHARE_VIAS).toContain('save');
    const WORDS = {
      en: ['one per share, while online', 'a link or a picture you share (below)', 'or a picture of the board: one kind, whether or not a hint is drawn on it, and the line does not say which', 'was copied or was saved', 'not the picture', 'The picture is made on your device and is never sent to sudokui.app', 'is remembered on your device for the next picture'],
      nb: ['én per deling, bare på nett', 'en lenke eller et bilde du deler (se under)', 'eller et bilde av brettet: én type, enten det er tegnet inn et hint eller ikke, og linjen sier ikke hvilken av delene', 'ble kopiert eller ble lagret', 'ikke bildet', 'Bildet lages på enheten din og sendes aldri til sudokui.app', 'huskes på enheten din til neste bilde'],
      es: ['una por enlace o imagen compartidos', 'un enlace o una imagen que compartes (más abajo)', 'o una imagen del tablero: un solo tipo, tenga o no una pista dibujada, y la línea no dice si la tiene', 'se copió o se guardó', 'ni la imagen', 'La imagen se crea en tu dispositivo y nunca se envía a sudokui.app', 'se recuerda en tu dispositivo para la próxima imagen']
    };
    // the section that says so names pictures in its heading
    const HEADINGS = {
      en: 'Share links and pictures, and visits from other sites',
      nb: 'Delingslenker og bilder, og besøk fra andre nettsteder',
      es: 'Enlaces e imágenes para compartir, y visitas desde otros sitios'
    };
    for (const lang of HOME_LANGS) {
      const c = PRIVACY[lang];
      const text = [c.description, ...c.sections.flatMap((s) => s.paragraphs)].join(' ');
      for (const words of WORDS[lang]) expect(text, lang).toContain(words);
      expect(c.sections.map((s) => s.heading), lang).toContain(HEADINGS[lang]);
    }
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

describe("the admin page's daily times sent", () => {
  const row = (day: string, event: string, kind: string, n: number) =>
    ({ day, event, source: '', kind, via: '', n, standalone: 0, offline: 0, optin: 0, optin_offline: 0, optin_returning: 0 });
  it('sets the daily solves the play lines counted against the times that reached the database, day by day', () => {
    const rows = [row('2026-10-12', 'completed', 'daily', 4), row('2026-10-12', 'completed', 'new', 9), row('2026-10-12', 'started', 'daily', 6)];
    const html = dailySentTable(rows, [{ day: Date.UTC(2026, 9, 12) / 1000, n: 2, unassisted: 1 }]);
    expect(html).toContain('<tr><td>2026-10-12</td><td>4</td><td>2</td><td>1</td><td>50%</td></tr>');
    // no database bound: no table at all; a database that fails: said so
    expect(dailySentTable(rows, undefined)).toBe('');
    expect(dailySentTable(rows, null)).toContain('could not be read');
  });
  it('asks the database for the last week, by the UTC day a time arrived', async () => {
    const calls: { sql: string; args: unknown[] }[] = [];
    const db = {
      prepare: (sql: string) => {
        const st = { bind: (...args: unknown[]) => (calls.push({ sql, args }), st), all: async () => ({ results: [{ day: 1, n: 3, unassisted: 2 }] }) };
        return st;
      },
      batch: async () => []
    };
    expect(await dailySent(db as never, new Date('2026-10-13T12:00:00Z'))).toEqual([{ day: 1, n: 3, unassisted: 2 }]);
    expect(calls[0].sql).toContain('FROM daily_result');
    expect(calls[0].args[0]).toBeLessThan(Date.UTC(2026, 9, 13) / 1000);
    expect(await dailySent(undefined, new Date())).toBeUndefined();
  });
});
