// The truth of a chain's nodes (docs/hint-drawing.md, "Truth: where it
// comes from"), so a hint can draw each node as what the chain makes it:
// a true node a filled disc, a false one a ring, as HoDoKu colours its
// chains green and blue.
//
// An AIC-form chain (Step.truth === 'derived') alternates as it is used: a
// strong link leaves a false node and enters a true one ("if this is
// false, that is true"), a weak link leaves a true node and enters a false
// one ("if this is true, that is false"). So the first node is assumed
// !links[0].strong, every target takes its link's strength, and the chain
// checks itself on the way: a link that leaves a node of the wrong truth,
// or a node given both truths, is a bug in its finder, reported as a
// problem. One node may take both: the start of a discontinuous loop,
// assumed one way at the start and proven the other way by the link that
// closes the loop (an inverted loop, weak first, is assumed true and
// proven false).
//
// A group or set node that is TRUE means "one of these", not "all of
// these": its members are 'groupTrue', never 'true', so a drawing does not
// teach that all of them are placed. A FALSE group means none of them, and
// its members are 'false'. A TRUE node whose every candidate the chain
// makes false says nothing true ('emptyTrue'), as when a chain's last set
// lies inside its first and the premise makes the first set's z false.
//
// An ALS pattern read as its chain may clash where its sets share cells
// (alsClash): it is then drawn with no truth, as a pattern is.
//
// A colouring (Step.truth === 'parity') reads its truth from its clusters
// instead: each cluster's two colours, exactly one of them wholly true.
// checkParity holds a colouring to that, and to its links' walk order, as
// the derivation holds a chain.
//
// A step's groups and almost locked sets (Step.sets; docs/hint-drawing-sets.md,
// Data) are held to their rules by checkSets, at the end: each set's
// shape, each link end's set, the links inside a set and between sets, the
// removals of the ALS patterns, and the letters.
import type { CellDigit, ChainLink, ChainSet, Step } from './steps';
import { isParity, isTie, insideSet } from './steps';
import { UNITS, bit, popcount, sees, boxOf, rowOf, colOf } from './board';

export type CandidateTruth = 'true' | 'false' | 'groupTrue';

export interface Derivation {
  /** each node, in the order the chain reaches it, with its truth (the start's as proven, for a discontinuous loop) */
  nodes: { node: CellDigit[]; truth: boolean }[];
  /** each candidate of a node, by "cell:digit" */
  candidates: Map<string, CandidateTruth>;
  /** each link's two ends, in link order, as the chain reads them at that link (the walk) */
  ends: { from: boolean; to: boolean }[];
  /** a discontinuous loop's start: assumed one way, proven the other */
  closure: { node: CellDigit[]; assumed: boolean; proven: boolean } | null;
  /** what is wrong with the chain, if anything; empty for every finder's chain */
  problems: Problem[];
}

/**
 * Something wrong with a chain, which is a bug in its finder: a link that
 * leaves a node the chain has not reached, or leaves a node of the wrong
 * truth (a strong link must leave a false node, a weak one a true node), a
 * node given both truths short of a loop's closing, a candidate both true
 * and false, a true candidate inside a false group, or a TRUE node of
 * several candidates all of which the chain makes false ('emptyTrue')
 */
export interface Problem {
  /** the link, counted from 1, or 0 for a candidate or a node */
  link: number;
  issue: 'unreached' | 'wrongTruth' | 'twoTruths' | 'bothWays' | 'inFalseGroup' | 'emptyTrue';
  /** the node or candidate, as 4r1c6 */
  at: string;
}

const keyOf = (cd: CellDigit) => `${cd.cell}:${cd.digit}`;
const nodeKey = (node: CellDigit[]) => node.map(keyOf).sort().join('+');
const label = (node: CellDigit[]) => node.map((cd) => `${cd.digit}r${Math.floor(cd.cell / 9) + 1}c${(cd.cell % 9) + 1}`).join(',');

/** the truth of a 'derived' chain's nodes; null for any other step */
export function deriveTruth(step: Step): Derivation | null {
  if (step.truth !== 'derived' || !step.links?.length) return null;
  return deriveLinks(step.links.filter((l) => !l.undirected));
}

