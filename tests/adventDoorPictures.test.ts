/**
 * The pictures of the advent calendar's 24 doors (scripts/advent-doors/,
 * scripts/og-advent-doors.ts, public/og/advent/): the table of the doors
 * and each door's motif file by its name, what a motif may be made of, so
 * that 24 motifs drawn by different hands stay one set, and the 24
 * pictures the site serves: each there, a 1200 x 630 PNG, light enough
 * for a chat. What a picture looks like is judged by eye, on the sheets
 * the generator makes; this holds only what can break unseen.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { BOX, GROUNDS, feltOf, type Felt, type GroundName } from '../scripts/advent-doors/felt';
import { DOORS, H, MAX_BYTES, W, doorName } from '../scripts/advent-doors/doors';
import advent from '../src/content/advent.json';
import { ogDoorPicture } from '../src/content/share';
import viteConfig from '../vite.config.ts?raw';

const files = import.meta.glob<{ default?: unknown }>('../scripts/advent-doors/door-*.ts', { eager: true });
const doors = Object.entries(files).map(([path, mod]) => ({ name: path.split('/').pop()!, mod }));
const grounds = Object.keys(GROUNDS) as GroundName[];

describe('the advent doors’ motifs', () => {
  it('has a motif file for each of the 24 doors of the table, and no other', () => {
    expect(DOORS).toHaveLength(24);
    expect(doors.map((d) => d.name).sort()).toEqual(DOORS.map((_, i) => `${doorName(i + 1)}.ts`));
    for (const d of DOORS) expect(d.motif.length, d.motif).toBeGreaterThan(3);
    // no two doors show the same thing
    expect(new Set(DOORS.map((d) => d.motif)).size).toBe(24);
  });

  it('knits pine and cranberry in turn, and no two days running share a band', () => {
    for (const [i, d] of DOORS.entries()) {
      expect(d.ground, `door ${i + 1}`).toBe(i + 1 === 24 || (i + 1) % 2 ? 'pine' : 'cranberry');
      if (i) expect(d.band, `door ${i + 1}`).not.toBe(DOORS[i - 1].band);
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

describe('the advent doors’ pictures on the site', () => {
  const DIR = 'public/og/advent';
  const files = readdirSync(DIR).sort();

  it('are 24, door-01.png to door-24.png, with no year in the name and nothing else beside them', () => {
    expect(files).toEqual(DOORS.map((_, i) => `${doorName(i + 1)}.png`));
  });

  it('are each a 1200 x 630 PNG under 300 KB', () => {
    expect([W, H, MAX_BYTES]).toEqual([1200, 630, 300 * 1024]);
    for (const file of files) {
      const b = readFileSync(`${DIR}/${file}`);
      // the PNG signature, then the IHDR chunk: width and height as 32-bit numbers at 16 and 20
      expect([...b.slice(0, 8)], file).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(String.fromCharCode(...b.slice(12, 16)), file).toBe('IHDR');
      const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
      expect([view.getUint32(16), view.getUint32(20)], file).toEqual([W, H]);
      // a chat app fetches the picture for every link, and drops a heavy one
      expect(b.length, file).toBeLessThan(MAX_BYTES);
      // and it is a picture, not an empty frame
      expect(b.length, file).toBeGreaterThan(20_000);
    }
  });

  it('are where a door’s link points, for every door the calendar publishes', () => {
    const published = advent as { door: number }[];
    expect(published.length).toBeGreaterThan(0);
    for (const { door } of published) {
      const address = ogDoorPicture(door);
      expect(address).toBe(`https://sudokui.app/og/advent/${doorName(door)}.png`);
      expect(files, address).toContain(address.split('/og/advent/')[1]);
    }
  });

  it('stay out of the offline app: the service worker’s precache leaves public/og/ alone', () => {
    // the build's own list (vite.config.ts, workbox): what the app keeps for
    // offline is its code and pages, never a picture made for a chat preview
    const ignores = /globIgnores:\s*\[([^\]]*)\]/.exec(viteConfig)?.[1] ?? '';
    expect(ignores).toContain("'og/**'");
    // and nothing asks for them by name
    const assets = /includeAssets:\s*\[([^\]]*)\]/.exec(viteConfig)?.[1] ?? '';
    expect(assets).not.toMatch(/og[/-]/);
    expect(viteConfig).not.toMatch(/globPatterns:[^\n]*png/);
  });
});
