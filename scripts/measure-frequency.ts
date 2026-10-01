// Measures how often each technique is needed (src/content/frequency.json)
// on every CPU core at once. Each worker generates and rates puzzles for the
// given number of minutes; the main process then adds their counts to the
// numbers already stored. Same counting rule as scripts/hunt-examples.ts: a
// puzzle counts once for every technique in its solve path.
//
// Along the way the workers keep two kinds of puzzle that random generation
// hardly ever produces:
//  - puzzles needing a technique that still has no worked example, printed
//    at the end as seeds for scripts/hunt-examples.ts;
//  - practice puzzles for the rarest techniques, saved to
//    src/content/practicePuzzles.json: puzzles needing the technique with
//    nothing harder before it, as the browser's generator would pool them,
//    for techniques it would take minutes to find one for.
//
//   npx vite-node scripts/measure-frequency.ts            all cores, 15 minutes
//   npx vite-node scripts/measure-frequency.ts 40         all cores, 40 minutes
//   npx vite-node scripts/measure-frequency.ts 40 8       8 workers, 40 minutes
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { generatePuzzle, cleanTechniques } from '../src/engine/generator';
import { gridToString } from '../src/engine/board';
import { ratePuzzle } from '../src/engine/humanSolver';
import { SOLVE_ORDER, PRACTICE_TECHS, Tech } from '../src/engine/ratings';
import { EXAMPLES } from '../src/content/examples';
import type { PoolEntry } from '../src/engine/worker';
import type { StoredPractice } from '../src/content/practicePuzzles';

interface Frequency {
  sample: number;
  counts: Partial<Record<Tech, number>>;
  /** puzzles needing a technique that still has no worked example: seeds for the hunt */
  rare?: Partial<Record<Tech, string[]>>;
  /** practice candidates: puzzles needing the technique cleanly */
  practice?: Partial<Record<Tech, PoolEntry[]>>;
  /** puzzles needing the technique cleanly, for every practice technique */
  clean?: Partial<Record<Tech, number>>;
}

/** techniques the guide still shows without a worked example */
const RARE = SOLVE_ORDER.filter((t) => !EXAMPLES[t] && t !== 'BRUTE_FORCE');

/** a technique is worth saving practice puzzles for when the browser would take this long to find one */
const RARE_PRACTICE_SHARE = 1 / 500;
/** practice candidates each worker keeps per technique, and puzzles saved per technique */
const PRACTICE_PER_WORKER = 8;
const PRACTICE_SAVED = 12;

const FREQUENCY = join(process.cwd(), 'src/content/frequency.json');
const PRACTICE = join(process.cwd(), 'src/content/practicePuzzles.json');
const SHARDS = join(process.cwd(), 'node_modules/.cache/frequency-shards');

const load = (file: string): Frequency =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { sample: 0, counts: {} };

const save = (file: string, f: Frequency) => {
  const counts: Partial<Record<Tech, number>> = {};
  for (const tech of SOLVE_ORDER) counts[tech] = f.counts[tech] ?? 0;
  const extras = {
    ...(f.rare ? { rare: f.rare } : {}),
    ...(f.practice ? { practice: f.practice } : {}),
    ...(f.clean ? { clean: f.clean } : {})
  };
  writeFileSync(file, JSON.stringify({ sample: f.sample, counts, ...extras }, null, 1) + '\n');
};

const args = process.argv.slice(2);
const workerAt = args.indexOf('--worker');

