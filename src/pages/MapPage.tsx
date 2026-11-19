import type L from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { CaseRow } from '../components/CaseCard'
import { caseIcon, InvalidateOnResize, TILE_LAYERS, userIcon } from '../components/map'
import { Icon } from '../components/ui'
import { CITY_LABEL, CONDITIONS, STATUS, ZONES } from '../data/catalog'
import type { Need, Zone } from '../data/types'
import { formatDistance } from '../lib/geo'
import { useApp } from '../store/AppStore'
import { useCases } from '../lib/queries'

type NeedFilter = 'todos' | 'urgente' | Need
const NEED_FILTERS: { key: NeedFilter; label: string; icon?: string; color?: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'urgente', label: 'Urgente' },
  { key: 'veterinario', label: 'Veterinario', icon: 'medical_services', color: 'text-primary' },
  { key: 'alimento', label: 'Alimento', icon: 'restaurant', color: 'text-secondary-container' },
  { key: 'traslado', label: 'Traslado', icon: 'local_shipping', color: 'text-primary' },
  { key: 'hogar', label: 'Hogar temporal', icon: 'cottage', color: 'text-tertiary-container' },
]

export default function MapPage() {
  const { location, requestLocation, distanceTo, showToast } = useApp()
  const casesQ = useCases('all')
  const cases = useMemo(() => casesQ.data ?? [], [casesQ.data])
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [map, setMap] = useState<L.Map | null>(null)
  const [query, setQuery] = useState('')
  const [needFilter, setNeedFilter] = useState<NeedFilter>('todos')
  const [zone, setZone] = useState<Zone | 'Todas'>('Todas')
  const [layer, setLayer] = useState<keyof typeof TILE_LAYERS>('claro')
  const [showFilters, setShowFilters] = useState(true)
  const view = params.get('vista') === 'lista' ? 'lista' : 'mapa'
  const focusId = params.get('caso')

  const setView = (v: 'mapa' | 'lista') => {
    const next = new URLSearchParams(params)
    if (v === 'lista') next.set('vista', 'lista')
    else next.delete('vista')
    setParams(next, { replace: true })
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cases
      .filter((c) => {
        if (needFilter === 'urgente') {
          if (STATUS[c.status].resolved || CONDITIONS[c.condition].priority < 3) return false
        } else if (needFilter !== 'todos' && !c.needs.some((n) => n.need === needFilter)) return false
        if (zone !== 'Todas' && c.zone !== zone) return false
        if (q && !`${c.name} ${c.address} ${c.zone} ${c.description}`.toLowerCase().includes(q)) return false
        return true
      })
      .sort((a, b) => {
        const ra = STATUS[a.status].resolved ? 1 : 0
        const rb = STATUS[b.status].resolved ? 1 : 0
        return ra - rb || distanceTo(a) - distanceTo(b)
      })
  }, [cases, needFilter, zone, query, distanceTo])

  const radius = filtered.length ? Math.max(...filtered.map((c) => distanceTo(c))) : 0

  // Enfocar un caso recibido por URL (?caso=id)
  useEffect(() => {
    if (!map || !focusId) return
    const c = cases.find((x) => String(x.id) === focusId)
    if (c) map.setView([c.lat, c.lng], 16, { animate: true })
  }, [map, focusId, cases])

  const focus = (lat: number, lng: number) => {
    setView('mapa')
    map?.setView([lat, lng], 16, { animate: true })
  }

  return (
    <div className="relative w-full max-w-[420px] mx-auto h-dvh overflow-hidden bg-surface-container flex flex-col">
      {/* Barra superior */}
      <header className="bg-surface shadow-sm flex justify-between items-center w-full px-5 py-3.5 z-[600] relative pt-[calc(env(safe-area-inset-top)+0.875rem)]">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-full flex items-center justify-center bg-surface-container text-primary">
            <Icon name="pets" fill className="text-2xl" />
          </span>
          <span className="font-headline font-black text-xl text-primary tracking-tight">ARASK</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-tertiary-fixed text-on-tertiary-fixed-variant">
            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${location.source === 'gps' ? 'bg-tertiary-container animate-pulse' : 'bg-outline'}`} />
            {location.source === 'gps' ? 'GPS activo' : CITY_LABEL}
          </span>
        </div>
      </header>

      <main className="relative flex-1 w-full overflow-hidden">
        {/* Mapa */}
        <div className="absolute inset-0 z-0">
          <MapContainer ref={setMap} center={location.coords} zoom={14} zoomControl={false} className="w-full h-full">
            <TileLayer key={layer} url={TILE_LAYERS[layer].url} attribution={TILE_LAYERS[layer].attribution} className={TILE_LAYERS[layer].className} />
            <InvalidateOnResize />
            <Marker position={location.coords} icon={userIcon()} interactive={false} />
            {filtered.map((c) => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                icon={caseIcon(c, STATUS[c.status].resolved ? 'Resuelto' : formatDistance(distanceTo(c)))}
                eventHandlers={{ click: () => navigate(`/caso/${c.id}`) }}
              />
            ))}
          </MapContainer>
        </div>

        {/* Búsqueda y filtros */}
        <div className="absolute top-3 inset-x-0 z-[500] px-4 flex flex-col gap-2.5 pointer-events-none">
          <div className="pointer-events-auto w-full flex items-center gap-2 bg-surface-container-lowest/95 backdrop-blur-md rounded-full px-3.5 py-2 shadow-lg border border-surface-variant/80 focus-within:ring-2 focus-within:ring-primary-container">
            <Icon name="search" className="text-outline text-xl" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-transparent border-none text-xs font-medium text-on-surface placeholder:text-outline focus:outline-none focus:ring-0 p-0"
              placeholder="Buscar nombre, calle o barrio..."
              type="search"
              aria-label="Buscar casos"
            />
            {query && (
              <button aria-label="Limpiar búsqueda" onClick={() => setQuery('')} className="text-outline" type="button">
                <Icon name="close" className="text-base" />
              </button>
            )}
            <button
              aria-label={showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
              onClick={() => setShowFilters((v) => !v)}
              className="relative w-7 h-7 shrink-0 rounded-full flex items-center justify-center bg-surface-container text-on-surface-variant hover:text-primary active:scale-95 transition-all"
              type="button"
            >
              <Icon name="tune" className="text-base" />
              {(needFilter !== 'todos' || zone !== 'Todas') && (
                <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-secondary-container" />
              )}
            </button>
          </div>

          {showFilters && (
            <>
              <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto py-0.5 -mx-1 px-1">
                {NEED_FILTERS.map((f) => {
                  const active = needFilter === f.key
                  return (
                    <button
                      key={f.key}
                      onClick={() => setNeedFilter(f.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs shadow-sm whitespace-nowrap active:scale-95 transition-transform ${
                        active
                          ? 'bg-primary-container text-white font-bold'
                          : `bg-surface-container-lowest/95 text-on-surface font-medium border ${f.key === 'urgente' ? 'border-error/30' : 'border-surface-variant'}`
                      }`}
                      type="button"
                    >
                      {f.key === 'urgente' && <span className="w-2 h-2 rounded-full bg-error" />}
                      {f.icon && <Icon name={f.icon} className={`text-sm ${active ? '' : f.color}`} />}
                      <span>{f.label}</span>
                      {active && <span className="ml-0.5 px-1.5 rounded-full bg-white/20 text-[10px]">{filtered.length}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="pointer-events-auto flex items-center gap-1 overflow-x-auto py-0.5">
                <span className="text-[10px] font-bold text-outline uppercase tracking-wider pl-1 mr-1 bg-surface/80 rounded px-1">Zona:</span>
                {(['Todas', ...ZONES] as const).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZone(z)}
                    className={`px-2.5 py-0.5 rounded-full text-[11px] shadow-xs whitespace-nowrap ${
                      zone === z
                        ? 'bg-on-surface text-white font-semibold'
                        : 'bg-surface-container-lowest/90 text-on-surface-variant font-medium border border-surface-variant hover:bg-surface-container'
                    }`}
                    type="button"
                  >
                    {z}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Controles del mapa */}
        <div className="absolute right-3.5 top-[150px] z-[500] flex flex-col gap-2.5">
          <button
            title="Mi ubicación"
            aria-label="Mi ubicación"
            onClick={async () => {
              const s = await requestLocation()
              map?.setView(s.coords, 15, { animate: true })
              if (s.source !== 'gps') showToast(`Sin GPS: mostrando el centro de ${CITY_LABEL}`, 'location_off')
            }}
            className="w-10 h-10 rounded-full bg-surface-container-lowest text-primary shadow-lg border border-surface-variant/70 flex items-center justify-center hover:bg-surface-container active:scale-95"
            type="button"
          >
            <Icon name="gps_fixed" className="text-xl" />
          </button>
          <button
            title="Capas de mapa"
            aria-label="Cambiar capa del mapa"
            onClick={() => {
              const next = layer === 'claro' ? 'calles' : 'claro'
              setLayer(next)
              showToast(next === 'claro' ? 'Mapa claro' : 'Mapa de calles (OpenStreetMap)', 'layers')
            }}
            className="w-10 h-10 rounded-full bg-surface-container-lowest text-on-surface-variant shadow-lg border border-surface-variant/70 flex items-center justify-center hover:bg-surface-container active:scale-95"
            type="button"
          >
            <Icon name="layers" className="text-xl" />
          </button>
          <div className="flex flex-col bg-surface-container-lowest rounded-full shadow-lg border border-surface-variant/70 overflow-hidden">
            <button title="Acercar" aria-label="Acercar" onClick={() => map?.zoomIn()} className="w-10 h-9 flex items-center justify-center text-on-surface hover:bg-surface-container" type="button">
              <Icon name="add" className="text-lg" />
            </button>
            <div className="h-px bg-surface-variant mx-2" />
            <button title="Alejar" aria-label="Alejar" onClick={() => map?.zoomOut()} className="w-10 h-9 flex items-center justify-center text-on-surface hover:bg-surface-container" type="button">
              <Icon name="remove" className="text-lg" />
            </button>
          </div>
        </div>

        {/* Hoja inferior: reportes cercanos */}
        <div
          className={`absolute bottom-0 inset-x-0 z-[550] bg-surface-container-lowest rounded-t-3xl shadow-2xl border-t border-surface-variant/60 flex flex-col transition-all duration-300 ${
            view === 'lista' ? 'h-[88%]' : 'h-[45%]'
          }`}
        >
          <button
            aria-label={view === 'lista' ? 'Contraer lista' : 'Expandir lista'}
            onClick={() => setView(view === 'lista' ? 'mapa' : 'lista')}
            className="w-full flex justify-center pt-2.5 pb-1"
            type="button"
          >
            <span className="w-10 h-1 rounded-full bg-outline-variant" />
          </button>
          <div className="px-4 pt-1 pb-2.5 flex items-center justify-between border-b border-surface-variant/50">
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="font-headline font-bold text-base text-primary">
                  {filtered.length} {filtered.length === 1 ? 'reporte' : 'reportes'} cerca
                </h2>
                <span className="w-2 h-2 rounded-full bg-secondary-container" />
              </div>
              <p className="text-[11px] text-outline font-medium">
                {casesQ.isPending ? 'Cargando reportes…' : filtered.length ? `En un radio de ${formatDistance(radius)} de tu ubicación` : cases.length ? 'Prueba con otros filtros' : 'Aún no hay reportes en la red'}
              </p>
            </div>
            <div className="flex items-center bg-surface-container p-0.5 rounded-full text-xs font-semibold">
              {(['mapa', 'lista'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full transition ${
                    view === v ? 'bg-surface-container-lowest text-primary shadow-xs' : 'text-on-surface-variant hover:text-primary'
                  }`}
                  type="button"
                >
                  <Icon name={v === 'mapa' ? 'explore' : 'format_list_bulleted'} className="text-xs" />
                  <span>{v === 'mapa' ? 'Mapa' : 'Lista'}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5 pb-28">
            {filtered.map((c) => (
              <CaseRow key={c.id} c={c} onFocus={() => focus(c.lat, c.lng)} />
            ))}
            {filtered.length === 0 && (
              <div className="py-8 text-center text-xs text-outline">
                <Icon name="search_off" className="text-3xl mb-1" />
                <p>No hay reportes con estos filtros.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
