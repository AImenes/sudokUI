import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { version } from './package.json';
import type { Plugin } from 'vite';
import { STATIC_ROUTES } from './src/content/staticRoutes';
import { renderHome, homeLangOfPath, HOME_LANGS, APP_NAVIGATION } from './src/content/home';

/**
 * Serves the static pages (/learn/, the landing pages) on the dev server
 * too. In production they are files written by scripts/build-learn.ts;
 * here they are built on request from the live content modules, so a
 * change to the copy shows on reload.
 */
function staticPagesDev(): Plugin {
  return {
    name: 'sudokui-static-pages-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split(/[?#]/)[0];
        if (!STATIC_ROUTES.test(url)) return next();
        try {
          const mod = await server.ssrLoadModule('/src/content/learnPages.ts');
          const want = url.endsWith('/') ? url : url + '/';
          const page = mod.buildLearnPages().find((p: { url: string }) => p.url === want);
          if (page) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.end(page.html);
            return;
          }
          const asset = mod.buildLearnAssets().find((a: { path: string }) => '/' + a.path === url);
          if (asset) {
            res.setHeader('Content-Type', 'image/svg+xml');
            res.end(asset.content);
            return;
          }
        } catch (err) {
          server.config.logger.error(String(err));
        }
        next();
      });
    }
  };
}

/**
 * The home page in every language: / in English, /nb/ and /es/ in
 * Norwegian and Spanish (src/content/home.ts). index.html is their
 * template.
 *
 * - The dev server answers /nb/ and /es/ with index.html too, and fills it
 *   in the language of the address it was asked for.
 * - The build fills dist/index.html in English once Vite and the other
 *   plugins are done with it, and writes nb/index.html and es/index.html
 *   from the same page, with the same scripts and styles, so the service
 *   worker precaches all three and /nb/ and /es/ work offline.
 */
function homePages(): Plugin[] {
  const pathOf = (url: string) => url.split(/[?#]/)[0];
  return [
    {
      name: 'sudokui-home-dev',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (homeLangOfPath(pathOf(req.url ?? ''))) req.url = '/index.html';
          next();
        });
      },
      transformIndexHtml: {
        order: 'pre',
        handler: (html, ctx) =>
          html.includes('<!--home:') ? renderHome(html, homeLangOfPath(pathOf(ctx.originalUrl ?? ctx.path)) ?? 'en') : html
      }
    },
    {
      name: 'sudokui-home-build',
      apply: 'build',
      // after vite:build-html, which emits index.html with its scripts,
      // styles and every plugin's transformIndexHtml applied
      enforce: 'post',
      configResolved(config) {
        // nb/index.html sits one folder down: its script and style
        // addresses only work there if they are absolute
        if (config.base !== '/') throw new Error('the home pages need base "/" (vite.config.ts, homePages)');
      },
      generateBundle(_, bundle) {
        const page = bundle['index.html'];
        if (page?.type !== 'asset') return this.error('index.html is not in the bundle');
        const built = typeof page.source === 'string' ? page.source : new TextDecoder().decode(page.source);
        page.source = renderHome(built, 'en');
        for (const lang of HOME_LANGS) {
          if (lang !== 'en') this.emitFile({ type: 'asset', fileName: `${lang}/index.html`, source: renderHome(built, lang) });
        }
      }
    }
  ];
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [
    react(),
    staticPagesDev(),
    homePages(),
    VitePWA({
      // a new build waits until the player accepts it (src/main.tsx): an
      // open tab keeps the files it started with, so a deploy never breaks
      // a game in progress
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg'],
      workbox: {
        // The app lives at "/", "/nb/" and "/es/" only (hash routing), so
        // only those may fall back to the app shell (src/content/home.ts).
        // The static pages are real documents: left to the default, an
        // installed app would answer their URLs with the game instead of
        // the article.
        navigateFallbackAllowlist: [APP_NAVIGATION],
        navigateFallbackDenylist: [STATIC_ROUTES],
        // and they stay out of the precache: they are generated after this
        // step anyway, but a player should never download 80 articles. So
        // do the 404 pages, in every language.
        globIgnores: ['learn/**', '**/404.html']
      },
      manifest: {
        name: 'sudokUI',
        short_name: 'sudokUI',
        description:
          'Play sudoku, rate the difficulty of any puzzle and practise solving techniques with hints that explain every step.',
        lang: 'en',
        categories: ['games', 'education'],
        theme_color: '#1a1d29',
        background_color: '#1a1d29',
        display: 'standalone',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  test: {
    environment: 'node',
    // the browser smoke test is Playwright's (npm run test:e2e)
    exclude: ['**/node_modules/**', 'tests/e2e/**']
  }
} as any);
