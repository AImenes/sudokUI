/**
 * The words pass (docs/hint-readability-2026-11.md, L2 and L3), for BUG+1,
 * Unique Rectangle Type 3, Chute Remote Pair, the Extended Rectangle, the
 * ALS-XY-Wing and ALS-XY-Chain, the Grouped Nice Loop, 3D Medusa, the AIC
 * and the fish's fins:
 * - plain and exact words (L2): BUG+1 says what the grid is, not "a
 *   bivalue grid with two solutions"; UR3's roof is no "cell read as one";
 *   the Extended Rectangle has no "Type 1" and no "loop"; the ALS-XY-Wing's
 *   hinge holds one of two digits, not "lacks at most one"; an AIC names
 *   itself once in the panel, its title; a fish of two fins says "fins";
 *   "chute" is left only in Chute Remote Pair's name;
 * - one lead line (L3) for the ALS-XY-Chain, the ALS-XY-Wing, the Grouped
 *   Nice Loop and the AIC, their chains' notation left to Copy step; a 3D
 *   Medusa that proves a colour false counts the many candidates it removes
 *   (rules 1, 2 and 6), the board barring each and Copy step listing them;
 * - the hint panel shows the explanation without the "Name:" its title
 *   repeats, for every technique at once (src/content/panelText.ts), and
 *   Learn's worked examples keep it under their own headings;
 * - every sentence is true of its board and of the puzzle's solution at
 *   every find of these techniques along practice solve paths, the panel
 *   leaves out exactly the name in the three languages, and Norwegian and
 *   Spanish name the same cells and digits as English (a sample of the
 *   paths; WORDS_SCAN=all reads every practice puzzle's path).
 * The Copy step lines are unchanged (tests/eureka.test.ts, and the two 3D
 * Medusas here).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { env } from 'node:process';
import { Grid, UNITS, bit, digitsOf, popcount, parseGrid, isSolved, sees, cellName } from '../src/engine/board';
import { findStep, findNextStep, applyStep } from '../src/engine/humanSolver';
import { solve } from '../src/engine/bruteForce';
import { walkFrames, describe as describeStep, isContinuousLoop, countsRemovals } from '../src/engine/hintFrames';
import { alsClash } from '../src/engine/truth';
import { setEngineText, tr } from '../src/engine/text';
import { TECHS } from '../src/engine/ratings';
import type { Tech } from '../src/engine/ratings';
import type { CellDigit, ChainSet, Step } from '../src/engine/steps';
import { EXAMPLES } from '../src/content/examples';
import { exampleGrid } from '../src/content/learnLocale';
import { legendOf } from '../src/content/boardSvg';
import { stepText } from '../src/content/eureka';
import { panelExplanation, withoutName } from '../src/content/panelText';
import { buildLearnPages } from '../src/content/learnPages';
import practice from '../src/content/practicePuzzles.json';
import engineNb from '../src/content/locales/engine.nb';
import engineEs from '../src/content/locales/engine.es';
import { techNames as namesNb } from '../src/content/locales/names.nb';
import { techNames as namesEs } from '../src/content/locales/names.es';

afterEach(() => setEngineText('en', null));

const LANGS = [
  ['en', null],
  ['nb', engineNb],
  ['es', engineEs]
] as const;
type Lang = (typeof LANGS)[number][0];

/** the hint panel's title in a language, as the app's translator gives it */
const titleOf = (tech: Tech, lang: Lang) => (lang === 'nb' ? namesNb[tech] : lang === 'es' ? namesEs[tech] : undefined) ?? TECHS[tech].name;

const SCANNED: Tech[] = [
  'BUG_PLUS_1',
  'UNIQUENESS_3',
  'CHUTE_REMOTE_PAIR',
  'EXTENDED_RECTANGLE',
  'ALS_XY_WING',
  'ALS_XY_CHAIN',
  'GROUPED_NICE_LOOP',
  'MEDUSA_3D',
  'AIC',
  'FINNED_X_WING',
  'FULL_HOUSE'
];

const cellOf = (name: string) => (Number(name[1]) - 1) * 9 + Number(name[3]) - 1;
const cellsIn = (s: string) => [...s.matchAll(/r\dc\d/g)].map((m) => cellOf(m[0]));
const digitsIn = (s: string) => [...s.replace(/r\dc\d/g, ' ').matchAll(/\d/g)].map((m) => Number(m[0]));
const sorted = (xs: number[]) => [...xs].sort((a, b) => a - b);
const uniq = (xs: number[]) => sorted([...new Set(xs)]);
/** a list of digits as a sentence writes it: "2, 4 and 9", "1 and 6", "7" */
const listed = (s: string) => s.split(/, | and /).map(Number);
const valuesOf = (g: Grid) => Array.from(g.values).join('');

/** the cells and digits a text names, to hold a translation to the English */
const namedIn = (s: string) => JSON.stringify([uniq(cellsIn(s)), uniq(digitsIn(s))]);

/** the step's stored example, found again in the language the engine writes now */
const exampleIn = (tech: Tech) => findStep(tech, exampleGrid(EXAMPLES[tech]!))!;

