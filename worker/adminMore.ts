/**
 * More of the dashboard (admin.ts), added on 17 November 2026 at the
 * owner's asking: how many solves took help (by kind of game, practice
 * among them), the levels (begun, solved, completion, help, the median
 * time), practice by level, the countries, the app's versions, and the
 * hours and weekdays games begin.
 *
 * Only "help used" needed something new from the app: a solve's line now
 * says yes or no (telemetry.ts, HELPED and ALONE in the eighth blob). The
 * rest is read from what the lines already carried. Nothing here names a
 * player, as on the rest of the page.
 *
 * Each table has its own small query, and a query that fails leaves its
 * tables saying so: the page above them never waits on these.
 */
import { LEVELS, type Level } from '../src/engine/ratings';
import { BUCKET_MAX, BUCKET_SECONDS } from '../src/content/dailies';
import { DATASET } from './adminModel';
import { ALONE, HELPED, PLAY_KINDS, type PlayKind } from './telemetry';

/** the long window of these tables, in whole UTC days before today; the short one is 7 */
export const MORE_DAYS = 30;
/** the days the hours and weekdays are read over */
export const HOUR_DAYS = 14;
/** how many countries and versions are listed */
export const TOP_COUNTRIES = 15;
export const TOP_VERSIONS = 10;

const PLAYS = "(index1 = 'started' OR index1 = 'completed')";
const N = 'SUM(_sample_interval * double2) AS n';

/** starts and solves per UTC day, level, kind of game and what a solve said about help */
export const levelsQuery = () =>
  [
    `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, index1 AS event, blob1 AS band, blob5 AS kind, blob8 AS help, ${N}`,
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${MORE_DAYS + 1}' DAY AND ${PLAYS}`,
    'GROUP BY day, event, band, kind, help ORDER BY day FORMAT JSON'
  ].join(' ');

/** solves per level, help and 15-second step of the time, for the medians */
export const timesQuery = () =>
  [
    `SELECT blob1 AS band, blob8 AS help, double1 AS bucket, ${N}`,
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${MORE_DAYS}' DAY AND index1 = 'completed'`,
    'GROUP BY band, help, bucket FORMAT JSON'
  ].join(' ');

/** landings, starts and solves per country */
export const countriesQuery = () =>
  [`SELECT blob4 AS country, index1 AS event, ${N}`, `FROM ${DATASET}`, `WHERE timestamp > NOW() - INTERVAL '${MORE_DAYS}' DAY`, 'GROUP BY country, event FORMAT JSON'].join(' ');

/** starts and solves per version of the app and where it ran */
export const versionsQuery = () =>
  [`SELECT blob3 AS version, blob2 AS source, ${N}`, `FROM ${DATASET}`, `WHERE timestamp > NOW() - INTERVAL '7' DAY AND ${PLAYS}`, 'GROUP BY version, source FORMAT JSON'].join(' ');

/** starts per UTC hour */
export const hoursQuery = () =>
  [
    `SELECT toStartOfInterval(timestamp, INTERVAL '1' HOUR) AS hour, ${N}`,
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${HOUR_DAYS}' DAY AND index1 = 'started'`,
    'GROUP BY hour ORDER BY hour FORMAT JSON'
  ].join(' ');

/** one row of an answer: its words and its count */
export type MoreRow = Record<string, string> & { n: number };

/** the rows of a query's JSON answer with the columns named; a row missing one is left out, and so is anything unreadable */
export function moreRowsOf(answer: unknown, columns: string[]): MoreRow[] {
  const data = (answer as { data?: unknown })?.data;
  if (!Array.isArray(data)) return [];
  return data.flatMap((x): MoreRow[] => {
    if (!x || typeof x !== 'object') return [];
    const r = x as Record<string, unknown>;
    const row: Record<string, string> = {};
    for (const c of columns) {
      const v = r[c];
      if (typeof v !== 'string' && typeof v !== 'number') return [];
      row[c] = String(v);
    }
    const n = Number(r.n);
    return [Object.assign(row, { n: Number.isFinite(n) ? n : 0 }) as MoreRow];
  });
}

