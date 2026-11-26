/**
 * The top of the dashboard (admin.ts), added on 25 November 2026: "Toward
 * 100 a day", the owner's goal of 100 games begun a day by 31 January
 * 2027 (docs/online-goals.md, "Toward 100 a day"), and the reading the
 * launch log's Readings table wants, as a line and as a Markdown row to
 * copy (docs/launch-log.md).
 *
 * Everything here is read from what the page has already fetched: the
 * main query's days (metricsOf) and the daily times sent (dailySent).
 * Nothing new is asked of the app or the API.
 *
 * The games that count are the dashboard's Starts: every game begun,
 * counted at the first move, of every kind but practice. Practice is left
 * out because a practice puzzle is a short drill begun part-way through,
 * and one learner begins many in a sitting: it counts how hard the
 * players already here practise, not how many come to play.
 */
import type { DayRow } from './adminModel';
import { PLAY_KINDS, PLAY_LANGS, SHARE_KINDS } from './telemetry';

/** the owner's goal: GOAL_PER_DAY games begun a day, as a 7-day average, by GOAL_BY */
export const GOAL_PER_DAY = 100;
export const GOAL_BY = '2027-01-31';
/** where the owner's line starts: the dashboard of 25 November 2026, about 35 games begun a day */
export const LINE_FROM = '2026-11-25';
export const LINE_FROM_PER_DAY = 35;

const DAY_MS = 86_400_000;
const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const daysFrom = (from: string, to: string) => Math.round((dayMs(to) - dayMs(from)) / DAY_MS);

/** the owner's line on a UTC day: straight from LINE_FROM's 35 to GOAL_BY's 100, flat before and after */
export function lineOn(day: string): number {
  const span = daysFrom(LINE_FROM, GOAL_BY);
  const t = Math.min(1, Math.max(0, daysFrom(LINE_FROM, day) / span));
  return LINE_FROM_PER_DAY + (GOAL_PER_DAY - LINE_FROM_PER_DAY) * t;
}

/** the games that count toward the goal on a day: begun, practice out (DayRow.starts) */
export const gamesOf = (d: DayRow) => d.starts;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export interface Toward {
  /** the last whole UTC day, the one the week ends on */
  lastDay: string;
  /** the 7 whole days before today, and the 7 before those: games begun a day on average */
  week: number;
  previous: number;
  /** week minus previous, and as a share of previous (null when previous is 0) */
  change: number;
  changeShare: number | null;
  /** the owner's line on lastDay, and the week against it */
  line: number;
  againstLine: number;
  /** whole days from today to GOAL_BY (0 once it has come) */
  daysLeft: number;
  /** what the average must rise by each week to reach the goal: straight, and compounded; null once the goal is met or the day has passed */
  perWeek: number | null;
  perWeekShare: number | null;
  /** the 7-day average on each whole day that has 7 whole days behind it, oldest first, with the line on that day */
  trend: { day: string; average: number; line: number }[];
}

/** the goal's numbers from the page's days: today and the DAYS_SHOWN before it, oldest first */
export function towardOf(days: DayRow[], today: string): Toward {
  const past = days.filter((d) => d.day < today);
  const games = past.map(gamesOf);
  const week = mean(games.slice(-7));
  const previous = mean(games.slice(-14, -7));
  const lastDay = past.at(-1)?.day ?? today;
  const line = lineOn(lastDay);
  const daysLeft = Math.max(0, daysFrom(today, GOAL_BY));
  const weeksLeft = daysLeft / 7;
  const open = daysLeft > 0 && week < GOAL_PER_DAY;
  const trend = past.slice(6).map((d, i) => ({ day: d.day, average: mean(games.slice(i, i + 7)), line: lineOn(d.day) }));
  return {
    lastDay,
    week,
    previous,
    change: week - previous,
    changeShare: previous > 0 ? (week - previous) / previous : null,
    line,
    againstLine: week - line,
    daysLeft,
    perWeek: open ? (GOAL_PER_DAY - week) / weeksLeft : null,
    perWeekShare: open && week > 0 ? (GOAL_PER_DAY / week) ** (1 / weeksLeft) - 1 : null,
    trend
  };
}

// ---- the reading (docs/launch-log.md, "Readings") -------------------------------

/** a day's daily times sent (admin.ts, SentDay): its UTC midnight in seconds and the count */
export interface SentLike {
  day: number;
  n: number;
}

export interface Reading {
  /** the day it is read on, 2026-11-25 */
  date: string;
  /** the launch log's columns, each a 7-day average per day, as text */
  completed: string;
  begunByKind: string;
  begunByLang: string;
  participants: string;
  landings: string;
  shares: string;
}

/** a 7-day average with one decimal: 5.1 */
export const perDay = (n: number) => (n / 7).toFixed(1);

