// The advent calendar's public page (the owner's decision 5 of 12 November
// 2026, docs/advent-calendar.md): /advent/ in English, /nb/julekalender/
// in Norwegian and /es/calendario-de-adviento/ in Spanish, for search
// engines and for anyone a link brings, live all year. It shows the 24
// doors of the latest published calendar, each with its day, its level
// and its HoDoKu rating; src/content/learnPages.ts builds it with the
// other static pages, from advent.json.
//
// The page is the same file for everyone, so it cannot know the visitor's
// date: every door is written locked, with its day, and a small inline
// script (doorScript, no file to fetch) opens the doors whose day has come
// by the visitor's own clock, each a link to its address in the app
// (/advent/2026/5, under /nb/ and /es/ in those languages), the app being
// where a door is really opened or refused (src/ui/links.ts, startDoor).
// Without JavaScript every door reads as locked, with its day. The rule is
// the calendar's own (src/content/advent.ts, doorOpen): door n from n
// December to 31 December of its year, every door closed after;
// tests/adventPage.test.ts runs the script against doorOpen day by day.
//
// The home pages and /learn/ carry one quiet line to the page in November
// and December, shown by the same kind of script (adventLine.ts).
import type { Lang } from '../state/settings';
import { ADVENT_URLS } from './staticRoutes';

export { ADVENT_URLS };

/** the page's words in one language; {year} is the calendar's, {door} a door's number */
export interface AdventPageCopy {
  /** the breadcrumb's and the footer's name for the page */
  name: string;
  /** the tab and a search result's headline: at most 60 characters */
  title: string;
  /** a search result's line: at most 160 characters */
  description: string;
  h1: string;
  lead: string;
  /** what the status line says before the script has run, or without one: true on every day */
  statusStatic: string;
  /** the status line by the visitor's date: before 1 December, on door {door}'s day, from 25 to 31 December, from 1 January */
  status: { before: string; day: string; all: string; over: string };
  doorsHeading: string;
  doorsNote: string;
  /** a door's name before its number, for a screen reader */
  door: string;
  /** the word on a door: locked (and how every door is written), open, today's, and closed after 31 December */
  state: { locked: string; open: string; today: string; closed: string };
  howHeading: string;
  /** {top}: door 24's rating target, 2400, in the language's numbers */
  how: string[];
  play: string;
  daily: string;
  /** where the calendar is in the app */
  inApp: string;
  /** the Open Graph card's description */
  imageAlt: string;
  /** a door in the structured data: {door}, {date}, {level}, {score} */
  item: string;
}

