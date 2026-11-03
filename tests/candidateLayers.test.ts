/**
 * Auto candidates and the player's two mark layers (the owner's report of
 * 3 November 2026, and the bug hunt that followed it: docs/candidates-2026-11.md).
 * Swap with auto candidates on says why it has nothing to swap, switching
 * auto off writes the candidates into one layer only, and then, cluster by
 * cluster: Undo and Redo put back how the board read the marks (A), the
 * strikes go with auto (B), a digit taken off gives back the marks it took
 * (E), corner-mark lists are kept when auto goes on (F), Fill under auto
 * changes nothing (G), custom entry leaves the game as it was (H), the
 * chain trainer switches auto on and off as the button does (I), Check asks
 * the mark question (J), Erase under auto acts on what the board shows (K),
 * one rule says where a candidate list goes (M), and Gather (N). The
 * review that followed (round 2): Done gives back what the board says now,
 * an Undo past the trainer's opening closes it, the notices under auto say
 * only what is true, and Check and Auto on ask the mark question only when
 * corner marks change what they do. Round 3: the handover goes with each
 * step (Undo, Redo, Back to correct) and survives a reload as Done, no
 * strike outlives auto in a cell holding a digit, and a candidate restored
 * in the trainer is in the marks at Done.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame, engineGrid, contractGrid, listLayer, type CellState, type EntryMode } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';
import { PEERS } from '../src/engine/board';

// what the store saves, kept here so a reload can read it back (persist);
// set before the store is imported, as a page's own storage is
const saved = vi.hoisted(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k)
  };
  return m;
});

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const bit = (d: number) => 1 << (d - 1);
const bits = (...ds: number[]) => ds.reduce((m, d) => m | bit(d), 0);
// cells of EASY: r1c1 has candidates 4 5 (solution 4), r1c2 4 5 7 8 (8),
// r1c4 4 9 (9), r2c2 2 4 6 7 8 (6)
const R1C1 = 0;
const R1C2 = 1;
const R1C4 = 3;
const R2C2 = 10;

const g = () => useGame.getState();
/** select cells and type digits into them in a mode */
function type(cells: number[], digits: number[], mode: EntryMode = g().mode) {
  g().setMode(mode);
  g().select(cells, false);
  for (const d of digits) g().input(d);
}
/** marks set by hand, as the player would have typed them */
function mark(cell: number, m: Partial<CellState>) {
  useGame.setState({ cells: g().cells.map((c, i) => (i === cell ? { ...c, ...m } : c)) });
}
/** what the board draws in an empty cell: the auto candidates, or the two layers */
const view = (i: number) => {
  const s = g();
  return s.autoCandidates ? { auto: engineGrid(s.cells).cands[i] } : { corner: s.cells[i].corner, center: s.cells[i].center };
};
/** the cells as data, `took` and all, for comparing positions */
const board = () => JSON.stringify(g().cells);

beforeEach(() => {
  useSettings.getState().set({ autoOffPromptDone: true, autoOffMaterialize: true, materializeLayer: 'center', confirmAssist: false });
  g().startGame(EASY, 196, 'Easy');
  useGame.setState({ notice: null });
});

describe('auto candidates and the two mark layers', () => {
  it('Swap with auto candidates on changes no cell, and says why', () => {
    // a corner mark written before auto candidates went on, hidden while they
    // are on (a note: Auto on asks, as it does for corner marks alone)
    mark(R1C1, { corner: bit(4) });
    g().toggleAutoCandidates();
    g().answerContract('open');
    expect(g().autoCandidates).toBe(true);
    const before = board();
    const history = g().history.length;
    g().convertMarks();
    expect(board()).toBe(before);
    expect(g().history).toHaveLength(history);
    expect(g().notice).toMatch(/^Auto candidates are on: .*no marks of yours to swap/);
  });

  it('Swap with auto candidates off still swaps the layers', () => {
    mark(R1C1, { corner: bit(4), center: bit(5) });
    g().convertMarks();
    expect(g().cells[R1C1]).toMatchObject({ corner: bit(5), center: bit(4) });
  });

  it('Swap with only empty, unmarked cells selected says there is nothing to swap', () => {
    g().select([R1C4], false);
    const history = g().history.length;
    g().convertMarks();
    expect(g().history).toHaveLength(history);
    expect(g().notice).toBe('No marks to swap in the selected cells');
  });

  for (const layer of ['center', 'corner'] as const) {
    it(`switching auto off into ${layer} marks clears the other layer's stale marks, and Ctrl+Z brings them back`, () => {
      useSettings.getState().set({ materializeLayer: layer });
      const other = layer === 'center' ? 'corner' : 'center';
      // marks in both layers before auto candidates went on
      mark(R1C1, { corner: bit(4) | bit(9), center: bit(5) });
      g().toggleAutoCandidates(); // on
      const shown = engineGrid(g().cells);
      g().toggleAutoCandidates(); // off, written into `layer`
      const s = g();
      for (let i = 0; i < 81; i++) {
        if (s.cells[i].given || s.cells[i].value) continue;
        expect(s.cells[i][layer]).toBe(shown.cands[i]);
        expect(s.cells[i][other]).toBe(0);
      }
      g().undo();
      expect(g().cells[R1C1]).toMatchObject({ corner: bit(4) | bit(9), center: bit(5) });
    });
  }
});

