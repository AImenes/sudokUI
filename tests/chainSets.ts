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
 * - every set reached by a link;
 * - the ALS patterns' truth (decision 13 and 15, derivationProblems): an
 *   ALS-XZ, an ALS-XY-Wing or an ALS-XY-Chain derives cleanly, its start
 *   false, its end true and every removal in conflict with both, or else it
 *   is an ALS-XY-Chain whose sets share a cell and draws no truth in any
 *   view; a Death Blossom's every branch derives from its two links, every
 *   removal in conflict with its end, and draws no truth either.
 */
import { checkSets, deriveLinks, deriveTruth, alsClash } from '../src/engine/truth';
import type { CellDigit, Step } from '../src/engine/steps';
import { insideSet } from '../src/engine/steps';
import { PEERS } from '../src/engine/board';
import { walkFrames } from '../src/engine/hintFrames';
import { frameMarks, premiseOf } from '../src/content/hintMarks';
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

/** the ALS patterns read as chains (decision 11) */
const ALS_CHAINS = new Set<Tech>(['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN']);

/** a candidate `e` conflicts with a node when it cannot be true if the node is: every member is in e's cell with another digit, or holds e's digit in a peer */
const conflicts = (e: CellDigit, node: CellDigit[]) =>
  node.every((m) => (m.cell === e.cell ? m.digit !== e.digit : m.digit === e.digit && PEERS[e.cell].includes(m.cell)));

/** how an ALS pattern's chain derives (decision 13): cleanly, or with a clash; none for any other step, Death Blossom's included */
export const derivationOf = (step: Step): 'clean' | 'clash' | null =>
  ALS_CHAINS.has(step.tech) && step.truth === 'derived' ? (alsClash(step) ? 'clash' : 'clean') : null;

/** the kinds of mark that say a truth */
const TRUTH = new Set(['true', 'false', 'oneOf']);

/**
 * What is wrong with an ALS pattern's truth (decisions 11, 13 and 15): an
 * ALS-XZ, ALS-XY-Wing or ALS-XY-Chain is a derived chain that derives
 * cleanly, its start false and its end true, every removal in conflict with
 * both ends; or, only an ALS-XY-Chain whose sets share a cell, one whose
 * derivation has a problem or comes back to its start, and which then draws
 * no truth in any view and words no premise. A Death Blossom claims no
 * truth: each of its branches, a weak tie from the stem and the petal's
 * lock, derives from the stem's digit true to the petal's z true, every
 * removal in conflict with that end, and it draws no truth in any view.
 * `solved` says which cells hold a digit
 */
export function derivationProblems(step: Step, solved: (cell: number) => boolean): string[] {
  const out: string[] = [];
  const truthless = () => {
    for (const f of [null, ...walkFrames(step)]) {
      const m = frameMarks(step, f, solved);
      for (const [cell, ds] of m.cands) for (const [digit, k] of ds) if (TRUTH.has(k)) out.push(`frame ${f ? f.links : 'full'}: ${digit} in cell ${cell} drawn ${k}`);
    }
    if (premiseOf(step)) out.push('a premise worded');
  };
  if (step.tech === 'DEATH_BLOSSOM') {
    if (step.truth) out.push(`truth ${step.truth}`);
    const links = step.links ?? [];
    const ties = links.flatMap((l, i) => (l.undirected && !l.strong && l.fromSet === undefined ? [i] : []));
    if (!ties.length || ties.length !== step.sets?.length) out.push('not a branch for each petal');
    for (const i of ties) {
      const lock = links[i + 1];
      if (!lock || !insideSet(lock) || lock.fromSet !== links[i].toSet) {
        out.push(`branch ${links[i].from[0]?.digit}: no lock after its tie`);
        continue;
      }
      const d = deriveLinks([links[i], lock]);
      const [stem, , end] = d.nodes;
      if (d.problems.length || d.closure || !stem?.truth || !end?.truth) out.push(`branch ${links[i].from[0].digit}: does not derive`);
      for (const e of step.eliminations) if (end && !conflicts(e, end.node)) out.push(`branch ${links[i].from[0].digit}: ${e.digit} in cell ${e.cell} not in conflict with its end`);
    }
    truthless();
    return out;
  }
  const derivation = derivationOf(step);
  if (!derivation) {
    if (ALS_CHAINS.has(step.tech)) out.push('not a derived chain');
    return out;
  }
  const d = deriveTruth(step)!;
  if (derivation === 'clash') {
    const sets = step.sets ?? [];
    const shared = sets.some((a, i) => sets.slice(i + 1).some((b) => a.cells.some((c) => b.cells.includes(c))));
    if (step.tech !== 'ALS_XY_CHAIN' || !shared) out.push(`a clash (${d.problems.map((p) => p.issue).join(', ') || 'a loop'}) in a pattern whose sets share no cell`);
    truthless();
    return out;
  }
  // its ends: the first link's first node and the last link's second, which may be a node reached before
  const links = step.links!;
  const first = { node: links[0].from, truth: d.nodes[0].truth };
  const last = { node: links[links.length - 1].to, truth: d.ends[d.ends.length - 1].to };
  if (first.truth || !last.truth) out.push('its start not false, or its end not true');
  for (const e of step.eliminations) if (!conflicts(e, first.node) || !conflicts(e, last.node)) out.push(`${e.digit} in cell ${e.cell} not in conflict with both ends`);
  return out;
}

/** what is wrong with a step's sets at a position, `cands` its candidates (0 for a solved cell); empty for every finder's step */
export function setProblems(step: Step, cands: ArrayLike<number>): string[] {
  const out = checkSets(step, cands).map((p) => `${p.issue} at ${p.at}${p.link ? `, link ${p.link}` : ''}`);
  out.push(...derivationProblems(step, (cell) => !cands[cell]));
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
