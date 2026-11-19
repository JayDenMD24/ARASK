import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_CENTER, distanceMeters, type LatLng } from '../../shared/geo'

/** Estado de interfaz: ubicación del dispositivo y avisos (toasts). Los datos viven en la API. */

export interface LocationState {
  coords: LatLng
  source: 'gps' | 'default'
  accuracy?: number
  status: 'pending' | 'ok' | 'denied' | 'unavailable'
}

interface Toast {
  id: number
  message: string
  icon: string
}

interface AppStore {
  location: LocationState
  requestLocation: () => Promise<LocationState>
  distanceTo: (c: { lat: number; lng: number }) => number
  toast: Toast | null
  showToast: (message: string, icon?: string) => void
}

const Ctx = createContext<AppStore | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<LocationState>({ coords: DEFAULT_CENTER, source: 'default', status: 'pending' })
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const showToast = useCallback((message: string, icon = 'check_circle') => {
    window.clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), message, icon })
    toastTimer.current = window.setTimeout(() => setToast(null), 2800)
  }, [])

  const requestLocation = useCallback(
    () =>
      new Promise<LocationState>((resolve) => {
        if (!('geolocation' in navigator)) {
          const s: LocationState = { coords: DEFAULT_CENTER, source: 'default', status: 'unavailable' }
          setLocation(s)
          return resolve(s)
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const s: LocationState = { coords: [pos.coords.latitude, pos.coords.longitude], source: 'gps', accuracy: pos.coords.accuracy, status: 'ok' }
            setLocation(s)
            resolve(s)
          },
          (err) => {
            const s: LocationState = { coords: DEFAULT_CENTER, source: 'default', status: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' }
            setLocation(s)
            resolve(s)
          },
          { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
        )
      }),
    [],
  )

  useEffect(() => {
    void requestLocation()
  }, [requestLocation])

  const distanceTo = useCallback((c: { lat: number; lng: number }) => distanceMeters(location.coords, [c.lat, c.lng]), [location.coords])

  const value = useMemo(() => ({ location, requestLocation, distanceTo, toast, showToast }), [location, requestLocation, distanceTo, toast, showToast])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useApp debe usarse dentro de AppStoreProvider')
  return ctx
}