describe('A: Undo and Redo put back how the board read the marks', () => {
  it('Ctrl+Z after Auto on turns auto off again with the centre marks shown, and Ctrl+Y on again', () => {
    type([R1C1], [4], 'center');
    g().setMode('digit');
    g().toggleAutoCandidates();
    expect(view(R1C1)).toEqual({ auto: bit(4) });
    g().undo();
    expect(g().autoCandidates).toBe(false);
    expect(view(R1C1)).toEqual({ corner: 0, center: bit(4) });
    // switching auto on again keeps the player's elimination, as before
    g().redo();
    expect(g().autoCandidates).toBe(true);
    expect(view(R1C1)).toEqual({ auto: bit(4) });
  });

  it('Ctrl+Z after Auto off turns auto back on, with the contract from before', () => {
    // a Snyder note: corner 4 in r1c2, whose candidates are 4 5 7 8, beside
    // its whole list in the centre (so Auto on has nothing to ask)
    mark(R1C2, { corner: bit(4), center: bits(4, 5, 7, 8) });
    g().toggleAutoCandidates();
    expect(g().contractPrompt).toBe(false);
    g().toggleAutoCandidates(); // off, the candidates written: exhaustive
    expect(g().markContract).toBe('exhaustive');
    g().undo();
    expect(g().autoCandidates).toBe(true);
    expect(g().markContract).toBe('unknown');
    expect(view(R1C2)).toEqual({ auto: bits(4, 5, 7, 8) });
    g().undo();
    expect(g().autoCandidates).toBe(false);
    // the note is a note again: Hint asks what the marks mean
    g().requestHint();
    expect(g().contractPrompt).toBe(true);
  });

  it('Ctrl+Z after a whole-board Fill gives back the answer the player gave', () => {
    mark(R1C2, { corner: bit(4) });
    g().setMarkContract('open');
    g().fillCandidates();
    expect(g().markContract).toBe('exhaustive');
    g().undo();
    expect(g().markContract).toBe('open');
    g().check();
    expect(g().errors).toEqual([]);
    g().redo();
    expect(g().markContract).toBe('exhaustive');
  });

  it('Ctrl+Z after a jump to a step goes back to the manual board, auto off', () => {
    type([R1C1], [4], 'center');
    type([R1C2], [7], 'corner');
    const before = board();
    g().jumpToStep(3);
    expect(g().autoCandidates).toBe(true);
    g().undo();
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
  });

  it('opening the chain trainer is one step, and Ctrl+Z turns auto off again', () => {
    type([R1C1], [4], 'center');
    const steps = g().history.length;
    g().startChain();
    expect(g().history).toHaveLength(steps + 1);
    g().undo();
    expect(g().autoCandidates).toBe(false);
    expect(view(R1C1)).toEqual({ corner: 0, center: bit(4) });
  });

  it('a mark question answered holds for the steps before it: Undo past them does not ask again', () => {
    type([R1C1], [4], 'center');
    type([R1C4], [9], 'center');
    g().requestHint();
    g().answerContract('open');
    g().undo();
    expect(g().markContract).toBe('open');
  });
});

