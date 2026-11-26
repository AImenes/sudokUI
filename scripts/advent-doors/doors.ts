/**
 * The table of the advent doors' pictures: the size of a picture and, for
 * each of the 24 doors, what it shows, its ground, its band and its roses.
 * It is on its own, away from the generator (scripts/og-advent-doors.ts),
 * so that a test can read it without starting a browser
 * (tests/adventDoorPictures.test.ts).
 */
import type { GroundName } from './felt';

export const W = 1200;
export const H = 630;
/** a picture may weigh this much, in bytes: chat apps drop heavier previews */
export const MAX_BYTES = 300 * 1024;

export type BandName = 'zigzag' | 'diamonds' | 'hearts' | 'stars' | 'ninedot' | 'trees';

/**
 * The patterns of the bands, five rows each, repeated along the band (S a
 * stitch in snow): the doors' pictures (scripts/og-advent-doors.ts) and
 * the calendar's posters and flyers (scripts/print-poster.ts) knit them
 */
export const BANDS: Record<BandName, string[]> = {
  zigzag: ['S...S...', '...S.S..', '..S...S.', '.S.....S', 'S...S...'],
  diamonds: ['..S...', '.S.S..', 'S.S.S.', '.S.S..', '..S...'],
  hearts: ['.S.S...', 'SSSSS..', 'SSSSS..', '.SSS...', '..S....'],
  stars: ['S.S.S..', '.SSS...', 'SS.SS..', '.SSS...', 'S.S.S..'],
  // nine dots, three by three, a bar between one box and the next
  ninedot: ['S.S.S...', '......S.', 'S.S.S.S.', '......S.', 'S.S.S...'],
  trees: ['..S....', '.SSS...', '..S....', '.SSS...', 'SSSSS..']
};

export interface Door {
  /** what the door shows: for messages and for whoever draws it; never on the picture */
  motif: string;
  /** the knitting's colour; the patch takes the other */
  ground: GroundName;
  /** the small pattern of the two bands */
  band: BandName;
  /** the cut of the roses' petals: 0 a slit down each, 1 whole, 2 an eye in each */
  rose: 0 | 1 | 2;
}

/**
 * The 24 doors, 1 to 24 December. The grounds take turns, pine on the odd
 * days and cranberry on the even, so that no two cranberry days follow
 * each other; the 24th is pine as the 1st, the tree on its own green, so
 * the 23rd and the 24th are the one pair of pine days. No two days running
 * share a band.
 */
export const DOORS: Door[] = [
  { motif: 'candle in its holder', ground: 'pine', band: 'zigzag', rose: 0 },
  { motif: 'pair of Selbu mittens', ground: 'cranberry', band: 'diamonds', rose: 1 },
  { motif: 'bullfinch on a rowan twig', ground: 'pine', band: 'stars', rose: 2 },
  { motif: 'sheaf of oats for the birds', ground: 'cranberry', band: 'ninedot', rose: 0 },
  { motif: 'skis and poles', ground: 'pine', band: 'trees', rose: 1 },
  { motif: 'lantern', ground: 'cranberry', band: 'zigzag', rose: 2 },
  { motif: 'gingerbread house', ground: 'pine', band: 'hearts', rose: 0 },
  { motif: 'snowman', ground: 'cranberry', band: 'stars', rose: 1 },
  { motif: 'kicksled', ground: 'pine', band: 'diamonds', rose: 2 },
  { motif: 'bell with a bow', ground: 'cranberry', band: 'ninedot', rose: 0 },
  { motif: 'cup of cocoa', ground: 'pine', band: 'zigzag', rose: 1 },
  { motif: 'reindeer', ground: 'cranberry', band: 'hearts', rose: 1 },
  { motif: 'Lucia crown with its candles', ground: 'pine', band: 'stars', rose: 0 },
  { motif: 'woven paper heart', ground: 'cranberry', band: 'diamonds', rose: 2 },
  { motif: 'snow globe', ground: 'pine', band: 'ninedot', rose: 1 },
  { motif: 'parcel with a bow', ground: 'cranberry', band: 'trees', rose: 0 },
  { motif: 'sleigh', ground: 'pine', band: 'zigzag', rose: 2 },
  { motif: 'wreath', ground: 'cranberry', band: 'stars', rose: 1 },
  { motif: 'bauble', ground: 'pine', band: 'hearts', rose: 0 },
  { motif: 'cabin in the snow, smoke from the chimney', ground: 'cranberry', band: 'trees', rose: 2 },
  { motif: 'snow crystal', ground: 'pine', band: 'diamonds', rose: 1 },
  { motif: 'paper star in the window', ground: 'cranberry', band: 'zigzag', rose: 0 },
  { motif: 'bowl of Christmas porridge with a spoon', ground: 'pine', band: 'ninedot', rose: 2 },
  { motif: 'Christmas tree with its star', ground: 'pine', band: 'stars', rose: 2 }
];

/** door-07: a door's name in its motif file and in its pictures */
export const doorName = (door: number): string => `door-${String(door).padStart(2, '0')}`;
