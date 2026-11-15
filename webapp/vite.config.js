import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build straight into the backend's static dir so the app is served
// same-origin at http://<host>:3001/app/ — required for the Grafana
// auth-proxy iframe (the farmsense_token cookie is same-site there).
export default defineConfig({
  plugins: [react(), {
    name: 'gzip-static-assets',
    writeBundle(options, bundle) {
      for (const asset of Object.values(bundle)) {
        if (!/\.(js|css)$/.test(asset.fileName)) continue;
        const file = resolve(options.dir, asset.fileName);
        writeFileSync(file + '.gz', gzipSync(readFileSync(file)));
      }
    },
  }],
  base: '/app/',
  build: {
    outDir: '../frontend/app',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/grafana': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
});
