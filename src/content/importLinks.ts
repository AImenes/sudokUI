// Puzzle links from the sites the community plays on, pasted into Import
// (docs/review.md: people try a tool on their own puzzle or not at all).
// Each address is read the way its site reads it, from the site's own
// code as served in October 2026:
//
// - f-puzzles: f-puzzles.com/?load=<the puzzle's JSON, lz-string
//   compressToBase64>; ?id= is a tinyurl the site redirects, out of reach.
// - SudokuPad: sudokupad.app/<id>, /sudoku/<id> or ?puzzleid=<id> (also on
//   beta.sudokupad.app, sudokupad.svencodes.com and the old
//   app.crackingthecryptic.com). The id is a format prefix and a payload:
//   scl (alias ctc) and lz-string base64 of SudokuPad's own JSON, usually
//   with its keys shortened (its PuzzleZipper); fpuz (alias fpuzzles) and
//   the f-puzzles payload; scf and the givens as digit runs; classic and
//   the same runs, or an older run-length form. Anything else is a short id
//   only the site's API resolves, refused here.
// - Sudoku Exchange: sudokuexchange.com/play/?s=<81 digits, 0 for empty>
//   (&d=<band>); with "shorten links" on, s= is the digit runs.
// - sudoku.coach: sudoku.coach/<lang>/play/<81 cells> and /solver/<81
//   cells>, with 0, . or _ for empty; /s/<id> is a share id.
// - The app's own share links, /p/<81 cells> (src/content/share.ts) and
//   #p=<81 cells>, and the bare 81-character string.
//
// A variant (killer cages, thermometers, extra rules) is refused with what
// was found: the app plays classic sudoku only. Nothing here touches the
// network, the DOM or the store: text in, a puzzle string or a refusal
// out; the Import dialog (src/ui/Dialogs.tsx) puts a refusal into words.
import { boxOf } from '../engine/board';
import { decompressFromBase64 } from './lzString';
import { puzzleStringOf } from './textGrid';

/** where a puzzle came from: one of the four sites, or the app's own share link */
export type LinkSource = 'sudokupad' | 'fpuzzles' | 'sudokuexchange' | 'sudokucoach' | 'sudokui';

/** what makes a puzzle a variant, as the Import dialog names it */
export type VariantMark =
  | 'diagonals'
  | 'antiknight'
  | 'antiking'
  | 'disjointgroups'
  | 'nonconsecutive'
  | 'extraregions'
  | 'irregularregions'
  | 'windoku'
  | 'parity'
  | 'thermometers'
  | 'palindromes'
  | 'renban'
  | 'whispers'
  | 'betweenlines'
  | 'regionsumlines'
  | 'entropiclines'
  | 'lines'
  | 'killercages'
  | 'cages'
  | 'littlekillers'
  | 'sandwiches'
  | 'xsums'
  | 'skyscrapers'
  | 'kropki'
  | 'xv'
  | 'clones'
  | 'arrows'
  | 'quadruples'
  | 'minmax'
  | 'cosmetics'
  | 'shapes'
  | 'negative'
  | 'fog'
  | 'other';

/** why a link gave no puzzle */
export type LinkRefusal =
  /** the address is a short id only the site can look up */
  | { reason: 'short-id'; source: LinkSource }
  /** a variant puzzle, with what makes it one */
  | { reason: 'variant'; source: LinkSource; found: VariantMark[] }
  /** not a 9×9 grid */
  | { reason: 'size'; source: LinkSource }
  /** the payload did not decode */
  | { reason: 'unreadable'; source: LinkSource }
  /** an address of the site that carries no puzzle */
  | { reason: 'no-puzzle'; source: LinkSource };

export type LinkResult =
  /** 81 cells, digits and dots; the source is null for a bare string */
  | { ok: true; puzzle: string; source: LinkSource | null }
  | ({ ok: false } & LinkRefusal);

