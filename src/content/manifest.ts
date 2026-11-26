// The web manifest (vite.config.ts hands it to vite-plugin-pwa, which
// writes dist/manifest.webmanifest): what a browser reads to install
// sudokUI as an app. One language, English: a manifest has one `lang`,
// and a browser shows its words (the shortcuts' names, the screenshots'
// labels) as they are, whatever the page's language (docs/architecture.md,
// "The web manifest").
//
// - `id`, `start_url` and `scope`: the app is the whole site, and an
//   installed copy is known by its id however its start address changes.
// - `shortcuts`: what a long press on the installed icon offers. Today's
//   daily (#daily, which the app opens as today's: src/content/share.ts,
//   readAppLink) and Learn (#learn=techniques, the technique guide:
//   src/ui/App.tsx, parseLearnParam). Both open inside the app, offline
//   too, and put a game under way aside as any link does.
// - `screenshots`: the install sheet's pictures, made from the built app
//   by scripts/manifest-screenshots.ts into public/screenshots/, a narrow
//   one for phones and a wide one for laptops. The service worker never
//   precaches them (SCREENSHOTS_GLOB in vite.config.ts's globIgnores):
//   only the install sheet shows them.

/** the folder of the install sheet's pictures, under public/ and dist/ */
export const SCREENSHOTS_DIR = 'screenshots';
/** kept out of the service worker's precache */
export const SCREENSHOTS_GLOB = `${SCREENSHOTS_DIR}/**`;

export const MANIFEST_SCREENSHOTS = [
  {
    src: `${SCREENSHOTS_DIR}/narrow.png`,
    sizes: '1080x1920',
    type: 'image/png',
    form_factor: 'narrow',
    label: 'A sudoku on a phone, with a hint drawn on the board'
  },
  {
    src: `${SCREENSHOTS_DIR}/wide.png`,
    sizes: '1280x800',
    type: 'image/png',
    form_factor: 'wide',
    label: 'A sudoku on a laptop: the hint draws the technique on your own board and says why it works'
  }
] as const;

export const WEB_MANIFEST = {
  id: '/',
  start_url: '/',
  scope: '/',
  name: 'sudokUI',
  short_name: 'sudokUI',
  description: 'Play sudoku, rate the difficulty of any puzzle and practise solving techniques with hints that explain every step.',
  lang: 'en',
  dir: 'ltr',
  categories: ['games', 'education'],
  theme_color: '#1a1d29',
  background_color: '#1a1d29',
  display: 'standalone',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
  ],
  shortcuts: [
    {
      name: 'Today’s daily',
      short_name: 'Daily',
      description: 'The daily puzzle: everyone in the world gets the same board today',
      url: '/#daily',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
    },
    {
      name: 'Learn',
      short_name: 'Learn',
      description: 'Every solving technique, explained on a board',
      url: '/#learn=techniques',
      icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
    }
  ],
  screenshots: MANIFEST_SCREENSHOTS
};
