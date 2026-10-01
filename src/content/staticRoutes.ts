// URL paths served as static HTML documents rather than by the app. The
// service worker must leave them alone (vite.config.ts), otherwise an
// installed app would answer them with its own shell. The Learn pages also
// exist in Norwegian and Spanish, under /nb/ and /es/.
export const STATIC_ROUTES = /^\/(?:(?:nb|es)\/)?(learn|daily-sudoku|sudoku-solver|sudoku-difficulty-rating|hodoku|how-the-best-solve)(\/|$)/;

export const RATING_URL = '/sudoku-difficulty-rating/';
