/**
 * Position as text (the Share dialog), at the store: the pencil-mark grid
 * HoDoKu and SudokuWiki read as complete candidate lists, so each cell's
 * list is the solver's (contractGrid). With auto candidates off, manual
 * marks and the mark question never answered, asking for the text asks the
 * question first (contractFor 'text'), and the answer is remembered for the
 * puzzle as Hint's is: "my remaining candidates" writes the player's lists,
 * "partial notes" every candidate still open. Without manual marks, with
 * auto candidates on, or once the answer is known, no question.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatPencilGrid, parsePencilGrid, candidateLists } from '../src/content/textGrid';

// what the store saves, kept here (persist), set before the store is imported
vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
});
const { useGame, contractGrid } = await import('../src/state/gameStore');
const { useSettings } = await import('../src/state/settings');
type CellState = ReturnType<typeof useGame.getState>['cells'][number];

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const bit = (d: number) => 1 << (d - 1);
const bits = (...ds: number[]) => ds.reduce((m, d) => m | bit(d), 0);
// cells of EASY: r1c1 has candidates 4 5 (solution 4), r1c2 4 5 7 8 (8), r2c2 2 4 6 7 8 (6)
const R1C1 = 0;
const R1C2 = 1;
const R2C2 = 10;

const g = () => useGame.getState();
function mark(cell: number, m: Partial<CellState>) {
  useGame.setState({ cells: g().cells.map((c, i) => (i === cell ? { ...c, ...m } : c)) });
}
/** the lists a text carries, cell by cell, as a tool reads them back */
const listsOf = (text: string) => parsePencilGrid(text)!.cands!;
/** the solver's lists of the empty cells: contractGrid's */
const solverLists = () => {
  const s = g();
  const grid = contractGrid(s.cells, s.autoCandidates, s.markContract);
  return s.cells.map((c, i) => (c.value ? 0 : grid.cands[i]));
};
/** a list as a tool reads it back from the text: one digit alone is a placed digit, as the forums read it */
const asRead = (lists: number[]) => lists.map((m) => (m & (m - 1) ? m : 0));

beforeEach(() => {
  useSettings.getState().set({ autoOffPromptDone: true, autoOffMaterialize: true, materializeLayer: 'center', confirmAssist: false });
  g().startGame(EASY, 196, 'Easy');
  useGame.setState({ notice: null });
  // the player's own marks: a centre pair, and a corner pair, which with
  // its 4 a digit placed in its column rules out
  mark(R1C2, { center: bits(7, 8) });
  mark(R2C2, { corner: bits(6, 7, 9) });
});

