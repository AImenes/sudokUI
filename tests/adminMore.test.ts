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
  type MoreRow
} from '../worker/adminMore';
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
