// The Christmas season (the owner's decisions of 12 November 2026): what it
// allows on a day. Everything else asks this module, never the calendar
// itself: the Christmas look (src/state/settings.ts, src/ui/theme.ts), the
// advent calendar's doors in the app (src/ui/links.ts, src/ui/Advent.tsx),
// their times (src/state/gameStore.ts, src/state/dailyStats.ts), the
// Worker that takes them (worker/daily.ts) and the pages that show them
// (src/content/adventPage.ts, whose inline script tests/adventPage.test.ts
// holds to doorOpen). Every function takes the player's local date as a
// key, 2026-12-01 (dailies.ts, localDateKey), so a page left open across
// midnight follows by asking again with the new day (src/ui/useToday.ts),
// and a test names the day it means.
//
// - The look can be chosen from 1 November to 31 December. From 1 December
//   it goes on by itself for a player who never picked a theme; on
//   1 January it goes, and the theme from before comes back.
// - The calendar is there from 1 November to 31 December, its doors locked
//   until their days: door n (1 to 24) opens on n December and stays
//   playable until 31 December. From 1 January it is closed until November.
// - A door whose day has not come is locked by the same rule as a daily
//   whose day has not come: its day is after the player's local today
//   (dailies.ts, dayToCome), and the toast that says so is one style
//   (src/ui/links.ts, lockedLine).
// - A door's unassisted time counts on its day and up to LATE_DAYS late, as
//   the daily's does, and never after 31 December of its year.
import { dayToCome, LATE_DAYS } from './dailies';

/** the doors of the advent calendar, 1 December to 24 December */
export const DOORS = 24;

/** a day's year, month and day, or null for anything that is not a real date key */
function partsOf(date: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // a key that names no day (2026-11-31) is no day of the season
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** the Christmas look can be chosen: 1 November to 31 December */
export function lookAvailable(date: string): boolean {
  const p = partsOf(date);
  return !!p && (p.month === 11 || p.month === 12);
}

/** the Christmas look goes on by itself for a player who never picked a theme: 1 December to 31 December */
export function lookAuto(date: string): boolean {
  const p = partsOf(date);
  return !!p && p.month === 12;
}

/** the year of the season a day belongs to (the calendar's year), or null outside it */
export function seasonYear(date: string): number | null {
  const p = partsOf(date);
  return p && (p.month === 11 || p.month === 12) ? p.year : null;
}

/** the advent calendar is there to see: 1 November to 31 December, every door locked in November; closed from 1 January */
export function calendarOpen(date: string): boolean {
  return seasonYear(date) !== null;
}

/** whether a number is one of a calendar's doors, 1 to 24 */
export const isDoor = (door: number) => Number.isInteger(door) && door >= 1 && door <= DOORS;

/** door n's own day, the day it opens: door 1 of 2026 is 2026-12-01 */
export function doorDate(year: number, door: number): string {
  return `${year}-12-${String(door).padStart(2, '0')}`;
}

/** the last day of a year's calendar: no door of it is played, nor its time taken, after this */
export const calendarEnd = (year: number) => `${year}-12-31`;

/**
 * Where a door of a year's calendar stands on a date: `open`, from its day,
 * n December, to 31 December of that year; `locked` while its day has not
 * come (the lock of a day to come, as for a daily: dayToCome); `closed`
 * once its December is over (from 1 January, or in a later season), when
 * only a door game the player already holds goes on. A number that is no
 * door (0, 25) is never open, and counts as closed.
 */
export function doorState(year: number, door: number, date: string): 'open' | 'locked' | 'closed' {
  const p = partsOf(date);
  if (!p || !isDoor(door)) return 'closed';
  if (dayToCome(doorDate(year, door), date)) return 'locked';
  return p.year === year && p.month === 12 ? 'open' : 'closed';
}

/**
 * Door n (1 to 24) of a year's calendar can be played on this date: from
 * its day, n December, to 31 December of that year. A door whose day has
 * not come is locked, and every door is closed from 1 January.
 */
export function doorOpen(year: number, door: number, date: string): boolean {
  return doorState(year, door, date) === 'open';
}

/**
 * A door's unassisted time can still go into everyone's times on this
 * date: on its day and up to LATE_DAYS late, as a daily's, and only while
 * the door is open (never after 31 December). The Worker keeps the same
 * window by the UTC date, with the daily's day of grace ahead.
 */
export function doorCounts(year: number, door: number, date: string): boolean {
  const p = partsOf(date);
  return !!p && doorOpen(year, door, date) && p.day - door <= LATE_DAYS;
}

/** the door whose day this is (1 to 24 December), or null on any other day */
export function doorOf(date: string): number | null {
  const p = partsOf(date);
  return p && p.month === 12 && p.day <= DOORS ? p.day : null;
}
