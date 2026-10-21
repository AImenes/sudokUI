/**
 * Counting plays (docs/online-goals.md, phase 3): the route the app sends
 * its events to, and the landing count of the share pages, both written
 * to Workers Analytics Engine (WAE), never to D1.
 *
 *   POST /api/t   a JSON list of events, up to BATCH_MAX of them, each
 *                 checked against the closed list below; answered 204
 *                 with no body, or 400 with nothing written
 *
 * One data point per distinct event in a batch: the index is the event's
 * name, the blobs are the band, the source, the app's version and the
 * country the connection came from (request.cf, never the address), and
 * the doubles are the time bucket, how many events the point stands for
 * and the three flags. Identical events fold into one point with a count,
 * because WAE takes at most POINTS_MAX writes per invocation: the app
 * never sends more than that many events at once (src/state/telemetry.ts),
 * and a batch from anywhere else is kept to its first POINTS_MAX points.
 *
 * Nothing here identifies a player. No IP is written: the rate limit per
 * address lives in this isolate's memory, as the daily's does. No token,
 * no cookie, no header beyond the country and the user agent is read, and
 * the user agent only to tell a person's browser from a crawler, a
 * headless browser or an audit tool, whose lines are not written.
 *
 * The share route counts a `landing` point of its own (countLanding) when
 * a browser arrives at /p/<puzzle> or /daily/<date> from outside the site:
 * no referrer from the site itself, a navigation (the Sec-Fetch headers,
 * where the browser sends them), and not a crawler or a chat app's preview
 * fetcher. That is the research's "share-link landings" number.
 *
 * The dataset is an interface, so the tests and the dev and preview
 * servers run the whole thing over memory (memoryEvents).
 */
import { LEVELS, Level } from '../src/engine/ratings';
import { BUCKET_MAX } from '../src/content/dailies';
import { makeRateLimiter } from './daily';
import { version as WORKER_VERSION } from '../package.json';

export const API_PATH = '/api/t';

/** the events a point can stand for; `landing` is the Worker's own, the app never sends it */
export const EVENT_NAMES = ['started', 'completed', 'landing'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** where an event came from: the installed app or a browser tab (dailyStats.ts, playedFrom) */
export const SOURCES = ['pwa', 'tab'] as const;
export type Source = (typeof SOURCES)[number];

/** the most events one request may carry */
export const BATCH_MAX = 250;
/** the most points one invocation may write: WAE's limit on writeDataPoint */
export const POINTS_MAX = 25;
/** the most a batch may weigh on the wire: 250 events of about a hundred bytes */
export const BODY_MAX = 32 * 1024;
/** a version as package.json writes it, 1.0.0, or a build tag; never long, never free text */
export const VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,31}$/;
/** requests allowed per address per window: a start and a solve per game, with room for a household */
export const RATE_LIMIT = { count: 60, windowMs: 10 * 60 * 1000 };

/** one event, as the app sends it and as it is checked */
export interface TelemetryEvent {
  event: EventName;
  band: Level;
  /** the time in 15-second buckets, capped as the daily's are (dailies.ts); 0 for a start */
  bucket: number;
  /** display-mode: standalone matched */
  standalone: boolean;
  version: string;
  source: Source;
  /** kept while offline and sent later; only an opted-in device does that */
  offline: boolean;
  /** the device's "count my plays" setting is on */
  optin: boolean;
  /** the device had played on an earlier day; only an opted-in device knows */
  returning: boolean;
}

/** what goes to WAE: one index, four blobs, six doubles (see the header) */
export interface DataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

/** the slice of Cloudflare's Analytics Engine binding this module uses */
export interface AnalyticsEngineLike {
  writeDataPoint(point: DataPoint): void;
}

// ---- the checks ---------------------------------------------------------------

const LEVEL_SET = new Set<string>(LEVELS);

