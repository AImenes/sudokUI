/**
 * New-game hygiene: auto candidates never carry over from the previous game.
 * A sticky auto flag would silently cost the clean badge and give daily
 * players an unequal start; fast-forwarded practice is the one exception
 * (auto on, and the game already counts as assisted).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';

const EASY =
  '..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..';

describe('auto candidates across games', () => {
  beforeEach(() => {
    useGame.setState({ autoCandidates: false, assisted: false });
  });

  it('a new game starts with auto off even when the last game had it on', () => {
    useGame.setState({ autoCandidates: true });
    useGame.getState().startGame(EASY, 196, 'Beginner');
    expect(useGame.getState().autoCandidates).toBe(false);
    expect(useGame.getState().assisted).toBe(false);
  });

  it('fast-forwarded practice turns auto on and counts as assisted', () => {
    useSettings.getState().set({ practiceFastForward: true });
    useGame.getState().startGame(EASY, 196, 'Beginner', 'NAKED_PAIR');
    expect(useGame.getState().autoCandidates).toBe(true);
    expect(useGame.getState().assisted).toBe(true);
  });

  it('practice without fast-forward starts bare and clean', () => {
    useSettings.getState().set({ practiceFastForward: false });
    useGame.setState({ autoCandidates: true });
    useGame.getState().startGame(EASY, 196, 'Beginner', 'NAKED_PAIR');
    expect(useGame.getState().autoCandidates).toBe(false);
    expect(useGame.getState().assisted).toBe(false);
    useSettings.getState().set({ practiceFastForward: true });
  });
});
