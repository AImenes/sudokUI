// The rating follows the player's uniqueness setting (docs/architecture.md,
// "The rating follows the uniqueness setting"). A player who does not use
// uniqueness (settings.useUniqueness off) gets hints that never use it, so
// the figure the game shows is worked out without it too (shownRating in
// gameStore.ts). Worked out by the background worker, never on the main
// thread: a hard puzzle takes a second to rate without uniqueness (the
// Washington Post's of November 2026, 1.2 s), and the board must not wait.
import { useGame, followsPlain, shownRating } from './gameStore';
import type { ShownRating } from './gameStore';
import { useSettings } from './settings';
import { ratePuzzleOff } from './pools';

/** puzzles whose rating without uniqueness is being worked out */
const asking = new Set<string>();

/** work out the current game's rating without uniqueness, where the player's setting asks for it and it is not known yet */
function follow() {
  const { info, plainRatings } = useGame.getState();
  if (!info || !followsPlain(info, useSettings.getState().useUniqueness)) return;
  const puzzle = info.puzzle;
  if (plainRatings[puzzle] || asking.has(puzzle)) return;
  asking.add(puzzle);
  void ratePuzzleOff(puzzle).then((rating) => {
    asking.delete(puzzle);
    if (rating) useGame.getState().setPlainRating(puzzle, rating);
  });
}

let following = false;

/**
 * From now on, keep the figure the game shows true to the player's
 * setting: whenever a game opens, or the setting is switched off mid-game.
 * Called once at start-up (src/main.tsx).
 */
export function followPlainRatings() {
  if (following) return;
  following = true;
  useGame.subscribe((s, prev) => {
    if (s.info?.puzzle !== prev.info?.puzzle || s.info?.practiceTech !== prev.info?.practiceTech) follow();
  });
  useSettings.subscribe((s, prev) => {
    if (s.useUniqueness !== prev.useUniqueness) follow();
  });
  follow();
}

/** the rating the current game shows, for the player's setting; null without a game */
export function useShownRating(): ShownRating | null {
  const info = useGame((s) => s.info);
  const plainRatings = useGame((s) => s.plainRatings);
  const useUniqueness = useSettings((s) => s.useUniqueness);
  return info ? shownRating(info, useUniqueness, plainRatings) : null;
}