/** begun, solved, and of the solves the ones that said whether help was used, and that it was */
export interface Plays {
  begun: number;
  solved: number;
  said: number;
  helped: number;
}

const noPlays = (): Plays => ({ begun: 0, solved: 0, said: 0, helped: 0 });

export interface LevelRow extends Plays {
  level: Level;
  /** the median solve time in seconds, of all solves and of those that said no help was used; null without one */
  median: number | null;
  medianAlone: number | null;
}

export interface MoreMetrics {
  /** per kind of game, the 7 and the MORE_DAYS days before today; null when the query failed */
  kinds: { kind: PlayKind | ''; week: Plays; month: Plays }[] | null;
  /** every kind together, per level, MORE_DAYS days */
  levels: LevelRow[] | null;
  /** practice alone, per level, MORE_DAYS days */
  practice: (Plays & { level: Level })[] | null;
  countries: { country: string; landings: number; begun: number; solved: number }[] | null;
  /** how many countries had a landing or a game in all */
  countryCount: number;
  versions: { version: string; pwa: number; tab: number }[] | null;
  /** games begun per UTC hour of the day (24) and per weekday, Monday first (7) */
  hours: number[] | null;
  weekdays: number[] | null;
}

/** the UTC day `back` days before `now`'s */
const dayBefore = (now: Date, back: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back)).toISOString().slice(0, 10);

function add(p: Plays, r: MoreRow): void {
  if (r.event === 'started') p.begun += r.n;
  else if (r.event === 'completed') {
    p.solved += r.n;
    if (r.help === HELPED || r.help === ALONE) p.said += r.n;
    if (r.help === HELPED) p.helped += r.n;
  }
}

/** the middle solve's time in seconds, from counts per 15-second step; null without a solve */
export function medianSeconds(steps: Map<number, number>): number | null {
  const total = [...steps.values()].reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  let seen = 0;
  for (const bucket of [...steps.keys()].sort((a, b) => a - b)) {
    seen += steps.get(bucket)!;
    if (seen * 2 >= total) return bucket * BUCKET_SECONDS;
  }
  return null;
}