describe('the panel leaves out the name its title repeats (L3)', () => {
  it('strips a name, a shorter form of it, and its digit, and nothing else', () => {
    expect(withoutName('Full House: r4c9 is the last empty cell in row 4, so it must be 8.', ['Full House'])).toBe(
      'r4c9 is the last empty cell in row 4, so it must be 8.'
    );
    expect(withoutName('X-Wing on 7: in rows 3 and 8, the 7s lie only in columns 3 and 8.', ['X-Wing'])).toBe('In rows 3 and 8, the 7s lie only in columns 3 and 8.');
    expect(withoutName('X-Wing på 7: i radene 3 og 8 står 7-tallene bare i kolonnene 3 og 8.', ['X-Wing'])).toBe('I radene 3 og 8 står 7-tallene bare i kolonnene 3 og 8.');
    expect(withoutName('X-Wing en el 7: en las filas 3 y 8, los 7 solo están en las columnas 3 y 8.', ['X-Wing'])).toBe('En las filas 3 y 8, los 7 solo están en las columnas 3 y 8.');
    // a shorter form, ending where a word or a plural would follow
    expect(withoutName('Nishio: assuming r1c4 = 4 leads to a contradiction.', ['Nishio Forcing Chain'])).toBe('Assuming r1c4 = 4 leads to a contradiction.');
    expect(withoutName('Grouped X-Cycle on 2: a continuous loop of 2s.', ['Grouped X-Cycles'])).toBe('A continuous loop of 2s.');
    expect(withoutName('AIC: if r1c6 is not 8, ...', ['Alternating Inference Chain', 'AIC'])).toBe('If r1c6 is not 8, ...');
    // not a name of the technique, not at the start, or a digit the rest does not name again
    expect(withoutName('Loop: r1c1 is 5.', ['Nice Loop'])).toBe('Loop: r1c1 is 5.');
    expect(withoutName('In row 4: r4c9 is 8.', ['Full House'])).toBe('In row 4: r4c9 is 8.');
    expect(withoutName('X-Wing on 7: in rows 3 and 8, r3c3 and r8c8.', ['X-Wing'])).toBe('X-Wing on 7: in rows 3 and 8, r3c3 and r8c8.');
    expect(withoutName('Full House. Then: r4c9.', ['Full House'])).toBe('Full House. Then: r4c9.');
  });

  it('in every stored example, in the three languages, and Learn keeps the name under its own headings', () => {
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      for (const tech of Object.keys(EXAMPLES) as Tech[]) {
        const step = exampleIn(tech);
        const whole = describeStep(step);
        const shown = panelExplanation(step, titleOf(tech, lang));
        const at = `${lang} ${tech}: ${whole}`;
        // one that opens with its name has it left out, and nothing more; one
        // that batch 3 led with its argument instead (Empty Rectangle,
        // Fireworks, Exocet, WXYZ-Wing) is shown whole, and never opens with
        // the title
        if (shown === whole) {
          expect(whole.toLowerCase().startsWith(titleOf(tech, lang).toLowerCase()), at).toBe(false);
          continue;
        }
        const cut = whole.length - shown.length;
        expect(whole.slice(cut - 2, cut), at).toBe(': ');
        expect(whole.slice(cut).toLowerCase(), at).toBe(shown.toLowerCase());
        expect(namedIn(shown), at).toBe(namedIn(whole.slice(cut)));
        // a capital, unless it opens with a cell's name
        expect(/^(r\dc\d|[\p{Lu}\d])/u.test(shown), at).toBe(true);
        // a digit the name carried is named again
        const on = / (?:on|på|en el) (\d):/.exec(whole.slice(0, cut));
        if (on) expect(digitsIn(shown), at).toContain(Number(on[1]));
      }
    }
    setEngineText('en', null);
    // the pins: under its title, the panel opens on the step
    const shown = (tech: Tech) => panelExplanation(EXAMPLES[tech]!.step, TECHS[tech].name);
    expect(shown('FULL_HOUSE')).toBe('r4c9 is the last empty cell in row 4, so it must be 8.');
    expect(shown('X_WING').startsWith('In rows 3 and 8, the 7s lie only in columns 3 and 8')).toBe(true);
    expect(shown('AIC').startsWith('If r1c6 is not 8,')).toBe(true);
    expect(shown('FINNED_X_WING').startsWith('In columns 3 and 9, the 8s lie in rows 5 and 8')).toBe(true);
    // Learn's worked examples keep the name, under the page's own headings
    const pages = buildLearnPages();
    for (const tech of ['FULL_HOUSE', 'EXTENDED_RECTANGLE', 'AIC', 'ALS_XY_CHAIN'] as Tech[]) {
      const page = pages.find((p) => p.lang === 'en' && p.html.includes(`<h1>${TECHS[tech].name} in sudoku</h1>`))!;
      const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      expect(page.html, tech).toContain(`<p>${esc(describeStep(EXAMPLES[tech]!.step))}</p>`);
    }
  });
});

