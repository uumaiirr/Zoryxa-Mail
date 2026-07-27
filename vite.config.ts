import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'CEO Mail — Inbox Assistant',
        short_name: 'CEO Mail',
        description: 'Your inbox, already summarized. Drafts in your voice.',
        theme_color: '#12263A',
        background_color: '#F4F6F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Cache ONLY the list/digest/auth endpoints for offline glances.
            // Never /api/emails/:id — full bodies and drafts must not persist
            // in Cache Storage (privacy: bodies live only in Gmail).
            urlPattern: ({ url }) =>
              url.pathname === '/api/emails' ||
              url.pathname === '/api/digest/today' ||
              url.pathname === '/api/auth/status',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 30, maxAgeSeconds: 86400 },
            },
          },
        ],
      },
    }),
  ],
})
