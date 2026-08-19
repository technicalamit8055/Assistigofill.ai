import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * Popup, side panel and service worker.
 *
 * The content script is built separately (vite.content.config.ts) because it must be a single
 * IIFE bundle — content scripts do not support ES modules.
 *
 * Everything is bundled. MV3 forbids remotely hosted code (spec §15.3), so there are no CDN
 * scripts, no dynamic imports from the network, and no eval anywhere in the output.
 */
export default defineConfig({
  root,
  publicDir: path.resolve(root, 'public'),
  plugins: [react()],
  resolve: {
    alias: {
      '@assistigo/core': path.resolve(root, '../../packages/core/src/index.ts'),
      '@assistigo/form-engine/types': path.resolve(root, '../../packages/form-engine/src/types.ts'),
      '@assistigo/form-engine/safety': path.resolve(
        root,
        '../../packages/form-engine/src/safety.ts',
      ),
      '@assistigo/form-engine': path.resolve(root, '../../packages/form-engine/src/index.ts'),
      '@': path.resolve(root, 'src'),
    },
  },
  build: {
    outDir: path.resolve(root, 'dist'),
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: path.resolve(root, 'src/popup/index.html'),
        sidepanel: path.resolve(root, 'src/sidepanel/index.html'),
        background: path.resolve(root, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
