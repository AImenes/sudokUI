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
  /** the sentence the walk reads for this link, when the generic one would not do */
  text?: string;
  /**
   * a tie rather than an inference: the two ends are a conjugate pair or
   * the two candidates of a bivalue cell, exactly one of them true, so
   * they take opposite colours. Drawn as a quiet line without an arrowhead;
   * the walk shows all of a step's ties in one frame.
   */
  undirected?: boolean;
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

/**
 * A whole row, column or box shaded as a band: a fish's base and cover
 * lines, the house a locked set lives in, the house a single was found in.
 * Primary and secondary follow the step's colour grammar and its labels.
 */
export interface UnitBand {
  /** index into UNITS: rows 0-8, columns 9-17, boxes 18-26 */
  unit: number;
  role: 'primary' | 'secondary';
}

/**
 * One solving step: what to do, plus everything needed to visualise it.
 *
 * The colour grammar every step follows (docs/highlighting.md): blue is
 * the pattern itself, amber is what the pattern acts through, purple is
 * the exception (a fin, the extra candidate), red is removed and green is
 * placed. A step names what its colours mean in `labels`, so the legend
 * always speaks; a solved cell listed in a colour is shown by its digit.
 */
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
  /**
   * what each colour means in this step, for the legend; a colour without a
   * label here is named generically ("the pattern", "supporting cells", "fin")
   */
  labels?: { primary?: string; secondary?: string; fins?: string };
  /** whole houses shaded as bands, under the candidate marks */
  units?: UnitBand[];
  /** ordered chain of cells — legacy centre-to-centre fallback drawing */
  chainCells?: number[];
  /** candidate-anchored arrows; when present they replace `chainCells` */
  links?: ChainLink[];
  description: string;
}
