/**
 * The worked examples shown in the guide are stored data, so they are held
 * to the engine: every stored position and step must be exactly what the
 * solver produces from the example's puzzle today. If a finder or one of
 * its descriptions changes, this fails until the examples are re-derived:
 *
 *   npx vite-node scripts/hunt-examples.ts refresh
 *
 * The guide and the static pages explain an example in the reader's
 * language by having the engine find the step again at the stored
 * position, so that must give the stored step, in every language the same
 * step, only in other words.
 */
import { describe, it, expect } from 'vitest';
import { Grid, parseGrid, bit, cellNames } from '../src/engine/board';
import { solve } from '../src/engine/bruteForce';
import { ratePuzzle, applyStep, findStep } from '../src/engine/humanSolver';
import { TECHS, Tech } from '../src/engine/ratings';
import type { Step } from '../src/engine/steps';
import { isParity, isTie } from '../src/engine/steps';
import { setEngineText, engineLang, unitName } from '../src/engine/text';
import { cleanTechniques } from '../src/engine/generator';
import { EXAMPLES } from '../src/content/examples';
import { boardSvg } from '../src/content/boardSvg';
import { frameMarks } from '../src/content/hintMarks';
import { deriveTruth } from '../src/engine/truth';
import { buildLearnAssets } from '../src/content/learnPages';
import { exampleGrid, exampleStep } from '../src/content/learnLocale';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';

const techs = Object.keys(EXAMPLES) as Tech[];

