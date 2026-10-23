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
import type { CellDigit, ChainLink, Step } from './steps';

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
