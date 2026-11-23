import { describe, expect, it } from 'vitest';
import { TIPS, TIP_MAX, tipDealer, tipsFor, type Device } from '../src/ui/tips';
import nb from '../src/content/locales/ui.nb';
import es from '../src/content/locales/ui.es';

const phone: Device = { keys: false, touch: true, tab: true, advent: false };
const laptop: Device = { keys: true, touch: false, tab: true, advent: false };
const installed: Device = { keys: false, touch: true, tab: false, advent: true };
/** the same numbers every run */
const seeded = (seed = 7) => {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
};

describe('the pause card’s tips', () => {
  it('are a bank of some fifty, each said once, in three languages, short enough for the card', () => {
    expect(TIPS.length).toBeGreaterThanOrEqual(50);
    expect(new Set(TIPS.map((t) => t.text)).size).toBe(TIPS.length);
    for (const tip of TIPS) {
      for (const [lang, text] of [['en', tip.text], ['nb', (nb as Record<string, string>)[tip.text]], ['es', (es as Record<string, string>)[tip.text]]]) {
        expect(text, `${lang}: ${tip.text}`).toBeTruthy();
        expect(text.length, `${lang}: ${text}`).toBeLessThanOrEqual(TIP_MAX);
        // one line of thought, no full stop to end it, as the card's other tips
        expect(text.endsWith('.'), `${lang}: ${text}`).toBe(false);
      }
    }
    // what makes the app special is a good part of it
    expect(TIPS.filter((t) => t.gold).length).toBeGreaterThanOrEqual(10);
    expect(TIPS.filter((t) => t.gold).every((t) => !t.needs?.length)).toBe(true);
  });

  it('fit the device: no shortcut on a phone, no touch gesture on a laptop, no installing in the installed app, the calendar in its season', () => {
    const texts = (d: Device) => tipsFor(d).map((t) => t.text);
    expect(texts(phone).some((t) => /Ctrl|Shift|Alt \+|Double-click/.test(t))).toBe(false);
    expect(tipsFor(phone).some((t) => t.needs?.includes('keys'))).toBe(false);
    expect(texts(phone)).toContain('Hold a number in Digit mode to enter it as a corner mark');
    expect(texts(phone)).toContain('On iPhone: Share → Add to Home Screen puts sudokUI beside your apps');
    expect(texts(laptop)).toContain('Z, X, C and V switch between Digit, Corner, Centre and Colour');
    expect(texts(laptop)).not.toContain('Drag across the board to select several cells at once');
    expect(texts(laptop)).not.toContain('On iPhone: Share → Add to Home Screen puts sudokUI beside your apps');
    expect(texts(laptop)).toContain('Install sudokUI from your browser menu and it opens full screen, like an app');
    expect(texts(installed).some((t) => /Install|Add to Home Screen|address bar/.test(t))).toBe(false);
    expect(texts(installed)).toContain('New has a sudoku advent calendar: a door a day from 1 to 24 December');
    expect(texts(phone)).not.toContain('New has a sudoku advent calendar: a door a day from 1 to 24 December');
    // every device has plenty
    for (const d of [phone, laptop, installed]) expect(tipsFor(d).length).toBeGreaterThan(25);
  });

  it('deals what makes the app special first, then every fitting tip once before any comes again, never the same twice running', () => {
    for (const seed of [1, 7, 99, 12345]) {
      const deal = tipDealer(seeded(seed));
      const pool = tipsFor(phone).map((t) => t.text);
      const gold = tipsFor(phone).filter((t) => t.gold).map((t) => t.text);
      const first = deal(phone);
      expect(gold).toContain(first);
      // the rest of the first round: every other tip, once
      const round = [first, ...Array.from({ length: pool.length - 1 }, () => deal(phone))];
      expect([...round].sort()).toEqual([...pool].sort());
      // three more rounds: each a full round, and no tip twice running across the seams
      const more = Array.from({ length: pool.length * 3 }, () => deal(phone));
      for (let r = 0; r < 3; r++) expect([...more.slice(r * pool.length, (r + 1) * pool.length)].sort()).toEqual([...pool].sort());
      const all = [...round, ...more];
      for (let i = 1; i < all.length; i++) expect(all[i], `seed ${seed}, deal ${i}`).not.toBe(all[i - 1]);
    }
  });

  it('follows a device that changes, and says nothing when no tip fits', () => {
    const deal = tipDealer(seeded());
    deal(laptop);
    const onPhone = Array.from({ length: 200 }, () => deal(phone));
    const fits = tipsFor(phone).map((t) => t.text);
    for (const t of onPhone) expect(fits).toContain(t);
    expect(tipDealer(() => 0.5)({ keys: false, touch: false, tab: false, advent: false })).toBeTruthy();
  });
});
