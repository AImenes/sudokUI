/**
 * Positions as text (src/content/textGrid.ts): the pencil-mark grid the
 * forums paste is written the way HoDoKu writes it, and read back in the
 * variants people draw by hand, beside HoDoKu's library string and the
 * 81-character line with its candidates.
 */
import { describe, it, expect } from 'vitest';
import { formatPencilGrid, parsePencilGrid, puzzleStringOf, looksLikeGrid, shownCandidates } from '../src/content/textGrid';
import type { MarkedCell } from '../src/content/textGrid';
import { parseGrid, bit, digitsOf } from '../src/engine/board';
import { EXAMPLES } from '../src/content/examples';
import type { Tech } from '../src/engine/ratings';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

/** the board at a puzzle's start, nothing written */
function fresh(puzzle: string): MarkedCell[] {
  const g = parseGrid(puzzle)!;
  return Array.from({ length: 81 }, (_, i) => ({ value: g.values[i], corner: 0, center: 0, excluded: 0 }));
}

/** a worked example's stored position as a board: its candidates as centre marks */
function stored(tech: Tech) {
  const ex = EXAMPLES[tech]!;
  const cells: MarkedCell[] = Array.from({ length: 81 }, (_, i) => ({
    value: Number(ex.values[i]),
    corner: 0,
    center: ex.cands[i],
    excluded: 0
  }));
  const values = [...ex.values].map(Number);
  const cands = ex.cands.map((c, i) => (values[i] ? 0 : c));
  return { cells, values, cands };
}

const runs = (cands: number[]) => cands.map((c) => digitsOf(c).join(''));

describe('the pencil-mark grid', () => {
  it('is written the way HoDoKu writes it: every column as wide as the widest cell, the boxes framed', () => {
    expect(formatPencilGrid(fresh(EASY), true, 'unknown')).toBe(
      [
        '.----------------------.----------------------.----------------------.',
        '| 45     4578   3      | 49     2      147    | 6      5789   57     |',
        '| 9      24678  47     | 3      47     5      | 78     278    1      |',
        '| 25     257    1      | 8      79     6      | 4      23579  2357   |',
        ':----------------------+----------------------+----------------------:',
        '| 345    345    8      | 1      3456   2      | 9      34567  34567  |',
        '| 7      123459 49     | 459    34569  4      | 1      13456  8      |',
        '| 1345   13459  6      | 7      3459   8      | 2      1345   345    |',
        ':----------------------+----------------------+----------------------:',
        '| 134    1347   2      | 6      478    9      | 5      1478   47     |',
        '| 8      1467   47     | 2      457    3      | 17     1467   9      |',
        '| 46     4679   5      | 4      1      47     | 3      24678  2467   |',
        "'----------------------'----------------------'----------------------'"
      ].join('\n')
    );
  });

  it('shows what the board shows: auto candidates less the strikes, marks under the exhaustive contract, else every candidate', () => {
    const cells = fresh(EASY);
    const g = parseGrid(EASY)!;
    // r1c1 holds 45; the player marks 4 alone and strikes 5 in the auto view
    cells[0].center = bit(4);
    cells[0].excluded = bit(5);
    cells[1].corner = bit(7) | bit(8);
    expect(runs(shownCandidates(cells, true, 'unknown')).slice(0, 3)).toEqual(['4', '4578', '']);
    expect(runs(shownCandidates(cells, false, 'exhaustive')).slice(0, 3)).toEqual(['4', '78', '']);
    expect(runs(shownCandidates(cells, false, 'open')).slice(0, 3)).toEqual(['45', '4578', '']);
    expect(runs(shownCandidates(cells, false, 'unknown'))).toEqual(runs(Array.from(g.cands, (c, i) => (g.values[i] ? 0 : c))));
    // an empty cell with nothing left is a dot, so the grid keeps its shape
    cells[0].excluded = bit(4) | bit(5);
    expect(formatPencilGrid(cells, true, 'unknown').split('\n')[1]).toBe('| .      4578   3      | 49     2      147    | 6      5789   57     |');
  });

  it('round-trips a position, candidates and all', () => {
    for (const tech of ['XY_CHAIN', 'X_WING', 'NICE_LOOP', 'JELLYFISH'] as Tech[]) {
      const { cells, values, cands } = stored(tech);
      const text = formatPencilGrid(cells, false, 'exhaustive');
      expect(text.split('\n'), tech).toHaveLength(13);
      const back = parsePencilGrid(text);
      expect(back, tech).not.toBeNull();
      expect(back!.values, tech).toEqual(values);
      expect(back!.cands, tech).toEqual(cands);
      expect(back!.given, tech).toEqual(values.map(Boolean));
    }
  });

  it('reads a cell written as one digit as placed, which is how the forums read it', () => {
    // r5c6 of the puzzle at its start has one candidate, 4, and is written "4"
    const back = parsePencilGrid(formatPencilGrid(fresh(EASY), true, 'unknown'))!;
    expect(back.values[41]).toBe(4);
    expect(back.given[41]).toBe(true);
    expect(back.cands![41]).toBe(0);
  });
});