/** the ALS patterns read as the chains they derive (docs/hint-drawing-sets.md, decision 11) */
const ALS_CHAINS = new Set<Step['tech']>(['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN']);
/** an ALS-XZ, ALS-XY-Wing or ALS-XY-Chain, a chain from its first set to its last */
export const isAlsChain = (step: Step): boolean => ALS_CHAINS.has(step.tech) && step.truth === 'derived';

/**
 * An ALS pattern whose chain does not derive cleanly: a problem (a true
 * candidate inside a false set's node, a true node left no candidate), or a
 * loop back to its first node, as when an ALS-XY-Chain's sets share cells
 * (docs/hint-drawing-sets.md, decision 13). Its truths would claim more than
 * the step proves, and a loop would read as a proof it does not make, so it
 * is drawn with no truth at all and told in words. No other step clashes
 */
export function alsClash(step: Step): boolean {
  if (!isAlsChain(step)) return false;
  const d = deriveTruth(step);
  return !!d && (d.problems.length > 0 || !!d.closure);
}

/** the derivation itself, over a chain's directed links in reading order */
export function deriveLinks(links: ChainLink[]): Derivation {
  const problems: Problem[] = [];
  const truths = new Map<string, boolean>();
  const order: CellDigit[][] = [];
  const ends: { from: boolean; to: boolean }[] = [];
  let closure: Derivation['closure'] = null;
  if (!links.length) return { nodes: [], candidates: new Map(), ends, closure, problems };

  const start = links[0].from;
  const startKey = nodeKey(start);
  truths.set(startKey, !links[0].strong);
  order.push(start);

  links.forEach((l, i) => {
    const from = truths.get(nodeKey(l.from));
    if (from === undefined) {
      problems.push({ link: i + 1, issue: 'unreached', at: label(l.from) });
    } else if (from !== !l.strong) {
      problems.push({ link: i + 1, issue: 'wrongTruth', at: label(l.from) });
    }
    const toKey = nodeKey(l.to);
    const before = truths.get(toKey);
    ends.push({ from: from ?? !l.strong, to: l.strong });
    if (before === undefined) {
      truths.set(toKey, l.strong);
      order.push(l.to);
    } else if (before !== l.strong) {
      if (toKey === startKey && i === links.length - 1) {
        closure = { node: start, assumed: before, proven: l.strong };
        truths.set(toKey, l.strong);
      } else {
        problems.push({ link: i + 1, issue: 'twoTruths', at: label(l.to) });
      }
    }
  });

  const nodes = order.map((node) => ({ node, truth: truths.get(nodeKey(node))! }));
  const candidates = new Map<string, CandidateTruth>();
  // a single candidate's own truth wins over what a group says of it
  for (const { node, truth } of nodes) {
    if (node.length !== 1) continue;
    const k = keyOf(node[0]);
    const was = candidates.get(k);
    const now: CandidateTruth = truth ? 'true' : 'false';
    if (was && was !== now) problems.push({ link: 0, issue: 'bothWays', at: label(node) });
    candidates.set(k, now);
  }
  for (const { node, truth } of nodes) {
    if (node.length === 1) continue;
    for (const cd of node) {
      const k = keyOf(cd);
      const was = candidates.get(k);
      if (!truth) {
        if (was === 'true') problems.push({ link: 0, issue: 'inFalseGroup', at: label([cd]) });
        if (was !== 'true') candidates.set(k, 'false');
      } else if (!was) candidates.set(k, 'groupTrue');
    }
  }
  // a true node of several candidates must keep one of them
  for (const { node, truth } of nodes) {
    if (truth && node.length > 1 && node.every((cd) => candidates.get(keyOf(cd)) === 'false')) {
      problems.push({ link: 0, issue: 'emptyTrue', at: label(node) });
    }
  }
  return { nodes, candidates, ends, closure, problems };
}