describe('Position as text and the mark question', () => {
  it('asks first, in its own name, when manual marks never declared would change the lists', () => {
    expect(g().markContract).toBe('unknown');
    expect(g().positionText()).toBeNull();
    expect(g().contractPrompt).toBe(true);
    expect(g().contractFor).toBe('text');
    // and asking changes nothing on the board
    expect(g().cells[R1C2].center).toBe(bits(7, 8));
  });

  it('asks nothing when either answer writes the same text: marks that are already the whole list', () => {
    // r1c1's whole list is 4 5: marks that say the same as the open candidates
    useGame.setState({ cells: g().cells.map((c, i) => (i === R1C2 || i === R2C2 ? { ...c, corner: 0, center: 0 } : c)) });
    mark(R1C1, { center: bits(4, 5) });
    const text = g().positionText();
    expect(text).not.toBeNull();
    expect(g().contractPrompt).toBe(false);
    expect(g().markContract).toBe('unknown');
  });

  it('"my remaining candidates" writes the player’s lists, as the solver reads them, and is remembered for the puzzle', () => {
    g().positionText();
    g().answerContract('exhaustive');
    expect(g().contractPrompt).toBe(false);
    expect(g().markContract).toBe('exhaustive');
    // the answer is all it needed: no hint starts, no notice about the rings
    expect(g().hint).toBeNull();
    expect(g().notice).toBeNull();
    const text = g().positionText()!;
    expect(text).toBe(formatPencilGrid(g().cells, false, 'exhaustive'));
    // a marked cell's corner and centre marks as its list, less a digit the placed digits rule out; an unmarked cell's every candidate
    const lists = listsOf(text);
    expect([lists[R1C2], lists[R2C2], lists[R1C1]]).toEqual([bits(7, 8), bits(6, 7), bits(4, 5)]);
    expect(lists).toEqual(asRead(solverLists()));
    // remembered for the puzzle: the text asks no more, and neither does Hint
    expect(g().positionText()).toBe(text);
    g().requestHint();
    expect(g().contractPrompt).toBe(false);
  });

  it('"partial notes" writes every candidate still open, and leaves the marks out', () => {
    g().positionText();
    g().answerContract('open');
    expect(g().markContract).toBe('open');
    expect(g().notice).toBeNull();
    const lists = listsOf(g().positionText()!);
    expect([lists[R1C2], lists[R2C2], lists[R1C1]]).toEqual([bits(4, 5, 7, 8), bits(2, 4, 6, 7, 8), bits(4, 5)]);
    expect(lists).toEqual(asRead(solverLists()));
    expect(g().positionText()).toBe(formatPencilGrid(g().cells, false, 'open'));
  });

  it('closed unanswered, writes nothing and asks again next time', () => {
    expect(g().positionText()).toBeNull();
    g().dismissContractPrompt();
    expect(g().contractPrompt).toBe(false);
    expect(g().markContract).toBe('unknown');
    expect(g().positionText()).toBeNull();
    expect(g().contractFor).toBe('text');
  });

  it('the answer holds across Undo, as Hint’s does', () => {
    // a step taken before the question: the answer rewrites it too
    useGame.setState({ selection: [R1C1] });
    g().setMode('center');
    g().input(5);
    expect(g().positionText()).toBeNull();
    g().answerContract('exhaustive');
    g().undo();
    expect(g().markContract).toBe('exhaustive');
    expect(g().positionText()).not.toBeNull();
    expect(g().contractPrompt).toBe(false);
  });

  it('asks nothing without manual marks, with auto candidates on, or once the answer is known', () => {
    // no manual marks: every list is the engine's, whatever the answer would be
    g().startGame(EASY, 196, 'Easy');
    expect(g().positionText()).toBe(formatPencilGrid(g().cells, false, 'unknown'));
    expect(g().contractPrompt).toBe(false);
    // auto candidates on: the auto view's lists, the strikes out
    mark(R1C2, { center: bits(7, 8) });
    g().toggleAutoCandidates();
    expect(g().autoCandidates).toBe(true);
    expect(g().positionText()).toBe(formatPencilGrid(g().cells, true, g().markContract));
    expect(g().contractPrompt).toBe(false);
    // a known answer, given to Hint
    g().startGame(EASY, 196, 'Easy');
    mark(R1C2, { center: bits(7, 8) });
    g().requestHint();
    expect(g().contractFor).toBe('hint');
    g().answerContract('open');
    useGame.setState({ hint: null, hintStage: 'hidden' });
    expect(g().positionText()).toBe(formatPencilGrid(g().cells, false, 'open'));
    expect(g().contractPrompt).toBe(false);
  });

  it('writes the solver’s lists in every state: the text’s candidates are contractGrid’s', () => {
    let seed = 7;
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
    for (let round = 0; round < 40; round++) {
      g().startGame(EASY, 196, 'Easy');
      const cells = g().cells.map((c) =>
        c.value ? c : { ...c, corner: rand(3) ? 0 : rand(512), center: rand(3) ? 0 : rand(512), excluded: rand(4) ? 0 : bit(1 + rand(9)) }
      );
      for (const autoCandidates of [true, false]) {
        for (const markContract of ['unknown', 'exhaustive', 'open'] as const) {
          useGame.setState({ cells, autoCandidates, markContract });
          const lists = candidateLists(cells, autoCandidates, markContract);
          expect(lists, `${round} ${autoCandidates} ${markContract}`).toEqual(solverLists());
        }
      }
    }
  });
});
