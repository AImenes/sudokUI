/**
 * Auto candidates and the player's two mark layers (the owner's report of
 * 3 November 2026): Swap with auto candidates on says why it has nothing to
 * swap, and switching auto off writes the candidates into one layer only,
 * so no cell is left with stale marks in the other.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame, engineGrid } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';

const EASY = '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';
const bit = (d: number) => 1 << (d - 1);

describe('auto candidates and the two mark layers', () => {
  beforeEach(() => {
    useGame.getState().startGame(EASY, 196, 'Easy');
    useSettings.getState().set({ autoOffPromptDone: true });
  });

  it('Swap with auto candidates on changes no cell, and says why', () => {
    // a corner mark written before auto candidates went on, hidden while they are on
    const cells = useGame.getState().cells.map((c, i) => (i === 0 ? { ...c, corner: bit(4) } : c));
    useGame.setState({ cells });
    useGame.getState().toggleAutoCandidates();
    const before = JSON.stringify(useGame.getState().cells);
    const history = useGame.getState().history.length;
    useGame.getState().convertMarks();
    expect(JSON.stringify(useGame.getState().cells)).toBe(before);
    expect(useGame.getState().history).toHaveLength(history);
    expect(useGame.getState().notice).toMatch(/^Auto candidates are on: .*no marks of yours to swap/);
  });

  it('Swap with auto candidates off still swaps the layers', () => {
    const cells = useGame.getState().cells.map((c, i) => (i === 0 ? { ...c, corner: bit(4), center: bit(5) } : c));
    useGame.setState({ cells });
    useGame.getState().convertMarks();
    expect(useGame.getState().cells[0]).toMatchObject({ corner: bit(5), center: bit(4) });
  });

  for (const layer of ['center', 'corner'] as const) {
    it(`switching auto off into ${layer} marks clears the other layer's stale marks, and Ctrl+Z brings them back`, () => {
      useSettings.getState().set({ autoOffMaterialize: true, materializeLayer: layer });
      const other = layer === 'center' ? 'corner' : 'center';
      // marks in both layers before auto candidates went on
      const cells = useGame.getState().cells.map((c, i) => (i === 0 ? { ...c, corner: bit(4) | bit(9), center: bit(5) } : c));
      useGame.setState({ cells });
      useGame.getState().toggleAutoCandidates(); // on
      useGame.getState().toggleAutoCandidates(); // off, written into `layer`
      const s = useGame.getState();
      const g = engineGrid(s.cells);
      for (let i = 0; i < 81; i++) {
        if (s.cells[i].given || s.cells[i].value) continue;
        expect(s.cells[i][layer]).toBe(g.cands[i]);
        expect(s.cells[i][other]).toBe(0);
      }
      useGame.getState().undo();
      expect(useGame.getState().cells[0]).toMatchObject({ corner: bit(4) | bit(9), center: bit(5) });
    });
  }
});
