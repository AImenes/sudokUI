// Interface translations. English is the source: every string in the app is
// written in English where it is used, and t() looks it up in the chosen
// language. A string with no translation simply stays English, so the app
// never shows a blank. docs/translations.md has the whole picture.
//
//   const t = useT();                 in a component (re-renders on a change of language)
//   const t = translator();           anywhere else: a store action, a helper
//   t('New game')                     the key is the English text itself
//   t('{n} moves', { n })             placeholders are {name}
//   t(n === 1 ? '{n} cell' : '{n} cells', { n })    plurals are two keys
//   t.tech(tech), t.level(level), t.family(category)   names, as the guide gives them
//   rich(t('Press {key} to pause'), { key: <kbd>P</kbd> })   elements inside a sentence
//   msg('Takes back your last action.')   marks a string declared away from
//                                     where it is shown; translate it there: t(b.text)
//
// The same English with two meanings takes a context after "||":
// t('Clear||the colour') shows "Clear" in English and has its own entry in
// each translation. tests/i18n.test.ts finds every key in the source and
// holds both translations to it, and flags English left unwrapped in the
// interface.
//
// The Norwegian and Spanish tables (src/content/locales/app.<lang>.ts) are
// fetched the first time their language is used, before the app first
// renders in it (src/main.tsx); English players never download them. The
// same file carries the engine's sentences (src/engine/text.ts) and the
// names of techniques, bands and families.
import React, { useMemo } from 'react';
import { create } from 'zustand';
import { useSettings, Lang } from '../state/settings';
import { TECHS, Tech, Level, Category } from '../engine/ratings';
import { setEngineText, EngineTable } from '../engine/text';
import { categoryLabel } from './categories';

export const LANGS: { value: Lang; name: string; tag: string; locale: string }[] = [
  { value: 'en', name: 'English', tag: 'en', locale: 'en-GB' },
  { value: 'nb', name: 'Norsk', tag: 'nb', locale: 'nb-NO' },
  { value: 'es', name: 'Español', tag: 'es', locale: 'es-ES' }
];

export type Dictionary = Record<string, string>;
export type Vars = Record<string, string | number>;

/** everything one language needs outside the Learn section */
export interface AppLocale {
  /** interface strings, keyed by their English text */
  ui: Dictionary;
  /** the engine's sentences, keyed by template (src/engine/text.ts) */
  engine: EngineTable;
  /** the techniques with a name of their own in this language */
  techNames: Partial<Record<Tech, string>>;
  levels: Record<Level, string>;
  categoryLabels: Record<Category, string>;
}

export interface Translator {
  (text: string, vars?: Vars): string;
  lang: Lang;
  /** BCP 47 tag for dates and numbers */
  locale: string;
  /** a technique's name in this language (most stay English) */
  tech(t: Tech): string;
  /** a difficulty band */
  level(l: Level): string;
  /** a technique family */
  family(c: Category): string;
  /** a number written the language's way: 12,345 or 12 345 */
  num(n: number): string;
}

/** marks a string to be translated where it is shown; returns it unchanged */
export const msg = (text: string) => text;

