/**
 * The private dashboard, /admin (docs/online-goals.md, phase 3): the
 * metrics of the plan, in its order, as a dozen numbers and a thirty-day
 * sparkline, in plain HTML with no script. It reads the telemetry points
 * (telemetry.ts) through the Analytics Engine SQL API with an account id
 * and an API token held as Worker secrets, ADMIN_ACCOUNT_ID and
 * ADMIN_TOKEN (docs/connect-the-analytics.md).
 *
 * The page answers only when its four secrets are set and the request
 * came through Cloudflare Access for this application: the token Access
 * adds (the Cf-Access-Jwt-Assertion header) is verified here, signature,
 * issuer, audience and expiry, against the team's published keys, with
 * the team domain and the application's AUD tag held as the secrets
 * ACCESS_TEAM_DOMAIN and ACCESS_AUD (access.ts). Otherwise it is a 404
 * like any unknown path, on whatever address the Worker was reached.
 *
 * The arithmetic (metricsOf) and the page (renderAdmin) are pure, so the
 * tests run them over rows of their own; only handleAdmin talks to the
 * API, through a fetch it is given.
 */
import { DAYS_SHOWN, DATASET, type DayRow, type Metrics, type Totals } from './adminModel';
import { accessKeys, cameThroughAccess, type AccessEnv, type AccessKeys } from './access';
import { SHARE_KINDS, type LandingFrom, type ShareKind } from './telemetry';

export { DAYS_SHOWN, DATASET };
export type { DayRow, Metrics, Totals };

export const ADMIN_PATH = '/admin';

/** the SQL API of an account */
export const sqlApi = (account: string) => `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`;

/**
 * Every point of the last days, summed per UTC day, event, source (the
 * share pages' landings are 'p' or 'daily' there), kind (what a share was,
 * where a landing came from) and way (a share's sheet or copy; empty for
 * the rest). `_sample_interval` weighs each row by the sampling WAE
 * applies at volume. The flags ride in the doubles (telemetry.ts,
 * pointOf), so a product with the count picks out the events that carry
 * them.
 */
export const adminQuery = (days = DAYS_SHOWN) =>
  [
    "SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, index1 AS event, blob2 AS source, blob5 AS kind, blob6 AS via,",
    'SUM(_sample_interval * double2) AS n,',
    'SUM(_sample_interval * double2 * double3) AS standalone,',
    'SUM(_sample_interval * double2 * double4) AS offline,',
    'SUM(_sample_interval * double2 * double5) AS optin,',
    'SUM(_sample_interval * double2 * double4 * double5) AS optin_offline,',
    'SUM(_sample_interval * double2 * double5 * double6) AS optin_returning',
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${days + 1}' DAY`,
    'GROUP BY day, event, source, kind, via ORDER BY day FORMAT JSON'
  ].join(' ');

/** one row of the query's answer */
export interface Row {
  day: string;
  event: string;
  source: string;
  kind: string;
  via: string;
  n: number;
  standalone: number;
  offline: number;
  optin: number;
  optin_offline: number;
  optin_returning: number;
}

const NUMBERS = ['n', 'standalone', 'offline', 'optin', 'optin_offline', 'optin_returning'] as const;

