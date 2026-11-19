import { Hono } from 'hono'
import { v } from './validate'
import { z } from 'zod'
import {
  commentSchema,
  createCaseSchema,
  flagSchema,
  helpSchema,
  needsUpdateSchema,
  statusChangeSchema,
  updateCaseSchema,
} from '../shared/schemas'
import { distanceMeters, zoneFor } from '../shared/geo'
import type { ApiCase, ApiCaseDetail, ApiComment, CaseStatus, DuplicateCandidate, NeedItem } from '../shared/types'
import { requireUser } from './auth'
import { caseAudience, fail, notify, nowIso, person, photoUrl, type AppEnv, type Ctx, type UserRow } from './lib'

const STATUS_LABEL: Record<CaseStatus, string> = {
  reportado: 'Reportado',
  en_atencion: 'En atención',
  rescatado: 'Rescatado',
  adopcion: 'En adopción',
  cerrado: 'Cerrado',
}
const SPECIES_LABEL = { perro: 'Perro', gato: 'Gato', otro: 'Animal' } as const
const REPORTS_PER_HOUR = 5
const DUPLICATE_RADIUS_M = 150
const DUPLICATE_WINDOW_H = 24

interface CaseRow {
  id: number
  name: string
  species: ApiCase['species']
  sex: ApiCase['sex']
  profile: string | null
  condition: ApiCase['condition']
  status: CaseStatus
  description: string
  medical_note: string | null
  lat: number
  lng: number
  address: string
  zone: ApiCase['zone']
  reporter_id: string
  anonymous: number
  verified: number
  hidden: number
  hidden_reason: string | null
  donation_goal: number
  created_at: string
  updated_at: string
  reporter_name: string
  reporter_avatar: string | null
  reporter_verified: number
  photos: string
  needs: string
  helpers_count: number
  raised: number
  saved: number
  my_help: string | null
  flags_count: number
}

/** SELECT con todo lo necesario para una tarjeta de caso (?1 = usuario actual). */
const CASE_SELECT = `
  SELECT c.*, u.name AS reporter_name, u.avatar_key AS reporter_avatar, u.verified AS reporter_verified,
    (SELECT json_group_array(key) FROM (SELECT key FROM case_photos p WHERE p.case_id = c.id ORDER BY position)) AS photos,
    (SELECT json_group_array(json_object('need', need, 'detail', detail, 'state', state)) FROM case_needs n WHERE n.case_id = c.id) AS needs,
    (SELECT COUNT(*) FROM case_helpers h WHERE h.case_id = c.id) AS helpers_count,
    (SELECT COALESCE(SUM(amount), 0) FROM donations d WHERE d.case_id = c.id) AS raised,
    EXISTS (SELECT 1 FROM saved_cases s WHERE s.case_id = c.id AND s.user_id = ?1) AS saved,
    (SELECT help_type FROM case_helpers h WHERE h.case_id = c.id AND h.user_id = ?1) AS my_help,
    (SELECT COUNT(*) FROM case_flags f WHERE f.case_id = c.id) AS flags_count
  FROM cases c JOIN users u ON u.id = c.reporter_id`

const NEED_ORDER = { pendiente: 0, en_camino: 1, cubierto: 2 }

export function toApiCase(r: CaseRow, viewer: UserRow): ApiCase {
  const isAdmin = viewer.role === 'admin'
  const isReporter = r.reporter_id === viewer.id
  const hideReporter = r.anonymous && !isReporter && !isAdmin
  const needs = (JSON.parse(r.needs) as NeedItem[]).sort((a, b) => NEED_ORDER[a.state] - NEED_ORDER[b.state])
  return {
    id: r.id,
    name: r.name,
    species: r.species,
    sex: r.sex,
    profile: r.profile,
    condition: r.condition,
    status: r.status,
    description: r.description,
    medicalNote: r.medical_note,
    lat: r.lat,
    lng: r.lng,
    address: r.address,
    zone: r.zone,
    anonymous: Boolean(r.anonymous),
    verified: Boolean(r.verified),
    hidden: Boolean(r.hidden),
    hiddenReason: r.hidden_reason,
    donationGoal: r.donation_goal,
    donationRaised: r.raised,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    photos: (JSON.parse(r.photos) as string[]).map((k) => photoUrl(k)!),
    needs,
    reporter: hideReporter
      ? { id: null, name: 'Anónimo', avatarUrl: null, verified: false }
      : person(r.reporter_id, r.anonymous ? `${r.reporter_name} (anónimo)` : r.reporter_name, r.reporter_avatar, r.reporter_verified),
    helpersCount: r.helpers_count,
    saved: Boolean(r.saved),
    myHelp: r.my_help,
    isReporter,
    canEdit: isAdmin || isReporter || Boolean(r.my_help),
    flagsCount: isAdmin ? r.flags_count : 0,
  }
}

