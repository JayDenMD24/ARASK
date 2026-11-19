import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { HTTPException } from 'hono/http-exception'
import { admin } from './admin'
import { auth, me } from './auth'
import { cases } from './cases'
import type { AppEnv } from './lib'
import { donations, notifications, photos, stats, uploads } from './misc'

const app = new Hono<AppEnv>().basePath('/api')

// CORS: necesario para la app Android (origen https://localhost) que llama a la API desplegada.
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next)
})

app.get('/health', (c) => c.json({ ok: true, service: 'arask' }))
app.route('/auth', auth)
app.route('/me', me)
app.route('/cases', cases)
app.route('/uploads', uploads)
app.route('/photos', photos)
app.route('/donations', donations)
app.route('/notifications', notifications)
app.route('/stats', stats)
app.route('/admin', admin)

app.notFound((c) => c.json({ error: 'Ruta no encontrada' }, 404))

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    // Errores de validación de Zod llegan como 400 con el detalle en la respuesta
    return c.json({ error: err.message || 'Solicitud no válida' }, err.status)
  }
  console.error(err)
  return c.json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' }, 500)
})

export default app
