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
// its members are 'false'.
//
// A colouring (Step.truth === 'parity') reads its truth from its clusters
// instead: each cluster's two colours, exactly one of them wholly true.
// checkParity, at the end, holds a colouring to that, and to its links'
// walk order, as the derivation holds a chain.
import type { CellDigit, ChainLink, Step } from './steps';
import { isParity, isTie } from './steps';
import { UNITS, bit, popcount, sees } from './board';

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
 * and false, or a true candidate inside a false group
 */
export interface Problem {
  /** the link, counted from 1, or 0 for a candidate */
  link: number;
  issue: 'unreached' | 'wrongTruth' | 'twoTruths' | 'bothWays' | 'inFalseGroup';
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
