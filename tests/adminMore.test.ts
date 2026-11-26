import { describe, expect, it } from 'vitest';
import {
  MORE_DAYS,
  HOUR_DAYS,
  TOP_COUNTRIES,
  clock,
  countriesQuery,
  hoursQuery,
  levelsQuery,
  medianSeconds,
  moreFor,
  moreOf,
  moreRowsOf,
  moreSection,
  timesQuery,
  versionsQuery,
  type MoreRow,
  LANDING_DAYS,
  landingDaysQuery,
  landingDaysOf,
  landingDaysSection,
  landingDaysFor
} from '../worker/adminMore';
import { GOAL_BY, GOAL_PER_DAY, LINE_FROM, LINE_FROM_PER_DAY, lineOn, readingLine, readingOf, readingRow, towardOf, towardSection } from '../worker/adminGoal';
import { redact, renderCheck, runChecks, runDatabaseChecks, type QueryCheck } from '../worker/adminCheck';
import { metricsOf, type Row } from '../worker/admin';
import { DATASET } from '../worker/adminModel';
import { ALONE, HELPED } from '../worker/telemetry';

const NOW = new Date('2026-11-20T10:00:00Z');
const row = (words: Record<string, string>, n: number) => ({ ...words, n }) as MoreRow;
const play = (day: string, event: string, band: string, kind: string, help: string, n: number) => row({ day: `${day} 00:00:00`, event, band, kind, help }, n);

