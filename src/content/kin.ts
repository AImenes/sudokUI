// The same idea under another name, or the same logic in another family:
// the short line under a technique's name in the guide, the practice list
// and the static pages. "Also called" lists every alias; this line keeps
// the one or two that teach something, such as Bent Quad for WXYZ-Wing,
// and the cross-family views from docs/concepts_description.md: a Hidden
// Single is a 1-fish, an X-Wing a naked pair seen sideways.
//
// Only relationships that hold every time belong here. A technique with no
// such relationship has no line; the Intuition guide explains the rest.
import { Tech } from '../engine/ratings';

export const KIN: Partial<Record<Tech, string[]>> = {
  FULL_HOUSE: ['naked and hidden single at once'],
  NAKED_SINGLE: ['naked subset of one'],
  HIDDEN_SINGLE: ['1-fish', 'hidden subset of one'],

  LOCKED_PAIR: ['Naked Pair clearing two units'],
  LOCKED_TRIPLE: ['Naked Triple clearing two units'],
  LOCKED_CANDIDATES_1: ['1-fish: box onto line'],
  LOCKED_CANDIDATES_2: ['Box/Line Reduction', '1-fish: line onto box'],

  NAKED_PAIR: ['flip side of a hidden subset', 'in a line: X-Wing sideways'],
  NAKED_TRIPLE: ['flip side of a hidden subset', 'in a line: Swordfish sideways'],
  NAKED_QUADRUPLE: ['flip side of a hidden subset', 'in a line: Jellyfish sideways'],
  HIDDEN_PAIR: ['flip side of a naked subset', 'in a line: X-Wing sideways'],
  HIDDEN_TRIPLE: ['flip side of a naked subset', 'in a line: Swordfish sideways'],
  HIDDEN_QUADRUPLE: ['flip side of a naked subset', 'in a line: Jellyfish sideways'],

  X_WING: ['2-fish', 'Naked Pair seen sideways', '4-candidate X-Cycle'],
  SWORDFISH: ['3-fish', 'Naked Triple seen sideways'],
  JELLYFISH: ['4-fish', 'Naked Quadruple seen sideways'],
  SQUIRMBAG: ['5-fish', 'flip side of a smaller fish'],
  WHALE: ['6-fish', 'flip side of a smaller fish'],
  LEVIATHAN: ['7-fish', 'flip side of a smaller fish'],

  SKYSCRAPER: ['Turbot Fish shape', '4-candidate X-Chain', 'two Sashimi X-Wings'],
  TWO_STRING_KITE: ['Turbot Fish shape', '4-candidate X-Chain'],
  TURBOT_FISH: ['4-candidate X-Chain'],
  EMPTY_RECTANGLE: ['Grouped Nice Loop'],

  W_WING: ['a short AIC, not bent'],
  XY_WING: ['Y-Wing', 'bent triple', '3-cell XY-Chain'],
  XYZ_WING: ['bent triple', 'ALS-XZ'],
  WXYZ_WING: ['bent quad', 'ALS-XZ'],

  SIMPLE_COLORS: ['all X-Chains in one cluster'],
  MULTI_COLORS: ['X-Chains and loops across two clusters'],
  MEDUSA_3D: ['colouring across all digits'],

  REMOTE_PAIR: ['XY-Chain of one pair'],
  X_CHAIN: ['single-digit AIC'],
  X_CYCLES: ['single-digit Nice Loop'],
  GROUPED_X_CYCLES: ['single-digit Grouped Nice Loop'],
  XY_CHAIN: ['XY-Wing is the 3-cell case'],
  NICE_LOOP: ['an AIC written as a loop'],
  AIC: ['umbrella over X- and XY-Chains'],

  ALS_XZ: ['ALS chain of two sets', 'VWXYZ-Wing is a special case'],
  ALS_XY_WING: ['XY-Wing made of sets'],
  ALS_XY_CHAIN: ['XY-Chain made of sets'],
  DEATH_BLOSSOM: ['Cell Forcing Chain through sets'],
  SUE_DE_COQ: ['Two-Sector Disjoint Subsets'],

  AVOIDABLE_RECTANGLE_1: ['Unique Rectangle using cells you solved'],
  AVOIDABLE_RECTANGLE_2: ['Unique Rectangle using cells you solved'],
  ALIGNED_PAIR_EXCLUSION: ['XYZ-Wing is a special case'],

  PATTERN_OVERLAY: ['every one-digit pattern at once']
};

/** the line under a technique's name: empty when it has none */
export const kinLine = (tech: Tech): string => (KIN[tech] ?? []).join(' · ');