describe('B: the strikes go with auto candidates, and nothing hidden steers', () => {
  /** auto on, the true 4 in r1c1 struck by mistake, then auto off */
  function strikeTrueDigitThenAutoOff() {
    g().toggleAutoCandidates();
    type([R1C1], [4], 'center');
    expect(g().cells[R1C1].excluded).toBe(bit(4));
    g().setMode('digit');
    g().select([], false);
    g().toggleAutoCandidates();
  }

  it('written into centre marks: no strike is left, and the 4 written back counts for Check, Hint and Fill', () => {
    strikeTrueDigitThenAutoOff();
    expect(g().cells.every((c) => c.excluded === 0)).toBe(true);
    expect(g().cells[R1C1].center).toBe(bit(5));
    g().check();
    expect(g().errors).toEqual([R1C1]);
    // the player puts the 4 back by hand
    type([R1C1], [4], 'center');
    g().check();
    expect(g().errors).toEqual([]);
    expect(contractGrid(g().cells, false, g().markContract).cands[R1C1]).toBe(bits(4, 5));
    g().requestHint();
    expect(g().notice).not.toMatch(/impossible deduction/);
    expect(g().hint).not.toBeNull();
    g().dismissHint();
    g().select([], false);
    g().setMode('center');
    g().fillCandidates();
    expect(g().notice).toBe('Filled centre marks');
    expect(g().cells[R1C1].center).toBe(bits(4, 5));
    // auto on again: the 4 is a candidate, nothing dropped
    g().toggleAutoCandidates();
    expect(view(R1C1)).toEqual({ auto: bits(4, 5) });
    expect(g().notice ?? '').not.toMatch(/dropped/);
  });

  it("with Don't fill anything: a bare board, and Hint and Fill read no hidden strike", () => {
    useSettings.getState().set({ autoOffMaterialize: false });
    strikeTrueDigitThenAutoOff();
    expect(g().cells.every((c) => c.excluded === 0)).toBe(true);
    expect(contractGrid(g().cells, false, g().markContract).cands[R1C1]).toBe(bits(4, 5));
    g().requestHint();
    expect(g().notice ?? '').not.toMatch(/impossible deduction/);
    expect(g().hint).not.toBeNull();
    g().dismissHint();
    g().fillCandidates();
    expect(g().cells[R1C1].center).toBe(bits(4, 5));
  });

  it('Ctrl+Z after auto off brings the strikes back, with auto', () => {
    strikeTrueDigitThenAutoOff();
    g().undo();
    expect(g().autoCandidates).toBe(true);
    expect(g().cells[R1C1].excluded).toBe(bit(4));
  });

  for (const digit of [5, 4]) {
    it(`a strike in a cell that then gets a digit (${digit === 4 ? 'the true one' : 'a wrong one'}) goes with auto too: erased later, the digit leaves nothing hidden`, () => {
      useSettings.getState().set({ autoOffMaterialize: false });
      g().toggleAutoCandidates();
      type([R1C1], [4], 'corner'); // the true 4 struck: the cell shows a lone 5
      type([R1C1], [digit], 'digit');
      expect(g().cells[R1C1]).toMatchObject({ value: digit, excluded: bit(4) });
      g().select([], false);
      g().toggleAutoCandidates();
      expect(g().cells.every((c) => c.given || c.excluded === 0)).toBe(true);
      g().select([R1C1], false);
      g().erase();
      expect(g().cells[R1C1]).toMatchObject({ value: 0, corner: 0, center: 0, excluded: 0 });
      // Hint and Check agree, and Fill writes the true 4
      expect(contractGrid(g().cells, false, g().markContract).cands[R1C1]).toBe(bits(4, 5));
      g().requestHint();
      expect(g().notice ?? '').not.toMatch(/impossible deduction/);
      g().dismissHint();
      g().select([R1C1], false);
      g().setMode('center');
      g().fillCandidates();
      expect(g().cells[R1C1].center).toBe(bits(4, 5));
    });
  }

  it('with auto off, a digit taken off takes its cell’s strikes with it (Backspace, or the digit again); with auto on they show again', () => {
    for (const off of [() => g().erase(), () => g().input(5)]) {
      g().startGame(EASY, 196, 'Easy');
      // a strike left under a digit, as a version before this one left it
      mark(R1C1, { value: 5, excluded: bit(4) });
      g().setMode('digit');
      g().select([R1C1], false);
      off();
      expect(g().cells[R1C1]).toMatchObject({ value: 0, excluded: 0 });
    }
    // with auto on the strike is drawn, so it stays with the cell
    g().startGame(EASY, 196, 'Easy');
    g().toggleAutoCandidates();
    type([R1C1], [4], 'corner');
    type([R1C1], [5], 'digit');
    g().erase();
    expect(view(R1C1)).toEqual({ auto: bit(5) });
  });
});

describe('E: taking off a placed digit gives back the marks its placement took', () => {
  /** whole-board Fill (centre marks, exhaustive), then r1c1 selected */
  function filled() {
    g().fillCandidates();
    g().setMode('digit');
    g().select([R1C1], false);
    return board();
  }

  it('Backspace after a wrong digit: the cell and its peers get their marks back, and Check finds nothing', () => {
    const before = filled();
    g().input(5); // wrong: r1c1 is 4
    expect(g().cells[7].center & bit(5)).toBe(0); // r1c8 lost its 5
    g().erase();
    expect(board()).toBe(before);
    g().check();
    expect(g().errors).toEqual([]);
    g().requestHint();
    expect(g().notice ?? '').not.toMatch(/dropped a digit/);
  });

  it('the same digit again takes it off and gives the marks back', () => {
    const before = filled();
    g().input(5);
    g().input(5);
    expect(board()).toBe(before);
  });

  it('typing the right digit over the wrong one leaves what placing the right one at first leaves', () => {
    const before = filled();
    g().input(4);
    const right = board();
    useGame.setState({ cells: JSON.parse(before) });
    g().input(5);
    g().input(4);
    expect(board()).toBe(right);
    g().erase();
    expect(board()).toBe(before);
  });

  it('a peer that has since seen the digit placed elsewhere does not get it back', () => {
    filled();
    g().input(5);
    const took = g().cells[R1C1].took!;
    // a cleared peer, and a cell that sees it but not r1c1
    const p = took.peerCenter[0];
    const q = PEERS[p].find((x) => !PEERS[R1C1].includes(x) && x !== R1C1 && !g().cells[x].value)!;
    g().select([q], false);
    g().input(5);
    g().select([R1C1], false);
    g().erase();
    expect(g().cells[p].center & bit(5)).toBe(0);
    expect(g().cells[R1C1].center).toBe(bits(4, 5));
  });

  it('a hand-written Snyder note comes back too, in its own layer', () => {
    // corner 2 in r3c1 (candidates 2 5): its only note
    mark(18, { corner: bit(2) });
    const before = board();
    type([R1C1], [2], 'digit'); // wrong, and it clears the note
    expect(g().cells[18].corner).toBe(0);
    g().erase();
    expect(board()).toBe(before);
  });

  it('Undo still steps back through the placement and the erase', () => {
    const before = filled();
    g().input(5);
    const placed = board();
    g().erase();
    g().undo();
    expect(board()).toBe(placed);
    g().undo();
    expect(board()).toBe(before);
  });
});

