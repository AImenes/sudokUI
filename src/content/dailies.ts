// The shared daily (docs/online-goals.md, phase 2): one pinned puzzle per
// calendar day, published ahead in dailies.json, the same board for
// everyone who opens the app on that day. This module holds what both the
// app and the Worker (worker/daily.ts) need to agree on: the day's key,
// the puzzle's number, the share address /daily/<date>, the shape of the
// global statistics and the arithmetic over them. It imports no data and
// nothing heavy: the app loads dailies.json only when a daily starts
// (loadDailies), the Worker bundles it.
//
// Decisions, as the document asked for them:
// - The day is the player's local date, Wordle-style, so a streak and a
//   midnight feel right wherever the player is; the number counts days
//   from DAILY_EPOCH (#1), and the server keys everything by that number,
//   so two players on opposite sides of the date line who both play
//   "2026-10-08" share one puzzle and one set of statistics.
// - The puzzles are generated once (scripts/build-dailies.ts), committed,
//   and never regenerated: a rating change later moves nothing that was
//   published. Each entry pins the band, the score and the techniques.
// - The file carries no solution, only its SHA-256, so the Worker can
//   check a submitted grid without the solution lying in cleartext (the
//   puzzle itself is public either way, as the document accepted).
// - Times go into 15-second buckets, capped at two hours, so a day's
//   histogram is at most BUCKET_MAX + 1 rows however many people play,
//   and the median and a percentile come from one bounded read.
// - Only unassisted solves count. A solve that used anything from the
//   Assist box (a hint, Check, Steps, Scan, the chain trainer, auto
//   candidates, Fill) has no time worth comparing: a run through Steps
//   takes as long as the clicks do. The win screen offers no send for
//   one and the server refuses it; the statistics read the unassisted
//   count only, which also leaves out any assisted time sent before the
//   rule.
import type { Level, Tech } from '../engine/ratings';
import type { Lang } from '../state/settings';
import { homePath } from './home';

/** one published daily */
export interface Daily {
  /** the local calendar day, 2026-10-08 */
  date: string;
  /** 81 cells, digits and dots */
  puzzle: string;
  level: Level;
  score: number;
  /** the techniques worth naming on its solve path (share.ts, techsWorthNaming) */
  techs: Tech[];
  /** SHA-256 of the 81-digit solution, lower-case hex */
  solutionHash: string;
}

/** the first published daily, #1 */
export const DAILY_EPOCH = '2026-10-07';

/** the bands a daily is drawn from, in the order the days cycle through them */
export const DAILY_BANDS: Level[] = ['Medium', 'Tricky', 'Hard'];

/** a calendar day as a key, in the player's local time: 2026-10-08 */
export function localDateKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** a key as its UTC midnight, or null for anything that is not a real date */
export function dateOfKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.toISOString().slice(0, 10) === key ? d : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** the daily's number: DAILY_EPOCH is #1; null for a day before it or no date at all */
export function dailyNumber(date: string): number | null {
  const d = dateOfKey(date);
  const epoch = dateOfKey(DAILY_EPOCH)!;
  if (!d) return null;
  const no = Math.round((d.getTime() - epoch.getTime()) / DAY_MS) + 1;
  return no >= 1 ? no : null;
}

/** the day a number stands for */
export function dailyDate(no: number): string {
  const epoch = dateOfKey(DAILY_EPOCH)!;
  return new Date(epoch.getTime() + (no - 1) * DAY_MS).toISOString().slice(0, 10);
}

/** how late a result may arrive, in days: an offline retry on the next open, up to a week on */
export const LATE_DAYS = 7;
/** how early, in days: a day the player's clock has reached before UTC has */
export const EARLY_DAYS = 1;

/** the band a day's puzzle is drawn from: the three bands in turn */
export const dailyBand = (no: number): Level => DAILY_BANDS[(no - 1) % DAILY_BANDS.length];

/** the daily for a day, out of the published list */
export const findDaily = (dailies: Daily[], date: string): Daily | undefined => dailies.find((d) => d.date === date);

// ---- the address ------------------------------------------------------------

/** the share address of a daily, in any language, with or without a trailing slash */
export const DAILY_PATH = /^\/(?:(nb|es)\/)?daily\/(\d{4}-\d{2}-\d{2})\/?$/;

