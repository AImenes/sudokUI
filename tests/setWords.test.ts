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
 *   legend says what the Learn legend says, frame by frame;
 * - in English, "an 8" wherever a sentence puts an article before a digit,
 *   and "a" before the others (src/engine/text.ts aDigit).
 */
import { describe, it, expect, afterEach } from 'vitest';
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
import { aDigit, setEngineText } from '../src/engine/text';
import { makeTranslator } from '../src/content/i18n';
import nb from '../src/content/locales/app.nb';
import es from '../src/content/locales/app.es';
import { readSource } from '../scripts/i18n-source';
import { patternChain, wordProblems, GENERIC } from './setWords';
import { boardSvg } from '../src/content/boardSvg';
import type { LegendEntry } from '../src/content/boardSvg';
import { frameMarks as marksAt, legendKinds } from '../src/content/hintMarks';
import { LIGHT } from '../src/content/hintPalette';
import { alsClash, deriveTruth } from '../src/engine/truth';
import { solve } from '../src/engine/bruteForce';
import { cellNames, sees } from '../src/engine/board';

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
        text: 'Set A: the 2 cells r7c8, r8c8 of column 8 hold only 4, 8 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.',
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

  it('gives the ALS patterns as the chains they derive: each set\'s lock inside it, the restricted commons between them, no roles (decision 11)', () => {
    const patterns = [...PATTERNS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step })), ...kept.filter((k) => PATTERNS.includes(k.step.tech))];
    for (const { where, step } of patterns) {
      expect(step.truth, where).toBe('derived');
      expect(step.links, where).toEqual(patternChain(step));
      expect([step.primary, step.secondary, step.fins, step.labels], where).toEqual([undefined, undefined, undefined, undefined]);
    }
    expect(patterns.length).toBe(55);
    // the stored ALS-XZ link by link: (5)A=(1)A, A's 5s r8c2 and r9c1, its 1 r8c2; (1)A-(1)B, into r8c9's 1; (1)B=(5)B, B's 5 r7c8
    const at = (r: number, c: number, digit: number) => ({ cell: (r - 1) * 9 + c - 1, digit });
    expect(EXAMPLES.ALS_XZ!.step.links).toEqual([
      { from: [at(8, 2, 5), at(9, 1, 5)], to: [at(8, 2, 1)], strong: true, fromSet: 0, toSet: 0 },
      { from: [at(8, 2, 1)], to: [at(8, 9, 1)], strong: false, fromSet: 0, toSet: 1 },
      { from: [at(8, 9, 1)], to: [at(7, 8, 5)], strong: true, fromSet: 1, toSet: 1 }
    ]);
  });

  it("reads the ALS patterns, as the chains they derive, in the design's worked sentences: each set before its first link, a one-cell set folded into its lock", () => {
    const walk = (s: Step) => walkFrames(s).slice(0, -1).map(told);
    expect(walk(EXAMPLES.ALS_XZ!.step)).toEqual([
      { text: 'Set A: the 2 cells r8c2, r9c1 of box 7 hold only 1, 5 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.', links: 0, sets: [0] },
      { text: 'If set A holds no 5, its other 2 digits fill its 2 cells, so r8c2 must be 1.', links: 1 },
      { text: 'Set B: the 2 cells r7c8, r8c9 of box 9 hold only 1, 5 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.', links: 1, sets: [1] },
      { text: 'Every 1 of set A sees every 1 of set B: if r8c2 is 1, r8c9 cannot be 1.', links: 2 },
      { text: 'If set B holds no 1, its other 2 digits fill its 2 cells, so r7c8 must be 5.', links: 3 }
    ]);
    // the hinge C, one cell, folded into its lock; A, C, B along the chain
    expect(walk(EXAMPLES.ALS_XY_WING!.step).map((f) => f.text)).toEqual([
      'Set A: the 2 cells r8c3, r8c8 of row 8 hold only 2, 4 and 7: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'If set A holds no 7, its other 2 digits fill its 2 cells, so r8c3 must be 4.',
      'Every 4 of set A sees every 4 of set C: if r8c3 is 4, r6c3 cannot be 4.',
      'Set C, the hinge, is the cell r6c3, which holds only 4 and 6: if it is not 4, it must be 6.',
      'Set B: the 2 cells r4c9, r6c8 of box 6 hold only 4, 6 and 7: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'Every 6 of set C sees every 6 of set B: if r6c3 is 6, r6c8 cannot be 6.',
      'If set B holds no 6, its other 2 digits fill its 2 cells, so one of r4c9, r6c8 must be 7.'
    ]);
    expect(walk(EXAMPLES.ALS_XY_CHAIN!.step).map((f) => f.text)).toEqual([
      'Set A: the 2 cells r4c2, r4c7 of row 4 hold only 4, 6 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'If set A holds no 4, its other 2 digits fill its 2 cells, so r4c7 must be 9.',
      'Every 9 of set A sees every 9 of set B: if r4c7 is 9, r1c7 cannot be 9.',
      'Set B is the cell r1c7, which holds only 3 and 9: if it is not 9, it must be 3.',
      'Set C: the 2 cells r1c5, r1c6 of row 1 hold only 2, 3 and 9: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'Every 3 of set B sees every 3 of set C: if r1c7 is 3, none of r1c5, r1c6 can be 3.',
      'If set C holds no 3, its other 2 digits fill its 2 cells, so r1c5 must be 9.',
      'Every 9 of set C sees every 9 of set D: if r1c5 is 9, r7c5 cannot be 9.',
      'Set D is the cell r7c5, which holds only 4 and 9: if it is not 9, it must be 4.'
    ]);
    // A, the cell r7c7, lies inside D: D's lock names both its 1s
    const shared = kept.find((k) => k.where === 'shared cells that derive, step 25, ALS_XY_CHAIN')!.step;
    expect(walk(shared).map((f) => f.text)).toEqual([
      'Set A is the cell r7c7, which holds only 1 and 5: if it is not 1, it must be 5.',
      'Set B: the 2 cells r2c7, r2c9 of row 2 hold only 2, 3 and 5: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'Every 5 of set A sees every 5 of set B: if r7c7 is 5, r2c7 cannot be 5.',
      'If set B holds no 5, its other 2 digits fill its 2 cells, so r2c9 must be 2.',
      'Set C: the 2 cells r5c5, r5c9 of row 5 hold only 2, 3 and 7: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'Every 2 of set B sees every 2 of set C: if r2c9 is 2, r5c9 cannot be 2.',
      'If set C holds no 2, its other 2 digits fill its 2 cells, so r5c5 must be 7.',
      'Set D: the 2 cells r7c5, r7c7 of row 7 hold only 1, 5 and 7: one digit more than cells. Without any one of these digits, the others fill the cells.',
      'Every 7 of set C sees every 7 of set D: if r5c5 is 7, r7c5 cannot be 7.',
      'If set D holds no 7, its other 2 digits fill its 2 cells, so one of r7c5, r7c7 must be 1.'
    ]);
    // a hinge of several cells is named so in its own frame
    const wing = kept.filter((k) => k.step.tech === 'ALS_XY_WING' && k.step.sets![2].cells.length > 1).map((k) => k.step)[0];
    expect(wing, 'an ALS-XY-Wing whose hinge has several cells').toBeDefined();
    expect(walkFrames(wing!).find((f) => f.sets?.[0] === 2)?.text).toMatch(/^Set C, the hinge: the \d cells /);
  });

  it('holds every set step the repository keeps to the rules: no plain sentence for a set, every set introduced once before it is reached, every letter named drawn', () => {
    const steps: { where: string; step: Step }[] = [
      ...SETS.map((tech) => ({ where: tech, step: EXAMPLES[tech]!.step })),
      ...kept,
      ...linkSteps.map((l) => ({ where: `${l.puzzle} after ${l.at}`, step: l.step }))
    ];
    let sets = 0;
    for (const { where, step } of steps) {
      expect(wordProblems(step), where).toEqual([]);
      if (step.truth === 'derived') sets += (step.sets ?? []).filter((s) => s.kind === 'als').length;
    }
    expect(steps.filter(({ step }) => step.tech === 'AIC_ALS').length).toBeGreaterThanOrEqual(18);
    expect(steps.filter(({ step }) => PATTERNS.includes(step.tech)).length).toBeGreaterThan(50);
    expect(steps.filter(({ step }) => step.tech === 'DEATH_BLOSSOM').length).toBe(10);
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
    expect(wordProblems(saying({ 0: 'If set B holds an 8, r2c8 must be 8.' }))).toEqual(['frame 1: names set B, which it does not draw']);
    expect(wordProblems(saying({ 1: 'If r2c8 is 8, the group A holds no 8: every 8 of set A sees r2c8.' }))).toEqual([
      'frame 3: says "group" of a set: If r2c8 is 8, the group A holds no 8: every 8 of set A sees r2c8.'
    ]);
    // set A not introduced, or introduced after the link that reaches it
    const [first, intro, into, ...rest] = walkFrames(s);
    expect(wordProblems(s, [first, into, ...rest])).toEqual(['set A: introduced by 0 frames']);
    expect(wordProblems(s, [first, into, intro, ...rest])).toEqual(['set A: introduced after the frame that reaches it']);
    // a one-cell set, the ALS-XY-Wing's hinge, given a frame of its own
    const wing = EXAMPLES.ALS_XY_WING!.step;
    const frames = walkFrames(wing);
    const hinge = frames.findIndex((f) => f.text.startsWith('Set C, the hinge, is the cell'));
    const own: Frame = { text: 'Set C: the cell r6c3.', links: frames[hinge].links - 1, sets: [2], show: new Set(['units']) };
    expect(wordProblems(wing, [...frames.slice(0, hinge), own, ...frames.slice(hinge)])).toEqual(['set C: a one-cell set with a frame of its own']);
  });
});

