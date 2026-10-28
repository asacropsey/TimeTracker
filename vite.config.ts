import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const navy = '#0E1726';

export default defineConfig(({ command, isPreview }) => ({
  // The published app lives at https://asacropsey.github.io/TimeTracker/ (and "npm run preview"
  // at http://localhost:4173/TimeTracker/); while developing it stays at http://localhost:5173/
  base: command === 'build' || isPreview ? '/TimeTracker/' : '/',
  plugins: [
    // Makes the app installable on the phone and lets it work offline.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon-180x180.png', 'pwa-48x48.png'],
      workbox: {
        // Everything the app needs offline, including fonts and the crest images.
        globPatterns: ['**/*.{js,css,html,woff2,png,webp}'],
      },
      manifest: {
        name: 'Time Tracker',
        short_name: 'Time Tracker',
        description: 'Track time on long-running projects',
        theme_color: navy,
        background_color: navy, // splash screen colour while the app opens
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}));
