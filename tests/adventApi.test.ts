/**
 * The advent calendar in the Worker (worker/daily.ts, worker/index.ts,
 * worker/telemetry.ts): a door's time on the daily's own tables, under the
 * door's number, taken on its day (with the daily's day of grace ahead)
 * and up to LATE_DAYS behind, never after 31 December (each with the day
 * of grace behind for a player west of UTC), and refused when
 * the door's day has not come, when it is too late, when the grid is not
 * its solution or when the solve had help; a door's address answered with
 * the app and a preview that names the door and its rating, or, for a
 * door not yet open, the day it opens and no puzzle; a landing on it
 * counted as `advent`; and a door's play line, with its door, checked
 * against the closed lists.
 */
import { describe, it, expect } from 'vitest';
import advent from '../src/content/advent.json';
import dailies from '../src/content/dailies.json';
import { AdventDoor, adventNo, doorDate } from '../src/content/advent';
import { Daily, dailyNumber } from '../src/content/dailies';
import { handleDailyApi, memoryStore, checkResult, EARLY_DAYS, LATE_DAYS, BEHIND_DAYS } from '../worker/daily';
import { doorCounts } from '../src/content/season';
import { handleRequest, Env } from '../worker/index';
import { checkEvent, checkBatch, pointOf, fold, memoryEvents, PLAY_KINDS, LANDING_SLOTS } from '../worker/telemetry';
import template from '../index.html?raw';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';

const DOORS = advent as AdventDoor[];
const DOOR = DOORS[4];
const NO = adventNo(2026, 5);
const SOLUTION = gridToString(solve(parseGrid(DOOR.puzzle)!)!);
const SITE = 'https://sudokui.app';
/** the server's clock on a day, at noon UTC */
const at = (day: string) => () => new Date(`${day}T12:00:00Z`);
/** a day so many days from the door's */
const from = (days: number) => new Date(Date.parse(`${DOOR.date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const good = (over: Record<string, unknown> = {}) => ({
  token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  grid: SOLUTION,
  seconds: 300,
  hints: 0,
  unassisted: true,
  ...over
});
const post = (no: number, body: unknown) =>
  new Request(`${SITE}/api/daily/${no}/result`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const get = (no: number) => new Request(`${SITE}/api/daily/${no}/stats`);

describe('a door’s time', () => {
  it('is taken on the daily’s tables under the door’s own number, on its day', async () => {
    const store = memoryStore();
    const res = (await handleDailyApi(post(NO, good()), store, { now: at(DOOR.date) }))!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, accepted: true, stats: { no: NO, count: 1 } });
    expect(store.results).toEqual([expect.objectContaining({ no: NO, seconds: 300, unassisted: true })]);
    const stats = (await handleDailyApi(get(NO), store, { now: at(DOOR.date) }))!;
    expect((await stats.json()).count).toBe(1);
    // the same day's daily keeps its own numbers
    const day = dailyNumber(DOOR.date)!;
    if ((dailies as Daily[]).some((d) => d.date === DOOR.date)) expect((await (await handleDailyApi(get(day), store, { now: at(DOOR.date) }))!.json()).count).toBe(0);
  });

  it('is taken a day early (a clock ahead of UTC) and up to LATE_DAYS late, with a day of grace behind (a clock behind UTC), and refused outside that', async () => {
    expect([EARLY_DAYS, LATE_DAYS, BEHIND_DAYS]).toEqual([1, 7, 1]);
    for (const [days, status, error] of [
      [-2, 400, 'that day has not come'],
      [-1, 200, null],
      [0, 200, null],
      [LATE_DAYS, 200, null],
      [LATE_DAYS + BEHIND_DAYS, 200, null],
      [LATE_DAYS + BEHIND_DAYS + 1, 400, 'that day is too long ago']
    ] as const) {
      const store = memoryStore();
      const res = (await handleDailyApi(post(NO, good({ token: `token-for-day-${days}-xxxxxxxx` })), store, { now: at(from(days)) }))!;
      expect(res.status, `${days} days`).toBe(status);
      if (error) expect((await res.json()).error, `${days} days`).toBe(error);
    }
  });

  it('refuses a future door: door 24 on 1 December', async () => {
    const res = (await handleDailyApi(post(adventNo(2026, 24), good({ grid: gridToString(solve(parseGrid(DOORS[23].puzzle)!)!) })), memoryStore(), { now: at('2026-12-01') }))!;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('that day has not come');
  });

  it('is never taken after 31 December of its calendar where the player is: by UTC, never after 1 January', async () => {
    // door 24 a week late is 31 December, the last day; 1 January in UTC
    // is still 31 December west of it; on 2 January it is closed both ways
    const last = DOORS[23];
    const grid = gridToString(solve(parseGrid(last.puzzle)!)!);
    expect((await checkResult(good({ grid }), adventNo(2026, 24), last, at('2026-12-31')())).ok).toBe(true);
    expect((await checkResult(good({ grid }), adventNo(2026, 24), last, at('2027-01-01')())).ok).toBe(true);
    expect(await checkResult(good({ grid }), adventNo(2026, 24), last, at('2027-01-02')())).toEqual({ ok: false, reason: 'that day is too long ago' });
    // and by the calendar's own end, whatever the day of the door
    const late = { ...last, date: '2026-12-30' };
    expect((await checkResult(good({ grid }), adventNo(2026, 24), late, at('2027-01-01')())).ok).toBe(true);
    expect(await checkResult(good({ grid }), adventNo(2026, 24), late, at('2027-01-02')())).toEqual({ ok: false, reason: 'the advent calendar is closed' });
  });

  it('is taken whenever the app offers to send it: in the evening of its last day, west of UTC', async () => {
    // 18:00 in UTC-8 is already the next day in UTC
    for (const [door, local] of [
      [5, '2026-12-12'],
      [17, '2026-12-24'],
      [24, '2026-12-31']
    ] as const) {
      const d = DOORS[door - 1];
      expect(doorCounts(2026, door, local), `door ${door} on ${local}`).toBe(true);
      const grid = gridToString(solve(parseGrid(d.puzzle)!)!);
      const res = (await handleDailyApi(post(adventNo(2026, door), good({ grid, token: `token-for-door-${door}-xxxxxxxx` })), memoryStore(), {
        now: () => new Date(`${local}T18:00:00-08:00`)
      }))!;
      expect(res.status, `door ${door} on ${local} at 18:00 in UTC-8`).toBe(200);
      // the next day there, the app offers it no more
      const next = new Date(Date.parse(`${local}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
      expect(doorCounts(2026, door, next), `door ${door} on ${next}`).toBe(false);
    }
  });

  it('refuses a grid that is not the door’s solution, and a solve with help', async () => {
    const now = at(DOOR.date)();
    expect(await checkResult(good({ grid: SOLUTION.split('').reverse().join('') }), NO, DOOR, now)).toMatchObject({ ok: false });
    // another door's solution is not this door's
    const other = gridToString(solve(parseGrid(DOORS[5].puzzle)!)!);
    expect((await checkResult(good({ grid: other }), NO, DOOR, now)).ok).toBe(false);
    expect(await checkResult(good({ unassisted: false }), NO, DOOR, now)).toEqual({ ok: false, reason: 'only unassisted solves are counted' });
    expect(await checkResult(good({ hints: 2 }), NO, DOOR, now)).toEqual({ ok: false, reason: 'an unassisted solve used no hints' });
    expect(await checkResult(good({ seconds: 1 }), NO, DOOR, now)).toEqual({ ok: false, reason: 'too fast to be a solve' });
    expect((await checkResult(good(), NO, DOOR, now)).ok).toBe(true);
  });

  it('knows no door the calendar does not publish', async () => {
    for (const no of [adventNo(2026, 25), adventNo(2026, 0), adventNo(2030, 5)]) {
      const res = (await handleDailyApi(get(no), memoryStore(), { now: at(DOOR.date) }))!;
      expect(res.status, String(no)).toBe(404);
    }
  });
});

