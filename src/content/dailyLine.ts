// What the daily's win screen and its share line say about a time
// (docs/online-goals.md, phase 2): where it stands among the day's times,
// and the spoiler-free line a player sends to friends. One copy for the
// win screen and for the Share dialog, which offers the line again after
// the win screen has closed (src/ui/Dialogs.tsx).
import type { Lang } from '../state/settings';
import type { PlayedDaily } from '../state/dailyStats';
import type { Translator } from './i18n';
import { standingOf, dailyPath, localDateKey } from './dailies';
import type { DailyStats, Standing } from './dailies';
import { clockOf } from './share';
import { SITE } from './home';

/** the ordinal of a place among the day's times: 2nd; Norwegian 2.; Spanish 2.º, the sentence counting puestos */
export function placeOrdinal(n: number, lang: Lang): string {
  if (lang === 'nb') return `${n}.`;
  if (lang === 'es') return `${n}.º`;
  const v = n % 100;
  const s = ['th', 'st', 'nd', 'rd'];
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/**
 * Where a daily time stands, as the share line says it: its place while
 * few have played ("2nd fastest of 5 today", a tie, the only time in),
 * the share it beat from PLACE_BELOW up (dailies.ts, standingOf). "Today"
 * only for today's daily: another day's counts every time sent for it so
 * far, on whatever day it was sent.
 */
export function standingPhrase(t: Translator, st: Standing, today: boolean): string {
  const when = today ? t('today||where a daily time stands: the daily is today’s') : t('so far||where a daily time stands: another day’s daily');
  if (st.kind === 'only') return t('the only time sent {when}', { when });
  if (st.kind === 'percentile') return t('faster than {pct}% {when}', { pct: st.pct, when });
  const vars = { n: st.of, nth: placeOrdinal(st.place, t.lang), when };
  if (st.place === 1) return st.tied ? t('tied for fastest of {n} {when}', vars) : t('fastest of {n} {when}', vars);
  return st.tied ? t('tied for {nth} fastest of {n} {when}', vars) : t('{nth} fastest of {n} {when}', vars);
}

/** a phrase as a line of its own: its first letter capitalised */
export const asLine = (phrase: string) => phrase.charAt(0).toLocaleUpperCase() + phrase.slice(1);

/**
 * A daily's share line, the spoiler-free line of docs/online-goals.md:
 * the day's number, band, score and time, unassisted or not, and where the
 * time stands once that very time is among the day's (an assisted time is
 * in nobody's statistics, and a later solve's time is not the one the
 * server holds). Built from the solve as the device keeps it
 * (src/state/dailyStats.ts, played), so the win screen and the Share
 * dialog say the same. The link is the day's address, with the time to
 * beat.
 */
export function dailyLine(t: Translator, no: number, played: PlayedDaily, stats: DailyStats | undefined, submitted: number | undefined): string {
  const standing = !played.assisted && stats && submitted === played.seconds ? standingOf(stats, submitted) : null;
  const vars = {
    no,
    level: t.level(played.level),
    score: played.score,
    time: clockOf(played.seconds),
    standing: standing ? standingPhrase(t, standing, played.date === localDateKey()) : '',
    link: SITE + dailyPath(t.lang, played.date, played.seconds)
  };
  if (played.assisted) return t('sudokUI Daily #{no} · {level} ({score}) · {time} · {link}', vars);
  return standing
    ? t('sudokUI Daily #{no} · {level} ({score}) · {time} · unassisted · {standing} · {link}', vars)
    : t('sudokUI Daily #{no} · {level} ({score}) · {time} · unassisted · {link}', vars);
}
