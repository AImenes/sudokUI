// The live-site check (scripts/liveCheck.ts, .github/workflows/live-check.yml):
// the pages it asks for on a day, what it finds wrong with a page, how it
// waits for a push's deploy, and above all that its requests are never
// counted as landings: run against the Worker itself (worker/index.ts),
// with the pages as the build makes them, it writes no point, where the
// same requests from a person's browser write one each.
import { describe, expect, it } from 'vitest';
import template from '../index.html?raw';
import { LIVE_CHECK_AGENT, livePages, checkPage, runLiveCheck, waitForDeploy, metaContent } from '../scripts/liveCheck';
import { handleRequest, SHARE_TEMPLATE, HOME_PATHS, CALENDAR_PATHS } from '../worker/index';
import type { Env } from '../worker/index';
import { isPersonAgent, isLanding, memoryEvents } from '../worker/telemetry';
import { renderHome, homeLangOfPath, SITE } from '../src/content/home';
import { buildLearnPages } from '../src/content/learnPages';
import { ogDoorPicture } from '../src/content/share';

const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** the calendar's public pages as the build writes them */
const calendarPages = new Map(buildLearnPages().filter((p) => CALENDAR_PATHS.includes(p.url)).map((p) => [p.url, p.html]));

/** the static assets as the Worker sees them in production: the home pages, the calendar's pages, share.tpl and the pictures */
function assets(extra: Partial<Env> = {}): Env {
  return {
    ASSETS: {
      fetch: async (request: Request) => {
        const path = new URL(request.url).pathname;
        if (path === SHARE_TEMPLATE) return new Response(template, { status: 200 });
        if (HOME_PATHS.includes(path)) return new Response(renderHome(template, homeLangOfPath(path) ?? 'en'), { status: 200, headers: { 'content-type': 'text/html' } });
        const calendar = calendarPages.get(path);
        if (calendar) return new Response(calendar, { status: 200, headers: { 'content-type': 'text/html' } });
        if (path.endsWith('.png')) return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
        return new Response('not found', { status: 404 });
      }
    },
    ...extra
  };
}

/** a fetch that hands each request to the Worker on a day's morning (UTC), and keeps what was asked */
function throughWorker(env: Env, today: string, agent?: string) {
  const asked: { method: string; agent: string | null; navigate: boolean; url: string }[] = [];
  const fetch = async (url: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    // as a browser would send it, when the test plays one: a navigation
    if (agent) {
      headers.set('user-agent', agent);
      headers.set('sec-fetch-mode', 'navigate');
      headers.set('sec-fetch-dest', 'document');
    }
    const request = new Request(url, { ...init, headers });
    asked.push({ method: request.method, agent: request.headers.get('user-agent'), navigate: request.headers.get('sec-fetch-mode') === 'navigate', url });
    return handleRequest(request, env, undefined, undefined, () => Date.parse(`${today}T06:17:00Z`));
  };
  return { fetch, asked };
}

