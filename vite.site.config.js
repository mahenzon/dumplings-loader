import { defineConfig } from 'vite';

// Demo site build (GitHub Pages). BASE_PATH is "/<repo-name>/" on project pages, "/" on user pages.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: {
    outDir: 'site',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        standalone: 'examples/standalone.html',
      },
    },
  },
});
