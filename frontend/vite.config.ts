import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'MLTrack - MercadoLibre Product Tracker',
        short_name: 'MLTrack',
        description: 'Sistema de seguimiento de productos de MercadoLibre con notificaciones push',
        theme_color: '#3483fa',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/mltrack/',
        start_url: '/mltrack/',
        lang: 'es',
        dir: 'ltr',
        categories: ['business', 'productivity', 'shopping'],
        icons: [
          {
            src: 'pwa-72x72.png',
            sizes: '72x72',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-96x96.png',
            sizes: '96x96',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-128x128.png',
            sizes: '128x128',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-144x144.png',
            sizes: '144x144',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-152x152.png',
            sizes: '152x152',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-384x384.png',
            sizes: '384x384',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        shortcuts: [
          {
            name: 'Dashboard',
            short_name: 'Dashboard',
            description: 'Ver el dashboard principal',
            url: '/mltrack/',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Productos',
            short_name: 'Productos',
            description: 'Ver lista de productos',
            url: '/mltrack/products',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Búsquedas',
            short_name: 'Búsquedas',
            description: 'Ver búsquedas guardadas',
            url: '/mltrack/searches',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          // Cache para API local con estrategia Stale-While-Revalidate
          {
            urlPattern: /^\/mltrack\/api\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'mltrack-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 5 // 5 minutos
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache para API de MercadoLibre con estrategia CacheFirst
          {
            urlPattern: /^https:\/\/api\.mercadolibre\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mercadolibre-api-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Cache para imágenes de MercadoLibre
          {
            urlPattern: /^https:\/\/http2\.mlstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mlstatic-images-cache',
              expiration: {
                maxEntries: 2000,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              }
            }
          },
          // Cache para assets estáticos
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
              }
            }
          },
          // Cache para fuentes
          {
            urlPattern: /\.(?:woff|woff2|ttf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 año
              }
            }
          }
        ],
        // Configuración para notificaciones push
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: '/mltrack/index.html',
        navigateFallbackDenylist: [/^\/mltrack\/api/, /^\/mltrack\/socket\.io/]
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/stores': path.resolve(__dirname, './src/stores'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types')
    }
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          query: ['react-query'],
          socket: ['socket.io-client'],
          ui: ['lucide-react', 'react-hot-toast']
        }
      }
    }
  }
})