describe('the live-site check', () => {
  it('sends a User-Agent the Worker counts as no person', () => {
    expect(isPersonAgent(LIVE_CHECK_AGENT)).toBe(false);
    expect(LIVE_CHECK_AGENT.startsWith('Mozilla/')).toBe(false);
    // even as a navigation to a home page, the one thing a landing needs besides a browser
    const request = new Request(`${SITE}/`, { headers: { 'user-agent': LIVE_CHECK_AGENT, 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } });
    expect(isLanding(request)).toBe(false);
  });

  it('asks the Worker for every page and picture with GET only, and no landing is written', async () => {
    for (const today of ['2026-11-26', '2026-12-05']) {
      const events = memoryEvents();
      const env = assets({ EVENTS: events });
      const { fetch, asked } = throughWorker(env, today);
      const problems = await runLiveCheck({ fetch, today, base: SITE });
      expect(problems, today).toEqual([]);
      expect(asked.length).toBeGreaterThan(livePages(today).length);
      expect(asked.every((a) => a.method === 'GET' && a.agent === LIVE_CHECK_AGENT)).toBe(true);
      // the pages asked for as a click asks: a navigation, which a landing needs besides a browser's User-Agent
      expect(asked.filter((a) => a.navigate).length).toBe(livePages(today).length);
      expect(asked.some((a) => new URL(a.url).pathname.startsWith('/api/'))).toBe(false);
      expect(events.points, today).toEqual([]);
    }
  });

  it('would have counted the same pages from a person’s browser: the Worker under test counts landings', async () => {
    const events = memoryEvents();
    const { fetch } = throughWorker(assets({ EVENTS: events }), '2026-12-05', BROWSER);
    await runLiveCheck({ fetch, today: '2026-12-05', base: SITE });
    // the three homes, the three calendar pages, the daily, the /p/ link and three doors
    expect(events.points.filter((p) => p.indexes[0] === 'landing')).toHaveLength(11);
  });

  it('asks for the homes, the calendar pages, today’s daily and a /p/ link, and from 1 to 24 December today’s door in three languages', () => {
    const paths = (today: string) => livePages(today).map((p) => p.path);
    const common = ['/', '/nb/', '/es/', '/advent/', '/nb/julekalender/', '/es/calendario-de-adviento/'];
    expect(paths('2026-11-26').slice(0, 7)).toEqual([...common, '/daily/2026-11-26']);
    expect(paths('2026-11-26')[7]).toMatch(/^\/p\/[1-9.]{81}\?b=\w+&s=\d+$/);
    expect(paths('2026-11-26')).toHaveLength(8);
    expect(paths('2026-12-05').slice(8)).toEqual(['/advent/2026/5', '/nb/advent/2026/5', '/es/advent/2026/5']);
    expect(paths('2026-12-24').slice(8)).toEqual(['/advent/2026/24', '/nb/advent/2026/24', '/es/advent/2026/24']);
    expect(paths('2026-12-25')).toHaveLength(8);
    // a door carries its own picture; the homes and the calendar's page are not noindex, a share page is
    const dec5 = livePages('2026-12-05');
    expect(dec5.slice(8).every((p) => p.ogImage === ogDoorPicture(5) && p.noindex)).toBe(true);
    expect(dec5.slice(0, 6).every((p) => !p.noindex)).toBe(true);
    expect(dec5.slice(6).every((p) => p.noindex)).toBe(true);
    expect(dec5.slice(0, 3).map((p) => p.ogImage)).toEqual([`${SITE}/og-card.png`, `${SITE}/og-card.nb.png`, `${SITE}/og-card.es.png`]);
  });

  it('finds a page that answers wrongly: not 200, a redirect, another og:image, noindex missing or where it should not be', async () => {
    const page = { name: 'home (en)', path: '/', ogImage: `${SITE}/og-card.png`, noindex: false };
    const html = (image: string, robots = '') => `<html><head>${robots}<meta property="og:image" content="${image}" /></head></html>`;
    const answer = (body: string, init: ResponseInit = {}) => async () => new Response(body, { status: 200, ...init });
    expect(await checkPage(answer(html(`${SITE}/og-card.png`)), SITE, page)).toEqual([]);
    expect(await checkPage(answer('gone', { status: 404 }), SITE, page)).toEqual(['home (en), /: answered 404, not 200']);
    expect(await checkPage(answer('', { status: 301, headers: { location: '/x' } }), SITE, page)).toEqual(['home (en), /: answered 301, not 200']);
    expect(await checkPage(answer(html(`${SITE}/og/hard.png`)), SITE, page)).toEqual([`home (en), /: og:image is "${SITE}/og/hard.png", not "${SITE}/og-card.png"`]);
    expect(await checkPage(answer('<html></html>'), SITE, page)).toEqual([`home (en), /: og:image is missing, not "${SITE}/og-card.png"`]);
    expect(await checkPage(answer(html(`${SITE}/og-card.png`, '<meta name="robots" content="noindex" />')), SITE, page)).toEqual(['home (en), /: says noindex, and should not']);
    const share = { ...page, noindex: true };
    expect(await checkPage(answer(html(`${SITE}/og-card.png`)), SITE, share)).toEqual(['home (en), /: does not say noindex']);
    // the header alone is enough
    expect(await checkPage(answer(html(`${SITE}/og-card.png`), { headers: { 'x-robots-tag': 'noindex' } }), SITE, share)).toEqual([]);
    expect(await checkPage(async () => Promise.reject(new Error('timed out')), SITE, page)).toEqual(['home (en), /: no answer (timed out)']);
  });

  it('reads a meta tag by property or name, whatever the order of its attributes', () => {
    expect(metaContent('<meta content="a&amp;b" property="og:image">', 'og:image')).toBe('a&b');
    expect(metaContent('<meta name="robots" content="noindex" />', 'robots')).toBe('noindex');
    expect(metaContent('<meta property="og:image:alt" content="x" />', 'og:image')).toBeNull();
  });

  it('after a push, waits for its deploy, takes a later one, and gives up after the time allowed', async () => {
    const list = (commit: string) => JSON.stringify({ commit, pages: { [`${SITE}/`]: 'h' } });
    const run = async (served: string[], waitMs = 60_000) => {
      let clock = 0;
      let i = 0;
      const agents: (string | null)[] = [];
      const fetch = async (_url: string, init: RequestInit) => {
        agents.push(new Headers(init.headers).get('user-agent'));
        return new Response(list(served[Math.min(i++, served.length - 1)]), { status: 200 });
      };
      const ok = await waitForDeploy({ fetch, commit: 'bbbbbbbbbb', sleep: async (ms) => void (clock += ms), now: () => clock, waitMs, pollMs: 10_000 });
      return { ok, asked: i, agents };
    };
    expect(await run(['aaaaaaa', 'aaaaaaa', 'bbbbbbbbbb'])).toMatchObject({ ok: true, asked: 3 });
    expect(await run(['aaaaaaa', 'ccccccc'])).toMatchObject({ ok: true, asked: 2 });
    const never = await run(['aaaaaaa']);
    expect(never.ok).toBe(false);
    expect(never.asked).toBe(7);
    expect(never.agents.every((a) => a === LIVE_CHECK_AGENT)).toBe(true);
  });
});
