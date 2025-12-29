import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath } from 'node:url'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import layouts from 'vite-plugin-vue-layouts'

export default defineConfig({
  base: '/admin/',
  plugins: [
    vue({
      template: { transformAssetUrls: true },
    }),
    vueJsx(),
    vuetify(),
    layouts({
      layoutsDirs: './src/layouts/',
    }),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
      dirs: ['./src/composables/', './src/utils/', './src/stores/', './src/api/'],
      vueTemplate: true,
    }),
    Components({
      dirs: ['./src/@core/components/', './src/views/demos/', './src/components/'],
      extensions: ['vue'],
      dts: true,
    }),
  ],
  define: { 'process.env': {} },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/@core', import.meta.url)),
      '@layouts': fileURLToPath(new URL('./src/@layouts', import.meta.url)),
      '@images': fileURLToPath(new URL('./src/assets/images/', import.meta.url)),
      '@styles': fileURLToPath(new URL('./src/styles/', import.meta.url)),
    },
  },
  server: {
    port: 3004,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 5050,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/public': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 5000,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
  },
})