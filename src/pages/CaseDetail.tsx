import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { SaveButton } from '../components/CaseCard'
import { pawIcon, TILE_LAYERS } from '../components/map'
import { Avatar, ErrorState, Icon, LoadingScreen, ProgressBar, Sheet, Spinner } from '../components/ui'
import { CONDITIONS, FLAG_REASONS, NEED_STATES, NEEDS, STATUS, STATUS_FLOW } from '../data/catalog'
import type { ApiCaseDetail, CaseStatus, Condition, FlagReason, Need, NeedItem, NeedState } from '../data/types'
import { assetUrl, errorMessage, uploadImage } from '../lib/api'
import { formatCOP, formatNumber, formatWhen, timeAgo } from '../lib/format'
import { directionsUrl, formatDistance } from '../lib/geo'
import { compressImage } from '../lib/image'
import {
  useAddPhotos,
  useCase,
  useChangeStatus,
  useComments,
  useDonate,
  useFlag,
  useJoinHelp,
  useLeaveHelp,
  usePostComment,
  useUpdateCase,
  useUpdateNeeds,
} from '../lib/queries'
import { useApp } from '../store/AppStore'
import { useAuth } from '../store/AuthProvider'

const HELP_OPTIONS = [
  { key: 'Llevaré alimento o agua', hint: 'Puedo llegar en los próximos 20 minutos', icon: 'restaurant', color: 'text-secondary' },
  { key: 'Apoyo con traslado', hint: 'Tengo vehículo y una manta o guacal', icon: 'directions_car', color: 'text-primary' },
  { key: 'Ofrezco hogar temporal', hint: 'Espacio para recuperación de 1 a 2 semanas', icon: 'home', color: 'text-tertiary' },
  { key: 'Atención veterinaria', hint: 'Soy veterinario/a o tengo convenio con una clínica', icon: 'medical_services', color: 'text-error' },
]
const QUICK_AMOUNTS = [10_000, 20_000, 50_000]
const STEP_TEXT: Record<CaseStatus, string> = {
  reportado: 'Reportado',
  en_atencion: 'En atención',
  rescatado: 'Rescatado y en valoración',
  adopcion: 'En resguardo o adopción',
  cerrado: 'Caso cerrado',
}
const ALL_NEEDS: Need[] = ['alimento', 'veterinario', 'traslado', 'hogar', 'medicamentos', 'donacion']

type SheetName = 'help' | 'donate' | 'status' | 'needs' | 'edit' | 'flag' | 'more' | null

export default function CaseDetail() {
  const { id: idParam = '' } = useParams()
  const id = Number(idParam)
  const q = useCase(id)
  if (q.isPending) return <LoadingScreen label="Cargando caso…" />
  if (q.isError || !q.data) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6">
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
        <Link to="/" className="text-xs font-bold text-primary">
          Volver al inicio
        </Link>
      </div>
    )
  }
  return <CaseView c={q.data} />
}

