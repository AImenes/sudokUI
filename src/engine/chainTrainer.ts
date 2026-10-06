/**
 * The chain trainer: the player builds a chain on the board one candidate
 * at a time, and the engine says what each link is and what the chain
 * proves so far (docs/chain-trainer.md). The reverse of the hint
 * renderer: there the engine writes the chain and the player reads it.
 *
 * The vocabulary is the AIC's. A strong link joins two candidates of which
 * at least one is true: the two candidates of a bivalue cell, or a
 * conjugate pair (a digit's only two places in a house). A weak link joins
 * two that cannot both be true: two candidates of one cell, or the same
 * digit in two cells that see each other. A chain alternates strong, weak,
 * strong... and a strong link may serve as a weak one. A chain that starts
 * and ends with a strong link proves that one of its two ends is true, so
 * every candidate that sees both ends is false.
 */
import { Grid, CELL_UNITS, UNITS, bit, popcount, sees, cellName } from './board';
import { CellDigit, ChainLink, Step } from './steps';

export type LinkKind = 'strong' | 'weak';

export interface Verdict {
  kind: LinkKind | null;
  /** why, in the technique's words */
  why: string;
}

export interface Chain {
  nodes: CellDigit[];
  /** links[i] joins nodes[i] and nodes[i + 1] */
  links: LinkKind[];
}

export const EMPTY_CHAIN: Chain = { nodes: [], links: [] };

const same = (a: CellDigit, b: CellDigit) => a.cell === b.cell && a.digit === b.digit;
const isCand = (g: Grid, cd: CellDigit) => g.values[cd.cell] === 0 && !!(g.cands[cd.cell] & bit(cd.digit));
const unitName = (u: number) => (u < 9 ? `row ${u + 1}` : u < 18 ? `column ${u - 8}` : `box ${u - 17}`);

/** What joins two candidates in this position, if anything. */
export function classifyLink(g: Grid, a: CellDigit, b: CellDigit): Verdict {
  if (same(a, b)) return { kind: null, why: 'that is the same candidate' };
  if (!isCand(g, a) || !isCand(g, b)) return { kind: null, why: 'that is not a candidate in this position' };
  if (a.cell === b.cell) {
    return popcount(g.cands[a.cell]) === 2
      ? { kind: 'strong', why: `${cellName(a.cell)} holds only ${a.digit} and ${b.digit}, so one of them is true` }
      : { kind: 'weak', why: `${a.digit} and ${b.digit} share ${cellName(a.cell)}, so they cannot both be true` };
  }
  if (a.digit !== b.digit) {
    return { kind: null, why: `${cellName(a.cell)} and ${cellName(b.cell)} hold different digits in different cells: no link` };
  }
  if (!sees(a.cell, b.cell)) {
    return { kind: null, why: `${cellName(a.cell)} and ${cellName(b.cell)} do not see each other: no link on ${a.digit}` };
  }
  const shared = CELL_UNITS[a.cell].filter((u) => CELL_UNITS[b.cell].includes(u));
  const b1 = bit(a.digit);
  const conjugate = shared.find((u) => UNITS[u].filter((c) => g.values[c] === 0 && g.cands[c] & b1).length === 2);
  if (conjugate !== undefined) {
    return { kind: 'strong', why: `${cellName(a.cell)} and ${cellName(b.cell)} are the only places for ${a.digit} in ${unitName(conjugate)}, so one of them is true` };
  }
  return { kind: 'weak', why: `${cellName(a.cell)} and ${cellName(b.cell)} see each other in ${unitName(shared[0])}, so they cannot both be ${a.digit}` };
}

/** the kind of link the chain needs next: strong at even positions */
export const needs = (chain: Chain): LinkKind => (chain.links.length % 2 === 0 ? 'strong' : 'weak');

export interface Extension {
  ok: boolean;
  chain: Chain;
  /** what happened, for the panel */
  message: string;
}

