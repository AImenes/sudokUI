/**
 * The walk: a hint's drawing revealed one idea at a time, with a sentence
 * for each. For a chain the ideas are its links, in order, then the
 * conclusion; an almost locked set of several cells a derived chain passes
 * through is introduced in a frame of its own before the first link that
 * reaches it (docs/hint-drawing-sets.md, decision 17). For a pattern they
 * are its colours, in the order the explanation introduces them (the
 * legend labels supply the words), then the conclusion. For a colouring
 * (docs/hint-drawing-colouring.md) they are each cluster with its ties,
 * then each link of the argument, then, where a colour is proven, the
 * proof, then the conclusion. For a Death Blossom they are its stem, then
 * each petal's branch, a petal of several cells introduced first, then the
 * conclusion. A step whose walk has a single frame has nothing to walk
 * through, and the panel offers no walk for it.
 */
import { UNITS, cellName, cellNames, sees } from './board';
import { CellDigit, ChainLink, ChainSet, Step, insideSet, isParity, isTie } from './steps';
import { aDigit, listAnd, tr, unitName } from './text';
import { alsClash, clashAt, deriveTruth, isAlsChain, refutation } from './truth';

/**
 * A part of the drawing a frame shows: every band at once ('units'), a
 * pattern's roles, each with its bands in a walk frame; a finned fish's
 * fins' box, its band of role 'fin' ('finBox'); a colouring's clusters in
 * their shades, and its proof (the colour proven false as false rings, its
 * partner as true discs); a Death Blossom's stem, its candidates before any
 * branch is drawn; the conclusion.
 */
export type Part = 'units' | 'primary' | 'secondary' | 'fins' | 'finBox' | 'cluster0' | 'cluster1' | 'proof' | 'stem' | 'conclusion';

export interface Frame {
  /** the sentence for this frame */
  text: string;
  /**
   * how many links the walk has reached, from the first: a line wears the
   * number of the frame that reaches it, and a loop is closed once its last
   * link is reached
   */
  links: number;
  /**
   * the links this frame draws, where that is not every link reached (a
   * colouring: a cluster's ties only in its own frame); absent, every link
   * reached is drawn
   */
  drawn?: number[];
  /**
   * the almost locked sets this frame introduces, as indices into
   * Step.sets: a set of several cells has a frame of its own before the
   * first link that reaches it, which draws the set and adds no link
   */
  sets?: number[];
  /** which parts of the drawing are shown */
  show: Set<Part>;
  /**
   * the cells a pattern's walk frame draws its roles and their bands in,
   * where its finder walks it cell by cell (Step.walk); absent, every cell
   */
  cells?: Set<number>;
  /**
   * the digits a pattern's walk frame draws its roles in, where its finder
   * walks it a digit a frame (Step.walk); absent, every digit
   */
  digits?: Set<number>;
  /**
   * what the legend calls a role in this frame, where it draws only part
   * of it (Step.walk's frame labels): in place of the step's own labels
   */
  labels?: Step['labels'];
}

/**
 * What a view's legend calls each role: the step's labels, or in a walk
 * frame that names its roles as it draws them, the frame's in their place
 * (G23: a frame's legend names only what the frame draws)
 */
export function labelsAt(step: Step, frame: Frame | null): Step['labels'] {
  return frame?.labels ? { ...step.labels, ...frame.labels } : step.labels;
}

/**
 * The links a frame draws, or the full view when there is no frame: every
 * link reached, or the frame's own list. A colouring's full view draws its
 * argument (its weak ties: the reason, 1-3 lines) and none of its ties,
 * which are drawn only in their cluster's frame. Every board, legend and
 * mark goes through this, so a line is drawn where the frame says.
 */
export function drawnLinks(step: Step, frame: Frame | null): Set<number> {
  const links = step.links ?? [];
  if (frame) return new Set(frame.drawn ?? links.map((_, i) => i).slice(0, frame.links));
  if (isParity(step)) return new Set(links.flatMap((l, i) => (isTie(l) ? [] : [i])));
  return new Set(links.map((_, i) => i));
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];

/** the cells of a node, named; one cell plainly, several as a list */
function nodeCells(node: CellDigit[]): string {
  return cellNames(uniq(node.map((cd) => cd.cell)));
}

function nodeDigits(node: CellDigit[]): string {
  return uniq(node.map((cd) => cd.digit))
    .sort((a, b) => a - b)
    .join('/');
}

/**
 * The almost locked set a link end is a node of, along a derived chain,
 * whose words then say what the set does at that point (docs/hint-drawing-sets.md,
 * "The walk and its words"); none for a lone candidate or a group, whose
 * sentences are the chain's own, and none in a step whose truth is not
 * derived (a Death Blossom's links claim no truth, and its walk is its own)
 */
function alsAt(step: Step, index: number | undefined): ChainSet | undefined {
  if (step.truth !== 'derived' || index === undefined) return undefined;
  const set = step.sets?.[index];
  return set?.kind === 'als' ? set : undefined;
}

/** the ALS-XY-Wing's hinge, its set C, which its sentences name so (decision 16) */
const isHinge = (step: Step, set: ChainSet) => step.tech === 'ALS_XY_WING' && set.letter === 'C';

/**
 * A set frame's sentence: what an almost locked set of several cells is,
 * before the chain uses it, in the house the finder found it in
 */
function setText(step: Step, set: ChainSet): string {
  const L = set.letter;
  const n = set.cells.length;
  const cells = cellNames(set.cells);
  const house = unitName(set.unit);
  const digits = listAnd(set.digits);
  return isHinge(step, set)
    ? tr`Set ${L}, the hinge: the ${n} cells ${cells} of ${house} hold only ${digits}: one digit more than cells. Without any one of these digits, the others fill the cells.`
    : tr`Set ${L}: the ${n} cells ${cells} of ${house} hold only ${digits}: one digit more than cells. Without any one of these digits, the others fill the cells.`;
}

/**
 * Whether the walk has told a set before this link reaches it: a one-cell
 * set is told by its lock, its link inside it
 */
function introducedBefore(step: Step, link: ChainLink, k: number): boolean {
  const links = step.links ?? [];
  const at = links.indexOf(link);
  return at > 0 && links.slice(0, at).some((l) => insideSet(l) && l.fromSet === k);
}

/**
 * A link's sentence where an end is a node of an almost locked set, from
 * the step's sets (decision 17): the set's lock, a one-cell set's folded
 * into it; a restricted common between two sets; a link into a set or out
 * of it, from or to a candidate or a group, each naming the drawn
 * candidates, and from or to another digit of the set's only cell holding
 * its digit, a candidate's or another set's. Null where neither end is a
 * set's node, and for a link checkSets refuses (a weak link inside a set,
 * a strong one out of it), whose plain sentence then stands.
 */
