/**
 * The published dailies (src/content/dailies.ts, dailies.json): one pinned
 * puzzle per calendar day from the epoch on, each a proper puzzle of its
 * band with the hash of its solution; the day's key, number and address;
 * and the arithmetic over a day's histogram that the win screen shows.
 */
import { describe, it, expect } from 'vitest';
import dailies from '../src/content/dailies.json';
import {
  Daily,
  DAILY_EPOCH,
  DAILY_BANDS,
  DAILY_PATH,
  BUCKET_MAX,
  BUCKET_SECONDS,
  bucketOf,
  dailyBand,
  dailyDate,
  dailyNumber,
  dailyPath,
  dateOfKey,
  fasterThan,
  findDaily,
  localDateKey,
  minSeconds,
  parseDailyUrl,
  statsFromHistogram
} from '../src/content/dailies';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve, countSolutions } from '../src/engine/bruteForce';
import { APP_NAVIGATION } from '../src/content/home';
import { langOfPath } from '../src/content/i18n';
import { STATIC_ROUTES } from '../src/content/staticRoutes';
import { TECHS } from '../src/engine/ratings';

const LIST = dailies as Daily[];

const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

describe('the published dailies', () => {
  it('cover every day from the epoch on, without a gap, and well ahead of today', () => {
    expect(LIST[0].date).toBe(DAILY_EPOCH);
    for (let i = 0; i < LIST.length; i++) expect(LIST[i].date, `#${i + 1}`).toBe(dailyDate(i + 1));
    const last = dailyNumber(LIST[LIST.length - 1].date)!;
    const today = dailyNumber(localDateKey()) ?? 0;
    const ahead = last - today;
    if (ahead < 60) console.warn(`dailies: only ${ahead} days published ahead; run npx vite-node scripts/build-dailies.ts <YYYY-MM-DD>`);
    // the file must never run out under a deploy: at least a month ahead
    expect(ahead).toBeGreaterThanOrEqual(30);
  });

  it('are proper puzzles of their band, with the hash of their one solution', async () => {
    for (const [i, d] of LIST.entries()) {
      const no = i + 1;
      expect(d.puzzle, d.date).toMatch(/^[1-9.]{81}$/);
      expect(DAILY_BANDS, d.date).toContain(d.level);
      expect(d.level, d.date).toBe(dailyBand(no));
      expect(d.score, d.date).toBeGreaterThan(0);
      expect(d.techs.length, d.date).toBeLessThanOrEqual(3);
      for (const t of d.techs) expect(TECHS[t], `${d.date} ${t}`).toBeDefined();
      const grid = parseGrid(d.puzzle)!;
      expect(countSolutions(grid, 2), d.date).toBe(1);
      expect(await sha256(gridToString(solve(grid)!)), d.date).toBe(d.solutionHash);
      expect(d.solutionHash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('find a day, and the number and the day are each other’s inverse', () => {
    expect(findDaily(LIST, DAILY_EPOCH)).toBe(LIST[0]);
    expect(findDaily(LIST, '2020-01-01')).toBeUndefined();
    expect(dailyNumber(DAILY_EPOCH)).toBe(1);
    expect(dailyDate(1)).toBe(DAILY_EPOCH);
    for (const no of [1, 2, 31, 100, 366, 451]) expect(dailyNumber(dailyDate(no))).toBe(no);
    expect(dailyNumber('2026-10-06')).toBeNull();
    expect(dailyNumber('2026-13-01')).toBeNull();
    expect(dailyNumber('nonsense')).toBeNull();
    expect(dateOfKey('2027-02-29')).toBeNull();
    expect(dateOfKey('2028-02-29')).not.toBeNull();
  });

  it('key a day by the local date', () => {
    expect(localDateKey(new Date(2026, 9, 8, 0, 5))).toBe('2026-10-08');
    expect(localDateKey(new Date(2026, 9, 8, 23, 55))).toBe('2026-10-08');
    expect(localDateKey(new Date(2026, 0, 1))).toBe('2026-01-01');
  });
});

describe('the daily’s address', () => {
  it('is /daily/<date> under the language root, with a challenger’s time if one rides along', () => {
    expect(dailyPath('en', '2026-10-08')).toBe('/daily/2026-10-08');
    expect(dailyPath('nb', '2026-10-08')).toBe('/nb/daily/2026-10-08');
    expect(dailyPath('es', '2026-10-08', 552)).toBe('/es/daily/2026-10-08?vs=552');
    expect(parseDailyUrl({ pathname: '/daily/2026-10-08', search: '' })).toEqual({ lang: 'en', date: '2026-10-08' });
    expect(parseDailyUrl({ pathname: '/nb/daily/2026-10-08/', search: '?vs=552' })).toEqual({ lang: 'nb', date: '2026-10-08', vs: 552 });
    expect(parseDailyUrl({ pathname: '/es/daily/2026-10-08', search: '?vs=0' })).toEqual({ lang: 'es', date: '2026-10-08' });
    for (const bad of ['/daily/', '/daily/2026-13-40', '/daily/20261008', '/de/daily/2026-10-08', '/daily-sudoku/', '/daily/2026-10-08/x'])
      expect(parseDailyUrl({ pathname: bad, search: '' }), bad).toBeNull();
  });

  it('is the app to the service worker and the language roots, and no static page', () => {
    for (const path of ['/daily/2026-10-08', '/nb/daily/2026-10-08/', '/es/daily/2026-10-08?vs=9']) {
      expect(APP_NAVIGATION.test(path), path).toBe(true);
      expect(STATIC_ROUTES.test(path), path).toBe(false);
      expect(DAILY_PATH.test(path.split('?')[0]), path).toBe(true);
    }
    expect(langOfPath('/nb/daily/2026-10-08')).toBe('nb');
    expect(langOfPath('/daily/2026-10-08')).toBeNull();
    expect(langOfPath('/nb/daily/2026-10-08/x')).toBeNull();
    // the landing page keeps its own address
    expect(STATIC_ROUTES.test('/daily-sudoku/')).toBe(true);
    expect(APP_NAVIGATION.test('/daily-sudoku/')).toBe(false);
  });
});

describe('the day’s statistics', () => {
  it('bucket a time by fifteen seconds, two hours and up together', () => {
    expect(BUCKET_SECONDS).toBe(15);
    expect(bucketOf(0)).toBe(0);
    expect(bucketOf(14)).toBe(0);
    expect(bucketOf(15)).toBe(1);
    expect(bucketOf(552)).toBe(36);
    expect(bucketOf(7200)).toBe(BUCKET_MAX);
    expect(bucketOf(86400)).toBe(BUCKET_MAX);
    expect(BUCKET_MAX).toBe(480);
  });

  it('refuse a time nobody could read the board in', () => {
    const empties = (LIST[0].puzzle.match(/\./g) ?? []).length;
    expect(minSeconds(LIST[0].puzzle)).toBe(Math.ceil(0.4 * empties));
    expect(minSeconds('1'.repeat(81))).toBe(0);
  });

  it('take the median from the histogram, and the share of slower solvers', () => {
    expect(statsFromHistogram(5, [])).toEqual({ no: 5, count: 0, median: null, histogram: [] });
    const rows = [
      { bucket: 40, n: 3, n_unassisted: 3 },
      { bucket: 36, n: 4, n_unassisted: 4 },
      { bucket: 20, n: 1, n_unassisted: 1 },
      { bucket: 99, n: 0, n_unassisted: 0 }
    ];
    const s = statsFromHistogram(5, rows);
    expect(s.count).toBe(8);
    // the middle solver (4th or 5th of 8) sits in bucket 36: its midpoint
    expect(s.median).toBe(36 * 15 + 8);
    expect(s.histogram).toEqual([
      [20, 1],
      [36, 4],
      [40, 3]
    ]);
    // a time in bucket 20 beats the three in 40 and the four in 36, and half of the one already in 20
    expect(fasterThan(s, 300)).toBe((7 + 1 / 2) / 8);
    // a time faster than everyone: every result is slower
    expect(fasterThan(s, 100)).toBe(1);
    // in bucket 36, with half of its own bucket counted as slower
    expect(fasterThan(s, 552)).toBe((3 + 4 / 2) / 8);
    // the player's own result is one of the four in bucket 36: it counts as neither
    expect(fasterThan(s, 552, true)).toBe((3 + 3 / 2) / 7);
    // slower than everyone
    expect(fasterThan(s, 7000)).toBe(0);
    // alone
    expect(fasterThan(statsFromHistogram(5, [{ bucket: 36, n: 1, n_unassisted: 1 }]), 552, true)).toBe(0);
  });

  it('count unassisted solves only, leaving out an assisted time sent before the server refused them', () => {
    // a run through Steps in bucket 39; in bucket 50, two unassisted solves and one more assisted time
    const rows = [
      { bucket: 39, n: 1, n_unassisted: 0 },
      { bucket: 50, n: 3, n_unassisted: 2 }
    ];
    expect(statsFromHistogram(3, rows)).toEqual({ no: 3, count: 2, median: 50 * 15 + 8, histogram: [[50, 2]] });
    expect(statsFromHistogram(3, rows.slice(0, 1))).toEqual({ no: 3, count: 0, median: null, histogram: [] });
  });
});
