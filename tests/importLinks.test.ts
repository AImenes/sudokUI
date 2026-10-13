/**
 * Links from the sites the community plays on (src/content/importLinks.ts):
 * each format is read as its site writes it, so the fixtures are the sites'
 * own: f-puzzles payloads written by lz-string 1.5.0 itself, SudokuPad ids
 * made by SudokuPad's own converter, zipper and codecs, Sudoku Exchange's
 * shortened form by its own code, and real links from the wild
 * (lisudoku/sudoku_formats' fixtures, spaanse/minimal-killer-sudoku's
 * README). The lz-string port is held to the library on its own output.
 */
import { describe, it, expect } from 'vitest';
import { puzzleFromLink } from '../src/content/importLinks';
import type { LinkResult, LinkSource } from '../src/content/importLinks';
import { compressToBase64, decompressFromBase64 } from '../src/content/lzString';
import { boxOf } from '../src/engine/board';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const ZEROS = EASY.replace(/\./g, '0');

/** f-puzzles' JSON for EASY as its export writes a classic: size, the info, the grid with its given cells */
const givenCell = (ch: string): Record<string, unknown> => (ch === '.' ? {} : { value: Number(ch), given: true });
const fpuzzlesJson = (extra: Record<string, unknown> = {}, cell: (ch: string, i: number) => Record<string, unknown> = givenCell) => ({
  size: 9,
  title: 'Easy one',
  author: 'sudokUI',
  ruleset: 'Normal sudoku rules apply.',
  grid: Array.from({ length: 9 }, (_, r) => Array.from({ length: 9 }, (_, c) => cell(EASY[r * 9 + c], r * 9 + c))),
  ...extra
});