describe('F: auto on keeps the eliminations of corner-mark candidate lists', () => {
  it('written into corner marks by the app, a corner mark removed by hand stays removed through auto on and off', () => {
    useSettings.getState().set({ materializeLayer: 'corner' });
    g().toggleAutoCandidates();
    g().toggleAutoCandidates(); // off, into corner marks: exhaustive
    expect(g().cells[R1C2].corner).toBe(bits(4, 5, 7, 8));
    type([R1C2], [5], 'corner'); // a correct elimination
    g().setMode('digit');
    g().select([], false);
    g().toggleAutoCandidates();
    expect(g().notice).toBe('Auto candidates on: kept your eliminations in 1 cell');
    expect(view(R1C2)).toEqual({ auto: bits(4, 7, 8) });
    g().toggleAutoCandidates();
    expect(g().cells[R1C2].corner).toBe(bits(4, 7, 8));
  });

  it('partial corner notes under the open contract are left alone', () => {
    mark(R1C2, { corner: bit(8) });
    g().setMarkContract('open');
    g().toggleAutoCandidates();
    expect(g().contractPrompt).toBe(false);
    expect(g().cells[R1C2].excluded).toBe(0);
    expect(g().notice).toBeNull();
  });

  it('under the exhaustive contract a cell with centre marks keeps its centre list', () => {
    mark(R1C2, { corner: bit(4), center: bits(7, 8) });
    g().setMarkContract('exhaustive');
    g().toggleAutoCandidates();
    expect(view(R1C2)).toEqual({ auto: bits(7, 8) });
  });
});

describe('F2: Auto on asks the mark question first when a cell has corner marks alone', () => {
  it('a centre list gathered into corner marks keeps its elimination once the marks are said to be complete', () => {
    type([R1C2], [4, 7, 8], 'center'); // the 5 ruled out by hand
    g().gatherMarks('corner');
    expect(g().cells[R1C2]).toMatchObject({ corner: bits(4, 7, 8), center: 0 });
    g().setMode('digit');
    g().toggleAutoCandidates();
    expect(g().autoCandidates).toBe(false);
    expect(g().contractPrompt).toBe(true);
    expect(g().contractFor).toBe('auto');
    g().answerContract('exhaustive');
    expect(g().contractPrompt).toBe(false);
    expect(g().autoCandidates).toBe(true);
    expect(view(R1C2)).toEqual({ auto: bits(4, 7, 8) });
    expect(g().notice).toBe('Auto candidates on: kept your eliminations in 1 cell');
  });

  it('a Fill of the selection into corner marks (the setting) keeps its eliminations through auto on and off', () => {
    useSettings.getState().set({ materializeLayer: 'corner' });
    g().setMode('digit');
    g().select([R1C1, R1C2], false);
    g().fillCandidates();
    expect(g().markContract).toBe('unknown');
    type([R1C2], [5], 'corner'); // a correct elimination
    g().setMode('digit');
    g().toggleAutoCandidates();
    g().answerContract('exhaustive');
    expect(view(R1C2)).toEqual({ auto: bits(4, 7, 8) });
    g().toggleAutoCandidates(); // off, into corner marks
    expect(g().cells[R1C2].corner).toBe(bits(4, 7, 8));
  });

  it('answered as notes, corner notes adopt nothing; closed, the question leaves auto off', () => {
    mark(R1C2, { corner: bit(8) });
    g().toggleAutoCandidates();
    g().dismissContractPrompt();
    expect(g().autoCandidates).toBe(false);
    expect(g().history).toHaveLength(0);
    g().toggleAutoCandidates();
    g().answerContract('open');
    expect(g().autoCandidates).toBe(true);
    expect(g().markContract).toBe('open');
    expect(g().cells[R1C2].excluded).toBe(0);
  });

  it('with no cell of corner marks alone it asks nothing, as before', () => {
    mark(R1C1, { center: bit(4) });
    mark(R1C2, { corner: bit(8), center: bits(4, 5, 7, 8) });
    g().toggleAutoCandidates();
    expect(g().contractPrompt).toBe(false);
    expect(g().autoCandidates).toBe(true);
    expect(g().markContract).toBe('unknown');
  });
});

describe('G: Fill candidates with auto on', () => {
  for (const mode of ['corner', 'center', 'digit'] as const) {
    it(`changes nothing in ${mode} mode, adds no step, and says why`, () => {
      mark(R1C2, { corner: bit(8), center: bits(4, 5, 7, 8) });
      g().toggleAutoCandidates();
      g().setMode(mode);
      g().select([], false);
      useGame.setState({ notice: null });
      const before = board();
      const steps = g().history.length;
      g().fillCandidates();
      expect(board()).toBe(before);
      expect(g().history).toHaveLength(steps);
      expect(g().markContract).toBe('unknown');
      expect(g().notice).toMatch(/^Auto candidates are on: .*nothing to fill/);
    });
  }

  for (const keep of [true, false]) {
    it(`Fill, Gather and Swap under auto say only what is true, with Keep candidates ${keep ? 'on' : 'off'}`, () => {
      useSettings.getState().set({ autoOffMaterialize: keep });
      mark(R1C2, { corner: bit(8), center: bits(4, 5, 7, 8) });
      g().toggleAutoCandidates();
      g().fillCandidates();
      expect(g().notice).toBe('Auto candidates are on: every empty cell already shows its candidates, so there is nothing to fill.');
      g().gatherMarks('center');
      expect(g().notice).toBe('Auto candidates are on: the app draws them, so there are no marks of yours to gather while they are on.');
      g().convertMarks();
      expect(g().notice).toBe('Auto candidates are on: the app draws them, so there are no marks of yours to swap while they are on.');
    });
  }
});

