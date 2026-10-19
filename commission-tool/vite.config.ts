import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'preact' },
  plugins: [viteSingleFile({ removeViteModuleLoader: true })],
  build: {
    target: ['es2020', 'chrome87', 'edge88', 'firefox78', 'safari14'],
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 4096,
    cssCodeSplit: false,
    reportCompressedSize: false,
  },
});
