import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleMarker, MapContainer, TileLayer } from 'react-leaflet'
import { CaseThumb } from '../components/CaseCard'
import { TILE_LAYERS } from '../components/map'
import { Avatar, EmptyState, ErrorState, Icon, LoadingScreen, Sheet, Spinner } from '../components/ui'
import { CONDITIONS, DEFAULT_CENTER, FLAG_REASONS, STATUS } from '../data/catalog'
import type { AdminUserRow, FlagReason } from '../data/types'
import { errorMessage } from '../lib/api'
import { formatCOP, formatNumber, formatWhen } from '../lib/format'
import {
  useAdminCampaign,
  useAdminCases,
  useAdminClearFlags,
  useAdminDeleteCase,
  useAdminResetPassword,
  useAdminStats,
  useAdminUpdateCase,
  useAdminUpdateUser,
  useAdminUsers,
  useCampaign,
  type AdminCase,
} from '../lib/queries'
import { useApp } from '../store/AppStore'
import { useAuth } from '../store/AuthProvider'

type Tab = 'resumen' | 'moderacion' | 'usuarios' | 'campana'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('resumen')
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'resumen', label: 'Resumen', icon: 'monitoring' },
    { key: 'moderacion', label: 'Moderación', icon: 'gavel' },
    { key: 'usuarios', label: 'Usuarios', icon: 'group' },
    { key: 'campana', label: 'Campaña', icon: 'campaign' },
  ]
  return (
    <div className="w-full max-w-[420px] mx-auto min-h-dvh bg-surface flex flex-col">
      <header className="sticky top-0 z-[600] bg-primary text-white pt-safe shadow-md">
        <div className="flex items-center gap-2 px-3 py-3">
          <button aria-label="Volver" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10" type="button">
            <Icon name="arrow_back" className="text-2xl" />
          </button>
          <div>
            <h1 className="font-headline font-extrabold text-base leading-tight">Panel de administración</h1>
            <p className="text-[11px] text-inverse-primary">ARASK · Montería</p>
          </div>
        </div>
        <div className="flex px-2 gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1 px-3 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap ${tab === t.key ? 'border-secondary-container text-white' : 'border-transparent text-inverse-primary'}`}
              type="button"
            >
              <Icon name={t.icon} className="text-base" />
              {t.label}
            </button>
          ))}
        </div>
      </header>
      <main className="flex-1 px-4 py-4 pb-10">
        {tab === 'resumen' && <Summary />}
        {tab === 'moderacion' && <Moderation />}
        {tab === 'usuarios' && <Users />}
        {tab === 'campana' && <CampaignForm />}
      </main>
    </div>
  )
}

/* ---------- Resumen ---------- */

