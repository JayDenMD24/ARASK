import { Hono } from 'hono'
import { v } from './validate'
import { z } from 'zod'
import { donationSchema } from '../shared/schemas'
import type { ApiCampaign, ApiDonation, ApiNotification, ApiStats } from '../shared/types'
import { requireUser } from './auth'
import { fail, notify, photoUrl, type AppEnv } from './lib'

const MAX_UPLOAD = 4 * 1024 * 1024
const IMAGE_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/* ---------- Fotos (R2) ---------- */

export const uploads = new Hono<AppEnv>()
uploads.use(requireUser)
uploads.post('/', async (c) => {
  const type = (c.req.header('Content-Type') ?? '').split(';')[0]!.trim()
  const ext = IMAGE_TYPES[type]
  if (!ext) fail(400, 'Solo se aceptan imágenes JPG, PNG o WebP')
  const len = Number(c.req.header('Content-Length') ?? 0)
  if (len > MAX_UPLOAD) fail(413, 'La foto pesa demasiado (máx. 4 MB)')
  const body = await c.req.arrayBuffer()
  if (body.byteLength === 0) fail(400, 'La foto está vacía')
  if (body.byteLength > MAX_UPLOAD) fail(413, 'La foto pesa demasiado (máx. 4 MB)')
  const key = `u/${c.get('user').id}/${crypto.randomUUID()}.${ext}`
  await c.env.PHOTOS.put(key, body, { httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' } })
  return c.json({ key, url: photoUrl(key) }, 201)
})

/** Las fotos son públicas (animales y avatares) para que <img> las cargue sin token. */
export const photos = new Hono<AppEnv>()
photos.get('/*', async (c) => {
  const key = c.req.path.replace(/^\/api\/photos\//, '')
  if (!/^u\/[\w-]+\/[\w-]+\.(jpg|png|webp)$/.test(key)) fail(404, 'No encontrada')
  const obj = await c.env.PHOTOS.get(key)
  if (!obj) fail(404, 'No encontrada')
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('ETag', obj.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  return new Response(obj.body, { headers })
})

/* ---------- Campaña y donaciones (simuladas) ---------- */

export async function activeCampaign(db: D1Database): Promise<ApiCampaign | null> {
  const row = await db
    .prepare(
      `SELECT k.*, COALESCE(SUM(d.amount), 0) AS raised, COUNT(DISTINCT d.user_id) AS donors
       FROM campaigns k LEFT JOIN donations d ON d.campaign_id = k.id
       WHERE k.active = 1 GROUP BY k.id ORDER BY k.id DESC LIMIT 1`,
    )
    .first<{ id: number; title: string; goal: number; starts_at: string; ends_at: string; raised: number; donors: number }>()
  if (!row) return null
  return { id: row.id, title: row.title, goal: row.goal, raised: row.raised, donors: row.donors, startsAt: row.starts_at, endsAt: row.ends_at }
}

export const donations = new Hono<AppEnv>()
donations.use(requireUser)

donations.get('/campaign', async (c) => c.json(await activeCampaign(c.env.DB)))

donations.get('/mine', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.*, k.name AS case_name FROM donations d LEFT JOIN cases k ON k.id = d.case_id
     WHERE d.user_id = ? ORDER BY d.created_at DESC LIMIT 200`,
  )
    .bind(c.get('user').id)
    .all<{ id: number; amount: number; frequency: 'unica' | 'mensual'; destination: string; method: string; case_id: number | null; case_name: string | null; created_at: string }>()
  const out: ApiDonation[] = results.map((d) => ({
    id: d.id,
    amount: d.amount,
    frequency: d.frequency,
    destination: d.destination,
    method: d.method,
    caseId: d.case_id,
    caseName: d.case_name,
    createdAt: d.created_at,
  }))
  return c.json(out)
})

donations.post('/', v('json', donationSchema), async (c) => {
  const user = c.get('user')
  const b = c.req.valid('json')
  let campaignId: number | null = null
  if (b.caseId) {
    const kase = await c.env.DB.prepare('SELECT id, name, reporter_id FROM cases WHERE id = ? AND hidden = 0').bind(b.caseId).first<{ id: number; name: string; reporter_id: string }>()
    if (!kase) fail(404, 'El caso no existe')
    const helpers = await c.env.DB.prepare('SELECT user_id FROM case_helpers WHERE case_id = ?').bind(kase.id).all<{ user_id: string }>()
    await notify(
      c.env.DB,
      [kase.reporter_id, ...helpers.results.map((h) => h.user_id)],
      { type: 'donation', title: `Nueva donación para ${kase.name}`, body: `${user.name} aportó al fondo del caso.`, caseId: kase.id },
      user.id,
    )
  } else {
    campaignId = (await activeCampaign(c.env.DB))?.id ?? null
  }
  await c.env.DB.prepare('INSERT INTO donations (user_id, case_id, campaign_id, amount, frequency, destination, method) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(user.id, b.caseId ?? null, campaignId, b.amount, b.frequency, b.destination, b.method)
    .run()
  return c.json({ ok: true }, 201)
})

/* ---------- Notificaciones ---------- */

export const notifications = new Hono<AppEnv>()
notifications.use(requireUser)

notifications.get('/', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50')
    .bind(c.get('user').id)
    .all<{ id: number; type: string; title: string; body: string; case_id: number | null; read: number; created_at: string }>()
  const out: ApiNotification[] = results.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, caseId: n.case_id, read: Boolean(n.read), createdAt: n.created_at }))
  return c.json(out)
})

notifications.post('/read', v('json', z.object({ ids: z.array(z.number().int()).max(100).optional() })), async (c) => {
  const { ids } = c.req.valid('json')
  const uid = c.get('user').id
  if (ids?.length) {
    await c.env.DB.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`).bind(uid, ...ids).run()
  } else {
    await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').bind(uid).run()
  }
  return c.json({ ok: true })
})

/* ---------- Indicadores comunitarios ---------- */

export const stats = new Hono<AppEnv>()
stats.use(requireUser)
stats.get('/', async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT COUNT(*) AS censados,
       COALESCE(SUM(status != 'reportado'), 0) AS atendidos,
       COALESCE(SUM(status = 'adopcion'), 0) AS adopciones,
       (SELECT COUNT(DISTINCT user_id) FROM case_helpers) AS voluntarios
     FROM cases WHERE hidden = 0`,
  ).first<ApiStats>()
  return c.json(row)
})
