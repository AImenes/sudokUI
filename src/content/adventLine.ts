// The quiet line to the advent calendar's page (src/content/adventPage.ts)
// on the home pages, in the block crawlers read before the app starts
// (src/content/home.ts), and on /learn/ (src/content/learnPages.ts): one
// line in each language, in the HTML all year and hidden, so a search
// engine finds the link, and shown by a one-line script in November and
// December by the visitor's own date (season.ts, calendarOpen: the days
// the calendar is there), so a reader sees it only in season.
//
// Kept apart from the page's copy: home.ts imports this, and the app's
// bundle carries home.ts, so it stays a few lines.
import type { Lang } from '../state/settings';
import { ADVENT_URLS } from './staticRoutes';

/** the line's words in each language */
export const ADVENT_LINE: Record<Lang, string> = {
  en: 'Advent calendar: a sudoku behind each door, from 1 to 24 December',
  nb: 'Julekalender: en sudoku bak hver luke, fra 1. til 24. desember',
  es: 'Calendario de adviento: un sudoku en cada casilla, del 1 al 24 de diciembre'
};

/** the id of the line */
export const LINE_ID = 'advent-line';

/**
 * The script that shows the line in November and December by the
 * visitor's own date; the rest of the year it stays hidden. It looks
 * again a moment after each local midnight and whenever the page is shown
 * again or gets the focus, so a page left open over 1 November or
 * 1 January follows (as the calendar's page does, adventPage.ts). One
 * line when written into a page: no comment inside it.
 */
export const LINE_SCRIPT = `(function () {
  var line = document.getElementById('${LINE_ID}');
  if (!line) return;
  var timer = 0;
  function paint() {
    var month = new Date().getMonth() + 1;
    line.hidden = !(month === 11 || month === 12);
  }
  function arm() {
    var now = new Date();
    var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    clearTimeout(timer);
    timer = setTimeout(function () {
      paint();
      arm();
    }, midnight.getTime() - now.getTime() + 1000);
  }
  function again() {
    if (document.visibilityState === 'hidden') return;
    paint();
    arm();
  }
  paint();
  arm();
  if (document.addEventListener) document.addEventListener('visibilitychange', again);
  if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('focus', again);
})();`;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** the line in a language, hidden, and its script: a paragraph and a script, one element a line */
export function seasonLine(lang: Lang, className = 'season'): string[] {
  return [
    `<p class="${className}" id="${LINE_ID}" hidden><a href="${ADVENT_URLS[lang]}">${esc(ADVENT_LINE[lang])}</a></p>`,
    `<script>${LINE_SCRIPT.replace(/\n\s*/g, ' ')}</script>`
  ];
}
