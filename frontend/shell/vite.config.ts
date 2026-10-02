import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Proxy /api → API local (apps/api, porta 3001): o front nunca fala direto com a planilha.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:3001', changeOrigin: true } } },
  preview: { port: 4173, proxy: { '/api': { target: process.env.API_URL ?? 'http://localhost:3001', changeOrigin: true } } },
  build: { chunkSizeWarningLimit: 900 },
});
