/**
 * The set tracker as the player reads it, for the soundness harness
 * (tests/setsSoundness.test.ts, tests/setsRareLines.test.ts): the line
 * under the board rendered on the server, its swatches told apart by the
 * colour they are drawn in, every sentence classified, the proof under
 * Why? read back into houses as a solver would read it, and all of it held
 * to the referee (tests/setsOracle.ts). Not a test file itself.
 *
 * The lines a verdict may show are written out here in each language, as
 * the harness's author read and judged them against the English: a line in
 * the wrong place, or a translation that changes its claim, then fails.
 *
 * A test file that renders the proof mocks React's useState so the
 * tracker's one boolean starts open while __openSetProof is set (there is
 * no DOM to click in); see the top of tests/setsSoundness.test.ts.
 */
import { expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compareSets } from '../src/engine/sets';
import { SetTracker } from '../src/ui/SetTracker';
import { PALETTE } from '../src/ui/Grid';
import { useGame, CellState } from '../src/state/gameStore';
import { useSettings } from '../src/state/settings';
import { useLocales } from '../src/content/i18n';
import { setEngineText } from '../src/engine/text';
import * as O from './setsOracle';

export type Lang = 'en' | 'nb' | 'es';

// ---- the board ------------------------------------------------------------------------

/** server rendering reads a store's initial state: point it at the state now */
function snapshot() {
  for (const store of [useGame, useSettings, useLocales] as unknown as { getState(): object; getInitialState(): object }[]) {
    const now = { ...store.getState() } as Record<string, unknown>;
    const init = store.getInitialState() as Record<string, unknown>;
    for (const k of Object.keys(init)) delete init[k];
    Object.assign(init, now);
  }
}

/** a palette colour on some cells that is neither set's: it must be left alone */
export const otherColour = () => [8, 7, 6].find((c) => !useSettings.getState().setColors.includes(c))!;

/** the two sets painted in the two chosen colours, another colour on every 17th cell, and the digits */
export function paint(a: number[], b: number[], values: ArrayLike<number> = new Uint8Array(81), tracker = true) {
  const [ca, cb] = useSettings.getState().setColors;
  const other = otherColour();
  useSettings.getState().set({ setTracker: tracker });
  const cells: CellState[] = Array.from({ length: 81 }, (_, i) => ({
    given: false,
    value: values[i],
    corner: 0,
    center: 0,
    excluded: 0,
    colors: [...(a.includes(i) ? [ca] : []), ...(b.includes(i) ? [cb] : []), ...(i % 17 === 0 ? [other] : [])]
  }));
  useGame.setState({ cells });
  snapshot();
}

/** the language of the app and of the engine's lists ("1, 2 and 3"); nb and es must be loaded */
export function inLang(lang: Lang) {
  useSettings.getState().set({ lang });
  const loc = lang === 'en' ? null : useLocales.getState().loaded[lang];
  if (lang !== 'en' && !loc) throw new Error(`load ${lang} first`);
  setEngineText(lang, loc ? loc.engine : null);
}

/** the two sets' colours for a while */
export function withColours(colours: [number, number], run: () => void) {
  const before = useSettings.getState().setColors;
  useSettings.getState().set({ setColors: colours });
  try {
    run();
  } finally {
    useSettings.getState().set({ setColors: before });
  }
}

// ---- the lines, in each language -------------------------------------------------------

interface Lines {
  /** the swatch's label, before its number */
  colour: string;
  /** one side: count, the word for cells, placed, and a list's lead-in and list */
  side: RegExp;
  oneCell: string;
  cells: string;
  exactly: string;
  stillNeeds: string;
  /** the last joiner of a list */
  and: string;
  sizes: RegExp;
  differ: string;
  unproved: string;
  paint: RegExp;
  wrong: string;
  proved: string;
  /** the proof under Why? */
  sentence: RegExp;
  kinds: Record<string, number>;
  times: RegExp;
  ignore: string[];
  why: string;
  hide: string;
}