function Bars({ title, rows }: { title: string; rows: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-3.5">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline mb-2.5">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-outline">Sin datos todavía.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="text-xs">
              <div className="flex justify-between mb-0.5">
                <span className="text-on-surface font-semibold">{r.label}</span>
                <span className="font-bold text-primary">{formatNumber(r.value)}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? '#0e4f5c' }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Summary() {
  const q = useAdminStats()
  if (q.isPending) return <LoadingScreen />
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  const s = q.data
  const months = s.byMonth.map((m) => ({
    label: new Date(`${m.month}-15T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }),
    value: m.total,
  }))
  return (
    <div className="space-y-3.5">
      <div className="grid grid-cols-3 gap-2">
        {[
          { l: 'Casos', v: formatNumber(s.totals.cases), i: 'pets' },
          { l: 'Abiertos', v: formatNumber(s.totals.open), i: 'emergency' },
          { l: 'Usuarios', v: formatNumber(s.totals.users), i: 'group' },
          { l: 'Donaciones', v: formatNumber(s.totals.donations), i: 'receipt_long' },
          { l: 'Recaudado', v: formatCOP(s.totals.donated), i: 'payments' },
          { l: 'Con alertas', v: formatNumber(s.totals.flagged), i: 'flag' },
        ].map((k) => (
          <div key={k.l} className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-2.5 text-center">
            <Icon name={k.i} className="text-secondary text-lg" />
            <p className="font-headline font-extrabold text-primary text-sm truncate">{k.v}</p>
            <p className="text-[10px] text-on-surface-variant">{k.l}</p>
          </div>
        ))}
      </div>

      <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-outline px-1.5 pt-1 pb-2">Mapa de calor de reportes</h3>
        <div className="h-64 rounded-xl overflow-hidden z-0 relative">
          <MapContainer center={DEFAULT_CENTER} zoom={13} zoomControl={false} attributionControl={false} className="w-full h-full">
            <TileLayer url={TILE_LAYERS.claro.url} className={TILE_LAYERS.claro.className} />
            {s.points.map((p, i) => (
              <CircleMarker
                key={i}
                center={[p.lat, p.lng]}
                radius={14}
                pathOptions={{ stroke: false, fillColor: STATUS[p.status].resolved ? '#10B981' : CONDITIONS[p.condition].pin, fillOpacity: 0.28 }}
              />
            ))}
          </MapContainer>
        </div>
        <p className="text-[10px] text-outline px-1.5 pt-1.5">Las zonas más intensas concentran más reportes. Verde: casos resueltos.</p>
      </section>

      <Bars title="Casos por zona" rows={s.byZone.map((z) => ({ label: `${z.zone} (${z.open} abiertos)`, value: z.total }))} />
      <Bars title="Casos por estado" rows={s.byStatus.map((z) => ({ label: STATUS[z.status].label, value: z.total, color: STATUS[z.status].resolved ? '#115236' : '#0e4f5c' }))} />
      <Bars title="Casos por condición" rows={s.byCondition.map((z) => ({ label: CONDITIONS[z.condition].label, value: z.total, color: CONDITIONS[z.condition].pin }))} />
      <Bars title="Reportes por mes" rows={months} />
    </div>
  )
}

/* ---------- Moderación ---------- */

function Moderation() {
  const [filter, setFilter] = useState('flagged')
  const q = useAdminCases(filter)
  const filters = [
    { k: 'flagged', l: 'Con alertas' },
    { k: 'unverified', l: 'Sin verificar' },
    { k: 'hidden', l: 'Ocultos' },
    { k: 'all', l: 'Todos' },
  ]
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${filter === f.k ? 'bg-primary-container text-white' : 'bg-surface-container-lowest border border-outline-variant/40 text-on-surface-variant'}`}
            type="button"
          >
            {f.l}
          </button>
        ))}
      </div>
      {q.isPending ? (
        <LoadingScreen />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data.length === 0 ? (
        <EmptyState icon="task_alt" title="Nada pendiente" text="No hay casos en esta categoría." />
      ) : (
        <ul className="space-y-2.5">
          {q.data.map((c) => (
            <ModerationRow key={c.id} c={c} />
          ))}
        </ul>
      )}
    </div>
  )
}

function ModerationRow({ c }: { c: AdminCase }) {
  const update = useAdminUpdateCase()
  const clear = useAdminClearFlags()
  const del = useAdminDeleteCase()
  const { showToast } = useApp()
  const [hideOpen, setHideOpen] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [reason, setReason] = useState('Reporte duplicado o falso')
  const done = (msg: string) => ({ onSuccess: () => showToast(msg), onError: (e: unknown) => showToast(errorMessage(e), 'error') })

  return (
    <li className={`bg-surface-container-lowest rounded-2xl border p-3 space-y-2.5 ${c.hidden ? 'border-error/30' : 'border-outline-variant/30'}`}>
      <Link to={`/caso/${c.id}`} className="flex gap-3">
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0">
          <CaseThumb c={c} className="w-full h-full" />
        </div>
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-bold text-on-surface truncate flex items-center gap-1">
            #{c.id} {c.name} {c.verified && <Icon name="verified" fill className="text-primary text-sm" />}
          </p>
          <p className="text-outline truncate">{c.address}</p>
          <p className="text-[11px] text-outline">
            {c.reporter.name} · {formatWhen(c.createdAt)} · {STATUS[c.status].label}
          </p>
        </div>
      </Link>
      {c.flagsCount > 0 && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(c.flagReasons).map(([r, n]) => (
            <span key={r} className="px-2 py-0.5 rounded-full bg-error-container text-error text-[10px] font-bold">
              {FLAG_REASONS[r as FlagReason]?.label ?? r}: {n}
            </span>
          ))}
        </div>
      )}
      {c.hidden && <p className="text-[11px] text-error">Oculto: {c.hiddenReason ?? 'sin motivo'}</p>}
      <div className="flex flex-wrap gap-1.5">
        {!c.verified && !c.hidden && (
          <button onClick={() => update.mutate({ id: c.id, verified: true }, done('Caso verificado'))} className="px-3 py-1.5 rounded-full bg-tertiary-container text-white text-[11px] font-bold" type="button">
            Verificar
          </button>
        )}
        {c.hidden ? (
          <button onClick={() => update.mutate({ id: c.id, hidden: false, hiddenReason: null }, done('Caso publicado de nuevo'))} className="px-3 py-1.5 rounded-full bg-primary-container text-white text-[11px] font-bold" type="button">
            Volver a publicar
          </button>
        ) : (
          <button onClick={() => setHideOpen(true)} className="px-3 py-1.5 rounded-full bg-error text-white text-[11px] font-bold" type="button">
            Ocultar
          </button>
        )}
        {c.flagsCount > 0 && !c.hidden && (
          <button onClick={() => clear.mutate(c.id, done('Alertas descartadas'))} className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface-variant text-[11px] font-bold" type="button">
            Descartar alertas
          </button>
        )}
        <button onClick={() => setDelOpen(true)} className="px-3 py-1.5 rounded-full border border-error/40 text-error text-[11px] font-bold ml-auto" type="button">
          Eliminar
        </button>
      </div>

      <Sheet open={hideOpen} onClose={() => setHideOpen(false)} title={`Ocultar «${c.name}»`} subtitle="Dejará de verse en el mapa y en las listas. Quien lo reportó recibirá el motivo.">
        <input value={reason} onChange={(e) => setReason(e.target.value.slice(0, 120))} className="w-full rounded-xl border-outline-variant/60 text-sm" />
        <button
          onClick={() => {
            update.mutate({ id: c.id, hidden: true, hiddenReason: reason.trim() || null }, done('Caso ocultado'))
            setHideOpen(false)
          }}
          className="w-full py-3 rounded-2xl bg-error text-white text-xs font-bold"
          type="button"
        >
          Ocultar caso
        </button>
      </Sheet>
      <Sheet open={delOpen} onClose={() => setDelOpen(false)} title={`¿Eliminar el caso #${c.id}?`} subtitle="Se borrarán el caso, sus fotos, comentarios e historial. No se puede deshacer.">
        <div className="flex gap-2">
          <button onClick={() => setDelOpen(false)} className="flex-1 py-3 rounded-2xl border border-outline-variant text-xs font-bold" type="button">
            Cancelar
          </button>
          <button
            onClick={() => {
              del.mutate(c.id, done('Caso eliminado'))
              setDelOpen(false)
            }}
            className="flex-1 py-3 rounded-2xl bg-error text-white text-xs font-bold"
            type="button"
          >
            Eliminar definitivamente
          </button>
        </div>
      </Sheet>
    </li>
  )
}

