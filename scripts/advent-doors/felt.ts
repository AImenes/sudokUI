/**
 * What every motif of the advent doors' pictures shares
 * (scripts/og-advent-doors.ts, scripts/advent-doors/README.md): the
 * palette, the hard shadow, the running stitch and a few small shapes, so
 * that 24 motifs drawn by different hands look like one hand.
 *
 * A motif is a felt cut-out sewn onto the knitting: flat pieces in snow
 * and gold, no outlines, no gradients, no opacity. The frame throws one
 * hard shadow under the whole motif; a motif never draws its own.
 */

// ---------------------------------------------------------------- the box

/**
 * The motif's box: 340 wide and 410 high, drawn about its own middle, so x
 * runs from -170 to 170 and y from -205 to 205 (y grows downwards). The
 * frame puts (0, 0) at MOTIF_AT of scripts/og-advent-doors.ts.
 */
export const BOX = { w: 340, h: 410, left: -170, right: 170, top: -205, bottom: 205 } as const;

// ---------------------------------------------------------------- the palette

/** the felt: snow, and the tone a second layer of snow takes (a far leg, a fold, wax that has run) */
export const SNOW = '#f3efe2';
export const SHADE = '#d9cfb4';
/** the gold of the number and of metal, flame and straw; its deeper tone for a second layer or a far part */
export const GOLD = '#f3d27a';
export const GOLD_DEEP = '#cf9a35';
/** the thread of a running stitch on snow (on gold the thread is GOLD_DEEP, on a ground colour GOLD) */
export const THREAD = '#d2b877';
/** the site's Christmas pine and cranberry: the two grounds, and each the other's accent */
export const PINE = '#1a4231';
export const CRANBERRY = '#a8233d';

/**
 * The two grounds. stitch: the yarn; gap: what shows between stitches;
 * deep: the shadow a sewn-on piece throws, and the only dark a motif may
 * use (a wick, an eye); patch: the number's patch, the other colour of the
 * two, a shade deeper on cranberry so that it sits as cloth, not as a hole.
 */
export const GROUNDS = {
  pine: { stitch: PINE, gap: '#102b20', deep: '#0b2018', patch: CRANBERRY },
  cranberry: { stitch: CRANBERRY, gap: '#86192e', deep: '#5f1021', patch: '#173d2e' }
} as const;
export type GroundName = keyof typeof GROUNDS;

/**
 * The colours a motif is given: the same names on both grounds, so a motif
 * never asks which ground it is on.
 */
export interface Felt {
  /** the main felt, and its second tone */
  snow: string;
  shade: string;
  /** the second felt, and its second tone */
  gold: string;
  goldDeep: string;
  /** the thread of a running stitch on snow */
  thread: string;
  /** the knitting's colour: for a hole cut through the felt */
  ground: string;
  /** the shadow's colour: the only dark, for a wick or an eye */
  deep: string;
  /** the other colour of the two (the patch's): at most two small accents a motif */
  accent: string;
  /** a prefix for the ids a motif needs (clip paths), unique in the picture */
  id: string;
}

/** a motif: the SVG fragment of one door, drawn in BOX */
export type Motif = (k: Felt) => string;

export function feltOf(ground: GroundName, id: string): Felt {
  const g = GROUNDS[ground];
  return { snow: SNOW, shade: SHADE, gold: GOLD, goldDeep: GOLD_DEEP, thread: THREAD, ground: g.stitch, deep: g.deep, accent: g.patch, id };
}

// ---------------------------------------------------------------- numbers and colour

/** one decimal: paths stay short */
export const n1 = (v: number): number => +v.toFixed(1);

function hex(c: string): number[] {
  return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
}

