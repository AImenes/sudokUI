/**
 * The set tracker's lines that no real pair reaches today, rendered on
 * purpose, so that a change to them is read before a player sees one (the
 * rest of its soundness harness is tests/setsSoundness.test.ts):
 *  - "Not proved: no count of rows, columns and boxes links these sets".
 *    compareSets says it when none of its GRIDS_TRIED valid grids tells two
 *    unequal sets apart; in every pair tried so far one of them did. Here
 *    the module's source of grids hands back the same grid every time, so
 *    its own loop runs out, and the line is held in all three languages to
 *    what it may claim: no proof, no Why?, no list of digits on an empty
 *    board or one being solved, and "no count links them" true by the
 *    referee (the two sets are not equal, so no identity of houses exists).
 *  - "×2" and "counted 2 times". No proof needs a scale (a theorem in
 *    tests/setsSoundness.test.ts) and none so far counts a house twice, so
 *    the tracker is handed true identities that do, in place of
 *    compareSets' answer, and the sentence it writes is read back and
 *    checked as an identity in each language. That sentence can be read two
 *    ways when a group counted twice follows another group; that is kept
 *    as a LATENT FINDING (it.fails), out of reach while the counts are 1.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { compareSets, GRIDS_TRIED, SetVerdict } from '../src/engine/sets';
import { useSettings } from '../src/state/settings';
import { loadLocale } from '../src/content/i18n';
import { setEngineText } from '../src/engine/text';
import * as O from './setsOracle';
import { Lang, LINES, show, inLang, readHouses, readsTrue, termsKey, tally } from './setsReader';

// the proof under Why? starts open while a test asks for it (see tests/setsSoundness.test.ts)
vi.mock('react', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown> & { default?: Record<string, unknown> };
  const base = (actual.default ?? actual) as typeof import('react');
  const useState = ((init: unknown) =>
    base.useState((globalThis as { __openSetProof?: boolean }).__openSetProof && init === false ? true : init)) as typeof base.useState;
  return { ...actual, ...base, useState, default: { ...base, useState } };
});

interface Rigging {
  /** the grid every call for a random full grid gets, while set */
  __fixedGrid?: Uint8Array;
  /** how many full grids were asked for */
  __gridsAsked?: number;
  /** the verdict the tracker is handed in place of compareSets', while set */
  __verdict?: SetVerdict;
}
const rig = globalThis as Rigging;

vi.mock('../src/engine/generator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/generator')>();
  return {
    ...actual,
    generateFullGrid: (rnd?: () => number) => {
      const r = globalThis as Rigging;
      r.__gridsAsked = (r.__gridsAsked ?? 0) + 1;
      if (!r.__fixedGrid) return actual.generateFullGrid(rnd);
      return { values: Uint8Array.from(r.__fixedGrid), cands: new Uint16Array(81), given: new Uint8Array(81) };
    }
  };
});

vi.mock('../src/engine/sets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/engine/sets')>();
  return { ...actual, compareSets: (a: Iterable<number>, b: Iterable<number>) => (globalThis as Rigging).__verdict ?? actual.compareSets(a, b) };
});

const LANGS: Lang[] = ['en', 'nb', 'es'];
type Same = Extract<SetVerdict, { kind: 'same' }>;

beforeAll(async () => {
  await loadLocale('nb');
  await loadLocale('es');
});
afterEach(() => {
  rig.__fixedGrid = undefined;
  rig.__verdict = undefined;
});
afterAll(() => {
  useSettings.getState().set({ lang: 'en', setTracker: false });
  setEngineText('en', null);
  // eslint-disable-next-line no-console
  console.info('rare lines read back:', JSON.stringify(Object.fromEntries(tally)));
});

