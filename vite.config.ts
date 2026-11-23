import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/** Emit the list of built files so the service worker can precache them for offline play. */
function precacheManifest(): Plugin {
  return {
    name: 'precache-manifest',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => !f.endsWith('.map') && f !== 'index.html')
        .map((f) => `/${f}`);
      this.emitFile({
        type: 'asset',
        fileName: 'precache-manifest.json',
        source: JSON.stringify(files),
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheManifest()],
  build: {
    target: 'es2022',
    sourcemap: true,
    // three.js alone is ~700 kB minified; the scene chunk is lazy-loaded and budgeted by size-limit.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
