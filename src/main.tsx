import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './locales/LanguageProvider'
import DwightEstadoN8n from './components/DwightEstadoN8n'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
<LanguageProvider>
  <App />
    <DwightEstadoN8n />
    </LanguageProvider>u
  </StrictMode>,
)
