// Share links that preview (docs/online-goals.md, phase 1): the address of
// a puzzle, /p/<81 cells> in English, /nb/p/ and /es/p/ in Norwegian and
// Spanish, and the page a crawler or a chat app finds there. The page is
// the app's own shell with a puzzle-specific head: a title, a description,
// Open Graph and Twitter tags, an image for the band, and noindex. The
// Worker (worker/index.ts) renders it on request from the template the
// build writes (share.tpl, vite.config.ts); the dev server does the same
// from index.html.
//
// Everything the page says about the puzzle comes from the address: the
// band, the score and the techniques are query hints the client puts there
// when it builds the link (?b=hard&s=1420&t=x-wing,skyscraper), and a
// challenger's time rides along as ?vs=<seconds>. They are spoofable,
// which is harmless on a page nothing indexes, and they spare the Worker
// from rating the puzzle, which the free plan's 10 ms of CPU could not
// afford. Nothing here touches the network or the DOM: the Worker, the
// build and the app all import it, so it stays light (the catalogue, the
// name tables and home.ts).
import { TECHS, LEVELS, Tech, Level } from '../engine/ratings';
import type { Lang } from '../state/settings';
import { techSlug, techFromParam } from './slugs';
import { SITE, homePath, ogCard, fillTemplate } from './home';
import { parseDailyUrl, dailyPath, findDaily, dailyNumber } from './dailies';
import type { Daily } from './dailies';
import * as namesNb from './locales/names.nb';
import * as namesEs from './locales/names.es';

/** what a share address carries */
export interface ShareParams {
  lang: Lang;
  /** 81 cells, digits and dots */
  puzzle: string;
  level?: Level;
  score?: number;
  /** the techniques worth naming, hardest first, at most SHARE_TECHS */
  techs?: Tech[];
  /** a challenger's time, in whole seconds */
  vs?: number;
  /** the daily this puzzle is (dailies.ts): the address is then /daily/<date>, and the page says so */
  daily?: { no: number; date: string };
}

/** how many techniques a link names */
export const SHARE_TECHS = 3;

/** the path of a share address, in any language, with or without a trailing slash */
export const SHARE_PATH = /^\/(?:(nb|es)\/)?p\/([0-9.]{81})\/?$/;

const LEVEL_BY_SLUG = new Map<string, Level>(LEVELS.map((l) => [l.toLowerCase(), l]));

/** a time as the app writes it, 9:12 */
export const clockOf = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * The share address a page or a link points at, or null: the path must be
 * a puzzle, and a query hint that does not parse is dropped, never
 * guessed. An address like "/p/<puzzle>?b=hard&s=1420&t=x-wing&vs=552".
 */
export function parseShareUrl(url: { pathname: string; search: string }): ShareParams | null {
  const m = SHARE_PATH.exec(url.pathname);
  if (!m) return null;
  const params: ShareParams = { lang: (m[1] as Lang) ?? 'en', puzzle: m[2] };
  const q = new URLSearchParams(url.search);
  const level = LEVEL_BY_SLUG.get((q.get('b') ?? '').toLowerCase());
  if (level) params.level = level;
  const score = Number(q.get('s'));
  if (q.has('s') && Number.isInteger(score) && score > 0 && score < 100000) params.score = score;
  const techs = (q.get('t') ?? '')
    .split(',')
    .map((s) => techFromParam(s.trim()))
    .filter((t): t is Tech => !!t)
    .filter((t, i, a) => a.indexOf(t) === i)
    .slice(0, SHARE_TECHS);
  if (techs.length) params.techs = techs;
  const vs = Number(q.get('vs'));
  if (q.has('vs') && Number.isInteger(vs) && vs > 0 && vs < 24 * 3600) params.vs = vs;
  return params;
}

/**
 * The share address of whatever an address points at, or null: a puzzle
 * (/p/<puzzle> with its hints) or a published daily (/daily/<date>, whose
 * band, score and techniques come from the published list, not the
 * address). What the Worker and the dev and preview servers render from.
 */
