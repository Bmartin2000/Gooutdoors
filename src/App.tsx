import { Navigate, Route, Routes } from 'react-router-dom'
import { useGame } from './app/GameContext.tsx'
import { usePreferences } from './app/usePreferences.ts'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import DeskPage from './desk/DeskPage.tsx'
import OutsidePage from './outside/OutsidePage.tsx'

export default function App() {
  const { ready, isAIHost, settings } = useGame()
  usePreferences(settings)
  if (!ready) return <div className="boot" aria-busy="true" aria-label="Loading AFK.exe" />
  return (
    <ErrorBoundary>
      <Routes>
        {/* The desk lives on the computer that runs Ollama; phones go straight outside. */}
        <Route index element={isAIHost ? <DeskPage /> : <Navigate to="/outside" replace />} />
        <Route path="outside" element={<OutsidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