/** the tables' numbers from the five answers' rows; a null answer leaves its tables null */
export function moreOf(
  now: Date,
  levelRows: MoreRow[] | null,
  timeRows: MoreRow[] | null,
  countryRows: MoreRow[] | null,
  versionRows: MoreRow[] | null,
  hourRows: MoreRow[] | null
): MoreMetrics {
  const today = dayBefore(now, 0);
  const weekFrom = dayBefore(now, 7);
  const monthFrom = dayBefore(now, MORE_DAYS);

  let kinds: MoreMetrics['kinds'] = null;
  let levels: MoreMetrics['levels'] = null;
  let practice: MoreMetrics['practice'] = null;
  if (levelRows) {
    const byKind = new Map<string, { week: Plays; month: Plays }>([...PLAY_KINDS, ''].map((k) => [k, { week: noPlays(), month: noPlays() }]));
    const byLevel = new Map<string, Plays>(LEVELS.map((l) => [l, noPlays()]));
    const practiceBy = new Map<string, Plays>(LEVELS.map((l) => [l, noPlays()]));
    for (const r of levelRows) {
      const day = r.day.slice(0, 10);
      // whole days only: today's are still coming in
      if (day >= today || day < monthFrom) continue;
      const k = byKind.get(r.kind) ?? byKind.get('')!;
      add(k.month, r);
      if (day >= weekFrom) add(k.week, r);
      const l = byLevel.get(r.band);
      if (l) add(l, r);
      const p = r.kind === 'practice' ? practiceBy.get(r.band) : undefined;
      if (p) add(p, r);
    }
    kinds = [...byKind].map(([kind, v]) => ({ kind: kind as PlayKind | '', ...v }));
    const steps = (help: (h: string) => boolean, level: string) => {
      const m = new Map<number, number>();
      for (const r of timeRows ?? []) {
        const b = Number(r.bucket);
        if (r.band === level && help(r.help) && Number.isInteger(b) && b >= 0 && b <= BUCKET_MAX) m.set(b, (m.get(b) ?? 0) + r.n);
      }
      return m;
    };
    levels = LEVELS.map((level) => ({
      level,
      ...byLevel.get(level)!,
      median: timeRows ? medianSeconds(steps(() => true, level)) : null,
      medianAlone: timeRows ? medianSeconds(steps((h) => h === ALONE, level)) : null
    }));
    practice = LEVELS.map((level) => ({ level, ...practiceBy.get(level)! }));
  }

  let countries: MoreMetrics['countries'] = null;
  let countryCount = 0;
  if (countryRows) {
    const by = new Map<string, { country: string; landings: number; begun: number; solved: number }>();
    for (const r of countryRows) {
      const c = by.get(r.country) ?? { country: r.country, landings: 0, begun: 0, solved: 0 };
      if (r.event === 'landing') c.landings += r.n;
      else if (r.event === 'started') c.begun += r.n;
      else if (r.event === 'completed') c.solved += r.n;
      by.set(r.country, c);
    }
    const all = [...by.values()].filter((c) => c.landings + c.begun + c.solved > 0);
    countryCount = all.length;
    countries = all.sort((a, b) => b.begun + b.landings - (a.begun + a.landings) || a.country.localeCompare(b.country)).slice(0, TOP_COUNTRIES);
  }

  let versions: MoreMetrics['versions'] = null;
  if (versionRows) {
    const by = new Map<string, { version: string; pwa: number; tab: number }>();
    for (const r of versionRows) {
      const v = by.get(r.version) ?? { version: r.version, pwa: 0, tab: 0 };
      if (r.source === 'pwa') v.pwa += r.n;
      else v.tab += r.n;
      by.set(r.version, v);
    }
    versions = [...by.values()].sort((a, b) => b.pwa + b.tab - (a.pwa + a.tab) || a.version.localeCompare(b.version)).slice(0, TOP_VERSIONS);
  }

  let hours: number[] | null = null;
  let weekdays: number[] | null = null;
  if (hourRows) {
    hours = Array.from({ length: 24 }, () => 0);
    weekdays = Array.from({ length: 7 }, () => 0);
    for (const r of hourRows) {
      // "2026-11-16 13:00:00", UTC
      const at = new Date(r.hour.slice(0, 10) + 'T' + r.hour.slice(11, 13) + ':00:00Z');
      if (Number.isNaN(at.getTime())) continue;
      hours[at.getUTCHours()] += r.n;
      weekdays[(at.getUTCDay() + 6) % 7] += r.n;
    }
  }
  return { kinds, levels, practice, countries, countryCount, versions, hours, weekdays };
}

// ---- the tables ---------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (n: number) => Math.round(n).toLocaleString('en-GB');
const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');
/** 754 as 12:34, and the last step as two hours and up */
export const clock = (seconds: number | null) =>
  seconds === null
    ? '—'
    : seconds >= BUCKET_MAX * BUCKET_SECONDS
      ? '2:00:00+'
      : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

const KIND_LABELS: Record<PlayKind | '', string> = {
  daily: 'Daily',
  new: 'New',
  shared: 'From a share link',
  practice: 'Practice',
  advent: 'Advent calendar',
  '': 'Not recorded'
};
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const failed = '<p class="meta">The analytics API could not be read for this table.</p>';
const table = (head: string[], rows: string[]) =>
  `<div class="wide"><table>\n      <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>\n      <tbody>\n${rows.join('\n')}\n      </tbody>\n    </table></div>`;
const tr = (cells: (string | number)[]) => `      <tr>${cells.map((c) => `<td>${typeof c === 'number' ? num(c) : esc(c)}</td>`).join('')}</tr>`;
const helpCells = (p: Plays) => [p.said, p.helped, share(p.helped, p.said)];

