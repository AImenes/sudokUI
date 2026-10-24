// What a hint marks where (docs/hint-drawing.md G1-G5, G22), worked out once
// for the app's board (src/ui/Grid.tsx), the Learn diagrams
// (src/content/boardSvg.ts) and both legends, so a legend never names a
// colour the board does not show.
//
// One mark per candidate. The first kind a candidate is given wins, except
// that a removal wins over everything and a placement over everything but
// a removal. A chain node takes the colour the step names for it, the
// pattern's when it names none. A solved cell the step names shows the
// colour on its digit. A colouring's removal keeps, inside its ring, the
// colour the step names for it, so a colour wholly removed is still there
// to be read; a colour only the chain default gave it is never shown.
import type { CellDigit, ChainLink, Step } from '../engine/steps';
import type { Part } from '../engine/hintFrames';

export type Role = 'primary' | 'secondary' | 'fin';
export type CandMark = Role | 'place' | 'elim' | 'elimOn';

export interface HintMarks {
  /** a candidate's mark: cell -> digit -> kind */
  cands: Map<number, Map<number, CandMark>>;
  /** what a colouring's removal holds inside its ring */
  inside: Map<number, Map<number, Role>>;
  /** a solved cell's colour, on its digit */
  values: Map<number, CandMark>;
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

/** the colour the step names for a candidate, if any */
export function namedRole(step: Step, cd: CellDigit): Role | null {
  return has(step.fins, cd) ? 'fin' : has(step.secondary, cd) ? 'secondary' : has(step.primary, cd) ? 'primary' : null;
}

export function hintMarks(step: Step, opts: MarkOptions): HintMarks {
  const cands = new Map<number, Map<number, CandMark>>();
  const inside = new Map<number, Map<number, Role>>();
  const values = new Map<number, CandMark>();
  const show = opts.show ?? (() => true);
  const links = opts.links ?? step.links ?? [];
  const mark = (cd: CellDigit, kind: CandMark) => {
    if (opts.solved(cd.cell)) {
      if (!values.has(cd.cell) || kind === 'elim') values.set(cd.cell, kind);
      return;
    }
    if (!cands.has(cd.cell)) cands.set(cd.cell, new Map());
    const m = cands.get(cd.cell)!;
    const prev = m.get(cd.digit);
    if (!prev || kind === 'elim' || (kind === 'place' && prev !== 'elim')) m.set(cd.digit, kind);
  };
  const node = (cd: CellDigit) => mark(cd, namedRole(step, cd) ?? 'primary');
  if (opts.walking && step.links?.length) {
    // walking a chain: only the nodes of the links drawn so far
    for (const l of links) for (const cd of [...l.from, ...l.to]) node(cd);
  } else {
    if (show('primary')) for (const cd of step.primary ?? []) mark(cd, 'primary');
    if (show('secondary')) for (const cd of step.secondary ?? []) mark(cd, 'secondary');
    // every chain node gets a mark, so arrows root on one
    for (const l of links) for (const cd of [...l.from, ...l.to]) node(cd);
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
    if (COLOURING.has(step.tech)) {
      for (const cd of step.eliminations) {
        const colour = namedRole(step, cd);
        if (!colour || opts.solved(cd.cell)) continue;
        cands.get(cd.cell)!.set(cd.digit, 'elimOn');
        if (!inside.has(cd.cell)) inside.set(cd.cell, new Map());
        inside.get(cd.cell)!.set(cd.digit, colour);
      }
    }
  }
  return { cands, inside, values };
}

/** every candidate the marks hold, for the arrows to bend round */
export const markedCandidates = (marks: HintMarks): CellDigit[] =>
  [...marks.cands].flatMap(([cell, m]) => [...m.keys()].map((digit) => ({ cell, digit })));

/**
 * What a legend shows (G22): the kinds the board draws, a role's band
 * counting for its role; the kinds drawn only on solved digits, whose
 * swatch is then the digit's rounded outline; and the roles the step names
 * whose every candidate was drawn as a removal or a placement, whose words
 * then belong to that entry ("remove: the cell that would complete the
 * rectangle")
 */
export function legendKinds(
  step: Step,
  marks: HintMarks
): { shown: Set<CandMark>; onValue: Set<CandMark>; intoRemove: Role[]; intoPlace: Role[] } {
  const shown = new Set<CandMark>();
  for (const m of marks.cands.values()) for (const k of m.values()) shown.add(k === 'elimOn' ? 'elim' : k);
  for (const k of marks.inside.values()) for (const r of k.values()) shown.add(r);
  for (const u of step.units ?? []) shown.add(u.role);
  const onValue = new Set<CandMark>();
  for (const k of marks.values.values()) {
    const kind = k === 'elimOn' ? 'elim' : k;
    if (!shown.has(kind)) onValue.add(kind);
  }
  for (const k of onValue) shown.add(k);
  const intoRemove: Role[] = [];
  const intoPlace: Role[] = [];
  const lists: [Role, CellDigit[] | undefined][] = [['primary', step.primary], ['secondary', step.secondary], ['fin', step.fins]];
  for (const [role, list] of lists) {
    if (!list?.length || shown.has(role)) continue;
    const kindOf = (cd: CellDigit) => marks.cands.get(cd.cell)?.get(cd.digit) ?? marks.values.get(cd.cell);
    if (list.every((cd) => kindOf(cd) === 'elim' || kindOf(cd) === 'elimOn')) intoRemove.push(role);
    else if (list.every((cd) => kindOf(cd) === 'place')) intoPlace.push(role);
  }
  return { shown, onValue, intoRemove, intoPlace };
}