function CaseView({ c }: { c: ApiCaseDetail }) {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { distanceTo, showToast } = useApp()
  const { isAdmin } = useAuth()
  const [sheet, setSheet] = useState<SheetName>(params.get('ayudar') === '1' ? 'help' : null)
  const [photoIdx, setPhotoIdx] = useState(0)

  useEffect(() => {
    if (params.get('ayudar') === '1') {
      const next = new URLSearchParams(params)
      next.delete('ayudar')
      setParams(next, { replace: true })
    }
  }, [params, setParams])

  const cond = CONDITIONS[c.condition]
  const status = STATUS[c.status]
  const currentIdx = STATUS_FLOW.indexOf(c.status === 'cerrado' ? 'adopcion' : c.status)
  const photos = c.photos.map((p) => assetUrl(p)!)
  const close = () => setSheet(null)
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))

  async function share() {
    const text = `Ayuda a ${c.name}: ${cond.label.toLowerCase()} en ${c.address}. Caso #${c.id} en ARASK.`
    const url = `${window.location.origin}/caso/${c.id}`
    try {
      if (navigator.share) await navigator.share({ title: `ARASK - Caso ${c.name}`, text, url })
      else {
        await navigator.clipboard.writeText(`${text} ${url}`)
        showToast('Enlace copiado al portapapeles', 'content_copy')
      }
    } catch {
      /* cancelado */
    }
  }

  return (
    <main className="w-full max-w-[420px] mx-auto bg-background min-h-dvh relative flex flex-col pb-28">
      {/* Foto principal */}
      <div className="relative w-full h-[370px] select-none overflow-hidden bg-surface-container-high">
        {photos.length ? (
          <img className="w-full h-full object-cover object-center" src={photos[photoIdx] ?? photos[0]} alt={`Foto de ${c.name}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-outline">
            <Icon name="pets" className="text-6xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/75" />
        <header className="absolute top-0 left-0 w-full z-20 flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)]">
          <button aria-label="Regresar" onClick={goBack} className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center active:scale-90" type="button">
            <Icon name="arrow_back" className="text-[22px]" />
          </button>
          <div className="flex items-center gap-2.5">
            <button aria-label="Compartir caso" onClick={share} className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center active:scale-90" type="button">
              <Icon name="share" className="text-[20px]" />
            </button>
            <SaveButton c={c} className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center active:scale-90" />
            <button aria-label="Más opciones" onClick={() => setSheet('more')} className="w-10 h-10 rounded-full bg-black/35 backdrop-blur-md text-white flex items-center justify-center active:scale-90" type="button">
              <Icon name="more_vert" className="text-[20px]" />
            </button>
          </div>
        </header>
        {photos.length > 1 && (
          <div className="absolute bottom-[4.5rem] left-1/2 -translate-x-1/2 z-20 flex gap-1.5">
            {photos.map((_, i) => (
              <button
                key={i}
                aria-label={`Ver foto ${i + 1}`}
                onClick={() => setPhotoIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === photoIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`}
                type="button"
              />
            ))}
          </div>
        )}
        <div className="absolute bottom-10 left-5 right-5 z-20 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm ${cond.badge}`}>
            <Icon name={cond.icon} className="text-sm" /> {cond.label}
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container/90 backdrop-blur-md text-on-primary text-xs font-semibold shadow-sm">
            <span className="relative flex h-2 w-2">
              {!status.resolved && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            {status.label}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-surface text-[11px] font-label font-medium ml-auto">Caso #{c.id}</span>
        </div>
      </div>

      <div className="relative -mt-6 z-30 bg-surface-container-lowest rounded-t-[28px] px-5 pt-3 pb-8 shadow-xl flex flex-col gap-6">
        <div className="w-10 h-1 rounded-full bg-outline-variant/60 mx-auto my-1" />

        {c.hidden && (
          <p className="text-xs bg-error-container text-on-error-container rounded-2xl p-3 flex gap-2">
            <Icon name="visibility_off" className="text-base" />
            <span>
              <strong>Caso retirado por moderación.</strong> {c.hiddenReason ?? 'Solo tú y los administradores pueden verlo.'}
            </span>
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl font-headline font-extrabold text-primary tracking-tight truncate">{c.name}</h1>
              {c.verified && (
                <span title="Verificado por el equipo de ARASK" className="inline-flex items-center justify-center text-primary bg-primary-fixed/50 w-5 h-5 rounded-full shrink-0">
                  <Icon name="verified" fill className="text-[14px]" />
                </span>
              )}
            </div>
            {c.sex && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-label font-semibold bg-surface-container-high text-on-surface-variant flex items-center gap-1">
                <Icon name={c.sex === 'Hembra' ? 'female' : 'male'} className="text-[13px]" /> {c.sex}
              </span>
            )}
          </div>
          {c.profile && <p className="text-xs text-on-surface-variant font-medium">{c.profile}</p>}
          <div className="mt-2.5 flex items-start gap-2 text-xs text-on-surface-variant bg-surface-container-low p-2.5 rounded-2xl">
            <Icon name="location_on" className="text-primary text-[18px] shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-on-surface text-[13px] leading-tight">{c.address}</p>
              <p className="text-[11px] text-outline mt-0.5">
                Montería · Zona {c.zone} · <span className="font-semibold text-primary">A {formatDistance(distanceTo(c))} de ti</span>
              </p>
            </div>
          </div>
        </div>

        {/* Herramientas del rescatista */}
        {c.canEdit && (
          <section className="rounded-2xl border border-primary/20 bg-primary-fixed/15 p-3 space-y-2">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1">
              <Icon name="construction" className="text-sm" />
              {isAdmin && !c.isReporter && !c.myHelp ? 'Herramientas de administración' : c.isReporter ? 'Gestiona tu reporte' : 'Eres rescatista de este caso'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { icon: 'swap_horiz', label: 'Estado', s: 'status' as const },
                { icon: 'checklist', label: 'Necesidades', s: 'needs' as const },
                { icon: 'edit_note', label: 'Datos', s: 'edit' as const },
              ].map((b) => (
                <button key={b.s} onClick={() => setSheet(b.s)} className="py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/30 text-primary text-[11px] font-bold flex flex-col items-center gap-0.5 active:scale-95" type="button">
                  <Icon name={b.icon} className="text-lg" />
                  {b.label}
                </button>
              ))}
            </div>
            <AddPhotosButton c={c} />
          </section>
        )}

        {/* Reportante */}
        <div className="flex items-center justify-between bg-surface-container-low/70 border border-surface-container-high rounded-2xl p-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar person={c.reporter} size="w-10 h-10 text-sm" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-on-surface truncate">{c.isReporter ? 'Tú' : c.reporter.name}</span>
                {c.reporter.verified && <span className="text-[10px] text-primary font-semibold bg-primary-fixed/40 px-1.5 rounded shrink-0">Rescatista verificado</span>}
              </div>
              <p className="text-[11px] text-outline mt-0.5">Reportado {formatWhen(c.createdAt).toLowerCase()}</p>
            </div>
          </div>
          <a href="#comentarios" aria-label="Ir a los comentarios" className="w-8 h-8 rounded-full bg-surface-container-lowest text-primary flex items-center justify-center shadow-sm active:scale-95">
            <Icon name="chat" className="text-[18px]" />
          </a>
        </div>

        {/* Mapa */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-label font-bold tracking-wider text-outline uppercase">Ubicación exacta</h2>
            <span className="text-[11px] text-primary font-semibold">Zona {c.zone}</span>
          </div>
          <div className="relative w-full h-36 rounded-2xl overflow-hidden border border-surface-container-high z-0">
            <MapContainer center={[c.lat, c.lng]} zoom={16} zoomControl={false} attributionControl={false} dragging={false} scrollWheelZoom={false} doubleClickZoom={false} touchZoom={false} className="w-full h-full">
              <TileLayer url={TILE_LAYERS.claro.url} className={TILE_LAYERS.claro.className} />
              <Marker position={[c.lat, c.lng]} icon={pawIcon()} interactive={false} />
            </MapContainer>
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-[400] flex items-center justify-between gap-2">
              <a href={directionsUrl([c.lat, c.lng])} target="_blank" rel="noreferrer" className="flex-1 bg-surface-container-lowest/95 text-primary font-semibold text-xs py-2 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-95">
                <Icon name="navigation" className="text-base" /> Cómo llegar
              </a>
              <Link to={`/mapa?caso=${c.id}`} className="bg-surface-container-lowest/95 text-on-surface-variant font-medium text-xs py-2 px-3 rounded-xl shadow-md flex items-center justify-center gap-1 active:scale-95">
                <Icon name="map" className="text-base" /> Ver mapa
              </Link>
            </div>
          </div>
        </div>

        {/* Detalle */}
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-label font-bold tracking-wider text-outline uppercase">Detalle del reporte</h2>
          <div className="bg-surface-container-low rounded-2xl p-4 text-xs leading-relaxed">
            <p className="text-on-surface whitespace-pre-line">{c.description || 'Sin descripción adicional.'}</p>
            {c.medicalNote && (
              <div className="mt-3.5 pt-3 border-t border-surface-container-high/80 flex items-start gap-2">
                <Icon name="healing" className="text-base mt-0.5 text-primary" />
                <p className="text-[11px] font-medium leading-normal text-on-surface-variant">
                  <strong className="text-primary font-bold">Nota médica:</strong> {c.medicalNote}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Necesidades */}
        <section className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-label font-bold tracking-wider text-outline uppercase">¿Qué necesita?</h2>
            <span className="text-[11px] text-secondary font-bold">
              {c.needs.filter((n) => n.state !== 'cubierto').length} pendiente{c.needs.filter((n) => n.state !== 'cubierto').length === 1 ? '' : 's'}
            </span>
          </div>
          {c.needs.length === 0 && <p className="text-xs text-outline">No hay necesidades registradas.</p>}
          <div className="grid grid-cols-1 gap-2">
            {c.needs.map((n, i) => {
              const meta = NEEDS[n.need]
              const highlight = i === 0 && n.state === 'pendiente' && !status.resolved
              const st = highlight ? { label: 'Prioridad', cls: 'bg-secondary-container/20 text-secondary font-bold' } : NEED_STATES[n.state]
              return (
                <div
                  key={n.need}
                  className={`flex items-center justify-between p-3 rounded-2xl border ${
                    highlight ? 'bg-secondary-fixed/25 border-secondary-fixed/60' : n.state === 'en_camino' ? 'bg-primary-fixed/20 border-primary-fixed/50' : 'bg-surface-container-low border-surface-container-high'
                  } ${n.state === 'cubierto' ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        highlight ? 'bg-secondary-container text-white shadow-sm' : n.state === 'en_camino' ? 'bg-primary-container text-white shadow-sm' : 'bg-surface-container-highest text-on-surface-variant'
                      }`}
                    >
                      <Icon name={n.state === 'cubierto' ? 'check' : meta.icon} className="text-lg" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface leading-tight">{meta.long}</p>
                      {n.detail && <p className="text-[11px] text-outline mt-0.5">{n.detail}</p>}
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[10px] shrink-0 ${st.cls}`}>{st.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Historial */}
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-label font-bold tracking-wider text-outline uppercase">Historial del caso</h2>
          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-3 before:w-0.5 before:bg-surface-container-highest">
            {STATUS_FLOW.map((s, i) => {
              const ev = [...c.timeline].reverse().find((e) => e.status === s)
              const done = i < currentIdx || (i === currentIdx && status.resolved)
              const active = i === currentIdx && !status.resolved
              if (i > currentIdx + 1) return null
              return (
                <div key={s} className="relative">
                  {done ? (
                    <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-tertiary-container text-white flex items-center justify-center ring-4 ring-surface-container-lowest">
                      <Icon name="check" className="text-[13px] font-bold" />
                    </div>
                  ) : active ? (
                    <div className="absolute -left-6 top-0 w-5 h-5 rounded-full bg-primary-container text-white flex items-center justify-center ring-4 ring-surface-container-lowest shadow-md">
                      <Icon name={STATUS[s].icon} className="text-[12px]" />
                    </div>
                  ) : (
                    <div className="absolute -left-6 top-0 w-5 h-5 rounded-full border-2 border-dashed border-outline-variant bg-surface flex items-center justify-center ring-4 ring-surface-container-lowest">
                      <span className="w-1.5 h-1.5 rounded-full bg-outline-variant" />
                    </div>
                  )}
                  <div className={`flex flex-col ${active ? 'bg-primary-fixed/20 p-2.5 rounded-xl border border-primary-fixed/50' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs ${active ? 'font-bold text-primary' : done ? 'font-bold text-on-surface' : 'font-semibold text-outline'}`}>{STEP_TEXT[s]}</span>
                        {active && <span className="text-[9px] bg-primary text-white font-bold px-1.5 rounded-full">Activo</span>}
                      </div>
                      <span className={`text-[10px] ${active ? 'text-primary font-semibold' : 'text-outline'}`}>{ev ? formatWhen(ev.at) : 'Próximamente'}</span>
                    </div>
                    <p className={`text-[11px] mt-0.5 leading-snug ${ev ? 'text-on-surface-variant' : 'text-outline'}`}>
                      {ev?.detail ?? (s === 'en_atencion' ? 'Esperando que un voluntario tome el caso.' : 'Se actualizará cuando avance el rescate.')}
                    </p>
                  </div>
                </div>
              )
            })}
            {c.status === 'cerrado' && <p className="text-[11px] text-tertiary font-bold">Caso cerrado {formatWhen(c.updatedAt).toLowerCase()}.</p>}
          </div>
        </section>

        {/* Comunidad + fondo */}
        <section className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center -space-x-2">
              {c.helpers.slice(0, 4).map((h) => (
                <span key={h.id} className="rounded-full border-2 border-white">
                  <Avatar person={h} size="w-7 h-7 text-[10px]" />
                </span>
              ))}
              {c.helpersCount > 4 && (
                <span className="w-7 h-7 rounded-full border-2 border-white bg-primary text-white flex items-center justify-center text-[10px] font-bold">+{c.helpersCount - 4}</span>
              )}
              {c.helpersCount === 0 && (
                <span className="w-7 h-7 rounded-full bg-surface-container-high text-outline flex items-center justify-center">
                  <Icon name="group_add" className="text-sm" />
                </span>
              )}
            </div>
            <span className="text-[11px] font-bold text-primary">{c.helpersCount ? 'Comunidad activa' : 'Sin voluntarios aún'}</span>
          </div>
          {c.helpersCount === 0 ? (
            <p className="text-[11px] text-on-surface-variant">Sé la primera persona en ayudar a este animal.</p>
          ) : (
            <ul className="space-y-1">
              {c.helpers.map((h) => (
                <li key={h.id} className="text-[11px] text-on-surface-variant flex gap-1">
                  <strong className="text-on-surface">{h.name}</strong>
                  {h.verified && <Icon name="verified" fill className="text-primary text-xs" />}· {h.helpType}
                </li>
              ))}
            </ul>
          )}
          <div className="pt-1">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-on-surface-variant font-medium">Fondo del caso</span>
              <span className="font-bold text-primary">
                {formatCOP(c.donationRaised)} <span className="text-outline font-medium">de {formatCOP(c.donationGoal)}</span>
              </span>
            </div>
            <ProgressBar value={(c.donationRaised / c.donationGoal) * 100} className="h-2" />
          </div>
        </section>

        <Comments caseId={c.id} />
      </div>

      {/* Barra inferior */}
      <div className="fixed bottom-0 inset-x-0 z-[700] flex justify-center pointer-events-none">
        <nav aria-label="Acciones de ayuda" className="w-full max-w-[420px] bg-surface-container-lowest/95 backdrop-blur-lg px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] pointer-events-auto flex items-center gap-3">
          <button
            onClick={() => setSheet('donate')}
            disabled={c.status === 'cerrado'}
            className="flex-1 py-3 px-3 rounded-2xl border-2 border-primary-container text-primary-container font-headline font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40"
            type="button"
          >
            <Icon name="volunteer_activism" className="text-[18px]" /> Donar
          </button>
          <button
            onClick={() => setSheet('help')}
            disabled={c.status === 'cerrado' && !c.myHelp}
            className={`flex-[1.5] py-3 px-4 rounded-2xl font-headline font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-40 ${
              c.myHelp ? 'bg-tertiary-container text-white' : 'bg-secondary-container text-on-secondary'
            }`}
            type="button"
          >
            <Icon name={c.myHelp ? 'check_circle' : 'pets'} fill={Boolean(c.myHelp)} className="text-[20px]" />
            {c.myHelp ? 'Estás ayudando' : 'Quiero ayudar'}
          </button>
        </nav>
      </div>

      <HelpSheet c={c} open={sheet === 'help'} onClose={close} />
      <DonateSheet c={c} open={sheet === 'donate'} onClose={close} />
      {c.canEdit && (
        <>
          <StatusSheet c={c} open={sheet === 'status'} onClose={close} />
          <NeedsSheet c={c} open={sheet === 'needs'} onClose={close} />
          <EditSheet c={c} open={sheet === 'edit'} onClose={close} />
        </>
      )}
      <FlagSheet c={c} open={sheet === 'flag'} onClose={close} />
      <Sheet open={sheet === 'more'} onClose={close} title="Opciones del caso">
        <div className="divide-y divide-surface-container-high">
          <button onClick={() => (close(), share())} className="w-full flex items-center gap-3 py-3 text-xs font-semibold text-on-surface" type="button">
            <Icon name="share" className="text-primary" /> Compartir caso
          </button>
          <a href={directionsUrl([c.lat, c.lng])} target="_blank" rel="noreferrer" className="w-full flex items-center gap-3 py-3 text-xs font-semibold text-on-surface">
            <Icon name="navigation" className="text-primary" /> Abrir ruta en Google Maps
          </a>
          {!c.isReporter && (
            <button onClick={() => setSheet('flag')} className="w-full flex items-center gap-3 py-3 text-xs font-semibold text-error" type="button">
              <Icon name="flag" /> Reportar problema con este caso
            </button>
          )}
          {isAdmin && (
            <Link to="/admin" className="w-full flex items-center gap-3 py-3 text-xs font-semibold text-on-surface">
              <Icon name="admin_panel_settings" className="text-primary" /> Abrir panel de moderación
            </Link>
          )}
        </div>
      </Sheet>
    </main>
  )
}

/* ---------------- Subcomponentes ---------------- */

function AddPhotosButton({ c }: { c: ApiCaseDetail }) {
  const input = useRef<HTMLInputElement>(null)
  const add = useAddPhotos(c.id)
  const { showToast } = useApp()
  const [busy, setBusy] = useState(false)
  if (c.photos.length >= 8) return null
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []).slice(0, Math.min(4, 8 - c.photos.length))
          e.target.value = ''
          if (!files.length) return
          setBusy(true)
          try {
            const keys: string[] = []
            for (const f of files) keys.push((await uploadImage(await compressImage(f))).key)
            await add.mutateAsync(keys)
            showToast(`${keys.length} foto${keys.length === 1 ? '' : 's'} agregada${keys.length === 1 ? '' : 's'}`)
          } catch (err) {
            showToast(errorMessage(err), 'error')
          } finally {
            setBusy(false)
          }
        }}
      />
      <button
        onClick={() => input.current?.click()}
        disabled={busy}
        className="w-full py-2 rounded-xl border border-dashed border-primary/40 text-primary text-[11px] font-bold flex items-center justify-center gap-1.5"
        type="button"
      >
        {busy ? <Spinner className="w-4 h-4" /> : <Icon name="add_a_photo" className="text-base" />}
        {busy ? 'Subiendo fotos…' : 'Agregar fotos de seguimiento'}
      </button>
    </>
  )
}

function Comments({ caseId }: { caseId: number }) {
  const q = useComments(caseId)
  const post = usePostComment(caseId)
  const { user } = useAuth()
  const { showToast } = useApp()
  const [text, setText] = useState('')

  function send(e: FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    post.mutate(body, {
      onSuccess: () => setText(''),
      onError: (err) => showToast(errorMessage(err), 'error'),
    })
  }

  return (
    <section id="comentarios" className="flex flex-col gap-3 scroll-mt-4">
      <h2 className="text-xs font-label font-bold tracking-wider text-outline uppercase flex items-center gap-1.5">
        Coordinación del rescate {q.data && q.data.length > 0 && <span className="text-secondary">{q.data.length}</span>}
      </h2>
      {q.isPending ? (
        <Spinner className="w-5 h-5" />
      ) : q.data?.length ? (
        <ul className="space-y-3">
          {q.data.map((m) => {
            const mine = m.user.id === user?.id
            return (
              <li key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
                <Avatar person={m.user} size="w-7 h-7 text-[10px]" />
                <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-xs ${mine ? 'bg-primary-container text-white rounded-tr-sm' : 'bg-surface-container-low text-on-surface rounded-tl-sm'}`}>
                  <p className={`text-[10px] font-bold mb-0.5 ${mine ? 'text-inverse-primary' : 'text-primary'}`}>
                    {mine ? 'Tú' : m.user.name} · <span className="font-medium">{timeAgo(m.createdAt).toLowerCase()}</span>
                  </p>
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-xs text-outline">Aún no hay mensajes. Coordina aquí con quienes están ayudando.</p>
      )}
      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 500))}
          rows={1}
          placeholder="Escribe un mensaje para el equipo…"
          className="flex-1 resize-none rounded-2xl border-outline-variant/50 bg-surface-container-lowest text-xs py-2.5 focus:border-primary focus:ring-primary/20"
          aria-label="Mensaje"
        />
        <button disabled={!text.trim() || post.isPending} className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center disabled:opacity-40 shrink-0" type="submit" aria-label="Enviar mensaje">
          {post.isPending ? <Spinner className="w-4 h-4 border-white/30 border-t-white" /> : <Icon name="send" className="text-base" />}
        </button>
      </form>
    </section>
  )
}

