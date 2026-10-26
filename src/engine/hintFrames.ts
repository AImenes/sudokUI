/**
 * The walk: a hint's drawing revealed one idea at a time, with a sentence
 * for each. For a chain the ideas are its links, in order, then the
 * conclusion. For a pattern they are its colours, in the order the
 * explanation introduces them (the legend labels supply the words), then
 * the conclusion. For a colouring (docs/hint-drawing-colouring.md) they
 * are each cluster with its ties, then each link of the argument, then,
 * where a colour is proven, the proof, then the conclusion. A step whose
 * walk has a single frame has nothing to walk through, and the panel
 * offers no walk for it.
 */
import { cellName, cellNames } from './board';
import { CellDigit, ChainLink, Step, isParity, isTie } from './steps';
import { tr } from './text';
import { deriveTruth } from './truth';

/**
 * A part of the drawing a frame shows: a pattern's bands and roles; a
 * colouring's clusters in their shades, and its proof (the colour proven
 * false as false rings, its partner as true discs); the conclusion.
 */
export type Part = 'units' | 'primary' | 'secondary' | 'fins' | 'cluster0' | 'cluster1' | 'proof' | 'conclusion';

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
  /** which parts of the drawing are shown */
  show: Set<Part>;
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

/** One link, read as an inference: what the chain argues at that point. */
export function linkText(link: ChainLink): string {
  if (link.text) return link.text;
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

/** What the step concludes, in words: the placements and removals. */
export function conclusionText(step: Step): string {
  // "So a; b; c.": the first clause carries the "So", so each language can
  // open the sentence its own way
  const parts: string[] = [];
  for (const { cell, digit } of step.placements) {
    parts.push(parts.length ? tr`${cellName(cell)} must be ${digit}` : tr`So ${cellName(cell)} must be ${digit}`);
  }
  const byDigit = new Map<number, number[]>();
  for (const { cell, digit } of step.eliminations) (byDigit.get(digit) ?? byDigit.set(digit, []).get(digit)!).push(cell);
  // a colouring's removals come in the order its cluster grew, up to a
  // dozen cells of one digit: they are named in reading order
  if (isParity(step)) for (const cells of byDigit.values()) cells.sort((a, b) => a - b);
  for (const [digit, cells] of [...byDigit].sort((a, b) => a[0] - b[0])) {
    parts.push(parts.length ? tr`${digit} is removed from ${cellNames(cells)}` : tr`So ${digit} is removed from ${cellNames(cells)}`);
  }
  return parts.length ? `${parts.join('; ')}.` : '';
}

/**
 * The explanation as shown: the finder's sentence, followed by the
 * conclusion in cell names when the sentence does not already name every
 * cell it places in or removes from. A colouring's sentence argues for one
 * removal, or for a colour, and counts or sums up the rest, so a cell it
 * names may lose a candidate it does not name: its conclusion follows
 * whenever it removes more than one candidate.
 */
export function describe(step: Step): string {
  const cells = [...step.placements, ...step.eliminations].map((cd) => cellName(cd.cell));
  const counted = isParity(step) && step.eliminations.length > 1;
  const named = !counted && cells.every((name) => step.description.includes(name));
  if (named || !cells.length) return step.description;
  return `${step.description} ${conclusionText(step)}`;
}

/**
 * What the link that closes a discontinuous loop shows: the chain came
 * back to its start the other way, so the assumption it began with is
 * impossible (docs/hint-drawing.md G18); empty for any other chain
 */
export function closureText(step: Step): string {
  const d = deriveTruth(step);
  if (!d?.closure || d.problems.length) return '';
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
    frames.push({ text: linkText(l), links: i + 1, drawn: [...argument], show: new Set(shown) });
  });
  if (darkFalse !== undefined) {
    shown.add('proof');
    frames.push({ text: proofText(step), links: links.length, drawn: [...argument], show: new Set(shown) });
  }
  shown.add('conclusion');
  const conclusion = conclusionText(step);
  frames.push({
    text: darkFalse !== undefined ? `${conclusion} ${provenText(step)}` : conclusion,
    links: links.length,
    drawn: [...argument],
    show: new Set(shown)
  });
  return frames;
}

export function walkFrames(step: Step): Frame[] {
  if (isParity(step)) return parityFrames(step);
  const frames: Frame[] = [];
  const base = new Set<Part>(['units']);
  if (step.links && step.links.length > 0) {
    const closing = closureText(step);
    // every inference is a frame of its own; the link that closes a
    // discontinuous loop says what it proves
    step.links.forEach((link, i) => {
      const text = closing && i === step.links!.length - 1 ? `${linkText(link)} ${closing}` : linkText(link);
      frames.push({ text, links: i + 1, show: new Set(base) });
    });
    frames.push({
      text: conclusionText(step),
      links: step.links.length,
      show: new Set<Part>(['units', 'primary', 'secondary', 'fins', 'conclusion'])
    });
    return frames;
  }
  const shown = new Set<Part>(base);
  const add = (part: Part, text: string | undefined) => {
    if (!text) return;
    shown.add(part);
    frames.push({ text: text[0].toUpperCase() + text.slice(1) + '.', links: 0, show: new Set(shown) });
  };
  const banded = (role: 'primary' | 'secondary') => !!step.units?.some((u) => u.role === role);
  if (step.primary?.length || banded('primary')) add('primary', step.labels?.primary);
  if (step.secondary?.length || banded('secondary')) add('secondary', step.labels?.secondary);
  if (step.fins?.length) add('fins', step.labels?.fins);
  shown.add('primary');
  shown.add('secondary');
  shown.add('fins');
  shown.add('conclusion');
  frames.push({ text: conclusionText(step), links: 0, show: new Set(shown) });
  return frames;
}
