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
// A colouring's shades (docs/hint-drawing-colouring.md, Colours) keep that
// rule, with two differences: on light boards both shades of a cluster take
// its dark shade as their edge, so the light one reads as a disc of the
// same hue; and that edge is thin (MARK.shadeEdge): on a phone the eye
// mixes a rim into its disc, and a wide one pulls the light shade to the
// dark.
//
// Phase 4's sets (docs/hint-drawing-sets.md, Colours) add the pale "one of
// these" square, opaque and edged in the true ink, and three tints for the
// almost locked sets, sand, rose and violet: a tile's fill at half
// strength, with an ink of its own for the tile's outline and its letter
// tab. A set is named by its letter, never by its tint.

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
  /**
   * a colouring's two shades per cluster (docs/hint-drawing-colouring.md,
   * Colours): purple for the first cluster, orange for Multi Colors' second;
   * dark for one parity, light for the other. The fills are the same in
   * every theme; on light boards both shades of a cluster are rimmed in its
   * dark shade, on dark boards the edge equals the fill
   */
  purple: string;
  purpleInk: string;
  purpleLight: string;
  purpleLightInk: string;
  orange: string;
  orangeInk: string;
  orangeLight: string;
  orangeLightInk: string;
  /**
   * a TRUE group's members, and a set's true digit of several candidates:
   * the pale "one of these" square (docs/hint-drawing-sets.md, decision 1),
   * the true fill at half strength over the family's board, drawn opaque;
   * its edge is the true ink, its digit the ring's
   */
  oneOf: string;
  /**
   * an almost locked set's tint, the fill of its tiles at setAlpha, and its
   * ink, the tiles' outline and the letter tab's fill (decisions 5, 7, 8
   * and 9): sand, rose and violet, given out in letter order
   */
  set1: string;
  set1Ink: string;
  set2: string;
  set2Ink: string;
  set3: string;
  set3Ink: string;
  setAlpha: number;
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
  purple: '#c361f1',
  purpleInk: '#c361f1',
  purpleLight: '#ccb9e7',
  purpleLightInk: '#c361f1',
  orange: '#ed6907',
  orangeInk: '#ed6907',
  orangeLight: '#fcd2b1',
  orangeLightInk: '#ed6907',
  oneOf: '#abe1ba',
  set1: '#faea37',
  set1Ink: '#6b6000',
  set2: '#bf5481',
  set2Ink: '#a3365f',
  set3: '#8c56ff',
  set3Ink: '#6a40d0',
  setAlpha: 0.5,
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
  purple: '#c361f1',
  purpleInk: '#c361f1',
  purpleLight: '#ccb9e7',
  purpleLightInk: '#ccb9e7',
  orange: '#ed6907',
  orangeInk: '#ed6907',
  orangeLight: '#fcd2b1',
  orangeLightInk: '#fcd2b1',
  oneOf: '#296243',
  set1: '#474801',
  set1Ink: '#e6d27a',
  set2: '#b4537b',
  set2Ink: '#f0a0c0',
  set3: '#4020d0',
  set3Ink: '#c896ce',
  setAlpha: 0.5,
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
  purple: '--hint-purple',
  purpleInk: '--hint-purple-ink',
  purpleLight: '--hint-purple-light',
  purpleLightInk: '--hint-purple-light-ink',
  orange: '--hint-orange',
  orangeInk: '--hint-orange-ink',
  orangeLight: '--hint-orange-light',
  orangeLightInk: '--hint-orange-light-ink',
  oneOf: '--hint-one-of',
  set1: '--hint-set-1',
  set1Ink: '--hint-set-1-ink',
  set2: '--hint-set-2',
  set2Ink: '--hint-set-2-ink',
  set3: '--hint-set-3',
  set3Ink: '--hint-set-3-ink',
  setAlpha: '--hint-set-alpha',
  onFill: '--hint-on-fill',
  inRing: '--hint-in-ring',
  ringTint: '--hint-ring-tint',
  bandAlpha: '--hint-band-alpha'
};

/** a colouring's shade: a cluster's hue (purple, orange) and a parity's lightness (dark, light) */
export type Shade = 'purpleDark' | 'purpleLight' | 'orangeDark' | 'orangeLight';

/** a mark's look, by the kind the hint gives a candidate */
export type MarkKind = 'primary' | 'secondary' | 'fin' | 'elim' | 'place' | Shade;

