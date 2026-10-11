import { NavLink, Outlet } from 'react-router-dom'
import OllamaStatus from './OllamaStatus.tsx'

export default function Layout() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          Gooutdoors
        </NavLink>
        <nav>
          <NavLink to="/" end>Felfedezés</NavLink>
          <NavLink to="/asszisztens">Túraasszisztens</NavLink>
          <NavLink to="/rolunk">Nyílt forrás</NavLink>
        </nav>
        <OllamaStatus />
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
