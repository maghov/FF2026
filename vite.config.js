import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/FF2026/',
  server: {
    proxy: {
      '/fpl-api': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fpl-api/, ''),
        secure: true,
      },
    },
  },
})
