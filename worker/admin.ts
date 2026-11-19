import { Hono } from 'hono'
import { v } from './validate'
import { z } from 'zod'
import { adminCaseUpdateSchema, adminUserUpdateSchema, campaignSchema } from '../shared/schemas'
import type { AdminStats, AdminUserRow } from '../shared/types'
import { requireAdmin, requireUser } from './auth'
import { toApiCase } from './cases'
import { activeCampaign } from './misc'
import { caseAudience, fail, hashPassword, notify, nowIso, randomToken, toApiUser, type AppEnv, type UserRow } from './lib'

export const admin = new Hono<AppEnv>()
admin.use(requireUser, requireAdmin)

const idParam = v('param', z.object({ id: z.coerce.number().int().positive() }))

/* ---------- Usuarios ---------- */

admin.get('/users', async (c) => {
  const q = `%${(c.req.query('q') ?? '').trim()}%`
  const { results } = await c.env.DB.prepare(
    `SELECT u.*,
       (SELECT COUNT(*) FROM cases WHERE reporter_id = u.id) AS reports,
       (SELECT COUNT(*) FROM case_helpers WHERE user_id = u.id) AS helping,
       (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE user_id = u.id) AS donated
     FROM users u WHERE u.name LIKE ?1 OR u.email LIKE ?1 ORDER BY u.created_at DESC LIMIT 200`,
  )
    .bind(q)
    .all<UserRow & { reports: number; helping: number; donated: number }>()
  const out: AdminUserRow[] = results.map((u) => ({ ...toApiUser(u), reports: u.reports, helping: u.helping, donated: u.donated }))
  return c.json(out)
})

admin.patch('/users/:id', v('json', adminUserUpdateSchema), async (c) => {
  const id = c.req.param('id')
  const me = c.get('user')
  const b = c.req.valid('json')
  if (id === me.id && (b.role === 'user' || b.disabled)) fail(400, 'No puedes quitarte el rol de admin ni desactivar tu propia cuenta')
  const target = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
  if (!target) fail(404, 'Usuario no encontrado')
  await c.env.DB.prepare(
    'UPDATE users SET role = COALESCE(?, role), verified = COALESCE(?, verified), disabled = COALESCE(?, disabled) WHERE id = ?',
  )
    .bind(b.role ?? null, b.verified === undefined ? null : Number(b.verified), b.disabled === undefined ? null : Number(b.disabled), id)
    .run()
  if (b.disabled) await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  if (b.verified && !target.verified) {
    await notify(c.env.DB, [id], { type: 'verified', title: '¡Eres rescatista verificado!', body: 'El equipo de ARASK verificó tu cuenta.' })
  }
  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>()
  return c.json(toApiUser(updated!))
})

/** Genera una contraseña temporal (se muestra una sola vez al admin). */
admin.post('/users/:id/reset-password', async (c) => {
  const id = c.req.param('id')
  const temp = randomToken(6).replace(/[-_]/g, 'x')
  const { hash, salt } = await hashPassword(temp)
  const res = await c.env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, id).run()
  if (!res.meta.changes) fail(404, 'Usuario no encontrado')
  await c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run()
  return c.json({ tempPassword: temp })
})

/* ---------- Moderación de casos ---------- */

admin.get('/cases', async (c) => {
  const filter = c.req.query('filter') ?? 'flagged'
  const where: Record<string, string> = {
    flagged: 'EXISTS (SELECT 1 FROM case_flags f WHERE f.case_id = c.id) AND c.hidden = 0',
    hidden: 'c.hidden = 1',
    unverified: 'c.verified = 0 AND c.hidden = 0',
    all: '1 = 1',
  }
  const user = c.get('user')
  const { results } = await c.env.DB.prepare(
    `SELECT c.*, u.name AS reporter_name, u.avatar_key AS reporter_avatar, u.verified AS reporter_verified,
      (SELECT json_group_array(key) FROM (SELECT key FROM case_photos p WHERE p.case_id = c.id ORDER BY position)) AS photos,
      (SELECT json_group_array(json_object('need', need, 'detail', detail, 'state', state)) FROM case_needs n WHERE n.case_id = c.id) AS needs,
      (SELECT COUNT(*) FROM case_helpers h WHERE h.case_id = c.id) AS helpers_count,
      (SELECT COALESCE(SUM(amount), 0) FROM donations d WHERE d.case_id = c.id) AS raised,
      0 AS saved, NULL AS my_help,
      (SELECT COUNT(*) FROM case_flags f WHERE f.case_id = c.id) AS flags_count,
      (SELECT json_group_object(reason, n) FROM (SELECT reason, COUNT(*) AS n FROM case_flags f WHERE f.case_id = c.id GROUP BY reason)) AS flag_reasons
     FROM cases c JOIN users u ON u.id = c.reporter_id
     WHERE ${where[filter] ?? where.flagged}
     ORDER BY flags_count DESC, c.created_at DESC LIMIT 200`,
  ).all()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json(results.map((r: any) => ({ ...toApiCase(r, user), flagReasons: JSON.parse(r.flag_reasons ?? '{}') as Record<string, number> })))
})