describe('plain and exact words, one lead line (L2 and L3)', () => {
  it('as the stored examples say them, in English, Norwegian and Spanish', () => {
    const want: Record<Lang, Partial<Record<Tech, string>>> = {
      en: {
        BUG_PLUS_1:
          'Every unsolved cell but r5c6 holds exactly two candidates. Without its 3, r5c6 would too, and each candidate would be found twice in its row, column and box: a deadly pattern, which cannot have just one solution. So r5c6 must be 3.',
        UNIQUENESS_3:
          "r3c4, r3c5, r7c4, r7c5 would form a deadly pattern on 7/8, so one of the roof cells r7c4, r7c5 must take one of the roof's extras (1 and 6), and r7c6 holds only 1 and 6. So 1 and 6 go in the roof and r7c6, and nowhere else in row 7. Here, 6 is removed from r7c7.",
        EXTENDED_RECTANGLE:
          'Five of the six cells, r8c1, r9c1, r8c5, r8c9, r9c9, hold only 2, 4 and 9. If r9c5 were 4 or 9 too, the six cells would form a deadly pattern, and the puzzle would have a second solution, so 4 and 9 are removed from r9c5.',
        ALS_XY_WING:
          'The hinge C (r6c3) holds a 4 or a 6, so wing A (r8c3, r8c8) holds no 4 or wing B (r4c9, r6c8) no 6, and that wing then holds a 7. A or B holds a 7, so no cell that sees every 7 of both can be 7. Here, 7 is removed from r4c8.',
        ALS_XY_CHAIN:
          'If set A (r4c2, r4c7) holds no 4, it holds a 9; then set B (r1c7) holds no 9 and holds a 3, C (r1c5, r1c6) no 3 and a 9, and D (r7c5) no 9 and a 4. A or D holds a 4, so no cell that sees every 4 of both can be 4. Here, 4 is removed from r4c5.',
        GROUPED_NICE_LOOP:
          'This loop of strong and weak links in turn starts and ends at r1c8, so it holds whichever way round it is read: each weak link has exactly one true end, and a candidate that would make both ends of one false cannot be true. Here, 7 and 9 are removed from r2c8, r3c8; 1 and 6 are removed from r9c9.',
        AIC: "If r1c6 is not 8, the chain's links make its last candidate true: r1c9 is then 2. So one of the two is true, and a candidate that would make both false cannot be true. Here, 8 is removed from r1c9."
      },
      nb: {
        BUG_PLUS_1:
          'Alle uløste ruter unntatt r5c6 har nøyaktig to kandidater. Uten 3-tallet ville også r5c6 hatt to kandidater, og hver kandidat ville stått to ganger i raden, kolonnen og boksen sin: et dødelig mønster, som ikke kan ha bare én løsning. Derfor må r5c6 være 3.',
        UNIQUENESS_3:
          'r3c4, r3c5, r7c4, r7c5 ville danne et dødelig mønster med 7/8, så en av takrutene r7c4, r7c5 må bli en av takets ekstrakandidater (1 og 6), og r7c6 har bare 1 og 6. Derfor står 1 og 6 i taket og i r7c6, og ikke noe annet sted i rad 7. Her fjernes 6 fra r7c7.',
        EXTENDED_RECTANGLE:
          'Fem av de seks rutene, r8c1, r9c1, r8c5, r8c9, r9c9, har bare 2, 4 og 9. Hvis også r9c5 var 4 eller 9, ville de seks rutene danne et dødelig mønster, og oppgaven ville hatt en løsning til, så 4 og 9 fjernes fra r9c5.',
        ALS_XY_WING:
          'Hengselet C (r6c3) har en 4 eller en 6, så vingen A (r8c3, r8c8) har ingen 4, eller vingen B (r4c9, r6c8) ingen 6, og da har den vingen en 7. A eller B har en 7, så ingen rute som ser alle 7-tallene i begge, kan være 7. Her fjernes 7 fra r4c8.',
        ALS_XY_CHAIN:
          'Hvis mengde A (r4c2, r4c7) ikke har noen 4, har den en 9; da har mengde B (r1c7) ingen 9 og har en 3, C (r1c5, r1c6) ingen 3 og en 9, og D (r7c5) ingen 9 og en 4. A eller D har en 4, så ingen rute som ser alle 4-tallene i begge, kan være 4. Her fjernes 4 fra r4c5.',
        GROUPED_NICE_LOOP:
          'Denne sløyfen av sterke og svake lenker etter tur begynner og slutter i r1c8, så den holder uansett hvilken vei den leses: hver svak lenke har nøyaktig én sann ende, og en kandidat som ville gjort begge endene av en av dem usanne, kan ikke være sann. Her fjernes 7 og 9 fra r2c8, r3c8; 1 og 6 fjernes fra r9c9.',
        AIC: 'Hvis r1c6 ikke er 8, gjør lenkene i kjeden den siste kandidaten sann: r1c9 er da 2. En av de to er altså sann, og en kandidat som ville gjort begge usanne, kan ikke være sann. Her fjernes 8 fra r1c9.'
      },
      es: {
        BUG_PLUS_1:
          'Todas las casillas sin resolver salvo r5c6 tienen exactamente dos candidatos. Sin su 3, r5c6 también los tendría, y cada candidato aparecería dos veces en su fila, su columna y su caja: un patrón mortal, que no puede tener una sola solución. Así que r5c6 debe ser 3.',
        UNIQUENESS_3:
          'r3c4, r3c5, r7c4, r7c5 formarían un patrón mortal con 7/8, así que una de las casillas del techo, r7c4, r7c5, debe tomar uno de los extras del techo (1 y 6), y r7c6 solo tiene los números 1 y 6. Por tanto, los números 1 y 6 van en el techo y en r7c6, y en ningún otro lugar de la fila 7. Aquí se elimina el 6 de r7c7.',
        EXTENDED_RECTANGLE:
          'Cinco de las seis casillas, r8c1, r9c1, r8c5, r8c9, r9c9, solo tienen los números 2, 4 y 9. Si r9c5 fuera también un 4 o un 9, las seis casillas formarían un patrón mortal y el sudoku tendría una segunda solución, así que el 4 y el 9 se eliminan de r9c5.',
        ALS_XY_WING:
          'La bisagra C (r6c3) tiene un 4 o un 6, así que el ala A (r8c3, r8c8) no tiene ningún 4 o el ala B (r4c9, r6c8) ningún 6, y esa ala tiene entonces un 7. A o B tiene un 7, así que ninguna casilla que vea todos los 7 de ambas puede ser 7. Aquí se elimina el 7 de r4c8.',
        ALS_XY_CHAIN:
          'Si el conjunto A (r4c2, r4c7) no tiene ningún 4, tiene un 9; entonces el conjunto B (r1c7) no tiene ningún 9 y tiene un 3, C (r1c5, r1c6) ningún 3 y un 9, y D (r7c5) ningún 9 y un 4. A o D tiene un 4, así que ninguna casilla que vea todos los 4 de ambos puede ser 4. Aquí se elimina el 4 de r4c5.',
        GROUPED_NICE_LOOP:
          'Este bucle de enlaces fuertes y débiles alternos empieza y termina en r1c8, así que es válido sea cual sea el sentido en que se lea: cada enlace débil tiene exactamente un extremo verdadero, y un candidato que haría falsos los dos extremos de uno de ellos no puede ser verdadero. Aquí se eliminan los candidatos 7 y 9 de r2c8, r3c8; se eliminan los candidatos 1 y 6 de r9c9.',
        AIC: 'Si r1c6 no es 8, los enlaces de la cadena hacen verdadero su último candidato: r1c9 es entonces 2. Así que uno de los dos es verdadero, y un candidato que los haría falsos a ambos no puede ser verdadero. Aquí se elimina el 8 de r1c9.'
      }
    };
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      for (const [tech, text] of Object.entries(want[lang]) as [Tech, string][]) {
        expect(panelExplanation(exampleIn(tech), titleOf(tech, lang)), `${lang} ${tech}`).toBe(text);
      }
    }
    setEngineText('en', null);
    // the labels: plain words, a deadly pattern and no loop, no cell read as one
    expect(EXAMPLES.EXTENDED_RECTANGLE!.step.labels).toEqual({
      primary: 'five of the six cells, which hold only 2, 4 and 9',
      secondary: '4 and 9 in r9c5: each would complete the deadly pattern'
    });
    expect(EXAMPLES.UNIQUENESS_3!.step.labels!.secondary).toBe('1 and 6: the roof must take one, and r7c6 holds only these, so they go nowhere else in row 7');
    // none of the words the report names is left in these techniques' sentences, in any language
    const old = /bivalue grid|pseudo|read as one|lest som én|leíd[oa]s? como|Type 1|type 1|tipo 1|loop\b|sløyfe(?!n)|bucle mortal|lacks at most|høyst ett|como mucho|@/;
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      for (const tech of ['BUG_PLUS_1', 'UNIQUENESS_3', 'EXTENDED_RECTANGLE', 'ALS_XY_WING', 'ALS_XY_CHAIN', 'AIC'] as Tech[]) {
        const step = exampleIn(tech);
        for (const words of [describeStep(step), ...Object.values(step.labels ?? {}), ...walkFrames(step).map((f) => f.text)]) expect(words, `${lang} ${tech}`).not.toMatch(old);
      }
      // Chute Remote Pair says "chute" only in its name
      const crp = exampleIn('CHUTE_REMOTE_PAIR');
      expect(panelExplanation(crp, titleOf('CHUTE_REMOTE_PAIR', lang)), lang).not.toMatch(/chute|franja|boksrekke/i);
      for (const words of [...Object.values(crp.labels ?? {}), ...walkFrames(crp).map((f) => f.text)]) expect(words, lang).not.toMatch(/chute|franja|boksrekke/i);
    }
  });

  it('a fish of two fins says "fins", of one "fin", in its legend and its walk, in the three languages', () => {
    const want = {
      en: [/^fin: an 8 /, /^fins: 1s /],
      nb: [/^finne: /, /^finner: /],
      es: [/^aleta: /, /^aletas: /]
    };
    for (const [lang, table] of LANGS) {
      setEngineText(lang, table);
      const [one, two] = (['FINNED_X_WING', 'SASHIMI_X_WING'] as Tech[]).map(exampleIn);
      expect([one.fins!.length, two.fins!.length]).toEqual([1, 2]);
      expect(one.labels!.fins, lang).toMatch(want[lang][0]);
      expect(two.labels!.fins, lang).toMatch(want[lang][1]);
    }
  });

  it('a 3D Medusa that proves a colour false counts what it removes, and its Copy step line lists them, as always', () => {
    const large = positionAt('.68..........19.24.9...61..8.3.5.....5..3..6.....4.2.5..17...9.97.28..........75.', 29);
    const step = findNextStep(large.grid)!;
    expect([step.tech, step.colouring!.rule, step.eliminations.length, countsRemovals(step)]).toEqual(['MEDUSA_3D', 'medusa1', 29, true]);
    expect(describeStep(step)).toBe(
      'Where'.length && `${step.description} Here, 29 candidates are removed.`
    );
    expect(step.description).toContain('so dark purple is false: every dark purple candidate is removed, and every light purple one is true');
    expect(walkFrames(step).at(-1)!.text).toBe(
      'So all 29 dark purple candidates are removed. Every light purple candidate is true; this step only removes, and each is then a single.'
    );
    expect(stepText(step)).toBe(
      '3D Medusa: (1r4c8,1r8c9,2r3c3,2r4c6,2r5c1,2r7c2,2r9c9,3r1c4,3r9c1,4r1c6,4r3c1,4r4c2,4r5c7,4r8c8,4r9c3,4r9c4,5r2c3,5r7c1,5r8c6,6r6c1,6r8c3,6r9c9,7r2c1,7r4c9,7r5c6,7r6c3,8r5c9,8r7c7,8r7c9) / (1r4c9,1r8c8,2r3c1,2r4c2,2r5c6,2r7c9,2r9c3,3r1c6,3r7c1,3r9c4,4r1c4,4r3c3,4r4c8,4r5c1,5r2c1,5r7c6,5r8c3,6r6c3,6r8c9,6r9c1,7r2c3,7r4c6,7r5c9,7r6c1,8r5c7) => r1c4<>3, r1c6<>4, r2c1<>7, r2c3<>5, r3c1<>4, r3c3<>2, r4c2<>4, r4c6<>2, r4c8<>1, r4c9<>7, r5c1<>2, r5c6<>7, r5c7<>4, r5c9<>8, r6c1<>6, r6c3<>7, r7c1<>5, r7c2<>2, r7c7<>8, r7c9<>8, r8c3<>6, r8c6<>5, r8c8<>4, r8c9<>1, r9c1<>3, r9c3<>4, r9c4<>4, r9c9<>2, r9c9<>6'
    );
    // the stored example argues for its one removal, and lists it
    expect(countsRemovals(EXAMPLES.MEDUSA_3D!.step)).toBe(false);
    expect(stepText(EXAMPLES.MEDUSA_3D!.step)).toBe('3D Medusa: (1r1c1,1r7c3,8r1c3) / (1r7c1,8r1c1,8r7c3) => r7c2<>1');
    for (const [lang, table] of LANGS.slice(1)) {
      setEngineText(lang, table);
      const there = findStep('MEDUSA_3D', large.grid)!;
      expect(describeStep(there).endsWith(lang === 'nb' ? ' Her fjernes 29 kandidater.' : ' Aquí se eliminan 29 candidatos.'), lang).toBe(true);
      expect(walkFrames(there).at(-1)!.text.startsWith(lang === 'nb' ? 'Så fjernes alle de 29 mørkelilla kandidatene.' : 'Así que se eliminan los 29 candidatos morado oscuro.'), lang).toBe(true);
    }
  });
});