describe("the dashboard's further tables", () => {
  it('asks five small queries of the one dataset, each weighed by the sampling', () => {
    const all = [levelsQuery(), timesQuery(), countriesQuery(), versionsQuery(), hoursQuery()];
    for (const sql of all) {
      expect(sql).toContain(`FROM ${DATASET}`);
      expect(sql).toContain('SUM(_sample_interval * double2) AS n');
      expect(sql.endsWith('FORMAT JSON')).toBe(true);
    }
    expect(levelsQuery()).toContain('blob1 AS band, blob5 AS kind, blob8 AS help');
    expect(levelsQuery()).toContain(`INTERVAL '${MORE_DAYS + 1}' DAY`);
    expect(timesQuery()).toContain("index1 = 'completed'");
    expect(countriesQuery()).toContain('blob4 AS country');
    expect(versionsQuery()).toContain("INTERVAL '7' DAY");
    expect(hoursQuery()).toContain("INTERVAL '1' HOUR");
    expect(hoursQuery()).toContain(`INTERVAL '${HOUR_DAYS}' DAY`);
  });

  it('reads an answer by its columns and leaves out what it cannot read', () => {
    const answer = { data: [{ band: 'Easy', help: '', bucket: 12, n: '3' }, { band: 'Easy', n: 1 }, null, 'x', { band: 'Hard', help: HELPED, bucket: '4', n: 'many' }] };
    expect(moreRowsOf(answer, ['band', 'help', 'bucket'])).toEqual([
      { band: 'Easy', help: '', bucket: '12', n: 3 },
      { band: 'Hard', help: HELPED, bucket: '4', n: 0 }
    ]);
    expect(moreRowsOf({ data: 'no' }, ['band'])).toEqual([]);
    expect(moreRowsOf(null, ['band'])).toEqual([]);
  });

  it('counts help by kind of game over whole days: 7 and 30 before today, today left out', () => {
    const m = moreOf(
      NOW,
      [
        // today: still coming in, left out
        play('2026-11-20', 'completed', 'Easy', 'practice', HELPED, 50),
        // yesterday, inside both windows
        play('2026-11-19', 'started', 'Easy', 'practice', '', 10),
        play('2026-11-19', 'completed', 'Easy', 'practice', HELPED, 3),
        play('2026-11-19', 'completed', 'Easy', 'practice', ALONE, 1),
        // a solve from a build that does not say: solved, but not among those that say
        play('2026-11-19', 'completed', 'Easy', 'practice', '', 2),
        // eight days back: the long window only
        play('2026-11-12', 'completed', 'Hard', 'daily', ALONE, 4),
        play('2026-11-12', 'started', 'Hard', 'daily', '', 8),
        // 31 days back: outside
        play('2026-10-20', 'completed', 'Hard', 'daily', HELPED, 9),
        // an older app's line, with no kind
        play('2026-11-18', 'completed', 'Medium', '', '', 5)
      ],
      [],
      null,
      null,
      null
    );
    const kind = (k: string) => m.kinds!.find((x) => x.kind === k)!;
    expect(kind('practice').week).toEqual({ begun: 10, solved: 6, said: 4, helped: 3 });
    expect(kind('practice').month).toEqual({ begun: 10, solved: 6, said: 4, helped: 3 });
    expect(kind('daily').week).toEqual({ begun: 0, solved: 0, said: 0, helped: 0 });
    expect(kind('daily').month).toEqual({ begun: 8, solved: 4, said: 4, helped: 0 });
    expect(kind('').month.solved).toBe(5);
    // by level, every kind together; and practice apart
    expect(m.levels!.map((l) => [l.level, l.begun, l.solved, l.said, l.helped])).toEqual([
      ['Easy', 10, 6, 4, 3],
      ['Medium', 0, 5, 0, 0],
      ['Hard', 8, 4, 4, 0],
      ['Unfair', 0, 0, 0, 0],
      ['Extreme', 0, 0, 0, 0]
    ]);
    expect(m.practice!.map((l) => [l.level, l.begun, l.solved])).toEqual([
      ['Easy', 10, 6],
      ['Medium', 0, 0],
      ['Hard', 0, 0],
      ['Unfair', 0, 0],
      ['Extreme', 0, 0]
    ]);
    const html = moreSection(m);
    expect(html).toContain('<tr><td>Practice</td><td>4</td><td>3</td><td>75%</td><td>4</td><td>3</td><td>75%</td></tr>');
    expect(html).toContain('<tr><td>Daily</td><td>0</td><td>0</td><td>—</td><td>4</td><td>0</td><td>0%</td></tr>');
    expect(html).toContain('<tr><td>All</td><td>4</td><td>3</td><td>75%</td><td>8</td><td>3</td><td>38%</td></tr>');
    // the countries, versions and hours were not read: their tables say so, and the others stand
    expect(html.match(/could not be read for this table/g)).toHaveLength(3);
  });

  it('finds the middle solve of each level, of all solves and of those without help', () => {
    expect(medianSeconds(new Map())).toBeNull();
    expect(medianSeconds(new Map([[4, 1]]))).toBe(60);
    expect(medianSeconds(new Map([[2, 1], [10, 1], [40, 3]]))).toBe(600);
    const times = [
      row({ band: 'Easy', help: ALONE, bucket: '8' }, 3),
      row({ band: 'Easy', help: HELPED, bucket: '20' }, 2),
      row({ band: 'Easy', help: '', bucket: '40' }, 4),
      row({ band: 'Hard', help: HELPED, bucket: '480' }, 1),
      // a step off the scale is left out
      row({ band: 'Hard', help: HELPED, bucket: '9000' }, 99)
    ];
    const m = moreOf(NOW, [], times, null, null, null);
    const level = (l: string) => m.levels!.find((x) => x.level === l)!;
    expect([level('Easy').median, level('Easy').medianAlone]).toEqual([300, 120]);
    expect([level('Hard').median, level('Hard').medianAlone]).toEqual([7200, null]);
    expect([level('Medium').median, level('Medium').medianAlone]).toEqual([null, null]);
    expect([clock(300), clock(125), clock(7200), clock(null)]).toEqual(['5:00', '2:05', '2:00:00+', '—']);
    const html = moreSection(m);
    expect(html).toContain('<tr><td>Easy</td><td>0</td><td>0</td><td>—</td><td>—</td><td>5:00</td><td>2:00</td></tr>');
    expect(html).toContain('<td>2:00:00+</td><td>—</td></tr>');
  });

  it('lists the countries by games begun and landings, the versions by where they ran, and the hours and weekdays in UTC', () => {
    const countries = [
      row({ country: 'NO', event: 'landing' }, 5),
      row({ country: 'NO', event: 'started' }, 20),
      row({ country: 'NO', event: 'completed' }, 10),
      row({ country: 'NO', event: 'shared' }, 2),
      row({ country: 'US', event: 'landing' }, 40),
      row({ country: '', event: 'started' }, 1),
      ...Array.from({ length: 20 }, (_, i) => row({ country: `A${String.fromCharCode(65 + i)}`, event: 'landing' }, 2))
    ];
    const versions = [row({ version: '1.4.0', source: 'pwa' }, 6), row({ version: '1.4.0', source: 'tab' }, 2), row({ version: '1.3.9', source: 'tab' }, 2)];
    // Monday 16 November 2026 at 13:00 and 14:00 UTC, Sunday 15 November at 13:00
    const hours = [row({ hour: '2026-11-16 13:00:00' }, 4), row({ hour: '2026-11-16 14:00:00' }, 1), row({ hour: '2026-11-15 13:00:00' }, 2), row({ hour: 'when' }, 9)];
    const m = moreOf(NOW, null, null, countries, versions, hours);
    expect(m.countryCount).toBe(23);
    expect(m.countries).toHaveLength(TOP_COUNTRIES);
    expect(m.countries!.slice(0, 2)).toEqual([
      { country: 'US', landings: 40, begun: 0, solved: 0 },
      { country: 'NO', landings: 5, begun: 20, solved: 10 }
    ]);
    expect(m.versions).toEqual([
      { version: '1.4.0', pwa: 6, tab: 2 },
      { version: '1.3.9', pwa: 0, tab: 2 }
    ]);
    expect(m.hours![13]).toBe(6);
    expect(m.hours![14]).toBe(1);
    expect(m.hours!.reduce((a, b) => a + b, 0)).toBe(7);
    expect(m.weekdays).toEqual([5, 0, 0, 0, 0, 0, 2]);
    const html = moreSection(m);
    expect(html).toContain('<tr><td>NO</td><td>5</td><td>20</td><td>10</td><td>50%</td></tr>');
    expect(html).toContain('of 23 in all');
    expect(html).toContain('<tr><td>1.4.0</td><td>6</td><td>2</td><td>8</td><td>80%</td></tr>');
    expect(html).toContain('<th>Mon</th><th>Tue</th>');
    expect(html).toContain('<tr><td>5</td><td>0</td><td>0</td><td>0</td><td>0</td><td>0</td><td>2</td></tr>');
    // the levels were not read: three tables say so
    expect(html.match(/could not be read for this table/g)).toHaveLength(3);
  });

  it('keeps every table when one query fails, and never puts the token on the page', async () => {
    const asked: string[] = [];
    const doFetch = (async (_url: string, init?: RequestInit) => {
      asked.push(String(init?.body));
      if (String(init?.body) === countriesQuery()) return new Response('no', { status: 500 });
      if (String(init?.body) === versionsQuery()) throw new Error('down');
      if (String(init?.body) === hoursQuery()) return new Response('not json');
      return new Response(JSON.stringify({ data: [] }));
    }) as unknown as typeof fetch;
    const m = await moreFor({ ADMIN_ACCOUNT_ID: 'acc', ADMIN_TOKEN: 'secret-token' }, NOW, doFetch, 'https://api.example/sql');
    expect(asked).toEqual([levelsQuery(), timesQuery(), countriesQuery(), versionsQuery(), hoursQuery()]);
    expect([m.kinds !== null, m.levels !== null, m.practice !== null]).toEqual([true, true, true]);
    expect([m.countries, m.versions, m.hours, m.weekdays]).toEqual([null, null, null, null]);
    const html = moreSection(m);
    expect(html.match(/could not be read for this table/g)).toHaveLength(3);
    expect(html).not.toContain('secret-token');
    expect(html).toContain('<h2>Help used in solved games</h2>');
    expect(html).toContain('<tr><td>All</td><td>0</td><td>0</td><td>—</td><td>0</td><td>0</td><td>—</td></tr>');
  });
});