/** the X-Wing example's position, as a forum post would draw it */
const X_WING = stored('X_WING');

describe('grids written by hand', () => {
  const read = (text: string) => {
    const p = parsePencilGrid(text);
    expect(p).not.toBeNull();
    return p!;
  };

  it('with plus-and-minus box lines and uneven spacing', () => {
    const p = read(`
+-------------+-------------+-------------+
| 2  13  8    | 7  9   5    | 6  13  4    |
| 6  137 147  | 8  2   34   | 17 9   5    |
| 9  5   47   | 6  1   34   | 2  37  8    |
+-------------+-------------+-------------+
| 7  9   5    | 4  3   2    | 8  6   1    |
| 1  2   3    | 9  6   8    | 5  4   7    |
| 4  8   6    | 1  5   7    | 3  2   9    |
+-------------+-------------+-------------+
| 8  4   2    | 3  7   1    | 9  5   6    |
| 3  6   17   | 5  8   9    | 4  17  2    |
| 5  17  9    | 2  4   6    | 17 8   3    |
+-------------+-------------+-------------+
`);
    expect(p.values).toEqual(X_WING.values);
    expect(p.cands).toEqual(X_WING.cands);
  });

  it('with bars but no box lines, and a caption around it', () => {
    const p = read(`Stuck here, what do I do next?

| 2 13 8 | 7 9 5 | 6 13 4 |
| 6 137 147 | 8 2 34 | 17 9 5 |
| 9 5 47 | 6 1 34 | 2 37 8 |
| 7 9 5 | 4 3 2 | 8 6 1 |
| 1 2 3 | 9 6 8 | 5 4 7 |
| 4 8 6 | 1 5 7 | 3 2 9 |
| 8 4 2 | 3 7 1 | 9 5 6 |
| 3 6 17 | 5 8 9 | 4 17 2 |
| 5 17 9 | 2 4 6 | 17 8 3 |

I see the 7s in r28c38 but is that an X-Wing?`);
    expect(p.values).toEqual(X_WING.values);
    expect(p.cands).toEqual(X_WING.cands);
  });

  it('as bare rows of cells, with HoDoKu-style corners or stars in the frame', () => {
    const rows = `2 13 8 7 9 5 6 13 4
6 137 147 8 2 34 17 9 5
9 5 47 6 1 34 2 37 8
7 9 5 4 3 2 8 6 1
1 2 3 9 6 8 5 4 7
4 8 6 1 5 7 3 2 9
8 4 2 3 7 1 9 5 6
3 6 17 5 8 9 4 17 2
5 17 9 2 4 6 17 8 3`;
    expect(read(rows).cands).toEqual(X_WING.cands);
    const starred = `*-----------------------*\n${rows.replace(/\n/g, '\n|')}\n*-----------------------*`;
    expect(read(starred).values).toEqual(X_WING.values);
    expect(read(starred).cands).toEqual(X_WING.cands);
  });

  it('a grid of digits and dots is the puzzle, with no candidates', () => {
    const text = `
+-------+-------+-------+
| . . 3 | . 2 . | 6 . . |
| 9 . . | 3 . 5 | . . 1 |
| . . 1 | 8 . 6 | 4 . . |
+-------+-------+-------+
| . . 8 | 1 . 2 | 9 . . |
| 7 . . | . . . | . . 8 |
| . . 6 | 7 . 8 | 2 . . |
+-------+-------+-------+
| . . 2 | 6 . 9 | 5 . . |
| 8 . . | 2 . 3 | . . 9 |
| . . 5 | . 1 . | 3 . . |
+-------+-------+-------+`;
    const p = read(text);
    expect(p.cands).toBeNull();
    expect(p.values.map((v) => (v ? String(v) : '.')).join('')).toBe(EASY);
    expect(puzzleStringOf(text)).toBe(EASY);
  });

  it('refuses what is not a grid', () => {
    expect(parsePencilGrid(EASY)).toBeNull();
    expect(parsePencilGrid('| 2 13 8 | 7 9 5 | 6 13 4 |\n'.repeat(8))).toBeNull();
    expect(parsePencilGrid('r1c1 is 4 or 5, r1c2 is 4, 5, 7 or 8')).toBeNull();
    expect(parsePencilGrid('')).toBeNull();
    expect(parsePencilGrid('| 2 13 8 | 7 9 5 | 6 13 |\n'.repeat(9))).toBeNull();
  });
});

