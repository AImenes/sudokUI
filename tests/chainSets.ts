/**
 * The rules a step's groups and almost locked sets keep (Step.sets,
 * docs/hint-drawing-sets.md, Data and "How it is checked"), as one list of
 * what is wrong with a step, for tests/chainSets.test.ts and for the walk
 * of tests/pathDigest.ts, which holds them over the practice pools' and
 * the seeds' solve paths and the set techniques' finds along them as it
 * digests them. Not a test file itself. A step's sets are held:
 * - to their rules, by src/engine/truth.ts checkSets, against the board's
 *   candidates: each set's shape, each link end's set, the links inside a
 *   set and between sets, the ALS patterns' removals and the letters;
 * - outside the eight set techniques, to none at all;
 * - in the eight, every end of several candidates naming its set, and in
 *   the ALS patterns every end but Death Blossom's stem;
 * - each technique to its kinds: the grouped chains' sets groups, the ALS
 *   patterns' almost locked sets, and an AIC with ALS's almost locked sets
 *   of two cells or more (a one-cell "set" is the bivalue cell it is);
 * - every set reached by a link.
 */
import { checkSets } from '../src/engine/truth';
import type { Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';

/** the techniques phase 4 draws with their sets */
export const SET_TECHS = new Set<Tech>([
  'AIC_GROUPED',
  'AIC_ALS',
  'GROUPED_NICE_LOOP',
  'GROUPED_X_CYCLES',
  'ALS_XZ',
  'ALS_XY_WING',
  'ALS_XY_CHAIN',
  'DEATH_BLOSSOM'
]);

/** the chains through groups only */
const GROUPED = new Set<Tech>(['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES']);
/** the patterns made of almost locked sets */
const PATTERNS = new Set<Tech>(['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM']);

/** what is wrong with a step's sets at a position, `cands` its candidates (0 for a solved cell); empty for every finder's step */
export function setProblems(step: Step, cands: ArrayLike<number>): string[] {
  const out = checkSets(step, cands).map((p) => `${p.issue} at ${p.at}${p.link ? `, link ${p.link}` : ''}`);
  const sets = step.sets ?? [];
  const links = step.links ?? [];
  if (!SET_TECHS.has(step.tech)) {
    if (sets.length || links.some((l) => l.fromSet !== undefined || l.toSet !== undefined)) out.push('sets outside the set techniques');
    return out;
  }
  links.forEach((l, i) => {
    for (const [end, set, which] of [
      [l.from, l.fromSet, 'first'],
      [l.to, l.toSet, 'second']
    ] as const) {
      const stem = step.tech === 'DEATH_BLOSSOM' && which === 'first';
      if (set === undefined && (end.length > 1 || (PATTERNS.has(step.tech) && !stem))) out.push(`link ${i + 1}: its ${which} end names no set`);
    }
  });
  sets.forEach((s, i) => {
    if (GROUPED.has(step.tech) && s.kind !== 'group') out.push(`set ${i}: an almost locked set in a chain through groups`);
    if (PATTERNS.has(step.tech) && s.kind !== 'als') out.push(`set ${i}: a group in an ALS pattern`);
    if (step.tech === 'AIC_ALS' && s.kind === 'als' && s.cells.length < 2) out.push(`set ${i}: a one-cell set in an AIC with ALS`);
    if (!links.some((l) => l.fromSet === i || l.toSet === i)) out.push(`set ${i}: no link reaches it`);
  });
  return out;
}
