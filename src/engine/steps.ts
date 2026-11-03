import { Tech } from './ratings';
import { Grid, CELL_UNITS, UNITS, bit, rowOf, colOf } from './board';

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
   *   quiet line, straight unless it would cross another mark of its
   *   frame, nothing inside one cell, drawn only in its cluster's walk
   *   frame (a colouring, `truth: 'parity'`).
   * - Weak (a colouring only): a weak tie, the two ends see each other or
   *   share a cell, so at most one of them is true (a witness, a clash, a
   *   bridge). It claims no truth, so it stays true whatever its ends turn
   *   out to be: a dashed line with no head, bent like an arrow, or, inside
   *   one cell, corner brackets round the cell; drawn from its walk frame on
   *   and in the full view (docs/hint-drawing-colouring.md).
   */
  undirected?: boolean;
  /**
   * the set each end is a node of (an index into Step.sets): a group, or one
   * digit of an almost locked set (of one candidate too, so a link inside a
   * set is known); absent for a lone candidate, and for AIC with ALS's
   * one-cell "set", a bivalue cell
   */
  fromSet?: number;
  toSet?: number;
  /**
   * the house that makes a link between one digit's candidates in different
   * cells (a UNITS index), which the link's sentence names
   * (docs/hint-readability-2026-11.md M17): for a strong link, a house whose
   * only places for the digit are the link's cells; for a weak link, a house
   * every cell of it lies in, so they all see each other. A row or column
   * before the box, so the box is named only where it alone makes the link.
   * Named when a step is found (withHouses); absent where no one house makes
   * the link, and on a link with a sentence of its own
   */
  unit?: number;
}

/**
 * The house that makes a link on one digit between these cells, as
 * ChainLink.unit names it: the first of the cells' row, column and box that
 * holds them all and, for a strong link, holds the digit nowhere else; -1
 * where none does
 */
export function linkHouse(g: Grid, cells: number[], digit: number, strong: boolean): number {
  const b = bit(digit);
  if (!cells.length || !cells.every((c) => !g.values[c] && g.cands[c] & b)) return -1;
  for (const u of CELL_UNITS[cells[0]]) {
    if (!cells.every((c) => CELL_UNITS[c].includes(u))) continue;
    if (!strong || UNITS[u].filter((c) => !g.values[c] && g.cands[c] & b).length === new Set(cells).size) return u;
  }
  return -1;
}

/**
 * A found step with the house of each of its links between one digit's
 * candidates in different cells named (ChainLink.unit), from the position
 * the step was found in; every finder's step passes through it
 * (src/engine/humanSolver.ts). A link with a sentence of its own, a tie, a
 * link inside a cell and one whose house its finder named are left as they
 * are.
 */
export function withHouses<S extends Step | null>(step: S, g: Grid): S {
  for (const link of step?.links ?? []) {
    if (link.text || link.undirected || link.unit !== undefined) continue;
    const digit = link.from[0]?.digit;
    if (![...link.from, ...link.to].every((cd) => cd.digit === digit)) continue;
    const [from, to] = [link.from, link.to].map((node) => [...new Set(node.map((cd) => cd.cell))]);
    if (from.some((c) => to.includes(c))) continue;
    const unit = linkHouse(g, [...from, ...to], digit, link.strong);
    if (unit >= 0) link.unit = unit;
  }
  return step;
}

/** a link drawn as a tie: exactly one of its two ends is true, and it says nothing more */
export const isTie = (link: ChainLink): boolean => !!link.undirected && link.strong;

/**
 * A node of several candidates a chain reads as one, or an almost locked
 * set (docs/hint-drawing-sets.md, Data).
 */
export interface ChainSet {
  /**
   * 'group': the 2-3 candidates of one digit in one box and one row or
   * column, all the digit has there: one node (TRUE: one of them; FALSE:
   * none).
   * 'als': n cells of one house holding n+1 digits between them; each digit
   * is a node (the set's cells holding it), and without any one digit the
   * others fill the cells.
   */
  kind: 'group' | 'als';
  /** ascending */
  cells: number[];
  /** ascending: a group's one digit, an almost locked set's n+1 */
  digits: number[];
  /** every candidate of the set at the step's position, by cell then digit */
  members: CellDigit[];
  /** the house the finder found it in (a UNITS index), for the words: a group's row or column */
  unit: number;
  /** an almost locked set's name, 'A' to 'D' in the patterns, 'A', 'B', ... along an AIC with ALS (HoDoKu's lettering); none for a group */
  letter?: string;
}

/** a link between two digits of one almost locked set: drawn as nothing (G12), carried by its tiles and its sentence */
export const insideSet = (l: ChainLink) => l.fromSet !== undefined && l.fromSet === l.toSet;

