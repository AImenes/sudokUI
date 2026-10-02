/**
 * The path (src/content/path.ts): practisable techniques needed in at
 * least one puzzle in a hundred, in solver order; learned after a few
 * unaided uses; the first unlearned one is next.
 */
import { describe, it, expect } from 'vitest';
import { PATH, pathStatus, LEARNED_AT, ON_PATH_SHARE } from '../src/content/path';
import { PRACTICE_TECHS, SOLVE_ORDER, TECHS } from '../src/engine/ratings';
import { share } from '../src/content/frequency';

describe('the path', () => {
  it('holds the practisable techniques that matter, in solver order', () => {
    expect(PATH.length).toBeGreaterThan(20);
    expect(PATH.length).toBeLessThan(45);
    for (const t of PATH) {
      expect(PRACTICE_TECHS).toContain(t);
      expect(share(t)).toBeGreaterThanOrEqual(ON_PATH_SHARE);
    }
    expect([...PATH].sort((a, b) => SOLVE_ORDER.indexOf(a) - SOLVE_ORDER.indexOf(b))).toEqual(PATH);
    expect(PATH.slice(0, 2)).toEqual(['NAKED_SINGLE', 'HIDDEN_SINGLE']);
    expect(PATH).toContain('X_WING');
    expect(PATH).toContain('XY_WING');
    expect(PATH).toContain('ALS_XZ');
    expect(PATH).not.toContain('HIDDEN_QUADRUPLE');
    expect(PATH).not.toContain('FIREWORKS');
  });

  it('a fresh player: nothing learned, the first technique is next', () => {
    const s = pathStatus({});
    expect(s.learned).toBe(0);
    expect(s.next).toBe('NAKED_SINGLE');
    expect(s.rows[0].state).toBe('next');
    expect(s.rows.slice(1).every((r) => r.state === 'ahead')).toBe(true);
  });

  it('learned after a few unaided uses; started when touched; next is the first unlearned', () => {
    const stat = (unaided: number, hinted = 0) => ({ unaided, hinted, lastUsed: '' });
    const s = pathStatus({
      NAKED_SINGLE: stat(40),
      HIDDEN_SINGLE: stat(LEARNED_AT),
      LOCKED_CANDIDATES_1: stat(1),
      X_WING: stat(0, 2),
      XY_WING: stat(5)
    });
    const by = Object.fromEntries(s.rows.map((r) => [r.tech, r]));
    expect(by.NAKED_SINGLE.state).toBe('learned');
    expect(by.HIDDEN_SINGLE.state).toBe('learned');
    expect(by.XY_WING.state).toBe('learned');
    expect(s.learned).toBe(3);
    // the next step is the first unlearned technique, even if touched
    const firstUnlearned = PATH.find((t) => !['NAKED_SINGLE', 'HIDDEN_SINGLE', 'XY_WING'].includes(t))!;
    expect(s.next).toBe(firstUnlearned);
    expect(by[firstUnlearned].state).toBe('next');
    if (firstUnlearned !== 'LOCKED_CANDIDATES_1') expect(by.LOCKED_CANDIDATES_1.state).toBe('started');
    expect(by.X_WING.state).toBe('started');
    expect(by.X_WING).toMatchObject({ unaided: 0, hinted: 2, level: TECHS.X_WING.level });
  });
});
