import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@css': path.resolve(__dirname, 'css'),
      '@js': path.resolve(__dirname, 'js'),
      '@client-api': path.resolve(__dirname, 'client-api'),
    },
    dedupe: ['react', 'react-dom'],
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'redirect-admin',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          // Handle /admin (without trailing slash) -> /admin/
          // Must handle query parameters (e.g. from IDE preview)
          const [path, query] = req.url.split('?');
          if (path === '/admin') {
            res.writeHead(301, { 
              Location: '/admin/' + (query ? '?' + query : '') 
            });
            res.end();
            return;
          }
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        interview: path.resolve(__dirname, 'interview.html'),
      },
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000
      },
      '/admin': {
        target: 'http://localhost:3004',
        changeOrigin: true
      }
    }
  }
});
