/**
 * The shared daily's global statistics (docs/online-goals.md, phase 2):
 * two JSON routes in the Worker, both keyed by the daily's number
 * (src/content/dailies.ts).
 *
 *   GET  /api/daily/<n>/stats    how many have played, the median, the
 *                                histogram; cached a minute at the edge
 *   POST /api/daily/<n>/result   one player's time, checked and counted
 *
 * D1 holds results only. A result is accepted when the grid is the day's
 * solution (its SHA-256 is published with the puzzle), the time is at
 * least the floor for the puzzle's empty cells, an unassisted result used
 * no hints, the day is recent, and the token (a random value the client
 * keeps for the day) has not submitted before. Two writes per accepted
 * result, as one batch: the histogram bucket, then the result row, each
 * on its primary key. Everything read is one bounded histogram. Nothing
 * identifies the player: no IP, no cookie, no account; the rate limit per
 * address lives in this isolate's memory only.
 *
 * The store is an interface: D1 in production (d1Store), memory for the
 * tests and for the dev and preview servers (memoryStore), so the whole
 * flow runs without a database at hand.
 */
import dailies from '../src/content/dailies.json';
import {
  Daily,
  DailyStats,
  HistogramRow,
  EARLY_DAYS,
  LATE_DAYS,
  bucketOf,
  dailyDate,
  dailyNumber,
  findDaily,
  minSeconds,
  statsFromHistogram
} from '../src/content/dailies';

export { EARLY_DAYS, LATE_DAYS };

// ---- the store ----------------------------------------------------------------

/** what the Worker asks of the database */
export interface DailyStore {
  /** the day's histogram rows, any order */
  histogram(no: number): Promise<HistogramRow[]>;
  /** counts a result; false when this token had already submitted for the day */
  record(result: StoredResult): Promise<boolean>;
}

export interface StoredResult {
  no: number;
  token: string;
  seconds: number;
  unassisted: boolean;
  hints: number;
  source: 'pwa' | 'tab' | null;
  /** seconds since the epoch */
  createdAt: number;
}

/** the slice of Cloudflare's D1 binding this module uses */
export interface D1Like {
  prepare(sql: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<D1ResultLike[]>;
}
export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  all<T = unknown>(): Promise<D1ResultLike<T>>;
}
export interface D1ResultLike<T = unknown> {
  results?: T[];
  meta?: { changes?: number; rows_read?: number; rows_written?: number };
}

/** the production store: two tables in D1 (migrations/0001_daily.sql) */
export function d1Store(db: D1Like): DailyStore {
  return {
    async histogram(no) {
      const out = await db.prepare('SELECT bucket, n, n_unassisted FROM daily_hist WHERE puzzle_no = ?1').bind(no).all<HistogramRow>();
      return out.results ?? [];
    },
    async record(r) {
      const bucket = bucketOf(r.seconds);
      // the histogram first, only when this token is new to the day; then
      // the result row, ignored when it is not. One batch, so the two
      // never disagree, and both on their primary keys.
      const [, inserted] = await db.batch([
        db
          .prepare(
            'INSERT INTO daily_hist (puzzle_no, bucket, n, n_unassisted) ' +
              'SELECT ?1, ?2, 1, ?3 WHERE NOT EXISTS (SELECT 1 FROM daily_result WHERE puzzle_no = ?1 AND token = ?4) ' +
              'ON CONFLICT (puzzle_no, bucket) DO UPDATE SET n = n + 1, n_unassisted = n_unassisted + excluded.n_unassisted'
          )
          .bind(r.no, bucket, r.unassisted ? 1 : 0, r.token),
        db
          .prepare(
            'INSERT OR IGNORE INTO daily_result (puzzle_no, token, seconds, unassisted, hints, source, created_at) ' +
              'VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)'
          )
          .bind(r.no, r.token, r.seconds, r.unassisted ? 1 : 0, r.hints, r.source, r.createdAt)
      ]);
      return (inserted.meta?.changes ?? 0) > 0;
    }
  };
}

