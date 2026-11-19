/**
 * Cliente de la API de ARASK.
 * - En la web, la API vive en el mismo dominio (/api).
 * - En la app Android (Capacitor) se usa VITE_API_URL = https://<tu-worker>.workers.dev
 */
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'arask:token'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* sin almacenamiento */
    }
  },
}

let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn
}

/** Convierte rutas relativas de la API (fotos) en URLs absolutas cuando hace falta. */
export const assetUrl = (path: string | null | undefined) => (path ? (path.startsWith('/api/') ? `${API_BASE}${path}` : path) : null)

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const token = tokenStore.get()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  let res: Response
  try {
    res = await fetch(`${API_BASE}/api${path}`, { ...init, headers, body })
  } catch {
    throw new ApiError(0, 'Sin conexión. Revisa tu internet e intenta de nuevo')
  }
  const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.()
    throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Error ${res.status}`)
  }
  return data as T
}

/** Sube una imagen (data URL o Blob) a R2 y devuelve su clave. */
export async function uploadImage(image: string | Blob): Promise<{ key: string; url: string }> {
  const blob = typeof image === 'string' ? await (await fetch(image)).blob() : image
  return api('/uploads', { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } })
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado')