/** the fill and the edge of a filled mark of each kind */
export function fillOf(p: HintPalette, kind: Exclude<MarkKind, 'elim'>): { fill: string; ink: string } {
  if (kind === 'primary') return { fill: p.primary, ink: p.primaryInk };
  if (kind === 'secondary') return { fill: p.secondary, ink: p.secondaryInk };
  if (kind === 'fin') return { fill: p.fin, ink: p.finInk };
  if (kind === 'purpleDark') return { fill: p.purple, ink: p.purpleInk };
  if (kind === 'purpleLight') return { fill: p.purpleLight, ink: p.purpleLightInk };
  if (kind === 'orangeDark') return { fill: p.orange, ink: p.orangeInk };
  if (kind === 'orangeLight') return { fill: p.orangeLight, ink: p.orangeLightInk };
  return { fill: p.place, ink: p.placeInk };
}

/** the sizes of a mark, as fractions of a cell (the disc's outer radius is SIZES.r in hintGeometry.ts) */
export const MARK = {
  /** a filled disc, and the edge drawn on its rim (invisible where ink = fill) */
  disc: 0.13,
  edge: 0.02,
  /**
   * a colouring shade's rim, drawn inwards, the same on every board and in
   * the Learn diagrams (docs/hint-drawing-colouring.md, decision 7): thin,
   * so a light shade keeps its own fill over 85% of its disc, and the two
   * shades of a cluster, as drawn, stay apart as their fills do (on a
   * phone the eye mixes a rim into its disc; tests/shadeRender.test.ts).
   * The keyline, not the rim, parts a shade from the player's own cell
   * colours
   */
  shadeEdge: 0.01,
  /** a ring: its stroke's centre line and width (outer edge at the disc's radius) */
  ring: 0.115,
  ringStroke: 0.03,
  /** the removal bar, rim to rim at 45 degrees, over the digit */
  bar: 0.0919,
  barStroke: 0.0225,
  /** a placement's outer ring; on a small board, thicker and moved out with it so the gap to the disc stays (G3, G14a) */
  placeRing: 0.165,
  placeRingStroke: 0.025,
  placeRingSmall: 0.175,
  placeRingSmallStroke: 0.045,
  /** a thin ring in the board's colour round every mark, so it stays distinct over the player's own cell colours */
  keyline: 0.015,
  /**
   * a colouring shade's keyline on a small board, where it alone parts a
   * light shade from the player's cell colour of the same hue: as wide as
   * the candidates' pitch allows: two marks side by side in a cell are
   * 28 units apart, so one's keyline (13 + 2) reaches the other's disc
   * (28 - 13) and no further
   */
  keylineSmall: 0.02,
  /** the dash of an acts-through (cover) band's outline, so base and cover differ by shape too */
  coverDash: [0.1, 0.06],
  /**
   * a "one of these" square (docs/hint-drawing-sets.md, decision 1): half
   * its side, its corners' radius, and its edge in the true ink, drawn
   * inwards. It is the same on every board and in the Learn diagrams; its
   * keyline is a disc's, wider on a small board as a shade's (keyline,
   * keylineSmall). It reaches 13 from its centre along its axes and 15.5
   * at its corners
   */
  oneOf: 0.13,
  oneOfRadius: 0.07,
  oneOfEdge: 0.02,
  /**
   * a group's bar (decision 2): how far its centre line runs off the
   * members' line, in the glyph-free gutter beside them, from the first
   * member's centre to the last's, with round caps; and its width, then on
   * a small board under 600 and under 330 CSS pixels (styles.css
   * .hint-group-bar)
   */
  groupBar: 0.15,
  groupBarStroke: 0.03,
  groupBarStrokeSmall: 0.045,
  groupBarStrokeTiny: 0.055,
  /**
   * an almost locked set's tile in each of its cells (decision 5): the
   * rectangle round the centres of the cell's candidates, this far out,
   * with corners of this radius, its outer edge keeping at least
   * tileMargin from the cell's edge on every board. It is filled in the
   * set's tint at setAlpha and outlined in its ink, stroked inwards: the
   * outline's width, then on a small board under 600 and under 330 CSS
   * pixels, each a drawing of its own so the outer edge stays where it is
   * (styles.css .hint-tile-wide, -small, -tiny). The Learn diagrams draw
   * it half again as wide, as their other lines
   */
  tile: 0.15,
  tileRadius: 0.1,
  tileMargin: 0.06,
  tileStroke: 0.025,
  tileStrokeSmall: 0.045,
  tileStrokeTiny: 0.05,
  /** the outline of a later set on a cell of an earlier one (decision 6): dashed so, one outline width inside the earlier tile's, with no fill */
  tileDash: [0.06, 0.04],
  /**
   * a set's letter tab (decision 7): a rounded square in the set's ink,
   * its side and its corners' radius, with a keyline in the board's colour
   * (MARK.keyline), and the letter in the board's colour, bold, at this
   * size. A small board (styles.css .hint-tab) and the Learn diagrams draw
   * the whole tab larger, tabLarge across, the letter about 19
   */
  tab: 0.18,
  tabRadius: 0.04,
  tabLetter: 0.13,
  tabLarge: 0.26
};
