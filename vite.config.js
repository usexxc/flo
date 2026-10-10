import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 8140,
    host: '127.0.0.1',
    strictPort: true,
  },
  preview: {
    port: 8140,
    host: '127.0.0.1',
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
