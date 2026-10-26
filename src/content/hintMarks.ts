// What a hint marks where (docs/hint-drawing.md G1-G5, G22), worked out once
// for the app's board (src/ui/Grid.tsx), the Learn diagrams
// (src/content/boardSvg.ts) and both legends, so a legend never names a
// colour the board does not show.
//
// One mark per candidate. The first kind a candidate is given wins, except
// that a removal wins over everything and a placement over everything but
// a removal; a candidate the step lists in more than one role takes the
// first of pattern, acts-through, exception. A chain node takes the colour
// the step names for it, in that same order, the pattern's when it names
// none, so a walk's frames colour it as the full view does.
//
// A chain whose truth is derived (src/engine/truth.ts) draws each node as
// what the chain makes it (G2, G18): a filled disc in the true colour, or
// a ring in the false colour, from its first node's premise; that truth
// wins over the roles. A discontinuous loop's start shows its premise
// until the walk reaches the link that closes the loop, and its proven
// value at that link; its truths hold only under the premise the loop
// refutes, so its full view and conclusion draw it as main did, the
// pattern beside the placement or removal. A true group means one of its members is true, not all, so
// its members are 'oneTrue', drawn as the pattern's disc until phase 4 draws
// sets as hulls, with legend words of their own.
// A removed or placed node is the removal or the placement, its truth
// plain from the mark.
// A colouring whose truth is its parity (docs/hint-drawing-colouring.md)
// draws each cluster's candidates in two shades of its hue, dark and light,
// in the frames that show the cluster; where the step proves a colour
// false, the proof frame draws it as false rings and its partner as true
// discs, and the conclusion and the full view draw it as the removals it
// is, with nothing inside, beside the true discs; a candidate in no colour
// at an end of a weak tie is a removal, or a plain ring (3D Medusa's cell a
// colour would empty). Removed wins, then placed, then true or false, then
// a shade.
// A solved cell the step names shows the colour on its digit. A removal or
// a placement keeps, inside its ring, the colour the step names for it
// where the candidate is one of the chain's own nodes (G5: Nishio's
// assumption, removed, and Digit Forcing's, placed, are still the
// assumption), so a colour wholly removed or placed is still there to be
// read; a colour only the chain default gave it is never shown.
import type { CellDigit, ChainLink, Step, UnitBand } from '../engine/steps';
import { isParity, isTie } from '../engine/steps';
import type { Frame, Part } from '../engine/hintFrames';
import { drawnLinks, colouringDigit } from '../engine/hintFrames';
import { deriveTruth } from '../engine/truth';
import { sees } from '../engine/board';
import { tr } from '../engine/text';
import { insideOneCell } from './hintGeometry';
import type { Shade } from './hintPalette';

export { isParity };
export type { Shade };
export type Role = 'primary' | 'secondary' | 'fin';
export type CandMark = Role | Shade | 'place' | 'placeOn' | 'elim' | 'elimOn' | 'node' | 'true' | 'false' | 'oneTrue';

/**
 * A line a colouring draws, for its legend: a tie ('tie', a straight line),
 * a weak tie between two cells ('weakTie', a dashed line) or inside one
 * ('corners', brackets round the cell)
 */
export type LineKind = 'tie' | 'weakTie' | 'corners';

/** a cluster's two shades: 0 purple, 1 orange */
export const shadeOf = (cluster: number, dark: boolean): Shade =>
  cluster === 0 ? (dark ? 'purpleDark' : 'purpleLight') : dark ? 'orangeDark' : 'orangeLight';
const SHADES = new Set<CandMark>(['purpleDark', 'purpleLight', 'orangeDark', 'orangeLight']);
/** a colouring's shade, as a mark */
export const isShade = (kind: CandMark | string | undefined): kind is Shade => SHADES.has(kind as CandMark);

/** a placement, with or without a named colour inside its ring */
export const isPlaced = (kind: CandMark | undefined) => kind === 'place' || kind === 'placeOn';

export interface HintMarks {
  /** a candidate's mark: cell -> digit -> kind */
  cands: Map<number, Map<number, CandMark>>;
  /** the colour a removal or a placement holds inside its ring */
  inside: Map<number, Map<number, Role>>;
  /** a solved cell's colour, on its digit */
  values: Map<number, CandMark>;
  /** the houses shaded as bands */
  bands: UnitBand[];
  /**
   * the drawing shows a derived chain's premise refuted: a loop drawn back
   * to its start, or two of its true candidates in one cell, or of one
   * digit in one house (the chain then proves its start the other way)
   */
  refuted: boolean;
  /** the kinds of line a colouring draws, for its legend; none for any other step */
  lines: Set<LineKind>;
}

