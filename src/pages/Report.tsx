import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import { InvalidateOnResize, pawIcon, Recenter, TILE_LAYERS } from '../components/map'
import { Icon, Sheet, Spinner } from '../components/ui'
import { CITY_LABEL, CONDITIONS, NEEDS, SPECIES } from '../data/catalog'
import type { Condition, DuplicateCandidate, Need, Species } from '../data/types'
import { formatDistance, reverseGeocode, type LatLng } from '../lib/geo'
import { assetUrl, errorMessage, uploadImage } from '../lib/api'
import { timeAgo } from '../lib/format'
import { fetchDuplicates, useCreateCase } from '../lib/queries'
import { compressImage } from '../lib/image'
import { useApp } from '../store/AppStore'

const MAX_PHOTOS = 4
const MAX_DESC = 280
const NEED_OPTIONS: Need[] = ['alimento', 'veterinario', 'traslado', 'hogar', 'medicamentos']
const CONDITION_ORDER: Condition[] = ['saludable', 'herido', 'desnutrido', 'urgente']
const CONDITION_STYLE: Record<Condition, { box: string; selected: string; text: string }> = {
  saludable: { box: 'bg-tertiary-fixed text-tertiary', selected: 'border-tertiary-container bg-tertiary-fixed/30', text: 'text-tertiary' },
  herido: { box: 'bg-secondary-container text-white', selected: 'border-secondary bg-secondary-fixed/30', text: 'text-secondary' },
  desnutrido: { box: 'bg-secondary-fixed text-secondary', selected: 'border-secondary bg-secondary-fixed/30', text: 'text-secondary' },
  urgente: { box: 'bg-error-container text-error', selected: 'border-error bg-error-container/40', text: 'text-error' },
}

interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}
type SpeechCtor = new () => SpeechRecognitionLike

