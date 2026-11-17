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
