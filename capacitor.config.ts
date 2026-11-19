import type { CapacitorConfig } from '@capacitor/cli'

// La app Android empaqueta la build de "npm run build:mobile" (dist/client)
// y consume la API desplegada en Cloudflare (VITE_API_URL en .env.mobile).
const config: CapacitorConfig = {
  appId: 'co.edu.unisinu.arask',
  appName: 'ARASK',
  webDir: 'dist/client',
  android: {
    backgroundColor: '#fcf9f4',
  },
}

export default config
