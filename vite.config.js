import { defineConfig } from 'vite';

// Library build: three.js is a peer dependency (tree-shaken by the consumer's bundler).
export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: () => 'dumplings-loader.js',
    },
    rollupOptions: {
      external: ['three', /^three\//],
    },
    sourcemap: true,
  },
});
