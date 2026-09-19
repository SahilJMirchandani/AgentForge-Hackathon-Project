import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export default function RequireAuth({ children }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  const authHydrating = useAppStore((s) => s.authHydrating)
  if (authHydrating) {
    return <div className="min-h-screen bg-canvas flex items-center justify-center text-sm text-ink-soft">Loading your workspace…</div>
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}
