/**
 * Colour science for the hint palette's tests (tests/hintPalette.test.ts;
 * docs/hint-drawing-colouring.md and docs/hint-drawing-sets.md, Colours):
 * WCAG 2 contrast, a browser's compositing, CIELAB, CIEDE2000, and three
 * models of colour vision deficiency. Not a test file
 * itself, standard library only; the palette test checks CIEDE2000 on
 * Sharma's published test pairs and every simulation on the greys before
 * it uses them.
 *
 * Sources:
 * - WCAG 2.x relative luminance and contrast ratio (W3C, the "contrast
 *   ratio" definition), with the sRGB decode threshold 0.04045.
 * - CIELAB from sRGB through XYZ, D65 white (IEC 61966-2-1's matrix).
 * - CIEDE2000: Sharma, Wu, Dalal, "The CIEDE2000 color-difference formula:
 *   implementation notes, supplementary test data, and mathematical
 *   observations", Color Research and Application 30(1), 2005.
 * - Machado, Oliveira, Fernandes, "A Physiologically-based Model for
 *   Simulation of Color Vision Deficiency", IEEE TVCG 15(6), 2009: the
 *   severity 1.0 matrices of their published table, applied to linear RGB.
 * - Brettel, Viénot, Mollon, "Computerized simulation of color appearance
 *   for dichromats", JOSA A 14(10), 1997, and Viénot, Brettel, Mollon,
 *   "Digital video colourmaps for checking the legibility of displays by
 *   dichromats", Color Research and Application 24(4), 1999: as worked out
 *   for sRGB (Smith-Pokorny cone fundamentals) in libDaltonLens.
 *
 * A pair's worst-model difference is the lowest CIEDE2000 over normal
 * vision and the eight simulations (Machado protan, deutan and tritan;
 * Brettel protan, deutan and tritan; Viénot protan and deutan), the method
 * behind the spec's numbers.
 */

export type RGB = [number, number, number];
export type Lab = [number, number, number];

const hexToRgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as RGB;
const decode = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** a colour's linear RGB */
export const toLinear = (hex: string): RGB => hexToRgb(hex).map(decode) as RGB;

/** WCAG 2 relative luminance */
export function luminance(hex: string): number {
  const [r, g, b] = toLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2 contrast ratio, 1 to 21 */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/**
 * a colour drawn at an alpha over a background, as a browser composites
 * it: in sRGB as encoded, each channel rounded to 8 bits (a set's tile at
 * its alpha over a cell, the player's own cell colour at 0.55, a tint over
 * the hint panel)
 */
export function over(fg: string, alpha: number, bg: string): string {
  const bytes = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const [f, b] = [bytes(fg), bytes(bg)];
  return '#' + f.map((c, i) => Math.round(alpha * c + (1 - alpha) * b[i]).toString(16).padStart(2, '0')).join('');
}

const clamp = (l: RGB): RGB => l.map((c) => Math.min(1, Math.max(0, c))) as RGB;
const WHITE = [0.95047, 1, 1.08883];
/** CIELAB (D65) of a linear RGB colour, clamped to the gamut first */
export function linToLab(l: RGB): Lab {
  const [r, g, b] = clamp(l);
  const X = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const [fx, fy, fz] = [X / WHITE[0], Y / WHITE[1], Z / WHITE[2]].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000, as Sharma et al. 2005 set it out (kL = kC = kH = 1) */
export function de2000(p: Lab, q: Lab): number {
  const [L1, a1, b1] = p;
  const [L2, a2, b2] = q;
  const rad = Math.PI / 180;
  const Cb = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => {
    if (a === 0 && b === 0) return 0;
    const h = Math.atan2(b, a) / rad;
    return h < 0 ? h + 360 : h;
  };
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp = h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2;
    else hbp = (h1p + h2p) / 2;
  }
  const T =
    1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp;
  const SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(2 * dTheta * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}

/** a 3x3 matrix, row by row */
type M3 = number[];
const mul = (m: M3, v: RGB): RGB => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];

/** Machado 2009, severity 1.0, on linear RGB */
const MACHADO: Record<'protan' | 'deutan' | 'tritan', M3> = {
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039]
};
/** Brettel 1997 on linear RGB: two half-planes, m1 where the colour is on n's side, m2 elsewhere */
const BRETTEL: Record<'protan' | 'deutan' | 'tritan', { m1: M3; m2: M3; n: RGB }> = {
  protan: {
    m1: [0.1498, 1.19548, -0.34528, 0.10764, 0.84864, 0.04372, 0.00384, -0.0054, 1.00156],
    m2: [0.1457, 1.16172, -0.30742, 0.10816, 0.85291, 0.03892, 0.00386, -0.00524, 1.00139],
    n: [0.00048, 0.00393, -0.00441]
  },
  deutan: {
    m1: [0.36477, 0.86381, -0.22858, 0.26294, 0.64245, 0.09462, -0.02006, 0.02728, 0.99278],
    m2: [0.37298, 0.88166, -0.25464, 0.25954, 0.63506, 0.1054, -0.0198, 0.02784, 0.99196],
    n: [-0.00281, -0.00611, 0.00892]
  },
  tritan: {
    m1: [1.01277, 0.13548, -0.14826, -0.01243, 0.86812, 0.14431, 0.07589, 0.805, 0.11911],
    m2: [0.93678, 0.18979, -0.12657, 0.06154, 0.81526, 0.1232, -0.37562, 1.12767, 0.24796],
    n: [0.03901, -0.02788, -0.01113]
  }
};
/** Viénot 1999 on linear RGB (protan and deutan only; the model has no tritan) */
const VIENOT: Record<'protan' | 'deutan', M3> = {
  protan: [0.11238, 0.88762, 0, 0.11238, 0.88762, 0, 0.00401, -0.00401, 1],
  deutan: [0.29275, 0.70725, 0, 0.29275, 0.70725, 0, -0.02234, 0.02234, 1]
};

/** the ways a colour is seen: normal vision and the eight simulations */
export const MODELS = [
  'normal',
  'Machado protan',
  'Machado deutan',
  'Machado tritan',
  'Brettel protan',
  'Brettel deutan',
  'Brettel tritan',
  'Viénot protan',
  'Viénot deutan'
] as const;
export type Model = (typeof MODELS)[number];

/** a linear RGB colour as seen under a model, clamped to the gamut */
export function simulate(l: RGB, model: Model): RGB {
  if (model === 'normal') return l;
  const [name, kind] = model.split(' ') as ['Machado' | 'Brettel' | 'Viénot', 'protan' | 'deutan' | 'tritan'];
  if (name === 'Machado') return clamp(mul(MACHADO[kind], l));
  if (name === 'Viénot') return clamp(mul(VIENOT[kind as 'protan' | 'deutan'], l));
  const { m1, m2, n } = BRETTEL[kind];
  return clamp(mul(n[0] * l[0] + n[1] * l[1] + n[2] * l[2] >= 0 ? m1 : m2, l));
}

/** a colour's CIELAB under a model */
export const seen = (hex: string, model: Model): Lab => linToLab(simulate(toLinear(hex), model));

/** the lowest CIEDE2000 between two colours over every model, and the model that gives it */
export function worstDE(a: string, b: string): { de: number; model: Model } {
  let worst = { de: Infinity, model: MODELS[0] as Model };
  for (const model of MODELS) {
    const de = de2000(seen(a, model), seen(b, model));
    if (de < worst.de) worst = { de, model };
  }
  return worst;
}