/** the ?load= payload lz-string 1.5.0 itself wrote for fpuzzlesJson() */
const FPUZZLES_EASY = 'N4IgzglgXgpiBcBOANCALhNAbO8QFEBDMATwAIB7AOzlUIFc0ALCgJwXHoBMKBrAVQCSIVK3o4wMNBwBybALaEsZMNz70yYiWUIAHXVhIA6ESADmrCFwQBtG8AC+yR85AA3JfVwBmVGYhuMFQIaGIwTi6gHlheCABMfgFBIWEREe6euABsiYHB8KFeac4OALrI9hkxuCjmSfmF4SXNUZkIvnV5KUUtVbHwAKy5yQWpLenR/QCMww2p5fbFrdUIM50jjRNt8AAcs91NkX3Z+6M9y/0ALKeb4wuRWyu7N2MXuGv+XWeHj/0J63NzscELVPhtXml7sD4AB2F7nJaI8auSa4PYAg5lCoPFHbHIY76/XBwgm3I6ohDosGAw7Q/7UzF3bFLOnw2kU+D4hmE3oc0H1RlvBBDUkQkpQjlUgU8nFC+D06VkontNlIuX8r6be4sjki7lK3FPD6KsVyjr601lUoOIA=';
/** SudokuPad's own JSON for the same puzzle (its f-puzzles converter), as scl… ids: compressed as is, and with its keys shortened by its PuzzleZipper */
const SUDOKUPAD_JSON = '{"id":"fpuzzle44d85a34cb5ae4458a0ec281d6328087","cellSize":50,"cells":[[{},{},{"value":3},{},{"value":2},{},{"value":6},{},{}],[{"value":9},{},{},{"value":3},{},{"value":5},{},{},{"value":1}],[{},{},{"value":1},{"value":8},{},{"value":6},{"value":4},{},{}],[{},{},{"value":8},{"value":1},{},{"value":2},{"value":9},{},{}],[{"value":7},{},{},{},{},{},{},{},{"value":8}],[{},{},{"value":6},{"value":7},{},{"value":8},{"value":2},{},{}],[{},{},{"value":2},{"value":6},{},{"value":9},{"value":5},{},{}],[{"value":8},{},{},{"value":2},{},{"value":3},{},{},{"value":9}],[{},{},{"value":5},{},{"value":1},{},{"value":3},{},{}]],"regions":[[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],[[0,3],[0,4],[0,5],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5]],[[0,6],[0,7],[0,8],[1,6],[1,7],[1,8],[2,6],[2,7],[2,8]],[[3,0],[3,1],[3,2],[4,0],[4,1],[4,2],[5,0],[5,1],[5,2]],[[3,3],[3,4],[3,5],[4,3],[4,4],[4,5],[5,3],[5,4],[5,5]],[[3,6],[3,7],[3,8],[4,6],[4,7],[4,8],[5,6],[5,7],[5,8]],[[6,0],[6,1],[6,2],[7,0],[7,1],[7,2],[8,0],[8,1],[8,2]],[[6,3],[6,4],[6,5],[7,3],[7,4],[7,5],[8,3],[8,4],[8,5]],[[6,6],[6,7],[6,8],[7,6],[7,7],[7,8],[8,6],[8,7],[8,8]]],"cages":[{"value":"title: Easy one"},{"value":"author: sudokUI"},{"value":"rules: Normal sudoku rules apply."}]}';
const SUDOKUPAD_ZIPPED = "{id:'fpuzzle44d85a34cb5ae4458a0ec281d6328087',cs:50,ce:[[,,{v:3},,{v:2},,{v:6},,],[{v:9},,,{v:3},,{v:5},,,{v:1}],[,,{v:1},{v:8},,{v:6},{v:4},,],[,,{v:8},{v:1},,{v:2},{v:9},,],[{v:7},,,,,,,,{v:8}],[,,{v:6},{v:7},,{v:8},{v:2},,],[,,{v:2},{v:6},,{v:9},{v:5},,],[{v:8},,,{v:2},,{v:3},,,{v:9}],[,,{v:5},,{v:1},,{v:3},,]],re:[[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]],[[0,3],[0,4],[0,5],[1,3],[1,4],[1,5],[2,3],[2,4],[2,5]],[[0,6],[0,7],[0,8],[1,6],[1,7],[1,8],[2,6],[2,7],[2,8]],[[3,0],[3,1],[3,2],[4,0],[4,1],[4,2],[5,0],[5,1],[5,2]],[[3,3],[3,4],[3,5],[4,3],[4,4],[4,5],[5,3],[5,4],[5,5]],[[3,6],[3,7],[3,8],[4,6],[4,7],[4,8],[5,6],[5,7],[5,8]],[[6,0],[6,1],[6,2],[7,0],[7,1],[7,2],[8,0],[8,1],[8,2]],[[6,3],[6,4],[6,5],[7,3],[7,4],[7,5],[8,3],[8,4],[8,5]],[[6,6],[6,7],[6,8],[7,6],[7,7],[7,8],[8,6],[8,7],[8,8]]],ca:[{v:'title: Easy one'},{v:'author: sudokUI'},{v:'rules: Normal sudoku rules apply.'}]}";
const SCL_PLAIN = 'sclN4IglgJiBcIGYAcCuAvFAbApgFmxAHAKwCGAzNgMYBGJO2h+xADJhQEz4CMEAbKR03wB2EABoQFTOnQBlMCkwxCTcZOkBnGAG0twAL6j9hkADdi6JIuikDR0GYtW2t26fOWYPF4b0BdUbpujjAAnN52QR7W4ZFWhOGuDlGcfgF2ie5WKcZJVvgxuZ4ZwdDYCf66BZkw+TnV0NkRhdDOdSVhPj4V9vVCCZ3pA8VR+d1VJV5tUX0DsTXDTuVp41GtPRMrVh3rUfFD3XPQtYM7i7PNNkNTW6mV5/V7TfWNCzCX6b7+IABOmADmYAA9gA7TTQHRaFRMCoqTgw0RsCqcUTQgLIuFohEVNgo7GiDFaHGIiqQ0SkeHYeGEJFkmmUzHUgI48lM0T0wmiakklQ8eFCeH4Gm8zH8zGC1nCjmijmCkmkXEBeUE+WIgLYBVadUE9WqrSEDX6gn64kBLTyllmtkVeWMzW0tVWh22/UW/Xs/Vc03yyXy6Xy8V2yXq6XqgP6yX66X62WmngauMEuO6oQalMElO6/AarMErMmnRxi1x9lx20pi0p9kp21Zi1Z9lZz0F0SSuPSuMBlOSlPSlMBrOSrPSrOyr4UYh/TBgwLNEAAFzAc6w0AABABRYjqACeK5BilesGISDnAAtAd9V+okBBAQBrACqAEkQAefkgsOpVwA5c8AW3MK5Xjet5ICu3zvlOK7EAgCDoFuAB0L6+HoQA';
const SCL_ZIPPED = 'sclN4SwJgXA5AZgDgVwF5IDYFMAsmwA4CsAhgMyYDGARkVpvroQAzpkBMuAjGAGzFsO4B2KABoyAZwj4Go9BADac4cOAA3CMQC+S1RBZblarvoC6wuToCc+g+v0781new2nFN5zdx3DWnZhNm2mpe7t66vmpWSq46AtZKCTperkEQRjZxqSE6etGBNrk66TZR9gHmwY5quTaaiZEu+WWpHrUmpgBOsgpy0gyu0uwDwiyu7ML9ZuNDUyOuLBPzwjNyC6OuvcLEw5jD+GNbB7uz+2YL22fCx6vC+xvSXMMCw7gHj7PPs6+X7zefN68NsRFmZgStgaMzJgQXJoStoZC5PgYciVsj1mY5MCLlirq5gadYYcoXiSYTkTjkddkXdMcDfsD/sDvkTftD/tCWcjfsj/sjAZiuDChSshYiBDCJSsJYjcDC5Ss5RiFEKcULrkLCRKcRLrhLCXKcXLrnLaSrhL8hf8hSyJb8Jf8JSy5b85f85YDTGRCPIdFAAC4gf0YCAAAgAooQxABPUMAewAdugoBFoIQEP6ABZxjphsQIMBxgDWAFUAJIpmxQDoIDASUMAORzAFtCKhQ/nC0WEKGa3XQ4Q4HBUNGAHQp4waIA==';
/** SudokuPad's scf and classic ids for the puzzle, by its puzzletools.js codecs */
const SCF = 'scfADCQTDPL1I6i8B2TvAS6H8g2G9PSCNTFBN';
const CLASSIC_RUNS = 'classicADCQTDPL1I6i8B2TvAS6H8g2G9PSCNTFBN';
const CLASSIC_BLANKS = 'classicC3B2B6C9C3B5C1C18B64E81B29C7H8C67B82E26B95C8C2B3C9C5B1B3C';
/** Sudoku Exchange's shortened s= for the puzzle, by its own code (the same digit runs) */
const SE_SHORT = 'ADCQTDPL1I6i8B2TvAS6H8g2G9PSCNTFBN';
/** real f-puzzles links from the wild: two variants with most constraints at once, and a lone 1 in r1c1 */
const FPUZZLES_VARIANT = 'N4IgzglgXgpiBcBOANCA5gJwgEwQbT2AF9ljSTQMY0IB7AOwQAYLXz3iBdZQty6uo3gBGVADcAhgBsArnBGoaYmEIAuGORRCTZ8gEyKIytRphadchAGZDxhOs0c+Rbryfuyn1q68fnTn39fYO8eEL8/QIjwryiYoNC3eOiXbhBsCAk0BmkAantTVAysnKkAWgK5VAl6VQgAa3oINAALVUqYatqGiHo0DtQYAA91CSoaBnxQAGMYKSkwfBAAJQBWAGE9EFQ19attlY2AFgPlgDY904uTnYB2S7v1m5X71dOADnW3zhdUWmxcPBCCBZvMEC91sIQL8QDA7ECZnMpODlp8oTDVC0YBgALa0HEwVTYqYgKS9GCLIF4FbCdZnU6024M9bvU56daIU5WDkgTg/NIAB2kvWwGHx8mBZPoFPw1OWtLeO3Z9J23KZqpZvP5qCo9AARjUSVKZVSIVDHlsdhd9jtjqcNoqVkc6fb1urDpqrTy+TD6hB5tjplkJYj5pS5dzzStuZanZDTs7Y7so7stmkLPIQHotjCMgAzPPYlSzEmghZLZaIJ6nKvfLRl8MrKsqptfXkwjASOq0UtIxuVt01zU/UggvsVqucnZV1nakBjMUAdyN5PDcudLeWzvdW89HtZXoPENnaQbFedjt39LnxpX0rXZtO9yT1tdz12l43rp3GyP529aS0DIqjGus4KYBIACeByLjgmLMAAdAYIAQGAAByMCLusDBgKMvTtPAAAEDhmD8QA===';
const FPUZZLES_VARIANT_2 = 'N4IgzglgXgpiBcBOANCA5gJwgEwQbT2AF9ljSTQMY0IB7AOwQAYLXz3iBdZQty6uo3gBGVADcAhgBsArnBGoaYmEIAuGORRCTZ8gEyKIytRphadchAGZDxhOs0c+Rbryfuyn1q68fnTn39fYO8eEL8/QIjwryiYoNC3eOiXbhBsCAk0BmkAantTVAysnKkAWgK5VAl6VQgAa3oINAALVUqYatqGiHo0DtQYAA91CSoaBnxQAGMYKSkwfBAAJQBWAGE9EFQ19attlY2AFgPlgDY904uTnYB2S7v1m5X71dOADnW3zhdUWmxcPBCCBZvMEC91sIQL8QDA7ECZnMpODlp8oTDVC0YBgALa0HEwVTYqYgKS9GCLIF4FbCdZnU6024M9bvU56daIU5WDkgTg/NIZABmguxKlmJNBCyWy0QT1Osu+WkllOpMrp8q+vJhGAkdVoEqRKpWsqZO1lrJ+pBBhulss5ZpZWrSYwwtAA7iSyfQKfhVUd1Tt/aaVv7WTsNmGVhdI8t7ha0srpf63oH1fyiEA=';
const FPUZZLES_ONE = 'N4IgzglgXgpiBcBOANCA5gJwgEwQbT1ADcBDAGwFc54BGVNCImAOwQBcMqBfZYHv3vyGCRfALrJCwgTOlyJU0XKVKFsles1c1yrRu2S9R+Yd1nVp/Vdk7r58WK5A';
/** a real SudokuPad link from the wild: a 6×6 killer */
const SUDOKUPAD_KILLER_6 = 'https://sudokupad.app/fpuzN4IgzglgXgpiBcA2ANCALhNAbO8QFkIA7CAWwEMsACRAdcSoGkIscAnKgZQFcATAewDW3EKnLc0AC35sEITgAdy5ImBhUAZFQBqM8gLCiQbbjjVo5AORkVqYPkO5UTZquQUKsATwB0AHSJmVhg2eCoAEQgAc0wwKmIqAGNyKJg45KIifjRnGAUYchyVXipSbjAc+1IqNH4ayXVatEoqGIA3GCIfIyi2CF4EAG1B4ABfZDGJ8cmZ0YBdZBHp5anVsYWltZXZjdmtrd3to6nD/b31hZBBFnZk1KHQRJhWQ3hBkAAlAEYAYQBmIwfABM/xAlzalG4uBAAOmICeLyGnxBABZAX9QagPhi0eDIdCAOwgOEIrCvd4fFE/L6AgCs1LBqAhWChci+NJJzzJSMpP1pdL5jJAzNZeAAHMTLmB+CyMPwiEi0ah+aggUZEEYaagAdr1ZqjGrUEqQCqQIaYUZjVqTXrUBrUNbTTqzZajKbzc7jfaQNbrV63UZnWq5qMgA';

