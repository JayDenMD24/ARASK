import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { CaseCard } from '../components/CaseCard'
import { caseIcon, Recenter, TILE_LAYERS, userIcon } from '../components/map'
import { Avatar, EmptyState, ErrorState, Icon, Spinner } from '../components/ui'
import { CITY_LABEL, CONDITIONS, STATUS } from '../data/catalog'
import { formatNumber, timeAgo } from '../lib/format'
import { formatDistance } from '../lib/geo'
import { useCases, useStats } from '../lib/queries'
import { useApp } from '../store/AppStore'
import { useAuth } from '../store/AuthProvider'

const NEARBY_RADIUS = 2000

export default function Home() {
  const { user } = useAuth()
  const { distanceTo, location, requestLocation, showToast } = useApp()
  const navigate = useNavigate()
  const casesQ = useCases('all')
  const statsQ = useStats()
  const cases = useMemo(() => casesQ.data ?? [], [casesQ.data])

  const open = useMemo(() => cases.filter((c) => !STATUS[c.status].resolved), [cases])
  const nearbyOpen = open.filter((c) => distanceTo(c) <= NEARBY_RADIUS)
  const urgent = useMemo(
    () =>
      open
        .filter((c) => c.status === 'reportado' && CONDITIONS[c.condition].priority >= 3)
        .sort((a, b) => CONDITIONS[b.condition].priority - CONDITIONS[a.condition].priority || distanceTo(a) - distanceTo(b))[0],
    [open, distanceTo],
  )
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="w-full max-w-[420px] mx-auto bg-surface min-h-dvh flex flex-col relative pb-28">
      <header className="bg-surface shadow-sm sticky top-0 z-[500] pt-safe">
        <div className="flex justify-between items-center w-full px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center shadow-sm">
              <Icon name="pets" fill className="text-2xl text-inverse-primary" />
            </div>
            <div>
              <h1 className="font-headline font-black text-xl text-primary tracking-tight leading-none">ARASK</h1>
              <span className="text-[10px] font-label font-bold text-outline tracking-wider uppercase">Red Comunitaria</span>
            </div>
          </div>
          <Link to="/notificaciones" aria-label="Notificaciones" className="relative p-2 rounded-full hover:bg-surface-container active:scale-95 transition-all">
            <Icon name="notifications" className="text-primary text-2xl" />
            {(user?.unread ?? 0) > 0 && (
              <span className="absolute top-1 right-0.5 min-w-4 h-4 px-1 bg-error text-white text-[9px] font-bold rounded-full ring-2 ring-surface flex items-center justify-center">
                {user!.unread > 9 ? '9+' : user!.unread}
              </span>
            )}
          </Link>
        </div>
        <div className="px-5 pt-1 pb-3 flex items-center justify-between">
          <div>
            <h2 className="font-headline font-bold text-lg text-primary flex items-center gap-1.5">
              Hola, {firstName} <span className="text-xl">👋</span>
            </h2>
            <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1 mt-0.5">
              <span className={`w-2 h-2 rounded-full inline-block ${nearbyOpen.length ? 'bg-secondary-container animate-pulse' : 'bg-tertiary-container'}`} />
              {casesQ.isPending
                ? 'Buscando reportes cerca…'
                : nearbyOpen.length === 0
                  ? 'No hay animales en riesgo cerca de ti'
                  : `${nearbyOpen.length} ${nearbyOpen.length === 1 ? 'animal necesita' : 'animales necesitan'} ayuda cerca de ti`}
            </p>
          </div>
          <Link to="/perfil" className="rounded-full ring-2 ring-primary/20 shadow-xs" aria-label="Mi perfil">
            {user && <Avatar person={user} size="w-9 h-9 text-sm" />}
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 space-y-4 pt-2">
        {urgent && (
          <section className="relative overflow-hidden rounded-3xl bg-error-container/85 border border-error/20 p-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-error text-on-error flex items-center justify-center shrink-0 shadow-sm">
                <Icon name="emergency" fill className="text-xl" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-headline font-extrabold uppercase tracking-wider bg-error text-on-error">Prioridad alta</span>
                  <span className="text-[11px] font-medium text-error flex items-center gap-0.5">
                    <Icon name="schedule" className="text-[13px]" />
                    {timeAgo(urgent.createdAt)}
                  </span>
                </div>
                <h3 className="font-headline font-bold text-sm text-on-error-container leading-snug">
                  Caso {CONDITIONS[urgent.condition].label.toLowerCase()} sin atender a {formatDistance(distanceTo(urgent))}
                </h3>
                <p className="text-xs text-on-error-container/80 mt-1 line-clamp-1">{urgent.description || urgent.name}</p>
              </div>
            </div>
            <div className="mt-3.5 pt-3 border-t border-error/15 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-error min-w-0">
                <Icon name="near_me" className="text-base" />
                <span className="truncate">{urgent.address}</span>
              </div>
              <Link
                to={`/caso/${urgent.id}`}
                className="px-3.5 py-1.5 rounded-full bg-on-error text-error font-headline font-bold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 shrink-0"
              >
                Ver caso <Icon name="arrow_forward" className="text-sm" />
              </Link>
            </div>
          </section>
        )}

        <section className="relative rounded-3xl bg-surface-container-lowest p-2 shadow-sm border border-outline-variant/30">
          <div className="flex items-center justify-between px-3 py-2">
            <Link to="/mapa" className="flex items-center gap-1.5">
              <Icon name="map" className="text-primary text-base" />
              <span className="font-headline font-bold text-xs text-primary">Mapa de la zona</span>
            </Link>
            <div className="flex items-center gap-3 text-[11px] font-label font-medium text-on-surface-variant">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-container" /> Urgente
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary-container" /> Resuelto
              </span>
            </div>
          </div>
          <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-outline-variant/40 z-0">
            <MapContainer
              center={location.coords}
              zoom={14}
              zoomControl={false}
              attributionControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              keyboard={false}
              className="w-full h-full"
            >
              <TileLayer url={TILE_LAYERS.claro.url} className={TILE_LAYERS.claro.className} />
              <Recenter center={location.coords} />
              <Marker position={location.coords} icon={userIcon(false)} interactive={false} />
              {cases.map((c) => (
                <Marker key={c.id} position={[c.lat, c.lng]} icon={caseIcon(c, undefined, 30)} eventHandlers={{ click: () => navigate(`/caso/${c.id}`) }} />
              ))}
            </MapContainer>
            <button
              aria-label="Recentrar mapa"
              onClick={async () => {
                const s = await requestLocation()
                if (s.source !== 'gps') showToast(`Sin GPS: mostrando el centro de ${CITY_LABEL}`, 'location_off')
              }}
              className="absolute bottom-3 right-3 z-[400] w-9 h-9 rounded-xl bg-surface-container-lowest/90 backdrop-blur-sm shadow-md border border-outline-variant/40 flex items-center justify-center text-primary active:scale-95 transition-transform"
              type="button"
            >
              <Icon name="my_location" className="text-lg" />
            </button>
          </div>
          <div className="pt-2.5 pb-1">
            <Link
              to="/reportar"
              className="w-full py-3 px-5 rounded-2xl bg-secondary text-on-secondary font-headline font-extrabold text-sm shadow-lg hover:shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
            >
              <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                <Icon name="add" className="text-base" />
              </span>
              <span className="tracking-wide">Reportar animal en calle</span>
              <Icon name="arrow_forward_ios" className="text-base opacity-75" />
            </Link>
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-headline font-bold text-xs uppercase tracking-wider text-outline">Impacto en la comunidad</h2>
            <span className="text-[11px] font-semibold text-primary flex items-center gap-0.5">
              <Icon name="location_city" className="text-xs" /> {CITY_LABEL}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: 'pets', value: statsQ.data?.censados, label: 'Reportados', box: 'bg-primary-fixed/50 text-primary', text: 'text-primary' },
              { icon: 'favorite', value: statsQ.data?.adopciones, label: 'En adopción', box: 'bg-error-container text-error', text: 'text-on-surface' },
              { icon: 'task_alt', value: statsQ.data?.atendidos, label: 'Atendidos', box: 'bg-tertiary-fixed text-tertiary', text: 'text-primary' },
            ].map((s) => (
              <div key={s.label} className="bg-surface-container-lowest rounded-2xl p-3 border border-outline-variant/20 shadow-xs flex flex-col items-center text-center">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${s.box}`}>
                  <Icon name={s.icon} fill className="text-lg" />
                </div>
                <span className={`font-headline font-extrabold text-base leading-tight ${s.text}`}>{s.value === undefined ? '–' : formatNumber(s.value)}</span>
                <span className="font-label text-[10px] text-on-surface-variant font-medium mt-0.5 leading-tight">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <h2 className="font-headline font-bold text-base text-primary">Reportes recientes</h2>
              {cases.length > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-primary-fixed text-primary font-bold text-[11px] flex items-center justify-center">{cases.length}</span>
              )}
            </div>
            {cases.length > 0 && (
              <Link to="/mapa?vista=lista" className="text-xs font-headline font-bold text-primary hover:underline flex items-center gap-0.5">
                Ver todos <Icon name="chevron_right" className="text-sm" />
              </Link>
            )}
          </div>
          {casesQ.isPending ? (
            <div className="py-10 flex justify-center">
              <Spinner />
            </div>
          ) : casesQ.isError ? (
            <ErrorState error={casesQ.error} onRetry={() => casesQ.refetch()} />
          ) : cases.length === 0 ? (
            <EmptyState icon="pets" title="Aún no hay reportes" text="Cuando alguien reporte un animal en la calle aparecerá aquí. ¡Puedes ser la primera persona!">
              <Link to="/reportar" className="mt-2 px-4 py-2 rounded-full bg-secondary-container text-white text-xs font-bold">
                Hacer un reporte
              </Link>
            </EmptyState>
          ) : (
            <div className="space-y-3.5">
              {cases.slice(0, 5).map((c) => (
                <CaseCard key={c.id} c={c} />
              ))}
            </div>
          )}
        </section>
        <div className="h-6" />
      </main>
    </div>
  )
}
