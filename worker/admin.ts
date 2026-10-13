/**
 * The private dashboard, /admin (docs/online-goals.md, phase 3): the
 * metrics of the plan, in its order, as a dozen numbers and a thirty-day
 * sparkline, in plain HTML with no script. It reads the telemetry points
 * (telemetry.ts) through the Analytics Engine SQL API with an account id
 * and an API token held as Worker secrets, ADMIN_ACCOUNT_ID and
 * ADMIN_TOKEN (docs/connect-the-analytics.md).
 *
 * The page answers only when both secrets are set and the request came
 * through Cloudflare Access (the Cf-Access-Jwt-Assertion header Access
 * adds); otherwise it is a 404 like any unknown path. Access is the lock,
 * set up by hand on the account; the header check is a latch, so that a
 * deploy without Access shows nothing, not a verification of the token.
 *
 * The arithmetic (metricsOf) and the page (renderAdmin) are pure, so the
 * tests run them over rows of their own; only handleAdmin talks to the
 * API, through a fetch it is given.
 */
import { DAYS_SHOWN, DATASET, type DayRow, type Metrics, type Totals } from './adminModel';

export { DAYS_SHOWN, DATASET };
export type { DayRow, Metrics, Totals };

export const ADMIN_PATH = '/admin';

/** the SQL API of an account */
export const sqlApi = (account: string) => `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`;

/**
 * Every point of the last days, summed per UTC day, event and source
 * (the share pages' landings are 'p' or 'daily' there). `_sample_interval`
 * weighs each row by the sampling WAE applies at volume. The flags ride in
 * the doubles (telemetry.ts, pointOf), so a product with the count picks
 * out the events that carry them.
 */
export const adminQuery = (days = DAYS_SHOWN) =>
  [
    "SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, index1 AS event, blob2 AS source,",
    'SUM(_sample_interval * double2) AS n,',
    'SUM(_sample_interval * double2 * double3) AS standalone,',
    'SUM(_sample_interval * double2 * double4) AS offline,',
    'SUM(_sample_interval * double2 * double5) AS optin,',
    'SUM(_sample_interval * double2 * double4 * double5) AS optin_offline,',
    'SUM(_sample_interval * double2 * double5 * double6) AS optin_returning',
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${days + 1}' DAY`,
    'GROUP BY day, event, source ORDER BY day FORMAT JSON'
  ].join(' ');

/** one row of the query's answer */
export interface Row {
  day: string;
  event: string;
  source: string;
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
    const row: Row = { day: r.day.slice(0, 10), event: r.event, source: typeof r.source === 'string' ? r.source : '', n: 0, standalone: 0, offline: 0, optin: 0, optin_offline: 0, optin_returning: 0 };
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
  landingsDaily: 0
});

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
  return {
    starts,
    completed,
    online,
    offlineReported,
    offlineEstimate,
    total: completed + (offlineEstimate ?? 0),
    completionRate: ratio(completed, starts),
    installedShare: ratio(sum((d) => d.completedStandalone), completed),
    optinOnline,
    optinOffline,
    landings: sum((d) => d.landings),
    landingsDaily: sum((d) => d.landingsDaily),
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
    number('Starts, last 7 days', num(w.starts), 'participants, roughly: one start, one sitting'),
    number('Completion rate', pct(w.completionRate), 'completed against started, 7 days'),
    number('Installed share', pct(w.installedShare), 'completions from the installed app'),
    number('Landings yesterday', num(d.landings), `${num(d.landingsDaily)} on a daily's address`),
    number('Landings, last 7 days', num(w.landings), 'share pages opened from outside the site, by people'),
    number('New players', pct(w.newShare), `of ${num(w.startsOptin)} opted-in starts, 7 days`),
    number('Returning players', pct(w.newShare === null ? null : 1 - w.newShare), `${num(w.startsReturning)} starts on a later day than the first`)
  ].join('\n');
  const rows = m.days
    .map(
      (day, i) =>
        `      <tr${i === m.days.length - 1 ? ' class="today"' : ''}><td>${esc(day.day)}</td><td>${num(day.starts)}</td><td>${num(day.completed - day.completedOffline)}</td><td>${num(day.completedOffline)}</td><td>${num(day.completedStandalone)}</td><td>${num(day.landings)}</td><td>${num(day.startsOptin - day.startsReturning)}</td><td>${num(day.startsReturning)}</td></tr>`
    )
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
    <h1>sudokUI: plays, landings, players</h1>
    <p class="meta">Workers Analytics Engine, ${esc(DATASET)}, UTC days. Generated ${esc(m.generatedAt)}. Nothing here names a player.</p>
    <dl class="numbers">
${numbers}
    </dl>
    <h2>Completed per day, last ${DAYS_SHOWN} days</h2>
    ${sparkline(m.days.slice(0, -1))}
    <p class="meta">${DAYS_SHOWN} days: ${num(month.starts)} starts, ${num(month.completed)} completed (${num(month.offlineReported)} reported offline, ${num(month.offlineEstimate)} estimated), ${num(month.landings)} landings, completion ${pct(month.completionRate)}, installed ${pct(month.installedShare)}.</p>
    <h2>Every day</h2>
    <table>
      <thead><tr><th>Day</th><th>Starts</th><th>Completed</th><th>Offline</th><th>Installed</th><th>Landings</th><th>New</th><th>Returning</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    <p class="meta">Today's row is the day so far. Offline is the count opted-in devices kept and sent later; New and Returning count opted-in starts only. The sixth metric of the plan, search clicks, is in Search Console.</p>
  </body>
</html>
`;
}

const page = (html: string, status = 200) =>
  new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' }
  });

export interface AdminEnv {
  ADMIN_ACCOUNT_ID?: string;
  ADMIN_TOKEN?: string;
}

export interface AdminOptions {
  /** how the API is reached, for tests */
  fetch?: typeof fetch;
  now?: () => Date;
}

/**
 * Answers /admin, or returns null: for any other address, when the
 * secrets are not set, or when the request did not come through Access;
 * the caller then answers as for an unknown path (a 404). An API that
 * fails answers 502 with what it said, never the secrets.
 */
export async function handleAdmin(request: Request, env: AdminEnv, options: AdminOptions = {}): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== ADMIN_PATH && url.pathname !== ADMIN_PATH + '/') return null;
  if (!env.ADMIN_ACCOUNT_ID || !env.ADMIN_TOKEN) return null;
  if (!request.headers.get('cf-access-jwt-assertion')) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: { allow: 'GET, HEAD' } });
  const doFetch = options.fetch ?? fetch;
  const now = options.now ? options.now() : new Date();
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
