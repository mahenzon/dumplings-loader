import { defineConfig } from 'vite';

// Library build: three.js (and react for the ./react entry) are peer dependencies,
// tree-shaken by the consumer's bundler. Shared code lands in dist/chunks/.
export default defineConfig({
  build: {
    lib: {
      entry: {
        'dumplings-loader': 'src/index.js',
        'dumplings-loader.react': 'src/react.js',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      external: ['three', /^three\//, 'react', /^react\//],
      output: {
        chunkFileNames: 'chunks/[name].js',
        // Next.js App Router: the wrapper uses refs/effects, so it must be a client component.
        banner: (chunk) => (chunk.name === 'dumplings-loader.react' ? "'use client';" : ''),
      },
    },
    sourcemap: true,
  },
});
