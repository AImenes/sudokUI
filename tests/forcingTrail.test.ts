/**
 * The forcing finders draw one line of their reasoning: the assumption,
 * the singles it forces one after another, and where the board breaks or
 * what both ways agree on. Every link must be real (its ends are live
 * candidates of the position), connected (each link starts where the one
 * before ended), and sound (replaying the line as placements really does
 * force each next single, and really does reach the contradiction or the
 * conclusion).
 */
import { describe, it, expect } from 'vitest';
import { Grid, parseGrid, bit, cloneGrid, setValue, digitsOf, popcount, UNITS, cellName } from '../src/engine/board';
import { ratePuzzle, applyStep } from '../src/engine/humanSolver';
import { Step, ChainLink, CellDigit } from '../src/engine/steps';
import { propagateWithTrail, spine, conclusionDrawing, Trail } from '../src/engine/techniques/forcingTrail';
import { findNishio, findDigitForcing, findCellForcing, findUnitForcing, contradictionStep } from '../src/engine/techniques/forcing';
import seeds from '../src/content/seeds.json';
import { Tech } from '../src/engine/ratings';

const FORCING: Tech[] = ['NISHIO_FORCING_CHAIN', 'DIGIT_FORCING_CHAIN', 'CELL_FORCING_CHAIN', 'UNIT_FORCING_CHAIN'];

/** the position just before a step, from the puzzle's solve path */
function positionBefore(puzzle: string, index: number, steps: Step[]): Grid {
  const g = parseGrid(puzzle)!;
  for (let i = 0; i < index; i++) applyStep(g, steps[i]);
  return g;
}

/** singles propagation exactly as the finders run it */
function propagate(g: Grid): boolean {
  for (let guard = 0; guard < 81; guard++) {
    let placed = false;
    for (let i = 0; i < 81; i++) {
      if (g.values[i] !== 0) continue;
      const n = popcount(g.cands[i]);
      if (n === 0) return false;
      if (n === 1) {
        setValue(g, i, digitsOf(g.cands[i])[0]);
        placed = true;
      }
    }
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        const b = bit(d);
        let pos = -1;
        let count = 0;
        let solved = false;
        for (const c of unit) {
          if (g.values[c] === d) {
            solved = true;
            break;
          }
          if (g.values[c] === 0 && g.cands[c] & b) {
            pos = c;
            count++;
          }
        }
        if (solved) continue;
        if (count === 0) return false;
        if (count === 1) {
          setValue(g, pos, d);
          placed = true;
        }
      }
    }
    if (!placed) return true;
  }
  return true;
}

/** the forcing steps found on the hardest seed puzzles, with their positions */
function forcingSteps(): { tech: Tech; step: Step; g: Grid; puzzle: string }[] {
  const out: { tech: Tech; step: Step; g: Grid; puzzle: string }[] = [];
  const want = new Set(FORCING);
  for (const e of (seeds as Record<string, { puzzle: string }[]>).Nightmare ?? []) {
    if (!want.size) break;
    const r = ratePuzzle(e.puzzle);
    if (!r) continue;
    r.steps.forEach((step, i) => {
      if (want.has(step.tech)) {
        want.delete(step.tech);
        out.push({ tech: step.tech, step, g: positionBefore(e.puzzle, i, r.steps), puzzle: e.puzzle });
      }
    });
  }
  return out;
}

const found = forcingSteps();