export const LINES: Record<Lang, Lines> = {
  en: {
    colour: 'Colour',
    side: /^(\d+) (cells|cell), (\d+) placed(?:, (the rest is exactly|still needs) (.+))?$/,
    oneCell: 'cell',
    cells: 'cells',
    exactly: 'the rest is exactly',
    stillNeeds: 'still needs',
    and: 'and',
    sizes: /^Not the same digits: (\d+) cells against (\d+)$/,
    differ: 'Not necessarily the same digits: no count of houses links them, and some valid grid fills them differently',
    unproved: 'Not proved: no count of rows, columns and boxes links these sets',
    paint: /^Paint the other set in \[(A|B)\] to compare$/,
    wrong: 'Same digits, yet one set needs more digits than it has empty cells: a digit on the board is wrong',
    proved: '✓ Same digits, proved by counting houses',
    sentence: /^\[A\](?: ×(\d+))? with (.*) covers the same cells as \[B\](?: ×(\d+))? with (.*)\. Each house holds every digit once, so the two sets hold the same digits\.$/,
    kinds: { row: 0, rows: 0, column: 9, columns: 9, box: 18, boxes: 18 },
    times: /^counted (\d+) times/,
    ignore: [],
    why: 'Why?',
    hide: 'Hide the proof'
  },
  nb: {
    colour: 'Farge',
    side: /^(\d+) (ruter|rute), (\d+) utfylt(?:, (resten er nøyaktig|mangler fortsatt) (.+))?$/,
    oneCell: 'rute',
    cells: 'ruter',
    exactly: 'resten er nøyaktig',
    stillNeeds: 'mangler fortsatt',
    and: 'og',
    sizes: /^Ikke de samme tallene: (\d+) ruter mot (\d+)$/,
    differ: 'Ikke nødvendigvis de samme tallene: ingen opptelling av enheter knytter dem sammen, og et gyldig brett kan fylle dem ulikt',
    unproved: 'Ikke bevist: ingen opptelling av rader, kolonner og bokser knytter disse settene sammen',
    paint: /^Mal det andre settet i \[(A|B)\] for å sammenligne$/,
    wrong: 'Samme tall, men det ene settet trenger flere tall enn det har tomme ruter: et tall på brettet er feil',
    proved: '✓ Samme tall, bevist ved å telle enheter',
    sentence: /^\[A\](?: ×(\d+))? med (.*) dekker de samme rutene som \[B\](?: ×(\d+))? med (.*)\. Hver enhet har hvert tall én gang, så de to settene har de samme tallene\.$/,
    kinds: { rad: 0, radene: 0, kolonne: 9, kolonnene: 9, boks: 18, boksene: 18 },
    times: /^(\d+) ganger/,
    ignore: [],
    why: 'Hvorfor?',
    hide: 'Skjul beviset'
  },
  es: {
    colour: 'Color',
    side: /^(\d+) (casillas|casilla), (\d+) con número(?:, (el resto es exactamente|aún le faltan) (.+))?$/,
    oneCell: 'casilla',
    cells: 'casillas',
    exactly: 'el resto es exactamente',
    stillNeeds: 'aún le faltan',
    and: 'y',
    sizes: /^No son los mismos números: (\d+) casillas frente a (\d+)$/,
    differ: 'No necesariamente los mismos números: ningún recuento de unidades los une, y algún tablero válido los llena de forma distinta',
    unproved: 'Sin demostrar: ningún recuento de filas, columnas y cajas une estos conjuntos',
    paint: /^Pinta el otro conjunto en \[(A|B)\] para comparar$/,
    wrong: 'Mismos números, pero un conjunto necesita más números de los que caben en sus casillas vacías: hay un número equivocado en el tablero',
    proved: '✓ Mismos números, demostrado contando unidades',
    sentence: /^\[A\](?: ×(\d+))? con (.*) cubre las mismas casillas que \[B\](?: ×(\d+))? con (.*)\. Cada unidad tiene cada número una vez, así que los dos conjuntos tienen los mismos números\.$/,
    kinds: { fila: 0, filas: 0, columna: 9, columnas: 9, caja: 18, cajas: 18 },
    times: /^(\d+) veces/,
    ignore: ['la', 'las'],
    why: '¿Por qué?',
    hide: 'Ocultar la demostración'
  }
};

/** a list as a solver writes it: "4", "4 and 7", "1, 4 and 7" */
export const writtenList = (items: number[], and: string) =>
  items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;

// ---- rendering --------------------------------------------------------------------------

export interface Shown {
  html: string;
  /** each side's swatch, [A] or [B], and its text */
  sides: { colour: string; text: string }[];
  verdict: string;
  proved: boolean;
  /** the Why? button: its text and whether it says the proof is open; null when there is none */
  why: { text: string; expanded: boolean } | null;
  proof: string | null;
}

