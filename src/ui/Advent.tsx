// The advent calendar in the app (docs/advent-calendar.md): New, then
// Advent calendar, from 1 November to 31 December of the player's local
// date (src/content/season.ts, calendarOpen). It shows the 24 doors: an
// open one with its day and its HoDoKu rating, and whether it was solved on
// this device (the solves kept with the dailies' own,
// src/state/dailyStats.ts, played) or is in progress here; a locked one
// (every door in November) with the day it opens. A door opens through
// src/ui/links.ts (startDoor), which never loses a game under way. From
// 1 January nothing of it shows (App.tsx).
import React, { useEffect, useState } from 'react';
import { Modal } from './Dialogs';
import { useT } from '../content/i18n';
import { useGame } from '../state/gameStore';
import type { GameInfo } from '../state/gameStore';
import { useDailyStats } from '../state/dailyStats';
import { adventNo, doorDay, findDoor, loadAdvent } from '../content/advent';
import { DOORS, doorDate, doorOpen } from '../content/season';
import type { AdventDoor } from '../content/advent';

/** the doors, 1 to 24 */
const ALL = Array.from({ length: DOORS }, (_, i) => i + 1);

export function AdventDialog({ today, onClose, onDoor }: { today: string; onClose: () => void; onDoor: (year: number, door: number) => void }) {
  const t = useT();
  const year = Number(today.slice(0, 4));
  // the published doors, for their ratings: undefined while they load, null when they cannot be had
  const [doors, setDoors] = useState<AdventDoor[] | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void loadAdvent().then((list) => live && setDoors(list));
    return () => {
      live = false;
    };
  }, []);
  const played = useDailyStats((s) => s.played);
  // a door game on the board, in the slot, or behind a puzzle being typed in
  const held = useGame((s) =>
    [s.custom ? s.customBackup?.info : s.info, s.setAside?.custom ? s.setAside.customBackup?.info : s.setAside?.info]
      .filter((info): info is GameInfo => !!info?.adventDoor && info.adventYear === year)
      .map((info) => info.adventDoor!)
      .join(',')
  );
  const inProgress = new Set(held.split(',').filter(Boolean).map(Number));

  return (
    <Modal title={t('Advent calendar')} onClose={onClose}>
      <p className="dialog-note">
        {t('A door a day from 1 to 24 December, the same puzzle for everyone. Door 1 is gentle, and each door is a little harder than the one before.')}
      </p>
      <ul className="advent-doors">
        {ALL.map((door) => {
          const date = doorDate(year, door);
          // the long day for the name a screen reader reads, the short one on the door
          const day = doorDay(date, t.locale);
          const short = doorDay(date, t.locale, 'short');
          if (!doorOpen(year, door, today)) {
            return (
              <li key={door}>
                <button className="advent-door locked" disabled aria-label={t('Door {door}, opens on {date}', { door, date: day })}>
                  <strong>{door}</strong>
                  <span>{short}</span>
                  <span aria-hidden="true">🔒</span>
                </button>
              </li>
            );
          }
          const found = doors ? findDoor(doors, year, door) : undefined;
          const solved = !!played[adventNo(year, door)];
          const state = solved ? t('solved||a door of the advent calendar') : inProgress.has(door) ? t('in progress||a door of the advent calendar') : '';
          const rating = found ? t('{level} {score}||a door’s band and HoDoKu rating', { level: t.level(found.level), score: found.score }) : '';
          return (
            <li key={door}>
              <button
                className={`advent-door${solved ? ' solved' : ''}${date === today ? ' today' : ''}`}
                onClick={() => onDoor(year, door)}
                aria-label={[t('Door {door}, {date}', { door, date: day }), rating, state].filter(Boolean).join(', ')}
              >
                <strong>
                  {door}
                  {solved ? ' ✓' : ''}
                </strong>
                <span>{short}</span>
                {rating && <span className="advent-rating">{rating}</span>}
                {!solved && state && <span className="advent-state">{state}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {doors === null && <p className="dialog-note">{t('The doors’ ratings could not be loaded. Check the connection and try again')}</p>}
      <p className="dialog-note">
        {t('A time without help counts in everyone’s times on its door’s day and up to a week late, until 31 December, if you send it from the win screen.')}
      </p>
    </Modal>
  );
}
