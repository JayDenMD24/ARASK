import type { Zone } from './types'

export type LatLng = [number, number]

/** Centro de Montería (Parque Simón Bolívar). */
export const DEFAULT_CENTER: LatLng = [8.7538, -75.8858]
export const ZONES: Zone[] = ['Centro', 'Norte', 'Sur', 'Margen izquierda']

/** Distancia en metros (fórmula de Haversine). */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Clasificación aproximada de zonas de Montería respecto al centro y al río Sinú. */
export function zoneFor([lat, lng]: LatLng): Zone {
  if (lng < -75.8905) return 'Margen izquierda'
  const dLat = lat - DEFAULT_CENTER[0]
  if (dLat > 0.008) return 'Norte'
  if (dLat < -0.006) return 'Sur'
  return 'Centro'
}
