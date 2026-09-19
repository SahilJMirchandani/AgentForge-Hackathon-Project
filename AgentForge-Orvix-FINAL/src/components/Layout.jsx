import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import { useAppStore } from '../store/useAppStore'

export default function Layout() {
  const userName = useAppStore((s) => s.userName)
  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar userName={userName} />
        <main className="flex-1 p-6 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
