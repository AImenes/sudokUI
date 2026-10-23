// The difficulty levels in a table: badge, score range and a line on what
// the level asks, HoDoKu's five with the two narrower picks of New game
// set in under the level they belong to. In the chosen language by default
// (the How-to-play dialog); the Learn guide passes its own words. Kept
// apart from Learn.tsx so the guide can load on demand: nothing here
// imports the guide's locale machinery (src/content/learnLocale.ts), which
// would pull all of the guide's English into the main chunk.
import React from 'react';
import { LevelPick, pickLevel } from '../engine/ratings';
import { BAND_LEADS, BAND_NOTES, rangeOf, TABLE_ORDER } from '../content/rating';
import { useT } from '../content/i18n';
import { useLearnLocale } from './useLearnLocale';

/** what each level and pick is called for, in one language: the lead and the techniques it leans on */
export interface BandWords {
  leads: Record<LevelPick, string>;
  notes: Record<LevelPick, string>;
}

const ENGLISH: BandWords = { leads: BAND_LEADS, notes: BAND_NOTES };
/**
 * The levels' leads and notes in the chosen language. English is at hand;
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
  above,
  noLimit
}: {
  level?: (l: LevelPick) => string;
  note?: (l: LevelPick) => string;
  upTo?: (n: number) => string;
  above?: (n: number) => string;
  noLimit?: string;
}) {
  const t = useT();
  const words = useBandWords();
  const levelOf = level ?? t.level;
  const noteOf = note ?? ((l: LevelPick) => words.notes[l]);
  const upToOf = upTo ?? ((n: number) => t('up to {n}', { n }));
  const aboveOf = above ?? ((n: number) => t('above {n}', { n }));
  const unlimited = noLimit ?? t('no limit||the scores of Extreme');
  return (
    <table className="shortcut-table band-table">
      <tbody>
        {TABLE_ORDER.map((p) => (
          <tr key={p} className={pickLevel(p) === p ? undefined : 'band-pick'}>
            <td>
              <span className={`level-badge level-${p.toLowerCase()}`}>{levelOf(p)}</span>
            </td>
            <td>
              {rangeOf(p, levelOf, upToOf, aboveOf, unlimited)}: {noteOf(p)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
