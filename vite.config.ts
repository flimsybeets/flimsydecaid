/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  // Relative asset paths: Decaid serves the skin from the root of its own
  // origin today, but relative paths also survive being served from a subfolder.
  base: './',
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.SKIN_VERSION?.replace(/^v/, '') || pkg.version),
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
