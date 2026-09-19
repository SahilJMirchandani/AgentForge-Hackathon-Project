import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: 'src/setupTests.js',
  },
})