/** SudokuPad's JSON with something changed, as an scl id */
const sclOf = (change: (p: any) => void) => {
  const p = JSON.parse(SUDOKUPAD_JSON);
  change(p);
  return `scl${compressToBase64(JSON.stringify(p))}`;
};

const ok = (puzzle: string, source: LinkSource | null) => ({ ok: true, puzzle, source });
const refused = (r: LinkResult | null) => {
  if (!r || r.ok) throw new Error(`not a refusal: ${JSON.stringify(r)}`);
  return r;
};
const found = (r: LinkResult | null) => {
  const f = refused(r);
  if (f.reason !== 'variant') throw new Error(`not a variant: ${JSON.stringify(f)}`);
  return f.found;
};

describe('the lz-string port', () => {
  it('writes what lz-string writes', () => {
    expect(compressToBase64(JSON.stringify(fpuzzlesJson()))).toBe(FPUZZLES_EASY);
    expect(compressToBase64(SUDOKUPAD_JSON)).toBe(SCL_PLAIN.slice(3));
    expect(compressToBase64(SUDOKUPAD_ZIPPED)).toBe(SCL_ZIPPED.slice(3));
  });

  it('reads what lz-string wrote', () => {
    expect(JSON.parse(decompressFromBase64(FPUZZLES_EASY)!)).toEqual(fpuzzlesJson());
    expect(decompressFromBase64(SCL_PLAIN.slice(3))).toBe(SUDOKUPAD_JSON);
    expect(decompressFromBase64(SCL_ZIPPED.slice(3))).toBe(SUDOKUPAD_ZIPPED);
    expect(JSON.parse(decompressFromBase64(FPUZZLES_ONE)!).grid[0][0]).toEqual({ value: 1, given: true });
  });

  it('round-trips text of every kind, code unit by code unit', () => {
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 48271) % 2147483647), seed % n);
    const alphabets = ['ab', ' {}[]":,0123456789', 'æøåñ∑€ü', 'abcdefghijklmnopqrstuvwxyzABC', '🙂😀x', 'a\u0000￿'];
    for (let k = 0; k < 400; k++) {
      const letters = [...alphabets[rnd(alphabets.length)]];
      const text = Array.from({ length: rnd(200) }, () => letters[rnd(letters.length)]).join('');
      const packed = compressToBase64(text);
      expect(packed).toMatch(/^[A-Za-z0-9+/]*={0,3}$/);
      expect(packed.length % 4).toBe(0);
      expect(decompressFromBase64(packed)).toBe(text);
    }
    expect(decompressFromBase64(compressToBase64(''))).toBe('');
  });

  it('refuses what is not a stream', () => {
    expect(decompressFromBase64('')).toBeNull();
    expect(decompressFromBase64('not*base64')).toBeNull();
    expect(decompressFromBase64('1234')).toBeNull();
  });
});