export interface MarkOptions {
  /** a cell holds a digit */
  solved(cell: number): boolean;
  /** the links drawn: all of them, or those a walk frame has reached */
  links?: ChainLink[];
  /** what a walk frame shows; everything when absent */
  show?(part: Part): boolean;
  /** a walk frame is shown, so a chain shows only the nodes of the links drawn, until its conclusion */
  walking?: boolean;
}

const has = (list: CellDigit[] | undefined, cd: CellDigit) => !!list?.some((o) => o.cell === cd.cell && o.digit === cd.digit);

/** what a derived chain assumes of its first node, and whether that node is a group (true: one of its candidates; false: none) */
export interface Premise {
  assumed: boolean;
  group: boolean;
}

/**
 * What a derived chain assumes of its first node: false when it opens with
 * a strong link, true when it opens with a weak one; null for a step whose
 * truth is not derived, or whose derivation finds a fault
 */
export function premiseOf(step: Step): Premise | null {
  const d = deriveTruth(step);
  if (!d || d.problems.length || !d.nodes.length) return null;
  const first = d.closure ? d.closure.node : d.nodes[0].node;
  return { assumed: d.closure ? d.closure.assumed : d.nodes[0].truth, group: first.length > 1 };
}

/** the colour the step names for a candidate, if any: the first of the lists the full view marks in order */
export function namedRole(step: Step, cd: CellDigit): Role | null {
  return has(step.primary, cd) ? 'primary' : has(step.secondary, cd) ? 'secondary' : has(step.fins, cd) ? 'fin' : null;
}

/**
 * A colouring's marks (docs/hint-drawing-colouring.md): one mark per
 * candidate, by rank, removed over placed over true or false over a shade
 * over a plain ring. Each cluster a frame shows is in its shades. The
 * colour proven false is false rings in the proof frame and removals at the
 * conclusion and in the full view, its partner true discs in both. An end
 * of a drawn weak tie that no colour claims is a removal from the frame
 * that draws it, or a plain ring (3D Medusa's cell a colour would empty).
 * A removal holds nothing inside its ring: a shade there would hide it.
 */
function parityMarks(step: Step, opts: MarkOptions): HintMarks {
  const { clusters, darkFalse } = step.colouring!;
  const cands = new Map<number, Map<number, CandMark>>();
  const show = opts.show ?? (() => true);
  const links = opts.links ?? [];
  const rank = (kind: CandMark) =>
    kind === 'elim' ? 5 : kind === 'place' ? 4 : kind === 'true' || kind === 'false' ? 3 : isShade(kind) ? 2 : 1;
  const mark = (cd: CellDigit, kind: CandMark) => {
    if (opts.solved(cd.cell)) return;
    if (!cands.has(cd.cell)) cands.set(cd.cell, new Map());
    const m = cands.get(cd.cell)!;
    const prev = m.get(cd.digit);
    if (!prev || rank(kind) > rank(prev)) m.set(cd.digit, kind);
  };
  const concluded = show('conclusion');
  clusters.forEach((cl, k) => {
    if (!show(k === 0 ? 'cluster0' : 'cluster1')) return;
    for (const cd of cl.dark) mark(cd, shadeOf(k, true));
    for (const cd of cl.light) mark(cd, shadeOf(k, false));
  });
  const proven = darkFalse !== undefined ? clusters[darkFalse] : undefined;
  if (proven && (concluded || show('proof'))) {
    for (const cd of proven.dark) mark(cd, concluded ? 'elim' : 'false');
    for (const cd of proven.light) mark(cd, 'true');
  }
  const coloured = (cd: CellDigit) => clusters.some((cl) => has(cl.dark, cd) || has(cl.light, cd));
  const removed = (cd: CellDigit) => has(step.eliminations, cd);
  const lines = new Set<LineKind>();
  for (const l of links) {
    // a tie inside one cell draws nothing: two shades side by side say it
    if (!isTie(l)) lines.add(insideOneCell(l) ? 'corners' : 'weakTie');
    else if (!insideOneCell(l)) lines.add('tie');
    for (const cd of [...l.from, ...l.to]) if (!coloured(cd)) mark(cd, removed(cd) ? 'elim' : 'node');
  }
  if (concluded) {
    for (const cd of step.eliminations) mark(cd, 'elim');
    for (const cd of step.placements) mark(cd, 'place');
  }
  return { cands, inside: new Map(), values: new Map(), bands: show('units') ? (step.units ?? []) : [], refuted: false, lines };
}