const accept = (puzzle: string, source: LinkSource | null): LinkResult => ({ ok: true, puzzle: puzzle.replace(/0/g, '.'), source });
const refuse = (refusal: LinkRefusal): LinkResult => ({ ok: false, ...refusal });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown) => Array.isArray(v) && v.length > 0;
/** a cell's digit, written as a number or a string; 0 for anything else */
const digitOf = (v: unknown) => ((typeof v === 'number' || typeof v === 'string') && /^[1-9]$/.test(String(v)) ? Number(v) : 0);
const stringOf = (digits: number[]) => digits.map((d) => (d ? String(d) : '.')).join('');

/** decodeURIComponent where it applies; the text itself where it does not */
function percentDecoded(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// ---- SudokuPad's and Sudoku Exchange's digit runs -----------------------------

/**
 * The digit runs SudokuPad's scf ids and Sudoku Exchange's shortened links
 * write: one character per digit and the zeros after it (up to five), the
 * character 0-9 for a digit alone, then A-Z and a-x for the rest.
 */
const dedoku = (runs: string) =>
  runs.replace(/./g, (ch) => {
    const v = ch.charCodeAt(0) - (ch > 'Z' ? 61 : ch > '9' ? 55 : 48);
    return (v % 10) + '0'.repeat(Math.floor(v / 10));
  });
const codoku = (digits: string) =>
  digits.replace(/.0{0,5}/g, (run) => {
    const v = Number(run[0]) + 10 * run.length;
    return String.fromCharCode(v + (v < 20 ? 38 : v < 46 ? 45 : 51));
  });

// ---- lz-string payloads ---------------------------------------------------------

/**
 * The JSON a payload holds: percent-decoded if it was encoded, spaces read
 * as the + they were, decompressed, parsed as JSON or as SudokuPad's
 * shortened JSON; null when none of that works. A link whose // was folded
 * to / on its way here (some chat apps and servers tidy paths) gets a
 * slash put back at each single slash in turn, then at two, as SudokuPad
 * does, within a budget.
 */
function decodeJson(payload: string): unknown {
  const data = percentDecoded(payload).replace(/ /g, '+');
  return jsonOf(data) ?? repairSlashes(data, 1, { left: 400 }) ?? repairSlashes(data, 2, { left: 400 });
}

function jsonOf(data: string): unknown {
  const text = decompressFromBase64(data);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    // SudokuPad's shortened JSON
  }
  try {
    return JSON.parse(unzip(text));
  } catch {
    return null;
  }
}

function repairSlashes(data: string, depth: number, budget: { left: number }): unknown {
  for (const m of data.matchAll(/\/+/g)) {
    if (m[0].length !== 1) continue;
    if (budget.left-- <= 0) return null;
    const fixed = data.slice(0, m.index) + '/' + data.slice(m.index);
    const json = depth === 1 ? jsonOf(fixed) : repairSlashes(fixed, depth - 1, budget);
    if (json) return json;
  }
  return null;
}

/** the long names of the keys SudokuPad's PuzzleZipper shortens */
const ZIP_KEYS: Record<string, string> = {
  c: 'color',
  ca: 'cages',
  ct: 'center',
  c1: 'borderColor',
  c2: 'backgroundColor',
  ce: 'cells',
  cs: 'cellSize',
  a: 'arrows',
  o: 'overlays',
  u: 'underlays',
  w: 'width',
  h: 'height',
  v: 'value',
  vd: 'videos',
  l: 'lines',
  r: 'rounded',
  re: 'regions',
  fs: 'fontSize',
  th: 'thickness',
  hl: 'headLength',
  wp: 'wayPoints',
  t: 'title',
  te: 'text',
  d: 'duration',
  d2: 'd'
};

/**
 * SudokuPad's shortened JSON back to JSON, as its PuzzleZipper.unzip does:
 * single quotes for double, keys unquoted and shortened, empty objects
 * dropped from arrays, t and f for true and false, colours without their
 * quotes and #. The quoted strings are kept out of the way meanwhile.
 */
