// The advent calendar (docs/advent-calendar.md): 24 doors, 1 to 24
// December, door n opening on n December in the player's local date, its
// puzzle rated about n x 100 on HoDoKu's scale, the same puzzle for
// everyone. This module holds what the app, the build script
// (scripts/build-advent.ts) and the Worker (worker/daily.ts,
// worker/index.ts) agree on: the door's number for the results, its
// address, its published puzzle and how its day is written. What a date
// allows (whether a door is open, locked or closed, whether its time
// counts) is the season module's (src/content/season.ts), which every one
// of them asks. It imports no data: the app loads advent.json when a door
// opens (loadAdvent), the Worker bundles it.
//
// Decisions (the owner, 12 November 2026):
// - A door opens on its day, the player's local date, and an earlier door
//   stays open until 31 December. A door whose day has not come is locked,
//   by the rule that locks a daily whose day has not come: no address,
//   link, Import or calendar opens it (src/ui/links.ts, startDoor). The
//   calendar is there from 1 November, every door locked until December;
//   from 1 January it is closed until November: a door game in progress
//   stays where it is and can be finished, but no door opens and nothing
//   is sent.
// - A door's unassisted time counts on its day and up to LATE_DAYS late,
//   as the daily's does; the Worker takes it on the daily's own tables,
//   under a number no daily reaches (adventNo), and refuses a door whose
//   day has not come (with the daily's EARLY_DAYS of grace) or one more
//   than LATE_DAYS behind, never after 31 December.
// - Like the dailies, the file carries the SHA-256 of each solution, never
//   the solution, and a published door is never regenerated.
import type { Level } from '../engine/ratings';
import type { Lang } from '../state/settings';
import { homePath } from './home';
import { dateOfKey } from './dailies';
import { doorDate, isDoor } from './season';

/** one door of a year's calendar, as advent.json publishes it */
export interface AdventDoor {
  /** its day, the local calendar date it opens on: 2026-12-05 */
  date: string;
  /** 1 to 24 */
  door: number;
  /** 81 cells, digits and dots */
  puzzle: string;
  level: Level;
  /** the HoDoKu rating, about door x 100 */
  score: number;
  /** SHA-256 of the 81-digit solution, lower-case hex */
  solutionHash: string;
}

/**
 * The calendar's dates and what they allow (a door's day, whether it is
 * open, whether its time counts, the calendar's last day) are the season
 * module's (src/content/season.ts), which everything asks; the few a
 * caller of this module reaches for come with it.
 */
export { DOORS as ADVENT_DOORS, doorDate, isDoor } from './season';

/** the rating a door aims at: door 1 about 100, door 24 about 2400 */
export const doorTarget = (door: number) => door * 100;

/**
 * Where the doors' numbers start: a door's results live on the daily's
 * tables (worker/daily.ts), keyed by a number no daily can reach (the
 * daily's count of days from 2026-10-07 passes 100000 in the year 2300)
 */
export const ADVENT_BASE = 100000;

/** a door's number for its results: 100000 + year x 100 + door (door 5 of 2026 is 302605) */
export const adventNo = (year: number, door: number) => ADVENT_BASE + year * 100 + door;

/** the door a number stands for, or null for a daily's number or anything else */
export function adventOfNo(no: number): { year: number; door: number } | null {
  if (!Number.isInteger(no) || no <= ADVENT_BASE) return null;
  const rest = no - ADVENT_BASE;
  const year = Math.floor(rest / 100);
  const door = rest % 100;
  return year >= 2000 && year <= 2999 && isDoor(door) ? { year, door } : null;
}

/** whole days from one date key to another, later is positive */
export function daysBetween(from: string, to: string): number {
  const a = dateOfKey(from);
  const b = dateOfKey(to);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** a door's day as the player's language writes it, without the year: 5 December, 5. desember, 5 de diciembre; short, 5 Dec */
export function doorDay(date: string, locale: string, month: 'long' | 'short' = 'long'): string {
  const d = dateOfKey(date);
  if (!d) return date;
  // the key is the day itself, held as its UTC midnight
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month, timeZone: 'UTC' }).format(d);
}

/** the door out of a published list */
export const findDoor = (doors: AdventDoor[], year: number, door: number): AdventDoor | undefined =>
  doors.find((d) => d.door === door && d.date === doorDate(year, door));

/** the years a published list has calendars for, oldest first (the public page shows the last, the dashboard the one in season) */
export const calendarYears = (doors: AdventDoor[]): number[] =>
  [...new Set(doors.map((d) => Number(d.date.slice(0, 4))))].sort((a, b) => a - b);

// ---- the address ------------------------------------------------------------

/** a door's address, in any language, with or without a trailing slash: /advent/2026/5, /nb/advent/2026/5 */
export const ADVENT_PATH = /^\/(?:(nb|es)\/)?advent\/(\d{4})\/(\d{1,2})\/?$/;

/** the door an address points at, with a challenger's time (?vs=) if one rides along; null otherwise */
export function parseAdventUrl(url: { pathname: string; search?: string }): { lang: Lang; year: number; door: number; vs?: number } | null {
  const m = ADVENT_PATH.exec(url.pathname);
  if (!m) return null;
  const year = Number(m[2]);
  const door = Number(m[3]);
  if (!isDoor(door) || year < 2000) return null;
  const out: { lang: Lang; year: number; door: number; vs?: number } = { lang: (m[1] as Lang) ?? 'en', year, door };
  const q = new URLSearchParams(url.search ?? '');
  const vs = Number(q.get('vs'));
  if (q.has('vs') && Number.isInteger(vs) && vs > 0 && vs < 24 * 3600) out.vs = vs;
  return out;
}

/** the path of a door's address: /advent/2026/5, /nb/advent/2026/5, with a challenger's time if given */
export const adventPath = (lang: Lang, year: number, door: number, vs?: number) =>
  `${homePath(lang)}advent/${year}/${door}${vs ? `?vs=${vs}` : ''}`;

/**
 * The published doors, loaded only when a door or the calendar opens (the
 * app's bundle stays light); null when the file cannot be fetched (offline
 * before the app could keep it, a flaky network)
 */
export async function loadAdvent(): Promise<AdventDoor[] | null> {
  try {
    return (await import('./advent.json')).default as AdventDoor[];
  } catch {
    return null;
  }
}
