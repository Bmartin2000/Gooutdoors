import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <section className="page">
      <h1>Letértél az ösvényről</h1>
      <p>Ez az oldal nem létezik.</p>
      <Link to="/" className="button">
        Vissza a kezdőpontra
      </Link>
    </section>
  )
}
