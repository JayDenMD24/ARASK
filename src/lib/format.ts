const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-CO')

export const formatCOP = (n: number) => cop.format(n).replace(/\s/g, '')
export const formatNumber = (n: number) => num.format(n)

/** "Hoy, 10:42", "Ayer, 18:30" o "12 nov, 09:15" */
export function formatWhen(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (diffDays === 0) return `Hoy, ${time}`
  if (diffDays === 1) return `Ayer, ${time}`
  return `${d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}, ${time}`
}

/** "Hace 12 min", "Hace 3 h", "Hace 2 días" */
export function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (mins < 1) return 'Justo ahora'
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.round(hours / 24)
  return `Hace ${days} día${days === 1 ? '' : 's'}`
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
