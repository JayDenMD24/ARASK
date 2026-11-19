import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon, ProgressBar, Sheet } from '../components/ui'
import { errorMessage } from '../lib/api'
import { useCampaign, useDonate, useMyDonations, useStats } from '../lib/queries'
import { PAYMENT_METHODS } from '../data/catalog'
import { formatCOP, formatNumber, formatWhen } from '../lib/format'
import { useApp } from '../store/AppStore'

const AMOUNTS = [
  { value: 20_000, label: 'Alimento básico', impact: '1 bolsa grande de concentrado nutritivo para 3 días.' },
  { value: 50_000, label: 'Consulta médica', impact: 'cubren una consulta veterinaria de urgencia o una desparasitación completa.', popular: true },
  { value: 100_000, label: 'Vacunación completa', impact: 'aseguran las vacunas múltiple y antirrábica para un perrito rescatado.' },
  { value: 200_000, label: 'Esterilización integral', impact: 'financian una esterilización con cuidados postoperatorios y antibióticos.' },
]
const DESTINATIONS = [
  { key: 'Donde más se necesite', icon: 'auto_awesome' },
  { key: 'Veterinario', icon: 'medical_services' },
  { key: 'Alimento', icon: 'restaurant' },
  { key: 'Esterilización', icon: 'healing' },
]