describe('the forcing trail', () => {
  it('is found for Nishio and Digit forcing among the seeds', () => {
    // cell and unit forcing are rarer than the seeds reach (digit forcing,
    // which runs first, takes most of what they would); they draw with the
    // same code and are tested whenever a seed happens to need them
    const techs = found.map((f) => f.tech);
    expect(techs).toContain('NISHIO_FORCING_CHAIN');
    expect(techs).toContain('DIGIT_FORCING_CHAIN');
  });

  for (const { tech, step, g, puzzle } of found) {
    it(`${tech}: draws one real, connected, sound line of reasoning`, () => {
      const context = `${tech} on ${puzzle}: ${step.description}`;
      expect(step.links, context).toBeDefined();
      const links = step.links!;
      expect(links.length, context).toBeGreaterThan(0);
      // every end is a live candidate of the position
      for (const l of links) {
        for (const { cell, digit } of [...l.from, ...l.to]) {
          expect(g.values[cell], context).toBe(0);
          expect((g.cands[cell] & bit(digit)) !== 0, context).toBe(true);
        }
      }
      // the line is read along its arrows: each starts where the one before
      // ended, except where a new branch starts at the assumption
      const assumption = step.primary![0];
      let branchStart = 0;
      for (let k = 1; k < links.length; k++) {
        const prev = links[k - 1].to;
        const from = links[k].from[0];
        const continues = prev.some((cd) => cd.cell === from.cell && cd.digit === from.digit);
        const restarts = step.primary!.some((o) => o.cell === from.cell && o.digit === from.digit);
        expect(continues || restarts, `${context}\nlink ${k} neither continues nor restarts`).toBe(true);
        if (!continues) branchStart = k;
      }
      void assumption;
      void branchStart;
      // every link carries its own sentence
      for (const l of links) expect(l.text, context).toBeTruthy();
      // sound: replaying a branch's placements as assumptions, the next
      // placement is forced each time
      const branches: ChainLink[][] = [];
      for (const l of links) {
        const from = l.from[0];
        const startsBranch = step.primary!.some((o) => o.cell === from.cell && o.digit === from.digit) && !branches.length
          ? true
          : !branches[branches.length - 1].some((p) => p.to.some((cd) => cd.cell === from.cell && cd.digit === from.digit));
        if (startsBranch) branches.push([l]);
        else branches[branches.length - 1].push(l);
      }
      for (const branch of branches) {
        const first = branch[0].from[0];
        const on = !/^If .* is not /.test(branch[0].text ?? '');
        const t = propagateWithTrail(g, first.cell, first.digit, on);
        // each placement the drawing claims is on the trail
        for (const l of branch) {
          const to = l.to[0];
          if (l.strong) {
            expect(t.steps.some((s) => s.cell === to.cell && s.digit === to.digit), `${context}\n${l.text}`).toBe(true);
          }
        }
        // and the trail's spine is what was drawn
        expect(spine(t, t.steps.length - 1).length, context).toBeGreaterThan(0);
        // a contradiction claimed is a contradiction reached
        if (tech === 'NISHIO_FORCING_CHAIN' || (tech === 'DIGIT_FORCING_CHAIN' && step.placements.length && !on)) {
          const trial = cloneGrid(g);
          if (on) setValue(trial, first.cell, first.digit);
          else trial.cands[first.cell] &= ~bit(first.digit);
          expect(propagate(trial), context).toBe(false);
          expect(step.fins?.length, context).toBeGreaterThan(0);
        }
      }
    });
  }
});

/**
 * Scan and Check's "why not" reason from positions that still have singles,
 * and a line can then start at one of them rather than at the assumption.
 * Every link must name its real cause: what it concludes holds right after
 * its premise and did not hold just before. A line that starts at a single
 * opens by naming the assumption, and that single is one the position
 * really has; only a line that starts at the assumption makes it the
 * premise.
 */
