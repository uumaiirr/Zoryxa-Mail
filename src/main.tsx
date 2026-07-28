import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

registerSW({ immediate: true })

// Theme: explicit choice wins; the default is Light (Settings → Appearance).
const savedTheme = localStorage.getItem('zx-theme')
if (savedTheme === 'auto') delete document.documentElement.dataset.theme
else document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light'

async function boot() {
  // Demo mode is statically eliminated from production builds (VITE_DEMO unset).
  if (import.meta.env.VITE_DEMO === '1') {
    const { installDemo } = await import('./lib/demo')
    installDemo()
  }
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  )
}

void boot()