/** Try to add a candidate to the end of the chain. */
export function extend(g: Grid, chain: Chain, node: CellDigit): Extension {
  if (!isCand(g, node)) return { ok: false, chain, message: `${cellName(node.cell)} has no ${node.digit} to tap.` };
  if (chain.nodes.length === 0) {
    return {
      ok: true,
      chain: { nodes: [node], links: [] },
      message: `${node.digit} in ${cellName(node.cell)} starts the chain. Now tap a candidate strongly linked to it: the other candidate of a bivalue cell, or the digit's only other place in a row, column or box.`
    };
  }
  if (chain.nodes.some((n) => same(n, node))) return { ok: false, chain, message: `${node.digit} in ${cellName(node.cell)} is already in the chain.` };
  const last = chain.nodes[chain.nodes.length - 1];
  const v = classifyLink(g, last, node);
  if (!v.kind) return { ok: false, chain, message: `Not a link: ${v.why}.` };
  const need = needs(chain);
  if (need === 'strong' && v.kind === 'weak') {
    return {
      ok: false,
      chain,
      message: `Only a weak link: ${v.why}. The chain needs a strong link here (one of the two true): a bivalue cell or a conjugate pair.`
    };
  }
  const next: Chain = { nodes: [...chain.nodes, node], links: [...chain.links, v.kind] };
  const used = need === 'weak' && v.kind === 'strong' ? 'Strong link, used as weak' : v.kind === 'strong' ? 'Strong link' : 'Weak link';
  return { ok: true, chain: next, message: `${used}: ${v.why}.` };
}

/** The chain read from its first candidate: what being false there forces. */
export function statement(chain: Chain): string {
  const { nodes, links } = chain;
  if (!links.length) return '';
  const name = (n: CellDigit) => `${n.digit} in ${cellName(n.cell)}`;
  const parts: string[] = [`If the ${name(nodes[0])} is false`];
  for (let i = 0; i < links.length; i++) {
    // at even links the previous node is false, so this one is true; at odd links the reverse
    parts.push(`${i === 0 ? 'then' : 'so'} the ${name(nodes[i + 1])} is ${i % 2 === 0 ? 'true' : 'false'}`);
  }
  return parts.join(', ') + '.';
}

/** weakly linked: cannot both be true */
const weakTo = (c: CellDigit, n: CellDigit) =>
  !same(c, n) && ((c.cell === n.cell && c.digit !== n.digit) || (c.digit === n.digit && sees(c.cell, n.cell)));

/** What a chain that ends on a strong link removes: every candidate that sees both ends. */
export function conclusions(g: Grid, chain: Chain): CellDigit[] {
  const { nodes, links } = chain;
  if (links.length < 1 || links.length % 2 === 0) return [];
  const a = nodes[0];
  const z = nodes[nodes.length - 1];
  const out: CellDigit[] = [];
  for (let cell = 0; cell < 81; cell++) {
    if (g.values[cell]) continue;
    for (let digit = 1; digit <= 9; digit++) {
      const c = { cell, digit };
      if (!(g.cands[cell] & bit(digit))) continue;
      if (nodes.some((n) => same(n, c))) continue;
      if (weakTo(c, a) && weakTo(c, z)) out.push(c);
    }
  }
  return out;
}

/** The chain as a step, so the board draws it like a hint. */
export function chainStep(g: Grid, chain: Chain): Step {
  const { nodes, links } = chain;
  const eliminations = conclusions(g, chain);
  const name = (n: CellDigit) => `${n.digit} in ${cellName(n.cell)}`;
  const drawn: ChainLink[] = links.map((kind, i) => ({
    from: [nodes[i]],
    to: [nodes[i + 1]],
    strong: kind === 'strong',
    text:
      i % 2 === 0
        ? `If the ${name(nodes[i])} is false, the ${name(nodes[i + 1])} is true (strong link).`
        : `If the ${name(nodes[i])} is true, the ${name(nodes[i + 1])} is false (weak link).`
  }));
  const allSameDigit = nodes.every((n) => n.digit === nodes[0].digit);
  const ends = links.length && links.length % 2 === 1;
  const verdict = !links.length
    ? ''
    : !ends
      ? ' The chain ends on a weak link: add a strong link to finish it.'
      : eliminations.length
        ? ` One of the two ends is true, so every candidate that sees both is false: ${eliminations.map((e) => `${e.digit} in ${cellName(e.cell)}`).join(', ')}.`
        : ' One of the two ends is true, but no candidate sees both yet: keep going, or start elsewhere.';
  return {
    tech: allSameDigit ? 'X_CHAIN' : 'AIC',
    placements: [],
    eliminations,
    primary: nodes,
    labels: { primary: 'your chain, read along the arrows' },
    links: drawn,
    description: `${statement(chain)}${verdict}`.trim()
  };
}