/**
 * Swatches as [A] and [B], read by the colour they are drawn in: that colour
 * must be the one their label names, and one of the two sets' colours.
 */
export function readSwatches(s: string, lang: Lang): string {
  const [ca, cb] = useSettings.getState().setColors;
  const out = s.replace(/<span class="set-swatch" style="background:(#[0-9a-fA-F]{6})" role="img" aria-label="([^"]*)"><\/span>/g, (_, hex: string, label: string) => {
    const drawn = PALETTE.indexOf(hex.toLowerCase());
    const named = new RegExp(`^${LINES[lang].colour} (\\d)$`).exec(label);
    if (drawn < 0 || !named || Number(named[1]) - 1 !== drawn) throw new Error(`a swatch drawn in ${hex} is labelled "${label}": ${s}`);
    if (drawn === ca) return '[A]';
    if (drawn === cb) return '[B]';
    throw new Error(`a swatch in neither set's colour (${hex}): ${s}`);
  });
  if (/set-swatch/.test(out)) throw new Error(`a swatch the reader cannot read: ${s}`);
  return out
    .replace(/<button[^>]*>.*?<\/button>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, '’')
    .replace(/&amp;/g, '&');
}

/** the tracker as the player sees it, the proof opened */
export function show(a: number[], b: number[], values?: ArrayLike<number>): Shown {
  paint(a, b, values);
  const lang = useSettings.getState().lang as Lang;
  (globalThis as { __openSetProof?: boolean }).__openSetProof = true;
  let html: string;
  try {
    html = renderToStaticMarkup(React.createElement(SetTracker));
  } finally {
    (globalThis as { __openSetProof?: boolean }).__openSetProof = false;
  }
  const sides = [...html.matchAll(/<span class="set-side">(<span class="set-swatch"[^>]*><\/span>[^<]*)<\/span>/g)].map((m) => {
    const t = readSwatches(m[1], lang);
    return { colour: t.slice(0, 3), text: t.slice(3).trim() };
  });
  const verdictMatch = /<span class="set-verdict( proved)?">(.*?)(<button|<\/span><\/div>)/.exec(html);
  const whyMatch = /<button class="link-btn set-why" aria-expanded="(true|false)">([^<]*)<\/button>/.exec(html);
  const proofMatch = /<p class="set-proof">(.*?)<\/p>/.exec(html);
  if ((html.match(/<button/g) ?? []).length > (whyMatch ? 1 : 0)) throw new Error(`a button the reader cannot read: ${html}`);
  return {
    html,
    sides,
    verdict: verdictMatch ? readSwatches(verdictMatch[2], lang) : '',
    proved: !!verdictMatch?.[1],
    why: whyMatch ? { text: whyMatch[2], expanded: whyMatch[1] === 'true' } : null,
    proof: proofMatch ? readSwatches(proofMatch[1], lang) : null
  };
}

// ---- the proof, read back -----------------------------------------------------------------

/**
 * The houses a sentence names, read back as a solver would: each kind word
 * starts a group, the numbers after it are its houses, and "counted n
 * times" (", n ganger", ", n veces") counts the group right before it n
 * times, as the tracker means it. With binding 'run', the count is read as
 * covering every group since the last count instead: a reader who takes it
 * that way, and a sentence that reads differently so, is ambiguous.
 * Anything else in the list is a fault.
 */
export function readHouses(text: string, lang: Lang, binding: 'group' | 'run' = 'group'): O.TermLike[] {
  const L = LINES[lang];
  const out: O.TermLike[] = [];
  let group: O.TermLike[] | null = null;
  let run: O.TermLike[] = [];
  let rest = text.replace(/,/g, ' , ').trim();
  while (rest.length) {
    const times = L.times.exec(rest);
    if (times && group) {
      for (const t of binding === 'group' ? group : run) t.times = Number(times[1]);
      group = null;
      run = [];
      rest = rest.slice(times[0].length).trim();
      continue;
    }
    const [word] = rest.split(/\s+/);
    rest = rest.slice(word.length).trim();
    if (word === ',' || word === L.and || L.ignore.includes(word)) continue;
    if (word in L.kinds) {
      group = [];
      const from = L.kinds[word];
      for (;;) {
        const m = new RegExp(`^(\\d+)(?:\\s*,\\s*|\\s+${L.and}\\s+)?`).exec(rest);
        // a number followed by "ganger"/"veces" belongs to the count
        if (!m || L.times.test(rest)) break;
        const t = { house: from + Number(m[1]) - 1, times: 1 };
        group.push(t);
        run.push(t);
        out.push(t);
        rest = rest.slice(m[0].length).trim();
        if (L.times.test(rest) || !/^\d/.test(rest)) break;
      }
      if (!group.length) throw new Error(`no number after "${word}" in "${text}"`);
      continue;
    }
    throw new Error(`cannot read "${word}" in "${text}"`);
  }
  return out;
}

