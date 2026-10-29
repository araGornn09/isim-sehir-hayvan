import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'PRIVATE_EDITION']);
  const isPrivate = env.PRIVATE_EDITION === 'true';
  // Mağaza sürümünde özel modül yerine boş bir taslak paketlenir.
  const editionModule = isPrivate ? './src/private/edition.js' : './src/private/store-stub.js';
  // Kişisel kimlik metinleri git'te yok; dosya yoksa örnek metinler kullanılır.
  const identitiesModule = existsSync(new URL('./src/private/identities.js', import.meta.url)) ? './src/private/identities.js' : './src/private/identities.example.js';

  return {
    // PRIVATE_EDITION .env dosyasında prefix'siz tanımlanabilsin diye eklendi.
    envPrefix: ['VITE_', 'PRIVATE_EDITION'],
    base: './',
    resolve: {
      alias: {
        '@edition': fileURLToPath(new URL(editionModule, import.meta.url)),
        '@identities': fileURLToPath(new URL(identitiesModule, import.meta.url))
      }
    },
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['icons/*.png', 'icons/icon.svg'],
        manifest: {
          name: 'İsim Şehir Hayvan',
          short_name: 'İsim Şehir',
          description: 'İki kişilik gerçek zamanlı İsim Şehir Hayvan oyunu',
          lang: 'tr',
          start_url: './',
          scope: './',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#1b1033',
          theme_color: '#1b1033',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
          navigateFallback: 'index.html',
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
        }
      })
    ]
  };
});