/** the rows of the API's JSON answer ({ data: [...] }); anything unreadable is left out */
export function rowsOf(answer: unknown): Row[] {
  const data = (answer as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const rows: Row[] = [];
  for (const x of data) {
    if (!x || typeof x !== 'object') continue;
    const r = x as Record<string, unknown>;
    if (typeof r.day !== 'string' || typeof r.event !== 'string') continue;
    const text = (v: unknown) => (typeof v === 'string' ? v : '');
    const row: Row = { day: r.day.slice(0, 10), event: r.event, source: text(r.source), kind: text(r.kind), via: text(r.via), n: 0, standalone: 0, offline: 0, optin: 0, optin_offline: 0, optin_returning: 0 };
    for (const k of NUMBERS) {
      const v = Number(r[k]);
      row[k] = Number.isFinite(v) ? v : 0;
    }
    rows.push(row);
  }
  return rows;
}

/** a UTC day as a key, 2026-10-13 */
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const daysBefore = (now: Date, n: number) => dayKey(new Date(now.getTime() - n * 24 * 60 * 60 * 1000));

const emptyDay = (day: string): DayRow => ({
  day,
  starts: 0,
  startsOptin: 0,
  startsReturning: 0,
  completed: 0,
  completedOffline: 0,
  completedOptin: 0,
  completedOptinOffline: 0,
  completedStandalone: 0,
  landings: 0,
  landingsDaily: 0,
  landingsFrom: {},
  shares: 0,
  sharesSheet: 0,
  sharesBy: {}
});

/** adds n to a count kept by name */
const add = (counts: Record<string, number>, key: string, n: number) => {
  counts[key] = (counts[key] ?? 0) + n;
};

/** the rows summed into the days: today and the DAYS_SHOWN before it, oldest first, empty days included */
export function daysOf(rows: Row[], now: Date): DayRow[] {
  const keys = Array.from({ length: DAYS_SHOWN + 1 }, (_, i) => daysBefore(now, DAYS_SHOWN - i));
  const days = new Map(keys.map((k) => [k, emptyDay(k)]));
  for (const r of rows) {
    // the API writes a day as 2026-10-12 00:00:00
    const d = days.get(r.day.slice(0, 10));
    if (!d) continue;
    if (r.event === 'started') {
      d.starts += r.n;
      d.startsOptin += r.optin;
      d.startsReturning += r.optin_returning;
    } else if (r.event === 'completed') {
      d.completed += r.n;
      d.completedOffline += r.offline;
      d.completedOptin += r.optin;
      d.completedOptinOffline += r.optin_offline;
      d.completedStandalone += r.standalone;
    } else if (r.event === 'landing') {
      d.landings += r.n;
      if (r.source === 'daily') d.landingsDaily += r.n;
      add(d.landingsFrom, r.kind, r.n);
    } else if (r.event === 'shared') {
      d.shares += r.n;
      const by = (d.sharesBy[r.kind] ??= { sheet: 0, copy: 0 });
      if (r.via === 'sheet') {
        d.sharesSheet += r.n;
        by.sheet += r.n;
      } else by.copy += r.n;
    }
  }
  return keys.map((k) => days.get(k)!);
}

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/**
 * The plan's numbers over some days. Completed games split into the ones
 * sent live and the ones an opted-in device kept while offline; the
 * opted-in cohort's offline-to-online ratio, applied to everyone else's
 * live completions, estimates what the rest played offline, and the
 * result is labelled an estimate.
 */
export function totalsOf(days: DayRow[]): Totals {
  const sum = (f: (d: DayRow) => number) => days.reduce((acc, d) => acc + f(d), 0);
  const completed = sum((d) => d.completed);
  const offlineReported = sum((d) => d.completedOffline);
  const online = completed - offlineReported;
  const optinOffline = sum((d) => d.completedOptinOffline);
  const optinOnline = sum((d) => d.completedOptin) - optinOffline;
  const offlineRatio = ratio(optinOffline, optinOnline);
  const offlineEstimate = offlineRatio === null ? null : Math.round((online - optinOnline) * offlineRatio);
  const starts = sum((d) => d.starts);
  const startsOptin = sum((d) => d.startsOptin);
  const startsReturning = sum((d) => d.startsReturning);
  const standalone = sum((d) => d.completedStandalone);
  const landings = sum((d) => d.landings);
  const shares = sum((d) => d.shares);
  const landingsFrom: Record<string, number> = {};
  const sharesBy: Record<string, { sheet: number; copy: number }> = {};
  for (const d of days) {
    for (const [from, n] of Object.entries(d.landingsFrom)) add(landingsFrom, from, n);
    for (const [what, n] of Object.entries(d.sharesBy)) {
      const by = (sharesBy[what] ??= { sheet: 0, copy: 0 });
      by.sheet += n.sheet;
      by.copy += n.copy;
    }
  }
  return {
    starts,
    completed,
    online,
    offlineReported,
    offlineEstimate,
    total: completed + (offlineEstimate ?? 0),
    completionRate: ratio(completed, starts),
    standalone,
    installedShare: ratio(standalone, completed),
    optinOnline,
    optinOffline,
    landings,
    landingsDaily: sum((d) => d.landingsDaily),
    landingsFrom,
    shares,
    sharesSheet: sum((d) => d.sharesSheet),
    sharesBy,
    landingsPerShare: ratio(landings, shares),
    startsOptin,
    startsNew: startsOptin - startsReturning,
    startsReturning,
    newShare: ratio(startsOptin - startsReturning, startsOptin)
  };
}

/** everything the page shows, from the rows and the clock */
export function metricsOf(rows: Row[], now: Date): Metrics {
  const days = daysOf(rows, now);
  const today = days[days.length - 1];
  const past = days.slice(0, -1);
  return {
    days,
    today,
    yesterday: totalsOf(past.slice(-1)),
    week: totalsOf(past.slice(-7)),
    month: totalsOf(past),
    generatedAt: now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
  };
}

// ---- the page -------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number | null) => (n === null ? '—' : Math.round(n).toLocaleString('en-GB'));
const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);