export function hintMarks(step: Step, opts: MarkOptions): HintMarks {
  if (isParity(step)) return parityMarks(step, opts);
  const cands = new Map<number, Map<number, CandMark>>();
  const inside = new Map<number, Map<number, Role>>();
  const values = new Map<number, CandMark>();
  const show = opts.show ?? (() => true);
  const bands = show('units') ? (step.units ?? []) : [];
  const links = opts.links ?? step.links ?? [];
  const mark = (cd: CellDigit, kind: CandMark) => {
    if (opts.solved(cd.cell)) {
      // a solved digit shows a colour the step names, and nothing for a chain's truth
      if (kind !== 'true' && kind !== 'false' && kind !== 'oneTrue' && (!values.has(cd.cell) || kind === 'elim')) values.set(cd.cell, kind);
      return;
    }
    if (!cands.has(cd.cell)) cands.set(cd.cell, new Map());
    const m = cands.get(cd.cell)!;
    const prev = m.get(cd.digit);
    if (!prev || kind === 'elim' || (kind === 'place' && prev !== 'elim')) m.set(cd.digit, kind);
  };
  // a derived chain's truth, node by node; a loop's start keeps its premise
  // until the link that closes the loop is drawn. A discontinuous loop's
  // truths hold only under the premise it refutes, so they are drawn in the
  // walk up to that link, and the full view and the conclusion draw the
  // proof as a pattern beside the start's placement or removal, as a
  // forcing chain's full view does (G18, G21)
  const derived = deriveTruth(step);
  const proofOnly = !!derived?.closure && (!opts.walking || show('conclusion'));
  const truth = derived && !derived.problems.length && !proofOnly ? derived : null;
  const closed = links.length >= (step.links ?? []).length;
  const truthOf = (cd: CellDigit): 'true' | 'false' | 'oneTrue' | null => {
    if (!truth) return null;
    const isStart = truth.closure?.node.some((o) => o.cell === cd.cell && o.digit === cd.digit);
    if (truth.closure && isStart && !closed) {
      // a group assumed true means one of its members, not all
      if (truth.closure.assumed) return truth.closure.node.length > 1 ? 'oneTrue' : 'true';
      return 'false';
    }
    const t = truth.candidates.get(`${cd.cell}:${cd.digit}`);
    return t === 'true' ? 'true' : t === 'false' ? 'false' : t === 'groupTrue' ? 'oneTrue' : null;
  };
  const node = (cd: CellDigit) => mark(cd, truthOf(cd) ?? namedRole(step, cd) ?? 'primary');
  if (opts.walking && step.links?.length) {
    // walking a chain: only the nodes of the links drawn so far
    for (const l of links) for (const cd of [...l.from, ...l.to]) node(cd);
  } else {
    // a chain's truth comes before the roles, which mark only what it leaves
    if (truth) for (const l of links) for (const cd of [...l.from, ...l.to]) node(cd);
    if (show('primary')) for (const cd of step.primary ?? []) mark(cd, 'primary');
    if (show('secondary')) for (const cd of step.secondary ?? []) mark(cd, 'secondary');
    // every chain node gets a mark, so arrows root on one
    if (!truth) for (const l of links) for (const cd of [...l.from, ...l.to]) node(cd);
    if (show('fins')) for (const cd of step.fins ?? []) mark(cd, 'fin');
  }
  if (show('conclusion')) {
    if (opts.walking) {
      // the last frame of a walk: the whole pattern, then the conclusion
      for (const cd of step.primary ?? []) mark(cd, 'primary');
      for (const cd of step.secondary ?? []) mark(cd, 'secondary');
      for (const cd of step.fins ?? []) mark(cd, 'fin');
    }
    for (const cd of step.eliminations) mark(cd, 'elim');
    for (const cd of step.placements) mark(cd, 'place');
    const nodes = new Set((step.links ?? []).flatMap((l) => [...l.from, ...l.to]).map((cd) => `${cd.cell}:${cd.digit}`));
    for (const [list, kind] of [
      [step.eliminations, 'elimOn'],
      [step.placements, 'placeOn']
    ] as const) {
      for (const cd of list) {
        const colour = namedRole(step, cd);
        if (!colour || opts.solved(cd.cell)) continue;
        if (!nodes.has(`${cd.cell}:${cd.digit}`)) continue;
        // a derived chain's removed or placed node: the mark says its truth
        if (truth) continue;
        // a removal wins over a placement of the same candidate
        if (kind === 'placeOn' && cands.get(cd.cell)?.get(cd.digit) !== 'place') continue;
        cands.get(cd.cell)!.set(cd.digit, kind);
        if (!inside.has(cd.cell)) inside.set(cd.cell, new Map());
        inside.get(cd.cell)!.set(cd.digit, colour);
      }
    }
  }
  // two true candidates that cannot both be: the premise is impossible
  const trues = [...cands].flatMap(([cell, m]) => [...m].filter(([, k]) => k === 'true').map(([digit]) => ({ cell, digit })));
  const clash = trues.some((a, i) => trues.slice(i + 1).some((b) => a.cell === b.cell || (a.digit === b.digit && sees(a.cell, b.cell))));
  const refuted = !!truth && ((!!truth.closure && closed) || clash);
  return { cands, inside, values, bands, refuted, lines: new Set() };
}