export default function Report() {
  const { location, showToast } = useApp()
  const createCase = useCreateCase()
  const navigate = useNavigate()
  const cameraInput = useRef<HTMLInputElement>(null)
  const galleryInput = useRef<HTMLInputElement>(null)
  const recognition = useRef<SpeechRecognitionLike | null>(null)

  const [photos, setPhotos] = useState<string[]>([])
  const [species, setSpecies] = useState<Species | null>(null)
  const [condition, setCondition] = useState<Condition | null>(null)
  const [needs, setNeeds] = useState<Need[]>([])
  const [description, setDescription] = useState('')
  const [name, setName] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [coords, setCoords] = useState<LatLng>(location.coords)
  const [manualPin, setManualPin] = useState(false)
  const [adjusting, setAdjusting] = useState(false)
  const [place, setPlace] = useState<{ address: string; area: string } | null>(null)
  const [loadingPlace, setLoadingPlace] = useState(true)
  const [listening, setListening] = useState(false)
  const [showErrors, setShowErrors] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [sending, setSending] = useState(false)
  const [sendStep, setSendStep] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null)

  // Seguir la ubicación del GPS hasta que el usuario mueva el pin
  useEffect(() => {
    if (!manualPin) setCoords(location.coords)
  }, [location.coords, manualPin])

  // Dirección legible (con espera para no saturar el servicio)
  useEffect(() => {
    setLoadingPlace(true)
    const t = window.setTimeout(async () => {
      const p = await reverseGeocode(coords)
      setPlace(p)
      setLoadingPlace(false)
    }, 700)
    return () => window.clearTimeout(t)
  }, [coords])

  const step = photos.length === 0 ? 1 : !species || !condition || needs.length === 0 ? 2 : 3
  const missing = {
    photos: photos.length === 0,
    species: !species,
    condition: !condition,
    needs: needs.length === 0,
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const room = MAX_PHOTOS - photos.length
    if (room <= 0) return showToast(`Máximo ${MAX_PHOTOS} fotos por reporte`, 'error')
    try {
      const imgs = await Promise.all(Array.from(files).slice(0, room).map((f) => compressImage(f)))
      setPhotos((p) => [...p, ...imgs])
    } catch {
      showToast('No se pudo cargar la foto', 'error')
    }
  }

  function toggleNeed(n: Need) {
    setNeeds((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]))
  }

  function toggleDictation() {
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!Ctor) return showToast('El dictado por voz no está disponible en este navegador', 'mic_off')
    if (listening) {
      recognition.current?.stop()
      return
    }
    const r = new Ctor()
    r.lang = 'es-CO'
    r.interimResults = false
    r.onresult = (e) => {
      const text = Array.from(e.results)
        .map((res) => res[0]?.transcript ?? '')
        .join(' ')
      setDescription((d) => `${d}${d && !d.endsWith(' ') ? ' ' : ''}${text}`.slice(0, MAX_DESC))
    }
    r.onerror = () => showToast('No se pudo usar el micrófono', 'mic_off')
    r.onend = () => setListening(false)
    recognition.current = r
    setListening(true)
    r.start()
  }

  async function submit(skipDuplicateCheck = false) {
    if (Object.values(missing).some(Boolean)) {
      setShowErrors(true)
      showToast('Completa los campos marcados con *', 'error')
      return
    }
    setSending(true)
    try {
      if (!skipDuplicateCheck) {
        const dups = await fetchDuplicates(coords[0], coords[1])
        if (dups.length) {
          setDuplicates(dups)
          setSending(false)
          return
        }
      }
      setDuplicates(null)
      setSendStep('Subiendo fotos…')
      const keys: string[] = []
      for (const p of photos) keys.push((await uploadImage(p)).key)
      setSendStep('Enviando reporte…')
      const created = await createCase.mutateAsync({
        name: name.trim(),
        species: species!,
        condition: condition!,
        needs,
        description: description.trim(),
        photos: keys,
        lat: coords[0],
        lng: coords[1],
        address: place?.address ?? `Ubicación ${coords[0].toFixed(4)}, ${coords[1].toFixed(4)}`,
        anonymous,
      })
      showToast('¡Reporte enviado! La red ya fue notificada')
      navigate(`/caso/${created.id}`, { replace: true })
    } catch (err) {
      showToast(errorMessage(err), 'error')
      setSending(false)
      setSendStep(null)
    }
  }

  const label = 'font-headline font-bold text-xs text-primary uppercase tracking-wider block'
  const err = (on: boolean) => (showErrors && on ? 'ring-2 ring-error/60 rounded-2xl' : '')

  return (
    <div className="w-full max-w-[420px] mx-auto bg-surface min-h-dvh flex flex-col relative">
      {/* Barra superior + progreso */}
      <header className="bg-surface/95 backdrop-blur-md sticky top-0 z-[600] border-b border-outline-variant/30 pt-safe">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <button
            aria-label="Volver atrás"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all text-primary"
            type="button"
          >
            <Icon name="arrow_back" className="text-2xl" />
          </button>
          <div className="text-center">
            <h1 className="font-headline font-extrabold text-base text-primary leading-tight">Reportar animal</h1>
            <p className="text-[11px] font-label font-medium text-on-surface-variant">Comparte lo que ves</p>
          </div>
          <button
            aria-label="Ayuda"
            onClick={() => setShowHelp(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container active:scale-95 transition-all text-outline"
            type="button"
          >
            <Icon name="help_outline" className="text-xl" />
          </button>
        </div>
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center justify-between">
            {(['Foto', 'Estado', 'Enviar'] as const).map((s, i) => {
              const n = i + 1
              const done = n < step
              const current = n === step
              return (
                <div key={s} className="contents">
                  {i > 0 && <div className={`flex-1 h-0.5 mx-1 relative -top-[9px] ${n <= step ? 'bg-primary' : 'bg-outline-variant/40'}`} />}
                  <div className="flex flex-col items-center z-10">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-headline font-bold ${
                        done
                          ? 'bg-primary text-white shadow-xs'
                          : current
                            ? 'bg-secondary text-white ring-4 ring-secondary-fixed shadow-sm font-extrabold'
                            : 'bg-surface-container-high text-outline'
                      }`}
                    >
                      {done ? <Icon name="check" className="text-sm font-bold" /> : n}
                    </div>
                    <span className={`text-[10px] font-headline mt-1 ${done ? 'font-bold text-primary' : current ? 'font-bold text-secondary' : 'font-medium text-outline'}`}>
                      {s}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 space-y-5 pb-40">
        {/* 1. Fotos */}
        <section className={`space-y-2.5 ${err(missing.photos)}`}>
          <div className="flex items-center justify-between">
            <span className="font-headline font-bold text-sm text-primary flex items-center gap-1.5">
              <Icon name="photo_camera" className="text-lg text-secondary" />
              Fotos del animal <span className="text-xs text-error font-semibold">*</span>
            </span>
            <span className="text-[11px] font-label font-medium text-outline">
              {photos.length} de {MAX_PHOTOS} fotos
            </span>
          </div>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
          <input ref={galleryInput} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
          <div className="grid grid-cols-3 gap-2.5">
            {photos.length < MAX_PHOTOS && (
              <div className="col-span-3 rounded-2xl border-2 border-dashed border-primary/35 bg-primary-fixed/20 p-4 flex flex-col items-center justify-center text-center">
                <div className="w-12 h-12 rounded-full bg-primary-container text-inverse-primary flex items-center justify-center mb-2 shadow-sm">
                  <Icon name="add_a_photo" fill className="text-2xl" />
                </div>
                <span className="font-headline font-bold text-xs text-primary">Agregar foto del animal</span>
                <span className="text-[11px] font-label text-on-surface-variant mt-0.5">Toma una foto con tu cámara o abre la galería</span>
                <div className="flex items-center gap-2 mt-2">
                  <button type="button" onClick={() => cameraInput.current?.click()} className="px-3 py-1.5 rounded-full bg-white text-primary text-[11px] font-bold shadow-xs flex items-center gap-1 active:scale-95">
                    <Icon name="photo_camera" className="text-sm" /> Cámara
                  </button>
                  <button type="button" onClick={() => galleryInput.current?.click()} className="px-3 py-1.5 rounded-full bg-white text-primary text-[11px] font-bold shadow-xs flex items-center gap-1 active:scale-95">
                    <Icon name="image" className="text-sm" /> Galería
                  </button>
                </div>
              </div>
            )}
            {photos.map((src, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-outline-variant/40 shadow-xs bg-surface-container">
                <img className="w-full h-full object-cover" src={src} alt={`Foto ${i + 1}`} />
                <button
                  aria-label={`Eliminar foto ${i + 1}`}
                  onClick={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                  className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-on-background/70 text-white flex items-center justify-center hover:bg-error transition-colors"
                  type="button"
                >
                  <Icon name="close" className="text-sm" />
                </button>
                {i === 0 && <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[9px] font-bold">Principal</span>}
              </div>
            ))}
            {photos.length > 0 && photos.length < MAX_PHOTOS && (
              <button
                onClick={() => galleryInput.current?.click()}
                className="aspect-square rounded-2xl border border-dashed border-outline-variant/70 flex flex-col items-center justify-center bg-surface-container-low hover:bg-surface-container text-on-surface-variant transition-colors"
                type="button"
              >
                <Icon name="add" className="text-2xl text-outline" />
                <span className="text-[10px] font-label font-bold text-outline mt-0.5">+ Foto</span>
              </button>
            )}
          </div>
        </section>

        {/* 2. Ubicación */}
        <section className="rounded-2xl bg-surface-container-lowest p-3 border border-outline-variant/30 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Icon name="location_on" className="text-primary text-lg" />
              <h2 className="font-headline font-bold text-xs text-primary uppercase tracking-wider">Ubicación del avistamiento</h2>
            </div>
            {manualPin ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-primary font-headline font-extrabold text-[10px]">
                <Icon name="edit_location_alt" className="text-[12px]" /> Ajustada
              </span>
            ) : location.source === 'gps' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-tertiary font-headline font-extrabold text-[10px]">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" /> GPS activo
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-fixed text-secondary font-headline font-extrabold text-[10px]">
                <Icon name="location_off" className="text-[12px]" /> Sin GPS
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 bg-surface-container-low p-2.5 rounded-xl border border-outline-variant/20">
            <div className="min-w-0 flex-1">
              <div className="font-headline font-bold text-xs text-on-surface truncate">
                {loadingPlace ? 'Buscando dirección…' : (place?.address ?? `${coords[0].toFixed(5)}, ${coords[1].toFixed(5)}`)}
              </div>
              <div className="text-[11px] font-label text-on-surface-variant truncate">
                {place?.area ?? CITY_LABEL}
                {location.source === 'gps' && !manualPin && location.accuracy ? ` · Precisión: ±${Math.round(location.accuracy)} m` : ''}
                {location.source !== 'gps' && !manualPin ? ' · Mueve el pin al lugar exacto' : ''}
              </div>
            </div>
            <button
              onClick={() => setAdjusting((v) => !v)}
              className={`px-3 py-1.5 rounded-xl border font-headline font-bold text-xs shadow-2xs active:scale-95 transition-all shrink-0 flex items-center gap-1 ${
                adjusting ? 'bg-primary-container text-white border-primary-container' : 'bg-white border-outline-variant/40 text-primary hover:bg-surface-container'
              }`}
              type="button"
            >
              <Icon name={adjusting ? 'check' : 'tune'} className="text-sm" />
              {adjusting ? 'Listo' : 'Ajustar'}
            </button>
          </div>
          <div className={`relative w-full rounded-xl overflow-hidden border border-outline-variant/30 z-0 transition-all ${adjusting ? 'h-64' : 'h-24'}`}>
            <MapContainer
              center={coords}
              zoom={16}
              zoomControl={adjusting}
              attributionControl={false}
              dragging={adjusting}
              scrollWheelZoom={adjusting}
              touchZoom={adjusting}
              doubleClickZoom={adjusting}
              className="w-full h-full"
            >
              <TileLayer url={TILE_LAYERS.claro.url} className={TILE_LAYERS.claro.className} />
              <InvalidateOnResize />
              <Recenter center={coords} />
              <Marker
                position={coords}
                icon={pawIcon()}
                draggable={adjusting}
                eventHandlers={{
                  dragend: (e) => {
                    const p = e.target.getLatLng()
                    setManualPin(true)
                    setCoords([p.lat, p.lng])
                  },
                }}
              />
            </MapContainer>
            {adjusting && (
              <span className="absolute top-2 left-1/2 -translate-x-1/2 z-[400] px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold whitespace-nowrap">
                Arrastra el pin al lugar exacto
              </span>
            )}
          </div>
        </section>

        {/* 3. Tipo de animal */}
        <section className={`space-y-2 ${err(missing.species)}`}>
          <span className={label}>
            Tipo de animal <span className="text-error">*</span>
          </span>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(SPECIES) as Species[]).map((s) => {
              const active = species === s
              return (
                <button
                  key={s}
                  onClick={() => setSpecies(s)}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl font-headline text-xs transition-all active:scale-95 ${
                    active
                      ? 'border-2 border-primary bg-primary-fixed/30 text-primary font-bold shadow-2xs'
                      : 'border border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-primary/40 font-semibold'
                  }`}
                  type="button"
                >
                  <Icon name={SPECIES[s].icon} fill={active} className={`text-lg ${active ? 'text-primary' : 'text-outline'}`} />
                  <span>{SPECIES[s].label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* 4. Condición visible */}
        <section className={`space-y-2 ${err(missing.condition)}`}>
          <div className="flex items-center justify-between">
            <span className={label}>
              Condición visible <span className="text-error">*</span>
            </span>
            <span className="text-[11px] font-label text-outline">Selecciona 1 opción</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {CONDITION_ORDER.map((k) => {
              const c = CONDITIONS[k]
              const st = CONDITION_STYLE[k]
              const active = condition === k
              return (
                <button
                  key={k}
                  onClick={() => setCondition(k)}
                  aria-pressed={active}
                  className={`relative p-3 rounded-2xl text-left cursor-pointer transition-all active:scale-95 flex items-start gap-2.5 ${
                    active ? `border-2 shadow-2xs ${st.selected}` : 'border border-outline-variant/40 bg-surface-container-lowest'
                  }`}
                  type="button"
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${st.box}`}>
                    <Icon name={c.icon} fill className="text-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-headline text-xs leading-tight ${active ? `font-black ${st.text}` : 'font-bold text-on-surface'}`}>{c.label}</span>
                      {active && <Icon name="check_circle" fill className={`text-base ${st.text}`} />}
                    </div>
                    <p className="text-[10px] font-label text-on-surface-variant mt-0.5 leading-snug">{c.hint}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* 5. ¿Qué necesita? */}
        <section className={`space-y-2 ${err(missing.needs)}`}>
          <div className="flex items-center justify-between">
            <span className={label}>
              ¿Qué necesita? <span className="text-error">*</span>
            </span>
            <span className="text-[11px] font-label text-outline">Puedes elegir varias</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {NEED_OPTIONS.map((n) => {
              const active = needs.includes(n)
              return (
                <button
                  key={n}
                  onClick={() => toggleNeed(n)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-full font-label text-xs flex items-center gap-1.5 active:scale-95 transition-all ${
                    active
                      ? 'bg-secondary-container text-white font-bold shadow-2xs'
                      : 'bg-surface-container-lowest border border-outline-variant/40 text-on-surface-variant hover:border-primary/40 font-semibold'
                  }`}
                  type="button"
                >
                  <Icon name={NEEDS[n].icon} className={`text-sm ${active ? '' : 'text-outline'}`} />
                  {NEEDS[n].label}
                  {active && <Icon name="check" className="text-xs" />}
                </button>
              )
            })}
          </div>
        </section>

        {/* 6. Descripción */}
        <section className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className={label} htmlFor="descripcion">
              Descripción breve
            </label>
            <span className="text-[11px] font-label text-outline font-medium">
              {description.length} / {MAX_DESC}
            </span>
          </div>
          <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/40 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all p-3">
            <textarea
              id="descripcion"
              value={description}
              maxLength={MAX_DESC}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-transparent border-0 p-0 text-xs text-on-surface placeholder:text-outline/70 focus:ring-0 focus:outline-none resize-none min-h-[72px]"
              placeholder="¿Cómo está el animal? ¿Hay alguna referencia del lugar?"
            />
            <div className="flex justify-between items-center pt-2 border-t border-outline-variant/20 mt-1">
              <div className="flex items-center gap-1 text-[11px] text-outline">
                <Icon name="info" className="text-xs" /> Sé lo más específico posible para los rescatistas
              </div>
              <button
                aria-label={listening ? 'Detener dictado' : 'Dictar por voz'}
                onClick={toggleDictation}
                className={`p-1 rounded-full transition-colors ${listening ? 'text-error animate-pulse' : 'text-outline hover:text-primary'}`}
                type="button"
              >
                <Icon name="mic" fill={listening} className="text-base" />
              </button>
            </div>
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 30))}
            className="w-full mt-1.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-xs px-3 py-2.5 focus:border-primary focus:ring-primary/20"
            placeholder="Nombre o apodo (opcional), p. ej. «Canela»"
            aria-label="Nombre o apodo del animal"
          />
        </section>

        <label className="flex items-center gap-2.5 text-xs text-on-surface-variant font-medium px-1">
          <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="rounded text-primary focus:ring-primary" />
          Enviar como reporte anónimo
        </label>

        <div className="rounded-xl bg-tertiary-fixed/30 border border-tertiary-container/15 p-2.5 flex items-start gap-2.5">
          <Icon name="verified_user" className="text-base text-tertiary shrink-0 mt-0.5" />
          <p className="text-[11px] font-label text-tertiary leading-snug">
            Tu reporte notificará al instante a los <strong>voluntarios y rescatistas activos</strong> en un radio de 2 km.
          </p>
        </div>
      </main>

      {/* Botón fijo inferior */}
      <div className="fixed bottom-0 inset-x-0 mx-auto w-full max-w-[420px] bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/30 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] z-[700]">
        <button
          onClick={() => submit()}
          disabled={sending}
          className="w-full py-3.5 px-6 rounded-2xl bg-secondary-container hover:bg-secondary text-white font-headline font-extrabold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
          type="button"
        >
          {sending && <Spinner className="w-4 h-4 border-white/30 border-t-white" />}
          <span>{sending ? (sendStep ?? 'Revisando…') : 'Enviar reporte'}</span>
          <Icon name="send" className="text-base group-hover:translate-x-1 transition-transform" />
        </button>
        <div className="flex items-center justify-center gap-1.5 mt-2 text-[10px] font-label text-outline">
          <Icon name="shield" className="text-xs text-tertiary" />
          <span>{anonymous ? 'Tu nombre no será visible' : 'Reporte visible para los voluntarios de la red'}</span>
        </div>
      </div>

      <Sheet
        open={Boolean(duplicates?.length)}
        onClose={() => setDuplicates(null)}
        title="¿Es alguno de estos casos?"
        subtitle="Ya hay reportes abiertos muy cerca de este lugar en las últimas 24 horas."
      >
        <div className="space-y-2">
          {duplicates?.map((d) => (
            <button
              key={d.id}
              onClick={() => navigate(`/caso/${d.id}`)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-surface-container-high hover:bg-surface-container-low text-left"
              type="button"
            >
              {d.photo ? (
                <img src={assetUrl(d.photo)!} alt="" className="w-12 h-12 rounded-xl object-cover" />
              ) : (
                <span className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center">
                  <Icon name="pets" className="text-outline" />
                </span>
              )}
              <div className="flex-1 min-w-0 text-xs">
                <p className="font-bold text-on-surface truncate">{d.name}</p>
                <p className="text-outline text-[11px] truncate">
                  {d.address} · a {formatDistance(d.distance)} · {timeAgo(d.createdAt).toLowerCase()}
                </p>
              </div>
              <span className="text-[11px] font-bold text-primary shrink-0">Es este</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => submit(true)}
          className="w-full py-3 rounded-2xl bg-secondary-container text-white font-headline font-extrabold text-xs flex items-center justify-center gap-2"
          type="button"
        >
          <Icon name="send" className="text-base" /> Es otro animal, enviar mi reporte
        </button>
      </Sheet>

      <Sheet open={showHelp} onClose={() => setShowHelp(false)} title="¿Cómo hacer un buen reporte?">
        <ul className="space-y-2.5 text-xs text-on-surface-variant">
          {[
            ['photo_camera', 'Toma al menos una foto clara del animal, sin acercarte si parece agresivo.'],
            ['location_on', 'Confirma la ubicación. Si el GPS no es exacto, usa «Ajustar» y mueve el pin.'],
            ['healing', 'Elige la condición que mejor describa lo que ves. «Urgente» es para riesgo de vida.'],
            ['edit_note', 'Agrega referencias del lugar (tienda, color de la casa, esquina).'],
          ].map(([icon, text]) => (
            <li key={icon} className="flex gap-2.5 items-start">
              <Icon name={icon} className="text-primary text-lg" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </div>
  )
}
