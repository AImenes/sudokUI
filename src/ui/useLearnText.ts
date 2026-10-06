// The Learn section's text in the chosen language. English is part of the
// guide's chunk; a translation is fetched the first time its language is
// used and kept for the rest of the visit (useLearnLocale.ts), so English
// players never download it. Only the guide itself may use this: anything
// always loaded takes useLearnLocale() instead, so the English guide stays
// out of the main chunk.
import { useMemo } from 'react';
import { useSettings } from '../state/settings';
import { learnText, LearnText } from '../content/learnLocale';
import { useLearnLocale } from './useLearnLocale';

export function useLearnText(): LearnText {
  const lang = useSettings((s) => s.lang);
  const loc = useLearnLocale();
  // until a translation arrives, the page reads in English
  return useMemo(() => (lang !== 'en' && loc ? learnText(lang, loc) : learnText('en')), [lang, loc]);
}