async function loadCase(c: Ctx, id: number) {
  const user = c.get('user')
  const row = await c.env.DB.prepare(`${CASE_SELECT} WHERE c.id = ?2`).bind(user.id, id).first<CaseRow>()
  if (!row || (row.hidden && user.role !== 'admin' && row.reporter_id !== user.id)) fail(404, 'Este caso no existe o fue retirado')
  return toApiCase(row, user)
}

async function loadEditable(c: Ctx, id: number) {
  const kase = await loadCase(c, id)
  if (!kase.canEdit) fail(403, 'Solo quien reportó, los rescatistas del caso o un admin pueden editarlo')
  return kase
}

const touch = (db: D1Database, id: number) => db.prepare('UPDATE cases SET updated_at = ? WHERE id = ?').bind(nowIso(), id)

const idParam = v('param', z.object({ id: z.coerce.number().int().positive() }))

export const cases = new Hono<AppEnv>()
cases.use(requireUser)

/* Listado: ?scope=all|mine|saved|helping */
cases.get('/', async (c) => {
  const user = c.get('user')
  const scope = c.req.query('scope') ?? 'all'
  const where: Record<string, string> = {
    all: 'c.hidden = 0',
    mine: 'c.reporter_id = ?1',
    saved: 'c.hidden = 0 AND EXISTS (SELECT 1 FROM saved_cases s WHERE s.case_id = c.id AND s.user_id = ?1)',
    helping: 'EXISTS (SELECT 1 FROM case_helpers h WHERE h.case_id = c.id AND h.user_id = ?1)',
  }
  const clause = where[scope] ?? where.all
  const { results } = await c.env.DB.prepare(`${CASE_SELECT} WHERE ${clause} ORDER BY c.created_at DESC LIMIT 300`).bind(user.id).all<CaseRow>()
  return c.json(results.map((r) => toApiCase(r, user)))
})

