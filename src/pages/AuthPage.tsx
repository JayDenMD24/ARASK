import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { loginSchema, registerSchema } from '../../shared/schemas'
import { Icon, Spinner } from '../components/ui'
import { errorMessage } from '../lib/api'
import { useAuth } from '../store/AuthProvider'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const isRegister = mode === 'register'

  if (user) return <Navigate to={from} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = isRegister ? registerSchema.safeParse({ name, email, password }) : loginSchema.safeParse({ email, password })
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Revisa los datos')
    setBusy(true)
    try {
      if (isRegister) await register(name.trim(), email.trim(), password)
      else await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const input =
    'w-full rounded-2xl bg-surface-container-lowest border border-outline-variant/50 px-4 py-3 text-sm text-on-surface placeholder:text-outline/70 focus:border-primary focus:ring-2 focus:ring-primary/20'

  return (
    <div className="min-h-dvh w-full max-w-[420px] mx-auto flex flex-col bg-surface">
      <header className="bg-primary-container text-white px-6 pt-[calc(env(safe-area-inset-top)+2.5rem)] pb-16 rounded-b-[36px] relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/5" />
        <div className="absolute right-10 top-20 w-24 h-24 rounded-full bg-white/5" />
        <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center mb-4">
          <Icon name="pets" fill className="text-3xl text-inverse-primary" />
        </div>
        <h1 className="font-headline font-black text-3xl tracking-tight">ARASK</h1>
        <p className="text-sm text-inverse-primary font-medium mt-1 max-w-[260px]">Red comunitaria para reportar, rescatar y cuidar animales en Montería.</p>
      </header>

      <main className="flex-1 px-5 -mt-8">
        <form onSubmit={submit} className="bg-surface-container-lowest rounded-3xl shadow-lg border border-outline-variant/20 p-5 space-y-3.5" noValidate>
          <div className="flex bg-surface-container-low p-1 rounded-2xl gap-1 mb-1">
            <Link
              to="/entrar"
              replace
              state={location.state}
              className={`flex-1 text-center py-2 rounded-xl text-xs font-headline font-bold ${!isRegister ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              Iniciar sesión
            </Link>
            <Link
              to="/registro"
              replace
              state={location.state}
              className={`flex-1 text-center py-2 rounded-xl text-xs font-headline font-bold ${isRegister ? 'bg-surface-container-lowest text-primary shadow-sm' : 'text-on-surface-variant'}`}
            >
              Crear cuenta
            </Link>
          </div>

          {isRegister && (
            <label className="block space-y-1">
              <span className="text-xs font-bold text-primary">Nombre</span>
              <input className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="¿Cómo te llamas?" maxLength={40} />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-xs font-bold text-primary">Correo electrónico</span>
            <input className={input} type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="tucorreo@ejemplo.com" />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-bold text-primary">Contraseña</span>
            <div className="relative">
              <input
                className={`${input} pr-11`}
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'Mínimo 8 caracteres' : 'Tu contraseña'}
              />
              <button
                type="button"
                aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline"
              >
                <Icon name={showPass ? 'visibility_off' : 'visibility'} className="text-lg" />
              </button>
            </div>
          </label>

          {error && (
            <p role="alert" className="text-xs font-semibold text-error bg-error-container/60 rounded-xl px-3 py-2 flex gap-1.5 items-start">
              <Icon name="error" className="text-sm" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-3.5 rounded-2xl bg-secondary-container hover:bg-secondary text-white font-headline font-extrabold text-sm shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? <Spinner className="w-5 h-5 border-white/30 border-t-white" /> : <Icon name={isRegister ? 'person_add' : 'login'} className="text-base" />}
            {isRegister ? 'Crear mi cuenta' : 'Entrar'}
          </button>
          {!isRegister && (
            <p className="text-[11px] text-outline text-center">¿Olvidaste tu contraseña? Escríbele al equipo de ARASK para restablecerla.</p>
          )}
        </form>
        <p className="text-[11px] text-outline text-center mt-5 px-6 pb-8">
          Al continuar aceptas usar ARASK de forma responsable. Tus reportes pueden ser anónimos y solo los administradores ven tu correo.
        </p>
      </main>
    </div>
  )
}