if (workerAt >= 0) {
  // one worker: count for `minutes`, flushing to `file` once a minute
  const minutes = Number(args[workerAt + 1]);
  const file = args[workerAt + 2];
  const deadline = Date.now() + minutes * 60_000;
  const f: Frequency = { sample: 0, counts: {}, clean: {} };
  let lastSave = Date.now();
  while (Date.now() < deadline) {
    const grid = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
    const puzzle = gridToString(grid);
    const rating = ratePuzzle(puzzle);
    if (!rating || !rating.solvable) continue;
    f.sample++;
    for (const tech of Object.keys(rating.techniques) as Tech[]) f.counts[tech] = (f.counts[tech] ?? 0) + 1;
    for (const tech of RARE) {
      if (!rating.techniques[tech]) continue;
      const list = ((f.rare ??= {})[tech] ??= []);
      if (list.length < 5) list.push(puzzle);
    }
    const clean = cleanTechniques(rating);
    for (const tech of clean) {
      if (!PRACTICE_TECHS.includes(tech)) continue;
      f.clean![tech] = (f.clean![tech] ?? 0) + 1;
      const list = ((f.practice ??= {})[tech] ??= []);
      if (list.length < PRACTICE_PER_WORKER) {
        list.push({ puzzle, score: rating.score, level: rating.level, techs: clean });
      }
    }
    if (Date.now() - lastSave > 60_000) {
      save(file, f);
      lastSave = Date.now();
    }
  }
  save(file, f);
} else {
  const minutes = Number(args[0] ?? 15);
  const workers = Number(args[1] ?? Math.max(1, cpus().length - 1));
  rmSync(SHARDS, { recursive: true, force: true });
  mkdirSync(SHARDS, { recursive: true });
  console.log(`${workers} workers × ${minutes} minutes`);
  const viteNode = join(process.cwd(), 'node_modules/vite-node/vite-node.mjs');
  const children = Array.from({ length: workers }, (_, i) => {
    const file = join(SHARDS, `${i}.json`);
    const child = spawn(process.execPath, [viteNode, fileURLToPath(import.meta.url), '--worker', String(minutes), file], {
      stdio: 'inherit'
    });
    return new Promise<void>((resolve) => child.on('exit', () => resolve()));
  });
  // progress once a minute, from whatever the workers have flushed so far
  const progress = setInterval(() => {
    const sample = readdirSync(SHARDS).reduce((n, name) => n + load(join(SHARDS, name)).sample, 0);
    console.log(`${new Date().toLocaleTimeString()}  ${sample} puzzles so far`);
  }, 60_000);
  await Promise.all(children);
  clearInterval(progress);

  const total = load(FREQUENCY);
  const rare: Partial<Record<Tech, string[]>> = {};
  const practice: Partial<Record<Tech, PoolEntry[]>> = {};
  const clean: Partial<Record<Tech, number>> = {};
  let added = 0;
  for (const name of readdirSync(SHARDS)) {
    const shard = load(join(SHARDS, name));
    total.sample += shard.sample;
    added += shard.sample;
    for (const [tech, n] of Object.entries(shard.counts) as [Tech, number][]) {
      total.counts[tech] = (total.counts[tech] ?? 0) + n;
    }
    for (const [tech, list] of Object.entries(shard.rare ?? {}) as [Tech, string[]][]) {
      (rare[tech] ??= []).push(...list);
    }
    for (const [tech, list] of Object.entries(shard.practice ?? {}) as [Tech, PoolEntry[]][]) {
      (practice[tech] ??= []).push(...list);
    }
    for (const [tech, n] of Object.entries(shard.clean ?? {}) as [Tech, number][]) {
      clean[tech] = (clean[tech] ?? 0) + n;
    }
  }
  save(FREQUENCY, total);
  console.log(`${added} puzzles added; ${total.sample} counted in total`);

  // practice puzzles: only for techniques the browser would struggle to
  // generate, the easiest dozen of each, added to what is already saved
  const stored: StoredPractice = existsSync(PRACTICE) ? JSON.parse(readFileSync(PRACTICE, 'utf8')) : {};
  const saved: StoredPractice = {};
  for (const tech of PRACTICE_TECHS) {
    const found = practice[tech] ?? [];
    const isRare = (clean[tech] ?? 0) < added * RARE_PRACTICE_SHARE;
    if (!isRare && !stored[tech]) continue;
    const seen = new Set<string>();
    const all = [...(stored[tech] ?? []), ...(isRare ? found : [])]
      .filter((e) => !seen.has(e.puzzle) && seen.add(e.puzzle))
      .sort((a, b) => a.score - b.score)
      .slice(0, PRACTICE_SAVED);
    if (all.length) saved[tech] = all;
  }
  writeFileSync(PRACTICE, JSON.stringify(saved, null, 1) + '\n');
  const summary = PRACTICE_TECHS.filter((t) => saved[t]).map((t) => `${t} ${saved[t]!.length}`);
  console.log(`practice puzzles saved for ${summary.length} techniques: ${summary.join(', ')}`);
  for (const [tech, list] of Object.entries(rare)) console.log(`${tech}: ${list.join(' ')}`);
}
