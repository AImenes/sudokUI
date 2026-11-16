# The advent doors' pictures: how to draw a motif

When a door of the advent calendar is shared, `/advent/<year>/<n>`, the
chat shows a picture of its own, as a paper calendar has one behind every
door. There are 24, the same every year:
`public/og/advent/door-01.png` ... `door-24.png`, 1200 x 630, under 300 KB.

The look is Nordic knitting. `scripts/og-advent-doors.ts` draws the frame,
the same on every door: a knitted ground in pine or cranberry, a band of
small pattern and a gold row along the top and the bottom, a Selbu rose on
each side, the door's number in gold on a sewn-on patch in the other colour
of the two, the brand and the address. **You draw only the motif**: a felt
cut-out in snow and gold, sewn on in the middle. One file a door,
`scripts/advent-doors/door-<nn>.ts`. Doors 1 (the candle), 12 (the
reindeer) and 24 (the tree) are drawn: read them first, and look at them
(`npx vite-node scripts/og-advent-doors.ts 1 12 24 --out .vite/advent-doors --sheet .vite/advent-doors/sheet.png`).
Every picture must belong with those three.

## The file

```ts
/** Door 9: a kicksled. */
import { type Felt, cord, piece, sewn } from './felt';

export default function kicksled(k: Felt): string {
  return `...SVG...`;
}
```

One default export: a function that takes the door's colours (`Felt`) and
returns an SVG fragment (no `<svg>` around it). Import only from `./felt`.
Do not edit `felt.ts`, the frame or the table of doors while others are
drawing: if you miss a helper or a tint, keep it in your own file and tell
the lead, who adds it for everyone.

## The motif's box

- **340 wide, 410 high, drawn about its own middle**: x from -170 to 170,
  y from -205 to 205, y growing downwards. `BOX` in `felt.ts` has the
  numbers. The frame puts (0, 0) at (465, 321) of the picture, so the box
  covers x 295 to 635 and y 116 to 526; the patch starts 10 px to its right.
- **Centre the motif on (0, 0)**: the middle of what you draw (its ink,
  not counting the shadow), within 5 px. A motif that is heavier on one
  side (the candle's holder has a ring on the right) is moved as a whole
  with one `<g transform="translate(...)">`, as door 1 does.
- **How big.** Fill the box one way and stay inside it the other. A tall
  motif (candle, tree, lantern, skis) runs from about y -200 to 195 and is
  as wide as it comes; a wide one (sleigh, kicksled) runs from about
  x -165 to 160 and should still be at least 230 high, with whatever
  belongs to it (a pennant, a sack, snow under the runners); a round one
  (bauble, wreath, bell, snow crystal) is about 300 across, its hanger or
  bow taking it towards 380 high. Smaller than that and the number's patch,
  260 x 260 beside it, outweighs it.
- **Stay 5 px inside the box on the right and 7 at the bottom**: the frame
  throws a hard shadow 5 px to the right and 7 down under everything you
  draw, and the patch is close.
- Nothing may reach outside the box: the middle 630 px of the picture are
  the square some chats crop to, and the box's left edge is 10 px from it.

`--guides` draws the box, its middle and the square crop over the picture.

## The palette

A motif takes every colour from the `Felt` it is given, never a hex of its
own (tests/adventDoorPictures.test.ts checks). The names are the same on
both grounds, so a motif never asks which ground it is on.

| name | colour | for |
| --- | --- | --- |
| `k.snow` | `#f3efe2` | the main felt: most of the motif |
| `k.shade` | `#d9cfb4` | snow's second tone: a far leg, a fold, run wax, the layer under a layer |
| `k.gold` | `#f3d27a` | the second felt: metal, flame, straw, ribbon, stars, lights |
| `k.goldDeep` | `#cf9a35` | gold's second tone: a far antler, a trunk, the thread on gold |
| `k.thread` | `#d2b877` | the thread of a running stitch on snow |
| `k.accent` | the patch's colour: cranberry on pine, deep pine on cranberry | **at most two small accents** a motif: a heart, a ribbon, a stripe, berries |
| `k.ground` | the knitting's colour | a hole cut through the felt (the rose on the reindeer's flank) |
| `k.deep` | the shadow's colour | the only dark: a wick, an eye. Tiny |
| `k.id` | `d<door>` | the prefix of every id you make |

