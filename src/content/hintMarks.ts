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
// wins over the roles. A walk frame draws what the links it has drawn
// prove, so no frame draws a truth ahead of the sentence that gives it
// (where an ALS-XY-Chain's sets share a cell, a later set can settle a
// candidate drawn earlier). A discontinuous loop's start shows its premise
// until the walk reaches the link that closes the loop, and its proven
// value at that link; its truths hold only under the premise the loop
// refutes, so its full view and conclusion draw it as main did, the
// pattern beside the placement or removal. A true node of several
// candidates means one of them is true, not all, so its candidates are
// 'oneOf', the pale "one of these" square, never a true disc
// (docs/hint-drawing-sets.md, decision 1), unless a node of one candidate
// already makes one of them true: that one is then a true disc and the
// others, which see it, false rings, never squares beside the disc.
// A group (the 2-3 candidates of one digit in one box and one row or
// column, Step.sets) is drawn as one node: its members' own marks on a bar
// in their ink, from the frame that first reaches it. The bar takes its
// members' mark in each view: "one of these" squares while one of them is
// true, false rings, the pattern's discs in a proof-only view, removals
// (decisions 2 and 3); the geometry puts it (src/content/hintGeometry.ts).
// An almost locked set (Step.sets of kind 'als') is drawn as a tile in each
// of its cells, in one of three tints, with its letter on a tab, from the
// frame that first reaches it, or from its own frame before that, which
// introduces it (decisions 5-8 and 17); its candidates the view gives no
// other mark are its members, no shape, the digit bold on the tile
// (decision 10), the last mark of all (G5).
// An ALS pattern read as its chain whose derivation clashes (an ALS-XY-Chain
// whose sets share cells, src/engine/truth.ts alsClash) draws no truth in
// any view: its sets' candidates are members, beside its arrows and its
// removals (decision 13). A Death Blossom draws no truth either: its stem's
// candidates and each petal's digit the stem sees are what it acts
// through, every petal's z the pattern, its other candidates members, and
// a dashed weak tie with no head joins each stem digit to its petal
// (decision 15). Its walk shows the stem first, then each branch's nodes.
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
import { drawnLinks, colouringDigit, walkFrames } from '../engine/hintFrames';
import { alsClash, deriveLinks, deriveTruth } from '../engine/truth';
import { sees } from '../engine/board';
import { tr } from '../engine/text';
import { insideOneCell, tilesIn } from './hintGeometry';
import type { Shade } from './hintPalette';

export { isParity };
export type { Shade };
export type Role = 'primary' | 'secondary' | 'fin';
export type CandMark = Role | Shade | 'place' | 'placeOn' | 'elim' | 'elimOn' | 'node' | 'true' | 'false' | 'oneOf' | 'member';

/**
 * How a view draws a group's bar, by its members' mark: "one of these"
 * squares ('oneOf'), false rings ('false'), the pattern's discs in a
 * proof-only view ('primary'), or removals ('elim')
 * (docs/hint-drawing-sets.md, decisions 2 and 3)
 */
export type BarStyle = 'oneOf' | 'false' | 'primary' | 'elim';

/** how a view draws a set: a group on its bar, by its members' mark, or an almost locked set as its tiles ('als') */
export type SetStyle = BarStyle | 'als';

/** an almost locked set's tint: 1 sand, 2 rose, 3 violet (docs/hint-drawing-sets.md, decision 8; src/content/hintPalette.ts set1-set3) */
export type Tint = 1 | 2 | 3;

/** a set a view draws (an index into Step.sets), and how; an almost locked set with its tint */
export interface SetMark {
  set: number;
  style: SetStyle;
  tint?: Tint;
}

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
  /** the kinds of line a colouring draws, for its legend, and a Death Blossom's weak ties; none for any other step */
  lines: Set<LineKind>;
  /** the groups the view draws on their bars, each with its members' mark, and the almost locked sets it draws as tiles, each with its tint; none for a step without sets */
  sets: SetMark[];
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
  /** the almost locked sets a walk frame introduces before any link drawn reaches them (src/engine/hintFrames.ts Frame.sets) */
  sets?: number[];
}

const has = (list: CellDigit[] | undefined, cd: CellDigit) => !!list?.some((o) => o.cell === cd.cell && o.digit === cd.digit);