describe('H: custom entry, then Cancel, leaves the game as it was', () => {
  it('Fill and Auto pressed on the entry board reach neither the help nor the marks of the game', () => {
    mark(R1C1, { corner: bit(5) });
    g().setMarkContract('open');
    const before = board();
    expect(g().assisted).toBe(false);
    g().startCustomEntry();
    g().fillCandidates();
    g().toggleAutoCandidates();
    g().toggleAutoCandidates();
    g().cancelCustomEntry();
    expect(g().assisted).toBe(false);
    expect(g().markContract).toBe('open');
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
    expect(g().notice).toBeNull();
    g().check();
    expect(g().errors).toEqual([]);
  });
});

describe('I: the chain trainer switches auto candidates on and off as the Auto button does', () => {
  it('opened from manual marks it keeps the centre-mark eliminations, and its links follow them', () => {
    type([R1C2], [5, 7], 'center');
    g().setMode('digit');
    g().startChain();
    expect(g().autoCandidates).toBe(true);
    expect(g().cells[R1C2].excluded).toBe(bits(4, 8));
    expect(g().notice).toBe('Auto candidates on: kept your eliminations in 1 cell');
    g().chainTap(R1C2, 5);
    g().chainTap(R1C2, 7);
    expect(g().chainNote).toMatch(/^Strong link/);
  });

  it('Done puts auto back off with the player’s own marks exactly as they were', () => {
    type([R1C2], [5, 7], 'center');
    type([R1C4], [4], 'corner');
    g().setMode('digit');
    const before = board();
    g().startChain();
    g().endChain();
    expect(g().chain).toBeNull();
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
    // and a step for Ctrl+Z, which reopens nothing but the auto view
    g().undo();
    expect(g().autoCandidates).toBe(true);
  });

  it('opened with auto on already, Done leaves it on', () => {
    g().toggleAutoCandidates();
    g().startChain();
    g().endChain();
    expect(g().autoCandidates).toBe(true);
  });

  it('a new game, the next practice puzzle and Restart close it', () => {
    g().startChain([{ cell: R1C2, digit: 4 }]);
    g().restart();
    expect(g().chain).toBeNull();
    expect(g().chainGoal).toBeNull();
    g().startChain([{ cell: R1C2, digit: 4 }]);
    g().startGame(EASY, 196, 'Easy', 'X_CHAIN');
    expect(g().chain).toBeNull();
    expect(g().chainGoal).toBeNull();
    g().startChain();
    g().startGame('4.....8.5.3..........7......2.....6.....8.4......1.......6.3.7.5..2.....1.4......', 1000, 'Hard');
    expect(g().chain).toBeNull();
  });

  // r7c8 = r9c8, the only places for 8 in box 9: r1c8 (5 7 8 9) and r2c8
  // (2 7 8) lose their 8
  const R1C8 = 7;
  const R2C8 = 16;
  function applyBox9Chain() {
    g().chainTap(61, 8);
    g().chainTap(79, 8);
    g().chainApply();
    expect(g().cells[R1C8].excluded & bit(8)).toBe(bit(8));
  }

  it('an applied chain, undone, leaves nothing behind at Done: the marks as they were, no strike', () => {
    type([R1C8], [5, 7, 8, 9], 'center');
    type([R2C8], [2, 7, 8], 'center');
    g().setMode('digit');
    const before = board();
    g().startChain();
    applyBox9Chain();
    g().undo();
    expect(g().chain).not.toBeNull();
    g().endChain();
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
    // nothing hidden: Hint reads the 8s the board shows, and Fill corrects nothing
    expect(contractGrid(g().cells, false, g().markContract).cands[R1C8]).toBe(bits(5, 7, 8, 9));
    g().select([], false);
    g().fillCandidates();
    expect(g().notice).toBe('Filled centre marks');
  });

  it('with no marks, a chain undone before Done is a candidate again when auto goes on', () => {
    g().startChain();
    applyBox9Chain();
    g().undo();
    g().endChain();
    expect(g().cells.every((c) => c.excluded === 0)).toBe(true);
    g().toggleAutoCandidates();
    expect(view(R1C8)).toEqual({ auto: bits(5, 7, 8, 9) });
  });

  it('a chain still applied at Done stays: out of the marks, and struck where there are none', () => {
    type([R1C8], [5, 7, 8, 9], 'center');
    g().setMode('digit');
    g().startChain();
    applyBox9Chain();
    g().endChain();
    expect(g().cells[R1C8]).toMatchObject({ center: bits(5, 7, 9), excluded: bit(8) });
    expect(g().cells[R2C8]).toMatchObject({ center: 0, excluded: bit(8) });
    g().toggleAutoCandidates();
    expect(view(R2C8)).toEqual({ auto: bits(2, 7) });
  });

  it('a digit struck while it is open leaves the marks at Done, and a true digit struck is no hidden strike', () => {
    type([R1C1], [4, 5], 'center'); // solution 4
    g().setMode('digit');
    g().startChain();
    type([R1C1], [4], 'corner'); // the true 4 struck by mistake
    type([R1C4], [9], 'corner'); // r1c4 has no marks: its true 9 struck
    g().setMode('digit');
    g().endChain();
    expect(g().cells[R1C1]).toMatchObject({ center: bit(5), excluded: 0 });
    expect(g().cells[R1C4]).toMatchObject({ corner: 0, center: 0, excluded: 0 });
    // what the board shows is what Check reads
    g().check();
    expect(g().errors).toEqual([R1C1]);
  });

  it('Chain pressed again while it is open keeps the handover: Done still puts auto back off', () => {
    type([R1C1], [4], 'corner');
    g().setMode('digit');
    const before = board();
    g().startChain();
    const steps = g().history.length;
    g().startChain();
    expect(g().history).toHaveLength(steps);
    g().endChain();
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
  });

  it('an Undo past its opening closes it: auto off, the board as before, nothing left for Done', () => {
    type([R1C1], [4], 'center');
    g().setMode('digit');
    const before = board();
    g().startChain();
    g().undo();
    expect(g().autoCandidates).toBe(false);
    expect(g().chain).toBeNull();
    expect(g().chainHandover).toBeNull();
    expect(board()).toBe(before);
    // Redo gives back the step's board, auto on; the trainer stays closed,
    // and no handover is left without it
    g().redo();
    expect(g().autoCandidates).toBe(true);
    expect(g().chain).toBeNull();
    expect(g().chainHandover).toBeNull();
  });

  it('a Redo or a jump back to the last correct position that turns auto off closes it too', () => {
    g().toggleAutoCandidates();
    g().toggleAutoCandidates();
    g().undo(); // auto on again
    g().startChain();
    g().redo();
    expect(g().autoCandidates).toBe(false);
    expect(g().chain).toBeNull();
    // a wrong digit, then the trainer, then Check and the jump back
    g().startGame(EASY, 196, 'Easy');
    type([R1C1], [5], 'digit');
    g().startChain();
    g().check();
    expect(g().revertIndex).not.toBeNull();
    g().revertToValid();
    expect(g().autoCandidates).toBe(false);
    expect(g().chain).toBeNull();
    expect(g().chainHandover).toBeNull();
  });

  it('Back to the last correct position while it is open keeps the handover: Done still puts auto back off', () => {
    type([R1C1], [4], 'corner');
    g().setMode('digit');
    const before = board();
    g().startChain();
    type([R1C2], [7], 'digit'); // wrong: r1c2 is 8
    g().check();
    expect(g().revertIndex).not.toBeNull();
    g().revertToValid();
    expect(g().autoCandidates).toBe(true);
    expect(g().chain).not.toBeNull();
    expect(g().chainHandover).not.toBeNull();
    g().endChain();
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
  });

  it('a jump back to a step from before it opened, with auto on then, has no handover: Done leaves auto on, as the player had it', () => {
    g().toggleAutoCandidates();
    type([R1C2], [7], 'digit'); // wrong
    g().select([], false);
    g().toggleAutoCandidates();
    g().startChain();
    expect(g().chainHandover).not.toBeNull();
    g().check();
    g().revertToValid();
    expect(g().autoCandidates).toBe(true);
    expect(g().chain).not.toBeNull();
    expect(g().chainHandover).toBeNull();
    g().endChain();
    expect(g().autoCandidates).toBe(true);
  });

  it('Auto switched off while it is open, then Ctrl+Z: the handover comes back with the step, and Done puts auto back off', () => {
    type([R1C1], [4], 'corner');
    g().setMode('digit');
    const before = board();
    g().startChain();
    g().toggleAutoCandidates();
    expect(g().chainHandover).toBeNull();
    g().undo();
    expect(g().autoCandidates).toBe(true);
    expect(g().chain).not.toBeNull();
    expect(g().chainHandover).not.toBeNull();
    g().endChain();
    expect(g().autoCandidates).toBe(false);
    expect(board()).toBe(before);
  });

  it('a candidate restored while it is open is in the marks at Done: by Erase, or the struck digit pressed again', () => {
    const restores = [
      () => {
        g().setMode('digit');
        g().select([R1C2], false);
        g().erase();
      },
      () => type([R1C2], [8], 'corner')
    ];
    for (const restore of restores) {
      g().startGame(EASY, 196, 'Easy');
      type([R1C2], [4, 5, 7], 'center'); // the true 8 lost
      g().setMode('digit');
      g().startChain();
      expect(g().cells[R1C2].excluded).toBe(bit(8));
      restore();
      expect(view(R1C2)).toEqual({ auto: bits(4, 5, 7, 8) });
      g().setMode('digit');
      g().endChain();
      expect(g().cells[R1C2]).toMatchObject({ center: bits(4, 5, 7, 8), excluded: 0 });
      g().check();
      expect(g().errors).toEqual([]);
    }
  });

  it('a strike in a cell that gets a digit while it is open goes at Done: erased later, the digit leaves nothing hidden', () => {
    g().startChain();
    type([R1C1], [4], 'corner'); // the true 4 struck
    type([R1C1], [5], 'digit'); // and the 5 left placed
    g().endChain();
    expect(g().cells[R1C1]).toMatchObject({ value: 5, excluded: 0 });
    g().select([R1C1], false);
    g().erase();
    expect(g().cells[R1C1].excluded).toBe(0);
    g().requestHint();
    expect(g().notice ?? '').not.toMatch(/impossible deduction/);
  });
});

