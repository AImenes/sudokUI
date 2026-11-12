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
 *
 * Below the daily's times sent, a Christmas section (adventSection): the
 * advent calendar in season (docs/advent-calendar.md), each door's games
 * begun and completed (the play lines' door, a second query, run only
 * from 30 November to 31 January and kept to the calendar's own lines),
 * its completion rate, its unassisted times and their median (the
 * database's histogram, one read on the range of the year's 24 door
 * numbers), and the landings on the doors' addresses by referrer word.
 * Before 1 December it says when the calendar opens and shows zeros.
 */
import {
  DAYS_SHOWN,
  DATASET,
  type AdventCounted,
  type AdventDoorRow,
  type AdventMetrics,
  type AdventPhase,
  type DayRow,
  type Metrics,
  type ShareWays,
  type Totals
} from './adminModel';
import { accessKeys, cameThroughAccess, type AccessEnv, type AccessKeys } from './access';
import type { D1Like } from './daily';
import { PLAY_KINDS, PLAY_LANGS, SHARE_KINDS, type LandingFrom, type PlayKind, type PlayLang, type ShareKind } from './telemetry';
import advent from '../src/content/advent.json';
import { ADVENT_DOORS, adventNo, calendarYears, daysBetween, findDoor, type AdventDoor } from '../src/content/advent';
import { doorDate, calendarEnd, seasonYear } from '../src/content/season';
import { statsFromHistogram, type HistogramRow } from '../src/content/dailies';

export { DAYS_SHOWN, DATASET };
export type { AdventMetrics, DayRow, Metrics, Totals };

export const ADMIN_PATH = '/admin';

/** the SQL API of an account */
export const sqlApi = (account: string) => `https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`;

/**
 * Every point of the last days, summed per UTC day, event, source (a
 * landing's page is 'p', 'daily' or 'home' there), kind (what a share was,
 * where a landing came from, what kind of game a start or a solve was)
 * and way (a share's sheet or copy, a start's or a solve's language;
 * empty for the rest, and for an older app's play lines). `_sample_interval` weighs each row by the sampling WAE
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
  /** blob5: what a share was, where a landing came from, a play line's kind of game */
  kind: string;
  /** blob6: a share's way, a play line's language */
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
  landingsHome: 0,
  landingsFrom: {},
  landingsFromHome: {},
  shares: 0,
  sharesSheet: 0,
  sharesSaved: 0,
  sharesBy: {},
  startsBy: {},
  completedBy: {},
  startsByLang: {},
  completedByLang: {}
});

