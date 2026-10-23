// The colours of a hint (docs/hint-drawing.md, Colours and sizes), measured
// for contrast against the board and for colour vision: LIGHT for the light
// and rose themes and the Learn diagrams, DARK for the dark and forest
// themes. The app reads them as CSS variables (src/ui/styles.css, the
// --hint-* tokens; tests/hintPalette.test.ts holds the two equal), the
// Learn diagrams from here, so both draw the same marks.
//
// Shape carries the meaning, colour helps: a role is a filled disc with a
// near-black digit, a removal a barred ring, a placement a disc with an
// outer ring, and every arrow the one neutral ink. Each role has a fill and
// an ink: on light boards the ink is a deep edge that lifts a pale fill off
// the white; on dark boards it equals the fill, so the edge disappears.

export interface HintPalette {
  /** the pattern: blue */
  primary: string;
  primaryInk: string;
  /** what the pattern acts through: gold */
  secondary: string;
  secondaryInk: string;
  /** the exception: light purple */
  fin: string;
  finInk: string;
  /** removed: the barred ring's red */
  elim: string;
  /** placed (and, from phase 2, true): green */
  place: string;
  placeInk: string;
  /** false: the ring's blue (phase 2) */
  false: string;
  /** arrows, ties, the start dot and the walk's badges */
  arrow: string;
  /** a digit on a filled mark, and one inside a ring */
  onFill: string;
  inRing: string;
  /** how much of the ring's colour shows inside a ring, and inside a house band */
  ringTint: number;
  bandAlpha: number;
}

export const LIGHT: HintPalette = {
  primary: '#498de5',
  primaryInk: '#175bb7',
  secondary: '#f8b93f',
  secondaryInk: '#805500',
  fin: '#dec4fe',
  finInk: '#7646a5',
  elim: '#bc072a',
  place: '#57c274',
  placeInk: '#006c2f',
  false: '#175bb7',
  arrow: '#151a24',
  onFill: '#10131c',
  inRing: '#1b2233',
  ringTint: 0.1,
  bandAlpha: 0.07
};

export const DARK: HintPalette = {
  primary: '#498de5',
  primaryInk: '#498de5',
  secondary: '#f8b93f',
  secondaryInk: '#f8b93f',
  fin: '#dec4fe',
  finInk: '#dec4fe',
  elim: '#fe9696',
  place: '#35a458',
  placeInk: '#35a458',
  false: '#7fbbff',
  arrow: '#f2f4f9',
  onFill: '#10131c',
  inRing: '#eef1f8',
  ringTint: 0.16,
  bandAlpha: 0.1
};

/** the CSS variable each colour is read from in the app (src/ui/styles.css) */
export const CSS_VARS: Record<keyof HintPalette, string> = {
  primary: '--hint-primary',
  primaryInk: '--hint-primary-ink',
  secondary: '--hint-secondary',
  secondaryInk: '--hint-secondary-ink',
  fin: '--hint-fin',
  finInk: '--hint-fin-ink',
  elim: '--hint-elim',
  place: '--hint-place',
  placeInk: '--hint-place-ink',
  false: '--hint-false',
  arrow: '--hint-arrow',
  onFill: '--hint-on-fill',
  inRing: '--hint-in-ring',
  ringTint: '--hint-ring-tint',
  bandAlpha: '--hint-band-alpha'
};

/** a mark's look, by the kind the hint gives a candidate */
export type MarkKind = 'primary' | 'secondary' | 'fin' | 'elim' | 'place';

/** the fill and the edge of a filled mark of each kind */
export function fillOf(p: HintPalette, kind: Exclude<MarkKind, 'elim'>): { fill: string; ink: string } {
  if (kind === 'primary') return { fill: p.primary, ink: p.primaryInk };
  if (kind === 'secondary') return { fill: p.secondary, ink: p.secondaryInk };
  if (kind === 'fin') return { fill: p.fin, ink: p.finInk };
  return { fill: p.place, ink: p.placeInk };
}

/** the sizes of a mark, as fractions of a cell (the disc's outer radius is SIZES.r in hintGeometry.ts) */
export const MARK = {
  /** a filled disc, and the edge drawn on its rim (invisible where ink = fill) */
  disc: 0.13,
  edge: 0.02,
  /** a ring: its stroke's centre line and width (outer edge at the disc's radius) */
  ring: 0.115,
  ringStroke: 0.03,
  /** the removal bar, rim to rim at 45 degrees, over the digit */
  bar: 0.0919,
  barStroke: 0.0225,
  /** a placement's outer ring */
  placeRing: 0.165,
  placeRingStroke: 0.025,
  /** a thin ring in the board's colour round every mark, so it stays distinct over the player's own cell colours */
  keyline: 0.015,
  /** the dash of an acts-through (cover) band's outline, so base and cover differ by shape too */
  coverDash: [0.1, 0.06]
};