describe('toward 100 a day (worker/adminGoal.ts)', () => {
  const TODAY = new Date('2026-11-25T10:00:00Z');
  const line = (day: string, event: string, source: string, kind: string, via: string, n: number): Row => ({
    day,
    event,
    source,
    kind,
    via,
    n,
    standalone: 0,
    offline: 0,
    optin: 0,
    optin_offline: 0,
    optin_returning: 0
  });
  const day = (back: number) => new Date(Date.UTC(2026, 10, 25 - back)).toISOString().slice(0, 10);
  const rows: Row[] = [];
  for (let back = 1; back <= 7; back++) {
    rows.push(
      line(day(back), 'started', 'tab', 'new', 'en', 35),
      line(day(back), 'started', 'tab', 'new', 'nb', 5),
      // practice: in the reading's kinds, out of the goal's games and of Completed
      line(day(back), 'started', 'tab', 'practice', 'en', 10),
      line(day(back), 'completed', 'tab', 'practice', 'en', 9),
      line(day(back), 'completed', 'tab', 'new', 'en', 7),
      line(day(back), 'landing', 'home', 'none', '', 80),
      line(day(back), 'landing', 'home', 'search', '', 10),
      line(day(back), 'landing', 'p', 'search', '', 1),
      // the calendar's page: the Christmas section's, not the reading's
      line(day(back), 'landing', 'calendar', 'facebook', '', 50)
    );
  }
  for (let back = 8; back <= 14; back++) rows.push(line(day(back), 'started', 'tab', 'new', 'en', 30));
  rows.push(line(day(3), 'shared', 'tab', 'daily', 'sheet', 1));
  // today so far: left out of everything
  rows.push(line(day(0), 'started', 'tab', 'new', 'en', 500));
  const days = metricsOf(rows, TODAY).days;
  const at = (d: string) => Date.parse(`${d}T00:00:00Z`) / 1000;

  it("draws the owner's line straight from 35 on 25 November to 100 on 31 January, flat outside", () => {
    expect([LINE_FROM, LINE_FROM_PER_DAY, GOAL_BY, GOAL_PER_DAY]).toEqual(['2026-11-25', 35, '2027-01-31', 100]);
    expect(lineOn('2026-11-01')).toBe(35);
    expect(lineOn('2026-11-25')).toBe(35);
    expect(lineOn('2027-01-31')).toBe(100);
    expect(lineOn('2027-03-01')).toBe(100);
    expect(lineOn('2026-12-28')).toBeCloseTo(35 + (65 * 33) / 67, 6);
  });

  it('averages the games begun over the last 7 whole days, practice out, against the 7 before and the line', () => {
    const t = towardOf(days, '2026-11-25');
    expect(t.lastDay).toBe('2026-11-24');
    expect(t.week).toBe(40);
    expect(t.previous).toBe(30);
    expect(t.change).toBe(10);
    expect(t.changeShare).toBeCloseTo(1 / 3, 6);
    expect(t.line).toBe(35);
    expect(t.againstLine).toBe(5);
    expect(t.daysLeft).toBe(67);
    expect(t.perWeek).toBeCloseTo(60 / (67 / 7), 6);
    expect(t.perWeekShare).toBeCloseTo(2.5 ** (7 / 67) - 1, 6);
    // a 7-day average for each whole day with 7 whole days behind it
    expect(t.trend).toHaveLength(24);
    expect(t.trend.at(-1)).toEqual({ day: '2026-11-24', average: 40, line: 35 });
    const html = towardSection(t, readingOf(days, '2026-11-25', []));
    expect(html).toContain('<h2>Toward 100 a day</h2>');
    expect(html).toContain('<dt>Games begun a day, last 7 days</dt><dd>40.0</dd>');
    expect(html).toContain('<dt>The 7 days before</dt><dd>30.0</dd><small>change +10.0 (+33%)</small>');
    expect(html).toContain('<small>on 2026-11-24: the week is 5.0 ahead of it</small>');
    expect(html).toContain('<dt>Rise needed</dt><dd>6.3</dd><small>67 days to 2027-01-31: +6.3 a week straight, or 10% a week compounded</small>');
    expect(html).toContain('Practice is left out');
    expect(html).toContain('<svg');
  });

  it('says when the goal is met, when its day has come, and a fall as a fall', () => {
    const met = towardOf(days.map((d) => ({ ...d, starts: 120 })), '2026-11-25');
    expect([met.perWeek, met.perWeekShare]).toEqual([null, null]);
    expect(towardSection(met, readingOf(days, '2026-11-25', null))).toContain('the goal is met');
    const late = towardOf(days, '2027-02-10');
    expect(late.daysLeft).toBe(0);
    expect(late.perWeek).toBeNull();
    const fall = towardOf(days.map((d) => ({ ...d, starts: d.day >= '2026-11-18' ? 20 : 40 })), '2026-11-25');
    expect(towardSection(fall, readingOf(days, '2026-11-25', null))).toContain('change −20.0 (−50%)');
    expect(towardSection(fall, readingOf(days, '2026-11-25', null))).toContain('the week is 15.0 behind it');
    // nothing at all: zeros, no division by nothing
    const none = towardOf(metricsOf([], TODAY).days, '2026-11-25');
    expect([none.week, none.previous, none.changeShare, none.perWeekShare]).toEqual([0, 0, null, null]);
    expect(none.perWeek).toBeCloseTo(100 / (67 / 7), 6);
  });

  it("reads the launch log's figures as 7-day averages a day, and makes them a row of its table", () => {
    const sent = [
      { day: at('2026-11-20'), n: 3 },
      { day: at('2026-11-24'), n: 4 },
      // today's and one from before the week: left out
      { day: at('2026-11-25'), n: 9 },
      { day: at('2026-11-10'), n: 50 }
    ];
    const r = readingOf(days, '2026-11-25', sent);
    expect(r).toEqual({
      date: '2026-11-25',
      completed: '7.0',
      begunByKind: 'new 40.0, practice 10.0',
      begunByLang: 'nb 5.0',
      participants: '1.0',
      landings: 'home 90.0 (none 80.0, search 10.0); share pages search 1.0',
      shares: 'daily 0.1'
    });
    expect(readingRow(r)).toBe('| 2026-11-25 |  | 7.0 | new 40.0, practice 10.0 | nb 5.0 | 1.0 | home 90.0 (none 80.0, search 10.0); share pages search 1.0 | daily 0.1 |');
    // as many cells as the launch log's Readings table has columns
    expect(readingRow(r).split('|').length - 2).toBe(8);
    expect(readingLine(r)).toContain('daily participants 1.0');
    // without a database the participants are a dash
    expect(readingOf(days, '2026-11-25', undefined).participants).toBe('—');
    expect(readingOf(metricsOf([], TODAY).days, '2026-11-25', []).begunByKind).toBe('0');
    const html = towardSection(towardOf(days, '2026-11-25'), r);
    expect(html).toContain(`data-row="${readingRow(r)}"`);
    expect(html).toContain('<button type="button" id="copy-reading"');
    expect(html).toContain('navigator.clipboard');
  });
});

