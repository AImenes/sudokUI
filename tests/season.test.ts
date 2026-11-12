/**
 * The Christmas season (src/content/season.ts; the owner's decisions of
 * 12 November 2026), day by day across its edges: the look can be chosen
 * from 1 November to 31 December and goes on by itself from 1 December;
 * the calendar is there from 1 November, its door n opening on n December
 * and every door playable until 31 December; from 1 January all of it is
 * gone until November.
 */
import { describe, it, expect } from 'vitest';
import { lookAvailable, lookAuto, calendarOpen, doorOpen, doorDate, doorOf, seasonYear, DOORS } from '../src/content/season';

/** the days the season turns on, and what each allows: [date, look can be chosen, look goes on by itself, calendar shown] */
const EDGES: [string, boolean, boolean, boolean][] = [
  ['2026-10-31', false, false, false],
  ['2026-11-01', true, false, true],
  ['2026-11-12', true, false, true],
  ['2026-11-30', true, false, true],
  ['2026-12-01', true, true, true],
  ['2026-12-24', true, true, true],
  ['2026-12-25', true, true, true],
  ['2026-12-31', true, true, true],
  ['2027-01-01', false, false, false],
  ['2027-06-15', false, false, false],
  ['2027-11-01', true, false, true]
];

describe('the Christmas look', () => {
  for (const [date, available, auto] of EDGES) {
    it(`${date}: ${available ? 'can be chosen' : 'cannot be chosen'}${auto ? ', and goes on by itself' : ''}`, () => {
      expect(lookAvailable(date)).toBe(available);
      expect(lookAuto(date)).toBe(auto);
    });
  }

  it('goes on by itself only on a day it can be chosen', () => {
    for (let m = 1; m <= 12; m++)
      for (const d of [1, 15, 28]) {
        const date = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (lookAuto(date)) expect(lookAvailable(date), date).toBe(true);
      }
  });

  it('reads no day out of what is not a date', () => {
    for (const bad of ['', '2026-12', '2026-12-32', '2026-11-31', '26-12-01', 'christmas', '2026-12-01T00:00']) {
      expect(lookAvailable(bad), bad).toBe(false);
      expect(lookAuto(bad), bad).toBe(false);
      expect(calendarOpen(bad), bad).toBe(false);
      expect(seasonYear(bad), bad).toBeNull();
    }
  });
});

describe('the advent calendar', () => {
  for (const [date, , , shown] of EDGES) {
    it(`${date}: ${shown ? 'is there' : 'is closed'}`, () => {
      expect(calendarOpen(date)).toBe(shown);
      expect(seasonYear(date)).toBe(shown ? Number(date.slice(0, 4)) : null);
    });
  }

  it('has 24 doors, one for each day from 1 to 24 December', () => {
    expect(DOORS).toBe(24);
    expect(doorDate(2026, 1)).toBe('2026-12-01');
    expect(doorDate(2026, 24)).toBe('2026-12-24');
    expect(doorOf('2026-12-01')).toBe(1);
    expect(doorOf('2026-12-24')).toBe(24);
    expect(doorOf('2026-12-25')).toBeNull();
    expect(doorOf('2026-11-30')).toBeNull();
    expect(doorOf('2027-01-01')).toBeNull();
  });

  it('keeps every door locked in November', () => {
    for (const date of ['2026-11-01', '2026-11-12', '2026-11-30'])
      for (let n = 1; n <= DOORS; n++) expect(doorOpen(2026, n, date), `${date} door ${n}`).toBe(false);
  });

  it('opens door n on n December, and never a door before its day', () => {
    for (let day = 1; day <= 24; day++) {
      const date = doorDate(2026, day);
      for (let n = 1; n <= DOORS; n++) expect(doorOpen(2026, n, date), `${date} door ${n}`).toBe(n <= day);
    }
  });

  it('keeps every door playable from 24 to 31 December', () => {
    for (const date of ['2026-12-24', '2026-12-25', '2026-12-31'])
      for (let n = 1; n <= DOORS; n++) expect(doorOpen(2026, n, date), `${date} door ${n}`).toBe(true);
  });

  it('closes every door on 1 January, and opens no door of another year', () => {
    for (let n = 1; n <= DOORS; n++) {
      expect(doorOpen(2026, n, '2027-01-01'), `door ${n}`).toBe(false);
      expect(doorOpen(2026, n, '2027-12-31'), `door ${n} a year on`).toBe(false);
      expect(doorOpen(2027, n, '2026-12-31'), `next year's door ${n}`).toBe(false);
    }
  });

  it('has no door 0, 25 or 2.5', () => {
    for (const n of [0, 25, -1, 2.5, NaN]) expect(doorOpen(2026, n, '2026-12-31'), String(n)).toBe(false);
  });
});
