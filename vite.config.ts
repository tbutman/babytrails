import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// The Content-Security-Policy, also sent by the server (see deploy/). The <meta> copy protects the
// built app wherever it's served; it's left out in development because Vite's dev server injects
// inline scripts.
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' https://api.anthropic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
  }
}

// The Latin subset of Inter is needed for the first text on every page. Preloading it from the HTML
// starts the download with the scripts instead of after the stylesheet has been parsed (as LabTrails).
function preloadFont(): Plugin {
  return {
    name: 'preload-inter-latin',
    apply: 'build',
    transformIndexHtml: (_html, ctx) => {
      const font = Object.keys(ctx.bundle ?? {}).find((f) => /inter-latin-wght-normal-.*\.woff2$/.test(f))
      return font ? [{ tag: 'link', attrs: { rel: 'preload', href: `/${font}`, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' }] : []
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    cspMeta(),
    preloadFont(),
    // Installable and offline. The service worker precaches the app, the WHO tables and pdf.js; the
    // pdf.js support files (decoders, fonts, character maps) are cached the first time a PDF needs them.
    VitePWA({
      // A new version waits until the user taps Reload (src/core/ui/UpdatePrompt.tsx).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'BabyTrails',
        short_name: 'BabyTrails',
        description: "Your baby's growth records, private and in one place.",
        // The installed app opens the app, not the landing page (BABY-15).
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        background_color: '#FAF9F6',
        theme_color: '#1D2340',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,woff2,wasm}', 'demo/*.jpg'],
        globIgnores: ['vendor/pdfjs/**', 'og.png'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/vendor/pdfjs/'),
            handler: 'CacheFirst',
            options: { cacheName: 'pdfjs-assets', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
  build: {
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        // The PDF viewer's worker went out once with the wrong content type, and installed apps
        // cached that copy under its (content-hashed) name. A new name makes every browser fetch
        // it again; bump the suffix if a published asset ever needs the same treatment.
        assetFileNames: (info) => (info.names?.some((n) => n.endsWith('.mjs')) ? 'assets/[name]-[hash]-r2[extname]' : 'assets/[name]-[hash][extname]'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
