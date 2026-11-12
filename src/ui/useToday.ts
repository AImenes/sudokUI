import { useEffect, useState } from 'react';
import { localDateKey } from '../content/dailies';

/**
 * The player's local date (src/content/dailies.ts, localDateKey), kept
 * current with the app open: a moment after each midnight, and whenever
 * the page is shown again or its window gets the focus (a phone woken the
 * next morning, a clock put forward). What depends on the day follows it:
 * the past-daily note, the season's look (src/state/settings.ts,
 * applySeason) and the theme choices in Settings.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => localDateKey());
  useEffect(() => {
    const check = () => setToday(localDateKey());
    let id = 0;
    // armed again after every midnight, whether or not the day read changed
    // (a timer may fire a moment early), so the next one is never missed
    const arm = () => {
      const now = new Date();
      const untilMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime() - now.getTime();
      id = window.setTimeout(() => {
        check();
        arm();
      }, untilMidnight + 1000);
    };
    arm();
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);
  return today;
}