function HelpSheet({ c, open, onClose }: { c: ApiCaseDetail; open: boolean; onClose: () => void }) {
  const join = useJoinHelp(c.id)
  const leave = useLeaveHelp(c.id)
  const { showToast } = useApp()
  const [choice, setChoice] = useState(c.myHelp && HELP_OPTIONS.some((o) => o.key === c.myHelp) ? c.myHelp : HELP_OPTIONS[0]!.key)
  return (
    <Sheet open={open} onClose={onClose} title={`¿Cómo puedes apoyar a ${c.name}?`} subtitle={c.myHelp ? `Ya te uniste: ${c.myHelp}` : 'Al unirte podrás actualizar el caso y coordinar con el equipo'}>
      <div className="space-y-2">
        {HELP_OPTIONS.map((o) => (
          <label key={o.key} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${choice === o.key ? 'border-primary bg-primary-fixed/15' : 'border-surface-container-high hover:bg-surface-container-low'}`}>
            <input type="radio" name="supportType" checked={choice === o.key} onChange={() => setChoice(o.key)} className="text-primary focus:ring-primary" />
            <Icon name={o.icon} className={o.color} />
            <div className="flex-1 text-xs">
              <strong className="block text-on-surface">{o.key}</strong>
              <span className="text-outline text-[11px]">{o.hint}</span>
            </div>
          </label>
        ))}
      </div>
      <button
        disabled={join.isPending}
        onClick={() =>
          join.mutate(choice, {
            onSuccess: () => {
              onClose()
              showToast(c.myHelp ? 'Actualizaste tu forma de ayudar' : `¡Te uniste al rescate de ${c.name}!`)
            },
            onError: (err) => showToast(errorMessage(err), 'error'),
          })
        }
        className="w-full py-3.5 bg-primary-container text-white font-bold rounded-2xl text-xs active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
        type="button"
      >
        {join.isPending && <Spinner className="w-4 h-4 border-white/30 border-t-white" />}
        {c.myHelp ? 'Actualizar mi ayuda' : 'Unirme al rescate'} <Icon name="arrow_forward" className="text-base" />
      </button>
      {c.myHelp && (
        <button
          onClick={() =>
            leave.mutate(undefined, {
              onSuccess: () => {
                onClose()
                showToast('Dejaste de ayudar en este caso', 'info')
              },
              onError: (err) => showToast(errorMessage(err), 'error'),
            })
          }
          className="text-xs font-bold text-error"
          type="button"
        >
          Ya no puedo ayudar
        </button>
      )}
    </Sheet>
  )
}

function DonateSheet({ c, open, onClose }: { c: ApiCaseDetail; open: boolean; onClose: () => void }) {
  const donate = useDonate()
  const { showToast } = useApp()
  const [amount, setAmount] = useState(20_000)
  const [custom, setCustom] = useState('')
  const finalAmount = custom ? parseInt(custom, 10) || 0 : amount
  return (
    <Sheet open={open} onClose={onClose} title={`Donar para ${c.name}`} subtitle={`Meta: ${formatCOP(c.donationGoal)} (recaudado: ${formatCOP(c.donationRaised)})`}>
      <ProgressBar value={(c.donationRaised / c.donationGoal) * 100} />
      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            onClick={() => {
              setAmount(a)
              setCustom('')
            }}
            className={`py-2.5 rounded-xl border border-primary font-bold text-[11px] active:scale-95 ${!custom && amount === a ? 'bg-primary-container text-white' : 'text-primary'}`}
            type="button"
          >
            ${formatNumber(a / 1000)}k
          </button>
        ))}
        <input
          inputMode="numeric"
          placeholder="Otro"
          aria-label="Otro monto"
          value={custom ? formatNumber(Number(custom)) : ''}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className={`py-2.5 rounded-xl border text-center font-bold text-[11px] text-primary placeholder:text-primary focus:ring-primary ${custom ? 'border-primary bg-primary-fixed/30' : 'border-primary'}`}
        />
      </div>
      <p className="text-[11px] text-outline flex gap-1.5">
        <Icon name="info" className="text-sm" /> Versión de prueba: no se realiza ningún cobro real.
      </p>
      <button
        disabled={finalAmount < 1000 || donate.isPending}
        onClick={() =>
          donate.mutate(
            { amount: finalAmount, frequency: 'unica', destination: `Caso ${c.name}`, method: 'Nequi / PSE / Tarjeta', caseId: c.id },
            {
              onSuccess: () => {
                onClose()
                setCustom('')
                showToast(`¡Gracias por tu aporte de ${formatCOP(finalAmount)} para ${c.name}!`, 'favorite')
              },
              onError: (err) => showToast(errorMessage(err), 'error'),
            },
          )
        }
        className="w-full py-3.5 bg-secondary-container text-white font-extrabold rounded-2xl text-xs active:scale-95 flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
        type="button"
      >
        <Icon name="favorite" className="text-base" /> Aportar {finalAmount >= 1000 ? formatCOP(finalAmount) : ''}
      </button>
    </Sheet>
  )
}

function StatusSheet({ c, open, onClose }: { c: ApiCaseDetail; open: boolean; onClose: () => void }) {
  const change = useChangeStatus(c.id)
  const { showToast } = useApp()
  const [status, setStatus] = useState<CaseStatus>(c.status)
  const [detail, setDetail] = useState('')
  const options: CaseStatus[] = ['reportado', 'en_atencion', 'rescatado', 'adopcion', 'cerrado']
  return (
    <Sheet open={open} onClose={onClose} title="Actualizar estado" subtitle="Todas las personas que siguen el caso recibirán una notificación">
      <div className="space-y-2">
        {options.map((s) => (
          <label key={s} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${status === s ? 'border-primary bg-primary-fixed/15' : 'border-surface-container-high'}`}>
            <input type="radio" name="status" checked={status === s} onChange={() => setStatus(s)} className="text-primary focus:ring-primary" />
            <Icon name={STATUS[s].icon} className="text-primary" />
            <span className="text-xs font-bold text-on-surface flex-1">{STEP_TEXT[s]}</span>
            {s === c.status && <span className="text-[10px] text-outline">Actual</span>}
          </label>
        ))}
      </div>
      <textarea
        value={detail}
        onChange={(e) => setDetail(e.target.value.slice(0, 200))}
        rows={2}
        placeholder="¿Qué pasó? (opcional) p. ej. «Lo llevamos a la clínica»"
        className="w-full rounded-xl border-outline-variant/50 text-xs focus:border-primary focus:ring-primary/20"
      />
      <button
        disabled={status === c.status || change.isPending}
        onClick={() =>
          change.mutate(
            { status, detail: detail.trim() || undefined },
            {
              onSuccess: () => {
                onClose()
                setDetail('')
                showToast(`Estado actualizado: ${STATUS[status].label}`)
              },
              onError: (err) => showToast(errorMessage(err), 'error'),
            },
          )
        }
        className="w-full py-3.5 bg-primary-container text-white font-bold rounded-2xl text-xs disabled:opacity-50"
        type="button"
      >
        Guardar estado
      </button>
    </Sheet>
  )
}

