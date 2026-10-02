/**
 * The generator's promises (docs/generator.md): every puzzle it digs is
 * proper and minimal; a capped rating agrees with a full one wherever it
 * does not stop; the filters mean what they say; and an isomorphism of a
 * puzzle is the same puzzle in every way that matters.
 */
import { describe, it, expect } from 'vitest';
import { parseGrid, gridToString } from '../src/engine/board';
import { countSolutions, solve } from '../src/engine/bruteForce';
import {
  generatePuzzle,
  isMinimal,
  hasSymmetry,
  cruxIndex,
  cruxEmpties,
  clueCount,
  fitForLevel,
  cleanTechniques,
  generateFor,
  hits,
  CRUX_MIN_EMPTIES, practiceCeiling, limitFor } from '../src/engine/generator';
import { ratePuzzle } from '../src/engine/humanSolver';
import { LEVELS, TECHS, Tech } from '../src/engine/ratings';
import { applyIsomorphism, randomIsomorphism, transformPuzzle, IDENTITY } from '../src/engine/transform';

describe('digging', () => {
  it('leaves a proper puzzle in which every clue is needed', () => {
    for (let i = 0; i < 12; i++) {
      const g = generatePuzzle('none');
      expect(countSolutions(g, 2)).toBe(1);
      expect(isMinimal(g)).toBe(true);
    }
  });

  it('with symmetry, leaves a symmetric proper puzzle that is minimal as pairs', () => {
    let spare = 0;
    for (let i = 0; i < 12; i++) {
      const g = generatePuzzle('rotational');
      expect(countSolutions(g, 2)).toBe(1);
      expect(hasSymmetry(g, 'rotational')).toBe(true);
      expect(isMinimal(g, 'rotational')).toBe(true);
      // by hand: no pair can go
      const s = gridToString(g);
      for (let c = 0; c <= 40; c++) {
        if (s[c] === '.') continue;
        const chars = s.split('');
        chars[c] = '.';
        chars[80 - c] = '.';
        expect(countSolutions(parseGrid(chars.join(''))!, 2), `pair ${c}`).toBe(2);
      }
      if (!isMinimal(g)) spare++;
    }
    // which is weaker than minimal: most symmetric puzzles keep a clue
    // that only the symmetry needs (docs/generator.md)
    expect(spare).toBeGreaterThan(0);
  });

  it('isMinimal tells a spare clue from a needed one', () => {
    const g = generatePuzzle('none');
    expect(isMinimal(g)).toBe(true);
    // put one solved digit back: now that clue is spare
    const sol = solve(g)!;
    const s = gridToString(g);
    const empty = s.indexOf('.');
    const chars = s.split('');
    chars[empty] = String(sol.values[empty]);
    expect(isMinimal(parseGrid(chars.join(''))!)).toBe(false);
  });
});

describe('capped rating', () => {
  it('agrees with the full rating whenever it does not stop, and stops only past the cap', () => {
    let stopped = 0;
    let kept = 0;
    for (let i = 0; i < 40; i++) {
      const g = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const full = ratePuzzle(g)!;
      for (const level of LEVELS) {
        const capped = ratePuzzle(g, undefined, { maxLevel: level });
        const over = LEVELS.indexOf(full.level) > LEVELS.indexOf(level);
        if (over) {
          expect(capped, `${full.level} rated under a ${level} cap`).toBeNull();
          stopped++;
        } else {
          expect(capped, `${full.level} rated under a ${level} cap`).not.toBeNull();
          expect(capped!.score).toBe(full.score);
          expect(capped!.level).toBe(full.level);
          expect(capped!.steps.length).toBe(full.steps.length);
          kept++;
        }
      }
    }
    expect(stopped).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
  });

  it('for a technique, stops exactly when the technique can no longer come cleanly', () => {
    const techs: Tech[] = ['NAKED_PAIR', 'LOCKED_CANDIDATES_1', 'X_WING', 'XY_WING'];
    let stopped = 0;
    for (let i = 0; i < 40; i++) {
      const g = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const full = ratePuzzle(g)!;
      const clean = cleanTechniques(full);
      for (const tech of techs) {
        const capped = ratePuzzle(g, undefined, { cleanTech: tech });
        // a path on which nothing harder than the technique comes before
        // it (or nothing harder at all) rates in full
        const idx = TECHS[tech].index;
        let harderFirst = false;
        for (const step of full.steps) {
          if (step.tech === tech) break;
          if (TECHS[step.tech].index > idx) {
            harderFirst = true;
            break;
          }
        }
        if (harderFirst) {
          expect(capped, `${tech}: a harder step came first`).toBeNull();
          expect(clean).not.toContain(tech);
          stopped++;
        } else {
          expect(capped, `${tech}: nothing harder first`).not.toBeNull();
          expect(capped!.score).toBe(full.score);
        }
      }
    }
    expect(stopped).toBeGreaterThan(0);
  });
});

