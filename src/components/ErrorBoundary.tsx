import { Component, type ReactNode } from 'react'

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page page--narrow" role="alert">
        <div className="card card--pad stack-4">
          <p className="eyebrow">Something broke</p>
          <h1 className="h2">This screen hit an unexpected error.</h1>
          <p className="muted">Your progress and photos are stored locally and are safe. Reloading usually fixes it.</p>
          <div className="row-2">
            <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
              Reload AFK.exe
            </button>
            <button type="button" className="btn" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }
}
