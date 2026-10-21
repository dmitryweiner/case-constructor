import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Three.js is most of the main chunk and changes twice a year, our code
    // changes on every deploy: a separate chunk lets a returning visitor
    // reuse the cached one. Not about weight — both load before first frame.
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          return id.includes('node_modules/three/') ? 'three' : undefined;
        },
      },
    },
    // Above the vendor chunk: we know Three weighs half a megabyte; if OUR
    // code ever does, that is news worth a warning.
    chunkSizeWarningLimit: 600,
  },
  // manifold-3d is a WASM module; pre-bundling breaks the relative path to
  // its .wasm inside the package.
  optimizeDeps: {
    exclude: ['manifold-3d'],
  },
  // CSG lives in a module worker: the manifold glue finds its .wasm through
  // import.meta.url, which an iife worker does not have.
  worker: {
    format: 'es',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000,
  },
});