export function shareParamsOf(url: { pathname: string; search: string }, dailies: Daily[]): ShareParams | null {
  const share = parseShareUrl(url);
  if (share) return share;
  const d = parseDailyUrl(url);
  if (!d) return null;
  const daily = findDaily(dailies, d.date);
  const no = dailyNumber(d.date);
  if (!daily || !no) return null;
  return { lang: d.lang, puzzle: daily.puzzle, level: daily.level, score: daily.score, techs: daily.techs, vs: d.vs, daily: { no, date: d.date } };
}

/** the path and query of a share address, relative to the site */
export function sharePath(p: ShareParams): string {
  // a daily's address is its day; the puzzle and its hints are published
  if (p.daily) return dailyPath(p.lang, p.daily.date, p.vs);
  const q = new URLSearchParams();
  if (p.level) q.set('b', p.level.toLowerCase());
  if (p.score) q.set('s', String(p.score));
  if (p.techs?.length) q.set('t', p.techs.slice(0, SHARE_TECHS).map(techSlug).join(','));
  if (p.vs) q.set('vs', String(p.vs));
  // the commas between techniques stay readable: a link is read in a chat
  const query = q.toString().replace(/%2C/g, ',');
  return `${homePath(p.lang)}p/${p.puzzle}${query ? `?${query}` : ''}`;
}

/** the full share address, on the site unless an origin (the dev server's) is given */
export const shareUrl = (p: ShareParams, origin = SITE) => origin + sharePath(p);

/**
 * The techniques a link names, given those the puzzle's solve path plays
 * (solvePath in gameStore.ts): the hardest three, singles and the rest of
 * the Beginner band left out (every puzzle needs them), and brute force
 * left out too: a puzzle the catalogue cannot finish needs no technique
 * by that name
 */
export function techsWorthNaming(techs: Iterable<Tech>): Tech[] {
  return [...new Set(techs)]
    .filter((t) => TECHS[t] && TECHS[t].level !== 'Beginner' && t !== 'BRUTE_FORCE')
    .sort((a, b) => TECHS[b].index - TECHS[a].index)
    .slice(0, SHARE_TECHS);
}

// ---- the page ---------------------------------------------------------------

/** the social card for a band (public/og/, made by scripts/og-share-cards.ts) */
export const ogShareCard = (level: Level, lang: Lang) =>
  `${SITE}/og/${level.toLowerCase()}${lang === 'en' ? '' : `.${lang}`}.png`;

export interface ShareCopy {
  /** the tab: {level} and {score} known */
  title: string;
  /** the tab: {level} known, no score */
  titleNoScore: string;
  /** the tab: nothing known about the puzzle */
  titleUnknown: string;
  /** the preview's headline, {level} known */
  ogTitle: string;
  ogTitleUnknown: string;
  /** the preview's headline when a challenger's {time} is set */
  ogTitleVs: string;
  /** the description, with {level}, {score} and {techs} (which may be empty) */
  description: string;
  descriptionNoScore: string;
  descriptionUnknown: string;
  /** a daily's tab, headline and description: {no} and {date} as well */
  titleDaily: string;
  ogTitleDaily: string;
  descriptionDaily: string;
  /** "needing X-Wing and Skyscraper", glued to the sentence before the full stop */
  needing: string;
  /** a sentence put before the description when a challenger's {time} is set */
  vs: string;
  /** between the last two names of a list */
  and: string;
  ogImageAlt: string;
  ogImageAltUnknown: string;
  loading: string;
  noscript: string;
}

