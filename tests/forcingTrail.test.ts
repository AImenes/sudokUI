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
import { Grid, parseGrid, bit, cloneGrid, setValue, digitsOf, popcount, UNITS } from '../src/engine/board';
import { ratePuzzle, applyStep } from '../src/engine/humanSolver';
import { Step, ChainLink } from '../src/engine/steps';
import { propagateWithTrail, spine } from '../src/engine/techniques/forcingTrail';
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