describe('filters and targets', () => {
  it('the practice ceiling is one band above the class, and the top for Unfair and above', () => {
    expect(practiceCeiling('FULL_HOUSE')).toBe('Easy');
    expect(practiceCeiling('X_WING')).toBe(LEVELS[LEVELS.indexOf(TECHS.X_WING.level) + 1]);
    expect(practiceCeiling('BUG_PLUS_1')).toBe('Unfair');
    expect(practiceCeiling('AIC')).toBe('Nightmare');
    expect(practiceCeiling('FIREWORKS')).toBe('Nightmare');
    expect(limitFor({ kind: 'tech', tech: 'X_WING' })).toEqual({ cleanTech: 'X_WING', maxLevel: practiceCeiling('X_WING') });
  });

  it('the crux is the first step of the hardest technique, and cruxEmpties counts the empties there', () => {
    const g = generatePuzzle('none');
    const puzzle = gridToString(g);
    const r = ratePuzzle(puzzle)!;
    const hardest = Math.max(...r.steps.map((s) => TECHS[s.tech].index));
    const at = cruxIndex(r.steps);
    expect(TECHS[r.steps[at].tech].index).toBe(hardest);
    expect(r.steps.findIndex((s) => TECHS[s.tech].index === hardest)).toBe(at);
    expect(cruxIndex([])).toBe(-1);
    // replay to the crux and count by hand
    let empties = 81 - clueCount(puzzle);
    for (let i = 0; i < at; i++) empties -= r.steps[i].placements.length;
    expect(cruxEmpties(r, clueCount(puzzle))).toBe(empties);
    expect(empties).toBeGreaterThan(0);
    expect(empties).toBeLessThanOrEqual(81 - clueCount(puzzle));
  });

  it('a band puzzle whose crux is BUG+1 does not fit, whatever the empties', () => {
    // a singles-only path with its first step relabelled: BUG+1 is then the
    // hardest technique, met with the whole board still open
    const res = generateFor({ kind: 'level', level: 'Beginner' }, 100)!;
    const r = res.rating;
    const bug = { ...r, steps: r.steps.map((s, i) => (i === 0 ? { ...s, tech: 'BUG_PLUS_1' as const } : s)) };
    expect(cruxIndex(bug.steps)).toBe(0);
    expect(cruxEmpties(bug, clueCount(res.puzzle))).toBeGreaterThanOrEqual(CRUX_MIN_EMPTIES);
    expect(fitForLevel(res.puzzle, r)).toBe(true);
    expect(fitForLevel(res.puzzle, bug)).toBe(false);
  });

  it('a generated puzzle for a band is in the band and passes the filters', () => {
    for (const level of ['Beginner', 'Medium', 'Hard'] as const) {
      const res = generateFor({ kind: 'level', level }, 400);
      expect(res, level).not.toBeNull();
      expect(res!.rating.level).toBe(level);
      expect(fitForLevel(res!.puzzle, res!.rating)).toBe(true);
      expect(cruxEmpties(res!.rating, clueCount(res!.puzzle))).toBeGreaterThanOrEqual(CRUX_MIN_EMPTIES);
      // and the rating reproduces from the string, uncapped
      const again = ratePuzzle(res!.puzzle)!;
      expect(again.score).toBe(res!.rating.score);
      expect(again.level).toBe(level);
    }
  });

  it('a generated puzzle for a technique needs it with nothing harder first', () => {
    const res = generateFor({ kind: 'tech', tech: 'NAKED_PAIR' }, 400);
    expect(res).not.toBeNull();
    expect(cleanTechniques(res!.rating)).toContain('NAKED_PAIR');
    expect(hits({ kind: 'tech', tech: 'NAKED_PAIR' }, res!.puzzle, res!.rating)).toBe(true);
  });
});

describe('isomorphisms', () => {
  it('the identity changes nothing', () => {
    const p = gridToString(generatePuzzle('none'));
    expect(applyIsomorphism(p, IDENTITY)).toBe(p);
  });

  it('map the solution with the puzzle, and keep it proper and minimal', () => {
    for (let i = 0; i < 8; i++) {
      const g = generatePuzzle(i % 2 ? 'rotational' : 'none');
      const p = gridToString(g);
      const sol = gridToString(solve(g)!);
      const iso = randomIsomorphism();
      const q = applyIsomorphism(p, iso);
      expect(clueCount(q)).toBe(clueCount(p));
      const qg = parseGrid(q)!;
      expect(countSolutions(qg, 2)).toBe(1);
      expect(gridToString(solve(qg)!)).toBe(applyIsomorphism(sol, iso));
      if (i % 2 === 0) expect(isMinimal(qg)).toBe(true);
    }
  });

  it('a random isomorph is almost never the puzzle itself', () => {
    const p = gridToString(generatePuzzle('none'));
    const same = Array.from({ length: 20 }, () => transformPuzzle(p)).filter((q) => q === p);
    expect(same.length).toBe(0);
  });
});