/** the position after `at` of the solver's steps, and the solution */
function positionAt(puzzle: string, at: number): { grid: Grid; solution: Uint8Array } {
  const grid = parseGrid(puzzle)!;
  for (let k = 0; k < at; k++) applyStep(grid, findNextStep(grid)!);
  return { grid, solution: solve(parseGrid(puzzle)!)!.values };
}

/** the finds of these techniques at every position along the puzzles' solve paths */
function findsAlong(puzzles: string[]): { step: Step; g: Grid; sol: Uint8Array }[] {
  const out: { step: Step; g: Grid; sol: Uint8Array }[] = [];
  for (const puzzle of puzzles) {
    const g = parseGrid(puzzle)!;
    const sol = solve(parseGrid(puzzle)!)!.values;
    for (let i = 0; i < 300 && !isSolved(g); i++) {
      for (const tech of SCANNED) {
        const step = findStep(tech, g);
        if (step?.tech === tech) out.push({ step, g: { values: new Uint8Array(g.values), cands: new Uint16Array(g.cands), given: g.given }, sol });
      }
      const s = findNextStep(g);
      if (!s) break;
      applyStep(g, s);
    }
  }
  return out;
}

const C = String.raw`r\dc\d`;
const CELLS = String.raw`(?:r\dc\d)(?:, r\dc\d)*`;
const DIGITS = String.raw`\d(?:(?:, \d)* and \d)?`;
const names = (s: string) => cellsIn(s);
/** a set's z cells */
const zCells = (set: ChainSet, z: number) => set.members.filter((m) => m.digit === z).map((m) => m.cell);
/** whether a set holds a digit in the solution */
const holds = (set: ChainSet, d: number, sol: Uint8Array) => set.cells.some((c) => sol[c] === d);
/** whether no cell that sees every one of these cells is d in the solution */
const noneSeeingAll = (cells: number[], d: number, sol: Uint8Array) =>
  Array.from({ length: 81 }, (_, c) => c).every((c) => cells.includes(c) || !cells.every((x) => sees(c, x)) || sol[c] !== d);
