/**
 * The advent calendar's doors (docs/advent-calendar.md;
 * src/content/advent.ts, scripts/build-advent.ts): the calendar's dates as
 * the season module gives them (src/content/season.ts; tests/season.test.ts
 * walks the season's edges), there from 1 November to 31 December by the
 * player's local date, door n opening on n December, a door's time
 * counting on its day and up to a week late; each
 * door's number for its results, in a range no daily reaches; and the
 * published doors, one solution each, published as its hash, rated as the
 * file says, near n x 100, rising, and made again by the seeded search
 * exactly as published.
 */
import { describe, it, expect } from 'vitest';
import doorsFile from '../src/content/advent.json';
import dailiesFile from '../src/content/dailies.json';
import { ADVENT_BASE, ADVENT_DOORS, adventNo, adventOfNo, doorDate, doorDay, doorTarget, daysBetween } from '../src/content/advent';
import { calendarOpen, doorOpen, doorCounts, doorState, calendarEnd, DOORS } from '../src/content/season';
import type { AdventDoor } from '../src/content/advent';
import { dailyNumber, LATE_DAYS } from '../src/content/dailies';
import type { Daily } from '../src/content/dailies';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve, countSolutions } from '../src/engine/bruteForce';
import { ratePuzzle } from '../src/engine/humanSolver';
import { LEVELS } from '../src/engine/ratings';
import { makeDoor, tolerance } from '../scripts/adventDoors';
import { API_PATH, sha256Hex } from '../worker/daily';

const doors = doorsFile as AdventDoor[];
const dailies = dailiesFile as Daily[];

