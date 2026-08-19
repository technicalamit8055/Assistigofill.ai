import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

/**
 * The content script, as a single self-contained IIFE.
 *
 * `emptyOutDir: false` because this runs after the main build and must not wipe it.
 */
export default defineConfig({
  root,
  publicDir: false,
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
    emptyOutDir: false,
    target: 'chrome116',
    sourcemap: false,
    lib: {
      entry: path.resolve(root, 'src/content/index.ts'),
      name: 'AssistigoContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
  },
});
