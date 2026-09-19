import { NavLink } from 'react-router-dom'
import { Home, LayoutTemplate, Bot, History, Settings, Sparkles } from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Home', icon: Home, end: true },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/agents', label: 'My Agents', icon: Bot },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Sidebar() {
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <Sparkles size={16} className="text-white" />
        </div>
        <span className="font-semibold text-ink">AgentForge</span>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-control text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-light text-primary'
                  : 'text-ink-soft hover:bg-canvas hover:text-ink'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 mx-3 mb-4 rounded-card bg-canvas text-center">
        <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary-light flex items-center justify-center">
          <Sparkles size={18} className="text-primary" />
        </div>
        <p className="text-xs text-ink-soft leading-snug">
          Turn your ideas into intelligent workflows.
        </p>
      </div>
    </aside>
  )
}
