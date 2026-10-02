/**
 * The generation worker's request loop, run without a browser: the answer
 * arrives once, as done, and never also as a candidate (or the player
 * would meet the puzzle they are playing again from the pool); every
 * other rated puzzle is a candidate; seeds are served first, through an
 * isomorphism, for bands and for techniques alike, and only when the
 * target holds; seeds do not count as attempts.
 */
import { describe, it, expect } from 'vitest';
import { serve, serveJustify, WorkerResponse, PoolEntry } from '../src/engine/worker';
import { parseGrid } from '../src/engine/board';
import { singleAt } from '../src/engine/justify';
import { ratePuzzle } from '../src/engine/humanSolver';
import { generateFor, cleanTechniques, clueCount } from '../src/engine/generator';

/** run a request to the end, slices back to back */
function run(req: Parameters<typeof serve>[0]) {
  const out: WorkerResponse[] = [];
  const queue: (() => void)[] = [];
  serve(req, (m) => out.push(m), (next) => queue.push(next), () => false);
  while (queue.length) queue.shift()!();
  return out;
}
const candidates = (out: WorkerResponse[]): PoolEntry[] =>
  out.flatMap((m) => (m.type === 'candidates' ? m.entries : []));
const answer = (out: WorkerResponse[]): PoolEntry => {
  const done = out.filter((m) => m.type === 'done') as Extract<WorkerResponse, { type: 'done' }>[];
  expect(done).toHaveLength(1);
  expect(out[out.length - 1].type).toBe('done');
  return done[0].entry;
};

describe('generation worker', () => {
  it('reports the answer once, as done, and the rest as candidates', () => {
    const out = run({ id: 1, kind: 'level', level: 'Medium', urgent: true, maxAttempts: 400 });
    const entry = answer(out);
    expect(entry.level).toBe('Medium');
    expect(entry.fit).toBe(true);
    const rest = candidates(out);
    expect(rest.map((c) => c.puzzle)).not.toContain(entry.puzzle);
    // capped: nothing harder than the target was rated to the end
    for (const c of rest) expect(['Beginner', 'Easy', 'Medium']).toContain(c.level);
  });

  it('a background request rates in full, so harder puzzles are pooled too', () => {
    const out = run({ id: 2, kind: 'level', level: 'Beginner', maxAttempts: 400 });
    answer(out);
    // nothing is capped, so candidates carry whatever band they are
    for (const c of candidates(out)) expect(ratePuzzle(c.puzzle)!.level).toBe(c.level);
  });

  it('serves a band seed first, through an isomorphism, when the band holds', () => {
    const seed = generateFor({ kind: 'level', level: 'Hard' }, 1000)!.puzzle;
    let atOnce = 0;
    for (let i = 0; i < 6; i++) {
      const out = run({ id: 3, kind: 'level', level: 'Hard', urgent: true, seeds: [seed], maxAttempts: 400 });
      const entry = answer(out);
      expect(entry.level).toBe('Hard');
      // the seed itself is never served as stored; an isomorph of it may be
      expect(entry.puzzle).not.toBe(seed);
      if (clueCount(entry.puzzle) === clueCount(seed) && candidates(out).length === 0) atOnce++;
    }
    // the band holds under most isomorphisms, so most runs served the seed at once
    expect(atOnce).toBeGreaterThan(0);
  });

  it('serves a practice seed the same way, when the technique still comes cleanly', () => {
    const seed = generateFor({ kind: 'tech', tech: 'X_WING' }, 2000)!.puzzle;
    const out = run({ id: 4, kind: 'tech', tech: 'X_WING', urgent: true, seeds: [seed], maxAttempts: 400 });
    const entry = answer(out);
    expect(entry.puzzle).not.toBe(seed);
    expect(cleanTechniques(ratePuzzle(entry.puzzle)!)).toContain('X_WING');
    expect(entry.techs).toContain('X_WING');
  });

  it('does not count seeds as attempts', () => {
    // no generation allowed: the seed of the wrong band is tried and
    // pooled, and the request fails with no attempt counted
    const wrong = generateFor({ kind: 'level', level: 'Beginner' }, 100)!.puzzle;
    const out = run({ id: 5, kind: 'level', level: 'Nightmare', urgent: true, seeds: [wrong], maxAttempts: 0 });
    expect(candidates(out)).toHaveLength(1);
    expect(out[out.length - 1]).toEqual({ id: 5, type: 'failed', attempts: 0 });
  });

  it('gives up after the attempts allowed', () => {
    // a target no puzzle can hit (brute force is not a technique the
    // catalogue solves with), so the outcome does not depend on luck
    const out = run({ id: 6, kind: 'tech', tech: 'BRUTE_FORCE', maxAttempts: 3 });
    expect(out[out.length - 1]).toEqual({ id: 6, type: 'failed', attempts: 3 });
  });

  it('justifies a move from the position sent, candidates included', () => {
    const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
    const g = parseGrid(EASY)!;
    const out: WorkerResponse[] = [];
    const cands = [...g.cands].map((c, i) => (g.values[i] ? 0 : c));
    // the first single of the start position
    let move = { cell: -1, digit: 0, placed: true };
    for (let cell = 0; cell < 81 && move.cell < 0; cell++) {
      for (let d = 1; d <= 9; d++) if (singleAt(g, cell, d)) { move = { cell, digit: d, placed: true }; break; }
    }
    expect(move.cell).toBeGreaterThanOrEqual(0);
    serveJustify({ id: 7, kind: 'justify', values: EASY, cands, move }, (m) => out.push(m));
    expect(out).toEqual([{ id: 7, type: 'justified', tech: expect.stringMatching(/SINGLE|FULL_HOUSE/), direct: true, steps: 1 }]);
    // a corrupt position answers "nothing"
    out.length = 0;
    serveJustify({ id: 8, kind: 'justify', values: 'x', cands, move }, (m) => out.push(m));
    expect(out).toEqual([{ id: 8, type: 'justified', tech: null, direct: false, steps: 0 }]);
  });
});
