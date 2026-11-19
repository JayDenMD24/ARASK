import L from 'leaflet'
import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import type { ApiCase as Case } from '../data/types'
import { assetUrl } from '../lib/api'
import { CONDITIONS, STATUS } from '../data/catalog'

/**
 * Teselas de OpenStreetMap (no requieren API key). "claro" aplica un filtro CSS suave
 * para acercarse a la estética del mockup. En producción conviene un proveedor con
 * clave propia (MapTiler, Stadia o Mapbox) por la política de uso de OSM.
 */
const OSM = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}
export const TILE_LAYERS = {
  claro: { ...OSM, className: 'tiles-soft' },
  calles: { ...OSM, className: '' },
} as const

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

export function pinColor(c: Case) {
  return STATUS[c.status].resolved ? '#10B981' : CONDITIONS[c.condition].pin
}

/** Marcador con la foto del animal y etiqueta flotante (como en el mockup del mapa). */
export function caseIcon(c: Case, label?: string, size = 44) {
  const color = pinColor(c)
  const sos = !STATUS[c.status].resolved && c.condition === 'urgente'
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px)">
      ${
        label
          ? `<div class="mb-1 bg-white/95 px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 whitespace-nowrap" style="border:1px solid ${color}55">
               <span style="width:6px;height:6px;border-radius:9999px;background:${color}"></span>
               <span class="text-[11px] font-bold text-on-surface">${esc(c.name)}</span>
               <span class="text-[10px] text-outline">· ${esc(label)}</span>
             </div>`
          : ''
      }
      <div style="position:relative">
        <div style="width:${size}px;height:${size}px;border:3px solid ${color}" class="rounded-full p-0.5 bg-white shadow-lg overflow-hidden">
          <img src="${esc(assetUrl(c.photos[0]) ?? '')}" alt="" class="w-full h-full object-cover rounded-full"/>
        </div>
        ${sos ? '<span class="absolute -top-1 -right-1 bg-error text-white text-[9px] font-extrabold px-1.5 rounded-full shadow">SOS</span>' : ''}
        <div style="width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:7px solid ${color};margin:-1px auto 0"></div>
      </div>
    </div>`
  const h = size + 10 + (label ? 26 : 0)
  return L.divIcon({ html, className: 'arask-marker', iconSize: [140, h], iconAnchor: [70, h] })
}

/** Punto azul "Tú estás aquí" */
export function userIcon(withLabel = true) {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center">
      <div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center">
        <span class="absolute w-12 h-12 rounded-full bg-blue-500/25 animate-pulse-ring"></span>
        <span class="absolute w-8 h-8 rounded-full bg-blue-500/40"></span>
        <span class="relative w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md"></span>
      </div>
      ${
        withLabel
          ? '<div class="-mt-2 px-2 py-0.5 rounded-full bg-white/90 text-[10px] font-bold text-on-surface shadow-sm whitespace-nowrap">Tú estás aquí</div>'
          : ''
      }
    </div>`
  return L.divIcon({ html, className: 'arask-marker', iconSize: [100, 70], iconAnchor: [50, 24] })
}

/** Pin simple con huella (para el formulario de reporte y el detalle) */
export function pawIcon(color = '#904d00') {
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center">
      <span style="background:${color}" class="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-md ring-2 ring-white">
        <span class="material-symbols-outlined fill-icon" style="font-size:16px">pets</span>
      </span>
      <span style="background:${color}" class="w-1.5 h-1.5 rounded-full mt-0.5"></span>
    </div>`
  return L.divIcon({ html, className: 'arask-marker', iconSize: [28, 36], iconAnchor: [14, 36] })
}

/** Recentra el mapa cuando cambia `center`. */
export function Recenter({ center, zoom }: { center: [number, number]; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom(), { animate: true })
  }, [map, center, zoom])
  return null
}

/** Corrige el tamaño cuando el contenedor cambia (p. ej. al expandir la hoja inferior). */
export function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}