describe('a reload', () => {
  const R1C8 = 7;
  const R2C8 = 16;
  /** the page starts again, with nothing in memory but what was saved */
  async function reload() {
    const game = saved.get('sudokui-game-v1')!;
    useGame.setState({ info: null, chain: null, chainHandover: null, autoCandidates: false, history: [], future: [] });
    saved.set('sudokui-game-v1', game);
    await useGame.persist.rehydrate();
  }

  it('with the chain trainer open closes it as Done does: auto off, the marks back less a chain still applied', async () => {
    type([R1C2], [4, 5], 'corner');
    type([R1C8], [5, 7, 8, 9], 'center');
    g().setMode('digit');
    g().startChain();
    // r7c8 = r9c8: r1c8 and r2c8 lose their 8
    g().chainTap(61, 8);
    g().chainTap(79, 8);
    g().chainApply();
    await reload();
    expect(g().autoCandidates).toBe(false);
    expect(g().chainHandover).toBeNull();
    expect(g().cells[R1C2]).toMatchObject({ corner: bits(4, 5), center: 0, excluded: 0 });
    expect(g().cells[R1C8]).toMatchObject({ center: bits(5, 7, 9), excluded: bit(8) });
    expect(g().cells[R2C8]).toMatchObject({ center: 0, excluded: bit(8) });
  });

  it('of a save without a handover (auto on by the player, or a save from before) keeps auto on', async () => {
    g().toggleAutoCandidates();
    type([R1C1], [5], 'corner');
    const game = JSON.parse(saved.get('sudokui-game-v1')!);
    delete game.state.chainHandover;
    saved.set('sudokui-game-v1', JSON.stringify(game));
    await reload();
    expect(g().autoCandidates).toBe(true);
    expect(g().cells[R1C1].excluded).toBe(bit(5));
  });

  it('with auto off, of a save that holds a strike under a digit (from before this version), drops it', async () => {
    mark(R1C1, { value: 5, excluded: bit(4) });
    mark(R1C2, { excluded: bits(7, 8) }); // r1c2 is 8: its 8 goes, the 7 stays
    await reload();
    expect(g().cells[R1C1]).toMatchObject({ value: 5, excluded: 0 });
    expect(g().cells[R1C2].excluded).toBe(bit(7));
  });
});

