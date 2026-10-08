// What the player has done, technique by technique, and how the games
// went: the learning path from the player's own play
// (docs/technique-stats.md). Every unaided move is credited with the
// easiest technique that justifies it (src/engine/justify.ts), every
// applied hint with its technique. Nothing leaves the device.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tech, Level, TECHS } from '../engine/ratings';
import { worth } from '../content/frequency';
import { translator } from '../content/i18n';
import { localDateKey } from '../content/dailies';

export interface TechStat {
  unaided: number;
  hinted: number;
  /** ISO date of the last use, either way */
  lastUsed: string;
}

export interface GameTally {
  unaided: Partial<Record<Tech, number>>;
  hinted: Partial<Record<Tech, number>>;
  /** wrong digits placed */
  errors: number;
  /** correct moves no technique in budget could justify */
  beyond: number;
}

export interface BandStat {
  solves: number;
  unassisted: number;
  bestMs: number;
  totalMs: number;
}

export interface Stats {
  techs: Partial<Record<Tech, TechStat>>;
  game: GameTally;
  bands: Partial<Record<Level, BandStat>>;
  /** days the daily puzzle was solved, as date keys, in order */
  dailyDays: string[];
  newGame: () => void;
  recordUnaided: (tech: Tech | null) => void;
  recordHinted: (tech: Tech) => void;
  recordError: () => void;
  recordSolve: (level: Level, ms: number, unassisted: boolean, dailyKey?: string) => void;
}

const emptyGame = (): GameTally => ({ unaided: {}, hinted: {}, errors: 0, beyond: 0 });

const today = () => new Date().toISOString().slice(0, 10);

export const useStats = create<Stats>()(
  persist(
    (set) => ({
      techs: {},
      game: emptyGame(),
      bands: {},
      dailyDays: [],

      newGame: () => set({ game: emptyGame() }),

      recordUnaided: (tech) =>
        set((s) => {
          if (!tech) return { game: { ...s.game, beyond: s.game.beyond + 1 } };
          const t = s.techs[tech] ?? { unaided: 0, hinted: 0, lastUsed: '' };
          return {
            techs: { ...s.techs, [tech]: { ...t, unaided: t.unaided + 1, lastUsed: today() } },
            game: { ...s.game, unaided: { ...s.game.unaided, [tech]: (s.game.unaided[tech] ?? 0) + 1 } }
          };
        }),

      recordHinted: (tech) =>
        set((s) => {
          const t = s.techs[tech] ?? { unaided: 0, hinted: 0, lastUsed: '' };
          return {
            techs: { ...s.techs, [tech]: { ...t, hinted: t.hinted + 1, lastUsed: today() } },
            game: { ...s.game, hinted: { ...s.game.hinted, [tech]: (s.game.hinted[tech] ?? 0) + 1 } }
          };
        }),

      recordError: () => set((s) => ({ game: { ...s.game, errors: s.game.errors + 1 } })),

      recordSolve: (level, ms, unassisted, dailyKey) =>
        set((s) => {
          const b = s.bands[level] ?? { solves: 0, unassisted: 0, bestMs: 0, totalMs: 0 };
          const bands = {
            ...s.bands,
            [level]: {
              solves: b.solves + 1,
              unassisted: b.unassisted + (unassisted ? 1 : 0),
              bestMs: b.bestMs ? Math.min(b.bestMs, ms) : ms,
              totalMs: b.totalMs + ms
            }
          };
          const dailyDays = dailyKey && !s.dailyDays.includes(dailyKey) ? [...s.dailyDays, dailyKey] : s.dailyDays;
          return { bands, dailyDays };
        })
    }),
    { name: 'sudokui-stats-v1' }
  )
);

/**
 * Days in a row ending today or yesterday on which the daily was solved.
 * A day is the player's local date (src/content/dailies.ts, localDateKey),
 * as the daily itself is since the published dailies; the keys recorded
 * before that were UTC dates, which differ from local ones only around
 * midnight, so a streak carries over with at most one day's seam.
 */
export function dailyStreak(days: string[], now = new Date()): number {
  const set = new Set(days);
  let streak = 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // today may still be unsolved; a streak then counts from yesterday
  if (!set.has(localDateKey(d))) d.setDate(d.getDate() - 1);
  while (set.has(localDateKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/**
 * What to learn next: the techniques most worth learning (how often they
 * are needed, weighted by cost) that the player has used least on their
 * own. A technique used unaided many times moves down the list.
 */
export function learnNextScore(tech: Tech, techs: Partial<Record<Tech, TechStat>>): number {
  const used = techs[tech]?.unaided ?? 0;
  return worth(tech) / (1 + used);
}

/** The game in a sentence: what the player did, and what the hints did. */
export function gameSummary(game: GameTally): string {
  const t = translator();
  const byIndex = (a: Tech, b: Tech) => TECHS[a].index - TECHS[b].index;
  // one technique and how often: "31 × Naked Single", one form for every
  // count, since a technique name has no reliable plural ("Locked
  // Candidates (Pointing)", "Simple Colors", "Sue de Coq")
  const uses = (tech: Tech, n: number) => t('{n} × {name}||how often a technique was used', { n, name: t.tech(tech) });
  const own = (Object.keys(game.unaided) as Tech[]).sort(byIndex).map((tech) => uses(tech, game.unaided[tech]!));
  const hinted = (Object.keys(game.hinted) as Tech[]).sort(byIndex).map((tech) => uses(tech, game.hinted[tech]!));
  // each a whole sentence
  const sentences: string[] = [];
  const ownMoves = Object.values(game.unaided).reduce((a, b) => a + (b ?? 0), 0) + game.beyond;
  if (ownMoves) {
    const vars = { n: ownMoves, m: game.beyond, list: own.join(', ') };
    if (own.length && game.beyond) {
      // the list and the moves beyond it: two moves at least
      sentences.push(
        t(
          game.beyond === 1
            ? '{n} moves of your own: {list}, and {m} move beyond the catalogue.'
            : '{n} moves of your own: {list}, and {m} moves beyond the catalogue.',
          vars
        )
      );
    } else if (own.length) {
      sentences.push(t(ownMoves === 1 ? '{n} move of your own: {list}.' : '{n} moves of your own: {list}.', vars));
    } else {
      // every move beyond the catalogue: one count, said once, so it never
      // reads as two sets of moves
      sentences.push(
        t(
          ownMoves === 1 ? '{n} move of your own, beyond the catalogue.' : '{n} moves of your own, all beyond the catalogue.',
          vars
        )
      );
    }
  }
  if (hinted.length) sentences.push(t('From hints: {list}.', { list: hinted.join(', ') }));
  if (game.errors) sentences.push(t(game.errors === 1 ? '{n} wrong digit.' : '{n} wrong digits.', { n: game.errors }));
  return sentences.join(' ');
}
