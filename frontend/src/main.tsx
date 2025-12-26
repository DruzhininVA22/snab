/**
 * Точка входа фронтенда SNAB.
 *
 * Здесь инициализируются:
 * - MUI ThemeProvider + CssBaseline (единый базовый стиль интерфейса),
 * - React Query (кэширование запросов к API и управление состоянием загрузки),
 * после чего монтируется корневой компонент <App />.
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// React Query Devtools (optional, comment out if not installed)
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import App from './App'

const theme = createTheme({ palette: { mode: 'light' } })
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    }
  }
})

const rootEl = document.getElementById('root') as HTMLElement
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <App />
        {/* <ReactQueryDevtools initialIsOpen={false} /> */}
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>
)
