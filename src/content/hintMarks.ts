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
// none, so a walk's frames colour it as the full view does. In a colouring
// a colour is a parity, so a node the step puts in no colour takes none: a
// removal is a removal from the frame that reaches it, anything else a
// plain ring round its digit ('node'), which the legend does not name.
//
// A chain whose truth is derived (src/engine/truth.ts) draws each node as
// what the chain makes it (G2, G18): a filled disc in the true colour, or
// a ring in the false colour, from its first node's premise; that truth
// wins over the roles. A discontinuous loop's start shows its premise
// until the walk reaches the link that closes the loop, and its proven
// value after. A true group means one of its members is true, not all, so
// its members keep the pattern's disc (until phase 4 draws sets as hulls).
// A removed or placed node is the removal or the placement, its truth
// plain from the mark. A solved cell the step names shows the
// colour on its digit. A removal or a placement keeps, inside its ring,
// the colour the step names for it where that colour is a colouring's
// parity or the candidate is one of the chain's own nodes (G5: Nishio's
// assumption, removed, and Digit Forcing's, placed, are still the
// assumption), so a colour wholly removed or placed is still there to be
// read; a colour only the chain default gave it is never shown.
import type { CellDigit, ChainLink, Step, UnitBand } from '../engine/steps';
import type { Frame, Part } from '../engine/hintFrames';
import { deriveTruth } from '../engine/truth';

export type Role = 'primary' | 'secondary' | 'fin';
export type CandMark = Role | 'place' | 'placeOn' | 'elim' | 'elimOn' | 'node' | 'true' | 'false';

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

/** the techniques whose colours are parities a removal still carries */
export const COLOURING = new Set(['SIMPLE_COLORS', 'MULTI_COLORS', 'MEDUSA_3D']);

const has = (list: CellDigit[] | undefined, cd: CellDigit) => !!list?.some((o) => o.cell === cd.cell && o.digit === cd.digit);

/**
 * What a derived chain assumes of its first node: false when it opens with
 * a strong link, true when it opens with a weak one; null for a step whose
 * truth is not derived, or whose derivation finds a fault
 */
export function premiseOf(step: Step): boolean | null {
  const d = deriveTruth(step);
  if (!d || d.problems.length || !d.nodes.length) return null;
  return d.closure ? d.closure.assumed : d.nodes[0].truth;
}

/** the colour the step names for a candidate, if any: the first of the lists the full view marks in order */
export function namedRole(step: Step, cd: CellDigit): Role | null {
  return has(step.primary, cd) ? 'primary' : has(step.secondary, cd) ? 'secondary' : has(step.fins, cd) ? 'fin' : null;
}

export function hintMarks(step: Step, opts: MarkOptions): HintMarks {
  const cands = new Map<number, Map<number, CandMark>>();
  const inside = new Map<number, Map<number, Role>>();
  const values = new Map<number, CandMark>();
  const show = opts.show ?? (() => true);
  const bands = show('units') ? (step.units ?? []) : [];
  const links = opts.links ?? step.links ?? [];
  const mark = (cd: CellDigit, kind: CandMark) => {
    if (opts.solved(cd.cell)) {
      // a solved digit shows a colour the step names, and nothing for a plain node
      if (kind !== 'node' && kind !== 'true' && kind !== 'false' && (!values.has(cd.cell) || kind === 'elim')) values.set(cd.cell, kind);
      return;
    }
    if (!cands.has(cd.cell)) cands.set(cd.cell, new Map());
    const m = cands.get(cd.cell)!;
    const prev = m.get(cd.digit);
    if (!prev || kind === 'elim' || (kind === 'place' && prev !== 'elim')) m.set(cd.digit, kind);
  };
  const colouring = COLOURING.has(step.tech);
  const removed = (cd: CellDigit) => step.eliminations.some((e) => e.cell === cd.cell && e.digit === cd.digit);
  // a derived chain's truth, node by node; a loop's start keeps its premise
  // until the link that closes the loop is drawn
  const derived = deriveTruth(step);
  const truth = derived && !derived.problems.length ? derived : null;
  const closed = links.length >= (step.links ?? []).length;
  const truthOf = (cd: CellDigit): 'true' | 'false' | null => {
    if (!truth) return null;
    const isStart = truth.closure?.node.some((o) => o.cell === cd.cell && o.digit === cd.digit);
    if (truth.closure && isStart && !closed) {
      // a group assumed true means one of its members, not all: the pattern's disc
      if (truth.closure.assumed) return truth.closure.node.length > 1 ? null : 'true';
      return 'false';
    }
    const t = truth.candidates.get(`${cd.cell}:${cd.digit}`);
    return t === 'true' ? 'true' : t === 'false' ? 'false' : null;
  };
  const node = (cd: CellDigit) =>
    mark(cd, truthOf(cd) ?? namedRole(step, cd) ?? (!colouring ? 'primary' : removed(cd) ? 'elim' : 'node'));
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
        if (!colouring && !nodes.has(`${cd.cell}:${cd.digit}`)) continue;
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
  return { cands, inside, values, bands };
}

/**
 * What a hint draws at a walk frame, or in full when there is none: the
 * one call the board and its legend both make, so the legend names what
 * the frame shows (G23)
 */
export function frameMarks(step: Step, frame: Frame | null, solved: (cell: number) => boolean): HintMarks {
  return hintMarks(step, {
    solved,
    links: frame ? (step.links ?? []).slice(0, frame.links) : step.links,
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
): { shown: Set<CandMark>; onValue: Set<CandMark>; onBand: Set<CandMark>; intoRemove: Role[]; intoPlace: Role[] } {
  const shown = new Set<CandMark>();
  for (const m of marks.cands.values())
    for (const k of m.values()) if (k !== 'node') shown.add(k === 'elimOn' ? 'elim' : k === 'placeOn' ? 'place' : k);
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
  return { shown, onValue, onBand, intoRemove, intoPlace };
}
