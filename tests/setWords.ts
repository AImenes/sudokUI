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
 * A Death Blossom's walk (decision 15) is told in words:
 * - the stem first, naming its cell;
 * - every petal of several cells introduced by one frame of its own before
 *   its branch's, naming it, the stem's digit, its cells and its house;
 * - a one-cell petal introduced by its branch's frame;
 * - every branch told in its own frame, naming its petal and the stem's
 *   digit, and every petal a sentence names drawn in its frame;
 * - never "group".
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
  if (step.tech === 'DEATH_BLOSSOM') return [...out, ...blossomProblems(step, frames)];
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

/** what is wrong with a Death Blossom's walk, by the rules above */
function blossomProblems(step: Step, frames: Frame[]): string[] {
  const out: string[] = [];
  const sets = step.sets ?? [];
  const links = step.links ?? [];
  const ties = links.flatMap((l, i) => (l.undirected && l.fromSet === undefined ? [i] : []));
  if (!frames[0]?.text.startsWith(`The stem ${cellNames([links[ties[0]].from[0].cell])} holds `)) out.push(`frame 1: not the stem: ${frames[0]?.text}`);
  ties.forEach((i) => {
    const k = links[i].toSet!;
    const petal = sets[k];
    const p = links[i].from[0].digit;
    // the frame that reaches the branch: its tie and the petal's lock
    const branch = frames.findIndex((f) => f.links > i && !f.sets);
    const own = frames.flatMap((f, j) => (f.sets?.includes(k) ? [j] : []));
    if (petal.cells.length > 1) {
      const intro = own.length === 1 ? frames[own[0]].text : '';
      const named = [`Petal ${petal.letter}, for the stem's ${p}:`, cellNames(petal.cells), unitName(petal.unit)].every((w) => intro.includes(w));
      if (own.length !== 1 || own[0] > branch || !named) out.push(`petal ${petal.letter}: not introduced once, before its branch, by its letter, digit, cells and house: ${intro}`);
    } else if (own.length || !frames[branch]?.text.startsWith(`Petal ${petal.letter} is the cell ${cellNames(petal.cells)}, `)) {
      out.push(`petal ${petal.letter}: a one-cell petal not introduced by its branch: ${frames[branch]?.text}`);
    }
    if (!new RegExp(`\\b[Pp]etal ${petal.letter}\\b`).test(frames[branch]?.text ?? '') || !frames[branch].text.includes(`stem is ${p}`)) {
      out.push(`branch ${p}: its frame does not name petal ${petal.letter} and the stem's ${p}: ${frames[branch]?.text}`);
    }
    if (frames.findIndex((f) => f.links > i + 1) !== branch) out.push(`branch ${p}: its tie and its lock in different frames`);
  });
  frames.forEach((f, i) => {
    if (/group/i.test(f.text)) out.push(`frame ${i + 1}: says "group": ${f.text}`);
    const named = [...f.text.matchAll(/\b[Pp]etal ([A-Z])\b/g)].map((m) => m[1]);
    const drawn = new Set(frameMarks(step, f, () => false).sets.map((m) => sets[m.set].letter));
    for (const L of named) if (!drawn.has(L)) out.push(`frame ${i + 1}: names petal ${L}, which it does not draw`);
  });
  return out;
}

/**
 * The chain an ALS pattern (ALS-XZ, ALS-XY-Wing, ALS-XY-Chain) is
 * (docs/hint-drawing-sets.md, decision 11), rebuilt from its sets and the
 * digits of its links between two sets alone, apart from the finder's
 * code: (z)A=(x)A-(x)B=(z)B and its longer forms, the sets in the order
 * those links take them, each set's lock a strong link inside it from the
 * digit the chain enters it by to the one it leaves by (z, the removals'
 * digit, at both ends), the restricted commons the weak links between
 * them, each end all the set's cells that hold its digit.
 */
export function patternChain(step: Step): ChainLink[] {
  const commons = step.links!.filter((l) => !insideSet(l));
  const order = [commons[0].fromSet!, ...commons.map((l) => l.toSet!)];
  const x = commons.map((l) => l.from[0].digit);
  const z = step.eliminations[0].digit;
  const node = (k: number, d: number) => step.sets![k].members.filter((m) => m.digit === d);
  return order.flatMap((k, i): ChainLink[] => {
    const [enter, leave] = [i === 0 ? z : x[i - 1], i === order.length - 1 ? z : x[i]];
    const lock: ChainLink = { from: node(k, enter), to: node(k, leave), strong: true, fromSet: k, toSet: k };
    if (i === order.length - 1) return [lock];
    return [lock, { from: node(k, leave), to: node(order[i + 1], leave), strong: false, fromSet: k, toSet: order[i + 1] }];
  });
}
