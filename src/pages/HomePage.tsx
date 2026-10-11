import { Link } from 'react-router-dom'
import OutdoorScene from '../scene/OutdoorScene.tsx'

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero__canvas">
        <OutdoorScene />
      </div>
      <div className="hero__panel">
        <h1>Irány a szabadba!</h1>
        <p>
          Tervezd meg a következő túrádat egy teljesen helyben futó, nyílt forráskódú AI-asszisztenssel.
          Nincs regisztráció, nincs előfizetés, az adataid nem hagyják el a gépedet.
        </p>
        <Link to="/asszisztens" className="button">
          Túra tervezése
        </Link>
      </div>
    </section>
  )
}