describe('landings per day by word, 28 days (worker/adminMore.ts)', () => {
  const NOW_ = new Date('2026-11-25T10:00:00Z');
  const landing = (day: string, slot: string, word: string, n: number) => row({ day: `${day} 00:00:00`, slot, word }, n);

  it('asks one small query of the landings, per day, page and word', () => {
    const sql = landingDaysQuery();
    expect(LANDING_DAYS).toBe(28);
    expect(sql).toContain(`FROM ${DATASET}`);
    expect(sql).toContain('blob2 AS slot, blob5 AS word, SUM(_sample_interval * double2) AS n');
    expect(sql).toContain("INTERVAL '29' DAY AND index1 = 'landing'");
    expect(sql.endsWith('GROUP BY day, slot, word ORDER BY day FORMAT JSON')).toBe(true);
  });

  it('lays the days out by word, newest first, with the week and the four weeks summed', () => {
    const l = landingDaysOf(NOW_, [
      landing('2026-11-25', 'home', 'none', 3),
      landing('2026-11-24', 'home', 'none', 5),
      landing('2026-11-24', 'p', 'search', 2),
      landing('2026-11-24', 'calendar', 'facebook', 4),
      landing('2026-11-18', 'daily', 'reddit', 6),
      landing('2026-11-17', 'home', 'none', 1),
      landing('2026-10-28', 'home', '', 2),
      // out of the window
      landing('2026-10-27', 'home', 'none', 70)
    ])!;
    expect(l.days).toHaveLength(LANDING_DAYS + 1);
    expect(l.days[0].day).toBe('2026-11-25');
    expect(l.days.at(-1)!.day).toBe('2026-10-28');
    expect(l.words).toEqual(['none', 'reddit', 'facebook', '', 'search']);
    expect(l.week).toEqual({ none: 5, search: 2, facebook: 4, reddit: 6 });
    const html = landingDaysSection(l);
    expect(html).toContain('<h2>Landings per day by word, last 28 days</h2>');
    expect(html).toContain('<th>Day</th><th>none</th><th>reddit</th><th>facebook</th><th>unrecorded</th><th>search</th><th>On a home page</th><th>On a share page</th><th>Advent</th><th>All</th>');
    expect(html).toContain('<tr class="today"><td>2026-11-25</td><td>3</td><td>0</td><td>0</td><td>0</td><td>0</td><td>3</td><td>0</td><td>0</td><td>3</td></tr>');
    expect(html).toContain('<tr><td>2026-11-24</td><td>5</td><td>0</td><td>4</td><td>0</td><td>2</td><td>5</td><td>2</td><td>4</td><td>11</td></tr>');
    expect(html).toContain('<tr><td>Last 7 days</td><td>5</td><td>6</td><td>4</td><td>0</td><td>2</td><td>5</td><td>8</td><td>4</td><td>17</td></tr>');
    expect(html).toContain('<tr><td>28 days</td><td>6</td><td>6</td><td>4</td><td>2</td><td>2</td><td>8</td><td>8</td><td>4</td><td>20</td></tr>');
    expect(landingDaysOf(NOW_, null)).toBeNull();
    expect(landingDaysSection(null)).toContain('could not be read for this table');
  });

  it('runs its query with the token and says so when it fails', async () => {
    const asked: RequestInit[] = [];
    const ok = (async (_u: string, init?: RequestInit) => {
      asked.push(init!);
      return new Response(JSON.stringify({ data: [{ day: '2026-11-24 00:00:00', slot: 'home', word: 'ai', n: '2' }] }));
    }) as unknown as typeof fetch;
    const l = await landingDaysFor({ ADMIN_TOKEN: 'secret-token' }, NOW_, ok, 'https://api.example/sql');
    expect(asked[0].body).toBe(landingDaysQuery());
    expect((asked[0].headers as Record<string, string>).authorization).toBe('Bearer secret-token');
    expect(l!.days[1].byWord).toEqual({ ai: 2 });
    const down = (async () => new Response('busy', { status: 503 })) as unknown as typeof fetch;
    expect(await landingDaysFor({ ADMIN_TOKEN: 'x' }, NOW_, down, 'https://api.example/sql')).toBeNull();
    const broken = (async () => {
      throw new Error('gone');
    }) as unknown as typeof fetch;
    expect(await landingDaysFor({ ADMIN_TOKEN: 'x' }, NOW_, broken, 'https://api.example/sql')).toBeNull();
  });
});