function setLinkText(link: ChainLink, step: Step): string | null {
  const from = alsAt(step, link.fromSet);
  const to = alsAt(step, link.toSet);
  if (!from && !to) return null;
  const fd = link.from[0].digit;
  const td = link.to[0].digit;
  const fromCells = uniq(link.from.map((cd) => cd.cell));
  const toCells = uniq(link.to.map((cd) => cd.cell));
  if (insideSet(link)) {
    if (!link.strong || fd === td) return null;
    const L = from!.letter;
    const n = from!.cells.length;
    // a set of one cell is introduced by its lock: it holds just its two digits
    if (n === 1) {
      const cell = cellName(from!.cells[0]);
      const [a, b] = from!.digits;
      return isHinge(step, from!)
        ? tr`Set ${L}, the hinge, is the cell ${cell}, which holds only ${a} and ${b}: if it is not ${fd}, it must be ${td}.`
        : tr`Set ${L} is the cell ${cell}, which holds only ${a} and ${b}: if it is not ${fd}, it must be ${td}.`;
    }
    const exit = cellNames(toCells);
    return toCells.length === 1
      ? tr`If set ${L} holds no ${fd}, its other ${n} digits fill its ${n} cells, so ${exit} must be ${td}.`
      : tr`If set ${L} holds no ${fd}, its other ${n} digits fill its ${n} cells, so one of ${exit} must be ${td}.`;
  }
  if (link.strong) return null;
  if (fd !== td) {
    // two digits of one cell, each end a set's only cell holding its digit or a candidate
    const oneCell = fromCells.length === 1 && toCells.length === 1 && fromCells[0] === toCells[0];
    if (!oneCell) return null;
    const cell = cellName(fromCells[0]);
    if (from && to) return tr`If set ${from.letter} holds ${aDigit(fd)}, set ${to.letter} holds no ${td}: the only ${fd} of ${from.letter} and the only ${td} of ${to.letter} are both in ${cell}.`;
    return from
      ? tr`If set ${from.letter} holds ${aDigit(fd)}, ${cell} cannot be ${td}: the only ${fd} of ${from.letter} is in ${cell}.`
      : tr`If ${cell} is ${fd}, set ${to!.letter} holds no ${td}: the only ${td} of ${to!.letter} is in ${cell}.`;
  }
  const x = fd;
  const one = (cells: number[]) => cells.length === 1;
  // the house every candidate of the link lies in, where one does (ChainLink.unit)
  const house = link.unit === undefined ? null : unitName(link.unit);
  if (from && to) {
    // a restricted common: every x of one set sees every x of the other
    const [L, M] = [from.letter, to.letter];
    const [f, t] = [cellNames(fromCells), cellNames(toCells)];
    // a one-cell set is introduced by its lock, the frame after this one:
    // until then it is named with its cell (review report L11)
    if (to.cells.length === 1 && !introducedBefore(step, link, link.toSet!)) {
      const hinge = isHinge(step, to);
      if (house) {
        if (one(fromCells)) {
          return hinge
            ? tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}, the hinge ${t}: if ${f} is ${x}, ${t} cannot be ${x}.`
            : tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}, the cell ${t}: if ${f} is ${x}, ${t} cannot be ${x}.`;
        }
        return hinge
          ? tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}, the hinge ${t}: if one of ${f} is ${x}, ${t} cannot be ${x}.`
          : tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}, the cell ${t}: if one of ${f} is ${x}, ${t} cannot be ${x}.`;
      }
      if (one(fromCells)) {
        return hinge
          ? tr`Every ${x} of set ${L} sees every ${x} of set ${M}, the hinge ${t}: if ${f} is ${x}, ${t} cannot be ${x}.`
          : tr`Every ${x} of set ${L} sees every ${x} of set ${M}, the cell ${t}: if ${f} is ${x}, ${t} cannot be ${x}.`;
      }
      return hinge
        ? tr`Every ${x} of set ${L} sees every ${x} of set ${M}, the hinge ${t}: if one of ${f} is ${x}, ${t} cannot be ${x}.`
        : tr`Every ${x} of set ${L} sees every ${x} of set ${M}, the cell ${t}: if one of ${f} is ${x}, ${t} cannot be ${x}.`;
    }
    if (house) {
      if (one(fromCells) && one(toCells)) return tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}: if ${f} is ${x}, ${t} cannot be ${x}.`;
      if (one(toCells)) return tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}: if one of ${f} is ${x}, ${t} cannot be ${x}.`;
      if (one(fromCells)) return tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}: if ${f} is ${x}, none of ${t} can be ${x}.`;
      return tr`In ${house}, every ${x} of set ${L} sees every ${x} of set ${M}: if one of ${f} is ${x}, none of ${t} can be ${x}.`;
    }
    if (one(fromCells) && one(toCells)) return tr`Every ${x} of set ${L} sees every ${x} of set ${M}: if ${f} is ${x}, ${t} cannot be ${x}.`;
    if (one(toCells)) return tr`Every ${x} of set ${L} sees every ${x} of set ${M}: if one of ${f} is ${x}, ${t} cannot be ${x}.`;
    if (one(fromCells)) return tr`Every ${x} of set ${L} sees every ${x} of set ${M}: if ${f} is ${x}, none of ${t} can be ${x}.`;
    return tr`Every ${x} of set ${L} sees every ${x} of set ${M}: if one of ${f} is ${x}, none of ${t} can be ${x}.`;
  }
  if (from) {
    const L = from.letter;
    const cells = cellNames(toCells);
    if (house) {
      return one(toCells)
        ? tr`If set ${L} holds ${aDigit(x)}, ${cells} cannot be ${x}: it sees every ${x} of ${L} in ${house}.`
        : tr`If set ${L} holds ${aDigit(x)}, none of ${cells} can be ${x}: they see every ${x} of ${L} in ${house}.`;
    }
    return one(toCells)
      ? tr`If set ${L} holds ${aDigit(x)}, ${cells} cannot be ${x}: it sees every ${x} of ${L}.`
      : tr`If set ${L} holds ${aDigit(x)}, none of ${cells} can be ${x}: they see every ${x} of ${L}.`;
  }
  const L = to!.letter;
  const cells = cellNames(fromCells);
  if (house) {
    return one(fromCells)
      ? tr`If ${cells} is ${x}, set ${L} holds no ${x}: every ${x} of ${L} sees ${cells} in ${house}.`
      : tr`If one of ${cells} is ${x}, set ${L} holds no ${x}: every ${x} of ${L} sees all of them in ${house}.`;
  }
  return one(fromCells)
    ? tr`If ${cells} is ${x}, set ${L} holds no ${x}: every ${x} of ${L} sees ${cells}.`
    : tr`If one of ${cells} is ${x}, set ${L} holds no ${x}: every ${x} of ${L} sees all of them.`;
}

/**
 * A link on one digit between cells, in the words of the house that makes
 * it (ChainLink.unit; docs/hint-readability-2026-11.md M17): a strong
 * link's cells are the house's only places for the digit, a weak link's all
 * see each other there; then what the link argues, a group "one of" its
 * cells when true, "none of" them when false
 */
function houseLinkText(link: ChainLink, d: number, fromCells: number[], toCells: number[]): string {
  const house = unitName(link.unit!);
  const all = listAnd([...fromCells, ...toCells].map(cellName));
  const [f, t] = [cellNames(fromCells), cellNames(toCells)];
  const [fromGroup, toGroup] = [fromCells.length > 1, toCells.length > 1];
  if (link.strong) {
    if (fromGroup && toGroup) return tr`Strong link on ${d} in ${house}: ${all} are its only ${d}s, so if none of ${f} is ${d}, one of ${t} is.`;
    if (fromGroup) return tr`Strong link on ${d} in ${house}: ${all} are its only ${d}s, so if none of ${f} is ${d}, ${t} is.`;
    if (toGroup) return tr`Strong link on ${d} in ${house}: ${all} are its only ${d}s, so if ${f} is not ${d}, one of ${t} is.`;
    return tr`Strong link on ${d} in ${house}: ${all} are its only ${d}s, so if ${f} is not ${d}, ${t} is.`;
  }
  if (fromGroup && toGroup) return tr`Weak link on ${d} in ${house}: ${all} all see each other, so if one of ${f} is ${d}, none of ${t} is.`;
  if (fromGroup) return tr`Weak link on ${d} in ${house}: ${all} all see each other, so if one of ${f} is ${d}, ${t} is not.`;
  if (toGroup) return tr`Weak link on ${d} in ${house}: ${all} all see each other, so if ${f} is ${d}, none of ${t} is.`;
  return tr`Weak link on ${d} in ${house}: ${all} see each other, so if ${f} is ${d}, ${t} is not.`;
}

/**
 * One link, read as an inference: what the chain argues at that point. A
 * link with an end in an almost locked set of a derived chain is told from
 * the step's sets, never by the plain sentences below, which would read
 * the set's cells as a group, or two of its digits as a link between
 * single candidates.
 */
export function linkText(link: ChainLink, step: Step): string {
  if (link.text) return link.text;
  const set = setLinkText(link, step);
  if (set) return set;
  const fromCells = uniq(link.from.map((cd) => cd.cell));
  const toCells = uniq(link.to.map((cd) => cd.cell));
  const fd = nodeDigits(link.from);
  const td = nodeDigits(link.to);
  const sameCell = fromCells.length === 1 && toCells.length === 1 && fromCells[0] === toCells[0];
  if (sameCell) {
    const cell = cellName(fromCells[0]);
    return link.strong
      ? tr`In ${cell}: if it is not ${fd}, it must be ${td} (the cell has only these two).`
      : tr`In ${cell}: if it is ${fd}, it cannot be ${td}.`;
  }
  const from = nodeCells(link.from);
  const to = nodeCells(link.to);
  if (fd === td) {
    // the house that makes the link, where the step names it: every step a
    // finder gives does (src/engine/steps.ts withHouses)
    if (link.unit !== undefined) return houseLinkText(link, link.from[0].digit, fromCells, toCells);
    // a group of cells holds the digit in at most one of them (they share
    // a house): "one of" them is true, or "none of" them
    const fromGroup = fromCells.length > 1;
    const toGroup = toCells.length > 1;
    if (link.strong) {
      if (fromGroup && toGroup) return tr`Strong link on ${fd}: if none of ${from} is ${fd}, one of ${to} must be ${fd} (nowhere else for it).`;
      if (fromGroup) return tr`Strong link on ${fd}: if none of ${from} is ${fd}, ${to} must be ${fd} (nowhere else for it).`;
      if (toGroup) return tr`Strong link on ${fd}: if ${from} is not ${fd}, one of ${to} must be ${fd} (nowhere else for it).`;
      return tr`Strong link on ${fd}: if ${from} is not ${fd}, ${to} must be ${fd} (nowhere else for it).`;
    }
    if (fromGroup && toGroup) return tr`Weak link on ${fd}: if one of ${from} is ${fd}, none of ${to} can be ${fd} (they see each other).`;
    if (fromGroup) return tr`Weak link on ${fd}: if one of ${from} is ${fd}, ${to} cannot be ${fd} (they see each other).`;
    if (toGroup) return tr`Weak link on ${fd}: if ${from} is ${fd}, none of ${to} can be ${fd} (they see each other).`;
    return tr`Weak link on ${fd}: if ${from} is ${fd}, ${to} cannot be ${fd} (they see each other).`;
  }
  return link.strong
    ? tr`Strong link: if ${from} is not ${fd}, ${to} must be ${td}.`
    : tr`Weak link: if ${from} is ${fd}, ${to} cannot be ${td}.`;
}

/**
 * A step's removals as the conclusion says them: by cell, the cells that
 * lose the same digits together ("5 and 8 are removed from r4c8"), each
 * group where its first cell comes in reading order, its cells in reading
 * order (a finder lists them as it found them, a colouring as its cluster
 * grew)
 */
function removalGroups(step: Step): { digits: number[]; cells: number[] }[] {
  const lost = new Map<number, number[]>();
  for (const { cell, digit } of step.eliminations) (lost.get(cell) ?? lost.set(cell, []).get(cell)!).push(digit);
  const groups = new Map<string, { digits: number[]; cells: number[] }>();
  for (const cell of [...lost.keys()].sort((a, b) => a - b)) {
    const digits = uniq(lost.get(cell)!).sort((a, b) => a - b);
    const key = digits.join();
    (groups.get(key) ?? groups.set(key, { digits, cells: [] }).get(key)!).cells.push(cell);
  }
  return [...groups.values()];
}

/**
 * What the step concludes, in words: the placements, then the removals,
 * both in reading order, a cell that loses several digits named once. The
 * walk's last frame opens it with "So"; the explanation the full view shows
 * (describe) with "Here", as the finder's sentence before it often ends "so
 * 6 is removed from cells seeing both". The first clause carries the
 * opening word, so each language can open the sentence its own way.
 */
export function conclusionText(step: Step, opening: 'so' | 'here' = 'so'): string {
  const so = opening === 'so';
  const parts: string[] = [];
  for (const { cell, digit } of [...step.placements].sort((a, b) => a.cell - b.cell)) {
    const c = cellName(cell);
    parts.push(parts.length ? tr`${c} must be ${digit}` : so ? tr`So ${c} must be ${digit}` : tr`Here, ${c} must be ${digit}`);
  }
  for (const { digits, cells } of removalGroups(step)) {
    const names = cellNames(cells);
    if (digits.length === 1) {
      const d = digits[0];
      parts.push(parts.length ? tr`${d} is removed from ${names}` : so ? tr`So ${d} is removed from ${names}` : tr`Here, ${d} is removed from ${names}`);
    } else {
      const ds = listAnd(digits);
      parts.push(parts.length ? tr`${ds} are removed from ${names}` : so ? tr`So ${ds} are removed from ${names}` : tr`Here, ${ds} are removed from ${names}`);
    }
  }
  return parts.length ? `${parts.join('; ')}.` : '';
}

/**
 * Whether a finder's sentence names a candidate the step places or
 * removes: one of its clauses (between full stops, colons and semicolons)
 * names the cell, and the digit as a number of its own, not a house's
 * ("row 4", in the language set), not a node of a chain's notation
 * ("8@r1c6"), not one of the digits a cell or a pattern holds ("4/7/9"),
 * not part of a cell's name. Naming the cell alone is not enough: Aligned
 * Pair Exclusion names its pair cells, and Digit Forcing its premise cell,
 * without saying what leaves them.
 */
export function namesCandidate(text: string, { cell, digit }: CellDigit): boolean {
  let plain = text;
  for (let u = 0; u < 27; u++) plain = plain.split(unitName(u)).join(' ');
  const name = cellName(cell);
  const number = new RegExp(`(?<![\\w./])${digit}(?![\\d@/])`);
  return plain.split(/[.;:](?=\s|$)/).some((clause) => clause.includes(name) && number.test(clause.split(name).join(' ')));
}

/** the most removals a 3D Medusa's proof lists (countsRemovals) */
const LISTED = 4;

/**
 * Whether a 3D Medusa that proves dark purple false (rules 1, 2 and 6,
 * which remove the whole colour) removes more candidates than its words
 * list (the readability report's L3): along the practice solve paths rule 1
 * removes a median of 17 (up to 36) and rule 2 of 10, in many digits. Its
 * sentence already says every dark purple candidate goes; the explanation
 * and the walk's conclusion then count them, the board bars each one, and
 * Copy step lists them.
 */
export function countsRemovals(step: Step): boolean {
  const rule = step.colouring?.rule;
  return isParity(step) && (rule === 'medusa1' || rule === 'medusa2' || rule === 'medusa6') && step.eliminations.length > LISTED;
}

/**
 * The explanation as shown: the finder's sentence, followed by the
 * conclusion ("Here, 6 is removed from r4c4.") unless the sentence already
 * names every candidate it places or removes, each by its cell and its
 * digit (namesCandidate). A colouring's sentence argues for one removal,
 * or for a colour, and counts or sums up the rest, so a cell it names may
 * lose a candidate it does not name: its conclusion follows whenever it
 * removes more than one candidate.
 */
export function describe(step: Step): string {
  if (countsRemovals(step)) return `${step.description} ${tr`Here, ${step.eliminations.length} candidates are removed.`}`;
  const all = [...step.placements, ...step.eliminations];
  const counted = isParity(step) && step.eliminations.length > 1;
  const named = !counted && all.every((cd) => namesCandidate(step.description, cd));
  if (named || !all.length) return step.description;
  return `${step.description} ${conclusionText(step, 'here')}`;
}

/**
 * What the link that closes a discontinuous loop shows: the chain came
 * back to its start the other way, so the assumption it began with is
 * impossible (docs/hint-drawing.md G18); empty for any other chain
 */
export function closureText(step: Step): string {
  const d = deriveTruth(step);
  // an ALS pattern's chain that comes back to its first set proves no more than the pattern (decision 13)
  if (!d?.closure || d.problems.length || alsClash(step)) return '';
  const node = d.closure.node;
  const cells = nodeCells(node);
  const digit = nodeDigits(node);
  if (uniq(node.map((cd) => cd.cell)).length > 1) {
    return d.closure.assumed
      ? tr`So assuming one of ${cells} is ${digit} rules them all out: that is impossible, so none of them is ${digit}.`
      : tr`So assuming none of ${cells} is ${digit} makes one of them ${digit}: that is impossible, so one of them is ${digit}.`;
  }
  return d.closure.assumed
    ? tr`So assuming ${cells} is ${digit} rules it out: that is impossible, so ${cells} is not ${digit}.`
    : tr`So assuming ${cells} is not ${digit} makes it ${digit}: that is impossible, so ${cells} is ${digit}.`;
}

const nodeKey = (node: CellDigit[]) =>
  node
    .map((cd) => `${cd.cell}:${cd.digit}`)
    .sort()
    .join('+');
/** a weak link between two digits of one cell, drawn as no arrow (G12) */
const inOneCell = (l: ChainLink) => l.from.length === 1 && l.to.length === 1 && l.from[0].cell === l.to[0].cell;

/**
 * Whether a chain is a continuous loop: it derives cleanly and its last
 * link comes back to its first node with the truth it began with (Nice
 * Loop, X-Cycles and their grouped forms, rule 1; the chain trainer's
 * closed loop)
 */
export function isContinuousLoop(step: Step): boolean {
  const d = deriveTruth(step);
  if (!d || d.problems.length || d.closure || isAlsChain(step)) return false;
  const links = step.links!.filter((l) => !l.undirected);
  return links.length > 2 && nodeKey(links[links.length - 1].to) === nodeKey(links[0].from);
}

/**
 * What the link that closes a continuous loop shows (docs/hint-drawing.md
 * G18; docs/hint-readability-2026-11.md H4): the chain is back at its
 * start with the truth it began with, so it holds read either way round,
 * and each weak link has exactly one true end, which is what every removal
 * rests on. The dashed arrows are the weak links between cells; a weak link
 * inside one cell draws none (G12). Empty for any other chain
 */
export function loopText(step: Step): string {
  if (!isContinuousLoop(step)) return '';
  const links = step.links!.filter((l) => !l.undirected);
  const start = nodeCells(links[0].from);
  const digits = uniq(links.flatMap((l) => [...l.from, ...l.to].map((cd) => cd.digit)));
  if (digits.length === 1) {
    return tr`The chain is back at ${start}, as it began: the loop holds whichever way round it is read, so each dashed link has exactly one end that is ${digits[0]}.`;
  }
  return links.some((l) => !l.strong && inOneCell(l))
    ? tr`The chain is back at ${start}, as it began: the loop holds whichever way round it is read, so each weak link, dashed or inside a cell, has exactly one end that is true.`
    : tr`The chain is back at ${start}, as it began: the loop holds whichever way round it is read, so each dashed link has exactly one end that is true.`;
}

/** the one digit a colouring's clusters are all of (Simple and Multi Colors), or null (3D Medusa, Remote Pair) */
export function colouringDigit(step: Step): number | null {
  const digits = new Set((step.colouring?.clusters ?? []).flatMap((cl) => [...cl.dark, ...cl.light].map((cd) => cd.digit)));
  return digits.size === 1 ? [...digits][0] : null;
}

/**
 * What the proof frame says: the colour proven false (dark, by the rule
 * that makes the argument try it first) and its partner true, which once
 * the false colour is removed is a single each (every true candidate is
 * tied to a removed one, in its cell or its house)
 */
function proofText(step: Step): string {
  const d = colouringDigit(step);
  if (step.colouring?.darkFalse === 1) {
    return d
      ? tr`So dark orange is false and light orange is true: once dark orange is removed, every light orange ${d} is a single.`
      : tr`So dark orange is false and light orange is true: once dark orange is removed, every light orange candidate is a single.`;
  }
  return d
    ? tr`So dark purple is false and light purple is true: once dark purple is removed, every light purple ${d} is a single.`
    : tr`So dark purple is false and light purple is true: once dark purple is removed, every light purple candidate is a single.`;
}

/** what the conclusion adds where a colour is proven: its partner's candidates are true, though the step only removes */
function provenText(step: Step): string {
  const d = colouringDigit(step);
  if (step.colouring?.darkFalse === 1) {
    return d
      ? tr`Every light orange ${d} is true; this step only removes, and each is then a single.`
      : tr`Every light orange candidate is true; this step only removes, and each is then a single.`;
  }
  return d
    ? tr`Every light purple ${d} is true; this step only removes, and each is then a single.`
    : tr`Every light purple candidate is true; this step only removes, and each is then a single.`;
}

/**
 * A colouring's walk (docs/hint-drawing-colouring.md): one frame per
 * cluster, its shades and its ties, the ties drawn in that frame only, its
 * sentence from its first tie; one frame per link of the argument, each
 * weak tie drawn from its frame on; where a colour is proven, the proof
 * frame, that colour as false rings and its partner as true discs; and the
 * conclusion, which is the full view
 */
function parityFrames(step: Step): Frame[] {
  const links = step.links ?? [];
  const { clusters, darkFalse } = step.colouring!;
  // a tie's cluster: the one its first end is coloured in
  const clusterOf = (l: ChainLink) =>
    clusters.findIndex((cl) => [...cl.dark, ...cl.light].some((cd) => cd.cell === l.from[0]?.cell && cd.digit === l.from[0]?.digit));
  const frames: Frame[] = [];
  const shown = new Set<Part>(['units']);
  let reached = 0;
  clusters.forEach((_, k) => {
    shown.add(k === 0 ? 'cluster0' : 'cluster1');
    const ties = links.flatMap((l, i) => (isTie(l) && clusterOf(l) === k ? [i] : []));
    reached = Math.max(reached, ...ties.map((i) => i + 1));
    const text =
      ties.map((i) => links[i].text).find((x) => !!x) ??
      tr`The cluster: each line joins two candidates of which exactly one is true (a conjugate pair, or the two candidates of a bivalue cell), so the two ends take opposite colours, and the colours spread along the lines.`;
    frames.push({ text, links: reached, drawn: ties, show: new Set(shown) });
  });
  const argument: number[] = [];
  links.forEach((l, i) => {
    if (isTie(l)) return;
    argument.push(i);
    frames.push({ text: linkText(l, step), links: i + 1, drawn: [...argument], show: new Set(shown) });
  });
  if (darkFalse !== undefined) {
    shown.add('proof');
    frames.push({ text: proofText(step), links: links.length, drawn: [...argument], show: new Set(shown) });
  }
  shown.add('conclusion');
  const conclusion = countsRemovals(step) ? tr`So all ${step.eliminations.length} dark purple candidates are removed.` : conclusionText(step);
  frames.push({
    text: darkFalse !== undefined ? `${conclusion} ${provenText(step)}` : conclusion,
    links: links.length,
    drawn: [...argument],
    show: new Set(shown)
  });
  return frames;
}

/**
 * What an open chain's conclusion says before its removals
 * (docs/hint-readability-2026-11.md M2): both its ends, one of which is
 * true, since the chain makes its last node true wherever its first (by
 * the start dot) is false; then why each removal goes. A removal that sees
 * both ends, of their one digit; a removal in one end's cell, which sees
 * the other: either way that cell is not its digit; two ends in one cell,
 * which then holds one of their digits and nothing else. Worded for a
 * chain that opens on one candidate (every finder's), else in general.
 * Empty for a chain that is no open one from a strong link to a strong
 * link: a loop, an ALS pattern (endsText), a pattern, a colouring, a chain
 * the trainer has not finished
 */
function chainEndsText(step: Step): string {
  if (step.truth !== 'derived' || isAlsChain(step) || isContinuousLoop(step)) return '';
  const d = deriveTruth(step);
  if (!d || d.problems.length || d.closure) return '';
  const links = step.links!.filter((l) => !l.undirected);
  const [first, last] = [links[0], links[links.length - 1]];
  if (!first.strong || !last.strong) return '';
  const [S, E] = [first.from, last.to];
  const set = alsAt(step, last.toSet);
  const lone = S.length === 1 && !alsAt(step, first.fromSet);
  const [dS, dE] = [S[0].digit, E[0].digit];
  const sameDigit = S.every((cd) => cd.digit === dS) && E.every((cd) => cd.digit === dS);
  const s = lone ? cellName(S[0].cell) : '';
  const e = nodeCells(E);
  // both ends, one of which is true
  const either = !lone
    ? tr`One end of the chain is true: if the first (by the small dot) is false, the chain makes the last true.`
    : set
      ? tr`Either ${s} (by the small dot) is ${dS}, or the chain puts ${aDigit(dE)} in set ${set.letter}.`
      : E.length > 1
        ? tr`Either ${s} (by the small dot) is ${dS}, or the chain puts ${dE} in one of ${e}.`
        : sameDigit
          ? tr`Either ${s} (by the small dot) is ${dS}, or the chain makes ${e} ${dE}: one of them is ${dS}.`
          : tr`Either ${s} (by the small dot) is ${dS}, or the chain makes ${e} ${dE}.`;
  const removals = step.eliminations;
  if (!removals.length || step.placements.length) return either;
  // why each removal goes: a removal seeing every candidate of an end, of its digit, or in the cell of an end of one candidate
  const seesAll = (r: CellDigit, node: CellDigit[]) => node.every((cd) => cd.digit === r.digit && cd.cell !== r.cell && sees(cd.cell, r.cell));
  const inCell = (r: CellDigit, node: CellDigit[]) => node.length === 1 && node[0].cell === r.cell && node[0].digit !== r.digit;
  let why = tr`Each removed candidate, if it were true, would make both ends false.`;
  if (sameDigit && removals.every((r) => seesAll(r, S) && seesAll(r, E))) {
    why = S.length === 1 && E.length === 1 && !set ? tr`Each removed ${dS} sees both.` : tr`Each removed ${dS} sees every ${dS} of both.`;
  } else if (!sameDigit && lone) {
    const inE = removals.filter((r) => inCell(r, E) && seesAll(r, S));
    const inS = removals.filter((r) => inCell(r, S) && seesAll(r, E));
    const both = removals.every((r) => inCell(r, S) && inCell(r, E));
    if (both) why = tr`Either way ${s} is ${dS} or ${dE}, and nothing else.`;
    else if (inE.length + inS.length === removals.length) {
      const [x, y] = [inE[0], inS[0]];
      if (x && y) why = tr`Either way ${cellName(x.cell)} is not ${x.digit}, and ${cellName(y.cell)} is not ${y.digit}.`;
      else why = tr`Either way ${cellName((x ?? y).cell)} is not ${(x ?? y).digit}.`;
    }
  }
  return `${either} ${why}`;
}

/**
 * What an ALS pattern's conclusion says before its removals
 * (docs/hint-drawing-sets.md, "The walk and its words"): its two end sets,
 * one of which holds z, and why each removal goes; for a chain that clashes,
 * why its first set holds z, whatever the clash (clashText, or else
 * contradictionText), and for one that shows its premise impossible though
 * it derives cleanly, what it meets (refutedText), never the plain ending;
 * empty for any other step
 */
function endsText(step: Step): string {
  if (!isAlsChain(step)) return '';
  const links = step.links!;
  const first = step.sets?.[links[0].fromSet!];
  const last = step.sets?.[links[links.length - 1].toSet!];
  const [F, L] = [first?.letter, last?.letter];
  const z = step.eliminations[0]?.digit;
  if (!F || !L || z === undefined) return '';
  const clash = alsClash(step) ? clashText(step, first!, last!, z) || contradictionText(step, F, z) : refutedText(step, F, z);
  return clash || tr`Set ${F} or set ${L} holds ${aDigit(z)}: if ${F} holds none, ${L} holds one. Each removed ${z} sees every ${z} of both.`;
}

/** the first house (a row, then a column, then a box) that holds every one of these cells, or -1 */
const houseOf = (cells: number[]) => UNITS.findIndex((u) => cells.every((c) => u.includes(c)));

/**
 * What an ALS pattern that derives cleanly yet shows its premise impossible
 * (src/engine/truth.ts refutation; the legend's note, G18) meets on the
 * way, in the words its walk and its description share: two true
 * candidates of one digit in one house ('twice'), one cell given two digits
 * ('cell'), a true candidate and a "one of these" node of the same digit in
 * one house, in the order the chain reaches them ('byFirst', 'nodeFirst'),
 * or a node every candidate of which the chain rules out some other way
 * ('ruledOut'). Null for any other step: one whose chain clashes is worded
 * by clashText or contradictionText
 */
function refutedAt(step: Step):
  | { kind: 'twice' | 'byFirst' | 'nodeFirst'; a: string; b: string; d: number; house: string }
  | { kind: 'cell'; a: string; d: number; e: number }
  | { kind: 'ruledOut'; a: string; d: number }
  | null {
  if (!isAlsChain(step) || alsClash(step)) return null;
  const r = refutation(step);
  if (!r) return null;
  if (r.kind === 'pair') {
    const [p, q] = [r.first, r.second];
    if (p.cell === q.cell) return { kind: 'cell', a: cellName(p.cell), d: p.digit, e: q.digit };
    return { kind: 'twice', a: cellName(p.cell), b: cellName(q.cell), d: p.digit, house: unitName(houseOf([p.cell, q.cell])) };
  }
  const node = nodeCells(r.node);
  const d = r.node[0].digit;
  const [t] = r.by;
  // one true candidate rules out every candidate of the node: one digit, and (as it sees each of them) one house holds all
  const house = r.by.length === 1 && !r.out.length && t.digit === d ? houseOf([t.cell, ...r.node.map((cd) => cd.cell)]) : -1;
  if (house < 0) return { kind: 'ruledOut', a: node, d };
  const [a, b] = r.first === 'by' ? [cellName(t.cell), node] : [node, cellName(t.cell)];
  return { kind: r.first === 'by' ? 'byFirst' : 'nodeFirst', a, b, d, house: unitName(house) };
}

/**
 * Why an ALS-XY-Chain that derives cleanly yet shows its premise impossible
 * removes what it does (refutedAt): the premise that its first set holds
 * no z makes the chain meet what cannot be, so the first set holds z, and
 * each removal sees every z of it; never the plain ending through the
 * branch the legend calls impossible. Empty for any other step
 */
function refutedText(step: Step, F: string, z: number): string {
  const r = refutedAt(step);
  if (!r) return '';
  const Z = aDigit(z);
  switch (r.kind) {
    case 'twice':
      return tr`If set ${F} holds no ${z}, ${r.a} must be ${r.d}, and so must ${r.b}: two ${r.d}s in ${r.house}, which is impossible. ${F} cannot lack ${Z}, so set ${F} holds ${Z}. Each removed ${z} sees every ${z} of ${F}.`;
    case 'byFirst':
      return tr`If set ${F} holds no ${z}, ${r.a} must be ${r.d}, and so must one of ${r.b}: two ${r.d}s in ${r.house}, which is impossible. ${F} cannot lack ${Z}, so set ${F} holds ${Z}. Each removed ${z} sees every ${z} of ${F}.`;
    case 'nodeFirst':
      return tr`If set ${F} holds no ${z}, one of ${r.a} must be ${r.d}, and so must ${r.b}: two ${r.d}s in ${r.house}, which is impossible. ${F} cannot lack ${Z}, so set ${F} holds ${Z}. Each removed ${z} sees every ${z} of ${F}.`;
    case 'cell':
      return tr`If set ${F} holds no ${z}, ${r.a} must be ${r.d}, and also ${r.e}: two digits in one cell, which is impossible. ${F} cannot lack ${Z}, so set ${F} holds ${Z}. Each removed ${z} sees every ${z} of ${F}.`;
    case 'ruledOut':
      return tr`If set ${F} holds no ${z}, one of ${r.a} must be ${r.d}, yet the chain rules out every one of them, which is impossible. ${F} cannot lack ${Z}, so set ${F} holds ${Z}. Each removed ${z} sees every ${z} of ${F}.`;
  }
}

/**
 * Why an ALS-XY-Chain whose sets share cells and whose chain clashes
 * (src/engine/truth.ts alsClash; docs/hint-drawing-sets.md, decision 13)
 * removes what it does: its last set holds z only in cells of its first,
 * so the premise that the first set holds no z gives it one after all. The
 * first set cannot lack z: it holds z, and each removal sees every z of
 * it. Worded by what the derivation meets: the last set's z the first's
 * very own (a closure, the chain back at its start), several of the
 * first's z (a TRUE node left no candidate, 'emptyTrue'), or one
 * ('inFalseGroup', a true candidate in the first set's false node). Empty
 * where the last set holds z outside the first, which a few chains on offer
 * do (none the set fixture keeps): contradictionText then words their clash
 */
function clashText(step: Step, first: ChainSet, last: ChainSet, z: number): string {
  const holding = (set: ChainSet) => set.members.filter((m) => m.digit === z).map((m) => m.cell);
  const [inFirst, inLast] = [holding(first), holding(last)];
  if (!inLast.length || !inLast.every((c) => inFirst.includes(c))) return '';
  const [F, L] = [first.letter, last.letter];
  if (inLast.length === 1) {
    const cell = cellName(inLast[0]);
    return tr`Set ${L} holds ${z} only in ${cell}, a cell of set ${F}: if ${F} holds no ${z}, ${cell} must be ${z}, and ${F} holds one after all. ${F} cannot lack ${aDigit(z)}, so set ${F} holds ${aDigit(z)}. Each removed ${z} sees every ${z} of ${F}.`;
  }
  const cells = cellNames(inLast);
  return deriveTruth(step)?.closure
    ? tr`Set ${L} holds ${z} only in ${cells}, the very cells set ${F} holds it in, so the chain comes back to ${F}: if ${F} holds no ${z}, one of these cells must be ${z}, and ${F} holds one after all. ${F} cannot lack ${aDigit(z)}, so set ${F} holds ${aDigit(z)}. Each removed ${z} sees every ${z} of ${F}.`
    : tr`Set ${L} holds ${z} only in ${cells}, cells of set ${F}: if ${F} holds no ${z}, one of these cells must be ${z}, and ${F} holds one after all. ${F} cannot lack ${aDigit(z)}, so set ${F} holds ${aDigit(z)}. Each removed ${z} sees every ${z} of ${F}.`;
}

/**
 * Why an ALS-XY-Chain that clashes with its last set's z not all in its
 * first removes what it does: the premise that the first set holds no z
 * makes a node true and, further along, false (src/engine/truth.ts
 * clashAt), so the premise is impossible and the first set holds z, and
 * each removal sees every z of it (checkSets' zNotSeen). Empty for a step
 * that does not clash
 */
function contradictionText(step: Step, F: string, z: number): string {
  const node = clashAt(step);
  if (!node) return '';
  const d = node[0].digit;
  const cells = uniq(node.map((cd) => cd.cell));
  const c = cellNames(cells);
  return cells.length === 1
    ? tr`If set ${F} holds no ${z}, ${c} must be ${d}, and further along the chain it cannot be ${d}: that is impossible. ${F} cannot lack ${aDigit(z)}, so set ${F} holds ${aDigit(z)}. Each removed ${z} sees every ${z} of ${F}.`
    : tr`If set ${F} holds no ${z}, one of ${c} must be ${d}, and further along the chain none of them can be ${d}: that is impossible. ${F} cannot lack ${aDigit(z)}, so set ${F} holds ${aDigit(z)}. Each removed ${z} sees every ${z} of ${F}.`;
}

/**
 * How an ALS-XY-Chain's description ends where its chain clashes
 * (src/engine/techniques/als.ts), on the reason its walk's conclusion gives:
 * D holds z only in cells of A, so A holds one after all (clashText's
 * clashes); or, wherever else D's z lie, the node the premise makes true
 * and then false (contradictionText's); or, where the chain derives cleanly
 * yet shows its premise impossible, what it meets on the way (refutedAt).
 * Either way A cannot lack z, so no cell that sees every z of A can be z
 * (the finder removes it from those that also see every z of D, outside the
 * sets). Empty for a step that does none of these
 */
export function clashReason(step: Step): string {
  if (step.tech !== 'ALS_XY_CHAIN') return '';
  const [A, D] = ['A', 'D'].map((L) => step.sets?.find((s) => s.letter === L));
  const z = step.eliminations[0]?.digit;
  if (!A || !D || z === undefined) return '';
  if (!alsClash(step)) {
    // a chain that derives cleanly yet shows its premise impossible: what it meets on the way
    const r = refutedAt(step);
    if (!r) return '';
    const Z = aDigit(z);
    switch (r.kind) {
      case 'twice':
        return tr`But on the way ${r.a} must be ${r.d}, and so must ${r.b}: two ${r.d}s in ${r.house}. A cannot lack ${Z}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
      case 'byFirst':
        return tr`But on the way ${r.a} must be ${r.d}, and so must one of ${r.b}: two ${r.d}s in ${r.house}. A cannot lack ${Z}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
      case 'nodeFirst':
        return tr`But on the way one of ${r.a} must be ${r.d}, and so must ${r.b}: two ${r.d}s in ${r.house}. A cannot lack ${Z}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
      case 'cell':
        return tr`But on the way ${r.a} must be ${r.d}, and also ${r.e}: two digits in one cell. A cannot lack ${Z}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
      case 'ruledOut':
        return tr`But on the way one of ${r.a} must be ${r.d}, yet the chain rules out every one of them. A cannot lack ${Z}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
    }
  }
  const inD = D.members.filter((m) => m.digit === z).map((m) => m.cell);
  if (inD.length && inD.every((c) => A.cells.includes(c))) {
    return tr`But D holds ${z} only in cells of A, so A holds one after all. A cannot lack ${aDigit(z)}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
  }
  const node = clashAt(step);
  if (!node) return '';
  const d = node[0].digit;
  const cells = uniq(node.map((cd) => cd.cell));
  const c = cellNames(cells);
  return cells.length === 1
    ? tr`But on the way ${c} must be ${d}, and further along the chain it cannot be ${d}. A cannot lack ${aDigit(z)}: it holds one, so no cell that sees every ${z} of A can be ${z}.`
    : tr`But on the way one of ${c} must be ${d}, and further along the chain none of them can be ${d}. A cannot lack ${aDigit(z)}: it holds one, so no cell that sees every ${z} of A can be ${z}.`;
}

/**
 * A Death Blossom's walk (docs/hint-drawing-sets.md, decision 15): no truth
 * until phase 5 draws its branches, so each branch is told in words. The
 * stem first, its candidates shown; then for each of its digits, in order,
 * the petal's branch, the weak tie from the stem into the petal and the
 * petal's lock, a petal of several cells introduced in a frame of its own
 * before it, a one-cell petal in its branch's frame; then the conclusion,
 * which is the full view
 */
function blossomFrames(step: Step): Frame[] {
  const links = step.links ?? [];
  const sets = step.sets ?? [];
  const z = step.eliminations[0]?.digit;
  // the ties from the stem, each starting a branch
  const ties = links.flatMap((l, i) => (l.undirected && l.fromSet === undefined && l.toSet !== undefined ? [i] : []));
  const show = new Set<Part>(['units', 'stem']);
  const stem = cellName(links[ties[0]].from[0].cell);
  const frames: Frame[] = [
    { text: tr`The stem ${stem} holds ${listAnd(ties.map((i) => links[i].from[0].digit))}: one of them is true, and each has a petal.`, links: 0, show }
  ];
  ties.forEach((i, t) => {
    const end = ties[t + 1] ?? links.length;
    const k = links[i].toSet!;
    const petal = sets[k];
    const p = links[i].from[0].digit;
    const L = petal.letter;
    const n = petal.cells.length;
    // the cells the petal holds z in, which the branch makes one of true
    const lock = links.slice(i + 1, end).find((l) => insideSet(l) && l.fromSet === k);
    const exits = uniq((lock?.to ?? petal.members.filter((m) => m.digit === z)).map((cd) => cd.cell));
    let text: string;
    if (n === 1) {
      // a one-cell petal holds just the stem's digit and z, named in order as a one-cell set's are
      const cell = cellName(petal.cells[0]);
      const [a, b] = petal.digits;
      text = tr`Petal ${L} is the cell ${cell}, which holds only ${a} and ${b}, and its ${p} sees the stem: if the stem is ${p}, ${cell} must be ${z}.`;
    } else {
      const cells = cellNames(petal.cells);
      const house = unitName(petal.unit);
      const digits = listAnd(petal.digits);
      frames.push({
        text: tr`Petal ${L}, for the stem's ${p}: the ${n} cells ${cells} of ${house} hold only ${digits}: one digit more than cells, and every ${p} of it sees the stem.`,
        links: i,
        sets: [k],
        show
      });
      const exit = cellNames(exits);
      text =
        exits.length === 1
          ? tr`If the stem is ${p}, petal ${L} holds no ${p}, so its other ${n} digits fill its ${n} cells: ${exit} must be ${z}.`
          : tr`If the stem is ${p}, petal ${L} holds no ${p}, so its other ${n} digits fill its ${n} cells: one of ${exit} must be ${z}.`;
    }
    frames.push({ text, links: end, show });
  });
  frames.push({
    text: `${tr`Whichever digit the stem takes, a petal holds ${aDigit(z)}. Each removed ${z} sees every ${z} of every petal.`} ${conclusionText(step)}`,
    links: links.length,
    show: new Set<Part>(['units', 'stem', 'primary', 'secondary', 'fins', 'conclusion'])
  });
  return frames;
}

