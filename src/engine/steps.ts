import { Tech } from './ratings';

export interface CellDigit {
  cell: number;
  digit: number;
}

/**
 * One arrow of a chain visualisation. `from` and `to` are candidate sets —
 * a single candidate for ordinary nodes, several for group/ALS nodes (the
 * arrow is joined at the member nearest the other end; docs/hint-drawing.md
 * G10). Strong links draw solid, weak dashed, following HoDoKu's convention.
 */
export interface ChainLink {
  from: CellDigit[];
  to: CellDigit[];
  strong: boolean;
  /** the sentence the walk reads for this link, when the generic one would not do */
  text?: string;
  /**
   * no direction, so no arrowhead and no start dot.
   * - Strong: a tie, exactly one of the two ends true (a conjugate pair,
   *   the two candidates of a bivalue cell, the same digit of two Remote
   *   Pair cells that see each other), so they take opposite colours: a
   *   quiet straight line, nothing inside one cell, drawn only in its
   *   cluster's walk frame (a colouring, `truth: 'parity'`).
   * - Weak (a colouring only): a weak tie, the two ends see each other or
   *   share a cell, so at most one of them is true (a witness, a clash, a
   *   bridge). It claims no truth, so it stays true whatever its ends turn
   *   out to be: a dashed line with no head, bent like an arrow, or, inside
   *   one cell, corner brackets round the cell; drawn from its walk frame on
   *   and in the full view (docs/hint-drawing-colouring.md).
   */
  undirected?: boolean;
}

/** a link drawn as a tie: exactly one of its two ends is true, and it says nothing more */
export const isTie = (link: ChainLink): boolean => !!link.undirected && link.strong;

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
 * The rule a colouring applies (docs/hint-drawing-colouring.md, Per rule);
 * the Copy step line uses HoDoKu's names for them:
 * - 'trap', 'wrap': Simple Colors Trap and Wrap;
 * - 'bridge': two colours of two clusters see each other, so one of the
 *   other two colours is true (HoDoKu's Multi Colors 1);
 * - 'seesBoth': a colour sees both colours of the other cluster, so it is
 *   false (HoDoKu's Multi Colors 2);
 * - 'medusa1' to 'medusa6': 3D Medusa's six rules (a colour twice in a
 *   cell; twice in a house; a cell holding both colours; a candidate seeing
 *   both colours; seeing one colour while its cell holds the other; a cell
 *   one colour would empty);
 * - 'remotePair': one cluster over the two digits of a Remote Pair.
 */
export type ColourRule =
  | 'trap'
  | 'wrap'
  | 'bridge'
  | 'seesBoth'
  | 'medusa1'
  | 'medusa2'
  | 'medusa3'
  | 'medusa4'
  | 'medusa5'
  | 'medusa6'
  | 'remotePair';

/**
 * A cluster of candidates in two colours, drawn as two shades of one hue:
 * either every dark candidate is true and every light one false, or the
 * other way round. Dark is the colour the argument tries first.
 */
export interface ColourCluster {
  dark: CellDigit[];
  light: CellDigit[];
}

/**
 * A colouring (`truth: 'parity'`). Its links come in walk order: cluster
 * 0's ties, the first of them carrying the cluster frame's sentence in
 * `text`; cluster 1's ties, likewise; then the argument's weak ties, each
 * with its sentence.
 */
export interface Colouring {
  rule: ColourRule;
  /** 0 drawn purple; 1 orange (Multi Colors only) */
  clusters: ColourCluster[];
  /** the cluster whose dark colour the step proves false, and so its light colour true */
  darkFalse?: 0 | 1;
}

/** a colouring step: its truth is its clusters' parity */
export const isParity = (step: Step): boolean => step.truth === 'parity' && !!step.colouring;

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
  /**
   * How the truth of the chain's nodes is read (docs/hint-drawing.md,
   * "Truth: where it comes from"); absent for a pattern, which claims none.
   * 'derived': an AIC-form chain, whose links alternate as used, so a
   * strong link leaves a false node for a true one and a weak link a true
   * node for a false one (src/engine/truth.ts). Never inferred from `tech`:
   * the chain trainer reuses chain techniques' names, and says 'derived'
   * itself, drawing each link as the kind it is used as (strong at the even
   * links, weak at the odd ones), whatever the pair's own kind.
   * 'parity': a colouring, whose candidates take two colours of which
   * exactly one is true, told in `colouring`.
   */
  truth?: 'derived' | 'parity';
  /** with truth 'parity' only; such a step names no primary, secondary, fins or labels */
  colouring?: Colouring;
  description: string;
}
