// User preferences, persisted to localStorage. Kept separate from the game
// store so changing a setting never touches game state or undo history.
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MarkLayer = 'center' | 'corner';

export type Theme = 'dark' | 'light' | 'rose' | 'forest';

interface Settings {
  /** board theme: dark, daylight or rosé */
  theme: Theme;
  /** tint the row/column/box of a single selected cell */
  highlightPeers: boolean;
  /** tint all cells holding the same digit as the selection */
  highlightSameDigit: boolean;
  showTimer: boolean;
  /** when auto candidates are switched off, write the current candidate
   *  state into pencil marks so play continues seamlessly */
  autoOffMaterialize: boolean;
  /** which mark layer receives those candidates. Centre is the convention
   *  for exhaustive candidate lists; corner puts them in the digit-bound
   *  3×3 layout that hint highlights align with */
  materializeLayer: MarkLayer;
  /** practice mode jumps straight to the position where the chosen
   *  technique is the next step; off = play the puzzle from the start */
  practiceFastForward: boolean;
  /** the one-time "keep your candidates?" prompt on first auto-off has been
   *  answered */
  autoOffPromptDone: boolean;
  /** hide the difficulty badge and rating while playing (revealed on solve) —
   *  knowing a puzzle is rated 1200 tells you to expect advanced techniques */
  hideRating: boolean;
  /** show Nutella, the resident poodle, beneath the board */
  showPoodle: boolean;
  /** draw a thin frame around highlighted candidates (the held digit's
   *  pencil occurrences) — bold + colour alone can be hard to spot */
  frameHighlights: boolean;

  toggleTheme: () => void;
  set: (p: Partial<Omit<Settings, 'toggleTheme' | 'set'>>) => void;
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'dark',
      highlightPeers: true,
      highlightSameDigit: true,
      showTimer: true,
      autoOffMaterialize: true,
      materializeLayer: 'center',
      practiceFastForward: true,
      autoOffPromptDone: false,
      hideRating: false,
      showPoodle: false,
      frameHighlights: true,
      toggleTheme: () =>
        set((s) => ({
          theme:
            s.theme === 'dark'
              ? 'light'
              : s.theme === 'light'
                ? 'rose'
                : s.theme === 'rose'
                  ? 'forest'
                  : 'dark'
        })),
      set: (p) => set(p)
    }),
    { name: 'sudokui-settings-v1' }
  )
);