admin.patch('/cases/:id', idParam, v('json', adminCaseUpdateSchema), async (c) => {
  const { id } = c.req.valid('param')
  const b = c.req.valid('json')
  const kase = await c.env.DB.prepare('SELECT id, name, reporter_id FROM cases WHERE id = ?').bind(id).first<{ id: number; name: string; reporter_id: string }>()
  if (!kase) fail(404, 'Caso no encontrado')
  await c.env.DB.prepare(
    `UPDATE cases SET hidden = COALESCE(?, hidden), hidden_reason = CASE WHEN ? THEN ? ELSE hidden_reason END,
       verified = COALESCE(?, verified), updated_at = ? WHERE id = ?`,
  )
    .bind(
      b.hidden === undefined ? null : Number(b.hidden),
      b.hiddenReason !== undefined ? 1 : 0,
      b.hiddenReason ?? null,
      b.verified === undefined ? null : Number(b.verified),
      nowIso(),
      id,
    )
    .run()
  if (b.hidden === false) await c.env.DB.prepare('DELETE FROM case_flags WHERE case_id = ?').bind(id).run()
  if (b.hidden) {
    await notify(c.env.DB, [kase.reporter_id], {
      type: 'moderation',
      title: `Tu reporte «${kase.name}» fue retirado`,
      body: b.hiddenReason || 'El equipo de moderación lo marcó como falso o duplicado.',
      caseId: id,
    })
  }
  if (b.verified) {
    await notify(c.env.DB, await caseAudience(c.env.DB, id), { type: 'verified', title: `${kase.name} fue verificado`, body: 'El equipo de ARASK confirmó este reporte.', caseId: id })
  }
  return c.json({ ok: true })
})

admin.delete('/cases/:id/flags', idParam, async (c) => {
  const { id } = c.req.valid('param')
  await c.env.DB.prepare('DELETE FROM case_flags WHERE case_id = ?').bind(id).run()
  return c.json({ ok: true })
})

admin.delete('/cases/:id', idParam, async (c) => {
  const { id } = c.req.valid('param')
  const { results } = await c.env.DB.prepare('SELECT key FROM case_photos WHERE case_id = ?').bind(id).all<{ key: string }>()
  await c.env.DB.prepare('DELETE FROM cases WHERE id = ?').bind(id).run()
  if (results.length) await c.env.PHOTOS.delete(results.map((r) => r.key))
  return c.json({ ok: true })
})

/* ---------- Estadísticas para el panel ---------- */

admin.get('/stats', async (c) => {
  const db = c.env.DB
  const [totals, byZone, byStatus, byCondition, byMonth, points] = await db.batch([
    db.prepare(
      `SELECT (SELECT COUNT(*) FROM cases) AS cases,
         (SELECT COUNT(*) FROM cases WHERE hidden = 0 AND status IN ('reportado','en_atencion')) AS open,
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM donations) AS donations,
         (SELECT COALESCE(SUM(amount), 0) FROM donations) AS donated,
         (SELECT COUNT(DISTINCT case_id) FROM case_flags) AS flagged,
         (SELECT COUNT(*) FROM cases WHERE hidden = 1) AS hidden`,
    ),
    db.prepare(`SELECT zone, COUNT(*) AS total, SUM(status IN ('reportado','en_atencion')) AS open FROM cases WHERE hidden = 0 GROUP BY zone ORDER BY total DESC`),
    db.prepare('SELECT status, COUNT(*) AS total FROM cases WHERE hidden = 0 GROUP BY status'),
    db.prepare('SELECT condition, COUNT(*) AS total FROM cases WHERE hidden = 0 GROUP BY condition'),
    db.prepare(`SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS total FROM cases WHERE hidden = 0 GROUP BY month ORDER BY month DESC LIMIT 6`),
    db.prepare('SELECT lat, lng, condition, status FROM cases WHERE hidden = 0 ORDER BY created_at DESC LIMIT 1000'),
  ])
  const body: AdminStats = {
    totals: totals!.results[0] as AdminStats['totals'],
    byZone: byZone!.results as AdminStats['byZone'],
    byStatus: byStatus!.results as AdminStats['byStatus'],
    byCondition: byCondition!.results as AdminStats['byCondition'],
    byMonth: (byMonth!.results as AdminStats['byMonth']).reverse(),
    points: points!.results as AdminStats['points'],
  }
  return c.json(body)
})

/* ---------- Campaña ---------- */

admin.put('/campaign', v('json', campaignSchema), async (c) => {
  const b = c.req.valid('json')
  if (new Date(b.endsAt) <= new Date(b.startsAt)) fail(400, 'La fecha final debe ser posterior a la inicial')
  const current = await activeCampaign(c.env.DB)
  if (current) {
    await c.env.DB.prepare('UPDATE campaigns SET title = ?, goal = ?, starts_at = ?, ends_at = ? WHERE id = ?').bind(b.title, b.goal, b.startsAt, b.endsAt, current.id).run()
  } else {
    await c.env.DB.prepare('INSERT INTO campaigns (title, goal, starts_at, ends_at, active) VALUES (?, ?, ?, ?, 1)').bind(b.title, b.goal, b.startsAt, b.endsAt).run()
  }
  return c.json(await activeCampaign(c.env.DB))
})
