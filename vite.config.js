import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Aceitar qualquer host (necessário para ngrok)
    allowedHosts: true,
    hmr: false,
  },
})

