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
