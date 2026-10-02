// The difficulty bands in a table: badge, score range and a line on what
// the band asks. English by default (the How-to-play dialog); the Learn
// guide passes its own language. Kept apart from Learn.tsx so the guide
// can load on demand.
import React from 'react';
import { LEVELS, LEVEL_MAX_SCORE, Level } from '../engine/ratings';
import { BAND_NOTES } from '../content/rating';

export function BandTable({
  level = (l) => l,
  note = (l) => BAND_NOTES[l],
  upTo = (n) => `up to ${n}`,
  above = (n) => `above ${n}`
}: {
  level?: (l: Level) => string;
  note?: (l: Level) => string;
  upTo?: (n: number) => string;
  above?: (n: number) => string;
}) {
  return (
    <table className="shortcut-table band-table">
      <tbody>
        {LEVELS.map((l, i) => (
          <tr key={l}>
            <td>
              <span className={`level-badge level-${l.toLowerCase()}`}>{level(l)}</span>
            </td>
            <td>
              {i === LEVELS.length - 1 ? above(LEVEL_MAX_SCORE[LEVELS[i - 1]]) : upTo(LEVEL_MAX_SCORE[l])}: {note(l)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
