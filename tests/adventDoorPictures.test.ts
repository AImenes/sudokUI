/**
 * The motifs of the advent doors' pictures (scripts/advent-doors/,
 * scripts/og-advent-doors.ts): each door's file by its name, and what a
 * motif may be made of, so that 24 motifs drawn by different hands stay
 * one set. What a picture looks like is judged by eye, on the sheets the
 * generator makes; this holds only the rules a file can break unseen.
 */
import { describe, it, expect } from 'vitest';
import { BOX, GROUNDS, feltOf, type Felt, type GroundName } from '../scripts/advent-doors/felt';

const files = import.meta.glob<{ default?: unknown }>('../scripts/advent-doors/door-*.ts', { eager: true });
const doors = Object.entries(files).map(([path, mod]) => ({ name: path.split('/').pop()!, mod }));
const grounds = Object.keys(GROUNDS) as GroundName[];

describe('the advent doors’ motifs', () => {
  it('has the three first doors, each file named for a door of the calendar', () => {
    const names = doors.map((d) => d.name);
    for (const n of ['door-01.ts', 'door-12.ts', 'door-24.ts']) expect(names).toContain(n);
    for (const n of names) {
      const m = /^door-(\d\d)\.ts$/.exec(n);
      expect(m, n).not.toBeNull();
      expect(+m![1], n).toBeGreaterThanOrEqual(1);
      expect(+m![1], n).toBeLessThanOrEqual(24);
    }
  });

  it('the box is 340 by 410 about its middle', () => {
    expect([BOX.right - BOX.left, BOX.bottom - BOX.top]).toEqual([BOX.w, BOX.h]);
    expect([BOX.left + BOX.right, BOX.top + BOX.bottom]).toEqual([0, 0]);
  });

  for (const { name, mod } of doors) {
    describe(name, () => {
      const id = `d${+name.slice(5, 7)}`;
      it('exports its motif as the default function', () => {
        expect(typeof mod.default, name).toBe('function');
      });
      for (const ground of grounds) {
        it(`on ${ground}: shapes only, in the felt's colours, ids of its own`, () => {
          const k: Felt = feltOf(ground, id);
          const svg = (mod.default as (k: Felt) => string)(k);
          expect(svg.length).toBeGreaterThan(100);
          // no words, nothing fetched, nothing that blends, no shadow of its own
          for (const not of ['<text', '<tspan', '<image', '<foreignObject', '<style', '<script', '<svg', 'href', 'url(http', 'opacity', 'filter', 'Gradient', 'font'])
            expect(svg.includes(not), `${name} has ${not}`).toBe(false);
          // every colour is one the motif was given
          const given = new Set([k.snow, k.shade, k.gold, k.goldDeep, k.thread, k.ground, k.deep, k.accent]);
          // url(#id) is a reference, not a colour
          const used = svg.replace(/url\(#[^)]+\)/g, '').match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
          for (const c of used) expect(given.has(c), `${name} uses ${c}, not one of the felt's colours`).toBe(true);
          expect(/(fill|stroke)="(?!none|#|url\()/.test(svg), `${name} names a colour by word`).toBe(false);
          // ids are the door's own, and none twice
          const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
          for (const i of ids) expect(i.startsWith(`${id}-`), `${name}: id ${i} must start with ${id}-`).toBe(true);
          expect(new Set(ids).size).toBe(ids.length);
          // no number that is not a number
          expect(/NaN|undefined|Infinity/.test(svg), name).toBe(false);
        });
      }
    });
  }
});
