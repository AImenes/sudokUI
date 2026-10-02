// One line per technique family, and why some catalogued techniques cannot
// be practised. Shared by the Learn dialog and the static /learn/ pages.
import { ALL_TECHS, Category, PRACTICE_TECHS, TECHS, Tech } from '../engine/ratings';

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

/**
 * The order families are listed in, wherever techniques are shown by
 * family. It follows the ideas rather than the solver's search order:
 * locked sets (singles to fish, all fish together), the one-digit chains,
 * the almost locked sets with the wings first, the general chains, then
 * the uniqueness side branch and what fits nowhere else.
 */
export const FAMILY_ORDER: Category[] = [
  'Singles',
  'Intersections',
  'Subsets',
  'Basic Fish',
  'Finned Fish',
  'Complex Fish',
  'Single Digit Patterns',
  'Coloring',
  'Wings',
  'Almost Locked Sets',
  'Chains and Loops',
  'Uniqueness',
  'Miscellaneous',
  'Last Resort'
];

/** the techniques grouped by family, families in FAMILY_ORDER, techniques in catalogue order */
export function techniquesByFamily(techs: Tech[] = ALL_TECHS): [Category, Tech[]][] {
  return FAMILY_ORDER.map((cat) => [cat, techs.filter((t) => TECHS[t].category === cat)] as [Category, Tech[]]).filter(
    ([, list]) => list.length > 0
  );
}

/** family names as shown: the catalogue keeps HoDoKu's spelling as its key */
export const categoryLabel = (category: Category): string =>
  category === 'Coloring' ? 'Colouring' : category;

/** why a catalogued technique cannot be practised; null when it can */
export function techStatus(tech: Tech): { mark: string; note: string } | null {
  const info = TECHS[tech];
  if (PRACTICE_TECHS.includes(tech)) return null;
  if (tech === 'TRIDAGON') {
    return {
      mark: '≈',
      note: 'Only ever needed in puzzles made by hand for it: none can be generated, so it is not offered in practice.'
    };
  }
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
