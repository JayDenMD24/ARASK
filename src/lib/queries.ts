import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  AdminStats,
  AdminUserRow,
  ApiCampaign,
  ApiCase,
  ApiCaseDetail,
  ApiComment,
  ApiDonation,
  ApiNotification,
  ApiStats,
  ApiUser,
  CaseStatus,
  DuplicateCandidate,
  FlagReason,
  Need,
  NeedItem,
} from '../../shared/types'
import { api } from './api'

export type CaseScope = 'all' | 'mine' | 'saved' | 'helping'
export type AdminCase = ApiCase & { flagReasons: Record<string, number> }

export const keys = {
  me: ['me'] as const,
  cases: (scope: CaseScope) => ['cases', scope] as const,
  case: (id: number) => ['case', id] as const,
  comments: (id: number) => ['comments', id] as const,
  stats: ['stats'] as const,
  campaign: ['campaign'] as const,
  donations: ['donations'] as const,
  notifications: ['notifications'] as const,
}

/* ---------- Lecturas ---------- */

export const useCases = (scope: CaseScope = 'all') =>
  useQuery({ queryKey: keys.cases(scope), queryFn: () => api<ApiCase[]>(`/cases?scope=${scope}`), refetchInterval: scope === 'all' ? 60_000 : false })

export const useCase = (id: number) => useQuery({ queryKey: keys.case(id), queryFn: () => api<ApiCaseDetail>(`/cases/${id}`), enabled: id > 0 })

export const useComments = (id: number) =>
  useQuery({ queryKey: keys.comments(id), queryFn: () => api<ApiComment[]>(`/cases/${id}/comments`), refetchInterval: 20_000 })

export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: () => api<ApiStats>('/stats') })
export const useCampaign = () => useQuery({ queryKey: keys.campaign, queryFn: () => api<ApiCampaign | null>('/donations/campaign') })
export const useMyDonations = () => useQuery({ queryKey: keys.donations, queryFn: () => api<ApiDonation[]>('/donations/mine') })
export const useNotifications = (enabled = true) =>
  useQuery({ queryKey: keys.notifications, queryFn: () => api<ApiNotification[]>('/notifications'), enabled, refetchInterval: 45_000 })

export const fetchDuplicates = (lat: number, lng: number) => api<DuplicateCandidate[]>(`/cases/duplicates?lat=${lat}&lng=${lng}`)

/* ---------- Mutaciones de casos ---------- */

function useCaseMutation<V, R>(fn: (v: V) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cases'] })
      void qc.invalidateQueries({ queryKey: ['case'] })
      void qc.invalidateQueries({ queryKey: keys.me })
      void qc.invalidateQueries({ queryKey: keys.stats })
    },
  })
}

export interface NewCase {
  name: string
  species: ApiCase['species']
  condition: ApiCase['condition']
  needs: Need[]
  description: string
  photos: string[]
  lat: number
  lng: number
  address: string
  anonymous: boolean
}

export const useCreateCase = () => useCaseMutation((b: NewCase) => api<ApiCase>('/cases', { method: 'POST', json: b }))
export const useUpdateCase = (id: number) => useCaseMutation((b: Partial<ApiCase>) => api<ApiCase>(`/cases/${id}`, { method: 'PATCH', json: b }))
export const useChangeStatus = (id: number) =>
  useCaseMutation((b: { status: CaseStatus; detail?: string }) => api<ApiCase>(`/cases/${id}/status`, { method: 'POST', json: b }))
export const useUpdateNeeds = (id: number) => useCaseMutation((needs: NeedItem[]) => api<ApiCase>(`/cases/${id}/needs`, { method: 'PUT', json: { needs } }))
export const useAddPhotos = (id: number) => useCaseMutation((keys: string[]) => api<ApiCase>(`/cases/${id}/photos`, { method: 'POST', json: { keys } }))
export const useJoinHelp = (id: number) => useCaseMutation((helpType: string) => api<ApiCase>(`/cases/${id}/help`, { method: 'POST', json: { helpType } }))
export const useLeaveHelp = (id: number) => useCaseMutation(() => api<ApiCase>(`/cases/${id}/help`, { method: 'DELETE' }))
export const useToggleSave = () =>
  useCaseMutation(({ id, save }: { id: number; save: boolean }) => api(`/cases/${id}/save`, { method: save ? 'POST' : 'DELETE' }))
export const useFlag = (id: number) => useCaseMutation((reason: FlagReason) => api(`/cases/${id}/flag`, { method: 'POST', json: { reason } }))

export function usePostComment(id: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => api(`/cases/${id}/comments`, { method: 'POST', json: { body } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.comments(id) }),
  })
}

/* ---------- Donaciones ---------- */

export function useDonate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (b: { amount: number; frequency: 'unica' | 'mensual'; destination: string; method: string; caseId?: number }) =>
      api('/donations', { method: 'POST', json: b }),
    onSuccess: () => {
      for (const k of [keys.campaign, keys.donations, keys.me]) void qc.invalidateQueries({ queryKey: k })
      void qc.invalidateQueries({ queryKey: ['case'] })
      void qc.invalidateQueries({ queryKey: ['cases'] })
    },
  })
}

/* ---------- Notificaciones ---------- */

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids?: number[]) => api('/notifications/read', { method: 'POST', json: { ids } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.notifications })
      void qc.invalidateQueries({ queryKey: keys.me })
    },
  })
}

/* ---------- Administración ---------- */

export const useAdminStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<AdminStats>('/admin/stats') })
export const useAdminCases = (filter: string) => useQuery({ queryKey: ['admin', 'cases', filter], queryFn: () => api<AdminCase[]>(`/admin/cases?filter=${filter}`) })
export const useAdminUsers = (q: string) =>
  useQuery({ queryKey: ['admin', 'users', q], queryFn: () => api<AdminUserRow[]>(`/admin/users?q=${encodeURIComponent(q)}`) })

function useAdminMutation<V>(fn: (v: V) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] })
      void qc.invalidateQueries({ queryKey: ['cases'] })
      void qc.invalidateQueries({ queryKey: ['case'] })
      void qc.invalidateQueries({ queryKey: keys.campaign })
      void qc.invalidateQueries({ queryKey: keys.stats })
    },
  })
}

export const useAdminUpdateCase = () =>
  useAdminMutation(({ id, ...b }: { id: number; hidden?: boolean; hiddenReason?: string | null; verified?: boolean }) =>
    api(`/admin/cases/${id}`, { method: 'PATCH', json: b }),
  )
export const useAdminClearFlags = () => useAdminMutation((id: number) => api(`/admin/cases/${id}/flags`, { method: 'DELETE' }))
export const useAdminDeleteCase = () => useAdminMutation((id: number) => api(`/admin/cases/${id}`, { method: 'DELETE' }))
export const useAdminUpdateUser = () =>
  useAdminMutation(({ id, ...b }: { id: string; role?: 'user' | 'admin'; verified?: boolean; disabled?: boolean }) =>
    api<ApiUser>(`/admin/users/${id}`, { method: 'PATCH', json: b }),
  )
export const useAdminResetPassword = () => useMutation({ mutationFn: (id: string) => api<{ tempPassword: string }>(`/admin/users/${id}/reset-password`, { method: 'POST' }) })
export const useAdminCampaign = () =>
  useAdminMutation((b: { title: string; goal: number; startsAt: string; endsAt: string }) => api<ApiCampaign>('/admin/campaign', { method: 'PUT', json: b }))