function NeedsSheet({ c, open, onClose }: { c: ApiCaseDetail; open: boolean; onClose: () => void }) {
  const update = useUpdateNeeds(c.id)
  const { showToast } = useApp()
  const [items, setItems] = useState<NeedItem[]>(c.needs)
  useEffect(() => {
    if (open) setItems(c.needs)
  }, [open, c.needs])
  const has = (n: Need) => items.find((i) => i.need === n)
  const toggle = (n: Need) => setItems((cur) => (has(n) ? cur.filter((i) => i.need !== n) : [...cur, { need: n, state: 'pendiente', detail: null }]))
  const setField = (n: Need, patch: Partial<NeedItem>) => setItems((cur) => cur.map((i) => (i.need === n ? { ...i, ...patch } : i)))
  return (
    <Sheet open={open} onClose={onClose} title="Necesidades del caso" subtitle="Marca lo que ya está en camino o cubierto">
      <div className="space-y-2">
        {ALL_NEEDS.map((n) => {
          const item = has(n)
          return (
            <div key={n} className={`rounded-xl border p-2.5 ${item ? 'border-primary/40 bg-primary-fixed/10' : 'border-surface-container-high'}`}>
              <label className="flex items-center gap-2.5 text-xs font-bold text-on-surface">
                <input type="checkbox" checked={Boolean(item)} onChange={() => toggle(n)} className="rounded text-primary focus:ring-primary" />
                <Icon name={NEEDS[n].icon} className={`text-base ${NEEDS[n].color}`} />
                {NEEDS[n].long}
              </label>
              {item && (
                <div className="mt-2 space-y-2 pl-6">
                  <div className="flex gap-1">
                    {(Object.keys(NEED_STATES) as NeedState[]).map((s) => (
                      <button
                        key={s}
                        onClick={() => setField(n, { state: s })}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-bold ${item.state === s ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant'}`}
                        type="button"
                      >
                        {NEED_STATES[s].label}
                      </button>
                    ))}
                  </div>
                  <input
                    value={item.detail ?? ''}
                    onChange={(e) => setField(n, { detail: e.target.value.slice(0, 120) })}
                    placeholder="Detalle (opcional)"
                    className="w-full rounded-lg border-outline-variant/50 text-[11px] py-1.5 focus:border-primary focus:ring-primary/20"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
      <button
        disabled={update.isPending}
        onClick={() =>
          update.mutate(
            items.map((i) => ({ ...i, detail: i.detail?.trim() || null })),
            {
              onSuccess: () => {
                onClose()
                showToast('Necesidades actualizadas')
              },
              onError: (err) => showToast(errorMessage(err), 'error'),
            },
          )
        }
        className="w-full py-3.5 bg-primary-container text-white font-bold rounded-2xl text-xs disabled:opacity-50"
        type="button"
      >
        Guardar necesidades
      </button>
    </Sheet>
  )
}

function EditSheet({ c, open, onClose }: { c: ApiCaseDetail; open: boolean; onClose: () => void }) {
  const update = useUpdateCase(c.id)
  const { showToast } = useApp()
  const [f, setF] = useState({
    name: c.name,
    sex: c.sex ?? '',
    profile: c.profile ?? '',
    description: c.description,
    medicalNote: c.medicalNote ?? '',
    condition: c.condition,
    donationGoal: String(c.donationGoal),
  })
  const field = 'w-full rounded-xl border-outline-variant/50 text-xs focus:border-primary focus:ring-primary/20'
  const label = 'text-[11px] font-bold text-primary'
  return (
    <Sheet open={open} onClose={onClose} title="Editar datos del caso">
      <label className="space-y-1 block">
        <span className={label}>Nombre o apodo</span>
        <input className={field} value={f.name} maxLength={30} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 block">
          <span className={label}>Sexo</span>
          <select className={field} value={f.sex} onChange={(e) => setF({ ...f, sex: e.target.value })}>
            <option value="">Sin dato</option>
            <option value="Hembra">Hembra</option>
            <option value="Macho">Macho</option>
          </select>
        </label>
        <label className="space-y-1 block">
          <span className={label}>Condición</span>
          <select className={field} value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value as Condition })}>
            {(Object.keys(CONDITIONS) as Condition[]).map((k) => (
              <option key={k} value={k}>
                {CONDITIONS[k].label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="space-y-1 block">
        <span className={label}>Perfil</span>
        <input className={field} value={f.profile} maxLength={80} placeholder="p. ej. Perra mestiza adulta · ~3 años · Mediana" onChange={(e) => setF({ ...f, profile: e.target.value })} />
      </label>
      <label className="space-y-1 block">
        <span className={label}>Descripción</span>
        <textarea className={field} rows={3} value={f.description} maxLength={500} onChange={(e) => setF({ ...f, description: e.target.value })} />
      </label>
      <label className="space-y-1 block">
        <span className={label}>Nota médica</span>
        <textarea className={field} rows={2} value={f.medicalNote} maxLength={300} onChange={(e) => setF({ ...f, medicalNote: e.target.value })} />
      </label>
      <label className="space-y-1 block">
        <span className={label}>Meta del fondo (COP)</span>
        <input className={field} inputMode="numeric" value={formatNumber(Number(f.donationGoal || 0))} onChange={(e) => setF({ ...f, donationGoal: e.target.value.replace(/\D/g, '').slice(0, 8) })} />
      </label>
      <button
        disabled={update.isPending || !f.name.trim()}
        onClick={() =>
          update.mutate(
            {
              name: f.name.trim(),
              sex: (f.sex || null) as ApiCaseDetail['sex'],
              profile: f.profile.trim() || null,
              description: f.description.trim(),
              medicalNote: f.medicalNote.trim() || null,
              condition: f.condition,
              donationGoal: Math.max(10_000, Number(f.donationGoal) || 10_000),
            },
            {
              onSuccess: () => {
                onClose()
                showToast('Datos del caso actualizados')
              },
              onError: (err) => showToast(errorMessage(err), 'error'),
            },
          )
        }
        className="w-full py-3.5 bg-primary-container text-white font-bold rounded-2xl text-xs disabled:opacity-50"
        type="button"
      >
        Guardar cambios
      </button>
    </Sheet>
  )
}

function FlagSheet({ c, open, onClose }: { c: ApiCaseDetail; open: boolean; onClose: () => void }) {
  const flag = useFlag(c.id)
  const { showToast } = useApp()
  return (
    <Sheet open={open} onClose={onClose} title="Reportar un problema" subtitle="El equipo de moderación revisará este caso">
      <div className="space-y-2">
        {(Object.keys(FLAG_REASONS) as FlagReason[]).map((r) => (
          <button
            key={r}
            disabled={flag.isPending}
            onClick={() =>
              flag.mutate(r, {
                onSuccess: () => {
                  onClose()
                  showToast('Gracias, el equipo lo revisará', 'flag')
                },
                onError: (err) => showToast(errorMessage(err), 'error'),
              })
            }
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-surface-container-high text-xs font-semibold text-on-surface hover:bg-surface-container-low"
            type="button"
          >
            <Icon name={FLAG_REASONS[r].icon} className="text-error" /> {FLAG_REASONS[r].label}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
