import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Aceitar qualquer host (necessário para ngrok)
    allowedHosts: true,
    // Desabilitar HMR completamente para evitar reloads infinitos via ngrok.
    // O WebSocket do HMR não sobrevive ao túnel e causa reconexão em loop.
    // Sem HMR, a página carrega uma vez e fica estável.
    // Para ver mudanças no código, basta dar F5 manualmente.
    hmr: false,
  },
})