/** counts by name as "new 30.1, daily 0.4", in the given order then the rest, the ones under 0.05 a day left out; "0" for none */
function byName(counts: Record<string, number>, order: readonly string[], label: (k: string) => string = (k) => k || 'unrecorded'): string {
  const keys = [...order, ...Object.keys(counts).filter((k) => !order.includes(k)).sort()];
  const parts = keys.filter((k) => (counts[k] ?? 0) / 7 >= 0.05).map((k) => `${label(k)} ${perDay(counts[k])}`);
  return parts.length ? parts.join(', ') : '0';
}

const sumInto = (into: Record<string, number>, from: Record<string, number>, sign = 1) => {
  for (const [k, n] of Object.entries(from)) into[k] = (into[k] ?? 0) + sign * n;
};

/**
 * The reading for the launch log, from the 7 whole days before today: the
 * page's days (practice out of Completed, as everywhere on the page), and
 * the daily times sent, which stand for daily participants; null when the
 * database was not there or failed
 */
export function readingOf(days: DayRow[], today: string, sent: SentLike[] | null | undefined): Reading {
  const week = days.filter((d) => d.day < today).slice(-7);
  const first = week[0]?.day ?? today;
  const begun: Record<string, number> = {};
  const langs: Record<string, number> = {};
  const fromHome: Record<string, number> = {};
  const fromShares: Record<string, number> = {};
  const shares: Record<string, number> = {};
  let home = 0;
  let completed = 0;
  for (const d of week) {
    completed += d.completed;
    home += d.landingsHome;
    sumInto(begun, d.startsBy);
    sumInto(langs, d.startsByLang);
    sumInto(fromHome, d.landingsFromHome);
    sumInto(fromShares, d.landingsFrom);
    sumInto(fromShares, d.landingsFromHome, -1);
    for (const [k, w] of Object.entries(d.sharesBy)) shares[k] = (shares[k] ?? 0) + w.sheet + w.copy + w.save;
  }
  const nbEs: Record<string, number> = { nb: langs.nb ?? 0, es: langs.es ?? 0 };
  const sentDays = sent?.filter((s) => {
    const day = new Date(s.day * 1000).toISOString().slice(0, 10);
    return day >= first && day < today;
  });
  const participants = sentDays ? perDay(sentDays.reduce((a, s) => a + Number(s.n), 0)) : '—';
  const shareWords = byName(fromShares, []);
  return {
    date: today,
    completed: perDay(completed),
    begunByKind: byName(begun, PLAY_KINDS.filter((k) => k !== 'advent') as string[]),
    begunByLang: byName(nbEs, PLAY_LANGS.filter((l) => l !== 'en')),
    participants,
    landings: `home ${perDay(home)} (${byName(fromHome, [])}); share pages ${shareWords}`,
    shares: byName(shares, SHARE_KINDS)
  };
}

/** the reading as one line to read */
export const readingLine = (r: Reading) =>
  `${r.date}, 7-day averages a day: completed ${r.completed}; begun by kind ${r.begunByKind}; begun in Norwegian and Spanish ${r.begunByLang}; daily participants ${r.participants}; landings ${r.landings}; shares ${r.shares}.`;

/** the reading as a row of the launch log's Readings table; "Read for" is left for the owner to write */
export const readingRow = (r: Reading) =>
  `| ${r.date} |  | ${r.completed} | ${r.begunByKind} | ${r.begunByLang} | ${r.participants} | ${r.landings} | ${r.shares} |`;

// ---- the section ---------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const one = (n: number) => n.toFixed(1);
const signed = (n: number) => (n > 0 ? `+${one(n)}` : n < 0 ? `−${one(-n)}` : '±0.0');
const pctSigned = (r: number | null) => (r === null ? '' : ` (${r >= 0 ? '+' : '−'}${Math.round(Math.abs(r) * 100)}%)`);

/**
 * The 7-day average so far against the owner's line, as a small chart
 * that runs on to GOAL_BY: the line from 0 to the goal, so the distance
 * left reads at a glance
 */