describe('J: Check reads corner-mark candidate lists', () => {
  it('with manual marks and the contract unknown it asks the mark question first, and the answer runs it', () => {
    // a corner list of r1c2 that has lost its true 8
    type([R1C2], [4, 5, 7], 'corner');
    g().check();
    expect(g().contractPrompt).toBe(true);
    expect(g().contractFor).toBe('check');
    expect(g().assisted).toBe(false);
    g().answerContract('exhaustive');
    expect(g().errors).toEqual([R1C2]);
    expect(g().notice).toBe('1 problem found: values or candidate lists missing the true digit');
  });

  it('answered as notes, the corner marks are notes and Check passes them', () => {
    type([R1C2], [4, 5, 7], 'corner');
    g().check();
    g().answerContract('open');
    expect(g().errors).toEqual([]);
    expect(g().notice).toBe('Everything checks out so far');
  });

  it('on a board of centre marks it asks nothing and checks at once, as before', () => {
    type([R1C1], [5], 'center'); // a centre list that has lost the true 4
    g().check();
    expect(g().contractPrompt).toBe(false);
    expect(g().errors).toEqual([R1C1]);
    expect(g().markContract).toBe('unknown');
  });

  it('corner marks the centre marks already hold ask nothing; a corner digit of their own asks', () => {
    mark(R1C2, { corner: bits(4, 5), center: bits(4, 5, 7) }); // the centre list has lost the 8
    g().check();
    expect(g().contractPrompt).toBe(false);
    expect(g().errors).toEqual([R1C2]);
    mark(R1C2, { corner: bit(8), center: bits(4, 5, 7) });
    g().check();
    expect(g().contractPrompt).toBe(true);
    // the two layers together are the list 4 5 7 8
    g().answerContract('exhaustive');
    expect(g().errors).toEqual([]);
  });

  it('closing the question runs no Check', () => {
    type([R1C2], [4, 5, 7], 'corner');
    g().check();
    g().dismissContractPrompt();
    expect(g().contractPrompt).toBe(false);
    expect(g().assisted).toBe(false);
  });
});

describe('K: Erase in Digit mode with auto on acts on what the board shows', () => {
  it('the first press brings back the struck candidates, the next the colour; the hidden marks stay', () => {
    type([R1C2], [5, 7], 'corner');
    type([R1C2], [3], 'color');
    g().toggleAutoCandidates();
    g().answerContract('open'); // the corner marks are notes
    type([R1C2], [8], 'corner'); // struck
    expect(view(R1C2)).toEqual({ auto: bits(4, 5, 7) });
    g().setMode('digit');
    g().erase();
    expect(view(R1C2)).toEqual({ auto: bits(4, 5, 7, 8) });
    expect(g().cells[R1C2].corner).toBe(bits(5, 7));
    expect(g().cells[R1C2].colors).toEqual([2]);
    g().erase();
    expect(g().cells[R1C2].colors).toEqual([]);
    expect(g().cells[R1C2].corner).toBe(bits(5, 7));
  });

  it('with only hidden marks, the first press clears the colour', () => {
    type([R1C2], [5, 7], 'corner');
    type([R1C2], [3], 'color');
    g().toggleAutoCandidates();
    g().answerContract('open');
    g().setMode('digit');
    g().erase();
    expect(g().cells[R1C2].colors).toEqual([]);
    expect(g().cells[R1C2].corner).toBe(bits(5, 7));
  });
});