/**
 * What a hint draws at a walk frame, or in full when there is none: the
 * one call the board and its legend both make, so the legend names what
 * the frame shows (G23)
 */
export function frameMarks(step: Step, frame: Frame | null, solved: (cell: number) => boolean): HintMarks {
  const drawn = drawnLinks(step, frame);
  return hintMarks(step, {
    solved,
    links: (step.links ?? []).filter((_, i) => drawn.has(i)),
    show: frame ? (part) => frame.show.has(part) : undefined,
    walking: !!frame
  });
}

/** the placements among the marks, as "cell:digit": their outer ring reaches further than a disc */
export const placedKeys = (marks: HintMarks): Set<string> =>
  new Set([...marks.cands].flatMap(([cell, m]) => [...m].filter(([, kind]) => isPlaced(kind)).map(([digit]) => `${cell}:${digit}`)));

/** every candidate the marks hold, for the arrows to bend round */
export const markedCandidates = (marks: HintMarks): CellDigit[] =>
  [...marks.cands].flatMap(([cell, m]) => [...m.keys()].map((digit) => ({ cell, digit })));

/**
 * What a legend shows (G23): the kinds the board draws, and for each the
 * shape it is drawn in, so the swatch can be drawn the same: on a
 * candidate (a disc or a ring), only on solved digits (the digit's rounded
 * outline), or only as a house band. And the roles the step names whose
 * every candidate was drawn as a removal or a placement, whose words then
 * belong to that entry ("remove: the cell that would complete the
 * rectangle")
 */
export function legendKinds(
  step: Step,
  marks: HintMarks
): {
  shown: Set<CandMark>;
  onValue: Set<CandMark>;
  onBand: Set<CandMark>;
  intoRemove: Role[];
  intoPlace: Role[];
  refuted: boolean;
  /** a colouring's clusters drawn in their shades, in order */
  clusters: number[];
  /** the kinds of line a colouring draws */
  lines: Set<LineKind>;
  /**
   * what a colouring draws of the colour it proves false: as false rings
   * (the proof frame), as removals (the conclusion, the full view), and
   * its partner as true discs; and whether any removal is of another kind
   */
  proven: { false: boolean; removed: boolean; true: boolean; otherRemoved: boolean };
} {
  const shown = new Set<CandMark>();
  const parity = isParity(step);
  for (const m of marks.cands.values()) for (const k of m.values()) shown.add(k === 'elimOn' ? 'elim' : k === 'placeOn' ? 'place' : k);
  for (const k of marks.inside.values()) for (const r of k.values()) shown.add(r);
  const onValue = new Set<CandMark>();
  for (const k of marks.values.values()) {
    const kind = k === 'elimOn' ? 'elim' : k;
    if (!shown.has(kind)) onValue.add(kind);
  }
  const onBand = new Set<CandMark>();
  for (const u of marks.bands) if (!shown.has(u.role) && !onValue.has(u.role)) onBand.add(u.role);
  for (const k of [...onValue, ...onBand]) shown.add(k);
  const intoRemove: Role[] = [];
  const intoPlace: Role[] = [];
  const lists: [Role, CellDigit[] | undefined][] = [['primary', step.primary], ['secondary', step.secondary], ['fin', step.fins]];
  for (const [role, list] of lists) {
    if (!list?.length || shown.has(role)) continue;
    const kindOf = (cd: CellDigit) => marks.cands.get(cd.cell)?.get(cd.digit) ?? marks.values.get(cd.cell);
    if (list.every((cd) => kindOf(cd) === 'elim' || kindOf(cd) === 'elimOn')) intoRemove.push(role);
    else if (list.every((cd) => isPlaced(kindOf(cd)))) intoPlace.push(role);
  }
  const clusters = [0, 1].filter((k) => shown.has(shadeOf(k, true)) || shown.has(shadeOf(k, false)));
  const darkFalse = parity ? step.colouring!.darkFalse : undefined;
  const provenDark = darkFalse !== undefined ? step.colouring!.clusters[darkFalse].dark : [];
  const kindOf = (cd: CellDigit) => marks.cands.get(cd.cell)?.get(cd.digit);
  const removals = [...marks.cands].flatMap(([cell, m]) => [...m].filter(([, k]) => k === 'elim').map(([digit]) => ({ cell, digit })));
  const proven = {
    false: provenDark.some((cd) => kindOf(cd) === 'false'),
    removed: removals.some((cd) => has(provenDark, cd)),
    true: darkFalse !== undefined && step.colouring!.clusters[darkFalse].light.some((cd) => kindOf(cd) === 'true'),
    otherRemoved: removals.some((cd) => !has(provenDark, cd))
  };
  return { shown, onValue, onBand, intoRemove, intoPlace, refuted: marks.refuted, clusters, lines: marks.lines, proven };
}

