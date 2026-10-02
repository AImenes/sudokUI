// Puzzle pools: puzzles found during background generation, filed per
// difficulty level and per technique so new games / practice start instantly.
import { Level, LEVELS, Tech, practiceCeiling } from '../engine/ratings';
import type { Grid } from '../engine/board';
import type { Move, Budget } from '../engine/justify';
import type { PoolEntry, WorkerRequest, WorkerResponse } from '../engine/worker';

const STORAGE_KEY = 'sudokui-pools-v11'; // v11: entries carry the band filters' verdict
const POOL_CAP = 8;

type Pools = Record<string, PoolEntry[]>;

function load(): Pools {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function save(pools: Pools) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pools));
  } catch {
    /* storage full — pools are only a cache */
  }
}

export const levelKey = (level: Level) => `level:${level}`;
export const techKey = (tech: Tech) => `tech:${tech}`;

/** May this puzzle be served as practice for the technique: within its ceiling? */
export const practisable = (entry: PoolEntry, tech: Tech) =>
  LEVELS.indexOf(entry.level) <= LEVELS.indexOf(practiceCeiling(tech));

/** File puzzles under their band and their clean techniques, in one write. */
export function filePoolEntries(entries: PoolEntry[]) {
  const pools = load();
  for (const entry of entries) {
    // a puzzle that fails its band's filters is still good practice material;
    // one above a technique's ceiling is not practice for that technique
    const keys = [
      ...(entry.fit === false ? [] : [levelKey(entry.level)]),
      ...entry.techs.filter((t) => practisable(entry, t)).map(techKey)
    ];
    for (const key of keys) {
      const pool = pools[key] ?? [];
      if (pool.some((p) => p.puzzle === entry.puzzle)) continue;
      if (pool.length >= POOL_CAP) continue;
      pool.push(entry);
      pools[key] = pool;
    }
  }
  save(pools);
}

/**
 * Take the next puzzle from a pool. It leaves every pool it sits in: a
 * puzzle is filed under its band and each of its techniques, and a player
 * who has solved it as a Hard game should not meet it again as practice.
 */
export function takePoolEntry(key: string, accept: (entry: PoolEntry) => boolean = () => true): PoolEntry | null {
  const pools = load();
  const pool = pools[key];
  if (!pool || pool.length === 0) return null;
  const entry = pool.find(accept);
  if (!entry) return null;
  for (const k of Object.keys(pools)) pools[k] = pools[k].filter((p) => p.puzzle !== entry.puzzle);
  save(pools);
  return entry;
}

export function poolSize(key: string): number {
  return load()[key]?.length ?? 0;
}

// ---- worker plumbing ----

// two workers, so a waiting player never queues behind a background top-up
// (one full rating of a monster can take a second)
const workers: { urgent?: Worker; background?: Worker } = {};
let nextId = 1;

/** what to tell each request still waiting on a worker when that worker dies */
const failers = new Map<Worker, Set<() => void>>();

function getWorker(urgent: boolean): Worker {
  const slot = urgent ? 'urgent' : 'background';
  if (!workers[slot]) {
    const w = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module'
    });
    failers.set(w, new Set());
    // a worker that dies (its script gone after a deploy, an exception
    // inside it) settles every request waiting on it and is replaced by a
    // fresh one on the next request, so nothing waits forever
    const died = () => {
      if (workers[slot] !== w) return;
      delete workers[slot];
      const waiting = failers.get(w) ?? new Set();
      failers.delete(w);
      try {
        w.terminate();
      } catch {
        /* already gone */
      }
      for (const fail of waiting) fail();
    };
    w.addEventListener('error', died);
    w.addEventListener('messageerror', died);
    workers[slot] = w;
  }
  return workers[slot]!;
}

/** register what to do if the worker dies while this request waits */
function onDeath(w: Worker, fail: () => void): () => void {
  failers.get(w)?.add(fail);
  return () => failers.get(w)?.delete(fail);
}

export interface GenerationHandle {
  cancel: () => void;
}

/**
 * Ask a worker for a puzzle matching a level or technique. Candidates
 * generated along the way are pooled; the match itself is not, it is for
 * the caller. Resolves with the match, or null if the attempt budget ran
 * out or the request was cancelled.
 *
 * Seeds, if given, are served first, through a random isomorphism. Mark
 * the request urgent when a player is waiting: it then has a worker to
 * itself and rates only as far as the target needs (docs/generator.md).
 * A background top-up rates in full, so it stocks every pool it can.
 */
export function requestPuzzle(
  req:
    | { kind: 'level'; level: Level; seeds?: string[] }
    | { kind: 'tech'; tech: Tech; seeds?: string[] },
  opts: { urgent?: boolean; onProgress?: (attempts: number) => void } = {}
): { promise: Promise<PoolEntry | null>; handle: GenerationHandle } {
  const w = getWorker(!!opts.urgent);
  const id = nextId++;
  const onProgress = opts.onProgress;
  let settled = false;
  let cancelFn: () => void = () => {};
  const promise = new Promise<PoolEntry | null>((resolve) => {
    let forget = () => {};
    const settle = (entry: PoolEntry | null) => {
      settled = true;
      w.removeEventListener('message', listener);
      forget();
      resolve(entry);
    };
    const listener = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === 'candidates') {
        filePoolEntries(msg.entries);
      } else if (msg.type === 'progress') {
        onProgress?.(msg.attempts);
      } else if (msg.type === 'done') {
        settle(msg.entry);
      } else if (msg.type === 'failed') {
        settle(null);
      }
    };
    w.addEventListener('message', listener);
    forget = onDeath(w, () => settle(null));
    w.postMessage({ id, urgent: !!opts.urgent, ...req } satisfies WorkerRequest);
    cancelFn = () => {
      if (settled) return;
      try {
        w.postMessage({ id, kind: 'cancel' } satisfies WorkerRequest);
      } catch {
        /* the worker is gone; nothing to cancel */
      }
      settle(null);
    };
  });
  return { promise, handle: { cancel: () => cancelFn() } };
}

/**
 * What justifies a move the player just made, from the position before it
 * (src/engine/justify.ts), worked out off the main thread so a placement
 * never waits for the solver. Resolves to the verdict (tech null when
 * nothing in budget justifies the move), or to null where there are no
 * workers to ask.
 */
export function justifyMove(
  g: Grid,
  move: Move,
  budget?: Budget
): Promise<{ tech: Tech | null; direct: boolean; steps: number } | null> {
  let w: Worker;
  try {
    w = getWorker(false);
  } catch {
    return Promise.resolve(null);
  }
  const id = nextId++;
  let values = '';
  const cands: number[] = [];
  for (let i = 0; i < 81; i++) {
    values += g.values[i] ? String(g.values[i]) : '.';
    cands.push(g.values[i] ? 0 : g.cands[i]);
  }
  return new Promise((resolve) => {
    let forget = () => {};
    const listener = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id || msg.type !== 'justified') return;
      w.removeEventListener('message', listener);
      forget();
      resolve({ tech: msg.tech, direct: msg.direct, steps: msg.steps });
    };
    w.addEventListener('message', listener);
    forget = onDeath(w, () => {
      w.removeEventListener('message', listener);
      resolve(null);
    });
    w.postMessage({ id, kind: 'justify', values, cands, move, budget } satisfies WorkerRequest);
  });
}