describe('"Not proved"', () => {
  // a valid grid of the referee's own, and two pairs it does not tell apart
  const GRID = O.makeGrids(1, 4242)[0];
  const sharesHouse = (x: number, y: number) => O.HOUSE_CELLS.some((h) => h.includes(x) && h.includes(y));
  const [X, Y] = (() => {
    for (let x = 0; x < 81; x++) for (let y = x + 1; y < 81; y++) if (GRID[x] === GRID[y] && !sharesHouse(x, y)) return [x, y];
    throw new Error('no two cells alike');
  })();
  // Phistomefel's ring with one cell moved to a cell, outside the ring and its corners, that holds the same digit
  const MOVED = (() => {
    for (const from of O.RING) {
      const to = [...Array(81).keys()].find((i) => !O.RING.includes(i) && !O.CORNERS.includes(i) && GRID[i] === GRID[from]);
      if (to !== undefined) return [...O.RING.filter((i) => i !== from), to];
    }
    throw new Error('no cell to move to');
  })();
  const PAIRS: [number[], number[]][] = [
    [[X], [Y]],
    [O.CORNERS, MOVED],
    [MOVED, O.CORNERS]
  ];

  it('is the verdict only once GRIDS_TRIED grids have failed to tell two unequal sets apart', () => {
    expect(O.isValidGrid(GRID)).toBe(true);
    for (const [a, b] of PAIRS) {
      // the referee: not equal, so no count of houses can link them; this grid fills them alike
      expect(O.truthOf(a, b).same).toBe(false);
      expect(O.sameDigits(GRID, a, b)).toBe(true);
      // with grids of its own the module tells them apart
      expect(compareSets(a, b).kind).toBe('differ');
      // with only this grid it runs out after GRIDS_TRIED of them, and says no more
      rig.__fixedGrid = GRID;
      rig.__gridsAsked = 0;
      expect(compareSets(a, b)).toEqual({ kind: 'unproved' });
      expect(rig.__gridsAsked).toBe(GRIDS_TRIED);
      rig.__fixedGrid = undefined;
    }
    // a proved pair asks for no grid at all
    rig.__fixedGrid = GRID;
    rig.__gridsAsked = 0;
    expect(compareSets(O.CORNERS, O.RING).kind).toBe('same');
    expect(rig.__gridsAsked).toBe(0);
  });

  it('claims nothing more, in English, Norwegian and Spanish, on an empty board and on boards being solved', () => {
    const pick = O.rngFrom(7);
    let listsIfProved = 0;
    for (const lang of LANGS) {
      inLang(lang);
      for (const [a, b] of PAIRS) {
        for (const share of [0, 0.3, 0.6, 0.9]) {
          const values = GRID.map((d) => (pick() < share ? d : 0));
          rig.__fixedGrid = GRID;
          const shown = show(a, b, values);
          expect(compareSets(a, b).kind).toBe('unproved');
          expect(shown.verdict).toBe(LINES[lang].unproved);
          // no proof, no Why? (though the proof would start open), no list of digits
          expect(shown.proved).toBe(false);
          expect(shown.why).toBeNull();
          expect(shown.proof).toBeNull();
          expect(shown.html).not.toMatch(/set-proof|<button|set-verdict proved/);
          for (const side of shown.sides) expect(LINES[lang].side.exec(side.text)?.[4], side.text).toBeUndefined();
          // and the rest of what it says, as for any verdict
          readsTrue(a, b, shown, lang, values, GRID);
          rig.__fixedGrid = undefined;
          // a board where a proof would have listed digits a set needs
          if (O.ledgerTruth(a, b, values).some((l) => l.needs.length > 0 && l.needs.length <= l.empty)) listsIfProved++;
        }
      }
    }
    expect(tally.get('en line unproved')).toBe(12);
    expect(tally.get('nb line unproved')).toBe(12);
    expect(tally.get('es line unproved')).toBe(12);
    expect(listsIfProved).toBeGreaterThan(10);
    inLang('en');
  });
});

