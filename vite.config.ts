import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { version } from './package.json';
import { STATIC_ROUTES } from './src/content/staticRoutes';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
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
    environment: 'node'
  }
} as any);