/** what each kind of share is, where the app offers it */
const SHARE_LABELS: Record<ShareKind, string> & Record<string, string | undefined> = {
  puzzle: 'Puzzle link (Share)',
  position: 'Position link (Share)',
  challenge: 'Challenge (win screen)',
  daily: 'Daily line (win screen)'
};

/** each word a landing's referrer becomes (telemetry.ts, landingFrom) */
const FROM_LABELS: Record<LandingFrom | '', string> & Record<string, string | undefined> = {
  none: 'No referrer: typed, a bookmark, most apps',
  search: 'A search engine',
  ai: 'An AI assistant',
  reddit: 'Reddit',
  enjoysudoku: 'Enjoy Sudoku forum',
  hackernews: 'Hacker News',
  facebook: 'Facebook',
  discord: 'Discord',
  social: 'Another social site',
  chat: 'A chat app on the web',
  mail: 'A webmail',
  github: 'GitHub',
  sudoku: 'Another sudoku site',
  other: 'Another site',
  '': 'Not recorded: counted before the word was kept'
};

/** completed games per day as a line, the last DAYS_SHOWN full days, with the peak named */
export function sparkline(days: DayRow[]): string {
  const w = 600;
  const h = 80;
  const pad = 4;
  const values = days.map((d) => d.completed);
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? (w - 2 * pad) / (values.length - 1) : 0;
  const points = values.map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - ((h - 2 * pad) * v) / max).toFixed(1)}`).join(' ');
  const peak = days[values.indexOf(max)];
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="completed games per day, ${days.length} days">
  <polyline fill="none" stroke="#8ab6f7" stroke-width="2" points="${points}" />
  <text x="${w - pad}" y="12" text-anchor="end" fill="#9aa0b3" font-size="11">peak ${num(max)}${peak ? ` on ${esc(peak.day)}` : ''}</text>
</svg>`;
}

const STYLE = `
html{background:#14161f;color:#e8eaf2;font:15px/1.5 'Avenir Next','Segoe UI',system-ui,-apple-system,sans-serif}
body{max-width:900px;margin:0 auto;padding:24px 20px 60px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px}
.meta{color:#9aa0b3;font-size:13px;margin:0 0 20px}
.numbers{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:0}
.numbers div{background:#1a1d29;border:1px solid #2a2e3f;border-radius:10px;padding:10px 14px}
.numbers dt{color:#9aa0b3;font-size:12px;letter-spacing:.3px;text-transform:uppercase}
.numbers dd{margin:2px 0 0;font-size:24px;font-variant-numeric:tabular-nums}
.numbers small{display:block;color:#9aa0b3;font-size:12px}
table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}
td,th{padding:5px 8px;border-bottom:1px solid #2a2e3f;text-align:right;white-space:nowrap}
td:first-child,th:first-child{text-align:left}
tr.today td{color:#9aa0b3;font-style:italic}
svg{display:block;max-width:100%;height:auto;margin:8px 0}
a{color:#8ab6f7}
`.trim();