describe('"×2" and "counted 2 times"', () => {
  // the textbook proof of the ring: the corners with the eight outer boxes
  // cover what the ring covers with rows and columns 1, 2, 8 and 9
  const BOXES = [1, 2, 3, 4, 6, 7, 8, 9].map((b) => 17 + b);
  const LINES_1289 = [0, 1, 7, 8].flatMap((k) => [k, 9 + k]);
  const terms = (houses: number[], times: number) => houses.map((house) => ({ house, times }));
  /** that proof with everything counted twice */
  const DOUBLED: Same = { kind: 'same', scale: 2, withA: terms(BOXES, 2), withB: terms(LINES_1289, 2) };
  /**
   * DOUBLED with rows 1-3 added to the first side and boxes 1-3 to the
   * second (a band covers what its boxes cover), the houses on both sides
   * then cancelled: groups counted once beside groups counted twice
   */
  const MIXED: Same = {
    kind: 'same',
    scale: 2,
    withA: [...terms([2], 1), ...terms([18, 19, 20], 1), ...terms([21, 23, 24, 25, 26], 2)],
    withB: [...terms([0, 1], 1), ...terms([7, 8], 2), ...terms([9, 10, 16, 17], 2)]
  };
  const both = [DOUBLED, MIXED];

  it('are true identities: the referee recounts every cell', () => {
    for (const v of both) expect(O.proofFault(O.CORNERS, O.RING, v.scale, v.withA, v.withB)).toBeNull();
    // and either one at scale 1 is not
    for (const v of both) expect(O.proofFault(O.CORNERS, O.RING, 1, v.withA, v.withB)).not.toBeNull();
  });

  it('are written so that the sentence reads back as the identity, with ×2 on both sets, in every language', () => {
    const pick = O.rngFrom(11);
    const solution = O.makeGrids(1, 99)[0];
    for (const lang of LANGS) {
      inLang(lang);
      for (const v of both) {
        rig.__verdict = v;
        for (const share of [0, 0.5]) {
          const values = solution.map((d) => (pick() < share ? d : 0));
          const shown = show(O.CORNERS, O.RING, values);
          expect(shown.proof).toMatch(/^\[A\] ×2 .*\[B\] ×2 /);
          readsTrue(O.CORNERS, O.RING, shown, lang, values, solution);
        }
      }
    }
    for (const lang of LANGS) {
      expect(tally.get(`${lang} proofs with a scale`)).toBe(4);
      expect(tally.get(`${lang} proofs with a house counted more than once`)).toBe(4);
    }
    inLang('en');
  });

  /** the two sides of MIXED's sentence in a language */
  function mixedSides(lang: Lang): [string, string] {
    inLang(lang);
    rig.__verdict = MIXED;
    const [, , withA, , withB] = LINES[lang].sentence.exec(show(O.CORNERS, O.RING).proof!)!;
    return [withA, withB];
  }

  it('the case: read with the count covering the groups before it too, the sentence is a different, false identity', () => {
    for (const lang of LANGS) {
      const sides = mixedSides(lang);
      // as meant: MIXED's houses
      expect(sides.map((text) => termsKey(readHouses(text, lang)))).toEqual([termsKey(MIXED.withA), termsKey(MIXED.withB)]);
      // read the other way: other counts, which do not add up
      expect(O.proofFault(O.CORNERS, O.RING, 2, readHouses(sides[0], lang, 'run'), readHouses(sides[1], lang, 'run'))).not.toBeNull();
    }
    expect(mixedSides('en')[0]).toBe('row 3, boxes 1, 2 and 3 and boxes 4, 6, 7, 8 and 9 counted 2 times');
  });

  it.fails('LATENT FINDING: a group counted twice reads the same if "counted 2 times" is taken to cover the groups before it too', () => {
    // "[A] ×2 with row 3, boxes 1, 2 and 3 and boxes 4, 6, 7, 8 and 9
    // counted 2 times covers ...": is box 1 counted once or twice?
    for (const lang of LANGS) {
      for (const text of mixedSides(lang)) expect(termsKey(readHouses(text, lang, 'run')), `${lang}: ${text}`).toBe(termsKey(readHouses(text, lang)));
    }
  });
});
