/**
 * The daily's API in the Worker (worker/daily.ts), over the store in
 * memory: the statistics of a day, a result checked and counted once, and
 * every way a result is refused. The D1 store's SQL is read for its
 * shape; the queries themselves run only against the real database.
 */
import { describe, it, expect } from 'vitest';
import dailies from '../src/content/dailies.json';
import { Daily, dailyNumber, dailyDate, minSeconds, bucketOf } from '../src/content/dailies';
import { handleDailyApi, memoryStore, checkResult, sha256Hex, d1Store, RATE_LIMIT, LATE_DAYS, EARLY_DAYS, BODY_MAX, D1Like, D1StatementLike } from '../worker/daily';
import { handleRequest, Env } from '../worker/index';
import template from '../index.html?raw';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';

const LIST = dailies as Daily[];
const DAILY = LIST[10];
const NO = dailyNumber(DAILY.date)!;
const SOLUTION = gridToString(solve(parseGrid(DAILY.puzzle)!)!);
/** the server's clock: noon UTC on the daily's own day */
const NOW = () => new Date(`${DAILY.date}T12:00:00Z`);
const TOKEN = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const SITE = 'https://sudokui.app';

const good = (over: Record<string, unknown> = {}) => ({
  token: TOKEN,
  grid: SOLUTION,
  seconds: 552,
  hints: 0,
  unassisted: true,
  source: 'tab',
  ...over
});

