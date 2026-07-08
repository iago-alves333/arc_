import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Aceitar qualquer host (ngrok gera subdomínios diferentes)
    allowedHosts: true,
    // Desabilitar HMR — via ngrok o WebSocket do HMR causa reloads constantes.
    // Os alunos não precisam de hot-reload; para dev local, comente esta linha.
    hmr: false,
  },
})