export const SHARE: Record<Lang, ShareCopy> = {
  en: {
    title: '{level} sudoku, rated {score} | sudokUI',
    titleNoScore: '{level} sudoku | sudokUI',
    titleUnknown: 'A sudoku to solve | sudokUI',
    ogTitle: 'Can you solve this {level} sudoku?',
    ogTitleUnknown: 'Can you solve this sudoku?',
    ogTitleVs: 'Solved in {time}. Can you beat it?',
    description: '{a} {level} sudoku rated {score}{techs}. Play it free on sudokUI, with hints that explain every step.',
    descriptionNoScore: '{a} {level} sudoku{techs}. Play it free on sudokUI, with hints that explain every step.',
    descriptionUnknown: 'A sudoku shared from sudokUI. Play it free, with hints that explain every step.',
    titleDaily: 'Daily #{no}: {level} sudoku, rated {score} | sudokUI',
    ogTitleDaily: 'sudokUI Daily #{no}, {date}: can you solve it?',
    descriptionDaily:
      'The daily for {date}: {a} {level} sudoku rated {score}{techs}. One board for the whole world, with everyone’s times to compare against. Play it free on sudokUI.',
    needing: ', needing {list}',
    vs: 'Solved in {time} on sudokUI: can you beat it?',
    and: 'and',
    ogImageAlt: '{a} {level} sudoku on sudokUI',
    ogImageAltUnknown: 'A sudoku on sudokUI',
    loading: 'Loading the puzzle…',
    noscript: 'sudokUI needs JavaScript to run. The app is free and open source:'
  },
  nb: {
    title: 'Sudoku på nivået {level}, poengsum {score} | sudokUI',
    titleNoScore: 'Sudoku på nivået {level} | sudokUI',
    titleUnknown: 'En sudoku å løse | sudokUI',
    ogTitle: 'Klarer du denne sudokuen på nivået {level}?',
    ogTitleUnknown: 'Klarer du denne sudokuen?',
    ogTitleVs: 'Løst på {time}. Klarer du å slå det?',
    description: '{a} sudoku på nivået {level} med poengsum {score}{techs}. Spill den gratis i sudokUI, med hint som forklarer hvert steg.',
    descriptionNoScore: '{a} sudoku på nivået {level}{techs}. Spill den gratis i sudokUI, med hint som forklarer hvert steg.',
    descriptionUnknown: 'En sudoku delt fra sudokUI. Spill den gratis, med hint som forklarer hvert steg.',
    titleDaily: 'Dagens sudoku #{no}: nivået {level}, poengsum {score} | sudokUI',
    ogTitleDaily: 'Dagens sudoku #{no}, {date}: klarer du den?',
    descriptionDaily:
      'Dagens sudoku for {date}: {a} sudoku på nivået {level} med poengsum {score}{techs}. Ett brett for hele verden, med alles tider å måle seg mot. Spill den gratis i sudokUI.',
    needing: ' som krever {list}',
    vs: 'Løst på {time} i sudokUI: klarer du å slå det?',
    and: 'og',
    ogImageAlt: '{a} sudoku på nivået {level} i sudokUI',
    ogImageAltUnknown: 'En sudoku i sudokUI',
    loading: 'Laster inn oppgaven…',
    noscript: 'sudokUI trenger JavaScript for å kjøre. Appen er gratis og har åpen kildekode:'
  },
  es: {
    title: 'Sudoku de nivel {level}, puntuación {score} | sudokUI',
    titleNoScore: 'Sudoku de nivel {level} | sudokUI',
    titleUnknown: 'Un sudoku para resolver | sudokUI',
    ogTitle: '¿Puedes resolver este sudoku de nivel {level}?',
    ogTitleUnknown: '¿Puedes resolver este sudoku?',
    ogTitleVs: 'Resuelto en {time}. ¿Puedes superarlo?',
    description: '{a} sudoku de nivel {level} con puntuación {score}{techs}. Juégalo gratis en sudokUI, con pistas que explican cada paso.',
    descriptionNoScore: '{a} sudoku de nivel {level}{techs}. Juégalo gratis en sudokUI, con pistas que explican cada paso.',
    descriptionUnknown: 'Un sudoku compartido desde sudokUI. Juégalo gratis, con pistas que explican cada paso.',
    titleDaily: 'Sudoku del día n.º {no}: nivel {level}, puntuación {score} | sudokUI',
    ogTitleDaily: 'Sudoku del día n.º {no}, {date}: ¿puedes resolverlo?',
    descriptionDaily:
      'El sudoku del día {date}: {a} sudoku de nivel {level} con puntuación {score}{techs}. Un solo tablero para todo el mundo, con los tiempos de todos para compararte. Juégalo gratis en sudokUI.',
    needing: ' que requiere {list}',
    vs: 'Resuelto en {time} en sudokUI: ¿puedes superarlo?',
    and: 'y',
    ogImageAlt: '{a} sudoku de nivel {level} en sudokUI',
    ogImageAltUnknown: 'Un sudoku en sudokUI',
    loading: 'Cargando el sudoku…',
    noscript: 'sudokUI necesita JavaScript para funcionar. La app es gratuita y de código abierto:'
  }
};

