import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Local API for `vite` / `vite preview`; the Playwright suite points it at its own throwaway server.
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:7341';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: true,
    port: 7340,
    strictPort: true,
    allowedHosts: ['crm_f.thegradlew.info', 'crm_b.thegradlew.info', '.thegradlew.info'],
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  preview: {
    host: true,
    port: 7340,
    strictPort: true,
    allowedHosts: ['crm_f.thegradlew.info', 'crm_b.thegradlew.info', '.thegradlew.info'],
    proxy: { '/api': { target: apiTarget, changeOrigin: true } },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('recharts') || id.includes('d3-')) return 'charts';
        },
      },
    },
  },
});
