import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import './index.css'

registerSW({ immediate: true })

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
