import { Link, useNavigate } from 'react-router-dom'
import type { ApiCase } from '../data/types'
import { CONDITIONS, NEEDS, STATUS } from '../data/catalog'
import { assetUrl, errorMessage } from '../lib/api'
import { formatWhen } from '../lib/format'
import { formatDistance } from '../lib/geo'
import { useToggleSave } from '../lib/queries'
import { useApp } from '../store/AppStore'
import { Avatar, Icon } from './ui'

export function CaseThumb({ c, className }: { c: ApiCase; className: string }) {
  const src = assetUrl(c.photos[0])
  return src ? (
    <img className={`${className} object-cover`} src={src} alt={`Foto de ${c.name}`} loading="lazy" />
  ) : (
    <span className={`${className} flex items-center justify-center bg-surface-container text-outline`}>
      <span className="material-symbols-outlined text-3xl">pets</span>
    </span>
  )
}

export function SaveButton({ c, className = '' }: { c: ApiCase; className?: string }) {
  const { showToast } = useApp()
  const toggle = useToggleSave()
  return (
    <button
      aria-label={c.saved ? 'Quitar de guardados' : 'Guardar caso'}
      disabled={toggle.isPending}
      onClick={(e) => {
        e.stopPropagation()
        toggle.mutate(
          { id: c.id, save: !c.saved },
          {
            onSuccess: () => showToast(c.saved ? 'Caso removido de tus guardados' : 'Caso guardado para seguimiento'),
            onError: (err) => showToast(errorMessage(err), 'error'),
          },
        )
      }}
      className={className}
      type="button"
    >
      <Icon name="bookmark" fill={c.saved} className="text-base" />
    </button>
  )
}

