import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// El plugin de Cloudflare ejecuta el Worker (API + D1 + R2 locales) junto con Vite.
export default defineConfig({
  plugins: [react(), cloudflare()],
})
