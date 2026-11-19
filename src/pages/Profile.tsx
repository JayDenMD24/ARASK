import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { changePasswordSchema } from '../../shared/schemas'
import { CaseRow } from '../components/CaseCard'
import { Avatar, EmptyState, Icon, Sheet, Spinner } from '../components/ui'
import { api, errorMessage, uploadImage } from '../lib/api'
import { formatCOP, formatWhen } from '../lib/format'
import { compressImage } from '../lib/image'
import { keys, useCases, useMyDonations } from '../lib/queries'
import { useApp } from '../store/AppStore'
import { useAuth } from '../store/AuthProvider'

type Tab = 'mine' | 'saved' | 'helping' | 'donaciones'

export default function Profile() {
  const { user, isAdmin, logout } = useAuth()
  const { showToast } = useApp()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('mine')
  const [sheet, setSheet] = useState<'edit' | 'password' | 'logout' | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [pw, setPw] = useState({ current: '', next: '' })
  const avatarInput = useRef<HTMLInputElement>(null)

  const listQ = useCases(tab === 'donaciones' ? 'mine' : tab)
  const donationsQ = useMyDonations()
  if (!user) return null

  const badges = [
    { icon: 'campaign', label: 'Primer reporte', got: user.reports >= 1 },
    { icon: 'volunteer_activism', label: 'Manos que ayudan', got: user.helping >= 1 },
    { icon: 'favorite', label: 'Corazón donante', got: user.donated > 0 },
    { icon: 'verified', label: 'Rescatista verificado', got: user.verified },
  ]
  const tabs: { key: Tab; label: string }[] = [
    { key: 'mine', label: 'Reportes' },
    { key: 'saved', label: 'Guardados' },
    { key: 'helping', label: 'Ayudando' },
    { key: 'donaciones', label: 'Donaciones' },
  ]
  const empty: Record<Tab, [string, string]> = {
    mine: ['campaign', 'Aún no has reportado animales. Usa el botón naranja «Reportar».'],
    saved: ['bookmark', 'Guarda casos con el ícono de marcador para seguirlos aquí.'],
    helping: ['pets', 'Cuando te unas a un rescate aparecerá aquí.'],
    donaciones: ['favorite', 'Tus donaciones aparecerán aquí.'],
  }

  async function saveProfile(patch: { name?: string; avatarKey?: string | null }) {
    setBusy(true)
    try {
      await api('/me', { method: 'PATCH', json: patch })
      await qc.invalidateQueries({ queryKey: keys.me })
      showToast('Perfil actualizado')
      setSheet(null)
    } catch (err) {
      showToast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function changePassword() {
    const parsed = changePasswordSchema.safeParse(pw)
    if (!parsed.success) return showToast(parsed.error.issues[0]?.message ?? 'Revisa los datos', 'error')
    setBusy(true)
    try {
      await api('/me/password', { method: 'POST', json: pw })
      showToast('Contraseña actualizada')
      setPw({ current: '', next: '' })
      setSheet(null)
    } catch (err) {
      showToast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-[420px] mx-auto bg-surface min-h-dvh flex flex-col pb-28">
      <header className="bg-primary-container text-white px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] pb-14 rounded-b-[32px] relative">
        <div className="flex items-center justify-between">
          <span className="font-headline font-black text-lg tracking-tight">Mi perfil</span>
          <div className="flex gap-2">
            <Link to="/notificaciones" aria-label="Notificaciones" className="relative w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <Icon name="notifications" className="text-lg" />
              {user.unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary-container" />}
            </Link>
            <button
              aria-label="Editar perfil"
              onClick={() => {
                setNameDraft(user.name)
                setSheet('edit')
              }}
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center active:scale-95"
              type="button"
            >
              <Icon name="edit" className="text-lg" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <button className="relative" onClick={() => avatarInput.current?.click()} aria-label="Cambiar foto de perfil" type="button">
            <span className="block rounded-full ring-4 ring-white/20">
              <Avatar person={user} size="w-16 h-16 text-2xl" />
            </span>
            <span className="absolute -bottom-1 -right-1 bg-secondary-container text-white rounded-full w-6 h-6 flex items-center justify-center ring-2 ring-primary-container">
              {busy ? <Spinner className="w-3 h-3 border-white/30 border-t-white" /> : <Icon name="photo_camera" className="text-sm" />}
            </span>
          </button>
          <input
            ref={avatarInput}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setBusy(true)
              try {
                const { key } = await uploadImage(await compressImage(f, 400, 0.8))
                await saveProfile({ avatarKey: key })
              } catch (err) {
                showToast(errorMessage(err), 'error')
                setBusy(false)
              }
            }}
          />
          <div className="min-w-0">
            <h1 className="font-headline font-extrabold text-xl truncate">{user.name}</h1>
            <p className="text-xs text-inverse-primary font-medium truncate">{user.email}</p>
            <div className="flex gap-1.5 mt-1">
              {isAdmin && <span className="text-[10px] font-bold bg-secondary-container text-white px-2 py-0.5 rounded-full">Administrador</span>}
              {user.verified && <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full">Rescatista verificado</span>}
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 -mt-9 space-y-4 flex-1">
        <section className="grid grid-cols-3 gap-2.5">
          {[
            { v: String(user.reports), l: 'Reportes', icon: 'campaign' },
            { v: String(user.helping), l: 'Rescates', icon: 'pets' },
            { v: formatCOP(user.donated), l: 'Donado', icon: 'favorite' },
          ].map((s) => (
            <div key={s.l} className="bg-surface-container-lowest rounded-2xl p-3 shadow-sm border border-outline-variant/20 text-center">
              <Icon name={s.icon} fill className="text-secondary text-lg" />
              <p className="font-headline font-extrabold text-primary text-sm mt-0.5 truncate">{s.v}</p>
              <p className="text-[10px] font-label text-on-surface-variant">{s.l}</p>
            </div>
          ))}
        </section>

        {isAdmin && (
          <Link to="/admin" className="flex items-center gap-3 bg-primary text-white rounded-2xl p-3.5 shadow-sm">
            <Icon name="admin_panel_settings" className="text-2xl" />
            <div className="flex-1">
              <p className="text-sm font-headline font-bold">Panel de administración</p>
              <p className="text-[11px] text-inverse-primary">Moderación, usuarios, estadísticas y campaña</p>
            </div>
            <Icon name="chevron_right" />
          </Link>
        )}

        <section className="bg-surface-container-lowest rounded-2xl p-3.5 border border-outline-variant/20">
          <h2 className="text-xs font-label font-bold tracking-wider text-outline uppercase mb-2.5">Insignias</h2>
          <div className="flex justify-between">
            {badges.map((b) => (
              <div key={b.label} className={`flex flex-col items-center w-[23%] text-center ${b.got ? '' : 'opacity-35 grayscale'}`}>
                <span className={`w-11 h-11 rounded-full flex items-center justify-center ${b.got ? 'bg-secondary-fixed text-secondary' : 'bg-surface-container text-outline'}`}>
                  <Icon name={b.icon} fill className="text-xl" />
                </span>
                <span className="text-[10px] font-semibold text-on-surface-variant mt-1 leading-tight">{b.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex bg-surface-container-low p-1 rounded-2xl gap-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-2 px-1 rounded-xl text-[11px] font-headline font-bold whitespace-nowrap transition-all ${tab === t.key ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'donaciones' ? (
            donationsQ.isPending ? (
              <Spinner />
            ) : donationsQ.data?.length ? (
              <ul className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 divide-y divide-surface-container-high px-3.5">
                {donationsQ.data.map((d) => (
                  <li key={d.id} className="py-2.5 flex items-center justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-on-surface truncate">{d.caseName ? `Caso ${d.caseName}` : d.destination}</p>
                      <p className="text-outline text-[11px]">
                        {formatWhen(d.createdAt)} · {d.method} · {d.frequency === 'mensual' ? 'Mensual' : 'Única'}
                      </p>
                    </div>
                    <span className="font-headline font-extrabold text-primary shrink-0">{formatCOP(d.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={empty.donaciones[0]} title="Sin donaciones" text={empty.donaciones[1]} />
            )
          ) : listQ.isPending ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : listQ.data?.length ? (
            <div className="space-y-2.5">
              {listQ.data.map((c) => (
                <CaseRow key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <EmptyState icon={empty[tab][0]} title="Nada por aquí todavía" text={empty[tab][1]} />
          )}
        </section>

        <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 divide-y divide-surface-container-high">
          {[
            { icon: 'lock', label: 'Cambiar contraseña', action: () => setSheet('password') },
            { icon: 'notifications', label: 'Notificaciones', action: () => navigate('/notificaciones') },
            { icon: 'logout', label: 'Cerrar sesión', action: () => setSheet('logout'), danger: true },
          ].map((item) => (
            <button key={item.label} onClick={item.action} className={`w-full flex items-center gap-3 px-4 py-3 text-left text-xs font-semibold ${item.danger ? 'text-error' : 'text-on-surface'}`} type="button">
              <Icon name={item.icon} className={`text-lg ${item.danger ? '' : 'text-primary'}`} />
              <span className="flex-1">{item.label}</span>
              <Icon name="chevron_right" className="text-outline" />
            </button>
          ))}
        </section>
        <p className="text-center text-[10px] text-outline pb-2">ARASK v1.0 · Universidad del Sinú · Montería</p>
      </main>

      <Sheet open={sheet === 'edit'} onClose={() => setSheet(null)} title="Editar perfil">
        <label className="text-xs font-bold text-primary" htmlFor="nombre">
          Nombre
        </label>
        <input id="nombre" value={nameDraft} onChange={(e) => setNameDraft(e.target.value.slice(0, 40))} className="w-full rounded-xl border-outline-variant/60 text-sm focus:border-primary focus:ring-primary/20" />
        <button
          disabled={nameDraft.trim().length < 2 || busy}
          onClick={() => saveProfile({ name: nameDraft.trim() })}
          className="w-full py-3 bg-primary-container text-white font-bold rounded-2xl text-xs disabled:opacity-50"
          type="button"
        >
          Guardar
        </button>
        {user.avatarUrl && (
          <button onClick={() => saveProfile({ avatarKey: null })} className="text-xs font-bold text-error" type="button">
            Quitar foto de perfil
          </button>
        )}
      </Sheet>

      <Sheet open={sheet === 'password'} onClose={() => setSheet(null)} title="Cambiar contraseña" subtitle="Se cerrará la sesión en tus otros dispositivos">
        <input type="password" autoComplete="current-password" placeholder="Contraseña actual" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} className="w-full rounded-xl border-outline-variant/60 text-sm focus:border-primary focus:ring-primary/20" />
        <input type="password" autoComplete="new-password" placeholder="Nueva contraseña (mín. 8)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} className="w-full rounded-xl border-outline-variant/60 text-sm focus:border-primary focus:ring-primary/20" />
        <button disabled={busy} onClick={changePassword} className="w-full py-3 bg-primary-container text-white font-bold rounded-2xl text-xs disabled:opacity-50" type="button">
          Actualizar contraseña
        </button>
      </Sheet>

      <Sheet open={sheet === 'logout'} onClose={() => setSheet(null)} title="¿Cerrar sesión?">
        <div className="flex gap-2">
          <button onClick={() => setSheet(null)} className="flex-1 py-3 rounded-2xl border border-outline-variant text-xs font-bold text-on-surface" type="button">
            Cancelar
          </button>
          <button
            onClick={async () => {
              await logout()
              navigate('/entrar', { replace: true })
            }}
            className="flex-1 py-3 rounded-2xl bg-error text-white text-xs font-bold"
            type="button"
          >
            Cerrar sesión
          </button>
        </div>
      </Sheet>
    </div>
  )
}
