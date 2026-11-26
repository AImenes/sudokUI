/**
 * What scripts/print-poster.ts prints for the advent calendar, on its own
 * so that a test can read it without a browser (tests/printPoster.test.ts):
 * each sheet's file name, paper and language, and the address its QR code
 * opens. Nothing here draws.
 */
import { ADVENT_URLS } from '../../src/content/staticRoutes';
import { SITE } from '../../src/content/home';

/** the languages printed: Norwegian (bokmål) first, the owner's own, and English */
export const PRINT_LANGS = ['nb', 'en'] as const;
export type PrintLang = (typeof PRINT_LANGS)[number];

/**
 * The tag on every printed QR code: the Worker's word for a landing that
 * came from paper (worker/telemetry.ts, LINK_TAGS). An iPhone's camera
 * sends no referrer, and an Android phone none or only the scanning app's
 * name, so without it a poster's visits would read as `none`, `search`
 * (Google Lens in the Google app) or `other`.
 */
export const POSTER_TAG = 'poster';

/** the address a sheet's QR code opens: the calendar's page in its language, with the tag */
export const qrAddress = (lang: PrintLang): string => `${SITE}${ADVENT_URLS[lang]}?utm_source=${POSTER_TAG}`;

/** the address written under the code for a person to type: no scheme, no slash at the end, no tag */
export const typedAddress = (lang: PrintLang): string => `${new URL(SITE).host}${ADVENT_URLS[lang].replace(/\/$/, '')}`;

/** where the files go: promo/print/, never public/ (they are for printing, not for the site) */
export const OUT_DIR = 'promo/print';

/** a paper size in millimetres, portrait unless it says */
export interface Paper {
  name: string;
  w: number;
  h: number;
}
export const A4: Paper = { name: 'A4', w: 210, h: 297 };
export const A5: Paper = { name: 'A5', w: 148, h: 210 };
/** an A4 sheet on its side, for two A5 flyers side by side */
export const A4_LANDSCAPE: Paper = { name: 'A4 landscape', w: 297, h: 210 };

/** poster: one A4 poster; flyer: one A5 flyer; flyers: two A5 flyers on an A4 sheet, with a line to cut along */
export type SheetKind = 'poster' | 'flyer' | 'flyers';

export interface Sheet {
  kind: SheetKind;
  lang: PrintLang;
  paper: Paper;
  /** the file's name without its extension: advent-poster-a4.nb (and .pdf, .png) */
  name: string;
  /** how wide each QR code is printed, quiet zone included, in millimetres */
  qrMm: number;
  /** how many codes the sheet has, side by side: 2 on the sheet of two flyers */
  codes: number;
}

/**
 * The QR codes' printed width, the white quiet zone of four modules
 * included: on the flyer at least 3 cm of code without it (the task's
 * floor for a phone held close), on the poster about twice that, for a
 * phone held at arm's length in front of a noticeboard
 */
export const QR_MM = { poster: 84, flyer: 50 } as const;

/** every sheet, in both languages */
export const SHEETS: Sheet[] = PRINT_LANGS.flatMap((lang): Sheet[] => [
  { kind: 'poster', lang, paper: A4, name: `advent-poster-a4.${lang}`, qrMm: QR_MM.poster, codes: 1 },
  { kind: 'flyer', lang, paper: A5, name: `advent-flyer-a5.${lang}`, qrMm: QR_MM.flyer, codes: 1 },
  { kind: 'flyers', lang, paper: A4_LANDSCAPE, name: `advent-flyers-2up-a4.${lang}`, qrMm: QR_MM.flyer, codes: 2 }
]);

/**
 * The code alone, for a newsletter or a parish magazine to place in its
 * own layout: advent-qr.<lang>.svg and .png, each 40 mm wide with its
 * white quiet zone (about 33 mm of code without it on the Norwegian, 32 mm
 * on the English), the PNG at 600 dots to the inch
 */
export const CODE_ALONE = { name: (lang: PrintLang) => `advent-qr.${lang}`, mm: 40, dpi: 600 } as const;

/** CSS pixels in a millimetre: the browser's 96 to the inch */
export const PX_PER_MM = 96 / 25.4;

/** PDF points in a millimetre: 72 to the inch */
export const PT_PER_MM = 72 / 25.4;

/**
 * How much larger than CSS pixels the PNG previews are drawn: 1, 96 dots
 * to the inch, enough to look at and for a decoder to read the smallest
 * code (four pixels to a module), and light enough to keep in the
 * repository. The PDFs are what is printed.
 */
export const PREVIEW_SCALE = 1;