describe('a door’s address in the Worker', () => {
  function assets() {
    const calls: string[] = [];
    const events = memoryEvents();
    const env: Env = {
      ASSETS: {
        fetch: async (request: Request) => {
          const u = new URL(request.url);
          calls.push(u.pathname);
          if (u.pathname === '/share.tpl') return new Response(template, { status: 200 });
          return new Response('not found', { status: 404, headers: { 'x-answered-by': 'assets' } });
        }
      },
      EVENTS: events
    };
    return { env, calls, events };
  }
  /** a person's browser arriving from outside the site */
  const visit = (path: string) =>
    new Request(SITE + path, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130.0', 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } });
  const meta = (html: string, property: string) => new RegExp(`<meta\\s+property="${property}"\\s+content="([^"]*)"`).exec(html)?.[1];

  it('answers an open door with the app and a preview naming the door and its rating, counting a landing as advent', async () => {
    const { env, events } = assets();
    const res = await handleRequest(visit('/advent/2026/5'), env, undefined, undefined, () => Date.parse('2026-12-06T12:00:00Z'));
    expect(res.status).toBe(200);
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
    const html = await res.text();
    expect(meta(html, 'og:title')).toBe('Door 5 · sudokUI advent calendar');
    expect(meta(html, 'og:description')).toContain(`HoDoKu rating of ${DOOR.score}`);
    expect(meta(html, 'og:description')).toContain('5 December');
    expect(meta(html, 'og:url')).toBe(`${SITE}/advent/2026/5`);
    expect(meta(html, 'og:image')).toBe(`${SITE}/og/${DOOR.level.toLowerCase()}.png`);
    expect(events.points).toEqual([expect.objectContaining({ indexes: ['landing'], blobs: [DOOR.level, 'advent', expect.any(String), '', 'none'] })]);
    expect(LANDING_SLOTS).toContain('advent');
  });

  it('previews a door not yet open with the day it opens and no puzzle, band or rating, in each language', async () => {
    const { env, events } = assets();
    const now = () => Date.parse('2026-11-20T12:00:00Z');
    const en = await (await handleRequest(visit('/advent/2026/5'), env, undefined, undefined, now)).text();
    expect(meta(en, 'og:title')).toBe('Door 5 · sudokUI advent calendar');
    expect(meta(en, 'og:description')).toBe('Door 5 of the sudokUI advent calendar opens on 5 December. A sudoku a day from 1 to 24 December, each a little harder than the one before.');
    expect(meta(en, 'og:image')).toBe(`${SITE}/og-card.png`);
    expect(en).not.toContain(String(DOOR.score));
    expect(en).not.toContain(DOOR.puzzle);
    const nb = await (await handleRequest(visit('/nb/advent/2026/5'), env, undefined, undefined, now)).text();
    expect(nb).toContain('<html lang="nb">');
    expect(meta(nb, 'og:description')).toContain('Luke 5 i julekalenderen i sudokUI åpner 5. desember');
    const es = await (await handleRequest(visit('/es/advent/2026/5'), env, undefined, undefined, now)).text();
    expect(meta(es, 'og:description')).toContain('La casilla 5 del calendario de adviento de sudokUI se abre el 5 de diciembre');
    // a landing, with no band to name
    expect(events.points[0].blobs.slice(0, 2)).toEqual(['', 'advent']);
    // one day of grace: on 4 December UTC, someone is already on the 5th
    const early = await (await handleRequest(visit('/advent/2026/5'), env, undefined, undefined, () => Date.parse('2026-12-04T12:00:00Z'))).text();
    expect(meta(early, 'og:description')).toContain(`HoDoKu rating of ${DOOR.score}`);
  });

  it('hands a door no calendar publishes to the assets', async () => {
    for (const path of ['/advent/2026/25', '/advent/2031/5', '/advent/2026/']) {
      const { env, calls } = assets();
      const res = await handleRequest(visit(path), env);
      expect(res.status, path).toBe(404);
      expect(calls, path).toEqual([path]);
    }
  });
});

describe('a door’s play line', () => {
    /** a line as it arrives, through JSON: a field set to undefined is not there at all */
  const line = (over: Record<string, unknown> = {}) =>
    JSON.parse(JSON.stringify({ event: 'started', band: 'Easy', bucket: 0, standalone: false, version: '1.0.0+abc1234', source: 'tab', kind: 'advent', lang: 'nb', door: 5, ...over }));

  it('carries its door, 1 to 24, and only a door’s line does', () => {
    expect(PLAY_KINDS).toContain('advent');
    expect(checkEvent(line())).toMatchObject({ kind: 'advent', door: 5 });
    expect(checkEvent(line({ door: 1 }))?.door).toBe(1);
    expect(checkEvent(line({ door: 24, event: 'completed', bucket: 20 }))?.door).toBe(24);
    for (const door of [0, 25, 2.5, '5', null, undefined]) expect(checkEvent(line({ door })), String(door)).toBeNull();
    expect(checkEvent({ ...line(), door: undefined })).toBeNull();
    // no other kind carries a door, and a share never does
    expect(checkEvent(line({ kind: 'daily' }))).toBeNull();
    expect(checkEvent(line({ kind: 'daily', door: undefined }))).toMatchObject({ kind: 'daily' });
    expect(checkEvent({ event: 'shared', band: 'Easy', bucket: 0, standalone: false, version: '1', source: 'tab', what: 'challenge', via: 'copy', door: 5 })).toBeNull();
    expect(checkBatch([line(), line({ door: 30 })])).toBeNull();
  });

  it('writes the door as a seventh blob, after the six an older line keeps in their places', () => {
    const door = pointOf(checkEvent(line())!, 'NO');
    expect(door.blobs).toEqual(['Easy', 'tab', '1.0.0+abc1234', 'NO', 'advent', 'nb', '5']);
    const daily = pointOf(checkEvent(line({ kind: 'daily', door: undefined }))!, 'NO');
    expect(daily.blobs).toEqual(['Easy', 'tab', '1.0.0+abc1234', 'NO', 'daily', 'nb']);
    // two doors are two points; the same door twice is one with a count of two
    const points = fold([checkEvent(line())!, checkEvent(line())!, checkEvent(line({ door: 6 }))!], 'NO');
    expect(points.map((p) => [p.blobs[6], p.doubles[1]])).toEqual([
      ['5', 2],
      ['6', 1]
    ]);
  });
});

describe('the doors’ dates on the server', () => {
  it('are the published doors’ own', () => {
    for (const d of DOORS) expect(d.date).toBe(doorDate(Number(d.date.slice(0, 4)), d.door));
  });
});