/**
 * What a derived chain assumes of its first node, and what kind of node it
 * is: a candidate, several read as one ('group': true, one of them; false,
 * none of them), or one digit of an almost locked set ('set', with the
 * set's letter and the digit: true, the set holds it; false, it holds
 * none), so the legend words the premise by its kind
 * (docs/hint-drawing-sets.md, Data and decision 18)
 */
export type Premise = { assumed: boolean } & ({ kind: 'candidate' | 'group' } | { kind: 'set'; letter: string; digit: number });

/**
 * What a derived chain assumes of its first node: false when it opens with
 * a strong link, true when it opens with a weak one; null for a step whose
 * truth is not derived, or whose derivation finds a fault, and for an ALS
 * pattern whose chain clashes, which draws no truth. A first node
 * that is a digit of an almost locked set is worded as the set's, never as
 * a group, wherever its digit lies in the set
 */
export function premiseOf(step: Step): Premise | null {
  const d = deriveTruth(step);
  if (!d || d.problems.length || !d.nodes.length || alsClash(step)) return null;
  const first = d.closure ? d.closure.node : d.nodes[0].node;
  const assumed = d.closure ? d.closure.assumed : d.nodes[0].truth;
  // the chain's first node is its first link's start, a loop's too
  const at = step.links![0].fromSet;
  const set = at === undefined ? undefined : step.sets?.[at];
  if (set?.kind === 'als' && set.letter) return { assumed, kind: 'set', letter: set.letter, digit: first[0].digit };
  return { assumed, kind: first.length > 1 ? 'group' : 'candidate' };
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
  return { cands, inside: new Map(), values: new Map(), bands: show('units') ? (step.units ?? []) : [], refuted: false, lines, sets: [] };
}

/** a group mark's style, by its members' marks: removed over false over "one of these" over the pattern's */
const STYLES: [BarStyle, (kind: CandMark | undefined) => boolean][] = [
  ['elim', (k) => k === 'elim' || k === 'elimOn'],
  ['false', (k) => k === 'false'],
  ['oneOf', (k) => k === 'oneOf'],
  ['primary', (k) => k === 'primary']
];

/** whether two cells lie side by side, sharing a side */
const besideCell = (a: number, b: number) =>
  (Math.floor(a / 9) === Math.floor(b / 9) && Math.abs(a - b) === 1) || (a % 9 === b % 9 && Math.abs(a - b) === 9);

/**
 * Each almost locked set's tint (docs/hint-drawing-sets.md, decision 8), by
 * its index into Step.sets: up to three sets take one each, in letter
 * order; four or more take, in letter order, the lowest tint no set they
 * conflict with has already (a link between the two, a cell they share, or
 * a cell side), and where none is free the lowest no set linked to them
 * has, so a tint is reused but never on two linked sets. Sets that share a
 * tint are told apart by their letters
 */
export function setTints(step: Step): Map<number, Tint> {
  const sets = step.sets ?? [];
  const order = sets
    .map((_, k) => k)
    .filter((k) => sets[k].kind === 'als')
    .sort((a, b) => (sets[a].letter ?? '').localeCompare(sets[b].letter ?? '') || a - b);
  const out = new Map<number, Tint>();
  const TINTS: Tint[] = [1, 2, 3];
  if (order.length <= TINTS.length) {
    order.forEach((k, i) => out.set(k, TINTS[i]));
    return out;
  }
  const linked = (a: number, b: number) =>
    (step.links ?? []).some((l) => (l.fromSet === a && l.toSet === b) || (l.fromSet === b && l.toSet === a));
  const touch = (a: number, b: number) => sets[a].cells.some((x) => sets[b].cells.some((y) => x === y || besideCell(x, y)));
  for (const k of order) {
    const taken = (near: (a: number, b: number) => boolean) => new Set([...out].filter(([o]) => near(k, o)).map(([, t]) => t));
    const conflicts = taken((a, b) => linked(a, b) || touch(a, b));
    const links = taken(linked);
    out.set(k, TINTS.find((t) => !conflicts.has(t)) ?? TINTS.find((t) => !links.has(t)) ?? 1);
  }
  return out;
}

/**
 * The sets a view draws (docs/hint-drawing-sets.md, decisions 2, 3, 5-8
 * and 17): each set a link drawn reaches, from the frame of the first such
 * link, and each set a frame introduces before that. A group's bar takes
 * its members' mark: they take one mark in every view a chain draws (a
 * node's truth, the pattern's disc, a removal), and where a removal takes
 * some of them, the bar is the removal's. An almost locked set is drawn as
 * its tiles, in its tint
 */
