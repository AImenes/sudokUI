import { Tech } from './ratings';

export interface CellDigit {
  cell: number;
  digit: number;
}

/**
 * One arrow of a chain visualisation. `from` and `to` are candidate sets —
 * a single candidate for ordinary nodes, several for group/ALS nodes (the
 * arrow anchors at their centroid). Strong links draw solid, weak dashed,
 * following HoDoKu's convention.
 */
export interface ChainLink {
  from: CellDigit[];
  to: CellDigit[];
  strong: boolean;
}

/**
 * Links for a chain given as a node sequence with strict alternation,
 * starting strong (the AIC normal form every chain finder uses). `closure`
 * appends the loop-closing link back to the first node.
 */
export function alternatingLinks(
  nodes: CellDigit[][],
  closure?: 'strong' | 'weak'
): ChainLink[] {
  const links: ChainLink[] = [];
  for (let i = 1; i < nodes.length; i++) {
    links.push({ from: nodes[i - 1], to: nodes[i], strong: (i - 1) % 2 === 0 });
  }
  if (closure) {
    links.push({
      from: nodes[nodes.length - 1],
      to: nodes[0],
      strong: closure === 'strong'
    });
  }
  return links;
}

/** One solving step: what to do, plus everything needed to visualise it. */
export interface Step {
  tech: Tech;
  placements: CellDigit[];
  eliminations: CellDigit[];
  /** pattern candidates highlighted blue (e.g. base cells, chain cells) */
  primary?: CellDigit[];
  /** supporting candidates highlighted amber (e.g. cover cells, pincers) */
  secondary?: CellDigit[];
  /** fins / special cells highlighted purple */
  fins?: CellDigit[];
  /** ordered chain of cells — legacy centre-to-centre fallback drawing */
  chainCells?: number[];
  /** candidate-anchored arrows; when present they replace `chainCells` */
  links?: ChainLink[];
  description: string;
}