function unzip(zipped: string): string {
  let text = zipped.includes('"') ? zipped : zipped.replace(/\\'/g, '’').replace(/'/g, '"').replace(/’/g, "'");
  const strings: string[] = [];
  text = text.replace(/"(?:[^"]|\\"])*"/g, (s) => `"__{S${strings.push(s) - 1}}__"`);
  text = text
    .replace(/([,{[])([a-zA-Z0-9]+):/g, '$1"$2":')
    .replace(/([,{[])(?=[,}\]])/g, '$1_')
    .replace(/{_}/g, '{}')
    .replace(/([,{[])_/g, '$1{}')
    .replace(/(:)f([,}\]])/g, '$1false$2')
    .replace(/(:)t([,}\]])/g, '$1true$2')
    .replace(/(:)#0([,}\]])/g, '$1"#000000"$2')
    .replace(/(:)#F([,}\]])/g, '$1"#FFFFFF"$2')
    .replace(/(:)([0-9a-fA-F]{6})([,}\]])/g, '$1"#$2"$3')
    .replace(/"__\{S(\d+)\}__"/g, (_, i: string) => strings[Number(i)]);
  return JSON.stringify(lengthen(JSON.parse(text)));
}

function lengthen(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(lengthen);
  if (isRecord(v)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(v)) {
      const long = ZIP_KEYS[key] ?? key;
      if (!(long in out)) out[long] = lengthen(value);
    }
    return out;
  }
  return typeof v === 'string' && /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : v;
}

// ---- the puzzle formats ----------------------------------------------------------

/** the keys of an f-puzzles puzzle that do not make it a variant */
const FPUZZLES_PLAIN = new Set([
  'size',
  'title',
  'author',
  'ruleset',
  'highlightConflicts',
  'grid',
  'solution',
  'truecandidatesoptions',
  'disabledlogic',
  'metadata',
  'id',
  'successMessage'
]);

/** f-puzzles' constraint and cosmetic keys, as the refusal names them; any other key is another rule */
const FPUZZLES_MARKS: Record<string, VariantMark> = {
  'diagonal+': 'diagonals',
  'diagonal-': 'diagonals',
  antiknight: 'antiknight',
  antiking: 'antiking',
  disjointgroups: 'disjointgroups',
  nonconsecutive: 'nonconsecutive',
  extraregion: 'extraregions',
  odd: 'parity',
  even: 'parity',
  thermometer: 'thermometers',
  slowthermometer: 'thermometers',
  palindrome: 'palindromes',
  renban: 'renban',
  whispers: 'whispers',
  betweenline: 'betweenlines',
  regionsumline: 'regionsumlines',
  entropicline: 'entropiclines',
  line: 'lines',
  lockout: 'lines',
  zipperline: 'lines',
  modularline: 'lines',
  nabner: 'lines',
  killercage: 'killercages',
  littlekillersum: 'littlekillers',
  sandwichsum: 'sandwiches',
  xsum: 'xsums',
  skyscraper: 'skyscrapers',
  difference: 'kropki',
  ratio: 'kropki',
  xv: 'xv',
  clone: 'clones',
  arrow: 'arrows',
  doublearrow: 'arrows',
  quadruple: 'quadruples',
  minimum: 'minmax',
  maximum: 'minmax',
  text: 'cosmetics',
  circle: 'cosmetics',
  rectangle: 'cosmetics',
  negative: 'negative',
  fogofwar: 'fog',
  foglight: 'fog'
};

/** nine rows of nine cells, as f-puzzles and SudokuPad write a 9×9 grid */
const isNineByNine = (grid: unknown): grid is unknown[][] =>
  Array.isArray(grid) && grid.length === 9 && grid.every((row) => Array.isArray(row) && row.length === 9);

/**
 * An f-puzzles puzzle: {size, grid: [[{value, given, region…}]], title,
 * author, ruleset, then a key per constraint (true for a rule, a list for
 * drawn ones) and per cosmetic}. The givens are the cells marked given; a
 * puzzle no tool marked up is read from its values. A cosmetic cage with
 * no cells is SudokuPad's way of carrying a title or the rules, not a cage.
 */
