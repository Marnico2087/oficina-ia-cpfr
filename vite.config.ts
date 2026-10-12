import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'public-demo' ? '/agent-office/' : '/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Keep the mostly stable 3D engine separate from office UI changes.
        // Splitting larger modules also lets browsers download smaller chunks in parallel.
        codeSplitting: {
          groups: [{ name: 'three-engine', test: /node_modules[\\/]three[\\/]/, maxSize: 330_000 }],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // Live Codex jobs write private fixtures here; Windows may lock these files
    // while Chrome or the CLI is using them. They are never front-end sources.
    watch: { ignored: ['**/.local/**', '**/work/**'] },
    proxy: { '/api': 'http://127.0.0.1:4300' },
  },
}))