const post = (no: number, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${SITE}/api/daily/${no}/result`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
const get = (no: number) => new Request(`${SITE}/api/daily/${no}/stats`);

describe('the daily API', () => {
  it('answers nothing for other addresses', async () => {
    const store = memoryStore();
    for (const path of ['/api/daily/', '/api/daily/5', '/api/daily/5/other', '/p/x', '/api/daily/5/stats/'])
      expect(await handleDailyApi(new Request(SITE + path), store, { now: NOW }), path).toBeNull();
  });

  it('knows no day the list does not publish', async () => {
    const store = memoryStore();
    const res = await handleDailyApi(get(999999), store, { now: NOW });
    expect(res?.status).toBe(404);
  });

  it('gives a day’s statistics, empty at first, cacheable a minute', async () => {
    const store = memoryStore();
    const res = (await handleDailyApi(get(NO), store, { now: NOW }))!;
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    expect(await res.json()).toEqual({ no: NO, count: 0, median: null, histogram: [] });
    const head = (await handleDailyApi(new Request(get(NO).url, { method: 'HEAD' }), store, { now: NOW }))!;
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    const wrong = (await handleDailyApi(new Request(get(NO).url, { method: 'POST' }), store, { now: NOW }))!;
    expect(wrong.status).toBe(405);
  });

  it('counts a result once, however often the same token sends it', async () => {
    const store = memoryStore();
    const first = (await handleDailyApi(post(NO, good()), store, { now: NOW }))!;
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    const body = await first.json();
    expect(body.ok).toBe(true);
    expect(body.accepted).toBe(true);
    expect(body.stats).toEqual({ no: NO, count: 1, median: bucketOf(552) * 15 + 8, histogram: [[bucketOf(552), 1]] });

    const again = (await handleDailyApi(post(NO, good({ seconds: 600 })), store, { now: NOW }))!;
    const repeat = await again.json();
    expect(repeat.accepted).toBe(false);
    expect(repeat.stats.count).toBe(1);

    const other = (await handleDailyApi(post(NO, good({ token: 'another-token-of-sixteen-plus', seconds: 1200 })), store, { now: NOW }))!;
    const two = await other.json();
    expect(two.accepted).toBe(true);
    expect(two.stats.count).toBe(2);
    expect(two.stats.histogram).toEqual([
      [bucketOf(552), 1],
      [bucketOf(1200), 1]
    ]);
    expect(store.results).toHaveLength(2);
    expect(store.results[0]).toMatchObject({ no: NO, token: TOKEN, seconds: 552, unassisted: true, hints: 0, source: 'tab' });
    expect(store.results[0].createdAt).toBe(Math.floor(NOW().getTime() / 1000));
    // what the statistics read says the same
    expect(await (await handleDailyApi(get(NO), store, { now: NOW }))!.json()).toEqual(two.stats);
  });

  it('refuses what is not a solve of this day’s puzzle', async () => {
    const store = memoryStore();
    const refused = async (body: unknown, reason: RegExp, no = NO, now = NOW) => {
      const res = (await handleDailyApi(post(no, body), store, { now }))!;
      expect(res.status, JSON.stringify(body).slice(0, 80)).toBe(400);
      expect((await res.json()).error).toMatch(reason);
    };
    await refused('not json', /JSON/);
    await refused([], /JSON/);
    await refused(good({ token: 'short' }), /token/);
    await refused(good({ token: 'has spaces in it and is long enough' }), /token/);
    await refused(good({ grid: SOLUTION.slice(1) }), /grid/);
    await refused(good({ grid: SOLUTION.replace(/[1-9]/g, '0') }), /grid/);
    // a valid-looking grid that is not the solution
    const wrong = SOLUTION.slice(0, 80) + (SOLUTION[80] === '1' ? '2' : '1');
    await refused(good({ grid: wrong }), /not/);
    // the givens all in place, one other cell wrong: only the hash can tell
    const free = DAILY.puzzle.indexOf('.');
    const almost = SOLUTION.slice(0, free) + (SOLUTION[free] === '1' ? '2' : '1') + SOLUTION.slice(free + 1);
    await refused(good({ grid: almost }), /not the solution/);
    // a body too big to be a result is not even read
    const big = (await handleDailyApi(post(NO, { ...good(), padding: 'x'.repeat(BODY_MAX) }), store, { now: NOW }))!;
    expect(big.status).toBe(413);
    // another puzzle's solution
    const otherSolution = gridToString(solve(parseGrid(LIST[11].puzzle)!)!);
    await refused(good({ grid: otherSolution }), /not this puzzle|not the solution/);
    await refused(good({ seconds: 0 }), /seconds/);
    await refused(good({ seconds: 12.5 }), /seconds/);
    await refused(good({ seconds: 24 * 3600 + 1 }), /seconds/);
    await refused(good({ seconds: minSeconds(DAILY.puzzle) - 1 }), /too fast/);
    await refused(good({ hints: -1 }), /hints/);
    await refused(good({ hints: 2, unassisted: true }), /unassisted/);
    await refused(good({ unassisted: 'yes' }), /unassisted/);
    // an assisted solve has no time worth comparing, with hints or without
    await refused(good({ unassisted: false }), /only unassisted/);
    await refused(good({ unassisted: false, hints: 2 }), /only unassisted/);
    await refused(good({ source: 'bot' }), /source/);
    // the day must be recent: a week back at most, a day ahead at most
    await refused(good(), /too long ago/, NO, () => new Date(`${dailyDate(NO + LATE_DAYS + 1)}T12:00:00Z`));
    await refused(good(), /not come/, NO, () => new Date(`${dailyDate(NO - EARLY_DAYS - 1)}T12:00:00Z`));
    expect(store.results).toHaveLength(0);
    // and at the edges of the window it is taken
    for (const day of [dailyDate(NO + LATE_DAYS), dailyDate(NO - EARLY_DAYS)]) {
      const res = (await handleDailyApi(post(NO, good({ token: `token-for-${day}-${'x'.repeat(8)}` })), store, { now: () => new Date(`${day}T12:00:00Z`) }))!;
      expect(res.status, day).toBe(200);
    }
    // the slowest honest time is taken
    const floor = (await handleDailyApi(post(NO, good({ token: 'token-at-the-floor-xxxxxx', seconds: minSeconds(DAILY.puzzle) })), store, { now: NOW }))!;
    expect(floor.status).toBe(200);
  });

  it('leaves an assisted time already kept out of the statistics', async () => {
    const store = memoryStore();
    // a run through Steps, sent before the server refused assisted solves
    store.results.push({ no: NO, token: 'assisted-token-from-before', seconds: 590, unassisted: false, hints: 0, source: 'tab', createdAt: 1 });
    expect(await (await handleDailyApi(get(NO), store, { now: NOW }))!.json()).toEqual({ no: NO, count: 0, median: null, histogram: [] });
    const body = await (await handleDailyApi(post(NO, good()), store, { now: NOW }))!.json();
    expect(body.stats).toEqual({ no: NO, count: 1, median: bucketOf(552) * 15 + 8, histogram: [[bucketOf(552), 1]] });
  });

  it('checks the solution by its published hash', async () => {
    expect(await sha256Hex(SOLUTION)).toBe(DAILY.solutionHash);
    const ok = await checkResult(good(), NO, DAILY, NOW());
    expect(ok.ok).toBe(true);
    const bad = await checkResult(good({ grid: SOLUTION.split('').reverse().join('') }), NO, DAILY, NOW());
    expect(bad.ok).toBe(false);
  });

  it('answers 503 without a store, and the app treats that as unavailable', async () => {
    const stats = (await handleDailyApi(get(NO), null, { now: NOW }))!;
    expect(stats.status).toBe(503);
    expect(stats.headers.get('retry-after')).toBe('600');
    const result = (await handleDailyApi(post(NO, good()), null, { now: NOW }))!;
    expect(result.status).toBe(503);
    // a store that fails (D1 over its cap, a table missing) is the same to the player
    const broken = { histogram: async () => { throw new Error('no such table'); }, record: async () => { throw new Error('D1_ERROR'); } };
    expect((await handleDailyApi(get(NO), broken, { now: NOW }))!.status).toBe(503);
    expect((await handleDailyApi(post(NO, good()), broken, { now: NOW }))!.status).toBe(503);
  });

  it('limits one address to so many results a window, in memory', async () => {
    const store = memoryStore();
    const ip = { 'cf-connecting-ip': '203.0.113.7' };
    let last = 0;
    for (let i = 0; i < RATE_LIMIT.count + 1; i++) {
      const res = (await handleDailyApi(post(NO, good({ token: `rate-limit-token-${String(i).padStart(4, '0')}` }), ip), store, { now: NOW }))!;
      last = res.status;
    }
    expect(last).toBe(429);
    expect(store.results).toHaveLength(RATE_LIMIT.count);
    // another address is unaffected
    const other = (await handleDailyApi(post(NO, good({ token: 'another-address-token-xxxxx' }), { 'cf-connecting-ip': '203.0.113.8' }), store, { now: NOW }))!;
    expect(other.status).toBe(200);
  });

  it('uses the edge cache for the statistics when the runtime has one', async () => {
    const store = memoryStore();
    const kept = new Map<string, Response>();
    const cache = {
      match: async (key: string) => kept.get(key)?.clone(),
      put: async (key: string, res: Response) => void kept.set(key, res)
    } as unknown as Cache;
    const first = (await handleDailyApi(get(NO), store, { now: NOW, cache }))!;
    expect(first.status).toBe(200);
    await handleDailyApi(post(NO, good()), store, { now: NOW, cache });
    // a minute's answer is the one before the result arrived, whatever query string a caller adds
    const second = (await handleDailyApi(get(NO), store, { now: NOW, cache }))!;
    expect((await second.json()).count).toBe(0);
    const busted = (await handleDailyApi(new Request(get(NO).url + '?x=' + Math.random()), store, { now: NOW, cache }))!;
    expect((await busted.json()).count).toBe(0);
    expect(kept.size).toBe(1);
  });
});

describe('the D1 store', () => {
  it('runs two statements per result in one batch, and reads the histogram by its key', async () => {
    const calls: { sql: string; values: unknown[] }[] = [];
    const statement = (sql: string): D1StatementLike => {
      const s: D1StatementLike & { values: unknown[] } = {
        values: [],
        bind(...values) {
          s.values = values;
          calls.push({ sql, values });
          return s;
        },
        all: async <T,>() => ({ results: [{ bucket: 36, n: 2, n_unassisted: 1 } as unknown as T], meta: { rows_read: 1 } })
      };
      return s;
    };
    const db: D1Like = {
      prepare: statement,
      batch: async (stmts) => stmts.map((_, i) => ({ meta: { changes: i === 1 ? 1 : 0 } }))
    };
    const store = d1Store(db);
    expect(await store.histogram(NO)).toEqual([{ bucket: 36, n: 2, n_unassisted: 1 }]);
    expect(calls[0].sql).toMatch(/^SELECT bucket, n, n_unassisted FROM daily_hist WHERE puzzle_no = \?1$/);
    expect(calls[0].values).toEqual([NO]);
    const accepted = await store.record({ no: NO, token: TOKEN, seconds: 552, unassisted: true, hints: 0, source: 'pwa', createdAt: 1 });
    expect(accepted).toBe(true);
    expect(calls[1].sql).toMatch(/INSERT INTO daily_hist .* WHERE NOT EXISTS \(SELECT 1 FROM daily_result WHERE puzzle_no = \?1 AND token = \?4\) ON CONFLICT \(puzzle_no, bucket\) DO UPDATE SET n = n \+ 1/);
    expect(calls[1].values).toEqual([NO, bucketOf(552), 1, TOKEN]);
    expect(calls[2].sql).toMatch(/^INSERT OR IGNORE INTO daily_result/);
    expect(calls[2].values).toEqual([NO, TOKEN, 552, 1, 0, 'pwa', 1]);
  });
});

describe('the Worker as a whole', () => {
  const env = (db?: D1Like): Env => ({
    ASSETS: {
      fetch: async (request: Request) => {
        const u = new URL(request.url);
        if (u.pathname === '/share.tpl') return new Response(template, { status: 200 });
        return new Response('not found', { status: 404, headers: { 'x-answered-by': 'assets' } });
      }
    },
    DB: db
  });

  it('answers the API before the assets, and 503 while the database is not there', async () => {
    const res = await handleRequest(get(NO), env());
    expect(res.status).toBe(503);
    expect(res.headers.get('x-answered-by')).toBeNull();
    const api404 = await handleRequest(new Request(`${SITE}/api/daily/999999/stats`), env());
    expect(api404.status).toBe(404);
    expect(api404.headers.get('content-type')).toContain('json');
  });

  it('renders the daily’s share page, and hands an unpublished day to the assets', async () => {
    const res = await handleRequest(new Request(`${SITE}/nb/daily/${DAILY.date}?vs=552`), env());
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<html lang="nb">');
    expect(html).toContain(`Dagens sudoku #${NO}, ${DAILY.date}`);
    expect(html).toContain(`<meta property="og:url" content="${SITE}/nb/daily/${DAILY.date}?vs=552" />`);
    expect(html).toContain('Løst på 9:12. Klarer du å slå det?');
    const missing = await handleRequest(new Request(`${SITE}/daily/2020-01-01`), env());
    expect(missing.status).toBe(404);
    expect(missing.headers.get('x-answered-by')).toBe('assets');
  });
});