describe('f-puzzles links', () => {
  it('open a classic, from the site and from a tool that only wrote values', () => {
    expect(puzzleFromLink(`https://f-puzzles.com/?load=${FPUZZLES_EASY}`)).toEqual(ok(EASY, 'fpuzzles'));
    expect(puzzleFromLink(`https://www.f-puzzles.com/?load=${encodeURIComponent(FPUZZLES_EASY)}`)).toEqual(ok(EASY, 'fpuzzles'));
    // a + read as a space somewhere on the way still decodes
    expect(puzzleFromLink(`https://f-puzzles.com/?load=${FPUZZLES_EASY.replace(/\+/g, '%20')}`)).toEqual(ok(EASY, 'fpuzzles'));
    expect(puzzleFromLink(`https://f-puzzles.com/?load=${FPUZZLES_ONE}`)).toEqual(ok('1' + '.'.repeat(80), 'fpuzzles'));
    const values = compressToBase64(JSON.stringify(fpuzzlesJson({}, (ch) => (ch === '.' ? {} : { value: Number(ch) }))));
    expect(puzzleFromLink(`https://f-puzzles.com/?load=${values}`)).toEqual(ok(EASY, 'fpuzzles'));
    // a solver's digits beside the givens are not givens
    const solving = compressToBase64(JSON.stringify(fpuzzlesJson({}, (ch) => (ch === '.' ? { value: 5 } : { value: Number(ch), given: true }))));
    expect(puzzleFromLink(`https://f-puzzles.com/?load=${solving}`)).toEqual(ok(EASY, 'fpuzzles'));
    // a cell's own box written out as its region is no variant; another region is
    const boxed = compressToBase64(JSON.stringify(fpuzzlesJson({}, (ch) => (ch === '.' ? { region: 0 } : { value: Number(ch), given: true }))));
    expect(found(puzzleFromLink(`https://f-puzzles.com/?load=${boxed}`))).toEqual(['irregularregions']);
    const own = compressToBase64(JSON.stringify(fpuzzlesJson({}, (ch, i) => ({ ...givenCell(ch), region: boxOf(i) }))));
    expect(puzzleFromLink(`https://f-puzzles.com/?load=${own}`)).toEqual(ok(EASY, 'fpuzzles'));
  });

  it('refuse a variant with what it carries', () => {
    const r = found(puzzleFromLink(`https://f-puzzles.com/?load=${FPUZZLES_VARIANT}`));
    for (const mark of ['irregularregions', 'diagonals', 'antiknight', 'antiking', 'extraregions', 'parity', 'thermometers', 'palindromes', 'renban', 'killercages', 'kropki', 'arrows', 'lines']) {
      expect(r).toContain(mark);
    }
    const r2 = found(puzzleFromLink(`https://f-puzzles.com/?load=${FPUZZLES_VARIANT_2}`));
    for (const mark of ['irregularregions', 'diagonals', 'antiknight', 'antiking', 'extraregions', 'parity', 'thermometers', 'kropki', 'arrows']) {
      expect(r2).toContain(mark);
    }
    const link = (extra: Record<string, unknown>) => `https://f-puzzles.com/?load=${compressToBase64(JSON.stringify(fpuzzlesJson(extra)))}`;
    expect(found(puzzleFromLink(link({ 'diagonal+': true })))).toEqual(['diagonals']);
    expect(found(puzzleFromLink(link({ killercage: [{ cells: ['R1C1', 'R1C2'], value: '10' }] })))).toEqual(['killercages']);
    expect(found(puzzleFromLink(link({ arrow: [{ cells: ['R1C1'], lines: [['R1C1', 'R1C2']] }], xv: [{ cells: ['R2C1', 'R2C2'], value: 'V' }] })))).toEqual(['arrows', 'xv']);
    expect(found(puzzleFromLink(link({ cage: [{ cells: ['R1C1'] }] })))).toEqual(['cages']);
    expect(found(puzzleFromLink(link({ negative: ['xv'] })))).toEqual(['negative']);
    expect(found(puzzleFromLink(link({ somethingnew: [{ cells: ['R1C1'] }] })))).toEqual(['other']);
    // a rule switched off, an empty list and a cosmetic cage with no cells (SudokuPad's metadata) are no variant
    expect(puzzleFromLink(link({ antiknight: false, thermometer: [], cage: [{ value: 'title: Easy one' }] }))).toEqual(ok(EASY, 'fpuzzles'));
  });

  it('refuse other sizes, short ids and what does not decode', () => {
    expect(refused(puzzleFromLink(`https://f-puzzles.com/?load=${compressToBase64(JSON.stringify(fpuzzlesJson({ size: 6 })))}`)).reason).toBe('size');
    const six = compressToBase64(JSON.stringify({ size: 6, grid: Array.from({ length: 6 }, () => Array.from({ length: 6 }, () => ({}))) }));
    expect(refused(puzzleFromLink(`https://f-puzzles.com/?load=${six}`)).reason).toBe('size');
    expect(refused(puzzleFromLink('https://f-puzzles.com/?id=yc8nb3p4'))).toEqual({ ok: false, reason: 'short-id', source: 'fpuzzles' });
    expect(refused(puzzleFromLink('https://f-puzzles.com/?load=1234'))).toEqual({ ok: false, reason: 'unreadable', source: 'fpuzzles' });
    expect(refused(puzzleFromLink('https://f-puzzles.com/'))).toEqual({ ok: false, reason: 'no-puzzle', source: 'fpuzzles' });
  });
});