/** the event a value is, or null when anything about it is off the closed list */
export function checkEvent(x: unknown): TelemetryEvent | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const e = x as Record<string, unknown>;
  if (typeof e.event !== 'string' || !(EVENT_NAMES as readonly string[]).includes(e.event)) return null;
  if (typeof e.band !== 'string' || !LEVEL_SET.has(e.band)) return null;
  if (typeof e.bucket !== 'number' || !Number.isInteger(e.bucket) || e.bucket < 0 || e.bucket > BUCKET_MAX) return null;
  if (typeof e.standalone !== 'boolean') return null;
  if (typeof e.version !== 'string' || !VERSION.test(e.version)) return null;
  if (typeof e.source !== 'string' || !(SOURCES as readonly string[]).includes(e.source)) return null;
  for (const flag of ['offline', 'optin', 'returning']) {
    if (e[flag] !== undefined && typeof e[flag] !== 'boolean') return null;
  }
  // nothing else rides along: a field this list does not know is refused,
  // so the closed list stays closed
  for (const key of Object.keys(e)) {
    if (!['event', 'band', 'bucket', 'standalone', 'version', 'source', 'offline', 'optin', 'returning'].includes(key)) return null;
  }
  return {
    event: e.event as EventName,
    band: e.band as Level,
    bucket: e.bucket,
    standalone: e.standalone,
    version: e.version,
    source: e.source as Source,
    offline: e.offline === true,
    optin: e.optin === true,
    returning: e.returning === true
  };
}

/** the events of a body, or null when it is not a list of one to BATCH_MAX valid events */
export function checkBatch(body: unknown): TelemetryEvent[] | null {
  if (!Array.isArray(body) || body.length === 0 || body.length > BATCH_MAX) return null;
  const events: TelemetryEvent[] = [];
  for (const x of body) {
    const e = checkEvent(x);
    if (!e) return null;
    events.push(e);
  }
  return events;
}

// ---- the points -----------------------------------------------------------------

const flag = (b: boolean) => (b ? 1 : 0);

/** the data point an event becomes, standing for `count` identical events */
export function pointOf(e: TelemetryEvent, country: string, count = 1): DataPoint {
  return {
    indexes: [e.event],
    blobs: [e.band, e.source, e.version, country],
    doubles: [e.bucket, count, flag(e.standalone), flag(e.offline), flag(e.optin), flag(e.returning)]
  };
}

/** identical events as one point each, counts summed, in the order they first appeared */
export function fold(events: TelemetryEvent[], country: string): DataPoint[] {
  const points = new Map<string, DataPoint>();
  for (const e of events) {
    const key = [e.event, e.band, e.bucket, e.standalone, e.version, e.source, e.offline, e.optin, e.returning].join('|');
    const p = points.get(key);
    if (p) p.doubles[1]++;
    else points.set(key, pointOf(e, country));
  }
  return [...points.values()];
}

/** writes a batch as at most POINTS_MAX points; how many went */
export function writeBatch(dataset: AnalyticsEngineLike, events: TelemetryEvent[], country: string): number {
  const points = fold(events, country).slice(0, POINTS_MAX);
  for (const p of points) dataset.writeDataPoint(p);
  return points.length;
}

/** a dataset in memory: the tests, and the dev and preview servers */
export function memoryEvents(): AnalyticsEngineLike & { points: DataPoint[] } {
  const points: DataPoint[] = [];
  return { points, writeDataPoint: (p) => void points.push(p) };
}

// ---- the landing count ------------------------------------------------------------

/**
 * What fetches pages or posts events without being a person: crawlers, the
 * preview fetchers of chat apps, headless browsers and audit tools. The
 * fetchers of X, LinkedIn, Pinterest and Discord all say "bot" (Twitterbot,
 * LinkedInBot, Pinterestbot, Discordbot), Skype's says "Preview",
 * Bluesky's is Cardyb, and
 * those of WhatsApp, Telegram and Slack do not say Mozilla/ at all. The
 * apps' own browsers say none of this (Telegram's on Android adds
 * "Telegram-Android"), and the people in them are counted. "bot" inside
 * CUBOT or FOSSiBOT, phone brands that in-app browsers name, is not a bot.
 * Google's inspection and read-aloud fetchers, and the fetches AI
 * assistants make for a user, say none of these words, so they are named.
 */
const NOT_A_PERSON =
  /(?<!cu|fossi)bot|crawl|spider|slurp|facebookexternalhit|facebookcatalog|iframely|embedly|mastodon|pleroma|misskey|cardyb|preview|headless|lighthouse|pagespeed|inspectiontool|googleother|google-read-aloud|(?:chatgpt|claude|perplexity)-user|curl|wget|python|go-http|okhttp|java\//i;

