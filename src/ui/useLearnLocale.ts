// The Learn section's translation for the chosen language, on its own: the
// file src/content/locales/nb.ts or es.ts, fetched the first time it is
// needed and kept for the rest of the visit. The parts of the app that are
// always loaded (the hint panel, the dialogs, the band table, the help)
// show a few pieces of it: a technique's one-line summary, the band leads,
// the kin lines, the rating summary. They take the English straight from
// the content modules and the translation from here, so the guide itself
// (src/content/learnLocale.ts with the glossary, the Intuition guide and
// the landing pages) stays in its own chunk. useLearnText() shares this
// fetch.
import { useEffect, useState } from 'react';
import { useSettings, Lang } from '../state/settings';
import type { LearnLocale } from '../content/learnLocale';

const loaded: Partial<Record<Lang, LearnLocale>> = {};
const pending: Partial<Record<Lang, Promise<LearnLocale | undefined>>> = {};
const loaders: Record<Exclude<Lang, 'en'>, () => Promise<{ default: LearnLocale }>> = {
  nb: () => import('../content/locales/nb'),
  es: () => import('../content/locales/es')
};

/** fetches a language's Learn translation once; undefined for English or on failure */
export function loadLearnLocale(lang: Lang): Promise<LearnLocale | undefined> {
  if (lang === 'en') return Promise.resolve(undefined);
  if (loaded[lang]) return Promise.resolve(loaded[lang]);
  pending[lang] ??= loaders[lang]()
    .then((m) => (loaded[lang] = m.default))
    // a translation that cannot be fetched leaves the text in English
    .catch(() => {
      delete pending[lang];
      return undefined;
    });
  return pending[lang]!;
}

/**
 * The chosen language's Learn translation, or undefined: for English, and
 * until the translation has arrived (or if it cannot be fetched), when the
 * caller shows its English.
 */
export function useLearnLocale(): LearnLocale | undefined {
  const lang = useSettings((s) => s.lang);
  const [, setLoads] = useState(0);
  useEffect(() => {
    if (lang === 'en' || loaded[lang]) return;
    let live = true;
    loadLearnLocale(lang).then((loc) => {
      if (live && loc) setLoads((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [lang]);
  return lang === 'en' ? undefined : loaded[lang];
}
