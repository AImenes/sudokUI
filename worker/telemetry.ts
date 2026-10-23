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
 * and the three flags. A `shared` line, sent when a player shares a link,
 * adds two blobs: what was shared and whether the share sheet took it or
 * it was copied (SHARE_KINDS, SHARE_VIAS). Identical events fold into one point with a count,
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
 * fetcher. That is the research's "share-link landings" number. Its fifth
 * blob says where the link was opened from, as one word of a closed list
 * (landingFrom): the referrer the browser sends is read for that word and
 * never written.
 *
 * The dataset is an interface, so the tests and the dev and preview
 * servers run the whole thing over memory (memoryEvents).
 */
import { LEVELS, Level } from '../src/engine/ratings';
import { BUCKET_MAX } from '../src/content/dailies';
import { makeRateLimiter } from './daily';
import { version as WORKER_VERSION } from '../package.json';

export const API_PATH = '/api/t';

/** the events a point can stand for; `landing` is the Worker's own */
export const EVENT_NAMES = ['started', 'completed', 'shared', 'landing'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** the events the route takes: a `landing` is written only by the share route, so none can be posted */
export const APP_EVENTS = ['started', 'completed', 'shared'] as const;
export type AppEvent = (typeof APP_EVENTS)[number];

/** where an event came from: the installed app or a browser tab (dailyStats.ts, playedFrom) */
export const SOURCES = ['pwa', 'tab'] as const;
export type Source = (typeof SOURCES)[number];

/**
 * What a `shared` line says was shared: the Share dialog's link to the
 * puzzle (a daily's own address for a daily) or to the position, the win
 * screen's challenge, or the daily's line (src/ui/Dialogs.tsx)
 */
export const SHARE_KINDS = ['puzzle', 'position', 'challenge', 'daily'] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

/** how it went: the device's share sheet took it, or it was copied (src/ui/send.ts) */
export const SHARE_VIAS = ['sheet', 'copy'] as const;
export type ShareVia = (typeof SHARE_VIAS)[number];

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
  event: AppEvent;
  /** for a share, the band of the puzzle shared */
  band: Level;
  /** the time in 15-second buckets, capped as the daily's are (dailies.ts); 0 for a start and a share */
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
  /** a share's kind and way; on a `shared` line only, and always there */
  what?: ShareKind;
  via?: ShareVia;
}

/** what goes to WAE: one index, four blobs (six for a share, five for a landing), six doubles (see the header) */
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
  if (typeof e.event !== 'string' || !(APP_EVENTS as readonly string[]).includes(e.event)) return null;
  if (typeof e.band !== 'string' || !LEVEL_SET.has(e.band)) return null;
  if (typeof e.bucket !== 'number' || !Number.isInteger(e.bucket) || e.bucket < 0 || e.bucket > BUCKET_MAX) return null;
  if (typeof e.standalone !== 'boolean') return null;
  if (typeof e.version !== 'string' || !VERSION.test(e.version)) return null;
  if (typeof e.source !== 'string' || !(SOURCES as readonly string[]).includes(e.source)) return null;
  for (const flag of ['offline', 'optin', 'returning']) {
    if (e[flag] !== undefined && typeof e[flag] !== 'boolean') return null;
  }
  const shared = e.event === 'shared';
  if (shared) {
    // a share says what and how, and nothing a play line says besides:
    // no time, and never kept, so none of the opt-in's flags
    if (typeof e.what !== 'string' || !(SHARE_KINDS as readonly string[]).includes(e.what)) return null;
    if (typeof e.via !== 'string' || !(SHARE_VIAS as readonly string[]).includes(e.via)) return null;
    if (e.bucket !== 0 || e.offline === true || e.optin === true || e.returning === true) return null;
  }
  // nothing else rides along: a field this list does not know is refused,
  // so the closed list stays closed
  const fields = ['event', 'band', 'bucket', 'standalone', 'version', 'source', 'offline', 'optin', 'returning', ...(shared ? ['what', 'via'] : [])];
  for (const key of Object.keys(e)) {
    if (!fields.includes(key)) return null;
  }
  return {
    event: e.event as AppEvent,
    band: e.band as Level,
    bucket: e.bucket,
    standalone: e.standalone,
    version: e.version,
    source: e.source as Source,
    offline: e.offline === true,
    optin: e.optin === true,
    returning: e.returning === true,
    ...(shared ? { what: e.what as ShareKind, via: e.via as ShareVia } : {})
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
  const blobs = [e.band, e.source, e.version, country];
  // a share's kind and way; a play line keeps its four blobs, as before
  if (e.event === 'shared') blobs.push(e.what ?? '', e.via ?? '');
  return {
    indexes: [e.event],
    blobs,
    doubles: [e.bucket, count, flag(e.standalone), flag(e.offline), flag(e.optin), flag(e.returning)]
  };
}

