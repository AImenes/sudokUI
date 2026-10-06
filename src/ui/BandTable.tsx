// The difficulty bands in a table: badge, score range and a line on what
// the band asks. In the chosen language by default (the How-to-play
// dialog); the Learn guide passes its own words. Kept apart from Learn.tsx
// so the guide can load on demand: nothing here imports the guide's locale
// machinery (src/content/learnLocale.ts), which would pull all of the
// guide's English into the main chunk.
import React from 'react';
import { LEVELS, LEVEL_MAX_SCORE, Level } from '../engine/ratings';
import { BAND_LEADS, BAND_NOTES } from '../content/rating';
import { useT } from '../content/i18n';
import { useLearnLocale } from './useLearnLocale';

/** what each band is called for, in one language: the lead and the techniques it leans on */
export interface BandWords {
  leads: Record<Level, string>;
  notes: Record<Level, string>;
}

const ENGLISH: BandWords = { leads: BAND_LEADS, notes: BAND_NOTES };
/**
 * The bands' leads and notes in the chosen language. English is at hand;
 * the translation is the guide's own file (useLearnLocale.ts), fetched the
 * first time it is needed, and until it arrives (or if it cannot be
 * fetched) the words stay English.
 */
export function useBandWords(): BandWords {
  const loc = useLearnLocale();
  return loc ? { leads: loc.bandLeads, notes: loc.bandNotes } : ENGLISH;
}

export function BandTable({
  level,
  note,
  upTo,
  above
}: {
  level?: (l: Level) => string;
  note?: (l: Level) => string;
  upTo?: (n: number) => string;
  above?: (n: number) => string;
}) {
  const t = useT();
  const words = useBandWords();
  const levelOf = level ?? t.level;
  const noteOf = note ?? ((l: Level) => words.notes[l]);
  const upToOf = upTo ?? ((n: number) => t('up to {n}', { n }));
  const aboveOf = above ?? ((n: number) => t('above {n}', { n }));
  return (
    <table className="shortcut-table band-table">
      <tbody>
        {LEVELS.map((l, i) => (
          <tr key={l}>
            <td>
              <span className={`level-badge level-${l.toLowerCase()}`}>{levelOf(l)}</span>
            </td>
            <td>
              {i === LEVELS.length - 1 ? aboveOf(LEVEL_MAX_SCORE[LEVELS[i - 1]]) : upToOf(LEVEL_MAX_SCORE[l])}: {noteOf(l)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