/** a store in memory: the tests, and the dev and preview servers */
export function memoryStore(): DailyStore & { results: StoredResult[] } {
  const results: StoredResult[] = [];
  return {
    results,
    async histogram(no) {
      const rows = new Map<number, HistogramRow>();
      for (const r of results) {
        if (r.no !== no) continue;
        const bucket = bucketOf(r.seconds);
        const row = rows.get(bucket) ?? { bucket, n: 0, n_unassisted: 0 };
        row.n++;
        if (r.unassisted) row.n_unassisted++;
        rows.set(bucket, row);
      }
      return [...rows.values()];
    },
    async record(r) {
      if (results.some((x) => x.no === r.no && x.token === r.token)) return false;
      results.push(r);
      return true;
    }
  };
}

// ---- the checks ---------------------------------------------------------------

/** a submitted result, as the client sends it */
export interface ResultBody {
  token: string;
  /** the finished grid, 81 digits */
  grid: string;
  seconds: number;
  hints: number;
  unassisted: boolean;
  source?: 'pwa' | 'tab';
}

/** the most a result may weigh on the wire: a grid, a token and four numbers */
export const BODY_MAX = 4096;

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const GRID = /^[1-9]{81}$/;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export type Check = { ok: true; result: StoredResult } | { ok: false; reason: string };

/**
 * Why a result is refused, or the result as it will be stored. `now` is
 * the server's clock; the day is judged against the UTC date, with a day
 * of grace ahead and a week behind.
 */
export async function checkResult(body: unknown, no: number, daily: Daily, now: Date): Promise<Check> {
  const refuse = (reason: string): Check => ({ ok: false, reason });
  if (!body || typeof body !== 'object' || Array.isArray(body)) return refuse('a JSON object is expected');
  const b = body as Record<string, unknown>;
  if (typeof b.token !== 'string' || !TOKEN.test(b.token)) return refuse('token');
  if (typeof b.grid !== 'string' || !GRID.test(b.grid)) return refuse('grid: 81 digits expected');
  if (typeof b.seconds !== 'number' || !Number.isInteger(b.seconds) || b.seconds < 1 || b.seconds > 24 * 3600) return refuse('seconds');
  if (typeof b.hints !== 'number' || !Number.isInteger(b.hints) || b.hints < 0 || b.hints > 1000) return refuse('hints');
  if (typeof b.unassisted !== 'boolean') return refuse('unassisted');
  if (b.source !== undefined && b.source !== 'pwa' && b.source !== 'tab') return refuse('source');
  if (b.unassisted && b.hints > 0) return refuse('an unassisted solve used no hints');

  const todayNo = dailyNumber(now.toISOString().slice(0, 10)) ?? 0;
  if (no > todayNo + EARLY_DAYS) return refuse('that day has not come');
  if (no < todayNo - LATE_DAYS) return refuse('that day is too long ago');

  // the grid must be this puzzle's: its givens in place, and the whole
  // thing the published solution
  for (let i = 0; i < 81; i++) {
    const given = daily.puzzle[i];
    if (given !== '.' && given !== '0' && given !== b.grid[i]) return refuse('the grid is not this puzzle');
  }
  if ((await sha256Hex(b.grid)) !== daily.solutionHash) return refuse('the grid is not the solution');
  if (b.seconds < minSeconds(daily.puzzle)) return refuse('too fast to be a solve');

  return {
    ok: true,
    result: {
      no,
      token: b.token,
      seconds: b.seconds,
      unassisted: b.unassisted,
      hints: b.hints,
      source: (b.source as 'pwa' | 'tab' | undefined) ?? null,
      createdAt: Math.floor(now.getTime() / 1000)
    }
  };
}

// ---- the rate limit -------------------------------------------------------------

