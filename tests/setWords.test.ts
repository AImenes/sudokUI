/**
 * The set walk and its words (docs/hint-drawing-sets.md, decisions 17-18,
 * "The walk and its words" and "How it is checked"). Along a derived chain
 * an almost locked set of several cells is introduced in a frame of its own
 * before the first link that reaches it, a one-cell set in its lock's
 * frame, and every sentence of a link with an end in a set is built from
 * the step's sets (src/engine/hintFrames.ts linkText): the set's lock, the
 * restricted common between two sets, a link into a set or out of it, from
 * or to a candidate or a group, each naming the drawn candidates. Held:
 * - on the stored AIC with ALS, frame by frame, and on a real step of each
 *   kind of link, at the position it was found;
 * - on the ALS patterns read as the chains they derive (decision 11), in
 *   the design's worked sentences;
 * - by tests/setWords.ts's rules, over every set step the repository keeps
 *   (the stored examples, the set fixture's positions, the positions here
 *   and the patterns read as chains): no set technique reaches the plain
 *   sentence for two digits, every set is introduced once before any frame
 *   that reaches it, every link of a set names it, no sentence or legend
 *   says "group" of a set, and the letters a sentence names are drawn in
 *   its frame;
 * - in the legends: a chain that opens in a set words its premise by the
 *   set, the legend names what its frame draws, and the hint panel's
 *   legend says what the Learn legend says, frame by frame.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from '../src/content/examples';
import { parseGrid } from '../src/engine/board';
import type { Grid } from '../src/engine/board';
import { findNextStep, findStep, applyStep } from '../src/engine/humanSolver';
import { walkFrames } from '../src/engine/hintFrames';
import type { Frame } from '../src/engine/hintFrames';
import { frameMarks, premiseOf } from '../src/content/hintMarks';
import { legendOf } from '../src/content/boardSvg';
import type { Step } from '../src/engine/steps';
import type { Tech } from '../src/engine/ratings';
import { chainOfPattern, wordProblems, GENERIC } from './setWords';

const storage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => void storage.set(k, v),
  removeItem: (k: string) => void storage.delete(k)
};

const { useGame } = await import('../src/state/gameStore');
const { HintPanel } = await import('../src/ui/HintPanel');

/** the techniques phase 4 draws with their sets */
const SETS: Tech[] = ['AIC_GROUPED', 'AIC_ALS', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'];
/** the patterns a chain derives (decision 11) */
const PATTERNS: Tech[] = ['ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN'];

interface Position {
  puzzle: string;
  values: string;
  cands: number[];
}
/** a frame as the walk tells it: its sentence, the links it has reached and the set it introduces */
const told = (f: Frame) => ({ text: f.text, links: f.links, ...(f.sets ? { sets: f.sets } : {}) });
/** the sentence of a link's own frame, counted from 1: the frame that reaches it, not a set's before it */
const sentenceOf = (s: Step, link: number) => walkFrames(s).find((f) => f.links === link && !f.sets)!.text;

/** a puzzle after the solver's first `at` steps */
function after(puzzle: string, at: number): Grid {
  const g = parseGrid(puzzle)!;
  for (let i = 0; i < at; i++) applyStep(g, findNextStep(g)!);
  return g;
}

/** the set fixture's positions, each with the step found again there (tests/drawingSnapshot.test.ts) */
const kept = (() => {
  const fx = JSON.parse(new TextDecoder().decode(readFileSync('tests/fixtures/setDrawings.json')));
  const out: { where: string; step: Step; position: Position }[] = [];
  for (const section of ['paths', 'named']) {
    for (const [id, d] of Object.entries<{ position: Position }>(fx[section])) {
      const tech = id.split(', ').at(-1) as Tech;
      const g = parseGrid(d.position.puzzle)!;
      for (let i = 0; i < 81; i++) {
        g.values[i] = Number(d.position.values[i]);
        g.cands[i] = d.position.cands[i];
      }
      const step = findStep(tech, g);
      if (step?.tech === tech) out.push({ where: id, step, position: d.position });
    }
  }
  return out;
})();

/**
 * A real AIC with ALS step for each kind of link with an end in a set the
 * stored example has none of, at the position the solver reaches after `at`
 * steps of the puzzle, and the sentence of that link
 */
const LINKS: { kind: string; puzzle: string; at: number; link: number; text: string }[] = [
  {
    kind: 'a lock with one exit',
    puzzle: '.29....41..1..3.866...4.9....2.7........3..19.7...5..2.4......8...3...5....81....',
    at: 31,
    link: 5,
    text: 'If set A holds no 3, its other 2 digits fill its 2 cells, so r7c6 must be 9.'
  },
  {
    kind: 'a restricted common, one candidate at each end',
    puzzle: '.29....41..1..3.866...4.9....2.7........3..19.7...5..2.4......8...3...5....81....',
    at: 31,
    link: 6,
    text: 'Every 9 of set A sees every 9 of set B: if r7c6 is 9, r8c6 cannot be 9.'
  },
  {
    kind: 'a restricted common from several candidates',
    puzzle: '...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.',
    at: 15,
    link: 4,
    text: 'Every 7 of set A sees every 7 of set B: if one of r4c3, r5c1, r6c3 is 7, r5c2 cannot be 7.'
  },
  {
    kind: 'a restricted common into several candidates',
    puzzle: '......31..1..3.....5..6.4....9..658.6..4.9..2.245..9....2.9..7.....5..2..67......',
    at: 19,
    link: 8,
    text: 'Every 3 of set A sees every 3 of set B: if r6c1 is 3, none of r7c1, r8c1, r9c1 can be 3.'
  },
  {
    kind: 'a restricted common, several candidates at each end',
    puzzle: '....1..28.4...9...8.243.............7.6....51......64...........24..53..19.....75',
    at: 35,
    link: 6,
    text: 'Every 8 of set A sees every 8 of set B: if one of r6c4, r6c6 is 8, none of r5c4, r5c5, r5c6 can be 8.'
  },
  {
    kind: 'into a set from a group',
    puzzle: '...9.....216547....89.21..............2.93.61......4.3.41.7...98.....7....51...2.',
    at: 15,
    link: 2,
    text: 'If one of r4c2, r5c2, r6c2 is 5, set A holds no 5: every 5 of A sees all of them.'
  },
  {
    kind: 'out of a set into a group',
    puzzle: '7.4..68.2.89.5......63......9...3......7....5......1.9.3..8.2...6...2...5.2.....6',
    at: 22,
    link: 6,
    text: 'If set A holds a 9, none of r7c6, r9c6 can be 9: they see every 9 of A.'
  },
  {
    kind: "into a set from another digit of the set's only cell holding its digit",
    puzzle: '53.4...7.6....1.35....85....4......3..7...1..1......8....29....38.6....1.9...8.52',
    at: 20,
    link: 6,
    text: 'If r6c5 is 2, set A holds no 4: the only 4 of A is in r6c5.'
  },
  {
    kind: "out of a set into another digit of the set's only cell holding its digit",
    puzzle: '....1..28.4...9...8.243.............7.6....51......64...........24..53..19.....75',
    at: 9,
    link: 8,
    text: 'If set A holds a 1, r3c2 cannot be 6: the only 1 of A is in r3c2.'
  },
  {
    // a generated puzzle's, where tests/alsaic.test.ts met the kind
    kind: "from one set to another, each set's only cell holding its digit the same cell",
    puzzle: '..6......25...1.9..34..9..2....839716.3...4......7..........3..7.8.1......98..7..',
    at: 41,
    link: 6,
    text: 'If set A holds a 4, set B holds no 5: the only 4 of A and the only 5 of B are both in r9c9.'
  }
];
const linkSteps = LINKS.map((l) => ({ ...l, step: findStep('AIC_ALS', after(l.puzzle, l.at))! }));

/** the hint panel at a position, showing a step in full or at a frame of its walk, and its legend's words */
function panelLegend(position: Position, step: Step, walkIndex: number | null): string[] {
  const cells = Array.from({ length: 81 }, (_, i) => {
    const value = Number(position.values[i]);
    return { given: position.puzzle[i] >= '1' && position.puzzle[i] <= '9', value, corner: 0, center: 0, excluded: value ? 0 : 0x1ff & ~position.cands[i], colors: [] };
  });
  useGame.setState({
    cells,
    autoCandidates: true,
    hint: step,
    hintStage: walkIndex === null ? 'full' : 'walk',
    walkIndex: walkIndex ?? 0,
    paused: false,
    won: false,
    chain: null,
    info: { puzzle: position.puzzle, score: 1000, level: 'hard' } as any
  });
  // a server render reads the store's initial state: give it the one set here
  Object.assign(useGame.getInitialState() as unknown as Record<string, unknown>, useGame.getState());
  const html = renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
  const list = /<ul class="hint-legend">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
  const decode = (s: string) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  return [...list.matchAll(/<li>(?:<i class="[^"]*"><\/i>)?([^<]*)<\/li>/g)].map((m) => decode(m[1]));
}

describe('the set walk (docs/hint-drawing-sets.md, decision 17)', () => {
  it('walks the stored AIC with ALS as the design tells it: set A in a frame of its own before the link that reaches it, then a link a frame', () => {
    const s = EXAMPLES.AIC_ALS!.step;
    expect(walkFrames(s).map(told)).toEqual([
      { text: 'Strong link on 8: if r2c9 is not 8, r2c8 must be 8 (nowhere else for it).', links: 1 },
      {
        text: 'Set A: the 2 cells r7c8, r8c8 of column 8 hold only 4, 8 and 9: one digit more than cells. Without any one of them, the others fill the cells.',
        links: 1,
        sets: [0]
      },
      { text: 'If r2c8 is 8, set A holds no 8: every 8 of A sees r2c8.', links: 2 },
      { text: 'If set A holds no 8, its other 2 digits fill its 2 cells, so one of r7c8, r8c8 must be 9.', links: 3 },
      { text: 'If set A holds a 9, r6c8 cannot be 9: it sees every 9 of A.', links: 4 },
      { text: 'Strong link on 9: if r6c8 is not 9, r6c9 must be 9 (nowhere else for it).', links: 5 },
      { text: 'So 8 is removed from r6c9.', links: 5 }
    ]);
    // the set frame draws set A, its candidates members, no truth yet; the link into it makes its 8s false
    const solved = (c: number) => EXAMPLES.AIC_ALS!.values[c] !== '0';
    const [, intro, into] = walkFrames(s);
    const introduced = frameMarks(s, intro, solved);
    expect(introduced.sets).toEqual([{ set: 0, style: 'als', tint: 1 }]);
    for (const m of s.sets![0].members) expect(introduced.cands.get(m.cell)?.get(m.digit), `${m.digit} in cell ${m.cell}`).toBe('member');
    expect(frameMarks(s, into, solved).cands.get(61)?.get(8)).toBe('false');
  });

  it("tells each kind of link into, out of, between and inside sets from the step's sets, naming the drawn candidates", () => {
    for (const { kind, puzzle, at, link, text, step } of linkSteps) {
      expect(step?.tech, `${kind}: ${puzzle} after ${at} steps`).toBe('AIC_ALS');
      expect(sentenceOf(step, link), kind).toBe(text);
    }
  });

  it("reads the ALS patterns, as the chains they derive, in the design's worked sentences: each set before its first link, a one-cell set folded into its lock", () => {
    const walk = (s: Step) => walkFrames(chainOfPattern(s)).slice(0, -1).map(told);
    expect(walk(EXAMPLES.ALS_XZ!.step)).toEqual([
      { text: 'Set A: the 2 cells r8c2, r9c1 of box 7 hold only 1, 5 and 9: one digit more than cells. Without any one of them, the others fill the cells.', links: 0, sets: [0] },
      { text: 'If set A holds no 5, its other 2 digits fill its 2 cells, so r8c2 must be 1.', links: 1 },
      { text: 'Set B: the 2 cells r7c8, r8c9 of box 9 hold only 1, 5 and 9: one digit more than cells. Without any one of them, the others fill the cells.', links: 1, sets: [1] },
      { text: 'Every 1 of set A sees every 1 of set B: if r8c2 is 1, r8c9 cannot be 1.', links: 2 },
      { text: 'If set B holds no 1, its other 2 digits fill its 2 cells, so r7c8 must be 5.', links: 3 }
    ]);
    // the hinge C, one cell, folded into its lock; A, C, B along the chain
    expect(walk(EXAMPLES.ALS_XY_WING!.step).map((f) => f.text)).toEqual([
      'Set A: the 2 cells r8c3, r8c8 of row 8 hold only 2, 4 and 7: one digit more than cells. Without any one of them, the others fill the cells.',
      'If set A holds no 7, its other 2 digits fill its 2 cells, so r8c3 must be 4.',
      'Every 4 of set A sees every 4 of set C: if r8c3 is 4, r6c3 cannot be 4.',
      'Set C, the hinge, is the cell r6c3, which holds only 4 and 6: if it is not 4, it must be 6.',
      'Set B: the 2 cells r4c9, r6c8 of box 6 hold only 4, 6 and 7: one digit more than cells. Without any one of them, the others fill the cells.',
      'Every 6 of set C sees every 6 of set B: if r6c3 is 6, r6c8 cannot be 6.',
      'If set B holds no 6, its other 2 digits fill its 2 cells, so one of r4c9, r6c8 must be 7.'
    ]);
    expect(walk(EXAMPLES.ALS_XY_CHAIN!.step).map((f) => f.text)).toEqual([
      'Set A: the 2 cells r4c2, r4c7 of row 4 hold only 4, 6 and 9: one digit more than cells. Without any one of them, the others fill the cells.',
      'If set A holds no 4, its other 2 digits fill its 2 cells, so r4c7 must be 9.',
      'Every 9 of set A sees every 9 of set B: if r4c7 is 9, r1c7 cannot be 9.',
      'Set B is the cell r1c7, which holds only 3 and 9: if it is not 9, it must be 3.',
      'Set C: the 2 cells r1c5, r1c6 of row 1 hold only 2, 3 and 9: one digit more than cells. Without any one of them, the others fill the cells.',
      'Every 3 of set B sees every 3 of set C: if r1c7 is 3, none of r1c5, r1c6 can be 3.',
      'If set C holds no 3, its other 2 digits fill its 2 cells, so r1c5 must be 9.',
      'Every 9 of set C sees every 9 of set D: if r1c5 is 9, r7c5 cannot be 9.',
      'Set D is the cell r7c5, which holds only 4 and 9: if it is not 9, it must be 4.'
    ]);
    // A, the cell r7c7, lies inside D: D's lock names both its 1s
    const shared = kept.find((k) => k.where === 'shared cells that derive, step 25, ALS_XY_CHAIN')!.step;
    expect(walk(shared).map((f) => f.text)).toEqual([
      'Set A is the cell r7c7, which holds only 1 and 5: if it is not 1, it must be 5.',
      'Set B: the 2 cells r2c7, r2c9 of row 2 hold only 2, 3 and 5: one digit more than cells. Without any one of them, the others fill the cells.',
      'Every 5 of set A sees every 5 of set B: if r7c7 is 5, r2c7 cannot be 5.',
      'If set B holds no 5, its other 2 digits fill its 2 cells, so r2c9 must be 2.',
      'Set C: the 2 cells r5c5, r5c9 of row 5 hold only 2, 3 and 7: one digit more than cells. Without any one of them, the others fill the cells.',
      'Every 2 of set B sees every 2 of set C: if r2c9 is 2, r5c9 cannot be 2.',
      'If set C holds no 2, its other 2 digits fill its 2 cells, so r5c5 must be 7.',
      'Set D: the 2 cells r7c5, r7c7 of row 7 hold only 1, 5 and 7: one digit more than cells. Without any one of them, the others fill the cells.',
      'Every 7 of set C sees every 7 of set D: if r5c5 is 7, r7c5 cannot be 7.',
      'If set D holds no 7, its other 2 digits fill its 2 cells, so one of r7c5, r7c7 must be 1.'
    ]);
    // a hinge of several cells is named so in its own frame
    const wing = kept.filter((k) => k.step.tech === 'ALS_XY_WING' && k.step.sets![2].cells.length > 1).map((k) => chainOfPattern(k.step))[0];
    expect(wing, 'an ALS-XY-Wing whose hinge has several cells').toBeDefined();
    expect(walkFrames(wing!).find((f) => f.sets?.[0] === 2)?.text).toMatch(/^Set C, the hinge: the \d cells /);
  });

  it('holds every set step the repository keeps to the rules: no plain sentence for a set, every set introduced once before it is reached, every letter named drawn', () => {
    const steps: { where: string; step: Step }[] = [
      ...SETS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step })),
      ...kept,
      ...linkSteps.map((l) => ({ where: `${l.puzzle} after ${l.at}`, step: l.step }))
    ];
    const chains = steps.filter(({ step }) => PATTERNS.includes(step.tech)).map(({ where, step }) => ({ where: `${where}, as a chain`, step: chainOfPattern(step) }));
    let sets = 0;
    for (const { where, step } of [...steps, ...chains]) {
      expect(wordProblems(step), where).toEqual([]);
      if (step.truth === 'derived') sets += (step.sets ?? []).filter((s) => s.kind === 'als').length;
    }
    expect(steps.filter(({ step }) => step.tech === 'AIC_ALS').length).toBeGreaterThanOrEqual(18);
    expect(chains.length).toBeGreaterThan(50);
    expect(sets).toBeGreaterThan(150);
  });

  it('catches a walk that breaks them', () => {
    const s = EXAMPLES.AIC_ALS!.step;
    const saying = (texts: Record<number, string>): Step => ({ ...s, links: s.links!.map((l, i) => (texts[i] ? { ...l, text: texts[i] } : l)) });
    // the generic sentence for a set's lock, which names no set; a set it does not draw; a set called a group
    const generic = 'Strong link: if r7c8, r8c8 is not 8, r7c8 must be 9.';
    expect(GENERIC.test(generic)).toBe(true);
    expect(wordProblems(saying({ 2: generic }))).toEqual([
      `frame 4: the plain sentence for two digits: ${generic}`,
      `link 3: a plain sentence for a set's link: ${generic}`,
      `link 3: does not name set A: ${generic}`
    ]);
    expect(wordProblems(saying({ 0: 'If set B holds a 8, r2c8 must be 8.' }))).toEqual(['frame 1: names set B, which it does not draw']);
    expect(wordProblems(saying({ 1: 'If r2c8 is 8, the group A holds no 8: every 8 of set A sees r2c8.' }))).toEqual([
      'frame 3: says "group" of a set: If r2c8 is 8, the group A holds no 8: every 8 of set A sees r2c8.'
    ]);
    // set A not introduced, or introduced after the link that reaches it
    const [first, intro, into, ...rest] = walkFrames(s);
    expect(wordProblems(s, [first, into, ...rest])).toEqual(['set A: introduced by 0 frames']);
    expect(wordProblems(s, [first, into, intro, ...rest])).toEqual(['set A: introduced after the frame that reaches it']);
    // a one-cell set, the ALS-XY-Wing's hinge, given a frame of its own
    const wing = chainOfPattern(EXAMPLES.ALS_XY_WING!.step);
    const frames = walkFrames(wing);
    const hinge = frames.findIndex((f) => f.text.startsWith('Set C, the hinge, is the cell'));
    const own: Frame = { text: 'Set C: the cell r6c3.', links: frames[hinge].links - 1, sets: [2], show: new Set(['units']) };
    expect(wordProblems(wing, [...frames.slice(0, hinge), own, ...frames.slice(hinge)])).toEqual(['set C: a one-cell set with a frame of its own']);
  });
});

