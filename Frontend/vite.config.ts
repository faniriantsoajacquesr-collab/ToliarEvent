import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Partage les variables VITE_* avec le backend (évite un .env dupliqué)
  envDir: path.resolve(__dirname, '../Backend'),
})