describe('M: one rule for where a candidate list goes', () => {
  it('the Corner or Centre tab’s layer, else the setting', () => {
    useSettings.getState().set({ materializeLayer: 'corner' });
    expect(listLayer('digit')).toBe('corner');
    expect(listLayer('color')).toBe('corner');
    expect(listLayer('center')).toBe('center');
    useSettings.getState().set({ materializeLayer: 'center' });
    expect(listLayer('corner')).toBe('corner');
    expect(listLayer('digit')).toBe('center');
  });

  it('Fill in Digit mode follows the setting; in a tab, the tab', () => {
    useSettings.getState().set({ materializeLayer: 'corner' });
    g().setMode('digit');
    g().fillCandidates();
    expect(g().cells[R1C2]).toMatchObject({ corner: bits(4, 5, 7, 8), center: 0 });
    expect(g().notice).toBe('Filled corner marks');
    g().startGame(EASY, 196, 'Easy');
    g().setMode('center');
    g().fillCandidates();
    expect(g().cells[R1C2]).toMatchObject({ corner: 0, center: bits(4, 5, 7, 8) });
  });

  it('auto off writes into the active tab’s layer, else the setting, and the prompt’s answer wins', () => {
    useSettings.getState().set({ materializeLayer: 'center' });
    g().toggleAutoCandidates();
    g().setMode('corner');
    g().toggleAutoCandidates();
    expect(g().cells[R1C2]).toMatchObject({ corner: bits(4, 5, 7, 8), center: 0 });
    expect(g().notice).toBe('Auto candidates off. Current state written to corner marks (Ctrl+Z reverts)');
    g().startGame(EASY, 196, 'Easy');
    useSettings.getState().set({ materializeLayer: 'corner' });
    g().toggleAutoCandidates();
    g().setMode('digit');
    g().toggleAutoCandidates();
    expect(g().cells[R1C2]).toMatchObject({ corner: bits(4, 5, 7, 8), center: 0 });
    // the first auto-off prompt answered "Centre marks", in the Corner tab
    g().startGame(EASY, 196, 'Easy');
    g().toggleAutoCandidates();
    g().setMode('corner');
    g().toggleAutoCandidates('center');
    expect(g().cells[R1C2]).toMatchObject({ corner: 0, center: bits(4, 5, 7, 8) });
  });
});

describe('N: Gather puts every mark into one layer', () => {
  function marked() {
    // corner only in three cells, centre only in one, both in two
    mark(R1C1, { corner: bits(4, 5) });
    mark(R1C2, { corner: bit(8) });
    mark(R1C4, { corner: bits(4, 9) });
    mark(R2C2, { center: bits(2, 6) });
    mark(18, { corner: bit(2), center: bits(2, 5) });
    mark(19, { corner: bit(5), center: bits(2, 5, 7) });
  }

  it('into centre marks: cells with corner marks alone move them, cells with both are left and counted', () => {
    marked();
    const before = board();
    const steps = g().history.length;
    g().gatherMarks('center');
    const c = g().cells;
    expect(c[R1C1]).toMatchObject({ corner: 0, center: bits(4, 5) });
    expect(c[R1C2]).toMatchObject({ corner: 0, center: bit(8) });
    expect(c[R1C4]).toMatchObject({ corner: 0, center: bits(4, 9) });
    expect(c[R2C2]).toMatchObject({ corner: 0, center: bits(2, 6) });
    expect(c[18]).toMatchObject({ corner: bit(2), center: bits(2, 5) });
    expect(c[19]).toMatchObject({ corner: bit(5), center: bits(2, 5, 7) });
    expect(g().notice).toBe('Gathered into centre marks in 3 cells; 2 cells have marks in both and were left as they are');
    // one step, pure notation: no help, the contract as it was
    expect(g().history).toHaveLength(steps + 1);
    expect(g().assisted).toBe(false);
    expect(g().markContract).toBe('unknown');
    g().undo();
    expect(board()).toBe(before);
  });

  it('into corner marks, and with empty cells selected, only those', () => {
    marked();
    g().select([R2C2, R1C1], false);
    g().gatherMarks('corner');
    expect(g().cells[R2C2]).toMatchObject({ corner: bits(2, 6), center: 0 });
    expect(g().cells[R1C1]).toMatchObject({ corner: bits(4, 5), center: 0 });
    expect(g().notice).toBe('Gathered into corner marks in 1 selected cell');
  });

  it('with only unmarked cells selected it says there is nothing in the selected cells, and leaves the rest', () => {
    marked();
    const before = board();
    g().select([3 * 9 + 4], false); // r4c5, empty and unmarked
    g().gatherMarks('center');
    expect(board()).toBe(before);
    expect(g().notice).toBe('Nothing to gather into centre marks in the selected cells');
  });

  it('with nothing to gather it says so and adds no step', () => {
    mark(R1C1, { center: bits(4, 5) });
    g().gatherMarks('center');
    expect(g().history).toHaveLength(0);
    expect(g().notice).toBe('Nothing to gather into centre marks');
  });

  it('with auto candidates on it changes nothing and says why', () => {
    marked();
    g().toggleAutoCandidates();
    g().answerContract('open');
    expect(g().autoCandidates).toBe(true);
    const before = board();
    const steps = g().history.length;
    g().gatherMarks('center');
    expect(board()).toBe(before);
    expect(g().history).toHaveLength(steps);
    expect(g().notice).toMatch(/^Auto candidates are on: .*no marks of yours to gather/);
  });
});
