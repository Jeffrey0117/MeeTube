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
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5173,
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
