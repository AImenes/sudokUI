/**
 * The rules the set walk keeps (docs/hint-drawing-sets.md, decisions 17-18,
 * "The walk and its words" and "How it is checked"), as one list of what is
 * wrong with a step's walk, for tests/setWords.test.ts and for the AIC with
 * ALS steps tests/alsaic.test.ts finds in generated puzzles. Not a test
 * file itself. In every set technique, no frame reads the plain sentence
 * for two digits in different cells ("Strong link: if r8c2, r9c1 is not 5,
 * r8c2 must be 1"). Along a derived chain through almost locked sets:
 * - every set of several cells is introduced by one frame of its own,
 *   before any frame that reaches it, which names it, its cells and its
 *   house;
 * - a one-cell set has no frame of its own: its lock's frame introduces it;
 * - every link with an end in a set is told as the set's, naming it, and
 *   never as a plain link of single candidates or of a group;
 * - no sentence that names a set says "group", nor does a legend whose
 *   premise is a set's;
 * - every letter a sentence names is drawn in its frame.
 */
import type { ChainLink, Step } from '../src/engine/steps';
import { insideSet } from '../src/engine/steps';
import { cellNames } from '../src/engine/board';
import { unitName } from '../src/engine/text';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, premiseOf } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';

/** the plain sentence for a link between two digits in different cells, which says nothing true of a set */
export const GENERIC = /^(Strong|Weak) link: if /;
/** the plain sentences for a link of single candidates or of a group */
const PLAIN = /^(Strong|Weak) link|^In r\dc\d:/;

/** what is wrong with a step's walk (its own, or the frames given) and its legends, by the rules above; empty for every finder's step */
export function wordProblems(step: Step, frames: Frame[] = walkFrames(step)): string[] {
  const out: string[] = [];
  frames.forEach((f, i) => {
    if (GENERIC.test(f.text)) out.push(`frame ${i + 1}: the plain sentence for two digits: ${f.text}`);
  });
  if (step.truth !== 'derived') return out;
  const sets = step.sets ?? [];
  const links = step.links ?? [];
  // the frame of each link: the one that reaches it, not a set's frame before it
  const frameOf = (i: number) => frames.findIndex((f) => f.links === i + 1 && !f.sets);
  sets.forEach((s, k) => {
    if (s.kind !== 'als') return;
    const first = links.findIndex((l) => l.fromSet === k || l.toSet === k);
    const own = frames.flatMap((f, i) => (f.sets?.includes(k) ? [i] : []));
    if (s.cells.length > 1) {
      if (own.length !== 1) out.push(`set ${s.letter}: introduced by ${own.length} frames`);
      else if (own[0] > frameOf(first)) out.push(`set ${s.letter}: introduced after the frame that reaches it`);
      else {
        const text = frames[own[0]].text;
        const named = [`Set ${s.letter}`, cellNames(s.cells), unitName(s.unit)].every((w) => text.includes(w));
        if (!named) out.push(`set ${s.letter}: its frame does not name it, its cells and its house: ${text}`);
      }
    } else {
      if (own.length) out.push(`set ${s.letter}: a one-cell set with a frame of its own`);
      const lock = links.findIndex((l) => insideSet(l) && l.fromSet === k);
      const text = lock < 0 ? '' : frames[frameOf(lock)].text;
      if (!new RegExp(`^Set ${s.letter}(, the hinge,)? is the cell ${cellNames(s.cells)}, `).test(text)) out.push(`set ${s.letter}: a one-cell set not introduced by its lock: ${text}`);
    }
  });
  links.forEach((l, i) => {
    const als = [...new Set([l.fromSet, l.toSet])].filter((k): k is number => k !== undefined && sets[k].kind === 'als');
    if (!als.length) return;
    const text = frames[frameOf(i)].text;
    if (PLAIN.test(text)) out.push(`link ${i + 1}: a plain sentence for a set's link: ${text}`);
    for (const k of als) if (!new RegExp(`\\b[Ss]et ${sets[k].letter}\\b`).test(text)) out.push(`link ${i + 1}: does not name set ${sets[k].letter}: ${text}`);
  });
  frames.forEach((f, i) => {
    const named = [...f.text.matchAll(/\b[Ss]et ([A-Z])\b/g)].map((m) => m[1]);
    if (named.length && /group/i.test(f.text)) out.push(`frame ${i + 1}: says "group" of a set: ${f.text}`);
    const drawn = new Set(frameMarks(step, f, () => false).sets.map((m) => sets[m.set].letter));
    for (const L of named) if (!drawn.has(L)) out.push(`frame ${i + 1}: names set ${L}, which it does not draw`);
  });
  if (premiseOf(step)?.kind === 'set') {
    for (const f of [null, ...frames]) {
      for (const l of legendOf(step, undefined, f)) if (/first group|first candidate/.test(l.label)) out.push(`the legend words a set's premise as another's: ${l.label}`);
    }
  }
  return out;
}

/**
 * An ALS pattern (ALS-XZ, ALS-XY-Wing, ALS-XY-Chain) read as the chain it
 * derives (docs/hint-drawing-sets.md, decision 11), from its sets and its
 * restricted commons: (z)A=(x)A-(x)B=(z)B and its longer forms, each set's
 * lock a strong link inside it, the restricted commons the weak links
 * between them, `truth: 'derived'` and no roles, so its walk is the set
 * walk, in the design's worked sentences.
 */
export function chainOfPattern(step: Step): Step {
  const commons = step.links!;
  const order = [commons[0].fromSet!, ...commons.map((l) => l.toSet!)];
  const x = commons.map((l) => l.from[0].digit);
  const z = step.eliminations[0].digit;
  const node = (k: number, d: number) => step.sets![k].members.filter((m) => m.digit === d);
  const links: ChainLink[] = order.flatMap((k, i): ChainLink[] => {
    const [enter, leave] = [i === 0 ? z : x[i - 1], i === order.length - 1 ? z : x[i]];
    const lock: ChainLink = { from: node(k, enter), to: node(k, leave), strong: true, fromSet: k, toSet: k };
    if (i === order.length - 1) return [lock];
    return [lock, { from: node(k, leave), to: node(order[i + 1], leave), strong: false, fromSet: k, toSet: order[i + 1] }];
  });
  const { primary, secondary, fins, labels, ...rest } = step;
  return { ...rest, truth: 'derived', links };
}