/** submissions allowed per address per window, in this isolate's memory */
export const RATE_LIMIT = { count: 20, windowMs: 10 * 60 * 1000 };
const seen = new Map<string, { count: number; until: number }>();

/** true when this address has sent too many results lately; nothing is stored beyond the window */
export function rateLimited(address: string | null, now: number): boolean {
  if (!address) return false;
  if (seen.size > 10_000) seen.clear();
  const entry = seen.get(address);
  if (!entry || entry.until <= now) {
    seen.set(address, { count: 1, until: now + RATE_LIMIT.windowMs });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT.count;
}

// ---- the routes -----------------------------------------------------------------

export const API_PATH = /^\/api\/daily\/(\d{1,6})\/(stats|result)$/;

/** how long a stats answer may be reused, at the edge and in the browser */
const STATS_MAX_AGE = 60;

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });

export interface DailyApiOptions {
  /** the clock, for tests */
  now?: () => Date;
  /** the edge cache (caches.default in a Worker); none on the dev server */
  cache?: Cache | null;
  waitUntil?: (p: Promise<unknown>) => void;
  /** the published dailies, the real list unless a test says otherwise */
  dailies?: Daily[];
}

/**
 * Answers a daily API request, or returns null when the address is not
 * one. Without a store (no D1 binding, or its tables not yet there) the
 * routes answer 503 and the app shows "unavailable"; play is unaffected.
 */
export async function handleDailyApi(request: Request, store: DailyStore | null, options: DailyApiOptions = {}): Promise<Response | null> {
  const url = new URL(request.url);
  const m = API_PATH.exec(url.pathname);
  if (!m) return null;
  const no = Number(m[1]);
  const route = m[2];
  const now = options.now ? options.now() : new Date();
  const list = options.dailies ?? (dailies as Daily[]);
  const daily = findDaily(list, dailyDate(no));
  if (!daily) return json({ error: 'no such daily' }, 404);

  if (route === 'stats') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({ error: 'method' }, 405, { allow: 'GET, HEAD' });
    // one cache entry per day, whatever query string a caller adds
    const cacheKey = url.origin + url.pathname;
    if (options.cache) {
      const hit = await options.cache.match(cacheKey).catch(() => undefined);
      if (hit) return hit;
    }
    if (!store) return json({ error: 'unavailable' }, 503, { 'retry-after': '600' });
    let stats: DailyStats;
    try {
      stats = statsFromHistogram(no, await store.histogram(no));
    } catch {
      return json({ error: 'unavailable' }, 503, { 'retry-after': '600' });
    }
    const response = json(stats, 200, { 'cache-control': `public, max-age=${STATS_MAX_AGE}` });
    if (options.cache) {
      const put = options.cache.put(cacheKey, response.clone()).catch(() => {});
      if (options.waitUntil) options.waitUntil(put);
      else await put;
    }
    return request.method === 'HEAD' ? new Response(null, { status: 200, headers: response.headers }) : response;
  }

  // the result
  if (request.method !== 'POST') return json({ error: 'method' }, 405, { allow: 'POST' });
  if (rateLimited(request.headers.get('cf-connecting-ip'), now.getTime())) return json({ error: 'too many' }, 429, { 'retry-after': '600' });
  // a result is a few hundred bytes; nothing bigger is read at all
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > BODY_MAX) return json({ error: 'too large' }, 413);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return json({ error: 'too large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'a JSON object is expected' }, 400);
  }
  const check = await checkResult(body, no, daily, now);
  if (!check.ok) return json({ error: check.reason }, 400);
  if (!store) return json({ error: 'unavailable' }, 503, { 'retry-after': '600' });
  try {
    const accepted = await store.record(check.result);
    const stats = statsFromHistogram(no, await store.histogram(no));
    return json({ ok: true, accepted, stats });
  } catch {
    return json({ error: 'unavailable' }, 503, { 'retry-after': '600' });
  }
}
