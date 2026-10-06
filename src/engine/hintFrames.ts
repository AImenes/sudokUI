/**
 * The walk: a hint's drawing revealed one idea at a time, with a sentence
 * for each. For a chain the ideas are its links, in order, then the
 * conclusion. For a pattern they are its colours, in the order the
 * explanation introduces them (the legend labels supply the words), then
 * the conclusion. A step whose walk has a single frame has nothing to
 * walk through, and the panel offers no walk for it.
 */
import { cellName, cellNames } from './board';
import { CellDigit, ChainLink, Step } from './steps';
import { tr } from './text';

export type Part = 'units' | 'primary' | 'secondary' | 'fins' | 'conclusion';

export interface Frame {
  /** the sentence for this frame */
  text: string;
  /** how many links are drawn, from the first */
  links: number;
  /** which parts of the drawing are shown */
  show: Set<Part>;
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
    return link.strong
      ? tr`Strong link on ${fd}: if ${from} is not ${fd}, ${to} must be ${fd} (nowhere else for it).`
      : tr`Weak link on ${fd}: if ${from} is ${fd}, ${to} cannot be ${fd} (they see each other).`;
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
  for (const [digit, cells] of [...byDigit].sort((a, b) => a[0] - b[0])) {
    parts.push(parts.length ? tr`${digit} is removed from ${cellNames(cells)}` : tr`So ${digit} is removed from ${cellNames(cells)}`);
  }
  return parts.length ? `${parts.join('; ')}.` : '';
}

/**
 * The explanation as shown: the finder's sentence, followed by the
 * conclusion in cell names when the sentence does not already name every
 * cell it places in or removes from.
 */
export function describe(step: Step): string {
  const cells = [...step.placements, ...step.eliminations].map((cd) => cellName(cd.cell));
  const named = cells.every((name) => step.description.includes(name));
  if (named || !cells.length) return step.description;
  return `${step.description} ${conclusionText(step)}`;
}

export function walkFrames(step: Step): Frame[] {
  const frames: Frame[] = [];
  const base = new Set<Part>(['units']);
  if (step.links && step.links.length > 0) {
    // a run of ties is one idea: the cluster, coloured; every inference
    // after it is a frame of its own
    let i = 0;
    while (i < step.links.length) {
      const link = step.links[i];
      if (link.undirected) {
        let j = i;
        while (j < step.links.length && step.links[j].undirected) j++;
        const text =
          j - i === 1
            ? tr`${nodeCells(link.from)} and ${nodeCells(link.to)}: exactly one of them is true, so they take opposite colours.`
            : tr`The cluster: each line joins two candidates of which exactly one is true (a conjugate pair, or the two candidates of a bivalue cell), so the two ends take opposite colours, and the colours spread along the lines.`;
        frames.push({ text, links: j, show: new Set(base) });
        i = j;
      } else {
        frames.push({ text: linkText(link), links: i + 1, show: new Set(base) });
        i++;
      }
    }
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