/** every share of one kind, whichever way it went */
const waysOf = (by: ShareWays | undefined) => (by ? by.sheet + by.copy + by.save : 0);

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
    // every start and solve by kind and language; the play counts leave
    // practice out, as they did before it was counted, so a week reads
    // against the weeks before it, and practice has its own column
    if (r.event === 'started') {
      add(d.startsBy, r.kind, r.n);
      add(d.startsByLang, r.via, r.n);
    } else if (r.event === 'completed') {
      add(d.completedBy, r.kind, r.n);
      add(d.completedByLang, r.via, r.n);
    }
    const practice = r.kind === 'practice';
    if (r.event === 'started' && !practice) {
      d.starts += r.n;
      d.startsOptin += r.optin;
      d.startsReturning += r.optin_returning;
    } else if (r.event === 'completed' && !practice) {
      d.completed += r.n;
      d.completedOffline += r.offline;
      d.completedOptin += r.optin;
      d.completedOptinOffline += r.optin_offline;
      d.completedStandalone += r.standalone;
    } else if (r.event === 'landing') {
      d.landings += r.n;
      if (r.source === 'daily') d.landingsDaily += r.n;
      add(d.landingsFrom, r.kind, r.n);
      if (r.source === 'home') {
        d.landingsHome += r.n;
        add(d.landingsFromHome, r.kind, r.n);
      }
    } else if (r.event === 'shared') {
      d.shares += r.n;
      const by = (d.sharesBy[r.kind] ??= { sheet: 0, copy: 0, save: 0 });
      if (r.via === 'sheet') {
        d.sharesSheet += r.n;
        by.sheet += r.n;
      } else if (r.via === 'save') {
        d.sharesSaved += r.n;
        by.save += r.n;
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
  const landingsHome = sum((d) => d.landingsHome);
  const shares = sum((d) => d.shares);
  const landingsFrom: Record<string, number> = {};
  const landingsFromHome: Record<string, number> = {};
  const startsBy: Record<string, number> = {};
  const completedBy: Record<string, number> = {};
  const startsByLang: Record<string, number> = {};
  const completedByLang: Record<string, number> = {};
  const sharesBy: Record<string, ShareWays> = {};
  for (const d of days) {
    for (const [from, n] of Object.entries(d.landingsFrom)) add(landingsFrom, from, n);
    for (const [from, n] of Object.entries(d.landingsFromHome)) add(landingsFromHome, from, n);
    for (const [kind, n] of Object.entries(d.startsBy)) add(startsBy, kind, n);
    for (const [kind, n] of Object.entries(d.completedBy)) add(completedBy, kind, n);
    for (const [lang, n] of Object.entries(d.startsByLang)) add(startsByLang, lang, n);
    for (const [lang, n] of Object.entries(d.completedByLang)) add(completedByLang, lang, n);
    for (const [what, n] of Object.entries(d.sharesBy)) {
      const by = (sharesBy[what] ??= { sheet: 0, copy: 0, save: 0 });
      by.sheet += n.sheet;
      by.copy += n.copy;
      by.save += n.save;
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
    landingsHome,
    landingsFrom,
    landingsFromHome,
    shares,
    sharesSheet: sum((d) => d.sharesSheet),
    sharesSaved: sum((d) => d.sharesSaved),
    sharesBy,
    // a picture carries no link to land on
    landingsPerShare: ratio(landings - landingsHome, shares - waysOf(sharesBy.image)),
    startsBy,
    completedBy,
    startsByLang,
    completedByLang,
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
  daily: 'Daily line (win screen)',
  image: 'Picture of the board (Share, or a hint)'
};

/** what kind of game, as a column of the page */
const KIND_LABELS: Record<PlayKind, string> = {
  daily: 'Daily',
  new: 'New',
  shared: 'From a share link',
  practice: 'Practice',
  advent: 'Advent calendar'
};

/** the app's language, as a column of the page */
const LANG_LABELS: Record<PlayLang, string> = {
  en: 'English',
  nb: 'Norwegian',
  es: 'Spanish'
};

/** each word a landing's referrer becomes (telemetry.ts, landingWord) */
const FROM_LABELS: Record<LandingFrom | '', string> & Record<string, string | undefined> = {
  none: 'No referrer: typed, a bookmark, most apps',
  search: "A search engine (and links Google's own redirect passed on)",
  ai: 'An AI assistant (its address as the referrer, or with none its utm_source tag on the link)',
  reddit: 'Reddit',
  enjoysudoku: 'Enjoy Sudoku forum',
  hackernews: 'Hacker News',
  facebook: 'Facebook',
  discord: 'Discord',
  social: 'Another social site or app',
  chat: 'A chat app or site',
  mail: 'A mail app or webmail',
  github: 'GitHub',
  sudoku: 'Another sudoku site (menneske.no among them)',
  directory: 'An app directory (AlternativeTo, SaaSHub, Product Hunt and the like)',
  fediverse: 'Lemmy or Mastodon',
  press: 'A news site (kode24, Teknisk Ukeblad, Aftenposten)',
  other: 'Another site or app',
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
.wide{overflow-x:auto}
a{color:#8ab6f7}
`.trim();

/** a row's cells by kind of game, then by language, then the lines an older app sent, which say neither */
const playCells = (by: Record<string, number>, byLang: Record<string, number>) =>
  [...PLAY_KINDS.map((k) => by[k] ?? 0), ...PLAY_LANGS.map((l) => byLang[l] ?? 0), by[''] ?? 0].map((n) => `<td>${num(n)}</td>`).join('');
const PLAY_HEADS = [...PLAY_KINDS.map((k) => KIND_LABELS[k]), ...PLAY_LANGS.map((l) => LANG_LABELS[l]), 'Not recorded'].map((h) => `<th>${esc(h)}</th>`).join('');

/** the page: the fourteen numbers, the sparkline of the month, what was shared, the games by kind and language, and where landings came from that week, and every day of the month */
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
    number('Starts, last 7 days', num(w.starts), 'games begun, counted at the first move; practice apart'),
    number('Completion rate', pct(w.completionRate), `${num(w.completed)} completed of ${num(w.starts)} begun, 7 days`),
    number(
      'Solved in installed app',
      pct(w.installedShare),
      `${num(w.standalone)} of ${num(w.completed)}, played from a home-screen or desktop icon; not a count of installs`
    ),
    number('Landings yesterday', num(d.landings), `${num(d.landingsHome)} on a home page, ${num(d.landingsDaily)} on a daily's address`),
    number('Landings, last 7 days', num(w.landings), 'home pages and share pages opened from outside the site, by people'),
    number(
      'Shares, last 7 days',
      num(w.shares),
      `${num(w.sharesSheet)} through the share sheet, ${num(w.shares - w.sharesSheet - w.sharesSaved)} copied${w.sharesSaved ? `, ${num(w.sharesSaved)} saved as a picture` : ''}`
    ),
    number(
      'Landings per share',
      w.landingsPerShare === null ? '—' : w.landingsPerShare.toFixed(2),
      `${num(w.landings - w.landingsHome)} share-page landings over ${num(w.shares - waysOf(w.sharesBy.image))} shares of a link, 7 days`
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
        `      <tr${i === m.days.length - 1 ? ' class="today"' : ''}><td>${esc(day.day)}</td><td>${num(day.starts)}</td><td>${num(day.completed - day.completedOffline)}</td><td>${num(day.completedOffline)}</td><td>${num(day.completedStandalone)}</td><td>${num(day.shares)}</td><td>${num(day.landings)}</td><td>${num(day.landingsHome)}</td><td>${num(day.startsOptin - day.startsReturning)}</td><td>${num(day.startsReturning)}</td></tr>`
    )
    .join('\n');
  // the games begun each day, by kind and by language, practice included
  const playRows = m.days
    .map((day, i) => `      <tr${i === m.days.length - 1 ? ' class="today"' : ''}><td>${esc(day.day)}</td>${playCells(day.startsBy, day.startsByLang)}</tr>`)
    .join('\n');
  // what was shared, in the list's order, then anything else the data holds
  const kinds = [...SHARE_KINDS, ...Object.keys(w.sharesBy).filter((k) => !(SHARE_KINDS as readonly string[]).includes(k))];
  const shareRows = kinds
    .map((k) => {
      const by = w.sharesBy[k] ?? { sheet: 0, copy: 0, save: 0 };
      return `      <tr><td>${esc(SHARE_LABELS[k] ?? k)}</td><td>${num(by.sheet)}</td><td>${num(by.copy)}</td><td>${num(by.save)}</td><td>${num(waysOf(by))}</td></tr>`;
    })
    .join('\n');
  // where landings came from, the most first, on a home page and on a
  // share page; a word with none is left out
  const fromRows = Object.entries(w.landingsFrom)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([from, n]) => {
      const home = w.landingsFromHome[from] ?? 0;
      return `      <tr><td>${esc(FROM_LABELS[from] ?? from)}</td><td>${num(home)}</td><td>${num(n - home)}</td><td>${num(n)}</td><td>${pct(w.landings > 0 ? n / w.landings : null)}</td></tr>`;
    })
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
    <div class="wide"><table>
      <thead><tr><th>Shared</th><th>Share sheet</th><th>Copied</th><th>Saved</th><th>All</th></tr></thead>
      <tbody>
${shareRows}
      </tbody>
    </table></div>
    <h2>Games by kind and language, last 7 days</h2>
    <div class="wide"><table>
      <thead><tr><th>Games</th>${PLAY_HEADS}</tr></thead>
      <tbody>
      <tr><td>Begun</td>${playCells(w.startsBy, w.startsByLang)}</tr>
      <tr><td>Completed</td>${playCells(w.completedBy, w.completedByLang)}</tr>
      </tbody>
    </table></div>
    <h2>Where landings came from, last 7 days</h2>
    <div class="wide"><table>
      <thead><tr><th>From</th><th>Home page</th><th>Share pages</th><th>Landings</th><th>Of all</th></tr></thead>
      <tbody>
${fromRows || '      <tr><td>No landings</td><td>0</td><td>0</td><td>0</td><td>—</td></tr>'}
      </tbody>
    </table></div>
    <h2>Every day</h2>
    <div class="wide"><table>
      <thead><tr><th>Day</th><th>Starts</th><th>Completed</th><th>Offline</th><th>In installed app</th><th>Shares</th><th>Landings</th><th>On a home page</th><th>New</th><th>Returning</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table></div>
    <h2>Games begun per day, by kind and language</h2>
    <div class="wide"><table>
      <thead><tr><th>Day</th>${PLAY_HEADS}</tr></thead>
      <tbody>
${playRows}
      </tbody>
    </table></div>
    <p class="meta">Kind and language are what a start or a solve says about itself, from the builds of November 2026 on: Daily is the daily puzzle, From a share link a puzzle or position opened from a link someone shared, Practice a practice puzzle, and New any other (a new one by band, an import, a grid typed, pasted or scanned, a Learn page's example); the language is the one the app was set to. Lines from older builds say neither and are Not recorded. Practice puzzles are counted from November 2026, at the player's own first move since they open part-way through, and are left out of Starts, Completed, Offline, In installed app, New and Returning and the numbers above, so those read as they did before.</p>
    <p class="meta">A home landing is a visit to /, /nb/ or /es/ from outside the site that the browser did not answer from the app it already holds: mostly a first visit. Landings per share counts the share pages' landings only.</p>
    <p class="meta">Today's row is the day so far. Starts are games begun, counted at the first move. Before 21 October 2026 every game opened was counted, the app's own first game included, and builds a device has not yet updated still do so for a few days after; their lines carry the version 1.0.0, the new builds' 1.0.0+ and a commit. In installed app is the completed games played from the app installed on a home screen or desktop, through the browser's Add to Home Screen or Install; it is not a count of installs. Offline is the count opted-in devices kept and sent later; New and Returning count opted-in starts only. Devices switched to "Leave this device out of the counts" send no starts or solves; a share or daily link opened in a browser or chat app where the switch is not on, even on the same phone, can still be a landing, since the server cannot see the switch. A share is a link to a puzzle, a position, a challenge or the daily's line that the share sheet took or that was copied, sent live from a device not left out; copying the puzzle as text is not one. Landings per share is not the reach of one link: a landing may come from a link shared days before, or found somewhere other than the app. Where a landing came from is the one word the referrer gave; most apps send none (on Android some name themselves), so No referrer is mostly links opened from apps. With no referrer, a link an AI assistant tagged (utm_source=chatgpt.com and the like) counts as An AI assistant. The sixth metric of the plan, search clicks, is in Search Console.</p>
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
  /** the daily's times (worker/daily.ts), for how many daily solves sent theirs */
  DB?: D1Like;
}

/** a day's daily times as they reached the database: its UTC midnight in seconds, the times, the unassisted ones */
export interface SentDay {
  day: number;
  n: number;
  unassisted: number;
}

/** the daily times sent per UTC day, the last DAYS_SHOWN days; undefined with no database, null when it fails */
export async function dailySent(db: D1Like | undefined, now: Date): Promise<SentDay[] | null | undefined> {
  if (!db) return undefined;
  const since = Math.floor(now.getTime() / 86400000) * 86400 - (DAYS_SHOWN - 1) * 86400;
  try {
    const out = await db
      .prepare('SELECT created_at AS day, COUNT(*) AS n, SUM(unassisted) AS unassisted FROM daily_result WHERE created_at >= ?1 GROUP BY created_at ORDER BY created_at')
      .bind(since)
      .all<SentDay>();
    return out.results ?? [];
  } catch {
    return null;
  }
}

/**
 * Daily solves against daily times sent, day by day: did the player who
 * solved the daily send the time (the win screen's button, or the switch
 * that sends it by itself)? The solves are the play lines of kind daily,
 * which an older app, an offline solve or a device left out of the counts
 * never sends, so the share is a guide, not a census
 */
export function dailySentTable(rows: Row[], sent: SentDay[] | null | undefined): string {
  if (sent === undefined) return '';
  if (!sent) return '<h2>Daily times sent</h2><p class="note">The database could not be read.</p>';
  const solves = new Map<string, number>();
  for (const r of rows) if (r.event === 'completed' && r.kind === 'daily') solves.set(r.day, (solves.get(r.day) ?? 0) + r.n);
  const times = new Map(sent.map((s) => [new Date(s.day * 1000).toISOString().slice(0, 10), s]));
  const days = [...new Set([...solves.keys(), ...times.keys()])].sort().reverse();
  const cell = (v: string | number) => `<td>${esc(String(v))}</td>`;
  const body = days
    .map((day) => {
      const n = solves.get(day) ?? 0;
      const t = times.get(day);
      const share = n ? `${Math.round(((t?.n ?? 0) / n) * 100)}%` : '';
      return `<tr>${cell(day)}${cell(n)}${cell(t?.n ?? 0)}${cell(t?.unassisted ?? 0)}${cell(share)}</tr>`;
    })
    .join('');
  return `<h2>Daily times sent</h2>
<p class="note">Daily solves the play lines counted, against the times that reached the database (by the button, or by the switch that sends them). A guide, not a census: an older app, an offline solve or a device left out of the counts sends no play line.</p>
<table><thead><tr><th>Day (UTC)</th><th>Daily solves</th><th>Times sent</th><th>Of them unassisted</th><th>Sent</th></tr></thead><tbody>${body || '<tr><td colspan="5">None yet</td></tr>'}</tbody></table>`;
}

// ---- Christmas: the advent calendar (docs/advent-calendar.md) ---------------------

/** a UTC day as a key, 2026-12-05 */
const utcDay = (now: Date) => now.toISOString().slice(0, 10);

/**
 * The calendar the section shows on a day: the one in season (its
 * November and December, and the January after, while its door games are
 * still being finished); outside that, the next published one (October
 * shows the coming December's), else the last one published
 */
export function adventYearOn(now: Date, years: number[] = calendarYears(advent as AdventDoor[])): number {
  const y = now.getUTCFullYear();
  // the season's own (src/content/season.ts), and the January after it
  const season = seasonYear(utcDay(now)) ?? (now.getUTCMonth() === 0 ? y - 1 : null);
  if (season !== null && years.includes(season)) return season;
  return years.find((year) => year >= (season ?? y)) ?? years.at(-1) ?? season ?? y;
}

/** where the calendar stands on the dashboard's UTC day */
export function adventPhase(year: number, now: Date): AdventPhase {
  const today = utcDay(now);
  return today < doorDate(year, 1) ? 'before' : today <= calendarEnd(year) ? 'open' : 'over';
}

/**
 * The UTC days the doors' counts are read for: from 30 November, when a
 * player a day ahead of UTC opens door 1 (the Worker's EARLY_DAYS), to 31
 * January, a month for the door games under way on 1 January
 */
export const adventCountFrom = (year: number) => `${year}-11-30`;
export const adventCountTo = (year: number) => `${year + 1}-01-31`;

/**
 * The doors' play lines and the landings on their addresses, summed per
 * UTC day, event, kind (a landing's referrer word, blob5) and door (a
 * play line's seventh blob, telemetry.ts pointOf), from the window's first
 * day to now; null outside the window, when nothing is read. Bounded as
 * the main query is: at most 63 days, and the rows of the calendar's
 * lines only, two events of 24 doors and one of the landing words a day.
 */
export function adventQuery(now: Date, year: number): string | null {
  const today = utcDay(now);
  if (today < adventCountFrom(year) || today > adventCountTo(year)) return null;
  // whole days back past the window's first midnight; the days before it are left out by adventOf
  const days = daysBetween(adventCountFrom(year), today) + 1;
  return [
    "SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, index1 AS event, blob5 AS kind, blob7 AS door,",
    'SUM(_sample_interval * double2) AS n',
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${days}' DAY`,
    "AND ((index1 = 'landing' AND blob2 = 'advent') OR ((index1 = 'started' OR index1 = 'completed') AND blob5 = 'advent'))",
    'GROUP BY day, event, kind, door ORDER BY day FORMAT JSON'
  ].join(' ');
}

/** one row of the calendar query's answer */
export interface AdventRow {
  day: string;
  event: string;
  /** a play line's kind (advent), a landing's referrer word */
  kind: string;
  /** a play line's door, '1' to '24'; '' for a landing */
  door: string;
  n: number;
}

/** the rows of the calendar query's JSON answer; anything unreadable is left out */
export function adventRowsOf(answer: unknown): AdventRow[] {
  const data = (answer as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  return data.flatMap((x): AdventRow[] => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    if (typeof r.day !== 'string' || typeof r.event !== 'string') return [];
    const n = Number(r.n);
    return [{ day: r.day.slice(0, 10), event: r.event, kind: text(r.kind), door: text(r.door), n: Number.isFinite(n) ? n : 0 }];
  });
}

/** a door's times as the database holds them: how many unassisted, and their median in seconds */
export interface DoorTimes {
  count: number;
  median: number | null;
}

/**
 * Each door's unassisted times that reached the database, and their
 * median, from the histogram the win screen reads (daily_hist, keyed by
 * the door's number, adventNo): one read on the primary key's range of
 * the year's 24 numbers, at most 481 rows a door. Undefined with no
 * database, null when it fails.
 */
export async function adventTimes(db: D1Like | undefined, year: number): Promise<Map<number, DoorTimes> | null | undefined> {
  if (!db) return undefined;
  try {
    const out = await db
      .prepare('SELECT puzzle_no, bucket, n, n_unassisted FROM daily_hist WHERE puzzle_no BETWEEN ?1 AND ?2')
      .bind(adventNo(year, 1), adventNo(year, ADVENT_DOORS))
      .all<HistogramRow & { puzzle_no: number }>();
    const byDoor = new Map<number, HistogramRow[]>();
    for (const r of out.results ?? []) {
      const door = Number(r.puzzle_no) - adventNo(year, 0);
      if (door < 1 || door > ADVENT_DOORS) continue;
      byDoor.set(door, [...(byDoor.get(door) ?? []), { bucket: Number(r.bucket), n: Number(r.n), n_unassisted: Number(r.n_unassisted) }]);
    }
    const times = new Map<number, DoorTimes>();
    for (const [door, rows] of byDoor) {
      const stats = statsFromHistogram(adventNo(year, door), rows);
      times.set(door, { count: stats.count, median: stats.median });
    }
    return times;
  } catch {
    return null;
  }
}

/** the section's numbers, from the calendar query's rows (null when it was not read) and the database's times */
export function adventOf(
  year: number,
  now: Date,
  rows: AdventRow[] | null,
  counted: AdventCounted,
  times: Map<number, DoorTimes> | null | undefined,
  published: AdventDoor[] = advent as AdventDoor[]
): AdventMetrics {
  const from = adventCountFrom(year);
  const to = adventCountTo(year);
  const started = new Map<number, number>();
  const completed = new Map<number, number>();
  const landingsFrom: Record<string, number> = {};
  let landings = 0;
  for (const r of rows ?? []) {
    if (r.day < from || r.day > to) continue;
    if (r.event === 'landing') {
      landings += r.n;
      add(landingsFrom, r.kind, r.n);
      continue;
    }
    const door = Number(r.door);
    if (r.kind !== 'advent' || !Number.isInteger(door) || door < 1 || door > ADVENT_DOORS) continue;
    if (r.event === 'started') started.set(door, (started.get(door) ?? 0) + r.n);
    else if (r.event === 'completed') completed.set(door, (completed.get(door) ?? 0) + r.n);
  }
  const doors: AdventDoorRow[] = Array.from({ length: ADVENT_DOORS }, (_, i) => {
    const door = i + 1;
    const found = findDoor(published, year, door);
    const s = started.get(door) ?? 0;
    const c = completed.get(door) ?? 0;
    const t = times ? (times.get(door) ?? { count: 0, median: null }) : null;
    return {
      door,
      date: doorDate(year, door),
      level: found?.level ?? '',
      score: found?.score ?? 0,
      started: s,
      completed: c,
      completionRate: ratio(c, s),
      times: t ? t.count : null,
      median: t ? t.median : null
    };
  });
  const sum = (f: (d: AdventDoorRow) => number) => doors.reduce((acc, d) => acc + f(d), 0);
  return {
    year,
    phase: adventPhase(year, now),
    counted,
    ...(times === undefined ? {} : { database: times !== null }),
    doors,
    started: sum((d) => d.started),
    completed: sum((d) => d.completed),
    completionRate: ratio(sum((d) => d.completed), sum((d) => d.started)),
    times: times ? sum((d) => d.times ?? 0) : null,
    landings,
    landingsFrom
  };
}

/** a time in seconds as the win screen writes it: 4:12, 1:02:03 */
const clock = (seconds: number | null) => {
  if (seconds === null) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

/** a door's day, 5 Dec */
const shortDay = (date: string) => `${Number(date.slice(8, 10))} Dec`;

/** the Christmas section: where the calendar stands, its numbers, every door, and where the door landings came from */
export function adventSection(m: AdventMetrics): string {
  const stand =
    m.phase === 'before'
      ? `The ${m.year} calendar opens on 1 December, by each player's own date: until then every door shows zeros.`
      : m.phase === 'open'
        ? `The ${m.year} calendar is open: door n opens on n December by each player's own date, and every open door stays open until 31 December.`
        : `The ${m.year} calendar closed on 31 December. A door game under way then can still be finished, and its completed line counts here until 31 January; no time is taken after 31 December.`;
  const counts =
    m.counted === 'read'
      ? `Counted from ${adventCountFrom(m.year)} to ${adventCountTo(m.year)}, UTC days, so far.`
      : m.counted === 'soon'
        ? `The counts are read from ${adventCountFrom(m.year)} (UTC), when a player a day ahead of UTC opens door 1.`
        : m.counted === 'past'
          ? `The counts were read from ${adventCountFrom(m.year)} to ${adventCountTo(m.year)} and are not read now: Analytics Engine keeps them three months. The times stay in the database.`
          : 'The analytics API could not be read for the calendar: the counts show as zeros.';
  const database = m.database === undefined ? ' No database is bound: no times.' : m.database ? '' : ' The database could not be read: no times.';
  const number = (label: string, value: string, note = '') =>
    `      <div><dt>${esc(label)}</dt><dd>${value}</dd>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  const numbers = [
    number('Door games begun', num(m.started), 'every door, counted at the first move'),
    number('Door games completed', num(m.completed)),
    number('Completion rate', pct(m.completionRate), `${num(m.completed)} completed of ${num(m.started)} begun`),
    number('Unassisted times sent', num(m.times), 'that reached the database, every door'),
    number("Landings on a door's address", num(m.landings), 'opened from outside the site, by people')
  ].join('\n');
  const rows = m.doors
    .map(
      (d) =>
        `      <tr><td>${d.door}</td><td>${esc(shortDay(d.date))}</td><td>${d.level ? `${esc(d.level)} ${d.score}` : '—'}</td><td>${num(d.started)}</td><td>${num(d.completed)}</td><td>${pct(d.completionRate)}</td><td>${num(d.times)}</td><td>${clock(d.median)}</td></tr>`
    )
    .join('\n');
  const fromRows = Object.entries(m.landingsFrom)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([from, n]) => `      <tr><td>${esc(FROM_LABELS[from] ?? from)}</td><td>${num(n)}</td><td>${pct(m.landings > 0 ? n / m.landings : null)}</td></tr>`)
    .join('\n');
  return `    <h2>Christmas: the advent calendar ${m.year}</h2>
    <p class="meta">${esc(stand)} ${esc(counts)}${esc(database)}</p>
    <dl class="numbers">
${numbers}
    </dl>
    <div class="wide"><table>
      <thead><tr><th>Door</th><th>Day</th><th>Rating</th><th>Begun</th><th>Completed</th><th>Completion</th><th>Times sent</th><th>Median time</th></tr></thead>
      <tbody>
${rows}
      <tr><td>All</td><td></td><td></td><td>${num(m.started)}</td><td>${num(m.completed)}</td><td>${pct(m.completionRate)}</td><td>${num(m.times)}</td><td></td></tr>
      </tbody>
    </table></div>
    <h2>Where the door landings came from</h2>
    <div class="wide"><table>
      <thead><tr><th>From</th><th>Landings</th><th>Of all</th></tr></thead>
      <tbody>
${fromRows || '      <tr><td>No landings</td><td>0</td><td>—</td></tr>'}
      </tbody>
    </table></div>
    <p class="meta">Begun and Completed are the door games' play lines (kind Advent calendar), each with its door, over the calendar's days; a door begun on one day and solved on another counts on each. Times sent are the unassisted times the win screen sent for each door, on its day and up to a week late, until 31 December; the median is the one the win screen shows. A landing on a door's address is a person opening /advent/${m.year}/&lt;door&gt; (or under /nb/, /es/) from outside the site; the public calendar pages, /advent/, /nb/julekalender/ and /es/calendario-de-adviento/, are files and count nothing. Nothing counts the Christmas look: no line says which theme a player uses.</p>`;
}

/**
 * The section for a request: the calendar in season, its counts read
 * through the SQL API while its window is open (a second query, which
 * failing leaves the rest of the page as it is), and its times from the
 * database
 */
export async function adventFor(env: AdminEnv, now: Date, doFetch: typeof fetch): Promise<AdventMetrics> {
  const year = adventYearOn(now);
  const sql = adventQuery(now, year);
  let rows: AdventRow[] | null = null;
  let counted: AdventCounted = utcDay(now) < adventCountFrom(year) ? 'soon' : 'past';
  if (sql) {
    try {
      const res = await doFetch(sqlApi(env.ADMIN_ACCOUNT_ID!), {
        method: 'POST',
        headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, 'content-type': 'text/plain; charset=utf-8' },
        body: sql
      });
      if (!res.ok) throw new Error(String(res.status));
      rows = adventRowsOf(JSON.parse(await res.text()));
      counted = 'read';
    } catch {
      counted = 'failed';
    }
  }
  return adventOf(year, now, rows, counted, await adventTimes(env.DB, year));
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
  const rows = rowsOf(answer);
  const christmas = adventSection(await adventFor(env, now, doFetch));
  const html = renderAdmin(metricsOf(rows, now)).replace('  </body>', `${dailySentTable(rows, await dailySent(env.DB, now))}\n${christmas}\n  </body>`);
  return request.method === 'HEAD' ? page('', 200) : page(html);
}