/** the daily an address points at, with a challenger's time (?vs=, as share.ts reads it) if one rides along; null otherwise */
export function parseDailyUrl(url: { pathname: string; search?: string }): { lang: Lang; date: string; vs?: number } | null {
  const m = DAILY_PATH.exec(url.pathname);
  if (!m || !dateOfKey(m[2])) return null;
  const out: { lang: Lang; date: string; vs?: number } = { lang: (m[1] as Lang) ?? 'en', date: m[2] };
  const q = new URLSearchParams(url.search ?? '');
  const vs = Number(q.get('vs'));
  if (q.has('vs') && Number.isInteger(vs) && vs > 0 && vs < 24 * 3600) out.vs = vs;
  return out;
}

/** the path of a daily's address: /daily/2026-10-08, /nb/daily/2026-10-08, with a challenger's time if given */
export const dailyPath = (lang: Lang, date: string, vs?: number) => `${homePath(lang)}daily/${date}${vs ? `?vs=${vs}` : ''}`;

// ---- the statistics ---------------------------------------------------------

/** the width of a histogram bucket, in seconds */
export const BUCKET_SECONDS = 15;

/** the last bucket: everything from two hours up lands in it */
export const BUCKET_MAX = (2 * 60 * 60) / BUCKET_SECONDS;

/** the bucket a solve time falls in */
export const bucketOf = (seconds: number) => Math.min(Math.floor(Math.max(0, seconds) / BUCKET_SECONDS), BUCKET_MAX);

/** the slowest honest time for a puzzle: under this, nobody read the board */
export const minSeconds = (puzzle: string) => Math.ceil(0.4 * (puzzle.match(/[.0]/g) ?? []).length);

/** a day's results as the server keeps them: one row per 15-second bucket */
export interface HistogramRow {
  bucket: number;
  /** every result in the bucket, any assisted one sent before the server refused them included */
  n: number;
  /** of them, unassisted: the only ones the statistics count */
  n_unassisted: number;
}

/** what the API answers for a day: unassisted solves only */
export interface DailyStats {
  no: number;
  /** unassisted solves sent in */
  count: number;
  /** the middle solver's time in seconds, null until someone has played */
  median: number | null;
  /** [bucket, n] pairs, in bucket order, empty buckets left out */
  histogram: [number, number][];
}

/** the middle of a bucket, as a time */
const bucketMidpoint = (bucket: number) => bucket * BUCKET_SECONDS + BUCKET_SECONDS / 2;

/** the statistics of a day from its histogram rows (any order), over the unassisted solves only */
export function statsFromHistogram(no: number, rows: HistogramRow[]): DailyStats {
  const sorted = rows
    .filter((r) => r.n_unassisted > 0)
    .map((r) => ({ bucket: r.bucket, n: r.n_unassisted }))
    .sort((a, b) => a.bucket - b.bucket);
  const count = sorted.reduce((sum, r) => sum + r.n, 0);
  let median: number | null = null;
  if (count > 0) {
    // the bucket the middle solver sits in; its midpoint as the time
    let seen = 0;
    const half = (count + 1) / 2;
    for (const r of sorted) {
      seen += r.n;
      if (seen >= half) {
        median = Math.round(bucketMidpoint(r.bucket));
        break;
      }
    }
  }
  return { no, count, median, histogram: sorted.map((r) => [r.bucket, r.n]) };
}

/**
 * The share of the day's solvers who were slower than a time, 0 to 1:
 * everyone in later buckets, and half of those in the same bucket (the
 * player's own result, if it is in there, counts as neither)
 */
export function fasterThan(stats: DailyStats, seconds: number, own = false): number {
  const mine = bucketOf(seconds);
  let slower = 0;
  let same = 0;
  for (const [bucket, n] of stats.histogram) {
    if (bucket > mine) slower += n;
    else if (bucket === mine) same += n;
  }
  if (own && same > 0) same -= 1;
  const others = stats.count - (own ? 1 : 0);
  if (others <= 0) return 0;
  return Math.min(1, Math.max(0, (slower + same / 2) / others));
}

/** the published dailies, loaded only when one is needed (the app's bundle stays light) */
export async function loadDailies(): Promise<Daily[]> {
  try {
    return (await import('./dailies.json')).default as Daily[];
  } catch {
    // a file that cannot be fetched (a deploy moved on, a flaky network)
    // means no pinned daily today: the app falls back to deriving one
    return [];
  }
}
