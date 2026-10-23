/**
 * The report as the app builds and sends it (src/ui/report.ts): the board
 * as a position link's parts, or none when no game is on the board; a
 * hint with its notation and whether it agrees with the solution; and what
 * the dialog makes of each answer from the route (worker/feedback.ts).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { reportBoard, reportHint, sendReport, mailtoOf, FEEDBACK_API, ReportBody } from '../src/ui/report';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import type { Step } from '../src/engine/steps';
import type { CellState, GameInfo } from '../src/state/gameStore';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const SOLUTION = gridToString(solve(parseGrid(EASY)!)!);
const cells: CellState[] = [...EASY].map((ch) => ({
  given: ch !== '.',
  value: ch === '.' ? 0 : Number(ch),
  corner: 0,
  center: 0,
  excluded: 0,
  colors: []
}));
const info = { puzzle: EASY, solution: SOLUTION, score: 196, level: 'Beginner', practiceTech: null } as GameInfo;
const body: ReportBody = { kind: 'problem', message: 'x', version: '1.0.0', lang: 'en', openedMs: 5000, website: '' };

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('the report', () => {
  it('carries the board as a position link’s parts, and nothing when no game is on it', () => {
    const board = reportBoard(info, cells, false)!;
    expect(board.puzzle).toBe(EASY);
    expect(board.position).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(reportBoard(null, cells, false)).toBeUndefined();
  });

  it('says whether a hint agrees with the solution', () => {
    const cell = EASY.indexOf('.');
    const right = Number(SOLUTION[cell]);
    const place = (digit: number) => ({ tech: 'NAKED_SINGLE', placements: [{ cell, digit }], eliminations: [] }) as unknown as Step;
    expect(reportHint(place(right), SOLUTION, true, 'unknown')).toMatchObject({ tech: 'NAKED_SINGLE', agrees: true, useUniqueness: true, markContract: 'unknown' });
    expect(reportHint(place(right === 9 ? 1 : right + 1), SOLUTION, false, 'open').agrees).toBe(false);
    // removing the solution's own digit is as wrong as placing another
    const removes = { tech: 'X_WING', placements: [], eliminations: [{ cell, digit: right }] } as unknown as Step;
    expect(reportHint(removes, SOLUTION, true, 'exhaustive').agrees).toBe(false);
  });

  it('reads each answer of the route', async () => {
    const answer = (status: number) => (globalThis.fetch = (async () => new Response('{}', { status })) as typeof fetch);
    const calls: string[] = [];
    globalThis.fetch = (async (url: string) => (calls.push(String(url)), new Response('{"ok":true}', { status: 200 }))) as typeof fetch;
    expect(await sendReport(body)).toBe('sent');
    expect(calls).toEqual([FEEDBACK_API]);
    answer(400);
    expect(await sendReport(body)).toBe('refused');
    answer(413);
    expect(await sendReport(body)).toBe('refused');
    answer(429);
    expect(await sendReport(body)).toBe('unavailable');
    answer(503);
    expect(await sendReport(body)).toBe('unavailable');
    globalThis.fetch = (async () => {
      throw new TypeError('offline');
    }) as typeof fetch;
    expect(await sendReport(body)).toBe('unavailable');
  });

  it('writes the letter to the public address, with the text encoded', () => {
    const href = mailtoOf('[sudokUI] An idea', 'Æ & ø?');
    expect(href).toBe('mailto:feedback@sudokui.app?subject=%5BsudokUI%5D%20An%20idea&body=%C3%86%20%26%20%C3%B8%3F');
  });
});

describe('an answer address', () => {
  it('writes a domain in æ, ø or å the way mail carries it, and changes nothing else', async () => {
    const { asciiAddress, isReplyAddress } = await import('../src/content/feedbackFormat');
    expect(asciiAddress('ola@blåbær.no')).toBe('ola@xn--blbr-roah.no');
    expect(isReplyAddress(asciiAddress('ola@blåbær.no'))).toBe(true);
    // an ASCII address is left exactly as typed
    expect(asciiAddress('Ola@Example.ORG')).toBe('Ola@Example.ORG');
    // a path, a port, a query or a space is never cut off quietly, and a
    // typo never becomes a numeric address: the check refuses the whole
    for (const odd of ['a@x.com/path', 'a@x.com:80', 'a@x.com?q', 'a@b c.d', 'a@', '@x.com', 'plain', 'ola@163', 'ola@1', 'ola@example%2ecom', 'ola@１６３', 'ola@blå bær.no']) {
      expect(asciiAddress(odd), odd).toBe(odd);
      expect(isReplyAddress(asciiAddress(odd)), odd).toBe(false);
    }
  });
});