/** fills {name} placeholders; a placeholder without a value stays as it is */
export function fill(text: string, vars?: Vars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** the English a key shows: the key without its context */
export const english = (key: string) => {
  const cut = key.indexOf('||');
  return cut < 0 ? key : key.slice(0, cut);
};

/** a translator for a language, given its loaded locale (English needs none) */
export function makeTranslator(lang: Lang, loc?: AppLocale): Translator {
  const L = lang === 'en' ? undefined : loc;
  const locale = LANGS.find((l) => l.value === lang)?.locale ?? 'en-GB';
  const t = ((text: string, vars?: Vars) => fill(L?.ui[text] ?? english(text), vars)) as Translator;
  t.lang = L ? lang : 'en';
  t.locale = L ? locale : 'en-GB';
  t.tech = (tech) => L?.techNames[tech] ?? TECHS[tech].name;
  t.level = (level) => L?.levels[level] ?? level;
  t.family = (c) => L?.categoryLabels[c] ?? categoryLabel(c);
  t.num = (n) => n.toLocaleString(t.locale);
  return t;
}

/**
 * Puts elements into a translated sentence: each {name} becomes nodes[name].
 * rich(t('Press {key} to pause'), { key: <kbd>P</kbd> })
 */
export function rich(text: string, nodes: Record<string, React.ReactNode>): React.ReactNode {
  const parts = text.split(/\{(\w+)\}/);
  return React.createElement(
    React.Fragment,
    null,
    ...parts.map((part, i) => (i % 2 === 0 ? part : part in nodes ? nodes[part] : `{${part}}`))
  );
}

// ---- the app's own addresses ----------------------------------------------

/** where the app lives in a language: / for English, /nb/ and /es/ */
export const langRoot = (lang: Lang) => (lang === 'en' ? '/' : `/${lang}/`);

/** the language an address of the app itself stands for: /nb/ and /es/ (null for / and anything else) */
export function langOfPath(path: string): Lang | null {
  const m = /^\/(nb|es)\/?$/.exec(path);
  return m ? (m[1] as Lang) : null;
}

// ---- loading -------------------------------------------------------------

/** the translations fetched so far */
export const useLocales = create<{ loaded: Partial<Record<Lang, AppLocale>> }>(() => ({ loaded: {} }));

const loaders: Record<Exclude<Lang, 'en'>, () => Promise<{ default: AppLocale }>> = {
  nb: () => import('./locales/app.nb'),
  es: () => import('./locales/app.es')
};
const loading: Partial<Record<Lang, Promise<void>>> = {};

/** fetches a language's tables once; a failure leaves the app in English */
export function loadLocale(lang: Lang): Promise<void> {
  if (lang === 'en' || useLocales.getState().loaded[lang]) return Promise.resolve();
  loading[lang] ??= loaders[lang]()
    .then((m) => useLocales.setState((s) => ({ loaded: { ...s.loaded, [lang]: m.default } })))
    .catch(() => {
      delete loading[lang];
    });
  return loading[lang]!;
}

/**
 * Keeps the app in the chosen language from now on: fetches its tables,
 * points the engine's sentences at them and sets <html lang>. Resolves
 * once the current language is ready, so the first render is in it.
 */
export function startLocales(): Promise<void> {
  const sync = () => {
    const lang = useSettings.getState().lang;
    const loc = useLocales.getState().loaded[lang];
    setEngineText(lang, loc ? loc.engine : null);
    if (typeof document !== 'undefined') document.documentElement.lang = loc || lang === 'en' ? lang : 'en';
  };
  useSettings.subscribe((s, prev) => {
    if (s.lang === prev.lang) return;
    // on /nb/ or /es/ the address follows the language, so a reload or a
    // copied link keeps it; on / it stays /
    if (typeof window !== 'undefined' && langOfPath(window.location.pathname)) {
      const { search, hash } = window.location;
      window.history.replaceState(window.history.state, '', langRoot(s.lang) + search + hash);
      // and the tab's title is that address's own (src/content/home.ts, fetched only here)
      import('./home').then((m) => (document.title = m.HOME[s.lang].title)).catch(() => {});
    }
    sync();
    loadLocale(s.lang).then(sync);
  });
  useLocales.subscribe(sync);
  sync();
  return loadLocale(useSettings.getState().lang).then(sync);
}

/** t('New game') in the chosen language; re-renders when the language changes */
export function useT(): Translator {
  const lang = useSettings((s) => s.lang);
  const loc = useLocales((s) => s.loaded[lang]);
  return useMemo(() => makeTranslator(lang, loc), [lang, loc]);
}

/** the translator for the language chosen right now, outside a component */
export function translator(): Translator {
  const lang = useSettings.getState().lang;
  return makeTranslator(lang, useLocales.getState().loaded[lang]);
}
