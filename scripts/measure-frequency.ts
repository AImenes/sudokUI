// Measures how often each technique is needed (src/content/frequency.json)
// on every CPU core at once. Each worker generates and rates puzzles for the
// given number of minutes; the main process then adds their counts to the
// numbers already stored. Same counting rule as scripts/hunt-examples.ts: a
// puzzle counts once for every technique in its solve path.
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
import { SOLVE_ORDER, Tech } from '../src/engine/ratings';
import { EXAMPLES } from '../src/content/examples';

interface Frequency {
  sample: number;
  counts: Partial<Record<Tech, number>>;
  /** puzzles reaching a technique that still has no worked example, cleanly: seeds for the hunt */
  rare?: Partial<Record<Tech, string[]>>;
}

/** techniques the guide still shows without a worked example */
const RARE = SOLVE_ORDER.filter((t) => !EXAMPLES[t] && t !== 'BRUTE_FORCE');

const FREQUENCY = join(process.cwd(), 'src/content/frequency.json');
const SHARDS = join(process.cwd(), 'node_modules/.cache/frequency-shards');

const load = (file: string): Frequency =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { sample: 0, counts: {} };

const save = (file: string, f: Frequency) => {
  const counts: Partial<Record<Tech, number>> = {};
  for (const tech of SOLVE_ORDER) counts[tech] = f.counts[tech] ?? 0;
  writeFileSync(file, JSON.stringify({ sample: f.sample, counts }, null, 1) + '\n');
};

const args = process.argv.slice(2);
const workerAt = args.indexOf('--worker');

if (workerAt >= 0) {
  // one worker: count for `minutes`, flushing to `file` once a minute
  const minutes = Number(args[workerAt + 1]);
  const file = args[workerAt + 2];
  const deadline = Date.now() + minutes * 60_000;
  const f: Frequency = { sample: 0, counts: {} };
  let lastSave = Date.now();
  while (Date.now() < deadline) {
    const puzzle = gridToString(generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none'));
    const rating = ratePuzzle(puzzle);
    if (!rating || !rating.solvable) continue;
    f.sample++;
    for (const tech of Object.keys(rating.techniques) as Tech[]) f.counts[tech] = (f.counts[tech] ?? 0) + 1;
    if (RARE.some((t) => rating.techniques[t])) {
      for (const tech of cleanTechniques(rating)) {
        if (!RARE.includes(tech)) continue;
        const list = ((f.rare ??= {})[tech] ??= []);
        if (list.length < 5) list.push(puzzle);
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
  let added = 0;
  for (const name of readdirSync(SHARDS)) {
    const shard = load(join(SHARDS, name));
    total.sample += shard.sample;
    added += shard.sample;
    for (const [tech, n] of Object.entries(shard.counts) as [Tech, number][]) {
      total.counts[tech] = (total.counts[tech] ?? 0) + n;
    }
  }
  const rare: Partial<Record<Tech, string[]>> = {};
  for (const name of readdirSync(SHARDS)) {
    for (const [tech, list] of Object.entries(load(join(SHARDS, name)).rare ?? {}) as [Tech, string[]][]) {
      (rare[tech] ??= []).push(...list);
    }
  }
  delete total.rare;
  save(FREQUENCY, total);
  console.log(`${added} puzzles added; ${total.sample} counted in total`);
  for (const [tech, list] of Object.entries(rare)) console.log(`${tech}: clean in ${list.join(' ')}`);
}
