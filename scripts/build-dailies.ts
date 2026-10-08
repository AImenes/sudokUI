/**
 * Publishes the dailies (docs/online-goals.md, phase 2): one pinned puzzle
 * per calendar day from DAILY_EPOCH to the end date given, written to
 * src/content/dailies.json, which the app loads when a daily starts and
 * the Worker bundles to check submitted results.
 *
 *   npx vite-node scripts/build-dailies.ts [YYYY-MM-DD]   (default: a year on from today)
 *
 * Days already in the file are never touched: a published daily is a
 * promise, and a rating change later must not move it. The script only
 * adds the days that are missing up to the end date, so run it again
 * whenever the file is within a month or two of running out (the test in
 * tests/dailies.test.ts says when). Each day's band comes round in turn
 * (Medium, Tricky, Hard, dailyBand), each puzzle is generated afresh,
 * checked to have one solution and to rate in its band today, and stored
 * with its band, score, the techniques worth naming and the SHA-256 of
 * its solution, never the solution itself.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { generateFor, hasSymmetry } from '../src/engine/generator';
import { ratePuzzle } from '../src/engine/humanSolver';
import { parseGrid, gridToString } from '../src/engine/board';
import { solve, countSolutions } from '../src/engine/bruteForce';
import { techsWorthNaming } from '../src/content/share';
import { DAILY_EPOCH, dailyBand, dailyDate, dailyNumber, localDateKey, Daily } from '../src/content/dailies';

const FILE = join(process.cwd(), 'src', 'content', 'dailies.json');

const until = process.argv[2] ?? (() => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return localDateKey(d);
})();
const lastNo = dailyNumber(until);
if (!lastNo) throw new Error(`end date: a day from ${DAILY_EPOCH} on, as YYYY-MM-DD`);

const existing: Daily[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
const byDate = new Map(existing.map((d) => [d.date, d]));

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** a fresh puzzle of the band: one solution, rated in the band today, symmetric when the generator finds one in time */
function makeDaily(date: string, no: number): Daily {
  const level = dailyBand(no);
  for (let attempt = 0; attempt < 40; attempt++) {
    const g = generateFor({ kind: 'level', level }, 400);
    if (!g) continue;
    const grid = parseGrid(g.puzzle)!;
    if (countSolutions(grid, 2) !== 1) continue;
    const rating = ratePuzzle(g.puzzle);
    if (!rating || !rating.solvable || rating.level !== level) continue;
    // the first ten tries hold out for symmetry, the rest take what comes
    if (attempt < 10 && !hasSymmetry(grid, 'rotational')) continue;
    const solution = gridToString(solve(grid)!);
    return {
      date,
      puzzle: g.puzzle,
      level,
      score: rating.score,
      techs: techsWorthNaming(rating.steps.map((s) => s.tech)),
      solutionHash: sha256(solution)
    };
  }
  throw new Error(`${date}: no ${level} puzzle found in 40 tries`);
}

let added = 0;
const started = Date.now();
for (let no = 1; no <= lastNo; no++) {
  const date = dailyDate(no);
  if (byDate.has(date)) continue;
  const daily = makeDaily(date, no);
  byDate.set(date, daily);
  added++;
  if (added % 25 === 0) console.log(`${added} added, at ${date} (${Math.round((Date.now() - started) / 1000)} s)`);
}

const all = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
// one line per day, so a diff shows exactly which days were added
const json = `[\n${all.map((d) => '  ' + JSON.stringify(d)).join(',\n')}\n]\n`;
writeFileSync(FILE, json);
console.log(`dailies: ${all.length} days, ${all[0]?.date} to ${all[all.length - 1]?.date}, ${added} added, ${Math.round((Date.now() - started) / 1000)} s`);
