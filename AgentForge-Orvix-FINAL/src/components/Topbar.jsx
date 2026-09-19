import { Search, Bell } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'

export default function Topbar({ userName = 'User' }) {
  const notifications = useAppStore((s) => s.notifications)
  const isNotificationsOpen = useAppStore((s) => s.isNotificationsOpen)
  const toggleNotifications = useAppStore((s) => s.toggleNotifications)
  const markAllNotificationsRead = useAppStore((s) => s.markAllNotificationsRead)

  const unreadCount = (notifications || []).filter((n) => !n.read).length

  return (
    <header className="h-16 border-b border-border bg-surface flex items-center justify-between px-6 gap-4">
      <div className="relative w-full max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          placeholder="Search anything..."
          className="w-full pl-9 pr-3 py-2 text-sm rounded-control border border-border bg-canvas focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={toggleNotifications}
            className="relative text-ink-soft hover:text-ink"
            aria-label="Notifications"
          >
            <Bell size={19} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-danger text-[10px] text-white flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div className="absolute right-0 top-12 w-72 rounded-xl border border-border bg-surface shadow-card z-20 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-ink">Notifications</p>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={markAllNotificationsRead}
                >
                  Mark all read
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-auto">
                {(notifications || []).length === 0 ? (
                  <p className="text-xs text-ink-soft">No notifications yet.</p>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`rounded-lg border px-3 py-2 ${notification.read ? 'border-border bg-canvas' : 'border-primary/30 bg-primary/5'}`}
                    >
                      <p className="text-sm font-medium text-ink">{notification.title}</p>
                      <p className="text-xs text-ink-soft mt-0.5">{notification.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-secondary-light text-secondary flex items-center justify-center text-xs font-semibold">
            {(userName || 'U').slice(0, 1).toUpperCase()}
          </div>
          <span className="text-sm text-ink-soft">Hey, {userName}</span>
        </div>
      </div>
    </header>
  )
}