describe("an ALS pattern's conclusion and Death Blossom's walk (docs/hint-drawing-sets.md, decisions 15 and 17)", () => {
  it('ends each ALS pattern naming its two end sets and the reason, before the removals', () => {
    const last = (s: Step) => walkFrames(s).at(-1)!.text;
    expect(last(EXAMPLES.ALS_XZ!.step)).toBe(
      'Set A or set B holds a 5: if A holds none, B holds one. Each removed 5 sees every 5 of both. So 5 is removed from r7c1.'
    );
    expect(last(EXAMPLES.ALS_XY_WING!.step)).toBe(
      'Set A or set B holds a 7: if A holds none, B holds one. Each removed 7 sees every 7 of both. So 7 is removed from r4c8.'
    );
    expect(last(EXAMPLES.ALS_XY_CHAIN!.step)).toBe(
      'Set A or set D holds a 4: if A holds none, D holds one. Each removed 4 sees every 4 of both. So 4 is removed from r4c5.'
    );
    // a chain that clashes ends on why its first set holds z, and its loop back to the start is drawn as no proof
    const closes = kept.find((k) => k.where === 'a clash that closes, step 16, ALS_XY_CHAIN')!.step;
    expect(walkFrames(closes).map((f) => f.text).filter((t) => /impossible/.test(t))).toEqual([]);
    expect(last(closes)).toBe(
      'Set D holds 7 only in r1c9, r7c9, the very cells set A holds it in, so the chain comes back to A: if A holds no 7, one of these cells must be 7, and A holds one after all. A cannot lack a 7, so set A holds a 7. Each removed 7 sees every 7 of A. So 7 is removed from r2c9.'
    );
    // no other chain says it
    expect(last(EXAMPLES.AIC_ALS!.step)).toBe('So 8 is removed from r6c9.');
  });

  it("walks the stored Death Blossom as the design tells it: the stem, each petal's branch in words, a petal of several cells introduced first, then the conclusion", () => {
    const s = EXAMPLES.DEATH_BLOSSOM!.step;
    expect(walkFrames(s).map(told)).toEqual([
      { text: 'The stem r8c9 holds 2, 5 and 7: one of them is true, and each has a petal.', links: 0 },
      { text: 'Petal A is the cell r9c7, which holds only 2 and 4, and its 2 sees the stem: if the stem is 2, r9c7 must be 4.', links: 2 },
      {
        text: "Petal B, for the stem's 5: the 2 cells r8c5, r9c6 of box 8 hold only 1, 4 and 5: one digit more than cells, and every 5 of it sees the stem.",
        links: 2,
        sets: [1]
      },
      { text: 'If the stem is 5, petal B holds no 5, so its other 2 digits fill its 2 cells: r9c6 must be 4.', links: 4 },
      { text: 'Petal C is the cell r8c1, which holds only 4 and 7, and its 7 sees the stem: if the stem is 7, r8c1 must be 4.', links: 6 },
      { text: 'Whichever digit the stem takes, a petal holds a 4. Each removed 4 sees every 4 of every petal. So 4 is removed from r9c2, r9c3.', links: 6 }
    ]);
    // a petal whose z lies in several cells: "one of"; a two-digit stem
    const two = kept.find((k) => k.where === 'a two-digit stem, step 43, DEATH_BLOSSOM')!.step;
    expect(walkFrames(two)[0].text).toBe('The stem r3c3 holds 3 and 7: one of them is true, and each has a petal.');
    const several = kept.map((k) => k.step).filter((x) => x.tech === 'DEATH_BLOSSOM').flatMap((x) => walkFrames(x).map((f) => f.text)).filter((t) => /cells: one of r\dc\d, /.test(t));
    expect(several.length, 'a branch into several cells').toBeGreaterThan(0);
  });

  it('catches a Death Blossom walk that breaks its rules', () => {
    const s = EXAMPLES.DEATH_BLOSSOM!.step;
    const frames = walkFrames(s);
    expect(wordProblems(s)).toEqual([]);
    // petal B not introduced, or after its branch; its branch told in two frames; a group
    expect(wordProblems(s, frames.filter((f) => !f.sets))[0]).toMatch(/^petal B: not introduced once/);
    expect(wordProblems(s, [frames[0], frames[1], frames[3], frames[2], ...frames.slice(4)])[0]).toMatch(/^petal B: not introduced once/);
    const split = [...frames.slice(0, 3), { ...frames[3], links: 3 }, ...frames.slice(3)];
    expect(wordProblems(s, split)).toContain('branch 5: its tie and its lock in different frames');
    expect(wordProblems(s, [{ ...frames[0], text: 'The group r8c9 holds 2, 5 and 7.' }, ...frames.slice(1)])).toEqual([
      'frame 1: not the stem: The group r8c9 holds 2, 5 and 7.',
      'frame 1: says "group": The group r8c9 holds 2, 5 and 7.'
    ]);
  });
});