function classicFromFPuzzles(p: unknown, source: LinkSource): LinkResult {
  if (!isRecord(p) || !Array.isArray(p.grid)) return refuse({ reason: 'unreadable', source });
  if ((p.size !== undefined && p.size !== 9) || !isNineByNine(p.grid)) return refuse({ reason: 'size', source });
  const cells = p.grid.flat();
  const found = new Set<VariantMark>();
  cells.forEach((cell, i) => {
    if (isRecord(cell) && cell.region !== undefined && cell.region !== boxOf(i)) found.add('irregularregions');
  });
  for (const [key, value] of Object.entries(p)) {
    if (FPUZZLES_PLAIN.has(key) || !value || (Array.isArray(value) && !value.length)) continue;
    if (key === 'cage') {
      if ((value as unknown[]).some((cage) => isRecord(cage) && nonEmpty(cage.cells))) found.add('cages');
      continue;
    }
    found.add(FPUZZLES_MARKS[key] ?? 'other');
  }
  if (found.size) return refuse({ reason: 'variant', source, found: [...found] });
  const givens = cells.map((cell) => (isRecord(cell) && cell.given ? digitOf(cell.value) : 0));
  const values = givens.some(Boolean) ? givens : cells.map((cell) => (isRecord(cell) ? digitOf(cell.value) : 0));
  return accept(stringOf(values), source);
}

/** nine regions that are the nine boxes, in any order */
function standardRegions(regions: unknown[]): boolean {
  if (regions.length !== 9) return false;
  const boxes = new Set<number>();
  for (const region of regions) {
    if (!Array.isArray(region) || region.length !== 9) return false;
    const inBox = new Set<number>();
    for (const rc of region) {
      if (!Array.isArray(rc) || rc.length !== 2 || !Number.isInteger(rc[0]) || !Number.isInteger(rc[1])) return false;
      inBox.add(boxOf(rc[0] * 9 + rc[1]));
    }
    if (inBox.size !== 1) return false;
    boxes.add([...inBox][0]);
  }
  return boxes.size === 9;
}

/**
 * SudokuPad's own puzzle: {cells: [[{value, given…}]], regions, cages,
 * lines, arrows, underlays, overlays, metadata}. A value is a given unless
 * marked otherwise; a cage with cells, any line, arrow, shape or fog, or
 * regions that are not the boxes, make it a variant (metadata rides in
 * cages without cells).
 */
function classicFromScl(p: unknown): LinkResult {
  const source = 'sudokupad';
  if (!isRecord(p) || !Array.isArray(p.cells)) return refuse({ reason: 'unreadable', source });
  if (!isNineByNine(p.cells)) return refuse({ reason: 'size', source });
  const found = new Set<VariantMark>();
  if (nonEmpty(p.regions) && !standardRegions(p.regions as unknown[])) found.add('irregularregions');
  if (Array.isArray(p.cages) && p.cages.some((cage) => isRecord(cage) && nonEmpty(cage.cells))) found.add('cages');
  if (nonEmpty(p.lines)) found.add('lines');
  if (nonEmpty(p.arrows)) found.add('arrows');
  if (nonEmpty(p.underlays) || nonEmpty(p.overlays)) found.add('shapes');
  if (nonEmpty(p.foglight) || nonEmpty(p.foglink)) found.add('fog');
  if (found.size) return refuse({ reason: 'variant', source, found: [...found] });
  const values = p.cells.flat().map((cell) => (isRecord(cell) && cell.given !== false ? digitOf(cell.value) : 0));
  return accept(stringOf(values), source);
}

/**
 * SudokuPad's scf id: the givens as digit runs, then after a * the
 * constraints as letters (w windoku, x the diagonals) and a title and an
 * author as t… and a…, each running to the next lone * (** is a * in the
 * text). Without a *, whatever follows the 81 givens is the constraints.
 */
function classicFromScf(payload: string): LinkResult {
  const source = 'sudokupad';
  const m = /^([^*]*)\*?([\s\S]*)$/.exec(percentDecoded(payload))!;
  const data = m[1];
  let constraints = m[2];
  if (!/^[0-9A-Za-z]*$/.test(data)) return refuse({ reason: 'unreadable', source });
  let givens = dedoku(data);
  if (!payload.includes('*')) {
    givens = givens.slice(0, 81);
    const head = codoku(givens);
    constraints = data.startsWith(head) ? data.slice(head.length) : data;
  }
  if (!/^[0-9]{81}$/.test(givens)) return refuse({ reason: 'unreadable', source });
  const found: VariantMark[] = [];
  for (let i = 0; i < constraints.length; i++) {
    const letter = constraints[i];
    if (letter === 'w') found.push('windoku');
    else if (letter === 'x') found.push('diagonals');
    else if (letter === 'a' || letter === 't') {
      let j = i + 1;
      while (j < constraints.length && !(constraints[j] === '*' && constraints[j + 1] !== '*')) j += constraints[j] === '*' ? 2 : 1;
      i = j;
    }
  }
  if (found.length) return refuse({ reason: 'variant', source, found: [...new Set(found)] });
  return accept(givens, source);
}

