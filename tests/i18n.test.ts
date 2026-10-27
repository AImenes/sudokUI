/**
 * The app in Norwegian and Spanish, held to its English source: every key
 * the source asks for (t('...'), msg('...')) and every sentence the engine
 * writes (tr`...`) is translated in both languages, with the same
 * placeholders, numbers and symbols, and nothing is left over; and no
 * English an interface shows is left unwrapped. scripts/i18n.ts report
 * lists whatever this test finds missing.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { LANGS, makeTranslator, fill, english, langOfPath, langRoot } from '../src/content/i18n';
import { tr, setEngineText, joinAnd, listAnd, templateKey, unitName } from '../src/engine/text';
import { TECHS, Tech } from '../src/engine/ratings';
import { readSource, placeholders, holes } from '../scripts/i18n-source';
import nb from '../src/content/locales/app.nb';
import es from '../src/content/locales/app.es';
import { EXAMPLES } from '../src/content/examples';
import { walkFrames } from '../src/engine/hintFrames';
import { findStep } from '../src/engine/humanSolver';
import { legendOf } from '../src/content/boardSvg';

const LOCALES = [
  ['nb', nb],
  ['es', es]
] as const;

const source = readSource();

/** digits written in a string, outside placeholders */
const numbers = (s: string) => [...s.replace(/\{\w+\}/g, '').matchAll(/\d+/g)].map((m) => m[0]).sort().join(' ');
/** emoji and the symbols the buttons wear */
const symbols = (s: string) => [...s.matchAll(/\p{Extended_Pictographic}|[↩↪⌫⇄≡⌗✎✓⛓→←↗]/gu)].map((m) => m[0]).sort().join('');
const cells = (s: string) => [...s.matchAll(/\br\d+c\d+\b/g)].map((m) => m[0]).sort().join(' ');