/** an entry of a colouring's legend: what its swatch draws, and its words */
export interface ParityEntry {
  /**
   * a cluster's two shades side by side ('pair'), a tie's line, a weak
   * tie's dashed line, the corner brackets, a removal, a true disc, a false
   * ring, the plain ring of the cell a colour would empty ('node')
   */
  kind: 'pair' | LineKind | 'elim' | 'true' | 'false' | 'node';
  label: string;
  /** a pair's cluster: 0 purple, 1 orange */
  cluster?: number;
}

/** a cluster's pair of shades, worded by digit (Simple and Multi Colors) or by candidate (3D Medusa, Remote Pair) */
function pairWords(cluster: number, digit: number | null): string {
  if (cluster === 1) {
    return digit
      ? tr`dark orange, light orange: either every dark orange ${digit} is true, or every light orange one is`
      : tr`dark orange, light orange: either every dark orange candidate is true, or every light orange one is`;
  }
  return digit
    ? tr`dark purple, light purple: either every dark purple ${digit} is true, or every light purple one is`
    : tr`dark purple, light purple: either every dark purple candidate is true, or every light purple one is`;
}

/**
 * What a colouring's legend names, in order (docs/hint-drawing-colouring.md,
 * "The legend"), for the marks a frame draws, or the full view's: each
 * cluster drawn in its shades, as a pair; the lines; the removals, those of
 * the colour proven false named so, since no shade is left to say it; the
 * proven colours; and 3D Medusa's cell a colour would empty. One list for
 * the app's legend and the Learn diagrams', so the two cannot disagree
 */
export function parityLegend(step: Step, marks: HintMarks): ParityEntry[] {
  if (!isParity(step)) return [];
  const { darkFalse, rule } = step.colouring!;
  const kinds = legendKinds(step, marks);
  const digit = colouringDigit(step);
  const out: ParityEntry[] = kinds.clusters.map((k) => ({ kind: 'pair', label: pairWords(k, digit), cluster: k }));
  if (kinds.lines.has('tie')) out.push({ kind: 'tie', label: tr`line: exactly one of its two ends is true` });
  if (kinds.lines.has('weakTie')) out.push({ kind: 'weakTie', label: tr`dashed line: its two ends see each other, so at most one is true` });
  if (kinds.lines.has('corners')) out.push({ kind: 'corners', label: tr`corners: two candidates of one cell, at most one true` });
  const orange = darkFalse === 1;
  const { proven } = kinds;
  if (proven.removed) out.push({ kind: 'elim', label: orange ? tr`remove: dark orange, proven false` : tr`remove: dark purple, proven false` });
  if (proven.otherRemoved) out.push({ kind: 'elim', label: tr`remove` });
  if (proven.true) {
    out.push({ kind: 'true', label: orange ? tr`true: light orange, proven (this step only removes)` : tr`true: light purple, proven (this step only removes)` });
  }
  if (proven.false) out.push({ kind: 'false', label: orange ? tr`false: dark orange, proven` : tr`false: dark purple, proven` });
  if (kinds.shown.has('node') && rule === 'medusa6') out.push({ kind: 'node', label: tr`a cell dark purple would empty` });
  return out;
}