export function trendChart(t: Toward): string {
  const points = t.trend;
  if (points.length < 2) return '';
  const w = 600;
  const h = 130;
  const left = 30;
  const right = 40;
  const top = 10;
  const bottom = 18;
  const first = points[0].day;
  const last = GOAL_BY > points.at(-1)!.day ? GOAL_BY : points.at(-1)!.day;
  const span = Math.max(1, daysFrom(first, last));
  const max = Math.max(GOAL_PER_DAY, ...points.map((p) => p.average)) * 1.05;
  const x = (day: string) => (left + ((w - left - right) * daysFrom(first, day)) / span).toFixed(1);
  const y = (v: number) => (h - bottom - ((h - top - bottom) * v) / max).toFixed(1);
  const lineDays = [first, ...(LINE_FROM > first && LINE_FROM < last ? [LINE_FROM] : []), last];
  const lineAt = lineDays.map((d) => `${x(d)},${y(lineOn(d))}`).join(' ');
  const averageAt = points.map((p) => `${x(p.day)},${y(p.average)}`).join(' ');
  const end = points.at(-1)!;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="games begun a day, 7-day average, against the owner's line to ${GOAL_PER_DAY} by ${GOAL_BY}">
  <line x1="${left}" x2="${w - right}" y1="${y(0)}" y2="${y(0)}" stroke="#2a2e3f" />
  <line x1="${left}" x2="${w - right}" y1="${y(GOAL_PER_DAY)}" y2="${y(GOAL_PER_DAY)}" stroke="#2a2e3f" />
  <text x="${left - 4}" y="${y(0)}" text-anchor="end" dominant-baseline="middle" fill="#9aa0b3" font-size="11">0</text>
  <text x="${left - 4}" y="${y(GOAL_PER_DAY)}" text-anchor="end" dominant-baseline="middle" fill="#9aa0b3" font-size="11">${GOAL_PER_DAY}</text>
  <polyline fill="none" stroke="#9aa0b3" stroke-width="1.5" stroke-dasharray="5 4" points="${lineAt}" />
  <polyline fill="none" stroke="#8ab6f7" stroke-width="2.5" points="${averageAt}" />
  <text x="${Number(x(end.day)) + 6}" y="${y(end.average)}" dominant-baseline="middle" fill="#8ab6f7" font-size="12">${one(end.average)}</text>
  <text x="${left}" y="${h - 3}" fill="#9aa0b3" font-size="11">${first}</text>
  <text x="${w - right}" y="${h - 3}" text-anchor="end" fill="#9aa0b3" font-size="11">${last}</text>
</svg>`;
}

/** the section at the top of the page: the goal, the week against the one before, the line, and the reading to copy */
export function towardSection(t: Toward, r: Reading): string {
  const number = (label: string, value: string, note = '') =>
    `      <div><dt>${esc(label)}</dt><dd>${value}</dd>${note ? `<small>${esc(note)}</small>` : ''}</div>`;
  const ahead = t.againstLine >= 0 ? `${one(t.againstLine)} ahead of it` : `${one(-t.againstLine)} behind it`;
  const need =
    t.perWeek === null
      ? t.daysLeft === 0
        ? `${GOAL_BY} has come`
        : 'the goal is met'
      : `+${one(t.perWeek)} a week straight${t.perWeekShare === null ? '' : `, or ${Math.round(t.perWeekShare * 100)}% a week compounded`}`;
  const numbers = [
    number('Games begun a day, last 7 days', one(t.week), `7-day average to ${t.lastDay}; the goal is ${GOAL_PER_DAY} by ${GOAL_BY}`),
    number('The 7 days before', one(t.previous), `change ${signed(t.change)}${pctSigned(t.changeShare)}`),
    number("The owner's line", one(t.line), `on ${t.lastDay}: the week is ${ahead}`),
    number('Rise needed', t.perWeek === null ? '—' : one(t.perWeek), `${t.daysLeft} days to ${GOAL_BY}: ${need}`)
  ].join('\n');
  const row = readingRow(r);
  return `    <h2>Toward ${GOAL_PER_DAY} a day</h2>
    <dl class="numbers">
${numbers}
    </dl>
    ${trendChart(t)}
    <p class="meta">Games begun: every game begun, counted at the first move, sent live or kept by an opted-in device and sent later: the daily, New, a puzzle from a share link and the advent calendar's doors. Practice is left out: a practice puzzle is a short drill begun part-way through, and one learner begins many in a sitting, so it counts how hard the players already here practise, not how many come to play (it has its own column below). The chart: solid, the 7-day average on each day; dashed, the owner's line. Whole UTC days only, today left out. The line runs straight from ${LINE_FROM_PER_DAY} a day on ${LINE_FROM} to ${GOAL_PER_DAY} a day on ${GOAL_BY}.</p>
    <p class="reading" id="reading-line">${esc(readingLine(r))}</p>
    <p><button type="button" id="copy-reading" data-row="${esc(row)}">Copy as a row of the launch log's Readings</button> <span id="copy-said" class="meta" role="status"></span></p>
    <details><summary class="meta">The row</summary><pre id="reading-row">${esc(row)}</pre></details>
    <p class="meta">The launch log's Readings (docs/launch-log.md), 7-day averages a day over the 7 whole days before today: Completed leaves practice out, as the numbers below do; daily participants are the daily times sent that reached the database; landings on a home page apart from those on the share pages, by word; the calendar's page is in the Christmas section. Read for is left empty for you to write: the baseline, or the action it judges.</p>
    <script>
      document.getElementById('copy-reading').addEventListener('click', function () {
        var row = this.getAttribute('data-row');
        var said = document.getElementById('copy-said');
        function fallback() {
          var area = document.createElement('textarea');
          area.value = row;
          document.body.appendChild(area);
          area.select();
          var ok = false;
          try { ok = document.execCommand('copy'); } catch (e) {}
          area.remove();
          said.textContent = ok ? 'Copied.' : 'Could not copy: open The row and copy it by hand.';
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(row).then(function () { said.textContent = 'Copied.'; }, fallback);
        else fallback();
      });
    </script>`;
}
