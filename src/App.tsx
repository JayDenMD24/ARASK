import { useEffect } from 'react'
import { Link, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import { Icon, LoadingScreen, Toast } from './components/ui'
import Home from './pages/Home'
import MapPage from './pages/MapPage'
import Report from './pages/Report'
import Donate from './pages/Donate'
import CaseDetail from './pages/CaseDetail'
import Profile from './pages/Profile'
import AuthPage from './pages/AuthPage'
import Notifications from './pages/Notifications'
import Admin from './pages/Admin'
import { useAuth } from './store/AuthProvider'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/** Exige sesión iniciada; si no, envía a /entrar y vuelve después. */
function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <LoadingScreen label="Abriendo ARASK…" />
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname + location.search }} />
  return <Outlet />
}

function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

function TabsLayout() {
  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  )
}

function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center">
      <Icon name="pets" fill className="text-5xl text-primary" />
      <h1 className="font-headline font-extrabold text-xl text-primary">No encontramos esta página</h1>
      <Link to="/" className="px-4 py-2 rounded-full bg-primary-container text-white text-sm font-bold">
        Volver al inicio
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Toast />
      <Routes>
        <Route path="entrar" element={<AuthPage mode="login" />} />
        <Route path="registro" element={<AuthPage mode="register" />} />
        <Route element={<RequireAuth />}>
          <Route element={<TabsLayout />}>
            <Route index element={<Home />} />
            <Route path="mapa" element={<MapPage />} />
            <Route path="donar" element={<Donate />} />
            <Route path="perfil" element={<Profile />} />
          </Route>
          <Route path="reportar" element={<Report />} />
          <Route path="caso/:id" element={<CaseDetail />} />
          <Route path="notificaciones" element={<Notifications />} />
          <Route element={<RequireAdmin />}>
            <Route path="admin" element={<Admin />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  )
}
