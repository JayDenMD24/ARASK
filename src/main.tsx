import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { AppStoreProvider } from './store/AppStore'
import { AuthProvider } from './store/AuthProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 20_000, refetchOnWindowFocus: true, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppStoreProvider>
            <App />
          </AppStoreProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
