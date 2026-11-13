// URL paths served as static HTML documents rather than by the app. The
// service worker must leave them alone (vite.config.ts), otherwise an
// installed app would answer them with its own shell. Every one of them
// also exists in Norwegian and Spanish, under /nb/ and /es/, which are
// themselves the app (src/content/home.ts) and so are not matched here.
//
// The advent calendar's pages (src/content/adventPage.ts) have a name of
// their own in each language, /advent/, /nb/julekalender/ and
// /es/calendario-de-adviento/, and only the page itself is matched: a
// door's address, /advent/2026/5 (src/content/advent.ts), is the app's,
// which an installed app answers offline (tests/advent.test.ts).
export const STATIC_ROUTES =
  /^\/(?:(?:(?:nb|es)\/)?(?:learn|daily-sudoku|sudoku-solver|sudoku-difficulty-rating|hodoku|how-the-best-solve|privacy|why)(?:\/|$)|advent\/?(?:\?|$)|nb\/julekalender(?:\/|$)|es\/calendario-de-adviento(?:\/|$))/;

export const RATING_URL = '/sudoku-difficulty-rating/';

/** what the app sends, exactly, in the three languages (src/content/privacy.ts) */
export const PRIVACY_URL = '/privacy/';

/**
 * The static pages the service worker keeps for offline use: the privacy
 * page, the one the app's own footer opens in place, in each language
 * (about 7 KB compressed apiece). The rest are read online.
 */
export const OFFLINE_PAGES = [PRIVACY_URL, `/nb${PRIVACY_URL}`, `/es${PRIVACY_URL}`];

/** what sudokUI is for and promises, in the three languages (src/content/why.ts) */
export const WHY_URL = '/why/';

/** the advent calendar's page in each language (src/content/adventPage.ts): each has its own name */
export const ADVENT_URLS = { en: '/advent/', nb: '/nb/julekalender/', es: '/es/calendario-de-adviento/' } as const;
