import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { AIStatusProvider } from './app/AIStatusContext.tsx'
import { GameProvider } from './app/GameContext.tsx'
import { registerServiceWorker } from './pwa/registerSW.ts'
import './styles/tokens.css'
import './styles/base.css'
import './styles/ui.css'
import './styles/pages.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AIStatusProvider>
        <GameProvider>
          <App />
        </GameProvider>
      </AIStatusProvider>
    </BrowserRouter>
  </StrictMode>,
)

registerServiceWorker()