/**
 * Something wrong with a colouring (Step.truth === 'parity',
 * docs/hint-drawing-colouring.md, Data), which is a bug in its finder:
 * - 'twoColours': a candidate in two colours, or in two clusters;
 * - 'sameShade': a tie whose ends are not the two colours of one cluster;
 * - 'notStrong': a tie that is no strong relation (two candidates of one
 *   cell, or one digit in two cells that see each other; with the board's
 *   candidates, a cell holding only those two, a house holding the digit
 *   only there, or two cells holding the same two digits only);
 * - 'notWeak': a weak tie two of whose candidates neither share a cell nor
 *   are one digit in cells that see each other;
 * - 'unspanned': a cluster its ties do not join into one;
 * - 'order': a link out of walk order (cluster 0's ties, then cluster 1's,
 *   then the argument);
 * - 'notRemoved': a candidate of the colour proven false that the step
 *   does not remove;
 * - 'removedOutside': a coloured candidate the step removes outside the
 *   colour proven false.
 */
export interface ParityProblem {
  /** the link, counted from 1, or 0 for a candidate */
  link: number;
  issue: 'twoColours' | 'sameShade' | 'notStrong' | 'notWeak' | 'unspanned' | 'order' | 'notRemoved' | 'removedOutside';
  /** the candidate or the link's first end, as 4r1c6; a cluster as its index */
  at: string;
}

/**
 * What is wrong with a colouring; empty for every finder's colouring, and
 * for any step that is not one. `cands`, the position's candidates (0 for a
 * solved cell), lets each tie be checked against the board's houses.
 */
export function checkParity(step: Step, cands?: ArrayLike<number>): ParityProblem[] {
  if (!isParity(step)) return [];
  const { clusters, darkFalse } = step.colouring!;
  const links = step.links ?? [];
  const problems: ParityProblem[] = [];
  // each candidate's cluster and colour
  const colour = new Map<string, { k: number; dark: boolean }>();
  clusters.forEach((cl, k) => {
    for (const [list, dark] of [
      [cl.dark, true],
      [cl.light, false]
    ] as const) {
      for (const cd of list) {
        if (colour.has(keyOf(cd))) problems.push({ link: 0, issue: 'twoColours', at: label([cd]) });
        else colour.set(keyOf(cd), { k, dark });
      }
    }
  });

  // a strong relation: exactly one of the two is true
  const strong = (a: CellDigit, b: CellDigit) => {
    if (a.cell === b.cell) return a.digit !== b.digit && (!cands || popcount(cands[a.cell]) === 2);
    if (a.digit !== b.digit || !sees(a.cell, b.cell)) return false;
    if (!cands) return true;
    const conjugate = UNITS.some(
      (u) => u.includes(a.cell) && u.includes(b.cell) && u.filter((c) => cands[c] & bit(a.digit)).length === 2
    );
    const remotePair = cands[a.cell] === cands[b.cell] && popcount(cands[a.cell]) === 2;
    return conjugate || remotePair;
  };
  // a weak relation: at most one of the two is true
  const weak = (a: CellDigit, b: CellDigit) => (a.cell === b.cell ? a.digit !== b.digit : a.digit === b.digit && sees(a.cell, b.cell));

  // the ties of each cluster, which must join it into one
  const joined = clusters.map((cl) => {
    const parent = new Map([...cl.dark, ...cl.light].map((cd) => [keyOf(cd), keyOf(cd)]));
    return parent;
  });
  const root = (parent: Map<string, string>, x: string): string => {
    while (parent.get(x) !== x) x = parent.get(x)!;
    return x;
  };
  // walk order: the cluster whose ties come now, or the argument (-1 before any)
  let stage = -1;
  let argued = false;
  links.forEach((l, i) => {
    if (isTie(l)) {
      const [a, b] = [l.from[0], l.to[0]];
      const ca = colour.get(keyOf(a));
      const cb = colour.get(keyOf(b));
      if (l.from.length !== 1 || l.to.length !== 1 || !ca || !cb || ca.k !== cb.k || ca.dark === cb.dark) {
        problems.push({ link: i + 1, issue: 'sameShade', at: label(l.from) });
        return;
      }
      if (!strong(a, b)) problems.push({ link: i + 1, issue: 'notStrong', at: label(l.from) });
      if (argued || ca.k < stage) problems.push({ link: i + 1, issue: 'order', at: label(l.from) });
      stage = Math.max(stage, ca.k);
      const parent = joined[ca.k];
      parent.set(root(parent, keyOf(a)), root(parent, keyOf(b)));
      return;
    }
    argued = true;
    if (!l.from.every((a) => l.to.every((b) => weak(a, b)))) problems.push({ link: i + 1, issue: 'notWeak', at: label(l.from) });
  });
  joined.forEach((parent, k) => {
    if (new Set([...parent.keys()].map((x) => root(parent, x))).size > 1) problems.push({ link: 0, issue: 'unspanned', at: String(k) });
  });

  // the colour proven false is removed, and nothing else coloured is
  const removed = new Set(step.eliminations.map(keyOf));
  if (darkFalse !== undefined) {
    for (const cd of clusters[darkFalse]?.dark ?? []) if (!removed.has(keyOf(cd))) problems.push({ link: 0, issue: 'notRemoved', at: label([cd]) });
  }
  for (const cd of step.eliminations) {
    const c = colour.get(keyOf(cd));
    if (c && !(c.k === darkFalse && c.dark)) problems.push({ link: 0, issue: 'removedOutside', at: label([cd]) });
  }
  return problems;
}