describe('the interface in three languages', () => {
  it('offers English, Norwegian and Spanish', () => {
    expect(LANGS.map((l) => l.value)).toEqual(['en', 'nb', 'es']);
  });

  it('has no English left unwrapped in what people read', () => {
    const list = source.untranslated.map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`);
    expect(list).toEqual([]);
  });

  it('builds no key at run time', () => {
    expect(source.badKeys.map((f) => `${f.file}:${f.line} ${f.text}`)).toEqual([]);
  });

  for (const [lang, loc] of LOCALES) {
    it(`${lang}: translates every interface string, keeping placeholders, numbers and symbols`, () => {
      const missing = [...source.uiKeys.keys()].filter((k) => loc.ui[k] === undefined);
      expect(missing, 'missing').toEqual([]);
      for (const [key, text] of Object.entries(loc.ui)) {
        const en = english(key);
        expect(text.trim(), `${lang} blank: ${key}`).not.toBe('');
        expect(placeholders(text), `${lang} placeholders: ${key}`).toEqual(placeholders(en));
        expect(numbers(text), `${lang} numbers: ${key}`).toBe(numbers(en));
        expect(symbols(text), `${lang} symbols: ${key}`).toBe(symbols(en));
        expect(cells(text), `${lang} cell names: ${key}`).toBe(cells(en));
        // a fragment that is glued to other text keeps its spaces
        expect(/^\s/.test(text), `${lang} leading space: ${key}`).toBe(/^\s/.test(en));
        expect(/\s$/.test(text), `${lang} trailing space: ${key}`).toBe(/\s$/.test(en));
      }
    });

    it(`${lang}: has no interface string the source no longer uses`, () => {
      expect(Object.keys(loc.ui).filter((k) => !source.uiKeys.has(k))).toEqual([]);
    });

    it(`${lang}: translates every engine sentence, every hole kept`, () => {
      const missing = [...source.engineKeys.keys()].filter((k) => loc.engine[k] === undefined);
      expect(missing, 'missing').toEqual([]);
      for (const [key, text] of Object.entries(loc.engine)) {
        const want = (key.match(/\{\d+\}/g) ?? []).length;
        expect(holes(text), `${lang} holes: ${key}`).toEqual(Array.from({ length: want }, (_, i) => i));
        expect(numbers(text.replace(/\{\d+\}/g, '')), `${lang} numbers: ${key}`).toBe(numbers(key.replace(/\{\d+\}/g, '')));
        expect(cells(text), `${lang} cell names: ${key}`).toBe(cells(key));
        expect(text.trim(), `${lang} blank: ${key}`).not.toBe('');
      }
    });

    it(`${lang}: has no engine sentence the source no longer writes`, () => {
      expect(Object.keys(loc.engine).filter((k) => !source.engineKeys.has(k))).toEqual([]);
    });

    it(`${lang}: names techniques as the guide does`, () => {
      for (const [key, text] of Object.entries(loc.engine)) {
        // a template that is a technique's name alone
        const named = (Object.keys(TECHS) as Tech[]).find((t) => TECHS[t].name === key);
        if (named) expect(text, `${lang}: the name ${key}`).toBe(loc.techNames[named] ?? key);
        for (const tech of Object.keys(TECHS) as Tech[]) {
          const name = TECHS[tech].name;
          if (!key.startsWith(`${name}: `)) continue;
          const own = loc.techNames[tech];
          // the sentence opens with the technique's name in this language,
          // or the English one where the language keeps it
          expect(text.startsWith(`${own ?? name}: `), `${lang}: ${key}\n  ${text}`).toBe(true);
        }
      }
    });
  }
});

describe('translators', () => {
  it('fall back to English for anything untranslated', () => {
    const t = makeTranslator('nb', nb);
    expect(t('New game')).toBe('Nytt spill');
    expect(t('Some string nobody translated')).toBe('Some string nobody translated');
    expect(makeTranslator('en')('New game')).toBe('New game');
    // a language whose tables have not arrived yet reads English
    expect(makeTranslator('es')('New game')).toBe('New game');
  });

  it('fill placeholders, keep context out of the English, and name things', () => {
    expect(fill('{n} of {m}', { n: 3, m: 9 })).toBe('3 of 9');
    expect(fill('{n} and {x}', { n: 1 })).toBe('1 and {x}');
    expect(english('Clear||the colour')).toBe('Clear');
    expect(makeTranslator('en')('Clear||the colour')).toBe('Clear');
    expect(makeTranslator('nb', nb).tech('HIDDEN_SINGLE')).toBe('Skjult singel');
    expect(makeTranslator('es', es).tech('X_WING')).toBe('X-Wing');
    expect(makeTranslator('es', es).level('Nightmare')).toBe('Pesadilla');
    expect(makeTranslator('en').family('Coloring')).toBe('Colouring');
  });

  it('know the app’s own addresses', () => {
    expect(langOfPath('/nb/')).toBe('nb');
    expect(langOfPath('/es')).toBe('es');
    expect(langOfPath('/')).toBeNull();
    expect(langOfPath('/nb/learn/')).toBeNull();
    expect(langRoot('en')).toBe('/');
    expect(langRoot('es')).toBe('/es/');
  });
});

describe('engine sentences', () => {
  afterEach(() => setEngineText('en', null));

  it('are the template literal itself in English', () => {
    const cell = 'r1c1';
    expect(tr`Naked Single: ${cell} has only one candidate left, ${5}.`).toBe('Naked Single: r1c1 has only one candidate left, 5.');
    expect(joinAnd([1, 2, 3])).toBe('1 and 2 and 3');
    expect(listAnd([1, 2, 3])).toBe('1, 2 and 3');
    expect(listAnd([7])).toBe('7');
    expect([0, 13, 26].map(unitName)).toEqual(['row 1', 'column 5', 'box 9']);
  });

  it('take a translation with its holes in any order, and stay English without one', () => {
    const key = templateKey(['', ' sees ', '.']);
    expect(key).toBe('{0} sees {1}.');
    setEngineText('xx', { [key]: '{1} is seen by {0}.' });
    expect(tr`${'r1c1'} sees ${'r2c2'}.`).toBe('r2c2 is seen by r1c1.');
    expect(tr`${'r1c1'} is alone.`).toBe('r1c1 is alone.');
  });
});

describe('the set walk in three languages (docs/hint-drawing-sets.md, "The walk and its words")', () => {
  afterEach(() => setEngineText('en', null));

  it('introduces a set, tells its links and words its premise as Norwegian and Spanish write them, a set never a group', () => {
    const aic = EXAMPLES.AIC_ALS!.step;
    const xz = EXAMPLES.ALS_XZ!.step;
    const want = {
      nb: {
        intro: 'Mengde A: de 2 rutene r7c8, r8c8 i kolonne 8 har bare 4, 8 og 9: ett tall mer enn ruter. Mangler ett av dem, uansett hvilket, fyller de andre rutene.',
        into: 'Hvis r2c8 er 8, har mengde A ingen 8: hvert 8-tall i A ser r2c8.',
        lock: 'Hvis mengde A ikke har noen 8, fyller de 2 andre tallene de 2 rutene, så en av r7c8, r8c8 må være 9.',
        common: 'Hvert 1-tall i mengde A ser hvert 1-tall i mengde B: hvis r8c2 er 1, kan r8c9 ikke være 1.',
        premise: 'sann hvis mengde A ikke har noen 5 (ved den lille prikken)',
        group: /grupp/i
      },
      es: {
        intro: 'Conjunto A: las 2 casillas r7c8, r8c8 de la columna 8 solo tienen 4, 8 y 9: un número más que casillas. Sin uno cualquiera de ellos, los demás llenan las casillas.',
        into: 'Si r2c8 es 8, el conjunto A no tiene ningún 8: cada 8 de A ve r2c8.',
        lock: 'Si el conjunto A no tiene ningún 8, sus otros 2 números llenan sus 2 casillas, así que una de r7c8, r8c8 debe ser 9.',
        common: 'Cada 1 del conjunto A ve cada 1 del conjunto B: si r8c2 es 1, r8c9 no puede ser 1.',
        premise: 'verdadero si el conjunto A no tiene ningún 5 (junto al punto pequeño)',
        group: /grupo/i
      }
    };
    for (const [lang, loc] of LOCALES) {
      setEngineText(lang, loc.engine);
      const w = want[lang];
      expect(walkFrames(aic).slice(1, 4).map((f) => f.text), lang).toEqual([w.intro, w.into, w.lock]);
      expect(walkFrames(xz)[3].text, lang).toBe(w.common);
      expect(legendOf(xz, EXAMPLES.ALS_XZ!.values).map((l) => l.label), lang).toContain(w.premise);
      for (const s of [aic, xz]) for (const f of walkFrames(s)) expect(f.text, lang).not.toMatch(w.group);
      // the hint panel's words for the same premise
      expect(makeTranslator(lang, loc)('true, if set {L} holds no {a} (by the small dot)', { L: 'A', a: 5 }), lang).toBe(w.premise);
    }
  });

  it("ends an ALS pattern by its two sets, and walks a Death Blossom's stem and branches, as Norwegian and Spanish write them (decisions 15 and 17)", () => {
    const xz = EXAMPLES.ALS_XZ!.step;
    const db = EXAMPLES.DEATH_BLOSSOM!;
    const want = {
      nb: {
        ends: 'Mengde A eller mengde B har en 5: har A ingen, har B en. Hvert 5-tall som fjernes, ser alle 5-tallene i begge.',
        blossom: [
          'Stammen r8c9 har 2, 5 og 7: ett av dem er sant, og hvert har et kronblad.',
          'Kronblad A er ruten r9c7, som bare har 2 og 4, og 2-tallet der ser stammen: hvis stammen er 2, må r9c7 være 4.',
          'Kronblad B, for stammens 5: de 2 rutene r8c5, r9c6 i boks 8 har bare 1, 4 og 5: ett tall mer enn ruter, og hvert 5-tall i kronbladet ser stammen.',
          'Hvis stammen er 5, har kronblad B ingen 5, så de 2 andre tallene fyller de 2 rutene: r9c6 må være 4.',
          'Kronblad C er ruten r8c1, som bare har 4 og 7, og 7-tallet der ser stammen: hvis stammen er 7, må r8c1 være 4.'
        ],
        last: 'Uansett hvilket tall stammen får, har et kronblad en 4. Hvert 4-tall som fjernes, ser alle 4-tallene i alle kronbladene.',
        legend: ['stammens kandidater, og tallet i hvert kronblad som stammen ser', 'stiplet strek: de to endene ser hverandre, så høyst én av dem er sann']
      },
      es: {
        ends: 'El conjunto A o el conjunto B tiene un 5: si A no tiene ninguno, B tiene uno. Cada 5 eliminado ve todos los 5 de ambos.',
        blossom: [
          'El tallo r8c9 tiene 2, 5 y 7: uno de ellos es verdadero, y cada uno tiene un pétalo.',
          'El pétalo A es la casilla r9c7, que solo tiene 2 y 4, y su 2 ve el tallo: si el tallo es 2, r9c7 debe ser 4.',
          'Pétalo B, para el 5 del tallo: las 2 casillas r8c5, r9c6 de la caja 8 solo tienen 1, 4 y 5: un número más que casillas, y cada 5 suyo ve el tallo.',
          'Si el tallo es 5, el pétalo B no tiene ningún 5, así que sus otros 2 números llenan sus 2 casillas: r9c6 debe ser 4.',
          'El pétalo C es la casilla r8c1, que solo tiene 4 y 7, y su 7 ve el tallo: si el tallo es 7, r8c1 debe ser 4.'
        ],
        last: 'Tome el tallo el número que tome, algún pétalo tiene un 4. Cada 4 eliminado ve todos los 4 de todos los pétalos.',
        legend: ['los candidatos del tallo, y el número de cada pétalo que el tallo ve', 'línea discontinua: sus dos extremos se ven entre sí, así que como mucho uno es verdadero']
      }
    };
    for (const [lang, loc] of LOCALES) {
      setEngineText(lang, loc.engine);
      const w = want[lang];
      expect(walkFrames(xz).at(-1)!.text.startsWith(`${w.ends} `), lang).toBe(true);
      const frames = walkFrames(db.step).map((f) => f.text);
      expect(frames.slice(0, -1), lang).toEqual(w.blossom);
      expect(frames.at(-1)!.startsWith(`${w.last} `), lang).toBe(true);
      // the legend's words for what it acts through are the step's, so the step is found again in the language
      const g = { values: Uint8Array.from(db.values, Number), cands: Uint16Array.from(db.cands), given: new Uint8Array(81) };
      const labels = legendOf(findStep('DEATH_BLOSSOM', g)!, db.values).map((l) => l.label);
      for (const l of w.legend) expect(labels, lang).toContain(l);
      // the hint panel's words for the dashed line
      expect(makeTranslator(lang, loc)('dashed line: its two ends see each other, so at most one is true'), lang).toBe(w.legend[1]);
    }
  });
});