/** the page: the twelve numbers of the week, the sparkline of the month, and every day of it */
export function renderAdmin(m: Metrics): string {
  const w = m.week;
  const d = m.yesterday;
  const number = (label: string, value: string, note = '') =>
    `      <div><dt>${esc(label)}</dt><dd>${value}</dd>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  const numbers = [
    number('Completed, last 7 days', num(w.online), 'sent live, online'),
    number('Completed yesterday', num(d.online), 'sent live, online'),
    number('Offline, reported', num(w.offlineReported), 'kept by opted-in devices, 7 days'),
    number('Offline, estimated', num(w.offlineEstimate), w.offlineEstimate === null ? 'needs an opted-in device with online solves' : `others at the cohort's ratio, ${num(w.optinOffline)} to ${num(w.optinOnline)}`),
    number('Completed, total estimate', num(w.total), 'live + reported + estimated, 7 days'),
    number('Starts, last 7 days', num(w.starts), 'games begun: counted at the first move'),
    number('Completion rate', pct(w.completionRate), `${num(w.completed)} completed of ${num(w.starts)} begun, 7 days`),
    number(
      'Solved in installed app',
      pct(w.installedShare),
      `${num(w.standalone)} of ${num(w.completed)}, played from a home-screen or desktop icon; not a count of installs`
    ),
    number('Landings yesterday', num(d.landings), `${num(d.landingsDaily)} on a daily's address`),
    number('Landings, last 7 days', num(w.landings), 'share pages opened from outside the site, by people'),
    number('Shares, last 7 days', num(w.shares), `${num(w.sharesSheet)} through the share sheet, ${num(w.shares - w.sharesSheet)} copied`),
    number(
      'Landings per share',
      w.landingsPerShare === null ? '—' : w.landingsPerShare.toFixed(2),
      `${num(w.landings)} landings over ${num(w.shares)} shares, 7 days`
    ),
    number('New players', pct(w.newShare), `${num(w.startsNew)} of ${num(w.startsOptin)} opted-in starts, 7 days`),
    number(
      'Returning players',
      pct(w.newShare === null ? null : 1 - w.newShare),
      `${num(w.startsReturning)} of ${num(w.startsOptin)} opted-in starts on a later day than the device's first`
    )
  ].join('\n');
  const rows = m.days
    .map(
      (day, i) =>
        `      <tr${i === m.days.length - 1 ? ' class="today"' : ''}><td>${esc(day.day)}</td><td>${num(day.starts)}</td><td>${num(day.completed - day.completedOffline)}</td><td>${num(day.completedOffline)}</td><td>${num(day.completedStandalone)}</td><td>${num(day.shares)}</td><td>${num(day.landings)}</td><td>${num(day.startsOptin - day.startsReturning)}</td><td>${num(day.startsReturning)}</td></tr>`
    )
    .join('\n');
  // what was shared, in the list's order, then anything else the data holds
  const kinds = [...SHARE_KINDS, ...Object.keys(w.sharesBy).filter((k) => !(SHARE_KINDS as readonly string[]).includes(k))];
  const shareRows = kinds
    .map((k) => {
      const by = w.sharesBy[k] ?? { sheet: 0, copy: 0 };
      return `      <tr><td>${esc(SHARE_LABELS[k] ?? k)}</td><td>${num(by.sheet)}</td><td>${num(by.copy)}</td><td>${num(by.sheet + by.copy)}</td></tr>`;
    })
    .join('\n');
  // where landings came from, the most first; a word with none is left out
  const fromRows = Object.entries(w.landingsFrom)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([from, n]) => `      <tr><td>${esc(FROM_LABELS[from] ?? from)}</td><td>${num(n)}</td><td>${pct(w.landings > 0 ? n / w.landings : null)}</td></tr>`)
    .join('\n');
  const month = m.month;
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>sudokUI admin</title>
    <style>${STYLE}</style>
  </head>
  <body>
    <h1>sudokUI: plays, shares, landings, players</h1>
    <p class="meta">Workers Analytics Engine, ${esc(DATASET)}, UTC days. Generated ${esc(m.generatedAt)}. Nothing here names a player.</p>
    <dl class="numbers">
${numbers}
    </dl>
    <h2>Completed per day, last ${DAYS_SHOWN} days</h2>
    ${sparkline(m.days.slice(0, -1))}
    <p class="meta">${DAYS_SHOWN} days: ${num(month.starts)} starts, ${num(month.completed)} completed (${num(month.offlineReported)} reported offline, ${num(month.offlineEstimate)} estimated), ${num(month.shares)} shares, ${num(month.landings)} landings, completion ${pct(month.completionRate)}, solved in the installed app ${pct(month.installedShare)}.</p>
    <h2>What was shared, last 7 days</h2>
    <table>
      <thead><tr><th>Shared</th><th>Share sheet</th><th>Copied</th><th>All</th></tr></thead>
      <tbody>
