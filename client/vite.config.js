import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // Shaka player alias
      'shaka-player$': 'shaka-player/dist/shaka-player.ui.js',
    },
    extensions: ['.js', '.vue', '.json'],
  },
  define: {
    // Remove Electron flag
    'process.env.IS_ELECTRON': 'false',
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'process.env.SUPPORTS_LOCAL_API': 'true',
    'process.env.HOT_RELOAD_LOCALES': 'false',
    'process.env.GEOLOCATION_NAMES': JSON.stringify([
      'ar', 'be', 'bg', 'ca', 'cs', 'da', 'de-DE', 'el', 'en-GB', 'en-US',
      'es', 'es-AR', 'es-MX', 'et', 'eu', 'fa', 'fi', 'fr-FR', 'gl', 'he',
      'hr', 'hu', 'id', 'is', 'it', 'ja', 'ko', 'lt', 'nb-NO', 'nl', 'nn',
      'pl', 'pt', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sk', 'sl', 'sr', 'sv',
      'ta', 'tr', 'uk', 'vi', 'zh-CN', 'zh-TW'
    ]),
    'process.platform': JSON.stringify('browser'),
    // Shaka Player pre-bundled locales (these are already loaded)
    'process.env.SHAKA_LOCALES_PREBUNDLED': JSON.stringify(['en', 'en-GB']),
    // Shaka Player locale mappings (FreeTube locale -> Shaka locale)
    'process.env.SHAKA_LOCALE_MAPPINGS': JSON.stringify([
      ['en-US', 'en'],
      ['en-GB', 'en-GB'],
      ['de-DE', 'de'],
      ['fr-FR', 'fr'],
      ['es', 'es'],
      ['es-AR', 'es-419'],
      ['es-MX', 'es-419'],
      ['pt', 'pt'],
      ['pt-BR', 'pt-BR'],
      ['pt-PT', 'pt-PT'],
      ['zh-CN', 'zh-Hans'],
      ['zh-TW', 'zh-Hant'],
      ['ja', 'ja'],
      ['ko', 'ko'],
      ['it', 'it'],
      ['nl', 'nl'],
      ['pl', 'pl'],
      ['ru', 'ru'],
      ['tr', 'tr'],
      ['ar', 'ar'],
      ['he', 'he'],
      ['vi', 'vi'],
      ['uk', 'uk'],
      ['cs', 'cs'],
      ['hu', 'hu'],
      ['ro', 'ro'],
      ['sv', 'sv'],
      ['da', 'da'],
      ['fi', 'fi'],
      ['nb-NO', 'nb'],
      ['nn', 'nn'],
      ['id', 'id'],
      ['el', 'el'],
      ['bg', 'bg'],
      ['hr', 'hr'],
      ['sk', 'sk'],
      ['sl', 'sl'],
      ['sr', 'sr'],
      ['ca', 'ca'],
      ['eu', 'eu'],
      ['gl', 'gl'],
      ['et', 'et'],
      ['lt', 'lt'],
      ['be', 'be'],
      ['fa', 'fa'],
      ['is', 'is'],
      ['ta', 'ta'],
    ]),
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/vi': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/vi_webp': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ggpht': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/imgproxy': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/videoplayback': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/manifest': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vue-vendor': ['vue', 'vue-router', 'vuex', 'vue-i18n'],
          'player': ['shaka-player'],
        },
      },
    },
  },
})
