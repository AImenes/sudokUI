// URL paths served as static HTML documents rather than by the app. The
// service worker must leave them alone (vite.config.ts), otherwise an
// installed app would answer them with its own shell.
export const STATIC_ROUTES = /^\/(learn|daily-sudoku|sudoku-solver|sudoku-difficulty-rating|hodoku)(\/|$)/;

export const RATING_URL = '/sudoku-difficulty-rating/';
