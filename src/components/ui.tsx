import { useEffect, type ReactNode } from 'react'
import { assetUrl } from '../lib/api'
import { initials } from '../lib/format'
import { useApp } from '../store/AppStore'

export function Icon({ name, fill, className = '' }: { name: string; fill?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined ${fill ? 'fill-icon' : ''} ${className}`}>
      {name}
    </span>
  )
}

export function Avatar({ person, size = 'w-5 h-5 text-[10px]' }: { person: { name: string; avatarUrl: string | null }; size?: string }) {
  const src = assetUrl(person.avatarUrl)
  if (src) {
    return <img src={src} alt={person.name} className={`${size} rounded-full object-cover shrink-0`} />
  }
  return (
    <span className={`${size} rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary shrink-0`}>
      {person.name === 'Anónimo' ? '?' : initials(person.name)}
    </span>
  )
}

export function Spinner({ className = 'w-6 h-6' }: { className?: string }) {
  return <span className={`${className} inline-block rounded-full border-2 border-primary/20 border-t-primary animate-spin`} aria-label="Cargando" />
}

export function LoadingScreen({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="min-h-[50dvh] flex flex-col items-center justify-center gap-3 text-xs text-outline">
      <Spinner className="w-8 h-8" />
      {label}
    </div>
  )
}

export function EmptyState({ icon, title, text, children }: { icon: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="py-8 px-6 text-center flex flex-col items-center gap-1.5">
      <span className="w-14 h-14 rounded-full bg-surface-container flex items-center justify-center text-outline mb-1">
        <Icon name={icon} className="text-3xl" />
      </span>
      <p className="font-headline font-bold text-sm text-primary">{title}</p>
      {text && <p className="text-xs text-on-surface-variant max-w-[260px]">{text}</p>}
      {children}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <EmptyState icon="cloud_off" title="No pudimos cargar la información" text={error instanceof Error ? error.message : undefined}>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 px-4 py-2 rounded-full bg-primary-container text-white text-xs font-bold" type="button">
          Reintentar
        </button>
      )}
    </EmptyState>
  )
}

export function Toast() {
  const { toast } = useApp()
  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-[calc(env(safe-area-inset-top)+1.25rem)] left-1/2 -translate-x-1/2 z-[1200] bg-inverse-surface text-inverse-on-surface px-4 py-2.5 rounded-full shadow-lg text-xs font-semibold flex items-center gap-2 max-w-[90vw] transition-opacity duration-200 ${
        toast ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {toast && (
        <>
          <Icon name={toast.icon} className={`text-sm ${toast.icon === 'error' ? 'text-red-400' : 'text-emerald-400'}`} />
          <span>{toast.message}</span>
        </>
      )}
    </div>
  )
}

/** Hoja inferior modal (bottom sheet) */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/60 backdrop-blur-[2px] flex items-end justify-center animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[420px] bg-surface-container-lowest rounded-t-[28px] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] shadow-2xl flex flex-col gap-4 animate-slide-up max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-outline-variant/60 rounded-full mx-auto" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-headline font-extrabold text-lg text-primary leading-snug">{title}</h3>
            {subtitle && <div className="text-xs text-outline mt-0.5">{subtitle}</div>}
          </div>
          <button
            aria-label="Cerrar"
            className="w-8 h-8 shrink-0 rounded-full bg-surface-container text-outline flex items-center justify-center"
            onClick={onClose}
            type="button"
          >
            <Icon name="close" className="text-base" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function ProgressBar({ value, className = 'h-2.5' }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={`w-full bg-surface-container-high rounded-full overflow-hidden ${className}`}>
      <div className="h-full bg-secondary-container rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}
