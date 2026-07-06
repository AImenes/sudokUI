// Puzzle pools: puzzles found during background generation, filed per
// difficulty level and per technique so new games / practice start instantly.
import { Level, Tech } from '../engine/ratings';
import type { PoolEntry, WorkerRequest, WorkerResponse } from '../engine/worker';

const STORAGE_KEY = 'sudokui-pools-v9'; // v9: tridagon in the loop
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

export function filePoolEntry(entry: PoolEntry) {
  const pools = load();
  const keys = [levelKey(entry.level), ...entry.techs.map(techKey)];
  for (const key of keys) {
    const pool = pools[key] ?? [];
    if (pool.some((p) => p.puzzle === entry.puzzle)) continue;
    if (pool.length >= POOL_CAP) continue;
    pool.push(entry);
    pools[key] = pool;
  }
  save(pools);
}

export function takePoolEntry(key: string): PoolEntry | null {
  const pools = load();
  const pool = pools[key];
  if (!pool || pool.length === 0) return null;
  const entry = pool.shift()!;
  pools[key] = pool;
  save(pools);
  return entry;
}

export function poolSize(key: string): number {
  return load()[key]?.length ?? 0;
}

// ---- worker plumbing ----

let worker: Worker | null = null;
let nextId = 1;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../engine/worker.ts', import.meta.url), {
      type: 'module'
    });
  }
  return worker;
}

export interface GenerationHandle {
  cancel: () => void;
}

/**
 * Ask the worker for a puzzle matching a level or technique. All candidates
 * generated along the way are pooled. Resolves with the match, or null if
 * the attempt budget ran out or the request was cancelled.
 */
export function requestPuzzle(
  req: { kind: 'level'; level: Level } | { kind: 'tech'; tech: Tech },
  onProgress?: (attempts: number) => void
): { promise: Promise<PoolEntry | null>; handle: GenerationHandle } {
  const w = getWorker();
  const id = nextId++;
  let settled = false;
  let cancelFn: () => void = () => {};
  const promise = new Promise<PoolEntry | null>((resolve) => {
    const listener = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== id) return;
      if (msg.type === 'candidate') {
        filePoolEntry(msg.entry);
      } else if (msg.type === 'progress') {
        onProgress?.(msg.attempts);
      } else if (msg.type === 'done') {
        settled = true;
        w.removeEventListener('message', listener);
        resolve(msg.entry);
      } else if (msg.type === 'failed') {
        settled = true;
        w.removeEventListener('message', listener);
        resolve(null);
      }
    };
    w.addEventListener('message', listener);
    w.postMessage({ id, ...req } satisfies WorkerRequest);
    cancelFn = () => {
      if (settled) return;
      settled = true;
      w.postMessage({ id, kind: 'cancel' } satisfies WorkerRequest);
      w.removeEventListener('message', listener);
      resolve(null);
    };
  });
  return { promise, handle: { cancel: () => cancelFn() } };
}