describe('the calendar’s dates', () => {
  it('is there from 1 November to 31 December, its doors locked in November, and closed from 1 January until November', () => {
    expect(calendarOpen('2026-10-31')).toBe(false);
    expect(calendarOpen('2026-11-01')).toBe(true);
    expect(calendarOpen('2026-11-30')).toBe(true);
    expect(doorState(2026, 1, '2026-11-30')).toBe('locked');
    expect(calendarOpen('2026-12-01')).toBe(true);
    expect(calendarOpen('2026-12-31')).toBe(true);
    expect(calendarOpen('2027-01-01')).toBe(false);
    expect(calendarOpen('2027-10-31')).toBe(false);
    expect(calendarOpen('2027-11-01')).toBe(true);
    expect(calendarOpen('not a date')).toBe(false);
    // the advent module's count is the season's
    expect(ADVENT_DOORS).toBe(DOORS);
  });

  it('says where a door stands: locked until its day, as a daily is, open until 31 December, closed after', () => {
    expect(doorState(2026, 5, '2026-11-12')).toBe('locked');
    expect(doorState(2026, 5, '2026-12-04')).toBe('locked');
    expect(doorState(2026, 5, '2026-12-05')).toBe('open');
    expect(doorState(2026, 5, '2026-12-31')).toBe('open');
    expect(doorState(2026, 5, calendarEnd(2026))).toBe('open');
    expect(doorState(2026, 5, '2027-01-01')).toBe('closed');
    expect(doorState(2026, 5, '2027-12-05')).toBe('closed');
    // a calendar still to come is locked, door by door, as a daily still to come is
    expect(doorState(2027, 1, '2026-12-31')).toBe('locked');
    // no door outside 1 to 24, and no day out of what is not a date
    expect(doorState(2026, 25, '2026-12-31')).toBe('closed');
    expect(doorState(2026, 5, 'not a date')).toBe('closed');
  });

  it('opens door n on n December and keeps every earlier door open until 31 December', () => {
    expect(doorOpen(2026, 1, '2026-11-30')).toBe(false);
    expect(doorOpen(2026, 1, '2026-12-01')).toBe(true);
    expect(doorOpen(2026, 2, '2026-12-01')).toBe(false);
    for (let door = 1; door <= ADVENT_DOORS; door++) {
      expect(doorOpen(2026, door, '2026-12-10'), `door ${door}`).toBe(door <= 10);
      expect(doorOpen(2026, door, '2026-12-31'), `door ${door}`).toBe(true);
      expect(doorOpen(2026, door, '2027-01-01'), `door ${door}`).toBe(false);
    }
    // another year's calendar, and no door outside 1 to 24
    expect(doorOpen(2026, 3, '2027-12-10')).toBe(false);
    expect(doorOpen(2027, 3, '2026-12-10')).toBe(false);
    expect(doorOpen(2026, 0, '2026-12-10')).toBe(false);
    expect(doorOpen(2026, 25, '2026-12-31')).toBe(false);
  });

  it('counts a door’s time on its day and up to LATE_DAYS late, never before and never after 31 December', () => {
    expect(LATE_DAYS).toBe(7);
    expect(doorCounts(2026, 5, '2026-12-04')).toBe(false);
    expect(doorCounts(2026, 5, '2026-12-05')).toBe(true);
    expect(doorCounts(2026, 5, '2026-12-12')).toBe(true);
    expect(doorCounts(2026, 5, '2026-12-13')).toBe(false);
    expect(doorCounts(2026, 24, '2026-12-31')).toBe(true);
    expect(doorCounts(2026, 24, '2027-01-01')).toBe(false);
    expect(daysBetween('2026-12-05', '2026-12-13')).toBe(8);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('dates a door on its own day of December', () => {
    expect(doorDate(2026, 1)).toBe('2026-12-01');
    expect(doorDate(2026, 24)).toBe('2026-12-24');
    expect(doorDay('2026-12-05', 'en-GB')).toBe('5 December');
    expect(doorDay('2026-12-05', 'nb-NO')).toBe('5. desember');
    expect(doorDay('2026-12-05', 'es-ES')).toBe('5 de diciembre');
  });
});

describe('the doors’ numbers', () => {
  it('gives each door a number of its own, read back to its door', () => {
    expect(adventNo(2026, 5)).toBe(302605);
    const seen = new Set<number>();
    for (const year of [2026, 2027, 2099]) {
      for (let door = 1; door <= ADVENT_DOORS; door++) {
        const no = adventNo(year, door);
        expect(seen.has(no)).toBe(false);
        seen.add(no);
        expect(adventOfNo(no)).toEqual({ year, door });
        // the daily's routes take it (worker/daily.ts)
        expect(API_PATH.test(`/api/daily/${no}/stats`), String(no)).toBe(true);
      }
    }
    expect(adventOfNo(adventNo(2026, 25))).toBeNull();
    expect(adventOfNo(adventNo(2026, 0))).toBeNull();
  });

  it('is a range no daily reaches: every published daily, and centuries of days after it', () => {
    const last = dailyNumber(dailies[dailies.length - 1].date)!;
    expect(last).toBeLessThan(ADVENT_BASE);
    for (const d of dailies) expect(adventOfNo(dailyNumber(d.date)!)).toBeNull();
    // the daily's count of days reaches the doors' range in the year 2300
    expect(dailyNumber('2300-01-01')!).toBeLessThan(ADVENT_BASE);
    for (const no of [1, 100, 99999, ADVENT_BASE]) expect(adventOfNo(no)).toBeNull();
  });
});

/** the published years, each one's doors */
const YEARS = [...new Set(doors.map((d) => Number(d.date.slice(0, 4))))];

describe('the published doors', () => {
  it('begin with 2026', () => {
    expect(YEARS[0]).toBe(2026);
  });

  for (const y of YEARS) {
    const year = doors.filter((d) => d.date.startsWith(`${y}-`));

    it(`of ${y} are 24, one on each day from 1 to 24 December, as the file writes them`, () => {
      expect(year.map((d) => d.door)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
      expect(year.map((d) => d.date)).toEqual(year.map((d) => doorDate(y, d.door)));
    });

    it(`of ${y} each have one solution, published as its hash only, and are solved without guessing at the rating they say`, async () => {
      for (const d of year) {
        const grid = parseGrid(d.puzzle)!;
        expect(countSolutions(grid, 2), `door ${d.door}`).toBe(1);
        const solution = gridToString(solve(grid)!);
        expect(await sha256Hex(solution), `door ${d.door}`).toBe(d.solutionHash);
        expect(JSON.stringify(d)).not.toContain(solution);
        const r = ratePuzzle(d.puzzle)!;
        expect(r.solvable, `door ${d.door}`).toBe(true);
        expect({ door: d.door, score: r.score, level: r.level }).toEqual({ door: d.door, score: d.score, level: d.level });
      }
    });

    it(`of ${y} rise from about 100 to about 2400, each door near n x 100, in bands that never fall`, () => {
      for (const d of year) expect(Math.abs(d.score - doorTarget(d.door)), `door ${d.door}: ${d.score}`).toBeLessThanOrEqual(tolerance(doorTarget(d.door)));
      for (let i = 1; i < year.length; i++) {
        expect(year[i].score, `door ${i + 1}`).toBeGreaterThan(year[i - 1].score);
        expect(LEVELS.indexOf(year[i].level), `door ${i + 1}`).toBeGreaterThanOrEqual(LEVELS.indexOf(year[i - 1].level));
      }
      expect(year[0].level).toBe('Easy');
      expect(year[23].level).toBe('Extreme');
      // door 1 is a puzzle of singles with few empty cells
      expect(year[0].puzzle.replace(/[^.]/g, '').length).toBeLessThan(35);
    });
  }

  it('of 2026 are made again by the seeded search exactly as published', async () => {
    const year = doors.filter((d) => d.date.startsWith('2026-'));
    for (const door of [1, 2, 3]) {
      const before = door === 1 ? 'Easy' : year[door - 2].level;
      const made = makeDoor(2026, door, before);
      const { solutionHash, ...published } = year[door - 1];
      expect(made.door).toEqual(published);
      expect(await sha256Hex(made.solution)).toBe(solutionHash);
    }
  });
});