/** whether a candidate, if true, would make a node false: same cell, another digit; or same digit, seeing it */
const rulesOut = (r: CellDigit, x: CellDigit) => (r.cell === x.cell ? r.digit !== x.digit : r.digit === x.digit && sees(r.cell, x.cell));
/** a node is true in the solution where one of its candidates is */
const trueIn = (node: CellDigit[], sol: Uint8Array) => node.some((cd) => sol[cd.cell] === cd.digit);

/** what is wrong with a find's description, against its board and the solution (English) */
function wrongIn(step: Step, g: Grid, sol: Uint8Array): string[] {
  const out: string[] = [];
  const ok = (cond: boolean, what: string) => {
    if (!cond) out.push(what);
  };
  const d = step.description;
  const removalsFalse = step.eliminations.every((e) => g.cands[e.cell] & bit(e.digit) && sol[e.cell] !== e.digit);
  ok(removalsFalse, 'a removal is the answer');
  ok(step.placements.every((p) => sol[p.cell] === p.digit), 'a placement is wrong');
  const set = (L: string) => step.sets?.find((x) => x.letter === L);
  switch (step.tech) {
    case 'BUG_PLUS_1': {
      const m = new RegExp(String.raw`^BUG\+1: every unsolved cell but (${C}) holds exactly two candidates\. Without its (\d), \1 would too, and each candidate would be found twice in its row, column and box: a deadly pattern, which cannot have just one solution\. So \1 must be \2\.$`).exec(d);
      if (!m) return [`unparsed: ${d}`];
      const [x, digit] = [cellOf(m[1]), Number(m[2])];
      for (let c = 0; c < 81; c++) if (!g.values[c] && c !== x) ok(popcount(g.cands[c]) === 2, `${cellName(c)} does not hold two`);
      ok(popcount(g.cands[x]) === 3 && !!(g.cands[x] & bit(digit)), 'the cell does not hold three, the digit among them');
      const without = (c: number) => (c === x ? g.cands[c] & ~bit(digit) : g.cands[c]);
      for (const u of UNITS) for (let e = 1; e <= 9; e++) ok([0, 2].includes(u.filter((c) => !g.values[c] && without(c) & bit(e)).length), `${e} not twice in a house`);
      ok(sol[x] === digit, 'the cell is not the digit');
      break;
    }
    case 'UNIQUENESS_3': {
      const m = new RegExp(
        String.raw`^Unique Rectangle Type 3: (${CELLS}) would form a deadly pattern on (\d)/(\d), so one of the roof cells (${C}), (${C}) must take one of the roof's extras \((${DIGITS})\), and (${CELLS}) (?:holds only|hold only) (${DIGITS})(?: between them)?\. So (${DIGITS}) go in the roof and (${CELLS}), and nowhere else in (row|column|box) (\d)\.$`
      ).exec(d);
      if (!m) return [`unparsed: ${d}`];
      const rect = names(m[1]);
      const [x, y] = [Number(m[2]), Number(m[3])];
      const roof = [cellOf(m[4]), cellOf(m[5])];
      const extras = listed(m[6]);
      const S = names(m[7]);
      const digits = listed(m[8]);
      ok(JSON.stringify(listed(m[9])) === JSON.stringify(digits) && JSON.stringify(names(m[10])) === JSON.stringify(S), 'the digits or cells said twice differ');
      const u = (m[11] === 'row' ? 0 : m[11] === 'column' ? 9 : 18) + Number(m[12]) - 1;
      ok(rect.length === 4 && rect.every((c) => g.cands[c] & bit(x) && g.cands[c] & bit(y)), 'the rectangle');
      ok(roof.every((c) => rect.includes(c) && UNITS[u].includes(c)), 'the roof');
      ok(JSON.stringify(uniq(roof.flatMap((c) => digitsOf(g.cands[c] & ~bit(x) & ~bit(y))))) === JSON.stringify(sorted(extras)), "the roof's extras");
      ok(S.every((c) => UNITS[u].includes(c) && !rect.includes(c) && digitsOf(g.cands[c]).every((e) => digits.includes(e))), 'the cells beside the roof hold other digits');
      ok(digits.length === S.length + 1 && extras.every((e) => digits.includes(e)), 'as many digits as cells and one roof cell');
      ok(roof.filter((c) => extras.includes(sol[c])).length === 1, 'not exactly one roof cell takes an extra');
      for (const e of digits) ok(UNITS[u].filter((c) => sol[c] === e).every((c) => roof.includes(c) || S.includes(c)), `${e} elsewhere in the house`);
      ok(step.eliminations.every((e) => UNITS[u].includes(e.cell) && digits.includes(e.digit) && !roof.includes(e.cell) && !S.includes(e.cell)), 'a removal elsewhere');
      break;
    }
    case 'EXTENDED_RECTANGLE': {
      const one = new RegExp(String.raw`^Extended Rectangle: five of the six cells, (${CELLS}), hold only (${DIGITS})\. If (${C}) were (\d(?:(?:, \d)* or \d)?) too, the six cells would form a deadly pattern, and the puzzle would have a second solution, so (${DIGITS}) (?:is|are) removed from \3\.$`).exec(d);
      const two = new RegExp(String.raw`^Extended Rectangle: to avoid a deadly pattern on (${DIGITS}) in (${CELLS}), one of (${CELLS}) must be (\d), so \4 is removed from cells seeing all of them\.$`).exec(d);
      if (one) {
        const five = names(one[1]);
        const trio = listed(one[2]);
        const x = cellOf(one[3]);
        const ds = one[4].split(/, | or /).map(Number);
        ok(trio.length === 3 && five.length === 5 && !five.includes(x), 'five cells and a trio');
        ok(five.every((c) => digitsOf(g.cands[c]).every((e) => trio.includes(e))), 'a cell holds another digit');
        ok(JSON.stringify(listed(one[5])) === JSON.stringify(ds) && ds.every((e) => trio.includes(e) && g.cands[x] & bit(e)), "the sixth's digits");
        ok(digitsOf(g.cands[x]).some((e) => !trio.includes(e)), 'the sixth holds no other digit');
        ok(JSON.stringify(step.eliminations.map((e) => [e.cell, e.digit])) === JSON.stringify(ds.map((e) => [x, e])), 'the removals');
        ok(!trio.includes(sol[x]), 'the sixth is a trio digit');
        // with the trio in all six, the swap gives a second solution: the six lie in two lines and three boxes, two in a box
        const six = [...five, x];
        const boxes = new Set(six.map((c) => UNITS.findIndex((uu, i) => i >= 18 && uu.includes(c))));
        ok(boxes.size === 3, 'three boxes');
      } else if (two) {
        const trio = listed(two[1]);
        const six = names(two[2]);
        const zs = names(two[3]);
        const z = Number(two[4]);
        ok(six.every((c) => digitsOf(g.cands[c]).every((e) => trio.includes(e) || e === z)), 'a cell holds another digit');
        ok(zs.every((c) => six.includes(c) && g.cands[c] & bit(z)) && zs.some((c) => sol[c] === z), 'none of the cells is the extra');
        const seeing = Array.from({ length: 81 }, (_, c) => c).filter((c) => !g.values[c] && !six.includes(c) && g.cands[c] & bit(z) && zs.every((x) => sees(c, x)));
        ok(JSON.stringify(sorted(seeing)) === JSON.stringify(sorted(step.eliminations.map((e) => e.cell))), 'not every cell seeing them loses it');
      } else return [`unparsed: ${d}`];
      break;
    }
    case 'ALS_XY_WING': {
      const m = new RegExp(String.raw`^ALS-XY-Wing: the hinge C \((${CELLS})\) holds an? (\d) or an? (\d), so wing A \((${CELLS})\) holds no \2 or wing B \((${CELLS})\) no \3, and that wing then holds an? (\d)\. A or B holds an? \6, so no cell that sees every \6 of both can be \6\.$`).exec(d);
      if (!m) return [`unparsed: ${d}`];
      const [A, B, Cs] = [set('A')!, set('B')!, set('C')!];
      const [x, y, z] = [Number(m[2]), Number(m[3]), Number(m[6])];
      ok(JSON.stringify(names(m[1])) === JSON.stringify(Cs.cells) && JSON.stringify(names(m[4])) === JSON.stringify(A.cells) && JSON.stringify(names(m[5])) === JSON.stringify(B.cells), 'the sets');
      ok(holds(Cs, x, sol) || holds(Cs, y, sol), 'the hinge holds neither');
      ok(!holds(Cs, x, sol) || !holds(A, x, sol), 'the hinge and wing A both hold x');
      ok(!holds(Cs, y, sol) || !holds(B, y, sol), 'the hinge and wing B both hold y');
      ok(!holds(A, x, sol) || !holds(B, y, sol), 'A holds x and B holds y');
      ok(holds(A, z, sol) || holds(B, z, sol), 'neither wing holds z');
      ok(noneSeeingAll([...zCells(A, z), ...zCells(B, z)], z, sol), 'a cell seeing every z of both is z');
      ok(step.eliminations.every((e) => e.digit === z && [...zCells(A, z), ...zCells(B, z)].every((c) => sees(e.cell, c))), 'a removal does not see every z');
      break;
    }
    case 'ALS_XY_CHAIN': {
      const m = new RegExp(
        String.raw`^ALS-XY-Chain: if set A \((${CELLS})\) holds no (\d), it holds an? (\d); then set B \((${CELLS})\) holds no \3 and holds an? (\d), C \((${CELLS})\) no \5 and an? (\d), and D \((${CELLS})\) no \7 and an? \2\. (.*)$`
      ).exec(d);
      if (!m) return [`unparsed: ${d}`];
      const [A, B, Cs, D] = ['A', 'B', 'C', 'D'].map((L) => set(L)!);
      const z = Number(m[2]);
      const xs = [Number(m[3]), Number(m[5]), Number(m[7])];
      ok([m[1], m[4], m[6], m[8]].every((cells, i) => JSON.stringify(names(cells)) === JSON.stringify([A, B, Cs, D][i].cells)), 'the sets');
      // each link: the digit in both sets, every one of the first's seeing every one of the second's
      [[A, B], [B, Cs], [Cs, D]].forEach(([p, q], i) => {
        const x = xs[i];
        ok(p.digits.includes(x) && q.digits.includes(x) && zCells(p, x).every((a) => zCells(q, x).every((b) => sees(a, b))), `link ${i + 1}`);
      });
      for (const s of [A, B, Cs, D]) ok(s.digits.length === s.cells.length + 1, 'a set of one digit more than cells');
      ok(A.digits.includes(z) && D.digits.includes(z), 'z in the ends');
      const tail = m[9];
      if (alsClash(step) || tail.startsWith('But ')) {
        ok(new RegExp(String.raw`A cannot lack an? ${z}: it holds one, so no cell that sees every ${z} of A can be ${z}\.$`).test(tail), `the clash's ending: ${tail}`);
        ok(holds(A, z, sol), 'A holds no z');
        ok(noneSeeingAll(zCells(A, z), z, sol), 'a cell seeing every z of A is z');
      } else {
        ok(tail === `A or D holds ${z === 8 ? 'an' : 'a'} ${z}, so no cell that sees every ${z} of both can be ${z}.`, `the ending: ${tail}`);
        ok(holds(A, z, sol) || holds(D, z, sol), 'neither end holds z');
        ok(noneSeeingAll([...zCells(A, z), ...zCells(D, z)], z, sol), 'a cell seeing every z of both is z');
      }
      ok(step.eliminations.every((e) => e.digit === z && [...zCells(A, z), ...zCells(D, z)].every((c) => sees(e.cell, c))), 'a removal does not see every z');
      break;
    }
    case 'GROUPED_NICE_LOOP': {
      const links = step.links!;
      const start = links[0].from;
      const startCells = uniq(start.map((cd) => cd.cell));
      const loop = new RegExp(String.raw`^Grouped Nice Loop: this loop of strong and weak links in turn starts and ends at (the group )?(${CELLS}), so it holds whichever way round it is read: each weak link has exactly one true end, and a candidate that would make both ends of one false cannot be true\.$`).exec(d);
      const placed = new RegExp(String.raw`^Grouped Nice Loop: if (${C}) is not (\d), the loop's links lead back round and make it \2, so \1 is \2\.$`).exec(d);
      const group = new RegExp(String.raw`^Grouped Nice Loop: if none of (${CELLS}) is (\d), the loop's links lead back round and make one of them \2, so one of them is \2, and no other cell that sees all of them can be \2\.$`).exec(d);
      if (loop) {
        ok(isContinuousLoop(step), 'not a continuous loop');
        ok(JSON.stringify(names(loop[2])) === JSON.stringify(startCells) && !!loop[1] === startCells.length > 1, 'the start');
        for (const l of links) {
          const n = [trueIn(l.from, sol), trueIn(l.to, sol)].filter(Boolean).length;
          ok(l.strong ? n >= 1 : n === 1, `a ${l.strong ? 'strong' : 'weak'} link with ${n} true ends`);
        }
        const weak = links.filter((l) => !l.strong);
        ok(step.eliminations.every((r) => weak.some((l) => [...l.from, ...l.to].every((x) => rulesOut(r, x)))), 'a removal makes no weak link both false');
      } else if (placed) {
        ok(JSON.stringify(step.placements) === JSON.stringify([{ cell: cellOf(placed[1]), digit: Number(placed[2]) }]) && startCells.length === 1, 'the placement');
      } else if (group) {
        const cells = names(group[1]);
        const dg = Number(group[2]);
        ok(JSON.stringify(cells) === JSON.stringify(startCells) && cells.some((c) => sol[c] === dg), 'the group holds no digit');
        ok(noneSeeingAll(cells, dg, sol), 'another cell seeing all of them is the digit');
      } else return [`unparsed: ${d}`];
      break;
    }
    case 'AIC': {
      const m = new RegExp(String.raw`^AIC: if (${C}) is not (\d), the chain's links make its last candidate true: (${C}) is then (\d)\. So one of the two is true, and a candidate that would make both false cannot be true\.$`).exec(d);
      if (!m) return [`unparsed: ${d}`];
      const S = { cell: cellOf(m[1]), digit: Number(m[2]) };
      const E = { cell: cellOf(m[3]), digit: Number(m[4]) };
      const links = step.links!;
      ok(JSON.stringify(links[0].from) === JSON.stringify([S]) && JSON.stringify(links.at(-1)!.to) === JSON.stringify([E]), 'the ends');
      ok(sol[S.cell] === S.digit || sol[E.cell] === E.digit, 'neither end is true');
      ok(step.eliminations.every((r) => rulesOut(r, S) && rulesOut(r, E)), 'a removal does not rule out both ends');
      break;
    }
    case 'MEDUSA_3D': {
      if (countsRemovals(step)) {
        const dark = step.colouring!.clusters[0].dark;
        ok(step.colouring!.darkFalse === 0 && dark.length === step.eliminations.length && dark.every((x) => step.eliminations.some((e) => e.cell === x.cell && e.digit === x.digit)), 'the removals are not the dark colour');
        ok(d.includes('so dark purple is false: every dark purple candidate is removed, and every light purple one is true'), 'the sentence');
        ok(describeStep(step) === `${d} Here, ${step.eliminations.length} candidates are removed.`, 'the count');
        ok(walkFrames(step).at(-1)!.text.startsWith(`So all ${step.eliminations.length} dark purple candidates are removed. `), "the walk's count");
      }
      break;
    }
  }
  return out;
}

