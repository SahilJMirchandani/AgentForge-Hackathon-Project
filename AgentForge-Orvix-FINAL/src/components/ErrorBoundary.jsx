import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Something went wrong.' }
  }

  componentDidCatch(error) {
    console.error('[AgentForge UI Error]', error)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-surface border border-border rounded-card shadow-card p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-danger-light text-danger flex items-center justify-center text-lg font-semibold">!</div>
          <h1 className="mt-4 text-lg font-semibold text-ink">AgentForge needs a refresh</h1>
          <p className="mt-2 text-sm text-ink-soft">An unexpected interface error occurred. Your server data is not intentionally deleted.</p>
          <button type="button" onClick={() => window.location.reload()} className="mt-5 px-4 py-2.5 rounded-control bg-primary text-white text-sm font-medium hover:bg-primary-hover">Refresh AgentForge</button>
        </div>
      </div>
    )
  }
}