/** a link's set ends, each only where that end is a node of a set */
export const setEnds = (fromSet?: number, toSet?: number): Pick<ChainLink, 'fromSet' | 'toSet'> => ({
  ...(fromSet !== undefined && { fromSet }),
  ...(toSet !== undefined && { toSet })
});

/**
 * A group node as a set: its cells, all the cells of one box and one row
 * or column that hold the digit; its unit that row or column
 */
export function groupSet(cells: number[], digit: number): ChainSet {
  const sorted = [...cells].sort((a, b) => a - b);
  const unit = sorted.every((c) => rowOf(c) === rowOf(sorted[0])) ? rowOf(sorted[0]) : 9 + colOf(sorted[0]);
  return { kind: 'group', cells: sorted, digits: [digit], members: sorted.map((cell) => ({ cell, digit })), unit };
}

/**
 * Links for a chain given as a node sequence with strict alternation,
 * starting strong (the AIC normal form every chain finder uses). `closure`
 * appends the loop-closing link back to the first node. `sets` gives each
 * node's set (an index into Step.sets), where it is a set's node.
 */
export function alternatingLinks(
  nodes: CellDigit[][],
  closure?: 'strong' | 'weak',
  sets?: (number | undefined)[]
): ChainLink[] {
  const links: ChainLink[] = [];
  for (let i = 1; i < nodes.length; i++) {
    links.push({ from: nodes[i - 1], to: nodes[i], strong: (i - 1) % 2 === 0, ...setEnds(sets?.[i - 1], sets?.[i]) });
  }
  if (closure) {
    links.push({
      from: nodes[nodes.length - 1],
      to: nodes[0],
      strong: closure === 'strong',
      ...setEnds(sets?.[nodes.length - 1], sets?.[0])
    });
  }
  return links;
}

/**
 * A whole row, column or box shaded as a band: a fish's base and cover
 * lines, the house a locked set lives in, the house a single was found in.
 * Primary and secondary follow the step's colour grammar and its labels;
 * 'fin' is the box a finned fish's fins lie in, which every removal shares
 * (outlined dotted in the fin's colour, named by `labels.finBox`, and drawn
 * in a walk from the frame that shows 'finBox'). A line's band `within` a
 * box shades only the three cells where they meet: an Exocet's base
 * mini-line (phase 6)
 */
export interface UnitBand {
  /** index into UNITS: rows 0-8, columns 9-17, boxes 18-26 */
  unit: number;
  role: 'primary' | 'secondary' | 'fin';
  /** a box (a UNITS index, 18-26) the line's band is cut to: the mini-line where they meet */
  within?: number;
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
  labels?: { primary?: string; secondary?: string; fins?: string; finBox?: string };
  /**
   * A pattern's walk in its finder's own sentences (the readability report's
   * H1, phase 6): each frame's sentence, naming the cells and houses and
   * giving the argument, and the roles it draws from then on (a role's
   * bands with it); then the conclusion frame, opening with `lead` when
   * given (a uniqueness pattern's why). A frame that names `cells` draws
   * its roles, and their bands, only in the cells the walk has named so
   * far, so a pattern can be walked cell by cell in the colours of its
   * function (a wing's pivot, then each pincer); the conclusion frame draws
   * every cell. A frame that names `digits` draws its roles in those
   * digits only, that frame alone, so a pattern can take one digit a frame
   * (an Exocet's base digits); its bands stay, and with no digits named
   * they are all it draws (an Exocet's frame for a digit its walk keeps out
   * of the base that the step leaves). A finned fish shows its fins'
   * box ('finBox', its band of role 'fin') in a frame of its own, after its
   * cover lines. A frame that draws only part of a role (a wing's pivot
   * before its pincers) names it in `labels` as it draws it, in place of the
   * step's own labels in that frame's legend, which names only what the
   * frame draws (G23). A step without it walks its labels back, one frame a
   * role (src/engine/hintFrames.ts walkFrames)
   */
  walk?: {
    frames: {
      text: string;
      show: ('primary' | 'secondary' | 'fins' | 'finBox')[];
      cells?: number[];
      digits?: number[];
      labels?: { primary?: string; secondary?: string; fins?: string };
    }[];
    lead?: string;
  };
  /**
   * candidates the Copy step line names after the pattern though no view
   * draws them, as the line always named them (src/content/eureka.ts):
   * Chute Remote Pair's pair digit in the third box's mini-line, which the
   * readability pass stopped drawing
   */
  copyOnly?: CellDigit[];
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
  /**
   * the groups and almost locked sets the step's links pass through, or its
   * pattern is made of (docs/hint-drawing-sets.md, Data); each link end
   * names its own in `fromSet` and `toSet`
   */
  sets?: ChainSet[];
  description: string;
}