describe('the legend of a set walk (docs/hint-drawing-sets.md, decision 18)', () => {
  const xz = { ...EXAMPLES.ALS_XZ!, step: chainOfPattern(EXAMPLES.ALS_XZ!.step) };

  it('words the premise of a chain that opens in a set by the set: if set A holds no 5', () => {
    expect(premiseOf(xz.step)).toEqual({ assumed: false, kind: 'set', letter: 'A', digit: 5 });
    const labels = legendOf(xz.step, xz.values).map((l) => l.label);
    expect(labels).toContain('true, if set A holds no 5 (by the small dot)');
    expect(labels).toContain('false, if set A holds no 5 (by the small dot)');
    expect(labels.some((l) => /group|first candidate/.test(l))).toBe(false);
  });

  it('names what each frame draws: the set frame its lettered cells beside the truths before it, the squares in a set from the lock that draws them', () => {
    const ex = EXAMPLES.AIC_ALS!;
    const labels = (f: Frame | null) => legendOf(ex.step, ex.values, f).map((l) => l.label);
    const [first, intro, into, lock] = walkFrames(ex.step);
    const truths = ['true, if the first candidate (by the small dot) is false', 'false, if the first candidate (by the small dot) is false'];
    const tiles = 'lettered cells: an almost locked set, one digit more than cells; without any one of its digits, the others fill its cells';
    const squares = 'squares in a set: one of them is true, if the first candidate (by the small dot) is false';
    expect(labels(first)).toEqual(truths);
    expect(labels(intro)).toEqual([...truths, tiles]);
    expect(labels(into)).toEqual([...truths, tiles]);
    expect(labels(lock)).toEqual([...truths, squares, tiles]);
  });

  it("is the same in the hint panel as in the Learn legend, in the full view and every frame of the walk", () => {
    const shown = [
      { where: 'AIC_ALS', position: EXAMPLES.AIC_ALS!, step: EXAMPLES.AIC_ALS!.step },
      { where: 'ALS_XZ, as a chain', position: xz, step: xz.step },
      ...kept.filter((k) => k.step.tech === 'AIC_ALS')
    ];
    let views = 0;
    for (const { where, position, step } of shown) {
      const frames = walkFrames(step);
      for (const [i, f] of [null, ...frames].entries()) {
        expect(panelLegend(position, step, f ? i - 1 : null), `${where}, ${f ? `frame ${i}` : 'full view'}`).toEqual(legendOf(step, position.values, f).map((l) => l.label));
        views++;
      }
    }
    expect(views).toBeGreaterThan(60);
  });
});
