import { defineConfig } from 'vite';

// Standalone build: three.js bundled, for <script> drop-in usage without a bundler.
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: 'src/index.js',
      name: 'DumplingsLoader',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'dumplings-loader.standalone.js' : 'dumplings-loader.standalone.iife.js'),
    },
    sourcemap: true,
  },
});
