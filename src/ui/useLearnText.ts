// The Learn section's text in the chosen language. English is part of the
// app; a translation is fetched the first time its language is used and
// kept for the rest of the visit, so English players never download it.
import { useEffect, useMemo, useState } from 'react';
import { useSettings, Lang } from '../state/settings';
import { learnText, LearnLocale, LearnText } from '../content/learnLocale';

const loaded: Partial<Record<Lang, LearnLocale>> = {};
const loaders: Record<'nb' | 'es', () => Promise<{ default: LearnLocale }>> = {
  nb: () => import('../content/locales/nb'),
  es: () => import('../content/locales/es')
};

export function useLearnText(): LearnText {
  const lang = useSettings((s) => s.lang);
  const [, setLoads] = useState(0);
  useEffect(() => {
    if (lang === 'en' || loaded[lang]) return;
    let live = true;
    loaders[lang]().then((m) => {
      loaded[lang] = m.default;
      if (live) setLoads((n) => n + 1);
    });
    return () => {
      live = false;
    };
  }, [lang]);
  const loc = lang === 'en' ? undefined : loaded[lang];
  // until a translation arrives, the page reads in English
  return useMemo(() => (lang !== 'en' && loc ? learnText(lang, loc) : learnText('en')), [lang, loc]);
}
