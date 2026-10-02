// Builds the seed library (src/content/seeds.json, docs/generator.md) on
// every CPU core at once. Each worker generates and rates puzzles for the
// given number of minutes and keeps those that pass the filters for a
// seeded band; the main process then merges them with what is already
// stored, picks a varied set per band (round robin over the technique
// that is each puzzle's crux, so no one pattern dominates) and writes the
// file. tests/seeds.test.ts holds the result to the engine.
//
//   npx vite-node scripts/build-seeds.ts            all cores, 15 minutes
//   npx vite-node scripts/build-seeds.ts 40         all cores, 40 minutes
//   npx vite-node scripts/build-seeds.ts 40 2       2 workers, 40 minutes
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { generatePuzzle, hits } from '../src/engine/generator';
import { gridToString } from '../src/engine/board';
import { ratePuzzle } from '../src/engine/humanSolver';
import { Level, TECHS, Tech } from '../src/engine/ratings';
import { toEntry, PoolEntry } from '../src/engine/worker';
import { SEEDED_LEVELS, SEEDS_PER_LEVEL, StoredSeeds } from '../src/content/seeds';

const SEEDS = join(process.cwd(), 'src/content/seeds.json');
const SHARDS = join(process.cwd(), 'node_modules/.cache/seed-shards');
/** candidates each worker keeps per band */
const PER_WORKER = 60;

const load = (file: string): StoredSeeds => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {});

/** the technique of the hardest step: what the puzzle is about */
function crux(puzzle: string): Tech {
  const r = ratePuzzle(puzzle)!;
  let best: Tech = 'NAKED_SINGLE';
  for (const s of r.steps) if (TECHS[s.tech].index > TECHS[best].index) best = s.tech;
  return best;
}

const args = process.argv.slice(2);
const workerAt = args.indexOf('--worker');

if (workerAt >= 0) {
  const minutes = Number(args[workerAt + 1]);
  const file = args[workerAt + 2];
  const deadline = Date.now() + minutes * 60_000;
  const found: StoredSeeds = {};
  let lastSave = Date.now();
  let full = false;
  while (Date.now() < deadline && !full) {
    const grid = generatePuzzle(Math.random() < 0.7 ? 'rotational' : 'none');
    const puzzle = gridToString(grid);
    const rating = ratePuzzle(puzzle);
    if (!rating || !rating.solvable) continue;
    if (!SEEDED_LEVELS.includes(rating.level)) continue;
    if (!hits({ kind: 'level', level: rating.level }, puzzle, rating)) continue;
    const list = (found[rating.level] ??= []);
    if (list.length < PER_WORKER) list.push(toEntry({ puzzle, rating }));
    full = SEEDED_LEVELS.every((l) => (found[l]?.length ?? 0) >= PER_WORKER);
    if (Date.now() - lastSave > 60_000) {
      writeFileSync(file, JSON.stringify(found));
      lastSave = Date.now();
    }
  }
  writeFileSync(file, JSON.stringify(found));
} else {
  const minutes = Number(args[0] ?? 15);
  const workers = Number(args[1] ?? Math.max(1, cpus().length - 1));
  rmSync(SHARDS, { recursive: true, force: true });
  mkdirSync(SHARDS, { recursive: true });
  console.log(`${workers} workers × ${minutes} minutes, for ${SEEDED_LEVELS.join(', ')}`);
  const viteNode = join(process.cwd(), 'node_modules/vite-node/vite-node.mjs');
  const children = Array.from({ length: workers }, (_, i) => {
    const file = join(SHARDS, `${i}.json`);
    const child = spawn(process.execPath, [viteNode, fileURLToPath(import.meta.url), '--worker', String(minutes), file], {
      stdio: 'inherit'
    });
    return new Promise<void>((resolve) => child.on('exit', () => resolve()));
  });
  const progress = setInterval(() => {
    const counts = SEEDED_LEVELS.map((l) => {
      const n = readdirSync(SHARDS).reduce((sum, name) => sum + (load(join(SHARDS, name))[l]?.length ?? 0), 0);
      return `${l} ${n}`;
    });
    console.log(`${new Date().toLocaleTimeString()}  ${counts.join(', ')}`);
  }, 60_000);
  await Promise.all(children);
  clearInterval(progress);

  const stored = load(SEEDS);
  const out: StoredSeeds = {};
  for (const level of SEEDED_LEVELS) {
    const seen = new Set<string>();
    const all: PoolEntry[] = [];
    const add = (e: PoolEntry) => {
      if (e.level !== level || seen.has(e.puzzle)) return;
      // what is stored is re-checked: the engine may have moved since
      const rating = ratePuzzle(e.puzzle);
      if (!rating || !hits({ kind: 'level', level }, e.puzzle, rating)) return;
      seen.add(e.puzzle);
      all.push(toEntry({ puzzle: e.puzzle, rating }));
    };
    for (const e of stored[level] ?? []) add(e);
    for (const name of readdirSync(SHARDS)) for (const e of load(join(SHARDS, name))[level] ?? []) add(e);
    // round robin over the crux technique, so the library is varied
    const groups = new Map<Tech, PoolEntry[]>();
    for (const e of all) {
      const key = crux(e.puzzle);
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(e);
    }
    const picked: PoolEntry[] = [];
    const queues = [...groups.values()];
    while (picked.length < SEEDS_PER_LEVEL && queues.some((q) => q.length)) {
      for (const q of queues) {
        if (picked.length >= SEEDS_PER_LEVEL) break;
        const e = q.shift();
        if (e) picked.push(e);
      }
    }
    picked.sort((a, b) => a.score - b.score);
    out[level] = picked;
    console.log(`${level}: ${all.length} candidates in ${groups.size} crux techniques, ${picked.length} kept`);
  }
  writeFileSync(SEEDS, JSON.stringify(out, null, 1) + '\n');
  console.log(`written ${SEEDS}`);
}
