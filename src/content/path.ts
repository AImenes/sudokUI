// The path: the techniques worth learning, in the order the solver needs
// them, with where the player stands on each from their own play
// (docs/technique-stats.md). A technique is on the path when it can be
// practised and turns up in at least one puzzle in a hundred; the rarer
// ones stay in the guide. A technique is learned once it has been played
// unaided a few times; the first one not yet learned is the next step.
import { Tech, TECHS, SOLVE_ORDER, PRACTICE_TECHS, Level } from '../engine/ratings';
import { share } from './frequency';
import type { TechStat } from '../state/stats';

/** needed in at least this share of generated puzzles to be on the path */
export const ON_PATH_SHARE = 0.01;
/** unaided uses that count as learned */
export const LEARNED_AT = 3;

export const PATH: Tech[] = SOLVE_ORDER.filter(
  // a full house is a naked single with nothing to look for: not a step
  (t) => t !== 'FULL_HOUSE' && PRACTICE_TECHS.includes(t) && share(t) >= ON_PATH_SHARE
);

export type PathState = 'learned' | 'started' | 'next' | 'ahead';

export interface PathRow {
  tech: Tech;
  level: Level;
  state: PathState;
  unaided: number;
  hinted: number;
}

export interface PathStatus {
  rows: PathRow[];
  learned: number;
  next: Tech | null;
}

export function pathStatus(techs: Partial<Record<Tech, TechStat>>, path: Tech[] = PATH): PathStatus {
  let next: Tech | null = null;
  let learned = 0;
  const rows: PathRow[] = path.map((tech) => {
    const unaided = techs[tech]?.unaided ?? 0;
    const hinted = techs[tech]?.hinted ?? 0;
    let state: PathState;
    if (unaided >= LEARNED_AT) {
      state = 'learned';
      learned++;
    } else if (!next) {
      state = 'next';
      next = tech;
    } else {
      state = unaided > 0 || hinted > 0 ? 'started' : 'ahead';
    }
    return { tech, level: TECHS[tech].level, state, unaided, hinted };
  });
  return { rows, learned, next };
}
