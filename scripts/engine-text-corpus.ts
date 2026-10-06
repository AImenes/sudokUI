// Every sentence the engine writes, over a fixed corpus of positions: the
// solve path of each puzzle (descriptions, legend labels, link sentences,
// the walk and the explanation as shown), every technique available at
// regular points along it (the way Scan lists them, disabled finders
// included), and chains built on those positions by a seeded random player
// (the chain trainer's messages). It proves that a change to how the engine
// words things leaves the English untouched, and in another language it
// lists every sentence still missing a translation.
//
//   npx vite-node scripts/engine-text-corpus.ts puzzles <list.json> [generated]
//       write the corpus: the worked examples, the practice puzzles, the
//       seed library and [generated] fresh puzzles (default 300)
//   npx vite-node scripts/engine-text-corpus.ts run <list.json> <out.json> [lang] [workers]
//       every sentence for every puzzle, in English or in nb / es
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { Grid, parseGrid, gridToString, bit } from '../src/engine/board';
import { ratePuzzle, applyStep, findAllSteps } from '../src/engine/humanSolver';
import { ALL_TECHS, TECHS, Tech } from '../src/engine/ratings';
import { generatePuzzle } from '../src/engine/generator';
import { describe, walkFrames } from '../src/engine/hintFrames';
import { EMPTY_CHAIN, Chain, extend, nextLinks, statement, conclusions, chainStep } from '../src/engine/chainTrainer';
import { Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import practice from '../src/content/practicePuzzles.json';
import seeds from '../src/content/seeds.json';

const args = process.argv.slice(2);

/** a small seeded generator, so the random chains are the same every run */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IMPLEMENTED = ALL_TECHS.filter((t) => TECHS[t].implemented) as Tech[];

function stepTexts(step: Step, out: string[], tag: string) {
  out.push(`${tag} ${step.tech} D: ${step.description}`);
  if (step.labels?.primary) out.push(`${tag} L.p: ${step.labels.primary}`);
  if (step.labels?.secondary) out.push(`${tag} L.s: ${step.labels.secondary}`);
  if (step.labels?.fins) out.push(`${tag} L.f: ${step.labels.fins}`);
  for (const link of step.links ?? []) if (link.text) out.push(`${tag} K: ${link.text}`);
  out.push(`${tag} X: ${describe(step)}`);
  for (const f of walkFrames(step)) out.push(`${tag} W: ${f.text}`);
}

function chainTexts(g: Grid, rnd: () => number, out: string[], tag: string) {
  const empties: number[] = [];
  for (let c = 0; c < 81; c++) if (!g.values[c]) empties.push(c);
  if (!empties.length) return;
  let chain: Chain = EMPTY_CHAIN;
  for (let move = 0; move < 10; move++) {
    let node: { cell: number; digit: number };
    const next = nextLinks(g, chain);
    const options = [...next.strong, ...next.weak];
    if (chain.nodes.length && options.length && rnd() < 0.75) {
      node = options[Math.floor(rnd() * options.length)];
    } else if (chain.nodes.length >= 3 && rnd() < 0.15) {
      node = chain.nodes[0]; // try to close a loop
    } else {
      const cell = empties[Math.floor(rnd() * empties.length)];
      node = { cell, digit: 1 + Math.floor(rnd() * 9) };
    }
    const ext = extend(g, chain, node);
    out.push(`${tag} C${move}: ${ext.message}`);
    if (!ext.ok) continue;
    chain = ext.chain;
    out.push(`${tag} S: ${statement(chain)}`);
    if (chain.links.length) {
      const goal = conclusions(g, chain).slice(0, 1);
      stepTexts(chainStep(g, chain, { suggest: rnd() < 0.5, goal: rnd() < 0.3 ? goal : [] }), out, `${tag} chain`);
    }
    if (chain.closed) break;
  }
}

/** every sentence for one puzzle */
function puzzleTexts(puzzle: string, index: number): string[] {
  const out: string[] = [];
  const rating = ratePuzzle(puzzle);
  if (!rating) return [`unrated ${puzzle}`];
  const rnd = mulberry32(index * 7919 + 17);
  const g = parseGrid(puzzle) as Grid;
  rating.steps.forEach((step, i) => {
    stepTexts(step, out, `s${i}`);
    // the menu Scan shows, every fourth position
    if (i % 4 === 0) {
      for (const s of findAllSteps(g, IMPLEMENTED)) stepTexts(s, out, `s${i} all`);
    }
    if (i % 6 === 3) chainTexts(g, rnd, out, `s${i}`);
    applyStep(g, step);
  });
  return out;
}

async function setLanguage(lang: string) {
  if (lang === 'en') return;
  // the engine's sentences in another language (src/engine/text.ts)
  const text = await import('../src/engine/text');
  const table = (await import(`../src/content/locales/engine.${lang}.ts`)).default;
  text.setEngineText(lang, table);
}

if (args[0] === 'puzzles') {
  const file = args[1];
  const generated = Number(args[2] ?? 300);
  const list: string[] = [];
  for (const ex of Object.values(EXAMPLES)) if (ex) list.push(ex.puzzle);
  for (const entries of Object.values(practice as Record<string, { puzzle: string }[]>)) for (const e of entries) list.push(e.puzzle);
  for (const entries of Object.values(seeds as Record<string, { puzzle: string }[]>)) for (const e of entries) list.push(e.puzzle);
  for (let i = 0; i < generated; i++) list.push(gridToString(generatePuzzle()));
  const unique = [...new Set(list)];
  writeFileSync(file, JSON.stringify(unique));
  console.log(`${unique.length} puzzles written to ${file}`);
} else if (args[0] === '--worker') {
  const [, listFile, outFile, lang, shard, of] = args;
  await setLanguage(lang);
  const list: string[] = JSON.parse(readFileSync(listFile, 'utf8'));
  const result: Record<number, string[]> = {};
  for (let i = Number(shard); i < list.length; i += Number(of)) result[i] = puzzleTexts(list[i], i);
  const text = lang === 'en' ? null : await import('../src/engine/text');
  writeFileSync(outFile, JSON.stringify({ result, missed: text ? text.missedTemplates() : [] }));
} else if (args[0] === 'run') {
  const [, listFile, outFile, lang = 'en', w] = args;
  const workers = Number(w ?? Math.max(1, cpus().length - 2));
  const shards = join(process.cwd(), '.corpus-shards');
  rmSync(shards, { recursive: true, force: true });
  mkdirSync(shards, { recursive: true });
  const viteNode = join(process.cwd(), 'node_modules/vite-node/vite-node.mjs');
  const started = Date.now();
  await Promise.all(
    Array.from({ length: workers }, (_, i) => {
      const child = spawn(
        process.execPath,
        [viteNode, fileURLToPath(import.meta.url), '--worker', listFile, join(shards, `${i}.json`), lang, String(i), String(workers)],
        { stdio: 'inherit' }
      );
      return new Promise<void>((resolve) => child.on('exit', () => resolve()));
    })
  );
  const all: Record<number, string[]> = {};
  const missed = new Set<string>();
  for (const name of readdirSync(shards)) {
    const part = JSON.parse(readFileSync(join(shards, name), 'utf8'));
    Object.assign(all, part.result);
    for (const m of part.missed) missed.add(m);
  }
  rmSync(shards, { recursive: true, force: true });
  const lines = Object.keys(all)
    .map(Number)
    .sort((a, b) => a - b)
    .flatMap((i) => all[i].map((t) => `${i} ${t}`));
  writeFileSync(outFile, lines.join('\n') + '\n');
  console.log(`${lines.length} sentences from ${Object.keys(all).length} puzzles in ${Math.round((Date.now() - started) / 1000)} s`);
  if (lang !== 'en') {
    console.log(`${missed.size} templates without a ${lang} translation`);
    for (const m of [...missed].sort()) console.log(`  missing: ${m}`);
  }
} else {
  console.log('usage: engine-text-corpus.ts puzzles <list.json> [generated] | run <list.json> <out.txt> [lang] [workers]');
}
