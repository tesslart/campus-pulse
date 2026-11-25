import { defineConfig } from 'vite';

// base: './' — относительные пути, чтобы сайт работал на
// https://<username>.github.io/<repository>/ без 404 на JS/CSS.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', sourcemap: false },
});