const SOURCE = 'https://github.com/AImenes/sudokUI';
const OG_LOCALE: Record<Lang, string> = { en: 'en_GB', nb: 'nb_NO', es: 'es_ES' };

/** the article that opens "{a} {level} sudoku": English needs "An" before Easy, Unfair and Extreme */
const ARTICLE: Record<Lang, (levelName: string) => string> = {
  en: (name) => (/^[aeiou]/i.test(name) ? 'An' : 'A'),
  nb: () => 'En',
  es: () => 'Un'
};

/** a band's name in a language (names.nb.ts, names.es.ts; English is the key) */
export function levelName(level: Level, lang: Lang): string {
  return lang === 'nb' ? namesNb.levels[level] : lang === 'es' ? namesEs.levels[level] : level;
}

/** a technique's name in a language: its own where the language has one, else English */
export function techName(tech: Tech, lang: Lang): string {
  const own = lang === 'nb' ? namesNb.techNames[tech] : lang === 'es' ? namesEs.techNames[tech] : undefined;
  return own ?? TECHS[tech].name;
}

const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));

/** "X-Wing, Skyscraper and Sue de Coq" */
export function joinNames(names: string[], and: string): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/…/g, '&hellip;');

/** the words of the page for a share address */
export function shareCopy(p: ShareParams) {
  const c = SHARE[p.lang];
  const level = p.level ? levelName(p.level, p.lang) : '';
  const techs = p.techs?.length ? fill(c.needing, { list: joinNames(p.techs.map((t) => techName(t, p.lang)), c.and) }) : '';
  const vars = { a: ARTICLE[p.lang](level), level, score: p.score ?? '', techs, no: p.daily?.no ?? '', date: p.daily?.date ?? '' };
  const daily = !!p.daily && !!p.level;
  const title = daily ? fill(c.titleDaily, vars) : p.level ? fill(p.score ? c.title : c.titleNoScore, vars) : c.titleUnknown;
  const description = daily
    ? fill(c.descriptionDaily, vars)
    : p.level
      ? fill(p.score ? c.description : c.descriptionNoScore, vars)
      : c.descriptionUnknown;
  const headline = daily ? fill(c.ogTitleDaily, vars) : p.level ? fill(c.ogTitle, vars) : c.ogTitleUnknown;
  const time = p.vs ? clockOf(p.vs) : '';
  return {
    title,
    description: p.vs ? `${fill(c.vs, { time })} ${description}` : description,
    ogTitle: p.vs ? fill(c.ogTitleVs, { time }) : headline,
    ogImage: p.level ? ogShareCard(p.level, p.lang) : ogCard(p.lang),
    ogImageAlt: p.level ? fill(c.ogImageAlt, vars) : c.ogImageAltUnknown,
    // the preview's headline doubles as the page's, before the app mounts
    h1: headline,
    loading: c.loading,
    noscript: c.noscript
  };
}

/**
 * The share page: the app's template (share.tpl, or index.html on the dev
 * server) with every <!--home:…--> placeholder filled for this puzzle.
 * Kept out of search, with no canonical, no language alternates and no
 * structured data: a share page is a door into the app, not a document.
 * og:url is the address itself, challenge and all: a scraper that follows
 * og:url (Facebook's does) must land on the same page.
 */
export function renderSharePage(template: string, p: ShareParams): string {
  const c = shareCopy(p);
  return fillTemplate(template, {
    lang: p.lang,
    title: esc(c.title),
    description: esc(c.description),
    links: '<meta name="robots" content="noindex" />',
    'og-title': esc(c.ogTitle),
    'og-description': esc(c.description),
    url: esc(SITE + sharePath(p)),
    'og-locale': `<meta property="og:locale" content="${OG_LOCALE[p.lang]}" />`,
    'og-image': c.ogImage,
    'og-image-alt': esc(c.ogImageAlt),
    'json-ld': '{}',
    boot: [
      `<h1>${esc(c.h1)}</h1>`,
      `<p>${esc(c.description)}</p>`,
      `<p>${esc(c.loading)}</p>`,
      '<noscript>',
      `  <p>${esc(c.noscript)} <a href="${SOURCE}">${SOURCE.replace('https://', '')}</a></p>`,
      '</noscript>'
    ].join('\n')
  });
}