/**
 * Something wrong with a step's sets (Step.sets, docs/hint-drawing-sets.md,
 * Data), which is a bug in its finder:
 * - 'shape': a group that is not 2-3 candidates of one digit in one box and
 *   one row or column, all the digit has there; an almost locked set that
 *   is not n cells of one house holding n+1 digits, or whose members are
 *   not every candidate of its cells; a set its own unit does not hold;
 * - 'notMember': a link end that is not exactly its set's cells holding
 *   that one digit;
 * - 'internal': a link inside one set that is weak, joins one digit, or is
 *   inside a group; a strong link between two digits in different cells
 *   that is not inside one almost locked set, in a chain read as an AIC
 *   (truth 'derived') or a step with sets (a forcing chain's links are
 *   inferences of another kind);
 * - 'notRestricted': a restricted common some candidate of which does not
 *   see every candidate of that digit in the other set (any weak link of
 *   one digit with an almost locked set at either end: into a set, out of
 *   one, between two, or from a Death Blossom's stem to its petal);
 * - 'zNotSeen': a removal of an ALS pattern that does not see every z of
 *   both end sets (ALS-XZ's A and B, an ALS-XY-Wing's wings A and B, an
 *   ALS-XY-Chain's A and D), or of every petal of a Death Blossom;
 * - 'overlap': two sets sharing a cell that the technique keeps apart: any
 *   two of an ALS-XZ, an ALS-XY-Wing or a Death Blossom's petals, and an
 *   ALS-XY-Chain's neighbours (its other pairs may share cells, as in
 *   HoDoKu);
 * - 'letters': letters not the technique's convention: every almost locked
 *   set lettered and no group, each letter once; ALS-XZ's A and B, A
 *   holding the start; an ALS-XY-Wing's A and B the wings, linked to the
 *   hinge C by x and by y; an ALS-XY-Chain's A to D along the chain; Death
 *   Blossom's petals A, B, C in stem-digit order; any other step's sets
 *   listed in order of first appearance, its almost locked sets lettered A,
 *   B, ... in that order.
 */
export interface SetProblem {
  /** the link, counted from 1, or 0 for a set, a removal or the letters */
  link: number;
  issue: 'shape' | 'notMember' | 'internal' | 'notRestricted' | 'zNotSeen' | 'overlap' | 'letters';
  /**
   * the set (its letter, or its candidates as 4r1c6,4r2c6), the link's
   * first end, the removal, or the sets in order (each by its letter, a
   * group as 'group')
   */
  at: string;
}

const ascending = (xs: number[]) => xs.every((x, i) => i === 0 || xs[i - 1] < x);
/** one node's digit, or NaN for a node of several digits */
const digitOf = (node: CellDigit[]) => (node.length && node.every((m) => m.digit === node[0].digit) ? node[0].digit : NaN);

