import { NavLink, useNavigate } from 'react-router-dom'
import { Icon } from './ui'

const tabs = [
  { to: '/', label: 'Inicio', icon: 'home', end: true },
  { to: '/mapa', label: 'Mapa', icon: 'explore' },
  null, // botón central "Reportar"
  { to: '/donar', label: 'Donar', icon: 'volunteer_activism' },
  { to: '/perfil', label: 'Perfil', icon: 'person' },
] as const

export default function BottomNav() {
  const navigate = useNavigate()
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-[1000] mx-auto w-full max-w-[420px] bg-surface-container-lowest rounded-t-3xl shadow-[0_-8px_24px_rgba(0,0,0,0.08)] pb-safe"
    >
      <div className="flex justify-around items-center px-3 py-2">
        {tabs.map((t) =>
          t === null ? (
            <div key="reportar" className="relative -top-5 flex flex-col items-center">
              <button
                aria-label="Reportar animal"
                onClick={() => navigate('/reportar')}
                className="w-14 h-14 rounded-full bg-secondary-container text-white flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all ring-4 ring-surface"
                type="button"
              >
                <Icon name="add_circle" fill className="text-3xl" />
              </button>
              <span className="font-label text-xs font-bold text-secondary mt-1">Reportar</span>
            </div>
          ) : (
            <NavLink
              key={t.to}
              to={t.to}
              end={'end' in t ? t.end : false}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-12 transition-colors active:scale-95 duration-150 ${
                  isActive ? 'text-primary font-bold' : 'text-on-surface-variant hover:text-primary'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon name={t.icon} fill={isActive} className="text-2xl" />
                  <span className="font-label text-xs font-semibold mt-0.5 tracking-tight">{t.label}</span>
                  <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isActive ? 'bg-primary' : 'bg-transparent'}`} />
                </>
              )}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  )
}