/** the tables, as HTML to go before the page's closing tag */
export function moreSection(m: MoreMetrics): string {
  const parts: string[] = [];

  parts.push('    <h2>Help used in solved games</h2>');
  if (!m.kinds) parts.push(failed);
  else {
    const sum = (pick: (k: { week: Plays; month: Plays }) => Plays) =>
      m.kinds!.reduce((a, k) => {
        const p = pick(k);
        return { begun: a.begun + p.begun, solved: a.solved + p.solved, said: a.said + p.said, helped: a.helped + p.helped };
      }, noPlays());
    const rows = m.kinds
      .filter((k) => k.kind !== '' || k.month.solved > 0)
      .map((k) => tr([KIND_LABELS[k.kind], ...helpCells(k.week), ...helpCells(k.month)]));
    rows.push(tr(['All', ...helpCells(sum((k) => k.week)), ...helpCells(sum((k) => k.month))]));
    parts.push(table(['Kind of game', 'Solved, 7 days', 'With help', 'Share', `Solved, ${MORE_DAYS} days`, 'With help', 'Share'], rows));
    parts.push(
      `    <p class="meta">Whole UTC days before today. Solved counts the solves that say whether help was used: the builds from 17 November 2026 on, so the first days hold fewer than the tables above. Help is anything in the Assist box (a hint, Check, Steps, Scan, Chain, Auto or Fill candidates) or a solution path looked at; a solve says only yes or no.</p>`
    );
  }

  parts.push(`    <h2>By level, last ${MORE_DAYS} days</h2>`);
  if (!m.levels) parts.push(failed);
  else {
    parts.push(
      table(
        ['Level', 'Begun', 'Solved', 'Completion', 'With help', 'Median time', 'Median time, no help'],
        m.levels.map((l) => tr([l.level, l.begun, l.solved, share(l.solved, l.begun), share(l.helped, l.said), clock(l.median), clock(l.medianAlone)]))
      )
    );
    parts.push(
      '    <p class="meta">Every kind of game together. With help is of the solves that say. A time is the middle solve&rsquo;s, in 15-second steps, today&rsquo;s solves included; the clock stops while the app is hidden or paused.</p>'
    );
  }

  parts.push(`    <h2>Practice by level, last ${MORE_DAYS} days</h2>`);
  if (!m.practice) parts.push(failed);
  else {
    parts.push(
      table(
        ['Level', 'Begun', 'Solved', 'Completion', 'Solves that say', 'With help', 'Share'],
        m.practice.map((l) => tr([l.level, l.begun, l.solved, share(l.solved, l.begun), ...helpCells(l)]))
      )
    );
    parts.push('    <p class="meta">A practice puzzle is one chosen to practise a technique; which technique is not sent, only the puzzle&rsquo;s level.</p>');
  }

  parts.push(`    <h2>Countries, last ${MORE_DAYS} days</h2>`);
  if (!m.countries) parts.push(failed);
  else {
    parts.push(
      table(
        ['Country', 'Landings', 'Begun', 'Solved', 'Completion'],
        m.countries.length ? m.countries.map((c) => tr([c.country || 'Unknown', c.landings, c.begun, c.solved, share(c.solved, c.begun)])) : [tr(['None yet', 0, 0, 0, '—'])]
      )
    );
    parts.push(
      `    <p class="meta">The ${TOP_COUNTRIES} with the most games begun and landings, of ${num(m.countryCount)} in all. The country is the one the connection came from, as Cloudflare reports it (two letters; XX is unknown, T1 is Tor).</p>`
    );
  }

  parts.push('    <h2>App versions, last 7 days</h2>');
  if (!m.versions) parts.push(failed);
  else {
    const all = m.versions.reduce((a, v) => a + v.pwa + v.tab, 0);
    parts.push(
      table(
        ['Version', 'Installed app', 'Browser tab', 'All', 'Of these'],
        m.versions.length ? m.versions.map((v) => tr([v.version, v.pwa, v.tab, v.pwa + v.tab, share(v.pwa + v.tab, all)])) : [tr(['None yet', 0, 0, 0, '—'])]
      )
    );
    parts.push('    <p class="meta">Starts and solves by the build that sent them: how fast an update reaches the devices that play.</p>');
  }

  parts.push(`    <h2>When games begin, last ${HOUR_DAYS} days</h2>`);
  if (!m.hours || !m.weekdays) parts.push(failed);
  else {
    parts.push(table(Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0')), [tr(m.hours)]));
    parts.push(table(WEEKDAYS, [tr(m.weekdays)]));
    parts.push('    <p class="meta">Games begun by hour of the day and by weekday, both in UTC: Oslo is one hour ahead in winter and two in summer.</p>');
  }
  return parts.join('\n');
}

/** what the section needs of the admin's environment */
export interface MoreEnv {
  ADMIN_ACCOUNT_ID?: string;
  ADMIN_TOKEN?: string;
}

/** runs the five queries side by side; one that fails is null */
export async function moreFor(env: MoreEnv, now: Date, doFetch: typeof fetch, api: string): Promise<MoreMetrics> {
  const ask = async (sql: string, columns: string[]): Promise<MoreRow[] | null> => {
    try {
      const res = await doFetch(api, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, 'content-type': 'text/plain; charset=utf-8' },
        body: sql
      });
      if (!res.ok) return null;
      return moreRowsOf(JSON.parse(await res.text()), columns);
    } catch {
      return null;
    }
  };
  const [levels, times, countries, versions, hours] = await Promise.all([
    ask(levelsQuery(), ['day', 'event', 'band', 'kind', 'help']),
    ask(timesQuery(), ['band', 'help', 'bucket']),
    ask(countriesQuery(), ['country', 'event']),
    ask(versionsQuery(), ['version', 'source']),
    ask(hoursQuery(), ['hour'])
  ]);
  return moreOf(now, levels, times, countries, versions, hours);
}