export const termsKey = (ts: O.TermLike[]) =>
  ts
    .map((t) => `${t.house}x${t.times}`)
    .sort()
    .join();

// ---- what a rendering claims, held to the truth ---------------------------------------------

/** counts across every reading: proofs read back per language, lists checked, lists on wrong boards */
export const tally = new Map<string, number>();
export const bump = (key: string, by = 1) => tally.set(key, (tally.get(key) ?? 0) + by);

/**
 * Holds a rendered tracker to the referee: every side, the one line its
 * verdict may show (in the language shown), the Why? button and the proof.
 * With a solution, every list of digits is checked against it when every
 * digit on the board is right; on a board with a wrong digit a list is drawn
 * from that digit (the known finding in tests/setsSoundness.test.ts), so
 * there it is checked against completions the board still has (up to three,
 * found in different orders), and counted when the solution says otherwise.
 */
export function readsTrue(a: number[], b: number[], shown: Shown, lang: Lang, values?: ArrayLike<number>, solution?: Uint8Array) {
  const L = LINES[lang];
  const truth = O.truthOf(a, b);
  const { A, B } = truth;
  const what = `${lang} A=[${A}] B=[${B}] ${shown.html}`;
  const v = compareSets(a, b);
  if (!A.length && !B.length) {
    expect(v.kind, what).toBe('empty');
    expect(shown.html, what).toBe('');
    return;
  }
  const board = values ?? new Uint8Array(81);
  const ledgers = O.ledgerTruth(a, b, board);
  const impossible = v.kind === 'same' && ledgers.some((l) => l.needs.length > l.empty);
  const proved = v.kind === 'same' && !impossible;

  // the sides: as many as have cells, each in its own colour, counted right
  const present = [A.length ? '[A]' : null, B.length ? '[B]' : null].filter(Boolean);
  expect(shown.sides.map((s) => s.colour), what).toEqual(present);
  for (const side of shown.sides) {
    const l = ledgers[side.colour === '[A]' ? 0 : 1];
    const m = L.side.exec(side.text);
    expect(m, `a side that reads as none of the ${lang} lines: "${side.text}" ${what}`).not.toBeNull();
    const [, n, word, placed, lead, list] = m!;
    expect([Number(n), Number(placed)], what).toEqual([l.size, l.placed.length]);
    if (!lead) {
      // no list: nothing proved, or nothing owed
      expect(proved && l.needs.length > 0, `a list left out: ${what}`).toBe(false);
      expect(word, what).toBe(l.size === 1 ? L.oneCell : L.cells);
      continue;
    }
    // a list of digits is a claim only a true proof may make
    expect(v.kind, what).toBe('same');
    expect(truth.same, what).toBe(true);
    expect(impossible, what).toBe(false);
    expect(word, what).toBe(L.cells);
    const listed = (list.match(/\d+/g) ?? []).map(Number);
    expect(list, what).toBe(writtenList(listed, L.and));
    expect(listed, what).toEqual(l.needs);
    // "exactly" when the list fills every empty cell, "still needs" when it fills fewer
    expect(lead, what).toBe(listed.length === l.empty ? L.exactly : L.stillNeeds);
    expect(listed.length, what).toBeLessThanOrEqual(l.empty);
    bump(`${lang} lists shown`);
    if (!solution) continue;
    const cells = side.colour === '[A]' ? A : B;
    const empties = cells.filter((i) => !board[i]);
    const holds = (grid: ArrayLike<number>) => empties.map((i) => grid[i]);
    const trueOf = (grid: ArrayLike<number>) => O.within(listed, holds(grid)) && (lead !== L.exactly || [...holds(grid)].sort().join() === listed.join());
    if (O.agrees(board, solution)) {
      expect(trueOf(solution), `"${side.text}", the empty cells hold ${holds(solution)}: ${what}`).toBe(true);
      bump(`${lang} lists checked against the solution`);
      if (lead === L.exactly) bump(`${lang} "exactly" lists checked against the solution`);
    } else {
      // drawn from a wrong digit: true of every completion the board has
      // left, if any (the first one found, and two found in random orders)
      const completions = [O.solveBoard(board), O.solveBoard(board, O.rngFrom(board.length + listed.length)), O.solveBoard(board, O.rngFrom(7 * empties.length))];
      for (const completion of completions) {
        if (!completion) continue;
        expect(O.isValidGrid(completion) && O.agrees(board, completion), what).toBe(true);
        expect(trueOf(completion), `"${side.text}" is false of the board's own completion ${Array.from(completion).join('')}: ${what}`).toBe(true);
        bump(`${lang} lists on a board with a wrong digit, checked on a completion of it`);
      }
      bump(`${lang} lists on a board with a wrong digit`);
      if (!trueOf(solution)) {
        // with no completion, the board's puzzle's (the known finding);
        // with one, only of the grid the digits were drawn from
        if (completions[0]) bump(`${lang} lists on a completable board, false of the grid its digits were drawn from`);
        else {
          bump(`${lang} lists on a board with a wrong digit and no completion, false of the solution (known finding)`);
          if (lead === L.exactly) bump(`${lang} "exactly" lists on a board with a wrong digit and no completion, false of the solution (known finding)`);
        }
      }
    }
  }

  // the one line its verdict may show, and what that line claims
  switch (v.kind) {
    case 'one': {
      const m = L.paint.exec(shown.verdict);
      expect(m, `${shown.verdict}: ${what}`).not.toBeNull();
      // it asks for the colour that has no cells of its own
      expect(m![1] === 'A' ? A.length : B.length, what).toBe(0);
      break;
    }
    case 'sizes': {
      const m = L.sizes.exec(shown.verdict);
      expect(m, `${shown.verdict}: ${what}`).not.toBeNull();
      expect([Number(m![1]), Number(m![2])], what).toEqual([A.length, B.length]);
      expect(truth.same, what).toBe(false);
      break;
    }
    case 'differ':
      expect(shown.verdict, what).toBe(L.differ);
      expect(truth.same, what).toBe(false);
      break;
    case 'unproved':
      // "no count of houses links them": the referee confirms none can
      expect(shown.verdict, what).toBe(L.unproved);
      expect(truth.same, what).toBe(false);
      break;
    case 'same':
      expect(truth.same, `FALSE "SAME DIGITS" shown: ${what}`).toBe(true);
      if (impossible) {
        expect(shown.verdict, what).toBe(L.wrong);
        expect(O.solveBoard(board), `called wrong, yet the board has a completion: ${what}`).toBeNull();
        bump(`${lang} a digit is wrong`);
      } else {
        expect(shown.verdict, what).toBe(L.proved);
      }
      break;
    default:
      throw new Error(`a verdict the reader does not know: ${what}`);
  }
  bump(`${lang} line ${v.kind}`);
  expect(shown.proved, what).toBe(proved);

  // the proof under Why?: only for a proof, and every house it names read back as an identity
  if (v.kind !== 'same') {
    expect(shown.why, what).toBeNull();
    expect(shown.proof, what).toBeNull();
    return;
  }
  expect(shown.why, what).toEqual({ text: shown.proof === null ? L.why : L.hide, expanded: shown.proof !== null });
  expect(shown.proof, what).not.toBeNull();
  const m = L.sentence.exec(shown.proof!);
  expect(m, `the proof does not read as expected: ${shown.proof}`).not.toBeNull();
  const [, scaleA, withA, scaleB, withB] = m!;
  expect(scaleA, what).toBe(scaleB);
  const scale = scaleA ? Number(scaleA) : 1;
  expect(scale, what).toBe(v.scale);
  const [readA, readB] = [readHouses(withA, lang), readHouses(withB, lang)];
  // the sentence names exactly the verdict's houses, and holds as written
  expect([termsKey(readA), termsKey(readB)], shown.proof!).toEqual([termsKey(v.withA), termsKey(v.withB)]);
  const fault = O.proofFault(A, B, scale, readA, readB);
  expect(fault, `the proof as written does not hold (${fault}): ${shown.proof}`).toBeNull();
  bump(`${lang} proofs read back`);
  if (scale > 1) bump(`${lang} proofs with a scale`);
  if ([...readA, ...readB].some((t) => t.times > 1)) bump(`${lang} proofs with a house counted more than once`);
}