/** a user agent that is a person's browser: it says Mozilla/ and names nothing on the list above */
export const isPersonAgent = (agent: string) => agent.startsWith('Mozilla/') && !NOT_A_PERSON.test(agent);

/** the country a request came from, as Cloudflare reports it; '' when the runtime does not say (the dev server, a test) */
export function countryOf(request: Request): string {
  const cf = (request as Request & { cf?: { country?: unknown } }).cf;
  return typeof cf?.country === 'string' ? cf.country : '';
}

/**
 * True when a request for a share page is a person arriving from outside
 * the site: a browser's own navigation (GET, Sec-Fetch-Mode navigate
 * where the browser says), no referrer from this origin, and a user agent
 * that is a browser and not a known crawler or preview fetcher
 */
export function isLanding(request: Request): boolean {
  if (request.method !== 'GET') return false;
  const headers = request.headers;
  const mode = headers.get('sec-fetch-mode');
  if (mode && mode !== 'navigate') return false;
  const dest = headers.get('sec-fetch-dest');
  if (dest && dest !== 'document') return false;
  if (!isPersonAgent(headers.get('user-agent') ?? '')) return false;
  const referer = headers.get('referer');
  if (referer) {
    try {
      if (new URL(referer).origin === new URL(request.url).origin) return false;
    } catch {
      // an unreadable referrer is no referrer
    }
  }
  return true;
}

/**
 * Counts a landing on a share page when the request is one (isLanding):
 * a `landing` point with the band the page knows, which address it was
 * (a puzzle's or a daily's) in the source slot, the Worker's version and
 * the country. True when a point was written.
 */
export function countLanding(dataset: AnalyticsEngineLike | null | undefined, request: Request, share: { level?: Level; daily?: unknown }): boolean {
  if (!dataset || !isLanding(request)) return false;
  try {
    dataset.writeDataPoint({
      indexes: ['landing'],
      blobs: [share.level ?? '', share.daily ? 'daily' : 'p', WORKER_VERSION, countryOf(request)],
      doubles: [0, 1, 0, 0, 0, 0]
    });
    return true;
  } catch {
    // a count is never worth an error on the page
    return false;
  }
}

// ---- the route --------------------------------------------------------------------

const rateLimited = makeRateLimiter(RATE_LIMIT);

const json = (body: unknown, status: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers }
  });

export interface TelemetryOptions {
  /** the clock, for tests */
  now?: () => Date;
  /** the country the request came from; read from the request (countryOf) when not given */
  country?: string;
}

/**
 * Answers a telemetry request, or returns null when the address is not
 * /api/t. Without a dataset (no binding) the route answers 503 and the
 * app drops or keeps its events as it would for any failure. Nothing is
 * written from a body that is refused.
 */
export async function handleTelemetry(request: Request, dataset: AnalyticsEngineLike | null, options: TelemetryOptions = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== API_PATH) return null;
  if (request.method !== 'POST') return json({ error: 'method' }, 405, { allow: 'POST' });
  const now = options.now ? options.now() : new Date();
  if (rateLimited(request.headers.get('cf-connecting-ip'), now.getTime())) return json({ error: 'too many' }, 429, { 'retry-after': '600' });
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > BODY_MAX) return json({ error: 'too large' }, 413);
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > BODY_MAX) return json({ error: 'too large' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: 'a JSON list of events is expected' }, 400);
  }
  const events = checkBatch(body);
  if (!events) return json({ error: 'a JSON list of events is expected' }, 400);
  // a crawler that runs the app's script, a headless browser or an audit
  // tool plays no game: its lines are taken and not written, so it learns
  // nothing from the answer
  if (!isPersonAgent(request.headers.get('user-agent') ?? '')) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
  if (!dataset) return json({ error: 'unavailable' }, 503, { 'retry-after': '600' });
  try {
    writeBatch(dataset, events, options.country ?? countryOf(request));
  } catch {
    return json({ error: 'unavailable' }, 503, { 'retry-after': '600' });
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