/** identical events as one point each, counts summed, in the order they first appeared */
export function fold(events: TelemetryEvent[], country: string): DataPoint[] {
  const points = new Map<string, DataPoint>();
  for (const e of events) {
    const key = [e.event, e.band, e.bucket, e.standalone, e.version, e.source, e.offline, e.optin, e.returning, e.what ?? '', e.via ?? ''].join('|');
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
 * Where a landing came from, as one word of a closed list, the one the
 * privacy page names: `none` when the browser sends no referrer (a link
 * typed, a bookmark, or an app that sends none, as most do), `other` for
 * any site or app the list does not know. A referrer is usually another
 * site's address; on Android it can be the app the link was opened from
 * (FROM_APPS), so `chat` and `mail` cover apps as well as sites. The word
 * is all that is written, never the address.
 */
export const LANDING_FROM = [
  'none',
  'search',
  'ai',
  'reddit',
  'enjoysudoku',
  'hackernews',
  'facebook',
  'discord',
  'social',
  'chat',
  'mail',
  'github',
  'sudoku',
  'other'
] as const;
export type LandingFrom = (typeof LANDING_FROM)[number];

/**
 * The sites each word stands for, matched on the host and its subdomains
 * (old.reddit.com is reddit, l.facebook.com facebook). The first match
 * wins, so a webmail and an assistant go before the search engine of the
 * same company. A search engine is named by its search host, not its
 * whole domain, which also serves mail, news and forums; the search pages
 * on a whole domain's own root are SEARCH_ROOTS below.
 */
const FROM_HOSTS: [LandingFrom, string[]][] = [
  [
    'mail',
    [
      'mail.google.com',
      'outlook.live.com',
      'outlook.office.com',
      'outlook.office365.com',
      'outlook.cloud.microsoft',
      'mail.yahoo.com',
      'mail.proton.me',
      'mail.aol.com',
      'mail.yandex.ru',
      'mail.yandex.com',
      'mail.naver.com',
      'email.seznam.cz'
    ]
  ],
  ['ai', ['chatgpt.com', 'chat.openai.com', 'perplexity.ai', 'claude.ai', 'gemini.google.com', 'copilot.microsoft.com']],
  ['reddit', ['reddit.com', 'redd.it']],
  ['enjoysudoku', ['enjoysudoku.com']],
  ['hackernews', ['news.ycombinator.com', 'hn.algolia.com']],
  ['facebook', ['facebook.com', 'fb.com', 'fb.me']],
  ['discord', ['discord.com', 'discordapp.com', 'discord.gg']],
  [
    'social',
    ['t.co', 'x.com', 'twitter.com', 'linkedin.com', 'lnkd.in', 'bsky.app', 'instagram.com', 'threads.net', 'threads.com', 'pinterest.com', 'tumblr.com', 'mastodon.social', 'youtube.com', 'tiktok.com', 'vk.com']
  ],
  [
    'chat',
    ['whatsapp.com', 'telegram.org', 't.me', 'messenger.com', 'slack.com', 'teams.microsoft.com', 'teams.live.com', 'teams.cloud.microsoft', 'signal.org', 'snapchat.com', 'chat.google.com']
  ],
  ['github', ['github.com']],
  [
    'sudoku',
    ['sudokuwiki.org', 'sudoku.coach', 'sudokupad.app', 'f-puzzles.com', 'sudokuexchange.com', 'hodoku.sourceforge.net', 'logic-masters.de', 'sudoku-solutions.com', 'crackingthecryptic.com']
  ],
  ['search', ['bing.com', 'duckduckgo.com', 'ecosia.org', 'startpage.com', 'search.brave.com', 'qwant.com', 'search.yahoo.com', 'm.baidu.com', 'kagi.com', 'ya.ru', 'search.naver.com', 'search.seznam.cz']]
];

/**
 * Search engines whose search is the domain's own root: Google on its
 * country domains (google.com, www.google.no, google.co.uk), Yandex, Baidu
 * and Seznam. The root only, so Google's Docs, Sites, Groups or Classroom
 * are another site, and its chat and mail are named above. A link that
 * Gmail or Docs passes through Google's redirect arrives from www.google
 * and reads as search: the browser says no more than that.
 */
const SEARCH_ROOTS = /^(?:www\.)?(?:google\.(?:com?\.)?[a-z]{2,3}|yandex\.(?:ru|com|com\.tr|by|kz|uz)|baidu\.com|seznam\.cz)$/;

/**
 * Android's apps name themselves as android-app://<package>: the apps of
 * the services named above, and the phone's own messages apps, which a
 * share menu hands a link to as often as a chat app
 */
const FROM_APPS: [LandingFrom, string[]][] = [
  ['search', ['com.google.android.googlequicksearchbox']],
  ['mail', ['com.google.android.gm', 'com.microsoft.office.outlook', 'ch.protonmail.android', 'com.yahoo.mobile.client.android.mail']],
  ['reddit', ['com.reddit.frontpage']],
  ['facebook', ['com.facebook.katana', 'com.facebook.lite']],
  ['discord', ['com.discord']],
  [
    'social',
    [
      'com.twitter.android',
      'com.linkedin.android',
      'com.instagram.android',
      'com.instagram.barcelona',
      'xyz.blueskyweb.app',
      'com.google.android.youtube',
      'com.zhiliaoapp.musically',
      'com.pinterest',
      'com.tumblr',
      'org.joinmastodon.android'
    ]
  ],
  [
    'chat',
    [
      'com.whatsapp',
      'com.whatsapp.w4b',
      'org.telegram.messenger',
      'com.facebook.orca',
      'com.slack',
      'org.thoughtcrime.securesms',
      'com.microsoft.teams',
      'com.google.android.apps.dynamite',
      'com.snapchat.android',
      'com.google.android.apps.messaging',
      'com.samsung.android.messaging'
    ]
  ]
];

/**
 * The word for a referrer, as landings are counted (LANDING_FROM). A
 * referrer is usually a site's origin, but a site can send its whole
 * address, query and all: only the host, or an app's package, is read.
 */
export function landingFrom(referer: string | null): LandingFrom {
  if (!referer) return 'none';
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    // an unreadable referrer is no referrer, as isLanding reads it
    return 'none';
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol === 'android-app:') return FROM_APPS.find(([, apps]) => apps.includes(host))?.[0] ?? 'other';
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'other';
  for (const [word, hosts] of FROM_HOSTS) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return word;
  }
  return SEARCH_ROOTS.test(host) ? 'search' : 'other';
}

/**
 * Counts a landing on a share page when the request is one (isLanding):
 * a `landing` point with the band the page knows, which address it was
 * (a puzzle's or a daily's) in the source slot, the Worker's version, the
 * country and where it came from (landingFrom). True when a point was
 * written.
 */
export function countLanding(dataset: AnalyticsEngineLike | null | undefined, request: Request, share: { level?: Level; daily?: unknown }): boolean {
  if (!dataset || !isLanding(request)) return false;
  try {
    dataset.writeDataPoint({
      indexes: ['landing'],
      blobs: [share.level ?? '', share.daily ? 'daily' : 'p', WORKER_VERSION, countryOf(request), landingFrom(request.headers.get('referer'))],
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
