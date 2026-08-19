import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

const alias = {
  /*
   * `server-only` is a build-time guard, not runtime behaviour: Next swaps it for an empty
   * module in a server build and lets it throw everywhere else. Vitest is a server-side
   * environment, so it gets the same empty module — otherwise nothing under apps/web/lib
   * could be unit tested at all.
   */
  'server-only': path.resolve(root, 'node_modules/next/dist/compiled/server-only/empty.js'),
  // Subpath before barrel: aliases are matched by prefix, first hit wins.
  '@assistigo/core/privacy/crypto': path.resolve(root, 'packages/core/src/privacy/crypto.ts'),
  '@assistigo/core': path.resolve(root, 'packages/core/src/index.ts'),
  '@assistigo/ai': path.resolve(root, 'packages/ai/src/index.ts'),
  '@assistigo/form-engine/types': path.resolve(root, 'packages/form-engine/src/types.ts'),
  '@assistigo/form-engine/safety': path.resolve(root, 'packages/form-engine/src/safety.ts'),
  '@assistigo/form-engine': path.resolve(root, 'packages/form-engine/src/index.ts'),
  '@assistigo/document-tools': path.resolve(root, 'packages/document-tools/src/index.ts'),
  '@assistigo/database': path.resolve(root, 'packages/database/src/index.ts'),
  '@assistigo/ui': path.resolve(root, 'packages/ui/src/index.ts'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    environment: 'node',
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['packages/*/src/**/*.test.ts', 'apps/web/lib/**/*.test.ts'],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'rls',
          globals: true,
          environment: 'node',
          include: ['packages/database/rls-tests/**/*.test.ts'],
          // RLS tests talk to a live local Supabase; keep them serial.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'extension',
          globals: true,
          environment: 'jsdom',
          include: ['apps/extension/tests/**/*.test.ts'],
        },
      },
    ],
  },
});
