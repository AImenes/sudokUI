/**
 * The daily puzzle: everyone who opens sudokUI on the same (UTC) day gets
 * the same board — no server, no download. The date seeds a PRNG that
 * temporarily stands in for Math.random while the ordinary generator runs,
 * so two phones on opposite sides of the planet derive an identical grid.
 * Aimed at the comfortable middle bands (Medium–Hard): approachable for a
 * shared ritual, meaty enough to talk about.
 */
import { generatePuzzle } from './generator';
import { ratePuzzle } from './humanSolver';
import { gridToString } from './board';
import { Level } from './ratings';

/** mulberry32 stream, seeded from the date string via FNV-1a. */
function seededRandom(key: string): () => number {
  let h = 2166136261;
  for (const ch of key) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  let s = h >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyPuzzle {
  puzzle: string;
  score: number;
  level: Level;
  /** the UTC day this puzzle belongs to, e.g. "2026-07-14" */
  dateKey: string;
}

export function dailyPuzzle(date = new Date()): DailyPuzzle {
  // UTC so the whole world shares one puzzle per calendar day
  const dateKey = date.toISOString().slice(0, 10);
  const rng = seededRandom(dateKey);
  const original = Math.random;
  Math.random = rng;
  try {
    let fallback: DailyPuzzle | null = null;
    for (let i = 0; i < 60; i++) {
      const p = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const r = ratePuzzle(p);
      if (!r) continue;
      const candidate = { puzzle: gridToString(p), score: r.score, level: r.level, dateKey };
      if (r.solvable && ['Medium', 'Tricky', 'Hard'].includes(r.level)) return candidate;
      fallback = fallback ?? candidate;
    }
    // 60 straight misses of the target bands is astronomically unlikely, but
    // determinism must never fail: the first rated puzzle stands in
    return fallback!;
  } finally {
    Math.random = original;
  }
}