/* Posibles duplicados cerca antes de reportar */
cases.get('/duplicates', v('query', z.object({ lat: z.coerce.number(), lng: z.coerce.number() })), async (c) => {
  const { lat, lng } = c.req.valid('query')
  const since = new Date(Date.now() - DUPLICATE_WINDOW_H * 3_600_000).toISOString()
  const d = 0.003 // ~330 m, prefiltro rectangular
  const { results } = await c.env.DB.prepare(
    `SELECT c.id, c.name, c.address, c.lat, c.lng, c.created_at,
       (SELECT key FROM case_photos p WHERE p.case_id = c.id ORDER BY position LIMIT 1) AS photo
     FROM cases c
     WHERE c.hidden = 0 AND c.status IN ('reportado', 'en_atencion') AND c.created_at >= ?
       AND c.lat BETWEEN ? AND ? AND c.lng BETWEEN ? AND ?`,
  )
    .bind(since, lat - d, lat + d, lng - d, lng + d)
    .all<{ id: number; name: string; address: string; lat: number; lng: number; created_at: string; photo: string | null }>()
  const out: DuplicateCandidate[] = results
    .map((r) => ({ id: r.id, name: r.name, address: r.address, photo: photoUrl(r.photo), createdAt: r.created_at, distance: distanceMeters([lat, lng], [r.lat, r.lng]) }))
    .filter((r) => r.distance <= DUPLICATE_RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
  return c.json(out)
})

cases.get('/:id', idParam, async (c) => {
  const { id } = c.req.valid('param')
  const kase = await loadCase(c, id)
  const [events, helpers] = await Promise.all([
    c.env.DB.prepare('SELECT e.status, e.detail, e.at, u.name AS user_name FROM case_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.case_id = ? ORDER BY e.at, e.id')
      .bind(id)
      .all<{ status: CaseStatus; detail: string; at: string; user_name: string | null }>(),
    c.env.DB.prepare('SELECT u.id, u.name, u.avatar_key, u.verified, h.help_type FROM case_helpers h JOIN users u ON u.id = h.user_id WHERE h.case_id = ? ORDER BY h.joined_at')
      .bind(id)
      .all<{ id: string; name: string; avatar_key: string | null; verified: number; help_type: string }>(),
  ])
  const detail: ApiCaseDetail = {
    ...kase,
    timeline: events.results.map((e) => ({ status: e.status, detail: e.detail, at: e.at, userName: e.user_name })),
    helpers: helpers.results.map((h) => ({ ...person(h.id, h.name, h.avatar_key, h.verified), helpType: h.help_type })),
  }
  return c.json(detail)
})

cases.post('/', v('json', createCaseSchema), async (c) => {
  const user = c.get('user')
  const body = c.req.valid('json')
  const since = new Date(Date.now() - 3_600_000).toISOString()
  const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM cases WHERE reporter_id = ? AND created_at >= ?').bind(user.id, since).first<{ n: number }>()
  if (user.role !== 'admin' && (recent?.n ?? 0) >= REPORTS_PER_HOUR) fail(429, `Puedes enviar hasta ${REPORTS_PER_HOUR} reportes por hora`)
  if (body.photos.some((k) => !k.startsWith(`u/${user.id}/`))) fail(400, 'Alguna foto no es válida. Vuelve a subirla')

  const name = body.name || `${SPECIES_LABEL[body.species]} sin nombre`
  const inserted = await c.env.DB.prepare(
    `INSERT INTO cases (name, species, condition, description, lat, lng, address, zone, reporter_id, anonymous)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  )
    .bind(name, body.species, body.condition, body.description, body.lat, body.lng, body.address, zoneFor([body.lat, body.lng]), user.id, body.anonymous ? 1 : 0)
    .first<{ id: number }>()
  const id = inserted!.id
  const photoStmt = c.env.DB.prepare('INSERT INTO case_photos (case_id, key, position) VALUES (?, ?, ?)')
  const needStmt = c.env.DB.prepare('INSERT INTO case_needs (case_id, need) VALUES (?, ?)')
  await c.env.DB.batch([
    ...body.photos.map((k, i) => photoStmt.bind(id, k, i)),
    ...[...new Set(body.needs)].map((n) => needStmt.bind(id, n)),
    c.env.DB.prepare('INSERT INTO case_events (case_id, status, detail, user_id) VALUES (?, ?, ?, ?)').bind(
      id,
      'reportado',
      `Reporte enviado con ${body.photos.length} foto${body.photos.length === 1 ? '' : 's'}${body.anonymous ? ' (anónimo)' : ` por ${user.name}`}.`,
      user.id,
    ),
  ])
  return c.json(await loadCase(c, id), 201)
})

cases.patch('/:id', idParam, v('json', updateCaseSchema), async (c) => {
  const { id } = c.req.valid('param')
  await loadEditable(c, id)
  const b = c.req.valid('json')
  const set: string[] = []
  const vals: unknown[] = []
  const map: [keyof typeof b, string][] = [
    ['name', 'name'],
    ['sex', 'sex'],
    ['profile', 'profile'],
    ['description', 'description'],
    ['medicalNote', 'medical_note'],
    ['condition', 'condition'],
    ['donationGoal', 'donation_goal'],
  ]
  for (const [k, col] of map) {
    if (b[k] !== undefined) {
      set.push(`${col} = ?`)
      vals.push(b[k])
    }
  }
  if (set.length) {
    await c.env.DB.prepare(`UPDATE cases SET ${set.join(', ')}, updated_at = ? WHERE id = ?`).bind(...vals, nowIso(), id).run()
  }
  return c.json(await loadCase(c, id))
})

cases.post('/:id/status', idParam, v('json', statusChangeSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')
  const kase = await loadEditable(c, id)
  const { status, detail } = c.req.valid('json')
  if (status === kase.status) return c.json(kase)
  const text = detail || `${user.name} cambió el estado a «${STATUS_LABEL[status]}».`
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE cases SET status = ?, updated_at = ? WHERE id = ?').bind(status, nowIso(), id),
    c.env.DB.prepare('INSERT INTO case_events (case_id, status, detail, user_id) VALUES (?, ?, ?, ?)').bind(id, status, text, user.id),
  ])
  await notify(c.env.DB, await caseAudience(c.env.DB, id), { type: 'status', title: `${kase.name}: ${STATUS_LABEL[status]}`, body: text, caseId: id }, user.id)
  return c.json(await loadCase(c, id))
})

cases.put('/:id/needs', idParam, v('json', needsUpdateSchema), async (c) => {
  const { id } = c.req.valid('param')
  await loadEditable(c, id)
  const { needs } = c.req.valid('json')
  const stmt = c.env.DB.prepare('INSERT INTO case_needs (case_id, need, detail, state) VALUES (?, ?, ?, ?)')
  const unique = [...new Map(needs.map((n) => [n.need, n])).values()]
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM case_needs WHERE case_id = ?').bind(id),
    ...unique.map((n) => stmt.bind(id, n.need, n.detail ?? null, n.state)),
    touch(c.env.DB, id),
  ])
  return c.json(await loadCase(c, id))
})

cases.post('/:id/photos', idParam, v('json', z.object({ keys: z.array(z.string().max(200)).min(1).max(4) })), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')
  const kase = await loadEditable(c, id)
  const { keys } = c.req.valid('json')
  if (keys.some((k) => !k.startsWith(`u/${user.id}/`))) fail(400, 'Alguna foto no es válida')
  if (kase.photos.length + keys.length > 8) fail(400, 'Un caso puede tener hasta 8 fotos')
  const stmt = c.env.DB.prepare('INSERT INTO case_photos (case_id, key, position) VALUES (?, ?, ?)')
  await c.env.DB.batch([...keys.map((k, i) => stmt.bind(id, k, kase.photos.length + i)), touch(c.env.DB, id)])
  return c.json(await loadCase(c, id))
})

/* Unirse / actualizar / dejar de ayudar */
cases.post('/:id/help', idParam, v('json', helpSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')
  const kase = await loadCase(c, id)
  const { helpType } = c.req.valid('json')
  const stmts = [
    c.env.DB.prepare('INSERT INTO case_helpers (case_id, user_id, help_type) VALUES (?, ?, ?) ON CONFLICT (case_id, user_id) DO UPDATE SET help_type = excluded.help_type').bind(
      id,
      user.id,
      helpType,
    ),
  ]
  if (!kase.myHelp && kase.status === 'reportado') {
    stmts.push(
      c.env.DB.prepare("UPDATE cases SET status = 'en_atencion', updated_at = ? WHERE id = ?").bind(nowIso(), id),
      c.env.DB.prepare("INSERT INTO case_events (case_id, status, detail, user_id) VALUES (?, 'en_atencion', ?, ?)").bind(id, `${user.name} tomó el caso: ${helpType.toLowerCase()}.`, user.id),
    )
  }
  await c.env.DB.batch(stmts)
  if (!kase.myHelp) {
    await notify(c.env.DB, await caseAudience(c.env.DB, id), { type: 'help', title: `${user.name} se unió al rescate de ${kase.name}`, body: helpType, caseId: id }, user.id)
  }
  return c.json(await loadCase(c, id))
})

cases.delete('/:id/help', idParam, async (c) => {
  const { id } = c.req.valid('param')
  await c.env.DB.prepare('DELETE FROM case_helpers WHERE case_id = ? AND user_id = ?').bind(id, c.get('user').id).run()
  return c.json(await loadCase(c, id))
})

cases.post('/:id/save', idParam, async (c) => {
  const { id } = c.req.valid('param')
  await loadCase(c, id)
  await c.env.DB.prepare('INSERT OR IGNORE INTO saved_cases (user_id, case_id) VALUES (?, ?)').bind(c.get('user').id, id).run()
  return c.json({ saved: true })
})

cases.delete('/:id/save', idParam, async (c) => {
  const { id } = c.req.valid('param')
  await c.env.DB.prepare('DELETE FROM saved_cases WHERE user_id = ? AND case_id = ?').bind(c.get('user').id, id).run()
  return c.json({ saved: false })
})

cases.post('/:id/flag', idParam, v('json', flagSchema), async (c) => {
  const { id } = c.req.valid('param')
  await loadCase(c, id)
  const { reason } = c.req.valid('json')
  await c.env.DB.prepare('INSERT INTO case_flags (case_id, user_id, reason) VALUES (?, ?, ?) ON CONFLICT (case_id, user_id) DO UPDATE SET reason = excluded.reason')
    .bind(id, c.get('user').id, reason)
    .run()
  return c.json({ ok: true })
})

/* Comentarios del rescate */
cases.get('/:id/comments', idParam, async (c) => {
  const { id } = c.req.valid('param')
  await loadCase(c, id)
  const { results } = await c.env.DB.prepare(
    'SELECT m.id, m.body, m.created_at, u.id AS uid, u.name, u.avatar_key, u.verified FROM case_comments m JOIN users u ON u.id = m.user_id WHERE m.case_id = ? ORDER BY m.created_at, m.id LIMIT 300',
  )
    .bind(id)
    .all<{ id: number; body: string; created_at: string; uid: string; name: string; avatar_key: string | null; verified: number }>()
  const out: ApiComment[] = results.map((r) => ({ id: r.id, body: r.body, createdAt: r.created_at, user: person(r.uid, r.name, r.avatar_key, r.verified) }))
  return c.json(out)
})

cases.post('/:id/comments', idParam, v('json', commentSchema), async (c) => {
  const { id } = c.req.valid('param')
  const user = c.get('user')
  const kase = await loadCase(c, id)
  const { body } = c.req.valid('json')
  await c.env.DB.prepare('INSERT INTO case_comments (case_id, user_id, body) VALUES (?, ?, ?)').bind(id, user.id, body).run()
  const audience = (await caseAudience(c.env.DB, id)).filter(Boolean)
  await notify(c.env.DB, audience, { type: 'comment', title: `${user.name} comentó en ${kase.name}`, body: body.slice(0, 120), caseId: id }, user.id)
  return c.json({ ok: true }, 201)
})
