import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ApiMe, ApiUser } from '../../shared/types'
import { api, setUnauthorizedHandler, tokenStore } from '../lib/api'
import { keys } from '../lib/queries'

interface AuthState {
  user: ApiMe | undefined
  loading: boolean
  isAdmin: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [token, setToken] = useState(() => tokenStore.get())

  const me = useQuery({
    queryKey: keys.me,
    queryFn: () => api<ApiMe>('/me'),
    enabled: Boolean(token),
    retry: (count, err) => (err as { status?: number }).status !== 401 && count < 2,
    refetchInterval: 60_000,
  })

  const clear = useCallback(() => {
    tokenStore.set(null)
    setToken(null)
    qc.clear()
  }, [qc])

  useEffect(() => setUnauthorizedHandler(clear), [clear])

  const start = useCallback(
    async (res: { token: string; user: ApiUser }) => {
      tokenStore.set(res.token)
      setToken(res.token)
      qc.setQueryData<ApiMe>(keys.me, { ...res.user, reports: 0, helping: 0, donated: 0, unread: 0 })
      await qc.invalidateQueries({ queryKey: keys.me })
    },
    [qc],
  )

  const login = useCallback(
    async (email: string, password: string) => start(await api('/auth/login', { method: 'POST', json: { email, password } })),
    [start],
  )
  const register = useCallback(
    async (name: string, email: string, password: string) => start(await api('/auth/register', { method: 'POST', json: { name, email, password } })),
    [start],
  )
  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' })
    } catch {
      /* si falla, igual se cierra localmente */
    }
    clear()
  }, [clear])

  const value = useMemo<AuthState>(
    () => ({
      user: token ? me.data : undefined,
      loading: Boolean(token) && me.isPending,
      isAdmin: me.data?.role === 'admin',
      login,
      register,
      logout,
    }),
    [token, me.data, me.isPending, login, register, logout],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
