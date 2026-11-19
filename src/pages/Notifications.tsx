import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState, ErrorState, Icon, LoadingScreen } from '../components/ui'
import { timeAgo } from '../lib/format'
import { useMarkRead, useNotifications } from '../lib/queries'

const ICONS: Record<string, string> = {
  status: 'swap_horiz',
  help: 'volunteer_activism',
  comment: 'chat',
  donation: 'favorite',
  moderation: 'gavel',
  verified: 'verified',
}

export default function Notifications() {
  const navigate = useNavigate()
  const q = useNotifications()
  const markRead = useMarkRead()
  const unread = q.data?.filter((n) => !n.read).length ?? 0

  // Al salir de la pantalla se marcan como leídas
  useEffect(() => {
    return () => {
      if (unread > 0) markRead.mutate(undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread])

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-dvh bg-surface flex flex-col">
      <header className="sticky top-0 z-50 bg-surface/95 backdrop-blur-md border-b border-outline-variant/30 pt-safe">
        <div className="flex items-center justify-between px-4 py-3">
          <button aria-label="Volver" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} className="w-10 h-10 rounded-full flex items-center justify-center text-primary hover:bg-surface-container" type="button">
            <Icon name="arrow_back" className="text-2xl" />
          </button>
          <h1 className="font-headline font-extrabold text-base text-primary">Notificaciones</h1>
          <button
            onClick={() => markRead.mutate(undefined)}
            disabled={unread === 0}
            className="text-[11px] font-bold text-primary disabled:text-outline px-2"
            type="button"
          >
            Marcar leídas
          </button>
        </div>
      </header>
      <main className="flex-1 px-4 py-3">
        {q.isPending ? (
          <LoadingScreen />
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data?.length ? (
          <EmptyState icon="notifications_off" title="Sin notificaciones" text="Te avisaremos cuando alguien se una a tus casos, cambie su estado o deje un mensaje." />
        ) : (
          <ul className="space-y-2">
            {q.data.map((n) => {
              const content = (
                <>
                  <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${n.read ? 'bg-surface-container text-outline' : 'bg-primary-fixed text-primary'}`}>
                    <Icon name={ICONS[n.type] ?? 'notifications'} className="text-xl" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs ${n.read ? 'font-semibold text-on-surface-variant' : 'font-bold text-on-surface'}`}>{n.title}</p>
                    <p className="text-[11px] text-outline line-clamp-2">{n.body}</p>
                    <p className="text-[10px] text-outline mt-0.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-secondary-container shrink-0 mt-1.5" />}
                </>
              )
              const cls = `flex gap-3 items-start p-3 rounded-2xl border ${n.read ? 'bg-surface border-surface-container-high' : 'bg-surface-container-lowest border-primary/20 shadow-xs'}`
              return (
                <li key={n.id}>
                  {n.caseId ? (
                    <Link to={`/caso/${n.caseId}`} className={cls}>
                      {content}
                    </Link>
                  ) : (
                    <div className={cls}>{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
