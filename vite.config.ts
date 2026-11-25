import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

/**
 * Vite 8 throws SendBeforeConnectError if import.meta.hot.send() is invoked before
 * the HMR WebSocket opens. vite-plugin-pwa@2.0.0 calls import.meta.hot.send()
 * synchronously inside registerDevSW() on page load, so defer it until vite:ws:connect.
 */
function pwaDevHmrSafeGuard(): Plugin {
  return {
    name: 'alphamate-pwa-dev-hmr-guard',
    apply: 'serve',
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('pwa-entry-point-loaded')) return null;
      const target = "import.meta.hot.send('vite-pwa-plugin:dev-ready');";
      if (!code.includes(target)) return null;
      const patched =
        `let __pwaWsConnected = false;\n` +
        `if (import.meta.hot) {\n` +
        `  import.meta.hot.on('vite:ws:connect', () => { __pwaWsConnected = true; });\n` +
        `}\n` +
        code.replace(
          target,
          `if (import.meta.hot) {
            const sendReady = () => {
              try {
                import.meta.hot.send('vite-pwa-plugin:dev-ready');
              } catch {
                // Ignore if HMR socket is unavailable
              }
            };
            if (__pwaWsConnected) {
              sendReady();
            } else {
              import.meta.hot.on('vite:ws:connect', sendReady);
            }
          }`
        );
      return {code: patched, map: null};
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      pwaDevHmrSafeGuard(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: [
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
          'apple-touch-icon.png',
          'alpha-mate-logo-emblem.webp',
          'alpha-mate-logo-full.webp',
          'alpha-mate-logo-emblem.png',
          'alpha-mate-logo-full.png',
        ],
        manifest: {
          id: '/',
          name: 'Alpha Mate — Live • Party • Social',
          short_name: 'Alpha Mate',
          description:
            'Premium social entertainment platform featuring live streaming, PK battles, audio party rooms, 1-on-1 chat, and VIP honors.',
          theme_color: '#09070F',
          background_color: '#09070F',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          categories: ['social', 'entertainment'],
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          globPatterns: ['**/*.{html,ico,svg,woff,woff2}', 'assets/index-*.{js,css}', 'assets/vendor-react-*.js', 'assets/vendor-firebase-*.js'],
          globIgnores: [
            '**/assets/aistudio/**',
            '**/uploads/gifts/**',
            '**/app-icon.png',
            '**/AgoraRTC*',
            '**/vendor-agora*',
            '**/AdminDashboard*',
          ],
          navigateFallback: '/index.html',
          navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/__/, /^\/uploads\/gifts\//],
          runtimeCaching: [
            // Never cache real-time voice/video tokens, auth OTPs, uploads, or live rooms API
            {
              urlPattern: ({url}) =>
                /^\/api\/(agora|sfu|webrtc|auth|account|reels\/upload|realtime|admin|gemini)/.test(url.pathname),
              handler: 'NetworkOnly',
            },
            // Cacheable public catalog/music API endpoints (StaleWhileRevalidate)
            {
              urlPattern: ({url}) => /^\/api\/music\/(search|trending)/.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alphamate-music-api-v1',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 60 * 10, // 10 minutes
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Hashed lazy-loaded JS/CSS route & vendor chunks (cached on first visit)
            {
              urlPattern: ({url, request}) =>
                url.origin === self.location.origin &&
                url.pathname.startsWith('/assets/') &&
                (request.destination === 'script' || request.destination === 'style'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'alphamate-lazy-chunks-v1',
                expiration: {
                  maxEntries: 120,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Service Worker cached user profile snippets (served instantly offline and on cold boot)
            {
              urlPattern: ({url}) => url.pathname.startsWith('/__sw_cache__/profile-snippets/'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'alphamate-profile-snippets-v1',
                expiration: {
                  maxEntries: 250,
                  maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // User profile avatars & remote media thumbnails
            {
              urlPattern:
                /^https:\/\/(lh[0-9]+\.googleusercontent\.com|firebasestorage\.googleapis\.com|storage\.googleapis\.com|images\.unsplash\.com|.*\.r2\.dev)\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'alphamate-profile-avatars-v1',
                expiration: {
                  maxEntries: 160,
                  maxAgeSeconds: 60 * 60 * 24 * 14, // 14 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Core UI background & static image assets
            {
              urlPattern: ({url, request}) =>
                url.origin === self.location.origin &&
                !url.pathname.startsWith('/assets/aistudio/') &&
                (url.pathname.startsWith('/assets/backgrounds/') ||
                  request.destination === 'image' ||
                  request.destination === 'font'),
              handler: 'CacheFirst',
              options: {
                cacheName: 'alphamate-ui-assets-v1',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Google Fonts stylesheets
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // Google Fonts font files
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          // Avoid injecting @vite-plugin-pwa dev HMR client hooks when Vite HMR is disabled
          enabled: process.env.DISABLE_HMR !== 'true',
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 900,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('agora-rtc-sdk-ng')) return 'vendor-agora';
            if (id.includes('firebase') || id.includes('@firebase')) return 'vendor-firebase';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) {
              return 'vendor-react';
            }
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('svgaplayerweb') || id.includes('pako') || id.includes('protobufjs')) {
              return 'vendor-svga';
            }
            if (id.includes('@capacitor')) return 'vendor-capacitor';
            return undefined;
          },
        },
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
  };
});