/** a set as its rules have it (the 'shape' of checkSets); `cands` the position's, 0 for a solved cell */
function shaped(s: ChainSet, cands?: ArrayLike<number>): boolean {
  const { cells, digits, members } = s;
  if (!cells.length || !ascending(cells) || !ascending(digits)) return false;
  if (!cells.every((c) => UNITS[s.unit]?.includes(c))) return false;
  // members by cell then digit, each of the set's cells and digits, every cell holding one
  if (!ascending(members.map((m) => m.cell * 10 + m.digit))) return false;
  if (!members.every((m) => cells.includes(m.cell) && digits.includes(m.digit))) return false;
  if (!cells.every((c) => members.some((m) => m.cell === c))) return false;
  if (s.kind === 'group') {
    if (digits.length !== 1 || cells.length < 2 || cells.length > 3 || members.length !== cells.length) return false;
    const [first] = cells;
    const inRow = cells.every((c) => rowOf(c) === rowOf(first));
    const inColumn = cells.every((c) => colOf(c) === colOf(first));
    if (!cells.every((c) => boxOf(c) === boxOf(first)) || !(inRow || inColumn)) return false;
    // all the digit has in that box and line
    if (!cands) return true;
    const line = (c: number) => (inRow ? rowOf(c) === rowOf(first) : colOf(c) === colOf(first));
    return UNITS[18 + boxOf(first)].filter((c) => line(c) && cands[c] & bit(digits[0])).join() === cells.join();
  }
  if (s.kind !== 'als' || digits.length !== cells.length + 1) return false;
  // between them its cells hold its digits, and nothing else
  if (digits.some((d) => !members.some((m) => m.digit === d))) return false;
  if (!cands) return true;
  return members.length === cells.reduce((n, c) => n + popcount(cands[c]), 0) && members.every((m) => cands[m.cell] & bit(m.digit));
}

/** the removals' end sets of each ALS pattern, by letter: Death Blossom's every petal */
const END_SETS: Partial<Record<Step['tech'], string[]>> = { ALS_XZ: ['A', 'B'], ALS_XY_WING: ['A', 'B'], ALS_XY_CHAIN: ['A', 'D'] };

/** the links between two sets of each ALS pattern, from set to set by letter, in link order: Death Blossom's from the stem */
const LINKED: Partial<Record<Step['tech'], string[][]>> = {
  ALS_XZ: [['A', 'B']],
  ALS_XY_WING: [
    ['A', 'C'],
    ['C', 'B']
  ],
  ALS_XY_CHAIN: [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D']
  ]
};

/**
 * What is wrong with a step's sets; empty for every finder's step, and for
 * a step with none. `cands`, the position's candidates (0 for a solved
 * cell), lets each set's shape be checked against the board.
 */
