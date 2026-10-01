/**
 * The worked examples shown in the guide are stored data, so they are held
 * to the engine: every stored position and step must be exactly what the
 * solver produces from the example's puzzle today. If a finder or one of
 * its descriptions changes, this fails until the examples are re-derived:
 *
 *   npx vite-node scripts/hunt-examples.ts refresh
 */
import { describe, it, expect } from 'vitest';
import { Grid, parseGrid, bit } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { ratePuzzle, applyStep } from '../src/engine/humanSolver';
import { TECHS, Tech } from '../src/engine/ratings';
import { cleanTechniques } from '../src/engine/generator';
import { EXAMPLES } from '../src/content/examples';
import { boardSvg } from '../src/content/boardSvg';
import { buildLearnAssets } from '../src/content/learnPages';

const techs = Object.keys(EXAMPLES) as Tech[];

describe('worked examples', () => {
  it('cover most of the catalogue', () => {
    // rare patterns may never turn up in a hunt; the common ones must
    expect(techs.length).toBeGreaterThanOrEqual(40);
    for (const must of ['NAKED_SINGLE', 'HIDDEN_SINGLE', 'NAKED_PAIR', 'X_WING', 'XY_WING', 'SKYSCRAPER'] as Tech[]) {
      expect(techs, must).toContain(must);
    }
  });

  for (const tech of techs) {
    it(`${tech}: is what the engine does with this puzzle`, { timeout: 120_000 }, () => {
      const ex = EXAMPLES[tech]!;
      expect(ex.puzzle).toMatch(/^[0-9.]{81}$/);
      if (ex.credit !== undefined) expect(ex.credit.trim()).not.toBe('');
      const rating = ratePuzzle(ex.puzzle)!;
      expect(rating, 'puzzle must be valid').not.toBeNull();
      expect(rating.solvable, 'solved by techniques alone').toBe(true);

      // the stored step is the solver's own step at that index...
      expect(rating.steps[ex.stepIndex].tech).toBe(tech);
      expect(rating.steps.findIndex((s) => s.tech === tech), 'its first occurrence').toBe(ex.stepIndex);
      expect(JSON.parse(JSON.stringify(rating.steps[ex.stepIndex]))).toEqual(ex.step);
      // ...reached without anything harder before it (singles are the
      // floor of every puzzle, so their order among themselves is free),
      // unless it says so: the rarest techniques have no clean position
      if (TECHS[tech].category !== 'Singles') {
        if (ex.afterHarder) expect(cleanTechniques(rating), 'honest about harder steps').not.toContain(tech);
        else expect(cleanTechniques(rating)).toContain(tech);
      }

      // the stored position is the solver's position just before that step
      const g = parseGrid(ex.puzzle) as Grid;
      for (let i = 0; i < ex.stepIndex; i++) applyStep(g, rating.steps[i]);
      expect(Array.from(g.values).join('')).toBe(ex.values);
      expect(Array.from(g.cands).map((c, i) => (g.values[i] ? 0 : c))).toEqual(ex.cands);

      // and the step is sound against the true solution
      const solution = solve(parseGrid(ex.puzzle) as Grid)!;
      for (const { cell, digit } of ex.step.placements) expect(solution.values[cell]).toBe(digit);
      for (const { cell, digit } of ex.step.eliminations) expect(solution.values[cell]).not.toBe(digit);

      // everything the diagram highlights is really on the board
      const marked = [
        ...(ex.step.primary ?? []),
        ...(ex.step.secondary ?? []),
        ...(ex.step.fins ?? []),
        ...ex.step.eliminations,
        ...ex.step.placements,
        ...(ex.step.links ?? []).flatMap((l) => [...l.from, ...l.to])
      ];
      for (const { cell, digit } of marked) {
        expect(ex.values[cell], `${TECHS[tech].name}: marked cell is empty`).toBe('0');
        expect((ex.cands[cell] & bit(digit)) !== 0, `${TECHS[tech].name}: marked candidate exists`).toBe(true);
      }
    });
  }

  it('draw as well-formed SVG, one marker per highlighted candidate', () => {
    for (const tech of techs) {
      const ex = EXAMPLES[tech]!;
      const svg = boardSvg(ex, `${TECHS[tech].name} example`);
      expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      expect(svg.trim().endsWith('</svg>')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
      const marked = new Set(
        [
          ...(ex.step.primary ?? []),
          ...(ex.step.secondary ?? []),
          ...(ex.step.fins ?? []),
          ...ex.step.eliminations,
          ...ex.step.placements,
          ...(ex.step.links ?? []).flatMap((l) => [...l.from, ...l.to])
        ].map((cd) => `${cd.cell}:${cd.digit}`)
      );
      expect((svg.match(/<circle /g) ?? []).length, tech).toBe(marked.size);
      expect((svg.match(/<path d="[^"]+" fill="none"/g) ?? []).length, tech).toBe(
        ex.step.links?.length ?? 0
      );
      const givens = ex.puzzle.replace(/[^1-9]/g, '').length;
      expect((svg.match(/class="giv"/g) ?? []).length, tech).toBe(givens);
    }
  });

  it('ship one diagram per example', () => {
    // the Intuition guide's schematic diagrams ship alongside (tests/intuition.test.ts)
    const assets = buildLearnAssets().filter((a) => !a.path.startsWith('learn/img/intuition-'));
    expect(assets).toHaveLength(techs.length);
    for (const a of assets) expect(a.path).toMatch(/^learn\/img\/[a-z0-9-]+\.svg$/);
  });
});
