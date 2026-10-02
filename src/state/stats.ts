// What the player has done, technique by technique, and how the games
// went: the learning path from the player's own play
// (docs/technique-stats.md). Every unaided move is credited with the
// easiest technique that justifies it (src/engine/justify.ts), every
// applied hint with its technique. Nothing leaves the device.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tech, Level, TECHS } from '../engine/ratings';
import { worth } from '../content/frequency';

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

/** days in a row ending today or yesterday on which the daily was solved */
export function dailyStreak(days: string[], now = new Date()): number {
  const set = new Set(days);
  let streak = 0;
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // today may still be unsolved; a streak then counts from yesterday
  if (!set.has(d.toISOString().slice(0, 10))) d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
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
  const byIndex = (a: Tech, b: Tech) => TECHS[a].index - TECHS[b].index;
  const plural = (n: number, name: string) => `${n} ${name}${n === 1 ? '' : 's'}`;
  const own = (Object.keys(game.unaided) as Tech[]).sort(byIndex).map((t) => plural(game.unaided[t]!, TECHS[t].name));
  const hinted = (Object.keys(game.hinted) as Tech[]).sort(byIndex).map((t) => plural(game.hinted[t]!, TECHS[t].name));
  const parts: string[] = [];
  const ownMoves = Object.values(game.unaided).reduce((a, b) => a + (b ?? 0), 0) + game.beyond;
  if (ownMoves) {
    const list = own.length ? own.join(', ') : '';
    parts.push(
      `${plural(ownMoves, 'move')} of your own${list ? `: ${list}` : ''}${
        game.beyond ? `, and ${plural(game.beyond, 'move')} beyond the catalogue` : ''
      }`
    );
  }
  if (hinted.length) parts.push(`from hints: ${hinted.join(', ')}`);
  if (game.errors) parts.push(plural(game.errors, 'wrong digit'));
  const sentence = (t: string) => t[0].toUpperCase() + t.slice(1);
  return parts.map(sentence).join('. ') + (parts.length ? '.' : '');
}
