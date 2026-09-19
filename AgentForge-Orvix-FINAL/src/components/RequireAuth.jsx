import { Navigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'

export default function RequireAuth({ children }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return children
}