${shareRows}
      </tbody>
    </table>
    <h2>Where landings came from, last 7 days</h2>
    <table>
      <thead><tr><th>From</th><th>Landings</th><th>Of all</th></tr></thead>
      <tbody>
${fromRows || '      <tr><td>No landings</td><td>0</td><td>—</td></tr>'}
      </tbody>
    </table>
    <h2>Every day</h2>
    <table>
      <thead><tr><th>Day</th><th>Starts</th><th>Completed</th><th>Offline</th><th>In installed app</th><th>Shares</th><th>Landings</th><th>New</th><th>Returning</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <p class="meta">Today's row is the day so far. Starts are games begun, counted at the first move. Before 21 October 2026 every game opened was counted, the app's own first game included, and builds a device has not yet updated still do so for a few days after; their lines carry the version 1.0.0, the new builds' 1.0.0+ and a commit. In installed app is the completed games played from the app installed on a home screen or desktop, through the browser's Add to Home Screen or Install; it is not a count of installs. Offline is the count opted-in devices kept and sent later; New and Returning count opted-in starts only. Devices switched to "Leave this device out of the counts" send no starts or solves; a share or daily link opened in a browser or chat app where the switch is not on, even on the same phone, can still be a landing, since the server cannot see the switch. A share is a link to a puzzle, a position, a challenge or the daily's line that the share sheet took or that was copied, sent live from a device not left out; copying the puzzle as text is not one. Landings per share is not the reach of one link: a landing may come from a link shared days before, or found somewhere other than the app. Where a landing came from is the one word the referrer gave; most chat and mail apps send none, so No referrer is mostly them. The sixth metric of the plan, search clicks, is in Search Console.</p>
  </body>
</html>
`;
}

const page = (html: string, status = 200) =>
  new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' }
  });

export interface AdminEnv extends AccessEnv {
  ADMIN_ACCOUNT_ID?: string;
  ADMIN_TOKEN?: string;
}

/** the Access keys, fetched once per isolate and kept an hour (access.ts) */
const ISOLATE_KEYS = accessKeys();

export interface AdminOptions {
  /** how the API is reached, for tests */
  fetch?: typeof fetch;
  now?: () => Date;
  /** the Access keys, for tests; the isolate's cache otherwise */
  accessKeys?: AccessKeys;
}

/**
 * Answers /admin, or returns null: for any other address, when a secret
 * is not set, or when the request carries no valid Access token for the
 * application; the caller then answers as for an unknown path (a 404).
 * An API that fails answers 502 with what it said, never the secrets.
 */
export async function handleAdmin(request: Request, env: AdminEnv, options: AdminOptions = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== ADMIN_PATH && url.pathname !== ADMIN_PATH + '/') return null;
  if (!env.ADMIN_ACCOUNT_ID || !env.ADMIN_TOKEN) return null;
  const now = options.now ? options.now() : new Date();
  if (!(await cameThroughAccess(request, env, options.accessKeys ?? ISOLATE_KEYS, now))) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  const doFetch = options.fetch ?? fetch;
  let answer: unknown;
  try {
    const res = await doFetch(sqlApi(env.ADMIN_ACCOUNT_ID), {
      method: 'POST',
      headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, 'content-type': 'text/plain; charset=utf-8' },
      body: adminQuery()
    });
    const text = await res.text();
    if (!res.ok) return page(`<!doctype html><title>sudokUI admin</title><p>The analytics API answered ${res.status}.</p><pre>${esc(text.slice(0, 1000))}</pre>`, 502);
    answer = JSON.parse(text);
  } catch (err) {
    return page(`<!doctype html><title>sudokUI admin</title><p>The analytics API could not be read: ${esc(String(err).slice(0, 300))}</p>`, 502);
  }
  const html = renderAdmin(metricsOf(rowsOf(answer), now));
  return request.method === 'HEAD' ? page('', 200) : page(html);
}