Snow and gold carry the picture: about two thirds snow, a third gold.
Colours are flat: no opacity, no gradients, no outlines, no filters. Depth
comes from layers (a piece in `k.shade` peeping out 9 px below a piece in
`k.snow`, as the tree's tiers) and from the frame's one hard shadow, which
you never draw yourself.

Your door's ground is in `DOORS` of `scripts/og-advent-doors.ts`: pine on
odd days and on the 24th, cranberry on even days. The bullfinch's breast
and the rowan berries of door 3 are `k.accent`, cranberry there.

## The helpers (`felt.ts`)

- `sewn(id, d, fill, thread, within?)`: a piece of felt with a running
  stitch 6 px inside its edge: **the** mark of the style. Give the main
  piece of every motif one. `thread` is `k.thread` on snow and `k.goldDeep`
  on gold. Thin parts (legs, stems, anything under 30 px across) crowd with
  stitches: leave them plain by naming the part that is stitched,
  `within: [x, y, width, height]`, or draw them as their own `piece`.
- `piece(d, fill)`: a flat piece.
- `seam(d, thread)`: a running stitch along a line of your own (the two
  seams down the candle).
- `cord(d, colour, width = 10)`: a line of felt with round ends: antlers,
  ski poles, a hanger. 7 to 12 wide; thinner disappears at 300 px.
- `heart(cx, cy, s)`, `star5(cx, cy, R, r)`, `roseCut(cx, cy, L)`: path
  data (put them in `piece`); `around(cx, cy, r, degrees)`: points on a
  circle, for rays, candles in a ring, berries; `n1(v)`: one decimal, for
  the numbers you compute.

### One worked example

A stocking (not one of the 24: it is here to be copied from):

```ts
/** A stocking: the README's worked example, not one of the 24. */
import { type Felt, cord, heart, piece, seam, sewn } from './felt';

export default function stocking(k: Felt): string {
  // the leg and the foot: one piece of snow, a running stitch inside its edge
  const sock = 'M-66,-120H34V52C34,76 48,88 72,96C120,112 122,180 66,180H-14C-48,180 -66,160 -66,128Z';
  // it is heavier to the right and at the bottom: moved as a whole until its middle is on (0, 0)
  return `<g transform="translate(-6,8)">
    ${cord('M26,-150C26,-204 78,-204 78,-150', k.gold, 9)}
    ${sewn(`${k.id}-sock`, sock, k.snow, k.thread)}
    ${piece('M-66,96C-66,150 -40,180 -14,180H12C-20,170 -34,140 -34,96Z', k.shade)}
    ${piece('M-80,-176H48V-108H-80Z', k.gold)}
    ${seam('M-72,-120H40', k.goldDeep)}
    ${piece(heart(-16, -24, 26), k.accent)}
    </g>`;
}
```

In order, back to front: the loop it hangs by (a `cord` in gold), the sock
(`sewn`: snow with its stitch), the heel as a second tone laid on it, the
cuff in gold over the top of the leg with a seam along its lower edge, and
one accent, the heart. Five pieces, one silhouette.

## Rendering and looking

```sh
# one door, with the box drawn, and a sheet to look at: the picture at 600 wide,
# at 300 wide (a chat preview) and the centred square crop
npx vite-node scripts/og-advent-doors.ts 9 --out .vite/advent-doors --guides --sheet .vite/advent-doors/sheet-09.png

# the same without the guides, plus door-09-small.png (400 x 210) and
# door-09-square.png (630 x 630) in .vite/advent-doors/previews
npx vite-node scripts/og-advent-doors.ts 9 --out .vite/advent-doors --previews --sheet .vite/advent-doors/sheet-09.png

# several doors at 300 wide, four across, as a chat would show them
npx vite-node scripts/og-advent-doors.ts 1 9 12 17 24 --out .vite/advent-doors --sheet-small .vite/advent-doors/small.png

# the frame alone for any door (no motif file needed): its ground, band, rose and number
npx vite-node scripts/og-advent-doors.ts 9 --frame --out .vite/advent-doors --sheet .vite/advent-doors/frame-09.png
```

Everything you render while drawing goes under `.vite/` (git ignores it).
Without `--out` the pictures go to `public/og/advent/`, the site's own:
only the finished 24 belong there, and `--guides` refuses to write there.
Look at the **sheet**, not at one picture: the motif has to work at 600
wide, at 300 wide and in the square, beside doors 1, 12 and 24. A sheet
holds eight doors; three or four at a time are seen at their true size.
The run stops if a picture is over 300 KB (the three drawn are about
80 KB; a motif of a few dozen pieces adds little).

Before you call a door done:

1. at 300 wide, would a stranger name the motif at a glance?
2. in the square crop, is all of it there, clear of the edge?
3. beside doors 1, 12 and 24, is it the same hand: as large, as plain, the
   same stitch, no new colour?
4. `npx vitest run tests/adventDoorPictures.test.ts` passes.

## The rules

- **No words, no letters, no digits.** The number is the frame's; one set
  of 24 pictures serves English, Norwegian and Spanish links.
- **No sudoku** on it, no grid of nine.
- **One clear silhouette** that reads at 300 px wide: one thing, seen from
  its most telling side, with at most a little that belongs to it (the twig
  under the bullfinch, the smoke over the cabin). Details under 6 px vanish:
  leave them out.
- **Snow and gold, at most two small accents** in `k.accent`; `k.deep`
  only for something tiny.
- **No faces that could look wrong.** An animal in profile has one small
  dot for an eye and nothing else. The snowman has coal for eyes and
  buttons and a carrot, no mouth. No people.
- **Hand made, calm, Scandinavian; nothing childish**: no cartoon eyes, no
  sparkles, no characters anyone owns, nothing a shop's logo looks like.
- **Shapes only**: paths, rects, circles, in the colours of `Felt`. No
  `<text>`, no images, no fonts, no links, no opacity, no gradients, no
  filters; every id starts with `k.id`.
- Symmetry where the thing has it; a wobble of a pixel or two in a hem or
  a scallop is what makes it felt and not an icon.
