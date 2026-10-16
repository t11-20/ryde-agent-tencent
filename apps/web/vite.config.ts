import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': { target: `http://127.0.0.1:${process.env['FAIRTRIP_API_PORT'] ?? '3001'}`, changeOrigin: true } },
  },
  build: {
    rolldownOptions: {
      input: {
        index: fileURLToPath(new URL('./index.html', import.meta.url)),
        classic: fileURLToPath(new URL('./classic.html', import.meta.url)),
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
