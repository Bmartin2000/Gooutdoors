import { Navigate, Route, Routes } from 'react-router-dom'
import { useGame } from './app/GameContext.tsx'
import { usePreferences } from './app/usePreferences.ts'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import DeskPage from './desk/DeskPage.tsx'
import OutsidePage from './outside/OutsidePage.tsx'

export default function App() {
  const { ready, settings } = useGame()
  usePreferences(settings)
  if (!ready) return <div className="boot" aria-busy="true" aria-label="Loading AFK.exe" />
  return (
    <ErrorBoundary>
      <Routes>
        {/* The full game works on phones and static hosting; only AI tools need a local model. */}
        <Route index element={<DeskPage />} />
        <Route path="outside" element={<OutsidePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  )
}
