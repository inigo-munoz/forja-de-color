/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Served from https://<user>.github.io/forja-de-color/, not from a domain root.
  base: '/forja-de-color/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,md}'],
      },
      manifest: {
        name: 'Forja de Color',
        short_name: 'Forja',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#141218',
        theme_color: '#141218',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: { environment: 'jsdom', globals: true },
});