// ---- landings per day by word (25 November 2026) ----------------------------------

/**
 * How many whole UTC days the landings-by-word table goes back: four
 * weeks, so a launch judged at day 14 (docs/launch-log.md) is still on the
 * page with the two weeks before it, where the 7-day table above has
 * rolled it off
 */
export const LANDING_DAYS = 28;

/** landings per UTC day, page (blob2: home, p, daily, advent, calendar) and the word their referrer or their tag gave (blob5, telemetry.ts landingWord) */
export const landingDaysQuery = () =>
  [
    `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, blob2 AS slot, blob5 AS word, ${N}`,
    `FROM ${DATASET}`,
    `WHERE timestamp > NOW() - INTERVAL '${LANDING_DAYS + 1}' DAY AND index1 = 'landing'`,
    'GROUP BY day, slot, word ORDER BY day FORMAT JSON'
  ].join(' ');

/** the columns the table reads of the query's answer */
export const LANDING_DAY_COLUMNS = ['day', 'slot', 'word'];

/** one day's landings: by word, and by where they landed */
export interface LandingDay {
  day: string;
  byWord: Record<string, number>;
  home: number;
  /** a share page: /p/, a daily's address */
  shared: number;
  /** the calendar's page and a door's address */
  advent: number;
  all: number;
}

export interface LandingDays {
  /** today and the LANDING_DAYS whole days before it, newest first */
  days: LandingDay[];
  /** the words that had a landing, the most first over the LANDING_DAYS days */
  words: string[];
  /** the last 7 whole days and the LANDING_DAYS whole days, by word, and in all */
  week: Record<string, number>;
  month: Record<string, number>;
}

const plus = (counts: Record<string, number>, key: string, n: number) => {
  counts[key] = (counts[key] ?? 0) + n;
};