export default function Donate() {
  const { showToast } = useApp()
  const campaignQ = useCampaign()
  const donationsQ = useMyDonations()
  const statsQ = useStats()
  const donateM = useDonate()
  const campaign = campaignQ.data
  const donations = donationsQ.data ?? []
  const [frequency, setFrequency] = useState<'unica' | 'mensual'>('mensual')
  const [amount, setAmount] = useState(50_000)
  const [custom, setCustom] = useState('')
  const [destination, setDestination] = useState(DESTINATIONS[0]!.key)
  const [confirming, setConfirming] = useState(false)
  const [history, setHistory] = useState(false)
  const [method, setMethod] = useState(PAYMENT_METHODS[0]!.key)

  const preset = AMOUNTS.find((a) => a.value === amount && !custom)
  const impact = preset
    ? `${formatCOP(preset.value)} ${preset.impact}`
    : `Tu aporte personalizado de ${formatCOP(amount)} impulsará directamente el fondo médico y de rescates activos.`
  const pct = campaign ? Math.round((campaign.raised / campaign.goal) * 100) : 0
  const daysLeft = campaign ? Math.max(0, Math.ceil((new Date(campaign.endsAt).getTime() - Date.now()) / 86_400_000)) : 0
  const monthLabel = campaign ? new Date(campaign.startsAt).toLocaleDateString('es-CO', { month: 'long', timeZone: 'America/Bogota' }) : ''
  const generalDonations = donations.filter((d) => !d.caseId)

  function pay() {
    donateM.mutate(
      { amount, frequency, destination, method },
      {
        onSuccess: () => {
          setConfirming(false)
          showToast(`¡Gracias! Donación de ${formatCOP(amount)} registrada (simulación)`, 'favorite')
        },
        onError: (err) => showToast(errorMessage(err), 'error'),
      },
    )
  }

  return (
    <div className="w-full max-w-[420px] mx-auto min-h-dvh flex flex-col relative bg-surface pb-28">
      <header className="sticky top-0 z-[500] bg-surface/95 backdrop-blur-md shadow-sm pt-safe">
        <div className="flex justify-between items-center w-full px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Icon name="pets" className="text-xl" />
            </div>
            <div>
              <span className="font-headline font-black text-xl text-primary tracking-tight block leading-tight">ARASK</span>
              <span className="font-label text-[10px] uppercase font-bold tracking-wider text-secondary">Comunidad de Rescate</span>
            </div>
          </div>
          <button
            aria-label="Historial de donaciones"
            onClick={() => setHistory(true)}
            className="w-9 h-9 rounded-full bg-surface-container flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high active:scale-95 transition-all relative"
            type="button"
          >
            <Icon name="receipt_long" className="text-xl" />
            {donations.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-secondary-container" />}
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 pt-3 pb-8 flex flex-col gap-5">
        <section className="px-1">
          <div className="flex items-center gap-1.5 text-secondary font-label font-bold text-xs uppercase tracking-wider mb-1">
            <Icon name="volunteer_activism" fill className="text-sm" /> Donaciones transparentes
          </div>
          <h1 className="font-headline font-extrabold text-2xl text-primary tracking-tight">Donar y salvar vidas</h1>
          <p className="text-on-surface-variant text-sm mt-1 leading-relaxed">
            Cada peso se convierte en alimento, cirugías de emergencia y una segunda oportunidad real.
          </p>
        </section>

        {/* Campaña */}
        <section className="bg-surface-container-lowest rounded-[22px] overflow-hidden shadow-sm border border-surface-container-highest">
          <div className="relative h-44 w-full overflow-hidden">
            <img className="w-full h-full object-cover" src="/img/donar-hero.jpg" alt="Perro rescatado sonriendo" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 bg-secondary-container/95 text-on-secondary-container px-3 py-1 rounded-full text-xs font-headline font-bold flex items-center gap-1 shadow-sm">
              <Icon name="event" fill className="text-xs" /> Meta de {monthLabel}
            </div>
            <div className="absolute bottom-3 left-3 right-3 text-white">
              <span className="text-xs uppercase font-label font-semibold text-secondary-fixed tracking-wide">Campaña prioritaria</span>
              <h2 className="font-headline font-bold text-base leading-snug drop-shadow-sm">{campaign?.title ?? 'Sin campaña activa'}</h2>
            </div>
          </div>
          <div className="p-4 flex flex-col gap-3">
            <div>
              <div className="flex justify-between items-baseline mb-1.5">
                <div className="flex items-baseline gap-1">
                  <span className="font-headline font-extrabold text-lg text-primary">{formatCOP(campaign?.raised ?? 0)}</span>
                  <span className="text-xs text-on-surface-variant font-label">de {formatCOP(campaign?.goal ?? 0)}</span>
                </div>
                <span className="font-headline font-bold text-sm text-secondary">{Math.min(pct, 100)}%</span>
              </div>
              <ProgressBar value={pct} />
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-surface-container-high text-xs text-on-surface-variant">
              <span className="flex items-center gap-1.5 font-medium">
                <Icon name="group" className="text-sm text-primary" />
                <span>
                  <strong className="text-on-surface">{formatNumber(campaign?.donors ?? 0)}</strong> {campaign?.donors === 1 ? 'donante' : 'donantes'}
                </span>
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Icon name="schedule" className="text-sm text-secondary" />
                <span>
                  Faltan <strong className="text-on-surface">{daysLeft} días</strong>
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* Frecuencia */}
        <section className="bg-surface-container-low p-1.5 rounded-2xl flex items-center gap-1" role="radiogroup" aria-label="Frecuencia">
          {(['unica', 'mensual'] as const).map((f) => {
            const active = frequency === f
            return (
              <button
                key={f}
                role="radio"
                aria-checked={active}
                onClick={() => setFrequency(f)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-headline font-bold transition-all flex items-center justify-center gap-1.5 ${
                  active ? 'bg-surface-container-lowest text-primary shadow-sm border border-primary/10' : 'text-on-surface-variant hover:text-on-surface'
                }`}
                type="button"
              >
                {f === 'mensual' && <Icon name="cached" fill className="text-sm text-secondary-container" />}
                <span>{f === 'unica' ? 'Única vez' : 'Mensual'}</span>
                {f === 'mensual' && (
                  <span className="text-[9px] bg-tertiary-fixed text-on-tertiary-fixed font-label font-extrabold px-1.5 py-0.5 rounded-full uppercase ml-0.5">Sostén</span>
                )}
              </button>
            )
          })}
        </section>

        {/* Monto */}
        <section className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <span className="font-headline font-bold text-sm text-on-surface">Elige un monto</span>
            <span className="text-xs text-on-surface-variant font-label font-medium">Pesos colombianos (COP)</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {AMOUNTS.map((a) => {
              const active = preset?.value === a.value
              return (
                <button
                  key={a.value}
                  onClick={() => {
                    setAmount(a.value)
                    setCustom('')
                  }}
                  aria-pressed={active}
                  className={`text-left border-2 p-3.5 rounded-2xl flex flex-col justify-between transition-all active:scale-[0.98] ${
                    active ? 'bg-secondary-fixed/30 border-secondary-container shadow-sm' : 'bg-surface-container-lowest border-surface-container-highest hover:border-outline-variant'
                  }`}
                  type="button"
                >
                  <div className="flex justify-between items-start w-full">
                    <span className={`font-label text-xs ${active ? 'font-bold text-secondary' : 'font-semibold text-on-surface-variant'}`}>COP</span>
                    {active && (
                      <span className="w-5 h-5 rounded-full bg-secondary-container text-white flex items-center justify-center">
                        <Icon name="check" className="text-xs" />
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`font-headline text-xl ${active ? 'font-black text-primary' : 'font-extrabold text-on-surface'}`}>{formatCOP(a.value)}</span>
                      {a.popular && (
                        <span className="text-[9px] bg-secondary-container text-on-secondary-container font-headline font-bold px-1.5 py-0.5 rounded-md">Popular</span>
                      )}
                    </div>
                    <p className={`text-[11px] mt-0.5 font-medium leading-tight ${active ? 'text-secondary' : 'text-on-surface-variant'}`}>{a.label}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <div className={`bg-surface-container-lowest border rounded-2xl p-2.5 flex items-center justify-between ${custom ? 'border-secondary-container' : 'border-surface-container-highest'}`}>
            <div className="flex items-center gap-2 pl-2 flex-1">
              <Icon name="edit" className="text-on-surface-variant text-base" />
              <span className="text-xs font-semibold text-on-surface-variant whitespace-nowrap">Otro monto:</span>
              <div className="flex items-center flex-1">
                <span className="font-headline font-bold text-primary mr-1">$</span>
                <input
                  className="w-full bg-transparent border-0 p-0 text-sm font-headline font-bold text-primary focus:ring-0 focus:outline-none placeholder:text-outline/60"
                  inputMode="numeric"
                  placeholder="Ingresar"
                  aria-label="Otro monto en pesos"
                  value={custom ? formatNumber(Number(custom)) : ''}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
                    setCustom(digits)
                    const n = parseInt(digits, 10)
                    if (n > 0) setAmount(n)
                    else setAmount(50_000)
                  }}
                />
              </div>
            </div>
            <span className="text-xs font-label font-bold text-outline px-2 py-1 bg-surface-container rounded-lg">COP</span>
          </div>
          <div className="bg-tertiary-fixed/30 border border-tertiary-fixed-dim/40 rounded-2xl p-3 flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-tertiary-container text-white flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="favorite" className="text-sm" />
            </div>
            <div className="text-xs">
              <span className="font-headline font-bold block text-primary">Impacto directo de tu ayuda:</span>
              <p className="text-on-surface-variant mt-0.5 font-medium leading-relaxed">{impact}</p>
            </div>
          </div>
        </section>

        {/* Destino */}
        <section className="flex flex-col gap-2.5">
          <span className="font-headline font-bold text-sm text-on-surface px-1">¿A qué destinar tu donación?</span>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {DESTINATIONS.map((d) => {
              const active = destination === d.key
              return (
                <button
                  key={d.key}
                  onClick={() => setDestination(d.key)}
                  aria-pressed={active}
                  className={`shrink-0 px-3.5 py-2 rounded-full text-xs font-headline font-bold flex items-center gap-1.5 transition-all ${
                    active ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container-lowest text-on-surface-variant border border-surface-container-highest hover:bg-surface-container'
                  }`}
                  type="button"
                >
                  <Icon name={d.icon} className={`text-sm ${active ? '' : 'text-secondary'}`} />
                  <span>{d.key}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* CTA */}
        <section className="flex flex-col gap-3 pt-2">
          <button
            onClick={() => setConfirming(true)}
            className="w-full bg-secondary-container hover:bg-secondary active:scale-[0.98] transition-all duration-150 text-on-secondary-container hover:text-white py-4 px-6 rounded-2xl shadow-md flex items-center justify-center gap-2 font-headline font-extrabold text-base"
            type="button"
          >
            <Icon name="favorite" fill className="text-xl" />
            <span>
              Donar {formatCOP(amount)} {frequency === 'mensual' ? 'al mes' : 'ahora'}
            </span>
            <Icon name="arrow_forward" className="text-lg" />
          </button>
          <div className="flex items-center justify-center gap-1.5 text-xs text-on-surface-variant text-center">
            <Icon name="verified_user" className="text-sm text-tertiary-container" />
            <span>Pago seguro y encriptado · Recibes comprobante</span>
          </div>
          <div className="flex items-center justify-center gap-3 pt-1 opacity-70 text-[11px] font-label font-bold text-on-surface-variant">
            {PAYMENT_METHODS.map((m, i) => (
              <span key={m.key} className="flex items-center gap-1">
                {i > 0 && <span className="mr-2">•</span>}
                <Icon name={m.icon} className="text-sm" /> {m.key}
              </span>
            ))}
          </div>
        </section>

        {/* Impacto */}
        <section className="pt-4 border-t border-surface-container-high flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div>
              <div className="flex items-center gap-1 text-[11px] font-label font-bold text-tertiary uppercase">
                <Icon name="check_circle" fill className="text-xs" /> 100% auditado
              </div>
              <h3 className="font-headline font-bold text-base text-primary">Nuestro impacto comunitario</h3>
            </div>
            <Link to="/mapa?vista=lista" className="text-xs font-label text-secondary font-bold hover:underline">
              Ver casos
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { icon: 'pets', v: statsQ.data?.censados, l: 'Animales reportados', box: 'bg-primary/10 text-primary' },
              { icon: 'home', v: statsQ.data?.adopciones, l: 'En adopción', box: 'bg-tertiary-fixed text-on-tertiary-fixed', fill: true },
              { icon: 'healing', v: statsQ.data?.atendidos, l: 'Reportes atendidos', box: 'bg-secondary-fixed text-on-secondary-fixed' },
            ].map((s) => (
              <div key={s.l} className="bg-surface-container-lowest p-3 rounded-2xl border border-surface-container-highest shadow-sm flex flex-col items-center text-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1.5 ${s.box}`}>
                  <Icon name={s.icon} fill={s.fill} className="text-lg" />
                </div>
                <span className="font-headline font-black text-base text-primary tracking-tight">{s.v === undefined ? '–' : formatNumber(s.v)}</span>
                <span className="text-[10px] font-label text-on-surface-variant font-medium leading-tight mt-0.5">{s.l}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-outline flex gap-1.5 items-start">
            <Icon name="info" className="text-sm" /> Las cifras se calculan en tiempo real con los reportes y donaciones registrados en ARASK.
          </p>
        </section>
      </main>

      {/* Confirmación de pago (simulado) */}
      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Confirmar donación"
        subtitle={`${formatCOP(amount)} ${frequency === 'mensual' ? 'cada mes' : 'una sola vez'} · ${destination}`}
      >
        <div className="space-y-2">
          {PAYMENT_METHODS.map((m) => (
            <label
              key={m.key}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                method === m.key ? 'border-primary bg-primary-fixed/20' : 'border-surface-container-high hover:bg-surface-container-low'
              }`}
            >
              <input type="radio" name="method" checked={method === m.key} onChange={() => setMethod(m.key)} className="text-primary focus:ring-primary" />
              <Icon name={m.icon} className="text-primary" />
              <div className="flex-1 text-xs">
                <strong className="block text-on-surface">{m.key}</strong>
                <span className="text-outline text-[11px]">{m.hint}</span>
              </div>
            </label>
          ))}
        </div>
        <p className="text-[11px] text-outline bg-surface-container-low rounded-xl p-2.5 flex gap-2">
          <Icon name="info" className="text-sm" />
          Versión de prueba: no se realiza ningún cobro real. La pasarela de pagos se conectará en el Sprint 3.
        </p>
        <button
          onClick={pay}
          disabled={donateM.isPending}
          className="w-full py-3.5 bg-secondary-container text-white font-extrabold rounded-2xl text-sm active:scale-95 transition-transform flex items-center justify-center gap-2 shadow-md"
          type="button"
        >
          <Icon name="lock" className="text-base" /> Pagar con {method}
        </button>
      </Sheet>

      {/* Historial */}
      <Sheet open={history} onClose={() => setHistory(false)} title="Tus donaciones" subtitle={`${donations.length} registrada${donations.length === 1 ? '' : 's'} en tu cuenta`}>
        {donations.length === 0 ? (
          <p className="text-xs text-outline py-4 text-center">Aún no has hecho donaciones.</p>
        ) : (
          <ul className="divide-y divide-surface-container-high">
            {donations.map((d) => (
              <li key={d.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-on-surface">{d.caseName ? `Caso ${d.caseName}` : d.destination}</p>
                  <p className="text-outline text-[11px]">
                    {formatWhen(d.createdAt)} · {d.method} · {d.frequency === 'mensual' ? 'Mensual' : 'Única'}
                  </p>
                </div>
                <span className="font-headline font-extrabold text-primary">{formatCOP(d.amount)}</span>
              </li>
            ))}
          </ul>
        )}
        {generalDonations.length > 0 && (
          <p className="text-[11px] text-outline">Total a la campaña: {formatCOP(generalDonations.reduce((s, d) => s + d.amount, 0))}</p>
        )}
      </Sheet>
    </div>
  )
}
