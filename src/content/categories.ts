// One line per technique family, and why some catalogued techniques cannot
// be practised. Shared by the Learn dialog and the static /learn/ pages.
import { Category, PRACTICE_TECHS, TECHS, Tech } from '../engine/ratings';

export const CATEGORY_NOTES: Record<Category, string> = {
  Singles:
    'The foundation of every solve: a cell with only one possible digit, or a digit with only one possible cell.',
  Intersections:
    'Where a box crosses a row or column: candidates confined to the overlap clear the rest of the other unit.',
  Subsets:
    'N cells that between them hold only N digits lock those digits in, whether in plain sight or hidden.',
  'Basic Fish':
    'One digit whose places in N rows fall in the same N columns (or the reverse), which clears it from the rest of those lines.',
  'Finned Fish':
    'A fish with extra candidates, the fin. It still works, but only on cells that also see the fin.',
  'Complex Fish': 'Fish that use boxes as well as rows and columns.',
  'Single Digit Patterns':
    'Short chains on a single digit, built from two strong links joined by a weak one.',
  Wings:
    'A few cells whose candidates guarantee that one of them holds a particular digit, so every cell seeing all of them loses it.',
  Uniqueness:
    'Patterns that would give the puzzle two solutions, and so cannot occur in a puzzle that has exactly one.',
  'Chains and Loops':
    'Inferences passed along strong and weak links until the two ends settle something.',
  Coloring:
    'Candidates joined by strong links take two colours: one colour is entirely true, the other entirely false.',
  'Almost Locked Sets':
    'Groups of cells one candidate away from being locked, played against each other.',
  Miscellaneous: 'Rare patterns that fit no other family.',
  'Last Resort': 'Trial-based methods for positions where no pattern is left to spot.'
};

/** family names as shown: the catalogue keeps HoDoKu's spelling as its key */
export const categoryLabel = (category: Category): string =>
  category === 'Coloring' ? 'Colouring' : category;

/** why a catalogued technique cannot be practised; null when it can */
export function techStatus(tech: Tech): { mark: string; note: string } | null {
  const info = TECHS[tech];
  if (PRACTICE_TECHS.includes(tech)) return null;
  if (info.category === 'Last Resort' && info.implemented && info.enabled) {
    return {
      mark: '⚙',
      note: 'The solver uses this on the hardest puzzles. It has no pattern to spot, so it is not offered in practice.'
    };
  }
  if (info.implemented) {
    return {
      mark: '≈',
      note: 'Implemented, but never needed: an easier technique always reaches the same result first.'
    };
  }
  return {
    mark: '✗',
    note: 'Not implemented in sudokUI: the chain engines already find everything it can.'
  };
}
