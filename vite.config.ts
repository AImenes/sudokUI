import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { version } from './package.json';
import type { Plugin } from 'vite';
import { STATIC_ROUTES } from './src/content/staticRoutes';

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

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [
    react(),
    staticPagesDev(),
    VitePWA({
      // a new build waits until the player accepts it (src/main.tsx): an
      // open tab keeps the files it started with, so a deploy never breaks
      // a game in progress
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icon.svg'],
      workbox: {
        // The app lives at "/" only (hash routing), so only "/" may fall
        // back to the app shell. The static pages are real documents: left
        // to the default, an installed app would answer their URLs with
        // the game instead of the article.
        navigateFallbackAllowlist: [/^\/(?:\?.*)?$/],
        navigateFallbackDenylist: [STATIC_ROUTES],
        // and they stay out of the precache: they are generated after this
        // step anyway, but a player should never download 80 articles
        globIgnores: ['learn/**', '404.html']
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
