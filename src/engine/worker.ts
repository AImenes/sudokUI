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
import { ratePuzzle, Rating } from './humanSolver';
import { transformPuzzle } from './transform';
import { parseGrid } from './board';
import { justify, Move, Budget } from './justify';
import { Level, LevelPick, Tech, TECHS, SOLVE_ORDER, NO_UNIQUENESS_ORDER } from './ratings';

export interface PoolEntry {
  puzzle: string;
  score: number;
  level: Level;
  techs: Tech[];
  /** passes its band's filters, so it may be served for the band; absent means yes */
  fit?: boolean;
  /**
   * The rating without the uniqueness techniques, for a player who does
   * not use them (settings.useUniqueness), where it is known: the entry's
   * own when its path takes no uniqueness step (the path is then the same
   * without them), else worked out for a request from such a player.
   * Absent, the puzzle is not served to that player by level.
   */
  plain?: { score: number; level: Level; fit: boolean };
}

export type WorkerRequest =
  /** noUniqueness: the player does not use uniqueness, so the level must hold without it (docs/architecture.md) */
  | { id: number; kind: 'level'; level: LevelPick; maxAttempts?: number; urgent?: boolean; seeds?: string[]; noUniqueness?: boolean }
  | { id: number; kind: 'tech'; tech: Tech; maxAttempts?: number; urgent?: boolean; seeds?: string[] }
  /** what justifies a move in a position: the values as 81 characters and
   *  the candidates of the empty cells as masks (src/engine/justify.ts) */
  | { id: number; kind: 'justify'; values: string; cands: number[]; move: Move; budget?: Budget; noUniqueness?: boolean }
  /** a puzzle's rating, with or without the uniqueness techniques: off the main thread, since a hard one takes a second */
  | { id: number; kind: 'rate'; puzzle: string; noUniqueness: boolean }
  | { id: number; kind: 'cancel' };

export type WorkerResponse =
  | { id: number; type: 'candidates'; entries: PoolEntry[] }
  | { id: number; type: 'progress'; attempts: number }
  | { id: number; type: 'done'; entry: PoolEntry }
  | { id: number; type: 'failed'; attempts: number }
  | { id: number; type: 'justified'; tech: Tech | null; direct: boolean; steps: number }
  /** null when the puzzle could not be rated (not one solution) */
  | { id: number; type: 'rated'; rating: { score: number; level: Level } | null };

export type GenerationRequest = Exclude<WorkerRequest, { kind: 'cancel' | 'justify' | 'rate' }>;
export type JustifyRequest = Extract<WorkerRequest, { kind: 'justify' }>;
export type RateRequest = Extract<WorkerRequest, { kind: 'rate' }>;

/** Serve a rate request: the puzzle rated in full in the order asked for. */
export function serveRate(req: RateRequest, post: (msg: WorkerResponse) => void): void {
  const r = ratePuzzle(req.puzzle, req.noUniqueness ? NO_UNIQUENESS_ORDER : SOLVE_ORDER);
  post({ id: req.id, type: 'rated', rating: r ? { score: r.score, level: r.level } : null });
}

/** does a solve path take a uniqueness step: only then can its rating without them differ */
export const usesUniqueness = (r: Rating): boolean => r.steps.some((s) => TECHS[s.tech].category === 'Uniqueness');

/** Serve a justify request: the position rebuilt from the message, the verdict posted. */
export function serveJustify(req: JustifyRequest, post: (msg: WorkerResponse) => void): void {
  const g = parseGrid(req.values);
  if (!g) {
    post({ id: req.id, type: 'justified', tech: null, direct: false, steps: 0 });
    return;
  }
  for (let i = 0; i < 81; i++) if (!g.values[i] && req.cands[i]) g.cands[i] &= req.cands[i];
  const j = justify(g, req.move, req.budget, req.noUniqueness ? NO_UNIQUENESS_ORDER : SOLVE_ORDER);
  post({ id: req.id, type: 'justified', tech: j.tech, direct: j.direct, steps: j.steps.length });
}

/** work per macrotask, so a cancel message gets through within this long */
const SLICE_MS = 40;

/**
 * A rated puzzle as the pools keep it. `plain` is its rating without the
 * uniqueness techniques where one was worked out; without it, the entry's
 * own stands in when its path takes no uniqueness step.
 */
export function toEntry({ puzzle, rating }: GeneratedPuzzle, plain: Rating | null = null): PoolEntry {
  const fit = fitForLevel(puzzle, rating);
  const without = plain ?? (usesUniqueness(rating) ? null : rating);
  return {
    puzzle,
    score: rating.score,
    level: rating.level,
    // pool under *clean* techniques only, so practice puzzles never need
    // something harder than the target before it appears
    techs: cleanTechniques(rating),
    fit,
    ...(without && { plain: { score: without.score, level: without.level, fit: without === rating ? fit : fitForLevel(puzzle, without) } })
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
  // a level for a player who does not use uniqueness: the level must hold
  // without it. A waiting player's candidates (and every seed) are rated
  // without it alone, capped at the level, and only the answer is rated
  // HoDoKu's way as well; a background top-up rates HoDoKu's way in full
  // and again without uniqueness where the path takes a uniqueness step
  const plainLevel = req.kind === 'level' && !!req.noUniqueness;
  let attempts = 0;

  /** a candidate: rated HoDoKu's way, or (plainFirst) without uniqueness only, capped */
  const next = (): (GeneratedPuzzle & { plainFirst: boolean }) | null => {
    const seed = seeds.pop();
    if (seed === undefined) {
      attempts++;
      const plainFirst = plainLevel && !!req.urgent;
      const result = attemptFor(target, !!req.urgent, plainFirst ? NO_UNIQUENESS_ORDER : SOLVE_ORDER);
      return result && { ...result, plainFirst };
    }
    const puzzle = transformPuzzle(seed);
    const rating = ratePuzzle(puzzle, plainLevel ? NO_UNIQUENESS_ORDER : SOLVE_ORDER, limit);
    return rating ? { puzzle, rating, plainFirst: plainLevel } : null;
  };

  const slice = () => {
    if (cancelled()) return;
    const end = performance.now() + SLICE_MS;
    const entries: PoolEntry[] = [];
    const flush = () => entries.length && post({ id: req.id, type: 'candidates', entries });
    do {
      const result = next();
      if (!result) continue;
      const { puzzle, plainFirst } = result;
      // the rating the target is judged by, and the one without uniqueness
      const plain = plainFirst ? result.rating : plainLevel && usesUniqueness(result.rating) ? ratePuzzle(puzzle, NO_UNIQUENESS_ORDER) : null;
      if (hits(target, puzzle, plain ?? result.rating)) {
        const rating = plainFirst ? ratePuzzle(puzzle) : result.rating;
        if (rating) {
          flush();
          post({ id: req.id, type: 'done', entry: toEntry({ puzzle, rating }, plain) });
          return;
        }
      }
      // a candidate rated without uniqueness alone has no HoDoKu rating to be pooled by
      if (!plainFirst) entries.push(toEntry(result, plain));
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
    if (req.kind === 'rate') {
      serveRate(req, (msg) => postMessage(msg));
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
