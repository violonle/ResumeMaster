import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
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
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/admin': {
        target: 'http://localhost:3004',
        changeOrigin: true
      }
    }
  }
});