describe('the query check (worker/adminCheck.ts)', () => {
  const checks: QueryCheck[] = [
    { name: 'Good', sql: 'SELECT good', kept: (a) => moreRowsOf(a, ['day']).length },
    { name: 'Short', sql: 'SELECT short', kept: (a) => moreRowsOf(a, ['day', 'word']).length, note: 'over 30 days' },
    { name: 'Refused', sql: 'SELECT refused', kept: () => 0 },
    { name: 'Plain refusal', sql: 'SELECT plain', kept: () => 0 },
    { name: 'Not JSON', sql: 'SELECT text', kept: () => 0 },
    { name: 'No data', sql: 'SELECT nodata', kept: () => 0 },
    { name: 'Unreachable', sql: 'SELECT down', kept: () => 0 },
    { name: 'Empty', sql: 'SELECT empty', kept: () => 0 }
  ];
  const fake = (async (_u: string, init?: RequestInit) => {
    const sql = String(init?.body);
    if (sql === 'SELECT good') return new Response(JSON.stringify({ meta: [{ name: 'day', type: 'DateTime' }, { name: 'n', type: 'Float64' }], data: [{ day: '2026-11-24 00:00:00', n: 3 }, { day: '2026-11-23 00:00:00', n: 1 }], rows: 2 }));
    if (sql === 'SELECT short') return new Response(JSON.stringify({ data: [{ day: '2026-11-24', word: 'none', n: 1 }, { day: '2026-11-24', n: 1 }] }));
    if (sql === 'SELECT refused') return new Response(JSON.stringify({ errors: [{ message: 'unknown column blob9 for account acc0unt and token s3cret' }] }), { status: 422 });
    if (sql === 'SELECT plain') return new Response('cannot parse the query near acc0unt', { status: 400 });
    if (sql === 'SELECT text') return new Response('<html>');
    if (sql === 'SELECT nodata') return new Response(JSON.stringify({ result: 1 }));
    if (sql === 'SELECT down') throw new Error('network down');
    return new Response(JSON.stringify({ meta: [], data: [] }));
  }) as unknown as typeof fetch;

  it('runs each query in turn and says whether it was accepted, how many rows came back and how many the page reads', async () => {
    const asked: string[] = [];
    const spy = (async (u: string, init?: RequestInit) => {
      asked.push(String(init?.body));
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer s3cret');
      expect(init?.method).toBe('POST');
      return fake(u, init);
    }) as unknown as typeof fetch;
    let t = 0;
    const results = await runChecks(checks, spy, 'https://api.example/sql', 's3cret', ['s3cret', 'acc0unt'], () => (t += 5));
    expect(asked).toEqual(checks.map((c) => c.sql));
    const by = Object.fromEntries(results.map((r) => [r.name, r]));
    expect(by.Good).toMatchObject({ status: 200, accepted: true, rows: 2, kept: 2, columns: ['day DateTime', 'n Float64'], error: '', ms: 5 });
    expect(by.Good.first).toBe('{"day":"2026-11-24 00:00:00","n":3}');
    expect(by.Short).toMatchObject({ accepted: true, rows: 2, kept: 1, note: 'over 30 days' });
    expect(by.Refused).toMatchObject({ status: 422, accepted: false, rows: null, kept: null, error: 'unknown column blob9 for account [secret] and token [secret]' });
    expect(by['Plain refusal'].error).toBe('cannot parse the query near [secret]');
    expect(by['Not JSON']).toMatchObject({ status: 200, accepted: false });
    expect(by['Not JSON'].error).toContain('not JSON');
    expect(by['No data'].error).toContain('no data');
    expect(by.Unreachable).toMatchObject({ status: 0, accepted: false });
    expect(by.Unreachable.error).toContain('network down');
    expect(by.Empty).toMatchObject({ accepted: true, rows: 0, kept: 0, first: '' });
    const html = renderCheck(results, null, '2026-11-25 10:00 UTC', 'body{}');
    expect(html).toContain("<p>3 of 8 accepted; 1 with rows the page's reader leaves out.</p>");
    expect(html).toContain('<tr><td>Good</td><td>Accepted</td><td>200</td><td>2</td><td>2</td><td>5 ms</td></tr>');
    expect(html).toContain('<tr><td>Short</td><td>Accepted, rows not all read</td><td>200</td><td>2</td><td>1</td>');
    expect(html).toContain('<tr><td>Refused</td><td>Refused</td><td>422</td><td>—</td><td>—</td>');
    expect(html).toContain('<tr><td>Unreachable</td><td>Refused</td><td>—</td>');
    expect(html).toContain('<pre>SELECT good</pre>');
    expect(html).toContain('No rows: the query is accepted');
    expect(html).toContain('No database is bound');
    expect(html).not.toContain('s3cret');
    expect(html).not.toContain('acc0unt');
  });

  it('takes the secrets out of any text and cuts it short', () => {
    expect(redact('a s3cret b s3cret', ['s3cret', undefined, ''])).toBe('a [secret] b [secret]');
    expect(redact('x'.repeat(700), [])).toHaveLength(601);
  });

  it("checks the database's reads beside the queries", async () => {
    const out = await runDatabaseChecks([
      { name: 'Reads', run: async () => ({ ok: true, rows: 4 }) },
      { name: 'Fails', run: async () => ({ ok: false, error: 'The read failed.' }) },
      {
        name: 'Throws',
        run: async () => {
          throw new Error('no table');
        }
      }
    ]);
    expect(out).toEqual([
      { name: 'Reads', ok: true, rows: 4, error: '' },
      { name: 'Fails', ok: false, rows: null, error: 'The read failed.' },
      { name: 'Throws', ok: false, rows: null, error: 'Error: no table' }
    ]);
    const html = renderCheck([], out, 'now', '');
    expect(html).toContain('<tr><td>Reads</td><td>Read</td><td>4</td><td></td></tr>');
    expect(html).toContain('<tr><td>Throws</td><td>Failed</td><td>—</td><td>Error: no table</td></tr>');
  });
});
