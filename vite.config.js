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

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Store-only zip of { name, data } entries (mp3 doesn't compress, so no deflate). */
function makeZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + data.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

/** Emit build/sounds/dreamland-sounds.zip: the whole public/sounds tree, same paths as the
 * MSP !!SOUND names (chat/tell.mp3), for telnet clients that play MSP from a local folder. */
function emitSoundpack() {
  const root = path.resolve(__dirname, 'public/sounds');
  return {
    name: 'dl-emit-soundpack',
    generateBundle() {
      const entries = [];
      const walk = (dir) => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          const full = path.join(dir, ent.name);
          if (ent.isDirectory()) walk(full);
          else entries.push({ name: path.relative(root, full).split(path.sep).join('/'), data: fs.readFileSync(full) });
        }
      };
      if (!fs.existsSync(root)) return;
      walk(root);
      this.emitFile({ type: 'asset', fileName: 'sounds/dreamland-sounds.zip', source: makeZip(entries) });
    },
  };
}

export default defineConfig({
  plugins: [react(), devMapperGraph(), emitVersion(), emitSoundpack()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  base: '/play/', // production web client; nginx serves /var/www/mudjs/build at /play (was /mudjs)
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
      '/data': {
        target: 'https://dreamland.rocks',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