function setMarks(step: Step, links: ChainLink[], introduced: number[], cands: Map<number, Map<number, CandMark>>): SetMark[] {
  const sets = step.sets ?? [];
  const drawn = new Set([...links.flatMap((l) => [l.fromSet, l.toSet]), ...introduced].filter((k): k is number => k !== undefined && !!sets[k]));
  const tints = setTints(step);
  return [...drawn]
    .sort((a, b) => a - b)
    .flatMap((set): SetMark[] => {
      if (sets[set].kind === 'als') return [{ set, style: 'als', tint: tints.get(set)! }];
      const kinds = sets[set].members.map((cd) => cands.get(cd.cell)?.get(cd.digit));
      const style = STYLES.find(([, is]) => kinds.some(is))?.[0];
      return style ? [{ set, style }] : [];
    });
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
      // a solved digit shows a colour the step names, and nothing for a chain's truth or a set's member
      if (kind !== 'true' && kind !== 'false' && kind !== 'oneOf' && kind !== 'member' && (!values.has(cd.cell) || kind === 'elim')) values.set(cd.cell, kind);
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
  // an ALS pattern whose chain clashes draws no truth in any view, and no
  // mark for its nodes: they are its sets' members (decision 13)
  const clash = alsClash(step);
  const truth = derived && !derived.problems.length && !proofOnly && !clash ? derived : null;
  const closed = links.length >= (step.links ?? []).length;
  // a walk frame draws what the links drawn so far prove, never what a
  // later link adds (where sets share a cell, a later set's lock makes a
  // candidate drawn earlier true or false); the full view and the
  // conclusion draw the whole chain's
  const proven = truth && opts.walking && !closed ? deriveLinks(links.filter((l) => !l.undirected)) : truth;
  const truthOf = (cd: CellDigit): 'true' | 'false' | 'oneOf' | null => {
    if (!truth || !proven) return null;
    const isStart = truth.closure?.node.some((o) => o.cell === cd.cell && o.digit === cd.digit);
    if (truth.closure && isStart && !closed) {
      // a group assumed true means one of its members, not all
      if (truth.closure.assumed) return truth.closure.node.length > 1 ? 'oneOf' : 'true';
      return 'false';
    }
    const t = proven.candidates.get(`${cd.cell}:${cd.digit}`);
    return t === 'true' ? 'true' : t === 'false' ? 'false' : t === 'groupTrue' ? 'oneOf' : null;
  };
  const node = (cd: CellDigit) => {
    if (!clash) mark(cd, truthOf(cd) ?? namedRole(step, cd) ?? 'primary');
  };
  if (opts.walking && step.links?.length) {
    // walking a chain: only the nodes of the links drawn so far; a Death
    // Blossom's stem, the candidates its ties come from, from its first frame
    if (show('stem')) for (const l of step.links) if (l.undirected && l.fromSet === undefined) for (const cd of l.from) node(cd);
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
  // the sets the view draws; an almost locked set's candidates the view
  // gives no other mark are its members, the last mark of all (G5): no
  // shape, the digit bold on its tile (docs/hint-drawing-sets.md, decision 10)
  const sets = setMarks(step, links, opts.sets ?? [], cands);
  for (const { set, style } of sets) if (style === 'als') for (const cd of step.sets![set].members) mark(cd, 'member');
  // two true candidates that cannot both be: the premise is impossible
  const trues = [...cands].flatMap(([cell, m]) => [...m].filter(([, k]) => k === 'true').map(([digit]) => ({ cell, digit })));
  const clashing = trues.some((a, i) => trues.slice(i + 1).some((b) => a.cell === b.cell || (a.digit === b.digit && sees(a.cell, b.cell))));
  const refuted = !!truth && ((!!truth.closure && closed) || clashing);
  // a Death Blossom's weak ties, dashed lines with no head, for its legend
  const lines = new Set<LineKind>(links.some((l) => l.undirected && !l.strong && !insideOneCell(l)) ? ['weakTie'] : []);
  return { cands, inside, values, bands, refuted, lines, sets };
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
    walking: !!frame,
    sets: frame?.sets
  });
}

/**
 * The candidates any view of a hint draws as "one of these" squares, as
 * "cell:digit": a square reaches further than a disc at its corners, and
 * the arrows are worked out once for every frame of the walk (G14), so an
 * arrow keeps that far off a candidate the walk draws as a square, though
 * the full view draws it otherwise (a discontinuous loop's start, proven
 * at the end)
 */
