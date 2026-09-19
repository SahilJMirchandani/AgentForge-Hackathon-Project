import { useNavigate } from 'react-router-dom'
import { Plus, LayoutTemplate, History as HistoryIcon, CheckCircle2, Loader2, XCircle, ListChecks } from 'lucide-react'
import { useAppStore } from '../store/useAppStore'
import StatCard from '../components/StatCard'
import StatusBadge from '../components/StatusBadge'

function timeAgo(ts) {
  const mins = Math.max(1, Math.round((Date.now() - ts) / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const workflows = useAppStore((s) => s.workflows)
  const userName = useAppStore((s) => s.userName)

  const completed = workflows.filter((w) => w.status === 'Completed').length
  const running = workflows.filter((w) => w.status === 'Running').length
  const failed = workflows.filter((w) => w.status === 'Failed').length

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-ink">Good morning, {userName}! 👋</h1>
      <p className="text-sm text-ink-soft mt-1">Turn your ideas into intelligent workflows.</p>

      <div className="flex flex-wrap gap-4 mt-6">
        <StatCard icon={ListChecks} label="Total Workflows" value={workflows.length} tone="primary" />
        <StatCard icon={CheckCircle2} label="Completed" value={completed} tone="success" />
        <StatCard icon={Loader2} label="In Progress" value={running} tone="running" />
        <StatCard icon={XCircle} label="Failed" value={failed} tone="danger" />
      </div>

      <h2 className="text-sm font-semibold text-ink mt-8 mb-3">Quick Actions</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/create')}
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-card shadow-card text-left hover:border-primary/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-primary-light text-primary flex items-center justify-center">
            <Plus size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Create New Workflow</p>
            <p className="text-xs text-ink-soft">Start with a natural language prompt</p>
          </div>
        </button>
        <button
          onClick={() => navigate('/templates')}
          className="flex items-center gap-3 p-4 bg-surface border border-border rounded-card shadow-card text-left hover:border-primary/40 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-success-light text-success flex items-center justify-center">
            <LayoutTemplate size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Browse Templates</p>
            <p className="text-xs text-ink-soft">Use a ready-made template</p>
          </div>
        </button>
      </div>

      <div className="flex items-center justify-between mt-8 mb-3">
        <h2 className="text-sm font-semibold text-ink">Recent Workflows</h2>
        <button onClick={() => navigate('/history')} className="text-xs font-medium text-primary hover:underline">
          View all →
        </button>
      </div>

      <div className="bg-surface border border-border rounded-card shadow-card divide-y divide-border">
        {workflows.length === 0 && (
          <div className="flex items-center gap-3 p-6 text-sm text-ink-soft">
            <HistoryIcon size={16} />
            No workflows yet — create your first one to see it here.
          </div>
        )}
        {workflows.slice(0, 5).map((w) => (
          <button
            key={w.id}
            onClick={() => navigate(`/workflow/${w.id}`)}
            className="w-full flex items-center justify-between gap-3 p-4 hover:bg-canvas transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-primary-light text-primary flex items-center justify-center shrink-0 text-xs font-semibold">
                {w.name.slice(0, 1)}
              </div>
              <p className="text-sm font-medium text-ink truncate">{w.name}</p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <StatusBadge status={w.status} />
              <span className="text-xs text-ink-soft w-16 text-right">{timeAgo(w.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