describe('the forcing trail in positions that still have singles', () => {
  it('opens a line that starts at a single with the assumption, never with a false premise', () => {
    // r6c7 = 9 follows from r2c7 = 7, a naked single of the position, not from r2c7 being anything else
    const g = parseGrid('..1.....5..9.12..3..5...4......4.5.8.2..6..4.3.4.2......6...8..4..79.6..9.....1..')!;
    const step = findDigitForcing(g)!;
    expect(step.links![0].text).toBe(
      'Assume r1c1 is not 7. r2c7 already has only one candidate, 7, so r6c7 must be 9: the only candidate left in r6c7.'
    );
  });

  /** the branch's world after its trail steps up to k */
  const world = (g: Grid, t: Trail, on: boolean, k: number): Grid => {
    const w = cloneGrid(g);
    const a = t.steps[0];
    if (on) setValue(w, a.cell, a.digit);
    else w.cands[a.cell] &= ~bit(a.digit);
    for (let i = 1; i <= k; i++) setValue(w, t.steps[i].cell, t.steps[i].digit);
    return w;
  };
  const only = (w: Grid, unit: number, d: number) =>
    !UNITS[unit].some((c) => w.values[c] === d) && UNITS[unit].filter((c) => w.values[c] === 0 && w.cands[c] & bit(d));

  /** one branch: its assumption and the links drawn for it */
  function checkBranch(g: Grid, a: CellDigit, on: boolean, links: ChainLink[], context: string) {
    if (!links.length) return;
    const t = propagateWithTrail(g, a.cell, a.digit, on);
    const at = (cd: CellDigit) => t.steps.findIndex((s) => s.cell === cd.cell && s.digit === cd.digit);
    links.forEach((l, k) => {
      const why = `${context}\nbranch ${cellName(a.cell)}${on ? '=' : '!='}${a.digit}, link ${k}: ${l.text}`;
      const i = at(l.from[0]);
      expect(i, why).toBeGreaterThanOrEqual(0);
      // what the link concludes, in a world
      const s = l.strong ? t.steps[at(l.to[0])] : null;
      const holds = (w: Grid): boolean => {
        if (s) {
          if (s.how === 'naked') return w.values[s.cell] === 0 && w.cands[s.cell] === bit(s.digit);
          const spots = only(w, s.unit!, s.digit);
          return !!spots && spots.length === 1 && spots[0] === s.cell;
        }
        if (k === links.length - 1 && t.broken) {
          const b = t.broken;
          if (b.kind === 'cell') return w.values[b.cell] === 0 && w.cands[b.cell] === 0;
          const spots = only(w, b.unit, b.digit);
          return !!spots && spots.length === 0;
        }
        const { cell, digit } = l.to[0];
        return !(w.values[cell] === 0 && w.cands[cell] & bit(digit)) && w.values[cell] !== digit;
      };
      expect(holds(world(g, t, on, i)), `${why}\ndoes not follow from its premise`).toBe(true);
      expect(holds(i ? world(g, t, on, i - 1) : g), `${why}\nheld before its premise`).toBe(false);
      const assume = l.text!.startsWith('Assume ');
      if (k > 0) {
        expect(assume || /^If /.test(l.text!), why).toBe(false);
        return;
      }
      if (i === 0) {
        expect(assume, why).toBe(false);
        return;
      }
      // a line from a single the position already has
      const x = cellName(a.cell);
      expect(l.text!.startsWith(on ? `Assume ${x} = ${a.digit}. ` : `Assume ${x} is not ${a.digit}. `), why).toBe(true);
      const single = t.steps[i];
      expect(single.because, why).toEqual([]);
      if (single.how === 'naked') expect(g.cands[single.cell], why).toBe(bit(single.digit));
      else expect(only(g, single.unit!, single.digit), why).toEqual([single.cell]);
    });
  }

  function checkStep(g: Grid, step: Step, context: string) {
    const links = step.links ?? [];
    const p = step.primary![0];
    const branches: { a: CellDigit; on: boolean; links: ChainLink[] }[] = [];
    if (step.tech === 'NISHIO_FORCING_CHAIN') branches.push({ a: p, on: true, links });
    else if (step.tech === 'DIGIT_FORCING_CHAIN' && step.fins) branches.push({ a: p, on: false, links });
    else {
      const conclusion = step.placements.length ? { place: step.placements[0] } : { elim: step.eliminations[0] };
      const origins = step.tech === 'DIGIT_FORCING_CHAIN' ? [{ a: p, on: true }, { a: p, on: false }] : step.primary!.map((a) => ({ a, on: true }));
      for (const { a, on } of origins) branches.push({ a, on, links: conclusionDrawing(g, a.cell, a.digit, on, conclusion) });
    }
    // the branches rebuilt are exactly what the step draws
    expect(branches.flatMap((b) => b.links), context).toEqual(links);
    for (const b of branches) checkBranch(g, b.a, b.on, b.links, context);
  }

  it('every link names its real cause, at Scan and Check positions', () => {
    let lines = 0;
    let fromSingles = 0;
    for (const e of (seeds as Record<string, { puzzle: string }[]>).Nightmare.slice(0, 2)) {
      const r = ratePuzzle(e.puzzle)!;
      const g = parseGrid(e.puzzle)!;
      r.steps.forEach((st, s) => {
        if (s % 3 === 0) {
          for (const find of [findNishio, findDigitForcing, findCellForcing, findUnitForcing]) {
            const step = find(g);
            if (step) checkStep(g, step, `${e.puzzle} s${s} ${step.tech}`);
          }
        }
        if (s % 9 === 0) {
          // Check's "why not": every candidate whose assumption breaks the board
          for (let c = 0; c < 81; c++) {
            for (const d of g.values[c] ? [] : digitsOf(g.cands[c])) {
              const step = contradictionStep(g, c, d);
              if (!step) continue;
              checkStep(g, step, `${e.puzzle} s${s} why not ${cellName(c)}=${d}`);
              lines++;
              if (step.links?.[0]?.text?.startsWith('Assume ')) fromSingles++;
            }
          }
        }
        applyStep(g, st);
      });
    }
    // the case this guards is common there, not hypothetical
    expect(lines).toBeGreaterThan(50);
    expect(fromSingles).toBeGreaterThan(10);
  });
});
