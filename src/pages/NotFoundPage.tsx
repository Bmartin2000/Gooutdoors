import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="page page--narrow stack-4">
      <p className="eyebrow">404</p>
      <h1 className="h1">You wandered off the trail.</h1>
      <p className="muted">This page doesn’t exist.</p>
      <Link to="/" className="btn btn--primary">
        Back to your workspace
      </Link>
    </div>
  )
}
