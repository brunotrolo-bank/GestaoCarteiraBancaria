import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Build para o Apps Script (HtmlService): um único bundle, fontes embutidas como data URI, caminhos relativos.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
