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
      includeAssets: ['icon-apple-180.png', 'icon-48.png'],
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
        // Gold Sigma on navy (design/app-icon.svg). New file names, so phones notice the new icon.
        icons: [
          { src: 'icon-64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
}));
