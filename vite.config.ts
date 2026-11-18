import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { serviceWorkerPlugin } from './src/sw-plugin.ts';

/** The package name is the app's id: the service worker's cache prefix (every app on the origin has its own). */
function appId(): string {
  const pkg: unknown = JSON.parse(readFileSync(resolve(import.meta.dirname, 'package.json'), 'utf8'));
  if (typeof pkg === 'object' && pkg !== null && 'name' in pkg && typeof pkg.name === 'string') return pkg.name;
  throw new Error('package.json has no name');
}

export default defineConfig({
  base: './',
  // offline after a first visit: sw.js precaches the build and public/ (_conventions/pwa.md)
  plugins: [serviceWorkerPlugin({ appId: appId(), publicDir: resolve(import.meta.dirname, 'public') })],
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
  // its .wasm inside the package. maker-kit is TypeScript sources, which the
  // pre-bundler's scan reads as JavaScript: Vite serves them as our own.
  optimizeDeps: {
    exclude: ['manifold-3d', 'maker-kit'],
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
    // Node does not strip the types of files in node_modules: the kit's
    // TypeScript sources are transformed as our own.
    server: { deps: { inline: ['maker-kit'] } },
  },
});
