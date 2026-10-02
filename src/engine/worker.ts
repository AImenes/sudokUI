// Background puzzle generation (docs/generator.md). A request names a band
// or a technique. Urgent requests, from a player who is waiting, rate each
// candidate only as far as the target allows; background top-ups rate
// every candidate in full, so one search stocks the pools of every band
// and technique it turns up. A request may carry seed puzzles, each served
// through a random isomorphism and rated, before anything is generated.
import {
  attemptFor,
  cleanTechniques,
  fitForLevel,
  hits,
  limitFor,
  GeneratedPuzzle,
  Target
} from './generator';
import { ratePuzzle } from './humanSolver';
import { transformPuzzle } from './transform';
import { parseGrid } from './board';
import { justify, Move, Budget } from './justify';
import { Level, Tech, SOLVE_ORDER } from './ratings';

export interface PoolEntry {
  puzzle: string;
  score: number;
  level: Level;
  techs: Tech[];
  /** passes its band's filters, so it may be served for the band; absent means yes */
  fit?: boolean;
}

export type WorkerRequest =
  | { id: number; kind: 'level'; level: Level; maxAttempts?: number; urgent?: boolean; seeds?: string[] }
  | { id: number; kind: 'tech'; tech: Tech; maxAttempts?: number; urgent?: boolean; seeds?: string[] }
  /** what justifies a move in a position: the values as 81 characters and
   *  the candidates of the empty cells as masks (src/engine/justify.ts) */
  | { id: number; kind: 'justify'; values: string; cands: number[]; move: Move; budget?: Budget }
  | { id: number; kind: 'cancel' };

export type WorkerResponse =
  | { id: number; type: 'candidates'; entries: PoolEntry[] }
  | { id: number; type: 'progress'; attempts: number }
  | { id: number; type: 'done'; entry: PoolEntry }
  | { id: number; type: 'failed'; attempts: number }
  | { id: number; type: 'justified'; tech: Tech | null; direct: boolean; steps: number };

export type GenerationRequest = Exclude<WorkerRequest, { kind: 'cancel' | 'justify' }>;
export type JustifyRequest = Extract<WorkerRequest, { kind: 'justify' }>;

/** Serve a justify request: the position rebuilt from the message, the verdict posted. */
export function serveJustify(req: JustifyRequest, post: (msg: WorkerResponse) => void): void {
  const g = parseGrid(req.values);
  if (!g) {
    post({ id: req.id, type: 'justified', tech: null, direct: false, steps: 0 });
    return;
  }
  for (let i = 0; i < 81; i++) if (!g.values[i] && req.cands[i]) g.cands[i] &= req.cands[i];
  const j = justify(g, req.move, req.budget);
  post({ id: req.id, type: 'justified', tech: j.tech, direct: j.direct, steps: j.steps.length });
}

/** work per macrotask, so a cancel message gets through within this long */
const SLICE_MS = 40;

export function toEntry({ puzzle, rating }: GeneratedPuzzle): PoolEntry {
  return {
    puzzle,
    score: rating.score,
    level: rating.level,
    // pool under *clean* techniques only, so practice puzzles never need
    // something harder than the target before it appears
    techs: cleanTechniques(rating),
    fit: fitForLevel(puzzle, rating)
  };
}

/**
 * Serve one request: seeds first, then generation, in time slices until a
 * puzzle hits the target or the attempts run out (seeds do not count as
 * attempts). Every rated puzzle that is not the answer is reported for
 * pooling, once per slice; the answer is reported once, as done, so the
 * player does not meet it again from the pool.
 */
export function serve(
  req: GenerationRequest,
  post: (msg: WorkerResponse) => void,
  schedule: (next: () => void) => void,
  cancelled: () => boolean
): void {
  const target: Target = req.kind === 'level' ? { kind: 'level', level: req.level } : { kind: 'tech', tech: req.tech };
  const maxAttempts = req.maxAttempts ?? (req.kind === 'tech' ? 3000 : 400);
  const seeds = [...(req.seeds ?? [])];
  const limit = limitFor(target);
  let attempts = 0;

  const next = (): GeneratedPuzzle | null => {
    const seed = seeds.pop();
    if (seed === undefined) {
      attempts++;
      return attemptFor(target, !!req.urgent);
    }
    const puzzle = transformPuzzle(seed);
    const rating = ratePuzzle(puzzle, SOLVE_ORDER, limit);
    return rating ? { puzzle, rating } : null;
  };

  const slice = () => {
    if (cancelled()) return;
    const end = performance.now() + SLICE_MS;
    const entries: PoolEntry[] = [];
    const flush = () => entries.length && post({ id: req.id, type: 'candidates', entries });
    do {
      const result = next();
      if (!result) continue;
      const entry = toEntry(result);
      if (hits(target, result.puzzle, result.rating)) {
        flush();
        post({ id: req.id, type: 'done', entry });
        return;
      }
      entries.push(entry);
    } while (attempts < maxAttempts && performance.now() < end);
    flush();
    if (attempts >= maxAttempts) {
      post({ id: req.id, type: 'failed', attempts });
      return;
    }
    post({ id: req.id, type: 'progress', attempts });
    schedule(slice);
  };
  slice();
}

// ---- the worker itself ----

const cancelled = new Set<number>();

if (typeof self !== 'undefined' && typeof WorkerGlobalScope !== 'undefined') {
  self.onmessage = (e: MessageEvent<WorkerRequest>) => {
    const req = e.data;
    if (req.kind === 'cancel') {
      cancelled.add(req.id);
      return;
    }
    if (req.kind === 'justify') {
      serveJustify(req, (msg) => postMessage(msg));
      return;
    }
    serve(
      req,
      (msg) => postMessage(msg),
      (next) => setTimeout(next, 0),
      () => cancelled.delete(req.id)
    );
  };
}
