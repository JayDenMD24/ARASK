import type { CaseStatus, Condition, FlagReason, Need, NeedState, Species } from './types'

export { DEFAULT_CENTER, ZONES } from '../../shared/geo'
export const CITY_LABEL = 'Montería'

export const NEED_STATES: Record<NeedState, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-surface-container text-outline font-medium' },
  en_camino: { label: 'En camino', cls: 'bg-primary-fixed text-primary font-bold' },
  cubierto: { label: 'Cubierto', cls: 'bg-tertiary-fixed text-tertiary font-bold' },
}

export const FLAG_REASONS: Record<FlagReason, { label: string; icon: string }> = {
  duplicado: { label: 'Es un reporte duplicado', icon: 'content_copy' },
  falso: { label: 'Es falso o no existe', icon: 'report' },
  resuelto: { label: 'Ya fue resuelto', icon: 'task_alt' },
  inapropiado: { label: 'Contenido inapropiado', icon: 'block' },
}

export const SPECIES: Record<Species, { label: string; icon: string }> = {
  perro: { label: 'Perro', icon: 'pets' },
  gato: { label: 'Gato', icon: 'cruelty_free' },
  otro: { label: 'Otro', icon: 'more_horiz' },
}

export const CONDITIONS: Record<
  Condition,
  { label: string; hint: string; icon: string; chip: string; badge: string; pin: string; priority: number }
> = {
  urgente: {
    label: 'Urgente',
    hint: 'Riesgo vital, atropello inmediato',
    icon: 'emergency',
    chip: 'bg-error-container text-error',
    badge: 'bg-error text-on-error',
    pin: '#EF4444',
    priority: 4,
  },
  herido: {
    label: 'Herido',
    hint: 'Cojera, herida abierta o golpe',
    icon: 'healing',
    chip: 'bg-error-container text-error',
    badge: 'bg-error text-on-error',
    pin: '#EF4444',
    priority: 3,
  },
  desnutrido: {
    label: 'Desnutrido',
    hint: 'Costillas marcadas, débil, sediento',
    icon: 'sentiment_dissatisfied',
    chip: 'bg-secondary-fixed text-secondary',
    badge: 'bg-[#F59E0B] text-white',
    pin: '#F59E0B',
    priority: 2,
  },
  saludable: {
    label: 'Saludable',
    hint: 'Ágil, sin heridas ni dolor evidente',
    icon: 'favorite',
    chip: 'bg-tertiary-fixed text-tertiary',
    badge: 'bg-tertiary-container text-tertiary-fixed',
    pin: '#10B981',
    priority: 1,
  },
}

export const NEEDS: Record<Need, { label: string; icon: string; color: string; long: string }> = {
  alimento: { label: 'Alimento', icon: 'restaurant', color: 'text-secondary', long: 'Alimento rico en nutrientes' },
  veterinario: { label: 'Veterinario', icon: 'medical_services', color: 'text-error', long: 'Valoración médica' },
  traslado: { label: 'Traslado', icon: 'directions_car', color: 'text-primary', long: 'Traslado a clínica veterinaria' },
  hogar: { label: 'Hogar temporal', icon: 'roofing', color: 'text-secondary', long: 'Hogar temporal' },
  medicamentos: { label: 'Medicamentos', icon: 'vaccines', color: 'text-primary', long: 'Medicamentos' },
  donacion: { label: 'Donación', icon: 'payments', color: 'text-secondary', long: 'Donación para gastos' },
}

export const STATUS: Record<CaseStatus, { label: string; short: string; resolved: boolean; icon: string }> = {
  reportado: { label: 'Reportado', short: 'Reportado', resolved: false, icon: 'campaign' },
  en_atencion: { label: 'En atención', short: 'En atención', resolved: false, icon: 'local_shipping' },
  rescatado: { label: 'Rescatado', short: 'Rescatado', resolved: true, icon: 'shield' },
  adopcion: { label: 'En adopción', short: 'En adopción', resolved: true, icon: 'home' },
  cerrado: { label: 'Cerrado', short: 'Cerrado', resolved: true, icon: 'task_alt' },
}

export const STATUS_FLOW: CaseStatus[] = ['reportado', 'en_atencion', 'rescatado', 'adopcion']

/** Medios de pago habituales en Colombia (pasarela pendiente: Wompi / PayU / Mercado Pago). */
export const PAYMENT_METHODS = [
  { key: 'Tarjeta', icon: 'credit_card', hint: 'Crédito o débito' },
  { key: 'PSE', icon: 'account_balance', hint: 'Débito desde tu banco' },
  { key: 'Nequi', icon: 'smartphone', hint: 'Billetera digital' },
]
