import { describe, it, expect } from 'vitest';
import { DICTIONARIES, LANGS, translate } from '../src/content/i18n';

describe('interface translations', () => {
  const langs = LANGS.map((l) => l.value);

  it('offer English, Norwegian and Spanish', () => {
    expect(langs).toEqual(['en', 'nb', 'es']);
    expect(DICTIONARIES.en).toEqual({});
  });

  it('translate the same set of strings in every language, none left blank', () => {
    const keys = Object.keys(DICTIONARIES.nb).sort();
    expect(keys.length).toBeGreaterThan(20);
    for (const lang of langs) {
      if (lang === 'en') continue;
      expect(Object.keys(DICTIONARIES[lang]).sort(), lang).toEqual(keys);
      for (const [key, value] of Object.entries(DICTIONARIES[lang])) {
        expect(value.trim(), `${lang}: ${key}`).not.toBe('');
      }
    }
  });

  it('fall back to English for anything untranslated', () => {
    expect(translate('nb', 'New game')).toBe('Nytt spill');
    expect(translate('es', 'New game')).toBe('Nueva partida');
    expect(translate('nb', 'Some string nobody translated')).toBe('Some string nobody translated');
    expect(translate('en', 'New game')).toBe('New game');
  });
});