export function checkSets(step: Step, cands?: ArrayLike<number>): SetProblem[] {
  const sets = step.sets ?? [];
  const links = step.links ?? [];
  const problems: SetProblem[] = [];
  const named = (s: ChainSet) => (s.letter ? `set ${s.letter}` : label(s.members));
  const letterOf = (i: number | undefined) => (i === undefined ? '' : (sets[i]?.letter ?? '?'));
  const isAls = (i: number | undefined) => i !== undefined && sets[i]?.kind === 'als';

  for (const s of sets) if (!shaped(s, cands)) problems.push({ link: 0, issue: 'shape', at: named(s) });

  links.forEach((l, i) => {
    const at = label(l.from);
    // each end that is a set's node: exactly the set's cells holding its one digit
    for (const [end, index] of [
      [l.from, l.fromSet],
      [l.to, l.toSet]
    ] as const) {
      if (index === undefined) continue;
      const s = sets[index];
      const d = digitOf(end);
      const holding = s?.members.filter((m) => m.digit === d).map((m) => m.cell);
      const cells = end.map((m) => m.cell).sort((a, b) => a - b);
      if (!s || !holding?.length || holding.join() !== cells.join()) problems.push({ link: i + 1, issue: 'notMember', at });
    }
    const [fd, td] = [digitOf(l.from), digitOf(l.to)];
    const oneCell = l.from.length === 1 && l.to.length === 1 && l.from[0].cell === l.to[0].cell;
    if (insideSet(l)) {
      // the set's lock: from one of its digits to another, strong
      if (!isAls(l.fromSet) || !l.strong || fd === td) problems.push({ link: i + 1, issue: 'internal', at });
    } else if ((step.truth === 'derived' || sets.length > 0) && l.strong && fd !== td && !oneCell) {
      problems.push({ link: i + 1, issue: 'internal', at });
    }
    // a restricted common: every candidate of its digit at one end sees every one at the other
    if (!l.strong && !insideSet(l) && fd === td && (isAls(l.fromSet) || isAls(l.toSet))) {
      const side = (end: CellDigit[], index: number | undefined) =>
        index === undefined ? end : (sets[index]?.members.filter((m) => m.digit === fd) ?? []);
      const [a, b] = [side(l.from, l.fromSet), side(l.to, l.toSet)];
      if (!a.length || !b.length || !a.every((p) => b.every((q) => sees(p.cell, q.cell)))) {
        problems.push({ link: i + 1, issue: 'notRestricted', at });
      }
    }
  });

  // the ALS patterns: each removal sees every z of the end sets
  const ends = step.tech === 'DEATH_BLOSSOM' ? sets : END_SETS[step.tech]?.map((L) => sets.find((s) => s.letter === L));
  for (const e of ends ? step.eliminations : []) {
    const seen = ends!.every((s) => {
      const zs = s?.members.filter((m) => m.digit === e.digit) ?? [];
      return zs.length > 0 && zs.every((m) => sees(e.cell, m.cell));
    });
    if (!seen) problems.push({ link: 0, issue: 'zNotSeen', at: label([e]) });
  }

  // the sets an ALS pattern keeps apart
  const apart: [number, number][] = [];
  if (step.tech === 'ALS_XY_CHAIN') for (let i = 1; i < sets.length; i++) apart.push([i - 1, i]);
  else if (['ALS_XZ', 'ALS_XY_WING', 'DEATH_BLOSSOM'].includes(step.tech)) {
    for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) apart.push([i, j]);
  }
  for (const [i, j] of apart) {
    if (!sets[i].cells.some((c) => sets[j].cells.includes(c))) continue;
    problems.push({ link: 0, issue: 'overlap', at: `${named(sets[i])} ${named(sets[j])}` });
  }

  // the letters: every almost locked set's, no group's, each once, in the technique's order
  const letters = sets.map((s) => s.letter ?? '');
  const between = links.filter((l) => !insideSet(l) && l.toSet !== undefined).map((l) => [letterOf(l.fromSet), letterOf(l.toSet)]);
  const abc = (n: number) => Array.from({ length: n }, (_, k) => String.fromCharCode(65 + k));
  let lettered =
    sets.every((s) => (s.kind === 'als') === !!s.letter) && new Set(letters.filter(Boolean)).size === letters.filter(Boolean).length;
  if (LINKED[step.tech]) {
    const expected = LINKED[step.tech]!;
    lettered &&= letters.join() === abc(expected.length + 1).join() && JSON.stringify(between) === JSON.stringify(expected);
  } else if (step.tech === 'DEATH_BLOSSOM') {
    // a petal for each stem digit, in its order
    const stemDigits = links.filter((l) => l.fromSet === undefined && l.toSet !== undefined).map((l) => digitOf(l.from));
    lettered &&=
      letters.join() === abc(sets.length).join() &&
      JSON.stringify(between) === JSON.stringify(letters.map((L) => ['', L])) &&
      ascending(stemDigits);
  } else if (sets.length) {
    // in order of first appearance along the links
    const order: number[] = [];
    for (const l of links) for (const i of [l.fromSet, l.toSet]) if (i !== undefined && !order.includes(i)) order.push(i);
    sets.forEach((_, i) => order.includes(i) || order.push(i));
    const inOrder = order.map((i) => letters[i]).filter(Boolean);
    lettered &&= inOrder.join() === abc(inOrder.length).join() && order.every((i, k) => i === k);
  }
  if (!lettered) problems.push({ link: 0, issue: 'letters', at: sets.map((s) => s.letter ?? s.kind).join() });
  return problems;
}
