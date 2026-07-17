import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { router } from './routes'
import './index.css'
import { initOtel } from './lib/otel'
import { initI18n } from './lib/i18n'
import { AuthProvider } from './lib/auth'
import { createQueryClient } from './lib/query-client'
import { AppErrorBoundary } from './lib/errors/AppErrorBoundary'
import { ErrorToastHost } from './lib/errors/ErrorToastHost'
import { initSentry } from './lib/errors/sentry'
import { DevDiagnostics } from './lib/DevDiagnostics'

initOtel()
initSentry()
initI18n()

const queryClient = createQueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <RouterProvider router={router} />
          {import.meta.env.DEV ? <DevDiagnostics /> : null}
        </AuthProvider>
        <ErrorToastHost />
        {import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