/** a step as stored: plain data */
const plain = (step: Step | null) => JSON.parse(JSON.stringify(step));
/** what a step does and draws, without its words (description, legend labels, the walk's sentences) */
const deeds = (step: Step | null) =>
  JSON.parse(JSON.stringify(step, (key, value) => (['description', 'labels', 'text'].includes(key) ? undefined : value)));

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
        if (ex.values[cell] !== '0') {
          // a solved cell may be part of a drawing (the digits that force a
          // single, the solved corners of an avoidable rectangle), shown by
          // its own digit and nothing else
          expect(ex.values[cell], `${TECHS[tech].name}: a solved cell is marked with its own digit`).toBe(String(digit));
          continue;
        }
        expect((ex.cands[cell] & bit(digit)) !== 0, `${TECHS[tech].name}: marked candidate exists`).toBe(true);
      }
      // and every band is a real house
      for (const band of ex.step.units ?? []) {
        expect(band.unit).toBeGreaterThanOrEqual(0);
        expect(band.unit).toBeLessThan(27);
      }
    });

    it(`${tech}: is found again at its stored position, the same step in every language`, () => {
      const ex = EXAMPLES[tech]!;
      // English: at the stored position (the test above holds it to the
      // solver's), the technique's finder takes exactly the stored step
      expect(engineLang()).toBe('en');
      expect(plain(findStep(tech, exampleGrid(ex)))).toEqual(ex.step);
      expect(exampleStep(tech, ex)).toBe(ex.step);
      // another language: the finder takes the same step, only its words differ
      for (const [lang, table] of [
        ['nb', engineNb],
        ['es', engineEs]
      ] as const) {
        setEngineText(lang, table);
        try {
          const step = findStep(tech, exampleGrid(ex));
          expect(step, `${lang}: found`).not.toBeNull();
          expect(deeds(step), lang).toEqual(deeds(ex.step));
          expect(deeds(exampleStep(tech, ex)), lang).toEqual(deeds(ex.step));
        } finally {
          setEngineText('en', null);
        }
      }
    });
  }

  it('draw as well-formed SVG, one marker per highlighted candidate', () => {
    for (const tech of techs) {
      const ex = EXAMPLES[tech]!;
      const whole = boardSvg(ex, `${TECHS[tech].name} example`);
      expect(whole.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
      // the digits cut out of the arrows, drawn again in the mask: once, when there are lines
      const mask = whole.match(/<mask [\s\S]*?<\/mask>/)?.[0] ?? '';
      const svg = whole.replace(/<mask [\s\S]*?<\/mask>/, '');
      const lines = (svg.match(/<path d="[^"]+" fill="none"/g) ?? []).length;
      expect((whole.match(/<mask /g) ?? []).length, tech).toBe(lines ? 1 : 0);
      // and every head painted back, white, after the digits, so no head is cut
      const heads = [...svg.matchAll(/<polygon points="([^"]+)" fill="#151a24"\/>/g)].map((m) => m[1]);
      const back = [...mask.matchAll(/<polygon points="([^"]+)" fill="#ffffff"/g)].map((m) => m[1]);
      expect(back, tech).toEqual(heads);
      if (heads.length) expect(mask.indexOf('<polygon'), tech).toBeGreaterThan(mask.indexOf('</g>'));
      expect(svg.trim().endsWith('</svg>')).toBe(true);
      expect(svg).not.toMatch(/NaN|undefined/);
      // one mark per highlighted candidate of an empty cell (a solved cell
      // shows its colour on the digit; docs/hint-drawing.md G1-G5): a disc
      // for a role, a disc and an outer ring for a placement, a tinted ring
      // for a removal (a chain node's removal fills its ring with the colour
      // it carried), and a bar over each removed digit; a colouring's every
      // coloured candidate, a disc in its shade or a true disc, or the
      // removal its colour is proven to be, and the ends of its weak ties
      const key = (cd: { cell: number; digit: number }) => `${cd.cell}:${cd.digit}`;
      const empty = (cd: { cell: number }) => ex.values[cd.cell] === '0';
      const parity = isParity(ex.step);
      // the links the full view draws: a colouring's weak ties, not its ties
      const links = (ex.step.links ?? []).filter((l) => !parity || !isTie(l));
      const marked = new Set(
        [
          ...(ex.step.primary ?? []),
          ...(ex.step.secondary ?? []),
          ...(ex.step.fins ?? []),
          ...(ex.step.colouring?.clusters ?? []).flatMap((cl) => [...cl.dark, ...cl.light]),
          ...ex.step.eliminations,
          ...ex.step.placements,
          ...links.flatMap((l) => [...l.from, ...l.to])
        ]
          .filter(empty)
          .map(key)
      );
      const removed = new Set(ex.step.eliminations.filter(empty).map(key));
      const placed = new Set(ex.step.placements.filter(empty).map(key));
      const named = new Set([...(ex.step.primary ?? []), ...(ex.step.secondary ?? []), ...(ex.step.fins ?? [])].map(key));
      // a removal keeps a named colour inside its ring, one filled ring, on
      // a chain node (Nishio's assumption)
      const nodes = new Set((ex.step.links ?? []).flatMap((l) => [...l.from, ...l.to]).map(key));
      const circlesOf = (k: string) => (removed.has(k) ? (named.has(k) && nodes.has(k) ? 1 : 2) : placed.has(k) ? 2 : 1);
      // a "one of these" square is a rounded square, not a circle; a group's
      // members on its bar keep a keyline, a circle round a ring or a disc and
      // a rounded square round a square (docs/hint-drawing-sets.md, decisions 1 and 2)
      const full = frameMarks(ex.step, null, (c) => ex.values[c] !== '0');
      const kindOf = (k: string) => full.cands.get(Number(k.split(':')[0]))?.get(Number(k.split(':')[1]));
      const squares = [...marked].filter((k) => kindOf(k) === 'oneOf');
      const groups = full.sets.filter((x) => x.style !== 'als');
      const onBar = new Set(groups.flatMap(({ set }) => ex.step.sets![set].members.map(key)));
      expect((svg.match(/<rect class="sq" /g) ?? []).length, tech).toBe(squares.length);
      expect((svg.match(/<rect class="kl" /g) ?? []).length, tech).toBe(squares.filter((k) => onBar.has(k)).length);
      expect((svg.match(/<circle class="kl" /g) ?? []).length, tech).toBe([...onBar].filter((k) => kindOf(k) !== 'oneOf').length);
      // one bar per group the full view draws
      expect((svg.match(/<line class="gb" /g) ?? []).length, tech).toBe(groups.length);
      // an almost locked set: a tile in each of its cells, filled and
      // outlined, a cell in two sets the smaller's tile and the other's
      // outline dashed; a tab with its keyline and its letter on each
      // (docs/hint-drawing-sets.md, decisions 5-7); its members drawn as
      // their digits alone, bold in the ring's ink
      const lettered = full.sets.filter((x) => x.style === 'als').map(({ set }) => ex.step.sets![set]);
      const tiles = lettered.flatMap((set) => set.cells);
      expect((svg.match(/<rect class="to" /g) ?? []).length, tech).toBe(tiles.length);
      expect((svg.match(/<rect class="tl" /g) ?? []).length, tech).toBe(new Set(tiles).size);
      expect((svg.match(/<rect class="tb" /g) ?? []).length, tech).toBe(tiles.length);
      expect((svg.match(/<rect class="tk" /g) ?? []).length, tech).toBe(tiles.length);
      expect([...svg.matchAll(/<text [^>]*class="tab">([A-D])<\/text>/g)].map((m) => m[1]).sort(), tech).toEqual(lettered.flatMap((set) => set.cells.map(() => set.letter!)).sort());
      // each tile inside its cell on the diagram's board too, 6 units of a 100-unit cell off its edges, 3 clear of a box line
      for (const t of svg.matchAll(/<rect class="tl" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
        const [x, y, w, h] = t.slice(1).map(Number);
        const [col, row] = [Math.floor((x - 24) / 60), Math.floor((y - 24) / 60)];
        const margin = Math.min(x - (24 + col * 60), y - (24 + row * 60), 24 + (col + 1) * 60 - (x + w), 24 + (row + 1) * 60 - (y + h));
        expect(margin, `${tech}: a tile`).toBeGreaterThanOrEqual(0.06 * 60 - 0.05);
      }
      const members = [...full.cands].flatMap(([cell, m]) => [...m].filter(([, k]) => k === 'member').map(([digit]) => ({ cell, digit })));
      for (const { cell, digit } of members) {
        const x = (24 + (cell % 9) * 60 + (0.22 + ((digit - 1) % 3) * 0.28) * 60).toFixed(1);
        const y = (24 + Math.floor(cell / 9) * 60 + (0.23 + Math.floor((digit - 1) / 3) * 0.28) * 60 + 4.4).toFixed(1);
        expect(svg, `${tech}: the member ${digit} of cell ${cell}`).toContain(`<text x="${x}" y="${y}" class="rm">${digit}</text>`);
      }
      // the arrows: none for a link whose ends share a cell and differ in
      // digit (a switch inside a cell, or a set's change of digit: its
      // marks say it), but a colouring's weak tie there is corner brackets;
      // and a dot beside the first node of each branch that infers
      // something (a cluster of ties has no reading order, a weak tie no
      // direction, and a set's lock draws nothing, so a Death Blossom's
      // branches, a weak tie and a petal's lock, have no dot; a chain goes on
      // through a node it reached, or through another digit of a set it
      // reached)
      const share = (a: { cell: number }[], b: { cell: number }[]) => a.some((x) => b.some((y) => y.cell === x.cell));
      const digits = (node: { digit: number }[]) => [...new Set(node.map((cd) => cd.digit))].sort().join(',');
      const silent = (l: (typeof links)[number]) => !parity && ((share(l.from, l.to) && digits(l.from) !== digits(l.to)) || (l.fromSet !== undefined && l.fromSet === l.toSet));
      const drawn = links.filter((l) => !silent(l));
      let starts = 0;
      let counted = false;
      links.forEach((l, i) => {
        const continues = i > 0 && share(links[i - 1].to, l.from);
        if (!continues) counted = false;
        if (l.undirected || (l.fromSet !== undefined && l.fromSet === l.toSet) || counted) return;
        starts++;
        counted = true;
      });
      const circles = [...marked].filter((k) => kindOf(k) !== 'oneOf').reduce((n, k) => n + circlesOf(k), 0) + starts;
      expect((svg.match(/<circle (?!class="kl")/g) ?? []).length, tech).toBe(circles);
      // the grid's 20 lines, and one bar over each removed candidate
      expect((svg.match(/<line (?!class="gb")/g) ?? []).length, tech).toBe(20 + removed.size);
      // every drawn link twice: a halo under the line
      expect((svg.match(/<path d="[^"]+" fill="none"/g) ?? []).length, tech).toBe(2 * drawn.length);
      const givens = ex.puzzle.replace(/[^1-9]/g, '').length;
      expect((svg.match(/class="giv"/g) ?? []).length, tech).toBe(givens);
    }
  });

  it("name their sets: the set techniques' groups and lettered sets, at each link end, and no other technique any", () => {
    // each set (docs/hint-drawing-sets.md, Data and Per technique): its letter, or a group's kind; its cells, digits and house
    const sets: Record<string, string[]> = {};
    // each link from set to set by name, '·' for a lone candidate
    const ends: Record<string, string[]> = {};
    for (const tech of techs) {
      const { sets: own, links } = EXAMPLES[tech]!.step;
      if (!own) continue;
      const name = (i?: number) => (i === undefined ? '·' : (own[i].letter ?? own[i].kind));
      sets[tech] = own.map((s) => `${name(own.indexOf(s))} ${cellNames(s.cells)} {${s.digits.join('')}} in ${unitName(s.unit)}`);
      ends[tech] = (links ?? []).map((l) => `${name(l.fromSet)}-${name(l.toSet)}`);
    }
    expect(sets).toEqual({
      GROUPED_X_CYCLES: ['group r2c4, r3c4 {2} in column 4'],
      // decision 22's swaps: a TRUE end group, and a false and a true group of three on the same cells
      GROUPED_NICE_LOOP: ['group r1c9, r2c9, r3c9 {9} in column 9', 'group r1c9, r2c9, r3c9 {7} in column 9'],
      ALS_XZ: ['A r8c2, r9c1 {159} in box 7', 'B r7c8, r8c9 {159} in box 9'],
      ALS_XY_WING: ['A r8c3, r8c8 {247} in row 8', 'B r4c9, r6c8 {467} in box 6', 'C r6c3 {46} in row 6'],
      ALS_XY_CHAIN: ['A r4c2, r4c7 {469} in row 4', 'B r1c7 {39} in row 1', 'C r1c5, r1c6 {239} in row 1', 'D r7c5 {49} in row 7'],
      AIC_GROUPED: ['group r8c6, r9c6 {8} in column 6'],
      AIC_ALS: ['A r7c8, r8c8 {489} in column 8'],
      DEATH_BLOSSOM: ['A r9c7 {24} in row 9', 'B r8c5, r9c6 {145} in box 8', 'C r8c1 {47} in row 8']
    });
    expect(ends).toEqual({
      GROUPED_X_CYCLES: ['·-·', '·-group', 'group-·', '·-·', '·-·', '·-·'],
      GROUPED_NICE_LOOP: ['·-·', '·-group', 'group-·', '·-·', '·-·', '·-·', '·-group', 'group-·'],
      // the chains they derive (decision 11): each set's lock inside it, and
      // the restricted commons between them, A's 1 to B's; the wing A's to
      // the hinge C, and the hinge's to the wing B
      ALS_XZ: ['A-A', 'A-B', 'B-B'],
      ALS_XY_WING: ['A-A', 'A-C', 'C-C', 'C-B', 'B-B'],
      ALS_XY_CHAIN: ['A-A', 'A-B', 'B-B', 'B-C', 'C-C', 'C-D', 'D-D'],
      AIC_GROUPED: ['·-·', '·-·', '·-·', '·-·', '·-·', '·-·', '·-group'],
      // into set A on 8, inside it from 8 to 9, out of it on 9
      AIC_ALS: ['·-·', '·-A', 'A-A', 'A-·', '·-·'],
      // the stem is no set: a weak tie from it into each petal, and the petal's lock (decision 15)
      DEATH_BLOSSOM: ['·-A', 'A-A', '·-B', 'B-B', '·-C', 'C-C']
    });
  });

  it("explain the ALS patterns' and Death Blossom's removals with the board's letters, so the Learn page needs no walk (docs/hint-drawing-sets.md, decision 22)", () => {
    expect(EXAMPLES.ALS_XZ!.step.description).toBe(
      'ALS-XZ: sets A (r8c2, r9c1) and B (r7c8, r8c9) each hold one digit more than they have cells, and every 1 of A sees every 1 of B, so at most one of them keeps a 1. The other loses its 1, its other digits fill its cells, and it holds a 5: A or B holds a 5, so 5 is removed from every cell that sees every 5 of both.'
    );
    // the hinge C holds 4 or 6, and so takes one of them from a wing
    expect(EXAMPLES.ALS_XY_WING!.step.description).toMatch(
      /^ALS-XY-Wing: the wings A \(r8c3, r8c8\) and B \(r4c9, r6c8\) and the hinge C \(r6c3\) .* C lacks at most one of its digits, so it holds a 4, and A then holds no 4, or a 6, and B then holds no 6\. .* A or B holds a 7, so 7 is removed from every cell that sees every 7 of both\.$/
    );
    // each set in turn loses its link digit and fills its cells
    expect(EXAMPLES.ALS_XY_CHAIN!.step.description).toMatch(
      /^ALS-XY-Chain: sets A \(r4c2, r4c7\), B \(r1c7\), C \(r1c5, r1c6\) and D \(r7c5\) .* linked by 9, 3 and 9: .* each set in turn loses its link digit and fills its cells\. A or D holds a 4, so 4 is removed from every cell that sees every 4 of both\.$/
    );
    // whichever digit the stem takes, its petal loses it and holds z
    expect(EXAMPLES.DEATH_BLOSSOM!.step.description).toMatch(
      /^Death Blossom: the stem r8c9 holds 2, 5 and 7, .*: A \(r9c7\) for 2, B \(r8c5, r9c6\) for 5 and C \(r8c1\) for 7\. Whichever digit the stem takes, its petal loses that digit, fills its cells with its other digits and holds a 4, so 4 is removed from every cell that sees every 4 of every petal\.$/
    );
    // and the Learn page reads each with its removals named, in every language
    for (const [lang, table] of [['nb', engineNb], ['es', engineEs]] as const) {
      setEngineText(lang, table);
      try {
        for (const tech of ['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'] as Tech[]) {
          const text = exampleStep(tech, EXAMPLES[tech]!)!.description;
          expect(text, `${lang} ${tech}`).not.toMatch(/ sets? A \(| every petal/);
          for (const L of tech === 'DEATH_BLOSSOM' ? ['A', 'B', 'C'] : EXAMPLES[tech]!.step.sets!.map((x) => x.letter!)) expect(text, `${lang} ${tech}`).toContain(`${L} (`);
        }
      } finally {
        setEngineText('en', null);
      }
    }
  });

  it('show a group as it mostly is, TRUE, and groups of three: one TRUE and one FALSE on the same cells (docs/hint-drawing-sets.md, decision 22)', () => {
    const truthOf = (tech: Tech) => {
      const d = deriveTruth(EXAMPLES[tech]!.step)!;
      expect(d.problems, tech).toEqual([]);
      return EXAMPLES[tech]!.step.sets!.map((set) => {
        const node = d.nodes.find((n) => n.node.length === set.members.length && set.members.every((m) => n.node.some((x) => x.cell === m.cell && x.digit === m.digit)))!;
        return `${set.members.length} ${node.truth ? 'TRUE' : 'FALSE'}`;
      });
    };
    // the end group of AIC with Groups is TRUE, its two members "one of these" squares
    expect(truthOf('AIC_GROUPED')).toEqual(['2 TRUE']);
    // the Grouped Nice Loop: the 9s of r1c9-r3c9 FALSE, the 7s of the same cells TRUE
    expect(truthOf('GROUPED_NICE_LOOP')).toEqual(['3 FALSE', '3 TRUE']);
    // Grouped X-Cycles keeps its false group
    expect(truthOf('GROUPED_X_CYCLES')).toEqual(['2 FALSE']);
    // both swaps are the first use of their technique on their puzzle's path, as exampleFrom takes it
    expect([EXAMPLES.AIC_GROUPED!.stepIndex, EXAMPLES.GROUPED_NICE_LOOP!.stepIndex]).toEqual([18, 10]);
  });

  it('ship one diagram per example', () => {
    // the Intuition guide's schematic diagrams ship alongside (tests/intuition.test.ts)
    const assets = buildLearnAssets().filter((a) => !a.path.startsWith('learn/img/intuition-'));
    expect(assets).toHaveLength(techs.length);
    for (const a of assets) expect(a.path).toMatch(/^learn\/img\/[a-z0-9-]+\.svg$/);
  });
});