describe('the legend of a set walk (docs/hint-drawing-sets.md, decision 18)', () => {
  const xz = EXAMPLES.ALS_XZ!;

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
      ...(['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'] as Tech[]).map((tech) => ({ where: tech, position: EXAMPLES[tech]!, step: EXAMPLES[tech]!.step })),
      ...kept.filter((k) => k.step.tech === 'AIC_ALS' || k.where.startsWith('shared cells') || k.where.startsWith('a two-digit stem'))
    ];
    let views = 0;
    for (const { where, position, step } of shown) {
      const frames = walkFrames(step);
      for (const [i, f] of [null, ...frames].entries()) {
        expect(panelLegend(position, step, f ? i - 1 : null), `${where}, ${f ? `frame ${i}` : 'full view'}`).toEqual(legendOf(step, position.values, f).map((l) => l.label));
        views++;
      }
    }
    expect(views).toBeGreaterThan(120);
  });
});

describe('an 8: the article before a digit (src/engine/text.ts aDigit)', () => {
  afterEach(() => setEngineText('en', null));

  it('writes "an" before 8 and "a" before every other digit in English, and the Norwegian and Spanish article before each', () => {
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    expect(digits.map(aDigit)).toEqual(['a 1', 'a 2', 'a 3', 'a 4', 'a 5', 'a 6', 'a 7', 'an 8', 'a 9']);
    setEngineText('nb', nb.engine);
    expect(digits.map(aDigit)).toEqual(digits.map((d) => `en ${d}`));
    setEngineText('es', es.engine);
    expect(digits.map(aDigit)).toEqual(digits.map((d) => `un ${d}`));
    // the hint panel's own words for it
    for (const [lang, loc, art] of [['nb', nb, 'en'], ['es', es, 'un']] as const) {
      const t = makeTranslator(lang, loc);
      expect([t('a {d}', { d: 5 }), t('an {d}', { d: 8 })], lang).toEqual([`${art} 5`, `${art} 8`]);
    }
  });

  it('never writes "a 8" in a set step the repository keeps: its description, its walk and its legends; an ALS pattern and a Death Blossom about 8 say "an 8"', () => {
    const steps = [...SETS.map((tech) => ({ where: tech as string, position: EXAMPLES[tech]!, step: EXAMPLES[tech]!.step })), ...kept];
    const eights = new Set<Tech>();
    for (const { where, position, step } of steps) {
      const frames = walkFrames(step);
      const words = [step.description, ...frames.map((f) => f.text), ...[null, ...frames].flatMap((f) => legendOf(step, position.values, f).map((l) => l.label))];
      for (const w of words) expect(w, where).not.toMatch(/\ba 8\b/);
      if (words.some((w) => /\ban 8\b/.test(w))) eights.add(step.tech);
    }
    expect([...eights].sort()).toEqual(['ALS_XY_CHAIN', 'ALS_XY_WING', 'ALS_XZ', 'DEATH_BLOSSOM']);
    // the conclusion of a chain whose sets share cells, about 8
    const clash = kept.find((k) => k.where === 'shared cells that clash, step 15, ALS_XY_CHAIN')!.step;
    expect(walkFrames(clash).at(-1)!.text).toMatch(/^Set D holds 8 only in r4c4, r6c4, cells of set A: .* A cannot lack an 8, so set A holds an 8\./);
    expect(clash.description).toMatch(/A or D holds an 8, so 8 is removed/);
  });

  it('words a premise that a set holds an 8 so in the hint panel and the Learn legend', () => {
    // the stored AIC with ALS read backwards from set A's 8s: if A holds an 8, r2c8 is not 8, so r2c9 is
    const ex = EXAMPLES.AIC_ALS!;
    const [into, out] = [ex.step.links![1], ex.step.links![0]];
    const step: Step = {
      ...ex.step,
      links: [
        { from: into.to, to: into.from, strong: false, fromSet: into.toSet },
        { from: out.to, to: out.from, strong: true }
      ]
    };
    expect(premiseOf(step)).toEqual({ assumed: true, kind: 'set', letter: 'A', digit: 8 });
    const learn = legendOf(step, ex.values).map((l) => l.label);
    expect(learn).toContain('true, if set A holds an 8 (by the small dot)');
    expect(learn).toContain('false, if set A holds an 8 (by the small dot)');
    expect(panelLegend(ex, step, null)).toEqual(learn);
  });

  it('writes "an 8" in a finned fish about 8, and no English template puts "a" before a hole but the article\'s own', () => {
    const ex = EXAMPLES.FINNED_X_WING!;
    expect(ex.step.description).toMatch(/; an 8 that sees every fin/);
    const g = parseGrid(ex.puzzle)!;
    for (let i = 0; i < 81; i++) {
      g.values[i] = Number(ex.values[i]);
      g.cands[i] = ex.cands[i];
    }
    expect(findStep('FINNED_X_WING', g)!.description).toBe(ex.step.description);
    const source = readSource();
    expect([...source.engineKeys.keys()].filter((k) => /(^|[^A-Za-z])an? \{\d+\}/.test(k)).sort()).toEqual(['a {0}', 'an {0}']);
    // a digit in the interface's keys, by its placeholder's name ({tech}, {level} and {method} are names, not digits)
    expect([...source.uiKeys.keys()].filter((k) => /(^|[^A-Za-z])an? \{(?!tech\}|level\}|method\})\w+\}/.test(k)).sort()).toEqual(['a {d}', 'an {d}']);
  });
});

