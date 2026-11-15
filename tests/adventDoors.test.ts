/**
 * The advent calendar's doors (docs/advent-calendar.md;
 * src/content/advent.ts, scripts/build-advent.ts): the calendar's dates as
 * the season module gives them (src/content/season.ts; tests/season.test.ts
 * walks the season's edges), there from 1 November to 31 December by the
 * player's local date, door n opening on n December, a door's time
 * counting on its day and up to a week late; each
 * door's number for its results, in a range no daily reaches; and the
 * published doors, one solution each, published as its hash, rated as the
 * file says, and made again by the seeded search exactly as published.
 *
 * The doors are held to the owner's decision of 15 November 2026: a
 * gentle climb from about 100 to about 1000 (doorTarget), each door rated
 * higher than the one before, doors 1 to 18 Easy and solved by singles
 * alone, doors 19 to 24 Medium with no technique above Medium, each near
 * its target, or, for the last Easy doors, whose targets singles alone do
 * not reach, near its share of the stretch below what they do reach
 * (doorAim). And a year is made again only while its first door has not
 * opened anywhere (yearPlan).
 */
import { describe, it, expect } from 'vitest';
import doorsFile from '../src/content/advent.json';
import dailiesFile from '../src/content/dailies.json';
import { ADVENT_BASE, ADVENT_DOORS, adventNo, adventOfNo, doorDate, doorDay, doorTarget, daysBetween } from '../src/content/advent';
import { calendarOpen, doorOpen, doorCounts, doorState, calendarEnd, DOORS } from '../src/content/season';
import type { AdventDoor } from '../src/content/advent';
import { dailyNumber, localDateKey, LATE_DAYS } from '../src/content/dailies';
import type { Daily } from '../src/content/dailies';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve, countSolutions } from '../src/engine/bruteForce';
import { ratePuzzle, findNextStep, applyStep } from '../src/engine/humanSolver';
import { fitForLevel } from '../src/engine/generator';
import { LEVELS, LEVEL_MAX_SCORE, TECHS } from '../src/engine/ratings';
import type { Tech } from '../src/engine/ratings';
import { SINGLES_REACH, doorAim, doorLevel, makeDoor, tolerance, yearPlan } from '../scripts/adventDoors';
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

  it('are published before their season: from 1 October the coming calendar is in the file', () => {
    // the app opens the calendar from 1 November and a door from 1
    // December by the date alone; a year missing from the file says only
    // that its doors are not ready (src/ui/Advent.tsx, src/ui/links.ts)
    const today = localDateKey();
    const year = Number(today.slice(0, 4));
    if (today.slice(5) >= '10-01') expect(YEARS, `run npx vite-node scripts/build-advent.ts ${year}`).toContain(year);
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

    it(`of ${y} climb gently, as decided: each near its target or its share of what singles reach, each rated higher than the one before`, () => {
      for (const d of year) {
        const target = doorTarget(d.door);
        const aim = doorAim(d.door);
        const where = `door ${d.door}: ${d.score}`;
        // within the generator's tolerance of what its search aimed at
        expect(Math.abs(d.score - aim), where).toBeLessThanOrEqual(tolerance(aim));
        // which is the target itself wherever a puzzle of the door's level reaches it
        if (aim === target) expect(Math.abs(d.score - target), where).toBeLessThanOrEqual(tolerance(target));
        else {
          // the nearest singles alone come: below the target, in the last stretch under their reach
          expect(d.level, where).toBe('Easy');
          expect(target, where).toBeGreaterThan(SINGLES_REACH);
          expect(d.score, where).toBeLessThan(target);
          expect(d.score, where).toBeGreaterThan(SINGLES_REACH - 40);
        }
      }
      for (let i = 1; i < year.length; i++) {
        expect(year[i].score, `door ${i + 1}`).toBeGreaterThan(year[i - 1].score);
        expect(LEVELS.indexOf(year[i].level), `door ${i + 1}`).toBeGreaterThanOrEqual(LEVELS.indexOf(year[i - 1].level));
      }
      // from about 100 to about 1000, and never past Medium's own limit
      expect(Math.abs(year[0].score - 100)).toBeLessThanOrEqual(5);
      expect(year[23].score).toBeGreaterThanOrEqual(990);
      expect(year[23].score).toBeLessThanOrEqual(LEVEL_MAX_SCORE.Medium);
      // door 1 is a puzzle of singles with few empty cells
      expect(year[0].puzzle.replace(/[^.]/g, '').length).toBeLessThan(35);
    });

    it(`of ${y} are Easy behind doors 1 to 18, solved by singles alone, and Medium behind doors 19 to 24, with no technique above Medium`, () => {
      const SINGLES: Tech[] = ['FULL_HOUSE', 'NAKED_SINGLE', 'HIDDEN_SINGLE'];
      expect(year.filter((d) => d.level === 'Easy').map((d) => d.door)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
      expect(year.filter((d) => d.level === 'Medium').map((d) => d.door)).toEqual([19, 20, 21, 22, 23, 24]);
      for (const d of year) {
        const where = `door ${d.door}`;
        expect(d.level, where).toBe(doorLevel(d.door));
        // the full catalogue's own path, as the app's hints walk it
        const r = ratePuzzle(d.puzzle)!;
        const used = Object.keys(r.techniques) as Tech[];
        if (d.level === 'Easy') {
          expect(used.filter((t) => !SINGLES.includes(t)), where).toEqual([]);
          expect(d.score, where).toBeLessThanOrEqual(LEVEL_MAX_SCORE.Easy);
          // and the singles by themselves solve it, at the same rating
          const alone = ratePuzzle(d.puzzle, SINGLES)!;
          expect({ solvable: alone.solvable, score: alone.score }, where).toEqual({ solvable: true, score: d.score });
        } else {
          expect(used.filter((t) => LEVELS.indexOf(TECHS[t].level) > LEVELS.indexOf('Medium')), where).toEqual([]);
          // Medium by a technique, not by its score alone: a pair, a triple or locked candidates is needed
          expect(used.some((t) => TECHS[t].level === 'Medium'), where).toBe(true);
          expect(d.score, where).toBeLessThanOrEqual(LEVEL_MAX_SCORE.Medium);
          // and its hardest step comes on a board with room in it, as a served Medium puzzle's does
          expect(fitForLevel(d.puzzle, r), where).toBe(true);
        }
      }
    });

    it(`of ${y} each have exactly one solution, by brute force and by the engine's own solver, and it is the one whose hash is published`, async () => {
      for (const d of year) {
        const where = `door ${d.door}`;
        const grid = parseGrid(d.puzzle)!;
        // brute force: a second solution would be found
        expect(countSolutions(grid, 2), where).toBe(1);
        const solution = gridToString(solve(grid)!);
        // the engine's own solver, step by step and never guessing, ends on the same grid
        const g = parseGrid(d.puzzle)!;
        for (let step = findNextStep(g); step; step = findNextStep(g)) applyStep(g, step);
        expect(gridToString(g), where).toBe(solution);
        expect(solution, where).toMatch(/^[1-9]{81}$/);
        expect(await sha256Hex(solution), where).toBe(d.solutionHash);
      }
    });
  }

  it('of 2026 are made again by the seeded search exactly as published', async () => {
    const year = doors.filter((d) => d.date.startsWith('2026-'));
    for (const door of [1, 2, 3]) {
      const before = door === 1 ? 0 : year[door - 2].score;
      const made = makeDoor(2026, door, before);
      const { solutionHash, ...published } = year[door - 1];
      expect(made.door).toEqual(published);
      expect(await sha256Hex(made.solution)).toBe(solutionHash);
    }
  });
});

