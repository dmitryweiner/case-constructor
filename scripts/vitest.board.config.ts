import { defineConfig } from 'vite';

// vitest config of scripts/board.mjs: a different file than the tests.
export default defineConfig({
  test: { include: ['scripts/board.vitest.ts'] },
});