export function walkFrames(step: Step): Frame[] {
  if (isParity(step)) return parityFrames(step);
  if (step.tech === 'DEATH_BLOSSOM' && step.links?.some((l) => l.undirected)) return blossomFrames(step);
  const frames: Frame[] = [];
  // 'units' draws every band at once (src/content/hintMarks.ts), which a
  // step without bands may show from its first frame; a step with bands
  // draws each from the frame that reaches it
  const hasBands = !!step.units?.length;
  if (step.links && step.links.length > 0) {
    // the link that closes a loop says what it shows: a discontinuous loop's
    // premise impossible, a continuous loop holding either way round
    const closing = closureText(step) || loopText(step);
    const introduced = new Set<number>();
    // a forcing step's house with no place left for a digit is drawn from
    // the frame of the link into the contradiction, the cells where the
    // board would break (its fins), never inferences ahead of it
    const breaks = (link: ChainLink) => link.to.some((cd) => step.fins?.some((f) => f.cell === cd.cell && f.digit === cd.digit));
    let base = new Set<Part>(hasBands ? [] : ['units']);
    // every inference is a frame of its own; the link that closes a
    // discontinuous loop says what it proves. An almost locked set of
    // several cells comes first in a frame of its own, the locking idea
    // before the chain uses it; a one-cell set is told in its lock's frame
    step.links.forEach((link, i) => {
      for (const k of [link.fromSet, link.toSet]) {
        const set = alsAt(step, k);
        if (k === undefined || !set || set.cells.length < 2 || introduced.has(k)) continue;
        introduced.add(k);
        frames.push({ text: setText(step, set), links: i, sets: [k], show: new Set(base) });
      }
      if (breaks(link)) base = new Set<Part>(['units']);
      const text = closing && i === step.links!.length - 1 ? `${linkText(link, step)} ${closing}` : linkText(link, step);
      frames.push({ text, links: i + 1, show: new Set(base) });
    });
    // an open chain names its two ends first, one of which is true, and an
    // ALS pattern its two end sets, and why each removal goes
    const ends = endsText(step) || chainEndsText(step);
    frames.push({
      text: [ends, conclusionText(step)].filter(Boolean).join(' '),
      links: step.links.length,
      show: new Set<Part>(['units', 'primary', 'secondary', 'fins', 'conclusion'])
    });
    return frames;
  }
  // a pattern's bands come with their roles' frames: its houses with the
  // pattern, a house that loses with what acts on it; only a band that is
  // the whole drawing (a Full House's house) is there with every band
  const whole = hasBands && !step.primary?.length && !step.secondary?.length && !step.fins?.length;
  // a finned fish's fins' box, banded in the fins' colour (its own part, 'finBox')
  const finBand = !!step.units?.some((u) => u.role === 'fin');
  const shown = new Set<Part>(hasBands && !whole ? [] : ['units']);
  // the finder's own sentences, when it writes them (step.walk)
  if (step.walk?.frames.length) {
    // a frame that names cells adds them to those its roles are drawn in
    let cells: Set<number> | undefined;
    for (const f of step.walk.frames) {
      for (const part of f.show) shown.add(part);
      if (f.cells) cells = new Set([...(cells ?? []), ...f.cells]);
      frames.push({ text: f.text, links: 0, show: new Set(shown), ...(cells && { cells: new Set(cells) }), ...(f.digits && { digits: new Set(f.digits) }), ...(f.labels && { labels: f.labels }) });
    }
    for (const part of ['primary', 'secondary', 'fins', 'conclusion'] as const) shown.add(part);
    if (finBand) shown.add('finBox');
    frames.push({ text: [step.walk.lead, conclusionText(step)].filter(Boolean).join(' '), links: 0, show: new Set(shown) });
    return frames;
  }
  const add = (part: Part, text: string | undefined) => {
    if (!text) return;
    shown.add(part);
    frames.push({ text: text[0].toUpperCase() + text.slice(1) + '.', links: 0, show: new Set(shown) });
  };
  const banded = (role: 'primary' | 'secondary') => !!step.units?.some((u) => u.role === role);
  if (step.primary?.length || banded('primary')) add('primary', step.labels?.primary);
  if (step.secondary?.length || banded('secondary')) add('secondary', step.labels?.secondary);
  // a fins' box comes with its fins in a walk its finder does not write
  if (finBand) shown.add('finBox');
  if (step.fins?.length) add('fins', step.labels?.fins);
  shown.add('primary');
  shown.add('secondary');
  shown.add('fins');
  shown.add('conclusion');
  frames.push({ text: conclusionText(step), links: 0, show: new Set(shown) });
  return frames;
}