describe('the words and the legends, review round 1 (docs/hint-drawing-sets.md, "The walk and its words")', () => {
  /** the hint panel's legend at a position, each entry's swatch class and its words */
  function panelItems(position: Position, step: Step, walkIndex: number | null): { swatch: string; label: string }[] {
    panelLegend(position, step, walkIndex);
    const html = renderToStaticMarkup(React.createElement(HintPanel, { onLearn: () => {} }));
    const list = /<ul class="hint-legend">([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '';
    const decode = (x: string) => x.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    return [...list.matchAll(/<li>(?:<i class="([^"]*)"><\/i>)?([^<]*)<\/li>/g)].map((m) => ({ swatch: m[1] ?? '', label: decode(m[2]) }));
  }
  const stored = (tech: Tech) => ({ where: tech as string, position: EXAMPLES[tech]! as Position, step: EXAMPLES[tech]!.step });
  const solvedIn = (position: Position) => (c: number) => position.values[c] !== '0';

  it("words a Death Blossom's gold as the stem's candidates while no petal's digit is drawn, and in full from the first petal's on, in the panel and the Learn legend alike", () => {
    const stemOnly = "the stem's candidates";
    const full = "the stem's candidates, and each petal's digit the stem sees";
    const gold = (s: Step, position: Position, f: Frame | null) => legendOf(s, position.values, f).find((l) => l.kind === 'secondary')?.label;
    // the stored example: its stem frame, then a petal's digit from petal A's branch on
    const db = stored('DEATH_BLOSSOM');
    expect([null, ...walkFrames(db.step)].map((f) => gold(db.step, db.position, f))).toEqual([full, stemOnly, full, full, full, full, full]);
    // every Death Blossom the repository keeps: the stem's label exactly where the gold is the stem's alone
    const blossoms = [db, ...kept.filter((k) => k.step.tech === 'DEATH_BLOSSOM')];
    let stems = 0;
    for (const { where, position, step } of blossoms) {
      const stem = step.links!.find((l) => l.undirected)!.from[0].cell;
      for (const [i, f] of [null, ...walkFrames(step)].entries()) {
        const at = `${where}, ${f ? `frame ${i}` : 'full view'}`;
        const goldCells = [...marksAt(step, f, solvedIn(position)).cands].filter(([, m]) => [...m.values()].includes('secondary')).map(([cell]) => cell);
        const want = goldCells.every((cell) => cell === stem) ? stemOnly : full;
        if (want === stemOnly) stems++;
        expect(gold(step, position, f), at).toBe(want);
        expect(panelItems(position, step, f ? i - 1 : null).map((e) => e.label), at).toContain(want);
      }
      expect(gold(step, position, walkFrames(step)[0]), where).toBe(stemOnly);
    }
    expect(stems).toBeGreaterThanOrEqual(blossoms.length);
  });

  it('ends an ALS-XY-Chain whose chain clashes on why its first set holds z, worded by what the derivation meets, and true in the solution (decision 13)', () => {
    const last = (where: string) => walkFrames(kept.find((k) => k.where === where)!.step).at(-1)!.text;
    expect(last('shared cells that clash, step 15, ALS_XY_CHAIN')).toBe(
      'Set D holds 8 only in r4c4, r6c4, cells of set A: if A holds no 8, one of these cells must be 8, and A holds one after all. A cannot lack an 8, so set A holds an 8. Each removed 8 sees every 8 of A. So 8 is removed from r3c4.'
    );
    expect(last('a clash in a false group, step 29, ALS_XY_CHAIN')).toBe(
      'Set D holds 4 only in r8c2, a cell of set A: if A holds no 4, r8c2 must be 4, and A holds one after all. A cannot lack a 4, so set A holds a 4. Each removed 4 sees every 4 of A. So 4 is removed from r7c2.'
    );
    expect(last('a clash that closes, step 16, ALS_XY_CHAIN')).toBe(
      'Set D holds 7 only in r1c9, r7c9, the very cells set A holds it in, so the chain comes back to A: if A holds no 7, one of these cells must be 7, and A holds one after all. A cannot lack a 7, so set A holds a 7. Each removed 7 sees every 7 of A. So 7 is removed from r2c9.'
    );
    // every clash the set fixture keeps: D's z in cells of A, each kind of clash in its own words, every claim true
    const kinds = new Set<string>();
    for (const { where, step, position } of kept.filter((k) => alsClash(k.step))) {
      const d = deriveTruth(step)!;
      const [A, D] = ['A', 'D'].map((L) => step.sets!.find((x) => x.letter === L)!);
      const z = step.eliminations[0].digit;
      const zOf = (set: typeof A) => set.members.filter((m) => m.digit === z).map((m) => m.cell);
      expect(zOf(D).every((c) => A.cells.includes(c)), where).toBe(true);
      const kind = d.closure ? 'closure' : d.problems.map((p) => p.issue).join();
      kinds.add(kind);
      const wording = zOf(D).length === 1 ? 'a cell of set A' : kind === 'closure' ? 'the very cells set A holds it in' : 'cells of set A';
      if (kind === 'emptyTrue') expect(zOf(D).length, where).toBeGreaterThan(1);
      if (kind === 'inFalseGroup') expect(zOf(D).length, where).toBe(1);
      if (kind === 'closure') expect(zOf(D), where).toEqual(zOf(A));
      const text = walkFrames(step).at(-1)!.text;
      expect(text, where).toContain(`Set D holds ${z} only in ${cellNames(zOf(D))}, ${wording}`);
      expect(text, where).toContain(`set A holds ${aDigit(z)}. Each removed ${z} sees every ${z} of A.`);
      // in the puzzle's solution set A holds z, and each removal sees every z of A
      const solution = solve(parseGrid(position.puzzle)!)!.values;
      expect(A.cells.some((c) => solution[c] === z), where).toBe(true);
      for (const e of step.eliminations) expect(zOf(A).every((c) => sees(e.cell, c)), where).toBe(true);
    }
    expect([...kinds].sort()).toEqual(['closure', 'emptyTrue', 'inFalseGroup']);
    // no chain that derives cleanly says it
    for (const { where, step } of kept.filter((k) => PATTERNS.includes(k.step.tech) && !alsClash(k.step))) {
      expect(walkFrames(step).at(-1)!.text, where).toMatch(/^Set A or set [BD] holds an? \d: if A holds none, [BD] holds one\./);
    }
  });

  it("draws the bar's swatch in the inks the view's bars are drawn in: the pattern's, the removal's, or one of each, as Grouped X-Cycles rule 3's full view draws them", () => {
    const rule3 = kept.find((k) => k.where === 'rule 3, step 14, GROUPED_X_CYCLES')!;
    const isBar = (l: LegendEntry) => l.kind === 'bar' || l.kind === 'bars';
    expect(legendOf(rule3.step, rule3.position.values).find(isBar)).toMatchObject({ kind: 'bars', colour: LIGHT.primaryInk, ink: LIGHT.elim });
    expect(panelItems(rule3.position, rule3.step, null).find((e) => e.label.startsWith('bar:'))?.swatch).toBe('swatch-bars');
    // every grouped view the repository keeps, in the panel and the Learn legend alike
    const grouped = [
      ...(['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES'] as Tech[]).map(stored),
      ...kept.filter((k) => ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'].includes(k.step.tech))
    ];
    const seen = new Set<string>();
    for (const { where, position, step } of grouped) {
      for (const [i, f] of [null, ...walkFrames(step)].entries()) {
        const at = `${where}, ${f ? `frame ${i}` : 'full view'}`;
        const bars = legendKinds(step, marksAt(step, f, solvedIn(position))).bars;
        const inks = (['primary', 'elim'] as const).filter((b) => bars.has(b));
        const entry = legendOf(step, position.values, f).find(isBar);
        const swatch = panelItems(position, step, f ? i - 1 : null).find((e) => e.label.startsWith('bar:'))?.swatch;
        if (!inks.length) {
          expect([entry, swatch], at).toEqual([undefined, undefined]);
          continue;
        }
        const ink = (b: 'primary' | 'elim') => (b === 'primary' ? LIGHT.primaryInk : LIGHT.elim);
        seen.add(inks.join('+'));
        expect(entry, at).toMatchObject(inks.length === 2 ? { kind: 'bars', colour: ink('primary'), ink: ink('elim') } : { kind: 'bar', colour: ink(inks[0]), ink: ink(inks[0]) });
        expect(swatch, at).toBe(inks.length === 2 ? 'swatch-bars' : `swatch-bar-${inks[0]}`);
      }
    }
    // a proof-only view's bar alone, and rule 3's two; no view these keep draws a removed bar alone
    expect([...seen].sort()).toEqual(['primary', 'primary+elim']);
  });

  it('names the dashed outline of a cell of two sets, drawn like it, wherever a view draws one, in the panel and the Learn legend alike (decision 6)', () => {
    const label = 'dashed outline: a cell of two sets; each tab names one';
    const tint = (n: string) => [LIGHT[`set${n}` as 'set1'], LIGHT[`set${n}Ink` as 'set1Ink']];
    const als = [
      ...(['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'] as Tech[]).map(stored),
      ...kept.filter((k) => ['AIC_ALS', 'ALS_XZ', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'DEATH_BLOSSOM'].includes(k.step.tech))
    ];
    let views = 0;
    for (const { where, position, step } of als) {
      for (const [i, f] of [null, ...walkFrames(step)].entries()) {
        const at = `${where}, ${f ? `frame ${i}` : 'full view'}`;
        // a cell in two of the sets the view draws
        const drawn = marksAt(step, f, solvedIn(position)).sets.filter((m) => m.style === 'als').map((m) => step.sets![m.set].cells);
        const two = drawn.some((cells, a) => drawn.some((other, b) => a < b && cells.some((c) => other.includes(c))));
        const entry = legendOf(step, position.values, f).find((l) => l.kind === 'shared');
        const item = panelItems(position, step, f ? i - 1 : null).find((e) => e.swatch.startsWith('swatch-shared'));
        expect([!!entry, !!item], at).toEqual([two, two]);
        if (!entry || !item) continue;
        views++;
        expect([entry.label, item.label], at).toEqual([label, label]);
        // the panel's swatch in the Learn swatch's tints: the tile's, and the ink of the outline dashed inside it
        const [, t, d] = /^swatch-shared tile-(\d) dash-(\d)$/.exec(item.swatch) ?? [];
        expect([entry.colour, entry.ink, entry.dash], at).toEqual([...tint(t), tint(d)[1]]);
      }
      // the full view's swatch is the board's first such cell: its tile's tint, and the ink of the outline dashed inside it
      const svg = boardSvg({ ...position, stepIndex: 0, step } as Parameters<typeof boardSvg>[0], where);
      const dashed = /<rect class="to" x="([\d.]+)" y="([\d.]+)"[^>]*stroke="([^"]+)"[^>]*stroke-dasharray/.exec(svg);
      const entry = legendOf(step, position.values).find((l) => l.kind === 'shared');
      expect(!!entry, where).toBe(!!dashed);
      if (!dashed || !entry) continue;
      const [x, y] = [Number(dashed[1]), Number(dashed[2])];
      const owner = [...svg.matchAll(/<rect class="tl" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"[^>]*fill="([^"]+)"/g)].find(
        (m) => x >= Number(m[1]) && y >= Number(m[2]) && x <= Number(m[1]) + Number(m[3]) && y <= Number(m[2]) + Number(m[4])
      );
      expect([entry.colour, entry.dash], where).toEqual([owner?.[5], dashed[3]]);
    }
    expect(views).toBeGreaterThan(20);
  });
});

describe("the hint panel's bar entry (docs/hint-drawing-sets.md, decision 18)", () => {
  it("is the same in the hint panel as in the Learn legend for every grouped chain kept, in the full view and every frame, and names a bar wherever the board draws one in the pattern's or the removal's ink", async () => {
    const { boardDrawing } = await import('../src/ui/boardLayout');
    const GROUPED: Tech[] = ['AIC_GROUPED', 'GROUPED_NICE_LOOP', 'GROUPED_X_CYCLES', 'AIC_ALS'];
    const shown = [...GROUPED.map((tech) => ({ where: tech as string, position: EXAMPLES[tech]!, step: EXAMPLES[tech]!.step })), ...kept.filter((k) => GROUPED.includes(k.step.tech))];
    let views = 0;
    const barred: string[] = [];
    for (const { where, position, step } of shown) {
      const solved = (c: number) => position.values[c] !== '0';
      // the bars the board puts beside their groups
      const { sets } = boardDrawing(step, (c) => ({ value: Number(position.values[c]), corner: 0, center: 0 }), (c) => position.cands[c]);
      const frames = walkFrames(step);
      for (const [i, f] of [null, ...frames].entries()) {
        const at = `${where}, ${f ? `frame ${i}` : 'full view'}`;
        const panel = panelLegend(position, step, f ? i - 1 : null);
        expect(panel, at).toEqual(legendOf(step, position.values, f).map((l) => l.label));
        // a bar the view draws in the pattern's ink (a proof-only view) or the removal's (src/ui/Grid.tsx groupBars)
        const inked = frameMarks(step, f, solved).sets.some((m) => (m.style === 'primary' || m.style === 'elim') && sets.bars.some((b) => b.set === m.set));
        expect(panel.some((l) => l.startsWith('bar: a group')), at).toBe(inked);
        if (inked) barred.push(at);
        views++;
      }
    }
    expect(views).toBeGreaterThan(300);
    // rule 3's removed group, and a group whose loop a solved cell breaks, each in the full view and its conclusion
    expect(barred).toEqual(expect.arrayContaining(['rule 3, step 14, GROUPED_X_CYCLES, full view', 'the gapped group over a solved cell, step 20, GROUPED_X_CYCLES, full view']));
  });
});