/* ---------- Usuarios ---------- */

function Users() {
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 350)
    return () => window.clearTimeout(t)
  }, [q])
  const users = useAdminUsers(debounced)
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-surface-container-lowest rounded-full px-3.5 py-2 border border-outline-variant/40">
        <Icon name="search" className="text-outline" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo" className="flex-1 bg-transparent border-0 p-0 text-xs focus:ring-0" type="search" />
      </div>
      {users.isPending ? (
        <LoadingScreen />
      ) : users.isError ? (
        <ErrorState error={users.error} onRetry={() => users.refetch()} />
      ) : users.data.length === 0 ? (
        <EmptyState icon="person_search" title="Sin resultados" />
      ) : (
        <ul className="space-y-2">
          {users.data.map((u) => (
            <UserRow key={u.id} u={u} />
          ))}
        </ul>
      )}
    </div>
  )
}

function UserRow({ u }: { u: AdminUserRow }) {
  const { user: me } = useAuth()
  const update = useAdminUpdateUser()
  const reset = useAdminResetPassword()
  const { showToast } = useApp()
  const [open, setOpen] = useState(false)
  const [temp, setTemp] = useState<string | null>(null)
  const isMe = me?.id === u.id
  const run = (b: { role?: 'user' | 'admin'; verified?: boolean; disabled?: boolean }, msg: string) =>
    update.mutate({ id: u.id, ...b }, { onSuccess: () => showToast(msg), onError: (e) => showToast(errorMessage(e), 'error') })

  return (
    <li className={`bg-surface-container-lowest rounded-2xl border border-outline-variant/30 p-3 ${u.disabled ? 'opacity-60' : ''}`}>
      <button onClick={() => setOpen(true)} className="w-full flex items-center gap-3 text-left" type="button">
        <Avatar person={u} size="w-10 h-10 text-sm" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-bold text-on-surface truncate flex items-center gap-1">
            {u.name} {u.verified && <Icon name="verified" fill className="text-primary text-sm" />}
          </p>
          <p className="text-outline truncate">{u.email}</p>
          <p className="text-[10px] text-outline">
            {u.reports} reportes · {u.helping} rescates · {formatCOP(u.donated)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {u.role === 'admin' && <span className="text-[9px] font-bold bg-secondary-container text-white px-1.5 py-0.5 rounded-full">Admin</span>}
          {u.disabled && <span className="text-[9px] font-bold bg-error text-white px-1.5 py-0.5 rounded-full">Desactivado</span>}
        </div>
      </button>
      <Sheet open={open} onClose={() => (setOpen(false), setTemp(null))} title={u.name} subtitle={`${u.email} · desde ${formatWhen(u.createdAt)}`}>
        <div className="divide-y divide-surface-container-high">
          <button onClick={() => run({ verified: !u.verified }, u.verified ? 'Verificación retirada' : 'Rescatista verificado')} className="w-full flex items-center gap-3 py-3 text-xs font-semibold" type="button">
            <Icon name="verified" className="text-primary" /> {u.verified ? 'Quitar verificación de rescatista' : 'Verificar como rescatista'}
          </button>
          {!isMe && (
            <button onClick={() => run({ role: u.role === 'admin' ? 'user' : 'admin' }, u.role === 'admin' ? 'Ahora es usuario' : 'Ahora es administrador')} className="w-full flex items-center gap-3 py-3 text-xs font-semibold" type="button">
              <Icon name="admin_panel_settings" className="text-primary" /> {u.role === 'admin' ? 'Quitar rol de administrador' : 'Hacer administrador'}
            </button>
          )}
          <button
            onClick={() => reset.mutate(u.id, { onSuccess: (r) => setTemp(r.tempPassword), onError: (e) => showToast(errorMessage(e), 'error') })}
            className="w-full flex items-center gap-3 py-3 text-xs font-semibold"
            type="button"
          >
            {reset.isPending ? <Spinner className="w-4 h-4" /> : <Icon name="key" className="text-primary" />} Restablecer contraseña
          </button>
          {!isMe && (
            <button onClick={() => run({ disabled: !u.disabled }, u.disabled ? 'Cuenta reactivada' : 'Cuenta desactivada')} className="w-full flex items-center gap-3 py-3 text-xs font-semibold text-error" type="button">
              <Icon name={u.disabled ? 'lock_open' : 'block'} /> {u.disabled ? 'Reactivar cuenta' : 'Desactivar cuenta'}
            </button>
          )}
        </div>
        {temp && (
          <div className="rounded-xl bg-tertiary-fixed/40 p-3 text-xs">
            <p className="font-bold text-tertiary">Contraseña temporal (se muestra una sola vez):</p>
            <p className="font-mono text-base text-on-surface mt-1 select-all">{temp}</p>
            <p className="text-[11px] text-on-surface-variant mt-1">Compártela por un canal privado y pídele que la cambie desde su perfil.</p>
          </div>
        )}
      </Sheet>
    </li>
  )
}

/* ---------- Campaña ---------- */

const toLocalDate = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' })

function CampaignForm() {
  const q = useCampaign()
  const save = useAdminCampaign()
  const { showToast } = useApp()
  const [f, setF] = useState({ title: '', goal: '', start: '', end: '' })
  useEffect(() => {
    if (q.data) setF({ title: q.data.title, goal: String(q.data.goal), start: toLocalDate(q.data.startsAt), end: toLocalDate(q.data.endsAt) })
  }, [q.data])
  if (q.isPending) return <LoadingScreen />
  const field = 'w-full rounded-xl border-outline-variant/60 text-sm focus:border-primary focus:ring-primary/20'
  return (
    <form
      className="space-y-3 bg-surface-container-lowest rounded-2xl border border-outline-variant/20 p-4"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate(
          {
            title: f.title.trim(),
            goal: Number(f.goal) || 0,
            startsAt: new Date(`${f.start}T00:00:00-05:00`).toISOString(),
            endsAt: new Date(`${f.end}T23:59:59-05:00`).toISOString(),
          },
          { onSuccess: () => showToast('Campaña guardada'), onError: (err) => showToast(errorMessage(err), 'error') },
        )
      }}
    >
      <p className="text-xs text-on-surface-variant">
        La campaña activa aparece en la pantalla «Donar». {q.data && `Lleva ${formatCOP(q.data.raised)} de ${q.data.donors} donante${q.data.donors === 1 ? '' : 's'}.`}
      </p>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-primary">Título</span>
        <input className={field} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} required />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold text-primary">Meta (COP)</span>
        <input className={field} inputMode="numeric" value={f.goal ? formatNumber(Number(f.goal)) : ''} onChange={(e) => setF({ ...f, goal: e.target.value.replace(/\D/g, '').slice(0, 11) })} required />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs font-bold text-primary">Inicio</span>
          <input className={field} type="date" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} required />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold text-primary">Fin</span>
          <input className={field} type="date" value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} required />
        </label>
      </div>
      <button disabled={save.isPending} className="w-full py-3 rounded-2xl bg-primary-container text-white text-xs font-bold disabled:opacity-50" type="submit">
        Guardar campaña
      </button>
    </form>
  )
}
