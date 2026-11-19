import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { v } from './validate'
import { changePasswordSchema, loginSchema, registerSchema, updateMeSchema } from '../shared/schemas'
import type { ApiMe } from '../shared/types'
import { fail, hashPassword, nowIso, randomToken, sha256Hex, toApiUser, verifyPassword, type AppEnv, type UserRow } from './lib'

const SESSION_DAYS = 30

async function createSession(db: D1Database, userId: string) {
  const token = randomToken()
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  await db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)').bind(await sha256Hex(token), userId, expires).run()
  return token
}

function bearer(header: string | undefined) {
  const m = header?.match(/^Bearer\s+(.+)$/i)
  return m?.[1]
}

/** Exige sesión válida y deja el usuario en c.get('user'). */
export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  const token = bearer(c.req.header('Authorization'))
  if (!token) fail(401, 'Inicia sesión para continuar')
  const user = await c.env.DB.prepare(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(await sha256Hex(token), nowIso())
    .first<UserRow>()
  if (!user) fail(401, 'Tu sesión expiró. Inicia sesión de nuevo')
  if (user.disabled) fail(403, 'Tu cuenta está desactivada. Contacta al equipo de ARASK')
  c.set('user', user)
  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('user').role !== 'admin') fail(403, 'Solo los administradores pueden hacer esto')
  await next()
})

const isAdminEmail = (env: Env, email: string) =>
  (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase())

export const auth = new Hono<AppEnv>()

auth.post('/register', v('json', registerSchema), async (c) => {
  const { name, email, password } = c.req.valid('json')
  const exists = await c.env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first()
  if (exists) fail(409, 'Ya existe una cuenta con ese correo')
  const { hash, salt } = await hashPassword(password)
  const id = crypto.randomUUID()
  const role = isAdminEmail(c.env, email) ? 'admin' : 'user'
  await c.env.DB.prepare('INSERT INTO users (id, email, name, password_hash, password_salt, role) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(id, email, name, hash, salt, role)
    .run()
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
  return c.json({ token: await createSession(c.env.DB, id), user: toApiUser(user!) }, 201)
})

auth.post('/login', v('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first<UserRow>()
  if (!user || !(await verifyPassword(password, user.password_hash, user.password_salt))) fail(401, 'Correo o contraseña incorrectos')
  if (user.disabled) fail(403, 'Tu cuenta está desactivada. Contacta al equipo de ARASK')
  // Promueve a admin si su correo está en ADMIN_EMAILS
  if (user.role !== 'admin' && isAdminEmail(c.env, email)) {
    await c.env.DB.prepare("UPDATE users SET role = 'admin' WHERE id = ?").bind(user.id).run()
    user.role = 'admin'
  }
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at <= ?').bind(user.id, nowIso()).run()
  return c.json({ token: await createSession(c.env.DB, user.id), user: toApiUser(user) })
})

auth.post('/logout', async (c) => {
  const token = bearer(c.req.header('Authorization'))
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run()
  return c.json({ ok: true })
})

/* ---------- Perfil propio ---------- */

export const me = new Hono<AppEnv>()
me.use(requireUser)

me.get('/', async (c) => {
  const u = c.get('user')
  const row = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM cases WHERE reporter_id = ?1) AS reports,
       (SELECT COUNT(*) FROM case_helpers WHERE user_id = ?1) AS helping,
       (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE user_id = ?1) AS donated,
       (SELECT COUNT(*) FROM notifications WHERE user_id = ?1 AND read = 0) AS unread`,
  )
    .bind(u.id)
    .first<{ reports: number; helping: number; donated: number; unread: number }>()
  const body: ApiMe = { ...toApiUser(u), ...row! }
  return c.json(body)
})

me.patch('/', v('json', updateMeSchema), async (c) => {
  const u = c.get('user')
  const { name, avatarKey } = c.req.valid('json')
  if (avatarKey && !avatarKey.startsWith(`u/${u.id}/`)) fail(400, 'Foto no válida')
  await c.env.DB.prepare('UPDATE users SET name = COALESCE(?, name), avatar_key = CASE WHEN ? THEN ? ELSE avatar_key END WHERE id = ?')
    .bind(name ?? null, avatarKey !== undefined ? 1 : 0, avatarKey ?? null, u.id)
    .run()
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first<UserRow>()
  return c.json(toApiUser(user!))
})

me.post('/password', v('json', changePasswordSchema), async (c) => {
  const u = c.get('user')
  const { current, next } = c.req.valid('json')
  if (!(await verifyPassword(current, u.password_hash, u.password_salt))) fail(400, 'La contraseña actual no es correcta')
  const { hash, salt } = await hashPassword(next)
  await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, u.id).run()
  // Cierra las demás sesiones
  const token = bearer(c.req.header('Authorization'))!
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?').bind(u.id, await sha256Hex(token)).run()
  return c.json({ ok: true })
})
