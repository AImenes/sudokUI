// Measures the generator (docs/generator.md): what one attempt costs, how
// often each band comes up, how long a player waits for each band with the
// rating capped, and how a seed served through a random isomorphism fares.
//
//   npx vite-node scripts/bench-generator.ts          # 20 puzzles per band
//   npx vite-node scripts/bench-generator.ts 50       # 50 per band
import { generatePuzzle, generateFor, attemptFor, hits, clueCount, cruxEmpties } from '../src/engine/generator';
import { ratePuzzle } from '../src/engine/humanSolver';
import { gridToString } from '../src/engine/board';
import { LEVELS, Level } from '../src/engine/ratings';
import { transformPuzzle } from '../src/engine/transform';

const PER_BAND = Number(process.argv[2] ?? 20);
const ms = (x: number) => (x >= 1000 ? `${(x / 1000).toFixed(1)} s` : `${x.toFixed(0)} ms`);
const stats = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const q = (f: number) => s[Math.min(s.length - 1, Math.floor(s.length * f))];
  return { mean: s.reduce((a, b) => a + b, 0) / s.length, p50: q(0.5), p90: q(0.9), max: s[s.length - 1] };
};

// 1. one attempt, rated in full: cost and band shares
{
  const N = 300;
  const shares: Partial<Record<Level, number>> = {};
  const rateTime: Partial<Record<Level, number[]>> = {};
  let dig = 0;
  let rate = 0;
  let rejected = 0;
  for (let i = 0; i < N; i++) {
    const a = performance.now();
    const g = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
    const b = performance.now();
    const r = ratePuzzle(g);
    const c = performance.now();
    dig += b - a;
    rate += c - b;
    if (!r || !r.solvable) continue;
    shares[r.level] = (shares[r.level] ?? 0) + 1;
    (rateTime[r.level] ??= []).push(c - b);
    if (cruxEmpties(r, clueCount(gridToString(g))) < 20) rejected++;
  }
  console.log(`\nOne attempt (${N} puzzles): dig ${ms(dig / N)}, full rating ${ms(rate / N)}, crux filter rejects ${((100 * rejected) / N).toFixed(1)}%\n`);
  console.log('| Band | Share | Full rating, mean | p90 |');
  console.log('| --- | --- | --- | --- |');
  for (const level of LEVELS) {
    const n = shares[level] ?? 0;
    const t = rateTime[level]?.length ? stats(rateTime[level]!) : null;
    console.log(`| ${level} | ${((100 * n) / N).toFixed(1)}% | ${t ? ms(t.mean) : '-'} | ${t ? ms(t.p90) : '-'} |`);
  }
}

// 2. a waiting player: time to a puzzle of each band, rating capped
const found: Partial<Record<Level, string[]>> = {};
console.log(`\nTime to a puzzle of the band, rating capped (${PER_BAND} per band)\n`);
console.log('| Band | Attempts, mean | Wait, mean | p50 | p90 | max |');
console.log('| --- | --- | --- | --- | --- | --- |');
for (const level of LEVELS) {
  const waits: number[] = [];
  const attempts: number[] = [];
  for (let i = 0; i < PER_BAND; i++) {
    let n = 0;
    const a = performance.now();
    const res = generateFor({ kind: 'level', level }, 2000, () => n++);
    waits.push(performance.now() - a);
    attempts.push(n);
    if (res) (found[level] ??= []).push(res.puzzle);
  }
  const w = stats(waits);
  const at = attempts.reduce((x, y) => x + y, 0) / attempts.length;
  console.log(`| ${level} | ${at.toFixed(0)} | ${ms(w.mean)} | ${ms(w.p50)} | ${ms(w.p90)} | ${ms(w.max)} |`);
}

// 3. a seed through a random isomorphism: how often the band holds, and what it costs
console.log(`\nA seed through a random isomorphism, re-rated with the cap\n`);
console.log('| Band | Band held | Rating, mean | p90 |');
console.log('| --- | --- | --- | --- |');
for (const level of LEVELS) {
  const seeds = found[level] ?? [];
  if (!seeds.length) continue;
  let held = 0;
  let tries = 0;
  const times: number[] = [];
  for (const seed of seeds) {
    for (let k = 0; k < 5; k++) {
      const q = transformPuzzle(seed);
      const a = performance.now();
      const r = ratePuzzle(q, undefined, { maxLevel: level });
      times.push(performance.now() - a);
      tries++;
      if (r && hits({ kind: 'level', level }, q, r)) held++;
    }
  }
  const t = stats(times);
  console.log(`| ${level} | ${((100 * held) / tries).toFixed(0)}% | ${ms(t.mean)} | ${ms(t.p90)} |`);
}

// 4. practice: a few techniques, capped
console.log(`\nPractice puzzles, rating capped (10 each)\n`);
for (const tech of ['NAKED_PAIR', 'X_WING', 'XY_WING', 'SWORDFISH', 'ALS_XZ'] as const) {
  const waits: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = performance.now();
    generateFor({ kind: 'tech', tech }, 3000);
    waits.push(performance.now() - a);
  }
  const w = stats(waits);
  console.log(`${tech.padEnd(20)} mean ${ms(w.mean)}  p90 ${ms(w.p90)}`);
}
// keep the import used when the sections above are trimmed for a quick run
void attemptFor;
