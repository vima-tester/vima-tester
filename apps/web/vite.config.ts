import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  // `@vima/protocol` is a linked workspace package (dual CJS/ESM). Pre-bundling
  // it keeps Vite's dev server from re-optimizing on every reload.
  optimizeDeps: {
    include: ['@vima/protocol'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