describe('every sentence true, along practice solve paths', () => {
  it('at every find of these techniques, in the three languages, the panel leaving out just the name', () => {
    const pools = Object.values(practice as Record<string, { puzzle: string; techs: string[] }[]>).flat();
    const puzzles =
      env.WORDS_SCAN === 'all'
        ? [...new Set(pools.map((e) => e.puzzle))]
        : [...new Set(SCANNED.flatMap((tech) => pools.filter((e) => e.techs.includes(tech)).slice(0, 1).map((e) => e.puzzle)))];
    const finds = findsAlong(puzzles);
    const wrong: string[] = [];
    const shapes = new Set<string>();
    for (const { step, g, sol } of finds) {
      const at = `${step.tech} ${valuesOf(g).slice(0, 12)}: ${step.description}`;
      for (const w of wrongIn(step, g, sol)) wrong.push(`${at}: ${w}`);
      const english = describeStep(step);
      shapes.add(`${step.tech}${step.tech === 'GROUPED_NICE_LOOP' ? (step.placements.length ? ' placed' : isContinuousLoop(step) ? ' loop' : ' group') : ''}${step.tech === 'ALS_XY_CHAIN' && alsClash(step) ? ' clash' : ''}${countsRemovals(step) ? ' counted' : ''}${step.tech === 'EXTENDED_RECTANGLE' && step.description.includes('to avoid') ? ' type 2' : ''}`);
      for (const [lang, table] of LANGS) {
        setEngineText(lang, table);
        const there = lang === 'en' ? step : findStep(step.tech, g)!;
        const whole = describeStep(there);
        const shown = panelExplanation(there, titleOf(step.tech, lang));
        const cut = whole.length - shown.length;
        if (shown === whole || whole.slice(cut - 2, cut) !== ': ' || whole.slice(cut).toLowerCase() !== shown.toLowerCase()) wrong.push(`${lang} ${at}: the panel leaves out more or less than the name: ${shown}`);
        if (lang !== 'en') {
          if (namedIn(whole) !== namedIn(english)) wrong.push(`${lang} ${at}: names other cells or digits than English: ${whole}`);
          for (const k of ['primary', 'secondary', 'fins'] as const) {
            if (namedIn(there.labels?.[k] ?? '') !== namedIn(step.labels?.[k] ?? '')) wrong.push(`${lang} ${at}: its ${k} label names other cells or digits`);
          }
          if (JSON.stringify(walkFrames(there).map((f) => namedIn(f.text))) !== JSON.stringify(walkFrames(step).map((f) => namedIn(f.text)))) wrong.push(`${lang} ${at}: its walk names other cells or digits`);
        }
        setEngineText('en', null);
      }
      // the legend keeps none of the words the report names (a loop's own legend is a loop's, and a bar's "node" a group's)
      if (['EXTENDED_RECTANGLE', 'UNIQUENESS_3', 'BUG_PLUS_1'].includes(step.tech)) {
        for (const l of legendOf(step, valuesOf(g))) if (/loop\b|read as one|pseudo|bivalue grid/.test(l.label)) wrong.push(`${at}: ${l.label}`);
      }
    }
    expect(wrong.slice(0, 10)).toEqual([]);
    for (const tech of SCANNED) expect(finds.filter((f) => f.step.tech === tech).length, tech).toBeGreaterThan(env.WORDS_SCAN === 'all' ? 10 : 0);
    // the shapes the words take: a continuous and a placing Grouped Nice Loop, a clashing
    // ALS-XY-Chain, an Extended Rectangle of one extra digit, a counted 3D Medusa (a Grouped
    // Nice Loop that places its start group's digit is met along none of the practice paths,
    // nor along the seeds' and six hard puzzles' paths)
    const seen = [...shapes];
    for (const shape of ['GROUPED_NICE_LOOP loop', 'MEDUSA_3D counted', ...(env.WORDS_SCAN === 'all' ? ['GROUPED_NICE_LOOP placed', 'ALS_XY_CHAIN clash', 'EXTENDED_RECTANGLE type 2'] : [])]) {
      expect(seen, shape).toContain(shape);
    }
  }, env.WORDS_SCAN === 'all' ? 7_200_000 : 600_000);
});
