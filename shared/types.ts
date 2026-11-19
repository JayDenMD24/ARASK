/** Tipos compartidos entre la app (src/) y la API (worker/). */

export type Role = 'user' | 'admin'
export type Species = 'perro' | 'gato' | 'otro'
export type Condition = 'saludable' | 'herido' | 'desnutrido' | 'urgente'
export type Need = 'alimento' | 'veterinario' | 'traslado' | 'hogar' | 'medicamentos' | 'donacion'
export type NeedState = 'pendiente' | 'en_camino' | 'cubierto'
export type CaseStatus = 'reportado' | 'en_atencion' | 'rescatado' | 'adopcion' | 'cerrado'
export type Zone = 'Centro' | 'Norte' | 'Sur' | 'Margen izquierda'
export type FlagReason = 'falso' | 'duplicado' | 'inapropiado' | 'resuelto'

export interface ApiUser {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl: string | null
  verified: boolean
  disabled?: boolean
  createdAt: string
}

export interface PersonLite {
  id: string | null
  name: string
  avatarUrl: string | null
  verified: boolean
}

export interface NeedItem {
  need: Need
  detail?: string | null
  state: NeedState
}

export interface TimelineEvent {
  status: CaseStatus
  detail: string
  at: string
  userName: string | null
}

export interface ApiCase {
  id: number
  name: string
  species: Species
  sex: 'Hembra' | 'Macho' | null
  profile: string | null
  condition: Condition
  status: CaseStatus
  description: string
  medicalNote: string | null
  lat: number
  lng: number
  address: string
  zone: Zone
  anonymous: boolean
  verified: boolean
  hidden: boolean
  hiddenReason: string | null
  donationGoal: number
  donationRaised: number
  createdAt: string
  updatedAt: string
  photos: string[]
  needs: NeedItem[]
  reporter: PersonLite
  helpersCount: number
  saved: boolean
  myHelp: string | null
  isReporter: boolean
  canEdit: boolean
  flagsCount: number
}

export interface ApiCaseDetail extends ApiCase {
  timeline: TimelineEvent[]
  helpers: (PersonLite & { helpType: string })[]
}

export interface ApiComment {
  id: number
  body: string
  createdAt: string
  user: PersonLite
}

export interface ApiNotification {
  id: number
  type: string
  title: string
  body: string
  caseId: number | null
  read: boolean
  createdAt: string
}

export interface ApiCampaign {
  id: number
  title: string
  goal: number
  raised: number
  donors: number
  startsAt: string
  endsAt: string
}

export interface ApiDonation {
  id: number
  amount: number
  frequency: 'unica' | 'mensual'
  destination: string
  method: string
  caseId: number | null
  caseName: string | null
  createdAt: string
}

export interface ApiStats {
  censados: number
  atendidos: number
  adopciones: number
  voluntarios: number
}

export interface ApiMe extends ApiUser {
  reports: number
  helping: number
  donated: number
  unread: number
}

export interface AdminUserRow extends ApiUser {
  reports: number
  helping: number
  donated: number
}

export interface AdminStats {
  totals: { cases: number; open: number; users: number; donations: number; donated: number; flagged: number; hidden: number }
  byZone: { zone: string; total: number; open: number }[]
  byStatus: { status: CaseStatus; total: number }[]
  byCondition: { condition: Condition; total: number }[]
  byMonth: { month: string; total: number }[]
  points: { lat: number; lng: number; condition: Condition; status: CaseStatus }[]
}

export interface DuplicateCandidate {
  id: number
  name: string
  photo: string | null
  address: string
  distance: number
  createdAt: string
}
