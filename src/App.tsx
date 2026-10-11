import { Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell.tsx'
import CompanionPage from './pages/CompanionPage.tsx'
import ContractPage from './pages/ContractPage.tsx'
import ExplorePage from './pages/ExplorePage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'
import WorkspacePage from './pages/WorkspacePage.tsx'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<WorkspacePage />} />
        <Route path="contracts/:id" element={<ContractPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="companion" element={<CompanionPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