export const ADVENT_PAGE: Record<Lang, AdventPageCopy> = {
  en: {
    name: 'Advent calendar',
    title: 'Sudoku advent calendar {year}: 24 puzzles, easy to extreme',
    description:
      'A sudoku behind each of 24 doors, one opening each day from 1 to 24 December, from Easy to Extreme. The same puzzle for everyone. Free, no account.',
    h1: 'Sudoku advent calendar {year}',
    lead:
      '24 doors, one for each day from 1 to 24 December, and a sudoku behind each. Door 1 is easy, and each door is a little harder than the one before, up to Extreme behind door 24. Everyone gets the same puzzle behind the same door.',
    statusStatic: 'Door 1 opens on 1 December {year}, and door 24 on 24 December.',
    status: {
      before: 'The calendar opens on 1 December {year}. Until then every door is locked.',
      day: 'Door {door} opened today. Every open door stays open until 31 December.',
      all: 'All 24 doors are open until 31 December.',
      over: 'The {year} calendar has closed. A door you started stays in the app, and you can finish it.'
    },
    doorsHeading: 'The 24 doors',
    doorsNote: 'Each door shows its day, its level and its HoDoKu rating. An open door takes you to its puzzle in sudokUI.',
    door: 'Door',
    state: { locked: 'Locked', open: 'Open', today: 'Today', closed: 'Closed' },
    howHeading: 'How it works',
    how: [
      'A door opens on its day, at midnight by your own clock, and stays open until 31 December, so a day you missed can be caught up. A door whose day has not come is locked: no link or address opens it early.',
      'Behind door 1 is a puzzle rated about 100 on HoDoKu’s scale, behind door 24 one rated about {top}: each door adds about 100. Every door shows its level and rating, so you know what is coming.',
      'Solve a door without anything from the Assist box, such as hints, checks or automatic candidates, and you can send your time from the win screen and see where it stands among everyone’s, on the door’s day and up to a week late.',
      'From 1 January the calendar is closed. A door you have started stays in the app, and you can finish it.'
    ],
    play: 'Open sudokUI',
    daily: 'Play today’s daily',
    inApp: 'From 1 December the calendar is in sudokUI itself too, under New.',
    imageAlt: 'The sudokUI advent calendar {year}: 24 doors, from Easy to Extreme.',
    item: 'Door {door}, {date}: {level}, HoDoKu rating {score}'
  },
  nb: {
    name: 'Julekalender',
    title: 'Sudoku-julekalender {year}: 24 luker, fra lett til ekstrem',
    description:
      'En sudoku bak hver av 24 luker, én åpner hver dag fra 1. til 24. desember, fra lett til ekstrem. Den samme oppgaven for alle. Gratis, uten konto.',
    h1: 'Sudoku-julekalender {year}',
    lead:
      '24 luker, én for hver dag fra 1. til 24. desember, og en sudoku bak hver. Luke 1 er lett, og hver luke er litt vanskeligere enn den før, helt opp til Ekstrem bak luke 24. Alle får den samme oppgaven bak den samme luken.',
    statusStatic: 'Luke 1 åpner 1. desember {year}, og luke 24 den 24. desember.',
    status: {
      before: 'Kalenderen åpner 1. desember {year}. Til da er alle lukene låst.',
      day: 'Luke {door} åpnet i dag. Alle åpne luker står åpne til 31. desember.',
      all: 'Alle de 24 lukene er åpne til 31. desember.',
      over: 'Kalenderen for {year} er stengt. En luke du har begynt på, blir værende i appen, og du kan fullføre den.'
    },
    doorsHeading: 'De 24 lukene',
    doorsNote: 'Hver luke viser dagen sin, nivået og HoDoKu-poengsummen. En åpen luke tar deg til oppgaven sin i sudokUI.',
    door: 'Luke',
    state: { locked: 'Låst', open: 'Åpen', today: 'I dag', closed: 'Stengt' },
    howHeading: 'Slik virker den',
    how: [
      'En luke åpner på dagen sin, ved midnatt etter din egen klokke, og står åpen til 31. desember, så en dag du gikk glipp av, kan tas igjen. En luke som ikke har fått dagen sin ennå, er låst: ingen lenke eller adresse åpner den før tiden.',
      'Bak luke 1 er en oppgave med HoDoKu-poengsum rundt 100, bak luke 24 en med rundt {top}: hver luke legger til omtrent 100. Hver luke viser nivået og poengsummen sin, så du vet hva som kommer.',
      'Løser du en luke uten noe fra Hjelp-boksen, som hint, sjekk eller autokandidater, kan du sende inn tiden din fra seiersskjermen og se hvor den står blant alles, på lukens dag og opptil en uke etter.',
      'Fra 1. januar er kalenderen stengt. En luke du har begynt på, blir værende i appen, og du kan fullføre den.'
    ],
    play: 'Åpne sudokUI',
    daily: 'Spill dagens sudoku',
    inApp: 'Fra 1. desember finner du kalenderen også i selve sudokUI, under Ny.',
    imageAlt: 'Julekalenderen {year} i sudokUI: 24 luker, fra lett til ekstrem.',
    item: 'Luke {door}, {date}: {level}, HoDoKu-poengsum {score}'
  },
  es: {
    name: 'Calendario de adviento',
    title: 'Calendario de adviento de sudoku {year}: de fácil a extremo',
    description:
      'Un sudoku en cada una de las 24 casillas: se abre una cada día del 1 al 24 de diciembre, de fácil a extremo. El mismo sudoku para todos. Gratis, sin cuenta.',
    h1: 'Calendario de adviento de sudoku {year}',
    lead:
      '24 casillas, una para cada día del 1 al 24 de diciembre, con un sudoku en cada una. La casilla 1 es fácil, y cada casilla es algo más difícil que la anterior, hasta Extremo en la casilla 24. Todo el mundo recibe el mismo sudoku en la misma casilla.',
    statusStatic: 'La casilla 1 se abre el 1 de diciembre de {year}, y la casilla 24 el 24 de diciembre.',
    status: {
      before: 'El calendario se abre el 1 de diciembre de {year}. Hasta entonces todas las casillas están bloqueadas.',
      day: 'Hoy se ha abierto la casilla {door}. Las casillas abiertas siguen abiertas hasta el 31 de diciembre.',
      all: 'Las 24 casillas están abiertas hasta el 31 de diciembre.',
      over: 'El calendario de {year} se ha cerrado. Una casilla que hayas empezado se queda en la app, y puedes terminarla.'
    },
    doorsHeading: 'Las 24 casillas',
    doorsNote: 'Cada casilla muestra su día, su nivel y su puntuación HoDoKu. Una casilla abierta te lleva a su sudoku en sudokUI.',
    door: 'Casilla',
    state: { locked: 'Bloqueada', open: 'Abierta', today: 'Hoy', closed: 'Cerrada' },
    howHeading: 'Cómo funciona',
    how: [
      'Una casilla se abre en su día, a medianoche según tu propio reloj, y sigue abierta hasta el 31 de diciembre, así que puedes recuperar un día que te hayas saltado. Una casilla cuyo día no ha llegado está bloqueada: ningún enlace ni dirección la abre antes de tiempo.',
      'En la casilla 1 hay un sudoku con una puntuación HoDoKu de unos 100, y en la casilla 24 uno de unos {top}: cada casilla suma unos 100. Cada casilla muestra su nivel y su puntuación, así que sabes lo que viene.',
      'Si resuelves una casilla sin usar nada del cuadro Ayuda, como las pistas, las revisiones o los candidatos automáticos, puedes enviar tu tiempo desde la pantalla de victoria y ver qué lugar ocupa entre los de todos, el día de su casilla y hasta una semana después.',
      'A partir del 1 de enero el calendario está cerrado. Una casilla que hayas empezado se queda en la app, y puedes terminarla.'
    ],
    play: 'Abre sudokUI',
    daily: 'Juega al sudoku del día',
    inApp: 'A partir del 1 de diciembre, el calendario también está en sudokUI, en Nuevo.',
    imageAlt: 'El calendario de adviento {year} de sudokUI: 24 casillas, de fácil a extremo.',
    item: 'Casilla {door}, {date}: {level}, puntuación HoDoKu {score}'
  }
};

