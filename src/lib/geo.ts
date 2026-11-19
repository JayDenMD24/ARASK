export { distanceMeters, zoneFor, type LatLng } from '../../shared/geo'
import type { LatLng } from '../../shared/geo'

export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`
  return `${(m / 1000).toFixed(1)} km`
}

/** Dirección legible a partir de coordenadas (OpenStreetMap Nominatim). Devuelve null si falla. */
export async function reverseGeocode([lat, lng]: LatLng): Promise<{ address: string; area: string } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es&zoom=18`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    const a = data.address ?? {}
    const street = [a.road, a.house_number].filter(Boolean).join(' ')
    const hood = a.neighbourhood || a.suburb || a.quarter || a.city_district || ''
    const city = a.city || a.town || a.village || ''
    return {
      address: [street || data.name || 'Punto sin nombre', hood].filter(Boolean).join(' · '),
      area: [city, a.state].filter(Boolean).join(', '),
    }
  } catch {
    return null
  }
}

export const directionsUrl = ([lat, lng]: LatLng) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