describe('SudokuPad links', () => {
  it('open an f-puzzles payload under either prefix, on every host and address shape', () => {
    expect(puzzleFromLink(`https://sudokupad.app/fpuz${FPUZZLES_EASY}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/fpuzzles${FPUZZLES_EASY}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://beta.sudokupad.app/sudoku/fpuz${FPUZZLES_EASY}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/?puzzleid=fpuz${FPUZZLES_EASY}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.svencodes.com/puzzle/fpuz${encodeURIComponent(FPUZZLES_EASY)}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://app.crackingthecryptic.com/sudoku/${SCL_ZIPPED}`)).toEqual(ok(EASY, 'sudokupad'));
  });

  it("open SudokuPad's own JSON, shortened or not, under scl and ctc, and the id pasted alone", () => {
    expect(puzzleFromLink(`https://sudokupad.app/${SCL_PLAIN}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/${SCL_ZIPPED}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/${SCL_ZIPPED.replace(/^scl/, 'ctc')}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(SCL_ZIPPED)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`fpuz${FPUZZLES_EASY}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`sudokupad.app/${SCL_PLAIN}`)).toEqual(ok(EASY, 'sudokupad'));
  });

  it('put back a slash a chat app folded away', () => {
    // a payload with a double slash in it: twelve 1 bits in a row, which a
    // title character beyond Latin gives (U+7FFF is fifteen ones), so the
    // links this matters for are the ones with such titles
    const payload = compressToBase64(JSON.stringify(fpuzzlesJson({ title: 'Puzzle \u7fff' })));
    expect(payload).toContain('//');
    expect(puzzleFromLink(`https://sudokupad.app/fpuz${payload.replace('//', '/')}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/fpuz${payload.replace(/\/\//g, '/')}`)).toEqual(ok(EASY, 'sudokupad'));
  });

  it('read the compact scf and classic ids, with their titles and rules', () => {
    expect(puzzleFromLink(`https://sudokupad.app/${SCF}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/${SCF}*tEasy one*asudokUI`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/${SCF}*tA%20**%20b%20x*aMe`)).toEqual(ok(EASY, 'sudokupad'));
    expect(found(puzzleFromLink(`https://sudokupad.app/${SCF}*x`))).toEqual(['diagonals']);
    expect(found(puzzleFromLink(`https://sudokupad.app/${SCF}*wxtTitle`))).toEqual(['windoku', 'diagonals']);
    expect(found(puzzleFromLink(`https://sudokupad.app/${SCF}x`))).toEqual(['diagonals']);
    // a blank grid as SudokuPad's codec writes it; the id its author's notes call blank (scfoooooooooooook) reads, by that codec, with a 6 in r9c7
    expect(puzzleFromLink('https://sudokupad.app/scfoooooooooooooK')).toEqual(ok('.'.repeat(81), 'sudokupad'));
    expect(puzzleFromLink('https://sudokupad.app/scfoooooooooooook')).toEqual(ok(`${'.'.repeat(78)}6..`, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/${CLASSIC_RUNS}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(puzzleFromLink(`https://sudokupad.app/${CLASSIC_BLANKS}`)).toEqual(ok(EASY, 'sudokupad'));
    expect(refused(puzzleFromLink('https://sudokupad.app/scf^^^')).reason).toBe('unreadable');
  });

  it('refuse a variant with what it carries, and other sizes', () => {
    expect(found(puzzleFromLink(sclOf((p) => p.cages.push({ cells: [[0, 0], [0, 1]], value: '10' }))))).toEqual(['cages']);
    expect(found(puzzleFromLink(sclOf((p) => (p.lines = [{ wayPoints: [[0.5, 0.5], [0.5, 3.5]], color: '#000', thickness: 8 }]))))).toEqual(['lines']);
    expect(found(puzzleFromLink(sclOf((p) => (p.arrows = [{ wayPoints: [[0.5, 0.5], [1.5, 1.5]] }]))))).toEqual(['arrows']);
    expect(found(puzzleFromLink(sclOf((p) => (p.underlays = [{ center: [0.5, 0.5], width: 1, height: 1, backgroundColor: '#CFCFCF' }]))))).toEqual(['shapes']);
    expect(found(puzzleFromLink(sclOf((p) => (p.foglight = [[0, 0]]))))).toEqual(['fog']);
    // two cells swapped between boxes: irregular regions
    expect(found(puzzleFromLink(sclOf((p) => ([p.regions[0][0], p.regions[1][0]] = [p.regions[1][0], p.regions[0][0]]))))).toEqual(['irregularregions']);
    expect(refused(puzzleFromLink(sclOf((p) => (p.cells = p.cells.slice(0, 6).map((row: unknown[]) => row.slice(0, 6)))))).reason).toBe('size');
    expect(refused(puzzleFromLink(SUDOKUPAD_KILLER_6))).toEqual({ ok: false, reason: 'size', source: 'sudokupad' });
    // a value marked as not given is a solver's
    expect(puzzleFromLink(sclOf((p) => (p.cells[0][0] = { value: 5, given: false })))).toEqual(ok(EASY, 'sudokupad'));
  });

  it('refuse a short id, which only SudokuPad can look up', () => {
    expect(refused(puzzleFromLink('https://sudokupad.app/6dP4FN27HB'))).toEqual({ ok: false, reason: 'short-id', source: 'sudokupad' });
    expect(refused(puzzleFromLink('https://sudokupad.app/sudoku/6dP4FN27HB'))).toEqual({ ok: false, reason: 'short-id', source: 'sudokupad' });
    expect(refused(puzzleFromLink('https://sudokupad.app/pdyxs/whispers-in-the-mist'))).toEqual({ ok: false, reason: 'short-id', source: 'sudokupad' });
    expect(refused(puzzleFromLink('https://sudokupad.app/'))).toEqual({ ok: false, reason: 'no-puzzle', source: 'sudokupad' });
    expect(refused(puzzleFromLink('https://sudokupad.app/sclnot*a*payload'))).toEqual({ ok: false, reason: 'unreadable', source: 'sudokupad' });
  });
});

describe('Sudoku Exchange links', () => {
  it('open the 81 digits of a play link, long or shortened, however the empties are written', () => {
    expect(puzzleFromLink(`https://sudokuexchange.com/play/?s=${ZEROS}&d=1`)).toEqual(ok(EASY, 'sudokuexchange'));
    expect(puzzleFromLink(`https://www.sudokuexchange.com/play/?s=${EASY}`)).toEqual(ok(EASY, 'sudokuexchange'));
    expect(puzzleFromLink(`https://sudokuexchange.com/play/?s=${ZEROS.replace(/0/g, '_')}&d=2&v=sbf`)).toEqual(ok(EASY, 'sudokuexchange'));
    expect(puzzleFromLink(`https://sudokuexchange.com/play/?s=${SE_SHORT}&d=3&v=sbt`)).toEqual(ok(EASY, 'sudokuexchange'));
    expect(puzzleFromLink(`https://sudokuexchange.com/play/?d=3&s=${SE_SHORT}`)).toEqual(ok(EASY, 'sudokuexchange'));
  });

  it('read a line of the puzzle bank', () => {
    expect(puzzleFromLink(`6a3f0c9e1b2d ${ZEROS}  1.2`)).toEqual(ok(EASY, 'sudokuexchange'));
  });

  it('refuse an address without a puzzle, or with too few digits', () => {
    expect(refused(puzzleFromLink('https://sudokuexchange.com/play/'))).toEqual({ ok: false, reason: 'no-puzzle', source: 'sudokuexchange' });
    expect(refused(puzzleFromLink('https://sudokuexchange.com/play/?s=12345'))).toEqual({ ok: false, reason: 'unreadable', source: 'sudokuexchange' });
  });
});

describe('sudoku.coach links', () => {
  it('open the 81 cells of a play or solver address', () => {
    expect(puzzleFromLink(`https://sudoku.coach/en/play/${ZEROS}`)).toEqual(ok(EASY, 'sudokucoach'));
    expect(puzzleFromLink(`https://sudoku.coach/de/solver/${EASY}`)).toEqual(ok(EASY, 'sudokucoach'));
    expect(puzzleFromLink(`https://sudoku.coach/en/play/custom/${ZEROS.replace(/0/g, '_')}`)).toEqual(ok(EASY, 'sudokucoach'));
  });

  it('refuse a share id and an address without a puzzle', () => {
    expect(refused(puzzleFromLink('https://sudoku.coach/en/s/abc123'))).toEqual({ ok: false, reason: 'short-id', source: 'sudokucoach' });
    expect(refused(puzzleFromLink('https://sudoku.coach/en/play'))).toEqual({ ok: false, reason: 'no-puzzle', source: 'sudokucoach' });
  });
});

describe("links in sentences, the app's own links and bare strings", () => {
  it('find the link inside a sentence, without the full stop it drags along', () => {
    expect(puzzleFromLink(`Try this one: https://sudokuexchange.com/play/?s=${ZEROS}&d=3.`)).toEqual(ok(EASY, 'sudokuexchange'));
    expect(puzzleFromLink(`(from sudokupad.app/${SCL_ZIPPED})`)).toEqual(ok(EASY, 'sudokupad'));
  });

  it("open the app's own share links on any origin", () => {
    expect(puzzleFromLink(`https://sudokui.app/p/${EASY}?b=easy&s=100`)).toEqual(ok(EASY, 'sudokui'));
    expect(puzzleFromLink(`https://sudokui.app/nb/p/${EASY}/`)).toEqual(ok(EASY, 'sudokui'));
    expect(puzzleFromLink(`http://localhost:4173/#p=${EASY}`)).toEqual(ok(EASY, 'sudokui'));
    expect(puzzleFromLink('https://sudokui.app/#s=abc')).toBeNull();
  });

  it('take the bare 81 characters as before, and 81 cells in any other address', () => {
    expect(puzzleFromLink(EASY)).toEqual(ok(EASY, null));
    expect(puzzleFromLink(` ${ZEROS}\n`)).toEqual(ok(EASY, null));
    expect(puzzleFromLink(Array.from({ length: 9 }, (_, r) => EASY.slice(r * 9, r * 9 + 9)).join('\n'))).toEqual(ok(EASY, null));
    expect(puzzleFromLink(`https://example.org/sudoku/${ZEROS}`)).toEqual(ok(EASY, null));
    expect(puzzleFromLink('hello')).toBeNull();
    expect(puzzleFromLink(EASY.slice(1))).toBeNull();
    expect(puzzleFromLink('https://example.org/nothing')).toBeNull();
  });
});