describe('the climb, as decided on 15 November 2026', () => {
  const ALL = Array.from({ length: ADVENT_DOORS }, (_, i) => i + 1);

  it('aims door 1 at 100 and door 24 at 1000, some 39 more each day', () => {
    expect(ALL.map(doorTarget)).toEqual([100, 139, 178, 217, 257, 296, 335, 374, 413, 452, 491, 530, 570, 609, 648, 687, 726, 765, 804, 843, 883, 922, 961, 1000]);
  });

  it('makes a door of the level its target names: Easy for doors 1 to 18, Medium for doors 19 to 24, none above', () => {
    expect(ALL.map(doorLevel)).toEqual([...Array(18).fill('Easy'), ...Array(6).fill('Medium')]);
  });

  it('aims a door at its target, and the last Easy doors, past what singles alone reach, at an even climb up to that reach', () => {
    expect(SINGLES_REACH).toBe(640);
    for (const door of ALL) {
      if (door < 15 || door > 18) expect(doorAim(door), `door ${door}`).toBe(doorTarget(door));
    }
    expect([15, 16, 17, 18].map(doorAim)).toEqual([617, 625, 632, 640]);
    // every aim is above the one before, so the doors can rise
    for (const door of ALL.slice(1)) expect(doorAim(door), `door ${door}`).toBeGreaterThan(doorAim(door - 1));
    // and no aim is past its target
    for (const door of ALL) expect(doorAim(door), `door ${door}`).toBeLessThanOrEqual(doorTarget(door));
  });
});

describe('making a year again', () => {
  const at = (iso: string) => new Date(iso);

  it('adds a year the file does not have, and leaves a published one alone unless the run asks', () => {
    expect(yearPlan(doors, 2027, false, at('2026-11-15T12:00:00Z'))).toBe('add');
    expect(yearPlan(doors, 2027, true, at('2027-12-10T12:00:00Z'))).toBe('add');
    expect(yearPlan([], 2026, false, at('2026-12-10T12:00:00Z'))).toBe('add');
    for (const now of ['2026-10-01T00:00:00Z', '2026-11-15T12:00:00Z', '2026-12-01T00:00:00Z', '2027-03-01T00:00:00Z'])
      expect(yearPlan(doors, 2026, false, at(now)), now).toBe('published');
  });

  it('replaces a year only while its first door has not opened anywhere: until 29 November UTC, a day before a player ahead of UTC reaches 1 December', () => {
    for (const now of ['2026-01-01T00:00:00Z', '2026-11-15T12:00:00Z', '2026-11-28T12:00:00Z', '2026-11-29T23:59:59Z'])
      expect(yearPlan(doors, 2026, true, at(now)), now).toBe('replace');
    // from 30 November UTC it is 1 December somewhere within the day: a door somebody may have played never changes
    for (const now of ['2026-11-30T00:00:00Z', '2026-11-30T10:00:00Z', '2026-12-01T00:00:00Z', '2026-12-24T12:00:00Z', '2026-12-31T23:59:59Z', '2027-01-01T00:00:00Z', '2027-11-15T12:00:00Z', '2031-06-01T00:00:00Z'])
      expect(yearPlan(doors, 2026, true, at(now)), now).toBe('opened');
    // the season's own rule: on the day the plan first refuses, door 1 is still locked by UTC's date and open a day ahead
    expect(doorState(2026, 1, '2026-11-30')).toBe('locked');
    expect(doorState(2026, 1, '2026-12-01')).toBe('open');
  });
});