/** a flat mix of two colours, t of the second: no opacity, so nothing blends on the page */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [hex(a), hex(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------- the hard shadow

/** how far the shadow falls: to the right and down, the same under every piece */
export const SHADOW = { dx: 5, dy: 7 } as const;

/**
 * The hard shadow as a filter: everything in a group that wears it throws
 * one flat shadow in the ground's deep colour, with no blur. The frame
 * puts the whole motif and the patch in such a group, so a motif draws no
 * shadow of its own; a piece that should look laid on another takes a
 * second tone instead (SHADE under snow, GOLD_DEEP under gold).
 */
export function hardShadow(id: string, deep: string, width: number, height: number): string {
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="0" y="0" width="${width}" height="${height}" color-interpolation-filters="sRGB">
      <feFlood flood-color="${deep}"/>
      <feComposite in2="SourceAlpha" operator="in"/>
      <feOffset dx="${SHADOW.dx}" dy="${SHADOW.dy}" result="shadow"/>
      <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;
}

// ---------------------------------------------------------------- felt and thread

/** the running stitch: 9 of thread, 8 of gap, 2.5 thick (the patch's is the same stitch, larger) */
export const STITCH = { dash: '9 8', width: 2.5, inset: 6 } as const;

/** a flat piece of felt */
export function piece(d: string, fill: string): string {
  return `<path d="${d}" fill="${fill}"/>`;
}

/**
 * A piece of felt sewn on: the shape, and a running stitch 6 px inside its
 * edge (a dashed stroke clipped to the shape, its outer part painted
 * over). id must be unique in the picture: start it with the motif's k.id.
 * within: [x, y, width, height], the part of the piece that is stitched,
 * when not all of it (thin parts, legs and stems, are better left plain).
 * thread: THREAD (k.thread) on snow, GOLD_DEEP (k.goldDeep) on gold.
 */
export function sewn(id: string, d: string, fill: string, thread: string, within?: [number, number, number, number]): string {
  const inset = STITCH.inset;
  const part = within ? `<clipPath id="${id}w"><rect x="${within[0]}" y="${within[1]}" width="${within[2]}" height="${within[3]}"/></clipPath>` : '';
  return `<clipPath id="${id}"><path d="${d}"/></clipPath>${part}
    <path d="${d}" fill="${fill}"/>
    <g${within ? ` clip-path="url(#${id}w)"` : ''}><g clip-path="url(#${id})" fill="none" stroke-linejoin="round">
      <path d="${d}" stroke="${thread}" stroke-width="${2 * inset + 2 * STITCH.width}" stroke-dasharray="${STITCH.dash}"/>
      <path d="${d}" stroke="${fill}" stroke-width="${2 * inset}"/>
    </g></g>`;
}

/** a running stitch along a line of your own: a seam down a candle, a fold, a rib */
export function seam(d: string, thread: string): string {
  return `<path d="${d}" stroke="${thread}" stroke-width="${STITCH.width}" stroke-dasharray="${STITCH.dash}" fill="none"/>`;
}

/** a line of felt: a cord, an antler, a ski pole. width 7 to 12 reads at 300 px; thinner disappears */
export function cord(d: string, colour: string, width = 10): string {
  return `<path d="${d}" stroke="${colour}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
}

// ---------------------------------------------------------------- small shapes (path data)

/** a five-pointed star about (cx, cy): R to the points, r to the notches (r about 0.4 R) */
export function star5(cx: number, cy: number, R: number, r: number, rot = -90): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((rot + i * 36) * Math.PI) / 180;
    const q = i % 2 ? r : R;
    p.push(`${n1(cx + q * Math.cos(a))},${n1(cy + q * Math.sin(a))}`);
  }
  return `M${p.join('L')}Z`;
}

/** a heart about (cx, cy); s is half its width */
export function heart(cx: number, cy: number, s: number): string {
  return `M${cx},${n1(cy + s * 0.95)}C${n1(cx - s * 1.5)},${n1(cy - s * 0.1)} ${n1(cx - s * 0.75)},${n1(cy - s * 1.15)} ${cx},${n1(cy - s * 0.35)}C${n1(cx + s * 0.75)},${n1(cy - s * 1.15)} ${n1(cx + s * 1.5)},${n1(cy - s * 0.1)} ${cx},${n1(cy + s * 0.95)}Z`;
}

/**
 * The knitted rose of the frame as eight cut diamonds about (cx, cy), for
 * a cut-out on a figure (fill it with k.ground): L is one diamond's side,
 * the whole is about 3.7 L across.
 */
export function roseCut(cx: number, cy: number, L: number, shrink = 0.8): string {
  let d = '';
  for (let i = 0; i < 8; i++) {
    const a = (i * 45 * Math.PI) / 180;
    const b = ((i + 1) * 45 * Math.PI) / 180;
    const pts = [
      [0, 0],
      [L * Math.cos(a), L * Math.sin(a)],
      [L * (Math.cos(a) + Math.cos(b)), L * (Math.sin(a) + Math.sin(b))],
      [L * Math.cos(b), L * Math.sin(b)]
    ];
    const mx = pts.reduce((s, p) => s + p[0], 0) / 4;
    const my = pts.reduce((s, p) => s + p[1], 0) / 4;
    d += 'M' + pts.map(([x, y]) => `${n1(cx + mx + (x - mx) * shrink)},${n1(cy + my + (y - my) * shrink)}`).join('L') + 'Z';
  }
  return d;
}

/** points on a circle about (cx, cy), for rays, berries, candles in a ring: [x, y] at each angle in degrees (0 right, -90 up) */
export function around(cx: number, cy: number, r: number, degrees: number[]): [number, number][] {
  return degrees.map((a) => {
    const t = (a * Math.PI) / 180;
    return [n1(cx + r * Math.cos(t)), n1(cy + r * Math.sin(t))];
  });
}
