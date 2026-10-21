import { defineConfig } from 'vite';

// vitest config of scripts/inspect.mjs: the same resolution as the tests,
// a different file, so `npm run check` never runs it.
export default defineConfig({
  test: { include: ['scripts/inspect.vitest.ts'], testTimeout: 600000 },
});
