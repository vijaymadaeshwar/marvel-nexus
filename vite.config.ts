import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        entryFileNames: 'assets/nexus-main.js',
        chunkFileNames: 'assets/nexus-[name].js',
        assetFileNames: 'assets/nexus-[name].[ext]',
        manualChunks: {
          idb: ['idb'],
        },
      },
    },
    minify: 'esbuild',
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
    open: true,
  },
  css: {
    devSourcemap: true,
  },
});
