import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout.tsx'
import AboutPage from './pages/AboutPage.tsx'
import AssistantPage from './pages/AssistantPage.tsx'
import NotFoundPage from './pages/NotFoundPage.tsx'

// A three.js-es főoldal külön chunkba kerül, így a többi oldal gyorsan tölt.
const HomePage = lazy(() => import('./pages/HomePage.tsx'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<p className="loading">3D jelenet betöltése…</p>}>
              <HomePage />
            </Suspense>
          }
        />
        <Route path="asszisztens" element={<AssistantPage />} />
        <Route path="rolunk" element={<AboutPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