describe('the library string and the line with candidates', () => {
  // the puzzle with 4 placed in r5c6 by the solver, and 5 taken out of r1c1 and 7 out of r1c2
  const placed = `${EASY.slice(0, 41)}+4${EASY.slice(42)}`;
  const expected = () => {
    const g = parseGrid(`${EASY.slice(0, 41)}4${EASY.slice(42)}`)!;
    const cands = Array.from(g.cands, (c, i) => (g.values[i] ? 0 : c));
    cands[0] &= ~bit(5);
    cands[1] &= ~bit(7);
    return { values: Array.from(g.values), cands };
  };

  it("reads HoDoKu's library string, placed digits as entries and deleted candidates taken out", () => {
    const p = parsePencilGrid(`:0000:x:${placed}:511 712::`)!;
    expect(p).not.toBeNull();
    const want = expected();
    expect(p.values).toEqual(want.values);
    expect(p.cands).toEqual(want.cands);
    expect(p.given[41]).toBe(false);
    expect(p.given.filter(Boolean).length).toBe(EASY.replace(/\./g, '').length);
    // a step's own fields after the position do not disturb it
    expect(parsePencilGrid(`:0200:4:${placed}:511 712:413 419:`)!.cands).toEqual(want.cands);
  });

  it('reads the 81 characters with one token per cell after them', () => {
    const g = parseGrid(EASY)!;
    const tokens = Array.from({ length: 81 }, (_, i) => (g.values[i] ? String(g.values[i]) : digitsOf(g.cands[i]).join('')));
    const p = parsePencilGrid(`${EASY}\n${tokens.join(' ')}`)!;
    expect(p).not.toBeNull();
    expect(p.values).toEqual(Array.from(g.values));
    // r5c6's one candidate stays a candidate: the line says the cell is empty
    expect(p.cands![41]).toBe(bit(4));
    expect(p.cands).toEqual(Array.from(g.cands, (c, i) => (g.values[i] ? 0 : c)));
  });

  it('reads the 81 characters with the deleted candidates after them', () => {
    const p = parsePencilGrid(`${EASY} 511 712`)!;
    expect(p).not.toBeNull();
    const g = parseGrid(EASY)!;
    const cands = Array.from(g.cands, (c, i) => (g.values[i] ? 0 : c));
    cands[0] &= ~bit(5);
    cands[1] &= ~bit(7);
    expect(p.cands).toEqual(cands);
    expect(parsePencilGrid(`${EASY} -511 -712`)!.cands).toEqual(cands);
  });
});

describe('the puzzle in a text', () => {
  it('is its 81 cells, frame lines dropped so their dots are not cells', () => {
    expect(puzzleStringOf(EASY)).toBe(EASY);
    expect(puzzleStringOf(`  ${EASY.replace(/0/g, '.')}\n`)).toBe(EASY);
    const framed = ['.---.---.---.', ...EASY.match(/.{9}/g)!.map((r) => `|${r.slice(0, 3)}|${r.slice(3, 6)}|${r.slice(6)}|`), "'---'---'---'"].join('\n');
    expect(puzzleStringOf(framed)).toBe(EASY);
    expect(puzzleStringOf(formatPencilGrid(fresh(EASY), true, 'unknown'))).toBeNull();
    expect(puzzleStringOf('not a puzzle')).toBeNull();
  });

  it('tells a grid drawn in rows from a line', () => {
    expect(looksLikeGrid(EASY)).toBe(false);
    expect(looksLikeGrid(formatPencilGrid(fresh(EASY), true, 'unknown'))).toBe(true);
  });
});