export function squareKeys(step: Step, solved: (cell: number) => boolean): Set<string> {
  const out = new Set<string>();
  if (step.truth !== 'derived') return out;
  for (const frame of [null, ...walkFrames(step)]) {
    for (const [cell, m] of frameMarks(step, frame, solved).cands) for (const [digit, kind] of m) if (kind === 'oneOf') out.add(`${cell}:${digit}`);
  }
  return out;
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
  /**
   * the groups' bars drawn, by their members' mark: squares on a bar,
   * rings on a bar, a bar in the pattern's or the removal's ink
   * (docs/hint-drawing-sets.md, decision 18)
   */
  bars: Set<BarStyle>;
  /** "one of these" squares drawn on no bar: the true digit of an almost locked set, several candidates read as one */
  setSquares: boolean;
  /** the tints of the almost locked sets drawn as lettered tiles, lowest first, for the swatch of "lettered cells" (decision 18) */
  tiles: Tint[];
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
  const groups = marks.sets.filter((m): m is SetMark & { style: BarStyle } => m.style !== 'als');
  const bars = new Set(groups.map((m) => m.style));
  const sets = step.sets ?? [];
  const onBar = new Set(groups.flatMap((m) => sets[m.set].members.map((cd) => `${cd.cell}:${cd.digit}`)));
  const setSquares = [...marks.cands].some(([cell, m]) => [...m].some(([digit, k]) => k === 'oneOf' && !onBar.has(`${cell}:${digit}`)));
  const tiles = [...new Set(marks.sets.flatMap((m) => (m.tint ? [m.tint] : [])))].sort((a, b) => a - b);
  return { shown, onValue, onBand, intoRemove, intoPlace, refuted: marks.refuted, clusters, lines: marks.lines, proven, bars, setSquares, tiles };
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
  // 3D Medusa rule 3's brackets hold a cell's two shades and what they
  // remove; rules 1 and 5's, two candidates that cannot both be true
  if (kinds.lines.has('corners')) {
    out.push({
      kind: 'corners',
      label:
        rule === 'medusa3'
          ? tr`corner brackets: a cell holding both shades; one is true, so its other candidates go`
          : tr`corner brackets: two candidates of one cell, at most one true`
    });
  }
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

/**
 * A Death Blossom's view whose gold marks only its stem's candidates, no
 * petal's digit the stem sees drawn yet: its walk's first frame, and the
 * frame that introduces a first petal of several cells before its branch.
 * The legend then names the gold as the stem's candidates alone, since a
 * legend names only what its view draws (docs/hint-drawing-sets.md, "The
 * walk and its words", the legend lines)
 */
export function stemAlone(step: Step, marks: HintMarks): boolean {
  if (step.tech !== 'DEATH_BLOSSOM') return false;
  const stem = step.links?.find((l) => l.undirected && l.fromSet === undefined)?.from[0]?.cell;
  const gold = [...marks.cands].filter(([, m]) => [...m.values()].includes('secondary')).map(([cell]) => cell);
  return gold.length > 0 && gold.every((cell) => cell === stem);
}

/**
 * A cell a view draws in two almost locked sets (docs/hint-drawing-sets.md,
 * decision 6), the first the board's tiles have: the tint of the set whose
 * tile the cell carries, and of the set whose outline is dashed inside it,
 * as the board draws them (src/content/hintGeometry.ts tilesIn), for the
 * legend's entry drawn like it; null when no cell is in two sets the view
 * draws
 */
export function sharedTile(step: Step, marks: HintMarks): { tile: Tint; dashed: Tint } | null {
  const tints = new Map(marks.sets.flatMap((m) => (m.tint ? [[m.set, m.tint] as const] : [])));
  if (tints.size < 2) return null;
  // a tile for each cell of each set, where on the board it lies aside: tilesIn reads only whose cells they are
  const tiles = (step.sets ?? []).flatMap((s, set) => (s.kind === 'als' ? s.cells.map((cell) => ({ set, cell, x0: 0, y0: 0, x1: 0, y1: 0 })) : []));
  const drawn = tilesIn(step, { bars: [], tiles, tabs: [] }, tints.keys());
  const dashed = drawn.find((t) => t.inset > 0);
  const tile = dashed && drawn.find((t) => t.inset === 0 && t.cell === dashed.cell);
  return dashed && tile ? { tile: tints.get(tile.set)!, dashed: tints.get(dashed.set)! } : null;
}
