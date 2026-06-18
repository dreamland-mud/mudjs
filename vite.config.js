import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

/**
 * Dev-only: serve the DL mapper graph JSON (/maps/graph/*) from a local, gitignored
 * `dev-maps/` dir, intercepting before the `/maps` proxy (live has no /graph yet).
 * In prod these files are deployed beside the ASCII maps under the web root's /maps.
 * Missing files fall through to the proxy/404, so the mapper just shows its ASCII
 * fallback when no data is staged.
 */
function devMapperGraph() {
  const dir = path.resolve(__dirname, 'dev-maps');
  return {
    name: 'dl-mapper-dev-graph',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/maps/graph/')) return next();
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/maps\//, '');
        const file = path.resolve(dir, rel);
        if (!file.startsWith(dir) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// Per-build identifier the running client polls (version.json) to detect a new deploy and
// self-update (see src/autoupdate.js). A timestamp guarantees it changes on every build.
const BUILD_ID = String(Date.now());

/** Emit build/version.json carrying BUILD_ID, served beside the bundle for the update poll. */
function emitVersion() {
  return {
    name: 'dl-emit-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: BUILD_ID }),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devMapperGraph(), emitVersion()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  base: '/mudjs/', // 👈 путь, с которого будет искаться index.html и ассеты
  build: {
    // nginx serves /var/www/mudjs/build; vite defaults to dist/, so pin it to build/
    outDir: 'build',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./scss/main.scss";`,
      },
    },
  },
  json: {
    stringify: false,
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/maps': {
        target: 'https://dreamland.rocks',
        changeOrigin: true,
        secure: false,
      },
      '/help': {
        target: 'https://dreamland.rocks',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
