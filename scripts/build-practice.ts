// Saves practice puzzles for the techniques the browser is slow to generate
// (src/content/practicePuzzles.json). First it measures, for every
// practice technique, how many attempts a clean puzzle takes with the
// rating capped at the technique; then, on every core, it generates a
// dozen for each technique over the threshold and merges them with what is
// stored. scripts/measure-frequency.ts also saves practice puzzles for the
// rarest techniques, from its long runs; this script is the quick,
// targeted one. tests/practicePuzzles.test.ts holds the result.
//
//   npx vite-node scripts/build-practice.ts            measure, then build
//   npx vite-node scripts/build-practice.ts 100        threshold: 100 attempts
//   npx vite-node scripts/build-practice.ts 100 UNIQUENESS_6 X_CHAIN   these only
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { generateFor } from '../src/engine/generator';
import { PRACTICE_TECHS, Tech } from '../src/engine/ratings';
import { toEntry, PoolEntry } from '../src/engine/worker';
import type { StoredPractice } from '../src/content/practicePuzzles';

const PRACTICE = join(process.cwd(), 'src/content/practicePuzzles.json');
const SHARDS = join(process.cwd(), 'node_modules/.cache/practice-shards');
/** puzzles saved per technique */
const SAVED = 12;
/** attempts a technique may take before it is worth storing: about a
 *  second on a phone, with every attempt capped at the technique */
const DEFAULT_THRESHOLD = 120;

const args = process.argv.slice(2);
const workerAt = args.indexOf('--worker');

if (workerAt >= 0) {
  // one worker: a share of the techniques, SAVED puzzles each
  const file = args[workerAt + 1];
  const techs = args.slice(workerAt + 2) as Tech[];
  const found: StoredPractice = {};
  for (const tech of techs) {
    const list: PoolEntry[] = [];
    while (list.length < SAVED) {
      const res = generateFor({ kind: 'tech', tech }, 20000);
      if (!res) break;
      list.push(toEntry(res));
    }
    found[tech] = list;
    writeFileSync(file, JSON.stringify(found));
    console.log(`${tech}: ${list.length} found`);
  }
  writeFileSync(file, JSON.stringify(found));
} else {
  const threshold = Number(args[0] ?? DEFAULT_THRESHOLD);
  const chosen = args.slice(1) as Tech[];
  const stored: StoredPractice = existsSync(PRACTICE) ? JSON.parse(readFileSync(PRACTICE, 'utf8')) : {};
  let slow: Tech[];
  if (chosen.length) {
    slow = chosen;
  } else {
    // measure: three runs per technique, the mean number of attempts
    slow = [];
    for (const tech of PRACTICE_TECHS) {
      if (stored[tech]?.length) continue;
      let attempts = 0;
      for (let i = 0; i < 3; i++) generateFor({ kind: 'tech', tech }, 5000, () => attempts++);
      const mean = attempts / 3;
      if (mean > threshold) slow.push(tech);
      console.log(`${tech.padEnd(24)} ${mean.toFixed(0).padStart(5)} attempts${mean > threshold ? '   <- store' : ''}`);
    }
  }
  if (!slow.length) {
    console.log('nothing to store');
    process.exit(0);
  }
  rmSync(SHARDS, { recursive: true, force: true });
  mkdirSync(SHARDS, { recursive: true });
  const workers = Math.min(slow.length, Math.max(1, cpus().length - 1));
  console.log(`${workers} workers for ${slow.join(', ')}`);
  const viteNode = join(process.cwd(), 'node_modules/vite-node/vite-node.mjs');
  const children = Array.from({ length: workers }, (_, i) => {
    const mine = slow.filter((_, k) => k % workers === i);
    const file = join(SHARDS, `${i}.json`);
    const child = spawn(process.execPath, [viteNode, fileURLToPath(import.meta.url), '--worker', file, ...mine], {
      stdio: 'inherit'
    });
    return new Promise<void>((resolve) => child.on('exit', () => resolve()));
  });
  await Promise.all(children);
  const out: StoredPractice = { ...stored };
  for (const name of readdirSync(SHARDS)) {
    const shard: StoredPractice = JSON.parse(readFileSync(join(SHARDS, name), 'utf8'));
    for (const [tech, list] of Object.entries(shard) as [Tech, PoolEntry[]][]) {
      const seen = new Set<string>();
      const all = [...(out[tech] ?? []), ...list]
        .filter((e) => !seen.has(e.puzzle) && seen.add(e.puzzle))
        .sort((a, b) => a.score - b.score)
        .slice(0, SAVED);
      if (all.length) out[tech] = all;
    }
  }
  // the file keeps the catalogue's order
  const ordered: StoredPractice = {};
  for (const tech of PRACTICE_TECHS) if (out[tech]) ordered[tech] = out[tech];
  writeFileSync(PRACTICE, JSON.stringify(ordered, null, 1) + '\n');
  console.log(`saved for ${Object.keys(ordered).length} techniques`);
}
