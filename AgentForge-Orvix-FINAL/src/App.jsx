import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Templates from './pages/Templates'
import Agents from './pages/Agents'
import CreateWorkflow from './pages/CreateWorkflow'
import WorkflowEditor from './pages/WorkflowEditor'
import History from './pages/History'
import Settings from './pages/Settings'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const hydrateFromApi = useAppStore((state) => state.hydrateFromApi)

  useEffect(() => {
    hydrateFromApi()
  }, [hydrateFromApi])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/create" element={<CreateWorkflow />} />
        <Route path="/workflow/:id" element={<WorkflowEditor />} />
        <Route path="/history" element={<History />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  )
}
