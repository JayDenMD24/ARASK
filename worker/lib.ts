import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ApiUser, PersonLite, Role } from '../shared/types'

export interface UserRow {
  id: string
  email: string
  name: string
  password_hash: string
  password_salt: string
  role: Role
  avatar_key: string | null
  verified: number
  disabled: number
  created_at: string
}

export type AppEnv = { Bindings: Env; Variables: { user: UserRow } }
export type Ctx = Context<AppEnv>

export const nowIso = () => new Date().toISOString()

export function fail(status: 400 | 401 | 403 | 404 | 409 | 413 | 429, message: string): never {
  throw new HTTPException(status, { message })
}

export const photoUrl = (key: string | null | undefined) => (key ? `/api/photos/${key}` : null)

export function toApiUser(u: UserRow): ApiUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    avatarUrl: photoUrl(u.avatar_key),
    verified: Boolean(u.verified),
    disabled: Boolean(u.disabled),
    createdAt: u.created_at,
  }
}

export function person(id: string | null, name: string, avatarKey: string | null, verified: number | boolean): PersonLite {
  return { id, name, avatarUrl: photoUrl(avatarKey), verified: Boolean(verified) }
}

/* ---------- Criptografía (Web Crypto, disponible en Workers) ---------- */

const enc = new TextEncoder()
const PBKDF2_ITERATIONS = 100_000 // máximo admitido por Workers

function toHex(buf: ArrayBuffer | Uint8Array) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
function fromHex(hex: string) {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}
function randomBytes(n: number) {
  return crypto.getRandomValues(new Uint8Array(n))
}
export function randomToken(bytes = 32) {
  return btoa(String.fromCharCode(...randomBytes(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function pbkdf2(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256)
  return new Uint8Array(bits)
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  return { hash: toHex(await pbkdf2(password, salt)), salt: toHex(salt) }
}

export async function verifyPassword(password: string, hashHex: string, saltHex: string) {
  const actual = await pbkdf2(password, fromHex(saltHex))
  const expected = fromHex(hashHex)
  if (actual.byteLength !== expected.byteLength) return false
  return crypto.subtle.timingSafeEqual(actual, expected)
}

export async function sha256Hex(text: string) {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/* ---------- Notificaciones ---------- */

export async function notify(
  db: D1Database,
  userIds: Iterable<string>,
  n: { type: string; title: string; body: string; caseId?: number | null },
  exclude?: string,
) {
  const ids = [...new Set(userIds)].filter((id) => id && id !== exclude)
  if (!ids.length) return
  const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, body, case_id) VALUES (?, ?, ?, ?, ?)')
  await db.batch(ids.map((id) => stmt.bind(id, n.type, n.title, n.body, n.caseId ?? null)))
}

/** Personas interesadas en un caso: quien reportó, rescatistas y quienes lo guardaron. */
export async function caseAudience(db: D1Database, caseId: number) {
  const { results } = await db
    .prepare(
      `SELECT reporter_id AS id FROM cases WHERE id = ?1
       UNION SELECT user_id FROM case_helpers WHERE case_id = ?1
       UNION SELECT user_id FROM saved_cases WHERE case_id = ?1`,
    )
    .bind(caseId)
    .all<{ id: string }>()
  return results.map((r) => r.id)
}