/** the characters SudokuPad's older classic ids count blanks in: the index is the run of blanks */
const BLANK_RUNS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz()[]-.~:@!$&'*,;=_";

/**
 * SudokuPad's classic id, in either of its two forms: the digit runs
 * above, or digits with each run of blanks as one of the characters
 * above. The forms share characters, so as SudokuPad does, whichever gives
 * a whole grid wins.
 */
function classicFromClassicId(payload: string): LinkResult {
  const source = 'sudokupad';
  const data = percentDecoded(payload);
  const runsOfBlanks = /^[1-9A-Za-z()[\]\-.~:@!$&'*,;=_]+$/.test(data);
  const digitRuns = /^[0-9A-Za-x]+$/.test(data);
  if (!runsOfBlanks && !digitRuns) return refuse({ reason: 'unreadable', source });
  const fromBlanks = () =>
    [...data]
      .map((ch) => {
        const n = BLANK_RUNS.indexOf(ch);
        return n < 0 ? ch : '.'.repeat(n);
      })
      .join('');
  let givens: string;
  if (runsOfBlanks && !digitRuns) givens = fromBlanks();
  else if (digitRuns && !runsOfBlanks) givens = dedoku(data);
  else {
    const two = dedoku(data);
    givens = two.length === 81 ? two : fromBlanks().length === 81 ? fromBlanks() : two;
  }
  if (givens.length !== 81) return refuse({ reason: Number.isInteger(Math.sqrt(givens.length)) ? 'size' : 'unreadable', source });
  return accept(givens, source);
}

// ---- the addresses ---------------------------------------------------------------

/** a SudokuPad id with a format prefix; anything else is a short id */
const SUDOKUPAD_ID = /^(scl|ctc|fpuzzles|fpuz|scf|classic)([\s\S]*)$/;

function fromSudokuPadId(id: string): LinkResult {
  const m = SUDOKUPAD_ID.exec(id);
  if (!m) return refuse({ reason: 'short-id', source: 'sudokupad' });
  const [, prefix, payload] = m;
  if (prefix === 'scf') return classicFromScf(payload);
  if (prefix === 'classic') return classicFromClassicId(payload);
  const json = decodeJson(payload);
  if (!json) return refuse({ reason: 'unreadable', source: 'sudokupad' });
  return prefix === 'scl' || prefix === 'ctc' ? classicFromScl(json) : classicFromFPuzzles(json, 'sudokupad');
}

function fromSudokuPadUrl(url: URL): LinkResult {
  // the id is the puzzleid query if there is one, else the path, which may start /sudoku/ (or /puzzle/ on the svencodes host)
  const q = /[?&]puzzleid=([^&]+)/.exec(url.search);
  const id = q ? q[1] : url.pathname.replace(/^\/(?:sudoku\/|puzzle\/)?/, '');
  if (!id) return refuse({ reason: 'no-puzzle', source: 'sudokupad' });
  return fromSudokuPadId(id);
}

function fromFPuzzlesUrl(url: URL): LinkResult {
  const source = 'fpuzzles';
  const load = /[?&]load=([^&#]*)/.exec(url.search);
  if (!load) return refuse({ reason: /[?&]id=/.test(url.search) ? 'short-id' : 'no-puzzle', source });
  const json = decodeJson(load[1]);
  if (!json) return refuse({ reason: 'unreadable', source });
  return classicFromFPuzzles(json, source);
}

function fromSudokuExchangeUrl(url: URL): LinkResult {
  const source = 'sudokuexchange';
  const m = /[?&]s=([^&#]*)/.exec(url.search);
  if (!m) return refuse({ reason: 'no-puzzle', source });
  // as the site reads it: _ . and - are empty cells, fewer than 81 characters are digit runs, then digits only
  let s = percentDecoded(m[1]).replace(/[_.-]/g, '0');
  if (s.length < 81 && /^[0-9A-Za-z]+$/.test(s)) s = dedoku(s);
  s = s.replace(/\D/g, '');
  if (s.length !== 81) return refuse({ reason: 'unreadable', source });
  return accept(s, source);
}

function fromSudokuCoachUrl(url: URL): LinkResult {
  const source = 'sudokucoach';
  const parts = url.pathname.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? '';
  if ((parts.includes('play') || parts.includes('solver')) && /^[0-9._-]{81}$/.test(last)) return accept(last.replace(/[_-]/g, '0'), source);
  if (parts.includes('s')) return refuse({ reason: 'short-id', source });
  return refuse({ reason: 'no-puzzle', source });
}

/** the app's own share link, on any origin: /p/<81 cells> (also under /nb/ and /es/) or #p=<81 cells> */
function fromShareUrl(url: URL): LinkResult | null {
  const m = /^\/(?:(?:nb|es)\/)?p\/([0-9.]{81})\/?$/.exec(url.pathname) ?? /(?:^#|&)p=([0-9.]{81})(?:&|$)/.exec(url.hash);
  return m ? accept(m[1], 'sudokui') : null;
}

const SITES: [RegExp, (url: URL) => LinkResult][] = [
  [/^(?:www\.)?f-puzzles\.com$/i, fromFPuzzlesUrl],
  [/^(?:(?:beta\.)?sudokupad\.app|sudokupad\.svencodes\.com|(?:app|test)\.crackingthecryptic\.com)$/i, fromSudokuPadUrl],
  [/^(?:www\.)?sudokuexchange\.com$/i, fromSudokuExchangeUrl],
  [/^(?:www\.)?sudoku\.coach$/i, fromSudokuCoachUrl]
];

const URL_IN_TEXT = /\bhttps?:\/\/[^\s<>"'`]+/i;
const SITE_IN_TEXT =
  /\b(?:www\.)?(?:(?:beta\.)?sudokupad\.app|sudokupad\.svencodes\.com|(?:app|test)\.crackingthecryptic\.com|f-puzzles\.com|sudokuexchange\.com|sudoku\.coach|sudokui\.app)\/[^\s<>"'`]*/i;

/** the first address in the text, with or without its scheme; a link quoted in a sentence drops the full stop or bracket it drags along */
function findUrl(text: string): URL | null {
  const m = URL_IN_TEXT.exec(text) ?? SITE_IN_TEXT.exec(text);
  if (!m) return null;
  let raw = m[0];
  if (raw !== text) raw = raw.replace(/[.,;:!?)\]]+$/, '');
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

/**
 * The puzzle a pasted text carries: a link from one of the sites above, a
 * SudokuPad id on its own, a line of Sudoku Exchange's puzzle bank, or the
 * bare 81 characters (digits, with dots or zeros for empty cells, in
 * whatever frame); null when it is none of these. A link of a known site
 * that gives no puzzle is a refusal that says why.
 */
export function puzzleFromLink(text: string): LinkResult | null {
  const trimmed = text.trim();
  const url = findUrl(trimmed);
  if (url) {
    const own = fromShareUrl(url);
    if (own) return own;
    for (const [host, read] of SITES) if (host.test(url.hostname)) return read(url);
    // any other address: 81 cells written in its path or a query value are a puzzle, named as nothing
    const cells = [...url.pathname.split('/'), ...url.searchParams.values()].find((part) => /^[0-9.]{81}$/.test(part));
    return cells ? accept(cells, null) : null;
  }
  if (SUDOKUPAD_ID.test(trimmed)) return fromSudokuPadId(trimmed);
  const bank = /^[0-9a-f]{12}\s+([0-9]{81})\s+\d+(?:\.\d+)?$/i.exec(trimmed);
  if (bank) return accept(bank[1], 'sudokuexchange');
  const bare = puzzleStringOf(text);
  return bare ? accept(bare, null) : null;
}