/** Tarjeta grande de "Reportes recientes" (pantalla de inicio). */
export function CaseCard({ c }: { c: ApiCase }) {
  const { distanceTo } = useApp()
  const navigate = useNavigate()
  const resolved = STATUS[c.status].resolved
  const cond = CONDITIONS[c.condition]
  const urgent = !resolved && cond.priority >= 2

  return (
    <article className="bg-surface-container-lowest rounded-[20px] p-3.5 shadow-sm border border-outline-variant/25 transition-all hover:border-primary/30">
      <Link to={`/caso/${c.id}`} className="flex gap-3.5">
        <div className="relative w-24 h-28 rounded-2xl overflow-hidden shrink-0 bg-surface-container">
          <CaseThumb c={c} className="w-full h-full" />
          <span
            className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold font-headline uppercase tracking-wider shadow-xs ${
              urgent ? 'bg-error text-on-error' : 'bg-tertiary-container text-tertiary-fixed'
            }`}
          >
            {resolved ? STATUS[c.status].short : urgent ? 'Urgente' : 'Estable'}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-headline font-bold text-base text-on-surface tracking-tight truncate flex items-center gap-1">
                {c.name}
                {c.verified && <Icon name="verified" fill className="text-primary text-sm" />}
              </h3>
              <span className={`px-2 py-0.5 rounded-full font-headline font-bold text-[10px] shrink-0 flex items-center gap-0.5 ${cond.chip}`}>
                {c.condition === 'saludable' && <Icon name="check_circle" className="text-[11px]" />}
                {cond.label}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1 mt-1 truncate">
              <Icon name="location_on" className="text-sm text-outline" />
              <span className="truncate">{c.address}</span>
            </p>
            <div className="flex items-center gap-2 text-[11px] text-outline mt-0.5">
              <span className="flex items-center gap-0.5">
                <Icon name="schedule" className="text-xs" />
                {formatWhen(c.createdAt)}
              </span>
              <span>•</span>
              <span className={`font-semibold flex items-center gap-0.5 ${resolved ? 'text-outline' : 'text-secondary'}`}>
                <Icon name="distance" className="text-xs" />
                {formatDistance(distanceTo(c))}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {c.needs
              .filter((n) => n.state !== 'cubierto')
              .slice(0, 3)
              .map((n) => (
                <span key={n.need} className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-label font-semibold flex items-center gap-1">
                  <Icon name={NEEDS[n.need].icon} className={`text-[12px] ${NEEDS[n.need].color}`} />
                  {NEEDS[n.need].label}
                </span>
              ))}
          </div>
        </div>
      </Link>
      <div className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-on-surface-variant min-w-0">
          <Avatar person={c.reporter} />
          <span className="text-[11px] font-medium truncate">Reportado por {c.isReporter ? 'ti' : c.reporter.name}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <SaveButton
            c={c}
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
              c.saved ? 'text-primary border-primary' : 'text-outline border-outline-variant/40 hover:text-primary hover:border-primary'
            }`}
          />
          {resolved || c.myHelp ? (
            <button
              onClick={() => navigate(`/caso/${c.id}`)}
              className="px-4 py-1.5 rounded-full bg-surface-container-high text-primary font-headline font-bold text-xs hover:bg-surface-container-highest active:scale-95 transition-all flex items-center gap-1"
              type="button"
            >
              {c.myHelp ? 'Ver rescate' : 'Conocer'} <Icon name="arrow_forward" className="text-sm" />
            </button>
          ) : (
            <button
              onClick={() => navigate(`/caso/${c.id}?ayudar=1`)}
              className="px-4 py-1.5 rounded-full bg-primary-container text-white font-headline font-bold text-xs shadow-xs hover:bg-primary active:scale-95 transition-all flex items-center gap-1"
              type="button"
            >
              Ayudar <Icon name="volunteer_activism" className="text-sm" />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

/** Tarjeta compacta (hoja inferior del mapa, perfil). */
export function CaseRow({ c, onFocus }: { c: ApiCase; onFocus?: () => void }) {
  const { distanceTo } = useApp()
  const navigate = useNavigate()
  const resolved = STATUS[c.status].resolved
  const cond = CONDITIONS[c.condition]
  return (
    <article
      onClick={onFocus ?? (() => navigate(`/caso/${c.id}`))}
      className={`p-3 rounded-2xl bg-surface border border-surface-variant/80 shadow-sm hover:shadow transition-all flex gap-3 items-center cursor-pointer ${c.hidden ? 'opacity-60' : ''}`}
    >
      <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-surface-container">
        <CaseThumb c={c} className="w-full h-full" />
        <span className={`absolute top-1 left-1 text-[9px] font-extrabold px-1.5 rounded-md uppercase ${resolved ? 'bg-[#10B981] text-white' : cond.badge}`}>
          {c.hidden ? 'Oculto' : resolved ? 'Listo' : c.condition === 'urgente' ? 'SOS' : cond.label}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-headline font-bold text-sm text-on-surface truncate">{c.name}</h3>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${resolved ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant' : cond.chip}`}>
            {resolved ? STATUS[c.status].short : cond.label}
          </span>
        </div>
        <p className="text-xs text-outline font-medium flex items-center gap-1 mt-0.5 truncate">
          <Icon name="location_on" className="text-xs" />
          <span className="truncate">{c.address}</span>
        </p>
        <div className="flex items-center gap-1.5 mt-1.5 min-w-0">
          <span className="text-[10px] text-outline font-bold whitespace-nowrap">
            {formatWhen(c.createdAt).replace(',', '')} · {formatDistance(distanceTo(c))}
          </span>
          <span className="text-outline-variant text-[8px]">•</span>
          <div className="flex items-center gap-1 overflow-hidden">
            {c.needs.slice(0, 2).map((n) => (
              <span key={n.need} className="px-1.5 rounded bg-surface-container text-on-surface-variant text-[10px] font-semibold whitespace-nowrap">
                {NEEDS[n.need].label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <button
        aria-label={`Ver caso de ${c.name}`}
        onClick={(e) => {
          e.stopPropagation()
          navigate(`/caso/${c.id}`)
        }}
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:scale-95 shadow-xs ${
          resolved ? 'bg-surface-variant text-on-surface-variant' : 'bg-primary-container text-white'
        }`}
        type="button"
      >
        <Icon name={resolved ? 'favorite' : 'arrow_forward'} className="text-base" />
      </button>
    </article>
  )
}