/** the table's numbers from the answer's rows; null when the query failed */
export function landingDaysOf(now: Date, rows: MoreRow[] | null): LandingDays | null {
  if (!rows) return null;
  const keys = Array.from({ length: LANDING_DAYS + 1 }, (_, i) => dayBefore(now, i));
  const by = new Map(keys.map((day): [string, LandingDay] => [day, { day, byWord: {}, home: 0, shared: 0, advent: 0, all: 0 }]));
  for (const r of rows) {
    const d = by.get(r.day.slice(0, 10));
    if (!d) continue;
    plus(d.byWord, r.word, r.n);
    d.all += r.n;
    if (r.slot === 'home') d.home += r.n;
    else if (r.slot === 'advent' || r.slot === 'calendar') d.advent += r.n;
    else d.shared += r.n;
  }
  const days = keys.map((k) => by.get(k)!);
  const week: Record<string, number> = {};
  const month: Record<string, number> = {};
  days.slice(1).forEach((d, i) => {
    for (const [w, n] of Object.entries(d.byWord)) {
      plus(month, w, n);
      if (i < 7) plus(week, w, n);
    }
  });
  const today = days[0];
  const words = [...new Set([...Object.keys(month), ...Object.keys(today.byWord)])]
    .filter((w) => (month[w] ?? 0) + (today.byWord[w] ?? 0) > 0)
    .sort((a, b) => (month[b] ?? 0) - (month[a] ?? 0) || a.localeCompare(b));
  return { days, words, week, month };
}

/** the table, as HTML */
export function landingDaysSection(l: LandingDays | null): string {
  const head = `    <h2>Landings per day by word, last ${LANDING_DAYS} days</h2>`;
  if (!l) return `${head}\n${failed}`;
  const label = (w: string) => w || 'unrecorded';
  const sumOf = (counts: Record<string, number>) => Object.values(counts).reduce((a, b) => a + b, 0);
  const total = (days: LandingDay[], f: (d: LandingDay) => number) => days.reduce((a, d) => a + f(d), 0);
  const whole = l.days.slice(1);
  const rows = l.days.map((d, i) =>
    tr([d.day, ...l.words.map((w) => d.byWord[w] ?? 0), d.home, d.shared, d.advent, d.all]).replace('<tr>', i === 0 ? '<tr class="today">' : '<tr>')
  );
  rows.push(tr(['Last 7 days', ...l.words.map((w) => l.week[w] ?? 0), total(whole.slice(0, 7), (d) => d.home), total(whole.slice(0, 7), (d) => d.shared), total(whole.slice(0, 7), (d) => d.advent), sumOf(l.week)]));
  rows.push(tr([`${LANDING_DAYS} days`, ...l.words.map((w) => l.month[w] ?? 0), total(whole, (d) => d.home), total(whole, (d) => d.shared), total(whole, (d) => d.advent), sumOf(l.month)]));
  return [
    head,
    table(['Day', ...l.words.map(label), 'On a home page', 'On a share page', 'Advent', 'All'], rows),
    `    <p class="meta">Every landing, by the word its referrer gave, or with no referrer its link's tag (poster for the QR code on a poster or a flyer, chat for a link posted in a chat; the words of the launch log, docs/launch-log.md), and by where it landed: a home page, a share page (a /p/ link or a daily's address), or the advent calendar (its page or a door's address). The 7-day table above leaves only the calendar's page to the Christmas section; it counts a door's address with the share pages. Newest first; today's row is the day so far, and the two totals leave it out. A launch's word is still here at day 14 with the two weeks before it. Unrecorded is a landing counted before the word was kept.</p>`
  ].join('\n');
}

/** runs the table's query; a query that fails leaves the table saying so */
export async function landingDaysFor(env: MoreEnv, now: Date, doFetch: typeof fetch, api: string): Promise<LandingDays | null> {
  try {
    const res = await doFetch(api, {
      method: 'POST',
      headers: { authorization: `Bearer ${env.ADMIN_TOKEN}`, 'content-type': 'text/plain; charset=utf-8' },
      body: landingDaysQuery()
    });
    if (!res.ok) return null;
    return landingDaysOf(now, moreRowsOf(JSON.parse(await res.text()), LANDING_DAY_COLUMNS));
  } catch {
    return null;
  }
}
