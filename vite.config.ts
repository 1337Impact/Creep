import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

/** Chrome content scripts must be ASCII-only; Rollup has no charset option. */
function toAscii() {
  return {
    name: 'to-ascii',
    generateBundle(_: unknown, bundle: Record<string, { type: string; code?: string }>) {
      for (const fileName in bundle) {
        const chunk = bundle[fileName];
        if (chunk.type === 'chunk' && chunk.code) {
          chunk.code = chunk.code
            .split('')
            .map((ch) =>
              ch.charCodeAt(0) <= 0x7f
                ? ch
                : '\\u' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4)
            )
            .join('');
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  esbuild: {
    charset: 'ascii',
  },
  build: {
    rollupOptions: {
      plugins: [toAscii()],
    },
  },
});