/**
 * The page's social card, a year's calendar in a language, in public/
 * beside the site's own card (made by scripts/og-advent-card.ts):
 * /og-advent-2026.png, /og-advent-2026.nb.png, /og-advent-2026.es.png
 */
export const adventCardPath = (lang: Lang, year: number) => `/og-advent-${year}${lang === 'en' ? '' : `.${lang}`}.png`;

/** the date formats a door's day is written in (the app's own, src/content/i18n.ts LANGS) */
export const ADVENT_LOCALE: Record<Lang, string> = { en: 'en-GB', nb: 'nb-NO', es: 'es-ES' };

/** {name} placeholders filled */
export const fillAdvent = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** the id of the list of doors the script reads, and of the status line it writes */
export const DOORS_ID = 'advent-doors';
export const STATUS_ID = 'advent-status';

/** what the door script writes, in the page's language */
export interface DoorWords {
  open: string;
  today: string;
  closed: string;
  before: string;
  /** {door}: today's door */
  day: string;
  all: string;
  over: string;
}

/** the words the script writes on a page, out of its copy */
export const doorWords = (c: AdventPageCopy, year: number): DoorWords => ({
  open: c.state.open,
  today: c.state.today,
  closed: c.state.closed,
  before: fillAdvent(c.status.before, { year }),
  day: c.status.day,
  all: c.status.all,
  over: fillAdvent(c.status.over, { year })
});

/**
 * The inline script that opens the doors whose day has come by the
 * visitor's own clock. The list (DOORS_ID) names its year (data-year) and
 * the address a door's number goes after (data-app, /advent/2026/); each
 * door is an <a> without an address, data-door its number, with a
 * .state word. Door n of year Y is open from Y-12-n to Y-12-31 (advent.ts,
 * doorOpen): it gets its address, the class open (and today on its own
 * day) and its word; after 31 December every door is closed. The status
 * line (STATUS_ID) says where the calendar stands. Plain ES5, no file to
 * fetch, nothing stored and nothing sent: it reads the device's date only.
 */
export function doorScript(words: DoorWords): string {
  // "<" in a string must not close the script element
  const json = JSON.stringify(words).replace(/</g, '\\u003c');
  return `(function () {
  var list = document.getElementById('${DOORS_ID}');
  if (!list) return;
  var words = ${json};
  var now = new Date();
  var today = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  var december = Number(list.getAttribute('data-year')) * 10000 + 1200;
  var doors = list.getElementsByTagName('a');
  for (var i = 0; i < doors.length; i++) {
    var door = doors[i];
    var n = Number(door.getAttribute('data-door'));
    var state = door.querySelector('.state');
    if (today > december + 31) {
      door.className = 'door closed';
      state.textContent = words.closed;
    } else if (today >= december + n) {
      door.setAttribute('href', list.getAttribute('data-app') + n);
      door.className = today === december + n ? 'door open today' : 'door open';
      state.textContent = today === december + n ? words.today : words.open;
    }
  }
  var status = document.getElementById('${STATUS_ID}');
  if (status) {
    status.textContent =
      today <= december ? words.before : today <= december + 24 ? words.day.replace('{door}', String(today - december)) : today <= december + 31 ? words.all : words.over;
  }
})();`;
}
